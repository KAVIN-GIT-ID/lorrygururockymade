import { createSignal, For, Show } from 'solid-js';
import { TripEntry, SubTrip, Truck, Driver } from '../types';
import { Search, Plus, MapPin, Truck as TruckIcon, User, Calendar, MessageSquare, DollarSign, ChevronRight, CheckCircle2, Navigation } from 'lucide-solid';
import SubTripExpenseModal from './SubTripExpenseModal';
import RegisterPaymentModal from './RegisterPaymentModal';
import MobileSubTripViewPage from './MobileSubTripViewPage';
import { shareSubTripWhatsAppStatement } from '../utils/subtripWhatsappShare';

interface MobileTripsTabProps {
  trips: TripEntry[];
  trucks: Truck[];
  drivers: Driver[];
  accounts: any[];
  onSelectTrip: (trip: TripEntry) => void;
  onOpenQuickDispatch: () => void;
  onSaveTrips: (trips: TripEntry[]) => void;
}

export default function MobileTripsTab(props: MobileTripsTabProps) {
  const [searchTerm, setSearchTerm] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<'ALL' | 'EN_ROUTE' | 'POD_PENDING' | 'SETTLED'>('ALL');

  // Currently opened sub-trip for full screen view
  const [activeSubTripView, setActiveSubTripView] = createSignal<{ trip: TripEntry; subTrip: SubTrip; subTripIndex: number } | null>(null);

  // Modals state
  const [expenseModalTarget, setExpenseModalTarget] = createSignal<{ subTrip: SubTrip; subTripIndex: number; tripId: string } | null>(null);
  const [paymentModalTarget, setPaymentModalTarget] = createSignal<{ subTrip: SubTrip; subTripIndex: number; tripId: string } | null>(null);

  // Filtered trips list
  const filteredTrips = () => {
    return (props.trips || []).filter((t) => {
      const matchesSearch = 
        (t.truckNo || '').toLowerCase().includes(searchTerm().toLowerCase()) ||
        (t.driverName || '').toLowerCase().includes(searchTerm().toLowerCase()) ||
        (t.tripNo || '').toLowerCase().includes(searchTerm().toLowerCase()) ||
        (t.subTrips || []).some(st => (st.routeFrom || '').toLowerCase().includes(searchTerm().toLowerCase()) || (st.routeTo || '').toLowerCase().includes(searchTerm().toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter() === 'EN_ROUTE') return t.status === 'In Progress' || t.status === 'Pending';
      if (statusFilter() === 'POD_PENDING') return t.status === 'Completed';
      if (statusFilter() === 'SETTLED') return t.status === 'Settled';

      return true;
    });
  };

  // Add Expense to SubTrip Handler
  const handleSaveSubTripExpense = (exp: {
    category: 'loading' | 'unloading' | 'rmc' | 'mamul' | 'brokerage';
    amount: number;
    paidBy: 'DriverDirect' | 'OrgRental' | 'OrgPaid';
    bearsBy: 'Org' | 'Driver' | 'Office';
  }) => {
    const target = expenseModalTarget();
    if (!target) return;

    const updatedTrips = props.trips.map((trip) => {
      if (trip.id !== target.tripId) return trip;

      const updatedSubTrips = (trip.subTrips || []).map((st, idx) => {
        if (idx !== target.subTripIndex) return st;

        const updated = { ...st };
        const paidByDriver = exp.paidBy === 'DriverDirect';
        // bears maps to 'Org' | 'Driver' (no 'Office' in SubTrip type, but importLegacyCargoExpenses handles it via cast)
        const bears = exp.bearsBy as any;

        if (exp.category === 'loading') {
          updated.loadingExpense = (updated.loadingExpense || 0) + exp.amount;
          updated.loadingPaidByDriver = paidByDriver;
          updated.loadingDeductedFrom = exp.paidBy as any;
          updated.loadingBears = bears;
        } else if (exp.category === 'unloading') {
          updated.unloadingExpense = (updated.unloadingExpense || 0) + exp.amount;
          updated.unloadingPaidByDriver = paidByDriver;
          updated.unloadingDeductedFrom = exp.paidBy as any;
          updated.unloadingBears = bears;
        } else if (exp.category === 'rmc') {
          updated.rmcExpense = (updated.rmcExpense || 0) + exp.amount;
          updated.rmcPaidByDriver = paidByDriver;
          updated.rmcDeductedFrom = exp.paidBy as any;
          updated.rmcBears = bears;
        } else if (exp.category === 'mamul') {
          updated.crossingExpense = (updated.crossingExpense || 0) + exp.amount;
          updated.crossingPaidByDriver = paidByDriver;
          updated.crossingDeductedFrom = exp.paidBy as any;
          updated.crossingBears = bears;
        } else if (exp.category === 'brokerage') {
          updated.brokerageExpense = (updated.brokerageExpense || 0) + exp.amount;
          updated.brokeragePaidByDriver = paidByDriver;
          updated.brokerageDeductedFrom = exp.paidBy as any;
          updated.brokerageBears = bears;
        }
        return updated;
      });

      return { ...trip, subTrips: updatedSubTrips };
    });

    props.onSaveTrips(updatedTrips);
    setExpenseModalTarget(null);
  };



  // Register Payment Handler
  const handleSavePayment = (pmt: { amount: number; date: string; account: string; remarks: string }) => {
    const target = paymentModalTarget();
    if (!target) return;

    const updatedTrips = props.trips.map((trip) => {
      if (trip.id !== target.tripId) return trip;

      const currentPayments = trip.payments || [];
      const newPayment = {
        id: `pmt-${Date.now()}`,
        amount: pmt.amount,
        date: pmt.date,
        receivedBy: pmt.account,
        notes: pmt.remarks,
        subTripId: target.subTrip.id
      };

      return { ...trip, payments: [...currentPayments, newPayment] };
    });

    props.onSaveTrips(updatedTrips);
    setPaymentModalTarget(null);
  };

  return (
    <div class="min-h-screen bg-slate-50 flex flex-col font-sans pb-20">
      
      {/* Show Full-Screen Sub-Trip Page if Active */}
      <Show when={activeSubTripView()} fallback={
        <>
          {/* Top Bar Header */}
          <header class="bg-white border-b border-slate-200 p-3.5 sticky top-0 z-20 shadow-xs flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div>
                <h1 class="text-base font-black text-slate-900 tracking-tight">Trips & Dispatch</h1>
                <p class="text-xs font-semibold text-slate-500">Live Trip Fleet & Sub-Trip Ledger</p>
              </div>

              <button
                onClick={props.onOpenQuickDispatch}
                class="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              >
                <Plus class="w-4 h-4" />
                <span>Quick Dispatch</span>
              </button>
            </div>

            {/* Search Input Bar */}
            <div class="relative">
              <Search class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search truck no, driver, route, party..."
                value={searchTerm()}
                onInput={(e) => setSearchTerm(e.currentTarget.value)}
                class="w-full bg-slate-100 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-600"
              />
            </div>

            {/* Filter Pills */}
            <div class="flex gap-2 overflow-x-auto pb-0.5">
              <For each={[
                { id: 'ALL', label: 'All Trips' },
                { id: 'EN_ROUTE', label: '🚛 En-Route' },
                { id: 'POD_PENDING', label: '📬 POD Pending' },
                { id: 'SETTLED', label: '🎉 Settled' }
              ]}>
                {(filter) => (
                  <button
                    onClick={() => setStatusFilter(filter.id as any)}
                    class={`px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition-colors ${
                      statusFilter() === filter.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                )}
              </For>
            </div>
          </header>

          {/* Master Trip Cards List Area */}
          <main class="flex-1 p-3.5 flex flex-col gap-3.5">
            <For each={filteredTrips()} fallback={
              <div class="bg-white border border-slate-200 rounded-2xl p-8 text-center flex flex-col items-center gap-2">
                <TruckIcon class="w-8 h-8 text-slate-300" />
                <p class="text-xs font-extrabold text-slate-500">No active trips found for selected filter.</p>
              </div>
            }>
              {(trip) => {
                const subTrips = (): SubTrip[] => {
                  if (trip.subTrips && trip.subTrips.length > 0) return trip.subTrips;
                  return [
                    {
                      id: `sub-${trip.id}-0`,
                      loadingDate: trip.startDate,
                      officeName: 'Main Office',
                      routeFrom: 'Salem',
                      routeTo: 'Vizag',
                      income: 85000,
                      loadingExpense: 0,
                      unloadingExpense: 0,
                      driverWages: 3500,
                      startingKM: trip.startingKM || 0,
                      endingKM: trip.endingKM || 0
                    }
                  ];
                };

                const firstSubTrip = (trip.subTrips && trip.subTrips[0]) || {
                  id: `sub-${trip.id}-0`,
                  loadingDate: trip.startDate,
                  officeName: 'Main Office',
                  routeFrom: 'Salem',
                  routeTo: 'Vizag',
                  income: 85000,
                  loadingExpense: 0,
                  unloadingExpense: 0,
                  driverWages: 3500,
                  startingKM: trip.startingKM || 0,
                  endingKM: trip.endingKM || 0
                };

                return (
                  <div 
                    onClick={() => setActiveSubTripView({ trip, subTrip: firstSubTrip, subTripIndex: 0 })}
                    class="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col gap-3 hover:border-slate-300 transition-colors cursor-pointer"
                  >
                    
                    {/* Clean Card Banner */}
                    <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <span class="text-sm font-black text-slate-900 tracking-tight">{trip.tripNo || `TRIP-${trip.id.substring(0, 6).toUpperCase()}`}</span>
                        <span class="text-xs font-bold text-slate-500 block">{trip.truckNo} • Driver: {trip.driverName || 'N/A'}</span>
                      </div>
                      <span class={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                        trip.status === 'Completed' || trip.status === 'Settled'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {trip.status === 'In Progress' ? 'In-Transit' : (trip.status || 'In-Transit')}
                      </span>
                    </div>

                    {/* Route Box */}
                    <div class="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <MapPin class="w-4 h-4 text-emerald-600 shrink-0" />
                        <span class="text-xs font-extrabold text-slate-900">
                          {(trip.subTrips || []).map(s => `${s.routeFrom || ''} ➔ ${s.routeTo || ''}`).join(' ➔ ') || `${trip.truckNo} Route`}
                        </span>
                      </div>
                    </div>

                    {/* Financial Summary Line */}
                    <div class="flex items-center justify-between pt-1 text-xs">
                      <div>
                        <span class="text-slate-400 font-medium">Freight: </span>
                        <span class="font-extrabold text-slate-900">₹{(trip.subTrips ? trip.subTrips.reduce((a, b) => a + (b.income || 0), 0) : (trip.dieselAmount || 0)).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span class="text-slate-400 font-medium">Expenses: </span>
                        <span class="font-extrabold text-rose-600">₹{((trip.rtoExpense || 0) + (trip.dieselAmount || 0) + (trip.addBlueExpense || 0) + (trip.fastagExpense || 0) + (trip.otherExpense || 0)).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                             {/* Direct Quick Action Buttons */}
                    <div class="flex items-center justify-between pt-1">
                      <div class="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const firstSub = (trip.subTrips && trip.subTrips[0]) || {
                              id: `sub-${trip.id}-0`,
                              loadingDate: trip.startDate,
                              officeName: 'Main Office',
                              routeFrom: 'Salem',
                              routeTo: 'Vizag',
                              income: 85000,
                              loadingExpense: 0,
                              unloadingExpense: 0,
                              driverWages: 3500,
                              startingKM: trip.startingKM || 0,
                              endingKM: trip.endingKM || 0
                            };
                            setExpenseModalTarget({ subTrip: firstSub, subTripIndex: 0, tripId: trip.id });
                          }}
                          class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-extrabold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 shadow-2xs"
                        >
                          <Plus class="w-3 h-3 text-slate-600" />
                          <span>+ Expense</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const firstSub = (trip.subTrips && trip.subTrips[0]) || {
                              id: `sub-${trip.id}-0`,
                              loadingDate: trip.startDate,
                              officeName: 'Main Office',
                              routeFrom: 'Salem',
                              routeTo: 'Vizag',
                              income: 85000,
                              loadingExpense: 0,
                              unloadingExpense: 0,
                              driverWages: 3500,
                              startingKM: trip.startingKM || 0,
                              endingKM: trip.endingKM || 0
                            };
                            setPaymentModalTarget({ subTrip: firstSub, subTripIndex: 0, tripId: trip.id });
                          }}
                          class="bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 shadow-2xs"
                        >
                          <DollarSign class="w-3 h-3 text-emerald-700" />
                          <span>Pay</span>
                        </button>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const firstSub = (trip.subTrips && trip.subTrips[0]) || {
                            id: `sub-${trip.id}-0`,
                            loadingDate: trip.startDate,
                            officeName: 'Main Office',
                            routeFrom: 'Salem',
                            routeTo: 'Vizag',
                            income: 85000,
                            loadingExpense: 0,
                            unloadingExpense: 0,
                            driverWages: 3500,
                            startingKM: trip.startingKM || 0,
                            endingKM: trip.endingKM || 0
                          };
                          shareSubTripWhatsAppStatement(trip, firstSub, 0);
                        }}
                        class="text-emerald-600 hover:text-emerald-700 text-xs font-extrabold flex items-center gap-1 bg-white border border-emerald-200 px-2 py-1 rounded-lg shadow-2xs"
                      >
                        <MessageSquare class="w-3 h-3" />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                );
              }}
            </For>
          </main>
        </>
      }>
        {/* Render Full-Screen Sub-Trip Page */}
        <MobileSubTripViewPage
          trip={activeSubTripView()!.trip}
          subTrip={activeSubTripView()!.subTrip}
          subTripIndex={activeSubTripView()!.subTripIndex}
          onBack={() => setActiveSubTripView(null)}
          onOpenAddExpense={() => {
            const current = activeSubTripView();
            if (current) {
              setExpenseModalTarget({
                subTrip: current.subTrip,
                subTripIndex: current.subTripIndex,
                tripId: current.trip.id
              });
            }
          }}
          onOpenPayment={() => {
            const current = activeSubTripView();
            if (current) {
              setPaymentModalTarget({
                subTrip: current.subTrip,
                subTripIndex: current.subTripIndex,
                tripId: current.trip.id
              });
            }
          }}
        />
      </Show>

      {/* Sub-Trip Add Expense Half-Height Modal */}
      <SubTripExpenseModal
        isOpen={expenseModalTarget() !== null}
        onClose={() => setExpenseModalTarget(null)}
        subTrip={expenseModalTarget()?.subTrip || null}
        subTripIndex={expenseModalTarget()?.subTripIndex || 0}
        onSaveExpense={handleSaveSubTripExpense}
      />

      {/* Register Payment Half-Height Modal */}
      <RegisterPaymentModal
        accounts={props.accounts}
        isOpen={paymentModalTarget() !== null}
        onClose={() => setPaymentModalTarget(null)}
        subTrip={paymentModalTarget()?.subTrip || null}
        subTripIndex={paymentModalTarget()?.subTripIndex || 0}
        onSavePayment={handleSavePayment}
      />

    </div>
  );
}
