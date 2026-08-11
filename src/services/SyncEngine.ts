import { createSignal } from 'solid-js';
import { appwrite } from '../lib/appwrite';

export type ConnectionState = 'offline' | 'connecting' | 'syncing' | 'live';

export interface SyncCursors {
  trucks: string | null;
  drivers: string | null;
  offices: string | null;
  accounts: string | null;
  trips: string | null;
  sub_trips: string | null;
  expenses: string | null;
  tyres: string | null;
  audit_logs: string | null;
  support_tickets: string | null;
  coupons: string | null;
}

const DEFAULT_CURSORS: SyncCursors = {
  trucks: null,
  drivers: null,
  offices: null,
  accounts: null,
  trips: null,
  sub_trips: null,
  expenses: null,
  tyres: null,
  audit_logs: null,
  support_tickets: null,
  coupons: null
};

// Global reactive signals for SyncEngine status
const [connectionState, setConnectionState] = createSignal<ConnectionState>('connecting');
const [lastSyncError, setLastSyncError] = createSignal<string | null>(null);
const [syncCursors, setSyncCursors] = createSignal<SyncCursors>({ ...DEFAULT_CURSORS });

export class OfflineMutationError extends Error {
  constructor(message = 'Data mutations are only allowed when backend connection status is Live.') {
    super(message);
    this.name = 'OfflineMutationError';
  }
}

export class SyncEngine {
  private activeDatabaseId: string = 'fleet_db';
  private activeOrgId: string = 'org_default';
  private realtimeUnsubscribe: (() => void) | null = null;
  private isSyncing: boolean = false;

  public connectionState = connectionState;
  public lastSyncError = lastSyncError;
  public syncCursors = syncCursors;

  /**
   * Guard method to throw an error if an edit/add/delete mutation is attempted while not Live.
   */
  public assertLiveMutation() {
    if (connectionState() !== 'live') {
      throw new OfflineMutationError();
    }
  }

