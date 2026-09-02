import { createSignal, createEffect, lazy, Suspense, onMount, onCleanup, createMemo, untrack, Switch, Match } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { CheckCircle, AlertCircle, Loader } from 'lucide-solid';

import logo from './logo.png';

import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionProvider, usePermissions } from './context/PermissionContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { OrganizationProvider, useOrganizations } from './context/OrganizationContext';
import { TripProvider } from './context/TripContext';
import { TruckProvider } from './context/TruckContext';
import { DriverProvider } from './context/DriverContext';
import { ExpenseProvider } from './context/ExpenseContext';
import { OfficeProvider } from './context/OfficeContext';
import { AccountProvider } from './context/AccountContext';
import { TyreProvider } from './context/TyreContext';
import { AuditLogProvider } from './context/AuditLogContext';

import { SettingsManager, useSettings } from './managers/SettingsManager';
import { DialogManager, useDialogs } from './managers/DialogManager';
import { NavigationManager, useNavigation } from './managers/NavigationManager';
import { OrganizationManager, useOrganizationManager } from './managers/OrganizationManager';
import { AuthManager, useAuthManager } from './managers/AuthManager';
import { NotificationManager } from './managers/NotificationManager';

import { isAppwriteConfigured, appwrite } from './lib/appwrite';
import { cryptoService } from './services/cryptoService';
import { db, dbUnlocked, setDbUnlocked } from './services/cache';
import OfflinePinModal from './components/OfflinePinModal';
import versionData from './version.json';
import { trackUniqueVisitor } from './lib/visitorTracker';
const APP_VERSION = versionData.version;

// Screen components
import LandingPage from './components/LandingPage';
import LoginScreen from './components/LoginScreen';
import LegalPage from './components/LegalPage';
import PasswordResetScreen from './components/PasswordResetScreen';
import VerificationRequiredScreen from './components/VerificationRequiredScreen';
import OrgDisabledScreen from './components/OrgDisabledScreen';
import PendingApprovalScreen from './components/PendingApprovalScreen';

import { useTrucksContext } from './context/TruckContext';
import { useDriversContext } from './context/DriverContext';
import { useTripsContext } from './context/TripContext';
import { useExpensesContext } from './context/ExpenseContext';
import { useOfficesContext } from './context/OfficeContext';
import { useAccountsContext } from './context/AccountContext';
import { useTyresContext } from './context/TyreContext';
import { useAuditLogsContext } from './context/AuditLogContext';
import AppwriteCloudSync from './components/AppwriteCloudSync';

import { ConsoleAppWrapper } from './components/ConsoleApp';

