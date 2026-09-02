import { createSignal, createEffect } from 'solid-js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import TripList from './TripList';
import { TripEntry, Truck, Office, Account } from '../types';

const mockTrips: TripEntry[] = [
  {
    id: 't-101',
    tripNo: 'TRIP-A-01',
    startDate: '2026-05-01',
    endDate: '2026-05-05',
    truckNo: 'MH-12-1111',
    driverName: 'Ramesh Driver',
    status: 'Completed',
    startingKM: 0,
    endingKM: 0,
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
    payments: [{ id: 'p1', amount: 35000, date: '2026-05-02', receivedBy: 'acc-1' }]
  },
  {
    id: 't-102',
    tripNo: 'TRIP-B-02',
    startDate: '2026-05-10',
    endDate: '2026-05-12',
    truckNo: 'DL-01-2222',
    driverName: 'Suresh Driver',
    status: 'In Progress',
    startingKM: 0,
    endingKM: 0,
    subTrips: [
      {
        id: 'st-2',
        loadingDate: '2026-05-10',
        routeFrom: 'Delhi',
        routeTo: 'Noida',
        officeName: 'Delhi Hub',
        income: 60000,
        loadingExpense: 0,
        unloadingExpense: 0,
        driverWages: 0,
        startingKM: 0,
        endingKM: 0
      }
    ],
    payments: []
  }
];

const mockTrucks: Truck[] = [];
const mockOffices: Office[] = [];
const mockAccounts: Account[] = [];

