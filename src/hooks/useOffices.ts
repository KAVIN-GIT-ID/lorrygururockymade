import { useState } from 'react';
import { Office, TripEntry } from '../types';
import { migrateOffices } from '../lib/migrations';
import { getOfficeDiff } from '../utils/diffUtils';

interface UseOfficesParams {
  orgId: string;
  trips: TripEntry[];
  showNotification: (msg: string) => void;
  logAction: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
}

export function useOffices({ orgId, trips, showNotification, logAction }: UseOfficesParams) {
  const [offices, setOffices] = useState<Office[]>(() => {
    try {
      const stored = localStorage.getItem('ttt_offices');
      return stored ? migrateOffices(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  });

  const saveOffices = (newOffices: Office[]) => {
    setOffices(newOffices);
    localStorage.setItem('ttt_offices', JSON.stringify(newOffices));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgOffices = orgId === 'org_backend' ? offices : offices.filter(o => o.organizationId === orgId);

  const addOffice = (officeInput: Omit<Office, 'id'>) => {
    const isDup = orgOffices.some(o => o.officeName.toLowerCase().trim() === officeInput.officeName.toLowerCase().trim());
    if (isDup) {
      alert("Trading office with historical name already exists.");
      return;
    }
    const n = { ...officeInput, id: 'o_id_' + Date.now(), organizationId: orgId };
    saveOffices([...offices, n]);
    logAction('Created', 'Office', n.officeName, `Opened trading office branch at ${n.officeName} (${n.city || 'N/A'})`);
    showNotification(`Office branch ${n.officeName} created.`);
  };

  const updateOffice = (updated: Office) => {
    const oldOffice = offices.find(o => o.id === updated.id);
    const merged: Office = oldOffice ? { ...oldOffice, ...updated } : updated;
    const next = offices.map(o => o.id === updated.id ? merged : o);
    saveOffices(next);
    const diff = oldOffice ? getOfficeDiff(oldOffice, merged) : `Updated branch details or manager settings`;
    if (diff) {
      logAction('Edited', 'Office', merged.officeName, diff);
    }
    showNotification(`Office branch record updated.`);
  };

  const deleteOffice = (id: string) => {
    const off = offices.find(o => o.id === id);
    const orgTrips = orgId === 'org_backend' ? trips : trips.filter(t => t.organizationId === orgId);
    const inUse = orgTrips.some(tr => tr.subTrips?.some(st => st.officeName === off?.officeName));
    if (inUse) {
      alert(`Cannot delete Office ${off?.officeName}. This office has historical load consignments associated.`);
      return;
    }
    const next = offices.filter(o => o.id !== id);
    saveOffices(next);
    if (off) {
      logAction('Deleted', 'Office', off.officeName, `Removed office branch ${off.officeName}`);
    }
    showNotification(`Office location removed.`);
  };

  return { offices, setOffices, orgOffices, saveOffices, addOffice, updateOffice, deleteOffice };
}
