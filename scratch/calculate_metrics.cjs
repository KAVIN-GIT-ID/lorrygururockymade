const { Client, Databases } = require('node-appwrite');
require('dotenv').config({ path: 'c:/Users/infimove/antigravity/Truck-Trip-Tracker/.env' });

function parseField(field) {
  if (!field) return [];
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      return [];
    }
  }
  return field;
}

function getTripMetrics(trip) {
  const subTrips = parseField(trip.subTrips);
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
    const expenses = parseField(s.cargoExpenses);
    if (expenses && expenses.length > 0) {
      for (const exp of expenses) {
        const amount = Number(exp.amount) || 0;
        const isPaidByDriver = !!exp.paidByDriver;
        const isDeductedFromOrgRental = exp.deductedFrom === 'OrgRental';

        if (isDeductedFromOrgRental) totalOrgRentalDeductions += amount;

        if (exp.bears === 'Org') {
          if (exp.expenseType === 'Loading') loadingExpense += amount;
          else if (exp.expenseType === 'Unloading') unloadingExpense += amount;
          else if (exp.expenseType === 'Brokerage') brokerageExpense += amount;
          else if (exp.expenseType === 'Crossing') crossingExpense += amount;
          else if (exp.expenseType === 'RMC') rmcExpense += amount;

          if (isPaidByDriver) driverPaidDirect += amount;
        } else if (exp.bears === 'Driver') {
          if (!isPaidByDriver) driverRecovery += amount;
        } else if (exp.bears === 'Office') {
          officeBearsExpenseTotal += amount;
          if (isPaidByDriver) driverPaidDirect += amount;
        }
      }
    } else {
      // Legacy fallback
      const loadAmt = Number(s.loadingExpense) || 0;
      const loadDeductedFrom = s.loadingDeductedFrom || 'DriverDirect';
      const loadBears = s.loadingBears || 'Org';
      const loadBearsOrg = s.loadingBearsOrg !== undefined ? Number(s.loadingBearsOrg) : (loadBears === 'Org' ? loadAmt : 0);
      const loadBearsDriver = s.loadingBearsDriver !== undefined ? Number(s.loadingBearsDriver) : (loadBears === 'Driver' ? loadAmt : 0);
      const loadPaidByDriver = !!s.loadingPaidByDriver;

      const unloadAmt = Number(s.unloadingExpense) || 0;
      const unloadDeductedFrom = s.unloadingDeductedFrom || 'DriverDirect';
      const unloadBears = s.unloadingBears || 'Org';
      const unloadBearsOrg = s.unloadingBearsOrg !== undefined ? Number(s.unloadingBearsOrg) : (unloadBears === 'Org' ? unloadAmt : 0);
      const unloadBearsDriver = s.unloadingBearsDriver !== undefined ? Number(s.unloadingBearsDriver) : (unloadBears === 'Driver' ? unloadAmt : 0);
      const unloadPaidByDriver = !!s.unloadingPaidByDriver;

      const brokerageAmt = Number(s.brokerageExpense) || 0;
      const brokerageDeductedFrom = s.brokerageDeductedFrom || 'DriverDirect';
      const brokerageBears = s.brokerageBears || 'Driver';
      const brokerageBearsOrg = s.brokerageBearsOrg !== undefined ? Number(s.brokerageBearsOrg) : (brokerageBears === 'Org' ? brokerageAmt : 0);
      const brokerageBearsDriver = s.brokerageBearsDriver !== undefined ? Number(s.brokerageBearsDriver) : (brokerageBears === 'Driver' ? brokerageAmt : 0);
      const brokeragePaidByDriver = !!s.brokeragePaidByDriver;

      const crossingAmt = Number(s.crossingExpense) || 0;
      const crossingDeductedFrom = s.crossingDeductedFrom || 'DriverDirect';
      const crossingBears = s.crossingBears || 'Org';
      const crossingBearsOrg = s.crossingBearsOrg !== undefined ? Number(s.crossingBearsOrg) : (crossingBears === 'Org' ? crossingAmt : 0);
      const crossingBearsDriver = s.crossingBearsDriver !== undefined ? Number(s.crossingBearsDriver) : (crossingBears === 'Driver' ? crossingAmt : 0);
      const crossingPaidByDriver = !!s.crossingPaidByDriver;

      const rmcAmt = Number(s.rmcExpense) || 0;
      const rmcDeductedFrom = s.rmcDeductedFrom || 'DriverDirect';
      const rmcBears = s.rmcBears || 'Org';
      const rmcBearsOrg = s.rmcBearsOrg !== undefined ? Number(s.rmcBearsOrg) : (rmcBears === 'Org' ? rmcAmt : 0);
      const rmcBearsDriver = s.rmcBearsDriver !== undefined ? Number(s.rmcBearsDriver) : (rmcBears === 'Driver' ? rmcAmt : 0);
      const rmcPaidByDriver = !!s.rmcPaidByDriver;

      loadingExpense += loadBearsOrg;
      unloadingExpense += unloadBearsOrg;
      brokerageExpense += brokerageBearsOrg;
      crossingExpense += crossingBearsOrg;
      rmcExpense += rmcBearsOrg;

      if (loadDeductedFrom === 'OrgRental') totalOrgRentalDeductions += loadAmt;
      if (unloadDeductedFrom === 'OrgRental') totalOrgRentalDeductions += unloadAmt;
      if (brokerageDeductedFrom === 'OrgRental') totalOrgRentalDeductions += brokerageAmt;
      if (crossingDeductedFrom === 'OrgRental') totalOrgRentalDeductions += crossingAmt;
      if (rmcDeductedFrom === 'OrgRental') totalOrgRentalDeductions += rmcAmt;

      if (loadPaidByDriver) driverPaidDirect += loadBearsOrg;
      if (unloadPaidByDriver) driverPaidDirect += unloadBearsOrg;
      if (brokeragePaidByDriver) driverPaidDirect += brokerageBearsOrg;
      if (crossingPaidByDriver) driverPaidDirect += crossingBearsOrg;
      if (rmcPaidByDriver) driverPaidDirect += rmcBearsOrg;

      if (!loadPaidByDriver) driverRecovery += loadBearsDriver;
      if (!unloadPaidByDriver) driverRecovery += unloadBearsDriver;
      if (!brokeragePaidByDriver) driverRecovery += brokerageBearsDriver;
      if (!crossingPaidByDriver) driverRecovery += crossingBearsDriver;
      if (!rmcPaidByDriver) driverRecovery += rmcBearsDriver;
    }
  }

  const driverWages = subTrips.reduce((sum, s) => sum + (Number(s.driverWages) || 0), 0);
  const rtoExpense = trip.rtoExpense !== undefined ? Number(trip.rtoExpense) : subTrips.reduce((sum, s) => sum + (Number(s.rtoExpense) || 0), 0);

  const fuels = parseField(trip.fuels);
  const fuelLiters = fuels.length > 0
    ? fuels.reduce((sum, f) => sum + (Number(f.liters) || 0), 0)
    : (trip.dieselLiters !== undefined ? Number(trip.dieselLiters) : subTrips.reduce((sum, s) => sum + (Number(s.dieselLiters) || 0), 0));

  const dieselExpense = fuels.length > 0
    ? fuels.reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
    : (trip.dieselAmount !== undefined ? Number(trip.dieselAmount) : subTrips.reduce((sum, s) => sum + (Number(s.dieselAmount) || 0), 0));

  const addBlueExpense = trip.addBlueExpense !== undefined ? Number(trip.addBlueExpense) : subTrips.reduce((sum, s) => sum + (Number(s.addBlueExpense) || 0), 0);
  const fastagExpense = trip.fastagExpense !== undefined ? Number(trip.fastagExpense) : subTrips.reduce((sum, s) => sum + (Number(s.fastagExpense) || 0), 0);
  const otherExpense = trip.otherExpense !== undefined ? Number(trip.otherExpense) : subTrips.reduce((sum, s) => sum + (Number(s.otherExpense) || 0), 0);

  const fuelsDriverSpend = fuels.reduce((sum, f) => {
    if (f.paymentMode === 'driver' || f.paymentMode === 'Driver') {
      return sum + (Number(f.amount) || 0);
    }
    return sum;
  }, 0);

  let tripLevelDriverSpend = 0;
  if (trip.rtoPaidByDriver && rtoExpense) tripLevelDriverSpend += rtoExpense;
  if (trip.addBluePaidByDriver && addBlueExpense) tripLevelDriverSpend += addBlueExpense;
  if (trip.fastagPaidByDriver && fastagExpense) tripLevelDriverSpend += fastagExpense;
  if (trip.otherPaidByDriver && otherExpense) tripLevelDriverSpend += otherExpense;

  const totalDriverSpend = fuelsDriverSpend + tripLevelDriverSpend + driverPaidDirect + driverWages;
  const advances = parseField(trip.advances);
  const category4CategoryAdvances = advances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  const payments = parseField(trip.payments);
  const category3DriverAdvancePayments = payments
    .filter(p => p.receivedBy === 'paid_to_driver_advance')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalIssuedToDriver = category4CategoryAdvances + category3DriverAdvancePayments;
  const driverBalance = totalDriverSpend - (totalIssuedToDriver + driverRecovery);

  return {
    driverWages,
    fuelsDriverSpend,
    tripLevelDriverSpend,
    driverPaidDirect,
    totalDriverSpend,
    category4CategoryAdvances,
    category3DriverAdvancePayments,
    totalIssuedToDriver,
    driverRecovery,
    driverBalance,
    advances
  };
}

async function run() {
  const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://api.lorryguru.in/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6a1c5f2700246e86a727')
    .setKey(process.env.VITE_APPWRITE_API_KEY || 'your-key');

  const databases = new Databases(client);
  const dbId = process.env.VITE_APPWRITE_DATABASE_ID || 'fleet_db';

  try {
    const list = await databases.listDocuments(dbId, 'trips');
    list.documents.forEach(doc => {
      if (doc.tripNo === 'TRIP-2026-0008') {
        console.log('\n=== TRIP-2026-0008 Details ===');
        const metrics = getTripMetrics(doc);
        console.log(metrics);
      }
    });
  } catch (err) {
    console.error(err);
  }
}

run();
