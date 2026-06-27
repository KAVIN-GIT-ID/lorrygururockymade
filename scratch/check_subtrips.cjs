const { Client, Databases, Query } = require('node-appwrite');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

const databaseId = process.env.APPWRITE_DATABASE_ID || 'fleet_db';
const projectId = process.env.APPWRITE_PROJECT_ID;
const endpoint = process.env.APPWRITE_ENDPOINT;
const apiKey = process.env.APPWRITE_API_KEY;
const orgId = '6a1c7429000bcd098cab';

console.log("Database ID:", databaseId);
console.log("Project ID:", projectId);
console.log("Endpoint:", endpoint);
console.log("API Key exists:", !!apiKey);

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

async function checkSubtrips() {
  try {
    const response = await databases.listDocuments(databaseId, 'sub_trips', [
      Query.equal('organizationId', orgId),
      Query.limit(100)
    ]);
    console.log(`Fetched ${response.documents.length} sub-trips:`);
    for (const doc of response.documents) {
      if (doc.officeName === 'Velmurugan Office' || doc.cargoExpenses) {
        console.log(`Document ID: ${doc.$id}`);
        console.log(`Route: ${doc.routeFrom} -> ${doc.routeTo}`);
        console.log(`Office: ${doc.officeName}`);
        console.log(`cargoExpenses:`, doc.cargoExpenses);
        console.log(`cargoExpenses Type:`, typeof doc.cargoExpenses);
        console.log(`loadingExpense (legacy):`, doc.loadingExpense);
        console.log('-----------------------------');
      }
    }
  } catch (err) {
    console.error("Failed to fetch sub-trips:", err);
  }
}

checkSubtrips();
