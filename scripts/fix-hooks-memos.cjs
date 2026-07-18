const fs = require('fs');
const path = require('path');

const hooksDir = path.join(__dirname, '../src/hooks');

const hooksToFix = [
  { file: 'useAccounts.ts', state: 'accounts', singular: 'account' },
  { file: 'useDrivers.ts', state: 'drivers', singular: 'driver' },
  { file: 'useExpenses.ts', state: 'expenses', singular: 'expense' },
  { file: 'useOffices.ts', state: 'offices', singular: 'office' },
  { file: 'useTrips.ts', state: 'trips', singular: 'trip' },
  { file: 'useTrucks.ts', state: 'trucks', singular: 'truck' },
  { file: 'useTyres.ts', state: 'tyres', singular: 'tyre' },
];

hooksToFix.forEach(h => {
  const filePath = path.join(hooksDir, h.file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Replace definition: const orgAccounts = orgId === 'org_backend' ? accounts : accounts().filter(a => a.organizationId === orgId);
  // with: const orgAccounts = createMemo(() => orgId === 'org_backend' ? accounts() : accounts().filter(a => a.organizationId === orgId));
  const orgName = 'org' + h.state.charAt(0).toUpperCase() + h.state.slice(1);
  const regex = new RegExp(`const\\s+${orgName}\\s*=\\s*orgId\\s*===\\s*'org_backend'\\s*\\?\\s*${h.state}\\s*:\\s*${h.state}\\(\\)\\.filter\\(([^)]+)\\);`);
  content = content.replace(regex, `const ${orgName} = createMemo(() => orgId === 'org_backend' ? ${h.state}() : ${h.state}().filter(($1)));`);

  // Also replace usages of orgAccounts to orgAccounts()
  // orgAccounts.some -> orgAccounts().some, orgAccounts.filter -> orgAccounts().filter, orgAccounts.map -> orgAccounts().map, orgAccounts.length -> orgAccounts().length, etc.
  content = content.replace(new RegExp(`\\b${orgName}\\.(some|filter|map|length|find|forEach|reduce|slice)\\b`, 'g'), `${orgName}().$1`);

  // Replace returning object property getter: get orgAccounts() { return orgAccounts; } -> get orgAccounts() { return orgAccounts(); }
  content = content.replace(new RegExp(`get\\s+${orgName}\\(\\)\\s*\\{\\s*return\\s+${orgName};?\\s*\\}`, 'g'), `get ${orgName}() { return ${orgName}(); }`);

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed Hook Memos for: ${h.file}`);
});
