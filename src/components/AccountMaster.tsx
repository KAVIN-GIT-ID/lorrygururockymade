import React, { useState } from 'react';
import { Account } from '../types';
import { Plus, Edit2, Trash2, Wallet, Landmark, Smartphone, ToggleLeft, CheckCircle, XCircle } from 'lucide-react';

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

  const resetForm = () => {
    setAccountName('');
    setType('Bank');
    setHolderName('');
    setStatus('Active');
    setIsEditing(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) return;

    if (isEditing) {
      onUpdateAccount({
        id: isEditing,
        accountName,
        type,
        holderName,
        status
      });
    } else {
      onAddAccount({
        accountName,
        type,
        holderName,
        status
      });
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
    setShowAddForm(true);
  };

  const getAccountIcon = (accountType: string) => {
    switch (accountType) {
      case 'Cash':
        return <Wallet className="w-4 h-4 text-emerald-400" />;
      case 'Bank':
        return <Landmark className="w-4 h-4 text-indigo-400" />;
      case 'Digital Wallets':
        return <Smartphone className="w-4 h-4 text-cyan-400" />;
      default:
        return <ToggleLeft className="w-4 h-4 text-slate-400" />;
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

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table id="accounts-table" className="w-full text-left text-sm text-slate-700">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 font-bold tracking-wider">
            <tr>
              <th className="px-4 py-3.5 pl-6">Account Name</th>
              <th className="px-4 py-3.5">Financial Type</th>
              <th className="px-4 py-3.5">Custodian Name</th>
              <th className="px-4 py-3.5 text-center">Status</th>
              <th className="px-4 py-3.5 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-400 font-medium italic">No accounting ledgers mapped. Please create one to process transactions.</td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.id} id={`row-account-${account.id}`} className="hover:bg-slate-50/75 transition">
                  <td className="px-4 py-3.5 pl-6 font-bold text-slate-800 flex items-center gap-2.5">
                    <span className="p-1.5 bg-slate-100 rounded-lg text-slate-600">
                      {getAccountIcon(account.type)}
                    </span>
                    {account.accountName}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 font-semibold">
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                      {account.type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-605 font-medium">
                    {account.holderName || <span className="text-slate-400 italic font-mono">&mdash;</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      account.status === 'Active' 
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
                        : 'bg-rose-50 border border-rose-200 text-rose-700'
                    }`}>
                      {account.status === 'Active' ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Accepting
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Suspended
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium pr-6">
                    <div className="flex justify-end gap-1 px-1">
                      <button
                        title="Edit Account"
                        disabled={!canEditAccounts}
                        onClick={() => startEdit(account)}
                        className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
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
    </div>
  );
}
