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
    const response = await databases.listDocuments(dbId, 'audit_logs', [
      Query.equal('reference', 'TRIP-2026-0008'),
      Query.limit(100)
    ]);
    console.log(`Audit logs for TRIP-2026-0008:`, response.total);
    response.documents.forEach(doc => {
      console.log(`[${doc.timestamp}] ${doc.user} - ${doc.action}: ${doc.details}`);
    });
  } catch (err) {
    console.error(err);
  }
}

run();