  /**
   * Load cursors from local storage / IndexedDB
   */
  private loadCursors(): SyncCursors {
    try {
      const stored = localStorage.getItem('ttt_sync_cursors');
      if (stored) {
        return { ...DEFAULT_CURSORS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('[SyncEngine] Failed to load sync cursors from localStorage:', e);
    }
    return { ...DEFAULT_CURSORS };
  }

  /**
   * Save updated cursors to local storage
   */
  private saveCursors(newCursors: SyncCursors) {
    setSyncCursors(newCursors);
    try {
      localStorage.setItem('ttt_sync_cursors', JSON.stringify(newCursors));
    } catch (e) {
      console.warn('[SyncEngine] Failed to save sync cursors:', e);
    }
  }

  /**
   * Initialize SyncEngine: setup listeners, connect Realtime early, run delta sync
   */
  public async initialize(databaseId: string, orgId: string, onStateUpdate?: (data: any) => void) {
    this.activeDatabaseId = databaseId || 'fleet_db';
    this.activeOrgId = orgId || 'org_default';

    const cursors = this.loadCursors();
    setSyncCursors(cursors);

    // Track online/offline browser events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true, onStateUpdate));
      window.addEventListener('offline', () => this.handleNetworkChange(false, onStateUpdate));
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setConnectionState('offline');
      return;
    }

    setConnectionState('connecting');

    // 1. Establish Realtime early
    await this.setupRealtimeSubscription(onStateUpdate);

    // 2. Perform Delta Sync
    await this.runDeltaSync(onStateUpdate);
  }

  /**
   * Handle network status changes
   */
  private async handleNetworkChange(isOnline: boolean, onStateUpdate?: (data: any) => void) {
    if (!isOnline) {
      setConnectionState('offline');
      if (this.realtimeUnsubscribe) {
        try { this.realtimeUnsubscribe(); } catch (_) {}
        this.realtimeUnsubscribe = null;
      }
    } else {
      setConnectionState('connecting');
      await this.setupRealtimeSubscription(onStateUpdate);
      await this.runDeltaSync(onStateUpdate);
    }
  }

  /**
   * Setup Realtime WebSockets early without dry-run HTTP collection checks
   */
  private async setupRealtimeSubscription(onStateUpdate?: (data: any) => void) {
    if (this.realtimeUnsubscribe) {
      try { this.realtimeUnsubscribe(); } catch (_) {}
      this.realtimeUnsubscribe = null;
    }

    try {
      await appwrite.initSession();
      // Subscribe directly to database document events
      const channel = `databases.${this.activeDatabaseId}.collections`;
      const unsubscribe = appwrite.subscribe([channel], (response: any) => {
        this.handleRealtimeEvent(response, onStateUpdate);
      });
      this.realtimeUnsubscribe = typeof unsubscribe === 'function' ? unsubscribe : null;
    } catch (err: any) {
      console.warn('[SyncEngine] Realtime connection setup warning:', err);
    }
  }

  /**
   * Process incoming Realtime events and update local cache/state
   */
  private handleRealtimeEvent(event: any, onStateUpdate?: (data: any) => void) {
    if (!event || !event.events || !event.payload) return;

    const payload = event.payload;
    const isDelete = event.events.some((e: string) => e.endsWith('.delete'));
    const isCreateOrUpdate = event.events.some((e: string) => e.endsWith('.create') || e.endsWith('.update'));

    // Extract collection from event string if available
    const eventStr = event.events[0] || '';
    const match = eventStr.match(/collections\.([^.]+)\.documents/);
    const collectionId = match ? match[1] : null;

    if (!collectionId) return;

    const record = appwrite.reconstructRecord(payload);
    if (!record || !record.id) return;

    if (onStateUpdate) {
      onStateUpdate({
        collectionId,
        record,
        isDelete,
        isCreateOrUpdate
      });
    }
  }

  /**
   * Run Deterministic Delta HTTP Sync ($updatedAt > cursor AND $updatedAt <= syncStartedAt)
   */
  public async runDeltaSync(onStateUpdate?: (data: any) => void) {
    if (this.isSyncing) return;
    this.isSyncing = true;
    setConnectionState('syncing');
    setLastSyncError(null);

    const categories: Array<{ key: keyof SyncCursors; collection: string }> = [
      { key: 'trucks', collection: 'trucks' },
      { key: 'drivers', collection: 'drivers' },
      { key: 'offices', collection: 'offices' },
      { key: 'accounts', collection: 'accounts' },
      { key: 'trips', collection: 'trips' },
      { key: 'sub_trips', collection: 'sub_trips' },
      { key: 'expenses', collection: 'expenses' },
      { key: 'tyres', collection: 'tyres' },
      { key: 'audit_logs', collection: 'audit_logs' },
      { key: 'support_tickets', collection: 'support_tickets' },
      { key: 'coupons', collection: 'coupons' }
    ];

    const currentCursors = { ...syncCursors() };
    const syncStartedAt = new Date().toISOString();
    let hasError = false;

    await Promise.all(categories.map(async (cat) => {
      try {
        const lastCursor = currentCursors[cat.key];
        const docs = await appwrite.fetchDeltaDocuments(
          this.activeDatabaseId,
          cat.collection,
          this.activeOrgId,
          lastCursor,
          syncStartedAt
        );

        if (Array.isArray(docs) && docs.length > 0) {
          const reconstructed = docs.map(doc => appwrite.reconstructRecord(doc));
          if (onStateUpdate) {
            onStateUpdate({
              collectionId: cat.collection,
              records: reconstructed,
              isDeltaBatch: true
            });
          }
        }

        // Advance cursor to syncStartedAt after successful processing
        currentCursors[cat.key] = syncStartedAt;
      } catch (err: any) {
        console.warn(`[SyncEngine] Delta sync error for ${cat.collection}:`, err);
        hasError = true;
      }
    }));

    this.saveCursors(currentCursors);
    this.isSyncing = false;

    if (hasError) {
      setLastSyncError('Some collections failed to sync.');
    }

    setConnectionState('live');
  }
}

export const syncEngine = new SyncEngine();
