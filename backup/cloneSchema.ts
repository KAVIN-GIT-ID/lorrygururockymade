import { Client as AppwriteClient, Databases, Query, Storage } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';

// Production Credentials
const prodProjectId = process.env.APPWRITE_PROJECT_ID;
const prodApiKey = process.env.APPWRITE_API_KEY;

// Development Credentials
const devProjectId = process.env.DEV_APPWRITE_PROJECT_ID;
const devApiKey = process.env.DEV_APPWRITE_API_KEY;

const dbId = process.env.APPWRITE_DATABASE_ID || 'fleet_db';

if (!prodProjectId || !prodApiKey || !devProjectId || !devApiKey) {
  console.error('❌ Missing production or development Appwrite keys in .env');
  process.exit(1);
}

// Setup clients
const clientProd = new AppwriteClient().setEndpoint(endpoint).setProject(prodProjectId).setKey(prodApiKey);
const clientDev = new AppwriteClient().setEndpoint(endpoint).setProject(devProjectId).setKey(devApiKey);

const databasesProd = new Databases(clientProd);
const databasesDev = new Databases(clientDev);
const storageProd = new Storage(clientProd);
const storageDev = new Storage(clientDev);

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitUntilAttributesAvailable(colId: string) {
  console.log(`  Waiting for attributes in collection "${colId}" to process...`);
  while (true) {
    const list = await databasesDev.listAttributes(dbId, colId);
    const processing = list.attributes.filter((a: any) => a.status !== 'available' && a.status !== 'failed');
    if (processing.length === 0) {
      break;
    }
    console.log(`  - ${processing.length} attributes processing, waiting 2s...`);
    await sleep(2000);
  }
}

