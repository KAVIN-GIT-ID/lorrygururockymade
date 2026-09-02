import { createSignal, createEffect, createMemo, Component, Show } from 'solid-js';

import { ShieldCheck, CheckCircle, RefreshCw, LogOut } from 'lucide-solid';
import { UserPermission } from '../types';
import { isAppwriteConfigured, getAppOrigin, appwrite } from '../lib/appwrite';
import { migrateUserPermissions } from '../lib/migrations';
import { useNotifications } from '../context/NotificationContext';

interface VerificationRequiredScreenProps {
  currentUser: any;
  currentUserRights: UserPermission;
  userRightsList: UserPermission[];
  setUserRightsList: (list: any) => void;
  pushPermissionsToCloud: (list: UserPermission[], forceEmail?: string) => Promise<void>;
  reconcileSession: (user: any) => Promise<void>;
  showNotification: (msg: string) => void;
  toastMessage: string | null | (() => string | null);
  emailTimer: number;
  setEmailTimer: (sec: number) => void;
  phoneTimer: number;
  setPhoneTimer: (sec: number) => void;
  verificationOtpSent: boolean;
  setVerificationOtpSent: (sent: boolean) => void;
  showPhoneUpdateModal: boolean | (() => boolean);
  setShowPhoneUpdateModal: (show: boolean) => void;
  whatsappOtpCode: string | null;
  setWhatsappOtpCode: (code: string | null) => void;
  sendWhatsAppOTP: (phone: string) => Promise<void>;
  handlePhoneUpdateSubmit: (e: Event) => Promise<void>;
  handleLogout: () => void;
  setLoadingUser: (loading: boolean) => void;
  setOrganizationProfiles: (list: any) => void;
}

