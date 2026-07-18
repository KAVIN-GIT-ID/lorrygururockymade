const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/TruckMaster.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

// Expand specific shorthands in TruckMaster.tsx (safely checking for preceding newline and spaces)
content = content.replace(/\n\s*loanStartDate\s*,\n/g, '\n      loanStartDate: loanStartDate,\n');
content = content.replace(/\n\s*loanStatus\s*,\n/g, '\n      loanStatus: loanStatus,\n');

content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Expanded specific shorthands in TruckMaster.tsx');
