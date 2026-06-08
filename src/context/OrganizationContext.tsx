import React, { createContext, useContext, useState } from 'react';
import { OrganizationProfile } from '../types';
import { storageService } from '../services/storageService';
import { organizationService } from '../services/organizationService';
import { isAppwriteConfigured } from '../lib/appwrite';
import { useAuth } from './AuthContext';
import { usePermissions } from './PermissionContext';

interface OrganizationContextType {
  organizationProfiles: OrganizationProfile[];
  setOrganizationProfiles: React.Dispatch<React.SetStateAction<OrganizationProfile[]>>;
  saveProfiles: (nextProfiles: OrganizationProfile[]) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const { currentUserRights } = usePermissions();
  const [organizationProfiles, setOrganizationProfiles] = useState<OrganizationProfile[]>(() => {
    try {
      const stored = localStorage.getItem('ttt_organization_profiles');
      let profiles = stored ? JSON.parse(stored) : [];
      if (isAppwriteConfigured()) {
        profiles = profiles.filter((p: any) => p.organizationId !== 'org_default');
      }
      return profiles;
    } catch {
      return [];
    }
  });

  const saveProfiles = async (nextProfiles: OrganizationProfile[]) => {
    await organizationService.saveOrganizationProfiles(
      nextProfiles,
      organizationProfiles,
      currentUser?.email,
      currentUserRights
    );
    setOrganizationProfiles(nextProfiles);
  };

  const orgValue = React.useMemo(() => ({
    organizationProfiles,
    setOrganizationProfiles,
    saveProfiles
  }), [organizationProfiles]);

  return (
    <OrganizationContext.Provider value={orgValue}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizations() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganizations must be used within an OrganizationProvider');
  }
  return context;
}
