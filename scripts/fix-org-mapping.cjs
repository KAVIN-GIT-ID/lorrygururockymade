const { Client, Databases } = require('appwrite');
require('dotenv').config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const apiKey = process.env.VITE_APPWRITE_API_KEY;

const email = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@example.com';
const orgId = process.argv[3] || process.env.ADMIN_ORG_ID || 'org_example';

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

    console.log(`\n🎉 SUCCESS! Linked ${email} to organization: ${orgId}`);
    console.log('Please refresh your browser window to see your restored trucks, drivers, and trips!');
  } catch (err) {
    console.error('\n❌ Failed to relink user profile:', err.message);
  }
}

run();
