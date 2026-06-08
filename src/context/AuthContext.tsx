import React, { createContext, useContext, useState, useEffect } from 'react';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { authService } from '../services/authService';
import { storageService } from '../services/storageService';
import { UserPermission, OrganizationProfile } from '../types';

interface AuthContextType {
  currentUser: any;
  setCurrentUser: React.Dispatch<React.SetStateAction<any>>;
  loadingUser: boolean;
  setLoadingUser: React.Dispatch<React.SetStateAction<boolean>>;
  initialPullDone: boolean;
  setInitialPullDone: React.Dispatch<React.SetStateAction<boolean>>;
  isOnline: boolean;
  setIsOnline: React.Dispatch<React.SetStateAction<boolean>>;
  disconnectReason: 'offline' | 'realtime_lost' | undefined;
  setDisconnectReason: React.Dispatch<React.SetStateAction<'offline' | 'realtime_lost' | undefined>>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [initialPullDone, setInitialPullDone] = useState(() => !isAppwriteConfigured());
  const [isOnline, setIsOnline] = useState(true);
  const [disconnectReason, setDisconnectReason] = useState<'offline' | 'realtime_lost' | undefined>(undefined);

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
    await authService.handleLogout(currentUser?.email);
    setCurrentUser(null);
    setInitialPullDone(!isAppwriteConfigured());
  };

  const authValue = React.useMemo(() => ({
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
  }), [
    currentUser,
    loadingUser,
    initialPullDone,
    isOnline,
    disconnectReason
  ]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
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
