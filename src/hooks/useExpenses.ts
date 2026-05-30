import { useState } from 'react';
import { ExpenseEntry } from '../types';
import { migrateExpenses } from '../lib/migrations';
import { getExpenseDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

interface UseExpensesParams {
  orgId: string;
  showNotification: (msg: string) => void;
  logAction: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
  loadDashboardData: (month: string, year: string) => Promise<void>;
  activeMonth: string;
  activeYear: string;
}

export function useExpenses({ orgId, showNotification, logAction, loadDashboardData, activeMonth, activeYear }: UseExpensesParams) {
  const [expenses, setExpenses] = useState<ExpenseEntry[]>(() => {
    try {
      const stored = localStorage.getItem('ttt_expenses');
      return stored ? migrateExpenses(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  });

  const saveExpenses = (newExpenses: ExpenseEntry[]) => {
    setExpenses(newExpenses);
    localStorage.setItem('ttt_expenses', JSON.stringify(newExpenses));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgExpenses = orgId === 'org_backend' ? expenses : expenses.filter(e => e.organizationId === orgId);

  const addExpense = async (expenseInput: Omit<ExpenseEntry, 'id'>) => {
    const newExp = {
      ...expenseInput,
      id: 'exp_id_' + Date.now(),
      organizationId: orgId
    };

    const nextExpenses = [...expenses, newExp];
    saveExpenses(nextExpenses);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'expenses', newExp.id, orgId, newExp);
      } catch (err) {
        console.warn("Failed to save expense to Appwrite:", err);
      }
    }
    await loadDashboardData(activeMonth, activeYear);

    logAction('Created', 'Expense', newExp.truckNo, `Vouched ₹${newExp.amount} expense for truck (${newExp.expenseType})`);
    showNotification(`New expense of ₹${newExp.amount.toLocaleString()} registered.`);
  };

  const updateExpense = async (updated: ExpenseEntry) => {
    const oldExpense = expenses.find(e => e.id === updated.id);
    const merged: ExpenseEntry = oldExpense ? { ...oldExpense, ...updated } : updated;
    const next = expenses.map(e => e.id === updated.id ? merged : e);
    saveExpenses(next);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'expenses', merged.id, orgId, merged);
      } catch (err) {
        console.warn("Failed to update expense in Appwrite:", err);
      }
    }
    await loadDashboardData(activeMonth, activeYear);

    const diff = oldExpense ? getExpenseDiff(oldExpense, merged) : `Voucher authorization updated to ${merged.status}`;
    if (diff) {
      logAction('Edited', 'Expense', merged.truckNo, diff);
    }
    showNotification(`Expense record has been updated.`);
  };

  const deleteExpense = async (id: string) => {
    const exp = expenses.find(e => e.id === id);
    const next = expenses.filter(e => e.id !== id);
    saveExpenses(next);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.deleteFleetDocument(databaseId, 'expenses', id);
      } catch (err) {
        console.warn("Failed to delete expense from Appwrite:", err);
      }
    }
    await loadDashboardData(activeMonth, activeYear);

    if (exp) {
      logAction('Deleted', 'Expense', exp.truckNo, `Canceled/archived ₹${exp.amount} voucher`);
    }
    showNotification(`Expense record deleted.`);
  };

  return { expenses, setExpenses, orgExpenses, saveExpenses, addExpense, updateExpense, deleteExpense };
}
