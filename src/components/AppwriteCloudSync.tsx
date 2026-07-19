import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { SyncService, wrapAbort } from '../services/SyncService';
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
} from 'lucide-solid';

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
  currentUserOrgId: () => string;
  currentUserEmail: () => string;
  currentUserId: () => string;
  isAdmin: () => boolean;
  onInitialSyncComplete?: (completed: boolean) => void;
  onConnectionChange?: (isOnline: boolean, reason?: 'offline' | 'realtime_lost') => void;
  activeTicketId?: () => string | null;
  hideUI?: boolean;
}

export default function AppwriteCloudSync(props: AppwriteCloudSyncProps) {
  const currentUserOrgId = () => props.currentUserOrgId();
  const currentUserEmail = () => props.currentUserEmail();
  const currentUserId = () => props.currentUserId();
  const isAdmin = () => props.isAdmin();
  
  const onLoadCloudState = props.onLoadCloudState;
  const showNotification = props.showNotification;
  const logAction = props.logAction;
  const onInitialSyncComplete = props.onInitialSyncComplete;
  const onConnectionChange = props.onConnectionChange;
  const hideUI = () => props.hideUI ?? false;

  const [isOpen, setIsOpen] = createSignal(false);
  const [isConfigured] = createSignal(isAppwriteConfigured());
  const [loading, setLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
  const [successMsg, setSuccessMsg] = createSignal<string | null>(null);
  const [showGuide, setShowGuide] = createSignal(false);

  const [databaseId, setDatabaseId] = createSignal(localStorage.getItem('appwrite_database_id') || 'fleet_db');
  const [collectionId, setCollectionId] = createSignal(localStorage.getItem('appwrite_collection_id') || 'fleet_records');

  const [realtimeConnected, setRealtimeConnected] = createSignal(true);
  const [isOnline, setIsOnline] = createSignal(true);
  const [initialPullDone, setInitialPullDone] = createSignal(false);

  let activeAbortController: AbortController | null = null;
  let allowedCollectionsRef = ['trucks', 'drivers', 'offices', 'accounts', 'trips', 'expenses', 'tyres', 'audit_logs', 'support_tickets'];

  const orgId = () => currentUserOrgId() || 'org_default';

  // 1. Monitor network status
  onMount(() => {
    console.log("CloudSyncManager mounted");
    const handleOnline = () => {
      setIsOnline(true);
      if (onConnectionChange) onConnectionChange(true);
      appwrite.flushSyncQueue(showNotification);
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (onConnectionChange) onConnectionChange(false, 'offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!window.navigator.onLine && onConnectionChange) {
      onConnectionChange(false, 'offline');
    }

    onCleanup(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  });

  // Save Configs to localStorage
  createEffect(() => localStorage.setItem('appwrite_database_id', databaseId()));
  createEffect(() => localStorage.setItem('appwrite_collection_id', collectionId()));

  // 2. Pull State from DB
  const handlePullFromDB = async (quiet = false, incremental = false) => {
    if (!isConfigured) return;
    if (activeAbortController) activeAbortController.abort();
    activeAbortController = new AbortController();
    const signal = activeAbortController.signal;

    if (!quiet) {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
    }

    try {
      const res = await SyncService.pullFromDB(databaseId(), orgId(), props.currentLocalState, incremental, signal);
      allowedCollectionsRef = res.verifiedCollections;
      const didChange = onLoadCloudState(res.loadedState, res.userRightsData, quiet);

      if (!quiet) {
        setSuccessMsg('Active registers successfully loaded from Appwrite Database!');
        showNotification(didChange ? 'Active buffers synchronized with Appwrite Database.' : 'Appwrite Database: Already up to date.');
      }
    } catch (err: any) {
      if (err.message === 'Aborted') return;
      console.error('Appwrite DB loading() failure:', err);
      if (!quiet) {
        setErrorMsg(`Database retrieval failed: ${err.message || 'Unknown error'}. \n\nBootstrap: node scripts/bootstrap-db.js`);
      }
    } finally {
      if (!quiet && !signal.aborted) setLoading(false);
    }
  };

  // 3. Initial pull and visibility listeners
  onMount(() => {
    if (isConfigured && !initialPullDone()) {
      handlePullFromDB(true, true).finally(() => {
        setInitialPullDone(true);
        if (onInitialSyncComplete) onInitialSyncComplete(true);
      });
      if (window.navigator.onLine) {
        appwrite.flushSyncQueue(showNotification);
      }
    }

    const handleResume = () => {
      if (isConfigured) {
        handlePullFromDB(true, true);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleResume();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('resume', handleResume);
    window.addEventListener('focus', handleResume);

    onCleanup(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('resume', handleResume);
      window.removeEventListener('focus', handleResume);
    });
  });

  // 4. Real-time web socket listener (Gateway Integration)
  createEffect(() => {
    if (!isConfigured || !initialPullDone()) {
      setRealtimeConnected(false);
      return;
    }

    let unsubscribe: any = null;
    let destroyed = false;
    let reconnectTimer: any = null;
    let healthCheckInterval: any = null;
    let reconnectDelay = 5000;
    const MAX_DELAY = 60000;

    const teardown = () => {
      if (unsubscribe) {
        try {
          if (typeof unsubscribe === 'function') unsubscribe();
          else unsubscribe.close?.();
        } catch (_) {}
        unsubscribe = null;
      }
      if (healthCheckInterval) clearInterval(healthCheckInterval);
    };

    const scheduleReconnect = () => {
      if (destroyed) return;
      setRealtimeConnected(false);
      if (onConnectionChange) onConnectionChange(false, 'realtime_lost');
      reconnectTimer = setTimeout(() => {
        if (!destroyed) setupRealtime();
      }, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
    };

    const setupRealtime = async () => {
      if (destroyed) return;
      teardown();
      try {
        await appwrite.initSession();
        const baseList = ['trucks', 'drivers', 'offices', 'accounts', 'trips', 'expenses', 'tyres', 'audit_logs', 'support_tickets']
          .filter(col => allowedCollectionsRef.includes(col));

        const verifiedCols: string[] = [];
        await Promise.all(baseList.map(async (col) => {
          try {
            await appwrite.listFleetDocuments(databaseId(), col, orgId());
            verifiedCols.push(col);
          } catch (_) {}
        }));

        if (orgId() === 'org_backend') {
          try {
            await appwrite.listGlobalConfigs(databaseId());
            verifiedCols.push('global_configs');
          } catch (_) {}
        } else {
          verifiedCols.push('global_configs');
        }

        if (verifiedCols.length === 0) {
          setRealtimeConnected(false);
          return;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const gatewayUrl = `${wsProtocol}//${window.location.host}/realtime?orgId=${orgId()}&email=${currentUserEmail() || ''}&isSuperAdmin=${isAdmin() || false}`;
        const socket = new WebSocket(gatewayUrl);
        unsubscribe = { close: () => socket.close() };

        socket.onopen = () => {
          setRealtimeConnected(true);
          if (onConnectionChange) onConnectionChange(true);
        };

        socket.onmessage = (msg) => {
          try {
            const response = JSON.parse(msg.data);
            const doc = response.payload;
            if (!doc) return;

            const eventCollectionId = doc.$collectionId || doc.collectionId || '';
            const eventType = response.events[0] || '';

            if (eventCollectionId !== 'global_configs' && orgId() !== 'org_backend' && doc.organizationId !== orgId()) {
              return;
            }

            if (eventCollectionId === 'global_configs') {
              const storedRights = localStorage.getItem('ttt_user_rights');
              const storedProfiles = localStorage.getItem('ttt_organization_profiles');
              let localRights = storedRights ? JSON.parse(storedRights) : [];
              let localProfiles = storedProfiles ? JSON.parse(storedProfiles) : [];

              if (eventType.endsWith('.delete')) {
                if (doc.$id.startsWith('usr_')) {
                  localRights = localRights.filter((r: any) => appwrite.getEmailDocId(r.email) !== doc.$id);
                } else if (doc.$id.startsWith('prf_')) {
                  const orgIdVal = doc.$id.replace('prf_', '');
                  localProfiles = localProfiles.filter((p: any) => p.organizationId !== orgIdVal);
                } else if (doc.$id === 'cfg_app_version') {
                  localStorage.removeItem('ttt_app_update_config');
                }
              } else {
                const parsedItem = JSON.parse(doc.data);
                const keyVal = doc.$id || '';
                if (keyVal.startsWith('usr_')) {
                  const idx = localRights.findIndex((r: any) => r.email.toLowerCase().trim() === parsedItem.email.toLowerCase().trim());
                  if (idx > -1) localRights[idx] = parsedItem; else localRights.push(parsedItem);
                } else if (keyVal.startsWith('prf_')) {
                  if (parsedItem && parsedItem.organizationId) {
                    const idx = localProfiles.findIndex((p: any) => p.organizationId === parsedItem.organizationId);
                    if (idx > -1) localProfiles[idx] = parsedItem; else localProfiles.push(parsedItem);
                  }
                } else if (keyVal === 'cfg_app_version') {
                  localStorage.setItem('ttt_app_update_config', doc.data);
                  window.dispatchEvent(new CustomEvent('ttt_app_update_event', { detail: parsedItem }));
                }
              }
              onLoadCloudState({}, { userRightsList: localRights, organizationProfiles: localProfiles }, true);
              return;
            }

            let key: any = null;
            if (eventCollectionId === 'trucks') key = 'trucks';
            else if (eventCollectionId === 'drivers') key = 'drivers';
            else if (eventCollectionId === 'offices') key = 'offices';
            else if (eventCollectionId === 'accounts') key = 'accounts';
            else if (eventCollectionId === 'trips') key = 'trips';
            else if (eventCollectionId === 'expenses') key = 'expenses';
            else if (eventCollectionId === 'tyres') key = 'tyres';
            else if (eventCollectionId === 'audit_logs') key = 'auditLogs';
            else if (eventCollectionId === 'support_tickets') key = 'supportTickets';

            if (!key) return;

            const currentCollection = props.currentLocalState[key] || [];
            let updatedCollection = [...currentCollection];

            if (eventType.endsWith('.delete')) {
              updatedCollection = updatedCollection.filter(x => x.id !== doc.$id);
            } else {
              const parsedRecord = appwrite.reconstructRecord(doc);
              const cloudVersion = parsedRecord.version ?? 1;
              const cloudUpdatedBy = parsedRecord.updatedBy ?? '';

              const localRecordIndex = updatedCollection.findIndex(x => x.id === doc.$id);
              const localRecord = localRecordIndex > -1 ? updatedCollection[localRecordIndex] : null;
              const localVersion = localRecord ? (localRecord.version ?? 1) : 0;

              if (cloudVersion > localVersion) {
                if (parsedRecord.deletedAt) {
                  updatedCollection = updatedCollection.filter(x => x.id !== doc.$id);
                } else {
                  const nextRecord = { ...parsedRecord, syncState: 'synced' as const };
                  if (orgId() === 'org_backend' && key === 'supportTickets') {
                    if (localRecordIndex === -1) {
                      if (parsedRecord.id !== (props.activeTicketId ? props.activeTicketId() : null)) {
                        showNotification(`New Support Ticket #${parsedRecord.ticketNo}: "${parsedRecord.title}"`);
                      }
                    } else {
                      const oldMsgsCount = localRecord?.messages?.length || 0;
                      const newMsgs = parsedRecord.messages || [];
                      if (newMsgs.length > oldMsgsCount) {
                        const lastMsg = newMsgs[newMsgs.length - 1];
                        if (lastMsg && lastMsg.sender === 'User' && parsedRecord.id !== (props.activeTicketId ? props.activeTicketId() : null)) {
                          showNotification(`New message on Ticket #${parsedRecord.ticketNo} from ${parsedRecord.requesterName}`);
                        }
                      }
                    }
                  }
                  if (localRecordIndex > -1) updatedCollection[localRecordIndex] = nextRecord; else updatedCollection.push(nextRecord);
                }
              } else if (cloudVersion === localVersion) {
                if (cloudUpdatedBy === currentUserId() && localRecord?.syncState === 'pending') {
                  if (localRecord.deletedAt) updatedCollection = updatedCollection.filter(x => x.id !== doc.$id);
                  else localRecord.syncState = 'synced';
                } else if (cloudUpdatedBy !== currentUserId() && localRecord?.syncState === 'pending') {
                  localRecord.syncState = 'conflict';
                }
              }
            }
            onLoadCloudState({ [key]: updatedCollection }, null, true);
          } catch (err: any) {
            console.warn("Realtime parse error:", err.message);
          }
        };

        socket.onclose = () => {
          if (!destroyed) {
            setRealtimeConnected(false);
            if (onConnectionChange) onConnectionChange(false);
            scheduleReconnect();
          }
        };

        socket.onerror = () => socket.close();

        healthCheckInterval = setInterval(() => {
          if (destroyed) return;
          try {
            const isConnected = socket.readyState === WebSocket.OPEN;
            setRealtimeConnected(isConnected);
            if (onConnectionChange) onConnectionChange(isConnected, isConnected ? undefined : 'realtime_lost');
            if (isConnected) socket.send(JSON.stringify({ type: 'ping' }));
          } catch (_) {}
        }, 25000);

      } catch (wsErr) {
        console.warn("Gateway error:", wsErr);
      }
    };

    setupRealtime();

    onCleanup(() => {
      destroyed = true;
      teardown();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    });
  });

  const handleManualPushToDB = async () => {
    if (!isConfigured) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const pushedCount = await SyncService.pushAllLocalToDB(databaseId(), orgId(), props.currentLocalState);
      setSuccessMsg(`Successfully uploaded ${pushedCount} records to Appwrite Database!`);
      logAction('Cloud', 'DatabaseSync', 'Push', `Uploaded entire active ledger to database "${databaseId()}".`);
      showNotification('Success: Appwrite Database synced.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to sync: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (hideUI()) return null;

  return (
    <div class="relative inline-block text-left">
      <button
        id="btn-appwrite-sync-trigger"
        onClick={() => setIsOpen(!isOpen())}
        class={`p-2 rounded-lg border transition duration-150 relative cursor-pointer flex items-center justify-center shrink-0 ${
          !isOnline()
            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20'
            : !realtimeConnected()
            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse'
            : 'bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/20'
        }`}
        title={
          !isOnline()
            ? 'Device Offline (Cloud Sync Paused)'
            : !realtimeConnected()
            ? 'Realtime Gateway Offline (Reconnecting...)'
            : 'Realtime Sync Active'
        }
      >
        <Cloud class="w-4 h-4" />
        <span class={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full border border-white dark:border-slate-900 ${
          !isOnline() ? 'bg-rose-500' : !realtimeConnected() ? 'bg-amber-500' : 'bg-green-500'
        }`} />
      </button>

      {isOpen() && (
        <div class="origin-top-right absolute right-0 mt-2 w-72 md:w-80 rounded-xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 z-50 p-4 space-y-4 animate-fade-in text-left font-sans">
          <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
            <span class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Database class="w-3.5 h-3.5 text-blue-500" />
              Cloud Configuration
            </span>
            <button
              onClick={() => setIsOpen(false)}
              class="text-slate-400 dark:text-slate-500 hover:text-slate-655 dark:hover:text-slate-350 text-xs p-1 font-bold"
            >
              ✕
            </button>
          </div>

          <div class="space-y-3.5">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Database ID</label>
              <input
                type="text"
                value={databaseId()}
                onInput={(e) => setDatabaseId(e.currentTarget.value)}
                class="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Collection ID</label>
              <input
                type="text"
                value={collectionId()}
                onInput={(e) => setCollectionId(e.currentTarget.value)}
                class="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <div class="pt-1 flex flex-col gap-2">
              <button
                onClick={() => handlePullFromDB(false, false)}
                disabled={loading()}
                class="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-750 text-white rounded-lg text-xs font-bold transition duration-150 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loading() ? <Loader class="w-3.5 h-3.5 animate-spin" /> : <RefreshCw class="w-3.5 h-3.5" />}
                <span>Fetch from Cloud</span>
              </button>

              {isAdmin() && (
                <button
                  onClick={handleManualPushToDB}
                  disabled={loading()}
                  class="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition duration-150 border border-slate-200 dark:border-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  <Cloud class="w-3.5 h-3.5 text-blue-500" />
                  <span>Push Local State to Cloud</span>
                </button>
              )}
            </div>
          </div>

          {errorMsg() && (
            <div class="p-3 bg-red-500/10 border border-red-500/25 rounded-xl flex gap-2.5 text-xs text-red-655 dark:text-red-400 max-h-40 overflow-y-auto">
              <AlertCircle class="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <p class="whitespace-pre-line leading-relaxed font-medium">{errorMsg()}</p>
            </div>
          )}

          {successMsg() && (
            <div class="p-3 bg-green-500/10 border border-green-500/25 rounded-xl flex gap-2.5 text-xs text-green-655 dark:text-green-400">
              <CheckCircle class="w-4 h-4 shrink-0 text-green-500 mt-0.5" />
              <p class="leading-relaxed font-medium">{successMsg()}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
