import readline from 'readline';
import dotenv from 'dotenv';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Load environmental parameters if configured
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log("\n=== Appwrite Database Bootstrapper ===");

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

  let apiKey = process.env.VITE_APPWRITE_API_KEY;
  if (!apiKey) {
    apiKey = await question("Enter your Appwrite API Key (must have 'databases.write' permission scope): ");
    apiKey = apiKey.trim();
  } else {
    console.log("Using API Key from VITE_APPWRITE_API_KEY environment variable.");
  }
  if (!apiKey) {
    console.error("❌ API Key is required to create database schemas.");
    rl.close();
    return;
  }

  const dbId = 'fleet_db';
  const collections = [
    { id: 'trucks', name: 'Trucks', type: 'entity' },
    { id: 'drivers', name: 'Drivers', type: 'entity' },
    { id: 'offices', name: 'Offices', type: 'entity' },
    { id: 'accounts', name: 'Accounts', type: 'entity' },
    { id: 'trips', name: 'Trips', type: 'entity' },
    { id: 'expenses', name: 'Expenses', type: 'entity' },
    { id: 'tyres', name: 'Tyres', type: 'entity' },
    { id: 'audit_logs', name: 'Audit Logs', type: 'entity' },
    { id: 'support_tickets', name: 'Support Tickets', type: 'entity' },
    { id: 'global_configs', name: 'Global Configs', type: 'config' }
  ];

  const headers = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': targetProjectId,
    'X-Appwrite-Key': apiKey
  };

  try {
    // 0. Automatic Safety Backup
    console.log("\n0. Initiating automatic safety backup before destructive operations...");
    try {
      const { runBackup } = require('./backup-db.cjs');
      const backupPath = await runBackup();
      console.log(`✓ Safety backup created successfully at: ${backupPath}`);
    } catch (backupErr) {
      console.error("❌ Safety backup failed! Aborting database bootstrapping to prevent data loss.");
      throw new Error(`Safety backup failed: ${backupErr.message}`);
    }

    // 1. Check if database exists, otherwise create it (Incremental/Non-destructive)
    console.log(`\n1. Checking database "${dbId}"...`);

    // 2. Create Database
    console.log(`\n2. Creating database "${dbId}"...`);
    let dbResponse = await fetch(`${endpoint}/databases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        databaseId: dbId,
        name: 'Fleet Database'
      })
    });

    let dbData = await dbResponse.json();
    if (dbResponse.ok) {
      console.log(`✓ Database "${dbId}" created successfully.`);
    } else if (dbData.code === 409 || dbData.type === 'database_already_exists') {
      console.log(`ℹ Database "${dbId}" already exists.`);
    } else {
      throw new Error(`Failed to create database: ${dbData.message || JSON.stringify(dbData)}`);
    }

    // 3. Create Collections
    console.log(`\n3. Creating collections...`);
    for (const col of collections) {
      console.log(`Creating collection "${col.id}" ("${col.name}")...`);
      let colResponse = await fetch(`${endpoint}/databases/${dbId}/collections`, {
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

      let colData = await colResponse.json();
      if (colResponse.ok) {
        console.log(`✓ Collection "${col.id}" created successfully.`);
      } else if (colData.code === 409 || colData.type === 'collection_already_exists') {
        console.log(`ℹ Collection "${col.id}" already exists.`);
      } else {
        throw new Error(`Failed to create collection "${col.id}": ${colData.message || JSON.stringify(colData)}`);
      }
    }

    // 4. Create Attributes
    console.log(`\n4. Creating attributes in collections...`);
    const collectionCustomConfig = {
      audit_logs: {
        attributes: [
          { key: 'organizationId', type: 'string', size: 50, required: false },
          { key: 'timestamp', type: 'string', size: 30, required: false },
          { key: 'user', type: 'string', size: 100, required: false },
          { key: 'action', type: 'string', size: 20, required: false },
          { key: 'category', type: 'string', size: 30, required: false },
          { key: 'reference', type: 'string', size: 100, required: false },
          { key: 'details', type: 'string', size: 10000, required: false },
          { key: 'data', type: 'string', size: 100000, required: true }
        ]
      },
      trips: {
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
        ]
      },
      expenses: {
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
        ]
      },
      tyres: {
        attributes: [
          { key: 'organizationId', type: 'string', size: 50, required: false },
          { key: 'tyreNo', type: 'string', size: 50, required: false },
          { key: 'manufacturer', type: 'string', size: 50, required: false },
          { key: 'status', type: 'string', size: 30, required: false },
          { key: 'currentTruckNo', type: 'string', size: 50, required: false },
          { key: 'purchaseDate', type: 'string', size: 20, required: false },
          { key: 'data', type: 'string', size: 100000, required: true }
        ]
      },
      support_tickets: {
        attributes: [
          { key: 'organizationId', type: 'string', size: 50, required: false },
          { key: 'ticketNo', type: 'string', size: 50, required: false },
          { key: 'requesterName', type: 'string', size: 100, required: false },
          { key: 'requesterEmail', type: 'string', size: 100, required: false },
          { key: 'requesterPhone', type: 'string', size: 50, required: false },
          { key: 'category', type: 'string', size: 50, required: false },
          { key: 'title', type: 'string', size: 200, required: false },
          { key: 'description', type: 'string', size: 5000, required: false },
          { key: 'status', type: 'string', size: 30, required: false },
          { key: 'assignedTeam', type: 'string', size: 50, required: false },
          { key: 'assignedTo', type: 'string', size: 100, required: false },
          { key: 'data', type: 'string', size: 1000000, required: true }
        ]
      }
    };

    for (const col of collections) {
      const attributes = collectionCustomConfig[col.id]?.attributes || (
        col.type === 'entity'
          ? [
            { key: 'organizationId', type: 'string', size: 50, required: false },
            { key: 'data', type: 'string', size: 1000000, required: true }
          ]
          : [
            { key: 'key', type: 'string', size: 50, required: true },
            { key: 'data', type: 'string', size: 1000000, required: true }
          ]
      );

      for (const attr of attributes) {
        console.log(`Creating attribute "${attr.key}" in collection "${col.id}"...`);
        const endpointType = attr.type === 'float' ? 'float' : 'string';
        const body = attr.type === 'float'
          ? { key: attr.key, required: attr.required }
          : { key: attr.key, size: attr.size, required: attr.required };

        let attrResponse = await fetch(`${endpoint}/databases/${dbId}/collections/${col.id}/attributes/${endpointType}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        let attrData = await attrResponse.json();
        if (attrResponse.ok) {
          console.log(`✓ Attribute "${attr.key}" created in "${col.id}".`);
        } else if (attrData.code === 409 || attrData.type === 'attribute_already_exists') {
          console.log(`ℹ Attribute "${attr.key}" already exists in "${col.id}".`);
        } else {
          throw new Error(`Failed to create attribute "${attr.key}" in "${col.id}": ${attrData.message || JSON.stringify(attrData)}`);
        }
      }
    }

    // 5. Wait for attributes to transition from processing to available
    console.log(`\n5. Waiting for attributes to become active...`);
    let attributesReady = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      let pending = 0;
      for (const col of collections) {
        let getColRes = await fetch(`${endpoint}/databases/${dbId}/collections/${col.id}`, {
          headers
        });
        if (!getColRes.ok) {
          pending++;
          continue;
        }
        let colMeta = await getColRes.json();
        const expectedKeys = (collectionCustomConfig[col.id]?.attributes || (col.type === 'entity' ? [{ key: 'organizationId' }, { key: 'data' }] : [{ key: 'key' }, { key: 'data' }])).map(a => a.key);
        const activeAttrs = colMeta.attributes ? colMeta.attributes.filter(a => expectedKeys.includes(a.key)) : [];

        if (activeAttrs.length === expectedKeys.length && activeAttrs.every(a => a.status === 'available')) {
          // Ready
        } else {
          pending++;
          const statuses = activeAttrs.map(a => `${a.key}:${a.status}`).join(', ');
          console.log(`Collection "${col.id}" attributes status: [ ${statuses} ]`);
        }
      }

      if (pending === 0) {
        attributesReady = true;
        break;
      } else {
        console.log(`Waiting... ${pending} collections still processing attributes (attempt ${attempt + 1}/30)...`);
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    if (!attributesReady) {
      console.warn("⚠ Warning: Attributes took too long to become available. Index creation might fail.");
    } else {
      console.log("✓ All attributes are available and active.");
    }

    // 6. Create Indexes
    console.log(`\n6. Creating indexes...`);
    const customIndexes = {
      audit_logs: [
        { key: 'idx_audit_logs_organizationId', type: 'key', attributes: ['organizationId'] },
        { key: 'idx_audit_logs_timestamp', type: 'key', attributes: ['timestamp'] },
        { key: 'idx_audit_logs_category', type: 'key', attributes: ['category'] },
        { key: 'idx_audit_logs_action', type: 'key', attributes: ['action'] },
        { key: 'idx_audit_logs_details', type: 'fulltext', attributes: ['details'] },
        { key: 'idx_audit_logs_org_ts', type: 'key', attributes: ['organizationId', 'timestamp'] }
      ],
      trips: [
        { key: 'idx_trips_organizationId', type: 'key', attributes: ['organizationId'] },
        { key: 'idx_trips_startDate', type: 'key', attributes: ['startDate'] },
        { key: 'idx_trips_status', type: 'key', attributes: ['status'] },
        { key: 'idx_trips_truckNo', type: 'key', attributes: ['truckNo'] },
        { key: 'idx_trips_tripNo_driver', type: 'fulltext', attributes: ['tripNo', 'driverName'] }
      ],
      expenses: [
        { key: 'idx_expenses_organizationId', type: 'key', attributes: ['organizationId'] },
        { key: 'idx_expenses_date', type: 'key', attributes: ['date'] },
        { key: 'idx_expenses_truckNo', type: 'key', attributes: ['truckNo'] },
        { key: 'idx_expenses_expenseType', type: 'key', attributes: ['expenseType'] },
        { key: 'idx_expenses_shopName', type: 'fulltext', attributes: ['shopName'] }
      ],
      tyres: [
        { key: 'idx_tyres_organizationId', type: 'key', attributes: ['organizationId'] },
        { key: 'idx_tyres_status', type: 'key', attributes: ['status'] },
        { key: 'idx_tyres_tyreNo', type: 'key', attributes: ['tyreNo'] },
        { key: 'idx_tyres_currentTruckNo', type: 'key', attributes: ['currentTruckNo'] }
      ],
      support_tickets: [
        { key: 'idx_support_tickets_organizationId', type: 'key', attributes: ['organizationId'] },
        { key: 'idx_support_tickets_status', type: 'key', attributes: ['status'] },
        { key: 'idx_support_tickets_ticketNo', type: 'key', attributes: ['ticketNo'] },
        { key: 'idx_support_tickets_assignedTeam', type: 'key', attributes: ['assignedTeam'] }
      ]
    };

    for (const col of collections) {
      const indexes = customIndexes[col.id] || (
        col.type === 'entity'
          ? [{ key: `idx_${col.id}_organizationId`, type: 'key', attributes: ['organizationId'] }]
          : []
      );

      for (const index of indexes) {
        console.log(`Creating index "${index.key}" on collection "${col.id}"...`);
        let idxResponse = await fetch(`${endpoint}/databases/${dbId}/collections/${col.id}/indexes`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            key: index.key,
            type: index.type,
            attributes: index.attributes
          })
        });
        let idxData = await idxResponse.json();
        if (idxResponse.ok) {
          console.log(`✓ Index "${index.key}" created successfully.`);
        } else if (idxData.code === 409 || idxData.type === 'index_already_exists') {
          console.log(`ℹ Index "${index.key}" already exists.`);
        } else {
          console.warn(`⚠ Failed to create index "${index.key}": ${idxData.message}`);
        }
      }
    }

    // 7. Create Storage Bucket
    console.log(`\n7. Setting up Storage Bucket...`);
    const bucketId = process.env.VITE_APPWRITE_BUCKET_ID || 'fleet_docs';
    console.log(`Creating/Verifying Storage Bucket "${bucketId}"...`);
    try {
      let bucketResponse = await fetch(`${endpoint}/storage/buckets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bucketId: bucketId,
          name: 'Fleet Documents',
          permissions: [
            'create("any")',
            'read("any")',
            'update("any")',
            'delete("any")'
          ],
          fileSecurity: false
        })
      });

      let bucketData = await bucketResponse.json();
      if (bucketResponse.ok) {
        console.log(`✓ Storage Bucket "${bucketId}" created successfully.`);
      } else if (bucketData.code === 409 || bucketData.type === 'storage_bucket_already_exists' || bucketData.type === 'bucket_already_exists') {
        console.log(`ℹ Storage Bucket "${bucketId}" already exists.`);
      } else {
        console.warn(`⚠ Warning: Storage bucket setup returned: ${bucketData.message || JSON.stringify(bucketData)}`);
      }
    } catch (bucketErr) {
      console.warn(`⚠ Warning: Storage bucket setup failed: ${bucketErr.message}`);
    }

    console.log("\n=================================");
    console.log("✓ Setup Complete!");
    console.log(`Database ID: "${dbId}"`);
    console.log(`Collections created:`);
    for (const col of collections) {
      console.log(` - "${col.id}"`);
    }
    console.log("=================================");
    console.log("You can now safely sync your app directly using row-level document databases!");

  } catch (err) {
    console.error(`\n❌ Bootstrapping Error: ${err.message}`);
  } finally {
    rl.close();
  }
}

main();
