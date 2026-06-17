const fs = require('fs');
const content = fs.readFileSync("C:\\Users\\infimove\\antigravity\\Truck-Trip-Tracker\\src\\lib\\appwrite.ts", 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("collections") || lines[i].includes("collectionId") || lines[i].includes("listDocuments") || lines[i].includes("createDocument")) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
  }
}
