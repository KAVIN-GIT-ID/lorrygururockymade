import { mergeProps, createSignal } from 'solid-js';
import { useOfficesContext } from '../context/OfficeContext';
import { usePermissions } from '../context/PermissionContext';
import { Office } from '../types';
import { Plus, Edit2, Trash2, MapPin, User, Phone } from 'lucide-solid';
import CountryCodePhoneInput from './CountryCodePhoneInput';

interface OfficeMasterProps {
  offices?: Office[];
  onAddOffice?: (office: Omit<Office, 'id'>) => void;
  onUpdateOffice?: (office: Office) => void;
  onDeleteOffice?: (id: string) => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
  canViewOffices?: boolean;
  canEditOffices?: boolean;
  canDeleteOffices?: boolean;
}

export default function OfficeMaster(rawProps: OfficeMasterProps) {
  const officeCtx = useOfficesContext();
  const permissionCtx = usePermissions();

  const props = mergeProps(rawProps, {
    get offices() { return rawProps.offices !== undefined ? rawProps.offices : (officeCtx ? officeCtx.orgOffices() : []); },
    onAddOffice: rawProps.onAddOffice || officeCtx?.addOffice,
    onUpdateOffice: rawProps.onUpdateOffice || officeCtx?.updateOffice,
    onDeleteOffice: rawProps.onDeleteOffice || officeCtx?.deleteOffice,
    get canViewOffices() { return rawProps.canViewOffices !== undefined ? rawProps.canViewOffices : (permissionCtx?.currentUserRights()?.canViewOffices ?? true); },
    get canEditOffices() { return rawProps.canEditOffices !== undefined ? rawProps.canEditOffices : (permissionCtx?.currentUserRights()?.canEditOffices ?? true); },
    get canDeleteOffices() { return rawProps.canDeleteOffices !== undefined ? rawProps.canDeleteOffices : (permissionCtx?.currentUserRights()?.canDeleteOffices ?? true); }
  });

  const [officeName, setOfficeName] = createSignal('');
  const [city, setCity] = createSignal('');
  const [contactPerson, setContactPerson] = createSignal('');
  const [phone, setPhone] = createSignal('');
  const [status, setStatus] = createSignal<'Active' | 'Inactive'>('Active');

  const [isEditing, setIsEditing] = createSignal<string | null>(null);
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');

  const resetForm = () => {
    setOfficeName('');
    setCity('');
    setContactPerson('');
    setPhone('');
    setStatus('Active');
    setIsEditing(null);
    setShowAddForm(false);
  };

  const startEdit = (office: Office) => {
    setIsEditing(office.id);
    setOfficeName(office.officeName || '');
    setCity(office.city || '');
    setContactPerson(office.contactPerson || '');
    setPhone(office.phone || '');
    setStatus(office.status || 'Active');
    setShowAddForm(true);
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!officeName().trim()) return;

    if (isEditing()) {
      props.onUpdateOffice?.({
        id: isEditing()!,
        officeName: officeName().trim(),
        city: city().trim(),
        contactPerson: contactPerson().trim(),
        phone: phone().trim(),
        status: status()
      });
    } else {
      props.onAddOffice?.({
        officeName: officeName().trim(),
        city: city().trim(),
        contactPerson: contactPerson().trim(),
        phone: phone().trim(),
        status: status()
      });
    }
    resetForm();
  };

  const filteredOffices = () => {
    const list = props.offices || [];
    const query = searchQuery().toLowerCase().trim();
    if (!query) return list;
    return list.filter(o =>
      (o.officeName || '').toLowerCase().includes(query) ||
      (o.city || '').toLowerCase().includes(query) ||
      (o.contactPerson || '').toLowerCase().includes(query)
    );
  };

  return (
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <MapPin class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-base font-bold text-slate-800">Office Branch Directory</h2>
            <p class="text-xs text-slate-500 font-medium">Manage active trading offices and transport hub details.</p>
          </div>
        </div>

        {props.canEditOffices && (
          <button
            onClick={() => {
              if (showAddForm()) resetForm();
              else setShowAddForm(true);
            }}
            class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-150 shadow-sm text-xs cursor-pointer"
          >
            {showAddForm() ? 'Close Form' : (
              <>
                <Plus class="w-3.5 h-3.5" /> Add New Office
              </>
            )}
          </button>
        )}
      </div>

      {showAddForm() && (
        <form id="office-form" onSubmit={handleSubmit} class="mb-6 p-4 md:p-5 bg-slate-50 rounded-lg border border-slate-250/70 animate-fade-in">
          <h3 class="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4">
            {isEditing() ? 'Modify Office Details' : 'Register New Office'}
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label for="input-office-name" class="block text-xs font-semibold text-slate-600 mb-1">Office Name <span class="text-red-500">*</span></label>
              <input
                id="input-office-name"
                type="text"
                placeholder="e.g. Mumbai Logistics"
                value={officeName()}
                onInput={(e) => setOfficeName(e.currentTarget.value)}
                required
                class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
              />
            </div>
            <div>
              <label for="input-office-city" class="block text-xs font-semibold text-slate-600 mb-1">City/Branch Location</label>
              <input
                id="input-office-city"
                type="text"
                placeholder="e.g. Mumbai"
                value={city()}
                onInput={(e) => setCity(e.currentTarget.value)}
                class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label for="input-office-person" class="block text-xs font-semibold text-slate-600 mb-1">Contact Person</label>
              <input
                id="input-office-person"
                type="text"
                placeholder="e.g. Rajesh Sharma"
                value={contactPerson()}
                onInput={(e) => setContactPerson(e.currentTarget.value)}
                class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label for="input-office-phone" class="block text-xs font-semibold text-slate-650 mb-1">Contact Phone</label>
              <CountryCodePhoneInput
                id="input-office-phone"
                value={phone()}
                onChange={(val) => setPhone(val)}
                placeholder="Enter mobile number"
              />
            </div>
            <div>
              <label for="select-office-status" class="block text-xs font-semibold text-slate-600 mb-1">Office Status</label>
              <select
                id="select-office-status"
                value={status()}
                onChange={(e) => setStatus(e.currentTarget.value as 'Active' | 'Inactive')}
                class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive/Closed</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={resetForm}
              class="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-2xs cursor-pointer"
            >
              {isEditing() ? 'Update Office' : 'Add Office'}
            </button>
          </div>
        </form>
      )}

      <div class="overflow-x-auto border border-slate-200 rounded-lg hidden md:block">
        <table id="offices-table" class="w-full text-left text-sm text-slate-700">
          <thead class="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 font-bold tracking-wider">
            <tr>
              <th class="px-4 py-3.5 pl-6">Office Name</th>
              <th class="px-4 py-3.5">Location/City</th>
              <th class="px-4 py-3.5">Contact Person</th>
              <th class="px-4 py-3.5">Phone</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <th class="px-4 py-3.5 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-sans">
            {filteredOffices().length === 0 ? (
              <tr>
                <td colSpan={6} class="text-center py-12 text-slate-400 font-medium italic">No offices registered. Create a transport branch/broker office.</td>
              </tr>
            ) : (
              filteredOffices().map((office) => (
                <tr id={`row-office-${office.id}`} class="hover:bg-slate-50/75 transition">
                  <td class="px-4 py-3.5 pl-6 font-bold text-slate-800">
                    {office.officeName}
                  </td>
                  <td class="px-4 py-3.5 text-slate-650 font-medium">
                    {office.city ? (
                      <span class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200/60 rounded px-2 py-0.5">
                        <MapPin class="w-3 h-3 text-blue-600" />
                        {office.city}
                      </span>
                    ) : (
                      <span class="text-slate-400 italic font-mono">&mdash;</span>
                    )}
                  </td>
                  <td class="px-4 py-3.5 text-slate-600 font-medium">
                    {props.canViewOffices ? (
                      office.contactPerson ? (
                        <span class="flex items-center gap-1.5">
                          <User class="w-3.5 h-3.5 text-slate-400" />
                          {office.contactPerson}
                        </span>
                      ) : (
                        <span class="text-slate-400 italic font-mono">&mdash;</span>
                      )
                    ) : (
                      <span class="text-slate-450 italic text-[11px] font-mono">[Restricted]</span>
                    )}
                  </td>
                  <td class="px-4 py-3.5 font-mono text-slate-600 font-medium">
                    {props.canViewOffices ? (
                      office.phone ? (
                        <a href={`tel:${office.phone}`} class="text-blue-600 hover:underline flex items-center gap-1">
                          <Phone class="w-3.5 h-3.5 text-slate-400" />
                          {office.phone}
                        </a>
                      ) : (
                        <span class="text-slate-400 italic font-mono">&mdash;</span>
                      )
                    ) : (
                      <span class="text-slate-450 italic text-[11px] font-mono">[Restricted]</span>
                    )}
                  </td>
                  <td class="px-4 py-3.5 text-center">
                    {office.status === 'Active' ? (
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                        Active
                      </span>
                    ) : (
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 text-[10px] font-semibold">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td class="px-4 py-3.5 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                    <div class="flex justify-end gap-2">
                      <button
                        title="Edit Office"
                        disabled={!props.canEditOffices}
                        onClick={() => startEdit(office)}
                        class="p-1 px-2.5 bg-slate-50 text-slate-600 hover:text-slate-900 rounded border border-slate-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Edit2 class="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete Office"
                        disabled={!props.canDeleteOffices}
                        onClick={() => {
                          const msg = `Caution! Are you sure you want to permanently delete office branch ${office.officeName}? This can disrupt filters in Trip journal sheets.`;
                          if (props.confirmAction) {
                            props.confirmAction(msg, () => props.onDeleteOffice?.(office.id), "Delete branch office");
                          } else if (confirm(msg)) {
                            props.onDeleteOffice?.(office.id);
                          }
                        }}
                        class="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-750 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div class="block md:hidden space-y-4">
        {filteredOffices().length === 0 ? (
          <div class="bg-white border border-slate-200 rounded-xl p-8 py-12 text-center text-slate-400 italic">
            No offices registered. Create a transport branch/broker office.
          </div>
        ) : (
          filteredOffices().map((office) => (
            <div
              class="bg-white border border-slate-200 rounded-xl p-4.5 shadow-3xs flex flex-col justify-between hover:border-blue-300 transition"
            >
              <div>
                <div class="flex justify-between items-center gap-2 mb-3">
                  <h4 class="font-bold text-slate-800 text-sm truncate">{office.officeName}</h4>
                  <span class={`px-2 py-0.5 rounded text-[10px] font-bold ${office.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                    {office.status}
                  </span>
                </div>

                <div class="bg-slate-50 border border-slate-200/60 rounded-lg p-2.5 space-y-1.5 text-xs text-slate-650 mb-3.5">
                  <div class="flex justify-between items-center">
                    <span class="text-slate-400 font-bold uppercase text-[9px]">Location</span>
                    {office.city ? (
                      <span class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200/60 rounded px-2 py-0.5">
                        <MapPin class="w-3 h-3 text-blue-600" />
                        {office.city}
                      </span>
                    ) : (
                      <span class="text-slate-400 italic">&mdash;</span>
                    )}
                  </div>

                  <div class="flex justify-between items-center">
                    <span class="text-slate-400 font-bold uppercase text-[9px]">Contact Person</span>
                    {props.canViewOffices ? (
                      office.contactPerson ? (
                        <span class="flex items-center gap-1.5">
                          <User class="w-3.5 h-3.5 text-slate-400" />
                          {office.contactPerson}
                        </span>
                      ) : (
                        <span class="text-slate-400 italic">&mdash;</span>
                      )
                    ) : (
                      <span class="text-slate-400 italic text-[11px]">[Restricted]</span>
                    )}
                  </div>

                  <div class="flex justify-between items-center">
                    <span class="text-slate-400 font-bold uppercase text-[9px]">Phone</span>
                    {props.canViewOffices ? (
                      office.phone ? (
                        <a href={`tel:${office.phone}`} class="text-blue-600 hover:underline flex items-center gap-1">
                          <Phone class="w-3.5 h-3.5 text-slate-400" />
                          {office.phone}
                        </a>
                      ) : (
                        <span class="text-slate-400 italic">&mdash;</span>
                      )
                    ) : (
                      <span class="text-slate-400 italic text-[11px]">[Restricted]</span>
                    )}
                  </div>
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-2 border-t border-slate-150">
                <button
                  disabled={!props.canEditOffices}
                  onClick={() => startEdit(office)}
                  class="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded hover:bg-slate-200 transition disabled:opacity-40"
                >
                  <Edit2 class="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  disabled={!props.canDeleteOffices}
                  onClick={() => {
                    const msg = `Caution! Are you sure you want to permanently delete office branch ${office.officeName}? This can disrupt filters in Trip journal sheets.`;
                    if (props.confirmAction) {
                      props.confirmAction(msg, () => props.onDeleteOffice?.(office.id), "Delete branch office");
                    } else if (confirm(msg)) {
                      props.onDeleteOffice?.(office.id);
                    }
                  }}
                  class="flex-1 flex items-center justify-center gap-1 py-1.5 bg-rose-50 text-rose-600 text-xs font-semibold rounded hover:bg-rose-100 transition disabled:opacity-40"
                >
                  <Trash2 class="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
