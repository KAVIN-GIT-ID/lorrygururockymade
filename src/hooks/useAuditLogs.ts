import { useState } from 'react';
import { AuditLog } from '../types';
import { migrateAuditLogs } from '../lib/migrations';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

interface UseAuditLogsParams {
  currentUser: { email?: string; name?: string } | null;
  currentUserOrgId: string;
  showNotification: (msg: string) => void;
}

export function useAuditLogs({ currentUser, currentUserOrgId, showNotification }: UseAuditLogsParams) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('fleet_audit_logs');
      if (saved) return migrateAuditLogs(JSON.parse(saved));
      return [];
    } catch {
      return [];
    }
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
      organizationId: targetOrgId || currentUserOrgId
    };

    setAuditLogs(prev => {
      const nextLogs = [newLog, ...prev];
      localStorage.setItem('fleet_audit_logs', JSON.stringify(nextLogs));
      return nextLogs;
    });

    if (isAppwriteConfigured() && currentUserOrgId) {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      appwrite.saveFleetDocument(databaseId, 'audit_logs', newLog.id, newLog.organizationId || currentUserOrgId, newLog)
        .catch(err => console.warn("Failed to sync audit log to Appwrite:", err));
    }
  };

  const handleClearAuditLogs = () => {
    setAuditLogs([]);
    localStorage.removeItem('fleet_audit_logs');
    showNotification("Audit logs history successfully cleared.");
  };

  return { auditLogs, setAuditLogs, logAction, handleClearAuditLogs };
}
