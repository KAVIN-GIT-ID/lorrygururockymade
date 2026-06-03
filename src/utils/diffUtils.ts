import { Truck, Driver, Office, Account, SubTrip, TripEntry, ExpenseEntry, TripPayment, TripAdvance, FuelEntry, UserPermission } from '../types';

export const generateDiffText = <T extends Record<string, any>>(
  oldObj: T,
  newObj: T,
  labels: Partial<Record<keyof T, string>>,
  ignoreKeys: string[] = ['id']
): string => {
  const changes: string[] = [];
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)])) as Array<keyof T & string>;

  for (const key of allKeys) {
    if (ignoreKeys.includes(key)) continue;

    const oldValue = oldObj[key];
    const newValue = newObj[key];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      const label = labels[key] || (key as string);
      const oldStr = oldValue === undefined || oldValue === null || oldValue === '' ? '(None)' : String(oldValue);
      const newStr = newValue === undefined || newValue === null || newValue === '' ? '(None)' : String(newValue);
      changes.push(`${label}: "${oldStr}" ➔ "${newStr}"`);
    }
  }

  if (changes.length === 0) {
    return "";
  }
  return changes.join(" | ");
};

export const getUserPermissionDiff = (oldPerm: UserPermission, newPerm: UserPermission): string => {
  const labels: Partial<Record<keyof UserPermission, string>> = {
    email: 'User Email',
    name: 'User Name',
    role: 'User Role',
    isApproved: 'Approval Status',
    
    canViewTrips: 'View Trips',
    canEditTrips: 'Edit Trips',
    canDeleteTrips: 'Delete Trips',

    canViewTyres: 'View Tyres',
    canEditTyres: 'Edit Tyres',
    canDeleteTyres: 'Delete Tyres',

    canViewTrucks: 'View Trucks',
    canEditTrucks: 'Edit Trucks',
    canDeleteTrucks: 'Delete Trucks',

    canViewDrivers: 'View Drivers',
    canEditDrivers: 'Edit Drivers',
    canDeleteDrivers: 'Delete Drivers',

    canViewOffices: 'View Offices',
    canEditOffices: 'Edit Offices',
    canDeleteOffices: 'Delete Offices',

    canViewAccounts: 'View Accounts',
    canEditAccounts: 'Edit Accounts',
    canDeleteAccounts: 'Delete Accounts',

    canViewExpenses: 'View Expenses',
    canEditExpenses: 'Edit Expenses',
    canDeleteExpenses: 'Delete Expenses',

    canViewBackend: 'View Backend',
    canAddBackend: 'Add Backend',
    canEditBackend: 'Edit Backend',
    canDeleteBackend: 'Delete Backend',
    canApproveBackend: 'Approve Backend',
    canViewTruckRequests: 'View Truck Requests',
    canDeleteTruckRequests: 'Delete Truck Requests',
    canViewBackendTeam: 'View Backend Team',
    canDeleteBackendTeam: 'Delete Backend Team',
    canViewDatabaseConsole: 'View Database Console',
    canEditDatabaseConsole: 'Edit Database Console',
    canDeleteDatabaseConsole: 'Delete Database Console',
    canEditLoans: 'Edit Loans',
    canDeleteLoans: 'Delete Loans'
  };
  return generateDiffText(oldPerm, newPerm, labels, ['id', 'organizationId']);
};

export const getDriverDiff = (oldDriver: Driver, newDriver: Driver): string => {
  const labels: Partial<Record<keyof Driver, string>> = {
    driverName: 'Driver Name',
    phone: 'Phone Number',
    licenseNo: 'License Number',
    status: 'Active Status'
  };
  return generateDiffText(oldDriver, newDriver, labels);
};

