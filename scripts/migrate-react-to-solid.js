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

const replacements = [
  // React imports to Solid
  {
    pattern: /import React,\s*\{\s*useState\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { createSignal } from 'solid-js'"
  },
  {
    pattern: /import React,\s*\{\s*useState,\s*useEffect\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { createSignal, createEffect } from 'solid-js'"
  },
  {
    pattern: /import React,\s*\{\s*useState,\s*useEffect,\s*useRef\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { createSignal, createEffect, onMount, onCleanup } from 'solid-js'"
  },
  {
    pattern: /import React,\s*\{\s*useState,\s*useRef\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { createSignal, onMount, onCleanup } from 'solid-js'"
  },
  {
    pattern: /import React,\s*\{\s*useContext\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { useContext } from 'solid-js'"
  },
  {
    pattern: /import React,\s*\{\s*useMemo\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { createMemo } from 'solid-js'"
  },
  {
    pattern: /import React,\s*\{\s*createContext,\s*useContext,\s*useState,\s*useEffect\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { createContext, useContext, createSignal, createEffect } from 'solid-js'"
  },
  {
    pattern: /import React\s*from\s*['"]react['"]/g,
    replacement: "import { createSignal, createEffect } from 'solid-js'"
  },
  {
    pattern: /import\s*\{\s*useState\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { createSignal } from 'solid-js'"
  },
  {
    pattern: /import\s*\{\s*useState,\s*useEffect\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { createSignal, createEffect } from 'solid-js'"
  },
  {
    pattern: /import\s*\{\s*useState,\s*useEffect,\s*useRef\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { createSignal, createEffect, onMount, onCleanup } from 'solid-js'"
  },
  {
    pattern: /import\s*\{\s*useState,\s*useRef\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { createSignal, onMount } from 'solid-js'"
  },
  {
    pattern: /import\s*\{\s*useMemo\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { createMemo } from 'solid-js'"
  },
  {
    pattern: /import\s*\{\s*useCallback\s*\}\s*from\s*['"]react['"]/g,
    replacement: ""
  },
  {
    pattern: /import\s*\{\s*useContext\s*\}\s*from\s*['"]react['"]/g,
    replacement: "import { useContext } from 'solid-js'"
  },
  
  // Lucide React to Lucide Solid
  {
    pattern: /from\s*['"]lucide-react['"]/g,
    replacement: "from 'lucide-solid'"
  },

  // ClassName to Class
  {
    pattern: /className=/g,
    replacement: "class="
  },

  // React hooks to Solid signals
  {
    pattern: /const\s*\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState\(([^)]*)\)/g,
    replacement: (match, p1, p2) => `const [${p1}, set${p1.charAt(0).toUpperCase() + p1.slice(1)}] = createSignal(${p2})`
  },
  {
    pattern: /const\s*\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState<([^>]+)>\(([^)]*)\)/g,
    replacement: (match, p1, p2, p3) => `const [${p1}, set${p1.charAt(0).toUpperCase() + p1.slice(1)}] = createSignal<${p2}>(${p3})`
  },

  // useEffect to createEffect / onMount
  {
    pattern: /useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[\]\)/g,
    replacement: "onMount(() => {$1})"
  },
  {
    pattern: /useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[[^\]]+\]\)/g,
    replacement: "createEffect(() => {$1})"
  },

  // useMemo to createMemo
  {
    pattern: /useMemo\(\(\)\s*=>\s*([\s\S]*?),\s*\[[^\]]*\]\)/g,
    replacement: "createMemo(() => $1)"
  }
];

walkDir(srcDir, (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  replacements.forEach(r => {
    content = content.replace(r.pattern, r.replacement);
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
});
