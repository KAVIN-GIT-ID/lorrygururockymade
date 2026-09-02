import { createSignal, Show, For } from 'solid-js';
import { SubTrip } from '../types';

interface RegisterPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subTrip: SubTrip | null;
  subTripIndex: number;
  accounts: any[];
  onSavePayment: (payment: {
    amount: number;
    date: string;
    account: string;
    remarks: string;
  }) => void;
}

export default function RegisterPaymentModal(props: RegisterPaymentModalProps) {
  const contractFreight = () => props.subTrip?.income || 0;
  const advances = () => 0;
  const pendingBalance = () => Math.max(0, contractFreight() - advances());

  const [amount, setAmount] = createSignal<string>('');
  const [paymentDate, setPaymentDate] = createSignal<string>(new Date().toISOString().split('T')[0]);
  const [account, setAccount] = createSignal<string>('');
  const [remarks, setRemarks] = createSignal<string>('');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount() || pendingBalance().toString());
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    props.onSavePayment({
      amount: parsedAmount,
      date: paymentDate(),
      account: account(),
      remarks: remarks()
    });

    setAmount('');
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end transition-opacity">
        <div class="bg-white rounded-t-2xl p-5 flex flex-col gap-4 shadow-2xl max-h-[75vh] overflow-y-auto border-t border-slate-200 animate-slide-up">
          
          {/* Pull handle */}
          <div class="w-10 h-1 bg-slate-300 rounded-full self-center"></div>

          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-black text-slate-900">💵 Register Party Payment</h3>
              <p class="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-sm inline-block mt-0.5">
                Sub-Trip #{props.subTripIndex + 1} • Pending: ₹{pendingBalance().toLocaleString('en-IN')}
              </p>
            </div>
            <button onClick={props.onClose} class="text-slate-400 font-bold hover:text-slate-600 text-sm p-1">✕</button>
          </div>

          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            
            <div>
              <label class="text-[11px] font-extrabold text-slate-700 block mb-1">PAYMENT AMOUNT (₹) *</label>
              <input
                type="number"
                required
                placeholder={`Pending ₹${pendingBalance()}`}
                value={amount() || pendingBalance()}
                onInput={(e) => setAmount(e.currentTarget.value)}
                class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-base font-black text-emerald-700 focus:outline-hidden focus:border-emerald-600"
              />
              <span class="text-[10px] font-medium text-slate-500 block mt-1">
                Contract Freight: ₹{contractFreight().toLocaleString('en-IN')} • Recd: ₹{advances().toLocaleString('en-IN')}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[11px] font-extrabold text-slate-700 block mb-1">PAYMENT DATE *</label>
                <input
                  type="date"
                  required
                  value={paymentDate()}
                  onInput={(e) => setPaymentDate(e.currentTarget.value)}
                  class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label class="text-[11px] font-extrabold text-slate-700 block mb-1">RECEIVED TO *</label>
                <select
                  value={account()}
                  onChange={(e) => setAccount(e.currentTarget.value)}
                  class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600"
                >
                  <option value="">-- Choose Account --</option>
                  <option value="paid_to_driver_advance">👤 Paid to Driver Advance</option>
                  <option value="Cash">💵 Cash</option>
                  <For each={props.accounts.filter(ac => ac.status === 'Active' || ac.id === account())}>
                    {(ac) => <option value={ac.id}>{ac.accountName}</option>}
                  </For>
                </select>
              </div>
            </div>

            <div>
              <label class="text-[11px] font-extrabold text-slate-700 block mb-1">REMARKS / UTR REFERENCE (OPTIONAL)</label>
              <input
                type="text"
                placeholder="e.g. UTR / NEFT #29401"
                value={remarks()}
                onInput={(e) => setRemarks(e.currentTarget.value)}
                class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600"
              />
            </div>

            <button
              type="submit"
              class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-md mt-1 transition-colors"
            >
              ✓ Save Payment & Update Receivable
            </button>
          </form>

        </div>
      </div>
    </Show>
  );
}