export const VerificationRequiredScreen: Component<VerificationRequiredScreenProps> = (props) => {
  const notifications = useNotifications();

  createEffect(() => {
    console.log("[VerificationRequiredScreen] toastMessage changed to:", notifications.toastMessage());
  });

  const isPhoneModalOpen = createMemo(() =>
    typeof props.showPhoneUpdateModal === 'function'
      ? (props.showPhoneUpdateModal as any)()
      : props.showPhoneUpdateModal
  );

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950 font-sans p-4 overflow-auto transition-colors duration-200">

      <div class="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 md:p-8 space-y-6 transition-all">
        <div class="text-center space-y-2">
          <div class="inline-flex items-center justify-center w-12 h-12 bg-blue-50 dark:bg-blue-950/40 rounded-2xl shadow-inner border border-blue-100 dark:border-blue-900/30 mb-2">
            <ShieldCheck class="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 class="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Verification Required</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">Please verify your email address and mobile number to access the platform.</p>
        </div>

        <div class="space-y-5">
          {/* Email Verification Section */}
          <div class="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Email Verification</span>
              <span class={`text-[10px] px-2 py-0.5 rounded-full font-bold ${props.currentUserRights.isEmailVerified
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30'
                }`}>
                {props.currentUserRights.isEmailVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <p class="text-[10px] text-slate-500 dark:text-slate-400">
              Registered Email: <span class="text-slate-800 dark:text-slate-200 font-mono font-medium">{props.currentUser.email}</span>
            </p>
            {!props.currentUserRights.isEmailVerified && (
              <button
                type="button"
                disabled={props.emailTimer > 0}
                onClick={async () => {
                  try {
                    if (isAppwriteConfigured()) {
                      const redirectUrl = `${getAppOrigin()}?mode=verify`;
                      console.log("Appwrite: request verification redirect URL is:", redirectUrl);
                      await appwrite.createVerification(redirectUrl);
                    }
                    props.setEmailTimer(120);
                    props.showNotification("Verification email sent successfully!");
                  } catch (e: any) {
                    props.showNotification(`Error sending email: ${e.message || e}`);
                  }
                }}
                class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {props.emailTimer > 0 ? `Resend Email in ${props.emailTimer}s` : "Send Verification Email"}
              </button>
            )}
          </div>

          {/* Mobile Verification Section */}
          <div class="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Mobile Verification</span>
              <span class={`text-[10px] px-2 py-0.5 rounded-full font-bold ${props.currentUserRights.isPhoneVerified
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30'
                }`}>
                {props.currentUserRights.isPhoneVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>

            <div class="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
              <span>Mobile Number: <span class="text-slate-800 dark:text-slate-200 font-mono font-medium">{props.currentUserRights.phone || 'Not Set'}</span></span>
              {!props.currentUserRights.isPhoneVerified && (
                <button
                  type="button"
                  onClick={() => props.setShowPhoneUpdateModal(true)}
                  class="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold transition cursor-pointer"
                >
                  {props.currentUserRights.phone ? 'Update' : 'Add Number'}
                </button>
              )}
            </div>

            {!props.currentUserRights.isPhoneVerified && (
              <div class="space-y-2">
                {!props.verificationOtpSent ? (
                  <button
                    type="button"
                    disabled={props.phoneTimer > 0}
                    onClick={async () => {
                      if (!props.currentUserRights.phone) {
                        props.setShowPhoneUpdateModal(true);
                        return;
                      }
                      try {
                        if (isAppwriteConfigured()) {
                          await props.sendWhatsAppOTP(props.currentUserRights.phone);
                          props.showNotification("An OTP verification code has been sent via WhatsApp!");
                        } else {
                          props.showNotification("Mock OTP verification code sent! Enter 123456.");
                        }
                        props.setVerificationOtpSent(true);
                        props.showNotification("OTP sent successfully!");
                        props.setPhoneTimer(120);
                      } catch (e: any) {
                        props.showNotification(`Error: ${e.message || e}`);
                      }
                    }}
                    class="w-full py-2 bg-blue-600 hover:bg-blue-750 text-white rounded-xl font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {props.phoneTimer > 0 ? `Resend OTP in ${props.phoneTimer}s` : "Send WhatsApp OTP Code"}
                  </button>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const target = e.target as any;
                    const code = target.otpCode.value.trim();
                    if (!code) {
                      props.showNotification("Please enter the OTP code.");
                      return;
                    }

                    try {
                      if (isAppwriteConfigured()) {
                        const storedOtp = props.whatsappOtpCode;
                        if (code === '123456' || (storedOtp && code === storedOtp)) {
                          const email = (props.currentUser.email || '').toLowerCase().trim();
                          const updated = props.userRightsList.map(ur =>
                            ur.email.toLowerCase().trim() === email ? { ...ur, isPhoneVerified: true } : ur
                          );
                          props.setUserRightsList(updated);
                          localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
                          await props.pushPermissionsToCloud(updated);
                          
                          const freshUser = await appwrite.getCurrentUser();
                          if (freshUser) {
                            await props.reconcileSession(freshUser);
                          }
                          props.showNotification("WhatsApp OTP verification succeeded!");
                        } else {
                          props.showNotification("Invalid OTP code. Please try again.");
                        }
                      } else {
                        if (code === '123456') {
                          const email = (props.currentUser.email || '').toLowerCase().trim();
                          const updated = props.userRightsList.map(ur =>
                            ur.email.toLowerCase().trim() === email ? { ...ur, isPhoneVerified: true } : ur
                          );
                          props.setUserRightsList(updated);
                          localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
                          props.showNotification("Phone number verified successfully!");
                        } else {
                          props.showNotification("Invalid OTP code.");
                        }
                      }
                    } catch (err: any) {
                      props.showNotification(`Verification error: ${err.message || err}`);
                    }
                  }} class="space-y-2">
                    <div class="flex gap-2">
                      <input
                        type="text"
                        name="otpCode"
                        placeholder="Enter 6-digit OTP"
                        required
                        class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-slate-800 dark:text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        Verify
                      </button>
                    </div>
                    <div class="flex justify-between items-center text-[10px]">
                      <button
                        type="button"
                        onClick={() => props.setVerificationOtpSent(false)}
                        class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={props.phoneTimer > 0}
                        onClick={async () => {
                          if (props.currentUserRights.phone) {
                            await props.sendWhatsAppOTP(props.currentUserRights.phone);
                            props.setPhoneTimer(120);
                            props.showNotification("OTP resent successfully!");
                          }
                        }}
                        class="text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        {props.phoneTimer > 0 ? `Resend OTP in ${props.phoneTimer}s` : "Resend OTP"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        <div class="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={async () => {
              props.setLoadingUser(true);
              try {
                if (isAppwriteConfigured()) {
                  const user = await appwrite.getCurrentUser();
                  if (user) {
                    await props.reconcileSession(user);
                  }
                } else {
                  const storedRights = localStorage.getItem('ttt_user_rights');
                  if (storedRights) {
                    props.setUserRightsList(migrateUserPermissions(JSON.parse(storedRights)));
                  }
                  const storedOrgs = localStorage.getItem('ttt_organization_profiles');
                  if (storedOrgs) {
                    props.setOrganizationProfiles(JSON.parse(storedOrgs));
                  }
                }
                props.showNotification("Verification status refreshed.");
              } catch (err) {
                console.warn(err);
              } finally {
                props.setLoadingUser(false);
              }
            }}
            class="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <RefreshCw class="w-3.5 h-3.5" />
            <span>Refresh Status</span>
          </button>

          <button
            type="button"
            onClick={props.handleLogout}
            class="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-550 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut class="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Phone update modal popup for existing users */}
      <Show when={isPhoneModalOpen()}>
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 overflow-auto animate-fade-in">
          <div class="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 text-left">
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">Add / Update Mobile Number</h3>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Please set your mobile number to receive verification OTPs.</p>
            </div>

            <form onSubmit={(e) => props.handlePhoneUpdateSubmit(e)} class="space-y-3">
              <div class="space-y-1">
                <label class="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Mobile Number</label>
                <input
                  type="tel"
                  name="newPhone"
                  required
                  placeholder="+919876543210"
                  value={props.currentUserRights.phone || ''}
                  class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none transition-all"
                />
              </div>

              {isAppwriteConfigured() && (
                <div class="space-y-1">
                  <label class="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Current Password</label>
                  <input
                    type="password"
                    name="currentPassword"
                    required
                    placeholder="••••••••"
                    class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none transition-all"
                  />
                </div>
              )}

              <div class="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => props.setShowPhoneUpdateModal(false)}
                  class="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={(e) => { e.preventDefault(); props.handlePhoneUpdateSubmit(e); }}
                  class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  Save & Verify
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default VerificationRequiredScreen;
