const fs = require('fs');
const content = fs.readFileSync("C:\\Users\\infimove\\antigravity\\Truck-Trip-Tracker\\src\\App.tsx", 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].toLowerCase().includes("ticket") || lines[i].toLowerCase().includes("support")) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
  }
}
