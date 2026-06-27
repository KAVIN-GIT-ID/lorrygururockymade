const { Client, Databases, Query } = require('node-appwrite');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

const databaseId = process.env.APPWRITE_DATABASE_ID || 'fleet_db';
const projectId = process.env.APPWRITE_PROJECT_ID;
const endpoint = process.env.APPWRITE_ENDPOINT;
const apiKey = process.env.APPWRITE_API_KEY;

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

async function run() {
  try {
    const tripList = await databases.listDocuments(databaseId, 'trips', [
      Query.equal('truckNo', 'TN52-AD-3134')
    ]);
    console.log(`Found ${tripList.documents.length} trips for TN52-AD-3134:`);
    for (const doc of tripList.documents) {
      console.log(`Trip ID: ${doc.$id}`);
      console.log(`Trip No: ${doc.tripNo}`);
      console.log(`Payments:`, doc.payments);
      
      const subDocs = await databases.listDocuments(databaseId, 'sub_trips', [
        Query.equal('tripId', doc.$id)
      ]);
      console.log('Sub-trips:');
      for (const st of subDocs.documents) {
        console.log(`  Subtrip ID: ${st.$id}`);
        console.log(`  Office: ${st.officeName}`);
        console.log(`  Route: ${st.routeFrom} -> ${st.routeTo}`);
        console.log(`  Income: ${st.income}`);
        console.log(`  cargoExpenses:`, st.cargoExpenses);
      }
      console.log('====================================');
    }
  } catch (err) {
    console.error(err);
  }
}

run();
