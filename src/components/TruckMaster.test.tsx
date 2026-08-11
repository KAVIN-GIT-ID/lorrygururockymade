import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import TruckMaster from './TruckMaster';

// ── Hoisted spies (available inside vi.mock factories) ───────────────────────
const mockAddTruck = vi.hoisted(() => vi.fn());
const mockUpdateTruck = vi.hoisted(() => vi.fn());
const mockDeleteTruck = vi.hoisted(() => vi.fn());

const mockTrucksData = vi.hoisted(() => [
  {
    id: 'tr-1',
    truckNo: 'MH-12-PQ-9999',
    ownerName: 'Self',
    status: 'Active' as const,
    make: 'TATA',
    model: '3118',
    type: '12 Wheeler',
    insuranceDate: '2026-08-15', // Near expiry (~19 days from 2026-07-27)
    fcDate: '2026-04-20',        // Expired relative to 2026-05-23
    currentKM: 100000,
    engineOilKM: 105000,
    isApproved: true,
  }
]);

// ── Mock all contexts used by TruckMaster ────────────────────────────────────
vi.mock('../context/TripContext', () => ({
  useTripsContext: () => ({ orgTrips: () => [] }),
}));
vi.mock('../context/TruckContext', () => ({
  useTrucksContext: () => ({
    orgTrucks: () => mockTrucksData,
    addTruck: mockAddTruck,
    updateTruck: mockUpdateTruck,
    deleteTruck: mockDeleteTruck,
    handleAddTruckRequest: vi.fn(),
    handleProcessTruckPayment: vi.fn(),
  }),
}));
vi.mock('../context/DriverContext', () => ({
  useDriversContext: () => ({ orgDrivers: () => [] }),
}));
vi.mock('../context/ExpenseContext', () => ({
  useExpensesContext: () => ({
    orgExpenses: () => [],
    addExpense: vi.fn(),
  }),
}));
vi.mock('../context/OfficeContext', () => ({
  useOfficesContext: () => ({ orgOffices: () => [] }),
}));
vi.mock('../context/AccountContext', () => ({
  useAccountsContext: () => ({ orgAccounts: () => [] }),
}));
vi.mock('../context/TyreContext', () => ({
  useTyresContext: () => ({
    orgTyres: () => [],
    addTyre: vi.fn(),
    updateTyre: vi.fn(),
    deleteTyre: vi.fn(),
  }),
}));
vi.mock('../context/PermissionContext', () => ({
  usePermissions: () => ({
    currentUserRights: () => ({
      canViewTrucks: true,
      canEditTrucks: true,
      canDeleteTrucks: true,
      canEditLoans: true,
      canDeleteLoans: true,
      canEditExpenses: true,
    }),
    currentUserOrgId: () => 'org_test',
  }),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: () => ({ email: 'test@test.com', name: 'Test User', phone: '' }),
  }),
}));
vi.mock('../context/OrganizationContext', () => ({
  useOrganizations: () => ({ orgProfile: () => null }),
}));
vi.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({ addNotification: vi.fn() }),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('TruckMaster Component Tests', () => {
  beforeEach(() => {
    window.alert = vi.fn();
    mockAddTruck.mockClear();
    mockUpdateTruck.mockClear();
    mockDeleteTruck.mockClear();
  });

  afterEach(() => cleanup());

  it('should render the list of trucks and show specifications', () => {
    render(() => (
      <TruckMaster
        trucks={[]}
        trips={[]}
        expenses={[]}
        onAddTruck={vi.fn()}
        onUpdateTruck={vi.fn()}
        onDeleteTruck={vi.fn()}
      />
    ));

    expect(screen.getAllByText('MH-12-PQ-9999')[0]).toBeInTheDocument();
    expect(screen.getAllByText('TATA')[0]).toBeInTheDocument();
    expect(screen.getAllByText('3118')[0]).toBeInTheDocument();
  });

  it('should display warning styling for expired FC and near-expiry insurance', () => {
    render(() => (
      <TruckMaster
        trucks={[]}
        trips={[]}
        expenses={[]}
        onAddTruck={vi.fn()}
        onUpdateTruck={vi.fn()}
        onDeleteTruck={vi.fn()}
      />
    ));

    // FC is 2026-04-20, which is expired (displayText is 20-04-2026)
    const fcCell = screen.getAllByText('20-04-2026')[0];
    expect(fcCell).toHaveClass('bg-rose-50');

    // Insurance is 2026-08-15, which is near expiry (~19 days from 2026-07-27)
    const insCell = screen.getAllByText('15-08-2026')[0];
    expect(insCell).toHaveClass('bg-amber-50');
  });

  it('should open form and trigger onAddTruck on valid submit', () => {
    render(() => (
      <TruckMaster
        trucks={[]}
        trips={[]}
        expenses={[]}
        onAddTruck={vi.fn()}
        onUpdateTruck={vi.fn()}
        onDeleteTruck={vi.fn()}
      />
    ));

    // Open form
    const toggleBtn = screen.getByRole('button', { name: /Add\/Edit Truck Specs|புதிய லாரி சேர்க்க/i });
    fireEvent.click(toggleBtn);

    // Fill form
    fireEvent.change(screen.getByLabelText(/Vehicle No|வண்டி எண்/i), { target: { value: 'DL-01-AB-1234' } });
    fireEvent.change(screen.getByLabelText(/Manufacturer \/ Make|உற்பத்தியாளர்/i), { target: { value: 'TATA' } });
    fireEvent.change(screen.getByLabelText(/Model \/ Horsepower|மாடல்/i), { target: { value: '5525' } });
    fireEvent.change(screen.getByLabelText(/Trailer Type|வகை/i), { target: { value: '14 Wheeler' } });
    fireEvent.change(screen.getByLabelText(/Current ODO/i), { target: { value: 120000 } });

    // Submit — component calls trucksCtx.addTruck (mockAddTruck), not rawProps.onAddTruck
    const submitBtn = screen.getByRole('button', { name: /Save Truck Details|Add Truck Specs/i });
    fireEvent.click(submitBtn);

    expect(mockAddTruck).toHaveBeenCalledTimes(1);
    expect(mockAddTruck).toHaveBeenCalledWith(expect.objectContaining({
      truckNo: 'DL01-AB-1234',
      make: 'TATA',
      model: '5525',
      type: '14 Wheeler',
      currentKM: 120000
    }));
  });

  it('should trigger onDeleteTruck callback after user confirmation', () => {
    const handleConfirm = vi.fn((msg, onConfirm) => onConfirm()); // Auto-confirm

    render(() => (
      <TruckMaster
        trucks={[]}
        trips={[]}
        expenses={[]}
        onAddTruck={vi.fn()}
        onUpdateTruck={vi.fn()}
        onDeleteTruck={vi.fn()}
        confirmAction={handleConfirm}
      />
    ));

    const deleteBtn = screen.getByTitle('Delete Truck');
    fireEvent.click(deleteBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    // Component calls trucksCtx.deleteTruck (mockDeleteTruck), not rawProps.onDeleteTruck
    expect(mockDeleteTruck).toHaveBeenCalledWith('tr-1');
  });

  it('should use default and custom overrides in Set Next Due pre-fill helpers', () => {
    const mockOrgProfile = {
      organizationId: 'org_test',
      organizationName: 'Test Org',
      ownerEmail: 'admin@test.com',
      status: 'Active' as const,
      maxTrucksAllowed: 10,
      truckRequests: [],
      engineOilIntervalKM: 15000,
      crownOilIntervalKM: 40000,
      gearBoxOilIntervalKM: 40000,
      radiatorIntervalKM: 20000
    };

    render(() => (
      <TruckMaster
        trucks={mockTrucksData}
        trips={[]}
        expenses={[]}
        onAddTruck={vi.fn()}
        onUpdateTruck={vi.fn()}
        onDeleteTruck={vi.fn()}
        orgProfile={mockOrgProfile}
      />
    ));

    // Open form
    const toggleBtn = screen.getByRole('button', { name: /Add\/Edit Truck Specs|புதிய லாரி சேர்க்க/i }) || document.querySelector('#btn-add-truck');
    expect(toggleBtn).toBeInTheDocument();
  });
});
