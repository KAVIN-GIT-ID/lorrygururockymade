import { UserPermission, OrganizationProfile } from '../types';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { storageService } from './storageService';
import { migrateUserPermissions } from '../lib/migrations';

export function mergeSingleOrgProfile(p1: OrganizationProfile, p2: OrganizationProfile): OrganizationProfile {
  // Merge fuelCards (deduplicate by cardName)
  const cardsMap = new Map<string, any>();
  for (const c of [...(p1.fuelCards || []), ...(p2.fuelCards || [])]) {
    const key = (c.cardName || '').trim().toLowerCase();
    if (!key) continue;
    if (!cardsMap.has(key)) {
      cardsMap.set(key, c);
    } else {
      const existing = cardsMap.get(key);
      cardsMap.set(key, { ...existing, ...c, cardNumber: c.cardNumber || existing.cardNumber });
    }
  }

  // Merge customExpenseTypes
  const mergedTypes = Array.from(new Set([
    ...(p1.customExpenseTypes || []),
    ...(p2.customExpenseTypes || [])
  ].map(s => String(s).trim()).filter(Boolean)));

  // Merge shopNames
  const mergedShops = Array.from(new Set([
    ...(p1.shopNames || []),
    ...(p2.shopNames || [])
  ].map(s => String(s).trim()).filter(Boolean)));

  // Merge truckRequests
  const reqsMap = new Map<string, any>();
  for (const req of [...(p1.truckRequests || []), ...(p2.truckRequests || [])]) {
    const key = req.id || req.truckNo;
    if (key && !reqsMap.has(key)) {
      reqsMap.set(key, req);
    }
  }

  // Merge approvedTrucks
  const approvedMap = new Map<string, any>();
  for (const tr of [...(p1.approvedTrucks || []), ...(p2.approvedTrucks || [])]) {
    const key = typeof tr === 'string' ? tr : (tr.truckNo || tr.id);
    if (key && !approvedMap.has(key)) {
      approvedMap.set(key, tr);
    }
  }

  return {
    ...p1,
    ...p2,
    organizationName: (p1.organizationName && p1.organizationName !== 'Sakthi Logistics') ? p1.organizationName : (p2.organizationName || p1.organizationName),
    ownerEmail: p1.ownerEmail || p2.ownerEmail,
    status: (p1.status === 'Active' || p2.status === 'Active') ? 'Active' : (p1.status || p2.status || 'Active'),
    maxTrucksAllowed: Math.max(p1.maxTrucksAllowed || 2, p2.maxTrucksAllowed || 2),
    brokeragePolicy: p1.brokeragePolicy || p2.brokeragePolicy || 'DriverBears',
    fuelCards: Array.from(cardsMap.values()),
    customExpenseTypes: mergedTypes,
    shopNames: mergedShops,
    truckRequests: Array.from(reqsMap.values()),
    approvedTrucks: Array.from(approvedMap.values()),
    insuranceWarningDays: p1.insuranceWarningDays ?? p2.insuranceWarningDays,
    fcWarningDays: p1.fcWarningDays ?? p2.fcWarningDays,
    npTaxWarningDays: p1.npTaxWarningDays ?? p2.npTaxWarningDays,
    fiveYearPermitWarningDays: p1.fiveYearPermitWarningDays ?? p2.fiveYearPermitWarningDays,
    qTaxWarningDays: p1.qTaxWarningDays ?? p2.qTaxWarningDays,
    greenTaxWarningDays: p1.greenTaxWarningDays ?? p2.greenTaxWarningDays,
    subscriptionWarningDays: p1.subscriptionWarningDays ?? p2.subscriptionWarningDays,
  };
}