export const getTruckDiff = (oldTruck: Truck, newTruck: Truck): string => {
  const labels: Partial<Record<keyof Truck, string>> = {
    truckNo: 'Vehicle No',
    ownerName: 'Owner Name',
    status: 'Active Status',
    make: 'Manufacturer Make',
    model: 'Vehicle Model',
    type: 'Vehicle Type',
    insuranceDate: 'Insurance Expiry Date',
    fcDate: 'Fitness Cert Expiry',
    pinpushKM: 'Pinpush Milestone',
    wheelGreaseKM: 'Wheel Grease Milestone',
    alignmentNextDate: 'Next Alignment Date',
    qTaxDate: 'Q Tax Expiry',
    greenTaxDate: 'Green Tax Expiry',
    npTaxDate: 'NP Tax Expiry',
    fiveYearPermitDate: '5-Yr Permit Expiry',
    currentKM: 'Current Odometer',
    engineOilKM: 'Engine Oil Target',
    crownOilKM: 'Crown Oil Target',
    gearBoxOilKM: 'Gear Box Oil Target',
    radiatorKM: 'Radiator Target',
    loanStartDate: 'Loan Start Date',
    loanRegisteredDate: 'Loan Registered Date',
    loanTenureMonths: 'Loan Tenure (Months)',
    loanEmiAmount: 'Loan EMI Amount',
    loanBankName: 'Loan Bank Name',
    loanStatus: 'Loan Status',
    loanNotes: 'Loan Notes'
  };
  return generateDiffText(oldTruck, newTruck, labels);
};

export const getOfficeDiff = (oldOffice: Office, newOffice: Office): string => {
  const labels: Partial<Record<keyof Office, string>> = {
    officeName: 'Office Name',
    city: 'Location/City',
    contactPerson: 'Contact Person',
    phone: 'Phone No',
    status: 'Active Status'
  };
  return generateDiffText(oldOffice, newOffice, labels);
};

export const getAccountDiff = (oldAccount: Account, newAccount: Account): string => {
  const labels: Partial<Record<keyof Account, string>> = {
    accountName: 'Account Name',
    type: 'Account Type',
    holderName: 'Account Holder Name',
    status: 'Ledger Status'
  };
  return generateDiffText(oldAccount, newAccount, labels);
};

export const getExpenseDiff = (oldExpense: ExpenseEntry, newExpense: ExpenseEntry): string => {
  const labels: Partial<Record<keyof ExpenseEntry, string>> = {
    truckNo: 'Vehicle No',
    expenseType: 'Expense Type',
    shopName: 'Vendor/Shop Name',
    amount: 'Expense Amount',
    paymentMode: 'Payment Account',
    date: 'Record Date',
    status: 'Approval Status',
    accountType: 'Payer Type',
    driverName: 'Paid By Operator'
  };
  return generateDiffText(oldExpense, newExpense, labels);
};