describe('TripList Component Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('alert', vi.fn());
  });

  it('should render the list of trips in table rows', () => {
    render(() => (
      <TripList
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
      />
    ));

    expect(screen.getAllByText('TRIP-A-01')[0]).toBeInTheDocument();
    expect(screen.getAllByText('TRIP-B-02')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Ramesh Driver')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Suresh Driver')[0]).toBeInTheDocument();
  });

  it('should filter the list of trips based on search text input', () => {
    render(() => (
      <TripList
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
      />
    ));

    const searchInput = screen.getByPlaceholderText(/Search Trips, Trucks, Drivers/i);

    // Search for "MH-12"
    fireEvent.change(searchInput, { target: { value: 'MH-12' } });

    // Should only show TRIP-A-01, and not TRIP-B-02
    expect(screen.getAllByText('TRIP-A-01')[0]).toBeInTheDocument();
    expect(screen.queryByText('TRIP-B-02')).not.toBeInTheDocument();
  });

  it('should trigger onEditEntry when the modify button is clicked', () => {
    const handleEdit = vi.fn();
    render(() => (
      <TripList
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        onEditEntry={handleEdit}
        onDeleteEntry={vi.fn()}
      />
    ));

    const editBtns = screen.getAllByTitle('Modify Cargo Entry specs');
    fireEvent.click(editBtns[1]); // Click edit on second rendered row (t-101) in sorted order

    expect(handleEdit).toHaveBeenCalledTimes(1);
    expect(handleEdit).toHaveBeenCalledWith(mockTrips[0]);
  });

  it('should trigger onDeleteEntry after user confirms deletion', () => {
    const handleDelete = vi.fn();
    const handleConfirm = vi.fn((msg, onConfirm) => onConfirm()); // Auto-confirm

    render(() => (
      <TripList
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={handleDelete}
        confirmAction={handleConfirm}
      />
    ));

    const deleteBtns = screen.getAllByTitle('Wipe Cargo Entry record');
    fireEvent.click(deleteBtns[0]); // Delete first rendered row (t-102)

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleDelete).toHaveBeenCalledWith('t-102');
  });

  it('should open details inspector overlay modal when clicking Eye button', () => {
    render(() => (
      <TripList
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
      />
    ));

    expect(screen.queryByText('Trip ID (Group Code)')).not.toBeInTheDocument();

    const viewBtns = screen.getAllByTitle('Full 23-Columns Sheet Inspector');
    fireEvent.click(viewBtns[0]); // Inspect TRIP-A-01

    expect(screen.getByText('Trip ID (Group Code)')).toBeInTheDocument();
    expect(screen.getByText('Vehicle & Number')).toBeInTheDocument();
  });

  it('should refresh displayed trips when trips prop changes', () => {
    const newTrip: TripEntry = {
      id: 't-new',
      tripNo: 'TRIP-NEW-99',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      truckNo: 'MH-12-NEW',
      driverName: 'New Driver',
      status: 'In Progress',
      startingKM: 0,
      endingKM: 0,
      subTrips: [],
      payments: []
    };

    const [trips, setTrips] = createSignal<TripEntry[]>([mockTrips[0]]);
    render(() => (
      <TripList
        trips={trips()}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
      />
    ));

    expect(screen.getAllByText('TRIP-A-01')[0]).toBeInTheDocument();
    expect(screen.queryByText('TRIP-NEW-99')).not.toBeInTheDocument();

    // Rerender with new trips list via signal update
    setTrips([mockTrips[0], newTrip]);

    expect(screen.getAllByText('TRIP-A-01')[0]).toBeInTheDocument();
    expect(screen.getAllByText('TRIP-NEW-99')[0]).toBeInTheDocument();
  });

  it('should render Pay/Recover status badge based on calculated driver balance', () => {
    const tripPay: TripEntry = {
      id: 't-pay',
      tripNo: 'TRIP-PAY-01',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      truckNo: 'MH-12-PAY',
      driverName: 'Pay Driver',
      status: 'In Progress',
      startingKM: 0,
      endingKM: 0,
      fuels: [
        {
          id: 'f-1',
          date: '2026-05-01',
          liters: 100,
          rate: 90,
          amount: 9000,
          shopName: 'Bunk A',
          paymentMode: 'driver'
        }
      ],
      subTrips: [],
      payments: [],
      advances: []
    };

    const tripRecover: TripEntry = {
      id: 't-recover',
      tripNo: 'TRIP-RECOV-01',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      truckNo: 'MH-12-RECOV',
      driverName: 'Recover Driver',
      status: 'In Progress',
      startingKM: 0,
      endingKM: 0,
      fuels: [],
      subTrips: [],
      payments: [],
      advances: [
        {
          id: 'a-1',
          amount: 5000,
          date: '2026-05-01',
          fromAccountId: 'acc-1',
          receivedByDriverDirectly: true
        }
      ]
    };

    render(() => (
      <TripList
        trips={[tripPay, tripRecover]}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
      />
    ));

    expect(screen.getByText(/Pay: ₹9,000/i)).toBeInTheDocument();
    expect(screen.getByText(/Recover: ₹5,000/i)).toBeInTheDocument();
  });

  it('should support carrying forward a negative driver balance to another trip', async () => {
    const tripA: TripEntry = {
      id: 't-a',
      tripNo: 'TRIP-A',
      startDate: '2026-05-10',
      endDate: '2026-05-15',
      truckNo: 'MH-12-A',
      driverName: 'Same Driver',
      status: 'In Progress',
      startingKM: 0,
      endingKM: 0,
      fuels: [],
      subTrips: [],
      payments: [],
      advances: [
        {
          id: 'adv-a',
          amount: 2000,
          date: '2026-05-10',
          fromAccountId: 'acc-1',
          receivedByDriverDirectly: true
        }
      ]
    };

    const tripB: TripEntry = {
      id: 't-b',
      tripNo: 'TRIP-B',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      truckNo: 'MH-12-B',
      driverName: 'Same Driver',
      status: 'In Progress',
      startingKM: 0,
      endingKM: 0,
      fuels: [],
      subTrips: [],
      payments: [],
      advances: []
    };

    const handleSaveTrips = vi.fn();
    const handleConfirm = vi.fn((msg, onConfirm) => onConfirm());
    const { container } = render(() => (
      <TripList
        trips={[tripA, tripB]}
        trucks={mockTrucks}
        offices={[]}
        accounts={mockAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onSaveTrips={handleSaveTrips}
        confirmAction={handleConfirm}
      />
    ));

    // Open detail modal for TRIP-A by clicking inspector Eye button
    const eyeBtnA = screen.getAllByTitle('Full 23-Columns Sheet Inspector')[0];
    fireEvent.click(eyeBtnA);
    await new Promise(r => setTimeout(r, 20));

    // Open Driver Settlement tab and select Inter-Trip Transfer mode
    fireEvent.click(screen.getAllByText('Driver Settlement')[0]);
    await new Promise(r => setTimeout(r, 20));
    fireEvent.click(screen.getByText('Move to Another Trip'));
    await new Promise(r => setTimeout(r, 50));

    // Select TRIP-B and click Carry Forward
    const select = screen.getByDisplayValue('-- Choose Target Trip --') as HTMLSelectElement;
    select.value = 'TRIP-B';
    fireEvent.input(select, { target: { value: 'TRIP-B' } });
    fireEvent.change(select, { target: { value: 'TRIP-B' } });

    const btn = container.querySelector('#btn_confirm_inter_trip') as HTMLButtonElement || screen.getByRole('button', { name: /Confirm Inter-Trip Transfer/i });
    fireEvent.click(btn);

    // Verify handleSaveTrips was called with updated advances
    expect(handleSaveTrips).toHaveBeenCalledTimes(1);
    const savedTrips = handleSaveTrips.mock.calls[0][0] as TripEntry[];

    // Source Trip (TRIP-A) should have a negative advance added to offset balance to 0
    const sourceTrip = savedTrips.find(t => t.id === 't-a')!;
    expect(sourceTrip.advances).toHaveLength(2);
    expect(sourceTrip.advances![1].amount).toBe(-2000);

    // Dest Trip (TRIP-B) should have a positive advance of 2000 added
    const destTrip = savedTrips.find(t => t.id === 't-b')!;
    expect(destTrip.advances).toHaveLength(1);
    expect(destTrip.advances![0].amount).toBe(2000);
  });

  it('should show warning if there is no active trip under same driver name when trying to carry forward deficit', () => {
    const tripA: TripEntry = {
      id: 't-a',
      tripNo: 'TRIP-A',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      truckNo: 'MH-12-A',
      driverName: 'Same Driver',
      status: 'In Progress',
      startingKM: 0,
      endingKM: 0,
      fuels: [],
      subTrips: [],
      payments: [],
      advances: [
        {
          id: 'adv-a',
          amount: 2000,
          date: '2026-05-01',
          fromAccountId: 'acc-1',
          receivedByDriverDirectly: true
        }
      ]
    };

    // Another active trip exists, but under a DIFFERENT driver
    const tripB: TripEntry = {
      id: 't-b',
      tripNo: 'TRIP-B',
      startDate: '2026-05-06',
      endDate: '2026-05-10',
      truckNo: 'MH-12-B',
      driverName: 'Different Driver',
      status: 'In Progress',
      startingKM: 0,
      endingKM: 0,
      fuels: [],
      subTrips: [],
      payments: [],
      advances: []
    };

    render(() => (
      <TripList
        trips={[tripA, tripB]}
        trucks={[]}
        offices={[]}
        accounts={[]}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onSaveTrips={vi.fn()}
      />
    ));

    // Open detail modal for TRIP-A by clicking inspector Eye button
    const eyeBtn1 = screen.getAllByTitle('Full 23-Columns Sheet Inspector')[0];
    fireEvent.click(eyeBtn1);

    // Open Driver Settlement tab and select Inter-Trip Transfer mode
    fireEvent.click(screen.getAllByText('Driver Settlement')[0]);
    fireEvent.click(screen.getByText('Move to Another Trip'));

    // Select box is present for choosing target trip
    expect(screen.getByDisplayValue('-- Choose Target Trip --')).toBeInTheDocument();
  });

  it('should support settling negative driver balance to a company account', () => {
    const tripA: TripEntry = {
      id: 't-a',
      tripNo: 'TRIP-A',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      truckNo: 'MH-12-A',
      driverName: 'Same Driver',
      status: 'In Progress',
      startingKM: 0,
      endingKM: 0,
      fuels: [],
      subTrips: [],
      payments: [],
      advances: [
        {
          id: 'adv-a',
          amount: 2000,
          date: '2026-05-01',
          fromAccountId: 'acc-1',
          receivedByDriverDirectly: true
        }
      ]
    };

    const activeAccounts: Account[] = [
      { id: 'acc-cash', accountName: 'Office Cash', type: 'Cash', status: 'Active' }
    ];

    const handleSaveTrips = vi.fn();
    const handleConfirm = vi.fn((msg, onConfirm) => onConfirm());

    const { container } = render(() => (
      <TripList
        trips={[tripA]}
        trucks={[]}
        offices={[]}
        accounts={activeAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onSaveTrips={handleSaveTrips}
        confirmAction={handleConfirm}
      />
    ));

    // Open detail modal for TRIP-A by clicking inspector Eye button
    const eyeBtn2 = screen.getAllByTitle('Full 23-Columns Sheet Inspector')[0];
    fireEvent.click(eyeBtn2);

    // Select Driver Settlement tab
    fireEvent.click(screen.getAllByText('Driver Settlement')[0]);

    // Enter custom transaction date if present
    const dateInput = container.querySelector('input.w-28[type="date"]');
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: '2026-05-20' } });
    }

    // Select company account and click Confirm Account Settlement
    const select = screen.getByDisplayValue('-- Choose Account --');
    fireEvent.change(select, { target: { value: 'acc-cash' } });

    const btn = screen.getByRole('button', { name: /Confirm Account Settlement/i });
    fireEvent.click(btn);

    // Verify handleSaveTrips was called with negative advance added
    expect(handleSaveTrips).toHaveBeenCalledTimes(1);
    const savedTrips = handleSaveTrips.mock.calls[0][0] as TripEntry[];
    const sourceTrip = savedTrips.find(t => t.id === 't-a')!;
    expect(sourceTrip.advances).toHaveLength(2);
    expect(sourceTrip.advances![1].amount).toBe(-2000);
    expect(sourceTrip.advances![1].fromAccountId).toBe('acc-cash');
  });

  it('should support paying driver positive balance from any company account', () => {
    const tripA: TripEntry = {
      id: 't-a',
      tripNo: 'TRIP-A',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      truckNo: 'MH-12-A',
      driverName: 'Same Driver',
      status: 'In Progress',
      startingKM: 0,
      endingKM: 0,
      fuels: [
        {
          id: 'f-1',
          date: '2026-05-01',
          liters: 100,
          rate: 90,
          amount: 9000,
          paymentMode: 'driver'
        }
      ],
      subTrips: [],
      payments: [],
      advances: []
    };

    const activeAccounts: Account[] = [
      { id: 'acc-bank', accountName: 'Main Bank', type: 'Bank', status: 'Active' }
    ];

    const handleSaveTrips = vi.fn();
    const handleConfirm = vi.fn((msg, onConfirm) => onConfirm());

    render(() => (
      <TripList
        trips={[tripA]}
        trucks={[]}
        offices={[]}
        accounts={activeAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onSaveTrips={handleSaveTrips}
        confirmAction={handleConfirm}
      />
    ));

    // Open detail modal for TRIP-A by clicking inspector Eye button
    const eyeBtn3 = screen.getAllByTitle('Full 23-Columns Sheet Inspector')[0];
    fireEvent.click(eyeBtn3);

    // Select Driver Settlement tab
    fireEvent.click(screen.getAllByText('Driver Settlement')[0]);

    // Select company account and click Confirm Account Settlement
    const select = screen.getByDisplayValue('-- Choose Account --');
    fireEvent.change(select, { target: { value: 'acc-bank' } });

    const btn = screen.getByRole('button', { name: /Confirm Account Settlement/i });
    fireEvent.click(btn);

    // Verify handleSaveTrips was called with positive advance added
    expect(handleSaveTrips).toHaveBeenCalledTimes(1);
    const savedTrips = handleSaveTrips.mock.calls[0][0] as TripEntry[];
    const sourceTrip = savedTrips.find(t => t.id === 't-a')!;
    expect(sourceTrip.advances).toHaveLength(1);
    expect(sourceTrip.advances![0].amount).toBe(9000);
    expect(sourceTrip.advances![0].fromAccountId).toBe('acc-bank');
  });

  it('should support settling negative driver balance to the built-in Cash option', () => {
    const tripA: TripEntry = {
      id: 't-a',
      tripNo: 'TRIP-A',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      truckNo: 'MH-12-A',
      driverName: 'Same Driver',
      status: 'In Progress',
      startingKM: 0,
      endingKM: 0,
      fuels: [],
      subTrips: [],
      payments: [],
      advances: [
        {
          id: 'adv-a',
          amount: 2000,
          date: '2026-05-01',
          fromAccountId: 'acc-1',
          receivedByDriverDirectly: true
        }
      ]
    };

    const handleSaveTrips = vi.fn();
    const handleConfirm = vi.fn((msg, onConfirm) => onConfirm());

    render(() => (
      <TripList
        trips={[tripA]}
        trucks={[]}
        offices={[]}
        accounts={[]}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
        onSaveTrips={handleSaveTrips}
        confirmAction={handleConfirm}
      />
    ));

    // Open detail modal for TRIP-A by clicking inspector Eye button
    const eyeBtn4 = screen.getAllByTitle('Full 23-Columns Sheet Inspector')[0];
    fireEvent.click(eyeBtn4);

    // Select Driver Settlement tab
    fireEvent.click(screen.getAllByText('Driver Settlement')[0]);

    // Select Cash account and click Confirm Account Settlement
    const select = screen.getByDisplayValue('-- Choose Account --');
    fireEvent.change(select, { target: { value: 'Cash' } });

    const btn = screen.getByRole('button', { name: /Confirm Account Settlement/i });
    fireEvent.click(btn);

    // Verify handleSaveTrips was called with negative advance added
    expect(handleSaveTrips).toHaveBeenCalledTimes(1);
    const savedTrips = handleSaveTrips.mock.calls[0][0] as TripEntry[];
    const sourceTrip = savedTrips.find(t => t.id === 't-a')!;
    expect(sourceTrip.advances).toHaveLength(2);
    expect(sourceTrip.advances![1].amount).toBe(-2000);
    expect(sourceTrip.advances![1].fromAccountId).toBe('Cash');
  });

  it('should filter based on checked status boxes, defaulting to Pending, In Progress, Completed', () => {
    const testTrips: TripEntry[] = [
      {
        id: 't-1',
        tripNo: 'TRIP-PENDING',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        truckNo: 'MH-12-1111',
        driverName: 'Ramesh',
        status: 'Pending',
        startingKM: 0,
        endingKM: 0,
        subTrips: [],
        payments: []
      },
      {
        id: 't-2',
        tripNo: 'TRIP-SETTLED',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        truckNo: 'MH-12-1111',
        driverName: 'Ramesh',
        status: 'Settled',
        startingKM: 0,
        endingKM: 0,
        subTrips: [],
        payments: []
      }
    ];

    render(() => (
      <TripList
        trips={testTrips}
        trucks={[]}
        offices={[]}
        accounts={[]}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
      />
    ));

    // Default select should include Pending (TRIP-PENDING visible) but exclude Settled (TRIP-SETTLED hidden)
    expect(screen.getAllByText('TRIP-PENDING')[0]).toBeInTheDocument();
    expect(screen.queryByText('TRIP-SETTLED')).not.toBeInTheDocument();

    // Open status dropdown
    const dropdownTrigger = screen.getByRole('button', { name: /Pending, In Progress, Completed/i });
    fireEvent.click(dropdownTrigger);

    // Toggle Settled checkbox to show Settled trips
    const settledCheckbox = screen.getByLabelText('Settled');
    fireEvent.click(settledCheckbox);

    // Both should be visible now
    expect(screen.getAllByText('TRIP-PENDING')[0]).toBeInTheDocument();
    expect(screen.getAllByText('TRIP-SETTLED')[0]).toBeInTheDocument();

    // Toggle Pending checkbox off to hide Pending trips
    const pendingCheckbox = screen.getByLabelText('Pending');
    fireEvent.click(pendingCheckbox);

    expect(screen.queryByText('TRIP-PENDING')).not.toBeInTheDocument();
    expect(screen.getAllByText('TRIP-SETTLED')[0]).toBeInTheDocument();
  });
});


