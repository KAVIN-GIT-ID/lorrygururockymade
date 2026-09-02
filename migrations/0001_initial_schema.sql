-- Cloudflare D1 Database Schema for Truck Trip Tracker
-- Version 1.0.0

CREATE TABLE IF NOT EXISTS global_configs (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email_verified INTEGER DEFAULT 0,
  phone_verified INTEGER DEFAULT 0,
  organization_id TEXT DEFAULT 'org_default',
  role TEXT DEFAULT 'Custom',
  permissions TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS trucks (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  truckNo TEXT NOT NULL,
  ownerName TEXT,
  status TEXT DEFAULT 'Active',
  isApproved INTEGER DEFAULT 0,
  requestStatus TEXT DEFAULT 'Pending',
  registrationExpiryDate TEXT,
  rcFileId TEXT,
  insuranceFileId TEXT,
  make TEXT,
  model TEXT,
  type TEXT,
  insuranceDate TEXT,
  fcDate TEXT,
  pinpushKM REAL,
  wheelGreaseKM REAL,
  alignmentNextDate TEXT,
  qTaxDate TEXT,
  greenTaxDate TEXT,
  npTaxDate TEXT,
  fiveYearPermitDate TEXT,
  currentKM REAL,
  engineOilKM REAL,
  crownOilKM REAL,
  gearBoxOilKM REAL,
  radiatorKM REAL,
  engineOilIntervalKM REAL,
  crownOilIntervalKM REAL,
  gearBoxIntervalKM REAL,
  radiatorIntervalKM REAL,
  pinpushIntervalKM REAL,
  wheelGreaseIntervalKM REAL,
  loanStartDate TEXT,
  loanRegisteredDate TEXT,
  loanTenureMonths REAL,
  loanEmiAmount REAL,
  loanBankName TEXT,
  loanStatus TEXT,
  loanNotes TEXT,
  loans TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trucks_org ON trucks(organizationId);
CREATE INDEX IF NOT EXISTS idx_trucks_no ON trucks(truckNo);

CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  driverName TEXT NOT NULL,
  phone TEXT,
  licenseNo TEXT,
  status TEXT DEFAULT 'Active',
  licenseFileId TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drivers_org ON drivers(organizationId);

CREATE TABLE IF NOT EXISTS offices (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  officeName TEXT NOT NULL,
  city TEXT,
  contactPerson TEXT,
  phone TEXT,
  status TEXT DEFAULT 'Active',
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offices_org ON offices(organizationId);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  accountName TEXT NOT NULL,
  type TEXT DEFAULT 'Bank',
  holderName TEXT,
  status TEXT DEFAULT 'Active',
  bankName TEXT,
  accountNo TEXT,
  ifscCode TEXT,
  branchName TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounts_org ON accounts(organizationId);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  tripNo TEXT NOT NULL,
  truckNo TEXT NOT NULL,
  startDate TEXT,
  endDate TEXT,
  driverName TEXT,
  startingKM REAL,
  endingKM REAL,
  status TEXT DEFAULT 'Pending',
  notes TEXT,
  rtoExpense REAL,
  dieselLiters REAL,
  dieselRate REAL,
  dieselAmount REAL,
  addBlueExpense REAL,
  fastagExpense REAL,
  otherExpense REAL,
  rtoPaidByDriver INTEGER DEFAULT 0,
  addBluePaidByDriver INTEGER DEFAULT 0,
  fastagPaidByDriver INTEGER DEFAULT 0,
  otherPaidByDriver INTEGER DEFAULT 0,
  payments TEXT,
  advances TEXT,
  fuels TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trips_org ON trips(organizationId);
CREATE INDEX IF NOT EXISTS idx_trips_truck ON trips(truckNo);

CREATE TABLE IF NOT EXISTS sub_trips (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  tripId TEXT NOT NULL,
  officeName TEXT,
  routeFrom TEXT,
  routeTo TEXT,
  income REAL DEFAULT 0,
  loadingDate TEXT,
  loadingExpense REAL DEFAULT 0,
  unloadingExpense REAL DEFAULT 0,
  driverWages REAL DEFAULT 0,
  startingKM REAL DEFAULT 0,
  endingKM REAL DEFAULT 0,
  notes TEXT,
  rtoExpense REAL DEFAULT 0,
  dieselLiters REAL DEFAULT 0,
  dieselRate REAL DEFAULT 0,
  dieselAmount REAL DEFAULT 0,
  addBlueExpense REAL DEFAULT 0,
  fastagExpense REAL DEFAULT 0,
  otherExpense REAL DEFAULT 0,
  loadingPaidByDriver INTEGER DEFAULT 0,
  unloadingPaidByDriver INTEGER DEFAULT 0,
  brokerageExpense REAL DEFAULT 0,
  brokeragePaidByDriver INTEGER DEFAULT 0,
  loadingDeductedFrom TEXT DEFAULT 'DriverDirect',
  loadingBears TEXT DEFAULT 'Org',
  unloadingDeductedFrom TEXT DEFAULT 'DriverDirect',
  unloadingBears TEXT DEFAULT 'Org',
  brokerageDeductedFrom TEXT DEFAULT 'DriverDirect',
  brokerageBears TEXT DEFAULT 'Driver',
  crossingExpense REAL DEFAULT 0,
  crossingPaidByDriver INTEGER DEFAULT 0,
  crossingDeductedFrom TEXT DEFAULT 'DriverDirect',
  crossingBears TEXT DEFAULT 'Org',
  rmcExpense REAL DEFAULT 0,
  rmcPaidByDriver INTEGER DEFAULT 0,
  rmcDeductedFrom TEXT DEFAULT 'DriverDirect',
  rmcBears TEXT DEFAULT 'Org',
  loadingBearsOrg REAL DEFAULT 0,
  loadingBearsDriver REAL DEFAULT 0,
  unloadingBearsOrg REAL DEFAULT 0,
  unloadingBearsDriver REAL DEFAULT 0,
  brokerageBearsOrg REAL DEFAULT 0,
  brokerageBearsDriver REAL DEFAULT 0,
  crossingBearsOrg REAL DEFAULT 0,
  crossingBearsDriver REAL DEFAULT 0,
  rmcBearsOrg REAL DEFAULT 0,
  rmcBearsDriver REAL DEFAULT 0,
  noOfTons REAL DEFAULT 0,
  material TEXT,
  ratePerTon REAL DEFAULT 0,
  cargoExpenses TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tripId) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subtrips_tripId ON sub_trips(tripId);
CREATE INDEX IF NOT EXISTS idx_subtrips_org ON sub_trips(organizationId);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  truckNo TEXT NOT NULL,
  expenseType TEXT,
  shopName TEXT,
  amount REAL DEFAULT 0,
  paymentMode TEXT,
  date TEXT,
  status TEXT DEFAULT 'Pending',
  accountType TEXT,
  driverName TEXT,
  notes TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organizationId);
CREATE INDEX IF NOT EXISTS idx_expenses_truck ON expenses(truckNo);

CREATE TABLE IF NOT EXISTS tyres (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  tyreNo TEXT NOT NULL,
  manufacturer TEXT,
  size TEXT,
  status TEXT DEFAULT 'Available',
  currentTruckNo TEXT,
  installationDate TEXT,
  installationKM REAL,
  accumulatedKM REAL,
  purchaseDate TEXT,
  purchaseAmount REAL,
  saleDate TEXT,
  saleAmount REAL,
  movementHistory TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tyres_org ON tyres(organizationId);
CREATE INDEX IF NOT EXISTS idx_tyres_no ON tyres(tyreNo);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  ticketNo TEXT,
  requesterName TEXT,
  requesterEmail TEXT,
  requesterPhone TEXT,
  category TEXT,
  title TEXT,
  description TEXT,
  status TEXT DEFAULT 'Open',
  assignedTeam TEXT,
  assignedTo TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_org ON support_tickets(organizationId);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  timestamp TEXT NOT NULL,
  user TEXT,
  action TEXT,
  category TEXT,
  reference TEXT,
  details TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organizationId);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp);

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  code TEXT UNIQUE NOT NULL,
  discountType TEXT NOT NULL,
  discountValue REAL NOT NULL,
  usageLimit INTEGER DEFAULT 100,
  usedCount INTEGER DEFAULT 0,
  expiryDate TEXT,
  status TEXT DEFAULT 'Active',
  createdBy TEXT,
  notes TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  truckNo TEXT NOT NULL,
  amount REAL NOT NULL,
  transactionId TEXT UNIQUE NOT NULL,
  paymentDate TEXT NOT NULL,
  duration TEXT NOT NULL,
  status TEXT DEFAULT 'Success',
  customerEmail TEXT,
  customerName TEXT,
  customerPhone TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_txn ON payments(transactionId);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organizationId);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL DEFAULT 'org_default',
  name TEXT NOT NULL,
  mimeType TEXT NOT NULL,
  size INTEGER NOT NULL,
  data TEXT NOT NULL, -- Base64 encoded binary payload
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_files_id ON files(id);
CREATE INDEX IF NOT EXISTS idx_files_org ON files(organizationId);
