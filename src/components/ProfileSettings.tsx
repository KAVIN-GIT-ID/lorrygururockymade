import { createSignal, createEffect, onMount } from 'solid-js';

import { UserRights, OrganizationProfile } from '../types';
import { isAppwriteConfigured } from '../lib/appwrite';
import { cryptoService } from '../services/cryptoService';
import OfflinePinModal from './OfflinePinModal';

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
  onSubmit: (e: Event) => void;
  onChangeMobileClick: () => void;
  onEnable2FAClick: () => void;
  onDisable2FAClick: () => void;
  profileGst: string;
  setProfileGst: (val: string) => void;
  profilePan: string;
  setProfilePan: (val: string) => void;
  profileAadhaar: string;
  setProfileAadhaar: (val: string) => void;
  profileAddress: string;
  setProfileAddress: (val: string) => void;
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
  onDisable2FAClick,
  profileGst,
  setProfileGst,
  profilePan,
  setProfilePan,
  profileAadhaar,
  setProfileAadhaar,
  profileAddress,
  setProfileAddress
}: ProfileSettingsProps) {
  const [showPinModal, setShowPinModal] = createSignal(false);
  const [hasPinSetup, setHasPinSetup] = createSignal(false);
  const [biometricsAvailable, setBiometricsAvailable] = createSignal(false);
  const [useBiometrics, setUseBiometrics] = createSignal(false);

  onMount(async () => {
    setHasPinSetup(!!localStorage.getItem('ttt_pin_verify'));
    const isBioAvail = await cryptoService.checkBiometricsAvailable();
    setBiometricsAvailable(isBioAvail);
    setUseBiometrics(localStorage.getItem('ttt_use_biometrics') === 'true');
  });

  const handleToggleBiometrics = (val: boolean) => {
    setUseBiometrics(val);
    if (val) {
      localStorage.setItem('ttt_use_biometrics', 'true');
    } else {
      localStorage.removeItem('ttt_use_biometrics');
    }
  };

  return (
    <form onSubmit={onSubmit} class="max-w-md space-y-4">
      {/* DISPLAY NAME */}
      <div>
        <label class="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">Display Name</label>
        <input
          type="text"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          required
          class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-808 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
        />
      </div>

      {/* ORGANIZATION NAME */}
      {currentUserRights.isAdmin && currentUserRights.organizationId && currentUserRights.organizationId !== 'org_backend' && (
        <div>
          <label class="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">Organization Name</label>
          <input
            type="text"
            value={profileOrgName}
            onChange={(e) => setProfileOrgName(e.target.value)}
            required
            class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-808 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
      )}

      {/* EMAIL (READ-ONLY) */}
      <div>
        <label class="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Email Address (Read-only)</label>
        <input
          type="email"
          value={currentUser?.email || ''}
          disabled
          class="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-850 text-slate-500 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
        />
      </div>

      {/* MOBILE NUMBER */}
      <div>
        <label class="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">Mobile Number</label>
        <div class="flex gap-2">
          <input
            type="text"
            value={currentUserRights.phone || 'Not Set'}
            disabled
            class="flex-1 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-850 text-slate-500 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
          />
          <button
            type="button"
            onClick={onChangeMobileClick}
            class="px-3 py-2 bg-blue-600 hover:bg-blue-755 text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer shrink-0"
          >
            Change
          </button>
        </div>
      </div>

      {/* VOICE ASSISTANT LANGUAGE */}
      <div>
        <label for="voice-lang-select" class="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">Voice Assistant Language</label>
        <select
          id="voice-lang-select"
          value={profileVoiceLang}
          onChange={(e) => setProfileVoiceLang(e.target.value)}
          class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-808 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
        >
          <option value="en-IN">English (India) - en-IN</option>
          <option value="hi-IN">Hindi (हिन्दी) - hi-IN</option>
          <option value="ta-IN">Tamil (தமிழ்) - ta-IN</option>
          <option value="te-IN">Telugu (తెలుగు) - te-IN</option>
          <option value="kn-IN">Kannada (ಕನ್ನಡ) - kn-IN</option>
          <option value="mr-IN">Marathi (मराठी) - mr-IN</option>
        </select>
      </div>

      {/* GST & BUSINESS KYC DETAILS (BILLING) */}
      <div class="border-t border-slate-105 dark:border-slate-800 pt-3">
        <span class="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block mb-2 font-sans">
          GST & Business KYC Details (Billing)
        </span>
        <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 space-y-3">
          <div>
            <label class="block text-[10px] font-bold text-slate-550 uppercase tracking-wide mb-1">GSTIN (15 Characters)</label>
            <input
              type="text"
              value={profileGst}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15);
                setProfileGst(val);
              }}
              placeholder="e.g. 33AAFCL8686P1Z4"
              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-205 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-bold text-slate-550 uppercase tracking-wide mb-1">PAN Card (10 Characters)</label>
              <input
                type="text"
                value={profilePan}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
                  setProfilePan(val);
                }}
                placeholder="e.g. AAFCL8686P"
                class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-205 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-550 uppercase tracking-wide mb-1">Aadhaar (12 Digits)</label>
              <input
                type="text"
                value={profileAadhaar}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').substring(0, 12);
                  setProfileAadhaar(val);
                }}
                placeholder="e.g. 123456789012"
                class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-205 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-555 uppercase tracking-wide mb-1">Billing Address</label>
            <textarea
              value={profileAddress}
              onChange={(e) => setProfileAddress(e.target.value)}
              placeholder="Full billing address for tax invoices"
              rows={2}
              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-205 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* OFFLINE ACCESS SECURITY */}
      <div class="border-t border-slate-100 dark:border-slate-800 pt-3">
        <span class="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block mb-2 font-sans">Offline Access Security</span>
        <div class="bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
          <div class="flex justify-between items-center">
            <div class="space-y-0.5">
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200">Offline Security PIN</span>
              <p class="text-[10px] text-slate-400 dark:text-slate-550 leading-normal">
                {hasPinSetup() ? 'PIN is configured. Data is encrypted.' : 'Set up a PIN to secure your local data.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPinModal(true)}
              class="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-[10px] font-bold shadow-xs transition cursor-pointer"
            >
              {hasPinSetup() ? 'Change PIN' : 'Set Up PIN'}
            </button>
          </div>

          {biometricsAvailable() && (
            <div class="flex justify-between items-center border-t border-slate-100 dark:border-slate-850 pt-3">
              <div class="space-y-0.5">
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200">Biometric Unlock</span>
                <p class="text-[10px] text-slate-400 dark:text-slate-550 leading-normal">
                  Unlock the app using fingerprint/face recognition.
                </p>
              </div>
              <input
                type="checkbox"
                checked={useBiometrics()}
                onChange={(e) => handleToggleBiometrics(e.currentTarget.checked)}
                class="rounded border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500 bg-slate-50 dark:bg-slate-950 cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>

      {showPinModal() && (
        <OfflinePinModal
          mode="setup"
          onSuccess={() => {
            setHasPinSetup(true);
            setShowPinModal(false);
          }}
          onCancel={() => setShowPinModal(false)}
        />
      )}

      {/* TWO-FACTOR AUTHENTICATION (2FA) */}
      <div class="border-t border-slate-100 dark:border-slate-800 pt-3">
        <span class="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block mb-2 font-sans">Two-Factor Authentication (2FA)</span>
        <div class="bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex justify-between items-center">
          <div class="space-y-0.5">
            <div class="flex items-center gap-1.5">
              <span class={`w-2 h-2 rounded-full ${currentUserRights.is2FAEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200">{currentUserRights.is2FAEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <p class="text-[10px] text-slate-400 dark:text-slate-550 leading-normal">
              Protect your account with Google Authenticator TOTP codes.
            </p>
          </div>
          {currentUserRights.is2FAEnabled ? (
            <button
              type="button"
              onClick={onDisable2FAClick}
              class="px-3 py-1.5 border border-red-500/30 hover:border-red-50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-[10px] font-bold transition cursor-pointer"
            >
              Disable
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnable2FAClick}
              class="px-3 py-1.5 bg-blue-600 hover:bg-blue-750 text-white rounded-lg text-[10px] font-bold shadow-xs transition cursor-pointer"
            >
              Enable
            </button>
          )}
        </div>
      </div>

      {/* CHANGE PASSWORD */}
      <div class="border-t border-slate-100 dark:border-slate-800 pt-3">
        <span class="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block mb-2 font-sans">Change Password</span>

        {localStorage.getItem('ttt_login_method') === 'appwrite' && (
          <div class="mb-3">
            <label class="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">Current Password</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              class="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        )}

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              class="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
          <div>
            <label class="block text-[11px] font-extrabold text-slate-655 uppercase tracking-wider mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              class="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      <div class="mt-5.5 flex justify-end gap-2.5 select-none pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          class="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer border border-slate-200/40 dark:border-slate-700/60"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
}
