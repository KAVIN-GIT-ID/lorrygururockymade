import React from 'react';
import {
  BarChart3,
  BookOpen,
  Truck as TruckIcon,
  MapPin,
  Coins,
  UserCheck,
  FileSpreadsheet,
  FileText,
  History,
  Disc,
  Users,
  Settings,
  X
} from 'lucide-react';
import { UserPermission } from '../../types';

export type AppTab =
  | 'DASHBOARD'
  | 'TRIPS'
  | 'TRUCKS'
  | 'OFFICES'
  | 'ACCOUNTS'
  | 'DRIVERS'
  | 'EXPENSES'
  | 'REPORTS'
  | 'AUDIT'
  | 'TYRES'
  | 'USERS'
  | 'BACKEND';

interface AppSidebarProps {
  activeTab: AppTab;
  selectTab: (tab: AppTab) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  currentUserRights: UserPermission;
  hasUsersTabAccess: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  selectTab,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  currentUserRights,
  hasUsersTabAccess
}) => {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-slate-900 flex flex-col border-r border-slate-200 dark:border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out
        md:static md:w-64 md:h-full md:z-auto md:shadow-none md:translate-x-0 shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      >
        {/* Header Panel (Logo & Close Button inside drawer) */}
        <div className="p-4 md:p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 shrink-0">
          <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-lg md:text-xl tracking-tight">
            <img
              src="/assets/logo-CkJqcrTB.png"
              alt="LorryGuru Logo"
              className="h-8 w-auto object-contain shrink-0"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <span>
              Lorry<span className="text-blue-600">Guru</span>
              <span className="text-amber-500">.in</span>
            </span>
          </div>

          {/* Drawer Close Button (Mobile Only) */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 cursor-pointer transition"
            aria-label="Close Navigation Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Navigation Items */}
          <div className="p-4 md:p-6 pt-2 md:pt-0 flex-1 flex flex-col min-h-0 overflow-hidden">
            <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
              <button
                id="tab-btn-dashboard"
                onClick={() => selectTab('DASHBOARD')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${
                  activeTab === 'DASHBOARD'
                    ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </button>

              {currentUserRights.canViewTrips && (
                <button
                  id="tab-btn-trips"
                  onClick={() => selectTab('TRIPS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${
                    activeTab === 'TRIPS'
                      ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Trip Management</span>
                </button>
              )}

              {currentUserRights.canViewTrucks && (
                <button
                  id="tab-btn-trucks"
                  onClick={() => selectTab('TRUCKS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${
                    activeTab === 'TRUCKS'
                      ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <TruckIcon className="w-4 h-4" />
                  <span>Truck Registry</span>
                </button>
              )}

              {currentUserRights.canViewOffices && (
                <button
                  id="tab-btn-offices"
                  onClick={() => selectTab('OFFICES')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${
                    activeTab === 'OFFICES'
                      ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>Offices</span>
                </button>
              )}

              {currentUserRights.canViewAccounts && (
                <button
                  id="tab-btn-accounts"
                  onClick={() => selectTab('ACCOUNTS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${
                    activeTab === 'ACCOUNTS'
                      ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  <span>Account Ledger</span>
                </button>
              )}

              {currentUserRights.canViewDrivers && (
                <button
                  id="tab-btn-drivers"
                  onClick={() => selectTab('DRIVERS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${
                    activeTab === 'DRIVERS'
                      ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Drivers Database</span>
                </button>
              )}

              {currentUserRights.canViewExpenses && (
                <button
                  id="tab-btn-expenses"
                  onClick={() => selectTab('EXPENSES')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${
                    activeTab === 'EXPENSES'
                      ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Expense Ledger</span>
                </button>
              )}

              {currentUserRights.canViewTrips && (
                <button
                  id="tab-btn-reports"
                  onClick={() => selectTab('REPORTS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${
                    activeTab === 'REPORTS'
                      ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Monthly Reports</span>
                </button>
              )}

              {currentUserRights.isAdmin && (
                <button
                  id="tab-btn-audit"
                  onClick={() => selectTab('AUDIT')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${
                    activeTab === 'AUDIT'
                      ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>System Audit Logs</span>
                </button>
              )}

              {currentUserRights.canViewTyres && (
                <button
                  id="tab-btn-tyres"
                  onClick={() => selectTab('TYRES')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${
                    activeTab === 'TYRES'
                      ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <Disc className="w-4 h-4" />
                  <span>Tyre Ledger & ODO</span>
                </button>
              )}

              {hasUsersTabAccess && (
                <button
                  id="tab-btn-users"
                  onClick={() => selectTab('USERS')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${
                    activeTab === 'USERS'
                      ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Access Control</span>
                </button>
              )}

              {currentUserRights.isSuperAdmin && (
                <button
                  id="tab-btn-backend"
                  onClick={() => selectTab('BACKEND')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${
                    activeTab === 'BACKEND'
                      ? 'bg-purple-50 dark:bg-purple-600/10 text-purple-600 dark:text-purple-400 font-semibold border-l-2 border-purple-500 pl-2.5'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <Settings className="w-4 h-4 text-purple-500" />
                  <span>Backend Dashboard</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      </aside>
    </>
  );
};
