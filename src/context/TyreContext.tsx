import { createContext, useContext, createMemo, createEffect, JSX, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Tyre, TyreMovementLog } from '../types';
import { migrateTyres } from '../lib/migrations';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db, dbUnlocked } from '../services/cache';
import { usePermissions } from './PermissionContext';
import { useNotifications } from './NotificationContext';
import { useExpensesContext } from './ExpenseContext';

interface TyreContextType {
  tyres: Tyre[];
  orgTyres: () => Tyre[];
  saveTyres: (newTyres: Tyre[] | ((prev: Tyre[]) => Tyre[])) => void;
  addTyre: (
    tyreInput: Omit<Tyre, 'id' | 'movementHistory' | 'accumulatedKM'>,
    expenseDetails?: {
      createExpense: boolean;
      truckNo?: string;
      paymentMode?: string;
    }
  ) => Promise<void>;
  updateTyre: (updated: Tyre) => Promise<void>;
  deleteTyre: (id: string) => Promise<void>;
}

const TyreContext = createContext<TyreContextType>();

export function TyreProvider(props: { children: JSX.Element }) {
  const { currentUserOrgId } = usePermissions();
  const { showNotification } = useNotifications();
  const { expenses, saveExpenses } = useExpensesContext();

  const [tyresStore, setTyresStore] = createStore<Tyre[]>([]);
  const [loadedFromDB, setLoadedFromDB] = createSignal(false);

  createEffect(() => {
    if (!dbUnlocked()) return;
    db.tyres.toArray().then(cached => {
      setTyresStore(cached || []);
      setLoadedFromDB(true);
    });
  });

  createEffect(() => {
    if (!dbUnlocked() || !loadedFromDB()) return;
    const list = [...tyresStore];
    db.tyres.clear().then(() => db.tyres.bulkPut(list));
  });

  const saveTyres = (newTyres: Tyre[] | ((prev: Tyre[]) => Tyre[])) => {
    const next = typeof newTyres === 'function' ? newTyres(tyresStore) : newTyres;
    setTyresStore(next);
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgTyres = createMemo(() => {
    const orgId = currentUserOrgId() || 'org_default';
    return orgId === 'org_backend' ? tyresStore : tyresStore.filter(t => t.organizationId === orgId);
  });

  const addTyre = async (
    tyreInput: Omit<Tyre, 'id' | 'movementHistory' | 'accumulatedKM'>,
    expenseDetails?: {
      createExpense: boolean;
      truckNo?: string;
      paymentMode?: string;
    }
  ) => {
    const orgId = currentUserOrgId() || 'org_default';
    const isDup = orgTyres().some(t => t.tyreNo.toUpperCase().trim() === tyreInput.tyreNo.toUpperCase().trim());
    if (isDup) {
      alert("Tyre Serial Number already registered in warehouse database.");
      return;
    }

    const isMountedImmediately = tyreInput.status === 'Active' && tyreInput.currentTruckNo;

    const n = {
      ...tyreInput,
      id: 'tyre_' + Date.now(),
      organizationId: orgId,
      accumulatedKM: 0,
      movementHistory: [
        {
          id: 'mvt_init',
          action: isMountedImmediately ? 'Installed' : 'Removed',
          date: tyreInput.purchaseDate || '2026-05-23',
          remarks: isMountedImmediately
            ? `Initial purchase & direct installation on Truck ${tyreInput.currentTruckNo} at install ODO ${tyreInput.installationKM || 0} KM`
            : `Registered new stock purchase specifications in warehouse ledger.`
        }
      ]
    };

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'tyres', n.id, orgId, n);
      } catch (err) {
        console.error("Failed to save tyre to Appwrite. Action aborted:", err);
        alert("Error: Failed to register tyre in server database. Please check your connection or permissions.");
        return;
      }
    }

    saveTyres([...tyresStore, n as any]);
    showNotification(`Tyre ${n.tyreNo} registered in stock registry.`);

    if (expenseDetails?.createExpense && tyreInput.purchaseAmount && tyreInput.purchaseAmount > 0) {
      const expNo = 'EXP_' + Date.now();
      const newExpense = {
        id: expNo,
        truckNo: expenseDetails.truckNo || 'YARD / WH',
        expenseType: 'Tyre Purchase',
        shopName: `${tyreInput.manufacturer} (Tyre Serial: ${tyreInput.tyreNo})`,
        amount: tyreInput.purchaseAmount,
        paymentMode: expenseDetails.paymentMode || 'Cash',
        date: tyreInput.purchaseDate || '2026-05-23',
        notes: `Automatically generated expense entry for purchasing Tyre ${tyreInput.tyreNo}.`,
        status: 'Paid' as const,
        organizationId: orgId
      };
      saveExpenses([...expenses, newExpense]);
    }
  };

  const updateTyre = async (updated: Tyre) => {
    const orgId = currentUserOrgId() || 'org_default';
    const oldTyre = tyresStore.find(t => t.id === updated.id);
    const merged = oldTyre ? { ...oldTyre, ...updated } : { ...updated, organizationId: orgId };

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'tyres', merged.id, orgId, merged);
        merged.syncState = 'synced';
      } catch (err) {
        console.error("Failed to update tyre in Appwrite:", err);
        alert("Error: Failed to save changes in server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = tyresStore.map(t => t.id === updated.id ? merged : t);
    saveTyres(next);
    showNotification(`Tyre registry record updated.`);
  };

  const deleteTyre = async (id: string) => {
    const tyre = tyresStore.find(x => x.id === id);
    if (!tyre) return;

    if (tyre.status === 'Active') {
      alert("Error: Cannot delete an active/mounted tyre. Demount it first before removing it from the stock sheet.");
      return;
    }

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.deleteFleetDocument(databaseId, 'tyres', id);
      } catch (err) {
        console.error("Failed to delete tyre in Appwrite:", err);
        alert("Error: Failed to delete tyre from server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = tyresStore.filter(x => x.id !== id);
    saveTyres(next);
    showNotification(`Tyre ${tyre.tyreNo} removed from registry.`);
  };

  const tyreValue: TyreContextType = {
    get tyres() { return tyresStore; },
    orgTyres,
    saveTyres,
    addTyre,
    updateTyre,
    deleteTyre
  };

  return (
    <TyreContext.Provider value={tyreValue}>
      {props.children}
    </TyreContext.Provider>
  );
}

export function useTyresContext() {
  const context = useContext(TyreContext);
  if (!context) {
    throw new Error('useTyresContext must be used within a TyreProvider');
  }
  return context;
}
