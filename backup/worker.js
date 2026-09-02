import { runCompleteBackup } from './backupService.js';
console.log('========================================================');
console.log('🚀 Appwrite Cloud Backup Worker Process Active');
console.log('========================================================');
console.log(`Checking Google Drive and local folder space every 1 hour...`);
// Initial test backup 5 seconds after worker startup
setTimeout(async () => {
    console.log('[Worker] Executing initial startup backup...');
    try {
        await runCompleteBackup();
    }
    catch (err) {
        console.error('[Worker] Initial backup failed:', err.message || err);
    }
}, 5000);
// Run backups every 1 hour (3600000 ms)
setInterval(async () => {
    console.log('[Worker] Triggering hourly scheduled backup...');
    try {
        await runCompleteBackup();
    }
    catch (err) {
        console.error('[Worker] Scheduled backup failed:', err.message || err);
    }
}, 3600000);
