import { UserPermission, UserRights } from '../types';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { storageService } from './storageService';

export const permissionService = {
  pushPermissionsToCloud: async (list: UserPermission[]) => {
    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const savePromises = list.map(async (item) => {
          const docId = appwrite.getEmailDocId(item.email);
          await appwrite.saveGlobalConfig(databaseId, docId, item);
        });
        await Promise.all(savePromises);
        console.log('Successfully synced user permission states to Appwrite Database.');
      } catch (e) {
        console.warn("Could not sync user permission configurations to database:", e);
      }
    }
  },

  getCurrentUserRights(
    currentUser: any,
    userRightsList: UserPermission[]
  ): UserRights {
    if (!currentUser) {
      return {
        isAdmin: false,
        organizationId: '',
        isApproved: false,
        phone: '',
        isEmailVerified: false,
        isPhoneVerified: false,
        canViewTrips: false, canEditTrips: false, canDeleteTrips: false,
        canViewTyres: false, canEditTyres: false, canDeleteTyres: false,
        canViewTrucks: false, canEditTrucks: false, canDeleteTrucks: false,
        canViewDrivers: false, canEditDrivers: false, canDeleteDrivers: false,
        canViewOffices: false, canEditOffices: false, canDeleteOffices: false,
        canViewAccounts: false, canEditAccounts: false, canDeleteAccounts: false,
        canViewExpenses: false, canEditExpenses: false, canDeleteExpenses: false,
        canViewBackend: false, canAddBackend: false, canEditBackend: false, canDeleteBackend: false, canApproveBackend: false,
        canViewTruckRequests: false, canDeleteTruckRequests: false, canViewBackendTeam: false, canDeleteBackendTeam: false,
        canViewDatabaseConsole: false, canEditDatabaseConsole: false, canDeleteDatabaseConsole: false,
        canEditLoans: false, canDeleteLoans: false
      };
    }
    const email = (currentUser.email || '').toLowerCase().trim();
    const match = userRightsList.find(ur => ur.email.toLowerCase().trim() === email);
    if (match) {
      const isSuper = match.role === 'SuperAdmin' || match.organizationId === 'org_backend';
      const isPrimarySuperAdmin = match.role === 'SuperAdmin';
      return {
        isAdmin: match.role === 'Admin' || isSuper,
        isSuperAdmin: isSuper,
        organizationId: match.organizationId,
        isApproved: match.isApproved || (isAppwriteConfigured() && !!match.organizationId && match.organizationId !== 'org_default'),
        phone: match.phone || '',
        isEmailVerified: !!match.isEmailVerified || currentUser.emailVerification === true,
        isPhoneVerified: !!match.isPhoneVerified || currentUser.phoneVerification === true,
        is2FAEnabled: !!match.is2FAEnabled,
        twoFactorSecret: match.twoFactorSecret || '',
        canViewTrips: isSuper ? false : match.canViewTrips,
        canEditTrips: isSuper ? false : match.canEditTrips,
        canDeleteTrips: isSuper ? false : match.canDeleteTrips,
        canViewTyres: isSuper ? false : match.canViewTyres,
        canEditTyres: isSuper ? false : match.canEditTyres,
        canDeleteTyres: isSuper ? false : match.canDeleteTyres,
        canViewTrucks: isSuper ? false : match.canViewTrucks,
        canEditTrucks: isSuper ? false : match.canEditTrucks,
        canDeleteTrucks: isSuper ? false : match.canDeleteTrucks,
        canViewDrivers: isSuper ? false : match.canViewDrivers,
        canEditDrivers: isSuper ? false : match.canEditDrivers,
        canDeleteDrivers: isSuper ? false : match.canDeleteDrivers,
        canViewOffices: isSuper ? false : match.canViewOffices,
        canEditOffices: isSuper ? false : match.canEditOffices,
        canDeleteOffices: isSuper ? false : match.canDeleteOffices,
        canViewAccounts: isSuper ? false : match.canViewAccounts,
        canEditAccounts: isSuper ? false : match.canEditAccounts,
        canDeleteAccounts: isSuper ? false : match.canDeleteAccounts,
        canViewExpenses: isSuper ? false : match.canViewExpenses,
        canEditExpenses: isSuper ? false : match.canEditExpenses,
        canDeleteExpenses: isSuper ? false : match.canDeleteExpenses,
        canViewBackend: isSuper ? (isPrimarySuperAdmin || !!match.canViewBackend) : false,
        canAddBackend: isSuper ? (isPrimarySuperAdmin || !!match.canAddBackend) : false,
        canEditBackend: isSuper ? (isPrimarySuperAdmin || !!match.canEditBackend) : false,
        canDeleteBackend: isSuper ? (isPrimarySuperAdmin || !!match.canDeleteBackend) : false,
        canApproveBackend: isSuper ? (isPrimarySuperAdmin || !!match.canApproveBackend) : false,
        canViewTruckRequests: isSuper ? (isPrimarySuperAdmin || !!match.canViewTruckRequests) : false,
        canDeleteTruckRequests: isSuper ? (isPrimarySuperAdmin || !!match.canDeleteTruckRequests) : false,
        canViewBackendTeam: isSuper ? (isPrimarySuperAdmin || !!match.canViewBackendTeam) : false,
        canDeleteBackendTeam: isSuper ? (isPrimarySuperAdmin || !!match.canDeleteBackendTeam) : false,
        canViewDatabaseConsole: isSuper ? (isPrimarySuperAdmin || !!match.canViewDatabaseConsole) : false,
        canEditDatabaseConsole: isSuper ? (isPrimarySuperAdmin || !!match.canEditDatabaseConsole) : false,
        canDeleteDatabaseConsole: isSuper ? (isPrimarySuperAdmin || !!match.canDeleteDatabaseConsole) : false,
        canEditLoans: isSuper ? false : (match.role === 'Admin' || !!match.canEditLoans),
        canDeleteLoans: isSuper ? false : (match.role === 'Admin' || !!match.canDeleteLoans)
      };
    }

    return {
      isAdmin: false,
      organizationId: '',
      isApproved: false,
      phone: '',
      isEmailVerified: false,
      isPhoneVerified: false,
      canViewTrips: false, canEditTrips: false, canDeleteTrips: false,
      canViewTyres: false, canEditTyres: false, canDeleteTyres: false,
      canViewTrucks: false, canEditTrucks: false, canDeleteTrucks: false,
      canViewDrivers: false, canEditDrivers: false, canDeleteDrivers: false,
      canViewOffices: false, canEditOffices: false, canDeleteOffices: false,
      canViewAccounts: false, canEditAccounts: false, canDeleteAccounts: false,
      canViewExpenses: false, canEditExpenses: false, canDeleteExpenses: false,
      canViewBackend: false, canAddBackend: false, canEditBackend: false, canDeleteBackend: false, canApproveBackend: false,
      canViewTruckRequests: false, canDeleteTruckRequests: false, canViewBackendTeam: false, canDeleteBackendTeam: false,
      canViewDatabaseConsole: false, canEditDatabaseConsole: false, canDeleteDatabaseConsole: false,
      canEditLoans: false, canDeleteLoans: false
    };
  }
};
