import { createSignal, createMemo, createEffect } from 'solid-js';
import { ExpenseEntry, createRecord, mutateRecord } from '../types';
import { migrateExpenses } from '../lib/migrations';
import { getExpenseDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db } from '../services/cache';

interface UseExpensesParams {
  orgId: string;
  showNotification: (msg: string) => void;
  logAction: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
  loadDashboardData: (month: string, year: string) => Promise<void>;
  activeMonth: string;
  activeYear: string;
  currentUserId: string;
}

export function useExpenses({ orgId, showNotification, logAction, loadDashboardData, activeMonth, activeYear, currentUserId }: UseExpensesParams) {
  const [expenses, setExpenses] = createSignal<ExpenseEntry[]>((() => {
    try {
      const stored = localStorage.getItem('ttt_expenses');
      return stored ? migrateExpenses(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  })());

  // Load from Dexie cache on start
  createEffect(() => {
    db.expenses.toArray().then(cached => {
      if (cached && cached.length > 0) {
        setExpenses(cached);
      }
    });
  });

  // Sync back to Dexie cache reactively
  createEffect(() => {
    const list = expenses();
    db.expenses.clear().then(() => db.expenses.bulkPut(list));
  });

  const saveExpenses = (newExpenses: ExpenseEntry[]) => {
    setExpenses(newExpenses);
    localStorage.setItem('ttt_expenses', JSON.stringify(newExpenses));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgExpenses = createMemo(() => (orgId === 'org_backend' ? expenses() : expenses().filter(e => e.organizationId === orgId)).filter(e => !e.deletedAt));

  const addExpense = async (expenseInput: Omit<ExpenseEntry, 'id'>) => {
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
        console.error("Failed to save expense to Appwrite. Action aborted:", err);
        alert("Error: Failed to register expense in server database. Please check your connection or permissions.");
        return;
      }
    }

    const nextExpenses = [...expenses(), newExp];
    saveExpenses(nextExpenses);
    await loadDashboardData(activeMonth, activeYear);

    logAction('Created', 'Expense', newExp.truckNo, `Vouched ₹${newExp.amount} expense for truck (${newExp.expenseType})`);
    showNotification(`New expense of ₹${newExp.amount.toLocaleString()} registered.`);
  };

  const updateExpense = async (updated: ExpenseEntry) => {
    const oldExpense = expenses().find(e => e.id === updated.id);
    const merged: ExpenseEntry = oldExpense
      ? mutateRecord(oldExpense, updated, currentUserId)
      : createRecord<ExpenseEntry>({ ...updated, organizationId: orgId } as any, currentUserId);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'expenses', merged.id, orgId, merged);
        merged.syncState = 'synced';
      } catch (err) {
        console.error("Failed to update expense in Appwrite. Action aborted:", err);
        alert("Error: Failed to update expense in server database. Please check your connection or permissions.");
        return;
      }
    }

    const next = expenses().map(e => e.id === updated.id ? merged : e);
    saveExpenses(next);
    await loadDashboardData(activeMonth, activeYear);

    const diff = oldExpense ? getExpenseDiff(oldExpense, merged) : `Voucher authorization updated to ${merged.status}`;
    if (diff) {
      logAction('Edited', 'Expense', merged.truckNo, diff);
    }
    showNotification(`Expense record has been updated.`);
  };

  const deleteExpense = async (id: string) => {
    const exp = expenses().find(e => e.id === id);
    if (!exp) return;

    const updatedExpense = mutateRecord(exp, { deletedAt: new Date().toISOString() }, currentUserId);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'expenses', id, orgId, updatedExpense);
        updatedExpense.syncState = 'synced';
      } catch (err) {
        console.error("Failed to delete expense from Appwrite. Action aborted:", err);
        alert("Error: Failed to delete expense from server database. Please check your connection or permissions.");
        return;
      }
    }

    const next = expenses().map(e => e.id === id ? updatedExpense : e);
    saveExpenses(next);
    await loadDashboardData(activeMonth, activeYear);

    logAction('Deleted', 'Expense', exp.truckNo, `Canceled/archived ₹${exp.amount} voucher`);
    showNotification(`Expense record deleted.`);
  };

  return { get expenses() { return expenses(); }, setExpenses, get orgExpenses() { return orgExpenses(); }, saveExpenses, addExpense, updateExpense, deleteExpense };
}
