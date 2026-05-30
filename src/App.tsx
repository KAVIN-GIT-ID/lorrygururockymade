import React, { useState, useEffect, useRef } from 'react';
import { Truck, Driver, Office, Account, SubTrip, TripEntry, getTripMetrics, ExpenseEntry, AuditLog, TripPayment, TripAdvance, FuelEntry, Tyre, TyreStatus, TyreMovementLog, UserPermission, UserRights, OrganizationProfile, TruckRequest } from './types';
import Dashboard from './components/Dashboard';
import TripList from './components/TripList';
import TripForm from './components/TripForm';
import TruckMaster from './components/TruckMaster';
import DriverMaster from './components/DriverMaster';
import OfficeMaster from './components/OfficeMaster';
import AccountMaster from './components/AccountMaster';
import ExpenseMaster from './components/ExpenseMaster';
import MonthlyReport from './components/MonthlyReport';
import AuditLogView from './components/AuditLogView';
import TyreMaster from './components/TyreMaster';
import AppwriteCloudSync from './components/AppwriteCloudSync';
import LoginScreen from './components/LoginScreen';
import UserAccessControl from './components/UserAccessControl';
import BackendDashboard from './components/BackendDashboard';
import VoiceAssistant from './components/VoiceAssistant';
import { appwrite, isAppwriteConfigured } from './lib/appwrite';
import { useDrivers } from './hooks/useDrivers';
import { useOffices } from './hooks/useOffices';
import { useAccounts } from './hooks/useAccounts';
import { useExpenses } from './hooks/useExpenses';
import { useTyres } from './hooks/useTyres';
import { useTrucks } from './hooks/useTrucks';
import { useTrips } from './hooks/useTrips';
import { useAuditLogs } from './hooks/useAuditLogs';
import {
  migrateTripsIfNecessary,
  migrateUserPermissions,
  migrateTrucks,
  migrateDrivers,
  migrateOffices,
  migrateAccounts,
  migrateTrips,
  migrateExpenses,
  migrateTyres,
  migrateAuditLogs
} from './lib/migrations';
import { formatDate, parseLocalDate, getTodayStr, formatToDisplayDate } from './lib/dateUtils';
import {
  BarChart3,
  Plus,
  BookOpen,
  Truck as TruckIcon,
  MapPin,
  Coins,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  UserCheck,
  FileText,
  History,
  Disc,
  LogOut,
  Loader,
  Users,
  Copy,
  Bell,
  User,
  Search,
  Sun,
  Moon,
  Clock,
  Settings,
  ShieldCheck,
  Trash2,
  X,
  Mic
} from 'lucide-react';



const getUserInitials = (user: any) => {
  if (!user) return '??';
  const name = user.name || user.email || '';
  if (!name) return '??';
  const parts = name.split(/[\s.@]+/);
  const initials = parts
    .filter(Boolean)
    .map((p: string) => p[0])
    .join('')
    .toUpperCase();
  return initials.slice(0, 2) || name.slice(0, 2).toUpperCase();
};

