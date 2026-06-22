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
    const list = await databases.listDocuments(dbId, 'trips');
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

    list.documents.forEach(doc => {
      if (doc.tripNo === 'TRIP-2026-0007') {
        console.log('\n=== Raw TRIP-2026-0007 Document Fields ===');
        console.log(`tripNo: ${doc.tripNo}`);
        console.log(`driverName: ${doc.driverName}`);
        console.log(`rtoExpense: ${doc.rtoExpense} (${typeof doc.rtoExpense})`);
        console.log(`rtoPaidByDriver: ${doc.rtoPaidByDriver} (${typeof doc.rtoPaidByDriver})`);
        console.log(`otherExpense: ${doc.otherExpense} (${typeof doc.otherExpense})`);
        console.log(`otherPaidByDriver: ${doc.otherPaidByDriver} (${typeof doc.otherPaidByDriver})`);
        console.log(`fuels string:`, doc.fuels);
        console.log(`advances string:`, doc.advances);
        console.log(`payments string:`, doc.payments);
        console.log(`subTrips:`, JSON.stringify(subTripsByTripId[doc.$id], null, 2));
      }
    });
  } catch (err) {
    console.error(err);
  }
}

run();
