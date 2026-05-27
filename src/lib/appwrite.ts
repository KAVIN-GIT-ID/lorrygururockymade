import { Client, Account as AppwriteAccount, Storage, Databases, ID, Teams, Query } from 'appwrite';

const projectID = (import.meta as any).env.VITE_APPWRITE_PROJECT_ID || '';
const endpoint = (import.meta as any).env.VITE_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';

export const isAppwriteConfigured = () => {
  return !!projectID && !!endpoint;
};

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

  // Authorize anonymously or get active session to enable standard RBAC writes safely
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
      } catch (err) {
        // No session exists, create anonymous session
        try {
          const session = await this.account.createAnonymousSession();
          return session;
        } catch (innerErr: any) {
          console.warn('Anonymous session creation bypassed/failed:', innerErr.message);
          return null;
        }
      }
    })();

    return this.sessionPromise;
  }

  async login(email: string, password: string) {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite is not configured.');
    }
    this.sessionPromise = null; // Clear cached promise
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
    const documentData = {
      organizationId: orgId,
      data: JSON.stringify(dataObj)
    };

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
}

export const appwrite = new AppwriteService();
