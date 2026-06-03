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
        isEmailVerified: true,
        isPhoneVerified: true,
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
      emailVerification: true,
      phoneVerification: true,
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
        isEmailVerified: true,
        isPhoneVerified: true,
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

    const mockUser = { $id: 'usr-admin-id', email: 'admin@test.com', name: 'Test Admin', emailVerification: true, phoneVerification: true };
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
        isEmailVerified: true,
        isPhoneVerified: true,
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

    const mockUser = { $id: 'usr-admin-id', email: 'admin@test.com', name: 'Test Admin', emailVerification: true, phoneVerification: true };
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
        isEmailVerified: true,
        isPhoneVerified: true,
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

    const mockUser = { $id: 'usr-admin-id', email: 'admin@test.com', name: 'Test Admin', emailVerification: true, phoneVerification: true };
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
        isEmailVerified: true,
        isPhoneVerified: true,
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

    const mockUser = { $id: 'usr-admin-id', email: 'admin@company.com', name: 'Local Admin', emailVerification: true, phoneVerification: true };
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

  it('should render the Verification Required interceptor when user email or phone is unverified, and handle verification flow', async () => {
    // 1. Configure active Appwrite mode in mock
    vi.spyOn(appwriteModule, 'isAppwriteConfigured').mockReturnValue(true);

    // 2. Setup mock local storage session states where user is unverified
    localStorage.setItem('ttt_login_method', 'appwrite');
    localStorage.setItem('ttt_user_rights', JSON.stringify([
      {
        id: 'ur-unverified',
        email: 'unverified@test.com',
        name: 'Unverified User',
        role: 'Admin',
        organizationId: 'org_test',
        isApproved: true,
        isEmailVerified: false,
        isPhoneVerified: false,
        phone: '',
        canViewTrips: true
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

    // Set URL search params to trigger email verification on mount
    window.history.replaceState({}, '', '?mode=verify&userId=usr-unverified-id&secret=some_secret_key');

    // Mock window.alert
    const alertSpy = vi.fn();
    window.alert = alertSpy;

    // Mock Appwrite functions
    const userVerificationStatus = {
      emailVerification: false,
      phoneVerification: false,
    };

    vi.spyOn(appwriteModule.appwrite, 'getCurrentUser').mockImplementation(async () => {
      return {
        $id: 'usr-unverified-id',
        email: 'unverified@test.com',
        name: 'Unverified User',
        ...userVerificationStatus,
      } as any;
    });

    vi.spyOn(appwriteModule.appwrite, 'getUserTeams').mockResolvedValue([
      { $id: 'org_test', name: 'Test Logistics Corp' }
    ] as any);

    const mockCreateVerification = vi.spyOn(appwriteModule.appwrite, 'createVerification').mockResolvedValue({} as any);
    const mockUpdateVerification = vi.spyOn(appwriteModule.appwrite, 'updateVerification').mockImplementation(async () => {
      userVerificationStatus.emailVerification = true;
      return {} as any;
    });
    const mockUpdatePhone = vi.spyOn(appwriteModule.appwrite, 'updatePhone').mockResolvedValue({} as any);
    const mockCreatePhoneVerification = vi.spyOn(appwriteModule.appwrite, 'createPhoneVerification').mockResolvedValue({} as any);
    const mockUpdatePhoneVerification = vi.spyOn(appwriteModule.appwrite, 'updatePhoneVerification').mockImplementation(async () => {
      userVerificationStatus.phoneVerification = true;
      return {} as any;
    });

    render(<App />);

    // Wait for the URL parameter redirect flow to complete and display notification
    await waitFor(() => {
      expect(mockUpdateVerification).toHaveBeenCalledWith('usr-unverified-id', 'some_secret_key');
    });

    // Verification screen should render
    await screen.findByText('Verification Required');
    expect(screen.getByText('Please verify your email address and mobile number to access the platform.')).toBeInTheDocument();

    // The email should now render as Verified, and phone as Unverified
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Unverified')).toBeInTheDocument();

    // Click "Add Number"
    const addNumberBtn = screen.getByRole('button', { name: 'Add Number' });
    fireEvent.click(addNumberBtn);

    // Verify popup modal is shown
    expect(screen.getByText('Add / Update Mobile Number')).toBeInTheDocument();

    // Enter phone and password in form
    const phoneInput = screen.getByPlaceholderText('+919876543210');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const saveVerifyBtn = screen.getByRole('button', { name: 'Save & Verify' });

    // Test validation error first
    fireEvent.change(phoneInput, { target: { value: 'invalidphone' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(saveVerifyBtn);
    expect(alertSpy).toHaveBeenLastCalledWith("Invalid phone number format. It must start with '+' and follow E.164 standards (e.g. +919876543210).");

    // Test successful phone number submission
    fireEvent.change(phoneInput, { target: { value: '+919876543210' } });
    fireEvent.click(saveVerifyBtn);

    await waitFor(() => {
      expect(mockUpdatePhone).toHaveBeenCalledWith('+919876543210', 'password123');
      expect(mockCreatePhoneVerification).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenLastCalledWith('Mobile number saved and verification OTP sent successfully!');
    });

    // The modal should close, and the OTP verification form is displayed instead of the send button
    expect(screen.queryByText('Add / Update Mobile Number')).not.toBeInTheDocument();
    
    // Now enter OTP code and verify
    const otpInput = screen.getByPlaceholderText('Enter OTP (e.g. 123456)');
    fireEvent.change(otpInput, { target: { value: '123456' } });

    const verifyCodeBtn = screen.getByRole('button', { name: 'Verify Code' });
    fireEvent.click(verifyCodeBtn);

    await waitFor(() => {
      expect(mockUpdatePhoneVerification).toHaveBeenCalledWith('usr-unverified-id', '123456');
    });

    // Since both email and phone are verified, the dashboard should load instantly without page refresh
    await screen.findByText('Dashboard');
    expect(screen.getByText('Trip Management')).toBeInTheDocument();

    // Clean up mock URL and alert
    window.history.replaceState({}, '', '/');
    delete (window as any).alert;
  });

  it('should support the Enable and Disable 2FA setup wizards in Profile modal', async () => {
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
        isEmailVerified: true,
        isPhoneVerified: true,
        is2FAEnabled: false,
        twoFactorSecret: '',
        phone: '+919876543210'
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

    const mockUser = { $id: 'usr-admin-id', email: 'admin@company.com', name: 'Local Admin', emailVerification: true, phoneVerification: true };
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
    const mockSaveConfig = vi.spyOn(appwriteModule.appwrite, 'saveGlobalConfig').mockResolvedValue('success');
    const mockLogin = vi.spyOn(appwriteModule.appwrite, 'login').mockResolvedValue({} as any);

    render(<App />);

    await screen.findByText('Dashboard');

    // Open profile modal
    fireEvent.click(screen.getByText('LA'));
    fireEvent.click(screen.getByText('Profile Settings'));

    // Check 2FA is currently Disabled
    expect(screen.getByText('Disabled')).toBeInTheDocument();

    // Click Enable 2FA
    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));

    // Setup wizard should open
    expect(screen.getByText('Enable 2FA Protection')).toBeInTheDocument();
    
    // Type in TOTP code and password
    const codeInput = screen.getByTestId('setup-2fa-code');
    fireEvent.change(codeInput, { target: { value: '123456' } }); // Mock bypass code
    
    const pwInput = screen.getByTestId('setup-2fa-password');
    fireEvent.change(pwInput, { target: { value: 'mypassword123' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Enable 2FA' }));

    await waitFor(() => {
      // Re-authenticate password should have been called
      expect(mockLogin).toHaveBeenCalledWith('admin@company.com', 'mypassword123');
      // Secret key should have been saved
      expect(mockSaveConfig).toHaveBeenCalled();
    });

    // Check that local storage now has 2FA enabled
    const updatedRights = JSON.parse(localStorage.getItem('ttt_user_rights') || '[]');
    expect(updatedRights[0].is2FAEnabled).toBe(true);
    expect(updatedRights[0].twoFactorSecret).toBeTruthy();

    // Now let's test disabling 2FA
    // The profile modal may have updated status, let's trigger disable click
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));

    expect(screen.getByText('Disable 2FA Protection')).toBeInTheDocument();

    const disableCodeInput = screen.getByTestId('disable-2fa-code');
    fireEvent.change(disableCodeInput, { target: { value: '123456' } });

    const disablePwInput = screen.getByTestId('disable-2fa-password');
    fireEvent.change(disablePwInput, { target: { value: 'mypassword123' } });

    fireEvent.click(screen.getByRole('button', { name: 'Disable 2FA' }));

    await waitFor(() => {
      const storedRights = JSON.parse(localStorage.getItem('ttt_user_rights') || '[]');
      expect(storedRights[0].is2FAEnabled).toBe(false);
      expect(storedRights[0].twoFactorSecret).toBe('');
    });
  });

  it('should support the Mobile Number Change wizard with double OTP verification', async () => {
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
        isEmailVerified: true,
        isPhoneVerified: true,
        is2FAEnabled: false,
        phone: '+919876543210'
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

    const mockUser = { $id: 'usr-admin-id', email: 'admin@company.com', name: 'Local Admin', emailVerification: true, phoneVerification: true };
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
    const mockUpdatePhone = vi.spyOn(appwriteModule.appwrite, 'updatePhone').mockResolvedValue({} as any);

    // Mock alert
    const alertSpy = vi.fn();
    window.alert = alertSpy;

    render(<App />);

    await screen.findByText('Dashboard');

    // Open profile modal
    fireEvent.click(screen.getByText('LA'));
    fireEvent.click(screen.getByText('Profile Settings'));

    // Click Change Mobile
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    // Check step 1 is active (Verify Old)
    expect(screen.getByText('Change Mobile Number')).toBeInTheDocument();
    expect(screen.getByText('1. Verify Old')).toHaveClass('text-blue-400 font-bold');

    // Input verification OTP for Step 1
    const otpInput = screen.getByTestId('mobile-wizard-old-otp');
    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next Step' }));

    // Now Step 2 should be active (Enter New)
    await waitFor(() => {
      expect(screen.getByText('2. New Number')).toHaveClass('text-blue-400 font-bold');
    });

    // Enter invalid phone first
    const newPhoneInput = screen.getByPlaceholderText('+919876543210');
    fireEvent.change(newPhoneInput, { target: { value: 'invalid-number' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP Verification' }));
    expect(screen.getByText('Mobile number must be in E.164 format (e.g. +919876543210).')).toBeInTheDocument();

    // Enter valid new phone and send
    fireEvent.change(newPhoneInput, { target: { value: '+919999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send OTP Verification' }));

    // Now Step 3 should be active
    await waitFor(() => {
      expect(screen.getByText('3. Verify New')).toHaveClass('text-blue-400 font-bold');
    });

    // Enter Step 3 OTP and password
    const newOtpInput = screen.getByTestId('mobile-wizard-new-otp');
    fireEvent.change(newOtpInput, { target: { value: '123456' } });

    const pwInput = screen.getByTestId('mobile-wizard-password');
    fireEvent.change(pwInput, { target: { value: 'mypassword123' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Change' }));

    await waitFor(() => {
      expect(mockUpdatePhone).toHaveBeenCalledWith('+919999999999', 'mypassword123');
    });

    // Confirm local storage is updated
    const storedRights = JSON.parse(localStorage.getItem('ttt_user_rights') || '[]');
    expect(storedRights[0].phone).toBe('+919999999999');
    expect(storedRights[0].isPhoneVerified).toBe(true);

    delete (window as any).alert;
  });
});

