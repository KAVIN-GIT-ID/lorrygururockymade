import { createMemo, createEffect } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { AuditLog } from '../types';
import { migrateAuditLogs } from '../lib/migrations';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db } from '../services/cache';

interface UseAuditLogsParams {
  currentUser: { email?: string; name?: string } | null;
  currentUserOrgId: string;
  showNotification: (msg: string) => void;
}

export function useAuditLogs({ currentUser, currentUserOrgId, showNotification }: UseAuditLogsParams) {
  const [auditLogs, setAuditLogs] = createStore<AuditLog[]>((() => {
    try {
      const saved = localStorage.getItem('fleet_audit_logs');
      if (saved) return migrateAuditLogs(JSON.parse(saved));
      return [];
    } catch {
      return [];
    }
  })());

  // Load from Dexie cache on start
  createEffect(() => {
    db.auditLogs.toArray().then(cached => {
      if (cached && cached.length > 0) {
        setAuditLogs(reconcile(cached));
      }
    });
  });

  // Sync back to Dexie cache reactively
  createEffect(() => {
    const list = [...auditLogs];
    db.auditLogs.clear().then(() => db.auditLogs.bulkPut(list));
  });

  const logAction = (
    action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected',
    category: string,
    reference: string,
    details: string,
    targetOrgId?: string
  ) => {
    const userEmail = currentUser ? (currentUser.email || currentUser.name || 'Anonymous User') : 'Anonymous User';
    const newLog: AuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: userEmail,
      action,
      category,
      reference,
      details,
      organizationId: targetOrgId || currentUserOrgId || 'org_backend'
    };

    setAuditLogs(prev => {
      const nextLogs = [newLog, ...prev];
      localStorage.setItem('fleet_audit_logs', JSON.stringify(nextLogs));
      return nextLogs;
    });

    if (isAppwriteConfigured()) {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      appwrite.saveFleetDocument(databaseId, 'audit_logs', newLog.id, newLog.organizationId || currentUserOrgId || 'org_backend', newLog).catch(err => {
        console.warn("Failed to save audit log to Appwrite:", err);
      });
    }
  };

  const handleClearAuditLogs = async () => {
    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        // Delete each log from the database
        const logsToDelete = [...auditLogs];
        for (const log of logsToDelete) {
          await appwrite.deleteFleetDocument(databaseId, 'audit_logs', log.id);
        }
      } catch (err) {
        console.error("Failed to clear audit logs from Appwrite server:", err);
      }
    }
    setAuditLogs(reconcile([]));
    localStorage.removeItem('fleet_audit_logs');
    showNotification("Audit logs history successfully cleared.");
  };

  return { get auditLogs() { return auditLogs; }, setAuditLogs, logAction, handleClearAuditLogs };
}
