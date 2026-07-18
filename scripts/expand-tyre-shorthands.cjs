const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/TyreMaster.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

// Expand specific shorthands in TyreMaster.tsx
content = content.replace(/\bmanufacturer\s*,\n/g, 'manufacturer: manufacturer,\n');
content = content.replace(/\bsize\s*,\n/g, 'size: size,\n');
content = content.replace(/\n\s+saleDate\s*,\n/g, '\n  saleDate: saleDate,\n');

content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Expanded specific shorthands in TyreMaster.tsx');
