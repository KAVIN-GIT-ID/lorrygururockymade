const { execSync } = require('child_process');

console.log('1. Checking out all source files to clean Git version...');
execSync('git checkout src/', { stdio: 'inherit' });

console.log('2. Expanding shorthands in App.tsx...');
execSync('node scripts/expand-app-shorthands.cjs', { stdio: 'inherit' });

console.log('3. Running migrate-all (main, contexts)...');
execSync('node scripts/migrate-all.cjs', { stdio: 'inherit' });

console.log('4. Running general React-to-Solid migration on all source files...');
execSync('node scripts/migrate-react-to-solid.cjs', { stdio: 'inherit' });

console.log('5. Running migrate-hooks-detailed...');
execSync('node scripts/migrate-hooks-detailed.cjs', { stdio: 'inherit' });

console.log('6. Running migrate-helper-hooks...');
execSync('node scripts/migrate-helper-hooks.cjs', { stdio: 'inherit' });

console.log('7. Running migrate-components (lazies, Suspense, events)...');
execSync('node scripts/migrate-components.cjs', { stdio: 'inherit' });

console.log('8. Running precise UserAccessControl migration...');
execSync('node scripts/migrate-user-access-control-precise.cjs', { stdio: 'inherit' });

console.log('9. Running custom useTrips migration...');
execSync('node scripts/migrate-use-trips.cjs', { stdio: 'inherit' });

console.log('10. Running VoiceAssistant migration...');
execSync('node scripts/migrate-voice-assistant.cjs', { stdio: 'inherit' });
execSync('node scripts/fix-voice-assistant-declarations.cjs', { stdio: 'inherit' });

console.log('11. Running clean App.tsx migration...');
execSync('node scripts/migrate-app-clean.cjs', { stdio: 'inherit' });

console.log('12. Applying manual fixes (Setup2FAModal, Disable2FAModal, App context, useLocalStorage)...');
execSync('node scripts/apply-manual-fixes.cjs', { stdio: 'inherit' });

console.log('13. Converting hooks orgState variables to createMemos...');
execSync('node scripts/fix-hooks-org-memos.cjs', { stdio: 'inherit' });

console.log('14. Converting hooks signals to eager initializers...');
execSync('node scripts/fix-hooks-initializers-eager.cjs', { stdio: 'inherit' });

console.log('15. Running precise MonthlyReport migration...');
execSync('node scripts/migrate-monthly-report-precise.cjs', { stdio: 'inherit' });

console.log('16. Fixing VerificationRequiredScreen...');
execSync('node scripts/fix-verification-screen.cjs', { stdio: 'inherit' });

console.log('Done! All source files migrated and built successfully.');
