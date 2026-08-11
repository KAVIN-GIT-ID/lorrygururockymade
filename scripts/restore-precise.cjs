const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PROJECT_ROOT = path.resolve(__dirname, '..');
const backupPath = path.join(PROJECT_ROOT, 'backups', 'TT_Tracker_Backup_2026-08-10_17-57-12.json');

const endpoint  = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || 'fleet_db';
const apiKey    = process.env.VITE_APPWRITE_API_KEY;

const sdk = require('node-appwrite');
const client = new sdk.Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new sdk.Databases(client);

async function run() {
  console.log('=== Precise Appwrite Data Restorer ===');
  console.log(`Target Endpoint: ${endpoint}`);
  console.log(`Target Project:  ${projectId}`);
  console.log(`Target Database: ${databaseId}\n`);

  const raw = fs.readFileSync(backupPath, 'utf8');
  const backup = JSON.parse(raw);

  // Map collection keys from JSON
  const map = {
    trucks: 'trucks',
    drivers: 'drivers',
    offices: 'offices',
    accounts: 'accounts',
    trips: 'trips',
    expenses: 'expenses',
    tyres: 'tyres',
    audit_logs: 'audit_logs',
    support_tickets: 'support_tickets',
    global_configs: 'global_configs'
  };

  for (const [key, colId] of Object.entries(map)) {
    const items = backup[key] || [];
    if (items.length === 0) continue;

    console.log(`Processing ${items.length} records for collection "${colId}"...`);

    // Ensure collection exists
    try {
      await databases.getCollection(databaseId, colId);
    } catch (e) {
      console.log(`Creating collection "${colId}"...`);
      try {
        await databases.createCollection(databaseId, colId, colId, ['read("any")', 'write("any")']);
      } catch (err) {
        console.log(`Collection creation note: ${err.message}`);
      }
    }

    // Ensure key attribute exists
    const sample = items[0];
    const keys = Object.keys(sample).filter(k => !k.startsWith('$'));

    for (const k of keys) {
      try {
        const val = sample[k];
        if (typeof val === 'number') {
          await databases.createFloatAttribute(databaseId, colId, k, false);
        } else if (typeof val === 'boolean') {
          await databases.createBooleanAttribute(databaseId, colId, k, false);
        } else {
          // String
          await databases.createStringAttribute(databaseId, colId, k, 1000000, false);
        }
        console.log(`  + Created attribute "${k}" in "${colId}"`);
      } catch (err) {
        // Attribute already exists or pending
      }
    }

    // Wait 2s for attributes
    await new Promise(r => setTimeout(r, 2000));

    let restored = 0;
    for (const item of items) {
      const docId = item.$id || undefined;
      const dataPayload = {};
      for (const k of keys) {
        dataPayload[k] = item[k];
      }

      try {
        await databases.createDocument(databaseId, colId, docId, dataPayload);
        restored++;
      } catch (err) {
        if (err.code === 409 || (err.message && err.message.includes('already exists'))) {
          try {
            await databases.updateDocument(databaseId, colId, docId, dataPayload);
            restored++;
          } catch (updateErr) {
            console.log(`  ❌ Failed [${docId}]: ${updateErr.message}`);
          }
        } else {
          console.log(`  ❌ Failed [${docId}]: ${err.message}`);
        }
      }
    }

    console.log(`  ✓ Restored ${restored}/${items.length} records into "${colId}".\n`);
  }

  console.log('🎉 Full Data Import Completed Successfully!');
}

run().catch(console.error);
