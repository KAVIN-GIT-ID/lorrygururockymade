import React, { useState } from 'react';
import { Account } from '../types';
import { X, Calendar, Landmark } from 'lucide-react';

interface PayTaxModalProps {
  isOpen: boolean;
  onClose: () => void;
  truckNo: string;
  taxType: 'Insurance' | 'Quarterly Tax' | 'National Permit Tax' | '5 Year Permit';
  currentExpiryDate: string;
  accounts: Account[];
  onConfirm: (paymentDate: string, amount: number, nextExpiryDate: string, accountId: string) => void;
}

export default function PayTaxModal({
  isOpen,
  onClose,
  truckNo,
  taxType,
  currentExpiryDate,
  accounts,
  onConfirm
}: PayTaxModalProps) {
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [nextExpiryDate, setNextExpiryDate] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if (!nextExpiryDate) {
      alert("Please select the next expiry date.");
      return;
    }
    if (!selectedAccountId) {
      alert("Please select a payment account.");
      return;
    }
    onConfirm(paymentDate, Number(amount), nextExpiryDate, selectedAccountId);
  };

  const activeAccounts = accounts.filter(acc => acc.status === 'Active');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-150 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white font-sans uppercase tracking-wider">Pay {taxType}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-slate-800 dark:text-slate-100 text-xs">
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-850 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-450">Truck No:</span>
              <span className="font-mono font-bold uppercase text-slate-900 dark:text-white">{truckNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-455">Tax Category:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{taxType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-455">Current Expiry:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{currentExpiryDate || '—'}</span>
            </div>
          </div>

          {/* Amount Paid */}
          <div className="space-y-1.5">
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Amount Paid (₹) <span className="text-rose-505">*</span></label>
            <input
              type="number"
              required
              min="1"
              placeholder="e.g. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 font-semibold"
            />
          </div>

          {/* Next Expiry Date */}
          <div className="space-y-1.5">
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Next Expiry Date <span className="text-rose-505">*</span></label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                required
                value={nextExpiryDate}
                onChange={(e) => setNextExpiryDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
          </div>

          {/* Payment Date */}
          <div className="space-y-1.5">
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Payment Date</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
          </div>

          {/* Payment Account */}
          <div className="space-y-1.5">
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Payment Account <span className="text-rose-505">*</span></label>
            <div className="relative">
              <Landmark className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                required
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
              >
                <option value="" disabled>Select Payment Account</option>
                {activeAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountName} ({acc.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-350 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition cursor-pointer"
            >
              Confirm Payment & Update Expiry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
