const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory && f !== 'node_modules' && f !== '.git' && f !== 'dist') {
      walkDir(dirPath, callback);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      callback(dirPath);
    }
  });
}

walkDir(srcDir, (filePath) => {
  if (filePath.includes('hooks') || filePath.includes('context')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace react-router-dom imports
  content = content.replace(/from\s*['"]react-router-dom['"]/g, "from '@solidjs/router'");
  content = content.replace(/import\s*\{\s*BrowserRouter\s*\}\s*from\s*['"]@solidjs\/router['"]/g, "import { Router } from '@solidjs/router'");

  // Replace lazy imports: lazy(() => import(...)) -> lazy(() => import(...)) from solid-js
  // Ensure 'lazy' is imported from solid-js and not react
  content = content.replace(/import\s*\{\s*([^}]*)\blazy\b([^}]*)\}\s*from\s*['"]react['"]/g, "import { $1 $2 } from 'solid-js'");
  
  // Replace Suspense imports
  content = content.replace(/import\s*\{\s*([^}]*)\bSuspense\b([^}]*)\}\s*from\s*['"]react['"]/g, "import { $1 $2 } from 'solid-js'");

  // Clean up any remaining react imports
  content = content.replace(/import\s*React\s*from\s*['"]react['"];?/g, '');
  content = content.replace(/import\s*React,\s*\{([^}]+)\}\s*from\s*['"]react['"]/g, "import {$1} from 'solid-js'");
  content = content.replace(/import\s*\{\s*([^}]+)\}\s*from\s*['"]react['"]/g, "import {$1} from 'solid-js'");

  // Fix form events
  content = content.replace(/React\.FormEvent/g, 'Event');
  content = content.replace(/React\.MouseEvent/g, 'MouseEvent');
  content = content.replace(/React\.KeyboardEvent/g, 'KeyboardEvent');
  content = content.replace(/React\.ChangeEvent/g, 'Event');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated Component/Test: ${filePath}`);
  }
});
