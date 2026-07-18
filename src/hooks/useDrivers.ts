import { createSignal, createMemo, createEffect } from 'solid-js';
import { Driver, TripEntry, createRecord, mutateRecord } from '../types';
import { migrateDrivers } from '../lib/migrations';
import { getDriverDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db } from '../services/cache';

interface UseDriversParams {
  orgId: string;
  trips: () => TripEntry[];
  showNotification: (msg: string) => void;
  logAction: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
  currentUserId: string;
}

export function useDrivers({ orgId, trips, showNotification, logAction, currentUserId }: UseDriversParams) {
  const [drivers, setDrivers] = createSignal<Driver[]>((() => {
    try {
      const stored = localStorage.getItem('ttt_drivers');
      return stored ? migrateDrivers(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  })());

  // Load from Dexie cache on start
  createEffect(() => {
    db.drivers.toArray().then(cached => {
      if (cached && cached.length > 0) {
        setDrivers(cached);
      }
    });
  });

  // Sync back to Dexie cache reactively
  createEffect(() => {
    const list = drivers();
    db.drivers.clear().then(() => db.drivers.bulkPut(list));
  });

  const saveDrivers = (newDrivers: Driver[]) => {
    setDrivers(newDrivers);
    localStorage.setItem('ttt_drivers', JSON.stringify(newDrivers));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgDrivers = createMemo(() => (orgId === 'org_backend' ? drivers() : drivers().filter(d => d.organizationId === orgId)).filter(d => !d.deletedAt));
  const addDriver = async (driverInput: Omit<Driver, 'id'>) => {
    const isDup = orgDrivers().some(d => d.driverName.toUpperCase().trim() === driverInput.driverName.toUpperCase().trim());
    if (isDup) {
      alert("Driver Name is already registered.");
      return;
    }
    const d = createRecord<Driver>({
      ...driverInput,
      id: 'd_id_' + Date.now(),
      organizationId: orgId
    }, currentUserId);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'drivers', d.id, orgId, d);
        d.syncState = 'synced';
      } catch (err) {
        console.error("Failed to save driver to Appwrite. Action aborted:", err);
        alert("Error: Failed to register driver in server database. Please check your connection or permissions.");
        return;
      }
    }

    saveDrivers([...drivers(), d]);
    logAction('Created', 'Driver', d.driverName, `Added operator driver ${d.driverName} (License: ${d.licenseNo || 'N/A'})`);
    showNotification(`Driver ${d.driverName} added successfully.`);
  };

  const updateDriver = async (updated: Driver) => {
    const oldDriver = drivers().find(d => d.id === updated.id);
    const merged: Driver = oldDriver
      ? mutateRecord(oldDriver, updated, currentUserId)
      : createRecord<Driver>({ ...updated, organizationId: orgId } as any, currentUserId);
    
    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'drivers', merged.id, orgId, merged);
        merged.syncState = 'synced';
      } catch (err) {
        console.error("Failed to update driver in Appwrite. Action aborted:", err);
        alert("Error: Failed to update driver in server database. Please check your connection or permissions.");
        return;
      }

      if (oldDriver && oldDriver.licenseFileId && oldDriver.licenseFileId !== merged.licenseFileId) {
        appwrite.deleteFile(oldDriver.licenseFileId).catch(err => {
          console.warn("Failed to delete replaced driver license file:", err);
        });
      }
    }

    const next = drivers().map(d => d.id === updated.id ? merged : d);
    saveDrivers(next);

    const diff = oldDriver ? getDriverDiff(oldDriver, merged) : `Updated driver specs or active status to ${merged.status}`;
    if (diff) {
      logAction('Edited', 'Driver', merged.driverName, diff);
    }
    showNotification(`Driver details updated.`);
  };

  const deleteDriver = async (id: string) => {
    const dr = drivers().find(d => d.id === id);
    const orgTrips = orgId === 'org_backend' ? trips() : trips().filter(t => t.organizationId === orgId);
    const inUse = orgTrips.some(tr => tr.driverName === dr?.driverName);
    if (inUse) {
      alert(`Cannot delete Driver ${dr?.driverName}. This driver is assigned to historical journeys.`);
      return;
    }
    const updatedDriver = mutateRecord(dr, { deletedAt: new Date().toISOString() }, currentUserId);
    
    if (isAppwriteConfigured() && dr) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'drivers', id, orgId, updatedDriver);
        updatedDriver.syncState = 'synced';
      } catch (err) {
        console.error("Failed to delete driver from Appwrite. Action aborted:", err);
        alert("Error: Failed to delete driver from server database. Please check your connection or permissions.");
        return;
      }

      if (dr.licenseFileId) {
        appwrite.deleteFile(dr.licenseFileId).catch(err => {
          console.warn("Failed to delete driver license file on driver removal:", err);
        });
      }
    }

    const next = drivers().map(d => d.id === id ? updatedDriver : d);
    saveDrivers(next);

    if (dr) {
      logAction('Deleted', 'Driver', dr.driverName, `Permanently deleted driver ${dr.driverName} record`);
    }
    showNotification(`Driver deleted from records.`);
  };

  return { get drivers() { return drivers(); }, setDrivers, get orgDrivers() { return orgDrivers(); }, saveDrivers, addDriver, updateDriver, deleteDriver };
}
