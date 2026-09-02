const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      if (
        (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) &&
        !fullPath.endsWith('.test.ts') &&
        !fullPath.endsWith('.test.tsx') &&
        !fullPath.includes('setup.ts')
      ) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

// Only run automatic signal fixer on components and App.tsx, not contexts or hooks
const allFiles = walk(path.join(__dirname, '../src'));
const files = allFiles.filter(filePath => {
  const relPath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
  return relPath.startsWith('src/components/') || relPath === 'src/App.tsx';
});

function isShorthandInObject(content, offset) {
  // Skip if we are inside an import statement
  const beforeText = content.substring(0, offset);
  const lastImport = beforeText.lastIndexOf('import ');
  if (lastImport !== -1) {
    const textAfterImport = beforeText.substring(lastImport);
    if (!textAfterImport.includes(';')) {
      return false; // Inside import statement!
    }
  }

  // Go backward from offset and find the first unmatched opening bracket
  let curlyCount = 0;
  let parenCount = 0;
  let bracketCount = 0;
  for (let i = offset - 1; i >= 0; i--) {
    const char = content[i];
    if (char === '}') curlyCount++;
    else if (char === '{') {
      if (curlyCount === 0) return true; // Innermost open bracket is curly brace!
      curlyCount--;
    }
    else if (char === ')') parenCount++;
    else if (char === '(') {
      if (parenCount === 0) return false; // Innermost open bracket is parenthesis!
      parenCount--;
    }
    else if (char === ']') bracketCount++;
    else if (char === '[') {
      if (bracketCount === 0) return false; // Innermost open bracket is square bracket!
      bracketCount--;
    }
  }
  return false;
}

function isObjectLiteralStart(content, openBraceOffset) {
  // Go backward from openBraceOffset to find the first non-whitespace character
  for (let i = openBraceOffset - 1; i >= 0; i--) {
    const char = content[i];
    if (/\s/.test(char)) continue;
    
    // Check if it is part of =>
    if (char === '>') {
      if (i > 0 && content[i - 1] === '=') return true; // =>
      return false; // JSX tag close!
    }
    
    // Check if it is '('
    if (char === '(') {
      // Find the first non-whitespace character before '('
      for (let j = i - 1; j >= 0; j--) {
        const c = content[j];
        if (/\s/.test(c)) continue;
        if (c === '>') {
          if (j > 0 && content[j - 1] === '=') return true; // => ({
          return false; // JSX tag close like </span> ({
        }
        if (/[a-zA-Z0-9_$]/.test(c) || ['=', ':', ',', '[', '('].includes(c)) {
          return true;
        }
        return false;
      }
      return true;
    }
    
    // Check if it is an operator/bracket
    if (['=', '[', ',', ':'].includes(char)) return true;
    
    // Check if it is a keyword like return, yield, await
    const wordBefore = content.substring(0, i + 1).match(/\b(return|yield|await|default)$/);
    if (wordBefore) return true;
    
    return false;
  }
  return false;
}

