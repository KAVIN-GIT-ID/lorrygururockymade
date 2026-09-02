const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/UserAccessControl.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace imports
content = content.replace(/import\s*React,\s*\{\s*useState,\s*useEffect\s*\}\s*from\s*['"]react['"];?/g, 
  "import { createSignal, createEffect, For, Show } from 'solid-js';");
content = content.replace(/import\s*\{\s*useState,\s*useEffect\s*\}\s*from\s*['"]react['"];?/g, 
  "import { createSignal, createEffect, For, Show } from 'solid-js';");

// 2. Replace React hook state declarations
// useState(initial) -> createSignal(initial)
content = content.replace(/const\s*\[([^,]+),\s*set([^\]]+)\]\s*=\s*useState\(([^)]*)\)/g, 
  "const [$1, set$2] = createSignal($3)");
content = content.replace(/useState\b/g, "createSignal");
content = content.replace(/useEffect\b/g, "createEffect");

// 3. Replace React.Fragment
content = content.replace(/<React\.Fragment[^>]*>/g, "<>");
content = content.replace(/<\/React\.Fragment>/g, "</>");

// 4. Update expandedUserId usage to function call: expandedUserId()
content = content.replace(/\bexpandedUserId\b(?![(]|=|\s*:)/g, "expandedUserId()");

// 5. Clean className and htmlFor
content = content.replace(/className=/g, "class=");
content = content.replace(/htmlFor=/g, "for=");

// 6. Lucide icons package import
content = content.replace(/from\s*['"]lucide-react['"]/g, "from 'lucide-solid'");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully migrated UserAccessControl.tsx to SolidJS');
