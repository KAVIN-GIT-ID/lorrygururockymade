import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Global mock for Recharts
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }: any) => {
      // Mock responsive container by calling children function with fake dimensions
      if (typeof children === 'function') {
        return children({ width: 400, height: 300 });
      }
      return React.createElement('div', { 'data-testid': 'ResponsiveContainer' }, children);
    },
    BarChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'BarChart' }, children),
    Bar: () => React.createElement('div', { 'data-testid': 'Bar' }),
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    LineChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'LineChart' }, children),
    Line: () => React.createElement('div', { 'data-testid': 'Line' }),
    PieChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'PieChart' }, children),
    Pie: () => React.createElement('div', { 'data-testid': 'Pie' }),
    Cell: () => null,
    AreaChart: ({ children }: any) => React.createElement('div', { 'data-testid': 'AreaChart' }, children),
    Area: () => React.createElement('div', { 'data-testid': 'Area' }),
  };
});

// Global mock for Appwrite Service
vi.mock('../lib/appwrite', () => {
  return {
    isAppwriteConfigured: () => false, // Default to false to enable local storage testing by default
    appwrite: {
      initSession: vi.fn().mockResolvedValue(null),
      login: vi.fn().mockResolvedValue({ email: 'admin@test.com', name: 'Test Admin' }),
      logout: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue(null),
      getUserTeams: vi.fn().mockResolvedValue([]),
      listFleetDocuments: vi.fn().mockResolvedValue([]),
      saveFleetDocument: vi.fn().mockResolvedValue('doc-id'),
      deleteFleetDocument: vi.fn().mockResolvedValue(true),
      listGlobalConfigs: vi.fn().mockImplementation(async () => [
        {
          $id: 'config-user-admin',
          key: 'usr_admin_test_com',
          data: JSON.stringify({
            id: 'ur-admin',
            email: 'admin@test.com',
            name: 'Test Admin',
            role: 'Admin',
            organizationId: 'org_test',
            isApproved: true,
            canViewTrips: true, canEditTrips: true, canDeleteTrips: true,
            canViewTyres: true, canEditTyres: true, canDeleteTyres: true,
            canViewTrucks: true, canEditTrucks: true, canDeleteTrucks: true,
            canViewDrivers: true, canEditDrivers: true, canDeleteDrivers: true,
            canViewOffices: true, canEditOffices: true, canDeleteOffices: true,
            canViewAccounts: true, canEditAccounts: true, canDeleteAccounts: true,
            canViewExpenses: true, canEditExpenses: true, canDeleteExpenses: true
          })
        },
        {
          $id: 'config-profile-org_test',
          key: 'prf_org_test',
          data: JSON.stringify({
            organizationId: 'org_test',
            organizationName: 'Test Logistics Corp',
            ownerEmail: 'admin@test.com',
            status: 'Active',
            maxTrucksAllowed: 10,
            truckRequests: []
          })
        }
      ]),
      saveGlobalConfig: vi.fn().mockResolvedValue('config-id'),
      deleteGlobalConfig: vi.fn().mockResolvedValue(true),
      inviteToTeam: vi.fn().mockResolvedValue({}),
      removeMembership: vi.fn().mockResolvedValue(true),
      getTeamMemberships: vi.fn().mockImplementation(async () => [
        { userEmail: 'admin@test.com', roles: ['owner'] }
      ]),
      getEmailDocId: (email: string) => `usr_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      getOrgDocId: (orgId: string) => `prf_${orgId}`,
      uploadFile: vi.fn().mockResolvedValue('mock-file-id'),
      deleteFile: vi.fn().mockResolvedValue(true),
      getFileView: vi.fn().mockReturnValue('https://sgp.cloud.appwrite.io/v1/storage/buckets/mock-bucket/files/mock-file-id/view'),
      getFileDownload: vi.fn().mockReturnValue('https://sgp.cloud.appwrite.io/v1/storage/buckets/mock-bucket/files/mock-file-id/download'),
    }
  };
});
