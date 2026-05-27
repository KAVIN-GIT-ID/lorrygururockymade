import React, { useState } from 'react';
import { Office } from '../types';
import { Plus, Edit2, Trash2, MapPin, Phone, User, CheckCircle, XCircle } from 'lucide-react';

interface OfficeMasterProps {
  offices: Office[];
  onAddOffice: (office: Omit<Office, 'id'>) => void;
  onUpdateOffice: (office: Office) => void;
  onDeleteOffice: (id: string) => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
  canViewOffices?: boolean;
  canEditOffices?: boolean;
  canDeleteOffices?: boolean;
}

export default function OfficeMaster({ 
  offices, 
  onAddOffice, 
  onUpdateOffice, 
  onDeleteOffice, 
  confirmAction, 
  canViewOffices = true,
  canEditOffices = true,
  canDeleteOffices = true
}: OfficeMasterProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form States
  const [officeName, setOfficeName] = useState('');
  const [city, setCity] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const resetForm = () => {
    setOfficeName('');
    setCity('');
    setContactPerson('');
    setPhone('');
    setStatus('Active');
    setIsEditing(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeName.trim()) return;

    if (isEditing) {
      onUpdateOffice({
        id: isEditing,
        officeName,
        city,
        contactPerson,
        phone,
        status
      });
    } else {
      onAddOffice({
        officeName,
        city,
        contactPerson,
        phone,
        status
      });
    }
    resetForm();
    setShowAddForm(false);
  };

  const startEdit = (office: Office) => {
    setIsEditing(office.id);
    setOfficeName(office.officeName);
    setCity(office.city || '');
    setContactPerson(office.contactPerson || '');
    setPhone(office.phone || '');
    setStatus(office.status);
    setShowAddForm(true);
  };

  return (
    <div id="office-master-panel" className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">Office Datasheet</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage active trading offices and transport hubs details.</p>
        </div>
        {canEditOffices && (
          <button
            id="btn-add-office"
            onClick={() => {
              resetForm();
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-150 shadow-sm text-xs cursor-pointer"
          >
            {showAddForm ? 'Close Form' : (
              <>
                <Plus className="w-3.5 h-3.5" /> Add New Office
              </>
            )}
          </button>
        )}
      </div>

      {showAddForm && (
        <form id="office-form" onSubmit={handleSubmit} className="mb-6 p-4 md:p-5 bg-slate-50 rounded-lg border border-slate-250/70 animate-fade-in">
          <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4">
            {isEditing ? 'Modify Office Details' : 'Register New Office'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label htmlFor="input-office-name" className="block text-xs font-semibold text-slate-600 mb-1">Office Name <span className="text-red-500">*</span></label>
              <input
                id="input-office-name"
                type="text"
                placeholder="e.g. Mumbai Logistics"
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
              />
            </div>
            <div>
              <label htmlFor="input-office-city" className="block text-xs font-semibold text-slate-600 mb-1">City/Branch Location</label>
              <input
                id="input-office-city"
                type="text"
                placeholder="e.g. Mumbai"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="input-office-contact" className="block text-xs font-semibold text-slate-600 mb-1">Contact Person</label>
              <input
                id="input-office-contact"
                type="text"
                placeholder="Manager/Agent name"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="input-office-phone" className="block text-xs font-semibold text-slate-600 mb-1">Contact Phone</label>
              <input
                id="input-office-phone"
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="select-office-status" className="block text-xs font-semibold text-slate-600 mb-1">Office Status</label>
              <select
                id="select-office-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive/Closed</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-805 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-2xs cursor-pointer"
            >
              {isEditing ? 'Update Office' : 'Add Office'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-lg hidden md:block">
        <table id="offices-table" className="w-full text-left text-sm text-slate-700">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 font-bold tracking-wider">
            <tr>
              <th className="px-4 py-3.5 pl-6">Office Name</th>
              <th className="px-4 py-3.5">Location/City</th>
              <th className="px-4 py-3.5">Contact Person</th>
              <th className="px-4 py-3.5">Phone</th>
              <th className="px-4 py-3.5 text-center">Status</th>
              <th className="px-4 py-3.5 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {offices.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400 font-medium italic">No offices registered. Create a transport branch/broker office.</td>
              </tr>
            ) : (
              offices.map((office) => (
                <tr key={office.id} id={`row-office-${office.id}`} className="hover:bg-slate-50/75 transition">
                  <td className="px-4 py-3.5 pl-6 font-bold text-slate-800">
                    {office.officeName}
                  </td>
                  <td className="px-4 py-3.5 text-slate-650 font-medium">
                    {office.city ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200/60 rounded px-2 py-0.5">
                        <MapPin className="w-3 h-3 text-blue-600" />
                        {office.city}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic font-mono">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 font-medium">
                    {canViewOffices ? (
                      office.contactPerson ? (
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {office.contactPerson}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic font-mono">&mdash;</span>
                      )
                    ) : (
                      <span className="text-slate-450 italic text-[11px] font-mono">[Restricted]</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-600 font-medium">
                    {canViewOffices ? (
                      office.phone ? (
                        <a href={`tel:${office.phone}`} className="text-blue-600 hover:underline flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {office.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic font-mono">&mdash;</span>
                      )
                    ) : (
                      <span className="text-slate-450 italic text-[11px] font-mono">[Restricted]</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {office.status === 'Active' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 text-[10px] font-semibold">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <button
                        title="Edit Office Details"
                        disabled={!canEditOffices}
                        onClick={() => startEdit(office)}
                        className="p-1 px-2.5 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-105 rounded border border-slate-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete office"
                        disabled={!canDeleteOffices}
                        onClick={() => {
                          const msg = `Caution! Are you sure you want to permanently delete office branch ${office.officeName}? This can disrupt filters in Trip journal sheets.`;
                          if (confirmAction) {
                            confirmAction(msg, () => onDeleteOffice(office.id), "Delete branch office");
                          } else if (confirm(msg)) {
                            onDeleteOffice(office.id);
                          }
                        }}
                        className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-750 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE LIST CARD VIEW */}
      <div className="block md:hidden space-y-4">
        {offices.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 py-12 text-center text-slate-400 italic">
            No offices registered. Create a transport branch/broker office.
          </div>
        ) : (
          offices.map((office) => (
            <div 
              key={office.id}
              className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-3xs flex flex-col justify-between hover:border-blue-300 transition"
            >
              <div>
                {/* Top Row: Office Name & Status */}
                <div className="flex justify-between items-center gap-2 mb-3">
                  <h4 className="font-bold text-slate-800 text-sm truncate">{office.officeName}</h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    office.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {office.status}
                  </span>
                </div>

                {/* Details Section */}
                <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-2.5 space-y-1.5 text-xs text-slate-650 mb-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Location</span>
                    {office.city ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200/60 rounded px-2 py-0.5">
                        <MapPin className="w-3 h-3 text-blue-600" />
                        {office.city}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">—</span>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Contact Person</span>
                    {canViewOffices ? (
                      office.contactPerson ? (
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {office.contactPerson}
                        </span>
                      ) : (
                        <span className="text-slate-450 italic">—</span>
                      )
                    ) : (
                      <span className="text-slate-450 italic">[Restricted]</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Phone</span>
                    {canViewOffices ? (
                      office.phone ? (
                        <a href={`tel:${office.phone}`} className="text-blue-600 hover:underline flex items-center gap-1 font-mono font-medium">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {office.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )
                    ) : (
                      <span className="text-slate-450 italic">[Restricted]</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100/60 mt-auto">
                <button
                  type="button"
                  disabled={!canEditOffices}
                  onClick={() => startEdit(office)}
                  className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[10px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  disabled={!canDeleteOffices}
                  onClick={() => {
                    const msg = `Caution! Are you sure you want to permanently delete office branch ${office.officeName}? This can disrupt filters in Trip journal sheets.`;
                    if (confirmAction) {
                      confirmAction(msg, () => onDeleteOffice(office.id), "Delete branch office");
                    } else if (confirm(msg)) {
                      onDeleteOffice(office.id);
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-rose-150 bg-rose-50/20 hover:bg-rose-50/50 text-rose-600 font-semibold text-[10px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
