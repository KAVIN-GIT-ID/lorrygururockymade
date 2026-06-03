const { Client, Databases } = require('appwrite');
require('dotenv').config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'http://52.66.92.164/v1';
const projectId = process.env.VITE_APPWRITE_PROJECT_ID || '6a1c492a0012cf5f3a0c';
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || 'fleet_db';
const apiKey = process.env.VITE_APPWRITE_API_KEY || '7b6ffc61054c9a185db39a858a83280d84430747176173c4a75e2e43a44d9fa68f328af3e4a6f163fd1be83024e8e2ae8c2d81849ae346f2f0f393c76395e0ea792d7a057bbb685606e80f3baa9f6bdc7afb1823bc70f6ad00a84d87a0208b7f325dd0155885d732337b76d74a0cfc28ee3f9e4945cbbe627a909e744d627dd1';

const email = 'prasath.sakthi@gmail.com';
const orgId = '6a1708180016e88d6b82';

console.log('=== Relinking Registered User to Migrated Org ===');

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

// Helper to generate the exact document ID matching appwrite.ts getEmailDocId rules
const clean = email.trim().toLowerCase();
const sanitized = clean.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);
let hash = 0;
for (let i = 0; i < clean.length; i++) {
  hash = (hash << 5) - hash + clean.charCodeAt(i);
  hash |= 0;
}
const hashStr = Math.abs(hash).toString(36);
const docId = `usr_${sanitized}_${hashStr}`.slice(0, 36);

async function run() {
  try {
    // 1. Get the current user profile from the database
    const doc = await databases.getDocument(databaseId, 'global_configs', docId);
    const parsedData = JSON.parse(doc.data);

    // 2. Change organizationId to the restored one
    parsedData.organizationId = orgId;
    parsedData.isApproved = true;
    parsedData.isEmailVerified = true;
    parsedData.isPhoneVerified = true;

    // 3. Update in database
    await databases.updateDocument(databaseId, 'global_configs', docId, {
      key: docId,
      data: JSON.stringify(parsedData)
    });

    console.log(`\n🎉 SUCCESS! Linked prasath.sakthi@gmail.com to organization: ${orgId}`);
    console.log('Please refresh your browser window to see your restored trucks, drivers, and trips!');
  } catch (err) {
    console.error('\n❌ Failed to relink user profile:', err.message);
  }
}

run();
