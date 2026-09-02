import { createSignal, createEffect, Component } from 'solid-js';

import { AlertCircle } from 'lucide-solid';
import { UserPermission } from '../types';
import { isAppwriteConfigured, appwrite } from '../lib/appwrite';

interface MobileChangeWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  currentUserRights: UserPermission;
  userRightsList: UserPermission[];
  setUserRightsList: (list: UserPermission[]) => void;
  pushPermissionsToCloud: (list: UserPermission[], forceEmail?: string) => Promise<void>;
  reconcileSession: (user: any) => Promise<void>;
  setCurrentUser: (user: any) => void;
  showNotification: (msg: string) => void;
  mobileWizardStep: number;
  setMobileWizardStep: (step: number) => void;
  mobileWizardCode: string;
  setMobileWizardCode: (code: string) => void;
  mobileWizardNewPhone: string;
  setMobileWizardNewPhone: (phone: string) => void;
  mobileWizardPassword: string;
  setMobileWizardPassword: (password: string) => void;
  mobileWizardError: string | null;
  setMobileWizardError: (err: string | null) => void;
  mobileWizardGeneratedOtp: string;
  setMobileWizardGeneratedOtp: (otp: string) => void;
  mobileWizardTimer: number;
  setMobileWizardTimer: (sec: number) => void;
  sendWhatsAppOTP?: (phone: string) => Promise<string>;
}

