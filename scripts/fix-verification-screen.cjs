const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/VerificationRequiredScreen.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\r\n/g, '\n');

// 1. Replace React.Dispatch types in props interface
content = content.replace(/setUserRightsList:\s*React\.Dispatch<React\.SetStateAction<UserPermission\[\]>>;?/g, 
  "setUserRightsList: (list: any) => void;");
content = content.replace(/setOrganizationProfiles:\s*React\.Dispatch<React\.SetStateAction<any\[\]>>;?/g, 
  "setOrganizationProfiles: (list: any) => void;");

// 2. Replace component declaration and destructuring
const oldDecl = `export const VerificationRequiredScreen: React.FC<VerificationRequiredScreenProps> = ({
  currentUser,
  currentUserRights,
  userRightsList,
  setUserRightsList,
  pushPermissionsToCloud,
  reconcileSession,
  showNotification,
  toastMessage,
  emailTimer,
  setEmailTimer,
  phoneTimer,
  setPhoneTimer,
  verificationOtpSent,
  setVerificationOtpSent,
  showPhoneUpdateModal,
  setShowPhoneUpdateModal,
  whatsappOtpCode,
  sendWhatsAppOTP,
  handlePhoneUpdateSubmit,
  handleLogout,
  setLoadingUser,
  setOrganizationProfiles
}) => {`;

const newDecl = `export function VerificationRequiredScreen(props: VerificationRequiredScreenProps) {
  const {
    currentUser,
    currentUserRights,
    userRightsList,
    setUserRightsList,
    pushPermissionsToCloud,
    reconcileSession,
    showNotification,
    toastMessage,
    emailTimer,
    setEmailTimer,
    phoneTimer,
    setPhoneTimer,
    verificationOtpSent,
    setVerificationOtpSent,
    showPhoneUpdateModal,
    setShowPhoneUpdateModal,
    whatsappOtpCode,
    sendWhatsAppOTP,
    handlePhoneUpdateSubmit,
    handleLogout,
    setLoadingUser,
    setOrganizationProfiles
  } = props;`;

content = content.replace(oldDecl, newDecl);

// 3. Fix defaultValue to value inside verification input
content = content.replace(/defaultValue=\{currentUserRights\.phone\s*\|\|\s*''\}/g, "value={currentUserRights.phone || ''}");

content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed VerificationRequiredScreen.tsx');
