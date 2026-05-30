import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from './App';
import * as appwriteModule from './lib/appwrite';

describe('App Component Root Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should render the LoginScreen when no session exists on startup', async () => {
    render(<App />);

    // By default, since no user session is mocked, it should display the LoginScreen
    expect(screen.getByText('FleetTrack Pro')).toBeInTheDocument();
    expect(screen.getByText('Log In to System')).toBeInTheDocument();
  });

  it('should render Dashboard and sidebar navigation when user session is active', async () => {
    // 1. Configure active Appwrite mode in mock
    vi.spyOn(appwriteModule, 'isAppwriteConfigured').mockReturnValue(true);

    // 2. Setup mock local storage session states
    localStorage.setItem('ttt_login_method', 'appwrite');
    localStorage.setItem('ttt_user_rights', JSON.stringify([
      {
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
      }
    ]));
    localStorage.setItem('ttt_organization_profiles', JSON.stringify([
      {
        organizationId: 'org_test',
        organizationName: 'Test Logistics Corp',
        ownerEmail: 'admin@test.com',
        status: 'Active',
        maxTrucksAllowed: 10,
        truckRequests: []
      }
    ]));

    // 3. Mock appwrite's getCurrentUser and getUserTeams
    const mockUser = {
      $id: 'usr-admin-id',
      email: 'admin@test.com',
      name: 'Test Admin',
    };
    vi.spyOn(appwriteModule.appwrite, 'getCurrentUser').mockResolvedValue(mockUser as any);
    vi.spyOn(appwriteModule.appwrite, 'getUserTeams').mockResolvedValue([
      { $id: 'org_test', name: 'Test Logistics Corp' }
    ] as any);

    render(<App />);

    // Wait for the async authentication effect to complete and loading screen to disappear
    await waitFor(() => {
      // Sidebar should display options
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Check header logo text and user initials
    expect(screen.getByText('FleetTrack Pro')).toBeInTheDocument();
    expect(screen.getByText('TA')).toBeInTheDocument(); // initials for "Test Admin"

    // Sidebar navigation tabs should render
    expect(screen.getByText('Trip Management')).toBeInTheDocument();
    expect(screen.getByText('Truck Registry')).toBeInTheDocument();
    expect(screen.getByText('Offices')).toBeInTheDocument();
  });

  it('should switch tabs correctly when clicking navigation items in the sidebar', async () => {
    // 1. Configure active session
    vi.spyOn(appwriteModule, 'isAppwriteConfigured').mockReturnValue(true);
    localStorage.setItem('ttt_login_method', 'appwrite');
    localStorage.setItem('ttt_user_rights', JSON.stringify([
      {
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
      }
    ]));
    localStorage.setItem('ttt_organization_profiles', JSON.stringify([
      {
        organizationId: 'org_test',
        organizationName: 'Test Logistics Corp',
        ownerEmail: 'admin@test.com',
        status: 'Active',
        maxTrucksAllowed: 10,
        truckRequests: []
      }
    ]));

    const mockUser = { $id: 'usr-admin-id', email: 'admin@test.com', name: 'Test Admin' };
    vi.spyOn(appwriteModule.appwrite, 'getCurrentUser').mockResolvedValue(mockUser as any);
    vi.spyOn(appwriteModule.appwrite, 'getUserTeams').mockResolvedValue([{ $id: 'org_test', name: 'Test Logistics Corp' }] as any);

    render(<App />);

    // Wait for the app to finish loading
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // 2. Click "Offices" in sidebar
    const officeTabBtn = screen.getByRole('button', { name: /Offices/i });
    fireEvent.click(officeTabBtn);

    // 3. Verify that the Office Master component is displayed
    expect(screen.getByText('Office Datasheet')).toBeInTheDocument();
    expect(screen.getByText(/Manage active trading offices and transport hubs/i)).toBeInTheDocument();
  });

  it('should render Voice Assistant Language dropdown in Profile Settings Modal and save preference', async () => {
    vi.spyOn(appwriteModule, 'isAppwriteConfigured').mockReturnValue(true);
    localStorage.setItem('ttt_login_method', 'appwrite');
    localStorage.setItem('ttt_user_rights', JSON.stringify([
      {
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
      }
    ]));
    localStorage.setItem('ttt_organization_profiles', JSON.stringify([
      {
        organizationId: 'org_test',
        organizationName: 'Test Logistics Corp',
        ownerEmail: 'admin@test.com',
        status: 'Active',
        maxTrucksAllowed: 10,
        truckRequests: []
      }
    ]));

    const mockUser = { $id: 'usr-admin-id', email: 'admin@test.com', name: 'Test Admin' };
    vi.spyOn(appwriteModule.appwrite, 'getCurrentUser').mockResolvedValue(mockUser as any);
    vi.spyOn(appwriteModule.appwrite, 'getUserTeams').mockResolvedValue([{ $id: 'org_test', name: 'Test Logistics Corp' }] as any);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    const userInitialsBtn = screen.getByText('TA');
    fireEvent.click(userInitialsBtn);

    const profileSettingsBtn = screen.getByText('Profile Settings');
    fireEvent.click(profileSettingsBtn);

    expect(screen.getByRole('heading', { name: /Profile Settings/i })).toBeInTheDocument();

    const langSelect = screen.getByLabelText(/Voice Assistant Language/i);
    expect(langSelect).toBeInTheDocument();
    expect(langSelect).toHaveValue('en-IN');

    fireEvent.change(langSelect, { target: { value: 'hi-IN' } });
    expect(langSelect).toHaveValue('hi-IN');

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Profile Settings/i })).not.toBeInTheDocument();
    });

    expect(localStorage.getItem('ttt_voice_lang_admin@test.com')).toBe('hi-IN');
  });

  it('should allow organization admin to update and persist organization default maintenance intervals in Access Control', async () => {
    vi.spyOn(appwriteModule, 'isAppwriteConfigured').mockReturnValue(true);
    localStorage.setItem('ttt_login_method', 'appwrite');
    const initialUserRights = [
      {
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
      }
    ];
    const initialProfiles = [
      {
        organizationId: 'org_test',
        organizationName: 'Test Logistics Corp',
        ownerEmail: 'admin@test.com',
        status: 'Active',
        maxTrucksAllowed: 10,
        truckRequests: []
      }
    ];
    localStorage.setItem('ttt_user_rights', JSON.stringify(initialUserRights));
    localStorage.setItem('ttt_organization_profiles', JSON.stringify(initialProfiles));

    const mockUser = { $id: 'usr-admin-id', email: 'admin@test.com', name: 'Test Admin' };
    vi.spyOn(appwriteModule.appwrite, 'getCurrentUser').mockResolvedValue(mockUser as any);
    vi.spyOn(appwriteModule.appwrite, 'getUserTeams').mockResolvedValue([{ $id: 'org_test', name: 'Test Logistics Corp' }] as any);
    vi.spyOn(appwriteModule.appwrite, 'listGlobalConfigs').mockImplementation(async () => {
      const storedProfiles = JSON.parse(localStorage.getItem('ttt_organization_profiles') || '[]');
      const storedRights = JSON.parse(localStorage.getItem('ttt_user_rights') || '[]');
      return [
        ...storedRights.map((r: any) => ({ key: 'usr_' + (r.id || 'admin'), data: JSON.stringify(r) })),
        ...storedProfiles.map((p: any) => ({ key: 'prf_' + p.organizationId, data: JSON.stringify(p) }))
      ];
    });
    vi.spyOn(appwriteModule.appwrite, 'saveGlobalConfig').mockResolvedValue('success');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Navigate to Access Control tab
    const accessControlBtn = screen.getByRole('button', { name: /Access Control/i });
    fireEvent.click(accessControlBtn);

    await waitFor(() => {
      expect(screen.getByText(/Organization Default Maintenance Settings/i)).toBeInTheDocument();
    });

    // Fill in the interval inputs
    const engineInput = screen.getByLabelText(/Engine Oil Change \(KM\)/i);
    const crownInput = screen.getByLabelText(/Crown Oil Change \(KM\)/i);
    const gearboxInput = screen.getByLabelText(/Gear Box Oil Change \(KM\)/i);
    const radiatorInput = screen.getByLabelText(/Radiator Service \(KM\)/i);

    fireEvent.change(engineInput, { target: { value: '18000' } });
    fireEvent.change(crownInput, { target: { value: '45000' } });
    fireEvent.change(gearboxInput, { target: { value: '45000' } });
    fireEvent.change(radiatorInput, { target: { value: '25000' } });

    // Save defaults
    const saveDefaultsBtn = screen.getByRole('button', { name: /Save Org Defaults/i });
    fireEvent.click(saveDefaultsBtn);

    // Verify localStorage persistence
    await waitFor(() => {
      const storedProfiles = localStorage.getItem('ttt_organization_profiles');
      expect(storedProfiles).toBeTruthy();
      const parsed = JSON.parse(storedProfiles!);
      const testOrg = parsed.find((p: any) => p.organizationId === 'org_test');
      expect(testOrg.engineOilIntervalKM).toBe(18000);
      expect(testOrg.crownOilIntervalKM).toBe(45000);
      expect(testOrg.gearBoxOilIntervalKM).toBe(45000);
      expect(testOrg.radiatorIntervalKM).toBe(25000);
    });
  });

  it('should auto-heal broken carried-forward advances on startup', async () => {
    vi.spyOn(appwriteModule, 'isAppwriteConfigured').mockReturnValue(false);
    
    const initialTrips = [
      {
        id: 't-1',
        tripNo: 'TRIP-A-01',
        organizationId: 'org_test',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        truckNo: 'MH-12-1111',
        driverName: 'Ramesh Driver',
        status: 'Completed',
        startingKM: 1000,
        endingKM: 1500,
        subTrips: [],
        payments: [],
        advances: [
          {
            id: 'fwd_out_12345',
            amount: -2000,
            date: '2026-05-05',
            fromAccountId: 'Direct Driver',
            notes: 'Negative balance carried forward to TRIP-B-02',
            receivedByDriverDirectly: true
          }
        ]
      },
      {
        id: 't-2',
        tripNo: 'TRIP-B-02',
        organizationId: 'org_test',
        startDate: '2026-05-06',
        endDate: '2026-05-10',
        truckNo: 'MH-12-1111',
        driverName: 'Ramesh Driver',
        status: 'In Progress',
        startingKM: 1500,
        endingKM: 2000,
        subTrips: [],
        payments: [],
        advances: [] // missing matching fwd_in_ advance!
      }
    ];

    localStorage.setItem('ttt_trips', JSON.stringify(initialTrips));
    localStorage.setItem('ttt_login_method', 'local');

    render(<App />);

    await waitFor(() => {
      const storedTrips = JSON.parse(localStorage.getItem('ttt_trips') || '[]');
      const tripA = storedTrips.find((t: any) => t.id === 't-1');
      expect(tripA.advances).toHaveLength(0);
    });
  });

  it('should cascade delete matching carried-forward advances when the source trip is deleted', async () => {
    vi.spyOn(appwriteModule, 'isAppwriteConfigured').mockReturnValue(true);
    localStorage.setItem('ttt_login_method', 'appwrite');
    const initialUserRights = [
      {
        id: 'ur-admin',
        email: 'admin@company.com',
        name: 'Local Admin',
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
      }
    ];
    const initialProfiles = [
      {
        organizationId: 'org_test',
        organizationName: 'Test Logistics Corp',
        ownerEmail: 'admin@company.com',
        status: 'Active',
        maxTrucksAllowed: 10,
        truckRequests: []
      }
    ];
    localStorage.setItem('ttt_user_rights', JSON.stringify(initialUserRights));
    localStorage.setItem('ttt_organization_profiles', JSON.stringify(initialProfiles));

    const mockUser = { $id: 'usr-admin-id', email: 'admin@company.com', name: 'Local Admin' };
    vi.spyOn(appwriteModule.appwrite, 'getCurrentUser').mockResolvedValue(mockUser as any);
    vi.spyOn(appwriteModule.appwrite, 'getUserTeams').mockResolvedValue([{ $id: 'org_test', name: 'Test Logistics Corp' }] as any);
    vi.spyOn(appwriteModule.appwrite, 'listGlobalConfigs').mockImplementation(async () => {
      const storedProfiles = JSON.parse(localStorage.getItem('ttt_organization_profiles') || '[]');
      const storedRights = JSON.parse(localStorage.getItem('ttt_user_rights') || '[]');
      return [
        ...storedRights.map((r: any) => ({ key: 'usr_' + (r.id || 'admin'), data: JSON.stringify(r) })),
        ...storedProfiles.map((p: any) => ({ key: 'prf_' + p.organizationId, data: JSON.stringify(p) }))
      ];
    });
    vi.spyOn(appwriteModule.appwrite, 'saveGlobalConfig').mockResolvedValue('success');
    vi.spyOn(appwriteModule.appwrite, 'saveFleetDocument').mockResolvedValue('success');
    vi.spyOn(appwriteModule.appwrite, 'deleteFleetDocument').mockResolvedValue(true);

    const linkedTrips = [
      {
        id: 't-1',
        tripNo: 'TRIP-A-01',
        organizationId: 'org_test',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        truckNo: 'MH-12-1111',
        driverName: 'Ramesh Driver',
        status: 'Completed',
        startingKM: 1000,
        endingKM: 1500,
        subTrips: [
          {
            id: 'st-1',
            loadingDate: '2026-05-01',
            routeFrom: 'Mumbai',
            routeTo: 'Pune',
            officeName: 'Mumbai HQ',
            income: 40000,
            loadingExpense: 0,
            unloadingExpense: 0,
            driverWages: 0,
            startingKM: 0,
            endingKM: 0
          }
        ],
        payments: [],
        advances: [
          {
            id: 'fwd_out_12345',
            amount: -2000,
            date: '2026-05-05',
            fromAccountId: 'Direct Driver',
            notes: 'Negative balance carried forward to TRIP-B-02',
            receivedByDriverDirectly: true
          }
        ]
      },
      {
        id: 't-2',
        tripNo: 'TRIP-B-02',
        organizationId: 'org_test',
        startDate: '2026-05-06',
        endDate: '2026-05-10',
        truckNo: 'MH-12-1111',
        driverName: 'Ramesh Driver',
        status: 'In Progress',
        startingKM: 1500,
        endingKM: 2000,
        subTrips: [
          {
            id: 'st-2',
            loadingDate: '2026-05-06',
            routeFrom: 'Mumbai',
            routeTo: 'Pune',
            officeName: 'Mumbai HQ',
            income: 40000,
            loadingExpense: 0,
            unloadingExpense: 0,
            driverWages: 0,
            startingKM: 0,
            endingKM: 0
          }
        ],
        payments: [],
        advances: [
          {
            id: 'fwd_in_12345',
            amount: 2000,
            date: '2026-05-05',
            fromAccountId: 'Direct Driver',
            notes: 'Negative balance carried forward from TRIP-A-01',
            receivedByDriverDirectly: true
          }
        ]
      }
    ];

    localStorage.setItem('ttt_trips', JSON.stringify(linkedTrips));
    vi.spyOn(appwriteModule.appwrite, 'listFleetDocuments').mockImplementation(async (dbId, collectionId, orgId) => {
      if (collectionId === 'trips') {
        const storedTrips = JSON.parse(localStorage.getItem('ttt_trips') || '[]');
        return storedTrips.map((t: any) => ({
          $id: t.id,
          organizationId: orgId,
          data: JSON.stringify(t)
        }));
      }
      return [];
    });
    vi.spyOn(appwriteModule.appwrite, 'queryTrips').mockImplementation(async (dbId, orgId, filters, page, limit) => {
      const storedTrips = JSON.parse(localStorage.getItem('ttt_trips') || '[]');
      return {
        documents: storedTrips.map((t: any) => ({
          $id: t.id,
          organizationId: orgId,
          data: JSON.stringify(t)
        })),
        total: storedTrips.length
      };
    });

    render(<App />);

    await screen.findByText('Trip Management');
    const tripTabBtn = screen.getByRole('button', { name: /Trip Management/i });
    fireEvent.click(tripTabBtn);

    await screen.findAllByText('TRIP-A-01');
    const deleteBtn = within(document.getElementById('trip-row-t-1')!).getByTitle('Wipe Cargo Entry record');
    fireEvent.click(deleteBtn);

    const confirmBtn = await screen.findByRole('button', { name: /Confirm Action/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      const storedTrips = JSON.parse(localStorage.getItem('ttt_trips') || '[]');
      expect(storedTrips).toHaveLength(1);
      expect(storedTrips[0].tripNo).toBe('TRIP-B-02');
      expect(storedTrips[0].advances).toHaveLength(0);
    });
  });
});
