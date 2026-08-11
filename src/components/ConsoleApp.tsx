import { createSignal, createEffect, lazy, Suspense, onMount, onCleanup, createMemo, untrack, batch } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { CheckCircle, AlertCircle, Loader } from 'lucide-solid';

import {
  Truck,
  TripEntry,
  ExpenseEntry,
  AuditLog,
  SupportTicket,
  UserPermission,
  OrganizationProfile,
  Coupon,
  createRecord,
  mutateRecord
} from '../types';

import { useNavigation } from '../managers/NavigationManager';
import { useDialogs } from '../managers/DialogManager';
import { useSettings } from '../managers/SettingsManager';
import { useOrganizationManager } from '../managers/OrganizationManager';
import { useAuthManager } from '../managers/AuthManager';
import { useNotifications } from '../context/NotificationContext';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';
import ConnectionStatusBlocker from './ConnectionStatusBlocker';

import { TripProvider, useTripsContext } from '../context/TripContext';
import { TruckProvider, useTrucksContext } from '../context/TruckContext';
import { DriverProvider, useDriversContext } from '../context/DriverContext';
import { ExpenseProvider, useExpensesContext } from '../context/ExpenseContext';
import { OfficeProvider, useOfficesContext } from '../context/OfficeContext';
import { AccountProvider, useAccountsContext } from '../context/AccountContext';
import { TyreProvider, useTyresContext } from '../context/TyreContext';
import { AuditLogProvider, useAuditLogsContext } from '../context/AuditLogContext';

import { useTruckHandlers } from '../hooks/useTruckHandlers';
import { useSupportTicketsState } from '../hooks/useSupportTicketsState';
import { useBackendSync } from '../hooks/useBackendSync';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { useBackupRestore } from '../hooks/useBackupRestore';
import { useAppUpdate } from '../hooks/useAppUpdate';

import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { db } from '../services/cache';
import { SyncService } from '../services/SyncService';
import { reconcileById } from '../utils/reconcileUtils';
import logo from '../logo.png';
import versionData from '../version.json';
const APP_VERSION = versionData.version;

import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import DesktopViewport from './DesktopViewport';
import MobileViewport from './MobileViewport';
import AppwriteCloudSync from './AppwriteCloudSync';
import AppModals from './AppModals';

