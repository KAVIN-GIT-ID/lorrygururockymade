import { Suspense, lazy, mergeProps } from 'solid-js';
import { useTripsContext } from '../context/TripContext';
import { useTrucksContext } from '../context/TruckContext';
import { useDriversContext } from '../context/DriverContext';
import { useExpensesContext } from '../context/ExpenseContext';
import { useOfficesContext } from '../context/OfficeContext';
import { useAccountsContext } from '../context/AccountContext';
import { useTyresContext } from '../context/TyreContext';
import { Truck, TripEntry, UserPermission, OrganizationProfile, SupportTicket } from '../types';

const ProfileModal = lazy(() => import('./ProfileModal'));
const MobileChangeWizardModal = lazy(() => import('./MobileChangeWizardModal'));
const Setup2FAModal = lazy(() => import('./Setup2FAModal'));
const Disable2FAModal = lazy(() => import('./Disable2FAModal'));
const ConfirmModal = lazy(() => import('./ConfirmModal'));
const TripForm = lazy(() => import('./TripForm'));
const VoiceAssistant = lazy(() => import('./VoiceAssistant'));

interface AppModalsProps {
  profileModalOpen: () => boolean;
  setProfileModalOpen: (open: boolean) => void;
  profileActiveTab: () => 'SETTINGS' | 'SUPPORT';
  setProfileActiveTab: (tab: 'SETTINGS' | 'SUPPORT') => void;
  isBackendTeam: boolean;
  getClientUnreadTicketsCount: () => number;
  currentUser: () => any;
  currentUserRights: () => any;
  organizationProfiles: () => OrganizationProfile[];
  handleUpdateProfile: (newName: string, newOrgName?: string, newPass?: string, oldPass?: string, kycDetails?: { gst?: string; pan?: string; aadhaar?: string; address?: string }) => Promise<void>;
  setMobileWizardOpen: (open: boolean) => void;
  setSetup2FAOpen: (open: boolean) => void;
  setDisable2FAOpen: (open: boolean) => void;
  supportTickets: () => SupportTicket[];
  currentUserOrgId: string;
  handleCreateSupportTicket: (category: 'Technical' | 'Billing' | 'General', title: string, description: string, attachmentFile?: File) => Promise<void>;
  handleSendSupportTicketMessage: (ticketId: string, message: any) => Promise<any>;
  payments: () => any[];

  mobileWizardOpen: () => boolean;
  mobileWizardStep: () => number;
  setMobileWizardStep: (step: number) => void;
  mobileWizardCode: () => string;
  setMobileWizardCode: (code: string) => void;
  mobileWizardNewPhone: () => string;
  setMobileWizardNewPhone: (phone: string) => void;
  mobileWizardPassword: () => string;
  setMobileWizardPassword: (pass: string) => void;
  mobileWizardError: () => string | null;
  setMobileWizardError: (err: string | null) => void;
  mobileWizardGeneratedOtp: () => string;
  setMobileWizardGeneratedOtp: (otp: string) => void;
  mobileWizardTimer: any;
  setMobileWizardTimer: (seconds: number) => void;
  sendWhatsAppOTP: (phone: string) => Promise<string>;
  userRightsList: () => UserPermission[];
  setUserRightsList: (list: UserPermission[]) => void;
  pushPermissionsToCloud: (list: UserPermission[]) => Promise<any>;
  reconcileSession: (user: any, freshRightsList?: UserPermission[]) => Promise<any>;
  setCurrentUser: (user: any) => void;
  showNotification: (msg: string) => void;

  setup2FAOpen: () => boolean;
  setup2FASecret: () => string;
  disable2FAOpen: () => boolean;
  confirmModal: () => any;
  setConfirmModal: (val: any) => void;

  bookingModalOpen: () => boolean;
  setBookingModalOpen: (open: boolean) => void;
  setEditingTrip: (trip: any) => void;
   approvedOrgTrucks?: Truck[];
   orgDrivers?: any[];
   orgOffices?: any[];
   orgAccounts?: any[];
   orgTrips?: TripEntry[];
   handlePostTripEntry?: (trip: any) => Promise<any>;
  editingTrip: () => TripEntry | null;
  currentOrgProfile: OrganizationProfile | undefined;
   saveTrips?: (trips: TripEntry[]) => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;

  isVoiceAssistantOpen: () => boolean;
  setIsVoiceAssistantOpen: (open: boolean) => void;
   addExpense?: (expense: any) => Promise<any>;
  userVoiceLang: () => string;
}

