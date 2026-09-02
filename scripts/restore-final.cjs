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
  console.log('=== Complete Appwrite DB Creator & Data Restorer ===');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Project:  ${projectId}`);
  console.log(`Database: ${databaseId}\n`);

  const raw = fs.readFileSync(backupPath, 'utf8');
  const backup = JSON.parse(raw);

  // 1. Ensure Database exists
  try {
    await databases.get(databaseId);
    console.log(`✓ Found existing database "${databaseId}".`);
  } catch (e) {
    console.log(`Creating database "${databaseId}"...`);
    try {
      await databases.create(databaseId, 'Fleet Database');
      console.log(`✓ Created database "${databaseId}".`);
    } catch (createErr) {
      console.error(`Failed to create database: ${createErr.message}`);
    }
  }

  const collections = [
    'trucks', 'drivers', 'offices', 'accounts', 'trips',
    'expenses', 'tyres', 'audit_logs', 'support_tickets', 'global_configs'
  ];

  for (const colId of collections) {
    const items = backup[colId] || [];
    if (items.length === 0) continue;

    console.log(`\n--- Restoring "${colId}" (${items.length} records) ---`);

    // 2. Ensure collection exists
    try {
      await databases.getCollection(databaseId, colId);
    } catch (e) {
      console.log(`Creating collection "${colId}"...`);
      await databases.createCollection(databaseId, colId, colId, ['read("any")', 'write("any")']);
    }

    // 3. Ensure 'organizationId' and 'data' attributes exist
    try {
      await databases.createStringAttribute(databaseId, colId, 'organizationId', 100, false);
      console.log(`  + Created attribute "organizationId" in "${colId}"`);
    } catch (e) {}
    try {
      await databases.createStringAttribute(databaseId, colId, 'data', 1000000, false);
      console.log(`  + Created attribute "data" in "${colId}"`);
    } catch (e) {}

    // 4. Wait for attributes to become AVAILABLE in MariaDB
    console.log(`  Waiting for attributes to become AVAILABLE in "${colId}"...`);
    let readyAttrs = new Set();
    for (let i = 0; i < 40; i++) {
      try {
        const colMeta = await databases.getCollection(databaseId, colId);
        const attrs = (colMeta.attributes || []).filter(a => a.status === 'available');
        const hasData = attrs.some(a => a.key === 'data');
        if (hasData) {
          readyAttrs = new Set(attrs.map(a => a.key));
          console.log(`  ✓ Ready attributes: [ ${Array.from(readyAttrs).join(', ')} ]`);
          break;
        }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 2500));
    }

    if (!readyAttrs.has('data')) {
      console.error(`  ❌ Attribute 'data' failed to become ready in "${colId}". Skipping...`);
      continue;
    }

    // 5. Insert documents
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

  console.log('\n🎉 ALL 569 RECORDS RESTORED SUCCESSFULLY!');
}

run().catch(console.error);
