import { createMemo, createEffect } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { Account, TripEntry } from '../types';
import { migrateAccounts } from '../lib/migrations';
import { getAccountDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db } from '../services/cache';

interface UseAccountsParams {
  orgId: string;
  trips: () => TripEntry[];
  showNotification: (msg: string) => void;
  logAction: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
}

export function useAccounts({ orgId, trips, showNotification, logAction }: UseAccountsParams) {
  const [accounts, setAccounts] = createStore<Account[]>((() => {
    try {
      const stored = localStorage.getItem('ttt_accounts');
      return stored ? migrateAccounts(JSON.parse(stored)) : [];
    } catch {
      return [];
    }
  })());

  // Load from Dexie cache on start
  createEffect(() => {
    db.accounts.toArray().then(cached => {
      if (cached && cached.length > 0) {
        setAccounts(reconcile(cached));
      }
    });
  });

  // Sync back to Dexie cache reactively
  createEffect(() => {
    const list = [...accounts];
    db.accounts.clear().then(() => db.accounts.bulkPut(list));
  });

  const saveAccounts = (newAccounts: Account[]) => {
    setAccounts(reconcile(newAccounts));
    localStorage.setItem('ttt_accounts', JSON.stringify(newAccounts));
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgAccounts = createMemo(() => orgId === 'org_backend' ? accounts : accounts.filter(a => a.organizationId === orgId));

  const addAccount = async (accountInput: Omit<Account, 'id'>) => {
    const isDup = orgAccounts().some(a => a.accountName.toLowerCase().trim() === accountInput.accountName.toLowerCase().trim());
    if (isDup) {
      alert("Accounting ledger with identical name already exists.");
      return;
    }
    const n = { ...accountInput, id: 'a_id_' + Date.now(), organizationId: orgId };

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'accounts', n.id, orgId, n);
      } catch (err) {
        console.error("Failed to save account to Appwrite. Action aborted:", err);
        alert("Error: Failed to register account in server database. Please check your connection or permissions.");
        return;
      }
    }

    saveAccounts([...accounts, n]);
    logAction('Created', 'Account', n.accountName, `Opened account register for ${n.accountName} (Type: ${n.type})`);
    showNotification(`Account ledger ${n.accountName} registered.`);
  };

  const updateAccount = async (updated: Account) => {
    const oldAccount = accounts.find(a => a.id === updated.id);
    const merged: Account = oldAccount ? { ...oldAccount, ...updated } : updated;

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'accounts', merged.id, orgId, merged);
      } catch (err) {
        console.error("Failed to update account in Appwrite. Action aborted:", err);
        alert("Error: Failed to update account in server database. Please check your connection or permissions.");
        return;
      }
    }

    const next = accounts.map(a => a.id === updated.id ? merged : a);
    saveAccounts(next);

    const diff = oldAccount ? getAccountDiff(oldAccount, merged) : `Adjusted ledger account balances or info`;
    if (diff) {
      logAction('Edited', 'Account', merged.accountName, diff);
    }
    showNotification(`Accounting ledger records adjusted.`);
  };

  const deleteAccount = async (id: string) => {
    const current = accounts.find(a => a.id === id);
    const orgTrips = orgId === 'org_backend' ? trips() : trips().filter(t => t.organizationId === orgId);
    const inUse = orgTrips.some(t =>
      t.payments?.some(p => p.receivedBy === id)
    );
    if (inUse) {
      alert(`Cannot delete Account ${current?.accountName}. It represents outstanding or past receipts.`);
      return;
    }

    if (isAppwriteConfigured() && current) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.deleteFleetDocument(databaseId, 'accounts', id);
      } catch (err) {
        console.error("Failed to delete account from Appwrite. Action aborted:", err);
        alert("Error: Failed to delete account from server database. Please check your connection or permissions.");
        return;
      }
    }

    const next = accounts.filter(a => a.id !== id);
    saveAccounts(next);

    if (current) {
      logAction('Deleted', 'Account', current.accountName, `Removed ledger account ${current.accountName}`);
    }
    showNotification(`Ledger account detached.`);
  };

  return { get accounts() { return accounts; }, setAccounts, get orgAccounts() { return orgAccounts(); }, saveAccounts, addAccount, updateAccount, deleteAccount };
}
