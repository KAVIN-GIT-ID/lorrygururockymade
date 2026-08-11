import { onMount, createSignal, lazy, Suspense, mergeProps } from 'solid-js';
import { useTripsContext } from '../context/TripContext';
import { useTrucksContext } from '../context/TruckContext';
import { useDriversContext } from '../context/DriverContext';
import { useExpensesContext } from '../context/ExpenseContext';
import { useOfficesContext } from '../context/OfficeContext';
import { useAccountsContext } from '../context/AccountContext';
import { useTyresContext } from '../context/TyreContext';
import { useAuditLogsContext } from '../context/AuditLogContext';
import { Truck, TripEntry, ExpenseEntry, AuditLog, UserPermission, OrganizationProfile } from '../types';
import { CheckCircle, Bell, Sun, Moon, Plus, Loader, AlertCircle } from 'lucide-solid';
import MobileBottomTabBar from './MobileBottomTabBar';

const MobileHomeTab = lazy(() => import('./MobileHomeTab'));
const MobileAccountTab = lazy(() => import('./MobileAccountTab'));
const MobileTripsTab = lazy(() => import('./MobileTripsTab'));
const MobileOutstandingView = lazy(() => import('./MobileOutstandingView'));

const TripList = lazy(() => import('./TripList'));
const TruckMaster = lazy(() => import('./TruckMaster'));
const DriverMaster = lazy(() => import('./DriverMaster'));
const ExpenseMaster = lazy(() => import('./ExpenseMaster'));
const TyreMaster = lazy(() => import('./TyreMaster'));
const OfficeMaster = lazy(() => import('./OfficeMaster'));
const AccountMaster = lazy(() => import('./AccountMaster'));
const MonthlyReport = lazy(() => import('./MonthlyReport'));
const AuditLogView = lazy(() => import('./AuditLogView'));

