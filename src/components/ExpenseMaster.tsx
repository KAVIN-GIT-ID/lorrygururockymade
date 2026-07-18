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

import { ExpenseEntry, Truck, Account, Driver, OrganizationProfile } from '../types';
import { Plus, Edit2, Trash2, Landmark, DollarSign, Calendar, ShoppingBag, Truck as TruckIcon, ShieldCheck, HelpCircle, FileSpreadsheet, User, X, Settings } from 'lucide-solid';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import SearchableSelect from './SearchableSelect';

interface ExpenseMasterProps {
  expenses: ExpenseEntry[];
  trucks: Truck[];
  accounts: Account[];
  drivers: Driver[];
  onAddExpense: (expense: Omit<ExpenseEntry, 'id'>) => void;
  onUpdateExpense: (expense: ExpenseEntry) => void;
  onDeleteExpense: (id: string) => void;
  canViewExpenses?: boolean;
  canEditExpenses?: boolean;
  canDeleteExpenses?: boolean;
  organizationId?: string;
  autoOpenAdd?: boolean;
  onAutoOpenCleared?: () => void;
  orgProfile?: OrganizationProfile;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
}

export default function ExpenseMaster(rawProps: ExpenseMasterProps) {
  const expenseCtx = useExpensesContext();
  const trucksCtx = useTrucksContext();
  const driversCtx = useDriversContext();
  const permissionCtx = usePermissions();

  const props = mergeProps(rawProps, {
    get expenses() { return expenseCtx.orgExpenses(); },
    get trucks() { return trucksCtx.orgTrucks(); },
    get drivers() { return driversCtx.orgDrivers(); },
    onAddExpense: expenseCtx.addExpense,
    onUpdateExpense: expenseCtx.updateExpense,
    onDeleteExpense: expenseCtx.deleteExpense,
    confirmAction: rawProps.confirmAction,
    get accounts() { return rawProps.accounts || []; },
    autoOpenAdd: rawProps.autoOpenAdd,
    onAutoOpenCleared: rawProps.onAutoOpenCleared,
    orgProfile: rawProps.orgProfile,
    
    get canViewExpenses() { return permissionCtx.currentUserRights().canViewExpenses; },
    get canEditExpenses() { return permissionCtx.currentUserRights().canEditExpenses; },
    get canDeleteExpenses() { return permissionCtx.currentUserRights().canDeleteExpenses; },
    get organizationId() { return permissionCtx.currentUserOrgId(); }
  });
  const {
    expenses,
    trucks,
    drivers,
    onAddExpense,
    onUpdateExpense,
    onDeleteExpense,
    confirmAction,
    canViewExpenses,
    canEditExpenses,
    canDeleteExpenses,
    organizationId,
    autoOpenAdd,
    onAutoOpenCleared,
    orgProfile,
    accounts
  } = props;


  const [isEditing, setIsEditing] = createSignal<string | null>(null);
  const [showForm, setShowForm] = createSignal(false);
  const [activeSpeedDialId, setActiveSpeedDialId] = createSignal<string | null>(null);

  createEffect(() => {
    if (autoOpenAdd) {
      resetForm();
      setShowForm(true);
      if (onAutoOpenCleared) {
        onAutoOpenCleared();
      }
    }
  });

  // Form states
  const [truckNo, setTruckNo] = createSignal('');
  const [expenseType, setExpenseType] = createSignal('Temporary');
  const [shopName, setShopName] = createSignal('');
  const [amount, setAmount] = createSignal('');
  const [paymentMode, setPaymentMode] = createSignal('');
  const [date, setDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = createSignal<ExpenseEntry['status']>('Settled');
  const [accountType, setAccountType] = createSignal<'Account' | 'Driver'>('Account');
  const [selectedDriverName, setSelectedDriverName] = createSignal('');

  const standardTypes = [
    'Temporary',
    'Scheduled',
    'Maintenance',
    'Breakdown',
    'Spare Parts',
    'Workshop Service',
    'Driver Advance',
    'Tolls & Mamuls',
    'Lubricants & Oils'
  ];

  const allExpenseTypes = Array.from(new Set([
    ...standardTypes,
    ...(orgProfile?.customExpenseTypes || [])
  ]));

  const existingShops = Array.from(new Set(expenses.map(e => e.shopName).filter(Boolean)));
  const allShops = Array.from(new Set([
    ...(orgProfile?.shopNames || []),
    ...existingShops
  ]));

  const truckOptions = trucks.map(tk => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const isExpired = tk.registrationExpiryDate ? tk.registrationExpiryDate < todayStr : false;
    const isAdminDisabled = tk.status === 'Admin Disabled';
    const isNotApproved = tk.isApproved === false || tk.requestStatus === 'Rejected';
    const isBlocked = isExpired || isAdminDisabled || isNotApproved;
    const isSelected = isEditing() && (() => {
      const orig = expenses.find(e => e.id === isEditing());
      return orig && orig.truckNo === tk.truckNo;
    })();

    let labelSuffix = '';
    if (isAdminDisabled) labelSuffix = ' (Admin Disabled)';
    else if (isNotApproved) labelSuffix = ' (Not Approved)';
    else if (isExpired) labelSuffix = ' (Expired)';

    return {
      value: tk.truckNo,
      label: `${tk.truckNo}${tk.make || tk.model ? ` [${[tk.make, tk.model].filter(Boolean).join(' / ')}]` : ''}${labelSuffix}`,
      disabled: isBlocked && !isSelected
    };
  });

  const expenseTypeOptions = allExpenseTypes.map(t => ({
    value: t,
    label: t
  }));

  const shopOptions = allShops.map(s => ({
    value: s,
    label: s
  }));

  // Filter/Search states
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedTruckFilter, setSelectedTruckFilter] = createSignal('');
  const [selectedTypeFilter, setSelectedTypeFilter] = createSignal('');

  const resetForm = () => {
    setTruckNo('');
    setExpenseType('Temporary');
    setShopName('');
    setAmount('');
    setPaymentMode('');
    setDate(new Date().toISOString().split('T')[0]);
    setStatus('Settled');
    setAccountType('Account');
    setSelectedDriverName('');
    setIsEditing(null);
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!truckNo().trim() || !amount().trim() || isNaN(Number(amount()))) {
      return;
    }

    const todayStr = new Date().toISOString().substring(0, 10);
    const selectedTruck = trucks.find(t => t.truckNo === truckNo());
    const isUnchangedEdit = isEditing() && (() => {
      const orig = expenses.find(e => e.id === isEditing());
      return orig && orig.truckNo === truckNo();
    })();
    if (selectedTruck && !isUnchangedEdit) {
      const isExpired = selectedTruck.registrationExpiryDate ? selectedTruck.registrationExpiryDate < todayStr : false;
      const isAdminDisabled = selectedTruck.status === 'Admin Disabled';
      const isNotApproved = selectedTruck.isApproved === false || selectedTruck.requestStatus === 'Rejected';
      if (isExpired || isAdminDisabled || isNotApproved) {
        let reason = "expired";
        if (isAdminDisabled) reason = "admin disabled";
        else if (isNotApproved) reason = "not approved";
        alert(`Cannot create/update expense: Selected truck ${truckNo()} is ${reason}.`);
        return;
      }
    }

    const payload = {
      truckNo: truckNo(),
      expenseType: expenseType(),
      shopName: shopName().trim() || 'General',
      amount: parseFloat(amount()),
      paymentMode: accountType() === 'Driver' ? selectedDriverName() : (paymentMode() || 'Cash/General'),
      date: date(),
      status: status() || 'Pending',
      accountType: accountType(),
      driverName: accountType() === 'Driver' ? selectedDriverName() : undefined
    };

    if (isEditing()) {
      onUpdateExpense({
        id: isEditing(),
        ...payload
      });
    } else {
      onAddExpense(payload);
    }

    resetForm();
    setShowForm(false);
  };

  const startEdit = (exp: ExpenseEntry) => {
    setIsEditing(exp.id);
    setTruckNo(exp.truckNo);
    setExpenseType(exp.expenseType);
    setShopName(exp.shopName);
    setAmount(exp.amount.toString());
    setPaymentMode(exp.paymentMode);
    setDate(exp.date);
    setStatus(exp.status || 'Pending');
    setAccountType(exp.accountType || 'Account');
    setSelectedDriverName(exp.driverName || '');
    setShowForm(true);
  };

  // Date range filters
  const [startDateFilter, setStartDateFilter] = createSignal('');
  const [endDateFilter, setEndDateFilter] = createSignal('');

  // Pagination states
  const [currentPage, setCurrentPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(10);
  const [displayedExpenses, setDisplayedExpenses] = createSignal<ExpenseEntry[]>([]);
  const [totalCount, setTotalCount] = createSignal(0);
  const [loading, setLoading] = createSignal(false);

  const online = isAppwriteConfigured();

  // Reset page to 1 when filters change
  createEffect(() => {
    setCurrentPage(1);
  });

  // Offline / local logic
  createEffect(() => {
    if (!online) {
      const filtered = expenses.filter(exp => {
        const matchesSearch = exp.shopName.toLowerCase().includes(searchQuery().toLowerCase()) || 
                              exp.expenseType.toLowerCase().includes(searchQuery().toLowerCase());
        const matchesTruck = selectedTruckFilter() ? exp.truckNo === selectedTruckFilter() : true;
        const matchesType = selectedTypeFilter() ? exp.expenseType === selectedTypeFilter() : true;
        const matchesStartDate = startDateFilter() ? exp.date >= startDateFilter() : true;
        const matchesEndDate = endDateFilter() ? exp.date <= endDateFilter() : true;
        return matchesSearch && matchesTruck && matchesType && matchesStartDate && matchesEndDate;
      });

      setTotalCount(filtered.length);
      const startIdx = (currentPage() - 1) * pageSize();
      setDisplayedExpenses(filtered.slice(startIdx, startIdx + pageSize()));
    }
  });

  // Online Appwrite logic
  createEffect(() => {
    if (online) {
      const fetchServerExpenses = async () => {
        setLoading(true);
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const orgId = organizationId || localStorage.getItem('ttt_organization_id') || 'org_default';

          const res = await appwrite.queryExpenses(
            databaseId,
            orgId,
            {
              search: searchQuery() || undefined,
              truckNo: selectedTruckFilter() || undefined,
              expenseType: selectedTypeFilter() || undefined,
              startDate: startDateFilter() || undefined,
              endDate: endDateFilter() || undefined
            },
            currentPage(),
            pageSize()
          );

          const mapped = (res.documents || []).map(doc => {
            const record = appwrite.reconstructRecord(doc);
            if (record) {
              record.amount = Number(record.amount) || Number(doc.amount) || 0;
            }
            return record;
          }).filter(Boolean);
          setDisplayedExpenses(mapped);
          setTotalCount(res.total || 0);
        } catch (err) {
          console.error("Failed to query expenses from Appwrite:", err);
        } finally {
          setLoading(false);
        }
      };

      const delayDebounce = setTimeout(() => {
        fetchServerExpenses();
      }, 300);

      return () => clearTimeout(delayDebounce);
    }
  });

  const totalExpenseSum = (online ? displayedExpenses() : expenses.filter(exp => {
    const matchesSearch = exp.shopName.toLowerCase().includes(searchQuery().toLowerCase()) || 
                          exp.expenseType.toLowerCase().includes(searchQuery().toLowerCase());
    const matchesTruck = selectedTruckFilter() ? exp.truckNo === selectedTruckFilter() : true;
    const matchesType = selectedTypeFilter() ? exp.expenseType === selectedTypeFilter() : true;
    const matchesStartDate = startDateFilter() ? exp.date >= startDateFilter() : true;
    const matchesEndDate = endDateFilter() ? exp.date <= endDateFilter() : true;
    return matchesSearch && matchesTruck && matchesType && matchesStartDate && matchesEndDate;
  })).reduce((sum, item) => sum + item.amount, 0);

  const pendingExpenseSum = (online ? displayedExpenses() : expenses.filter(exp => {
    const matchesSearch = exp.shopName.toLowerCase().includes(searchQuery().toLowerCase()) || 
                          exp.expenseType.toLowerCase().includes(searchQuery().toLowerCase());
    const matchesTruck = selectedTruckFilter() ? exp.truckNo === selectedTruckFilter() : true;
    const matchesType = selectedTypeFilter() ? exp.expenseType === selectedTypeFilter() : true;
    const matchesStartDate = startDateFilter() ? exp.date >= startDateFilter() : true;
    const matchesEndDate = endDateFilter() ? exp.date <= endDateFilter() : true;
    return matchesSearch && matchesTruck && matchesType && matchesStartDate && matchesEndDate;
  })).filter(e => e.status === 'Pending').reduce((sum, item) => sum + item.amount, 0);

  const paidExpenseSum = (online ? displayedExpenses() : expenses.filter(exp => {
    const matchesSearch = exp.shopName.toLowerCase().includes(searchQuery().toLowerCase()) || 
                          exp.expenseType.toLowerCase().includes(searchQuery().toLowerCase());
    const matchesTruck = selectedTruckFilter() ? exp.truckNo === selectedTruckFilter() : true;
    const matchesType = selectedTypeFilter() ? exp.expenseType === selectedTypeFilter() : true;
    const matchesStartDate = startDateFilter() ? exp.date >= startDateFilter() : true;
    const matchesEndDate = endDateFilter() ? exp.date <= endDateFilter() : true;
    return matchesSearch && matchesTruck && matchesType && matchesStartDate && matchesEndDate;
  })).filter(e => e.status === 'Paid' || e.status === 'Settled').reduce((sum, item) => sum + item.amount, 0);

  const uniqueExpenseTypes = Array.from(new Set(expenses.map(e => e.expenseType).filter(Boolean)));

  return (
    <div id="expense-master-panel" class="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs animate-fade-in font-sans">
      
      {/* HEADER SECTION */}
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 class="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <FileSpreadsheet class="w-5 h-5 text-indigo-600" />
            <span>Voucher & Expenses Ledger</span>
            {loading() && <span class="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>}
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">Register, manage, and monitor general shop and temporary truck maintenance expenses.</p>
        </div>
        
        {canEditExpenses && (
          <button
            id="btn-toggle-expense-form"
            onClick={() => {
              if (showForm()) resetForm();
              setShowForm(!showForm());
            }}
            class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg transition duration-150 shadow-sm text-xs cursor-pointer active:scale-95"
          >
            {showForm() ? 'Cancel & Close' : (
              <>
                <Plus class="w-3.5 h-3.5" /> Register New Expense
              </>
            )}
          </button>
        )}
      </div>

      {/* METRIC BADGES CARD BLOCK */}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div class="bg-slate-50 border border-slate-250/70 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span class="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Total Filtered Cost</span>
            <span class="text-lg font-extrabold text-slate-800 font-mono">₹{totalExpenseSum.toLocaleString('en-IN')}</span>
          </div>
          <div class="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg">
            <DollarSign class="w-4 h-4" />
          </div>
        </div>
        
        <div class="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span class="text-[10px] text-emerald-600 block font-bold uppercase tracking-wider">Paid Settlements</span>
            <span class="text-lg font-extrabold text-emerald-800 font-mono">₹{paidExpenseSum.toLocaleString('en-IN')}</span>
          </div>
          <div class="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
            <ShieldCheck class="w-4 h-4" />
          </div>
        </div>

        <div class="bg-amber-50/50 border border-amber-100 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span class="text-[10px] text-amber-700 block font-bold uppercase tracking-wider">Pending/On-Credit</span>
            <span class="text-lg font-extrabold text-amber-900 font-mono">₹{pendingExpenseSum.toLocaleString('en-IN')}</span>
          </div>
          <div class="p-2.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-150">
            <HelpCircle class="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* EXPENSE REGISTRATION FORM */}
      {showForm() && (
        <div class="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 backdrop-blur-xs p-4 overflow-y-auto py-8 animate-fade-in" id="expense-form-backdrop">
          <form id="expense-registration-form" onSubmit={handleSubmit} class="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto md:overflow-visible text-left my-auto">
            <div class="flex justify-between items-center border-b border-slate-200 dark:border-slate-850 pb-3">
              <div class="flex items-center gap-2">
                <FileSpreadsheet class="w-5 h-5 text-indigo-600 dark:text-indigo-450" />
                <h3 class="text-sm font-bold text-slate-805 dark:text-white tracking-wide">
                  {isEditing() ? 'Modify Registered Expense' : 'Register New Expense Voucher'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                class="p-1.5 hover:bg-slate-105 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 rounded-xl transition cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              
              {/* Truck No */}
              <div>
                <label for="expense-input-truck" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Truck ID No <span class="text-rose-500">*</span></label>
                <SearchableSelect
                  id="expense-input-truck"
                  value={truckNo()}
                  onChange={(val) => setTruckNo(val)}
                  options={truckOptions}
                  placeholder="Search / choose Truck..."
                  required
                />
              </div>

              {/* Expense Type */}
              <div>
                <label for="expense-input-type" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Expense Type <span class="text-rose-500">*</span></label>
                <SearchableSelect
                  id="expense-input-type"
                  value={expenseType()}
                  onChange={(val) => setExpenseType(val)}
                  options={expenseTypeOptions}
                  placeholder="Search / choose Expense Type..."
                  required
                  allowCustomVal
                />
              </div>

              {/* Shop / Supplier Name */}
              <div>
                <label for="expense-input-shop" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Shop / Supplier Name <span class="text-rose-500">*</span></label>
                <SearchableSelect
                  id="expense-input-shop"
                  value={shopName()}
                  onChange={(val) => setShopName(val)}
                  options={shopOptions}
                  placeholder="Search / enter Shop..."
                  required
                  allowCustomVal
                />
              </div>

              {/* Expense Amount */}
              <div>
                <label for="expense-input-amount()" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Expense Amount (₹) <span class="text-rose-500">*</span></label>
                <input
                  id="expense-input-amount()"
                  type="number"
                  min="0.01"
                  step="any"
                  placeholder="0.00"
                  value={amount()}
                  required
                  onChange={(e) => setAmount(e.target.value)}
                  class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-white font-bold rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 font-mono outline-none text-right"
                />
              </div>

              {/* Account Type Selector */}
              <div>
                <label for="expense-input-account-type" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Account Type <span class="text-rose-500">*</span></label>
                <select
                  id="expense-input-account-type"
                  value={accountType()}
                  onChange={(e) => {
                    const val = e.target.value as 'Account' | 'Driver';
                    setAccountType(val);
                    if (val === 'Driver') {
                      setPaymentMode('');
                      setSelectedDriverName(drivers[0]?.driverName || '');
                    } else {
                      setSelectedDriverName('');
                      setPaymentMode('Cash/General');
                    }
                  }}
                  class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  <option value="Account">Office Account</option>
                  <option value="Driver">Driver Operator Ledger</option>
                </select>
              </div>

              {/* Account / Driver Selector depending on Account Type */}
              {accountType() === 'Account' ? (
                <div>
                  <label for="expense-input-payment-mode" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Ledger Account / Mode</label>
                  <select
                    id="expense-input-payment-mode"
                    value={paymentMode()}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
                  >
                    <option value="Cash/General">Cash/General State</option>
                    <option value="Axis">Axis Office</option>
                    <option value="HDFC">HDFC General</option>
                    {accounts.map(acct => (
                      <option  value={acct.accountName}>{acct.accountName} Ledger</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label for="expense-input-driver-name" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Select Driver <span class="text-rose-500">*</span></label>
                  <select
                    id="expense-input-driver-name"
                    value={selectedDriverName()}
                    onChange={(e) => setSelectedDriverName(e.target.value)}
                    required
                    class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
                  >
                    <option value="">-- Select Driver --</option>
                    {drivers.map(drv => (
                      <option  value={drv.driverName}>{drv.driverName}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date */}
              <div>
                <label for="expense-input-date()" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Expense Date</label>
                <input
                  id="expense-input-date()"
                  type="date"
                  value={date()}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
                />
              </div>

              {/* Ledger Status */}
              <div>
                <label for="expense-input-status()" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Clearance Status</label>
                <select
                  id="expense-input-status()"
                  value={status()}
                  onChange={(e) => setStatus(e.target.value as ExpenseEntry['status'])}
                  class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-bold"
                >
                  <option value="Settled">Settled</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Declined">Declined</option>
                </select>
              </div>

              {/* Submit Actions */}
              <div class="flex items-end justify-end space-x-2 pt-1 lg:pt-0 col-span-full border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  class="px-3 py-1.5 border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50/50 rounded-lg text-xs font-semibold cursor-pointer active:scale-95 transition-all"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  {isEditing() ? 'Save Changes' : 'Save Ledger Entry'}
                </button>
              </div>

            </div>
          </form>
        </div>
      )}
      <div class="bg-slate-50 border border-slate-200 p-3.5 mb-5 rounded-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-center">
        
        <div>
          <input
            type="text"
            placeholder="Search shop name or expense type..."
            value={searchQuery()}
            onChange={(e) => setSearchQuery(e.target.value)}
            class="w-full bg-white border border-slate-205 text-slate-850 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-semibold"
          />
        </div>

        <div>
          <select
            value={selectedTruckFilter()}
            onChange={(e) => setSelectedTruckFilter(e.target.value)}
            class="w-full bg-white border border-slate-205 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
          >
            <option value="">By Truck Filter (All)</option>
            {trucks.map(tk => (
              <option  value={tk.truckNo}>{tk.truckNo}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedTypeFilter()}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            class="w-full bg-white border border-slate-205 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
          >
            <option value="">By Expense Type (All)</option>
            {Array.from(new Set([
              ...allExpenseTypes,
              ...uniqueExpenseTypes
            ])).map(t => (
              <option  value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Date inputs */}
        <div class="flex gap-2">
          <input
            type="date"
            title="Start Date"
            value={startDateFilter()}
            onChange={(e) => setStartDateFilter(e.target.value)}
            class="w-full bg-white border border-slate-205 text-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
          />
          <input
            type="date"
            title="End Date"
            value={endDateFilter()}
            onChange={(e) => setEndDateFilter(e.target.value)}
            class="w-full bg-white border border-slate-205 text-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
          />
        </div>

        {/* Refresh / Clear Button */}
        <div class="flex gap-1 justify-end">
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedTruckFilter('');
              setSelectedTypeFilter('');
              setStartDateFilter('');
              setEndDateFilter('');
            }}
            class="bg-white border border-slate-250/70 hover:bg-slate-100 text-slate-605 text-slate-600 font-bold px-3 py-1.5 rounded-lg transition duration-150 text-xs cursor-pointer active:scale-95 w-full text-center"
          >
            Reset Filters
          </button>
        </div>

      </div>

      {/* EXPENSE LEDGER DATAGRID */}
      <div class="overflow-x-auto border border-slate-200.5/90 rounded-xl bg-white shadow-2xs hidden md:block">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 text-[10px] font-extrabold text-slate-550 border-b border-slate-200 uppercase tracking-wider">
            <tr>
              <th class="p-3 pl-4">Date</th>
              <th class="p-3">Truck No</th>
              <th class="p-3">Expense Type</th>
              <th class="p-3">Shop Name / Supplier</th>
              <th class="p-3">Payment Account Mode</th>
              <th class="p-3 text-right">Expense Amount</th>
              <th class="p-3 text-center">Status</th>
              <th class="p-3 text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-semibold text-slate-700">
            {displayedExpenses().length === 0 ? (
              <tr>
                <td colSpan={8} class="p-12 text-center text-slate-400 font-sans italic font-normal">
                  No expense records match the selected registers.
                </td>
              </tr>
            ) : (
              displayedExpenses().map((exp) => (
                <tr  class="hover:bg-slate-50/70 transition duration-150">
                  <td class="p-3 pl-4 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                    <span class="flex items-center gap-1">
                      <Calendar class="w-3 h-3 text-slate-400" />
                      {exp.date}
                    </span>
                  </td>
                  <td class="p-3 whitespace-nowrap">
                    <span class="flex items-center gap-1 uppercase font-mono font-bold text-slate-900 tracking-wide text-[11px]">
                      <TruckIcon class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {exp.truckNo}
                    </span>
                  </td>
                  <td class="p-3">
                    <span class="inline-flex items-center gap-1 text-[10px] bg-blue-50 border border-blue-100 text-blue-800 font-extrabold rounded px-2 py-0.5">
                      {exp.expenseType}
                    </span>
                  </td>
                  <td class="p-3">
                    <div class="font-semibold text-slate-800 truncate max-w-[150px]" title={exp.shopName || '—'}>
                      {exp.shopName || '—'}
                    </div>
                  </td>
                  <td class="p-3 font-semibold text-xs text-indigo-700 whitespace-nowrap">
                    {exp.accountType === 'Driver' ? (
                      <span class="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 font-sans font-bold">
                        <User class="w-3 h-3 text-emerald-600 shrink-0" />
                        Driver: {exp.driverName}
                      </span>
                    ) : (
                      <span class="flex items-center gap-1 font-mono">
                        <Landmark class="w-3 h-3 text-indigo-550 shrink-0" />
                        {exp.paymentMode}
                      </span>
                    )}
                  </td>
                  <td class="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                    ₹{Number(exp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td class="p-3 text-center whitespace-nowrap">
                    <span class={`text-[10px] px-2.5 py-0.5 rounded-full font-black border uppercase tracking-wider ${
                      (exp.status === 'Paid' || exp.status === 'Settled') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                      exp.status === 'Approved' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                      exp.status === 'Declined' ? 'border-rose-200 bg-rose-50 text-rose-700' :
                      'border-amber-200 bg-amber-50 text-amber-700'
                    }`}>
                      {exp.status}
                    </span>
                  </td>
                  <td class="p-3 text-right pr-4 whitespace-nowrap">
                    <div class="flex justify-end gap-1.5">
                      <button
                         title="Edit Expense"
                         disabled={!canEditExpenses}
                         onClick={() => startEdit(exp)}
                         class="p-1 px-2 border border-slate-200 rounded text-slate-600 hover:text-indigo-600 hover:border-indigo-300 bg-white shadow-3xs cursor-pointer active:scale-95 duration-100 flex items-center gap-1 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Edit2 class="w-2.5 h-2.5" /> Edit
                      </button>
                      <button
                        title="Delete Expense"
                        disabled={!canDeleteExpenses}
                        onClick={() => onDeleteExpense(exp.id)}
                        class="p-1 px-2 border border-rose-100 hover:bg-rose-50 text-rose-600 rounded hover:text-rose-800 bg-white shadow-3xs cursor-pointer active:scale-95 duration-100 flex items-center gap-1 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 class="w-2.5 h-2.5" /> Delete
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
        {displayedExpenses().length === 0 ? (
          <div class="bg-white border border-slate-200 rounded-xl p-8 py-12 text-center text-slate-400 italic">
            No expense records match the selected registers.
          </div>
        ) : (
          displayedExpenses().map((exp) => (
            <div 
              
              class="bg-white border border-slate-200 rounded-xl p-4.5 shadow-3xs flex flex-col justify-between hover:border-blue-300 transition relative"
            >
              <div>
                {/* Top Row: Date & Status */}
                <div class="flex justify-between items-center gap-2 mb-3 pr-8">
                  <span class="font-mono text-[10px] text-slate-500 flex items-center gap-1">
                    <Calendar class="w-3.5 h-3.5 text-slate-400" />
                    {exp.date}
                  </span>
                  <span class={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    (exp.status === 'Paid' || exp.status === 'Settled') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    'bg-amber-50 text-amber-705 border border-amber-100'
                  }`}>
                    {exp.status}
                  </span>
                </div>

                {/* Truck & Expense Type */}
                <div class="flex items-center gap-2.5 text-xs mb-3 text-slate-800">
                  <span class="flex items-center gap-1 uppercase font-mono font-bold text-slate-900 tracking-wider">
                    <TruckIcon class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {exp.truckNo}
                  </span>
                  <span class="w-px h-3 bg-slate-200" />
                  <span class="inline-flex items-center gap-1 text-[10px] bg-blue-50 border border-blue-100 text-blue-800 font-extrabold rounded px-2 py-0.2 uppercase tracking-wider">
                    {exp.expenseType}
                  </span>
                </div>

                {/* Details Section */}
                <div class="bg-slate-50 border border-slate-200/60 rounded-lg p-2.5 space-y-1.5 text-xs text-slate-655 mb-3">
                  <div class="flex justify-between">
                    <span class="text-slate-400 font-bold uppercase text-[9px]">Supplier / Shop</span>
                    <span class="font-semibold text-slate-800 truncate max-w-[180px]">{exp.shopName || '—'}</span>
                  </div>
                  
                  <div class="flex justify-between">
                    <span class="text-slate-400 font-bold uppercase text-[9px]">Payment Mode</span>
                    <span class="text-slate-700">{exp.accountType === 'Driver' ? `Driver: ${exp.driverName}` : exp.paymentMode}</span>
                  </div>
                </div>

                {/* Amount Row */}
                <div class="flex justify-between items-center text-xs mb-4">
                  <span class="text-slate-500 font-semibold">Expense Amount:</span>
                  <span class="font-mono font-black text-rose-650 text-[14px]">
                    ₹{Number(exp.amount || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Micro-FAB Speed Dial */}
                <div class="absolute top-3 right-3 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <div class={`flex items-center gap-1.5 bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-full p-1 pl-2.5 pr-1.5 shadow-md transition-all duration-300 ease-out origin-right transform whitespace-nowrap ${
                    activeSpeedDialId() === exp.id 
                      ? 'opacity-100 scale-100 translate-x-0 pointer-events-auto' 
                      : 'opacity-0 scale-90 translate-x-2 pointer-events-none'
                  }`}>
                    <button
                      type="button"
                      disabled={!canEditExpenses}
                      onClick={() => {
                        startEdit(exp);
                        setActiveSpeedDialId(null);
                      }}
                      class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer disabled:opacity-45"
                      title="Modify Expense"
                    >
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canDeleteExpenses}
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete this expense record of ₹${exp.amount}?`)) {
                          onDeleteExpense(exp.id);
                        }
                        setActiveSpeedDialId(null);
                      }}
                      class="w-7 h-7 rounded-full bg-rose-55 dark:bg-rose-955/20 border border-rose-150 dark:border-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-455 hover:bg-rose-100/30 transition cursor-pointer disabled:opacity-45"
                      title="Delete Expense"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSpeedDialId(activeSpeedDialId() === exp.id ? null : exp.id)}
                    class="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95 cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-200"
                  >
                    {activeSpeedDialId() === exp.id ? (
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

      {/* PAGINATION FOOTER */}
      <div class="bg-white border border-slate-200 rounded-xl p-4 mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs no-print">
        <div class="text-slate-500 font-medium">
          Showing <strong class="text-slate-800">{totalCount() > 0 ? (currentPage() - 1) * pageSize() + 1 : 0}</strong> to{" "}
          <strong class="text-slate-800">{Math.min(currentPage() * pageSize(), totalCount())}</strong> of{" "}
          <strong class="text-slate-800">{totalCount()}</strong> entries
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500">Page size:</span>
            <select
              value={pageSize()}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              class="bg-slate-50 border border-slate-200 rounded p-1 text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              {[10, 25, 50, 100].map(size => (
                <option  value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div class="flex gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage() === 1 || loading()}
              class="p-1 px-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold rounded border border-slate-200 disabled:cursor-not-allowed select-none cursor-pointer transition"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount() / pageSize()), prev + 1))}
              disabled={currentPage() >= Math.ceil(totalCount() / pageSize()) || loading()}
              class="p-1 px-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold rounded border border-slate-200 disabled:cursor-not-allowed select-none cursor-pointer transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
