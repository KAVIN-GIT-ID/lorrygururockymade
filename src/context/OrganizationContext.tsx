import { createContext, useContext, createSignal } from 'solid-js';
import { OrganizationProfile } from '../types';
import { organizationService } from '../services/organizationService';
import { isAppwriteConfigured } from '../lib/appwrite';
import { useAuth } from './AuthContext';
import { usePermissions } from './PermissionContext';

interface OrganizationContextType {
  organizationProfiles: () => OrganizationProfile[];
  setOrganizationProfiles: (profiles: OrganizationProfile[]) => void;
  saveProfiles: (nextProfiles: OrganizationProfile[]) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider(props: { children: any }) {
  const { currentUser } = useAuth();
  const { currentUserRights } = usePermissions();
  const [organizationProfiles, setOrganizationProfiles] = createSignal<OrganizationProfile[]>([]);

  // Since we want initializer logic to run immediately:
  try {
    const stored = localStorage.getItem('ttt_organization_profiles');
    let profiles = stored ? JSON.parse(stored) : [];
    if (isAppwriteConfigured()) {
      profiles = profiles.filter((p: any) => p.organizationId !== 'org_default');
    }
    setOrganizationProfiles(profiles);
  } catch {
    setOrganizationProfiles([]);
  }

  const saveProfiles = async (nextProfiles: OrganizationProfile[]) => {
    const prev = organizationProfiles();
    setOrganizationProfiles(nextProfiles);
    await organizationService.saveOrganizationProfiles(
      nextProfiles,
      prev,
      currentUser()?.email,
      currentUserRights()
    );
  };

  const orgValue: OrganizationContextType = {
    organizationProfiles,
    setOrganizationProfiles,
    saveProfiles
  };

  return (
    <OrganizationContext.Provider value={orgValue}>
      {props.children}
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
