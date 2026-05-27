import React, { useState } from 'react';
import { ExpenseEntry, Truck, Account, Driver } from '../types';
import { Plus, Edit2, Trash2, Landmark, DollarSign, Calendar, ShoppingBag, Truck as TruckIcon, ShieldCheck, HelpCircle, FileSpreadsheet, User } from 'lucide-react';

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
  canDeleteExpenses = true
}: ExpenseMasterProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [truckNo, setTruckNo] = useState('');
  const [expenseType, setExpenseType] = useState('Temporary');
  const [shopName, setShopName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<ExpenseEntry['status']>('Paid');
  const [accountType, setAccountType] = useState<'Account' | 'Driver'>('Account');
  const [selectedDriverName, setSelectedDriverName] = useState('');

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
    setStatus('Paid');
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
      status,
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
    setStatus(exp.status);
    setAccountType(exp.accountType || 'Account');
    setSelectedDriverName(exp.driverName || '');
    setShowForm(true);
  };

  // Filter logic
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.shopName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          exp.expenseType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTruck = selectedTruckFilter ? exp.truckNo === selectedTruckFilter : true;
    const matchesType = selectedTypeFilter ? exp.expenseType === selectedTypeFilter : true;
    return matchesSearch && matchesTruck && matchesType;
  });

  const totalExpenseSum = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const pendingExpenseSum = filteredExpenses.filter(e => e.status === 'Pending').reduce((sum, item) => sum + item.amount, 0);
  const paidExpenseSum = filteredExpenses.filter(e => e.status === 'Paid').reduce((sum, item) => sum + item.amount, 0);

  const uniqueExpenseTypes = Array.from(new Set(expenses.map(e => e.expenseType).filter(Boolean)));

  return (
    <div id="expense-master-panel" className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs animate-fade-in font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Voucher & Expenses Ledger
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
        <form id="expense-registration-form" onSubmit={handleSubmit} className="mb-6 p-4 md:p-5 bg-indigo-50/30 rounded-xl border border-indigo-100 animate-fade-in space-y-4">
          <div className="flex justify-between items-center border-b border-indigo-100/60 pb-2">
            <h3 className="text-xs font-bold text-indigo-805 text-indigo-800 uppercase tracking-widest">
              {isEditing ? '🖊️ Modify Registered Expense' : '📋 Register New Expense Voucher'}
            </h3>
            <span className="text-[9px] bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full font-bold">Standard Form</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            
            {/* Truck No */}
            <div>
              <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Truck ID No <span className="text-rose-500">*</span></label>
              <select
                id="expense-input-truck"
                value={truckNo}
                onChange={(e) => setTruckNo(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
              >
                <option value="">-- Choose Truck --</option>
                {trucks.map(tk => {
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

                  return (
                    <option 
                      key={tk.id} 
                      value={tk.truckNo}
                      disabled={isBlocked && !isSelected}
                    >
                      {tk.truckNo}
                      {tk.make || tk.model ? ` [${[tk.make, tk.model].filter(Boolean).join(' / ')}]` : ''}
                      {labelSuffix}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Expense Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Expense Type <span className="text-rose-500">*</span></label>
              <select
                id="expense-input-type"
                value={expenseType}
                onChange={(e) => setExpenseType(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-bold"
              >
                <option value="Temporary">Temporary</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Breakdown">Breakdown</option>
                <option value="Spare Parts">Spare Parts</option>
                <option value="Workshop Service">Workshop Service</option>
                <option value="Driver Advance">Driver Advance</option>
                <option value="Tolls & Mamuls">Tolls & Mamuls</option>
                <option value="Lubricants & Oils">Lubricants & Oils</option>
              </select>
            </div>

            {/* Shop / Supplier Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Shop / Supplier Name No <span className="text-rose-500">*</span></label>
              <input
                id="expense-input-shop"
                type="text"
                placeholder="e.g. TVS Auto, MRF Tyres"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
              />
            </div>

            {/* Expense Amount */}
            <div>
              <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Expense Amount (₹) <span className="text-rose-500">*</span></label>
              <input
                id="expense-input-amount"
                type="number"
                min="0.01"
                step="any"
                placeholder="0.00"
                value={amount}
                required
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-850 font-bold rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 font-mono outline-none text-right"
              />
            </div>

            {/* Account Type Selector (Requirement 2) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Account Type <span className="text-rose-500">*</span></label>
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
                className="w-full bg-white border border-slate-200 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                <option value="Account">Office Account</option>
                <option value="Driver">Driver Operator Ledger</option>
              </select>
            </div>

            {/* Account / Driver Selector depending on Account Type */}
            {accountType === 'Account' ? (
              <div>
                <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Ledger Account / Mode</label>
                <select
                  id="expense-input-payment-mode"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
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
                <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Select Driver <span className="text-rose-500">*</span></label>
                <select
                  id="expense-input-driver-name"
                  value={selectedDriverName}
                  onChange={(e) => setSelectedDriverName(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
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
              <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Expense Date</label>
              <input
                id="expense-input-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold"
              />
            </div>

            {/* Ledger Status */}
            <div>
              <label className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Clearance Status</label>
              <select
                id="expense-input-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ExpenseEntry['status'])}
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-bold"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Declined">Declined</option>
              </select>
            </div>

            {/* Submit Actions */}
            <div className="flex items-end justify-end space-x-2 pt-1 lg:pt-0">
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
      )}

      {/* FILTER CONTROLS BAR */}
      <div className="bg-slate-50 border border-slate-200 p-3.5 mb-5 rounded-xl flex flex-col md:flex-row items-center gap-3">
        
        <div className="w-full md:w-1/3">
          <input
            type="text"
            placeholder="Search shop name or expense type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-205 text-slate-850 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-semibold"
          />
        </div>

        <div className="w-full md:w-1/4">
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

        <div className="w-full md:w-1/4">
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="w-full bg-white border border-slate-205 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
          >
            <option value="">By Expense Type (All)</option>
            <option value="Temporary">Temporary</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Spare Parts">Spare Parts</option>
            <option value="Workshop Service">Workshop Service</option>
            <option value="Driver Advance">Driver Advance</option>
            <option value="Tolls & Mamuls">Tolls & Mamuls</option>
            {uniqueExpenseTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Refresh / Clear Button */}
        <div className="w-full md:w-auto flex-shrink-0 flex gap-1 justify-end">
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedTruckFilter('');
              setSelectedTypeFilter('');
            }}
            className="bg-white border border-slate-250/70 hover:bg-slate-100 text-slate-600 font-bold px-3 py-1.5 rounded-lg transition duration-150 text-xs cursor-pointer active:scale-95"
          >
            Reset Filters
          </button>
        </div>

      </div>

      {/* EXPENSE LEDGER DATAGRID */}
      <div className="overflow-x-auto border border-slate-200.5/90 rounded-xl bg-white shadow-2xs">
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
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-slate-400 font-sans italic font-normal">
                  No expense records match the selected registers.
                </td>
              </tr>
            ) : (
              filteredExpenses.map((exp) => (
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
                    <span className="bg-indigo-50 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                      {exp.expenseType}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="flex items-center gap-1.5 font-bold font-sans text-slate-800">
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {exp.shopName}
                    </span>
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
                    ₹{exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border uppercase tracking-wider ${
                      exp.status === 'Paid' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
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
    </div>
  );
}