async function cloneSchema() {
  console.log(`=========================================`);
  console.log(`🧬 Appwrite Database Schema Cloner`);
  console.log(`=========================================`);
  console.log(`Source (Prod Project): ${prodProjectId}`);
  console.log(`Target (Dev Project) : ${devProjectId}`);
  console.log(`Database ID          : ${dbId}\n`);

  // 1. Create database in Dev if not exists
  try {
    await databasesDev.get(dbId);
    console.log(`✅ Target Database "${dbId}" already exists in Dev.`);
  } catch {
    console.log(`🚀 Creating target database "${dbId}" in Dev...`);
    await databasesDev.create(dbId, 'Fleet DB');
  }

  // 2. Fetch all collections from Prod
  console.log(`📡 Fetching collections from Prod...`);
  const collectionsRes = await databasesProd.listCollections(dbId, [Query.limit(100)]);
  const collections = collectionsRes.collections as any[];
  console.log(`Found ${collections.length} collection(s) in Prod.`);

  // 3. Create Collections in Dev (First Pass: no attributes/relationships)
  for (const col of collections) {
    const colId = col.$id;
    try {
      await databasesDev.getCollection(dbId, colId);
      console.log(`✅ Collection "${col.name}" (${colId}) already exists in Dev.`);
    } catch {
      console.log(`🚀 Creating collection "${col.name}" (${colId}) in Dev...`);
      await databasesDev.createCollection(
        dbId,
        colId,
        col.name,
        col.$permissions || col.permissions,
        col.documentSecurity
      );
    }
  }

  // 4. Create non-relationship attributes (Second Pass)
  console.log(`\n⚙️ Cloning attributes (Pass 1: Scalar attributes)...`);
  for (const col of collections) {
    const colId = col.$id;
    console.log(`Checking attributes for: ${col.name} (${colId})...`);

    const attrList = await databasesProd.listAttributes(dbId, colId, [Query.limit(100)]);
    const attributes = attrList.attributes as any[];

    for (const attr of attributes) {
      // Relationships will be created in the next pass
      if (attr.type === 'relationship') continue;

      const key = attr.key;
      const required = attr.required;
      const array = attr.array;
      const defaultValue = attr.default;

      try {
        await databasesDev.getAttribute(dbId, colId, key);
        continue; // already exists
      } catch {}

      console.log(`  - Creating attribute: ${key} (${attr.type})`);
      
      if (attr.type === 'string') {
        if (attr.format === 'email') {
          await databasesDev.createEmailAttribute(dbId, colId, key, required, defaultValue, array);
        } else if (attr.format === 'ip') {
          await databasesDev.createIpAttribute(dbId, colId, key, required, defaultValue, array);
        } else if (attr.format === 'url') {
          await databasesDev.createUrlAttribute(dbId, colId, key, required, defaultValue, array);
        } else if (attr.format === 'enum') {
          await databasesDev.createEnumAttribute(dbId, colId, key, attr.elements, required, defaultValue, array);
        } else {
          await databasesDev.createStringAttribute(dbId, colId, key, attr.size || 255, required, defaultValue, array);
        }
      } else if (attr.type === 'integer') {
        await databasesDev.createIntegerAttribute(dbId, colId, key, required, attr.min, attr.max, defaultValue, array);
      } else if (attr.type === 'double') {
        await databasesDev.createFloatAttribute(dbId, colId, key, required, attr.min, attr.max, defaultValue, array);
      } else if (attr.type === 'boolean') {
        await databasesDev.createBooleanAttribute(dbId, colId, key, required, defaultValue, array);
      } else if (attr.type === 'datetime') {
        await databasesDev.createDatetimeAttribute(dbId, colId, key, required, defaultValue, array);
      }
      await sleep(500); // short throttle
    }
    
    // Wait until they are available before continuing
    await waitUntilAttributesAvailable(colId);
  }

  // 5. Create relationship attributes (Third Pass)
  console.log(`\n⚙️ Cloning relationship attributes (Pass 2)...`);
  for (const col of collections) {
    const colId = col.$id;
    const attrList = await databasesProd.listAttributes(dbId, colId, [Query.limit(100)]);
    const attributes = attrList.attributes as any[];

    for (const attr of attributes) {
      if (attr.type !== 'relationship') continue;

      const key = attr.key;
      try {
        await databasesDev.getAttribute(dbId, colId, key);
        continue; // already exists
      } catch {}

      console.log(`  - Creating relationship: ${colId} -> ${key} -> ${attr.relatedCollection}`);
      await databasesDev.createRelationshipAttribute(
        dbId,
        colId,
        attr.relatedCollection,
        attr.relationType,
        attr.twoWay,
        key,
        attr.twoWayKey,
        attr.onDelete
      );
      await sleep(1000);
    }
  }

  // Wait for relationship attributes to finish processing
  for (const col of collections) {
    await waitUntilAttributesAvailable(col.$id);
  }

  // 6. Create Indexes (Fourth Pass)
  console.log(`\n⚙️ Cloning Indexes...`);
  for (const col of collections) {
    const colId = col.$id;
    const indexList = await databasesProd.listIndexes(dbId, colId, [Query.limit(100)]);
    const indexes = indexList.indexes as any[];

    for (const idx of indexes) {
      const key = idx.key;
      if (key === 'primary' || key === '$id') continue;

      try {
        await databasesDev.getIndex(dbId, colId, key);
        continue; // already exists
      } catch {}

      console.log(`  - Creating index: ${key} on collection ${colId}`);
      await databasesDev.createIndex(
        dbId,
        colId,
        key,
        idx.type,
        idx.attributes,
        idx.orders
      );
      await sleep(1000);
    }
  }

  // 7. Clone Storage Buckets
  console.log(`\n📦 Cloning Storage Buckets...`);
  try {
    const bucketsRes = await storageProd.listBuckets();
    const buckets = bucketsRes.buckets as any[];
    console.log(`Found ${buckets.length} storage bucket(s) in Prod.`);
    
    for (const b of buckets) {
      try {
        await storageDev.getBucket(b.$id);
        console.log(`✅ Bucket "${b.name}" (${b.$id}) already exists in Dev.`);
      } catch {
        console.log(`🚀 Recreating bucket "${b.name}" (${b.$id}) in Dev...`);
        await storageDev.createBucket(
          b.$id,
          b.name,
          b.$permissions || b.permissions,
          b.fileSecurity,
          b.enabled,
          b.maximumFileSize,
          b.allowedFileExtensions,
          b.compression,
          b.encryption,
          b.antipassback
        );
      }
    }
  } catch (err: any) {
    console.warn(`⚠️ Warning: Failed to clone storage buckets schema: ${err.message}`);
  }

  console.log(`\n=========================================`);
  console.log(`🏁 Database Schema Cloned Successfully!`);
  console.log(`=========================================`);
}

cloneSchema().catch(err => {
  console.error('❌ Schema cloning failed:', err);
  process.exit(1);
});
