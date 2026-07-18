import { createSignal, Accessor } from 'solid-js';
import { UserPermission } from '../types';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { migrateUserPermissions } from '../lib/migrations';
import { organizationService } from '../services/organizationService';

// Reconciles local user permission state and ensures organization profiles are generated/reconciled correctly
export function reconcileOrganizationProfiles(
  rightsList: UserPermission[],
  existingProfiles: any[],
  customNames: Record<string, string> = {}
): any[] {
  const orgMap = new Map<string, string>();
  rightsList.forEach(r => {
    if (r.organizationId && r.organizationId !== 'org_default' && r.organizationId !== 'org_backend') {
      const name = customNames[r.organizationId] || r.organizationId;
      orgMap.set(r.organizationId, name);
    }
  });

  const updatedProfiles = [...existingProfiles];
  orgMap.forEach((name, orgId) => {
    const existingIdx = updatedProfiles.findIndex(p => p.organizationId === orgId);
    if (existingIdx > -1) {
      if (customNames[orgId]) {
        updatedProfiles[existingIdx] = { ...updatedProfiles[existingIdx], organizationName: name };
      }
    } else {
      updatedProfiles.push({
        id: 'prf_' + orgId,
        organizationId: orgId,
        organizationName: name,
        status: 'Active',
        limit: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  });
  return updatedProfiles;
}

export function useUserManagement(
  currentUser: Accessor<any>,
  userRightsList: Accessor<UserPermission[]>,
  setUserRightsList: (list: UserPermission[]) => void,
  organizationProfiles: Accessor<any[]>,
  setOrganizationProfiles: (profiles: any[]) => void,
  saveOrganizationProfiles: (profiles: any[]) => Promise<void>,
  pushPermissionsToCloud: (list: UserPermission[], userEmail?: string) => Promise<void>,
  reconcileSession: (user: any) => Promise<any>,
  showNotification: (msg: string) => void,
  setVerificationOtpSent: (sent: boolean) => void,
  setPhoneTimer: (timer: number) => void,
  setShowPhoneUpdateModal: (open: boolean) => void,
  setWhatsappOtpCode: (code: string | null) => void,
  setWhatsappOtpPhone: (phone: string | null) => void
) {
  const checkUserApproval = (email: string): { approved: boolean; orgId: string; registered: boolean } => {
    const match = userRightsList().find(ur => ur.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (match) {
      return { approved: match.isApproved, orgId: match.organizationId, registered: true };
    }
    return { approved: false, orgId: '', registered: false };
  };

  const sendWhatsAppOTP = async (phone: string) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    let gatewayHost = window.location.hostname;
    let gatewayProtocol = window.location.protocol;
    let useSubpath = false;

    const appwriteEndpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || '';
    if (appwriteEndpoint.includes('//')) {
      gatewayHost = appwriteEndpoint.split('//')[1].split('/')[0].split(':')[0];
      gatewayProtocol = appwriteEndpoint.split('//')[0];
      useSubpath = true;
    }

    const gatewayUrl = useSubpath
      ? `${gatewayProtocol}//${gatewayHost}/whatsapp-gateway/send-otp`
      : `${gatewayProtocol}//${gatewayHost}:8000/send-otp`;
    console.info(`[WhatsAppOTP] Requesting delivery of OTP: ${otp} to ${phone} via ${gatewayUrl}`);

    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKey: 'ft_92hf83hdkw9812hskd',
        phone: cleanPhone,
        code: otp
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to dispatch WhatsApp OTP.');
    }

    setWhatsappOtpCode(otp);
    setWhatsappOtpPhone(phone);
    sessionStorage.setItem('whatsapp_otp_code', otp);
    sessionStorage.setItem('whatsapp_otp_phone', phone);
    return otp;
  };

  const handlePhoneUpdateSubmit = async (e: Event) => {
    e.preventDefault();
    const target = e.target as any;
    const newPhone = target.newPhone.value.trim();
    const currentPassword = isAppwriteConfigured() ? target.currentPassword.value : '';

    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(newPhone)) {
      showNotification("Invalid phone number format. Must start with '+' and follow E.164 (e.g. +919876543210).");
      return;
    }

    try {
      if (isAppwriteConfigured()) {
        await appwrite.updatePhone(newPhone, currentPassword);

        const freshUser = await appwrite.getCurrentUser();
        if (freshUser) {
          await reconcileSession(freshUser);
        }

        const email = (currentUser().email || '').toLowerCase().trim();
        const updated = userRightsList().map(ur =>
          ur.email.toLowerCase().trim() === email ? { ...ur, phone: newPhone, isPhoneVerified: freshUser?.phoneVerification === true } : ur
        );
        setUserRightsList(updated);
        localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
        await pushPermissionsToCloud(updated);

        if (freshUser?.phoneVerification === true) {
          showNotification("Mobile number updated and automatically verified!");
        } else {
          await sendWhatsAppOTP(newPhone);
          setVerificationOtpSent(true);
          showNotification("Mobile number saved and verification OTP sent successfully via WhatsApp!");
        }
      } else {
        const email = (currentUser().email || '').toLowerCase().trim();
        const updated = userRightsList().map(ur =>
          ur.email.toLowerCase().trim() === email ? { ...ur, phone: newPhone } : ur
        );
        setUserRightsList(updated);
        localStorage.setItem('ttt_user_rights', JSON.stringify(updated));
        setVerificationOtpSent(true);
        showNotification("Mobile number saved and verification OTP sent successfully!");
      }

      setPhoneTimer(120);
      setShowPhoneUpdateModal(false);
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed to update mobile number: ${err.message || err}`);
    }
  };

  const handleRegisterUserPermissions = async (
    name: string,
    email: string,
    phone: string,
    orgId: string,
    orgName?: string,
    dryRun = false
  ): Promise<{ approved: boolean; orgId: string; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOrgId = orgId.trim();
    const trimmedOrgName = (orgName || '').trim();

    let activeRights = userRightsList();
    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const data = await organizationService.fetchAllGlobalConfigs(databaseId);
        if (data && data.userRightsList && Array.isArray(data.userRightsList)) {
          const cloudRights = migrateUserPermissions(data.userRightsList);
          setUserRightsList(cloudRights);
          localStorage.setItem('ttt_user_rights', JSON.stringify(cloudRights));
          activeRights = cloudRights;
        } else {
          setUserRightsList([]);
          localStorage.setItem('ttt_user_rights', JSON.stringify([]));
          activeRights = [];
        }
      } catch (e) {
        console.warn("Could not load latest cloud snapshot during registration validation/init:", e);
      }
    }

    const existingMatch = activeRights.find(ur => ur.email.toLowerCase().trim() === trimmedEmail);
    if (existingMatch && existingMatch.organizationId && existingMatch.organizationId !== 'org_default') {
      return {
        approved: false,
        orgId: '',
        error: `Email address "${email}" is already associated with organization "${existingMatch.organizationId}". Please log in instead.`
      };
    }

    const cleanPhone = phone.trim().replace(/[^0-9+]/g, '');
    const phoneMatch = activeRights.find(ur => (ur.phone || '').trim().replace(/[^0-9+]/g, '') === cleanPhone);
    if (phoneMatch && cleanPhone) {
      return {
        approved: false,
        orgId: '',
        error: `Mobile number "${phone}" is already registered with another user account. Please check and choose a different number.`
      };
    }

    let targetOrgId = trimmedOrgId;

    if (trimmedOrgName.toLowerCase() === 'org_backend') {
      targetOrgId = 'org_backend';
    } else if (trimmedOrgId === 'JOIN_REQUEST') {
      let activeProfiles = organizationProfiles();
      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const data = await organizationService.fetchAllGlobalConfigs(databaseId);
          if (data && data.organizationProfiles && Array.isArray(data.organizationProfiles)) {
            activeProfiles = data.organizationProfiles;
          }
        } catch (e) {
          console.warn("Could not load latest profiles during join match:", e);
        }
      }

      const matchedProfile = activeProfiles.find(p =>
        p.organizationName.toLowerCase().trim() === trimmedOrgName.toLowerCase() ||
        p.organizationId.toLowerCase().trim() === trimmedOrgName.toLowerCase()
      );
      if (!matchedProfile) {
        return { approved: false, orgId: '', error: `No organization named "${trimmedOrgName}" was found. Please check spelling or contact Admin.` };
      }
      targetOrgId = matchedProfile.organizationId;
    } else if (trimmedOrgId === '') {
      let activeProfiles = organizationProfiles();
      if (isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const data = await organizationService.fetchAllGlobalConfigs(databaseId);
          if (data && data.organizationProfiles && Array.isArray(data.organizationProfiles)) {
            activeProfiles = data.organizationProfiles;
          }
        } catch (e) {
          console.warn("Could not load latest profiles during creation match:", e);
        }
      }

      const nameExists = activeProfiles.some(p => p.organizationName.toLowerCase().trim() === trimmedOrgName.toLowerCase());
      if (nameExists) {
        return { approved: false, orgId: '', error: `Organization name "${trimmedOrgName}" is already registered. Please choose a different unique name.` };
      }
    }

    if (targetOrgId) {
      const isBackendOrg = targetOrgId === 'org_backend';
      const backendOrgHasUsers = activeRights.some(ur => ur.organizationId === 'org_backend');
      const orgIsValid = true;

      const isApproved = isBackendOrg ? !backendOrgHasUsers : false;
      const targetRole = isBackendOrg ? 'SuperAdmin' : 'Custom';

      if (dryRun) {
        return {
          approved: isApproved,
          orgId: targetOrgId
        };
      }

      const newPerm: UserPermission = {
        id: 'ur_' + Date.now(),
        email: trimmedEmail,
        name: name.trim(),
        phone: phone.trim(),
        isEmailVerified: false,
        isPhoneVerified: false,
        role: targetRole as any,
        organizationId: targetOrgId,
        isApproved: isApproved,
        canViewTrips: isBackendOrg, canEditTrips: isBackendOrg, canDeleteTrips: isBackendOrg,
        canViewTyres: isBackendOrg, canEditTyres: isBackendOrg, canDeleteTyres: isBackendOrg,
        canViewTrucks: isBackendOrg, canEditTrucks: isBackendOrg, canDeleteTrucks: isBackendOrg,
        canViewDrivers: isBackendOrg, canEditDrivers: isBackendOrg, canDeleteDrivers: isBackendOrg,
        canViewOffices: isBackendOrg, canEditOffices: isBackendOrg, canDeleteOffices: isBackendOrg,
        canViewAccounts: isBackendOrg, canEditAccounts: isBackendOrg, canDeleteAccounts: isBackendOrg,
        canViewExpenses: isBackendOrg, canEditExpenses: isBackendOrg, canDeleteExpenses: isBackendOrg
      };
      const updatedList = activeRights.some(ur => ur.email.toLowerCase().trim() === trimmedEmail)
        ? activeRights.map(ur => ur.email.toLowerCase().trim() === trimmedEmail ? newPerm : ur)
        : [...activeRights, newPerm];
      setUserRightsList(updatedList);
      localStorage.setItem('ttt_user_rights', JSON.stringify(updatedList));

      const reconciled = reconcileOrganizationProfiles(
        updatedList, organizationProfiles(),
        trimmedOrgName && targetOrgId ? { [targetOrgId]: trimmedOrgName } : {}
      );
      await saveOrganizationProfiles(reconciled);

      await pushPermissionsToCloud(updatedList, trimmedEmail);
      return { approved: isApproved, orgId: targetOrgId };
    } else {
      let finalOrgId = '';
      const cleanSlug = trimmedOrgName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const uniqueSuffix = Math.random().toString(36).substring(2, 6);
      const localSlug = `org_${cleanSlug || 'company'}_${uniqueSuffix}`;

      if (dryRun) {
        return { approved: true, orgId: '' };
      }

      if (isAppwriteConfigured()) {
        try {
          const teamId = await appwrite.createTeam(trimmedOrgName);
          if (teamId) {
            finalOrgId = teamId;
            console.info(`Created Appwrite Team "${trimmedOrgName}" with ID: ${teamId}`);
          } else {
            return {
              approved: false,
              orgId: '',
              error: 'Failed to create your organization team in Appwrite. Please verify your connection.'
            };
          }
        } catch (e: any) {
          console.error('Appwrite createTeam failed:', e);
          return {
            approved: false,
            orgId: '',
            error: `Failed to create Organization Team in Appwrite: ${e.message || e}`
          };
        }
      } else {
        finalOrgId = localSlug;
      }

      const newPerm: UserPermission = {
        id: 'ur_' + Date.now(),
        email: trimmedEmail,
        name: name.trim(),
        phone: phone.trim(),
        isEmailVerified: false,
        isPhoneVerified: false,
        role: 'Admin',
        organizationId: finalOrgId,
        isApproved: true,
        canViewTrips: true, canEditTrips: true, canDeleteTrips: true,
        canViewTyres: true, canEditTyres: true, canDeleteTyres: true,
        canViewTrucks: true, canEditTrucks: true, canDeleteTrucks: true,
        canViewDrivers: true, canEditDrivers: true, canDeleteDrivers: true,
        canViewOffices: true, canEditOffices: true, canDeleteOffices: true,
        canViewAccounts: true, canEditAccounts: true, canDeleteAccounts: true,
        canViewExpenses: true, canEditExpenses: true, canDeleteExpenses: true
      };
      const updatedList = activeRights.some(ur => ur.email.toLowerCase().trim() === trimmedEmail)
        ? activeRights.map(ur => ur.email.toLowerCase().trim() === trimmedEmail ? newPerm : ur)
        : [...activeRights, newPerm];
      setUserRightsList(updatedList);
      localStorage.setItem('ttt_user_rights', JSON.stringify(updatedList));

      const reconciled = reconcileOrganizationProfiles(
        updatedList, organizationProfiles(),
        { [finalOrgId]: trimmedOrgName }
      );
      await saveOrganizationProfiles(reconciled);

      const newOrgProfile = reconciled.find(p => p.organizationId === finalOrgId);
      if (newOrgProfile && isAppwriteConfigured()) {
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const docId = appwrite.getOrgDocId(finalOrgId);
          await appwrite.saveGlobalConfig(databaseId, docId, newOrgProfile);
        } catch (e) {
          console.error("Could not save new organization profile directly to Appwrite:", e);
        }
      }

      await pushPermissionsToCloud(updatedList, trimmedEmail);
      return { approved: true, orgId: finalOrgId };
    }
  };

  const handleRequestToJoinOrganization = async (newOrgId: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser()) return { success: false, error: 'No active session found.' };
    const trimmedOrgId = newOrgId.trim();
    const email = (currentUser().email || '').toLowerCase().trim();

    if (!trimmedOrgId) {
      return { success: false, error: 'Please enter a valid Organization ID.' };
    }

    let activeRights = userRightsList();
    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const data = await organizationService.fetchAllGlobalConfigs(databaseId);
        if (data && data.userRightsList && Array.isArray(data.userRightsList)) {
          const cloudRights = migrateUserPermissions(data.userRightsList);
          setUserRightsList(cloudRights);
          localStorage.setItem('ttt_user_rights', JSON.stringify(cloudRights));
          activeRights = cloudRights;
        }
      } catch (e) {
        console.warn("Could not load latest cloud snapshot during organization change:", e);
      }
    }

    const isBackendOrg = trimmedOrgId === 'org_backend';
    const backendOrgHasUsers = activeRights.some(ur => ur.organizationId === 'org_backend');
    const orgIsValid = activeRights.some(ur => ur.organizationId === trimmedOrgId)
      || trimmedOrgId === 'org_default'
      || isBackendOrg;

    if (!orgIsValid) {
      return { success: false, error: 'The specified Organization ID does not exist. Please check and try again.' };
    }

    let updatedList: UserPermission[] = [];
    const existingMatch = activeRights.find(ur => ur.email.toLowerCase().trim() === email);

    const isApproved = isBackendOrg ? !backendOrgHasUsers : false;
    const targetRole = isBackendOrg ? 'SuperAdmin' : 'Custom';

    if (existingMatch) {
      if (existingMatch.organizationId && existingMatch.organizationId !== trimmedOrgId && isAppwriteConfigured()) {
        try {
          console.info(`User leaving old Appwrite team: ${existingMatch.organizationId}`);
          await appwrite.leaveTeam(existingMatch.organizationId);
        } catch (leaveErr) {
          console.warn("Failed to automatically leave old Appwrite team:", leaveErr);
        }
      }

      const updatedMatch: UserPermission = {
        ...existingMatch,
        organizationId: trimmedOrgId,
        isApproved: isApproved,
        role: targetRole as any,
        canViewTrips: isBackendOrg, canEditTrips: isBackendOrg, canDeleteTrips: isBackendOrg,
        canViewTyres: isBackendOrg, canEditTyres: isBackendOrg, canDeleteTyres: isBackendOrg,
        canViewTrucks: isBackendOrg, canEditTrucks: isBackendOrg, canDeleteTrucks: isBackendOrg,
        canViewDrivers: isBackendOrg, canEditDrivers: isBackendOrg, canDeleteDrivers: isBackendOrg,
        canViewOffices: isBackendOrg, canEditOffices: isBackendOrg, canDeleteOffices: isBackendOrg,
        canViewAccounts: isBackendOrg, canEditAccounts: isBackendOrg, canDeleteAccounts: isBackendOrg,
        canViewExpenses: isBackendOrg, canEditExpenses: isBackendOrg, canDeleteExpenses: isBackendOrg
      };
      updatedList = activeRights.map(ur =>
        ur.email.toLowerCase().trim() === email ? updatedMatch : ur
      );
    } else {
      const newPerm: UserPermission = {
        id: 'ur_' + Date.now(),
        email,
        name: currentUser().name || email,
        role: targetRole as any,
        organizationId: trimmedOrgId,
        isApproved: isApproved,
        canViewTrips: isBackendOrg, canEditTrips: isBackendOrg, canDeleteTrips: isBackendOrg,
        canViewTyres: isBackendOrg, canEditTyres: isBackendOrg, canDeleteTyres: isBackendOrg,
        canViewTrucks: isBackendOrg, canEditTrucks: isBackendOrg, canDeleteTrucks: isBackendOrg,
        canViewDrivers: isBackendOrg, canEditDrivers: isBackendOrg, canDeleteDrivers: isBackendOrg,
        canViewOffices: isBackendOrg, canEditOffices: isBackendOrg, canDeleteOffices: isBackendOrg,
        canViewAccounts: isBackendOrg, canEditAccounts: isBackendOrg, canDeleteAccounts: isBackendOrg,
        canViewExpenses: isBackendOrg, canEditExpenses: isBackendOrg, canDeleteExpenses: isBackendOrg
      };
      updatedList = [...activeRights, newPerm];
    }

    setUserRightsList(updatedList);
    localStorage.setItem('ttt_user_rights', JSON.stringify(updatedList));

    const reconciled = reconcileOrganizationProfiles(updatedList, organizationProfiles());
    await saveOrganizationProfiles(reconciled);

    await pushPermissionsToCloud(updatedList, email);
    await reconcileSession(currentUser());
    return { success: true };
  };

  return {
    checkUserApproval,
    sendWhatsAppOTP,
    handlePhoneUpdateSubmit,
    handleRegisterUserPermissions,
    handleRequestToJoinOrganization
  };
}