const LoadingTab = () => (
  <div class="flex items-center justify-center p-12 h-64">
    <Loader class="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

import { LanguageProvider } from './context/LanguageContext';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <PermissionProvider>
          <OrganizationProvider>
            <NotificationProvider>
              <ThemeProvider>
                <SettingsManager>
                  <DialogManager>
                    <NavigationManager>
                      <TripProvider>
                        <TruckProvider>
                          <DriverProvider>
                            <ExpenseProvider>
                              <OfficeProvider>
                                <AccountProvider>
                                  <TyreProvider>
                                    <AuditLogProvider>
                                      <AppContentWrapper />
                                    </AuditLogProvider>
                                  </TyreProvider>
                                </AccountProvider>
                              </OfficeProvider>
                            </ExpenseProvider>
                          </DriverProvider>
                        </TruckProvider>
                      </TripProvider>
                    </NavigationManager>
                  </DialogManager>
                </SettingsManager>
              </ThemeProvider>
            </NotificationProvider>
          </OrganizationProvider>
        </PermissionProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

function AppContentWrapper() {
  onMount(() => {
    trackUniqueVisitor();
  });

  const nav = useNavigation();
  const perm = usePermissions();
  const currentUserOrgId = () => perm.currentUserRights()?.organizationId || '';
  const hasUsersTabAccess = () =>
    currentUserOrgId() === 'org_backend'
      ? !!perm.currentUserRights().canViewBackendTeam
      : !!perm.currentUserRights().isAdmin;

  let autoLockTimeout: any = null;

  function resetAutoLockTimer() {
    if (autoLockTimeout) {
      clearTimeout(autoLockTimeout);
    }
    if (dbUnlocked()) {
      autoLockTimeout = setTimeout(() => {
        console.log('Inactivity auto-lock triggered after 15 minutes');
        cryptoService.clearKey();
        setDbUnlocked(false);
      }, 15 * 60 * 1000); // 15 minutes
    }
  }

  // Monitor unlock state to start/stop the auto-lock timer
  createEffect(() => {
    if (dbUnlocked()) {
      resetAutoLockTimer();
    } else {
      if (autoLockTimeout) {
        clearTimeout(autoLockTimeout);
        autoLockTimeout = null;
      }
    }
  });

  onCleanup(() => {
    if (autoLockTimeout) {
      clearTimeout(autoLockTimeout);
    }
  });

  function touchLastModified() {
    if (currentUserOrgId() !== 'org_backend') {
      localStorage.setItem('ttt_last_modified_at', Date.now().toString());
    }
    sessionStorage.setItem('ttt_recent_action_at', Date.now().toString());
    resetAutoLockTimer();
  }

  return (
    <OrganizationManager activeTab={nav.activeTab} hasUsersTabAccess={hasUsersTabAccess}>
      <AuthManager touchLastModified={touchLastModified}>
        <NotificationManager>
          <AppContent touchLastModified={touchLastModified} />
        </NotificationManager>
      </AuthManager>
    </OrganizationManager>
  );
}

function AppContent(props: { touchLastModified: () => void }): any {
  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve states/methods from Scoped Managers
  const nav = useNavigation();
  const dialogs = useDialogs();
  const orgManager = useOrganizationManager();
  const authManager = useAuthManager();
  const notifications = useNotifications();

  const activeTab = nav.activeTab;
  const selectTab = nav.selectTab;
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

  const profileModalOpen = dialogs.profileModalOpen;
  const setProfileModalOpen = dialogs.setProfileModalOpen;
  const profileActiveTab = dialogs.profileActiveTab;
  const setProfileActiveTab = dialogs.setProfileActiveTab;

  const toastMessage = () => notifications.toastMessage();
  const showNotification = notifications.showNotification;

  const orgs = useOrganizations();

  const perm = usePermissions();
  const currentUserRights = perm.currentUserRights;

  const resetPasswordState = authManager.resetPasswordState;
  const setResetPasswordState = authManager.setResetPasswordState;
  const handleLogout = authManager.handleLogout;
  const checkUserApproval = authManager.checkUserApproval;
  const handleRegisterUserPermissions = authManager.handleRegisterUserPermissions;
  const handleRequestToJoinOrganization = authManager.handleRequestToJoinOrganization;
  const reconcileSession = authManager.reconcileSession;

  const currentUserOrgId = createMemo(() => currentUserRights()?.organizationId || '');

  const [autoUnlocking, setAutoUnlocking] = createSignal(true);
  const [showUnlockFlow, setShowUnlockFlow] = createSignal(false);
  const [showSetupFlow, setShowSetupFlow] = createSignal(false);

  onMount(async () => {
    // 1. Mobile secure key recovery or desktop auto-unlock
    if (cryptoService.isMobile()) {
      const key = await cryptoService.getOrGenerateMobileKey();
      if (key) {
        cryptoService.setKey(key);
        setDbUnlocked(true);
        db.prewarmCache().catch(() => {});
      }
    } else {
      const unlocked = await cryptoService.tryAutoUnlock();
      if (unlocked) {
        setDbUnlocked(true);
        db.prewarmCache().catch(() => {});
      }
    }
    setAutoUnlocking(false);

    // 2. Session recovery
    setLoadingUser(true);
    try {
      if (isAppwriteConfigured()) {
        const user = await appwrite.getCurrentUser();
        if (user) {
          await reconcileSession(user);
        } else {
          setCurrentUser(null);
        }
      } else {
        const mockUserStr = localStorage.getItem('ttt_mock_user');
        if (mockUserStr) {
          const user = JSON.parse(mockUserStr);
          await reconcileSession(user);
        } else {
          setCurrentUser(null);
        }
      }
    } catch (e) {
      console.warn("Session recovery failed:", e);
      setCurrentUser(null);
    } finally {
      setLoadingUser(false);
    }
  });

  // Monitor unlock requirements
  createEffect(() => {
    console.log("Monitor unlock effect triggered:", {
      autoUnlocking: autoUnlocking(),
      loadingUser: loadingUser(),
      currentUser: !!currentUser(),
      hasKey: cryptoService.hasKey()
    });
    if (autoUnlocking() || loadingUser()) return;
    if (currentUser()) {
      if (!cryptoService.hasKey()) {
        const hasPinSetup = !!localStorage.getItem('ttt_pin_verify');
        console.log("Database is locked. Pin setup exists:", hasPinSetup);
        if (hasPinSetup) {
          setShowUnlockFlow(true);
          setShowSetupFlow(false);
        } else {
          setShowSetupFlow(true);
          setShowUnlockFlow(false);
        }
      } else {
        console.log("Database has key. Unlocking UI.");
        setShowUnlockFlow(false);
        setShowSetupFlow(false);
      }
    } else {
      console.log("No current user logged in.");
      setShowUnlockFlow(false);
      setShowSetupFlow(false);
    }
  });

  const isVerificationPending = createMemo(() => {
    const user = currentUser();
    const rights = currentUserRights();
    if (!user || !rights) return false;
    return rights.isApproved && (
      (!rights.isEmailVerified && user.emailVerification !== true) ||
      (!rights.isPhoneVerified && user.phoneVerification !== true)
    );
  });

  // Org status helper
  const isOrgDisabled = createMemo(() => {
    const orgId = currentUserOrgId();
    if (!orgId) return false;
    const profile = orgs.organizationProfiles().find((p) => p.organizationId === orgId);
    return profile ? profile.status === 'Disabled' : false;
  });

  const trucksCtx = useTrucksContext();
  const driversCtx = useDriversContext();
  const tripsCtx = useTripsContext();
  const expensesCtx = useExpensesContext();
  const officesCtx = useOfficesContext();
  const accountsCtx = useAccountsContext();
  const tyresCtx = useTyresContext();
  const auditLogsCtx = useAuditLogsContext();

  const onLoadCloudState = (loaded: any, globalConfig: any, quiet = false) => {
    let didChange = false;
    if (globalConfig) {
      if (globalConfig.userRightsList) { perm.setUserRightsList(globalConfig.userRightsList); didChange = true; }
      if (globalConfig.organizationProfiles) { orgs.setOrganizationProfiles(globalConfig.organizationProfiles); didChange = true; }
    }
    if (typeof (window as any)._onConsoleCloudStateLoaded === 'function') {
      const consoleChanged = (window as any)._onConsoleCloudStateLoaded(loaded, globalConfig, quiet);
      if (consoleChanged) didChange = true;
    }
    return didChange;
  };

  return (
    <Suspense fallback={<LoadingTab />}>
      <Switch>
        <Match when={autoUnlocking()}>
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 text-white font-sans">
            <div class="flex flex-col items-center gap-3">
              <Loader class="w-8 h-8 animate-spin text-blue-500" />
              <p class="text-xs text-slate-400">Loading secure keystore...</p>
            </div>
          </div>
        </Match>

        <Match when={loadingUser() && location.pathname.startsWith('/console')}>
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 text-white font-sans">
            <div class="flex flex-col items-center gap-3">
              <Loader class="w-8 h-8 animate-spin text-blue-500" />
              <p class="text-xs text-slate-400">Verifying session credentials...</p>
            </div>
          </div>
        </Match>

        <Match when={showUnlockFlow()}>
          <OfflinePinModal
            mode="unlock"
            onSuccess={() => {
              setShowUnlockFlow(false);
              setDbUnlocked(true);
            }}
          />
        </Match>

        <Match when={showSetupFlow()}>
          <OfflinePinModal
            mode="setup"
            onSuccess={() => {
              setShowSetupFlow(false);
              setDbUnlocked(true);
            }}
          />
        </Match>

        <Match when={authManager.emailVerificationSuccess()}>
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
                  authManager.setEmailVerificationSuccess(false);
                  navigate(currentUser() ? '/console/dashboard' : '/login');
                }}
                class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/25 transition cursor-pointer"
              >
                Go to Console
              </button>
            </div>
          </div>
        </Match>

        <Match when={authManager.emailVerificationError()}>
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
                  {authManager.emailVerificationError()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  authManager.setEmailVerificationError(null);
                  navigate('/login');
                }}
                class="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Back to Login
              </button>
            </div>
          </div>
        </Match>

        <Match when={resetPasswordState() && resetPasswordState().active}>
          <PasswordResetScreen
            resetPasswordState={resetPasswordState()}
            setResetPasswordState={setResetPasswordState}
            setLoadingUser={setLoadingUser}
            showNotification={showNotification}
          />
        </Match>

        <Match when={['/terms', '/privacy', '/refunds', '/refund-policy'].includes(location.pathname)}>
          <LegalPage
            defaultTab={
              location.pathname === '/privacy'
                ? 'privacy'
                : location.pathname === '/refunds' || location.pathname === '/refund-policy'
                ? 'refunds'
                : 'terms'
            }
            onBack={() => navigate(currentUser() ? '/console/dashboard' : '/')}
          />
        </Match>

        <Match when={!currentUser()}>
          <Switch>
            <Match when={location.pathname === '/login'}>
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
            </Match>
            <Match when={true}>
              <LandingPage onEnterConsole={() => navigate('/login')} />
            </Match>
          </Switch>
        </Match>

        <Match when={isVerificationPending()}>
          <VerificationRequiredScreen
            currentUser={currentUser()}
            currentUserRights={currentUserRights() as any}
            userRightsList={perm.userRightsList()}
            setUserRightsList={perm.setUserRightsList}
            setOrganizationProfiles={orgs.setOrganizationProfiles}
            pushPermissionsToCloud={perm.pushPermissions}
            reconcileSession={reconcileSession}
            showNotification={showNotification}
            toastMessage={notifications.toastMessage}
            emailTimer={authManager.emailTimer()}
            setEmailTimer={authManager.setEmailTimer}
            phoneTimer={authManager.phoneTimer()}
            setPhoneTimer={authManager.setPhoneTimer}
            verificationOtpSent={authManager.verificationOtpSent()}
            setVerificationOtpSent={authManager.setVerificationOtpSent}
            showPhoneUpdateModal={dialogs.showPhoneUpdateModal}
            setShowPhoneUpdateModal={dialogs.setShowPhoneUpdateModal}
            whatsappOtpCode={authManager.whatsappOtpCode()}
            setWhatsappOtpCode={authManager.setWhatsappOtpCode}
            sendWhatsAppOTP={async (phone) => { await authManager.sendWhatsAppOTP(phone); }}
            handlePhoneUpdateSubmit={authManager.handlePhoneUpdateSubmit}
            handleLogout={handleLogout}
            setLoadingUser={setLoadingUser}
          />
        </Match>

        <Match when={isOrgDisabled() && !currentUserRights().isSuperAdmin}>
          <OrgDisabledScreen
            currentUserOrgId={() => currentUserOrgId()}
            setOrganizationProfiles={orgs.setOrganizationProfiles}
            onLogout={handleLogout}
          />
        </Match>

        <Match when={!currentUserRights().isApproved}>
          <PendingApprovalScreen
            currentUserRights={currentUserRights() as any}
            onLogout={handleLogout}
            onRequestToJoinOrganization={handleRequestToJoinOrganization}
            showNotification={showNotification}
          />
        </Match>

        <Match when={true}>
          <Suspense fallback={<LoadingTab />}>
            <ConsoleAppWrapper />
          </Suspense>
        </Match>
      </Switch>
    </Suspense>
  );
}
