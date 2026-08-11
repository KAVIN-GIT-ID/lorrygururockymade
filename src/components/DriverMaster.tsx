import { createSignal, createEffect, mergeProps } from 'solid-js';
import { useTripsContext } from '../context/TripContext';
import { useTrucksContext } from '../context/TruckContext';
import { useDriversContext } from '../context/DriverContext';
import { useExpensesContext } from '../context/ExpenseContext';
import { useOfficesContext } from '../context/OfficeContext';
import { useAccountsContext } from '../context/AccountContext';
import { useTyresContext } from '../context/TyreContext';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';

import { Driver, TripEntry, ExpenseEntry, Account, OrganizationProfile, getTripMetrics, TripAdvance } from '../types';
import { Plus, Edit2, Trash2, User, Phone, FileText, CheckCircle, XCircle, Calculator, Coins, TrendingUp, Wallet, ArrowUpRight, ArrowDownLeft, Receipt, Loader2, X, MoreVertical, Settings, AlertCircle, ArrowRightLeft } from 'lucide-solid';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import CountryCodePhoneInput from './CountryCodePhoneInput';
import { useLanguage } from '../context/LanguageContext';

interface DriverMasterProps {
  drivers: Driver[];
  trips?: TripEntry[];
  expenses?: ExpenseEntry[];
  accounts?: Account[];
  onAddDriver: (driver: Omit<Driver, 'id'>) => void;
  onUpdateDriver: (driver: Driver) => void;
  onDeleteDriver: (id: string) => void;
  selectedDriverId?: string;
  canViewDrivers?: boolean;
  canEditDrivers?: boolean;
  canDeleteDrivers?: boolean;
  organizationId?: string;
  orgProfile?: OrganizationProfile;
  autoOpenAdd?: boolean;
  onAutoOpenCleared?: () => void;
  onSaveTrips?: (newTrips: TripEntry[]) => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
}

