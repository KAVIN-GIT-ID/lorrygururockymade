import { onMount, createContext, useContext, createSignal, createEffect, createMemo, Accessor } from 'solid-js';
import { useOrganizations } from '../context/OrganizationContext';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuditLogsContext } from '../context/AuditLogContext';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { useAdminActions } from '../hooks/useAdminActions';
import { OrganizationProfile, UserPermission } from '../types';

interface OrganizationContextType {
  organizationProfiles: Accessor<OrganizationProfile[]>;
  setOrganizationProfiles: (profiles: OrganizationProfile[]) => void;
  saveOrganizationProfiles: (profiles: OrganizationProfile[]) => Promise<void>;
  teamMembers: () => any[];
  loadingTeamMembers: () => boolean;
  handleUpdateOrgProfile: (updatedProfile: OrganizationProfile) => Promise<void>;
  handleUpdateOrgStatus: (orgId: string, status: 'Active' | 'Disabled') => void;
  handleUpdateOrgLimit: (orgId: string, limit: number) => void;
  handleApproveTruckRequest: (orgId: string, requestId: string, truckNo: string, duration?: '1M' | '3M' | '6M' | '1Y') => void;
  handleRejectTruckRequest: (orgId: string, requestId: string, fallbackTruckNo?: string) => void;
  saveUserRightsListWithSync: (newList: UserPermission[]) => void;
  orgUserRights: Accessor<UserPermission[]>;
  currentOrgProfile: Accessor<OrganizationProfile | undefined>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationManager(props: { children: any; activeTab: () => string; hasUsersTabAccess: () => boolean }) {
  onMount(() => {
    console.log("OrganizationManager mounted");
  });
  const { currentUser } = useAuth();
  const perm = usePermissions();
  const orgs = useOrganizations();
  const notifications = useNotifications();
  const auditLogsCtx = useAuditLogsContext();

  const organizationProfiles = orgs.organizationProfiles;
  const setOrganizationProfiles = orgs.setOrganizationProfiles;
  const saveOrganizationProfiles = orgs.saveProfiles;

  const [teamMembers, setTeamMembers] = createSignal<any[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = createSignal(false);

  const currentUserOrgId = () => perm.currentUserRights()?.organizationId || '';
  const currentUserRights = perm.currentUserRights;
  const userRightsList = perm.userRightsList;
  const setUserRightsList = perm.setUserRightsList;
  const pushPermissionsToCloud = perm.pushPermissions;

  // Fetch live Appwrite memberships whenever admin opens the USERS panel
  createEffect(() => {
    if (props.activeTab() === 'USERS' && props.hasUsersTabAccess() && currentUserOrgId() && isAppwriteConfigured()) {
      setLoadingTeamMembers(true);
      appwrite.getTeamMemberships(currentUserOrgId())
        .then(members => setTeamMembers(members))
        .catch(err => console.warn('Could not fetch team memberships:', err))
        .finally(() => setLoadingTeamMembers(false));
    }
  });

  const handleUpdateOrgProfile = async (updatedProfile: OrganizationProfile) => {
    const nextProfiles = organizationProfiles().map(p =>
      p.organizationId === updatedProfile.organizationId ? updatedProfile : p
    );
    await saveOrganizationProfiles(nextProfiles);
  };

  const adminActions = useAdminActions({
    organizationProfiles,
    saveOrganizationProfiles,
    showNotification: notifications.showNotification,
    logAction: auditLogsCtx.logAction
  });

  const saveUserRightsList = (nextList: UserPermission[]) => {
    setUserRightsList(nextList);
    localStorage.setItem('ttt_user_rights', JSON.stringify(nextList));
  };

  const saveUserRightsListWithSync = (newList: UserPermission[]) => {
    saveUserRightsList(newList);
    pushPermissionsToCloud(newList);
  };

  const orgUserRights = createMemo(() => {
    const activeOrgId = currentUserRights()?.organizationId || '';
    return userRightsList().filter(u => u.organizationId === activeOrgId);
  });

  const currentOrgProfile = createMemo(() => {
    const activeOrgId = currentUserRights()?.organizationId || '';
    return organizationProfiles().find(p => p.organizationId === activeOrgId);
  });

  const value: OrganizationContextType = {
    organizationProfiles,
    setOrganizationProfiles,
    saveOrganizationProfiles,
    teamMembers,
    loadingTeamMembers,
    handleUpdateOrgProfile,
    handleUpdateOrgStatus: adminActions.handleUpdateOrgStatus,
    handleUpdateOrgLimit: adminActions.handleUpdateOrgLimit,
    handleApproveTruckRequest: adminActions.handleApproveTruckRequest,
    handleRejectTruckRequest: adminActions.handleRejectTruckRequest,
    saveUserRightsListWithSync,
    orgUserRights,
    currentOrgProfile
  };

  return (
    <OrganizationContext.Provider value={value}>
      {props.children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationManager() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganizationManager must be used within an OrganizationManager');
  }
  return context;
}
