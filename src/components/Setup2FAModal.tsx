import { createSignal, Component } from 'solid-js';

import { ShieldCheck, AlertCircle, Copy } from 'lucide-solid';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { verifyTOTP } from '../utils/totp';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useLanguage } from '../context/LanguageContext';

interface Setup2FAModalProps {
  isOpen: boolean;
  onClose: () => void;
  setup2FASecret: string;
  showNotification: (msg: string) => void;
  reconcileSession: (user: any, freshRightsList?: any[]) => Promise<any>;
}

export default function Setup2FAModal(props: Setup2FAModalProps) {
  const auth = useAuth();
  const perm = usePermissions();
  const { t } = useLanguage();

  const [setup2FACode, setSetup2FACode] = createSignal('');
  const [setup2FAPassword, setSetup2FAPassword] = createSignal('');
  const [setup2FAError, setSetup2FAError] = createSignal<string | null>(null);

  if (!props.isOpen) return null;

  return (
    <div class="fixed inset-0 z-110 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-in text-left text-slate-100">
        <div class="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
          <h3 class="font-bold text-white text-base flex items-center gap-2">
            <ShieldCheck class="w-5 h-5 text-blue-500" />
            {t('2fa.setup_title', 'Enable 2FA Protection')}
          </h3>
          <button
            onClick={props.onClose}
            class="text-slate-400 hover:text-white text-sm font-bold p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {setup2FAError() && (
          <div class="mb-4 p-3 bg-red-950/30 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-red-400 text-xs leading-normal">
            <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
            <span>{setup2FAError()}</span>
          </div>
        )}

        <div class="space-y-4">
          <p class="text-xs text-slate-400 leading-relaxed">
            Scan the QR code below or manually type the secret key into Google Authenticator/Microsoft Authenticator app to begin.
          </p>

          {/* QR Code and Secret display */}
          <div class="flex flex-col items-center bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-3">
            <div class="bg-white p-2 rounded-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                  `otpauth://totp/FleetTrack:${auth.currentUser()?.email || ''}?secret=${props.setup2FASecret}&issuer=FleetTrack`
                )}`}
                alt="Scan with Authenticator App"
                width="144"
                height="144"
                class="w-36 h-36 border border-slate-200"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div class="w-full text-center space-y-1">
              <span class="text-[9px] text-slate-500 uppercase tracking-widest font-extrabold block">Secret Setup Key</span>
              <div class="flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-xs text-blue-400 font-bold select-all">
                <span>{props.setup2FASecret}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(props.setup2FASecret);
                    alert('Secret key copied to clipboard!');
                  }}
                  class="text-slate-400 hover:text-white p-0.5"
                  title="Copy Key"
                >
                  <Copy class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Verify Fields */}
          <div class="space-y-3">
            <div class="space-y-1.5">
              <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Verification Code</label>
              <input
                data-testid="setup-2fa-code"
                type="text"
                maxLength={6}
                placeholder="e.g. 000000"
                value={setup2FACode()}
                onChange={(e) => setSetup2FACode(e.target.value.replace(/\D/g, ''))}
                class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-202 text-xs font-semibold focus:outline-none placeholder:text-slate-700 font-mono text-center tracking-widest"
              />
            </div>

            {isAppwriteConfigured() && auth.currentUser()?.email && (
              <div class="space-y-1.5">
                <label class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Current Account Password</label>
                <input
                  data-testid="setup-2fa-password"
                  type="password"
                  placeholder="••••••••"
                  value={setup2FAPassword()}
                  onChange={(e) => setSetup2FAPassword(e.target.value)}
                  class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-202 text-xs font-semibold focus:outline-none placeholder:text-slate-700"
                />
              </div>
            )}
          </div>

          <div class="flex gap-2 pt-2 border-t border-slate-800/60 mt-4 justify-end">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (setup2FACode().length !== 6) {
                  setSetup2FAError('Please enter a valid 6-digit authenticator code.');
                  return;
                }
                if (isAppwriteConfigured() && !setup2FAPassword().trim()) {
                  setSetup2FAError('Your current password is required.');
                  return;
                }

                try {
                  if (isAppwriteConfigured() && auth.currentUser()?.email) {
                    await appwrite.login(auth.currentUser().email, setup2FAPassword());
                  }

                  const verified = await verifyTOTP(props.setup2FASecret, setup2FACode());
                  if (!verified) {
                    setSetup2FAError('Invalid authenticator verification code.');
                    return;
                  }

                  const email = (auth.currentUser()?.email || (perm.currentUserRights() as any)?.email || '').toLowerCase().trim();
                  const updated = perm.userRightsList().map(ur =>
                    (!email || ur.email.toLowerCase().trim() === email)
                      ? { ...ur, is2FAEnabled: true, twoFactorSecret: props.setup2FASecret }
                      : ur
                  );
                  perm.setUserRightsList(updated);
                  localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
                  await perm.pushPermissions(updated, email);
                  if (props.reconcileSession) {
                    await props.reconcileSession(auth.currentUser(), updated);
                  }

                  if (props.showNotification) {
                    props.showNotification('Two-Factor Authentication successfully enabled!');
                  }
                  props.onClose();
                } catch (err: any) {
                  setSetup2FAError(err.message || 'Verification or password invalid.');
                }
              }}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-600/10"
            >
              Enable 2FA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
