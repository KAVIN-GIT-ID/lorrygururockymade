import { useState } from 'react';
import { Tyre, ExpenseEntry, TyreMovementLog } from '../types';
import { migrateTyres } from '../lib/migrations';

interface UseTyresParams {
  orgId: string;
  expenses: ExpenseEntry[];
  saveExpenses: (newExpenses: ExpenseEntry[]) => void;
  showNotification: (msg: string) => void;
  logAction: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
  loadDashboardData: (month: string, year: string) => Promise<void>;
  activeMonth: string;
  activeYear: string;
}

export function useTyres({ orgId, expenses, saveExpenses, showNotification, logAction, loadDashboardData, activeMonth, activeYear }: UseTyresParams) {
  const [tyres, setTyres] = useState<Tyre[]>(() => {
    try {
      const stored = localStorage.getItem('ttt_tyres');
      return stored ? migrateTyres(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  });

  const saveTyres = (newTyres: Tyre[]) => {
    setTyres(newTyres);
    localStorage.setItem('ttt_tyres', JSON.stringify(newTyres));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgTyres = orgId === 'org_backend' ? tyres : tyres.filter(t => t.organizationId === orgId);

  const addTyre = async (
    tyreInput: Omit<Tyre, 'id' | 'movementHistory' | 'accumulatedKM'>,
    expenseDetails?: {
      createExpense: boolean;
      truckNo?: string;
      paymentMode?: string;
    }
  ) => {
    const isDup = orgTyres.some(t => t.tyreNo.toUpperCase().trim() === tyreInput.tyreNo.toUpperCase().trim());
    if (isDup) {
      alert("Tyre Serial Number already registered in warehouse database.");
      return;
    }

    const isMountedImmediately = tyreInput.status === 'Active' && tyreInput.currentTruckNo;

    const n: Tyre = {
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
      ] as TyreMovementLog[]
    };

    const nextTyres = [...tyres, n];
    saveTyres(nextTyres);

    logAction('Created', 'Tyre', n.tyreNo, `Registered brand new ${n.manufacturer} (${n.size}) tyre to yard warehouse.`);

    if (expenseDetails?.createExpense && tyreInput.purchaseAmount && tyreInput.purchaseAmount > 0) {
      const expNo = 'EXP_' + Date.now();
      const newExpense: ExpenseEntry = {
        id: expNo,
        truckNo: expenseDetails.truckNo || 'YARD / WH',
        expenseType: 'Tyre Purchase',
        shopName: `${tyreInput.manufacturer} (Tyre Serial: ${tyreInput.tyreNo})`,
        amount: tyreInput.purchaseAmount,
        paymentMode: expenseDetails.paymentMode || 'Cash',
        date: tyreInput.purchaseDate || '2026-05-23',
        status: 'Paid',
        organizationId: orgId
      };

      saveExpenses([...expenses, newExpense]);

      await loadDashboardData(activeMonth, activeYear);

      logAction('Created', 'Expense', expNo, `Auto-created Tyre purchase expense for Serial ${n.tyreNo} charge to vehicle ${newExpense.truckNo} of ₹${newExpense.amount.toLocaleString()}`);
      showNotification(`Tyre ${n.tyreNo} registered and purchase expense voucher added.`);
    } else {
      showNotification(`Tyre ${n.tyreNo} registered successfully.`);
    }
  };

  const updateTyre = async (updated: Tyre) => {
    const oldTyre = tyres.find(t => t.id === updated.id);
    const merged: Tyre = oldTyre ? { ...oldTyre, ...updated } : updated;
    const next = tyres.map(t => t.id === updated.id ? merged : t);
    saveTyres(next);

    let actionD = `Updated tyre specifications`;
    if (oldTyre && oldTyre.status !== merged.status) {
      actionD = `Status transitioned from ${oldTyre.status} to ${merged.status}`;
      if (merged.status === 'Active' && merged.currentTruckNo) {
        actionD += ` (Mounted on truck ${merged.currentTruckNo} at odo ${merged.installationKM} KM)`;
      } else if (merged.status === 'Available' && oldTyre.status === 'Active') {
        const movementLog = merged.movementHistory[0];
        actionD += ` (Dismounted from truck ${oldTyre.currentTruckNo}. ${movementLog?.remarks})`;
      } else if (merged.status === 'Sold') {
        actionD += ` (Disposed for ₹${merged.saleAmount} on ${merged.saleDate})`;
      } else if (merged.status === 'Scrapped') {
        actionD += ` (Permanently decommissioned and recycled)`;
      }
    }
    logAction('Edited', 'Tyre', merged.tyreNo, actionD);
    showNotification(`Tyre ${merged.tyreNo} status updated.`);
  };

  const deleteTyre = async (id: string) => {
    const tyreToDelete = tyres.find(t => t.id === id);
    if (!tyreToDelete) return;
    if (tyreToDelete.status === 'Active') {
      alert("Cannot delete an active tyre currently mounted on a running vehicle. Dismount it first.");
      return;
    }
    const next = tyres.filter(t => t.id !== id);
    saveTyres(next);

    logAction('Deleted', 'Tyre', tyreToDelete.tyreNo, `Removed tyre serial ${tyreToDelete.tyreNo} specification datasheet.`);
    showNotification(`Tyre archived.`);
  };

  return { tyres, setTyres, orgTyres, saveTyres, addTyre, updateTyre, deleteTyre };
}
