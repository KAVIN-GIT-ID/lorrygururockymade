/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Truck {
  id: string;
  truckNo: string;
  ownerName?: string;
  status: 'Active' | 'Inactive' | 'Admin Disabled';
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
}

export interface Driver {
  id: string;
  driverName: string;
  phone?: string;
  licenseNo?: string;
  status: 'Active' | 'Inactive';
  organizationId?: string;
  licenseFileId?: string;
}

export interface Office {
  id: string;
  officeName: string;
  city?: string;
  contactPerson?: string;
  phone?: string;
  status: 'Active' | 'Inactive';
  organizationId?: string;
}

export interface Account {
  id: string;
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
}

export type TripStatus = 'Pending' | 'In Progress' | 'Completed' | 'Paid';

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

export interface SubTrip {
  id: string;
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
  loadingDeductedFrom?: 'OrgRental' | 'DriverDirect';
  loadingBears?: 'Org' | 'Driver';

  unloadingDeductedFrom?: 'OrgRental' | 'DriverDirect';
  unloadingBears?: 'Org' | 'Driver';

  brokerageDeductedFrom?: 'OrgRental' | 'DriverDirect';
  brokerageBears?: 'Org' | 'Driver';

  crossingExpense?: number;
  crossingPaidByDriver?: boolean;
  crossingDeductedFrom?: 'OrgRental' | 'DriverDirect';
  crossingBears?: 'Org' | 'Driver';
  
  noOfTons?: number;
  material?: string;
  ratePerTon?: number;
}

export interface TripEntry {
  id: string;
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
  noOfDays: number;
  totalExpense: number;
  profit: number;
  paymentsReceived: number;
  outstandingBalance: number;
  totalOrgRentalDeductions: number;
  driverPaidDirect: number;
  driverRecovery: number;
}

