import { appwrite } from '../lib/appwrite';
import { isAppwriteConfigured } from '../lib/appwriteConfig';
import { storageService } from './storageService';
import { UserPermission, OrganizationProfile } from '../types';
import { migrateUserPermissions } from '../lib/migrations';
import { organizationService } from './organizationService';
import { permissionService } from './permissionService';

export const authService = {
  async handleLogout(currentUserEmail: string | undefined): Promise<void> {
    const email = (currentUserEmail || '').toLowerCase().trim();
    if (isAppwriteConfigured()) {
      try {
        await appwrite.logout();
      } catch (err) {
        console.warn("Appwrite logout failed (already logged out or offline):", err);
      }
    }
    // Clean session tokens / methods and completely clear local storage cache
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (storageErr) {
      console.warn("Failed to clear local/session storage on logout:", storageErr);
    }
  },

  async handleEmailVerificationRedirect(
    userId: string,
    secret: string,
    userRightsList: UserPermission[],
    setUserRightsList: (list: UserPermission[]) => void
  ): Promise<string | null> {
    if (isAppwriteConfigured()) {
      await appwrite.updateVerification(userId, secret);
      const user = await appwrite.getCurrentUser();
      if (user) {
        const email = (user.email || '').toLowerCase().trim();
        const updated = userRightsList.map(ur =>
          ur.email.toLowerCase().trim() === email ? { ...ur, isEmailVerified: true } : ur
        );
        setUserRightsList(updated);
        storageService.set('ttt_user_rights', updated);
        await permissionService.pushPermissionsToCloud(updated);
        return email;
      }
    } else {
      const email = storageService.get<any[]>('ttt_user_rights', [])[0]?.email || 'mock@test.com';
      const updated = userRightsList.map(ur =>
        ur.email.toLowerCase().trim() === email ? { ...ur, isEmailVerified: true } : ur
      );
      setUserRightsList(updated);
      storageService.set('ttt_user_rights', updated);
      return email;
    }
    return null;
  },

  async reconcileSession(
    user: any,
    userRightsList: UserPermission[],
    setUserRightsList: (list: UserPermission[]) => void,
    organizationProfiles: OrganizationProfile[],
    setOrganizationProfiles: (list: OrganizationProfile[]) => void,
    migrateLocalDataToOrg: (orgId: string) => void
  ): Promise<{ nextRights: UserPermission[]; nextProfiles: OrganizationProfile[] }> {
    const email = (user.email || '').toLowerCase().trim();
    let activeRightsList = [...userRightsList];
    let rawProfiles = [...organizationProfiles];
    let reconciled: OrganizationProfile[] = [...organizationProfiles];

    try {
      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const data = await organizationService.fetchAllGlobalConfigs(databaseId);
          
          if (data && data.userRightsList && data.userRightsList.length > 0) {
            if (data.organizationProfiles && Array.isArray(data.organizationProfiles)) {
              rawProfiles = data.organizationProfiles;
            }
            activeRightsList = migrateUserPermissions(data.userRightsList);
          } else {
            // Fallbacks
            try {
              const myDocId = appwrite.getEmailDocId(email);
              const myConfig = await appwrite.loadGlobalConfig(databaseId, myDocId);
              if (myConfig) {
                activeRightsList = [myConfig];
              }
            } catch (err) {
              console.warn("Could not fetch individual user permission directly:", err);
            }

            try {
              const userTeams = await appwrite.getUserTeams();
              if (userTeams.length > 0) {
                const appwriteOrgId = userTeams[0].$id;
                const orgDocId = appwrite.getOrgDocId(appwriteOrgId);
                const orgConfig = await appwrite.loadGlobalConfig(databaseId, orgDocId);
                if (orgConfig) {
                  rawProfiles = [orgConfig];
                }
              }
            } catch (err) {
              console.warn("Could not fetch organization config directly:", err);
            }
          }

          const localStored = localStorage.getItem('ttt_user_rights');
          let localRights: UserPermission[] = localStored ? migrateUserPermissions(JSON.parse(localStored)) : userRightsList;

          if (activeRightsList.length > 0) {
            const existingOrgIds = new Set(rawProfiles.map(p => p.organizationId));
            const myCloudRights = activeRightsList.find(ur => ur.email.toLowerCase().trim() === email);
            const isSuper = myCloudRights?.role === 'SuperAdmin' || myCloudRights?.organizationId === 'org_backend';

            const orphanedCloudKeys: string[] = [];
            activeRightsList = activeRightsList.filter(ur => {
              if (ur.email.toLowerCase().trim() === email) return true;
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
              for (const key of orphanedCloudKeys) {
                appwrite.deleteGlobalConfig(databaseId, key).catch(() => {});
              }
            }
            */

            localRights = localRights.filter(ur => {
              if (ur.email.toLowerCase().trim() === email) return true;
              if (!ur.organizationId || ur.organizationId === 'org_backend' || ur.organizationId === 'org_default') {
                return true;
              }
              return existingOrgIds.has(ur.organizationId);
            });

            const merged = activeRightsList.map(cloudEntry => {
              const localEntry = localRights.find(l => l.email.toLowerCase() === cloudEntry.email.toLowerCase());
              if (localEntry) {
                return { ...cloudEntry, isApproved: localEntry.isApproved || cloudEntry.isApproved };
              }
              return cloudEntry;
            });
            const localOnlyEntries = localRights.filter(lr => !merged.some(m => m.email.toLowerCase() === lr.email.toLowerCase()));
            const preservedLocalOnlyEntries = localOnlyEntries.filter(lr => {
              return lr.role === 'SuperAdmin' || lr.organizationId === 'org_backend' || lr.email.toLowerCase().trim() === email;
            });
            activeRightsList = [...merged, ...preservedLocalOnlyEntries];
            setUserRightsList(activeRightsList);
            storageService.set('ttt_user_rights', activeRightsList);
          } else {
            const localStored = localStorage.getItem('ttt_user_rights');
            let localRights: UserPermission[] = localStored ? migrateUserPermissions(JSON.parse(localStored)) : userRightsList;
            const myLocalEntry = localRights.find(ur => ur.email.toLowerCase() === email);
            const isLocalSuperAdmin = myLocalEntry?.role === 'SuperAdmin' || myLocalEntry?.organizationId === 'org_backend';

            if (isLocalSuperAdmin) {
              const selfEntry = localRights.find(ur => ur.email.toLowerCase() === email);
              activeRightsList = selfEntry ? [selfEntry] : [];
              setUserRightsList(activeRightsList);
              storageService.set('ttt_user_rights', activeRightsList);
              rawProfiles = [];
              setOrganizationProfiles([]);
              storageService.set('ttt_organization_profiles', []);
            } else {
              activeRightsList = localRights;
            }
          }

          reconciled = organizationService.reconcileOrganizationProfiles(activeRightsList, rawProfiles);
          setOrganizationProfiles(reconciled);
          storageService.set('ttt_organization_profiles', reconciled);
        } catch (cloudErr) {
          console.warn('Cloud configs loading bypassed/offline:', cloudErr);
        }
      }

      if (activeRightsList.length === 0) {
        const stored = storageService.get<UserPermission[]>('ttt_user_rights', []);
        if (stored.length > 0) {
          activeRightsList = migrateUserPermissions(stored);
          setUserRightsList(activeRightsList);
        }
      }

      const localProfiles = storageService.get<OrganizationProfile[]>('ttt_organization_profiles', organizationProfiles);
      reconciled = organizationService.reconcileOrganizationProfiles(activeRightsList, localProfiles);

      const myRights = activeRightsList.find(ur => ur.email.toLowerCase().trim() === email);
      if (myRights) {
        const isSuper = myRights.role === 'SuperAdmin' || myRights.organizationId === 'org_backend';
        if (!isSuper) {
          activeRightsList = activeRightsList.filter(ur => ur.organizationId === myRights.organizationId || ur.email.toLowerCase().trim() === email);
          setUserRightsList(activeRightsList);
          storageService.set('ttt_user_rights', activeRightsList);
          reconciled = reconciled.filter(p => p.organizationId === myRights.organizationId);
        }
      }

      setOrganizationProfiles(reconciled);
      storageService.set('ttt_organization_profiles', reconciled);

      let match = activeRightsList.find(ur => ur.email.toLowerCase().trim() === email);

      if (isAppwriteConfigured() && match) {
        let needsUpdate = false;
        const updatedMatch = { ...match };

        if (user.emailVerification === true && !match.isEmailVerified) {
          updatedMatch.isEmailVerified = true;
          needsUpdate = true;
        }

        if (user.phoneVerification === true && !match.isPhoneVerified) {
          updatedMatch.isPhoneVerified = true;
          needsUpdate = true;
        }

        if (needsUpdate) {
          const updatedList = activeRightsList.map(ur =>
            ur.email.toLowerCase().trim() === email ? updatedMatch : ur
          );
          setUserRightsList(updatedList);
          storageService.set('ttt_user_rights', updatedList);
          activeRightsList = updatedList;
          match = updatedMatch;
          await permissionService.pushPermissionsToCloud(updatedList);
        }
      }

      // Appwrite Teams Sync
      if (isAppwriteConfigured()) {
        try {
          const userTeams = await appwrite.getUserTeams();
          if (userTeams.length > 0) {
            const appwriteOrgId = userTeams[0].$id;
            migrateLocalDataToOrg(appwriteOrgId);

            const knownNames: { [orgId: string]: string } = {};
            for (const team of userTeams) {
              knownNames[team.$id] = team.name;
            }
            reconciled = organizationService.reconcileOrganizationProfiles(activeRightsList, reconciled, knownNames);
            
            // Save organization profiles helper calls organizationService.saveOrganizationProfiles
            await organizationService.saveOrganizationProfiles(reconciled, organizationProfiles, email, myRights);
            setOrganizationProfiles(reconciled);

            let isAdminUser = false;
            try {
              const members = await appwrite.getTeamMemberships(appwriteOrgId);
              if (members && members.length > 0) {
                 const myMembership = members.find(m => 
                   (m.userEmail && m.userEmail.toLowerCase().trim() === email) ||
                   (m.email && m.email.toLowerCase().trim() === email)
                 );
                 if (myMembership && myMembership.roles && myMembership.roles.includes('owner')) {
                   isAdminUser = true;
                 }
              }
            } catch {}

            if (match) {
              let needsUpdate = false;
              let updatedMatch = { ...match };

              if (match.role !== 'SuperAdmin' && match.organizationId !== appwriteOrgId) {
                updatedMatch.organizationId = appwriteOrgId;
                needsUpdate = true;
              }

              if (!match.isApproved) {
                updatedMatch.isApproved = true;
                needsUpdate = true;
              }

              if (user.name && match.name !== user.name) {
                updatedMatch.name = user.name;
                needsUpdate = true;
              }

              if (user.phone && match.phone !== user.phone) {
                updatedMatch.phone = user.phone;
                needsUpdate = true;
              }

              if (user.emailVerification === true && !match.isEmailVerified) {
                updatedMatch.isEmailVerified = true;
                needsUpdate = true;
              }

              if (user.phoneVerification === true && !match.isPhoneVerified) {
                updatedMatch.isPhoneVerified = true;
                needsUpdate = true;
              }

              const isSuper = appwriteOrgId === 'org_backend' || match.role === 'SuperAdmin';
              const targetRole = isSuper ? 'SuperAdmin' : 'Admin';
              if (isAdminUser && match.role !== targetRole && match.role !== 'Custom') {
                updatedMatch.role = targetRole as any;
                updatedMatch.canViewTrips = true; updatedMatch.canEditTrips = true; updatedMatch.canDeleteTrips = true;
                updatedMatch.canViewTyres = true; updatedMatch.canEditTyres = true; updatedMatch.canDeleteTyres = true;
                updatedMatch.canViewTrucks = true; updatedMatch.canEditTrucks = true; updatedMatch.canDeleteTrucks = true;
                updatedMatch.canViewDrivers = true; updatedMatch.canEditDrivers = true; updatedMatch.canDeleteDrivers = true;
                updatedMatch.canViewOffices = true; updatedMatch.canEditOffices = true; updatedMatch.canDeleteOffices = true;
                updatedMatch.canViewAccounts = true; updatedMatch.canEditAccounts = true; updatedMatch.canDeleteAccounts = true;
                updatedMatch.canViewExpenses = true; updatedMatch.canEditExpenses = true; updatedMatch.canDeleteExpenses = true;
                needsUpdate = true;
              }

              if (needsUpdate) {
                const updatedList = activeRightsList.map(ur =>
                  ur.email.toLowerCase().trim() === email ? updatedMatch : ur
                );
                setUserRightsList(updatedList);
                storageService.set('ttt_user_rights', updatedList);
                activeRightsList = updatedList;
                await permissionService.pushPermissionsToCloud(updatedList);
              }
            }
          }
        } catch (teamsErr) {
          console.warn('Teams sync skipped (non-fatal):', teamsErr);
        }
      }
    } catch (err) {
      console.warn('Session reconciliation bypassed/offline:', err);
    }

    return { nextRights: activeRightsList, nextProfiles: reconciled };
  }
};
