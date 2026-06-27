import { Client as AppwriteClient, Databases, Users, Storage, Query, InputFile, Teams, Permission, Role } from 'node-appwrite';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as tar from 'tar';

dotenv.config();

// Parse Command Line Arguments
const args = process.argv.slice(2);
let restoreType = 'all'; // all, database, users, storage, teams
let targetTimestamp = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--type' && args[i + 1]) {
    restoreType = args[i + 1].toLowerCase();
  }
  if (args[i] === '--timestamp' && args[i + 1]) {
    targetTimestamp = args[i + 1];
  }
}

if (!['all', 'database', 'users', 'storage', 'teams'].includes(restoreType)) {
  console.error(`❌ Invalid restore type: "${restoreType}". Allowed values: all, database, users, storage, teams`);
  process.exit(1);
}

// Check if target is development project
const isToDev = args.includes('--to-dev');
const targetProjectId = isToDev ? (process.env.DEV_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID) : process.env.APPWRITE_PROJECT_ID;
const targetApiKey = isToDev ? (process.env.DEV_APPWRITE_API_KEY || process.env.APPWRITE_API_KEY) : process.env.APPWRITE_API_KEY;

console.log(`📡 Target Project ID: ${targetProjectId}`);
console.log(`📡 Arguments: ${JSON.stringify(process.argv)}`);

// Initialize Appwrite Server Client
const appwriteClient = new AppwriteClient();
if (!process.env.APPWRITE_ENDPOINT || !targetProjectId || !targetApiKey) {
  console.error('❌ Missing Appwrite environment variables in .env');
  process.exit(1);
}

appwriteClient
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(targetProjectId)
  .setKey(targetApiKey);

const databases = new Databases(appwriteClient);
const usersService = new Users(appwriteClient);
const storageService = new Storage(appwriteClient);
const teamsService = new Teams(appwriteClient);

const dbId = process.env.APPWRITE_DATABASE_ID || 'fleet_db';