export const organizationService = {
  reconcileOrganizationProfiles(
    rights: UserPermission[],
    currentProfiles: OrganizationProfile[],
    knownNames: { [orgId: string]: string } = {}
  ): OrganizationProfile[] {
    const rawProfiles = [...currentProfiles];

    // Group input profiles by organizationId and merge all records sharing the same orgId
    const profilesByOrgId = new Map<string, OrganizationProfile>();
    for (const p of rawProfiles) {
      if (!p || !p.organizationId) continue;
      const existingProf = profilesByOrgId.get(p.organizationId);
      if (!existingProf) {
        profilesByOrgId.set(p.organizationId, { ...p });
      } else {
        profilesByOrgId.set(p.organizationId, mergeSingleOrgProfile(existingProf, p));
      }
    }

    let profiles = Array.from(profilesByOrgId.values());

    // Collect any existing fuelCards, customExpenseTypes, shopNames from ALL current profiles (e.g. org_default or legacy orgs)
    const legacyCards: any[] = [];
    const legacyTypes: string[] = [];
    const legacyShops: string[] = [];

    for (const p of rawProfiles) {
      if (p.fuelCards && p.fuelCards.length > 0) {
        for (const c of p.fuelCards) {
          if (!legacyCards.some(existing => existing.id === c.id || existing.cardName === c.cardName)) {
            legacyCards.push(c);
          }
        }
      }
      if (p.customExpenseTypes && p.customExpenseTypes.length > 0) {
        for (const t of p.customExpenseTypes) {
          if (!legacyTypes.includes(t)) legacyTypes.push(t);
        }
      }
      if (p.shopNames && p.shopNames.length > 0) {
        for (const s of p.shopNames) {
          if (!legacyShops.includes(s)) legacyShops.push(s);
        }
      }
    }

    // Default fallbacks if no existing config found anywhere
    const defaultFuelCards = legacyCards.length > 0 ? legacyCards : [
      { id: 'fc_iocl_1', cardName: 'IOCL Fuel Card', cardNumber: '7089-XXXX-1002', status: 'Active' as const },
      { id: 'fc_hpcl_2', cardName: 'HPCL DriveTrack Plus', cardNumber: '5021-XXXX-3004', status: 'Active' as const },
      { id: 'fc_bpcl_3', cardName: 'BPCL SmartFleet Card', cardNumber: '6011-XXXX-8009', status: 'Active' as const }
    ];

    const defaultExpenseTypes = legacyTypes.length > 0 ? legacyTypes : [
      'Loading / Unloading Wages',
      'Mamul & RMC Charges',
      'Brokerage / Commission',
      'Crossing Expense',
      'Police & RTO Checkpost',
      'FASTag / Toll Plaza',
      'Water Wash & Maintenance',
      'AdBlue / Def Refill'
    ];

    const defaultShopNames = legacyShops.length > 0 ? legacyShops : [
      'Indian Oil Corporation',
      'Bharat Petroleum Bunk',
      'Hindustan Petroleum (HPCL)',
      'Nayara Energy Bunk',
      'Royal Auto Spares',
      'Premier Tyres & Wheel Alignment'
    ];

    if (isAppwriteConfigured()) {
      profiles = profiles.filter(p => p.organizationId !== 'org_default');
    }

    // Find all unique organizationIds in rights (excluding org_backend)
    const orgIds = Array.from(new Set(rights.map(r => r.organizationId).filter(Boolean)))
      .filter(orgId => orgId !== 'org_backend' && (!isAppwriteConfigured() || orgId !== 'org_default'));

    // Filter profiles to only keep those that have at least one active user permission in rights.
    profiles = profiles.filter(p => orgIds.includes(p.organizationId));

    for (const orgId of orgIds) {
      let existing = profiles.find(p => p.organizationId === orgId);
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

          existing = {
            organizationId: orgId,
            organizationName: displayName,
            ownerEmail: adminUser.email,
            status: 'Active',
            maxTrucksAllowed: 50,
            truckRequests: [],
            brokeragePolicy: 'DriverBears',
            fuelCards: [...defaultFuelCards],
            customExpenseTypes: [...defaultExpenseTypes],
            shopNames: [...defaultShopNames]
          };
          profiles.push(existing);
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

      if (existing) {
        if (!existing.fuelCards || existing.fuelCards.length === 0) {
          existing.fuelCards = [...defaultFuelCards];
        }
        if (!existing.customExpenseTypes || existing.customExpenseTypes.length === 0) {
          existing.customExpenseTypes = [...defaultExpenseTypes];
        }
        if (!existing.shopNames || existing.shopNames.length === 0) {
          existing.shopNames = [...defaultShopNames];
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
          let parsed = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
          if (parsed && typeof parsed.data === 'string') {
            try { parsed = JSON.parse(parsed.data); } catch {}
          }
          const keyVal = doc.key || doc.$id || '';
          if (keyVal.startsWith('usr_')) {
            if (parsed && parsed.organizationId) {
              userRightsList.push(parsed);
            }
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
