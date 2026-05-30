import { useState } from 'react';
import { Driver, TripEntry } from '../types';
import { migrateDrivers } from '../lib/migrations';
import { getDriverDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

interface UseDriversParams {
  orgId: string;
  trips: TripEntry[];
  showNotification: (msg: string) => void;
  logAction: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
}

export function useDrivers({ orgId, trips, showNotification, logAction }: UseDriversParams) {
  const [drivers, setDrivers] = useState<Driver[]>(() => {
    try {
      const stored = localStorage.getItem('ttt_drivers');
      return stored ? migrateDrivers(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  });

  const saveDrivers = (newDrivers: Driver[]) => {
    setDrivers(newDrivers);
    localStorage.setItem('ttt_drivers', JSON.stringify(newDrivers));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgDrivers = orgId === 'org_backend' ? drivers : drivers.filter(d => d.organizationId === orgId);

  const addDriver = (driverInput: Omit<Driver, 'id'>) => {
    const isDup = orgDrivers.some(d => d.driverName.toUpperCase().trim() === driverInput.driverName.toUpperCase().trim());
    if (isDup) {
      alert("Driver Name is already registered.");
      return;
    }
    const d = { ...driverInput, id: 'd_id_' + Date.now(), organizationId: orgId };
    saveDrivers([...drivers, d]);
    logAction('Created', 'Driver', d.driverName, `Added operator driver ${d.driverName} (License: ${d.licenseNo || 'N/A'})`);
    showNotification(`Driver ${d.driverName} added successfully.`);
  };

  const updateDriver = (updated: Driver) => {
    const oldDriver = drivers.find(d => d.id === updated.id);
    const merged: Driver = oldDriver ? { ...oldDriver, ...updated } : updated;
    const next = drivers.map(d => d.id === updated.id ? merged : d);
    saveDrivers(next);

    if (isAppwriteConfigured() && oldDriver && oldDriver.licenseFileId && oldDriver.licenseFileId !== merged.licenseFileId) {
      appwrite.deleteFile(oldDriver.licenseFileId).catch(err => {
        console.warn("Failed to delete replaced driver license file:", err);
      });
    }

    const diff = oldDriver ? getDriverDiff(oldDriver, merged) : `Updated driver specs or active status to ${merged.status}`;
    if (diff) {
      logAction('Edited', 'Driver', merged.driverName, diff);
    }
    showNotification(`Driver details updated.`);
  };

  const deleteDriver = (id: string) => {
    const dr = drivers.find(d => d.id === id);
    const orgTrips = orgId === 'org_backend' ? trips : trips.filter(t => t.organizationId === orgId);
    const inUse = orgTrips.some(tr => tr.driverName === dr?.driverName);
    if (inUse) {
      alert(`Cannot delete Driver ${dr?.driverName}. This driver is assigned to historical journeys.`);
      return;
    }
    const next = drivers.filter(d => d.id !== id);
    saveDrivers(next);

    if (isAppwriteConfigured() && dr?.licenseFileId) {
      appwrite.deleteFile(dr.licenseFileId).catch(err => {
        console.warn("Failed to delete driver license file on driver removal:", err);
      });
    }

    if (dr) {
      logAction('Deleted', 'Driver', dr.driverName, `Permanently deleted driver ${dr.driverName} record`);
    }
    showNotification(`Driver deleted from records.`);
  };

  return { drivers, setDrivers, orgDrivers, saveDrivers, addDriver, updateDriver, deleteDriver };
}
