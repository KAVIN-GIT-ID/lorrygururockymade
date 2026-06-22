/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BaseRecord {
  id: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  deletedAt?: string;
  syncState?: 'pending' | 'synced' | 'conflict';
}

export function createRecord<T>(
  data: Omit<T, keyof BaseRecord> & { id: string },
  userId: string
): T & BaseRecord {
  const now = new Date().toISOString();
  return {
    ...data,
    version: 1,
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
    syncState: 'pending'
  } as any;
}

export function mutateRecord<T extends BaseRecord>(
  record: T,
  updates: Partial<T>,
  userId: string
): T {
  return {
    ...record,
    ...updates,
    version: Math.max(1, (record.version || 0) + 1),
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
    syncState: 'pending'
  };
}

export interface LoanEntry {
  id: string;
  loanType?: string;               // Type of loan (e.g. 'Chassis Loan', 'Body Loan')
  loanStartDate?: string;          // Start date of loan (YYYY-MM-DD)
  loanRegisteredDate?: string;     // Date loan was registered in system (YYYY-MM-DD)
  loanTenureMonths?: number;       // Tenure in months
  loanEmiAmount?: number;          // EMI monthly installment amount
  loanBankName?: string;           // Loan provider bank name
  loanStatus?: 'Active' | 'Closed'; // Loan status
  loanNotes?: string;              // Optional remarks/notes
}

export interface Truck extends BaseRecord {
  truckNo: string;
  ownerName?: string;
  status: 'Active' | 'Inactive' | 'Admin Disabled' | 'Sold';
  organizationId?: string;
  isApproved?: boolean;
  requestStatus?: 'Pending' | 'Approved' | 'Rejected';
  registrationExpiryDate?: string; // Expiry Date (YYYY-MM-DD)
  rcFileId?: string;
  insuranceFileId?: string;

  // New Specs properties
  make?: string;
  model?: string;
  type?: string;

  insuranceDate?: string;      // Expiry Date (YYYY-MM-DD)
  fcDate?: string;             // Expiry Date (YYYY-MM-DD)
  pinpushKM?: number;          // Pinpush milestone KM
  wheelGreaseKM?: number;      // Wheel Grease milestone KM
  alignmentNextDate?: string;  // Alignment next date

  qTaxDate?: string;           // Q Tax Expiry Date
  greenTaxDate?: string;       // Green Tax Expiry Date
  npTaxDate?: string;          // NP Tax Expiry Date
  fiveYearPermitDate?: string; // 5 Year Permit Expiry Date

  currentKM?: number;          // Current odometer KM
  engineOilKM?: number;        // Engine Oil target milestone KM
  crownOilKM?: number;         // Crown Oil target milestone KM
  gearBoxOilKM?: number;       // Gear Box target milestone KM
  radiatorKM?: number;         // Radiator target milestone KM
  engineOilIntervalKM?: number;
  crownOilIntervalKM?: number;
  gearBoxOilIntervalKM?: number;
  radiatorIntervalKM?: number;
  pinpushIntervalKM?: number;      // Per-vehicle override for pinpush grease interval
  wheelGreaseIntervalKM?: number;  // Per-vehicle override for wheel grease interval

  // Loan details
  loanStartDate?: string;          // Start date of loan (YYYY-MM-DD)
  loanRegisteredDate?: string;     // Date loan was registered in system (YYYY-MM-DD)
  loanTenureMonths?: number;       // Tenure in months
  loanEmiAmount?: number;          // EMI monthly installment amount
  loanBankName?: string;           // Loan provider bank name
  loanStatus?: 'Active' | 'Closed'; // Loan status
  loanNotes?: string;              // Optional remarks/notes
  loans?: LoanEntry[];             // Multiple loans support
}

export interface Driver extends BaseRecord {
  driverName: string;
  phone?: string;
  licenseNo?: string;
  status: 'Active' | 'Inactive';
  organizationId?: string;
  licenseFileId?: string;
}

export interface Office extends BaseRecord {
  officeName: string;
  city?: string;
  contactPerson?: string;
  phone?: string;
  status: 'Active' | 'Inactive';
  organizationId?: string;
}

export interface Account extends BaseRecord {
  accountName: string;
  type: 'Cash' | 'Bank' | 'Digital Wallets' | 'Other';
  holderName?: string;
  status: 'Active' | 'Inactive';
  organizationId?: string;

  // Optional bank details fields
  bankName?: string;
  accountNo?: string;
  ifscCode?: string;
  branchName?: string;
}

