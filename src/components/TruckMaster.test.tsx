import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-23T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });
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

    expect(screen.getAllByText('MH-12-PQ-9999')[0]).toBeInTheDocument();
    expect(screen.getAllByText('TATA')[0]).toBeInTheDocument();
    expect(screen.getAllByText('3118')[0]).toBeInTheDocument();
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

    // FC is 2026-04-20, which is expired
    const fcCell = screen.getAllByText(/2026-04-20/)[0];
    expect(fcCell).toHaveClass('bg-rose-50');

    // Insurance is 2026-06-20, which is near expiry
    const insCell = screen.getAllByText(/2026-06-20/)[0];
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

  it('should use default and custom overrides in Set Next Due pre-fill helpers', () => {
    const handleAdd = vi.fn();
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

    render(
      <TruckMaster
        trucks={mockTrucks}
        trips={[]}
        expenses={[]}
        onAddTruck={handleAdd}
        onUpdateTruck={vi.fn()}
        onDeleteTruck={vi.fn()}
        orgProfile={mockOrgProfile}
      />
    );

    // Open form
    const toggleBtn = screen.getByRole('button', { name: /Add\/Edit Truck Specs/i });
    fireEvent.click(toggleBtn);

    // 1. Enter Current KM
    fireEvent.change(screen.getByLabelText(/Current Odo KM/i), { target: { value: 120000 } });

    // 2. Locate the Engine Oil milestone set button (default is 15000 KM)
    const engineHelperBtn = screen.getByRole('button', { name: /Set next due \(Odo \+ 15000 KM\)/i });
    expect(engineHelperBtn).toBeInTheDocument();
    
    // Click helper button
    fireEvent.click(engineHelperBtn);
    
    // Value should be current Odo + 15000 = 135000
    const engineInput = screen.getByLabelText(/Engine Oil KM Limit/i);
    expect(engineInput).toHaveValue(135000);

    // 3. Now configure custom interval override (e.g. 12000 KM)
    const customEngineIntervalInput = screen.getByPlaceholderText(/Uses Org Default: 15,000 KM/i);
    fireEvent.change(customEngineIntervalInput, { target: { value: 12000 } });

    // Helper button text should update to use the custom override (12000 KM)
    const engineHelperCustomBtn = screen.getByRole('button', { name: /Set next due \(Odo \+ 12000 KM\)/i });
    expect(engineHelperCustomBtn).toBeInTheDocument();

    // Click helper button again
    fireEvent.click(engineHelperCustomBtn);

    // Value should now be current Odo + 12000 = 132000
    expect(engineInput).toHaveValue(132000);
  });
});
