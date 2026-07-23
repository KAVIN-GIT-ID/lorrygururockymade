import { Suspense, lazy, Component, createSignal, createMemo, onMount } from 'solid-js';
import { User, MessageSquare } from 'lucide-solid';
import ProfileSettings from './ProfileSettings';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useOrganizations } from '../context/OrganizationContext';
import { useNotifications } from '../context/NotificationContext';
import { SupportTicket } from '../types';

const ProfileSupportTickets = lazy(() => import('./ProfileSupportTickets'));

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileActiveTab: 'SETTINGS' | 'SUPPORT';
  setProfileActiveTab: (tab: 'SETTINGS' | 'SUPPORT') => void;
  onChangeMobileClick: () => void;
  onEnable2FAClick: () => void;
  onDisable2FAClick: () => void;
  getClientUnreadTicketsCount: () => number;
  supportTickets: SupportTicket[] | (() => SupportTicket[]);
  payments: any[] | (() => any[]);
  handleCreateSupportTicket: (category: 'Technical' | 'Billing' | 'General', title: string, description: string, attachmentFile?: File) => Promise<void>;
  handleSendSupportTicketMessage: (ticketId: string, content: string, attachmentFile?: File) => Promise<void>;
  handleUpdateProfile: (newName: string, newOrgName?: string, newPassword?: string, oldPassword?: string) => Promise<void>;
}

