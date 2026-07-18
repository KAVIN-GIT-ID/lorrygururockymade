import { createSignal, createEffect, lazy, Suspense, onMount, onCleanup, createMemo, untrack, batch } from 'solid-js';

import { Truck, TripEntry, ExpenseEntry, AuditLog, UserPermission, OrganizationProfile, TruckRequest, createRecord, mutateRecord, SupportTicket } from './types';
import LoginScreen from './components/LoginScreen';
import LandingPage from './components/LandingPage';
import logo from './logo.png';
import { useNavigate, useLocation } from '@solidjs/router';
import ConnectionStatusBlocker from './components/ConnectionStatusBlocker';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionProvider, usePermissions } from './context/PermissionContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { TripProvider } from './context/TripContext';
import { TruckProvider } from './context/TruckContext';
import { DriverProvider } from './context/DriverContext';
import { ExpenseProvider } from './context/ExpenseContext';
import { OfficeProvider } from './context/OfficeContext';
import { AccountProvider } from './context/AccountContext';
import { TyreProvider } from './context/TyreContext';
import { AuditLogProvider } from './context/AuditLogContext';
import { useTripsContext } from './context/TripContext';
import { useTrucksContext } from './context/TruckContext';
import { useDriversContext } from './context/DriverContext';
import { useExpensesContext } from './context/ExpenseContext';
import { useOfficesContext } from './context/OfficeContext';
import { useAccountsContext } from './context/AccountContext';
import { useTyresContext } from './context/TyreContext';
import { OrganizationProvider, useOrganizations } from './context/OrganizationContext';
import { useNotifications } from './context/NotificationContext';
import { useCountdown } from './hooks/useCountdown';
import { migrationService } from './services/migrationService';
import { organizationService } from './services/organizationService';
import { cloudSyncService } from './services/cloudSyncService';

const LegalPage = lazy(() => import('./components/LegalPage'));

import OrgDisabledScreen from './components/OrgDisabledScreen';
import PendingApprovalScreen from './components/PendingApprovalScreen';
import PasswordResetScreen from './components/PasswordResetScreen';
import AppSidebar from './components/AppSidebar';
import AppHeader from './components/AppHeader';
import VerificationRequiredScreen from './components/VerificationRequiredScreen';
import AppwriteCloudSync from './components/AppwriteCloudSync';
import DesktopViewport from './components/DesktopViewport';
import MobileViewport from './components/MobileViewport';
import AppModals from './components/AppModals';
const AppUpdateModal = lazy(() => import('./components/AppUpdateModal'));

import { appwrite, isAppwriteConfigured } from './lib/appwrite';
import versionData from './version.json';
const APP_VERSION = versionData.version;

import { useAuditLogsContext } from './context/AuditLogContext';
import { useSupportTicketsState } from './hooks/useSupportTicketsState';
import { useTruckHandlers } from './hooks/useTruckHandlers';
import { useBackendSync } from './hooks/useBackendSync';
import { useUserManagement, reconcileOrganizationProfiles } from './hooks/useUserManagement';
import { useModalWizardState } from './hooks/useModalWizardState';
import { useAuthHandlers } from './hooks/useAuthHandlers';
import { useConfirmAction } from './hooks/useConfirmAction';
import { useNavigationState } from './hooks/useNavigationState';
import { useCapacitorListeners } from './hooks/useCapacitorListeners';
import { useAdminActions } from './hooks/useAdminActions';
import { useBackupRestore } from './hooks/useBackupRestore';
import { useAppUpdate } from './hooks/useAppUpdate';
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



import {
  CheckCircle,
  AlertCircle,
  Loader,
} from 'lucide-solid';

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



export default function App() {
  return (
    <AuthProvider>
      <PermissionProvider>
        <OrganizationProvider>
          <NotificationProvider>
            <ThemeProvider>
              <TripProvider>
                <TruckProvider>
                  <DriverProvider>
                    <ExpenseProvider>
                      <OfficeProvider>
                        <AccountProvider>
                          <TyreProvider>
                            <AuditLogProvider>
                              <AppContent />
                            </AuditLogProvider>
                          </TyreProvider>
                        </AccountProvider>
                      </OfficeProvider>
                    </ExpenseProvider>
                  </DriverProvider>
                </TruckProvider>
              </TripProvider>
            </ThemeProvider>
          </NotificationProvider>
        </OrganizationProvider>
      </PermissionProvider>
    </AuthProvider>
  );
}

