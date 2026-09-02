import { Client, Account as AppwriteAccount, Storage, Databases, ID, Teams, Query, Permission, Role, Realtime } from 'appwrite';

import { projectID, endpoint, cleanEnvVar, isAppwriteConfigured, getAppOrigin } from './appwriteConfig';
export { isAppwriteConfigured, getAppOrigin };

export function compressImageIfNeeded(file: File): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_DIM = 1600;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const lastDot = file.name.lastIndexOf('.');
            const nameWithoutExt = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
            const compressedFile = new File([blob], `${nameWithoutExt}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          0.75
        );
      };
      img.onerror = () => {
        resolve(file);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      resolve(file);
    };
    reader.readAsDataURL(file);
  });
}

interface QueueItem {
  id: string;
  type: 'save' | 'delete' | 'save_global' | 'delete_global';
  dbId: string;
  collectionId?: string;
  docId: string;
  orgId?: string;
  dataObj?: any;
  timestamp: number;
}

class AppwriteService {
  private client: Client;
  private account: AppwriteAccount;
  private storage: Storage;
  private databases: Databases;
  private teams: Teams;
  private realtime: Realtime;
  private sessionPromise: Promise<any> | null = null;
  private lastConnectionAlertAt = 0;

  constructor() {
    this.client = new Client();
    if (isAppwriteConfigured()) {
      this.client
        .setEndpoint(endpoint)
        .setProject(projectID);
    }
    this.account = new AppwriteAccount(this.client);
    this.storage = new Storage(this.client);
    this.databases = new Databases(this.client);
    this.teams = new Teams(this.client);
    this.realtime = new Realtime(this.client);

    // Monkey-patch WebSocket for Appwrite Realtime server compatibility
    if (typeof window !== 'undefined' && !(window as any)._appwriteWsPatched) {
      (window as any)._appwriteWsPatched = true;
      const OriginalWebSocket = window.WebSocket;
      const self = this;
      window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
        let urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('/realtime') && urlStr.includes('project=')) {
          try {
            const activeSubs = (self.realtime as any).activeSubscriptions;
            if (activeSubs && activeSubs.size > 0) {
              const channelsList: string[] = [];
              for (const sub of activeSubs.values()) {
                if (sub.channels) {
                  for (const ch of sub.channels) {
                    channelsList.push(ch);
                  }
                }
              }
                if (channelsList.length > 0) {
                  // Only append channels that are not already present in the query parameters
                  try {
                    // Handle potential relative WebSocket URLs (e.g. wss:// or ws://) securely
                    const parsedUrl = new URL(urlStr.replace(/^ws(s)?:/, 'http$1:'));
                    const existingParams = parsedUrl.searchParams;
                    const newChannels = channelsList.filter(ch => {
                      const values = existingParams.getAll('channels[]');
                      return !values.includes(ch);
                    });
                    
                    if (newChannels.length > 0) {
                      const separator = urlStr.includes('?') ? '&' : '?';
                      const channelsQuery = newChannels
                        .map(ch => `channels[]=${encodeURIComponent(ch)}`)
                        .join('&');
                      urlStr = `${urlStr}${separator}${channelsQuery}`;
                    }
                  } catch (urlErr) {
                    // Fallback to simple query appending if URL parsing fails
                    const separator = urlStr.includes('?') ? '&' : '?';
                    const channelsQuery = channelsList
                      .map(ch => `channels[]=${encodeURIComponent(ch)}`)
                      .join('&');
                    urlStr = `${urlStr}${separator}${channelsQuery}`;
                  }
                }
            }
          } catch (err) {
            // silent fail
          }
        }
        const socket = new OriginalWebSocket(urlStr, protocols);
        return socket;
      } as any;
      window.WebSocket.prototype = OriginalWebSocket.prototype;
      Object.assign(window.WebSocket, OriginalWebSocket);
    }
  }

  getClient() {
    return this.client;
  }

  getRealtime() {
    return this.realtime;
  }

  // Authorize or get active session to enable standard RBAC writes safely
  async initSession() {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite credentials not detected in environment variables.');
    }

    if (this.sessionPromise) {
      return this.sessionPromise;
    }

    this.sessionPromise = (async () => {
      try {
        const stored = localStorage.getItem('ttt_cf_user');
        if (stored) this.cachedUser = JSON.parse(stored);
      } catch (_) {}
    })();
  }

  private getBaseUrl(): string {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }

  private getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    if (!this.jwt && typeof window !== 'undefined') {
      const storedJwt = localStorage.getItem('ttt_cf_jwt');
      if (storedJwt && storedJwt !== 'null' && storedJwt !== 'undefined' && storedJwt.length > 10) {
        this.jwt = storedJwt;
      }
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    if (this.jwt && this.jwt !== 'null' && this.jwt !== 'undefined' && this.jwt.length > 10) {
      headers['Authorization'] = `Bearer ${this.jwt.trim()}`;
    }
    return headers;
  }

  getClient(): any {
    return {
      subscribe: (_channels: string | string[], callback: (response: any) => void) => {
        this.subscribers.add(callback);
        return () => {
          this.subscribers.delete(callback);
        };
      },
    };
  }

  async initSession(): Promise<any> {
    if (typeof window !== 'undefined') {
      const storedJwt = localStorage.getItem('ttt_cf_jwt');
      if (storedJwt && storedJwt !== 'null' && storedJwt !== 'undefined' && storedJwt.length > 10) {
        this.jwt = storedJwt;
      }
      if (!this.cachedUser) {
        const stored = localStorage.getItem('ttt_cf_user');
        if (stored) {
          try { this.cachedUser = JSON.parse(stored); } catch (_) {}
        }
      }
    }
    if (this.cachedUser) return this.cachedUser;
    if (!this.jwt) return null;
    try {
      return await this.getCurrentUser();
    } catch (_) {
      return this.cachedUser || null;
    }
  }

  async login(email: string, password: string): Promise<any> {
    const response = await secureFetch(`${this.getBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(errData.error || `Login failed: ${response.statusText}`);
    }
    const randomId = 'usr_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 10);
    return await this.account.create(randomId.substring(0, 36), email, password, name);
  }

  async register(email: string, password: string, name: string): Promise<any> {
    const response = await secureFetch(`${this.getBaseUrl()}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(errData.error || `Registration failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.jwt = data.jwt;
    this.cachedUser = data.user || data;

    if (typeof window !== 'undefined') {
      if (this.jwt) localStorage.setItem('ttt_cf_jwt', this.jwt);
      if (this.cachedUser) localStorage.setItem('ttt_cf_user', JSON.stringify(this.cachedUser));
      localStorage.setItem('ttt_login_method', 'appwrite');
    }

    return this.cachedUser;
  }

  async logout(): Promise<void> {
    try {
      if (this.jwt) {
        await fetch(`${this.getBaseUrl()}/api/auth/logout`, {
          method: 'POST',
          headers: this.getHeaders(),
        }).catch(() => {});
      }
    } finally {
      this.jwt = null;
      this.cachedUser = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ttt_cf_jwt');
        localStorage.removeItem('ttt_cf_user');
        localStorage.removeItem('ttt_login_method');
      }
    }
  }

  async getCurrentUser(): Promise<any> {
    if (typeof window !== 'undefined') {
      const storedJwt = localStorage.getItem('ttt_cf_jwt');
      if (storedJwt && storedJwt !== 'null' && storedJwt !== 'undefined' && storedJwt.length > 10) {
        this.jwt = storedJwt;
      }
      if (!this.cachedUser) {
        const stored = localStorage.getItem('ttt_cf_user');
        if (stored) {
          try { this.cachedUser = JSON.parse(stored); } catch (_) {}
        }
      }
    }
    if (!this.jwt || this.jwt === 'null' || this.jwt === 'undefined' || this.jwt.length < 10) {
      return this.cachedUser || null;
    }

    try {
      const response = await secureFetch(`${this.getBaseUrl()}/api/auth/me`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.jwt = null;
          this.cachedUser = null;
          if (typeof window !== 'undefined') {
            localStorage.removeItem('ttt_cf_jwt');
            localStorage.removeItem('ttt_cf_user');
          }
          return null;
        }
        return this.cachedUser || null;
      }

      const data = await response.json();
      const user = data.user || data;
      this.cachedUser = user;
      if (typeof window !== 'undefined') {
        localStorage.setItem('ttt_cf_user', JSON.stringify(user));
      }
      return user;
    } catch (err) {
      return this.cachedUser || null;
    }
  }

  async pullFleetData(orgId: string): Promise<any> {
    const res = await secureFetch(`${this.getBaseUrl()}/api/database/pull`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        orgId,
        targetCollections: [
          'trucks',
          'drivers',
          'offices',
          'accounts',
          'trips',
          'expenses',
          'tyres',
          'audit_logs',
          'global_configs'
        ]
      })
    });
    if (!res.ok) {
      throw new Error(`Failed to pull database: ${res.statusText}`);
    }
    const data = await res.json();
    return data.loadedState || {};
  }

  async updateName(newName: string): Promise<any> {
    const response = await secureFetch(`${this.getBaseUrl()}/api/auth/update-name`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name: newName }),
    });
    if (!response.ok) throw new Error('Failed to update name');
    if (this.cachedUser) {
      this.cachedUser.name = newName;
      if (typeof window !== 'undefined') {
        localStorage.setItem('ttt_cf_user', JSON.stringify(this.cachedUser));
      }
    }
    return response.json();
  }

  async updatePassword(newPassword: string, oldPassword: string): Promise<any> {
    const response = await secureFetch(`${this.getBaseUrl()}/api/auth/update-password`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ newPassword, oldPassword }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to update password' }));
      throw new Error(err.error || 'Failed to update password');
    }
    return response.json();
  }

  async updatePhone(phone: string, passwordStr: string): Promise<any> {
    const response = await secureFetch(`${this.getBaseUrl()}/api/auth/update-phone`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ phone, password: passwordStr }),
    });
    if (!response.ok) throw new Error('Failed to update phone');
    if (this.cachedUser) {
      this.cachedUser.phone = phone;
      if (typeof window !== 'undefined') {
        localStorage.setItem('ttt_cf_user', JSON.stringify(this.cachedUser));
      }
    }
    return response.json();
  }

  async createVerification(_url: string): Promise<any> {
    return { success: true };
  }

  async updateVerification(_userId: string, _secret: string): Promise<any> {
    return { success: true };
  }

  async createPhoneVerification(): Promise<any> {
    return { success: true };
  }

  async updatePhoneVerification(_userId: string, _secret: string): Promise<any> {
    return { success: true };
  }

  async createRecovery(email: string, url: string): Promise<any> {
    const response = await secureFetch(`${this.getBaseUrl()}/api/auth/recovery`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, url }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to create recovery request' }));
      throw new Error(err.error || 'Failed to create recovery request');
    }
    return response.json();
  }

  async updateRecovery(userId: string, secret: string, passwordStr: string): Promise<any> {
    const response = await secureFetch(`${this.getBaseUrl()}/api/auth/update-recovery`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ userId, secret, password: passwordStr }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to reset password' }));
      throw new Error(err.error || 'Failed to reset password');
    }
    return response.json();
  }

  getBucketId(): string {
    return 'cf_d1_storage';
  }

  /** Returns the dedicated support-ticket attachment bucket, or falls back to main bucket */
  getTicketsBucketId() {
    const ticketBucket = cleanEnvVar(import.meta.env.VITE_APPWRITE_TICKETS_BUCKET_ID || '');
    return ticketBucket || this.getBucketId();
  }

  async uploadFile(file: File, customName?: string, organizationId?: string): Promise<string> {
    const compressed = await compressImageIfNeeded(file);
    const formData = new FormData();
    formData.append('file', compressed);
    if (customName) formData.append('fileName', customName);
    if (organizationId) formData.append('organizationId', organizationId);

    const headers: Record<string, string> = {};
    if (this.jwt) headers['Authorization'] = `Bearer ${this.jwt}`;

    const response = await secureFetch(`${this.getBaseUrl()}/api/storage/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`File upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.$id || data.id;
  }

  /** Upload a file to the dedicated support_ticket bucket */
  async uploadTicketFile(file: File, customName?: string): Promise<string> {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    this.requireWriteConnection();
    await this.initSession();
    try {
      let fileToUpload = await compressImageIfNeeded(file);
      if (customName) {
        const lastDot = fileToUpload.name.lastIndexOf('.');
        const ext = lastDot !== -1 ? fileToUpload.name.substring(lastDot) : '';
        fileToUpload = new File([fileToUpload], `${customName}${ext}`, { type: fileToUpload.type });
      }
      const response = await this.storage.createFile(
        this.getTicketsBucketId(),
        ID.unique(),
        fileToUpload
      );
      return response.$id;
    } catch (err: any) {
      console.error('appwrite.uploadTicketFile error:', err);
      throw err;
    }
  }

  getFileView(fileId: string): string {
    if (!fileId) return '';
    return `${this.getBaseUrl()}/api/storage/file/${fileId}`;
  }

  /** Get view URL for a ticket attachment file */
  getTicketFileView(fileId: string): string {
    if (!isAppwriteConfigured() || !fileId) return '';
    try {
      const url = this.storage.getFileView(this.getTicketsBucketId(), fileId);
      return url.toString();
    } catch (err) {
      console.warn("Appwrite getTicketFileView failed:", err);
      return '';
    }
  }

  /** Get download URL for a ticket attachment file */
  getTicketFileDownload(fileId: string): string {
    if (!isAppwriteConfigured() || !fileId) return '';
    try {
      const url = this.storage.getFileDownload(this.getTicketsBucketId(), fileId);
      return url.toString();
    } catch (err) {
      console.warn("Appwrite getTicketFileDownload failed:", err);
      return '';
    }
  }

  async getSecureFileUrl(fileId: string): Promise<string> {
    if (!fileId) return '';
    try {
      const url = this.storage.getFileView(this.getBucketId(), fileId).toString();

      let headers: Record<string, string> = {
        'X-Appwrite-Project': projectID,
      };

      try {
        const jwt = await this.account.createJWT();
        headers['X-Appwrite-JWT'] = jwt.jwt;
      } catch (jwtErr) {
        // Fallback
      }

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch secure file: ${response.statusText}`);
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (_) {
      return this.getFileView(fileId);
    }
  }

  getFileDownload(fileId: string): string {
    if (!fileId) return '';
    return `${this.getBaseUrl()}/api/storage/file/${fileId}`;
  }

  async deleteFile(fileId: string): Promise<boolean> {
    if (!isAppwriteConfigured() || !fileId) return false;
    this.requireWriteConnection();
    await this.initSession();
    try {
      const res = await secureFetch(`${this.getBaseUrl()}/api/storage/file/${fileId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  async listFleetDocuments(_dbId: string, collectionId: string, orgId: string): Promise<any[]> {
    const res = await secureFetch(`${this.getBaseUrl()}/api/database/list/${collectionId}?orgId=${encodeURIComponent(orgId)}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to list documents from ${collectionId}`);
    }
    const data = await res.json();
    return data.documents || [];
  }

  async loadFleetDocument(_dbId: string, collectionId: string, docId: string): Promise<any> {
    const res = await secureFetch(`${this.getBaseUrl()}/api/database/doc/${collectionId}/${encodeURIComponent(docId)}`, {
      headers: this.getHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load document ${docId}`);
    return await res.json();
  }

  async updatePhone(phone: string, passwordStr: string) {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    return await this.account.updatePhone(phone, passwordStr);
  }

  async createVerification(url: string) {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    return await this.account.createVerification(url);
  }

  async updateVerification(userId: string, secret: string) {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    return await this.account.updateVerification(userId, secret);
  }

  async createPhoneVerification() {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    return await this.account.createPhoneVerification();
  }

  async updatePhoneVerification(userId: string, secret: string) {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    return await this.account.updatePhoneVerification(userId, secret);
  }

  async createRecovery(email: string, url: string) {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    return await this.account.createRecovery(email, url);
  }

  async updateRecovery(userId: string, secret: string, passwordStr: string) {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    return await this.account.updateRecovery(userId, secret, passwordStr);
  }

  normalizeTrip(trip: any): any {
    if (!trip) return trip;
    const arrayFields = ['payments', 'advances', 'fuels', 'subTrips'];
    arrayFields.forEach(field => {
      if (typeof trip[field] === 'string') {
        try {
          trip[field] = JSON.parse(trip[field]);
        } catch {
          trip[field] = [];
        }
      }
      if (!Array.isArray(trip[field])) {
        trip[field] = [];
      }
    });

    if (Array.isArray(trip.subTrips)) {
      trip.subTrips = trip.subTrips.map((st: any) => {
        let cargoExpenses = st.cargoExpenses;
        if (typeof cargoExpenses === 'string') {
          try {
            cargoExpenses = JSON.parse(cargoExpenses);
          } catch {
            cargoExpenses = [];
          }
        }
        if (!Array.isArray(cargoExpenses)) {
          cargoExpenses = [];
        }
        return {
          ...st,
          cargoExpenses
        };
      });
    }
    if (trip.deletedAt) {
      trip.status = 'Deleted';
    }
    return trip;
  }

  reconstructRecord(doc: any): any {
    if (!doc) return null;
    // Keep global_configs format unchanged (uses key/data)
    if (doc.$collectionId === 'global_configs' || doc.collectionId === 'global_configs') {
      return {
        key: doc.key,
        data: doc.data,
        id: doc.$id
      };
    }

    const record: any = {};

    for (const [key, val] of Object.entries(doc)) {
      if (key.startsWith('$') || key === 'data') continue;
      
      if (key === 'loans' || key === 'payments' || key === 'advances' || key === 'fuels' || key === 'movementHistory' || key === 'cargoExpenses') {
        try {
          record[key] = val ? (typeof val === 'string' ? JSON.parse(val) : val) : [];
        } catch {
          record[key] = [];
        }
      } else {
        record[key] = val;
      }
    }

    if (doc.data) {
      try {
        const parsed = JSON.parse(doc.data);
        if (parsed && typeof parsed === 'object') {
          Object.assign(record, parsed);
        }
      } catch (e) {
        // Fallback to flat property mapping
      }
    }

    // Normalize JSON array fields to ensure they are parsed as actual arrays
    const jsonFields = ['loans', 'payments', 'advances', 'fuels', 'movementHistory', 'cargoExpenses'];
    jsonFields.forEach(key => {
      if (record[key] !== undefined) {
        if (typeof record[key] === 'string') {
          try {
            record[key] = JSON.parse(record[key] as string);
          } catch {
            record[key] = [];
          }
        }
        // Double-check if it was double-stringified
        if (typeof record[key] === 'string') {
          try {
            record[key] = JSON.parse(record[key] as string);
          } catch {
            record[key] = [];
          }
        }
        if (!Array.isArray(record[key])) {
          record[key] = [];
        }
      }
    });

    if (!record.status) {
      record.status = 'Pending';
    } else if (record.status === 'Pald' || record.status === 'Paid') {
      record.status = 'Settled';
    }

    record.id = doc.$id || doc.id || record.id;
    record.organizationId = doc.organizationId || record.organizationId;
    record.createdAt = doc.$createdAt || record.createdAt;
    record.updatedAt = doc.$updatedAt || record.updatedAt;

    if (doc.$collectionId === 'trips' || doc.collectionId === 'trips') {
      return this.normalizeTrip(record);
    }
    return record;
  }

  /**
   * Subscribe to Appwrite Realtime events on the given channels.
   * Returns the unsubscribe function.
   */
  subscribe(channels: string[], callback: (response: any) => void): () => void {
    if (!isAppwriteConfigured()) return () => {};
    try {
      return this.client.subscribe(channels, callback);
    } catch (err) {
      console.warn('[AppwriteService] Realtime subscribe failed:', err);
      return () => {};
    }
  }

  /**
   * Fetch documents updated after `lastCursor` and before `syncStartedAt` for delta sync.
   */
  async fetchDeltaDocuments(
    dbId: string,
    collectionId: string,
    orgId: string,
    lastCursor: string | null,
    syncStartedAt: string
  ): Promise<any[]> {
    await this.initSession();
    try {
      const queries: string[] = [];
      if (orgId !== 'org_backend') {
        queries.push(Query.equal('organizationId', orgId));
      }
      if (lastCursor) {
        queries.push(Query.greaterThan('$updatedAt', lastCursor));
      }
      queries.push(Query.lessThanEqual('$updatedAt', syncStartedAt));
      queries.push(Query.limit(5000));
      queries.push(Query.orderAsc('$updatedAt'));

      const response = await this.databases.listDocuments(dbId, collectionId, queries);
      return (response.documents || []).map((doc: any) => this.reconstructRecord(doc));
    } catch (err: any) {
      const isNotFound =
        err.code === 404 ||
        err.type === 'collection_not_found' ||
        (err.message && err.message.toLowerCase().includes('not found'));
      if (isNotFound) {
        return [];
      }
      console.warn(`[AppwriteService] fetchDeltaDocuments failed for ${collectionId}:`, err);
      return [];
    }
  }

  /**
   * Fetch all records for the active organization in a dynamic collection.
   */
  async listFleetDocuments(dbId: string, collectionId: string, orgId: string, extraQueries: string[] = []): Promise<any[]> {
    await this.initSession();
    try {
      const queries = [...extraQueries];
      if (orgId !== 'org_backend') {
        queries.push(Query.equal('organizationId', orgId));
      }
      queries.push(Query.limit(5000));

      const response = await this.databases.listDocuments(
        dbId,
        collectionId,
        queries
      );
      const docs = response.documents || [];

      // If we are listing trips, also list sub_trips, fuels, and advances to stitch them together
      if (collectionId === 'trips') {
        let subDocs: any[] = [];
        let fuelDocs: any[] = [];
        let advDocs: any[] = [];
        try {
          subDocs = await this.listFleetDocuments(dbId, 'sub_trips', orgId);
        } catch (_) {}
        try {
          fuelDocs = await this.listFleetDocuments(dbId, 'fuels', orgId);
        } catch (_) {}
        try {
          advDocs = await this.listFleetDocuments(dbId, 'advances', orgId);
        } catch (_) {}

        const subTripsByTripId: Record<string, any[]> = {};
        for (const subDoc of subDocs) {
          const tripId = subDoc.tripId;
          if (tripId) {
            if (!subTripsByTripId[tripId]) subTripsByTripId[tripId] = [];
            subTripsByTripId[tripId].push(subDoc);
          }
        }

        const fuelsByTripId: Record<string, any[]> = {};
        for (const fuelDoc of fuelDocs) {
          const tripId = fuelDoc.tripId;
          if (tripId) {
            if (!fuelsByTripId[tripId]) fuelsByTripId[tripId] = [];
            fuelsByTripId[tripId].push(fuelDoc);
          }
        }

        const advancesByTripId: Record<string, any[]> = {};
        for (const advDoc of advDocs) {
          const tripId = advDoc.tripId;
          if (tripId) {
            if (!advancesByTripId[tripId]) advancesByTripId[tripId] = [];
            advancesByTripId[tripId].push(advDoc);
          }
        }

        return docs.map(doc => {
          const tripRecord = this.reconstructRecord(doc);
          if (subTripsByTripId[doc.$id]?.length) tripRecord.subTrips = subTripsByTripId[doc.$id];
          if (fuelsByTripId[doc.$id]?.length) tripRecord.fuels = fuelsByTripId[doc.$id];
          if (advancesByTripId[doc.$id]?.length) tripRecord.advances = advancesByTripId[doc.$id];
          return this.normalizeTrip(tripRecord);
        });
      }

      return docs.map(doc => this.reconstructRecord(doc));
    } catch (err: any) {
      const isNotFound = err.code === 404 || 
        err.type === 'collection_not_found' || 
        (err.message && err.message.toLowerCase().includes('not found'));
      if (isNotFound) {
        console.warn(`Appwrite database collection "${collectionId}" not found. Returning empty list.`);
        return [];
      }
      console.error(`Appwrite Database loading failure for collection ${collectionId}:`, err);
      let msg = err.message || `Unable to load database records from collection "${collectionId}".`;
      if (msg.toLowerCase().includes('failed to fetch')) {
        msg = "Network Error: Failed to fetch database records. Check CORS settings or Web Platform domain configurations in Appwrite Console.";
      }
      throw new Error(msg);
    }

    const data = await res.json();
    return data.docId || docId;
  }

  /**
   * Fetch a single document by ID from Appwrite Database.
   */
  async loadFleetDocument(dbId: string, collectionId: string, docId: string): Promise<any> {
    await this.initSession();
    try {
      const response = await this.databases.getDocument(dbId, collectionId, docId);
      if (!response) return null;

      const record = this.reconstructRecord(response);

      if (collectionId === 'trips' && record) {
        try {
          const subDocs = await this.databases.listDocuments(dbId, 'sub_trips', [
            Query.equal('tripId', docId),
            Query.limit(100)
          ]);
          record.subTrips = (subDocs.documents || []).map(sub => this.reconstructRecord(sub));
        } catch (subErr) {
          console.warn(`Failed to load sub-trips for single trip ${docId}:`, subErr);
          record.subTrips = [];
        }
        return this.normalizeTrip(record);
      }

      return record;
    } catch (err: any) {
      if (err.code === 404 || err.type === 'document_not_found') {
        return null;
      }
      console.error(`Appwrite Database getDocument failure for ${docId} in ${collectionId}:`, err);
      throw err;
    }
  }

  isRealtimeConnected(): boolean {
    if (!isAppwriteConfigured()) return true;
    try {
      const ws = (this.realtime as any).socket;
      if (!ws) {
        if (typeof navigator !== 'undefined') {
          return navigator.onLine;
        }
        return true;
      }
      return ws.readyState === 1 || ws.readyState === 0; // 1 = WebSocket.OPEN, 0 = WebSocket.CONNECTING
    } catch (_) {
      return false;
    }
  }

  private connectionRequiredError(): Error {
    const message = 'You are offline or the cloud database cannot be reached. Viewing saved data is available, but creating, editing, or deleting records requires an online connection.';
    // A write can be initiated outside the visible ConsoleApp (for example by a
    // delayed handler), so enforce and communicate this at the service boundary.
    if (typeof window !== 'undefined' && Date.now() - this.lastConnectionAlertAt > 1500) {
      this.lastConnectionAlertAt = Date.now();
      window.alert(message);
    }
    return new Error(message);
  }

  private requireWriteConnection(): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw this.connectionRequiredError();
    }
    if (isAppwriteConfigured() && !this.isRealtimeConnected()) {
      throw this.connectionRequiredError();
    }
  }

  async createSessionJwt(): Promise<string> {
    await this.initSession();
    const jwtResult = await this.account.createJWT();
    return jwtResult.jwt;
  }

  async registerPushNotificationTarget(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // Sample public VAPID key - fallback to browser default subscription if VAPID not supplied
        const vapidPublicKey = import.meta.env.VITE_APPWRITE_VAPID_KEY || '';
        if (vapidPublicKey) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidPublicKey
          });
        }
      }

      if (sub && isAppwriteConfigured()) {
        await this.initSession();
        const targetId = `target_${Date.now()}`;
        const identifier = JSON.stringify(sub);
        try {
          await (this.account as any).createPushTarget(targetId, identifier);
        } catch (_) {}
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[Push Notification Registration Warning]:', err);
      return false;
    }
  }

  private async proxyRequest(path: string, body: any): Promise<any> {
    if (!this.isRealtimeConnected()) {
      throw new Error('Backend system down, please try again later. Save only when online.');
    }
    let jwtToken = '';
    try {
      jwtToken = await this.createSessionJwt();
    } catch (err: any) {
      throw new Error("Session expired or authentication failed. Please re-login.");
    }

    const serverUrl = (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:' || (window as any).Capacitor)
      ? 'https://api.lorryguru.in/truck-backend'
      : (import.meta.env.DEV ? '' : 'https://api.lorryguru.in/truck-backend');

    try {
      const response = await fetch(`${serverUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (!response.ok) {
        const errObj = new Error(data.error || `Proxy request to ${path} failed with status ${response.status}`);
        if (data.stack) {
          (errObj as any).serverStack = data.stack;
        }
        throw errObj;
      }
      return data;
    } catch (fetchErr: any) {
      throw fetchErr;
    }
  }

  /**
   * Save a single document (upsert) to Appwrite Database via secure proxy.
   */
  async saveFleetDocument(dbId: string, collectionId: string, docId: string, orgId: string, dataObj: any, bypassQueue = false): Promise<string> {
    this.requireWriteConnection();
    try {
      const res = await this.proxyRequest('/api/database/save', { dbId, collectionId, docId, orgId, dataObj });
      return res.docId;
    } catch (err: any) {
      if (err instanceof TypeError || /network|fetch|backend system down/i.test(err.message || '')) {
        throw this.connectionRequiredError();
      }
      throw err;
    }
  }

  /**
   * Delete a single document from Appwrite Database via secure proxy.
   */
  async deleteFleetDocument(dbId: string, collectionId: string, docId: string, bypassQueue = false): Promise<boolean> {
    this.requireWriteConnection();
    try {
      const res = await this.proxyRequest('/api/database/delete', { dbId, collectionId, docId });
      return !!res.success;
    } catch (err: any) {
      if (err instanceof TypeError || /network|fetch|backend system down/i.test(err.message || '')) {
        throw this.connectionRequiredError();
      }
      throw err;
    }
  }

  /**
   * Batch pull all collections for active organization in a single HTTP request.
   */
  async pullAllCollections(orgId: string): Promise<any> {
    try {
      const res = await this.proxyRequest('/api/database/pull', { orgId });
      return res?.loadedState || null;
    } catch (err: any) {
      console.warn("Batch database pull failed, falling back to individual queries:", err.message || err);
      return null;
    }
  }

  /**
   * Lightweight version check to compare local cache timestamp with server latest timestamp.
   */
  async checkDatabaseVersion(orgId: string, localLastModified: number): Promise<{ isUpToDate: boolean; serverLastModified: number }> {
    try {
      const res = await this.proxyRequest('/api/database/version', { orgId, localLastModified });
      return {
        isUpToDate: !!res?.isUpToDate,
        serverLastModified: res?.serverLastModified || Date.now()
      };
    } catch (err: any) {
      return { isUpToDate: false, serverLastModified: Date.now() };
    }
  }

  getEmailDocId(email: string): string {
    const clean = email.trim().toLowerCase();
    const sanitized = clean.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = (hash << 5) - hash + clean.charCodeAt(i);
      hash |= 0;
    }
    const hashStr = Math.abs(hash).toString(36);
    return `usr_${sanitized}_${hashStr}`.slice(0, 36);
  }

  getOrgDocId(orgId: string): string {
    return `prf_${orgId}`.slice(0, 36);
  }

  /**
   * Load all global configuration documents from Appwrite Database.
   */
  async listGlobalConfigs(dbId: string): Promise<any[]> {
    await this.initSession();
    try {
      const response = await this.databases.listDocuments(
        dbId,
        'global_configs',
        [Query.limit(5000)]
      );
      return response.documents || [];
    } catch (err: any) {
      if (err.code === 404 || err.type === 'database_not_found' || err.type === 'collection_not_found') {
        return [];
      }
      console.error("Appwrite Database listGlobalConfigs failure:", err);
      throw err;
    }
  }

  /**
   * Delete a global configuration document by key from Appwrite Database via secure proxy.
   */
  async deleteGlobalConfig(dbId: string, key: string, bypassQueue = false): Promise<boolean> {
    this.requireWriteConnection();
    try {
      const res = await this.proxyRequest('/api/database/delete', {
        dbId,
        collectionId: 'global_configs',
        docId: key
      });
      return !!res.success;
    } catch (err: any) {
      if (err instanceof TypeError || /network|fetch|backend system down/i.test(err.message || '')) {
        throw this.connectionRequiredError();
      }
      throw err;
    }
  }

  async loadGlobalConfig(_dbId: string, key: string): Promise<any> {
    return await this.loadFleetDocument('fleet_db', 'global_configs', key);
  }

  /**
   * Save a global configuration document by key to Appwrite Database via secure proxy.
   */
  async saveGlobalConfig(dbId: string, key: string, payload: any, bypassQueue = false): Promise<string> {
    this.requireWriteConnection();
    try {
      const res = await this.proxyRequest('/api/database/save', {
        dbId,
        collectionId: 'global_configs',
        docId: key,
        orgId: payload.organizationId || 'global',
        dataObj: payload
      });
      return res.docId;
    } catch (err: any) {
      if (err instanceof TypeError || /network|fetch|backend system down/i.test(err.message || '')) {
        throw this.connectionRequiredError();
      }
      throw err;
    }
  }

  /**
   * Save documents to Appwrite Database if users configure Database Schema.
   * We will support raw document loading/saving for trucks, trips, expenses etc.,
   * to allow them to scale if they want to.
   */
  async createDatabaseDocument(dbId: string, collectionId: string, data: any, documentId: string = ID.unique()) {
    this.requireWriteConnection();
    await this.initSession();
    return await this.databases.createDocument(dbId, collectionId, documentId, data);
  }

  async listDatabaseDocuments(dbId: string, collectionId: string) {
    await this.initSession();
    return await this.databases.listDocuments(dbId, collectionId);
  }

  async updateDatabaseDocument(dbId: string, collectionId: string, documentId: string, data: any) {
    this.requireWriteConnection();
    await this.initSession();
    return await this.databases.updateDocument(dbId, collectionId, documentId, data);
  }

  async deleteDatabaseDocument(dbId: string, collectionId: string, documentId: string) {
    this.requireWriteConnection();
    await this.initSession();
    return await this.databases.deleteDocument(dbId, collectionId, documentId);
  }

  // Appwrite Teams wrappers

  /**
   * Create a new Appwrite Team (= new Organization).
   * Returns the team's $id which becomes the organizationId.
   */
  async createTeam(displayName: string, customId?: string): Promise<string> {
    if (!isAppwriteConfigured()) return '';
    try {
      this.requireWriteConnection();
      const team = await this.teams.create(customId || ID.unique(), displayName);
      return team.$id;
    } catch (err: any) {
      console.warn("Appwrite createTeam failed:", err);
      if (err && err.code === 401) {
        throw new Error("Unauthorized (401) when creating team. This usually means your browser is blocking Appwrite session cookies (third-party cookies). Please ensure third-party cookies are allowed for Appwrite (sgp.cloud.appwrite.io) in your browser settings, especially on localhost.");
      }
      throw err;
    }
  }

  /**
   * Get a single team by ID — used to validate an organizationId exists in Appwrite.
   * Returns the team object or null if not found.
   */
  async getTeam(teamId: string): Promise<any | null> {
    if (!isAppwriteConfigured()) return null;
    try {
      return await this.teams.get(teamId);
    } catch (err: any) {
      // 404 = team doesn't exist, any other error = network/auth issue
      if (err && (err.code === 404 || err.type === 'team_not_found')) {
        return null;
      }
      console.warn('Appwrite getTeam error:', err);
      return null;
    }
  }

  /**
   * Get all teams the currently logged-in user belongs to.
   * Used on login to derive the user's organizationId from Appwrite.
   */
  async getUserTeams(): Promise<any[]> {
    if (!isAppwriteConfigured()) return [];
    try {
      const timeoutPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 800));
      const fetchPromise = this.teams.list().then(res => res.teams || []).catch(() => []);
      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (err) {
      console.warn('Appwrite getUserTeams failed:', err);
      return [];
    }
  }

  /**
   * Get all memberships for a team (org). Only works if the caller is the team owner.
   * Used by admins to see pending/confirmed members.
   */
  async getTeamMemberships(teamId: string): Promise<any[]> {
    if (!isAppwriteConfigured()) return [];
    try {
      const timeoutPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2000));
      const fetchPromise = (async () => {
        const result = await this.teams.listMemberships(teamId);
        if (Array.isArray(result)) return result;
        if (result && Array.isArray(result.memberships)) return result.memberships;
        if (result && Array.isArray((result as any).members)) return (result as any).members;
        return [];
      })();
      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (err) {
      console.warn('Appwrite getTeamMemberships failed:', err);
      return [];
    }
  }

  /**
   * Invite a user to a team by email. The invited user gets a pending membership.
   * If the user doesn't have an Appwrite account yet, they'll be prompted to create one.
   */
  async inviteToTeam(teamId: string, email: string, name: string): Promise<any> {
    if (!isAppwriteConfigured()) return null;
    try {
      this.requireWriteConnection();
      const redirectUrl = getAppOrigin();
      return await this.teams.createMembership(teamId, ['member'], email, undefined, undefined, redirectUrl, name);
    } catch (err: any) {
      // Ignore duplicate membership errors gracefully
      if (err && (err.code === 409 || err.type === 'membership_already_exists')) {
        console.info('Appwrite: user already a member of this team.');
        return { alreadyMember: true };
      }
      console.warn("Appwrite inviteToTeam failed:", err);
      return null;
    }
  }

  async removeMembership(teamId: string, email: string): Promise<boolean> {
    if (!isAppwriteConfigured()) return false;
    try {
      this.requireWriteConnection();
      const list = await this.teams.listMemberships(teamId);
      const match = list.memberships.find(m => 
        (m.userEmail && m.userEmail.toLowerCase() === email.toLowerCase()) ||
        ((m as any).email && (m as any).email.toLowerCase() === email.toLowerCase())
      );
      if (match) {
        await this.teams.deleteMembership(teamId, match.$id);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("Appwrite removeMembership failed:", err);
      throw err;
    }
  }

  async leaveTeam(teamId: string): Promise<boolean> {
    if (!isAppwriteConfigured()) return false;
    try {
      this.requireWriteConnection();
      const user = await this.account.get();
      if (!user) return false;
      const list = await this.teams.listMemberships(teamId);
      const match = list.memberships.find(m => 
        m.userId === user.$id || 
        (m.userEmail && m.userEmail.toLowerCase() === user.email.toLowerCase()) ||
        ((m as any).email && (m as any).email.toLowerCase() === user.email.toLowerCase())
      );
      if (match) {
        await this.teams.deleteMembership(teamId, match.$id);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`Appwrite leaveTeam for ${teamId} failed:`, err);
      return false;
    }
  }

  /**
   * General paginated query method for Audit Logs.
   */
  async queryAuditLogs(
    dbId: string,
    orgId: string,
    filters: { category?: string; action?: string; search?: string; startDate?: string; endDate?: string },
    page: number,
    limit: number
  ): Promise<{ documents: any[]; total: number; fallback?: boolean }> {
    await this.initSession();
    try {
      const baseQueries = [];
      if (orgId !== 'ALL') {
        baseQueries.push(Query.equal('organizationId', orgId));
      }
      if (filters.category) {
        baseQueries.push(Query.equal('category', filters.category));
      }
      if (filters.action) {
        baseQueries.push(Query.equal('action', filters.action));
      }
      if (filters.search) {
        baseQueries.push(Query.search('details', filters.search));
      }
      if (filters.startDate) {
        baseQueries.push(Query.greaterThanEqual('timestamp', filters.startDate));
      }
      if (filters.endDate) {
        baseQueries.push(Query.lessThanEqual('timestamp', filters.endDate + ' 23:59:59'));
      }

      baseQueries.push(Query.limit(limit));
      baseQueries.push(Query.offset((page - 1) * limit));
      baseQueries.push(Query.orderDesc('timestamp'));

      const response = await this.databases.listDocuments(dbId, 'audit_logs', baseQueries);
      return {
        documents: response.documents || [],
        total: response.total || 0,
        fallback: false
      };
    } catch (err) {
      const response = await this.databases.listDocuments(dbId, 'audit_logs', [
        ...(orgId !== 'ALL' ? [Query.equal('organizationId', orgId)] : []),
        Query.orderDesc('timestamp'),
        Query.limit(500)
      ]);
      let filtered = response.documents || [];
      if (filters.category) {
        filtered = filtered.filter(l => l.category === filters.category);
      }
      if (filters.action) {
        filtered = filtered.filter(l => l.action === filters.action);
      }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(l => (l.details || '').toLowerCase().includes(s) || (l.reference || '').toLowerCase().includes(s));
      }
      if (filters.startDate) {
        filtered = filtered.filter(l => (l.timestamp || '') >= filters.startDate!);
      }
      if (filters.endDate) {
        filtered = filtered.filter(l => (l.timestamp || '') <= filters.endDate! + ' 23:59:59');
      }

      filtered.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      const total = filtered.length;
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      return { documents: paginated, total, fallback: true };
    }
  }

  async queryTrips(
    dbId: string,
    orgId: string,
    filters: { search?: string; truckNo?: string; status?: string | string[]; startDate?: string; endDate?: string },
    page: number,
    limit: number,
    sortField: string = 'startDate',
    sortDirection: 'asc' | 'desc' = 'desc'
  ): Promise<{ documents: any[]; total: number }> {
    await this.initSession();
    try {
      const queries = [];
      if (orgId !== 'org_backend') {
        queries.push(Query.equal('organizationId', orgId));
      }
      if (filters.truckNo) {
        queries.push(Query.equal('truckNo', filters.truckNo));
      }
      if (filters.status) {
        let statusQueryVal = filters.status;
        const statusArray = Array.isArray(statusQueryVal) ? statusQueryVal : [statusQueryVal];
        if (statusArray.includes('Deleted')) {
          throw new Error('Attribute/Index schema query mismatch (Force fallback for Deleted status)');
        }
        let finalStatuses = [...statusArray];
        if (finalStatuses.includes('Settled')) {
          finalStatuses = [...finalStatuses, 'Paid', 'Pald'];
        }
        queries.push(Query.equal('status', finalStatuses));
      }
      if (filters.search) {
        queries.push(Query.search('tripNo', filters.search));
      }
      if (filters.startDate) {
        queries.push(Query.greaterThanEqual('startDate', filters.startDate));
      }
      if (filters.endDate) {
        queries.push(Query.lessThanEqual('startDate', filters.endDate));
      }

      if (sortDirection === 'asc') {
        queries.push(Query.orderAsc(sortField));
      } else {
        queries.push(Query.orderDesc(sortField));
      }

      queries.push(Query.limit(limit));
      queries.push(Query.offset((page - 1) * limit));

      const response = await this.databases.listDocuments(dbId, 'trips', queries);
      const docs = response.documents || [];

      let subDocs: any[] = [];
      if (docs.length > 0) {
        try {
          const tripIds = docs.map(d => d.$id);
          const subResponse = await this.databases.listDocuments(dbId, 'sub_trips', [
            Query.equal('tripId', tripIds),
            Query.limit(500)
          ]);
          subDocs = subResponse.documents || [];
        } catch (subErr) {
          console.warn("Failed to load sub-trips for queryTrips stitching, returning trips without sub-trips:", subErr);
        }
      }

      const subTripsByTripId = subDocs.reduce((acc, doc) => {
        const tId = doc.tripId;
        if (!acc[tId]) acc[tId] = [];
        let subTripData = { ...doc };
        if (doc.data) {
          try {
            subTripData = { ...subTripData, ...JSON.parse(doc.data) };
          } catch (e) {
            console.warn("Failed to parse data for sub-trip:", doc.$id, e);
          }
        }
        subTripData.id = doc.$id || doc.id || subTripData.id;
        acc[tId].push(subTripData);
        return acc;
      }, {} as Record<string, any[]>);

      const reconstructedDocs = docs.map(doc => {
        let tripRecord = { ...doc };
        if (doc.data) {
          try {
            const parsed = JSON.parse(doc.data);
            tripRecord = { ...tripRecord, ...parsed };
          } catch (e) {
            console.warn("Failed to parse data for trip:", doc.$id, e);
          }
        }
        if (tripRecord.status === 'Pald' || tripRecord.status === 'Paid') {
          tripRecord.status = 'Settled';
        }
        tripRecord.subTrips = subTripsByTripId[doc.$id] || tripRecord.subTrips || [];
        return this.normalizeTrip(tripRecord);
      });

      return {
        documents: reconstructedDocs,
        total: response.total || 0
      };
    } catch (err: any) {
      const errMsg = (err.message || '').toLowerCase();
      const isSchemaError = err.code === 400 ||
        errMsg.includes('attribute') ||
        errMsg.includes('schema') ||
        errMsg.includes('not found') ||
        errMsg.includes('index');

      if (isSchemaError) {
        console.warn("Appwrite queryTrips failed due to schema/attribute mismatch. Falling back to client-side filtering...");
        // Fetch all documents for this organization
        const allDocs = await this.listFleetDocuments(dbId, 'trips', orgId);

        // Parse and filter client-side
        let parsedList = allDocs.map(doc => {
          let item = { ...doc };
          if (doc.data) {
            try {
              const parsed = JSON.parse(doc.data);
              item = { ...item, ...parsed };
            } catch (e) {
              console.warn("Failed to parse data for fallback queryTrips:", doc.$id, e);
            }
          }
          return this.normalizeTrip(item);
        });

        // Apply filters
        if (filters.truckNo) {
          parsedList = parsedList.filter(t => t.truckNo === filters.truckNo);
        }
        if (filters.status) {
          if (Array.isArray(filters.status)) {
            parsedList = parsedList.filter(t => filters.status!.includes(t.status));
          } else {
            parsedList = parsedList.filter(t => t.status === filters.status);
          }
        }
        if (filters.search) {
          const s = filters.search.toLowerCase();
          parsedList = parsedList.filter(t => (t.tripNo || '').toLowerCase().includes(s));
        }
        if (filters.startDate) {
          parsedList = parsedList.filter(t => (t.startDate || '') >= filters.startDate!);
        }
        if (filters.endDate) {
          parsedList = parsedList.filter(t => (t.startDate || '') <= filters.endDate!);
        }

        // Apply sorting
        parsedList.sort((a, b) => {
          let aVal = a[sortField] || '';
          let bVal = b[sortField] || '';
          if (typeof aVal === 'string') aVal = aVal.toLowerCase();
          if (typeof bVal === 'string') bVal = bVal.toLowerCase();
          if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        });

        const total = parsedList.length;
        const startIndex = (page - 1) * limit;
        const paginatedList = parsedList.slice(startIndex, startIndex + limit);

        // Map back to Appwrite document format
        const documents = paginatedList.map(item => {
          const { id, $id, $collectionId, $databaseId, $createdAt, $updatedAt, $permissions, ...rest } = item;
          return {
            $id: id || $id,
            $collectionId,
            $databaseId,
            $createdAt,
            $updatedAt,
            $permissions,
            organizationId: item.organizationId,
            tripNo: item.tripNo || '',
            truckNo: item.truckNo || '',
            startDate: item.startDate || '',
            endDate: item.endDate || '',
            driverName: item.driverName || '',
            status: (item.status === 'Pald' || item.status === 'Paid') ? 'Settled' : (item.status || 'Pending'),
            notes: item.notes || '',
            data: item.data || JSON.stringify(rest),
            ...rest
          };
        });

        return {
          documents,
          total
        };
      }

      console.error("queryTrips failure:", err);
      throw err;
    }
    if (filters.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter(t => (t.tripNo || '').toLowerCase().includes(s));
    }
    if (filters.startDate) {
      filtered = filtered.filter(t => (t.startDate || '') >= filters.startDate!);
    }
    if (filters.endDate) {
      filtered = filtered.filter(t => (t.startDate || '') <= filters.endDate!);
    }

    filtered.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return { documents: paginated, total };
  }

  async queryExpenses(
    dbId: string,
    orgId: string,
    filters: { search?: string; truckNo?: string; expenseType?: string; startDate?: string; endDate?: string },
    page: number,
    limit: number
  ): Promise<{ documents: any[]; total: number }> {
    const allDocs = await this.listFleetDocuments(dbId, 'expenses', orgId);
    let filtered = allDocs;

    if (filters.truckNo) {
      filtered = filtered.filter(e => e.truckNo === filters.truckNo);
    }
    if (filters.expenseType) {
      filtered = filtered.filter(e => e.expenseType === filters.expenseType);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter(e => (e.shopName || '').toLowerCase().includes(s));
    }
    if (filters.startDate) {
      filtered = filtered.filter(e => (e.date || '') >= filters.startDate!);
    }
    if (filters.endDate) {
      filtered = filtered.filter(e => (e.date || '') <= filters.endDate!);
    }

    filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return { documents: paginated, total };
  }

  async queryTyres(
    dbId: string,
    orgId: string,
    filters: { search?: string; status?: string },
    page: number,
    limit: number
  ): Promise<{ documents: any[]; total: number }> {
    await this.initSession();
    try {
      const queries = [];
      if (orgId !== 'ALL') {
        queries.push(Query.equal('organizationId', orgId));
      }
      if (filters.status) {
        queries.push(Query.equal('status', filters.status));
      }
      if (filters.search) {
        queries.push(Query.search('tyreNo', filters.search));
      }

      queries.push(Query.limit(limit));
      queries.push(Query.offset((page - 1) * limit));

      const response = await this.databases.listDocuments(dbId, 'tyres', queries);
      return {
        documents: (response.documents || []).map(doc => this.reconstructRecord(doc)),
        total: response.total || 0
      };
    } catch (err: any) {
      console.warn("Appwrite queryTyres fallback to client-side filtering:", err);
      const allDocs = await this.listFleetDocuments(dbId, 'tyres', orgId);

      let parsedList = allDocs.map(doc => this.reconstructRecord(doc) || doc);

      if (filters.status) {
        parsedList = parsedList.filter(t => t.status === filters.status);
      }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        parsedList = parsedList.filter(t => (t.tyreNo || '').toLowerCase().includes(s));
      }

      const total = parsedList.length;
      const startIndex = (page - 1) * limit;
      const paginatedList = parsedList.slice(startIndex, startIndex + limit);

      return {
        documents: paginatedList,
        total
      };
    }
  }

  async fetchMonthlyTripsAndExpenses(
    dbId: string,
    orgId: string,
    year: string,
    month: string
  ): Promise<{ trips: any[]; expenses: any[] }> {
    const allTrips = await this.listFleetDocuments(dbId, 'trips', orgId);
    const allExpenses = await this.listFleetDocuments(dbId, 'expenses', orgId);

    const fetchAllTime = year === 'All Time';
    const monthStr = `${year}-${month}`;

    const filteredTrips = allTrips.filter(doc => {
      if (fetchAllTime) return true;
      const startDate = doc.startDate;
      if (!startDate) return false;
      return startDate >= `${monthStr}-01` && startDate <= `${monthStr}-31`;
    });

    const filteredExpenses = allExpenses.filter(doc => {
      if (fetchAllTime) return true;
      const date = doc.date;
      if (!date) return false;
      return date >= `${monthStr}-01` && date <= `${monthStr}-31`;
    });

    return { trips: filteredTrips, expenses: filteredExpenses };
  }

  // Organization & Teams
  async createTeam(displayName: string, customId?: string): Promise<string> {
    const orgId = customId || `org_${Date.now()}`;
    const orgProfile = {
      organizationId: orgId,
      organizationName: displayName,
      ownerEmail: this.cachedUser?.email || '',
      ownerName: this.cachedUser?.name || '',
      status: 'Active',
      truckRequests: [],
    };
    await this.saveGlobalConfig('fleet_db', `prf_${orgId}`, orgProfile);
    return orgId;
  }

  async getTeam(teamId: string): Promise<any | null> {
    const profile = await this.loadGlobalConfig('fleet_db', `prf_${teamId}`);
    if (!profile) return null;
    return {
      $id: teamId,
      id: teamId,
      name: profile.organizationName || teamId,
      ...profile,
    };
  }

  async getUserTeams(): Promise<any[]> {
    const configs = await this.listGlobalConfigs('fleet_db');
    const orgs: any[] = [];
    for (const c of configs) {
      if (c.$id?.startsWith('prf_') || c.key?.startsWith('prf_')) {
        orgs.push({
          $id: c.organizationId || c.id?.replace('prf_', ''),
          name: c.organizationName || 'Organization',
          ...c,
        });
      }
    }
    return orgs;
  }

  async getTeamMemberships(teamId: string): Promise<any[]> {
    const configs = await this.listGlobalConfigs('fleet_db');
    const members: any[] = [];
    for (const c of configs) {
      if ((c.$id?.startsWith('usr_') || c.key?.startsWith('usr_')) && c.organizationId === teamId) {
        members.push({
          $id: c.$id || c.key,
          userId: c.id || c.email,
          userEmail: c.email,
          userName: c.name,
          roles: [c.role || 'member'],
        });
      }
    }
    return members;
  }

  async inviteToTeam(teamId: string, email: string, name: string): Promise<any> {
    const userDocId = this.getEmailDocId(email);
    const memberConfig = {
      id: userDocId,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role: 'Staff',
      organizationId: teamId,
      isEmailVerified: true,
      permissions: ['read'],
    };
    await this.saveGlobalConfig('fleet_db', userDocId, memberConfig);
    return { success: true };
  }

  async removeMembership(_teamId: string, email: string): Promise<boolean> {
    const userDocId = this.getEmailDocId(email);
    return await this.deleteGlobalConfig('fleet_db', userDocId);
  }

  async leaveTeam(teamId: string): Promise<boolean> {
    if (this.cachedUser?.email) {
      const userDocId = this.getEmailDocId(this.cachedUser.email);
      const doc = await this.loadGlobalConfig('fleet_db', userDocId);
      if (doc) {
        doc.organizationId = 'org_default';
        await this.saveGlobalConfig('fleet_db', userDocId, doc);
      }
      return true;
    }
    return false;
  }


  private getSyncQueue(): QueueItem[] {
    try {
      const stored = localStorage.getItem('ttt_offline_sync_queue');
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  }

  private saveSyncQueue(queue: QueueItem[]) {
    localStorage.setItem('ttt_offline_sync_queue', JSON.stringify(queue));
  }

  addToSyncQueue(item: Omit<QueueItem, 'id' | 'timestamp'>) {
    // Offline mutation queuing is deliberately disabled: this app is view-only
    // while disconnected. Keep this method only for compatibility with callers.
    throw this.connectionRequiredError();
  }

  async flushSyncQueue(showNotification?: (msg: string) => void): Promise<void> {
    const queue = this.getSyncQueue();
    if (queue.length > 0) {
      localStorage.removeItem('ttt_offline_sync_queue');
      console.warn(`Discarded ${queue.length} legacy offline write(s); offline mode is view-only.`);
    }
  }

}

export const appwrite = new CloudflareClientService();
