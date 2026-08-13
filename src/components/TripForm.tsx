/* eslint-disable @typescript-eslint/no-unused-vars */
import { createSignal, createMemo, createEffect, onMount, Show } from 'solid-js';
import { Truck, SubTrip, Account, OrganizationProfile, Driver, FuelEntry as FuelLog, TripAdvance, CargoExpense, getTripMetrics, calculateBalance, TripEntry, importLegacyCargoExpenses } from '../types';
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
  Building2,
  MapPin,
  Package,
  Scale,
  Tag,
  Wallet
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

import { useNotifications } from '../context/NotificationContext';

export function TripForm(props: TripFormProps) {
  const { t } = useLanguage();
  let notificationsCtx: any;
  try {
    notificationsCtx = useNotifications();
  } catch {
    notificationsCtx = null;
  }
  const notify = (msg: string, type: 'warning' | 'error' | 'success' | 'info' = 'warning') => {
    if (notificationsCtx?.showNotification) {
      notificationsCtx.showNotification(msg, type);
    } else {
      alert(msg);
    }
  };

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

  // Record Customer Payment modal state
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = createSignal(false);
  const [targetPaymentSubTripId, setTargetPaymentSubTripId] = createSignal<string | null>(null);
  const [paymentDate, setPaymentDate] = createSignal(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = createSignal<number | ''>('');
  const [paymentAccountId, setPaymentAccountId] = createSignal('');
  const [paymentRefNo, setPaymentRefNo] = createSignal('');
  const [paymentReceivedByDriver, setPaymentReceivedByDriver] = createSignal(false);

  const handleSavePaymentRecord = () => {
    const stId = targetPaymentSubTripId();
    if (!stId) return;
    const amt = Number(paymentAmount());
    if (!amt || amt <= 0) {
      notify('Please enter a valid payment amount', 'warning');
      return;
    }
    const isDirect = paymentReceivedByDriver();
    const pDate = paymentDate() || new Date().toISOString().split('T')[0];
    const ref = paymentRefNo() || '';

    const newRecord = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      tripId: tripNo() || 'TEMP',
      subTripId: stId,
      amount: amt,
      date: pDate,
      receivedBy: paymentAccountId() || 'Cash',
      referenceNo: ref,
      receivedByDriverDirectly: isDirect
    };
    setPayments(prev => [newRecord, ...prev]);

    if (isDirect) {
      const targetSt = subTrips().find(st => st.id === stId);
      const newAdvRecord = {
        id: `adv_direct_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        amount: amt,
        date: pDate,
        fromAccountId: paymentAccountId() || 'Cash',
        notes: `Direct Party Payment (${targetSt?.officeName || 'Sub-trip'}) ${ref ? '- Ref: ' + ref : ''}`,
        receivedByDriverDirectly: true
      };
      setAdvances(prev => [newAdvRecord, ...prev]);
    }

    setIsRecordPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentRefNo('');
    setPaymentReceivedByDriver(false);
    notify(isDirect ? 'Party payment recorded & added to Driver Advances!' : 'Payment registered successfully!', 'success');
  };
  const [stLoadingDate, setStLoadingDate] = createSignal('');
  const [stOfficeName, setStOfficeName] = createSignal('');
  const [stRouteFrom, setStRouteFrom] = createSignal('');
  const [stRouteTo, setStRouteTo] = createSignal('');
  const [stGoodsName, setStGoodsName] = createSignal('');
  const [stWeight, setStWeight] = createSignal(0);
  const [stFreightRate, setStFreightRate] = createSignal(0);
  const [stIncome, setStIncome] = createSignal(0);
  const [stDriverWages, setStDriverWages] = createSignal(0);
  const [stWagePercent, setStWagePercent] = createSignal<number | ''>(10);
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
  const [quickFwdMode, setQuickFwdMode] = createSignal<'account' | 'trip'>('account');
  const [selectedFwdAccountId, setSelectedFwdAccountId] = createSignal('');
  const [selectedFwdTripId, setSelectedFwdTripId] = createSignal('');
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
      notify("Please enter a valid advance amount > 0", "warning");
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

  const suggestedPlaces = createMemo(() => {
    const placesSet = new Set<string>();
    ['Salem', 'Attur', 'Chennai', 'Bengaluru', 'Mumbai', 'Hyderabad', 'Coimbatore', 'Trichy', 'Madurai', 'Kochi', 'Hosur', 'Namakkal', 'Sankari', 'Delhi', 'Pune', 'Kolkata', 'Vijayawada', 'Tuticorin'].forEach(p => placesSet.add(p));

    const officeList = typeof props.offices === 'function' ? props.offices() : (props.offices || []);
    officeList.forEach((o: any) => {
      if (o.officeName) placesSet.add(o.officeName);
      if (o.location) placesSet.add(o.location);
      if (o.city) placesSet.add(o.city);
    });

    const tripList = typeof props.trips === 'function' ? props.trips() : (props.trips || []);
    tripList.forEach((t: any) => {
      (t.subTrips || []).forEach((st: any) => {
        if (st.routeFrom && st.routeFrom.trim()) placesSet.add(st.routeFrom.trim());
        if (st.routeTo && st.routeTo.trim()) placesSet.add(st.routeTo.trim());
      });
    });

    subTrips().forEach((st: any) => {
      if (st.routeFrom && st.routeFrom.trim()) placesSet.add(st.routeFrom.trim());
      if (st.routeTo && st.routeTo.trim()) placesSet.add(st.routeTo.trim());
    });

    return Array.from(placesSet).sort((a, b) => a.localeCompare(b));
  });

  const handleAddFuel = () => {
    const amt = Number(newFuelAmount()) || 0;
    const lit = Number(newFuelLiters()) || 0;
    if (amt <= 0 || lit <= 0) {
      notify("Please enter valid Fuel Liters and Amount", "warning");
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
    setStWagePercent(orgProfile()?.defaultDriverWagePercent ?? 10);
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
    if (st.income && st.income > 0 && st.driverWages && st.driverWages > 0) {
      setStWagePercent(parseFloat(((st.driverWages / st.income) * 100).toFixed(1)));
    } else {
      setStWagePercent(orgProfile()?.defaultDriverWagePercent ?? 10);
    }
    let initialExps: CargoExpense[] = [];
    if (Array.isArray(st.cargoExpenses) && st.cargoExpenses.length > 0) {
      initialExps = JSON.parse(JSON.stringify(st.cargoExpenses));
    } else if (typeof st.cargoExpenses === 'string' && (st.cargoExpenses as string).trim().length > 2) {
      try {
        const parsed = JSON.parse(st.cargoExpenses);
        initialExps = Array.isArray(parsed) && parsed.length > 0 ? parsed : importLegacyCargoExpenses(st, orgProfile());
      } catch {
        initialExps = importLegacyCargoExpenses(st, orgProfile());
      }
    } else {
      initialExps = importLegacyCargoExpenses(st, orgProfile());
    }
    setStCargoExpenses(initialExps);
    setIsSubTripModalOpen(true);
  };

  const handleDeleteSubTripSegment = (subTripId: string) => {
    const doDelete = () => setSubTrips(subTrips().filter(s => s.id !== subTripId));
    if (props.confirmAction) {
      props.confirmAction("Are you sure you want to remove this cargo segment?", doDelete, "Remove Cargo Segment");
    } else {
      doDelete();
    }
  };

  // ── Sub-trip modal handlers ────────────────────────────────────────────
  const handleCloseSubTripModal = () => {
    setIsSubTripModalOpen(false);
    setEditingSubTripId(null);
    setStLoadingDate('');
    setStOfficeName('');
    setStRouteFrom('');
    setStRouteTo('');
    setStGoodsName('');
    setStWeight(0);
    setStFreightRate(0);
    setStIncome(0);
    setStDriverWages(0);
    setStCargoExpenses([]);
    setNewExpType('Loading');
    setNewExpAmount('');
    setNewExpDeductedFrom('OrgRental');
    setNewExpPaidByDriver(false);
    setNewExpBears('Office');
  };

  const handleSaveSubTrip = () => {
    if (!stRouteFrom().trim() || !stRouteTo().trim()) {
      notify('Please enter Route From and Route To.', 'warning');
      return;
    }
    if (stIncome() <= 0) {
      notify('Please enter a valid Income amount.', 'warning');
      return;
    }

    const existingId = editingSubTripId();
    if (existingId) {
      // Update existing sub-trip
      setSubTrips(subTrips().map(s => s.id === existingId ? {
        ...s,
        loadingDate: stLoadingDate(),
        officeName: stOfficeName(),
        routeFrom: stRouteFrom(),
        routeTo: stRouteTo(),
        material: stGoodsName(),
        noOfTons: stWeight(),
        ratePerTon: stFreightRate(),
        income: stIncome(),
        driverWages: stDriverWages(),
        cargoExpenses: stCargoExpenses(),
      } : s));
    } else {
      // Add new sub-trip
      const newSt: SubTrip = {
        id: 'st_' + Date.now(),
        loadingDate: stLoadingDate() || startDate() || new Date().toISOString().substring(0, 10),
        officeName: stOfficeName(),
        routeFrom: stRouteFrom(),
        routeTo: stRouteTo(),
        material: stGoodsName(),
        noOfTons: stWeight(),
        ratePerTon: stFreightRate(),
        income: stIncome(),
        driverWages: stDriverWages(),
        loadingExpense: 0,
        unloadingExpense: 0,
        startingKM: 0,
        endingKM: 0,
        cargoExpenses: stCargoExpenses(),
      };
      setSubTrips([...subTrips(), newSt]);
    }
    handleCloseSubTripModal();
  };

  const handleAddCargoExpense = () => {
    const amt = Number(newExpAmount()) || 0;
    if (amt <= 0) {
      notify('Please enter a valid expense amount > 0', 'warning');
      return;
    }
    const exp: CargoExpense = {
      id: 'cexp_' + Date.now(),
      expenseType: newExpType(),
      amount: amt,
      paidByDriver: newExpDeductedFrom() === 'DriverDirect',
      deductedFrom: newExpDeductedFrom(),
      bears: newExpBears(),
    };
    setStCargoExpenses([...stCargoExpenses(), exp]);
    setNewExpAmount('');
  };

  const handleRemoveCargoExpense = (id: string) => {
    setStCargoExpenses(stCargoExpenses().filter(e => e.id !== id));
  };
  // ── END Sub-trip modal handlers ─────────────────────────────────────────

  const handleSubmitMasterForm = (e?: Event) => {
    if (e) e.preventDefault();

    let finalNo = tripNoOption() === 'AUTO' ? tripNo() : selectedExistingTripNo();
    if (!finalNo) {
      notify("Please specify a valid Trip Code ID", "warning");
      return;
    }
    if (!truckNo()) {
      notify("Please select a Target Truck", "warning");
      return;
    }
    if (!driverName()) {
      notify("Please select a Driver Operator", "warning");
      return;
    }

    // Disambiguate if another user created a trip with the exact same tripNo concurrently
    const currentTripsList: TripEntry[] = typeof props.trips === 'function' ? (props.trips as any)() : (props.trips || []);
    if (!editingEntry() && currentTripsList.some(t => t.tripNo === finalNo)) {
      const uniqueSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
      finalNo = `${finalNo}-${uniqueSuffix}`;
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
        <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden">

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
                    { num: 4, title: 'Diesel Fuel Logs', desc: 'Track diesel fuel purchases' },
                    { num: 5, title: 'Other Expenses', desc: 'RTO, tolls, adblue & notes' }
                  ].map((step) => {
                    const isActive = () => currentStep() === step.num;
                    const isPassed = () => currentStep() > step.num;
                    return (
                      <button
                        type="button"
                        onClick={() => setCurrentStep(step.num)}
                        class={`w-full flex items-start gap-3 p-3 rounded-2xl transition-all text-left cursor-pointer border ${isActive()
                          ? 'bg-blue-50/80 border-blue-200 text-blue-900 shadow-sm'
                          : isPassed()
                            ? 'bg-slate-50/60 border-slate-100 text-slate-700 hover:bg-slate-100'
                            : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-50'
                          }`}
                      >
                        <div class={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-all ${isActive()
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
            <div class="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6 bg-slate-50/50">

              {/* STEP 1: TRIP DETAILS */}
              <Show when={currentStep() === 1}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs animate-fade-in">
                  <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <TruckIcon class="w-5 h-5" />
                      </div>
                      <div>
                        <h4 class="font-extrabold text-slate-900 text-base">Trip Details</h4>
                        <p class="text-xs text-slate-500">Enter basic vehicle, driver, and journey info</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5 transition shrink-0"
                    >
                      Next: Goods & Segments ➔
                    </button>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                    {/* TRIP CODE */}
                    <div>
                      <label class="h-6 flex items-end text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">{t('trip.code_id', 'Trip Code ID')} <span class="text-red-500 ml-0.5">*</span></label>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={tripNo()}
                        class="w-full h-9 bg-slate-100 border border-slate-200 text-slate-700 font-mono font-extrabold tracking-wider rounded-xl px-3 text-xs select-none cursor-not-allowed"
                        title="System Auto-Generated Trip Series Code"
                      />
                    </div>

                    {/* TARGET TRUCK */}
                    <div>
                      <label class="h-6 flex items-end text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">{t('trip.target_truck', 'Target Truck')} <span class="text-red-500 ml-0.5">*</span></label>
                      <select
                        value={truckNo()}
                        onChange={(e) => setTruckNo(e.target.value)}
                        required
                        class="w-full h-9 bg-slate-50 border border-slate-200 text-slate-800 font-semibold rounded-xl px-3 text-xs focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                      >
                        <option value="">-- {t('trip.select_truck', 'Choose Truck')} --</option>
                        {truckNo() && !trucks().some(t => t.truckNo === truckNo()) && (
                          <option value={truckNo()}>{truckNo()}</option>
                        )}
                        {trucks().map(truck => (
                          <option value={truck.truckNo}>
                            {truck.truckNo} ({truck.ownerName || 'Self'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* DRIVER NAME */}
                    <div>
                      <label class="h-6 flex items-end text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">{t('trip.driver_operator', 'Driver Operator')} <span class="text-red-500 ml-0.5">*</span></label>
                      <select
                        value={driverName()}
                        onChange={(e) => setDriverName(e.target.value)}
                        required
                        class="w-full h-9 bg-slate-50 border border-slate-200 text-slate-800 font-semibold rounded-xl px-3 text-xs focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                      >
                        <option value="">-- {t('trip.select_driver', 'Choose Driver')} --</option>
                        {driverName() && !drivers().some(d => d.driverName === driverName()) && (
                          <option value={driverName()}>{driverName()}</option>
                        )}
                        {drivers().map(d => (
                          <option value={d.driverName}>
                            {d.driverName} {canViewDrivers() && d.phone ? `(${d.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* TRIP STATUS */}
                    <div>
                      <label class="h-6 flex items-end text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">Trip Status <span class="text-red-500 ml-0.5">*</span></label>
                      <select
                        value={status()}
                        onChange={(e) => setStatus(e.target.value as any)}
                        class="w-full h-9 bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 text-xs focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Settled">Settled</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 items-end">
                    <div>
                      <label class="h-7 flex items-end text-[10px] text-slate-500 font-extrabold uppercase tracking-wider mb-1.5">{t('trip.start_date', 'Journey Start Date')}</label>
                      <input
                        type="date"
                        required
                        value={startDate()}
                        onChange={(e) => { if (e.currentTarget.value) setStartDate(e.currentTarget.value); }}
                        onBlur={(e) => { if (e.currentTarget.value) setStartDate(e.currentTarget.value); }}
                        class="w-full h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-xs font-medium focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="h-7 flex items-end text-[10px] text-slate-500 font-extrabold uppercase tracking-wider mb-1.5">{t('trip.end_date', 'Journey End Date')}</label>
                      <input
                        type="date"
                        required
                        value={endDate()}
                        onChange={(e) => { if (e.currentTarget.value) setEndDate(e.currentTarget.value); }}
                        onBlur={(e) => { if (e.currentTarget.value) setEndDate(e.currentTarget.value); }}
                        class="w-full h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-xs font-medium focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="h-7 flex items-end text-[10px] text-slate-500 font-extrabold uppercase tracking-wider mb-1.5">{t('trip.start_km', 'Starting KM')}</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={startingKM() || ''}
                        onChange={(e) => setStartingKM(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        class="w-full h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-xs text-right font-mono font-bold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="h-7 flex items-end text-[10px] text-slate-500 font-extrabold uppercase tracking-wider mb-1.5">{t('trip.end_km', 'Ending KM')}</label>
                      <input
                        type="number"
                        min="0"
                        value={endingKM() || ''}
                        onChange={(e) => setEndingKM(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0 (Optional)"
                        class="w-full h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-xs text-right font-mono font-bold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </Show>

              {/* STEP 2: GOODS & SUB-TRIPS */}
              <Show when={currentStep() === 2}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs animate-fade-in">
                  <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <ListCollapse class="w-5 h-5" />
                      </div>
                      <div>
                        <h4 class="font-extrabold text-slate-900 text-base">Goods & Cargo Segments</h4>
                        <p class="text-xs text-slate-500">Add cargo sub-trips, route paths and freight income</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenNewSubTrip}
                        class="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition shadow-sm"
                      >
                        <Plus class="w-4 h-4" /> {t('trip.add_cargo_segment', 'Add Cargo Segment')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5 transition"
                      >
                        Next: Driver Advances ➔
                      </button>
                    </div>
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

                    const totalIncome = calculatedSubTrips.reduce((s, i) => s + i.st.income, 0);
                    const totalWages = calculatedSubTrips.reduce((s, i) => s + i.wagesAmt, 0);
                    const totalCargoExp = calculatedSubTrips.reduce((s, i) => {
                      const exps = (i.st.cargoExpenses && i.st.cargoExpenses.length > 0)
                        ? i.st.cargoExpenses
                        : importLegacyCargoExpenses(i.st, orgProfile());
                      return s + exps.reduce((es, e) => es + (Number(e.amount) || 0), 0);
                    }, 0);

                    return (
                      <div class="space-y-3">
                        <div class="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                          {calculatedSubTrips.map((item, sidx) => {
                            const rowExps = (item.st.cargoExpenses && item.st.cargoExpenses.length > 0)
                              ? item.st.cargoExpenses
                              : importLegacyCargoExpenses(item.st, orgProfile());
                            const cargoTotal = rowExps.reduce((s, e) => s + (Number(e.amount) || 0), 0);
                            const expBadges = ['Loading', 'Unloading', 'Brokerage', 'RMC', 'Crossing'].filter(
                              type => rowExps.some(e => e.expenseType === type)
                            );

                            return (
                              <div class="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-3.5 shadow-xs transition-all space-y-2.5 font-sans">
                                {/* CARD HEADER: Route Icon + Office Name + Date Badge + Action Settings */}
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

                                  {/* ACTION BUTTONS (Edit & Delete) */}
                                  <div class="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditSubTrip(item.st)}
                                      class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center transition cursor-pointer"
                                      title="Edit Segment"
                                    >
                                      <Edit2 class="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubTripSegment(item.st.id)}
                                      class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                                      title="Delete Segment"
                                    >
                                      <Trash2 class="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* HIGHLIGHTED ROUTE BANNER BOX */}
                                <div class="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between">
                                  <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Route Path</span>
                                  <div class="flex items-center gap-2 text-xs font-black text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-2xs">
                                    <span>{item.st.routeFrom || '?'}</span>
                                    <span class="text-blue-600 font-black">➔</span>
                                    <span>{item.st.routeTo || '?'}</span>
                                  </div>
                                </div>

                                {/* TWO SEPARATE SIDE-BY-SIDE COLUMNS: Left (Freight & Ledger) | Right (Cargo Expenses Breakdown) */}
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* LEFT SIDE: FREIGHT & LEDGER METRICS */}
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

                                  {/* RIGHT SIDE: ITEMIZED CARGO EXPENSE BREAKDOWN */}
                                  <div class="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 space-y-1.5 text-xs">
                                    <span class="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                                      Cargo Expense Breakdown
                                    </span>

                                    {(() => {
                                      const getAmt = (type: string) => rowExps.filter(e => e.expenseType === type).reduce((s, e) => s + (Number(e.amount) || 0), 0);
                                      const items = [
                                        { label: 'Loading', amt: getAmt('Loading') },
                                        { label: 'Unloading', amt: getAmt('Unloading') },
                                        { label: 'RMC', amt: getAmt('RMC') },
                                        { label: 'Crossing (Mamul)', amt: getAmt('Crossing') },
                                        { label: 'Brokerage', amt: getAmt('Brokerage') }
                                      ];
                                      return (
                                        <>
                                          {items.map(expItem => (
                                            <div class="flex items-center justify-between py-0.5 border-b border-slate-150">
                                              <span class="text-slate-600 font-medium text-[11px]">{expItem.label}</span>
                                              <span class={`font-mono text-xs font-bold ${expItem.amt > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                                                {expItem.amt > 0 ? `₹${expItem.amt.toLocaleString('en-IN')}` : '—'}
                                              </span>
                                            </div>
                                          ))}
                                          <div class="flex items-center justify-between pt-1 border-t-2 border-slate-200">
                                            <span class="text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">Total Cargo Exp</span>
                                            <span class="bg-rose-50 text-rose-700 border border-rose-200 font-mono font-black text-xs px-2 py-0.5 rounded-md">
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

                        {/* TOTALS SUMMARY BAR */}
                        <div class="bg-slate-900 text-white rounded-2xl p-3.5 flex items-center justify-between shadow-md">
                          <span class="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                            Totals — {calculatedSubTrips.length} Cargo Segment{calculatedSubTrips.length !== 1 ? 's' : ''}
                          </span>
                          <div class="flex items-center gap-4 text-xs font-mono font-bold">
                            <div>
                              <span class="text-[9px] text-slate-400 uppercase block font-sans">Income</span>
                              <span class="text-emerald-400 font-black">₹{totalIncome.toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                              <span class="text-[9px] text-slate-400 uppercase block font-sans">Wages</span>
                              <span class="text-amber-300 font-black">₹{totalWages.toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                              <span class="text-[9px] text-slate-400 uppercase block font-sans">Cargo Exp</span>
                              <span class="text-rose-400 font-black">₹{totalCargoExp.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    <div class="text-center py-14 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
                      <ListCollapse class="w-8 h-8 text-slate-300 mx-auto mb-3" />
                      <p class="text-xs text-slate-500 font-medium italic">No cargo sub-trip load segments drafted yet.</p>
                      <button type="button" onClick={handleOpenNewSubTrip} class="mt-4 bg-blue-600 text-white font-bold text-xs py-2 px-5 rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer hover:bg-blue-700 transition">
                        <Plus class="w-4 h-4" /> Add First Cargo Segment
                      </button>
                    </div>
                  )}
                </div>
              </Show>

              {/* STEP 3: DRIVER ADVANCES */}
              <Show when={currentStep() === 3}>
                <div class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs animate-fade-in">
                  <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Coins class="w-5 h-5" />
                      </div>
                      <div>
                        <h4 class="font-extrabold text-slate-900 text-base">Driver Advances</h4>
                        <p class="text-xs text-slate-500">Record cash & bank advances issued to driver operator</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(4)}
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5 transition"
                      >
                        Next: Diesel Fuel ➔
                      </button>
                    </div>
                  </div>

                  {advances() && advances().length > 0 ? (
                    <div class="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-2xs text-xs font-sans">
                      <table class="w-full text-left table-fixed">
                        <thead class="bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider border-b border-slate-200">
                          <tr>
                            <th class="p-2.5 pl-3 w-8">#</th>
                            <th class="p-2.5 w-24">Date</th>
                            <th class="p-2.5 w-20">Account</th>
                            <th class="p-2.5 text-right w-24">Amount (₹)</th>
                            <th class="p-2.5 w-28">Status</th>
                            <th class="p-2.5">Memo / Ref No.</th>
                            <th class="p-2.5 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          {advances().map((adv, advIdx) => {
                            const acc = activeAccounts().find(a => a.id === adv.fromAccountId);
                            const fuelCard = orgProfile()?.fuelCards?.find(fc => fc.id === adv.fromAccountId);
                            const accountDisplay = fuelCard ? `${fuelCard.cardName}` : (acc?.accountName || adv.fromAccountId);
                            return (
                              <tr class="hover:bg-slate-50/80 text-slate-800 transition">
                                <td class="p-2.5 pl-3 text-slate-400 font-bold">#{advIdx + 1}</td>
                                <td class="p-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{adv.date}</td>
                                <td class="p-2.5 font-bold text-slate-900 truncate">{accountDisplay}</td>
                                <td class="p-2.5 text-right font-mono font-black text-slate-900 whitespace-nowrap">₹{adv.amount.toLocaleString('en-IN')}</td>
                                <td class="p-2.5 whitespace-nowrap">
                                  {adv.receivedByDriverDirectly ? (
                                    <span class="inline-flex items-center text-emerald-800 bg-emerald-100/80 text-[10px] px-2 py-0.5 rounded-md font-extrabold font-sans">
                                      Driver Direct
                                    </span>
                                  ) : (
                                    <span class="inline-flex items-center text-amber-800 bg-amber-100/80 text-[10px] px-2 py-0.5 rounded-md font-extrabold font-sans">
                                      Office
                                    </span>
                                  )}
                                </td>
                                <td class="p-2.5 text-slate-700 font-mono text-[11px] font-semibold truncate" title={adv.notes || ''}>{adv.notes || '—'}</td>
                                <td class="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAdvance(adv.id)}
                                    class="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center transition cursor-pointer"
                                    title="Remove Advance"
                                  >
                                    <Trash2 class="w-3.5 h-3.5" />
                                  </button>
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
                  <div class="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 grid grid-cols-1 md:grid-cols-12 gap-2 items-end shadow-2xs font-sans w-full">
                    <div class="md:col-span-3">
                      <label class="h-6 flex items-end text-[10px] text-slate-500 font-extrabold uppercase tracking-wider mb-1.5 truncate">Advance Date</label>
                      <input
                        ref={advanceDateInputRef}
                        type="date"
                        value={newAdvDate()}
                        onChange={(e) => { if (e.currentTarget.value) setNewAdvDate(e.currentTarget.value); }}
                        class="w-full h-10 bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div class="md:col-span-3">
                      <label class="h-6 flex items-end text-[10px] text-slate-500 font-extrabold uppercase tracking-wider mb-1.5 truncate">Account</label>
                      <select
                        value={newAdvFromAccount()}
                        onChange={(e) => setNewAdvFromAccount(e.target.value)}
                        class="w-full h-10 bg-white border border-slate-200 text-slate-800 rounded-xl px-2 text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer transition truncate"
                      >
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
                    <div class="md:col-span-2">
                      <label class="h-6 flex items-end text-[10px] text-slate-500 font-extrabold uppercase tracking-wider mb-1.5 truncate">Amount (₹)</label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={newAdvAmount()}
                        onChange={(e) => setNewAdvAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                        placeholder="₹0.00"
                        class="w-full h-10 bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 text-xs text-right font-mono font-bold focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div class="md:col-span-3">
                      <label class="h-6 flex items-end text-[10px] text-slate-500 font-extrabold uppercase tracking-wider mb-1.5 truncate">Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. For food/toll/misc"
                        value={newAdvNotes()}
                        onChange={(e) => setNewAdvNotes(e.target.value)}
                        class="w-full h-10 bg-white border border-slate-200 text-slate-800 rounded-xl px-2.5 text-xs font-medium focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div class="md:col-span-1">
                      <div class="hidden md:block h-6 mb-1.5" />
                      <button
                        type="button"
                        onClick={handleAddAdvance}
                        class="w-full h-10 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200/80 rounded-xl flex items-center justify-center transition cursor-pointer shadow-2xs"
                        title="Add Driver Advance"
                      >
                        <Plus class="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </Show>

              {/* STEP 4: DIESEL FUEL LOGS */}
              <Show when={currentStep() === 4}>
                <div class="space-y-5 animate-fade-in font-sans">
                  {/* Step Header Banner */}
                  <div class="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
                        <Fuel class="w-5 h-5" />
                      </div>
                      <div>
                        <h4 class="font-extrabold text-slate-900 text-base leading-tight">Diesel Fuel Logs</h4>
                        <p class="text-xs text-slate-500 font-medium">Record diesel fuel purchases for this journey</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(5)}
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5 transition"
                      >
                        Next: Other Expenses ➔
                      </button>
                    </div>
                  </div>

                  {/* Card 1: Diesel Fuel Logs */}
                  <div class="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-2xs">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Fuel class="w-5 h-5" />
                        </div>
                        <div>
                          <div class="flex items-center gap-2">
                            <h4 class="font-bold text-slate-900 text-sm">Diesel Fuel Logs</h4>
                            <span class="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-extrabold">
                              {fuels().length} {fuels().length === 1 ? 'entry' : 'entries'}
                            </span>
                          </div>
                          <p class="text-xs text-slate-500 font-medium">Track diesel purchases for this journey</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-4 self-end sm:self-auto">
                        <div class="text-right">
                          <div class="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Total Fuel Cost</div>
                          <div class="text-sm font-black text-emerald-700 font-mono">₹{fuels().reduce((sum, f) => sum + f.amount, 0).toLocaleString('en-IN')}</div>
                        </div>
                        <div class="w-px h-7 bg-slate-200" />
                        <div class="text-right">
                          <div class="text-xs font-mono font-bold text-slate-700">💧 {fuels().reduce((sum, f) => sum + f.liters, 0).toLocaleString()} L</div>
                          <div class="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Total Liters</div>
                        </div>
                      </div>
                    </div>

                    {/* Table of Added Fuel Logs */}
                    {fuels().length > 0 && (
                      <div class="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-2xs text-xs font-sans">
                        <table class="w-full text-left">
                          <thead class="bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider border-b border-slate-200">
                            <tr>
                              <th class="p-2.5 pl-4">DATE</th>
                              <th class="p-2.5">LITERS</th>
                              <th class="p-2.5">RATE / LIT</th>
                              <th class="p-2.5">AMOUNT (₹)</th>
                              <th class="p-2.5">FUEL STATION / SHOP</th>
                              <th class="p-2.5">ACCOUNT</th>
                              <th class="p-2.5 text-center w-10">ACTION</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-100 font-medium">
                            {[...fuels()].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(f => {
                              const acctName = f.paymentMode === 'driver'
                                ? 'Paid by Driver (from Advance)'
                                : (accounts().find(a => a.id === f.paymentMode)?.accountName ||
                                  orgProfile()?.fuelCards?.find(fc => fc.id === f.paymentMode)?.cardName ||
                                  'Cash / General');
                              return (
                                <tr class="hover:bg-slate-50/80 text-slate-800 transition">
                                  <td class="p-2.5 pl-4 font-mono text-slate-600">{f.date}</td>
                                  <td class="p-2.5 font-mono font-bold">{f.liters} L</td>
                                  <td class="p-2.5 font-mono text-slate-700">₹{f.rate}</td>
                                  <td class="p-2.5 font-mono font-black text-emerald-600">₹{f.amount.toLocaleString('en-IN')}</td>
                                  <td class="p-2.5 font-semibold text-slate-700">{f.shopName || '—'}</td>
                                  <td class="p-2.5 text-blue-600 font-bold">{acctName}</td>
                                  <td class="p-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveFuel(f.id)}
                                      class="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center transition cursor-pointer"
                                      title="Remove Fuel Entry"
                                    >
                                      <Trash2 class="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Add New Fuel Entry Form Box */}
                    <div class="bg-emerald-50/30 border border-emerald-200/60 rounded-2xl p-4 space-y-3">
                      <div class="flex items-center justify-between font-bold text-xs text-slate-800">
                        <span class="flex items-center gap-2">
                          <Fuel class="w-4 h-4 text-emerald-600" /> Add New Fuel Entry
                        </span>
                      </div>

                      {/* Row 1: Fuel Metrics */}
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
                        <div>
                          <label class="h-5 flex items-end text-[10px] text-slate-500 font-extrabold mb-1">Date <span class="text-red-500 ml-0.5">*</span></label>
                          <input ref={fuelDateInputRef} type="date" value={newFuelDate()} onChange={(e) => setNewFuelDate(e.target.value)} class="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:border-emerald-500 transition" />
                        </div>
                        <div>
                          <label class="h-5 flex items-end text-[10px] text-slate-500 font-extrabold mb-1">Liters <span class="text-red-500 ml-0.5">*</span></label>
                          <input type="number" min="0" step="any" placeholder="e.g. 100" value={newFuelLiters()} onChange={(e) => handleLitersChange(e.target.value === '' ? '' : parseFloat(e.target.value))} class="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs text-right font-mono font-bold focus:outline-none focus:border-emerald-500 transition" />
                        </div>
                        <div>
                          <label class="h-5 flex items-end text-[10px] text-slate-500 font-extrabold mb-1">Rate / Lit (₹) <span class="text-red-500 ml-0.5">*</span></label>
                          <input type="number" min="0" step="any" placeholder="e.g. 100" value={newFuelRate()} onChange={(e) => handleRateChange(e.target.value === '' ? '' : parseFloat(e.target.value))} class="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs text-right font-mono font-bold focus:outline-none focus:border-emerald-500 transition" />
                        </div>
                        <div>
                          <label class="h-5 flex items-end text-[10px] text-slate-500 font-extrabold mb-1">Total Amount (₹)</label>
                          <input type="number" min="0" step="any" placeholder="0" value={newFuelAmount()} onChange={(e) => handleAmountChange(e.target.value === '' ? '' : parseFloat(e.target.value))} class="w-full h-10 bg-slate-100/80 border border-slate-200 rounded-xl px-3 text-xs text-right font-mono font-black text-slate-900 focus:outline-none" />
                          <span class="text-[9px] text-slate-400 block text-right mt-0.5 font-medium">Auto calculated</span>
                        </div>
                      </div>

                      {/* Row 2: Vendor, Account & Action Button */}
                      <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-1 border-t border-emerald-200/40">
                        <div class="md:col-span-6">
                          <label class="h-5 flex items-end text-[10px] text-slate-500 font-extrabold mb-1">Fuel Station / Shop</label>
                          <input type="text" placeholder="e.g. TVS Fuel Station" value={newFuelShop()} onChange={(e) => setNewFuelShop(e.target.value)} class="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:border-emerald-500 transition" />
                        </div>
                        <div class="md:col-span-5">
                          <label class="h-5 flex items-end text-[10px] text-slate-500 font-extrabold mb-1">Account <span class="text-red-500 ml-0.5">*</span></label>
                          <select value={newFuelPaymentMode()} onChange={(e) => setNewFuelPaymentMode(e.target.value)} class="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer transition">
                            <option value="">Cash</option>
                            <option value="driver">Paid by Driver (from Advance)</option>
                            {activeAccounts().map(a => (<option value={a.id}>{a.accountName}</option>))}
                            {orgProfile()?.fuelCards?.filter(c => c.status === 'Active' || c.id === newFuelPaymentMode()).map(c => (<option value={c.id}>{c.cardName} (Fuel Card)</option>))}
                          </select>
                        </div>
                        <div class="md:col-span-1">
                          <button
                            type="button"
                            onClick={handleAddFuel}
                            class="w-full h-10 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200/80 rounded-xl flex items-center justify-center transition cursor-pointer shadow-2xs"
                            title="Add Fuel Entry"
                          >
                            <Plus class="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </Show>

              {/* STEP 5: OTHER JOURNEY EXPENSES */}
              <Show when={currentStep() === 5}>
                <div class="space-y-5 animate-fade-in font-sans">
                  {/* Step Header Banner */}
                  <div class="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                        <Receipt class="w-5 h-5" />
                      </div>
                      <div>
                        <h4 class="font-extrabold text-slate-900 text-base leading-tight">Other Journey Expenses</h4>
                        <p class="text-xs text-slate-500 font-medium">Log toll charges, permits, adblue & miscellaneous journey costs</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                      title="Back to Diesel Fuel Logs"
                    >
                      ← Back: Diesel Fuel Logs
                    </button>
                  </div>

                  {/* Card 1: Other Journey Expenses */}
                  <div class="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-2xs">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                          <Receipt class="w-5 h-5" />
                        </div>
                        <div>
                          <h4 class="font-bold text-slate-900 text-sm">Other Journey Expenses</h4>
                          <p class="text-xs text-slate-500 font-medium">Toll charges, permits, adblue & other costs</p>
                        </div>
                      </div>
                      {(() => {
                        const driverPaidTotal =
                          (rtoPaidByDriver() ? Number(rtoExpense()) || 0 : 0) +
                          (addBluePaidByDriver() ? Number(addBlueExpense()) || 0 : 0) +
                          (fastagPaidByDriver() ? Number(fastagExpense()) || 0 : 0) +
                          (otherPaidByDriver() ? Number(otherExpense()) || 0 : 0);
                        const otherTotal = (Number(rtoExpense()) || 0) + (Number(addBlueExpense()) || 0) + (Number(fastagExpense()) || 0) + (Number(otherExpense()) || 0);
                        return (
                          <div class="flex items-center gap-3 self-end sm:self-auto">
                            <div class="text-right">
                              <div class="text-[9px] font-extrabold text-amber-600 uppercase tracking-wider">Driver Paid</div>
                              <div class="text-sm font-black text-amber-800 font-mono">₹{driverPaidTotal.toLocaleString('en-IN')}</div>
                            </div>
                            <div class="w-px h-7 bg-slate-200" />
                            <div class="text-right">
                              <div class="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Total Other Exp</div>
                              <div class="text-sm font-black text-slate-900 font-mono">₹{otherTotal.toLocaleString('en-IN')}</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div class="space-y-3">
                      {/* RTO Permits */}
                      <div class="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <FileText class="w-4 h-4" />
                          </div>
                          <span class="font-bold text-slate-800 text-xs">RTO Permits Expense</span>
                        </div>
                        <div class="flex items-center gap-3">
                          <div>
                            <label class="block text-[9px] font-extrabold text-slate-400 uppercase mb-0.5">Amount (₹)</label>
                            <input
                              type="number"
                              min="0"
                              value={rtoExpense() || ''}
                              onChange={(e) => setRtoExpense(parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              class="w-36 h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-xs text-right font-mono font-bold focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div class="self-end">
                            <button
                              type="button"
                              onClick={() => setRtoPaidByDriver(!rtoPaidByDriver())}
                              class={`h-9 px-3 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer border ${rtoPaidByDriver()
                                ? 'bg-amber-100/90 text-amber-900 border-amber-300 shadow-2xs'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                              <span class={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${rtoPaidByDriver() ? 'bg-amber-600 text-white font-black' : 'border border-slate-300'
                                }`}>
                                {rtoPaidByDriver() ? '✓' : ''}
                              </span>
                              Paid by Driver
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* AdBlue Cost */}
                      <div class="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                            <Coins class="w-4 h-4" />
                          </div>
                          <span class="font-bold text-slate-800 text-xs">AdBlue Cost</span>
                        </div>
                        <div class="flex items-center gap-3">
                          <div>
                            <label class="block text-[9px] font-extrabold text-slate-400 uppercase mb-0.5">Amount (₹)</label>
                            <input
                              type="number"
                              min="0"
                              value={addBlueExpense() || ''}
                              onChange={(e) => setAddBlueExpense(parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              class="w-36 h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-xs text-right font-mono font-bold focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div class="self-end">
                            <button
                              type="button"
                              onClick={() => setAddBluePaidByDriver(!addBluePaidByDriver())}
                              class={`h-9 px-3 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer border ${addBluePaidByDriver()
                                ? 'bg-amber-100/90 text-amber-900 border-amber-300 shadow-2xs'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                              <span class={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${addBluePaidByDriver() ? 'bg-amber-600 text-white font-black' : 'border border-slate-300'
                                }`}>
                                {addBluePaidByDriver() ? '✓' : ''}
                              </span>
                              Paid by Driver
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* FASTag / Toll Charges */}
                      <div class="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <BadgeCent class="w-4 h-4" />
                          </div>
                          <span class="font-bold text-slate-800 text-xs">FASTag / Toll Charges</span>
                        </div>
                        <div class="flex items-center gap-3">
                          <div>
                            <label class="block text-[9px] font-extrabold text-slate-400 uppercase mb-0.5">Amount (₹)</label>
                            <input
                              type="number"
                              min="0"
                              value={fastagExpense() || ''}
                              onChange={(e) => setFastagExpense(parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              class="w-36 h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-xs text-right font-mono font-bold focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div class="self-end">
                            <button
                              type="button"
                              onClick={() => setFastagPaidByDriver(!fastagPaidByDriver())}
                              class={`h-9 px-3 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer border ${fastagPaidByDriver()
                                ? 'bg-amber-100/90 text-amber-900 border-amber-300 shadow-2xs'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                              <span class={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${fastagPaidByDriver() ? 'bg-amber-600 text-white font-black' : 'border border-slate-300'
                                }`}>
                                {fastagPaidByDriver() ? '✓' : ''}
                              </span>
                              Paid by Driver
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Miscellaneous Other */}
                      <div class="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <HelpCircle class="w-4 h-4" />
                          </div>
                          <span class="font-bold text-slate-800 text-xs">Miscellaneous Other</span>
                        </div>
                        <div class="flex items-center gap-3">
                          <div>
                            <label class="block text-[9px] font-extrabold text-slate-400 uppercase mb-0.5">Amount (₹)</label>
                            <input
                              type="number"
                              min="0"
                              value={otherExpense() || ''}
                              onChange={(e) => setOtherExpense(parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              class="w-36 h-9 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-xs text-right font-mono font-bold focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div class="self-end">
                            <button
                              type="button"
                              onClick={() => setOtherPaidByDriver(!otherPaidByDriver())}
                              class={`h-9 px-3 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer border ${otherPaidByDriver()
                                ? 'bg-amber-100/90 text-amber-900 border-amber-300 shadow-2xs'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                              <span class={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${otherPaidByDriver() ? 'bg-amber-600 text-white font-black' : 'border border-slate-300'
                                }`}>
                                {otherPaidByDriver() ? '✓' : ''}
                              </span>
                              Paid by Driver
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Journey Remarks (Optional) */}
                  <div class="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-2xs">
                    <div class="flex items-center gap-2">
                      <FileText class="w-4 h-4 text-blue-600" />
                      <label class="block text-xs font-bold text-slate-800">Journey Remarks (Optional)</label>
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Add any remarks about this journey..."
                      class="w-full bg-slate-50/60 border border-slate-200 text-slate-800 rounded-xl p-3 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white placeholder:text-slate-400 transition"
                    />
                  </div>
                </div>
              </Show>

            </div>

            {/* COLUMN 3: RIGHT STICKY LIVE FINANCIAL SUMMARY CARD — compact on Step 2, full on other steps */}
            <div class={`bg-white border-t md:border-t-0 md:border-l border-slate-200 shrink-0 overflow-y-auto transition-all ${currentStep() === 2 ? 'w-full md:w-52 p-3' : 'w-full md:w-80 p-5 space-y-5'}`}>
              {/* COMPACT AT-A-GLANCE VIEW for Step 2 */}
              <Show when={currentStep() === 2}>
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
                  const m = getTripMetrics(tripObject);
                  const rows = [
                    { label: 'Income', sub: 'Freight billed', val: m.income, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                    { label: 'Expenses', sub: 'Fuel & permits', val: m.totalExpense, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100' },
                    { label: 'Driver Adv', sub: 'Cash issued', val: m.totalIssuedToDriver, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
                    { label: 'Outstanding', sub: 'Receivables', val: m.outstandingBalance, color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-100' },
                  ];
                  const profitPositive = m.profit >= 0;
                  return (
                    <div class="flex flex-col gap-1.5 font-sans">
                      <div class="flex items-center justify-between mb-1 pb-2 border-b border-slate-100">
                        <span class="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Live Summary</span>
                        <span class="flex items-center gap-1 text-[9px] font-bold text-emerald-700">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>LIVE
                        </span>
                      </div>

                      {rows.map(r => (
                        <div class={`${r.bg} ${r.border} border rounded-xl px-2.5 py-2 flex flex-col gap-0.5`}>
                          <span class="text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{r.label}</span>
                          <span class={`text-sm font-black font-mono ${r.color}`}>₹{r.val.toLocaleString('en-IN')}</span>
                          <span class="text-[8px] text-slate-400 font-medium">{r.sub}</span>
                        </div>
                      ))}

                      {/* NET PROFIT — highlighted */}
                      <div class={`mt-0.5 rounded-xl px-2.5 py-2.5 border-2 ${profitPositive ? 'bg-blue-600 border-blue-500' : 'bg-rose-600 border-rose-500'}`}>
                        <span class="text-[9px] font-extrabold uppercase tracking-wider text-white/70 block">Net Profit</span>
                        <span class="text-base font-black font-mono text-white">₹{m.profit.toLocaleString('en-IN')}</span>
                        <span class="text-[8px] text-white/60 font-medium">Estimated margin</span>
                      </div>
                    </div>
                  );
                })()}
              </Show>

              {/* FULL SUMMARY VIEW for other steps */}
              <Show when={currentStep() !== 2}>
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
                                {/* MODE TOGGLE TABS */}
                                <div class="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setQuickFwdMode('account')}
                                    class={`flex-1 py-1 rounded-md text-[9px] font-extrabold uppercase transition cursor-pointer ${quickFwdMode() === 'account' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                                      }`}
                                  >
                                    Company Account
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQuickFwdMode('trip')}
                                    class={`flex-1 py-1 rounded-md text-[9px] font-extrabold uppercase transition cursor-pointer ${quickFwdMode() === 'trip' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                                      }`}
                                  >
                                    Move to Another Trip
                                  </button>
                                </div>

                                <Show when={quickFwdMode() === 'account'}>
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
                                        notify("Please select a target company account first.", "warning");
                                        return;
                                      }
                                      const amtToSettle = Number(selectedFwdAmount()) || 0;
                                      if (amtToSettle <= 0) {
                                        notify("Please enter a valid settle amount.", "warning");
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
                                      notify(`Settled ₹${amtToSettle.toLocaleString('en-IN')} with account: ${accountName}. Please save trip form.`, "success");
                                    }}
                                    class="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                                  >
                                    Confirm Account Settlement
                                  </button>
                                </Show>

                                <Show when={quickFwdMode() === 'trip'}>
                                  <span class="text-[9px] font-extrabold uppercase text-amber-400 block">
                                    Transfer Driver Balance to Another Trip
                                  </span>
                                  <div class="space-y-1.5">
                                    <label class="block text-[8px] uppercase text-slate-400 font-bold">Target Trip Code</label>
                                    {(() => {
                                      const allList = (typeof props.trips === 'function' ? props.trips() : props.trips || []);
                                      const availableTrips = allList.filter(t => t.tripNo !== tripNo());
                                      return (
                                        <select
                                          value={selectedFwdTripId()}
                                          onChange={(e) => setSelectedFwdTripId(e.target.value)}
                                          class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none"
                                        >
                                          <option value="">-- Choose Target Trip --</option>
                                          {availableTrips.map(t => (
                                            <option value={t.tripNo}>
                                              {t.tripNo} ({t.truckNo} - {t.driverName})
                                            </option>
                                          ))}
                                        </select>
                                      );
                                    })()}
                                  </div>
                                  <div class="space-y-1.5">
                                    <label class="block text-[8px] uppercase text-slate-400 font-bold">Transfer Amount (₹)</label>
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
                                      const targetTripNo = selectedFwdTripId();
                                      if (!targetTripNo) {
                                        notify("Please select a target trip code first.", "warning");
                                        return;
                                      }
                                      const amtToTransfer = Number(selectedFwdAmount()) || 0;
                                      if (amtToTransfer <= 0) {
                                        notify("Please enter a valid transfer amount.", "warning");
                                        return;
                                      }

                                      // Add transfer entry to current trip advances
                                      const transferAdv: TripAdvance = {
                                        id: 'fwd_trip_' + Date.now(),
                                        amount: driverBalance < 0 ? -amtToTransfer : amtToTransfer,
                                        date: new Date().toISOString().substring(0, 10),
                                        fromAccountId: 'Transfer',
                                        notes: `Transferred ₹${amtToTransfer.toLocaleString('en-IN')} ${driverBalance < 0 ? 'deficit to' : 'surplus to'} Trip ${targetTripNo}`,
                                        receivedByDriverDirectly: false
                                      };

                                      setAdvances([...advances(), transferAdv]);

                                      // If props.trips and onSaveTrips exist, update target trip as well
                                      const allList = (typeof props.trips === 'function' ? props.trips() : props.trips || []);
                                      const targetTrip = allList.find(t => t.tripNo === targetTripNo);
                                      if (targetTrip && props.onSaveTrips) {
                                        const counterAdv: TripAdvance = {
                                          id: 'fwd_recv_' + Date.now(),
                                          amount: driverBalance < 0 ? amtToTransfer : -amtToTransfer,
                                          date: new Date().toISOString().substring(0, 10),
                                          fromAccountId: 'Transfer',
                                          notes: `Transferred ₹${amtToTransfer.toLocaleString('en-IN')} ${driverBalance < 0 ? 'deficit from' : 'surplus from'} Trip ${tripNo() || 'Current'}`,
                                          receivedByDriverDirectly: false
                                        };
                                        const updatedTargetTrip = {
                                          ...targetTrip,
                                          advances: [...(targetTrip.advances || []), counterAdv]
                                        };
                                        const updatedList = allList.map(t => t.id === targetTrip.id ? updatedTargetTrip : t);
                                        props.onSaveTrips(updatedList);
                                      }

                                      setShowQuickFwdPanel(false);
                                      setSelectedFwdTripId('');
                                      notify(`Transferred ₹${amtToTransfer.toLocaleString('en-IN')} to Trip ${targetTripNo}. Please save trip form.`, "success");
                                    }}
                                    class="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                                  >
                                    Confirm Inter-Trip Transfer
                                  </button>
                                </Show>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </Show>
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

      {/* ═══ SUB-TRIP EDITOR MODAL (nested overlay) ═══ */}
      <Show when={isSubTripModalOpen()}>
        <div class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[60] animate-fade-in font-sans">
          <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

            {/* Sub-trip modal header */}
            <div class="px-6 py-4 border-b border-slate-200/80 flex justify-between items-center bg-white shrink-0">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
                  <TruckIcon class="w-5 h-5" />
                </div>
                <div>
                  <h3 class="font-black text-slate-900 text-lg leading-tight">
                    {editingSubTripId() ? 'Edit Cargo Segment' : 'New Cargo Segment'}
                  </h3>
                  <p class="text-xs text-slate-500 font-medium">Add route path, freight income and cargo expenses</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseSubTripModal}
                class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            {/* Sub-trip modal body */}
            <div class="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6 bg-slate-50/50">

              {/* Section 1: Route Details */}
              <div class="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-2xs">
                <div class="flex items-center gap-2">
                  <h4 class="font-bold text-slate-900 text-sm">Route Details</h4>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-[11px] font-extrabold text-slate-650 mb-1.5">Loading Date</label>
                    <div class="relative">
                      <input
                        type="date"
                        value={stLoadingDate()}
                        onChange={(e) => { if (e.currentTarget.value) setStLoadingDate(e.currentTarget.value); }}
                        class="w-full h-11 bg-slate-50/60 border border-slate-200 text-slate-800 rounded-xl px-3.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label class="block text-[11px] font-extrabold text-slate-650 mb-1.5">Office / Party</label>
                    {(() => {
                      const officeList = typeof props.offices === 'function' ? props.offices() : (props.offices || []);
                      return officeList.length > 0 ? (
                        <select
                          value={stOfficeName()}
                          onChange={(e) => setStOfficeName(e.target.value)}
                          class="w-full h-11 bg-slate-50/60 border border-slate-200 text-slate-800 rounded-xl px-3.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white cursor-pointer transition"
                        >
                          <option value="">Select office or party</option>
                          {officeList.map((o: any) => <option value={o.officeName}>{o.officeName}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={stOfficeName()}
                          onChange={(e) => setStOfficeName(e.target.value)}
                          placeholder="Select office or party"
                          class="w-full h-11 bg-slate-50/60 border border-slate-200 text-slate-800 rounded-xl px-3.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                        />
                      );
                    })()}
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-[11px] font-extrabold text-slate-650 mb-1.5">Route From <span class="text-red-500">*</span></label>
                    <div class="relative">
                      <MapPin class="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        type="text"
                        list="suggested-places-list"
                        value={stRouteFrom()}
                        onChange={(e) => setStRouteFrom(e.currentTarget.value)}
                        placeholder="e.g. Salem"
                        class="w-full h-11 bg-slate-50/60 border border-slate-200 text-slate-800 rounded-xl pl-10 pr-3.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label class="block text-[11px] font-extrabold text-slate-650 mb-1.5">Route To <span class="text-red-500">*</span></label>
                    <div class="relative">
                      <MapPin class="w-4 h-4 text-emerald-600 absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        type="text"
                        list="suggested-places-list"
                        value={stRouteTo()}
                        onChange={(e) => setStRouteTo(e.currentTarget.value)}
                        placeholder="e.g. Mumbai"
                        class="w-full h-11 bg-slate-50/60 border border-slate-200 text-slate-800 rounded-xl pl-10 pr-3.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      />
                    </div>
                  </div>
                </div>

                <datalist id="suggested-places-list">
                  {suggestedPlaces().map(place => (
                    <option value={place}>{place}</option>
                  ))}
                </datalist>
              </div>

              {/* Section 2: Freight & Income Details */}
              <div class="bg-emerald-50/40 border border-emerald-200/80 rounded-2xl p-5 space-y-4">
                <div class="flex items-center gap-2">
                  <h4 class="font-bold text-emerald-900 text-sm">Freight & Income Details</h4>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label class="block text-[11px] font-extrabold text-slate-650 mb-1.5">Material / Goods</label>
                    <div class="relative">
                      <Package class="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        type="text"
                        value={stGoodsName()}
                        onChange={(e) => setStGoodsName(e.target.value)}
                        placeholder="e.g. Coal, Steel"
                        class="w-full h-11 bg-white border border-slate-200 text-slate-800 rounded-xl pl-10 pr-3.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label class="block text-[11px] font-extrabold text-slate-650 mb-1.5">Weight (Tons)</label>
                    <div class="relative">
                      <Scale class="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={stWeight() || ''}
                        onChange={(e) => {
                          const t = parseFloat(e.target.value) || 0;
                          setStWeight(t);
                          if (t > 0 && stFreightRate() > 0) {
                            const inc = Math.round(t * stFreightRate());
                            setStIncome(inc);
                            const pct = stWagePercent();
                            if (pct !== '' && pct > 0 && inc > 0) {
                              setStDriverWages(Math.round(inc * (pct / 100)));
                            }
                          }
                        }}
                        placeholder="0.00"
                        class="w-full h-11 bg-white border border-slate-200 text-slate-800 rounded-xl pl-10 pr-3.5 text-xs text-right font-mono font-bold focus:outline-none focus:border-emerald-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label class="block text-[11px] font-extrabold text-slate-650 mb-1.5">Rate / Ton (₹)</label>
                    <div class="relative">
                      <Tag class="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={stFreightRate() || ''}
                        onChange={(e) => {
                          const r = parseFloat(e.target.value) || 0;
                          setStFreightRate(r);
                          if (stWeight() > 0 && r > 0) {
                            const inc = Math.round(stWeight() * r);
                            setStIncome(inc);
                            const pct = stWagePercent();
                            if (pct !== '' && pct > 0 && inc > 0) {
                              setStDriverWages(Math.round(inc * (pct / 100)));
                            }
                          }
                        }}
                        placeholder="0"
                        class="w-full h-11 bg-white border border-slate-200 text-slate-800 rounded-xl pl-10 pr-3.5 text-xs text-right font-mono font-bold focus:outline-none focus:border-emerald-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Freight Income / Equal / Driver Wages / Stepper / Quick Select Row */}
                <div class="flex flex-col md:flex-row md:items-end justify-between gap-3 pt-2">
                  {/* Freight Income */}
                  <div class="bg-white border border-emerald-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-2xl p-3 shadow-2xs flex-1 min-w-[150px] transition">
                    <label class="block text-[10px] font-extrabold text-slate-650 mb-1">Freight Income (₹) <span class="text-red-500">*</span></label>
                    <div class="flex items-center gap-2">
                      <Coins class="w-4 h-4 text-emerald-600 shrink-0" />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={stIncome() || ''}
                        onChange={(e) => {
                          const inc = parseFloat(e.target.value) || 0;
                          setStIncome(inc);
                          const pct = stWagePercent();
                          if (pct !== '' && pct > 0 && inc > 0) {
                            setStDriverWages(Math.round(inc * (pct / 100)));
                          }
                        }}
                        placeholder="0"
                        class="w-full bg-transparent text-emerald-900 font-mono font-black text-sm text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  {/* Equal Badge */}
                  <div class="hidden md:flex justify-center pb-3">
                    <div class="w-7 h-7 rounded-full bg-emerald-100/90 text-emerald-700 font-black text-xs flex items-center justify-center shadow-2xs shrink-0">
                      =
                    </div>
                  </div>

                  {/* Driver Wages */}
                  <div class="bg-white border border-slate-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-2xl p-3 shadow-2xs flex-1 min-w-[150px] transition">
                    <label class="block text-[10px] font-extrabold text-slate-650 mb-1">Driver Wages (₹)</label>
                    <div class="flex items-center gap-2">
                      <Wallet class="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        id="input_st_driverwages"
                        value={stDriverWages() || ''}
                        onChange={(e) => {
                          const amt = parseFloat(e.target.value) || 0;
                          setStDriverWages(amt);
                          if (stIncome() > 0 && amt > 0) {
                            setStWagePercent(parseFloat(((amt / stIncome()) * 100).toFixed(1)));
                          } else {
                            setStWagePercent('');
                          }
                        }}
                        placeholder="0"
                        class="w-full bg-transparent text-slate-900 font-mono font-extrabold text-sm text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  {/* Wage % Stepper */}
                  <div class="w-full md:w-32 shrink-0">
                    <div class="flex items-center gap-1 text-[10px] font-extrabold text-slate-600 mb-1">
                      <span>Wage %</span>
                      <HelpCircle class="w-3 h-3 text-slate-400" />
                    </div>
                    <div class="bg-white border border-slate-200 rounded-2xl flex items-center p-1 shadow-2xs h-11 w-full justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          const curr = typeof stWagePercent() === 'number' ? (stWagePercent() as number) : 10;
                          const next = Math.max(1, curr - 1);
                          setStWagePercent(next);
                          if (stIncome() > 0) setStDriverWages(Math.round(stIncome() * (next / 100)));
                        }}
                        class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center transition cursor-pointer"
                      >
                        −
                      </button>
                      <span class="text-xs font-black text-slate-800 flex-1 text-center font-mono">{stWagePercent() ? `${stWagePercent()}%` : 'Custom'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const curr = typeof stWagePercent() === 'number' ? (stWagePercent() as number) : 10;
                          const next = curr + 1;
                          setStWagePercent(next);
                          if (stIncome() > 0) setStDriverWages(Math.round(stIncome() * (next / 100)));
                        }}
                        class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Vertical Divider */}
                  <div class="hidden xl:block w-px h-10 bg-slate-200/80 mx-1 shrink-0 pb-3" />

                  {/* Quick Select Bar */}
                  <div class="flex flex-col gap-1 shrink-0">
                    <span class="text-[10px] font-extrabold text-slate-400">Quick select</span>
                    <div class="flex items-center gap-1.5">
                      {[10, 12, 15, 18, 20].map(pct => (
                        <button
                          type="button"
                          onClick={() => {
                            setStWagePercent(pct);
                            if (stIncome() > 0) {
                              setStDriverWages(Math.round(stIncome() * (pct / 100)));
                            }
                          }}
                          class={`px-3 py-2 text-xs font-black rounded-xl transition cursor-pointer border ${stWagePercent() === pct
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Hint */}
                <div class="pt-1 text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <MapPin class="w-3.5 h-3.5 text-slate-400" />
                  Driver wage will be calculated automatically based on Freight Income
                </div>
              </div>

              {/* Section 3: Cargo Expenses */}
              <div class="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-2xs">
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-2">
                    <h4 class="font-bold text-slate-900 text-sm">Cargo Expenses</h4>
                    <span class="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-extrabold">
                      {stCargoExpenses().length} {stCargoExpenses().length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                </div>

                {/* Table of Added Cargo Expenses */}
                {stCargoExpenses().length > 0 && (
                  <div class="border border-slate-200 rounded-2xl bg-white">
                    <table class="w-full text-xs text-left">
                      <thead class="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                          <th class="p-3 pl-4">Type</th>
                          <th class="p-3 text-right">Amount (₹)</th>
                          <th class="p-3">Deducted From</th>
                          <th class="p-3">Bears</th>
                          <th class="p-3 text-right pr-4">Action</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                        {stCargoExpenses().map(exp => (
                          <tr class="hover:bg-slate-50/80 transition">
                            <td class="p-3 pl-4 font-bold text-slate-800 flex items-center gap-2">
                              <TruckIcon class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              {exp.expenseType}
                            </td>
                            <td class="p-3 text-right font-mono font-bold text-slate-900">₹{Number(exp.amount).toLocaleString('en-IN')}</td>
                            <td class="p-3 text-slate-600 font-semibold text-xs">
                              {exp.deductedFrom === 'DriverDirect' ? 'Driver Direct' : exp.deductedFrom === 'OrgRental' ? 'Org Rental' : exp.deductedFrom === 'OrgPaid' ? 'Org Paid' : exp.deductedFrom}
                            </td>
                            <td class="p-3 text-slate-600 font-semibold text-xs">{exp.bears || 'Office'}</td>
                            <td class="p-3 text-right pr-4">
                              <button
                                type="button"
                                onClick={() => handleRemoveCargoExpense(exp.id)}
                                class="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center transition cursor-pointer"
                                title="Remove Expense"
                              >
                                <Trash2 class="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Inline Cargo Expense Entry Builder */}
                <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end bg-slate-50/70 border border-slate-200 rounded-2xl p-3.5">
                  <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Type</label>
                    <select
                      value={newExpType()}
                      onChange={(e) => setNewExpType(e.target.value as any)}
                      class="w-full h-10 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Loading">Loading</option>
                      <option value="Unloading">Unloading</option>
                      <option value="Brokerage">Brokerage</option>
                      <option value="Crossing">Crossing</option>
                      <option value="RMC">RMC</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={newExpAmount()}
                      onChange={(e) => setNewExpAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                      placeholder="₹ 0"
                      class="w-full h-10 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-xs text-right font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Deducted From</label>
                    <select
                      value={newExpDeductedFrom()}
                      onChange={(e) => setNewExpDeductedFrom(e.target.value as any)}
                      class="w-full h-10 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="OrgRental">Org Rental</option>
                      <option value="DriverDirect">Driver Direct</option>
                      <option value="OrgPaid">Org Paid</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bears</label>
                    <select
                      value={newExpBears()}
                      onChange={(e) => setNewExpBears(e.target.value as any)}
                      class="w-full h-10 bg-white border border-slate-200 text-slate-800 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="Office">Office</option>
                      <option value="Org">Org</option>
                      <option value="Driver">Driver</option>
                    </select>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleAddCargoExpense}
                      class="w-full h-10 bg-white border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Sub-trip modal footer */}
            <div class="px-6 py-4 bg-white border-t border-slate-200/80 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={handleCloseSubTripModal}
                class="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition cursor-pointer"
              >
                Cancel
              </button>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveSubTrip}
                  class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-2 transition"
                >
                  <CheckCircle class="w-4 h-4" />
                  {editingSubTripId() ? 'Save Segment' : 'Add Segment'}
                </button>
              </div>
            </div>

          </div>
        </div>
      </Show>
      {/* RECORD CUSTOMER PAYMENT MODAL */}
      <Show when={isRecordPaymentModalOpen()}>
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] animate-fade-in font-sans">
          <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            {/* Modal Header */}
            <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Receipt class="w-5 h-5" />
                </div>
                <div>
                  <h4 class="font-black text-slate-900 text-base leading-tight">Record Customer Payment</h4>
                  <p class="text-xs text-slate-500 font-medium">Register advance or settlement payment received</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordPaymentModalOpen(false)}
                class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div class="p-6 space-y-4 overflow-y-auto">
              {(() => {
                const targetSt = subTrips().find(st => st.id === targetPaymentSubTripId());
                if (!targetSt) return null;
                const paid = (payments() || []).filter(p => p.subTripId === targetSt.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                const bal = (targetSt.income || 0) - paid;
                return (
                  <div class="bg-emerald-50/40 border border-emerald-200/60 rounded-2xl p-3.5 space-y-2">
                    <div class="flex justify-between items-center text-xs">
                      <span class="font-extrabold text-emerald-900">{targetSt.officeName || 'Cargo Segment'}</span>
                      <span class="font-mono font-bold text-slate-600">{targetSt.routeFrom} ➔ {targetSt.routeTo}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-200/40 text-center">
                      <div>
                        <span class="text-[9px] font-extrabold text-slate-400 uppercase block">Freight Billed</span>
                        <span class="font-black text-slate-800 font-mono text-xs">₹{targetSt.income.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span class="text-[9px] font-extrabold text-slate-400 uppercase block">Already Received</span>
                        <span class="font-black text-emerald-700 font-mono text-xs">₹{paid.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span class="text-[9px] font-extrabold text-slate-400 uppercase block">Balance Due</span>
                        <span class="font-black text-blue-700 font-mono text-xs">₹{bal.toLocaleString('en-IN')}</span>
                      </div>
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

export default TripForm;
