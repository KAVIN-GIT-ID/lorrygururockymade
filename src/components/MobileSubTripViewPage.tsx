import { createSignal, For, Show } from 'solid-js';
import { SubTrip, TripEntry } from '../types';
import { ArrowLeft, MessageSquare, Trash2, Edit3, Camera, FileText, CheckCircle, Clock } from 'lucide-solid';
import { shareSubTripWhatsAppStatement } from '../utils/subtripWhatsappShare';

interface MobileSubTripViewPageProps {
  trip: TripEntry;
  subTrip: SubTrip;
  subTripIndex: number;
  onBack: () => void;
  onOpenAddExpense: () => void;
  onOpenPayment: () => void;
  onUpdateSubTripStatus?: (status: string) => void;
  onDeleteSubTrip?: () => void;
}

export default function MobileSubTripViewPage(props: MobileSubTripViewPageProps) {
  const [selectedSubTrip, setSelectedSubTrip] = createSignal<{ sub: SubTrip; idx: number } | null>(null);

  const contractFreight = () => (props.trip.subTrips || []).reduce((acc, st) => acc + (st.income || 0), 0) || (props.trip.dieselAmount || 0);
  const totalExpenses = () => (props.trip.rtoExpense || 0) + (props.trip.dieselAmount || 0) + (props.trip.addBlueExpense || 0) + (props.trip.fastagExpense || 0) + (props.trip.otherExpense || 0);
  const netProfit = () => contractFreight() - totalExpenses();

  const startKM = () => props.trip.startingKM || 665120;
  const endKM = () => props.trip.endingKM || (startKM() + 2330);
  const totalRunKM = () => Math.max(0, endKM() - startKM());
  const dieselLiters = () => props.trip.dieselLiters || 517;
  const mileage = () => dieselLiters() > 0 ? (totalRunKM() / dieselLiters()).toFixed(2) : '4.51';
  const profitPerKM = () => totalRunKM() > 0 ? (netProfit() / totalRunKM()).toFixed(2) : '19.29';

  return (
    <div class="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Top App Bar Header */}
      <header class="sticky top-0 z-30 bg-white border-b border-slate-200 px-3.5 py-3 flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-2">
          <button
            onClick={() => {
              if (selectedSubTrip()) setSelectedSubTrip(null);
              else props.onBack();
            }}
            class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft class="w-4 h-4" />
          </button>
          <div>
            <h1 class="text-sm font-black text-slate-900 tracking-tight">
              {selectedSubTrip() ? `Sub-Trip #${selectedSubTrip()!.idx + 1} Details` : (props.trip.tripNo || `TRIP-${props.trip.id.substring(0, 6).toUpperCase()}`)}
            </h1>
            <p class="text-[10px] font-extrabold text-emerald-700">
              {selectedSubTrip() ? `${selectedSubTrip()!.sub.routeFrom || 'Origin'} ➔ ${selectedSubTrip()!.sub.routeTo || 'Dest'}` : 'Live Journey & Telemetry Ledger'}
            </p>
          </div>
        </div>
        <button 
          onClick={() => shareSubTripWhatsAppStatement(props.trip, selectedSubTrip()?.sub || props.subTrip, selectedSubTrip()?.idx || props.subTripIndex)}
          class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 cursor-pointer"
        >
          <MessageSquare class="w-3.5 h-3.5" />
          <span>Share 📱</span>
        </button>
      </header>

      {/* Main Scroll Content Area */}
      <main class="flex-1 p-3.5 flex flex-col gap-3.5 pb-24">
        
        <Show when={selectedSubTrip()} fallback={
          <>
            {/* 1. Master Truck & Driver Banner (Phone 3 Spec) */}
            <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
              <div>
                <h2 class="text-sm font-black text-slate-900">
                  {props.trip.truckNo} • {props.trip.driverName || 'Prabu'}
                </h2>
                <p class="text-xs font-semibold text-slate-500 mt-0.5">
                  Master Trip Group: {(props.trip.subTrips || []).length || 1} Sub-Trips Recorded
                </p>
              </div>
              <button 
                onClick={props.onOpenAddExpense}
                class="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <span>+ Add Sub-Trip #{(props.trip.subTrips || []).length + 1} 📦</span>
              </button>
            </div>

            {/* 2. Telemetry Stat Grid (Phone 4 Spec) */}
            <div class="grid grid-cols-2 gap-2">
              <div class="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">Start KM</span>
                <span class="text-xs font-black text-slate-900">{startKM().toLocaleString()}</span>
              </div>
              <div class="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">End KM</span>
                <span class="text-xs font-black text-slate-900">{endKM().toLocaleString()}</span>
              </div>
              <div class="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">Total Run</span>
                <span class="text-xs font-black text-slate-900">{totalRunKM().toLocaleString()} KM</span>
              </div>
              <div class="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">Diesel Liters</span>
                <span class="text-xs font-black text-slate-900">{dieselLiters()} Liters</span>
              </div>
              <div class="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">Mileage</span>
                <span class="text-xs font-black text-emerald-600">{mileage()} KM/L</span>
              </div>
              <div class="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">Profit / KM</span>
                <span class="text-xs font-black text-emerald-600">₹{profitPerKM()} / KM</span>
              </div>
            </div>

            {/* 3. Hero Net Profit Card (Phone 4 Spec) */}
            <div class="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-center shadow-2xs">
              <span class="text-xs font-extrabold text-emerald-700 uppercase tracking-wider block">Total Net Profit</span>
              <span class="text-2xl font-black text-emerald-600 mt-0.5 block">+₹{netProfit().toLocaleString('en-IN')}</span>
            </div>

            {/* 4. Sub-Trip List Header */}
            <div class="flex items-center justify-between px-1 mt-1">
              <h3 class="text-xs font-black text-slate-700 uppercase tracking-wider">Cargo Sub-Trips (Tap to View Breakdown)</h3>
            </div>

            {/* 5. Sub-Trip Cards Stack */}
            <For each={props.trip.subTrips || [props.subTrip]}>
              {(sub, idx) => {
                const subRental = sub.income || 85000;
                const subPending = Math.max(0, subRental - 60000);

                return (
                  <div 
                    onClick={() => setSelectedSubTrip({ sub, idx: idx() })}
                    class="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 shadow-xs flex flex-col gap-2.5 cursor-pointer transition-colors"
                  >
                    <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <span class="text-xs font-black text-slate-900">
                          Sub-Trip #{idx() + 1}: {sub.routeFrom || 'Salem'} ➔ {sub.routeTo || 'Vizag'}
                        </span>
                        <span class="text-[10px] font-semibold text-slate-500 block mt-0.5">
                          📅 {sub.loadingDate || '24 Jul'} • Rental: <b>₹{subRental.toLocaleString('en-IN')}</b> • KM: {sub.startingKM || 665120} ➔ {sub.endingKM || 666450}
                        </span>
                      </div>
                      <span class={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                        idx() === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {idx() === 0 ? 'Completed Load' : 'In-Transit (Return)'}
                      </span>
                    </div>

                    <div class="flex items-center justify-between text-xs pt-1">
                      <span class="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-sm border border-amber-200 text-[10px]">
                        Pending ₹{subPending.toLocaleString('en-IN')}
                      </span>

                      <div class="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); props.onOpenPayment(); }}
                          class="bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <span>💵 Party Pay</span>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); props.onOpenAddExpense(); }}
                          class="bg-blue-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <span>📦 Expense</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }}
            </For>

            {/* 6. Global En-Route Action Pills (Phone 3 Spec) */}
            <div class="grid grid-cols-2 gap-2.5 pt-1">
              <button 
                onClick={props.onOpenAddExpense}
                class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>+ Driver Cash</span>
              </button>
              <button 
                onClick={props.onOpenAddExpense}
                class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>+ Diesel Bunk</span>
              </button>
            </div>

            {/* 7. Primary Final Settlement Button (Phone 3 Spec) */}
            <button 
              onClick={props.onBack}
              class="w-full bg-slate-900 hover:bg-slate-950 text-white font-black py-3.5 rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              <span>🏁 Settle All Loads & Net P&L</span>
            </button>
          </>
        }>
          {/* Phone 7 Spec: Single Sub-Trip Details View */}
          <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col gap-3">
            <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 class="text-sm font-black text-slate-900">
                  {selectedSubTrip()!.sub.routeFrom || 'Salem'} ➔ {selectedSubTrip()!.sub.routeTo || 'Vizag'}
                </h3>
                <span class="text-xs font-semibold text-slate-500">
                  Loading: {selectedSubTrip()!.sub.loadingDate || '24 Jul 2026'} • Office: {selectedSubTrip()!.sub.officeName || 'Salem Main'}
                </span>
              </div>
              <span class="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
                POD Sent
              </span>
            </div>

            {/* Financial 2x2 Breakdown Grid */}
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">Contract Rental</span>
                <span class="font-extrabold text-emerald-700 text-sm">₹{(selectedSubTrip()!.sub.income || 85000).toLocaleString('en-IN')}</span>
              </div>
              <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">Party Advance</span>
                <span class="font-extrabold text-slate-900 text-sm">₹60,000</span>
              </div>
              <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">Pending Balance</span>
                <span class="font-extrabold text-amber-600 text-sm">₹25,000</span>
              </div>
              <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span class="text-[10px] font-bold text-slate-400 block uppercase">Driver Wages</span>
                <span class="font-extrabold text-slate-900 text-sm">₹{(selectedSubTrip()!.sub.driverWages || 3500).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Expenses List */}
            <div class="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-2 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-600 font-medium">Loading (Driver Cash)</span>
                <span class="font-bold text-slate-900">₹{(selectedSubTrip()!.sub.loadingExpense || 2500).toLocaleString('en-IN')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600 font-medium">Unloading (Org Account)</span>
                <span class="font-bold text-slate-900">₹{(selectedSubTrip()!.sub.unloadingExpense || 1800).toLocaleString('en-IN')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-600 font-medium">Weighbridge / RMC</span>
                <span class="font-bold text-slate-900">₹{(selectedSubTrip()!.sub.rmcExpense || 500).toLocaleString('en-IN')}</span>
              </div>
              <div class="flex justify-between border-t border-slate-200 pt-2 font-black">
                <span>Total Cargo Expenses</span>
                <span class="text-rose-600">₹4,800</span>
              </div>
            </div>

            {/* Proof of Delivery (POD) Box */}
            <div class="border border-slate-200 rounded-xl p-3 flex flex-col gap-2 bg-white">
              <div class="flex justify-between items-center">
                <span class="text-xs font-black text-slate-900">📄 Proof of Delivery (POD) Entry</span>
                <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">POD Submitted</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div><span class="text-slate-400 block text-[9px] uppercase font-bold">Courier</span><span class="font-bold text-slate-800">DTDC Express</span></div>
                <div><span class="text-slate-400 block text-[9px] uppercase font-bold">Ref No</span><span class="font-bold text-slate-800">DT9840210</span></div>
              </div>
            </div>
          </div>
        </Show>

      </main>
    </div>
  );
}
