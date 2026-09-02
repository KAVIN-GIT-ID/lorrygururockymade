/**
 * restore-from-backup.cjs
 * Restores all fleet data from a JSON backup file back into Appwrite.
 * Uses node-appwrite SDK (server-side) for proper API key authentication.
 *
 * Usage:
 *   node scripts/restore-from-backup.cjs [path-to-backup.json]
 *
 * If no path is provided, auto-picks the LATEST backup from backups/ folder.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'backups');

const endpoint  = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const apiKey    = process.env.VITE_APPWRITE_API_KEY;

if (!endpoint || !projectId || !databaseId || !apiKey) {
  console.error('❌ Missing required environment variables (VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID, VITE_APPWRITE_DATABASE_ID, VITE_APPWRITE_API_KEY)');
  process.exit(1);
}

// --- Resolve backup file path ---
let backupPath = process.argv[2];

if (!backupPath) {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`❌ No backup directory found at: ${BACKUP_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    console.error(`❌ No backup .json files found in: ${BACKUP_DIR}`);
    process.exit(1);
  }
  backupPath = path.join(BACKUP_DIR, files[0].name);
  console.log(`ℹ  Auto-selected latest backup: ${files[0].name}`);
}

if (!fs.existsSync(backupPath)) {
  console.error(`❌ Backup file not found: ${backupPath}`);
  process.exit(1);
}

console.log('=== Appwrite Database Restorer ===');
console.log(`Backup file:  ${backupPath}`);
console.log(`Endpoint:     ${endpoint}`);
console.log(`Project:      ${projectId}`);
console.log(`Database:     ${databaseId}`);
console.log('');

const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

// Initialize node-appwrite (server SDK with API key support)
const sdk = require('node-appwrite');
const client = new sdk.Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new sdk.Databases(client);

// Keys in backup JSON → collection IDs in Appwrite
const collectionsMap = {
  trucks:         'trucks',
  drivers:        'drivers',
  offices:        'offices',
  accounts:       'accounts',
  trips:          'trips',
  expenses:       'expenses',
  tyres:          'tyres',
  auditLogs:      'audit_logs',
  supportTickets: 'support_tickets'
};

// --- Build flat document fields per collection ---
function buildDocumentData(collectionId, orgId, dataObj) {
  const serializedData = JSON.stringify(dataObj);

  switch (collectionId) {
    case 'audit_logs':
      return {
        organizationId: orgId,
        timestamp:  String(dataObj.timestamp  || ''),
        user:       String(dataObj.user        || ''),
        action:     String(dataObj.action      || 'Cloud'),
        category:   String(dataObj.category    || ''),
        reference:  String(dataObj.reference   || ''),
        details:    String(dataObj.details     || ''),
        data: serializedData
      };
    case 'trips':
      return {
        organizationId: orgId,
        tripNo:     String(dataObj.tripNo     || ''),
        truckNo:    String(dataObj.truckNo    || ''),
        startDate:  String(dataObj.startDate  || ''),
        endDate:    String(dataObj.endDate    || ''),
        driverName: String(dataObj.driverName || ''),
        status:     String(dataObj.status     || 'Pending'),
        notes:      String(dataObj.notes      || ''),
        data: serializedData
      };
    case 'expenses':
      return {
        organizationId: orgId,
        truckNo:     String(dataObj.truckNo     || ''),
        expenseType: String(dataObj.expenseType || ''),
        shopName:    String(dataObj.shopName    || ''),
        amount:      Number(dataObj.amount)     || 0,
        paymentMode: String(dataObj.paymentMode || ''),
        date:        String(dataObj.date        || ''),
        status:      String(dataObj.status      || 'Pending'),
        accountType: String(dataObj.accountType || 'Account'),
        driverName:  String(dataObj.driverName  || ''),
        data: serializedData
      };
    case 'tyres':
      return {
        organizationId:  orgId,
        tyreNo:          String(dataObj.tyreNo          || ''),
        manufacturer:    String(dataObj.manufacturer    || ''),
        status:          String(dataObj.status          || 'Available'),
        currentTruckNo:  String(dataObj.currentTruckNo  || ''),
        purchaseDate:    String(dataObj.purchaseDate    || ''),
        data: serializedData
      };
    case 'support_tickets':
      return {
        organizationId: orgId,
        ticketNo:       String(dataObj.ticketNo       || ''),
        requesterName:  String(dataObj.requesterName  || ''),
        requesterEmail: String(dataObj.requesterEmail || ''),
        requesterPhone: String(dataObj.requesterPhone || ''),
        category:       String(dataObj.category       || 'General'),
        title:          String(dataObj.title          || ''),
        description:    String(dataObj.description    || ''),
        status:         String(dataObj.status         || 'Open'),
        assignedTeam:   String(dataObj.assignedTeam   || 'General'),
        assignedTo:     String(dataObj.assignedTo     || ''),
        data: serializedData
      };
    default:
      return {
        organizationId: orgId,
        data: serializedData
      };
  }
}

// --- Upsert a single fleet document (update → fallback create) ---
async function upsertDocument(collectionId, docId, orgId, dataObj) {
  const documentData = buildDocumentData(collectionId, orgId, dataObj);
  const fallbackData = { organizationId: orgId, data: JSON.stringify(dataObj) };

  try {
    await databases.updateDocument(databaseId, collectionId, docId, documentData);
  } catch (err) {
    const isNotFound = err.code === 404 || err.type === 'document_not_found';
    if (isNotFound) {
      try {
        await databases.createDocument(databaseId, collectionId, docId, documentData);
      } catch (createErr) {
        // Schema mismatch fallback: use minimal { organizationId, data }
        const isSchema = createErr.code === 400 || (createErr.message || '').toLowerCase().includes('attribute');
        if (isSchema) {
          await databases.createDocument(databaseId, collectionId, docId, fallbackData);
        } else {
          throw createErr;
        }
      }
    } else {
      // Schema mismatch on update: retry with fallback
      const isSchema = err.code === 400 || (err.message || '').toLowerCase().includes('attribute');
      if (isSchema) {
        try {
          await databases.updateDocument(databaseId, collectionId, docId, fallbackData);
        } catch {
          await databases.createDocument(databaseId, collectionId, docId, fallbackData);
        }
      } else {
        throw err;
      }
    }
  }
}

// --- Upsert a global_configs entry ---
async function upsertGlobalConfig(key, dataObj) {
  const documentData = { key, data: JSON.stringify(dataObj) };
  try {
    await databases.updateDocument(databaseId, 'global_configs', key, documentData);
  } catch (err) {
    if (err.code === 404 || err.type === 'document_not_found') {
      await databases.createDocument(databaseId, 'global_configs', key, documentData);
    } else {
      throw err;
    }
  }
}

// --- Generate usr_ key from email (matches logic in appwrite.ts) ---
function makeUserKey(email) {
  const clean = email.trim().toLowerCase();
  const sanitized = clean.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const hashStr = Math.abs(hash).toString(36);
  return `usr_${sanitized}_${hashStr}`.slice(0, 36);
}

// --- Main restore logic ---
async function restore() {
  let totalRestored = 0;
  let totalFailed   = 0;

  // 1. Restore entity collections
  for (const [key, collectionId] of Object.entries(collectionsMap)) {
    const records = backupData[key] || [];
    if (records.length === 0) {
      console.log(`Skipping ${collectionId} — no records in backup.`);
      continue;
    }

    console.log(`Restoring ${records.length} records → ${collectionId}...`);
    let count = 0;

    for (const record of records) {
      if (!record.id) continue;
      const orgId = record.organizationId || 'org_default';
      try {
        await upsertDocument(collectionId, record.id, orgId, record);
        count++;
        process.stdout.write(`\r  → ${count}/${records.length}`);
      } catch (err) {
        console.log(`\n  ❌ Failed [${record.id}]: ${err.message || err}`);
        totalFailed++;
      }
    }
    console.log(`\n  ✓ ${count}/${records.length} restored.`);
    totalRestored += count;
  }

  // 2. Restore User Rights (global_configs: usr_*)
  const userRights = backupData.userRightsList || [];
  if (userRights.length > 0) {
    console.log(`\nRestoring ${userRights.length} user permission records...`);
    let urCount = 0;
    for (const ur of userRights) {
      if (!ur.email) continue;
      const key = makeUserKey(ur.email);
      try {
        await upsertGlobalConfig(key, ur);
        urCount++;
      } catch (err) {
        console.error(`  ❌ Failed user rights [${ur.email}]: ${err.message || err}`);
        totalFailed++;
      }
    }
    console.log(`  ✓ ${urCount}/${userRights.length} user rights restored.`);
    totalRestored += urCount;
  }

  // 3. Restore Organization Profiles (global_configs: prf_*)
  const orgProfiles = backupData.organizationProfiles || [];
  if (orgProfiles.length > 0) {
    console.log(`\nRestoring ${orgProfiles.length} organization profiles...`);
    let opCount = 0;
    for (const op of orgProfiles) {
      if (!op.organizationId) continue;
      const key = `prf_${op.organizationId}`.slice(0, 36);
      try {
        await upsertGlobalConfig(key, op);
        opCount++;
      } catch (err) {
        console.error(`  ❌ Failed org profile [${op.organizationId}]: ${err.message || err}`);
        totalFailed++;
      }
    }
    console.log(`  ✓ ${opCount}/${orgProfiles.length} org profiles restored.`);
    totalRestored += opCount;
  }

  console.log('\n=================================');
  console.log(`🎉 RESTORATION COMPLETE`);
  console.log(`   Total restored: ${totalRestored}`);
  if (totalFailed > 0) {
    console.log(`   ⚠ Total failed:  ${totalFailed}`);
    process.exit(1);
  } else {
    console.log('=================================');
    console.log('✅ All records restored successfully!');
    console.log('Refresh your browser to load the restored data.');
  }
}

restore().catch(err => {
  console.error('\n❌ Fatal restore error:', err.message || err);
  process.exit(1);
});
