import { useState } from 'react';
import { Truck, TripEntry, OrganizationProfile, createRecord, mutateRecord } from '../types';
import { migrateTrucks } from '../lib/migrations';
import { getTruckDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

interface UseTrucksParams {
  orgId: string;
  trips: TripEntry[];
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
  const [trucks, setTrucks] = useState<Truck[]>(() => {
    try {
      const stored = localStorage.getItem('ttt_trucks');
      return stored ? migrateTrucks(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  });

  const saveTrucks = (newTrucks: Truck[]) => {
    setTrucks(newTrucks);
    localStorage.setItem('ttt_trucks', JSON.stringify(newTrucks));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgTrucks = (orgId === 'org_backend' ? trucks : trucks.filter(t => t.organizationId === orgId))
    .filter(t => !t.deletedAt);

  const addTruck = async (truckInput: Omit<Truck, 'id'>) => {
    const isDup = orgTrucks.some(t => t.truckNo.toUpperCase().trim() === truckInput.truckNo.toUpperCase().trim());
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

    saveTrucks([...trucks, n]);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'trucks', n.id, orgId, n);
      } catch (err) {
        console.warn("Failed to save truck to Appwrite:", err);
      }
    }

    logAction('Created', 'Truck', n.truckNo, `Created truck sheet for vehicle make ${n.make} Model: ${n.model}`);
    showNotification(`Truck ${n.truckNo} added successfully.`);
  };

  const updateTruck = async (updated: Truck) => {
    const oldTruck = trucks.find(t => t.id === updated.id);
    const merged: Truck = oldTruck
      ? mutateRecord(oldTruck, updated, currentUserId)
      : createRecord<Truck>({ ...updated, organizationId: orgId } as any, currentUserId);
    
    const next = trucks.map(t => t.id === updated.id ? merged : t);
    saveTrucks(next);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'trucks', merged.id, orgId, merged);
      } catch (err) {
        console.warn("Failed to update truck in Appwrite:", err);
      }

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
    }

    const diff = oldTruck ? getTruckDiff(oldTruck, merged) : `Updated truck specifications and compliance expiry dates`;
    if (diff) {
      logAction('Edited', 'Truck', merged.truckNo, diff);
    }
    showNotification(`Truck ${merged.truckNo} database specifications updated.`);
  };

  const deleteTruck = async (id: string) => {
    const truckToDelete = trucks.find(t => t.id === id);
    const orgTrips = orgId === 'org_backend' ? trips : trips.filter(t => t.organizationId === orgId);
    const inUse = orgTrips.some(tr => tr.truckNo === truckToDelete?.truckNo);
    if (inUse) {
      alert(`Cannot delete Truck ${truckToDelete?.truckNo}. It is associated with active trip registers.`);
      return;
    }
    const updatedTruck = mutateRecord(truckToDelete, { deletedAt: new Date().toISOString() }, currentUserId);
    const next = trucks.map(t => t.id === id ? updatedTruck : t);
    saveTrucks(next);

    if (isAppwriteConfigured() && truckToDelete) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'trucks', id, orgId, updatedTruck);
      } catch (err) {
        console.warn("Failed to delete truck (soft-delete) from Appwrite:", err);
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

  return { trucks, setTrucks, orgTrucks, saveTrucks, addTruck, updateTruck, deleteTruck };
}
