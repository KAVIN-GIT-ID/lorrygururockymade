const fs = require('fs');
const content = fs.readFileSync("C:\\Users\\infimove\\antigravity\\Truck-Trip-Tracker\\src\\components\\TripForm.tsx", 'utf8');
const lines = content.split('\n');

console.log("Searching for generate / auto-increment in TripForm.tsx...");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes("generate") || line.includes("AUTO") || line.includes("increment")) {
    if (line.includes("setTripNo") || line.includes("useEffect") || line.includes("Math")) {
      console.log(`Line ${i+1}: ${line.trim()}`);
    }
  }
}
