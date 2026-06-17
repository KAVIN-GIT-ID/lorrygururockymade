const fs = require('fs');
const content = fs.readFileSync("C:\\Users\\infimove\\antigravity\\Truck-Trip-Tracker\\src\\components\\TripForm.tsx", 'utf8');
const lines = content.split('\n');

for (let i = 380; i < 415; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
