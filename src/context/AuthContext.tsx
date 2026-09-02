import { createContext, useContext, createSignal } from 'solid-js';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { authService } from '../services/authService';
import { UserPermission, OrganizationProfile } from '../types';

interface AuthContextType {
  currentUser: () => any;
  setCurrentUser: (user: any) => void;
  loadingUser: () => boolean;
  setLoadingUser: (loading: boolean) => void;
  initialPullDone: () => boolean;
  setInitialPullDone: (done: boolean) => void;
  isOnline: () => boolean;
  setIsOnline: (online: boolean) => void;
  disconnectReason: () => 'offline' | 'realtime_lost' | undefined;
  setDisconnectReason: (reason: 'offline' | 'realtime_lost' | undefined) => void;
  reconcileUserSession: (
    user: any,
    userRightsList: UserPermission[],
    setUserRights: (list: UserPermission[]) => void,
    orgProfiles: OrganizationProfile[],
    setOrgProfiles: (list: OrganizationProfile[]) => void,
    migrateLocalData: (orgId: string) => void
  ) => Promise<{ nextRights: UserPermission[]; nextProfiles: OrganizationProfile[] }>;
  logoutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider(props: { children: any }) {
  const [currentUser, setCurrentUser] = createSignal<any>(null);
  const [loadingUser, setLoadingUser] = createSignal(true);
  const [initialPullDone, setInitialPullDone] = createSignal(!isAppwriteConfigured());
  const [isOnline, setIsOnline] = createSignal(true);
  const [disconnectReason, setDisconnectReason] = createSignal<'offline' | 'realtime_lost' | undefined>(undefined);

  const reconcileUserSession = async (
    user: any,
    userRightsList: UserPermission[],
    setUserRights: (list: UserPermission[]) => void,
    orgProfiles: OrganizationProfile[],
    setOrgProfiles: (list: OrganizationProfile[]) => void,
    migrateLocalData: (orgId: string) => void
  ) => {
    const res = await authService.reconcileSession(
      user,
      userRightsList,
      setUserRights,
      orgProfiles,
      setOrgProfiles,
      migrateLocalData
    );
    setCurrentUser(user);
    return res;
  };

  const logoutUser = async () => {
    await authService.handleLogout(currentUser()?.email);
    setCurrentUser(null);
    setInitialPullDone(!isAppwriteConfigured());
  };

  const authValue: AuthContextType = {
    currentUser,
    setCurrentUser,
    loadingUser,
    setLoadingUser,
    initialPullDone,
    setInitialPullDone,
    isOnline,
    setIsOnline,
    disconnectReason,
    setDisconnectReason,
    reconcileUserSession,
    logoutUser
  };

  return (
    <AuthContext.Provider value={authValue}>
      {props.children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
