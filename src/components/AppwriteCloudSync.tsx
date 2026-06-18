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
    supportTickets: any[];
  };
  onLoadCloudState: (loadedState: any, userRightsData?: any, quiet?: boolean) => boolean;
  showNotification: (msg: string) => void;
  logAction: (action: string, model: string, identifier: string, description: string) => void;
  currentUserOrgId: string;
  currentUserEmail?: string;
  currentUserId: string;
  isAdmin: boolean;
  onInitialSyncComplete?: (completed: boolean) => void;
  onConnectionChange?: (isOnline: boolean, reason?: 'offline' | 'realtime_lost') => void;
  activeTicketId?: string | null;
  hideUI?: boolean;
}

export default function AppwriteCloudSync({
  currentLocalState,
  onLoadCloudState,
  showNotification,
  logAction,
  currentUserOrgId,
  currentUserEmail,
  currentUserId,
  isAdmin,
  onInitialSyncComplete,
  onConnectionChange,
  activeTicketId,
  hideUI
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
  const activeTicketIdRef = useRef(activeTicketId);
  useEffect(() => { activeTicketIdRef.current = activeTicketId; }, [activeTicketId]);

  const [initialPullDone, setInitialPullDone] = useState(false);
  const isSyncing = useRef(false);

  useEffect(() => {
    localStorage.setItem('appwrite_database_id', databaseId);
  }, [databaseId]);

  useEffect(() => {
    localStorage.setItem('appwrite_collection_id', collectionId);
  }, [collectionId]);

  const allowedCollectionsRef = useRef<string[]>(['trucks', 'drivers', 'offices', 'accounts', 'trips', 'expenses', 'tyres', 'audit_logs', 'support_tickets']);

  // Initial pull from Appwrite Database
  const handlePullFromDB = async (quiet = false) => {
    if (!isConfigured) return;
    if (!quiet) {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
    }

    try {
      if (!quiet) {
        console.log('Appwrite DB: Fetching fleet documents from multi-collection structure...');
      }

      const loadedState: any = {
        trucks: [],
        drivers: [],
        offices: [],
        accounts: [],
        trips: [],
        expenses: [],
        tyres: [],
        auditLogs: [],
        supportTickets: []
      };

      let userRightsData: any = null;
      let maxUpdatedAt = 0;
      const verifiedCollections: string[] = [];

      const categories: { key: keyof typeof loadedState; collection: string }[] = [
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

      const fetchPromises = categories.map(async (cat) => {
        try {
          const docs = await appwrite.listFleetDocuments(databaseId, cat.collection, orgId);
          verifiedCollections.push(cat.collection);
          
          for (const doc of docs) {
            if (doc.updatedAt) {
              const docTime = new Date(doc.updatedAt).getTime();
              if (docTime > maxUpdatedAt) {
                maxUpdatedAt = docTime;
              }
            }
          }
          loadedState[cat.key] = docs;
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
        } catch (e) {
          console.warn('Failed to load global rights config:', e);
        }
      })();

      await Promise.all([...fetchPromises, loadRightsPromise]);

      allowedCollectionsRef.current = verifiedCollections;

      if (maxUpdatedAt > 0) {
        loadedState.exportDate = maxUpdatedAt;
      }

      // Load state into local UI
      const didChange = onLoadCloudState(loadedState, userRightsData, quiet);

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

  // Listen for app gained focus (app returned from background/memory) to trigger checks
  useEffect(() => {
    const handleResume = () => {
      if (isConfigured) {
        console.log("App gained focus/returned from background, performing silent configuration sync...");
        handlePullFromDB(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('resume', handleResume);
    window.addEventListener('focus', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('resume', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  }, [isConfigured, databaseId, orgId]);

  // Real-Time Web Socket subscription using Appwrite real-time channel
  // Auto-reconnects with exponential backoff when the socket drops.
  useEffect(() => {
    if (!isConfigured || !initialPullDone) {
      setRealtimeConnected(false);
      return;
    }



    let unsubscribe: any = null;
    let destroyed = false;          // set true on useEffect cleanup
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectDelay = 5000;      // start at 5s, cap at 60s
    const MAX_DELAY = 60000;
    let disconnectCount = 0;

    const teardown = () => {
      if (unsubscribe) {
        try {
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          } else {
            const subAny = unsubscribe as any;
            if (typeof subAny.close === 'function') {
              subAny.close();
            } else if (typeof subAny.unsubscribe === 'function') {
              subAny.unsubscribe();
            }
          }
        } catch (_) { /* ignore close-state errors */ }
        unsubscribe = null;
      }
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
      }
    };

    const scheduleReconnect = () => {
      if (destroyed) return;
      setRealtimeConnected(false);
      if (onConnectionChange) onConnectionChange(false, 'realtime_lost');
      console.info(`Appwrite socket: reconnecting in ${reconnectDelay / 1000}s...`);
      reconnectTimer = setTimeout(() => {
        if (!destroyed) setupRealtime();
      }, reconnectDelay);
      // Exponential backoff capped at MAX_DELAY
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
    };

    const setupRealtime = async () => {
      if (destroyed) return;
      teardown(); // clean up any previous socket first

      try {
        await appwrite.initSession();
        const client = appwrite.getClient();

        const baseList = ['trucks', 'drivers', 'offices', 'accounts', 'trips', 'expenses', 'tyres', 'audit_logs', 'support_tickets']
          .filter(col => allowedCollectionsRef.current.includes(col));

        // 1. Verify access permissions on each collection dynamically before subscribing
        const verifiedCols: string[] = [];
        await Promise.all(baseList.map(async (col) => {
          try {
            await appwrite.listFleetDocuments(databaseId, col, orgId);
            verifiedCols.push(col);
          } catch (_) {
            // Collection is missing or unauthorized
          }
        }));

        if (orgId === 'org_backend') {
          try {
            await appwrite.listGlobalConfigs(databaseId);
            verifiedCols.push('global_configs');
          } catch (_) { }
        } else {
          verifiedCols.push('global_configs');
        }

        const colList = verifiedCols;

        if (colList.length === 0) {
          console.warn("Appwrite socket: No allowed collections to subscribe to. Realtime connection bypassed.");
          setRealtimeConnected(false);
          return;
        }
        const channels = colList.map(col => `databases.${databaseId}.collections.${col}.documents`);

        console.log(`Appwrite socket: Subscribing to authorized channels:`, channels);

        try {
          const subPromise = appwrite.getRealtime().subscribe(
            channels,
            (response: any) => {
              const doc = response.payload;
              const collectionId = doc.$collectionId;

              // We also check for policy errors from the message stream
              if (response.type === 'error' && response.code === 1008) {
                console.warn('Realtime policy violation error:', response);
              }

              // Check if document belongs to this organization (or global configs)
              if (collectionId !== 'global_configs' && orgId !== 'org_backend' && doc.organizationId !== orgId) {
                return;
              }

              console.log(`Appwrite realtime event: ${response.events[0]} on doc ${doc.$id} in ${collectionId}`);

              const eventType = response.events[0];

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
                    } else if (doc.$id === 'cfg_app_version') {
                      localStorage.removeItem('ttt_app_update_config');
                    }
                  } else {
                    const parsedItem = JSON.parse(doc.data);
                    const keyVal = doc.$id || doc.key || '';
                    if (keyVal.startsWith('usr_')) {
                      const idx = localRights.findIndex((r: any) => r.email.toLowerCase().trim() === parsedItem.email.toLowerCase().trim());
                      if (idx > -1) { localRights[idx] = parsedItem; } else { localRights.push(parsedItem); }
                    } else if (keyVal.startsWith('prf_')) {
                      if (parsedItem && parsedItem.organizationId) {
                        const idx = localProfiles.findIndex((p: any) => p.organizationId === parsedItem.organizationId);
                        if (idx > -1) { localProfiles[idx] = parsedItem; } else { localProfiles.push(parsedItem); }
                      }
                    } else if (keyVal === 'cfg_app_version') {
                      localStorage.setItem('ttt_app_update_config', doc.data);
                      if (typeof window !== 'undefined' && window.dispatchEvent) {
                        window.dispatchEvent(new CustomEvent('ttt_app_update_event', { detail: parsedItem }));
                      }
                    }
                  }
                  onLoadCloudStateRef.current({}, { userRightsList: localRights, organizationProfiles: localProfiles }, true);
                } catch (e) {
                  console.warn('Failed to parse realtime global config:', e);
                }
                return;
              }

              let key: 'trucks' | 'drivers' | 'offices' | 'accounts' | 'trips' | 'expenses' | 'tyres' | 'auditLogs' | 'supportTickets' | null = null;
              if (collectionId === 'trucks') key = 'trucks';
              else if (collectionId === 'drivers') key = 'drivers';
              else if (collectionId === 'offices') key = 'offices';
              else if (collectionId === 'accounts') key = 'accounts';
              else if (collectionId === 'trips') key = 'trips';
              else if (collectionId === 'expenses') key = 'expenses';
              else if (collectionId === 'tyres') key = 'tyres';
              else if (collectionId === 'audit_logs') key = 'auditLogs';
              else if (collectionId === 'support_tickets') key = 'supportTickets';

              if (!key) return;

              const currentState = currentLocalStateRef.current;
              const currentCollection = currentState[key] || [];
              let updatedCollection = [...currentCollection];

              if (eventType.endsWith('.delete')) {
                updatedCollection = updatedCollection.filter(x => x.id !== doc.$id);
              } else {
                try {
                  const parsedRecord = appwrite.reconstructRecord(doc);
                  const cloudVersion = parsedRecord.version ?? 1;
                  const cloudUpdatedBy = parsedRecord.updatedBy ?? '';

                  const localRecordIndex = updatedCollection.findIndex(x => x.id === doc.$id);
                  const localRecord = localRecordIndex > -1 ? updatedCollection[localRecordIndex] : null;
                  const localVersion = localRecord ? (localRecord.version ?? 1) : 0;

                  if (cloudVersion > localVersion) {
                    if (parsedRecord.deletedAt) {
                      // Cloud soft-deleted: remove locally
                      updatedCollection = updatedCollection.filter(x => x.id !== doc.$id);
                    } else {
                      // Cloud update wins
                      const nextRecord = { ...parsedRecord, syncState: 'synced' as const };

                       if (orgId === 'org_backend' && key === 'supportTickets') {
                        if (localRecordIndex === -1) {
                          if (parsedRecord.id !== activeTicketIdRef.current) {
                            showNotificationRef.current(`New Support Ticket #${parsedRecord.ticketNo}: "${parsedRecord.title}"`);
                          }
                        } else {
                          const oldMsgsCount = localRecord?.messages?.length || 0;
                          const newMsgs = parsedRecord.messages || [];
                          if (newMsgs.length > oldMsgsCount) {
                            const lastMsg = newMsgs[newMsgs.length - 1];
                            if (lastMsg && lastMsg.sender === 'User') {
                              if (parsedRecord.id !== activeTicketIdRef.current) {
                                showNotificationRef.current(`New message on Ticket #${parsedRecord.ticketNo} from ${parsedRecord.requesterName}`);
                              }
                            }
                          }
                        }
                      }

                      if (localRecordIndex > -1) {
                        updatedCollection[localRecordIndex] = nextRecord;
                      } else {
                        updatedCollection.push(nextRecord);
                      }
                    }
                  } else if (cloudVersion === localVersion) {
                    if (cloudUpdatedBy === currentUserId && localRecord?.syncState === 'pending') {
                      if (localRecord.deletedAt) {
                        // Confirmed soft delete: remove locally
                        updatedCollection = updatedCollection.filter(x => x.id !== doc.$id);
                      } else {
                        // Confirmed update: mark synced
                        localRecord.syncState = 'synced';
                      }
                    } else if (cloudUpdatedBy !== currentUserId && localRecord?.syncState === 'pending') {
                      console.warn(`Conflict detected for document ${doc.$id}. Same version ${cloudVersion} but updated by user: ${cloudUpdatedBy}`);
                      localRecord.syncState = 'conflict';
                    }
                  }
                } catch (e) {
                  console.warn('Failed to parse realtime data payload:', e);
                  return;
                }
              }

              // Call onLoadCloudStateRef with only the changed collection
              onLoadCloudStateRef.current({ [key]: updatedCollection }, null, true);
            }
          );

          subPromise.then(sub => {
            if (destroyed) {
              try {
                const subAny = sub as any;
                if (typeof subAny.close === 'function') {
                  subAny.close();
                } else if (typeof subAny.unsubscribe === 'function') {
                  subAny.unsubscribe();
                }
              } catch (_) { }
            } else {
              unsubscribe = sub;
              setRealtimeConnected(true);
              if (onConnectionChange) onConnectionChange(true);
              console.log('Appwrite realtime socket pipeline successfully established.');
            }
          });

          // Health-check: ping the socket every 15s and dynamically update UI connection state
          healthCheckInterval = setInterval(() => {
            if (destroyed) { if (healthCheckInterval) clearInterval(healthCheckInterval); return; }
            try {
              const ws = (appwrite.getRealtime() as any).socket;
              if (ws) {
                const isConnected = ws.readyState === WebSocket.OPEN;
                setRealtimeConnected(isConnected);
                if (onConnectionChange) onConnectionChange(isConnected, isConnected ? undefined : 'realtime_lost');
                
                if (isConnected) {
                  // Keep-alive ping frame
                  ws.send(JSON.stringify({ type: 'ping' }));
                }
              } else {
                setRealtimeConnected(false);
                if (onConnectionChange) onConnectionChange(false, 'realtime_lost');
              }
            } catch (_) { /* ignore */ }
          }, 15000);

        } catch (subErr: any) {
          if (subErr?.code !== 1008) {
            console.warn('Realtime channel subscription failed:', subErr?.message);
          }
        }
      } catch (err: any) {
        if (!err?.message?.includes('CLOSING') && !err?.message?.includes('CLOSED')) {
          console.warn('Realtime socket setup failed:', err?.message);
        }
      }
    };

    setupRealtime();

    return () => {
      destroyed = true;
      teardown();
    };
  }, [databaseId, isConfigured, orgId, initialPullDone, currentUserEmail]);


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
      { key: 'auditLogs', collection: 'audit_logs' },
      { key: 'supportTickets', collection: 'support_tickets' }
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

  if (hideUI) return null;

  return (
    <div className="relative inline-block text-left">
      {/* Mini connection status bar */}
      <button
        id="btn-appwrite-sync-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title={isConfigured ? (realtimeConnected ? "Cloud Synchronization Active & Connected" : "Cloud Synchronization Active (Reconnecting)") : "Offline Local Database Mode"}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${isConfigured
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
                {import.meta.env.VITE_APPWRITE_ENDPOINT}
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
