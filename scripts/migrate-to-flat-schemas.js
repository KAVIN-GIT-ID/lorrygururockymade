import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client as AppwriteClient, Databases, Query, ID } from 'node-appwrite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
dotenv.config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || 'fleet_db';
const apiKey = process.env.VITE_APPWRITE_API_KEY;

if (!apiKey) {
  console.error('❌ VITE_APPWRITE_API_KEY is not defined in .env');
  process.exit(1);
}

// Initialize node-appwrite SDK
const client = new AppwriteClient()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new Databases(client);

const schemaKeys = {
  trucks: [
    'organizationId', 'truckNo', 'ownerName', 'status', 'isApproved', 'requestStatus',
    'registrationExpiryDate', 'rcFileId', 'insuranceFileId', 'make', 'model', 'type',
    'insuranceDate', 'fcDate', 'pinpushKM', 'wheelGreaseKM', 'alignmentNextDate',
    'qTaxDate', 'greenTaxDate', 'npTaxDate', 'fiveYearPermitDate', 'currentKM',
    'engineOilKM', 'crownOilKM', 'gearBoxOilKM', 'radiatorKM', 'engineOilIntervalKM',
    'crownOilIntervalKM', 'gearBoxOilIntervalKM', 'radiatorIntervalKM', 'pinpushIntervalKM',
    'wheelGreaseIntervalKM', 'loanStartDate', 'loanRegisteredDate', 'loanTenureMonths',
    'loanEmiAmount', 'loanBankName', 'loanStatus', 'loanNotes', 'loans', 'data'
  ],
  drivers: [
    'organizationId', 'driverName', 'phone', 'licenseNo', 'status', 'licenseFileId', 'data'
  ],
  offices: [
    'organizationId', 'officeName', 'city', 'contactPerson', 'phone', 'status', 'data'
  ],
  accounts: [
    'organizationId', 'accountName', 'type', 'holderName', 'status', 'bankName',
    'accountNo', 'ifscCode', 'branchName', 'data'
  ],
  trips: [
    'organizationId', 'tripNo', 'truckNo', 'startDate', 'endDate', 'driverName',
    'startingKM', 'endingKM', 'status', 'notes', 'rtoExpense', 'dieselLiters',
    'dieselRate', 'dieselAmount', 'addBlueExpense', 'fastagExpense', 'otherExpense',
    'rtoPaidByDriver', 'addBluePaidByDriver', 'fastagPaidByDriver', 'otherPaidByDriver',
    'payments', 'advances', 'fuels', 'data'
  ],
  expenses: [
    'organizationId', 'truckNo', 'expenseType', 'shopName', 'amount', 'paymentMode',
    'date', 'status', 'accountType', 'driverName', 'notes', 'data'
  ],
  tyres: [
    'organizationId', 'tyreNo', 'manufacturer', 'size', 'status', 'currentTruckNo',
    'installationDate', 'installationKM', 'accumulatedKM', 'purchaseDate', 'purchaseAmount',
    'saleDate', 'saleAmount', 'movementHistory', 'data'
  ],
  support_tickets: [
    'organizationId', 'ticketNo', 'requesterName', 'requesterEmail', 'requesterPhone',
    'category', 'title', 'description', 'status', 'assignedTeam', 'assignedTo', 'data'
  ],
  audit_logs: [
    'organizationId', 'timestamp', 'user', 'action', 'category', 'reference', 'details', 'data'
  ],
  global_configs: [
    'key', 'data'
  ]
};

async function fetchAllDocuments(collectionId) {
  const all = [];
  let cursor = null;
  const limit = 100;

  while (true) {
    const queries = [Query.limit(limit)];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    let response;
    try {
      response = await databases.listDocuments(databaseId, collectionId, queries);
    } catch (err) {
      console.error(`❌ Error listing documents for "${collectionId}":`, err.message);
      break;
    }

    const docs = response.documents || [];
    all.push(...docs);

    if (docs.length < limit) break;
    cursor = docs[docs.length - 1].$id;
  }

  return all;
}