export interface TruckExpense {
  id: string;
  truckNo: string;
  expenseType: string; // e.g. Battery, Pachai Tharpai, Q Tax, Green Tax, NP Tax, Temporary, etc.
  shopName: string; // e.g. TVS, Chennai Tharpai, etc.
  amount: number;
  paymentMode: string; // Account ID or Name
  date: string; // YYYY-MM-DD
  status: 'Paid' | 'Pending';
  accountType?: string; // Driver, Kadhir, etc.
}

export interface TripAdvance {
  id: string;
  amount: number;
  date: string;       // YYYY-MM-DD
  fromAccountId: string; // References Account.id or "Direct Driver"
  notes?: string;
  receivedByDriverDirectly?: boolean; // True if received directly by driver (e.g. direct party payment)
  subTripId?: string; // Optional: reference to subTrip.id
}

export type TripStatus = 'Pending' | 'In Progress' | 'Completed' | 'Settled' | 'Deleted';

export interface TripPayment {
  id: string;
  amount: number;
  date: string;       // YYYY-MM-DD
  receivedBy: string; // References Account.id
  notes?: string;     // Short remarks, e.g. "Fuel Advance", "Final"
  subTripId?: string; // Optional: reference to subTrip.id or "general"
}

export interface FuelEntry {
  id: string;
  date: string;
  liters: number;
  rate: number;
  amount: number;
  shopName?: string;     // Vendor/Bunk/Shop name
  paymentMode?: string;  // References Account.id
}

export interface CargoExpense {
  id: string;
  expenseType: 'Loading' | 'Unloading' | 'Brokerage' | 'Crossing' | 'RMC';
  amount: number;
  paidByDriver: boolean;
  deductedFrom: 'OrgRental' | 'DriverDirect' | 'OrgPaid';
  bears: 'Org' | 'Driver' | 'Office';
}

export interface SubTrip {
  id: string;
  cargoExpenses?: CargoExpense[];
  loadingDate: string;      // YYYY-MM-DD
  officeName: string;       // References Office.officeName
  routeFrom: string;        // Route origin (e.g. Bangalore)
  routeTo: string;          // Route destination (e.g. Mumbai)
  income: number;           // Contract income / Rental
  loadingExpense: number;   // Loading expense
  unloadingExpense: number; // Unloading expense
  driverWages: number;      // Driver Wages
  startingKM: number;       // Start odometer read for this load segment
  endingKM: number;         // End odometer read for this load segment
  notes?: string;           // Optional segment notes

  // Legacy fields kept as optional to maintain seamless migration support
  rtoExpense?: number;
  dieselLiters?: number;
  dieselRate?: number;
  dieselAmount?: number;
  addBlueExpense?: number;
  fastagExpense?: number;
  otherExpense?: number;

  // Who paid fields
  loadingPaidByDriver?: boolean;
  unloadingPaidByDriver?: boolean;
  brokerageExpense?: number;
  brokeragePaidByDriver?: boolean;

  // New settlement fields
  loadingDeductedFrom?: 'OrgRental' | 'DriverDirect' | 'OrgPaid';
  loadingBears?: 'Org' | 'Driver';

  unloadingDeductedFrom?: 'OrgRental' | 'DriverDirect' | 'OrgPaid';
  unloadingBears?: 'Org' | 'Driver';

  brokerageDeductedFrom?: 'OrgRental' | 'DriverDirect' | 'OrgPaid';
  brokerageBears?: 'Org' | 'Driver';

  crossingExpense?: number;
  crossingPaidByDriver?: boolean;
  crossingDeductedFrom?: 'OrgRental' | 'DriverDirect' | 'OrgPaid';
  crossingBears?: 'Org' | 'Driver';

  // RMC fields
  rmcExpense?: number;
  rmcPaidByDriver?: boolean;
  rmcDeductedFrom?: 'OrgRental' | 'DriverDirect' | 'OrgPaid';
  rmcBears?: 'Org' | 'Driver';

  // Split/reimbursement fields
  loadingBearsOrg?: number;
  loadingBearsDriver?: number;
  unloadingBearsOrg?: number;
  unloadingBearsDriver?: number;
  brokerageBearsOrg?: number;
  brokerageBearsDriver?: number;
  crossingBearsOrg?: number;
  crossingBearsDriver?: number;
  rmcBearsOrg?: number;
  rmcBearsDriver?: number;

  noOfTons?: number;
  material?: string;
  ratePerTon?: number;
  pod?: SubTripPod;
}

export interface SubTripPod {
  courierName: string;
  refNo: string;
  date: string;
  status: string;
  attachmentId?: string;
}

