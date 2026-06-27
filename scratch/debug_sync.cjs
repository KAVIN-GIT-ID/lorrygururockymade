const { Client, Databases, Query } = require('node-appwrite');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

const databaseId = process.env.APPWRITE_DATABASE_ID || 'fleet_db';
const projectId = process.env.APPWRITE_PROJECT_ID;
const endpoint = process.env.APPWRITE_ENDPOINT;
const apiKey = process.env.APPWRITE_API_KEY;
const orgId = '6a1c7429000bcd098cab';

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

// Mirror frontend reconstructRecord
function reconstructRecord(doc) {
  if (!doc) return null;
  const record = {};

  for (const [key, val] of Object.entries(doc)) {
    if (key.startsWith('$') || key === 'data') continue;
    
    if (key === 'loans' || key === 'payments' || key === 'advances' || key === 'fuels' || key === 'movementHistory' || key === 'cargoExpenses') {
      try {
        record[key] = val ? JSON.parse(val) : [];
      } catch {
        record[key] = [];
      }
    } else {
      record[key] = val;
    }
  }

  if (doc.data) {
    try {
      const parsed = JSON.parse(doc.data);
      if (parsed && typeof parsed === 'object') {
        Object.assign(record, parsed);
      }
    } catch (e) {
      // Ignore
    }
  }

  const jsonFields = ['loans', 'payments', 'advances', 'fuels', 'movementHistory', 'cargoExpenses'];
  jsonFields.forEach(key => {
    if (record[key] !== undefined) {
      if (typeof record[key] === 'string') {
        try {
          record[key] = JSON.parse(record[key]);
        } catch {
          record[key] = [];
        }
      }
      if (typeof record[key] === 'string') {
        try {
          record[key] = JSON.parse(record[key]);
        } catch {
          record[key] = [];
        }
      }
      if (!Array.isArray(record[key])) {
        record[key] = [];
      }
    }
  });

  record.id = doc.$id || doc.id || record.id;
  return record;
}

// Mirror frontend normalizeTrip
function normalizeTrip(trip) {
  if (!trip) return trip;
  const arrayFields = ['payments', 'advances', 'fuels', 'subTrips'];
  arrayFields.forEach(field => {
    if (typeof trip[field] === 'string') {
      try {
        trip[field] = JSON.parse(trip[field]);
      } catch {
        trip[field] = [];
      }
    }
    if (!Array.isArray(trip[field])) {
      trip[field] = [];
    }
  });

  if (Array.isArray(trip.subTrips)) {
    trip.subTrips = trip.subTrips.map((st) => {
      let cargoExpenses = st.cargoExpenses;
      if (typeof cargoExpenses === 'string') {
        try {
          cargoExpenses = JSON.parse(cargoExpenses);
        } catch {
          cargoExpenses = [];
        }
      }
      if (!Array.isArray(cargoExpenses)) {
        cargoExpenses = [];
      }
      return {
        ...st,
        cargoExpenses
      };
    });
  }
  return trip;
}

async function debugSync() {
  try {
    const subDocs = await databases.listDocuments(databaseId, 'sub_trips', [
      Query.equal('organizationId', orgId),
      Query.limit(100)
    ]);

    const tripDocs = await databases.listDocuments(databaseId, 'trips', [
      Query.equal('organizationId', orgId),
      Query.limit(100)
    ]);

    const subTripsByTripId = {};
    for (const subDoc of subDocs.documents) {
      const subTripRecord = reconstructRecord(subDoc);
      const tripId = subDoc.tripId;
      if (tripId) {
        if (!subTripsByTripId[tripId]) {
          subTripsByTripId[tripId] = [];
        }
        subTripsByTripId[tripId].push(subTripRecord);
      }
    }

    const matchedTripDoc = tripDocs.documents.find(doc => doc.$id === 't_id_1780490287246');
    if (matchedTripDoc) {
      const tripRecord = reconstructRecord(matchedTripDoc);
      tripRecord.subTrips = subTripsByTripId[matchedTripDoc.$id] || tripRecord.subTrips || [];
      const normalizedTrip = normalizeTrip(tripRecord);

      console.log("Stitched subTrips count:", normalizedTrip.subTrips.length);
      for (const st of normalizedTrip.subTrips) {
        console.log(`- Subtrip ID: ${st.id}, Route: ${st.routeFrom} -> ${st.routeTo}, cargoExpenses:`, st.cargoExpenses);
      }
    }
  } catch (err) {
    console.error("Error in debugSync:", err);
  }
}

debugSync();
