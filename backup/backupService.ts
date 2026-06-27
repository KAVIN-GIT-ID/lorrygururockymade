import { Client as AppwriteClient, Databases, Users, Storage, Query, Teams } from 'node-appwrite';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as tar from 'tar';

dotenv.config();

// Initialize Appwrite Server Client
const appwriteClient = new AppwriteClient();
const endpoint = process.env.APPWRITE_ENDPOINT || process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;

if (endpoint && projectId && apiKey) {
  appwriteClient
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
} else {
  console.warn('[Backup Service] Warning: Missing Appwrite configuration (endpoint, projectId, or apiKey).');
}

const databases = new Databases(appwriteClient);
const usersService = new Users(appwriteClient);
const storageService = new Storage(appwriteClient);
const teamsService = new Teams(appwriteClient);

const dbId = process.env.APPWRITE_DATABASE_ID || 'fleet_db';

// Log tracking in-memory for the Admin Panel status API
export interface BackupStatus {
  status: 'idle' | 'running' | 'success' | 'failed';
  lastRunTime: string | null;
  lastMessage: string | null;
  error: string | null;
  dbFilesCount: number;
  storageFilesCount: number;
  totalSize: number; // in bytes
}

export let backupStatus: BackupStatus = {
  status: 'idle',
  lastRunTime: null,
  lastMessage: 'Backup service initialized',
  error: null,
  dbFilesCount: 0,
  storageFilesCount: 0,
  totalSize: 0,
};

// Helper to get Google Drive API Client (supports OAuth2 and Service Accounts)
function getDriveClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    console.log('[Backup Service] Authenticating using Google OAuth2 credentials...');
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  console.log('[Backup Service] Authenticating using Google Service Account...');
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

