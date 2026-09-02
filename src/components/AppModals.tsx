import { Suspense, Show, lazy, mergeProps } from 'solid-js';
import { useTripsContext } from '../context/TripContext';
import { useTrucksContext } from '../context/TruckContext';
import { useDriversContext } from '../context/DriverContext';
import { useExpensesContext } from '../context/ExpenseContext';
import { useOfficesContext } from '../context/OfficeContext';
import { useAccountsContext } from '../context/AccountContext';
import { useTyresContext } from '../context/TyreContext';
import { Truck, TripEntry, UserPermission, OrganizationProfile, SupportTicket } from '../types';

import ProfileModal from './ProfileModal';
import MobileChangeWizardModal from './MobileChangeWizardModal';
import Setup2FAModal from './Setup2FAModal';
import Disable2FAModal from './Disable2FAModal';
import ConfirmModal from './ConfirmModal';
import TripForm from './TripForm';
import VoiceAssistant from './VoiceAssistant';

interface AppModalsProps {
  profileModalOpen: () => boolean;
  setProfileModalOpen: (open: boolean) => void;
  profileActiveTab: () => 'SETTINGS' | 'SUPPORT';
  setProfileActiveTab: (tab: 'SETTINGS' | 'SUPPORT') => void;
  isBackendTeam: boolean;
  getClientUnreadTicketsCount: () => number;
  handleUpdateProfile: (newName: string, newOrgName?: string, newPassword?: string, oldPassword?: string, kycDetails?: any) => Promise<void>;
  setMobileWizardOpen: (open: boolean) => void;
  setSetup2FAOpen: (open: boolean) => void;
  setDisable2FAOpen: (open: boolean) => void;
  supportTickets: () => SupportTicket[];
  currentUserOrgId: string;
  handleCreateSupportTicket: (subject: string, category: string, description: string) => Promise<void>;
  handleSendSupportTicketMessage: (ticketId: string, text: string) => Promise<void>;
  payments: () => any[];
  mobileWizardOpen: () => boolean;
  mobileWizardStep: () => number;
  setMobileWizardStep: (step: number) => void;
  mobileWizardCode: () => string;
  setMobileWizardCode: (code: string) => void;
  mobileWizardNewPhone: () => string;
  setMobileWizardNewPhone: (phone: string) => void;
  mobileWizardPassword: () => string;
  setMobileWizardPassword: (password: string) => void;
  mobileWizardError: () => string | null;
  setMobileWizardError: (err: string | null) => void;
  mobileWizardGeneratedOtp: () => string | null;
  setMobileWizardGeneratedOtp: (otp: string | null) => void;
  mobileWizardTimer: () => number;
  setMobileWizardTimer: (secs: number) => void;
  sendWhatsAppOTP: (phone: string) => Promise<string>;
  currentUser: () => any;
  currentUserRights: () => UserPermission | undefined;
  organizationProfiles: () => OrganizationProfile[];
  userRightsList: () => UserPermission[];
  setUserRightsList: (list: UserPermission[]) => void;
  pushPermissionsToCloud: (list: UserPermission[]) => Promise<void>;
  reconcileSession: (user: any) => Promise<void>;
  setCurrentUser: (user: any) => void;
  showNotification: (msg: string) => void;
  setup2FAOpen: () => boolean;
  setup2FASecret: () => string;
  disable2FAOpen: () => boolean;
  confirmModal: () => any;
  setConfirmModal: (val: any) => void;
  bookingModalOpen: () => boolean;
  setBookingModalOpen: (open: boolean) => void;
  editingTrip: () => TripEntry | null;
  setEditingTrip: (trip: TripEntry | null) => void;
  activeTab?: () => string;
  voiceAssistantOpen?: () => boolean;
  setVoiceAssistantOpen?: (open: boolean) => void;
  isVoiceAssistantOpen?: () => boolean;
  setIsVoiceAssistantOpen?: (open: boolean) => void;
  onSubmitTrip?: (data: any) => void;
  onSubmitExpense?: (data: any) => void;
  currentOrgProfile?: OrganizationProfile;
  confirmAction?: any;
  userVoiceLang?: () => string;
  handlePostTripEntry?: any;
  addExpense?: any;
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
          supportTickets={props.supportTickets}
          handleCreateSupportTicket={props.handleCreateSupportTicket}
          handleSendSupportTicketMessage={props.handleSendSupportTicketMessage}
          payments={props.payments}
        />
      )}

      {props.mobileWizardOpen() && (
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
          mobileWizardTimer={props.mobileWizardTimer()}
          setMobileWizardTimer={props.setMobileWizardTimer}
          sendWhatsAppOTP={props.sendWhatsAppOTP as any}
        />
      )}

      {props.setup2FAOpen() && (
        <Setup2FAModal
          isOpen={props.setup2FAOpen()}
          onClose={() => props.setSetup2FAOpen(false)}
          setup2FASecret={props.setup2FASecret()}
          showNotification={props.showNotification}
          reconcileSession={props.reconcileSession as any}
        />
      )}

      {props.disable2FAOpen() && (
        <Disable2FAModal
          isOpen={props.disable2FAOpen()}
          onClose={() => props.setDisable2FAOpen(false)}
          showNotification={props.showNotification}
          reconcileSession={props.reconcileSession as any}
        />
      )}

      {props.confirmModal() && (
        <ConfirmModal
          confirmModal={props.confirmModal()}
          onClose={() => props.setConfirmModal(null)}
        />
      )}

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
          onSubmit={(props as any).handlePostTripEntry}
          editingEntry={props.editingTrip()}
          canViewDrivers={props.currentUserRights()?.canViewDrivers}
          orgProfile={(props.organizationProfiles ? props.organizationProfiles()[0] : undefined)}
          trips={props.orgTrips}
          onSaveTrips={tripsCtx.saveTrips}
          confirmAction={(props as any).confirmAction}
        />
      </Suspense>

      <Suspense fallback={null}>
        <VoiceAssistant
          isOpen={rawProps.voiceAssistantOpen ? rawProps.voiceAssistantOpen() : (rawProps.isVoiceAssistantOpen ? rawProps.isVoiceAssistantOpen() : false)}
          onClose={() => rawProps.setVoiceAssistantOpen ? rawProps.setVoiceAssistantOpen(false) : (rawProps.setIsVoiceAssistantOpen ? rawProps.setIsVoiceAssistantOpen(false) : undefined)}
          trucks={props.approvedOrgTrucks}
          drivers={props.orgDrivers}
          offices={props.orgOffices}
          accounts={props.orgAccounts}
          existingTripNos={Array.from(new Set(props.orgTrips.map(t => t.tripNo).filter(Boolean)))}
          onSubmitTrip={(props as any).handlePostTripEntry}
          onSubmitExpense={expenseCtx.addExpense}
          voiceLang={(props as any).userVoiceLang ? (props as any).userVoiceLang() : 'en-IN'}
        />
      </Suspense>
    </Suspense>
  );
}
