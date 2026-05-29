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

export interface CargoExpense {
  id: string;
  expenseType: 'Loading' | 'Unloading' | 'Brokerage' | 'Crossing' | 'RMC';
  amount: number;
  paidByDriver: boolean;
  deductedFrom: 'OrgRental' | 'DriverDirect';
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

  // RMC fields
  rmcExpense?: number;
  rmcPaidByDriver?: boolean;
  rmcDeductedFrom?: 'OrgRental' | 'DriverDirect';
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
}

export function getTripMetrics(trip: TripEntry): TripMetrics {
  const subTrips = trip.subTrips || [];
  
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
    if (s.cargoExpenses && s.cargoExpenses.length > 0) {
      for (const exp of s.cargoExpenses) {
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
    } else {
      // Legacy fallback
      // 1. Loading
      const loadAmt = Number(s.loadingExpense) || 0;
      const loadDeductedFrom = s.loadingDeductedFrom || 'DriverDirect';
      const loadBears = s.loadingBears || 'Org';
      const loadBearsOrg = s.loadingBearsOrg !== undefined ? Number(s.loadingBearsOrg) : (loadBears === 'Org' ? loadAmt : 0);
      const loadBearsDriver = s.loadingBearsDriver !== undefined ? Number(s.loadingBearsDriver) : (loadBears === 'Driver' ? loadAmt : 0);
      const loadPaidByDriver = !!s.loadingPaidByDriver;

      // 2. Unloading
      const unloadAmt = Number(s.unloadingExpense) || 0;
      const unloadDeductedFrom = s.unloadingDeductedFrom || 'DriverDirect';
      const unloadBears = s.unloadingBears || 'Org';
      const unloadBearsOrg = s.unloadingBearsOrg !== undefined ? Number(s.unloadingBearsOrg) : (unloadBears === 'Org' ? unloadAmt : 0);
      const unloadBearsDriver = s.unloadingBearsDriver !== undefined ? Number(s.unloadingBearsDriver) : (unloadBears === 'Driver' ? unloadAmt : 0);
      const unloadPaidByDriver = !!s.unloadingPaidByDriver;

      // 3. Brokerage
      const brokerageAmt = Number(s.brokerageExpense) || 0;
      const brokerageDeductedFrom = s.brokerageDeductedFrom || 'DriverDirect';
      const brokerageBears = s.brokerageBears || 'Driver';
      const brokerageBearsOrg = s.brokerageBearsOrg !== undefined ? Number(s.brokerageBearsOrg) : (brokerageBears === 'Org' ? brokerageAmt : 0);
      const brokerageBearsDriver = s.brokerageBearsDriver !== undefined ? Number(s.brokerageBearsDriver) : (brokerageBears === 'Driver' ? brokerageAmt : 0);
      const brokeragePaidByDriver = !!s.brokeragePaidByDriver;

      // 4. Crossing
      const crossingAmt = Number(s.crossingExpense) || 0;
      const crossingDeductedFrom = s.crossingDeductedFrom || 'DriverDirect';
      const crossingBears = s.crossingBears || 'Org';
      const crossingBearsOrg = s.crossingBearsOrg !== undefined ? Number(s.crossingBearsOrg) : (crossingBears === 'Org' ? crossingAmt : 0);
      const crossingBearsDriver = s.crossingBearsDriver !== undefined ? Number(s.crossingBearsDriver) : (crossingBears === 'Driver' ? crossingAmt : 0);
      const crossingPaidByDriver = !!s.crossingPaidByDriver;

      // 5. RMC
      const rmcAmt = Number(s.rmcExpense) || 0;
      const rmcDeductedFrom = s.rmcDeductedFrom || 'DriverDirect';
      const rmcBears = s.rmcBears || 'Org';
      const rmcBearsOrg = s.rmcBearsOrg !== undefined ? Number(s.rmcBearsOrg) : (rmcBears === 'Org' ? rmcAmt : 0);
      const rmcBearsDriver = s.rmcBearsDriver !== undefined ? Number(s.rmcBearsDriver) : (rmcBears === 'Driver' ? rmcAmt : 0);
      const rmcPaidByDriver = !!s.rmcPaidByDriver;

      // Sum up Category Expenses (Org Borne)
      loadingExpense += loadBearsOrg;
      unloadingExpense += unloadBearsOrg;
      brokerageExpense += brokerageBearsOrg;
      crossingExpense += crossingBearsOrg;
      rmcExpense += rmcBearsOrg;

      // Rental deductions
      if (loadDeductedFrom === 'OrgRental') totalOrgRentalDeductions += loadAmt;
      if (unloadDeductedFrom === 'OrgRental') totalOrgRentalDeductions += unloadAmt;
      if (brokerageDeductedFrom === 'OrgRental') totalOrgRentalDeductions += brokerageAmt;
      if (crossingDeductedFrom === 'OrgRental') totalOrgRentalDeductions += crossingAmt;
      if (rmcDeductedFrom === 'OrgRental') totalOrgRentalDeductions += rmcAmt;

      // Driver paid direct
      if (loadPaidByDriver) driverPaidDirect += loadBearsOrg;
      if (unloadPaidByDriver) driverPaidDirect += unloadBearsOrg;
      if (brokeragePaidByDriver) driverPaidDirect += brokerageBearsOrg;
      if (crossingPaidByDriver) driverPaidDirect += crossingBearsOrg;
      if (rmcPaidByDriver) driverPaidDirect += rmcBearsOrg;

      // Driver recovery
      if (!loadPaidByDriver) driverRecovery += loadBearsDriver;
      if (!unloadPaidByDriver) driverRecovery += unloadBearsDriver;
      if (!brokeragePaidByDriver) driverRecovery += brokerageBearsDriver;
      if (!crossingPaidByDriver) driverRecovery += crossingBearsDriver;
      if (!rmcPaidByDriver) driverRecovery += rmcBearsDriver;
    }
  }

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
  
  const totalExpense = loadingExpense + unloadingExpense + brokerageExpense + crossingExpense + rmcExpense + rtoExpense + dieselExpense + addBlueExpense + fastagExpense + driverWages + otherExpense;
  const profit = income - totalExpense;
  
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
  
  const paymentsReceived = (trip.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const outstandingBalance = income - totalOrgRentalDeductions + officeBearsExpenseTotal - paymentsReceived;

  // Fuels paid by driver
  const fuelsDriverSpend = (trip.fuels || []).reduce((sum, f) => {
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

  const totalDriverSpend = fuelsDriverSpend + tripLevelDriverSpend + driverPaidDirect + driverWages;

  // Driver Advances (Category 4)
  const category4CategoryAdvances = (trip.advances || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  // Category 3 paid to driver advance
  const category3DriverAdvancePayments = (trip.payments || [])
    .filter(p => p.receivedBy === 'paid_to_driver_advance')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalIssuedToDriver = category4CategoryAdvances + category3DriverAdvancePayments;
  const driverBalance = totalDriverSpend - (totalIssuedToDriver + driverRecovery);
  
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
    driverBalance
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



