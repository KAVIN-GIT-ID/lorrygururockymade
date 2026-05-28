import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  it('should render the list of trips in table rows', () => {
    render(
      <TripList
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
      />
    );

    expect(screen.getAllByText('TRIP-A-01')[0]).toBeInTheDocument();
    expect(screen.getAllByText('TRIP-B-02')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Ramesh Driver')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Suresh Driver')[0]).toBeInTheDocument();
  });

  it('should filter the list of trips based on search text input', () => {
    render(
      <TripList
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search Trips, Trucks, Drivers/i);
    
    // Search for "MH-12"
    fireEvent.change(searchInput, { target: { value: 'MH-12' } });

    // Should only show TRIP-A-01, and not TRIP-B-02
    expect(screen.getAllByText('TRIP-A-01')[0]).toBeInTheDocument();
    expect(screen.queryByText('TRIP-B-02')).not.toBeInTheDocument();
  });

  it('should trigger onEditEntry when the modify button is clicked', () => {
    const handleEdit = vi.fn();
    render(
      <TripList
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        onEditEntry={handleEdit}
        onDeleteEntry={vi.fn()}
      />
    );

    const editBtns = screen.getAllByTitle('Modify Cargo Entry specs');
    fireEvent.click(editBtns[1]); // Click edit on second rendered row (t-101) in sorted order

    expect(handleEdit).toHaveBeenCalledTimes(1);
    expect(handleEdit).toHaveBeenCalledWith(mockTrips[0]);
  });

  it('should trigger onDeleteEntry after user confirms deletion', () => {
    const handleDelete = vi.fn();
    const handleConfirm = vi.fn((msg, onConfirm) => onConfirm()); // Auto-confirm
    
    render(
      <TripList
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={handleDelete}
        confirmAction={handleConfirm}
      />
    );

    const deleteBtns = screen.getAllByTitle('Wipe Cargo Entry record');
    fireEvent.click(deleteBtns[0]); // Delete first rendered row (t-102)

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleDelete).toHaveBeenCalledWith('t-102');
  });

  it('should open details inspector overlay modal when clicking Eye button', () => {
    render(
      <TripList
        trips={mockTrips}
        trucks={mockTrucks}
        offices={mockOffices}
        accounts={mockAccounts}
        onEditEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
      />
    );

    expect(screen.queryByText('Ultimate Fleet-Book Document Ledger')).not.toBeInTheDocument();

    const viewBtns = screen.getAllByTitle('Full 23-Columns Sheet Inspector');
    fireEvent.click(viewBtns[0]); // Inspect TRIP-A-01

    expect(screen.getByText('Ultimate Fleet-Book Document Ledger')).toBeInTheDocument();
    expect(screen.getByText('1. Truck No')).toBeInTheDocument();
  });
});
