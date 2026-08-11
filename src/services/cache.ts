import Dexie, { type Table } from 'dexie';
import { createSignal } from 'solid-js';
import { Truck, Driver, Office, Account, TripEntry, ExpenseEntry, Tyre, AuditLog, SupportTicket, OrganizationProfile } from '../types';
import { cryptoService } from './cryptoService';

export interface SyncMetaData {
  id: string; // key name e.g., 'lastSyncTimestamp', 'lastSyncUserId'
  value: any;
}

// Reactive signal to track database unlock status
const [dbUnlocked, setDbUnlocked] = createSignal(false);
export { dbUnlocked, setDbUnlocked };

export class FleetDatabase extends Dexie {
  trucks!: Table<Truck, string>;
  drivers!: Table<Driver, string>;
  offices!: Table<Office, string>;
  accounts!: Table<Account, string>;
  trips!: Table<TripEntry, string>;
  expenses!: Table<ExpenseEntry, string>;
  tyres!: Table<Tyre, string>;
  auditLogs!: Table<AuditLog, string>;
  supportTickets!: Table<SupportTicket, string>;
  organizationProfiles!: Table<OrganizationProfile, string>;
  syncMetadata!: Table<SyncMetaData, string>;

  constructor() {
    super('FleetDatabase');
    this.version(1).stores({
      trucks: 'id, truckNo, organizationId, status',
      drivers: 'id, driverName, phone, organizationId, status',
      offices: 'id, officeName, organizationId, status',
      accounts: 'id, accountName, organizationId, status',
      trips: 'id, tripNo, truckNo, driverName, organizationId, status, startDate',
      expenses: 'id, truckNo, expenseType, date, status, organizationId',
      tyres: 'id, tyreNo, status, organizationId, currentTruckNo',
      auditLogs: 'id, timestamp, category, action, organizationId',
      supportTickets: 'id, ticketNo, organizationId, status',
      organizationProfiles: 'organizationId, status',
      syncMetadata: 'id'
    });

    // Helper to check if a table is encrypted
    const encryptableTables = [
      'trucks', 'drivers', 'offices', 'accounts',
      'trips', 'expenses', 'tyres', 'auditLogs',
      'supportTickets', 'organizationProfiles'
    ];

    // Intercept data mapping using hooks
    encryptableTables.forEach(tableName => {
      const table = this.table(tableName);

      // Hook called when reading from DB
      table.hook('reading', (obj) => {
        if (!obj || !obj._encrypted) return obj;
        if (!cryptoService.hasKey()) {
          // If locked, return a placeholder or empty object to avoid crashes
          return { id: obj.id, organizationId: obj.organizationId || 'locked', _locked: true };
        }
        try {
          const decryptedJson = cryptoService.decryptSync(obj._encrypted);
          const decryptedObj = JSON.parse(decryptedJson);
          return decryptedObj;
        } catch (e) {
          console.error(`Failed to decrypt record in table ${tableName}:`, e);
          return { id: obj.id, _error: true };
        }
      });

      // Hook called when creating/updating in DB
      table.hook('creating', (primKey, obj) => {
        if (!cryptoService.hasKey()) {
          // Fallback to storing raw if no key is set yet (e.g. initial setup)
          return;
        }
        try {
          const encrypted = cryptoService.encryptSync(JSON.stringify(obj));
          // We must keep the primary key and indexing fields unencrypted so Dexie can query
          const stored: any = { _encrypted: encrypted };
          if (obj.id) stored.id = obj.id;
          if (obj.organizationId) stored.organizationId = obj.organizationId;
          if (obj.truckNo) stored.truckNo = obj.truckNo;
          if (obj.driverName) stored.driverName = obj.driverName;
          if (obj.status) stored.status = obj.status;
          if (obj.startDate) stored.startDate = obj.startDate;
          if (obj.date) stored.date = obj.date;
          if (obj.tyreNo) stored.tyreNo = obj.tyreNo;
          if (obj.ticketNo) stored.ticketNo = obj.ticketNo;
          if (obj.timestamp) stored.timestamp = obj.timestamp;
          return stored;
        } catch (e) {
          console.error(`Failed to encrypt record for table ${tableName}:`, e);
        }
      });

      table.hook('updating', (mods, primKey, obj) => {
        if (!cryptoService.hasKey()) return;
        try {
          // Combine mods into obj to encrypt the full updated object
          const fullObj = { ...obj, ...mods };
          const encrypted = cryptoService.encryptSync(JSON.stringify(fullObj));
          const stored: any = { _encrypted: encrypted };
          if (fullObj.id) stored.id = fullObj.id;
          if (fullObj.organizationId) stored.organizationId = fullObj.organizationId;
          if (fullObj.truckNo) stored.truckNo = fullObj.truckNo;
          if (fullObj.driverName) stored.driverName = fullObj.driverName;
          if (fullObj.status) stored.status = fullObj.status;
          if (fullObj.startDate) stored.startDate = fullObj.startDate;
          if (fullObj.date) stored.date = fullObj.date;
          if (fullObj.tyreNo) stored.tyreNo = fullObj.tyreNo;
          if (fullObj.ticketNo) stored.ticketNo = fullObj.ticketNo;
          if (fullObj.timestamp) stored.timestamp = fullObj.timestamp;
          return stored;
        } catch (e) {
          console.error(`Failed to encrypt updated record for table ${tableName}:`, e);
        }
      });
    });
  }

