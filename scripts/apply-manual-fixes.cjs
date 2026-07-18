const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

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

// 1. Setup2FAModal.tsx
modifyFile(path.join(rootDir, 'src/components/Setup2FAModal.tsx'), (content) => {
  content = content.replace("const { currentUser } = useAuth();", "const auth = useAuth();");
  content = content.replace("const { userRightsList, setUserRightsList, pushPermissions: pushPermissionsToCloud } = usePermissions();", "const perm = usePermissions();");
  content = content.replace(/currentUser\?/g, "auth.currentUser()?");
  content = content.replace(/currentUser\./g, "auth.currentUser().");
  content = content.replace(/userRightsList/g, "perm.userRightsList()");
  content = content.replace(/setUserRightsList/g, "perm.setUserRightsList");
  content = content.replace(/pushPermissionsToCloud/g, "perm.pushPermissions");
  content = content.replace("await reconcileSession(currentUser, updated);", "await reconcileSession(auth.currentUser(), updated);");
  console.log('Fixed Setup2FAModal.tsx');
  return content;
});

// 2. Disable2FAModal.tsx
modifyFile(path.join(rootDir, 'src/components/Disable2FAModal.tsx'), (content) => {
  content = content.replace("const { currentUser } = useAuth();", "const auth = useAuth();");
  content = content.replace("const { userRightsList, setUserRightsList, currentUserRights, pushPermissions: pushPermissionsToCloud } = usePermissions();", 
    "const perm = usePermissions();");
  content = content.replace(/currentUser\?/g, "auth.currentUser()?");
  content = content.replace(/currentUser\./g, "auth.currentUser().");
  content = content.replace(/currentUserRights\./g, "perm.currentUserRights().");
  content = content.replace(/userRightsList/g, "perm.userRightsList()");
  content = content.replace(/setUserRightsList/g, "perm.setUserRightsList");
  content = content.replace(/pushPermissionsToCloud/g, "perm.pushPermissions");
  console.log('Fixed Disable2FAModal.tsx');
  return content;
});