const reconcileOrganizationProfiles = (
  rights: UserPermission[],
  currentProfiles: OrganizationProfile[],
  knownNames: { [orgId: string]: string } = {}
): OrganizationProfile[] => {
  let profiles = [...currentProfiles];

  if (isAppwriteConfigured()) {
    profiles = profiles.filter(p => p.organizationId !== 'org_default');
  }

  // Find all unique organizationIds in rights (excluding org_backend)
  const orgIds = Array.from(new Set(rights.map(r => r.organizationId).filter(Boolean)))
    .filter(orgId => orgId !== 'org_backend' && (!isAppwriteConfigured() || orgId !== 'org_default'));

  // Filter profiles to only keep those that have at least one active user permission in rights.
  // This prevents resurrection of organization profiles whose corresponding users have been deleted.
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
            // Construct a nice human-readable name based on the admin's name or email
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
          // Also fix organizationName if it is a raw ID string!
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
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [initialPullDone, setInitialPullDone] = useState(() => !isAppwriteConfigured());
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [lastReadNotificationTime, setLastReadNotificationTime] = useState(0);

  const notificationRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Read notification time scoped by current user to prevent cross-account read marks
  useEffect(() => {
    if (currentUser) {
      const key = `ttt_last_read_notifications_${(currentUser.email || '').toLowerCase().trim()}`;
      setLastReadNotificationTime(Number(localStorage.getItem(key) || '0'));
    } else {
      setLastReadNotificationTime(0);
    }
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [activeMonth, setActiveMonth] = useState(() => {
    const today = new Date();
    return String(today.getMonth() + 1).padStart(2, '0');
  });
  const [activeYear, setActiveYear] = useState(() => {
    return String(new Date().getFullYear());
  });

  const [changeOrgIdInput, setChangeOrgIdInput] = useState('');
  const [changeOrgLoading, setChangeOrgLoading] = useState(false);
  const [changeOrgError, setChangeOrgError] = useState<string | null>(null);
  const [showChangeOrgForm, setShowChangeOrgForm] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ttt_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Profile update form states
  const [profileName, setProfileName] = useState('');
  const [profileOrgName, setProfileOrgName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Voice language state
  const [userVoiceLang, setUserVoiceLang] = useState<string>('en-IN');
  const [profileVoiceLang, setProfileVoiceLang] = useState<string>('en-IN');

  // Load user's default voice language preference from localStorage
  useEffect(() => {
    if (currentUser) {
      const email = (currentUser.email || '').toLowerCase().trim();
      const storedLang = localStorage.getItem(`ttt_voice_lang_${email}`) || 'en-IN';
      setUserVoiceLang(storedLang);
    } else {
      setUserVoiceLang('en-IN');
    }
  }, [currentUser]);

  // Sync profile update inputs when user details or modal state updates
  useEffect(() => {
    if (profileModalOpen && currentUser) {
      setProfileName(currentUser.name || '');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      const email = (currentUser.email || '').toLowerCase().trim();
      setProfileVoiceLang(localStorage.getItem(`ttt_voice_lang_${email}`) || 'en-IN');
    }
  }, [profileModalOpen, currentUser]);

  // User Access Control States
  const [userRightsList, setUserRightsList] = useState<UserPermission[]>(() => {
    try {
      const stored = localStorage.getItem('ttt_user_rights');
      let list = stored ? migrateUserPermissions(JSON.parse(stored)) : [];
      if (isAppwriteConfigured()) {
        list = list.filter(r => r.organizationId !== 'org_default');
      }
      return list;
    } catch {
      return [];
    }
  });

  const saveUserRightsList = (nextList: UserPermission[]) => {
    setUserRightsList(nextList);
    localStorage.setItem('ttt_user_rights', JSON.stringify(nextList));
  };

  const userRightsListRef = useRef(userRightsList);
  userRightsListRef.current = userRightsList;

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

  const organizationProfilesRef = useRef(organizationProfiles);
  organizationProfilesRef.current = organizationProfiles;

  const saveOrganizationProfiles = async (nextProfiles: OrganizationProfile[]) => {
    setOrganizationProfiles(nextProfiles);
    localStorage.setItem('ttt_organization_profiles', JSON.stringify(nextProfiles));

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const userRights = getCurrentUserRights();
        const isNotLoggedIn = !currentUser;
        for (const prof of nextProfiles) {
          if (!isNotLoggedIn && !userRights.isSuperAdmin && prof.organizationId !== userRights.organizationId) {
            continue;
          }
          const docId = appwrite.getOrgDocId(prof.organizationId);
          await appwrite.saveGlobalConfig(databaseId, docId, prof);
        }
        console.log('Successfully synced organization profiles to Appwrite Database.');
      } catch (e) {
        console.warn("Could not sync organization profiles to database:", e);
      }
    }
  };

  const saveOrganizationProfilesRef = useRef(saveOrganizationProfiles);
  saveOrganizationProfilesRef.current = saveOrganizationProfiles;

  const handleAddPermission = async (newPerm: Omit<UserPermission, 'id'>) => {
    if (newPerm.organizationId === 'org_backend') {
      if (!currentUserRights.isSuperAdmin || !currentUserRights.canAddBackend) {
        showNotification("Error: You do not have permission to add backend team members.");
        return;
      }
    }
    const item = { ...newPerm, id: 'ur_' + Date.now() };
    const next = [...userRightsList, item];
    saveUserRightsList(next);
    await pushPermissionsToCloud(next);
    logAction('Created', 'Permission', newPerm.email, `Created and authorized user rights for ${newPerm.name} (${newPerm.email})`);
    showNotification(`Access authorized for ${newPerm.name}.`);
  };

  const handleUpdatePermission = async (updated: UserPermission) => {
    const email = (currentUser?.email || '').toLowerCase().trim();
    const currentMember = userRightsList.find(ur => ur.email.toLowerCase().trim() === email);
    const currentUserRole = currentMember?.role || 'Custom';

    const original = userRightsList.find(p => p.id === updated.id);
    if (original && currentUserRole === 'Custom' && (original.role === 'Admin' || original.role === 'SuperAdmin')) {
      showNotification("Error: You do not have permission to modify Administrator or Super Admin accounts.");
      return;
    }

    if (updated.organizationId === 'org_backend') {
      if (!currentUserRights.isSuperAdmin || !currentUserRights.canEditBackend) {
        showNotification("Error: You do not have permission to edit backend team members.");
        return;
      }
    }
    const wasApproved = original ? original.isApproved : false;
    const isNowApproved = updated.isApproved;

    const next = userRightsList.map(p => p.id === updated.id ? updated : p);
    saveUserRightsList(next);
    await pushPermissionsToCloud(next);

    let details = `Updated permissions for ${updated.name} (${updated.email}).`;
    if (!wasApproved && isNowApproved) {
      details = `Approved user ${updated.name} (${updated.email}) and updated role to ${updated.role}.`;
    } else if (wasApproved && !isNowApproved) {
      details = `Revoked approval for user ${updated.name} (${updated.email}).`;
    }
    logAction('Edited', 'Permission', updated.email, details);

    // If transitioning to approved and Appwrite is configured, invite them to the team under Admin's session
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

  const handleDeletePermission = async (id: string) => {
    const target = userRightsList.find(p => p.id === id);
    if (!target) return;

    const email = (currentUser?.email || '').toLowerCase().trim();
    const currentMember = userRightsList.find(ur => ur.email.toLowerCase().trim() === email);
    const currentUserRole = currentMember?.role || 'Custom';

    if (currentUserRole === 'Custom' && (target.role === 'Admin' || target.role === 'SuperAdmin')) {
      showNotification("Error: You do not have permission to revoke Administrator or Super Admin accounts.");
      return;
    }

    if (target.organizationId === 'org_backend') {
      if (!currentUserRights.isSuperAdmin || !currentUserRights.canDeleteBackend) {
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

    const next = userRightsList.filter(p => p.id !== id);
    saveUserRightsList(next);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const docId = appwrite.getEmailDocId(target.email);
        await appwrite.deleteGlobalConfig(databaseId, docId);
        console.log(`Successfully deleted global config for ${target.email} from cloud.`);
      } catch (e) {
        console.warn("Failed to delete user config from cloud:", e);
      }
    }

    logAction('Deleted', 'Permission', target.email, `Revoked access rights for ${target.name} (${target.email})`);

    if (appwriteRemoved) {
      showNotification("User access revoked.");
    } else {
      alert(`Access revoked in local rights, but Appwrite team membership could not be removed.\n\nReason: ${removeErrorMsg}\n\nPlease check Appwrite console.`);
      showNotification("Access revoked locally with Appwrite warnings.");
    }
  };

  const getCurrentUserRights = (): UserRights => {
    if (!currentUser) {
      return {
        isAdmin: false,
        organizationId: '',
        isApproved: false,
        canViewTrips: false, canEditTrips: false, canDeleteTrips: false,
        canViewTyres: false, canEditTyres: false, canDeleteTyres: false,
        canViewTrucks: false, canEditTrucks: false, canDeleteTrucks: false,
        canViewDrivers: false, canEditDrivers: false, canDeleteDrivers: false,
        canViewOffices: false, canEditOffices: false, canDeleteOffices: false,
        canViewAccounts: false, canEditAccounts: false, canDeleteAccounts: false,
        canViewExpenses: false, canEditExpenses: false, canDeleteExpenses: false,
        canViewBackend: false, canAddBackend: false, canEditBackend: false, canDeleteBackend: false, canApproveBackend: false,
        canViewTruckRequests: false, canDeleteTruckRequests: false, canViewBackendTeam: false, canDeleteBackendTeam: false,
                canViewDatabaseConsole: false, canEditDatabaseConsole: false, canDeleteDatabaseConsole: false,
        canEditLoans: false, canDeleteLoans: false
      };
    }
    const email = (currentUser.email || '').toLowerCase().trim();
    const match = userRightsList.find(ur => ur.email.toLowerCase().trim() === email);
    if (match) {
      const isSuper = match.role === 'SuperAdmin' || match.organizationId === 'org_backend';
      const isPrimarySuperAdmin = match.role === 'SuperAdmin';
      return {
        isAdmin: match.role === 'Admin' || isSuper,
        isSuperAdmin: isSuper,
        organizationId: match.organizationId,
        isApproved: match.isApproved,
        // Hide standard operations from Super Admin
        canViewTrips: isSuper ? false : match.canViewTrips,
        canEditTrips: isSuper ? false : match.canEditTrips,
        canDeleteTrips: isSuper ? false : match.canDeleteTrips,
        canViewTyres: isSuper ? false : match.canViewTyres,
        canEditTyres: isSuper ? false : match.canEditTyres,
        canDeleteTyres: isSuper ? false : match.canDeleteTyres,
        canViewTrucks: isSuper ? false : match.canViewTrucks,
        canEditTrucks: isSuper ? false : match.canEditTrucks,
        canDeleteTrucks: isSuper ? false : match.canDeleteTrucks,
        canViewDrivers: isSuper ? false : match.canViewDrivers,
        canEditDrivers: isSuper ? false : match.canEditDrivers,
        canDeleteDrivers: isSuper ? false : match.canDeleteDrivers,
        canViewOffices: isSuper ? false : match.canViewOffices,
        canEditOffices: isSuper ? false : match.canEditOffices,
        canDeleteOffices: isSuper ? false : match.canDeleteOffices,
        canViewAccounts: isSuper ? false : match.canViewAccounts,
        canEditAccounts: isSuper ? false : match.canEditAccounts,
        canDeleteAccounts: isSuper ? false : match.canDeleteAccounts,
        canViewExpenses: isSuper ? false : match.canViewExpenses,
        canEditExpenses: isSuper ? false : match.canEditExpenses,
        canDeleteExpenses: isSuper ? false : match.canDeleteExpenses,
        // Backend team fine-grained privileges
        // NOTE: Use !!match.xxx (not match.xxx !== false) to correctly handle undefined as false.
        // undefined !== false evaluates to true which would incorrectly grant access to new users
        // whose records were created before these fields existed.
        canViewBackend: isSuper ? (isPrimarySuperAdmin || !!match.canViewBackend) : false,
        canAddBackend: isSuper ? (isPrimarySuperAdmin || !!match.canAddBackend) : false,
        canEditBackend: isSuper ? (isPrimarySuperAdmin || !!match.canEditBackend) : false,
        canDeleteBackend: isSuper ? (isPrimarySuperAdmin || !!match.canDeleteBackend) : false,
        canApproveBackend: isSuper ? (isPrimarySuperAdmin || !!match.canApproveBackend) : false,
        canViewTruckRequests: isSuper ? (isPrimarySuperAdmin || !!match.canViewTruckRequests) : false,
        canDeleteTruckRequests: isSuper ? (isPrimarySuperAdmin || !!match.canDeleteTruckRequests) : false,
        canViewBackendTeam: isSuper ? (isPrimarySuperAdmin || !!match.canViewBackendTeam) : false,
        canDeleteBackendTeam: isSuper ? (isPrimarySuperAdmin || !!match.canDeleteBackendTeam) : false,
                canViewDatabaseConsole: isSuper ? (isPrimarySuperAdmin || !!match.canViewDatabaseConsole) : false,
        canEditDatabaseConsole: isSuper ? (isPrimarySuperAdmin || !!match.canEditDatabaseConsole) : false,
        canDeleteDatabaseConsole: isSuper ? (isPrimarySuperAdmin || !!match.canDeleteDatabaseConsole) : false,
        canEditLoans: isSuper ? false : (match.role === 'Admin' || !!match.canEditLoans),
        canDeleteLoans: isSuper ? false : (match.role === 'Admin' || !!match.canDeleteLoans)
      };
    }

    return {
      isAdmin: false,
      organizationId: '',
      isApproved: false,
      canViewTrips: false, canEditTrips: false, canDeleteTrips: false,
      canViewTyres: false, canEditTyres: false, canDeleteTyres: false,
      canViewTrucks: false, canEditTrucks: false, canDeleteTrucks: false,
      canViewDrivers: false, canEditDrivers: false, canDeleteDrivers: false,
      canViewOffices: false, canEditOffices: false, canDeleteOffices: false,
      canViewAccounts: false, canEditAccounts: false, canDeleteAccounts: false,
      canViewExpenses: false, canEditExpenses: false, canDeleteExpenses: false,
      canViewBackend: false, canAddBackend: false, canEditBackend: false, canDeleteBackend: false, canApproveBackend: false,
      canViewTruckRequests: false, canDeleteTruckRequests: false, canViewBackendTeam: false, canDeleteBackendTeam: false,
            canViewDatabaseConsole: false, canEditDatabaseConsole: false, canDeleteDatabaseConsole: false,
      canEditLoans: false, canDeleteLoans: false
    };
  };

  const currentUserRights = getCurrentUserRights();

  // Sync profile organization name input when modal or profiles updates
  useEffect(() => {
    if (profileModalOpen && currentUser) {
      const currentOrgId = currentUserRights?.organizationId || '';
      const currentOrg = organizationProfiles.find(p => p.organizationId === currentOrgId);
      setProfileOrgName(currentOrg ? currentOrg.organizationName : '');
    }
  }, [profileModalOpen, currentUser, currentUserRights?.organizationId, organizationProfiles]);

  const fetchAllGlobalConfigs = async (databaseId: string): Promise<{ userRightsList: UserPermission[]; organizationProfiles: OrganizationProfile[] }> => {
    try {
      const allConfigs = await appwrite.listGlobalConfigs(databaseId);
      const userRightsList: UserPermission[] = [];
      const organizationProfiles: OrganizationProfile[] = [];
      for (const doc of allConfigs) {
        try {
          const parsed = JSON.parse(doc.data);
          if (doc.key.startsWith('usr_')) {
            userRightsList.push(parsed);
          } else if (doc.key.startsWith('prf_')) {
            organizationProfiles.push(parsed);
          }
        } catch (e) {
          console.warn(`Failed to parse global config doc ${doc.$id}:`, e);
        }
      }
      return { userRightsList, organizationProfiles };
    } catch (e) {
      console.warn("Could not fetch global configs:", e);
      return { userRightsList: [], organizationProfiles: [] };
    }
  };

  const migrateLocalDataToOrg = (newOrgId: string) => {
    if (!newOrgId || newOrgId === 'org_default' || newOrgId === 'org_backend') return;
    console.info(`Migrating local offline records from org_default to ${newOrgId}...`);

    let changed = false;

    // Migrate trucks
    const localTrucks = localStorage.getItem('ttt_trucks');
    if (localTrucks) {
      const list = JSON.parse(localTrucks);
      if (list.some((item: any) => item.organizationId === 'org_default')) {
        const updated = list.map((item: any) => item.organizationId === 'org_default' ? { ...item, organizationId: newOrgId } : item);
        localStorage.setItem('ttt_trucks', JSON.stringify(updated));
        setTrucks(updated);
        changed = true;
      }
    }

    // Migrate drivers
    const localDrivers = localStorage.getItem('ttt_drivers');
    if (localDrivers) {
      const list = JSON.parse(localDrivers);
      if (list.some((item: any) => item.organizationId === 'org_default')) {
        const updated = list.map((item: any) => item.organizationId === 'org_default' ? { ...item, organizationId: newOrgId } : item);
        localStorage.setItem('ttt_drivers', JSON.stringify(updated));
        setDrivers(updated);
        changed = true;
      }
    }

    // Migrate offices
    const localOffices = localStorage.getItem('ttt_offices');
    if (localOffices) {
      const list = JSON.parse(localOffices);
      if (list.some((item: any) => item.organizationId === 'org_default')) {
        const updated = list.map((item: any) => item.organizationId === 'org_default' ? { ...item, organizationId: newOrgId } : item);
        localStorage.setItem('ttt_offices', JSON.stringify(updated));
        setOffices(updated);
        changed = true;
      }
    }

    // Migrate accounts
    const localAccounts = localStorage.getItem('ttt_accounts');
    if (localAccounts) {
      const list = JSON.parse(localAccounts);
      if (list.some((item: any) => item.organizationId === 'org_default')) {
        const updated = list.map((item: any) => item.organizationId === 'org_default' ? { ...item, organizationId: newOrgId } : item);
        localStorage.setItem('ttt_accounts', JSON.stringify(updated));
        setAccounts(updated);
        changed = true;
      }
    }

    // Migrate trips
    const localTrips = localStorage.getItem('ttt_trips');
    if (localTrips) {
      const list = JSON.parse(localTrips);
      if (list.some((item: any) => item.organizationId === 'org_default')) {
        const updated = list.map((item: any) => item.organizationId === 'org_default' ? { ...item, organizationId: newOrgId } : item);
        localStorage.setItem('ttt_trips', JSON.stringify(updated));
        setTrips(updated);
        changed = true;
      }
    }

    // Migrate expenses
    const localExpenses = localStorage.getItem('ttt_expenses');
    if (localExpenses) {
      const list = JSON.parse(localExpenses);
      if (list.some((item: any) => item.organizationId === 'org_default')) {
        const updated = list.map((item: any) => item.organizationId === 'org_default' ? { ...item, organizationId: newOrgId } : item);
        localStorage.setItem('ttt_expenses', JSON.stringify(updated));
        setExpenses(updated);
        changed = true;
      }
    }

    // Migrate tyres
    const localTyres = localStorage.getItem('ttt_tyres');
    if (localTyres) {
      const list = JSON.parse(localTyres);
      if (list.some((item: any) => item.organizationId === 'org_default')) {
        const updated = list.map((item: any) => item.organizationId === 'org_default' ? { ...item, organizationId: newOrgId } : item);
        localStorage.setItem('ttt_tyres', JSON.stringify(updated));
        setTyres(updated);
        changed = true;
      }
    }

    // Migrate audit logs
    const localLogs = localStorage.getItem('fleet_audit_logs');
    if (localLogs) {
      const list = JSON.parse(localLogs);
      if (list.some((item: any) => item.organizationId === 'org_default')) {
        const updated = list.map((item: any) => item.organizationId === 'org_default' ? { ...item, organizationId: newOrgId } : item);
        localStorage.setItem('fleet_audit_logs', JSON.stringify(updated));
        setAuditLogs(updated);
        changed = true;
      }
    }

    if (changed) {
      touchLastModified();
    }
  };

  const reconcileSession = async (user: any) => {
    if (!user) {
      setCurrentUser(null);
      return;
    }
    setCurrentUser(user);

    try {
      let activeRightsList = userRightsList;

      // 1. Pull userRightsList and organizationProfiles from flat global_configs
      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const data = await fetchAllGlobalConfigs(databaseId);
          let rawProfiles = organizationProfiles;
          if (data && data.organizationProfiles && Array.isArray(data.organizationProfiles)) {
            rawProfiles = data.organizationProfiles;
          }

          if (data && data.userRightsList && data.userRightsList.length > 0) {
            let cloudRights: UserPermission[] = migrateUserPermissions(data.userRightsList);
            const localStored = localStorage.getItem('ttt_user_rights');
            let localRights: UserPermission[] = localStored ? migrateUserPermissions(JSON.parse(localStored)) : userRightsList;
            
            // Filter out user permissions for which the corresponding organization profile does not exist
            const existingOrgIds = new Set(rawProfiles.map(p => p.organizationId));
            const email = (user.email || '').toLowerCase().trim();
            const myCloudRights = cloudRights.find(ur => ur.email.toLowerCase().trim() === email);
            const isSuper = myCloudRights?.role === 'SuperAdmin' || myCloudRights?.organizationId === 'org_backend';

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

            // Asynchronously delete orphaned user rights from Appwrite DB if current user is Super Admin
            if (isSuper && orphanedCloudKeys.length > 0) {
              console.info("Super Admin cleaning up orphaned user permissions from DB:", orphanedCloudKeys);
              for (const key of orphanedCloudKeys) {
                appwrite.deleteGlobalConfig(databaseId, key).catch(err => {
                  console.warn("Failed to delete orphaned user permission:", key, err);
                });
              }
            }

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
            // Only keep Super Admin / Backend team members to avoid accidental lockout.
            // Standard organization accounts/members that were deleted from the database should be deleted locally too.
            const preservedLocalOnlyEntries = localOnlyEntries.filter(lr => {
              return lr.role === 'SuperAdmin' || lr.organizationId === 'org_backend';
            });
            activeRightsList = [...merged, ...preservedLocalOnlyEntries];
            setUserRightsList(activeRightsList);
            localStorage.setItem('ttt_user_rights', JSON.stringify(activeRightsList));
          } else {
            // Fresh/empty cloud database - clear active permissions
            // Safety: if the current user has local Super Admin / org_backend permissions, preserve them so they are not locked out
            const email = (user.email || '').toLowerCase().trim();
            const localStored = localStorage.getItem('ttt_user_rights');
            let localRights: UserPermission[] = localStored ? migrateUserPermissions(JSON.parse(localStored)) : userRightsList;
            const myLocalMatch = localRights.find(ur => ur.email.toLowerCase() === email && (ur.role === 'SuperAdmin' || ur.organizationId === 'org_backend'));

            if (myLocalMatch) {
              console.info("Preserving local Super Admin on fresh/empty cloud database:", email);
              activeRightsList = [myLocalMatch];
              setUserRightsList(activeRightsList);
              localStorage.setItem('ttt_user_rights', JSON.stringify(activeRightsList));
            } else {
              activeRightsList = [];
              setUserRightsList([]);
              localStorage.setItem('ttt_user_rights', JSON.stringify([]));
            }
            rawProfiles = [];
            setOrganizationProfiles([]);
            localStorage.setItem('ttt_organization_profiles', JSON.stringify([]));
          }
          const reconciled = reconcileOrganizationProfiles(activeRightsList, rawProfiles);
          setOrganizationProfiles(reconciled);
          localStorage.setItem('ttt_organization_profiles', JSON.stringify(reconciled));
        } catch (cloudErr) {
          console.warn('Initial cloud sync fetch skipped/offline during reconciliation:', cloudErr);
        }
      }

      if (activeRightsList.length === 0) {
        try {
          const stored = localStorage.getItem('ttt_user_rights');
          if (stored) {
            activeRightsList = migrateUserPermissions(JSON.parse(stored));
            setUserRightsList(activeRightsList);
          }
        } catch (e) { }
      }

      const localProfilesStr = localStorage.getItem('ttt_organization_profiles');
      let localProfiles = localProfilesStr ? JSON.parse(localProfilesStr) : organizationProfiles;
      let reconciled = reconcileOrganizationProfiles(activeRightsList, localProfiles);

      const email = (user.email || '').toLowerCase().trim();
      const myRights = activeRightsList.find(ur => ur.email.toLowerCase().trim() === email);
      if (myRights) {
        const isSuper = myRights.role === 'SuperAdmin' || myRights.organizationId === 'org_backend';
        if (!isSuper) {
          // Filter user rights list to only contain current org users
          activeRightsList = activeRightsList.filter(ur => ur.organizationId === myRights.organizationId || ur.email.toLowerCase().trim() === email);
          setUserRightsList(activeRightsList);
          localStorage.setItem('ttt_user_rights', JSON.stringify(activeRightsList));

          // Filter organization profiles to only contain current org profile
          reconciled = reconciled.filter(p => p.organizationId === myRights.organizationId);
        }
      }

      setOrganizationProfiles(reconciled);
      localStorage.setItem('ttt_organization_profiles', JSON.stringify(reconciled));

      let match = activeRightsList.find(ur => ur.email.toLowerCase().trim() === email);

      // ── Appwrite Teams sync (RUN FIRST) ───────────────────────────────
      // Derive organizationId from the user's actual Appwrite team membership.
      if (isAppwriteConfigured()) {
        try {
          const userTeams = await appwrite.getUserTeams();
          if (userTeams.length > 0) {
            const appwriteOrgId = userTeams[0].$id; // First team = their org
            migrateLocalDataToOrg(appwriteOrgId);

            const knownNames: { [orgId: string]: string } = {};
            for (const team of userTeams) {
              knownNames[team.$id] = team.name;
            }
            reconciled = reconcileOrganizationProfiles(activeRightsList, reconciled, knownNames);
            await saveOrganizationProfiles(reconciled);

            // Check if user is the Team Owner (Admin)
            let isAdminUser = false;
            try {
              const members = await appwrite.getTeamMemberships(appwriteOrgId);
              if (members && members.length > 0) {
                const myMembership = members.find(m => m.userEmail.toLowerCase().trim() === email);
                if (myMembership && myMembership.roles && myMembership.roles.includes('owner')) {
                  isAdminUser = true;
                }
              }
            } catch (membershipErr) {
              console.info('Not a team owner or unable to list memberships (normal member):', membershipErr);
            }

            if (match) {
              let needsUpdate = false;
              let updatedMatch = { ...match };

              // If the user is SuperAdmin, preserve their role and org_backend mapping. Do not force-reconcile to local team.
              if (match.role !== 'SuperAdmin' && match.organizationId !== appwriteOrgId) {
                console.info(`Reconciling org ID for ${email}: ${match.organizationId} → ${appwriteOrgId}`);
                updatedMatch.organizationId = appwriteOrgId;
                needsUpdate = true;
              }

              if (!match.isApproved) {
                console.info(`Reconciling approval for ${email}: false → true (member of Appwrite Team)`);
                updatedMatch.isApproved = true;
                needsUpdate = true;
              }

              if (user.name && match.name !== user.name) {
                console.info(`Reconciling name for ${email}: ${match.name} → ${user.name}`);
                updatedMatch.name = user.name;
                needsUpdate = true;
              }

              const isSuper = appwriteOrgId === 'org_backend' || match.role === 'SuperAdmin';
              const targetRole = isSuper ? 'SuperAdmin' : 'Admin';
              if (isAdminUser && match.role !== targetRole) {
                console.info(`Reconciling role for ${email}: ${match.role} → ${targetRole} (team owner)`);
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
                localStorage.setItem('ttt_user_rights', JSON.stringify(updatedList));
                activeRightsList = updatedList;
                match = updatedMatch;

                await pushPermissionsToCloud(updatedList);
              }
            } else {
              const isSuper = appwriteOrgId === 'org_backend';
              const targetRole = isSuper ? 'SuperAdmin' : (isAdminUser ? 'Admin' : 'Custom');
              console.info(`Auto-creating approved local permission record for team member ${email} (role: ${targetRole})`);
              const approvedPerm: UserPermission = {
                id: 'ur_' + Date.now(),
                email,
                name: user.name || email,
                role: targetRole as any,
                organizationId: appwriteOrgId,
                isApproved: true,
                canViewTrips: true, canEditTrips: isAdminUser || isSuper, canDeleteTrips: isAdminUser || isSuper,
                canViewTyres: true, canEditTyres: isAdminUser || isSuper, canDeleteTyres: isAdminUser || isSuper,
                canViewTrucks: true, canEditTrucks: isAdminUser || isSuper, canDeleteTrucks: isAdminUser || isSuper,
                canViewDrivers: true, canEditDrivers: isAdminUser || isSuper, canDeleteDrivers: isAdminUser || isSuper,
                canViewOffices: true, canEditOffices: isAdminUser || isSuper, canDeleteOffices: isAdminUser || isSuper,
                canViewAccounts: true, canEditAccounts: isAdminUser || isSuper, canDeleteAccounts: isAdminUser || isSuper,
                canViewExpenses: true, canEditExpenses: isAdminUser || isSuper, canDeleteExpenses: isAdminUser || isSuper
              };
              const withApproved = [...activeRightsList, approvedPerm];
              setUserRightsList(withApproved);
              localStorage.setItem('ttt_user_rights', JSON.stringify(withApproved));
              activeRightsList = withApproved;
              match = approvedPerm;

              await pushPermissionsToCloud(withApproved);
            }
          }
        } catch (teamsErr) {
          console.warn('Teams sync skipped (non-fatal):', teamsErr);
        }
      }

      setCurrentUser(user);
    } catch (err) {
      console.warn('Appwrite user authentication verification bypassed/offline during reconciliation:', err);
    }
  };

  // Authentication check and cloud permission sync on startup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const loginMethod = localStorage.getItem('ttt_login_method');
        if (loginMethod === 'mock') {
          localStorage.removeItem('ttt_guest_user');
          localStorage.removeItem('ttt_login_method');
          setCurrentUser(null);
          setInitialPullDone(true);
        } else if (loginMethod === 'appwrite' && isAppwriteConfigured()) {
          const user = await appwrite.getCurrentUser();
          if (user) {
            await reconcileSession(user);
          } else {
            setCurrentUser(null);
            setInitialPullDone(true);
          }
        } else {
          setCurrentUser(null);
          setInitialPullDone(true);
        }
      } catch (err) {
        console.warn('Appwrite user authentication verification bypassed/offline:', err);
        setInitialPullDone(true);
      } finally {
        setLoadingUser(false);
      }
    };
    initAuth();
  }, []);




  const handleLogout = async () => {
    try {
      await appwrite.logout();
    } catch (err) {
      console.warn("Appwrite logout error:", err);
    }
    setCurrentUser(null);
    localStorage.clear();

    // Clear all cookies to avoid session conflicts
    try {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + window.location.hostname.split('.').slice(-2).join('.');
      }
    } catch (cookieErr) {
      console.warn("Error clearing cookies on logout:", cookieErr);
    }
    // Reset React state arrays
    setTrucks([]);
    setDrivers([]);
    setOffices([]);
    setAccounts([]);
    setTrips([]);
    setExpenses([]);
    setTyres([]);
    setAuditLogs([]);
    setUserRightsList([]);
    setOrganizationProfiles([]);
    showNotification('Logged out successfully.');
  };



  const checkUserApproval = (email: string): { approved: boolean; orgId: string; registered: boolean } => {
    const match = userRightsList.find(ur => ur.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (match) {
      return { approved: match.isApproved, orgId: match.organizationId, registered: true };
    }
    return { approved: false, orgId: '', registered: false };
  };

  async function pushPermissionsToCloud(nextUserRights: UserPermission[]) {
    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const userRights = getCurrentUserRights();
        const loggedInEmail = (currentUser?.email || '').toLowerCase().trim();
        const isNotLoggedIn = !currentUser;

        for (const ur of nextUserRights) {
          // Rule: Only push the user permission to cloud if:
          // 1. We are not logged in yet (e.g. initial setup or registration path)
          // 2. The logged-in user is a Super Admin
          // 3. The permission belongs to the logged-in user's own organization
          // 4. The permission belongs to the logged-in user themselves (self update)
          const isOwnOrg = ur.organizationId && ur.organizationId === userRights.organizationId;
          const isSelf = ur.email.toLowerCase().trim() === loggedInEmail;

          if (!isNotLoggedIn && !userRights.isSuperAdmin && !isOwnOrg && !isSelf) {
            continue;
          }

          const docId = appwrite.getEmailDocId(ur.email);
          await appwrite.saveGlobalConfig(databaseId, docId, ur);
        }

        console.log('Successfully synced registration user permissions to Appwrite Database.');
      } catch (e: any) {
        console.warn("Could not sync registration user permissions to database:", e);
        showNotification(`Database Sync Alert: Failed to write permissions. Make sure database schemas are bootstrapped.`);
      }
    }
  }

  const handleRegisterUserPermissions = async (name: string, email: string, orgId: string, orgName?: string, dryRun = false): Promise<{ approved: boolean; orgId: string; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOrgId = orgId.trim();
    const trimmedOrgName = (orgName || '').trim();

    // 1. Pull the absolute latest cloud configs first to ensure we merge and do not overwrite existing users/orgs.
    let activeRights = userRightsList;
    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const data = await fetchAllGlobalConfigs(databaseId);
        if (data && data.userRightsList && Array.isArray(data.userRightsList)) {
          const cloudRights = migrateUserPermissions(data.userRightsList);
          setUserRightsList(cloudRights);
          localStorage.setItem('ttt_user_rights', JSON.stringify(cloudRights));
          activeRights = cloudRights;
        } else {
          // Fresh/empty cloud database - clear active permissions
          setUserRightsList([]);
          localStorage.setItem('ttt_user_rights', JSON.stringify([]));
          activeRights = [];
        }
      } catch (e) {
        console.warn("Could not load latest cloud snapshot during registration validation/init:", e);
      }
    }

    // 1b. Check duplicate email to prevent creating multiple organizations under the same email
    const existingMatch = activeRights.find(ur => ur.email.toLowerCase().trim() === trimmedEmail);
    if (existingMatch && existingMatch.organizationId && existingMatch.organizationId !== 'org_default') {
      return {
        approved: false,
        orgId: '',
        error: `Email address "${email}" is already associated with organization "${existingMatch.organizationId}". Please log in instead.`
      };
    }

    let targetOrgId = trimmedOrgId;

    if (trimmedOrgName.toLowerCase() === 'org_backend') {
      targetOrgId = 'org_backend';
    } else if (trimmedOrgId === 'JOIN_REQUEST') {
      let activeProfiles = organizationProfiles;
      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const data = await fetchAllGlobalConfigs(databaseId);
          if (data && data.organizationProfiles && Array.isArray(data.organizationProfiles)) {
            activeProfiles = data.organizationProfiles;
          }
        } catch (e) {
          console.warn("Could not load latest profiles during join match:", e);
        }
      }

      const matchedProfile = activeProfiles.find(p => p.organizationName.toLowerCase().trim() === trimmedOrgName.toLowerCase());
      if (!matchedProfile) {
        return { approved: false, orgId: '', error: `No organization named "${trimmedOrgName}" was found. Please check spelling or contact Admin.` };
      }
      targetOrgId = matchedProfile.organizationId;
    } else if (trimmedOrgId === '') {
      let activeProfiles = organizationProfiles;
      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const data = await fetchAllGlobalConfigs(databaseId);
          if (data && data.organizationProfiles && Array.isArray(data.organizationProfiles)) {
            activeProfiles = data.organizationProfiles;
          }
        } catch (e) {
          console.warn("Could not load latest profiles during creation match:", e);
        }
      }

      const nameExists = activeProfiles.some(p => p.organizationName.toLowerCase().trim() === trimmedOrgName.toLowerCase());
      if (nameExists) {
        return { approved: false, orgId: '', error: `Organization name "${trimmedOrgName}" is already registered. Please choose a different unique name.` };
      }
    }

    if (targetOrgId) {
      const isBackendOrg = targetOrgId === 'org_backend';
      const backendOrgHasUsers = activeRights.some(ur => ur.organizationId === 'org_backend');
      const orgIsValid = activeRights.some(ur => ur.organizationId === targetOrgId)
        || targetOrgId === 'org_default'
        || isBackendOrg;

      if (!orgIsValid) {
        return { approved: false, orgId: '', error: 'The specified Organization does not exist. Please check and try again.' };
      }

      const isApproved = isBackendOrg ? !backendOrgHasUsers : false;
      const targetRole = isBackendOrg ? 'SuperAdmin' : 'Custom';

      if (dryRun) {
        return {
          approved: isApproved,
          orgId: targetOrgId
        };
      }

      if (isBackendOrg && isAppwriteConfigured()) {
        try {
          const exists = await appwrite.getTeam('org_backend');
          if (!exists) {
            await appwrite.createTeam('Backend support team', 'org_backend');
            console.info("Successfully created org_backend team in Appwrite.");
          }
        } catch (err) {
          console.warn("Error checking or creating org_backend team in Appwrite:", err);
        }
      }

      const newPerm: UserPermission = {
        id: 'ur_' + Date.now(),
        email: trimmedEmail,
        name: name.trim(),
        role: targetRole as any,
        organizationId: targetOrgId,
        isApproved: isApproved,
        canViewTrips: isBackendOrg, canEditTrips: isBackendOrg, canDeleteTrips: isBackendOrg,
        canViewTyres: isBackendOrg, canEditTyres: isBackendOrg, canDeleteTyres: isBackendOrg,
        canViewTrucks: isBackendOrg, canEditTrucks: isBackendOrg, canDeleteTrucks: isBackendOrg,
        canViewDrivers: isBackendOrg, canEditDrivers: isBackendOrg, canDeleteDrivers: isBackendOrg,
        canViewOffices: isBackendOrg, canEditOffices: isBackendOrg, canDeleteOffices: isBackendOrg,
        canViewAccounts: isBackendOrg, canEditAccounts: isBackendOrg, canDeleteAccounts: isBackendOrg,
        canViewExpenses: isBackendOrg, canEditExpenses: isBackendOrg, canDeleteExpenses: isBackendOrg
      };
      const updatedList = activeRights.some(ur => ur.email.toLowerCase().trim() === trimmedEmail)
        ? activeRights.map(ur => ur.email.toLowerCase().trim() === trimmedEmail ? newPerm : ur)
        : [...activeRights, newPerm];
      saveUserRightsList(updatedList);

      const reconciled = reconcileOrganizationProfiles(
        updatedList,
        organizationProfiles,
        trimmedOrgName && targetOrgId ? { [targetOrgId]: trimmedOrgName } : {}
      );
      await saveOrganizationProfiles(reconciled);

      await pushPermissionsToCloud(updatedList);
      return { approved: isApproved, orgId: targetOrgId };
    } else {
      let finalOrgId = '';
      const cleanSlug = trimmedOrgName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const uniqueSuffix = Math.random().toString(36).substring(2, 6);
      const localSlug = `org_${cleanSlug || 'company'}_${uniqueSuffix}`;

      if (dryRun) {
        return { approved: true, orgId: '' };
      }

      if (isAppwriteConfigured()) {
        try {
          const teamId = await appwrite.createTeam(trimmedOrgName);
          if (teamId) {
            finalOrgId = teamId;
            console.info(`Created Appwrite Team "${trimmedOrgName}" with ID: ${teamId}`);
          } else {
            return {
              approved: false,
              orgId: '',
              error: 'Failed to create your organization team in Appwrite. Please verify your connection.'
            };
          }
        } catch (e: any) {
          console.error('Appwrite createTeam failed:', e);
          return {
            approved: false,
            orgId: '',
            error: `Failed to create Organization Team in Appwrite: ${e.message || e}`
          };
        }
      } else {
        finalOrgId = localSlug;
      }

      const newPerm: UserPermission = {
        id: 'ur_' + Date.now(),
        email: trimmedEmail,
        name: name.trim(),
        role: 'Admin',
        organizationId: finalOrgId,
        isApproved: true,
        canViewTrips: true, canEditTrips: true, canDeleteTrips: true,
        canViewTyres: true, canEditTyres: true, canDeleteTyres: true,
        canViewTrucks: true, canEditTrucks: true, canDeleteTrucks: true,
        canViewDrivers: true, canEditDrivers: true, canDeleteDrivers: true,
        canViewOffices: true, canEditOffices: true, canDeleteOffices: true,
        canViewAccounts: true, canEditAccounts: true, canDeleteAccounts: true,
        canViewExpenses: true, canEditExpenses: true, canDeleteExpenses: true
      };
      const updatedList = activeRights.some(ur => ur.email.toLowerCase().trim() === trimmedEmail)
        ? activeRights.map(ur => ur.email.toLowerCase().trim() === trimmedEmail ? newPerm : ur)
        : [...activeRights, newPerm];
      saveUserRightsList(updatedList);

      const reconciled = reconcileOrganizationProfiles(
        updatedList,
        organizationProfiles,
        { [finalOrgId]: trimmedOrgName }
      );
      await saveOrganizationProfiles(reconciled);

      const newOrgProfile = reconciled.find(p => p.organizationId === finalOrgId);
      if (newOrgProfile && isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const docId = appwrite.getOrgDocId(finalOrgId);
          await appwrite.saveGlobalConfig(databaseId, docId, newOrgProfile);
          console.log('Directly saved new organization profile to Appwrite:', finalOrgId);
        } catch (e) {
          console.warn("Could not save new organization profile directly to Appwrite:", e);
        }
      }

      await pushPermissionsToCloud(updatedList);
      return { approved: true, orgId: finalOrgId };
    }
  };

  const handleRequestToJoinOrganization = async (newOrgId: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'No active session found.' };
    const trimmedOrgId = newOrgId.trim();
    const email = (currentUser.email || '').toLowerCase().trim();

    if (!trimmedOrgId) {
      return { success: false, error: 'Please enter a valid Organization ID.' };
    }

    let activeRights = userRightsList;
    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const data = await fetchAllGlobalConfigs(databaseId);
        if (data && data.userRightsList && Array.isArray(data.userRightsList)) {
          const cloudRights = migrateUserPermissions(data.userRightsList);
          setUserRightsList(cloudRights);
          localStorage.setItem('ttt_user_rights', JSON.stringify(cloudRights));
          activeRights = cloudRights;
        }
      } catch (e) {
        console.warn("Could not load latest cloud snapshot during organization change:", e);
      }
    }

    const isBackendOrg = trimmedOrgId === 'org_backend';
    const backendOrgHasUsers = activeRights.some(ur => ur.organizationId === 'org_backend');
    const orgIsValid = activeRights.some(ur => ur.organizationId === trimmedOrgId)
      || trimmedOrgId === 'org_default'
      || isBackendOrg;

    if (!orgIsValid) {
      return { success: false, error: 'The specified Organization ID does not exist. Please check and try again.' };
    }

    let updatedList: UserPermission[] = [];
    const existingMatch = activeRights.find(ur => ur.email.toLowerCase().trim() === email);

    const isApproved = isBackendOrg ? !backendOrgHasUsers : false;
    const targetRole = isBackendOrg ? 'SuperAdmin' : 'Custom';

    if (existingMatch) {
      if (existingMatch.organizationId && existingMatch.organizationId !== trimmedOrgId && isAppwriteConfigured()) {
        try {
          console.info(`User leaving old Appwrite team: ${existingMatch.organizationId}`);
          await appwrite.leaveTeam(existingMatch.organizationId);
        } catch (leaveErr) {
          console.warn("Failed to automatically leave old Appwrite team:", leaveErr);
        }
      }

      const updatedMatch: UserPermission = {
        ...existingMatch,
        organizationId: trimmedOrgId,
        isApproved: isApproved,
        role: targetRole as any,
        canViewTrips: isBackendOrg, canEditTrips: isBackendOrg, canDeleteTrips: isBackendOrg,
        canViewTyres: isBackendOrg, canEditTyres: isBackendOrg, canDeleteTyres: isBackendOrg,
        canViewTrucks: isBackendOrg, canEditTrucks: isBackendOrg, canDeleteTrucks: isBackendOrg,
        canViewDrivers: isBackendOrg, canEditDrivers: isBackendOrg, canDeleteDrivers: isBackendOrg,
        canViewOffices: isBackendOrg, canEditOffices: isBackendOrg, canDeleteOffices: isBackendOrg,
        canViewAccounts: isBackendOrg, canEditAccounts: isBackendOrg, canDeleteAccounts: isBackendOrg,
        canViewExpenses: isBackendOrg, canEditExpenses: isBackendOrg, canDeleteExpenses: isBackendOrg
      };
      updatedList = activeRights.map(ur =>
        ur.email.toLowerCase().trim() === email ? updatedMatch : ur
      );
    } else {
      const newPerm: UserPermission = {
        id: 'ur_' + Date.now(),
        email,
        name: currentUser.name || email,
        role: targetRole as any,
        organizationId: trimmedOrgId,
        isApproved: isApproved,
        canViewTrips: isBackendOrg, canEditTrips: isBackendOrg, canDeleteTrips: isBackendOrg,
        canViewTyres: isBackendOrg, canEditTyres: isBackendOrg, canDeleteTyres: isBackendOrg,
        canViewTrucks: isBackendOrg, canEditTrucks: isBackendOrg, canDeleteTrucks: isBackendOrg,
        canViewDrivers: isBackendOrg, canEditDrivers: isBackendOrg, canDeleteDrivers: isBackendOrg,
        canViewOffices: isBackendOrg, canEditOffices: isBackendOrg, canDeleteOffices: isBackendOrg,
        canViewAccounts: isBackendOrg, canEditAccounts: isBackendOrg, canDeleteAccounts: isBackendOrg,
        canViewExpenses: isBackendOrg, canEditExpenses: isBackendOrg, canDeleteExpenses: isBackendOrg
      };
      updatedList = [...activeRights, newPerm];
    }

    saveUserRightsList(updatedList);

    const reconciled = reconcileOrganizationProfiles(updatedList, organizationProfiles);
    await saveOrganizationProfiles(reconciled);

    await pushPermissionsToCloud(updatedList);

    // Refresh local rights state
    await reconcileSession(currentUser);
    return { success: true };
  };

  const handleUpdateProfile = async (newName: string, newOrgName?: string, newPassword?: string, oldPassword?: string) => {
    try {
      const loginMethod = localStorage.getItem('ttt_login_method');
      if (loginMethod === 'appwrite') {
        if (newName.trim() && newName.trim() !== currentUser?.name) {
          await appwrite.updateName(newName.trim());
        }
        if (newPassword && oldPassword) {
          await appwrite.updatePassword(newPassword, oldPassword);
        }
      }

      // Update local representation
      const updatedUser = {
        ...currentUser,
        name: newName.trim()
      };
      setCurrentUser(updatedUser);

      // Update name in userRightsList so it reflects everywhere
      const email = (currentUser?.email || '').toLowerCase().trim();
      const updatedRightsList = userRightsList.map(ur =>
        ur.email.toLowerCase().trim() === email
          ? { ...ur, name: newName.trim() }
          : ur
      );
      saveUserRightsList(updatedRightsList);

      if (isAppwriteConfigured()) {
        await pushPermissionsToCloud(updatedRightsList);
      }

      // Update organization name if modified and user is Admin
      const currentOrgId = currentUserRights?.organizationId || '';
      if (currentUserRights.isAdmin && newOrgName && newOrgName.trim() && currentOrgId) {
        const nextProfiles = organizationProfiles.map(p =>
          p.organizationId === currentOrgId
            ? { ...p, organizationName: newOrgName.trim() }
            : p
        );
        await saveOrganizationProfiles(nextProfiles);
      }

      // Save voice language settings
      if (currentUser) {
        const userEmail = (currentUser.email || '').toLowerCase().trim();
        localStorage.setItem(`ttt_voice_lang_${userEmail}`, profileVoiceLang);
        setUserVoiceLang(profileVoiceLang);
      }

      showNotification("Profile updated successfully!");
      setProfileModalOpen(false);
    } catch (err: any) {
      alert(`Error updating profile: ${err.message || 'Operation failed'}`);
    }
  };

  const handleUpdateOrgProfile = async (updatedProfile: OrganizationProfile) => {
    const nextProfiles = organizationProfiles.map(p =>
      p.organizationId === updatedProfile.organizationId ? updatedProfile : p
    );
    await saveOrganizationProfiles(nextProfiles);
  };

  const currentUserOrgId = currentUserRights?.organizationId || '';
  const hasUsersTabAccess = currentUserOrgId === 'org_backend' ? !!currentUserRights.canViewBackendTeam : !!currentUserRights.isAdmin;



  // Navigation / Tabs State
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'TRIPS' | 'TRUCKS' | 'OFFICES' | 'ACCOUNTS' | 'DRIVERS' | 'EXPENSES' | 'REPORTS' | 'AUDIT' | 'TYRES' | 'USERS' | 'BACKEND'>('DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const selectTab = (tab: 'DASHBOARD' | 'TRIPS' | 'TRUCKS' | 'OFFICES' | 'ACCOUNTS' | 'DRIVERS' | 'EXPENSES' | 'REPORTS' | 'AUDIT' | 'TYRES' | 'USERS' | 'BACKEND') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  // Live Appwrite team membership list (fetched when admin opens USERS tab)
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);

  // Fetch live Appwrite memberships whenever admin opens the USERS panel
  useEffect(() => {
    if (activeTab === 'USERS' && hasUsersTabAccess && currentUserOrgId && isAppwriteConfigured()) {
      setLoadingTeamMembers(true);
      appwrite.getTeamMemberships(currentUserOrgId)
        .then(members => setTeamMembers(members))
        .catch(err => console.warn('Could not fetch team memberships:', err))
        .finally(() => setLoadingTeamMembers(false));
    }
  }, [activeTab, currentUserOrgId, hasUsersTabAccess]);

  // Redirect non-admin/unauthorized users away from restricted tabs
  useEffect(() => {
    const fallbackTab = currentUserRights.isSuperAdmin ? 'BACKEND' : 'DASHBOARD';
    if (activeTab === 'USERS' && !hasUsersTabAccess) {
      setActiveTab(fallbackTab);
    } else if (activeTab === 'BACKEND' && !currentUserRights.isSuperAdmin) {
      setActiveTab(fallbackTab);
    } else if (activeTab === 'DASHBOARD' && currentUserRights.isSuperAdmin) {
      setActiveTab(fallbackTab);
    } else if (activeTab === 'TRIPS' && !currentUserRights.canViewTrips) {
      setActiveTab(fallbackTab);
    } else if (activeTab === 'TRUCKS' && !currentUserRights.canViewTrucks) {
      setActiveTab(fallbackTab);
    } else if (activeTab === 'OFFICES' && !currentUserRights.canViewOffices) {
      setActiveTab(fallbackTab);
    } else if (activeTab === 'ACCOUNTS' && !currentUserRights.canViewAccounts) {
      setActiveTab(fallbackTab);
    } else if (activeTab === 'DRIVERS' && !currentUserRights.canViewDrivers) {
      setActiveTab(fallbackTab);
    } else if (activeTab === 'EXPENSES' && !currentUserRights.canViewExpenses) {
      setActiveTab(fallbackTab);
    } else if (activeTab === 'REPORTS' && !currentUserRights.canViewTrips) {
      setActiveTab(fallbackTab);
    } else if (activeTab === 'AUDIT' && !currentUserRights.isAdmin) {
      setActiveTab(fallbackTab);
    } else if (activeTab === 'TYRES' && !currentUserRights.canViewTyres) {
      setActiveTab(fallbackTab);
    }
  }, [activeTab, currentUserRights]);
  // Custom hooks managing operational states
  const { auditLogs, setAuditLogs, logAction, handleClearAuditLogs } = useAuditLogs({
    currentUser,
    currentUserOrgId,
    showNotification
  });
  const saveAuditLogs = setAuditLogs;

  const { trips, setTrips, orgTrips, saveTrips, postTripEntry, deleteTripEntry } = useTrips({
    orgId: currentUserOrgId,
    showNotification,
    logAction,
    loadDashboardData,
    activeMonth,
    activeYear
  });

  const { accounts, setAccounts, orgAccounts, saveAccounts, addAccount, updateAccount, deleteAccount } = useAccounts({
    orgId: currentUserOrgId,
    trips,
    showNotification,
    logAction
  });

  const { drivers, setDrivers, orgDrivers, saveDrivers, addDriver, updateDriver, deleteDriver } = useDrivers({
    orgId: currentUserOrgId,
    trips,
    showNotification,
    logAction
  });

  const { offices, setOffices, orgOffices, saveOffices, addOffice, updateOffice, deleteOffice } = useOffices({
    orgId: currentUserOrgId,
    trips,
    showNotification,
    logAction
  });

  const { expenses, setExpenses, orgExpenses, saveExpenses, addExpense, updateExpense, deleteExpense } = useExpenses({
    orgId: currentUserOrgId,
    showNotification,
    logAction,
    loadDashboardData,
    activeMonth,
    activeYear
  });

  const { tyres, setTyres, orgTyres, saveTyres, addTyre, updateTyre, deleteTyre } = useTyres({
    orgId: currentUserOrgId,
    expenses,
    saveExpenses,
    showNotification,
    logAction,
    loadDashboardData,
    activeMonth,
    activeYear
  });

  const { trucks, setTrucks, orgTrucks, saveTrucks, addTruck, updateTruck, deleteTruck } = useTrucks({
    orgId: currentUserOrgId,
    trips,
    organizationProfiles,
    saveOrganizationProfiles,
    showNotification,
    logAction,
    pushFleetSnapshotNow
  });
  const [dashboardTrips, setDashboardTrips] = useState<TripEntry[]>([]);
  const [dashboardExpenses, setDashboardExpenses] = useState<ExpenseEntry[]>([]);

  async function loadDashboardData(month: string, year: string) {
    if (!isAppwriteConfigured()) {
      const localTrips = JSON.parse(localStorage.getItem('ttt_trips') || '[]');
      const localExpenses = JSON.parse(localStorage.getItem('ttt_expenses') || '[]');

      const filteredTrips = year === 'All Time'
        ? localTrips
        : localTrips.filter((t: any) => t.startDate && t.startDate.startsWith(`${year}-${month}`));
      const filteredExpenses = year === 'All Time'
        ? localExpenses
        : localExpenses.filter((e: any) => e.date && e.date.startsWith(`${year}-${month}`) && e.status !== 'Declined');

      setDashboardTrips(filteredTrips);
      setDashboardExpenses(filteredExpenses);
      return;
    }

    try {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      const orgId = currentUserOrgId || 'org_default';
      const { trips: parsedTrips, expenses: parsedExpenses } = await appwrite.fetchMonthlyTripsAndExpenses(databaseId, orgId, year, month);

      const mappedTrips = parsedTrips.map(doc => JSON.parse(doc.data));
      const mappedExpenses = parsedExpenses.map(doc => JSON.parse(doc.data));

      setDashboardTrips(mappedTrips);
      setDashboardExpenses(mappedExpenses);
    } catch (err) {
      console.warn("Failed to load monthly dashboard data from Appwrite:", err);
    }
  }

  useEffect(() => {
    loadDashboardData(activeMonth, activeYear);
  }, [activeMonth, activeYear, currentUserOrgId, trips, expenses]);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const confirmAction = (message: string, onConfirm: () => void, title = 'Confirm Action') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      }
    });
  };







  // Form modal controller states
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripEntry | null>(null);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);

  // Listen for Alt+V shortcut to toggle Voice Assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setIsVoiceAssistantOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Notifications systems
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function touchLastModified() {
    localStorage.setItem('ttt_last_modified_at', Date.now().toString());
  }

  async function pushFleetSnapshotNow(overrideTrucks?: Truck[]) {
    touchLastModified();
  }



  useEffect(() => {
    if (trucks.length === 0) return;
    const todayStr = new Date().toISOString().split('T')[0];
    let needsUpdate = false;
    const updated = trucks.map(t => {
      if (t.status === 'Active' && t.registrationExpiryDate && t.registrationExpiryDate < todayStr) {
        needsUpdate = true;
        return { ...t, status: 'Inactive' as const };
      }
      return t;
    });
    if (needsUpdate) {
      console.info("Plan Expiry Check: Disabling active trucks with expired plans.");
      saveTrucks(updated);
    }
  }, [trucks]);

  const hasHealedRef = useRef(false);

  useEffect(() => {
    if (!initialPullDone || trips.length === 0 || hasHealedRef.current) return;
    hasHealedRef.current = true;

    let changed = false;
    const nextTrips = trips.map(t => {
      const originalCount = t.advances?.length || 0;
      const cleanedAdvances = (t.advances || []).filter(adv => {
        const isFwd = adv.id.startsWith('fwd_in_') || adv.id.startsWith('fwd_out_');
        if (!isFwd) return true;

        const isDest = adv.id.startsWith('fwd_in_');
        const targetTripNo = adv.notes
          ? adv.notes
              .replace('Negative balance carried forward from ', '')
              .replace('Negative balance carried forward to ', '')
              .trim()
          : '';

        if (!targetTripNo) return true;

        const targetTrip = trips.find(x => x.tripNo === targetTripNo);
        if (!targetTrip) {
          changed = true;
          return false;
        }

        const matchingNotes = isDest
          ? `Negative balance carried forward to ${t.tripNo}`
          : `Negative balance carried forward from ${t.tripNo}`;

        const hasMatching = (targetTrip.advances || []).some(x => {
          const isMatchingFwd = isDest ? x.id.startsWith('fwd_out_') : x.id.startsWith('fwd_in_');
          return isMatchingFwd && x.notes === matchingNotes;
        });

        if (!hasMatching) {
          changed = true;
          return false;
        }

        return true;
      });

      if (cleanedAdvances.length !== originalCount) {
        return { ...t, advances: cleanedAdvances };
      }
      return t;
    });

    if (changed) {
      console.info("Auto-healing broken carried-forward advances.");
      saveTrips(nextTrips);
    }
  }, [trips, initialPullDone]);



  const saveUserRightsListWithSync = (newList: UserPermission[]) => {
    saveUserRightsList(newList);
    pushPermissionsToCloud(newList);
  };

  const onLoadCloudState = (parsed: any, userRightsData?: any): boolean => {
    const orgId = currentUserOrgId || 'org_default';

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
    const email = (currentUser?.email || '').toLowerCase().trim();

    if (userRightsData && userRightsData.userRightsList && Array.isArray(userRightsData.userRightsList)) {
      const cloudRights = migrateUserPermissions(userRightsData.userRightsList);
      if (currentUserRights.isAdmin) {
        const localRightsOrg = userRightsList.filter(x => x.organizationId === orgId);
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
        const localOwn = userRightsList.find(x => x.email.toLowerCase().trim() === email);
        const cloudOwn = cloudRights.find(x => x.email.toLowerCase().trim() === email);
        if (JSON.stringify(localOwn) !== JSON.stringify(cloudOwn)) {
          userRightsChanged = true;
        }
      }
    }

    if (parsed.userRightsList && Array.isArray(parsed.userRightsList)) {
      const cloudRights = migrateUserPermissions(parsed.userRightsList);
      if (currentUserRights.isAdmin) {
        const localRightsOrg = userRightsList.filter(x => x.organizationId === orgId);
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
        const localOwn = userRightsList.find(x => x.email.toLowerCase().trim() === email);
        const cloudOwn = cloudRights.find(x => x.email.toLowerCase().trim() === email);
        if (JSON.stringify(localOwn) !== JSON.stringify(cloudOwn)) {
          userRightsChanged = true;
        }
      }
    }

    let hasRelevantChanges = false;
    if (currentUserRights.canViewTrips && hasOrgCategoryChanged(trips, parsed.trips)) hasRelevantChanges = true;
    if (currentUserRights.canViewTrucks && hasOrgCategoryChanged(trucks, parsed.trucks)) hasRelevantChanges = true;
    if (currentUserRights.canViewDrivers && hasOrgCategoryChanged(drivers, parsed.drivers)) hasRelevantChanges = true;
    if (currentUserRights.canViewOffices && hasOrgCategoryChanged(offices, parsed.offices)) hasRelevantChanges = true;
    if (currentUserRights.canViewAccounts && hasOrgCategoryChanged(accounts, parsed.accounts)) hasRelevantChanges = true;
    if (currentUserRights.canViewExpenses && hasOrgCategoryChanged(expenses, parsed.expenses)) hasRelevantChanges = true;
    if (currentUserRights.canViewTyres && hasOrgCategoryChanged(tyres, parsed.tyres)) hasRelevantChanges = true;
    if (currentUserRights.isAdmin && hasOrgCategoryChanged(auditLogs, parsed.auditLogs)) hasRelevantChanges = true;
    if (userRightsChanged) hasRelevantChanges = true;

    if (userRightsData) {
      const isSuper = currentUserRights?.isSuperAdmin || currentUserOrgId === 'org_backend';
      const email = (currentUser?.email || '').toLowerCase().trim();

      let cloudProfiles = userRightsData.organizationProfiles || [];
      let cloudRightsSource = userRightsData.userRightsList || [];

      if (!isSuper) {
        // Filter profiles to only contain our own organization
        cloudProfiles = cloudProfiles.filter((p: any) => p.organizationId === currentUserOrgId);
        
        // Filter cloud rights list to only contain our own organization or self
        cloudRightsSource = cloudRightsSource.filter((ur: any) => 
          ur.organizationId === currentUserOrgId || ur.email.toLowerCase().trim() === email
        );
      }

      const existingOrgIds = new Set(cloudProfiles.map((p: any) => p.organizationId));

      if (cloudRightsSource && Array.isArray(cloudRightsSource)) {
        let cloudRights = migrateUserPermissions(cloudRightsSource);
        const localStored = localStorage.getItem('ttt_user_rights');
        let localRights: UserPermission[] = localStored ? migrateUserPermissions(JSON.parse(localStored)) : userRightsList;
        
        // Identify orphaned user permissions in the cloud
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

        // Asynchronously delete orphaned user rights from Appwrite DB if current user is Super Admin
        if (isSuper && orphanedCloudKeys.length > 0) {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          console.info("Super Admin cleaning up orphaned user permissions from DB (onLoadCloudState):", orphanedCloudKeys);
          for (const key of orphanedCloudKeys) {
            appwrite.deleteGlobalConfig(databaseId, key).catch(err => {
              console.warn("Failed to delete orphaned user permission:", key, err);
            });
          }
        }

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
        // Only keep Super Admin / Backend team members to avoid accidental lockout.
        // Standard organization accounts/members that were deleted from the database should be deleted locally too.
        const preservedLocalOnlyEntries = localOnlyEntries.filter(lr => {
          return lr.role === 'SuperAdmin' || lr.organizationId === 'org_backend';
        });
        const activeRightsList = [...merged, ...preservedLocalOnlyEntries];
        setUserRightsList(activeRightsList);
        localStorage.setItem('ttt_user_rights', JSON.stringify(activeRightsList));
      }

      if (cloudProfiles && Array.isArray(cloudProfiles)) {
        const activeRights = cloudRightsSource && Array.isArray(cloudRightsSource)
          ? migrateUserPermissions(cloudRightsSource)
          : userRightsList;

        // Filter activeRights by existingOrgIds to avoid recreating profiles for deleted orgs
        const filteredActiveRights = activeRights.filter(ur => {
          if (!ur.organizationId || ur.organizationId === 'org_backend' || ur.organizationId === 'org_default') {
            return true;
          }
          return existingOrgIds.has(ur.organizationId);
        });

        const reconciled = reconcileOrganizationProfiles(
          filteredActiveRights,
          cloudProfiles
        );
        setOrganizationProfiles(reconciled);
        localStorage.setItem('ttt_organization_profiles', JSON.stringify(reconciled));
      }
    }

    if (parsed.trucks) {
      // Timestamp guard: only replace local trucks if the cloud snapshot is newer than our local state.
      // This prevents a stale cloud pull (triggered by e.g. user_rights_snapshot update from admin)
      // from re-adding a truck that was just deleted locally but whose push hasn't landed yet.
      const localLastModified = Number(localStorage.getItem('ttt_last_modified_at') || '0');
      const cloudExportDate = parsed.exportDate
        ? (isNaN(Number(parsed.exportDate)) ? new Date(parsed.exportDate).getTime() : Number(parsed.exportDate))
        : 0;
      // Allow a 4-second buffer for the debounce push window (push fires 3s after mutation)
      const localIsNewer = localLastModified > 0 && cloudExportDate > 0 && localLastModified > cloudExportDate + 4000;
      if (!localIsNewer) {
        const migrated = migrateTrucks(parsed.trucks);

        // Detect approval / rejection transitions for notification & audit logging
        migrated.forEach(cloudTruck => {
          const isRelevantOrg = orgId !== 'org_backend' && cloudTruck.organizationId === orgId;
          if (isRelevantOrg) {
            const localTruck = trucks.find(t =>
              t.organizationId === orgId &&
              t.truckNo.toUpperCase() === cloudTruck.truckNo.toUpperCase()
            );
            if (localTruck) {
              const wasPendingApproval = localTruck.isApproved === false || localTruck.requestStatus === 'Pending';

              if (wasPendingApproval && cloudTruck.isApproved === true) {
                // Approved transition!
                showNotification(`Truck ${cloudTruck.truckNo} has been approved by the Admin!`);
                logAction('Cloud', 'Truck', cloudTruck.truckNo, `Truck registration request approved by Admin. Expiry set to ${cloudTruck.registrationExpiryDate || 'None'}`, cloudTruck.organizationId);
              } else if (wasPendingApproval && cloudTruck.requestStatus === 'Rejected') {
                // Rejected transition!
                showNotification(`Truck ${cloudTruck.truckNo} request was rejected.`);
                logAction('Cloud', 'Truck', cloudTruck.truckNo, `Truck registration request rejected by Admin.`, cloudTruck.organizationId);
              }
            }
          }
        });

        setTrucks(prev => {
          const otherOrgs = orgId === 'org_backend' ? [] : prev.filter(t => t.organizationId !== orgId);
          const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(t => t.organizationId === orgId);
          // Sync directly from cloud snapshot — deleted vehicles are not re-added (matches Truck Requests behaviour)
          const next = [...otherOrgs, ...thisOrgPulled];
          localStorage.setItem('ttt_trucks', JSON.stringify(next));
          return next;
        });
        touchLastModified();
      } else {
        console.log(`Appwrite Cloud Sync: Skipping truck overwrite — local state is newer (local: ${localLastModified}, cloud: ${cloudExportDate})`);
      }
    }

    if (parsed.drivers) {
      const migrated = migrateDrivers(parsed.drivers);
      setDrivers(prev => {
        const otherOrgs = orgId === 'org_backend' ? [] : prev.filter(d => d.organizationId !== orgId);
        const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(d => d.organizationId === orgId);
        const next = [...otherOrgs, ...thisOrgPulled];
        localStorage.setItem('ttt_drivers', JSON.stringify(next));
        return next;
      });
      touchLastModified();
    }

    if (parsed.offices) {
      const migrated = migrateOffices(parsed.offices);
      setOffices(prev => {
        const otherOrgs = orgId === 'org_backend' ? [] : prev.filter(o => o.organizationId !== orgId);
        const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(o => o.organizationId === orgId);
        const next = [...otherOrgs, ...thisOrgPulled];
        localStorage.setItem('ttt_offices', JSON.stringify(next));
        return next;
      });
      touchLastModified();
    }

    if (parsed.accounts) {
      const migrated = migrateAccounts(parsed.accounts);
      setAccounts(prev => {
        const otherOrgs = orgId === 'org_backend' ? [] : prev.filter(a => a.organizationId !== orgId);
        const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(a => a.organizationId === orgId);
        const next = [...otherOrgs, ...thisOrgPulled];
        localStorage.setItem('ttt_accounts', JSON.stringify(next));
        return next;
      });
      touchLastModified();
    }

    if (parsed.trips) {
      const migrated = migrateTrips(migrateTripsIfNecessary(parsed.trips));
      setTrips(prev => {
        const otherOrgs = orgId === 'org_backend' ? [] : prev.filter(t => t.organizationId !== orgId);
        const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(t => t.organizationId === orgId);
        const next = [...otherOrgs, ...thisOrgPulled];
        localStorage.setItem('ttt_trips', JSON.stringify(next));
        return next;
      });
      touchLastModified();
    }

    if (parsed.expenses) {
      const migrated = migrateExpenses(parsed.expenses);
      setExpenses(prev => {
        const otherOrgs = orgId === 'org_backend' ? [] : prev.filter(e => e.organizationId !== orgId);
        const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(e => e.organizationId === orgId);
        const next = [...otherOrgs, ...thisOrgPulled];
        localStorage.setItem('ttt_expenses', JSON.stringify(next));
        return next;
      });
      touchLastModified();
    }

    if (parsed.tyres) {
      const migrated = migrateTyres(parsed.tyres);
      setTyres(prev => {
        const otherOrgs = orgId === 'org_backend' ? [] : prev.filter(ty => ty.organizationId !== orgId);
        const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(ty => ty.organizationId === orgId);
        const next = [...otherOrgs, ...thisOrgPulled];
        localStorage.setItem('ttt_tyres', JSON.stringify(next));
        return next;
      });
      touchLastModified();
    }

    if (parsed.auditLogs) {
      const migrated = migrateAuditLogs(parsed.auditLogs);
      setAuditLogs(prev => {
        const otherOrgs = orgId === 'org_backend' ? [] : prev.filter(l => l.organizationId !== orgId);
        const thisOrgPulled = orgId === 'org_backend' ? migrated : migrated.filter(l => l.organizationId === orgId);
        const next = [...otherOrgs, ...thisOrgPulled];
        localStorage.setItem('fleet_audit_logs', JSON.stringify(next));
        return next;
      });
      touchLastModified();
    }

    if (parsed.userRightsList) {
      saveUserRightsList(parsed.userRightsList);
    }

    return hasRelevantChanges;
  };



  function showNotification(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }

  const handleUpdateOrgStatus = async (orgId: string, status: 'Active' | 'Disabled') => {
    const nextProfiles = organizationProfiles.map(p =>
      p.organizationId === orgId ? { ...p, status } : p
    );
    await saveOrganizationProfiles(nextProfiles);
    showNotification(`Organization ${orgId} has been ${status === 'Active' ? 'enabled' : 'disabled'}.`);
    logAction('Edited', 'Organization', orgId, `Super Admin updated status to ${status}.`);
  };

  const handleUpdateOrgLimit = async (orgId: string, limit: number) => {
    const nextProfiles = organizationProfiles.map(p =>
      p.organizationId === orgId ? { ...p, maxTrucksAllowed: limit } : p
    );
    await saveOrganizationProfiles(nextProfiles);
    showNotification(`Truck registration limit for ${orgId} set to ${limit}.`);
    logAction('Edited', 'Organization', orgId, `Super Admin set max truck limit to ${limit}.`);
  };

  const handleApproveTruckRequest = async (orgId: string, requestId: string, truckNo: string, duration: '1M' | '3M' | '6M' | '1Y' = '1Y') => {
    const profile = organizationProfiles.find(p => p.organizationId === orgId);
    if (!profile) return;

    let requestItem = (profile.truckRequests || []).find(r => r.id === requestId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingTruck = trucks.find(t => t.organizationId === orgId && t.truckNo.toUpperCase() === truckNo.toUpperCase());

    let baseDate = new Date(today);

    let monthsToAdd = 12;
    if (duration === '1M') monthsToAdd = 1;
    else if (duration === '3M') monthsToAdd = 3;
    else if (duration === '6M') monthsToAdd = 6;

    const nextExpiry = new Date(baseDate);
    nextExpiry.setMonth(nextExpiry.getMonth() + monthsToAdd);

    const yyyy = nextExpiry.getFullYear();
    const mm = String(nextExpiry.getMonth() + 1).padStart(2, '0');
    const dd = String(nextExpiry.getDate()).padStart(2, '0');
    const expiryStr = `${yyyy}-${mm}-${dd}`;

    const wasAlreadyApproved = existingTruck && existingTruck.isApproved === true;

    const nextRequests = (profile.truckRequests || []).filter(r =>
      r.id !== requestId && r.truckNo.toUpperCase() !== truckNo.toUpperCase()
    );

    const nextProfiles = organizationProfiles.map(p =>
      p.organizationId === orgId
        ? {
          ...p,
          maxTrucksAllowed: wasAlreadyApproved ? p.maxTrucksAllowed : p.maxTrucksAllowed + 1,
          truckRequests: nextRequests
        }
        : p
    );

    await saveOrganizationProfiles(nextProfiles);

    setTrucks(prev => {
      const exists = prev.some(t => t.organizationId === orgId && t.truckNo.toUpperCase() === truckNo.toUpperCase());
      let next;
      if (exists) {
        next = prev.map(t =>
          (t.organizationId === orgId && t.truckNo.toUpperCase() === truckNo.toUpperCase())
            ? {
              ...t,
              isApproved: true,
              requestStatus: 'Approved' as const,
              status: 'Active' as const,
              registrationExpiryDate: expiryStr,
              currentKM: (t.currentKM !== undefined && t.currentKM !== null && t.currentKM !== 0) ? t.currentKM : (requestItem?.currentKM || 0)
            }
            : t
        );
      } else {
        const newTruck: Truck = {
          id: 'tr_' + Date.now(),
          truckNo: truckNo.toUpperCase(),
          organizationId: orgId,
          isApproved: true,
          requestStatus: 'Approved',
          status: 'Active',
          registrationExpiryDate: expiryStr,
          make: requestItem?.make,
          model: requestItem?.model,
          type: requestItem?.type,
          currentKM: requestItem?.currentKM || 0
        };
        next = [...prev, newTruck];
      }
      localStorage.setItem('ttt_trucks', JSON.stringify(next));
      return next;
    });

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';

        const existing = trucks.find(t => t.organizationId === orgId && t.truckNo.toUpperCase() === truckNo.toUpperCase());
        const truckId = existing ? existing.id : ('tr_' + Date.now());
        const updatedTruck: Truck = {
          id: truckId,
          truckNo: truckNo.toUpperCase(),
          organizationId: orgId,
          isApproved: true,
          requestStatus: 'Approved' as const,
          status: 'Active' as const,
          registrationExpiryDate: expiryStr,
          make: existing?.make || requestItem?.make,
          model: existing?.model || requestItem?.model,
          type: existing?.type || requestItem?.type,
          currentKM: existing?.currentKM || requestItem?.currentKM || 0
        };
        await appwrite.saveFleetDocument(databaseId, 'trucks', truckId, orgId, updatedTruck);

        const userEmail = currentUser ? (currentUser.email || currentUser.name || 'SuperAdmin') : 'SuperAdmin';
        const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
        const newAuditLog: AuditLog = {
          id: logId,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          user: userEmail,
          action: 'Approved',
          category: 'Truck',
          reference: truckNo.toUpperCase(),
          details: `Truck registration approved for ${duration === '1Y' ? '1 Year' : duration === '6M' ? '6 Months' : duration === '3M' ? '3 Months' : '1 Month'}. Active until: ${expiryStr}`,
          organizationId: orgId
        };
        await appwrite.saveFleetDocument(databaseId, 'audit_logs', logId, orgId, newAuditLog);
      } catch (err) {
        console.warn("Failed to push truck approval sync to database:", err);
      }
    }

    // Pass orgId as targetOrgId so the local log entry is stored under the correct org,
    // making it visible to the org's users in their activity feed.
    logAction('Approved', 'Truck', truckNo, `Backend approved truck registration for org ${orgId} (${duration} duration, expires ${expiryStr}).`, orgId);
    showNotification(`✓ Truck ${truckNo} approved for Org ${orgId}.`);
  };

  const handleRejectTruckRequest = async (orgId: string, requestId: string, fallbackTruckNo?: string) => {
    const profile = organizationProfiles.find(p => p.organizationId === orgId);
    if (!profile) return;

    let reqItem = (profile.truckRequests || []).find(r => r.id === requestId);
    const truckNoToReject = reqItem?.truckNo || fallbackTruckNo;

    const nextRequests = (profile.truckRequests || []).filter(r =>
      r.id !== requestId && !(truckNoToReject && r.truckNo.toUpperCase() === truckNoToReject.toUpperCase())
    );

    const nextProfiles = organizationProfiles.map(p =>
      p.organizationId === orgId ? { ...p, truckRequests: nextRequests } : p
    );
    await saveOrganizationProfiles(nextProfiles);

    if (truckNoToReject) {
      setTrucks(prev => {
        const exists = prev.some(t => t.organizationId === orgId && t.truckNo.toUpperCase() === truckNoToReject.toUpperCase());
        let next;
        if (exists) {
          next = prev.map(t => {
            if (t.organizationId === orgId && t.truckNo.toUpperCase() === truckNoToReject.toUpperCase()) {
              if (t.isApproved) {
                // If it is already approved, don't change the approved truck back to rejected!
                return t;
              }
              return {
                ...t,
                isApproved: false,
                requestStatus: 'Rejected' as const,
                status: 'Inactive' as const
              };
            }
            return t;
          });
        } else {
          const newTruck: Truck = {
            id: 'tr_' + Date.now(),
            truckNo: truckNoToReject.toUpperCase(),
            organizationId: orgId,
            isApproved: false,
            requestStatus: 'Rejected',
            status: 'Inactive',
            make: reqItem?.make,
            model: reqItem?.model,
            type: reqItem?.type,
            currentKM: reqItem?.currentKM || 0
          };
          next = [...prev, newTruck];
        }
        localStorage.setItem('ttt_trucks', JSON.stringify(next));
        return next;
      });

      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';

          const existing = trucks.find(t => t.organizationId === orgId && t.truckNo.toUpperCase() === truckNoToReject.toUpperCase());
          const truckId = existing ? existing.id : ('tr_' + Date.now());
          const rejectedTruck: Truck = {
            id: truckId,
            truckNo: truckNoToReject.toUpperCase(),
            organizationId: orgId,
            isApproved: false,
            requestStatus: 'Rejected' as const,
            status: 'Inactive' as const,
            make: existing?.make || reqItem?.make,
            model: existing?.model || reqItem?.model,
            type: existing?.type || reqItem?.type,
            currentKM: existing?.currentKM || reqItem?.currentKM || 0
          };
          await appwrite.saveFleetDocument(databaseId, 'trucks', truckId, orgId, rejectedTruck);

          const userEmail = currentUser ? (currentUser.email || currentUser.name || 'SuperAdmin') : 'SuperAdmin';
          const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
          const newAuditLog: AuditLog = {
            id: logId,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            user: userEmail,
            action: 'Rejected',
            category: 'Truck',
            reference: truckNoToReject.toUpperCase(),
            details: `Truck registration request rejected by system administrator.`,
            organizationId: orgId
          };
          await appwrite.saveFleetDocument(databaseId, 'audit_logs', logId, orgId, newAuditLog);
        } catch (err) {
          console.warn("Failed to push truck rejection sync to database:", err);
        }
      }
    }

    // Pass orgId so the local log entry is stored under the correct org
    logAction('Rejected', 'Truck', truckNoToReject || orgId, `Backend rejected truck registration request for org ${orgId}.`, orgId);
    showNotification(`✗ Truck request rejected for Org ${orgId}.`);
  };

  const handleBackendUpdateTruck = async (targetOrgId: string, updatedTruck: Truck) => {
    setTrucks(prev => {
      const next = prev.map(t => t.id === updatedTruck.id ? updatedTruck : t);
      localStorage.setItem('ttt_trucks', JSON.stringify(next));
      return next;
    });

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';

        await appwrite.saveFleetDocument(databaseId, 'trucks', updatedTruck.id, targetOrgId, updatedTruck);

        const userEmail = currentUser ? (currentUser.email || currentUser.name || 'SuperAdmin') : 'SuperAdmin';
        const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
        const newAuditLog: AuditLog = {
          id: logId,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          user: userEmail,
          action: 'Edited',
          category: 'Truck',
          reference: updatedTruck.truckNo.toUpperCase(),
          details: `Compliance parameters or status updated by admin. Status: ${updatedTruck.status}`,
          organizationId: targetOrgId
        };
        await appwrite.saveFleetDocument(databaseId, 'audit_logs', logId, targetOrgId, newAuditLog);
      } catch (err: any) {
        console.error("Backend failed to push remote truck updates to database:", err);
        alert(`Error pushing truck updates to organization database: ${err.message}`);
      }
    }

    logAction('Edited', 'Truck', updatedTruck.truckNo, `Super Admin modified remote truck details for Org ${targetOrgId}. Status: ${updatedTruck.status}`, targetOrgId);
    showNotification(`Updated truck ${updatedTruck.truckNo} details.`);
  };

  const handleAddTruckRequest = async (truckPayload: Omit<Truck, 'id'>) => {
    const existingRejectedTruck = orgTrucks.find(t =>
      t.truckNo.toUpperCase().trim() === truckPayload.truckNo.toUpperCase().trim() &&
      t.requestStatus === 'Rejected'
    );

    const isDup = orgTrucks.some(t =>
      t.truckNo.toUpperCase().trim() === truckPayload.truckNo.toUpperCase().trim() &&
      t.requestStatus !== 'Rejected'
    );

    if (isDup) {
      alert("Truck Number is already registered or has a pending request in this organization.");
      return;
    }

    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    const expiryStr = d.toISOString().split('T')[0];

    let targetTruckId: string;
    let newTruckObj: Truck;

    if (existingRejectedTruck) {
      targetTruckId = existingRejectedTruck.id;
      newTruckObj = {
        ...existingRejectedTruck,
        ...truckPayload,
        isApproved: false,
        requestStatus: 'Pending' as const,
        status: 'Inactive' as const,
        registrationExpiryDate: expiryStr
      };
      setTrucks(prev => {
        const next = prev.map(t => t.id === targetTruckId ? newTruckObj : t);
        localStorage.setItem('ttt_trucks', JSON.stringify(next));
        return next;
      });
    } else {
      targetTruckId = 'tr_' + Date.now();
      newTruckObj = {
        ...truckPayload,
        id: targetTruckId,
        organizationId: currentUserOrgId,
        isApproved: false,
        requestStatus: 'Pending' as const,
        status: 'Inactive' as const,
        registrationExpiryDate: expiryStr
      };
      setTrucks(prev => {
        const next = [...prev, newTruckObj];
        localStorage.setItem('ttt_trucks', JSON.stringify(next));
        return next;
      });
    }

    touchLastModified();

    const requestItem: TruckRequest = {
      id: 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      truckNo: truckPayload.truckNo.toUpperCase(),
      requestedAt: new Date().toISOString().substring(0, 10),
      status: 'Pending',
      make: truckPayload.make,
      model: truckPayload.model,
      type: truckPayload.type,
      currentKM: truckPayload.currentKM
    };

    const nextProfiles = organizationProfiles.map(p => {
      if (p.organizationId === currentUserOrgId) {
        return {
          ...p,
          truckRequests: [...(p.truckRequests || []), requestItem]
        };
      }
      return p;
    });

    if (isAppwriteConfigured() && currentUserOrgId) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'trucks', targetTruckId, currentUserOrgId, newTruckObj);
        console.log("Successfully pushed new truck request document to Appwrite.");
      } catch (err) {
        console.warn("Could not push new truck request document to database:", err);
        alert("Failed to request truck activation: Appwrite database connection error. Please try again.");
        return;
      }
    }

    await saveOrganizationProfiles(nextProfiles);

    showNotification(`Submitted activation request for truck ${truckPayload.truckNo}.`);
    logAction('Created', 'Truck', truckPayload.truckNo, `Requested activation for new truck.`);
  };

  // Reconcile pending trucks if approved in global profiles
  useEffect(() => {
    if (!currentUserOrgId) return;
    if (!initialPullDone) {
      console.log('Appwrite Auto-Sync: Blocking truck reconciliation until initial cloud sync completes.');
      return;
    }
    const currentOrgProfile = organizationProfiles.find(p => p.organizationId === currentUserOrgId);
    if (!currentOrgProfile) return;

    let trucksUpdated = false;
    const updatedTrucks = trucks.map(truck => {
      if (truck.organizationId === currentUserOrgId && truck.isApproved === false) {
        const approvedReq = (currentOrgProfile.truckRequests || []).find(
          r => r.truckNo === truck.truckNo && r.status === 'Approved'
        );
        if (approvedReq) {
          trucksUpdated = true;
          return { ...truck, isApproved: true, status: 'Active' as const };
        }
      }
      return truck;
    });

    if (trucksUpdated) {
      setTrucks(updatedTrucks);
      localStorage.setItem('ttt_trucks', JSON.stringify(updatedTrucks));
      showNotification(`A pending truck request has been approved by the backend team!`);
      logAction('Created', 'Truck', 'ApprovalSync', `Truck activated automatically via backend activation approval.`);

      touchLastModified();
    }
  }, [organizationProfiles, currentUserOrgId, trucks, initialPullDone]);

  // Real-time synchronization and polling fallback for Super Admin
  useEffect(() => {
    if (!currentUserRights.isSuperAdmin || !isAppwriteConfigured()) return;

    const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';

    const reloadBackendData = async () => {
      try {
        const orgFleetData: { [orgId: string]: any } = {};
        let userRightsData: any = null;

        const categories: { key: string; collection: string }[] = [
          { key: 'trucks', collection: 'trucks' },
          { key: 'drivers', collection: 'drivers' },
          { key: 'offices', collection: 'offices' },
          { key: 'accounts', collection: 'accounts' },
          { key: 'trips', collection: 'trips' },
          { key: 'expenses', collection: 'expenses' },
          { key: 'tyres', collection: 'tyres' },
          { key: 'auditLogs', collection: 'audit_logs' }
        ];

        const fetchPromises = categories.map(async (cat) => {
          try {
            const docs = await appwrite.listFleetDocuments(databaseId, cat.collection, 'org_backend');
            for (const doc of docs) {
              const orgId = doc.organizationId;
              if (!orgId || orgId === 'global' || orgId === 'org_backend') continue;

              if (!orgFleetData[orgId]) {
                orgFleetData[orgId] = {
                  trucks: [],
                  drivers: [],
                  offices: [],
                  accounts: [],
                  trips: [],
                  expenses: [],
                  tyres: [],
                  auditLogs: []
                };
              }

              try {
                const record = JSON.parse(doc.data);
                orgFleetData[orgId][cat.key].push(record);
              } catch (e) {
                console.warn(`Failed to parse document payload in ${cat.collection}:`, e);
              }
            }
          } catch (catErr: any) {
            console.warn(`Failed to fetch backend documents for ${cat.collection}:`, catErr.message);
          }
        });

        const loadRightsPromise = (async () => {
          try {
            userRightsData = await fetchAllGlobalConfigs(databaseId);
          } catch (e) {
            console.warn('Failed to load global rights config for backend reload:', e);
          }
        })();

        await Promise.all([...fetchPromises, loadRightsPromise]);

        // 1. Update user rights & organization profiles
        if (userRightsData) {
          if (userRightsData.userRightsList && Array.isArray(userRightsData.userRightsList)) {
            const cloudRights = migrateUserPermissions(userRightsData.userRightsList);
            setUserRightsList(cloudRights);
            localStorage.setItem('ttt_user_rights', JSON.stringify(cloudRights));
          }
          if (userRightsData.organizationProfiles && Array.isArray(userRightsData.organizationProfiles)) {
            setOrganizationProfiles(userRightsData.organizationProfiles);
            localStorage.setItem('ttt_organization_profiles', JSON.stringify(userRightsData.organizationProfiles));
          }
        }

        // 2. Update states
        const currentProfiles = userRightsData?.organizationProfiles || organizationProfilesRef.current;

        // Self-healing: Automatically clean up orphaned requests from user_rights_snapshot when a vehicle is deleted
        let profilesChanged = false;
        const cleanedProfiles = currentProfiles.map(profile => {
          if (profile.organizationId === 'org_backend') return profile;

          const orgData = orgFleetData[profile.organizationId];
          if (!orgData) return profile;

          const orgTrucksCloud = orgData.trucks || [];
          const currentRequests = profile.truckRequests || [];

          const nextRequests = currentRequests.filter(req => {
            const truckExists = orgTrucksCloud.some(
              (t: any) => t.truckNo.toUpperCase() === req.truckNo.toUpperCase()
            );
            if (truckExists) return true;

            // Grace period: do not delete newly created requests (less than 60 seconds old)
            // to allow asynchronous DB writes and replication to complete.
            const reqTimestampMatch = req.id.match(/^req_(\d+)/);
            const isNewRequest = reqTimestampMatch
              ? (Date.now() - Number(reqTimestampMatch[1]) < 60000)
              : false;

            if (isNewRequest) {
              return true;
            }

            if (req.status === 'Pending' || req.status === 'Rejected') {
              console.info(`Self-Healing: Removing orphaned ${req.status} request for truck ${req.truckNo} in org ${profile.organizationId} because the vehicle registry record was deleted.`);
              profilesChanged = true;
              return false;
            }
            return true;
          });

          if (nextRequests.length !== currentRequests.length) {
            return {
              ...profile,
              truckRequests: nextRequests
            };
          }
          return profile;
        });

        if (profilesChanged) {
          await saveOrganizationProfilesRef.current(cleanedProfiles);
        }

        setTrucks(prev => {
          let updated = [...prev];
          for (const orgId in orgFleetData) {
            const orgData = orgFleetData[orgId];
            if (orgData.trucks && Array.isArray(orgData.trucks)) {
              updated = [
                ...updated.filter(t => t.organizationId !== orgId),
                ...migrateTrucks(orgData.trucks).map(t => ({ ...t, organizationId: orgId }))
              ];
            }
          }
          localStorage.setItem('ttt_trucks', JSON.stringify(updated));
          return updated;
        });

        setTrips(prev => {
          let updated = [...prev];
          for (const orgId in orgFleetData) {
            const orgData = orgFleetData[orgId];
            if (orgData.trips && Array.isArray(orgData.trips)) {
              updated = [
                ...updated.filter(t => t.organizationId !== orgId),
                ...migrateTrips(migrateTripsIfNecessary(orgData.trips)).map(t => ({ ...t, organizationId: orgId }))
              ];
            }
          }
          localStorage.setItem('ttt_trips', JSON.stringify(updated));
          return updated;
        });

        setDrivers(prev => {
          let updated = [...prev];
          for (const orgId in orgFleetData) {
            const orgData = orgFleetData[orgId];
            if (orgData.drivers && Array.isArray(orgData.drivers)) {
              updated = [
                ...updated.filter(d => d.organizationId !== orgId),
                ...migrateDrivers(orgData.drivers).map(d => ({ ...d, organizationId: orgId }))
              ];
            }
          }
          localStorage.setItem('ttt_drivers', JSON.stringify(updated));
          return updated;
        });

        setOffices(prev => {
          let updated = [...prev];
          for (const orgId in orgFleetData) {
            const orgData = orgFleetData[orgId];
            if (orgData.offices && Array.isArray(orgData.offices)) {
              updated = [
                ...updated.filter(o => o.organizationId !== orgId),
                ...migrateOffices(orgData.offices).map(o => ({ ...o, organizationId: orgId }))
              ];
            }
          }
          localStorage.setItem('ttt_offices', JSON.stringify(updated));
          return updated;
        });

        setAccounts(prev => {
          let updated = [...prev];
          for (const orgId in orgFleetData) {
            const orgData = orgFleetData[orgId];
            if (orgData.accounts && Array.isArray(orgData.accounts)) {
              updated = [
                ...updated.filter(a => a.organizationId !== orgId),
                ...migrateAccounts(orgData.accounts).map(a => ({ ...a, organizationId: orgId }))
              ];
            }
          }
          localStorage.setItem('ttt_accounts', JSON.stringify(updated));
          return updated;
        });

        setExpenses(prev => {
          let updated = [...prev];
          for (const orgId in orgFleetData) {
            const orgData = orgFleetData[orgId];
            if (orgData.expenses && Array.isArray(orgData.expenses)) {
              updated = [
                ...updated.filter(e => e.organizationId !== orgId),
                ...migrateExpenses(orgData.expenses).map(e => ({ ...e, organizationId: orgId }))
              ];
            }
          }
          localStorage.setItem('ttt_expenses', JSON.stringify(updated));
          return updated;
        });

        setTyres(prev => {
          let updated = [...prev];
          for (const orgId in orgFleetData) {
            const orgData = orgFleetData[orgId];
            if (orgData.tyres && Array.isArray(orgData.tyres)) {
              updated = [
                ...updated.filter(ty => ty.organizationId !== orgId),
                ...migrateTyres(orgData.tyres).map(ty => ({ ...ty, organizationId: orgId }))
              ];
            }
          }
          localStorage.setItem('ttt_tyres', JSON.stringify(updated));
          return updated;
        });

        setAuditLogs(prev => {
          let updated = [...prev];
          for (const orgId in orgFleetData) {
            const orgData = orgFleetData[orgId];
            if (orgData.auditLogs && Array.isArray(orgData.auditLogs)) {
              updated = [
                ...updated.filter(l => l.organizationId !== orgId),
                ...migrateAuditLogs(orgData.auditLogs).map(l => ({ ...l, organizationId: orgId }))
              ];
            }
          }
          localStorage.setItem('fleet_audit_logs', JSON.stringify(updated));
          return updated;
        });

      } catch (err) {
        console.warn("Backend live data sync failed:", err);
      }
    };

    // Initial load
    reloadBackendData();

    // Subscribe to realtime database document events
    let unsubscribe: (() => void) | null = null;
    const setupRealtime = async () => {
      try {
        await appwrite.initSession();
        const client = appwrite.getClient();
        const colList = ['trucks', 'drivers', 'offices', 'accounts', 'trips', 'expenses', 'tyres', 'audit_logs', 'global_configs'];
        const channels = colList.map(col => `databases.${databaseId}.collections.${col}.documents`);
        unsubscribe = client.subscribe(channels, (response: any) => {
          console.log("Super Admin Realtime Socket: Reloading datasets on DB changes...");
          reloadBackendData();
        });
      } catch (e) {
        console.warn("Super Admin websocket registration failed, relying on polling:", e);
      }
    };

    setupRealtime();

    // Polling fallback every 8 seconds
    const interval = setInterval(() => {
      console.log("Super Admin Polling: Reloading datasets...");
      reloadBackendData();
    }, 8000);

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, [currentUserRights.isSuperAdmin]);









  // --- SERVICE DONE HANDLER ---
  // Creates up to 2 expense entries (parts + labour) and advances the truck's next-due KM milestone
  const handleServiceDone = async (payload: import('./types').ServiceDonePayload) => {
    const { serviceType, serviceDate, truckId, truckNo, newMilestoneKM, notes, partsExpense, labourExpense } = payload;
    const orgId = currentUserOrgId;
    const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';

    // Map service type → truck field key
    const kmFieldMap: Record<string, string> = {
      'Engine Oil':    'engineOilKM',
      'Crown Oil':     'crownOilKM',
      'Gear Box Oil':  'gearBoxOilKM',
      'Radiator':      'radiatorKM',
      'Pinpush Grease':'pinpushKM',
      'Wheel Grease':  'wheelGreaseKM',
    };
    const kmField = kmFieldMap[serviceType];

    const newExpenses: import('./types').ExpenseEntry[] = [];

    // 1. Parts Purchase expense
    if (partsExpense.amount > 0) {
      const partsExp: import('./types').ExpenseEntry = {
        id: 'exp_svc_parts_' + Date.now(),
        truckNo,
        expenseType: `Service - ${serviceType}`,
        shopName: partsExpense.shopName,
        amount: partsExpense.amount,
        paymentMode: partsExpense.paymentMode,
        accountType: partsExpense.accountType,
        driverName: partsExpense.driverName,
        status: partsExpense.status,
        date: serviceDate,
        notes: notes,
        organizationId: orgId,
      };
      newExpenses.push(partsExp);
    }

    // 2. Mechanical Labour expense
    if (labourExpense.amount > 0) {
      const labourExp: import('./types').ExpenseEntry = {
        id: 'exp_svc_labour_' + Date.now() + '_1',
        truckNo,
        expenseType: `Service - ${serviceType} (Labour)`,
        shopName: labourExpense.shopName,
        amount: labourExpense.amount,
        paymentMode: labourExpense.paymentMode,
        accountType: labourExpense.accountType,
        driverName: labourExpense.driverName,
        status: labourExpense.status,
        date: serviceDate,
        notes: notes,
        organizationId: orgId,
      };
      newExpenses.push(labourExp);
    }

    // 3. Save expenses locally + to Appwrite
    if (newExpenses.length > 0) {
      const nextExpenses = [...expenses, ...newExpenses];
      saveExpenses(nextExpenses);
      if (isAppwriteConfigured()) {
        try {
          for (const exp of newExpenses) {
            await appwrite.saveFleetDocument(databaseId, 'expenses', exp.id, orgId, exp);
          }
        } catch (err) {
          console.warn('Failed to save service expenses to Appwrite:', err);
        }
      }
      await loadDashboardData(activeMonth, activeYear);
      newExpenses.forEach(exp => {
        logAction('Created', 'Expense', exp.truckNo, `Service Done — ₹${exp.amount.toLocaleString()} ${exp.expenseType} at ${exp.shopName}`);
      });
    }

    // 4. Advance truck milestone KM
    if (kmField) {
      const truck = trucks.find(t => t.id === truckId);
      if (truck) {
        const updatedTruck = { ...truck, [kmField]: newMilestoneKM };
        const next = trucks.map(t => t.id === truckId ? updatedTruck : t);
        saveTrucks(next);
        if (isAppwriteConfigured()) {
          try {
            await appwrite.saveFleetDocument(databaseId, 'trucks', truckId, orgId, updatedTruck);
          } catch (err) {
            console.warn('Failed to sync service-updated truck to Appwrite:', err);
          }
        }
        logAction('Edited', 'Truck', truckNo, `Service Done: ${serviceType} — next due set to ${newMilestoneKM.toLocaleString()} KM${notes ? ` (Note: ${notes})` : ''}`);
      }
    }

    const totalCost = (partsExpense.amount || 0) + (labourExpense.amount || 0);
    showNotification(`${serviceType} service recorded for ${truckNo}${ totalCost > 0 ? ` — ₹${totalCost.toLocaleString()} logged to expense ledger` : '' }.`);
  };



  // --- TRIP ENTRIES CRUD SYSTEM ---
  const handlePostTripEntry = async (entryInput: Omit<TripEntry, 'id'>) => {
    await postTripEntry(entryInput, editingTrip);
    setEditingTrip(null);
  };

  const handleEditTripTrigger = (entry: TripEntry) => {
    setEditingTrip(entry);
    setBookingModalOpen(true);
  };

  // --- BACKUP RESTORE SYSTEM ---
  const handleTriggerDownloadBackup = () => {
    const payload = {
      trucks,
      drivers,
      offices,
      accounts,
      trips,
      tyres,
      exportDate: new Date().toISOString(),
      source: 'Truck Trip Tracker System'
    };

    const fileData = JSON.stringify(payload, null, 2);
    const blob = new Blob([fileData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TT_Tracker_Backup_${new Date().toISOString().substring(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("Backup snapshot exported to folder successfully.");
  };

  const handleUploadBackupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.trucks && parsed.offices && parsed.accounts && parsed.trips) {
          saveTrucks(parsed.trucks);
          if (parsed.drivers) {
            saveDrivers(parsed.drivers);
          } else {
            saveDrivers([]);
          }
          if (parsed.tyres) {
            saveTyres(parsed.tyres);
          } else {
            saveTyres([]);
          }
          saveOffices(parsed.offices);
          saveAccounts(parsed.accounts);
          saveTrips(parsed.trips);
          showNotification("System data recovered successfully! Master list updated.");
        } else {
          alert("Corrupted Schema. Uploaded file doesn't match Truck Trip Tracker backup signature.");
        }
      } catch (err) {
        alert("Failed to parse JSON file template. Please upload a valid JSON backup.");
      }
    };
    reader.readAsText(file);
  };

  const triggerClearAllLocalData = () => {
    confirmAction(
      "Are you sure you want to clear all local data? This will wipe all trucks, drivers, offices, accounts, trips, expenses, tyres, and audit logs.",
      () => {
        localStorage.removeItem('ttt_trucks');
        localStorage.removeItem('ttt_drivers');
        localStorage.removeItem('ttt_offices');
        localStorage.removeItem('ttt_accounts');
        localStorage.removeItem('ttt_trips');
        localStorage.removeItem('ttt_expenses');
        localStorage.removeItem('ttt_tyres');
        localStorage.removeItem('fleet_audit_logs');

        setTrucks([]);
        setDrivers([]);
        setOffices([]);
        setAccounts([]);
        setTrips([]);
        setExpenses([]);
        setTyres([]);
        setAuditLogs([]);

        showNotification("All database journals cleared successfully.");
      },
      "Clear Database Journals"
    );
  };

  if (loadingUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-xs text-slate-400">Verifying session credentials...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={async (user) => {
          localStorage.setItem('ttt_login_method', 'appwrite');
          localStorage.removeItem('ttt_guest_user');
          setLoadingUser(true);
          setInitialPullDone(false);
          try {
            await reconcileSession(user);
            showNotification(`Successfully logged in as ${user.name || user.email}`);
          } catch (err) {
            console.error(err);
          } finally {
            setLoadingUser(false);
          }
        }}
        checkUserApproval={checkUserApproval}
        onRegisterUserPermissions={handleRegisterUserPermissions}
      />
    );
  }

  const currentOrgProfile = organizationProfiles.find(p => p.organizationId === currentUserOrgId);
  const isOrgDisabled = currentOrgProfile ? currentOrgProfile.status === 'Disabled' : false;

  if (currentUser && isOrgDisabled && !currentUserRights.isSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 font-sans p-4">
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-55/15 rounded-xl shadow-lg border border-red-500/30 mb-2">
            <AlertCircle className="w-6 h-6 text-red-500 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white font-sans">
            Organization Disabled
          </h2>
          <p className="text-xs text-slate-350 leading-relaxed font-sans">
            Your organization account has been disabled by the system administrator.
            Please contact support or pay your invoices to restore access to your fleet.
          </p>
          <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-xl text-xs font-mono text-slate-400 select-all">
            Org ID: {currentUserOrgId}
          </div>

          <div className="border-t border-slate-800 pt-4">
            <button
              onClick={handleLogout}
              className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
            >
              Sign Out / Log In to another account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser && !currentUserRights.isApproved) {
    const hasOrgId = !!currentUserRights.organizationId;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 font-sans p-4">
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-500/15 rounded-xl shadow-lg border border-amber-500/30 mb-2">
            <Clock className="w-6 h-6 text-amber-500 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white font-sans">
            {hasOrgId ? 'Pending Admin Approval' : 'Access Revoked / No Org Mapped'}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {hasOrgId
              ? 'Your account has been successfully registered! However, access is pending approval by the Administrator of your organization:'
              : 'Your account is not currently associated with any active organization. Your access may have been revoked, or you may need to join an organization:'}
          </p>
          <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-xl text-xs font-mono text-blue-400 select-all">
            {currentUserRights.organizationId || 'No Organization Mapped'}
          </div>
          <p className="text-[11px] text-slate-400 font-sans">
            {hasOrgId
              ? 'Please share your email and Organization ID with your administrator. Once approved, refresh the page to access your dashboards.'
              : 'Please enter a valid Organization ID below to request to join a new organization. Once the Administrator approves you, you will gain access.'}
          </p>

          <div className="border-t border-slate-800 my-4 pt-4">
            {!showChangeOrgForm ? (
              <button
                onClick={() => {
                  setChangeOrgIdInput('');
                  setChangeOrgError(null);
                  setShowChangeOrgForm(true);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
              >
                Join a different organization?
              </button>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setChangeOrgLoading(true);
                  setChangeOrgError(null);
                  try {
                    const res = await handleRequestToJoinOrganization(changeOrgIdInput);
                    if (res.success) {
                      setShowChangeOrgForm(false);
                      showNotification("Organization change request submitted!");
                    } else if (res.error) {
                      setChangeOrgError(res.error);
                    }
                  } catch (err: any) {
                    setChangeOrgError(err.message || 'Failed to submit request.');
                  } finally {
                    setChangeOrgLoading(false);
                  }
                }}
                className="space-y-3 text-left"
              >
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">New Organization ID</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Organization ID to join"
                    value={changeOrgIdInput}
                    onChange={(e) => setChangeOrgIdInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                {changeOrgError && (
                  <p className="text-[11px] text-rose-400 bg-rose-950/20 border border-rose-900/50 p-2 rounded-lg leading-relaxed">
                    {changeOrgError}
                  </p>
                )}
                <div className="flex justify-between items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowChangeOrgForm(false)}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changeOrgLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    {changeOrgLoading ? 'Submitting...' : 'Request to Join'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white rounded-xl border border-slate-800 transition cursor-pointer text-xs font-bold font-sans mt-4"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Back to Login / Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  const approvedOrgTrucks = orgTrucks.filter(t => t.isApproved !== false);
  const orgUserRights = userRightsList.filter(u => u.organizationId === currentUserOrgId);
  const canUserViewCategory = (category: string, logUserOrReference?: string, logDetails?: string): boolean => {
    if (currentUserRights.isSuperAdmin) return true;

    // Check if this log specifically concerns the current logged-in user (e.g. their permissions or approval status changed)
    const currentUserEmail = (currentUser?.email || '').toLowerCase().trim();
    if (currentUserEmail) {
      const ref = (logUserOrReference || '').toLowerCase().trim();
      const det = (logDetails || '').toLowerCase().trim();
      if (ref === currentUserEmail || ref.includes(currentUserEmail) || det.includes(currentUserEmail)) {
        return true;
      }
    }

    const cat = category.toLowerCase();
    if (cat.includes('trip')) return !!currentUserRights.canViewTrips;
    if (cat.includes('truck')) return !!currentUserRights.canViewTrucks;
    if (cat.includes('driver')) return !!currentUserRights.canViewDrivers;
    if (cat.includes('office') || cat.includes('branch')) return !!currentUserRights.canViewOffices;
    if (cat.includes('account')) return !!currentUserRights.canViewAccounts;
    if (cat.includes('expense')) return !!currentUserRights.canViewExpenses;
    if (cat.includes('tyre')) return !!currentUserRights.canViewTyres;
    if (cat.includes('organization') || cat.includes('access') || cat.includes('permission')) {
      return !!currentUserRights.isAdmin;
    }
    return true;
  };

  const orgAuditLogs = auditLogs
    .filter(l =>
      l.organizationId === currentUserOrgId &&
      canUserViewCategory(l.category, l.reference, l.details)
    )
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  const latestLogTime = (() => {
    if (orgAuditLogs.length === 0) return 0;
    const ts = orgAuditLogs[0]?.timestamp;
    if (!ts) return 0;
    try {
      return ts.includes('T')
        ? new Date(ts).getTime()
        : new Date(ts.replace(' ', 'T') + 'Z').getTime();
    } catch { return 0; }
  })();
  const hasUnreadNotifications = latestLogTime > lastReadNotificationTime;

  const cyanCount = currentUserRights.isAdmin
    ? orgUserRights.filter(u => !u.isApproved).length
    : orgTrips.filter(t => t.status === 'In Progress' || t.status === 'Pending').length;

  const handleCyanClick = () => {
    if (currentUserRights.isAdmin) {
      setActiveTab('USERS');
    } else {
      setActiveTab('TRIPS');
    }
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans select-none selection:bg-blue-600/10 overflow-hidden">

      {/* GLOBAL TOAST BANNER */}
      {toastMessage && (
        <div id="toast-notify" className="fixed bottom-5 right-5 z-50 bg-blue-600 border border-blue-400/30 text-white p-3.5 px-6 rounded-xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <CheckCircle className="w-4 h-4 text-white" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 md:h-full bg-white dark:bg-slate-900 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 shrink-0">
        {/* Header Panel (Logo & Mobile Toggle Button) */}
        <div className="p-4 md:p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 md:border-b-0 shrink-0">
          <div className="flex items-center gap-3 text-slate-900 dark:text-white font-bold text-lg md:text-xl tracking-tight">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 00-1 1v1h2v-1a1 1 0 00-1-1z"></path>
              </svg>
            </div>
            <span>FleetTrack Pro</span>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 cursor-pointer transition"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            )}
          </button>
        </div>

        {/* Collapsible Content Area */}
        <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-h-0 overflow-hidden`}>
          {/* Navigation Items */}
          <div className="p-6 pt-4 md:p-6 md:pt-0 flex-1 flex flex-col min-h-0 overflow-hidden">
            <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
              <button
                id="tab-btn-dashboard"
                onClick={() => selectTab('DASHBOARD')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab === 'DASHBOARD'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              {currentUserRights.canViewTrips && (
                <button
                  id="tab-btn-trips"
                  onClick={() => selectTab('TRIPS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab === 'TRIPS'
                    ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Trip Management</span>
                </button>
              )}
              {currentUserRights.canViewTrucks && (
                <button
                  id="tab-btn-trucks"
                  onClick={() => selectTab('TRUCKS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab === 'TRUCKS'
                    ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                >
                  <TruckIcon className="w-4 h-4" />
                  <span>Truck Registry</span>
                </button>
              )}
              {currentUserRights.canViewOffices && (
                <button
                  id="tab-btn-offices"
                  onClick={() => selectTab('OFFICES')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab === 'OFFICES'
                    ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>Offices</span>
                </button>
              )}
              {currentUserRights.canViewAccounts && (
                <button
                  id="tab-btn-accounts"
                  onClick={() => selectTab('ACCOUNTS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab === 'ACCOUNTS'
                    ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                >
                  <Coins className="w-4 h-4" />
                  <span>Account Ledger</span>
                </button>
              )}
              {currentUserRights.canViewDrivers && (
                <button
                  id="tab-btn-drivers"
                  onClick={() => selectTab('DRIVERS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab === 'DRIVERS'
                    ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Drivers Database</span>
                </button>
              )}
              {currentUserRights.canViewExpenses && (
                <button
                  id="tab-btn-expenses"
                  onClick={() => selectTab('EXPENSES')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab === 'EXPENSES'
                    ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Expense Ledger</span>
                </button>
              )}
              {currentUserRights.canViewTrips && (
                <button
                  id="tab-btn-reports"
                  onClick={() => selectTab('REPORTS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab === 'REPORTS'
                    ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Monthly Reports</span>
                </button>
              )}
              {currentUserRights.isAdmin && (
                <button
                  id="tab-btn-audit"
                  onClick={() => selectTab('AUDIT')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab === 'AUDIT'
                    ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                >
                  <History className="w-4 h-4" />
                  <span>System Audit Logs</span>
                </button>
              )}
              {currentUserRights.canViewTyres && (
                <button
                  id="tab-btn-tyres"
                  onClick={() => selectTab('TYRES')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab === 'TYRES'
                    ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                >
                  <Disc className="w-4 h-4" />
                  <span>Tyre Ledger & ODO</span>
                </button>
              )}
              {hasUsersTabAccess && (
                <button
                  id="tab-btn-users"
                  onClick={() => selectTab('USERS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab === 'USERS'
                    ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Access Control</span>
                </button>
              )}
              {currentUserRights.isSuperAdmin && (
                <button
                  id="tab-btn-backend"
                  onClick={() => selectTab('BACKEND')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab === 'BACKEND'
                    ? 'bg-purple-50 dark:bg-purple-650/10 text-purple-650 dark:text-purple-400 font-semibold border-l-2 border-purple-500 pl-2.5'
                    : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                >
                  <Settings className="w-4 h-4 text-purple-500" />
                  <span>Backend Dashboard</span>
                </button>
              )}
            </nav>
          </div>

          {/* User Profile Info Footer Panel */}
          <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-850 space-y-3 shrink-0">
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 px-1">Logged in as</div>
              <div className="text-xs text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2 px-1 truncate" title={currentUser?.email || currentUser?.name || 'User'}>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0"></span>
                <span className="truncate">{currentUser?.name || currentUser?.email || 'Logistics Admin'}</span>
              </div>
            </div>
            {currentUserOrgId && (
              <div className="flex items-center justify-between bg-slate-150 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                <span className="truncate font-semibold select-all" title={currentUserOrgId}>Org: {currentUserOrgId}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentUserOrgId);
                    showNotification("Organization ID copied to clipboard!");
                  }}
                  className="text-slate-555 hover:text-slate-900 dark:hover:text-white transition-colors p-0.5 shrink-0 ml-1.5 cursor-pointer"
                  title="Copy Organization ID"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-660 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 text-xs font-bold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden">

        {/* Header */}
        <header className="h-auto md:h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between px-6 md:px-8 py-3 md:py-0 gap-3 shrink-0 shadow-xs sticky top-0 z-40">
          <div className="flex items-center gap-4 self-stretch sm:self-auto">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
              {activeTab === 'DASHBOARD' && 'Operations Dashboard'}
              {activeTab === 'TRIPS' && 'Manage Active Trips'}
              {activeTab === 'TRUCKS' && 'Truck Datasheet'}
              {activeTab === 'OFFICES' && 'Office Branch Directory'}
              {activeTab === 'ACCOUNTS' && 'Mapped Account Ledgers'}
              {activeTab === 'DRIVERS' && 'Operator Drivers Database'}
              {activeTab === 'EXPENSES' && 'Voucher & Expenses Ledger'}
              {activeTab === 'REPORTS' && 'Fleet Profitability Reports'}
              {activeTab === 'AUDIT' && 'System Audit Trails'}
              {activeTab === 'TYRES' && 'Tyre Inventory & Life Tracking'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-2xs">
              {activeTab === 'TRIPS' && `${orgTrips.length} Total Trips`}
              {activeTab === 'TRUCKS' && `${orgTrucks.length} Trucks`}
              {activeTab === 'OFFICES' && `${orgOffices.length} Offices`}
              {activeTab === 'ACCOUNTS' && `${orgAccounts.length} Ledgers`}
              {activeTab === 'DRIVERS' && `${orgDrivers.length} Drivers`}
              {activeTab === 'DASHBOARD' && `${orgTrips.length} Load Segments`}
              {activeTab === 'EXPENSES' && `${orgExpenses.length} Vouchers`}
              {activeTab === 'REPORTS' && 'Monthly Auditing'}
              {activeTab === 'AUDIT' && `${orgAuditLogs.length} Activities`}
              {activeTab === 'TYRES' && `${orgTyres.length} Tyres`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto self-stretch sm:self-auto justify-end ml-auto">

            {/* Search Bar */}
            <div className="relative w-40 md:w-56 hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Search... ⌘K"
                className="block w-full pl-9 pr-3 py-1.5 bg-slate-100 hover:bg-slate-200/50 dark:bg-slate-800 dark:hover:bg-slate-700/50 focus:bg-white dark:focus:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-400 dark:placeholder-slate-500 cursor-pointer"
                readOnly
                onClick={() => showNotification("Global search feature is coming soon!")}
              />
            </div>

            {/* CYAN BADGE ACTION ICON */}
            <button
              onClick={handleCyanClick}
              className="relative p-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 rounded-lg border border-cyan-500/25 transition cursor-pointer flex items-center justify-center shrink-0"
              title={currentUserRights.isAdmin ? `${cyanCount} Pending Approvals` : `${cyanCount} Active/Pending Trips`}
            >
              {currentUserRights.isAdmin ? <Users className="w-4 h-4" /> : <TruckIcon className="w-4 h-4" />}
              {cyanCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-cyan-500 text-white rounded-full leading-none min-w-[16px] text-center border border-white dark:border-slate-900 shadow-sm animate-pulse">
                  {cyanCount}
                </span>
              )}
            </button>

            <div ref={notificationRef} className="relative">
              <button
                id="btn-notifications-toggle"
                onClick={() => {
                  setNotificationOpen(!notificationOpen);
                  setProfileDropdownOpen(false);
                  const now = Date.now();
                  setLastReadNotificationTime(now);
                  if (currentUser) {
                    const key = `ttt_last_read_notifications_${(currentUser.email || '').toLowerCase().trim()}`;
                    localStorage.setItem(key, now.toString());
                  }
                }}
                className="relative p-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-660 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center justify-center"
                title="Notification Center"
              >
                <Bell className="w-4 h-4" />
                {hasUnreadNotifications && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse" />
                )}
              </button>

              {notificationOpen && (
                <div className="
                  fixed left-3 right-3 top-16
                  md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-80
                  bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800
                  text-slate-800 dark:text-slate-100 rounded-xl shadow-2xl z-50 p-4 space-y-3 animate-fade-in text-left
                ">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Recent Activity Logs</span>
                    <button
                      onClick={() => setNotificationOpen(false)}
                      className="text-slate-400 dark:text-slate-500 hover:text-slate-655 dark:hover:text-slate-350 text-xs p-1 font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {orgAuditLogs.length === 0 ? (
                      <p className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 italic">No recent activities logged.</p>
                    ) : (
                      orgAuditLogs.slice(0, 8).map((log) => (
                        <div key={log.id} className="text-[11px] p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className={`font-extrabold uppercase text-[9px] px-1.5 py-0.5 rounded ${log.action === 'Approved' ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50' :
                                log.action === 'Rejected' ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50' :
                                  log.action === 'Created' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-150 dark:border-blue-900/50' :
                                    log.action === 'Deleted' ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-150 dark:border-red-900/50' :
                                      log.action === 'Edited' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-150 dark:border-amber-900/50' :
                                        'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200'
                              }`}>
                              {log.action}
                            </span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono font-medium">{(log.timestamp || '').substring(11, 16)}</span>
                          </div>
                          <p className="text-slate-700 dark:text-slate-300 leading-tight">
                            <strong className="text-slate-900 dark:text-white">{log.category} ({log.reference}):</strong> {log.details}
                          </p>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500">By {log.user}</p>
                        </div>
                      ))
                    )}
                  </div>
                  {orgAuditLogs.length > 0 && currentUserRights.isAdmin && (
                    <button
                      onClick={() => {
                        setActiveTab('AUDIT');
                        setNotificationOpen(false);
                      }}
                      className="w-full text-center text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline pt-1 block border-t border-slate-100 dark:border-slate-800"
                    >
                      View Full Audit Trail
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* VOICE ASSISTANT */}
            <button
              onClick={() => setIsVoiceAssistantOpen(true)}
              className="p-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center justify-center shrink-0"
              title="Voice Assistant (Alt+V)"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* THEME TOGGLE */}
            <button
              onClick={() => {
                const nextTheme = theme === 'light' ? 'dark' : 'light';
                setTheme(nextTheme);
                localStorage.setItem('ttt_theme', nextTheme);
              }}
              className="p-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center justify-center shrink-0"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* USER PROFILE INITIALS AVATAR */}
            <div ref={profileDropdownRef} className="relative shrink-0">
              <button
                id="btn-profile-avatar-toggle"
                onClick={() => {
                  setProfileDropdownOpen(!profileDropdownOpen);
                  setNotificationOpen(false);
                }}
                className="w-9 h-9 rounded-full bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 font-bold border border-blue-600/20 dark:border-blue-500/30 flex items-center justify-center text-xs cursor-pointer hover:bg-blue-600/20 transition-all select-none"
                title="User Profile Menu"
              >
                {getUserInitials(currentUser)}
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl shadow-2xl z-50 p-1.5 animate-fade-in text-left font-sans">
                  <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-850 mb-1 space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser?.name || 'Logistics User'}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{currentUser?.email || 'user@fleettrack.local'}</p>
                    {currentUserOrgId && (
                      <div className="flex items-center justify-between mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                        <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 truncate" title={currentUserOrgId}>Org: {currentUserOrgId}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(currentUserOrgId);
                            showNotification('Organization ID copied!');
                          }}
                          className="ml-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer shrink-0"
                          title="Copy Org ID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setProfileModalOpen(true);
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-left transition cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Profile Settings</span>
                  </button>

                  {hasUsersTabAccess && (
                    <button
                      onClick={() => {
                        setActiveTab('USERS');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-left transition cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Access Control</span>
                    </button>
                  )}

                  <div className="border-t border-slate-100 dark:border-slate-850 my-1"></div>

                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-left transition cursor-pointer font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* CLOUD DATA SYNC — real-time synchronization for all authenticated users */}
            {currentUser && (
              <AppwriteCloudSync
                currentLocalState={{
                  trucks,
                  drivers,
                  offices,
                  accounts,
                  trips,
                  expenses,
                  tyres,
                  auditLogs
                }}
                onLoadCloudState={onLoadCloudState}
                showNotification={showNotification}
                logAction={logAction}
                currentUserOrgId={currentUserOrgId}
                isAdmin={currentUserRights.isAdmin}
                onInitialSyncComplete={setInitialPullDone}
              />
            )}
            {currentUserRights.isAdmin && (
              <button
                id="btn-clear-data"
                onClick={triggerClearAllLocalData}
                title="Wipe all local database logs and start fresh"
                className="p-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1 font-medium shadow-2xs cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden lg:inline text-rose-500">Clear Data</span>
              </button>
            )}
            {currentUserRights.isAdmin && (
              <button
                id="btn-backup-download"
                onClick={handleTriggerDownloadBackup}
                title="Download Snapshot Backup File (.json)"
                className="p-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1 font-medium shadow-2xs cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden lg:inline">Backup</span>
              </button>
            )}
            {currentUserRights.isAdmin && (
              <label className="p-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1 font-medium shadow-2xs cursor-pointer shrink-0 select-none">
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden lg:inline">Restore</span>
                <input
                  id="file-restore-input"
                  type="file"
                  accept=".json"
                  onChange={handleUploadBackupChange}
                  className="hidden"
                />
              </label>
            )}

            {/* DIVIDER between admin tools and user controls */}
            {currentUserRights.isAdmin && (
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 self-center hidden sm:block" />
            )}

            {/* NEW ENTRY button */}
            {currentUserRights.canEditTrips && (
              <button
                id="btn-quick-post-trip"
                onClick={() => {
                  if (orgTrucks.length === 0 || orgOffices.length === 0) {
                    alert("Hold on! Register Trucks and Offices in their master sheets before booking cargo entries.");
                    return;
                  }
                  setEditingTrip(null);
                  setBookingModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Entry</span>
              </button>
            )}
          </div>
        </header>

        {/* Outer content container */}
        <div id="app-viewport-container" className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 space-y-6">

          {/* WARNING BAR IF MASTERS INACTIVE */}
          {!currentUserRights.isSuperAdmin && (orgTrucks.length === 0 || orgOffices.length === 0 || orgAccounts.length === 0) && (
            <div id="safety-warning-banner" className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-xs">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-amber-800">Prerequisites Required</p>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Before recording any transaction logs, ensure you register at least <strong>1 operational Truck</strong>, <strong>1 active branch Office</strong>, and <strong>1 receiving Account Ledger</strong>. Go to their respective master database tabs above to populate the datasheets first.
                </p>
              </div>
            </div>
          )}

          {/* TAB RENDERING CONTROLS */}
          {activeTab === 'DASHBOARD' && (
            <Dashboard
              trips={dashboardTrips}
              allTrips={orgTrips}
              trucks={approvedOrgTrucks}
              offices={orgOffices}
              accounts={orgAccounts}
              currentUserRights={currentUserRights}
              activeMonth={activeMonth}
              activeYear={activeYear}
              setActiveMonth={setActiveMonth}
              setActiveYear={setActiveYear}
              orgProfile={organizationProfiles.find(p => p.organizationId === currentUserOrgId)}
              expenses={orgExpenses}
              onAddExpense={addExpense}
            />
          )}

          {activeTab === 'TRIPS' && currentUserRights.canViewTrips && (
            <TripList
              trips={orgTrips}
              trucks={approvedOrgTrucks}
              offices={orgOffices}
              accounts={orgAccounts}
              onEditEntry={handleEditTripTrigger}
              onDeleteEntry={deleteTripEntry}
              confirmAction={confirmAction}
              canViewTrips={currentUserRights.canViewTrips}
              canEditTrips={currentUserRights.canEditTrips}
              canDeleteTrips={currentUserRights.canDeleteTrips}
              organizationId={currentUserOrgId}
              onSaveTrips={saveTrips}
            />
          )}

          {activeTab === 'TRUCKS' && currentUserRights.canViewTrucks && (
            <TruckMaster
              trucks={orgTrucks}
              trips={orgTrips}
              expenses={orgExpenses}
              onAddTruck={addTruck}
              onUpdateTruck={updateTruck}
              onDeleteTruck={deleteTruck}
              confirmAction={confirmAction}
              canViewTrucks={currentUserRights.canViewTrucks}
              canEditTrucks={currentUserRights.canEditTrucks}
              canDeleteTrucks={currentUserRights.canDeleteTrucks}
              maxTrucksAllowed={organizationProfiles.find(p => p.organizationId === currentUserOrgId)?.maxTrucksAllowed || 2}
              onAddTruckRequest={handleAddTruckRequest}
              organizationId={currentUserOrgId}
              orgProfile={organizationProfiles.find(p => p.organizationId === currentUserOrgId)}
              onServiceDone={(currentUserRights.canEditTrucks || currentUserRights.canEditExpenses) ? handleServiceDone : undefined}
              accounts={orgAccounts}
              drivers={orgDrivers}
              onAddExpense={addExpense}
              canEditLoans={currentUserRights.canEditLoans !== false}
              canDeleteLoans={currentUserRights.canDeleteLoans !== false}
              canEditExpenses={currentUserRights.canEditExpenses !== false}
            />
          )}

          {activeTab === 'OFFICES' && currentUserRights.canViewOffices && (
            <OfficeMaster
              offices={orgOffices}
              onAddOffice={addOffice}
              onUpdateOffice={updateOffice}
              onDeleteOffice={deleteOffice}
              confirmAction={confirmAction}
              canViewOffices={currentUserRights.canViewOffices}
              canEditOffices={currentUserRights.canEditOffices}
              canDeleteOffices={currentUserRights.canDeleteOffices}
            />
          )}

          {activeTab === 'ACCOUNTS' && currentUserRights.canViewAccounts && (
            <AccountMaster
              accounts={orgAccounts}
              onAddAccount={addAccount}
              onUpdateAccount={updateAccount}
              onDeleteAccount={deleteAccount}
              confirmAction={confirmAction}
              canViewAccounts={currentUserRights.canViewAccounts}
              canEditAccounts={currentUserRights.canEditAccounts}
              canDeleteAccounts={currentUserRights.canDeleteAccounts}
            />
          )}

          {activeTab === 'DRIVERS' && currentUserRights.canViewDrivers && (
            <DriverMaster
              drivers={orgDrivers}
              trips={orgTrips}
              expenses={orgExpenses}
              accounts={orgAccounts}
              onAddDriver={addDriver}
              onUpdateDriver={updateDriver}
              onDeleteDriver={deleteDriver}
              canViewDrivers={currentUserRights.canViewDrivers}
              canEditDrivers={currentUserRights.canEditDrivers}
              canDeleteDrivers={currentUserRights.canDeleteDrivers}
              organizationId={currentUserOrgId}
              orgProfile={organizationProfiles.find(p => p.organizationId === currentUserOrgId)}
            />
          )}

          {activeTab === 'EXPENSES' && currentUserRights.canViewExpenses && (
            <ExpenseMaster
              expenses={orgExpenses}
              trucks={approvedOrgTrucks}
              accounts={orgAccounts}
              drivers={orgDrivers}
              onAddExpense={addExpense}
              onUpdateExpense={updateExpense}
              onDeleteExpense={deleteExpense}
              canViewExpenses={currentUserRights.canViewExpenses}
              canEditExpenses={currentUserRights.canEditExpenses}
              canDeleteExpenses={currentUserRights.canDeleteExpenses}
              organizationId={currentUserOrgId}
            />
          )}

          {activeTab === 'REPORTS' && currentUserRights.canViewTrips && (
            <MonthlyReport
              trips={dashboardTrips}
              trucks={approvedOrgTrucks}
              expenses={dashboardExpenses}
              selectedMonth={activeMonth}
              selectedYear={activeYear}
              setSelectedMonth={setActiveMonth}
              setSelectedYear={setActiveYear}
            />
          )}

          {activeTab === 'AUDIT' && currentUserRights.isAdmin && (
            <AuditLogView
              logs={currentUserOrgId === 'org_backend' ? auditLogs : orgAuditLogs}
              onClearLogs={handleClearAuditLogs}
              confirmAction={confirmAction}
              organizationProfiles={organizationProfiles}
              currentUserOrgId={currentUserOrgId}
            />
          )}

          {activeTab === 'TYRES' && currentUserRights.canViewTyres && (
            <TyreMaster
              tyres={orgTyres}
              trucks={approvedOrgTrucks}
              accounts={orgAccounts}
              onAddTyre={addTyre}
              onUpdateTyre={updateTyre}
              onDeleteTyre={deleteTyre}
              confirmAction={confirmAction}
              canViewTyres={currentUserRights.canViewTyres}
              canEditTyres={currentUserRights.canEditTyres}
              canDeleteTyres={currentUserRights.canDeleteTyres}
              organizationId={currentUserOrgId}
            />
          )}

          {activeTab === 'BACKEND' && currentUserRights.isSuperAdmin && (
            <BackendDashboard
              organizationProfiles={organizationProfiles}
              userRightsList={userRightsList}
              trucks={trucks}
              onUpdateOrgStatus={handleUpdateOrgStatus}
              onUpdateOrgLimit={handleUpdateOrgLimit}
              onApproveTruckRequest={handleApproveTruckRequest}
              onRejectTruckRequest={handleRejectTruckRequest}
              onUpdateTruckDetails={handleBackendUpdateTruck}
              logAction={logAction}
              canEditBackend={currentUserRights.canEditBackend}
              canApproveBackend={currentUserRights.canApproveBackend}
              canAddBackend={currentUserRights.canAddBackend}
              canDeleteBackend={currentUserRights.canDeleteBackend}
              canViewBackend={currentUserRights.canViewBackend}
              canViewTruckRequests={currentUserRights.canViewTruckRequests}
              canViewDatabaseConsole={currentUserRights.canViewDatabaseConsole}
              canEditDatabaseConsole={currentUserRights.canEditDatabaseConsole}
              canDeleteDatabaseConsole={currentUserRights.canDeleteDatabaseConsole}
              drivers={drivers}
              offices={offices}
              accounts={accounts}
              trips={trips}
              expenses={expenses}
              tyres={tyres}
              auditLogs={auditLogs}
              onSaveTrucks={saveTrucks}
              onSaveDrivers={saveDrivers}
              onSaveOffices={saveOffices}
              onSaveAccounts={saveAccounts}
              onSaveTrips={saveTrips}
              onSaveExpenses={saveExpenses}
              onSaveTyres={saveTyres}
              onSaveAuditLogs={saveAuditLogs}
              onSaveUserRightsList={saveUserRightsListWithSync}
              onSaveOrganizationProfiles={saveOrganizationProfiles}
            />
          )}

          {activeTab === 'USERS' && hasUsersTabAccess && (
            <UserAccessControl
              permissions={orgUserRights}
              currentUserEmail={currentUser?.email}
              onAddPermission={handleAddPermission}
              onUpdatePermission={handleUpdatePermission}
              onDeletePermission={handleDeletePermission}
              confirmAction={confirmAction}
              showNotification={showNotification}
              currentUserOrgId={currentUserOrgId}
              teamMembers={teamMembers}
              loadingTeamMembers={loadingTeamMembers}
              canAddBackend={currentUserRights.canAddBackend}
              canEditBackend={currentUserRights.canEditBackend}
              canDeleteBackend={currentUserRights.canDeleteBackend}
              orgProfile={organizationProfiles.find(p => p.organizationId === currentUserOrgId)}
              onUpdateOrgProfile={handleUpdateOrgProfile}
            />
          )}

        </div>
      </main>

      {/* DYNAMIC FORM MODAL BINDERS */}
      <TripForm
        isOpen={bookingModalOpen}
        onClose={() => {
          setBookingModalOpen(false);
          setEditingTrip(null);
        }}
        trucks={approvedOrgTrucks}
        drivers={orgDrivers}
        offices={orgOffices}
        accounts={orgAccounts}
        existingTripNos={Array.from(new Set(orgTrips.map(t => t.tripNo).filter(Boolean)))}
        onSubmit={handlePostTripEntry}
        editingEntry={editingTrip}
        canViewDrivers={currentUserRights.canViewDrivers}
        orgProfile={organizationProfiles.find(p => p.organizationId === currentUserOrgId)}
        trips={orgTrips}
      />

      <VoiceAssistant
        isOpen={isVoiceAssistantOpen}
        onClose={() => setIsVoiceAssistantOpen(false)}
        trucks={approvedOrgTrucks}
        drivers={orgDrivers}
        offices={orgOffices}
        accounts={orgAccounts}
        existingTripNos={Array.from(new Set(orgTrips.map(t => t.tripNo).filter(Boolean)))}
        onSubmitTrip={handlePostTripEntry}
        onSubmitExpense={addExpense}
        voiceLang={userVoiceLang}
      />

      {profileModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl animate-fade-in text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Profile Settings</h3>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (newPassword && newPassword !== confirmPassword) {
                alert("New passwords do not match!");
                return;
              }
              const loginMethod = localStorage.getItem('ttt_login_method');
              if (loginMethod === 'appwrite' && newPassword && !oldPassword) {
                alert("Current password is required to change password in Appwrite.");
                return;
              }
              await handleUpdateProfile(
                profileName,
                currentUserRights.isAdmin ? profileOrgName : undefined,
                newPassword || undefined,
                oldPassword || undefined
              );
            }} className="space-y-4">
              {/* DISPLAY NAME */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* ORGANIZATION NAME */}
              {currentUserRights.isAdmin && currentUserRights.organizationId && currentUserRights.organizationId !== 'org_backend' && (
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">Organization Name</label>
                  <input
                    type="text"
                    value={profileOrgName}
                    onChange={(e) => setProfileOrgName(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              )}

              {/* EMAIL (READ-ONLY) */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Email Address (Read-only)</label>
                <input
                  type="email"
                  value={currentUser?.email || ''}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
                />
              </div>

              {/* VOICE ASSISTANT LANGUAGE */}
              <div>
                <label htmlFor="voice-lang-select" className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">Voice Assistant Language</label>
                <select
                  id="voice-lang-select"
                  value={profileVoiceLang}
                  onChange={(e) => setProfileVoiceLang(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                >
                  <option value="en-IN">English (India) - en-IN</option>
                  <option value="hi-IN">Hindi (हिन्दी) - hi-IN</option>
                  <option value="ta-IN">Tamil (தமிழ்) - ta-IN</option>
                  <option value="te-IN">Telugu (తెలుగు) - te-IN</option>
                  <option value="kn-IN">Kannada (ಕನ್ನಡ) - kn-IN</option>
                  <option value="mr-IN">Marathi (मराठी) - mr-IN</option>
                </select>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block mb-2 font-sans">Change Password</span>

                {localStorage.getItem('ttt_login_method') === 'appwrite' && (
                  <div className="mb-3">
                    <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">Current Password</label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5.5 flex justify-end gap-2.5 select-none pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer border border-slate-200/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-600/10 hover:shadow-blue-600/20 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl animate-fade-in text-left">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-bold text-slate-900 text-base">{confirmModal.title}</h3>
                <p className="text-slate-600 text-xs leading-relaxed font-medium">{confirmModal.message}</p>
              </div>
            </div>
            <div className="mt-5.5 flex justify-end gap-2.5 select-none">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer border border-slate-200/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-rose-600/10 hover:shadow-rose-600/20 cursor-pointer"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
