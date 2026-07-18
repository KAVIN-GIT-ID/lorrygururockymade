import { createSignal, createEffect } from 'solid-js';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DriverMaster from './DriverMaster';
import { Driver, TripEntry, ExpenseEntry, Account } from '../types';

const mockDrivers: Driver[] = [
  {
    id: 'dr-1',
    driverName: 'Karan Singh',
    phone: '9999988888',
    licenseNo: 'DL-5555',
    status: 'Active',
  }
];

const mockTrips: TripEntry[] = [
  {
    id: 't-1',
    tripNo: 'TRIP-99',
    startDate: '2026-05-10',
    endDate: '2026-05-12',
    truckNo: 'MH-12-1234',
    driverName: 'Karan Singh',
    status: 'Completed',
    startingKM: 0,
    endingKM: 0,
    subTrips: [
      {
        id: 'st-1',
        loadingDate: '2026-05-10',
        routeFrom: 'Mumbai',
        routeTo: 'Pune',
        officeName: 'Mumbai HQ',
        income: 40000,
        driverWages: 3000, // Wages credited to driver
        loadingExpense: 500, // Loading expense paid by driver
        loadingPaidByDriver: true,
        unloadingExpense: 0,
        startingKM: 0,
        endingKM: 0
      }
    ],
    // Category 4 advances
    advances: [
      {
        id: 'adv-1',
        amount: 2000,
        date: '2026-05-10',
        fromAccountId: 'acc-1',
        receivedByDriverDirectly: true,
      }
    ],
    payments: []
  }
];

const mockExpenses: ExpenseEntry[] = [
  {
    id: 'exp-1',
    truckNo: 'MH-12-1234',
    expenseType: 'Driver Food',
    shopName: 'Dhaba',
    amount: 800,
    date: '2026-05-11',
    accountType: 'Driver',
    driverName: 'Karan Singh',
    paymentMode: 'Driver Hand cash',
    status: 'Approved'
  }
];

const mockAccounts: Account[] = [
  { id: 'acc-1', accountName: 'Cash Drawer', type: 'Cash', status: 'Active' }
];

