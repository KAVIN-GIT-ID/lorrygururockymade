import { Client, Account as AppwriteAccount, Storage, Databases, ID, Teams, Query } from 'appwrite';

const cleanEnvVar = (val: string): string => {
  if (!val) return '';
  return val.trim().replace(/^['"]|['"]$/g, '');
};

const projectID = cleanEnvVar(import.meta.env.VITE_APPWRITE_PROJECT_ID || '');
const endpoint = cleanEnvVar(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1');

export const isAppwriteConfigured = () => {
  return !!projectID && !!endpoint;
};

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

class AppwriteService {
  private client: Client;
  private account: AppwriteAccount;
  private storage: Storage;
  private databases: Databases;
  private teams: Teams;
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
  }

  getClient() {
    return this.client;
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
    return await this.account.create(ID.unique(), email, password, name);
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

  async uploadFile(file: File, customName?: string): Promise<string> {
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
      const response = await this.storage.createFile(
        this.getBucketId(),
        ID.unique(),
        fileToUpload
      );
      return response.$id;
    } catch (err: any) {
      console.error("Appwrite uploadFile failed:", err);
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

  /**
   * Fetch all records for the active organization in a dynamic collection.
   */
  async listFleetDocuments(dbId: string, collectionId: string, orgId: string): Promise<any[]> {
    await this.initSession();
    try {
      const queries = [];
      if (orgId !== 'org_backend') {
        queries.push(Query.equal('organizationId', orgId));
      }
      queries.push(Query.limit(5000));

      const response = await this.databases.listDocuments(
        dbId,
        collectionId,
        queries
      );
      return response.documents || [];
    } catch (err: any) {
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
      if (response && response.data) {
        return JSON.parse(response.data);
      }
      return null;
    } catch (err: any) {
      if (err.code === 404 || err.type === 'document_not_found') {
        return null;
      }
      console.error(`Appwrite Database getDocument failure for ${docId} in ${collectionId}:`, err);
      throw err;
    }
  }

  /**
   * Save a single document (upsert) to Appwrite Database.
   */
  async saveFleetDocument(dbId: string, collectionId: string, docId: string, orgId: string, dataObj: any): Promise<string> {
    await this.initSession();
    
    let documentData: any = {
      organizationId: orgId,
      data: JSON.stringify(dataObj)
    };

    if (collectionId === 'audit_logs') {
      documentData = {
        organizationId: orgId,
        timestamp: dataObj.timestamp || '',
        user: dataObj.user || '',
        action: dataObj.action || 'Cloud',
        category: dataObj.category || '',
        reference: dataObj.reference || '',
        details: dataObj.details || '',
        data: JSON.stringify(dataObj)
      };
    } else if (collectionId === 'trips') {
      documentData = {
        organizationId: orgId,
        tripNo: dataObj.tripNo || '',
        truckNo: dataObj.truckNo || '',
        startDate: dataObj.startDate || '',
        endDate: dataObj.endDate || '',
        driverName: dataObj.driverName || '',
        status: dataObj.status || 'Pending',
        notes: dataObj.notes || '',
        data: JSON.stringify(dataObj)
      };
    } else if (collectionId === 'expenses') {
      documentData = {
        organizationId: orgId,
        truckNo: dataObj.truckNo || '',
        expenseType: dataObj.expenseType || '',
        shopName: dataObj.shopName || '',
        amount: Number(dataObj.amount) || 0,
        paymentMode: dataObj.paymentMode || '',
        date: dataObj.date || '',
        status: dataObj.status || 'Pending',
        accountType: dataObj.accountType || 'Account',
        driverName: dataObj.driverName || '',
        data: JSON.stringify(dataObj)
      };
    } else if (collectionId === 'tyres') {
      documentData = {
        organizationId: orgId,
        tyreNo: dataObj.tyreNo || '',
        manufacturer: dataObj.manufacturer || '',
        status: dataObj.status || 'Available',
        currentTruckNo: dataObj.currentTruckNo || '',
        purchaseDate: dataObj.purchaseDate || '',
        data: JSON.stringify(dataObj)
      };
    }

    try {
      // Upsert: Try updating the document first
      const response = await this.databases.updateDocument(dbId, collectionId, docId, documentData);
      return response.$id;
    } catch (err: any) {
      // If document doesn't exist (404), create it
      if (err.code === 404 || err.type === 'document_not_found') {
        try {
          const response = await this.databases.createDocument(dbId, collectionId, docId, documentData);
          return response.$id;
        } catch (createErr: any) {
          console.error(`Appwrite Database create failure for ${docId} in ${collectionId}:`, createErr);
          throw createErr;
        }
      }
      console.error(`Appwrite Database update failure for ${docId} in ${collectionId}:`, err);
      throw err;
    }
  }

  /**
   * Delete a single document from Appwrite Database.
   */
  async deleteFleetDocument(dbId: string, collectionId: string, docId: string): Promise<boolean> {
    await this.initSession();
    try {
      await this.databases.deleteDocument(dbId, collectionId, docId);
      return true;
    } catch (err: any) {
      // If it's already deleted or doesn't exist, ignore the error
      if (err.code === 404 || err.type === 'document_not_found') {
        return true;
      }
      console.error(`Appwrite Database delete failure for ${docId} in ${collectionId}:`, err);
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
      console.error(`Appwrite Database listGlobalConfigs failure:`, err);
      throw err;
    }
  }

  /**
   * Delete a global configuration document by key from Appwrite Database.
   */
  async deleteGlobalConfig(dbId: string, key: string): Promise<boolean> {
    await this.initSession();
    try {
      await this.databases.deleteDocument(dbId, 'global_configs', key);
      return true;
    } catch (err: any) {
      if (err.code === 404 || err.type === 'document_not_found') {
        return true;
      }
      console.error(`Appwrite Database deleteGlobalConfig failure for key ${key}:`, err);
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
   * Save a global configuration document by key to Appwrite Database.
   */
  async saveGlobalConfig(dbId: string, key: string, payload: any): Promise<string> {
    await this.initSession();
    const documentData = {
      key: key,
      data: JSON.stringify(payload)
    };
    try {
      const response = await this.databases.updateDocument(dbId, 'global_configs', key, documentData);
      return response.$id;
    } catch (err: any) {
      if (err.code === 404 || err.type === 'document_not_found') {
        try {
          const response = await this.databases.createDocument(dbId, 'global_configs', key, documentData);
          return response.$id;
        } catch (createErr: any) {
          console.error(`Appwrite Database saveGlobalConfig create failure for key ${key}:`, createErr);
          throw createErr;
        }
      }
      console.error(`Appwrite Database saveGlobalConfig update failure for key ${key}:`, err);
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
      return result.memberships || [];
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
      const redirectUrl = window.location.origin;
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
      const match = list.memberships.find(m => m.userEmail.toLowerCase() === email.toLowerCase());
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
      const match = list.memberships.find(m => m.userId === user.$id || m.userEmail.toLowerCase() === user.email.toLowerCase());
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
    filters: { search?: string; truckNo?: string; status?: string; startDate?: string; endDate?: string },
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
        queries.push(Query.equal('status', filters.status));
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
      return {
        documents: response.documents || [],
        total: response.total || 0
      };
    } catch (err: any) {
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
        documents: response.documents || [],
        total: response.total || 0
      };
    } catch (err: any) {
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
      console.error("fetchMonthlyTripsAndExpenses failure:", err);
      throw err;
    }
  }
}

export const appwrite = new AppwriteService();
