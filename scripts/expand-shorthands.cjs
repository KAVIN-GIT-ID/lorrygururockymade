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

const terms = ['currentUser', 'currentUserRights', 'organizationProfiles', 'userRightsList'];

walkDir(srcDir, (filePath) => {
  if (filePath.includes('context')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Normalize newlines to \n
  content = content.replace(/\r\n/g, '\n');

  terms.forEach(t => {
    // Replace: shorthand property usage e.g. `trips, organizationProfiles,` or `{ organizationProfiles, `
    // but not `const { organizationProfiles }` (which is destructuring!)
    // A safe way is to replace `\b(organizationProfiles)\s*,\s*(?!set|can|has|is|[A-Z])` with `organizationProfiles: organizationProfiles,`
    // Let's do it with specific matches for where they are passed in object literals or parameter lists
    content = content.replace(new RegExp(`([\\{\\s,])${t}\\s*([, \\}])`, 'g'), `$1${t}: ${t}$2`);
    content = content.replace(new RegExp(`([\\{\\s,])${t}\\s*([, \\}])`, 'g'), `$1${t}: ${t}$2`); // run twice to cover overlaps
  });

  // Restore CRLF for Windows
  content = content.replace(/\n/g, '\r\n');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Expanded Shorthands in: ${filePath}`);
  }
});
