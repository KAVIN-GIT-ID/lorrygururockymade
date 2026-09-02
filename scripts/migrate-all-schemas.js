import readline from 'readline';
import dotenv from 'dotenv';

// Load environmental parameters if configured
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const dbId = 'fleet_db';

const targetCollections = [
  {
    id: 'audit_logs',
    name: 'Audit Logs',
    attributes: [
      { key: 'organizationId', type: 'string', size: 50, required: false },
      { key: 'timestamp', type: 'string', size: 30, required: false },
      { key: 'user', type: 'string', size: 100, required: false },
      { key: 'action', type: 'string', size: 20, required: false },
      { key: 'category', type: 'string', size: 30, required: false },
      { key: 'reference', type: 'string', size: 100, required: false },
      { key: 'details', type: 'string', size: 10000, required: false },
      { key: 'data', type: 'string', size: 100000, required: true }
    ],
    indexes: [
      { key: 'idx_audit_logs_organizationId', type: 'key', attributes: ['organizationId'] },
      { key: 'idx_audit_logs_timestamp', type: 'key', attributes: ['timestamp'] },
      { key: 'idx_audit_logs_category', type: 'key', attributes: ['category'] },
      { key: 'idx_audit_logs_action', type: 'key', attributes: ['action'] },
      { key: 'idx_audit_logs_details', type: 'fulltext', attributes: ['details'] },
      { key: 'idx_audit_logs_org_ts', type: 'key', attributes: ['organizationId', 'timestamp'] }
    ],
    extractFn: (doc, rawData) => ({
      organizationId: doc.organizationId || 'org_default',
      timestamp: rawData.timestamp || '',
      user: rawData.user || '',
      action: rawData.action || 'Cloud',
      category: rawData.category || '',
      reference: rawData.reference || '',
      details: rawData.details || '',
      data: JSON.stringify(rawData)
    })
  },
  {
    id: 'trips',
    name: 'Trips',
    attributes: [
      { key: 'organizationId', type: 'string', size: 50, required: false },
      { key: 'tripNo', type: 'string', size: 50, required: false },
      { key: 'truckNo', type: 'string', size: 50, required: false },
      { key: 'startDate', type: 'string', size: 20, required: false },
      { key: 'endDate', type: 'string', size: 20, required: false },
      { key: 'driverName', type: 'string', size: 100, required: false },
      { key: 'status', type: 'string', size: 30, required: false },
      { key: 'notes', type: 'string', size: 5000, required: false },
      { key: 'data', type: 'string', size: 1000000, required: true }
    ],
    indexes: [
      { key: 'idx_trips_organizationId', type: 'key', attributes: ['organizationId'] },
      { key: 'idx_trips_startDate', type: 'key', attributes: ['startDate'] },
      { key: 'idx_trips_status', type: 'key', attributes: ['status'] },
      { key: 'idx_trips_truckNo', type: 'key', attributes: ['truckNo'] },
      { key: 'idx_trips_tripNo_driver', type: 'fulltext', attributes: ['tripNo', 'driverName'] }
    ],
    extractFn: (doc, rawData) => ({
      organizationId: doc.organizationId || 'org_default',
      tripNo: rawData.tripNo || '',
      truckNo: rawData.truckNo || '',
      startDate: rawData.startDate || '',
      endDate: rawData.endDate || '',
      driverName: rawData.driverName || '',
      status: rawData.status || 'Pending',
      notes: rawData.notes || '',
      data: JSON.stringify(rawData)
    })
  },
  {
    id: 'expenses',
    name: 'Expenses',
    attributes: [
      { key: 'organizationId', type: 'string', size: 50, required: false },
      { key: 'truckNo', type: 'string', size: 50, required: false },
      { key: 'expenseType', type: 'string', size: 50, required: false },
      { key: 'shopName', type: 'string', size: 200, required: false },
      { key: 'amount', type: 'float', required: false },
      { key: 'paymentMode', type: 'string', size: 200, required: false },
      { key: 'date', type: 'string', size: 20, required: false },
      { key: 'status', type: 'string', size: 30, required: false },
      { key: 'accountType', type: 'string', size: 30, required: false },
      { key: 'driverName', type: 'string', size: 100, required: false },
      { key: 'data', type: 'string', size: 100000, required: true }
    ],
    indexes: [
      { key: 'idx_expenses_organizationId', type: 'key', attributes: ['organizationId'] },
      { key: 'idx_expenses_date', type: 'key', attributes: ['date'] },
      { key: 'idx_expenses_truckNo', type: 'key', attributes: ['truckNo'] },
      { key: 'idx_expenses_expenseType', type: 'key', attributes: ['expenseType'] },
      { key: 'idx_expenses_shopName', type: 'fulltext', attributes: ['shopName'] }
    ],
    extractFn: (doc, rawData) => ({
      organizationId: doc.organizationId || 'org_default',
      truckNo: rawData.truckNo || '',
      expenseType: rawData.expenseType || '',
      shopName: rawData.shopName || '',
      amount: Number(rawData.amount) || 0,
      paymentMode: rawData.paymentMode || '',
      date: rawData.date || '',
      status: rawData.status || 'Pending',
      accountType: rawData.accountType || 'Account',
      driverName: rawData.driverName || '',
      data: JSON.stringify(rawData)
    })
  },
  {
    id: 'tyres',
    name: 'Tyres',
    attributes: [
      { key: 'organizationId', type: 'string', size: 50, required: false },
      { key: 'tyreNo', type: 'string', size: 50, required: false },
      { key: 'manufacturer', type: 'string', size: 50, required: false },
      { key: 'status', type: 'string', size: 30, required: false },
      { key: 'currentTruckNo', type: 'string', size: 50, required: false },
      { key: 'purchaseDate', type: 'string', size: 20, required: false },
      { key: 'data', type: 'string', size: 100000, required: true }
    ],
    indexes: [
      { key: 'idx_tyres_organizationId', type: 'key', attributes: ['organizationId'] },
      { key: 'idx_tyres_status', type: 'key', attributes: ['status'] },
      { key: 'idx_tyres_tyreNo', type: 'key', attributes: ['tyreNo'] },
      { key: 'idx_tyres_currentTruckNo', type: 'key', attributes: ['currentTruckNo'] }
    ],
    extractFn: (doc, rawData) => ({
      organizationId: doc.organizationId || 'org_default',
      tyreNo: rawData.tyreNo || '',
      manufacturer: rawData.manufacturer || '',
      status: rawData.status || 'Available',
      currentTruckNo: rawData.currentTruckNo || '',
      purchaseDate: rawData.purchaseDate || '',
      data: JSON.stringify(rawData)
    })
  },
  {
    id: 'payments',
    name: 'Payments',
    attributes: [
      { key: 'organizationId', type: 'string', size: 50, required: false },
      { key: 'truckNo', type: 'string', size: 50, required: false },
      { key: 'amount', type: 'float', required: false },
      { key: 'transactionId', type: 'string', size: 100, required: false },
      { key: 'paymentDate', type: 'string', size: 30, required: false },
      { key: 'duration', type: 'string', size: 30, required: false },
      { key: 'status', type: 'string', size: 30, required: false },
      { key: 'customerEmail', type: 'string', size: 100, required: false },
      { key: 'customerName', type: 'string', size: 100, required: false },
      { key: 'customerPhone', type: 'string', size: 50, required: false },
      { key: 'data', type: 'string', size: 100000, required: true }
    ],
    indexes: [
      { key: 'idx_payments_organizationId', type: 'key', attributes: ['organizationId'] },
      { key: 'idx_payments_truckNo', type: 'key', attributes: ['truckNo'] },
      { key: 'idx_payments_transactionId', type: 'key', attributes: ['transactionId'] }
    ],
    extractFn: (doc, rawData) => ({
      organizationId: doc.organizationId || 'org_default',
      truckNo: rawData.truckNo || '',
      amount: Number(rawData.amount) || 0,
      transactionId: rawData.transactionId || '',
      paymentDate: rawData.paymentDate || '',
      duration: rawData.duration || '',
      status: rawData.status || 'Success',
      customerEmail: rawData.customerEmail || '',
      customerName: rawData.customerName || '',
      customerPhone: rawData.customerPhone || '',
      data: JSON.stringify(rawData)
    })
  }
];

