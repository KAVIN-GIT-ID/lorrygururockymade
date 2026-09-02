import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, LogOut, AlertCircle } from 'lucide-react';
import { UserPermission } from '../../types';
import { isAppwriteConfigured } from '../../lib/appwrite';
import CountryPhoneInput from '../CountryPhoneInput';

interface VerificationGateProps {
  currentUser: any;
  currentUserRights: UserPermission;
  onSendEmailVerification: () => Promise<void>;
  onForceVerifyEmail: () => void;
  onSendPhoneVerification: () => Promise<void>;
  onVerifyPhoneCode: (code: string) => Promise<void>;
  onUpdatePhoneSubmit: (phone: string, password?: string) => Promise<void>;
  onRefreshStatus: () => Promise<void>;
  onLogout: () => void;
  initialPhoneTimer?: number;
  initialEmailTimer?: number;
}

export const VerificationGate: React.FC<VerificationGateProps> = ({
  currentUser,
  currentUserRights,
  onSendEmailVerification,
  onForceVerifyEmail,
  onSendPhoneVerification,
  onVerifyPhoneCode,
  onUpdatePhoneSubmit,
  onRefreshStatus,
  onLogout,
  initialPhoneTimer = 0,
  initialEmailTimer = 0
}) => {
  const [emailTimer, setEmailTimer] = useState(initialEmailTimer);
  const [phoneTimer, setPhoneTimer] = useState(initialPhoneTimer);
  const [verificationOtpSent, setVerificationOtpSent] = useState(false);
  const [showPhoneUpdateModal, setShowPhoneUpdateModal] = useState(false);
  const [phoneModalNumber, setPhoneModalNumber] = useState('');
  const [phoneModalPassword, setPhoneModalPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let interval: any;
    if (emailTimer > 0) {
      interval = setInterval(() => setEmailTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [emailTimer]);

  useEffect(() => {
    let interval: any;
    if (phoneTimer > 0) {
      interval = setInterval(() => setPhoneTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [phoneTimer]);

  const handleSendEmail = async () => {
    await onSendEmailVerification();
    setEmailTimer(120);
  };

  const handleSendPhoneOtp = async () => {
    if (!currentUserRights.phone) {
      setShowPhoneUpdateModal(true);
      return;
    }
    await onSendPhoneVerification();
    setVerificationOtpSent(true);
    setPhoneTimer(120);
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim()) return;
    await onVerifyPhoneCode(otpInput.trim());
  };

  const handlePhoneFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    let normalized = phoneModalNumber.trim();
    if (!normalized.startsWith('+')) {
      const clean = normalized.replace(/[^0-9]/g, '');
      if (clean.length === 10) normalized = `+91${clean}`;
      else if (clean.length === 12 && clean.startsWith('91')) normalized = `+${clean}`;
      else if (clean.length > 0) normalized = `+${clean}`;
    }
    const e164Regex = /^\+[1-9]\d{6,14}$/;
    if (!e164Regex.test(normalized)) {
      setPhoneError('Invalid phone number format. Must include valid country code and digits.');
      return;
    }
    try {
      await onUpdatePhoneSubmit(normalized, phoneModalPassword);
      setShowPhoneUpdateModal(false);
      setVerificationOtpSent(true);
      setPhoneTimer(120);
    } catch (err: any) {
      setPhoneError(err.message || 'Failed to update phone number');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshStatus();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans relative">
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
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                currentUserRights.isEmailVerified
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
                onClick={handleSendEmail}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {emailTimer > 0 ? `Resend Email in ${emailTimer}s` : 'Send Verification Email'}
              </button>
            )}
            {!isAppwriteConfigured() && !currentUserRights.isEmailVerified && (
              <button
                type="button"
                onClick={onForceVerifyEmail}
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
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                currentUserRights.isPhoneVerified
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
                    onClick={handleSendPhoneOtp}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {phoneTimer > 0 ? `Resend OTP in ${phoneTimer}s` : 'Send WhatsApp OTP Code'}
                  </button>
                ) : (
                  <form onSubmit={handleVerifyOtpSubmit} className="space-y-2 text-left">
                    <div className="relative">
                      <input
                        type="text"
                        name="otpCode"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
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
                        onClick={handleSendPhoneOtp}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        {phoneTimer > 0 ? `Resend OTP in ${phoneTimer}s` : 'Resend OTP'}
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
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Status'}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Phone update modal popup */}
      {showPhoneUpdateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 overflow-auto animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 text-left">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add / Update Mobile Number</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Please set your mobile number to receive verification OTPs.</p>
            </div>

            {phoneError && (
              <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-red-400 text-xs leading-normal">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{phoneError}</span>
              </div>
            )}

            <form onSubmit={handlePhoneFormSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Mobile Number</label>
                <CountryPhoneInput
                  value={phoneModalNumber || currentUserRights.phone || '+91'}
                  onChange={(val) => setPhoneModalNumber(val)}
                  placeholder="Enter mobile number"
                  required
                />
              </div>

              {isAppwriteConfigured() && (
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Current Password</label>
                  <input
                    type="password"
                    value={phoneModalPassword}
                    onChange={(e) => setPhoneModalPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPhoneUpdateModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
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
