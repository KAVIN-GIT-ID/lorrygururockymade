const fs = require('fs');
const content = fs.readFileSync("C:\\Users\\infimove\\antigravity\\Truck-Trip-Tracker\\src\\components\\TripList.tsx", 'utf8');
const lines = content.split('\n');

for (let i = 510; i < 570; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