function AppContent(): any {
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

  // Retrieve global states/methods from Contexts
  const perm = usePermissions();
  const userRightsList = perm.userRightsList;
  const setUserRightsList = perm.setUserRightsList;
  const currentUserRights = perm.currentUserRights;
  const handleAddPermission = perm.addPermission;
  const handleUpdatePermission = perm.updatePermission;
  const handleDeletePermission = perm.deletePermission;
  const pushPermissionsToCloud = perm.pushPermissions;

  const orgs = useOrganizations();
  const organizationProfiles = orgs.organizationProfiles;
  const setOrganizationProfiles = orgs.setOrganizationProfiles;
  const saveOrganizationProfiles = orgs.saveProfiles;

  const [profileModalOpen, setProfileModalOpen] = createSignal(false);
  const [profileActiveTab, setProfileActiveTab] = createSignal<'SETTINGS' | 'SUPPORT'>('SETTINGS');
  const [profileDropdownOpen, setProfileDropdownOpen] = createSignal(false);

  const notifications = useNotifications();
  const toastMessage = () => notifications.toastMessage();
  const showNotification = notifications.showNotification;
  const notificationOpen = () => notifications.notificationOpen();
  const setNotificationOpen = notifications.setNotificationOpen;
  const lastReadNotificationTime = () => notifications.lastReadNotificationTime();
  const updateLastReadNotificationTime = notifications.updateLastReadNotificationTime;
  const notificationRef = () => notifications.notificationRef();
  const setNotificationRef = notifications.setNotificationRef;

  const [verificationOtpSent, setVerificationOtpSent] = createSignal(false);
  const [whatsappOtpCode, setWhatsappOtpCode] = createSignal<string | null>(null);
  const [whatsappOtpPhone, setWhatsappOtpPhone] = createSignal<string | null>(null);
  const [showPhoneUpdateModal, setShowPhoneUpdateModal] = createSignal(false);

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
  const reconcileUserSession = auth.reconcileUserSession;
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

  const modalWizard = useModalWizardState();
  const emailTimer = modalWizard.emailTimer;
  const setEmailTimer = modalWizard.setEmailTimer;
  const phoneTimer = modalWizard.phoneTimer;
  const setPhoneTimer = modalWizard.setPhoneTimer;
  const mobileWizardTimer = modalWizard.mobileWizardTimer;
  const setMobileWizardTimer = modalWizard.setMobileWizardTimer;
  const mobileWizardOpen = modalWizard.mobileWizardOpen;
  const setMobileWizardOpen = modalWizard.setMobileWizardOpen;
  const mobileWizardStep = modalWizard.mobileWizardStep;
  const setMobileWizardStep = modalWizard.setMobileWizardStep;
  const mobileWizardCode = modalWizard.mobileWizardCode;
  const setMobileWizardCode = modalWizard.setMobileWizardCode;
  const mobileWizardNewPhone = modalWizard.mobileWizardNewPhone;
  const setMobileWizardNewPhone = modalWizard.setMobileWizardNewPhone;
  const mobileWizardPassword = modalWizard.mobileWizardPassword;
  const setMobileWizardPassword = modalWizard.setMobileWizardPassword;
  const mobileWizardError = modalWizard.mobileWizardError;
  const setMobileWizardError = modalWizard.setMobileWizardError;
  const mobileWizardGeneratedOtp = modalWizard.mobileWizardGeneratedOtp;
  const setMobileWizardGeneratedOtp = modalWizard.setMobileWizardGeneratedOtp;
  const setup2FAOpen = modalWizard.setup2FAOpen;
  const setSetup2FAOpen = modalWizard.setSetup2FAOpen;
  const setup2FASecret = modalWizard.setup2FASecret;
  const setSetup2FASecret = modalWizard.setSetup2FASecret;
  const disable2FAOpen = modalWizard.disable2FAOpen;
  const setDisable2FAOpen = modalWizard.setDisable2FAOpen;
  const resetPasswordState = modalWizard.resetPasswordState;
  const setResetPasswordState = modalWizard.setResetPasswordState;

  let profileDropdownRef: HTMLDivElement | undefined;
  let verifiedTxns: any;
  let prevTabIdxRef = 0;

  onMount(() => {
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

  const [activeMonth, setActiveMonth] = createSignal(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [activeYear, setActiveYear] = createSignal(String(new Date().getFullYear()));


  const [theme, setTheme] = createSignal<'light' | 'dark'>((localStorage.getItem('ttt_theme') as 'light' | 'dark') || 'light');

  onMount(() => {
    if (theme() === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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

  // Voice language state
  const [userVoiceLang, setUserVoiceLang] = createSignal<string>('en-IN');
  const [profileVoiceLang, setProfileVoiceLang] = createSignal<string>('en-IN');

  // Load user's default voice language preference from localStorage
  createEffect(() => {
    if (currentUser()) {
      const email = (currentUser().email || '').toLowerCase().trim();
      const storedLang = localStorage.getItem(`ttt_voice_lang_${email}`) || 'en-IN';
      setUserVoiceLang(storedLang);
    } else {
      setUserVoiceLang('en-IN');
    }
  });



  const saveUserRightsList = (nextList: UserPermission[]) => {
    setUserRightsList(nextList);
    localStorage.setItem('ttt_user_rights', JSON.stringify(nextList));
  };

  const reconcileSession = async (user: any, freshRightsList?: UserPermission[]) => {
    return reconcileUserSession(
      user,
      freshRightsList || userRightsList(),
      setUserRightsList, organizationProfiles(),
      setOrganizationProfiles,
      (orgId) => migrationService.migrateLocalDataToOrg(orgId, {
        setTrucks,
        setDrivers,
        setOffices,
        setAccounts,
        setTrips,
        setExpenses,
        setTyres,
        setAuditLogs,
        touchLastModified
      })
    );
  };

  // Authentication check and cloud permission sync on startup
  onMount(() => {
    const initAuth = async () => {
      try {
        const loginMethod = localStorage.getItem('ttt_login_method');
        if (loginMethod === 'mock') {
          const storedMock = localStorage.getItem('ttt_mock_user');
          if (storedMock) {
            const user = JSON.parse(storedMock);
            await reconcileSession(user);
          } else {
            setCurrentUser(null);
          }
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
        console.error('initAuth error caught:', err);
        setInitialPullDone(true);
      } finally {
        setLoadingUser(false);
      }
    };
    initAuth();
  });

  // Synchronize location.pathname with view and tab state
  createEffect(() => {
    const path = location.pathname;
    const publicLegalPaths = ['/terms', '/privacy', '/refunds', '/refund-policy'];

    // Auth guarding
    if (!currentUser() && !loadingUser()) {
      if (path.startsWith('/console')) {
        navigate('/login');
      } else if (path !== '/' && path !== '/login' && !publicLegalPaths.includes(path)) {
        navigate('/');
      }
      return;
    }

    if (currentUser() && !loadingUser()) {
      if (path === '/' || path === '/login') {
        navigate('/console/dashboard');
        return;
      }
      if (publicLegalPaths.includes(path)) {
        return;
      }

      const subpath = path.replace('/console/', '').toUpperCase();
      const validTabs = ['DASHBOARD', 'TRIPS', 'TRUCKS', 'OFFICES', 'ACCOUNTS', 'DRIVERS', 'EXPENSES', 'REPORTS', 'AUDIT', 'TYRES', 'USERS', 'BACKEND', 'BILLING'];
      if (validTabs.includes(subpath)) {
        setActiveTab(subpath as any);
      } else if (path === '/console') {
        navigate('/console/dashboard');
      }
    }
  });

  const handleUpdateOrgProfile = async (updatedProfile: OrganizationProfile) => {
    const nextProfiles = organizationProfiles().map(p =>
      p.organizationId === updatedProfile.organizationId ? updatedProfile : p
    );
    await saveOrganizationProfiles(nextProfiles);
  };

  const currentUserOrgId = createMemo(() => currentUserRights()?.organizationId || '');
  const hasUsersTabAccess = createMemo(() => currentUserOrgId() === 'org_backend' ? !!currentUserRights().canViewBackendTeam : !!currentUserRights().isAdmin);



  // Navigation / Tabs State
  const [activeTab, setActiveTab] = createSignal<'DASHBOARD' | 'TRIPS' | 'TRUCKS' | 'OFFICES' | 'ACCOUNTS' | 'DRIVERS' | 'EXPENSES' | 'REPORTS' | 'AUDIT' | 'TYRES' | 'USERS' | 'BACKEND' | 'BILLING'>('DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = createSignal(false);

  const selectTab = (tab: 'DASHBOARD' | 'TRIPS' | 'TRUCKS' | 'OFFICES' | 'ACCOUNTS' | 'DRIVERS' | 'EXPENSES' | 'REPORTS' | 'AUDIT' | 'TYRES' | 'USERS' | 'BACKEND' | 'BILLING') => {
    setActiveTab(tab);
    navigate(`/console/${tab.toLowerCase()}`);
    setIsMobileMenuOpen(false);
  };

  // Live Appwrite team membership list (fetched when admin opens USERS tab)
  const [teamMembers, setTeamMembers] = createSignal<any[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = createSignal(false);

  // Fetch live Appwrite memberships whenever admin opens the USERS panel
  createEffect(() => {
    if (activeTab() === 'USERS' && hasUsersTabAccess() && currentUserOrgId() && isAppwriteConfigured()) {
      setLoadingTeamMembers(true);
      appwrite.getTeamMemberships(currentUserOrgId())
        .then(members => setTeamMembers(members))
        .catch(err => console.warn('Could not fetch team memberships:', err))
        .finally(() => setLoadingTeamMembers(false));
    }
  });

  // Redirect non-admin/unauthorized users away from restricted tabs
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
  const setAuditLogs = auditLogsCtx.saveAuditLogs;
  const logAction = auditLogsCtx.logAction;
  const handleClearAuditLogs = auditLogsCtx.handleClearAuditLogs;
  const saveAuditLogs = setAuditLogs;



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
    currentUserId(),
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

  const {
    appUpdateConfig,
    handleSaveAppUpdateConfig,
    renderAppUpdateModal
  } = useAppUpdate(APP_VERSION);

  const {
    confirmModal,
    setConfirmModal,
    confirmAction
  } = useConfirmAction();

  const {
    isMobile,
    setIsMobile,
    mobileTab,
    setMobileTab,
    registrySubTab,
    setRegistrySubTab,
    fabOpened,
    setFabOpened,
    autoOpenFormTab,
    setAutoOpenFormTab,
    triggerOpenAddForm
  } = useNavigationState();

  const {
    handleUpdateOrgStatus,
    handleUpdateOrgLimit,
    handleApproveTruckRequest,
    handleRejectTruckRequest
  } = useAdminActions({
    organizationProfiles,
    saveOrganizationProfiles,
    showNotification,
    logAction
  });

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

  const {
    handleTouchStart,
    handleTouchEnd
  } = useCapacitorListeners({
    registrySubTab,
    setRegistrySubTab,
    mobileTab,
    setMobileTab,
    profileModalOpen,
    setProfileModalOpen,
    setup2FAOpen,
    setSetup2FAOpen,
    disable2FAOpen,
    setDisable2FAOpen,
    confirmModal,
    setConfirmModal,
    showPhoneUpdateModal,
    setShowPhoneUpdateModal
  });

  const {
    handleEmailVerificationRedirect,
    handleLogout,
    handleUpdateProfile,
    emailVerificationError,
    emailVerificationSuccess,
    setEmailVerificationSuccess,
    setEmailVerificationError
  } = useAuthHandlers(
    currentUser,
    setCurrentUser,
    userRightsList,
    setUserRightsList,
    organizationProfiles,
    setOrganizationProfiles,
    saveOrganizationProfiles,
    setTrucks,
    setDrivers,
    setOffices,
    setAccounts,
    setTrips,
    setExpenses,
    setTyres,
    setAuditLogs,
    showNotification,
    navigate,
    setLoadingUser,
    logAction,
    setResetPasswordState,
    reconcileSession,
    currentUserRights,
    pushPermissionsToCloud,
    setUserVoiceLang,
    setProfileModalOpen
  );

  const {
    checkUserApproval,
    sendWhatsAppOTP,
    handlePhoneUpdateSubmit,
    handleRegisterUserPermissions,
    handleRequestToJoinOrganization
  } = useUserManagement(
    currentUser,
    userRightsList,
    setUserRightsList,
    organizationProfiles,
    setOrganizationProfiles,
    saveOrganizationProfiles,
    pushPermissionsToCloud,
    reconcileSession,
    showNotification,
    setVerificationOtpSent,
    setPhoneTimer,
    setShowPhoneUpdateModal,
    setWhatsappOtpCode,
    setWhatsappOtpPhone
  );



  const [dashboardTrips, setDashboardTrips] = createSignal<TripEntry[]>([]);
  const [dashboardExpenses, setDashboardExpenses] = createSignal<ExpenseEntry[]>([]);

  async function loadDashboardData(month: string, year: string) {
    const orgId = currentUserOrgId() || 'org_default';

    // Filter by organization and ensure deleted records are excluded
    const activeTrips = (orgId === 'org_backend' ? trips : trips.filter(t => t.organizationId === orgId))
      .filter(t => !t.deletedAt);
    const activeExpenses = (orgId === 'org_backend' ? expenses : expenses.filter(e => e.organizationId === orgId))
      .filter(e => !e.deletedAt);

    const filteredTrips = year === 'All Time'
      ? activeTrips
      : activeTrips.filter((t: any) => t.startDate && t.startDate.startsWith(`${year}-${month}`));
    const filteredExpenses = year === 'All Time'
      ? activeExpenses
      : activeExpenses.filter((e: any) => e.date && e.date.startsWith(`${year}-${month}`) && e.status !== 'Declined');

    setDashboardTrips(filteredTrips);
    setDashboardExpenses(filteredExpenses);
  }

  onMount(() => {
    loadDashboardData(activeMonth(), activeYear());
  });



  const approvedOrgTrucks = createReactiveArrayWrapper(createMemo<Truck[]>(() => orgTrucks.filter(t => t.isApproved !== false)));
  const orgUserRights = createMemo(() => userRightsList().filter(u => u.organizationId === (currentUserRights()?.organizationId || '')));
  const currentOrgProfileMemo = createMemo<OrganizationProfile | undefined>(() => organizationProfiles().find(p => p.organizationId === (currentUserRights()?.organizationId || '')));
  const currentOrgProfile = new Proxy({} as any, {
    get(target, prop) {
      const profile = currentOrgProfileMemo();
      if (!profile) return undefined;
      const val = Reflect.get(profile, prop);
      if (typeof val === 'function') {
        return val.bind(profile);
      }
      return val;
    }
  }) as any as OrganizationProfile;
  const isOrgDisabled = () => currentOrgProfile.status === 'Disabled';

  const session = createMemo(() => ({
    user: currentUser(),
    rights: currentUserRights(),
    orgId: currentUserRights()?.organizationId || '',
    profile: currentOrgProfileMemo(),
    disabled: currentOrgProfileMemo()?.status === 'Disabled'
  }));

  const canUserViewCategory = (category: string, logUserOrReference?: string, logDetails?: string): boolean => {
    const cat = category.toLowerCase();
    const currentUserEmail = (currentUser()?.email || '').toLowerCase().trim();
    if (cat.includes('password')) {
      return (logUserOrReference || '').toLowerCase().trim() === currentUserEmail;
    }

    if (currentUserRights().isSuperAdmin) return true;

    // Check if this log specifically concerns the current logged-in user (e.g. their permissions or approval status changed)
    if (currentUserEmail) {
      const ref = (logUserOrReference || '').toLowerCase().trim();
      const det = (logDetails || '').toLowerCase().trim();
      if (ref === currentUserEmail || ref.includes(currentUserEmail) || det.includes(currentUserEmail)) {
        return true;
      }
    }

    if (cat.includes('trip')) return !!currentUserRights().canViewTrips;
    if (cat.includes('truck')) return !!currentUserRights().canViewTrucks;
    if (cat.includes('driver')) return !!currentUserRights().canViewDrivers;
    if (cat.includes('office') || cat.includes('branch')) return !!currentUserRights().canViewOffices;
    if (cat.includes('account')) return !!currentUserRights().canViewAccounts;
    if (cat.includes('expense')) return !!currentUserRights().canViewExpenses;
    if (cat.includes('tyre')) return !!currentUserRights().canViewTyres;
    if (cat.includes('organization') || cat.includes('access') || cat.includes('permission')) {
      return !!currentUserRights().isAdmin;
    }
    return true;
  };

  const backendEmails = createMemo(() => new Set(
    userRightsList()
      .filter(u => u.organizationId === 'org_backend')
      .map(u => u.email.toLowerCase().trim())
  ));

  const orgAuditLogsRaw = createMemo<AuditLog[]>(() => {
    return auditLogs
      .filter(l => {
        const currentUserEmail = (currentUser()?.email || '').toLowerCase().trim();
        if (currentUserOrgId() === 'org_backend') {
          const cat = (l.category || '').toLowerCase();
          if (cat.includes('password')) {
            return (l.reference || '').toLowerCase().trim() === currentUserEmail;
          }

          const isBackendUserAction = backendEmails().has((l.user || '').toLowerCase().trim());
          const isIncomingTruckRequest = l.category === 'Truck' && l.action === 'Created' && (l.details || '').includes('Requested activation');
          const isTruckApproveOrReject = l.category === 'Truck' && (l.action === 'Approved' || l.action === 'Rejected');

          return isBackendUserAction || isIncomingTruckRequest || isTruckApproveOrReject;
        }

        return l.organizationId === currentUserOrgId() && canUserViewCategory(l.category, l.reference, l.details);
      })
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  });
  const orgAuditLogs = createReactiveArrayWrapper<any>(orgAuditLogsRaw);

  const latestLogTime = createMemo(() => {
    if (orgAuditLogs.length === 0) return 0;
    const ts = orgAuditLogs[0]?.timestamp;
    if (!ts) return 0;
    try {
      return ts.includes('T')
        ? new Date(ts).getTime()
        : new Date(ts.replace(' ', 'T') + 'Z').getTime();
    } catch { return 0; }
  });

  const hasUnreadNotifications = () => latestLogTime() > lastReadNotificationTime();

  const cyanCount = createMemo(() => {
    return currentUserRights().isAdmin
      ? orgUserRights().filter(u => !u.isApproved).length
      : orgTrips.filter(t => t.status === 'In Progress' || t.status === 'Pending').length;
  });

  // Form modal controller states
  const [bookingModalOpen, setBookingModalOpen] = createSignal(false);
  const [editingTrip, setEditingTrip] = createSignal<TripEntry | null>(null);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = createSignal(false);

  // Listen for Alt+V shortcut to toggle Voice Assistant
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setIsVoiceAssistantOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });



  function touchLastModified() {
    if (currentUserOrgId() !== 'org_backend') {
      localStorage.setItem('ttt_last_modified_at', Date.now().toString());
    }
    sessionStorage.setItem('ttt_recent_action_at', Date.now().toString());
  }

  async function pushFleetSnapshotNow() {
    touchLastModified();
  }



  createEffect(() => {
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
  });

  let hasHealedRef: any;

  createEffect(() => {
    if (!initialPullDone || trips.length === 0 || hasHealedRef) return;
    hasHealedRef = true;

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
            .replace('Excess amount/surplus carried forward from ', '')
            .replace('Excess amount/surplus carried forward to ', '')
            .trim()
          : '';

        if (!targetTripNo) return true;

        const targetTrip = trips.find(x => x.tripNo === targetTripNo);
        if (!targetTrip) {
          changed = true;
          return false;
        }

        const isSurplus = adv.notes?.includes('Excess amount/surplus');
        const matchingNotes = isDest
          ? (isSurplus
            ? `Excess amount/surplus carried forward to ${t.tripNo}`
            : `Negative balance carried forward to ${t.tripNo}`)
          : (isSurplus
            ? `Excess amount/surplus carried forward from ${t.tripNo}`
            : `Negative balance carried forward from ${t.tripNo}`);

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
  });



  const saveUserRightsListWithSync = (newList: UserPermission[]) => {
    saveUserRightsList(newList);
    pushPermissionsToCloud(newList);
  };

  const onLoadCloudState = (parsed: any, userRightsData?: any, quiet = false): boolean => {
    const orgId = currentUserRights()?.organizationId || 'org_default';
    const email = (currentUser()?.email || '').toLowerCase().trim();
    const isSuper = currentUserRights()?.isSuperAdmin || (currentUserRights()?.organizationId === 'org_backend');

    const result = cloudSyncService.reconcile(
      parsed,
      userRightsData,
      quiet, currentUser(), currentUserRights(),
      orgId,
      email,
      isSuper,
      {
        trucks,
        drivers,
        offices,
        accounts,
        trips,
        expenses,
        tyres,
        auditLogs,
        supportTickets: supportTickets(), userRightsList: userRightsList(), organizationProfiles: organizationProfiles()
      }
    );

    if (!result) return false;

    const hasChanged = (local: any[], next: any[] | undefined) => {
      if (!next) return false;
      if (local.length !== next.length) return true;
      return JSON.stringify(local) !== JSON.stringify(next);
    };

    if (result.userRightsList && hasChanged(userRightsList(), result.userRightsList)) {
      setUserRightsList(result.userRightsList);
    }
    if (result.organizationProfiles && hasChanged(organizationProfiles(), result.organizationProfiles)) {
      setOrganizationProfiles(result.organizationProfiles);
    }
    if (result.trucks && hasChanged(trucks, result.trucks)) {
      setTrucks(result.trucks);
    }
    if (result.drivers && hasChanged(drivers, result.drivers)) {
      setDrivers(result.drivers);
    }
    if (result.offices && hasChanged(offices, result.offices)) {
      setOffices(result.offices);
    }
    if (result.accounts && hasChanged(accounts, result.accounts)) {
      setAccounts(result.accounts);
    }
    if (result.trips && hasChanged(trips, result.trips)) {
      setTrips(result.trips);
    }
    if (result.expenses && hasChanged(expenses, result.expenses)) {
      setExpenses(result.expenses);
    }
    if (result.tyres && hasChanged(tyres, result.tyres)) {
      setTyres(result.tyres);
    }
    if (result.auditLogs && hasChanged(auditLogs, result.auditLogs)) {
      setAuditLogs(result.auditLogs);
    }
    if (result.supportTickets && hasChanged(supportTickets(), result.supportTickets)) {
      setSupportTickets(result.supportTickets);
    }

    if (result.notifications && result.notifications.length > 0) {
      result.notifications.forEach(n => {
        showNotification(n.message);
        logAction(n.actionType, n.category, n.target, n.details, n.organizationId);
      });
    }

    if (result.shouldTouchLastModified) {
      touchLastModified();
    }

    return result.hasRelevantChanges;
  };





  // Reconcile pending trucks if approved in global profiles.
  // NOTE: only tracks organizationProfiles() and currentUserRights() — NOT trucks.
  // Trucks are read inside untrack() to avoid a self-triggering loop:
  //   setTrucks(approved) → trucks signal changes → this effect re-runs → setTrucks again → ...
  createEffect(() => {
    const orgId = currentUserRights()?.organizationId;
    if (!orgId) return;
    if (!initialPullDone) {
      console.log('Appwrite Auto-Sync: Blocking truck reconciliation until initial cloud sync completes.');
      return;
    }
    const currentOrgProfile = organizationProfiles().find(p => p.organizationId === orgId);
    if (!currentOrgProfile) return;

    // Read trucks snapshot WITHOUT tracking the signal so setTrucks doesn't re-trigger this effect
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
            console.error("Failed to sync approved truck to Appwrite before local update:", err);
          }
        }
        setTrucks(updatedTrucks);
        localStorage.setItem('ttt_trucks', JSON.stringify(updatedTrucks));
        showNotification(`A pending truck request has been approved by the backend team!`);
        logAction('Created', 'Truck', 'ApprovalSync', `Truck activated automatically via backend activation approval.`);
        touchLastModified();
      };
      saveToBackendAndLocal();
    }
  });


  // Focused memos — track ONLY the values that determine WebSocket connection params.
  // A permission change (e.g. canEditBackend) will NOT reconnect the socket,
  // only an orgId or isSuperAdmin change will.
  const realtimeOrgId = createMemo(() => currentUserRights()?.organizationId ?? '');
  const realtimeIsSuperAdmin = createMemo(() => !!currentUserRights()?.isSuperAdmin);

  // Real-time synchronization for Super Admin










  // --- SERVICE DONE HANDLER ---
  // Creates up to 2 expense entries (parts + labour) and advances the truck's next-due KM milestone
  const handleServiceDone = async (payload: import('./types').ServiceDonePayload) => {
    const { serviceType, serviceDate, truckId, truckNo, newMilestoneKM, notes, partsExpense, labourExpense } = payload;
    const orgId = currentUserOrgId();
    const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';

    // Map service type → truck field key
    const kmFieldMap: Record<string, string> = {
      'Engine Oil': 'engineOilKM',
      'Crown Oil': 'crownOilKM',
      'Gear Box Oil': 'gearBoxOilKM',
      'Radiator': 'radiatorKM',
      'Pinpush Grease': 'pinpushKM',
      'Wheel Grease': 'wheelGreaseKM',
    };
    const kmField = kmFieldMap[serviceType];

    const newExpenses: import('./types').ExpenseEntry[] = [];

    // 1. Parts Purchase expense
    if (partsExpense.amount > 0) {
      const partsExp = createRecord<import('./types').ExpenseEntry>({
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
      }, currentUserId());
      newExpenses.push(partsExp);
    }

    // 2. Mechanical Labour expense
    if (labourExpense.amount > 0) {
      const labourExp = createRecord<import('./types').ExpenseEntry>({
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
      await loadDashboardData(activeMonth(), activeYear());
      newExpenses.forEach(exp => {
        logAction('Created', 'Expense', exp.truckNo, `Service Done — ₹${exp.amount.toLocaleString()} ${exp.expenseType} at ${exp.shopName}`);
      });
    }

    // 4. Advance truck milestone KM
    if (kmField) {
      const truck = trucks.find(t => t.id === truckId);
      if (truck) {
        const updatedTruck = mutateRecord(truck, { [kmField]: newMilestoneKM }, currentUserId());
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
    showNotification(`${serviceType} service recorded for ${truckNo}${totalCost > 0 ? ` — ₹${totalCost.toLocaleString()} logged to expense ledger` : ''}.`);
  };



  // --- TRIP ENTRIES CRUD SYSTEM ---
  const handlePostTripEntry = async (entryInput: Omit<TripEntry, 'id'>) => {
    await postTripEntry(entryInput, editingTrip());
    setEditingTrip(null);
  };

  const handleEditTripTrigger = (entry: TripEntry) => {
    setEditingTrip(entry);
    setBookingModalOpen(true);
  };

  // --- BACKUP RESTORE SYSTEM ---
  return () => {
    if (emailVerificationSuccess()) {
      return (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white font-sans p-4">
          <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
          <div class="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6 text-center">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-full border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle class="w-8 h-8" />
            </div>
            <div class="space-y-2">
              <h2 class="text-2xl font-bold tracking-tight">Email Verified!</h2>
              <p class="text-xs text-slate-400 leading-relaxed">
                Your email address has been successfully verified. Your account configuration and organization setup are complete.
              </p>
            </div>
            <div class="bg-slate-950/60 border border-slate-850 p-4 rounded-xl text-left text-xs space-y-2 text-slate-300">
              <p class="font-semibold text-slate-200">What to do next:</p>
              <ul class="list-disc pl-4 space-y-1">
                <li>Open the <strong>LorryGuru Mobile App</strong> on your phone.</li>
                <li>Tap on <strong>Refresh Status</strong> to reload your dashboard.</li>
                <li>If you closed the app, simply log in using your email and password.</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmailVerificationSuccess(false);
                navigate(currentUser() ? '/console/dashboard' : '/login');
              }}
              class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/25 transition cursor-pointer"
            >
              Go to Console
            </button>
          </div>
        </div>
      );
    }

    if (emailVerificationError()) {
      return (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white font-sans p-4">
          <div class="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6 text-center">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-rose-500/10 rounded-full border border-rose-500/30 text-rose-450">
              <AlertCircle class="w-8 h-8" />
            </div>
            <div class="space-y-2">
              <h2 class="text-2xl font-bold tracking-tight">Verification Failed</h2>
              <p class="text-xs text-slate-400 leading-relaxed">
                We encountered an issue while verifying your email address. The link might have expired or is invalid.
              </p>
              <p class="text-[11px] font-mono text-rose-400 bg-rose-950/20 border border-rose-500/20 p-2 rounded-lg mt-2">
                {emailVerificationError()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmailVerificationError(null);
                navigate('/login');
              }}
              class="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
    }

    if (resetPasswordState() && resetPasswordState().active) {
      return (
        <PasswordResetScreen
          resetPasswordState={resetPasswordState()}
          setResetPasswordState={setResetPasswordState}
          setLoadingUser={setLoadingUser}
          showNotification={showNotification}
        />
      );
    }

    if (loadingUser()) {
      return (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 text-white font-sans">
          <div class="flex flex-col items-center gap-3">
            <Loader class="w-8 h-8 animate-spin text-blue-500" />
            <p class="text-xs text-slate-400">Verifying session credentials...</p>
          </div>
        </div>
      );
    }

    const publicLegalPaths = ['/terms', '/privacy', '/refunds', '/refund-policy'];
    if (publicLegalPaths.includes(location.pathname)) {
      const defaultTab = location.pathname === '/privacy' ? 'privacy' : (location.pathname === '/refunds' || location.pathname === '/refund-policy') ? 'refunds' : 'terms';
      return (
        <Suspense fallback={<LoadingTab />}>
          <LegalPage defaultTab={defaultTab} onBack={() => navigate(currentUser() ? '/console/dashboard' : '/')} />
        </Suspense>
      );
    }

    if (!currentUser()) {
      if (location.pathname === '/login') {
        return (
          <>
            <LoginScreen
              onLoginSuccess={async (user) => {
                const method = isAppwriteConfigured() ? 'appwrite' : 'mock';
                localStorage.setItem('ttt_login_method', method);
                if (method === 'mock') {
                  localStorage.setItem('ttt_mock_user', JSON.stringify(user));
                }
                localStorage.removeItem('ttt_guest_user');
                setLoadingUser(true);
                setInitialPullDone(false);
                try {
                  await reconcileSession(user);
                  showNotification(`Successfully logged in as ${user.name || user.email}`);
                  navigate('/console/dashboard');
                } catch (err) {
                  console.error(err);
                } finally {
                  setLoadingUser(false);
                }
              }}
              checkUserApproval={checkUserApproval}
              onRegisterUserPermissions={handleRegisterUserPermissions}
              onBackToHome={() => navigate('/')}
            />
            {renderAppUpdateModal()}
          </>
        );
      }
      return (
        <>
          <LandingPage onEnterConsole={() => navigate('/login')} />
          {renderAppUpdateModal()}
        </>
      );
    }

    const isVerificationPending = currentUser() && currentUserRights().isApproved && (
      (!currentUserRights().isEmailVerified && currentUser().emailVerification !== true) ||
      (!currentUserRights().isPhoneVerified && currentUser().phoneVerification !== true)
    );

    if (isVerificationPending) {
      return (
        <>
          <VerificationRequiredScreen
            currentUser={currentUser()}
            currentUserRights={currentUserRights() as any}
            userRightsList={userRightsList()}
            setUserRightsList={setUserRightsList}
            pushPermissionsToCloud={pushPermissionsToCloud}
            reconcileSession={reconcileSession as any}
            showNotification={showNotification}
            toastMessage={toastMessage()}
            emailTimer={emailTimer}
            setEmailTimer={setEmailTimer}
            phoneTimer={phoneTimer}
            setPhoneTimer={setPhoneTimer}
            verificationOtpSent={verificationOtpSent()}
            setVerificationOtpSent={setVerificationOtpSent}
            showPhoneUpdateModal={showPhoneUpdateModal()}
            setShowPhoneUpdateModal={setShowPhoneUpdateModal}
            whatsappOtpCode={whatsappOtpCode()}
            setWhatsappOtpCode={setWhatsappOtpCode}
            sendWhatsAppOTP={sendWhatsAppOTP as any}
            handlePhoneUpdateSubmit={handlePhoneUpdateSubmit}
            handleLogout={handleLogout}
            setLoadingUser={setLoadingUser}
            setOrganizationProfiles={setOrganizationProfiles}
          />
          {renderAppUpdateModal()}
        </>
      );
    }

    if (currentUser() && isOrgDisabled() && !currentUserRights().isSuperAdmin) {
      return (
        <>
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
            currentUserOrgId={() => session().orgId}
            currentUserEmail={() => session().user?.email || ''}
            currentUserId={() => session().user?.email || ''}
            isAdmin={() => !!session().rights?.isAdmin}
            onInitialSyncComplete={setInitialPullDone}
            onConnectionChange={(online, reason) => {
              setIsOnline(online);
              setDisconnectReason(reason);
            }}
            activeTicketId={activeTicketId}
            hideUI={true}
          />
          <OrgDisabledScreen
            currentUserOrgId={() => session().orgId}
            onLogout={handleLogout}
          />
          {renderAppUpdateModal()}
        </>
      );
    }

    if (currentUser() && !currentUserRights().isApproved) {
      return (
        <>
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
            currentUserOrgId={() => session().orgId}
            currentUserEmail={() => session().user?.email || ''}
            currentUserId={() => session().user?.email || ''}
            isAdmin={() => !!session().rights?.isAdmin}
            onInitialSyncComplete={setInitialPullDone}
            onConnectionChange={(online, reason) => {
              setIsOnline(online);
              setDisconnectReason(reason);
            }}
            activeTicketId={activeTicketId}
            hideUI={true}
          />
          <PendingApprovalScreen
            currentUserRights={currentUserRights() as any}
            onLogout={handleLogout}
            onRequestToJoinOrganization={handleRequestToJoinOrganization}
            showNotification={showNotification}
          />
          {renderAppUpdateModal()}
        </>
      );
    }



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

    if (isMobile()) {
      return (
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
      );
    }

    return (
      <div class="h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans select-none selection:bg-blue-600/10 overflow-hidden">

        {/* GLOBAL TOAST BANNER */}
        {toastMessage() && (
          <div id="toast-notify" class="fixed bottom-5 right-5 z-50 bg-blue-600 border border-blue-400/30 text-white p-3.5 px-6 rounded-xl shadow-2xl flex items-center gap-2.5 animate-bounce">
            <CheckCircle class="w-4 h-4 text-white" />
            <span class="text-xs font-semibold">{toastMessage()}</span>
          </div>
        )}

        {/* Sidebar Navigation */}
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

        {/* Main Content Area */}
        <main class="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden">
          {/* Header */}
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
            profileDropdownRef={(el) => profileDropdownRef = el}
            hasUnreadNotifications={hasUnreadNotifications()}
            updateLastReadNotificationTime={updateLastReadNotificationTime}
            showNotification={showNotification}
            getUserInitials={getUserInitials}
            isBackendTeam={isBackendTeam}
            hasUsersTabAccess={hasUsersTabAccess()}
            setProfileActiveTab={setProfileActiveTab}
            setProfileModalOpen={setProfileModalOpen}
            setActiveTab={setActiveTab}
            handleLogout={handleLogout}
            triggerClearAllLocalData={triggerClearAllLocalData}
            handleTriggerDownloadBackup={handleTriggerDownloadBackup}
            handleUploadBackupChange={handleUploadBackupChange}
            setEditingTrip={setEditingTrip}
            setBookingModalOpen={setBookingModalOpen}
            setIsVoiceAssistantOpen={setIsVoiceAssistantOpen}
            onLoadCloudState={onLoadCloudState}
            supportTickets={supportTickets()}
            activeTicketId={activeTicketId()}
            setInitialPullDone={setInitialPullDone}
            setIsOnline={setIsOnline}
            setDisconnectReason={setDisconnectReason}
            trucks={trucks}
            drivers={drivers}
            offices={offices}
            accounts={accounts}
            trips={trips}
            expenses={expenses}
            tyres={tyres}
            auditLogs={auditLogs}
            logAction={logAction}
          />

          <DesktopViewport
            activeTab={activeTab}
            currentUserRights={currentUserRights}
            currentUserOrgId={currentUserOrgId()}
            currentUser={currentUser}
            currentOrgProfile={currentOrgProfileMemo()}
            userRightsList={userRightsList}
            supportTickets={supportTickets}
            activeTicketId={activeTicketId}
            payments={payments}
            appUpdateConfig={appUpdateConfig}
            dashboardTrips={dashboardTrips}
            dashboardExpenses={dashboardExpenses}
            activeMonth={activeMonth}
            activeYear={activeYear}
            setActiveMonth={setActiveMonth}
            setActiveYear={setActiveYear}
            handleEditTripTrigger={handleEditTripTrigger}
            confirmAction={confirmAction}
            handleUpdateOrgStatus={handleUpdateOrgStatus}
            handleUpdateOrgLimit={handleUpdateOrgLimit}
            handleApproveTruckRequest={handleApproveTruckRequest}
            handleRejectTruckRequest={handleRejectTruckRequest}
            handleBackendUpdateTruck={handleBackendUpdateTruck}
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
            showNotification={showNotification}
            handleServiceDone={handleServiceDone}
          />
        </main>

        <AppModals
          profileModalOpen={profileModalOpen}
          setProfileModalOpen={setProfileModalOpen}
          profileActiveTab={profileActiveTab}
          setProfileActiveTab={setProfileActiveTab}
          isBackendTeam={isBackendTeam}
          getClientUnreadTicketsCount={getClientUnreadTicketsCount}
          currentUser={currentUser}
          currentUserRights={currentUserRights}
          organizationProfiles={organizationProfiles}
          handleUpdateProfile={async (newName, newOrgName, newPass, oldPass, kycDetails) => {
            const loginMethod = localStorage.getItem('ttt_login_method');
            if (newPass && loginMethod === 'appwrite' && !oldPass) {
              alert("Current password is required to change password in Appwrite.");
              return;
            }
            await handleUpdateProfile(
              newName,
              currentUserRights().isAdmin ? newOrgName : undefined,
              newPass || undefined,
              oldPass || undefined,
              kycDetails
            );
          }}
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
  };
}
