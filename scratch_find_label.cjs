const fs = require('fs');
const content = fs.readFileSync("C:\\Users\\infimove\\antigravity\\Truck-Trip-Tracker\\src\\components\\TripList.tsx", 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("getStatusDropdownLabel")) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
    // Print next 10 lines
    for (let j = 1; j <= 10; j++) {
      console.log(`Line ${i+1+j}: ${lines[i+j]}`);
    }
  }
}
