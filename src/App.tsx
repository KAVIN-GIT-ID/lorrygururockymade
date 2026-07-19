import { createSignal, createEffect, lazy, Suspense, onMount, onCleanup, createMemo, untrack } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { CheckCircle, AlertCircle, Loader } from 'lucide-solid';

import logo from './logo.png';

import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionProvider, usePermissions } from './context/PermissionContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { OrganizationProvider, useOrganizations } from './context/OrganizationContext';

import { SettingsManager, useSettings } from './managers/SettingsManager';
import { DialogManager, useDialogs } from './managers/DialogManager';
import { NavigationManager, useNavigation } from './managers/NavigationManager';
import { OrganizationManager, useOrganizationManager } from './managers/OrganizationManager';
import { AuthManager, useAuthManager } from './managers/AuthManager';
import { NotificationManager } from './managers/NotificationManager';

import { isAppwriteConfigured } from './lib/appwriteConfig';
import versionData from './version.json';
const APP_VERSION = versionData.version;

// Dynamic routes and pages
const LandingPage = lazy(() => import('./components/LandingPage'));
const LoginScreen = lazy(() => import('./components/LoginScreen'));
const LegalPage = lazy(() => import('./components/LegalPage'));
const PasswordResetScreen = lazy(() => import('./components/PasswordResetScreen'));
const VerificationRequiredScreen = lazy(() => import('./components/VerificationRequiredScreen'));
const OrgDisabledScreen = lazy(() => import('./components/OrgDisabledScreen'));
const PendingApprovalScreen = lazy(() => import('./components/PendingApprovalScreen'));

// Lazy load the entire Console application wrapper (including Dexie + context providers)
const ConsoleAppWrapper = lazy(() =>
  import('./components/ConsoleApp').then((m) => ({ default: m.ConsoleAppWrapper }))
);

const LoadingTab = () => (
  <div class="flex items-center justify-center p-12 h-64">
    <Loader class="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <PermissionProvider>
        <OrganizationProvider>
          <NotificationProvider>
            <ThemeProvider>
              <SettingsManager>
                <DialogManager>
                  <NavigationManager>
                    <AppContentWrapper />
                  </NavigationManager>
                </DialogManager>
              </SettingsManager>
            </ThemeProvider>
          </NotificationProvider>
        </OrganizationProvider>
      </PermissionProvider>
    </AuthProvider>
  );
}

function AppContentWrapper() {
  const nav = useNavigation();
  const perm = usePermissions();
  const currentUserOrgId = () => perm.currentUserRights()?.organizationId || '';
  const hasUsersTabAccess = () =>
    currentUserOrgId() === 'org_backend'
      ? !!perm.currentUserRights().canViewBackendTeam
      : !!perm.currentUserRights().isAdmin;

  function touchLastModified() {
    if (currentUserOrgId() !== 'org_backend') {
      localStorage.setItem('ttt_last_modified_at', Date.now().toString());
    }
    sessionStorage.setItem('ttt_recent_action_at', Date.now().toString());
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

  // Org status helper
  const isOrgDisabled = createMemo(() => {
    const orgId = currentUserOrgId();
    if (!orgId) return false;
    const profile = orgs.organizationProfiles().find((p) => p.organizationId === orgId);
    return profile ? profile.status === 'Disabled' : false;
  });

  return () => (
    <Suspense fallback={<LoadingTab />}>
      {(() => {
        if (authManager.emailVerificationSuccess()) {
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
                    authManager.setEmailVerificationSuccess(false);
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

        if (authManager.emailVerificationError()) {
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

        const isConsoleRoute = () => location.pathname.startsWith('/console');

        if (loadingUser() && isConsoleRoute()) {
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
          const defaultTab =
            location.pathname === '/privacy'
              ? 'privacy'
              : location.pathname === '/refunds' || location.pathname === '/refund-policy'
              ? 'refunds'
              : 'terms';
          return (
            <LegalPage
              defaultTab={defaultTab}
              onBack={() => navigate(currentUser() ? '/console/dashboard' : '/')}
            />
          );
        }

        if (!currentUser()) {
          if (location.pathname === '/login') {
            return (
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
            );
          }
          return <LandingPage onEnterConsole={() => navigate('/login')} />;
        }

        const isVerificationPending =
          currentUser() &&
          currentUserRights()?.isApproved &&
          ((!currentUserRights().isEmailVerified && currentUser().emailVerification !== true) ||
            (!currentUserRights().isPhoneVerified && currentUser().phoneVerification !== true));

        if (isVerificationPending) {
          return (
            <VerificationRequiredScreen
              currentUser={currentUser()}
              currentUserRights={currentUserRights() as any}
              userRightsList={perm.userRightsList()}
              setUserRightsList={perm.setUserRightsList}
              setOrganizationProfiles={orgs.setOrganizationProfiles}
              pushPermissionsToCloud={perm.pushPermissions}
              reconcileSession={reconcileSession}
              showNotification={showNotification}
              toastMessage={toastMessage()}
              emailTimer={authManager.emailTimer()}
              setEmailTimer={authManager.setEmailTimer}
              phoneTimer={authManager.phoneTimer()}
              setPhoneTimer={authManager.setPhoneTimer}
              verificationOtpSent={authManager.verificationOtpSent()}
              setVerificationOtpSent={authManager.setVerificationOtpSent}
              showPhoneUpdateModal={dialogs.showPhoneUpdateModal()}
              setShowPhoneUpdateModal={dialogs.setShowPhoneUpdateModal}
              whatsappOtpCode={authManager.whatsappOtpCode()}
              setWhatsappOtpCode={authManager.setWhatsappOtpCode}
              sendWhatsAppOTP={async (phone) => { await authManager.sendWhatsAppOTP(phone); }}
              handlePhoneUpdateSubmit={authManager.handlePhoneUpdateSubmit}
              handleLogout={handleLogout}
              setLoadingUser={setLoadingUser}
            />
          );
        }

        if (currentUser() && isOrgDisabled() && !currentUserRights().isSuperAdmin) {
          return (
            <OrgDisabledScreen
              currentUserOrgId={() => currentUserOrgId()}
              onLogout={handleLogout}
            />
          );
        }

        if (currentUser() && !currentUserRights().isApproved) {
          return (
            <PendingApprovalScreen
              currentUserRights={currentUserRights() as any}
              onLogout={handleLogout}
              onRequestToJoinOrganization={handleRequestToJoinOrganization}
              showNotification={showNotification}
            />
          );
        }

        // Render the authenticated console wrapper lazily
        return <ConsoleAppWrapper />;
      })()}
    </Suspense>
  );
}
