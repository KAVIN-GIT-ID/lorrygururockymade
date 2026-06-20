const { Client, Databases } = require('node-appwrite');
require('dotenv').config({ path: '../server/.env' });

async function run() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://api.lorryguru.in/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID || '6a1c5f2700246e86a727')
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const dbId = process.env.APPWRITE_DATABASE_ID || 'fleet_db';

  try {
    const list = await databases.listDocuments(dbId, 'global_configs');
    console.log('Total documents:', list.total);
    list.documents.forEach(doc => {
      console.log(`- ID: ${doc.$id}, Key: ${doc.key}, data preview: ${doc.data ? doc.data.slice(0, 100) : 'null'}`);
    });
  } catch (err) {
    console.error('Error listing documents:', err);
  }
}

run();