async function migrate() {
  console.log("=== Appwrite Schema Migration: JSON to Flat Columns ===");

  // 1. Run Backup first
  console.log("\n1. Running automatic database safety backup...");
  try {
    const { runBackup } = require('./backup-db.cjs');
    const backupPath = await runBackup();
    console.log(`✓ Safety backup created successfully at: ${backupPath}`);
  } catch (backupErr) {
    console.error("❌ Safety backup failed! Aborting database migration to prevent data loss.");
    process.exit(1);
  }

  // Collections to migrate
  const collectionsToMigrate = [
    'trucks', 'drivers', 'offices', 'accounts',
    'trips', 'expenses', 'tyres', 'support_tickets',
    'audit_logs'
  ];

  for (const collectionId of collectionsToMigrate) {
    console.log(`\nMigrating collection: "${collectionId}"...`);
    const docs = await fetchAllDocuments(collectionId);
    console.log(`Found ${docs.length} documents to migrate.`);

    const allowedKeys = schemaKeys[collectionId] || [];

    for (const doc of docs) {
      if (!doc.data) {
        console.log(`  - Doc ${doc.$id} does not have JSON data field, skipping.`);
        continue;
      }

      let dataObj;
      try {
        dataObj = JSON.parse(doc.data);
      } catch (err) {
        console.warn(`  - Doc ${doc.$id} has invalid JSON in data field, skipping.`);
        continue;
      }

      // Map properties
      const updatePayload = {};

      // Initialize defaults or copy matching keys
      for (const key of allowedKeys) {
        if (key === 'data') {
          updatePayload.data = ''; // clear data field
          continue;
        }

        let val = dataObj[key];

        // Handle stringification of nested arrays/objects
        if (collectionId === 'trucks' && key === 'loans' && Array.isArray(dataObj.loans)) {
          val = JSON.stringify(dataObj.loans);
        } else if (collectionId === 'trips' && key === 'payments' && Array.isArray(dataObj.payments)) {
          val = JSON.stringify(dataObj.payments);
        } else if (collectionId === 'trips' && key === 'advances' && Array.isArray(dataObj.advances)) {
          val = JSON.stringify(dataObj.advances);
        } else if (collectionId === 'trips' && key === 'fuels' && Array.isArray(dataObj.fuels)) {
          val = JSON.stringify(dataObj.fuels);
        } else if (collectionId === 'tyres' && key === 'movementHistory' && Array.isArray(dataObj.movementHistory)) {
          val = JSON.stringify(dataObj.movementHistory);
        }

        // Apply defaults or types
        if (val === undefined) {
          const attrDef = allowedKeys.includes(key);
          if (attrDef) {
            // Apply safe fallback types
            if (key === 'isApproved') val = false;
            else if (key === 'organizationId') val = doc.organizationId || 'org_default';
            else val = null;
          }
        }

        if (val !== undefined) {
          updatePayload[key] = val;
        }
      }

      // Handle sub-trips migration for Trip collection
      if (collectionId === 'trips' && Array.isArray(dataObj.subTrips)) {
        console.log(`  - Trip ${doc.$id} has ${dataObj.subTrips.length} sub-trips to migrate.`);
        for (let idx = 0; idx < dataObj.subTrips.length; idx++) {
          const sub = dataObj.subTrips[idx];
          const subTripId = `sub_${doc.$id}_${idx}`;

          const subTripPayload = {
            organizationId: dataObj.organizationId || doc.organizationId || 'org_default',
            tripId: doc.$id,
            officeName: sub.officeName || '',
            routeFrom: sub.routeFrom || '',
            routeTo: sub.routeTo || '',
            income: Number(sub.income) || 0,
            loadingDate: sub.loadingDate || '',
            loadingExpense: Number(sub.loadingExpense) || 0,
            unloadingExpense: Number(sub.unloadingExpense) || 0,
            driverWages: Number(sub.driverWages) || 0,
            startingKM: Number(sub.startingKM) || 0,
            endingKM: Number(sub.endingKM) || 0,
            notes: sub.notes || '',
            rtoExpense: Number(sub.rtoExpense) || 0,
            dieselLiters: Number(sub.dieselLiters) || 0,
            dieselRate: Number(sub.dieselRate) || 0,
            dieselAmount: Number(sub.dieselAmount) || 0,
            addBlueExpense: Number(sub.addBlueExpense) || 0,
            fastagExpense: Number(sub.fastagExpense) || 0,
            otherExpense: Number(sub.otherExpense) || 0,
            loadingPaidByDriver: !!sub.loadingPaidByDriver,
            unloadingPaidByDriver: !!sub.unloadingPaidByDriver,
            brokerageExpense: Number(sub.brokerageExpense) || 0,
            brokeragePaidByDriver: !!sub.brokeragePaidByDriver,
            loadingDeductedFrom: sub.loadingDeductedFrom || 'DriverDirect',
            loadingBears: sub.loadingBears || 'Org',
            unloadingDeductedFrom: sub.unloadingDeductedFrom || 'DriverDirect',
            unloadingBears: sub.unloadingBears || 'Org',
            brokerageDeductedFrom: sub.brokerageDeductedFrom || 'DriverDirect',
            brokerageBears: sub.brokerageBears || 'Driver',
            crossingExpense: Number(sub.crossingExpense) || 0,
            crossingPaidByDriver: !!sub.crossingPaidByDriver,
            crossingDeductedFrom: sub.crossingDeductedFrom || 'DriverDirect',
            crossingBears: sub.crossingBears || 'Org',
            rmcExpense: Number(sub.rmcExpense) || 0,
            rmcPaidByDriver: !!sub.rmcPaidByDriver,
            rmcDeductedFrom: sub.rmcDeductedFrom || 'DriverDirect',
            rmcBears: sub.rmcBears || 'Org',
            loadingBearsOrg: Number(sub.loadingBearsOrg) || 0,
            loadingBearsDriver: Number(sub.loadingBearsDriver) || 0,
            unloadingBearsOrg: Number(sub.unloadingBearsOrg) || 0,
            unloadingBearsDriver: Number(sub.unloadingBearsDriver) || 0,
            brokerageBearsOrg: Number(sub.brokerageBearsOrg) || 0,
            brokerageBearsDriver: Number(sub.brokerageBearsDriver) || 0,
            crossingBearsOrg: Number(sub.crossingBearsOrg) || 0,
            crossingBearsDriver: Number(sub.crossingBearsDriver) || 0,
            rmcBearsOrg: Number(sub.rmcBearsOrg) || 0,
            rmcBearsDriver: Number(sub.rmcBearsDriver) || 0,
            noOfTons: Number(sub.noOfTons) || 0,
            material: sub.material || '',
            ratePerTon: Number(sub.ratePerTon) || 0,
            cargoExpenses: JSON.stringify(sub.cargoExpenses || []),
            data: ''
          };

          try {
            await databases.createDocument(databaseId, 'sub_trips', subTripId, subTripPayload);
          } catch (subErr) {
            if (subErr.code === 409) {
              // already exists, update instead
              await databases.updateDocument(databaseId, 'sub_trips', subTripId, subTripPayload);
            } else {
              console.error(`    ❌ Failed to migrate sub-trip ${subTripId}:`, subErr.message);
            }
          }
        }
      }

      // Update parent document
      try {
        await databases.updateDocument(databaseId, collectionId, doc.$id, updatePayload);
        console.log(`  ✓ Migrated doc: ${doc.$id}`);
      } catch (updateErr) {
        console.error(`  ❌ Failed to update doc ${doc.$id}:`, updateErr.message);
      }
    }
  }

  console.log("\n=== Migration Complete successfully! ===");
}

migrate();
