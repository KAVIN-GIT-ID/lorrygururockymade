const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Get backup path from command line arguments or default
const backupPath = process.argv[2] || 'C:\\Users\\infimove\\Downloads\\TT_Tracker_Backup_2026-06-03.json';

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const apiKey = process.env.VITE_APPWRITE_API_KEY;

if (!fs.existsSync(backupPath)) {
  console.error(`❌ Backup file not found at: ${backupPath}`);
  console.log(`Usage: node scripts/restore-from-backup.js <path-to-backup-json-file>`);
  process.exit(1);
}

console.log('=== Appwrite Database Restorer ===');
console.log(`Loading backup: ${backupPath}`);
console.log(`Endpoint:       ${endpoint}`);
console.log(`Project:        ${projectId}`);
console.log(`Database:       ${databaseId}`);

const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

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

  const headers = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': projectId,
    'X-Appwrite-Key': apiKey
  };

  // Try updating first
  const updateUrl = `${endpoint}/databases/${databaseId}/collections/${collectionId}/documents/${docId}`;
  let res = await fetch(updateUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ data: documentData.data, permissions: documentData.permissions })
  });

  if (res.status === 404) {
    const createUrl = `${endpoint}/databases/${databaseId}/collections/${collectionId}/documents`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        documentId: docId,
        data: documentData
      })
    });
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${createRes.status}`);
    }
  } else if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
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

      const headers = {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey
      };

      const updateUrl = `${endpoint}/databases/${databaseId}/collections/global_configs/documents/${key}`;
      try {
        let res = await fetch(updateUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ data: documentData.data })
        });

        if (res.status === 404) {
          const createUrl = `${endpoint}/databases/${databaseId}/collections/global_configs/documents`;
          const createRes = await fetch(createUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              documentId: key,
              data: documentData
            })
          });
          if (!createRes.ok) {
            const err = await createRes.json().catch(() => ({}));
            throw new Error(err.message || `HTTP ${createRes.status}`);
          }
        } else if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${res.status}`);
        }
        urCount++;
      } catch (err) {
        console.error(`  ❌ Failed to restore permission for ${ur.email}:`, err.message);
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

      const headers = {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey
      };

      const updateUrl = `${endpoint}/databases/${databaseId}/collections/global_configs/documents/${key}`;
      try {
        let res = await fetch(updateUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ data: documentData.data })
        });

        if (res.status === 404) {
          const createUrl = `${endpoint}/databases/${databaseId}/collections/global_configs/documents`;
          const createRes = await fetch(createUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              documentId: key,
              data: documentData
            })
          });
          if (!createRes.ok) {
            const err = await createRes.json().catch(() => ({}));
            throw new Error(err.message || `HTTP ${createRes.status}`);
          }
        } else if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${res.status}`);
        }
        opCount++;
      } catch (err) {
        console.error(`  ❌ Failed to restore profile for ${op.organizationId}:`, err.message);
      }
    }
    console.log(`  ✓ Restored ${opCount}/${orgProfiles.length} organization profiles.`);

    console.log('\n🎉 RESTORATION COMPLETED SUCCESSFULLY!');
  } catch (globalErr) {
    console.error('\n❌ Restoration aborted due to error:', globalErr);
  }
}

restore();
