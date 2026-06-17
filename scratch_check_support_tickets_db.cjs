const fs = require('fs');
const content = fs.readFileSync("C:\\Users\\infimove\\antigravity\\Truck-Trip-Tracker\\src\\lib\\appwrite.ts", 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("support_tickets") || lines[i].includes("supportTickets") || lines[i].includes("tickets")) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
  }
}
