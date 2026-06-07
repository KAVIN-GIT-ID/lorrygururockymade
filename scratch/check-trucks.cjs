const { Client, Databases } = require('node-appwrite');
require('dotenv').config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const apiKey = process.env.VITE_APPWRITE_API_KEY;

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

async function check() {
  try {
    const res = await databases.listDocuments(databaseId, 'trucks');
    console.log(`Total trucks in database: ${res.total}`);
    for (const doc of res.documents) {
      const parsed = JSON.parse(doc.data);
      console.log(`- ID: ${doc.$id}, TruckNo: ${parsed.truckNo}, OrganizationId: ${parsed.organizationId}, isApproved: ${parsed.isApproved}, requestStatus: ${parsed.requestStatus}`);
    }
  } catch (err) {
    console.error(err);
  }
}

check();
