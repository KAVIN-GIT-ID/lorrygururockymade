import { onMount, lazy, Suspense, mergeProps } from 'solid-js';
import { useTripsContext } from '../context/TripContext';
import { useTrucksContext } from '../context/TruckContext';
import { useDriversContext } from '../context/DriverContext';
import { useExpensesContext } from '../context/ExpenseContext';
import { useOfficesContext } from '../context/OfficeContext';
import { useAccountsContext } from '../context/AccountContext';
import { useTyresContext } from '../context/TyreContext';
import { useAuditLogsContext } from '../context/AuditLogContext';
import { Truck, TripEntry, ExpenseEntry, AuditLog, UserPermission, OrganizationProfile } from '../types';
import { AlertCircle, Loader } from 'lucide-solid';

const Dashboard = lazy(() => import('./Dashboard'));
const TripList = lazy(() => import('./TripList'));
const TruckMaster = lazy(() => import('./TruckMaster'));
const DriverMaster = lazy(() => import('./DriverMaster'));
const OfficeMaster = lazy(() => import('./OfficeMaster'));
const AccountMaster = lazy(() => import('./AccountMaster'));
const ExpenseMaster = lazy(() => import('./ExpenseMaster'));
const MonthlyReport = lazy(() => import('./MonthlyReport'));
const AuditLogView = lazy(() => import('./AuditLogView'));
const TyreMaster = lazy(() => import('./TyreMaster'));
const BillingHistory = lazy(() => import('./BillingHistory'));
const UserAccessControl = lazy(() => import('./UserAccessControl'));

const isMobileTarget = import.meta.env.VITE_BUILD_TARGET === 'mobile';
const BackendDashboard = isMobileTarget
  ? () => null
  : lazy(() => import('./BackendDashboard'));

