const fs = require('fs');
const path = require('path');

// Helper to load file, normalize line endings to \n, run callback, and save back with original endings or \r\n
function modifyFile(filePath, callback) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const hasRrNn = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');
  
  const updated = callback(content);
  
  const finalContent = hasRrNn ? updated.replace(/\n/g, '\r\n') : updated;
  fs.writeFileSync(filePath, finalContent, 'utf8');
}

// 1. Rename parameter email in UserAccessControl.tsx to targetEmail
const uacPath = path.join(__dirname, '../src/components/UserAccessControl.tsx');
modifyFile(uacPath, (content) => {
  content = content.replace(
    /const\s+getAppwriteMembership\s*=\s*\(email:\s*string\):\s*TeamMember\s*\|\s*undefined\s*=>\s*\{([\s\S]*?)\};/g,
    `const getAppwriteMembership = (targetEmail: string): TeamMember | undefined => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    const match = teamMembers.find(m => {
      const mEmail = (m.userEmail || (m as any).email || '').trim().toLowerCase();
      return mEmail === cleanEmail;
    });
    console.log(\`[getAppwriteMembership] Matching email: "\${cleanEmail}" -> found:\`, match, "in list:", teamMembers);
    if (teamMembers.length > 0) {
      console.log(\`[getAppwriteMembership] Raw memberships list JSON:\`, JSON.stringify(teamMembers));
    }
    return match;
  };`
  );
  console.log('Renamed email parameter in UserAccessControl.tsx to targetEmail');
  return content;
});

// 2. Rename loop variable size in TyreMaster.tsx to sz
const tmPath = path.join(__dirname, '../src/components/TyreMaster.tsx');
modifyFile(tmPath, (content) => {
  content = content.replace(
    /\.map\(size\s*=>\s*\([\s\S]*?\<option[\s\S]*?value=\{size\}[\s\S]*?\<\/option\>\s*\)\)/g,
    `.map(sz => (
                <option value={sz}>{sz}</option>
              ))`
  );
  console.log('Renamed size loop variable in TyreMaster.tsx to sz');
  return content;
});

