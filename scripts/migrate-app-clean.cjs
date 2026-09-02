const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize newlines to \n
content = content.replace(/\r\n/g, '\n');

// 1. Regex Match and replace context destructuring of useAuth
content = content.replace(/const\s*\{\s*currentUser\s*,\s*setCurrentUser\s*,\s*loadingUser\s*,\s*setLoadingUser\s*,\s*initialPullDone\s*,\s*setInitialPullDone\s*,\s*isOnline\s*,\s*setIsOnline\s*,\s*disconnectReason\s*,\s*setDisconnectReason\s*,\s*reconcileUserSession\s*\}\s*=\s*useAuth\(\);?/g, 
  `const auth = useAuth();
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
  const reconcileUserSession = auth.reconcileUserSession;`);

// 2. Regex Match and replace context destructuring of usePermissions
content = content.replace(/const\s*\{\s*userRightsList\s*,\s*setUserRightsList\s*,\s*currentUserRights\s*,\s*addPermission:\s*handleAddPermission\s*,\s*updatePermission:\s*handleUpdatePermission\s*,\s*deletePermission:\s*handleDeletePermission\s*,\s*pushPermissions:\s*pushPermissionsToCloud\s*\}\s*=\s*usePermissions\(\);?/g,
  `const perm = usePermissions();
  const userRightsList = perm.userRightsList;
  const setUserRightsList = perm.setUserRightsList;
  const currentUserRights = perm.currentUserRights;
  const handleAddPermission = perm.addPermission;
  const handleUpdatePermission = perm.updatePermission;
  const handleDeletePermission = perm.deletePermission;
  const pushPermissionsToCloud = perm.pushPermissions;`);

// 3. Regex Match and replace context destructuring of useOrganizations
content = content.replace(/const\s*\{\s*organizationProfiles\s*,\s*setOrganizationProfiles\s*,\s*saveProfiles:\s*saveOrganizationProfiles\s*\}\s*=\s*useOrganizations\(\);?/g,
  `const orgs = useOrganizations();
  const organizationProfiles = orgs.organizationProfiles;
  const setOrganizationProfiles = orgs.setOrganizationProfiles;
  const saveOrganizationProfiles = orgs.saveProfiles;`);

// 4. Safe replacements of variables to function calls (since they are now functions)
const terms = ['currentUser', 'currentUserRights', 'organizationProfiles', 'userRightsList'];
terms.forEach(t => {
  content = content.replace(new RegExp(`\\b${t}\\.(?!\\()`, 'g'), `${t}().`);
  content = content.replace(new RegExp(`\\b${t}\\?\\.(?!\\()`, 'g'), `${t}()?.`);
  content = content.replace(new RegExp(`!${t}\\b(?!\\()`, 'g'), `!${t}()`);
  content = content.replace(new RegExp(`\\b${t}\\s*&&`, 'g'), `${t}() &&`);
  content = content.replace(new RegExp(`\\b${t}\\s*\\|\\|`, 'g'), `${t}() ||`);
  content = content.replace(new RegExp(`\\b${t}\\s*===`, 'g'), `${t}() ===`);
  content = content.replace(new RegExp(`\\b${t}\\s*\\!==`, 'g'), `${t}() !==`);
  content = content.replace(new RegExp(`\\(${t}\\)`, 'g'), `(${t}())`);
  content = content.replace(new RegExp(`,\\s*${t}\\s*([,)])`, 'g'), `, ${t}()$1`);
  content = content.replace(new RegExp(`\\b${t}\\s*\\?`, 'g'), `${t}() ?`);
});

// 5. React imports, hooks and syntax replacements
content = content.replace(/import\s*React,\s*\{\s*useState,\s*useEffect,\s*useRef\s*\}\s*from\s*['"]react['"];?/g, 
  "import { createSignal, createEffect, onCleanup, createMemo } from 'solid-js';");
content = content.replace(/import\s*\{\s*useState,\s*useEffect,\s*useRef\s*\}\s*from\s*['"]react['"];?/g, 
  "import { createSignal, createEffect, onCleanup, createMemo } from 'solid-js';");
content = content.replace(/import\s*\{\s*useState,\s*useEffect\s*\}\s*from\s*['"]react['"];?/g, 
  "import { createSignal, createEffect, onCleanup, createMemo } from 'solid-js';");

// Convert useState to createSignal
content = content.replace(/useState\(([^)]*)\)/g, "createSignal($1)");
content = content.replace(/useEffect\(/g, "createEffect(");

// Clean class attributes
content = content.replace(/className=/g, "class=");
content = content.replace(/htmlFor=/g, "for=");

// Restore CRLF for Windows
content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully completed full migration of App.tsx');
