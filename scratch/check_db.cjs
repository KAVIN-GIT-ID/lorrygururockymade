const { Client, Databases } = require('node-appwrite');
require('dotenv').config();

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const dbs = new Databases(client);
const dbId = process.env.APPWRITE_DATABASE_ID || 'fleet_db';

async function check() {
  for (const col of ['trucks', 'trips', 'drivers', 'offices', 'expenses']) {
    try {
      const res = await dbs.listDocuments(dbId, col);
      console.log(`[APPWRITE DATABASE] Collection "${col}": Total = ${res.total}`);
      if (res.documents.length > 0) {
        console.log(`   Sample docs in "${col}":`, res.documents.slice(0, 3).map(d => ({
          docId: d.$id,
          organizationId: d.organizationId,
          truckNo: d.truckNo,
          tripNo: d.tripNo
        })));
      }
    } catch (e) {
      console.log(`[APPWRITE DATABASE] Collection "${col}" ERROR:`, e.message);
    }
  }
}
check();
