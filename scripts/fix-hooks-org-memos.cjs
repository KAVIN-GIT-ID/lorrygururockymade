const fs = require('fs');
const path = require('path');

const hooksDir = path.join(__dirname, '../src/hooks');

const hooks = [
  { file: 'useAccounts.ts', state: 'accounts', cap: 'Accounts' },
  { file: 'useAuditLogs.ts', state: 'auditLogs', cap: 'AuditLogs' },
  { file: 'useDrivers.ts', state: 'drivers', cap: 'Drivers' },
  { file: 'useExpenses.ts', state: 'expenses', cap: 'Expenses' },
  { file: 'useOffices.ts', state: 'offices', cap: 'Offices' },
  { file: 'useTrucks.ts', state: 'trucks', cap: 'Trucks' },
  { file: 'useTyres.ts', state: 'tyres', cap: 'Tyres' }
];

hooks.forEach(h => {
  const filePath = path.join(hooksDir, h.file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/\r\n/g, '\n');

  // Fix the orgState definition to use createMemo and evaluate state as function
  // Match e.g.: const orgAccounts = orgId === 'org_backend' ? accounts : accounts().filter(...);
  const regexSimple = new RegExp(`const\\s*org${h.cap}\\s*=\\s*orgId\\s*===\\s*'org_backend'\\s*\\?\\s*${h.state}\\s*:\\s*${h.state}\\(\\)\\.filter\\(([^)]+)\\);?`, 'g');
  content = content.replace(regexSimple, (match, filterContent) => {
    return `const org${h.cap} = createMemo(() => orgId === 'org_backend' ? ${h.state}() : ${h.state}().filter(${filterContent}));`;
  });

  // Also match nested filters if any: e.g. (orgId === 'org_backend' ? drivers : drivers().filter(...)).filter(...)
  const regexNested = new RegExp(`const\\s*org${h.cap}\\s*=\\s*\\(orgId\\s*===\\s*'org_backend'\\s*\\?\\s*${h.state}\\s*:\\s*${h.state}\\(\\)\\.filter\\(([^)]+)\\)\\)\\s*\\.filter\\(([^)]+)\\);?`, 'g');
  content = content.replace(regexNested, (match, f1, f2) => {
    return `const org${h.cap} = createMemo(() => (orgId === 'org_backend' ? ${h.state}() : ${h.state}().filter(${f1})).filter(${f2}));`;
  });

  // Replace usages of orgState (not preceded by get or followed by paren/equals) to orgState()
  const orgUseRegex = new RegExp(`(?<!get\\s+)\\borg${h.cap}\\b(?![(]|\\s*=)`, 'g');
  content = content.replace(orgUseRegex, `org${h.cap}()`);

  // Ensure state is evaluated as a function call in any other leftover direct array usages
  const methods = ['some', 'find', 'filter', 'map', 'forEach', 'reduce', 'slice', 'includes'];
  methods.forEach(m => {
    content = content.replace(new RegExp(`\\b${h.state}\\.${m}\\b`, 'g'), `${h.state}().${m}`);
  });

  content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed org memo for: ${h.file}`);
});
