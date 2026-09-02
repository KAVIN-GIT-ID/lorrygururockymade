const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize newlines to \n
content = content.replace(/\r\n/g, '\n');

// 1. Expand shorthand in useTrucks call
content = content.replace(/trips\s*,\s*organizationProfiles\s*,/g, "trips, organizationProfiles: organizationProfiles,");

// 2. Expand shorthands in the snapshot object
content = content.replace(/supportTickets\s*,\s*userRightsList\s*,/g, "supportTickets, userRightsList: userRightsList,");
content = content.replace(/userRightsList\s*,\s*organizationProfiles\s*/g, "userRightsList, organizationProfiles: organizationProfiles");

// Restore CRLF for Windows
content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully expanded shorthands in App.tsx');
