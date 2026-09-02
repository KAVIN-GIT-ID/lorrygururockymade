const { Client, Teams } = require('appwrite');
require('dotenv').config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const apiKey = process.env.VITE_APPWRITE_API_KEY;

const orgId = '6a1708180016e88d6b82';
const orgName = 'Sakthi Logistics';

console.log('=== Creating Appwrite Team for Migration ===');
console.log(`Team ID:   ${orgId}`);
console.log(`Team Name: ${orgName}`);

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const teams = new Teams(client);

async function run() {
  try {
    await teams.create(orgId, orgName);
    console.log(`\n🎉 Success! Appwrite Team "${orgName}" (${orgId}) successfully created!`);
    console.log('You can now enter this Organization ID to register your account in the browser.');
  } catch (err) {
    if (err.code === 409) {
      console.log(`\n✓ Appwrite Team "${orgName}" (${orgId}) already exists.`);
    } else {
      console.error('\n❌ Failed to create team:', err.message);
    }
  }
}

run();
