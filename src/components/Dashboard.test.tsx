import { createSignal, createEffect } from 'solid-js';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import Dashboard from './Dashboard';
import { TripEntry, Truck, Office, Account } from '../types';

const mockTrips: TripEntry[] = [
  {
    id: 'trip-1',
    tripNo: 'TRIP-101',
    startDate: '2026-05-10',
    endDate: '2026-05-15',
    truckNo: 'MH-12-PQ-1234',
    driverName: 'Ramesh Kumar',
    status: 'Completed',
    notes: 'Short haul',
    subTrips: [
      {
        id: 'st-1',
        loadingDate: '2026-05-10',
        routeFrom: 'Mumbai',
        routeTo: 'Pune',
        officeName: 'Mumbai HQ',
        income: 50000,
        loadingExpense: 0,
        unloadingExpense: 0,
        driverWages: 0,
        startingKM: 0,
        endingKM: 0
      }
    ],
    payments: [
      {
        id: 'p-1',
        amount: 40000,
        receivedBy: 'acc-1',
        date: '2026-05-11',
      }
    ],
    dieselAmount: 20000,
    dieselLiters: 200,
    dieselRate: 100,
    startingKM: 0,
    endingKM: 0
  },
  {
    id: 'trip-2',
    tripNo: 'TRIP-102',
    startDate: '2026-05-20',
    endDate: '2026-05-22',
    truckNo: 'DL-01-AB-5678',
    driverName: 'Suresh Singh',
    status: 'In Progress',
    startingKM: 0,
    endingKM: 0,
    subTrips: [
      {
        id: 'st-2',
        loadingDate: '2026-05-20',
        routeFrom: 'Delhi',
        routeTo: 'Jaipur',
        officeName: 'Delhi Hub',
        income: 30000,
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

const mockTrucks: Truck[] = [
  { id: 'tr-1', truckNo: 'MH-12-PQ-1234', model: 'Tata Prime', status: 'Active' },
  { id: 'tr-2', truckNo: 'DL-01-AB-5678', model: 'Leyland U-Truck', status: 'Active' }
];

const mockOffices: Office[] = [
  { id: 'off-1', officeName: 'Mumbai HQ', status: 'Active' },
  { id: 'off-2', officeName: 'Delhi Hub', status: 'Active' }
];

const mockAccounts: Account[] = [
  { id: 'acc-1', accountName: 'State Bank Current A/C', type: 'Cash', status: 'Active' }
];

describe('Dashboard Component Tests', () => {
  it('should render income, outstanding, and profit statistics correctly', () => {
    render(() => (
      <Dashboard
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        activeMonth="ALL"
        activeYear="2026"
        setActiveMonth={() => {}}
        setActiveYear={() => {}}
        currentUserRights={{
          isAdmin: true,
          isApproved: true,
          organizationId: 'org-1',
          canViewTrips: true,
          canViewExpenses: true,
        } as any}
      />
    ));

    // Total income = 50000 + 30000 = 80,000
    // Total expenses = 20000
    // Outstanding = (50000 - 40000) + 30000 = 40,000
    // Profit = 80000 - 20000 = 60,000
    expect(screen.getByText('Total Billed Income')).toBeInTheDocument();
    expect(screen.getAllByText('₹80,000')[0]).toBeInTheDocument();

    expect(screen.getByText('Total Outstanding')).toBeInTheDocument();
    expect(screen.getAllByText('₹40,000')[0]).toBeInTheDocument();

    expect(screen.getByText('Operational Expenses')).toBeInTheDocument();
    expect(screen.getAllByText('₹20,000')[0]).toBeInTheDocument();

    expect(screen.getByText('Net Adjusted Profit')).toBeInTheDocument();
    expect(screen.getAllByText('₹60,000')[0]).toBeInTheDocument();
  });

  it('should display correct counts for trip status categories', () => {
    render(() => (
      <Dashboard
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        activeMonth="ALL"
        activeYear="2026"
        setActiveMonth={() => {}}
        setActiveYear={() => {}}
      />
    ));

    expect(screen.getByText('Pending Advances')).toBeInTheDocument();
    expect(screen.getByText('Active Transitions')).toBeInTheDocument();
    expect(screen.getByText('Delivered Goods')).toBeInTheDocument();
    expect(screen.getByText('Settled Trips')).toBeInTheDocument();

    // Pending: 0, In Progress: 1, Completed: 1, Paid: 0
    const inProgressCount = screen.getAllByText('1')[0];
    expect(inProgressCount).toBeInTheDocument();
  });

  it('should display collection account progress correctly', () => {
    render(() => (
      <Dashboard
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        activeMonth="ALL"
        activeYear="2026"
        setActiveMonth={() => {}}
        setActiveYear={() => {}}
      />
    ));

    expect(screen.getByText('Receipts by Accounts')).toBeInTheDocument();
    expect(screen.getByText('State Bank Current A/C')).toBeInTheDocument();
  });

  it('should compute total outstanding from allTrips while billed income uses trips', () => {
    render(() => (
      <Dashboard
        trips={[mockTrips[0]]}
        allTrips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        activeMonth="05"
        activeYear="2026"
        setActiveMonth={() => {}}
        setActiveYear={() => {}}
        currentUserRights={{
          isAdmin: true,
          isApproved: true,
          organizationId: 'org-1',
          canViewTrips: true,
          canViewExpenses: true,
        } as any}
      />
    ));

    // Total income should be only for mockTrips[0] => 50,000
    expect(screen.getByText('Total Billed Income')).toBeInTheDocument();
    expect(screen.getAllByText('₹50,000')[0]).toBeInTheDocument();

    // Total outstanding should be for allTrips => (50000-40000) + 30000 = 40,000
    expect(screen.getByText('Total Outstanding')).toBeInTheDocument();
    expect(screen.getAllByText('₹40,000')[0]).toBeInTheDocument();
  });

  it('should not deduct crossing expense from outstanding balance if crossingDeductedFrom is DriverDirect', () => {
    const tripWithDriverDirectCrossing: TripEntry = {
      id: 'trip-crossing-1',
      tripNo: 'TRIP-CROSS-1',
      startDate: '2026-05-10',
      endDate: '2026-05-15',
      truckNo: 'MH-12-PQ-1234',
      driverName: 'Ramesh Kumar',
      status: 'Completed',
      startingKM: 0,
      endingKM: 0,
      subTrips: [
        {
          id: 'st-crossing-1',
          loadingDate: '2026-05-10',
          routeFrom: 'Mumbai',
          routeTo: 'Pune',
          officeName: 'Mumbai HQ',
          income: 50000,
          loadingExpense: 0,
          unloadingExpense: 0,
          crossingExpense: 2500,
          crossingDeductedFrom: 'DriverDirect',
          driverWages: 0,
          startingKM: 0,
          endingKM: 0
        }
      ],
      payments: [
        {
          id: 'p-crossing-1',
          amount: 40000,
          receivedBy: 'acc-1',
          date: '2026-05-11',
        }
      ]
    };

    render(() => (
      <Dashboard
        trips={[tripWithDriverDirectCrossing]}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        activeMonth="ALL"
        activeYear="2026"
        setActiveMonth={() => {}}
        setActiveYear={() => {}}
        currentUserRights={{
          isAdmin: true,
          isApproved: true,
          organizationId: 'org-1',
          canViewTrips: true,
          canViewExpenses: true,
        } as any}
      />
    ));

    // Outstanding = income (50000) - totalOrgRentalDeductions (0 because crossing is DriverDirect) - payments (40000) = 10,000
    // If crossing was deducted from rental, outstanding would be 50000 - 2500 - 40000 = 7,500
    expect(screen.getByText('Total Outstanding')).toBeInTheDocument();
    expect(screen.getAllByText('₹10,000')[0]).toBeInTheDocument();
  });
});
