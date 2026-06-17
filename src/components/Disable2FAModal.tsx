import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { verifyTOTP } from '../utils/totp';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';

interface Disable2FAModalProps {
  isOpen: boolean;
  onClose: () => void;
  showNotification: (msg: string) => void;
  reconcileSession: (user: any) => Promise<any>;
}

export default function Disable2FAModal({
  isOpen,
  onClose,
  showNotification,
  reconcileSession
}: Disable2FAModalProps) {
  const { currentUser } = useAuth();
  const { userRightsList, setUserRightsList, currentUserRights, pushPermissions: pushPermissionsToCloud } = usePermissions();

  const [disable2FACode, setDisable2FACode] = useState('');
  const [disable2FAPassword, setDisable2FAPassword] = useState('');
  const [disable2FAError, setDisable2FAError] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-in text-left text-slate-100">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Disable 2FA Protection
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-bold p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {disable2FAError && (
          <div className="mb-4 p-3 bg-red-950/30 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-red-400 text-xs leading-normal">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{disable2FAError}</span>
          </div>
        )}

        <div className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Confirm you want to disable two-factor authentication. Enter your current 6-digit authenticator code and password.
          </p>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Verification Code</label>
              <input
                data-testid="disable-2fa-code"
                type="text"
                maxLength={6}
                placeholder="e.g. 000000"
                value={disable2FACode}
                onChange={(e) => setDisable2FACode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-202 text-xs font-semibold focus:outline-none placeholder:text-slate-700 font-mono text-center tracking-widest"
              />
            </div>

            {isAppwriteConfigured() && currentUser?.email && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Current Account Password</label>
                <input
                  data-testid="disable-2fa-password"
                  type="password"
                  placeholder="••••••••"
                  value={disable2FAPassword}
                  onChange={(e) => setDisable2FAPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-202 text-xs font-semibold focus:outline-none placeholder:text-slate-700"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-800/60 mt-4 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (disable2FACode.length !== 6) {
                  setDisable2FAError('Please enter a valid 6-digit authenticator code.');
                  return;
                }
                if (isAppwriteConfigured() && !disable2FAPassword.trim()) {
                  setDisable2FAError('Your current password is required.');
                  return;
                }

                try {
                  if (isAppwriteConfigured() && currentUser?.email) {
                    await appwrite.login(currentUser.email, disable2FAPassword);
                  }

                  const verified = await verifyTOTP(currentUserRights.twoFactorSecret || '', disable2FACode);
                  if (!verified) {
                    setDisable2FAError('Invalid authenticator verification code.');
                    return;
                  }

                  const email = (currentUser?.email || '').toLowerCase().trim();
                  const updated = userRightsList.map(ur =>
                    ur.email.toLowerCase().trim() === email
                      ? { ...ur, is2FAEnabled: false, twoFactorSecret: '' }
                      : ur
                  );
                  setUserRightsList(updated);
                  localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
                  await pushPermissionsToCloud(updated);
                  await reconcileSession(currentUser, updated);

                  showNotification('Two-Factor Authentication successfully disabled.');
                  onClose();
                } catch (err: any) {
                  setDisable2FAError(err.message || 'Verification or password invalid.');
                }
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-rose-600/10"
            >
              Disable 2FA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
