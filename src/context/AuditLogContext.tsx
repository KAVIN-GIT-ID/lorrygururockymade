import { createContext, useContext, createMemo, createEffect, JSX, createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { AuditLog } from '../types';
import { migrateAuditLogs } from '../lib/migrations';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db, dbUnlocked, prewarmedData } from '../services/cache';
import { useAuth } from './AuthContext';
import { usePermissions } from './PermissionContext';
import { useNotifications } from './NotificationContext';

interface AuditLogContextType {
  auditLogs: AuditLog[];
  orgAuditLogs: () => AuditLog[];
  saveAuditLogs: (newLogs: AuditLog[] | ((prev: AuditLog[]) => AuditLog[])) => void;
  logAction: (
    action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected',
    category: string,
    reference: string,
    details: string,
    targetOrgId?: string
  ) => void;
  handleClearAuditLogs: () => Promise<void>;
}

const AuditLogContext = createContext<AuditLogContextType>();

export function AuditLogProvider(props: { children: JSX.Element }) {
  const { currentUser } = useAuth();
  const { currentUserOrgId } = usePermissions();
  const { showNotification } = useNotifications();

  const [auditLogsStore, setAuditLogsStore] = createStore<AuditLog[]>([]);
  const [loadedFromDB, setLoadedFromDB] = createSignal(false);

  // Load from Dexie cache on start
  createEffect(() => {
    if (!dbUnlocked()) return;
    if (prewarmedData.auditLogs && prewarmedData.auditLogs.length > 0) {
      setAuditLogsStore(prewarmedData.auditLogs);
      setLoadedFromDB(true);
    }
    db.auditLogs.toArray().then(cached => {
      setAuditLogsStore(cached || []);
      setLoadedFromDB(true);
    });
  });

  // Sync back to Dexie cache reactively
  createEffect(() => {
    if (!dbUnlocked() || !loadedFromDB()) return;
    const list = [...auditLogsStore];
    if (list.length === 0) {
      db.auditLogs.clear();
    } else {
      db.auditLogs.bulkPut(list);
    }
  });

  const saveAuditLogs = (newLogs: AuditLog[] | ((prev: AuditLog[]) => AuditLog[])) => {
    const list = typeof newLogs === 'function' ? newLogs(auditLogsStore) : newLogs;
    setAuditLogsStore(reconcile(list, { key: 'id' }));
  };

  const orgAuditLogs = createMemo(() => {
    const orgId = currentUserOrgId() || 'org_default';
    return auditLogsStore.filter(log => log.organizationId === orgId);
  });

  const logAction = (
    action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected',
    category: string,
    reference: string,
    details: string,
    targetOrgId?: string
  ) => {
    const userEmail = currentUser() ? (currentUser().email || currentUser().name || 'Anonymous User') : 'Anonymous User';
    const orgId = currentUserOrgId() || 'org_backend';
    const newLog: AuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: userEmail,
      action,
      category,
      reference,
      details,
      organizationId: targetOrgId || orgId
    };

    const nextLogs = [newLog, ...auditLogsStore];
    saveAuditLogs(nextLogs);

    if (isAppwriteConfigured()) {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      appwrite.saveFleetDocument(databaseId, 'audit_logs', newLog.id, newLog.organizationId || orgId, newLog).catch(err => {
        console.warn("Failed to save audit log to Appwrite:", err);
      });
    }
  };

  const handleClearAuditLogs = async () => {
    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const logsToDelete = [...auditLogsStore];
        for (const log of logsToDelete) {
          await appwrite.deleteFleetDocument(databaseId, 'audit_logs', log.id);
        }
      } catch (err) {
        console.error("Failed to clear audit logs from Appwrite server:", err);
      }
    }
    saveAuditLogs([]);
    localStorage.removeItem('fleet_audit_logs');
    showNotification("Audit logs history successfully cleared.");
  };

  const value: AuditLogContextType = {
    get auditLogs() { return auditLogsStore; },
    orgAuditLogs,
    saveAuditLogs,
    logAction,
    handleClearAuditLogs
  };

  return (
    <AuditLogContext.Provider value={value}>
      {props.children}
    </AuditLogContext.Provider>
  );
}

export function useAuditLogsContext() {
  const context = useContext(AuditLogContext);
  if (!context) {
    throw new Error('useAuditLogsContext must be used within an AuditLogProvider');
  }
  return context;
}
