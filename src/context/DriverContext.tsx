import { createContext, useContext, createMemo, createEffect, JSX, createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { Driver, createRecord, mutateRecord } from '../types';
import { migrateDrivers } from '../lib/migrations';
import { getDriverDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db, dbUnlocked, prewarmedData } from '../services/cache';
import { useAuth } from './AuthContext';
import { usePermissions } from './PermissionContext';
import { useNotifications } from './NotificationContext';
import { useTripsContext } from './TripContext';

interface DriverContextType {
  drivers: Driver[];
  orgDrivers: () => Driver[];
  saveDrivers: (newDrivers: Driver[] | ((prev: Driver[]) => Driver[])) => void;
  addDriver: (driverInput: Omit<Driver, 'id'>) => Promise<void>;
  updateDriver: (updated: Driver) => Promise<void>;
  deleteDriver: (id: string) => Promise<void>;
}

const DriverContext = createContext<DriverContextType>();

export function DriverProvider(props: { children: JSX.Element }) {
  const { currentUser } = useAuth();
  const { currentUserOrgId } = usePermissions();
  const { showNotification } = useNotifications();
  const { orgTrips } = useTripsContext();

  const [driversStore, setDriversStore] = createStore<Driver[]>([]);
  const [loadedFromDB, setLoadedFromDB] = createSignal(false);

  createEffect(() => {
    if (!dbUnlocked()) return;
    if (prewarmedData.drivers && prewarmedData.drivers.length > 0) {
      setDriversStore(prewarmedData.drivers);
      setLoadedFromDB(true);
    }
    db.drivers.toArray().then(cached => {
      setDriversStore(cached || []);
      setLoadedFromDB(true);
    });
  });

  createEffect(() => {
    if (!dbUnlocked() || !loadedFromDB()) return;
    const list = [...driversStore];
    if (list.length === 0) {
      db.drivers.clear();
    } else {
      db.drivers.bulkPut(list);
    }
  });

  const saveDrivers = (newDrivers: Driver[] | ((prev: Driver[]) => Driver[])) => {
    const next = typeof newDrivers === 'function' ? newDrivers(driversStore) : newDrivers;
    setDriversStore(next);
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgDrivers = createMemo(() => {
    const orgId = currentUserOrgId() || 'org_default';
    return driversStore.filter(d => d.organizationId === orgId && !d.deletedAt);
  });

  const addDriver = async (driverInput: Omit<Driver, 'id'>) => {
    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
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
        console.error("Failed to save driver to Appwrite:", err);
        alert("Error: Failed to register driver in server database. Connection offline or permissions missing.");
        return;
      }
    }

    saveDrivers([...driversStore, d]);
    showNotification(`Driver ${d.driverName} added successfully.`);
  };

  const updateDriver = async (updated: Driver) => {
    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
    const oldDriver = driversStore.find(d => d.id === updated.id);
    const merged: Driver = oldDriver
      ? mutateRecord(oldDriver, updated, currentUserId)
      : createRecord<Driver>({ ...updated, organizationId: orgId } as any, currentUserId);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'drivers', merged.id, orgId, merged);
        merged.syncState = 'synced';
      } catch (err) {
        console.error("Failed to update driver to Appwrite:", err);
        alert("Error: Failed to save changes in server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = driversStore.map(d => d.id === updated.id ? merged : d);
    saveDrivers(next);

    const diff = getDriverDiff(oldDriver, merged);
    if (diff) {
      // Log action
    }
    showNotification(`Driver ${merged.driverName} details updated.`);
  };

  const deleteDriver = async (id: string) => {
    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
    const driver = driversStore.find(x => x.id === id);
    if (!driver) return;

    const hasTrips = orgTrips().some(trip => trip.driverName === driver.driverName);
    if (hasTrips) {
      alert("Error: Cannot delete this driver because they have recorded active trips. To maintain database consistency, archive or delete the trips first.");
      return;
    }

    const updated = mutateRecord(driver, { deletedAt: new Date().toISOString() }, currentUserId);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'drivers', id, orgId, updated);
        updated.syncState = 'synced';
      } catch (err) {
        console.error("Failed to delete driver in Appwrite:", err);
        alert("Error: Failed to archive driver in server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = driversStore.map(x => x.id === id ? updated : x);
    saveDrivers(next);
    showNotification(`Driver ${driver.driverName} archived successfully.`);
  };

  const driverValue: DriverContextType = {
    get drivers() { return driversStore; },
    orgDrivers,
    saveDrivers,
    addDriver,
    updateDriver,
    deleteDriver
  };

  return (
    <DriverContext.Provider value={driverValue}>
      {props.children}
    </DriverContext.Provider>
  );
}

export function useDriversContext() {
  const context = useContext(DriverContext);
  if (!context) {
    throw new Error('useDriversContext must be used within a DriverProvider');
  }
  return context;
}
