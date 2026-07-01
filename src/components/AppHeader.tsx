import React from 'react';
import {
  Search,
  Users,
  Truck as TruckIcon,
  Bell,
  Mic,
  Sun,
  Moon,
  Trash2,
  Download,
  Upload,
  Plus,
  Copy,
  Settings,
  MessageSquare,
  LogOut
} from 'lucide-react';
import { UserPermission, TripEntry, Truck, Office, Account, Driver, ExpenseEntry, Tyre, AuditLog, SupportTicket } from '../types';
import AppwriteCloudSync from './AppwriteCloudSync';

interface AppHeaderProps {
  activeTab: string;
  orgTrips: TripEntry[];
  orgTrucks: Truck[];
  orgOffices: Office[];
  orgAccounts: Account[];
  orgDrivers: Driver[];
  orgExpenses: ExpenseEntry[];
  orgTyres: Tyre[];
  orgAuditLogs: AuditLog[];
  currentUserRights: UserPermission;
  currentUserOrgId: string;
  currentUser: any;
  cyanCount: number;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  handleCyanClick: () => void;
  notificationOpen: boolean;
  setNotificationOpen: (open: boolean) => void;
  profileDropdownOpen: boolean;
  setProfileDropdownOpen: (open: boolean) => void;
  notificationRef: React.RefObject<any>;
  profileDropdownRef: React.RefObject<any>;
  hasUnreadNotifications: boolean;
  updateLastReadNotificationTime: (time: number) => void;
  showNotification: (msg: string) => void;
  getUserInitials: (user: any) => string;
  isBackendTeam: boolean;
  hasUsersTabAccess: boolean;
  setProfileActiveTab: (tab: 'SETTINGS' | 'SUPPORT') => void;
  setProfileModalOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  handleLogout: () => void;
  triggerClearAllLocalData: () => void;
  handleTriggerDownloadBackup: () => void;
  handleUploadBackupChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setEditingTrip: (trip: TripEntry | null) => void;
  setBookingModalOpen: (open: boolean) => void;
  setIsVoiceAssistantOpen: (open: boolean) => void;
  onLoadCloudState: (state: any) => void;
  supportTickets: SupportTicket[];
  activeTicketId: string | null;
  setInitialPullDone: (done: boolean) => void;
  setIsOnline: (online: boolean) => void;
  setDisconnectReason: (reason: 'offline' | 'realtime_lost' | undefined) => void;
  