export default function AppModals(rawProps: AppModalsProps) {
  const tripsCtx = useTripsContext();
  const trucksCtx = useTrucksContext();
  const driversCtx = useDriversContext();
  const expenseCtx = useExpensesContext();
  const officeCtx = useOfficesContext();
  const accountCtx = useAccountsContext();
  const tyreCtx = useTyresContext();

  const props = mergeProps(rawProps, {
    get orgTrips() { return tripsCtx.orgTrips(); },
    get approvedOrgTrucks() { return trucksCtx.approvedOrgTrucks(); },
    get orgDrivers() { return driversCtx.orgDrivers(); },
    get orgOffices() { return officeCtx.orgOffices(); },
    get orgAccounts() { return accountCtx.orgAccounts(); },
    saveTrips: tripsCtx.saveTrips,
    addExpense: expenseCtx.addExpense,
    handlePostTripEntry: (entry: Omit<TripEntry, 'id'>) => tripsCtx.postTripEntry(entry, rawProps.editingTrip())
  });
  return (
    <Suspense fallback={null}>
      {props.profileModalOpen() && (
        <ProfileModal
          isOpen={props.profileModalOpen()}
          onClose={() => props.setProfileModalOpen(false)}
          profileActiveTab={props.profileActiveTab()}
          setProfileActiveTab={props.setProfileActiveTab}
          getClientUnreadTicketsCount={props.getClientUnreadTicketsCount}
          handleUpdateProfile={props.handleUpdateProfile}
          onChangeMobileClick={() => props.setMobileWizardOpen(true)}
          onEnable2FAClick={() => props.setSetup2FAOpen(true)}
          onDisable2FAClick={() => props.setDisable2FAOpen(true)}
          supportTickets={props.supportTickets()}
          handleCreateSupportTicket={props.handleCreateSupportTicket}
          handleSendSupportTicketMessage={props.handleSendSupportTicketMessage}
          payments={props.payments()}
        />
      )}

      <MobileChangeWizardModal
        isOpen={props.mobileWizardOpen()}
        onClose={() => props.setMobileWizardOpen(false)}
        currentUser={props.currentUser()}
        currentUserRights={props.currentUserRights() as any}
        userRightsList={props.userRightsList()}
        setUserRightsList={props.setUserRightsList}
        pushPermissionsToCloud={props.pushPermissionsToCloud}
        reconcileSession={props.reconcileSession as any}
        setCurrentUser={props.setCurrentUser}
        showNotification={props.showNotification}
        mobileWizardStep={props.mobileWizardStep()}
        setMobileWizardStep={props.setMobileWizardStep}
        mobileWizardCode={props.mobileWizardCode()}
        setMobileWizardCode={props.setMobileWizardCode}
        mobileWizardNewPhone={props.mobileWizardNewPhone()}
        setMobileWizardNewPhone={props.setMobileWizardNewPhone}
        mobileWizardPassword={props.mobileWizardPassword()}
        setMobileWizardPassword={props.setMobileWizardPassword}
        mobileWizardError={props.mobileWizardError()}
        setMobileWizardError={props.setMobileWizardError}
        mobileWizardGeneratedOtp={props.mobileWizardGeneratedOtp()}
        setMobileWizardGeneratedOtp={props.setMobileWizardGeneratedOtp}
        mobileWizardTimer={props.mobileWizardTimer}
        setMobileWizardTimer={props.setMobileWizardTimer}
        sendWhatsAppOTP={props.sendWhatsAppOTP as any}
      />

      <Setup2FAModal
        isOpen={props.setup2FAOpen()}
        onClose={() => props.setSetup2FAOpen(false)}
        setup2FASecret={props.setup2FASecret()}
        showNotification={props.showNotification}
        reconcileSession={props.reconcileSession as any}
      />

      <Disable2FAModal
        isOpen={props.disable2FAOpen()}
        onClose={() => props.setDisable2FAOpen(false)}
        showNotification={props.showNotification}
        reconcileSession={props.reconcileSession as any}
      />

      <ConfirmModal
        confirmModal={props.confirmModal()}
        onClose={() => props.setConfirmModal(null)}
      />

      <Suspense fallback={null}>
        <TripForm
          isOpen={props.bookingModalOpen()}
          onClose={() => {
            props.setBookingModalOpen(false);
            props.setEditingTrip(null);
          }}
          trucks={props.approvedOrgTrucks}
          drivers={props.orgDrivers}
          offices={props.orgOffices}
          accounts={props.orgAccounts}
          existingTripNos={Array.from(new Set(props.orgTrips.map(t => t.tripNo).filter(Boolean)))}
          onSubmit={props.handlePostTripEntry}
          editingEntry={props.editingTrip()}
          canViewDrivers={props.currentUserRights().canViewDrivers}
          orgProfile={props.currentOrgProfile}
          trips={props.orgTrips}
          onSaveTrips={props.saveTrips}
          confirmAction={props.confirmAction}
        />
      </Suspense>

      <Suspense fallback={null}>
        <VoiceAssistant
          isOpen={props.isVoiceAssistantOpen()}
          onClose={() => props.setIsVoiceAssistantOpen(false)}
          trucks={props.approvedOrgTrucks}
          drivers={props.orgDrivers}
          offices={props.orgOffices}
          accounts={props.orgAccounts}
          existingTripNos={Array.from(new Set(props.orgTrips.map(t => t.tripNo).filter(Boolean)))}
          onSubmitTrip={props.handlePostTripEntry}
          onSubmitExpense={props.addExpense}
          voiceLang={props.userVoiceLang()}
        />
      </Suspense>
    </Suspense>
  );
}
