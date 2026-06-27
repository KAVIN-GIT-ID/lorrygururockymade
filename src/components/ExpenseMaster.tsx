import React, { useState, useEffect } from 'react';
import { ExpenseEntry, Truck, Account, Driver, OrganizationProfile } from '../types';
import { Plus, Edit2, Trash2, Landmark, DollarSign, Calendar, ShoppingBag, Truck as TruckIcon, ShieldCheck, HelpCircle, FileSpreadsheet, User, X, Settings } from 'lucide-react';
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
}

export default function ExpenseMaster({
  expenses = [],
  trucks = [],
  accounts = [],
  drivers = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  canViewExpenses = true,
  canEditExpenses = true,
  canDeleteExpenses = true,
  organizationId,
  autoOpenAdd,
  onAutoOpenCleared,
  orgProfile,
}: ExpenseMasterProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeSpeedDialId, setActiveSpeedDialId] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpenAdd) {
      resetForm();
      setShowForm(true);
      if (onAutoOpenCleared) {
        onAutoOpenCleared();
      }
    }
  }, [autoOpenAdd]);

  // Form states
  const [truckNo, setTruckNo] = useState('');
  const [expenseType, setExpenseType] = useState('Temporary');
  const [shopName, setShopName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<ExpenseEntry['status']>('Settled');
  const [accountType, setAccountType] = useState<'Account' | 'Driver'>('Account');
  const [selectedDriverName, setSelectedDriverName] = useState('');

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
    const isSelected = isEditing && (() => {
      const orig = expenses.find(e => e.id === isEditing);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTruckFilter, setSelectedTruckFilter] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckNo.trim() || !amount.trim() || isNaN(Number(amount))) {
      return;
    }

    const todayStr = new Date().toISOString().substring(0, 10);
    const selectedTruck = trucks.find(t => t.truckNo === truckNo);
    const isUnchangedEdit = isEditing && (() => {
      const orig = expenses.find(e => e.id === isEditing);
      return orig && orig.truckNo === truckNo;
    })();
    if (selectedTruck && !isUnchangedEdit) {
      const isExpired = selectedTruck.registrationExpiryDate ? selectedTruck.registrationExpiryDate < todayStr : false;
      const isAdminDisabled = selectedTruck.status === 'Admin Disabled';
      const isNotApproved = selectedTruck.isApproved === false || selectedTruck.requestStatus === 'Rejected';
      if (isExpired || isAdminDisabled || isNotApproved) {
        let reason = "expired";
        if (isAdminDisabled) reason = "admin disabled";
        else if (isNotApproved) reason = "not approved";
        alert(`Cannot create/update expense: Selected truck ${truckNo} is ${reason}.`);
        return;
      }
    }

    const payload = {
      truckNo,
      expenseType,
      shopName: shopName.trim() || 'General',
      amount: parseFloat(amount),
      paymentMode: accountType === 'Driver' ? selectedDriverName : (paymentMode || 'Cash/General'),
      date,
      status: status || 'Pending',
      accountType,
      driverName: accountType === 'Driver' ? selectedDriverName : undefined
    };

    if (isEditing) {
      onUpdateExpense({
        id: isEditing,
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
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [displayedExpenses, setDisplayedExpenses] = useState<ExpenseEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const online = isAppwriteConfigured();

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTruckFilter, selectedTypeFilter, startDateFilter, endDateFilter]);

  // Offline / local logic
  useEffect(() => {
    if (!online) {
      const filtered = expenses.filter(exp => {
        const matchesSearch = exp.shopName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              exp.expenseType.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTruck = selectedTruckFilter ? exp.truckNo === selectedTruckFilter : true;
        const matchesType = selectedTypeFilter ? exp.expenseType === selectedTypeFilter : true;
        const matchesStartDate = startDateFilter ? exp.date >= startDateFilter : true;
        const matchesEndDate = endDateFilter ? exp.date <= endDateFilter : true;
        return matchesSearch && matchesTruck && matchesType && matchesStartDate && matchesEndDate;
      });

      setTotalCount(filtered.length);
      const startIdx = (currentPage - 1) * pageSize;
      setDisplayedExpenses(filtered.slice(startIdx, startIdx + pageSize));
    }
  }, [expenses, searchQuery, selectedTruckFilter, selectedTypeFilter, startDateFilter, endDateFilter, currentPage, pageSize, online]);

  // Online Appwrite logic
  useEffect(() => {
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
              search: searchQuery || undefined,
              truckNo: selectedTruckFilter || undefined,
              expenseType: selectedTypeFilter || undefined,
              startDate: startDateFilter || undefined,
              endDate: endDateFilter || undefined
            },
            currentPage,
            pageSize
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
  }, [expenses, searchQuery, selectedTruckFilter, selectedTypeFilter, startDateFilter, endDateFilter, currentPage, pageSize, online, organizationId]);

  const totalExpenseSum = (online ? displayedExpenses : expenses.filter(exp => {
    const matchesSearch = exp.shopName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          exp.expenseType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTruck = selectedTruckFilter ? exp.truckNo === selectedTruckFilter : true;
    const matchesType = selectedTypeFilter ? exp.expenseType === selectedTypeFilter : true;
    const matchesStartDate = startDateFilter ? exp.date >= startDateFilter : true;
    const matchesEndDate = endDateFilter ? exp.date <= endDateFilter : true;
    return matchesSearch && matchesTruck && matchesType && matchesStartDate && matchesEndDate;
  })).reduce((sum, item) => sum + item.amount, 0);

  const pendingExpenseSum = (online ? displayedExpenses : expenses.filter(exp => {
    const matchesSearch = exp.shopName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          exp.expenseType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTruck = selectedTruckFilter ? exp.truckNo === selectedTruckFilter : true;
    const matchesType = selectedTypeFilter ? exp.expenseType === selectedTypeFilter : true;
    const matchesStartDate = startDateFilter ? exp.date >= startDateFilter : true;
    const matchesEndDate = endDateFilter ? exp.date <= endDateFilter : true;
    return matchesSearch && matchesTruck && matchesType && matchesStartDate && matchesEndDate;
  })).filter(e => e.status === 'Pending').reduce((sum, item) => sum + item.amount, 0);

  const paidExpenseSum = (online ? displayedExpenses : expenses.filter(exp => {
    const matchesSearch = exp.shopName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          exp.expenseType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTruck = selectedTruckFilter ? exp.truckNo === selectedTruckFilter : true;
    const matchesType = selectedTypeFilter ? exp.expenseType === selectedTypeFilter : true;
    const matchesStartDate = startDateFilter ? exp.date >= startDateFilter : true;
    const matchesEndDate = endDateFilter ? exp.date <= endDateFilter : true;
    return matchesSearch && matchesTruck && matchesType && matchesStartDate && matchesEndDate;
  })).filter(e => e.status === 'Paid' || e.status === 'Settled').reduce((sum, item) => sum + item.amount, 0);

  const uniqueExpenseTypes = Array.from(new Set(expenses.map(e => e.expenseType).filter(Boolean)));

  return (
    <div id="expense-master-panel" className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs animate-fade-in font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <span>Voucher & Expenses Ledger</span>
            {loading && <span className="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Register, manage, and monitor general shop and temporary truck maintenance expenses.</p>
        </div>
        
        {canEditExpenses && (
          <button
            id="btn-toggle-expense-form"
            onClick={() => {
              if (showForm) resetForm();
              setShowForm(!showForm);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg transition duration-150 shadow-sm text-xs cursor-pointer active:scale-95"
          >
            {showForm ? 'Cancel & Close' : (
              <>
                <Plus className="w-3.5 h-3.5" /> Register New Expense
              </>
            )}
          </button>
        )}
      </div>

      {/* METRIC BADGES CARD BLOCK */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 border border-slate-250/70 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Total Filtered Cost</span>
            <span className="text-lg font-extrabold text-slate-800 font-mono">₹{totalExpenseSum.toLocaleString('en-IN')}</span>
          </div>
          <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        
        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-emerald-600 block font-bold uppercase tracking-wider">Paid Settlements</span>
            <span className="text-lg font-extrabold text-emerald-800 font-mono">₹{paidExpenseSum.toLocaleString('en-IN')}</span>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-amber-700 block font-bold uppercase tracking-wider">Pending/On-Credit</span>
            <span className="text-lg font-extrabold text-amber-900 font-mono">₹{pendingExpenseSum.toLocaleString('en-IN')}</span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-150">
            <HelpCircle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* EXPENSE REGISTRATION FORM */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 backdrop-blur-xs p-4 overflow-y-auto py-8 animate-fade-in" id="expense-form-backdrop">
          <form id="expense-registration-form" onSubmit={handleSubmit} className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto md:overflow-visible text-left my-auto">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-850 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-450" />
                <h3 className="text-sm font-bold text-slate-805 dark:text-white tracking-wide">
                  {isEditing ? 'Modify Registered Expense' : 'Register New Expense Voucher'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="p-1.5 hover:bg-slate-105 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 rounded-xl transition cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              
              {/* Truck No */}
              <div>
                <label htmlFor="expense-input-truck" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Truck ID No <span className="text-rose-500">*</span></label>
                <SearchableSelect
                  id="expense-input-truck"
                  value={truckNo}
                  onChange={(val) => setTruckNo(val)}
                  options={truckOptions}
                  placeholder="Search / choose Truck..."
                  required
                />
              </div>

              {/* Expense Type */}
              <div>
                <label htmlFor="expense-input-type" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Expense Type <span className="text-rose-500">*</span></label>
                <SearchableSelect
                  id="expense-input-type"
                  value={expenseType}
                  onChange={(val) => setExpenseType(val)}
                  options={expenseTypeOptions}
                  placeholder="Search / choose Expense Type..."
                  required
                  allowCustomVal
                />
              </div>

              {/* Shop / Supplier Name */}
              <div>
                <label htmlFor="expense-input-shop" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Shop / Supplier Name <span className="text-rose-500">*</span></label>
                <SearchableSelect
                  id="expense-input-shop"
                  value={shopName}
                  onChange={(val) => setShopName(val)}
                  options={shopOptions}
                  placeholder="Search / enter Shop..."
                  required
                  allowCustomVal
                />
              </div>

              {/* Expense Amount */}
              <div>
                <label htmlFor="expense-input-amount" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Expense Amount (₹) <span className="text-rose-500">*</span></label>
                <input
                  id="expense-input-amount"
                  type="number"
                  min="0.01"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  required
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-white font-bold rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 font-mono outline-none text-right"
                />
              </div>

              {/* Account Type Selector */}
              <div>
                <label htmlFor="expense-input-account-type" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Account Type <span className="text-rose-500">*</span></label>
                <select
                  id="expense-input-account-type"
                  value={accountType}
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
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  <option value="Account">Office Account</option>
                  <option value="Driver">Driver Operator Ledger</option>
                </select>
              </div>

              {/* Account / Driver Selector depending on Account Type */}
              {accountType === 'Account' ? (
                <div>
                  <label htmlFor="expense-input-payment-mode" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Ledger Account / Mode</label>
                  <select
                    id="expense-input-payment-mode"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
                  >
                    <option value="Cash/General">Cash/General State</option>
                    <option value="Axis">Axis Office</option>
                    <option value="HDFC">HDFC General</option>
                    {accounts.map(acct => (
                      <option key={acct.id} value={acct.accountName}>{acct.accountName} Ledger</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="expense-input-driver-name" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Select Driver <span className="text-rose-500">*</span></label>
                  <select
                    id="expense-input-driver-name"
                    value={selectedDriverName}
                    onChange={(e) => setSelectedDriverName(e.target.value)}
                    required
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
                  >
                    <option value="">-- Select Driver --</option>
                    {drivers.map(drv => (
                      <option key={drv.id} value={drv.driverName}>{drv.driverName}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date */}
              <div>
                <label htmlFor="expense-input-date" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Expense Date</label>
                <input
                  id="expense-input-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
                />
              </div>

              {/* Ledger Status */}
              <div>
                <label htmlFor="expense-input-status" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Clearance Status</label>
                <select
                  id="expense-input-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ExpenseEntry['status'])}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-bold"
                >
                  <option value="Settled">Settled</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Declined">Declined</option>
                </select>
              </div>

              {/* Submit Actions */}
              <div className="flex items-end justify-end space-x-2 pt-1 lg:pt-0 col-span-full border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50/50 rounded-lg text-xs font-semibold cursor-pointer active:scale-95 transition-all"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  {isEditing ? 'Save Changes' : 'Save Ledger Entry'}
                </button>
              </div>

            </div>
          </form>
        </div>
      )}
      <div className="bg-slate-50 border border-slate-200 p-3.5 mb-5 rounded-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-center">
        
        <div>
          <input
            type="text"
            placeholder="Search shop name or expense type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-205 text-slate-850 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-semibold"
          />
        </div>

        <div>
          <select
            value={selectedTruckFilter}
            onChange={(e) => setSelectedTruckFilter(e.target.value)}
            className="w-full bg-white border border-slate-205 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
          >
            <option value="">By Truck Filter (All)</option>
            {trucks.map(tk => (
              <option key={tk.id} value={tk.truckNo}>{tk.truckNo}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="w-full bg-white border border-slate-205 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
          >
            <option value="">By Expense Type (All)</option>
            {Array.from(new Set([
              ...allExpenseTypes,
              ...uniqueExpenseTypes
            ])).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Date inputs */}
        <div className="flex gap-2">
          <input
            type="date"
            title="Start Date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="w-full bg-white border border-slate-205 text-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
          />
          <input
            type="date"
            title="End Date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            className="w-full bg-white border border-slate-205 text-slate-850 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
          />
        </div>

        {/* Refresh / Clear Button */}
        <div className="flex gap-1 justify-end">
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedTruckFilter('');
              setSelectedTypeFilter('');
              setStartDateFilter('');
              setEndDateFilter('');
            }}
            className="bg-white border border-slate-250/70 hover:bg-slate-100 text-slate-605 text-slate-600 font-bold px-3 py-1.5 rounded-lg transition duration-150 text-xs cursor-pointer active:scale-95 w-full text-center"
          >
            Reset Filters
          </button>
        </div>

      </div>

      {/* EXPENSE LEDGER DATAGRID */}
      <div className="overflow-x-auto border border-slate-200.5/90 rounded-xl bg-white shadow-2xs hidden md:block">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-extrabold text-slate-550 border-b border-slate-200 uppercase tracking-wider">
            <tr>
              <th className="p-3 pl-4">Date</th>
              <th className="p-3">Truck No</th>
              <th className="p-3">Expense Type</th>
              <th className="p-3">Shop Name / Supplier</th>
              <th className="p-3">Payment Account Mode</th>
              <th className="p-3 text-right">Expense Amount</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
            {displayedExpenses.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-slate-400 font-sans italic font-normal">
                  No expense records match the selected registers.
                </td>
              </tr>
            ) : (
              displayedExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50/70 transition duration-150">
                  <td className="p-3 pl-4 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {exp.date}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="flex items-center gap-1 uppercase font-mono font-bold text-slate-900 tracking-wide text-[11px]">
                      <TruckIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {exp.truckNo}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 border border-blue-100 text-blue-800 font-extrabold rounded px-2 py-0.5">
                      {exp.expenseType}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-slate-800 truncate max-w-[150px]" title={exp.shopName || '—'}>
                      {exp.shopName || '—'}
                    </div>
                  </td>
                  <td className="p-3 font-semibold text-xs text-indigo-700 whitespace-nowrap">
                    {exp.accountType === 'Driver' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 font-sans font-bold">
                        <User className="w-3 h-3 text-emerald-600 shrink-0" />
                        Driver: {exp.driverName}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-mono">
                        <Landmark className="w-3 h-3 text-indigo-550 shrink-0" />
                        {exp.paymentMode}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                    ₹{Number(exp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border uppercase tracking-wider ${
                      (exp.status === 'Paid' || exp.status === 'Settled') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                      exp.status === 'Approved' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                      exp.status === 'Declined' ? 'border-rose-200 bg-rose-50 text-rose-700' :
                      'border-amber-200 bg-amber-50 text-amber-700'
                    }`}>
                      {exp.status}
                    </span>
                  </td>
                  <td className="p-3 text-right pr-4 whitespace-nowrap">
                    <div className="flex justify-end gap-1.5">
                      <button
                         title="Edit Expense"
                         disabled={!canEditExpenses}
                         onClick={() => startEdit(exp)}
                         className="p-1 px-2 border border-slate-200 rounded text-slate-600 hover:text-indigo-600 hover:border-indigo-300 bg-white shadow-3xs cursor-pointer active:scale-95 duration-100 flex items-center gap-1 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Edit2 className="w-2.5 h-2.5" /> Edit
                      </button>
                      <button
                        title="Delete Expense"
                        disabled={!canDeleteExpenses}
                        onClick={() => onDeleteExpense(exp.id)}
                        className="p-1 px-2 border border-rose-100 hover:bg-rose-50 text-rose-600 rounded hover:text-rose-800 bg-white shadow-3xs cursor-pointer active:scale-95 duration-100 flex items-center gap-1 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-2.5 h-2.5" /> Delete
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
        {displayedExpenses.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 py-12 text-center text-slate-400 italic">
            No expense records match the selected registers.
          </div>
        ) : (
          displayedExpenses.map((exp) => (
            <div 
              key={exp.id}
              className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-3xs flex flex-col justify-between hover:border-blue-300 transition relative"
            >
              <div>
                {/* Top Row: Date & Status */}
                <div className="flex justify-between items-center gap-2 mb-3 pr-8">
                  <span className="font-mono text-[10px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {exp.date}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    (exp.status === 'Paid' || exp.status === 'Settled') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    'bg-amber-50 text-amber-705 border border-amber-100'
                  }`}>
                    {exp.status}
                  </span>
                </div>

                {/* Truck & Expense Type */}
                <div className="flex items-center gap-2.5 text-xs mb-3 text-slate-800">
                  <span className="flex items-center gap-1 uppercase font-mono font-bold text-slate-900 tracking-wider">
                    <TruckIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {exp.truckNo}
                  </span>
                  <span className="w-px h-3 bg-slate-200" />
                  <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 border border-blue-100 text-blue-800 font-extrabold rounded px-2 py-0.2 uppercase tracking-wider">
                    {exp.expenseType}
                  </span>
                </div>

                {/* Details Section */}
                <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-2.5 space-y-1.5 text-xs text-slate-655 mb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Supplier / Shop</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[180px]">{exp.shopName || '—'}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Payment Mode</span>
                    <span className="text-slate-700">{exp.accountType === 'Driver' ? `Driver: ${exp.driverName}` : exp.paymentMode}</span>
                  </div>
                </div>

                {/* Amount Row */}
                <div className="flex justify-between items-center text-xs mb-4">
                  <span className="text-slate-500 font-semibold">Expense Amount:</span>
                  <span className="font-mono font-black text-rose-650 text-[14px]">
                    ₹{Number(exp.amount || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Micro-FAB Speed Dial */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className={`flex items-center gap-1.5 bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-full p-1 pl-2.5 pr-1.5 shadow-md transition-all duration-300 ease-out origin-right transform whitespace-nowrap ${
                    activeSpeedDialId === exp.id 
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
                      className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer disabled:opacity-45"
                      title="Modify Expense"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
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
                      className="w-7 h-7 rounded-full bg-rose-55 dark:bg-rose-955/20 border border-rose-150 dark:border-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-455 hover:bg-rose-100/30 transition cursor-pointer disabled:opacity-45"
                      title="Delete Expense"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSpeedDialId(activeSpeedDialId === exp.id ? null : exp.id)}
                    className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95 cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-200"
                  >
                    {activeSpeedDialId === exp.id ? (
                      <X className="w-4 h-4 transition-transform duration-300 rotate-90" />
                    ) : (
                      <Settings className="w-4 h-4 transition-transform duration-300" />
                    )}
                  </button>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* PAGINATION FOOTER */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs no-print">
        <div className="text-slate-500 font-medium">
          Showing <strong className="text-slate-800">{totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{" "}
          <strong className="text-slate-800">{Math.min(currentPage * pageSize, totalCount)}</strong> of{" "}
          <strong className="text-slate-800">{totalCount}</strong> entries
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Page size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded p-1 text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              {[10, 25, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
              className="p-1 px-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold rounded border border-slate-200 disabled:cursor-not-allowed select-none cursor-pointer transition"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
              disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
              className="p-1 px-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold rounded border border-slate-200 disabled:cursor-not-allowed select-none cursor-pointer transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
