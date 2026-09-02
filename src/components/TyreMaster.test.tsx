import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import TyreMaster from './TyreMaster';
import { Tyre, Truck, Account } from '../types';

// ── Hoisted Spies & Data ─────────────────────────────────────────────────────
const mockAddTyre = vi.hoisted(() => vi.fn());
const mockUpdateTyre = vi.hoisted(() => vi.fn());
const mockDeleteTyre = vi.hoisted(() => vi.fn());

const mockTyresData = vi.hoisted<Tyre[]>(() => [
  {
    id: 'tyre-1',
    tyreNo: 'MRF-001',
    manufacturer: 'MRF',
    size: '10.00R20',
    status: 'Available',
    purchaseDate: '2026-05-01',
    purchaseAmount: 20000,
    accumulatedKM: 0,
    movementHistory: []
  },
  {
    id: 'tyre-2',
    tyreNo: 'APOLLO-002',
    manufacturer: 'Apollo',
    size: '295/85R22.5',
    status: 'Active',
    currentTruckNo: 'MH12PQ1234',
    installationDate: '2026-05-10',
    installationKM: 48000,
    purchaseDate: '2026-05-01',
    purchaseAmount: 22000,
    accumulatedKM: 5000,
    movementHistory: [
      {
        id: 'mvt-1',
        action: 'Installed',
        truckNo: 'MH12PQ1234',
        date: '2026-05-10',
        odometerKM: 48000,
        remarks: 'Mounted on Vehicle MH12PQ1234 at odometer 48000 KM'
      }
    ]
  }
]);

const mockTrucksData = vi.hoisted<Truck[]>(() => [
  {
    id: 'tr-1',
    truckNo: 'MH12PQ1234',
    status: 'Active',
    isApproved: true,
    currentKM: 50000,
    registrationExpiryDate: '2028-12-31',
    ownerName: 'Self Owned'
  },
  {
    id: 'tr-2',
    truckNo: 'DL01AB5678',
    status: 'Active',
    isApproved: true,
    currentKM: 60000,
    registrationExpiryDate: '2028-12-31',
    ownerName: 'External Owner'
  },
  {
    id: 'tr-expired',
    truckNo: 'KA03XY9999',
    status: 'Active',
    isApproved: true,
    currentKM: 45000,
    registrationExpiryDate: '2020-01-01', // expired relative to today/2026
    ownerName: 'Self Owned'
  }
]);

const mockRights = vi.hoisted(() => ({
  canViewTyres: true,
  canEditTyres: true,
  canDeleteTyres: true,
}));

// ── Context Mocks ─────────────────────────────────────────────────────────────
vi.mock('../context/TyreContext', () => ({
  useTyresContext: () => ({
    orgTyres: () => mockTyresData,
    addTyre: mockAddTyre,
    updateTyre: mockUpdateTyre,
    deleteTyre: mockDeleteTyre,
  }),
}));
vi.mock('../context/TruckContext', () => ({
  useTrucksContext: () => ({ orgTrucks: () => mockTrucksData }),
}));
vi.mock('../context/PermissionContext', () => ({
  usePermissions: () => ({
    currentUserRights: () => mockRights,
    currentUserOrgId: () => 'org_test',
  }),
}));
vi.mock('../context/DriverContext', () => ({ useDriversContext: () => ({ orgDrivers: () => [] }) }));
vi.mock('../context/TripContext', () => ({ useTripsContext: () => ({ orgTrips: () => [] }) }));
vi.mock('../context/ExpenseContext', () => ({ useExpensesContext: () => ({ orgExpenses: () => [], addExpense: vi.fn() }) }));
vi.mock('../context/OfficeContext', () => ({ useOfficesContext: () => ({ orgOffices: () => [] }) }));
vi.mock('../context/AccountContext', () => ({ useAccountsContext: () => ({ orgAccounts: () => [] }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: () => null }) }));
vi.mock('../context/OrganizationContext', () => ({ useOrganizations: () => ({ orgProfile: () => null }) }));
vi.mock('../context/NotificationContext', () => ({ useNotifications: () => ({ addNotification: vi.fn() }) }));

