import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Users,
  Truck as TruckIcon,
  Bell,
  Mic,
  Moon,
  Sun,
  Settings,
  LogOut,
  Copy,
  Trash2,
  Download,
  Upload,
  Plus
} from 'lucide-react';
import { UserPermission } from '../../types';
import AppwriteCloudSync from '../AppwriteCloudSync';

interface AppNavbarProps {
  activeTab: string;
  currentUser: any;
  currentUserRights: UserPermission;
  currentUserOrgId: string;
  theme: string;
  setTheme: (theme: string) => void;
  orgAuditLogs: any[];
  orgTrips: any[];
  orgTrucks: any[];
  orgOffices: any[];
  orgAccounts: any[];
  orgDrivers: any[];
  orgExpenses: any[];
  orgTyres: any[];
  trucks: any[];
  drivers: any[];
  offices: any[];
  accounts: any[];
  trips: any[];
  expenses: any[];
  tyres: any[];
  auditLogs: any[];
  hasUsersTabAccess: boolean;
  onSelectTab: (tab: any) => void;
  onOpenProfileModal: () => void;
  onOpenVoiceAssistant: () => void;
  onOpenNewTripModal: () => void;
  onTriggerClearAllData: () => void;
  onTriggerDownloadBackup: () => void;
  onUploadBackupChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogout: () => void;
  onLoadCloudState: (data: any) => void;
  showNotification: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  logAction: (action: string, category: string, reference: string, details: string) => void;
  setInitialPullDone: (done: boolean) => void;
  setIsOnline: (online: boolean) => void;
  setDisconnectReason: (reason: any) => void;
}

