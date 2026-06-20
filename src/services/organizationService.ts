import { UserPermission, OrganizationProfile } from '../types';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { storageService } from './storageService';
import { migrateUserPermissions } from '../lib/migrations';

export const organizationService = {
  reconcileOrganizationProfiles(
    rights: UserPermission[],
    currentProfiles: OrganizationProfile[],
    knownNames: { [orgId: string]: string } = {}
  ): OrganizationProfile[] {
    let profiles = [...currentProfiles];

    if (isAppwriteConfigured()) {
      profiles = profiles.filter(p => p.organizationId !== 'org_default');
    }

    // Find all unique organizationIds in rights (excluding org_backend)
    const orgIds = Array.from(new Set(rights.map(r => r.organizationId).filter(Boolean)))
      .filter(orgId => orgId !== 'org_backend' && (!isAppwriteConfigured() || orgId !== 'org_default'));

    // Filter profiles to only keep those that have at least one active user permission in rights.
    profiles = profiles.filter(p => orgIds.includes(p.organizationId));

    for (const orgId of orgIds) {
      const existing = profiles.find(p => p.organizationId === orgId);
      if (!existing) {
        // Find owner (role === 'Admin')
        const adminUser = rights.find(r => r.organizationId === orgId && r.role === 'Admin') || rights.find(r => r.organizationId === orgId);
        if (adminUser) {
          let displayName = knownNames[orgId];
          if (!displayName) {
            const cleanSlug = orgId.replace(/^org_/, '').replace(/_[a-z0-9]{4}$/, '');
            displayName = cleanSlug.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Sakthi Logistics';

            // Check if the displayName is just a raw alphanumeric ID/code and make it human-readable!
            const isHexOrAlphanumericId = /^[a-f0-9]{15,40}$/i.test(displayName) || /^[a-z0-9]{15,40}$/i.test(displayName);
            if (isHexOrAlphanumericId) {
              const ownerName = adminUser.name || '';
              if (ownerName && ownerName.trim().length > 0 && !ownerName.includes('@')) {
                displayName = `${ownerName.trim()}'s Fleet`;
              } else {
                const emailPrefix = adminUser.email.split('@')[0];
                const cleanPrefix = emailPrefix.replace(/[._-]/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                displayName = `${cleanPrefix} Logistics`;
              }
            }
          }

          profiles.push({
            organizationId: orgId,
            organizationName: displayName,
            ownerEmail: adminUser.email,
            status: 'Active',
            maxTrucksAllowed: 2,
            truckRequests: [],
            brokeragePolicy: 'DriverBears'
          });
        }
      } else {
        // Sync owner email if it changed or is missing
        const adminUser = rights.find(r => r.organizationId === orgId && r.role === 'Admin') || rights.find(r => r.organizationId === orgId);
        if (adminUser) {
          if (existing.ownerEmail !== adminUser.email) {
            existing.ownerEmail = adminUser.email;
          }

          if (knownNames[orgId]) {
            existing.organizationName = knownNames[orgId];
          } else {
            const isHexOrAlphanumericId = /^[a-f0-9]{15,40}$/i.test(existing.organizationName) || /^[a-z0-9]{15,40}$/i.test(existing.organizationName);
            if (isHexOrAlphanumericId) {
              const ownerName = adminUser.name || '';
              if (ownerName && ownerName.trim().length > 0 && !ownerName.includes('@')) {
                existing.organizationName = `${ownerName.trim()}'s Fleet`;
              } else {
                const emailPrefix = adminUser.email.split('@')[0];
                const cleanPrefix = emailPrefix.replace(/[._-]/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                existing.organizationName = `${cleanPrefix} Logistics`;
              }
            }
          }
        }
      }
    }

    return profiles;
  },

  async saveOrganizationProfiles(
    nextProfiles: OrganizationProfile[],
    prevProfiles: OrganizationProfile[],
    currentUserEmail: string | undefined,
    currentUserRights: any
  ): Promise<void> {
    storageService.set('ttt_organization_profiles', nextProfiles);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const isNotLoggedIn = !currentUserEmail;

        const savePromises = nextProfiles.map(async (prof) => {
          if (!isNotLoggedIn && !currentUserRights.isSuperAdmin && prof.organizationId !== currentUserRights.organizationId) {
            return;
          }

          // Change-detection
          const prevProf = prevProfiles.find(p => p.organizationId === prof.organizationId);
          if (prevProf && JSON.stringify(prevProf) === JSON.stringify(prof)) {
            return;
          }

          const docId = appwrite.getOrgDocId(prof.organizationId);
          await appwrite.saveGlobalConfig(databaseId, docId, prof);
        });

        await Promise.all(savePromises);
        console.log('Successfully synced organization profiles to Appwrite Database.');
      } catch (e) {
        console.error("Could not sync organization profiles to database:", e);
      }
    }
  },

  async fetchAllGlobalConfigs(databaseId: string): Promise<{
    userRightsList: UserPermission[];
    organizationProfiles: OrganizationProfile[];
    appUpdateConfig?: { version: string; releaseNotes: string; downloadUrl: string; updatedAt?: string } | null;
  }> {
    try {
      const allConfigs = await appwrite.listGlobalConfigs(databaseId);
      const userRightsList: UserPermission[] = [];
      const organizationProfiles: OrganizationProfile[] = [];
      let appUpdateConfig = null;
      for (const doc of allConfigs) {
        try {
          const parsed = JSON.parse(doc.data);
          const keyVal = doc.key || doc.$id || '';
          if (keyVal.startsWith('usr_')) {
            userRightsList.push(parsed);
          } else if (keyVal.startsWith('prf_')) {
            if (parsed && parsed.organizationId) {
              organizationProfiles.push(parsed);
            }
          } else if (keyVal === 'cfg_app_version') {
            appUpdateConfig = parsed;
          }
        } catch (e) {
          console.warn(`Failed to parse global config doc ${doc.$id}:`, e);
        }
      }
      return { userRightsList, organizationProfiles, appUpdateConfig };
    } catch (e) {
      console.warn("Could not fetch global configs:", e);
      return { userRightsList: [], organizationProfiles: [], appUpdateConfig: null };
    }
  }
};