async function main() {
  console.log("\n=== Appwrite Database Schema Migration Script ===");

  const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
  const projectId = process.env.VITE_APPWRITE_PROJECT_ID;

  console.log(`Appwrite Endpoint: ${endpoint}`);
  console.log(`Project ID:        ${projectId || '(Not loaded from environment)'}`);

  let targetProjectId = projectId;
  if (!targetProjectId) {
    targetProjectId = await question("Enter your Appwrite Project ID: ");
    targetProjectId = targetProjectId.trim();
  }

  if (!targetProjectId) {
    console.error("❌ Project ID is required.");
    rl.close();
    return;
  }

  let apiKey = await question("Enter your Appwrite API Key (databases.write permission required): ");
  apiKey = apiKey.trim();
  if (!apiKey) {
    console.error("❌ API Key is required.");
    rl.close();
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': targetProjectId,
    'X-Appwrite-Key': apiKey
  };

  const backups = {};

  try {
    // 0. Automatic Safety Backup to File
    console.log("\n--- 0. Initiating automatic safety backup to file before schema migration ---");
    try {
      const { runBackup } = await import('./backup-db.cjs');
      const backupPath = await runBackup();
      console.log(`✓ Safety backup created successfully at: ${backupPath}`);
    } catch (backupErr) {
      console.error("❌ Safety backup to file failed! Aborting schema migration to prevent data loss.");
      throw new Error(`Safety backup failed: ${backupErr.message}`);
    }

    // 1. Fetch and Backup Existing Data
    console.log("\n--- 1. Backing up existing database documents ---");
    for (const col of targetCollections) {
      console.log(`Backing up collection "${col.id}"...`);
      const backedUpDocs = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        try {
          const res = await fetch(
            `${endpoint}/databases/${dbId}/collections/${col.id}/documents?limit=${limit}&offset=${offset}`,
            { headers }
          );

          if (!res.ok) {
            const errData = await res.json();
            if (errData.code === 404 || errData.type === 'collection_not_found') {
              console.log(`ℹ Collection "${col.id}" does not exist yet. No backup needed.`);
            } else {
              console.warn(`⚠ Backup fetch error for "${col.id}":`, errData.message);
            }
            hasMore = false;
            break;
          }

          const data = await res.json();
          const docs = data.documents || [];
          backedUpDocs.push(...docs);

          if (docs.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
          }
        } catch (fetchErr) {
          console.error(`❌ Connection error during backup of "${col.id}":`, fetchErr.message);
          hasMore = false;
        }
      }

      backups[col.id] = backedUpDocs;
      console.log(`✓ Backed up ${backedUpDocs.length} documents from "${col.id}".`);
    }

    // 2. Delete Existing Collections
    console.log("\n--- 2. Deleting old database collections ---");
    for (const col of targetCollections) {
      console.log(`Deleting collection "${col.id}" if exists...`);
      const res = await fetch(`${endpoint}/databases/${dbId}/collections/${col.id}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        console.log(`✓ Collection "${col.id}" deleted successfully.`);
      } else {
        const errData = await res.json();
        if (errData.code === 404 || errData.type === 'collection_not_found') {
          console.log(`ℹ Collection "${col.id}" does not exist, skipping deletion.`);
        } else {
          console.warn(`⚠ Failed to delete collection "${col.id}":`, errData.message);
        }
      }
    }

    // Wait brief moment to let deletions propagate in Appwrite database coordinator
    console.log("Waiting 3 seconds for Appwrite database collection cleanups to complete...");
    await new Promise(r => setTimeout(r, 3000));

    // 3. Recreate collections, attributes, and indexes
    console.log("\n--- 3. Recreating collections and configuring attributes ---");
    for (const col of targetCollections) {
      console.log(`\nRecreating collection "${col.id}" ("${col.name}")...`);
      const colRes = await fetch(`${endpoint}/databases/${dbId}/collections`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          collectionId: col.id,
          name: col.name,
          permissions: [
            'create("any")',
            'read("any")',
            'update("any")',
            'delete("any")'
          ]
        })
      });

      const colData = await colRes.json();
      if (!colRes.ok && colData.code !== 409 && colData.type !== 'collection_already_exists') {
        throw new Error(`Failed to create collection "${col.id}": ${colData.message}`);
      }
      console.log(`✓ Collection "${col.id}" created.`);

      // Create Attributes
      for (const attr of col.attributes) {
        console.log(`Creating attribute "${attr.key}" (Type: ${attr.type}) in "${col.id}"...`);
        const endpointType = attr.type === 'float' ? 'float' : 'string';
        const url = `${endpoint}/databases/${dbId}/collections/${col.id}/attributes/${endpointType}`;
        const body = attr.type === 'float'
          ? { key: attr.key, required: attr.required }
          : { key: attr.key, size: attr.size, required: attr.required };

        const attrRes = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        const attrData = await attrRes.json();
        if (!attrRes.ok && attrData.code !== 409 && attrData.type !== 'attribute_already_exists') {
          throw new Error(`Failed to create attribute "${attr.key}" in "${col.id}": ${attrData.message}`);
        }
      }
    }

    // 4. Wait for attributes to become active
    console.log("\n--- 4. Waiting for database attributes to transition to available status ---");
    let activeChecksPassed = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      let pending = 0;
      for (const col of targetCollections) {
        const res = await fetch(`${endpoint}/databases/${dbId}/collections/${col.id}`, { headers });
        if (!res.ok) {
          pending++;
          continue;
        }
        const colMeta = await res.json();
        const activeAttrs = colMeta.attributes ? colMeta.attributes.filter(a => col.attributes.some(expected => expected.key === a.key)) : [];

        if (activeAttrs.length === col.attributes.length && activeAttrs.every(a => a.status === 'available')) {
          // All active
        } else {
          pending++;
        }
      }

      if (pending === 0) {
        activeChecksPassed = true;
        break;
      } else {
        console.log(`Waiting... ${pending} collections still building attributes (attempt ${attempt + 1}/30)...`);
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    if (!activeChecksPassed) {
      console.warn("⚠ Warning: Attributes took too long to build. Indexes might fail to register.");
    } else {
      console.log("✓ All attributes are available and active.");
    }

    // 5. Create Indexes
    console.log("\n--- 5. Registering collection indexes ---");
    for (const col of targetCollections) {
      for (const index of col.indexes) {
        console.log(`Registering index "${index.key}" (Type: ${index.type}) on collection "${col.id}"...`);
        const idxRes = await fetch(`${endpoint}/databases/${dbId}/collections/${col.id}/indexes`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            key: index.key,
            type: index.type,
            attributes: index.attributes
          })
        });

        const idxData = await idxRes.json();
        if (idxRes.ok) {
          console.log(`✓ Index "${index.key}" registered.`);
        } else if (idxData.code === 409 || idxData.type === 'index_already_exists') {
          console.log(`ℹ Index "${index.key}" already exists.`);
        } else {
          console.warn(`⚠ Failed to register index "${index.key}": ${idxData.message}`);
        }
      }
    }

    // Wait brief moment for index allocations
    await new Promise(r => setTimeout(r, 1500));

    // 6. Restore Documents
    console.log("\n--- 6. Restoring backed-up records into restructured collections ---");
    for (const col of targetCollections) {
      const documents = backups[col.id] || [];
      console.log(`Restoring ${documents.length} documents into "${col.id}"...`);
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        let rawData = {};
        try {
          rawData = JSON.parse(doc.data);
        } catch (jsonErr) {
          // If old data attribute contained serialized JSON
          rawData = doc;
        }

        const restoredData = col.extractFn(doc, rawData);
        const docId = doc.$id;

        const payload = {
          documentId: docId,
          data: restoredData
        };

        try {
          const res = await fetch(`${endpoint}/databases/${dbId}/collections/${col.id}/documents`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            successCount++;
          } else {
            const errData = await res.json();
            console.error(`❌ [${i + 1}/${documents.length}] Failed to restore ${docId} in ${col.id}: ${errData.message}`);
            failCount++;
          }
        } catch (err) {
          console.error(`❌ [${i + 1}/${documents.length}] Network error restoring ${docId} in ${col.id}: ${err.message}`);
          failCount++;
        }

        // Minor delay to keep connection pipeline smooth
        await new Promise(r => setTimeout(r, 50));
      }

      console.log(`✓ Restoration summary for "${col.id}": ${successCount} succeeded, ${failCount} failed.`);
    }

    console.log("\n🚀 DATABASE SCHEMA MIGRATION COMPLETED SUCCESSFULLY!");

  } catch (err) {
    console.error("\n❌ CRITICAL SCHEMA MIGRATION FATAL ERROR:", err.message);
  } finally {
    rl.close();
  }
}

main();
