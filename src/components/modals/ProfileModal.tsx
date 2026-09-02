import React, { useState, useEffect } from 'react';
import { UserPermission } from '../../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  currentUserRights: UserPermission;
  onUpdateProfile: (
    name: string,
    orgName?: string,
    newPassword?: string,
    oldPassword?: string,
    voiceLang?: string
  ) => Promise<void>;
  onOpenMobileWizard: () => void;
  onOpenSetup2FA: () => void;
  onOpenDisable2FA: () => void;
  initialVoiceLang?: string;
  initialOrgName?: string;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentUserRights,
  onUpdateProfile,
  onOpenMobileWizard,
  onOpenSetup2FA,
  onOpenDisable2FA,
  initialVoiceLang = 'en-IN',
  initialOrgName = ''
}) => {
  const [profileName, setProfileName] = useState('');
  const [profileOrgName, setProfileOrgName] = useState('');
  const [profileVoiceLang, setProfileVoiceLang] = useState('en-IN');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      setProfileName(currentUser.name || currentUserRights.name || '');
      setProfileOrgName(initialOrgName || currentUserRights.organizationId || '');
      setProfileVoiceLang(initialVoiceLang);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, currentUser, currentUserRights, initialOrgName, initialVoiceLang]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      alert('New passwords do not match!');
      return;
    }
    const loginMethod = localStorage.getItem('ttt_login_method');
    if (loginMethod === 'appwrite' && newPassword && !oldPassword) {
      alert('Current password is required to change password in Appwrite.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onUpdateProfile(
        profileName,
        currentUserRights.isAdmin ? profileOrgName : undefined,
        newPassword || undefined,
        oldPassword || undefined,
        profileVoiceLang
      );
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl animate-fade-in text-left">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
          <h3 className="font-bold text-slate-900 text-base">Profile Settings</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* DISPLAY NAME */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* ORGANIZATION NAME */}
          {currentUserRights.isAdmin && currentUserRights.organizationId && currentUserRights.organizationId !== 'org_backend' && (
            <div>
              <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">
                Organization Name
              </label>
              <input
                type="text"
                value={profileOrgName}
                onChange={(e) => setProfileOrgName(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          )}

          {/* EMAIL (READ-ONLY) */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              Email Address (Read-only)
            </label>
            <input
              type="email"
              value={currentUser?.email || ''}
              disabled
              className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
            />
          </div>

          {/* MOBILE NUMBER */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">
              Mobile Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={currentUserRights.phone || 'Not Set'}
                disabled
                className="flex-1 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
              />
              <button
                type="button"
                onClick={onOpenMobileWizard}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-600/10 cursor-pointer"
              >
                Change
              </button>
            </div>
          </div>

          {/* VOICE ASSISTANT LANGUAGE */}
          <div>
            <label htmlFor="voice-lang-select" className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">
              Voice Assistant Language
            </label>
            <select
              id="voice-lang-select"
              value={profileVoiceLang}
              onChange={(e) => setProfileVoiceLang(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
            >
              <option value="en-IN">English (India) - en-IN</option>
              <option value="hi-IN">Hindi (हिन्दी) - hi-IN</option>
              <option value="ta-IN">Tamil (தமிழ்) - ta-IN</option>
              <option value="te-IN">Telugu (తెలుగు) - te-IN</option>
              <option value="kn-IN">Kannada (ಕನ್ನಡ) - kn-IN</option>
              <option value="mr-IN">Marathi (मराठी) - mr-IN</option>
            </select>
          </div>

          {/* TWO-FACTOR AUTHENTICATION (2FA) */}
          <div className="border-t border-slate-100 pt-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block mb-2 font-sans">
              Two-Factor Authentication (2FA)
            </span>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex justify-between items-center">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${currentUserRights.is2FAEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  <span className="text-xs font-bold text-slate-800">{currentUserRights.is2FAEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Protect your account with Google Authenticator TOTP codes.
                </p>
              </div>
              {currentUserRights.is2FAEnabled ? (
                <button
                  type="button"
                  onClick={onOpenDisable2FA}
                  className="px-3 py-1.5 border border-red-500/30 hover:border-red-500 text-red-500 hover:bg-red-50 rounded-lg text-[10px] font-bold transition cursor-pointer"
                >
                  Disable
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenSetup2FA}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-md shadow-blue-600/10 transition cursor-pointer"
                >
                  Enable
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block mb-2 font-sans">
              Change Password
            </span>

            {localStorage.getItem('ttt_login_method') === 'appwrite' && (
              <div className="mb-3">
                <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          <div className="mt-5.5 flex justify-end gap-2.5 select-none pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer border border-slate-200/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-600/10 hover:shadow-blue-600/20 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
