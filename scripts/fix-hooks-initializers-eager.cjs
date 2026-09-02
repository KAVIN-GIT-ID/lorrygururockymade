const fs = require('fs');
const path = require('path');

const hooksDir = path.join(__dirname, '../src/hooks');

const hooks = [
  { file: 'useAccounts.ts', state: 'accounts' },
  { file: 'useAuditLogs.ts', state: 'auditLogs' },
  { file: 'useDrivers.ts', state: 'drivers' },
  { file: 'useExpenses.ts', state: 'expenses' },
  { file: 'useOffices.ts', state: 'offices' },
  { file: 'useTrips.ts', state: 'trips' },
  { file: 'useTrucks.ts', state: 'trucks' },
  { file: 'useTyres.ts', state: 'tyres' }
];

hooks.forEach(h => {
  const filePath = path.join(hooksDir, h.file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Normalize newlines
  content = content.replace(/\r\n/g, '\n');

  // Find: createSignal<Type>(() => { ... });
  // and replace with: createSignal<Type>((() => { ... })());
  const regex = /createSignal<([^>]+)>\(\(\)\s*=>\s*\{([\s\S]*?)\}\);/g;
  content = content.replace(regex, (match, type, body) => {
    return `createSignal<${type}>((() => {${body}})());`;
  });

  // Restore CRLF for Windows
  content = content.replace(/\n/g, '\r\n');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated eager initializer for: ${h.file}`);
});