export const getTripDiff = (oldTrip: TripEntry, newTrip: TripEntry): string => {
  const changes: string[] = [];
  const simpleLabels: Partial<Record<keyof TripEntry, string>> = {
    tripNo: 'Trip ID',
    truckNo: 'Vehicle No',
    startDate: 'Start Date',
    endDate: 'End Date',
    driverName: 'Operator Name',
    startingKM: 'Start Odometer KM',
    endingKM: 'End Odometer KM',
    status: 'Trip Status',
    notes: 'General Remarks',
    rtoExpense: 'RTO Expense',
    dieselLiters: 'Diesel Liters',
    dieselRate: 'Diesel Rate',
    dieselAmount: 'Diesel Amount',
    addBlueExpense: 'Add Blue Expense',
    fastagExpense: 'Fastag Expense',
    otherExpense: 'Misc Other Expense',
    rtoPaidByDriver: 'RTO Paid by Driver',
    addBluePaidByDriver: 'Add Blue Paid by Driver',
    fastagPaidByDriver: 'Fastag Paid by Driver',
    otherPaidByDriver: 'Other Paid by Driver'
  };

  for (const k of Object.keys(simpleLabels) as Array<keyof TripEntry>) {
    const oldValue = oldTrip[k];
    const newValue = newTrip[k];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      const label = simpleLabels[k] || (k as string);
      const oldStr = oldValue === undefined || oldValue === null || oldValue === '' ? '(None)' : String(oldValue);
      const newStr = newValue === undefined || newValue === null || newValue === '' ? '(None)' : String(newValue);
      changes.push(`${label}: "${oldStr}" ➔ "${newStr}"`);
    }
  }

  const oldSub = oldTrip.subTrips || [];
  const newSub = newTrip.subTrips || [];

  // Added cargo segments
  const addedSubs = newSub.filter(nS => !oldSub.some(oS => oS.id === nS.id));
  for (const s of addedSubs) {
    changes.push(`Added Cargo Segment: "(None)" ➔ "${s.routeFrom} to ${s.routeTo} (Wages: ₹${s.driverWages}, Income: ₹${s.income})"`);
  }

  // Deleted cargo segments
  const deletedSubs = oldSub.filter(oS => !newSub.some(nS => nS.id === oS.id));
  for (const s of deletedSubs) {
    changes.push(`Deleted Cargo Segment: "${s.routeFrom} to ${s.routeTo} (Wages: ₹${s.driverWages}, Income: ₹${s.income})" ➔ "(None)"`);
  }

  // Modified cargo segments
  const modifiedSubs = newSub.filter(nS => oldSub.some(oS => oS.id === nS.id));
  for (const nS of modifiedSubs) {
    const oS = oldSub.find(o => o.id === nS.id)!;
    if (JSON.stringify(oS) !== JSON.stringify(nS)) {
      const subLabels: Partial<Record<keyof SubTrip, string>> = {
        loadingDate: 'Date',
        officeName: 'Office',
        routeFrom: 'Source',
        routeTo: 'Dest',
        income: 'Income',
        loadingExpense: 'Load Exp',
        unloadingExpense: 'Unload Exp',
        driverWages: 'Wages',
        startingKM: 'Start KM',
        endingKM: 'End KM',
        notes: 'Notes'
      };
      for (const key of Object.keys(subLabels) as Array<keyof SubTrip>) {
        const oldValue = oS[key];
        const newValue = nS[key];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          const label = `Seg [${oS.routeFrom} to ${oS.routeTo}] ${subLabels[key]}`;
          const oldStr = oldValue === undefined || oldValue === null || oldValue === '' ? '(None)' : String(oldValue);
          const newStr = newValue === undefined || newValue === null || newValue === '' ? '(None)' : String(newValue);
          changes.push(`${label}: "${oldStr}" ➔ "${newStr}"`);
        }
      }
    }
  }

  const oldPay = oldTrip.payments || [];
  const newPay = newTrip.payments || [];

  // Added Payments
  const addedPays = newPay.filter(nP => !oldPay.some(oP => oP.id === nP.id));
  for (const p of addedPays) {
    changes.push(`Added Payment: "(None)" ➔ "₹${p.amount} on ${p.date} (${p.notes || 'No Notes'})"`);
  }

  // Deleted Payments
  const deletedPays = oldPay.filter(oP => !newPay.some(nP => nP.id === oP.id));
  for (const p of deletedPays) {
    changes.push(`Deleted Payment: "₹${p.amount} on ${p.date} (${p.notes || 'No Notes'})" ➔ "(None)"`);
  }

  // Modified Payments
  const modifiedPays = newPay.filter(nP => oldPay.some(oP => oP.id === nP.id));
  for (const nP of modifiedPays) {
    const oP = oldPay.find(o => o.id === nP.id)!;
    if (JSON.stringify(oP) !== JSON.stringify(nP)) {
      const payLabels: Partial<Record<keyof TripPayment, string>> = {
        amount: 'Amount',
        date: 'Date',
        notes: 'Notes'
      };
      for (const key of Object.keys(payLabels) as Array<keyof TripPayment>) {
        const oldValue = oP[key];
        const newValue = nP[key];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          const label = `Payment [₹${oP.amount}] ${payLabels[key]}`;
          const oldStr = oldValue === undefined || oldValue === null || oldValue === '' ? '(None)' : String(oldValue);
          const newStr = newValue === undefined || newValue === null || newValue === '' ? '(None)' : String(newValue);
          changes.push(`${label}: "${oldStr}" ➔ "${newStr}"`);
        }
      }
    }
  }

  const oldAdv = oldTrip.advances || [];
  const newAdv = newTrip.advances || [];

  // Added Advances
  const addedAdvs = newAdv.filter(nA => !oldAdv.some(oA => oA.id === nA.id));
  for (const a of addedAdvs) {
    changes.push(`Added Advance: "(None)" ➔ "₹${a.amount} on ${a.date} (${a.notes || 'No Notes'})"`);
  }

  // Deleted Advances
  const deletedAdvs = oldAdv.filter(oA => !newAdv.some(nA => nA.id === oA.id));
  for (const a of deletedAdvs) {
    changes.push(`Deleted Advance: "₹${a.amount} on ${a.date} (${a.notes || 'No Notes'})" ➔ "(None)"`);
  }

  // Modified Advances
  const modifiedAdvs = newAdv.filter(nA => oldAdv.some(oA => oA.id === nA.id));
  for (const nA of modifiedAdvs) {
    const oA = oldAdv.find(o => o.id === nA.id)!;
    if (JSON.stringify(oA) !== JSON.stringify(nA)) {
      const advLabels: Partial<Record<keyof TripAdvance, string>> = {
        amount: 'Amount',
        date: 'Date',
        notes: 'Notes'
      };
      for (const key of Object.keys(advLabels) as Array<keyof TripAdvance>) {
        const oldValue = oA[key];
        const newValue = nA[key];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          const label = `Advance [₹${oA.amount}] ${advLabels[key]}`;
          const oldStr = oldValue === undefined || oldValue === null || oldValue === '' ? '(None)' : String(oldValue);
          const newStr = newValue === undefined || newValue === null || newValue === '' ? '(None)' : String(newValue);
          changes.push(`${label}: "${oldStr}" ➔ "${newStr}"`);
        }
      }
    }
  }

  const oldFuel = oldTrip.fuels || [];
  const newFuel = newTrip.fuels || [];

  // Added Fuels
  const addedFuels = newFuel.filter(nF => !oldFuel.some(oF => oF.id === nF.id));
  for (const f of addedFuels) {
    changes.push(`Added Fuel: "(None)" ➔ "${f.liters}L @ ₹${f.rate}/L = ₹${f.amount} at ${f.shopName || 'Bunk'}"`);
  }

  // Deleted Fuels
  const deletedFuels = oldFuel.filter(oF => !newFuel.some(nF => nF.id === oF.id));
  for (const f of deletedFuels) {
    changes.push(`Deleted Fuel: "${f.liters}L @ ₹${f.rate}/L = ₹${f.amount} at ${f.shopName || 'Bunk'}" ➔ "(None)"`);
  }

  // Modified Fuels
  const modifiedFuels = newFuel.filter(nF => oldFuel.some(oF => oF.id === nF.id));
  for (const nF of modifiedFuels) {
    const oF = oldFuel.find(o => o.id === nF.id)!;
    if (JSON.stringify(oF) !== JSON.stringify(nF)) {
      const fuelLabels: Partial<Record<keyof FuelEntry, string>> = {
        liters: 'Liters',
        rate: 'Rate',
        amount: 'Amount',
        shopName: 'Bunk Name',
        date: 'Date'
      };
      for (const key of Object.keys(fuelLabels) as Array<keyof FuelEntry>) {
        const oldValue = oF[key];
        const newValue = nF[key];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          const label = `Fuel [₹${oF.amount}] ${fuelLabels[key]}`;
          const oldStr = oldValue === undefined || oldValue === null || oldValue === '' ? '(None)' : String(oldValue);
          const newStr = newValue === undefined || newValue === null || newValue === '' ? '(None)' : String(newValue);
          changes.push(`${label}: "${oldStr}" ➔ "${newStr}"`);
        }
      }
    }
  }

  if (changes.length === 0) {
    return "";
  }
  return changes.join(" | ");
};
