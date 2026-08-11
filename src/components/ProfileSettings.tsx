import { createSignal, onMount } from 'solid-js';
import { User, Shield, KeyRound, Bell, CreditCard, Lock, Smartphone } from 'lucide-solid';

import { UserRights, OrganizationProfile } from '../types';
import { cryptoService } from '../services/cryptoService';
import OfflinePinModal from './OfflinePinModal';
import { useNotifications } from '../context/NotificationContext';

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

export type SettingsSubTab = 'GENERAL' | 'SECURITY' | 'PRIVACY' | 'APP';

export default function ProfileSettings(props: ProfileSettingsProps) {
  const currentUser = () => props.currentUser || ({} as any);
  const currentUserRights = () => props.currentUserRights || ({} as any);
  const [activeSubTab, setActiveSubTab] = createSignal<SettingsSubTab>('GENERAL');
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

  let notificationsCtx: any;
  try {
    notificationsCtx = useNotifications();
  } catch (e) {
    console.warn('[ProfileSettings] NotificationContext not available in tree');
  }

  const currentToastPos = () => notificationsCtx?.toastPosition() || 'top-right';

  return (
    <div class="space-y-5 max-w-xl">
      {/* SUB-CATEGORY TAB PILLS */}
      <div class="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveSubTab('GENERAL')}
          class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeSubTab() === 'GENERAL'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <User class="w-3.5 h-3.5" />
          <span>General Info</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('SECURITY')}
          class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeSubTab() === 'SECURITY'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Shield class="w-3.5 h-3.5" />
          <span>Security</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('PRIVACY')}
          class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeSubTab() === 'PRIVACY'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CreditCard class="w-3.5 h-3.5" />
          <span>Billing & KYC</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('APP')}
          class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeSubTab() === 'APP'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Bell class="w-3.5 h-3.5" />
          <span>App Settings</span>
        </button>
      </div>

      <form onSubmit={props.onSubmit} class="space-y-4">
        {/* TAB 1: GENERAL INFO */}
        {activeSubTab() === 'GENERAL' && (
          <div class="space-y-4 animate-in fade-in duration-150">
            <div>
              <label class="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Display Name</label>
              <input
                type="text"
                value={props.profileName}
                onChange={(e) => props.setProfileName(e.target.value)}
                required
                class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            {currentUserRights().isAdmin && currentUserRights().organizationId && currentUserRights().organizationId !== 'org_backend' && (
              <div>
                <label class="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Organization Name</label>
                <input
                  type="text"
                  value={props.profileOrgName}
                  onChange={(e) => props.setProfileOrgName(e.target.value)}
                  required
                  class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            )}

            <div>
              <label class="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Email Address (Read-only)</label>
              <input
                type="email"
                value={currentUser()?.email || ''}
                disabled
                class="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-500 rounded-lg px-3.5 py-2 text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label class="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">Mobile Number</label>
              <div class="flex gap-2">
                <input
                  type="text"
                  value={currentUserRights().phone || 'Not Set'}
                  disabled
                  class="flex-1 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-500 rounded-lg px-3.5 py-2 text-xs font-semibold focus:outline-none"
                />
                <button
                  type="button"
                  onClick={props.onChangeMobileClick}
                  class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer shrink-0"
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SECURITY & PASSWORD */}
        {activeSubTab() === 'SECURITY' && (
          <div class="space-y-4.5 animate-in fade-in duration-150">
            {/* OFFLINE SECURITY PIN */}
            <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <div class="flex justify-between items-center">
                <div class="space-y-0.5">
                  <span class="text-xs font-bold text-slate-800 dark:text-slate-200">Offline Security PIN</span>
                  <p class="text-[10px] text-slate-400 leading-normal">
                    {hasPinSetup() ? 'PIN is active. Your local data is encrypted.' : 'Set up a PIN to secure offline data.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPinModal(true)}
                  class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  {hasPinSetup() ? 'Change PIN' : 'Set Up PIN'}
                </button>
              </div>

              {biometricsAvailable() && (
                <div class="flex justify-between items-center border-t border-slate-200/60 dark:border-slate-800 pt-3">
                  <div class="space-y-0.5">
                    <span class="text-xs font-bold text-slate-800 dark:text-slate-200">Biometric Unlock</span>
                    <p class="text-[10px] text-slate-400 leading-normal">
                      Unlock using fingerprint or face recognition.
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

            {/* TWO-FACTOR AUTHENTICATION (2FA) */}
            <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex justify-between items-center">
              <div class="space-y-0.5">
                <div class="flex items-center gap-1.5">
                  <span class={`w-2 h-2 rounded-full ${currentUserRights().is2FAEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  <span class="text-xs font-bold text-slate-800 dark:text-slate-200">2FA Authenticator ({currentUserRights().is2FAEnabled ? 'Enabled' : 'Disabled'})</span>
                </div>
                <p class="text-[10px] text-slate-400 leading-normal">
                  Protect login with Google Authenticator TOTP codes.
                </p>
              </div>
              {currentUserRights().is2FAEnabled ? (
                <button
                  type="button"
                  onClick={props.onDisable2FAClick}
                  class="px-3 py-1.5 border border-red-500/30 hover:border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Disable
                </button>
              ) : (
                <button
                  type="button"
                  onClick={props.onEnable2FAClick}
                  class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Enable
                </button>
              )}
            </div>

            {/* CHANGE PASSWORD */}
            <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200 block">Change Account Password</span>

              {localStorage.getItem('ttt_login_method') === 'appwrite' && (
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Current Password</label>
                  <input
                    type="password"
                    value={props.oldPassword}
                    onChange={(e) => props.setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">New Password</label>
                  <input
                    type="password"
                    value={props.newPassword}
                    onChange={(e) => props.setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={props.confirmPassword}
                    onChange={(e) => props.setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BILLING & KYC */}
        {activeSubTab() === 'PRIVACY' && (
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3.5 animate-in fade-in duration-150">
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 block">GST & Business KYC Details</span>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">GSTIN (15 Characters)</label>
              <input
                type="text"
                value={props.profileGst}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15);
                  props.setProfileGst(val);
                }}
                placeholder="e.g. 33AAFCL8686P1Z4"
                class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">PAN Card (10 Characters)</label>
                <input
                  type="text"
                  value={props.profilePan}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
                    props.setProfilePan(val);
                  }}
                  placeholder="e.g. AAFCL8686P"
                  class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Aadhaar (12 Digits)</label>
                <input
                  type="text"
                  value={props.profileAadhaar}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').substring(0, 12);
                    props.setProfileAadhaar(val);
                  }}
                  placeholder="e.g. 123456789012"
                  class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Billing Address</label>
              <textarea
                value={props.profileAddress}
                onChange={(e) => props.setProfileAddress(e.target.value)}
                placeholder="Full billing address for official tax invoices"
                rows={3}
                class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* TAB 4: APP SETTINGS & NOTIFICATIONS */}
        {activeSubTab() === 'APP' && (
          <div class="space-y-4 animate-in fade-in duration-150">
            {/* VOICE ASSISTANT LANGUAGE */}
            <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <label for="voice-lang-select" class="block text-xs font-bold text-slate-800 dark:text-slate-200">Voice Assistant Language</label>
              <p class="text-[10px] text-slate-400 leading-normal">
                Choose spoken language for hands-free voice commands.
              </p>
              <select
                id="voice-lang-select"
                value={props.profileVoiceLang}
                onChange={(e) => props.setProfileVoiceLang(e.target.value)}
                class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="en-IN">English (India) - en-IN</option>
                <option value="hi-IN">Hindi (हिन्दी) - hi-IN</option>
                <option value="ta-IN">Tamil (தமிழ்) - ta-IN</option>
                <option value="te-IN">Telugu (తెలుగు) - te-IN</option>
                <option value="kn-IN">Kannada (ಕನ್ನಡ) - kn-IN</option>
                <option value="mr-IN">Marathi (मराठी) - mr-IN</option>
              </select>
            </div>

            {/* TOAST NOTIFICATION POSITION */}
            <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <label class="block text-xs font-bold text-slate-800 dark:text-slate-200">Toast Pop-up Position</label>
              <p class="text-[10px] text-slate-400 leading-normal">
                Choose where notification alerts pop up on screen.
              </p>
              <select
                value={currentToastPos()}
                onChange={(e) => {
                  const pos = e.target.value as any;
                  if (notificationsCtx) {
                    notificationsCtx.setToastPosition(pos);
                    notificationsCtx.showNotification({ title: 'Position Updated', message: `Toast notifications will now pop up at ${pos.replace('-', ' ')}.`, type: 'info' });
                  } else {
                    localStorage.setItem('ttt_toast_position_global', pos);
                  }
                }}
                class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="top-right">Top Right (Default)</option>
                <option value="top-left">Top Left</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-center">Top Center</option>
                <option value="bottom-center">Bottom Center</option>
                <option value="middle-right">Middle Right</option>
                <option value="middle-left">Middle Left</option>
                <option value="middle-center">Center Screen (Middle)</option>
              </select>
            </div>
          </div>
        )}

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

        {/* BOTTOM ACTION BUTTONS */}
        <div class="mt-6 flex justify-end gap-2.5 select-none pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={props.onCancel}
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer border border-slate-200/40 dark:border-slate-700/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
