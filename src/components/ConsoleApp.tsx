import { createSignal, createEffect, lazy, Suspense, onMount, onCleanup, createMemo, untrack, batch } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { CheckCircle, AlertCircle, Loader } from 'lucide-solid';

import {
  Truck,
  TripEntry,
  ExpenseEntry,
  AuditLog,
  UserPermission,
  OrganizationProfile,
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
      if (loaded.trips) { setTrips(loaded.trips); didChange = true; }
      if (loaded.trucks) { setTrucks(loaded.trucks); didChange = true; }
      if (loaded.drivers) { setDrivers(loaded.drivers); didChange = true; }
      if (loaded.expenses) { setExpenses(loaded.expenses); didChange = true; }
      if (loaded.offices) { setOffices(loaded.offices); didChange = true; }
      if (loaded.accounts) { setAccounts(loaded.accounts); didChange = true; }
      if (loaded.tyres) { setTyres(loaded.tyres); didChange = true; }
      if (loaded.auditLogs) { setAuditLogs(loaded.auditLogs); didChange = true; }
      if (loaded.supportTickets) { setSupportTickets(loaded.supportTickets); didChange = true; }
    }
    if (globalConfig) {
      if (globalConfig.userRightsList) { setUserRightsList(globalConfig.userRightsList); didChange = true; }
      if (globalConfig.organizationProfiles) { setOrganizationProfiles(globalConfig.organizationProfiles); didChange = true; }
    }
    return didChange;
  };

  onMount(() => {
    const handleKeyUnlocked = async () => {
      console.log('[Encryption Key Entered] Key unlocked! Clearing existing memory/cache and fetching fresh dataset...');

      try {
        await Promise.all([
          db.trucks.clear(),
          db.drivers.clear(),
          db.offices.clear(),
          db.accounts.clear(),
          db.trips.clear(),
          db.expenses.clear(),
          db.tyres.clear(),
          db.auditLogs.clear(),
          db.supportTickets.clear(),
          db.organizationProfiles.clear(),
          db.syncMetadata.clear()
        ]);
      } catch (err) {
        console.warn('Dexie DB clear warning on key unlock:', err);
      }

      const cacheKeys = [
        'ttt_trucks',
        'ttt_drivers',
        'ttt_offices',
        'ttt_accounts',
        'ttt_trips',
        'ttt_expenses',
        'ttt_tyres',
        'fleet_audit_logs',
        'ttt_support_tickets',
        'appwrite_last_sync_time'
      ];
      cacheKeys.forEach(k => localStorage.removeItem(k));

      batch(() => {
        setTrucks([]);
        setDrivers([]);
        setOffices([]);
        setAccounts([]);
        setTrips([]);
        setExpenses([]);
        setTyres([]);
        setAuditLogs([]);
        setSupportTickets([]);
      });

      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const orgId = currentUserOrgId() || 'org_default';

          const emptyLocalState = {
            trucks: [],
            drivers: [],
            offices: [],
            accounts: [],
            trips: [],
            expenses: [],
            tyres: [],
            auditLogs: [],
            supportTickets: []
          };

          const controller = new AbortController();
          const res = await SyncService.pullFromDB(databaseId, orgId, emptyLocalState, false, controller.signal);

          if (res && res.loadedState) {
            onLoadCloudState(res.loadedState, res.userRightsData, true);
            console.log('[Encryption Key Entered] Fresh decrypted data fetched and loaded successfully!');
            showNotification('Encryption Key Entered: Memory wiped & fresh data updated.');
          }
        } catch (err) {
          console.warn('[Encryption Key Entered] Cloud fetch failed after key unlock:', err);
        }
      }
    };

    window.addEventListener('ttt:storage-unlocked', handleKeyUnlocked);
    onCleanup(() => window.removeEventListener('ttt:storage-unlocked', handleKeyUnlocked));
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

  // Reconcile pending trucks if approved in global profiles.
  createEffect(() => {
    const orgId = currentUserRights()?.organizationId;
    if (!orgId) return;
    if (!initialPullDone()) {
      console.log('Appwrite Auto-Sync: Blocking truck reconciliation until initial cloud sync completes.');
      return;
    }
    const currentOrgProfile = organizationProfiles().find(p => p.organizationId === orgId);
    if (!currentOrgProfile) return;

    const currentTrucks = untrack(() => [...trucks]);

    let trucksUpdated = false;
    const approvedTrucksToSave: Truck[] = [];
    const updatedTrucks = currentTrucks.map(truck => {
      if (truck.organizationId === orgId && truck.isApproved === false) {
        const approvedReq = (currentOrgProfile.truckRequests || []).find(
          r => r.truckNo === truck.truckNo && r.status === 'Approved'
        );
        if (approvedReq) {
          trucksUpdated = true;
          const updatedT = { ...truck, isApproved: true, status: 'Active' as const };
          approvedTrucksToSave.push(updatedT);
          return updatedT;
        }
      }
      return truck;
    });

    if (trucksUpdated) {
      const saveToBackendAndLocal = async () => {
        if (isAppwriteConfigured()) {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          try {
            for (const t of approvedTrucksToSave) {
              await appwrite.saveFleetDocument(databaseId, 'trucks', t.id, orgId, t);
            }
          } catch (err) {
            console.warn('Failed to sync newly approved trucks to Appwrite:', err);
          }
        }
        saveTrucks(updatedTrucks);
        approvedTrucksToSave.forEach(t => {
          logAction('Approved', 'Truck', t.truckNo, `Vehicle request approved. Active ledger established.`);
        });
      };
      saveToBackendAndLocal();
    }
  });

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
    <div class="h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans select-none selection:bg-blue-600/10 overflow-hidden">
      {toastMessage() && (
        <div id="toast-notify" class="fixed bottom-5 right-5 z-50 bg-blue-600 border border-blue-400/30 text-white p-3.5 px-6 rounded-xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <CheckCircle class="w-4 h-4 text-white" />
          <span class="text-xs font-semibold">{toastMessage()}</span>
        </div>
      )}

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
            currentLocalState={{
              trucks,
              drivers,
              offices,
              accounts,
              trips,
              expenses,
              tyres,
              auditLogs,
              supportTickets: supportTickets()
            }}
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
        currentUserRights={currentUserRights}
        organizationProfiles={organizationProfiles}
        profileModalOpen={profileModalOpen}
        setProfileModalOpen={setProfileModalOpen}
        profileActiveTab={profileActiveTab}
        setProfileActiveTab={setProfileActiveTab}
        getClientUnreadTicketsCount={getClientUnreadTicketsCount}
        handleUpdateProfile={handleUpdateProfile}
        setMobileWizardOpen={setMobileWizardOpen}
        setSetup2FAOpen={setSetup2FAOpen}
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
  );
}
