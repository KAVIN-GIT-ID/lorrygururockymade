const fs = require('fs');
const path = require('path');

const hooksDir = path.join(__dirname, '../src/hooks');

const files = [
  'useAccounts.ts',
  'useAuditLogs.ts',
  'useDrivers.ts',
  'useExpenses.ts',
  'useOffices.ts',
  'useTrucks.ts',
  'useTyres.ts'
];

files.forEach(file => {
  const filePath = path.join(hooksDir, file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Fix imports at the top
  content = content.replace(/import\s*\{\s*useState,\s*useRef,\s*useEffect\s*\}\s*from\s*['"]react['"];?/g, "import { createSignal, createEffect, createMemo } from 'solid-js';");
  content = content.replace(/import\s*\{\s*useState\s*\}\s*from\s*['"]react['"];?/g, "import { createSignal, createMemo } from 'solid-js';");
  content = content.replace(/import\s*\{\s*createSignal\s*\}\s*from\s*['"]solid-js['"];?/g, "import { createSignal, createMemo, createEffect } from 'solid-js';");
  
  // Extract state name (e.g., 'accounts', 'drivers', 'trucks', etc.)
  const stateMatch = file.match(/use(\w+)\.ts/);
  if (!stateMatch) return;
  const statePlural = stateMatch[1].charAt(0).toLowerCase() + stateMatch[1].slice(1); // e.g. "accounts"
  const stateCap = stateMatch[1]; // e.g. "Accounts"
  const singleName = statePlural.endsWith('s') ? statePlural.slice(0, -1) : statePlural; // e.g. "account"

  console.log(`Processing hook: ${file} (state: ${statePlural})`);

  // Replace useState/createSignal initializer to execute immediately
  const signalRegex = new RegExp(`const\\s*\\[\\s*${statePlural}\\s*,\\s*set${stateCap}\\s*\\]\\s*=\\s*createSignal<([^>]+)>\\(\\(\\)\\s*=>\\s*\\{([\\s\\S]*?)\\}\\);?`, 'g');
  content = content.replace(signalRegex, (match, type, body) => {
    return `const [${statePlural}, set${stateCap}] = createSignal<${type}>((() => {${body}})());`;
  });

  // Replace trips initializer if it's useTrips
  if (file === 'useTrips.ts') {
    content = content.replace(/const\s*\[\s*trips\s*,\s*setTrips\s*\]\s*=\s*createSignal<TripEntry\[\]>\(\(\)\s*=>\s*\{([\s\S]*?)\}\);?/g, (match, body) => {
      return `const [trips, setTrips] = createSignal<TripEntry[]>((() => {${body}})());`;
    });
    // Remove useRef for tripsRef
    content = content.replace(/const\s*tripsRef\s*=\s*useRef<TripEntry\[\]>\(trips\);?/g, '');
    content = content.replace(/createEffect\(\(\)\s*=>\s*\{\s*tripsRef\.current\s*=\s*trips;\s*\}\);?/g, '');
    content = content.replace(/tripsRef\.current/g, 'trips()');
  }

  // Replace refs if any exist
  content = content.replace(/(\w+)Ref\.current/g, '$1()');

  // Replace occurrences of raw state with function calls in expressions, but not declarations
  // We'll replace statePlural (e.g. "accounts") followed by dot/bracket/comma/operator/paren
  // But not when preceded by const [, or function parameter, etc.
  // A safe way is to change:
  // - statePlural.some -> statePlural().some
  // - statePlural.find -> statePlural().find
  // - statePlural.filter -> statePlural().filter
  // - statePlural.map -> statePlural().map
  // - [...statePlural, -> [...statePlural(),
  // - statePlural.length -> statePlural().length
  // - statePlural.forEach -> statePlural().forEach
  
  const methods = ['some', 'find', 'filter', 'map', 'forEach', 'reduce', 'length', 'slice', 'includes'];
  methods.forEach(m => {
    const reg = new RegExp(`\\b${statePlural}\\.${m}\\b`, 'g');
    content = content.replace(reg, `${statePlural}().${m}`);
  });
  
  // also spread: [...statePlural
  const spreadReg = new RegExp(`\\[\\.\\.\\.${statePlural}\\b`, 'g');
  content = content.replace(spreadReg, `[...${statePlural}()`);

  // also direct assignments or arguments: `(statePlural)` -> `(statePlural())`
  // We can do this carefully for common patterns:
  content = content.replace(new RegExp(`save${stateCap}\\(next\\);`, 'g'), `save${stateCap}(next);`);
  content = content.replace(new RegExp(`overrideTrucks\\s*\\|\\|\\s*trucks\\b`, 'g'), `overrideTrucks || trucks()`);

  // Define derived orgState as createMemo
  if (file === 'useTrips.ts') {
    content = content.replace(/const\s*orgTrips\s*=\s*([\s\S]*?);/g, `const orgTrips = createMemo(() => $1);`);
    content = content.replace(/const\s*pendingApprovalTrips\s*=\s*([\s\S]*?);/g, `const pendingApprovalTrips = createMemo(() => $1);`);
    // ensure trips inside orgTrips is evaluated as trips()
    content = content.replace(/orgId\s*===\s*'org_backend'\s*\?\s*trips\s*:\s*trips\.filter/g, "orgId === 'org_backend' ? trips() : trips().filter");
    content = content.replace(/trips\.filter/g, 'trips().filter');
  } else if (file === 'useAuditLogs.ts') {
    content = content.replace(/const\s*orgAuditLogs\s*=\s*([\s\S]*?);/g, `const orgAuditLogs = createMemo(() => $1);`);
    content = content.replace(/auditLogs\.filter/g, 'auditLogs().filter');
  } else {
    // e.g. const orgDrivers = (orgId === 'org_backend' ? drivers : drivers.filter(...)).filter(...)
    const orgReg = new RegExp(`const\\s*org${stateCap}\\s*=\\s*\\(orgId\\s*===\\s*'org_backend'\\s*\\?\\s*${statePlural}\\s*:\\s*${statePlural}\\.filter\\(([^)]*)\\)\\)\\s*\\.filter\\(([^)]*)\\);?`, 'g');
    content = content.replace(orgReg, (match, f1, f2) => {
      return `const org${stateCap} = createMemo(() => (orgId === 'org_backend' ? ${statePlural}() : ${statePlural}().filter(${f1})).filter(${f2}));`;
    });

    const orgRegSimple = new RegExp(`const\\s*org${stateCap}\\s*=\\s*orgId\\s*===\\s*'org_backend'\\s*\\?\\s*${statePlural}\\s*:\\s*${statePlural}\\.filter\\(([^)]*)\\);?`, 'g');
    content = content.replace(orgRegSimple, (match, f1) => {
      return `const org${stateCap} = createMemo(() => orgId === 'org_backend' ? ${statePlural}() : ${statePlural}().filter(${f1}));`;
    });
  }

  // Inside the returned object at the end of the hook:
  // return { accounts, setAccounts, orgAccounts, ... }
  // we want to return getters:
  // return { get accounts() { return accounts(); }, setAccounts, get orgAccounts() { return orgAccounts(); }, ... }
  
  if (file === 'useTrips.ts') {
    content = content.replace(/return\s*\{\s*trips\s*,\s*setTrips\s*,\s*orgTrips\s*,\s*pendingApprovalTrips\s*,\s*saveTrips\s*,\s*addTrip\s*,\s*updateTrip\s*,\s*deleteTrip\s*\};/g, 
      `return { get trips() { return trips(); }, setTrips, get orgTrips() { return orgTrips(); }, get pendingApprovalTrips() { return pendingApprovalTrips(); }, saveTrips, addTrip, updateTrip, deleteTrip };`);
  } else if (file === 'useAuditLogs.ts') {
    content = content.replace(/return\s*\{\s*auditLogs\s*,\s*setAuditLogs\s*,\s*orgAuditLogs\s*,\s*saveAuditLogs\s*,\s*addAuditLog\s*\};/g, 
      `return { get auditLogs() { return auditLogs(); }, setAuditLogs, get orgAuditLogs() { return orgAuditLogs(); }, saveAuditLogs, addAuditLog };`);
  } else {
    const returnReg = new RegExp(`return\\s*\\{\\s*${statePlural}\\s*,\\s*set${stateCap}\\s*,\\s*org${stateCap}\\s*,\\s*save${stateCap}\\s*,\\s*add${stateCap.slice(0,-1)}\\s*,\\s*update${stateCap.slice(0,-1)}\\s*,\\s*delete${stateCap.slice(0,-1)}\\s*\\};`, 'g');
    content = content.replace(returnReg, 
      `return { get ${statePlural}() { return ${statePlural}(); }, set${stateCap}, get org${stateCap}() { return org${stateCap}(); }, save${stateCap}, add${stateCap.slice(0,-1)}, update${stateCap.slice(0,-1)}, delete${stateCap.slice(0,-1)} };`);
  }

  // Clean up any double imports or leftover React
  content = content.replace(/import\s*React\s*from\s*['"]react['"];?/g, '');
  content = content.replace(/import\s*\{\s*createSignal\s*\}\s*from\s*['"]solid-js['"];?/g, '');
  content = content.replace(/import\s*\{\s*createSignal,\s*createMemo\s*\}\s*from\s*['"]solid-js['"];?/g, "import { createSignal, createMemo, createEffect } from 'solid-js';");

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Rewritten Hook: ${file}`);
});
