const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/hooks/useTrips.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize newlines
content = content.replace(/\r\n/g, '\n');

// 1. Replaces imports
content = content.replace(/import\s*\{\s*useState,\s*useRef,\s*useEffect\s*\}\s*from\s*['"]react['"];?/g, 
  "import { createSignal, createMemo, createEffect } from 'solid-js';");
content = content.replace(/import\s*\{\s*useState\s*\}\s*from\s*['"]react['"];?/g, 
  "import { createSignal, createMemo, createEffect } from 'solid-js';");

// 2. Replace signal declaration
const originalSignalBlock = `  const [trips, setTrips] = useState<TripEntry[]>(() => {
    try {
      const stored = localStorage.getItem('ttt_trips');
      if (stored) {
        const parsed = JSON.parse(stored);
        const migrated = migrateTrips(migrateTripsIfNecessary(parsed));
        localStorage.setItem('ttt_trips', JSON.stringify(migrated));
        return migrated;
      }
      return [];
    } catch {
      return [];
    }
  });`;

const newSignalBlock = `  const initialTrips = (() => {
    try {
      const stored = localStorage.getItem('ttt_trips');
      if (stored) {
        const parsed = JSON.parse(stored);
        const migrated = migrateTrips(migrateTripsIfNecessary(parsed));
        localStorage.setItem('ttt_trips', JSON.stringify(migrated));
        return migrated;
      }
      return [];
    } catch {
      return [];
    }
  })();
  const [trips, setTrips] = createSignal<TripEntry[]>(initialTrips);`;

content = content.replace(originalSignalBlock, newSignalBlock);

// 3. Remove tripsRef and effect block syncing it
content = content.replace(/const\s+tripsRef\s*=[\s\S]*?tripsRef\.current\s*=\s*trips;?[\s\S]*?\);?/g, "");

// 4. Replace tripsRef.current with trips()
content = content.replace(/\btripsRef\.current\b/g, "trips()");

// 5. Replace trips with trips() in internal logic
content = content.replace(/\btrips\.find\b/g, "trips().find");

// 6. Replace orgTrips definition
content = content.replace(/const\s+orgTrips\s*=\s*\(?orgId\s*===\s*'org_backend'\s*\?\s*trips\s*:\s*trips\.filter\(([^)]+)\)\)?([\s\S]*?);/, 
  "const orgTrips = createMemo(() => (orgId === 'org_backend' ? trips() : trips().filter($1))$2);");

// 8. Replace returning object getters first (to avoid orgTrips regex replacement mangling the return shorthand)
content = content.replace(/return\s*\{\s*trips\s*,\s*setTrips\s*,\s*orgTrips\s*,\s*saveTrips\s*,\s*postTripEntry\s*,\s*deleteTripEntry\s*\};/g, 
  `return {
    get trips() { return trips(); },
    setTrips,
    get orgTrips() { return orgTrips(); },
    saveTrips,
    postTripEntry,
    deleteTripEntry
  };`);

// 7. Update orgTrips references in functions and other logic
content = content.replace(/\borgTrips\b(?![(]|\s*=|[\s\S]*?\bget\s+orgTrips\b|\s*:)/g, "orgTrips()");

// Restore newlines to CRLF for Windows
content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully completed custom migration of useTrips.ts');
