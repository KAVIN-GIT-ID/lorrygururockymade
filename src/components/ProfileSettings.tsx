import React from 'react';
import { UserRights, OrganizationProfile } from '../types';
import { isAppwriteConfigured } from '../lib/appwrite';

interface ProfileSettingsProps {
  currentUser: any;
  currentUserRights: UserRights;
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
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChangeMobileClick: () => void;
  onEnable2FAClick: () => void;
  onDisable2FAClick: () => void;
}

export default function ProfileSettings({
  currentUser,
  currentUserRights,
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
  onCancel,
  onSubmit,
  onChangeMobileClick,
  onEnable2FAClick,
  onDisable2FAClick
}: ProfileSettingsProps) {
  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      {/* DISPLAY NAME */}
      <div>
        <label className="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">Display Name</label>
        <input
          type="text"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          required
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-808 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
        />
      </div>

      {/* ORGANIZATION NAME */}
      {currentUserRights.isAdmin && currentUserRights.organizationId && currentUserRights.organizationId !== 'org_backend' && (
        <div>
          <label className="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">Organization Name</label>
          <input
            type="text"
            value={profileOrgName}
            onChange={(e) => setProfileOrgName(e.target.value)}
            required
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-808 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
      )}

      {/* EMAIL (READ-ONLY) */}
      <div>
        <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Email Address (Read-only)</label>
        <input
          type="email"
          value={currentUser?.email || ''}
          disabled
          className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-850 text-slate-500 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
        />
      </div>

      {/* MOBILE NUMBER */}
      <div>
        <label className="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">Mobile Number</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={currentUserRights.phone || 'Not Set'}
            disabled
            className="flex-1 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-850 text-slate-500 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
          />
          <button
            type="button"
            onClick={onChangeMobileClick}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-750 text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer shrink-0"
          >
            Change
          </button>
        </div>
      </div>

      {/* VOICE ASSISTANT LANGUAGE */}
      <div>
        <label htmlFor="voice-lang-select" className="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">Voice Assistant Language</label>
        <select
          id="voice-lang-select"
          value={profileVoiceLang}
          onChange={(e) => setProfileVoiceLang(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
        >
          <option value="en-IN">English (India) - en-IN</option>
          <option value="hi-IN">Hindi (हिन्दी) - hi-IN</option>
          <option value="ta-IN">Tamil (தமிழ்) - ta-IN</option>
          <option value="te-IN">Telugu (తెలుగు) - te-IN</option>
          <option value="kn-IN">Kannada (ಕನ್ನಡ) - kn-IN</option>
          <option value="mr-IN">Marathi (மраठी) - mr-IN</option>
        </select>
      </div>

      {/* TWO-FACTOR AUTHENTICATION (2FA) */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block mb-2 font-sans">Two-Factor Authentication (2FA)</span>
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex justify-between items-center">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${currentUserRights.is2FAEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{currentUserRights.is2FAEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-550 leading-normal">
              Protect your account with Google Authenticator TOTP codes.
            </p>
          </div>
          {currentUserRights.is2FAEnabled ? (
            <button
              type="button"
              onClick={onDisable2FAClick}
              className="px-3 py-1.5 border border-red-500/30 hover:border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-[10px] font-bold transition cursor-pointer"
            >
              Disable
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnable2FAClick}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-750 text-white rounded-lg text-[10px] font-bold shadow-xs transition cursor-pointer"
            >
              Enable
            </button>
          )}
        </div>
      </div>

      {/* CHANGE PASSWORD */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block mb-2 font-sans">Change Password</span>

        {localStorage.getItem('ttt_login_method') === 'appwrite' && (
          <div className="mb-3">
            <label className="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">Current Password</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      <div className="mt-5.5 flex justify-end gap-2.5 select-none pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer border border-slate-200/40 dark:border-slate-700/60"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
}