function getUserInitials(user: any): string {
  if (!user) return 'U';
  const name = user.name || user.email || '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'U';
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  activeTab,
  currentUser,
  currentUserRights,
  currentUserOrgId,
  theme,
  setTheme,
  orgAuditLogs,
  orgTrips,
  orgTrucks,
  orgOffices,
  orgAccounts,
  orgDrivers,
  orgExpenses,
  orgTyres,
  trucks,
  drivers,
  offices,
  accounts,
  trips,
  expenses,
  tyres,
  auditLogs,
  hasUsersTabAccess,
  onSelectTab,
  onOpenProfileModal,
  onOpenVoiceAssistant,
  onOpenNewTripModal,
  onTriggerClearAllData,
  onTriggerDownloadBackup,
  onUploadBackupChange,
  onLogout,
  onLoadCloudState,
  showNotification,
  logAction,
  setInitialPullDone,
  setIsOnline,
  setDisconnectReason
}) => {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [lastReadNotificationTime, setLastReadNotificationTime] = useState(0);

  const notificationRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser) {
      const key = `ttt_last_read_notifications_${(currentUser.email || '').toLowerCase().trim()}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        setLastReadNotificationTime(parseInt(stored, 10) || 0);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasUnreadNotifications = orgAuditLogs.some((l) => {
    const logTime = new Date(l.timestamp || 0).getTime();
    return logTime > lastReadNotificationTime;
  });

  const cyanCount = currentUserRights.isAdmin
    ? orgAuditLogs.filter((l) => l.action === 'Pending' || l.action === 'Requested').length
    : orgTrips.filter((t) => t.status === 'Active' || t.status === 'Pending').length;

  const handleCyanClick = () => {
    if (currentUserRights.isAdmin) {
      onSelectTab('USERS');
    } else {
      onSelectTab('TRIPS');
    }
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 sticky top-0 z-30 shadow-xs">
      {/* Row 1: Title + primary actions */}
      <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 h-14">
        {/* Left: Page title + count badge */}
        <div className="flex items-center gap-2 min-w-0 shrink">
          <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-800 dark:text-white tracking-tight truncate">
            {activeTab === 'DASHBOARD' && 'Operations Dashboard'}
            {activeTab === 'TRIPS' && 'Manage Active Trips'}
            {activeTab === 'TRUCKS' && 'Truck Datasheet'}
            {activeTab === 'OFFICES' && 'Office Branch Directory'}
            {activeTab === 'ACCOUNTS' && 'Mapped Account Ledgers'}
            {activeTab === 'DRIVERS' && 'Operator Drivers Database'}
            {activeTab === 'EXPENSES' && 'Voucher & Expenses Ledger'}
            {activeTab === 'REPORTS' && 'Fleet Profitability Reports'}
            {activeTab === 'AUDIT' && 'System Audit Trails'}
            {activeTab === 'TYRES' && 'Tyre Inventory & Life Tracking'}
            {activeTab === 'USERS' && 'Access Control'}
            {activeTab === 'BACKEND' && 'Backend Operations Console'}
          </h1>
          <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold border border-slate-200 dark:border-slate-700 whitespace-nowrap">
            {activeTab === 'TRIPS' && `${orgTrips.length} Total Trips`}
            {activeTab === 'TRUCKS' && `${orgTrucks.length} Trucks`}
            {activeTab === 'OFFICES' && `${orgOffices.length} Offices`}
            {activeTab === 'ACCOUNTS' && `${orgAccounts.length} Ledgers`}
            {activeTab === 'DRIVERS' && `${orgDrivers.length} Drivers`}
            {activeTab === 'DASHBOARD' && `${orgTrips.length} Segments`}
            {activeTab === 'EXPENSES' && `${orgExpenses.length} Vouchers`}
            {activeTab === 'REPORTS' && 'Auditing'}
            {activeTab === 'AUDIT' && `${orgAuditLogs.length} Activities`}
            {activeTab === 'TYRES' && `${orgTyres.length} Tyres`}
          </span>
        </div>

        {/* Right: Compact icon row */}
        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          {/* Search — desktop only */}
          <div className="relative hidden xl:block w-44">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search... ⌘K"
              className="block w-full pl-9 pr-3 py-1.5 bg-slate-100 hover:bg-slate-200/50 dark:bg-slate-800 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400 dark:placeholder-slate-500 cursor-pointer transition"
              readOnly
              onClick={() => showNotification('Global search feature is coming soon!')}
            />
          </div>

          {/* Cyan quick-action icon */}
          <button
            onClick={handleCyanClick}
            className="relative p-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 rounded-lg border border-cyan-500/25 transition cursor-pointer"
            title={currentUserRights.isAdmin ? `${cyanCount} Pending Approvals` : `${cyanCount} Active/Pending Trips`}
          >
            {currentUserRights.isAdmin ? <Users className="w-4 h-4" /> : <TruckIcon className="w-4 h-4" />}
            {cyanCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-cyan-500 text-white rounded-full leading-none min-w-[16px] text-center border border-white dark:border-slate-900 shadow-sm animate-pulse">
                {cyanCount}
              </span>
            )}
          </button>

          {/* Notifications */}
          <div ref={notificationRef} className="relative">
            <button
              id="btn-notifications-toggle"
              onClick={() => {
                setNotificationOpen(!notificationOpen);
                setProfileDropdownOpen(false);
                const now = Date.now();
                setLastReadNotificationTime(now);
                if (currentUser) {
                  const key = `ttt_last_read_notifications_${(currentUser.email || '').toLowerCase().trim()}`;
                  localStorage.setItem(key, now.toString());
                }
              }}
              className="relative p-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              title="Notification Center"
            >
              <Bell className="w-4 h-4" />
              {hasUnreadNotifications && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse" />
              )}
            </button>

            {notificationOpen && (
              <div
                className="
                fixed left-3 right-3 top-16
                md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-80
                bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800
                text-slate-800 dark:text-slate-100 rounded-xl shadow-2xl z-50 p-4 space-y-3 animate-fade-in text-left
              "
              >
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Recent Activity Logs
                  </span>
                  <button
                    onClick={() => setNotificationOpen(false)}
                    className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-xs p-1 font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {orgAuditLogs.length === 0 ? (
                    <p className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 italic">
                      No recent activities logged.
                    </p>
                  ) : (
                    orgAuditLogs.slice(0, 8).map((log) => (
                      <div
                        key={log.id}
                        className="text-[11px] p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-1"
                      >
                        <div className="flex justify-between items-center">
                          <span
                            className={`font-extrabold uppercase text-[9px] px-1.5 py-0.5 rounded ${
                              log.action === 'Approved'
                                ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50'
                                : log.action === 'Rejected'
                                ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                                : log.action === 'Created'
                                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50'
                                : log.action === 'Deleted'
                                ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50'
                                : log.action === 'Edited'
                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {log.action}
                          </span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono font-medium">
                            {(log.timestamp || '').substring(11, 16)}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-tight">
                          <strong className="text-slate-900 dark:text-white">
                            {log.category} ({log.reference}):
                          </strong>{' '}
                          {log.details}
                        </p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500">By {log.user}</p>
                      </div>
                    ))
                  )}
                </div>
                {orgAuditLogs.length > 0 && currentUserRights.isAdmin && (
                  <button
                    onClick={() => {
                      onSelectTab('AUDIT');
                      setNotificationOpen(false);
                    }}
                    className="w-full text-center text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline pt-1 block border-t border-slate-100 dark:border-slate-800 cursor-pointer"
                  >
                    View Full Audit Trail
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Voice assistant */}
          <button
            onClick={onOpenVoiceAssistant}
            className="p-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer hidden sm:flex items-center justify-center"
            title="Voice Assistant (Alt+V)"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => {
              const nextTheme = theme === 'light' ? 'dark' : 'light';
              setTheme(nextTheme);
              localStorage.setItem('ttt_theme', nextTheme);
            }}
            className="p-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Avatar / Profile dropdown */}
          <div ref={profileDropdownRef} className="relative">
            <button
              id="btn-profile-avatar-toggle"
              onClick={() => {
                setProfileDropdownOpen(!profileDropdownOpen);
                setNotificationOpen(false);
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 font-bold border border-blue-600/20 dark:border-blue-500/30 flex items-center justify-center text-xs cursor-pointer hover:bg-blue-600/20 transition-all select-none"
              title="User Profile Menu"
            >
              {getUserInitials(currentUser)}
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl shadow-2xl z-50 p-1.5 animate-fade-in text-left font-sans">
                <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 mb-1 space-y-0.5">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {currentUser?.name || 'Logistics User'}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser?.email || 'user@fleettrack.local'}
                  </p>
                  {currentUserOrgId && (
                    <div className="flex items-center justify-between mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                      <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 truncate" title={currentUserOrgId}>
                        Org: {currentUserOrgId}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentUserOrgId);
                          showNotification('Organization ID copied!');
                        }}
                        className="ml-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer shrink-0"
                        title="Copy Org ID"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    onOpenProfileModal();
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-left transition cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Profile Settings</span>
                </button>

                {hasUsersTabAccess && (
                  <button
                    onClick={() => {
                      onSelectTab('USERS');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-left transition cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Access Control</span>
                  </button>
                )}

                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-left transition cursor-pointer font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>

          {/* Cloud sync status badge — ONLY visible for admin user */}
          {currentUser && (
            <div className={currentUserRights.isAdmin ? 'inline-block' : 'hidden'}>
              <AppwriteCloudSync
                currentLocalState={{
                  trucks,
                  drivers,
                  offices,
                  accounts,
                  trips,
                  expenses,
                  tyres,
                  auditLogs
                }}
                onLoadCloudState={onLoadCloudState}
                showNotification={showNotification}
                logAction={logAction}
                currentUserOrgId={currentUserOrgId}
                isAdmin={currentUserRights.isAdmin}
                onInitialSyncComplete={setInitialPullDone}
                onConnectionChange={(online, reason) => {
                  setIsOnline(online);
                  setDisconnectReason(reason);
                }}
              />
            </div>
          )}

          {/* ── Admin tool buttons — shown inline on lg+, hidden on smaller ── */}
          {currentUserRights.isAdmin && (
            <div className="hidden lg:flex items-center gap-1.5">
              <button
                id="btn-clear-data"
                onClick={onTriggerClearAllData}
                title="Wipe all local database logs and start fresh"
                className="p-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-rose-500 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1 font-medium shadow-2xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Clear Data</span>
              </button>

              <button
                id="btn-backup-download"
                onClick={onTriggerDownloadBackup}
                title="Download Snapshot Backup File (.json)"
                className="p-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1 font-medium shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden xl:inline">Backup</span>
              </button>

              <label
                title="Restore from Backup File (.json)"
                className="p-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1 font-medium shadow-2xs cursor-pointer select-none"
              >
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden xl:inline">Restore</span>
                <input
                  id="file-restore-input"
                  type="file"
                  accept=".json"
                  onChange={onUploadBackupChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Divider */}
          {currentUserRights.canEditTrips && currentUserRights.isAdmin && (
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 self-center" />
          )}

          {/* New Entry — always visible */}
          {currentUserRights.canEditTrips && (
            <button
              id="btn-quick-post-trip"
              onClick={() => {
                if (orgTrucks.length === 0 || orgOffices.length === 0) {
                  alert('Hold on! Register Trucks and Offices in their master sheets before booking cargo entries.');
                  return;
                }
                onOpenNewTripModal();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold shadow-sm flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Admin quick tools — visible only on sm/md */}
      {currentUserRights.isAdmin && (
        <div className="lg:hidden flex items-center gap-2 px-4 sm:px-6 py-2 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/70 dark:bg-slate-900/70 overflow-x-auto">
          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
            Admin Tools:
          </span>

          <button
            onClick={onTriggerClearAllData}
            title="Clear local data"
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 text-rose-500 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] font-medium cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
          >
            <Trash2 className="w-3 h-3" />
            Clear Data
          </button>

          <button
            onClick={onTriggerDownloadBackup}
            title="Download backup"
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <Download className="w-3 h-3" />
            Backup
          </button>

          <label className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition select-none">
            <Upload className="w-3 h-3" />
            Restore
            <input
              type="file"
              accept=".json"
              onChange={onUploadBackupChange}
              className="hidden"
            />
          </label>
        </div>
      )}
    </header>
  );
};
