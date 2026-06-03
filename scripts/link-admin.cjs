const { Client, Databases } = require('appwrite');
require('dotenv').config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'http://52.66.92.164/v1';
const projectId = process.env.VITE_APPWRITE_PROJECT_ID || '6a1c492a0012cf5f3a0c';
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || 'fleet_db';
const apiKey = process.env.VITE_APPWRITE_API_KEY || '7b6ffc61054c9a185db39a858a83280d84430747176173c4a75e2e43a44d9fa68f328af3e4a6f163fd1be83024e8e2ae8c2d81849ae346f2f0f393c76395e0ea792d7a057bbb685606e80f3baa9f6bdc7afb1823bc70f6ad00a84d87a0208b7f325dd0155885d732337b76d74a0cfc28ee3f9e4945cbbe627a909e744d627dd1';

const email = 'prasath.sakthi@gmail.com';
const name = 'Prasath Sakthi';
const orgId = '6a1708180016e88d6b82';

console.log('=== Link Admin & Authorize Permissions ===');
console.log(`Email:        ${email}`);
console.log(`Organization: ${orgId}`);

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

// Helper to generate the document ID matching appwrite.ts getEmailDocId rules
const clean = email.trim().toLowerCase();
const sanitized = clean.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24);
let hash = 0;
for (let i = 0; i < clean.length; i++) {
  hash = (hash << 5) - hash + clean.charCodeAt(i);
  hash |= 0;
}
const hashStr = Math.abs(hash).toString(36);
const docId = `usr_${sanitized}_${hashStr}`.slice(0, 36);

const adminRights = {
  id: docId,
  name: name,
  email: email,
  role: 'Admin',
  organizationId: orgId,
  isApproved: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  canViewTrips: true,
  canEditTrips: true,
  canDeleteTrips: true,
  canViewTyres: true,
  canEditTyres: true,
  canDeleteTyres: true,
  canViewTrucks: true,
  canEditTrucks: true,
  canDeleteTrucks: true,
  canViewDrivers: true,
  canEditDrivers: true,
  canDeleteDrivers: true,
  canViewOffices: true,
  canEditOffices: true,
  canDeleteOffices: true,
  canViewAccounts: true,
  canEditAccounts: true,
  canDeleteAccounts: true,
  canViewExpenses: true,
  canEditExpenses: true,
  canDeleteExpenses: true,
  canEditLoans: true,
  canDeleteLoans: true
};

const documentData = {
  key: docId,
  data: JSON.stringify(adminRights)
};

async function link() {
  try {
    // 1. Create or update user permission document in global_configs
    try {
      await databases.updateDocument(databaseId, 'global_configs', docId, documentData);
      console.log(`✓ Updated existing permissions for ${email}.`);
    } catch (err) {
      if (err.code === 404) {
        await databases.createDocument(databaseId, 'global_configs', docId, documentData);
        console.log(`✓ Created new authorized Admin permissions for ${email}.`);
      } else {
        throw err;
      }
    }

    // 2. Create organization profile config
    const orgKey = `prf_${orgId}`.slice(0, 36);
    const orgProfile = {
      organizationId: orgId,
      organizationName: 'Sakthi Logistics',
      ownerEmail: email,
      status: 'Active',
      maxTrucksAllowed: 100,
      truckRequests: [],
      brokeragePolicy: 'DriverBears'
    };
    const orgDocData = {
      key: orgKey,
      data: JSON.stringify(orgProfile)
    };

    try {
      await databases.updateDocument(databaseId, 'global_configs', orgKey, orgDocData);
      console.log(`✓ Updated organization profile for ${orgId}.`);
    } catch (err) {
      if (err.code === 404) {
        await databases.createDocument(databaseId, 'global_configs', orgKey, orgDocData);
        console.log(`✓ Created organization profile for ${orgId}.`);
      } else {
        throw err;
      }
    }

    console.log('\n🎉 ADMIN ACCOUNT LINKED SUCCESSFULLY! Please refresh your browser tab.');
  } catch (err) {
    console.error('❌ Failed to link admin account:', err.message);
  }
}

link();