export function getTripMetrics(trip: TripEntry): TripMetrics {
  const subTrips = trip.subTrips || [];
  
  const income = subTrips.reduce((sum, s) => sum + (Number(s.income) || 0), 0);
  
  // Resolve each sub-trip charge
  const resolvedCharges = subTrips.map(s => {
    // 1. Loading
    const loadAmt = Number(s.loadingExpense) || 0;
    const loadDeductedFrom = s.loadingDeductedFrom || (s.loadingPaidByDriver ? 'DriverDirect' : 'OrgRental');
    const loadBears = s.loadingBears || 'Org';

    // 2. Unloading
    const unloadAmt = Number(s.unloadingExpense) || 0;
    const unloadDeductedFrom = s.unloadingDeductedFrom || (s.unloadingPaidByDriver ? 'DriverDirect' : 'OrgRental');
    const unloadBears = s.unloadingBears || 'Org';

    // 3. Brokerage
    const brokerageAmt = Number(s.brokerageExpense) || 0;
    const brokerageDeductedFrom = s.brokerageDeductedFrom || (s.brokeragePaidByDriver ? 'DriverDirect' : 'OrgRental');
    const brokerageBears = s.brokerageBears || 'Driver';

    // 4. Crossing
    const crossingAmt = Number(s.crossingExpense) || 0;
    const crossingDeductedFrom = s.crossingDeductedFrom || (s.crossingPaidByDriver ? 'DriverDirect' : 'OrgRental');
    const crossingBears = s.crossingBears || 'Org';

    return {
      load: { amount: loadAmt, deductedFrom: loadDeductedFrom, bears: loadBears },
      unload: { amount: unloadAmt, deductedFrom: unloadDeductedFrom, bears: unloadBears },
      brokerage: { amount: brokerageAmt, deductedFrom: brokerageDeductedFrom, bears: brokerageBears },
      crossing: { amount: crossingAmt, deductedFrom: crossingDeductedFrom, bears: crossingBears }
    };
  });

  // ─── Org Borne Expenses (reduce profit) ───────────────────────────
  const loadingExpense = resolvedCharges.reduce((sum, rc) => sum + (rc.load.bears === 'Org' ? rc.load.amount : 0), 0);
  const unloadingExpense = resolvedCharges.reduce((sum, rc) => sum + (rc.unload.bears === 'Org' ? rc.unload.amount : 0), 0);
  const brokerageExpense = resolvedCharges.reduce((sum, rc) => sum + (rc.brokerage.bears === 'Org' ? rc.brokerage.amount : 0), 0);
  const crossingExpense = resolvedCharges.reduce((sum, rc) => sum + (rc.crossing.bears === 'Org' ? rc.crossing.amount : 0), 0);

  // ─── Rental Deductions (deductedFrom === 'OrgRental') ───────────────────────────
  const totalOrgRentalDeductions = resolvedCharges.reduce((sum, rc) => {
    let subSum = 0;
    if (rc.load.deductedFrom === 'OrgRental') subSum += rc.load.amount;
    if (rc.unload.deductedFrom === 'OrgRental') subSum += rc.unload.amount;
    if (rc.brokerage.deductedFrom === 'OrgRental') subSum += rc.brokerage.amount;
    // Crossing/Mamul is always deducted from rental
    subSum += rc.crossing.amount;
    return sum + subSum;
  }, 0);

  // ─── Driver Paid Direct (deductedFrom === 'DriverDirect' && bears === 'Org') ─────
  const driverPaidDirect = resolvedCharges.reduce((sum, rc) => {
    let subSum = 0;
    if (rc.load.deductedFrom === 'DriverDirect' && rc.load.bears === 'Org') subSum += rc.load.amount;
    if (rc.unload.deductedFrom === 'DriverDirect' && rc.unload.bears === 'Org') subSum += rc.unload.amount;
    if (rc.brokerage.deductedFrom === 'DriverDirect' && rc.brokerage.bears === 'Org') subSum += rc.brokerage.amount;
    if (rc.crossing.deductedFrom === 'DriverDirect' && rc.crossing.bears === 'Org') subSum += rc.crossing.amount;
    return sum + subSum;
  }, 0);

  // ─── Driver Recovery (deductedFrom === 'OrgRental' && bears === 'Driver') ───────
  const driverRecovery = resolvedCharges.reduce((sum, rc) => {
    let subSum = 0;
    if (rc.load.deductedFrom === 'OrgRental' && rc.load.bears === 'Driver') subSum += rc.load.amount;
    if (rc.unload.deductedFrom === 'OrgRental' && rc.unload.bears === 'Driver') subSum += rc.unload.amount;
    if (rc.brokerage.deductedFrom === 'OrgRental' && rc.brokerage.bears === 'Driver') subSum += rc.brokerage.amount;
    if (rc.crossing.deductedFrom === 'OrgRental' && rc.crossing.bears === 'Driver') subSum += rc.crossing.amount;
    return sum + subSum;
  }, 0);

  const driverWages = subTrips.reduce((sum, s) => sum + (Number(s.driverWages) || 0), 0);

  // Common Trip-level expenses (with fallback to sum subTrips if undefined for compatibility)
  const rtoExpense = trip.rtoExpense !== undefined ? Number(trip.rtoExpense) : subTrips.reduce((sum, s) => sum + (Number(s.rtoExpense) || 0), 0);
  
  // Calculate total fuel liters and expense from fuels list under TripEntry or single field fallback
  const fuels = trip.fuels || [];
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
  
  const totalExpense = loadingExpense + unloadingExpense + brokerageExpense + crossingExpense + rtoExpense + dieselExpense + addBlueExpense + fastagExpense + driverWages + otherExpense;
  const profit = income - totalExpense;
  
  const perKM = totalKM > 0 ? (totalExpense / totalKM) : 0;
  
  // Calculate Days
  let noOfDays = 1;
  if (trip.startDate && trip.endDate) {
    const s = new Date(trip.startDate);
    const e = new Date(trip.endDate);
    const diffTime = e.getTime() - s.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    noOfDays = isNaN(diffDays) || diffDays < 1 ? 1 : diffDays;
  }
  
  const paymentsReceived = (trip.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const outstandingBalance = income - totalOrgRentalDeductions - paymentsReceived;
  
  return {
    income,
    loadingExpense,
    unloadingExpense,
    brokerageExpense,
    crossingExpense,
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
    noOfDays,
    totalExpense,
    profit,
    paymentsReceived,
    outstandingBalance,
    totalOrgRentalDeductions,
    driverPaidDirect,
    driverRecovery
  };
}

export function calculateBalance(trip: TripEntry): number {
  return getTripMetrics(trip).outstandingBalance;
}

export interface ExpenseEntry {
  id: string;
  truckNo: string;
  expenseType: string; // e.g. "Temporary", "Scheduled", "Maintenance"
  shopName: string;
  amount: number;
  paymentMode: string; // Account ID / Name (e.g. Axis) or Driver Name
  date: string;
  status: 'Pending' | 'Paid' | 'Approved' | 'Declined';
  accountType?: 'Account' | 'Driver'; // To select Driver as account type
  driverName?: string; // Driver Name if accountType is 'Driver'
  notes?: string;      // Optional service notes (e.g. early service reason)
  organizationId?: string;
}

export interface AuditLog {
  id: string;
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

export interface Tyre {
  id: string;
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
  role: 'Admin' | 'Custom' | 'SuperAdmin';
  organizationId: string;
  isApproved: boolean;

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
}

export interface UserRights {
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  organizationId: string;
  isApproved: boolean;

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



