import Dexie, { type Table } from 'dexie';
import { Truck, Driver, Office, Account, TripEntry, ExpenseEntry, Tyre, AuditLog, SupportTicket, OrganizationProfile } from '../types';

export interface SyncMetaData {
  id: string; // key name e.g., 'lastSyncTimestamp', 'lastSyncUserId'
  value: any;
}

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
  }
}

export const db = new FleetDatabase();
