import readline from 'readline';
import dotenv from 'dotenv';

// Load environmental parameters
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const officesList = [
  "Murugan Roladlines Karakpur",
  "Bellari Office",
  "Suresh Anna",
  "SRN Thangavel Mama",
  "Chennai Mahalaxi Office",
  "Lathur Tamilnadu Tpt",
  "Cuttack Jayalakshmi",
  "Pollachi Office",
  "SRMT Cuttack",
  "New Babu Chennai",
  "Annop MP Roadlines",
  "Cherran Mani Office",
  "Kothatoor Bhai",
  "Namakkal Sugumar",
  "Bharat Roadlines Chennai",
  "Navajeevan Thoothukudi",
  "Bhavani Tpt",
  "Sakthi Driver",
  "Sita Rama Vizag",
  "Murugan Transport Sankari",
  "Iyappa Transport Coimbatore",
  "Real Transport Dindigul",
  "AP Roadlines Bardhaman",
  "Gundur Bhai Office",
  "Udgir Office",
  "Navagevan Thoothukudi",
  "Lucky Vizianagaram",
  "Guna Anna",
  "Hubli Tamilandu Office",
  "KK Mohan Tata",
  "Dinesh Pugalur",
  "Howrah Roadlines",
  "Kalai Nagpur",
  "MS Transport Hosur",
  "Novadia Vijawada",
  "Murugan Office Amaravathi",
  "VMS Swetha Chennai",
  "Chennai All India Transport"
];

async function main() {
  console.log("\n=== Appwrite Office Bulk Importer ===");

  const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
  const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
  const orgId = "6a1708180016e88d6b82";
  const dbId = 'fleet_db';
  const collectionId = 'offices';

  console.log(`Appwrite Endpoint: ${endpoint}`);
  console.log(`Project ID:        ${projectId || '(Not loaded from environment)'}`);
  console.log(`Target Org ID:     ${orgId}`);
  console.log(`Count to Import:   ${officesList.length} offices`);

  let targetProjectId = projectId;
  if (!targetProjectId) {
    targetProjectId = await question("Enter your Appwrite Project ID: ");
    targetProjectId = targetProjectId.trim();
  }

  if (!targetProjectId) {
    console.error("❌ Project ID is required.");
    rl.close();
    return;
  }

  let apiKey = await question("Enter your Appwrite API Key (databases/documents write access): ");
  apiKey = apiKey.trim();
  if (!apiKey) {
    console.error("❌ API Key is required.");
    rl.close();
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': targetProjectId,
    'X-Appwrite-Key': apiKey
  };

  console.log("\nStarting import...");
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < officesList.length; i++) {
    const officeName = officesList[i];
    const timestamp = Date.now();
    const docId = `off_${timestamp}_${i}`;

    const officeDataObj = {
      id: docId,
      officeName: officeName,
      city: "",
      contactPerson: "",
      phone: "",
      status: "Active",
      organizationId: orgId
    };

    const payload = {
      documentId: docId,
      data: {
        organizationId: orgId,
        data: JSON.stringify(officeDataObj)
      }
    };

    try {
      const response = await fetch(`${endpoint}/databases/${dbId}/collections/${collectionId}/documents`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (response.ok) {
        console.log(`[${i + 1}/${officesList.length}] ✓ Added: "${officeName}" (Doc ID: ${docId})`);
        successCount++;
      } else {
        console.error(`[${i + 1}/${officesList.length}] ❌ Failed to add "${officeName}": ${resData.message || JSON.stringify(resData)}`);
        failCount++;
      }
    } catch (err) {
      console.error(`[${i + 1}/${officesList.length}] ❌ Network/System error for "${officeName}": ${err.message}`);
      failCount++;
    }
    // Brief sleep to avoid hitting API rate limits too aggressively
    await new Promise(r => setTimeout(r, 100));
  }

  console.log("\n=== Import Summary ===");
  console.log(`Successfully added: ${successCount}`);
  console.log(`Failed to add:      ${failCount}`);
  console.log("======================");

  rl.close();
}

main();
