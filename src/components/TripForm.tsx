/* eslint-disable @typescript-eslint/no-unused-vars */
import { createSignal, createMemo, createEffect, onMount, Show } from 'solid-js';
import { Truck, SubTrip, Account, OrganizationProfile, Driver, FuelEntry as FuelLog, TripAdvance, CargoExpense, getTripMetrics, calculateBalance, TripEntry } from '../types';
import { 
  Truck as TruckIcon, 
  User, 
  Calendar, 
  Gauge, 
  Receipt, 
  DollarSign, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  HelpCircle, 
  ListCollapse, 
  Fuel, 
  Coins, 
  BadgeCent, 
  Calculator, 
  Building2 
} from 'lucide-solid';
import { useLanguage } from '../context/LanguageContext';

interface TripFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (tripData: Partial<TripEntry>) => void;
  onSubmit?: (tripData: Partial<TripEntry>) => void;
  editingEntry?: TripEntry | null;
  trucks: Truck[] | (() => Truck[]);
  drivers: Driver[] | (() => Driver[]);
  accounts: Account[] | (() => Account[]);
  offices?: any[] | (() => any[]);
  orgProfile?: OrganizationProfile | null | (() => OrganizationProfile | null);
  currentUserRights?: { organizationId?: string; role?: string; canViewDrivers?: boolean } | null | (() => { organizationId?: string; role?: string; canViewDrivers?: boolean } | null);
  canViewDrivers?: boolean;
  existingTripNos: string[] | (() => string[]);
  trips?: TripEntry[] | (() => TripEntry[]);
  onSaveTrips?: (trips: TripEntry[]) => void;
  confirmAction?: (msg: string, action: () => void, title?: string) => void;
}

// Helper function to convert legacy sub-trip expenses if cargoExpenses array is absent
function importLegacyCargoExpenses(subTrip: SubTrip, profile?: OrganizationProfile | null): CargoExpense[] {
  const exps: CargoExpense[] = [];

  if ((subTrip.loadingExpense || 0) > 0) {
    exps.push({
      id: 'legacy_load_' + subTrip.id,
      expenseType: 'Loading',
      amount: subTrip.loadingExpense,
      deductedFrom: subTrip.loadingDeductedFrom || 'OrgRental',
      paidByDriver: subTrip.loadingPaidByDriver || false,
      bears: (subTrip.loadingBears as any) || 'Office'
    });
  }

  if ((subTrip.unloadingExpense || 0) > 0) {
    exps.push({
      id: 'legacy_unload_' + subTrip.id,
      expenseType: 'Unloading',
      amount: subTrip.unloadingExpense,
      deductedFrom: subTrip.unloadingDeductedFrom || 'OrgRental',
      paidByDriver: subTrip.unloadingPaidByDriver || false,
      bears: (subTrip.unloadingBears as any) || 'Office'
    });
  }

  if ((subTrip.brokerageExpense || 0) > 0) {
    exps.push({
      id: 'legacy_brokerage_' + subTrip.id,
      expenseType: 'Brokerage',
      amount: subTrip.brokerageExpense,
      deductedFrom: 'OrgRental',
      paidByDriver: subTrip.brokeragePaidByDriver || false,
      bears: 'Office'
    });
  }

  return exps;
}

