const fs = require('fs');
const path = require('path');
const { Client, Databases, Query } = require('appwrite');
require('dotenv').config();

// Save backups inside the project directory (portable across machines)
// Falls back to user Downloads if the project root can't be determined.
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'backups');

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const apiKey = process.env.VITE_APPWRITE_API_KEY;

if (!apiKey) {
  console.error("❌ VITE_APPWRITE_API_KEY is not defined in environment.");
  process.exit(1);
}

const collectionsMap = {
  trucks: 'trucks',
  drivers: 'drivers',
  offices: 'offices',
  accounts: 'accounts',
  trips: 'trips',
  expenses: 'expenses',
  tyres: 'tyres',
  auditLogs: 'audit_logs',
  globalConfigs: 'global_configs'
};

async function runBackup() {
  console.log('=== Appwrite Database Backup Started ===');
  console.log(`Endpoint:       ${endpoint}`);
  console.log(`Project:        ${projectId}`);
  console.log(`Database:       ${databaseId}`);

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(client);
  const backupData = {
    trucks: [],
    drivers: [],
    offices: [],
    accounts: [],
    trips: [],
    expenses: [],
    tyres: [],
    auditLogs: [],
    userRightsList: [],
    organizationProfiles: []
  };

  try {
    for (const [key, collectionId] of Object.entries(collectionsMap)) {
      console.log(`Fetching collection: ${collectionId}...`);
      let documents = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await databases.listDocuments(
            databaseId,
            collectionId,
            [
              Query.limit(limit),
              Query.offset(offset)
            ]
          );

          if (response.documents && response.documents.length > 0) {
            documents.push(...response.documents);
            if (response.documents.length < limit) {
              hasMore = false;
            } else {
              offset += limit;
            }
          } else {
            hasMore = false;
          }
        } catch (err) {
          if (err.code === 404) {
            console.log(`  ℹ Collection ${collectionId} does not exist yet.`);
          } else {
            console.error(`  ❌ Error listing documents for ${collectionId}:`, err.message);
          }
          hasMore = false;
        }
      }

      console.log(`  ✓ Retrieved ${documents.length} records.`);

      // For standard collections, parse or keep the fields
      if (collectionId === 'global_configs') {
        // Separate global_configs into userRightsList and organizationProfiles
        for (const doc of documents) {
          try {
            const parsedData = JSON.parse(doc.data || '{}');
            if (doc.$id.startsWith('usr_')) {
              backupData.userRightsList.push(parsedData);
            } else if (doc.$id.startsWith('prf_')) {
              backupData.organizationProfiles.push(parsedData);
            }
          } catch (parseErr) {
            console.warn(`  ⚠ Failed to parse data for global config doc ${doc.$id}`);
          }
        }
      } else {
        // Map document data back to raw format
        backupData[key] = documents.map(doc => {
          let rawData = {};
          try {
            rawData = JSON.parse(doc.data);
          } catch (e) {
            // fallback if it was not serialized
            rawData = { ...doc };
          }
          // Preserve the custom ID mapping if necessary
          rawData.id = doc.$id;
          rawData.organizationId = doc.organizationId || 'org_default';
          return rawData;
        });
      }
    }

    // Write to a timestamped backup file inside the project backups/ folder
    const now = new Date();
    const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    const backupFileName = `TT_Tracker_Backup_${timestamp}.json`;

    // Ensure backups/ directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const targetPath = path.join(BACKUP_DIR, backupFileName);
    console.log(`Writing backup to: ${targetPath}`);
    fs.writeFileSync(targetPath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`🎉 Database backup completed successfully: ${backupFileName}`);
    return targetPath;
  } catch (globalErr) {
    console.error('❌ Backup failed:', globalErr);
    throw globalErr;
  }
}

// Support executing from terminal command line directly
if (require.main === module) {
  runBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runBackup };
