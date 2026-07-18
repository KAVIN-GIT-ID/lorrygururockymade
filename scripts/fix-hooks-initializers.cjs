const fs = require('fs');
const path = require('path');

const hooksDir = path.join(__dirname, '../src/hooks');

const hooks = [
  { file: 'useAccounts.ts', state: 'accounts', type: 'Account[]' },
  { file: 'useAuditLogs.ts', state: 'auditLogs', type: 'AuditLog[]' },
  { file: 'useDrivers.ts', state: 'drivers', type: 'Driver[]' },
  { file: 'useExpenses.ts', state: 'expenses', type: 'ExpenseEntry[]' },
  { file: 'useOffices.ts', state: 'offices', type: 'Office[]' },
  { file: 'useTrips.ts', state: 'trips', type: 'TripEntry[]' },
  { file: 'useTrucks.ts', state: 'trucks', type: 'Truck[]' },
  { file: 'useTyres.ts', state: 'tyres', type: 'Tyre[]' },
];

hooks.forEach(h => {
  const filePath = path.join(hooksDir, h.file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Find the createSignal block and pull out the initializer
  // e.g.:
  // const [accounts, setAccounts] = createSignal<Account[]>(() => {
  //   try { ... }
  // });
  const startPattern = `const [${h.state}, set${h.state.charAt(0).toUpperCase() + h.state.slice(1)}] = createSignal<${h.type}>(() => {`;
  const startIdx = content.indexOf(startPattern);
  if (startIdx !== -1) {
    // Find matching closing brace for the initializer function
    // We'll search for the first `});` after startIdx
    const endIdx = content.indexOf('});', startIdx);
    if (endIdx !== -1) {
      const initializerBody = content.slice(startIdx + startPattern.length - 6, endIdx); // includes the `() => { ... }` function
      const newVarName = `initial${h.state.charAt(0).toUpperCase() + h.state.slice(1)}`;
      const replacement = `const ${newVarName} = (${initializerBody})();\n  const [${h.state}, set${h.state.charAt(0).toUpperCase() + h.state.slice(1)}] = createSignal<${h.type}>(${newVarName});`;
      content = content.slice(0, startIdx) + replacement + content.slice(endIdx + 3);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated initializer for: ${h.file}`);
});
