import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import OfficeMaster from './OfficeMaster';
import { Office } from '../types';

// ── Hoisted spies ────────────────────────────────────────────────────────────
const mockAddOffice = vi.hoisted(() => vi.fn());
const mockUpdateOffice = vi.hoisted(() => vi.fn());
const mockDeleteOffice = vi.hoisted(() => vi.fn());

const mockOfficesData = vi.hoisted<Office[]>(() => [
  { id: 'off-1', officeName: 'Mumbai HQ', city: 'Mumbai', contactPerson: 'Rahul Sharma', phone: '9876543210', status: 'Active' },
  { id: 'off-2', officeName: 'Delhi Hub', city: 'Delhi', contactPerson: 'Amit Verma', phone: '8765432109', status: 'Inactive' },
]);

// ── Context mocks ─────────────────────────────────────────────────────────────
vi.mock('../context/OfficeContext', () => ({
  useOfficesContext: () => ({
    orgOffices: () => mockOfficesData,
    addOffice: mockAddOffice,
    updateOffice: mockUpdateOffice,
    deleteOffice: mockDeleteOffice,
  }),
}));
const mockRights = vi.hoisted(() => ({
  canViewOffices: true,
  canEditOffices: true,
  canDeleteOffices: true,
}));

vi.mock('../context/PermissionContext', () => ({
  usePermissions: () => ({
    currentUserRights: () => mockRights,
    currentUserOrgId: () => 'org_test',
  }),
}));
vi.mock('../context/TripContext', () => ({ useTripsContext: () => ({ orgTrips: () => [] }) }));
vi.mock('../context/TruckContext', () => ({ useTrucksContext: () => ({ orgTrucks: () => [] }) }));
vi.mock('../context/DriverContext', () => ({ useDriversContext: () => ({ orgDrivers: () => [] }) }));
vi.mock('../context/ExpenseContext', () => ({ useExpensesContext: () => ({ orgExpenses: () => [], addExpense: vi.fn() }) }));
vi.mock('../context/AccountContext', () => ({ useAccountsContext: () => ({ orgAccounts: () => [] }) }));
vi.mock('../context/TyreContext', () => ({ useTyresContext: () => ({ orgTyres: () => [] }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: () => null }) }));
vi.mock('../context/OrganizationContext', () => ({ useOrganizations: () => ({ orgProfile: () => null }) }));
vi.mock('../context/NotificationContext', () => ({ useNotifications: () => ({ addNotification: vi.fn() }) }));

// ─────────────────────────────────────────────────────────────────────────────

