import { batch } from 'solid-js';
import { db } from '../services/cache';

interface BackupRestoreParams {
  showNotification: (msg: string) => void;
  setTrucks: (trucks: any[]) => void;
  setDrivers: (drivers: any[]) => void;
  setOffices: (offices: any[]) => void;
  setAccounts: (accounts: any[]) => void;
  setTrips: (trips: any[]) => void;
  setExpenses: (expenses: any[]) => void;
  setTyres: (tyres: any[]) => void;
  setAuditLogs: (logs: any[]) => void;
  setUserRightsList: (list: any[]) => void;
  setOrganizationProfiles: (profiles: any[]) => void;
  logAction: (action: string, cat: string, ref: string, details: string) => void;
}

export function useBackupRestore({
  showNotification,
  setTrucks,
  setDrivers,
  setOffices,
  setAccounts,
  setTrips,
  setExpenses,
  setTyres,
  setAuditLogs,
  setUserRightsList,
  setOrganizationProfiles,
  logAction
}: BackupRestoreParams) {

  const handleTriggerDownloadBackup = () => {
    try {
      const backupData = {
        trucks: localStorage.getItem('ttt_trucks') ? JSON.parse(localStorage.getItem('ttt_trucks')!) : [],
        drivers: localStorage.getItem('ttt_drivers') ? JSON.parse(localStorage.getItem('ttt_drivers')!) : [],
        offices: localStorage.getItem('ttt_offices') ? JSON.parse(localStorage.getItem('ttt_offices')!) : [],
        accounts: localStorage.getItem('ttt_accounts') ? JSON.parse(localStorage.getItem('ttt_accounts')!) : [],
        trips: localStorage.getItem('ttt_trips') ? JSON.parse(localStorage.getItem('ttt_trips')!) : [],
        expenses: localStorage.getItem('ttt_expenses') ? JSON.parse(localStorage.getItem('ttt_expenses')!) : [],
        tyres: localStorage.getItem('ttt_tyres') ? JSON.parse(localStorage.getItem('ttt_tyres')!) : [],
        auditLogs: localStorage.getItem('fleet_audit_logs') ? JSON.parse(localStorage.getItem('fleet_audit_logs')!) : [],
        userRightsList: localStorage.getItem('ttt_user_rights') ? JSON.parse(localStorage.getItem('ttt_user_rights')!) : [],
        organizationProfiles: localStorage.getItem('ttt_organization_profiles') ? JSON.parse(localStorage.getItem('ttt_organization_profiles')!) : [],
        backupVersion: 'v2',
        downloadedAt: new Date().toISOString()
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `ttt_backup_${new Date().toISOString().substring(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showNotification("Local backup file generated and downloaded successfully!");
      logAction('Cloud', 'Backup', 'Download', "A complete local backup JSON file was generated and downloaded.");
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed to download backup: ${err.message || err}`);
    }
  };

  const handleUploadBackupChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const backup = JSON.parse(text);

        if (!backup.backupVersion) {
          throw new Error("Invalid backup file format. Missing version tag.");
        }

        // Wipe active cache DBs first to prevent duplicate primary keys or stale pointers
        await Promise.all([
          db.trucks.clear(),
          db.drivers.clear(),
          db.offices.clear(),
          db.accounts.clear(),
          db.trips.clear(),
          db.expenses.clear(),
          db.tyres.clear()
        ]);

        batch(() => {
          if (Array.isArray(backup.trucks)) {
            setTrucks(backup.trucks);
            localStorage.setItem('ttt_trucks', JSON.stringify(backup.trucks));
          }
          if (Array.isArray(backup.drivers)) {
            setDrivers(backup.drivers);
            localStorage.setItem('ttt_drivers', JSON.stringify(backup.drivers));
          }
          if (Array.isArray(backup.offices)) {
            setOffices(backup.offices);
            localStorage.setItem('ttt_offices', JSON.stringify(backup.offices));
          }
          if (Array.isArray(backup.accounts)) {
            setAccounts(backup.accounts);
            localStorage.setItem('ttt_accounts', JSON.stringify(backup.accounts));
          }
          if (Array.isArray(backup.trips)) {
            setTrips(backup.trips);
            localStorage.setItem('ttt_trips', JSON.stringify(backup.trips));
          }
          if (Array.isArray(backup.expenses)) {
            setExpenses(backup.expenses);
            localStorage.setItem('ttt_expenses', JSON.stringify(backup.expenses));
          }
          if (Array.isArray(backup.tyres)) {
            setTyres(backup.tyres);
            localStorage.setItem('ttt_tyres', JSON.stringify(backup.tyres));
          }
          if (Array.isArray(backup.auditLogs)) {
            setAuditLogs(backup.auditLogs);
            localStorage.setItem('fleet_audit_logs', JSON.stringify(backup.auditLogs));
          }
          if (Array.isArray(backup.userRightsList)) {
            setUserRightsList(backup.userRightsList);
            localStorage.setItem('ttt_user_rights', JSON.stringify(backup.userRightsList));
          }
          if (Array.isArray(backup.organizationProfiles)) {
            setOrganizationProfiles(backup.organizationProfiles);
            localStorage.setItem('ttt_organization_profiles', JSON.stringify(backup.organizationProfiles));
          }
        });

        showNotification("Backup restored successfully! All local datasets replaced.");
        logAction('Cloud', 'Backup', 'Restore', "A local backup JSON file was uploaded and successfully restored.");
      } catch (err: any) {
        console.error(err);
        showNotification(`Restore failed: ${err.message || err}`);
      }
    };
    reader.readAsText(file);
  };

  const triggerClearAllLocalData = () => {
    const doubleCheck = confirm("Are you absolutely sure you want to delete all local database tables and clear local storage cached files? This action is irreversible.");
    if (!doubleCheck) return;

    try {
      db.trucks.clear();
      db.drivers.clear();
      db.offices.clear();
      db.accounts.clear();
      db.trips.clear();
      db.expenses.clear();
      db.tyres.clear();

      batch(() => {
        setTrucks([]);
        setDrivers([]);
        setOffices([]);
        setAccounts([]);
        setTrips([]);
        setExpenses([]);
        setTyres([]);
        setAuditLogs([]);
      });

      localStorage.removeItem('ttt_trucks');
      localStorage.removeItem('ttt_drivers');
      localStorage.removeItem('ttt_offices');
      localStorage.removeItem('ttt_accounts');
      localStorage.removeItem('ttt_trips');
      localStorage.removeItem('ttt_expenses');
      localStorage.removeItem('ttt_tyres');
      localStorage.removeItem('fleet_audit_logs');

      showNotification("All local database records and cache files cleared successfully!");
      logAction('Deleted', 'Cache', 'Wipe', "Local cache database wiped completely.");
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed to clear local cache: ${err.message || err}`);
    }
  };

  return {
    handleTriggerDownloadBackup,
    handleUploadBackupChange,
    triggerClearAllLocalData
  };
}
