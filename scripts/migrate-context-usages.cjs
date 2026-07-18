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

const terms = [
  { raw: 'currentUser', getter: 'currentUser()' },
  { raw: 'currentUserRights', getter: 'currentUserRights()' },
  { raw: 'organizationProfiles', getter: 'organizationProfiles()' },
  { raw: 'userRightsList', getter: 'userRightsList()' },
  { raw: 'permissionsMap', getter: 'permissionsMap()' },
];

walkDir(srcDir, (filePath) => {
  if (filePath.includes('context')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  terms.forEach(t => {
    // 1. Dot and optional chaining accesses
    content = content.replace(new RegExp(`\\b${t.raw}\\.(?!\\()`, 'g'), `${t.getter}.`);
    content = content.replace(new RegExp(`\\b${t.raw}\\?\\.(?!\\()`, 'g'), `${t.getter}?.`);

    // 2. Logic and operators (safer replacements)
    content = content.replace(new RegExp(`!${t.raw}\\b(?!\\()`, 'g'), `!${t.getter}`);
    content = content.replace(new RegExp(`\\b${t.raw}\\s*&&`, 'g'), `${t.getter} &&`);
    content = content.replace(new RegExp(`\\b${t.raw}\\s*\\|\\|`, 'g'), `${t.getter} ||`);
    content = content.replace(new RegExp(`\\b${t.raw}\\s*===`, 'g'), `${t.getter} ===`);
    content = content.replace(new RegExp(`\\b${t.raw}\\s*!==`, 'g'), `${t.getter} !==`);
    content = content.replace(new RegExp(`\\(${t.raw}\\)`, 'g'), `(${t.getter})`);
    content = content.replace(new RegExp(`return\\s+${t.raw}\\b(?!\\(|\\s*[:=])`, 'g'), `return ${t.getter}`);
    content = content.replace(new RegExp(`typeof\\s+${t.raw}\\b(?!\\()`, 'g'), `typeof ${t.getter}`);
    content = content.replace(new RegExp(`\\b${t.raw}\\s*\\?`, 'g'), `${t.getter} ?`);

    // 3. Destructured references mapping inside arrays or params
    // e.g. [, currentUser] or [currentUser, ]
    content = content.replace(new RegExp(`,\\s*${t.raw}\\s*([,)])`, 'g'), `, ${t.getter}$1`);
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated Context Usage (Safe): ${filePath}`);
  }
});
