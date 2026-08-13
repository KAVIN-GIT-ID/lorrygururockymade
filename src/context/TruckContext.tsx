import { createContext, useContext, createMemo, createEffect, JSX, createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { Truck, createRecord, mutateRecord } from '../types';
import { migrateTrucks } from '../lib/migrations';
import { getTruckDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db, dbUnlocked, prewarmedData } from '../services/cache';
import { useAuth } from './AuthContext';
import { usePermissions } from './PermissionContext';
import { useNotifications } from './NotificationContext';
import { useOrganizations } from './OrganizationContext';
import { useTripsContext } from './TripContext';

interface TruckContextType {
  trucks: Truck[];
  orgTrucks: () => Truck[];
  approvedOrgTrucks: () => Truck[];
  saveTrucks: (newTrucks: Truck[] | ((prev: Truck[]) => Truck[])) => void;
  addTruck: (truckInput: Omit<Truck, 'id'>) => Promise<void>;
  updateTruck: (updated: Truck) => Promise<void>;
  deleteTruck: (id: string) => Promise<void>;
  handleAddTruckRequest: (requestInput: any) => Promise<void>;
  handleServiceDone: (opts: { truckId: string; expenseId: string; expenseAmount: number; serviceDate: string; details: string; addExpenseCallback: any }) => Promise<void>;
  handleProcessTruckPayment: (truckPayload: Omit<Truck, 'id'>, paymentDetails: any, existingTruckId?: string | null) => Promise<void>;
}

const TruckContext = createContext<TruckContextType>();

export function TruckProvider(props: { children: JSX.Element }) {
  const { currentUser } = useAuth();
  const { currentUserOrgId, currentUserRights } = usePermissions();
  const { showNotification } = useNotifications();
  const { organizationProfiles, saveProfiles } = useOrganizations();
  const { orgTrips } = useTripsContext();

  const [trucksStore, setTrucksStore] = createStore<Truck[]>([]);
  const [loadedFromDB, setLoadedFromDB] = createSignal(false);

  createEffect(() => {
    if (!dbUnlocked()) return;
    if (prewarmedData.trucks && prewarmedData.trucks.length > 0) {
      setTrucksStore(prewarmedData.trucks);
      setLoadedFromDB(true);
    }
    db.trucks.toArray().then(cached => {
      setTrucksStore(cached || []);
      setLoadedFromDB(true);
    });
  });

  let initialLoadCompleted = false;
  createEffect(() => {
    if (!dbUnlocked() || !loadedFromDB()) return;
    const list = JSON.parse(JSON.stringify(trucksStore));
    if (!initialLoadCompleted) {
      if (list.length > 0) initialLoadCompleted = true;
      else return;
    }
    if (list.length === 0) {
      db.trucks.clear();
    } else {
      db.trucks.bulkPut(list);
    }
  });

  const saveTrucks = (newTrucks: Truck[] | ((prev: Truck[]) => Truck[])) => {
    const next = typeof newTrucks === 'function' ? newTrucks(trucksStore) : newTrucks;
    setTrucksStore(next);
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const normalizeTruckNo = (no: string) => (no || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

  const orgTrucks = createMemo(() => {
    const orgId = currentUserOrgId() || 'org_default';
    const isSuper = !!currentUserRights()?.isSuperAdmin || currentUserOrgId() === 'org_backend';
    const rawFiltered = trucksStore.filter(t => {
      if (t.deletedAt) return false;
      if (isSuper) return true;
      if (!t.organizationId || t.organizationId === 'org_default') return true;
      return (t.organizationId || '').toLowerCase().trim() === orgId.toLowerCase().trim();
    });
    const tripsList = orgTrips();
    const seen = new Set<string>();
    const filtered: Truck[] = [];

    for (const t of rawFiltered) {
      const key = (t.truckNo || t.id || '').toUpperCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const cleanNo = normalizeTruckNo(t.truckNo);
      let maxTripKM = 0;
      if (cleanNo && tripsList) {
        tripsList.forEach(tr => {
          if (tr.deletedAt) return;
          const trCleanNo = normalizeTruckNo(tr.truckNo);
          if (trCleanNo === cleanNo) {
            if (tr.endingKM && tr.endingKM > maxTripKM) maxTripKM = tr.endingKM;
            (tr.subTrips || []).forEach(st => {
              if (st.endingKM && st.endingKM > maxTripKM) maxTripKM = st.endingKM;
            });
          }
        });
      }

      const effectiveCurrentKM = Math.max(t.currentKM || 0, maxTripKM);
      const effectiveTruck = effectiveCurrentKM !== t.currentKM ? { ...t, currentKM: effectiveCurrentKM } : t;

      filtered.push(effectiveTruck);
    }
    return filtered;
  });

  createEffect(() => {
    if (!loadedFromDB()) return;
    const currentOrgTrucks = orgTrucks();
    let updatedAny = false;
    const nextStore = trucksStore.map(t => {
      const cleanNo = normalizeTruckNo(t.truckNo);
      const match = currentOrgTrucks.find(ot => ot.id === t.id || (cleanNo && normalizeTruckNo(ot.truckNo) === cleanNo));
      if (match && match.currentKM !== undefined && match.currentKM !== t.currentKM && match.currentKM > (t.currentKM || 0)) {
        updatedAny = true;
        return { ...t, currentKM: match.currentKM };
      }
      return t;
    });

    if (updatedAny) {
      saveTrucks(nextStore);
    }
  });

  const approvedOrgTrucks = createMemo(() => {
    return orgTrucks().filter(t => !t.deletedAt && t.status !== 'Admin Disabled');
  });

  const addTruck = async (truckInput: Omit<Truck, 'id'>) => {
    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
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

    saveTrucks([...trucksStore, n]);
    showNotification(`Truck ${n.truckNo} added successfully.`);
  };

  const updateTruck = async (updated: Truck) => {
    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
    const cleanTruckNo = (updated.truckNo || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const oldTruck = trucksStore.find(t =>
      t.id === updated.id ||
      (t.truckNo && (t.truckNo || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanTruckNo)
    );

    const merged: Truck = oldTruck
      ? mutateRecord(oldTruck, { ...updated, id: oldTruck.id, organizationId: orgId }, currentUserId)
      : createRecord<Truck>({ ...updated, organizationId: orgId } as any, currentUserId);

    if (oldTruck && !getTruckDiff(oldTruck, merged)) {
      console.log(`[TruckContext] Zero modifications for Truck ${merged.truckNo}. Skipping Appwrite write.`);
      showNotification(`No changes detected for Truck ${merged.truckNo}. Record unchanged.`);
      return;
    }

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'trucks', merged.id, orgId, merged);
        merged.syncState = 'synced';
      } catch (err) {
        console.error("Failed to save truck updates to Appwrite. Action aborted:", err);
        alert("Error: Failed to save changes in server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = trucksStore.map(t =>
      (t.id === merged.id || (t.truckNo && (t.truckNo || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanTruckNo)) ? merged : t
    );
    saveTrucks(next);

    const diff = getTruckDiff(oldTruck, merged);
    if (diff) {
      // Log action
    }
    showNotification(`Truck ${merged.truckNo} details updated.`);
  };

  const deleteTruck = async (id: string) => {
    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
    const t = trucksStore.find(x => x.id === id);
    if (!t) return;

    const inUse = orgTrips().some(tr => tr.truckNo === t.truckNo);
    if (inUse) {
      alert(`Cannot delete Truck ${t.truckNo}. It is associated with active trip registers.`);
      return;
    }

    const updated = mutateRecord(t, { deletedAt: new Date().toISOString() }, currentUserId);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'trucks', id, orgId, updated);
        updated.syncState = 'synced';
      } catch (err) {
        console.error("Failed to delete truck in Appwrite:", err);
        alert("Error: Failed to archive truck in server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = trucksStore.map(x => x.id === id ? updated : x);
    saveTrucks(next);
    showNotification(`Truck ${t.truckNo} archived successfully.`);
  };

  const handleAddTruckRequest = async (requestInput: any) => {
    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
    const nextProfiles = organizationProfiles().map(p => {
      if (p.organizationId === orgId) {
        const newReq = createRecord({
          ...requestInput,
          id: 'req_' + Date.now(),
          status: 'Pending',
          timestamp: new Date().toISOString()
        }, currentUserId);
        return {
          ...p,
          truckRequests: [...(p.truckRequests || []), newReq]
        };
      }
      return p;
    });
    await saveProfiles(nextProfiles as any);
  };

  const handleServiceDone = async (opts: { truckId: string; expenseId: string; expenseAmount: number; serviceDate: string; details: string; addExpenseCallback: any }) => {
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
    const truck = trucksStore.find(t => t.id === opts.truckId);
    if (!truck) return;

    const nextServiceStr = opts.serviceDate;
    const nextServiceDue = new Date(nextServiceStr);
    nextServiceDue.setMonth(nextServiceDue.getMonth() + 6);
    const serviceDueStr = nextServiceDue.toISOString().split('T')[0];

    const nextTruck = mutateRecord(truck as any, {
      lastServiceDate: nextServiceStr,
      nextServiceDueDate: serviceDueStr
    } as any, currentUserId);

    await updateTruck(nextTruck);

    if (opts.expenseAmount > 0 && typeof opts.addExpenseCallback === 'function') {
      await opts.addExpenseCallback({
        id: opts.expenseId,
        date: opts.serviceDate,
        truckNo: truck.truckNo,
        truckId: truck.id,
        category: 'Maintenance/Service',
        amount: opts.expenseAmount,
        notes: `Auto-recorded maintenance service. Details: ${opts.details}`,
        status: 'Approved'
      });
    }
    showNotification(`Maintenance record logged for truck ${truck.truckNo}.`);
  };

  const handleProcessTruckPayment = async (truckPayload: Omit<Truck, 'id'>, paymentDetails: any, existingTruckId?: string | null) => {
    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
    if (existingTruckId) {
      const match = trucksStore.find(t => t.id === existingTruckId);
      if (match) {
        const nextTruck = mutateRecord(match as any, {
          isApproved: true,
          requestStatus: 'Approved',
          amountPaid: ((match as any).amountPaid || 0) + paymentDetails.amountPaid,
          activationPayments: [...((match as any).activationPayments || []), {
            id: 'pay_' + Date.now(),
            date: new Date().toISOString().split('T')[0],
            amount: paymentDetails.amountPaid,
            mode: paymentDetails.mode,
            refNo: paymentDetails.refNo
          }]
        } as any, currentUserId);
        await updateTruck(nextTruck);
      }
    } else {
      const isDup = orgTrucks().some(t => t.truckNo.toUpperCase().trim() === truckPayload.truckNo.toUpperCase().trim());
      if (isDup) {
        alert("Truck registration error: Number already exists.");
        return;
      }
      const newTruck = createRecord<any>({
        ...truckPayload,
        id: 't_id_' + Date.now(),
        organizationId: orgId,
        isApproved: true,
        requestStatus: 'Approved',
        amountPaid: paymentDetails.amountPaid,
        activationPayments: [{
          id: 'pay_' + Date.now(),
          date: new Date().toISOString().split('T')[0],
          amount: paymentDetails.amountPaid,
          mode: paymentDetails.mode,
          refNo: paymentDetails.refNo
        }]
      }, currentUserId);

      if (isAppwriteConfigured()) {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'trucks', newTruck.id, orgId, newTruck);
        newTruck.syncState = 'synced';
      }
      saveTrucks([...trucksStore, newTruck]);
    }
  };

  const truckValue: TruckContextType = {
    get trucks() { return trucksStore; },
    orgTrucks,
    approvedOrgTrucks,
    saveTrucks,
    addTruck,
    updateTruck,
    deleteTruck,
    handleAddTruckRequest,
    handleServiceDone,
    handleProcessTruckPayment
  };

  return (
    <TruckContext.Provider value={truckValue}>
      {props.children}
    </TruckContext.Provider>
  );
}

export function useTrucksContext() {
  const context = useContext(TruckContext);
  if (!context) {
    throw new Error('useTrucksContext must be used within a TruckProvider');
  }
  return context;
}
