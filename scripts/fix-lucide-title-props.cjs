const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/TruckMaster.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

// 1. Wrap CheckCircle title at line 1633
content = content.replace(
  /<CheckCircle class="w-4 h-4 text-emerald-600" title=\{rcFile \? `Queued: \$\{rcFile\.name\}` : "Document linked"\} \/>/g,
  '<span title={rcFile ? `Queued: ${rcFile.name}` : "Document linked"}><CheckCircle class="w-4 h-4 text-emerald-600" /></span>'
);

// 2. Wrap CheckCircle title at line 1665
content = content.replace(
  /<CheckCircle class="w-4 h-4 text-emerald-600" title=\{insuranceFile \? `Queued: \$\{insuranceFile\.name\}` : "Document linked"\} \/>/g,
  '<span title={insuranceFile ? `Queued: ${insuranceFile.name}` : "Document linked"}><CheckCircle class="w-4 h-4 text-emerald-600" /></span>'
);

// 3. Wrap Landmark title at line 1902
content = content.replace(
  /<Landmark class="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" title=\{`Active loan with \$\{truck\.loanBankName \|\| 'bank'\}`\} \/>/g,
  '<span title={`Active loan with ${truck.loanBankName || \'bank\'}`} class="shrink-0"><Landmark class="w-3.5 h-3.5 text-amber-500 animate-pulse" /></span>'
);

content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully wrapped Lucide title props in TruckMaster.tsx');
