import { createSignal, createEffect, onMount, onCleanup, mergeProps, Show } from 'solid-js';

import { TripEntry, TripPayment, SubTrip, Truck, Office, Account, Driver, FuelEntry, TripStatus, getTripMetrics, calculateBalance, TripAdvance, OrganizationProfile, CargoExpense, mutateRecord, importLegacyCargoExpenses } from '../types';
import { indianCities } from './indianCities';
import {
  X, Calculator, Calendar, Landmark, Coins, Plus, Trash2, Edit2,
  Fuel, Gauge, MapPin, BadgeCent, ListCollapse, HelpCircle, AlertCircle
} from 'lucide-solid';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

interface TripFormProps {
  isOpen: boolean;
  onClose: () => void;
  trucks: Truck[];
  offices: Office[];
  accounts: Account[];
  drivers: Driver[];
  existingTripNos: string[];
  onSubmit: (entry: Omit<TripEntry, 'id'>) => void;
  editingEntry?: TripEntry | null;
  canViewDrivers?: boolean;
  orgProfile?: OrganizationProfile;
  trips?: TripEntry[];
  onSaveTrips?: (newTrips: TripEntry[]) => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
  currentUserId?: string;
}

export default function TripForm(rawProps: TripFormProps) {
  const props = mergeProps(
    {
      canViewDrivers: true,
      existingTripNos: [],
      trucks: [],
      offices: [],
      accounts: [],
      drivers: []
    },
    rawProps
  );

  const isOpen = () => props.isOpen;
  const editingEntry = () => props.editingEntry;
  const trucks = () => props.trucks || [];
  const offices = () => props.offices || [];
  const accounts = () => props.accounts || [];
  const drivers = () => props.drivers || [];
  const existingTripNos = () => props.existingTripNos || [];
  const onSubmit = props.onSubmit;
  const onClose = props.onClose;
  const canViewDrivers = () => props.canViewDrivers;
  const orgProfile = () => props.orgProfile;
  const trips = () => props.trips || [];
  const onSaveTrips = props.onSaveTrips;
  const confirmAction = props.confirmAction;
  const currentUserId = () => props.currentUserId;
  // Trip group keying
  const [tripNoOption, setTripNoOption] = createSignal<'AUTO' | 'EXISTING'>('AUTO');

  // Master Trip Form states
  const [tripNo, setTripNo] = createSignal('');
  const [selectedExistingTripNo, setSelectedExistingTripNo] = createSignal('');
  const [truckNo, setTruckNo] = createSignal('');
  const [startDate, setStartDate] = createSignal(new Date().toISOString().substring(0, 10));
  const [endDate, setEndDate] = createSignal(new Date().toISOString().substring(0, 10));
  const [driverName, setDriverName] = createSignal('');
  const [startingKM, setStartingKM] = createSignal<number>(0);
  const [endingKM, setEndingKM] = createSignal<number>(0);
  const [status, setStatus] = createSignal<TripStatus>('Pending');
  const [notes, setNotes] = createSignal('');

  // Master Trip Common Expenses
  const [rtoExpense, setRtoExpense] = createSignal<number>(0);
  const [dieselLiters, setDieselLiters] = createSignal<number>(0);
  const [dieselRate, setDieselRate] = createSignal<number>(0);
  const [dieselAmount, setDieselAmount] = createSignal<number>(0);
  const [addBlueExpense, setAddBlueExpense] = createSignal<number>(0);
  const [fastagExpense, setFastagExpense] = createSignal<number>(0);
  const [otherExpense, setOtherExpense] = createSignal<number>(0);

  // Paid by driver flags
  const [rtoPaidByDriver, setRtoPaidByDriver] = createSignal<boolean>(false);
  const [addBluePaidByDriver, setAddBluePaidByDriver] = createSignal<boolean>(false);
  const [fastagPaidByDriver, setFastagPaidByDriver] = createSignal<boolean>(false);
  const [otherPaidByDriver, setOtherPaidByDriver] = createSignal<boolean>(false);

  // Child lists
  const [subTrips, setSubTrips] = createSignal<SubTrip[]>([]);
  const [payments, setPayments] = createSignal<TripPayment[]>([]);
  const [fuels, setFuels] = createSignal<FuelEntry[]>([]);
  const [advances, setAdvances] = createSignal<TripAdvance[]>([]);

  // Refs to focus dates upon submission
  let paymentDateInputRef: HTMLInputElement | undefined;
  let advanceDateInputRef: HTMLInputElement | undefined;
  let fuelDateInputRef: HTMLInputElement | undefined;

  // Draft states for dynamic fuel entry
  const [newFuelDate, setNewFuelDate] = createSignal(new Date().toISOString().substring(0, 10));
  const [newFuelLiters, setNewFuelLiters] = createSignal<number | ''>('');
  const [newFuelRate, setNewFuelRate] = createSignal<number | ''>('');
  const [newFuelAmount, setNewFuelAmount] = createSignal<number | ''>('');
  const [newFuelShop, setNewFuelShop] = createSignal('');
  const [newFuelPaymentMode, setNewFuelPaymentMode] = createSignal('');

  // Draft states for Sub-Trip Segment builder
  const [showSubTripForm, setShowSubTripForm] = createSignal(false);
  const [editingSubTripId, setEditingSubTripId] = createSignal<string | null>(null);

  const [stLoadingDate, setStLoadingDate] = createSignal(new Date().toISOString().substring(0, 10));
  const [stOfficeName, setStOfficeName] = createSignal('');
  const [stRouteFrom, setStRouteFrom] = createSignal('');
  const [stRouteTo, setStRouteTo] = createSignal('');
  const [stIncome, setStIncome] = createSignal<number>(0);
  const [stCargoExpenses, setStCargoExpenses] = createSignal<CargoExpense[]>([]);
  const [newCargoExpType, setNewCargoExpType] = createSignal<'Loading' | 'Unloading' | 'Brokerage' | 'Crossing' | 'RMC'>('Loading');
  const [newCargoExpAmount, setNewCargoExpAmount] = createSignal<number | ''>('');
  const [newCargoExpDeductedFrom, setNewCargoExpDeductedFrom] = createSignal<'OrgRental' | 'DriverDirect' | 'OrgPaid'>('DriverDirect');
  const [newCargoExpBears, setNewCargoExpBears] = createSignal<'Org' | 'Driver' | 'Office'>('Org');

  const [stDriverWages, setStDriverWages] = createSignal<number>(0);
  const [stStartingKM, setStStartingKM] = createSignal<number>(0);
  const [stEndingKM, setStEndingKM] = createSignal<number>(0);
  const [stNotes, setStNotes] = createSignal('');
  const [stWagePct, setStWagePct] = createSignal<string>('');

  const [stNoOfTons, setStNoOfTons] = createSignal<number>(0);
  const [stMaterial, setStMaterial] = createSignal<string>('');
  const [stRatePerTon, setStRatePerTon] = createSignal<number>(0);
  const [originalSubTripSnapshot, setOriginalSubTripSnapshot] = createSignal<any>(null);

  // Draft states for payment ledger receipts list
  const [newPayAmount, setNewPayAmount] = createSignal<number | ''>('');
  const [newPayDate, setNewPayDate] = createSignal(new Date().toISOString().substring(0, 10));
  const [newPayReceivedBy, setNewPayReceivedBy] = createSignal('');
  const [newPayNotes, setNewPayNotes] = createSignal('');
  const [newPaySubTripId, setNewPaySubTripId] = createSignal<string>('general');
  const [activePaymentSubTripId, setActivePaymentSubTripId] = createSignal<string | null>(null);

  // Live sub-trip receivable balance calculations for the sub-trip drawer
  const liveSegmentDeductions = stCargoExpenses()
    .filter(exp => exp.deductedFrom === 'OrgRental')
    .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  const liveSegmentOfficeBears = stCargoExpenses()
    .filter(exp => exp.bears === 'Office')
    .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  const liveSegmentPayments = editingSubTripId()
    ? (payments() || []).filter(p => p.subTripId === editingSubTripId()).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    : 0;

  const liveSegmentReceivable = (stIncome() || 0) - liveSegmentDeductions + liveSegmentOfficeBears - liveSegmentPayments;

  // Draft states for advances() list
  const [newAdvAmount, setNewAdvAmount] = createSignal<number | ''>('');
  const [newAdvDate, setNewAdvDate] = createSignal(new Date().toISOString().substring(0, 10));
  const [newAdvFromAccount, setNewAdvFromAccount] = createSignal('');
  const [newAdvNotes, setNewAdvNotes] = createSignal('');
  const [newAdvReceivedByDriverDirectly, setNewAdvReceivedByDriverDirectly] = createSignal(false);

  // Quick carry forward / transfer states
  const [showQuickFwdPanel, setShowQuickFwdPanel] = createSignal(false);
  const [selectedFwdTripId, setSelectedFwdTripId] = createSignal('');
  const [selectedFwdMode, setSelectedFwdMode] = createSignal<'trip' | 'account'>('trip');
  const [selectedFwdAccountId, setSelectedFwdAccountId] = createSignal('');
  const [selectedFwdDate, setSelectedFwdDate] = createSignal(new Date().toISOString().substring(0, 10));
  const [selectedFwdAmount, setSelectedFwdAmount] = createSignal<number | ''>('');


  // Reset forward options when isOpen or editingEntry changes
  createEffect(() => {
    setShowQuickFwdPanel(false);
    setSelectedFwdTripId('');
    setSelectedFwdMode('trip');
    setSelectedFwdAccountId('');
    setSelectedFwdDate(new Date().toISOString().substring(0, 10));
    setSelectedFwdAmount('');
  });

  // Auto-fill active lists
  const todayStr = new Date().toISOString().substring(0, 10);
  const activeTrucks = () => trucks();
  const activeOffices = () => offices().filter(o => o.status === 'Active');
  const activeAccounts = () => accounts().filter(a => a.status === 'Active');
  const activeDrivers = () => drivers().filter(d => d.status === 'Active');

  const getLatestKMForTruck = (selectedTruckNo: string): number => {
    if (!selectedTruckNo) return 0;
    const cleanSelected = selectedTruckNo.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const truckObj = trucks().find(t => (t.truckNo || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanSelected);
    let latestKM = truckObj?.currentKM || 0;

    const truckTrips = (trips() || []).filter(t => (t.truckNo || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanSelected);
    if (truckTrips.length > 0) {
      const sorted = [...truckTrips].sort((a, b) => {
        const dateA = a.endDate || a.startDate || '';
        const dateB = b.endDate || b.startDate || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.tripNo || '').localeCompare(a.tripNo || '');
      });
      const lastTripEndingKM = sorted[0].endingKM || 0;
      if (lastTripEndingKM > latestKM) {
        latestKM = lastTripEndingKM;
      }
    }
    return latestKM;
  };

  // Year prefix sequence for Auto trip identifiers
  createEffect(() => {
    const open = isOpen();
    const entry = editingEntry();
    if (!entry && open) {
      const currentYear = new Date().getFullYear();
      let lastSeq = 0;

      existingTripNos().forEach(v => {
        const match = v.match(/TRIP-(\d+)-(\d+)/);
        if (match && parseInt(match[1]) === currentYear) {
          const seq = parseInt(match[2]);
          if (seq > lastSeq) lastSeq = seq;
        }
      });

      const newSeq = String(lastSeq + 1).padStart(4, '0');
      const generated = `TRIP-${currentYear}-${newSeq}`;
      setTripNo(generated);
      setSelectedExistingTripNo(existingTripNos()[0] || '');
    }
  });

  // Fill default values or edit details
  createEffect(() => {
    const open = isOpen();
    const entry = editingEntry();
    if (entry && open) {
      setTripNoOption('AUTO');
      setTripNo(entry.tripNo);
      setTruckNo(entry.truckNo);
      setStartDate(entry.startDate || new Date().toISOString().substring(0, 10));
      setEndDate(entry.endDate || new Date().toISOString().substring(0, 10));
      setDriverName(entry.driverName || '');
      setStartingKM(entry.startingKM || 0);
      setEndingKM(entry.endingKM || 0);
      setStatus(entry.status);
      setNotes(entry.notes || '');
      setSubTrips(entry.subTrips || []);
      setPayments(entry.payments || []);
      setAdvances(entry.advances || []);

      // Load master common expenses
      setRtoExpense(entry.rtoExpense || 0);
      setDieselLiters(entry.dieselLiters || 0);
      setDieselRate(entry.dieselRate || 0);
      setDieselAmount(entry.dieselAmount || 0);
      setAddBlueExpense(entry.addBlueExpense || 0);
      setFastagExpense(entry.fastagExpense || 0);
      setOtherExpense(entry.otherExpense || 0);

      setRtoPaidByDriver(entry.rtoPaidByDriver || false);
      setAddBluePaidByDriver(entry.addBluePaidByDriver || false);
      setFastagPaidByDriver(entry.fastagPaidByDriver || false);
      setOtherPaidByDriver(entry.otherPaidByDriver || false);

      if (entry.fuels && entry.fuels.length > 0) {
        setFuels(entry.fuels);
      } else if (entry.dieselAmount && entry.dieselAmount > 0) {
        setFuels([{
          id: 'fuel-legacy-' + Date.now(),
          date: entry.startDate || new Date().toISOString().substring(0, 10),
          liters: entry.dieselLiters || 0,
          rate: entry.dieselRate || 0,
          amount: entry.dieselAmount,
          shopName: 'Legacy Fuel Station',
          paymentMode: ''
        }]);
      } else {
        setFuels([]);
      }

      setShowSubTripForm(false);
      setEditingSubTripId(null);
    } else if (open) {
      // Create resetting defaults
      const firstTruck = activeTrucks()[0];
      const defaultTruckNo = firstTruck?.truckNo || '';
      setTruckNo(defaultTruckNo);

      // Choose first active driver as default
      setDriverName(activeDrivers()[0]?.driverName || '');

      setStartDate(new Date().toISOString().substring(0, 10));
      setEndDate(new Date().toISOString().substring(0, 10));
      setStartingKM(getLatestKMForTruck(defaultTruckNo));
      setEndingKM(0);
      setStatus('Pending');
      setNotes('');
      setSubTrips([]);
      setPayments([]);
      setFuels([]);
      setAdvances([]);

      // Reset master common expenses
      setRtoExpense(0);
      setDieselLiters(0);
      setDieselRate(0);
      setDieselAmount(0);
      setAddBlueExpense(0);
      setFastagExpense(0);
      setOtherExpense(0);

      setRtoPaidByDriver(false);
      setAddBluePaidByDriver(false);
      setFastagPaidByDriver(false);
      setOtherPaidByDriver(false);

      setShowSubTripForm(false);
      setEditingSubTripId(null);
    }
  });
  // NOTE: trucks/drivers/offices/accounts are intentionally NOT in the dep array.
  // Dropdown options are read directly from props (live) so they always show the
  // latest data without needing to be in deps. Including them caused the form to
  // reset mid-fill whenever a realtime update arrived for master records.

  // Sync payments() ledger default account on loading
  createEffect(() => {
    if (!newPayReceivedBy() && activeAccounts.length > 0) {
      setNewPayReceivedBy(activeAccounts[0].id);
    }
    if (!newAdvFromAccount() && activeAccounts.length > 0) {
      setNewAdvFromAccount(activeAccounts[0].id);
    }
  });

  // Auto-calculate diesel amount dynamically
  createEffect(() => {
    setDieselAmount(Math.max(0, Number(dieselLiters()) * Number(dieselRate())));
  });

  const handleLitersChange = (val: number | '') => {
    setNewFuelLiters(val);
    if (val !== '' && Number(val) > 0) {
      if (newFuelRate() !== '' && Number(newFuelRate()) > 0) {
        setNewFuelAmount(Math.round(Number(val) * Number(newFuelRate())));
      } else if (newFuelAmount() !== '' && Number(newFuelAmount()) > 0) {
        setNewFuelRate(Number((Number(newFuelAmount()) / Number(val)).toFixed(2)));
      }
    }
  };

  const handleRateChange = (val: number | '') => {
    setNewFuelRate(val);
    if (val !== '' && Number(val) > 0) {
      if (newFuelLiters() !== '' && Number(newFuelLiters()) > 0) {
        setNewFuelAmount(Math.round(Number(newFuelLiters()) * Number(val)));
      } else if (newFuelAmount() !== '' && Number(newFuelAmount()) > 0) {
        setNewFuelLiters(Number((Number(newFuelAmount()) / Number(val)).toFixed(2)));
      }
    }
  };

  const handleAmountChange = (val: number | '') => {
    setNewFuelAmount(val);
    if (val !== '' && Number(val) > 0) {
      if (newFuelLiters() !== '' && Number(newFuelLiters()) > 0) {
        setNewFuelRate(Number((Number(val) / Number(newFuelLiters())).toFixed(2)));
      } else if (newFuelRate() !== '' && Number(newFuelRate()) > 0) {
        setNewFuelLiters(Number((Number(val) / Number(newFuelRate())).toFixed(2)));
      }
    }
  };

  const handleAddFuel = () => {
    const lts = Number(newFuelLiters()) || 0;
    const rt = Number(newFuelRate()) || 0;
    const amt = Number(newFuelAmount()) || 0;

    if (amt <= 0) {
      alert("Please enter a valid Fuel Amount.");
      return;
    }

    const f: FuelEntry = {
      id: 'fuel-' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      date: newFuelDate(),
      liters: lts,
      rate: rt,
      amount: amt,
      shopName: newFuelShop().trim() || undefined,
      paymentMode: newFuelPaymentMode() || undefined
    };
    setFuels([...fuels(), f]);

    // Reset inputs
    setNewFuelLiters('');
    setNewFuelRate('');
    setNewFuelAmount('');
    setNewFuelShop('');
    setTimeout(() => fuelDateInputRef?.focus(), 0);
  };

  const handleRemoveFuel = (fId: string) => {
    setFuels(fuels().filter(f => f.id !== fId));
  };

  // Compute live aggregates of drafted values
  const draftTripMetrics = () => {
    // Generate temporary TripEntry mapping for metrics math
    const tempTrip: TripEntry = {
      id: 'temp',
      tripNo: tripNoOption() === 'AUTO' ? tripNo() : selectedExistingTripNo(),
      truckNo: truckNo(),
      startDate: startDate(),
      endDate: endDate(),
      driverName: driverName(),
      startingKM: startingKM(),
      endingKM: endingKM(),
      subTrips: subTrips(),
      payments: payments(),
      fuels: fuels(), // N fuels() support
      status: status(),
      notes: notes(),
      rtoExpense: rtoExpense(),
      rtoPaidByDriver: rtoPaidByDriver(),
      dieselLiters: dieselLiters(),
      dieselRate: dieselRate(),
      dieselAmount: dieselAmount(),
      addBlueExpense: addBlueExpense(),
      addBluePaidByDriver: addBluePaidByDriver(),
      fastagExpense: fastagExpense(),
      fastagPaidByDriver: fastagPaidByDriver(),
      otherExpense: otherExpense(),
      otherPaidByDriver: otherPaidByDriver(),
      advances: advances()
    };
    return getTripMetrics(tempTrip);
  };

  const metrics = draftTripMetrics();

  const { driverBalance, totalDriverSpend, totalIssuedToDriver } = metrics;

  // Auto-fill selectedFwdAmount() when panel opens or driverBalance changes
  createEffect(() => {
    if (showQuickFwdPanel()) {
      setSelectedFwdAmount(Math.abs(driverBalance));
    }
  });


  // Handle drafting payments()
  const handleAddPayment = (targetSubTripId?: string) => {
    const amt = Number(newPayAmount()) || 0;
    if (amt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }
    if (!newPayReceivedBy()) {
      alert("Please choose a valid financial account.");
      return;
    }

    const item: TripPayment = {
      id: 'stmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      amount: amt,
      date: newPayDate() || new Date().toISOString().substring(0, 10),
      receivedBy: newPayReceivedBy(),
      notes: newPayNotes().trim() || undefined,
      subTripId: targetSubTripId || (newPaySubTripId() !== 'general' ? newPaySubTripId() : undefined)
    };

    setPayments(prev => [...prev, item]);
    setNewPayAmount('');
    setNewPayNotes('');
    setNewPaySubTripId('general');
    setTimeout(() => paymentDateInputRef?.focus(), 0);
  };

  const handleRemovePayment = (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  // Sub-Trip operations
  const handleOpenNewSubTrip = () => {
    setEditingSubTripId(null);
    setStLoadingDate(startDate() || new Date().toISOString().substring(0, 10));
    setStOfficeName(activeOffices()[0]?.officeName || '');
    setStRouteFrom('');
    setStRouteTo('');
    setStIncome(0);
    setStCargoExpenses([]);
    setNewCargoExpType('Loading');
    setNewCargoExpAmount('');
    setNewCargoExpDeductedFrom('DriverDirect');
    setNewCargoExpBears('Org');

    setStNoOfTons(0);
    setStMaterial('');
    setStRatePerTon(0);

    setStDriverWages(0);
    // Align segment mileage to main odometer reads to reduce user friction
    setStStartingKM(startingKM() || 0);
    setStEndingKM(endingKM() || 0);
    setStNotes('');
    setStWagePct('');

    const snapshot = {
      loadingDate: startDate() || new Date().toISOString().substring(0, 10),
      officeName: activeOffices()[0]?.officeName || '',
      routeFrom: '',
      routeTo: '',
      income: 0,
      driverWages: 0,
      startingKM: startingKM() || 0,
      endingKM: endingKM() || 0,
      notes: '',
      noOfTons: 0,
      material: '',
      ratePerTon: 0,
      cargoExpenses: []
    };
    setOriginalSubTripSnapshot(snapshot);
    setShowSubTripForm(true);
  };

  const handleOpenEditSubTrip = (st: SubTrip) => {
    setEditingSubTripId(st.id);
    setStLoadingDate(st.loadingDate || startDate());
    setStOfficeName(st.officeName || activeOffices()[0]?.officeName || '');
    setStRouteFrom(st.routeFrom || '');
    setStRouteTo(st.routeTo || '');
    setStIncome(st.income || 0);

    const importedExpenses = (st.cargoExpenses && st.cargoExpenses.length > 0)
      ? st.cargoExpenses
      : importLegacyCargoExpenses(st, orgProfile());
    setStCargoExpenses(importedExpenses);
    setNewCargoExpType('Loading');
    setNewCargoExpAmount('');
    setNewCargoExpDeductedFrom('DriverDirect');
    setNewCargoExpBears('Org');

    setStNoOfTons(st.noOfTons || 0);
    setStMaterial(st.material || '');
    setStRatePerTon(st.ratePerTon || 0);

    setStDriverWages(st.driverWages || 0);
    setStStartingKM(st.startingKM || 0);
    setStEndingKM(st.endingKM || 0);
    setStNotes(st.notes || '');

    const calculatedPct = st.income && st.driverWages ? Math.round((st.driverWages / st.income) * 100).toString() : '';
    setStWagePct(calculatedPct);

    const snapshot = {
      loadingDate: st.loadingDate || startDate(),
      officeName: st.officeName || activeOffices()[0]?.officeName || '',
      routeFrom: st.routeFrom || '',
      routeTo: st.routeTo || '',
      income: st.income || 0,
      driverWages: st.driverWages || 0,
      startingKM: st.startingKM || 0,
      endingKM: st.endingKM || 0,
      notes: st.notes || '',
      noOfTons: st.noOfTons || 0,
      material: st.material || '',
      ratePerTon: st.ratePerTon || 0,
      cargoExpenses: importedExpenses
    };
    setOriginalSubTripSnapshot(snapshot);
    setShowSubTripForm(true);
  };

  const checkIfSubTripHasChanges = () => {
    const currentSnapshot = {
      loadingDate: stLoadingDate(),
      officeName: stOfficeName(),
      routeFrom: stRouteFrom(),
      routeTo: stRouteTo(),
      income: Number(stIncome()) || 0,
      driverWages: Number(stDriverWages()) || 0,
      startingKM: Number(stStartingKM()) || 0,
      endingKM: Number(stEndingKM()) || 0,
      notes: stNotes(),
      noOfTons: Number(stNoOfTons()) || 0,
      material: stMaterial(),
      ratePerTon: Number(stRatePerTon()) || 0,
      cargoExpenses: stCargoExpenses()
    };
    return originalSubTripSnapshot() && JSON.stringify(originalSubTripSnapshot()) !== JSON.stringify(currentSnapshot);
  };

  const handleCancelSubTripSegment = () => {
    setShowSubTripForm(false);
    setEditingSubTripId(null);
  };

  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSubTripForm()) {
          handleCancelSubTripSegment();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  const handleSaveSubTripSegmentConfirm = (e: Event) => {
    e.preventDefault();
    handleSaveSubTripSegment(e);
  };

  const handleSaveSubTripSegment = (e: Event) => {
    e.preventDefault();
    if (!stOfficeName()) {
      alert("Office selection is required.");
      return;
    }
    if (!stRouteFrom() || !stRouteTo()) {
      alert("Route Origin and Destination are required.");
      return;
    }

    const originalSubTrip = editingSubTripId() ? subTrips().find(item => item.id === editingSubTripId()) : null;

    // Compile category totals for legacy views compatibility
    const compileCategory = (type: 'Loading' | 'Unloading' | 'Brokerage' | 'Crossing' | 'RMC') => {
      const filtered = stCargoExpenses().filter(e => e.expenseType === type);
      const amount = filtered.reduce((sum, e) => sum + e.amount, 0);
      const paidByDriver = filtered.some(e => e.paidByDriver);
      let deductedFrom: 'OrgRental' | 'DriverDirect' | 'OrgPaid' = 'DriverDirect';
      if (filtered.some(e => e.deductedFrom === 'OrgRental')) {
        deductedFrom = 'OrgRental';
      } else if (filtered.some(e => e.deductedFrom === 'OrgPaid')) {
        deductedFrom = 'OrgPaid';
      }

      const bearsOrg = filtered.filter(e => e.bears === 'Org').reduce((sum, e) => sum + e.amount, 0);
      const bearsDriver = filtered.filter(e => e.bears === 'Driver').reduce((sum, e) => sum + e.amount, 0);

      const bears = (bearsOrg === 0 && bearsDriver > 0) ? 'Driver' : 'Org';

      return {
        amount,
        paidByDriver,
        deductedFrom,
        bears,
        bearsOrg: bearsOrg > 0 || bearsDriver > 0 ? bearsOrg : undefined,
        bearsDriver: bearsOrg > 0 || bearsDriver > 0 ? bearsDriver : undefined
      };
    };

    const loadData = compileCategory('Loading');
    const unloadData = compileCategory('Unloading');
    const brokerageData = compileCategory('Brokerage');
    const crossingData = compileCategory('Crossing');
    const rmcData = compileCategory('RMC');

    const segmentObj: SubTrip = {
      ...(originalSubTrip || {}),
      id: editingSubTripId() || 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      loadingDate: stLoadingDate(),
      officeName: stOfficeName(),
      routeFrom: stRouteFrom().trim(),
      routeTo: stRouteTo().trim(),
      income: Number(stIncome()) || 0,
      driverWages: Number(stDriverWages()) || 0,
      startingKM: Number(stStartingKM()) || 0,
      endingKM: Number(stEndingKM()) || 0,
      notes: stNotes().trim() || undefined,

      cargoExpenses: stCargoExpenses(),

      // Legacy fallback fields
      loadingExpense: loadData.amount,
      loadingPaidByDriver: loadData.paidByDriver,
      loadingDeductedFrom: loadData.deductedFrom,
      loadingBears: loadData.bears as 'Org' | 'Driver',
      loadingBearsOrg: loadData.bearsOrg,
      loadingBearsDriver: loadData.bearsDriver,

      unloadingExpense: unloadData.amount,
      unloadingPaidByDriver: unloadData.paidByDriver,
      unloadingDeductedFrom: unloadData.deductedFrom,
      unloadingBears: unloadData.bears as 'Org' | 'Driver',
      unloadingBearsOrg: unloadData.bearsOrg,
      unloadingBearsDriver: unloadData.bearsDriver,

      brokerageExpense: brokerageData.amount,
      brokeragePaidByDriver: brokerageData.paidByDriver,
      brokerageDeductedFrom: brokerageData.deductedFrom,
      brokerageBears: brokerageData.bears as 'Org' | 'Driver',
      brokerageBearsOrg: brokerageData.bearsOrg,
      brokerageBearsDriver: brokerageData.bearsDriver,

      crossingExpense: crossingData.amount,
      crossingPaidByDriver: crossingData.paidByDriver,
      crossingDeductedFrom: crossingData.deductedFrom,
      crossingBears: crossingData.bears as 'Org' | 'Driver',
      crossingBearsOrg: crossingData.bearsOrg,
      crossingBearsDriver: crossingData.bearsDriver,

      rmcExpense: rmcData.amount,
      rmcPaidByDriver: rmcData.paidByDriver,
      rmcDeductedFrom: rmcData.deductedFrom,
      rmcBears: rmcData.bears as 'Org' | 'Driver',
      rmcBearsOrg: rmcData.bearsOrg,
      rmcBearsDriver: rmcData.bearsDriver,

      noOfTons: Number(stNoOfTons()) || undefined,
      material: stMaterial().trim() || undefined,
      ratePerTon: Number(stRatePerTon()) || undefined
    };

    if (editingSubTripId()) {
      setSubTrips(prev => prev.map(item => item.id === editingSubTripId() ? segmentObj : item));
    } else {
      setSubTrips(prev => [...prev, segmentObj]);
      if (segmentObj.endingKM > endingKM()) {
        setEndingKM(segmentObj.endingKM);
      }
      if (startingKM() === 0 && segmentObj.startingKM > 0) {
        setStartingKM(segmentObj.startingKM);
      }
    }

    setShowSubTripForm(false);
    setEditingSubTripId(null);
  };

  const handleAddCargoExpense = () => {
    const amt = Number(newCargoExpAmount()) || 0;
    if (amt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }
    const item: CargoExpense = {
      id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      expenseType: newCargoExpType(),
      amount: amt,
      paidByDriver: newCargoExpDeductedFrom() === 'DriverDirect',
      deductedFrom: newCargoExpDeductedFrom(),
      bears: newCargoExpBears()
    };
    setStCargoExpenses(prev => [...prev, item]);
    setNewCargoExpAmount('');
  };

  const handleRemoveCargoExpense = (id: string) => {
    setStCargoExpenses(prev => prev.filter(e => e.id !== id));
  };

  const handleDeleteSubTripSegment = (id: string) => {
    setSubTrips(prev => prev.filter(st => st.id !== id));
    setPayments(prev => prev.filter(p => p.subTripId !== id));
  };

  const handleAddAdvance = () => {
    if (!newAdvAmount() || Number(newAdvAmount()) <= 0 || !newAdvFromAccount()) {
      alert("Please enter a valid amount and select a From Account for the driver advance.");
      return;
    }

    const nAdv: TripAdvance = {
      id: 'adv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      amount: Number(newAdvAmount()),
      date: newAdvDate(),
      fromAccountId: newAdvFromAccount(),
      notes: newAdvNotes().trim() || undefined,
      receivedByDriverDirectly: newAdvReceivedByDriverDirectly()
    };

    setAdvances(prev => [...prev, nAdv]);

    // Reset draft fields
    setNewAdvAmount('');
    setNewAdvNotes('');
    setNewAdvReceivedByDriverDirectly(false);
    setTimeout(() => advanceDateInputRef?.focus(), 0);
  };

  const handleRemoveAdvance = (id: string) => {
    setAdvances(prev => prev.filter(adv => adv.id !== id));
  };

  // Submit complete master ledger report
  const handleSubmitMasterForm = (e: Event) => {
    e.preventDefault();

    const finalTripNo = editingEntry
      ? tripNo()
      : (tripNoOption() === 'AUTO' ? tripNo() : selectedExistingTripNo());

    if (!finalTripNo || !truckNo() || !driverName()) {
      alert("Trip Number, operational Truck and Operator Driver Name are required.");
      return;
    }

    const selectedTruck = trucks().find(t => t.truckNo === truckNo());
    const isUnchangedEdit = editingEntry() && truckNo() === editingEntry()?.truckNo;
    if (selectedTruck && !isUnchangedEdit) {
      const isExpired = selectedTruck.registrationExpiryDate ? selectedTruck.registrationExpiryDate < todayStr : false;
      const isAdminDisabled = selectedTruck.status === 'Admin Disabled';
      const isNotApproved = selectedTruck.isApproved === false || selectedTruck.requestStatus === 'Rejected';
      if (isExpired || isAdminDisabled || isNotApproved) {
        let reason = "expired";
        if (isAdminDisabled) reason = "admin disabled";
        else if (isNotApproved) reason = "not approved";
        alert(`Cannot create/update trip: Selected truck ${truckNo()} is ${reason}.`);
        return;
      }
    }

    if (subTrips().length === 0) {
      alert("Fleet compliance requires registering at least 1 Cargo sub-trip segment for this trip journey.");
      return;
    }

    const startKMVal = Number(startingKM()) || 0;
    const endKMVal = Number(endingKM()) || 0;
    if (endKMVal > 0 && endKMVal < startKMVal) {
      alert(`Invalid Odometer Reading: Ending odometer (${endKMVal} KM) cannot be lower than starting odometer (${startKMVal} KM).`);
      return;
    }

    // Pass validated state upstream
    onSubmit({
      tripNo: finalTripNo,
      truckNo: truckNo(),
      startDate: startDate(),
      endDate: endDate(),
      driverName: driverName().trim(),
      startingKM: Number(startingKM()) || 0,
      endingKM: Number(endingKM()) || 0,
      payments: payments(),
      advances: advances(),
      subTrips: subTrips(),
      fuels: fuels(), // N fuels() list
      status: status(),
      notes: notes().trim() || undefined,
      rtoExpense: Number(rtoExpense()) || 0,
      rtoPaidByDriver: rtoPaidByDriver(),
      dieselLiters: fuels().length > 0 ? fuels().reduce((sum, f) => sum + Number(f.liters), 0) : Number(dieselLiters()) || 0,
      dieselAmount: fuels().length > 0 ? fuels().reduce((sum, f) => sum + Number(f.amount), 0) : Number(dieselAmount()) || 0,
      dieselRate: fuels().length > 0 ? (fuels().reduce((sum, f) => sum + Number(f.amount), 0) / (fuels().reduce((sum, f) => sum + Number(f.liters), 0) || 1)) : Number(dieselRate()) || 0,
      addBlueExpense: Number(addBlueExpense()) || 0,
      addBluePaidByDriver: addBluePaidByDriver(),
      fastagExpense: Number(fastagExpense()) || 0,
      fastagPaidByDriver: fastagPaidByDriver(),
      otherExpense: Number(otherExpense()) || 0,
      otherPaidByDriver: otherPaidByDriver()
    });

    onClose();
  };

  return (
    <Show when={isOpen()}>
      <div
        class="fixed inset-0 bg-slate-950/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans"
      >
        <div
          class="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh] animate-scale-up"
        >

          {/* HEADER SPEC CHIPS */}
          <div class="px-6 py-4.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
                <Coins class="w-5 h-5 text-blue-600" />
                {editingEntry() ? `Modify Fleet Trip Journal: ${editingEntry()?.tripNo}` : 'Initiate Unified Fleet Journey'}
              </h3>
            <p class="text-xs text-slate-500 mt-0.5">Define master trip timelines, driver logs, multi-cargo sub-trips and financial settlement receipts.</p>
          </div>
          <button
            onClick={onClose}
            class="p-1.5 text-slate-400 hover:text-slate-655 bg-slate-200/50 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        {/* MODAL MAIN CONTENTS CONTAINER WITH DUAL GRID SCROLL */}
        <div class="flex-1 overflow-y-auto p-6 space-y-6">

          {/* DYNAMIC AUTO GENERATOR PREFERENCES */}
          {!editingEntry && (
            <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="space-y-0.5">
                <span class="text-xs font-bold text-slate-800 block uppercase tracking-wider font-sans">Trip Series Configuration</span>
                <span class="text-[11px] text-slate-550 block">Unify consecutive freight loads under a single overarching sequence.</span>
              </div>
              <div class="flex bg-slate-205 bg-slate-200 rounded-lg p-1 gap-1 h-9 min-w-[320px]">
                <button
                  type="button"
                  onClick={() => setTripNoOption('AUTO')}
                  class={`flex-1 rounded text-xs font-bold transition duration-200 cursor-pointer ${tripNoOption() === 'AUTO'
                    ? 'bg-white text-slate-900 shadow-3xs'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Auto Series ID
                </button>
                <button
                  type="button"
                  disabled={existingTripNos.length === 0}
                  onClick={() => setTripNoOption('EXISTING')}
                  class={`flex-1 rounded text-xs font-bold transition duration-200 disabled:opacity-40 cursor-pointer ${tripNoOption() === 'EXISTING'
                    ? 'bg-white text-slate-900 shadow-3xs'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Join Existing ID ({existingTripNos.length})
                </button>
              </div>
            </div>
          )}

          {/* MASTER DETAILS EXPANSION SECTION */}
          <div class="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <span class="text-[10px] font-bold text-blue-600 uppercase tracking-widest block border-b border-slate-150 pb-2">
              Category 1: Master Journey Specifications
            </span>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* TRIP CODE */}
              <div>
                <label class="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">Trip Code ID <span class="text-red-500">*</span></label>
                {editingEntry ? (
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
                    disabled
                    value={tripNo()}
                    class="w-full bg-slate-100 border border-slate-200 text-slate-500 font-mono font-bold tracking-wider rounded-lg px-3 py-2 text-xs cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={selectedExistingTripNo()}
                    onChange={(e) => setSelectedExistingTripNo(e.target.value)}
                    required
                    class="w-full bg-slate-50 border border-slate-200 text-blue-700 font-mono font-bold tracking-wider rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    {existingTripNos().map(no => (
                      <option  value={no}>{no}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* TRUCK SELECT */}
              <div>
                <label for="select-truckNo()" class="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">Target Truck <span class="text-red-500">*</span></label>
                <select
                  id="select-truckNo()"
                  value={truckNo()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTruckNo(val);
                    if (!editingEntry()) {
                      setStartingKM(getLatestKMForTruck(val));
                    }
                  }}
                  required
                  class="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono font-bold rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="">-- Choose Truck --</option>
                  {activeTrucks().map(truck => {
                    const isExpired = truck.registrationExpiryDate ? truck.registrationExpiryDate < todayStr : false;
                    const isAdminDisabled = truck.status === 'Admin Disabled';
                    const isNotApproved = truck.isApproved === false || truck.requestStatus === 'Rejected';
                    const isBlocked = isExpired || isAdminDisabled || isNotApproved;
                    const isSelected = editingEntry() && truck.truckNo === editingEntry()?.truckNo;

                    let labelSuffix = '';
                    if (isAdminDisabled) labelSuffix = ' (Admin Disabled)';
                    else if (isNotApproved) labelSuffix = ' (Not Approved)';
                    else if (isExpired) labelSuffix = ' (Expired)';

                    return (
                      <option
                        
                        value={truck.truckNo}
                        disabled={isBlocked && !isSelected}
                      >
                        {truck.truckNo} ({truck.ownerName || 'Self'}){labelSuffix}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* DRIVER NAME */}
              <div>
                <label for="select-driverName()" class="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5 font-sans font-sans">Driver Operator <span class="text-red-500">*</span></label>
                <select
                  id="select-driverName()"
                  value={driverName()}
                  onChange={(e) => setDriverName(e.target.value)}
                  required
                  class="w-full bg-slate-50 border border-slate-200 text-slate-800 font-semibold rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white font-sans"
                >
                  <option value="">-- Choose Driver --</option>
                  {drivers().map(d => {
                    const isInactive = d.status === 'Inactive';
                    const isSelected = d.driverName === driverName();
                    if (isInactive && !isSelected) return null;
                    return (
                      <option  value={d.driverName}>
                        {d.driverName} {canViewDrivers() && d.phone ? `(${d.phone})` : ''}{isInactive ? ' (Inactive)' : ''}
                      </option>
                    );
                  })}
                  {driverName() && !drivers().some(d => d.driverName === driverName()) && (
                    <option value={driverName()}>{driverName()} (Manual Override)</option>
                  )}
                </select>
              </div>

              {/* STATUS INDICATOR */}
              <div>
                <label class="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">Journey Operational Status</label>
                <select
                  value={status()}
                  onChange={(e) => setStatus(e.target.value as TripStatus)}
                  class="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="Pending">Pending (Not Initiated)</option>
                  <option value="In Progress">In Progress (On Wheels)</option>
                  <option value="Completed">Completed (Goods Delivered)</option>
                  <option value="Paid">Settled (Fully Paid Account)</option>
                </select>
              </div>
            </div>

            {/* ODOMETER AND TIMEFRAME SPECS */}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label class="block text-[10px] text-slate-500 font-bold uppercase mb-1">Journey Start Date</label>
                <div class="relative">
                  <Calendar class="absolute left-2 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={startDate()}
                    onChange={(e) => setStartDate(e.target.value)}
                    class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg pl-7 pr-1.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[10px] text-slate-500 font-bold uppercase mb-1">Journey End Date</label>
                <div class="relative">
                  <Calendar class="absolute left-2 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={endDate()}
                    onChange={(e) => setEndDate(e.target.value)}
                    class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg pl-7 pr-1.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label for="input-startingKM()" class="block text-[10px] text-slate-550 font-bold uppercase mb-1">Starting Odometer (KM)</label>
                <input
                  id="input-startingKM()"
                  type="number"
                  min="0"
                  required
                  value={startingKM() || ''}
                  onChange={(e) => setStartingKM(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-right font-mono"
                />
              </div>

              <div>
                <label for="input-endingKM()" class="block text-[10px] text-slate-550 font-bold uppercase mb-1">Ending Odometer (KM)</label>
                <input
                  id="input-endingKM()"
                  type="number"
                  min="0"
                  value={endingKM() || ''}
                  onChange={(e) => setEndingKM(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0 (Optional)"
                  class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-right font-mono"
                />
              </div>
            </div>
          </div>

          {/* DYNAMIC CHILD SUB-TRIPS CONSTRUCTOR SECTOR */}
          <div class="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div class="flex justify-between items-center border-b border-slate-150 pb-2.5">
              <span class="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">
                Category 2: Cargo Sub-Trip Segments & Expenditures
              </span>
              <button
                type="button"
                onClick={handleOpenNewSubTrip}
                class="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] px-3.5 py-2 rounded-lg cursor-pointer transition shadow-2xs h-9"
              >
                <Plus class="w-4 h-4" /> Add Cargo Segment
              </button>
            </div>

            {/* Dynamic drafting sub-trips list visual list table */}
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

                return {
                  st,
                  wagesAmt,
                  segmentPayments,
                  segmentReceivable,
                  driverSpend,
                  brokerage
                };
              });

              const totals = calculatedSubTrips.reduce(
                (acc, item) => {
                  acc.income += item.st.income;
                  acc.payments += item.segmentPayments;
                  acc.receivable += item.segmentReceivable;
                  acc.wages += item.wagesAmt;
                  acc.driverSpend += item.driverSpend;
                  acc.brokerage += item.brokerage;
                  return acc;
                },
                { income: 0, payments: 0, receivable: 0, wages: 0, driverSpend: 0, brokerage: 0 }
              );

              return (
                <div class="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-3xs font-sans">
                  <table class="w-full min-w-[800px] text-xs text-left">
                    <thead class="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th class="p-3 pl-4"># Seg</th>
                        <th class="p-3">Load Date</th>
                        <th class="p-3">Office Name</th>
                        <th class="p-3">Route Path</th>
                        <th class="p-3 text-right">Income (₹)</th>
                        <th class="p-3 text-right">Payments (₹)</th>
                        <th class="p-3 text-right">Receivable (₹)</th>
                        <th class="p-3 text-right">Wages (₹)</th>
                        <th class="p-3 text-right">Driver Spend (₹)</th>
                        <th class="p-3 text-right">Brokerage (₹)</th>
                        <th class="p-3 text-center">Edit / Delete</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 font-medium">
                      {calculatedSubTrips.map((item, sidx) => {
                        const { st, wagesAmt, segmentPayments, segmentReceivable, driverSpend, brokerage } = item;
                        return (
                          <tr  class="hover:bg-slate-50/70 transition">
                            <td class="p-3 pl-4 font-bold text-slate-400">#{sidx + 1}</td>
                            <td class="p-3 font-mono text-slate-650">{st.loadingDate}</td>
                            <td class="p-3 text-blue-650 font-bold">{st.officeName}</td>
                            <td class="p-3 text-slate-800 font-semibold">{st.routeFrom} ➔ {st.routeTo}</td>
                            <td class="p-3 text-right font-bold text-emerald-850 font-mono">₹{st.income.toLocaleString()}</td>
                            <td class="p-3 text-right font-semibold font-mono text-indigo-700">
                              <div class="flex flex-col items-end">
                                <span class="font-bold text-slate-850">₹{segmentPayments.toLocaleString()}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePaymentSubTripId(st.id);
                                    setNewPayDate(new Date().toISOString().substring(0, 10));
                                    setNewPayAmount('');
                                    setNewPayNotes('');
                                  }}
                                  class="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer mt-0.5"
                                >
                                  Pay/View
                                </button>
                              </div>
                            </td>
                            <td class={`p-3 text-right font-bold font-mono ${segmentReceivable > 0 ? 'text-blue-700' :
                              segmentReceivable === 0 ? 'text-slate-400 font-normal' :
                                'text-amber-700'
                              }`}>
                              ₹{segmentReceivable.toLocaleString()}
                            </td>
                            <td class="p-3 text-right font-medium text-amber-700 font-mono">₹{wagesAmt.toLocaleString()}</td>
                            <td class="p-3 text-right font-medium text-slate-700 font-mono">₹{driverSpend.toLocaleString()}</td>
                            <td class="p-3 text-right font-medium text-purple-700 font-mono">₹{brokerage.toLocaleString()}</td>
                            <td class="p-3 text-center align-middle">
                              <div class="flex items-center justify-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSubTrip(st)}
                                  class="text-blue-600 hover:text-blue-800 font-bold text-[11px] flex items-center gap-0.5"
                                >
                                  <Edit2 class="w-3 h-3" /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubTripSegment(st.id)}
                                  class="text-rose-600 hover:text-rose-800 font-bold text-[11px] flex items-center gap-0.5"
                                >
                                  <Trash2 class="w-3 h-3" /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr class="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-700">
                        <td colSpan={4} class="p-3 pl-4 text-right uppercase tracking-wider text-[10px] text-slate-500 font-bold">Total</td>
                        <td class="p-3 text-right font-bold text-emerald-850 font-mono">₹{totals.income.toLocaleString()}</td>
                        <td class="p-3 text-right font-bold text-slate-800 font-mono">₹{totals.payments.toLocaleString()}</td>
                        <td class={`p-3 text-right font-bold font-mono ${totals.receivable > 0 ? 'text-blue-700' :
                          totals.receivable === 0 ? 'text-slate-400 font-normal' :
                            'text-amber-700'
                          }`}>
                          ₹{totals.receivable.toLocaleString()}
                        </td>
                        <td class="p-3 text-right font-bold text-amber-700 font-mono">₹{totals.wages.toLocaleString()}</td>
                        <td class="p-3 text-right font-bold text-slate-700 font-mono">₹{totals.driverSpend.toLocaleString()}</td>
                        <td class="p-3 text-right font-bold text-purple-700 font-mono">₹{totals.brokerage.toLocaleString()}</td>
                        <td class="p-3 text-center"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })() : (
              <div class="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-350 p-4">
                <p class="text-xs text-slate-500 italic font-medium">No cargo sub-trip load segments drafted yet.</p>
                <p class="text-[10px] text-slate-400 mt-1">Fleet regulations require at least one cargo shipment segment to compute fuel efficiency, per KM cost, and profit margins.</p>
                <button
                  type="button"
                  onClick={handleOpenNewSubTrip}
                  class="mt-3.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-[11px] py-1.5 px-3 rounded-lg shadow-3xs cursor-pointer inline-flex items-center gap-1 bg-neutral-100"
                >
                  <Plus class="w-3.5 h-3.5" /> Append First Document Segment
                </button>
              </div>
            )}

            {showSubTripForm() && (
              <div
                onClick={handleCancelSubTripSegment}
                class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto no-print"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  class="bg-white rounded-2xl border border-slate-205 p-6 space-y-4 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-scale-up font-sans"
                >
                  <div class="flex justify-between items-center border-b border-slate-200 pb-3">
                    <div class="flex items-center gap-3 flex-wrap">
                      <span class="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider font-sans">
                        <ListCollapse class="w-4 h-4 text-blue-650" />
                        {editingSubTripId() ? 'Edit Sub-Trip Cargo Segment parameters' : 'Construct New Sub-Trip Cargo Segment'}
                      </span>
                      <span class={`text-[10px] font-bold px-2.5 py-1 rounded-lg border font-mono ${liveSegmentReceivable > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        liveSegmentReceivable === 0 ? 'bg-slate-50 text-slate-600 border-slate-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                        Est. Receivable: ₹{liveSegmentReceivable.toLocaleString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      title="Close"
                      onClick={handleCancelSubTripSegment}
                      class="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition cursor-pointer"
                    >
                      <X class="w-4 h-4" />
                    </button>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* SEG DATES */}
                    <div>
                      <label class="block text-[10px] text-slate-550 font-bold uppercase mb-1">Cargo Loading Date</label>
                      <input
                        type="date"
                        required
                        value={stLoadingDate()}
                        onChange={(e) => setStLoadingDate(e.target.value)}
                        class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>

                    {/* LOADING OFFICE PLACE */}
                    <div>
                      <label class="block text-[10px] text-slate-550 font-bold uppercase mb-1">Loading Office <span class="text-red-500">*</span></label>
                      <select
                        value={stOfficeName()}
                        onChange={(e) => setStOfficeName(e.target.value)}
                        class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold"
                      >
                        <option value="">-- Choose Office --</option>
                        {activeOffices().map(o => (
                          <option  value={o.officeName}>{o.officeName}</option>
                        ))}
                      </select>
                    </div>

                    {/* ROUTE ORIGIN */}
                    <div>
                      <label for="input-stRouteFrom()" class="block text-[10px] text-slate-555 font-bold uppercase mb-1">Route Origin <span class="text-red-500">*</span></label>
                      <input
                        id="input-stRouteFrom()"
                        type="text"
                        list="indian_cities_list"
                        placeholder="e.g. Bangalore"
                        value={stRouteFrom()}
                        onChange={(e) => setStRouteFrom(e.target.value)}
                        class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                      />
                    </div>

                    {/* ROUTE END DESTINATION */}
                    <div>
                      <label for="input-stRouteTo()" class="block text-[10px] text-slate-555 font-bold uppercase mb-1">Route Destination <span class="text-red-500">*</span></label>
                      <input
                        id="input-stRouteTo()"
                        type="text"
                        list="indian_cities_list"
                        placeholder="e.g. Mumbai Port"
                        value={stRouteTo()}
                        onChange={(e) => setStRouteTo(e.target.value)}
                        class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                      />
                    </div>

                    {/* INDIAN CITIES DATALIST */}
                    <datalist id="indian_cities_list">
                      {indianCities.map(city => (
                        <option  value={city} />
                      ))}
                    </datalist>
                  </div>

                  {/* CARGO SPECS: MATERIAL, NO OF TONS, RATE PER TON */}
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 mt-2">
                    <div>
                      <label for="input_st_material" class="block text-[10px] text-slate-555 font-bold uppercase mb-1">Material Description</label>
                      <input
                        id="input_st_material"
                        type="text"
                        placeholder="e.g. Steel Pipe, Cement, Coal"
                        value={stMaterial()}
                        onChange={(e) => setStMaterial(e.target.value)}
                        class="w-full bg-white border border-slate-250 text-slate-855 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500 font-sans"
                      />
                    </div>
                    <div>
                      <label for="input_st_noOfTons" class="block text-[10px] text-slate-555 font-bold uppercase mb-1">No of Tons</label>
                      <input
                        id="input_st_noOfTons"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={stNoOfTons() || ''}
                        onChange={(e) => {
                          const tons = parseFloat(e.target.value) || 0;
                          setStNoOfTons(tons);
                          const calculatedIncome = tons * (stRatePerTon() || 0);
                          if (calculatedIncome > 0) {
                            setStIncome(calculatedIncome);
                            if (stWagePct()) {
                              const pct = parseFloat(stWagePct());
                              if (!isNaN(pct) && pct > 0) {
                                setStDriverWages(Math.round(calculatedIncome * (pct / 100)));
                              }
                            }
                          }
                        }}
                        class="w-full bg-white border border-slate-250 text-slate-805 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono font-semibold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label for="input_st_ratePerTon" class="block text-[10px] text-slate-555 font-bold uppercase mb-1">Rate per Ton</label>
                      <input
                        id="input_st_ratePerTon"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={stRatePerTon() || ''}
                        onChange={(e) => {
                          const rate = parseFloat(e.target.value) || 0;
                          setStRatePerTon(rate);
                          const calculatedIncome = (stNoOfTons() || 0) * rate;
                          if (calculatedIncome > 0) {
                            setStIncome(calculatedIncome);
                            if (stWagePct()) {
                              const pct = parseFloat(stWagePct());
                              if (!isNaN(pct) && pct > 0) {
                                setStDriverWages(Math.round(calculatedIncome * (pct / 100)));
                              }
                            }
                          }
                        }}
                        class="w-full bg-white border border-slate-250 text-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono font-semibold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* CARGO REVENUE & DRIVER WAGES */}
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                    {/* SEG FREIGHT INCOME */}
                    <div>
                      <label for="input_st_income" class="block text-[10px] text-slate-555 font-bold uppercase mb-1 font-sans">₹ Billed Freight Income <span class="text-red-500">*</span></label>
                      <input
                        id="input_st_income"
                        type="number"
                        min="0"
                        value={stIncome() || ''}
                        onChange={(e) => {
                          const newIncome = parseFloat(e.target.value) || 0;
                          setStIncome(newIncome);
                          if (stWagePct()) {
                            const pct = parseFloat(stWagePct());
                            if (!isNaN(pct) && pct > 0) {
                              setStDriverWages(Math.round(newIncome * (pct / 100)));
                            }
                          }
                        }}
                        placeholder="0"
                        class="w-full bg-white border border-slate-250 text-slate-855 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono font-bold text-emerald-855"
                      />
                      <span class="text-[10px] text-slate-500 block mt-1">
                        Est. Net Receivable: <strong class={
                          liveSegmentReceivable > 0 ? 'text-blue-700 font-bold' :
                            liveSegmentReceivable === 0 ? 'text-slate-500 font-semibold' :
                              'text-amber-700 font-bold'
                        }>₹{liveSegmentReceivable.toLocaleString()}</strong> (freight income less rental deductions)
                      </span>
                    </div>

                    {/* WAGES */}
                    <div>
                      <label class="block text-[10px] text-slate-450 font-bold uppercase mb-1">Driver Wages / Allowance</label>
                      <div class="flex gap-1.5">
                        <select
                          id="select_st_wage_percentage"
                          value={stWagePct()}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStWagePct(val);
                            const numVal = Number(val);
                            if (numVal > 0) {
                              const calculatedWages = Math.round(Number(stIncome()) * (numVal / 100));
                              setStDriverWages(calculatedWages);
                            }
                          }}
                          class="bg-slate-50 border border-slate-250 text-slate-700 rounded-lg px-1 text-[10px] focus:outline-none"
                          style={{ width: '75px' }}
                        >
                          <option value="">% Calc</option>
                          {Array.from({ length: 20 }, (_, idx) => idx + 1).map(p => (
                            <option  value={p.toString()}>{p}%</option>
                          ))}
                        </select>
                        <input
                          id="input_st_driverwages"
                          type="number"
                          min="0"
                          value={stDriverWages() || ''}
                          onChange={(e) => {
                            setStDriverWages(parseFloat(e.target.value) || 0);
                            setStWagePct(''); // Break linkage if manually typed
                          }}
                          placeholder="0"
                          class="w-full bg-white border border-slate-250 text-slate-80 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono text-slate-705"
                        />
                      </div>
                    </div>
                  </div>

                  {/* DYNAMIC LEG EXPENSES (CARGO LIST) */}
                  <div class="pt-4 border-t border-slate-100 space-y-4">
                    <div class="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Leg Expenses (Dynamic Cargo List)</span>
                      <span class="text-[10px] font-semibold text-slate-505 bg-slate-100 px-2 py-0.5 rounded">
                        Total Added: {stCargoExpenses().length}
                      </span>
                    </div>

                    {/* 1. List of currently added cargo expenses */}
                    <div class="border border-slate-205 rounded-xl overflow-hidden shadow-3xs bg-white text-xs">
                      {stCargoExpenses().length === 0 ? (
                        <div class="p-6 text-center text-slate-500 font-medium">
                          No cargo expenses added to this segment yet. Use the form below to add them one-by-one.
                        </div>
                      ) : (
                        <table class="w-full text-left border-collapse">
                          <thead>
                            <tr class="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                              <th class="p-2.5 pl-4">Type</th>
                              <th class="p-2.5 text-right">Amount</th>
                              <th class="p-2.5">Paid By / Deduct</th>
                              <th class="p-2.5">Who Bears?</th>
                              <th class="p-2.5 text-center pr-4">Action</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                            {stCargoExpenses().map((exp) => (
                              <tr  class="hover:bg-slate-50/85 transition-colors">
                                <td class="p-2.5 pl-4 font-bold text-slate-800">{exp.expenseType}</td>
                                <td class="p-2.5 text-right font-mono font-bold text-slate-900">₹{exp.amount.toLocaleString()}</td>
                                <td class="p-2.5 text-slate-600 font-semibold">
                                  {exp.deductedFrom === 'OrgRental' ? 'Org Rental (Office Paid)' : exp.deductedFrom === 'OrgPaid' ? 'Org Paid (Direct/Bank)' : 'Driver Paid (Advance)'}
                                </td>
                                <td class="p-2.5">
                                  <span class={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${exp.bears === 'Org' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                    exp.bears === 'Driver' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                      'bg-purple-50 text-purple-700 border border-purple-100'
                                    }`}>
                                    {exp.bears === 'Org' ? 'Organization' : exp.bears === 'Driver' ? 'Driver' : 'Office'}
                                  </span>
                                </td>
                                <td class="p-2.5 text-center pr-4">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveCargoExpense(exp.id)}
                                    class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition cursor-pointer"
                                    title="Delete Expense"
                                  >
                                    <Trash2 class="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* 2. Controls to add a new cargo expense */}
                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <span class="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">Add Leg Expense</span>

                      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Expense Type */}
                        <div>
                          <label class="block text-[8px] text-slate-500 font-bold uppercase mb-1">Expense Type</label>
                          <select
                            value={newCargoExpType()}
                            onChange={(e) => setNewCargoExpType(e.target.value as any)}
                            class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                          >
                            <option value="Loading">Loading</option>
                            <option value="Unloading">Unloading</option>
                            <option value="Brokerage">Brokerage</option>
                            <option value="Crossing">Crossing (Mamul)</option>
                            <option value="RMC">RMC Expense</option>
                          </select>
                        </div>

                        {/* Amount */}
                        <div>
                          <label class="block text-[8px] text-slate-500 font-bold uppercase mb-1">Amount (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={newCargoExpAmount()}
                            onChange={(e) => setNewCargoExpAmount(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="e.g. 1500"
                            class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold text-right focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* Paid By */}
                        <div>
                          <label class="block text-[8px] text-slate-500 font-bold uppercase mb-1">Paid By / Deduct</label>
                          <select
                            value={newCargoExpDeductedFrom()}
                            onChange={(e) => setNewCargoExpDeductedFrom(e.target.value as any)}
                            class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                          >
                            <option value="DriverDirect">Driver Paid (Advance)</option>
                            <option value="OrgRental">Org Rental (Office Paid)</option>
                            <option value="OrgPaid">Org Paid (Direct/Bank)</option>
                          </select>
                        </div>

                        {/* Who Bears */}
                        <div>
                          <label class="block text-[8px] text-slate-500 font-bold uppercase mb-1">Who Bears?</label>
                          <select
                            value={newCargoExpBears()}
                            onChange={(e) => setNewCargoExpBears(e.target.value as any)}
                            class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                          >
                            <option value="Org">Organization</option>
                            <option value="Driver">Driver</option>
                            <option value="Office">Office</option>
                          </select>
                        </div>
                      </div>

                      <div class="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleAddCargoExpense}
                          class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] px-4 py-1.5 rounded-lg cursor-pointer transition shadow-3xs flex items-center gap-1 border border-blue-550"
                        >
                          <Plus class="w-3.5 h-3.5" /> Add Leg Expense
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SEG ODOMETER KM SPEC */}
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 bg-slate-100 rounded-lg p-3.5 border border-slate-150">
                    <div>
                      <label class="block text-[10px] text-slate-500 font-bold uppercase mb-1">Segment Starting KM</label>
                      <input
                        type="number"
                        min="0"
                        value={stStartingKM() || ''}
                        onChange={(e) => setStStartingKM(parseInt(e.target.value) || 0)}
                        placeholder="Odo start"
                        class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-right"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] text-slate-500 font-bold uppercase mb-1">Segment Ending KM</label>
                      <input
                        type="number"
                        min="0"
                        value={stEndingKM() || ''}
                        onChange={(e) => setStEndingKM(parseInt(e.target.value) || 0)}
                        placeholder="Odo end"
                        class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-right"
                      />
                    </div>
                  </div>

                  {/* SEG NOTES */}
                  <div>
                    <label class="block text-[10px] text-slate-450 font-bold uppercase mb-1">Segment remarks / Consignment detail</label>
                    <input
                      type="text"
                      placeholder="e.g. Iron rods loaded at Bangalore yard. Clear highway transit."
                      value={stNotes()}
                      onChange={(e) => setStNotes(e.target.value)}
                      class="w-full bg-white border border-slate-250 text-slate-850 rounded-lg px-3 py-2 text-xs"
                    />
                  </div>

                  {/* ACTION SEGMENT POSTS */}
                  <div class="flex justify-end gap-2.5 border-t border-slate-200 pt-3.5">
                    <button
                      type="button"
                      onClick={handleCancelSubTripSegment}
                      class="px-4 py-2 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSubTripSegmentConfirm}
                      class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-lg cursor-pointer transition shadow-2xs border border-emerald-550"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {activePaymentSubTripId() && (() => {
            const st = subTrips().find(item => item.id === activePaymentSubTripId());
            if (!st) return null;
            const sidx = subTrips().indexOf(st);
            const subTripPayments = payments().filter(p => p.subTripId === activePaymentSubTripId());

            const activeSegmentDeductions = st.cargoExpenses
              ? st.cargoExpenses.filter(e => e.deductedFrom === 'OrgRental').reduce((sum, e) => sum + e.amount, 0)
              : 0;

            const activeSegmentOfficeBears = st.cargoExpenses
              ? st.cargoExpenses.filter(e => e.bears === 'Office').reduce((sum, e) => sum + e.amount, 0)
              : 0;

            const activeSegmentPaid = subTripPayments.reduce((sum, p) => sum + p.amount, 0);
            const activeSegmentReceivable = st.income - activeSegmentDeductions + activeSegmentOfficeBears - activeSegmentPaid;

            return (
              <div
                onClick={() => setActivePaymentSubTripId(null)}
                class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto no-print"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  class="bg-white rounded-2xl border border-slate-205 p-6 space-y-5 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-up font-sans"
                >
                  {/* Header */}
                  <div class="flex justify-between items-center border-b border-slate-200 pb-3">
                    <div class="flex items-center gap-3 flex-wrap">
                      <span class="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider font-sans">
                        <Coins class="w-4 h-4 text-blue-650" />
                        Manage Payments - Leg #{sidx + 1}
                      </span>
                      <span class="text-[10px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                        {st.routeFrom} ➔ {st.routeTo} ({st.officeName})
                      </span>
                    </div>
                    <button
                      type="button"
                      title="Close"
                      onClick={() => setActivePaymentSubTripId(null)}
                      class="text-slate-400 hover:text-slate-605 p-1 rounded-full hover:bg-slate-200 transition cursor-pointer"
                    >
                      <X class="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sub-Trip Finances Summary Cards */}
                  <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
                    <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Freight Income</span>
                      <span class="text-sm font-black font-mono text-slate-800 block mt-0.5">₹{st.income.toLocaleString()}</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Deductions</span>
                      <span class="text-sm font-black font-mono text-red-650 block mt-0.5">₹{activeSegmentDeductions.toLocaleString()}</span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Total Paid</span>
                      <span class="text-sm font-black font-mono text-indigo-750 block mt-0.5">₹{activeSegmentPaid.toLocaleString()}</span>
                    </div>
                    <div class={`border rounded-xl p-3 ${activeSegmentReceivable > 0 ? 'bg-blue-50 border-blue-200 text-blue-800' :
                      activeSegmentReceivable === 0 ? 'bg-slate-50 border-slate-200 text-slate-700' :
                        'bg-amber-50 border-amber-200 text-amber-800'
                      }`}>
                      <span class="text-[9px] font-bold uppercase tracking-wider block opacity-70">Receivable Balance</span>
                      <span class="text-sm font-black font-mono block mt-0.5">₹{activeSegmentReceivable.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Payments List Table */}
                  <div class="space-y-2">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Registered Payments</span>

                    <div class="border border-slate-200 rounded-xl overflow-hidden shadow-3xs bg-white text-xs">
                      {subTripPayments.length === 0 ? (
                        <div class="p-6 text-center text-slate-500 font-medium">
                          No payment receipts logged for this segment yet.
                        </div>
                      ) : (
                        <table class="w-full text-left border-collapse">
                          <thead>
                            <tr class="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                              <th class="p-2.5 pl-4">Date</th>
                              <th class="p-2.5">Account</th>
                              <th class="p-2.5 text-right font-semibold">Amount (₹)</th>
                              <th class="p-2.5 pl-4">Notes</th>
                              <th class="p-2.5 text-center pr-4">Action</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-100 font-medium text-slate-750">
                            {subTripPayments.map((p) => {
                              const acc = activeAccounts().find(a => a.id === p.receivedBy);
                              const fuelCard = orgProfile()?.fuelCards?.find(fc => fc.id === p.receivedBy);
                              const accountDisplay = p.receivedBy === 'paid_to_driver_advance'
                                ? 'Paid to Driver Advance'
                                : fuelCard
                                  ? `${fuelCard.cardName} (Fuel Card)`
                                  : (acc?.accountName || p.receivedBy);
                              return (
                                <tr  class="hover:bg-slate-50/85 transition-colors">
                                  <td class="p-2.5 pl-4 font-mono text-[10px]">{p.date}</td>
                                  <td class="p-2.5 text-blue-650 font-bold">{accountDisplay}</td>
                                  <td class="p-2.5 text-right font-mono font-bold text-slate-900">₹{p.amount.toLocaleString()}</td>
                                  <td class="p-2.5 pl-4 text-slate-500 font-semibold">{p.notes || '—'}</td>
                                  <td class="p-2.5 text-center pr-4">
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePayment(p.id)}
                                      class="text-red-550 hover:text-red-700 p-1 rounded hover:bg-red-50 transition cursor-pointer"
                                      title="Discard Payment"
                                    >
                                      <Trash2 class="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* Quick Add Payment Form Widget */}
                  <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <span class="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">Register New Payment Receipt</span>

                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Date */}
                      <div>
                        <label class="block text-[8px] text-slate-500 font-bold uppercase mb-1">Receipt Date</label>
                        <input
                          type="date"
                          value={newPayDate()}
                          onChange={(e) => setNewPayDate(e.target.value)}
                          class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>

                      {/* Account */}
                      <div>
                        <label class="block text-[8px] text-slate-500 font-bold uppercase mb-1">Ledger Account</label>
                        <select
                          value={newPayReceivedBy()}
                          onChange={(e) => setNewPayReceivedBy(e.target.value)}
                          class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                        >
                          <option value="">-- Choose Account --</option>
                          <option value="paid_to_driver_advance">Paid to Driver Advance</option>
                          <option value="Cash">Cash</option>
                          {orgProfile()?.fuelCards && orgProfile()?.fuelCards?.filter(c => c.status === 'Active' || c.id === newPayReceivedBy()).map(c => (
                            <option  value={c.id}>{c.cardName} (Fuel Card)</option>
                          ))}
                          {activeAccounts().map(ac => (
                            <option  value={ac.id}>{ac.accountName}</option>
                          ))}
                        </select>
                      </div>

                      {/* Amount */}
                      <div>
                        <label class="block text-[8px] text-slate-500 font-bold uppercase mb-1">Amount (₹)</label>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={newPayAmount()}
                          onChange={(e) => setNewPayAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          placeholder="₹0.00"
                          class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-right focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Notes */}
                      <div>
                        <label class="block text-[8px] text-slate-500 font-bold uppercase mb-1">Notes / Cargo Ref</label>
                        <input
                          type="text"
                          placeholder="e.g. Bank online transfer"
                          value={newPayNotes()}
                          onChange={(e) => setNewPayNotes(e.target.value)}
                          class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div class="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleAddPayment(activePaymentSubTripId())}
                        class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] px-4 py-1.5 rounded-lg cursor-pointer transition shadow-3xs flex items-center gap-1 border border-blue-550"
                      >
                        <Plus class="w-3.5 h-3.5" /> Register Payment
                      </button>
                    </div>
                  </div>

                  {/* Footer controls */}
                  <div class="flex justify-end pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActivePaymentSubTripId(null)}
                      class="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* DRIVER TRIP ADVANCES LEDGER MODULE (Requirement 1 & 4) */}
          <div class="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <span class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block border-b border-slate-150 pb-2">
              Category 3: Driver advances() for entire trip (Cash/Direct Bank issued to Driver)
            </span>

            {advances() && advances().length > 0 ? (
              <div class="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-3xs text-xs font-sans">
                <table class="w-full min-w-[800px] text-left">
                  <thead class="bg-slate-50 text-[10px] text-slate-550 uppercase font-bold tracking-wider">
                    <tr>
                      <th class="p-2.5 pl-4">#</th>
                      <th class="p-2.5">Date Given</th>
                      <th class="p-2.5">From Account</th>
                      <th class="p-2.5 text-right font-semibold">Amount (₹)</th>
                      <th class="p-2.5 pl-6">Receiving Status / Type</th>
                      <th class="p-2.5 pl-6">Purpose / Memo</th>
                      <th class="p-2.5 text-right pr-4">Discard</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 font-medium">
                    {advances().map((adv, advIdx) => {
                      const acc = activeAccounts().find(a => a.id === adv.fromAccountId);
                      const fuelCard = orgProfile()?.fuelCards?.find(fc => fc.id === adv.fromAccountId);
                      const accountDisplay = fuelCard ? `${fuelCard.cardName} (Fuel Card)` : (acc?.accountName || adv.fromAccountId);
                      return (
                        <tr  class="hover:bg-slate-50 text-slate-705 font-medium">
                          <td class="p-2.5 pl-4 text-slate-400 font-bold">#{advIdx + 1}</td>
                          <td class="p-2.5 font-mono text-slate-500">{adv.date}</td>
                          <td class="p-2.5 text-blue-650 font-bold">{accountDisplay}</td>
                          <td class="p-2.5 text-right font-mono font-bold">₹{adv.amount.toLocaleString()}</td>
                          <td class="p-2.5 pl-6">
                            {adv.receivedByDriverDirectly ? (
                              <span class="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-bold font-sans">
                                Received Directly by Driver (Party Payment)
                              </span>
                            ) : (
                              <span class="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 text-[10px] px-2 py-0.5 rounded-full font-bold font-sans">
                                Issued from Office
                              </span>
                            )}
                          </td>
                          <td class="p-2.5 pl-6 text-slate-500 font-semibold">{adv.notes || <span class="text-slate-300">&mdash;</span>}</td>
                          <td class="p-2.5 text-right pr-4">
                            <button
                              type="button"
                              onClick={() => handleRemoveAdvance(adv.id)}
                              class="text-rose-600 hover:text-rose-800 hover:underline font-bold text-[11px]"
                            >
                              Discard
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
                No driver advances() recorded for this trip yet. Use the issuer widget below to log trip operational advances().
              </p>
            )}

            {/* Advance Registrator Form */}
            <div class="bg-slate-50 rounded-xl border border-slate-200 border-dashed p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end shadow-3xs font-sans">
              <div>
                <label class="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">Advance Date</label>
                <input
                  ref={advanceDateInputRef}
                  type="date"
                  value={newAdvDate()}
                  onChange={(e) => setNewAdvDate(e.target.value)}
                  class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono"
                />
              </div>

              <div>
                <label class="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">From Account / Source</label>
                <select
                  value={newAdvFromAccount()}
                  onChange={(e) => setNewAdvFromAccount(e.target.value)}
                  class="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold"
                >
                  <option value="">-- Choose Account --</option>
                  <option value="Cash">Cash</option>
                  {orgProfile()?.fuelCards && orgProfile()?.fuelCards?.filter(c => c.status === 'Active' || c.id === newAdvFromAccount()).map(c => (
                    <option  value={c.id}>{c.cardName} (Fuel Card)</option>
                  ))}
                  {activeAccounts().map(ac => (
                    <option  value={ac.id}>{ac.accountName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label class="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">Advance Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={newAdvAmount()}
                  onChange={(e) => setNewAdvAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  placeholder="₹0.00"
                  class="w-full bg-white border border-slate-250 text-slate-855 rounded-lg px-2 py-1.5 text-xs text-right font-mono font-bold"
                />
              </div>

              <div>
                <label class="block text-[9px] text-slate-555 font-extrabold uppercase mb-1">Advance Notes / Memo</label>
                <input
                  type="text"
                  placeholder="e.g. For food/toll/misc"
                  value={newAdvNotes()}
                  onChange={(e) => setNewAdvNotes(e.target.value)}
                  class="w-full bg-white border border-slate-250 text-slate-855 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>

              <div class="flex flex-col gap-2 pb-1.5 pt-1.5">
                <button
                  type="button"
                  onClick={handleAddAdvance}
                  class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shrink-0 cursor-pointer shadow-3xs h-8 w-full block"
                >
                  + Issue Advance
                </button>
              </div>
            </div>
          </div>

          {/* OVERLAND COMMON TRIP EXPENDITURES BLOCK */}
          <div class="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-4 shadow-3xs border-blue-200 mt-4 font-sans text-xs">
            <span class="text-[10px] font-bold text-blue-700 uppercase tracking-widest block border-b border-blue-105 pb-1.5 flex items-center gap-1.5 font-sans">
              <Fuel class="w-3.5 h-3.5 text-blue-600" />
              Trip Overland Common Expenses (Diesel Fuel, RTO Permits, AdBlue, Fastag Tolls, Misc)
            </span>

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

              {/* Fuels list summary table */}
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
                          <tr  class="hover:bg-amber-50/20">
                            <td class="p-2 pl-3 font-mono text-[10px]">
                              {(() => {
                                if (!f.date) return '—';
                                const parts = f.date.split('-');
                                return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : f.date;
                              })()}
                            </td>
                            <td class="p-2 font-mono">{f.liters} L</td>
                            <td class="p-2 font-mono">₹{f.rate}</td>
                            <td class="p-2 font-mono text-amber-900">₹{f.amount.toLocaleString()}</td>
                            <td class="p-2 font-sans font-bold">{f.shopName || '—'}</td>
                            <td class="p-2 font-mono text-[10px] text-indigo-700">{acctName}</td>
                            <td class="p-2 text-right pr-3">
                              <button
                                type="button"
                                onClick={() => handleRemoveFuel(f.id)}
                                class="text-rose-600 hover:text-rose-800 text-[10px] active:scale-95 transition font-bold cursor-pointer"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Inline fuels() Quick Builder tool */}
              <div class="grid grid-cols-2 md:grid-cols-7 gap-2 bg-white/70 rounded-lg p-2 border border-amber-200/50">
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 mb-1">Fuel Date</label>
                  <input
                    ref={fuelDateInputRef}
                    type="date"
                    value={newFuelDate()}
                    onChange={(e) => setNewFuelDate(e.target.value)}
                    class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label for="input-new-fuel-liters" class="block text-[9px] font-bold text-slate-500 mb-1">Liters</label>
                  <input
                    id="input-new-fuel-liters"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={newFuelLiters()}
                    onChange={(e) => handleLitersChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    class="w-full bg-white border border-slate-200 rounded px-2 py-1 font-mono text-xs focus:outline-none text-right"
                  />
                </div>
                <div>
                  <label for="input-new-fuel-rate" class="block text-[9px] font-bold text-slate-500 mb-1">Rate / Lit</label>
                  <input
                    id="input-new-fuel-rate"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={newFuelRate()}
                    onChange={(e) => handleRateChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    class="w-full bg-white border border-slate-200 rounded px-2 py-1 font-mono text-xs focus:outline-none text-right"
                  />
                </div>
                <div>
                  <label for="input-new-fuel-amount" class="block text-[9px] font-bold text-slate-500 mb-1">Total Amount (₹)</label>
                  <input
                    id="input-new-fuel-amount"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={newFuelAmount()}
                    onChange={(e) => handleAmountChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    class="w-full bg-white border border-slate-200 rounded px-2 py-1 font-mono text-xs focus:outline-none text-right"
                  />
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 mb-1">Fuel Station Shop</label>
                  <input
                    type="text"
                    placeholder="e.g. TVS / SF Bunk"
                    value={newFuelShop()}
                    onChange={(e) => setNewFuelShop(e.target.value)}
                    class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 mb-1">Account Mode</label>
                  <select
                    value={newFuelPaymentMode()}
                    onChange={(e) => setNewFuelPaymentMode(e.target.value)}
                    class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none font-semibold text-slate-705"
                  >
                    <option value="">Cash/General Mode</option>
                    <option value="driver">Paid by Driver (from Advance)</option>
                    {activeAccounts().map(a => (
                      <option  value={a.id}>{a.accountName}</option>
                    ))}
                    {orgProfile()?.fuelCards && orgProfile()?.fuelCards?.filter(c => c.status === 'Active' || c.id === newFuelPaymentMode()).map(c => (
                      <option  value={c.id}>{c.cardName} (Fuel Card)</option>
                    ))}
                  </select>
                </div>
                <div class="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={handleAddFuel}
                    class="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] py-1.5 rounded uppercase cursor-pointer transition active:scale-95"
                  >
                    + Add Fuel
                  </button>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start pt-2">
              {/* RTO Expense */}
              <div>
                <label class="block text-[10px] text-slate-550 font-bold uppercase mb-1 flex items-center gap-1">₹ RTO Permits Expense</label>
                <input
                  id="input-common-rtoExpense()"
                  type="number"
                  min="0"
                  value={rtoExpense() || ''}
                  onChange={(e) => setRtoExpense(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  class="w-full bg-white border border-slate-205 text-slate-805 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono"
                />
                <label class="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rtoPaidByDriver()}
                    onChange={(e) => setRtoPaidByDriver(e.target.checked)}
                    class="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3 w-3 shadow-2xs"
                  />
                  <span class="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                </label>
              </div>

              {/* AdBlue Cost */}
              <div>
                <label class="block text-[10px] text-slate-550 font-bold uppercase mb-1">₹ AdBlue Cost</label>
                <input
                  id="input-common-addBlueExpense()"
                  type="number"
                  min="0"
                  value={addBlueExpense() || ''}
                  onChange={(e) => setAddBlueExpense(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  class="w-full bg-white border border-slate-205 text-slate-805 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono"
                />
                <label class="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={addBluePaidByDriver()}
                    onChange={(e) => setAddBluePaidByDriver(e.target.checked)}
                    class="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3 w-3 shadow-2xs"
                  />
                  <span class="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                </label>
              </div>

              {/* Fastag tolls */}
              <div>
                <label class="block text-[10px] text-slate-550 font-bold uppercase mb-1">₹ Fastag Toll Charges</label>
                <input
                  id="input-common-fastagExpense()"
                  type="number"
                  min="0"
                  value={fastagExpense() || ''}
                  onChange={(e) => setFastagExpense(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  class="w-full bg-white border border-slate-205 text-slate-805 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono"
                />
                <label class="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fastagPaidByDriver()}
                    onChange={(e) => setFastagPaidByDriver(e.target.checked)}
                    class="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3 w-3 shadow-2xs"
                  />
                  <span class="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                </label>
              </div>

              {/* Other/Misc Overland */}
              <div>
                <label class="block text-[10px] text-slate-550 font-bold uppercase mb-1">₹ Miscellaneous Other</label>
                <input
                  id="input-common-otherExpense()"
                  type="number"
                  min="0"
                  value={otherExpense() || ''}
                  onChange={(e) => setOtherExpense(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  class="w-full bg-white border border-slate-205 text-slate-805 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono"
                />
                <label class="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={otherPaidByDriver()}
                    onChange={(e) => setOtherPaidByDriver(e.target.checked)}
                    class="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3 w-3 shadow-2xs"
                  />
                  <span class="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                </label>
              </div>
            </div>
          </div>

          {/* DYNAMIC CALCULATOR FEEDBACK CONTAINER */}
          <div class="bg-slate-900 border border-slate-950 rounded-2xl p-5 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 font-sans shadow-sm">
            <div class="flex items-center gap-3">
              <div class="p-3 bg-slate-804 bg-slate-800 rounded-xl text-blue-400">
                <Calculator class="w-6 h-6" />
              </div>
              <div class="space-y-1.5">
                <span class="text-[10px] text-slate-400 uppercase font-bold tracking-widest font-sans">Accumulated Journey Financial Ledger</span>
                <div class="flex flex-wrap gap-x-3.5 text-xs text-slate-300">
                  <span>Gross Billings: <strong class="text-white font-mono">₹{metrics.income.toLocaleString()}</strong></span>
                  <span>&bull;</span>
                  <span>Expenses Outflow: <strong class="text-red-300 font-mono">₹{metrics.totalExpense.toLocaleString()}</strong></span>
                  <span>&bull;</span>
                  <span>Driver Wages: <strong class="text-amber-200 font-mono">₹{metrics.driverWages.toLocaleString()}</strong></span>
                  <span>&bull;</span>
                  <span>Advances Received: <strong class="text-emerald-400 font-mono">₹{metrics.paymentsReceived.toLocaleString()}</strong></span>
                </div>
                <div class="text-[11px] text-slate-400 flex flex-wrap gap-x-3.5">
                  <span>Total Expense by Driver: <strong class="text-amber-300 font-mono">₹{totalDriverSpend.toLocaleString()}</strong></span>
                  <span>&bull;</span>
                  <span>Total Driver Advance: <strong class="text-emerald-400 font-mono">₹{totalIssuedToDriver.toLocaleString()}</strong></span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <div class="text-right flex flex-col items-end gap-1">
                <span class="text-[10px] text-slate-300 uppercase tracking-wider block font-medium flex items-center gap-1 justify-end">
                  Driver Balance
                  <span class={`h-1.5 w-1.5 rounded-full inline-block ${driverBalance >= 0 ? "bg-purple-400" : "bg-rose-500"}`} />
                </span>
                <span class={`text-[15px] font-black font-mono block leading-none mt-1 ${driverBalance >= 0 ? "text-purple-300" : "text-amber-300"}`} title={driverBalance >= 0 ? "Payable to Driver" : "Due from Driver"}>
                  ₹{driverBalance.toLocaleString("en-IN")}
                </span>
                <span class="text-[9px] font-sans font-normal block">{driverBalance >= 0 ? "Payable" : "Due from Drv"}</span>
                {driverBalance !== 0 && (
                  <button
                    type="button"
                    onClick={() => setShowQuickFwdPanel(!showQuickFwdPanel())}
                    class="text-[9px] font-extrabold uppercase bg-slate-800 text-purple-300 hover:bg-slate-700 hover:text-white px-2 py-1 rounded border border-slate-700 transition cursor-pointer mt-1"
                  >
                    {showQuickFwdPanel() ? "Close Transfer" : "Quick Transfer"}
                  </button>
                )}
              </div>
              <div class="w-[1.5px] bg-slate-700 h-10 select-none"></div>
              <div class="text-right">
                <span class="text-[10px] text-slate-400 uppercase tracking-wider block">Net Revenue Margin</span>
                <span class={`text-base font-black font-mono block leading-none mt-1 ${metrics.profit >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400'}`}>
                  ₹{metrics.profit.toLocaleString()}
                </span>
              </div>
              <div class="w-[1.5px] bg-slate-700 h-10 select-none"></div>
              <div class="text-right">
                <span class="text-[10px] text-slate-303 text-slate-300 uppercase tracking-wider block font-medium">Billed outstanding</span>
                <span class={`text-lg font-mono font-black block leading-none mt-1 ${metrics.outstandingBalance > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}`}>
                  ₹{metrics.outstandingBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {showQuickFwdPanel() && driverBalance !== 0 && (() => {
            const allTrips = Array.isArray(trips()) ? trips() : [];
            const finalTripNo = editingEntry() ? tripNo() : (tripNoOption() === 'AUTO' ? tripNo() : selectedExistingTripNo());
            const eligibleFwdTrips = allTrips.filter(
              t => (!editingEntry() || t.id !== editingEntry()?.id) && t.status !== 'Settled'
            ).sort((a, b) => {
              const aSame = a.driverName?.toLowerCase().trim() === driverName()?.toLowerCase().trim();
              const bSame = b.driverName?.toLowerCase().trim() === driverName()?.toLowerCase().trim();
              if (aSame && !bSame) return -1;
              if (!aSame && bSame) return 1;
              return a.tripNo.localeCompare(b.tripNo);
            });

            return (
              <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5 text-xs font-sans text-slate-800">
                <div class="flex border-b border-slate-200 pb-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedFwdMode('trip')}
                    class={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${
                      selectedFwdMode() === 'trip'
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Move to Another Trip
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFwdMode('account')}
                    class={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${
                      selectedFwdMode() === 'account'
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Settle with Company Account
                  </button>
                </div>

                {selectedFwdMode() === 'trip' ? (
                  <div class="space-y-3">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-amber-805 text-amber-800 font-extrabold uppercase text-[9px] tracking-wider block">
                        {driverBalance < 0 ? 'Carry Forward Driver Deficit' : 'Carry Forward Driver Surplus'}
                      </span>
                      <span class="text-slate-600 font-sans block mt-0.5">
                        Move this {driverBalance < 0 ? 'negative' : 'positive'} balance of <strong class="text-slate-850 font-mono">₹{Math.abs(driverBalance).toLocaleString('en-IN')}</strong> to another active trip.
                      </span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div class="flex flex-col gap-0.5 font-sans">
                        <span class="text-[8px] text-slate-400 font-bold uppercase">Tx Date</span>
                        <input
                          type="date"
                          value={selectedFwdDate()}
                          onChange={(e) => setSelectedFwdDate(e.target.value)}
                          class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-blue-500 font-sans font-medium w-full"
                        />
                      </div>
                      <div class="flex flex-col gap-0.5 sm:col-span-2">
                        <span class="text-[8px] text-slate-400 font-bold uppercase">Target Trip</span>
                        <select
                          value={selectedFwdTripId()}
                          onChange={(e) => setSelectedFwdTripId(e.target.value)}
                          class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-blue-500 font-sans font-medium w-full font-semibold"
                        >
                          <option value="">-- Select Next Trip --</option>
                          {eligibleFwdTrips.map(t => {
                            const isSameDrv = t.driverName?.toLowerCase().trim() === driverName()?.toLowerCase().trim();
                            return (
                              <option  value={t.id}>
                                {t.tripNo} - {t.driverName || 'No Driver'} ({t.truckNo}){isSameDrv ? ' (Same Driver)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div class="flex flex-col gap-0.5 font-sans">
                        <span class="text-[8px] text-slate-400 font-bold uppercase">Move Amount (₹)</span>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={selectedFwdAmount()}
                          onChange={(e) => setSelectedFwdAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          placeholder="₹0.00"
                          class="bg-white border border-slate-205 rounded-lg px-2.5 py-1.5 text-xs text-slate-805 text-right font-mono font-bold focus:outline-none focus:border-blue-500 w-full"
                        />
                      </div>
                    </div>

                    <div class="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedFwdTripId()) {
                            alert("Please select a target trip first.");
                            return;
                          }
                          const destTrip = eligibleFwdTrips.find(t => t.id === selectedFwdTripId());
                          if (!destTrip) return;

                          const amtToMove = Number(selectedFwdAmount()) || 0;
                          if (amtToMove <= 0) {
                            alert("Please enter a valid amount to move greater than 0.");
                            return;
                          }

                          const confirmMsg = driverBalance < 0
                            ? `Are you sure you want to carry forward the driver deficit of ₹${amtToMove.toLocaleString('en-IN')} from this trip to ${destTrip.tripNo}?\n\nThis will add a negative advance on this trip to reduce its driver balance, and add a positive advance on ${destTrip.tripNo}.`
                            : `Are you sure you want to carry forward the driver surplus of ₹${amtToMove.toLocaleString('en-IN')} from this trip to ${destTrip.tripNo}?\n\nThis will add a positive advance on this trip to reduce its driver balance, and add a negative advance on ${destTrip.tripNo}.`;

                          const performFwd = () => {
                            const fwdAdvanceSource: TripAdvance = {
                              id: 'fwd_out_' + Date.now(),
                              amount: driverBalance < 0 ? -amtToMove : amtToMove,
                              date: selectedFwdDate() || new Date().toISOString().substring(0, 10),
                              fromAccountId: 'Direct Driver',
                              notes: driverBalance < 0
                                ? `Negative balance carried forward to ${destTrip.tripNo}`
                                : `Excess amount/surplus carried forward to ${destTrip.tripNo}`,
                              receivedByDriverDirectly: true
                            };

                            const fwdAdvanceDest: TripAdvance = {
                              id: 'fwd_in_' + Date.now(),
                              amount: driverBalance < 0 ? amtToMove : -amtToMove,
                              date: selectedFwdDate() || new Date().toISOString().substring(0, 10),
                              fromAccountId: 'Direct Driver',
                              notes: driverBalance < 0
                                ? `Negative balance carried forward from ${finalTripNo}`
                                : `Excess amount/surplus carried forward from ${finalTripNo}`,
                              receivedByDriverDirectly: true
                            };

                            // Add source side locally to current form state
                            setAdvances([...advances(), fwdAdvanceSource]);

                            // Add dest side globally in the trips list
                            if (onSaveTrips && trips) {
                              const updatedDest = {
                                ...destTrip,
                                advances: [...(destTrip.advances || []), fwdAdvanceDest],
                                syncState: 'pending' as const,
                                updatedAt: new Date().toISOString()
                              };
                              const updatedTrips = trips().map(t => t.id === updatedDest.id ? updatedDest : t);
                              onSaveTrips(updatedTrips);
                            }

                            // Keep the panel open if we didn't move the full balance
                            const remaining = Math.max(0, Math.abs(driverBalance) - amtToMove);
                            if (remaining === 0) {
                              setShowQuickFwdPanel(false);
                            }
                            setSelectedFwdTripId('');
                            alert(`Successfully moved ₹${amtToMove.toLocaleString('en-IN')} to ${destTrip.tripNo}. Please save this trip form to apply changes.`);
                          };

                          if (confirmAction) {
                            confirmAction(confirmMsg, performFwd, "Carry Forward Balance");
                          } else if (confirm(confirmMsg)) {
                            performFwd();
                          }
                        }}
                        class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-xs shrink-0 cursor-pointer"
                      >
                        Move Funds
                      </button>
                    </div>
                  </div>
                ) : (
                  <div class="space-y-3">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-emerald-805 text-emerald-800 font-extrabold uppercase text-[9px] tracking-wider block">
                        {driverBalance < 0 ? 'Settle Deficit to Company Account' : 'Pay Driver Surplus from Company Account'}
                      </span>
                      <span class="text-slate-600 font-sans block mt-0.5">
                        {driverBalance < 0 ? (
                          <span>Receive driver returned funds of <strong class="text-slate-850 font-mono">₹{Math.abs(driverBalance).toLocaleString('en-IN')}</strong> into a company account.</span>
                        ) : (
                          <span>Pay driver out-of-pocket surplus of <strong class="text-slate-850 font-mono">₹{Math.abs(driverBalance).toLocaleString('en-IN')}</strong> from a company account.</span>
                        )}
                      </span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div class="flex flex-col gap-0.5 font-sans">
                        <span class="text-[8px] text-slate-400 font-bold uppercase">Tx Date</span>
                        <input
                          type="date"
                          value={selectedFwdDate()}
                          onChange={(e) => setSelectedFwdDate(e.target.value)}
                          class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-blue-500 font-sans font-medium w-full"
                        />
                      </div>
                      <div class="flex flex-col gap-0.5 sm:col-span-2">
                        <span class="text-[8px] text-slate-400 font-bold uppercase">Company Account</span>
                        <select
                          value={selectedFwdAccountId()}
                          onChange={(e) => setSelectedFwdAccountId(e.target.value)}
                          class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-blue-500 font-sans font-medium w-full font-semibold"
                        >
                          <option value="">-- Select Company Account --</option>
                          <option value="Cash">Cash</option>
                          {accounts().filter(a => a.status === 'Active').map(a => (
                            <option  value={a.id}>
                              {a.accountName} ({a.type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div class="flex flex-col gap-0.5 font-sans">
                        <span class="text-[8px] text-slate-400 font-bold uppercase">Settle Amount (₹)</span>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={selectedFwdAmount()}
                          onChange={(e) => setSelectedFwdAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          placeholder="₹0.00"
                          class="bg-white border border-slate-205 rounded-lg px-2.5 py-1.5 text-xs text-slate-805 text-right font-mono font-bold focus:outline-none focus:border-blue-500 w-full"
                        />
                      </div>
                    </div>

                    <div class="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedFwdAccountId()) {
                            alert("Please select a target company account first.");
                            return;
                          }
                          const amtToSettle = Number(selectedFwdAmount()) || 0;
                          if (amtToSettle <= 0) {
                            alert("Please enter a valid settle amount greater than 0.");
                            return;
                          }
                          const targetAccount = accounts().find(a => a.id === selectedFwdAccountId());
                          const accountName = targetAccount ? targetAccount.accountName : selectedFwdAccountId();

                          const confirmMsg = driverBalance < 0
                            ? `Are you sure you want to move the driver deficit of ₹${amtToSettle.toLocaleString('en-IN')} from this trip to company account "${accountName}"?\n\nThis will record a negative advance on this trip to reduce the driver's balance.`
                            : `Are you sure you want to pay the driver surplus of ₹${amtToSettle.toLocaleString('en-IN')} from company account "${accountName}" for this trip?\n\nThis will record a positive advance on this trip to reduce the driver's balance.`;

                          const performAccountSettle = () => {
                            const settleAdvance: TripAdvance = {
                              id: 'fwd_settle_' + Date.now(),
                              amount: driverBalance < 0 ? -amtToSettle : amtToSettle,
                              date: selectedFwdDate() || new Date().toISOString().substring(0, 10),
                              fromAccountId: selectedFwdAccountId(),
                              notes: driverBalance < 0
                                ? `Negative balance moved/returned to company account: ${accountName}`
                                : `Positive balance paid to driver from company account: ${accountName}`,
                              receivedByDriverDirectly: false
                            };

                            // Add locally to advances() list in the current form
                            setAdvances([...advances(), settleAdvance]);
                            
                            // If we didn't settle the full balance, keep the fwd panel open
                            const remaining = Math.max(0, Math.abs(driverBalance) - amtToSettle);
                            if (remaining === 0) {
                              setShowQuickFwdPanel(false);
                            }
                            setSelectedFwdAccountId('');
                            alert(`Successfully settled ₹${amtToSettle.toLocaleString('en-IN')} with account: ${accountName}. Please save this trip form to apply changes.`);
                          };

                          if (confirmAction) {
                            confirmAction(confirmMsg, performAccountSettle, driverBalance < 0 ? "Settle Deficit" : "Pay Driver");
                          } else if (confirm(confirmMsg)) {
                            performAccountSettle();
                          }
                        }}
                        class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-xs shrink-0 cursor-pointer"
                      >
                        Confirm Settle
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* GENERAL TRANSPORT REMARKS */}
          <div class="font-sans">
            <label class="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">General Transport Journey Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Full standard journey including interstate road permit, customs checkpoints, and multiple coal depot offloads."
              value={notes()}
              onChange={(e) => setNotes(e.target.value)}
              class="w-full bg-slate-50 border border-slate-205 text-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white placeholder:text-slate-400"
            />
          </div>

        </div>

        {/* BOTTOM PANEL CONTROLS */}
        <div class="px-6 py-4 bg-slate-50 border-t border-slate-240 flex justify-end gap-3 shrink-0 h-16 items-center">
          <button
            type="button"
            onClick={onClose}
            class="px-5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Cancel Journal
          </button>
          <button
            type="button"
            onClick={handleSubmitMasterForm}
            class="bg-blue-600 hover:bg-blue-700 border border-blue-550 text-white font-bold text-xs px-6 py-2.5 rounded-lg shadow-md hover:scale-[1.01] transition duration-200 cursor-pointer bg-blue-605 h-10"
          >
            {editingEntry() ? 'Update Fleet Record' : 'Publish Fleet Record'}
          </button>
        </div>

      </div>
    </div>
    </Show>
  );
}
