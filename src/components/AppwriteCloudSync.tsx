import React, { useState, useEffect, useRef } from 'react';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { 
  Cloud, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Settings,
  Database,
  Loader,
  Sparkles,
  RefreshCw,
  Trash2
} from 'lucide-react';

interface AppwriteCloudSyncProps {
  currentLocalState: {
    trucks: any[];
    drivers: any[];
    offices: any[];
    accounts: any[];
    trips: any[];
    expenses: any[];
    tyres: any[];
    auditLogs: any[];
  };
  onLoadCloudState: (loadedState: any, userRightsData?: any) => boolean;
  showNotification: (msg: string) => void;
  logAction: (action: string, model: string, identifier: string, description: string) => void;
  currentUserOrgId: string;
  isAdmin: boolean;
  onInitialSyncComplete?: (completed: boolean) => void;
  onConnectionChange?: (isOnline: boolean, reason?: 'offline' | 'realtime_lost') => void;
}

export default function AppwriteCloudSync({
  currentLocalState,
  onLoadCloudState,
  showNotification,
  logAction,
  currentUserOrgId,
  isAdmin,
  onInitialSyncComplete,
  onConnectionChange
}: AppwriteCloudSyncProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfigured] = useState(isAppwriteConfigured());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  
  // Custom user-adjustable database properties
  const [databaseId, setDatabaseId] = useState(() => {
    return localStorage.getItem('appwrite_database_id') || 'fleet_db';
  });
  const [collectionId, setCollectionId] = useState(() => {
    return localStorage.getItem('appwrite_collection_id') || 'fleet_records';
  });

  const [realtimeConnected, setRealtimeConnected] = useState(true);

  // Monitor hardware/browser network connectivity status
  useEffect(() => {
    const handleOnline = () => {
      if (onConnectionChange) {
        onConnectionChange(true);
      }
    };
    const handleOffline = () => {
      if (onConnectionChange) {
        onConnectionChange(false, 'offline');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!window.navigator.onLine && onConnectionChange) {
      onConnectionChange(false, 'offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onConnectionChange]);

  const orgId = currentUserOrgId || 'org_default';

  // Refs for tracking local states and syncing baselines
  const currentLocalStateRef = useRef(currentLocalState);
  useEffect(() => {
    currentLocalStateRef.current = currentLocalState;
  }, [currentLocalState]);

  // Keep callback refs fresh so the WebSocket closure always calls the latest version
  const onLoadCloudStateRef = useRef(onLoadCloudState);
  useEffect(() => { onLoadCloudStateRef.current = onLoadCloudState; }, [onLoadCloudState]);
  const showNotificationRef = useRef(showNotification);
  useEffect(() => { showNotificationRef.current = showNotification; }, [showNotification]);
  const logActionRef = useRef(logAction);
  useEffect(() => { logActionRef.current = logAction; }, [logAction]);

  // Keep a baseline of the last synchronized state to perform delta queries
  const baselineStateRef = useRef<{
    trucks: any[];
    drivers: any[];
    offices: any[];
    accounts: any[];
    trips: any[];
    expenses: any[];
    tyres: any[];
    auditLogs: any[];
  }>({
    trucks: [],
    drivers: [],
    offices: [],
    accounts: [],
    trips: [],
    expenses: [],
    tyres: [],
    auditLogs: []
  });

  const [initialPullDone, setInitialPullDone] = useState(false);
  const isSyncing = useRef(false);

  // Reset initial sync status and baseline when organization resolves/changes
  const prevOrgIdRef = useRef(orgId);
  useEffect(() => {
    const wasRealOrg = prevOrgIdRef.current && prevOrgIdRef.current !== 'org_default' && prevOrgIdRef.current !== '';
    const isRealOrg = orgId && orgId !== 'org_default' && orgId !== '';

    if (wasRealOrg && isRealOrg && prevOrgIdRef.current !== orgId) {
      console.log(`Appwrite Sync: Organization changed from ${prevOrgIdRef.current} to ${orgId}. Resetting sync state.`);
      setInitialPullDone(false);
      baselineStateRef.current = {
        trucks: [],
        drivers: [],
        offices: [],
        accounts: [],
        trips: [],
        expenses: [],
        tyres: [],
        auditLogs: []
      };
    }
    prevOrgIdRef.current = orgId;
  }, [orgId]);

  useEffect(() => {
    localStorage.setItem('appwrite_database_id', databaseId);
  }, [databaseId]);

  useEffect(() => {
    localStorage.setItem('appwrite_collection_id', collectionId);
  }, [collectionId]);

  // Generate a fingerprint of current organization state to watch for edits
  const getScopedFingerprint = (state: typeof currentLocalState) => {
    return JSON.stringify({
      trucks: (state.trucks || []).filter(t => orgId === 'org_backend' || t.organizationId === orgId),
      drivers: (state.drivers || []).filter(d => orgId === 'org_backend' || d.organizationId === orgId),
      offices: (state.offices || []).filter(o => orgId === 'org_backend' || o.organizationId === orgId),
      accounts: (state.accounts || []).filter(a => orgId === 'org_backend' || a.organizationId === orgId),
      trips: (state.trips || []).filter(t => orgId === 'org_backend' || t.organizationId === orgId),
      expenses: (state.expenses || []).filter(e => orgId === 'org_backend' || e.organizationId === orgId),
      tyres: (state.tyres || []).filter(t => orgId === 'org_backend' || t.organizationId === orgId),
      auditLogs: (state.auditLogs || []).filter(l => orgId === 'org_backend' || l.organizationId === orgId)
    });
  };

  const stateFingerprint = getScopedFingerprint(currentLocalState);
  const previousFingerprint = useRef(stateFingerprint);

  // Initial pull from Appwrite Database
  const handlePullFromDB = async (quiet = false) => {
    if (!isConfigured) return;
    if (!quiet) {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
    
    try {
      console.log('Appwrite DB: Fetching fleet documents from multi-collection structure...');
      
      const loadedState: any = {
        trucks: [],
        drivers: [],
        offices: [],
        accounts: [],
        trips: [],
        expenses: [],
        tyres: [],
        auditLogs: []
      };
      
      let userRightsData: any = null;
      let maxUpdatedAt = 0;

      const categories: { key: keyof typeof loadedState; collection: string }[] = [
        { key: 'trucks', collection: 'trucks' },
        { key: 'drivers', collection: 'drivers' },
        { key: 'offices', collection: 'offices' },
        { key: 'accounts', collection: 'accounts' },
        { key: 'trips', collection: 'trips' },
        { key: 'expenses', collection: 'expenses' },
        { key: 'tyres', collection: 'tyres' },
        { key: 'auditLogs', collection: 'audit_logs' }
      ];

      const fetchPromises = categories.map(async (cat) => {
        try {
          const docs = await appwrite.listFleetDocuments(databaseId, cat.collection, orgId);
          const parsedRecords: any[] = [];
          for (const doc of docs) {
            try {
              const record = JSON.parse(doc.data);
              parsedRecords.push(record);
              if (doc.$updatedAt) {
                const docTime = new Date(doc.$updatedAt).getTime();
                if (docTime > maxUpdatedAt) {
                  maxUpdatedAt = docTime;
                }
              }
            } catch (e) {
              console.warn(`Failed to parse document payload for ${doc.$id} in ${cat.collection}:`, e);
            }
          }
          loadedState[cat.key] = parsedRecords;
        } catch (catErr: any) {
          console.warn(`Failed to fetch/parse documents for collection ${cat.collection}:`, catErr.message);
        }
      });

      const loadRightsPromise = (async () => {
        try {
          const allConfigs = await appwrite.listGlobalConfigs(databaseId);
          userRightsData = { userRightsList: [], organizationProfiles: [] };
          for (const doc of allConfigs) {
            try {
              const parsed = JSON.parse(doc.data);
              if (doc.key.startsWith('usr_')) {
                userRightsData.userRightsList.push(parsed);
              } else if (doc.key.startsWith('prf_')) {
                userRightsData.organizationProfiles.push(parsed);
              }
            } catch (e) {
              console.warn(`Failed to parse global config doc ${doc.$id}:`, e);
            }
          }
        } catch (e) {
          console.warn('Failed to load global rights config:', e);
        }
      })();

      await Promise.all([...fetchPromises, loadRightsPromise]);

      if (maxUpdatedAt > 0) {
        loadedState.exportDate = maxUpdatedAt;
      }

      // Sync local baseline — IMPORTANT: always filter by orgId.
      // For org_backend, listFleetDocuments returns ALL records across ALL orgs
      // (no org filter). If we stored them unfiltered here, the delta sync would
      // see them in the baseline but NOT in currentList (which filters by orgId),
      // and would incorrectly delete them as "removed" items.
      baselineStateRef.current = {
        trucks: loadedState.trucks.filter((t: any) => orgId === 'org_backend' || t.organizationId === orgId),
        drivers: loadedState.drivers.filter((d: any) => orgId === 'org_backend' || d.organizationId === orgId),
        offices: loadedState.offices.filter((o: any) => orgId === 'org_backend' || o.organizationId === orgId),
        accounts: loadedState.accounts.filter((a: any) => orgId === 'org_backend' || a.organizationId === orgId),
        trips: loadedState.trips.filter((t: any) => orgId === 'org_backend' || t.organizationId === orgId),
        expenses: loadedState.expenses.filter((e: any) => orgId === 'org_backend' || e.organizationId === orgId),
        tyres: loadedState.tyres.filter((t: any) => orgId === 'org_backend' || t.organizationId === orgId),
        auditLogs: loadedState.auditLogs.filter((l: any) => orgId === 'org_backend' || l.organizationId === orgId)
      };

      // Load state into local UI
      const didChange = onLoadCloudState(loadedState, userRightsData);
      
      previousFingerprint.current = getScopedFingerprint(loadedState);
      
      if (!quiet) {
        setSuccessMsg('Active registers successfully loaded from Appwrite Database!');
        if (didChange) {
          showNotification('Active buffers synchronized with Appwrite Database.');
        } else {
          showNotification('Appwrite Database: Already up to date.');
        }
      }
    } catch (err: any) {
      console.error('Appwrite DB loading failure:', err);
      if (!quiet) {
        setErrorMsg(
          `Database retrieval failed: ${err.message || 'Unknown error'}. \n\n` + 
          `Tip: Make sure you have run the bootstrapping script to create the database schemas:\n` +
          `  node scripts/bootstrap-db.js`
        );
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  // Perform initial pull on launch
  useEffect(() => {
    if (!isConfigured || initialPullDone) return;

    const performInitialSync = async () => {
      try {
        console.log("Appwrite DB: Performing initial query sync on load...");
        await handlePullFromDB(true);
      } catch (err: any) {
        console.warn("Appwrite initial pull skipped, using local master state:", err.message);
      } finally {
        setInitialPullDone(true);
        if (onInitialSyncComplete) {
          onInitialSyncComplete(true);
        }
      }
    };

    performInitialSync();
  }, [databaseId, isConfigured, orgId, initialPullDone]);

  // Delta Sync Engine (Pushes local modifications to DB)
  const syncLocalToDatabase = async () => {
    if (!isConfigured || isSyncing.current) return;
    
    isSyncing.current = true;
    const currentState = currentLocalStateRef.current;
    const baseline = baselineStateRef.current;

    const categories: { key: keyof typeof currentState; collection: string }[] = [
      { key: 'trucks', collection: 'trucks' },
      { key: 'drivers', collection: 'drivers' },
      { key: 'offices', collection: 'offices' },
      { key: 'accounts', collection: 'accounts' },
      { key: 'trips', collection: 'trips' },
      { key: 'expenses', collection: 'expenses' },
      { key: 'tyres', collection: 'tyres' },
      { key: 'auditLogs', collection: 'audit_logs' }
    ];

    try {
      let changeDetected = false;

      for (const cat of categories) {
        const currentList = (currentState[cat.key] || []).filter(x => orgId === 'org_backend' || x.organizationId === orgId);
        const baselineList = baseline[cat.key] || [];

        // 1. Find Created & Updated documents
        for (const item of currentList) {
          const baseItem = baselineList.find(b => b.id === item.id);
          const itemStr = JSON.stringify(item);
          
          if (!baseItem) {
            // Created item
            console.log(`Appwrite DB [Delta Sync]: Creating doc for ${cat.collection} (${item.id})`);
            const targetOrgId = orgId === 'org_backend' ? (item.organizationId || orgId) : orgId;
            await appwrite.saveFleetDocument(databaseId, cat.collection, item.id, targetOrgId, item);
            changeDetected = true;
          } else if (JSON.stringify(baseItem) !== itemStr) {
            // Updated item
            console.log(`Appwrite DB [Delta Sync]: Updating doc for ${cat.collection} (${item.id})`);
            const targetOrgId = orgId === 'org_backend' ? (item.organizationId || orgId) : orgId;
            await appwrite.saveFleetDocument(databaseId, cat.collection, item.id, targetOrgId, item);
            changeDetected = true;
          }
        }

        // 2. Find Deleted documents
        // Safety: only delete items that belong to THIS org. This prevents
        // org_backend's unfiltered baseline from causing cross-org deletions.
        for (const baseItem of baselineList) {
          if (orgId !== 'org_backend' && baseItem.organizationId && baseItem.organizationId !== orgId) {
            continue; // Not our org — skip
          }
          const currentItem = currentList.find(c => c.id === baseItem.id);
          if (!currentItem) {
            console.log(`Appwrite DB [Delta Sync]: Deleting doc for ${cat.collection} (${baseItem.id})`);
            await appwrite.deleteFleetDocument(databaseId, cat.collection, baseItem.id);
            changeDetected = true;
          }
        }
      }

      if (changeDetected) {
        console.log("Appwrite DB [Delta Sync]: Sync completed successfully.");

        // After pushing our own changes, do a quiet pull to apply any realtime
        // events from other users that arrived during the sync window.
        try {
          await handlePullFromDB(true);
        } catch (pullErr: any) {
          console.warn('Post-sync quiet pull failed:', pullErr.message);
        }
        
        // Update baseline
        baselineStateRef.current = {
          trucks: (currentState.trucks || []).filter(t => orgId === 'org_backend' || t.organizationId === orgId),
          drivers: (currentState.drivers || []).filter(d => orgId === 'org_backend' || d.organizationId === orgId),
          offices: (currentState.offices || []).filter(o => orgId === 'org_backend' || o.organizationId === orgId),
          accounts: (currentState.accounts || []).filter(a => orgId === 'org_backend' || a.organizationId === orgId),
          trips: (currentState.trips || []).filter(t => orgId === 'org_backend' || t.organizationId === orgId),
          expenses: (currentState.expenses || []).filter(e => orgId === 'org_backend' || e.organizationId === orgId),
          tyres: (currentState.tyres || []).filter(t => orgId === 'org_backend' || t.organizationId === orgId),
          auditLogs: (currentState.auditLogs || []).filter(l => orgId === 'org_backend' || l.organizationId === orgId)
        };
      }
      
      previousFingerprint.current = getScopedFingerprint(currentState);
    } catch (e: any) {
      console.warn("Appwrite Database auto-push failed:", e.message);
    } finally {
      isSyncing.current = false;
    }
  };

  // Automatic background delta sync is disabled to use direct database interaction on hook mutations.
  // This prevents race conditions and data-overwrite issues on page reloads or network glitches.
  /*
  useEffect(() => {
    if (!isConfigured || !initialPullDone) return;
    if (previousFingerprint.current === stateFingerprint) return;

    previousFingerprint.current = stateFingerprint;

    const timer = setTimeout(() => {
      syncLocalToDatabase();
    }, 2000);

    return () => clearTimeout(timer);
  }, [stateFingerprint, isConfigured, initialPullDone]);
  */

  // Real-Time Web Socket subscription using Appwrite real-time channel
  useEffect(() => {
    if (!isConfigured) {
      setRealtimeConnected(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const setupRealtime = async () => {
      try {
        await appwrite.initSession();
        const client = appwrite.getClient();
        
        const colList = ['trucks', 'drivers', 'offices', 'accounts', 'trips', 'expenses', 'tyres', 'audit_logs', 'global_configs'];
        const channels = colList.map(col => `databases.${databaseId}.collections.${col}.documents`);
        console.log(`Appwrite socket: Subscribing to multi-collection channels...`);

        unsubscribe = client.subscribe(
          channels,
          (response: any) => {
            const doc = response.payload;
            const collectionId = doc.$collectionId;
            
            // Check if document belongs to this organization (or global configs)
            if (collectionId !== 'global_configs' && orgId !== 'org_backend' && doc.organizationId !== orgId) {
              return;
            }

            // If we are mid-sync (pushing OUR data), skip — but only ignore events for
            // the exact same doc IDs we are currently writing to avoid feedback loops.
            // We intentionally do NOT block ALL events during sync so other users'
            // changes are not missed during concurrent writes.

            console.log(`Appwrite realtime event: ${response.events[0]} on doc ${doc.$id} in ${collectionId}`);
            
            const eventType = response.events[0];
            
            const currentState = currentLocalStateRef.current;
            const nextState = {
              trucks: [...(currentState.trucks || [])],
              drivers: [...(currentState.drivers || [])],
              offices: [...(currentState.offices || [])],
              accounts: [...(currentState.accounts || [])],
              trips: [...(currentState.trips || [])],
              expenses: [...(currentState.expenses || [])],
              tyres: [...(currentState.tyres || [])],
              auditLogs: [...(currentState.auditLogs || [])]
            };

            if (collectionId === 'global_configs') {
              try {
                const storedRights = localStorage.getItem('ttt_user_rights');
                const storedProfiles = localStorage.getItem('ttt_organization_profiles');
                let localRights = storedRights ? JSON.parse(storedRights) : [];
                let localProfiles = storedProfiles ? JSON.parse(storedProfiles) : [];

                if (eventType.endsWith('.delete')) {
                  if (doc.$id.startsWith('usr_')) {
                    localRights = localRights.filter((r: any) => appwrite.getEmailDocId(r.email) !== doc.$id);
                  } else if (doc.$id.startsWith('prf_')) {
                    const orgId = doc.$id.replace('prf_', '');
                    localProfiles = localProfiles.filter((p: any) => p.organizationId !== orgId);
                  }
                } else {
                  const parsedItem = JSON.parse(doc.data);
                  if (doc.key.startsWith('usr_')) {
                    const idx = localRights.findIndex((r: any) => r.email.toLowerCase().trim() === parsedItem.email.toLowerCase().trim());
                    if (idx > -1) {
                      localRights[idx] = parsedItem;
                    } else {
                      localRights.push(parsedItem);
                    }
                  } else if (doc.key.startsWith('prf_')) {
                    const idx = localProfiles.findIndex((p: any) => p.organizationId === parsedItem.organizationId);
                    if (idx > -1) {
                      localProfiles[idx] = parsedItem;
                    } else {
                      localProfiles.push(parsedItem);
                    }
                  }
                }

                onLoadCloudStateRef.current({}, { userRightsList: localRights, organizationProfiles: localProfiles });
              } catch (e) {
                console.warn('Failed to parse realtime global config:', e);
              }
              return;
            }

            let key: keyof typeof nextState | null = null;
            if (collectionId === 'trucks') key = 'trucks';
            else if (collectionId === 'drivers') key = 'drivers';
            else if (collectionId === 'offices') key = 'offices';
            else if (collectionId === 'accounts') key = 'accounts';
            else if (collectionId === 'trips') key = 'trips';
            else if (collectionId === 'expenses') key = 'expenses';
            else if (collectionId === 'tyres') key = 'tyres';
            else if (collectionId === 'audit_logs') key = 'auditLogs';

            if (!key || !nextState[key]) return;

            if (eventType.endsWith('.delete')) {
              // Delete document locally
              nextState[key] = (nextState[key] as any[]).filter(x => x.id !== doc.$id);
            } else {
              // Create or Update document locally
              try {
                const parsedRecord = JSON.parse(doc.data);
                const index = (nextState[key] as any[]).findIndex(x => x.id === doc.$id);
                if (index > -1) {
                  (nextState[key] as any[])[index] = parsedRecord;
                } else {
                  (nextState[key] as any[]).push(parsedRecord);
                }
              } catch (e) {
                console.warn('Failed to parse realtime data payload:', e);
                return;
              }
            }

            // Apply incremental change to local state without trigger feedback
            baselineStateRef.current = {
              trucks: (nextState.trucks).filter(t => orgId === 'org_backend' || t.organizationId === orgId),
              drivers: (nextState.drivers).filter(d => orgId === 'org_backend' || d.organizationId === orgId),
              offices: (nextState.offices).filter(o => orgId === 'org_backend' || o.organizationId === orgId),
              accounts: (nextState.accounts).filter(a => orgId === 'org_backend' || a.organizationId === orgId),
              trips: (nextState.trips).filter(t => orgId === 'org_backend' || t.organizationId === orgId),
              expenses: (nextState.expenses).filter(e => orgId === 'org_backend' || e.organizationId === orgId),
              tyres: (nextState.tyres).filter(t => orgId === 'org_backend' || t.organizationId === orgId),
              auditLogs: (nextState.auditLogs).filter(l => orgId === 'org_backend' || l.organizationId === orgId)
            };

            onLoadCloudStateRef.current(nextState);
            previousFingerprint.current = getScopedFingerprint(nextState);
            console.log(`Database Sync: Updated ${collectionId} records in real-time.`);
          }
        );
        
        setRealtimeConnected(true);
        if (onConnectionChange) {
          onConnectionChange(true);
        }
        console.log("Appwrite realtime socket pipeline successfully established.");
      } catch (err: any) {
        console.warn('Realtime socket skipped or failed:', err.message);
        setRealtimeConnected(false);
        if (onConnectionChange) {
          onConnectionChange(false, 'realtime_lost');
        }
      }
    };

    setupRealtime();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [databaseId, isConfigured, orgId]);

  const handleManualPushToDB = async () => {
    if (!isConfigured) {
      setErrorMsg('Appwrite variables are missing.');
      return;
    }
    
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    isSyncing.current = true;
    
    const currentState = currentLocalStateRef.current;
    
    const categories: { key: keyof typeof currentState; collection: string }[] = [
      { key: 'trucks', collection: 'trucks' },
      { key: 'drivers', collection: 'drivers' },
      { key: 'offices', collection: 'offices' },
      { key: 'accounts', collection: 'accounts' },
      { key: 'trips', collection: 'trips' },
      { key: 'expenses', collection: 'expenses' },
      { key: 'tyres', collection: 'tyres' },
      { key: 'auditLogs', collection: 'audit_logs' }
    ];

    try {
      console.log('Appwrite DB: Starting full migration push...');
      let totalRecords = 0;
      
      for (const cat of categories) {
        const list = (currentState[cat.key] || []).filter(x => x.organizationId === orgId);
        totalRecords += list.length;
        
        for (const item of list) {
          await appwrite.saveFleetDocument(databaseId, cat.collection, item.id, orgId, item);
        }
      }

      // Also save permissions individually to global_configs
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

      // Re-initialize baseline state
      baselineStateRef.current = {
        trucks: (currentState.trucks || []).filter(t => t.organizationId === orgId),
        drivers: (currentState.drivers || []).filter(d => d.organizationId === orgId),
        offices: (currentState.offices || []).filter(o => o.organizationId === orgId),
        accounts: (currentState.accounts || []).filter(a => a.organizationId === orgId),
        trips: (currentState.trips || []).filter(t => t.organizationId === orgId),
        expenses: (currentState.expenses || []).filter(e => e.organizationId === orgId),
        tyres: (currentState.tyres || []).filter(t => t.organizationId === orgId),
        auditLogs: (currentState.auditLogs || []).filter(l => l.organizationId === orgId)
      };

      previousFingerprint.current = getScopedFingerprint(currentState);
      
      setSuccessMsg(`Successfully uploaded ${totalRecords} records to Appwrite Database!`);
      logActionRef.current('Cloud', 'DatabaseSync', 'Push', `Uploaded entire active ledger to database "${databaseId}" with 9 separate collections.`);
      showNotification('Success: Appwrite Database synced.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        `Failed to sync with Database: ${err.message || 'Unknown error'}. \n\n` + 
        `Tip: Verify that you ran the schema bootstrapping script:\n` +
        `  node scripts/bootstrap-db.js`
      );
    } finally {
      setLoading(false);
      isSyncing.current = false;
    }
  };

  return (
    <div className="relative inline-block text-left">
      {/* Mini connection status bar */}
      <button
        id="btn-appwrite-sync-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
          isConfigured 
            ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30 font-bold'
            : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/20'
        }`}
      >
        <Database className={`w-3.5 h-3.5 ${realtimeConnected ? 'animate-pulse text-emerald-400' : ''}`} />
        <span>Appwrite DB: {isConfigured ? realtimeConnected ? 'Live' : 'Connected' : 'Offline'}</span>
      </button>

      {isOpen && (
        <div id="appwrite-sync-popup" className="absolute right-0 mt-2 w-80 md:w-96 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl shadow-2xl z-50 p-4 space-y-4 animate-fade-in text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-sm tracking-tight text-white font-sans">Appwrite Database Sync</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white font-bold p-1 text-xs"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-850">
              <span className="text-slate-400">Database ID:</span>
              <span className="font-mono text-[10px] text-slate-300 font-bold">
                {databaseId}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-955 p-2 rounded-lg border border-slate-850">
              <span className="text-slate-400">Structure:</span>
              <span className="text-[10px] text-emerald-400 font-bold">
                Multi-Collection (9 tables)
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-955 p-2 rounded-lg border border-slate-850">
              <span className="text-slate-400">Endpoint:</span>
              <span className="font-mono text-[10px] text-slate-400 max-w-[180px] truncate" title={import.meta.env.VITE_APPWRITE_ENDPOINT}>
                {import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1'}
              </span>
            </div>
          </div>

          {isConfigured ? (
            <div className="space-y-3">
              {/* Connection Status panel */}
              <div className="bg-slate-955 p-3 rounded-lg border border-slate-850 space-y-1.5 text-left">
                <p className="font-bold text-[10px] text-slate-200">Database Sync Pipeline Active</p>
                <p className="text-[9px] text-slate-450 leading-normal">
                  All local ledger updates (trips, trucks, expenses) are saved to row-level documents instantly.
                </p>
                <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 bg-emerald-500/5 px-2 py-1.5 rounded border border-emerald-500/10 mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>{realtimeConnected ? "Realtime Socket Streams Active" : "Connecting realtime pipeline..."}</span>
                </div>
              </div>

              {isAdmin && (
                <div className="space-y-3 border-t border-slate-850 pt-2">
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Database ID</label>
                      <input 
                        type="text" 
                        value={databaseId}
                        onChange={(e) => setDatabaseId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      id="btn-appwrite-push"
                      disabled={loading}
                      onClick={handleManualPushToDB}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition cursor-pointer disabled:opacity-50"
                      title="Upload all local states to database (overwrites existing documents)"
                    >
                      {loading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Sync To DB
                    </button>
                    <button
                      id="btn-appwrite-pull"
                      disabled={loading}
                      onClick={() => handlePullFromDB(false)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold text-xs transition cursor-pointer disabled:opacity-50"
                      title="Fetch documents from Database and overwrite local state buffers"
                    >
                      {loading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                      Pull From DB
                    </button>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="bg-red-950/40 border border-red-500/20 p-2.5 rounded-lg text-red-200 text-[10px] leading-relaxed whitespace-pre-wrap animate-shake text-left">
                  <div className="flex gap-1.5 items-start">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-950/40 border border-emerald-500/20 p-2.5 rounded-lg text-emerald-200 text-[10px] leading-relaxed text-left">
                  <div className="flex gap-1.5 items-start">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                </div>
              )}

              <div className="text-center pt-1 border-t border-slate-850">
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="text-slate-400 hover:text-white inline-flex items-center gap-1 text-[10px] underline cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  {showGuide ? 'Hide Set Up Instructions' : 'How to set up Appwrite Database?'}
                </button>
              </div>

              {showGuide && (
                <div className="bg-slate-955/80 p-3 rounded-lg border border-slate-850 space-y-2 text-slate-400 text-[10px] leading-normal text-left">
                  <p className="font-bold text-slate-200">How to bootstrap database schemas automatically:</p>
                  <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-300">
                    <li>Create an API key in Appwrite Console (Project Settings -&gt; API Keys) with <code className="bg-slate-950 px-1 py-0.5 rounded text-blue-400 font-mono text-[9px]">databases.write</code> scope.</li>
                    <li>Open your terminal and run the setup script:
                      <pre className="bg-slate-950 p-1.5 rounded font-mono text-[9px] text-emerald-400 mt-1 select-all">node scripts/bootstrap-db.js</pre>
                    </li>
                    <li>Follow the prompt to enter your API key, and it will configure the Database and Collections automatically!</li>
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-950/40 border border-amber-500/20 p-3 rounded-lg space-y-2 text-amber-250 text-left">
              <div className="flex gap-1.5 items-start">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span className="font-bold">Appwrite parameters are missing!</span>
              </div>
              <p className="leading-relaxed text-[10px] text-slate-300">
                Ensure environment variables are configured in secrets:
              </p>
              <div className="bg-slate-950 font-mono p-2 text-[9px] rounded text-slate-400 space-y-1">
                <div>VITE_APPWRITE_PROJECT_ID="your_project_id"</div>
                <div>VITE_APPWRITE_ENDPOINT="your_endpoint"</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
