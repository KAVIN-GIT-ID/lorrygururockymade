import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OfficeMaster from './OfficeMaster';
import { Office } from '../types';

const mockOffices: Office[] = [
  {
    id: 'off-1',
    officeName: 'Mumbai HQ',
    city: 'Mumbai',
    contactPerson: 'Rahul Sharma',
    phone: '9876543210',
    status: 'Active',
  },
  {
    id: 'off-2',
    officeName: 'Delhi Hub',
    city: 'Delhi',
    contactPerson: 'Amit Verma',
    phone: '8765432109',
    status: 'Inactive',
  },
];

describe('OfficeMaster Component Integration Tests', () => {
  it('should render the list of offices correctly', () => {
    render(
      <OfficeMaster
        offices={mockOffices}
        onAddOffice={vi.fn()}
        onUpdateOffice={vi.fn()}
        onDeleteOffice={vi.fn()}
      />
    );

    expect(screen.getByText('Office Datasheet')).toBeInTheDocument();
    expect(screen.getAllByText('Mumbai HQ')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Delhi Hub')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Rahul Sharma')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Amit Verma')[0]).toBeInTheDocument();
  });

  it('should display "No offices registered" message when list is empty', () => {
    render(
      <OfficeMaster
        offices={[]}
        onAddOffice={vi.fn()}
        onUpdateOffice={vi.fn()}
        onDeleteOffice={vi.fn()}
      />
    );

    expect(screen.getAllByText(/No offices registered/i)[0]).toBeInTheDocument();
  });

  it('should restrict view details when canViewOffices is false', () => {
    render(
      <OfficeMaster
        offices={mockOffices}
        onAddOffice={vi.fn()}
        onUpdateOffice={vi.fn()}
        onDeleteOffice={vi.fn()}
        canViewOffices={false}
      />
    );

    // Should display restricted text instead of actual contact details
    expect(screen.queryByText('Rahul Sharma')).not.toBeInTheDocument();
    expect(screen.queryByText('9876543210')).not.toBeInTheDocument();
    expect(screen.getAllByText('[Restricted]').length).toBeGreaterThan(0);
  });

  it('should toggle form open and close when clicking Add New Office', () => {
    render(
      <OfficeMaster
        offices={mockOffices}
        onAddOffice={vi.fn()}
        onUpdateOffice={vi.fn()}
        onDeleteOffice={vi.fn()}
      />
    );

    // Form shouldn't be visible initially
    expect(screen.queryByText('Register New Office')).not.toBeInTheDocument();

    // Click "Add New Office"
    const addBtn = screen.getByRole('button', { name: /Add New Office/i });
    fireEvent.click(addBtn);

    // Form should be visible
    expect(screen.getByText('Register New Office')).toBeInTheDocument();

    // Click "Close Form"
    const closeBtn = screen.getByRole('button', { name: /Close Form/i });
    fireEvent.click(closeBtn);

    // Form should be hidden again
    expect(screen.queryByText('Register New Office')).not.toBeInTheDocument();
  });

  it('should trigger onAddOffice callback with valid inputs', () => {
    const handleAdd = vi.fn();
    render(
      <OfficeMaster
        offices={mockOffices}
        onAddOffice={handleAdd}
        onUpdateOffice={vi.fn()}
        onDeleteOffice={vi.fn()}
      />
    );

    // Open Form
    fireEvent.click(screen.getByRole('button', { name: /Add New Office/i }));

    // Fill Form inputs
    fireEvent.change(screen.getByLabelText(/Office Name/i), { target: { value: 'Bangalore Branch' } });
    fireEvent.change(screen.getByLabelText(/City\/Branch Location/i), { target: { value: 'Bangalore' } });
    fireEvent.change(screen.getByLabelText(/Contact Person/i), { target: { value: 'Sanjay Kumar' } });
    fireEvent.change(screen.getByLabelText(/Contact Phone/i), { target: { value: '7654321098' } });
    fireEvent.change(screen.getByLabelText(/Office Status/i), { target: { value: 'Active' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'Add Office' }));

    // Callback must be called with input details
    expect(handleAdd).toHaveBeenCalledTimes(1);
    expect(handleAdd).toHaveBeenCalledWith({
      officeName: 'Bangalore Branch',
      city: 'Bangalore',
      contactPerson: 'Sanjay Kumar',
      phone: '+917654321098',
      status: 'Active',
    });
  });

  it('should load office details into form for editing and update them', () => {
    const handleUpdate = vi.fn();
    render(
      <OfficeMaster
        offices={mockOffices}
        onAddOffice={vi.fn()}
        onUpdateOffice={handleUpdate}
        onDeleteOffice={vi.fn()}
      />
    );

    // Click edit on the first row (Mumbai HQ)
    const editButtons = screen.getAllByTitle('Edit Office');
    fireEvent.click(editButtons[0]);

    // Verify form opened in edit mode
    expect(screen.getByText('Modify Office Details')).toBeInTheDocument();

    // Verify inputs pre-populated
    const nameInput = screen.getByLabelText(/Office Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Mumbai HQ');

    // Change value and submit
    fireEvent.change(nameInput, { target: { value: 'Mumbai Headquarters' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Office' }));

    expect(handleUpdate).toHaveBeenCalledTimes(1);
    expect(handleUpdate).toHaveBeenCalledWith({
      id: 'off-1',
      officeName: 'Mumbai Headquarters',
      city: 'Mumbai',
      contactPerson: 'Rahul Sharma',
      phone: '9876543210',
      status: 'Active',
    });
  });

  it('should trigger onDeleteOffice callback after user confirmation', () => {
    const handleDelete = vi.fn();
    const handleConfirm = vi.fn((msg, onConfirm) => onConfirm()); // Auto-confirm
    
    render(
      <OfficeMaster
        offices={mockOffices}
        onAddOffice={vi.fn()}
        onUpdateOffice={vi.fn()}
        onDeleteOffice={handleDelete}
        confirmAction={handleConfirm}
      />
    );

    const deleteButtons = screen.getAllByTitle('Delete Office');
    fireEvent.click(deleteButtons[1]); // Delete Delhi Hub

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleDelete).toHaveBeenCalledWith('off-2');
  });

  it('should disable edit and delete actions when permissions are false', () => {
    render(
      <OfficeMaster
        offices={mockOffices}
        onAddOffice={vi.fn()}
        onUpdateOffice={vi.fn()}
        onDeleteOffice={vi.fn()}
        canEditOffices={false}
        canDeleteOffices={false}
      />
    );

    // Add button should not render
    expect(screen.queryByRole('button', { name: /Add New Office/i })).not.toBeInTheDocument();

    // Action buttons in the table should be disabled
    const editButtons = screen.getAllByTitle('Edit Office');
    const deleteButtons = screen.getAllByTitle('Delete Office');

    expect(editButtons[0]).toBeDisabled();
    expect(deleteButtons[0]).toBeDisabled();
  });
});
