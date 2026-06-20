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
    const doc = await databases.getDocument(dbId, 'global_configs', 'usr_opp_opp_com_1godlb');
    console.log('Document found:', doc);
  } catch (err) {
    console.error('Error getting document:', err.message || err);
  }
}

run();
