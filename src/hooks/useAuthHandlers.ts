import { createSignal, createEffect } from 'solid-js';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { UserPermission } from '../types';

export function useAuthHandlers(
  currentUser: () => any,
  setCurrentUser: (user: any) => void,
  userRightsList: () => UserPermission[],
  setUserRightsList: (list: UserPermission[]) => void,
  organizationProfiles: () => any[],
  setOrganizationProfiles: (profiles: any[]) => void,
  saveOrganizationProfiles: (profiles: any[]) => Promise<void>,
  setTrucks: (trucks: any[]) => void,
  setDrivers: (drivers: any[]) => void,
  setOffices: (offices: any[]) => void,
  setAccounts: (accounts: any[]) => void,
  setTrips: (trips: any[]) => void,
  setExpenses: (expenses: any[]) => void,
  setTyres: (tyres: any[]) => void,
  setAuditLogs: (logs: any[]) => void,
  showNotification: (msg: string) => void,
  navigate: (path: string) => void,
  setLoadingUser: (loading: boolean) => void,
  logAction: (action: string, cat: string, ref: string, details: string, orgId?: string) => void,
  setResetPasswordState: (state: any) => void,
  reconcileSession: (user: any) => Promise<any>,
  currentUserRights: () => any,
  pushPermissionsToCloud: (list: UserPermission[]) => Promise<any>,
  setUserVoiceLang: (lang: string) => void,
  setProfileModalOpen: (open: boolean) => void
) {
  const [emailVerificationSuccess, setEmailVerificationSuccess] = createSignal(false);
  const [emailVerificationError, setEmailVerificationError] = createSignal<string | null>(null);

  const handleEmailVerificationRedirect = async (userId: string, secret: string) => {
    setLoadingUser(true);
    try {
      if (isAppwriteConfigured()) {
        await appwrite.updateVerification(userId, secret);
        showNotification("Email verified successfully! You can now log in.");

        const user = await appwrite.getCurrentUser();
        if (user) {
          await reconcileSession(user);
        }
      } else {
        showNotification("Mock Email verified successfully!");
        if (currentUser()) {
          const email = (currentUser().email || '').toLowerCase().trim();
          const updated = userRightsList().map(ur =>
            ur.email.toLowerCase().trim() === email ? { ...ur, isEmailVerified: true } : ur
          );
          setUserRightsList(updated);
          localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
        }
      }
      setEmailVerificationSuccess(true);
    } catch (err: any) {
      console.error("Email verification failure:", err);
      setEmailVerificationError(err.message || err);
      showNotification(`Email verification failed: ${err.message || err}`);
    } finally {
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      setLoadingUser(false);
    }
  };

  createEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const userId = params.get('userId');
    const secret = params.get('secret');

    if (mode === 'recovery' && userId && secret) {
      setResetPasswordState({ active: true, userId, secret });
    } else if (mode === 'verify' && userId && secret) {
      handleEmailVerificationRedirect(userId, secret);
    }
  });

  const handleLogout = async () => {
    try {
      await appwrite.logout();
    } catch (err) {
      console.warn("Appwrite logout error:", err);
    }
    setCurrentUser(null);
    localStorage.clear();
    sessionStorage.clear();

    try {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + window.location.hostname.split('.').slice(-2).join('.');
      }
    } catch (cookieErr) {
      console.warn("Error clearing cookies on logout:", cookieErr);
    }

    setTrucks([]);
    setDrivers([]);
    setOffices([]);
    setAccounts([]);
    setTrips([]);
    setExpenses([]);
    setTyres([]);
    setAuditLogs([]);
    setUserRightsList([]);
    setOrganizationProfiles([]);
    showNotification('Logged out successfully.');
    navigate('/');
  };

  const handleUpdateProfile = async (
    newName: string,
    newOrgName?: string,
    newPassword?: string,
    oldPassword?: string,
    kycDetails?: { gst?: string; pan?: string; aadhaar?: string; address?: string }
  ) => {
    try {
      const loginMethod = localStorage.getItem('ttt_login_method');
      if (loginMethod === 'appwrite') {
        if (newName.trim() && newName.trim() !== currentUser()?.name) {
          await appwrite.updateName(newName.trim());
        }
        if (newPassword && oldPassword) {
          await appwrite.updatePassword(newPassword, oldPassword);
        }
        if (newPassword) {
          logAction('Edited', 'Password', (currentUser()?.email || '').toLowerCase().trim(), `Your account password was updated successfully.`, currentUserRights()?.organizationId || '');
        }
      }

      const updatedUser = {
        ...currentUser(),
        name: newName.trim()
      };
      setCurrentUser(updatedUser);

      const email = (currentUser()?.email || '').toLowerCase().trim();
      const updatedRightsList = userRightsList().map(ur =>
        ur.email.toLowerCase().trim() === email
          ? { ...ur, name: newName.trim() }
          : ur
      );
      setUserRightsList(updatedRightsList);
      localStorage.setItem('ttt_user_rights', JSON.stringify(updatedRightsList));

      if (isAppwriteConfigured()) {
        await pushPermissionsToCloud(updatedRightsList);
      }

      const currentOrgId = currentUserRights()?.organizationId || '';
      if (currentUserRights().isAdmin && currentOrgId) {
        const nextProfiles = organizationProfiles().map(p =>
          p.organizationId === currentOrgId
            ? {
              ...p,
              organizationName: newOrgName && newOrgName.trim() ? newOrgName.trim() : p.organizationName,
              gstNo: kycDetails?.gst?.trim() || p.gstNo || '',
              panNo: kycDetails?.pan?.trim() || p.panNo || '',
              aadhaarNo: kycDetails?.aadhaar?.trim() || p.aadhaarNo || '',
              address: kycDetails?.address?.trim() || p.address || ''
            }
            : p
        );
        await saveOrganizationProfiles(nextProfiles);
      }

      showNotification("Profile updated successfully!");
      setProfileModalOpen(false);
    } catch (err: any) {
      console.error("DEBUG PROFILE UPDATE ERROR:", err);
      alert(`Error updating profile: ${err.message || 'Operation failed'}`);
    }
  };

  return {
    handleEmailVerificationRedirect,
    handleLogout,
    handleUpdateProfile,
    emailVerificationError,
    emailVerificationSuccess,
    setEmailVerificationSuccess,
    setEmailVerificationError
  };
}