// 3. Rename conflicting variables/parameters in TruckMaster.tsx
const truckPath = path.join(__dirname, '../src/components/TruckMaster.tsx');
modifyFile(truckPath, (content) => {
  // Rename truckNo parameter in calculateSingleLoanStats
  content = content.replace(
    /export\s+const\s+calculateSingleLoanStats\s*=\s*\([\s\S]*?truckNo:\s*string/g,
    (match) => match.replace('truckNo: string', 'targetTruckNo: string')
  );
  content = content.replace(
    /e\.truckNo\s*===\s*truckNo/g,
    'e.truckNo === targetTruckNo'
  );

  // Rename loans local variable in calculateLoanStats
  content = content.replace(
    /const\s+loans\s*=\s*getTruckLoans\(truck\);/g,
    'const truckLoans = getTruckLoans(truck);'
  );
  content = content.replace(
    /loans\.length\s*===\s*0/g,
    'truckLoans.length === 0'
  );
  content = content.replace(
    /calculateSingleLoanStats\(loans\[0\]/g,
    'calculateSingleLoanStats(truckLoans[0]'
  );

  // Rename truckNo local variable in PhonePe payment check
  content = content.replace(
    /const\s+truckNo\s*=\s*params\.get\('truckNo'\);/g,
    "const queryTruckNo = params.get('truckNo');"
  );
  content = content.replace(
    /if\s*\(txnId\s*&&\s*truckNo\)/g,
    'if (txnId && queryTruckNo)'
  );
  content = content.replace(
    /setPhonePeTruckNo\(truckNo\)/g,
    'setPhonePeTruckNo(queryTruckNo)'
  );

  // Rename currentKM parameter in renderKMLeftBadge
  content = content.replace(
    /renderKMLeftBadge\s*=\s*\(targetKM\?: \s*number,\s*currentKM\?: \s*number/g,
    'renderKMLeftBadge = (targetKM?: number, currKM?: number'
  );
  content = content.replace(
    /currentKM\s*===\s*undefined/g,
    'currKM === undefined'
  );
  content = content.replace(
    /currentKM\s*-\s*lastChanged/g,
    'currKM - lastChanged'
  );
  content = content.replace(
    /targetKM\s*-\s*currentKM/g,
    'targetKM - currKM'
  );

  // Rename currentKM parameter in renderLubeProgress
  content = content.replace(
    /renderLubeProgress\s*=\s*\(targetKM:\s*number\s*\|\s*undefined,\s*currentKM:\s*number/g,
    'renderLubeProgress = (targetKM: number | undefined, currKM: number'
  );
  content = content.replace(
    /remaining\s*=\s*targetKM\s*-\s*currentKM/g,
    'remaining = targetKM - currKM'
  );

  console.log('Renamed conflicting variables/parameters in TruckMaster.tsx');
  return content;
});

// 4. Rename startDate/endDate signals to filterStartDate/filterEndDate in TripList.tsx manually and precisely
const tripListPath = path.join(__dirname, '../src/components/TripList.tsx');
modifyFile(tripListPath, (content) => {
  content = content.replace(/(?<!\.)\bstartDate\b(?!:)/g, 'filterStartDate');
  content = content.replace(/(?<!\.)\bendDate\b(?!:)/g, 'filterEndDate');
  content = content.replace(/\bsetStartDate\b/g, 'setFilterStartDate');
  content = content.replace(/\bsetEndDate\b/g, 'setFilterEndDate');
  
  console.log('Precisely renamed filter signals in TripList.tsx');
  return content;
});

// 5. Fix type narrowing for fuel changes in TripForm.tsx
const tripFormPath = path.join(__dirname, '../src/components/TripForm.tsx');
modifyFile(tripFormPath, (content) => {
  const oldHandlers = `  const handleLitersChange = (val: number | '') => {
    setNewFuelLiters(val);
    if (val !== '' && val > 0) {
      if (newFuelRate !== '' && newFuelRate > 0) {
        setNewFuelAmount(Math.round(val * newFuelRate));
      } else if (newFuelAmount !== '' && newFuelAmount > 0) {
        setNewFuelRate(Number((newFuelAmount / val).toFixed(2)));
      }
    }
  };

  const handleRateChange = (val: number | '') => {
    setNewFuelRate(val);
    if (val !== '' && val > 0) {
      if (newFuelLiters !== '' && newFuelLiters > 0) {
        setNewFuelAmount(Math.round(newFuelLiters * val));
      } else if (newFuelAmount !== '' && newFuelAmount > 0) {
        setNewFuelLiters(Number((newFuelAmount / val).toFixed(2)));
      }
    }
  };

  const handleAmountChange = (val: number | '') => {
    setNewFuelAmount(val);
    if (val !== '' && val > 0) {
      if (newFuelLiters !== '' && newFuelLiters > 0) {
        setNewFuelRate(Number((val / newFuelLiters()).toFixed(2)));
      } else if (newFuelRate !== '' && newFuelRate > 0) {
        setNewFuelLiters(Number((val / newFuelRate()).toFixed(2)));
      }
    }
  };`;

  const newHandlers = `  const handleLitersChange = (val: number | '') => {
    setNewFuelLiters(val);
    if (val !== '' && val > 0) {
      const rate = newFuelRate;
      const amount = newFuelAmount;
      if (rate !== '' && rate > 0) {
        setNewFuelAmount(Math.round(val * rate));
      } else if (amount !== '' && amount > 0) {
        setNewFuelRate(Number((amount / val).toFixed(2)));
      }
    }
  };

  const handleRateChange = (val: number | '') => {
    setNewFuelRate(val);
    if (val !== '' && val > 0) {
      const liters = newFuelLiters;
      const amount = newFuelAmount;
      if (liters !== '' && liters > 0) {
        setNewFuelAmount(Math.round(liters * val));
      } else if (amount !== '' && amount > 0) {
        setNewFuelLiters(Number((amount / val).toFixed(2)));
      }
    }
  };

  const handleAmountChange = (val: number | '') => {
    setNewFuelAmount(val);
    if (val !== '' && val > 0) {
      const liters = newFuelLiters;
      const rate = newFuelRate;
      if (liters !== '' && liters > 0) {
        setNewFuelRate(Number((val / liters).toFixed(2)));
      } else if (rate !== '' && rate > 0) {
        setNewFuelLiters(Number((val / rate).toFixed(2)));
      }
    }
  };`;

  content = content.replace(oldHandlers, newHandlers);
  console.log('Fixed type narrowing for fuel changes in TripForm.tsx');
  return content;
});
