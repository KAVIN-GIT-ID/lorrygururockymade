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
  { officeName: 'Tamilnadu Andra Salem', city: 'Salem', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Mettur Velliyan', city: 'Mettur', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'MR Transport Salem', city: 'Salem', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Everest Transport Salem', city: 'Salem', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Select Transport Sankari', city: 'Sankari', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Keerana Office Vizag', city: 'Visakhapatnam', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Murugan Roladlines Karakpur', city: 'Kharagpur', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Balaji Transport Warangal', city: 'Warangal', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Velmurugan Office', city: 'Tamil Nadu', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Bellari Office', city: 'Ballari', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Suresh Anna', city: 'Tamil Nadu', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'SPM Transport Chennai', city: 'Chennai', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Sibi Roadlines Durgapur', city: 'Durgapur', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'SRN Thangavel Mama', city: 'Tamil Nadu', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Srinivasa Office Chennai', city: 'Chennai', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Chennai Mahalaxi Office', city: 'Chennai', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Lathur Tamilnadu Tpt', city: 'Latur', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Lucky Rajamundry', city: 'Rajahmundry', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Cuttack Jayalakshmi', city: 'Cuttack', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Pollachi Office', city: 'Pollachi', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'SRMT Cuttack', city: 'Cuttack', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'New Babu Chennai', city: 'Chennai', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Annop MP Roadlines', city: 'Madhya Pradesh', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Cherran Mani Office', city: 'Tamil Nadu', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Kothatoor Bhai', city: 'Tamil Nadu', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Namakkal Sugumar', city: 'Namakkal', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Bharat Roadlines Chennai', city: 'Chennai', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Navajeevan Thoothukudi', city: 'Thoothukudi', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Bhavani Tpt', city: 'Bhavani', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Sakthi Driver', city: 'Tamil Nadu', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Sita Rama Vizag', city: 'Visakhapatnam', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Murugan Transport Sankari', city: 'Sankari', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Iyappa Transport Coimbatore', city: 'Coimbatore', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Real Transport Dindigul', city: 'Dindigul', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'AP Roadlines Bardhaman', city: 'Bardhaman', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Gundur Bhai Office', city: 'Guntur', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Udgir Office', city: 'Udgir', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Navagevan Thoothukudi', city: 'Thoothukudi', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Lucky Vizianagaram', city: 'Vizianagaram', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Guna Anna', city: 'Tamil Nadu', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Hubli Tamilandu Office', city: 'Hubli', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'KK Mohan Tata', city: 'Tamil Nadu', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Dinesh Pugalur', city: 'Pugalur', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Howrah Roadlines', city: 'Howrah', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Kalai Nagpur', city: 'Nagpur', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'MS Transport Hosur', city: 'Hosur', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Novadia Vijawada', city: 'Vijayawada', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Murugan Office Amaravathi', city: 'Amaravati', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'VMS Swetha Chennai', city: 'Chennai', contactPerson: 'Manager', phone: '', status: 'Active' },
  { officeName: 'Chennai All India Transport', city: 'Chennai', contactPerson: 'Manager', phone: '', status: 'Active' }
];

async function main() {
  console.log("\n=== Appwrite Office Bulk Importer ===");

  const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
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
    const item = officesList[i];
    const officeName = item.officeName;
    const timestamp = Date.now();
    const docId = `off_${timestamp}_${i}`;

    const officeDataObj = {
      id: docId,
      officeName: officeName,
      city: item.city,
      contactPerson: item.contactPerson,
      phone: item.phone,
      status: item.status,
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
