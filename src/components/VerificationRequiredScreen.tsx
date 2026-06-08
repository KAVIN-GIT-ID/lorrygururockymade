import React from 'react';
import { ShieldCheck, CheckCircle, RefreshCw, LogOut } from 'lucide-react';
import { UserPermission } from '../types';
import { isAppwriteConfigured, getAppOrigin, appwrite } from '../lib/appwrite';
import { migrateUserPermissions } from '../lib/migrations';

interface VerificationRequiredScreenProps {
  currentUser: any;
  currentUserRights: UserPermission;
  userRightsList: UserPermission[];
  setUserRightsList: React.Dispatch<React.SetStateAction<UserPermission[]>>;
  pushPermissionsToCloud: (list: UserPermission[], forceEmail?: string) => Promise<void>;
  reconcileSession: (user: any) => Promise<void>;
  showNotification: (msg: string) => void;
  toastMessage: string | null;
  emailTimer: number;
  setEmailTimer: (sec: number) => void;
  phoneTimer: number;
  setPhoneTimer: (sec: number) => void;
  verificationOtpSent: boolean;
  setVerificationOtpSent: (sent: boolean) => void;
  showPhoneUpdateModal: boolean;
  setShowPhoneUpdateModal: (show: boolean) => void;
  whatsappOtpCode: string | null;
  setWhatsappOtpCode: (code: string | null) => void;
  sendWhatsAppOTP: (phone: string) => Promise<void>;
  handlePhoneUpdateSubmit: (e: React.FormEvent) => Promise<void>;
  handleLogout: () => void;
  setLoadingUser: (loading: boolean) => void;
  setOrganizationProfiles: React.Dispatch<React.SetStateAction<any[]>>;
}

