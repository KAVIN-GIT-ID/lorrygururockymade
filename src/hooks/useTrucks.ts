import { createSignal, createMemo, createEffect } from 'solid-js';
import { Truck, TripEntry, OrganizationProfile, createRecord, mutateRecord } from '../types';
import { migrateTrucks } from '../lib/migrations';
import { getTruckDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db } from '../services/cache';

interface UseTrucksParams {
  orgId: string;
  trips: () => TripEntry[];
  organizationProfiles: OrganizationProfile[];
  saveOrganizationProfiles: (newProfiles: OrganizationProfile[]) => Promise<void>;
  showNotification: (msg: string) => void;
  logAction: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
  pushFleetSnapshotNow: (overrideTrucks?: Truck[]) => Promise<void>;
  currentUserId: string;
}

export function useTrucks({
  orgId,
  trips,
  organizationProfiles,
  saveOrganizationProfiles,
  showNotification,
  logAction,
  pushFleetSnapshotNow,
  currentUserId
}: UseTrucksParams) {
  const [trucks, setTrucks] = createSignal<Truck[]>((() => {
    try {
      const stored = localStorage.getItem('ttt_trucks');
      return stored ? migrateTrucks(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  })());

  // Load from Dexie cache on start
  createEffect(() => {
    db.trucks.toArray().then(cached => {
      if (cached && cached.length > 0) {
        setTrucks(cached);
      }
    });
  });

  // Sync back to Dexie cache reactively
  createEffect(() => {
    const list = trucks();
    db.trucks.clear().then(() => db.trucks.bulkPut(list));
  });

  const saveTrucks = (newTrucks: Truck[]) => {
    setTrucks(newTrucks);
    localStorage.setItem('ttt_trucks', JSON.stringify(newTrucks));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgTrucks = createMemo(() => (orgId === 'org_backend' ? trucks() : trucks().filter(t => t.organizationId === orgId)).filter(t => !t.deletedAt));

  const addTruck = async (truckInput: Omit<Truck, 'id'>) => {
    const isDup = orgTrucks().some(t => t.truckNo.toUpperCase().trim() === truckInput.truckNo.toUpperCase().trim());
    if (isDup) {
      alert("Truck Number already registered in active datasheets.");
      return;
    }
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    const expiryStr = d.toISOString().split('T')[0];

    const n = createRecord<Truck>({
      ...truckInput,
      id: 't_id_' + Date.now(),
      organizationId: orgId,
      isApproved: true,
      registrationExpiryDate: expiryStr
    }, currentUserId);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'trucks', n.id, orgId, n);
        n.syncState = 'synced';
      } catch (err) {
        console.error("Failed to save truck to Appwrite. Action aborted:", err);
        alert("Error: Failed to register truck in server database. Connection offline or permissions missing.");
        return;
      }
    }

    saveTrucks([...trucks(), n]);
    logAction('Created', 'Truck', n.truckNo, `Created truck sheet for vehicle make ${n.make} Model: ${n.model}`);
    showNotification(`Truck ${n.truckNo} added successfully.`);
  };

  const updateTruck = async (updated: Truck) => {
    const oldTruck = trucks().find(t => t.id === updated.id);
    const merged: Truck = oldTruck
      ? mutateRecord(oldTruck, updated, currentUserId)
      : createRecord<Truck>({ ...updated, organizationId: orgId } as any, currentUserId);
    
    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'trucks', merged.id, orgId, merged);
        merged.syncState = 'synced';
 
        if (oldTruck) {
          if (oldTruck.rcFileId && oldTruck.rcFileId !== merged.rcFileId) {
            appwrite.deleteFile(oldTruck.rcFileId).catch(err => {
              console.warn("Failed to delete replaced RC file:", err);
            });
          }
          if (oldTruck.insuranceFileId && oldTruck.insuranceFileId !== merged.insuranceFileId) {
            appwrite.deleteFile(oldTruck.insuranceFileId).catch(err => {
              console.warn("Failed to delete replaced Insurance file:", err);
            });
          }
        }
      } catch (err) {
        console.error("Failed to update truck in Appwrite. Action aborted:", err);
        alert("Error: Failed to update truck in server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = trucks().map(t => t.id === updated.id ? merged : t);
    saveTrucks(next);
 
    const diff = oldTruck ? getTruckDiff(oldTruck, merged) : `Updated truck specifications and compliance expiry dates`;
    if (diff) {
      logAction('Edited', 'Truck', merged.truckNo, diff);
    }
    showNotification(`Truck ${merged.truckNo} database specifications updated.`);
  };

  const deleteTruck = async (id: string) => {
    const truckToDelete = trucks().find(t => t.id === id);
    const orgTrips = orgId === 'org_backend' ? trips() : trips().filter(t => t.organizationId === orgId);
    const inUse = orgTrips.some(tr => tr.truckNo === truckToDelete?.truckNo);
    if (inUse) {
      alert(`Cannot delete Truck ${truckToDelete?.truckNo}. It is associated with active trip registers.`);
      return;
    }
    if (isAppwriteConfigured() && truckToDelete) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.deleteFleetDocument(databaseId, 'trucks', id);
      } catch (err) {
        console.error("Failed to delete truck from Appwrite. Action aborted:", err);
        alert("Error: Failed to delete truck from server database. Please check your connection or permissions.");
        return;
      }

      if (truckToDelete.rcFileId) {
        appwrite.deleteFile(truckToDelete.rcFileId).catch(err => {
          console.warn("Failed to delete RC file on truck removal:", err);
        });
      }
      if (truckToDelete.insuranceFileId) {
        appwrite.deleteFile(truckToDelete.insuranceFileId).catch(err => {
          console.warn("Failed to delete Insurance file on truck removal:", err);
        });
      }
    }

    const next = trucks().filter(t => t.id !== id);
    saveTrucks(next);

    const targetOrgId = truckToDelete?.organizationId || orgId;
    if (truckToDelete && (truckToDelete.isApproved === false || truckToDelete.requestStatus === 'Rejected') && targetOrgId) {
      const targetProfile = organizationProfiles.find(p => p.organizationId === targetOrgId);
      if (targetProfile) {
        const nextRequests = (targetProfile.truckRequests || []).filter(
          r => !(r.truckNo.toUpperCase() === truckToDelete.truckNo.toUpperCase() && (r.status === 'Pending' || r.status === 'Rejected'))
        );
        const nextProfiles = organizationProfiles.map(p =>
          p.organizationId === targetOrgId
            ? { ...p, truckRequests: nextRequests }
            : p
        );
        saveOrganizationProfiles(nextProfiles);
      }
    }

    if (truckToDelete) {
      logAction('Deleted', 'Truck', truckToDelete.truckNo, `Archived vehicle registration datasheet`);
    }
    showNotification(`Truck archived from list.`);
    pushFleetSnapshotNow(next);
  };

  return { get trucks() { return trucks(); }, setTrucks, get orgTrucks() { return orgTrucks(); }, saveTrucks, addTruck, updateTruck, deleteTruck };
}
