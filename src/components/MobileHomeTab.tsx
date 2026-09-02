import { createMemo } from 'solid-js';
import { 
  Plus, 
  Mic, 
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  DollarSign
} from 'lucide-solid';
import { TripEntry, Truck as TruckType, Driver } from '../types';

interface MobileHomeTabProps {
  currentUser: any;
  orgTrips: TripEntry[];
  orgTrucks: TruckType[];
  orgDrivers: Driver[];
  setActiveTab: (tab: 'HOME' | 'TRIPS' | 'REGISTRY' | 'ACCOUNT') => void;
  onNavigateToSubTab: (tab: string) => void;
  onQuickAction: (action: 'ADD_TRIP' | 'ADD_EXPENSE' | 'VOICE') => void;
}

export default function MobileHomeTab(props: MobileHomeTabProps) {
  // SolidJS Rule 1 & 4: Use createMemo for derived reactive state
  const userName = createMemo(() => {
    const user = props.currentUser;
    return user?.name || user?.email?.split('@')[0] || 'User';
  });

  const runningTrips = createMemo(() => props.orgTrips.filter(t => t.status !== 'Settled'));
  const activeTripsCount = createMemo(() => runningTrips().length);
  const totalTrucksCount = createMemo(() => props.orgTrucks.length);

  // Calculated Monthly Net Profit using exact TripEntry properties
  const monthlyProfit = createMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return props.orgTrips.reduce((acc, t) => {
      const d = new Date(t.createdAt || t.startDate || '');
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const totalFreight = (t.subTrips || []).reduce((sum, st) => sum + Number(st.income || 0), 0);
        const commonExp = Number(t.dieselAmount || 0) + 
                          Number(t.rtoExpense || 0) + 
                          Number(t.fastagExpense || 0) + 
                          Number(t.addBlueExpense || 0) + 
                          Number(t.otherExpense || 0);
        const subExp = (t.subTrips || []).reduce((sum, st) => {
          return sum + Number(st.loadingExpense || 0) + 
                       Number(st.unloadingExpense || 0) + 
                       Number(st.brokerageExpense || 0) + 
                       Number(st.rmcExpense || 0);
        }, 0);
        
        return acc + (totalFreight - (commonExp + subExp));
      }
      return acc;
    }, 0);
  });

  // Calculate Receivables (Pending Freight Balances from Customers)
  const pendingReceivables = createMemo(() => {
    return props.orgTrips.reduce((acc, t) => {
      if (t.status !== 'Settled') {
        const totalFreight = (t.subTrips || []).reduce((sum, st) => sum + Number(st.income || 0), 0);
        const totalPaid = (t.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
        return acc + Math.max(0, totalFreight - totalPaid);
      }
      return acc;
    }, 0);
  });

  // Expiring Documents Alert Count (Tax, Fitness, Insurance expiring in <= 30 days)
  const expiringDocsCount = createMemo(() => {
    const today = new Date().getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    let count = 0;
    props.orgTrucks.forEach(tr => {
      ['fcDate', 'insuranceDate', 'qTaxDate', 'greenTaxDate', 'npTaxDate'].forEach(field => {
        const val = (tr as any)[field];
        if (val) {
          const expTime = new Date(val).getTime();
          if (expTime - today <= thirtyDaysMs) {
            count++;
          }
        }
      });
    });
    return count;
  });

  return (
    <div class="flex flex-col gap-4 pb-20 bg-slate-50 min-h-screen text-slate-900 px-4 pt-2">
      {/* 1. Greeting & Subtitle */}
      <div class="flex flex-col gap-0.5">
        <h2 class="text-xl font-extrabold tracking-tight text-slate-900">
          Good afternoon, {userName()} 👋
        </h2>
        <p class="text-xs font-semibold text-slate-500">
          {totalTrucksCount()} Fleet Trucks • {activeTripsCount()} Trips Currently In-Transit
        </p>
      </div>

      {/* 2. Clean 2x2 Utility KPI Grid */}
      <div class="grid grid-cols-2 gap-2.5">
        {/* Active Trips Card */}
        <div 
          onClick={() => props.setActiveTab('TRIPS')}
          class="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-xs active:bg-slate-100 cursor-pointer"
        >
          <div class="flex justify-between items-center">
            <span class="text-xs font-semibold text-slate-500">Active Trips</span>
            <span class="bg-sky-100 text-sky-700 text-[10px] font-bold px-1.5 py-0.5 rounded">In-Transit</span>
          </div>
          <div class="text-lg font-black text-slate-900">{activeTripsCount()} Trips</div>
          <span class="text-[10px] font-semibold text-slate-400">Tap to view trips ›</span>
        </div>

        {/* This Month Profit Card */}
        <div 
          onClick={() => props.onNavigateToSubTab('MONTHLY_REPORT')}
          class="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-xs active:bg-slate-100 cursor-pointer"
        >
          <div class="flex justify-between items-center">
            <span class="text-xs font-semibold text-slate-500">This Month Profit</span>
            <TrendingUp class="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div class="text-lg font-black text-emerald-600">
            +₹{monthlyProfit().toLocaleString('en-IN')}
          </div>
          <span class="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded self-start">
            Current Month P&L
          </span>
        </div>

        {/* Customer Receivables Card */}
        <div 
          onClick={() => props.onNavigateToSubTab('OUTSTANDING')}
          class="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-xs active:bg-slate-100 cursor-pointer"
        >
          <div class="flex justify-between items-center">
            <span class="text-xs font-semibold text-slate-500">Receivables</span>
            <DollarSign class="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div class="text-lg font-black text-amber-600">
            ₹{pendingReceivables().toLocaleString('en-IN')}
          </div>
          <span class="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded self-start">
            Pending Freight
          </span>
        </div>

        {/* Document Alerts Card */}
        <div 
          onClick={() => props.setActiveTab('REGISTRY')}
          class="bg-white border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-xs active:bg-slate-100 cursor-pointer"
        >
          <div class="flex justify-between items-center">
            <span class="text-xs font-semibold text-slate-500">Document Alerts</span>
            <AlertTriangle class="w-3.5 h-3.5 text-red-600" />
          </div>
          <div class="text-lg font-black text-slate-900">{expiringDocsCount()} Alerts</div>
          <span class="text-[10px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded self-start">
            {expiringDocsCount() > 0 ? 'Tax & Fitness Due' : 'All Docs Clean'}
          </span>
        </div>
      </div>

      {/* 3. Floating Quick Action Pills Bar */}
      <div class="flex gap-2 items-center pt-1">
        {/* Primary Dispatch Trip CTA */}
        <button
          onClick={() => props.onQuickAction('ADD_TRIP')}
          class="flex-1.3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
        >
          <Plus class="w-4 h-4 stroke-[3]" />
          <span>+ Dispatch Trip</span>
        </button>

        {/* Add Expense Button */}
        <button
          onClick={() => props.onQuickAction('ADD_EXPENSE')}
          class="flex-1 bg-white border border-slate-300 text-slate-800 font-bold text-xs py-3 px-2 rounded-xl flex items-center justify-center gap-1 shadow-2xs active:bg-slate-100 transition-all"
        >
          <Plus class="w-3.5 h-3.5 text-slate-600" />
          <span>Expense</span>
        </button>

        {/* AI Voice Entry Button */}
        <button
          onClick={() => props.onQuickAction('VOICE')}
          class="flex-1 bg-white border border-slate-300 text-slate-800 font-bold text-xs py-3 px-2 rounded-xl flex items-center justify-center gap-1 shadow-2xs active:bg-slate-100 transition-all"
        >
          <Mic class="w-3.5 h-3.5 text-emerald-600" />
          <span>Voice</span>
        </button>
      </div>

      {/* 4. Live Active Fleet Section */}
      <div class="flex flex-col gap-2 pt-2">
        <div class="flex justify-between items-center">
          <h3 class="text-sm font-bold text-slate-900">Live Active Fleet</h3>
          <button 
            onClick={() => props.setActiveTab('REGISTRY')} 
            class="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-0.5"
          >
            <span>View All ({totalTrucksCount()})</span>
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Fleet List Cards */}
        <div class="flex flex-col gap-2">
          {props.orgTrucks.length === 0 ? (
            <div class="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500 text-xs font-semibold">
              No trucks registered in fleet yet. Tap "+ Dispatch Trip" or go to Trucks to register.
            </div>
          ) : (
            props.orgTrucks.slice(0, 4).map((truck) => {
              const activeTrip = props.orgTrips.find(
                t => t.truckNo === truck.truckNo && t.status !== 'Settled'
              );
              const firstSubTrip = activeTrip?.subTrips?.[0];

              return (
                <div 
                  onClick={() => {
                    if (activeTrip) {
                      props.setActiveTab('TRIPS');
                    } else {
                      props.onQuickAction('ADD_TRIP');
                    }
                  }}
                  class="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-2 shadow-2xs active:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div class="flex justify-between items-start">
                    <div class="flex flex-col">
                      <span class="font-extrabold text-sm text-slate-900 tracking-tight">
                        {truck.truckNo}
                      </span>
                      <span class="text-[11px] font-semibold text-slate-500">
                        {truck.type || '10-Wheeler'} {truck.make || 'Truck'} • Driver: {activeTrip?.driverName || 'Unassigned'}
                      </span>
                    </div>

                    <span class={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeTrip ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {activeTrip ? 'In-Transit' : 'Available'}
                    </span>
                  </div>

                  {/* Route & Progress Info */}
                  {activeTrip ? (
                    <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-xs font-bold text-slate-700">
                      <div class="flex items-center gap-1.5 text-slate-800">
                        <span class="text-slate-400">📍</span>
                        <span>{firstSubTrip?.routeFrom || 'Origin'}</span>
                        <span class="text-slate-400">➔</span>
                        <span>{firstSubTrip?.routeTo || 'Destination'}</span>
                      </div>

                      <span class="text-[11px] font-bold text-emerald-600">
                        Freight: ₹{Number(firstSubTrip?.income || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ) : (
                    <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] font-semibold text-slate-400">
                      <span>Ready for new booking</span>
                      <span class="text-emerald-600 font-bold hover:underline">+ Book Trip ›</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
