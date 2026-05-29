import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TripForm from './TripForm';
import { Truck, Driver, Office, Account, TripEntry } from '../types';

const mockTrucks: Truck[] = [
  { id: 'tr-1', truckNo: 'MH-12-PQ-1234', model: 'Tata Prime', status: 'Active', isApproved: true },
];

const mockDrivers: Driver[] = [
  { id: 'dr-1', driverName: 'Ramesh Kumar', phone: '9999988888', licenseNo: 'DL-1234', status: 'Active' },
];

const mockOffices: Office[] = [
  { id: 'off-1', officeName: 'Mumbai HQ', status: 'Active' },
];

const mockAccounts: Account[] = [
  { id: 'acc-1', accountName: 'Cash Account', type: 'Cash', status: 'Active' },
];

describe('TripForm Component Tests', () => {
  beforeEach(() => {
    window.alert = vi.fn();
  });

  it('should render form inputs correctly when open', () => {
    render(
      <TripForm
        isOpen={true}
        onClose={vi.fn()}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        drivers={mockDrivers}
        existingTripNos={[]}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText(/Initiate Unified Fleet Journey/i)).toBeInTheDocument();
    expect(screen.getByText('Target Truck')).toBeInTheDocument();
    expect(screen.getByText('Driver Operator')).toBeInTheDocument();
  });

  it('should alert validation error if submitting without any sub-trips', () => {
    const handleSubmit = vi.fn();
    const alertSpy = window.alert;

    render(
      <TripForm
        isOpen={true}
        onClose={vi.fn()}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        drivers={mockDrivers}
        existingTripNos={[]}
        onSubmit={handleSubmit}
      />
    );

    // Select truck & driver
    fireEvent.change(screen.getByLabelText(/Target Truck/i), { target: { value: 'MH-12-PQ-1234' } });
    fireEvent.change(screen.getByLabelText(/Driver Operator/i), { target: { value: 'Ramesh Kumar' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Publish Fleet Record/i });
    fireEvent.click(submitBtn);

    // Should alert and not trigger submit callback
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('registering at least 1 Cargo sub-trip segment'));
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('should trigger onSubmit with correct payload when details are valid', () => {
    const handleSubmit = vi.fn();
    
    render(
      <TripForm
        isOpen={true}
        onClose={vi.fn()}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        drivers={mockDrivers}
        existingTripNos={[]}
        onSubmit={handleSubmit}
      />
    );

    // Fill main details
    fireEvent.change(screen.getByLabelText(/Target Truck/i), { target: { value: 'MH-12-PQ-1234' } });
    fireEvent.change(screen.getByLabelText(/Driver Operator/i), { target: { value: 'Ramesh Kumar' } });
    fireEvent.change(screen.getByLabelText(/Starting Odometer/i), { target: { value: 1000 } });
    fireEvent.change(screen.getByLabelText(/Ending Odometer/i), { target: { value: 1500 } });

    // Click Add Cargo Sub-Trip
    const addSubTripBtn = screen.getByRole('button', { name: /Add Cargo Segment/i });
    fireEvent.click(addSubTripBtn);

    // Fill Sub-trip builder form details
    fireEvent.change(screen.getByLabelText(/Route Origin/i), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByLabelText(/Route Destination/i), { target: { value: 'Pune' } });
    fireEvent.change(screen.getByLabelText(/Billed Freight Income/i), { target: { value: 40000 } });

    // Save segment
    const saveSubTripBtn = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveSubTripBtn);

    // Verify sub-trip is listed
    expect(screen.getByText('Mumbai ➔ Pune')).toBeInTheDocument();

    // Submit main form
    const submitBtn = screen.getByRole('button', { name: /Publish Fleet Record/i });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith(expect.objectContaining({
      truckNo: 'MH-12-PQ-1234',
      driverName: 'Ramesh Kumar',
      startingKM: 1000,
      endingKM: 1500,
      subTrips: expect.arrayContaining([
        expect.objectContaining({
          routeFrom: 'Mumbai',
          routeTo: 'Pune',
          income: 40000,
        })
      ])
    }));
  });

  it('should render fuel cards from organization profile as options in Account Mode dropdown', () => {
    const mockOrgProfileWithCards = {
      organizationId: 'org_test',
      organizationName: 'Test Logistics',
      ownerEmail: 'admin@company.com',
      status: 'Active' as const,
      maxTrucksAllowed: 5,
      truckRequests: [],
      fuelCards: [
        {
          id: 'fc-1',
          cardName: 'HPCL primary card',
          cardNumber: '123456789012',
          status: 'Active' as const
        }
      ]
    };

    render(
      <TripForm
        isOpen={true}
        onClose={vi.fn()}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        drivers={mockDrivers}
        existingTripNos={[]}
        onSubmit={vi.fn()}
        orgProfile={mockOrgProfileWithCards}
      />
    );

    // Look for option text
    expect(screen.getByText('HPCL primary card (Fuel Card)')).toBeInTheDocument();
  });

  it('should auto-calculate fuel amounts and rates and allow adding fuel logs', () => {
    render(
      <TripForm
        isOpen={true}
        onClose={vi.fn()}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        drivers={mockDrivers}
        existingTripNos={[]}
        onSubmit={vi.fn()}
        orgProfile={undefined}
      />
    );

    const litersInput = screen.getByLabelText(/Liters/i) as HTMLInputElement;
    const rateInput = screen.getByLabelText(/Rate \/ Lit/i) as HTMLInputElement;
    const amountInput = screen.getByLabelText(/Total Amount \(₹\)/i) as HTMLInputElement;

    // 1. Liters and Rate entered -> Amount calculated
    fireEvent.change(litersInput, { target: { value: '50' } });
    fireEvent.change(rateInput, { target: { value: '100' } });
    expect(amountInput.value).toBe('5000');

    // Add fuel log
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Fuel/i }));

    // Reset inputs
    expect(litersInput.value).toBe('');
    expect(rateInput.value).toBe('');
    expect(amountInput.value).toBe('');

    // 2. Liters and Amount entered -> Rate calculated
    fireEvent.change(litersInput, { target: { value: '40' } });
    fireEvent.change(amountInput, { target: { value: '3800' } });
    expect(rateInput.value).toBe('95');

    // Add fuel log
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Fuel/i }));

    // 3. Only Amount entered -> Rate and Liters empty -> Should allow adding
    fireEvent.change(amountInput, { target: { value: '2500' } });
    expect(litersInput.value).toBe('');
    expect(rateInput.value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: /\+ Add Fuel/i }));
  });
});