// 3. App.tsx Context Usages & currentUser shorthand
modifyFile(path.join(rootDir, 'src/App.tsx'), (content) => {
  // Replace the destructuring block
  const oldDestruct = `  const {
    currentUser,
    setCurrentUser,
    loadingUser,
    setLoadingUser,
    initialPullDone,
    setInitialPullDone,
    isOnline,
    setIsOnline,
    disconnectReason,
    setDisconnectReason,
    reconcileUserSession
  } = useAuth();

  const {
    userRightsList,
    setUserRightsList,
    currentUserRights,
    addPermission: handleAddPermission,
    updatePermission: handleUpdatePermission,
    deletePermission: handleDeletePermission,
    pushPermissions: pushPermissionsToCloud
  } = usePermissions();

  if (import.meta.env.DEV) {
    console.log("DEBUG RENDER AppContent currentUserRights:", currentUserRights);
  }

  const {
    organizationProfiles,
    setOrganizationProfiles,
    saveProfiles: saveOrganizationProfiles
  } = useOrganizations();`;

  const newDestruct = `  const auth = useAuth();
  const currentUser = auth.currentUser;
  const setCurrentUser = auth.setCurrentUser;
  const loadingUser = auth.loadingUser;
  const setLoadingUser = auth.setLoadingUser;
  const initialPullDone = auth.initialPullDone;
  const setInitialPullDone = auth.setInitialPullDone;
  const isOnline = auth.isOnline;
  const setIsOnline = auth.setIsOnline;
  const disconnectReason = auth.disconnectReason;
  const setDisconnectReason = auth.setDisconnectReason;
  const reconcileUserSession = auth.reconcileUserSession;

  const perm = usePermissions();
  const userRightsList = perm.userRightsList;
  const setUserRightsList = perm.setUserRightsList;
  const currentUserRights = perm.currentUserRights;
  const handleAddPermission = perm.addPermission;
  const handleUpdatePermission = perm.updatePermission;
  const handleDeletePermission = perm.deletePermission;
  const pushPermissionsToCloud = perm.pushPermissions;

  const orgs = useOrganizations();
  const organizationProfiles = orgs.organizationProfiles;
  const setOrganizationProfiles = orgs.setOrganizationProfiles;
  const saveOrganizationProfiles = orgs.saveProfiles;`;

  content = content.replace(oldDestruct, newDestruct);

  // Replaces usages of currentUser/currentUserRights to function calls
  content = content.replace(/\bcurrentUserRights\b(?![(]|\s*=|\s*:)/g, "currentUserRights()");
  content = content.replace(/\bcurrentUser\b(?![(]|\s*=|\s*:)/g, "currentUser()");
  content = content.replace(/\borganizationProfiles\b(?![(]|\s*=|\s*:)/g, "organizationProfiles()");
  content = content.replace(/\buserRightsList\b(?![(]|\s*=|\s*:)/g, "userRightsList()");

  // Fix shorthand property error
  content = content.replace(/currentUser\(\),\s*\n\s*currentUserOrgId,/g, "currentUser: currentUser(),\n    currentUserOrgId,");

  console.log('Fixed App.tsx context references');
  return content;
});

// 4. useLocalStorage.ts
const storagePath = path.join(rootDir, 'src/hooks/useLocalStorage.ts');
fs.writeFileSync(storagePath, `import { createSignal, createEffect, Accessor, Setter } from 'solid-js';
import { storageService } from '../services/storageService';

export function useLocalStorage<T>(key: string, initialValue: T): [Accessor<T>, Setter<T>] {
  const [state, setState] = createSignal<T>(storageService.get<T>(key, initialValue));

  createEffect(() => {
    storageService.set(key, state());
  });

  return [state, setState];
}
`, 'utf8');
console.log('Fixed useLocalStorage.ts');

// 5. vitest.config.ts
const vitestPath = path.join(rootDir, 'vitest.config.ts');
fs.writeFileSync(vitestPath, `import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    css: false,
  },
});
`, 'utf8');
console.log('Fixed vitest.config.ts');

// 6. UserAccessControl.tsx toggleFormRight type signature
modifyFile(path.join(rootDir, 'src/components/UserAccessControl.tsx'), (content) => {
  content = content.replace("const toggleFormRight = (key: keyof typeof rights) => {", "const toggleFormRight = (key: keyof ReturnType<typeof rights>) => {");
  console.log('Fixed UserAccessControl.tsx toggleFormRight type signature');
  return content;
});

// 7. setup.ts Recharts mock deletion
modifyFile(path.join(rootDir, 'src/test/setup.ts'), (content) => {
  content = content.replace(/\/\/ Global mock for Recharts[\s\S]*?\}\);\s*\n\s*\n/g, '');
  console.log('Removed Recharts mock from setup.ts');
  return content;
});

// 8. ProfileSupportTickets.tsx download attribute type fix
modifyFile(path.join(rootDir, 'src/components/ProfileSupportTickets.tsx'), (content) => {
  content = content.replace(/\bdownload\s*\n\s*class=/g, 'download=""\n                              class=');
  console.log('Fixed download attribute in ProfileSupportTickets.tsx');
  return content;
});

// 9. SearchableSelect.tsx KeyboardEvent type fix
modifyFile(path.join(rootDir, 'src/components/SearchableSelect.tsx'), (content) => {
  content = content.replace(/KeyboardEvent<HTMLInputElement>/g, 'KeyboardEvent');
  console.log('Fixed KeyboardEvent type in SearchableSelect.tsx');
  return content;
});

// 10. ProfileModal.tsx currentUserRights prop definition fix
modifyFile(path.join(rootDir, 'src/components/ProfileModal.tsx'), (content) => {
  content = content.replace("currentUserRights: UserPermission;", "currentUserRights: UserRights;");
  content = content.replace(
    "import { UserPermission, OrganizationProfile, SupportTicket } from '../types';",
    "import { UserPermission, OrganizationProfile, SupportTicket, UserRights } from '../types';"
  );
  console.log('Fixed ProfileModal.tsx currentUserRights type and import');
  return content;
});