const LoadingTab = () => (
  <div class="flex items-center justify-center p-12 h-64">
    <Loader class="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

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

export function ConsoleAppWrapper() {
  return <ConsoleApp />;
}

export default function ConsoleApp() {
  const createReactiveArrayWrapper = <T,>(getter: () => T[]): T[] => {
    return new Proxy([] as any, {
      get(target, prop) {
        const arr = getter();
        if (prop === Symbol.iterator) {
          return arr[Symbol.iterator].bind(arr);
        }
        const val = Reflect.get(arr, prop);
        if (typeof val === 'function') {
          return val.bind(arr);
        }
        return val;
      }
    });
  };

  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve states/methods from Scoped Managers
  const nav = useNavigation();
  const dialogs = useDialogs();
  const settings = useSettings();
  const orgManager = useOrganizationManager();
  const authManager = useAuthManager();
  const notifications = useNotifications();

  const activeTab = nav.activeTab;
  const setActiveTab = nav.setActiveTab;
  const isMobileMenuOpen = nav.isMobileMenuOpen;
  const setIsMobileMenuOpen = nav.setIsMobileMenuOpen;
  const selectTab = nav.selectTab;
  const activeMonth = nav.activeMonth;
  const setActiveMonth = nav.setActiveMonth;
  const activeYear = nav.activeYear;
  const setActiveYear = nav.setActiveYear;
  const isMobile = nav.isMobile;
  const setIsMobile = nav.setIsMobile;
  const mobileTab = nav.mobileTab;
  const setMobileTab = nav.setMobileTab;
  const registrySubTab = nav.registrySubTab;
  const setRegistrySubTab = nav.setRegistrySubTab;
  const fabOpened = nav.fabOpened;
  const setFabOpened = nav.setFabOpened;
  const autoOpenFormTab = nav.autoOpenFormTab;
  const setAutoOpenFormTab = nav.setAutoOpenFormTab;
  const triggerOpenAddForm = nav.triggerOpenAddForm;

  const profileModalOpen = dialogs.profileModalOpen;
  const setProfileModalOpen = dialogs.setProfileModalOpen;
  const profileActiveTab = dialogs.profileActiveTab;
  const setProfileActiveTab = dialogs.setProfileActiveTab;
  const profileDropdownOpen = dialogs.profileDropdownOpen;
  const setProfileDropdownOpen = dialogs.setProfileDropdownOpen;
  const bookingModalOpen = dialogs.bookingModalOpen;
  const setBookingModalOpen = dialogs.setBookingModalOpen;
  const editingTrip = dialogs.editingTrip;
  const setEditingTrip = dialogs.setEditingTrip;
  const isVoiceAssistantOpen = dialogs.isVoiceAssistantOpen;
  const setIsVoiceAssistantOpen = dialogs.setIsVoiceAssistantOpen;
  const showPhoneUpdateModal = dialogs.showPhoneUpdateModal;
  const setShowPhoneUpdateModal = dialogs.setShowPhoneUpdateModal;

  const theme = settings.theme;
  const setTheme = settings.setTheme;
  const userVoiceLang = settings.userVoiceLang;
  const setUserVoiceLang = settings.setUserVoiceLang;
  const profileVoiceLang = settings.profileVoiceLang;
  const setProfileVoiceLang = settings.setProfileVoiceLang;

  const organizationProfiles = orgManager.organizationProfiles;
  const setOrganizationProfiles = orgManager.setOrganizationProfiles;
  const saveOrganizationProfiles = orgManager.saveOrganizationProfiles;
  const teamMembers = orgManager.teamMembers;
  const loadingTeamMembers = orgManager.loadingTeamMembers;
  const handleUpdateOrgProfile = orgManager.handleUpdateOrgProfile;
  const handleUpdateOrgStatus = orgManager.handleUpdateOrgStatus;
  const handleUpdateOrgLimit = orgManager.handleUpdateOrgLimit;
  const handleApproveTruckRequest = orgManager.handleApproveTruckRequest;
  const handleRejectTruckRequest = orgManager.handleRejectTruckRequest;
  const saveUserRightsListWithSync = orgManager.saveUserRightsListWithSync;
  const orgUserRights = orgManager.orgUserRights;
  const currentOrgProfileMemo = orgManager.currentOrgProfile;

  const verificationOtpSent = authManager.verificationOtpSent;
  const setVerificationOtpSent = authManager.setVerificationOtpSent;
  const whatsappOtpCode = authManager.whatsappOtpCode;
  const setWhatsappOtpCode = authManager.setWhatsappOtpCode;
  const whatsappOtpPhone = authManager.whatsappOtpPhone;
  const setWhatsappOtpPhone = authManager.setWhatsappOtpPhone;
  const emailVerificationSuccess = authManager.emailVerificationSuccess;
  const setEmailVerificationSuccess = authManager.setEmailVerificationSuccess;
  const emailVerificationError = authManager.emailVerificationError;
  const setEmailVerificationError = authManager.setEmailVerificationError;
  const handleLogout = authManager.handleLogout;
  const handleUpdateProfile = authManager.handleUpdateProfile;
  const checkUserApproval = authManager.checkUserApproval;
  const sendWhatsAppOTP = authManager.sendWhatsAppOTP;
  const handlePhoneUpdateSubmit = authManager.handlePhoneUpdateSubmit;
  const handleRegisterUserPermissions = authManager.handleRegisterUserPermissions;
  const handleRequestToJoinOrganization = authManager.handleRequestToJoinOrganization;
  const reconcileSession = authManager.reconcileSession;
  const emailTimer = authManager.emailTimer;
  const setEmailTimer = authManager.setEmailTimer;
  const phoneTimer = authManager.phoneTimer;
  const setPhoneTimer = authManager.setPhoneTimer;
  const mobileWizardTimer = authManager.mobileWizardTimer;
  const setMobileWizardTimer = authManager.setMobileWizardTimer;
  const mobileWizardOpen = authManager.mobileWizardOpen;
  const setMobileWizardOpen = authManager.setMobileWizardOpen;
  const mobileWizardStep = authManager.mobileWizardStep;
  const setMobileWizardStep = authManager.setMobileWizardStep;
  const mobileWizardCode = authManager.mobileWizardCode;
  const setMobileWizardCode = authManager.setMobileWizardCode;
  const mobileWizardNewPhone = authManager.mobileWizardNewPhone;
  const setMobileWizardNewPhone = authManager.setMobileWizardNewPhone;
  const mobileWizardPassword = authManager.mobileWizardPassword;
  const setMobileWizardPassword = authManager.setMobileWizardPassword;
  const mobileWizardError = authManager.mobileWizardError;
  const setMobileWizardError = authManager.setMobileWizardError;
  const mobileWizardGeneratedOtp = authManager.mobileWizardGeneratedOtp;
  const setMobileWizardGeneratedOtp = authManager.setMobileWizardGeneratedOtp;
  const setup2FAOpen = authManager.setup2FAOpen;
  const setSetup2FAOpen = authManager.setSetup2FAOpen;
  const setup2FASecret = authManager.setup2FASecret;
  const setSetup2FASecret = authManager.setSetup2FASecret;
  const disable2FAOpen = authManager.disable2FAOpen;
  const setDisable2FAOpen = authManager.setDisable2FAOpen;
  const resetPasswordState = authManager.resetPasswordState;
  const setResetPasswordState = authManager.setResetPasswordState;

  // Retrieve global states/methods from Contexts
  const perm = usePermissions();
  const userRightsList = perm.userRightsList;
  const setUserRightsList = perm.setUserRightsList;
  const currentUserRights = perm.currentUserRights;
  const handleAddPermission = perm.addPermission;
  const handleUpdatePermission = perm.updatePermission;
  const handleDeletePermission = perm.deletePermission;
  const pushPermissionsToCloud = perm.pushPermissions;

  const toastMessage = () => notifications.toastMessage();
  const showNotification = notifications.showNotification;
  const notificationOpen = () => notifications.notificationOpen();
  const setNotificationOpen = notifications.setNotificationOpen;
  const lastReadNotificationTime = () => notifications.lastReadNotificationTime();
  const updateLastReadNotificationTime = notifications.updateLastReadNotificationTime;
  const setNotificationRef = notifications.setNotificationRef;

  const auth = useAuth();
  const currentUser = auth.currentUser;
  const setCurrentUser = auth.setCurrentUser;
  const loadingUser = auth.loadingUser;
  const setLoadingUser = auth.setLoadingUser;
  const initialPullDone = auth.initialPullDone;
  const setInitialPullDone = auth.setInitialPullDone;
  const isOnline = auth.isOnline;
  const setIsOnline = auth.setIsOnline;
  const disconnectReason = auth.disconnectReason;
  const setDisconnectReason = auth.setDisconnectReason;
  const currentUserId = () => currentUser()?.$id || currentUser()?.email || 'system';

  const tripsCtx = useTripsContext();
  const trucksCtx = useTrucksContext();
  const driversCtx = useDriversContext();
  const expenseCtx = useExpensesContext();
  const officeCtx = useOfficesContext();
  const accountCtx = useAccountsContext();
  const tyreCtx = useTyresContext();

  const trips = createReactiveArrayWrapper(() => tripsCtx.trips);
  const orgTrips = createReactiveArrayWrapper(() => tripsCtx.orgTrips());

  const setTrips = tripsCtx.saveTrips;
  const setTrucks = trucksCtx.saveTrucks;
  const setDrivers = driversCtx.saveDrivers;
  const setExpenses = expenseCtx.saveExpenses;
  const setOffices = officeCtx.saveOffices;
  const setAccounts = accountCtx.saveAccounts;
  const setTyres = tyreCtx.saveTyres;
  const saveTrips = tripsCtx.saveTrips;
  const postTripEntry = tripsCtx.postTripEntry;
  const deleteTripEntry = tripsCtx.deleteTripEntry;

  const accounts = createReactiveArrayWrapper(() => accountCtx.accounts);
  const orgAccounts = createReactiveArrayWrapper(() => accountCtx.orgAccounts());
  const saveAccounts = accountCtx.saveAccounts;
  const addAccount = accountCtx.addAccount;
  const updateAccount = accountCtx.updateAccount;
  const deleteAccount = accountCtx.deleteAccount;

  const drivers = createReactiveArrayWrapper(() => driversCtx.drivers);
  const orgDrivers = createReactiveArrayWrapper(() => driversCtx.orgDrivers());
  const saveDrivers = driversCtx.saveDrivers;
  const addDriver = driversCtx.addDriver;
  const updateDriver = driversCtx.updateDriver;
  const deleteDriver = driversCtx.deleteDriver;

  const offices = createReactiveArrayWrapper(() => officeCtx.offices);
  const orgOffices = createReactiveArrayWrapper(() => officeCtx.orgOffices());
  const saveOffices = officeCtx.saveOffices;
  const addOffice = officeCtx.addOffice;
  const updateOffice = officeCtx.updateOffice;
  const deleteOffice = officeCtx.deleteOffice;

  const expenses = createReactiveArrayWrapper(() => expenseCtx.expenses);
  const orgExpenses = createReactiveArrayWrapper(() => expenseCtx.orgExpenses());
  const saveExpenses = expenseCtx.saveExpenses;
  const addExpense = expenseCtx.addExpense;
  const updateExpense = expenseCtx.updateExpense;
  const deleteExpense = expenseCtx.deleteExpense;

  const tyres = createReactiveArrayWrapper(() => tyreCtx.tyres);
  const orgTyres = createReactiveArrayWrapper(() => tyreCtx.orgTyres());
  const saveTyres = tyreCtx.saveTyres;
  const addTyre = tyreCtx.addTyre;
  const updateTyre = tyreCtx.updateTyre;
  const deleteTyre = tyreCtx.deleteTyre;

  const trucks = createReactiveArrayWrapper(() => trucksCtx.trucks);
  const orgTrucks = createReactiveArrayWrapper(() => trucksCtx.orgTrucks());
  const saveTrucks = trucksCtx.saveTrucks;
  const addTruck = trucksCtx.addTruck;
  const updateTruck = trucksCtx.updateTruck;
  const deleteTruck = trucksCtx.deleteTruck;

  let profileDropdownRef: HTMLDivElement | undefined;
  let prevTabIdxRef = 0;

  onMount(() => {
    console.log("App mounted");
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef && !profileDropdownRef.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  });

  // Payments State
  const [payments, setPayments] = createSignal<any[]>(
    (() => {
      try {
        const stored = localStorage.getItem('ttt_payments');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    })()
  );

  const savePayments = (nextPayments: any[]) => {
    setPayments(nextPayments);
    localStorage.setItem('ttt_payments', JSON.stringify(nextPayments));
  };

  // Coupons State
  const [coupons, setCoupons] = createSignal<Coupon[]>(
    (() => {
      try {
        const stored = localStorage.getItem('ttt_coupons');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    })()
  );

  const handleSaveCoupons = async (nextCoupons: Coupon[], cpnToSave?: Coupon, cpnIdToDelete?: string) => {
    setCoupons(nextCoupons);
    try {
      localStorage.setItem('ttt_coupons', JSON.stringify(nextCoupons));
    } catch (e) {}

    const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
    if (cpnIdToDelete) {
      try {
        await appwrite.deleteFleetDocument(databaseId, 'coupons', cpnIdToDelete);
      } catch (err: any) {
        console.warn('[Appwrite] Delete coupon cloud error:', err.message || err);
      }
    } else if (cpnToSave) {
      try {
        await appwrite.saveFleetDocument(
          databaseId,
          'coupons',
          cpnToSave.id,
          cpnToSave.organizationId || 'org_backend',
          cpnToSave
        );
      } catch (err: any) {
        console.warn('[Appwrite] Save coupon cloud error:', err.message || err);
      }
    } else {
      for (const cpn of nextCoupons) {
        try {
          await appwrite.saveFleetDocument(
            databaseId,
            'coupons',
            cpn.id,
            cpn.organizationId || 'org_backend',
            cpn
          );
        } catch (err: any) {}
      }
    }
  };

  const currentUserOrgId = createMemo(() => currentUserRights()?.organizationId || '');
  const hasUsersTabAccess = createMemo(() => currentUserOrgId() === 'org_backend' ? !!currentUserRights().canViewBackendTeam : !!currentUserRights().isAdmin);

  // Live Appwrite team membership list (fetched when admin opens USERS tab)
  const [teamMembersList, setTeamMembersList] = createSignal<any[]>([]);

  // Fetch live Appwrite memberships
  createEffect(() => {
    if (activeTab() === 'USERS' && hasUsersTabAccess() && currentUserOrgId() && isAppwriteConfigured()) {
      orgManager.teamMembers();
    }
  });

  // Redirect restricted tabs
  createEffect(() => {
    if (userRightsList().length === 0) return;
    const isBackendUser = !!(currentUserRights().isSuperAdmin || currentUserOrgId() === 'org_backend');
    const fallbackTab = isBackendUser ? 'BACKEND' : 'DASHBOARD';
    if (activeTab() === 'USERS' && !hasUsersTabAccess()) {
      setActiveTab(fallbackTab);
    } else if (activeTab() === 'BACKEND' && !isBackendUser) {
      setActiveTab(fallbackTab);
    } else if (activeTab() === 'DASHBOARD' && currentUserRights().isSuperAdmin) {
      setActiveTab(fallbackTab);
    } else if (activeTab() === 'TRIPS' && !currentUserRights().canViewTrips) {
      setActiveTab(fallbackTab);
    } else if (activeTab() === 'TRUCKS' && !currentUserRights().canViewTrucks) {
      setActiveTab(fallbackTab);
    } else if (activeTab() === 'OFFICES' && !currentUserRights().canViewOffices) {
      setActiveTab(fallbackTab);
    } else if (activeTab() === 'ACCOUNTS' && !currentUserRights().canViewAccounts) {
      setActiveTab(fallbackTab);
    } else if (activeTab() === 'DRIVERS' && !currentUserRights().canViewDrivers) {
      setActiveTab(fallbackTab);
    } else if (activeTab() === 'EXPENSES' && !currentUserRights().canViewExpenses) {
      setActiveTab(fallbackTab);
    } else if (activeTab() === 'REPORTS' && !currentUserRights().canViewTrips) {
      setActiveTab(fallbackTab);
    } else if (activeTab() === 'AUDIT' && !currentUserRights().isAdmin) {
      setActiveTab(fallbackTab);
    } else if (activeTab() === 'TYRES' && !currentUserRights().canViewTyres) {
      setActiveTab(fallbackTab);
    } else if (activeTab() === 'BILLING' && !(currentUserRights().isAdmin || currentUserRights().isSuperAdmin || currentUserOrgId() === 'org_backend')) {
      setActiveTab(fallbackTab);
    }
  });

  // Retrieve audit log context
  const auditLogsCtx = useAuditLogsContext();
  const auditLogs = createReactiveArrayWrapper<any>(() => auditLogsCtx.auditLogs);
  const orgAuditLogs = createReactiveArrayWrapper(() => auditLogsCtx.orgAuditLogs());
  const setAuditLogs = auditLogsCtx.saveAuditLogs;
  const logAction = auditLogsCtx.logAction;
  const handleClearAuditLogs = auditLogsCtx.handleClearAuditLogs;

  const cyanCount = createMemo(() => {
    if (currentUserRights()?.isAdmin) {
      return orgTrucks.filter(t => t.isApproved === false).length;
    }
    return orgTrips.filter(t => t.status === 'In Progress').length;
  });

  const getUserInitials = (user: any) => {
    if (!user) return 'U';
    const name = user.name || user.email || '';
    return name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const touchLastModified = () => {
    if (currentUserOrgId() !== 'org_backend') {
      localStorage.setItem('ttt_last_modified_at', Date.now().toString());
    }
    sessionStorage.setItem('ttt_recent_action_at', Date.now().toString());
  };

  const {
    handleVerifyPhonePePayment,
    handleBackendUpdateTruck,
    handleAddTruckRequest,
    handleProcessTruckPayment
  } = useTruckHandlers(
    trucks,
    setTrucks,
    orgTrucks,
    organizationProfiles,
    saveOrganizationProfiles,
    orgAccounts,
    addExpense,
    payments,
    savePayments,
    currentUserOrgId,
    currentUser,
    currentUserRights,
    currentUserId,
    touchLastModified,
    logAction,
    showNotification
  );

  const {
    supportTickets,
    setSupportTickets,
    activeTicketId,
    setActiveTicketId,
    saveSupportTickets,
    handleCreateSupportTicket,
    handleSendSupportTicketMessage,
    handleInitiateRefund,
    getClientUnreadTicketsCount,
    getAgentUnreadTicketsCount
  } = useSupportTicketsState(
    currentUserOrgId,
    currentUser,
    currentUserRights,
    userRightsList,
    currentUserId,
    showNotification,
    logAction,
    payments,
    savePayments,
    trucks,
    setTrucks
  );

  const hasUnreadNotifications = () => getClientUnreadTicketsCount() > 0 || getAgentUnreadTicketsCount() > 0;

  const { appUpdateConfig, handleSaveAppUpdateConfig } = useAppUpdate(APP_VERSION);

  const [isSyncing, setIsSyncing] = createSignal(false);
  const [lastSyncTime, setLastSyncTime] = createSignal(
    Number(localStorage.getItem('appwrite_last_sync_time') || '0')
  );
  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      if (isAppwriteConfigured()) {
        await appwrite.flushSyncQueue(showNotification);
        setLastSyncTime(Date.now());
        localStorage.setItem('appwrite_last_sync_time', Date.now().toString());
        showNotification("Cloud synchronization complete.");
      }
    } catch (err) {
      console.warn("Manual sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useBackendSync(
    currentUser,
    currentUserOrgId,
    currentUserRights,
    setTrucks,
    setTrips,
    setDrivers,
    setOffices,
    setAccounts,
    setExpenses,
    setTyres,
    setAuditLogs,
    setSupportTickets,
    userRightsList,
    setUserRightsList,
    organizationProfiles,
    setOrganizationProfiles
  );

  const onLoadCloudState = (loaded: any, globalConfig: any, quiet = false) => {
    let didChange = false;
    if (loaded) {
      if (loaded.trips) { setTrips((prev: any) => reconcileById(prev || [], loaded.trips, 'trips:cloudSync')); didChange = true; }
      if (loaded.trucks) { setTrucks((prev: any) => reconcileById(prev || [], loaded.trucks, 'trucks:cloudSync')); didChange = true; }
      if (loaded.drivers) { setDrivers((prev: any) => reconcileById(prev || [], loaded.drivers, 'drivers:cloudSync')); didChange = true; }
      if (loaded.expenses) { setExpenses((prev: any) => reconcileById(prev || [], loaded.expenses, 'expenses:cloudSync')); didChange = true; }
      if (loaded.offices) { setOffices((prev: any) => reconcileById(prev || [], loaded.offices, 'offices:cloudSync')); didChange = true; }
      if (loaded.accounts) { setAccounts((prev: any) => reconcileById(prev || [], loaded.accounts, 'accounts:cloudSync')); didChange = true; }
      if (loaded.tyres) { setTyres((prev: any) => reconcileById(prev || [], loaded.tyres, 'tyres:cloudSync')); didChange = true; }
      if (loaded.auditLogs) { setAuditLogs(reconcileById(auditLogsCtx.auditLogs, loaded.auditLogs, 'auditLogs:cloudSync')); didChange = true; }
      if (loaded.supportTickets) { setSupportTickets((prev: any) => reconcileById(prev || [], loaded.supportTickets, 'supportTickets:cloudSync') as SupportTicket[]); didChange = true; }
      if (loaded.coupons) { setCoupons((prev: any) => reconcileById(prev || [], loaded.coupons, 'coupons:cloudSync') as Coupon[]); didChange = true; }
    }
    if (globalConfig) {
      if (globalConfig.userRightsList) { setUserRightsList(globalConfig.userRightsList); didChange = true; }
      if (globalConfig.organizationProfiles) { setOrganizationProfiles(globalConfig.organizationProfiles); didChange = true; }
    }
    return didChange;
  };

  onMount(() => {
    (window as any)._onConsoleCloudStateLoaded = onLoadCloudState;
    const handleKeyUnlocked = async () => {
      console.log('[Encryption Key Entered] Key unlocked! Enabling decrypted access and checking for incremental cloud updates...');

      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const orgId = currentUserOrgId() || 'org_default';
          const currentState = {
            trucks: trucksCtx.trucks,
            drivers: driversCtx.drivers,
            offices: officeCtx.offices,
            accounts: accountCtx.accounts,
            trips: tripsCtx.trips,
            expenses: expenseCtx.expenses,
            tyres: tyreCtx.tyres,
            auditLogs: auditLogsCtx.auditLogs,
            supportTickets: supportTickets()
          };

          const res = await SyncService.pullFromDB(databaseId, orgId, currentState, true);

          if (res && res.loadedState) {
            onLoadCloudState(res.loadedState, res.userRightsData, true);
            console.log('[Encryption Key Entered] Decrypted access enabled and incremental updates applied!');
            showNotification('Encryption key entered: Decrypted access enabled.');
          }
        } catch (err) {
          console.warn('[Encryption Key Entered] Incremental sync check failed after key unlock:', err);
        }
      }
    };

    window.addEventListener('ttt:storage-unlocked', handleKeyUnlocked);
    onCleanup(() => {
      window.removeEventListener('ttt:storage-unlocked', handleKeyUnlocked);
      delete (window as any)._onConsoleCloudStateLoaded;
    });
  });

  const {
    confirmAction,
    confirmModal,
    setConfirmModal
  } = useConfirmAction();

  const handleServiceDone = async (opts: {
    truckId: string;
    truckNo: string;
    serviceType: string;
    serviceDate: string;
    notes: string;
    currentKM: number;
    newMilestoneKM: number;
    partsExpense?: any;
    labourExpense?: any;
    kmField?: any;
  }) => {
    const { truckId, truckNo, serviceType, serviceDate, notes, currentKM, newMilestoneKM, partsExpense, labourExpense, kmField } = opts;
    const orgId = currentUserOrgId() || 'org_default';
    const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
    const newExpenses = [];

    if (partsExpense) {
      const partsExp = createRecord<ExpenseEntry>({
        id: 'exp_svc_parts_' + Date.now(),
        truckNo,
        expenseType: `Service - ${serviceType} (Parts)`,
        shopName: partsExpense.shopName,
        amount: partsExpense.amount,
        paymentMode: partsExpense.paymentMode,
        accountType: partsExpense.accountType,
        driverName: partsExpense.driverName,
        status: partsExpense.status,
        date: serviceDate,
        notes: notes,
        organizationId: orgId,
      }, currentUserId());
      newExpenses.push(partsExp);
    }

    if (labourExpense) {
      const labourExp = createRecord<ExpenseEntry>({
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
      }, currentUserId());
      newExpenses.push(labourExp);
    }

    if (newExpenses.length > 0) {
      const nextExpenses = [...expenses, ...newExpenses];
      saveExpenses(nextExpenses);
      if (isAppwriteConfigured()) {
        const saveToAppwrite = async () => {
          try {
            for (const exp of newExpenses) {
              await appwrite.saveFleetDocument(databaseId, 'expenses', exp.id, orgId, exp);
            }
          } catch (err) {
            console.warn('Failed to save service expenses to Appwrite:', err);
          }
        };
        saveToAppwrite();
      }
      newExpenses.forEach(exp => {
        logAction('Created', 'Expense', exp.truckNo, `Service Done — ₹${exp.amount.toLocaleString()} ${exp.expenseType} at ${exp.shopName}`);
      });
    }

    if (kmField) {
      const truck = trucks.find(t => t.id === truckId);
      if (truck) {
        const updatedTruck = mutateRecord(truck, { [kmField]: newMilestoneKM }, currentUserId());
        const next = trucks.map(t => t.id === truckId ? updatedTruck : t);
        saveTrucks(next);
        if (isAppwriteConfigured()) {
          const syncTruck = async () => {
            try {
              await appwrite.saveFleetDocument(databaseId, 'trucks', truckId, orgId, updatedTruck);
            } catch (err) {
              console.warn('Failed to sync service-updated truck to Appwrite:', err);
            }
          };
          syncTruck();
        }
        logAction('Edited', 'Truck', truckNo, `Service Done: ${serviceType} — next due set to ${newMilestoneKM.toLocaleString()} KM${notes ? ` (Note: ${notes})` : ''}`);
      }
    }
  };

  const {
    handleTriggerDownloadBackup,
    handleUploadBackupChange,
    triggerClearAllLocalData
  } = useBackupRestore({
    showNotification,
    setTrucks,
    setDrivers,
    setOffices,
    setAccounts,
    setTrips,
    setExpenses,
    setTyres,
    setAuditLogs,
    setUserRightsList,
    setOrganizationProfiles,
    logAction
  });

  const approvedOrgTrucks = createReactiveArrayWrapper(createMemo<Truck[]>(() => orgTrucks.filter(t => t.isApproved !== false)));

  const currentOrgProfile = new Proxy({} as any, {
    get(target, prop) {
      const p = currentOrgProfileMemo();
      if (!p) return undefined;
      return Reflect.get(p, prop);
    }
  });

  const dashboardTrips = createMemo<TripEntry[]>(() => {
    const orgId = currentUserOrgId() || 'org_default';
    const activeTrips = (orgId === 'org_backend' ? trips : trips.filter(t => t.organizationId === orgId))
      .filter(t => !t.deletedAt);
    const year = activeYear();
    const month = activeMonth();
    return year === 'All Time'
      ? activeTrips
      : activeTrips.filter((t: any) => t.startDate && t.startDate.startsWith(`${year}-${month}`));
  });

  const dashboardExpenses = createMemo<ExpenseEntry[]>(() => {
    const orgId = currentUserOrgId() || 'org_default';
    const activeExpenses = (orgId === 'org_backend' ? expenses : expenses.filter(e => e.organizationId === orgId))
      .filter(e => !e.deletedAt);
    const year = activeYear();
    const month = activeMonth();
    return year === 'All Time'
      ? activeExpenses
      : activeExpenses.filter((e: any) => e.date && e.date.startsWith(`${year}-${month}`) && e.status !== 'Declined');
  });

  // Database records serve directly as single source of truth

  const handleEditTripTrigger = (entry: TripEntry) => {
    setEditingTrip(entry);
    setBookingModalOpen(true);
  };

  const handleCyanClick = () => {
    if (currentUserRights().isAdmin) {
      setActiveTab('USERS');
    } else {
      setActiveTab('TRIPS');
    }
  };

  const tabsList = ['TRUCKS', 'DRIVERS', 'EXPENSES', 'OUTSTANDING', 'REPORTS', 'TYRES', 'OFFICES', 'ACCOUNTS', 'AUDIT'];
  const currentTabIdx = tabsList.indexOf(registrySubTab());
  const isSlideRight = currentTabIdx > prevTabIdxRef;
  prevTabIdxRef = currentTabIdx;
  const slideClassName = isSlideRight ? 'animate-slide-in-right' : 'animate-slide-in-left';

  const isBackendTeam = currentUserOrgId() === 'org_backend' || currentUserRights().isSuperAdmin;

  return (
    <div class="h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none selection:bg-blue-600/10 overflow-hidden">
      {/* TOP ANNOUNCEMENT BANNER */}
      <div class="w-full bg-slate-900 dark:bg-slate-950 text-slate-300 text-xs md:text-sm font-medium py-1.5 px-4 text-center border-b border-slate-800 tracking-wide select-none shrink-0 z-50">
        This Site in Beta test mode - the database maybe deleted once site on live
      </div>

      <div class="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

      <AppSidebar
        logo={logo}
        isMobileMenuOpen={isMobileMenuOpen()}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        activeTab={activeTab()}
        selectTab={selectTab}
        currentUserRights={currentUserRights()}
        hasUsersTabAccess={hasUsersTabAccess()}
        isBackendTeam={isBackendTeam}
        getClientUnreadTicketsCount={getClientUnreadTicketsCount}
        getAgentUnreadTicketsCount={getAgentUnreadTicketsCount}
        currentUser={currentUser()}
        currentUserOrgId={currentUserOrgId()}
        showNotification={showNotification}
        handleLogout={handleLogout}
        setProfileActiveTab={setProfileActiveTab}
        setProfileModalOpen={setProfileModalOpen}
      />

      <main class="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden">
        <AppHeader
          activeTab={activeTab()}
          orgTrips={orgTrips}
          orgTrucks={orgTrucks}
          orgOffices={orgOffices}
          orgAccounts={orgAccounts}
          orgDrivers={orgDrivers}
          orgExpenses={orgExpenses}
          orgTyres={orgTyres}
          orgAuditLogs={orgAuditLogs}
          currentUserRights={currentUserRights()}
          currentUserOrgId={currentUserOrgId()}
          currentUser={currentUser()}
          cyanCount={cyanCount()}
          theme={theme()}
          setTheme={setTheme}
          handleCyanClick={handleCyanClick}
          notificationOpen={notificationOpen()}
          setNotificationOpen={setNotificationOpen}
          profileDropdownOpen={profileDropdownOpen()}
          setProfileDropdownOpen={setProfileDropdownOpen}
          notificationRef={setNotificationRef}
          profileDropdownRef={(el) => { profileDropdownRef = el; }}
          hasUnreadNotifications={hasUnreadNotifications()}
          updateLastReadNotificationTime={updateLastReadNotificationTime}
          showNotification={showNotification}
          getUserInitials={getUserInitials}
          isBackendTeam={isBackendTeam}
          hasUsersTabAccess={hasUsersTabAccess()}
          setProfileActiveTab={setProfileActiveTab}
          setProfileModalOpen={setProfileModalOpen}
          setActiveTab={selectTab}
          handleLogout={handleLogout}
          triggerClearAllLocalData={triggerClearAllLocalData}
          handleTriggerDownloadBackup={handleTriggerDownloadBackup}
          handleUploadBackupChange={handleUploadBackupChange}
          setEditingTrip={setEditingTrip}
          setBookingModalOpen={setBookingModalOpen}
          setIsVoiceAssistantOpen={setIsVoiceAssistantOpen}
          onLoadCloudState={(state) => onLoadCloudState(state, null)}
          supportTickets={supportTickets()}
          activeTicketId={activeTicketId()}
          setInitialPullDone={setInitialPullDone}
          setIsOnline={setIsOnline}
          setDisconnectReason={setDisconnectReason}
          trucks={trucks}
          drivers={orgDrivers}
          offices={orgOffices}
          accounts={orgAccounts}
          trips={orgTrips}
          expenses={orgExpenses}
          tyres={orgTyres}
          auditLogs={orgAuditLogs}
          logAction={logAction}
        />

        <div class="flex-1 overflow-y-auto min-h-0 relative">
          <AppwriteCloudSync
            currentLocalState={() => ({
              trucks,
              drivers,
              offices,
              accounts,
              trips,
              expenses,
              tyres,
              auditLogs,
              supportTickets: supportTickets()
            })}
            onLoadCloudState={onLoadCloudState}
            showNotification={showNotification}
            logAction={logAction}
            currentUserOrgId={currentUserOrgId}
            currentUserEmail={() => currentUser()?.email || ''}
            currentUserId={() => currentUser()?.email || ''}
            isAdmin={() => !!currentUserRights()?.isAdmin}
            onInitialSyncComplete={setInitialPullDone}
            onConnectionChange={(online, reason) => {
              setIsOnline(online);
              setDisconnectReason(reason);
            }}
            activeTicketId={activeTicketId}
            hideUI={true}
          />

          <Suspense fallback={<LoadingTab />}>
            {isMobile() ? (
              <MobileViewport
                logo={logo}
                toastMessage={toastMessage}
                notificationOpen={notificationOpen}
                setNotificationOpen={setNotificationOpen}
                setProfileDropdownOpen={setProfileDropdownOpen}
                updateLastReadNotificationTime={updateLastReadNotificationTime}
                currentUser={currentUser}
                hasUnreadNotifications={hasUnreadNotifications}
                orgAuditLogs={orgAuditLogs}
                currentUserRights={currentUserRights}
                currentUserOrgId={currentUserOrgId()}
                mobileTab={mobileTab}
                setMobileTab={setMobileTab}
                registrySubTab={registrySubTab}
                setRegistrySubTab={setRegistrySubTab}
                orgTrips={orgTrips}
                orgTrucks={orgTrucks}
                orgDrivers={orgDrivers}
                approvedOrgTrucks={approvedOrgTrucks}
                orgOffices={orgOffices}
                orgAccounts={orgAccounts}
                currentOrgProfile={currentOrgProfileMemo()}
                orgExpenses={orgExpenses}
                orgTyres={orgTyres}
                auditLogs={auditLogs}
                handleClearAuditLogs={handleClearAuditLogs}
                confirmAction={confirmAction}
                organizationProfiles={organizationProfiles}
                addTruck={addTruck}
                updateTruck={updateTruck}
                deleteTruck={deleteTruck}
                handleAddTruckRequest={handleAddTruckRequest}
                handleServiceDone={handleServiceDone}
                addExpense={addExpense}
                handleProcessTruckPayment={handleProcessTruckPayment}
                addDriver={addDriver}
                updateDriver={updateDriver}
                deleteDriver={deleteDriver}
                saveTrips={saveTrips}
                updateExpense={updateExpense}
                deleteExpense={deleteExpense}
                addTyre={addTyre}
                updateTyre={updateTyre}
                deleteTyre={deleteTyre}
                addOffice={addOffice}
                updateOffice={updateOffice}
                deleteOffice={deleteOffice}
                addAccount={addAccount}
                updateAccount={updateAccount}
                deleteAccount={deleteAccount}
                theme={theme}
                setTheme={setTheme}
                isOnline={isOnline()}
                handleLogout={handleLogout}
                setProfileActiveTab={setProfileActiveTab}
                setProfileModalOpen={setProfileModalOpen}
                setSetup2FAOpen={setSetup2FAOpen}
                setDisable2FAOpen={setDisable2FAOpen}
                getClientUnreadTicketsCount={getClientUnreadTicketsCount}
                showNotification={showNotification}
                appVersion={APP_VERSION}
                setEditingTrip={setEditingTrip}
                setBookingModalOpen={setBookingModalOpen}
                setIsVoiceAssistantOpen={setIsVoiceAssistantOpen}
                setNotificationRef={setNotificationRef}
                dashboardTrips={dashboardTrips}
                dashboardExpenses={dashboardExpenses}
                activeMonth={activeMonth}
                activeYear={activeYear}
                setActiveMonth={setActiveMonth}
                setActiveYear={setActiveYear}
                handleEditTripTrigger={handleEditTripTrigger}
                deleteTripEntry={deleteTripEntry}
              />
            ) : (
              <DesktopViewport
                activeTab={activeTab}
                currentUserRights={currentUserRights}
                currentUserOrgId={currentUserOrgId()}
                currentUser={currentUser}
                currentOrgProfile={currentOrgProfileMemo()}
                orgTrips={orgTrips}
                orgTrucks={orgTrucks}
                orgOffices={orgOffices}
                orgAccounts={orgAccounts}
                approvedOrgTrucks={approvedOrgTrucks}
                orgDrivers={orgDrivers}
                orgExpenses={orgExpenses}
                orgTyres={orgTyres}
                auditLogs={() => auditLogs}
                handleClearAuditLogs={handleClearAuditLogs}
                confirmAction={confirmAction}
                organizationProfiles={organizationProfiles}
                userRightsList={userRightsList}
                supportTickets={supportTickets}
                activeTicketId={activeTicketId}
                payments={payments}
                appUpdateConfig={appUpdateConfig}
                handleUpdateOrgStatus={handleUpdateOrgStatus}
                handleUpdateOrgLimit={handleUpdateOrgLimit}
                handleApproveTruckRequest={handleApproveTruckRequest}
                handleRejectTruckRequest={handleRejectTruckRequest}
                handleBackendUpdateTruck={handleBackendUpdateTruck}
                saveTrucks={saveTrucks}
                saveDrivers={saveDrivers}
                saveOffices={saveOffices}
                saveAccounts={saveAccounts}
                saveExpenses={saveExpenses}
                saveTyres={saveTyres}
                saveAuditLogs={setAuditLogs}
                saveUserRightsListWithSync={saveUserRightsListWithSync}
                saveOrganizationProfiles={saveOrganizationProfiles}
                saveSupportTickets={saveSupportTickets}
                setActiveTicketId={setActiveTicketId}
                handleInitiateRefund={handleInitiateRefund}
                handleSaveAppUpdateConfig={handleSaveAppUpdateConfig}
                coupons={coupons}
                handleSaveCoupons={handleSaveCoupons}
                orgUserRights={orgUserRights}
                handleAddPermission={handleAddPermission}
                handleUpdatePermission={handleUpdatePermission}
                handleDeletePermission={handleDeletePermission}
                teamMembers={teamMembers}
                loadingTeamMembers={loadingTeamMembers}
                handleUpdateOrgProfile={handleUpdateOrgProfile}
                hasUsersTabAccess={hasUsersTabAccess()}
                addTruck={addTruck}
                updateTruck={updateTruck}
                deleteTruck={deleteTruck}
                handleAddTruckRequest={handleAddTruckRequest}
                handleServiceDone={handleServiceDone}
                addExpense={addExpense}
                handleProcessTruckPayment={handleProcessTruckPayment}
                addDriver={addDriver}
                updateDriver={updateDriver}
                deleteDriver={deleteDriver}
                saveTrips={saveTrips}
                updateExpense={updateExpense}
                deleteExpense={deleteExpense}
                addTyre={addTyre}
                updateTyre={updateTyre}
                deleteTyre={deleteTyre}
                addOffice={addOffice}
                updateOffice={updateOffice}
                deleteOffice={deleteOffice}
                addAccount={addAccount}
                updateAccount={updateAccount}
                deleteAccount={deleteAccount}
                showNotification={showNotification}
                dashboardTrips={dashboardTrips}
                dashboardExpenses={dashboardExpenses}
                activeMonth={activeMonth}
                activeYear={activeYear}
                setActiveMonth={setActiveMonth}
                setActiveYear={setActiveYear}
                handleEditTripTrigger={handleEditTripTrigger}
                deleteTripEntry={deleteTripEntry}
                orgAuditLogs={orgAuditLogs}
              />
            )}
          </Suspense>
        </div>
      </main>

      <AppModals
        isBackendTeam={isBackendTeam}
        currentUser={currentUser}
        currentUserRights={currentUserRights as any}
        organizationProfiles={organizationProfiles}
        profileModalOpen={profileModalOpen}
        setProfileModalOpen={setProfileModalOpen}
        profileActiveTab={profileActiveTab}
        setProfileActiveTab={setProfileActiveTab}
        getClientUnreadTicketsCount={getClientUnreadTicketsCount}
        handleUpdateProfile={handleUpdateProfile}
        setMobileWizardOpen={setMobileWizardOpen}
        setSetup2FAOpen={(open: boolean) => {
          if (open) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
            let secret = '';
            for (let i = 0; i < 16; i++) {
              secret += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            setSetup2FASecret(secret);
          }
          setSetup2FAOpen(open);
        }}
        setDisable2FAOpen={setDisable2FAOpen}
        supportTickets={supportTickets}
        currentUserOrgId={currentUserOrgId()}
        handleCreateSupportTicket={handleCreateSupportTicket}
        handleSendSupportTicketMessage={handleSendSupportTicketMessage}
        payments={payments}
        mobileWizardOpen={mobileWizardOpen}
        mobileWizardStep={mobileWizardStep}
        setMobileWizardStep={setMobileWizardStep}
        mobileWizardCode={mobileWizardCode}
        setMobileWizardCode={setMobileWizardCode}
        mobileWizardNewPhone={mobileWizardNewPhone}
        setMobileWizardNewPhone={setMobileWizardNewPhone}
        mobileWizardPassword={mobileWizardPassword}
        setMobileWizardPassword={setMobileWizardPassword}
        mobileWizardError={mobileWizardError}
        setMobileWizardError={setMobileWizardError}
        mobileWizardGeneratedOtp={mobileWizardGeneratedOtp}
        setMobileWizardGeneratedOtp={setMobileWizardGeneratedOtp}
        mobileWizardTimer={mobileWizardTimer}
        setMobileWizardTimer={setMobileWizardTimer}
        sendWhatsAppOTP={sendWhatsAppOTP}
        userRightsList={userRightsList}
        setUserRightsList={setUserRightsList}
        pushPermissionsToCloud={pushPermissionsToCloud}
        reconcileSession={reconcileSession}
        setCurrentUser={setCurrentUser}
        showNotification={showNotification}
        setup2FAOpen={setup2FAOpen}
        setup2FASecret={setup2FASecret}
        disable2FAOpen={disable2FAOpen}
        confirmModal={confirmModal}
        setConfirmModal={setConfirmModal}
        bookingModalOpen={bookingModalOpen}
        setBookingModalOpen={setBookingModalOpen}
        setEditingTrip={setEditingTrip}
        editingTrip={editingTrip}
        currentOrgProfile={currentOrgProfileMemo()}
        confirmAction={confirmAction}
        isVoiceAssistantOpen={isVoiceAssistantOpen}
        setIsVoiceAssistantOpen={setIsVoiceAssistantOpen}
        userVoiceLang={userVoiceLang}
      />

      {!isOnline() && (
        <ConnectionStatusBlocker reason={disconnectReason()} />
      )}
      </div>
    </div>
  );
}
