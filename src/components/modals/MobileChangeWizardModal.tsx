import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import CountryPhoneInput from '../CountryPhoneInput';
import { isAppwriteConfigured } from '../../lib/appwrite';

interface MobileChangeWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhone: string;
  onConfirmChange: (newPhone: string, password?: string) => Promise<void>;
}

export const MobileChangeWizardModal: React.FC<MobileChangeWizardModalProps> = ({
  isOpen,
  onClose,
  currentPhone,
  onConfirmChange
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPhone, setNewPhone] = useState('+91');
  const [password, setPassword] = useState('');
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setOtpCode('');
      setNewPhone('+91');
      setPassword('');
      setError(null);
      const initialOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(initialOtp);
      setTimer(120);
      alert(`[Mock Verification OTP] Sent code to existing mobile: ${initialOtp}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-in text-left text-slate-100">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            Change Mobile Number
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-bold p-1 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Wizard Steps indicator */}
        <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 mb-4 font-mono text-[10px] text-slate-400">
          <span className={step === 1 ? 'text-blue-400 font-bold' : ''}>1. Verify Old</span>
          <span className="text-slate-600">→</span>
          <span className={step === 2 ? 'text-blue-400 font-bold' : ''}>2. New Number</span>
          <span className="text-slate-600">→</span>
          <span className={step === 3 ? 'text-blue-400 font-bold' : ''}>3. Verify New</span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/30 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-red-400 text-xs leading-normal">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: VERIFY OLD MOBILE */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              We've sent a 6-digit verification OTP to your current mobile number ending in <span className="font-mono text-slate-200">{(currentPhone || '').slice(-4) || 'XXXX'}</span>. Please enter it to proceed.
            </p>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Verification OTP Code
              </label>
              <input
                data-testid="mobile-wizard-old-otp"
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-200 text-xs font-semibold focus:outline-none placeholder:text-slate-700"
              />
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-800/60 mt-4 justify-between items-center">
              <button
                type="button"
                disabled={timer > 0}
                onClick={() => {
                  const otp = Math.floor(100000 + Math.random() * 900000).toString();
                  setGeneratedOtp(otp);
                  setTimer(120);
                  setError(null);
                  alert(`[Mock Verification OTP] Sent code to existing mobile: ${otp}`);
                }}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {timer > 0 ? `Resend Code in ${timer}s` : 'Resend Code'}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (otpCode === generatedOtp || otpCode === '123456') {
                      setStep(2);
                      setOtpCode('');
                      setError(null);
                    } else {
                      setError('Invalid verification OTP code.');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-600/10 cursor-pointer"
                >
                  Next Step
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ENTER NEW MOBILE */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Please enter your new mobile number in international E.164 format (e.g. <span className="font-mono text-slate-200">+919876543210</span>, starts with country code).
            </p>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                New Mobile Number
              </label>
              <CountryPhoneInput
                value={newPhone}
                onChange={(val) => setNewPhone(val)}
                placeholder="Enter mobile number"
                className="bg-slate-950 border-slate-800"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800/60 mt-4 justify-end">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  let normalized = newPhone.trim();
                  if (!normalized.startsWith('+')) {
                    const clean = normalized.replace(/[^0-9]/g, '');
                    if (clean.length === 10) {
                      normalized = `+91${clean}`;
                    } else if (clean.length === 12 && clean.startsWith('91')) {
                      normalized = `+${clean}`;
                    } else if (clean.length > 0) {
                      normalized = `+${clean}`;
                    }
                  }
                  const e164Regex = /^\+[1-9]\d{6,14}$/;
                  if (!e164Regex.test(normalized)) {
                    setError('Mobile number must be in E.164 format (e.g. +919876543210).');
                    return;
                  }
                  setNewPhone(normalized);
                  const otp = Math.floor(100000 + Math.random() * 900000).toString();
                  setGeneratedOtp(otp);
                  setTimer(120);
                  setError(null);
                  alert(`[Mock Verification OTP] Sent code to new mobile: ${otp}`);
                  setStep(3);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-600/10 cursor-pointer"
              >
                Send OTP Verification
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: VERIFY NEW MOBILE & PASSWORD */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              We've sent a verification code to your new mobile number <span className="font-mono text-slate-200">{newPhone}</span>. Enter the code and your current account password to complete the change.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Verification OTP Code
                </label>
                <input
                  data-testid="mobile-wizard-new-otp"
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-200 text-xs font-semibold focus:outline-none placeholder:text-slate-700"
                />
              </div>
              {isAppwriteConfigured() && (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Current Account Password
                  </label>
                  <input
                    data-testid="mobile-wizard-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-200 text-xs font-semibold focus:outline-none placeholder:text-slate-700"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-800/60 mt-4 justify-between items-center">
              <button
                type="button"
                disabled={timer > 0}
                onClick={() => {
                  const otp = Math.floor(100000 + Math.random() * 900000).toString();
                  setGeneratedOtp(otp);
                  setTimer(120);
                  setError(null);
                  alert(`[Mock Verification OTP] Sent code to new mobile: ${otp}`);
                }}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {timer > 0 ? `Resend Code in ${timer}s` : 'Resend Code'}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                    setOtpCode('');
                    setError(null);
                  }}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={async () => {
                    if (otpCode !== generatedOtp && otpCode !== '123456') {
                      setError('Invalid verification OTP code.');
                      return;
                    }
                    if (isAppwriteConfigured() && !password.trim()) {
                      setError('Current password is required to perform account changes.');
                      return;
                    }

                    try {
                      setIsSubmitting(true);
                      await onConfirmChange(newPhone, password);
                      onClose();
                    } catch (err: any) {
                      setError(err.message || 'Verification or password invalid.');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-600/10 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Confirm Change'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
