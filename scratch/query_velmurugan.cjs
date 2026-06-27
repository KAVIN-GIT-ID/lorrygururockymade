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
      if (doc.truckNo === 'TN52-P-5608') {
        const tripId = doc.$id;
        const subTrips = subTripsByTripId[tripId] || [];
        console.log(`\n=== TRIP: ${doc.tripNo} (${doc.truckNo}) ===`);
        console.log('Status:', doc.status);
        console.log('Payments:', parseField(doc.payments));
        console.log('Sub-trips:');
        subTrips.forEach(st => {
          console.log(`  Subtrip id: ${st.$id || st.id}`);
          console.log(`  Office: ${st.officeName}`);
          console.log(`  Income: ${st.income}`);
          console.log(`  CargoExpenses:`, parseField(st.cargoExpenses));
          console.log(`  loadingExpense: ${st.loadingExpense}`);
          console.log(`  unloadingExpense: ${st.unloadingExpense}`);
        });
      }
    });
  } catch (err) {
    console.error(err);
  }
}

run();
