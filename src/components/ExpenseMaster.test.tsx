import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import ExpenseMaster from './ExpenseMaster';
import { ExpenseEntry, Truck, Account, Driver } from '../types';

// ── Hoisted spies ────────────────────────────────────────────────────────────
const mockAddExpense = vi.hoisted(() => vi.fn());
const mockUpdateExpense = vi.hoisted(() => vi.fn());
const mockDeleteExpense = vi.hoisted(() => vi.fn());

const mockExpensesData = vi.hoisted<ExpenseEntry[]>(() => [
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
]);

// ── Context Mocks ────────────────────────────────────────────────────────────
vi.mock('../context/ExpenseContext', () => ({
  useExpensesContext: () => ({
    orgExpenses: () => mockExpensesData,
    addExpense: mockAddExpense,
    updateExpense: mockUpdateExpense,
    deleteExpense: mockDeleteExpense,
  }),
}));
vi.mock('../context/PermissionContext', () => ({
  usePermissions: () => ({
    currentUserRights: () => ({
      canViewExpenses: true,
      canEditExpenses: true,
      canDeleteExpenses: true,
    }),
    currentUserOrgId: () => 'org_test',
  }),
}));
vi.mock('../context/TruckContext', () => ({ useTrucksContext: () => ({ orgTrucks: () => [] }) }));
vi.mock('../context/DriverContext', () => ({ useDriversContext: () => ({ orgDrivers: () => [] }) }));
vi.mock('../context/TripContext', () => ({ useTripsContext: () => ({ orgTrips: () => [] }) }));
vi.mock('../context/OfficeContext', () => ({ useOfficesContext: () => ({ orgOffices: () => [] }) }));
vi.mock('../context/AccountContext', () => ({ useAccountsContext: () => ({ orgAccounts: () => [] }) }));
vi.mock('../context/TyreContext', () => ({ useTyresContext: () => ({ orgTyres: () => [] }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: () => null }) }));
vi.mock('../context/OrganizationContext', () => ({ useOrganizations: () => ({ orgProfile: () => null }) }));
vi.mock('../context/NotificationContext', () => ({ useNotifications: () => ({ addNotification: vi.fn() }) }));

// ─────────────────────────────────────────────────────────────────────────────

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
  beforeEach(() => {
    mockAddExpense.mockClear();
    mockUpdateExpense.mockClear();
    mockDeleteExpense.mockClear();
  });
  afterEach(() => cleanup());

  it('should render header summary cards and filtered totals correctly', () => {
    render(() => (
      <ExpenseMaster
        expenses={mockExpenses}
        trucks={mockTrucks}
        accounts={mockAccounts}
        drivers={mockDrivers}
        onAddExpense={vi.fn()}
        onUpdateExpense={vi.fn()}
        onDeleteExpense={vi.fn()}
      />
    ));

    expect(screen.getByText(/Voucher & Expenses Ledger/i)).toBeInTheDocument();
    
    // Total expenses sum = 1500 + 5000 = 6,500
    expect(screen.getByText('₹6,500')).toBeInTheDocument();
    
    // Settled Cash Mode sum = 1500
    expect(screen.getAllByText(/1,500/)[0]).toBeInTheDocument();

    // Driver Paid/Pending sum = 5000
    expect(screen.getAllByText('₹5,000')[0]).toBeInTheDocument();
  });

  it('should render all listed expenses in the grid table', () => {
    render(() => (
      <ExpenseMaster
        expenses={mockExpenses}
        trucks={mockTrucks}
        accounts={mockAccounts}
        drivers={mockDrivers}
        onAddExpense={vi.fn()}
        onUpdateExpense={vi.fn()}
        onDeleteExpense={vi.fn()}
      />
    ));

    expect(screen.getAllByText('TVS Auto Shop')[0]).toBeInTheDocument();
    expect(screen.getAllByText('MRF Tyres Depot')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Maintenance')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Spare Parts')[0]).toBeInTheDocument();
  });

  it('should filter table rows dynamically based on the search query input', () => {
    render(() => (
      <ExpenseMaster
        expenses={mockExpenses}
        trucks={mockTrucks}
        accounts={mockAccounts}
        drivers={mockDrivers}
        onAddExpense={vi.fn()}
        onUpdateExpense={vi.fn()}
        onDeleteExpense={vi.fn()}
      />
    ));

    const searchInput = screen.getByPlaceholderText(/Search shop name or expense type/i);
    fireEvent.input(searchInput, { target: { value: 'MRF Tyres' } });

    expect(screen.getAllByText('MRF Tyres Depot')[0]).toBeInTheDocument();
    expect(screen.queryAllByText('TVS Auto Shop').length).toBe(0);
  });

  it('should trigger onAddExpense callback on valid form submit', () => {
    render(() => (
      <ExpenseMaster
        expenses={mockExpenses}
        trucks={mockTrucks}
        accounts={mockAccounts}
        drivers={mockDrivers}
        onAddExpense={mockAddExpense}
        onUpdateExpense={vi.fn()}
        onDeleteExpense={vi.fn()}
      />
    ));

    // Open form
    const toggleBtn = screen.getByRole('button', { name: /Register New Expense/i });
    fireEvent.click(toggleBtn);

    // Fill required form fields
    const truckInput = screen.getByLabelText(/Truck ID No/i);
    fireEvent.input(truckInput, { target: { value: 'MH-12-PQ-9999' } });
    fireEvent.change(truckInput, { target: { value: 'MH-12-PQ-9999' } });

    const typeInput = screen.getByLabelText(/Expense Type/i);
    fireEvent.input(typeInput, { target: { value: 'Fuel' } });
    fireEvent.change(typeInput, { target: { value: 'Fuel' } });

    const amountInput = screen.getByLabelText(/Expense Amount \(₹\)/i);
    fireEvent.input(amountInput, { target: { value: '3200' } });
    fireEvent.change(amountInput, { target: { value: '3200' } });

    const shopInput = screen.getByLabelText(/Shop \/ Supplier Name/i);
    fireEvent.input(shopInput, { target: { value: 'BPCL Petrol Pump' } });
    fireEvent.change(shopInput, { target: { value: 'BPCL Petrol Pump' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Save Ledger Entry/i });
    const form = submitBtn.closest('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      fireEvent.click(submitBtn);
    }

    expect(mockAddExpense).toHaveBeenCalledTimes(1);
    expect(mockAddExpense).toHaveBeenCalledWith(expect.objectContaining({
      expenseType: 'Fuel',
      amount: 3200,
      shopName: 'BPCL Petrol Pump',
    }));
  });
});
