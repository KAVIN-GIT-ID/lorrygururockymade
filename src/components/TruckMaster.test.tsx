import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TruckMaster from './TruckMaster';
import { Truck } from '../types';

const mockTrucks: Truck[] = [
  {
    id: 'tr-1',
    truckNo: 'MH-12-PQ-9999',
    ownerName: 'Self',
    status: 'Active',
    make: 'TATA',
    model: '3118',
    type: '12 Wheeler',
    insuranceDate: '2026-06-20', // Near expiry from base anchor 2026-05-23
    fcDate: '2026-04-20',        // Expired relative to 2026-05-23
    currentKM: 100000,
    engineOilKM: 105000,
    isApproved: true
  }
];

describe('TruckMaster Component Tests', () => {
  it('should render the list of trucks and show specifications', () => {
    render(
      <TruckMaster
        trucks={mockTrucks}
        trips={[]}
        expenses={[]}
        onAddTruck={vi.fn()}
        onUpdateTruck={vi.fn()}
        onDeleteTruck={vi.fn()}
      />
    );

    expect(screen.getByText('MH-12-PQ-9999')).toBeInTheDocument();
    expect(screen.getByText('TATA')).toBeInTheDocument();
    expect(screen.getByText('3118')).toBeInTheDocument();
  });

  it('should display warning styling for expired FC and near-expiry insurance', () => {
    render(
      <TruckMaster
        trucks={mockTrucks}
        trips={[]}
        expenses={[]}
        onAddTruck={vi.fn()}
        onUpdateTruck={vi.fn()}
        onDeleteTruck={vi.fn()}
      />
    );

    // FC is 2026-04-20, which is expired (displayText is 20-04-2026)
    const fcCell = screen.getByText('20-04-2026');
    expect(fcCell).toHaveClass('bg-rose-50');

    // Insurance is 2026-06-20, which is near expiry (displayText is 20-06-2026)
    const insCell = screen.getByText('20-06-2026');
    expect(insCell).toHaveClass('bg-amber-50');
  });

  it('should open form and trigger onAddTruck on valid submit', () => {
    const handleAdd = vi.fn();
    render(
      <TruckMaster
        trucks={mockTrucks}
        trips={[]}
        expenses={[]}
        onAddTruck={handleAdd}
        onUpdateTruck={vi.fn()}
        onDeleteTruck={vi.fn()}
      />
    );

    // Open form
    const toggleBtn = screen.getByRole('button', { name: /Add\/Edit Truck Specs/i });
    fireEvent.click(toggleBtn);

    // Fill form
    fireEvent.change(screen.getByLabelText(/Vehicle No/i), { target: { value: 'DL-01-AB-1234' } });
    fireEvent.change(screen.getByLabelText(/Manufacturer \/ Make/i), { target: { value: 'TATA' } });
    fireEvent.change(screen.getByLabelText(/Model \/ Horsepower/i), { target: { value: '5525' } });
    fireEvent.change(screen.getByLabelText(/Trailer Type/i), { target: { value: '14 Wheeler' } });
    fireEvent.change(screen.getByLabelText(/Current Odo KM/i), { target: { value: 120000 } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Add Truck Specs/i });
    fireEvent.click(submitBtn);

    expect(handleAdd).toHaveBeenCalledTimes(1);
    expect(handleAdd).toHaveBeenCalledWith(expect.objectContaining({
      truckNo: 'DL01-AB-1234',
      make: 'TATA',
      model: '5525',
      type: '14 Wheeler',
      currentKM: 120000
    }));
  });

  it('should trigger onDeleteTruck callback after user confirmation', () => {
    const handleDelete = vi.fn();
    const handleConfirm = vi.fn((msg, onConfirm) => onConfirm()); // Auto-confirm
    
    render(
      <TruckMaster
        trucks={mockTrucks}
        trips={[]}
        expenses={[]}
        onAddTruck={vi.fn()}
        onUpdateTruck={vi.fn()}
        onDeleteTruck={handleDelete}
        confirmAction={handleConfirm}
      />
    );

    const deleteBtn = screen.getByTitle('Delete Truck');
    fireEvent.click(deleteBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleDelete).toHaveBeenCalledWith('tr-1');
  });
});
