import { Client, Account as AppwriteAccount, Storage, Databases, ID, Teams, Query, Permission, Role, Realtime } from 'appwrite';

import { projectID, endpoint, cleanEnvVar, isAppwriteConfigured, getAppOrigin } from './appwriteConfig';
export { isAppwriteConfigured, getAppOrigin };

export function compressImageIfNeeded(file: File): Promise<File> {
  return new Promise((resolve) => {
    // Only compress images
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

        // Resize image if it exceeds 1600px in any dimension
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

        // Convert to JPEG with 0.75 quality for high compression and good readability
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            // Construct a new file with jpeg extension
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
        // Try getting current logged-in user
        const user = await this.account.get();
        return user;
      } catch (err: any) {
        // No session exists, return null. Do not create anonymous sessions to avoid database pollution and session conflicts.
        return null;
      }
    })();

    return this.sessionPromise;
  }

  async login(email: string, password: string) {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    this.sessionPromise = null; // Clear cached promise
    try {
      await this.account.deleteSession('current');
    } catch (e) {
      // Ignore if no session is currently active
    }
    await this.account.createEmailPasswordSession(email, password);

    this.sessionPromise = this.account.get();
    return await this.sessionPromise;
  }

  async register(email: string, password: string, name: string) {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    const randomId = 'usr_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 10);
    return await this.account.create(randomId.substring(0, 36), email, password, name);
  }

  async logout() {
    if (!isAppwriteConfigured()) {
      return;
    }
    try {
      await this.account.deleteSession('current');
    } catch (e) {
      console.warn("Appwrite logout deleteSession failed:", e);
    }
    this.sessionPromise = null;
  }

  async getCurrentUser() {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    try {
      const user = await this.account.get();
      return user;
    } catch (err) {
      return null;
    }
  }

  getBucketId() {
    return cleanEnvVar(import.meta.env.VITE_APPWRITE_BUCKET_ID || '6a1713930029ff1ca4d3');
  }

  /** Returns the dedicated support-ticket attachment bucket, or falls back to main bucket */
  getTicketsBucketId() {
    const ticketBucket = cleanEnvVar(import.meta.env.VITE_APPWRITE_TICKETS_BUCKET_ID || '');
    return ticketBucket || this.getBucketId();
  }

  async uploadFile(file: File, customName?: string, organizationId?: string): Promise<string> {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    await this.initSession();
    try {
      // Compress image files before uploading
      let fileToUpload = await compressImageIfNeeded(file);

      if (customName) {
        const lastDot = fileToUpload.name.lastIndexOf('.');
        const ext = lastDot !== -1 ? fileToUpload.name.substring(lastDot) : '';
        fileToUpload = new File([fileToUpload], `${customName}${ext}`, { type: fileToUpload.type });
      }

      const permissions: string[] = [];
      if (organizationId && organizationId !== 'org_backend') {
        // Add read, update, delete permissions for the organization's members
        permissions.push(
          Permission.read(Role.team(organizationId)),
          Permission.update(Role.team(organizationId)),
          Permission.delete(Role.team(organizationId))
        );
      }

      const response = await this.storage.createFile(
        this.getBucketId(),
        ID.unique(),
        fileToUpload,
        permissions.length > 0 ? permissions : undefined
      );
      return response.$id;
    } catch (err: any) {
      console.error("Appwrite uploadFile failed:", err);
      throw err;
    }
  }

  /** Upload a file to the dedicated support_ticket bucket */
  async uploadTicketFile(file: File, customName?: string): Promise<string> {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
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
      console.error("Appwrite uploadTicketFile failed:", err);
      throw err;
    }
  }

  getFileView(fileId: string): string {
    if (!isAppwriteConfigured() || !fileId) return '';
    try {
      const url = this.storage.getFileView(this.getBucketId(), fileId);
      return url.toString();
    } catch (err) {
      console.warn("Appwrite getFileView failed:", err);
      return '';
    }
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
    if (!isAppwriteConfigured() || !fileId) return '';
    await this.initSession();
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
    } catch (err) {
      console.warn("Appwrite getSecureFileUrl failed, falling back to direct url:", err);
      return this.getFileView(fileId);
    }
  }

  getFileDownload(fileId: string): string {
    if (!isAppwriteConfigured() || !fileId) return '';
    try {
      const url = this.storage.getFileDownload(this.getBucketId(), fileId);
      return url.toString();
    } catch (err) {
      console.warn("Appwrite getFileDownload failed:", err);
      return '';
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    if (!isAppwriteConfigured() || !fileId) return false;
    await this.initSession();
    try {
      await this.storage.deleteFile(this.getBucketId(), fileId);
      return true;
    } catch (err) {
      console.warn("Appwrite deleteFile failed:", err);
      return false;
    }
  }

  async updateName(newName: string) {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    return await this.account.updateName(newName);
  }

  async updatePassword(newPassword: string, oldPassword: string) {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    return await this.account.updatePassword(newPassword, oldPassword);
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

      // If we are listing trips, also list sub_trips and stitch them together
      if (collectionId === 'trips') {
        let subDocs: any[] = [];
        try {
          subDocs = await this.listFleetDocuments(dbId, 'sub_trips', orgId);
        } catch (subErr) {
          console.warn("Failed to load sub-trips for stitching, returning trips without sub-trips:", subErr);
        }

        const subTripsByTripId: Record<string, any[]> = {};
        for (const subDoc of subDocs) {
          const subTripRecord = subDoc;
          const tripId = subDoc.tripId;
          if (tripId) {
            if (!subTripsByTripId[tripId]) {
              subTripsByTripId[tripId] = [];
            }
            subTripsByTripId[tripId].push(subTripRecord);
          }
        }

        return docs.map(doc => {
          const tripRecord = this.reconstructRecord(doc);
          tripRecord.subTrips = subTripsByTripId[doc.$id] || tripRecord.subTrips || [];
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

  private async proxyRequest(path: string, body: any): Promise<any> {
    if (!this.isRealtimeConnected()) {
      throw new Error('Backend system down, please try again later. Save only when online.');
    }
    await this.initSession();
    let jwtToken = '';
    try {
      const jwtResult = await this.account.createJWT();
      jwtToken = jwtResult.jwt;
    } catch (err: any) {
      console.warn("Could not generate session JWT for database proxy request:", err);
      throw new Error("Session expired or authentication failed. Please re-login.");
    }

    const serverUrl = (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:' || (window as any).Capacitor)
      ? 'https://api.lorryguru.in/truck-backend'
      : (import.meta.env.DEV ? '' : 'https://api.lorryguru.in/truck-backend');

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
      throw new Error(data.error || `Proxy request to ${path} failed with status ${response.status}`);
    }
    return data;
  }

  /**
   * Save a single document (upsert) to Appwrite Database via secure proxy.
   */
  async saveFleetDocument(dbId: string, collectionId: string, docId: string, orgId: string, dataObj: any, bypassQueue = false): Promise<string> {
    if (!bypassQueue && !this.isRealtimeConnected()) {
      this.addToSyncQueue({ type: 'save', dbId, collectionId, docId, orgId, dataObj });
      return docId;
    }
    try {
      const res = await this.proxyRequest('/api/database/save', { dbId, collectionId, docId, orgId, dataObj });
      return res.docId;
    } catch (err: any) {
      if (err.message.includes('Session expired') || err.message.includes('authentication failed')) {
        throw err;
      }
      if (!bypassQueue) {
        this.addToSyncQueue({ type: 'save', dbId, collectionId, docId, orgId, dataObj });
        return docId;
      }
      throw err;
    }
  }

  /**
   * Delete a single document from Appwrite Database via secure proxy.
   */
  async deleteFleetDocument(dbId: string, collectionId: string, docId: string, bypassQueue = false): Promise<boolean> {
    if (!bypassQueue && !this.isRealtimeConnected()) {
      this.addToSyncQueue({ type: 'delete', dbId, collectionId, docId });
      return true;
    }
    try {
      const res = await this.proxyRequest('/api/database/delete', { dbId, collectionId, docId });
      return !!res.success;
    } catch (err: any) {
      if (err.message.includes('Session expired') || err.message.includes('authentication failed')) {
        throw err;
      }
      if (!bypassQueue) {
        this.addToSyncQueue({ type: 'delete', dbId, collectionId, docId });
        return true;
      }
      throw err;
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
    if (!bypassQueue && !this.isRealtimeConnected()) {
      this.addToSyncQueue({ type: 'delete_global', dbId, docId: key });
      return true;
    }
    try {
      const res = await this.proxyRequest('/api/database/delete', {
        dbId,
        collectionId: 'global_configs',
        docId: key
      });
      return !!res.success;
    } catch (err: any) {
      if (err.message.includes('Session expired') || err.message.includes('authentication failed')) {
        throw err;
      }
      if (!bypassQueue) {
        this.addToSyncQueue({ type: 'delete_global', dbId, docId: key });
        return true;
      }
      throw err;
    }
  }

  /**
   * Load a global configuration document by key from Appwrite Database.
   */
  async loadGlobalConfig(dbId: string, key: string): Promise<any> {
    await this.initSession();
    try {
      const response = await this.databases.getDocument(dbId, 'global_configs', key);
      if (response && response.data) {
        return JSON.parse(response.data);
      }
      return null;
    } catch (err: any) {
      if (err.code === 404 || err.type === 'document_not_found') {
        return null;
      }
      console.error(`Appwrite Database loadGlobalConfig failure for key ${key}:`, err);
      throw err;
    }
  }

  /**
   * Save a global configuration document by key to Appwrite Database via secure proxy.
   */
  async saveGlobalConfig(dbId: string, key: string, payload: any, bypassQueue = false): Promise<string> {
    if (!bypassQueue && !this.isRealtimeConnected()) {
      this.addToSyncQueue({ type: 'save_global', dbId, docId: key, dataObj: payload });
      return key;
    }
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
      if (err.message.includes('Session expired') || err.message.includes('authentication failed')) {
        throw err;
      }
      if (!bypassQueue) {
        this.addToSyncQueue({ type: 'save_global', dbId, docId: key, dataObj: payload });
        return key;
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
    await this.initSession();
    return await this.databases.createDocument(dbId, collectionId, documentId, data);
  }

  async listDatabaseDocuments(dbId: string, collectionId: string) {
    await this.initSession();
    return await this.databases.listDocuments(dbId, collectionId);
  }

  async updateDatabaseDocument(dbId: string, collectionId: string, documentId: string, data: any) {
    await this.initSession();
    return await this.databases.updateDocument(dbId, collectionId, documentId, data);
  }

  async deleteDatabaseDocument(dbId: string, collectionId: string, documentId: string) {
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
      const result = await this.teams.list();
      return result.teams || [];
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
      const result = await this.teams.listMemberships(teamId);
      console.log('Appwrite getTeamMemberships raw response:', result);
      if (Array.isArray(result)) return result;
      if (result && Array.isArray(result.memberships)) return result.memberships;
      if (result && Array.isArray((result as any).members)) return (result as any).members;
      return [];
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
      if (filters.search) {
        const baseQueries = [];
        if (orgId !== 'ALL') {
          baseQueries.push(Query.equal('organizationId', orgId));
        }
        const response = await this.databases.listDocuments(dbId, 'audit_logs', [
          ...baseQueries,
          Query.orderDesc('timestamp'),
          Query.limit(300)
        ]);
        return {
          documents: response.documents || [],
          total: response.total || 0,
          fallback: true
        };
      }

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

      const sortedQueries = [
        ...baseQueries,
        Query.orderDesc('timestamp'),
        Query.limit(limit),
        Query.offset((page - 1) * limit)
      ];

      try {
        const response = await this.databases.listDocuments(dbId, 'audit_logs', sortedQueries);
        return {
          documents: response.documents || [],
          total: response.total || 0,
          fallback: false
        };
      } catch (err: any) {
        const errMsg = (err.message || '').toLowerCase();
        if (err.code === 400 || errMsg.includes('index') || errMsg.includes('composite')) {
          console.warn("Appwrite composite index missing for audit logs. Retrying with client-side fallback (fetching last 300 records)...");
          const fallbackQueries = [];
          if (orgId !== 'ALL') {
            fallbackQueries.push(Query.equal('organizationId', orgId));
          }
          fallbackQueries.push(Query.limit(300));
          const response = await this.databases.listDocuments(dbId, 'audit_logs', fallbackQueries);
          return {
            documents: response.documents || [],
            total: response.total || 0,
            fallback: true
          };
        }
        throw err;
      }
    } catch (err: any) {
      console.error("queryAuditLogs failure:", err);
      throw err;
    }
  }

  /**
   * General paginated query method for Trips.
   */
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
  }

  /**
   * General paginated query method for Expenses.
   */
  async queryExpenses(
    dbId: string,
    orgId: string,
    filters: { search?: string; truckNo?: string; expenseType?: string; startDate?: string; endDate?: string },
    page: number,
    limit: number
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
      if (filters.expenseType) {
        queries.push(Query.equal('expenseType', filters.expenseType));
      }
      if (filters.search) {
        queries.push(Query.search('shopName', filters.search));
      }
      if (filters.startDate) {
        queries.push(Query.greaterThanEqual('date', filters.startDate));
      }
      if (filters.endDate) {
        queries.push(Query.lessThanEqual('date', filters.endDate));
      }

      queries.push(Query.orderDesc('date'));
      queries.push(Query.limit(limit));
      queries.push(Query.offset((page - 1) * limit));

      const response = await this.databases.listDocuments(dbId, 'expenses', queries);
      return {
        documents: response.documents || [],
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
        console.warn("Appwrite queryExpenses failed due to schema/attribute mismatch. Falling back to client-side filtering...");
        const allDocs = await this.listFleetDocuments(dbId, 'expenses', orgId);

        let parsedList = allDocs.map(doc => {
          let item = { ...doc };
          if (doc.data) {
            try {
              const parsed = JSON.parse(doc.data);
              item = { ...item, ...parsed };
            } catch (e) {
              console.warn("Failed to parse data for fallback queryExpenses:", doc.$id, e);
            }
          }
          return item;
        });

        if (filters.truckNo) {
          parsedList = parsedList.filter(e => e.truckNo === filters.truckNo);
        }
        if (filters.expenseType) {
          parsedList = parsedList.filter(e => e.expenseType === filters.expenseType);
        }
        if (filters.search) {
          const s = filters.search.toLowerCase();
          parsedList = parsedList.filter(e => (e.shopName || '').toLowerCase().includes(s));
        }
        if (filters.startDate) {
          parsedList = parsedList.filter(e => (e.date || '') >= filters.startDate!);
        }
        if (filters.endDate) {
          parsedList = parsedList.filter(e => (e.date || '') <= filters.endDate!);
        }

        parsedList.sort((a, b) => {
          const aVal = a.date || '';
          const bVal = b.date || '';
          if (aVal < bVal) return 1;
          if (aVal > bVal) return -1;
          return 0;
        });

        const total = parsedList.length;
        const startIndex = (page - 1) * limit;
        const paginatedList = parsedList.slice(startIndex, startIndex + limit);

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
            truckNo: item.truckNo || '',
            expenseType: item.expenseType || '',
            shopName: item.shopName || '',
            amount: Number(item.amount) || 0,
            paymentMode: item.paymentMode || '',
            date: item.date || '',
            status: item.status || 'Pending',
            accountType: item.accountType || 'Account',
            driverName: item.driverName || '',
            data: item.data || JSON.stringify(rest),
            ...rest
          };
        });

        return {
          documents,
          total
        };
      }

      console.error("queryExpenses failure:", err);
      throw err;
    }
  }

  /**
   * General paginated query method for Tyres.
   */
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
      if (orgId !== 'org_backend') {
        queries.push(Query.equal('organizationId', orgId));
      }
      if (filters.status) {
        queries.push(Query.equal('status', filters.status));
      }
      if (filters.search) {
        queries.push(Query.equal('tyreNo', filters.search.toUpperCase()));
      }

      queries.push(Query.limit(limit));
      queries.push(Query.offset((page - 1) * limit));

      const response = await this.databases.listDocuments(dbId, 'tyres', queries);
      return {
        documents: response.documents.map(doc => this.reconstructRecord(doc)) || [],
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
        console.warn("Appwrite queryTyres failed due to schema/attribute mismatch. Falling back to client-side filtering...");
        const allDocs = await this.listFleetDocuments(dbId, 'tyres', orgId);

        let parsedList = allDocs.map(doc => {
          let item = { ...doc };
          if (doc.data) {
            try {
              const parsed = JSON.parse(doc.data);
              item = { ...item, ...parsed };
            } catch (e) {
              console.warn("Failed to parse data for fallback queryTyres:", doc.$id, e);
            }
          }
          return item;
        });

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
            tyreNo: item.tyreNo || '',
            manufacturer: item.manufacturer || '',
            status: item.status || 'Available',
            currentTruckNo: item.currentTruckNo || '',
            purchaseDate: item.purchaseDate || '',
            movementHistory: item.movementHistory || [],
            data: item.data || JSON.stringify(rest),
            ...rest
          };
        });

        return {
          documents,
          total
        };
      }

      console.error("queryTyres failure:", err);
      throw err;
    }
  }

  /**
   * Fetches monthly slice of Trips and Expenses for Dashboard/Monthly Reports aggregates.
   */
  async fetchMonthlyTripsAndExpenses(
    dbId: string,
    orgId: string,
    year: string,
    month: string
  ): Promise<{ trips: any[]; expenses: any[] }> {
    await this.initSession();
    try {
      const trips = [];
      const expenses = [];
      const fetchAllTime = year === 'All Time';

      // 1. Fetch Trips
      let hasMore = true;
      let offset = 0;
      const limit = 100;

      while (hasMore) {
        const queries = [];
        if (orgId !== 'org_backend') {
          queries.push(Query.equal('organizationId', orgId));
        }
        if (!fetchAllTime) {
          const monthStr = `${year}-${month}`;
          queries.push(Query.greaterThanEqual('startDate', `${monthStr}-01`));
          queries.push(Query.lessThanEqual('startDate', `${monthStr}-31`));
        }
        queries.push(Query.limit(limit));
        queries.push(Query.offset(offset));

        const res = await this.databases.listDocuments(dbId, 'trips', queries);
        trips.push(...(res.documents || []));
        if ((res.documents || []).length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }

      // 2. Fetch Expenses
      hasMore = true;
      offset = 0;

      while (hasMore) {
        const queries = [];
        if (orgId !== 'org_backend') {
          queries.push(Query.equal('organizationId', orgId));
        }
        if (!fetchAllTime) {
          const monthStr = `${year}-${month}`;
          queries.push(Query.greaterThanEqual('date', `${monthStr}-01`));
          queries.push(Query.lessThanEqual('date', `${monthStr}-31`));
        }
        queries.push(Query.limit(limit));
        queries.push(Query.offset(offset));

        const res = await this.databases.listDocuments(dbId, 'expenses', queries);
        expenses.push(...(res.documents || []));
        if ((res.documents || []).length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }

      return { trips, expenses };
    } catch (err: any) {
      const errMsg = (err.message || '').toLowerCase();
      const isSchemaError = err.code === 400 ||
        errMsg.includes('attribute') ||
        errMsg.includes('schema') ||
        errMsg.includes('not found') ||
        errMsg.includes('index');

      if (isSchemaError) {
        console.warn("fetchMonthlyTripsAndExpenses failed due to schema/attribute/index mismatch. Falling back to client-side filtering...");
        // 1. Fetch all Trips for the organization
        const allTripsDocs = await this.listFleetDocuments(dbId, 'trips', orgId);

        // 2. Fetch all Expenses for the organization
        const allExpensesDocs = await this.listFleetDocuments(dbId, 'expenses', orgId);

        const fetchAllTime = year === 'All Time';
        const monthStr = `${year}-${month}`;

        const filteredTrips = allTripsDocs.filter(doc => {
          if (fetchAllTime) return true;
          let startDate = doc.startDate;
          if (!startDate && doc.data) {
            try {
              const parsed = JSON.parse(doc.data);
              startDate = parsed.startDate;
            } catch { }
          }
          if (!startDate) return false;
          return startDate >= `${monthStr}-01` && startDate <= `${monthStr}-31`;
        });

        const filteredExpenses = allExpensesDocs.filter(doc => {
          if (fetchAllTime) return true;
          let date = doc.date;
          if (!date && doc.data) {
            try {
              const parsed = JSON.parse(doc.data);
              date = parsed.date;
            } catch { }
          }
          if (!date) return false;
          return date >= `${monthStr}-01` && date <= `${monthStr}-31`;
        });

        return { trips: filteredTrips, expenses: filteredExpenses };
      }

      console.error("fetchMonthlyTripsAndExpenses failure:", err);
      throw err;
    }
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
    const queue = this.getSyncQueue();
    const newItem: QueueItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: Date.now()
    };
    queue.push(newItem);
    this.saveSyncQueue(queue);
    console.log('Appwrite offline queue: added item:', newItem);
  }

  async flushSyncQueue(showNotification?: (msg: string) => void): Promise<void> {
    if (!this.isRealtimeConnected()) return;
    const queue = this.getSyncQueue();
    if (queue.length === 0) return;

    console.log(`Appwrite queue: starting flush of ${queue.length} items...\n`);
    const failed: QueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.type === 'save' && item.collectionId && item.orgId) {
          await this.saveFleetDocument(item.dbId, item.collectionId, item.docId, item.orgId, item.dataObj, true);
        } else if (item.type === 'delete' && item.collectionId) {
          await this.deleteFleetDocument(item.dbId, item.collectionId, item.docId, true);
        } else if (item.type === 'save_global') {
          await this.saveGlobalConfig(item.dbId, item.docId, item.dataObj, true);
        } else if (item.type === 'delete_global') {
          await this.deleteGlobalConfig(item.dbId, item.docId, true);
        }
      } catch (err: any) {
        console.warn(`Appwrite queue: failed to sync item ${item.id}, retaining in queue:`, err.message);
        failed.push(item);
      }
    }

    this.saveSyncQueue(failed);
    const syncedCount = queue.length - failed.length;
    if (syncedCount > 0) {
      console.log(`Appwrite queue: successfully synced ${syncedCount} offline operations.`);
      if (showNotification) {
        showNotification(`Synced ${syncedCount} offline updates to cloud.`);
      }
    }
  }

}

export const appwrite = new AppwriteService();