export default function DriverMaster(rawProps: DriverMasterProps) {
  const { t } = useLanguage();
  const tripsCtx = useTripsContext();
  const driversCtx = useDriversContext();
  const expenseCtx = useExpensesContext();
  const accountCtx = useAccountsContext();
  const permissionCtx = usePermissions();

  const props = mergeProps(
    {
      get drivers() { return rawProps.drivers !== undefined ? rawProps.drivers : (driversCtx ? driversCtx.orgDrivers() : []); },
      get trips() { return rawProps.trips !== undefined ? rawProps.trips : (tripsCtx ? tripsCtx.orgTrips() : []); },
      get expenses() { return rawProps.expenses !== undefined ? rawProps.expenses : (expenseCtx ? expenseCtx.orgExpenses() : []); },
      get accounts() { return rawProps.accounts !== undefined ? rawProps.accounts : (accountCtx ? accountCtx.orgAccounts() : []); },
      get selectedDriverId() { return rawProps.selectedDriverId !== undefined ? rawProps.selectedDriverId : ''; },
      onAddDriver: rawProps.onAddDriver || driversCtx?.addDriver,
      onUpdateDriver: rawProps.onUpdateDriver || driversCtx?.updateDriver,
      onDeleteDriver: rawProps.onDeleteDriver || driversCtx?.deleteDriver,
      onSaveTrips: rawProps.onSaveTrips || tripsCtx?.saveTrips,
      get canViewDrivers() { return rawProps.canViewDrivers !== undefined ? rawProps.canViewDrivers : (permissionCtx?.currentUserRights()?.canViewDrivers ?? true); },
      get canEditDrivers() { return rawProps.canEditDrivers !== undefined ? rawProps.canEditDrivers : (permissionCtx?.currentUserRights()?.canEditDrivers ?? true); },
      get canDeleteDrivers() { return rawProps.canDeleteDrivers !== undefined ? rawProps.canDeleteDrivers : (permissionCtx?.currentUserRights()?.canDeleteDrivers ?? true); },
      get organizationId() { return rawProps.organizationId || permissionCtx?.currentUserOrgId() || ''; }
    },
    rawProps
  );
  const {
    onAddDriver,
    onUpdateDriver,
    onDeleteDriver,
    orgProfile,
    autoOpenAdd,
    onAutoOpenCleared,
    onSaveTrips,
    confirmAction
  } = props;
  const [isEditing, setIsEditing] = createSignal<string | null>(null);
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [activeSpeedDialId, setActiveSpeedDialId] = createSignal<string | null>(null);

  const [selectedDriverId, setSelectedDriverId] = createSignal<string>(
    props.selectedDriverId || (props.drivers && props.drivers.length > 0 ? props.drivers[0].id : '')
  );

  createEffect(() => {
    const targetId = props.selectedDriverId || (props.drivers && props.drivers.length > 0 ? props.drivers[0].id : '');
    if (targetId && selectedDriverId() !== targetId) {
      setSelectedDriverId(targetId);
    }
  });

  const [selectedFwdSourceTripId, setSelectedFwdSourceTripId] = createSignal<string>('');
  const [selectedFwdTripId, setSelectedFwdTripId] = createSignal<string>('');
  const [selectedFwdMode, setSelectedFwdMode] = createSignal<'trip' | 'account'>('trip');
  const [selectedFwdAccountId, setSelectedFwdAccountId] = createSignal<string>('');
  const [selectedFwdDate, setSelectedFwdDate] = createSignal<string>(new Date().toISOString().substring(0, 10));

  // Reset forward options when selectedDriverId() changes
  createEffect(() => {
    setSelectedFwdSourceTripId('');
    setSelectedFwdTripId('');
    setSelectedFwdAccountId('');
    setSelectedFwdMode('trip');
    setSelectedFwdDate(new Date().toISOString().substring(0, 10));
  });

  // Form States
  const [driverName, setDriverName] = createSignal('');
  const [phone, setPhone] = createSignal('');
  const [licenseNo, setLicenseNo] = createSignal('');
  const [status, setStatus] = createSignal<'Active' | 'Inactive'>('Active');
  const [licenseFileId, setLicenseFileId] = createSignal('');
  const [licenseUploading, setLicenseUploading] = createSignal(false);
  const [licenseFile, setLicenseFile] = createSignal<File | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const handleLicenseFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!driverName().trim() && !licenseNo().trim()) {
      alert("Please enter the Driver Name or License Number first before uploading documents so we can name the file properly.");
      e.target.value = '';
      return;
    }
    setLicenseFile(file);
  };

  const resetForm = () => {
    setDriverName('');
    setPhone('');
    setLicenseNo('');
    setStatus('Active');
    setLicenseFileId('');
    setLicenseFile(null);
    setLicenseUploading(false);
    setIsSubmitting(false);
    setIsEditing(null);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!driverName().trim()) return;

    setIsSubmitting(true);
    let uploadedLicenseId = licenseFileId();

    try {
      if (licenseFile()) {
        setLicenseUploading(true);
        const sanitizedOrgId = (props.organizationId || 'default').replace(/[^a-zA-Z0-9-]/g, '_');
        const identifier = (licenseNo() || driverName()).trim().replace(/[^a-zA-Z0-9-]/g, '_');
        const customName = `${sanitizedOrgId}_DL_${identifier}`;
        uploadedLicenseId = await appwrite.uploadFile(licenseFile(), customName, props.organizationId);
        setLicenseFileId(uploadedLicenseId);
      }
    } catch (err) {
      alert("Failed to upload driving license document. Please check your network connection and Appwrite configuration.");
      setIsSubmitting(false);
      setLicenseUploading(false);
      return;
    } finally {
      setLicenseUploading(false);
    }

    if (isEditing()) {
      onUpdateDriver({
        id: isEditing(),
        driverName: driverName(),
        phone: phone(),
        licenseNo: licenseNo(),
        status: status(),
        licenseFileId: uploadedLicenseId || undefined
      });
    } else {
      onAddDriver({
        driverName: driverName(),
        phone: phone(),
        licenseNo: licenseNo(),
        status: status(),
        licenseFileId: uploadedLicenseId || undefined
      });
    }
    resetForm();
    setShowAddForm(false);
  };

  const startEdit = (driver: Driver) => {
    setIsEditing(driver.id);
    setDriverName(driver.driverName || '');
    setPhone(driver.phone || '');
    setLicenseNo(driver.licenseNo || '');
    setStatus(driver.status);
    setLicenseFileId(driver.licenseFileId || '');
    setLicenseFile(null);
    setShowAddForm(true);
  };

  return (
    <div id="driver-master-panel" class="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs animate-fade-in text-slate-850">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 class="text-lg font-bold text-slate-800 tracking-tight">{t('driver.title', 'Driver Registry')}</h2>
          <p class="text-xs text-slate-500 mt-0.5">{t('driver.subtitle', 'Manage operator drivers database sheets for transport allocations.')}</p>
        </div>
        {props.canEditDrivers && (
          <button
            id="btn-add-driver"
            onClick={() => {
              resetForm();
              setShowAddForm(!showAddForm());
            }}
            class="flex items-center gap-2 bg-blue-600 hover:bg-blue-750 text-white font-semibold px-4 py-2 rounded-lg transition duration-150 shadow-sm text-xs cursor-pointer"
          >
            {showAddForm() ? t('btn.close', 'Close Form') : (
              <>
                <Plus class="w-3.5 h-3.5" /> {t('btn.new_driver', '+ Add Driver')}
              </>
            )}
          </button>
        )}
      </div>

      {showAddForm() && (
        <div class="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 backdrop-blur-xs p-4 overflow-y-auto py-8 animate-fade-in" id="driver-form-backdrop">
          <form id="driver-form" onSubmit={handleSubmit} class="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto text-left my-auto">
            <div class="flex justify-between items-center border-b border-slate-200 dark:border-slate-850 pb-3">
              <div class="flex items-center gap-2">
                <User class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 class="text-sm font-bold text-slate-805 dark:text-white tracking-wide">
                  {isEditing() ? 'Modify Driver Specifications' : 'Register New Driver'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  resetForm();
                  setShowAddForm(false);
                }}
                class="p-1.5 hover:bg-slate-105 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 rounded-xl transition cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label for="input-driver-name" class="block text-xs font-semibold text-slate-650 mb-1">Driver Name <span class="text-red-500">*</span></label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <User class="w-3.5 h-3.5" />
                  </span>
                  <input
                    id="input-driver-name"
                    type="text"
                    placeholder="e.g. Ramesh Pal"
                    value={driverName()}
                    onChange={(e) => setDriverName(e.currentTarget.value)}
                    onInput={(e) => setDriverName(e.currentTarget.value)}
                    required
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>
              <div>
                <label for="input-driver-phone" class="block text-xs font-semibold text-slate-650 mb-1">Contact Phone</label>
                <CountryCodePhoneInput
                  id="input-driver-phone"
                  value={phone()}
                  onChange={(val) => setPhone(val)}
                  placeholder="Enter mobile number"
                />
              </div>
              <div>
                <label for="input-driver-license" class="block text-xs font-semibold text-slate-650 mb-1">Driving License No.</label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <FileText class="w-3.5 h-3.5" />
                  </span>
                  <input
                    id="input-driver-license"
                    type="text"
                    placeholder="e.g. DL-142018009"
                    value={licenseNo()}
                    onChange={(e) => setLicenseNo(e.currentTarget.value)}
                    onInput={(e) => setLicenseNo(e.currentTarget.value)}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label for="select-driver-status" class="block text-xs font-semibold text-slate-650 mb-1">Status</label>
                <select
                  id="select-driver-status"
                  value={status()}
                  onChange={(e) => setStatus(e.currentTarget.value as 'Active' | 'Inactive')}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div class="col-span-full border-t border-slate-200/50 pt-3 mt-1">
                <label class="block text-xs font-semibold text-slate-650 mb-1">Upload Driving License Document (Optional)</label>
                <div class="flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg p-2 max-w-md">
                  <input
                    type="file"
                    onChange={handleLicenseFileChange}
                    disabled={licenseUploading() || isSubmitting() || !isAppwriteConfigured()}
                    class="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
                  />
                  {licenseUploading() && <Loader2 class="w-4 h-4 text-blue-600 animate-spin" />}
                  {!licenseUploading() && (licenseFile() || licenseFileId()) && (
                    <div class="flex items-center gap-1.5 shrink-0">
                      <span title={licenseFile() ? `Queued: ${licenseFile()!.name}` : "Document linked"}><CheckCircle class="w-4 h-4 text-emerald-600" /></span>
                      <button
                        type="button"
                        onClick={() => {
                          setLicenseFile(null);
                          setLicenseFileId('');
                        }}
                        class="text-[9px] text-red-500 font-bold hover:underline cursor-pointer"
                        title="Remove file document"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                {!isAppwriteConfigured() && (
                  <span class="text-[9px] text-amber-500 font-semibold block mt-0.5">Appwrite bucket connection required for document uploads.</span>
                )}
              </div>
            </div>

            <div class="flex justify-end gap-2.5 mt-5 border-t border-slate-200/50 pt-4">
              <button
                id="btn-driver-cancel"
                type="button"
                disabled={isSubmitting()}
                onClick={() => {
                  resetForm();
                  setShowAddForm(false);
                }}
                class="px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="btn-driver-submit"
                type="submit"
                disabled={isSubmitting()}
                class="px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting() && <Loader2 class="w-3.5 h-3.5 animate-spin" />}
                {isSubmitting() ? 'Uploading & Saving...' : (isEditing() ? 'Save Changes' : 'Register Operator')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid listing */}
      <div class="overflow-x-auto rounded-xl border border-slate-200/60 hidden md:block">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              <th class="py-3 px-4 font-bold select-none text-slate-520">Driver Description</th>
              <th class="py-3 px-4 font-bold">Driver Phone</th>
              <th class="py-3 px-4 font-bold">Driving License</th>
              <th class="py-3 px-4 font-bold">Duty Status</th>
              <th class="py-3 px-4 text-right font-bold pr-6">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-xs">
            {(props.drivers || []).length === 0 ? (
              <tr>
                <td colSpan={5} class="py-10 text-center text-slate-400">
                  <div class="text-slate-350">No operating drivers registered in system databases.</div>
                </td>
              </tr>
            ) : (
              (props.drivers || []).map((driver) => (
                <tr class="hover:bg-slate-50/50 transition">
                  <td class="py-3.5 px-4 font-bold text-slate-800">
                    <div class="flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-[11px] font-bold shrink-0">
                        {driver.driverName ? driver.driverName.substring(0, 2).toUpperCase() : 'DR'}
                      </div>
                      <div>
                        <div class="font-bold text-slate-800">{driver.driverName}</div>
                        <div class="text-[10px] text-slate-400 font-mono mt-0.5">ID: {driver.id}</div>
                      </div>
                    </div>
                  </td>
                  <td class="py-3.5 px-4 font-medium text-slate-600">
                    {props.canViewDrivers ? (driver.phone || '—') : <span class="text-slate-400 italic text-[11px] font-mono">[Restricted]</span>}
                  </td>
                  <td class="py-3.5 px-4 text-slate-600">
                    {props.canViewDrivers ? (
                      <div class="flex flex-col gap-0.5">
                        <span class="font-mono font-medium">{driver.licenseNo || '—'}</span>
                        {driver.licenseFileId && (
                          <a
                            href="#"
                            onClick={async (e) => {
                              e.preventDefault();
                              try {
                                const url = await appwrite.getSecureFileUrl(driver.licenseFileId);
                                window.open(url, '_blank');
                              } catch (err) {
                                alert("Failed to load secure document.");
                              }
                            }}
                            class="text-[9px] text-blue-600 font-bold hover:underline"
                          >
                            View License &rarr;
                          </a>
                        )}
                      </div>
                    ) : (
                      <span class="text-slate-400 italic text-[11px] font-mono">[Restricted]</span>
                    )}
                  </td>
                  <td class="py-3.5 px-4">
                    <span class={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      driver.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {driver.status || 'Active'}
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                    <div class="flex justify-end gap-2.5">
                      <button
                        title="Edit driver"
                        disabled={!props.canEditDrivers}
                        onClick={() => startEdit(driver)}
                        class="p-1 px-2 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded font-semibold cursor-pointer text-xs flex items-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Edit2 class="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        title="Delete driver"
                        disabled={!props.canDeleteDrivers}
                        onClick={() => {
                          if (confirm(`Are you sure you want to permanently delete driver record ${driver.driverName}?`)) {
                            onDeleteDriver(driver.id);
                          }
                        }}
                        class="p-1 px-2 hover:bg-red-50 text-red-500 hover:text-red-700 rounded font-semibold cursor-pointer text-xs flex items-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 class="w-3.5 h-3.5" /> Delete
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
      <div class="block md:hidden space-y-4">
        {(props.drivers || []).length === 0 ? (
          <div class="bg-white border border-slate-200 rounded-xl p-8 py-12 text-center text-slate-400 italic">
            No operating drivers registered in system databases.
          </div>
        ) : (
          (props.drivers || []).map((driver) => (
            <div class="bg-white border border-slate-200 rounded-xl p-4.5 shadow-3xs flex flex-col justify-between hover:border-blue-300 transition relative">
              <div>
                {/* Top Row: Name, Initials Avatar & Duty Status */}
                <div class="flex justify-between items-start gap-2 mb-3 pr-8">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-[11px] font-bold shrink-0">
                      {driver.driverName ? driver.driverName.substring(0, 2).toUpperCase() : 'DR'}
                    </div>
                    <div class="min-w-0">
                      <div class="font-bold text-slate-805 text-xs truncate">{driver.driverName}</div>
                      <div class="text-[9px] text-slate-400 font-mono mt-0.5 truncate">ID: {driver.id}</div>
                    </div>
                  </div>

                  <span class={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    driver.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {driver.status || 'Active'}
                  </span>
                </div>

                {/* Details Section */}
                <div class="bg-slate-50 border border-slate-200/60 rounded-lg p-2.5 space-y-1.5 text-xs text-slate-650 mb-3.5">
                  <div class="flex justify-between items-center">
                    <span class="text-slate-400 font-bold uppercase text-[9px]">Phone</span>
                    {props.canViewDrivers ? (
                      driver.phone ? (
                        <a href={`tel:${driver.phone}`} class="font-medium text-blue-600 hover:underline flex items-center gap-1">
                          <Phone class="w-3 h-3 text-slate-400" />
                          {driver.phone}
                        </a>
                      ) : (
                        <span class="text-slate-400 italic">—</span>
                      )
                    ) : (
                      <span class="text-slate-450 italic text-[10px]">[Restricted]</span>
                    )}
                  </div>
                  
                  <div class="flex justify-between items-center">
                    <span class="text-slate-400 font-bold uppercase text-[9px]">License No</span>
                    <span class="font-mono font-medium text-slate-700">{driver.licenseNo || '—'}</span>
                  </div>

                  {driver.licenseFileId && props.canViewDrivers && (
                    <div class="flex justify-between items-center pt-1.5 border-t border-slate-200/40">
                      <span class="text-slate-400 font-bold uppercase text-[9px]">Document</span>
                      <a
                        href="#"
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            const url = await appwrite.getSecureFileUrl(driver.licenseFileId);
                            window.open(url, '_blank');
                          } catch (err) {
                            alert("Failed to load secure document.");
                          }
                        }}
                        class="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                      >
                        <FileText class="w-3.5 h-3.5" />
                        <span>View License &rarr;</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Micro-FAB Speed Dial */}
                <div class="absolute top-3 right-3 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <div class={`flex items-center gap-1.5 bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-full p-1 pl-2.5 pr-1.5 shadow-md transition-all duration-300 ease-out origin-right transform whitespace-nowrap ${
                    activeSpeedDialId() === driver.id 
                      ? 'opacity-100 scale-100 translate-x-0 pointer-events-auto' 
                      : 'opacity-0 scale-90 translate-x-2 pointer-events-none'
                  }`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDriverId(driver.id);
                        setTimeout(() => {
                          document.getElementById('driver-settlement-module')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                        setActiveSpeedDialId(null);
                      }}
                      class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
                      title="Ledger"
                    >
                      <Calculator class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!props.canEditDrivers}
                      onClick={() => {
                        startEdit(driver);
                        setActiveSpeedDialId(null);
                      }}
                      class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer disabled:opacity-45"
                      title="Edit specifications"
                    >
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!props.canDeleteDrivers}
                      onClick={() => {
                        if (confirm(`Are you sure you want to permanently delete driver record ${driver.driverName}?`)) {
                          onDeleteDriver(driver.id);
                        }
                        setActiveSpeedDialId(null);
                      }}
                      class="w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-955/20 border border-rose-150 dark:border-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-455 hover:bg-rose-100/30 transition cursor-pointer disabled:opacity-45"
                      title="Delete Operator"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSpeedDialId(activeSpeedDialId() === driver.id ? null : driver.id)}
                    class="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95 cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-200"
                  >
                    {activeSpeedDialId() === driver.id ? (
                      <X class="w-4 h-4 transition-transform duration-300 rotate-90" />
                    ) : (
                      <Settings class="w-4 h-4 transition-transform duration-300" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DRIVER SETTLEMENT & RECONCILIATION CALCULATOR MODULE (Requirement 3 & 4) */}
      <div id="driver-settlement-module" class="mt-8 pt-6 border-t border-slate-100">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
          <div>
            <h3 class="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2 font-sans uppercase">
              <Calculator class="w-4 h-4 text-emerald-600" />
              Driver Settlement & Reconciliation Statement Ledger
            </h3>
            <p class="text-[11px] text-slate-450 mt-0.5 font-sans">
              Reconcile operational driver hand ledger balance statements with trip advances & general fuel/unloading expenses.
            </p>
          </div>

          <div class="w-full sm:w-64">
            <select
              value={selectedDriverId()}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              class="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-bold cursor-pointer"
            >
              <option value="">-- Choose Operator Driver --</option>
              {(props.drivers || []).map(drv => (
                <option value={drv.id}>
                  {drv.driverName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(() => {
          const selectedDrv = (props.drivers || []).find(d => d.id === selectedDriverId());
          if (!selectedDrv) {
            return (
              <div class="p-8 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
                <Coins class="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p class="text-xs text-slate-400 italic">Select a driver from the dropdown above to calculate their live statement ledger sheet.</p>
              </div>
            );
          }

          // Gather trips for selected driver
          const drvTrips = (props.trips || []).filter(t => t.driverName.toLowerCase().trim() === selectedDrv.driverName.toLowerCase().trim() && t.status !== 'Deleted' && !t.deletedAt);
          
          // Gather ALL advances for selected driver on those trips (Category 4)
          const category4Advances = drvTrips.flatMap(t => 
            (t.advances || []).map(adv => ({
              ...adv,
              tripNo: t.tripNo
            }))
          );

          // Gather Category 3 driver advance receipts
          const category3Payments = drvTrips.flatMap(t =>
            (t.payments || [])
              .filter(p => p.receivedBy === 'paid_to_driver_advance' || p.receivedBy?.toLowerCase().includes('driver advance') || p.receivedBy?.toLowerCase().includes('driver_advance'))
              .map(p => ({
                id: p.id,
                amount: p.amount,
                date: p.date,
                fromAccountId: 'paid_to_driver_advance',
                notes: p.notes || 'Paid to Driver Advance (Category 3)',
                receivedByDriverDirectly: true,
                tripNo: t.tripNo
              }))
          );

          const drvAdvances = [...category4Advances, ...category3Payments];

          // Gather ALL driver-type expenses for selected driver name
          const drvExpenses = (props.expenses || []).filter(exp => 
            ((exp as any).accountType === 'Driver' || (exp as any).category === 'Driver Expense') && 
            (!exp.driverName || exp.driverName.toLowerCase().trim() === selectedDrv.driverName.toLowerCase().trim())
          );

          // Compute extra expense items (fuels, common expenses, subtrip expenses, and driver wages) from trips of this driver
          const computedTripDriverCredits: any[] = [];
          const recoveryItems: any[] = [];

          drvTrips.forEach(t => {
            // 1. Fuels paid by driver
            (t.fuels || []).forEach(f => {
              const paidBy = (f as any).paidBy || (f.paymentMode === 'driver' ? 'Driver' : '');
              if (paidBy === 'Driver' || paidBy === 'DriverCash') {
                computedTripDriverCredits.push({
                  id: `fuel-${f.id}`,
                  date: f.date || t.startDate,
                  type: 'Fuel Expense',
                  amount: Number(f.amount) || Number((f as any).totalCost) || 0,
                  notes: `Fuel ${f.liters || (f as any).litres || 0}L @ ₹${f.rate}/L paid by Driver (${f.shopName || (f as any).vendor || 'Pump'})`,
                  reference: `Trip: ${t.tripNo}`,
                  fromMode: 'Driver Advance Hand cash',
                  isDirect: false,
                  badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200'
                });
              }
            });

            // 2. Common trip-level expenses paid by driver
            if (t.rtoPaidByDriver && t.rtoExpense && t.rtoExpense > 0) {
              computedTripDriverCredits.push({
                id: `st-rto-${t.tripNo}`,
                date: t.startDate,
                type: 'Per-Trip RTO Expense',
                amount: t.rtoExpense,
                notes: 'RTO Permits/Expenses paid by Driver',
                reference: `Trip: ${t.tripNo}`,
                fromMode: 'Driver Advance Hand cash',
                isDirect: false,
                badgeStyle: 'bg-indigo-50 text-indigo-800 border-indigo-200'
              });
            }
            if (t.addBluePaidByDriver && t.addBlueExpense && t.addBlueExpense > 0) {
              computedTripDriverCredits.push({
                id: `st-addblue-${t.tripNo}`,
                date: t.startDate,
                type: 'Per-Trip AdBlue Expense',
                amount: t.addBlueExpense,
                notes: 'AdBlue Liquid Refill paid by Driver',
                reference: `Trip: ${t.tripNo}`,
                fromMode: 'Driver Advance Hand cash',
                isDirect: false,
                badgeStyle: 'bg-indigo-50 text-indigo-800 border-indigo-200'
              });
            }
            if (t.fastagPaidByDriver && t.fastagExpense && t.fastagExpense > 0) {
              computedTripDriverCredits.push({
                id: `st-fastag-${t.tripNo}`,
                date: t.startDate,
                type: 'Per-Trip Fastag Expense',
                amount: t.fastagExpense,
                notes: 'Fastag Tolls paid by Driver on Route',
                reference: `Trip: ${t.tripNo}`,
                fromMode: 'Driver Advance Hand cash',
                isDirect: false,
                badgeStyle: 'bg-indigo-50 text-indigo-800 border-indigo-200'
              });
            }
            if (t.otherPaidByDriver && t.otherExpense && t.otherExpense > 0) {
              computedTripDriverCredits.push({
                id: `st-other-${t.tripNo}`,
                date: t.startDate,
                type: 'Per-Trip Misc Expense',
                amount: t.otherExpense,
                notes: 'Miscellaneous other expense paid by Driver',
                reference: `Trip: ${t.tripNo}`,
                fromMode: 'Driver Advance Hand cash',
                isDirect: false,
                badgeStyle: 'bg-indigo-50 text-indigo-800 border-indigo-200'
              });
            }

            // 3. SubTrip specific cargo level loading/unloading, brokerage, crossing & wages
            if (t.subTrips) {
              t.subTrips.forEach(st => {
                const segDate = st.loadingDate || t.startDate;

                const subTripExpenses = (st.cargoExpenses && st.cargoExpenses.length > 0) ? st.cargoExpenses : ((st as any).expenses && (st as any).expenses.length > 0 ? (st as any).expenses : null);
                if (subTripExpenses && subTripExpenses.length > 0) {
                  subTripExpenses.forEach(exp => {
                    const amount = Number(exp.amount) || 0;
                    const isPaidByDriver = exp.paidByDriver !== undefined ? !!exp.paidByDriver : (exp.paidBy as string === 'DriverCash' || exp.paidBy as string === 'Driver');
                    const isBearsOrg = exp.bears === 'Org' || exp.bears === 'Office' || exp.bears === undefined;

                    if (isBearsOrg) {
                      if (isPaidByDriver) {
                        computedTripDriverCredits.push({
                          id: `seg-exp-${exp.id}`,
                          date: segDate,
                          type: `Cargo ${exp.expenseType} Expense`,
                          amount: amount,
                          notes: `${exp.expenseType} expense paid by Driver at ${st.officeName}`,
                          reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                          fromMode: 'Driver Advance Hand cash',
                          isDirect: false,
                          badgeStyle: 'bg-teal-50 text-teal-800 border-teal-200'
                        });
                      }
                    }
                    if ((exp.bears as string) === 'Driver' || (exp.paidBy as string) === 'DriverDirect') {
                      if (!isPaidByDriver) {
                        recoveryItems.push({
                          id: `seg-exp-recovery-${exp.id}`,
                          date: segDate,
                          type: `Driver Recovery (${exp.expenseType})`,
                          amount: amount,
                          notes: `${exp.expenseType} deduction from rental at ${st.officeName}`,
                          reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                          fromMode: 'Driver Recovery Debit',
                          isDirect: false,
                          badgeStyle: 'bg-rose-50 text-rose-800 border-rose-200'
                        });
                      }
                    }
                  });
                } else {
                  // Legacy fallback
                  // 1. Loading
                  const loadAmt = Number(st.loadingExpense) || 0;
                  const isLoadBearsDriver = (st.loadingBears as string) === 'Driver' || (st.loadingDeductedFrom as string) === 'Driver' || (st.loadingDeductedFrom as string) === 'DriverDirect';
                  const loadBearsOrg = st.loadingBearsOrg !== undefined ? Number(st.loadingBearsOrg) : (!isLoadBearsDriver ? loadAmt : 0);
                  const loadBearsDriver = st.loadingBearsDriver !== undefined ? Number(st.loadingBearsDriver) : (isLoadBearsDriver ? loadAmt : 0);
                  const loadPaid = !!st.loadingPaidByDriver;
                  if (loadPaid && loadBearsOrg > 0) {
                    computedTripDriverCredits.push({
                      id: `seg-load-${st.id}`,
                      date: segDate,
                      type: 'Cargo Loading Expense',
                      amount: loadBearsOrg,
                      notes: `Loading expense paid by Driver (Org bears: ₹${loadBearsOrg}) at ${st.officeName}`,
                      reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                      fromMode: 'Driver Advance Hand cash',
                      isDirect: false,
                      badgeStyle: 'bg-teal-50 text-teal-800 border-teal-200'
                    });
                  } else if (!loadPaid && loadBearsDriver > 0) {
                    recoveryItems.push({
                      id: `seg-load-recovery-${st.id}`,
                      date: segDate,
                      type: 'Driver Recovery (Loading)',
                      amount: loadBearsDriver,
                      notes: `Loading deduction from rental (Driver bears: ₹${loadBearsDriver}) at ${st.officeName}`,
                      reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                      fromMode: 'Driver Recovery Debit',
                      isDirect: false,
                      badgeStyle: 'bg-rose-50 text-rose-800 border-rose-200'
                    });
                  }

                  // 2. Unloading
                  const unloadAmt = Number(st.unloadingExpense) || 0;
                  const isUnloadBearsDriver = (st.unloadingBears as string) === 'Driver' || (st.unloadingDeductedFrom as string) === 'Driver' || (st.unloadingDeductedFrom as string) === 'DriverDirect';
                  const unloadBearsOrg = st.unloadingBearsOrg !== undefined ? Number(st.unloadingBearsOrg) : (!isUnloadBearsDriver ? unloadAmt : 0);
                  const unloadBearsDriver = st.unloadingBearsDriver !== undefined ? Number(st.unloadingBearsDriver) : (isUnloadBearsDriver ? unloadAmt : 0);
                  const unloadPaid = !!st.unloadingPaidByDriver;
                  if (unloadPaid && unloadBearsOrg > 0) {
                    computedTripDriverCredits.push({
                      id: `seg-unload-${st.id}`,
                      date: segDate,
                      type: 'Cargo Unload Expense',
                      amount: unloadBearsOrg,
                      notes: `Unloading expense paid by Driver (Org bears: ₹${unloadBearsOrg})`,
                      reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                      fromMode: 'Driver Advance Hand cash',
                      isDirect: false,
                      badgeStyle: 'bg-teal-50 text-teal-800 border-teal-200'
                    });
                  } else if (!unloadPaid && unloadBearsDriver > 0) {
                    recoveryItems.push({
                      id: `seg-unload-recovery-${st.id}`,
                      date: segDate,
                      type: 'Driver Recovery (Unloading)',
                      amount: unloadBearsDriver,
                      notes: `Unloading deduction from rental (Driver bears: ₹${unloadBearsDriver})`,
                      reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                      fromMode: 'Driver Recovery Debit',
                      isDirect: false,
                      badgeStyle: 'bg-rose-50 text-rose-800 border-rose-200'
                    });
                  }

                  // 3. Brokerage
                  const brokerageAmt = Number(st.brokerageExpense) || 0;
                  const defaultBears = orgProfile?.brokeragePolicy === 'OrgBears' ? 'Org' : 'Driver';
                  const brokerageBearsOrg = st.brokerageBearsOrg !== undefined ? Number(st.brokerageBearsOrg) : ((st.brokerageBears || defaultBears) === 'Org' ? brokerageAmt : 0);
                  const brokerageBearsDriver = st.brokerageBearsDriver !== undefined ? Number(st.brokerageBearsDriver) : ((st.brokerageBears || defaultBears) === 'Driver' ? brokerageAmt : 0);
                  const brokeragePaid = !!st.brokeragePaidByDriver;
                  if (brokeragePaid && brokerageBearsOrg > 0) {
                    computedTripDriverCredits.push({
                      id: `seg-brokerage-${st.id}`,
                      date: segDate,
                      type: 'Cargo Brokerage Expense',
                      amount: brokerageBearsOrg,
                      notes: `Brokerage expense paid by Driver (Org bears: ₹${brokerageBearsOrg})`,
                      reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                      fromMode: 'Driver Advance Hand cash',
                      isDirect: false,
                      badgeStyle: 'bg-teal-50 text-teal-800 border-teal-200'
                    });
                  } else if (!brokeragePaid && brokerageBearsDriver > 0) {
                    recoveryItems.push({
                      id: `seg-brokerage-recovery-${st.id}`,
                      date: segDate,
                      type: 'Driver Recovery (Brokerage)',
                      amount: brokerageBearsDriver,
                      notes: `Brokerage deduction from rental (Driver bears: ₹${brokerageBearsDriver})`,
                      reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                      fromMode: 'Driver Recovery Debit',
                      isDirect: false,
                      badgeStyle: 'bg-rose-50 text-rose-800 border-rose-200'
                    });
                  }

                  // 4. Crossing
                  const crossingAmt = Number(st.crossingExpense) || 0;
                  const crossingBearsOrg = st.crossingBearsOrg !== undefined ? Number(st.crossingBearsOrg) : ((st.crossingBears || 'Org') === 'Org' ? crossingAmt : 0);
                  const crossingBearsDriver = st.crossingBearsDriver !== undefined ? Number(st.crossingBearsDriver) : ((st.crossingBears || 'Org') === 'Driver' ? crossingAmt : 0);
                  const crossingPaid = !!st.crossingPaidByDriver;
                  if (crossingPaid && crossingBearsOrg > 0) {
                    computedTripDriverCredits.push({
                      id: `seg-crossing-${st.id}`,
                      date: segDate,
                      type: 'Cargo Crossing Expense',
                      amount: crossingBearsOrg,
                      notes: `Crossing expense paid by Driver (Org bears: ₹${crossingBearsOrg})`,
                      reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                      fromMode: 'Driver Advance Hand cash',
                      isDirect: false,
                      badgeStyle: 'bg-teal-50 text-teal-800 border-teal-200'
                    });
                  } else if (!crossingPaid && crossingBearsDriver > 0) {
                    recoveryItems.push({
                      id: `seg-crossing-recovery-${st.id}`,
                      date: segDate,
                      type: 'Driver Recovery (Crossing)',
                      amount: crossingBearsDriver,
                      notes: `Crossing deduction from rental (Driver bears: ₹${crossingBearsDriver})`,
                      reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                      fromMode: 'Driver Recovery Debit',
                      isDirect: false,
                      badgeStyle: 'bg-rose-50 text-rose-800 border-rose-200'
                    });
                  }

                  // 5. RMC
                  const rmcAmt = Number(st.rmcExpense) || 0;
                  const rmcBearsOrg = st.rmcBearsOrg !== undefined ? Number(st.rmcBearsOrg) : ((st.rmcBears || 'Org') === 'Org' ? rmcAmt : 0);
                  const rmcBearsDriver = st.rmcBearsDriver !== undefined ? Number(st.rmcBearsDriver) : ((st.rmcBears || 'Org') === 'Driver' ? rmcAmt : 0);
                  const rmcPaid = !!st.rmcPaidByDriver;
                  if (rmcAmt > 0) {
                    if (rmcPaid && rmcBearsOrg > 0) {
                      computedTripDriverCredits.push({
                        id: `seg-rmc-${st.id}`,
                        date: segDate,
                        type: 'RMC Expense',
                        amount: rmcBearsOrg,
                        notes: `RMC expense paid by Driver (Org bears: ₹${rmcBearsOrg})`,
                        reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                        fromMode: 'Driver Advance Hand cash',
                        isDirect: false,
                        badgeStyle: 'bg-teal-50 text-teal-800 border-teal-200'
                      });
                    } else if (!rmcPaid && rmcBearsDriver > 0) {
                      recoveryItems.push({
                        id: `seg-rmc-recovery-${st.id}`,
                        date: segDate,
                        type: 'Driver Recovery (RMC)',
                        amount: rmcBearsDriver,
                        notes: `RMC deduction from rental (Driver bears: ₹${rmcBearsDriver})`,
                        reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                        fromMode: 'Driver Recovery Debit',
                        isDirect: false,
                        badgeStyle: 'bg-rose-50 text-rose-800 border-rose-200'
                      });
                    }
                  }
                }

                // 6. Driver Wages
                if (st.driverWages && st.driverWages > 0) {
                  computedTripDriverCredits.push({
                    id: `seg-wages-${st.id}`,
                    date: segDate,
                    type: 'Operator wages / Allowance',
                    amount: st.driverWages,
                    notes: `Wages/Allowance earned on cargo segment`,
                    reference: `Trip: ${t.tripNo} (${st.routeFrom} ➔ ${st.routeTo})`,
                    fromMode: 'Wages credit',
                    isDirect: false,
                    badgeStyle: 'bg-purple-50 text-purple-800 border-purple-200'
                  });
                }
              });
            }
          });

          // Sums
          const totalAdvAmount = drvAdvances.reduce((sum, v) => sum + v.amount, 0);
          const manualExpAmount = drvExpenses.reduce((sum, v) => sum + v.amount, 0);
          const computedCreditsAmount = computedTripDriverCredits.reduce((sum, v) => sum + v.amount, 0);
          const totalExpAmount = manualExpAmount + computedCreditsAmount;
          const totalDriverRecovery = recoveryItems.reduce((sum, v) => sum + v.amount, 0);
          
          // Net Ledger calculation (Requirement 3)
          // "Calculate all expense done buy driver and minus the advance should gave the amount payable/ receivable from driver."
          const netOutstanding = totalExpAmount - (totalAdvAmount + totalDriverRecovery);

          // Assemble unified timeline
          const advItems = drvAdvances.map(adv => ({
            id: adv.id,
            date: adv.date,
            type: 'Trip Advance',
            amount: adv.amount,
            notes: adv.notes || 'Trip Advance',
            reference: `Trip: ${adv.tripNo}`,
            fromMode: (props.accounts || []).find(a => a.id === adv.fromAccountId)?.accountName || adv.fromAccountId,
            isDirect: adv.receivedByDriverDirectly,
            badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }));

          const expItems = drvExpenses.map(exp => ({
            id: exp.id,
            date: exp.date,
            type: `Expense (${exp.expenseType})`,
            amount: exp.amount,
            notes: `${exp.shopName} - (${exp.status})`,
            reference: `Truck: ${exp.truckNo}`,
            fromMode: exp.paymentMode,
            isDirect: false,
            badgeStyle: 'bg-indigo-50 text-indigo-800 border-indigo-200'
          }));

          const timelineRecoveryItems = recoveryItems.map(item => ({
            ...item,
            isDirect: false
          }));

          const timeline = [...advItems, ...expItems, ...computedTripDriverCredits, ...timelineRecoveryItems].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

          return (
            <div class="space-y-6 animate-fade-in pt-2">
              {/* Three bento cards */}
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-3xs">
                  <div class="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg shrink-0">
                    <TrendingUp class="w-5 h-5" />
                  </div>
                  <div>
                    <span class="block text-[9px] text-slate-400 uppercase font-bold tracking-wider">Total Expenses Paid by Driver</span>
                    <strong class="text-sm text-slate-800 font-mono font-black">₹{totalExpAmount.toLocaleString()}</strong>
                    <span class="block text-[9px] text-slate-400">Total out of hand cash expenses</span>
                  </div>
                </div>

                <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-3xs">
                  <div class="p-2 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-lg shrink-0">
                    <Coins class="w-5 h-5" />
                  </div>
                  <div>
                    <span class="block text-[9px] text-slate-400 uppercase font-bold tracking-wider">Total Advances Received</span>
                    <strong class="text-sm text-slate-800 font-mono font-black">₹{totalAdvAmount.toLocaleString()}</strong>
                    <span class="block text-[9px] text-slate-400">Issued journey funds & party collections</span>
                  </div>
                </div>

                {/* Balance due card */}
                <div class={`border rounded-xl p-4 flex items-center gap-3 shadow-2xs shrink-0 ${
                  netOutstanding > 0 
                  ? 'bg-amber-50 border-amber-200 text-amber-900' 
                  : netOutstanding < 0 
                  ? 'bg-purple-50 border-purple-200 text-purple-900' 
                  : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <div class={`p-2 rounded-lg border shrink-0 ${
                    netOutstanding > 0 
                    ? 'bg-amber-100 border-amber-300 text-amber-700' 
                    : netOutstanding < 0 
                    ? 'bg-purple-100 border-purple-300 text-purple-700' 
                    : 'bg-slate-100 border-slate-350 text-slate-600'
                  }`}>
                    <Wallet class="w-5 h-5" />
                  </div>
                  <div>
                    <span class="block text-[9px] uppercase font-bold tracking-wider">Net Outstanding Settlement</span>
                    <strong class="text-sm font-mono block font-black">₹{Math.abs(netOutstanding).toLocaleString()}</strong>
                    <span class="block text-[10px] font-bold uppercase mt-0.5">
                      {netOutstanding > 0 ? (
                        <span class="text-amber-800 font-extrabold flex items-center gap-0.5">
                          <ArrowUpRight class="w-3.5 h-3.5 shrink-0" /> Payable to Driver (Owed)
                        </span>
                      ) : netOutstanding < 0 ? (
                        <span class="text-purple-800 font-extrabold flex items-center gap-0.5">
                          <ArrowDownLeft class="w-3.5 h-3.5 shrink-0" /> Receivable from Driver
                        </span>
                      ) : (
                        <span class="text-slate-500 font-bold">&mdash; Balanced (No Dues) &mdash;</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Transfer & Settle Trip Balance Panel */}
              {onSaveTrips && drvTrips.length > 0 && (
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-4.5 shadow-3xs font-sans text-xs space-y-4">
                  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-2.5 gap-2">
                    <div>
                      <h4 class="font-extrabold uppercase text-[10px] tracking-wider text-slate-700 flex items-center gap-1.5">
                        <ArrowRightLeft class="w-3.5 h-3.5 text-blue-650" />
                        Quick Balance Transfer & Settlement
                      </h4>
                      <p class="text-[10px] text-slate-400 mt-0.5">Quickly carry forward or settle outstanding balances for this driver's individual journeys.</p>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Source Trip Dropdown */}
                    <div class="flex flex-col gap-1">
                      <label class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">1. Select Source Trip</label>
                      <select
                        value={selectedFwdSourceTripId()}
                        onChange={(e) => {
                          setSelectedFwdSourceTripId(e.target.value);
                          setSelectedFwdTripId('');
                          setSelectedFwdAccountId('');
                        }}
                        class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-blue-500 font-sans font-medium cursor-pointer"
                      >
                        <option value="">-- Select Source Journey --</option>
                        {drvTrips.map(t => {
                          const m = getTripMetrics(t);
                          if (m.driverBalance === 0) return null;
                          const isDef = m.driverBalance < 0;
                          return (
                            <option  value={t.id}>
                              {t.tripNo} ({isDef ? 'Due from Drv' : 'Payable'}: ₹{Math.abs(m.driverBalance).toLocaleString('en-IN')})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {selectedFwdSourceTripId() && (() => {
                      const srcTrip = (props.trips || []).find(t => t.id === selectedFwdSourceTripId());
                      if (!srcTrip) return null;
                      const srcMetrics = getTripMetrics(srcTrip);
                      const isDef = srcMetrics.driverBalance < 0;
                      const balAmt = Math.abs(srcMetrics.driverBalance);

                      const eligibleFwdTrips = (props.trips || []).filter(
                        t => t.id !== srcTrip.id && t.status !== 'Settled'
                      ).sort((a, b) => {
                        const aSame = a.driverName?.toLowerCase().trim() === srcTrip.driverName?.toLowerCase().trim();
                        const bSame = b.driverName?.toLowerCase().trim() === srcTrip.driverName?.toLowerCase().trim();
                        if (aSame && !bSame) return -1;
                        if (!aSame && bSame) return 1;
                        return a.tripNo.localeCompare(b.tripNo);
                      });

                      const hasSameDriverActiveTrip = eligibleFwdTrips.some(
                        t => t.driverName?.toLowerCase().trim() === srcTrip.driverName?.toLowerCase().trim()
                      );

                      return (
                        <>
                          {/* Settle Action / Mode Tabs */}
                          <div class="flex flex-col gap-1 sm:col-span-1">
                            <label class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">2. Action Mode</label>
                            <div class="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedFwdMode('trip')}
                                class={`flex-1 py-1.5 font-bold rounded-lg transition-all text-center border cursor-pointer ${
                                  selectedFwdMode() === 'trip'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
                                }`}
                              >
                                Move to Trip
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedFwdMode('account')}
                                class={`flex-1 py-1.5 font-bold rounded-lg transition-all text-center border cursor-pointer ${
                                  selectedFwdMode() === 'account'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
                                }`}
                              >
                                Settle Account
                              </button>
                            </div>
                          </div>

                          {/* Tx Date */}
                          <div class="flex flex-col gap-1">
                            <label class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">3. Date & Details</label>
                            <input
                              type="date"
                              value={selectedFwdDate()}
                              onChange={(e) => setSelectedFwdDate(e.target.value)}
                              class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-blue-500 font-sans font-medium w-full"
                            />
                          </div>

                          {/* Target Selection & Action Button */}
                          <div class="flex flex-col gap-1 sm:col-span-2 md:col-span-4 border-t border-dashed border-slate-200 pt-3">
                            <div class="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 bg-amber-50/45 p-3 rounded-lg border border-amber-100">
                              {selectedFwdMode() === 'trip' ? (
                                <div class="flex-1 space-y-2">
                                  <div class="flex flex-col gap-0.5">
                                    <span class="font-bold text-slate-700">
                                      {isDef ? 'Carry Forward Deficit' : 'Carry Forward Surplus'}
                                    </span>
                                    <span class="text-[10px] text-slate-500">
                                      Transfer ₹{balAmt.toLocaleString('en-IN')} {isDef ? 'negative' : 'positive'} balance from <strong class="text-slate-700 font-mono">{srcTrip.tripNo}</strong> to another trip.
                                    </span>
                                  </div>

                                  {!hasSameDriverActiveTrip && (
                                    <div class="bg-amber-100/50 text-amber-900 px-2 py-1.5 rounded-md font-medium text-[10px] flex items-center gap-1.5">
                                      <AlertCircle class="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                      <span>No active trip under the same driver ({srcTrip.driverName}).</span>
                                    </div>
                                  )}

                                  <div class="max-w-md">
                                    <select
                                      value={selectedFwdTripId()}
                                      onChange={(e) => setSelectedFwdTripId(e.target.value)}
                                      class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-blue-500 font-sans font-medium w-full"
                                    >
                                      <option value="">-- Choose Target Journey --</option>
                                      {eligibleFwdTrips.map(t => {
                                        const isSameDrv = t.driverName?.toLowerCase().trim() === srcTrip.driverName?.toLowerCase().trim();
                                        return (
                                          <option  value={t.id}>
                                            {t.tripNo} - {t.driverName} ({t.truckNo}){isSameDrv ? ' (Same Driver)' : ''}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>
                                </div>
                              ) : (
                                <div class="flex-1 space-y-2">
                                  <div class="flex flex-col gap-0.5">
                                    <span class="font-bold text-slate-700">
                                      {isDef ? 'Settle Deficit with Account' : 'Pay Surplus from Account'}
                                    </span>
                                    <span class="text-[10px] text-slate-500">
                                      Record a settling advance of ₹{balAmt.toLocaleString('en-IN')} to balance <strong class="text-slate-700 font-mono">{srcTrip.tripNo}</strong>.
                                    </span>
                                  </div>

                                  <div class="max-w-md">
                                    <select
                                      value={selectedFwdAccountId()}
                                      onChange={(e) => setSelectedFwdAccountId(e.target.value)}
                                      class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-blue-500 font-sans font-medium w-full"
                                    >
                                      <option value="">-- Choose Company Account --</option>
                                      <option value="Cash">Cash</option>
                                      {(props.accounts || []).filter(a => a.status === 'Active').map(a => (
                                        <option  value={a.id}>
                                          {a.accountName} ({a.type})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedFwdMode() === 'trip') {
                                    if (!selectedFwdTripId()) {
                                      alert("Please select a target trip first.");
                                      return;
                                    }
                                    const destTrip = (props.trips || []).find(t => t.id === selectedFwdTripId());
                                    if (!destTrip) return;

                                    const confirmMsg = isDef
                                      ? `Are you sure you want to carry forward the driver deficit of ₹${balAmt.toLocaleString('en-IN')} from ${srcTrip.tripNo} to ${destTrip.tripNo}?`
                                      : `Are you sure you want to carry forward the driver surplus of ₹${balAmt.toLocaleString('en-IN')} from ${srcTrip.tripNo} to ${destTrip.tripNo}?`;

                                    const executeFwd = () => {
                                      const fwdAdvanceSource: TripAdvance = {
                                        id: 'fwd_out_' + Date.now(),
                                        amount: isDef ? -balAmt : balAmt,
                                        date: selectedFwdDate() || new Date().toISOString().substring(0, 10),
                                        fromAccountId: 'Direct Driver',
                                        notes: isDef
                                          ? `Negative balance carried forward to ${destTrip.tripNo}`
                                          : `Excess amount/surplus carried forward to ${destTrip.tripNo}`,
                                        receivedByDriverDirectly: true
                                      };

                                      const fwdAdvanceDest: TripAdvance = {
                                        id: 'fwd_in_' + Date.now(),
                                        amount: isDef ? balAmt : -balAmt,
                                        date: selectedFwdDate() || new Date().toISOString().substring(0, 10),
                                        fromAccountId: 'Direct Driver',
                                        notes: isDef
                                          ? `Negative balance carried forward from ${srcTrip.tripNo}`
                                          : `Excess amount/surplus carried forward from ${srcTrip.tripNo}`,
                                        receivedByDriverDirectly: true
                                      };

                                      const updatedSource = {
                                        ...srcTrip,
                                        advances: [...(srcTrip.advances || []), fwdAdvanceSource],
                                        syncState: 'pending' as const,
                                        updatedAt: new Date().toISOString()
                                      };

                                      const updatedDest = {
                                        ...destTrip,
                                        advances: [...(destTrip.advances || []), fwdAdvanceDest],
                                        syncState: 'pending' as const,
                                        updatedAt: new Date().toISOString()
                                      };

                                      const updatedTrips = (props.trips || []).map(t => {
                                        if (t.id === updatedSource.id) return updatedSource;
                                        if (t.id === updatedDest.id) return updatedDest;
                                        return t;
                                      });

                                      onSaveTrips(updatedTrips);
                                      setSelectedFwdSourceTripId('');
                                      alert(`Successfully moved ₹${balAmt.toLocaleString('en-IN')} to ${destTrip.tripNo}.`);
                                    };

                                    if (confirmAction) {
                                      confirmAction(confirmMsg, executeFwd, "Carry Forward Balance");
                                    } else if (confirm(confirmMsg)) {
                                      executeFwd();
                                    }

                                  } else {
                                    if (!selectedFwdAccountId()) {
                                      alert("Please select a target company account first.");
                                      return;
                                    }
                                    const targetAccount = (props.accounts || []).find(a => a.id === selectedFwdAccountId());
                                    const accountName = targetAccount ? targetAccount.accountName : selectedFwdAccountId();

                                    const confirmMsg = isDef
                                      ? `Are you sure you want to move the driver deficit of ₹${balAmt.toLocaleString('en-IN')} from ${srcTrip.tripNo} to company account "${accountName}"?`
                                      : `Are you sure you want to pay the driver surplus of ₹${balAmt.toLocaleString('en-IN')} from company account "${accountName}" for ${srcTrip.tripNo}?`;

                                    const executeSettle = () => {
                                      const settleAdvance: TripAdvance = {
                                        id: 'fwd_settle_' + Date.now(),
                                        amount: isDef ? -balAmt : balAmt,
                                        date: selectedFwdDate() || new Date().toISOString().substring(0, 10),
                                        fromAccountId: selectedFwdAccountId(),
                                        notes: isDef
                                          ? `Negative balance moved/returned to company account: ${accountName}`
                                          : `Positive balance paid to driver from company account: ${accountName}`,
                                        receivedByDriverDirectly: false
                                      };

                                      const updatedSource = {
                                        ...srcTrip,
                                        advances: [...(srcTrip.advances || []), settleAdvance]
                                      };

                                      const updatedTrips = (props.trips || []).map(t => {
                                        if (t.id === updatedSource.id) return updatedSource;
                                        return t;
                                      });

                                      onSaveTrips(updatedTrips);
                                      setSelectedFwdSourceTripId('');
                                      alert(`Successfully settled ₹${balAmt.toLocaleString('en-IN')} with account: ${accountName}.`);
                                    };

                                    if (confirmAction) {
                                      confirmAction(confirmMsg, executeSettle, isDef ? "Settle Deficit" : "Pay Driver");
                                    } else if (confirm(confirmMsg)) {
                                      executeSettle();
                                    }
                                  }
                                }}
                                class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg transition text-xs shrink-0 cursor-pointer text-center font-sans"
                              >
                                {selectedFwdMode() === 'trip' ? 'Confirm Transfer' : 'Confirm Settle'}
                              </button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Transactions list */}
              <div class="space-y-2">
                <span class="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block font-sans">
                  Statement Ledger Transactions History ({timeline.length} listings)
                </span>

                {timeline.length > 0 ? (
                  <div class="overflow-x-auto border border-slate-200/60 rounded-xl max-h-[280px] overflow-y-auto bg-white shadow-3xs">
                    <table class="w-full text-left text-[11px] font-sans">
                      <thead class="bg-slate-50 text-[9px] text-slate-500 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                        <tr>
                          <th class="p-2.5 pl-4">Date</th>
                          <th class="p-2.5">Transaction Type</th>
                          <th class="p-2.5">Reference Location</th>
                          <th class="p-2.5">Cash/Fund Source</th>
                          <th class="p-2.5">Purpose Info Memo</th>
                          <th class="p-2.5 text-right pr-4">Amount</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 font-medium">
                        {timeline.map((item, idx) => (
                          <tr  class="hover:bg-slate-50/50 text-slate-700">
                            <td class="p-2.5 pl-4 font-mono font-bold text-slate-500">{item.date}</td>
                            <td class="p-2.5">
                              <span class={`inline-flex items-center text-[9px] font-black px-2 py-0.5 border rounded-full uppercase tracking-wider ${item.badgeStyle}`}>
                                {item.type}
                              </span>
                            </td>
                            <td class="p-2.5 text-slate-800 font-bold">{item.reference}</td>
                            <td class="p-2.5 font-mono text-[10px]">
                              {item.isDirect ? (
                                <span class="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 whitespace-nowrap">
                                  Direct Party Payment
                                </span>
                              ) : (
                                <span class="text-indigo-700 font-semibold bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-200 whitespace-nowrap">{item.fromMode}</span>
                              )}
                            </td>
                            <td class="p-2.5 text-slate-400 font-semibold max-w-xs truncate" title={item.notes}>
                              {item.notes}
                            </td>
                            <td class={`p-2.5 text-right font-mono font-extrabold pr-4 text-xs ${
                              item.type.startsWith('Trip Advance') 
                                ? 'text-emerald-600' 
                                : item.type.startsWith('Driver Recovery') 
                                  ? 'text-rose-600' 
                                  : 'text-slate-800'
                            }`}>
                              {item.type.startsWith('Trip Advance') || item.type.startsWith('Driver Recovery') ? '(-)' : '(+)'} ₹{item.amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p class="p-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No matching advances or general driver expenses found for this operator.
                  </p>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
