import { Query } from 'appwrite';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { SupportTicket } from '../types';

export interface SyncStateData {
  trucks: any[];
  drivers: any[];
  offices: any[];
  accounts: any[];
  trips: any[];
  expenses: any[];
  tyres: any[];
  auditLogs: any[];
  supportTickets: any[];
  coupons?: any[];
}

export const wrapAbort = <T,>(promise: Promise<T>, signal?: AbortSignal, name?: string): Promise<T> => {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(new Error('Aborted'));
    };
    if (signal.aborted) {
      return onAbort();
    }
    signal.addEventListener('abort', onAbort);
    promise.then(
      (res) => {
        signal.removeEventListener('abort', onAbort);
        resolve(res);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
};

export const SyncService = {
  async pullFromDB(
    databaseId: string,
    orgId: string,
    currentLocalState: SyncStateData,
    incremental: boolean,
    signal?: AbortSignal
  ) {
    if (!isAppwriteConfigured()) {
      throw new Error('Appwrite not configured');
    }

    const isLocalCacheEmpty = !currentLocalState.trucks?.length && !currentLocalState.trips?.length;
    const lastSyncTime = (incremental && !isLocalCacheEmpty) 
      ? Number(localStorage.getItem('appwrite_last_sync_time') || '0') 
      : 0;
    const extraQueries: string[] = [];
    if (lastSyncTime > 0) {
      extraQueries.push(Query.greaterThan('$updatedAt', new Date(lastSyncTime).toISOString()));
    }

    const isIncrementalSync = lastSyncTime > 0;
    const loadedState: any = {
      trucks: isIncrementalSync ? [...(currentLocalState.trucks || [])] : [],
      drivers: isIncrementalSync ? [...(currentLocalState.drivers || [])] : [],
      offices: isIncrementalSync ? [...(currentLocalState.offices || [])] : [],
      accounts: isIncrementalSync ? [...(currentLocalState.accounts || [])] : [],
      trips: isIncrementalSync ? [...(currentLocalState.trips || [])] : [],
      expenses: isIncrementalSync ? [...(currentLocalState.expenses || [])] : [],
      tyres: isIncrementalSync ? [...(currentLocalState.tyres || [])] : [],
      auditLogs: isIncrementalSync ? [...(currentLocalState.auditLogs || [])] : [],
      supportTickets: isIncrementalSync ? [...(currentLocalState.supportTickets || [])] : [],
      coupons: isIncrementalSync ? [...(currentLocalState.coupons || [])] : []
    };

    let userRightsData: any = null;
    let maxUpdatedAt = lastSyncTime;
    const verifiedCollections: string[] = [];

    const categories = [
      { key: 'trucks', collection: 'trucks' },
      { key: 'drivers', collection: 'drivers' },
      { key: 'offices', collection: 'offices' },
      { key: 'accounts', collection: 'accounts' },
      { key: 'trips', collection: 'trips' },
      { key: 'expenses', collection: 'expenses' },
      { key: 'tyres', collection: 'tyres' },
      { key: 'auditLogs', collection: 'audit_logs' },
      { key: 'supportTickets', collection: 'support_tickets' },
      { key: 'coupons', collection: 'coupons' }
    ];

    // First attempt 1 single consolidated batch HTTP pull for all collections
    let batchState: any = null;
    try {
      batchState = await appwrite.pullAllCollections(orgId);
    } catch (_) {}

    const fetchPromises = categories.map(async (cat) => {
      try {
        let docs: any[] = [];
        if (batchState && batchState[cat.key]) {
          docs = batchState[cat.key];
        } else {
          docs = await wrapAbort(appwrite.listFleetDocuments(databaseId, cat.collection, orgId, extraQueries), signal, `fetch_${cat.collection}`);
        }
        verifiedCollections.push(cat.collection);
        
        const updatedCollection = [...(loadedState[cat.key] || [])];
        for (const doc of docs) {
          const docId = doc.$id || doc.id;
          if (!docId) continue;
          if (doc.updatedAt) {
            const docTime = new Date(doc.updatedAt).getTime();
            if (docTime > maxUpdatedAt) {
              maxUpdatedAt = docTime;
            }
          }
          const parsedRecord = doc;
          const idx = updatedCollection.findIndex(x => x.id === docId);
          if (parsedRecord.deletedAt) {
            if (idx > -1) updatedCollection.splice(idx, 1);
          } else {
            const nextRecord = { ...parsedRecord, id: docId, syncState: 'synced' as const };
            if (idx > -1) {
              updatedCollection[idx] = nextRecord;
            } else {
              updatedCollection.push(nextRecord);
            }
          }
        }
        if (docs.length > 0 || lastSyncTime === 0) {
          loadedState[cat.key] = updatedCollection;
        } else {
          delete loadedState[cat.key];
        }
      } catch (err: any) {
        throw err;
      }
    });

    const loadRightsPromise = (async () => {
      const allConfigs = await wrapAbort(appwrite.listGlobalConfigs(databaseId), signal, 'fetch_global_configs');
      userRightsData = { userRightsList: [], organizationProfiles: [] };
      for (const doc of allConfigs) {
        try {
          const parsed = JSON.parse(doc.data);
          const keyVal = doc.key || doc.$id || '';
          if (keyVal.startsWith('usr_')) {
            userRightsData.userRightsList.push(parsed);
          } else if (keyVal.startsWith('prf_')) {
            if (parsed && parsed.organizationId) {
              userRightsData.organizationProfiles.push(parsed);
            }
          } else if (keyVal === 'cfg_app_version') {
            localStorage.setItem('ttt_app_update_config', doc.data);
            if (typeof window !== 'undefined' && window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('ttt_app_update_event', { detail: parsed }));
            }
          }
        } catch (e) {
          console.warn(`Failed to parse global config doc ${doc.$id}:`, e);
        }
      }
    })();

    try {
      await Promise.all([...fetchPromises, loadRightsPromise]);
      if (maxUpdatedAt > 0) {
        loadedState.exportDate = maxUpdatedAt;
        localStorage.setItem('appwrite_last_sync_time', String(maxUpdatedAt));
      }
      return { loadedState, userRightsData, verifiedCollections };
    } catch (err: any) {
      throw err;
    }
  },

  async pushAllLocalToDB(databaseId: string, orgId: string, currentLocalState: SyncStateData) {
    if (!isAppwriteConfigured()) throw new Error('Appwrite variables are missing.');

    let totalRecords = 0;
    const categories = [
      { key: 'trucks', collection: 'trucks' },
      { key: 'drivers', collection: 'drivers' },
      { key: 'offices', collection: 'offices' },
      { key: 'accounts', collection: 'accounts' },
      { key: 'trips', collection: 'trips' },
      { key: 'expenses', collection: 'expenses' },
      { key: 'tyres', collection: 'tyres' },
      { key: 'auditLogs', collection: 'audit_logs' },
      { key: 'supportTickets', collection: 'support_tickets' }
    ];

    for (const cat of categories) {
      const list = ((currentLocalState as any)[cat.key] || []).filter((x: any) => x.organizationId === orgId);
      totalRecords += list.length;

      for (const item of list) {
        await appwrite.saveFleetDocument(databaseId, cat.collection, item.id, orgId, item);
      }
    }

    const storedRights = localStorage.getItem('ttt_user_rights');
    const storedProfiles = localStorage.getItem('ttt_organization_profiles');
    const userRightsList = storedRights ? JSON.parse(storedRights) : [];
    const organizationProfiles = storedProfiles ? JSON.parse(storedProfiles) : [];

    for (const ur of userRightsList) {
      const docId = appwrite.getEmailDocId(ur.email);
      await appwrite.saveGlobalConfig(databaseId, docId, ur);
      totalRecords += 1;
    }

    for (const prof of organizationProfiles) {
      const docId = appwrite.getOrgDocId(prof.organizationId);
      await appwrite.saveGlobalConfig(databaseId, docId, prof);
      totalRecords += 1;
    }

    return totalRecords;
  }
};
