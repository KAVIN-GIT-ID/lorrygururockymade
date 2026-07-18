import { batch } from 'solid-js';
import { storageService } from './storageService';

export const migrationService = {
  migrateLocalDataToOrg(
    newOrgId: string,
    callbacks: {
      setTrucks: (data: any[]) => void;
      setDrivers: (data: any[]) => void;
      setOffices: (data: any[]) => void;
      setAccounts: (data: any[]) => void;
      setTrips: (data: any[]) => void;
      setExpenses: (data: any[]) => void;
      setTyres: (data: any[]) => void;
      setAuditLogs: (data: any[]) => void;
      touchLastModified: () => void;
    }
  ) {
    if (!newOrgId || newOrgId === 'org_default' || newOrgId === 'org_backend') return;
    console.info(`Migrating local offline records from org_default to ${newOrgId}...`);

    let changed = false;

    batch(() => {
      const migrateCategory = (key: string, setter: (data: any[]) => void) => {
        const list = storageService.get<any[]>(key, []);
        if (list.some((item: any) => item.organizationId === 'org_default')) {
          const updated = list.map((item: any) =>
            item.organizationId === 'org_default' ? { ...item, organizationId: newOrgId } : item
          );
          storageService.set(key, updated);
          setter(updated);
          changed = true;
        }
      };

      migrateCategory('ttt_trucks', callbacks.setTrucks);
      migrateCategory('ttt_drivers', callbacks.setDrivers);
      migrateCategory('ttt_offices', callbacks.setOffices);
      migrateCategory('ttt_accounts', callbacks.setAccounts);
      migrateCategory('ttt_trips', callbacks.setTrips);
      migrateCategory('ttt_expenses', callbacks.setExpenses);
      migrateCategory('ttt_tyres', callbacks.setTyres);
      migrateCategory('fleet_audit_logs', callbacks.setAuditLogs);

      if (changed) {
        callbacks.touchLastModified();
      }
    });
  }
};
