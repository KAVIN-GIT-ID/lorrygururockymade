const { Client, Databases } = require('appwrite');
require('dotenv').config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const apiKey = process.env.VITE_APPWRITE_API_KEY;

const email = 'prasath.sakthi@gmail.com';
const name = 'Prasath Sakthi';
const orgId = '6a1c7429000bcd098cab';

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
