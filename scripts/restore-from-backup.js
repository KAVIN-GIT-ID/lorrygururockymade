const fs = require('fs');
const path = require('path');
const { Client, Databases } = require('appwrite');
require('dotenv').config();

const backupPath = 'C:\\Users\\infimove\\Downloads\\TT_Tracker_Backup_2026-05-30.json';

const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'http://52.66.92.164/v1';
const projectId = process.env.VITE_APPWRITE_PROJECT_ID || '6a1c492a0012cf5f3a0c';
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || 'fleet_db';
const apiKey = process.env.VITE_APPWRITE_API_KEY || '7b6ffc61054c9a185db39a858a83280d84430747176173c4a75e2e43a44d9fa68f328af3e4a6f163fd1be83024e8e2ae8c2d81849ae346f2f0f393c76395e0ea792d7a057bbb685606e80f3baa9f6bdc7afb1823bc70f6ad00a84d87a0208b7f325dd0155885d732337b76d74a0cfc28ee3f9e4945cbbe627a909e744d627dd1';

if (!fs.existsSync(backupPath)) {
  console.error(`❌ Backup file not found at: ${backupPath}`);
  process.exit(1);
}

console.log('=== Appwrite Database Restorer ===');
console.log(`Loading backup: ${backupPath}`);
console.log(`Endpoint:       ${endpoint}`);
console.log(`Project:        ${projectId}`);
console.log(`Database:       ${databaseId}`);

const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

// Maps category keys in JSON backup to collection names
const collectionsMap = {
  trucks: 'trucks',
  drivers: 'drivers',
  offices: 'offices',
  accounts: 'accounts',
  trips: 'trips',
  expenses: 'expenses',
  tyres: 'tyres',
  auditLogs: 'audit_logs'
};

async function saveFleetDocument(collectionId, docId, orgId, dataObj) {
  let documentData = {
    organizationId: orgId,
    data: JSON.stringify(dataObj)
  };

  // Build appropriate flat schema fields to match collection bootstrap rules
  if (collectionId === 'audit_logs') {
    documentData = {
      organizationId: orgId,
      timestamp: dataObj.timestamp || '',
      user: dataObj.user || '',
      action: dataObj.action || 'Cloud',
      category: dataObj.category || '',
      reference: dataObj.reference || '',
      details: dataObj.details || '',
      data: JSON.stringify(dataObj)
    };
  } else if (collectionId === 'trips') {
    documentData = {
      organizationId: orgId,
      tripNo: dataObj.tripNo || '',
      truckNo: dataObj.truckNo || '',
      startDate: dataObj.startDate || '',
      endDate: dataObj.endDate || '',
      driverName: dataObj.driverName || '',
      status: dataObj.status || 'Pending',
      notes: dataObj.notes || '',
      data: JSON.stringify(dataObj)
    };
  } else if (collectionId === 'expenses') {
    documentData = {
      organizationId: orgId,
      truckNo: dataObj.truckNo || '',
      expenseType: dataObj.expenseType || '',
      shopName: dataObj.shopName || '',
      amount: Number(dataObj.amount) || 0,
      paymentMode: dataObj.paymentMode || '',
      date: dataObj.date || '',
      status: dataObj.status || 'Pending',
      accountType: dataObj.accountType || 'Account',
      driverName: dataObj.driverName || '',
      data: JSON.stringify(dataObj)
    };
  } else if (collectionId === 'tyres') {
    documentData = {
      organizationId: orgId,
      tyreNo: dataObj.tyreNo || '',
      manufacturer: dataObj.manufacturer || '',
      status: dataObj.status || 'Available',
      currentTruckNo: dataObj.currentTruckNo || '',
      purchaseDate: dataObj.purchaseDate || '',
      data: JSON.stringify(dataObj)
    };
  }

  try {
    await databases.updateDocument(databaseId, collectionId, docId, documentData);
  } catch (err) {
    if (err.code === 404) {
      await databases.createDocument(databaseId, collectionId, docId, documentData);
    } else {
      throw err;
    }
  }
}

async function restore() {
  try {
    // 1. Restore Collections
    for (const [key, collectionId] of Object.entries(collectionsMap)) {
      const records = backupData[key] || [];
      console.log(`\nRestoring ${records.length} records for collection: ${collectionId}...`);
      
      let count = 0;
      for (const record of records) {
        if (!record.id) continue;
        const orgId = record.organizationId || 'org_default';
        try {
          await saveFleetDocument(collectionId, record.id, orgId, record);
          count++;
        } catch (err) {
          console.error(`  ❌ Failed to save document ${record.id} in ${collectionId}:`, err.message);
        }
      }
      console.log(`  ✓ Successfully restored ${count}/${records.length} records.`);
    }

    // 2. Restore Global Configs (Permissions and Profiles)
    console.log(`\nRestoring User Permissions & Organization Profiles...`);
    
    // User permissions
    const userRights = backupData.userRightsList || [];
    let urCount = 0;
    for (const ur of userRights) {
      if (!ur.email) continue;
      
      // Helper to generate doc key
      const clean = ur.email.trim().toLowerCase();
      const sanitized = clean.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);
      let hash = 0;
      for (let i = 0; i < clean.length; i++) {
        hash = (hash << 5) - hash + clean.charCodeAt(i);
        hash |= 0;
      }
      const hashStr = Math.abs(hash).toString(36);
      const key = `usr_${sanitized}_${hashStr}`.slice(0, 36);

      const documentData = {
        key: key,
        data: JSON.stringify(ur)
      };

      try {
        await databases.updateDocument(databaseId, 'global_configs', key, documentData);
        urCount++;
      } catch (err) {
        if (err.code === 404) {
          await databases.createDocument(databaseId, 'global_configs', key, documentData);
          urCount++;
        } else {
          console.error(`  ❌ Failed to restore permission for ${ur.email}:`, err.message);
        }
      }
    }
    console.log(`  ✓ Restored ${urCount}/${userRights.length} user rights.`);

    // Organization Profiles
    const orgProfiles = backupData.organizationProfiles || [];
    let opCount = 0;
    for (const op of orgProfiles) {
      if (!op.organizationId) continue;
      
      const key = `prf_${op.organizationId}`.slice(0, 36);
      const documentData = {
        key: key,
        data: JSON.stringify(op)
      };

      try {
        await databases.updateDocument(databaseId, 'global_configs', key, documentData);
        opCount++;
      } catch (err) {
        if (err.code === 404) {
          await databases.createDocument(databaseId, 'global_configs', key, documentData);
          opCount++;
        } else {
          console.error(`  ❌ Failed to restore profile for ${op.organizationId}:`, err.message);
        }
      }
    }
    console.log(`  ✓ Restored ${opCount}/${orgProfiles.length} organization profiles.`);
    
    console.log('\n🎉 RESTORATION COMPLETED SUCCESSFULLY!');
  } catch (globalErr) {
    console.error('\n❌ Restoration aborted due to error:', globalErr);
  }
}

restore();
