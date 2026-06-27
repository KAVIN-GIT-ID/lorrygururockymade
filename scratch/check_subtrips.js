const { Client, Databases } = require('node-appwrite');

const databaseId = 'fleet_db';
const projectId = '6a1c5f2700246e86a727';
const endpoint = 'https://api.lorryguru.in/v1';
const apiKey = 'standard_047bcb019a52825f09045fb0cf7b43ad2d218d26ab98768c7ee1d522d5e4993e4b1a0f249a4612391cf002c53f95f9cc2c81c4773512e47df7733d8f53240c2e1f767393a3b9c832ee8560f9398a9daba625b61df3ee017e2d7476c7aace7d57b96e70d0efd8ba6467ef25acfe740d18fde5d9fcad82b15295728871b6123026';

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

async function checkSubtrips() {
  try {
    const response = await databases.listDocuments(databaseId, 'sub_trips', []);
    console.log(`Fetched ${response.documents.length} sub-trips:`);
    for (const doc of response.documents) {
      if (doc.officeName === 'Velmurugan Office' || doc.cargoExpenses) {
        console.log(`Document ID: ${doc.$id}`);
        console.log(`Route: ${doc.routeFrom} -> ${doc.routeTo}`);
        console.log(`Office: ${doc.officeName}`);
        console.log(`cargoExpenses:`, doc.cargoExpenses);
        console.log(`cargoExpenses Type:`, typeof doc.cargoExpenses);
        console.log(`loadingExpense (legacy):`, doc.loadingExpense);
        console.log('-----------------------------');
      }
    }
  } catch (err) {
    console.error("Failed to fetch sub-trips:", err);
  }
}

checkSubtrips();
