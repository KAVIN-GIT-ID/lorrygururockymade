import { createContext, useContext, createMemo, createEffect, JSX, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Office } from '../types';
import { migrateOffices } from '../lib/migrations';
import { getOfficeDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db, dbUnlocked } from '../services/cache';
import { usePermissions } from './PermissionContext';
import { useNotifications } from './NotificationContext';
import { useTripsContext } from './TripContext';

interface OfficeContextType {
  offices: Office[];
  orgOffices: () => Office[];
  saveOffices: (newOffices: Office[] | ((prev: Office[]) => Office[])) => void;
  addOffice: (officeInput: Omit<Office, 'id'>) => Promise<void>;
  updateOffice: (updated: Office) => Promise<void>;
  deleteOffice: (id: string) => Promise<void>;
}

const OfficeContext = createContext<OfficeContextType>();

export function OfficeProvider(props: { children: JSX.Element }) {
  const { currentUserOrgId } = usePermissions();
  const { showNotification } = useNotifications();
  const { orgTrips } = useTripsContext();

  const [officesStore, setOfficesStore] = createStore<Office[]>([]);
  const [loadedFromDB, setLoadedFromDB] = createSignal(false);

  createEffect(() => {
    if (!dbUnlocked()) return;
    db.offices.toArray().then(cached => {
      setOfficesStore(cached || []);
      setLoadedFromDB(true);
    });
  });

  createEffect(() => {
    if (!dbUnlocked() || !loadedFromDB()) return;
    const list = [...officesStore];
    db.offices.clear().then(() => db.offices.bulkPut(list));
  });

  const saveOffices = (newOffices: Office[] | ((prev: Office[]) => Office[])) => {
    const next = typeof newOffices === 'function' ? newOffices(officesStore) : newOffices;
    setOfficesStore(next);
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgOffices = createMemo(() => {
    const orgId = currentUserOrgId() || 'org_default';
    return orgId === 'org_backend' ? officesStore : officesStore.filter(o => o.organizationId === orgId);
  });

  const addOffice = async (officeInput: Omit<Office, 'id'>) => {
    const orgId = currentUserOrgId() || 'org_default';
    const isDup = orgOffices().some(o => o.officeName.toLowerCase().trim() === officeInput.officeName.toLowerCase().trim());
    if (isDup) {
      alert("Office branch location is already registered.");
      return;
    }
    const n = {
      ...officeInput,
      id: 'o_id_' + Date.now(),
      organizationId: orgId
    };

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'offices', n.id, orgId, n);
        n.syncState = 'synced';
      } catch (err) {
        console.error("Failed to save office to Appwrite:", err);
        alert("Error: Failed to register branch in server database. Connection offline or permissions missing.");
        return;
      }
    }

    saveOffices([...officesStore, n]);
    showNotification(`Branch Office ${n.officeName} created.`);
  };

  const updateOffice = async (updated: Office) => {
    const orgId = currentUserOrgId() || 'org_default';
    const oldOffice = officesStore.find(o => o.id === updated.id);
    const merged = oldOffice ? { ...oldOffice, ...updated } : { ...updated, organizationId: orgId };

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'offices', merged.id, orgId, merged);
        merged.syncState = 'synced';
      } catch (err) {
        console.error("Failed to update office in Appwrite:", err);
        alert("Error: Failed to save changes in server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = officesStore.map(o => o.id === updated.id ? merged : o);
    saveOffices(next);

    const diff = getOfficeDiff(oldOffice, merged);
    if (diff) {
      // Log action
    }
    showNotification(`Branch Details updated for ${merged.officeName}.`);
  };

  const deleteOffice = async (id: string) => {
    const orgId = currentUserOrgId() || 'org_default';
    const office = officesStore.find(x => x.id === id);
    if (!office) return;

    const inUse = orgTrips().some(tr => tr.subTrips?.some(st => st.officeName === office.officeName));
    if (inUse) {
      alert(`Cannot delete Office ${office.officeName}. This office has historical load consignments associated.`);
      return;
    }

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.deleteFleetDocument(databaseId, 'offices', id);
      } catch (err) {
        console.error("Failed to delete office in Appwrite:", err);
        alert("Error: Failed to delete office from server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = officesStore.filter(x => x.id !== id);
    saveOffices(next);
    showNotification(`Branch Office ${office.officeName} removed.`);
  };

  const officeValue: OfficeContextType = {
    get offices() { return officesStore; },
    orgOffices,
    saveOffices,
    addOffice,
    updateOffice,
    deleteOffice
  };

  return (
    <OfficeContext.Provider value={officeValue}>
      {props.children}
    </OfficeContext.Provider>
  );
}

export function useOfficesContext() {
  const context = useContext(OfficeContext);
  if (!context) {
    throw new Error('useOfficesContext must be used within an OfficeProvider');
  }
  return context;
}
