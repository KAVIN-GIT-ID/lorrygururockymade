import { createContext, useContext, createSignal, Accessor } from 'solid-js';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useOrganizations } from '../context/OrganizationContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuditLogsContext } from '../context/AuditLogContext';
import { useTrucksContext } from '../context/TruckContext';
import { useDriversContext } from '../context/DriverContext';
import { useOfficesContext } from '../context/OfficeContext';
import { useAccountsContext } from '../context/AccountContext';
import { useTripsContext } from '../context/TripContext';
import { useExpensesContext } from '../context/ExpenseContext';
import { useTyresContext } from '../context/TyreContext';
import { useSettings } from './SettingsManager';
import { useDialogs } from './DialogManager';
import { useNavigate } from '@solidjs/router';
import { useAuthHandlers } from '../hooks/useAuthHandlers';
import { useUserManagement } from '../hooks/useUserManagement';
import { useModalWizardState } from '../hooks/useModalWizardState';
import { migrationService } from '../services/migrationService';
import { UserPermission } from '../types';

interface AuthManagerContextType {
  verificationOtpSent: () => boolean;
  setVerificationOtpSent: (sent: boolean) => void;
  whatsappOtpCode: () => string | null;
  setWhatsappOtpCode: (code: string | null) => void;
  whatsappOtpPhone: () => string | null;
  setWhatsappOtpPhone: (phone: string | null) => void;
  emailVerificationSuccess: () => boolean;
  setEmailVerificationSuccess: (success: boolean) => void;
  emailVerificationError: () => string | null;
  setEmailVerificationError: (err: string | null) => void;
  handleLogout: () => Promise<void>;
  handleUpdateProfile: (newName: string, newOrgName?: string, newPassword?: string, oldPassword?: string, kycDetails?: any) => Promise<void>;
  checkUserApproval: (email: string) => { approved: boolean; orgId: string; registered: boolean };
  sendWhatsAppOTP: (phone: string) => Promise<string>;
  handlePhoneUpdateSubmit: (e: Event) => Promise<void>;
  handleRegisterUserPermissions: (name: string, email: string, phone: string, orgId: string, orgName?: string, dryRun?: boolean) => Promise<{ approved: boolean; orgId: string; error?: string }>;
  handleRequestToJoinOrganization: (newOrgId: string) => Promise<{ success: boolean; error?: string }>;
  reconcileSession: (user: any, freshRightsList?: UserPermission[]) => Promise<any>;
  emailTimer: Accessor<number>;
  setEmailTimer: (secs: number) => void;
  phoneTimer: Accessor<number>;
  setPhoneTimer: (secs: number) => void;
  mobileWizardTimer: Accessor<number>;
  setMobileWizardTimer: (secs: number) => void;
  mobileWizardOpen: Accessor<boolean>;
  setMobileWizardOpen: (open: boolean) => void;
  mobileWizardStep: Accessor<number>;
  setMobileWizardStep: (step: number) => void;
  mobileWizardCode: Accessor<string>;
  setMobileWizardCode: (code: string) => void;
  mobileWizardNewPhone: Accessor<string>;
  setMobileWizardNewPhone: (phone: string) => void;
  mobileWizardPassword: Accessor<string>;
  setMobileWizardPassword: (password: string) => void;
  mobileWizardError: Accessor<string | null>;
  setMobileWizardError: (err: string | null) => void;
  mobileWizardGeneratedOtp: Accessor<string | null>;
  setMobileWizardGeneratedOtp: (otp: string | null) => void;
  setup2FAOpen: Accessor<boolean>;
  setSetup2FAOpen: (open: boolean) => void;
  setup2FASecret: Accessor<string>;
  setSetup2FASecret: (secret: string) => void;
  disable2FAOpen: Accessor<boolean>;
  setDisable2FAOpen: (open: boolean) => void;
  resetPasswordState: Accessor<any>;
  setResetPasswordState: (state: any) => void;
}

const AuthManagerContext = createContext<AuthManagerContextType | undefined>(undefined);