  // Clear all local caches on logout or reset
  async clearAllCaches() {
    await this.transaction('rw', [
      this.trucks, this.drivers, this.offices, this.accounts, 
      this.trips, this.expenses, this.tyres, this.auditLogs, 
      this.supportTickets, this.organizationProfiles, this.syncMetadata
    ], async () => {
      await Promise.all([
        this.trucks.clear(),
        this.drivers.clear(),
        this.offices.clear(),
        this.accounts.clear(),
        this.trips.clear(),
        this.expenses.clear(),
        this.tyres.clear(),
        this.auditLogs.clear(),
        this.supportTickets.clear(),
        this.organizationProfiles.clear(),
        this.syncMetadata.clear()
      ]);
    });

    // Clear legacy localStorage cache keys to prevent data leaking/stale views
    const legacyKeys = [
      'ttt_trucks',
      'ttt_drivers',
      'ttt_offices',
      'ttt_accounts',
      'ttt_trips',
      'ttt_expenses',
      'ttt_tyres',
      'fleet_audit_logs',
      'ttt_support_tickets',
      'ttt_last_modified_at',
      'appwrite_last_sync_time'
    ];
    legacyKeys.forEach(k => localStorage.removeItem(k));

    cryptoService.clearKey();
    setDbUnlocked(false);
  }

  // Pre-load all tables in parallel to ensure decrypted data is ready before UI transitions
  async prewarmCache() {
    if (!cryptoService.hasKey()) return;
    try {
      const [
        trucks, drivers, offices, accounts, trips, expenses, tyres, auditLogs, supportTickets, organizationProfiles
      ] = await Promise.all([
        this.trucks.toArray(),
        this.drivers.toArray(),
        this.offices.toArray(),
        this.accounts.toArray(),
        this.trips.toArray(),
        this.expenses.toArray(),
        this.tyres.toArray(),
        this.auditLogs.toArray(),
        this.supportTickets.toArray(),
        this.organizationProfiles.toArray()
      ]);

      console.log("%c[Dexie IndexedDB Raw Counts]", "color: #3b82f6; font-weight: bold;", {
        trucks: trucks?.length || 0,
        drivers: drivers?.length || 0,
        offices: offices?.length || 0,
        accounts: accounts?.length || 0,
        trips: trips?.length || 0,
        expenses: expenses?.length || 0,
        tyres: tyres?.length || 0,
        auditLogs: auditLogs?.length || 0
      });
      console.log("[Dexie IndexedDB Sample Objects]:", {
        sampleTruck: trucks?.[0] || 'NONE',
        sampleTrip: trips?.[0] || 'NONE'
      });

      prewarmedData.trucks = trucks || [];
      prewarmedData.drivers = drivers || [];
      prewarmedData.offices = offices || [];
      prewarmedData.accounts = accounts || [];
      prewarmedData.trips = trips || [];
      prewarmedData.expenses = expenses || [];
      prewarmedData.tyres = tyres || [];
      prewarmedData.auditLogs = auditLogs || [];
      prewarmedData.supportTickets = supportTickets || [];
      prewarmedData.organizationProfiles = organizationProfiles || [];

      console.log("[cache.ts] Cache prewarmed successfully with in-memory records:", {
        trips: prewarmedData.trips.length,
        trucks: prewarmedData.trucks.length,
        offices: prewarmedData.offices.length
      });
    } catch (e) {
      console.warn("Prewarming Dexie cache failed:", e);
    }
  }
}

// In-memory cache store populated during prewarm Cache
export const prewarmedData: Record<string, any[]> = {};

export const db = new FleetDatabase();
