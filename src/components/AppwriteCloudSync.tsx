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
  activeTicketId
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
  const [disableRealtime, setDisableRealtime] = useState(() => {
    return localStorage.getItem('appwrite_disable_realtime') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('appwrite_disable_realtime', disableRealtime ? 'true' : 'false');
  }, [disableRealtime]);

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
    supportTickets: any[];
  }>({
    trucks: [],
    drivers: [],
    offices: [],
    accounts: [],
    trips: [],
    expenses: [],
    tyres: [],
    auditLogs: [],
    supportTickets: []
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
        auditLogs: [],
        supportTickets: []
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
      auditLogs: (state.auditLogs || []).filter(l => orgId === 'org_backend' || l.organizationId === orgId),
      supportTickets: (state.supportTickets || []).filter(st => orgId === 'org_backend' || st.organizationId === orgId)
    });
  };

  const stateFingerprint = getScopedFingerprint(currentLocalState);
  const previousFingerprint = useRef(stateFingerprint);

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
              const keyVal = doc.key || doc.$id || '';
              if (keyVal.startsWith('usr_')) {
                userRightsData.userRightsList.push(parsed);
              } else if (keyVal.startsWith('prf_')) {
                if (parsed && parsed.organizationId) {
                  userRightsData.organizationProfiles.push(parsed);
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
        auditLogs: loadedState.auditLogs.filter((l: any) => orgId === 'org_backend' || l.organizationId === orgId),
        supportTickets: loadedState.supportTickets.filter((st: any) => orgId === 'org_backend' || st.organizationId === orgId)
      };

      // Load state into local UI
      const didChange = onLoadCloudState(loadedState, userRightsData, quiet);

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
      { key: 'auditLogs', collection: 'audit_logs' },
      { key: 'supportTickets', collection: 'support_tickets' }
    ];

    try {
      let changeDetected = false;
      let localStateNeedsPurge = false;

      const nextState = {
        trucks: [...currentState.trucks],
        drivers: [...currentState.drivers],
        offices: [...currentState.offices],
        accounts: [...currentState.accounts],
        trips: [...currentState.trips],
        expenses: [...currentState.expenses],
        tyres: [...currentState.tyres],
        auditLogs: [...currentState.auditLogs],
        supportTickets: [...(currentState.supportTickets || [])]
      };

      for (const cat of categories) {
        const currentList = (currentState[cat.key] || []).filter(x => orgId === 'org_backend' || x.organizationId === orgId);
        const baselineList = baseline[cat.key] || [];

        // 1. Find Created & Updated documents
        for (const item of currentList) {
          // If soft-deleted locally, push physical deletion to Appwrite
          if (item.deletedAt) {
            console.log(`Appwrite DB [Delta Sync]: Deleting (soft-deleted locally) doc for ${cat.collection} (${item.id})`);
            try {
              await appwrite.deleteFleetDocument(databaseId, cat.collection, item.id);
              nextState[cat.key] = (nextState[cat.key] as any[]).filter(x => x.id !== item.id);
              localStateNeedsPurge = true;
              changeDetected = true;
            } catch (err: any) {
              console.warn(`Failed to push deletion for ${item.id}:`, err.message);
            }
            continue;
          }

          const baseItem = baselineList.find(b => b.id === item.id);
          const baseVersion = baseItem ? (baseItem.version ?? 1) : 0;
          const currentVersion = item.version ?? 1;

          if (!baseItem) {
            // Created item
            console.log(`Appwrite DB [Delta Sync]: Creating doc for ${cat.collection} (${item.id})`);
            const targetOrgId = orgId === 'org_backend' ? (item.organizationId || orgId) : orgId;
            await appwrite.saveFleetDocument(databaseId, cat.collection, item.id, targetOrgId, item);
            changeDetected = true;
          } else if (currentVersion > baseVersion) {
            // Updated item
            console.log(`Appwrite DB [Delta Sync]: Updating doc for ${cat.collection} (${item.id})`);
            const targetOrgId = orgId === 'org_backend' ? (item.organizationId || orgId) : orgId;
            await appwrite.saveFleetDocument(databaseId, cat.collection, item.id, targetOrgId, item);
            changeDetected = true;
          }
        }

        // 2. Find Deleted documents fallback (hard deletions)
        for (const baseItem of baselineList) {
          if (orgId !== 'org_backend' && baseItem.organizationId && baseItem.organizationId !== orgId) {
            continue;
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

        if (localStateNeedsPurge) {
          onLoadCloudStateRef.current(nextState, null, true);
        }

        // Update baseline with next/purged state
        const nextBaselineState = localStateNeedsPurge ? nextState : currentState;
        baselineStateRef.current = {
          trucks: (nextBaselineState.trucks || []).filter(t => orgId === 'org_backend' || t.organizationId === orgId),
          drivers: (nextBaselineState.drivers || []).filter(d => orgId === 'org_backend' || d.organizationId === orgId),
          offices: (nextBaselineState.offices || []).filter(o => orgId === 'org_backend' || o.organizationId === orgId),
          accounts: (nextBaselineState.accounts || []).filter(a => orgId === 'org_backend' || a.organizationId === orgId),
          trips: (nextBaselineState.trips || []).filter(t => orgId === 'org_backend' || t.organizationId === orgId),
          expenses: (nextBaselineState.expenses || []).filter(e => orgId === 'org_backend' || e.organizationId === orgId),
          tyres: (nextBaselineState.tyres || []).filter(t => orgId === 'org_backend' || t.organizationId === orgId),
          auditLogs: (nextBaselineState.auditLogs || []).filter(l => orgId === 'org_backend' || l.organizationId === orgId),
          supportTickets: (nextBaselineState.supportTickets || []).filter(st => orgId === 'org_backend' || st.organizationId === orgId)
        };
      }

      previousFingerprint.current = getScopedFingerprint(localStateNeedsPurge ? nextState : currentState);
    } catch (e: any) {
      console.warn("Appwrite Database auto-push failed:", e.message);
    } finally {
      isSyncing.current = false;
    }
  };

  // Delta-push engine: fires whenever local state diverges from the last-synced baseline
  useEffect(() => {
    if (!isConfigured || !initialPullDone) return;
    if (stateFingerprint === previousFingerprint.current) return;
    // Local state changed — push deltas to Appwrite
    syncLocalToDatabase();
  }, [stateFingerprint, isConfigured, initialPullDone]);

  // Real-Time Web Socket subscription using Appwrite real-time channel
  // Auto-reconnects with exponential backoff when the socket drops.
  useEffect(() => {
    if (!isConfigured || !initialPullDone) {
      setRealtimeConnected(false);
      return;
    }

    if (disableRealtime) {
      console.info("Appwrite Sync: Realtime WebSocket disabled by user. Falling back to REST polling.");
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
        }

        const colList = verifiedCols;

        if (colList.length === 0) {
          console.warn("Appwrite socket: No allowed collections to subscribe to. Realtime connection bypassed.");
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
          }
          setRealtimeConnected(false);
          return;
        }
        const channels = colList.map(col => `databases.${databaseId}.collections.${col}.documents`);
        if (orgId !== 'org_backend' && currentUserEmail) {
          const myUserDocId = appwrite.getEmailDocId(currentUserEmail);
          const myOrgDocId = appwrite.getOrgDocId(orgId);
          channels.push(`databases.${databaseId}.collections.global_configs.documents.${myUserDocId}`);
          channels.push(`databases.${databaseId}.collections.global_configs.documents.${myOrgDocId}`);
        }
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
                  const parsedRecord = JSON.parse(doc.data);
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

              // Update the baseline for ONLY this collection
              baselineStateRef.current = {
                ...baselineStateRef.current,
                [key]: updatedCollection.filter(x => orgId === 'org_backend' || x.organizationId === orgId)
              };

              // Call onLoadCloudStateRef with only the changed collection
              onLoadCloudStateRef.current({ [key]: updatedCollection }, null, true);

              // Update previousFingerprint
              const nextFingerprintState = {
                ...currentState,
                [key]: updatedCollection
              };
              previousFingerprint.current = getScopedFingerprint(nextFingerprintState);
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
              // Reset backoff on successful connect
              reconnectDelay = 5000;
              setRealtimeConnected(true);
              if (onConnectionChange) onConnectionChange(true);
              console.log('Appwrite realtime socket pipeline successfully established.');
              
              // Reset disconnect count only if connection remains stable for 5 seconds
              setTimeout(() => {
                if (!destroyed && unsubscribe) {
                  disconnectCount = 0;
                }
              }, 5000);
            }
          });

          // Setup error recovery listener by waiting for the socket instance to instantiate
          let attachAttempts = 0;
          const attachInterval = setInterval(() => {
            const wsInstance = (appwrite.getRealtime() as any).socket;
            if (wsInstance) {
              clearInterval(attachInterval);
              const handleSocketClose = (event: CloseEvent) => {
                disconnectCount++;
                console.warn(`Appwrite socket closed (code: ${event.code}). Total disconnects: ${disconnectCount}`);
                
                if (event.code === 1008 || disconnectCount >= 3) {
                  console.warn('Appwrite socket: Persistent connection issues or policy violation detected. Bypassing Realtime and falling back to REST/Polling.');
                  teardown();
                  if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                  }
                  setRealtimeConnected(false);
                  if (onConnectionChange) onConnectionChange(true);
                } else {
                  setRealtimeConnected(false);
                }
              };

              const handleSocketMessage = (event: MessageEvent) => {
                try {
                  const payload = JSON.parse(event.data);
                  if (payload.data?.code === 1008 || payload.code === 1008 || (payload.type === 'error' && payload.data?.code === 1008)) {
                    console.warn('Appwrite socket: Received async policy error message 1008. This usually means either collections are empty (document-level permissions) or cross-origin session cookies are blocked. Bypassing Realtime and falling back to REST/Polling.');
                    teardown();
                    if (reconnectTimer) {
                      clearTimeout(reconnectTimer);
                      reconnectTimer = null;
                    }
                    // Mute the connection modal by marking it cleanly as bypassed rather than lost
                    setRealtimeConnected(false);
                    // Silently propagate that online REST mode is functional
                    if (onConnectionChange) onConnectionChange(true);
                  }
                } catch (_) { }
              };

              const handleSocketError = (err: Event) => {
                console.warn('Appwrite socket error event:', err);
                setRealtimeConnected(false);
              };

              wsInstance.addEventListener('close', handleSocketClose);
              wsInstance.addEventListener('message', handleSocketMessage);
              wsInstance.addEventListener('error', handleSocketError);
            }
            if (++attachAttempts > 50) clearInterval(attachInterval); // timeout after 5 seconds
          }, 100);

          // Health-check: ping the socket every 30s — if it's dead, reconnect
          healthCheckInterval = setInterval(() => {
            if (destroyed) { if (healthCheckInterval) clearInterval(healthCheckInterval); return; }
            try {
              // Attempt to get the underlying WebSocket state via Appwrite client internals
              const ws = (appwrite.getRealtime() as any).socket;
              if (ws && (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED)) {
                console.info('Appwrite socket: health-check detected dead WebSocket — reconnecting...');
                if (healthCheckInterval) {
                  clearInterval(healthCheckInterval);
                  healthCheckInterval = null;
                }
                scheduleReconnect();
              }
            } catch (_) { /* ignore inspection errors */ }
          }, 30000);

        } catch (subErr: any) {
          // code 1008 = Missing channel(s) — some collections don't exist yet
          if (subErr?.code !== 1008) {
            console.warn('Realtime channel subscription failed, relying on polling:', subErr?.message);
          }
          scheduleReconnect();
        }
      } catch (err: any) {
        // Ignore 'WebSocket is already in CLOSING or CLOSED state' noise
        if (!err?.message?.includes('CLOSING') && !err?.message?.includes('CLOSED')) {
          console.warn('Realtime socket setup failed, relying on polling:', err?.message);
        }
        scheduleReconnect();
      }
    };

    setupRealtime();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      teardown();
    };
  }, [databaseId, isConfigured, orgId, initialPullDone, currentUserEmail, disableRealtime]);

  // Polling fallback to keep data and permissions in sync if WebSocket events are blocked
  useEffect(() => {
    if (!isConfigured || !initialPullDone) return;

    const pollInterval = realtimeConnected ? 20000 : 3500;

    const interval = setInterval(() => {
      handlePullFromDB(true);
    }, pollInterval);

    return () => clearInterval(interval);
  }, [isConfigured, initialPullDone, databaseId, orgId, realtimeConnected]);

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

      // Re-initialize baseline state
      baselineStateRef.current = {
        trucks: (currentState.trucks || []).filter(t => t.organizationId === orgId),
        drivers: (currentState.drivers || []).filter(d => d.organizationId === orgId),
        offices: (currentState.offices || []).filter(o => o.organizationId === orgId),
        accounts: (currentState.accounts || []).filter(a => a.organizationId === orgId),
        trips: (currentState.trips || []).filter(t => t.organizationId === orgId),
        expenses: (currentState.expenses || []).filter(e => e.organizationId === orgId),
        tyres: (currentState.tyres || []).filter(t => t.organizationId === orgId),
        auditLogs: (currentState.auditLogs || []).filter(l => l.organizationId === orgId),
        supportTickets: (currentState.supportTickets || []).filter(st => st.organizationId === orgId)
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

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="chk-disable-realtime"
                      checked={disableRealtime}
                      onChange={(e) => setDisableRealtime(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-blue-605 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <label htmlFor="chk-disable-realtime" className="text-[10px] text-slate-400 font-bold cursor-pointer select-none">
                      Force REST Polling (Disable WebSocket)
                    </label>
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
