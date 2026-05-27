const fs = require('fs');

const content = fs.readFileSync('src/components/AppwriteCloudSync.tsx', 'utf8');

// Strip out everything before the return (line 409 is index 408)
let lines = content.split('\n');
let returnLines = lines.slice(408, 617);

let stack = [];
for (let i = 0; i < returnLines.length; i++) {
  let line = returnLines[i];
  let cleanLine = line.replace(/\{[^}]*\}/g, ''); // ignore expressions
  
  // Find all tags on the line
  let pos = 0;
  while (true) {
    let start = cleanLine.indexOf('<', pos);
    if (start === -1) break;
    let end = cleanLine.indexOf('>', start);
    if (end === -1) break;
    
    let tagContent = cleanLine.substring(start + 1, end).trim();
    pos = end + 1;
    
    // Ignore self-closing tags and comments
    if (tagContent.endsWith('/') || tagContent.startsWith('!--')) {
      continue;
    }
    
    let tagName = tagContent.split(/\s+/)[0];
    if (tagName.startsWith('/')) {
      tagName = tagName.substring(1);
      console.log(`Line ${409 + i}: Close </${tagName}>`);
    } else {
      if (tagName.match(/^[a-zA-Z0-9]+$/)) {
        console.log(`Line ${409 + i}: Open <${tagName}>`);
      }
    }
  }
}