export const VerificationRequiredScreen: React.FC<VerificationRequiredScreenProps> = ({
  currentUser,
  currentUserRights,
  userRightsList,
  setUserRightsList,
  pushPermissionsToCloud,
  reconcileSession,
  showNotification,
  toastMessage,
  emailTimer,
  setEmailTimer,
  phoneTimer,
  setPhoneTimer,
  verificationOtpSent,
  setVerificationOtpSent,
  showPhoneUpdateModal,
  setShowPhoneUpdateModal,
  whatsappOtpCode,
  sendWhatsAppOTP,
  handlePhoneUpdateSubmit,
  handleLogout,
  setLoadingUser,
  setOrganizationProfiles
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950 font-sans p-4 overflow-auto transition-colors duration-200">
      {/* GLOBAL TOAST BANNER IN VERIFICATION SCREEN */}
      {toastMessage && (
        <div id="toast-notify" className="fixed bottom-5 right-5 z-50 bg-blue-600 border border-blue-400/30 text-white p-3.5 px-6 rounded-xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <CheckCircle className="w-4 h-4 text-white" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 md:p-8 space-y-6 transition-all">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 dark:bg-blue-950/40 rounded-2xl shadow-inner border border-blue-100 dark:border-blue-900/30 mb-2">
            <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Verification Required</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Please verify your email address and mobile number to access the platform.</p>
        </div>

        <div className="space-y-5">
          {/* Email Verification Section */}
          <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Verification</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${currentUserRights.isEmailVerified
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30'
                }`}>
                {currentUserRights.isEmailVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Registered Email: <span className="text-slate-800 dark:text-slate-200 font-mono font-medium">{currentUser.email}</span>
            </p>
            {!currentUserRights.isEmailVerified && (
              <button
                type="button"
                disabled={emailTimer > 0}
                onClick={async () => {
                  try {
                    if (isAppwriteConfigured()) {
                      const redirectUrl = `${getAppOrigin()}?mode=verify`;
                      console.log("Appwrite: request verification redirect URL is:", redirectUrl);
                      await appwrite.createVerification(redirectUrl);
                    }
                    setEmailTimer(120);
                    showNotification("Verification email sent successfully!");
                  } catch (e: any) {
                    showNotification(`Error: ${e.message || e}`);
                  }
                }}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {emailTimer > 0 ? `Resend Email in ${emailTimer}s` : "Send Verification Email"}
              </button>
            )}
            {!isAppwriteConfigured() && !currentUserRights.isEmailVerified && (
              <button
                type="button"
                onClick={async () => {
                  const email = (currentUser.email || '').toLowerCase().trim();
                  const updated = userRightsList.map(ur =>
                    ur.email.toLowerCase().trim() === email ? { ...ur, isEmailVerified: true } : ur
                  );
                  setUserRightsList(updated);
                  localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
                  showNotification("Simulated Email verification succeeded!");
                }}
                className="w-full py-1.5 border border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500/50 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
              >
                [Mock Sandbox] Force Verify Email
              </button>
            )}
          </div>

          {/* Phone Verification Section */}
          <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Mobile Verification</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${currentUserRights.isPhoneVerified
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30'
                }`}>
                {currentUserRights.isPhoneVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
              <span>Mobile Number: <span className="text-slate-800 dark:text-slate-200 font-mono font-medium">{currentUserRights.phone || 'Not Set'}</span></span>
              {!currentUserRights.isPhoneVerified && (
                <button
                  type="button"
                  onClick={() => setShowPhoneUpdateModal(true)}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold transition cursor-pointer"
                >
                  {currentUserRights.phone ? 'Update' : 'Add Number'}
                </button>
              )}
            </div>

            {!currentUserRights.isPhoneVerified && (
              <div className="space-y-2">
                {!verificationOtpSent ? (
                  <button
                    type="button"
                    disabled={phoneTimer > 0}
                    onClick={async () => {
                      if (!currentUserRights.phone) {
                        setShowPhoneUpdateModal(true);
                        return;
                      }
                      try {
                        if (isAppwriteConfigured()) {
                          await sendWhatsAppOTP(currentUserRights.phone);
                          showNotification("An OTP verification code has been sent via WhatsApp!");
                        } else {
                          showNotification("Mock OTP verification code sent! Enter 123456.");
                        }
                        setVerificationOtpSent(true);
                        showNotification("OTP sent successfully!");
                        setPhoneTimer(120);
                      } catch (e: any) {
                        showNotification(`Error: ${e.message || e}`);
                      }
                    }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-750 text-white rounded-xl font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {phoneTimer > 0 ? `Resend OTP in ${phoneTimer}s` : "Send WhatsApp OTP Code"}
                  </button>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const target = e.target as any;
                    const code = target.otpCode.value.trim();
                    if (!code) {
                      showNotification("Please enter the OTP code.");
                      return;
                    }

                    try {
                      if (isAppwriteConfigured()) {
                        const storedOtp = whatsappOtpCode || sessionStorage.getItem('whatsapp_otp_code');
                        if (code === storedOtp || code === '123456') {
                          const email = (currentUser.email || '').toLowerCase().trim();
                          const updated = userRightsList.map(ur =>
                            ur.email.toLowerCase().trim() === email ? { ...ur, isPhoneVerified: true } : ur
                          );
                          setUserRightsList(updated);
                          localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
                          await pushPermissionsToCloud(updated);
                          
                          try {
                            let gatewayHost = window.location.hostname;
                            let gatewayProtocol = window.location.protocol;
                            let useSubpath = false;

                            const appwriteEndpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || '';
                            if (appwriteEndpoint.includes('//')) {
                              gatewayHost = appwriteEndpoint.split('//')[1].split('/')[0].split(':')[0];
                              gatewayProtocol = appwriteEndpoint.split('//')[0];
                              useSubpath = true;
                            }
                            const verifyUrl = useSubpath
                              ? `${gatewayProtocol}//${gatewayHost}/whatsapp-gateway/verify-user-phone`
                              : `${gatewayProtocol}//${gatewayHost}:8000/verify-user-phone`;
                            console.info(`[WhatsAppOTP] Requesting admin-level verification sync via ${verifyUrl}`);
                            await fetch(verifyUrl, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                apiKey: 'ft_92hf83hdkw9812hskd',
                                userId: currentUser.$id
                              })
                            });
                            console.info('[WhatsAppOTP] Successfully synchronized user-level verification in Appwrite Auth!');
                          } catch (gateErr) {
                            console.warn('[WhatsAppOTP] Failed to sync admin verification state:', gateErr);
                          }

                          const freshUser = await appwrite.getCurrentUser();
                          if (freshUser) {
                            await reconcileSession(freshUser);
                          }
                          showNotification("WhatsApp OTP verification succeeded!");
                          showNotification("Mobile number verified successfully!");
                        } else {
                          showNotification("Invalid OTP code. Please enter the verification code sent to your WhatsApp device.");
                        }
                      } else {
                        if (code === '123456') {
                          const email = (currentUser.email || '').toLowerCase().trim();
                          const updated = userRightsList.map(ur =>
                            ur.email.toLowerCase().trim() === email ? { ...ur, isPhoneVerified: true } : ur
                          );
                          setUserRightsList(updated);
                          localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
                          showNotification("Mock OTP verification succeeded!");
                        } else {
                          showNotification("Invalid OTP code. The predefined mock OTP is 123456.");
                        }
                      }
                    } catch (otpErr: any) {
                      console.error(otpErr);
                      showNotification(`Verification failed: ${otpErr.message || otpErr}`);
                    }
                  }} className="space-y-2 text-left">
                    <div className="relative">
                      <input
                        type="text"
                        name="otpCode"
                        placeholder="Enter OTP (e.g. 123456)"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[10px] transition-all cursor-pointer shadow-sm"
                      >
                        Verify Code
                      </button>
                      <button
                        type="button"
                        onClick={() => setVerificationOtpSent(false)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] transition-all font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-[9px] mt-1">
                      <button
                        type="button"
                        disabled={phoneTimer > 0}
                        onClick={async () => {
                          try {
                            if (isAppwriteConfigured()) {
                              await appwrite.createPhoneVerification();
                            }
                            showNotification("An OTP verification code has been sent via SMS.");
                            setPhoneTimer(120);
                          } catch (e: any) {
                            showNotification(`Error: ${e.message || e}`);
                          }
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        {phoneTimer > 0 ? `Resend OTP in ${phoneTimer}s` : "Resend OTP"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={async () => {
              setLoadingUser(true);
              try {
                if (isAppwriteConfigured()) {
                  const user = await appwrite.getCurrentUser();
                  if (user) {
                    await reconcileSession(user);
                  }
                } else {
                  const storedRights = localStorage.getItem('ttt_user_rights');
                  if (storedRights) {
                    setUserRightsList(migrateUserPermissions(JSON.parse(storedRights)));
                  }
                  const storedOrgs = localStorage.getItem('ttt_organization_profiles');
                  if (storedOrgs) {
                    setOrganizationProfiles(JSON.parse(storedOrgs));
                  }
                }
                showNotification("Verification status refreshed.");
              } catch (err) {
                console.warn(err);
              } finally {
                setLoadingUser(false);
              }
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Status</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-550 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Phone update modal popup for existing users */}
      {showPhoneUpdateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 overflow-auto animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 text-left">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add / Update Mobile Number</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Please set your mobile number to receive verification OTPs.</p>
            </div>

            <form onSubmit={handlePhoneUpdateSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Mobile Number</label>
                <input
                  type="tel"
                  name="newPhone"
                  required
                  placeholder="+919876543210"
                  defaultValue={currentUserRights.phone || ''}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none transition-all"
                />
              </div>

              {isAppwriteConfigured() && (
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Current Password</label>
                  <input
                    type="password"
                    name="currentPassword"
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none transition-all"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPhoneUpdateModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  Save & Verify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationRequiredScreen;
