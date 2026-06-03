const { Client, Teams } = require('appwrite');
require('dotenv').config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'http://52.66.92.164/v1';
const projectId = process.env.VITE_APPWRITE_PROJECT_ID || '6a1c492a0012cf5f3a0c';
const apiKey = process.env.VITE_APPWRITE_API_KEY || '7b6ffc61054c9a185db39a858a83280d84430747176173c4a75e2e43a44d9fa68f328af3e4a6f163fd1be83024e8e2ae8c2d81849ae346f2f0f393c76395e0ea792d7a057bbb685606e80f3baa9f6bdc7afb1823bc70f6ad00a84d87a0208b7f325dd0155885d732337b76d74a0cfc28ee3f9e4945cbbe627a909e744d627dd1';

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
