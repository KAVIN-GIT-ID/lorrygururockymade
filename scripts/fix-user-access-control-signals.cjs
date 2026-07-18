const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/UserAccessControl.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

const signals = [
  'showAddForm',
  'email',
  'name',
  'phone',
  'role',
  'engineOilInterval',
  'crownOilInterval',
  'gearBoxOilInterval',
  'radiatorInterval',
  'pinpushInterval',
  'wheelGreaseInterval',
  'brokeragePolicy'
];

signals.forEach(s => {
  // Replace variable with variable() except when:
  // - preceded by const [, or set, or let
  // - followed by (, or =, or :
  const regex = new RegExp(`(?<!const\\s+\\[\\s*|const\\s+|let\\s+|set|function\\s+|import\\s+|type\\s+|interface\\s+)\\b${s}\\b(?![(]|\\s*=|\\s*:)`, 'g');
  content = content.replace(regex, `${s}()`);
});

// Fix JSX array key properties
content = content.replace(/\bkey=\{([^}]+)\}/g, '');

content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed signals and keys in UserAccessControl.tsx');
