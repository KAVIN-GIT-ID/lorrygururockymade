import { createSignal, createEffect, Component } from 'solid-js';

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
  MessageSquare,
  Settings,
  Copy,
  LogOut,
  X,
  Receipt
} from 'lucide-solid';
import { UserPermission, UserRights } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface AppSidebarProps {
  logo: string;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  activeTab: string;
  selectTab: (tab: string) => void;
  currentUserRights: UserRights;
  hasUsersTabAccess: boolean;
  isBackendTeam: boolean;
  getClientUnreadTicketsCount: () => number;
  getAgentUnreadTicketsCount: () => number;
  currentUser: any;
  currentUserOrgId: string;
  showNotification: (msg: string) => void;
  handleLogout: () => void;
  setProfileActiveTab: (tab: 'SETTINGS' | 'SUPPORT') => void;
  setProfileModalOpen: (open: boolean) => void;
}

export const AppSidebar: Component<AppSidebarProps> = (props) => {
  const { t } = useLanguage();
  const logo = () => props.logo;
  const isMobileMenuOpen = () => props.isMobileMenuOpen;
  const setIsMobileMenuOpen = props.setIsMobileMenuOpen;
  const activeTab = () => props.activeTab;
  const selectTab = props.selectTab;
  const currentUserRights = () => props.currentUserRights;
  const hasUsersTabAccess = () => props.hasUsersTabAccess;
  const isBackendTeam = () => props.isBackendTeam;
  const getClientUnreadTicketsCount = props.getClientUnreadTicketsCount;
  const getAgentUnreadTicketsCount = props.getAgentUnreadTicketsCount;
  const currentUser = () => props.currentUser;
  const currentUserOrgId = () => props.currentUserOrgId;
  const showNotification = props.showNotification;
  const handleLogout = props.handleLogout;
  const setProfileActiveTab = props.setProfileActiveTab;
  const setProfileModalOpen = props.setProfileModalOpen;
  return (
    <aside class="hidden md:flex w-full md:w-64 md:h-full bg-white dark:bg-slate-900 flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 shrink-0">
      {/* Header Panel (Logo & Mobile Toggle Button) */}
      <div class="p-4 md:p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 md:border-b-0 shrink-0">
        <div class="flex items-center gap-3 text-slate-900 dark:text-white font-bold text-lg md:text-xl tracking-tight">
          <img src={logo()} alt="LorryGuru Logo" width="32" height="32" class="h-8 w-auto shrink-0" />
          <span>LorryGuru</span>
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen())}
          class="md:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 cursor-pointer transition"
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen() ? (
            <X class="w-5 h-5" />
          ) : (
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          )}
        </button>
      </div>

      {/* Collapsible Content Area */}
      <div class={`${isMobileMenuOpen() ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-h-0 overflow-hidden`}>
        {/* Navigation Items */}
        <div class="p-6 pt-4 md:p-6 md:pt-0 flex-1 flex flex-col min-h-0 overflow-hidden">
          <nav class="space-y-1 flex-1 overflow-y-auto pr-1">
            <button
              id="tab-btn-dashboard"
              onClick={() => selectTab('DASHBOARD')}
              class={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'DASHBOARD'
                ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                }`}
            >
              <BarChart3 class="w-4 h-4" />
              <span>{t('nav.dashboard', 'Dashboard')}</span>
            </button>
            {currentUserRights()?.canViewTrips && (
              <button
                id="tab-btn-trips"
                onClick={() => selectTab('TRIPS')}
                class={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'TRIPS'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <BookOpen class="w-4 h-4" />
                <span>{t('nav.trips', 'Trip Management')}</span>
              </button>
            )}
            {currentUserRights()?.canViewTrucks && (
              <button
                id="tab-btn-trucks"
                onClick={() => selectTab('TRUCKS')}
                class={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'TRUCKS'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <TruckIcon class="w-4 h-4" />
                <span>{t('nav.trucks', 'Truck Registry')}</span>
              </button>
            )}
            {currentUserRights()?.canViewOffices && (
              <button
                id="tab-btn-offices"
                onClick={() => selectTab('OFFICES')}
                class={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'OFFICES'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <MapPin class="w-4 h-4" />
                <span>{t('nav.offices', 'Offices')}</span>
              </button>
            )}
            {currentUserRights()?.canViewAccounts && (
              <button
                id="tab-btn-accounts"
                onClick={() => selectTab('ACCOUNTS')}
                class={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'ACCOUNTS'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <Coins class="w-4 h-4" />
                <span>{t('nav.accounts', 'Account Ledger')}</span>
              </button>
            )}
            {currentUserRights()?.canViewDrivers && (
              <button
                id="tab-btn-drivers"
                onClick={() => selectTab('DRIVERS')}
                class={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'DRIVERS'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <UserCheck class="w-4 h-4" />
                <span>{t('nav.drivers', 'Driver Master')}</span>
              </button>
            )}
            {currentUserRights()?.canViewExpenses && (
              <button
                id="tab-btn-expenses"
                onClick={() => selectTab('EXPENSES')}
                class={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'EXPENSES'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <FileSpreadsheet class="w-4 h-4" />
                <span>{t('nav.expenses', 'Expense Ledger')}</span>
              </button>
            )}
            {(currentUserRights()?.isAdmin || currentUserRights()?.isSuperAdmin) && (
              <button
                id="tab-btn-billing"
                onClick={() => selectTab('BILLING')}
                class={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'BILLING'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <Receipt class="w-4 h-4" />
                <span>{t('nav.billing', 'Billing & Invoices')}</span>
              </button>
            )}
            {currentUserRights()?.canViewTrips && (
              <button
                id="tab-btn-reports"
                onClick={() => selectTab('REPORTS')}
                class={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'REPORTS'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <FileText class="w-4 h-4" />
                <span>{t('nav.reports', 'Monthly Reports')}</span>
              </button>
            )}
            {currentUserRights()?.isAdmin && (
              <button
                id="tab-btn-audit"
                onClick={() => selectTab('AUDIT')}
                class={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'AUDIT'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <History class="w-4 h-4" />
                <span>{t('nav.audit', 'System Audit Logs')}</span>
              </button>
            )}
            {currentUserRights()?.canViewTyres && (
              <button
                id="tab-btn-tyres"
                onClick={() => selectTab('TYRES')}
                class={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'TYRES'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <Disc class="w-4 h-4" />
                <span>{t('nav.tyres', 'Tyre Ledger & ODO')}</span>
              </button>
            )}
            {hasUsersTabAccess() && (
              <button
                id="tab-btn-users"
                onClick={() => selectTab('USERS')}
                class={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'USERS'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <Users class="w-4 h-4" />
                <span>{t('nav.users', 'Access Control')}</span>
              </button>
            )}

            {!isBackendTeam() && (
              <button
                id="tab-btn-support-direct"
                onClick={() => {
                  setProfileActiveTab('SUPPORT');
                  setProfileModalOpen(true);
                }}
                class="w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40"
              >
                <div class="flex items-center gap-3">
                  <MessageSquare class="w-4 h-4 text-slate-400" />
                  <span>Support Center</span>
                </div>
                {getClientUnreadTicketsCount() > 0 && (
                  <span class="flex items-center justify-center bg-rose-500 text-white rounded-full text-[9px] px-1.5 min-w-[16px] h-4 font-sans font-bold leading-none animate-pulse">
                    {getClientUnreadTicketsCount()}
                  </span>
                )}
              </button>
            )}
            {(currentUserRights()?.isSuperAdmin || currentUserOrgId() === 'org_backend') && (
              <button
                id="tab-btn-backend"
                onClick={() => selectTab('BACKEND')}
                class={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-all rounded-lg font-medium duration-150 ${activeTab() === 'BACKEND'
                  ? 'bg-purple-50 dark:bg-purple-650/10 text-purple-650 dark:text-purple-400 font-semibold border-l-2 border-purple-500 pl-2.5'
                  : 'text-slate-655 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
              >
                <div class="flex items-center gap-3">
                  <Settings class="w-4 h-4 text-purple-500" />
                  <span>Backend Dashboard</span>
                </div>
                {getAgentUnreadTicketsCount() > 0 && (
                  <span class="flex items-center justify-center bg-rose-500 text-white rounded-full text-[9px] px-1.5 min-w-[16px] h-4 font-sans font-bold leading-none animate-pulse">
                    {getAgentUnreadTicketsCount()}
                  </span>
                )}
              </button>
            )}
          </nav>
        </div>

        {/* User Profile Info Footer Panel */}
        <div class="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-855 space-y-3 shrink-0">
          <div>
            <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1 px-1">Logged in as</div>
            <div class="text-xs text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2 px-1 truncate" title={currentUser()?.email || currentUser()?.name || 'User'}>
              <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0"></span>
              <span class="truncate">{currentUser()?.name || currentUser()?.email || 'Logistics Admin'}</span>
            </div>
          </div>
          {currentUserOrgId() && (
            <div class="flex items-center justify-between bg-slate-150 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400">
              <span class="truncate font-semibold select-all" title={currentUserOrgId()}>Org: {currentUserOrgId()}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentUserOrgId());
                  showNotification("Organization ID copied to clipboard!");
                }}
                class="text-slate-555 hover:text-slate-900 dark:hover:text-white transition-colors p-0.5 shrink-0 ml-1.5 cursor-pointer"
                title="Copy Organization ID"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={handleLogout}
            class="w-full flex items-center justify-center gap-2 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-660 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <LogOut class="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