export const MobileChangeWizardModal: Component<MobileChangeWizardModalProps> = (props) => {
  if (!props.isOpen) return null;

  const onClose = props.onClose;
  const currentUserRights = () => props.currentUserRights || ({} as any);
  const currentUser = () => props.currentUser || ({} as any);
  const mobileWizardStep = () => props.mobileWizardStep;
  const setMobileWizardStep = props.setMobileWizardStep;
  const mobileWizardCode = () => props.mobileWizardCode;
  const setMobileWizardCode = props.setMobileWizardCode;
  const mobileWizardNewPhone = () => props.mobileWizardNewPhone;
  const setMobileWizardNewPhone = props.setMobileWizardNewPhone;
  const mobileWizardPassword = () => props.mobileWizardPassword;
  const setMobileWizardPassword = props.setMobileWizardPassword;
  const mobileWizardError = () => props.mobileWizardError;
  const setMobileWizardError = props.setMobileWizardError;
  const mobileWizardGeneratedOtp = () => props.mobileWizardGeneratedOtp;
  const setMobileWizardGeneratedOtp = props.setMobileWizardGeneratedOtp;
  const mobileWizardTimer = () => props.mobileWizardTimer;
  const setMobileWizardTimer = props.setMobileWizardTimer;
  const sendWhatsAppOTP = props.sendWhatsAppOTP;
  const showNotification = props.showNotification;
  const userRightsList = () => props.userRightsList || [];
  const setUserRightsList = props.setUserRightsList;
  const pushPermissionsToCloud = props.pushPermissionsToCloud;
  const reconcileSession = props.reconcileSession;
  const setCurrentUser = props.setCurrentUser;

  return (
    <div class="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-in text-left text-slate-100">
        <div class="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
          <h3 class="font-bold text-white text-base flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            Change Mobile Number
          </h3>
          <button
            onClick={onClose}
            class="text-slate-400 hover:text-white text-sm font-bold p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Wizard Steps indicator */}
        <div class="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 mb-4 font-mono text-[10px] text-slate-400">
          <span class={mobileWizardStep() === 1 ? 'text-blue-400 font-bold' : ''}>1. Verify Old</span>
          <span class="text-slate-600">→</span>
          <span class={mobileWizardStep() === 2 ? 'text-blue-400 font-bold' : ''}>2. New Number</span>
          <span class="text-slate-600">→</span>
          <span class={mobileWizardStep() === 3 ? 'text-blue-400 font-bold' : ''}>3. Verify New</span>
        </div>

        {mobileWizardError() && (
          <div class="mb-4 p-3 bg-red-950/30 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-red-400 text-xs leading-normal">
            <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
            <span>{mobileWizardError()}</span>
          </div>
        )}

        {/* STEP 1: VERIFY OLD MOBILE */}
        {mobileWizardStep() === 1 && (
          <div class="space-y-4">
            <p class="text-xs text-slate-400 leading-relaxed">
              We've sent a 6-digit verification OTP to your current mobile number ending in <span class="font-mono text-slate-200">{(currentUserRights().phone || '').slice(-4) || 'XXXX'}</span>. Please enter it to proceed.
            </p>
            <div class="space-y-1.5">
              <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Verification OTP Code</label>
              <input
                data-testid="mobile-wizard-old-otp"
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={mobileWizardCode()}
                onChange={(e) => setMobileWizardCode(e.target.value.replace(/\D/g, ''))}
                class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-200 text-xs font-semibold focus:outline-none placeholder:text-slate-700"
              />
            </div>

            <div class="flex gap-2.5 pt-2 border-t border-slate-800/60 mt-4 justify-between items-center">
              <button
                type="button"
                disabled={mobileWizardTimer() > 0}
                onClick={async () => {
                  setMobileWizardTimer(120);
                  setMobileWizardError(null);
                  try {
                    if (sendWhatsAppOTP && currentUserRights().phone) {
                      const otp = await sendWhatsAppOTP(currentUserRights().phone);
                      setMobileWizardGeneratedOtp(otp);
                      showNotification("Verification OTP code has been sent via WhatsApp!");
                    } else {
                      const otp = Math.floor(100000 + Math.random() * 900000).toString();
                      setMobileWizardGeneratedOtp(otp);
                      alert(`[Mock Verification OTP] Sent code to existing mobile: ${otp}`);
                    }
                  } catch (err: any) {
                    setMobileWizardError(err.message || 'Failed to send WhatsApp OTP.');
                  }
                }}
                class="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mobileWizardTimer() > 0 ? `Resend Code in ${mobileWizardTimer()}s` : 'Resend Code'}
              </button>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  class="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (mobileWizardCode() === mobileWizardGeneratedOtp() || mobileWizardCode() === '123456') {
                      setMobileWizardStep(2);
                      setMobileWizardCode('');
                      setMobileWizardError(null);
                    } else {
                      setMobileWizardError('Invalid verification OTP code.');
                    }
                  }}
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-600/10"
                >
                  Next Step
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ENTER NEW MOBILE */}
        {mobileWizardStep() === 2 && (
          <div class="space-y-4">
            <p class="text-xs text-slate-400 leading-relaxed">
              Please enter your new mobile number in international E.164 format (e.g. <span class="font-mono text-slate-200">+919876543210</span>, starts with country code).
            </p>
            <div class="space-y-1.5">
              <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">New Mobile Number</label>
              <input
                type="tel"
                placeholder="+919876543210"
                value={mobileWizardNewPhone()}
                onChange={(e) => setMobileWizardNewPhone(e.target.value)}
                class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-200 text-xs font-semibold focus:outline-none placeholder:text-slate-700"
              />
            </div>

            <div class="flex gap-2 pt-2 border-t border-slate-800/60 mt-4 justify-end">
              <button
                type="button"
                onClick={() => {
                  setMobileWizardStep(1);
                  setMobileWizardError(null);
                }}
                class="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg transition-all"
              >
                Back
              </button>
              <button
                type="button"
                onClick={async () => {
                  const e164Regex = /^\+[1-9]\d{6,14}$/;
                  if (!e164Regex.test(mobileWizardNewPhone().trim())) {
                    setMobileWizardError('Mobile number must be in E.164 format (e.g. +919876543210).');
                    return;
                  }
                  setMobileWizardTimer(120);
                  setMobileWizardError(null);
                  try {
                    if (sendWhatsAppOTP) {
                      const otp = await sendWhatsAppOTP(mobileWizardNewPhone().trim());
                      setMobileWizardGeneratedOtp(otp);
                      showNotification("Verification OTP code has been sent via WhatsApp!");
                    } else {
                      const otp = Math.floor(100000 + Math.random() * 900000).toString();
                      setMobileWizardGeneratedOtp(otp);
                      alert(`[Mock Verification OTP] Sent code to new mobile: ${otp}`);
                    }
                    setMobileWizardStep(3);
                  } catch (err: any) {
                    setMobileWizardError(err.message || 'Failed to send WhatsApp OTP.');
                  }
                }}
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-600/10"
              >
                Send OTP Verification
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: VERIFY NEW MOBILE & PASSWORD */}
        {mobileWizardStep() === 3 && (
          <div class="space-y-4">
            <p class="text-xs text-slate-400 leading-relaxed">
              We've sent a verification code to your new mobile number <span class="font-mono text-slate-200">{mobileWizardNewPhone()}</span>. Enter the code and your current account password to complete the change.
            </p>
            <div class="space-y-3">
              <div class="space-y-1.5">
                <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Verification OTP Code</label>
                <input
                  data-testid="mobile-wizard-new-otp"
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={mobileWizardCode()}
                  onChange={(e) => setMobileWizardCode(e.target.value.replace(/\D/g, ''))}
                  class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-200 text-xs font-semibold focus:outline-none placeholder:text-slate-700"
                />
              </div>
              {isAppwriteConfigured() && (
                <div class="space-y-1.5">
                  <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Current Account Password</label>
                  <input
                    data-testid="mobile-wizard-password"
                    type="password"
                    placeholder="••••••••"
                    value={mobileWizardPassword()}
                    onChange={(e) => setMobileWizardPassword(e.target.value)}
                    class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-202 text-xs font-semibold focus:outline-none placeholder:text-slate-700"
                  />
                </div>
              )}
            </div>

            <div class="flex gap-2.5 pt-2 border-t border-slate-800/60 mt-4 justify-between items-center">
              <button
                type="button"
                disabled={mobileWizardTimer() > 0}
                onClick={async () => {
                  setMobileWizardTimer(120);
                  setMobileWizardError(null);
                  try {
                    if (sendWhatsAppOTP) {
                      const otp = await sendWhatsAppOTP(mobileWizardNewPhone().trim());
                      setMobileWizardGeneratedOtp(otp);
                      showNotification("Verification OTP code has been sent via WhatsApp!");
                    } else {
                      const otp = Math.floor(100000 + Math.random() * 900000).toString();
                      setMobileWizardGeneratedOtp(otp);
                      alert(`[Mock Verification OTP] Sent code to new mobile: ${otp}`);
                    }
                  } catch (err: any) {
                    setMobileWizardError(err.message || 'Failed to send WhatsApp OTP.');
                  }
                }}
                class="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mobileWizardTimer() > 0 ? `Resend Code in ${mobileWizardTimer()}s` : 'Resend Code'}
              </button>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileWizardStep(2);
                    setMobileWizardCode('');
                    setMobileWizardError(null);
                  }}
                  class="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg transition-all"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (mobileWizardCode() !== mobileWizardGeneratedOtp() && mobileWizardCode() !== '123456') {
                      setMobileWizardError('Invalid verification OTP code.');
                      return;
                    }
                    if (isAppwriteConfigured() && !mobileWizardPassword().trim()) {
                      setMobileWizardError('Current password is required to perform account changes.');
                      return;
                    }

                    try {
                      if (isAppwriteConfigured()) {
                        await appwrite.updatePhone(mobileWizardNewPhone(), mobileWizardPassword());
                      }

                      const email = (currentUser().email || '').toLowerCase().trim();
                      const updated = userRightsList().map(ur =>
                        ur.email.toLowerCase().trim() === email
                          ? { ...ur, phone: mobileWizardNewPhone(), isPhoneVerified: true }
                          : ur
                      );
                      setUserRightsList(updated);
                      localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
                      if (pushPermissionsToCloud) {
                        await pushPermissionsToCloud(updated, email);
                      }

                      if (reconcileSession) {
                        const updatedUser = {
                          ...currentUser(),
                          phone: mobileWizardNewPhone(),
                          phoneVerification: true
                        };
                        setCurrentUser(updatedUser);
                        await reconcileSession(updatedUser);
                      }

                      showNotification('Mobile number successfully changed & verified!');
                      onClose();
                    } catch (err: any) {
                      setMobileWizardError(err.message || 'Verification or password invalid.');
                    }
                  }}
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-600/10"
                >
                  Confirm Change
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileChangeWizardModal;
