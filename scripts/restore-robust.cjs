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

async function run() {
  console.log('=== Robust Appwrite Document Importer ===');
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

    // Collect all attributes present in backup
    const attrMap = {};
    for (const item of items) {
      for (const [k, v] of Object.entries(item)) {
        if (IGNORED_ATTRS.has(k) || v === null || v === undefined) continue;
        if (!attrMap[k]) {
          attrMap[k] = typeof v;
        }
      }
    }

    // Always ensure 'organizationId' and 'data' attributes are created
    if (!attrMap['organizationId']) attrMap['organizationId'] = 'string';
    if (!attrMap['data']) attrMap['data'] = 'string';

    for (const [attrName, attrType] of Object.entries(attrMap)) {
      try {
        if (attrType === 'number') {
          await databases.createFloatAttribute(databaseId, colId, attrName, false);
        } else if (attrType === 'boolean') {
          await databases.createBooleanAttribute(databaseId, colId, attrName, false);
        } else {
          await databases.createStringAttribute(databaseId, colId, attrName, 1000000, false);
        }
      } catch (err) {}
    }

    // Poll until attributes are active
    let activeKeys = new Set();
    for (let i = 0; i < 30; i++) {
      try {
        const colMeta = await databases.getCollection(databaseId, colId);
        const attrs = (colMeta.attributes || []).filter(a => a.status === 'available');
        if (attrs.length >= Object.keys(attrMap).length) {
          activeKeys = new Set(attrs.map(a => a.key));
          break;
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 1500));
    }

    if (activeKeys.size === 0) {
      const colMeta = await databases.getCollection(databaseId, colId);
      activeKeys = new Set((colMeta.attributes || []).map(a => a.key));
    }

    let successCount = 0;
    for (const item of items) {
      const docId = item.$id || item.id || sdk.ID.unique();
      const payload = {};

      for (const [k, v] of Object.entries(item)) {
        if (activeKeys.has(k) && v !== null && v !== undefined && !IGNORED_ATTRS.has(k)) {
          payload[k] = v;
        }
      }

      // If payload is empty or missing data field, fallback to serialized data
      if (Object.keys(payload).length === 0) {
        payload['data'] = JSON.stringify(item);
        if (item.organizationId && activeKeys.has('organizationId')) {
          payload['organizationId'] = item.organizationId;
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

  console.log('\n🎉 RESTORATION COMPLETED SUCCESSFULLY!');
}

run().catch(console.error);
