import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client as AppwriteClient, Databases } from 'node-appwrite';

dotenv.config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || 'fleet_db';
const apiKey = process.env.VITE_APPWRITE_API_KEY;

if (!apiKey) {
  console.error('❌ VITE_APPWRITE_API_KEY is not defined in .env');
  process.exit(1);
}

const client = new AppwriteClient()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

// Use the backup taken right before/around the flat columns migration (e.g. 03-08-06)
const BACKUP_FILE = 'backups/TT_Tracker_Backup_2026-06-11_03-08-06.json';

async function runFix() {
  console.log("=== Restoring Category 3 Payment SubTrip Mappings ===");
  
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`❌ Backup file ${BACKUP_FILE} not found. Please ensure it exists.`);
    process.exit(1);
  }

  const backupData = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  
  // Build mapping of: `${tripNo}_${oldSubTripId}` -> index
  const oldSubTripIndexMap = {};
  if (Array.isArray(backupData.trips)) {
    for (const trip of backupData.trips) {
      if (Array.isArray(trip.subTrips)) {
        trip.subTrips.forEach((st, index) => {
          if (st.id) {
            oldSubTripIndexMap[`${trip.tripNo}_${st.id}`] = index;
          }
        });
      }
    }
  }

  console.log(`Loaded ${Object.keys(oldSubTripIndexMap).length} sub-trip mappings from backup.`);

  // Fetch all current trips from database
  console.log("Fetching trips from Appwrite database...");
  let response;
  try {
    response = await databases.listDocuments(databaseId, 'trips');
  } catch (err) {
    console.error("❌ Failed to list trips from Appwrite:", err.message);
    process.exit(1);
  }

  const docs = response.documents || [];
  console.log(`Found ${docs.length} trip documents to inspect.`);

  let updatedCount = 0;

  for (const doc of docs) {
    let paymentsList = [];
    if (doc.payments) {
      try {
        paymentsList = typeof doc.payments === 'string' ? JSON.parse(doc.payments) : doc.payments;
      } catch (err) {
        console.warn(`  ⚠ Failed to parse payments for trip ${doc.tripNo}:`, err.message);
        continue;
      }
    }

    if (!Array.isArray(paymentsList) || paymentsList.length === 0) {
      continue;
    }

    let modified = false;
    const updatedPayments = paymentsList.map(p => {
      if (p.subTripId && !p.subTripId.startsWith(`sub_${doc.$id}_`) && p.subTripId !== 'general') {
        const lookupKey = `${doc.tripNo}_${p.subTripId}`;
        const newIndex = oldSubTripIndexMap[lookupKey];
        if (newIndex !== undefined) {
          const newSubTripId = `sub_${doc.$id}_${newIndex}`;
          console.log(`  [Match] Trip ${doc.tripNo}: Mapping payment ${p.id} subTripId from "${p.subTripId}" to "${newSubTripId}" (Leg #${newIndex + 1})`);
          modified = true;
          return { ...p, subTripId: newSubTripId };
        } else {
          console.log(`  [No Match] Trip ${doc.tripNo}: Payment ${p.id} has old subTripId "${p.subTripId}" but no mapping found in backup.`);
        }
      }
      return p;
    });

    if (modified) {
      try {
        await databases.updateDocument(databaseId, 'trips', doc.$id, {
          payments: JSON.stringify(updatedPayments)
        });
        console.log(`  ✓ Updated payments on Appwrite for trip ${doc.tripNo}`);
        updatedCount++;
      } catch (err) {
        console.error(`  ❌ Failed to update payments on Appwrite for trip ${doc.tripNo}:`, err.message);
      }
    }
  }

  console.log(`\n=== Done! Successfully updated ${updatedCount} trips. ===`);
}

runFix();
