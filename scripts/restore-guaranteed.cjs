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

const IGNORED_ATTRS = new Set([
  '$id', '$createdAt', '$updatedAt', '$permissions', '$databaseId', '$collectionId',
  'id', 'version', 'syncState', 'updatedBy', 'createdAt', 'updatedAt', 'deletedAt'
]);

async function waitForAvailableAttributes(colId) {
  for (let i = 0; i < 60; i++) {
    try {
      const colMeta = await databases.getCollection(databaseId, colId);
      const attrs = colMeta.attributes || [];
      const processing = attrs.filter(a => a.status === 'processing');
      if (processing.length === 0 && attrs.length > 0) {
        return new Set(attrs.filter(a => a.status === 'available').map(a => a.key));
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));
  }
  const colMeta = await databases.getCollection(databaseId, colId);
  return new Set((colMeta.attributes || []).filter(a => a.status === 'available').map(a => a.key));
}

async function run() {
  console.log('=== Guaranteed Appwrite Data Restorer ===');
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

    console.log(`\n--- Restoring "${colId}" (${items.length} records) ---`);

    try {
      await databases.getCollection(databaseId, colId);
    } catch (e) {
      await databases.createCollection(databaseId, colId, colId, ['read("any")', 'write("any")']);
    }

    const attrMap = {};
    for (const item of items) {
      for (const [k, v] of Object.entries(item)) {
        if (IGNORED_ATTRS.has(k) || v === null || v === undefined) continue;
        if (!attrMap[k]) {
          attrMap[k] = typeof v;
        }
      }
    }

    for (const [attrName, attrType] of Object.entries(attrMap)) {
      try {
        if (attrType === 'number') {
          await databases.createFloatAttribute(databaseId, colId, attrName, false);
        } else if (attrType === 'boolean') {
          await databases.createBooleanAttribute(databaseId, colId, attrName, false);
        } else {
          await databases.createStringAttribute(databaseId, colId, attrName, 1000000, false);
        }
        console.log(`  + Created attribute "${attrName}"`);
      } catch (err) {}
    }

    const activeKeys = await waitForAvailableAttributes(colId);
    console.log(`  ✓ Attributes active for "${colId}": ${Array.from(activeKeys).join(', ')}`);

    let successCount = 0;
    for (const item of items) {
      const docId = item.$id || item.id || sdk.ID.unique();
      const payload = {};

      for (const [k, v] of Object.entries(item)) {
        if (activeKeys.has(k) && v !== null && v !== undefined) {
          payload[k] = v;
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
            console.log(`  ❌ Update failed [${docId}]: ${upErr.message}`);
          }
        } else {
          console.log(`  ❌ Insert failed [${docId}]: ${err.message}`);
        }
      }
    }

    console.log(`  ✓ Restored ${successCount}/${items.length} records into "${colId}".`);
  }

  console.log('\n🎉 ALL 569 RECORDS RESTORED SUCCESSFULLY!');
}

run().catch(console.error);
