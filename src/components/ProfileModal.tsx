import React, { Suspense } from 'react';
import { User, MessageSquare } from 'lucide-react';
import ProfileSettings from './ProfileSettings';
import { UserPermission, OrganizationProfile, SupportTicket } from '../types';

const ProfileSupportTickets = React.lazy(() => import('./ProfileSupportTickets'));

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileActiveTab: 'SETTINGS' | 'SUPPORT';
  setProfileActiveTab: (tab: 'SETTINGS' | 'SUPPORT') => void;
  isBackendTeam: boolean;
  getClientUnreadTicketsCount: () => number;
  currentUser: any;
  currentUserRights: UserPermission;
  organizationProfiles: OrganizationProfile[];
  profileName: string;
  setProfileName: (val: string) => void;
  profileOrgName: string;
  setProfileOrgName: (val: string) => void;
  profileVoiceLang: string;
  setProfileVoiceLang: (val: string) => void;
  oldPassword: string;
  setOldPassword: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  handleUpdateProfile: (newName: string, newOrgName?: string, newPassword?: string, oldPassword?: string) => Promise<void>;
  onChangeMobileClick: () => void;
  onEnable2FAClick: () => void;
  onDisable2FAClick: () => void;
  supportTickets: SupportTicket[];
  currentUserOrgId: string;
  handleCreateSupportTicket: (category: 'Technical' | 'Billing' | 'General', title: string, description: string, attachmentFile?: File) => Promise<void>;
  handleSendSupportTicketMessage: (ticketId: string, content: string, attachmentFile?: File) => Promise<void>;
}

const LoadingTab = () => (
  <div className="flex items-center justify-center p-12 h-64">
    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profileActiveTab,
  setProfileActiveTab,
  isBackendTeam,
  getClientUnreadTicketsCount,
  currentUser,
  currentUserRights,
  organizationProfiles,
  profileName,
  setProfileName,
  profileOrgName,
  setProfileOrgName,
  profileVoiceLang,
  setProfileVoiceLang,
  oldPassword,
  setOldPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  handleUpdateProfile,
  onChangeMobileClick,
  onEnable2FAClick,
  onDisable2FAClick,
  supportTickets,
  currentUserOrgId,
  handleCreateSupportTicket,
  handleSendSupportTicketMessage
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-fade-in flex flex-col md:flex-row overflow-hidden h-[600px] text-left">
        
        {/* Sidebar navigation */}
        <div className="w-full md:w-56 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-1.5 shrink-0">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-extrabold text-slate-850 dark:text-slate-100 text-sm uppercase tracking-wider">Settings Panel</h3>
            {/* Close button for mobile */}
            <button
              onClick={onClose}
              className="md:hidden text-slate-400 hover:text-slate-650 text-sm font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <button
            onClick={() => setProfileActiveTab('SETTINGS')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              profileActiveTab === 'SETTINGS'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-550 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile & Security</span>
          </button>

          {!isBackendTeam && (
            <button
              onClick={() => setProfileActiveTab('SUPPORT')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                profileActiveTab === 'SUPPORT'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-550 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4" />
                <span>Support Center</span>
              </div>
              {getClientUnreadTicketsCount() > 0 && (
                <span className="flex items-center justify-center bg-rose-500 text-white rounded-full text-[9px] px-1.5 min-w-[16px] h-4 font-sans font-bold leading-none animate-pulse">
                  {getClientUnreadTicketsCount()}
                </span>
              )}
            </button>
          )}
          
          <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 hidden md:block">
            <button
              onClick={onClose}
              className="w-full py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Close Settings
            </button>
          </div>
        </div>

        {/* Main content pane */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/20 dark:bg-slate-950/5 shrink-0">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              {profileActiveTab === 'SETTINGS' ? 'Profile & Security' : 'Support Center Help Desk'}
            </h3>
            <button
              onClick={onClose}
              className="hidden md:block text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 min-h-0">
            {profileActiveTab === 'SETTINGS' ? (
              <ProfileSettings
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
                onCancel={onClose}
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (import.meta.env.DEV) {
                    console.log("DEBUG onSubmit clicked!");
                  }
                  await handleUpdateProfile(profileName, profileOrgName, newPassword, oldPassword);
                  if (import.meta.env.DEV) {
                    console.log("DEBUG onSubmit handleUpdateProfile finished!");
                  }
                }}
                onChangeMobileClick={onChangeMobileClick}
                onEnable2FAClick={onEnable2FAClick}
                onDisable2FAClick={onDisable2FAClick}
              />
            ) : (
              <Suspense fallback={<LoadingTab />}>
                <ProfileSupportTickets
                  tickets={supportTickets.filter(st => currentUserOrgId === 'org_backend' || st.organizationId === currentUserOrgId)}
                  onCreateTicket={handleCreateSupportTicket}
                  onSendMessage={handleSendSupportTicketMessage}
                  isBackendTeam={currentUserOrgId === 'org_backend' || currentUserRights.isSuperAdmin}
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
