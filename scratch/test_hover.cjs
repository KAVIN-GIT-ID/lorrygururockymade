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

function importLegacyCargoExpenses(s) {
  const list = [];
  const loadAmt = Number(s.loadingExpense) || 0;
  if (loadAmt > 0) {
    list.push({
      id: 'legacy-load',
      expenseType: 'Loading',
      amount: loadAmt,
      paidByDriver: !!s.loadingPaidByDriver,
      deductedFrom: s.loadingDeductedFrom || 'DriverDirect',
      bears: s.loadingBears || 'Org'
    });
  }
  const unloadAmt = Number(s.unloadingExpense) || 0;
  if (unloadAmt > 0) {
    list.push({
      id: 'legacy-unload',
      expenseType: 'Unloading',
      amount: unloadAmt,
      paidByDriver: !!s.unloadingPaidByDriver,
      deductedFrom: s.unloadingDeductedFrom || 'DriverDirect',
      bears: s.unloadingBears || 'Org'
    });
  }
  const brokerageAmt = Number(s.brokerageExpense) || 0;
  if (brokerageAmt > 0) {
    list.push({
      id: 'legacy-broke',
      expenseType: 'Brokerage',
      amount: brokerageAmt,
      paidByDriver: !!s.brokeragePaidByDriver,
      deductedFrom: s.brokerageDeductedFrom || 'DriverDirect',
      bears: s.brokerageBears || 'Org'
    });
  }
  const crossingAmt = Number(s.crossingExpense) || 0;
  if (crossingAmt > 0) {
    list.push({
      id: 'legacy-crossing',
      expenseType: 'Crossing',
      amount: crossingAmt,
      paidByDriver: !!s.crossingPaidByDriver,
      deductedFrom: s.crossingDeductedFrom || 'DriverDirect',
      bears: s.crossingBears || 'Org'
    });
  }
  const rmcAmt = Number(s.rmcExpense) || 0;
  if (rmcAmt > 0) {
    list.push({
      id: 'legacy-rmc',
      expenseType: 'RMC',
      amount: rmcAmt,
      paidByDriver: !!s.rmcPaidByDriver,
      deductedFrom: s.rmcDeductedFrom || 'DriverDirect',
      bears: s.rmcBears || 'Org'
    });
  }
  
  // Apply specific logic for split fields if they are set (e.g. bearsOrg, bearsDriver, bearsOffice)
  list.forEach(exp => {
    if (exp.expenseType === 'RMC') {
      const orgAmt = Number(s.rmcBearsOrg) || 0;
      const drvAmt = Number(s.rmcBearsDriver) || 0;
      const officeAmt = rmcAmt - orgAmt - drvAmt;
      if (orgAmt > 0 && exp.bears === 'Org') {
        exp.amount = orgAmt;
      }
      if (officeAmt > 0) {
        list.push({
          id: 'legacy-rmc-office',
          expenseType: 'RMC',
          amount: officeAmt,
          paidByDriver: !!s.rmcPaidByDriver,
          deductedFrom: s.rmcDeductedFrom || 'DriverDirect',
          bears: 'Office'
        });
      }
    }
  });
  return list;
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

    const allTrips = tripList.documents.map(doc => ({
      ...doc,
      payments: parseField(doc.payments),
      subTrips: subTripsByTripId[doc.$id] || []
    }));

    const targetSubTrip = subTripList.documents.find(d => d.$id === 'sub_t_id_1780490287246_1');
    console.log('Target sub-trip raw properties:', JSON.stringify(targetSubTrip, null, 2));
    
    // also search for any unassigned payments on TRIP-2026-0006
    const t2006 = allTrips.find(t => t.tripNo === 'TRIP-2026-0006');
    if (t2006) {
      console.log('TRIP-2026-0006 payments:', JSON.stringify(t2006.payments, null, 2));
    }

  } catch (err) {
    console.error(err);
  }
}

run();
