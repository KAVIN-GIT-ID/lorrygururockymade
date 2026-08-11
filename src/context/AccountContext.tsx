import { createContext, useContext, createMemo, createEffect, JSX, createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { Account } from '../types';
import { migrateAccounts } from '../lib/migrations';
import { getAccountDiff } from '../utils/diffUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db, dbUnlocked, prewarmedData } from '../services/cache';
import { usePermissions } from './PermissionContext';
import { useNotifications } from './NotificationContext';
import { useTripsContext } from './TripContext';

interface AccountContextType {
  accounts: Account[];
  orgAccounts: () => Account[];
  saveAccounts: (newAccounts: Account[] | ((prev: Account[]) => Account[])) => void;
  addAccount: (accountInput: Omit<Account, 'id'>) => Promise<void>;
  updateAccount: (updated: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
}

const AccountContext = createContext<AccountContextType>();

export function AccountProvider(props: { children: JSX.Element }) {
  const { currentUserOrgId } = usePermissions();
  const { showNotification } = useNotifications();
  const { orgTrips } = useTripsContext();

  const [accountsStore, setAccountsStore] = createStore<Account[]>([]);
  const [loadedFromDB, setLoadedFromDB] = createSignal(false);

  createEffect(() => {
    if (!dbUnlocked()) return;
    if (prewarmedData.accounts && prewarmedData.accounts.length > 0) {
      setAccountsStore(prewarmedData.accounts);
      setLoadedFromDB(true);
    }
    db.accounts.toArray().then(cached => {
      setAccountsStore(cached || []);
      setLoadedFromDB(true);
    });
  });

  let initialLoadCompleted = false;
  createEffect(() => {
    if (!dbUnlocked() || !loadedFromDB()) return;
    const list = JSON.parse(JSON.stringify(accountsStore));
    if (!initialLoadCompleted) {
      if (list.length > 0) initialLoadCompleted = true;
      else return;
    }
    if (list.length === 0) {
      db.accounts.clear();
    } else {
      db.accounts.bulkPut(list);
    }
  });

  const saveAccounts = (newAccounts: Account[] | ((prev: Account[]) => Account[])) => {
    const next = typeof newAccounts === 'function' ? newAccounts(accountsStore) : newAccounts;
    setAccountsStore(next);
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  };

  const orgAccounts = createMemo(() => {
    const orgId = currentUserOrgId() || 'org_default';
    return accountsStore.filter(a => {
      if (!a.organizationId || a.organizationId === 'org_default') return true;
      return (a.organizationId || '').toLowerCase().trim() === orgId.toLowerCase().trim();
    });
  });

  const addAccount = async (accountInput: Omit<Account, 'id'>) => {
    const orgId = currentUserOrgId() || 'org_default';
    const isDup = orgAccounts().some(a => a.accountName.toLowerCase().trim() === accountInput.accountName.toLowerCase().trim());
    if (isDup) {
      alert("Account/Ledger name is already registered.");
      return;
    }
    const n = {
      ...accountInput,
      id: 'a_id_' + Date.now(),
      organizationId: orgId
    };

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'accounts', n.id, orgId, n);
        n.syncState = 'synced';
      } catch (err) {
        console.error("Failed to save account to Appwrite:", err);
        alert("Error: Failed to register account ledger in server database. Connection offline or permissions missing.");
        return;
      }
    }

    saveAccounts([...accountsStore, n]);
    showNotification(`Ledger Account ${n.accountName} opened.`);
  };

  const updateAccount = async (updated: Account) => {
    const orgId = currentUserOrgId() || 'org_default';
    const oldAccount = accountsStore.find(a => a.id === updated.id);
    const merged = oldAccount ? { ...oldAccount, ...updated } : { ...updated, organizationId: orgId };

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'accounts', merged.id, orgId, merged);
        merged.syncState = 'synced';
      } catch (err) {
        console.error("Failed to update account in Appwrite:", err);
        alert("Error: Failed to save changes in server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = accountsStore.map(a => a.id === updated.id ? merged : a);
    saveAccounts(next);

    const diff = getAccountDiff(oldAccount, merged);
    if (diff) {
      // Log action
    }
    showNotification(`Details updated for ledger ${merged.accountName}.`);
  };

  const deleteAccount = async (id: string) => {
    const orgId = currentUserOrgId() || 'org_default';
    const account = accountsStore.find(x => x.id === id);
    if (!account) return;

    // Check trips
    const hasTrips = orgTrips().some(trip => 
      trip.advances?.some(adv => adv.fromAccountId === id) || 
      trip.payments?.some(pay => pay.receivedBy === id)
    );
    if (hasTrips) {
      alert("Error: Cannot delete this ledger account because it is linked to recorded transactions. To maintain database consistency, archive or edit the transactions first.");
      return;
    }

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.deleteFleetDocument(databaseId, 'accounts', id);
      } catch (err) {
        console.error("Failed to delete account in Appwrite:", err);
        alert("Error: Failed to delete ledger from server database. Connection offline or permissions missing.");
        return;
      }
    }

    const next = accountsStore.filter(x => x.id !== id);
    saveAccounts(next);
    showNotification(`Ledger Account ${account.accountName} closed.`);
  };

  const accountValue: AccountContextType = {
    get accounts() { return accountsStore; },
    orgAccounts,
    saveAccounts,
    addAccount,
    updateAccount,
    deleteAccount
  };

  return (
    <AccountContext.Provider value={accountValue}>
      {props.children}
    </AccountContext.Provider>
  );
}

export function useAccountsContext() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccountsContext must be used within an AccountProvider');
  }
  return context;
}
