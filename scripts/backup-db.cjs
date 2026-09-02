/**
 * backup-db.cjs
 * Backs up all Appwrite fleet database collections to a timestamped JSON file.
 * Uses node-appwrite SDK (server-side) for proper API key authentication.
 * 
 * Backups are saved to: <project_root>/backups/TT_Tracker_Backup_<timestamp>.json
 * 
 * Usage:
 *   node scripts/backup-db.cjs
 *   npm run db:backup
 */

const fs   = require('fs');
const path = require('path');
require('dotenv').config();

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR   = path.join(PROJECT_ROOT, 'backups');

const endpoint   = process.env.VITE_APPWRITE_ENDPOINT;
const projectId  = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const apiKey     = process.env.VITE_APPWRITE_API_KEY;

if (!apiKey) {
  console.error('❌ VITE_APPWRITE_API_KEY is not defined in .env');
  process.exit(1);
}

// Initialize node-appwrite SDK (server-side, supports API keys)
const sdk = require('node-appwrite');
const client = new sdk.Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new sdk.Databases(client);
const Query     = sdk.Query;

// Collection IDs → backup key names
const collectionsMap = {
  trucks:         'trucks',
  drivers:        'drivers',
  offices:        'offices',
  accounts:       'accounts',
  trips:          'trips',
  expenses:       'expenses',
  tyres:          'tyres',
  auditLogs:      'audit_logs',
  supportTickets: 'support_tickets',
  globalConfigs:  'global_configs'
};

async function fetchAllDocuments(collectionId) {
  const all = [];
  let cursor = null;
  const limit = 100;

  while (true) {
    const queries = [Query.limit(limit)];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    let response;
    try {
      response = await databases.listDocuments(databaseId, collectionId, queries);
    } catch (err) {
      if (err.code === 404 || (err.message && err.message.includes('not found'))) {
        console.log(`  ℹ Collection "${collectionId}" does not exist yet — skipping.`);
      } else {
        console.error(`  ❌ Error listing documents for "${collectionId}": ${err.message}`);
      }
      break;
    }

    const docs = response.documents || [];
    all.push(...docs);

    if (docs.length < limit) break;
    cursor = docs[docs.length - 1].$id;
  }

  return all;
}

async function runBackup() {
  console.log('=== Appwrite Database Backup Started ===');
  console.log(`Endpoint:  ${endpoint}`);
  console.log(`Project:   ${projectId}`);
  console.log(`Database:  ${databaseId}`);
  console.log('');

  const backupData = {
    trucks:               [],
    drivers:              [],
    offices:              [],
    accounts:             [],
    trips:                [],
    expenses:             [],
    tyres:                [],
    auditLogs:            [],
    supportTickets:       [],
    userRightsList:       [],
    organizationProfiles: []
  };

  try {
    for (const [key, collectionId] of Object.entries(collectionsMap)) {
      process.stdout.write(`Backing up collection: ${collectionId}...`);
      const documents = await fetchAllDocuments(collectionId);
      console.log(` ${documents.length} records.`);

      if (collectionId === 'global_configs') {
        // Split global_configs into userRightsList and organizationProfiles
        for (const doc of documents) {
          try {
            const parsed = JSON.parse(doc.data || '{}');
            if (doc.$id.startsWith('usr_')) {
              backupData.userRightsList.push(parsed);
            } else if (doc.$id.startsWith('prf_')) {
              backupData.organizationProfiles.push(parsed);
            }
          } catch {
            console.warn(`  ⚠ Failed to parse data for global_config doc ${doc.$id}`);
          }
        }
      } else {
        // Parse the JSON 'data' field back to raw object
        backupData[key] = documents.map(doc => {
          let rawData = {};
          try {
            rawData = JSON.parse(doc.data);
          } catch {
            rawData = { ...doc };
          }
          rawData.id = doc.$id;
          rawData.organizationId = doc.organizationId || 'org_default';
          return rawData;
        });
      }
    }

    // Write timestamped backup file
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString()
      .replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    const backupFileName = `TT_Tracker_Backup_${timestamp}.json`;
    const targetPath = path.join(BACKUP_DIR, backupFileName);

    fs.writeFileSync(targetPath, JSON.stringify(backupData, null, 2), 'utf8');

    const totalRecords =
      backupData.trucks.length + backupData.drivers.length + backupData.offices.length +
      backupData.accounts.length + backupData.trips.length + backupData.expenses.length +
      backupData.tyres.length + backupData.auditLogs.length + backupData.supportTickets.length +
      backupData.userRightsList.length + backupData.organizationProfiles.length;

    console.log('');
    console.log(`✅ Backup complete: ${backupFileName}`);
    console.log(`   Total records: ${totalRecords}`);
    console.log(`   Location: ${targetPath}`);
    return targetPath;

  } catch (globalErr) {
    console.error('❌ Backup failed:', globalErr.message || globalErr);
    throw globalErr;
  }
}

// Execute when run directly
if (require.main === module) {
  runBackup()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runBackup };
