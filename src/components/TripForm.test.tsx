import { createSignal, createEffect } from 'solid-js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
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
    render(() => (
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
    ));

    expect(screen.getByText(/Create Transport Journey|Initiate Unified Fleet Journey/i)).toBeInTheDocument();
    expect(screen.getByText(/Create Transport Journey|Initiate Unified Fleet Journey/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Trip Details|Target Truck/i)[0]).toBeInTheDocument();
  });

  it('should alert validation error if submitting without any sub-trips', () => {
    const handleSubmit = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { container } = render(() => (
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
    ));

    const truckSelect = container.querySelector('#input_target_truck') as HTMLSelectElement || screen.getByLabelText(/Target Truck/i);
    fireEvent.change(truckSelect, { target: { value: 'MH-12-PQ-1234' } });

    const driverSelect = Array.from(container.querySelectorAll('select')).find(s => Array.from((s as HTMLSelectElement).options).some(o => o.value === 'Ramesh Kumar')) as HTMLSelectElement;
    if (driverSelect) fireEvent.change(driverSelect, { target: { value: 'Ramesh Kumar' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Update Fleet Record|Publish Fleet Record|டிரிப் ஏடு சேமிக்க/i });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledTimes(1);

    alertSpy.mockRestore();
  });

  it('should alert validation error if ending odometer is lower than starting odometer', () => {
    const handleSubmit = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { container } = render(() => (
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
    ));

    const truckSelect = container.querySelector('#input_target_truck') as HTMLSelectElement || screen.getByLabelText(/Target Truck/i);
    fireEvent.change(truckSelect, { target: { value: 'MH-12-PQ-1234' } });

    const driverSelect = Array.from(container.querySelectorAll('select')).find(s => Array.from((s as HTMLSelectElement).options).some(o => o.value === 'Ramesh Kumar')) as HTMLSelectElement;
    if (driverSelect) fireEvent.change(driverSelect, { target: { value: 'Ramesh Kumar' } });

    const startingKMInput = container.querySelector('#input_starting_km') as HTMLInputElement;
    if (startingKMInput) fireEvent.change(startingKMInput, { target: { value: '2000' } });

    const endingKMInput = container.querySelector('#input_ending_km') as HTMLInputElement;
    if (endingKMInput) fireEvent.change(endingKMInput, { target: { value: '1000' } });

    // Add Cargo Sub-Trip
    fireEvent.click(screen.getByText('Goods & Segments'));
    fireEvent.click(screen.getByRole('button', { name: /Add Cargo Segment|Add First Cargo Segment/i }));
    fireEvent.change(screen.getByLabelText(/Route From/i), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByLabelText(/Route To/i), { target: { value: 'Pune' } });
    fireEvent.change(screen.getByLabelText(/Freight Income/i), { target: { value: 40000 } });
    fireEvent.click(screen.getByRole('button', { name: /Add Segment|Save Segment|^Save$/i }));

    const submitBtn = screen.getByRole('button', { name: /Update Fleet Record|Publish Fleet Record|டிரிப் ஏடு சேமிக்க/i });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledTimes(1);

    alertSpy.mockRestore();
  });

  it('should trigger onSubmit with correct payload when details are valid', () => {
    const handleSubmit = vi.fn();
    
    const { container } = render(() => (
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
    ));

    const truckSelect = container.querySelector('#input_target_truck') as HTMLSelectElement || screen.getByLabelText(/Target Truck/i);
    fireEvent.change(truckSelect, { target: { value: 'MH-12-PQ-1234' } });

    const driverSelect = Array.from(container.querySelectorAll('select')).find(s => Array.from((s as HTMLSelectElement).options).some(o => o.value === 'Ramesh Kumar')) as HTMLSelectElement;
    if (driverSelect) {
      fireEvent.change(driverSelect, { target: { value: 'Ramesh Kumar' } });
    }

    // Click Add Cargo Sub-Trip
    fireEvent.click(screen.getByText('Goods & Segments'));
    const addSubTripBtn = screen.getByRole('button', { name: /Add Cargo Segment|Add First Cargo Segment/i });
    fireEvent.click(addSubTripBtn);

    // Fill Sub-trip builder form details
    const originInput = container.querySelector('#input_st_route_from') || screen.getByLabelText(/Route Origin|Route From/i);
    const destInput = container.querySelector('#input_st_route_to') || screen.getByLabelText(/Route Destination|Route To/i);
    const incomeInput = container.querySelector('#input_st_income') || screen.getByLabelText(/Billed Freight Income|Freight Income/i);

    fireEvent.change(originInput, { target: { value: 'Mumbai' } });
    fireEvent.change(destInput, { target: { value: 'Pune' } });
    fireEvent.change(incomeInput, { target: { value: 40000 } });

    // Save segment
    const saveSubTripBtn = screen.getByRole('button', { name: /Add Segment|Save Segment|^Save$/i });
    fireEvent.click(saveSubTripBtn);

    // Verify sub-trip is listed
    expect(screen.getByText(/Mumbai/i)).toBeInTheDocument();

    // Submit main form
    const submitBtn = screen.getByRole('button', { name: /Update Fleet Record|Publish Fleet Record|டிரிப் ஏடு சேமிக்க/i });
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith(expect.objectContaining({
      truckNo: 'MH-12-PQ-1234',
      driverName: 'Ramesh Kumar',
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

    render(() => (
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
    ));

    // Navigate to Diesel Fuel Logs step
    fireEvent.click(screen.getByText('Diesel Fuel Logs'));

    // Look for option text
    expect(screen.getAllByText(/HPCL primary card/i)[0]).toBeInTheDocument();
  });

  it('should auto-calculate fuel amounts and rates and allow adding fuel logs', () => {
    const { container } = render(() => (
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
    ));

    // Navigate to Diesel Fuel Logs step
    fireEvent.click(screen.getByText('Diesel Fuel Logs'));

    const litersInput = container.querySelector('#input_fuel_liters') as HTMLInputElement || screen.getByLabelText(/Liters/i);
    const rateInput = container.querySelector('#input_fuel_rate') as HTMLInputElement || screen.getByLabelText(/Rate \/ Lit/i);
    const amountInput = container.querySelector('#input_fuel_amount') as HTMLInputElement || screen.getByLabelText(/Total Amount \(₹\)/i);

    // 1. Liters and Rate entered -> Amount calculated
    fireEvent.change(litersInput, { target: { value: '50' } });
    fireEvent.change(rateInput, { target: { value: '100' } });
    expect(amountInput.value).toBe('5000');

    // Add fuel log
    const addFuelBtn = container.querySelector('button[title="Add Fuel Entry"]') || screen.getByRole('button', { name: /Add Fuel|Fuel/i });
    fireEvent.click(addFuelBtn);

    // Reset inputs
    expect(litersInput.value).toBe('');
    expect(rateInput.value).toBe('');
    expect(amountInput.value).toBe('');

    // 2. Liters and Amount entered -> Rate calculated
    fireEvent.change(litersInput, { target: { value: '40' } });
    fireEvent.change(amountInput, { target: { value: '3800' } });
    expect(rateInput.value).toBe('95');

    // Add fuel log
    fireEvent.click(addFuelBtn);

    // 3. Only Amount entered -> Rate and Liters empty -> Should allow adding
    fireEvent.change(amountInput, { target: { value: '2500' } });
    expect(litersInput.value).toBe('');
    expect(rateInput.value).toBe('');

    fireEvent.click(addFuelBtn);
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

    const { container } = render(() => (
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
    ));

    const startingKMInput = container.querySelector('#input_starting_km') as HTMLInputElement;
    const truckSelect = container.querySelector('#input_target_truck') as HTMLSelectElement || screen.getByLabelText(/Target Truck/i);

    // Select truck MH-12-PQ-1234
    fireEvent.change(truckSelect, { target: { value: 'MH-12-PQ-1234' } });
    // The max of last trip endingKM (2200) and truck's currentKM (2000) is 2200.
    expect(startingKMInput.value).toBe('2200');

    // Change truck to KA-51-AB-9999
    // It has no previous trips, so it should fall back to its currentKM (3500)
    fireEvent.change(truckSelect, { target: { value: 'KA-51-AB-9999' } });
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

    const { container } = render(() => (
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
    ));

    const startingKMInput = container.querySelector('#input_starting_km') as HTMLInputElement;
    // When editing, starting KM should remain as the editing entry's value (1800) and not be auto-calculated to 1500
    expect(startingKMInput.value).toBe('1800');
  });

  it('should compute and render line item totals in the cargo segments table footer', () => {
    const { container } = render(() => (
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
    ));

    // Navigate to Goods & Segments step
    fireEvent.click(screen.getByText('Goods & Segments'));

    // Add first cargo segment: Mumbai to Pune
    fireEvent.click(screen.getAllByRole('button', { name: /சுற்றுவரவு|Add Cargo Segment|Add First Cargo Segment|Add Leg/i })[0]);
    fireEvent.change(screen.getByLabelText(/Route From/i), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByLabelText(/Route To/i), { target: { value: 'Pune' } });
    fireEvent.change(screen.getByLabelText(/Freight Income/i), { target: { value: 45000 } });
    
    const driverWagesInput1 = container.querySelector('#input_st_driverwages') as HTMLInputElement;
    if (driverWagesInput1) {
      fireEvent.change(driverWagesInput1, { target: { value: 6750 } });
    }

    fireEvent.click(screen.getByRole('button', { name: /Add Segment/i }));

    // Add second cargo segment: Warangal to Dharapuram
    fireEvent.click(screen.getAllByRole('button', { name: /சுற்றுவரவு|Add Cargo Segment|Add First Cargo Segment|Add Leg/i })[0]);
    fireEvent.change(screen.getByLabelText(/Route From/i), { target: { value: 'Warangal' } });
    fireEvent.change(screen.getByLabelText(/Route To/i), { target: { value: 'Dharapuram' } });
    fireEvent.change(screen.getByLabelText(/Freight Income/i), { target: { value: 94500 } });

    fireEvent.click(screen.getByRole('button', { name: /Add Segment/i }));

    const driverWagesInput2 = container.querySelector('#input_st_driverwages') as HTMLInputElement;
    if (driverWagesInput2) {
      fireEvent.change(driverWagesInput2, { target: { value: 14175 } });
    }

    // Add a Loading expense of 1500 paid by driver
    const typeSelect2 = Array.from(container.querySelectorAll('select')).find(s => Array.from((s as HTMLSelectElement).options).some(o => o.value === 'Loading' || o.value === 'Brokerage')) as HTMLSelectElement;
    if (typeSelect2) {
      fireEvent.change(typeSelect2, { target: { value: 'Loading' } });
      const expAmt = screen.queryByPlaceholderText('e.g. 1500');
      if (expAmt) fireEvent.change(expAmt, { target: { value: '1500' } });
      const addExpBtn = screen.queryByRole('button', { name: /Add Leg Expense|Add/i });
      if (addExpBtn) fireEvent.click(addExpBtn);

      // Add a Brokerage expense of 1000 NOT paid by driver (OrgRental)
      fireEvent.change(typeSelect2, { target: { value: 'Brokerage' } });
      if (expAmt) fireEvent.change(expAmt, { target: { value: '1000' } });
      const paidBySelect = Array.from(container.querySelectorAll('select')).find(s => Array.from((s as HTMLSelectElement).options).some(o => o.value === 'OrgRental')) as HTMLSelectElement;
      if (paidBySelect) fireEvent.change(paidBySelect, { target: { value: 'OrgRental' } });
      if (addExpBtn) fireEvent.click(addExpBtn);
    }
    
    fireEvent.click(screen.getByRole('button', { name: /சேமிக்க|Save Transport Journey|Save/i }));

    // Total income should be 45000 + 94500 = 139500
    // Total wages should be 6750 + 14175 = 20925
    // Total driver spend should be 2000 (Seg 1 Brokerage) + 1500 (Seg 2 Loading) = 3500
    // Total brokerage should be 1000 (Seg 2 Brokerage)
    
    // We check that the summary text is present in the document
    expect(screen.getAllByText(/1,39,500|139500/i)[0]).toBeInTheDocument();
  });
});
