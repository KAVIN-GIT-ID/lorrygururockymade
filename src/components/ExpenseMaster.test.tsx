import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExpenseMaster from './ExpenseMaster';
import { ExpenseEntry, Truck, Account, Driver } from '../types';

const mockExpenses: ExpenseEntry[] = [
  {
    id: 'exp-1',
    truckNo: 'MH-12-PQ-9999',
    expenseType: 'Maintenance',
    shopName: 'TVS Auto Shop',
    amount: 1500,
    paymentMode: 'Cash',
    date: '2026-05-15',
    status: 'Paid',
    accountType: 'Account'
  },
  {
    id: 'exp-2',
    truckNo: 'MH-12-PQ-9999',
    expenseType: 'Spare Parts',
    shopName: 'MRF Tyres Depot',
    amount: 5000,
    paymentMode: 'Karan Singh',
    date: '2026-05-18',
    status: 'Pending',
    accountType: 'Driver',
    driverName: 'Karan Singh'
  }
];

const mockTrucks: Truck[] = [
  { id: 'tr-1', truckNo: 'MH-12-PQ-9999', model: 'TATA 3118', status: 'Active', isApproved: true }
];

const mockAccounts: Account[] = [
  { id: 'acc-1', accountName: 'Cash Drawer', type: 'Cash', status: 'Active' }
];

const mockDrivers: Driver[] = [
  { id: 'dr-1', driverName: 'Karan Singh', phone: '9999988888', licenseNo: 'DL-5555', status: 'Active' }
];

describe('ExpenseMaster Component Tests', () => {
  it('should render header summary cards and filtered totals correctly', () => {
    render(
      <ExpenseMaster
        expenses={mockExpenses}
        trucks={mockTrucks}
        accounts={mockAccounts}
        drivers={mockDrivers}
        onAddExpense={vi.fn()}
        onUpdateExpense={vi.fn()}
        onDeleteExpense={vi.fn()}
      />
    );

    // Filtered totals: Paid (1500) + Pending (5000) = 6500
    expect(screen.getByText('Total Filtered Cost')).toBeInTheDocument();
    expect(screen.getByText('₹6,500')).toBeInTheDocument();

    expect(screen.getByText('Paid Settlements')).toBeInTheDocument();
    expect(screen.getByText('₹1,500')).toBeInTheDocument();

    expect(screen.getByText('Pending/On-Credit')).toBeInTheDocument();
    expect(screen.getByText('₹5,000')).toBeInTheDocument();
  });

  it('should render all listed expenses in the grid table', () => {
    render(
      <ExpenseMaster
        expenses={mockExpenses}
        trucks={mockTrucks}
        accounts={mockAccounts}
        drivers={mockDrivers}
        onAddExpense={vi.fn()}
        onUpdateExpense={vi.fn()}
        onDeleteExpense={vi.fn()}
      />
    );

    expect(screen.getByText('TVS Auto Shop')).toBeInTheDocument();
    expect(screen.getByText('MRF Tyres Depot')).toBeInTheDocument();
    expect(screen.getByText('Driver: Karan Singh')).toBeInTheDocument();
  });

  it('should filter table rows dynamically based on the search query input', () => {
    render(
      <ExpenseMaster
        expenses={mockExpenses}
        trucks={mockTrucks}
        accounts={mockAccounts}
        drivers={mockDrivers}
        onAddExpense={vi.fn()}
        onUpdateExpense={vi.fn()}
        onDeleteExpense={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search shop name or expense type/i);
    
    // Search for "MRF"
    fireEvent.change(searchInput, { target: { value: 'MRF' } });

    expect(screen.queryByText('TVS Auto Shop')).not.toBeInTheDocument();
    expect(screen.getByText('MRF Tyres Depot')).toBeInTheDocument();
  });

  it('should trigger onAddExpense callback on valid form submit', () => {
    const handleAdd = vi.fn();
    render(
      <ExpenseMaster
        expenses={mockExpenses}
        trucks={mockTrucks}
        accounts={mockAccounts}
        drivers={mockDrivers}
        onAddExpense={handleAdd}
        onUpdateExpense={vi.fn()}
        onDeleteExpense={vi.fn()}
      />
    );

    // Open form
    fireEvent.click(screen.getByRole('button', { name: /Register New Expense/i }));

    // Fill form
    fireEvent.change(screen.getByLabelText(/Truck ID No/i), { target: { value: 'MH-12-PQ-9999' } });
    fireEvent.change(screen.getByLabelText(/Expense Type/i), { target: { value: 'Breakdown' } });
    fireEvent.change(screen.getByLabelText(/Shop \/ Supplier Name/i), { target: { value: 'Roadside Garage' } });
    fireEvent.change(screen.getByLabelText(/Expense Amount/i), { target: { value: '800' } });
    fireEvent.change(screen.getByLabelText(/Account Type/i), { target: { value: 'Account' } });
    fireEvent.change(screen.getByLabelText(/Ledger Account \/ Mode/i), { target: { value: 'Cash/General' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Save Ledger Entry/i }));

    expect(handleAdd).toHaveBeenCalledTimes(1);
    expect(handleAdd).toHaveBeenCalledWith({
      truckNo: 'MH-12-PQ-9999',
      expenseType: 'Breakdown',
      shopName: 'Roadside Garage',
      amount: 800,
      paymentMode: 'Cash/General',
      date: expect.any(String),
      status: 'Paid',
      accountType: 'Account',
      driverName: undefined
    });
  });
});
