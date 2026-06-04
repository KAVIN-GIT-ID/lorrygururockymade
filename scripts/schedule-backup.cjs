/**
 * schedule-backup.cjs
 *
 * Runs a database backup on a regular schedule (every 24 hours by default).
 * Keep this running in a background terminal, or register it as a Windows
 * Task Scheduler job for fully automated daily backups.
 *
 * Usage:
 *   node scripts/schedule-backup.cjs              # Every 24 hours (default)
 *   node scripts/schedule-backup.cjs --hours 6   # Every 6 hours
 *   node scripts/schedule-backup.cjs --hours 1   # Every hour
 *
 * To register as Windows Task Scheduler (runs once per day at 9 AM):
 *   1. Open Task Scheduler
 *   2. Action → Create Basic Task
 *   3. Trigger: Daily at 09:00
 *   4. Action: Start a program
 *      Program: node
 *      Arguments: scripts/schedule-backup.cjs
 *      Start in: C:\Users\infimove\antigravity\Truck-Trip-Tracker
 *   5. Finish
 */

const { runBackup } = require('./backup-db.cjs');
const path = require('path');
const fs = require('fs');

// Parse optional --hours argument
const args = process.argv.slice(2);
const hoursIdx = args.indexOf('--hours');
const intervalHours = hoursIdx !== -1 && args[hoursIdx + 1]
  ? parseFloat(args[hoursIdx + 1])
  : 24;

const intervalMs = intervalHours * 60 * 60 * 1000;

// Log file inside backups/
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'backups');
const LOG_FILE = path.join(BACKUP_DIR, 'scheduled-backup.log');

function log(message) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${message}`;
  console.log(line);
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (e) {
    // Non-fatal log write failure
  }
}

async function scheduledRun() {
  log(`=== Scheduled Backup Started (every ${intervalHours}h) ===`);
  try {
    const backupPath = await runBackup();
    log(`✅ Backup successful: ${path.basename(backupPath)}`);
  } catch (err) {
    log(`❌ Backup FAILED: ${err.message}`);
  }
}

// Run immediately on startup, then on interval
scheduledRun();
setInterval(scheduledRun, intervalMs);

log(`Scheduler active — next backup in ${intervalHours} hour(s). Press Ctrl+C to stop.`);
