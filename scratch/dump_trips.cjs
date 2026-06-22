const { Client, Databases, Query } = require('node-appwrite');
require('dotenv').config({ path: 'c:/Users/infimove/antigravity/Truck-Trip-Tracker/.env' });

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

    console.log(`Loaded ${list.documents.length} trips, ${subTripList.documents.length} sub_trips.`);

    for (const subDoc of subTripList.documents) {
      if (subDoc.loadingDate === '2026-06-05' || subDoc.loadingDate === '2026-06-09') {
        console.log(`SubTrip ID: ${subDoc.$id}, Loading Date: ${subDoc.loadingDate}, Route: ${subDoc.routeFrom} -> ${subDoc.routeTo}`);
        console.log(`cargoExpenses:`, subDoc.cargoExpenses);
        console.log(`loadingBearsOrg/Driver/Office:`, subDoc.loadingBearsOrg, subDoc.loadingBearsDriver);
        console.log(`unloadingBearsOrg/Driver/Office:`, subDoc.unloadingBearsOrg, subDoc.unloadingBearsDriver);
        console.log(`rmcExpense:`, subDoc.rmcExpense);
        console.log(`rmcPaidByDriver:`, subDoc.rmcPaidByDriver);
        console.log(`rmcDeductedFrom:`, subDoc.rmcDeductedFrom);
        console.log(`rmcBearsOrg/Driver:`, subDoc.rmcBearsOrg, subDoc.rmcBearsDriver);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run();
