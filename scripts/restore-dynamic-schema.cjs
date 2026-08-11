const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PROJECT_ROOT = path.resolve(__dirname, '..');
const backupPath = path.join(PROJECT_ROOT, 'backups', 'TT_Tracker_Backup_2026-08-10_17-57-12.json');

const endpoint   = process.env.VITE_APPWRITE_ENDPOINT;
const projectId  = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || 'fleet_db';
const apiKey     = process.env.VITE_APPWRITE_API_KEY;

const sdk = require('node-appwrite');
const client = new sdk.Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new sdk.Databases(client);

async function run() {
  console.log('=== Exact Schema Appwrite Data Restorer ===');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Project:  ${projectId}`);
  console.log(`Database: ${databaseId}\n`);

  const raw = fs.readFileSync(backupPath, 'utf8');
  const backup = JSON.parse(raw);

  const collections = [
    'trucks', 'drivers', 'offices', 'accounts', 'trips',
    'expenses', 'tyres', 'audit_logs', 'support_tickets', 'global_configs'
  ];

  for (const colId of collections) {
    const items = backup[colId] || [];
    if (items.length === 0) continue;

    console.log(`--- Processing "${colId}" (${items.length} records) ---`);

    // 1. Ensure collection exists
    try {
      await databases.getCollection(databaseId, colId);
    } catch (e) {
      console.log(`Creating collection "${colId}"...`);
      await databases.createCollection(databaseId, colId, colId, ['read("any")', 'write("any")']);
    }

    // 2. Discover all unique attributes from items
    const attrMap = {};
    for (const item of items) {
      for (const [k, v] of Object.entries(item)) {
        if (k.startsWith('$')) continue;
        if (!attrMap[k]) {
          attrMap[k] = typeof v;
        }
      }
    }

    // 3. Create missing attributes
    for (const [attrName, attrType] of Object.entries(attrMap)) {
      try {
        if (attrType === 'number') {
          await databases.createFloatAttribute(databaseId, colId, attrName, false);
        } else if (attrType === 'boolean') {
          await databases.createBooleanAttribute(databaseId, colId, attrName, false);
        } else {
          await databases.createStringAttribute(databaseId, colId, attrName, 1000000, false);
        }
        console.log(`  + Created attribute "${attrName}" (${attrType})`);
      } catch (err) {
        // Attribute already exists or creation in progress
      }
    }

    // Wait for attributes to be active
    console.log('  Waiting 3s for attributes activation...');
    await new Promise(r => setTimeout(r, 3000));

    // 4. Insert documents
    let successCount = 0;
    for (const item of items) {
      const docId = item.$id || item.id || sdk.ID.unique();
      const payload = {};

      for (const attrName of Object.keys(attrMap)) {
        if (item[attrName] !== undefined) {
          payload[attrName] = item[attrName];
        }
      }

      try {
        await databases.createDocument(databaseId, colId, docId, payload);
        successCount++;
      } catch (err) {
        if (err.code === 409 || (err.message && err.message.includes('already exists'))) {
          try {
            await databases.updateDocument(databaseId, colId, docId, payload);
            successCount++;
          } catch (upErr) {
            console.log(`  ❌ Failed update [${docId}]: ${upErr.message}`);
          }
        } else {
          console.log(`  ❌ Failed insert [${docId}]: ${err.message}`);
        }
      }
    }

    console.log(`  ✓ Restored ${successCount}/${items.length} records into "${colId}".\n`);
  }

  console.log('🎉 Data Restoration Finished Successfully!');
}

run().catch(console.error);
