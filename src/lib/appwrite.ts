/**
 * Cloudflare D1 & Worker Native Client
 * Drop-in replacement for legacy backend services, fully compatible with all UI components and hooks.
 */

import { secureFetch } from './secureChannel';

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

export const isAppwriteConfigured = () => {
  return true;
};

class CloudflareClientService {
  private jwt: string | null = null;
  private cachedUser: any = null;
  private subscribers = new Set<(event: any) => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.jwt = localStorage.getItem('ttt_cf_jwt') || null;
      try {
        const stored = localStorage.getItem('ttt_cf_user');
        if (stored) this.cachedUser = JSON.parse(stored);
      } catch (_) {}
    }
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

  getFileView(fileId: string): string {
    if (!fileId) return '';
    return `${this.getBaseUrl()}/api/storage/file/${fileId}`;
  }

  async getSecureFileUrl(fileId: string): Promise<string> {
    if (!fileId) return '';
    try {
      const response = await secureFetch(`${this.getBaseUrl()}/api/storage/file/${fileId}`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) return this.getFileView(fileId);
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
    if (!fileId) return false;
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

  async saveFleetDocument(_dbId: string, collectionId: string, docId: string, orgId: string, dataObj: any): Promise<string> {
    const res = await secureFetch(`${this.getBaseUrl()}/api/database/save`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        dbId: 'fleet_db',
        collectionId,
        docId,
        orgId,
        dataObj,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Database save failed' }));
      throw new Error(err.error || 'Database save failed');
    }

    const data = await res.json();
    return data.docId || docId;
  }

  async deleteFleetDocument(_dbId: string, collectionId: string, docId: string): Promise<boolean> {
    const res = await secureFetch(`${this.getBaseUrl()}/api/database/delete`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        dbId: 'fleet_db',
        collectionId,
        docId,
      }),
    });
    return res.ok;
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

  async listGlobalConfigs(_dbId: string): Promise<any[]> {
    const res = await secureFetch(`${this.getBaseUrl()}/api/database/list/global_configs`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  }

  async deleteGlobalConfig(_dbId: string, key: string): Promise<boolean> {
    return await this.deleteFleetDocument('fleet_db', 'global_configs', key);
  }

  async loadGlobalConfig(_dbId: string, key: string): Promise<any> {
    return await this.loadFleetDocument('fleet_db', 'global_configs', key);
  }

  async saveGlobalConfig(_dbId: string, key: string, payload: any): Promise<string> {
    return await this.saveFleetDocument('fleet_db', 'global_configs', key, payload.organizationId || 'global', payload);
  }

  // General paginated queries
  async queryAuditLogs(
    dbId: string,
    orgId: string,
    filters: { category?: string; action?: string; search?: string; startDate?: string; endDate?: string },
    page: number,
    limit: number
  ): Promise<{ documents: any[]; total: number; fallback?: boolean }> {
    const allDocs = await this.listFleetDocuments(dbId, 'audit_logs', orgId);
    let filtered = allDocs;

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

    return { documents: paginated, total, fallback: false };
  }

  async queryTrips(
    dbId: string,
    orgId: string,
    filters: { search?: string; truckNo?: string; status?: string; startDate?: string; endDate?: string },
    page: number,
    limit: number,
    sortField: string = 'startDate',
    sortDirection: 'asc' | 'desc' = 'desc'
  ): Promise<{ documents: any[]; total: number }> {
    const allDocs = await this.listFleetDocuments(dbId, 'trips', orgId);
    let filtered = allDocs;

    if (filters.truckNo) {
      filtered = filtered.filter(t => t.truckNo === filters.truckNo);
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
    const allDocs = await this.listFleetDocuments(dbId, 'tyres', orgId);
    let filtered = allDocs;

    if (filters.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }
    if (filters.search) {
      const s = filters.search.toUpperCase();
      filtered = filtered.filter(t => (t.tyreNo || '').toUpperCase() === s);
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return { documents: paginated, total };
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
}

export const appwrite = new CloudflareClientService();
