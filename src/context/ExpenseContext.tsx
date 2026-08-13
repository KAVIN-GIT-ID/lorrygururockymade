import { createContext, useContext, createMemo, createEffect, JSX, createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { ExpenseEntry, createRecord, mutateRecord } from '../types';
import { migrateExpenses } from '../lib/migrations';
import { getExpenseDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db, dbUnlocked, prewarmedData } from '../services/cache';
import { useAuth } from './AuthContext';
import { usePermissions } from './PermissionContext';
import { useNotifications } from './NotificationContext';

interface ExpenseContextType {
  expenses: ExpenseEntry[];
  orgExpenses: () => ExpenseEntry[];
  saveExpenses: (newExpenses: ExpenseEntry[] | ((prev: ExpenseEntry[]) => ExpenseEntry[])) => void;
  addExpense: (expenseInput: Omit<ExpenseEntry, 'id'>) => Promise<void>;
  updateExpense: (updated: ExpenseEntry) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
}

const ExpenseContext = createContext<ExpenseContextType>();

export function ExpenseProvider(props: { children: JSX.Element }) {
  const { currentUser } = useAuth();
  const { currentUserOrgId } = usePermissions();
  const { showNotification } = useNotifications();

  const [expensesStore, setExpensesStore] = createStore<ExpenseEntry[]>([]);
  const [loadedFromDB, setLoadedFromDB] = createSignal(false);

  createEffect(() => {
    if (!dbUnlocked()) return;
    if (prewarmedData.expenses && prewarmedData.expenses.length > 0) {
      setExpensesStore(prewarmedData.expenses);
      setLoadedFromDB(true);
    }
    db.expenses.toArray().then(cached => {
      setExpensesStore(cached || []);
      setLoadedFromDB(true);
    });
  });

  let initialLoadCompleted = false;
  createEffect(() => {
    if (!dbUnlocked() || !loadedFromDB()) return;
    const list = JSON.parse(JSON.stringify(expensesStore));
    if (!initialLoadCompleted) {
      if (list.length > 0) initialLoadCompleted = true;
      else return;
    }
    if (list.length === 0) {
      db.expenses.clear();
    } else {
      db.expenses.bulkPut(list);
    }
  });

  const saveExpenses = (newExpenses: ExpenseEntry[] | ((prev: ExpenseEntry[]) => ExpenseEntry[])) => {
    const next = typeof newExpenses === 'function' ? newExpenses(expensesStore) : newExpenses;
    setExpensesStore(next);
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgExpenses = createMemo(() => {
    const orgId = currentUserOrgId() || 'org_default';
    return expensesStore.filter(e => {
      if (e.deletedAt) return false;
      if (!e.organizationId || e.organizationId === 'org_default') return true;
      return (e.organizationId || '').toLowerCase().trim() === orgId.toLowerCase().trim();
    });
  });

  const addExpense = async (expenseInput: Omit<ExpenseEntry, 'id'>) => {
    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
    const newExp = createRecord<ExpenseEntry>({
      ...expenseInput,
      id: 'exp_id_' + Date.now(),
      organizationId: orgId
    }, currentUserId);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'expenses', newExp.id, orgId, newExp);
        newExp.syncState = 'synced';
      } catch (err) {
        console.error("Failed to save expense to Appwrite:", err);
        alert("Error: Failed to register expense in server database. Connection offline or permissions missing.");
        return;
      }
    }

    saveExpenses([...expensesStore, newExp]);
    showNotification(`Expense registered: ${newExp.expenseType} amount ${newExp.amount}.`);
  };

  const updateExpense = async (updated: ExpenseEntry) => {
    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
    const oldExpense = expensesStore.find(e => e.id === updated.id);
    const merged: ExpenseEntry = oldExpense
      ? mutateRecord(oldExpense, updated, currentUserId)
      : createRecord<ExpenseEntry>({ ...updated, organizationId: orgId } as any, currentUserId);

    if (oldExpense && !getExpenseDiff(oldExpense, merged)) {
      console.log(`[ExpenseContext] Zero modifications for Expense. Skipping Appwrite write.`);
      showNotification(`No changes detected for Expense record. Record unchanged.`);
      return;
    }

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'expenses', merged.id, orgId, merged);
        merged.syncState = 'synced';
      } catch (err) {
        console.error("Failed to update expense in Appwrite:", err);
        alert("Error: Failed to save changes in server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = expensesStore.map(e => e.id === updated.id ? merged : e);
    saveExpenses(next);

    const diff = getExpenseDiff(oldExpense, merged);
    if (diff) {
      // Log action
    }
    showNotification(`Expense record updated.`);
  };

  const deleteExpense = async (id: string) => {
    const orgId = currentUserOrgId() || 'org_default';
    const currentUserId = currentUser()?.$id || currentUser()?.email || 'system';
    const expense = expensesStore.find(x => x.id === id);
    if (!expense) return;

    const updated = mutateRecord(expense, { deletedAt: new Date().toISOString() }, currentUserId);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'expenses', id, orgId, updated);
        updated.syncState = 'synced';
      } catch (err) {
        console.error("Failed to delete expense in Appwrite:", err);
        alert("Error: Failed to archive expense in server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = expensesStore.map(x => x.id === id ? updated : x);
    saveExpenses(next);
    showNotification(`Expense record voided.`);
  };

  const expenseValue: ExpenseContextType = {
    get expenses() { return expensesStore; },
    orgExpenses,
    saveExpenses,
    addExpense,
    updateExpense,
    deleteExpense
  };

  return (
    <ExpenseContext.Provider value={expenseValue}>
      {props.children}
    </ExpenseContext.Provider>
  );
}

export function useExpensesContext() {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpensesContext must be used within an ExpenseProvider');
  }
  return context;
}