// Main manual trigger & automated hourly trigger function
export async function runCompleteBackup(): Promise<string> {
  const start = Date.now();
  console.log(`[Backup Service] Starting complete Appwrite backup...`);
  
  backupStatus.status = 'running';
  backupStatus.lastMessage = 'Gathering database records, users, and storage files...';
  backupStatus.error = null;

  try {
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const folderName = `backup_${backupTimestamp}`;
    
    // Create local backup folder
    const localBackupDir = path.resolve(process.cwd(), 'backups', folderName);
    fs.mkdirSync(localBackupDir, { recursive: true });

    // 1. GATHER DATABASE DATA (11 Collections)
    const collections = [
      'trucks', 'drivers', 'offices', 'accounts', 'trips', 
      'expenses', 'tyres', 'support_tickets', 'audit_logs', 'global_configs', 'sub_trips'
    ];

    const databaseSnapshot: Record<string, any[]> = {};
    for (const col of collections) {
      console.log(`[Backup Service] Exporting collection: ${col}`);
      try {
        const response = await databases.listDocuments(dbId, col, [Query.limit(5000)]);
        databaseSnapshot[col] = response.documents || [];
      } catch (err: any) {
        console.warn(`[Backup Service] Skipping collection ${col} due to error: ${err.message}`);
        databaseSnapshot[col] = [];
      }
    }

    // 2. GATHER AUTH USERS
    console.log(`[Backup Service] Exporting user accounts...`);
    let authUsers: any[] = [];
    try {
      const response = await usersService.list([Query.limit(5000)]);
      authUsers = response.users || [];
    } catch (err: any) {
      console.warn(`[Backup Service] Failed to export users: ${err.message}`);
    }

    // 3. GATHER TEAMS AND MEMBERSHIPS
    console.log(`[Backup Service] Exporting teams and memberships...`);
    const teamsAndMemberships: any[] = [];
    try {
      const teamsList = await teamsService.list([Query.limit(5000)]);
      for (const team of teamsList.teams || []) {
        let members: any[] = [];
        try {
          const membersList = await teamsService.listMemberships(team.$id, [Query.limit(5000)]);
          members = membersList.memberships || [];
        } catch (memErr: any) {
          console.warn(`[Backup Service] Failed to list memberships for team ${team.$id}: ${memErr.message}`);
        }
        teamsAndMemberships.push({
          team,
          memberships: members
        });
      }
    } catch (err: any) {
      console.warn(`[Backup Service] Failed to export teams: ${err.message}`);
    }

    // Package metadata Snapshot
    const snapshotObj = {
      timestamp: new Date().toISOString(),
      database: databaseSnapshot,
      users: authUsers,
      teams: teamsAndMemberships,
    };

    const snapshotJSON = JSON.stringify(snapshotObj, null, 2);
    const snapshotFilename = `ttt_snapshot_${backupTimestamp}.json`;
    const localSnapshotPath = path.join(localBackupDir, snapshotFilename);
    fs.writeFileSync(localSnapshotPath, snapshotJSON, 'utf8');


    // 4. EXPORT STORAGE FILES
    console.log(`[Backup Service] Listing and downloading files from storage buckets...`);
    const mainBucketId = process.env.VITE_APPWRITE_BUCKET_ID || '6a1713930029ff1ca4d3';
    const ticketsBucketId = process.env.VITE_APPWRITE_TICKETS_BUCKET_ID || '';
    
    const bucketsToExport = [mainBucketId];
    if (ticketsBucketId && ticketsBucketId !== mainBucketId) {
      bucketsToExport.push(ticketsBucketId);
    }

    const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const ownerEmail = process.env.GOOGLE_DRIVE_OWNER_EMAIL;
    let drive: any = null;
    let manifestFileId = '';
    let manifest = { version: 1, files: [] as any[], archives: [] as string[] };

    // Helper to transfer file ownership to prevent "Service Account 0 bytes quota" error
    const transferOwnership = async (fileId: string) => {
      if (!ownerEmail || !drive) return;
      try {
        await drive.permissions.create({
          fileId,
          transferOwnership: true,
          requestBody: {
            role: 'owner',
            type: 'user',
            emailAddress: ownerEmail.trim().toLowerCase(),
          },
        });
      } catch (err: any) {
        console.warn(`[Backup Service] Ownership transfer warning for file ${fileId}: ${err.message}`);
      }
    };

    // Connect to Google Drive first to obtain backup_manifest.json
    if (driveFolderId) {
      try {
        drive = getDriveClient();
        console.log(`[Backup Service] Connecting to Google Drive Folder ID: ${driveFolderId} to fetch manifest...`);

        const manifestSearch = await drive.files.list({
          q: `'${driveFolderId}' in parents and name = 'backup_manifest.json' and trashed = false`,
          fields: 'files(id)',
        });
        
        if (manifestSearch.data.files && manifestSearch.data.files.length > 0) {
          manifestFileId = manifestSearch.data.files[0].id!;
          console.log(`[Backup Service] Downloading existing backup_manifest.json...`);
          const manifestContentRes = await drive.files.get({
            fileId: manifestFileId,
            alt: 'media',
          });
          const content = typeof manifestContentRes.data === 'string' 
            ? manifestContentRes.data 
            : JSON.stringify(manifestContentRes.data);
          try {
            manifest = JSON.parse(content);
            if (!manifest.files) manifest.files = [];
            if (!manifest.archives) manifest.archives = [];
          } catch (e) {
            console.warn(`[Backup Service] Failed to parse manifest JSON, starting fresh:`, e);
          }
        } else {
          console.log(`[Backup Service] backup_manifest.json not found on Google Drive. Will create a new one.`);
        }
      } catch (driveErr: any) {
        console.warn(`[Backup Service] Failed to fetch manifest from Google Drive: ${driveErr.message}`);
      }
    }

    const exportedFiles: Array<{ bucketId: string; fileId: string; filename: string; localPath: string }> = [];
    const localNewStorageDir = path.join(localBackupDir, 'new_storage');

    for (const bId of bucketsToExport) {
      try {
        const filesList = await storageService.listFiles(bId, [Query.limit(5000)]);
        const files = filesList.files || [];
        
        for (const file of files) {
          try {
            // Exclude APK files
            if (file.name.toLowerCase().endsWith('.apk')) {
              console.log(`[Backup Service] Skipping file ${file.name} (Excluded: APK file)`);
              continue;
            }
            
            // Exclude files larger than 10MB (10 * 1024 * 1024 bytes)
            const maxSizeBytes = 10 * 1024 * 1024;
            if (file.sizeOriginal && file.sizeOriginal > maxSizeBytes) {
              console.log(`[Backup Service] Skipping file ${file.name} (Excluded: size ${(file.sizeOriginal / (1024 * 1024)).toFixed(1)} MB exceeds 10MB limit)`);
              continue;
            }

            const fileKey = `${bId}_${file.$id}_${file.name}`;
            const alreadyBackedUp = manifest.files.some((f: any) => f.key === fileKey);
            if (alreadyBackedUp) {
              continue;
            }

            console.log(`[Backup Service] Downloading new file: ${file.name} (${file.$id}) from bucket: ${bId}`);
            const buffer = await storageService.getFileDownload(bId, file.$id);
            const fileSubdir = path.join(localNewStorageDir, bId);
            fs.mkdirSync(fileSubdir, { recursive: true });
            
            const localFilePath = path.join(fileSubdir, `${file.$id}_${file.name}`);
            fs.writeFileSync(localFilePath, Buffer.from(buffer));
            
            exportedFiles.push({
              bucketId: bId,
              fileId: file.$id,
              filename: file.name,
              localPath: localFilePath,
            });
          } catch (fileErr: any) {
            console.warn(`[Backup Service] Failed to download file ${file.$id}: ${fileErr.message}`);
          }
        }
      } catch (bucketErr: any) {
        console.warn(`[Backup Service] Failed to list storage bucket ${bId}: ${bucketErr.message}`);
      }
    }

    // Write file mapping index locally for reference
    fs.writeFileSync(
      path.join(localBackupDir, 'files_manifest.json'),
      JSON.stringify(exportedFiles, null, 2),
      'utf8'
    );

    // Create incremental tar.gz if new files were exported
    let tarballFilename = '';
    let tarballLocalPath = '';
    if (exportedFiles.length > 0) {
      tarballFilename = `storage_new_files_${backupTimestamp}.tar.gz`;
      tarballLocalPath = path.join(localBackupDir, tarballFilename);
      console.log(`[Backup Service] Creating incremental archive: ${tarballFilename}...`);
      await tar.create({
        gzip: true,
        file: tarballLocalPath,
        cwd: localBackupDir,
      }, ['new_storage']);
    }

    // Get total size of this snapshot folder
    let totalFolderSize = fs.statSync(localSnapshotPath).size;
    if (tarballLocalPath && fs.existsSync(tarballLocalPath)) {
      totalFolderSize += fs.statSync(tarballLocalPath).size;
    }

    // 5. GOOGLE DRIVE UPLOAD
    let driveUploadMsg = '';

    if (driveFolderId && drive) {
      try {
        // A. Upload JSON Database Snapshot
        console.log(`[Backup Service] Uploading database snapshot to Drive...`);
        const dbUploadRes = await drive.files.create({
          requestBody: {
            name: snapshotFilename,
            parents: [driveFolderId],
          },
          media: {
            mimeType: 'application/json',
            body: fs.createReadStream(localSnapshotPath),
          },
        });
        const driveDbFileId = dbUploadRes.data.id;
        if (driveDbFileId) {
          await transferOwnership(driveDbFileId);
        }

        // B. Upload newly created Binary Files tarball
        if (tarballLocalPath && tarballFilename) {
          console.log(`[Backup Service] Uploading new files archive to Drive: ${tarballFilename}...`);
          const archiveUploadRes = await drive.files.create({
            requestBody: {
              name: tarballFilename,
              parents: [driveFolderId],
            },
            media: {
              mimeType: 'application/gzip',
              body: fs.createReadStream(tarballLocalPath),
            },
          });
          const driveArchiveId = archiveUploadRes.data.id;
          if (driveArchiveId) {
            await transferOwnership(driveArchiveId);
          }

          // Update manifest memory structures
          manifest.archives.push(tarballFilename);
          for (const fItem of exportedFiles) {
            manifest.files.push({
              key: `${fItem.bucketId}_${fItem.fileId}_${fItem.filename}`,
              bucketId: fItem.bucketId,
              fileId: fItem.fileId,
              filename: fItem.filename,
              archive: tarballFilename
            });
          }
        } else {
          console.log(`[Backup Service] No new storage files to upload.`);
        }

        // C. Upload/Update backup_manifest.json on Drive
        console.log(`[Backup Service] Saving updated backup_manifest.json on Google Drive...`);
        const localManifestPath = path.join(localBackupDir, 'backup_manifest.json');
        fs.writeFileSync(localManifestPath, JSON.stringify(manifest, null, 2), 'utf8');

        if (manifestFileId) {
          await drive.files.update({
            fileId: manifestFileId,
            media: {
              mimeType: 'application/json',
              body: fs.createReadStream(localManifestPath),
            },
          });
        } else {
          const createManifestRes = await drive.files.create({
            requestBody: {
              name: 'backup_manifest.json',
              parents: [driveFolderId],
            },
            media: {
              mimeType: 'application/json',
              body: fs.createReadStream(localManifestPath),
            },
          });
          const newManifestId = createManifestRes.data.id;
          if (newManifestId) {
            await transferOwnership(newManifestId);
          }
        }

        driveUploadMsg = ` and successfully synced to Google Drive (Folder: ${driveFolderId})`;

        // D. ROTATE/PRUNE GOOGLE DRIVE BACKUPS
        console.log(`[Backup Service] Pruning older snapshots on Google Drive...`);
        const driveSnapshotsRes = await drive.files.list({
          q: `'${driveFolderId}' in parents and name contains 'ttt_snapshot_' and mimeType = 'application/json' and trashed = false`,
          orderBy: 'createdTime desc',
          fields: 'files(id, name, createdTime)',
        });
        
        const driveSnapshots = (driveSnapshotsRes.data.files || []).filter((f: any) => 
          f.name && f.name.startsWith('ttt_snapshot_')
        );
        // Sort explicitly by YYYYMMDD_HHMMSS pattern in name just in case API timestamps vary
        driveSnapshots.sort((a: any, b: any) => (b.name || '').localeCompare(a.name || ''));

        if (driveSnapshots.length > 2) {
          console.log(`[Backup Service] Pruning ${driveSnapshots.length - 2} old snapshot(s) from Drive`);
          for (let i = 2; i < driveSnapshots.length; i++) {
            const fileIdToDelete = driveSnapshots[i].id;
            if (fileIdToDelete) {
              console.log(`[Backup Service] Deleting old Drive file: ${driveSnapshots[i].name}`);
              await drive.files.delete({ fileId: fileIdToDelete });
            }
          }
        }
      } catch (driveErr: any) {
        console.error(`[Backup Service] Google Drive integration failed:`, driveErr.message);
        driveUploadMsg = ` (Google Drive upload failed: ${driveErr.message})`;
      }
    } else {
      driveUploadMsg = ` (Google Drive credentials/folder ID not configured in .env, saved locally only)`;
    }

    // 6. ROTATE/PRUNE LOCAL BACKUPS (Keep only the latest 2 snapshot folders)
    console.log(`[Backup Service] Pruning older local backup folders...`);
    const backupsParentDir = path.resolve(process.cwd(), 'backups');
    if (fs.existsSync(backupsParentDir)) {
      const localDirs = fs.readdirSync(backupsParentDir)
        .filter(name => name.startsWith('backup_'))
        .map(name => ({
          name,
          path: path.join(backupsParentDir, name),
          stat: fs.statSync(path.join(backupsParentDir, name))
        }));
      
      // Sort newest to oldest
      localDirs.sort((a, b) => b.name.localeCompare(a.name));

      if (localDirs.length > 2) {
        console.log(`[Backup Service] Pruning ${localDirs.length - 2} old local backup folder(s)`);
        for (let i = 2; i < localDirs.length; i++) {
          console.log(`[Backup Service] Removing old local folder: ${localDirs[i].name}`);
          fs.rmSync(localDirs[i].path, { recursive: true, force: true });
        }
      }
    }

    const duration = ((Date.now() - start) / 1000).toFixed(1);
    const successMessage = `Backup "${folderName}" completed in ${duration}s (${(totalFolderSize / 1024).toFixed(1)} KB)${driveUploadMsg}`;
    
    console.log(`[Backup Service] ${successMessage}`);

    // Update global status
    backupStatus.status = 'success';
    backupStatus.lastRunTime = new Date().toISOString();
    backupStatus.lastMessage = successMessage;
    backupStatus.dbFilesCount = Object.keys(databaseSnapshot).length;
    backupStatus.storageFilesCount = exportedFiles.length;
    backupStatus.totalSize = totalFolderSize;

    return successMessage;
  } catch (err: any) {
    const errorMsg = err.message || err;
    console.error(`[Backup Service] Backup failure:`, errorMsg);
    
    backupStatus.status = 'failed';
    backupStatus.lastRunTime = new Date().toISOString();
    backupStatus.lastMessage = `Backup failed: ${errorMsg}`;
    backupStatus.error = errorMsg;

    throw err;
  }
}
