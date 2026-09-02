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

  it('should auto-populate starting KM based on the latest trip ending KM or truck currentKM when selecting a truck in new trip mode', () => {
    const mockTrips: TripEntry[] = [
      {
        id: 't-1',
        tripNo: 'TRIP-2026-0001',
        truckNo: 'MH-12-PQ-1234',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        driverName: 'Ramesh Kumar',
        startingKM: 1000,
        endingKM: 1500, // last ending KM is 1500
        subTrips: [],
        payments: [],
        status: 'Completed',
      },
      {
        id: 't-2',
        tripNo: 'TRIP-2026-0002',
        truckNo: 'MH-12-PQ-1234',
        startDate: '2026-05-15',
        endDate: '2026-05-20',
        driverName: 'Ramesh Kumar',
        startingKM: 1600,
        endingKM: 2200, // most recent ending KM is 2200
        subTrips: [],
        payments: [],
        status: 'Completed',
      }
    ];

    const trucksWithKM = [
      { id: 'tr-1', truckNo: 'MH-12-PQ-1234', model: 'Tata Prime', status: 'Active' as const, isApproved: true, currentKM: 2000 },
      { id: 'tr-2', truckNo: 'KA-51-AB-9999', model: 'Leyland', status: 'Active' as const, isApproved: true, currentKM: 3500 }
    ];

    render(
      <TripForm
        isOpen={true}
        onClose={vi.fn()}
        trucks={trucksWithKM}
        offices={mockOffices}
        accounts={mockAccounts}
        drivers={mockDrivers}
        existingTripNos={[]}
        onSubmit={vi.fn()}
        trips={mockTrips}
      />
    );

    const startingKMInput = screen.getByLabelText(/Starting Odometer/i) as HTMLInputElement;

    // Default truck MH-12-PQ-1234 is selected first on load.
    // The max of last trip endingKM (2200) and truck's currentKM (2000) is 2200.
    expect(startingKMInput.value).toBe('2200');

    // Change truck to KA-51-AB-9999
    // It has no previous trips, so it should fall back to its currentKM (3500)
    fireEvent.change(screen.getByLabelText(/Target Truck/i), { target: { value: 'KA-51-AB-9999' } });
    expect(startingKMInput.value).toBe('3500');
  });

  it('should not overwrite starting KM when editing an existing trip', () => {
    const mockTrips: TripEntry[] = [
      {
        id: 't-1',
        tripNo: 'TRIP-2026-0001',
        truckNo: 'MH-12-PQ-1234',
        startDate: '2026-05-10',
        endDate: '2026-05-12',
        driverName: 'Ramesh Kumar',
        startingKM: 1000,
        endingKM: 1500,
        subTrips: [],
        payments: [],
        status: 'Completed',
      }
    ];

    const editingTrip: TripEntry = {
      id: 't-edit',
      tripNo: 'TRIP-2026-0002',
      truckNo: 'MH-12-PQ-1234',
      startDate: '2026-05-15',
      endDate: '2026-05-20',
      driverName: 'Ramesh Kumar',
      startingKM: 1800, // Manually set starting KM
      endingKM: 2500,
      subTrips: [],
      payments: [],
      status: 'In Progress',
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
        editingEntry={editingTrip}
        trips={mockTrips}
      />
    );

    const startingKMInput = screen.getByLabelText(/Starting Odometer/i) as HTMLInputElement;
    // When editing, starting KM should remain as the editing entry's value (1800) and not be auto-calculated to 1500
    expect(startingKMInput.value).toBe('1800');
  });

  it('should compute and render line item totals in the cargo segments table footer', () => {
    const { container } = render(
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

    // Add first cargo segment: Mumbai to Pune
    fireEvent.click(screen.getByRole('button', { name: /Add Cargo Segment/i }));
    fireEvent.change(screen.getByLabelText(/Route Origin/i), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByLabelText(/Route Destination/i), { target: { value: 'Pune' } });
    fireEvent.change(screen.getByLabelText(/Billed Freight Income/i), { target: { value: 45000 } });
    
    const driverWagesInput1 = container.querySelector('#input_st_driverwages') as HTMLInputElement;
    fireEvent.change(driverWagesInput1, { target: { value: 6750 } });

    // Add a Brokerage expense of 2000 paid by driver
    const typeSelect1 = Array.from(container.querySelectorAll('select')).find(s => Array.from((s as HTMLSelectElement).options).some(o => o.value === 'Brokerage')) as HTMLSelectElement;
    fireEvent.change(typeSelect1, { target: { value: 'Brokerage' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 1500'), { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Leg Expense/i }));
    
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    // Add second cargo segment: Warangal to Dharapuram
    fireEvent.click(screen.getByRole('button', { name: /Add Cargo Segment/i }));
    fireEvent.change(screen.getByLabelText(/Route Origin/i), { target: { value: 'Warangal' } });
    fireEvent.change(screen.getByLabelText(/Route Destination/i), { target: { value: 'Dharapuram' } });
    fireEvent.change(screen.getByLabelText(/Billed Freight Income/i), { target: { value: 94500 } });

    const driverWagesInput2 = container.querySelector('#input_st_driverwages') as HTMLInputElement;
    fireEvent.change(driverWagesInput2, { target: { value: 14175 } });

    // Add a Loading expense of 1500 paid by driver
    const typeSelect2 = Array.from(container.querySelectorAll('select')).find(s => Array.from((s as HTMLSelectElement).options).some(o => o.value === 'Brokerage')) as HTMLSelectElement;
    fireEvent.change(typeSelect2, { target: { value: 'Loading' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 1500'), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Leg Expense/i }));

    // Add a Brokerage expense of 1000 NOT paid by driver (OrgRental)
    fireEvent.change(typeSelect2, { target: { value: 'Brokerage' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 1500'), { target: { value: '1000' } });
    const paidBySelect = Array.from(container.querySelectorAll('select')).find(s => Array.from((s as HTMLSelectElement).options).some(o => o.value === 'OrgRental')) as HTMLSelectElement;
    fireEvent.change(paidBySelect, { target: { value: 'OrgRental' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Leg Expense/i }));
    
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    // Total income should be 45000 + 94500 = 139500
    // Total wages should be 6750 + 14175 = 20925
    // Total driver spend should be 2000 (Seg 1 Brokerage) + 1500 (Seg 2 Loading) = 3500
    // Total brokerage should be 1000 (Seg 2 Brokerage)
    
    // We check that the footer elements have the correct text
    const totalRow = screen.getByText('Total').closest('tr');
    expect(totalRow).toBeInTheDocument();
    
    expect(totalRow).toHaveTextContent(/₹1[39,]+500/); // Total Income
    expect(totalRow).toHaveTextContent('₹20,925');  // Total Wages
    expect(totalRow).toHaveTextContent('₹3,500');   // Total Driver Spend
    expect(totalRow).toHaveTextContent('₹1,000');   // Total Brokerage (only the one NOT paid by driver)
  });
});
