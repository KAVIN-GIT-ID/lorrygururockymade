import React from 'react';
import { User, MessageSquare, ShieldCheck, Moon, Sun, FileText, LogOut, Copy, Check } from 'lucide-react';
import { UserPermission } from '../types';

interface MobileAccountTabProps {
  currentUser: any;
  currentUserOrgId: string;
  currentUserRights: UserPermission;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  handleLogout: () => void;
  setProfileActiveTab: (tab: 'SETTINGS' | 'SUPPORT') => void;
  setProfileModalOpen: (open: boolean) => void;
  setSetup2FAOpen: (open: boolean) => void;
  setDisable2FAOpen: (open: boolean) => void;
  clientUnreadCount: number;
  showNotification: (msg: string) => void;
  appVersion?: string;
}

export default function MobileAccountTab({
  currentUser,
  currentUserOrgId,
  currentUserRights,
  theme,
  setTheme,
  handleLogout,
  setProfileActiveTab,
  setProfileModalOpen,
  setSetup2FAOpen,
  setDisable2FAOpen,
  clientUnreadCount,
  showNotification,
  appVersion
}: MobileAccountTabProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyOrg = () => {
    if (!currentUserOrgId) return;
    navigator.clipboard.writeText(currentUserOrgId);
    setCopied(true);
    showNotification("Organization ID copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const name = currentUser?.name || 'Logistics Admin';
  const email = currentUser?.email || 'admin@lorryguru.in';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'AD';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 pb-20 select-none">
      {/* Profile Header */}
      <div className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
        <div className="w-14 h-14 bg-gradient-to-tr from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center text-lg font-black shadow-md shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
            {name}
          </h2>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
            {email}
          </p>
          {currentUserOrgId && (
            <div className="flex items-center gap-1.5 mt-2 bg-slate-50 dark:bg-slate-955/50 border border-slate-200/50 dark:border-slate-800 px-2 py-0.5 rounded-lg w-max max-w-full">
              <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 truncate">
                Org: {currentUserOrgId}
              </span>
              <button
                onClick={handleCopyOrg}
                className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Account Settings Menu */}
      <div className="space-y-3">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
          Menu Settings
        </h3>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden shadow-sm">
          {/* Profile Details */}
          <button
            onClick={() => {
              setProfileActiveTab('SETTINGS');
              setProfileModalOpen(true);
            }}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-blue-500 bg-blue-50 dark:bg-blue-955/20 p-2 rounded-xl">
                <User className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Profile Details</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Edit</span>
          </button>

          {/* Support Tickets */}
          <button
            onClick={() => {
              setProfileActiveTab('SUPPORT');
              setProfileModalOpen(true);
            }}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-emerald-500 bg-emerald-50 dark:bg-emerald-955/20 p-2 rounded-xl">
                <MessageSquare className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Support Center</span>
            </div>
            <div className="flex items-center gap-2">
              {clientUnreadCount > 0 && (
                <span className="bg-rose-500 text-white rounded-full text-[9px] px-1.5 h-4 flex items-center justify-center font-bold">
                  {clientUnreadCount}
                </span>
              )}
              <span className="text-[10px] text-slate-400 font-medium">Chat</span>
            </div>
          </button>

          {/* Security / 2FA */}
          <button
            onClick={() => {
              // Trigger appropriate modal depending on current state
              const is2faActive = !!(currentUserRights as any).is2FAEnabled;
              if (is2faActive) {
                setDisable2FAOpen(true);
              } else {
                setSetup2FAOpen(true);
              }
            }}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-amber-500 bg-amber-50 dark:bg-amber-955/20 p-2 rounded-xl">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Two-Factor Auth (2FA)</span>
            </div>
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
              (currentUserRights as any).is2FAEnabled
                ? 'bg-green-100 dark:bg-green-955/80 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/50'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}>
              {(currentUserRights as any).is2FAEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </button>

          {/* Theme Toggler */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-purple-500 bg-purple-50 dark:bg-purple-955/20 p-2 rounded-xl">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Display Theme</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium capitalize">{theme} Mode</span>
          </button>
        </div>
      </div>

      {/* Logout / Bottom Actions */}
      <div className="space-y-3">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-4 bg-rose-50 hover:bg-rose-100/70 dark:bg-rose-955/10 dark:hover:bg-rose-955/20 text-rose-600 dark:text-rose-400 rounded-3xl border border-rose-100 dark:border-rose-900/20 text-xs font-black transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of LorryGuru</span>
        </button>
      </div>

      {appVersion && (
        <div className="text-center pt-2">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide">
            App Version v{appVersion}
          </p>
        </div>
      )}
    </div>
  );
}
