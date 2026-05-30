import { 
  TripEntry, 
  UserPermission, 
  Truck, 
  Driver, 
  Office, 
  Account, 
  ExpenseEntry, 
  Tyre, 
  AuditLog, 
  SubTrip 
} from '../types';

export const migrateTripsIfNecessary = (list: any[]): TripEntry[] => {
  return list.map(trip => {
    if (trip.subTrips && Array.isArray(trip.subTrips)) {
      return trip as TripEntry;
    }

    const payments = trip.payments || [];
    const oldRental = Number(trip.rental) || Number(trip.income) || 0;
    const oldLoadingDate = trip.loadingDate || trip.startDate || '2026-05-10';
    const oldOffice = trip.officeName || 'Mumbai Port Logistics';

    const oldComm = Number(trip.commission) || 0;
    const oldLoadUnload = Number(trip.loadingUnloading) || 0;
    const oldMamul = Number(trip.officeMamul) || 0;

    const sub: SubTrip = {
      id: 'sub-migrated-' + trip.id,
      loadingDate: oldLoadingDate,
      officeName: oldOffice,
      routeFrom: 'Origin',
      routeTo: 'Destination',
      income: oldRental,
      loadingExpense: oldLoadUnload / 2 || 200,
      unloadingExpense: oldLoadUnload / 2 || 200,
      rtoExpense: oldMamul / 2 || 100,
      dieselLiters: 100,
      dieselRate: 95,
      dieselAmount: oldComm || 5000,
      addBlueExpense: 300,
      fastagExpense: 500,
      driverWages: 2000,
      otherExpense: 200,
      startingKM: Number(trip.startingKM) || 124500,
      endingKM: (Number(trip.startingKM) || 124500) + 400
    };

    const migrated: TripEntry = {
      id: trip.id,
      tripNo: trip.tripNo || 'TRIP-LEGACY',
      truckNo: trip.truckNo || 'MH-12-PQ-4532',
      startDate: oldLoadingDate,
      endDate: oldLoadingDate,
      driverName: trip.driverName || 'Jagdish Singh',
      startingKM: sub.startingKM,
      endingKM: sub.endingKM,
      payments: payments,
      subTrips: [sub],
      status: trip.status || 'Pending',
      notes: trip.notes || 'Migrated from legacy offline register.'
    };
    return migrated;
  });
};

export const migrateUserPermissions = (list: any[]): UserPermission[] => {
  return list.map(item => {
    if ('canViewTrips' in item) {
      return {
        canEditLoans: item.canEditLoans !== undefined ? item.canEditLoans : false,
        canDeleteLoans: item.canDeleteLoans !== undefined ? item.canDeleteLoans : false,
        ...item,
        organizationId: item.organizationId || 'org_default',
        isApproved: item.isApproved !== undefined ? item.isApproved : true
      } as UserPermission;
    }
    return {
      id: item.id,
      email: item.email,
      name: item.name,
      role: item.role || 'Custom',
      organizationId: item.organizationId || 'org_default',
      isApproved: item.isApproved !== undefined ? item.isApproved : true,
      canViewTrips: !!item.canManageTrips,
      canEditTrips: !!item.canManageTrips,
      canDeleteTrips: !!item.canManageTrips,
      canViewTyres: !!item.canManageTyres,
      canEditTyres: !!item.canManageTyres,
      canDeleteTyres: !!item.canManageTyres,
      canViewTrucks: !!item.canManageTrucks,
      canEditTrucks: !!item.canManageTrucks,
      canDeleteTrucks: !!item.canManageTrucks,
      canViewDrivers: !!item.canManageDrivers,
      canEditDrivers: !!item.canManageDrivers,
      canDeleteDrivers: !!item.canManageDrivers,
      canViewOffices: !!item.canManageOffices,
      canEditOffices: !!item.canManageOffices,
      canDeleteOffices: !!item.canManageOffices,
      canViewAccounts: !!item.canManageAccounts,
      canEditAccounts: !!item.canManageAccounts,
      canDeleteAccounts: !!item.canManageAccounts,
      canViewExpenses: !!item.canManageExpenses,
      canEditExpenses: !!item.canManageExpenses,
      canDeleteExpenses: !!item.canManageExpenses,
      canEditLoans: !!item.canManageTrucks,
      canDeleteLoans: !!item.canManageTrucks
    };
  });
};

export const migrateTrucks = (list: any[]): Truck[] => {
  return list.map(item => ({
    ...item,
    organizationId: item.organizationId || 'org_default',
    isApproved: item.isApproved !== false
  }));
};

export const migrateDrivers = (list: any[]): Driver[] => {
  return list.map(item => ({
    ...item,
    organizationId: item.organizationId || 'org_default'
  }));
};

export const migrateOffices = (list: any[]): Office[] => {
  return list.map(item => ({
    ...item,
    organizationId: item.organizationId || 'org_default'
  }));
};

export const migrateAccounts = (list: any[]): Account[] => {
  return list.map(item => ({
    ...item,
    organizationId: item.organizationId || 'org_default'
  }));
};

export const migrateTrips = (list: any[]): TripEntry[] => {
  return list.map(item => ({
    ...item,
    organizationId: item.organizationId || 'org_default'
  }));
};

export const migrateExpenses = (list: any[]): ExpenseEntry[] => {
  return list.map(item => ({
    ...item,
    organizationId: item.organizationId || 'org_default'
  }));
};

export const migrateTyres = (list: any[]): Tyre[] => {
  return list.map(item => ({
    ...item,
    organizationId: item.organizationId || 'org_default'
  }));
};

export const migrateAuditLogs = (list: any[]): AuditLog[] => {
  return list.map(item => ({
    ...item,
    organizationId: item.organizationId || 'org_default'
  }));
};
