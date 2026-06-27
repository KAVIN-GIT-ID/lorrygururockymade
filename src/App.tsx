import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Truck, TripEntry, ExpenseEntry, AuditLog, UserPermission, OrganizationProfile, TruckRequest, createRecord, mutateRecord, SupportTicket } from './types';
import LoginScreen from './components/LoginScreen';
import LandingPage from './components/LandingPage';
import logo from './logo.png';
import { useNavigate, useLocation } from 'react-router-dom';
import ConnectionStatusBlocker from './components/ConnectionStatusBlocker';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionProvider, usePermissions } from './context/PermissionContext';
import { OrganizationProvider, useOrganizations } from './context/OrganizationContext';
import { useNotifications } from './hooks/useNotifications';
import { useCountdown } from './hooks/useCountdown';
import { migrationService } from './services/migrationService';
import { organizationService } from './services/organizationService';
import { cloudSyncService } from './services/cloudSyncService';

const Dashboard = lazy(() => import('./components/Dashboard'));
const TripList = lazy(() => import('./components/TripList'));
const TripForm = lazy(() => import('./components/TripForm'));
const TruckMaster = lazy(() => import('./components/TruckMaster'));
const DriverMaster = lazy(() => import('./components/DriverMaster'));
const OfficeMaster = lazy(() => import('./components/OfficeMaster'));
const AccountMaster = lazy(() => import('./components/AccountMaster'));
const ExpenseMaster = lazy(() => import('./components/ExpenseMaster'));
const MonthlyReport = lazy(() => import('./components/MonthlyReport'));
const AuditLogView = lazy(() => import('./components/AuditLogView'));
const TyreMaster = lazy(() => import('./components/TyreMaster'));
const UserAccessControl = lazy(() => import('./components/UserAccessControl'));
const isMobileTarget = import.meta.env.VITE_BUILD_TARGET === 'mobile';
const BackendDashboard = isMobileTarget
  ? () => null
  : lazy(() => import('./components/BackendDashboard'));
const BillingHistory = lazy(() => import('./components/BillingHistory'));
const VoiceAssistant = lazy(() => import('./components/VoiceAssistant'));
const LegalPage = lazy(() => import('./components/LegalPage'));

import Setup2FAModal from './components/Setup2FAModal';
import Disable2FAModal from './components/Disable2FAModal';

import OrgDisabledScreen from './components/OrgDisabledScreen';
import PendingApprovalScreen from './components/PendingApprovalScreen';
import PasswordResetScreen from './components/PasswordResetScreen';
import ConfirmModal from './components/ConfirmModal';
import AppSidebar from './components/AppSidebar';
import AppHeader from './components/AppHeader';
import VerificationRequiredScreen from './components/VerificationRequiredScreen';
import ProfileModal from './components/ProfileModal';
import MobileChangeWizardModal from './components/MobileChangeWizardModal';
import AppwriteCloudSync from './components/AppwriteCloudSync';
const AppUpdateModal = lazy(() => import('./components/AppUpdateModal'));
import MobileBottomTabBar from './components/MobileBottomTabBar';
import MobileHomeTab from './components/MobileHomeTab';
import MobileAccountTab from './components/MobileAccountTab';
import MobileOutstandingView from './components/MobileOutstandingView';
import { appwrite, isAppwriteConfigured } from './lib/appwrite';
import versionData from './version.json';
const APP_VERSION = versionData.version;
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

import { generateSecret } from './utils/totp';

import {
  CheckCircle,
  AlertCircle,
  Loader,
  Sun,
  Moon,
  Bell,
  Plus,
  Truck as TruckIcon,
  UserPlus,
  Wrench,
  MapPin,
  CreditCard,
  Coins,
} from 'lucide-react';

