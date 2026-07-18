import { createSignal, createEffect, Component } from 'solid-js';

import { Lock } from 'lucide-solid';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

interface PasswordResetScreenProps {
  resetPasswordState: {
    active: boolean;
    userId: string;
    secret: string;
  };
  setResetPasswordState: (state: any) => void;
  setLoadingUser: (loading: boolean) => void;
  showNotification: (msg: string) => void;
}

export const PasswordResetScreen: Component<PasswordResetScreenProps> = ({
  resetPasswordState,
  setResetPasswordState,
  setLoadingUser,
  showNotification
}) => {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 font-sans p-4">
      {/* Background glowing decorations */}
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/15 mb-2">
          <Lock class="w-7 h-7 text-white" />
        </div>
        <h2 class="text-2xl font-bold tracking-tight text-white animate-fade-in">Reset Password</h2>
        <p class="text-xs text-slate-400">Set a new secure password for your account.</p>

        <form onSubmit={async (e) => {
          e.preventDefault();
          const target = e.target as any;
          const newPassword = target.password.value;
          const confirmPassword = target.confirmPassword.value;

          if (newPassword.length < 8) {
            alert("Password must be at least 8 characters long.");
            return;
          }
          if (newPassword !== confirmPassword) {
            alert("Passwords do not match.");
            return;
          }

          setLoadingUser(true);
          try {
            if (isAppwriteConfigured()) {
              await appwrite.updateRecovery(resetPasswordState.userId, resetPasswordState.secret, newPassword);
            }
            showNotification("Password has been reset successfully! You can now log in.");
            setResetPasswordState(null);
            window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
          } catch (err: any) {
            console.error(err);
            alert(`Failed to reset password: ${err.message || err}`);
          } finally {
            setLoadingUser(false);
          }
        }} class="space-y-4 text-left">
          <div class="space-y-1.5">
            <label class="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">New Password</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              required
              class="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all"
            />
          </div>
          <div class="space-y-1.5">
            <label class="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Confirm New Password</label>
            <input
              type="password"
              name="confirmPassword"
              placeholder="••••••••"
              required
              class="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            class="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/25 transition cursor-pointer"
          >
            Update Password
          </button>

          <button
            type="button"
            onClick={() => {
              setResetPasswordState(null);
              window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
            }}
            class="w-full py-2 text-slate-500 hover:text-slate-400 text-xs font-bold transition-all focus:outline-none cursor-pointer"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordResetScreen;
