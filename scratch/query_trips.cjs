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
    
    // Find trips with brokerage 1200 or RMC 5000 in subTrips
    const subTripsDocs = await databases.listDocuments(dbId, 'sub_trips');
    console.log('Total sub-trips in DB:', subTripsDocs.total);
    
    const tripsWithBrokerage = [];
    
    for (const sub of subTripsDocs.documents) {
      const expenses = parseField(sub.cargoExpenses);
      const hasBroke = expenses.some(e => e.expenseType === 'Brokerage' && e.amount === 1200);
      if (hasBroke) {
        console.log(`Sub-trip ${sub.$id} has brokerage 1200. Trip ID: ${sub.tripId}`);
        const trip = list.documents.find(t => t.$id === sub.tripId);
        if (trip) {
          tripsWithBrokerage.push(trip);
        }
      }
    }
    
    if (tripsWithBrokerage.length === 0) {
      // Look by legacy fields
      for (const sub of subTripsDocs.documents) {
        if (Number(sub.brokerageExpense) === 1200) {
          console.log(`Legacy Sub-trip ${sub.$id} has brokerage 1200. Trip ID: ${sub.tripId}`);
          const trip = list.documents.find(t => t.$id === sub.tripId);
          if (trip) {
            tripsWithBrokerage.push(trip);
          }
        }
      }
    }

    console.log('Found trips:', tripsWithBrokerage.map(t => t.tripNo));
    
    for (const trip of tripsWithBrokerage) {
      console.log('\n======================================');
      console.log(`Trip No: ${trip.tripNo}`);
      console.log(`Income: ${trip.income}`);
      console.log(`Advances: ${trip.advances}`);
      console.log(`Payments: ${trip.payments}`);
      
      const tripSubTrips = subTripsDocs.documents.filter(s => s.tripId === trip.$id);
      console.log('Sub Trips count:', tripSubTrips.length);
      for (const sub of tripSubTrips) {
        console.log(`  Sub ID: ${sub.$id}`);
        console.log(`  Income: ${sub.income}`);
        console.log(`  Brokerage: ${sub.brokerageExpense}, Bears: ${sub.brokerageBears}, PaidByDriver: ${sub.brokeragePaidByDriver}, DeductedFrom: ${sub.brokerageDeductedFrom}`);
        console.log(`  RMC: ${sub.rmcExpense}, Bears: ${sub.rmcBears}, PaidByDriver: ${sub.rmcPaidByDriver}, DeductedFrom: ${sub.rmcDeductedFrom}`);
        console.log(`  CargoExpenses: ${sub.cargoExpenses}`);
      }
    }
    
  } catch (err) {
    console.error(err);
  }
}

run();
