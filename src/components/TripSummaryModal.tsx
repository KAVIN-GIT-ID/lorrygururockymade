import { createSignal, createMemo, Show } from 'solid-js';
import { TripEntry, Account, OrganizationProfile, TripAdvance, getTripMetrics, calculateBalance } from '../types';
import { generateTripPDF, generateDriverReportPDF } from '../utils/tripPdfGenerator';
import { 
  X, 
  Printer, 
  FileText, 
  Edit2, 
  Trash2, 
  Truck, 
  User, 
  Calendar, 
  Clock, 
  MapPin, 
  TrendingUp, 
  DollarSign, 
  Receipt, 
  Coins, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ListCollapse, 
  Fuel, 
  ArrowRightLeft, 
  Building2, 
  FileCheck, 
  History, 
  ChevronRight 
} from 'lucide-solid';
import { useLanguage } from '../context/LanguageContext';

interface TripSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripEntry;
  accounts: Account[];
  trips: TripEntry[];
  orgProfile: OrganizationProfile | null;
  onEditEntry?: (entry: TripEntry) => void;
  onDeleteEntry?: (id: string) => void;
  onSaveTrips?: (newTrips: TripEntry[]) => void;
  canEditTrips?: boolean;
  canDeleteTrips?: boolean;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
  setPreviewHtml?: (html: string) => void;
  setPreviewTitle?: (title: string) => void;
}