export interface TripEntry extends BaseRecord {
  tripNo: string;           // Group/Index Identifier (e.g. TRIP-2026-0001)
  truckNo: string;          // References Truck.truckNo
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  organizationId?: string;
  driverName: string;       // Operator driver name
  startingKM: number;       // Initial master odometer
  endingKM: number;         // Completed master odometer
  payments: TripPayment[];   // Receipts tracking
  advances?: TripAdvance[];  // Advances given to driver
  subTrips: SubTrip[];      // Multi sub trips segments
  status: TripStatus;
  notes?: string;           // General remarks

  // Common Trip-level Expenses
  rtoExpense?: number;       // Common RTO
  dieselLiters?: number;     // Common Diesel Liters
  dieselRate?: number;       // Common Diesel Rate
  dieselAmount?: number;     // Common Diesel Amount
  addBlueExpense?: number;   // Common Add Blue
  fastagExpense?: number;    // Common Fastag Expense
  otherExpense?: number;     // Common Miscellaneous Other
  fuels?: FuelEntry[];       // n number of fuels support

  // Who paid fields
  rtoPaidByDriver?: boolean;
  addBluePaidByDriver?: boolean;
  fastagPaidByDriver?: boolean;
  otherPaidByDriver?: boolean;
}

export interface TripMetrics {
  income: number;
  loadingExpense: number;
  unloadingExpense: number;
  brokerageExpense: number;
  crossingExpense: number;
  rmcExpense: number;
  rtoExpense: number;
  dieselExpense: number;
  addBlueExpense: number;
  fastagExpense: number;
  driverWages: number;
  otherExpense: number;
  fuelLiters: number;
  totalKM: number;
  millage: number;
  perKM: number;
  profitPerKM: number;
  noOfDays: number;
  totalExpense: number;
  profit: number;
  paymentsReceived: number;
  outstandingBalance: number;
  totalOrgRentalDeductions: number;
  driverPaidDirect: number;
  driverRecovery: number;
  driverBalance: number;
  totalDriverSpend: number;
  totalIssuedToDriver: number;
  fuelsDriverSpend: number;
  tripLevelDriverSpend: number;
}