export function AuthManager(props: { children: any; touchLastModified: () => void }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const perm = usePermissions();
  const orgs = useOrganizations();
  const notifications = useNotifications();
  const auditLogsCtx = useAuditLogsContext();

  const trucksCtx = useTrucksContext();
  const driversCtx = useDriversContext();
  const officesCtx = useOfficesContext();
  const accountsCtx = useAccountsContext();
  const tripsCtx = useTripsContext();
  const expensesCtx = useExpensesContext();
  const tyresCtx = useTyresContext();

  const settings = useSettings();
  const dialogs = useDialogs();

  const [verificationOtpSent, setVerificationOtpSent] = createSignal(false);
  const [whatsappOtpCode, setWhatsappOtpCode] = createSignal<string | null>(null);
  const [whatsappOtpPhone, setWhatsappOtpPhone] = createSignal<string | null>(null);

  const currentUser = auth.currentUser;
  const setCurrentUser = auth.setCurrentUser;
  const loadingUser = auth.loadingUser;
  const setLoadingUser = auth.setLoadingUser;
  const reconcileUserSession = auth.reconcileUserSession;

  const userRightsList = perm.userRightsList;
  const setUserRightsList = perm.setUserRightsList;
  const currentUserRights = perm.currentUserRights;
  const pushPermissionsToCloud = perm.pushPermissions;

  const organizationProfiles = orgs.organizationProfiles;
  const setOrganizationProfiles = orgs.setOrganizationProfiles;
  const saveOrganizationProfiles = orgs.saveProfiles;

  const modalWizard = useModalWizardState();

  const reconcileSession = async (user: any, freshRightsList?: UserPermission[]) => {
    return reconcileUserSession(
      user,
      freshRightsList || userRightsList(),
      setUserRightsList,
      organizationProfiles(),
      setOrganizationProfiles,
      (orgId) => migrationService.migrateLocalDataToOrg(orgId, {
        setTrucks: trucksCtx.saveTrucks,
        setDrivers: driversCtx.saveDrivers,
        setOffices: officesCtx.saveOffices,
        setAccounts: accountsCtx.saveAccounts,
        setTrips: tripsCtx.saveTrips,
        setExpenses: expensesCtx.saveExpenses,
        setTyres: tyresCtx.saveTyres,
        setAuditLogs: auditLogsCtx.saveAuditLogs,
        touchLastModified: props.touchLastModified
      })
    );
  };

  const authHandlers = useAuthHandlers(
    currentUser,
    setCurrentUser,
    userRightsList,
    setUserRightsList,
    organizationProfiles,
    setOrganizationProfiles,
    saveOrganizationProfiles,
    trucksCtx.saveTrucks,
    driversCtx.saveDrivers,
    officesCtx.saveOffices,
    accountsCtx.saveAccounts,
    tripsCtx.saveTrips,
    expensesCtx.saveExpenses,
    tyresCtx.saveTyres,
    auditLogsCtx.saveAuditLogs,
    notifications.showNotification,
    navigate,
    setLoadingUser,
    auditLogsCtx.logAction,
    modalWizard.setResetPasswordState,
    reconcileSession,
    currentUserRights,
    pushPermissionsToCloud,
    settings.setUserVoiceLang,
    dialogs.setProfileModalOpen
  );

  const userManagement = useUserManagement(
    currentUser,
    userRightsList,
    setUserRightsList,
    organizationProfiles,
    setOrganizationProfiles,
    saveOrganizationProfiles,
    pushPermissionsToCloud,
    reconcileSession,
    notifications.showNotification,
    setVerificationOtpSent,
    modalWizard.setPhoneTimer,
    dialogs.setShowPhoneUpdateModal,
    setWhatsappOtpCode,
    setWhatsappOtpPhone
  );

  const value: AuthManagerContextType = {
    verificationOtpSent,
    setVerificationOtpSent,
    whatsappOtpCode,
    setWhatsappOtpCode,
    whatsappOtpPhone,
    setWhatsappOtpPhone,
    emailVerificationSuccess: authHandlers.emailVerificationSuccess,
    setEmailVerificationSuccess: authHandlers.setEmailVerificationSuccess,
    emailVerificationError: authHandlers.emailVerificationError,
    setEmailVerificationError: authHandlers.setEmailVerificationError,
    handleLogout: authHandlers.handleLogout,
    handleUpdateProfile: authHandlers.handleUpdateProfile,
    checkUserApproval: userManagement.checkUserApproval,
    sendWhatsAppOTP: userManagement.sendWhatsAppOTP,
    handlePhoneUpdateSubmit: userManagement.handlePhoneUpdateSubmit,
    handleRegisterUserPermissions: userManagement.handleRegisterUserPermissions,
    handleRequestToJoinOrganization: userManagement.handleRequestToJoinOrganization,
    reconcileSession,
    emailTimer: () => modalWizard.emailTimer,
    setEmailTimer: modalWizard.setEmailTimer,
    phoneTimer: () => modalWizard.phoneTimer,
    setPhoneTimer: modalWizard.setPhoneTimer,
    mobileWizardTimer: () => modalWizard.mobileWizardTimer,
    setMobileWizardTimer: modalWizard.setMobileWizardTimer,
    mobileWizardOpen: modalWizard.mobileWizardOpen,
    setMobileWizardOpen: modalWizard.setMobileWizardOpen,
    mobileWizardStep: modalWizard.mobileWizardStep,
    setMobileWizardStep: modalWizard.setMobileWizardStep,
    mobileWizardCode: modalWizard.mobileWizardCode,
    setMobileWizardCode: modalWizard.setMobileWizardCode,
    mobileWizardNewPhone: modalWizard.mobileWizardNewPhone,
    setMobileWizardNewPhone: modalWizard.setMobileWizardNewPhone,
    mobileWizardPassword: modalWizard.mobileWizardPassword,
    setMobileWizardPassword: modalWizard.setMobileWizardPassword,
    mobileWizardError: modalWizard.mobileWizardError,
    setMobileWizardError: modalWizard.setMobileWizardError,
    mobileWizardGeneratedOtp: modalWizard.mobileWizardGeneratedOtp,
    setMobileWizardGeneratedOtp: modalWizard.setMobileWizardGeneratedOtp,
    setup2FAOpen: modalWizard.setup2FAOpen,
    setSetup2FAOpen: modalWizard.setSetup2FAOpen,
    setup2FASecret: modalWizard.setup2FASecret,
    setSetup2FASecret: modalWizard.setSetup2FASecret,
    disable2FAOpen: modalWizard.disable2FAOpen,
    setDisable2FAOpen: modalWizard.setDisable2FAOpen,
    resetPasswordState: modalWizard.resetPasswordState,
    setResetPasswordState: modalWizard.setResetPasswordState
  };

  return (
    <AuthManagerContext.Provider value={value}>
      {props.children}
    </AuthManagerContext.Provider>
  );
}

export function useAuthManager() {
  const context = useContext(AuthManagerContext);
  if (!context) {
    throw new Error('useAuthManager must be used within an AuthManager');
  }
  return context;
}
