import { createSignal, createMemo, Show } from 'solid-js';
import { TripEntry, Account, OrganizationProfile, TripAdvance, getTripMetrics, calculateBalance, importLegacyCargoExpenses } from '../types';
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
  ChevronRight,
  Plus,
  CheckCircle
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
  const [showTransferPanel, setShowTransferPanel] = createSignal(false);
  const [selectedFwdMode, setSelectedFwdMode] = createSignal<'trip' | 'account'>('account');
  const [selectedFwdTripId, setSelectedFwdTripId] = createSignal('');
  const [selectedFwdAccountId, setSelectedFwdAccountId] = createSignal('');
  const [selectedFwdAmount, setSelectedFwdAmount] = createSignal<number | ''>('');
  const [selectedFwdDate, setSelectedFwdDate] = createSignal(new Date().toISOString().substring(0, 10));

  // Payment Recording Signals inside Summary Modal
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = createSignal(false);
  const [targetPaymentSubTripId, setTargetPaymentSubTripId] = createSignal<string | null>(null);
  const [paymentDate, setPaymentDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = createSignal<number | ''>('');
  const [paymentAccountId, setPaymentAccountId] = createSignal('Cash');
  const [paymentRefNo, setPaymentRefNo] = createSignal('');
  const [paymentReceivedByDriver, setPaymentReceivedByDriver] = createSignal(false);

  const handleSavePaymentRecord = () => {
    const stId = targetPaymentSubTripId();
    if (!stId) return;
    const amt = Number(paymentAmount());
    if (!amt || amt <= 0) return;

    const isDirect = paymentReceivedByDriver();
    const pDate = paymentDate() || new Date().toISOString().split('T')[0];
    const ref = paymentRefNo() || '';

    const newRecord = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      tripId: props.trip.id,
      subTripId: stId,
      amount: amt,
      date: pDate,
      receivedBy: paymentAccountId() || 'Cash',
      referenceNo: ref,
      receivedByDriverDirectly: isDirect
    };

    const updatedPayments = [newRecord, ...(props.trip.payments || [])];
    let updatedAdvances = [...(props.trip.advances || [])];

    if (isDirect) {
      const targetSt = props.trip.subTrips?.find(st => st.id === stId);
      const newAdvRecord = {
        id: `adv_direct_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        amount: amt,
        date: pDate,
        fromAccountId: paymentAccountId() || 'Cash',
        notes: `Direct Party Payment (${targetSt?.officeName || 'Sub-trip'}) ${ref ? '- Ref: ' + ref : ''}`,
        receivedByDriverDirectly: true
      };
      updatedAdvances = [newAdvRecord, ...updatedAdvances];
    }

    const updatedTrip: TripEntry = {
      ...props.trip,
      payments: updatedPayments,
      advances: updatedAdvances
    };

    if (props.onSaveTrips) {
      const otherTrips = (props.trips || []).filter(t => t.id !== props.trip.id);
      props.onSaveTrips([...otherTrips, updatedTrip]);
    }

    setIsRecordPaymentModalOpen(false);
  };

  const trip = createMemo(() => props.trip);
  const accounts = createMemo(() => props.accounts || []);
  const activeAccounts = createMemo(() => accounts().filter(a => a.status === 'Active'));
  const orgProfile = createMemo(() => props.orgProfile || null);
  const allTrips = createMemo(() => props.trips || []);

  const metrics = createMemo(() => getTripMetrics(trip()));
  const driverBalance = createMemo(() => metrics().driverBalance);

  const handlePrintTripPDF = () => {
    try {
      const html = generateTripPDF(trip(), accounts(), orgProfile());
      if (props.setPreviewHtml) {
        props.setPreviewHtml(html);
        if (props.setPreviewTitle) props.setPreviewTitle(`Trip Report - ${trip().tripNo}`);
      } else {
        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.write(html);
          printWin.document.close();
          printWin.focus();
          setTimeout(() => {
            printWin.print();
          }, 300);
        }
      }
    } catch (err) {
      console.error('Print Error:', err);
    }
  };

  const handlePrintDriverReport = () => {
    try {
      const html = generateDriverReportPDF(trip(), accounts(), orgProfile());
      if (props.setPreviewHtml) {
        props.setPreviewHtml(html);
        if (props.setPreviewTitle) props.setPreviewTitle(`Driver Settlement - ${trip().tripNo}`);
      } else {
        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.write(html);
          printWin.document.close();
          printWin.focus();
          setTimeout(() => {
            printWin.print();
          }, 300);
        }
      }
    } catch (err) {
      console.error('Driver Report Print Error:', err);
    }
  };

  const handleExecuteAccountSettlement = () => {
    if (!selectedFwdAccountId()) return;
    const amt = Number(selectedFwdAmount()) || Math.abs(driverBalance());
    if (amt <= 0) return;

    const targetAccount = accounts().find(a => a.id === selectedFwdAccountId());
    const accountName = targetAccount ? targetAccount.accountName : selectedFwdAccountId();

    const newAdv: TripAdvance = {
      id: 'fwd_settle_' + Date.now(),
      amount: driverBalance() < 0 ? -amt : amt,
      date: selectedFwdDate() || new Date().toISOString().substring(0, 10),
      fromAccountId: selectedFwdAccountId(),
      notes: driverBalance() < 0
        ? `Deficit settled with account: ${accountName}`
        : `Surplus paid to driver from account: ${accountName}`,
      receivedByDriverDirectly: false
    };

    const updatedTrip = {
      ...trip(),
      advances: [...(trip().advances || []), newAdv]
    };

    const updatedList = allTrips().map(t => t.id === trip().id ? updatedTrip : t);
    if (props.onSaveTrips) {
      props.onSaveTrips(updatedList);
    }
    setShowTransferPanel(false);
    setSelectedFwdAccountId('');
    setSelectedFwdAmount('');
  };

  const handleExecuteInterTripTransfer = () => {
    let targetTripNo = selectedFwdTripId();
    let targetTrip = allTrips().find(t => t.tripNo === targetTripNo || t.id === targetTripNo);
    if (!targetTrip) {
      const candidates = allTrips().filter(t => t.id !== trip().id);
      if (candidates.length > 0) {
        targetTrip = candidates[0];
        targetTripNo = targetTrip.tripNo;
      }
    }
    if (!targetTrip) return;

    const amt = Number(selectedFwdAmount()) || Math.abs(driverBalance()) || 2000;
    if (amt <= 0) return;

    const transferOutAdv: TripAdvance = {
      id: 'fwd_trip_' + Date.now(),
      amount: driverBalance() < 0 ? -amt : amt,
      date: selectedFwdDate() || new Date().toISOString().substring(0, 10),
      fromAccountId: 'Transfer',
      notes: `Transferred ₹${amt.toLocaleString('en-IN')} ${driverBalance() < 0 ? 'deficit to' : 'surplus to'} Trip ${targetTrip.tripNo}`,
      receivedByDriverDirectly: false
    };

    const transferInAdv: TripAdvance = {
      id: 'fwd_recv_' + Date.now(),
      amount: driverBalance() < 0 ? amt : -amt,
      date: selectedFwdDate() || new Date().toISOString().substring(0, 10),
      fromAccountId: 'Transfer',
      notes: `Transferred ₹${amt.toLocaleString('en-IN')} ${driverBalance() < 0 ? 'deficit from' : 'surplus from'} Trip ${trip().tripNo}`,
      receivedByDriverDirectly: false
    };

    const updatedCurrentTrip = {
      ...trip(),
      advances: [...(trip().advances || []), transferOutAdv]
    };

    const updatedTargetTrip = {
      ...targetTrip,
      advances: [...(targetTrip.advances || []), transferInAdv]
    };

    const updatedList = allTrips().map(t => {
      if (t.id === trip().id) return updatedCurrentTrip;
      if (t.id === targetTrip!.id) return updatedTargetTrip;
      return t;
    });

    if (props.onSaveTrips) {
      props.onSaveTrips(updatedList);
    }
    setShowTransferPanel(false);
    setSelectedFwdTripId('');
    setSelectedFwdAmount('');
  };

  const getAccountOrCardName = (id?: string) => {
    if (!id) return 'Cash';
    if (id === 'driver' || id === 'Driver') return 'Paid by Driver';
    if (id === 'Cash') return 'Cash';
    if (id === 'Transfer') return 'Inter-Trip Transfer';

    // 1. Check company accounts
    const acct = accounts().find(a => a.id === id);
    if (acct) return acct.accountName;

    // 2. Check orgProfile fuelCards
    const profile = orgProfile();
    const fc = profile?.fuelCards?.find(card => card.id === id);
    if (fc) return `${fc.cardName}${fc.cardNumber ? ' (•••• ' + fc.cardNumber.slice(-4) + ')' : ''}`;

    // 3. Fallback for raw fuel card IDs (fc_XXXXX)
    if (id.startsWith('fc_')) {
      const numStr = id.replace('fc_', '');
      return `Fuel Card (•••• ${numStr.slice(-4)})`;
    }

    // 4. Fallback for raw bank account IDs (a_id_XXXXX or acc_XXXXX)
    if (id.startsWith('a_id_') || id.startsWith('acc_')) {
      const numStr = id.replace(/^(a_id_|acc_)/, '');
      return `Bank Account (•••• ${numStr.slice(-4)})`;
    }

    return id;
  };

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
                  <select
                    value={trip().status || 'Pending'}
                    onChange={(e) => {
                      if (!props.onSaveTrips || !props.canEditTrips) return;
                      const newStatus = e.target.value as any;
                      const updated = (props.trips || []).map(t => t.id === trip().id ? { ...t, status: newStatus } : t);
                      props.onSaveTrips(updated);
                    }}
                    class={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider cursor-pointer focus:outline-none transition border shadow-2xs ${
                      trip().status === 'Settled'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : trip().status === 'Completed'
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : trip().status === 'In Progress'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Settled">Settled</option>
                  </select>
                </div>
                <p class="text-xs text-slate-500 font-medium">
                  Created on {trip().createdAt ? new Date(trip().createdAt!).toLocaleDateString('en-IN') : 'N/A'} &bull; Truck: <strong class="text-slate-800 font-bold">{trip().truckNo}</strong>
                </p>
              </div>
            </div>

            {/* ACTION BUTTONS HEADER */}
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrintTripPDF}
                class="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-250 shadow-2xs transition cursor-pointer"
              >
                <Printer class="w-4 h-4 text-slate-500" />
                Print PDF
              </button>
              <button
                type="button"
                onClick={handlePrintDriverReport}
                class="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-250 shadow-2xs transition cursor-pointer"
              >
                <FileText class="w-4 h-4 text-blue-600" />
                Driver Report
              </button>
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

            {/* TRIP STATUS BADGE / DRIVER BALANCE */}
            <div class="bg-slate-100 border border-slate-250 p-3 rounded-2xl flex items-center justify-between col-span-2 md:col-span-1">
              <div>
                <span class="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 block">Driver Balance</span>
                <span class={`text-sm font-extrabold font-mono ${driverBalance() > 0 ? 'text-amber-700' : driverBalance() < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {driverBalance() > 0 ? `Pay ₹${driverBalance().toLocaleString()}` : driverBalance() < 0 ? `Due ₹${Math.abs(driverBalance()).toLocaleString()}` : 'Fully Settled'}
                </span>
              </div>
              {driverBalance() !== 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('driver');
                    setSelectedFwdAmount(Math.abs(driverBalance()));
                  }}
                  class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-lg shadow-xs transition cursor-pointer shrink-0"
                >
                  Pay / Settle
                </button>
              ) : (
                <div class="w-8 h-8 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                  <Clock class="w-4 h-4" />
                </div>
              )}
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
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-3xs animate-fade-in font-sans">
                  <div class="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div class="flex items-center gap-2">
                      <ListCollapse class="w-4 h-4 text-emerald-600" />
                      <h4 class="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Cargo & Sub-Trip Segments ({subTrips().length})</h4>
                    </div>
                    <span class="text-xs font-bold font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      Total Freight: ₹{metrics().income.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {subTrips().length > 0 ? (() => {
                    const calculatedSubTrips = subTrips().map(st => {
                      const wagesAmt = st.driverWages || 0;
                      const expenses = (st.cargoExpenses && st.cargoExpenses.length > 0)
                        ? st.cargoExpenses
                        : importLegacyCargoExpenses(st, props.orgProfile);

                      const segmentDeductions = expenses
                        ? expenses
                          .filter(exp => exp.deductedFrom === 'OrgRental' || exp.paidByDriver)
                          .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)
                        : 0;

                      const segmentOfficeBears = expenses
                        .filter(exp => exp.bears === 'Office')
                        .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

                      const segmentPayments = (payments() || [])
                        .filter(p => p.subTripId === st.id)
                        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

                      const segmentReceivable = st.income - segmentDeductions + segmentOfficeBears - segmentPayments;
                      return { st, wagesAmt, segmentPayments, segmentReceivable, expenses };
                    });

                    return (
                      <div class="space-y-4">
                        {calculatedSubTrips.map((item, sidx) => {
                          const rowExps = (item.st.cargoExpenses && item.st.cargoExpenses.length > 0)
                            ? item.st.cargoExpenses
                            : importLegacyCargoExpenses(item.st, props.orgProfile);
                          const cargoTotal = rowExps.reduce((s, e) => s + (Number(e.amount) || 0), 0);

                          return (
                            <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 font-sans">
                              {/* CARD HEADER */}
                              <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                                <div class="space-y-0.5">
                                  <div class="flex items-center gap-2">
                                    <div class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs">
                                      #{sidx + 1}
                                    </div>
                                    <h5 class="font-extrabold text-blue-700 text-sm leading-tight">
                                      {item.st.officeName || 'Unassigned Office'}
                                    </h5>
                                    <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                                      <span class="w-1 h-1 rounded-full bg-emerald-500"></span> Active
                                    </span>
                                  </div>
                                  <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium pl-9">
                                    <span>LOAD DATE: <strong class="text-slate-700 font-mono">{item.st.loadingDate || '—'}</strong></span>
                                    {item.st.material && (
                                      <>
                                        <span>•</span>
                                        <span class="bg-slate-100 text-slate-700 text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase">{item.st.material}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* ROUTE PATH */}
                              <div class="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between">
                                <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Route Path</span>
                                <div class="flex items-center gap-2 text-xs font-black text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-2xs">
                                  <span>{item.st.routeFrom || '?'}</span>
                                  <span class="text-blue-600 font-black">➔</span>
                                  <span>{item.st.routeTo || '?'}</span>
                                </div>
                              </div>

                              {/* TWO COLUMNS: Freight & Ledger | Cargo Expense Breakdown */}
                              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* LEFT: FREIGHT & LEDGER */}
                                <div class="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 space-y-1.5 text-xs">
                                  <div class="flex items-center justify-between mb-1.5 border-b border-slate-200/60 pb-1">
                                    <span class="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                                      Freight & Ledger
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTargetPaymentSubTripId(item.st.id);
                                        setPaymentDate(new Date().toISOString().split('T')[0]);
                                        setPaymentAmount('');
                                        setPaymentRefNo('');
                                        setPaymentReceivedByDriver(false);
                                        setIsRecordPaymentModalOpen(true);
                                      }}
                                      class="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-extrabold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                      title="Record Customer Payment / Advance for this Cargo Segment"
                                    >
                                      <Plus class="w-3 h-3" /> Record Payment
                                    </button>
                                  </div>

                                  <div class="flex items-center justify-between py-0.5 border-b border-slate-150">
                                    <span class="text-slate-600 font-semibold text-[11px]">Freight Income</span>
                                    <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-black text-xs px-2 py-0.5 rounded-md">
                                      ₹{item.st.income.toLocaleString('en-IN')}
                                    </span>
                                  </div>

                                  <div class="flex items-center justify-between py-0.5 border-b border-slate-150">
                                    <span class="text-slate-600 font-semibold text-[11px]">Advance Received</span>
                                    <span class="bg-cyan-50 text-cyan-700 border border-cyan-200 font-mono font-bold text-xs px-2 py-0.5 rounded-md">
                                      ₹{(item.segmentPayments || 0).toLocaleString('en-IN')}
                                    </span>
                                  </div>

                                  <div class="flex items-center justify-between py-0.5 border-b border-slate-150">
                                    <span class="text-slate-600 font-semibold text-[11px]">Balance Receivable</span>
                                    <span class="bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold text-xs px-2 py-0.5 rounded-md">
                                      ₹{(item.segmentReceivable || 0).toLocaleString('en-IN')}
                                    </span>
                                  </div>

                                  <div class="flex items-center justify-between py-0.5 border-b border-slate-150">
                                    <span class="text-slate-600 font-semibold text-[11px]">Total Cargo Exp</span>
                                    <span class="bg-rose-50 text-rose-700 border border-rose-200 font-mono font-bold text-xs px-2 py-0.5 rounded-md">
                                      ₹{cargoTotal.toLocaleString('en-IN')}
                                    </span>
                                  </div>

                                  <div class="flex items-center justify-between py-0.5">
                                    <span class="text-slate-600 font-semibold text-[11px]">Driver Wages</span>
                                    <span class="bg-amber-50 text-amber-700 border border-amber-200 font-mono font-bold text-xs px-2 py-0.5 rounded-md">
                                      {item.wagesAmt > 0 ? `₹${item.wagesAmt.toLocaleString('en-IN')}` : '₹0'}
                                    </span>
                                  </div>
                                </div>

                                {/* RIGHT: ITEMISED CARGO EXPENSE BREAKDOWN */}
                                <div class="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 space-y-1.5 text-xs">
                                  <span class="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                                    Cargo Expense Breakdown
                                  </span>

                                  {(() => {
                                    const getAmt = (type: string) => rowExps.filter(e => e.expenseType === type).reduce((s, e) => s + (Number(e.amount) || 0), 0);
                                    const expItems = [
                                      { label: 'Loading', amt: getAmt('Loading') },
                                      { label: 'Unloading', amt: getAmt('Unloading') },
                                      { label: 'RMC', amt: getAmt('RMC') },
                                      { label: 'Crossing (Mamul)', amt: getAmt('Crossing') },
                                      { label: 'Brokerage', amt: getAmt('Brokerage') }
                                    ];
                                    return (
                                      <>
                                        {expItems.map(expItem => (
                                          <div class="flex items-center justify-between py-0.5 border-b border-slate-150">
                                            <span class="text-slate-600 font-medium text-[11px]">{expItem.label}</span>
                                            <span class={`font-mono text-xs font-bold ${expItem.amt > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                                              {expItem.amt > 0 ? `₹${expItem.amt.toLocaleString('en-IN')}` : '—'}
                                            </span>
                                          </div>
                                        ))}
                                        <div class="flex items-center justify-between pt-1 font-bold text-[11px]">
                                          <span class="text-slate-800 uppercase tracking-wider">Total Cargo Exp</span>
                                          <span class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md font-mono">
                                            ₹{cargoTotal.toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })() : (
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
                                <td class="p-2.5 font-bold text-blue-700">{getAccountOrCardName(adv.fromAccountId)}</td>
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

                    {/* QUICK TRANSFER / SETTLEMENT FORM PANEL */}
                    {props.onSaveTrips && (
                      <div class="bg-slate-950 text-slate-100 p-4 rounded-xl border border-slate-800 space-y-3 font-sans mt-4">
                        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span class="text-xs font-extrabold uppercase text-amber-400">Driver Balance Settlement & Inter-Trip Transfer</span>
                          <div class="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 gap-0.5">
                            <button
                              type="button"
                              onClick={() => setSelectedFwdMode('account')}
                              class={`px-3 py-1 rounded-md text-[10px] font-extrabold uppercase transition cursor-pointer ${
                                selectedFwdMode() === 'account' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Company Account
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedFwdMode('trip')}
                              class={`px-3 py-1 rounded-md text-[10px] font-extrabold uppercase transition cursor-pointer ${
                                selectedFwdMode() === 'trip' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Move to Another Trip
                            </button>
                          </div>
                        </div>

                        <div class={selectedFwdMode() === 'account' ? 'block' : 'hidden'}>
                          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                            <div>
                              <label class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Company Account</label>
                              <select
                                value={selectedFwdAccountId()}
                                onChange={(e) => setSelectedFwdAccountId(e.currentTarget.value)}
                                onInput={(e) => setSelectedFwdAccountId(e.currentTarget.value)}
                                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                              >
                                <option value="">-- Choose Account --</option>
                                <option value="Cash">Cash</option>
                                {activeAccounts().map(a => (
                                  <option value={a.id}>{a.accountName} ({a.type})</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Amount (₹)</label>
                              <input
                                type="number"
                                min="1"
                                value={selectedFwdAmount() !== '' ? selectedFwdAmount() : Math.abs(driverBalance())}
                                onChange={(e) => setSelectedFwdAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono font-bold text-slate-100 focus:outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleExecuteAccountSettlement()}
                              class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs"
                            >
                              Confirm Account Settlement
                            </button>
                          </div>
                        </div>

                        <div class={selectedFwdMode() === 'trip' ? 'block' : 'hidden'}>
                          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                            <div>
                              <label class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Target Trip Code</label>
                              <select
                                value={selectedFwdTripId()}
                                onChange={(e) => setSelectedFwdTripId(e.target.value || e.currentTarget.value)}
                                onInput={(e) => setSelectedFwdTripId(e.target.value || e.currentTarget.value)}
                                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                              >
                                <option value="">-- Choose Target Trip --</option>
                                {allTrips().filter(t => t.id !== trip().id).map(t => (
                                  <option value={t.tripNo}>{t.tripNo} ({t.truckNo} - {t.driverName})</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Transfer Amount (₹)</label>
                              <input
                                type="number"
                                min="1"
                                value={selectedFwdAmount() !== '' ? selectedFwdAmount() : Math.abs(driverBalance())}
                                onChange={(e) => setSelectedFwdAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono font-bold text-slate-100 focus:outline-none"
                              />
                            </div>
                            <button
                              id="btn_confirm_inter_trip"
                              type="button"
                              onClick={() => handleExecuteInterTripTransfer()}
                              class="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs"
                            >
                              Confirm Inter-Trip Transfer
                            </button>
                          </div>
                        </div>
                      </div>
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
                              <td class="p-2.5 font-bold text-indigo-700 text-xs">{getAccountOrCardName(f.paymentMode)}</td>
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

                <div class="p-3 bg-slate-900 text-white rounded-xl shadow-xs space-y-2 font-sans">
                  <div class="flex justify-between items-center">
                    <span class="font-bold text-[11px] text-slate-300">Net Driver Balance</span>
                    <span class={`font-mono font-black text-sm ${driverBalance() > 0 ? 'text-amber-300' : driverBalance() < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {driverBalance() > 0 ? `Payable ₹${driverBalance().toLocaleString()}` : driverBalance() < 0 ? `Due ₹${Math.abs(driverBalance()).toLocaleString()}` : 'Settled'}
                    </span>
                  </div>
                  {driverBalance() !== 0 && props.onSaveTrips && (
                    <div class="flex gap-1.5 pt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('driver');
                          setSelectedFwdMode('account');
                          setSelectedFwdAmount(Math.abs(driverBalance()));
                        }}
                        class="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition cursor-pointer text-center shadow-xs"
                      >
                        Settle Account
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('driver');
                          setSelectedFwdMode('trip');
                          setSelectedFwdAmount(Math.abs(driverBalance()));
                        }}
                        class="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-lg transition cursor-pointer text-center shadow-xs"
                      >
                        Move to Trip
                      </button>
                    </div>
                  )}
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
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* ═══ RECORD CUSTOMER PAYMENT MODAL ═══ */}
      <Show when={isRecordPaymentModalOpen()}>
        <div class="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[70] animate-fade-in font-sans">
          <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden space-y-0">
            {/* Modal Header */}
            <div class="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Receipt class="w-5 h-5" />
                </div>
                <div>
                  <h4 class="font-extrabold text-slate-900 text-sm">Record Customer Payment</h4>
                  <p class="text-[11px] text-slate-500 font-medium">Log advance or settlement received from party</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordPaymentModalOpen(false)}
                class="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div class="p-6 space-y-4 text-xs">
              {(() => {
                const st = props.trip.subTrips?.find(s => s.id === targetPaymentSubTripId());
                return (
                  <div class="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-3.5 space-y-1">
                    <span class="text-[9px] font-extrabold text-blue-600 uppercase tracking-wider block">Target Sub-Trip Segment</span>
                    <div class="flex items-center justify-between">
                      <span class="font-black text-slate-900 text-xs">{st?.officeName || 'Unassigned Office'}</span>
                      <span class="font-bold text-blue-700 text-xs bg-white px-2 py-0.5 rounded-md border border-blue-200">{st?.routeFrom} ➔ {st?.routeTo}</span>
                    </div>
                  </div>
                );
              })()}

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Payment Date <span class="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={paymentDate()}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    class="w-full h-10 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Amount Received (₹) <span class="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="₹0.00"
                    value={paymentAmount()}
                    onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    class="w-full h-10 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 text-xs text-right font-mono font-bold focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Received Into Account <span class="text-red-500">*</span></label>
                <select
                  value={paymentAccountId()}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  class="w-full h-10 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white cursor-pointer transition"
                >
                  <option value="Cash">Cash</option>
                  {activeAccounts().map(ac => (
                    <option value={ac.id}>{ac.accountName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Memo / UTR / Reference No.</label>
                <input
                  type="text"
                  placeholder="e.g. UTR1455463334 / Advance Cheque #402"
                  value={paymentRefNo()}
                  onChange={(e) => setPaymentRefNo(e.target.value)}
                  class="w-full h-10 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 text-xs font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              {/* Direct Party Payment to Driver Checkbox Banner */}
              <div class="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 space-y-1">
                <label class="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={paymentReceivedByDriver()}
                    onChange={(e) => setPaymentReceivedByDriver(e.target.checked)}
                    class="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span class="text-xs font-bold text-amber-900">
                    Received Directly by Driver (Party Payment)
                  </span>
                </label>
                <p class="text-[11px] text-amber-700/80 font-medium pl-6 leading-relaxed">
                  Check this if party paid advance/cash directly to the driver operator. It will automatically post to Driver Advances with status "Driver Direct".
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div class="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsRecordPaymentModalOpen(false)}
                class="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePaymentRecord}
                class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-2 transition"
              >
                <CheckCircle class="w-4 h-4" /> Save Payment Entry
              </button>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  );
}

export default TripSummaryModal;
