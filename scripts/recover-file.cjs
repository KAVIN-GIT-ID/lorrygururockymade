const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function getGitObject(sha) {
  const dir = sha.slice(0, 2);
  const file = sha.slice(2);
  const objPath = path.join(__dirname, '../.git/objects', dir, file);
  
  if (!fs.existsSync(objPath)) {
    // Check pack files if not loose
    throw new Error(`Git object not found: ${sha} at ${objPath}`);
  }
  
  const buffer = fs.readFileSync(objPath);
  return zlib.inflateSync(buffer);
}

function parseTree(buffer) {
  // Strip header "tree <size>\0"
  const nullIdx = buffer.indexOf(0);
  let data = buffer.slice(nullIdx + 1);
  
  const entries = [];
  while (data.length > 0) {
    const spaceIdx = data.indexOf(32); // ' '
    const mode = data.slice(0, spaceIdx).toString();
    
    const nullTermIdx = data.indexOf(0, spaceIdx);
    const name = data.slice(spaceIdx + 1, nullTermIdx).toString();
    
    const sha = data.slice(nullTermIdx + 1, nullTermIdx + 21).toString('hex');
    entries.push({ mode, name, sha });
    
    data = data.slice(nullTermIdx + 21);
  }
  return entries;
}

try {
  const commitSha = '9248f720a12101ef8e0481d028d45af0c1ee6e99';
  const commitObj = getGitObject(commitSha);
  
  const commitText = commitObj.toString();
  const treeLine = commitText.split('\n').find(l => l.startsWith('tree '));
  const treeSha = treeLine.split(' ')[1];
  console.log('Tree SHA:', treeSha);
  
  // Find 'src' directory
  const rootTree = parseTree(getGitObject(treeSha));
  const srcEntry = rootTree.find(e => e.name === 'src');
  console.log('src SHA:', srcEntry.sha);
  
  // Find 'components' directory
  const srcTree = parseTree(getGitObject(srcEntry.sha));
  const componentsEntry = srcTree.find(e => e.name === 'components');
  console.log('components SHA:', componentsEntry.sha);
  
  // Find 'MonthlyReport.tsx'
  const componentsTree = parseTree(getGitObject(componentsEntry.sha));
  const reportEntry = componentsTree.find(e => e.name === 'MonthlyReport.tsx');
  console.log('MonthlyReport.tsx SHA:', reportEntry.sha);
  
  // Get MonthlyReport.tsx contents
  const reportBlob = getGitObject(reportEntry.sha);
  const nullIdx = reportBlob.indexOf(0);
  const reportContent = reportBlob.slice(nullIdx + 1);
  
  fs.writeFileSync(path.join(__dirname, '../src/components/MonthlyReport.tsx'), reportContent);
  console.log('Successfully recovered original MonthlyReport.tsx from Git!');
} catch (err) {
  console.error('Failed to recover file:', err);
}
