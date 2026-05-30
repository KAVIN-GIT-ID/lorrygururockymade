import { useState } from 'react';
import { TripEntry } from '../types';
import { migrateTrips, migrateTripsIfNecessary } from '../lib/migrations';
import { getTripDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

interface UseTripsParams {
  orgId: string;
  showNotification: (msg: string) => void;
  logAction: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
  loadDashboardData: (month: string, year: string) => Promise<void>;
  activeMonth: string;
  activeYear: string;
}

export function useTrips({
  orgId,
  showNotification,
  logAction,
  loadDashboardData,
  activeMonth,
  activeYear
}: UseTripsParams) {
  const [trips, setTrips] = useState<TripEntry[]>(() => {
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
  });

  const saveTrips = (newTrips: TripEntry[]) => {
    setTrips(newTrips);
    localStorage.setItem('ttt_trips', JSON.stringify(newTrips));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgTrips = orgId === 'org_backend' ? trips : trips.filter(t => t.organizationId === orgId);

  const postTripEntry = async (entryInput: Omit<TripEntry, 'id'>, editingTrip: TripEntry | null) => {
    if (editingTrip) {
      // Update logic
      const updated: TripEntry = {
        ...entryInput,
        id: editingTrip.id,
        organizationId: editingTrip.organizationId || orgId
      };

      // Detect deleted carried-forward advances
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
      let next = trips.map(t => t.id === editingTrip.id ? updated : t);

      deletedFwdAdvances.forEach(deletedAdv => {
        const isDest = deletedAdv.id.startsWith('fwd_in_');
        const targetTripNo = deletedAdv.notes
          ? deletedAdv.notes
              .replace('Negative balance carried forward from ', '')
              .replace('Negative balance carried forward to ', '')
              .trim()
          : '';

        if (targetTripNo) {
          next = next.map(t => {
            if (t.tripNo === targetTripNo) {
              const cleanedAdvances = (t.advances || []).filter(adv => {
                const isMatchingFwd = isDest ? adv.id.startsWith('fwd_out_') : adv.id.startsWith('fwd_in_');
                const matchingNotes = isDest
                  ? `Negative balance carried forward to ${editingTrip.tripNo}`
                  : `Negative balance carried forward from ${editingTrip.tripNo}`;
                return !(isMatchingFwd && adv.notes === matchingNotes);
              });
              modifiedTripIds.push(t.id);
              return { ...t, advances: cleanedAdvances };
            }
            return t;
          });
        }
      });

      saveTrips(next);

      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          await appwrite.saveFleetDocument(databaseId, 'trips', updated.id, orgId, updated);
          
          for (const mId of modifiedTripIds) {
            const mTrip = next.find(x => x.id === mId);
            if (mTrip) {
              await appwrite.saveFleetDocument(databaseId, 'trips', mId, orgId, mTrip);
            }
          }
        } catch (err) {
          console.warn("Failed to save trip to Appwrite:", err);
        }
      }
      await loadDashboardData(activeMonth, activeYear);

      const diff = getTripDiff(editingTrip, updated);
      if (diff) {
        logAction('Edited', 'Trip', updated.tripNo, diff);
      }
      showNotification(`Trip ${updated.tripNo} changes successfully committed.`);
    } else {
      // Create path
      const isDup = orgTrips.some(t => t.tripNo.toUpperCase().trim() === entryInput.tripNo.toUpperCase().trim());
      if (isDup) {
        alert("Trip Number is already in use by another active ledger.");
        return;
      }

      const newEntry: TripEntry = {
        ...entryInput,
        id: 't_id_' + Date.now(),
        organizationId: orgId
      };

      const nextTrips = [...trips, newEntry];
      saveTrips(nextTrips);

      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          await appwrite.saveFleetDocument(databaseId, 'trips', newEntry.id, orgId, newEntry);
        } catch (err) {
          console.warn("Failed to create trip in Appwrite:", err);
        }
      }
      await loadDashboardData(activeMonth, activeYear);

      logAction('Created', 'Trip', newEntry.tripNo, `Initialized new trip sheet for vehicle ${newEntry.truckNo} (Operator: ${newEntry.driverName})`);
      showNotification(`Saved segment load posted as master trip.`);
    }
  };

  const deleteTripEntry = async (id: string) => {
    const tEntry = trips.find(t => t.id === id);
    if (!tEntry) return;

    const deletedTripNo = tEntry.tripNo;
    const modifiedTripIds: string[] = [];

    // Filter out the deleted trip
    let next = trips.filter(t => t.id !== id);

    // Clean up carried-forward advances on other trips that refer to the deleted trip
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
        return { ...t, advances: cleanedAdvances };
      }
      return t;
    });

    saveTrips(next);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.deleteFleetDocument(databaseId, 'trips', id);
        
        for (const mId of modifiedTripIds) {
          const mTrip = next.find(x => x.id === mId);
          if (mTrip) {
            await appwrite.saveFleetDocument(databaseId, 'trips', mId, orgId, mTrip);
          }
        }
      } catch (err) {
        console.warn("Failed to delete trip from Appwrite:", err);
      }
    }
    await loadDashboardData(activeMonth, activeYear);

    logAction('Deleted', 'Trip', tEntry.tripNo, `Wiped cargo entry sheet for truck ${tEntry.truckNo}`);
    showNotification(`Trip entry permanently voided.`);
  };

  return { trips, setTrips, orgTrips, saveTrips, postTripEntry, deleteTripEntry };
}