export function getTripMetrics(trip: TripEntry): TripMetrics {
  const subTrips = Array.isArray(trip.subTrips) ? trip.subTrips : [];

  const income = subTrips.reduce((sum, s) => sum + (Number(s.income) || 0), 0);

  let loadingExpense = 0;
  let unloadingExpense = 0;
  let brokerageExpense = 0;
  let crossingExpense = 0;
  let rmcExpense = 0;

  let totalOrgRentalDeductions = 0;
  let driverPaidDirect = 0;
  let driverRecovery = 0;
  let officeBearsExpenseTotal = 0;

  for (const s of subTrips) {
    let expenses = s.cargoExpenses;
    if (typeof expenses === 'string') {
      try {
        expenses = JSON.parse(expenses);
      } catch (e) {
        expenses = [];
      }
    }
    if (!expenses || expenses.length === 0) {
      expenses = importLegacyCargoExpenses(s);
    }
    for (const exp of expenses) {
      const amount = Number(exp.amount) || 0;
      const isPaidByDriver = !!exp.paidByDriver;
      const isDeductedFromOrgRental = exp.deductedFrom === 'OrgRental';

      // 1. Deducted from Org Rental (reduces net freight received from office)
      if (isDeductedFromOrgRental) {
        totalOrgRentalDeductions += amount;
      }

      // 2. Who bears it
      if (exp.bears === 'Org') {
        // Add to category expense
        if (exp.expenseType === 'Loading') loadingExpense += amount;
        else if (exp.expenseType === 'Unloading') unloadingExpense += amount;
        else if (exp.expenseType === 'Brokerage') brokerageExpense += amount;
        else if (exp.expenseType === 'Crossing') crossingExpense += amount;
        else if (exp.expenseType === 'RMC') rmcExpense += amount;

        // Driver paid direct gets reimbursed
        if (isPaidByDriver) {
          driverPaidDirect += amount;
        }
      } else if (exp.bears === 'Driver') {
        // Driver bears it
        // If paid by office (not paid by driver), recover from driver
        if (!isPaidByDriver) {
          driverRecovery += amount;
        }
      } else if (exp.bears === 'Office') {
        // Office bears it
        officeBearsExpenseTotal += amount;

        // Driver paid direct gets reimbursed by Org, Org recovers from Office via outstanding balance
        if (isPaidByDriver) {
          driverPaidDirect += amount;
        }
      }
    }
  }

  const driverWages = subTrips.reduce((sum, s) => sum + (Number(s.driverWages) || 0), 0);

  // Common Trip-level expenses (with fallback to sum subTrips if undefined for compatibility)
  const rtoExpense = trip.rtoExpense !== undefined ? Number(trip.rtoExpense) : subTrips.reduce((sum, s) => sum + (Number(s.rtoExpense) || 0), 0);

  // Calculate total fuel liters and expense from fuels list under TripEntry or single field fallback
  const fuels = Array.isArray(trip.fuels) ? trip.fuels : [];
  const fuelLiters = fuels.length > 0
    ? fuels.reduce((sum, f) => sum + (Number(f.liters) || 0), 0)
    : (trip.dieselLiters !== undefined ? Number(trip.dieselLiters) : subTrips.reduce((sum, s) => sum + (Number(s.dieselLiters) || 0), 0));

  const dieselExpense = fuels.length > 0
    ? fuels.reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
    : (trip.dieselAmount !== undefined ? Number(trip.dieselAmount) : subTrips.reduce((sum, s) => sum + (Number(s.dieselAmount) || 0), 0));

  const addBlueExpense = trip.addBlueExpense !== undefined ? Number(trip.addBlueExpense) : subTrips.reduce((sum, s) => sum + (Number(s.addBlueExpense) || 0), 0);
  const fastagExpense = trip.fastagExpense !== undefined ? Number(trip.fastagExpense) : subTrips.reduce((sum, s) => sum + (Number(s.fastagExpense) || 0), 0);
  const otherExpense = trip.otherExpense !== undefined ? Number(trip.otherExpense) : subTrips.reduce((sum, s) => sum + (Number(s.otherExpense) || 0), 0);

  const startingKM = Number(trip.startingKM) || 0;
  const endingKM = Number(trip.endingKM) || 0;
  const totalKM = Math.max(0, endingKM - startingKM);

  const millage = fuelLiters > 0 ? (totalKM / fuelLiters) : 0;

  const totalExpense = loadingExpense + unloadingExpense + brokerageExpense + crossingExpense + rmcExpense + rtoExpense + dieselExpense + addBlueExpense + fastagExpense + otherExpense;
  const profit = income - totalExpense - driverWages;

  const perKM = totalKM > 0 ? (totalExpense / totalKM) : 0;
  const profitPerKM = totalKM > 0 ? (profit / totalKM) : 0;

  // Calculate Days
  let noOfDays = 1;
  if (trip.startDate && trip.endDate) {
    const s = new Date(trip.startDate);
    const e = new Date(trip.endDate);
    const diffTime = e.getTime() - s.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    noOfDays = isNaN(diffDays) || diffDays < 1 ? 1 : diffDays;
  }

  const paymentsReceived = (Array.isArray(trip.payments) ? trip.payments : []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const outstandingBalance = income - totalOrgRentalDeductions + officeBearsExpenseTotal - paymentsReceived;

  // Fuels paid by driver
  const fuelsDriverSpend = (Array.isArray(trip.fuels) ? trip.fuels : []).reduce((sum, f) => {
    if (f.paymentMode === 'driver' || f.paymentMode === 'Driver') {
      return sum + (Number(f.amount) || 0);
    }
    return sum;
  }, 0);

  // Common trip-level expenses paid by driver
  let tripLevelDriverSpend = 0;
  if (trip.rtoPaidByDriver && rtoExpense) tripLevelDriverSpend += rtoExpense;
  if (trip.addBluePaidByDriver && addBlueExpense) tripLevelDriverSpend += addBlueExpense;
  if (trip.fastagPaidByDriver && fastagExpense) tripLevelDriverSpend += fastagExpense;
  if (trip.otherPaidByDriver && otherExpense) tripLevelDriverSpend += otherExpense;

  const totalDriverSpend = fuelsDriverSpend + tripLevelDriverSpend + driverPaidDirect - driverRecovery;

  // Driver Advances (Category 4)
  const category4CategoryAdvances = (Array.isArray(trip.advances) ? trip.advances : []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  // Category 3 paid to driver advance
  const category3DriverAdvancePayments = (Array.isArray(trip.payments) ? trip.payments : [])
    .filter(p => p.receivedBy === 'paid_to_driver_advance')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalIssuedToDriver = category4CategoryAdvances + category3DriverAdvancePayments;
  const driverBalance = driverWages + totalDriverSpend - totalIssuedToDriver;

  return {
    income,
    loadingExpense,
    unloadingExpense,
    brokerageExpense,
    crossingExpense,
    rmcExpense,
    rtoExpense,
    dieselExpense,
    addBlueExpense,
    fastagExpense,
    driverWages,
    otherExpense,
    fuelLiters,
    totalKM,
    millage,
    perKM,
    profitPerKM,
    noOfDays,
    totalExpense,
    profit,
    paymentsReceived,
    outstandingBalance,
    totalOrgRentalDeductions,
    driverPaidDirect,
    driverRecovery,
    driverBalance,
    totalDriverSpend,
    totalIssuedToDriver,
    fuelsDriverSpend,
    tripLevelDriverSpend
  };
}

export function calculateBalance(trip: TripEntry): number {
  return getTripMetrics(trip).outstandingBalance;
}

export interface ExpenseEntry extends BaseRecord {
  truckNo: string;
  expenseType: string; // e.g. "Temporary", "Scheduled", "Maintenance"
  shopName: string;
  amount: number;
  paymentMode: string; // Account ID / Name (e.g. Axis) or Driver Name
  date: string;
  status: 'Pending' | 'Paid' | 'Approved' | 'Declined' | 'Settled';
  accountType?: 'Account' | 'Driver'; // To select Driver as account type
  driverName?: string; // Driver Name if accountType is 'Driver'
  notes?: string;      // Optional service notes (e.g. early service reason)
  organizationId?: string;
}

export interface AuditLog extends BaseRecord {
  timestamp: string; // YYYY-MM-DD HH:MM:ss
  user: string; // e.g. "admin@example.com"
  action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected';
  category: string; // "Trip", "Truck", "Driver", "Office", "Account", "Expense"
  reference: string; // ID or No (e.g. TRIP-2026-0D1)
  details: string; // descriptive actions
  organizationId?: string;
}

export interface TyreMovementLog {
  id: string;
  action: 'Installed' | 'Removed' | 'Sold' | 'Scrapped';
  truckNo?: string;       // Vehicle involved in movement
  date: string;          // YYYY-MM-DD
  odometerKM?: number;   // Truck odometer KM on installation or removal
  remarks?: string;      // Notes on movement (reason, wear status, etc)
}

export type TyreStatus = 'Available' | 'Active' | 'Sold' | 'Scrapped';

export interface Tyre extends BaseRecord {
  tyreNo: string;        // Serial / Unique Code printed on tyre
  manufacturer: string;  // MRF, Apollo, TATA, Ashok Leyland, CEAT, Michelin, etc.
  size?: string;         // e.g. 10.00R20, 295/85R22.5
  status: TyreStatus;    // Current status
  organizationId?: string;
  currentTruckNo?: string;  // Current vehicle if mounted (Active status)
  installationDate?: string; // Mounting date
  installationKM?: number;   // Vehicle Odometer when installed
  accumulatedKM: number;  // Mileage accrued on previous trucks (excluding current mounting)
  purchaseDate?: string;
  purchaseAmount?: number;
  saleDate?: string;
  saleAmount?: number;
  movementHistory: TyreMovementLog[];
}

export interface UserPermission {
  id: string;
  email: string;
  name: string;
  phone?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  role: 'Admin' | 'Custom' | 'SuperAdmin';
  organizationId: string;
  isApproved: boolean;
  is2FAEnabled?: boolean;
  twoFactorSecret?: string;

  // Fine-grained module permissions
  canViewTrips: boolean;
  canEditTrips: boolean;
  canDeleteTrips: boolean;

  canViewTyres: boolean;
  canEditTyres: boolean;
  canDeleteTyres: boolean;

  canViewTrucks: boolean;
  canEditTrucks: boolean;
  canDeleteTrucks: boolean;

  canViewDrivers: boolean;
  canEditDrivers: boolean;
  canDeleteDrivers: boolean;

  canViewOffices: boolean;
  canEditOffices: boolean;
  canDeleteOffices: boolean;

  canViewAccounts: boolean;
  canEditAccounts: boolean;
  canDeleteAccounts: boolean;

  canViewExpenses: boolean;
  canEditExpenses: boolean;
  canDeleteExpenses: boolean;

  // Backend team RBAC
  canViewBackend?: boolean;
  canAddBackend?: boolean;
  canEditBackend?: boolean;
  canDeleteBackend?: boolean;
  canApproveBackend?: boolean;
  canViewTruckRequests?: boolean;
  canDeleteTruckRequests?: boolean;
  canViewBackendTeam?: boolean;
  canDeleteBackendTeam?: boolean;
  canViewDatabaseConsole?: boolean;
  canEditDatabaseConsole?: boolean;
  canDeleteDatabaseConsole?: boolean;
  canEditLoans?: boolean;
  canDeleteLoans?: boolean;
  supportRole?: ('Technical' | 'Billing' | 'General')[] | string;
  canTransferTickets?: boolean;
  canViewTickets?: boolean;
  canEditTickets?: boolean;
  canDeleteTickets?: boolean;
}

export interface UserRights {
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  organizationId: string;
  isApproved: boolean;
  phone?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  is2FAEnabled?: boolean;
  twoFactorSecret?: string;

  canViewTrips: boolean;
  canEditTrips: boolean;
  canDeleteTrips: boolean;

  canViewTyres: boolean;
  canEditTyres: boolean;
  canDeleteTyres: boolean;

  canViewTrucks: boolean;
  canEditTrucks: boolean;
  canDeleteTrucks: boolean;

  canViewDrivers: boolean;
  canEditDrivers: boolean;
  canDeleteDrivers: boolean;

  canViewOffices: boolean;
  canEditOffices: boolean;
  canDeleteOffices: boolean;

  canViewAccounts: boolean;
  canEditAccounts: boolean;
  canDeleteAccounts: boolean;

  canViewExpenses: boolean;
  canEditExpenses: boolean;
  canDeleteExpenses: boolean;

  // Backend team RBAC
  canViewBackend?: boolean;
  canAddBackend?: boolean;
  canEditBackend?: boolean;
  canDeleteBackend?: boolean;
  canApproveBackend?: boolean;
  canViewTruckRequests?: boolean;
  canDeleteTruckRequests?: boolean;
  canViewBackendTeam?: boolean;
  canDeleteBackendTeam?: boolean;
  canViewDatabaseConsole?: boolean;
  canEditDatabaseConsole?: boolean;
  canDeleteDatabaseConsole?: boolean;
  canEditLoans?: boolean;
  canDeleteLoans?: boolean;
  supportRole?: ('Technical' | 'Billing' | 'General')[] | string;
  canTransferTickets?: boolean;
  canViewTickets?: boolean;
  canEditTickets?: boolean;
  canDeleteTickets?: boolean;
}

export interface TruckRequest {
  id: string;
  truckNo: string;
  requestedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  make?: string;
  model?: string;
  type?: string;
  currentKM?: number;
}

export interface FuelCard {
  id: string;
  cardName: string;
  cardNumber?: string;
  status: 'Active' | 'Inactive';
}

export interface OrganizationProfile {
  organizationId: string;
  organizationName: string;
  ownerEmail: string;
  status: 'Active' | 'Disabled';
  maxTrucksAllowed: number;
  truckRequests: TruckRequest[];
  engineOilIntervalKM?: number;
  crownOilIntervalKM?: number;
  gearBoxOilIntervalKM?: number;
  radiatorIntervalKM?: number;
  pinpushIntervalKM?: number;      // Org-wide default for pinpush grease
  wheelGreaseIntervalKM?: number;  // Org-wide default for wheel grease
  brokeragePolicy?: 'OrgBears' | 'DriverBears'; // Org-wide default brokerage policy
  fuelCards?: FuelCard[];
  gstNo?: string;
  panNo?: string;
  aadhaarNo?: string;
  address?: string;
  insuranceWarningDays?: number;
  fcWarningDays?: number;
  npTaxWarningDays?: number;
  fiveYearPermitWarningDays?: number;
  qTaxWarningDays?: number;
  greenTaxWarningDays?: number;
  subscriptionWarningDays?: number;
}

// ─── Service Done Types ────────────────────────────────────────────────────────

export type ServiceType =
  | 'Engine Oil'
  | 'Crown Oil'
  | 'Gear Box Oil'
  | 'Radiator'
  | 'Pinpush Grease'
  | 'Wheel Grease';

export interface ServiceExpenseEntry {
  shopName: string;
  amount: number;           // 0 = skip creating this expense entry
  paymentMode: string;
  accountType: 'Account' | 'Driver';
  driverName?: string;
  status: 'Paid' | 'Pending';
}

export interface ServiceDonePayload {
  serviceType: ServiceType;
  serviceDate: string;          // YYYY-MM-DD
  truckId: string;
  truckNo: string;
  newMilestoneKM: number;       // Updated next-due KM stored on the truck
  notes?: string;               // Optional reason/remarks (visible on service window)
  partsExpense: ServiceExpenseEntry;
  labourExpense: ServiceExpenseEntry;
}

// ─── Support Ticket & Chat System ──────────────────────────────────────────────

export interface TicketMessage {
  id: string;
  sender: 'User' | 'Agent';
  senderName: string;
  senderEmail: string;
  content: string;
  timestamp: string;
  attachmentUrl?: string;
  attachmentName?: string;
}

export interface SupportTicket extends BaseRecord {
  ticketNo: string;
  organizationId?: string; // Empty if raised from public Contact Us form
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  category: 'Technical' | 'Billing' | 'General';
  title: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Closed';
  assignedTeam: 'Technical' | 'Billing' | 'General';
  assignedTo?: string; // Email of the support agent
  messages: TicketMessage[];
  lockedByName?: string;
  lockedByEmail?: string;
  lockedByAt?: string;
}

export function importLegacyCargoExpenses(s: SubTrip, orgProfile?: OrganizationProfile): CargoExpense[] {
  const list: CargoExpense[] = [];
  const genId = (prefix: string) => prefix + '-' + Math.random().toString(36).substring(2, 7);

  // 1. Loading
  if (s.loadingExpense && Number(s.loadingExpense) > 0) {
    const amt = Number(s.loadingExpense);
    const deductedFrom = s.loadingDeductedFrom || 'DriverDirect';
    const isCategoryPaidByDriver = !!s.loadingPaidByDriver || deductedFrom === 'DriverDirect';
    if (s.loadingBearsOrg !== undefined || s.loadingBearsDriver !== undefined) {
      const orgAmt = Number(s.loadingBearsOrg) || 0;
      const drvAmt = Number(s.loadingBearsDriver) || 0;
      if (orgAmt > 0) {
        list.push({
          id: genId('load-org'),
          expenseType: 'Loading',
          amount: orgAmt,
          paidByDriver: deductedFrom === 'DriverDirect',
          deductedFrom,
          bears: 'Org'
        });
      }
      if (drvAmt > 0) {
        list.push({
          id: genId('load-drv'),
          expenseType: 'Loading',
          amount: drvAmt,
          paidByDriver: isCategoryPaidByDriver,
          deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
          bears: 'Driver'
        });
      }
      const officeAmt = amt - orgAmt - drvAmt;
      if (officeAmt > 0) {
        list.push({
          id: genId('load-office'),
          expenseType: 'Loading',
          amount: officeAmt,
          paidByDriver: isCategoryPaidByDriver,
          deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
          bears: 'Office'
        });
      }
    } else {
      const bears = s.loadingBears || 'Org';
      list.push({
        id: genId('load'),
        expenseType: 'Loading',
        amount: amt,
        paidByDriver: isCategoryPaidByDriver,
        deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
        bears: bears as 'Org' | 'Driver' | 'Office'
      });
    }
  }

  // 2. Unloading
  if (s.unloadingExpense && Number(s.unloadingExpense) > 0) {
    const amt = Number(s.unloadingExpense);
    const deductedFrom = s.unloadingDeductedFrom || 'DriverDirect';
    const isCategoryPaidByDriver = !!s.unloadingPaidByDriver || deductedFrom === 'DriverDirect';
    if (s.unloadingBearsOrg !== undefined || s.unloadingBearsDriver !== undefined) {
      const orgAmt = Number(s.unloadingBearsOrg) || 0;
      const drvAmt = Number(s.unloadingBearsDriver) || 0;
      if (orgAmt > 0) {
        list.push({
          id: genId('unload-org'),
          expenseType: 'Unloading',
          amount: orgAmt,
          paidByDriver: deductedFrom === 'DriverDirect',
          deductedFrom,
          bears: 'Org'
        });
      }
      if (drvAmt > 0) {
        list.push({
          id: genId('unload-drv'),
          expenseType: 'Unloading',
          amount: drvAmt,
          paidByDriver: isCategoryPaidByDriver,
          deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
          bears: 'Driver'
        });
      }
      const officeAmt = amt - orgAmt - drvAmt;
      if (officeAmt > 0) {
        list.push({
          id: genId('unload-office'),
          expenseType: 'Unloading',
          amount: officeAmt,
          paidByDriver: isCategoryPaidByDriver,
          deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
          bears: 'Office'
        });
      }
    } else {
      const bears = s.unloadingBears || 'Org';
      list.push({
        id: genId('unload'),
        expenseType: 'Unloading',
        amount: amt,
        paidByDriver: isCategoryPaidByDriver,
        deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
        bears: bears as 'Org' | 'Driver' | 'Office'
      });
    }
  }

  // 3. Brokerage
  if (s.brokerageExpense && Number(s.brokerageExpense) > 0) {
    const amt = Number(s.brokerageExpense);
    const deductedFrom = s.brokerageDeductedFrom || 'DriverDirect';
    const isCategoryPaidByDriver = !!s.brokeragePaidByDriver || deductedFrom === 'DriverDirect';
    const defaultBears = orgProfile?.brokeragePolicy === 'OrgBears' ? 'Org' : 'Driver';
    if (s.brokerageBearsOrg !== undefined || s.brokerageBearsDriver !== undefined) {
      const orgAmt = Number(s.brokerageBearsOrg) || 0;
      const drvAmt = Number(s.brokerageBearsDriver) || 0;
      if (orgAmt > 0) {
        list.push({
          id: genId('broke-org'),
          expenseType: 'Brokerage',
          amount: orgAmt,
          paidByDriver: deductedFrom === 'DriverDirect',
          deductedFrom,
          bears: 'Org'
        });
      }
      if (drvAmt > 0) {
        list.push({
          id: genId('broke-drv'),
          expenseType: 'Brokerage',
          amount: drvAmt,
          paidByDriver: isCategoryPaidByDriver,
          deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
          bears: 'Driver'
        });
      }
      const officeAmt = amt - orgAmt - drvAmt;
      if (officeAmt > 0) {
        list.push({
          id: genId('broke-office'),
          expenseType: 'Brokerage',
          amount: officeAmt,
          paidByDriver: isCategoryPaidByDriver,
          deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
          bears: 'Office'
        });
      }
    } else {
      const bears = s.brokerageBears || defaultBears;
      list.push({
        id: genId('broke'),
        expenseType: 'Brokerage',
        amount: amt,
        paidByDriver: isCategoryPaidByDriver,
        deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
        bears: bears as 'Org' | 'Driver' | 'Office'
      });
    }
  }

  // 4. Crossing
  if (s.crossingExpense && Number(s.crossingExpense) > 0) {
    const amt = Number(s.crossingExpense);
    const deductedFrom = s.crossingDeductedFrom || 'DriverDirect';
    const isCategoryPaidByDriver = !!s.crossingPaidByDriver || deductedFrom === 'DriverDirect';
    if (s.crossingBearsOrg !== undefined || s.crossingBearsDriver !== undefined) {
      const orgAmt = Number(s.crossingBearsOrg) || 0;
      const drvAmt = Number(s.crossingBearsDriver) || 0;
      if (orgAmt > 0) {
        list.push({
          id: genId('cross-org'),
          expenseType: 'Crossing',
          amount: orgAmt,
          paidByDriver: deductedFrom === 'DriverDirect',
          deductedFrom,
          bears: 'Org'
        });
      }
      if (drvAmt > 0) {
        list.push({
          id: genId('cross-drv'),
          expenseType: 'Crossing',
          amount: drvAmt,
          paidByDriver: isCategoryPaidByDriver,
          deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
          bears: 'Driver'
        });
      }
      const officeAmt = amt - orgAmt - drvAmt;
      if (officeAmt > 0) {
        list.push({
          id: genId('cross-office'),
          expenseType: 'Crossing',
          amount: officeAmt,
          paidByDriver: isCategoryPaidByDriver,
          deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
          bears: 'Office'
        });
      }
    } else {
      const bears = s.crossingBears || 'Org';
      list.push({
        id: genId('cross'),
        expenseType: 'Crossing',
        amount: amt,
        paidByDriver: isCategoryPaidByDriver,
        deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
        bears: bears as 'Org' | 'Driver' | 'Office'
      });
    }
  }

  // 5. RMC
  if (s.rmcExpense && Number(s.rmcExpense) > 0) {
    const amt = Number(s.rmcExpense);
    const deductedFrom = s.rmcDeductedFrom || 'DriverDirect';
    const isCategoryPaidByDriver = !!s.rmcPaidByDriver || deductedFrom === 'DriverDirect';
    if (s.rmcBearsOrg !== undefined || s.rmcBearsDriver !== undefined) {
      const orgAmt = Number(s.rmcBearsOrg) || 0;
      const drvAmt = Number(s.rmcBearsDriver) || 0;
      if (orgAmt > 0) {
        list.push({
          id: genId('rmc-org'),
          expenseType: 'RMC',
          amount: orgAmt,
          paidByDriver: deductedFrom === 'DriverDirect',
          deductedFrom,
          bears: 'Org'
        });
      }
      if (drvAmt > 0) {
        list.push({
          id: genId('rmc-drv'),
          expenseType: 'RMC',
          amount: drvAmt,
          paidByDriver: isCategoryPaidByDriver,
          deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
          bears: 'Driver'
        });
      }
      const officeAmt = amt - orgAmt - drvAmt;
      if (officeAmt > 0) {
        list.push({
          id: genId('rmc-office'),
          expenseType: 'RMC',
          amount: officeAmt,
          paidByDriver: isCategoryPaidByDriver,
          deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
          bears: 'Office'
        });
      }
    } else {
      const bears = s.rmcBears || 'Org';
      list.push({
        id: genId('rmc'),
        expenseType: 'RMC',
        amount: amt,
        paidByDriver: isCategoryPaidByDriver,
        deductedFrom: isCategoryPaidByDriver ? 'DriverDirect' : deductedFrom,
        bears: bears as 'Org' | 'Driver' | 'Office'
      });
    }
  }

  return list;
}



