import { createContext, useContext, createMemo, createEffect, JSX } from 'solid-js';
import { createStore } from 'solid-js/store';
import { TripEntry, createRecord, mutateRecord } from '../types';
import { migrateTrips, migrateTripsIfNecessary } from '../lib/migrations';
import { getTripDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db } from '../services/cache';
import { useAuth } from './AuthContext';
import { usePermissions } from './PermissionContext';
import { useNotifications } from './NotificationContext';
import { useOrganizations } from './OrganizationContext';

interface TripContextType {
  trips: TripEntry[];
  orgTrips: () => TripEntry[];
  saveTrips: (newTrips: TripEntry[] | ((prev: TripEntry[]) => TripEntry[])) => void;
  postTripEntry: (entryInput: Omit<TripEntry, 'id'>, editingTrip: TripEntry | null) => Promise<void>;
  deleteTripEntry: (id: string) => Promise<void>;
}

const TripContext = createContext<TripContextType>();

export function TripProvider(props: { children: JSX.Element }) {
  const { currentUser } = useAuth();
  const { currentUserOrgId, currentUserRights } = usePermissions();
  const { showNotification } = useNotifications();
  const { organizationProfiles } = useOrganizations();

  const initialTrips = (() => {
    try {
      const stored = localStorage.getItem('ttt_trips');
      if (stored) {
        const parsed = JSON.parse(stored);
        const migrated = migrateTrips(migrateTripsIfNecessary(parsed));
        localStorage.setItem('ttt_trips', JSON.stringify(migrated));
        return migrated;
      }
      return [];
    } catch {
      return [];
    }
  })();

  const [tripsStore, setTripsStore] = createStore<TripEntry[]>(initialTrips);

  // Load from Dexie cache on start
  createEffect(() => {
    db.trips.toArray().then(cached => {
      if (cached && cached.length > 0) {
        setTripsStore(cached);
      }
    });
  });

  // Sync back to Dexie cache reactively
  createEffect(() => {
    const list = [...tripsStore];
    db.trips.clear().then(() => db.trips.bulkPut(list));
  });

  const saveTrips = (newTrips: TripEntry[]) => {
    // Sync to Appwrite if configured
    if (isAppwriteConfigured()) {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      const orgId = currentUserOrgId() || 'org_default';
      newTrips.forEach(async (newT) => {
        if (newT.syncState === 'synced') return;
        const oldT = tripsStore.find(t => t.id === newT.id);
        if (!oldT || JSON.stringify(oldT) !== JSON.stringify(newT)) {
          try {
            await appwrite.saveFleetDocument(databaseId, 'trips', newT.id, orgId, newT);
            const index = tripsStore.findIndex(t => t.id === newT.id);
            if (index !== -1) {
              setTripsStore(index, 'syncState', 'synced');
            }
          } catch (err) {
            console.error(`Failed to save trip ${newT.tripNo} to Appwrite in saveTrips:`, err);
          }
        }
      });
    }

    setTripsStore(newTrips);
    localStorage.setItem('ttt_trips', JSON.stringify(newTrips));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgTrips = createMemo(() => {
    const orgId = currentUserOrgId() || 'org_default';
    return (orgId === 'org_backend' ? tripsStore : tripsStore.filter(t => t.organizationId === orgId))
      .map(t => t.deletedAt ? { ...t, status: 'Deleted' as any } : t);
  });

  const postTripEntry = async (entryInput: Omit<TripEntry, 'id'>, editingTrip: TripEntry | null) => {
    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
    const tripId = editingTrip ? editingTrip.id : 't_id_' + Date.now();

    const idMap: Record<string, string> = {};
    const mappedSubTrips = (entryInput.subTrips || []).map((sub, idx) => {
      const newSubId = `sub_${tripId}_${idx}`;
      idMap[sub.id] = newSubId;
      return { ...sub, id: newSubId };
    });

    const mappedPayments = (entryInput.payments || []).map(p => {
      if (p.subTripId && idMap[p.subTripId]) {
        return { ...p, subTripId: idMap[p.subTripId] };
      }
      return p;
    });

    const mappedAdvances = (entryInput.advances || []).map(adv => {
      if (adv.subTripId && idMap[adv.subTripId]) {
        return { ...adv, subTripId: idMap[adv.subTripId] };
      }
      return adv;
    });

    const finalEntryInput = {
      ...entryInput,
      subTrips: mappedSubTrips,
      payments: mappedPayments,
      advances: mappedAdvances
    };

    if (editingTrip) {
      const updated = mutateRecord(editingTrip, {
        ...finalEntryInput,
        organizationId: editingTrip.organizationId || orgId
      } as any, currentUserId);

      const deletedFwdAdvances: any[] = [];
      const originalAdvances = editingTrip.advances || [];
      const newAdvances = entryInput.advances || [];
      
      originalAdvances.forEach(oldAdv => {
        const isFwd = oldAdv.id.startsWith('fwd_in_') || oldAdv.id.startsWith('fwd_out_');
        if (isFwd && !newAdvances.some(newAdv => newAdv.id === oldAdv.id)) {
          deletedFwdAdvances.push(oldAdv);
        }
      });

      const modifiedTripIds: string[] = [];
      let next = tripsStore.map(t => t.id === editingTrip.id ? updated : t);

      deletedFwdAdvances.forEach(deletedAdv => {
        const isDest = deletedAdv.id.startsWith('fwd_in_');
        const targetTripNo = deletedAdv.notes
          ? deletedAdv.notes
              .replace('Negative balance carried forward from ', '')
              .replace('Negative balance carried forward to ', '')
              .replace('Excess amount/surplus carried forward from ', '')
              .replace('Excess amount/surplus carried forward to ', '')
              .trim()
          : '';

        if (targetTripNo) {
          next = next.map(t => {
            if (t.tripNo === targetTripNo) {
              const cleanedAdvances = (t.advances || []).filter(adv => {
                const isDest = deletedAdv.id.startsWith('fwd_in_');
                const isMatchingFwd = isDest ? adv.id.startsWith('fwd_out_') : adv.id.startsWith('fwd_in_');
                const isSurplus = deletedAdv.notes?.includes('Excess amount/surplus');
                const matchingNotes = isDest
                  ? (isSurplus
                      ? `Excess amount/surplus carried forward to ${editingTrip.tripNo}`
                      : `Negative balance carried forward to ${editingTrip.tripNo}`)
                  : (isSurplus
                      ? `Excess amount/surplus carried forward from ${editingTrip.tripNo}`
                      : `Negative balance carried forward from ${editingTrip.tripNo}`);
                return !(isMatchingFwd && adv.notes === matchingNotes);
              });
              modifiedTripIds.push(t.id);
              return mutateRecord(t, { advances: cleanedAdvances }, currentUserId);
            }
            return t;
          });
        }
      });

      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          await appwrite.saveFleetDocument(databaseId, 'trips', updated.id, orgId, updated);
          updated.syncState = 'synced';
          
          for (const mId of modifiedTripIds) {
            const mTrip = next.find(x => x.id === mId);
            if (mTrip) {
              await appwrite.saveFleetDocument(databaseId, 'trips', mId, orgId, mTrip);
              mTrip.syncState = 'synced';
            }
          }
        } catch (err) {
          console.error("Failed to update trip in Appwrite:", err);
          alert("Error: Failed to save trip changes to server database. Please check your connection or permissions.");
          return;
        }
      }

      saveTrips(next);
      const diff = getTripDiff(editingTrip, updated);
      if (diff) {
        // Log action can be handled via logAction or a LoggingService
      }
      showNotification(`Trip ${updated.tripNo} changes successfully committed.`);
    } else {
      const isDup = tripsStore
        .filter(t => orgId === 'org_backend' || t.organizationId === orgId)
        .some(t => t.tripNo.toUpperCase().trim() === finalEntryInput.tripNo.toUpperCase().trim());
      if (isDup) {
        alert("Trip Number is already in use by another active ledger.");
        return;
      }

      const newEntry = createRecord<TripEntry>({
        ...finalEntryInput,
        id: tripId,
        organizationId: orgId
      }, currentUserId);

      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          await appwrite.saveFleetDocument(databaseId, 'trips', newEntry.id, orgId, newEntry);
          newEntry.syncState = 'synced';
        } catch (err) {
          console.error("Failed to create trip in Appwrite:", err);
          alert("Error: Failed to register new trip in server database. Please check your connection or permissions.");
          return;
        }
      }

      saveTrips([...tripsStore, newEntry]);
      showNotification(`Saved segment load posted as master trip.`);
    }
  };

  const deleteTripEntry = async (id: string) => {
    const tEntry = tripsStore.find(t => t.id === id);
    if (!tEntry) return;

    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
    const deletedTripNo = tEntry.tripNo;
    const modifiedTripIds: string[] = [];

    const updatedTrip = mutateRecord(tEntry, { deletedAt: new Date().toISOString() }, currentUserId);
    let next = tripsStore.map(t => t.id === id ? updatedTrip : t);

    next = next.map(t => {
      const hasReferencingAdv = (t.advances || []).some(adv => 
        (adv.id.startsWith('fwd_in_') || adv.id.startsWith('fwd_out_')) &&
        adv.notes && (adv.notes.endsWith(deletedTripNo) || adv.notes.includes(deletedTripNo))
      );
      if (hasReferencingAdv) {
        const cleanedAdvances = (t.advances || []).filter(adv => {
          const isFwd = adv.id.startsWith('fwd_in_') || adv.id.startsWith('fwd_out_');
          const referencesDeleted = adv.notes && (adv.notes.endsWith(deletedTripNo) || adv.notes.includes(deletedTripNo));
          return !(isFwd && referencesDeleted);
        });
        modifiedTripIds.push(t.id);
        return mutateRecord(t, { advances: cleanedAdvances }, currentUserId);
      }
      return t;
    });

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'trips', id, orgId, updatedTrip);
        updatedTrip.syncState = 'synced';
        
        for (const mId of modifiedTripIds) {
          const mTrip = next.find(x => x.id === mId);
          if (mTrip) {
            await appwrite.saveFleetDocument(databaseId, 'trips', mId, orgId, mTrip);
            mTrip.syncState = 'synced';
          }
        }
      } catch (err) {
        console.error("Failed to delete trip from Appwrite. Action aborted:", err);
        alert("Error: Failed to archive trip in server database. Please check your connection or permissions.");
        return;
      }
    }

    saveTrips(next);
    showNotification(`Trip entry permanently voided.`);
  };

  const tripValue: TripContextType = {
    get trips() { return tripsStore; },
    orgTrips,
    saveTrips,
    postTripEntry,
    deleteTripEntry
  };

  return (
    <TripContext.Provider value={tripValue}>
      {props.children}
    </TripContext.Provider>
  );
}

export function useTripsContext() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTripsContext must be used within a TripProvider');
  }
  return context;
}