export function TripForm(props: TripFormProps) {
  const { t } = useLanguage();

  // Signal State definitions
  const [currentStep, setCurrentStep] = createSignal(1);
  const [tripNoOption, setTripNoOption] = createSignal<'AUTO' | 'EXISTING'>('AUTO');
  const [selectedExistingTripNo, setSelectedExistingTripNo] = createSignal('');
  const [tripNo, setTripNo] = createSignal('');
  const [truckNo, setTruckNo] = createSignal('');
  const [driverName, setDriverName] = createSignal('');
  const [startDate, setStartDate] = createSignal('');
  const [endDate, setEndDate] = createSignal('');
  const [startingKM, setStartingKM] = createSignal(0);
  const [endingKM, setEndingKM] = createSignal(0);
  const [notes, setNotes] = createSignal('');
  const [status, setStatus] = createSignal<'Active' | 'Completed' | 'Settled'>('Active');

  const [subTrips, setSubTrips] = createSignal<SubTrip[]>([]);
  const [advances, setAdvances] = createSignal<TripAdvance[]>([]);
  const [payments, setPayments] = createSignal<any[]>([]);
  const [fuels, setFuels] = createSignal<FuelLog[]>([]);

  const [rtoExpense, setRtoExpense] = createSignal(0);
  const [rtoPaidByDriver, setRtoPaidByDriver] = createSignal(false);
  const [addBlueExpense, setAddBlueExpense] = createSignal(0);
  const [addBluePaidByDriver, setAddBluePaidByDriver] = createSignal(false);
  const [fastagExpense, setFastagExpense] = createSignal(0);
  const [fastagPaidByDriver, setFastagPaidByDriver] = createSignal(false);
  const [otherExpense, setOtherExpense] = createSignal(0);
  const [otherPaidByDriver, setOtherPaidByDriver] = createSignal(false);

  // SubTrip modal draft signal state
  const [isSubTripModalOpen, setIsSubTripModalOpen] = createSignal(false);
  const [editingSubTripId, setEditingSubTripId] = createSignal<string | null>(null);
  const [stLoadingDate, setStLoadingDate] = createSignal('');
  const [stOfficeName, setStOfficeName] = createSignal('');
  const [stRouteFrom, setStRouteFrom] = createSignal('');
  const [stRouteTo, setStRouteTo] = createSignal('');
  const [stGoodsName, setStGoodsName] = createSignal('');
  const [stWeight, setStWeight] = createSignal(0);
  const [stFreightRate, setStFreightRate] = createSignal(0);
  const [stIncome, setStIncome] = createSignal(0);
  const [stDriverWages, setStDriverWages] = createSignal(0);
  const [stCargoExpenses, setStCargoExpenses] = createSignal<CargoExpense[]>([]);

  // Cargo expense builder signals inside sub-trip modal
  const [newExpType, setNewExpType] = createSignal<'Loading' | 'Unloading' | 'Brokerage' | 'Crossing' | 'RMC'>('Loading');
  const [newExpAmount, setNewExpAmount] = createSignal<number | ''>('');
  const [newExpDeductedFrom, setNewExpDeductedFrom] = createSignal<'OrgRental' | 'DriverDirect' | 'OrgPaid'>('OrgRental');
  const [newExpPaidByDriver, setNewExpPaidByDriver] = createSignal(false);
  const [newExpBears, setNewExpBears] = createSignal<'Org' | 'Driver' | 'Office'>('Office');

  // Advances builder signals
  const [newAdvDate, setNewAdvDate] = createSignal(new Date().toISOString().substring(0, 10));
  const [newAdvAmount, setNewAdvAmount] = createSignal<number | ''>('');
  const [newAdvFromAccount, setNewAdvFromAccount] = createSignal('');
  const [newAdvNotes, setNewAdvNotes] = createSignal('');

  // Fuel builder signals
  const [newFuelDate, setNewFuelDate] = createSignal(new Date().toISOString().substring(0, 10));
  const [newFuelLiters, setNewFuelLiters] = createSignal<number | ''>('');
  const [newFuelRate, setNewFuelRate] = createSignal<number | ''>('');
  const [newFuelAmount, setNewFuelAmount] = createSignal<number | ''>('');
  const [newFuelShop, setNewFuelShop] = createSignal('');
  const [newFuelPaymentMode, setNewFuelPaymentMode] = createSignal('');

  // Quick Transfer Signals
  const [showQuickFwdPanel, setShowQuickFwdPanel] = createSignal(false);
  const [selectedFwdAccountId, setSelectedFwdAccountId] = createSignal('');
  const [selectedFwdAmount, setSelectedFwdAmount] = createSignal<number | ''>('');

  let advanceDateInputRef: HTMLInputElement | undefined;
  let fuelDateInputRef: HTMLInputElement | undefined;

  // Reactivity memos
  const trucks = createMemo(() => {
    const res = typeof props.trucks === 'function' ? props.trucks() : props.trucks;
    return Array.isArray(res) ? res : [];
  });
  const drivers = createMemo(() => {
    const res = typeof props.drivers === 'function' ? props.drivers() : props.drivers;
    return Array.isArray(res) ? res : [];
  });
  const accounts = createMemo(() => {
    const res = typeof props.accounts === 'function' ? props.accounts() : props.accounts;
    return Array.isArray(res) ? res : [];
  });
  const activeAccounts = createMemo(() => accounts().filter(a => a.status === 'Active'));
  const orgProfile = createMemo(() => {
    if (typeof props.orgProfile === 'function') return props.orgProfile() || null;
    return props.orgProfile || null;
  });
  const existingTripNos = createMemo(() => {
    const res = typeof props.existingTripNos === 'function' ? props.existingTripNos() : props.existingTripNos;
    return Array.isArray(res) ? res : [];
  });
  const editingEntry = createMemo(() => props.editingEntry || null);
  const userRights = createMemo(() => {
    if (typeof props.currentUserRights === 'function') return props.currentUserRights() || null;
    return null;
  });

  const canViewDrivers = createMemo(() => {
    if (props.canViewDrivers !== undefined) return props.canViewDrivers;
    const role = userRights()?.role;
    return role === 'SuperAdmin' || role === 'OrgAdmin' || role === 'Manager';
  });

  // Populate data when editing entry changes
  createEffect(() => {
    const entry = editingEntry();
    if (entry) {
      setTripNo(entry.tripNo || '');
      setTruckNo(entry.truckNo || '');
      setDriverName(entry.driverName || '');
      setStartDate(entry.startDate || '');
      setEndDate(entry.endDate || '');
      setStartingKM(entry.startingKM || 0);
      setEndingKM(entry.endingKM || 0);
      setNotes(entry.notes || '');
      setStatus((entry.status as any) || 'Active');
      setSubTrips(entry.subTrips ? JSON.parse(JSON.stringify(entry.subTrips)) : []);
      setAdvances(entry.advances ? JSON.parse(JSON.stringify(entry.advances)) : []);
      setPayments(entry.payments ? JSON.parse(JSON.stringify(entry.payments)) : []);
      setFuels(entry.fuels ? JSON.parse(JSON.stringify(entry.fuels)) : []);
      setRtoExpense(entry.rtoExpense || 0);
      setRtoPaidByDriver(entry.rtoPaidByDriver || false);
      setAddBlueExpense(entry.addBlueExpense || 0);
      setAddBluePaidByDriver(entry.addBluePaidByDriver || false);
      setFastagExpense(entry.fastagExpense || 0);
      setFastagPaidByDriver(entry.fastagPaidByDriver || false);
      setOtherExpense(entry.otherExpense || 0);
      setOtherPaidByDriver(entry.otherPaidByDriver || false);
    } else {
      resetMasterForm();
    }
  });

  function resetMasterForm() {
    setTripNo('TRIP-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000));
    setTruckNo('');
    setDriverName('');
    const today = new Date().toISOString().substring(0, 10);
    setStartDate(today);
    setEndDate(today);
    setStartingKM(0);
    setEndingKM(0);
    setNotes('');
    setStatus('Active');
    setSubTrips([]);
    setAdvances([]);
    setPayments([]);
    setFuels([]);
    setRtoExpense(0);
    setRtoPaidByDriver(false);
    setAddBlueExpense(0);
    setAddBluePaidByDriver(false);
    setFastagExpense(0);
    setFastagPaidByDriver(false);
    setOtherExpense(0);
    setOtherPaidByDriver(false);
    setCurrentStep(1);
  }

  // Handlers for advances and fuels
  const handleAddAdvance = () => {
    const amt = Number(newAdvAmount()) || 0;
    if (amt <= 0) {
      alert("Please enter a valid advance amount > 0");
      return;
    }
    const newAdv: TripAdvance = {
      id: 'adv_' + Date.now(),
      amount: amt,
      date: newAdvDate() || new Date().toISOString().substring(0, 10),
      fromAccountId: newAdvFromAccount() || 'Cash',
      notes: newAdvNotes() || '',
      receivedByDriverDirectly: false
    };
    setAdvances([...advances(), newAdv]);
    setNewAdvAmount('');
    setNewAdvNotes('');
  };

  const handleRemoveAdvance = (id: string) => {
    setAdvances(advances().filter(a => a.id !== id));
  };

  const handleLitersChange = (val: number | '') => {
    setNewFuelLiters(val);
    const lit = Number(val) || 0;
    const rate = Number(newFuelRate()) || 0;
    if (lit > 0 && rate > 0) {
      setNewFuelAmount(Math.round(lit * rate));
    }
  };

  const handleRateChange = (val: number | '') => {
    setNewFuelRate(val);
    const lit = Number(newFuelLiters()) || 0;
    const rate = Number(val) || 0;
    if (lit > 0 && rate > 0) {
      setNewFuelAmount(Math.round(lit * rate));
    }
  };

  const handleAmountChange = (val: number | '') => {
    setNewFuelAmount(val);
    const amt = Number(val) || 0;
    const lit = Number(newFuelLiters()) || 0;
    if (amt > 0 && lit > 0) {
      setNewFuelRate(parseFloat((amt / lit).toFixed(2)));
    }
  };

  const handleAddFuel = () => {
    const amt = Number(newFuelAmount()) || 0;
    const lit = Number(newFuelLiters()) || 0;
    if (amt <= 0 || lit <= 0) {
      alert("Please enter valid Fuel Liters and Amount");
      return;
    }
    const newF: FuelLog = {
      id: 'fuel_' + Date.now(),
      date: newFuelDate() || new Date().toISOString().substring(0, 10),
      liters: lit,
      rate: Number(newFuelRate()) || 0,
      amount: amt,
      shopName: newFuelShop() || '',
      paymentMode: newFuelPaymentMode() || 'Cash'
    };
    setFuels([...fuels(), newF]);
    setNewFuelLiters('');
    setNewFuelRate('');
    setNewFuelAmount('');
    setNewFuelShop('');
  };

  const handleRemoveFuel = (id: string) => {
    setFuels(fuels().filter(f => f.id !== id));
  };

  // Cargo sub-trip handlers
  const handleOpenNewSubTrip = () => {
    setEditingSubTripId(null);
    setStLoadingDate(startDate() || new Date().toISOString().substring(0, 10));
    setStOfficeName('');
    setStRouteFrom('');
    setStRouteTo('');
    setStGoodsName('');
    setStWeight(0);
    setStFreightRate(0);
    setStIncome(0);
    setStDriverWages(0);
    setStCargoExpenses([]);
    setIsSubTripModalOpen(true);
  };

  const handleOpenEditSubTrip = (st: SubTrip) => {
    setEditingSubTripId(st.id);
    setStLoadingDate(st.loadingDate || '');
    setStOfficeName(st.officeName || '');
    setStRouteFrom(st.routeFrom || '');
    setStRouteTo(st.routeTo || '');
    setStGoodsName(st.material || '');
    setStWeight(st.noOfTons || 0);
    setStFreightRate(st.ratePerTon || 0);
    setStIncome(st.income || 0);
    setStDriverWages(st.driverWages || 0);
    setStCargoExpenses(st.cargoExpenses ? JSON.parse(JSON.stringify(st.cargoExpenses)) : importLegacyCargoExpenses(st, orgProfile()));
    setIsSubTripModalOpen(true);
  };

  const handleDeleteSubTripSegment = (subTripId: string) => {
    if (confirm("Are you sure you want to remove this cargo segment?")) {
      setSubTrips(subTrips().filter(s => s.id !== subTripId));
    }
  };

  const handleSubmitMasterForm = (e?: Event) => {
    if (e) e.preventDefault();

    const finalNo = tripNoOption() === 'AUTO' ? tripNo() : selectedExistingTripNo();
    if (!finalNo) {
      alert("Please specify a valid Trip Code ID");
      return;
    }
    if (!truckNo()) {
      alert("Please select a Target Truck");
      return;
    }
    if (!driverName()) {
      alert("Please select a Driver Operator");
      return;
    }

    const payload: Partial<TripEntry> = {
      tripNo: finalNo,
      truckNo: truckNo(),
      driverName: driverName(),
      startDate: startDate(),
      endDate: endDate(),
      startingKM: startingKM(),
      endingKM: endingKM(),
      notes: notes(),
      status: status() as any,
      subTrips: subTrips(),
      advances: advances(),
      payments: payments(),
      fuels: fuels(),
      rtoExpense: rtoExpense(),
      rtoPaidByDriver: rtoPaidByDriver(),
      addBlueExpense: addBlueExpense(),
      addBluePaidByDriver: addBluePaidByDriver(),
      fastagExpense: fastagExpense(),
      fastagPaidByDriver: fastagPaidByDriver(),
      otherExpense: otherExpense(),
      otherPaidByDriver: otherPaidByDriver()
    };

    if (props.onSave) props.onSave(payload);
    if (props.onSubmit) props.onSubmit(payload);
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in font-sans">
        <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
          
          {/* MODAL TOP HEADER BAR */}
          <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                <TruckIcon class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-black text-slate-900 text-lg leading-tight">
                  {editingEntry() ? `${t('trip.edit_title', 'Edit Transport Journey')} - ${tripNo()}` : t('trip.modal_title', 'Create Transport Journey')}
                </h3>
                <p class="text-xs text-slate-500 font-medium">
                  Log multi-destination freight runs, driver advances & diesel logs
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              class="w-9 h-9 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          {/* MAIN 3-COLUMN BODY LAYOUT */}
          <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* COLUMN 1: LEFT VERTICAL STEPPER (240px) */}
            <div class="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-5 flex flex-col justify-between shrink-0 overflow-y-auto">
              <div class="space-y-4">
                <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block px-1">Form Navigation</span>
                
                <div class="space-y-2">
                  {[
                    { num: 1, title: 'Trip Details', desc: 'Vehicle, driver and trip info' },
                    { num: 2, title: 'Goods & Segments', desc: 'Goods and income details' },
                    { num: 3, title: 'Driver Advances', desc: 'Cash advances issued to driver' },
                    { num: 4, title: 'Expenses & Fuel', desc: 'Diesel fuel, RTO & tolls' }
                  ].map((step) => {
                    const isActive = () => currentStep() === step.num;
                    const isPassed = () => currentStep() > step.num;
                    return (
                      <button
                        type="button"
                        onClick={() => setCurrentStep(step.num)}
                        class={`w-full flex items-start gap-3 p-3 rounded-2xl transition-all text-left cursor-pointer border ${
                          isActive()
                            ? 'bg-blue-50/80 border-blue-200 text-blue-900 shadow-sm'
                            : isPassed()
                              ? 'bg-slate-50/60 border-slate-100 text-slate-700 hover:bg-slate-100'
                              : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <div class={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-all ${
                          isActive()
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                            : isPassed()
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-200 text-slate-500'
                        }`}>
                          {step.num}
                        </div>
                        <div class="space-y-0.5">
                          <span class={`text-xs font-bold block ${isActive() ? 'text-blue-900 font-extrabold' : 'text-slate-800'}`}>
                            {step.title}
                          </span>
                          <span class="text-[10px] text-slate-400 block leading-tight">
                            {step.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* HELP & AUTO-SAVE FOOTER CARD */}
              <div class="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100 p-4 rounded-2xl space-y-2">
                <div class="flex items-center gap-2 text-blue-700 font-bold text-xs">
                  <HelpCircle class="w-4 h-4" />
                  Need Help?
                </div>
                <p class="text-[11px] text-slate-600 leading-relaxed font-medium">
                  Fill the trip details step by step. You can navigate freely between sections before saving.
                </p>
              </div>
            </div>

            {/* COLUMN 2: CENTER STEP CONTENTS (FLEX-1) */}
            <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

              {/* STEP 1: TRIP DETAILS */}
              <Show when={currentStep() === 1}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs animate-fade-in">
                  <div class="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <TruckIcon class="w-5 h-5" />
                    </div>
                    <div>
                      <h4 class="font-extrabold text-slate-900 text-base">Trip Details</h4>
                      <p class="text-xs text-slate-500">Enter basic vehicle, driver, and journey info</p>
                    </div>
                  </div>

                  {!editingEntry() && (
                    <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div class="space-y-0.5">
                        <span class="text-xs font-bold text-slate-800 block uppercase tracking-wider font-sans">Trip Series Configuration</span>
                        <span class="text-[11px] text-slate-550 block">Unify consecutive freight loads under a single overarching sequence.</span>
                      </div>
                      <div class="flex bg-slate-200 rounded-xl p-1 gap-1 h-9 min-w-[320px]">
                        <button
                          type="button"
                          onClick={() => setTripNoOption('AUTO')}
                          class={`flex-1 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${tripNoOption() === 'AUTO'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                          Auto Series ID
                        </button>
                        <button
                          type="button"
                          disabled={existingTripNos().length === 0}
                          onClick={() => setTripNoOption('EXISTING')}
                          class={`flex-1 rounded-lg text-xs font-bold transition duration-200 disabled:opacity-40 cursor-pointer ${tripNoOption() === 'EXISTING'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                          Join Existing ({existingTripNos().length})
                        </button>
                      </div>
                    </div>
                  )}

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* TRIP CODE */}
                    <div>
                      <label class="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">{t('trip.code_id', 'Trip Code ID')} <span class="text-red-500">*</span></label>
                      {editingEntry() ? (
                        <input
                          type="text"
                          disabled
                          value={tripNo()}
                          class="w-full bg-slate-100 border border-slate-200 text-slate-500 font-mono font-bold tracking-wider rounded-lg px-3 py-2 text-xs"
                        />
                      ) : tripNoOption() === 'AUTO' ? (
                        <input
                          type="text"
                          required
                          value={tripNo()}
                          onChange={(e) => setTripNo(e.target.value)}
                          placeholder="TRIP-2026-XXXX"
                          class="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono font-bold tracking-wider rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                      ) : (
                        <select
                          value={selectedExistingTripNo()}
                          onChange={(e) => setSelectedExistingTripNo(e.target.value)}
                          required
                          class="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono font-bold tracking-wider rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                        >
                          <option value="">-- Choose Series --</option>
                          {existingTripNos().map(no => (
                            <option value={no}>{no}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* TARGET TRUCK */}
                    <div>
                      <label class="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">{t('trip.target_truck', 'Target Truck')} <span class="text-red-500">*</span></label>
                      <select
                        value={truckNo()}
                        onChange={(e) => setTruckNo(e.target.value)}
                        required
                        class="w-full bg-slate-50 border border-slate-200 text-slate-800 font-semibold rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                      >
                        <option value="">-- {t('trip.select_truck', 'Choose Truck')} --</option>
                        {trucks().map(truck => (
                          <option value={truck.truckNo}>
                            {truck.truckNo} ({truck.ownerName || 'Self'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* DRIVER NAME */}
                    <div>
                      <label class="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">{t('trip.driver_operator', 'Driver Operator')} <span class="text-red-500">*</span></label>
                      <select
                        value={driverName()}
                        onChange={(e) => setDriverName(e.target.value)}
                        required
                        class="w-full bg-slate-50 border border-slate-200 text-slate-800 font-semibold rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                      >
                        <option value="">-- {t('trip.select_driver', 'Choose Driver')} --</option>
                        {drivers().map(d => (
                          <option value={d.driverName}>
                            {d.driverName} {canViewDrivers() && d.phone ? `(${d.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label class="block text-[10px] text-slate-500 font-bold uppercase mb-1">{t('trip.start_date', 'Journey Start Date')}</label>
                      <input
                        type="date"
                        required
                        value={startDate()}
                        onChange={(e) => setStartDate(e.target.value)}
                        class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] text-slate-500 font-bold uppercase mb-1">{t('trip.end_date', 'Journey End Date')}</label>
                      <input
                        type="date"
                        required
                        value={endDate()}
                        onChange={(e) => setEndDate(e.target.value)}
                        class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] text-slate-500 font-bold uppercase mb-1">{t('trip.start_km', 'Starting Odometer (KM)')}</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={startingKM() || ''}
                        onChange={(e) => setStartingKM(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs text-right font-mono"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] text-slate-500 font-bold uppercase mb-1">{t('trip.end_km', 'Ending Odometer (KM)')}</label>
                      <input
                        type="number"
                        min="0"
                        value={endingKM() || ''}
                        onChange={(e) => setEndingKM(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0 (Optional)"
                        class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs text-right font-mono"
                      />
                    </div>
                  </div>

                  <div class="flex justify-end pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5"
                    >
                      Next: Goods & Segments ➔
                    </button>
                  </div>
                </div>
              </Show>

              {/* STEP 2: GOODS & SUB-TRIPS */}
              <Show when={currentStep() === 2}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs animate-fade-in">
                  <div class="flex justify-between items-center border-b border-slate-150 pb-3">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <ListCollapse class="w-5 h-5" />
                      </div>
                      <div>
                        <h4 class="font-extrabold text-slate-900 text-base">Goods & Cargo Segments</h4>
                        <p class="text-xs text-slate-500">Add cargo sub-trips, route paths and freight income</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenNewSubTrip}
                      class="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition shadow-sm"
                    >
                      <Plus class="w-4 h-4" /> {t('trip.add_cargo_segment', 'Add Cargo Segment')}
                    </button>
                  </div>

                  {subTrips().length > 0 ? (() => {
                    const calculatedSubTrips = subTrips().map(st => {
                      const wagesAmt = st.driverWages || 0;
                      const expenses = (st.cargoExpenses && st.cargoExpenses.length > 0)
                        ? st.cargoExpenses
                        : importLegacyCargoExpenses(st, orgProfile());

                      const segmentDeductions = expenses
                        .filter(exp => exp.deductedFrom === 'OrgRental')
                        .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

                      const segmentOfficeBears = expenses
                        .filter(exp => exp.bears === 'Office')
                        .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

                      const segmentPayments = (payments() || [])
                        .filter(p => p.subTripId === st.id)
                        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

                      const segmentReceivable = st.income - segmentDeductions + segmentOfficeBears - segmentPayments;
                      const driverSpend = expenses.filter(e => e.paidByDriver).reduce((sum, e) => sum + e.amount, 0);
                      const brokerage = expenses.filter(e => e.expenseType === 'Brokerage' && !e.paidByDriver).reduce((sum, e) => sum + e.amount, 0);

                      return { st, wagesAmt, segmentPayments, segmentReceivable, driverSpend, brokerage };
                    });

                    return (
                      <div class="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-3xs font-sans">
                        <table class="w-full min-w-[700px] text-xs text-left">
                          <thead class="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            <tr>
                              <th class="p-3 pl-4">{t('trip.tbl_seg', '# Seg')}</th>
                              <th class="p-3">{t('trip.tbl_date', 'Load Date')}</th>
                              <th class="p-3">{t('trip.tbl_office', 'Office Name')}</th>
                              <th class="p-3">{t('trip.tbl_route', 'Route Path')}</th>
                              <th class="p-3 text-right">{t('trip.tbl_income', 'Income (₹)')}</th>
                              <th class="p-3 text-right">{t('trip.tbl_wages', 'Wages (₹)')}</th>
                              <th class="p-3 text-center">{t('trip.tbl_actions', 'Edit / Delete')}</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-100 font-medium">
                            {calculatedSubTrips.map((item, sidx) => (
                              <tr class="hover:bg-slate-50/70 transition">
                                <td class="p-3 pl-4 font-bold text-slate-400">#{sidx + 1}</td>
                                <td class="p-3 font-mono text-slate-650">{item.st.loadingDate}</td>
                                <td class="p-3 text-blue-650 font-bold">{item.st.officeName}</td>
                                <td class="p-3 text-slate-800 font-semibold">{item.st.routeFrom} ➔ {item.st.routeTo}</td>
                                <td class="p-3 text-right font-bold text-emerald-800 font-mono">₹{item.st.income.toLocaleString('en-IN')}</td>
                                <td class="p-3 text-right font-medium text-amber-700 font-mono">₹{item.wagesAmt.toLocaleString('en-IN')}</td>
                                <td class="p-3 text-center">
                                  <div class="flex items-center justify-center gap-2">
                                    <button type="button" onClick={() => handleOpenEditSubTrip(item.st)} class="text-blue-600 hover:text-blue-800 font-bold text-xs"><Edit2 class="w-3.5 h-3.5" /></button>
                                    <button type="button" onClick={() => handleDeleteSubTripSegment(item.st.id)} class="text-rose-600 hover:text-rose-800 font-bold text-xs"><Trash2 class="w-3.5 h-3.5" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })() : (
                    <div class="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
                      <p class="text-xs text-slate-500 font-medium italic">No cargo sub-trip load segments drafted yet.</p>
                      <button type="button" onClick={handleOpenNewSubTrip} class="mt-3.5 bg-blue-600 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer">
                        <Plus class="w-4 h-4" /> Add First Cargo Segment
                      </button>
                    </div>
                  )}

                  <div class="flex justify-between pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setCurrentStep(1)} class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer">
                      ← Back: Trip Details
                    </button>
                    <button type="button" onClick={() => setCurrentStep(3)} class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 cursor-pointer">
                      Next: Driver Advances ➔
                    </button>
                  </div>
                </div>
              </Show>

              {/* STEP 3: DRIVER ADVANCES */}
              <Show when={currentStep() === 3}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs animate-fade-in">
                  <div class="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Coins class="w-5 h-5" />
                    </div>
                    <div>
                      <h4 class="font-extrabold text-slate-900 text-base">Driver Advances</h4>
                      <p class="text-xs text-slate-500">Record cash & bank advances issued to driver operator</p>
                    </div>
                  </div>

                  {advances() && advances().length > 0 ? (
                    <div class="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-3xs text-xs font-sans">
                      <table class="w-full min-w-[700px] text-left">
                        <thead class="bg-slate-50 text-[10px] text-slate-550 uppercase font-bold tracking-wider">
                          <tr>
                            <th class="p-2.5 pl-4">#</th>
                            <th class="p-2.5">Date Given</th>
                            <th class="p-2.5">From Account</th>
                            <th class="p-2.5 text-right font-semibold">Amount (₹)</th>
                            <th class="p-2.5 pl-6">Status / Type</th>
                            <th class="p-2.5 pl-6">Memo</th>
                            <th class="p-2.5 text-right pr-4">Discard</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          {advances().map((adv, advIdx) => {
                            const acc = activeAccounts().find(a => a.id === adv.fromAccountId);
                            const fuelCard = orgProfile()?.fuelCards?.find(fc => fc.id === adv.fromAccountId);
                            const accountDisplay = fuelCard ? `${fuelCard.cardName} (Fuel Card)` : (acc?.accountName || adv.fromAccountId);
                            return (
                              <tr class="hover:bg-slate-50 text-slate-705 font-medium">
                                <td class="p-2.5 pl-4 text-slate-400 font-bold">#{advIdx + 1}</td>
                                <td class="p-2.5 font-mono text-slate-500">{adv.date}</td>
                                <td class="p-2.5 text-blue-650 font-bold">{accountDisplay}</td>
                                <td class="p-2.5 text-right font-mono font-bold">₹{adv.amount.toLocaleString()}</td>
                                <td class="p-2.5 pl-6">
                                  {adv.receivedByDriverDirectly ? (
                                    <span class="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-bold font-sans">
                                      Received Directly by Driver
                                    </span>
                                  ) : (
                                    <span class="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 text-[10px] px-2 py-0.5 rounded-full font-bold font-sans">
                                      Issued from Office
                                    </span>
                                  )}
                                </td>
                                <td class="p-2.5 pl-6 text-slate-500 font-semibold">{adv.notes || '—'}</td>
                                <td class="p-2.5 text-right pr-4">
                                  <button type="button" onClick={() => handleRemoveAdvance(adv.id)} class="text-rose-600 hover:text-rose-800 font-bold text-[11px]">Discard</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p class="p-5 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-350">
                      No driver advances recorded for this trip yet.
                    </p>
                  )}

                  {/* Advance Registrator Form */}
                  <div class="bg-slate-50 rounded-xl border border-slate-200 border-dashed p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end shadow-3xs font-sans">
                    <div>
                      <label class="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">Advance Date</label>
                      <input ref={advanceDateInputRef} type="date" value={newAdvDate()} onChange={(e) => setNewAdvDate(e.target.value)} class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono" />
                    </div>
                    <div>
                      <label class="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">From Account</label>
                      <select value={newAdvFromAccount()} onChange={(e) => setNewAdvFromAccount(e.target.value)} class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold">
                        <option value="">-- Choose Account --</option>
                        <option value="Cash">Cash</option>
                        {orgProfile()?.fuelCards?.filter(c => c.status === 'Active' || c.id === newAdvFromAccount()).map(c => (
                          <option value={c.id}>{c.cardName} (Fuel Card)</option>
                        ))}
                        {activeAccounts().map(ac => (
                          <option value={ac.id}>{ac.accountName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label class="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">Advance Amount (₹)</label>
                      <input type="number" min="1" step="any" value={newAdvAmount()} onChange={(e) => setNewAdvAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} placeholder="₹0.00" class="w-full bg-white border border-slate-250 text-slate-855 rounded-lg px-2 py-1.5 text-xs text-right font-mono font-bold" />
                    </div>
                    <div>
                      <label class="block text-[9px] text-slate-555 font-extrabold uppercase mb-1">Advance Notes</label>
                      <input type="text" placeholder="e.g. For food/toll/misc" value={newAdvNotes()} onChange={(e) => setNewAdvNotes(e.target.value)} class="w-full bg-white border border-slate-250 text-slate-855 rounded-lg px-2.5 py-1.5 text-xs" />
                    </div>
                    <div class="flex flex-col justify-end pb-0.5">
                      <button type="button" onClick={handleAddAdvance} class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-lg cursor-pointer shadow-3xs w-full block">
                        + Issue Advance
                      </button>
                    </div>
                  </div>

                  <div class="flex justify-between pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setCurrentStep(2)} class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer">
                      ← Back: Goods
                    </button>
                    <button type="button" onClick={() => setCurrentStep(4)} class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 cursor-pointer">
                      Next: Expenses & Fuel ➔
                    </button>
                  </div>
                </div>
              </Show>

              {/* STEP 4: EXPENSES & FUEL */}
              <Show when={currentStep() === 4}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs animate-fade-in">
                  <div class="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Fuel class="w-5 h-5" />
                    </div>
                    <div>
                      <h4 class="font-extrabold text-slate-900 text-base">Expenses & Fuel</h4>
                      <p class="text-xs text-slate-500">Record diesel fuel logs, toll charges & miscellaneous operational costs</p>
                    </div>
                  </div>

                  {/* OVERLAND COMMON TRIP EXPENDITURES BLOCK */}
                  <div class="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-4 shadow-3xs border-blue-200 font-sans text-xs">
                    {/* Dynamic Fuels Block */}
                    <div class="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-4">
                      <div class="flex justify-between items-center border-b border-amber-250 pb-2">
                        <span class="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1 font-sans">
                          <Fuel class="w-3.5 h-3.5 text-amber-600" />
                          Diesel Fuel Logs ({fuels().length} entries)
                        </span>
                        <span class="text-[10px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-full font-mono">
                          Total: ₹{fuels().reduce((sum, f) => sum + f.amount, 0).toLocaleString()} (Liters: {fuels().reduce((sum, f) => sum + f.liters, 0).toLocaleString()})
                        </span>
                      </div>

                      {fuels().length > 0 && (
                        <div class="overflow-x-auto border border-amber-200 rounded-lg bg-white">
                          <table class="w-full text-left text-xs">
                            <thead class="bg-amber-100/50 text-[9px] font-extrabold text-amber-850 uppercase">
                              <tr>
                                <th class="p-2 pl-3">Date</th>
                                <th class="p-2">Liters</th>
                                <th class="p-2">Rate/Lit</th>
                                <th class="p-2 font-mono">Amount</th>
                                <th class="p-2">Fuel Station/Shop</th>
                                <th class="p-2">Account</th>
                                <th class="p-2 text-right pr-3">Action</th>
                              </tr>
                            </thead>
                            <tbody class="divide-y divide-amber-100 font-semibold text-slate-700">
                              {[...fuels()].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(f => {
                                const acctName = f.paymentMode === 'driver'
                                  ? 'Paid by Driver (from Advance)'
                                  : (accounts().find(a => a.id === f.paymentMode)?.accountName ||
                                    orgProfile()?.fuelCards?.find(fc => fc.id === f.paymentMode)?.cardName ||
                                    'Cash/General');
                                return (
                                  <tr class="hover:bg-amber-50/20">
                                    <td class="p-2 pl-3 font-mono text-[10px]">{f.date}</td>
                                    <td class="p-2 font-mono">{f.liters} L</td>
                                    <td class="p-2 font-mono">₹{f.rate}</td>
                                    <td class="p-2 font-mono text-amber-900">₹{f.amount.toLocaleString()}</td>
                                    <td class="p-2 font-sans font-bold">{f.shopName || '—'}</td>
                                    <td class="p-2 font-mono text-[10px] text-indigo-700">{acctName}</td>
                                    <td class="p-2 text-right pr-3">
                                      <button type="button" onClick={() => handleRemoveFuel(f.id)} class="text-rose-600 hover:text-rose-800 text-[10px] font-bold cursor-pointer">Remove</button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Inline fuels Builder */}
                      <div class="grid grid-cols-2 md:grid-cols-7 gap-2 bg-white/70 rounded-lg p-2 border border-amber-200/50">
                        <div>
                          <label class="block text-[9px] font-bold text-slate-500 mb-1">Fuel Date</label>
                          <input ref={fuelDateInputRef} type="date" value={newFuelDate()} onChange={(e) => setNewFuelDate(e.target.value)} class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-500" />
                        </div>
                        <div>
                          <label class="block text-[9px] font-bold text-slate-500 mb-1">Liters</label>
                          <input type="number" min="0" step="any" placeholder="0.00" value={newFuelLiters()} onChange={(e) => handleLitersChange(e.target.value === '' ? '' : parseFloat(e.target.value))} class="w-full bg-white border border-slate-200 rounded px-2 py-1 font-mono text-xs text-right" />
                        </div>
                        <div>
                          <label class="block text-[9px] font-bold text-slate-500 mb-1">Rate / Lit</label>
                          <input type="number" min="0" step="any" placeholder="0.00" value={newFuelRate()} onChange={(e) => handleRateChange(e.target.value === '' ? '' : parseFloat(e.target.value))} class="w-full bg-white border border-slate-200 rounded px-2 py-1 font-mono text-xs text-right" />
                        </div>
                        <div>
                          <label class="block text-[9px] font-bold text-slate-500 mb-1">Total Amount (₹)</label>
                          <input type="number" min="0" step="any" placeholder="0" value={newFuelAmount()} onChange={(e) => handleAmountChange(e.target.value === '' ? '' : parseFloat(e.target.value))} class="w-full bg-white border border-slate-200 rounded px-2 py-1 font-mono text-xs text-right" />
                        </div>
                        <div>
                          <label class="block text-[9px] font-bold text-slate-500 mb-1">Fuel Station Shop</label>
                          <input type="text" placeholder="e.g. TVS / SF Bunk" value={newFuelShop()} onChange={(e) => setNewFuelShop(e.target.value)} class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs" />
                        </div>
                        <div>
                          <label class="block text-[9px] font-bold text-slate-500 mb-1">Account Mode</label>
                          <select value={newFuelPaymentMode()} onChange={(e) => setNewFuelPaymentMode(e.target.value)} class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold">
                            <option value="">Cash/General Mode</option>
                            <option value="driver">Paid by Driver (from Advance)</option>
                            {activeAccounts().map(a => (<option value={a.id}>{a.accountName}</option>))}
                            {orgProfile()?.fuelCards?.filter(c => c.status === 'Active' || c.id === newFuelPaymentMode()).map(c => (<option value={c.id}>{c.cardName} (Fuel Card)</option>))}
                          </select>
                        </div>
                        <div class="flex flex-col justify-end">
                          <button type="button" onClick={handleAddFuel} class="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] py-1.5 rounded uppercase cursor-pointer">
                            + Add Fuel
                          </button>
                        </div>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start pt-2">
                      <div>
                        <label class="block text-[10px] text-slate-550 font-bold uppercase mb-1">₹ RTO Permits Expense</label>
                        <input type="number" min="0" value={rtoExpense() || ''} onChange={(e) => setRtoExpense(parseFloat(e.target.value) || 0)} placeholder="0" class="w-full bg-white border border-slate-205 text-slate-805 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono" />
                        <label class="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                          <input type="checkbox" checked={rtoPaidByDriver()} onChange={(e) => setRtoPaidByDriver(e.target.checked)} class="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3 w-3" />
                          <span class="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                        </label>
                      </div>
                      <div>
                        <label class="block text-[10px] text-slate-550 font-bold uppercase mb-1">₹ AdBlue Cost</label>
                        <input type="number" min="0" value={addBlueExpense() || ''} onChange={(e) => setAddBlueExpense(parseFloat(e.target.value) || 0)} placeholder="0" class="w-full bg-white border border-slate-205 text-slate-805 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono" />
                        <label class="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                          <input type="checkbox" checked={addBluePaidByDriver()} onChange={(e) => setAddBluePaidByDriver(e.target.checked)} class="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3 w-3" />
                          <span class="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                        </label>
                      </div>
                      <div>
                        <label class="block text-[10px] text-slate-550 font-bold uppercase mb-1">₹ Fastag Toll Charges</label>
                        <input type="number" min="0" value={fastagExpense() || ''} onChange={(e) => setFastagExpense(parseFloat(e.target.value) || 0)} placeholder="0" class="w-full bg-white border border-slate-205 text-slate-805 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono" />
                        <label class="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                          <input type="checkbox" checked={fastagPaidByDriver()} onChange={(e) => setFastagPaidByDriver(e.target.checked)} class="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3 w-3" />
                          <span class="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                        </label>
                      </div>
                      <div>
                        <label class="block text-[10px] text-slate-550 font-bold uppercase mb-1">₹ Miscellaneous Other</label>
                        <input type="number" min="0" value={otherExpense() || ''} onChange={(e) => setOtherExpense(parseFloat(e.target.value) || 0)} placeholder="0" class="w-full bg-white border border-slate-205 text-slate-805 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono" />
                        <label class="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                          <input type="checkbox" checked={otherPaidByDriver()} onChange={(e) => setOtherPaidByDriver(e.target.checked)} class="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3 w-3" />
                          <span class="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">General Transport Journey Remarks</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Full standard journey including interstate road permit, customs checkpoints, and multiple coal depot offloads."
                      value={notes()}
                      onChange={(e) => setNotes(e.target.value)}
                      class="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-500 focus:bg-white placeholder:text-slate-400"
                    />
                  </div>

                  <div class="flex justify-between pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setCurrentStep(3)} class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer">
                      ← Back: Driver Advances
                    </button>
                    <button type="button" onClick={handleSubmitMasterForm} class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md cursor-pointer flex items-center gap-2">
                      <BadgeCent class="w-4 h-4" /> Save Complete Trip Entry
                    </button>
                  </div>
                </div>
              </Show>

            </div>

            {/* COLUMN 3: RIGHT STICKY LIVE FINANCIAL SUMMARY CARD (320px) */}
            <div class="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-slate-200 p-5 shrink-0 overflow-y-auto space-y-5">
              <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 class="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Calculator class="w-4 h-4 text-blue-600" />
                  Trip Summary
                </h4>
                <span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live
                </span>
              </div>

              {/* ENHANCED LIVE SUMMARY CARDS & LEDGER METRICS */}
              {(() => {
                const tripObject: TripEntry = {
                  id: editingEntry()?.id || 'temp_trip',
                  tripNo: tripNo() || 'TEMP',
                  truckNo: truckNo() || 'TEMP',
                  driverName: driverName() || 'TEMP',
                  startDate: startDate() || '',
                  endDate: endDate() || '',
                  startingKM: startingKM() || 0,
                  endingKM: endingKM() || 0,
                  subTrips: subTrips(),
                  advances: advances(),
                  payments: payments(),
                  fuels: fuels(),
                  rtoExpense: Number(rtoExpense()) || 0,
                  rtoPaidByDriver: rtoPaidByDriver(),
                  addBlueExpense: Number(addBlueExpense()) || 0,
                  addBluePaidByDriver: addBluePaidByDriver(),
                  fastagExpense: Number(fastagExpense()) || 0,
                  fastagPaidByDriver: fastagPaidByDriver(),
                  otherExpense: Number(otherExpense()) || 0,
                  otherPaidByDriver: otherPaidByDriver(),
                  status: status() as any,
                  notes: notes()
                };

                const metrics = getTripMetrics(tripObject);
                const driverBalance = metrics.driverBalance;

                return (
                  <div class="space-y-4 font-sans text-xs">
                    {/* FINANCIAL METRIC CARDS */}
                    <div class="space-y-2.5">
                      <div class="bg-emerald-50/60 border border-emerald-100 p-3.5 rounded-2xl flex items-center justify-between">
                        <div>
                          <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Total Income</span>
                          <span class="text-[11px] text-emerald-600 font-medium">Billed Freight</span>
                        </div>
                        <span class="text-base font-black text-emerald-700 font-mono">₹{metrics.income.toLocaleString('en-IN')}</span>
                      </div>

                      <div class="bg-rose-50/60 border border-rose-100 p-3.5 rounded-2xl flex items-center justify-between">
                        <div>
                          <span class="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">Total Expenses</span>
                          <span class="text-[11px] text-rose-600 font-medium">Fuel & Permits</span>
                        </div>
                        <span class="text-base font-black text-rose-700 font-mono">₹{metrics.totalExpense.toLocaleString('en-IN')}</span>
                      </div>

                      <div class="bg-amber-50/60 border border-amber-100 p-3.5 rounded-2xl flex items-center justify-between">
                        <div>
                          <span class="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Driver Advance</span>
                          <span class="text-[11px] text-amber-600 font-medium">Cash Issued</span>
                        </div>
                        <span class="text-base font-black text-amber-700 font-mono">₹{metrics.totalIssuedToDriver.toLocaleString('en-IN')}</span>
                      </div>

                      <div class="bg-cyan-50/60 border border-cyan-100 p-3.5 rounded-2xl flex items-center justify-between">
                        <div>
                          <span class="text-[10px] font-bold uppercase tracking-wider text-cyan-800 block">Billed Outstanding</span>
                          <span class="text-[11px] text-cyan-600 font-medium">Receivables</span>
                        </div>
                        <span class="text-base font-black text-cyan-700 font-mono">₹{metrics.outstandingBalance.toLocaleString('en-IN')}</span>
                      </div>

                      <div class="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center justify-between shadow-xs">
                        <div>
                          <span class="text-[10px] font-extrabold uppercase tracking-wider text-blue-800 block">Net Revenue Margin</span>
                          <span class="text-[11px] text-blue-600 font-medium">Estimated Profit</span>
                        </div>
                        <span class={`text-lg font-black font-mono ${metrics.profit >= 0 ? 'text-blue-800' : 'text-rose-600'}`}>
                          ₹{metrics.profit.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* DRIVER BALANCE & QUICK SETTLE */}
                    <div class="bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl space-y-3 shadow-md">
                      <div class="flex justify-between items-start">
                        <div>
                          <span class="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Driver Balance</span>
                          <span class="text-[10px] text-slate-400 font-medium">{driverBalance > 0 ? 'Surplus Payable' : driverBalance < 0 ? 'Deficit Due' : 'Fully Settled'}</span>
                        </div>
                        <span class={`text-base font-black font-mono ${driverBalance > 0 ? 'text-amber-300' : driverBalance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          ₹{Math.abs(driverBalance).toLocaleString('en-IN')}
                        </span>
                      </div>

                      {driverBalance !== 0 && (
                        <div class="pt-2 border-t border-slate-800 space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowQuickFwdPanel(!showQuickFwdPanel());
                              if (!selectedFwdAmount()) {
                                setSelectedFwdAmount(Math.abs(driverBalance));
                              }
                            }}
                            class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                          >
                            <Coins class="w-3.5 h-3.5" />
                            {showQuickFwdPanel() ? 'Hide Transfer' : 'Quick Settle / Transfer'}
                          </button>

                          {showQuickFwdPanel() && (
                            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2.5 text-xs text-slate-200 font-sans">
                              <span class="text-[9px] font-extrabold uppercase text-emerald-400 block">
                                {driverBalance < 0 ? 'Settle Deficit with Account' : 'Pay Surplus from Account'}
                              </span>
                              <div class="space-y-1.5">
                                <label class="block text-[8px] uppercase text-slate-400 font-bold">Company Account</label>
                                <select
                                  value={selectedFwdAccountId()}
                                  onChange={(e) => setSelectedFwdAccountId(e.target.value)}
                                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none"
                                >
                                  <option value="">-- Choose Account --</option>
                                  <option value="Cash">Cash</option>
                                  {accounts().filter(a => a.status === 'Active').map(a => (
                                    <option value={a.id}>{a.accountName} ({a.type})</option>
                                  ))}
                                </select>
                              </div>
                              <div class="space-y-1.5">
                                <label class="block text-[8px] uppercase text-slate-400 font-bold">Amount (₹)</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={selectedFwdAmount()}
                                  onChange={(e) => setSelectedFwdAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                                  class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-slate-100 focus:outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!selectedFwdAccountId()) {
                                    alert("Please select a target company account first.");
                                    return;
                                  }
                                  const amtToSettle = Number(selectedFwdAmount()) || 0;
                                  if (amtToSettle <= 0) {
                                    alert("Please enter a valid settle amount.");
                                    return;
                                  }
                                  const targetAccount = accounts().find(a => a.id === selectedFwdAccountId());
                                  const accountName = targetAccount ? targetAccount.accountName : selectedFwdAccountId();

                                  const settleAdvance: TripAdvance = {
                                    id: 'fwd_settle_' + Date.now(),
                                    amount: driverBalance < 0 ? -amtToSettle : amtToSettle,
                                    date: new Date().toISOString().substring(0, 10),
                                    fromAccountId: selectedFwdAccountId(),
                                    notes: driverBalance < 0
                                      ? `Deficit settled with account: ${accountName}`
                                      : `Surplus paid to driver from account: ${accountName}`,
                                    receivedByDriverDirectly: false
                                  };

                                  setAdvances([...advances(), settleAdvance]);
                                  setShowQuickFwdPanel(false);
                                  setSelectedFwdAccountId('');
                                  alert(`Settled ₹${amtToSettle.toLocaleString('en-IN')} with account: ${accountName}. Please save trip form.`);
                                }}
                                class="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                              >
                                Confirm Settlement
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>

          {/* BOTTOM PANEL CONTROLS */}
          <div class="px-6 py-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0 h-16">
            <button
              type="button"
              onClick={props.onClose}
              class="px-5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              {t('trip.btn_cancel_journal', 'Cancel Journal')}
            </button>
            <div class="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSubmitMasterForm}
                class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md cursor-pointer"
              >
                {t('trip.btn_update_record', 'Update Fleet Record')}
              </button>
            </div>
          </div>

        </div>
      </div>
    </Show>
  );
}

export default TripForm;