const LoadingTab = () => (
  <div class="flex items-center justify-center p-12 h-64">
    <Loader class="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

interface DesktopViewportProps {
  activeTab: () => string;
  currentUserRights: () => any;
  currentUserOrgId: string;
  currentUser: () => any;
  currentOrgProfile: OrganizationProfile | undefined;
   orgTrips?: TripEntry[];
   orgTrucks?: Truck[];
   orgOffices?: any[];
   orgAccounts?: any[];
   approvedOrgTrucks?: Truck[];
   orgDrivers?: any[];
   orgExpenses?: ExpenseEntry[];
   orgTyres?: any[];
   orgAuditLogs?: AuditLog[];
   auditLogs?: () => AuditLog[];
   drivers?: () => any[];
   offices?: () => any[];
   accounts?: () => any[];
   trips?: () => any[];
   expenses?: () => any[];
   tyres?: () => any[];
   trucks?: () => Truck[];
  userRightsList: () => UserPermission[];
  supportTickets: () => any[];
  activeTicketId: () => string;
  payments: () => any[];
  appUpdateConfig: () => any;
  dashboardTrips: () => TripEntry[];
  dashboardExpenses: () => ExpenseEntry[];
  activeMonth: () => string;
  activeYear: () => string;
  setActiveMonth: (month: string) => void;
  setActiveYear: (year: string) => void;
   addExpense?: (expense: any) => Promise<any>;
   updateTruck?: (truck: any) => Promise<any>;
   saveTrips?: (trips: any[]) => void;
  handleEditTripTrigger: (trip: any) => void;
   deleteTripEntry?: (tripId: string) => Promise<any>;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
   addTruck?: (truck: any) => Promise<any>;
   deleteTruck?: (truckId: string) => Promise<any>;
   handleAddTruckRequest?: (req: any) => Promise<any>;
  handleServiceDone: (opts: any) => Promise<any>;
   handleProcessTruckPayment?: (truckPayload: Omit<Truck, 'id'>, paymentDetails: any, existingTruckId?: string | null) => Promise<any>;
   addOffice?: (office: any) => Promise<any>;
   updateOffice?: (office: any) => Promise<any>;
   deleteOffice?: (officeId: string) => Promise<any>;
   addAccount?: (account: any) => Promise<any>;
   updateAccount?: (account: any) => Promise<any>;
   deleteAccount?: (accountId: string) => Promise<any>;
   addDriver?: (driver: any) => Promise<any>;
   updateDriver?: (driver: any) => Promise<any>;
   deleteDriver?: (driverId: string) => Promise<any>;
   updateExpense?: (expense: any) => Promise<any>;
   deleteExpense?: (expenseId: string) => Promise<any>;
   handleClearAuditLogs?: () => void;
  organizationProfiles?: () => OrganizationProfile[];
   addTyre?: (tyre: any) => Promise<any>;
   updateTyre?: (tyre: any) => Promise<any>;
   deleteTyre?: (tyreId: string) => Promise<any>;
  handleUpdateOrgStatus: (orgId: string, status: 'Active' | 'Disabled') => void;
  handleUpdateOrgLimit: (orgId: string, limit: number) => void;
  handleApproveTruckRequest: (orgId: string, requestId: string, truckNo: string, duration?: '1M' | '3M' | '6M' | '1Y') => void;
  handleRejectTruckRequest: (orgId: string, requestId: string, fallbackTruckNo?: string) => void;
  handleBackendUpdateTruck: (orgId: string, truck: Truck) => void;
   logAction?: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
   saveTrucks?: (trucks: any[]) => void;
   saveDrivers?: (drivers: any[]) => void;
   saveOffices?: (offices: any[]) => void;
   saveAccounts?: (accounts: any[]) => void;
   saveExpenses?: (expenses: any[]) => void;
   saveTyres?: (tyres: any[]) => void;
   saveAuditLogs?: (logs: any[]) => void;
  saveUserRightsListWithSync: (list: any[]) => void;
  saveOrganizationProfiles: (profiles: any[]) => Promise<void>;
  saveSupportTickets: (tickets: any[]) => void;
  setActiveTicketId: (ticketId: string | null) => void;
  handleInitiateRefund: (orgId: string, truckNo: string, paymentRecord: any) => Promise<void>;
  handleSaveAppUpdateConfig: (config: any) => Promise<void>;
  orgUserRights: () => UserPermission[];
  handleAddPermission: (newPerm: Omit<UserPermission, 'id'>, showNotification: (msg: string) => void, logAction: (action: string, cat: string, ref: string, detail: string) => void) => Promise<any>;
  handleUpdatePermission: (updated: UserPermission, showNotification: (msg: string) => void, logAction: (action: string, cat: string, ref: string, detail: string) => void, currentUserOrgId: string) => Promise<any>;
  handleDeletePermission: (id: string, showNotification: (msg: string) => void, logAction: (action: string, cat: string, ref: string, detail: string) => void, currentUserOrgId: string) => Promise<void>;
  teamMembers: () => any[];
  loadingTeamMembers: () => boolean;
  handleUpdateOrgProfile: (profile: any) => Promise<any>;
  hasUsersTabAccess: boolean;
  showNotification: (msg: string) => void;
}

export default function DesktopViewport(rawProps: DesktopViewportProps) {
  onMount(() => {
    console.log("DesktopViewport mounted");
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
    get auditLogs() { return () => auditLogsCtx.auditLogs; },
    
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
  return (
    <div id="app-viewport-container" class="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 space-y-6">
      <Suspense fallback={<LoadingTab />}>
        {/* WARNING BAR IF MASTERS INACTIVE */}
        {!props.currentUserRights().isSuperAdmin && (props.orgTrucks.length === 0 || props.orgOffices.length === 0 || props.orgAccounts.length === 0) && (
          <div id="safety-warning-banner" class="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-xs">
            <AlertCircle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div class="text-xs">
              <p class="font-bold text-amber-800">Prerequisites Required</p>
              <p class="text-slate-600 mt-1 leading-relaxed">
                Before recording any transaction logs, ensure you register at least <strong>1 operational Truck</strong>, <strong>1 active branch Office</strong>, and <strong>1 receiving Account Ledger</strong>. Go to their respective master database tabs above to populate the datasheets first.
              </p>
            </div>
          </div>
        )}

        {/* TAB RENDERING CONTROLS */}
        {props.activeTab() === 'DASHBOARD' && (() => {
          console.log("Dashboard route entered");
          return (
            <Dashboard
              trips={props.dashboardTrips()}
              allTrips={props.orgTrips}
              trucks={props.approvedOrgTrucks}
              offices={props.orgOffices}
              accounts={props.orgAccounts}
              currentUserRights={props.currentUserRights()}
              activeMonth={props.activeMonth()}
              activeYear={props.activeYear()}
              setActiveMonth={props.setActiveMonth}
              setActiveYear={props.setActiveYear}
              orgProfile={props.currentOrgProfile}
              expenses={props.orgExpenses}
              onAddExpense={props.addExpense}
              onUpdateTruck={props.updateTruck}
              onSaveTrips={props.saveTrips}
            />
          );
        })()}

        {props.activeTab() === 'TRIPS' && props.currentUserRights().canViewTrips && (
          <TripList
            trips={props.orgTrips}
            trucks={props.approvedOrgTrucks}
            offices={props.orgOffices}
            accounts={props.orgAccounts}
            onEditEntry={props.handleEditTripTrigger}
            onDeleteEntry={props.deleteTripEntry}
            confirmAction={props.confirmAction}
            canViewTrips={props.currentUserRights().canViewTrips}
            canEditTrips={props.currentUserRights().canEditTrips}
            canDeleteTrips={props.currentUserRights().canDeleteTrips}
            organizationId={props.currentUserOrgId}
            onSaveTrips={props.saveTrips}
            auditLogs={props.currentUserOrgId === 'org_backend' ? props.auditLogs() : props.orgAuditLogs}
            currentUserRights={props.currentUserRights()}
            orgProfile={props.currentOrgProfile}
          />
        )}

        {props.activeTab() === 'TRUCKS' && props.currentUserRights().canViewTrucks && (
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
          />
        )}

        {props.activeTab() === 'OFFICES' && props.currentUserRights().canViewOffices && (
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

        {props.activeTab() === 'ACCOUNTS' && props.currentUserRights().canViewAccounts && (
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

        {props.activeTab() === 'DRIVERS' && props.currentUserRights().canViewDrivers && (
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
            onSaveTrips={props.saveTrips}
            confirmAction={props.confirmAction}
          />
        )}

        {props.activeTab() === 'EXPENSES' && props.currentUserRights().canViewExpenses && (
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
            orgProfile={props.currentOrgProfile}
          />
        )}

        {props.activeTab() === 'REPORTS' && props.currentUserRights().canViewTrips && (
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

        {props.activeTab() === 'AUDIT' && props.currentUserRights().isAdmin && (
          <AuditLogView
            logs={props.currentUserOrgId === 'org_backend' ? props.auditLogs() : props.orgAuditLogs}
            onClearLogs={props.handleClearAuditLogs}
            confirmAction={props.confirmAction}
            organizationProfiles={props.organizationProfiles()}
            currentUserOrgId={props.currentUserOrgId}
          />
        )}

        {props.activeTab() === 'TYRES' && props.currentUserRights().canViewTyres && (
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
          />
        )}

        {props.activeTab() === 'BACKEND' && (props.currentUserRights()?.isSuperAdmin || props.currentUserOrgId === 'org_backend') && (
          <BackendDashboard
            organizationProfiles={props.organizationProfiles}
            userRightsList={props.userRightsList}
            trucks={props.trucks}
            onUpdateOrgStatus={props.handleUpdateOrgStatus}
            onUpdateOrgLimit={props.handleUpdateOrgLimit}
            onApproveTruckRequest={props.handleApproveTruckRequest}
            onRejectTruckRequest={props.handleRejectTruckRequest}
            onUpdateTruckDetails={props.handleBackendUpdateTruck}
            logAction={props.logAction}
            canEditBackend={() => props.currentUserRights()?.canEditBackend ?? false}
            canApproveBackend={() => props.currentUserRights()?.canApproveBackend ?? false}
            canAddBackend={() => props.currentUserRights()?.canAddBackend ?? false}
            canDeleteBackend={() => props.currentUserRights()?.canDeleteBackend ?? false}
            canViewBackend={() => props.currentUserRights()?.canViewBackend ?? false}
            canViewTruckRequests={() => props.currentUserRights()?.canViewTruckRequests ?? false}
            canViewDatabaseConsole={() => props.currentUserRights()?.canViewDatabaseConsole ?? false}
            canEditDatabaseConsole={() => props.currentUserRights()?.canEditDatabaseConsole ?? false}
            canDeleteDatabaseConsole={() => props.currentUserRights()?.canDeleteDatabaseConsole ?? false}
            drivers={props.drivers}
            offices={props.offices}
            accounts={props.accounts}
            trips={props.trips}
            expenses={props.expenses}
            tyres={props.tyres}
            auditLogs={props.auditLogs}
            onSaveTrucks={props.saveTrucks}
            onSaveDrivers={props.saveDrivers}
            onSaveOffices={props.saveOffices}
            onSaveAccounts={props.saveAccounts}
            onSaveTrips={props.saveTrips}
            onSaveExpenses={props.saveExpenses}
            onSaveTyres={props.saveTyres}
            onSaveAuditLogs={props.saveAuditLogs}
            onSaveUserRightsList={props.saveUserRightsListWithSync}
            onSaveOrganizationProfiles={props.saveOrganizationProfiles}
            supportTickets={props.supportTickets}
            onSaveSupportTickets={props.saveSupportTickets}
            currentUser={props.currentUser()}
            activeTicketId={props.activeTicketId()}
            onSetActiveTicketId={props.setActiveTicketId}
            payments={props.payments()}
            onInitiateRefund={props.handleInitiateRefund}
            appUpdateConfig={props.appUpdateConfig()}
            onSaveAppUpdateConfig={props.handleSaveAppUpdateConfig}
          />
        )}

        {props.activeTab() === 'USERS' && props.hasUsersTabAccess && (
          <UserAccessControl
            permissions={props.orgUserRights()}
            currentUserEmail={props.currentUser()?.email}
            onAddPermission={props.handleAddPermission as any}
            onUpdatePermission={props.handleUpdatePermission as any}
            onDeletePermission={props.handleDeletePermission as any}
            confirmAction={props.confirmAction}
            showNotification={props.showNotification}
            currentUserOrgId={props.currentUserOrgId}
            teamMembers={props.teamMembers()}
            loadingTeamMembers={props.loadingTeamMembers()}
            canAddBackend={props.currentUserRights().canAddBackend}
            canEditBackend={props.currentUserRights().canEditBackend}
            canDeleteBackend={props.currentUserRights().canDeleteBackend}
            orgProfile={props.currentOrgProfile}
            onUpdateOrgProfile={props.handleUpdateOrgProfile}
          />
        )}

        {props.activeTab() === 'BILLING' && (props.currentUserRights().isAdmin || props.currentUserRights().isSuperAdmin || props.currentUserOrgId === 'org_backend') && (
          <BillingHistory
            payments={props.payments()}
            currentUserOrgId={props.currentUserOrgId}
            orgName={props.currentOrgProfile?.organizationName || ''}
            gstNo={props.currentOrgProfile?.gstNo || ''}
            panNo={props.currentOrgProfile?.panNo || ''}
            address={props.currentOrgProfile?.address || ''}
          />
        )}
      </Suspense>
    </div>
  );
}
