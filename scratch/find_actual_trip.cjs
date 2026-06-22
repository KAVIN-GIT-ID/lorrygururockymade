const { Client, Databases, Query } = require('node-appwrite');
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

function calculateDriverMetrics(trip) {
  const subTrips = trip.subTrips || [];
  const fuels = parseField(trip.fuels) || [];
  const advances = parseField(trip.advances) || [];
  const payments = parseField(trip.payments) || [];

  const fuelsDriverSpend = fuels.reduce((sum, f) => {
    if (f.paymentMode === 'driver' || f.paymentMode === 'Driver') {
      return sum + (Number(f.amount) || 0);
    }
    return sum;
  }, 0);

  const rtoExpense = Number(trip.rtoExpense) || 0;
  const rtoPaidByDriver = !!trip.rtoPaidByDriver;
  const addBlueExpense = Number(trip.addBlueExpense) || 0;
  const addBluePaidByDriver = !!trip.addBluePaidByDriver;
  const fastagExpense = Number(trip.fastagExpense) || 0;
  const fastagPaidByDriver = !!trip.fastagPaidByDriver;
  const otherExpense = Number(trip.otherExpense) || 0;
  const otherPaidByDriver = !!trip.otherPaidByDriver;

  let tripLevelDriverSpend = 0;
  if (rtoPaidByDriver && rtoExpense) tripLevelDriverSpend += rtoExpense;
  if (addBluePaidByDriver && addBlueExpense) tripLevelDriverSpend += addBlueExpense;
  if (fastagPaidByDriver && fastagExpense) tripLevelDriverSpend += fastagExpense;
  if (otherPaidByDriver && otherExpense) tripLevelDriverSpend += otherExpense;

  let subTripsDriverSpend = 0;
  let driverRecovery = 0;

  subTrips.forEach((st) => {
    const expenses = parseField(st.cargoExpenses);
    if (expenses && expenses.length > 0) {
      for (const exp of expenses) {
        const amount = Number(exp.amount) || 0;
        const isPaidByDriver = !!exp.paidByDriver;
        if (exp.bears === 'Org' || exp.bears === 'Office') {
          if (isPaidByDriver) subTripsDriverSpend += amount;
        } else if (exp.bears === 'Driver') {
          if (!isPaidByDriver) driverRecovery += amount;
        }
      }
    } else {
      const loadAmt = Number(st.loadingExpense) || 0;
      const loadBearsOrg = st.loadingBearsOrg !== undefined ? Number(st.loadingBearsOrg) : (st.loadingBears === 'Org' ? loadAmt : 0);
      const loadBearsDriver = st.loadingBearsDriver !== undefined ? Number(st.loadingBearsDriver) : (st.loadingBears === 'Driver' ? loadAmt : 0);
      if (st.loadingPaidByDriver) subTripsDriverSpend += loadBearsOrg;
      else driverRecovery += loadBearsDriver;

      const unloadAmt = Number(st.unloadingExpense) || 0;
      const unloadBearsOrg = st.unloadingBearsOrg !== undefined ? Number(st.unloadingBearsOrg) : (st.unloadingBears === 'Org' ? unloadAmt : 0);
      const unloadBearsDriver = st.unloadingBearsDriver !== undefined ? Number(st.unloadingBearsDriver) : (st.unloadingBears === 'Driver' ? unloadAmt : 0);
      if (st.unloadingPaidByDriver) subTripsDriverSpend += unloadBearsOrg;
      else driverRecovery += unloadBearsDriver;

      const brokerageAmt = Number(st.brokerageExpense) || 0;
      const brokerageBearsOrg = st.brokerageBearsOrg !== undefined ? Number(st.brokerageBearsOrg) : (st.brokerageBears === 'Org' ? brokerageAmt : 0);
      const brokerageBearsDriver = st.brokerageBearsDriver !== undefined ? Number(st.brokerageBearsDriver) : (st.brokerageBears === 'Driver' ? brokerageAmt : 0);
      if (st.brokeragePaidByDriver) subTripsDriverSpend += brokerageBearsOrg;
      else driverRecovery += brokerageBearsDriver;

      const crossingAmt = Number(st.crossingExpense) || 0;
      const crossingBearsOrg = st.crossingBearsOrg !== undefined ? Number(st.crossingBearsOrg) : (st.crossingBears === 'Org' ? crossingAmt : 0);
      const crossingBearsDriver = st.crossingBearsDriver !== undefined ? Number(st.crossingBearsDriver) : (st.crossingBears === 'Driver' ? crossingAmt : 0);
      if (st.crossingPaidByDriver) subTripsDriverSpend += crossingBearsOrg;
      else driverRecovery += crossingBearsDriver;

      const rmcAmt = Number(st.rmcExpense) || 0;
      const rmcBearsOrg = st.rmcBearsOrg !== undefined ? Number(st.rmcBearsOrg) : (st.rmcBears === 'Org' ? rmcAmt : 0);
      const rmcBearsDriver = st.rmcBearsDriver !== undefined ? Number(st.rmcBearsDriver) : (st.rmcBears === 'Driver' ? rmcAmt : 0);
      if (st.rmcPaidByDriver) subTripsDriverSpend += rmcBearsOrg;
      else driverRecovery += rmcBearsDriver;
    }

    if (st.driverWages) {
      subTripsDriverSpend += Number(st.driverWages) || 0;
    }
  });

  const totalDriverSpend = fuelsDriverSpend + tripLevelDriverSpend + subTripsDriverSpend;
  const category4CategoryAdvances = advances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const category3DriverAdvancePayments = payments
    .filter(p => p.receivedBy === 'paid_to_driver_advance')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalIssuedToDriver = category4CategoryAdvances + category3DriverAdvancePayments;
  const driverBalance = totalDriverSpend - (totalIssuedToDriver + driverRecovery);

  return {
    totalDriverSpend,
    totalIssuedToDriver,
    driverRecovery,
    driverBalance,
    subTripsDriverSpend,
    fuelsDriverSpend,
    tripLevelDriverSpend
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
    const tripList = await databases.listDocuments(dbId, 'trips', [Query.limit(5000)]);
    const subTripList = await databases.listDocuments(dbId, 'sub_trips', [Query.limit(5000)]);

    const subTripsByTripId = {};
    subTripList.documents.forEach(doc => {
      const tripId = doc.tripId;
      if (tripId) {
        if (!subTripsByTripId[tripId]) {
          subTripsByTripId[tripId] = [];
        }
        let subTripData = { ...doc };
        if (doc.data) {
          try {
            subTripData = { ...subTripData, ...JSON.parse(doc.data) };
          } catch (e) {}
        }
        subTripsByTripId[tripId].push(subTripData);
      }
    });

    tripList.documents.forEach(doc => {
      const tripId = doc.$id;
      const trip = {
        ...doc,
        subTrips: subTripsByTripId[tripId] || []
      };

      if (doc.tripNo === 'TRIP-2026-0008') {
        console.log(`\n=== TRIP: ${doc.tripNo} (${doc.driverName}) ===`);
        const res = calculateDriverMetrics(trip);
        console.log(res);
        console.log('Sub-trips details:', JSON.stringify(trip.subTrips, null, 2));
      }
    });
  } catch (err) {
    console.error(err);
  }
}

run();