const LoadingTab = () => (
  <div class="flex items-center justify-center p-12 h-64">
    <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export const ProfileModal: Component<ProfileModalProps> = (props) => {
  if (!props.isOpen) return null;

  const auth = useAuth();
  const perm = usePermissions();
  const orgs = useOrganizations();
  const notifications = useNotifications();

  const currentUser = auth.currentUser;
  const currentUserRights = perm.currentUserRights;
  const organizationProfiles = orgs.organizationProfiles;
  const currentUserOrgId = () => perm.currentUserOrgId() || '';

  // Local Form Inputs
  const [profileName, setProfileName] = createSignal('');
  const [profileOrgName, setProfileOrgName] = createSignal('');
  const [oldPassword, setOldPassword] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [profileVoiceLang, setProfileVoiceLang] = createSignal('en-IN');

  const [profileGst, setProfileGst] = createSignal('');
  const [profilePan, setProfilePan] = createSignal('');
  const [profileAadhaar, setProfileAadhaar] = createSignal('');
  const [profileAddress, setProfileAddress] = createSignal('');

  onMount(() => {
    const user = currentUser();
    if (user) {
      setProfileName(user.name || '');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      const email = (user.email || '').toLowerCase().trim();
      setProfileVoiceLang(localStorage.getItem(`ttt_voice_lang_${email}`) || 'en-IN');
      
      const currentOrgId = currentUserRights()?.organizationId || '';
      const orgProfile = organizationProfiles().find(p => p.organizationId === currentOrgId);
      setProfileOrgName(orgProfile ? orgProfile.organizationName : '');
      setProfileGst(orgProfile?.gstNo || '');
      setProfilePan(orgProfile?.panNo || '');
      setProfileAadhaar(orgProfile?.aadhaarNo || '');
      setProfileAddress(orgProfile?.address || '');
    }
  });

  const isBackendTeam = () => currentUserOrgId() === 'org_backend' || !!currentUserRights()?.isSuperAdmin;

  return (
    <div class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
      <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-fade-in flex flex-col md:flex-row overflow-hidden h-[600px] text-left">
        
        {/* Sidebar navigation */}
        <div class="w-full md:w-56 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-1.5 shrink-0">
          <div class="flex justify-between items-center mb-6">
            <h3 class="font-extrabold text-slate-850 dark:text-slate-100 text-sm uppercase tracking-wider">Settings Panel</h3>
            <button
              onClick={props.onClose}
              class="md:hidden text-slate-400 hover:text-slate-655 text-sm font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <button
            onClick={() => props.setProfileActiveTab('SETTINGS')}
            class={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              props.profileActiveTab === 'SETTINGS'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-555 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <User class="w-4 h-4" />
            <span>Profile & Security</span>
          </button>

          {!isBackendTeam && (
            <button
              onClick={() => props.setProfileActiveTab('SUPPORT')}
              class={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                props.profileActiveTab === 'SUPPORT'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-555 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <div class="flex items-center gap-2.5">
                <MessageSquare class="w-4 h-4" />
                <span>Support Center</span>
              </div>
              {props.getClientUnreadTicketsCount() > 0 && (
                <span class="flex items-center justify-center bg-rose-500 text-white rounded-full text-[9px] px-1.5 min-w-[16px] h-4 font-sans font-bold leading-none animate-pulse">
                  {props.getClientUnreadTicketsCount()}
                </span>
              )}
            </button>
          )}
          
          <div class="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 hidden md:block">
            <button
              onClick={props.onClose}
              class="w-full py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-355 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Close Settings
            </button>
          </div>
        </div>

        {/* Main content pane */}
        <div class="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
          <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/20 dark:bg-slate-950/5 shrink-0">
            <h3 class="font-bold text-slate-900 dark:text-slate-100 text-sm">
              {props.profileActiveTab === 'SETTINGS' ? 'Profile & Security' : 'Support Center Help Desk'}
            </h3>
            <button
              onClick={props.onClose}
              class="hidden md:block text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 min-h-0">
            {props.profileActiveTab === 'SETTINGS' ? (
              <ProfileSettings
                currentUser={currentUser()}
                currentUserRights={currentUserRights() as any}
                organizationProfiles={organizationProfiles()}
                profileName={profileName()}
                setProfileName={setProfileName}
                profileOrgName={profileOrgName()}
                setProfileOrgName={setProfileOrgName}
                profileVoiceLang={profileVoiceLang()}
                setProfileVoiceLang={setProfileVoiceLang}
                oldPassword={oldPassword()}
                setOldPassword={setOldPassword}
                newPassword={newPassword()}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword()}
                setConfirmPassword={setConfirmPassword}
                onCancel={props.onClose}
                onSubmit={async (e) => {
                  e.preventDefault();
                  
                  const userEmail = (currentUser().email || '').toLowerCase().trim();
                  localStorage.setItem(`ttt_voice_lang_${userEmail}`, profileVoiceLang());

                  await props.handleUpdateProfile(profileName(), profileOrgName(), newPassword(), oldPassword());
                }}
                onChangeMobileClick={props.onChangeMobileClick}
                onEnable2FAClick={props.onEnable2FAClick}
                onDisable2FAClick={props.onDisable2FAClick}
                profileGst={profileGst()}
                setProfileGst={setProfileGst}
                profilePan={profilePan()}
                setProfilePan={setProfilePan}
                profileAadhaar={profileAadhaar()}
                setProfileAadhaar={setProfileAadhaar}
                profileAddress={profileAddress()}
                setProfileAddress={setProfileAddress}
              />
            ) : (
              <Suspense fallback={<LoadingTab />}>
                <ProfileSupportTickets
                  tickets={createMemo(() => {
                    const raw = typeof props.supportTickets === 'function' ? props.supportTickets() : (props.supportTickets || []);
                    const orgId = currentUserOrgId();
                    return raw.filter(st => orgId === 'org_backend' || st.organizationId === orgId || st.organizationId === 'org_default' || !st.organizationId);
                  })}
                  onCreateTicket={props.handleCreateSupportTicket}
                  onSendMessage={props.handleSendSupportTicketMessage}
                  isBackendTeam={currentUserOrgId() === 'org_backend' || !!currentUserRights()?.isSuperAdmin}
                  payments={typeof props.payments === 'function' ? props.payments() : (props.payments || [])}
                  orgName={profileOrgName()}
                  gstNo={profileGst()}
                  panNo={profilePan()}
                  address={profileAddress()}
                />
              </Suspense>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfileModal;
