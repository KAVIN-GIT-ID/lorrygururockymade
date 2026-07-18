import { createContext, useContext, createSignal, createMemo } from 'solid-js';
import { UserPermission, UserRights } from '../types';
import { permissionService } from '../services/permissionService';
import { storageService } from '../services/storageService';
import { useAuth } from './AuthContext';
import { migrateUserPermissions } from '../lib/migrations';
import { isAppwriteConfigured, appwrite } from '../lib/appwrite';

interface PermissionContextType {
  userRightsList: () => UserPermission[];
  setUserRightsList: (list: UserPermission[]) => void;
  currentUserRights: () => UserRights;
  currentUserOrgId: () => string;
  permissionsMap: () => Map<string, UserPermission>;
  addPermission: (
    newPerm: Omit<UserPermission, 'id'>,
    showNotification: (msg: string) => void,
    logAction: (action: string, cat: string, ref: string, detail: string) => void
  ) => Promise<void>;
  updatePermission: (
    updated: UserPermission,
    showNotification: (msg: string) => void,
    logAction: (action: string, cat: string, ref: string, detail: string) => void,
    currentUserOrgId: string
  ) => Promise<void>;
  deletePermission: (
    id: string,
    showNotification: (msg: string) => void,
    logAction: (action: string, cat: string, ref: string, detail: string) => void,
    currentUserOrgId: string
  ) => Promise<void>;
  pushPermissions: (list: UserPermission[], forceEmail?: string) => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider(props: { children: any }) {
  const { currentUser } = useAuth();
  const [userRightsList, setUserRightsList] = createSignal<UserPermission[]>([]);

  // Initialize state
  try {
    const stored = localStorage.getItem('ttt_user_rights');
    let list = stored ? migrateUserPermissions(JSON.parse(stored)) : [];
    if (isAppwriteConfigured()) {
      list = list.filter(r => r.organizationId !== 'org_default');
    }
    setUserRightsList(list);
  } catch {
    setUserRightsList([]);
  }

  const permissionsMap = createMemo(() => {
    return new Map(userRightsList().map(u => [u.email.toLowerCase().trim(), u]));
  });

  const currentUserRights = createMemo(() => {
    return permissionService.getCurrentUserRights(currentUser(), userRightsList());
  });

  const pushPermissions = async (nextUserRights: UserPermission[], forceEmail?: string) => {
    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const loggedInEmail = (currentUser()?.email || forceEmail || '').toLowerCase().trim();
        const isNotLoggedIn = !currentUser();
        const prevRights = userRightsList();

        const savePromises = nextUserRights.map(async (ur) => {
          const isOwnOrg = ur.organizationId && ur.organizationId === currentUserRights().organizationId;
          const isSelf = ur.email.toLowerCase().trim() === loggedInEmail;

          if (!isNotLoggedIn && !currentUserRights().isSuperAdmin && !isOwnOrg && !isSelf) {
            return;
          }

          if (isNotLoggedIn && loggedInEmail && !isSelf) {
            return;
          }

          // Change-detection: Only save if new or modified (unless forced)
          const isForced = forceEmail && ur.email.toLowerCase().trim() === forceEmail.toLowerCase().trim();
          const prevUr = prevRights.find(p => p.email.toLowerCase() === ur.email.toLowerCase());
          if (!isForced && prevUr && JSON.stringify(prevUr) === JSON.stringify(ur)) {
            return;
          }

          try {
            const docId = appwrite.getEmailDocId(ur.email);
            await appwrite.saveGlobalConfig(databaseId, docId, ur);
          } catch (singleErr) {
            console.error(`Could not sync user permission for ${ur.email}:`, singleErr);
          }
        });

        await Promise.all(savePromises);
        console.log('Successfully synced registration user permissions to Appwrite Database.');
      } catch (e: any) {
        console.error("Could not sync registration user permissions to database:", e);
      }
    }
  };

  const addPermission = async (
    newPerm: Omit<UserPermission, 'id'>,
    showNotification: (msg: string) => void,
    logAction: (action: string, cat: string, ref: string, detail: string) => void
  ) => {
    if (newPerm.organizationId === 'org_backend') {
      if (!currentUserRights().isSuperAdmin || !currentUserRights().canAddBackend) {
        showNotification("Error: You do not have permission to add backend team members.");
        return;
      }
    }
    const item = { ...newPerm, id: 'ur_' + Date.now() };
    const next = [...userRightsList(), item];
    setUserRightsList(next);
    storageService.set('ttt_user_rights', next);
    await pushPermissions(next);
    logAction('Created', 'Permission', newPerm.email, `Created and authorized user rights for ${newPerm.name} (${newPerm.email})`);
    showNotification(`Access authorized for ${newPerm.name}.`);
  };

  const updatePermission = async (
    updated: UserPermission,
    showNotification: (msg: string) => void,
    logAction: (action: string, cat: string, ref: string, detail: string) => void,
    currentUserOrgId: string
  ) => {
    const email = (currentUser()?.email || '').toLowerCase().trim();
    const currentMember = permissionsMap().get(email);
    const currentUserRole = currentMember?.role || 'Custom';

    const original = permissionsMap().get(updated.email.toLowerCase().trim());
    if (original && currentUserRole === 'Custom' && (original.role === 'Admin' || original.role === 'SuperAdmin')) {
      showNotification("Error: You do not have permission to modify Administrator or Super Admin accounts.");
      return;
    }

    if (updated.organizationId === 'org_backend') {
      if (!currentUserRights().isSuperAdmin || !currentUserRights().canEditBackend) {
        showNotification("Error: You do not have permission to edit backend team members.");
        return;
      }
    }
    const wasApproved = original ? original.isApproved : false;
    const isNowApproved = updated.isApproved;

    const next = userRightsList().map(p => p.id === updated.id ? updated : p);
    setUserRightsList(next);
    storageService.set('ttt_user_rights', next);
    await pushPermissions(next);

    let details = `Updated permissions for ${updated.name} (${updated.email}).`;
    if (!wasApproved && isNowApproved) {
      details = `Approved user ${updated.name} (${updated.email}) and updated role to ${updated.role}.`;
    } else if (wasApproved && !isNowApproved) {
      details = `Revoked approval for user ${updated.name} (${updated.email}).`;
    }
    logAction('Edited', 'Permission', updated.email, details);

    if (!wasApproved && isNowApproved && isAppwriteConfigured() && currentUserOrgId) {
      try {
        console.info(`Admin approved user ${updated.email}. Inviting them to Appwrite Team ${currentUserOrgId}...`);
        await appwrite.inviteToTeam(currentUserOrgId, updated.email.trim().toLowerCase(), updated.name.trim());
        showNotification(`Appwrite Team invitation sent to ${updated.email}`);
      } catch (err: any) {
        console.warn("Failed to invite approved user to Appwrite Team:", err);
        showNotification(`Warning: Could not create Appwrite Team membership: ${err.message || err}`);
      }
    }
  };

  const deletePermission = async (
    id: string,
    showNotification: (msg: string) => void,
    logAction: (action: string, cat: string, ref: string, detail: string) => void,
    currentUserOrgId: string
  ) => {
    const target = userRightsList().find(p => p.id === id);
    if (!target) return;

    const email = (currentUser()?.email || '').toLowerCase().trim();
    const currentMember = permissionsMap().get(email);
    const currentUserRole = currentMember?.role || 'Custom';

    if (currentUserRole === 'Custom' && (target.role === 'Admin' || target.role === 'SuperAdmin')) {
      showNotification("Error: You do not have permission to revoke Administrator or Super Admin accounts.");
      return;
    }

    if (target.organizationId === 'org_backend') {
      if (!currentUserRights().isSuperAdmin || !currentUserRights().canDeleteBackend) {
        showNotification("Error: You do not have permission to revoke backend team access.");
        return;
      }
    }

    let appwriteRemoved = true;
    let removeErrorMsg = "";

    if (isAppwriteConfigured() && currentUserOrgId) {
      try {
        const res = await appwrite.removeMembership(currentUserOrgId, target.email);
        if (!res) {
          appwriteRemoved = false;
          removeErrorMsg = "User was not found in the Appwrite Team list.";
        }
      } catch (err: any) {
        appwriteRemoved = false;
        removeErrorMsg = err.message || String(err);
      }
    }

    const next = userRightsList().filter(p => p.id !== id);
    setUserRightsList(next);
    storageService.set('ttt_user_rights', next);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const docId = appwrite.getEmailDocId(target.email);
        await appwrite.deleteGlobalConfig(databaseId, docId);
      } catch (e) {
        console.warn("Failed to delete user config from cloud:", e);
      }
    }

    logAction('Deleted', 'Permission', target.email, `Revoked access rights for ${target.name} (${target.email})`);

    if (appwriteRemoved) {
      showNotification("User access revoked.");
    } else {
      alert(`Access revoked locally, but Appwrite team membership could not be removed.\n\nReason: ${removeErrorMsg}\n\nPlease check Appwrite console.`);
      showNotification("Access revoked locally with Appwrite warnings.");
    }
  };

  const currentUserOrgId = createMemo(() => currentUserRights()?.organizationId || '');

  const permValue: PermissionContextType = {
    userRightsList,
    setUserRightsList,
    currentUserRights,
    currentUserOrgId,
    permissionsMap,
    addPermission,
    updatePermission,
    deletePermission,
    pushPermissions
  };

  return (
    <PermissionContext.Provider value={permValue}>
      {props.children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}
