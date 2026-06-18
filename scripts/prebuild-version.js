import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || 'fleet_db';
const apiKey = process.env.VITE_APPWRITE_API_KEY;

const versionFilePath = path.resolve('src/version.json');

// Helper to load current local version
function getLocalVersion() {
  try {
    if (fs.existsSync(versionFilePath)) {
      const data = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
      return data.version || '1.0.0';
    }
  } catch (e) {
    // ignore
  }
  return '1.0.0';
}

// Helper to increment patch version (e.g. 1.0.0 -> 1.0.1)
function incrementVersion(ver) {
  const parts = ver.split('.').map(Number);
  if (parts.length >= 3) {
    parts[2] = parts[2] + 1;
    return parts.join('.');
  }
  return ver + '.1';
}

async function run() {
  console.log('=== [Build-Time Version Controller] ===');
  
  let currentLocalVersion = getLocalVersion();
  let nextVersion = incrementVersion(currentLocalVersion);

  if (!endpoint || !projectId || !apiKey) {
    console.warn('ℹ Appwrite environment variables not fully configured. Using incremented local version.');
    writeVersionFile(nextVersion);
    return;
  }

  const url = `${endpoint}/databases/${databaseId}/collections/global_configs/documents/cfg_app_version`;
  const headers = {
    'X-Appwrite-Project': projectId,
    'X-Appwrite-Key': apiKey,
    'Content-Type': 'application/json'
  };

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }
    const doc = await res.json();
    const parsedData = JSON.parse(doc.data);
    const appwriteVersion = parsedData.version;
    
    if (appwriteVersion) {
      console.log(`✓ Fetched latest version from Appwrite: v${appwriteVersion}`);
      nextVersion = incrementVersion(appwriteVersion);
    } else {
      console.log(`ℹ No version found in Appwrite cfg_app_version config. Incrementing local: v${currentLocalVersion} -> v${nextVersion}`);
    }
  } catch (err) {
    console.warn(`⚠️ Failed to fetch latest version from Appwrite (${err.message}). Incrementing local: v${currentLocalVersion} -> v${nextVersion}`);
  }

  writeVersionFile(nextVersion);
}

function writeVersionFile(version) {
  try {
    fs.writeFileSync(versionFilePath, JSON.stringify({ version }, null, 2), 'utf8');
    console.log(`🚀 Version updated in src/version.json to: v${version}`);
  } catch (err) {
    console.error('❌ Failed to write version.json:', err.message);
    process.exit(1);
  }
}

run();