  trucks: Truck[];
  drivers: Driver[];
  offices: Office[];
  accounts: Account[];
  trips: TripEntry[];
  expenses: ExpenseEntry[];
  tyres: Tyre[];
  auditLogs: AuditLog[];
  logAction: (action: string, category: string, reference: string, details: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  orgTrips,
  orgTrucks,
  orgOffices,
  orgAccounts,
  orgDrivers,
  orgExpenses,
  orgTyres,
  orgAuditLogs,
  currentUserRights,
  currentUserOrgId,
  currentUser,
  cyanCount,
  theme,
  setTheme,
  handleCyanClick,
  notificationOpen,
  setNotificationOpen,
  profileDropdownOpen,
  setProfileDropdownOpen,
  notificationRef,
  profileDropdownRef,
  hasUnreadNotifications,
  updateLastReadNotificationTime,
  showNotification,
  getUserInitials,
  isBackendTeam,
  hasUsersTabAccess,
  setProfileActiveTab,
  setProfileModalOpen,
  setActiveTab,
  handleLogout,
  triggerClearAllLocalData,
  handleTriggerDownloadBackup,
  handleUploadBackupChange,
  setEditingTrip,
  setBookingModalOpen,
  setIsVoiceAssistantOpen,
  onLoadCloudState,
  supportTickets,
  activeTicketId,
  setInitialPullDone,
  setIsOnline,
  setDisconnectReason,
  
  trucks,
  drivers,
  offices,
  accounts,
  trips,
  expenses,
  tyres,
  auditLogs,
  logAction
}) => {
  return (
    <header className="min-h-16 h-auto bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between px-6 md:px-8 py-3 md:py-2 gap-3 shrink-0 shadow-xs sticky top-0 z-40">
      <div className="flex items-center gap-4 self-stretch sm:self-auto">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
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
        </h1>
        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-2xs">
          {activeTab === 'TRIPS' && `${orgTrips.length} Total Trips`}
          {activeTab === 'TRUCKS' && `${orgTrucks.length} Trucks`}
          {activeTab === 'OFFICES' && `${orgOffices.length} Offices`}
          {activeTab === 'ACCOUNTS' && `${orgAccounts.length} Ledgers`}
          {activeTab === 'DRIVERS' && `${orgDrivers.length} Drivers`}
          {activeTab === 'DASHBOARD' && `${orgTrips.length} Load Segments`}
          {activeTab === 'EXPENSES' && `${orgExpenses.length} Vouchers`}
          {activeTab === 'REPORTS' && 'Monthly Auditing'}
          {activeTab === 'AUDIT' && `${orgAuditLogs.length} Activities`}
          {activeTab === 'TYRES' && `${orgTyres.length} Tyres`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto self-stretch sm:self-auto justify-end ml-auto">
        {/* Search Bar */}
        <div className="relative w-40 md:w-56 hidden sm:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search... ⌘K"
            className="block w-full pl-9 pr-3 py-1.5 bg-slate-100 hover:bg-slate-200/50 dark:bg-slate-800 dark:hover:bg-slate-700/50 focus:bg-white dark:focus:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-400 dark:placeholder-slate-500 cursor-pointer"
            readOnly
            onClick={() => showNotification("Global search feature is coming soon!")}
          />
        </div>

        {/* CYAN BADGE ACTION ICON */}
        <button
          onClick={handleCyanClick}
          className="relative p-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 rounded-lg border border-cyan-500/25 transition cursor-pointer flex items-center justify-center shrink-0"
          title={currentUserRights.isAdmin ? `${cyanCount} Pending Approvals` : `${cyanCount} Active/Pending Trips`}
        >
          {currentUserRights.isAdmin ? <Users className="w-4 h-4" /> : <TruckIcon className="w-4 h-4" />}
          {cyanCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-cyan-500 text-white rounded-full leading-none min-w-[16px] text-center border border-white dark:border-slate-900 shadow-sm animate-pulse">
              {cyanCount}
            </span>
          )}
        </button>

        <div ref={notificationRef} className="relative">
          <button
            id="btn-notifications-toggle"
            onClick={() => {
              setNotificationOpen(!notificationOpen);
              setProfileDropdownOpen(false);
              const now = Date.now();
              updateLastReadNotificationTime(now);
              if (currentUser) {
                const key = `ttt_last_read_notifications_${(currentUser.email || '').toLowerCase().trim()}`;
                localStorage.setItem(key, now.toString());
              }
            }}
            className="relative p-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-660 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center justify-center"
            title="Notification Center"
          >
            <Bell className="w-4 h-4" />
            {hasUnreadNotifications && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse" />
            )}
          </button>

          {notificationOpen && (
            <div className="
              fixed left-3 right-3 top-16
              md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:w-80
              bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800
              text-slate-800 dark:text-slate-100 rounded-xl shadow-2xl z-50 p-4 space-y-3 animate-fade-in text-left
            ">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Recent Activity Logs</span>
                <button
                  onClick={() => setNotificationOpen(false)}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-655 dark:hover:text-slate-350 text-xs p-1 font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {orgAuditLogs.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400 dark:text-slate-500 italic">No recent activities logged.</p>
                ) : (
                  orgAuditLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className="text-[11px] p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className={`font-extrabold uppercase text-[9px] px-1.5 py-0.5 rounded ${log.action === 'Approved' ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50' :
                          log.action === 'Rejected' ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50' :
                            log.action === 'Created' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-150 dark:border-blue-900/50' :
                              log.action === 'Deleted' ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-150 dark:border-red-900/50' :
                                log.action === 'Edited' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-150 dark:border-amber-900/50' :
                                  'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200'
                          }`}>
                          {log.action}
                        </span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono font-medium">{(log.timestamp || '').substring(11, 16)}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-tight">
                        <strong className="text-slate-900 dark:text-white">{log.category} ({log.reference}):</strong> {log.details}
                      </p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500">By {log.user}</p>
                    </div>
                  ))
                )}
              </div>
              {orgAuditLogs.length > 0 && currentUserRights.isAdmin && (
                <button
                  onClick={() => {
                    setActiveTab('AUDIT');
                    setNotificationOpen(false);
                  }}
                  className="w-full text-center text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline pt-1 block border-t border-slate-100 dark:border-slate-800"
                >
                  View Full Audit Trail
                </button>
              )}
            </div>
          )}
        </div>

        {/* VOICE ASSISTANT */}
        <button
          onClick={() => setIsVoiceAssistantOpen(true)}
          className="p-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center justify-center shrink-0"
          title="Voice Assistant (Alt+V)"
        >
          <Mic className="w-4 h-4" />
        </button>

        {/* THEME TOGGLE */}
        <button
          onClick={() => {
            const nextTheme = theme === 'light' ? 'dark' : 'light';
            setTheme(nextTheme);
            localStorage.setItem('ttt_theme', nextTheme);
          }}
          className="p-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center justify-center shrink-0"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* USER PROFILE INITIALS AVATAR */}
        <div ref={profileDropdownRef} className="relative shrink-0">
          <button
            id="btn-profile-avatar-toggle"
            onClick={() => {
              setProfileDropdownOpen(!profileDropdownOpen);
              setNotificationOpen(false);
            }}
            className="w-9 h-9 rounded-full bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 font-bold border border-blue-600/20 dark:border-blue-500/30 flex items-center justify-center text-xs cursor-pointer hover:bg-blue-600/20 transition-all select-none"
            title="User Profile Menu"
          >
            {getUserInitials(currentUser)}
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl shadow-2xl z-50 p-1.5 animate-fade-in text-left font-sans">
              <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-850 mb-1 space-y-0.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser?.name || 'Logistics User'}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{currentUser?.email || 'user@fleettrack.local'}</p>
                {currentUserOrgId && (
                  <div className="flex items-center justify-between mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                    <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 truncate" title={currentUserOrgId}>Org: {currentUserOrgId}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(currentUserOrgId);
                        showNotification('Organization ID copied!');
                      }}
                      className="ml-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer shrink-0"
                      title="Copy Org ID"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setProfileActiveTab('SETTINGS');
                  setProfileModalOpen(true);
                  setProfileDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-left transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Profile Settings</span>
              </button>

              {!isBackendTeam && (
                <button
                  onClick={() => {
                    setProfileActiveTab('SUPPORT');
                    setProfileModalOpen(true);
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-left transition cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span>Support Center</span>
                </button>
              )}

              {hasUsersTabAccess && (
                <button
                  onClick={() => {
                    setActiveTab('USERS');
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-left transition cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Access Control</span>
                </button>
              )}

              <div className="border-t border-slate-100 dark:border-slate-850 my-1"></div>

              <button
                onClick={() => {
                  setProfileDropdownOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-left transition cursor-pointer font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* CLOUD DATA SYNC */}
        {currentUser && (
          <AppwriteCloudSync
            currentLocalState={{
              trucks,
              drivers,
              offices,
              accounts,
              trips,
              expenses,
              tyres,
              auditLogs,
              supportTickets
            }}
            onLoadCloudState={onLoadCloudState}
            showNotification={showNotification}
            logAction={logAction}
            currentUserOrgId={currentUserOrgId}
            currentUserEmail={currentUser?.email}
            currentUserId={currentUser?.email || ''}
            isAdmin={currentUserRights.isAdmin}
            onInitialSyncComplete={setInitialPullDone}
            onConnectionChange={(online, reason) => {
              setIsOnline(online);
              setDisconnectReason(reason);
            }}
            activeTicketId={activeTicketId}
          />
        )}

        {currentUserRights.isAdmin && (
          <button
            id="btn-clear-data"
            onClick={triggerClearAllLocalData}
            title="Wipe all local database logs and start fresh"
            className="p-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-lg transition border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1 font-medium shadow-2xs cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden lg:inline text-rose-500">Clear Data</span>
          </button>
        )}
        {currentUserRights.isAdmin && (
          <button
            id="btn-backup-download"
            onClick={handleTriggerDownloadBackup}
            title="Download Snapshot Backup File (.json)"
            className="p-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-lg transition border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1 font-medium shadow-2xs cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden lg:inline">Backup</span>
          </button>
        )}
        {currentUserRights.isAdmin && (
          <label className="p-2 bg-white dark:bg-slate-855 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-lg transition border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1 font-medium shadow-2xs cursor-pointer shrink-0 select-none">
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden lg:inline">Restore</span>
            <input
              id="file-restore-input"
              type="file"
              accept=".json"
              onChange={handleUploadBackupChange}
              className="hidden"
            />
          </label>
        )}

        {currentUserRights.isAdmin && (
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 self-center hidden sm:block" />
        )}

        {currentUserRights.canEditTrips && (
          <button
            id="btn-quick-post-trip"
            onClick={() => {
              if (orgTrucks.length === 0 || orgOffices.length === 0) {
                alert("Hold on! Register Trucks and Offices in their master sheets before booking cargo entries.");
                return;
              }
              setEditingTrip(null);
              setBookingModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Entry</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
