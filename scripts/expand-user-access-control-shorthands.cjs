const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/UserAccessControl.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

// Expand specific shorthand `role,` in UserAccessControl.tsx
content = content.replace(/\b(role\s*,\n\s*organizationId)/g, 'role: role,\n      organizationId');

content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Expanded specific shorthands in UserAccessControl.tsx');
