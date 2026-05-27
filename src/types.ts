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
}

export function getTripMetrics(trip: TripEntry): TripMetrics {
  const subTrips = trip.subTrips || [];
  
  const income = subTrips.reduce((sum, s) => sum + (Number(s.income) || 0), 0);
  const loadingExpense = subTrips.reduce((sum, s) => sum + (Number(s.loadingExpense) || 0), 0);
  const unloadingExpense = subTrips.reduce((sum, s) => sum + (Number(s.unloadingExpense) || 0), 0);
  const brokerageExpense = subTrips.reduce((sum, s) => sum + (Number(s.brokerageExpense) || 0), 0);
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
  
  const totalExpense = loadingExpense + unloadingExpense + brokerageExpense + rtoExpense + dieselExpense + addBlueExpense + fastagExpense + driverWages + otherExpense;
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
  const outstandingBalance = income - paymentsReceived;
  
  return {
    income,
    loadingExpense,
    unloadingExpense,
    brokerageExpense,
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
    outstandingBalance
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
}



