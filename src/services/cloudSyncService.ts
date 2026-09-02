import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import {
  migrateUserPermissions,
  migrateTrucks,
  migrateDrivers,
  migrateOffices,
  migrateAccounts,
  migrateTrips,
  migrateExpenses,
  migrateTyres,
  migrateAuditLogs,
  migrateTripsIfNecessary,
} from '../lib/migrations';
import { organizationService } from './organizationService';
import { UserPermission, OrganizationProfile, Truck, Driver, Office, Account, TripEntry, ExpenseEntry, Tyre, AuditLog, SupportTicket } from '../types';

interface SyncStates {
  trucks: Truck[];
  drivers: Driver[];
  offices: Office[];
  accounts: Account[];
  trips: TripEntry[];
  expenses: ExpenseEntry[];
  tyres: Tyre[];
  auditLogs: AuditLog[];
  supportTickets: SupportTicket[];
  userRightsList: UserPermission[];
  organizationProfiles: OrganizationProfile[];
}

interface ReconciliationResult {
  hasRelevantChanges: boolean;
  shouldTouchLastModified: boolean;
  trucks?: Truck[];
  drivers?: Driver[];
  offices?: Office[];
  accounts?: Account[];
  trips?: TripEntry[];
  expenses?: ExpenseEntry[];
  tyres?: Tyre[];
  auditLogs?: AuditLog[];
  supportTickets?: SupportTicket[];
  userRightsList?: UserPermission[];
  organizationProfiles?: OrganizationProfile[];
  notifications: Array<{
    message: string;
    actionType: 'Created' | 'Edited' | 'Deleted' | 'Approved' | 'Rejected' | 'Cloud';
    category: string;
    target: string;
    details: string;
    organizationId: string;
  }>;
}