export function TripSummaryModal(props: TripSummaryModalProps) {
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = createSignal<'overview' | 'financial' | 'cargo' | 'driver' | 'expenses' | 'outstanding' | 'audit'>('overview');
  const [selectedFwdMode, setSelectedFwdMode] = createSignal<'trip' | 'account'>('trip');
  const [selectedFwdTripId, setSelectedFwdTripId] = createSignal('');
  const [selectedFwdAccountId, setSelectedFwdAccountId] = createSignal('');
  const [selectedFwdDate, setSelectedFwdDate] = createSignal(new Date().toISOString().substring(0, 10));

  const trip = createMemo(() => props.trip);
  const accounts = createMemo(() => props.accounts || []);
  const activeAccounts = createMemo(() => accounts().filter(a => a.status === 'Active'));
  const orgProfile = createMemo(() => props.orgProfile || null);
  const allTrips = createMemo(() => props.trips || []);

  const metrics = createMemo(() => getTripMetrics(trip()));
  const driverBalance = createMemo(() => metrics().driverBalance);

  const subTrips = createMemo(() => trip().subTrips || []);
  const advances = createMemo(() => trip().advances || []);
  const payments = createMemo(() => trip().payments || []);
  const fuels = createMemo(() => trip().fuels || []);

  // Compute duration in days
  const durationDays = createMemo(() => {
    if (!trip().startDate || !trip().endDate) return 1;
    const start = new Date(trip().startDate).getTime();
    const end = new Date(trip().endDate).getTime();
    const diff = Math.ceil((end - start) / (1000 * 3600 * 24));
    return diff > 0 ? diff : 1;
  });

  // Profit margin percentage
  const marginPercentage = createMemo(() => {
    const m = metrics();
    if (m.income <= 0) return 0;
    return Math.round((m.profit / m.income) * 100);
  });

  // Primary route display
  const primaryRoute = createMemo(() => {
    const sts = subTrips();
    if (sts.length === 0) return 'No Route Data';
    if (sts.length === 1) return `${sts[0].routeFrom || 'Origin'} ➔ ${sts[0].routeTo || 'Destination'}`;
    return `${sts[0].routeFrom || 'Origin'} ➔ ${sts[sts.length - 1].routeTo || 'Destination'} (${sts.length} Segments)`;
  });

  // Carry forward eligible trips
  const eligibleFwdTrips = createMemo(() => {
    return allTrips()
      .filter(t => t.id !== trip().id && t.status !== 'Settled')
      .sort((a, b) => {
        const aSame = a.driverName?.toLowerCase().trim() === trip().driverName?.toLowerCase().trim();
        const bSame = b.driverName?.toLowerCase().trim() === trip().driverName?.toLowerCase().trim();
        if (aSame && !bSame) return -1;
        if (!aSame && bSame) return 1;
        return a.tripNo.localeCompare(b.tripNo);
      });
  });

  const hasSameDriverActiveTrip = createMemo(() => {
    return eligibleFwdTrips().some(
      t => t.driverName?.toLowerCase().trim() === trip().driverName?.toLowerCase().trim()
    );
  });

  return (
    <Show when={props.isOpen && props.trip}>
      <div 
        onClick={props.onClose}
        class="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in font-sans"
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          class="bg-slate-50 border border-slate-200 rounded-3xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up"
        >
          
          {/* HEADER STRIP */}
          <div class="bg-white px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30 shrink-0">
                <Truck class="w-5 h-5" />
              </div>
              <div>
                <div class="flex items-center gap-2.5">
                  <h3 class="text-xl font-black text-slate-900 font-mono tracking-wide">{trip().tripNo}</h3>
                  <span class={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    trip().status === 'Settled'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : trip().status === 'Completed'
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {trip().status || 'Active'}
                  </span>
                </div>
                <p class="text-xs text-slate-500 font-medium">
                  Created on {trip().createdAt ? new Date(trip().createdAt!).toLocaleDateString('en-IN') : 'N/A'} &bull; Truck: <strong class="text-slate-800 font-bold">{trip().truckNo}</strong>
                </p>
              </div>
            </div>

            {/* ACTION BUTTONS HEADER */}
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              {props.setPreviewHtml && (
                <button
                  type="button"
                  onClick={() => {
                    const html = generateTripPDF(trip(), accounts(), orgProfile());
                    props.setPreviewHtml!(html);
                    if (props.setPreviewTitle) props.setPreviewTitle(`Trip Report - ${trip().tripNo}`);
                  }}
                  class="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-250 shadow-2xs transition cursor-pointer"
                >
                  <Printer class="w-4 h-4 text-slate-500" />
                  Print PDF
                </button>
              )}
              {props.setPreviewHtml && (
                <button
                  type="button"
                  onClick={() => {
                    const html = generateDriverReportPDF(trip(), accounts(), orgProfile());
                    props.setPreviewHtml!(html);
                    if (props.setPreviewTitle) props.setPreviewTitle(`Driver Settlement - ${trip().tripNo}`);
                  }}
                  class="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-250 shadow-2xs transition cursor-pointer"
                >
                  <FileText class="w-4 h-4 text-blue-600" />
                  Driver Report
                </button>
              )}
              {props.canEditTrips && props.onEditEntry && trip().status !== 'Deleted' && (
                <button
                  type="button"
                  onClick={() => {
                    props.onEditEntry!(trip());
                    props.onClose();
                  }}
                  class="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  <Edit2 class="w-4 h-4" />
                  Edit Trip
                </button>
              )}
              {props.canDeleteTrips && props.onDeleteEntry && trip().status !== 'Deleted' && (
                <button
                  type="button"
                  onClick={() => {
                    const msg = `Caution! Deleting Master Trip ${trip().tripNo} will permanently delete all sub-trip segments. Continue?`;
                    if (props.confirmAction) {
                      props.confirmAction(msg, () => {
                        props.onDeleteEntry!(trip().id);
                        props.onClose();
                      }, "Delete Master Trip Journey");
                    } else if (confirm(msg)) {
                      props.onDeleteEntry!(trip().id);
                      props.onClose();
                    }
                  }}
                  class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer"
                  title="Delete Trip"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={props.onClose}
                class="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer ml-1"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* TOP KPI STAT CARDS STRIP */}
          <div class="px-6 py-3.5 bg-white border-b border-slate-200 grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
            {/* INCOME GENERATED */}
            <div class="bg-emerald-50/70 border border-emerald-200/80 p-3 rounded-2xl flex items-center justify-between">
              <div>
                <span class="text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 block">Income Generated</span>
                <span class="text-base font-black text-emerald-900 font-mono">₹{metrics().income.toLocaleString('en-IN')}</span>
              </div>
              <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Coins class="w-4 h-4" />
              </div>
            </div>

            {/* OPERATIONAL COSTS */}
            <div class="bg-rose-50/70 border border-rose-200/80 p-3 rounded-2xl flex items-center justify-between">
              <div>
                <span class="text-[9px] font-extrabold uppercase tracking-wider text-rose-800 block">Operational Costs</span>
                <span class="text-base font-black text-rose-900 font-mono">₹{metrics().totalExpense.toLocaleString('en-IN')}</span>
              </div>
              <div class="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <TrendingUp class="w-4 h-4" />
              </div>
            </div>

            {/* NET PROFIT MARGIN */}
            <div class="bg-blue-50/70 border border-blue-200/80 p-3 rounded-2xl flex items-center justify-between">
              <div>
                <span class="text-[9px] font-extrabold uppercase tracking-wider text-blue-800 block">Net Profit Margin</span>
                <div class="flex items-baseline gap-1.5">
                  <span class={`text-base font-black font-mono ${metrics().profit >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>
                    ₹{metrics().profit.toLocaleString('en-IN')}
                  </span>
                  <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded-md">
                    {marginPercentage()}%
                  </span>
                </div>
              </div>
              <div class="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <DollarSign class="w-4 h-4" />
              </div>
            </div>

            {/* TOTAL OUTSTANDING */}
            <div class="bg-amber-50/70 border border-amber-200/80 p-3 rounded-2xl flex items-center justify-between">
              <div>
                <span class="text-[9px] font-extrabold uppercase tracking-wider text-amber-800 block">Total Outstanding</span>
                <span class="text-base font-black text-amber-900 font-mono">₹{metrics().outstandingBalance.toLocaleString('en-IN')}</span>
              </div>
              <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Receipt class="w-4 h-4" />
              </div>
            </div>

            {/* TRIP STATUS BADGE */}
            <div class="bg-slate-100 border border-slate-250 p-3 rounded-2xl flex items-center justify-between col-span-2 md:col-span-1">
              <div>
                <span class="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block">Driver Balance</span>
                <span class={`text-sm font-extrabold font-mono ${driverBalance() > 0 ? 'text-amber-700' : driverBalance() < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {driverBalance() > 0 ? `Pay ₹${driverBalance().toLocaleString()}` : driverBalance() < 0 ? `Due ₹${Math.abs(driverBalance()).toLocaleString()}` : 'Fully Settled'}
                </span>
              </div>
              <div class="w-8 h-8 rounded-xl bg-white text-slate-600 flex items-center justify-center shrink-0 shadow-2xs">
                <Clock class="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* MAIN BODY AREA WITH LEFT NAVIGATION AND RIGHT STICKY SUMMARY */}
          <div class="flex-1 flex flex-col md:flex-row overflow-hidden">

            {/* LEFT TAB NAVIGATION SIDEBAR (w-60) */}
            <div class="w-full md:w-60 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-4 shrink-0 overflow-y-auto space-y-3">
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block px-2">Navigation Views</span>

              <div class="space-y-1">
                {[
                  { id: 'overview', label: 'Trip Overview', icon: Truck },
                  { id: 'financial', label: 'Financial Summary', icon: Coins },
                  { id: 'cargo', label: 'Cargo & Loads', icon: ListCollapse, count: subTrips().length },
                  { id: 'driver', label: 'Driver Settlement', icon: User },
                  { id: 'expenses', label: 'Operational Expenses', icon: Fuel },
                  { id: 'outstanding', label: 'Outstanding & Collections', icon: Receipt },
                  { id: 'audit', label: 'Audit Trail', icon: History }
                ].map(item => {
                  const isActive = () => activeTab() === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      onClick={() => setActiveTab(item.id as any)}
                      class={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition text-xs font-bold cursor-pointer ${
                        isActive()
                          ? 'bg-blue-50 text-blue-700 shadow-3xs border border-blue-200/80 font-extrabold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div class="flex items-center gap-2.5">
                        <Icon class={`w-4 h-4 ${isActive() ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.count !== undefined && (
                        <span class={`px-1.5 py-0.5 rounded-md text-[10px] ${isActive() ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* NEED HELP BOX */}
              <div class="pt-4 border-t border-slate-100">
                <div class="bg-gradient-to-br from-blue-50/80 to-indigo-50/40 border border-blue-100 p-3.5 rounded-2xl space-y-2">
                  <div class="flex items-center gap-2 text-blue-800 font-bold text-xs">
                    <HelpCircle class="w-4 h-4 text-blue-600" />
                    Need Support?
                  </div>
                  <p class="text-[11px] text-slate-600 leading-relaxed font-medium">
                    Questions regarding trip calculation or driver settlement? Reach out to company admin.
                  </p>
                </div>
              </div>
            </div>

            {/* CENTER MAIN CONTENT CANVAS (FLEX-1) */}
            <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/60">

              {/* TAB 1: TRIP OVERVIEW */}
              <Show when={activeTab() === 'overview'}>
                <div class="space-y-6 animate-fade-in">
                  
                  {/* BENTO CARD: TRIP OVERVIEW DETAILS */}
                  <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-3xs">
                    <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Truck class="w-4 h-4 text-blue-600" />
                      <h4 class="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Trip Overview</h4>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
                      <div class="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Trip ID (Group Code)</span>
                        <span class="font-mono font-bold text-slate-900 text-xs block mt-0.5">{trip().tripNo}</span>
                      </div>
                      <div class="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Vehicle & Number</span>
                        <span class="font-bold text-slate-900 text-xs block mt-0.5">{trip().truckNo}</span>
                      </div>
                      <div class="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Driver Operator</span>
                        <span class="font-bold text-slate-900 text-xs block mt-0.5">{trip().driverName || 'No Driver'}</span>
                      </div>
                      <div class="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Trip Type</span>
                        <span class="font-bold text-slate-900 text-xs block mt-0.5">{subTrips().length > 1 ? 'Multi-Segment Run' : 'Full Single Load'}</span>
                      </div>

                      <div class="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Journey Start Date</span>
                        <span class="font-mono font-bold text-slate-800 text-xs block mt-0.5">{trip().startDate || 'N/A'}</span>
                      </div>
                      <div class="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Journey End Date</span>
                        <span class="font-mono font-bold text-slate-800 text-xs block mt-0.5">{trip().endDate || 'N/A'}</span>
                      </div>
                      <div class="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Duration Logged</span>
                        <span class="font-bold text-slate-800 text-xs block mt-0.5">{durationDays()} Transport Days</span>
                      </div>
                      <div class="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Distance Logged</span>
                        <span class="font-mono font-bold text-blue-600 text-xs block mt-0.5">{metrics().totalKM} KM</span>
                      </div>

                      <div class="bg-slate-50 p-3 rounded-xl border border-slate-150 col-span-2">
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Primary Route Path</span>
                        <span class="font-bold text-slate-900 text-xs block mt-0.5">{primaryRoute()}</span>
                      </div>
                      <div class="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Fuel Mileage</span>
                        <span class="font-mono font-bold text-amber-700 text-xs block mt-0.5">{metrics().fuelLiters > 0 ? `${metrics().millage.toFixed(2)} KM/L` : '0.00 KM/L'}</span>
                      </div>
                      <div class="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Cost Per KM</span>
                        <span class="font-mono font-bold text-slate-800 text-xs block mt-0.5">₹{metrics().perKM.toFixed(2)} / KM</span>
                      </div>
                    </div>
                  </div>

                  {/* CARGO & DRIVER BENTO ROW */}
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* CARGO & LOADS PREVIEW CARD */}
                    <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-3xs">
                      <div class="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div class="flex items-center gap-2">
                          <ListCollapse class="w-4 h-4 text-emerald-600" />
                          <h4 class="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Cargo & Loads ({subTrips().length})</h4>
                        </div>
                        <button type="button" onClick={() => setActiveTab('cargo')} class="text-xs text-blue-600 font-bold hover:underline">View All</button>
                      </div>

                      {subTrips().length > 0 ? (
                        <div class="space-y-3">
                          {subTrips().slice(0, 2).map((st, idx) => (
                            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
                              <div class="flex justify-between items-center">
                                <span class="font-extrabold text-slate-900 text-xs">Segment #{idx + 1}: {st.routeFrom} ➔ {st.routeTo}</span>
                                <span class="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-bold">{st.officeName}</span>
                              </div>
                              <div class="grid grid-cols-3 gap-2 text-slate-600 text-[11px]">
                                <div>
                                  <span class="text-slate-400 block text-[9px] uppercase font-bold">Material</span>
                                  <span class="font-bold text-slate-800">{st.material || 'General Freight'}</span>
                                </div>
                                <div>
                                  <span class="text-slate-400 block text-[9px] uppercase font-bold">Weight / Tons</span>
                                  <span class="font-bold text-slate-800">{st.noOfTons || 0} Tons</span>
                                </div>
                                <div class="text-right">
                                  <span class="text-slate-400 block text-[9px] uppercase font-bold">Income</span>
                                  <span class="font-mono font-black text-emerald-700">₹{(st.income || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p class="text-xs text-slate-400 italic text-center py-6">No cargo segments logged for this trip.</p>
                      )}
                    </div>

                    {/* DRIVER SETTLEMENT PREVIEW CARD */}
                    <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-3xs">
                      <div class="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div class="flex items-center gap-2">
                          <User class="w-4 h-4 text-indigo-600" />
                          <h4 class="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Driver Settlement</h4>
                        </div>
                        <button type="button" onClick={() => setActiveTab('driver')} class="text-xs text-blue-600 font-bold hover:underline">Full Details</button>
                      </div>

                      <div class="grid grid-cols-2 gap-3 text-xs">
                        <div class="bg-amber-50/60 border border-amber-200 p-3 rounded-xl">
                          <span class="text-[9px] font-extrabold uppercase text-amber-800 block">Total Advances Issued</span>
                          <span class="text-base font-black text-amber-900 font-mono block mt-1">₹{metrics().totalIssuedToDriver.toLocaleString()}</span>
                        </div>
                        <div class={`border p-3 rounded-xl ${driverBalance() >= 0 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
                          <span class="text-[9px] font-extrabold uppercase block text-slate-700">Driver Net Balance</span>
                          <span class={`text-base font-black font-mono block mt-1 ${driverBalance() >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                            {driverBalance() >= 0 ? `Payable ₹${driverBalance().toLocaleString()}` : `Due ₹${Math.abs(driverBalance()).toLocaleString()}`}
                          </span>
                        </div>
                      </div>

                      <div class="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                        <div class="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span class="text-[9px] text-slate-400 font-bold uppercase block">Driver Wages</span>
                          <span class="font-mono font-bold text-slate-800">₹{metrics().driverWages.toLocaleString()}</span>
                        </div>
                        <div class="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span class="text-[9px] text-slate-400 font-bold uppercase block">Driver Spend</span>
                          <span class="font-mono font-bold text-slate-800">₹{metrics().totalDriverSpend.toLocaleString()}</span>
                        </div>
                        <div class="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span class="text-[9px] text-slate-400 font-bold uppercase block">Driver Recovery</span>
                          <span class="font-mono font-bold text-slate-800">₹{metrics().driverRecovery.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </Show>

              {/* TAB 2: FINANCIAL SUMMARY */}
              <Show when={activeTab() === 'financial'}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-3xs animate-fade-in">
                  <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Coins class="w-4 h-4 text-emerald-600" />
                    <h4 class="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Complete Financial Ledger Specs</h4>
                  </div>

                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span class="text-[9px] font-sans font-bold text-slate-450 uppercase block">1. Total Freight Income</span>
                      <span class="font-black text-emerald-700 text-sm">₹{metrics().income.toLocaleString()}</span>
                    </div>
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span class="text-[9px] font-sans font-bold text-slate-450 uppercase block">2. Total Trip Expenses</span>
                      <span class="font-black text-rose-600 text-sm">₹{metrics().totalExpense.toLocaleString()}</span>
                    </div>
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span class="text-[9px] font-sans font-bold text-slate-450 uppercase block">3. Net Revenue Margin</span>
                      <span class="font-black text-blue-700 text-sm">₹{metrics().profit.toLocaleString()} ({marginPercentage()}%)</span>
                    </div>
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span class="text-[9px] font-sans font-bold text-slate-450 uppercase block">4. Outstanding Receivables</span>
                      <span class="font-black text-amber-700 text-sm">₹{metrics().outstandingBalance.toLocaleString()}</span>
                    </div>

                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span class="text-[9px] font-sans font-bold text-slate-450 uppercase block">5. Loading Expense</span>
                      <span class="font-bold text-slate-800">₹{metrics().loadingExpense.toLocaleString()}</span>
                    </div>
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span class="text-[9px] font-sans font-bold text-slate-450 uppercase block">6. Unloading Expense</span>
                      <span class="font-bold text-slate-800">₹{metrics().unloadingExpense.toLocaleString()}</span>
                    </div>
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span class="text-[9px] font-sans font-bold text-slate-450 uppercase block">7. RTO Permits Expense</span>
                      <span class="font-bold text-slate-800">₹{metrics().rtoExpense.toLocaleString()}</span>
                    </div>
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span class="text-[9px] font-sans font-bold text-slate-450 uppercase block">8. Diesel Fuel Expense</span>
                      <span class="font-bold text-slate-800">₹{metrics().dieselExpense.toLocaleString()}</span>
                    </div>

                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span class="text-[9px] font-sans font-bold text-slate-450 uppercase block">9. AdBlue Expense</span>
                      <span class="font-bold text-slate-800">₹{metrics().addBlueExpense.toLocaleString()}</span>
                    </div>
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span class="text-[9px] font-sans font-bold text-slate-450 uppercase block">10. Fastag Toll Charges</span>
                      <span class="font-bold text-slate-800">₹{metrics().fastagExpense.toLocaleString()}</span>
                    </div>
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span class="text-[9px] font-sans font-bold text-slate-450 uppercase block">11. Driver Wages</span>
                      <span class="font-bold text-slate-800">₹{metrics().driverWages.toLocaleString()}</span>
                    </div>
                    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span class="text-[9px] font-sans font-bold text-slate-450 uppercase block">12. Miscellaneous Other</span>
                      <span class="font-bold text-slate-800">₹{metrics().otherExpense.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </Show>

              {/* TAB 3: CARGO & LOADS */}
              <Show when={activeTab() === 'cargo'}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-3xs animate-fade-in">
                  <div class="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-2">
                      <ListCollapse class="w-4 h-4 text-emerald-600" />
                      <h4 class="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Cargo & Sub-Trip Segments</h4>
                    </div>
                    <span class="text-xs font-bold font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      Total Freight: ₹{metrics().income.toLocaleString()}
                    </span>
                  </div>

                  {subTrips().length > 0 ? (
                    <div class="overflow-x-auto border border-slate-200 rounded-xl">
                      <table class="w-full text-xs text-left">
                        <thead class="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          <tr>
                            <th class="p-3"># Seg</th>
                            <th class="p-3">Load Date</th>
                            <th class="p-3">Office Name</th>
                            <th class="p-3">Route Origin & Destination</th>
                            <th class="p-3 text-right">Income (₹)</th>
                            <th class="p-3 text-right">Wages (₹)</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          {subTrips().map((st, idx) => (
                            <tr class="hover:bg-slate-50/80">
                              <td class="p-3 font-bold text-slate-400">#{idx + 1}</td>
                              <td class="p-3 font-mono text-slate-650">{st.loadingDate}</td>
                              <td class="p-3 text-blue-700 font-bold">{st.officeName}</td>
                              <td class="p-3 font-semibold text-slate-800">{st.routeFrom} ➔ {st.routeTo}</td>
                              <td class="p-3 text-right font-bold text-emerald-700 font-mono">₹{(st.income || 0).toLocaleString()}</td>
                              <td class="p-3 text-right font-semibold text-amber-700 font-mono">₹{(st.driverWages || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p class="text-xs text-slate-400 italic text-center py-8">No sub-trips recorded.</p>
                  )}
                </div>
              </Show>

              {/* TAB 4: DRIVER SETTLEMENT */}
              <Show when={activeTab() === 'driver'}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-3xs animate-fade-in">
                  <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <User class="w-4 h-4 text-indigo-600" />
                    <h4 class="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Driver Advances & Settlement Ledger</h4>
                  </div>

                  {/* ADVANCES TABLE */}
                  <div>
                    <h5 class="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Cash & Bank Advances Issued ({advances().length})</h5>
                    {advances().length > 0 ? (
                      <div class="overflow-x-auto border border-slate-200 rounded-xl">
                        <table class="w-full text-xs text-left">
                          <thead class="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase">
                            <tr>
                              <th class="p-2.5 pl-3">#</th>
                              <th class="p-2.5">Date</th>
                              <th class="p-2.5">From Account</th>
                              <th class="p-2.5 text-right">Amount (₹)</th>
                              <th class="p-2.5">Notes</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-100 font-medium">
                            {advances().map((adv, idx) => (
                              <tr>
                                <td class="p-2.5 pl-3 font-bold text-slate-400">#{idx + 1}</td>
                                <td class="p-2.5 font-mono">{adv.date}</td>
                                <td class="p-2.5 font-bold text-blue-700">{adv.fromAccountId}</td>
                                <td class="p-2.5 text-right font-mono font-bold">₹{adv.amount.toLocaleString()}</td>
                                <td class="p-2.5 text-slate-500">{adv.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p class="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center border border-dashed border-slate-200">No driver advances issued.</p>
                    )}
                  </div>
                </div>
              </Show>

              {/* TAB 5: OPERATIONAL EXPENSES */}
              <Show when={activeTab() === 'expenses'}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-3xs animate-fade-in">
                  <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Fuel class="w-4 h-4 text-blue-600" />
                    <h4 class="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Diesel Fuel Logs ({fuels().length})</h4>
                  </div>

                  {fuels().length > 0 ? (
                    <div class="overflow-x-auto border border-slate-200 rounded-xl">
                      <table class="w-full text-xs text-left">
                        <thead class="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase">
                          <tr>
                            <th class="p-2.5 pl-3">Date</th>
                            <th class="p-2.5">Liters</th>
                            <th class="p-2.5">Rate / Lit</th>
                            <th class="p-2.5 font-mono text-right">Amount (₹)</th>
                            <th class="p-2.5">Station / Shop</th>
                            <th class="p-2.5">Payment Mode</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          {fuels().map(f => (
                            <tr>
                              <td class="p-2.5 pl-3 font-mono text-slate-500">{f.date}</td>
                              <td class="p-2.5 font-mono font-bold">{f.liters} L</td>
                              <td class="p-2.5 font-mono">₹{f.rate}</td>
                              <td class="p-2.5 text-right font-mono font-bold text-amber-900">₹{f.amount.toLocaleString()}</td>
                              <td class="p-2.5 font-sans font-bold text-slate-800">{f.shopName || '—'}</td>
                              <td class="p-2.5 font-mono text-[10px] text-indigo-700">{f.paymentMode || 'Cash'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p class="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center border border-dashed border-slate-200">No diesel fuel logs recorded.</p>
                  )}
                </div>
              </Show>

              {/* TAB 6: OUTSTANDING & COLLECTIONS */}
              <Show when={activeTab() === 'outstanding'}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-3xs animate-fade-in">
                  <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Receipt class="w-4 h-4 text-amber-600" />
                    <h4 class="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Customer Payments & Receivables</h4>
                  </div>

                  <div class="grid grid-cols-3 gap-4 font-mono text-xs text-center">
                    <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <span class="text-[9px] font-sans font-bold uppercase text-slate-400 block">Total Freight Billed</span>
                      <span class="text-base font-black text-slate-900">₹{metrics().income.toLocaleString()}</span>
                    </div>
                    <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <span class="text-[9px] font-sans font-bold uppercase text-slate-400 block">Payments Received</span>
                      <span class="text-base font-black text-emerald-700">₹{metrics().paymentsReceived.toLocaleString()}</span>
                    </div>
                    <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <span class="text-[9px] font-sans font-bold uppercase text-slate-400 block">Outstanding Balance</span>
                      <span class="text-base font-black text-cyan-700">₹{metrics().outstandingBalance.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </Show>

              {/* TAB 7: AUDIT TRAIL */}
              <Show when={activeTab() === 'audit'}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-3xs animate-fade-in">
                  <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <History class="w-4 h-4 text-slate-600" />
                    <h4 class="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Trip Event History Logs</h4>
                  </div>

                  <div class="space-y-3 font-sans text-xs">
                    <div class="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div class="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                      <div class="flex-1 flex justify-between items-start">
                        <div>
                          <span class="font-bold text-slate-800 block">Master Trip Created</span>
                          <span class="text-[11px] text-slate-500">Trip record initialized for truck {trip().truckNo}</span>
                        </div>
                        <span class="text-[10px] text-slate-400 font-mono">{trip().createdAt ? new Date(trip().createdAt!).toLocaleString('en-IN') : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Show>

            </div>

            {/* RIGHT STICKY SUMMARY & QUICK ACTIONS PANEL (w-80) */}
            <div class="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-slate-200 p-5 shrink-0 overflow-y-auto space-y-5">
              <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 class="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Receipt class="w-4 h-4 text-blue-600" />
                  Trip Summary
                </h4>
                <span class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold uppercase tracking-wider">
                  Live Snapshot
                </span>
              </div>

              {/* FINANCIAL SUMMARY HIGHLIGHTS */}
              <div class="space-y-2.5 font-sans text-xs">
                <div class="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-150">
                  <span class="text-slate-600 font-medium">Total Income</span>
                  <span class="font-mono font-extrabold text-emerald-700">₹{metrics().income.toLocaleString()}</span>
                </div>

                <div class="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-150">
                  <span class="text-slate-600 font-medium">Total Operational Costs</span>
                  <span class="font-mono font-extrabold text-rose-600">₹{metrics().totalExpense.toLocaleString()}</span>
                </div>

                <div class="flex justify-between items-center p-2.5 bg-blue-50/70 rounded-xl border border-blue-150">
                  <span class="text-blue-900 font-bold">Net Profit Margin</span>
                  <div class="text-right">
                    <span class="font-mono font-black text-blue-800 block">₹{metrics().profit.toLocaleString()}</span>
                    <span class="text-[9px] font-bold text-blue-600 block">{marginPercentage()}%</span>
                  </div>
                </div>

                <div class="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-150">
                  <span class="text-slate-600 font-medium">Total Outstanding</span>
                  <span class="font-mono font-extrabold text-amber-700">₹{metrics().outstandingBalance.toLocaleString()}</span>
                </div>

                <div class="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-150">
                  <span class="text-slate-600 font-medium">Driver Advance</span>
                  <span class="font-mono font-extrabold text-slate-800">₹{metrics().totalIssuedToDriver.toLocaleString()}</span>
                </div>

                <div class="flex justify-between items-center p-3 bg-slate-900 text-white rounded-xl shadow-xs">
                  <span class="font-bold text-[11px]">Net Driver Balance</span>
                  <span class={`font-mono font-black text-sm ${driverBalance() >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                    {driverBalance() >= 0 ? `Payable ₹${driverBalance().toLocaleString()}` : `Due ₹${Math.abs(driverBalance()).toLocaleString()}`}
                  </span>
                </div>
              </div>

              {/* QUICK ACTIONS SECTION */}
              <div class="space-y-2 pt-2 border-t border-slate-100">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block px-1">Quick Actions</span>

                {props.canEditTrips && props.onEditEntry && trip().status !== 'Deleted' && (
                  <button
                    type="button"
                    onClick={() => {
                      props.onEditEntry!(trip());
                      props.onClose();
                    }}
                    class="w-full flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl font-bold text-xs transition cursor-pointer border border-slate-200"
                  >
                    <div class="flex items-center gap-2">
                      <Edit2 class="w-3.5 h-3.5 text-blue-600" />
                      <span>Edit Trip Journal</span>
                    </div>
                    <ChevronRight class="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}

                {/* MOVE TO ANOTHER TRIP / SETTLE WITH COMPANY ACTIONS */}
                {driverBalance() !== 0 && props.onSaveTrips && (
                  <div class="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('driver');
                        setSelectedFwdMode('trip');
                      }}
                      class="w-full flex items-center justify-between p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl font-bold text-xs transition cursor-pointer border border-amber-200"
                    >
                      <div class="flex items-center gap-2">
                        <ArrowRightLeft class="w-3.5 h-3.5 text-amber-700" />
                        <span>Move to Another Trip</span>
                      </div>
                      <ChevronRight class="w-3.5 h-3.5 text-amber-600" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('driver');
                        setSelectedFwdMode('account');
                      }}
                      class="w-full flex items-center justify-between p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl font-bold text-xs transition cursor-pointer border border-emerald-200"
                    >
                      <div class="flex items-center gap-2">
                        <Building2 class="w-3.5 h-3.5 text-emerald-700" />
                        <span>Settle with Company Account</span>
                      </div>
                      <ChevronRight class="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      </div>
    </Show>
  );
}

export default TripSummaryModal;
