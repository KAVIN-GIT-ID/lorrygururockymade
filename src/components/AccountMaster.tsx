import React, { useState } from 'react';
import { Account } from '../types';
import { Plus, Edit2, Trash2, Wallet, Landmark, Smartphone, ToggleLeft, CheckCircle, XCircle, Copy } from 'lucide-react';

interface AccountMasterProps {
  accounts: Account[];
  onAddAccount: (account: Omit<Account, 'id'>) => void;
  onUpdateAccount: (account: Account) => void;
  onDeleteAccount: (id: string) => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
  canViewAccounts?: boolean;
  canEditAccounts?: boolean;
  canDeleteAccounts?: boolean;
}

export default function AccountMaster({ 
  accounts, 
  onAddAccount, 
  onUpdateAccount, 
  onDeleteAccount, 
  confirmAction, 
  canViewAccounts = true,
  canEditAccounts = true,
  canDeleteAccounts = true
}: AccountMasterProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form States
  const [accountName, setAccountName] = useState('');
  const [type, setType] = useState<'Cash' | 'Bank' | 'Digital Wallets' | 'Other'>('Bank');
  const [holderName, setHolderName] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  // Bank Details States
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');

  const copyBankDetails = (account: Account) => {
    const details = [
      `Name: ${account.holderName || account.accountName}`,
      `Acc No: ${account.accountNo || ''}`,
      `Bank Name: ${account.bankName || ''}`,
      `IFSC: ${account.ifscCode || ''}`,
      `Branch: ${account.branchName || ''}`
    ].join('\n');
    
    navigator.clipboard.writeText(details)
      .then(() => alert("Bank details copied to clipboard!"))
      .catch(() => alert("Failed to copy details to clipboard. Please copy manually."));
  };

  const resetForm = () => {
    setAccountName('');
    setType('Bank');
    setHolderName('');
    setStatus('Active');
    setBankName('');
    setAccountNo('');
    setIfscCode('');
    setBranchName('');
    setIsEditing(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) return;

    const payload = {
      accountName,
      type,
      holderName: holderName || undefined,
      status,
      bankName: type === 'Bank' && bankName ? bankName : undefined,
      accountNo: type === 'Bank' && accountNo ? accountNo : undefined,
      ifscCode: type === 'Bank' && ifscCode ? ifscCode : undefined,
      branchName: type === 'Bank' && branchName ? branchName : undefined,
    };

    if (isEditing) {
      onUpdateAccount({
        id: isEditing,
        ...payload
      });
    } else {
      onAddAccount(payload);
    }
    resetForm();
    setShowAddForm(false);
  };

  const startEdit = (account: Account) => {
    setIsEditing(account.id);
    setAccountName(account.accountName);
    setType(account.type);
    setHolderName(account.holderName || '');
    setStatus(account.status);
    setBankName(account.bankName || '');
    setAccountNo(account.accountNo || '');
    setIfscCode(account.ifscCode || '');
    setBranchName(account.branchName || '');
    setShowAddForm(true);
  };

  const getSmallIcon = (accountType: string) => {
    switch (accountType) {
      case 'Cash':
        return <Wallet className="w-4 h-4 text-emerald-500" />;
      case 'Bank':
        return <Landmark className="w-4 h-4 text-indigo-500" />;
      case 'Digital Wallets':
        return <Smartphone className="w-4 h-4 text-cyan-500" />;
      default:
        return <ToggleLeft className="w-4 h-4 text-slate-400" />;
    }
  };

  const getCardClasses = (accountType: string) => {
    switch (accountType) {
      case 'Cash':
        return "bg-emerald-50/15 border-emerald-100/70 hover:border-emerald-300/80";
      case 'Bank':
        return "bg-indigo-50/15 border-indigo-100/70 hover:border-indigo-300/80";
      case 'Digital Wallets':
        return "bg-cyan-50/15 border-cyan-100/70 hover:border-cyan-300/80";
      default:
        return "bg-slate-50/40 border-slate-200 hover:border-slate-300";
    }
  };

  return (
    <div id="account-master-panel" className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">Available Accounts</h2>
          <p className="text-xs text-slate-500 mt-0.5">Register and manage banks, cash vaults, and digital wallets where advances are received.</p>
        </div>
        {canEditAccounts && (
          <button
            id="btn-add-account"
            onClick={() => {
              resetForm();
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-150 shadow-sm text-xs cursor-pointer"
          >
            {showAddForm ? 'Close Form' : (
              <>
                <Plus className="w-3.5 h-3.5" /> Add New Account
              </>
            )}
          </button>
        )}
      </div>

      {showAddForm && (
        <form id="account-form" onSubmit={handleSubmit} className="mb-6 p-4 md:p-5 bg-slate-50 rounded-lg border border-slate-250/70 animate-fade-in">
          <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4">
            {isEditing ? 'Modify Account Details' : 'Open New Account / Ledger'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Account Display Name <span className="text-red-500">*</span></label>
              <input
                id="input-account-name"
                type="text"
                placeholder="e.g. HDFC Bank Main"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Asset Class / Type</label>
              <select
                id="select-account-type"
                value={type}
                onChange={(e) => setType(e.target.value as 'Cash' | 'Bank' | 'Digital Wallets' | 'Other')}
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="Bank">Bank Deposit</option>
                <option value="Cash">Cash Account / Drawer</option>
                <option value="Digital Wallets">UPI / Digital Wallets</option>
                <option value="Other">Other Ledger</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Holder/Authorized Person</label>
              <input
                id="input-holder-name"
                type="text"
                placeholder="Manager Name"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Collection Status</label>
              <select
                id="select-account-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="Active">Active (Accepts Payments)</option>
                <option value="Inactive">Closed / Archived (Inactive)</option>
              </select>
            </div>
            {type === 'Bank' && (
              <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-3 pt-3 border-t border-slate-200/55 animate-fade-in">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Federal Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Account Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 22140100054889"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. FDRL0002214"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Branch Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Iveli"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-2xs cursor-pointer"
            >
              {isEditing ? 'Update Account' : 'Register Account'}
            </button>
          </div>
        </form>
      )}

      {accounts.length === 0 ? (
        <div className="text-center py-12 text-slate-400 font-medium italic border border-slate-200 rounded-xl bg-slate-50/50">
          No accounting ledgers mapped. Please create one to process transactions.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((account) => {
            const cardClasses = getCardClasses(account.type);
            const icon = getSmallIcon(account.type);
            return (
              <div
                key={account.id}
                id={`card-account-${account.id}`}
                className={`rounded-2xl shadow-xs relative flex flex-col justify-between transition-all duration-200 animate-fade-in group border ${cardClasses} p-4.5`}
              >
                <div>
                  {/* Top Row: Icon + Name & Status Badge */}
                  <div className="flex justify-between items-center gap-2 mb-3.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0">{icon}</span>
                      <h4 className="font-bold text-slate-855 text-sm tracking-tight truncate select-all" title={account.accountName}>
                        {account.accountName}
                      </h4>
                    </div>
                    {account.status === 'Active' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        Suspended
                      </span>
                    )}
                  </div>

                  {/* Details Section */}
                  <div className="text-[11px] text-slate-500 flex flex-col gap-2 font-sans min-w-0 mb-4 bg-slate-100/40 dark:bg-black/10 border border-slate-200/35 dark:border-slate-800/30 rounded-xl p-3">
                    {account.type === 'Bank' ? (
                      <>
                        <div className="flex justify-between items-center py-0.5 border-b border-slate-200/20 dark:border-slate-800/10">
                          <strong className="text-slate-450 font-bold uppercase text-[9px]">Bank</strong>
                          <span className="text-slate-800 font-semibold truncate max-w-[160px]" title={account.bankName || '—'}>
                            {account.bankName || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-0.5 border-b border-slate-200/20 dark:border-slate-800/10">
                          <strong className="text-slate-450 font-bold uppercase text-[9px]">A/C No</strong>
                          <span className="font-mono text-slate-800 font-bold select-all">{account.accountNo || '—'}</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5 border-b border-slate-200/20 dark:border-slate-800/10">
                          <strong className="text-slate-450 font-bold uppercase text-[9px]">IFSC</strong>
                          <span className="font-mono text-slate-800 font-semibold select-all">{account.ifscCode || '—'}</span>
                        </div>
                        <div className="flex justify-between items-center py-0.5">
                          <strong className="text-slate-450 font-bold uppercase text-[9px]">Branch</strong>
                          <span className="text-slate-800 font-semibold truncate max-w-[160px]" title={account.branchName || '—'}>
                            {account.branchName || '—'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center py-0.5 border-b border-slate-200/20 dark:border-slate-800/10">
                          <strong className="text-slate-450 font-bold uppercase text-[9px]">Custodian</strong>
                          <span className="text-slate-800 font-semibold truncate max-w-[160px]" title={account.holderName || '—'}>
                            {account.holderName || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-0.5 border-b border-slate-200/20 dark:border-slate-800/10">
                          <strong className="text-slate-450 font-bold uppercase text-[9px]">Asset Class</strong>
                          <span className="inline-flex text-indigo-700 font-bold text-[9px] bg-indigo-50 border border-indigo-100/50 px-1.5 py-0.2 rounded uppercase tracking-wider">
                            {account.type}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-0.5">
                          <strong className="text-slate-450 font-bold uppercase text-[9px]">Ledger ID</strong>
                          <span className="font-mono text-slate-400 text-[9px] select-all truncate max-w-[120px]" title={account.id}>
                            {account.id}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Actions Bar */}
                <div className={`grid ${account.type === 'Bank' ? 'grid-cols-3' : 'grid-cols-2'} gap-2 pt-3 border-t border-slate-100/60 dark:border-slate-800/40 mt-auto`}>
                  {account.type === 'Bank' && (
                    <button
                      type="button"
                      onClick={() => copyBankDetails(account)}
                      className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-850 text-indigo-600 hover:text-indigo-700 transition cursor-pointer active:scale-95 text-[10px] font-bold"
                      title="Copy bank details"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </button>
                  )}
                  <button
                    title="Edit Account"
                    disabled={!canEditAccounts}
                    onClick={() => startEdit(account)}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 hover:text-slate-855 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-[10px] font-bold"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    title="Delete Account"
                    disabled={!canDeleteAccounts}
                    onClick={() => {
                      const msg = `Are you sure you want to delete account ${account.accountName}?`;
                      if (confirmAction) {
                        confirmAction(msg, () => onDeleteAccount(account.id), "Delete Mapped Ledger Account");
                      } else if (confirm(msg)) {
                        onDeleteAccount(account.id);
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-rose-150 bg-rose-50/20 hover:bg-rose-50/50 text-rose-600 hover:text-rose-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-[10px] font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