files.forEach(filePath => {
  const relPath = path.relative(path.join(__dirname, '..'), filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/\r\n/g, '\n');

  // Remove dependency arrays from createEffect / onMount
  content = content.replace(/(createEffect|onMount)\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[[^\]]*\]\s*\);?/g, "$1(() => {$2});");

  // Date initializer simplifier
  content = content.replace(/createSignal\(\(\)\s*=>\s*new\s+Date\(\)\.toISOString\(\)\.substring\(0,\s*10\)\)/g, "createSignal(new Date().toISOString().substring(0, 10))");
  content = content.replace(/createSignal\(\(\)\s*=>\s*new\s+Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)\)/g, "createSignal(new Date().toISOString().slice(0, 10))");
  content = content.replace(/createSignal\(\(\)\s*=>\s*new\s+Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]\)/g, "createSignal(new Date().toISOString().split('T')[0])");

  // Cleanup React prefixes
  content = content.replace(/\bReact\.useRef\b/g, "useRef");
  content = content.replace(/\bReact\.onMount\b/g, "onMount");
  content = content.replace(/\bReact\.createEffect\b/g, "createEffect");
  content = content.replace(/\bReact\.createMemo\b/g, "createMemo");
  content = content.replace(/\bReact\.onCleanup\b/g, "onCleanup");
  content = content.replace(/\bReact\.useState\b/g, "useState");
  content = content.replace(/\bReact\.useEffect\b/g, "useEffect");
  content = content.replace(/\bReact\.lazy\b/g, "lazy");
  content = content.replace(/\bReact\.FC\b/g, "Component");

  // React dispatch / state actions to Solid Setters
  content = content.replace(/\bReact\.Dispatch\s*<\s*React\.SetStateAction\s*<\s*([^>]+)\s*>\s*>/g, "Setter<$1>");

  // General React hooks to Solid replacements
  content = content.replace(/\buseState\b/g, "createSignal");
  content = content.replace(/\buseEffect\b/g, "createEffect");

  // General useRef replacement: const refName = useRef<HTMLDivElement>(null); -> let refName: HTMLDivElement | undefined;
  content = content.replace(/const\s+(\w+)\s*=\s*useRef<([^>]+)>\(null\);/g, "let $1: $2 | undefined;");
  content = content.replace(/const\s+(\w+)\s*=\s*useRef\([\s\S]*?\);/g, "let $1: any;");
  content = content.replace(/\b(\w+)\.current\b/g, "$1");

  // Clean React typings to Solid equivalents
  content = content.replace(/\bReact\.MouseEvent\b/g, "MouseEvent");
  content = content.replace(/\bReact\.FormEvent\b/g, "Event");
  content = content.replace(/\bReact\.JSX\b/g, "JSX");
  content = content.replace(/\bReact\.ComponentProps\b/g, "ComponentProps");
  content = content.replace(/\bReact\.HTMLAttributes\b/g, "HTMLAttributes");

  // Ensure solid-js imports are updated if we introduced onMount or createEffect or lazy or Component or Setter
  if (content.includes('onMount') && !/onMount\b/.test(content.match(/import\s*\{[^}]*\}\s*from\s*['"]solid-js['"]/)?.[0] || '')) {
    content = content.replace(/import\s*\{([^}]+)\}\s*from\s*['"]solid-js['']/, "import { $1, onMount } from 'solid-js'");
  }
  if (content.includes('createEffect') && !/createEffect\b/.test(content.match(/import\s*\{[^}]*\}\s*from\s*['"]solid-js['"]/)?.[0] || '')) {
    content = content.replace(/import\s*\{([^}]+)\}\s*from\s*['"]solid-js['']/, "import { $1, createEffect } from 'solid-js'");
  }
  if (content.includes('lazy') && !/lazy\b/.test(content.match(/import\s*\{[^}]*\}\s*from\s*['"]solid-js['"]/)?.[0] || '')) {
    content = content.replace(/import\s*\{([^}]+)\}\s*from\s*['"]solid-js['']/, "import { $1, lazy } from 'solid-js'");
  }
  if (content.includes('Component') && !/Component\b/.test(content.match(/import\s*\{[^}]*\}\s*from\s*['"]solid-js['"]/)?.[0] || '')) {
    content = content.replace(/import\s*\{([^}]+)\}\s*from\s*['"]solid-js['']/, "import { $1, Component } from 'solid-js'");
  }
  if (content.includes('Setter') && !/Setter\b/.test(content.match(/import\s*\{[^}]*\}\s*from\s*['"]solid-js['"]/)?.[0] || '')) {
    content = content.replace(/import\s*\{([^}]+)\}\s*from\s*['"]solid-js['']/, "import { $1, Setter } from 'solid-js'");
  }

  // Fix imports at the top: rewrite React hooks imported from 'solid-js' to Solid equivalents
  content = content.replace(
    /import\s*\{\s*useState\s*,\s*useRef\s*,\s*useEffect\s*\}\s*from\s*['"]solid-js['"];?/g,
    "import { createSignal, createEffect, createMemo, onMount } from 'solid-js';"
  );
  content = content.replace(
    /import\s*\{\s*useState\s*,\s*useEffect\s*\}\s*from\s*['"]solid-js['"];?/g,
    "import { createSignal, createEffect, createMemo, onMount } from 'solid-js';"
  );
  content = content.replace(
    /import\s*\{\s*useState\s*\}\s*from\s*['"]solid-js['"];?/g,
    "import { createSignal, onMount } from 'solid-js';"
  );
  content = content.replace(
    /import\s*React\s*,\s*\{\s*useState\s*\}\s*from\s*['"]solid-js['"];?/g,
    "import { createSignal, onMount } from 'solid-js';"
  );
  content = content.replace(
    /import\s*React\s*,\s*\{\s*useState\s*,\s*useRef\s*,\s*useEffect\s*\}\s*from\s*['"]solid-js['"];?/g,
    "import { createSignal, createEffect, createMemo, onMount } from 'solid-js';"
  );
  content = content.replace(
    /import\s*React\s*,\s*\{\s*useState\s*,\s*useEffect\s*\}\s*from\s*['"]solid-js['"];?/g,
    "import { createSignal, createEffect, createMemo, onMount } from 'solid-js';"
  );

  // Fix typeof signal typescript errors (keeping exact union types reactively)
  content = content.replace(/typeof\s+sortField\(\)/g, "ReturnType<typeof sortField>");
  content = content.replace(/typeof\s+sortField\b/g, "ReturnType<typeof sortField>");
  content = content.replace(/typeof\s+activeSubTab\(\)/g, "string");
  content = content.replace(/typeof\s+activeSubTab\b/g, "string");

  // 1. Discover all signals defined in this file via createSignal
  const signalRegex = /const\s*\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*createSignal/g;
  const signals = new Set();
  let match;
  while ((match = signalRegex.exec(content)) !== null) {
    signals.add(match[1]);
  }

  if (signals.size > 0) {
    console.log(`Discovered ${signals.size} signals in ${relPath}:`, Array.from(signals));

    // 2. Replace usages of discovered signals with function calls using the smart callback
    signals.forEach(s => {
      content = content.replace(new RegExp(`\\b${s}\\b`, 'g'), (m, offset) => {
        const before = content.substring(Math.max(0, offset - 60), offset);
        const after = content.substring(offset + m.length, offset + m.length + 60);

        // Check if preceded by typeof (in which case we do not add function parenthesis)
        if (/typeof\s*$/.test(before.trim())) {
          return m;
        }

        // Check if the match is inside a string literal (preceded and followed by same quote character)
        const charBefore = before.slice(-1);
        const charAfter = after.slice(0, 1);
        if ((charBefore === "'" && charAfter === "'") ||
            (charBefore === '"' && charAfter === '"') ||
            (charBefore === '`' && charAfter === '`')) {
          return m;
        }

        // Check if preceded by dot (but allow spread operator '...')
        if (before.trim().endsWith('.') && !before.trim().endsWith('...')) {
          return m;
        }

        // Check if preceded by declaration keywords (allow array bracket [ unless preceded by const/let/var)
        if (/\b(const|let|var|function|import|type|interface|get|set)\s+$/.test(before.trim())) {
          return m;
        }
        if (/\[\s*$/.test(before.trim())) {
          const cleanBefore = before.trim();
          if (/\b(const|let|var)\s*\[\s*$/.test(cleanBefore)) {
            return m;
          }
        }

        // Check if followed by '=' (assignment or HTML attribute), but ALLOW comparisons like '==' or '==='
        if (after.trim().startsWith('=') && !after.trim().startsWith('==')) {
          return m;
        }

        // Check if followed by optional property colon '?:'
        if (after.trim().startsWith('?:')) {
          return m;
        }

        // Check if it is an object key (followed by colon but not a ternary operator)
        if (after.trim().startsWith(':') && !after.trim().startsWith('::')) {
          const lineStart = content.lastIndexOf('\n', offset);
          const lineBefore = content.substring(lineStart, offset);
          const isTernary = lineBefore.includes('?');
          if (!isTernary) {
            return m;
          }
        }

        // Check if already a function call
        if (after.trim().startsWith('(')) {
          return m;
        }

        // Strip comments from before and after text to handle inline comments safely
        const cleanBefore = before.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const cleanAfter = after.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

        // Check if it is a shorthand property in an object literal (exclude JSX attributes '={' and template variables '${')
        const beforeTrim = cleanBefore.trim();
        const afterTrim = cleanAfter.trim();
        
        let isShorthand = false;
        if (beforeTrim.endsWith(',')) {
          isShorthand = afterTrim.startsWith('}') || afterTrim.startsWith(',');
        } else if (beforeTrim.endsWith('{') && !beforeTrim.endsWith('={') && !beforeTrim.endsWith('${')) {
          // Find the last opening brace offset and verify it starts an object literal context
          const openBraceOffset = content.lastIndexOf('{', offset);
          if (openBraceOffset !== -1 && isObjectLiteralStart(content, openBraceOffset)) {
            isShorthand = afterTrim.startsWith('}') || afterTrim.startsWith(',');
          }
        }

        if (isShorthand && isShorthandInObject(content, offset)) {
          return `${s}: ${s}()`;
        }

        return `${s}()`;
      });
    });
  }

  // 3. Additional fixes: Remove key attributes from JSX and fix htmlFor / autoFocus / srcDoc / autoComplete
  content = content.replace(/\bkey=\{([^}]+)\}/g, '');
  content = content.replace(/\bhtmlFor\s*=\s*/g, 'for=');
  content = content.replace(/\bautoFocus\s*=\s*/g, 'autofocus=');
  content = content.replace(/\bsrcDoc\s*=\s*/g, 'srcdoc=');
  content = content.replace(/\bautoComplete\s*=\s*/g, 'autocomplete=');

  // Consolidate solid-js imports: extract all imported names, delete all solid-js import statements, and place a single clean import statement at the top of the file
  const solidJsImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]solid-js['"];?/g;
  let solidJsImports = new Set();
  let matchSolid;
  while ((matchSolid = solidJsImportRegex.exec(content)) !== null) {
    matchSolid[1].split(',').forEach(name => {
      const trimmed = name.trim();
      if (trimmed) solidJsImports.add(trimmed);
    });
  }
  if (solidJsImports.size > 0) {
    // Remove all solid-js imports
    content = content.replace(solidJsImportRegex, '');
    
    // Clean up React-specific properties
    solidJsImports.delete('useRef');
    solidJsImports.delete('useState');
    solidJsImports.delete('useEffect');
    
    // Prepend a single consolidated import at the top
    const consolidatedList = Array.from(solidJsImports).join(', ');
    content = `import { ${consolidatedList} } from 'solid-js';\n` + content;
  }

  content = content.replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, content, 'utf8');
});
console.log('Processed all TS/TSX source files for automatic signal fixes.');
