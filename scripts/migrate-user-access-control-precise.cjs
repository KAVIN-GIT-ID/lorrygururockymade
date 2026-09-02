const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/UserAccessControl.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize newlines to \n
content = content.replace(/\r\n/g, '\n');

// 1. Replace imports
content = content.replace(/import\s*React,\s*\{\s*useState,\s*useEffect\s*\}\s*from\s*['"]react['"];?/g, 
  "import { createSignal, createEffect, For, Show } from 'solid-js';");
content = content.replace(/import\s*\{\s*useState,\s*useEffect\s*\}\s*from\s*['"]react['"];?/g, 
  "import { createSignal, createEffect, For, Show } from 'solid-js';");

content = content.replace(/import\s*\{\s*UserPermission,\s*OrganizationProfile\s*\}\s*from\s*['"]\.\.\/types['"];?/g,
  "import { UserPermission, OrganizationProfile, UserRights } from '../types';");

// 2. Replace hooks
content = content.replace(/useState\(([^)]*)\)/g, "createSignal($1)");
content = content.replace(/useEffect\(/g, "createEffect(");

// 3. Replace React.Fragment
content = content.replace(/<React\.Fragment[^>]*>/g, "<>");
content = content.replace(/<\/React\.Fragment>/g, "</>");

// 4. Clean className and htmlFor
content = content.replace(/className=/g, "class=");
content = content.replace(/htmlFor=/g, "for=");

// 5. Lucide icons package import
content = content.replace(/from\s*['"]lucide-react['"]/g, "from 'lucide-solid'");

// 6. Safe signal value replacements (precisely targeting attributes and expressions)
content = content.replace(/value=\{showAddForm\}/g, "value={showAddForm()}");
content = content.replace(/value=\{email\}/g, "value={email()}");
content = content.replace(/value=\{name\}/g, "value={name()}");
content = content.replace(/value=\{phone\}/g, "value={phone()}");
content = content.replace(/value=\{role\}/g, "value={role()}");
content = content.replace(/value=\{engineOilInterval\}/g, "value={engineOilInterval()}");
content = content.replace(/value=\{crownOilInterval\}/g, "value={crownOilInterval()}");
content = content.replace(/value=\{gearBoxOilInterval\}/g, "value={gearBoxOilInterval()}");
content = content.replace(/value=\{radiatorInterval\}/g, "value={radiatorInterval()}");
content = content.replace(/value=\{pinpushInterval\}/g, "value={pinpushInterval()}");
content = content.replace(/value=\{wheelGreaseInterval\}/g, "value={wheelGreaseInterval()}");

content = content.replace(/(?<!\.)\bshowAddForm\s*&&/g, "showAddForm() &&");
content = content.replace(/(?<!\.)\bemail\.trim\(\)/g, "email().trim()");
content = content.replace(/(?<!\.)\bname\.trim\(\)/g, "name().trim()");
content = content.replace(/(?<!\.)\bphone\.trim\(\)/g, "phone().trim()");
content = content.replace(/(?<!\.)\brole\s*===/g, "role() ===");
content = content.replace(/(?<!\[\s*|const\s+\[\s*)\bexpandedUserId\b(?![(]|=|\s*:)/g, "expandedUserId()");
content = content.replace(/(?<!\.)\bbrokeragePolicy\s*===/g, "brokeragePolicy() ===");

// 7. Context variables to function calls (safe negative lookbehinds)
content = content.replace(/(?<!\.)\bcurrentUserRights\b(?![(]|=|\s*:)/g, "currentUserRights()");
content = content.replace(/(?<!\.)\buserRightsList\b(?![(]|=|\s*:)/g, "userRightsList()");
content = content.replace(/(?<!\.)\borganizationProfiles\b(?![(]|=|\s*:)/g, "organizationProfiles()");

// 8. Clean JSX loop keys
content = content.replace(/\bkey=\{([^}]+)\}/g, "");

// Restore CRLF for Windows
content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully completed precise migration of UserAccessControl.tsx');
