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
  console.log('=== Direct Appwrite Document Inserter ===');
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

    // Fetch existing attributes on collection
    const colMeta = await databases.getCollection(databaseId, colId);
    const existingAttrs = new Set((colMeta.attributes || []).map(a => a.key));

    // Ensure 'organizationId' and 'data' exist
    if (!existingAttrs.has('organizationId')) {
      try {
        await databases.createStringAttribute(databaseId, colId, 'organizationId', 100, false);
        console.log(`  + Created attribute "organizationId" in "${colId}"`);
      } catch (e) {}
    }
    if (!existingAttrs.has('data')) {
      try {
        await databases.createStringAttribute(databaseId, colId, 'data', 1000000, false);
        console.log(`  + Created attribute "data" in "${colId}"`);
      } catch (e) {}
    }

    // Wait for attributes to be AVAILABLE
    for (let i = 0; i < 30; i++) {
      const currentMeta = await databases.getCollection(databaseId, colId);
      const attrs = currentMeta.attributes || [];
      const notReady = attrs.filter(a => a.status !== 'available');
      if (notReady.length === 0 && attrs.length > 0) {
        break;
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    const currentMeta = await databases.getCollection(databaseId, colId);
    const readyAttrs = new Set((currentMeta.attributes || []).filter(a => a.status === 'available').map(a => a.key));

    let successCount = 0;
    for (const item of items) {
      const docId = item.$id || item.id || sdk.ID.unique();
      const payload = {};

      for (const [k, v] of Object.entries(item)) {
        if (readyAttrs.has(k) && v !== null && v !== undefined && !k.startsWith('$')) {
          payload[k] = v;
        }
      }

      // Always populate 'data' attribute if available
      if (readyAttrs.has('data')) {
        payload['data'] = JSON.stringify(item);
      }
      if (readyAttrs.has('organizationId') && item.organizationId) {
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
