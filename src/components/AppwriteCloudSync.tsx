import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { pushNotificationService } from '../services/pushNotificationService';
import { SyncService, wrapAbort, SyncStateData } from '../services/SyncService';
import { dbUnlocked } from '../services/cache';
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
  currentLocalState: (() => SyncStateData) | SyncStateData;
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

  const getCurrentCollection = (key: string): any[] => {
    const state = typeof props.currentLocalState === 'function' ? props.currentLocalState() : props.currentLocalState;
    const col = state ? state[key] : [];
    return typeof col === 'function' ? col() : (Array.isArray(col) ? col : []);
  };
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

  const [realtimeConnected, setRealtimeConnected] = createSignal(
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
  );
  const [isOnline, setIsOnline] = createSignal(true);
  const [initialPullDone, setInitialPullDone] = createSignal(false);

  let activeAbortController: AbortController | null = null;
  let allowedCollectionsRef = ['trucks', 'drivers', 'offices', 'accounts', 'trips', 'expenses', 'tyres', 'audit_logs', 'support_tickets', 'coupons'];

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

  let isPulling = false;

  // 2. Pull State from DB
  const handlePullFromDB = async (quiet = false, incremental = false) => {
    if (!isConfigured) return;
    if (isPulling) {
      return;
    }

    isPulling = true;

    if (!quiet) {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
    }

    try {
      console.log(`[AppwriteCloudSync] Starting handlePullFromDB (quiet=${quiet}, incremental=${incremental})...`);
      const currentState = typeof props.currentLocalState === 'function' ? props.currentLocalState() : props.currentLocalState;
      const res = await SyncService.pullFromDB(databaseId(), orgId(), currentState, incremental);
      allowedCollectionsRef = res.verifiedCollections;
      console.log(`[AppwriteCloudSync] pullFromDB finished. Loaded collections:`, Object.keys(res.loadedState || {}));
      const didChange = onLoadCloudState(res.loadedState, res.userRightsData, quiet);
      console.log(`[AppwriteCloudSync] onLoadCloudState returned didChange=${didChange}`);

      if (!quiet) {
        setSuccessMsg('Active registers successfully loaded from Appwrite Database!');
        showNotification(didChange ? 'Active buffers synchronized with Appwrite Database.' : 'Appwrite Database: Already up to date.');
      }
    } catch (err: any) {
      console.error('handlePullFromDB failed:', err);
      const isForbidden = err.message && (err.message.includes('403') || err.message.includes('Forbidden') || err.message.includes('permission'));
      if (isForbidden) {
        showNotification('Your organization access has been revoked by the Administrator.');
        localStorage.removeItem('ttt_user_rights');
        localStorage.removeItem('ttt_organization_profiles');
        localStorage.removeItem('ttt_trips');
        localStorage.removeItem('ttt_trucks');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else if (!quiet) {
        setErrorMsg(`Database retrieval failed: ${err.message || 'Unknown error'}. \n\nBootstrap: node scripts/bootstrap-db.js`);
      }
    } finally {
      isPulling = false;
      if (!quiet) setLoading(false);
    }
  };

  // 3. Initial pull and visibility listeners (Instant Offline-First Boot + Version Check)
  createEffect(() => {
    if (!dbUnlocked()) return;
    if (isConfigured && !initialPullDone()) {
      setInitialPullDone(true);
      if (onInitialSyncComplete) onInitialSyncComplete(true);

      const currentState = typeof props.currentLocalState === 'function' ? props.currentLocalState() : props.currentLocalState;
      const hasLocalData = (currentState?.trucks && currentState.trucks.length > 0) ||
                           (currentState?.trips && currentState.trips.length > 0) ||
                           (currentState?.drivers && currentState.drivers.length > 0);

      const localLastModified = Number(localStorage.getItem('ttt_last_modified_at') || '0');

      if (!hasLocalData) {
        handlePullFromDB(true, false);
      } else {
        // Fast 10ms version check: compare local timestamp with server timestamp
        appwrite.checkDatabaseVersion(orgId(), localLastModified).then(v => {
          if (!v.isUpToDate) {
            console.log(`[AppwriteCloudSync] Cloud server has newer changes (server: ${v.serverLastModified}, local: ${localLastModified}). Syncing delta...`);
            handlePullFromDB(true, true);
          } else {
            console.log('[AppwriteCloudSync] Fast Boot: Local IndexedDB up to date (0 requests needed). Relying on WebSocket Realtime.');
          }
        }).catch(() => {});
      }

      if (window.navigator.onLine) {
        appwrite.flushSyncQueue(showNotification);
      }
    }
  });

  onMount(() => {
    // Rely exclusively on WebSocket realtime connection instead of page focus re-fetches
  });

  // 5. INSTANT support ticket sync on message send (event-triggered)
  const triggerSupportTicketSync = async () => {
    if (!isConfigured || !initialPullDone()) return;
    
    try {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      const docs = await appwrite.listFleetDocuments(databaseId, 'support_tickets', orgId());
      if (Array.isArray(docs)) {
        const supportTickets = docs.map(doc => appwrite.reconstructRecord(doc));
        onLoadCloudState({ supportTickets }, null, true);
      }
    } catch (err: any) {
      console.warn('triggerSupportTicketSync error:', err.message || err);
    }
  };

  // Expose trigger function globally for message send to call
  if (typeof window !== 'undefined') {
    (window as any)._triggerSupportTicketSync = triggerSupportTicketSync;
  }
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
        const verifiedCols = ['trucks', 'drivers', 'offices', 'accounts', 'trips', 'expenses', 'tyres', 'audit_logs', 'support_tickets', 'global_configs'];

        console.log(`[Appwrite Realtime] Subscribing to WebSocket channels for ${verifiedCols.length} collections...`);
        const channels = verifiedCols.map(col =>
          `databases.${databaseId()}.collections.${col}.documents`
        );
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const jwt = await appwrite.createSessionJwt();
        const gatewayUrl = `${wsProtocol}//${window.location.host}/realtime`;
        const socket = new WebSocket(gatewayUrl);
        unsubscribe = { close: () => socket.close() };

        socket.onopen = () => {
          console.log('[CHAT SYNC] WebSocket connected, sending authentication...');
          socket.send(JSON.stringify({ type: 'authenticate', jwt }));
          setRealtimeConnected(true);
          if (onConnectionChange) onConnectionChange(true);
        };

        socket.onmessage = (msg) => {
          try {
            const response = JSON.parse(msg.data);
            
            // Log authentication response
            if (response.type === 'authentication') {
              console.log('[CHAT SYNC] WebSocket authenticated successfully');
            }

            const doc = response.payload;
            if (!doc) {
              // Still log non-payload messages for debugging
              if (response.type && response.type !== 'ping' && response.type !== 'pong') {
                console.log('[CHAT SYNC] Received message type:', response.type);
              }
              return;
            }

            const eventStr = (response.events && response.events[0]) ? response.events[0] : '';
            const eventCollectionId = doc.$collectionId || doc.collectionId || (eventStr.includes('.collections.') ? eventStr.split('.collections.')[1].split('.')[0] : '');
            const eventType = response.events[0] || '';

            const isSupportTicket = eventCollectionId === 'support_tickets';
            const isGlobalConfig = eventCollectionId === 'global_configs';
            const matchesOrg = orgId() === 'org_backend' ||
              doc.organizationId === orgId() ||
              doc.organizationId === 'org_default' ||
              doc.organizationId === 'global' ||
              !doc.organizationId ||
              (isSupportTicket && doc.requesterEmail?.toLowerCase().trim() === currentUserEmail().toLowerCase().trim());

            if (!isGlobalConfig && !isSupportTicket && !matchesOrg) {
              console.log('[CHAT SYNC] Event filtered out: collection=' + eventCollectionId + ', orgMatch=' + matchesOrg);
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

            // Trigger system push notification if tab is hidden/minimized
            if (typeof document !== 'undefined' && document.hidden) {
              if (isSupportTicket) {
                const ticketSubj = doc.subject || 'Support Ticket Update';
                pushNotificationService.sendNotification(
                  `Support Ticket: ${ticketSubj}`,
                  'New response or ticket status change received.',
                  { url: '/console/dashboard' }
                );
              }
            }

            const currentCollection = getCurrentCollection(key);
            let updatedCollection = [...currentCollection];

            const docIdentifier = doc.$id || doc.id;

            if (eventType.endsWith('.delete')) {
              const targetId = doc.$id || doc.id;
              updatedCollection = updatedCollection.filter(x => x.id !== targetId);
            } else {
              const parsedRecord = appwrite.reconstructRecord(doc);
              const targetId = parsedRecord.id || doc.$id || doc.id;
              const cloudVersion = parsedRecord.version ?? 1;
              const cloudUpdatedBy = parsedRecord.updatedBy ?? '';

              const localRecordIndex = updatedCollection.findIndex(x => 
                x.id === targetId || 
                (key === 'trucks' && x.truckNo && parsedRecord.truckNo && x.truckNo.toUpperCase().trim() === parsedRecord.truckNo.toUpperCase().trim() && x.organizationId === parsedRecord.organizationId)
              );
              const localRecord = localRecordIndex > -1 ? updatedCollection[localRecordIndex] : null;
              const localVersion = localRecord ? (localRecord.version ?? 1) : 0;
              const isSupportTicketUpdate = key === 'supportTickets';

              if (isSupportTicketUpdate) {
                console.log('[CHAT SYNC] Realtime support ticket update received:', { ticketId: targetId, cloudVersion, localVersion, msgCount: parsedRecord.messages?.length });
              }

              if (cloudVersion > localVersion || isSupportTicketUpdate) {
                if (parsedRecord.deletedAt) {
                  updatedCollection = updatedCollection.filter(x => x.id !== targetId);
                } else {
                  const nextRecord = { ...parsedRecord, syncState: 'synced' as const };
                  if (isSupportTicketUpdate) {
                    if (localRecordIndex === -1) {
                      console.log('[CHAT SYNC] New support ticket received via realtime:', targetId);
                      if (targetId !== (props.activeTicketId ? props.activeTicketId() : null)) {
                        showNotification(`New Support Ticket #${parsedRecord.ticketNo}: "${parsedRecord.title}"`);
                      }
                    } else {
                      const oldMsgsCount = localRecord?.messages?.length || 0;
                      const newMsgs = parsedRecord.messages || [];
                      if (newMsgs.length > oldMsgsCount) {
                        console.log('[CHAT SYNC] New messages received via realtime:', { ticketId: targetId, oldCount: oldMsgsCount, newCount: newMsgs.length });
                        const lastMsg = newMsgs[newMsgs.length - 1];
                        if (lastMsg && lastMsg.sender === 'User' && targetId !== (props.activeTicketId ? props.activeTicketId() : null)) {
                          showNotification(`New message on Ticket #${parsedRecord.ticketNo} from ${parsedRecord.requesterName}`);
                        } else if (lastMsg && lastMsg.sender === 'Agent') {
                          showNotification(`New agent response on Ticket #${parsedRecord.ticketNo}`);
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
              } else if (cloudVersion === localVersion && !isSupportTicketUpdate) {
                if (cloudUpdatedBy === currentUserId() && localRecord?.syncState === 'pending') {
                  if (localRecord.deletedAt) updatedCollection = updatedCollection.filter(x => x.id !== targetId);
                  else localRecord.syncState = 'synced';
                } else if (cloudUpdatedBy !== currentUserId() && localRecord?.syncState === 'pending') {
                  localRecord.syncState = 'conflict';
                }
              }
            }
            if (key === 'supportTickets') {
              console.log('[CHAT SYNC] Applying realtime update to supportTickets, new count:', updatedCollection.length);
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
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
          setRealtimeConnected(true);
        }
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
      const currentState = typeof props.currentLocalState === 'function' ? props.currentLocalState() : props.currentLocalState;
      const pushedCount = await SyncService.pushAllLocalToDB(databaseId(), orgId(), currentState);
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
            : 'Cloud Synchronization Active & Connected'
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