const LoadingTab = () => (
  <div className="flex items-center justify-center p-12 h-64">
    <Loader className="w-8 h-8 animate-spin text-blue-500" />
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
  return (
    <AuthProvider>
      <PermissionProvider>
        <OrganizationProvider>
          <AppContent />
        </OrganizationProvider>
      </PermissionProvider>
    </AuthProvider>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
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
    reconcileUserSession
  } = useAuth();

  const {
    userRightsList,
    setUserRightsList,
    currentUserRights,
    addPermission: handleAddPermission,
    updatePermission: handleUpdatePermission,
    deletePermission: handleDeletePermission,
    pushPermissions: pushPermissionsToCloud
  } = usePermissions();

  if (import.meta.env.DEV) {
    console.log("DEBUG RENDER AppContent currentUserRights:", currentUserRights);
  }

  const {
    organizationProfiles,
    setOrganizationProfiles,
    saveProfiles: saveOrganizationProfiles
  } = useOrganizations();

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileActiveTab, setProfileActiveTab] = useState<'SETTINGS' | 'SUPPORT'>('SETTINGS');
  const [emailVerificationSuccess, setEmailVerificationSuccess] = useState(false);
  const [emailVerificationError, setEmailVerificationError] = useState<string | null>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const {
    toastMessage,
    showNotification,
    notificationOpen,
    setNotificationOpen,
    lastReadNotificationTime,
    updateLastReadNotificationTime,
    notificationRef
  } = useNotifications(currentUser?.email);
  const [verificationOtpSent, setVerificationOtpSent] = useState(false);
  const [whatsappOtpCode, setWhatsappOtpCode] = useState<string | null>(null);
  const [whatsappOtpPhone, setWhatsappOtpPhone] = useState<string | null>(null);
  const [showPhoneUpdateModal, setShowPhoneUpdateModal] = useState(false);
  const emailTimerHook = useCountdown(0);
  const phoneTimerHook = useCountdown(0);
  const mobileWizardTimerHook = useCountdown(0);

  const emailTimer = emailTimerHook.seconds;
  const setEmailTimer = emailTimerHook.start;
  const phoneTimer = phoneTimerHook.seconds;
  const setPhoneTimer = phoneTimerHook.start;
  const mobileWizardTimer = mobileWizardTimerHook.seconds;
  const setMobileWizardTimer = mobileWizardTimerHook.start;

  // Mobile Change Wizard States
  const [mobileWizardOpen, setMobileWizardOpen] = useState(false);
  const [mobileWizardStep, setMobileWizardStep] = useState(1);
  const [mobileWizardCode, setMobileWizardCode] = useState('');
  const [mobileWizardNewPhone, setMobileWizardNewPhone] = useState('');
  const [mobileWizardPassword, setMobileWizardPassword] = useState('');
  const [mobileWizardError, setMobileWizardError] = useState<string | null>(null);
  const [mobileWizardGeneratedOtp, setMobileWizardGeneratedOtp] = useState('');

  // 2FA Setup/Disable States
  const [setup2FAOpen, setSetup2FAOpen] = useState(false);
  const [setup2FASecret, setSetup2FASecret] = useState('');

  const [disable2FAOpen, setDisable2FAOpen] = useState(false);

  const [resetPasswordState, setResetPasswordState] = useState<{
    active: boolean;
    userId: string;
    secret: string;
  } | null>(null);

  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const verifiedTxns = useRef(new Set<string>());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

  // Profile KYC states
  const [profileGst, setProfileGst] = useState('');
  const [profilePan, setProfilePan] = useState('');
  const [profileAadhaar, setProfileAadhaar] = useState('');
  const [profileAddress, setProfileAddress] = useState('');

  // Payments State
  const [payments, setPayments] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('ttt_payments');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const savePayments = (nextPayments: any[]) => {
    setPayments(nextPayments);
    localStorage.setItem('ttt_payments', JSON.stringify(nextPayments));
  };

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
      const currentOrgId = currentUserRights?.organizationId || '';
      const orgProfile = organizationProfiles.find(p => p.organizationId === currentOrgId);
      setProfileOrgName(orgProfile ? orgProfile.organizationName : '');
      setProfileGst(orgProfile?.gstNo || '');
      setProfilePan(orgProfile?.panNo || '');
      setProfileAadhaar(orgProfile?.aadhaarNo || '');
      setProfileAddress(orgProfile?.address || '');
    }
  }, [profileModalOpen, currentUser, currentUserRights, organizationProfiles]);

  const saveUserRightsList = (nextList: UserPermission[]) => {
    setUserRightsList(nextList);
    localStorage.setItem('ttt_user_rights', JSON.stringify(nextList));
  };

  const reconcileSession = async (user: any, freshRightsList?: UserPermission[]) => {
    return reconcileUserSession(
      user,
      freshRightsList || userRightsList,
      setUserRightsList,
      organizationProfiles,
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
  useEffect(() => {
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
        console.warn('Appwrite user authentication verification bypassed/offline:', err);
        setInitialPullDone(true);
      } finally {
        setLoadingUser(false);
      }
    };
    initAuth();
  }, []);

  // Synchronize location.pathname with view and tab state
  useEffect(() => {
    const path = location.pathname;
    const publicLegalPaths = ['/terms', '/privacy', '/refunds', '/refund-policy'];

    // Auth guarding
    if (!currentUser && !loadingUser) {
      if (path.startsWith('/console')) {
        navigate('/login');
      } else if (path !== '/' && path !== '/login' && !publicLegalPaths.includes(path)) {
        navigate('/');
      }
      return;
    }

    if (currentUser && !loadingUser) {
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
  }, [location.pathname, currentUser, loadingUser]);

  const handleEmailVerificationRedirect = async (userId: string, secret: string) => {
    setLoadingUser(true);
    try {
      if (isAppwriteConfigured()) {
        await appwrite.updateVerification(userId, secret);
        showNotification("Email verified successfully! You can now log in.");

        const user = await appwrite.getCurrentUser();
        if (user) {
          // Reconcile session fetches the latest cloud configs/rights list and updates user verification status safely
          await reconcileSession(user);
        }
      } else {
        showNotification("Mock Email verified successfully!");
        if (currentUser) {
          const email = (currentUser.email || '').toLowerCase().trim();
          const updated = userRightsList.map(ur =>
            ur.email.toLowerCase().trim() === email ? { ...ur, isEmailVerified: true } : ur
          );
          setUserRightsList(updated);
          localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
        }
      }
      setEmailVerificationSuccess(true);
    } catch (err: any) {
      console.error("Email verification failure:", err);
      setEmailVerificationError(err.message || err);
      showNotification(`Email verification failed: ${err.message || err}`);
    } finally {
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      setLoadingUser(false);
    }
  };

  const handleVerifyPhonePePayment = async (txnId: string, truckNo: string) => {
    try {
      showNotification("Verifying PhonePe payment status...");
      const serverUrl = import.meta.env.DEV ? '' : 'https://api.lorryguru.in/truck-backend';
      
      const tempPayloadStr = localStorage.getItem('ttt_temp_payment_payload');
      const tempPayloadObj = tempPayloadStr ? JSON.parse(tempPayloadStr) : null;
      const duration = localStorage.getItem('ttt_temp_payment_duration') || '1 Year';
      const existingTruckId = localStorage.getItem('ttt_temp_payment_truck_id') || '';

      const queryParams = new URLSearchParams({
        truckNo,
        organizationId: (currentUserRights?.organizationId) || 'org_default',
        duration,
        customerName: currentUser?.name || '',
        customerEmail: currentUser?.email || '',
        customerPhone: currentUser?.phone || '',
        existingTruckId,
        truckPayload: JSON.stringify(tempPayloadObj)
      });

      const response = await fetch(`${serverUrl}/api/payment/status/${txnId}?${queryParams.toString()}`);
      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.removeItem('ttt_temp_payment_payload');
        localStorage.removeItem('ttt_temp_payment_duration');
        localStorage.removeItem('ttt_temp_payment_truck_id');

        showNotification(`Payment verified! Truck ${truckNo} is now Active.`);

        if (data.expiryDate && tempPayloadObj) {
          const targetId = existingTruckId || ('tr_' + Date.now());
          setTrucks(prev => {
            const next = prev.map(t => t.id === targetId ? {
              ...t,
              ...tempPayloadObj,
              isApproved: true,
              requestStatus: 'Approved' as const,
              status: 'Active' as const,
              registrationExpiryDate: data.expiryDate
            } : t);
            localStorage.setItem('ttt_trucks', JSON.stringify(next));
            return next;
          });
        }
      } else {
        alert(`Payment Verification Failed: ${data.message || 'Transaction was not successful'}`);
      }

    } catch (err: any) {
      console.error('Verify Payment Error:', err);
      alert(`Error verifying payment: ${err.message}`);
    } finally {
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const userId = params.get('userId');
    const secret = params.get('secret');
    const txnId = params.get('txnId');
    const truckNo = params.get('truckNo');

    if (mode === 'recovery' && userId && secret) {
      setResetPasswordState({ active: true, userId, secret });
    } else if (mode === 'verify' && userId && secret) {
      handleEmailVerificationRedirect(userId, secret);
    } else if (txnId && truckNo) {
      // Handled by the PhonePePaymentModal inside TruckMaster component
    }
  }, [userRightsList, currentUserRights, currentUser]);




  const handleLogout = async () => {
    try {
      await appwrite.logout();
    } catch (err) {
      console.warn("Appwrite logout error:", err);
    }
    setCurrentUser(null);
    localStorage.clear();
    sessionStorage.clear();

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
    navigate('/');
  };



  const checkUserApproval = (email: string): { approved: boolean; orgId: string; registered: boolean } => {
    const match = userRightsList.find(ur => ur.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (match) {
      return { approved: match.isApproved, orgId: match.organizationId, registered: true };
    }
    return { approved: false, orgId: '', registered: false };
  };



  const sendWhatsAppOTP = async (phone: string) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    let gatewayHost = window.location.hostname;
    let gatewayProtocol = window.location.protocol;
    let useSubpath = false;

    const appwriteEndpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || '';
    if (appwriteEndpoint.includes('//')) {
      gatewayHost = appwriteEndpoint.split('//')[1].split('/')[0].split(':')[0];
      gatewayProtocol = appwriteEndpoint.split('//')[0];
      useSubpath = true;
    }

    const gatewayUrl = useSubpath
      ? `${gatewayProtocol}//${gatewayHost}/whatsapp-gateway/send-otp`
      : `${gatewayProtocol}//${gatewayHost}:8000/send-otp`;
    console.info(`[WhatsAppOTP] Requesting delivery of OTP: ${otp} to ${phone} via ${gatewayUrl}`);

    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKey: 'ft_92hf83hdkw9812hskd',
        phone: cleanPhone,
        code: otp
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to dispatch WhatsApp OTP.');
    }

    setWhatsappOtpCode(otp);
    setWhatsappOtpPhone(phone);
    sessionStorage.setItem('whatsapp_otp_code', otp);
    sessionStorage.setItem('whatsapp_otp_phone', phone);
  };

  const handlePhoneUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    const newPhone = target.newPhone.value.trim();
    const currentPassword = isAppwriteConfigured() ? target.currentPassword.value : '';

    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(newPhone)) {
      showNotification("Invalid phone number format. Must start with '+' and follow E.164 (e.g. +919876543210).");
      return;
    }

    try {
      if (isAppwriteConfigured()) {
        await appwrite.updatePhone(newPhone, currentPassword);

        // Fetch fresh user object to get the updated phone and verification status from Appwrite Auth
        const freshUser = await appwrite.getCurrentUser();
        if (freshUser) {
          await reconcileSession(freshUser);
        }

        const email = (currentUser.email || '').toLowerCase().trim();
        const updated = userRightsList.map(ur =>
          ur.email.toLowerCase().trim() === email ? { ...ur, phone: newPhone, isPhoneVerified: freshUser?.phoneVerification === true } : ur
        );
        setUserRightsList(updated);
        localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
        await pushPermissionsToCloud(updated);

        if (freshUser?.phoneVerification === true) {
          showNotification("Mobile number updated and automatically verified!");
        } else {
          await sendWhatsAppOTP(newPhone);
          setVerificationOtpSent(true);
          showNotification("Mobile number saved and verification OTP sent successfully via WhatsApp!");
        }
      } else {
        const email = (currentUser.email || '').toLowerCase().trim();
        const updated = userRightsList.map(ur =>
          ur.email.toLowerCase().trim() === email ? { ...ur, phone: newPhone } : ur
        );
        setUserRightsList(updated);
        localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
        setVerificationOtpSent(true);
        showNotification("Mobile number saved and verification OTP sent successfully!");
      }

      setPhoneTimer(120);
      setShowPhoneUpdateModal(false);
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed to update mobile number: ${err.message || err}`);
    }
  };

  const handleRegisterUserPermissions = async (name: string, email: string, phone: string, orgId: string, orgName?: string, dryRun = false): Promise<{ approved: boolean; orgId: string; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOrgId = orgId.trim();
    const trimmedOrgName = (orgName || '').trim();

    // 1. Pull the absolute latest cloud configs first to ensure we merge and do not overwrite existing users/orgs.
    let activeRights = userRightsList;
    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const data = await organizationService.fetchAllGlobalConfigs(databaseId);
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

    // 1c. Check duplicate mobile number to prevent creating orphan user accounts
    const cleanPhone = phone.trim().replace(/[^0-9+]/g, '');
    const phoneMatch = activeRights.find(ur => (ur.phone || '').trim().replace(/[^0-9+]/g, '') === cleanPhone);
    if (phoneMatch && cleanPhone) {
      return {
        approved: false,
        orgId: '',
        error: `Mobile number "${phone}" is already registered with another user account. Please check and choose a different number.`
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
          const data = await organizationService.fetchAllGlobalConfigs(databaseId);
          if (data && data.organizationProfiles && Array.isArray(data.organizationProfiles)) {
            activeProfiles = data.organizationProfiles;
          }
        } catch (e) {
          console.warn("Could not load latest profiles during join match:", e);
        }
      }

      const matchedProfile = activeProfiles.find(p =>
        p.organizationName.toLowerCase().trim() === trimmedOrgName.toLowerCase() ||
        p.organizationId.toLowerCase().trim() === trimmedOrgName.toLowerCase()
      );
      if (!matchedProfile) {
        return { approved: false, orgId: '', error: `No organization named "${trimmedOrgName}" was found. Please check spelling or contact Admin.` };
      }
      targetOrgId = matchedProfile.organizationId;
    } else if (trimmedOrgId === '') {
      let activeProfiles = organizationProfiles;
      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const data = await organizationService.fetchAllGlobalConfigs(databaseId);
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
      const orgIsValid = true; /* activeRights.some(ur => ur.organizationId === targetOrgId)
        || targetOrgId === 'org_default'
        || isBackendOrg */;

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



      const newPerm: UserPermission = {
        id: 'ur_' + Date.now(),
        email: trimmedEmail,
        name: name.trim(),
        phone: phone.trim(),
        isEmailVerified: false,
        isPhoneVerified: false,
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

      await pushPermissionsToCloud(updatedList, trimmedEmail);
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
        phone: phone.trim(),
        isEmailVerified: false,
        isPhoneVerified: false,
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
          console.error("Could not save new organization profile directly to Appwrite:", e);
        }
      }

      await pushPermissionsToCloud(updatedList, trimmedEmail);
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
        const data = await organizationService.fetchAllGlobalConfigs(databaseId);
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

    await pushPermissionsToCloud(updatedList, email);

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
        if (newPassword) {
          logAction('Edited', 'Password', (currentUser?.email || '').toLowerCase().trim(), `Your account password was updated successfully.`, currentUserRights?.organizationId || '');
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

      // Update organization name and KYC if user is Admin
      const currentOrgId = currentUserRights?.organizationId || '';
      if (currentUserRights.isAdmin && currentOrgId) {
        const nextProfiles = organizationProfiles.map(p =>
          p.organizationId === currentOrgId
            ? { 
                ...p, 
                organizationName: newOrgName && newOrgName.trim() ? newOrgName.trim() : p.organizationName,
                gstNo: profileGst.trim(),
                panNo: profilePan.trim(),
                aadhaarNo: profileAadhaar.trim(),
                address: profileAddress.trim()
              }
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
      console.error("DEBUG PROFILE UPDATE ERROR:", err);
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
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'TRIPS' | 'TRUCKS' | 'OFFICES' | 'ACCOUNTS' | 'DRIVERS' | 'EXPENSES' | 'REPORTS' | 'AUDIT' | 'TYRES' | 'USERS' | 'BACKEND' | 'BILLING'>('DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const selectTab = (tab: 'DASHBOARD' | 'TRIPS' | 'TRUCKS' | 'OFFICES' | 'ACCOUNTS' | 'DRIVERS' | 'EXPENSES' | 'REPORTS' | 'AUDIT' | 'TYRES' | 'USERS' | 'BACKEND' | 'BILLING') => {
    setActiveTab(tab);
    navigate(`/console/${tab.toLowerCase()}`);
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
    const isBackendUser = !!(currentUserRights.isSuperAdmin || currentUserOrgId === 'org_backend');
    const fallbackTab = isBackendUser ? 'BACKEND' : 'DASHBOARD';
    if (activeTab === 'USERS' && !hasUsersTabAccess) {
      setActiveTab(fallbackTab);
    } else if (activeTab === 'BACKEND' && !isBackendUser) {
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
    } else if (activeTab === 'BILLING' && !(currentUserRights.isAdmin || currentUserRights.isSuperAdmin || currentUserOrgId === 'org_backend')) {
      setActiveTab(fallbackTab);
    }
  }, [activeTab, currentUserRights, currentUserOrgId]);
  // Custom hooks managing operational states
  const { auditLogs, setAuditLogs, logAction, handleClearAuditLogs } = useAuditLogs({
    currentUser,
    currentUserOrgId,
    showNotification
  });
  const saveAuditLogs = setAuditLogs;

  // Support Tickets State
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => {
    try {
      const stored = localStorage.getItem('ttt_support_tickets');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const [appUpdateConfig, setAppUpdateConfig] = useState<{
    version: string;
    releaseNotes: string;
    downloadUrl: string;
    updatedAt?: string;
  } | null>(() => {
    try {
      const stored = localStorage.getItem('ttt_app_update_config');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

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

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [mobileTab, setMobileTab] = useState<'HOME' | 'TRIPS' | 'REGISTRY' | 'ACCOUNT'>('HOME');
  const [registrySubTab, setRegistrySubTab] = useState<string>('TRUCKS');

  const [fabOpened, setFabOpened] = useState(false);
  const [autoOpenFormTab, setAutoOpenFormTab] = useState<string | null>(null);

  const triggerOpenAddForm = (tabId: string) => {
    setRegistrySubTab(tabId);
    setAutoOpenFormTab(tabId);
    setFabOpened(false);
    
    // Fallback/Legacy button click timeout (runs concurrently for safety)
    setTimeout(() => {
      let btnId = '';
      let formQuery = '';
      if (tabId === 'TRUCKS') {
        btnId = 'btn-add-truck';
        formQuery = '#truck-form';
      } else if (tabId === 'DRIVERS') {
        btnId = 'btn-add-driver';
        formQuery = '#driver-form';
      } else if (tabId === 'EXPENSES') {
        btnId = 'btn-toggle-expense-form';
        formQuery = '#expense-registration-form';
      } else if (tabId === 'TYRES') {
        btnId = 'btn-add-tyre';
        formQuery = '#tyre-form';
      } else if (tabId === 'OFFICES') {
        btnId = 'btn-add-office';
        formQuery = '#office-form';
      } else if (tabId === 'ACCOUNTS') {
        btnId = 'btn-add-account';
        formQuery = '#account-form';
      }
      
      if (btnId) {
        const formExists = formQuery ? !!document.querySelector(formQuery) : false;
        if (!formExists) {
          const btn = document.getElementById(btnId);
          if (btn) {
            btn.click();
          }
        }
      }
    }, 200);
  };

  // Registry Touch Swipe / Anim refs
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const prevTabIdxRef = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    
    // Bypass swipe gestures on reports and outstanding subtabs to prevent scroll conflict
    if (registrySubTab === 'REPORTS' || registrySubTab === 'OUTSTANDING') {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }

    const diffX = e.changedTouches[0].clientX - touchStartXRef.current;
    const diffY = e.changedTouches[0].clientY - touchStartYRef.current;
    
    if (Math.abs(diffX) > 60 && Math.abs(diffY) < 40) {
      const tabs = ['TRUCKS', 'DRIVERS', 'EXPENSES', 'OUTSTANDING', 'REPORTS', 'TYRES', 'OFFICES', 'ACCOUNTS', 'AUDIT'];
      const currentIdx = tabs.indexOf(registrySubTab);
      if (diffX < 0) {
        if (currentIdx < tabs.length - 1) {
          setRegistrySubTab(tabs[currentIdx + 1]);
        }
      } else {
        if (currentIdx > 0) {
          setRegistrySubTab(tabs[currentIdx - 1]);
        }
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Native back button intercept using Capacitor App plugin
  useEffect(() => {
    let backListener: any = null;

    const setupBackButton = async () => {
      try {
        const isCapacitor = typeof window !== 'undefined' && (window.location.protocol === 'capacitor:' || !!(window as any).Capacitor);
        if (!isCapacitor) return;

        // Dynamically import @capacitor/app to prevent issues on non-mobile platforms
        const { App: CapApp } = await import('@capacitor/app');

        backListener = await CapApp.addListener('backButton', (data) => {
          // 1. Dispatch custom event for child views/modals to handle
          const customEvent = new CustomEvent('app-back-press', {
            cancelable: true
          });
          window.dispatchEvent(customEvent);

          if (customEvent.defaultPrevented) {
            // Event was handled by a modal/sub-view, do not close the app
            return;
          }

          // 2. If no custom handlers, check if we can navigate back in tab states or exit app
          if (mobileTab !== 'HOME') {
            setMobileTab('HOME');
          } else if (data.canGoBack) {
            window.history.back();
          } else {
            CapApp.exitApp();
          }
        });
      } catch (err) {
        console.warn("Capacitor BackButton listener initialization failed:", err);
      }
    };

    setupBackButton();

    return () => {
      if (backListener && typeof backListener.remove === 'function') {
        backListener.remove();
      }
    };
  }, [mobileTab]);

  // Listen for native back button to dismiss modals
  useEffect(() => {
    const handleBackPress = (e: Event) => {
      let closedSomething = false;
      if (profileModalOpen) {
        setProfileModalOpen(false);
        closedSomething = true;
      }
      if (setup2FAOpen) {
        setSetup2FAOpen(false);
        closedSomething = true;
      }
      if (disable2FAOpen) {
        setDisable2FAOpen(false);
        closedSomething = true;
      }
      if (confirmModal) {
        setConfirmModal(null);
        closedSomething = true;
      }
      if (showPhoneUpdateModal) {
        setShowPhoneUpdateModal(false);
        closedSomething = true;
      }
      
      if (closedSomething) {
        e.preventDefault(); // Stop default action (don't exit app or navigate back)
      }
    };
    window.addEventListener('app-back-press', handleBackPress);
    return () => window.removeEventListener('app-back-press', handleBackPress);
  }, [profileModalOpen, setup2FAOpen, disable2FAOpen, confirmModal, showPhoneUpdateModal]);

  const renderAppUpdateModal = () => (
    <Suspense fallback={null}>
      <AppUpdateModal
        isOpen={
          typeof window !== 'undefined' &&
          (window.location.protocol === 'capacitor:' || !!(window as any).Capacitor || window.innerWidth < 768) &&
          !!appUpdateConfig &&
          isVersionNewer(APP_VERSION, appUpdateConfig.version) &&
          dismissedVersion !== appUpdateConfig.version
        }
        onClose={() => setDismissedVersion(appUpdateConfig?.version || null)}
        currentVersion={APP_VERSION}
        latestVersion={appUpdateConfig?.version || ''}
        releaseNotes={appUpdateConfig?.releaseNotes || ''}
        downloadUrl={appUpdateConfig?.downloadUrl || ''}
      />
    </Suspense>
  );

  const isVersionNewer = (current: string, latest: string) => {
    if (!current || !latest) return false;
    const currParts = current.split('.').map(Number);
    const lateParts = latest.split('.').map(Number);
    for (let i = 0; i < Math.max(currParts.length, lateParts.length); i++) {
      const curr = currParts[i] || 0;
      const late = lateParts[i] || 0;
      if (late > curr) return true;
      if (curr > late) return false;
    }
    return false;
  };

  useEffect(() => {
    const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';

    const fetchAppVersion = async () => {
      try {
        const config = await appwrite.loadGlobalConfig(databaseId, 'cfg_app_version');
        if (config) {
          localStorage.setItem('ttt_app_update_config', JSON.stringify(config));
          setAppUpdateConfig(config);
        }
      } catch (err) {
        console.warn("Failed to fetch app version config:", err);
      }
    };

    const handleUpdateEvent = (e: any) => {
      if (e.detail) {
        setAppUpdateConfig(e.detail);
      }
    };

    const handleResume = () => {
      console.log("App resumed/focused: checking for update configuration...");
      fetchAppVersion();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResume();
      }
    };

    // 1. Initial check on mount/load
    fetchAppVersion();

    // 2. Listeners
    window.addEventListener('ttt_app_update_event', handleUpdateEvent);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('resume', handleResume);
    window.addEventListener('focus', handleResume);

    // 3. Periodic check (every 3 minutes) while app is open
    const interval = setInterval(fetchAppVersion, 3 * 60 * 1000);

    return () => {
      window.removeEventListener('ttt_app_update_event', handleUpdateEvent);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('resume', handleResume);
      window.removeEventListener('focus', handleResume);
      clearInterval(interval);
    };
  }, []);


  const handleSaveAppUpdateConfig = async (config: any) => {
    try {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      const payload = {
        key: 'cfg_app_version',
        ...config
      };
      await appwrite.saveGlobalConfig(databaseId, 'cfg_app_version', payload);
      setAppUpdateConfig(payload);
      localStorage.setItem('ttt_app_update_config', JSON.stringify(payload));
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('ttt_app_update_event', { detail: payload }));
      }
    } catch (err: any) {
      console.error("Failed to save app update config:", err);
      throw err;
    }
  };

  const saveSupportTickets = (nextTicketsOrFn: SupportTicket[] | ((prev: SupportTicket[]) => SupportTicket[])) => {
    const nextTickets = typeof nextTicketsOrFn === 'function' ? nextTicketsOrFn(supportTickets) : nextTicketsOrFn;

    // Find modified or new tickets to sync to Appwrite
    const changedTickets = nextTickets.filter(t => {
      const existing = supportTickets.find(x => x.id === t.id);
      return !existing || JSON.stringify(existing) !== JSON.stringify(t);
    });

    // Find deleted tickets
    const deletedTickets = supportTickets.filter(t => !nextTickets.some(x => x.id === t.id));

    setSupportTickets(nextTickets);
    localStorage.setItem('ttt_support_tickets', JSON.stringify(nextTickets));

    if (isAppwriteConfigured()) {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      
      if (changedTickets.length > 0) {
        changedTickets.forEach(async (t) => {
          try {
            await appwrite.saveFleetDocument(databaseId, 'support_tickets', t.id, t.organizationId, t);
          } catch (err) {
            console.error(`Failed to sync support ticket ${t.id} to Appwrite:`, err);
          }
        });
      }

      if (deletedTickets.length > 0) {
        deletedTickets.forEach(async (t) => {
          try {
            await appwrite.deleteFleetDocument(databaseId, 'support_tickets', t.id);
          } catch (err) {
            console.error(`Failed to delete support ticket ${t.id} from Appwrite:`, err);
          }
        });
      }
    }
  };

  const handleInitiateRefund = async (orgId: string, truckNo: string, paymentRecord: any) => {
    try {
      showNotification("Initiating refund via PhonePe gateway...");
      
      const serverUrl = import.meta.env.DEV ? '' : 'https://api.lorryguru.in/truck-backend';
      const response = await fetch(`${serverUrl}/api/payment/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalTransactionId: paymentRecord.transactionId,
          amount: paymentRecord.amount
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Refund request failed');
      }

      const refundId = data.refundId || ('REF' + Date.now());

      // Update payment record in local state & storage
      const nextPayments = payments.map(p => {
        if (p.id === paymentRecord.id) {
          return {
            ...p,
            status: 'Refunded',
            refundId,
            refundStatus: 'Initiated',
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      });
      savePayments(nextPayments);

      // Also save to Appwrite if configured
      if (isAppwriteConfigured()) {
        try {
          await appwrite.saveFleetDocument('fleet_db', 'payments', paymentRecord.id, orgId, {
            ...paymentRecord,
            status: 'Refunded',
            refundId,
            refundStatus: 'Initiated',
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("Failed to sync refunded payment to Appwrite:", err);
        }
      }

      // Reset the truck's subscription expiry (set to yesterday / expired, request status as Rejected, status as Inactive)
      const targetTruck = trucks.find(t => t.truckNo.toUpperCase() === truckNo.toUpperCase() && t.organizationId === orgId);
      if (targetTruck) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const updatedTruck = {
          ...targetTruck,
          registrationExpiryDate: yesterdayStr,
          status: 'Inactive' as const,
          requestStatus: 'Rejected' as const,
          isApproved: false,
          updatedAt: new Date().toISOString()
        };

        setTrucks(prev => {
          const next = prev.map(t => t.id === targetTruck.id ? updatedTruck : t);
          localStorage.setItem('ttt_trucks', JSON.stringify(next));
          return next;
        });

        if (isAppwriteConfigured()) {
          try {
            await appwrite.saveFleetDocument('fleet_db', 'trucks', targetTruck.id, orgId, updatedTruck);
          } catch (err) {
            console.error("Failed to sync deactivated truck to Appwrite:", err);
          }
        }
      }

      // Auto-raise Billing Support Ticket
      const ticketId = 'tkt_' + Date.now();
      const ticketNo = 'TKT-' + Math.floor(100000 + Math.random() * 900000);
      const ticketTitle = `Refund Processed for Truck ${truckNo}`;
      const ticketDescription = `A refund of ₹${paymentRecord.amount} has been initiated for the subscription of truck ${truckNo}. Refund Transaction ID: ${refundId}. The truck has been deactivated.`;

      const initialMessage = {
        id: `msg-${Date.now()}`,
        sender: 'Agent' as const,
        senderName: 'Billing Team',
        senderEmail: 'billing@lorryguru.com',
        content: ticketDescription,
        timestamp: new Date().toISOString(),
      };

      const newTicket: SupportTicket = {
        id: ticketId,
        ticketNo,
        organizationId: orgId,
        requesterName: paymentRecord.customerName || 'Organization Owner',
        requesterEmail: paymentRecord.customerEmail || '',
        requesterPhone: paymentRecord.customerPhone || '',
        category: 'Billing',
        title: ticketTitle,
        description: ticketDescription,
        status: 'Open',
        assignedTeam: 'Billing',
        messages: [initialMessage],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nextTickets = [newTicket, ...supportTickets];
      saveSupportTickets(nextTickets);

      logAction('Created', 'SupportTicket', newTicket.ticketNo, `Auto-raised refund billing ticket: ${ticketTitle}`, orgId);
      showNotification(`Refund initiated successfully. Refund ID: ${refundId}`);
    } catch (err: any) {
      console.error("Refund processing error:", err);
      alert(`Refund Error: ${err.message}`);
    }
  };

  const handleCreateSupportTicket = async (
    category: 'Technical' | 'Billing' | 'General',
    title: string,
    description: string,
    attachmentFile?: File
  ) => {
    let attachmentUrl = '';
    let attachmentName = '';
    const ticketId = 'tkt_' + Date.now();

    if (attachmentFile && isAppwriteConfigured()) {
      try {
        const customName = `ticket_attach_${ticketId}_initial`;
        attachmentUrl = await appwrite.uploadTicketFile(attachmentFile, customName);
        attachmentName = attachmentFile.name;
      } catch (err) {
        console.error('Failed to upload initial attachment:', err);
      }
    }

    const initialMessage = attachmentFile ? {
      id: `msg-${Date.now()}`,
      sender: 'User' as const,
      senderName: currentUser?.name || currentUser?.email || 'User',
      senderEmail: currentUser?.email || '',
      content: description,
      timestamp: new Date().toISOString(),
      attachmentUrl: attachmentUrl || undefined,
      attachmentName: attachmentName || undefined,
    } : null;

    const newTicket = createRecord<SupportTicket>({
      id: ticketId,
      ticketNo: 'TKT-' + Math.floor(100000 + Math.random() * 900000),
      organizationId: currentUserOrgId || '',
      requesterName: currentUser?.name || currentUser?.email || 'Unknown User',
      requesterEmail: currentUser?.email || '',
      requesterPhone: currentUserRights?.phone || '',
      category,
      title,
      description,
      status: 'Open',
      assignedTeam: category,
      messages: initialMessage ? [initialMessage] : [],
    }, currentUserId);

    const nextTickets = [newTicket, ...supportTickets];
    saveSupportTickets(nextTickets);
    logAction('Created', 'SupportTicket', newTicket.ticketNo, `Raised support ticket: ${title}`);
    showNotification(`Support ticket #${newTicket.ticketNo} raised successfully.`);
  };

  const getClientUnreadTicketsCount = () => {
    const myTickets = supportTickets.filter(st => currentUserOrgId === 'org_backend' || st.organizationId === currentUserOrgId);
    let totalUnread = 0;
    myTickets.forEach(t => {
      if (t.status === 'Closed') return;
      const msgs = t.messages || [];
      if (msgs.length === 0) return;
      const lastReadMsgId = localStorage.getItem(`ttt_tkt_read_${t.id}`);
      if (!lastReadMsgId) {
        const agentMsgsCount = msgs.filter(m => m.sender === 'Agent').length;
        if (agentMsgsCount > 0) totalUnread++;
      } else {
        const lastReadIndex = msgs.findIndex(m => m.id === lastReadMsgId);
        const unreadCount = msgs.slice(lastReadIndex + 1).filter(m => m.sender === 'Agent').length;
        if (unreadCount > 0) totalUnread++;
      }
    });
    return totalUnread;
  };

  const getAgentUnreadTicketsCount = () => {
    const myRights = userRightsList.find(u => u.email === currentUser?.email);
    const mySupportRoles = Array.isArray(myRights?.supportRole)
      ? myRights.supportRole
      : (typeof myRights?.supportRole === 'string' && myRights.supportRole !== 'None' && myRights.supportRole !== ''
        ? [myRights.supportRole]
        : []);
    const isSuperAdmin = myRights?.role === 'SuperAdmin';

    const filtered = supportTickets.filter(t => {
      if (isSuperAdmin) return true;
      return mySupportRoles.includes(t.assignedTeam as any);
    });

    let totalUnread = 0;
    filtered.forEach(t => {
      if (t.status === 'Closed') return;
      const msgs = t.messages || [];
      const lastReadMsgId = localStorage.getItem(`ttt_tkt_agent_read_${t.id}`);

      if (msgs.length === 0) {
        if (!lastReadMsgId) totalUnread++;
      } else {
        if (!lastReadMsgId) {
          const userMsgsCount = msgs.filter(m => m.sender === 'User').length;
          if (userMsgsCount > 0 || msgs.length > 0) totalUnread++;
        } else if (lastReadMsgId === 'read') {
          const userMsgsCount = msgs.filter(m => m.sender === 'User').length;
          if (userMsgsCount > 0) totalUnread++;
        } else {
          const lastReadIndex = msgs.findIndex(m => m.id === lastReadMsgId);
          const unreadCount = msgs.slice(lastReadIndex + 1).filter(m => m.sender === 'User').length;
          if (unreadCount > 0) totalUnread++;
        }
      }
    });
    return totalUnread;
  };


  const handleSendSupportTicketMessage = async (
    ticketId: string,
    content: string,
    attachmentFile?: File
  ) => {
    let attachmentUrl = '';
    let attachmentName = '';

    if (attachmentFile && isAppwriteConfigured()) {
      try {
        const customName = `ticket_attach_${ticketId}_${Date.now()}`;
        attachmentUrl = await appwrite.uploadTicketFile(attachmentFile, customName);
        attachmentName = attachmentFile.name;
      } catch (err) {
        console.error('Failed to upload attachment:', err);
      }
    }

    const myRights = userRightsList.find(u => u.email === currentUser?.email);
    const isSupportAgent = currentUserOrgId === 'org_backend' || myRights?.role === 'SuperAdmin';

    const newMessage = {
      id: `msg-${Date.now()}`,
      sender: (isSupportAgent ? 'Agent' : 'User') as 'User' | 'Agent',
      senderName: currentUser?.name || currentUser?.email || 'User',
      senderEmail: currentUser?.email || '',
      content,
      timestamp: new Date().toISOString(),
      attachmentUrl: attachmentUrl || undefined,
      attachmentName: attachmentName || undefined,
    };

    const nextTickets = supportTickets.map(t => {
      if (t.id === ticketId) {
        const updated = mutateRecord<SupportTicket>(t, {
          status: t.status === 'Closed' ? ('Open' as const) : t.status,
          messages: [...(t.messages || []), newMessage],
        }, currentUserId);
        return updated;
      }
      return t;
    });

    saveSupportTickets(nextTickets);
    logAction('Edited', 'SupportTicket', ticketId, `Sent message on support ticket`);
  };

  const currentUserId = currentUser?.$id || currentUser?.email || 'system';

  const { trips, setTrips, orgTrips, saveTrips, postTripEntry, deleteTripEntry } = useTrips({
    orgId: currentUserOrgId,
    showNotification,
    logAction,
    loadDashboardData,
    activeMonth,
    activeYear,
    currentUserId
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
    logAction,
    currentUserId
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
    activeYear,
    currentUserId
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
    pushFleetSnapshotNow,
    currentUserId
  });
  const [dashboardTrips, setDashboardTrips] = useState<TripEntry[]>([]);
  const [dashboardExpenses, setDashboardExpenses] = useState<ExpenseEntry[]>([]);

  async function loadDashboardData(month: string, year: string) {
    const orgId = currentUserOrgId || 'org_default';
    
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

  useEffect(() => {
    loadDashboardData(activeMonth, activeYear);
  }, [activeMonth, activeYear, currentUserOrgId, trips, expenses]);



  const approvedOrgTrucks = React.useMemo(() => orgTrucks.filter(t => t.isApproved !== false), [orgTrucks]);
  const orgUserRights = React.useMemo(() => userRightsList.filter(u => u.organizationId === currentUserOrgId), [userRightsList, currentUserOrgId]);
  const currentOrgProfile = React.useMemo(() => organizationProfiles.find(p => p.organizationId === currentUserOrgId), [organizationProfiles, currentUserOrgId]);
  const isOrgDisabled = currentOrgProfile ? currentOrgProfile.status === 'Disabled' : false;

  const canUserViewCategory = React.useCallback((category: string, logUserOrReference?: string, logDetails?: string): boolean => {
    const cat = category.toLowerCase();
    const currentUserEmail = (currentUser?.email || '').toLowerCase().trim();
    if (cat.includes('password')) {
      return (logUserOrReference || '').toLowerCase().trim() === currentUserEmail;
    }

    if (currentUserRights.isSuperAdmin) return true;

    // Check if this log specifically concerns the current logged-in user (e.g. their permissions or approval status changed)
    if (currentUserEmail) {
      const ref = (logUserOrReference || '').toLowerCase().trim();
      const det = (logDetails || '').toLowerCase().trim();
      if (ref === currentUserEmail || ref.includes(currentUserEmail) || det.includes(currentUserEmail)) {
        return true;
      }
    }

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
  }, [currentUser, currentUserRights]);

  const backendEmails = React.useMemo(() => new Set(
    userRightsList
      .filter(u => u.organizationId === 'org_backend')
      .map(u => u.email.toLowerCase().trim())
  ), [userRightsList]);

  const orgAuditLogs = React.useMemo(() => {
    return auditLogs
      .filter(l => {
        const currentUserEmail = (currentUser?.email || '').toLowerCase().trim();
        if (currentUserOrgId === 'org_backend') {
          const cat = (l.category || '').toLowerCase();
          if (cat.includes('password')) {
            return (l.reference || '').toLowerCase().trim() === currentUserEmail;
          }

          const isBackendUserAction = backendEmails.has((l.user || '').toLowerCase().trim());
          const isIncomingTruckRequest = l.category === 'Truck' && l.action === 'Created' && (l.details || '').includes('Requested activation');
          const isTruckApproveOrReject = l.category === 'Truck' && (l.action === 'Approved' || l.action === 'Rejected');

          return isBackendUserAction || isIncomingTruckRequest || isTruckApproveOrReject;
        }

        return l.organizationId === currentUserOrgId && canUserViewCategory(l.category, l.reference, l.details);
      })
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }, [auditLogs, currentUser, currentUserOrgId, backendEmails, canUserViewCategory]);

  const latestLogTime = React.useMemo(() => {
    if (orgAuditLogs.length === 0) return 0;
    const ts = orgAuditLogs[0]?.timestamp;
    if (!ts) return 0;
    try {
      return ts.includes('T')
        ? new Date(ts).getTime()
        : new Date(ts.replace(' ', 'T') + 'Z').getTime();
    } catch { return 0; }
  }, [orgAuditLogs]);

  const hasUnreadNotifications = latestLogTime > lastReadNotificationTime;

  const cyanCount = React.useMemo(() => {
    return currentUserRights.isAdmin
      ? orgUserRights.filter(u => !u.isApproved).length
      : orgTrips.filter(t => t.status === 'In Progress' || t.status === 'Pending').length;
  }, [currentUserRights, orgUserRights, orgTrips]);

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



  function touchLastModified() {
    if (currentUserOrgId !== 'org_backend') {
      localStorage.setItem('ttt_last_modified_at', Date.now().toString());
    }
    sessionStorage.setItem('ttt_recent_action_at', Date.now().toString());
  }

  async function pushFleetSnapshotNow() {
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
  }, [trips, initialPullDone]);



  const saveUserRightsListWithSync = (newList: UserPermission[]) => {
    saveUserRightsList(newList);
    pushPermissionsToCloud(newList);
  };

  const onLoadCloudState = (parsed: any, userRightsData?: any, quiet = false): boolean => {
    const orgId = currentUserOrgId || 'org_default';
    const email = (currentUser?.email || '').toLowerCase().trim();
    const isSuper = currentUserRights?.isSuperAdmin || currentUserOrgId === 'org_backend';

    const result = cloudSyncService.reconcile(
      parsed,
      userRightsData,
      quiet,
      currentUser,
      currentUserRights,
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
        supportTickets,
        userRightsList,
        organizationProfiles
      }
    );

    if (!result) return false;

    const hasChanged = (local: any[], next: any[] | undefined) => {
      if (!next) return false;
      if (local.length !== next.length) return true;
      return JSON.stringify(local) !== JSON.stringify(next);
    };

    if (result.userRightsList && hasChanged(userRightsList, result.userRightsList)) {
      setUserRightsList(result.userRightsList);
    }
    if (result.organizationProfiles && hasChanged(organizationProfiles, result.organizationProfiles)) {
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
    if (result.supportTickets && hasChanged(supportTickets, result.supportTickets)) {
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

    const truckId = existingTruck ? existingTruck.id : ('tr_' + Date.now());
    let updatedTruck: Truck;
    if (existingTruck) {
      updatedTruck = mutateRecord(existingTruck, {
        isApproved: true,
        requestStatus: 'Approved' as const,
        status: 'Active' as const,
        registrationExpiryDate: expiryStr,
        currentKM: (existingTruck.currentKM !== undefined && existingTruck.currentKM !== null && existingTruck.currentKM !== 0) ? existingTruck.currentKM : (requestItem?.currentKM || 0)
      }, currentUserId);
    } else {
      updatedTruck = createRecord<Truck>({
        id: truckId,
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
      }, currentUserId);
    }

    setTrucks(prev => {
      const exists = prev.some(t => t.organizationId === orgId && t.truckNo.toUpperCase() === truckNo.toUpperCase());
      const next = exists
        ? prev.map(t => t.id === truckId ? updatedTruck : t)
        : [...prev, updatedTruck];
      localStorage.setItem('ttt_trucks', JSON.stringify(next));
      return next;
    });

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        await appwrite.saveFleetDocument(databaseId, 'trucks', truckId, orgId, updatedTruck);
      } catch (err) {
        console.warn("Failed to push truck approval sync to database:", err);
      }
    }

    // Pass orgId as targetOrgId so the local log entry is stored under the correct org,
    // making it visible to the org's users in their activity feed.
    const detailsMsg = `Truck registration approved by system administrator for ${duration === '1Y' ? '1 Year' : duration === '6M' ? '6 Months' : duration === '3M' ? '3 Months' : '1 Month'}. Active until: ${expiryStr}`;
    logAction('Approved', 'Truck', truckNo, detailsMsg, orgId);
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

    // Update local state immediately
    setOrganizationProfiles(nextProfiles);
    localStorage.setItem('ttt_organization_profiles', JSON.stringify(nextProfiles));
    touchLastModified();

    let truckId = 'tr_' + Date.now();
    let rejectedTruckObj: Truck | null = null;

    if (truckNoToReject) {
      const existing = trucks.find(t => t.organizationId === orgId && t.truckNo.toUpperCase() === truckNoToReject.toUpperCase());
      if (existing) {
        truckId = existing.id;
        rejectedTruckObj = mutateRecord(existing, {
          isApproved: false,
          requestStatus: 'Rejected' as const,
          status: 'Inactive' as const
        }, currentUserId);
      } else {
        rejectedTruckObj = createRecord<Truck>({
          id: truckId,
          truckNo: truckNoToReject.toUpperCase(),
          organizationId: orgId,
          isApproved: false,
          requestStatus: 'Rejected',
          status: 'Inactive',
          make: reqItem?.make,
          model: reqItem?.model,
          type: reqItem?.type,
          currentKM: reqItem?.currentKM || 0
        }, currentUserId);
      }

      setTrucks(prev => {
        const otherOrgs = orgId === 'org_backend' ? [] : prev.filter(t => t.organizationId !== orgId && t.organizationId !== 'org_default');
        const thisOrg = prev.filter(t => t.organizationId === orgId);

        let nextOrg;
        if (existing) {
          nextOrg = thisOrg.map(t => t.id === truckId ? (rejectedTruckObj || t) : t);
        } else if (rejectedTruckObj) {
          nextOrg = [...thisOrg, rejectedTruckObj];
        } else {
          nextOrg = thisOrg;
        }

        const next = [...otherOrgs, ...nextOrg];
        localStorage.setItem('ttt_trucks', JSON.stringify(next));
        return next;
      });
    }

    // Trigger network requests concurrently
    if (isAppwriteConfigured()) {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      const targetProfile = nextProfiles.find(p => p.organizationId === orgId);
      const docId = appwrite.getOrgDocId(orgId);

      const syncPromises = [];
      if (targetProfile) {
        syncPromises.push(
          appwrite.saveGlobalConfig(databaseId, docId, targetProfile)
            .catch(err => console.warn("Failed to sync organization profile:", err))
        );
      }

      if (truckNoToReject && rejectedTruckObj) {
        syncPromises.push(
          appwrite.saveFleetDocument(databaseId, 'trucks', truckId, orgId, rejectedTruckObj)
            .catch(err => console.warn("Failed to push truck rejection sync:", err))
        );
      }

      Promise.all(syncPromises).then(() => {
        console.log("Rejection backend synchronization complete.");
      });
    }

    logAction('Rejected', 'Truck', truckNoToReject || orgId, 'Truck registration request rejected by system administrator.', orgId);
    showNotification(`✗ Truck request rejected for Org ${orgId}.`);
  };

  const handleBackendUpdateTruck = async (targetOrgId: string, updatedTruck: Truck) => {
    const startTime = performance.now();
    console.log(`[Timer] Start updating truck ${updatedTruck.truckNo} at ${new Date().toISOString()}`);

    const oldTruck = trucks.find(t => t.id === updatedTruck.id);
    const mutatedTruck = oldTruck
      ? mutateRecord(oldTruck, updatedTruck, currentUserId)
      : createRecord<Truck>({ ...updatedTruck, organizationId: targetOrgId } as any, currentUserId);

    setTrucks(prev => {
      const next = prev.map(t => t.id === mutatedTruck.id ? mutatedTruck : t);
      localStorage.setItem('ttt_trucks', JSON.stringify(next));
      return next;
    });
    console.log(`[Timer] Local state updated in ${(performance.now() - startTime).toFixed(1)}ms`);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';

        const saveStart = performance.now();
        console.log(`[Timer] Pushing truck document update to Appwrite proxy...`);
        await appwrite.saveFleetDocument(databaseId, 'trucks', mutatedTruck.id, targetOrgId, mutatedTruck);
        console.log(`[Timer] Appwrite proxy save completed in ${(performance.now() - saveStart).toFixed(1)}ms`);

        const auditStart = performance.now();
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
        console.log(`[Timer] Audit log saved in ${(performance.now() - auditStart).toFixed(1)}ms`);
      } catch (err: any) {
        console.error("Backend failed to push remote truck updates to database:", err);
        alert(`Error pushing truck updates to organization database: ${err.message}`);
      }
    }

    logAction('Edited', 'Truck', updatedTruck.truckNo, `Super Admin modified remote truck details for Org ${targetOrgId}. Status: ${updatedTruck.status}`, targetOrgId);
    showNotification(`Updated truck ${updatedTruck.truckNo} details.`);
    console.log(`[Timer] Total disable operation took ${(performance.now() - startTime).toFixed(1)}ms`);
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
      newTruckObj = mutateRecord(existingRejectedTruck, {
        ...truckPayload,
        isApproved: false,
        requestStatus: 'Rejected' as const,
        status: 'Inactive' as const,
        registrationExpiryDate: expiryStr
      }, currentUserId);
      setTrucks(prev => {
        const next = prev.map(t => t.id === targetTruckId ? newTruckObj : t);
        localStorage.setItem('ttt_trucks', JSON.stringify(next));
        return next;
      });
    } else {
      targetTruckId = (truckPayload as any).id || 'tr_' + Date.now();
      newTruckObj = createRecord<Truck>({
        ...truckPayload,
        id: targetTruckId,
        organizationId: currentUserOrgId,
        isApproved: false,
        requestStatus: 'Rejected' as const,
        status: 'Inactive' as const,
        registrationExpiryDate: expiryStr
      }, currentUserId);
      setTrucks(prev => {
        const next = [...prev, newTruckObj];
        localStorage.setItem('ttt_trucks', JSON.stringify(next));
        return next;
      });
    }

    touchLastModified();
    logAction('Created', 'Truck', truckPayload.truckNo, `Added unsubscribed vehicle to fleet database.`);
  };

  const handleProcessTruckPayment = async (
    truckPayload: Omit<Truck, 'id'>,
    paymentDetails: {
      transactionId: string;
      amount: number;
      duration: string;
      planName: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      paymentDate: string;
      status: string;
      paymentMethod?: string;
    },
    existingTruckId?: string | null
  ) => {
    const d = new Date();
    const durationStr = paymentDetails.duration;
    if (durationStr === '1 Month') {
      d.setMonth(d.getMonth() + 1);
    } else if (durationStr === '3 Months') {
      d.setMonth(d.getMonth() + 3);
    } else if (durationStr === '6 Months') {
      d.setMonth(d.getMonth() + 6);
    } else {
      d.setFullYear(d.getFullYear() + 1); // Default 1 Year
    }
    const expiryStr = d.toISOString().split('T')[0];

    let targetTruckId = existingTruckId || ('tr_' + Date.now());
    let newTruckObj: Truck;

    const existingTruck = trucks.find(t => t.id === targetTruckId);
    if (existingTruck) {
      newTruckObj = mutateRecord(existingTruck, {
        ...truckPayload,
        isApproved: true,
        requestStatus: 'Approved' as const,
        status: 'Active' as const,
        registrationExpiryDate: expiryStr
      }, currentUserId);
      setTrucks(prev => {
        const next = prev.map(t => t.id === targetTruckId ? newTruckObj : t);
        localStorage.setItem('ttt_trucks', JSON.stringify(next));
        return next;
      });
    } else {
      newTruckObj = createRecord<Truck>({
        ...truckPayload,
        id: targetTruckId,
        organizationId: currentUserOrgId,
        isApproved: true,
        requestStatus: 'Approved' as const,
        status: 'Active' as const,
        registrationExpiryDate: expiryStr
      }, currentUserId);
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
      status: 'Approved',
      make: truckPayload.make,
      model: truckPayload.model,
      type: truckPayload.type,
      currentKM: truckPayload.currentKM
    };

    const nextProfiles = organizationProfiles.map(p => {
      if (p.organizationId === currentUserOrgId) {
        const cleanedRequests = (p.truckRequests || []).filter(
          r => r.truckNo.toUpperCase() !== truckPayload.truckNo.toUpperCase()
        );
        return {
          ...p,
          truckRequests: [...cleanedRequests, requestItem]
        };
      }
      return p;
    });

    try {
      await saveOrganizationProfiles(nextProfiles);
    } catch (err) {
      console.warn("Failed to update organization profiles truck requests, continuing...", err);
    }

    // Map payment method to account
    const activeAccounts = orgAccounts.filter(a => a.status === 'Active');
    let matchedAccount = activeAccounts.find(a => {
      if (paymentDetails.paymentMethod === 'upi') {
        return a.type === 'Digital Wallets';
      } else if (paymentDetails.paymentMethod === 'card' || paymentDetails.paymentMethod === 'netbanking') {
        return a.type === 'Bank';
      }
      return false;
    });

    if (!matchedAccount) {
      matchedAccount = activeAccounts.find(a => 
        paymentDetails.paymentMethod === 'upi' ? a.type === 'Digital Wallets' : a.type === 'Bank'
      ) || activeAccounts[0];
    }

    const paymentModeName = matchedAccount 
      ? matchedAccount.accountName 
      : (paymentDetails.paymentMethod === 'upi' ? 'Digital Wallets' : 'Bank');

    // Auto-register expense
    try {
      await addExpense({
        truckNo: truckPayload.truckNo.toUpperCase(),
        expenseType: 'Temporary',
        shopName: 'Lorry Guru Technologies',
        amount: paymentDetails.amount,
        paymentMode: paymentModeName,
        date: new Date().toISOString().split('T')[0],
        status: 'Paid',
        notes: `Subscription payment (${paymentDetails.duration}) for truck ${truckPayload.truckNo.toUpperCase()}. Transaction ID: ${paymentDetails.transactionId}. Mode: ${paymentDetails.paymentMethod || 'PhonePe'}`
      });
    } catch (expErr) {
      console.error("Failed to auto-log payment as expense:", expErr);
    }

    const paymentRecord = {
      id: 'pay_' + Date.now(),
      organizationId: currentUserOrgId,
      truckNo: truckPayload.truckNo.toUpperCase(),
      amount: paymentDetails.amount,
      transactionId: paymentDetails.transactionId,
      paymentDate: paymentDetails.paymentDate,
      duration: paymentDetails.duration,
      status: paymentDetails.status,
      customerEmail: paymentDetails.customerEmail,
      customerName: paymentDetails.customerName,
      customerPhone: paymentDetails.customerPhone,
      paymentMethod: paymentDetails.paymentMethod || 'upi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const nextPayments = [paymentRecord, ...payments];
    savePayments(nextPayments);

    if (isAppwriteConfigured()) {
      try {
        await appwrite.saveFleetDocument(
          'fleet_db',
          'payments',
          paymentRecord.id,
          currentUserOrgId,
          paymentRecord
        );
      } catch (err) {
        console.error("Failed to save payment record in Appwrite:", err);
      }
    }

    logAction('Created', 'Truck', truckPayload.truckNo, `Paid ₹${paymentDetails.amount} via PhonePe. Auto-approved and validity extended to ${expiryStr}`);
    showNotification(`Truck ${truckPayload.truckNo} successfully activated! Validity extended to ${expiryStr}.`);
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
          { key: 'auditLogs', collection: 'audit_logs' },
          { key: 'supportTickets', collection: 'support_tickets' }
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
                  auditLogs: [],
                  supportTickets: []
                };
              }

              const record = appwrite.reconstructRecord(doc);
              if (record) {
                orgFleetData[orgId][cat.key].push(record);
              }
            }
          } catch (catErr: any) {
            console.warn(`Failed to fetch backend documents for ${cat.collection}:`, catErr.message);
          }
        });

        const loadRightsPromise = (async () => {
          try {
            userRightsData = await organizationService.fetchAllGlobalConfigs(databaseId);
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
          if (userRightsData.appUpdateConfig) {
            setAppUpdateConfig(userRightsData.appUpdateConfig);
            localStorage.setItem('ttt_app_update_config', JSON.stringify(userRightsData.appUpdateConfig));
          }
        }

        // 2. Update states
        const currentProfiles = userRightsData?.organizationProfiles || organizationProfiles;

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
          await saveOrganizationProfiles(cleanedProfiles);
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

        setSupportTickets(prev => {
          let updated = [...prev];
          for (const orgId in orgFleetData) {
            const orgData = orgFleetData[orgId];
            if (orgData.supportTickets && Array.isArray(orgData.supportTickets)) {
              updated = [
                ...updated.filter(t => t.organizationId !== orgId),
                ...orgData.supportTickets.map(t => ({ ...t, organizationId: orgId }))
              ];
            }
          }
          localStorage.setItem('ttt_support_tickets', JSON.stringify(updated));
          return updated;
        });

      } catch (err) {
        console.warn("Backend live data sync failed:", err);
      }
    };

    // Initial load
    reloadBackendData();

    // Subscribe to realtime database document events
    let unsubscribe: any = null;
    let destroyed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 5000;
    const MAX_DELAY = 60000;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const teardown = () => {
      if (unsubscribe) {
        try {
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          } else {
            const subAny = unsubscribe as any;
            if (typeof subAny.close === 'function') {
              subAny.close();
            } else if (typeof subAny.unsubscribe === 'function') {
              subAny.unsubscribe();
            }
          }
        } catch (_) { /* ignore close-state errors */ }
        unsubscribe = null;
      }
    };

    const scheduleReconnect = () => {
      if (destroyed) return;
      reconnectTimer = setTimeout(() => {
        if (!destroyed) setupRealtime();
      }, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
    };

    const setupRealtime = async () => {
      if (destroyed) return;
      teardown();
      try {
        await appwrite.initSession();
        const colList = ['trucks', 'drivers', 'offices', 'accounts', 'trips', 'expenses', 'tyres', 'audit_logs', 'support_tickets'];
        if (currentUserOrgId === 'org_backend') {
          colList.push('global_configs');
        }
        const channels = colList.map(col => `databases.${databaseId}.collections.${col}.documents`);
        try {
          const subPromise = appwrite.getRealtime().subscribe(channels, (_response: any) => {
            console.log("Super Admin Realtime Socket: Event received, scheduling debounced reload...");
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              if (!destroyed) {
                console.log("Super Admin Realtime Socket: Reloading datasets on DB changes...");
                reloadBackendData();
              }
            }, 1500);
          });
          subPromise.then(sub => {
            if (destroyed) {
              try {
                const subAny = sub as any;
                if (typeof subAny.close === 'function') {
                  subAny.close();
                } else if (typeof subAny.unsubscribe === 'function') {
                  subAny.unsubscribe();
                }
              } catch (_) { }
            } else {
              unsubscribe = sub;
              console.log("Super Admin realtime socket established.");
            }
          });

          // Health-check every 15s — ping socket to keep it active
          const healthCheck = setInterval(() => {
            if (destroyed) { clearInterval(healthCheck); return; }
            try {
              const ws = (appwrite.getRealtime() as any).socket;
              if (ws && ws.readyState === WebSocket.OPEN) {
                // Keep-alive ping frame
                ws.send(JSON.stringify({ type: 'ping' }));
              }
            } catch (_) { /* ignore */ }
          }, 15000);

        } catch (subErr: any) {
          if (subErr?.code !== 1008) {
            console.warn("Super Admin websocket channel error:", subErr);
          }
        }
      } catch (e: any) {
        if (!e?.message?.includes('CLOSING') && !e?.message?.includes('CLOSED')) {
          console.warn("Super Admin websocket registration failed:", e);
        }
      }
    };

    setupRealtime();

    return () => {
      destroyed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      teardown();
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
      }, currentUserId);
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
      }, currentUserId);
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
        const updatedTruck = mutateRecord(truck, { [kmField]: newMilestoneKM }, currentUserId);
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

  if (emailVerificationSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white font-sans p-4">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-full border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Email Verified!</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your email address has been successfully verified. Your account configuration and organization setup are complete.
            </p>
          </div>
          <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl text-left text-xs space-y-2 text-slate-300">
            <p className="font-semibold text-slate-200">What to do next:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Open the <strong>LorryGuru Mobile App</strong> on your phone.</li>
              <li>Tap on <strong>Refresh Status</strong> to reload your dashboard.</li>
              <li>If you closed the app, simply log in using your email and password.</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmailVerificationSuccess(false);
              navigate(currentUser ? '/console/dashboard' : '/login');
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/25 transition cursor-pointer"
          >
            Go to Console
          </button>
        </div>
      </div>
    );
  }

  if (emailVerificationError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white font-sans p-4">
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-500/10 rounded-full border border-rose-500/30 text-rose-450">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Verification Failed</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              We encountered an issue while verifying your email address. The link might have expired or is invalid.
            </p>
            <p className="text-[11px] font-mono text-rose-400 bg-rose-950/20 border border-rose-500/20 p-2 rounded-lg mt-2">
              {emailVerificationError}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmailVerificationError(null);
              navigate('/login');
            }}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (resetPasswordState && resetPasswordState.active) {
    return (
      <PasswordResetScreen
        resetPasswordState={resetPasswordState}
        setResetPasswordState={setResetPasswordState}
        setLoadingUser={setLoadingUser}
        showNotification={showNotification}
      />
    );
  }

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

  const publicLegalPaths = ['/terms', '/privacy', '/refunds', '/refund-policy'];
  if (publicLegalPaths.includes(location.pathname)) {
    const defaultTab = location.pathname === '/privacy' ? 'privacy' : (location.pathname === '/refunds' || location.pathname === '/refund-policy') ? 'refunds' : 'terms';
    return (
      <Suspense fallback={<LoadingTab />}>
        <LegalPage defaultTab={defaultTab} onBack={() => navigate(currentUser ? '/console/dashboard' : '/')} />
      </Suspense>
    );
  }

  if (!currentUser) {
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

  const isVerificationPending = currentUser && currentUserRights.isApproved && (
    (!currentUserRights.isEmailVerified && currentUser.emailVerification !== true) ||
    (!currentUserRights.isPhoneVerified && currentUser.phoneVerification !== true)
  );

  if (isVerificationPending) {
    return (
      <>
        <VerificationRequiredScreen
          currentUser={currentUser}
          currentUserRights={currentUserRights}
          userRightsList={userRightsList}
          setUserRightsList={setUserRightsList}
          pushPermissionsToCloud={pushPermissionsToCloud}
          reconcileSession={reconcileSession}
          showNotification={showNotification}
          toastMessage={toastMessage}
          emailTimer={emailTimer}
          setEmailTimer={setEmailTimer}
          phoneTimer={phoneTimer}
          setPhoneTimer={setPhoneTimer}
          verificationOtpSent={verificationOtpSent}
          setVerificationOtpSent={setVerificationOtpSent}
          showPhoneUpdateModal={showPhoneUpdateModal}
          setShowPhoneUpdateModal={setShowPhoneUpdateModal}
          whatsappOtpCode={whatsappOtpCode}
          setWhatsappOtpCode={setWhatsappOtpCode}
          sendWhatsAppOTP={sendWhatsAppOTP}
          handlePhoneUpdateSubmit={handlePhoneUpdateSubmit}
          handleLogout={handleLogout}
          setLoadingUser={setLoadingUser}
          setOrganizationProfiles={setOrganizationProfiles}
        />
        {renderAppUpdateModal()}
      </>
    );
  }

  if (currentUser && isOrgDisabled && !currentUserRights.isSuperAdmin) {
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
            supportTickets
          }}
          onLoadCloudState={onLoadCloudState}
          showNotification={showNotification}
          logAction={logAction}
          currentUserOrgId={currentUserOrgId}
          currentUserEmail={currentUser?.email}
          currentUserId={currentUser?.email || ''}
          isAdmin={currentUserRights.isAdmin}
          onInitialSyncComplete={setInitialPullDone}
          onConnectionChange={(online, reason) => {
            setIsOnline(online);
            setDisconnectReason(reason);
          }}
          activeTicketId={activeTicketId}
          hideUI={true}
        />
        <OrgDisabledScreen
          currentUserOrgId={currentUserOrgId}
          onLogout={handleLogout}
        />
        {renderAppUpdateModal()}
      </>
    );
  }

  if (currentUser && !currentUserRights.isApproved) {
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
            supportTickets
          }}
          onLoadCloudState={onLoadCloudState}
          showNotification={showNotification}
          logAction={logAction}
          currentUserOrgId={currentUserOrgId}
          currentUserEmail={currentUser?.email}
          currentUserId={currentUser?.email || ''}
          isAdmin={currentUserRights.isAdmin}
          onInitialSyncComplete={setInitialPullDone}
          onConnectionChange={(online, reason) => {
            setIsOnline(online);
            setDisconnectReason(reason);
          }}
          activeTicketId={activeTicketId}
          hideUI={true}
        />
        <PendingApprovalScreen
          currentUserRights={currentUserRights}
          onLogout={handleLogout}
          onRequestToJoinOrganization={handleRequestToJoinOrganization}
          showNotification={showNotification}
        />
        {renderAppUpdateModal()}
      </>
    );
  }



  const handleCyanClick = () => {
    if (currentUserRights.isAdmin) {
      setActiveTab('USERS');
    } else {
      setActiveTab('TRIPS');
    }
  };

  const tabsList = ['TRUCKS', 'DRIVERS', 'EXPENSES', 'OUTSTANDING', 'REPORTS', 'TYRES', 'OFFICES', 'ACCOUNTS', 'AUDIT'];
  const currentTabIdx = tabsList.indexOf(registrySubTab);
  const isSlideRight = currentTabIdx > prevTabIdxRef.current;
  prevTabIdxRef.current = currentTabIdx;
  const slideClassName = isSlideRight ? 'animate-slide-in-right' : 'animate-slide-in-left';

  const isBackendTeam = currentUserOrgId === 'org_backend' || currentUserRights.isSuperAdmin;

  if (isMobile) {
    return (
      <div className="h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans overflow-hidden select-none">
        
        {/* GLOBAL TOAST BANNER */}
        {toastMessage && (
          <div id="toast-notify" className="fixed bottom-20 left-4 right-4 z-50 bg-blue-600 border border-blue-400/30 text-white p-3 px-5 rounded-2xl shadow-xl flex items-center gap-2.5 animate-bounce">
            <CheckCircle className="w-4 h-4 text-white" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Dynamic Mobile Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 p-4 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="LorryGuru Logo" className="h-7 w-auto" />
            <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">LorryGuru</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div ref={notificationRef} className="relative">
              <button
                id="btn-notifications-toggle-mobile"
                onClick={() => {
                  setNotificationOpen(!notificationOpen);
                  setProfileDropdownOpen(false);
                  const now = Date.now();
                  updateLastReadNotificationTime(now);
                  if (currentUser) {
                    const key = `ttt_last_read_notifications_${(currentUser.email || '').toLowerCase().trim()}`;
                    localStorage.setItem(key, now.toString());
                  }
                }}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition p-1.5 cursor-pointer relative flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {hasUnreadNotifications && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse" />
                )}
              </button>

              {notificationOpen && (
                <div className="
                  fixed left-3 right-3 top-16
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
                        setMobileTab('REGISTRY');
                        setRegistrySubTab('AUDIT');
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
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition p-1 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-rose-500 animate-pulse'}`}></span>
          </div>
        </div>

        {/* Mobile Viewport / Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-50 dark:bg-slate-955">
          <Suspense fallback={<LoadingTab />}>
            {mobileTab === 'HOME' && (
              <MobileHomeTab
                currentUser={currentUser}
                orgTrips={orgTrips}
                orgTrucks={orgTrucks}
                orgDrivers={orgDrivers}
                setActiveTab={setMobileTab}
                onNavigateToSubTab={(sub) => {
                  setMobileTab('REGISTRY');
                  setRegistrySubTab(sub);
                }}
                onQuickAction={(action) => {
                  if (action === 'ADD_TRIP') {
                    setEditingTrip(null);
                    setBookingModalOpen(true);
                  } else if (action === 'ADD_EXPENSE') {
                    setMobileTab('REGISTRY');
                    setRegistrySubTab('EXPENSES');
                  } else if (action === 'VOICE') {
                    setIsVoiceAssistantOpen(true);
                  }
                }}
              />
            )}

            {mobileTab === 'TRIPS' && (
              <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-4">
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
              </div>
            )}

            {mobileTab === 'REGISTRY' && (
              <div className="flex-1 overflow-hidden flex flex-col pb-20 relative">
                {/* Scrollable Sub-Tab Bar for Registry Lists */}
                <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-1.5 shrink-0">
                  {[
                    { id: 'TRUCKS', label: 'Trucks' },
                    { id: 'DRIVERS', label: 'Drivers' },
                    { id: 'EXPENSES', label: 'Expenses' },
                    { id: 'OUTSTANDING', label: 'Outstanding' },
                    { id: 'REPORTS', label: 'Reports' },
                    { id: 'TYRES', label: 'Tyres' },
                    { id: 'OFFICES', label: 'Offices' },
                    { id: 'ACCOUNTS', label: 'Accounts' },
                    { id: 'AUDIT', label: 'Audit Logs' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setRegistrySubTab(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        registrySubTab === tab.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Sub-Tab Viewport Content */}
                <div 
                  key={registrySubTab}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  className={`flex-1 overflow-y-auto p-4 space-y-4 ${slideClassName}`}
                >
                  {registrySubTab === 'TRUCKS' && (
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
                      maxTrucksAllowed={currentOrgProfile?.maxTrucksAllowed || 2}
                      onAddTruckRequest={handleAddTruckRequest}
                      organizationId={currentUserOrgId}
                      orgProfile={currentOrgProfile}
                      onServiceDone={(currentUserRights.canEditTrucks || currentUserRights.canEditExpenses) ? handleServiceDone : undefined}
                      accounts={orgAccounts}
                      drivers={orgDrivers}
                      onAddExpense={addExpense}
                      canEditLoans={currentUserRights.canEditLoans !== false}
                      canDeleteLoans={currentUserRights.canDeleteLoans !== false}
                      canEditExpenses={currentUserRights.canEditExpenses !== false}
                      currentUserEmail={currentUser?.email || ''}
                      currentUserName={currentUser?.name || ''}
                      currentUserPhone={currentUser?.phone || ''}
                      onProcessTruckPayment={handleProcessTruckPayment}
                      autoOpenAdd={autoOpenFormTab === 'TRUCKS'}
                      onAutoOpenCleared={() => setAutoOpenFormTab(null)}
                    />
                  )}
                  {registrySubTab === 'DRIVERS' && (
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
                      orgProfile={currentOrgProfile}
                      autoOpenAdd={autoOpenFormTab === 'DRIVERS'}
                      onAutoOpenCleared={() => setAutoOpenFormTab(null)}
                      onSaveTrips={saveTrips}
                      confirmAction={confirmAction}
                    />
                  )}
                  {registrySubTab === 'EXPENSES' && (
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
                      autoOpenAdd={autoOpenFormTab === 'EXPENSES'}
                      onAutoOpenCleared={() => setAutoOpenFormTab(null)}
                      orgProfile={currentOrgProfile}
                    />
                  )}
                  {registrySubTab === 'TYRES' && (
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
                      autoOpenAdd={autoOpenFormTab === 'TYRES'}
                      onAutoOpenCleared={() => setAutoOpenFormTab(null)}
                    />
                  )}
                  {registrySubTab === 'OFFICES' && (
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
                  {registrySubTab === 'ACCOUNTS' && (
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
                  {registrySubTab === 'OUTSTANDING' && (
                    <MobileOutstandingView
                      trips={orgTrips}
                      trucks={approvedOrgTrucks}
                      offices={orgOffices}
                      accounts={orgAccounts}
                      orgProfile={currentOrgProfile}
                      expenses={orgExpenses}
                      onSaveTrips={saveTrips}
                    />
                  )}
                  {registrySubTab === 'REPORTS' && (
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
                  {registrySubTab === 'AUDIT' && (
                    <AuditLogView
                      logs={currentUserOrgId === 'org_backend' ? auditLogs : orgAuditLogs}
                      onClearLogs={handleClearAuditLogs}
                      confirmAction={confirmAction}
                      organizationProfiles={organizationProfiles}
                      currentUserOrgId={currentUserOrgId}
                    />
                  )}
                </div>
                {/* Custom Floating Action Button (FAB) */}
                {fabOpened && (
                  <div 
                    className="fixed inset-0 bg-slate-950/35 backdrop-blur-3xs z-30 transition-opacity animate-fade-in"
                    onClick={() => setFabOpened(false)}
                  />
                )}
                
                <div className="absolute bottom-24 right-6 z-40 flex flex-col items-end">
                  {fabOpened && (
                    <div className="flex flex-col items-end gap-3 mb-4 animate-scale-up origin-bottom">
                      {[
                        { id: 'TRUCKS', label: 'Add Truck', icon: <TruckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-450" /> },
                        { id: 'DRIVERS', label: 'Add Driver', icon: <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" /> },
                        { id: 'EXPENSES', label: 'Register Expense', icon: <Coins className="w-4 h-4 text-purple-600 dark:text-purple-400" /> },
                        { id: 'TYRES', label: 'Register Tyre', icon: <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-450" /> },
                        { id: 'OFFICES', label: 'Add Office', icon: <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400" /> },
                        { id: 'ACCOUNTS', label: 'Add Account', icon: <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> }
                      ].map((act) => (
                        <div 
                          key={act.id} 
                          className="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform" 
                          onClick={() => triggerOpenAddForm(act.id)}
                        >
                          <span className="bg-slate-900/80 dark:bg-slate-950/90 backdrop-blur-xs text-white text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-md transition transform group-hover:-translate-x-1 uppercase tracking-wider select-none">
                            {act.label}
                          </span>
                          <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center transition hover:bg-slate-50 dark:hover:bg-slate-750">
                            {act.icon}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <button
                    onClick={() => setFabOpened(!fabOpened)}
                    className={`w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xl flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer ${
                      fabOpened ? 'rotate-135 bg-gradient-to-tr from-rose-650 to-red-500' : ''
                    }`}
                    title="Quick Actions"
                  >
                    <Plus className="w-6 h-6 transition-transform duration-300" />
                  </button>
                </div>
              </div>
            )}

            {mobileTab === 'ACCOUNT' && (
              <MobileAccountTab
                currentUser={currentUser}
                currentUserOrgId={currentUserOrgId}
                currentUserRights={currentUserRights}
                theme={theme}
                setTheme={setTheme}
                handleLogout={handleLogout}
                setProfileActiveTab={setProfileActiveTab}
                setProfileModalOpen={setProfileModalOpen}
                setSetup2FAOpen={setSetup2FAOpen}
                setDisable2FAOpen={setDisable2FAOpen}
                clientUnreadCount={getClientUnreadTicketsCount()}
                showNotification={showNotification}
                appVersion={APP_VERSION}
              />
            )}
          </Suspense>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <MobileBottomTabBar
          activeTab={mobileTab}
          setActiveTab={setMobileTab}
          clientUnreadCount={getClientUnreadTicketsCount()}
        />

        {/* Global Modals rendered on top */}
        {profileModalOpen && (
          <ProfileModal
            isOpen={profileModalOpen}
            onClose={() => setProfileModalOpen(false)}
            profileActiveTab={profileActiveTab}
            setProfileActiveTab={setProfileActiveTab}
            isBackendTeam={isBackendTeam}
            getClientUnreadTicketsCount={getClientUnreadTicketsCount}
            currentUser={currentUser}
            currentUserRights={currentUserRights}
            organizationProfiles={organizationProfiles}
            profileName={profileName}
            setProfileName={setProfileName}
            profileOrgName={profileOrgName}
            setProfileOrgName={setProfileOrgName}
            profileVoiceLang={profileVoiceLang}
            setProfileVoiceLang={setProfileVoiceLang}
            userRightsList={userRightsList}
            setUserRightsList={setUserRightsList}
            databaseId={localStorage.getItem('appwrite_database_id') || 'fleet_db'}
            isAppwriteConfigured={isAppwriteConfigured}
            saveUserRightsList={saveUserRightsListWithSync}
            showNotification={showNotification}
            supportTickets={supportTickets}
            onSaveSupportTickets={saveSupportTickets}
            activeTicketId={activeTicketId}
            onSetActiveTicketId={setActiveTicketId}
            reconcileSession={reconcileSession}
          />
        )}

        <Setup2FAModal
          isOpen={setup2FAOpen}
          onClose={() => setSetup2FAOpen(false)}
          setup2FASecret={setup2FASecret}
          showNotification={showNotification}
          reconcileSession={reconcileSession}
        />

        <Disable2FAModal
          isOpen={disable2FAOpen}
          onClose={() => setDisable2FAOpen(false)}
          showNotification={showNotification}
          reconcileSession={reconcileSession}
        />

        <ConfirmModal
          confirmModal={confirmModal}
          onClose={() => setConfirmModal(null)}
        />

        <Suspense fallback={null}>
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
            orgProfile={currentOrgProfile}
            trips={orgTrips}
            onSaveTrips={saveTrips}
            confirmAction={confirmAction}
          />
        </Suspense>

        <Suspense fallback={null}>
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
        </Suspense>

        {renderAppUpdateModal()}

        {/* Sync background module */}
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
            supportTickets
          }}
          onLoadCloudState={onLoadCloudState}
          showNotification={showNotification}
          logAction={logAction}
          currentUserOrgId={currentUserOrgId}
          currentUserEmail={currentUser?.email}
          currentUserId={currentUser?.email || ''}
          isAdmin={currentUserRights.isAdmin}
          onInitialSyncComplete={setInitialPullDone}
          onConnectionChange={(online, reason) => {
            setIsOnline(online);
            setDisconnectReason(reason);
          }}
          activeTicketId={activeTicketId}
          hideUI={true}
        />

        {!isOnline && (
          <ConnectionStatusBlocker reason={disconnectReason} />
        )}

      </div>
    );
  }

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
      <AppSidebar
        logo={logo}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        activeTab={activeTab}
        selectTab={selectTab}
        currentUserRights={currentUserRights}
        hasUsersTabAccess={hasUsersTabAccess}
        isBackendTeam={isBackendTeam}
        getClientUnreadTicketsCount={getClientUnreadTicketsCount}
        getAgentUnreadTicketsCount={getAgentUnreadTicketsCount}
        currentUser={currentUser}
        currentUserOrgId={currentUserOrgId}
        showNotification={showNotification}
        handleLogout={handleLogout}
        setProfileActiveTab={setProfileActiveTab}
        setProfileModalOpen={setProfileModalOpen}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden">
        {/* Header */}
        <AppHeader
          activeTab={activeTab}
          orgTrips={orgTrips}
          orgTrucks={orgTrucks}
          orgOffices={orgOffices}
          orgAccounts={orgAccounts}
          orgDrivers={orgDrivers}
          orgExpenses={orgExpenses}
          orgTyres={orgTyres}
          orgAuditLogs={orgAuditLogs}
          currentUserRights={currentUserRights}
          currentUserOrgId={currentUserOrgId}
          currentUser={currentUser}
          cyanCount={cyanCount}
          theme={theme}
          setTheme={setTheme}
          handleCyanClick={handleCyanClick}
          notificationOpen={notificationOpen}
          setNotificationOpen={setNotificationOpen}
          profileDropdownOpen={profileDropdownOpen}
          setProfileDropdownOpen={setProfileDropdownOpen}
          notificationRef={notificationRef}
          profileDropdownRef={profileDropdownRef}
          hasUnreadNotifications={hasUnreadNotifications}
          updateLastReadNotificationTime={updateLastReadNotificationTime}
          showNotification={showNotification}
          getUserInitials={getUserInitials}
          isBackendTeam={isBackendTeam}
          hasUsersTabAccess={hasUsersTabAccess}
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
          supportTickets={supportTickets}
          activeTicketId={activeTicketId}
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

        {/* Outer content container */}
        <div id="app-viewport-container" className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 space-y-6">
          <Suspense fallback={<LoadingTab />}>
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
                orgProfile={currentOrgProfile}
                expenses={orgExpenses}
                onAddExpense={addExpense}
                onUpdateTruck={updateTruck}
                onSaveTrips={saveTrips}
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
                auditLogs={currentUserOrgId === 'org_backend' ? auditLogs : orgAuditLogs}
                currentUserRights={currentUserRights}
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
                maxTrucksAllowed={currentOrgProfile?.maxTrucksAllowed || 2}
                onAddTruckRequest={handleAddTruckRequest}
                organizationId={currentUserOrgId}
                orgProfile={currentOrgProfile}
                onServiceDone={(currentUserRights.canEditTrucks || currentUserRights.canEditExpenses) ? handleServiceDone : undefined}
                accounts={orgAccounts}
                drivers={orgDrivers}
                onAddExpense={addExpense}
                canEditLoans={currentUserRights.canEditLoans !== false}
                canDeleteLoans={currentUserRights.canDeleteLoans !== false}
                canEditExpenses={currentUserRights.canEditExpenses !== false}
                currentUserEmail={currentUser?.email || ''}
                currentUserName={currentUser?.name || ''}
                currentUserPhone={currentUser?.phone || ''}
                onProcessTruckPayment={handleProcessTruckPayment}
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
                orgProfile={currentOrgProfile}
                onSaveTrips={saveTrips}
                confirmAction={confirmAction}
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
                orgProfile={currentOrgProfile}
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

            {activeTab === 'BACKEND' && (currentUserRights.isSuperAdmin || currentUserOrgId === 'org_backend') && (
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
                supportTickets={supportTickets}
                onSaveSupportTickets={saveSupportTickets}
                currentUser={currentUser}
                activeTicketId={activeTicketId}
                onSetActiveTicketId={setActiveTicketId}
                payments={payments}
                onInitiateRefund={handleInitiateRefund}
                appUpdateConfig={appUpdateConfig}
                onSaveAppUpdateConfig={handleSaveAppUpdateConfig}
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
                orgProfile={currentOrgProfile}
                onUpdateOrgProfile={handleUpdateOrgProfile}
              />
            )}

            {activeTab === 'BILLING' && (currentUserRights.isAdmin || currentUserRights.isSuperAdmin || currentUserOrgId === 'org_backend') && (
              <BillingHistory
                payments={payments}
                currentUserOrgId={currentUserOrgId}
                orgName={currentOrgProfile?.organizationName || ''}
                gstNo={currentOrgProfile?.gstNo || ''}
                panNo={currentOrgProfile?.panNo || ''}
                address={currentOrgProfile?.address || ''}
              />
            )}
          </Suspense>
        </div>
      </main>

      {/* DYNAMIC FORM MODAL BINDERS */}
      <Suspense fallback={null}>
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
          orgProfile={currentOrgProfile}
          trips={orgTrips}
          onSaveTrips={saveTrips}
          confirmAction={confirmAction}
        />
      </Suspense>

      <Suspense fallback={null}>
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
      </Suspense>
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        profileActiveTab={profileActiveTab}
        setProfileActiveTab={setProfileActiveTab}
        isBackendTeam={isBackendTeam}
        getClientUnreadTicketsCount={getClientUnreadTicketsCount}
        currentUser={currentUser}
        currentUserRights={currentUserRights}
        organizationProfiles={organizationProfiles}
        profileName={profileName}
        setProfileName={setProfileName}
        profileOrgName={profileOrgName}
        setProfileOrgName={setProfileOrgName}
        profileVoiceLang={profileVoiceLang}
        setProfileVoiceLang={setProfileVoiceLang}
        oldPassword={oldPassword}
        setOldPassword={setOldPassword}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        handleUpdateProfile={async (newName, newOrgName, newPass, oldPass) => {
          if (newPass && newPass !== confirmPassword) {
            alert("New passwords do not match!");
            return;
          }
          const loginMethod = localStorage.getItem('ttt_login_method');
          if (loginMethod === 'appwrite' && newPass && !oldPass) {
            alert("Current password is required to change password in Appwrite.");
            return;
          }
          await handleUpdateProfile(
            newName,
            currentUserRights.isAdmin ? newOrgName : undefined,
            newPass || undefined,
            oldPass || undefined
          );
        }}
        onChangeMobileClick={() => {
          setMobileWizardStep(1);
          setMobileWizardOpen(true);
          setMobileWizardTimer(0);
          setMobileWizardCode('');
          setMobileWizardNewPhone('');
          setMobileWizardPassword('');
          setMobileWizardError(null);
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          setMobileWizardGeneratedOtp(otp);
          alert(`[Mock Verification OTP] Sent code to existing mobile: ${otp}`);
        }}
        onEnable2FAClick={() => {
          const secret = generateSecret();
          setSetup2FASecret(secret);
          setSetup2FAOpen(true);
        }}
        onDisable2FAClick={() => {
          setDisable2FAOpen(true);
        }}
        supportTickets={supportTickets}
        currentUserOrgId={currentUserOrgId}
        handleCreateSupportTicket={handleCreateSupportTicket}
        handleSendSupportTicketMessage={handleSendSupportTicketMessage}
        profileGst={profileGst}
        setProfileGst={setProfileGst}
        profilePan={profilePan}
        setProfilePan={setProfilePan}
        profileAadhaar={profileAadhaar}
        setProfileAadhaar={setProfileAadhaar}
        profileAddress={profileAddress}
        setProfileAddress={setProfileAddress}
        payments={payments}
      />

      <MobileChangeWizardModal
        isOpen={mobileWizardOpen}
        onClose={() => setMobileWizardOpen(false)}
        currentUser={currentUser}
        currentUserRights={currentUserRights}
        userRightsList={userRightsList}
        setUserRightsList={setUserRightsList}
        pushPermissionsToCloud={pushPermissionsToCloud}
        reconcileSession={reconcileSession}
        setCurrentUser={setCurrentUser}
        showNotification={showNotification}
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
      />

      {/* ENABLE 2FA WIZARD MODAL */}
      <Setup2FAModal
        isOpen={setup2FAOpen}
        onClose={() => setSetup2FAOpen(false)}
        setup2FASecret={setup2FASecret}
        showNotification={showNotification}
        reconcileSession={reconcileSession}
      />

      {/* DISABLE 2FA WIZARD MODAL */}
      <Disable2FAModal
        isOpen={disable2FAOpen}
        onClose={() => setDisable2FAOpen(false)}
        showNotification={showNotification}
        reconcileSession={reconcileSession}
      />

      <ConfirmModal
        confirmModal={confirmModal}
        onClose={() => setConfirmModal(null)}
      />

       {renderAppUpdateModal()}

      {!isOnline && (
        <ConnectionStatusBlocker reason={disconnectReason} />
      )}

    </div>
  );
}
