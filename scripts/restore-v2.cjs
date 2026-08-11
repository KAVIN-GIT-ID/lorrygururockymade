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
  console.log('=== Appwrite 1.5+ (V2 Varchar/Text) Restorer ===');
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

    // 1. Ensure collection exists
    try {
      await databases.getCollection(databaseId, colId);
    } catch (e) {
      console.log(`Creating collection "${colId}"...`);
      await databases.createCollection(databaseId, colId, colId, ['read("any")', 'write("any")']);
    }

    // 2. Create V2 attributes (or fallback to string)
    try {
      if (typeof databases.createVarcharAttribute === 'function') {
        await databases.createVarcharAttribute(databaseId, colId, 'organizationId', 100, false);
      } else {
        await databases.createStringAttribute(databaseId, colId, 'organizationId', 100, false);
      }
    } catch (e) {}

    try {
      if (typeof databases.createTextAttribute === 'function') {
        await databases.createTextAttribute(databaseId, colId, 'data', false);
      } else {
        await databases.createStringAttribute(databaseId, colId, 'data', 65535, false);
      }
    } catch (e) {}

    // 3. Wait for attributes to be AVAILABLE
    console.log(`  Waiting for attributes in "${colId}"...`);
    let readyAttrs = new Set();
    for (let i = 0; i < 40; i++) {
      try {
        const colMeta = await databases.getCollection(databaseId, colId);
        const attrs = colMeta.attributes || [];
        const dataAttr = attrs.find(a => a.key === 'data');
        if (dataAttr && dataAttr.status === 'available') {
          readyAttrs = new Set(attrs.map(a => a.key));
          break;
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 2000));
    }

    const currentMeta = await databases.getCollection(databaseId, colId);
    readyAttrs = new Set((currentMeta.attributes || []).map(a => a.key));

    // 4. Insert documents
    let successCount = 0;
    for (const item of items) {
      const docId = item.$id || item.id || sdk.ID.unique();
      const payload = {
        data: JSON.stringify(item)
      };

      if (item.organizationId && readyAttrs.has('organizationId')) {
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

  console.log('\n🎉 RESTORATION COMPLETED SUCCESSFULLY!');
}

run().catch(console.error);
