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
        console.log('\n=== Raw TRIP-2026-0008 Document Fields ===');
        console.log(`tripNo: ${doc.tripNo}`);
        console.log(`driverName: ${doc.driverName}`);
        console.log(`rtoExpense: ${doc.rtoExpense} (${typeof doc.rtoExpense})`);
        console.log(`rtoPaidByDriver: ${doc.rtoPaidByDriver} (${typeof doc.rtoPaidByDriver})`);
        console.log(`otherExpense: ${doc.otherExpense} (${typeof doc.otherExpense})`);
        console.log(`otherPaidByDriver: ${doc.otherPaidByDriver} (${typeof doc.otherPaidByDriver})`);
        console.log(`dieselLiters: ${doc.dieselLiters}`);
        console.log(`dieselAmount: ${doc.dieselAmount}`);
        console.log(`endingKM: ${doc.endingKM}`);
        console.log(`startingKM: ${doc.startingKM}`);
        console.log(`fuels string:`, doc.fuels);
        console.log(`advances string:`, doc.advances);
        console.log(`payments string:`, doc.payments);
        console.log(`subTrips string:`, doc.subTrips);

        // Parse them properly
        const parsedFuels = parseField(doc.fuels);
        const parsedAdvances = parseField(doc.advances);
        const parsedPayments = parseField(doc.payments);
        const parsedSubTrips = parseField(doc.subTrips);

        console.log('\n=== Parsed Fuels ===');
        console.log(parsedFuels);

        console.log('\n=== Parsed Advances ===');
        console.log(parsedAdvances);

        console.log('\n=== Parsed Payments ===');
        console.log(parsedPayments);

        console.log('\n=== Parsed SubTrips ===');
        console.log(parsedSubTrips);
      }
    });
  } catch (err) {
    console.error(err);
  }
}

run();