// Helper to get Google Drive Client (supports OAuth2 and Service Accounts)
function getDriveClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    console.log('[Restore Script] Authenticating using Google OAuth2 credentials...');
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  console.log('[Restore Script] Authenticating using Google Service Account...');
  const credentialsPath = process.env.GOOGLE_DRIVE_CREDENTIALS_PATH;
  if (!credentialsPath || !fs.existsSync(path.resolve(process.cwd(), credentialsPath))) {
    throw new Error(`Neither Google OAuth2 credentials nor Service Account file was found.`);
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(process.cwd(), credentialsPath),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

// Helper to get document permissions for org
function getDocumentPermissions(orgId: string): string[] {
  if (!orgId) return [];
  if (orgId === 'org_backend') {
    return [
      Permission.read(Role.team('org_backend')),
      Permission.update(Role.team('org_backend')),
      Permission.delete(Role.team('org_backend'))
    ];
  }
  if (orgId === 'global' || orgId === 'org_default') {
    return [
      Permission.read(Role.any()),
      Permission.read(Role.team('org_backend')),
      Permission.update(Role.team('org_backend')),
      Permission.delete(Role.team('org_backend'))
    ];
  }
  return [
    Permission.read(Role.team(orgId)),
    Permission.update(Role.team(orgId)),
    Permission.delete(Role.team(orgId)),
    Permission.read(Role.team('org_backend')),
    Permission.update(Role.team('org_backend')),
    Permission.delete(Role.team('org_backend'))
  ];
}

async function startRestoration() {
  console.log(`=========================================`);
  console.log(`🔄 Appwrite Server-Side Recovery System`);
  console.log(`=========================================`);
  console.log(`Target: Restore "${restoreType.toUpperCase()}"`);
  
  let snapshotData: any = null;
  let fileManifest: any[] = [];
  let isLocalMode = false;
  let localFolderPath = '';
  // Local extraction path for tarballs
  const tempExtractionDir = path.join(os.tmpdir(), `appwrite_restore_${Date.now()}`);
  fs.mkdirSync(tempExtractionDir, { recursive: true });

  const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  try {
    if (driveFolderId) {
      const drive = getDriveClient();
      console.log(`📡 Connecting to Google Drive Folder: ${driveFolderId}...`);

      // List JSON snapshots on Google Drive
      const listRes = await drive.files.list({
        q: `'${driveFolderId}' in parents and name contains 'ttt_snapshot_' and mimeType = 'application/json' and trashed = false`,
        orderBy: 'createdTime desc',
        fields: 'files(id, name, createdTime)',
      });

      const files = (listRes.data.files || []).filter((f: any) => 
        f.name && f.name.startsWith('ttt_snapshot_')
      );
      if (files.length === 0) {
        throw new Error('No database snapshot JSON files found on Google Drive.');
      }

      // Select target snapshot file
      let targetFile = files[0]; // default to newest
      if (targetTimestamp) {
        const found = files.find((f: any) => f.name?.includes(targetTimestamp));
        if (found) {
          targetFile = found;
        } else {
          console.warn(`⚠️ Specific snapshot with timestamp "${targetTimestamp}" not found. Falling back to latest: ${targetFile.name}`);
        }
      }

      console.log(`⬇️ Downloading snapshot: ${targetFile.name} (ID: ${targetFile.id})...`);
      
      const fileRes = await drive.files.get({
        fileId: targetFile.id!,
        alt: 'media',
      });
      snapshotData = fileRes.data;

      // Check and download backup_manifest.json
      console.log(`📡 Checking for backup_manifest.json on Google Drive...`);
      const manifestSearch = await drive.files.list({
        q: `'${driveFolderId}' in parents and name = 'backup_manifest.json' and trashed = false`,
        fields: 'files(id)',
      });

      if (manifestSearch.data.files && manifestSearch.data.files.length > 0) {
        const manifestId = manifestSearch.data.files[0].id!;
        const manifestFile = await drive.files.get({
          fileId: manifestId,
          alt: 'media',
        });
        const manifest = typeof manifestFile.data === 'string' 
          ? JSON.parse(manifestFile.data) 
          : manifestFile.data;
        fileManifest = manifest.files || [];

        // Download all archive files listed in the manifest
        const archives = manifest.archives || [];
        console.log(`📦 Found ${archives.length} archive files in manifest. Downloading and extracting...`);
        for (const archName of archives) {
          try {
            console.log(`⬇️ Downloading archive: ${archName}...`);
            const archSearch = await drive.files.list({
              q: `'${driveFolderId}' in parents and name = '${archName}' and trashed = false`,
              fields: 'files(id)',
            });
            if (archSearch.data.files && archSearch.data.files.length > 0) {
              const archId = archSearch.data.files[0].id!;
              const localArchPath = path.join(tempExtractionDir, archName);
              const archDl = await drive.files.get({
                fileId: archId,
                alt: 'media',
              }, { responseType: 'arraybuffer' });
              fs.writeFileSync(localArchPath, Buffer.from(archDl.data as ArrayBuffer));

              console.log(`📦 Extracting archive: ${archName}...`);
              await tar.extract({
                file: localArchPath,
                cwd: tempExtractionDir,
              });
            } else {
              console.warn(`⚠️ Archive ${archName} not found on Google Drive!`);
            }
          } catch (archErr: any) {
            console.warn(`⚠️ Failed to process archive ${archName}: ${archErr.message}`);
          }
        }
      }
    } else {
      console.log('📡 No Google Drive configured. Searching locally in server/backups/ ...');
      isLocalMode = true;
    }
  } catch (err: any) {
    console.warn(`📡 Google Drive connection failed/bypassed: ${err.message}. Switching to local backup search...`);
    isLocalMode = true;
  }

  if (isLocalMode) {
    const backupsDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      console.error(`❌ No local "backups/" folder exists. Cannot restore.`);
      process.exit(1);
    }

    const folders = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('backup_'))
      .sort((a, b) => b.localeCompare(a)); // Sort newest first

    if (folders.length === 0) {
      console.error(`❌ No local backup folders found inside "backups/". Cannot restore.`);
      process.exit(1);
    }

    let targetFolder = folders[0];
    if (targetTimestamp) {
      const found = folders.find(f => f.includes(targetTimestamp));
      if (found) targetFolder = found;
    }

    localFolderPath = path.join(backupsDir, targetFolder);
    console.log(`📁 Using local backup folder: ${localFolderPath}`);

    const snapshotFiles = fs.readdirSync(localFolderPath).filter(f => f.startsWith('ttt_snapshot_') && f.endsWith('.json'));
    if (snapshotFiles.length === 0) {
      console.error(`❌ No JSON snapshot found in local backup folder: ${localFolderPath}`);
      process.exit(1);
    }

    snapshotData = JSON.parse(fs.readFileSync(path.join(localFolderPath, snapshotFiles[0]), 'utf8'));

    // Check for backup_manifest.json
    const manifestPath = path.join(localFolderPath, 'backup_manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      fileManifest = manifest.files || [];

      // Extract all local archives in the folder
      const archives = manifest.archives || [];
      for (const archName of archives) {
        const localArchPath = path.join(localFolderPath, archName);
        if (fs.existsSync(localArchPath)) {
          console.log(`📦 Extracting local archive: ${archName}...`);
          await tar.extract({
            file: localArchPath,
            cwd: tempExtractionDir,
          });
        }
      }
    } else {
      // Fallback to legacy files_manifest.json
      const legacyManifestPath = path.join(localFolderPath, 'files_manifest.json');
      if (fs.existsSync(legacyManifestPath)) {
        fileManifest = JSON.parse(fs.readFileSync(legacyManifestPath, 'utf8'));
      }
    }
  }

  if (!snapshotData) {
    console.error('❌ Failed to parse or load snapshot data.');
    process.exit(1);
  }

  // EXECUTE RESTORATION

  // 1. RESTORE AUTH USERS
  if (['all', 'users'].includes(restoreType)) {
    console.log(`\n👥 Restoring Auth User Accounts...`);
    const usersList = snapshotData.users || [];
    console.log(`Found ${usersList.length} user account(s) in backup.`);

    for (const u of usersList) {
      try {
        console.log(`Checking user: ${u.email} (${u.$id})`);
        
        let existingUser = null;
        try {
          existingUser = await usersService.get(u.$id);
        } catch {}

        if (existingUser) {
          console.log(`User already exists, updating preferences/metadata: ${u.email}`);
          await usersService.updateStatus(u.$id, u.status);
          if (u.phone) {
            await usersService.updatePhone(u.$id, u.phone);
          }
        } else {
          console.log(`Creating user: ${u.email} (${u.$id})`);
          const tempPassword = 'LorryGuruTempPassword123!';
          await usersService.create(
            u.$id,
            u.email,
            u.phone || undefined,
            tempPassword,
            u.name || undefined
          );
          await usersService.updateStatus(u.$id, u.status);
          
          if (u.emailVerification) {
            await usersService.updateEmailVerification(u.$id, true);
          }
          if (u.phoneVerification) {
            await usersService.updatePhoneVerification(u.$id, true);
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ Failed to restore user ${u.email}: ${err.message}`);
      }
    }
  }

  // 1b. RESTORE TEAMS AND MEMBERSHIPS
  if (['all', 'teams'].includes(restoreType)) {
    console.log(`\n👥 Restoring Teams and Memberships...`);
    const teamsList = snapshotData.teams || [];
    console.log(`Found ${teamsList.length} team(s) in backup.`);

    for (const tObj of teamsList) {
      const team = tObj.team;
      const memberships = tObj.memberships || [];

      try {
        console.log(`Checking team: ${team.name} (${team.$id})`);
        let existingTeam = null;
        try {
          existingTeam = await teamsService.get(team.$id);
        } catch {}

        if (!existingTeam) {
          console.log(`Creating team: ${team.name} (${team.$id})`);
          await teamsService.create(team.$id, team.name);
        }

        // Add memberships
        for (const member of memberships) {
          try {
            // Check if member already in team
            const currentMembers = await teamsService.listMemberships(team.$id);
            const exists = currentMembers.memberships.some((m: any) => m.userId === member.userId);

            if (!exists) {
              console.log(`Adding member ${member.userName} (${member.userId}) to team ${team.name}`);
              await teamsService.createMembership(
                team.$id,
                member.roles,
                member.userEmail || undefined,
                member.userId || undefined,
                member.userPhone || undefined,
                process.env.VITE_APP_URL || 'https://lorryguru.in',
                member.userName || undefined
              );
            }
          } catch (memErr: any) {
            console.warn(`⚠️ Failed to restore membership for user ${member.userName} in team ${team.name}: ${memErr.message}`);
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ Failed to restore team ${team.name}: ${err.message}`);
      }
    }
  }

  // 2. RESTORE DATABASE DOCUMENTS
  if (['all', 'database'].includes(restoreType)) {
    console.log(`\n🗄️ Restoring Database Documents...`);
    const collectionsData = snapshotData.database || {};
    
    // We restore in sequence to respect potential references (dependencies)
    const collectionsOrder = [
      'offices', 'accounts', 'drivers', 'trucks', 'trips',
      'expenses', 'tyres', 'support_tickets', 'audit_logs', 'global_configs', 'sub_trips'
    ];

    for (const col of collectionsOrder) {
      const docs = collectionsData[col] || [];
      if (docs.length === 0) continue;

      console.log(`Restoring collection "${col}" (${docs.length} documents)...`);
      
      const chunkSize = 25; // process 25 documents in parallel
      for (let i = 0; i < docs.length; i += chunkSize) {
        const chunk = docs.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (doc: any) => {
          const docId = doc.$id;
          const orgId = doc.organizationId || 'org_default';
          const permissions = getDocumentPermissions(orgId);

          // Prepare flat record payload
          const recordData: any = {};
          for (const [k, v] of Object.entries(doc)) {
            if (k.startsWith('$') || k === 'id') continue;
            recordData[k] = v;
          }

          try {
            // Optimistic Create: try to create directly to save a round-trip
            try {
              await databases.createDocument(dbId, col, docId, recordData, permissions);
              console.log(`✅ Created document: ${col}/${docId}`);
            } catch (createErr: any) {
              if (createErr.code === 409) {
                // If it already exists, update it instead
                await databases.updateDocument(dbId, col, docId, recordData, permissions);
                console.log(`🔄 Updated document: ${col}/${docId}`);
              } else {
                throw createErr;
              }
            }
          } catch (err: any) {
            console.warn(`⚠️ Failed to restore document ${col}/${docId}: ${err.message}`);
          }
        }));
      }
    }
  }

  // 3. RESTORE STORAGE FILES
  if (['all', 'storage'].includes(restoreType)) {
    console.log(`\n📁 Restoring Storage Files...`);
    console.log(`Found ${fileManifest.length} files in manifest.`);

    const chunkSize = 10; // process 10 files in parallel
    for (let i = 0; i < fileManifest.length; i += chunkSize) {
      const chunk = fileManifest.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (fileItem) => {
        const bucketId = fileItem.bucketId;
        const fileId = fileItem.fileId;
        const filename = fileItem.filename;

        try {
          let fileBuffer: Buffer | null = null;

          // Path inside extracted folder (the folders inside tarball start with 'new_storage')
          const extractedFilePath = path.join(tempExtractionDir, 'new_storage', bucketId, `${fileId}_${filename}`);
          const legacyLocalPath = isLocalMode && fileItem.localPath ? path.resolve(process.cwd(), fileItem.localPath) : '';

          if (fs.existsSync(extractedFilePath)) {
            fileBuffer = fs.readFileSync(extractedFilePath);
          } else if (legacyLocalPath && fs.existsSync(legacyLocalPath)) {
            fileBuffer = fs.readFileSync(legacyLocalPath);
          }

          if (fileBuffer) {
            try {
              await storageService.createFile(
                bucketId,
                fileId,
                InputFile.fromBuffer(fileBuffer, filename)
              );
              console.log(`✅ Restored storage file successfully: ${filename}`);
            } catch (uploadErr: any) {
              if (uploadErr.code === 409) {
                console.log(`File already exists in Appwrite storage, skipping: ${filename} (${fileId})`);
              } else {
                throw uploadErr;
              }
            }
          } else {
            console.warn(`⚠️ File not found in extracted archives: ${filename} (${fileId})`);
          }
        } catch (err: any) {
          console.warn(`⚠️ Failed to restore storage file ${filename} (${fileId}): ${err.message}`);
        }
      }));
    }
  }

  console.log(`\n=========================================`);
  console.log(`🏁 Appwrite Recovery Operation Completed!`);
  console.log(`=========================================`);
}

startRestoration().catch(err => {
  console.error('❌ Recovery aborted due to fatal error:', err);
  process.exit(1);
});
