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
  console.log('=== Pure Data Payload Appwrite Importer ===');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Project:  ${projectId}\n`);

  const raw = fs.readFileSync(backupPath, 'utf8');
  const backup = JSON.parse(raw);

  const collections = [
    'trucks', 'drivers', 'offices', 'accounts', 'trips',
    'expenses', 'tyres', 'audit_logs', 'support_tickets', 'global_configs'
  ];

  for (const colId of collections) {
    const items = backup[colId] || [];
    if (items.length === 0) continue;

    console.log(`--- Restoring "${colId}" (${items.length} records) ---`);

    // Ensure collection exists
    try {
      await databases.getCollection(databaseId, colId);
    } catch (e) {
      await databases.createCollection(databaseId, colId, colId, ['read("any")', 'write("any")']);
    }

    // Check available attributes in database
    const colMeta = await databases.getCollection(databaseId, colId);
    const activeKeys = new Set((colMeta.attributes || []).filter(a => a.status === 'available').map(a => a.key));

    let successCount = 0;
    for (const item of items) {
      const docId = item.$id || item.id || sdk.ID.unique();
      const payload = {};

      for (const [k, v] of Object.entries(item)) {
        if (activeKeys.has(k) && v !== null && v !== undefined) {
          payload[k] = v;
        }
      }

      // If payload missing 'data' string, encode it into 'data' or 'key' attribute
      if (activeKeys.has('data')) {
        payload['data'] = JSON.stringify(item);
      }
      if (activeKeys.has('key') && item.key) {
        payload['key'] = item.key;
      }
      if (activeKeys.has('organizationId') && item.organizationId) {
        payload['organizationId'] = item.organizationId;
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
            console.log(`  ❌ Update failed [${docId}]: ${upErr.message}`);
          }
        } else {
          console.log(`  ❌ Insert failed [${docId}]: ${err.message}`);
        }
      }
    }

    console.log(`  ✓ Restored ${successCount}/${items.length} records into "${colId}".`);
  }

  console.log('\n🎉 ALL DATA RESTORED SUCCESSFULLY!');
}

run().catch(console.error);
