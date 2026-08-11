import { createContext, useContext, createMemo, createEffect, JSX, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { TripEntry, createRecord, mutateRecord } from '../types';
import { migrateTrips, migrateTripsIfNecessary } from '../lib/migrations';
import { getTripDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db, dbUnlocked, prewarmedData } from '../services/cache';
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

function autoHealAdvances(list: TripEntry[]): TripEntry[] {
  const activeFwdInLinkIds = new Set<string>();
  const activeFwdInTripNos = new Set<string>();

  list.forEach(t => {
    if (t.deletedAt) return;
    (t.advances || []).forEach(a => {
      if (a.id.startsWith('fwd_in_')) {
        if (a.linkId) activeFwdInLinkIds.add(a.linkId);
        activeFwdInTripNos.add(t.tripNo);
      }
    });
  });

  return list.map(t => {
    if (t.deletedAt || !t.advances) return t;
    const hasOrphanFwdOut = t.advances.some(a => {
      if (!a.id.startsWith('fwd_out_')) return false;
      if (a.linkId) return !activeFwdInLinkIds.has(a.linkId);
      const targetTripNoMatch = a.notes?.match(/TRIP-[A-Z0-9-]+/i)?.[0];
      if (targetTripNoMatch) {
        return !activeFwdInTripNos.has(targetTripNoMatch);
      }
      return true;
    });

    if (hasOrphanFwdOut) {
      const cleaned = t.advances.filter(a => {
        if (!a.id.startsWith('fwd_out_')) return true;
        if (a.linkId) return activeFwdInLinkIds.has(a.linkId);
        const targetTripNoMatch = a.notes?.match(/TRIP-[A-Z0-9-]+/i)?.[0];
        if (targetTripNoMatch) {
          return activeFwdInTripNos.has(targetTripNoMatch);
        }
        return false;
      });
      return { ...t, advances: cleaned };
    }
    return t;
  });
}

export function TripProvider(props: { children: JSX.Element }) {
  const { currentUser } = useAuth();
  const { currentUserOrgId, currentUserRights } = usePermissions();
  const { showNotification } = useNotifications();
  const { organizationProfiles } = useOrganizations();

  const [tripsStore, setTripsStore] = createStore<TripEntry[]>([]);
  const [loadedFromDB, setLoadedFromDB] = createSignal(false);

  // Load from Dexie cache on start
  createEffect(() => {
    if (!dbUnlocked()) return;
    if (prewarmedData.trips && prewarmedData.trips.length > 0) {
      const healed = autoHealAdvances(prewarmedData.trips);
      saveTrips(healed);
      setLoadedFromDB(true);
    }
    db.trips.toArray().then(cached => {
      let raw = cached && cached.length > 0 ? cached : [];
      if (raw.length === 0) {
        const localTrips = localStorage.getItem('ttt_trips');
        if (localTrips) {
          try { raw = JSON.parse(localTrips); } catch (e) {}
        }
      }
      const healed = autoHealAdvances(raw);
      saveTrips(healed);
      setLoadedFromDB(true);
    });
  });

  // Sync back to Dexie cache reactively
  let initialLoadCompleted = false;
  createEffect(() => {
    if (!dbUnlocked() || !loadedFromDB()) return;
    const list = JSON.parse(JSON.stringify(tripsStore));
    if (!initialLoadCompleted) {
      if (list.length > 0) initialLoadCompleted = true;
      else return;
    }
    if (list.length === 0) {
      db.trips.clear();
    } else {
      db.trips.bulkPut(list);
    }
  });

  const saveTrips = (newTrips: TripEntry[] | ((prev: TripEntry[]) => TripEntry[])) => {
    const list = typeof newTrips === 'function' ? newTrips(tripsStore) : newTrips;
    // Sync to Appwrite if configured and user is authenticated in an active organization
    if (isAppwriteConfigured()) {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      const orgId = currentUserOrgId();
      if (orgId && orgId !== 'org_default') {
        list.forEach(async (newT) => {
          if (newT.syncState === 'synced') return;
          const targetOrg = newT.organizationId || orgId;
          if (targetOrg === 'org_default') return; // Skip saving unmigrated default items directly

          const oldT = tripsStore.find(t => t.id === newT.id);
          if (!oldT || JSON.stringify(oldT) !== JSON.stringify(newT)) {
            try {
              await appwrite.saveFleetDocument(databaseId, 'trips', newT.id, targetOrg, newT);
              const index = tripsStore.findIndex(t => t.id === newT.id);
              if (index !== -1) {
                setTripsStore(index, 'syncState', 'synced');
              }
            } catch (err) {
              console.error(`Failed to save trip ${newT.tripNo || newT.id} to Appwrite in saveTrips:`, err);
            }
          }
        });
      }
    }

    setTripsStore(list);
    localStorage.setItem('ttt_trips', JSON.stringify(list));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgTrips = createMemo(() => {
    const orgId = currentUserOrgId() || 'org_default';
    const isSuper = !!currentUserRights()?.isSuperAdmin || currentUserOrgId() === 'org_backend';
    return tripsStore.filter(t => {
      if (t.deletedAt) return false;
      if (isSuper) return true;
      if (!t.organizationId || t.organizationId === 'org_default') return true;
      return (t.organizationId || '').toLowerCase().trim() === orgId.toLowerCase().trim();
    });
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
        .filter(t => t.organizationId === orgId)
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
    const deletedLinkIds = (tEntry.advances || []).map(a => a.linkId).filter(Boolean) as string[];
    const modifiedTripIds: string[] = [];

    const updatedTrip = mutateRecord(tEntry, { deletedAt: new Date().toISOString() }, currentUserId);
    let next = tripsStore.map(t => t.id === id ? updatedTrip : t);

    next = next.map(t => {
      const hasReferencingAdv = (t.advances || []).some(adv => 
        (adv.id.startsWith('fwd_in_') || adv.id.startsWith('fwd_out_')) &&
        ((adv.linkId && deletedLinkIds.includes(adv.linkId)) ||
         (adv.notes && (adv.notes.endsWith(deletedTripNo) || adv.notes.includes(deletedTripNo))))
      );
      if (hasReferencingAdv) {
        const cleanedAdvances = (t.advances || []).filter(adv => {
          const isFwd = adv.id.startsWith('fwd_in_') || adv.id.startsWith('fwd_out_');
          const referencesDeleted = (adv.linkId && deletedLinkIds.includes(adv.linkId)) ||
            (adv.notes && (adv.notes.endsWith(deletedTripNo) || adv.notes.includes(deletedTripNo)));
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
