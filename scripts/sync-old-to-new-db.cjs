const { Client, Databases, Query } = require('node-appwrite');

const OLD_ENDPOINT = 'https://api.lorryguru.in/v1';
const OLD_PROJECT_ID = '6a3f5ecf0004bec7885a';
const OLD_API_KEY = 'standard_6a583ba731cc0070dbab883436b7d106ea65c3a51217887d679729d76a5f3206278b32eecfc2ac5f0700385165479db19877baf259c9c9f5739c18936f13ea870e4f8ae071b57f1e13697a6de07a48542934464abed7ec33a9f9ded8d705674d8946be81bca6c717349504dcb926444f11b94f0c3b60b50dc39fdf71b4987408';

const NEW_ENDPOINT = 'https://appwrite.lorryguru.in/v1';
const NEW_PROJECT_ID = '6a7a08cf0037ce918841';
const NEW_API_KEY = 'standard_f9b0f03eabedc1ad3bbec618b968de8cf4e272bca9355725b2ab14902abd0019bc9bd886d4165c6e5e596ed88659a9bd9e35c516cd327f2283886faa15854e504a8cbf7c9c65a38f5103155ce8f7433591f87f49e2f35cfaa982142eb7b29a2db5c07211ec63620bd25e9cc03b341b58ff40a0899ba70a7f11e4da4e293bffda';

const DB_ID = 'fleet_db';

async function syncDatabases() {
  console.log('🚀 Connecting to Old Server:', OLD_ENDPOINT);
  const oldClient = new Client().setEndpoint(OLD_ENDPOINT).setProject(OLD_PROJECT_ID).setKey(OLD_API_KEY);
  const oldDb = new Databases(oldClient);

  console.log('🚀 Connecting to New Server:', NEW_ENDPOINT);
  const newClient = new Client().setEndpoint(NEW_ENDPOINT).setProject(NEW_PROJECT_ID).setKey(NEW_API_KEY);
  const newDb = new Databases(newClient);

  const collections = ['trucks', 'drivers', 'offices', 'accounts', 'trips', 'expenses', 'tyres', 'support_tickets', 'audit_logs', 'global_configs'];

  for (const col of collections) {
    console.log(`\n📦 Processing collection "${col}"...`);
    try {
      const oldDocsRes = await oldDb.listDocuments(DB_ID, col, [Query.limit(5000)]);
      const docs = oldDocsRes.documents || [];
      console.log(`  Found ${docs.length} document(s) on Old Server.`);

      // Dynamically fetch attributes of the new collection to avoid schema mismatch errors
      let allowedAttributes = [];
      try {
        const colInfo = await newDb.getCollection(DB_ID, col);
        allowedAttributes = (colInfo.attributes || []).map(a => a.key);
        console.log(`  Target collection "${col}" attributes:`, allowedAttributes);
      } catch (attrErr) {
        console.warn(`  Could not fetch attributes for ${col}, using fallback.`);
      }

      for (const doc of docs) {
        const docId = doc.$id;

        // Unpack JSON data if present
        let mergedObj = { ...doc };
        if (doc.data) {
          try {
            const parsed = JSON.parse(doc.data);
            if (parsed && typeof parsed === 'object') {
              mergedObj = { ...parsed, ...mergedObj };
            }
          } catch (e) {}
        }

        const payload = {};
        for (const k of allowedAttributes) {
          if (k === 'key' && col === 'global_configs') {
            payload.key = doc.key || docId;
            continue;
          }
          if (k === 'data') {
            payload.data = doc.data || JSON.stringify(mergedObj);
            continue;
          }
          let val = mergedObj[k];
          if (val === undefined || val === null) {
            val = doc[k] !== undefined ? doc[k] : null;
          }
          if (Array.isArray(val)) {
            val = JSON.stringify(val);
          }
          if (val !== null && val !== undefined) {
            payload[k] = val;
          }
        }

        if (Object.keys(payload).length === 0) {
          payload.data = doc.data || JSON.stringify(mergedObj);
        }

        try {
          try {
            await newDb.updateDocument(DB_ID, col, docId, payload);
            console.log(`  ✅ Updated ${col}/${docId} (${payload.truckNo || payload.driverName || docId})`);
          } catch (updateErr) {
            if (updateErr.code === 404) {
              await newDb.createDocument(DB_ID, col, docId, payload);
              console.log(`  ✨ Created ${col}/${docId} (${payload.truckNo || payload.driverName || docId})`);
            } else {
              throw updateErr;
            }
          }
        } catch (err) {
          console.warn(`  ⚠️ Failed to sync ${col}/${docId}:`, err.message || err);
        }
      }
    } catch (colErr) {
      console.error(`❌ Failed processing collection ${col}:`, colErr.message || colErr);
    }
  }

  console.log('\n🎉 Direct table synchronization complete!');
}

syncDatabases();