describe('DriverMaster Component Tests', () => {
  it('should render the driver registry list correctly', () => {
    render(
      <DriverMaster
        drivers={mockDrivers}
        onAddDriver={vi.fn()}
        onUpdateDriver={vi.fn()}
        onDeleteDriver={vi.fn()}
      />
    );

    expect(screen.getAllByText('Karan Singh')[0]).toBeInTheDocument();
    expect(screen.getAllByText('DL-5555')[0]).toBeInTheDocument();
  });

  it('should open form and submit a new driver', () => {
    const handleAdd = vi.fn();
    render(
      <DriverMaster
        drivers={mockDrivers}
        onAddDriver={handleAdd}
        onUpdateDriver={vi.fn()}
        onDeleteDriver={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add New Driver/i }));

    fireEvent.change(screen.getByLabelText(/Driver Name/i), { target: { value: 'Arjun Dev' } });
    fireEvent.change(screen.getByLabelText(/Contact Phone/i), { target: { value: '8888877777' } });
    fireEvent.change(screen.getByLabelText(/Driving License/i), { target: { value: 'DL-9999' } });

    fireEvent.click(screen.getByRole('button', { name: /Register Operator/i }));

    expect(handleAdd).toHaveBeenCalledTimes(1);
    expect(handleAdd).toHaveBeenCalledWith({
      driverName: 'Arjun Dev',
      phone: '+918888877777',
      licenseNo: 'DL-9999',
      status: 'Active',
      licenseFileId: undefined
    });
  });

  it('should calculate live driver settlement ledger statement correctly when a driver is selected', () => {
    render(
      <DriverMaster
        drivers={mockDrivers}
        trips={mockTrips}
        expenses={mockExpenses}
        accounts={mockAccounts}
        onAddDriver={vi.fn()}
        onUpdateDriver={vi.fn()}
        onDeleteDriver={vi.fn()}
      />
    );

    // Initial message
    expect(screen.getByText(/Select a driver from the dropdown/i)).toBeInTheDocument();

    // Select driver
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dr-1' } });

    // Math:
    // Category 4 advances = 2000
    // Driver Credits (wages = 3000, loading = 500, manual expense = 800) = 4300
    // Net outstanding = 4300 - 2000 = 2300 (Payable to driver)
    expect(screen.getByText('Total Expenses Paid by Driver')).toBeInTheDocument();
    expect(screen.getByText('₹4,300')).toBeInTheDocument();

    expect(screen.getByText('Total Advances Received')).toBeInTheDocument();
    expect(screen.getByText('₹2,000')).toBeInTheDocument();

    expect(screen.getByText('Net Outstanding Settlement')).toBeInTheDocument();
    expect(screen.getByText('₹2,300')).toBeInTheDocument();
    expect(screen.getByText(/Payable to Driver/i)).toBeInTheDocument();
  });

  it('should calculate live driver settlement ledger with recovery debits correctly when driver bears expense but office deducted it', () => {
    const mockOrgProfile = {
      organizationId: 'org-1',
      organizationName: 'Test Org',
      ownerEmail: 'owner@example.com',
      status: 'Active' as const,
      maxTrucksAllowed: 5,
      truckRequests: [],
      brokeragePolicy: 'DriverBears' as const,
    };

    const recoveryTrips: TripEntry[] = [
      {
        id: 't-2',
        tripNo: 'TRIP-100',
        startDate: '2026-05-15',
        endDate: '2026-05-17',
        truckNo: 'MH-12-1234',
        driverName: 'Karan Singh',
        status: 'Completed',
        startingKM: 0,
        endingKM: 0,
        subTrips: [
          {
            id: 'st-2',
            loadingDate: '2026-05-15',
            routeFrom: 'Mumbai',
            routeTo: 'Pune',
            officeName: 'Mumbai HQ',
            income: 40000,
            driverWages: 3000, // Wages credited to driver
            loadingExpense: 0,
            unloadingExpense: 0,
            brokerageExpense: 1500, // Brokerage deducted from rental, driver bears it
            brokerageDeductedFrom: 'OrgRental',
            brokerageBears: 'Driver',
            startingKM: 0,
            endingKM: 0
          }
        ],
        advances: [
          {
            id: 'adv-2',
            amount: 1000,
            date: '2026-05-15',
            fromAccountId: 'acc-1',
            receivedByDriverDirectly: true,
          }
        ],
        payments: []
      }
    ];

    render(
      <DriverMaster
        drivers={mockDrivers}
        trips={recoveryTrips}
        expenses={[]}
        accounts={mockAccounts}
        onAddDriver={vi.fn()}
        onUpdateDriver={vi.fn()}
        onDeleteDriver={vi.fn()}
        orgProfile={mockOrgProfile}
      />
    );

    // Select driver
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dr-1' } });

    // Math:
    // Total Credits = driverWages (3000) = 3000
    // Total Advances = 1000
    // Total Recovery = brokerage (1500) = 1500
    // Net outstanding = 3000 - (1000 + 1500) = 500 (Payable to driver)
    expect(screen.getByText('Total Expenses Paid by Driver')).toBeInTheDocument();
    expect(screen.getByText('₹3,000')).toBeInTheDocument();

    expect(screen.getByText('Total Advances Received')).toBeInTheDocument();
    expect(screen.getByText('₹1,000')).toBeInTheDocument();

    expect(screen.getByText('Net Outstanding Settlement')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(screen.getByText(/Payable to Driver/i)).toBeInTheDocument();

    // Verify recovery debit row renders
    expect(screen.getByText('Driver Recovery (Brokerage)')).toBeInTheDocument();
  });

  it('should calculate live driver settlement ledger with dynamic cargo expenses correctly', () => {
    const dynamicCargoTrips: TripEntry[] = [
      {
        id: 't-3',
        tripNo: 'TRIP-101',
        startDate: '2026-05-20',
        endDate: '2026-05-22',
        truckNo: 'MH-12-1234',
        driverName: 'Karan Singh',
        status: 'Completed',
        startingKM: 0,
        endingKM: 0,
        subTrips: [
          {
            id: 'st-3',
            loadingDate: '2026-05-20',
            routeFrom: 'Mumbai',
            routeTo: 'Pune',
            officeName: 'Mumbai HQ',
            income: 40000,
            driverWages: 3000, // Wages credited to driver
            loadingExpense: 0,
            unloadingExpense: 0,
            startingKM: 0,
            endingKM: 0,
            cargoExpenses: [
              {
                id: 'exp-dyn-1',
                expenseType: 'Loading',
                amount: 1200,
                paidByDriver: true,
                deductedFrom: 'DriverDirect',
                bears: 'Org'
              },
              {
                id: 'exp-dyn-2',
                expenseType: 'Unloading',
                amount: 800,
                paidByDriver: false,
                deductedFrom: 'OrgRental',
                bears: 'Driver'
              },
              {
                id: 'exp-dyn-3',
                expenseType: 'Brokerage',
                amount: 1500,
                paidByDriver: true,
                deductedFrom: 'DriverDirect',
                bears: 'Office'
              }
            ]
          }
        ],
        advances: [
          {
            id: 'adv-3',
            amount: 1000,
            date: '2026-05-20',
            fromAccountId: 'acc-1',
            receivedByDriverDirectly: true,
          }
        ],
        payments: []
      }
    ];

    render(
      <DriverMaster
        drivers={mockDrivers}
        trips={dynamicCargoTrips}
        expenses={[]}
        accounts={mockAccounts}
        onAddDriver={vi.fn()}
        onUpdateDriver={vi.fn()}
        onDeleteDriver={vi.fn()}
      />
    );

    // Select driver
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dr-1' } });

    // Math:
    // Credits:
    //   driverWages = 3000
    //   Loading (Org bears, Driver paid) = 1200
    //   Brokerage (Office bears, Driver paid) = 1500
    //   Total Credits = 3000 + 1200 + 1500 = 5700
    // Debits (Recoveries):
    //   Unloading (Driver bears, not paid by driver) = 800
    // Total Advances = 1000
    // Net outstanding = 5700 - (1000 + 800) = 3900 (Payable to driver)
    expect(screen.getByText('Total Expenses Paid by Driver')).toBeInTheDocument();
    expect(screen.getByText('₹5,700')).toBeInTheDocument();

    expect(screen.getByText('Total Advances Received')).toBeInTheDocument();
    expect(screen.getByText('₹1,000')).toBeInTheDocument();

    expect(screen.getByText('Net Outstanding Settlement')).toBeInTheDocument();
    expect(screen.getByText('₹3,900')).toBeInTheDocument();
    expect(screen.getByText(/Payable to Driver/i)).toBeInTheDocument();

    // Verify recovery debit row renders
    expect(screen.getByText('Driver Recovery (Unloading)')).toBeInTheDocument();
    // Verify credit rows render
    expect(screen.getByText('Cargo Loading Expense')).toBeInTheDocument();
    expect(screen.getByText('Cargo Brokerage Expense')).toBeInTheDocument();
  });

  it('should calculate live driver settlement ledger correctly with OrgPaid cargo expenses', () => {
    const orgPaidCargoTrips: TripEntry[] = [
      {
        id: 't-4',
        tripNo: 'TRIP-102',
        startDate: '2026-05-20',
        endDate: '2026-05-22',
        truckNo: 'MH-12-1234',
        driverName: 'Karan Singh',
        status: 'Completed',
        startingKM: 0,
        endingKM: 0,
        subTrips: [
          {
            id: 'st-4',
            loadingDate: '2026-05-20',
            routeFrom: 'Mumbai',
            routeTo: 'Pune',
            officeName: 'Mumbai HQ',
            income: 40000,
            driverWages: 3000, // Wages credited to driver
            loadingExpense: 0,
            unloadingExpense: 0,
            startingKM: 0,
            endingKM: 0,
            cargoExpenses: [
              {
                id: 'exp-dyn-4',
                expenseType: 'Loading',
                amount: 1200,
                paidByDriver: false,
                deductedFrom: 'OrgPaid',
                bears: 'Org'
              }
            ]
          }
        ],
        advances: [
          {
            id: 'adv-4',
            amount: 1000,
            date: '2026-05-20',
            fromAccountId: 'acc-1',
            receivedByDriverDirectly: true,
          }
        ],
        payments: []
      }
    ];

    render(
      <DriverMaster
        drivers={mockDrivers}
        trips={orgPaidCargoTrips}
        expenses={[]}
        accounts={mockAccounts}
        onAddDriver={vi.fn()}
        onUpdateDriver={vi.fn()}
        onDeleteDriver={vi.fn()}
      />
    );

    // Select driver
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dr-1' } });

    // Math:
    // Credits:
    //   driverWages = 3000
    //   Loading (Org Paid, not paid by driver) = 0 for driver spend
    //   Total Credits = 3000
    // Debits (Recoveries) = 0
    // Total Advances = 1000
    // Net outstanding = 3000 - 1000 = 2000 (Payable to driver)
    expect(screen.getByText('Total Expenses Paid by Driver')).toBeInTheDocument();
    expect(screen.getByText('₹3,000')).toBeInTheDocument();

    expect(screen.getByText('Total Advances Received')).toBeInTheDocument();
    expect(screen.getByText('₹1,000')).toBeInTheDocument();

    expect(screen.getByText('Net Outstanding Settlement')).toBeInTheDocument();
    expect(screen.getByText('₹2,000')).toBeInTheDocument();
    expect(screen.getByText(/Payable to Driver/i)).toBeInTheDocument();
  });
});