describe('OfficeMaster Component Integration Tests', () => {
  beforeEach(() => {
    mockAddOffice.mockClear();
    mockUpdateOffice.mockClear();
    mockDeleteOffice.mockClear();
    mockRights.canViewOffices = true;
    mockRights.canEditOffices = true;
    mockRights.canDeleteOffices = true;
  });
  afterEach(() => cleanup());

  it('should render the list of offices correctly', () => {
    render(() => (
      <OfficeMaster
        offices={[]}
        onAddOffice={vi.fn()}
        onUpdateOffice={vi.fn()}
        onDeleteOffice={vi.fn()}
      />
    ));

    expect(screen.getByText('Office Branch Directory')).toBeInTheDocument();
    expect(screen.getAllByText('Mumbai HQ')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Delhi Hub')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Rahul Sharma')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Amit Verma')[0]).toBeInTheDocument();
  });

  it('should display "No offices registered" message when list is empty', () => {
    // Override context to return empty
    const originalData = [...mockOfficesData];
    mockOfficesData.length = 0;

    render(() => (
      <OfficeMaster
        offices={[]}
        onAddOffice={vi.fn()}
        onUpdateOffice={vi.fn()}
        onDeleteOffice={vi.fn()}
      />
    ));

    expect(screen.getAllByText(/No offices registered/i)[0]).toBeInTheDocument();

    // Restore
    mockOfficesData.push(...originalData);
  });

  it('should restrict view details when canViewOffices is false', () => {
    mockRights.canViewOffices = false;

    render(() => (
      <OfficeMaster
        offices={[]}
        onAddOffice={vi.fn()}
        onUpdateOffice={vi.fn()}
        onDeleteOffice={vi.fn()}
      />
    ));

    expect(screen.queryAllByText('Rahul Sharma')).toHaveLength(0);
    expect(screen.queryAllByText('9876543210')).toHaveLength(0);
    expect(screen.getAllByText('[Restricted]').length).toBeGreaterThan(0);
  });

  it('should toggle form open and close when clicking Add New Office', () => {
    render(() => (
      <OfficeMaster
        offices={[]}
        onAddOffice={vi.fn()}
        onUpdateOffice={vi.fn()}
        onDeleteOffice={vi.fn()}
      />
    ));

    expect(screen.queryByText('Register New Office')).not.toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /Add New Office/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('Register New Office')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close Form/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Register New Office')).not.toBeInTheDocument();
  });

  it('should trigger onAddOffice callback with valid inputs', () => {
    render(() => (
      <OfficeMaster
        offices={[]}
      />
    ));

    fireEvent.click(screen.getByRole('button', { name: /Add New Office/i }));

    fireEvent.input(screen.getByLabelText(/Office Name/i), { target: { value: 'Bangalore Branch' } });
    fireEvent.input(screen.getByLabelText(/City\/Branch Location/i), { target: { value: 'Bangalore' } });
    fireEvent.input(screen.getByLabelText(/Contact Person/i), { target: { value: 'Sanjay Kumar' } });
    fireEvent.input(screen.getByLabelText(/Contact Phone/i), { target: { value: '7654321098' } });
    fireEvent.change(screen.getByLabelText(/Office Status/i), { target: { value: 'Active' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add Office' }));

    // component uses context's addOffice (mockAddOffice)
    expect(mockAddOffice).toHaveBeenCalledTimes(1);
    expect(mockAddOffice).toHaveBeenCalledWith(expect.objectContaining({
      officeName: 'Bangalore Branch',
      city: 'Bangalore',
      contactPerson: 'Sanjay Kumar',
      status: 'Active',
    }));
  });

  it('should load office details into form for editing and update them', () => {
    render(() => (
      <OfficeMaster
        offices={[]}
      />
    ));

    const editButtons = screen.getAllByTitle('Edit Office');
    fireEvent.click(editButtons[0]);

    expect(screen.getByText('Modify Office Details')).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Office Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Mumbai HQ');

    fireEvent.input(nameInput, { target: { value: 'Mumbai Headquarters' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Office' }));

    expect(mockUpdateOffice).toHaveBeenCalledTimes(1);
    expect(mockUpdateOffice).toHaveBeenCalledWith(expect.objectContaining({
      id: 'off-1',
      officeName: 'Mumbai Headquarters',
    }));
  });

  it('should trigger onDeleteOffice callback after user confirmation', () => {
    const handleConfirm = vi.fn((msg, onConfirm) => onConfirm());

    render(() => (
      <OfficeMaster
        offices={[]}
        confirmAction={handleConfirm}
      />
    ));

    const deleteButtons = screen.getAllByTitle('Delete Office');
    fireEvent.click(deleteButtons[1]); // Delete Delhi Hub

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(mockDeleteOffice).toHaveBeenCalledWith('off-2');
  });

  it('should disable edit and delete actions when permissions are false', () => {
    mockRights.canEditOffices = false;
    mockRights.canDeleteOffices = false;

    render(() => (
      <OfficeMaster
        offices={[]}
        onAddOffice={vi.fn()}
        onUpdateOffice={vi.fn()}
        onDeleteOffice={vi.fn()}
      />
    ));

    expect(screen.queryByRole('button', { name: /Add New Office/i })).not.toBeInTheDocument();

    const editButtons = screen.getAllByTitle('Edit Office');
    const deleteButtons = screen.getAllByTitle('Delete Office');

    expect(editButtons[0]).toBeDisabled();
    expect(deleteButtons[0]).toBeDisabled();
  });
});
