import { execSync } from 'child_process';
import os from 'os';

console.log('=== [Capacitor APK Automated Builder] ===');

try {
  console.log('1. Building web assets & incrementing version...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('\n2. Syncing web assets to native project...');
  execSync('npx cap sync', { stdio: 'inherit' });

  console.log('\n3. Compiling Android Debug APK...');
  const isWindows = os.platform() === 'win32';
  const gradlewCmd = isWindows ? 'gradlew.bat assembleDebug' : './gradlew assembleDebug';
  
  execSync(gradlewCmd, { 
    cwd: 'android',
    stdio: 'inherit' 
  });

  console.log('\n🎉 BUILD SUCCESSFUL!');
  console.log('Your APK is ready at: android/app/build/outputs/apk/debug/app-debug.apk');
} catch (err) {
  console.error('\n❌ Build failed:', err.message);
  process.exit(1);
}
