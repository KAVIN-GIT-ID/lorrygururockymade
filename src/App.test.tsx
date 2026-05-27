import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
});
