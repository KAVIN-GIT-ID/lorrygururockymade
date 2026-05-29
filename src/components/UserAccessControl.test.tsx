import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UserAccessControl from './UserAccessControl';
import { UserPermission, OrganizationProfile } from '../types';

const mockPermissions: UserPermission[] = [
  {
    id: 'perm-1',
    email: 'admin@company.com',
    name: 'Admin User',
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

const mockOrgProfile: OrganizationProfile = {
  organizationId: 'org_test',
  organizationName: 'Test Logistics',
  ownerEmail: 'admin@company.com',
  status: 'Active',
  maxTrucksAllowed: 5,
  truckRequests: [],
  fuelCards: [
    {
      id: 'fc-1',
      cardName: 'HPCL primary card',
      cardNumber: '123456789012',
      status: 'Active'
    }
  ]
};

describe('UserAccessControl Fuel Cards Management', () => {
  it('should render fuel cards section and existing card correctly', () => {
    render(
      <UserAccessControl
        permissions={mockPermissions}
        orgProfile={mockOrgProfile}
        onAddPermission={vi.fn()}
        onUpdatePermission={vi.fn()}
        onDeletePermission={vi.fn()}
        showNotification={vi.fn()}
        onUpdateOrgProfile={vi.fn()}
        currentUserEmail="admin@company.com"
        currentUserOrgId="org_test"
      />
    );

    expect(screen.getByText('Organization Fuel Cards (Accounts)')).toBeInTheDocument();
    expect(screen.getByText('HPCL primary card')).toBeInTheDocument();
    expect(screen.getByText('123456789012')).toBeInTheDocument();
  });

  it('should toggle new fuel card form and allow adding a card', () => {
    const handleUpdateProfile = vi.fn();
    render(
      <UserAccessControl
        permissions={mockPermissions}
        orgProfile={mockOrgProfile}
        onAddPermission={vi.fn()}
        onUpdatePermission={vi.fn()}
        onDeletePermission={vi.fn()}
        showNotification={vi.fn()}
        onUpdateOrgProfile={handleUpdateProfile}
        currentUserEmail="admin@company.com"
        currentUserOrgId="org_test"
      />
    );

    // Form shouldn't be visible initially
    expect(screen.queryByText('Add New Fuel Card')).not.toBeInTheDocument();

    // Click "Add Fuel Card" button
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Fuel Card/i }));

    // Form should now be visible
    expect(screen.getByText('Add New Fuel Card')).toBeInTheDocument();

    // Fill inputs
    fireEvent.change(screen.getByLabelText(/Card Name \/ Account/i), { target: { value: 'Shell Card #2' } });
    fireEvent.change(screen.getByLabelText(/Card Number \(Optional\)/i), { target: { value: '9876543210' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'Add Card' }));

    // onUpdateOrgProfile should be triggered
    expect(handleUpdateProfile).toHaveBeenCalledTimes(1);
    const updatedProfile = handleUpdateProfile.mock.calls[0][0];
    expect(updatedProfile.fuelCards).toHaveLength(2);
    expect(updatedProfile.fuelCards[1]).toMatchObject({
      cardName: 'Shell Card #2',
      cardNumber: '9876543210',
      status: 'Active'
    });
  });

  it('should load pre-filled card details in edit mode and allow updating', () => {
    const handleUpdateProfile = vi.fn();
    render(
      <UserAccessControl
        permissions={mockPermissions}
        orgProfile={mockOrgProfile}
        onAddPermission={vi.fn()}
        onUpdatePermission={vi.fn()}
        onDeletePermission={vi.fn()}
        showNotification={vi.fn()}
        onUpdateOrgProfile={handleUpdateProfile}
        currentUserEmail="admin@company.com"
        currentUserOrgId="org_test"
      />
    );

    // Click edit button
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    // Prefilled values
    const cardInput = screen.getByLabelText(/Card Name \/ Account/i) as HTMLInputElement;
    expect(cardInput.value).toBe('HPCL primary card');

    // Change and update
    fireEvent.change(cardInput, { target: { value: 'HPCL updated card' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(handleUpdateProfile).toHaveBeenCalledTimes(1);
    const updatedProfile = handleUpdateProfile.mock.calls[0][0];
    expect(updatedProfile.fuelCards[0].cardName).toBe('HPCL updated card');
  });

  it('should trigger deletion of a card', () => {
    const handleUpdateProfile = vi.fn();
    const confirmSpy = vi.fn().mockReturnValue(true);
    window.confirm = confirmSpy;

    render(
      <UserAccessControl
        permissions={mockPermissions}
        orgProfile={mockOrgProfile}
        onAddPermission={vi.fn()}
        onUpdatePermission={vi.fn()}
        onDeletePermission={vi.fn()}
        showNotification={vi.fn()}
        onUpdateOrgProfile={handleUpdateProfile}
        currentUserEmail="admin@company.com"
        currentUserOrgId="org_test"
      />
    );

    // Click delete button
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirmSpy).toHaveBeenCalledWith('Remove fuel card "HPCL primary card"?');
    expect(handleUpdateProfile).toHaveBeenCalledTimes(1);
    const updatedProfile = handleUpdateProfile.mock.calls[0][0];
    expect(updatedProfile.fuelCards).toHaveLength(0);
  });
});
