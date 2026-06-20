const { Client, Databases } = require('node-appwrite');
require('dotenv').config({ path: '../server/.env' });

async function run() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://api.lorryguru.in/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID || '6a1c5f2700246e86a727')
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const dbId = process.env.APPWRITE_DATABASE_ID || 'fleet_db';

  const docId = 'usr_opp_opp_com_1godlb';
  const data = {
    key: docId,
    data: JSON.stringify({
      id: "ur_1781971078252",
      email: "opp@opp.com",
      name: "AWqwwew",
      phone: "+918999546623",
      isEmailVerified: false,
      isPhoneVerified: false,
      role: "Admin",
      organizationId: "6a36b886000ab57bcf99",
      isApproved: true,
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
      canDeleteExpenses: true
    })
  };

  try {
    const doc = await databases.createDocument(dbId, 'global_configs', docId, data);
    console.log('Document created directly:', doc);
  } catch (err) {
    console.error('Error creating document directly:', err.message || err);
  }
}

run();
