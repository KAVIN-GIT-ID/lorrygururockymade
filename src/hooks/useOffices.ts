import { createSignal, createMemo, createEffect } from 'solid-js';
import { Office, TripEntry } from '../types';
import { migrateOffices } from '../lib/migrations';
import { getOfficeDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db } from '../services/cache';

interface UseOfficesParams {
  orgId: string;
  trips: () => TripEntry[];
  showNotification: (msg: string) => void;
  logAction: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
}

export function useOffices({ orgId, trips, showNotification, logAction }: UseOfficesParams) {
  const [offices, setOffices] = createSignal<Office[]>((() => {
    try {
      const stored = localStorage.getItem('ttt_offices');
      return stored ? migrateOffices(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  })());

  // Load from Dexie cache on start
  createEffect(() => {
    db.offices.toArray().then(cached => {
      if (cached && cached.length > 0) {
        setOffices(cached);
      }
    });
  });

  // Sync back to Dexie cache reactively
  createEffect(() => {
    const list = offices();
    db.offices.clear().then(() => db.offices.bulkPut(list));
  });

  const saveOffices = (newOffices: Office[]) => {
    setOffices(newOffices);
    localStorage.setItem('ttt_offices', JSON.stringify(newOffices));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgOffices = createMemo(() => orgId === 'org_backend' ? offices() : offices().filter(o => o.organizationId === orgId));

  const addOffice = async (officeInput: Omit<Office, 'id'>) => {
    const isDup = orgOffices().some(o => o.officeName.toLowerCase().trim() === officeInput.officeName.toLowerCase().trim());
    if (isDup) {
      alert("Trading office with historical name already exists.");
      return;
    }
    const n = { ...officeInput, id: 'o_id_' + Date.now(), organizationId: orgId };

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'offices', n.id, orgId, n);
      } catch (err) {
        console.error("Failed to save office to Appwrite. Action aborted:", err);
        alert("Error: Failed to register office in server database. Please check your connection or permissions.");
        return;
      }
    }

    saveOffices([...offices(), n]);
    logAction('Created', 'Office', n.officeName, `Opened trading office branch at ${n.officeName} (${n.city || 'N/A'})`);
    showNotification(`Office branch ${n.officeName} created.`);
  };

  const updateOffice = async (updated: Office) => {
    const oldOffice = offices().find(o => o.id === updated.id);
    const merged: Office = oldOffice ? { ...oldOffice, ...updated } : updated;

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'offices', merged.id, orgId, merged);
      } catch (err) {
        console.error("Failed to update office in Appwrite. Action aborted:", err);
        alert("Error: Failed to update office in server database. Please check your connection or permissions.");
        return;
      }
    }

    const next = offices().map(o => o.id === updated.id ? merged : o);
    saveOffices(next);

    const diff = oldOffice ? getOfficeDiff(oldOffice, merged) : `Updated branch details or manager settings`;
    if (diff) {
      logAction('Edited', 'Office', merged.officeName, diff);
    }
    showNotification(`Office branch record updated.`);
  };

  const deleteOffice = async (id: string) => {
    const off = offices().find(o => o.id === id);
    const orgTrips = orgId === 'org_backend' ? trips() : trips().filter(t => t.organizationId === orgId);
    const inUse = orgTrips.some(tr => tr.subTrips?.some(st => st.officeName === off?.officeName));
    if (inUse) {
      alert(`Cannot delete Office ${off?.officeName}. This office has historical load consignments associated.`);
      return;
    }

    if (isAppwriteConfigured() && off) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.deleteFleetDocument(databaseId, 'offices', id);
      } catch (err) {
        console.error("Failed to delete office from Appwrite. Action aborted:", err);
        alert("Error: Failed to delete office from server database. Please check your connection or permissions.");
        return;
      }
    }

    const next = offices().filter(o => o.id !== id);
    saveOffices(next);

    if (off) {
      logAction('Deleted', 'Office', off.officeName, `Removed office branch ${off.officeName}`);
    }
    showNotification(`Office location removed.`);
  };

  return { get offices() { return offices(); }, setOffices, get orgOffices() { return orgOffices(); }, saveOffices, addOffice, updateOffice, deleteOffice };
}