export const cloudSyncService = {
  reconcile(
    parsed: any,
    userRightsData: any,
    quiet: boolean,
    currentUser: any,
    currentUserRights: any,
    orgId: string,
    email: string,
    isSuper: boolean,
    states: SyncStates
  ): ReconciliationResult | null {
    const recentActionAt = Number(sessionStorage.getItem('ttt_recent_action_at') || '0');
    const isRecentLocalChange = Date.now() - recentActionAt < 6000;
    if (!quiet && isRecentLocalChange) {
      return null;
    }

    const hasOrgCategoryChanged = (localItems: any[], cloudItems: any[] | undefined) => {
      if (!cloudItems) return false;
      const localOrg = orgId === 'org_backend' ? localItems : localItems.filter(x => x.organizationId === orgId);
      const cloudOrg = orgId === 'org_backend' ? cloudItems : cloudItems.filter(x => x.organizationId === orgId);
      if (localOrg.length !== cloudOrg.length) return true;
      const sortById = (a: any, b: any) => (a.id || '').localeCompare(b.id || '');
      const localStr = JSON.stringify([...localOrg].sort(sortById));
      const cloudStr = JSON.stringify([...cloudOrg].sort(sortById));
      return localStr !== cloudStr;
    };

    let userRightsChanged = false;
    let nextUserRightsList = states.userRightsList;
    let nextOrganizationProfiles = states.organizationProfiles;

    if (userRightsData && userRightsData.userRightsList && Array.isArray(userRightsData.userRightsList)) {
      const cloudRights = migrateUserPermissions(userRightsData.userRightsList);
      if (currentUserRights.isAdmin) {
        const localRightsOrg = states.userRightsList.filter(x => x.organizationId === orgId);
        const cloudRightsOrg = cloudRights.filter(x => x.organizationId === orgId);
        if (localRightsOrg.length !== cloudRightsOrg.length) {
          userRightsChanged = true;
        } else {
          const sortById = (a: any, b: any) => (a.id || '').localeCompare(b.id || '');
          const localStr = JSON.stringify([...localRightsOrg].sort(sortById));
          const cloudStr = JSON.stringify([...cloudRightsOrg].sort(sortById));
          if (localStr !== cloudStr) userRightsChanged = true;
        }
      } else {
        const localOwn = states.userRightsList.find(x => x.email.toLowerCase().trim() === email);
        const cloudOwn = cloudRights.find(x => x.email.toLowerCase().trim() === email);
        if (JSON.stringify(localOwn) !== JSON.stringify(cloudOwn)) {
          userRightsChanged = true;
        }
      }
    }

    if (parsed.userRightsList && Array.isArray(parsed.userRightsList)) {
      const cloudRights = migrateUserPermissions(parsed.userRightsList);
      if (currentUserRights.isAdmin) {
        const localRightsOrg = states.userRightsList.filter(x => x.organizationId === orgId);
        const cloudRightsOrg = cloudRights.filter(x => x.organizationId === orgId);
        if (localRightsOrg.length !== cloudRightsOrg.length) {
          userRightsChanged = true;
        } else {
          const sortById = (a: any, b: any) => (a.id || '').localeCompare(b.id || '');
          const localStr = JSON.stringify([...localRightsOrg].sort(sortById));
          const cloudStr = JSON.stringify([...cloudRightsOrg].sort(sortById));
          if (localStr !== cloudStr) userRightsChanged = true;
        }
      } else {
        const localOwn = states.userRightsList.find(x => x.email.toLowerCase().trim() === email);
        const cloudOwn = cloudRights.find(x => x.email.toLowerCase().trim() === email);
        if (JSON.stringify(localOwn) !== JSON.stringify(cloudOwn)) {
          userRightsChanged = true;
        }
      }
    }

    let hasRelevantChanges = false;
    if (currentUserRights.canViewTrips && hasOrgCategoryChanged(states.trips, parsed.trips)) hasRelevantChanges = true;
    if (currentUserRights.canViewTrucks && hasOrgCategoryChanged(states.trucks, parsed.trucks)) hasRelevantChanges = true;
    if (currentUserRights.canViewDrivers && hasOrgCategoryChanged(states.drivers, parsed.drivers)) hasRelevantChanges = true;
    if (currentUserRights.canViewOffices && hasOrgCategoryChanged(states.offices, parsed.offices)) hasRelevantChanges = true;
    if (currentUserRights.canViewAccounts && hasOrgCategoryChanged(states.accounts, parsed.accounts)) hasRelevantChanges = true;
    if (currentUserRights.canViewExpenses && hasOrgCategoryChanged(states.expenses, parsed.expenses)) hasRelevantChanges = true;
    if (currentUserRights.canViewTyres && hasOrgCategoryChanged(states.tyres, parsed.tyres)) hasRelevantChanges = true;
    if (currentUserRights.isAdmin && hasOrgCategoryChanged(states.auditLogs, parsed.auditLogs)) hasRelevantChanges = true;
    if (hasOrgCategoryChanged(states.supportTickets, parsed.supportTickets)) hasRelevantChanges = true;
    if (userRightsChanged) hasRelevantChanges = true;

    const notifications: ReconciliationResult['notifications'] = [];
    let shouldTouchLastModified = false;

    if (userRightsData) {
      let cloudProfiles = userRightsData.organizationProfiles || [];
      let cloudRightsSource = userRightsData.userRightsList || [];

      if (!isSuper) {
        cloudProfiles = cloudProfiles.filter((p: any) => p.organizationId === orgId);
        cloudRightsSource = cloudRightsSource.filter((ur: any) =>
          ur.organizationId === orgId || ur.email.toLowerCase().trim() === email
        );
      }

      const existingOrgIds = new Set(cloudProfiles.map((p: any) => p.organizationId));

      if (cloudRightsSource && Array.isArray(cloudRightsSource)) {
        let cloudRights = migrateUserPermissions(cloudRightsSource);
        const localStored = localStorage.getItem('ttt_user_rights');
        let localRights: UserPermission[] = localStored ? migrateUserPermissions(JSON.parse(localStored)) : states.userRightsList;

        const orphanedCloudKeys: string[] = [];
        cloudRights = cloudRights.filter(ur => {
          if (!ur.organizationId || ur.organizationId === 'org_backend' || ur.organizationId === 'org_default') {
            return true;
          }
          const exists = existingOrgIds.has(ur.organizationId);
          if (!exists) {
            orphanedCloudKeys.push(appwrite.getEmailDocId(ur.email));
          }
          return exists;
        });

        // Disable dangerous automatic cleanup of user permissions to avoid race conditions during new organization registration.
        /*
        if (isSuper && orphanedCloudKeys.length > 0) {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          console.info("Super Admin cleaning up orphaned user permissions from DB (onLoadCloudState):", orphanedCloudKeys);
          for (const key of orphanedCloudKeys) {
            appwrite.deleteGlobalConfig(databaseId, key).catch(err => {
              console.warn("Failed to delete orphaned user permission:", key, err);
            });
          }
        }
        */

        localRights = localRights.filter(ur => {
          if (!ur.organizationId || ur.organizationId === 'org_backend' || ur.organizationId === 'org_default') {
            return true;
          }
          return existingOrgIds.has(ur.organizationId);
        });

        const merged = cloudRights.map(cloudEntry => {
          const localEntry = localRights.find(l => l.email.toLowerCase() === cloudEntry.email.toLowerCase());
          if (localEntry) {
            return { ...cloudEntry, isApproved: localEntry.isApproved || cloudEntry.isApproved };
          }
          return cloudEntry;
        });
        const localOnlyEntries = localRights.filter(lr => !merged.some(m => m.email.toLowerCase() === lr.email.toLowerCase()));
        const preservedLocalOnlyEntries = localOnlyEntries.filter(lr => {
          return lr.role === 'SuperAdmin' || lr.organizationId === 'org_backend';
        });
        const activeRightsList = [...merged, ...preservedLocalOnlyEntries];
        nextUserRightsList = activeRightsList;
        localStorage.setItem('ttt_user_rights', JSON.stringify(activeRightsList));
      }

      if (cloudProfiles && Array.isArray(cloudProfiles)) {
        const activeRights = cloudRightsSource && Array.isArray(cloudRightsSource)
          ? migrateUserPermissions(cloudRightsSource)
          : states.userRightsList;

        const filteredActiveRights = activeRights.filter(ur => {
          if (!ur.organizationId || ur.organizationId === 'org_backend' || ur.organizationId === 'org_default') {
            return true;
          }
          return existingOrgIds.has(ur.organizationId);
        });

        const combinedProfiles = [
          ...(states.organizationProfiles || []),
          ...(cloudProfiles || [])
        ];

        const reconciled = organizationService.reconcileOrganizationProfiles(
          filteredActiveRights,
          combinedProfiles
        );
        nextOrganizationProfiles = reconciled;
        localStorage.setItem('ttt_organization_profiles', JSON.stringify(reconciled));
      }
    }

    let nextTrucks: Truck[] | undefined;
    let nextDrivers: Driver[] | undefined;
    let nextOffices: Office[] | undefined;
    let nextAccounts: Account[] | undefined;
    let nextTrips: TripEntry[] | undefined;
    let nextExpenses: ExpenseEntry[] | undefined;
    let nextTyres: Tyre[] | undefined;
    let nextAuditLogs: AuditLog[] | undefined;
    let nextSupportTickets: SupportTicket[] | undefined;

    if (parsed.trucks) {
      const localLastModified = Number(localStorage.getItem('ttt_last_modified_at') || '0');
      const cloudExportDate = parsed.exportDate
        ? (isNaN(Number(parsed.exportDate)) ? new Date(parsed.exportDate).getTime() : Number(parsed.exportDate))
        : 0;
      const localIsNewer = false;
      if (!localIsNewer) {
        const migrated = migrateTrucks(parsed.trucks);

        if (!quiet) {
          migrated.forEach(cloudTruck => {
            const isRelevantOrg = orgId !== 'org_backend' && cloudTruck.organizationId === orgId;
            if (isRelevantOrg) {
              const localTruck = states.trucks.find(t =>
                t.organizationId === orgId &&
                t.truckNo.toUpperCase() === cloudTruck.truckNo.toUpperCase()
              );
              if (localTruck) {
                const wasPendingApproval = localTruck.isApproved === false || localTruck.requestStatus === 'Pending';

                if (wasPendingApproval && cloudTruck.isApproved === true) {
                  notifications.push({
                    message: `Truck ${cloudTruck.truckNo} has been approved by the Admin!`,
                    actionType: 'Cloud',
                    category: 'Truck',
                    target: cloudTruck.truckNo,
                    details: `Truck registration request approved by Admin. Expiry set to ${cloudTruck.registrationExpiryDate || 'None'}`,
                    organizationId: cloudTruck.organizationId
                  });
                } else if (wasPendingApproval && cloudTruck.requestStatus === 'Rejected') {
                  notifications.push({
                    message: `Truck ${cloudTruck.truckNo} request was rejected.`,
                    actionType: 'Cloud',
                    category: 'Truck',
                    target: cloudTruck.truckNo,
                    details: `Truck registration request rejected by Admin.`,
                    organizationId: cloudTruck.organizationId
                  });
                }
              }
            }
          });
        }

        const otherOrgs = orgId === 'org_backend' ? [] : states.trucks.filter(t => t.organizationId !== orgId && t.organizationId !== 'org_default');
        const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(t => t.organizationId === orgId);
        
        const localOnlyOrPending = states.trucks.filter(t => (orgId === 'org_backend' || t.organizationId === orgId) && t.syncState === 'pending');
        const mergedThisOrg = thisOrgPulled.map(cloudItem => {
          const localPendingItem = localOnlyOrPending.find(l => l.id === cloudItem.id);
          if (localPendingItem && (localPendingItem.version ?? 0) > (cloudItem.version ?? 0)) {
            return localPendingItem;
          }
          return cloudItem;
        });
        const notInCloud = localOnlyOrPending.filter(l => !mergedThisOrg.some(c => c.id === l.id));
        const next = [...otherOrgs, ...mergedThisOrg, ...notInCloud];

        const uniqueMap = new Map<string, Truck>();
        next.forEach(t => {
          const key = `${t.organizationId}_${t.truckNo.toUpperCase().trim()}`;
          const existing = uniqueMap.get(key);
          if (!existing) {
            uniqueMap.set(key, t);
          } else {
            const keepNew =
              (existing.deletedAt && !t.deletedAt) ||
              (!existing.deletedAt && !t.deletedAt && (
                (t.isApproved && !existing.isApproved) ||
                (t.requestStatus === 'Pending' && existing.requestStatus === 'Rejected') ||
                (t.requestStatus === 'Rejected' && existing.requestStatus === 'Pending') ||
                (!existing.isApproved && !t.isApproved && t.id.startsWith('t_id_') && existing.id.startsWith('tr_')) ||
                ((t.version || 0) > (existing.version || 0)) ||
                (t.version === existing.version && new Date(t.updatedAt || 0).getTime() > new Date(existing.updatedAt || 0).getTime())
              ));
            if (keepNew) {
              if (isAppwriteConfigured()) {
                const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
                appwrite.deleteFleetDocument(databaseId, 'trucks', existing.id).catch(() => {});
              }
              uniqueMap.set(key, t);
            } else {
              if (isAppwriteConfigured() && !t.deletedAt) {
                const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
                appwrite.deleteFleetDocument(databaseId, 'trucks', t.id).catch(() => {});
              }
            }
          }
        });
        const deduplicated = Array.from(uniqueMap.values());
        localStorage.setItem('ttt_trucks', JSON.stringify(deduplicated));
        nextTrucks = deduplicated;
        shouldTouchLastModified = true;
      } else {
        if (!quiet) {
          console.log(`Appwrite Cloud Sync: Skipping truck overwrite — local state is newer (local: ${localLastModified}, cloud: ${cloudExportDate})`);
        }
      }
    }

    if (parsed.drivers) {
      const migrated = migrateDrivers(parsed.drivers);
      const otherOrgs = orgId === 'org_backend' ? [] : states.drivers.filter(d => d.organizationId !== orgId && d.organizationId !== 'org_default');
      const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(d => d.organizationId === orgId);
      const localOnlyOrPending = states.drivers.filter(d => (orgId === 'org_backend' || d.organizationId === orgId) && d.syncState === 'pending');
      const mergedThisOrg = thisOrgPulled.map(cloudItem => {
        const localPendingItem = localOnlyOrPending.find(l => l.id === cloudItem.id);
        if (localPendingItem && (localPendingItem.version ?? 0) > (cloudItem.version ?? 0)) {
          return localPendingItem;
        }
        return cloudItem;
      });
      const notInCloud = localOnlyOrPending.filter(l => !mergedThisOrg.some(c => c.id === l.id));
      const next = [...otherOrgs, ...mergedThisOrg, ...notInCloud];
      localStorage.setItem('ttt_drivers', JSON.stringify(next));
      nextDrivers = next;
      shouldTouchLastModified = true;
    }

    if (parsed.offices) {
      const migrated = migrateOffices(parsed.offices);
      const otherOrgs = orgId === 'org_backend' ? [] : states.offices.filter(o => o.organizationId !== orgId && o.organizationId !== 'org_default');
      const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(o => o.organizationId === orgId);
      const localOnlyOrPending = states.offices.filter(o => (orgId === 'org_backend' || o.organizationId === orgId) && o.syncState === 'pending');
      const mergedThisOrg = thisOrgPulled.map(cloudItem => {
        const localPendingItem = localOnlyOrPending.find(l => l.id === cloudItem.id);
        if (localPendingItem && (localPendingItem.version ?? 0) > (cloudItem.version ?? 0)) {
          return localPendingItem;
        }
        return cloudItem;
      });
      const notInCloud = localOnlyOrPending.filter(l => !mergedThisOrg.some(c => c.id === l.id));
      const next = [...otherOrgs, ...mergedThisOrg, ...notInCloud];
      localStorage.setItem('ttt_offices', JSON.stringify(next));
      nextOffices = next;
      shouldTouchLastModified = true;
    }

    if (parsed.accounts) {
      const migrated = migrateAccounts(parsed.accounts);
      const otherOrgs = orgId === 'org_backend' ? [] : states.accounts.filter(a => a.organizationId !== orgId && a.organizationId !== 'org_default');
      const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(a => a.organizationId === orgId);
      const localOnlyOrPending = states.accounts.filter(a => (orgId === 'org_backend' || a.organizationId === orgId) && a.syncState === 'pending');
      const mergedThisOrg = thisOrgPulled.map(cloudItem => {
        const localPendingItem = localOnlyOrPending.find(l => l.id === cloudItem.id);
        if (localPendingItem && (localPendingItem.version ?? 0) > (cloudItem.version ?? 0)) {
          return localPendingItem;
        }
        return cloudItem;
      });
      const notInCloud = localOnlyOrPending.filter(l => !mergedThisOrg.some(c => c.id === l.id));
      const next = [...otherOrgs, ...mergedThisOrg, ...notInCloud];
      localStorage.setItem('ttt_accounts', JSON.stringify(next));
      nextAccounts = next;
      shouldTouchLastModified = true;
    }

    if (parsed.trips) {
      const migrated = migrateTrips(migrateTripsIfNecessary(parsed.trips));
      const otherOrgs = orgId === 'org_backend' ? [] : states.trips.filter(t => t.organizationId !== orgId && t.organizationId !== 'org_default');
      const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(t => t.organizationId === orgId);
      const localOnlyOrPending = states.trips.filter(t => (orgId === 'org_backend' || t.organizationId === orgId) && t.syncState === 'pending');
      const mergedThisOrg = thisOrgPulled.map(cloudItem => {
        const localPendingItem = localOnlyOrPending.find(l => l.id === cloudItem.id);
        if (localPendingItem && (localPendingItem.version ?? 0) > (cloudItem.version ?? 0)) {
          return localPendingItem;
        }
        return cloudItem;
      });
      const notInCloud = localOnlyOrPending.filter(l => !mergedThisOrg.some(c => c.id === l.id));
      const next = [...otherOrgs, ...mergedThisOrg, ...notInCloud];
      localStorage.setItem('ttt_trips', JSON.stringify(next));
      nextTrips = next;
      shouldTouchLastModified = true;
    }

    if (parsed.expenses) {
      const migrated = migrateExpenses(parsed.expenses);
      const otherOrgs = orgId === 'org_backend' ? [] : states.expenses.filter(e => e.organizationId !== orgId && e.organizationId !== 'org_default');
      const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(e => e.organizationId === orgId);
      const localOnlyOrPending = states.expenses.filter(e => (orgId === 'org_backend' || e.organizationId === orgId) && e.syncState === 'pending');
      const mergedThisOrg = thisOrgPulled.map(cloudItem => {
        const localPendingItem = localOnlyOrPending.find(l => l.id === cloudItem.id);
        if (localPendingItem && (localPendingItem.version ?? 0) > (cloudItem.version ?? 0)) {
          return localPendingItem;
        }
        return cloudItem;
      });
      const notInCloud = localOnlyOrPending.filter(l => !mergedThisOrg.some(c => c.id === l.id));
      const next = [...otherOrgs, ...mergedThisOrg, ...notInCloud];
      localStorage.setItem('ttt_expenses', JSON.stringify(next));
      nextExpenses = next;
      shouldTouchLastModified = true;
    }

    if (parsed.tyres) {
      const migrated = migrateTyres(parsed.tyres);
      const otherOrgs = orgId === 'org_backend' ? [] : states.tyres.filter(ty => ty.organizationId !== orgId && ty.organizationId !== 'org_default');
      const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(ty => ty.organizationId === orgId);
      const localOnlyOrPending = states.tyres.filter(ty => (orgId === 'org_backend' || ty.organizationId === orgId) && ty.syncState === 'pending');
      const mergedThisOrg = thisOrgPulled.map(cloudItem => {
        const localPendingItem = localOnlyOrPending.find(l => l.id === cloudItem.id);
        if (localPendingItem && (localPendingItem.version ?? 0) > (cloudItem.version ?? 0)) {
          return localPendingItem;
        }
        return cloudItem;
      });
      const notInCloud = localOnlyOrPending.filter(l => !mergedThisOrg.some(c => c.id === l.id));
      const next = [...otherOrgs, ...mergedThisOrg, ...notInCloud];
      localStorage.setItem('ttt_tyres', JSON.stringify(next));
      nextTyres = next;
      shouldTouchLastModified = true;
    }

    if (parsed.auditLogs) {
      const migrated = migrateAuditLogs(parsed.auditLogs);
      const otherOrgs = orgId === 'org_backend' ? [] : states.auditLogs.filter(l => l.organizationId !== orgId && l.organizationId !== 'org_default');
      const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(l => l.organizationId === orgId);
      const localOnlyOrPending = states.auditLogs.filter(l => (orgId === 'org_backend' || l.organizationId === orgId) && l.syncState === 'pending');
      const mergedThisOrg = thisOrgPulled.map(cloudItem => {
        const localPendingItem = localOnlyOrPending.find(l => l.id === cloudItem.id);
        if (localPendingItem && (localPendingItem.version ?? 0) > (cloudItem.version ?? 0)) {
          return localPendingItem;
        }
        return cloudItem;
      });
      const notInCloud = localOnlyOrPending.filter(l => !mergedThisOrg.some(c => c.id === l.id));
      const next = [...otherOrgs, ...mergedThisOrg, ...notInCloud];
      localStorage.setItem('fleet_audit_logs', JSON.stringify(next));
      nextAuditLogs = next;
      shouldTouchLastModified = true;
    }

    if (parsed.supportTickets) {
      const otherOrgs = orgId === 'org_backend' ? [] : states.supportTickets.filter(st => st.organizationId !== orgId && st.organizationId !== 'org_default');
      const thisOrgPulled = orgId === 'org_backend' ? parsed.supportTickets : parsed.supportTickets.filter((st: any) => st.organizationId === orgId);
      const localOnlyOrPending = states.supportTickets.filter(st => (orgId === 'org_backend' || st.organizationId === orgId) && st.syncState === 'pending');
      const mergedThisOrg = thisOrgPulled.map((cloudItem: any) => {
        const localPendingItem = localOnlyOrPending.find(l => l.id === cloudItem.id);
        if (localPendingItem && (localPendingItem.version ?? 0) > (cloudItem.version ?? 0)) {
          return localPendingItem;
        }
        return cloudItem;
      });
      const notInCloud = localOnlyOrPending.filter(l => !mergedThisOrg.some((c: any) => c.id === l.id));
      const next = [...otherOrgs, ...mergedThisOrg, ...notInCloud];
      localStorage.setItem('ttt_support_tickets', JSON.stringify(next));
      nextSupportTickets = next;
      shouldTouchLastModified = true;
    }

    if (parsed.userRightsList) {
      localStorage.setItem('ttt_user_rights', JSON.stringify(parsed.userRightsList));
      nextUserRightsList = parsed.userRightsList;
    }

    return {
      hasRelevantChanges,
      shouldTouchLastModified,
      trucks: nextTrucks,
      drivers: nextDrivers,
      offices: nextOffices,
      accounts: nextAccounts,
      trips: nextTrips,
      expenses: nextExpenses,
      tyres: nextTyres,
      auditLogs: nextAuditLogs,
      supportTickets: nextSupportTickets,
      userRightsList: nextUserRightsList,
      organizationProfiles: nextOrganizationProfiles,
      notifications
    };
  }
};
