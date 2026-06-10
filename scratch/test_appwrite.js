import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config({ path: '../server/.env' });

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

try {
  console.log('Fetching payments...');
  const res = await databases.listDocuments(process.env.APPWRITE_DATABASE_ID || 'fleet_db', 'payments', [], 1);
  console.log('Success!', JSON.stringify(res.documents, null, 2));
} catch (e) {
  console.error('Appwrite error:', e);
}
