import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    render(
      <Dashboard
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        currentUserRights={{
          isAdmin: true,
          isApproved: true,
          organizationId: 'org-1',
          canViewTrips: true,
          canViewExpenses: true,
        } as any}
      />
    );

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
    render(
      <Dashboard
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
      />
    );

    expect(screen.getByText('Pending Advances')).toBeInTheDocument();
    expect(screen.getByText('Active Transitions')).toBeInTheDocument();
    expect(screen.getByText('Delivered Goods')).toBeInTheDocument();
    expect(screen.getByText('Settled Trips')).toBeInTheDocument();

    // Pending: 0, In Progress: 1, Completed: 1, Paid: 0
    const inProgressCount = screen.getAllByText('1')[0];
    expect(inProgressCount).toBeInTheDocument();
  });

  it('should display collection account progress correctly', () => {
    render(
      <Dashboard
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
      />
    );

    expect(screen.getByText('Receipts by Accounts')).toBeInTheDocument();
    expect(screen.getByText('State Bank Current A/C')).toBeInTheDocument();
  });
});