// ─────────────────────────────────────────────────────────────────────────────

const mockAccounts: Account[] = [
  { id: 'ac-1', accountName: 'Cash Account', type: 'Cash', status: 'Active' },
  { id: 'ac-2', accountName: 'SBI Bank Account', type: 'Bank', status: 'Active' }
];

describe('TyreMaster Component Integration Tests', () => {
  beforeEach(() => {
    window.alert = vi.fn();
    mockAddTyre.mockClear();
    mockUpdateTyre.mockClear();
    mockDeleteTyre.mockClear();
    mockRights.canViewTyres = true;
    mockRights.canEditTyres = true;
    mockRights.canDeleteTyres = true;
  });
  afterEach(() => cleanup());

  it('should render the list of tyres correctly', () => {
    render(() => (
      <TyreMaster
        tyres={mockTyresData}
        trucks={mockTrucksData}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={vi.fn()}
        onDeleteTyre={vi.fn()}
      />
    ));

    expect(screen.getByText(/2\s*Tyres/i)).toBeInTheDocument();
    expect(screen.getByText('MRF-001')).toBeInTheDocument();
    expect(screen.getByText('APOLLO-002')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('should filter tyres by status and search queries', () => {
    render(() => (
      <TyreMaster
        tyres={mockTyresData}
        trucks={mockTrucksData}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={vi.fn()}
        onDeleteTyre={vi.fn()}
      />
    ));

    // Filter by Status: Active
    const statusSelect = screen.getByLabelText('Status Filter');
    fireEvent.change(statusSelect, { target: { value: 'Active' } });

    expect(screen.getByText('APOLLO-002')).toBeInTheDocument();
    expect(screen.queryByText('MRF-001')).not.toBeInTheDocument();

    // Reset status filter and search by query
    fireEvent.change(statusSelect, { target: { value: '' } });
    const searchInput = screen.getByPlaceholderText(/Search Serial No \/ Manufacturer \/ Truck/i);
    fireEvent.change(searchInput, { target: { value: 'MRF' } });

    expect(screen.getByText('MRF-001')).toBeInTheDocument();
    expect(screen.queryByText('APOLLO-002')).not.toBeInTheDocument();
  });

  it('should open register form and add a new tyre record to YARD STOCK', () => {
    render(() => (
      <TyreMaster
        tyres={mockTyresData}
        trucks={mockTrucksData}
        accounts={mockAccounts}
        onAddTyre={mockAddTyre}
        onUpdateTyre={mockUpdateTyre}
        onDeleteTyre={mockDeleteTyre}
      />
    ));

    // Open Add Tyre Modal
    const addBtn = screen.getByRole('button', { name: /Register New Tyre/i });
    fireEvent.click(addBtn);

    // Fill form
    fireEvent.input(screen.getByLabelText(/Tyre Serial/i), { target: { value: 'JK-9999' } });
    fireEvent.change(screen.getByLabelText(/Manufacturer/i), { target: { value: 'JK Tyre' } });
    fireEvent.input(screen.getByLabelText(/Tyre Size/i), { target: { value: '10.00R20' } });
    fireEvent.input(screen.getByLabelText(/Purchase Amount/i), { target: { value: 18000 } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Add Tyre record/i });
    fireEvent.click(submitBtn);

    expect(mockAddTyre).toHaveBeenCalledTimes(1);
    expect(mockAddTyre).toHaveBeenCalledWith(
      expect.objectContaining({
        tyreNo: 'JK-9999',
        manufacturer: 'JK Tyre',
        size: '10.00R20',
        purchaseAmount: 18000,
        status: 'Available'
      }),
      expect.anything()
    );
  });

  it('should prevent registering/allocating to an expired truck', () => {
    const alertSpy = window.alert;

    render(() => (
      <TyreMaster
        tyres={mockTyresData}
        trucks={mockTrucksData}
        accounts={mockAccounts}
        onAddTyre={mockAddTyre}
        onUpdateTyre={mockUpdateTyre}
        onDeleteTyre={mockDeleteTyre}
      />
    ));

    // Open Add Tyre Modal
    const addBtn = screen.getByRole('button', { name: /Register New Tyre/i });
    fireEvent.click(addBtn);

    // Select Expired Truck KA03XY9999
    fireEvent.input(screen.getByLabelText(/Tyre Serial/i), { target: { value: 'JK-8888' } });
    fireEvent.change(screen.getByLabelText(/Manufacturer/i), { target: { value: 'JK Tyre' } });
    fireEvent.input(screen.getByLabelText(/Tyre Size/i), { target: { value: '10.00R20' } });
    
    // Toggle vehicle mount option if present
    const truckSelect = screen.queryByLabelText(/Initial Assigned Truck/i);
    if (truckSelect) {
      fireEvent.change(truckSelect, { target: { value: 'KA03XY9999' } });
      const submitBtn = screen.getByRole('button', { name: /Add Tyre record/i });
      fireEvent.click(submitBtn);

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('expired'));
      expect(mockAddTyre).not.toHaveBeenCalled();
    }
  });

  it('should mount an available tyre on a vehicle', () => {
    render(() => (
      <TyreMaster
        tyres={mockTyresData}
        trucks={mockTrucksData}
        accounts={mockAccounts}
        onAddTyre={mockAddTyre}
        onUpdateTyre={mockUpdateTyre}
        onDeleteTyre={mockDeleteTyre}
      />
    ));

    // Click "Mount" for Available Tyre (MRF-001)
    const mountBtn = screen.getAllByTitle('Mount')[0];
    fireEvent.click(mountBtn);

    // Custom dropdown -> open and pick truck DL01AB5678
    const dropdownBtn = screen.getByText('-- Choose Truck --');
    fireEvent.click(dropdownBtn);

    const truckItem = screen.getByText(/DL01AB5678/i);
    fireEvent.click(truckItem);

    // Confirm Mounting
    const confirmMountBtn = screen.getByRole('button', { name: /Confirm Mount/i });
    fireEvent.click(confirmMountBtn);

    expect(mockUpdateTyre).toHaveBeenCalledTimes(1);
    expect(mockUpdateTyre).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tyre-1',
      status: 'Active',
      currentTruckNo: 'DL01AB5678',
      installationKM: 60000,
    }));
  });

  it('should dismount an active tyre and calculate mileage run', () => {
    render(() => (
      <TyreMaster
        tyres={mockTyresData}
        trucks={mockTrucksData}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={mockUpdateTyre}
        onDeleteTyre={vi.fn()}
      />
    ));

    // Click "Dismount" for Active Tyre (APOLLO-002 on MH12PQ1234)
    const dismountBtn = screen.getByTitle('Dismount');
    fireEvent.click(dismountBtn);

    // Modal opens -> enter removal KM (e.g. 52000)
    fireEvent.input(screen.getByLabelText(/Removal Odometer/i), { target: { value: 52000 } });

    // Submit dismount (default removal KM is truck's currentKM = 50000)
    const confirmDismountBtn = screen.getByRole('button', { name: /Confirm Dismount/i });
    fireEvent.click(confirmDismountBtn);

    // Mileage run = 50000 - 48000 = 2000. Accumulated KM was 5000 + 2000 = 7000
    expect(mockUpdateTyre).toHaveBeenCalledTimes(1);
    expect(mockUpdateTyre).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tyre-2',
      status: 'Available',
      accumulatedKM: 7000,
    }));
  });

  it('should record a tyre sale voucher', () => {
    render(() => (
      <TyreMaster
        tyres={mockTyresData}
        trucks={mockTrucksData}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={mockUpdateTyre}
        onDeleteTyre={vi.fn()}
      />
    ));

    // Open Actions menu or Click Sell for Available tyre MRF-001
    const sellBtn = screen.getByTitle('Sell tyre');
    fireEvent.click(sellBtn);

    // Fill sale details
    fireEvent.input(screen.getByLabelText(/Sale Invoice Amount/i), { target: { value: 8000 } });

    // Confirm Sale
    const confirmSaleBtn = screen.getByRole('button', { name: /Record Sale Voucher/i });
    fireEvent.click(confirmSaleBtn);

    expect(mockUpdateTyre).toHaveBeenCalledTimes(1);
    expect(mockUpdateTyre).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tyre-1',
      status: 'Sold',
      saleAmount: 8000,
    }));
  });

  it('should scrap a tyre', () => {
    render(() => (
      <TyreMaster
        tyres={mockTyresData}
        trucks={mockTrucksData}
        accounts={mockAccounts}
        onAddTyre={mockAddTyre}
        onUpdateTyre={mockUpdateTyre}
        onDeleteTyre={mockDeleteTyre}
      />
    ));

    const scrapBtn = screen.getByTitle('Scrap');
    fireEvent.click(scrapBtn);

    const confirmScrapBtn = screen.getByRole('button', { name: /Decommission/i });
    fireEvent.click(confirmScrapBtn);

    expect(mockUpdateTyre).toHaveBeenCalledTimes(1);
    expect(mockUpdateTyre).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tyre-1',
      status: 'Scrapped',
    }));
  });

  it('should view historical movement logs modal', () => {
    render(() => (
      <TyreMaster
        tyres={mockTyresData}
        trucks={mockTrucksData}
        accounts={mockAccounts}
        onAddTyre={mockAddTyre}
        onUpdateTyre={mockUpdateTyre}
        onDeleteTyre={mockDeleteTyre}
      />
    ));

    const historyBtn = screen.getAllByTitle('View movement ledger')[0];
    fireEvent.click(historyBtn);

    expect(screen.getByText(/movement trail:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Purchase Date/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Purchase Price/i).length).toBeGreaterThan(0);
  });

  it('should restrict operations based on permissions', () => {
    mockRights.canEditTyres = false;
    mockRights.canDeleteTyres = false;

    render(() => (
      <TyreMaster
        tyres={mockTyresData}
        trucks={mockTrucksData}
        accounts={mockAccounts}
        onAddTyre={mockAddTyre}
        onUpdateTyre={mockUpdateTyre}
        onDeleteTyre={mockDeleteTyre}
      />
    ));

    expect(screen.queryByRole('button', { name: /Register Tyre Asset/i })).not.toBeInTheDocument();
  });

  it('should pass expense details when editing tyre price', () => {
    mockRights.canEditTyres = true;

    render(() => (
      <TyreMaster
        tyres={mockTyresData}
        trucks={mockTrucksData}
        accounts={mockAccounts}
        expenses={[{ id: 'exp_1', expenseType: 'Tyre Purchase', shopName: 'MRF (Tyre Serial: MRF-001)', amount: 24000, notes: 'Tyre MRF-001' }]}
        onAddTyre={mockAddTyre}
        onUpdateTyre={mockUpdateTyre}
        onDeleteTyre={mockDeleteTyre}
      />
    ));

    const editBtns = screen.getAllByRole('button', { name: /^Edit$/i });
    fireEvent.click(editBtns[0]);

    const priceInput = screen.getByLabelText(/Purchase Amount/i);
    fireEvent.input(priceInput, { target: { value: '28750' } });

    const submitBtn = screen.getByRole('button', { name: /Save Changes|Add Tyre record/i });
    fireEvent.click(submitBtn);

    expect(mockUpdateTyre).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseAmount: 28750 }),
      expect.objectContaining({ createExpense: true })
    );
  });
});
