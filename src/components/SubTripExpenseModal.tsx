import { createSignal, Show, For } from 'solid-js';
import { SubTrip } from '../types';

interface SubTripExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  subTrip: SubTrip | null;
  subTripIndex: number;
  onSaveExpense: (expense: {
    category: 'loading' | 'unloading' | 'rmc' | 'mamul' | 'brokerage';
    amount: number;
    paidBy: 'DriverDirect' | 'OrgRental' | 'OrgPaid';
    bearsBy: 'Org' | 'Driver' | 'Office';
  }) => void;
}

export default function SubTripExpenseModal(props: SubTripExpenseModalProps) {
  const [category, setCategory] = createSignal<'loading' | 'unloading' | 'rmc' | 'mamul' | 'brokerage'>('loading');
  const [amount, setAmount] = createSignal<string>('');
  const [paidBy, setPaidBy] = createSignal<'DriverDirect' | 'OrgRental' | 'OrgPaid'>('DriverDirect');
  const [bearsBy, setBearsBy] = createSignal<'Org' | 'Driver' | 'Office'>('Org');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount());
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    props.onSaveExpense({
      category: category(),
      amount: parsedAmount,
      paidBy: paidBy(),
      bearsBy: bearsBy()
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
              <h3 class="text-sm font-black text-slate-900">+ Add Leg Expense</h3>
              <p class="text-xs font-semibold text-slate-500">
                Sub-Trip #{props.subTripIndex + 1}: {props.subTrip?.routeFrom || 'Origin'} ➔ {props.subTrip?.routeTo || 'Dest'}
              </p>
            </div>
            <button onClick={props.onClose} class="text-slate-400 font-bold hover:text-slate-600 text-sm p-1">✕</button>
          </div>

          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            
            {/* Category Select Chips */}
            <div>
              <label class="text-[11px] font-extrabold text-slate-700 block mb-1.5">EXPENSE TYPE *</label>
              <div class="flex gap-2 overflow-x-auto pb-1">
                <For each={[
                  { id: 'loading', label: 'Loading' },
                  { id: 'unloading', label: 'Unloading' },
                  { id: 'brokerage', label: 'Brokerage' },
                  { id: 'mamul', label: 'Crossing (Mamul)' },
                  { id: 'rmc', label: 'RMC Expense' }
                ]}>
                  {(item) => (
                    <button
                      type="button"
                      onClick={() => setCategory(item.id as any)}
                      class={`px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition-colors ${
                        category() === item.id 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  )}
                </For>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[11px] font-extrabold text-slate-700 block mb-1">AMOUNT (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 2500"
                  value={amount()}
                  onInput={(e) => setAmount(e.currentTarget.value)}
                  class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label class="text-[11px] font-extrabold text-slate-700 block mb-1">PAID BY / DEDUCT *</label>
                <select
                  value={paidBy()}
                  onChange={(e) => setPaidBy(e.currentTarget.value as any)}
                  class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600"
                >
                  <option value="DriverDirect">Driver Paid (Advance)</option>
                  <option value="OrgRental">Org Rental (Office Paid)</option>
                  <option value="OrgPaid">Org Paid (Direct/Bank)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="text-[11px] font-extrabold text-slate-700 block mb-1">WHO BEARS? *</label>
              <select
                value={bearsBy()}
                onChange={(e) => setBearsBy(e.currentTarget.value as any)}
                class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600"
              >
                <option value="Org">Organization</option>
                <option value="Driver">Driver</option>
                <option value="Office">Office</option>
              </select>
            </div>

            <button
              type="submit"
              class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-md mt-1 transition-colors"
            >
              Save Sub-Trip Expense
            </button>
          </form>

        </div>
      </div>
    </Show>
  );
}