const LoadingTab = () => (
  <div class="flex items-center justify-center p-12 h-64">
    <Loader class="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

interface MobileViewportProps {
  logo: any;
  toastMessage: () => string | null;
  notificationOpen: () => boolean;
  setNotificationOpen: (open: boolean) => void;
  setProfileDropdownOpen: (open: boolean) => void;
  updateLastReadNotificationTime: (time: number) => void;
  currentUser: () => any;
  hasUnreadNotifications: () => boolean;
   orgAuditLogs?: AuditLog[];
  currentUserRights: () => any;
  currentUserOrgId: string;
  mobileTab: () => 'HOME' | 'TRIPS' | 'REGISTRY' | 'ACCOUNT';
  setMobileTab: (tab: any) => void;
  registrySubTab: () => string;
  setRegistrySubTab: (tab: string) => void;
   orgTrips?: TripEntry[];
   orgTrucks?: Truck[];
   orgDrivers?: any[];
   approvedOrgTrucks?: Truck[];
   orgOffices?: any[];
   orgAccounts?: any[];
  currentOrgProfile: OrganizationProfile | undefined;
   orgExpenses?: ExpenseEntry[];
   orgTyres?: any[];
   auditLogs?: AuditLog[];
   handleClearAuditLogs?: () => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
  organizationProfiles?: () => OrganizationProfile[];
   addTruck?: (truck: any) => Promise<any>;
   updateTruck?: (truck: any) => Promise<any>;
   deleteTruck?: (truckId: string) => Promise<any>;
   handleAddTruckRequest?: (req: any) => Promise<any>;
  handleServiceDone: (opts: any) => Promise<any>;
   addExpense?: (expense: any) => Promise<any>;
   handleProcessTruckPayment?: (truckPayload: Omit<Truck, 'id'>, paymentDetails: any, existingTruckId?: string | null) => Promise<any>;
   addDriver?: (driver: any) => Promise<any>;
   updateDriver?: (driver: any) => Promise<any>;
   deleteDriver?: (driverId: string) => Promise<any>;
   saveTrips?: (trips: any[]) => void;
   updateExpense?: (expense: any) => Promise<any>;
   deleteExpense?: (expenseId: string) => Promise<any>;
   addTyre?: (tyre: any) => Promise<any>;
   updateTyre?: (tyre: any) => Promise<any>;
   deleteTyre?: (tyreId: string) => Promise<any>;
   addOffice?: (office: any) => Promise<any>;
   updateOffice?: (office: any) => Promise<any>;
   deleteOffice?: (officeId: string) => Promise<any>;
   addAccount?: (account: any) => Promise<any>;
   updateAccount?: (account: any) => Promise<any>;
   deleteAccount?: (accountId: string) => Promise<any>;
  theme: () => 'light' | 'dark';
  setTheme: (theme: any) => void;
  isOnline: boolean;
  handleLogout: () => void;
  setProfileActiveTab: (tab: 'SETTINGS' | 'SUPPORT') => void;
  setProfileModalOpen: (open: boolean) => void;
  setSetup2FAOpen: (open: boolean) => void;
  setDisable2FAOpen: (open: boolean) => void;
  getClientUnreadTicketsCount: () => number;
  showNotification: (msg: string) => void;
  appVersion: string;
  setEditingTrip: (trip: any) => void;
  setBookingModalOpen: (open: boolean) => void;
  setIsVoiceAssistantOpen: (open: boolean) => void;
  setNotificationRef: (el: HTMLDivElement | undefined) => void;
  dashboardTrips: () => TripEntry[];
  dashboardExpenses: () => ExpenseEntry[];
  activeMonth: () => string;
  activeYear: () => string;
  setActiveMonth: (month: string) => void;
  setActiveYear: (year: string) => void;
  handleEditTripTrigger: (trip: any) => void;
  deleteTripEntry: (tripId: string) => Promise<any>;
}

export default function MobileViewport(rawProps: MobileViewportProps) {
  onMount(() => {
    console.log("MobileViewport mounted");
  });
  const tripsCtx = useTripsContext();
  const trucksCtx = useTrucksContext();
  const driversCtx = useDriversContext();
  const expenseCtx = useExpensesContext();
  const officeCtx = useOfficesContext();
  const accountCtx = useAccountsContext();
  const tyreCtx = useTyresContext();
  const auditLogsCtx = useAuditLogsContext();

  const props = mergeProps(rawProps, {
    get orgTrips() { return tripsCtx.orgTrips(); },
    get orgTrucks() { return trucksCtx.orgTrucks(); },
    get approvedOrgTrucks() { return trucksCtx.approvedOrgTrucks(); },
    get orgDrivers() { return driversCtx.orgDrivers(); },
    get orgExpenses() { return expenseCtx.orgExpenses(); },
    get orgOffices() { return officeCtx.orgOffices(); },
    get orgAccounts() { return accountCtx.orgAccounts(); },
    get orgTyres() { return tyreCtx.orgTyres(); },
    get orgAuditLogs() { return auditLogsCtx.orgAuditLogs(); },
    get trips() { return () => tripsCtx.trips; },
    get trucks() { return () => trucksCtx.trucks; },
    get drivers() { return () => driversCtx.drivers; },
    get expenses() { return () => expenseCtx.expenses; },
    get offices() { return () => officeCtx.offices; },
    get accounts() { return () => accountCtx.accounts; },
    get tyres() { return () => tyreCtx.tyres; },
    get auditLogs() { return auditLogsCtx.auditLogs; },
    
    saveTrips: tripsCtx.saveTrips,
    deleteTripEntry: tripsCtx.deleteTripEntry,
    
    addTruck: trucksCtx.addTruck,
    updateTruck: trucksCtx.updateTruck,
    deleteTruck: trucksCtx.deleteTruck,
    handleAddTruckRequest: trucksCtx.handleAddTruckRequest,
    handleServiceDone: rawProps.handleServiceDone,
    handleProcessTruckPayment: trucksCtx.handleProcessTruckPayment,
    saveTrucks: trucksCtx.saveTrucks,

    addDriver: driversCtx.addDriver,
    updateDriver: driversCtx.updateDriver,
    deleteDriver: driversCtx.deleteDriver,
    saveDrivers: driversCtx.saveDrivers,

    addExpense: expenseCtx.addExpense,
    updateExpense: expenseCtx.updateExpense,
    deleteExpense: expenseCtx.deleteExpense,
    saveExpenses: expenseCtx.saveExpenses,

    addOffice: officeCtx.addOffice,
    updateOffice: officeCtx.updateOffice,
    deleteOffice: officeCtx.deleteOffice,
    saveOffices: officeCtx.saveOffices,

    addAccount: accountCtx.addAccount,
    updateAccount: accountCtx.updateAccount,
    deleteAccount: accountCtx.deleteAccount,
    saveAccounts: accountCtx.saveAccounts,

    addTyre: tyreCtx.addTyre,
    updateTyre: tyreCtx.updateTyre,
    deleteTyre: tyreCtx.deleteTyre,
    saveTyres: tyreCtx.saveTyres,

    saveAuditLogs: auditLogsCtx.saveAuditLogs,
    logAction: auditLogsCtx.logAction,
    handleClearAuditLogs: auditLogsCtx.handleClearAuditLogs
  });
  const [touchStart, setTouchStart] = createSignal<number | null>(null);
  let prevTabIdxRef = 0;

  const handleTouchStart = (e: TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStart() === null) return;
    const diff = touchStart()! - e.changedTouches[0].clientX;
    const threshold = 50;
    if (Math.abs(diff) > threshold) {
      const tabs = ['TRUCKS', 'DRIVERS', 'EXPENSES', 'OUTSTANDING', 'REPORTS', 'TYRES', 'OFFICES', 'ACCOUNTS', 'AUDIT'];
      const curIdx = tabs.indexOf(props.registrySubTab());
      if (diff > 0 && curIdx < tabs.length - 1) {
        props.setRegistrySubTab(tabs[curIdx + 1]);
      } else if (diff < 0 && curIdx > 0) {
        props.setRegistrySubTab(tabs[curIdx - 1]);
      }
    }
    setTouchStart(null);
  };

  const [fabOpened, setFabOpened] = createSignal(false);
  const [autoOpenFormTab, setAutoOpenFormTab] = createSignal<string | null>(null);

  const triggerOpenAddForm = (tabId: string) => {
    setAutoOpenFormTab(tabId);
    setFabOpened(false);
  };

  const tabsList = ['TRUCKS', 'DRIVERS', 'EXPENSES', 'OUTSTANDING', 'REPORTS', 'TYRES', 'OFFICES', 'ACCOUNTS', 'AUDIT'];
  const currentTabIdx = () => tabsList.indexOf(props.registrySubTab());
  const isSlideRight = () => {
    const idx = currentTabIdx();
    const right = idx > prevTabIdxRef;
    prevTabIdxRef = idx;
    return right;
  };
  const slideClassName = () => isSlideRight() ? 'animate-slide-in-right' : 'animate-slide-in-left';

  return (
    <div class="h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans overflow-hidden select-none">

      {/* Dynamic Mobile Header */}
      <div class="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 p-4 shrink-0 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <img src={props.logo} alt="LorryGuru Logo" class="h-7 w-auto" />
          <span class="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">LorryGuru</span>
        </div>
        <div class="flex items-center gap-2.5">
          <div ref={props.setNotificationRef} class="relative">
            <button
              id="btn-notifications-toggle-mobile"
              onClick={() => {
                props.setNotificationOpen(!props.notificationOpen());
                props.setProfileDropdownOpen(false);
                const now = Date.now();
                props.updateLastReadNotificationTime(now);
                if (props.currentUser()) {
                  const key = `ttt_last_read_notifications_${(props.currentUser()!.email || '').toLowerCase().trim()}`;
                  localStorage.setItem(key, now.toString());
                }
              }}
              class="text-slate-500 hover:text-slate-900 dark:hover:text-white transition p-1.5 cursor-pointer relative flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Notifications"
            >
              <Bell class="w-4 h-4" />
              {props.hasUnreadNotifications() && (
                <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse" />
              )}
            </button>

            {props.notificationOpen() && (
              <div class="
                fixed left-3 right-3 top-16
                bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800
                text-slate-800 dark:text-slate-100 rounded-xl shadow-2xl z-50 p-4 space-y-3 animate-fade-in text-left
              ">
                <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Recent Activity Logs</span>
                  <button
                    onClick={() => props.setNotificationOpen(false)}
                    class="text-slate-400 dark:text-slate-500 hover:text-slate-655 dark:hover:text-slate-350 text-xs p-1 font-bold"
                  >
                    ✕
                  </button>
                </div>
                <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {props.orgAuditLogs.length === 0 ? (
                    <p class="text-center py-6 text-xs text-slate-400 dark:text-slate-500 italic">No recent activities logged.</p>
                  ) : (
                    props.orgAuditLogs.slice(0, 8).map((log) => (
                      <div class="text-[11px] p-2 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-100 dark:border-slate-850 space-y-1">
                        <div class="flex justify-between items-center">
                          <span class={`font-extrabold uppercase text-[9px] px-1.5 py-0.5 rounded ${log.action === 'Approved' ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50' :
                            log.action === 'Rejected' ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50' :
                              log.action === 'Created' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-150 dark:border-blue-900/50' :
                                log.action === 'Deleted' ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-150 dark:border-red-900/50' :
                                  log.action === 'Edited' ? 'bg-amber-50 dark:bg-amber-955/30 text-amber-700 dark:text-amber-400 border border-amber-150 dark:border-amber-900/50' :
                                    'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200'
                            }`}>
                            {log.action}
                          </span>
                          <span class="text-[9px] text-slate-400 dark:text-slate-500 font-mono font-medium">{(log.timestamp || '').substring(11, 16)}</span>
                        </div>
                        <p class="text-slate-700 dark:text-slate-300 leading-tight">
                          <strong class="text-slate-900 dark:text-white">{log.category} ({log.reference}):</strong> {log.details}
                        </p>
                        <p class="text-[9px] text-slate-400 dark:text-slate-500">By {log.user}</p>
                      </div>
                    ))
                  )}
                </div>
                {props.orgAuditLogs.length > 0 && props.currentUserRights().isAdmin && (
                  <button
                    onClick={() => {
                      props.setMobileTab('REGISTRY');
                      props.setRegistrySubTab('AUDIT');
                      props.setNotificationOpen(false);
                    }}
                    class="w-full text-center text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline pt-1 block border-t border-slate-100 dark:border-slate-800"
                  >
                    View Full Audit Trail
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => props.setTheme(props.theme() === 'dark' ? 'light' : 'dark')}
            class="text-slate-500 hover:text-slate-900 dark:hover:text-white transition p-1 cursor-pointer"
          >
            {props.theme() === 'dark' ? <Sun class="w-4 h-4" /> : <Moon class="w-4 h-4" />}
          </button>
          <span class={`w-2.5 h-2.5 rounded-full ${props.isOnline ? 'bg-green-500' : 'bg-rose-500 animate-pulse'}`}></span>
        </div>
      </div>

      {/* Mobile Viewport / Tab Content */}
      <div class="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-50 dark:bg-slate-955">
        <Suspense fallback={<LoadingTab />}>
          {props.mobileTab() === 'HOME' && (
            <MobileHomeTab
              currentUser={props.currentUser()}
              orgTrips={props.orgTrips}
              orgTrucks={props.orgTrucks}
              orgDrivers={props.orgDrivers}
              setActiveTab={props.setMobileTab}
              onNavigateToSubTab={(sub) => {
                props.setMobileTab('REGISTRY');
                props.setRegistrySubTab(sub);
              }}
              onQuickAction={(action) => {
                if (action === 'ADD_TRIP') {
                  props.setEditingTrip(null);
                  props.setBookingModalOpen(true);
                } else if (action === 'ADD_EXPENSE') {
                  props.setMobileTab('REGISTRY');
                  props.setRegistrySubTab('EXPENSES');
                } else if (action === 'VOICE') {
                  props.setIsVoiceAssistantOpen(true);
                }
              }}
            />
          )}

          {props.mobileTab() === 'TRIPS' && (
            <div class="flex-1 overflow-y-auto pb-20">
              <MobileTripsTab
                trips={props.orgTrips || []}
                trucks={props.approvedOrgTrucks || []}
                drivers={props.orgDrivers || []}
                accounts={props.orgAccounts || []}
                onSelectTrip={props.handleEditTripTrigger}
                onOpenQuickDispatch={() => {
                  props.setEditingTrip(null);
                  props.setBookingModalOpen(true);
                }}
                onSaveTrips={tripsCtx.saveTrips}
              />
            </div>
          )}

          {props.mobileTab() === 'REGISTRY' && (
            <div class="flex-1 overflow-hidden flex flex-col pb-20 relative">
              {/* Scrollable Sub-Tab Bar for Registry Lists */}
              <div class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-1.5 shrink-0">
                {[
                  { id: 'TRUCKS', label: 'Trucks' },
                  { id: 'DRIVERS', label: 'Drivers' },
                  { id: 'EXPENSES', label: 'Expenses' },
                  { id: 'OUTSTANDING', label: 'Outstanding' },
                  { id: 'REPORTS', label: 'Reports' },
                  { id: 'TYRES', label: 'Tyres' },
                  { id: 'OFFICES', label: 'Offices' },
                  { id: 'ACCOUNTS', label: 'Accounts' },
                  { id: 'AUDIT', label: 'Audit Logs' }
                ].map((tab) => (
                  <button
                    onClick={() => props.setRegistrySubTab(tab.id)}
                    class={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      props.registrySubTab() === tab.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sub-Tab Viewport Content */}
              <div
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                class={`flex-1 overflow-y-auto p-4 space-y-4 ${slideClassName()}`}
              >
                {props.registrySubTab() === 'TRUCKS' && (
                  <TruckMaster
                    trucks={props.orgTrucks}
                    trips={props.orgTrips}
                    expenses={props.orgExpenses}
                    onAddTruck={props.addTruck}
                    onUpdateTruck={props.updateTruck}
                    onDeleteTruck={props.deleteTruck}
                    confirmAction={props.confirmAction}
                    canViewTrucks={props.currentUserRights().canViewTrucks}
                    canEditTrucks={props.currentUserRights().canEditTrucks}
                    canDeleteTrucks={props.currentUserRights().canDeleteTrucks}
                    maxTrucksAllowed={props.currentOrgProfile?.maxTrucksAllowed || 2}
                    onAddTruckRequest={props.handleAddTruckRequest}
                    organizationId={props.currentUserOrgId}
                    orgProfile={props.currentOrgProfile}
                    onServiceDone={(props.currentUserRights().canEditTrucks || props.currentUserRights().canEditExpenses) ? props.handleServiceDone : undefined}
                    accounts={props.orgAccounts}
                    drivers={props.orgDrivers}
                    onAddExpense={props.addExpense}
                    canEditLoans={props.currentUserRights().canEditLoans !== false}
                    canDeleteLoans={props.currentUserRights().canDeleteLoans !== false}
                    canEditExpenses={props.currentUserRights().canEditExpenses !== false}
                    currentUserEmail={props.currentUser()?.email || ''}
                    currentUserName={props.currentUser()?.name || ''}
                    currentUserPhone={props.currentUser()?.phone || ''}
                    onProcessTruckPayment={props.handleProcessTruckPayment}
                    autoOpenAdd={autoOpenFormTab() === 'TRUCKS'}
                    onAutoOpenCleared={() => setAutoOpenFormTab(null)}
                  />
                )}
                {props.registrySubTab() === 'DRIVERS' && (
                  <DriverMaster
                    drivers={props.orgDrivers}
                    trips={props.orgTrips}
                    expenses={props.orgExpenses}
                    accounts={props.orgAccounts}
                    onAddDriver={props.addDriver}
                    onUpdateDriver={props.updateDriver}
                    onDeleteDriver={props.deleteDriver}
                    canViewDrivers={props.currentUserRights().canViewDrivers}
                    canEditDrivers={props.currentUserRights().canEditDrivers}
                    canDeleteDrivers={props.currentUserRights().canDeleteDrivers}
                    organizationId={props.currentUserOrgId}
                    orgProfile={props.currentOrgProfile}
                    autoOpenAdd={autoOpenFormTab() === 'DRIVERS'}
                    onAutoOpenCleared={() => setAutoOpenFormTab(null)}
                    onSaveTrips={props.saveTrips}
                    confirmAction={props.confirmAction}
                  />
                )}
                {props.registrySubTab() === 'EXPENSES' && (
                  <ExpenseMaster
                    expenses={props.orgExpenses}
                    trucks={props.approvedOrgTrucks}
                    accounts={props.orgAccounts}
                    drivers={props.orgDrivers}
                    onAddExpense={props.addExpense}
                    onUpdateExpense={props.updateExpense}
                    onDeleteExpense={props.deleteExpense}
                    canViewExpenses={props.currentUserRights().canViewExpenses}
                    canEditExpenses={props.currentUserRights().canEditExpenses}
                    canDeleteExpenses={props.currentUserRights().canDeleteExpenses}
                    organizationId={props.currentUserOrgId}
                    autoOpenAdd={autoOpenFormTab() === 'EXPENSES'}
                    onAutoOpenCleared={() => setAutoOpenFormTab(null)}
                    orgProfile={props.currentOrgProfile}
                  />
                )}
                {props.registrySubTab() === 'OUTSTANDING' && (
                  <MobileOutstandingView
                    trips={props.orgTrips}
                    trucks={props.approvedOrgTrucks}
                    offices={props.orgOffices}
                    accounts={props.orgAccounts}
                    orgProfile={props.currentOrgProfile}
                    expenses={props.orgExpenses}
                    onSaveTrips={props.saveTrips}
                  />
                )}
                {props.registrySubTab() === 'REPORTS' && (
                  <MonthlyReport
                    trips={props.dashboardTrips()}
                    trucks={props.approvedOrgTrucks}
                    expenses={props.dashboardExpenses()}
                    selectedMonth={props.activeMonth()}
                    selectedYear={props.activeYear()}
                    setSelectedMonth={props.setActiveMonth}
                    setSelectedYear={props.setActiveYear}
                  />
                )}
                {props.registrySubTab() === 'TYRES' && (
                  <TyreMaster
                    tyres={props.orgTyres}
                    trucks={props.approvedOrgTrucks}
                    accounts={props.orgAccounts}
                    onAddTyre={props.addTyre}
                    onUpdateTyre={props.updateTyre}
                    onDeleteTyre={props.deleteTyre}
                    confirmAction={props.confirmAction}
                    canViewTyres={props.currentUserRights().canViewTyres}
                    canEditTyres={props.currentUserRights().canEditTyres}
                    canDeleteTyres={props.currentUserRights().canDeleteTyres}
                    organizationId={props.currentUserOrgId}
                    autoOpenAdd={autoOpenFormTab() === 'TYRES'}
                    onAutoOpenCleared={() => setAutoOpenFormTab(null)}
                  />
                )}
                {props.registrySubTab() === 'OFFICES' && (
                  <OfficeMaster
                    offices={props.orgOffices}
                    onAddOffice={props.addOffice}
                    onUpdateOffice={props.updateOffice}
                    onDeleteOffice={props.deleteOffice}
                    confirmAction={props.confirmAction}
                    canViewOffices={props.currentUserRights().canViewOffices}
                    canEditOffices={props.currentUserRights().canEditOffices}
                    canDeleteOffices={props.currentUserRights().canDeleteOffices}
                  />
                )}
                {props.registrySubTab() === 'ACCOUNTS' && (
                  <AccountMaster
                    accounts={props.orgAccounts}
                    onAddAccount={props.addAccount}
                    onUpdateAccount={props.updateAccount}
                    onDeleteAccount={props.deleteAccount}
                    confirmAction={props.confirmAction}
                    canViewAccounts={props.currentUserRights().canViewAccounts}
                    canEditAccounts={props.currentUserRights().canEditAccounts}
                    canDeleteAccounts={props.currentUserRights().canDeleteAccounts}
                  />
                )}
                {props.registrySubTab() === 'AUDIT' && (
                  <AuditLogView
                    logs={props.currentUserOrgId === 'org_backend' ? props.auditLogs : props.orgAuditLogs}
                    onClearLogs={props.handleClearAuditLogs}
                    confirmAction={props.confirmAction}
                    organizationProfiles={props.organizationProfiles()}
                    currentUserOrgId={props.currentUserOrgId}
                  />
                )}
              </div>

              {/* Custom Floating Action Button (FAB) */}
              {fabOpened() && (
                <div
                  class="fixed inset-0 bg-slate-950/35 backdrop-blur-3xs z-30 transition-opacity animate-fade-in"
                  onClick={() => setFabOpened(false)}
                />
              )}

              <div class="absolute bottom-24 right-6 z-40 flex flex-col items-end">
                {fabOpened() && (
                  <div class="flex flex-col items-end gap-3 mb-4 animate-scale-up origin-bottom">
                    {[
                      { id: 'TRUCKS', label: 'Add Truck', icon: <Plus class="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> },
                      { id: 'DRIVERS', label: 'Add Driver', icon: <Plus class="w-4 h-4 text-blue-600 dark:text-blue-400" /> },
                      { id: 'EXPENSES', label: 'Register Expense', icon: <Plus class="w-4 h-4 text-purple-600 dark:text-purple-400" /> },
                      { id: 'TYRES', label: 'Register Tyre', icon: <Plus class="w-4 h-4 text-amber-600 dark:text-amber-400" /> },
                      { id: 'OFFICES', label: 'Add Office', icon: <Plus class="w-4 h-4 text-rose-600 dark:text-rose-400" /> },
                      { id: 'ACCOUNTS', label: 'Add Account', icon: <Plus class="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> }
                    ].map((act) => (
                      <div
                        class="flex items-center gap-3 cursor-pointer group active:scale-95 transition-transform"
                        onClick={() => triggerOpenAddForm(act.id)}
                      >
                        <span class="bg-slate-900/80 dark:bg-slate-955/90 backdrop-blur-xs text-white text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-md transition transform group-hover:-translate-x-1 uppercase tracking-wider select-none">
                          {act.label}
                        </span>
                        <div class="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center transition hover:bg-slate-50 dark:hover:bg-slate-750">
                          {act.icon}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setFabOpened(!fabOpened())}
                  class={`w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xl flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer ${
                    fabOpened() ? 'rotate-135 bg-gradient-to-tr from-rose-650 to-red-500' : ''
                  }`}
                  title="Quick Actions"
                >
                  <Plus class="w-6 h-6 transition-transform duration-300" />
                </button>
              </div>
            </div>
          )}

          {props.mobileTab() === 'ACCOUNT' && (
            <MobileAccountTab
              currentUser={props.currentUser()}
              currentUserOrgId={props.currentUserOrgId}
              currentUserRights={props.currentUserRights() as any}
              theme={props.theme()}
              setTheme={props.setTheme}
              handleLogout={props.handleLogout}
              setProfileActiveTab={props.setProfileActiveTab}
              setProfileModalOpen={props.setProfileModalOpen}
              setSetup2FAOpen={props.setSetup2FAOpen}
              setDisable2FAOpen={props.setDisable2FAOpen}
              clientUnreadCount={props.getClientUnreadTicketsCount()}
              showNotification={props.showNotification}
              appVersion={props.appVersion}
            />
          )}
        </Suspense>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomTabBar
        activeTab={props.mobileTab()}
        setActiveTab={props.setMobileTab}
        clientUnreadCount={props.getClientUnreadTicketsCount()}
      />
    </div>
  );
}
