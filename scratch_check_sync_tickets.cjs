const fs = require('fs');
const content = fs.readFileSync("C:\\Users\\infimove\\antigravity\\Truck-Trip-Tracker\\src\\services\\cloudSyncService.ts", 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("supportTickets")) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
  }
}
