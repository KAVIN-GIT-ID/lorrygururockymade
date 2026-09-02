import { createSignal } from 'solid-js';

import { Account } from '../types';
import { X, Calendar, Landmark } from 'lucide-solid';

interface PayEmiModalProps {
  isOpen: boolean;
  onClose: () => void;
  truckNo: string;
  emiAmount: number;
  bankName: string;
  dueDateStr: string;
  accounts: Account[];
  onConfirm: (paymentDate: string, accountId: string) => void;
  loanType?: string;
}

export default function PayEmiModal({
  isOpen,
  onClose,
  truckNo,
  emiAmount,
  bankName,
  dueDateStr,
  accounts,
  onConfirm,
  loanType
}: PayEmiModalProps) {
  const [paymentDate, setPaymentDate] = createSignal(dueDateStr);
  const [selectedAccountId, setSelectedAccountId] = createSignal('');

  if (!isOpen) return null;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!selectedAccountId()) {
      alert("Please select a payment account.");
      return;
    }
    onConfirm(paymentDate(), selectedAccountId());
  };

  const activeAccounts = accounts.filter(acc => acc.status === 'Active');

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-slate-150 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <Landmark class="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 class="font-bold text-sm text-slate-900 dark:text-white font-sans uppercase tracking-wider">Record EMI Payment</h3>
          </div>
          <button
            onClick={onClose}
            class="text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 p-1 rounded-lg transition"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} class="p-5 space-y-4 text-slate-800 dark:text-slate-100 text-xs">
          <div class="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-850 space-y-2">
            <div class="flex justify-between">
              <span class="text-slate-450">Truck No:</span>
              <span class="font-mono font-bold uppercase text-slate-900 dark:text-white">{truckNo}</span>
            </div>
            {loanType && (
              <div class="flex justify-between">
                <span class="text-slate-455">Loan Type:</span>
                <span class="font-semibold text-slate-900 dark:text-white">{loanType}</span>
              </div>
            )}
            <div class="flex justify-between">
              <span class="text-slate-455">Bank Name:</span>
              <span class="font-semibold text-slate-900 dark:text-white">{bankName}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-455">EMI Due Date:</span>
              <span class="font-semibold text-slate-900 dark:text-white">{dueDateStr}</span>
            </div>
            <div class="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 mt-1">
              <span class="text-slate-455 font-bold">EMI Amount:</span>
              <span class="font-mono font-extrabold text-blue-600 dark:text-blue-400 text-sm">₹{emiAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Payment Date */}
          <div class="space-y-1.5">
            <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Payment Date</label>
            <div class="relative">
              <Calendar class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                required
                value={paymentDate()}
                onChange={(e) => setPaymentDate(e.target.value)}
                class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 font-mono"
              />
            </div>
          </div>

          {/* Payment Account */}
          <div class="space-y-1.5">
            <label class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Payment Account</label>
            <div class="relative">
              <Landmark class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                required
                value={selectedAccountId()}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200"
              >
                <option value="" disabled>Select Payment Account</option>
                {activeAccounts.map(acc => (
                  <option  value={acc.id}>
                    {acc.accountName} ({acc.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Buttons */}
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              class="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-350 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition cursor-pointer"
            >
              Confirm Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
