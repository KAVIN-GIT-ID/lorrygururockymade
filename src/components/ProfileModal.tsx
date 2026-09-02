import { Suspense, lazy, Component, createSignal, createMemo, onMount, Show } from 'solid-js';
import { User, MessageSquare } from 'lucide-solid';
import ProfileSettings from './ProfileSettings';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useOrganizations } from '../context/OrganizationContext';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
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
  const { t } = useLanguage();

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
  const activeTabVal = () => typeof props.profileActiveTab === 'function' ? (props.profileActiveTab as any)() : (props.profileActiveTab || 'SETTINGS');

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-[9999] font-sans">
        <div class="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in duration-150">
          
          {/* Modal Sidebar */}
          <div class="w-full md:w-64 bg-slate-50 dark:bg-slate-900/50 p-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col gap-2 shrink-0">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-extrabold uppercase tracking-wider text-slate-400">{t('profile.title', 'User Settings')}</span>
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
                activeTabVal() === 'SETTINGS'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-555 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <User class="w-4 h-4" />
              <span>{t('profile.tab_settings', 'Profile & Security')}</span>
            </button>

            {!isBackendTeam() && (
              <button
                onClick={() => props.setProfileActiveTab('SUPPORT')}
                class={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTabVal() === 'SUPPORT'
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
              {activeTabVal() === 'SETTINGS' ? 'Profile & Security' : 'Support Center Help Desk'}
            </h3>
            <button
              onClick={props.onClose}
              class="hidden md:block text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 min-h-0">
            {activeTabVal() === 'SETTINGS' ? (
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
                    const isBackend = orgId === 'org_backend' || !!currentUserRights()?.isSuperAdmin;
                    return raw.filter(st => {
                      if (!st || !st.id) return false;
                      if (isBackend) return true;
                      if (!st.organizationId || st.organizationId === 'org_default') return true;
                      return (st.organizationId || '').toLowerCase().trim() === orgId.toLowerCase().trim();
                    });
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
    </Show>
  );
};

export default ProfileModal;
