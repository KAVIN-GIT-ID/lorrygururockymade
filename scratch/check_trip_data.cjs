const { Client, Databases } = require('node-appwrite');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

const databaseId = process.env.APPWRITE_DATABASE_ID || 'fleet_db';
const projectId = process.env.APPWRITE_PROJECT_ID;
const endpoint = process.env.APPWRITE_ENDPOINT;
const apiKey = process.env.APPWRITE_API_KEY;

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

async function checkTripData() {
  try {
    const doc = await databases.getDocument(databaseId, 'trips', 't_id_1780490287246');
    console.log("Trip ID:", doc.$id);
    console.log("Trip Document Data column:", doc.data);
  } catch (err) {
    console.error("Error fetching trip:", err);
  }
}

checkTripData();
