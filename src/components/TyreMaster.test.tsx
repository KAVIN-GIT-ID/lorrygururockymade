import { createSignal, createEffect } from 'solid-js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TyreMaster from './TyreMaster';
import { Tyre, Truck, Account } from '../types';

const mockTrucks: Truck[] = [
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
];

const mockAccounts: Account[] = [
  { id: 'ac-1', accountName: 'Cash Account', type: 'Cash', status: 'Active' },
  { id: 'ac-2', accountName: 'SBI Bank Account', type: 'Bank', status: 'Active' }
];

const mockTyres: Tyre[] = [
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
];

describe('TyreMaster Component Integration Tests', () => {
  beforeEach(() => {
    window.alert = vi.fn();
  });

  it('should render the list of tyres correctly', () => {
    render(
      <TyreMaster
        tyres={mockTyres}
        trucks={mockTrucks}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={vi.fn()}
        onDeleteTyre={vi.fn()}
      />
    );

    expect(screen.getByText(/2\s*Tyres/i)).toBeInTheDocument();
    expect(screen.getByText('MRF-001')).toBeInTheDocument();
    expect(screen.getByText('APOLLO-002')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('should filter tyres by status and search queries', () => {
    render(
      <TyreMaster
        tyres={mockTyres}
        trucks={mockTrucks}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={vi.fn()}
        onDeleteTyre={vi.fn()}
      />
    );

    // Filter by Active status
    const statusSelect = screen.getByRole('combobox', { name: 'Status Filter' });
    fireEvent.change(statusSelect, { target: { value: 'Active' } });
    expect(screen.getByText(/1\s*Tyres/i)).toBeInTheDocument();
    expect(screen.queryByText('MRF-001')).not.toBeInTheDocument();
    expect(screen.getByText('APOLLO-002')).toBeInTheDocument();

    // Reset status filter
    fireEvent.change(statusSelect, { target: { value: '' } });

    // Search query
    const searchInput = screen.getByPlaceholderText(/Search Serial No \/ Manufacturer \/ Truck\.\.\./i);
    fireEvent.change(searchInput, { target: { value: 'mrf' } });
    expect(screen.getByText(/1\s*Tyres/i)).toBeInTheDocument();
    expect(screen.getByText('MRF-001')).toBeInTheDocument();
    expect(screen.queryByText('APOLLO-002')).not.toBeInTheDocument();
  });

  it('should open register form and add a new tyre record to YARD STOCK', () => {
    const handleAddTyre = vi.fn();
    render(
      <TyreMaster
        tyres={mockTyres}
        trucks={mockTrucks}
        accounts={mockAccounts}
        onAddTyre={handleAddTyre}
        onUpdateTyre={vi.fn()}
        onDeleteTyre={vi.fn()}
      />
    );

    // Open register panel
    const openBtn = screen.getByRole('button', { name: /Register New Tyre/i });
    fireEvent.click(openBtn);

    expect(screen.getByText('Register New Purchase Specification')).toBeInTheDocument();

    // Fill form fields
    fireEvent.change(screen.getByLabelText(/Tyre Serial No/i), { target: { value: 'JK-003' } });
    fireEvent.change(screen.getByLabelText(/Manufacturer/i), { target: { value: 'JK Tyre' } });
    fireEvent.change(screen.getByLabelText(/Tyre Size Dimension/i), { target: { value: '10.00R20' } });
    fireEvent.change(screen.getByLabelText(/Purchase Date/i), { target: { value: '2026-05-20' } });
    fireEvent.change(screen.getByLabelText(/Purchase Amount/i), { target: { value: '25000' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Add Tyre record/i }));

    expect(handleAddTyre).toHaveBeenCalledTimes(1);
    expect(handleAddTyre).toHaveBeenCalledWith(
      {
        tyreNo: 'JK-003',
        manufacturer: 'JK Tyre',
        size: '10.00R20',
        status: 'Available',
        currentTruckNo: undefined,
        installationDate: undefined,
        installationKM: undefined,
        purchaseDate: '2026-05-20',
        purchaseAmount: 25000
      },
      {
        createExpense: true,
        truckNo: 'YARD / WH',
        paymentMode: 'Cash'
      }
    );
  });

  it('should prevent registering/allocating to an expired truck', () => {
    const handleAddTyre = vi.fn();
    render(
      <TyreMaster
        tyres={mockTyres}
        trucks={mockTrucks}
        accounts={mockAccounts}
        onAddTyre={handleAddTyre}
        onUpdateTyre={vi.fn()}
        onDeleteTyre={vi.fn()}
      />
    );

    // Open register panel
    fireEvent.click(screen.getByRole('button', { name: /Register New Tyre/i }));

    // Fill fields
    fireEvent.change(screen.getByLabelText(/Tyre Serial No/i), { target: { value: 'JK-EXP' } });
    fireEvent.change(screen.getByLabelText(/Manufacturer/i), { target: { value: 'JK Tyre' } });

    // Select the expired vehicle
    const truckSelect = screen.getByLabelText(/Allocate Expense to/i);
    // Note: in TyreMaster, options matching expired/inactive/rejected trucks are disabled,
    // but the component checks the validation again inside handleCreateTyre.
    // Let's force set the value of the select to simulate validation bypass or direct selection
    fireEvent.change(truckSelect, { target: { value: 'KA03XY9999' } });

    // Click "Add Tyre record"
    fireEvent.click(screen.getByRole('button', { name: /Add Tyre record/i }));

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Cannot register tyre: Selected truck KA03XY9999 is expired.'));
    expect(handleAddTyre).not.toHaveBeenCalled();
  });

  it('should mount an available tyre on a vehicle', () => {
    const handleUpdateTyre = vi.fn();
    render(
      <TyreMaster
        tyres={mockTyres}
        trucks={mockTrucks}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={handleUpdateTyre}
        onDeleteTyre={vi.fn()}
      />
    );

    // Click Mount button on MRF-001
    const mountButtons = screen.getAllByRole('button', { name: 'Mount' });
    fireEvent.click(mountButtons[0]);

    expect(screen.getByText('Mount Tyre on Active Truck')).toBeInTheDocument();

    // Select truck, date and KM
    fireEvent.change(screen.getByLabelText(/Select Active Truck/i), { target: { value: 'tr-2' } }); // tr-2 is DL01AB5678
    fireEvent.change(screen.getByLabelText(/Mounting Date/i), { target: { value: '2026-05-24' } });
    fireEvent.change(screen.getByLabelText(/Truck Odometer KM/i), { target: { value: '60000' } });

    // Confirm mount
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Mount' }));

    expect(handleUpdateTyre).toHaveBeenCalledTimes(1);
    const updatedTyre = handleUpdateTyre.mock.calls[0][0] as Tyre;
    expect(updatedTyre.status).toBe('Active');
    expect(updatedTyre.currentTruckNo).toBe('DL01AB5678');
    expect(updatedTyre.installationKM).toBe(60000);
    expect(updatedTyre.installationDate).toBe('2026-05-24');
    expect(updatedTyre.movementHistory.length).toBe(1);
    expect(updatedTyre.movementHistory[0].action).toBe('Installed');
    expect(updatedTyre.movementHistory[0].truckNo).toBe('DL01AB5678');
  });

  it('should dismount an active tyre and calculate mileage run', () => {
    const handleUpdateTyre = vi.fn();
    render(
      <TyreMaster
        tyres={mockTyres}
        trucks={mockTrucks}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={handleUpdateTyre}
        onDeleteTyre={vi.fn()}
      />
    );

    // Click Dismount button on APOLLO-002
    const dismountBtn = screen.getByRole('button', { name: /Dismount/i });
    fireEvent.click(dismountBtn);

    expect(screen.getByText('Dismount from MH12PQ1234')).toBeInTheDocument();

    // Fill dismount details
    fireEvent.change(screen.getByLabelText(/Dismount Date/i), { target: { value: '2026-05-25' } });
    // Installation was 48000. Let's make removal 51000, so displacement run = 3000 KM.
    fireEvent.change(screen.getByLabelText(/Removal Odometer KM/i), { target: { value: '51000' } });
    fireEvent.change(screen.getByLabelText(/Removal Reason \/ Note/i), { target: { value: 'Tyre Rotated' } });

    // Confirm Dismount
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Dismount' }));

    expect(handleUpdateTyre).toHaveBeenCalledTimes(1);
    const updatedTyre = handleUpdateTyre.mock.calls[0][0] as Tyre;
    expect(updatedTyre.status).toBe('Available');
    expect(updatedTyre.currentTruckNo).toBeUndefined();
    expect(updatedTyre.installationKM).toBeUndefined();
    // accumulatedKM: base of 5000 + run mileage of 3000 = 8000
    expect(updatedTyre.accumulatedKM).toBe(8000);
    expect(updatedTyre.movementHistory.length).toBe(2);
    expect(updatedTyre.movementHistory[0].action).toBe('Removed');
    expect(updatedTyre.movementHistory[0].odometerKM).toBe(51000);
    expect(updatedTyre.movementHistory[0].remarks).toContain('Tyre Rotated');
  });

  it('should record a tyre sale voucher', () => {
    const handleUpdateTyre = vi.fn();
    render(
      <TyreMaster
        tyres={mockTyres}
        trucks={mockTrucks}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={handleUpdateTyre}
        onDeleteTyre={vi.fn()}
      />
    );

    // Click "Sell tyre" on available tyre (MRF-001)
    const sellBtn = screen.getByRole('button', { name: /Sell tyre/i });
    fireEvent.click(sellBtn);

    expect(screen.getByText('Sale Accounting parameters')).toBeInTheDocument();

    // Fill sale details
    fireEvent.change(screen.getByLabelText(/Sale Date/i), { target: { value: '2026-05-26' } });
    fireEvent.change(screen.getByLabelText(/Sale Invoice Amount/i), { target: { value: '8000' } });

    // Confirm Sell
    fireEvent.click(screen.getByRole('button', { name: 'Record Sale Voucher' }));

    expect(handleUpdateTyre).toHaveBeenCalledTimes(1);
    const updatedTyre = handleUpdateTyre.mock.calls[0][0] as Tyre;
    expect(updatedTyre.status).toBe('Sold');
    expect(updatedTyre.saleAmount).toBe(8000);
    expect(updatedTyre.saleDate).toBe('2026-05-26');
    expect(updatedTyre.movementHistory[0].action).toBe('Sold');
    expect(updatedTyre.movementHistory[0].remarks).toContain('Sold for ₹8,000');
  });

  it('should scrap a tyre', () => {
    const handleUpdateTyre = vi.fn();
    render(
      <TyreMaster
        tyres={mockTyres}
        trucks={mockTrucks}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={handleUpdateTyre}
        onDeleteTyre={vi.fn()}
      />
    );

    // Click "Scrap" on available tyre (MRF-001)
    const scrapBtn = screen.getByRole('button', { name: /Scrap/i });
    fireEvent.click(scrapBtn);

    expect(screen.getByText('Decommission & Recycle Tyre')).toBeInTheDocument();

    // Fill scrap details
    fireEvent.change(screen.getByLabelText(/Scrapping Date/i), { target: { value: '2026-05-26' } });

    // Confirm Scrap
    fireEvent.click(screen.getByRole('button', { name: 'Decommission' }));

    expect(handleUpdateTyre).toHaveBeenCalledTimes(1);
    const updatedTyre = handleUpdateTyre.mock.calls[0][0] as Tyre;
    expect(updatedTyre.status).toBe('Scrapped');
    expect(updatedTyre.movementHistory[0].action).toBe('Scrapped');
  });

  it('should view historical movement logs modal', () => {
    render(
      <TyreMaster
        tyres={mockTyres}
        trucks={mockTrucks}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={vi.fn()}
        onDeleteTyre={vi.fn()}
      />
    );

    // Open logs drawer for APOLLO-002
    const logsBtn = screen.getByRole('button', { name: /Logs \(1\)/i });
    fireEvent.click(logsBtn);

    expect(screen.getByText('movement trail: APOLLO-002')).toBeInTheDocument();
    expect(screen.getByText('Mounted on Vehicle MH12PQ1234 at odometer 48000 KM')).toBeInTheDocument();

    // Close logs drawer
    const closeBtn = screen.getByRole('button', { name: 'Close logs' });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('movement trail: APOLLO-002')).not.toBeInTheDocument();
  });

  it('should handle deletion of tyre records', () => {
    const handleDelete = vi.fn();
    const handleConfirm = vi.fn((msg, onConfirm) => onConfirm());
    render(
      <TyreMaster
        tyres={mockTyres}
        trucks={mockTrucks}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={vi.fn()}
        onDeleteTyre={handleDelete}
        confirmAction={handleConfirm}
      />
    );

    // Delete MRF-001 (Available, no movement logs)
    const deleteBtn = screen.getByTitle('Delete record');
    fireEvent.click(deleteBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleDelete).toHaveBeenCalledWith('tyre-1');
  });

  it('should restrict operations based on permissions', () => {
    render(
      <TyreMaster
        tyres={mockTyres}
        trucks={mockTrucks}
        accounts={mockAccounts}
        onAddTyre={vi.fn()}
        onUpdateTyre={vi.fn()}
        onDeleteTyre={vi.fn()}
        canEditTyres={false}
        canDeleteTyres={false}
      />
    );

    // Register button should not render
    expect(screen.queryByRole('button', { name: /Register New Tyre/i })).not.toBeInTheDocument();

    // Action buttons like Mount, Sell, Scrap, Dismount should not render
    expect(screen.queryByRole('button', { name: 'Mount' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sell tyre' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scrap' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismount' })).not.toBeInTheDocument();

    // Delete button should not render
    expect(screen.queryByTitle('Delete record')).not.toBeInTheDocument();
  });
});
