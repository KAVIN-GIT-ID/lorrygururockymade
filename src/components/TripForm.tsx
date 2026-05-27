import React, { useState, useEffect } from 'react';
import { TripEntry, TripPayment, SubTrip, Truck, Office, Account, Driver, FuelEntry, TripStatus, getTripMetrics, calculateBalance, TripAdvance } from '../types';
import { indianCities } from './indianCities';
import { 
  X, Calculator, Calendar, Landmark, Coins, Plus, Trash2, Edit2, 
  Fuel, Gauge, MapPin, BadgeCent, ListCollapse, HelpCircle 
} from 'lucide-react';

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
}

export default function TripForm({
  isOpen,
  onClose,
  trucks,
  offices,
  accounts,
  drivers,
  existingTripNos,
  onSubmit,
  editingEntry,
  canViewDrivers = true
}: TripFormProps) {
  // Trip group keying
  const [tripNoOption, setTripNoOption] = useState<'AUTO' | 'EXISTING'>('AUTO');
  
  // Master Trip Form states
  const [tripNo, setTripNo] = useState('');
  const [selectedExistingTripNo, setSelectedExistingTripNo] = useState('');
  const [truckNo, setTruckNo] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [driverName, setDriverName] = useState('');
  const [startingKM, setStartingKM] = useState<number>(0);
  const [endingKM, setEndingKM] = useState<number>(0);
  const [status, setStatus] = useState<TripStatus>('Pending');
  const [notes, setNotes] = useState('');

  // Master Trip Common Expenses
  const [rtoExpense, setRtoExpense] = useState<number>(0);
  const [dieselLiters, setDieselLiters] = useState<number>(0);
  const [dieselRate, setDieselRate] = useState<number>(0);
  const [dieselAmount, setDieselAmount] = useState<number>(0);
  const [addBlueExpense, setAddBlueExpense] = useState<number>(0);
  const [fastagExpense, setFastagExpense] = useState<number>(0);
  const [otherExpense, setOtherExpense] = useState<number>(0);

  // Paid by driver flags
  const [rtoPaidByDriver, setRtoPaidByDriver] = useState<boolean>(false);
  const [addBluePaidByDriver, setAddBluePaidByDriver] = useState<boolean>(false);
  const [fastagPaidByDriver, setFastagPaidByDriver] = useState<boolean>(false);
  const [otherPaidByDriver, setOtherPaidByDriver] = useState<boolean>(false);

  // Child lists
  const [subTrips, setSubTrips] = useState<SubTrip[]>([]);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [fuels, setFuels] = useState<FuelEntry[]>([]);
  const [advances, setAdvances] = useState<TripAdvance[]>([]);

  // Draft states for dynamic fuel entry
  const [newFuelDate, setNewFuelDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [newFuelLiters, setNewFuelLiters] = useState<number | ''>('');
  const [newFuelRate, setNewFuelRate] = useState<number | ''>('');
  const [newFuelShop, setNewFuelShop] = useState('');
  const [newFuelPaymentMode, setNewFuelPaymentMode] = useState('');

  // Draft states for Sub-Trip Segment builder
  const [showSubTripForm, setShowSubTripForm] = useState(false);
  const [editingSubTripId, setEditingSubTripId] = useState<string | null>(null);

  const [stLoadingDate, setStLoadingDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [stOfficeName, setStOfficeName] = useState('');
  const [stRouteFrom, setStRouteFrom] = useState('');
  const [stRouteTo, setStRouteTo] = useState('');
  const [stIncome, setStIncome] = useState<number>(0);
  const [stLoadingExpense, setStLoadingExpense] = useState<number>(0);
  const [stUnloadingExpense, setStUnloadingExpense] = useState<number>(0);
  const [stLoadingPaidByDriver, setStLoadingPaidByDriver] = useState<boolean>(true);
  const [stUnloadingPaidByDriver, setStUnloadingPaidByDriver] = useState<boolean>(true);
  const [stBrokerageExpense, setStBrokerageExpense] = useState<number>(0);
  const [stBrokeragePaidByDriver, setStBrokeragePaidByDriver] = useState<boolean>(true);
  const [stDriverWages, setStDriverWages] = useState<number>(0);
  const [stStartingKM, setStStartingKM] = useState<number>(0);
  const [stEndingKM, setStEndingKM] = useState<number>(0);
  const [stNotes, setStNotes] = useState('');
  const [stWagePct, setStWagePct] = useState<string>('');
  const [originalSubTripSnapshot, setOriginalSubTripSnapshot] = useState<any>(null);

  // Draft states for payment ledger receipts list
  const [newPayAmount, setNewPayAmount] = useState<number | ''>('');
  const [newPayDate, setNewPayDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [newPayReceivedBy, setNewPayReceivedBy] = useState('');
  const [newPayNotes, setNewPayNotes] = useState('');
  const [newPaySubTripId, setNewPaySubTripId] = useState<string>('general');

  // Draft states for advances list
  const [newAdvAmount, setNewAdvAmount] = useState<number | ''>('');
  const [newAdvDate, setNewAdvDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [newAdvFromAccount, setNewAdvFromAccount] = useState('');
  const [newAdvNotes, setNewAdvNotes] = useState('');
  const [newAdvReceivedByDriverDirectly, setNewAdvReceivedByDriverDirectly] = useState(false);

  // Auto-fill active lists
  const todayStr = new Date().toISOString().substring(0, 10);
  const activeTrucks = trucks;
  const activeOffices = offices.filter(o => o.status === 'Active');
  const activeAccounts = accounts.filter(a => a.status === 'Active');
  const activeDrivers = drivers.filter(d => d.status === 'Active');

  // Year prefix sequence for Auto trip identifiers
  useEffect(() => {
    if (!editingEntry && isOpen) {
      const currentYear = new Date().getFullYear();
      let lastSeq = 0;
      
      existingTripNos.forEach(v => {
        const match = v.match(/TRIP-(\d+)-(\d+)/);
        if (match && parseInt(match[1]) === currentYear) {
          const seq = parseInt(match[2]);
          if (seq > lastSeq) lastSeq = seq;
        }
      });
      
      const newSeq = String(lastSeq + 1).padStart(4, '0');
      const generated = `TRIP-${currentYear}-${newSeq}`;
      setTripNo(generated);
      setSelectedExistingTripNo(existingTripNos[0] || '');
    }
  }, [isOpen, editingEntry, existingTripNos]);

  // Fill default values or edit details
  useEffect(() => {
    if (editingEntry && isOpen) {
      setTripNoOption('AUTO');
      setTripNo(editingEntry.tripNo);
      setTruckNo(editingEntry.truckNo);
      setStartDate(editingEntry.startDate || new Date().toISOString().substring(0, 10));
      setEndDate(editingEntry.endDate || new Date().toISOString().substring(0, 10));
      setDriverName(editingEntry.driverName || '');
      setStartingKM(editingEntry.startingKM || 0);
      setEndingKM(editingEntry.endingKM || 0);
      setStatus(editingEntry.status);
      setNotes(editingEntry.notes || '');
      setSubTrips(editingEntry.subTrips || []);
      setPayments(editingEntry.payments || []);
      setAdvances(editingEntry.advances || []);

      // Load master common expenses
      setRtoExpense(editingEntry.rtoExpense || 0);
      setDieselLiters(editingEntry.dieselLiters || 0);
      setDieselRate(editingEntry.dieselRate || 0);
      setDieselAmount(editingEntry.dieselAmount || 0);
      setAddBlueExpense(editingEntry.addBlueExpense || 0);
      setFastagExpense(editingEntry.fastagExpense || 0);
      setOtherExpense(editingEntry.otherExpense || 0);

      setRtoPaidByDriver(editingEntry.rtoPaidByDriver || false);
      setAddBluePaidByDriver(editingEntry.addBluePaidByDriver || false);
      setFastagPaidByDriver(editingEntry.fastagPaidByDriver || false);
      setOtherPaidByDriver(editingEntry.otherPaidByDriver || false);

      if (editingEntry.fuels && editingEntry.fuels.length > 0) {
        setFuels(editingEntry.fuels);
      } else if (editingEntry.dieselAmount && editingEntry.dieselAmount > 0) {
        setFuels([{
          id: 'fuel-legacy-' + Date.now(),
          date: editingEntry.startDate || new Date().toISOString().substring(0, 10),
          liters: editingEntry.dieselLiters || 0,
          rate: editingEntry.dieselRate || 0,
          amount: editingEntry.dieselAmount,
          shopName: 'Legacy Fuel Station',
          paymentMode: ''
        }]);
      } else {
        setFuels([]);
      }

      setShowSubTripForm(false);
      setEditingSubTripId(null);
    } else if (isOpen) {
      // Create resetting defaults
      const firstTruck = activeTrucks[0];
      setTruckNo(firstTruck?.truckNo || '');
      
      // Choose first active driver as default
      setDriverName(activeDrivers[0]?.driverName || '');

      setStartDate(new Date().toISOString().substring(0, 10));
      setEndDate(new Date().toISOString().substring(0, 10));
      setStartingKM(0);
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
  }, [editingEntry, isOpen]);
  // NOTE: trucks/drivers/offices/accounts are intentionally NOT in the dep array.
  // Dropdown options are read directly from props (live) so they always show the
  // latest data without needing to be in deps. Including them caused the form to
  // reset mid-fill whenever a realtime update arrived for master records.

  // Sync payments ledger default account on loading
  useEffect(() => {
    if (!newPayReceivedBy && activeAccounts.length > 0) {
      setNewPayReceivedBy(activeAccounts[0].id);
    }
    if (!newAdvFromAccount && activeAccounts.length > 0) {
      setNewAdvFromAccount(activeAccounts[0].id);
    }
  }, [activeAccounts, newPayReceivedBy, newAdvFromAccount]);

  // Auto-calculate diesel amount dynamically
  useEffect(() => {
    setDieselAmount(Math.max(0, Number(dieselLiters) * Number(dieselRate)));
  }, [dieselLiters, dieselRate]);

  const handleAddFuel = () => {
    const lts = Number(newFuelLiters) || 0;
    const rt = Number(newFuelRate) || 0;
    if (lts <= 0 || rt <= 0) {
      alert("Please enter valid Fuel Liters and Rate.");
      return;
    }
    const amt = Math.round(lts * rt);
    const f: FuelEntry = {
      id: 'fuel-' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      date: newFuelDate,
      liters: lts,
      rate: rt,
      amount: amt,
      shopName: newFuelShop.trim() || undefined,
      paymentMode: newFuelPaymentMode || undefined
    };
    setFuels([...fuels, f]);
    
    // Reset inputs
    setNewFuelLiters('');
    setNewFuelRate('');
    setNewFuelShop('');
  };

  const handleRemoveFuel = (fId: string) => {
    setFuels(fuels.filter(f => f.id !== fId));
  };

  // Compute live aggregates of drafted values
  const draftTripMetrics = () => {
    // Generate temporary TripEntry mapping for metrics math
    const tempTrip: TripEntry = {
      id: 'temp',
      tripNo: tripNoOption === 'AUTO' ? tripNo : selectedExistingTripNo,
      truckNo,
      startDate,
      endDate,
      driverName,
      startingKM,
      endingKM,
      subTrips,
      payments,
      fuels, // N fuels support
      status,
      notes,
      rtoExpense,
      dieselLiters,
      dieselRate,
      dieselAmount,
      addBlueExpense,
      fastagExpense,
      otherExpense
    };
    return getTripMetrics(tempTrip);
  };

  const metrics = draftTripMetrics();

  // Driver spends and balance calculation (Requirement 4)
  const calculateDriverBalance = () => {
    // 1. Fuels paid by driver
    const fuelsDriverSpend = (fuels || []).reduce((sum, f) => {
      if (f.paymentMode === 'driver' || f.paymentMode === 'Driver') {
        return sum + (Number(f.amount) || 0);
      }
      return sum;
    }, 0);

    // 2. Common trip-level expenses paid by driver
    let tripLevelDriverSpend = 0;
    if (rtoPaidByDriver && rtoExpense) {
      tripLevelDriverSpend += Number(rtoExpense) || 0;
    }
    if (addBluePaidByDriver && addBlueExpense) {
      tripLevelDriverSpend += Number(addBlueExpense) || 0;
    }
    if (fastagPaidByDriver && fastagExpense) {
      tripLevelDriverSpend += Number(fastagExpense) || 0;
    }
    if (otherPaidByDriver && otherExpense) {
      tripLevelDriverSpend += Number(otherExpense) || 0;
    }

    // 3. SubTrip specific cargo level loading/unloading, brokerage & driver wages
    const subTripsDriverSpend = (subTrips || []).reduce((sum, st) => {
      let stSum = 0;
      if (st.loadingPaidByDriver !== false && st.loadingExpense) {
        stSum += Number(st.loadingExpense) || 0;
      }
      if (st.unloadingPaidByDriver !== false && st.unloadingExpense) {
        stSum += Number(st.unloadingExpense) || 0;
      }
      if (st.brokeragePaidByDriver !== false && st.brokerageExpense) {
        stSum += Number(st.brokerageExpense) || 0;
      }
      if (st.driverWages) {
        stSum += Number(st.driverWages) || 0;
      }
      return sum + stSum;
    }, 0);

    // Sum driver spends
    const totalDriverSpend = fuelsDriverSpend + tripLevelDriverSpend + subTripsDriverSpend;

    // Driver Advances (Category 4)
    const category4CategoryAdvances = (advances || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

    // Category 3 paid to driver advance
    const category3DriverAdvancePayments = (payments || [])
      .filter(p => p.receivedBy === 'paid_to_driver_advance')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // Total received by driver
    const totalIssuedToDriver = category4CategoryAdvances + category3DriverAdvancePayments;

    return totalDriverSpend - totalIssuedToDriver;
  };

  const driverBalance = calculateDriverBalance();

  // Handle drafting payments
  const handleAddPayment = () => {
    const amt = Number(newPayAmount) || 0;
    if (amt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }
    if (!newPayReceivedBy) {
      alert("Please choose a valid financial account.");
      return;
    }

    const item: TripPayment = {
      id: 'stmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      amount: amt,
      date: newPayDate || new Date().toISOString().substring(0, 10),
      receivedBy: newPayReceivedBy,
      notes: newPayNotes.trim() || undefined,
      subTripId: newPaySubTripId !== 'general' ? newPaySubTripId : undefined
    };

    setPayments(prev => [...prev, item]);
    setNewPayAmount('');
    setNewPayNotes('');
    setNewPaySubTripId('general');
  };

  const handleRemovePayment = (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  // Sub-Trip operations
  const handleOpenNewSubTrip = () => {
    setEditingSubTripId(null);
    setStLoadingDate(startDate || new Date().toISOString().substring(0, 10));
    setStOfficeName(activeOffices[0]?.officeName || '');
    setStRouteFrom('');
    setStRouteTo('');
    setStIncome(0);
    setStLoadingExpense(0);
    setStUnloadingExpense(0);
    setStLoadingPaidByDriver(true);
    setStUnloadingPaidByDriver(true);
    setStBrokerageExpense(0);
    setStBrokeragePaidByDriver(true);
    setStDriverWages(0);
    // Align segment mileage to main odometer reads to reduce user friction
    setStStartingKM(startingKM || 0);
    setStEndingKM(endingKM || 0);
    setStNotes('');
    setStWagePct('');

    const snapshot = {
      loadingDate: startDate || new Date().toISOString().substring(0, 10),
      officeName: activeOffices[0]?.officeName || '',
      routeFrom: '',
      routeTo: '',
      income: 0,
      loadingExpense: 0,
      unloadingExpense: 0,
      loadingPaidByDriver: true,
      unloadingPaidByDriver: true,
      brokerageExpense: 0,
      brokeragePaidByDriver: true,
      driverWages: 0,
      startingKM: startingKM || 0,
      endingKM: endingKM || 0,
      notes: ''
    };
    setOriginalSubTripSnapshot(snapshot);
    setShowSubTripForm(true);
  };

  const handleOpenEditSubTrip = (st: SubTrip) => {
    setEditingSubTripId(st.id);
    setStLoadingDate(st.loadingDate || startDate);
    setStOfficeName(st.officeName || activeOffices[0]?.officeName || '');
    setStRouteFrom(st.routeFrom || '');
    setStRouteTo(st.routeTo || '');
    setStIncome(st.income || 0);
    setStLoadingExpense(st.loadingExpense || 0);
    setStUnloadingExpense(st.unloadingExpense || 0);
    setStLoadingPaidByDriver(st.loadingPaidByDriver !== undefined ? st.loadingPaidByDriver : true);
    setStUnloadingPaidByDriver(st.unloadingPaidByDriver !== undefined ? st.unloadingPaidByDriver : true);
    setStBrokerageExpense(st.brokerageExpense || 0);
    setStBrokeragePaidByDriver(st.brokeragePaidByDriver !== undefined ? st.brokeragePaidByDriver : true);
    setStDriverWages(st.driverWages || 0);
    setStStartingKM(st.startingKM || 0);
    setStEndingKM(st.endingKM || 0);
    setStNotes(st.notes || '');

    const calculatedPct = st.income && st.driverWages ? Math.round((st.driverWages / st.income) * 100).toString() : '';
    setStWagePct(calculatedPct);

    const snapshot = {
      loadingDate: st.loadingDate || startDate,
      officeName: st.officeName || activeOffices[0]?.officeName || '',
      routeFrom: st.routeFrom || '',
      routeTo: st.routeTo || '',
      income: st.income || 0,
      loadingExpense: st.loadingExpense || 0,
      unloadingExpense: st.unloadingExpense || 0,
      loadingPaidByDriver: st.loadingPaidByDriver !== undefined ? st.loadingPaidByDriver : true,
      unloadingPaidByDriver: st.unloadingPaidByDriver !== undefined ? st.unloadingPaidByDriver : true,
      brokerageExpense: st.brokerageExpense || 0,
      brokeragePaidByDriver: st.brokeragePaidByDriver !== undefined ? st.brokeragePaidByDriver : true,
      driverWages: st.driverWages || 0,
      startingKM: st.startingKM || 0,
      endingKM: st.endingKM || 0,
      notes: st.notes || ''
    };
    setOriginalSubTripSnapshot(snapshot);
    setShowSubTripForm(true);
  };

  const checkIfSubTripHasChanges = () => {
    const currentSnapshot = {
      loadingDate: stLoadingDate,
      officeName: stOfficeName,
      routeFrom: stRouteFrom,
      routeTo: stRouteTo,
      income: Number(stIncome) || 0,
      loadingExpense: Number(stLoadingExpense) || 0,
      unloadingExpense: Number(stUnloadingExpense) || 0,
      loadingPaidByDriver: stLoadingPaidByDriver,
      unloadingPaidByDriver: stUnloadingPaidByDriver,
      brokerageExpense: Number(stBrokerageExpense) || 0,
      brokeragePaidByDriver: stBrokeragePaidByDriver,
      driverWages: Number(stDriverWages) || 0,
      startingKM: Number(stStartingKM) || 0,
      endingKM: Number(stEndingKM) || 0,
      notes: stNotes
    };
    return originalSubTripSnapshot && JSON.stringify(originalSubTripSnapshot) !== JSON.stringify(currentSnapshot);
  };

  const handleCancelSubTripSegment = () => {
    setShowSubTripForm(false);
    setEditingSubTripId(null);
  };

  const handleSaveSubTripSegmentConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveSubTripSegment(e);
  };

  const handleSaveSubTripSegment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stOfficeName) {
      alert("Office selection is required.");
      return;
    }
    if (!stRouteFrom || !stRouteTo) {
      alert("Route Origin and Destination are required.");
      return;
    }

    const originalSubTrip = editingSubTripId ? subTrips.find(item => item.id === editingSubTripId) : null;
    const segmentObj: SubTrip = {
      ...(originalSubTrip || {}),
      id: editingSubTripId || 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      loadingDate: stLoadingDate,
      officeName: stOfficeName,
      routeFrom: stRouteFrom.trim(),
      routeTo: stRouteTo.trim(),
      income: Number(stIncome) || 0,
      loadingExpense: Number(stLoadingExpense) || 0,
      unloadingExpense: Number(stUnloadingExpense) || 0,
      brokerageExpense: Number(stBrokerageExpense) || 0,
      driverWages: Number(stDriverWages) || 0,
      loadingPaidByDriver: stLoadingPaidByDriver,
      unloadingPaidByDriver: stUnloadingPaidByDriver,
      brokeragePaidByDriver: stBrokeragePaidByDriver,
      startingKM: Number(stStartingKM) || 0,
      endingKM: Number(stEndingKM) || 0,
      notes: stNotes.trim() || undefined
    };

    if (editingSubTripId) {
      setSubTrips(prev => prev.map(item => item.id === editingSubTripId ? segmentObj : item));
    } else {
      setSubTrips(prev => [...prev, segmentObj]);
      // Increment master ending KM if segment ending KM is higher
      if (segmentObj.endingKM > endingKM) {
        setEndingKM(segmentObj.endingKM);
      }
      if (startingKM === 0 && segmentObj.startingKM > 0) {
        setStartingKM(segmentObj.startingKM);
      }
    }

    setShowSubTripForm(false);
    setEditingSubTripId(null);
  };

  const handleDeleteSubTripSegment = (id: string) => {
    setSubTrips(prev => prev.filter(st => st.id !== id));
  };

  const handleAddAdvance = () => {
    if (!newAdvAmount || Number(newAdvAmount) <= 0 || !newAdvFromAccount) {
      alert("Please enter a valid amount and select a From Account for the driver advance.");
      return;
    }

    const nAdv: TripAdvance = {
      id: 'adv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      amount: Number(newAdvAmount),
      date: newAdvDate,
      fromAccountId: newAdvFromAccount,
      notes: newAdvNotes.trim() || undefined,
      receivedByDriverDirectly: newAdvReceivedByDriverDirectly
    };

    setAdvances(prev => [...prev, nAdv]);

    // Reset draft fields
    setNewAdvAmount('');
    setNewAdvNotes('');
    setNewAdvReceivedByDriverDirectly(false);
  };

  const handleRemoveAdvance = (id: string) => {
    setAdvances(prev => prev.filter(adv => adv.id !== id));
  };

  // Submit complete master ledger report
  const handleSubmitMasterForm = (e: React.FormEvent) => {
    e.preventDefault();

    const finalTripNo = editingEntry 
      ? tripNo 
      : (tripNoOption === 'AUTO' ? tripNo : selectedExistingTripNo);

    if (!finalTripNo || !truckNo || !driverName) {
      alert("Trip Number, operational Truck and Operator Driver Name are required.");
      return;
    }

    const selectedTruck = trucks.find(t => t.truckNo === truckNo);
    const isUnchangedEdit = editingEntry && truckNo === editingEntry.truckNo;
    if (selectedTruck && !isUnchangedEdit) {
      const isExpired = selectedTruck.registrationExpiryDate ? selectedTruck.registrationExpiryDate < todayStr : false;
      const isAdminDisabled = selectedTruck.status === 'Admin Disabled';
      const isNotApproved = selectedTruck.isApproved === false || selectedTruck.requestStatus === 'Rejected';
      if (isExpired || isAdminDisabled || isNotApproved) {
        let reason = "expired";
        if (isAdminDisabled) reason = "admin disabled";
        else if (isNotApproved) reason = "not approved";
        alert(`Cannot create/update trip: Selected truck ${truckNo} is ${reason}.`);
        return;
      }
    }

    if (subTrips.length === 0) {
      alert("Fleet compliance requires registering at least 1 Cargo sub-trip segment for this trip journey.");
      return;
    }

    // Pass validated state upstream
    onSubmit({
      tripNo: finalTripNo,
      truckNo,
      startDate,
      endDate,
      driverName: driverName.trim(),
      startingKM: Number(startingKM) || 0,
      endingKM: Number(endingKM) || 0,
      payments,
      advances,
      subTrips,
      fuels, // N fuels list
      status,
      notes: notes.trim() || undefined,
      rtoExpense: Number(rtoExpense) || 0,
      rtoPaidByDriver,
      dieselLiters: fuels.length > 0 ? fuels.reduce((sum, f) => sum + Number(f.liters), 0) : Number(dieselLiters) || 0,
      dieselAmount: fuels.length > 0 ? fuels.reduce((sum, f) => sum + Number(f.amount), 0) : Number(dieselAmount) || 0,
      dieselRate: fuels.length > 0 ? (fuels.reduce((sum, f) => sum + Number(f.amount), 0) / (fuels.reduce((sum, f) => sum + Number(f.liters), 0) || 1)) : Number(dieselRate) || 0,
      addBlueExpense: Number(addBlueExpense) || 0,
      addBluePaidByDriver,
      fastagExpense: Number(fastagExpense) || 0,
      fastagPaidByDriver,
      otherExpense: Number(otherExpense) || 0,
      otherPaidByDriver
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh] animate-scale-up">
        
        {/* HEADER SPEC CHIPS */}
        <div className="px-6 py-4.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-blue-600" />
              {editingEntry ? `Modify Fleet Trip Journal: ${editingEntry.tripNo}` : 'Initiate Unified Fleet Journey'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Define master trip timelines, driver logs, multi-cargo sub-trips and financial settlement receipts.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-655 bg-slate-200/50 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MODAL MAIN CONTENTS CONTAINER WITH DUAL GRID SCROLL */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* DYNAMIC AUTO GENERATOR PREFERENCES */}
          {!editingEntry && (
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 block uppercase tracking-wider font-sans">Trip Series Configuration</span>
                <span className="text-[11px] text-slate-550 block">Unify consecutive freight loads under a single overarching sequence.</span>
              </div>
              <div className="flex bg-slate-205 bg-slate-200 rounded-lg p-1 gap-1 h-9 min-w-[320px]">
                <button
                  type="button"
                  onClick={() => setTripNoOption('AUTO')}
                  className={`flex-1 rounded text-xs font-bold transition duration-200 cursor-pointer ${
                    tripNoOption === 'AUTO' 
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
                  className={`flex-1 rounded text-xs font-bold transition duration-200 disabled:opacity-40 cursor-pointer ${
                    tripNoOption === 'EXISTING' 
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
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block border-b border-slate-150 pb-2">
              Category 1: Master Journey Specifications
            </span>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* TRIP CODE */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">Trip Code ID <span className="text-red-500">*</span></label>
                {editingEntry ? (
                  <input
                    type="text"
                    disabled
                    value={tripNo}
                    className="w-full bg-slate-100 border border-slate-200 text-slate-500 font-mono font-bold tracking-wider rounded-lg px-3 py-2 text-xs"
                  />
                ) : tripNoOption === 'AUTO' ? (
                  <input
                    type="text"
                    required
                    value={tripNo}
                    onChange={(e) => setTripNo(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono font-bold tracking-wider rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                ) : (
                  <select
                    value={selectedExistingTripNo}
                    onChange={(e) => setSelectedExistingTripNo(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-blue-700 font-mono font-bold tracking-wider rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    {existingTripNos.map(no => (
                      <option key={no} value={no}>{no}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* TRUCK SELECT */}
              <div>
                <label htmlFor="select-truckNo" className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">Target Truck <span className="text-red-500">*</span></label>
                <select
                  id="select-truckNo"
                  value={truckNo}
                  onChange={(e) => setTruckNo(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono font-bold rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="">-- Choose Truck --</option>
                  {activeTrucks.map(truck => {
                    const isExpired = truck.registrationExpiryDate ? truck.registrationExpiryDate < todayStr : false;
                    const isAdminDisabled = truck.status === 'Admin Disabled';
                    const isNotApproved = truck.isApproved === false || truck.requestStatus === 'Rejected';
                    const isBlocked = isExpired || isAdminDisabled || isNotApproved;
                    const isSelected = editingEntry && truck.truckNo === editingEntry.truckNo;
                    
                    let labelSuffix = '';
                    if (isAdminDisabled) labelSuffix = ' (Admin Disabled)';
                    else if (isNotApproved) labelSuffix = ' (Not Approved)';
                    else if (isExpired) labelSuffix = ' (Expired)';

                    return (
                      <option 
                        key={truck.id} 
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
                <label htmlFor="select-driverName" className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5 font-sans font-sans">Driver Operator <span className="text-red-500">*</span></label>
                <select
                  id="select-driverName"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-semibold rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white font-sans"
                >
                  <option value="">-- Choose Driver --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.driverName}>
                      {d.driverName} {canViewDrivers && d.phone ? `(${d.phone})` : ''}
                    </option>
                  ))}
                  {driverName && !drivers.some(d => d.driverName === driverName) && (
                    <option value={driverName}>{driverName} (Manual Override)</option>
                  )}
                </select>
              </div>

              {/* STATUS INDICATOR */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-650 uppercase tracking-wider mb-1.5">Journey Operational Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TripStatus)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="Pending">Pending (Not Initiated)</option>
                  <option value="In Progress">In Progress (On Wheels)</option>
                  <option value="Completed">Completed (Goods Delivered)</option>
                  <option value="Paid">Settled (Fully Paid Account)</option>
                </select>
              </div>
            </div>

            {/* ODOMETER AND TIMEFRAME SPECS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Journey Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg pl-7 pr-1.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Journey End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg pl-7 pr-1.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="input-startingKM" className="block text-[10px] text-slate-550 font-bold uppercase mb-1">Starting Odometer (KM)</label>
                <input
                  id="input-startingKM"
                  type="number"
                  min="0"
                  required
                  value={startingKM || ''}
                  onChange={(e) => setStartingKM(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-right font-mono"
                />
              </div>

              <div>
                <label htmlFor="input-endingKM" className="block text-[10px] text-slate-550 font-bold uppercase mb-1">Ending Odometer (KM)</label>
                <input
                  id="input-endingKM"
                  type="number"
                  min="0"
                  required
                  value={endingKM || ''}
                  onChange={(e) => setEndingKM(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none text-right font-mono"
                />
              </div>
            </div>

            {/* OVERLAND COMMON TRIP EXPENDITURES BLOCK */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-4 shadow-3xs border-blue-200 mt-4 font-sans text-xs">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest block border-b border-blue-105 pb-1.5 flex items-center gap-1.5 font-sans">
                <Fuel className="w-3.5 h-3.5 text-blue-600" />
                Trip Overland Common Expenses (Diesel Fuel, RTO Permits, AdBlue, Fastag Tolls, Misc)
              </span>

              {/* Dynamic Fuels Block */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-4">
                <div className="flex justify-between items-center border-b border-amber-250 pb-2">
                  <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1 font-sans">
                    <Fuel className="w-3.5 h-3.5 text-amber-600" />
                    Diesel Fuel Logs ({fuels.length} entries)
                  </span>
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-full font-mono">
                    Total: ₹{fuels.reduce((sum, f) => sum + f.amount, 0).toLocaleString()} (Liters: {fuels.reduce((sum, f) => sum + f.liters, 0).toLocaleString()})
                  </span>
                </div>

                {/* Fuels list summary table */}
                {fuels.length > 0 && (
                  <div className="overflow-x-auto border border-amber-200 rounded-lg bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-amber-100/50 text-[9px] font-extrabold text-amber-850 uppercase">
                        <tr>
                          <th className="p-2 pl-3">Date</th>
                          <th className="p-2">Liters</th>
                          <th className="p-2">Rate/Lit</th>
                          <th className="p-2 font-mono">Amount</th>
                          <th className="p-2">Fuel Station/Shop</th>
                          <th className="p-2">Account</th>
                          <th className="p-2 text-right pr-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 font-semibold text-slate-700">
                        {fuels.map(f => {
                          const acctName = f.paymentMode === 'driver' 
                            ? 'Paid by Driver (from Advance)' 
                            : (accounts.find(a => a.id === f.paymentMode)?.accountName || 'Cash/General');
                          return (
                            <tr key={f.id} className="hover:bg-amber-50/20">
                              <td className="p-2 pl-3 font-mono text-[10px]">{f.date}</td>
                              <td className="p-2 font-mono">{f.liters} L</td>
                              <td className="p-2 font-mono">₹{f.rate}</td>
                              <td className="p-2 font-mono text-amber-900">₹{f.amount.toLocaleString()}</td>
                              <td className="p-2 font-sans font-bold">{f.shopName || '—'}</td>
                              <td className="p-2 font-mono text-[10px] text-indigo-700">{acctName}</td>
                              <td className="p-2 text-right pr-3">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFuel(f.id)}
                                  className="text-rose-600 hover:text-rose-800 text-[10px] active:scale-95 transition font-bold cursor-pointer"
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

                {/* Inline fuels Quick Builder tool */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-white/70 rounded-lg p-2 border border-amber-200/50">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Fuel Date</label>
                    <input
                      type="date"
                      value={newFuelDate}
                      onChange={(e) => setNewFuelDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Liters</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={newFuelLiters}
                      onChange={(e) => setNewFuelLiters(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 font-mono text-xs focus:outline-none text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Rate / Lit</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={newFuelRate}
                      onChange={(e) => setNewFuelRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 font-mono text-xs focus:outline-none text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Fuel Station Shop</label>
                    <input
                      type="text"
                      placeholder="e.g. TVS / SF Bunk"
                      value={newFuelShop}
                      onChange={(e) => setNewFuelShop(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Account Mode</label>
                    <select
                      value={newFuelPaymentMode}
                      onChange={(e) => setNewFuelPaymentMode(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none font-semibold text-slate-705"
                    >
                      <option value="">Cash/General Mode</option>
                      <option value="driver">Paid by Driver (from Advance)</option>
                      {activeAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.accountName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col justify-end">
                    <button
                      type="button"
                      onClick={handleAddFuel}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] py-1.5 rounded uppercase cursor-pointer transition active:scale-95"
                    >
                      + Add Fuel
                    </button>
                  </div>
                </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start pt-2">
                {/* RTO Expense */}
                <div>
                  <label className="block text-[10px] text-slate-550 font-bold uppercase mb-1 flex items-center gap-1">₹ RTO Permits Expense</label>
                  <input
                    id="input-common-rtoExpense"
                    type="number"
                    min="0"
                    value={rtoExpense || ''}
                    onChange={(e) => setRtoExpense(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-white border border-slate-205 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono"
                  />
                  <label className="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rtoPaidByDriver}
                      onChange={(e) => setRtoPaidByDriver(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3 w-3 shadow-2xs"
                    />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                  </label>
                </div>

                {/* AdBlue Cost */}
                <div>
                  <label className="block text-[10px] text-slate-550 font-bold uppercase mb-1">₹ AdBlue Cost</label>
                  <input
                    id="input-common-addBlueExpense"
                    type="number"
                    min="0"
                    value={addBlueExpense || ''}
                    onChange={(e) => setAddBlueExpense(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-white border border-slate-205 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono"
                  />
                  <label className="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={addBluePaidByDriver}
                      onChange={(e) => setAddBluePaidByDriver(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3 w-3 shadow-2xs"
                    />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                  </label>
                </div>

                {/* Fastag tolls */}
                <div>
                  <label className="block text-[10px] text-slate-550 font-bold uppercase mb-1">₹ Fastag Toll Charges</label>
                  <input
                    id="input-common-fastagExpense"
                    type="number"
                    min="0"
                    value={fastagExpense || ''}
                    onChange={(e) => setFastagExpense(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-white border border-slate-205 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono"
                  />
                  <label className="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={fastagPaidByDriver}
                      onChange={(e) => setFastagPaidByDriver(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3 w-3 shadow-2xs"
                    />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                  </label>
                </div>

                {/* Other/Misc Overland */}
                <div>
                  <label className="block text-[10px] text-slate-550 font-bold uppercase mb-1">₹ Miscellaneous Other</label>
                  <input
                    id="input-common-otherExpense"
                    type="number"
                    min="0"
                    value={otherExpense || ''}
                    onChange={(e) => setOtherExpense(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-white border border-slate-205 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono"
                  />
                  <label className="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={otherPaidByDriver}
                      onChange={(e) => setOtherPaidByDriver(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3 w-3 shadow-2xs"
                    />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                  </label>
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* DYNAMIC CHILD SUB-TRIPS CONSTRUCTOR SECTOR */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-150 pb-2.5">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">
                Category 2: Cargo Sub-Trip Segments & Expenditures
              </span>
              <button
                type="button"
                onClick={handleOpenNewSubTrip}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] px-3.5 py-2 rounded-lg cursor-pointer transition shadow-2xs h-9"
              >
                <Plus className="w-4 h-4" /> Add Cargo Segment
              </button>
            </div>

            {/* Dynamic drafting sub-trips list visual list table */}
            {subTrips.length > 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-150 shadow-3xs max-h-[220px] overflow-y-auto font-sans">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3 pl-4"># Seg</th>
                      <th className="p-3">Load Date</th>
                      <th className="p-3">Office Name</th>
                      <th className="p-3">Route Path</th>
                      <th className="p-3 text-right">Income (₹)</th>
                      <th className="p-3 text-right">Fuel spent (₹)</th>
                      <th className="p-3 text-right">Other EXP (₹)</th>
                      <th className="p-3 text-right pr-4">Edit / Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {subTrips.map((st, sidx) => {
                      const fuelExp = st.dieselAmount || 0;
                      // Sum other sub-trip specific costs
                      const otherCol = (
                        (st.loadingExpense || 0) + 
                        (st.unloadingExpense || 0) + 
                        (st.brokerageExpense || 0) +
                        (st.rtoExpense || 0) + 
                        (st.addBlueExpense || 0) + 
                        (st.fastagExpense || 0) + 
                        (st.driverWages || 0) + 
                        (st.otherExpense || 0)
                      );
                      return (
                        <tr key={st.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3 pl-4 font-bold text-slate-400">#{sidx + 1}</td>
                          <td className="p-3 font-mono text-slate-650">{st.loadingDate}</td>
                          <td className="p-3 text-blue-650 font-bold">{st.officeName}</td>
                          <td className="p-3 text-slate-800 font-semibold">{st.routeFrom} ➔ {st.routeTo}</td>
                          <td className="p-3 text-right font-bold text-emerald-850 font-mono">₹{st.income.toLocaleString()}</td>
                          <td className="p-3 text-right font-medium text-amber-700 font-mono">₹{fuelExp.toLocaleString()}</td>
                          <td className="p-3 text-right font-medium text-red-600 font-mono">₹{otherCol.toLocaleString()}</td>
                          <td className="p-3 text-right pr-4 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSubTrip(st)}
                              className="text-blue-600 hover:text-blue-800 font-bold text-[11px] flex items-center gap-0.5"
                            >
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubTripSegment(st.id)}
                              className="text-rose-600 hover:text-rose-800 font-bold text-[11px] flex items-center gap-0.5"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-350 p-4">
                <p className="text-xs text-slate-500 italic font-medium">No cargo sub-trip load segments drafted yet.</p>
                <p className="text-[10px] text-slate-400 mt-1">Fleet regulations require at least one cargo shipment segment to compute fuel efficiency, per KM cost, and profit margins.</p>
                <button
                  type="button"
                  onClick={handleOpenNewSubTrip}
                  className="mt-3.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-[11px] py-1.5 px-3 rounded-lg shadow-3xs cursor-pointer inline-flex items-center gap-1 bg-neutral-100"
                >
                  <Plus className="w-3.5 h-3.5" /> Append First Document Segment
                </button>
              </div>
            )}

            {/* NESTED DYNAMIC PANEL SEGMENT FORM BUILDER (HIDDEN BY DEFAULT) */}
            {showSubTripForm && (
              <div className="bg-slate-50 rounded-xl border border-slate-205 p-5 space-y-4 shadow-3xs border-slate-300 animate-scale-up font-sans">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider font-sans">
                    <ListCollapse className="w-4 h-4 text-blue-650" />
                    {editingSubTripId ? 'Edit Sub-Trip Cargo Segment parameters' : 'Construct New Sub-Trip Cargo Segment'}
                  </span>
                  <button
                    type="button"
                    title="Close"
                    onClick={handleCancelSubTripSegment}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* SEG DATES */}
                  <div>
                    <label className="block text-[10px] text-slate-550 font-bold uppercase mb-1">Cargo Loading Date</label>
                    <input
                      type="date"
                      required
                      value={stLoadingDate}
                      onChange={(e) => setStLoadingDate(e.target.value)}
                      className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>

                  {/* LOADING OFFICE PLACE */}
                  <div>
                    <label className="block text-[10px] text-slate-550 font-bold uppercase mb-1">Loading Office <span className="text-red-500">*</span></label>
                    <select
                      value={stOfficeName}
                      onChange={(e) => setStOfficeName(e.target.value)}
                      className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold"
                    >
                      <option value="">-- Choose Office --</option>
                      {activeOffices.map(o => (
                        <option key={o.id} value={o.officeName}>{o.officeName}</option>
                      ))}
                    </select>
                  </div>

                  {/* ROUTE ORIGIN */}
                  <div>
                    <label htmlFor="input-stRouteFrom" className="block text-[10px] text-slate-555 font-bold uppercase mb-1">Route Origin <span className="text-red-500">*</span></label>
                    <input
                      id="input-stRouteFrom"
                      type="text"
                      list="indian_cities_list"
                      placeholder="e.g. Bangalore"
                      value={stRouteFrom}
                      onChange={(e) => setStRouteFrom(e.target.value)}
                      className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                    />
                  </div>

                  {/* ROUTE END DESTINATION */}
                  <div>
                    <label htmlFor="input-stRouteTo" className="block text-[10px] text-slate-555 font-bold uppercase mb-1">Route Destination <span className="text-red-500">*</span></label>
                    <input
                      id="input-stRouteTo"
                      type="text"
                      list="indian_cities_list"
                      placeholder="e.g. Mumbai Port"
                      value={stRouteTo}
                      onChange={(e) => setStRouteTo(e.target.value)}
                      className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                    />
                  </div>
                  
                  {/* INDIAN CITIES DATALIST */}
                  <datalist id="indian_cities_list">
                    {indianCities.map(city => (
                      <option key={city} value={city} />
                    ))}
                  </datalist>
                </div>

                {/* COSTINGS METALS EXPENSES CHIPS */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-2">
                  {/* SEG FREIGHT INCOME */}
                  <div>
                    <label htmlFor="input_st_income" className="block text-[10px] text-slate-555 font-bold uppercase mb-1 font-sans">₹ Billed Freight Income <span className="text-red-500">*</span></label>
                    <input
                      id="input_st_income"
                      type="number"
                      min="0"
                      value={stIncome || ''}
                      onChange={(e) => {
                        const newIncome = parseFloat(e.target.value) || 0;
                        setStIncome(newIncome);
                        if (stWagePct) {
                          const pct = parseFloat(stWagePct);
                          if (!isNaN(pct) && pct > 0) {
                            setStDriverWages(Math.round(newIncome * (pct / 100)));
                          }
                        }
                      }}
                      placeholder="0"
                      className="w-full bg-white border border-slate-250 text-slate-855 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono font-bold text-emerald-855"
                    />
                  </div>

                  {/* LOADING COST */}
                  <div>
                    <label className="block text-[10px] text-slate-450 font-bold uppercase mb-1">₹ Cargo Loading Expense</label>
                    <input
                      id="input_st_loading"
                      type="number"
                      min="0"
                      value={stLoadingExpense || ''}
                      onChange={(e) => setStLoadingExpense(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-250 text-slate-80 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono text-slate-705"
                    />
                    <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={stLoadingPaidByDriver}
                        onChange={(e) => setStLoadingPaidByDriver(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                    </label>
                  </div>

                  {/* UNLOADING COST */}
                  <div>
                    <label className="block text-[10px] text-slate-455 font-bold uppercase mb-1">₹ Unload Expense</label>
                    <input
                      id="input_st_unloading"
                      type="number"
                      min="0"
                      value={stUnloadingExpense || ''}
                      onChange={(e) => setStUnloadingExpense(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-250 text-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono text-slate-705"
                    />
                    <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={stUnloadingPaidByDriver}
                        onChange={(e) => setStUnloadingPaidByDriver(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                    </label>
                  </div>

                  {/* BROKERAGE COST */}
                  <div>
                    <label className="block text-[10px] text-slate-455 font-bold uppercase mb-1">₹ Brokerage Expense</label>
                    <input
                      id="input_st_brokerage"
                      type="number"
                      min="0"
                      value={stBrokerageExpense || ''}
                      onChange={(e) => setStBrokerageExpense(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-250 text-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono text-slate-705"
                    />
                    <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={stBrokeragePaidByDriver}
                        onChange={(e) => setStBrokeragePaidByDriver(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-tight">Paid from Driver Advance</span>
                    </label>
                  </div>

                  {/* WAGES */}
                  <div>
                    <label className="block text-[10px] text-slate-450 font-bold uppercase mb-1">Driver Wages / Allowance</label>
                    <div className="flex gap-1.5">
                      <select
                        id="select_st_wage_percentage"
                        value={stWagePct}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStWagePct(val);
                          const numVal = Number(val);
                          if (numVal > 0) {
                            const calculatedWages = Math.round(Number(stIncome) * (numVal / 100));
                            setStDriverWages(calculatedWages);
                          }
                        }}
                        className="bg-slate-50 border border-slate-250 text-slate-700 rounded-lg px-1 text-[10px] focus:outline-none"
                        style={{ width: '65px' }}
                      >
                        <option value="">% Calc</option>
                        {Array.from({ length: 20 }, (_, idx) => idx + 1).map(p => (
                          <option key={p} value={p.toString()}>{p}%</option>
                        ))}
                      </select>
                      <input
                        id="input_st_driverwages"
                        type="number"
                        min="0"
                        value={stDriverWages || ''}
                        onChange={(e) => {
                          setStDriverWages(parseFloat(e.target.value) || 0);
                          setStWagePct(''); // Break linkage if manually typed
                        }}
                        placeholder="0"
                        className="w-full bg-white border border-slate-250 text-slate-80 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono text-slate-705"
                      />
                    </div>
                  </div>
                </div>

                {/* SEG ODOMETER KM SPEC */}        {/* SEG ODOMETER KM SPEC */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 bg-slate-100 rounded-lg p-3.5 border border-slate-150">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Segment Starting KM</label>
                    <input
                      type="number"
                      min="0"
                      value={stStartingKM || ''}
                      onChange={(e) => setStStartingKM(parseInt(e.target.value) || 0)}
                      placeholder="Odo start"
                      className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Segment Ending KM</label>
                    <input
                      type="number"
                      min="0"
                      value={stEndingKM || ''}
                      onChange={(e) => setStEndingKM(parseInt(e.target.value) || 0)}
                      placeholder="Odo end"
                      className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-right"
                    />
                  </div>
                </div>

                {/* SEG NOTES */}
                <div>
                  <label className="block text-[10px] text-slate-450 font-bold uppercase mb-1">Segment remarks / Consignment detail</label>
                  <input
                    type="text"
                    placeholder="e.g. Iron rods loaded at Bangalore yard. Clear highway transit."
                    value={stNotes}
                    onChange={(e) => setStNotes(e.target.value)}
                    className="w-full bg-white border border-slate-250 text-slate-850 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                {/* ACTION SEGMENT POSTS */}
                <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-3.5">
                  <button
                    type="button"
                    onClick={handleCancelSubTripSegment}
                    className="px-4 py-2 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSubTripSegmentConfirm}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-lg cursor-pointer transition shadow-2xs border border-emerald-550"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
               {/* DYNAMIC SETTLEMENT PAYMENTS LEDGER MODULE */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block border-b border-slate-150 pb-2">
              Category 3: Financial Settlement Receipts & Advances (Linked by Office / Leg Segment)
            </span>

            {payments.length > 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-150 font-sans shadow-3xs text-xs max-h-[220px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold text-slate-505 tracking-wider">
                    <tr>
                      <th className="p-2.5 pl-4">#</th>
                      <th className="p-2.5">Date Received</th>
                      <th className="p-2.5">Ledger Account</th>
                      <th className="p-2.5 text-right">Amount (₹)</th>
                      <th className="p-2.5 pl-6">Cargo Leg Reference</th>
                      <th className="p-2.5 pl-6">Purpose / Segment Memo</th>
                      <th className="p-2.5 text-right pr-4">Discard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {payments.map((p, pidx) => {
                      const acc = activeAccounts.find(a => a.id === p.receivedBy);
                      const matchedSubTripIndex = subTrips.findIndex(st => st.id === p.subTripId);
                      const matchedSubTrip = subTrips.find(st => st.id === p.subTripId);
                      const segmentLabel = matchedSubTrip 
                        ? `Leg #${matchedSubTripIndex + 1}: ${matchedSubTrip.routeFrom} ➔ ${matchedSubTrip.routeTo} (${matchedSubTrip.officeName})` 
                        : 'General Trip Balance';
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 text-slate-705 font-medium">
                          <td className="p-2.5 pl-4 text-slate-400 font-bold">#{pidx + 1}</td>
                          <td className="p-2.5 font-mono text-slate-500">{p.date}</td>
                          <td className="p-2.5 text-blue-650 font-extrabold">{p.receivedBy === 'paid_to_driver_advance' ? 'Paid to Driver Advance' : (acc?.accountName || p.receivedBy)}</td>
                          <td className="p-2.5 text-right font-mono font-bold">₹{p.amount.toLocaleString()}</td>
                          <td className="p-2.5 pl-6 text-slate-400 font-mono text-[10px] uppercase font-bold">{segmentLabel}</td>
                          <td className="p-2.5 pl-6 font-semibold" title={p.notes}>{p.notes || <span className="text-slate-300">&mdash;</span>}</td>
                          <td className="p-2.5 text-right pr-4">
                            <button
                              type="button"
                              onClick={() => handleRemovePayment(p.id)}
                              title="Delete Payment Record"
                              className="inline-flex items-center justify-center p-1 bg-rose-50 hover:bg-rose-100 rounded text-rose-600 hover:text-rose-800 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-5 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-350">
                No financial receipts logged for this journey yet. Use the register widget below to log fuel or loading advances.
              </p>
            )}

            {/* Receipt Registrator Input Line */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 border-dashed p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end shadow-3xs font-sans">
              <div>
                <label className="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">Receipt Date</label>
                <input
                  type="date"
                  value={newPayDate}
                  onChange={(e) => setNewPayDate(e.target.value)}
                  className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">Receipts Ledger Account</label>
                <select
                  value={newPayReceivedBy}
                  onChange={(e) => setNewPayReceivedBy(e.target.value)}
                  className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold"
                >
                  <option value="">-- Choose Account --</option>
                  <option value="paid_to_driver_advance">Paid to Driver Advance</option>
                  {activeAccounts.map(ac => (
                    <option key={ac.id} value={ac.id}>{ac.accountName}</option>
                  ))}
                </select>
              </div>

              {/* Leg / Destination Balance Selector */}
              <div>
                <label className="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">Track segment</label>
                <select
                  value={newPaySubTripId}
                  onChange={(e) => setNewPaySubTripId(e.target.value)}
                  className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold"
                >
                  <option value="general">Whole Trip (General Balance)</option>
                  {subTrips.map((st, i) => (
                    <option key={st.id} value={st.id}>
                      Leg #{i + 1}: {st.routeFrom} ➔ {st.routeTo} ({st.officeName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">Settled Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={newPayAmount}
                  onChange={(e) => setNewPayAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  placeholder="₹0.00"
                  className="w-full bg-white border border-slate-250 text-slate-850 rounded-lg px-2 py-1.5 text-xs text-right font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[9px] text-slate-555 font-extrabold uppercase mb-1">Payment Notes / Cargo ref</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Hand cash advance"
                    value={newPayNotes}
                    onChange={(e) => setNewPayNotes(e.target.value)}
                    className="flex-1 bg-white border border-slate-250 text-slate-850 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddPayment}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shrink-0 cursor-pointer shadow-3xs bg-blue-600 shrink-0 h-8"
                  >
                    + Register
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* DRIVER TRIP ADVANCES LEDGER MODULE (Requirement 1 & 4) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block border-b border-slate-150 pb-2">
              Category 4: Driver advances for entire trip (Cash/Direct Bank issued to Driver)
            </span>

            {advances && advances.length > 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-150 font-sans shadow-3xs text-xs max-h-[180px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-505 uppercase font-bold tracking-wider">
                    <tr>
                      <th className="p-2.5 pl-4">#</th>
                      <th className="p-2.5">Date Given</th>
                      <th className="p-2.5">From Account</th>
                      <th className="p-2.5 text-right font-semibold">Amount (₹)</th>
                      <th className="p-2.5 pl-6">Receiving Status / Type</th>
                      <th className="p-2.5 pl-6">Purpose / Memo</th>
                      <th className="p-2.5 text-right pr-4">Discard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {advances.map((adv, advIdx) => {
                      const acc = activeAccounts.find(a => a.id === adv.fromAccountId);
                      return (
                        <tr key={adv.id} className="hover:bg-slate-50 text-slate-705 font-medium">
                          <td className="p-2.5 pl-4 text-slate-400 font-bold">#{advIdx + 1}</td>
                          <td className="p-2.5 font-mono text-slate-500">{adv.date}</td>
                          <td className="p-2.5 text-blue-650 font-bold">{acc?.accountName || adv.fromAccountId}</td>
                          <td className="p-2.5 text-right font-mono font-bold">₹{adv.amount.toLocaleString()}</td>
                          <td className="p-2.5 pl-6">
                            {adv.receivedByDriverDirectly ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-bold font-sans">
                                Received Directly by Driver (Party Payment)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 text-[10px] px-2 py-0.5 rounded-full font-bold font-sans">
                                Issued from Office
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 pl-6 text-slate-500 font-semibold">{adv.notes || <span className="text-slate-300">&mdash;</span>}</td>
                          <td className="p-2.5 text-right pr-4">
                            <button
                              type="button"
                              onClick={() => handleRemoveAdvance(adv.id)}
                              className="text-rose-600 hover:text-rose-800 hover:underline font-bold text-[11px]"
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
              <p className="p-5 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-350">
                No driver advances recorded for this trip yet. Use the issuer widget below to log trip operational advances.
              </p>
            )}

            {/* Advance Registrator Form */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 border-dashed p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end shadow-3xs font-sans">
              <div>
                <label className="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">Advance Date</label>
                <input
                  type="date"
                  value={newAdvDate}
                  onChange={(e) => setNewAdvDate(e.target.value)}
                  className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">From Account / Source</label>
                <select
                  value={newAdvFromAccount}
                  onChange={(e) => setNewAdvFromAccount(e.target.value)}
                  className="w-full bg-white border border-slate-250 text-slate-800 rounded-lg px-2 py-1.5 text-xs font-semibold"
                >
                  <option value="">-- Choose Account --</option>
                  {activeAccounts.map(ac => (
                    <option key={ac.id} value={ac.id}>{ac.accountName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] text-slate-550 font-extrabold uppercase mb-1">Advance Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={newAdvAmount}
                  onChange={(e) => setNewAdvAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  placeholder="₹0.00"
                  className="w-full bg-white border border-slate-250 text-slate-850 rounded-lg px-2 py-1.5 text-xs text-right font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[9px] text-slate-555 font-extrabold uppercase mb-1">Advance Notes / Memo</label>
                <input
                  type="text"
                  placeholder="e.g. For food/toll/misc"
                  value={newAdvNotes}
                  onChange={(e) => setNewAdvNotes(e.target.value)}
                  className="w-full bg-white border border-slate-250 text-slate-850 rounded-lg px-2.5 py-1.5 text-xs"
                />
              </div>

              <div className="flex flex-col gap-2 pb-1.5 pt-1.5">
                <button
                  type="button"
                  onClick={handleAddAdvance}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shrink-0 cursor-pointer shadow-3xs h-8 w-full block"
                >
                  + Issue Advance
                </button>
              </div>
            </div>
          </div>

          {/* DYNAMIC CALCULATOR FEEDBACK CONTAINER */}
          <div className="bg-slate-900 border border-slate-950 rounded-2xl p-5 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 font-sans shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-804 bg-slate-800 rounded-xl text-blue-400">
                <Calculator className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest font-sans">Accumulated Journey Financial Ledger</span>
                <div className="flex flex-wrap gap-x-3.5 text-xs text-slate-300">
                  <span>Gross Billings: <strong className="text-white font-mono">₹{metrics.income.toLocaleString()}</strong></span>
                  <span>&bull;</span>
                  <span>Expenses Outflow: <strong className="text-red-300 font-mono">₹{metrics.totalExpense.toLocaleString()}</strong></span>
                  <span>&bull;</span>
                  <span>Advances Received: <strong className="text-emerald-400 font-mono">₹{metrics.paymentsReceived.toLocaleString()}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] text-purple-305 text-slate-300 uppercase tracking-wider block font-medium flex items-center gap-1 justify-end">
                  Driver Balance
                  <span className={`h-1.5 w-1.5 rounded-full inline-block ${driverBalance >= 0 ? "bg-purple-400" : "bg-rose-500"}`} />
                </span>
                <span className={`text-[15px] font-black font-mono block leading-none mt-1 ${driverBalance >= 0 ? "text-purple-300" : "text-amber-300"}`} title={driverBalance >= 0 ? "Payable to Driver" : "Due from Driver"}>
                  ₹{driverBalance.toLocaleString("en-IN")}
                  <span className="text-[9px] font-sans font-normal block mt-0.5">{driverBalance >= 0 ? "Payable" : "Due from Drv"}</span>
                </span>
              </div>
              <div className="w-[1.5px] bg-slate-700 h-10 select-none"></div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Net Revenue Margin</span>
                <span className={`text-base font-black font-mono block leading-none mt-1 ${metrics.profit >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400'}`}>
                  ₹{metrics.profit.toLocaleString()}
                </span>
              </div>
              <div className="w-[1.5px] bg-slate-700 h-10 select-none"></div>
              <div className="text-right">
                <span className="text-[10px] text-slate-303 text-slate-300 uppercase tracking-wider block font-medium">Billed outstanding</span>
                <span className={`text-lg font-mono font-black block leading-none mt-1 ${metrics.outstandingBalance > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}`}>
                  ₹{metrics.outstandingBalance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* GENERAL TRANSPORT REMARKS */}
          <div className="font-sans">
            <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">General Transport Journey Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Full standard journey including interstate road permit, customs checkpoints, and multiple coal depot offloads."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-205 text-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white placeholder:text-slate-400"
            />
          </div>

        </div>

        {/* BOTTOM PANEL CONTROLS */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-240 flex justify-end gap-3 shrink-0 h-16 items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Cancel Journal
          </button>
          <button
            type="button"
            onClick={handleSubmitMasterForm}
            className="bg-blue-600 hover:bg-blue-700 border border-blue-550 text-white font-bold text-xs px-6 py-2.5 rounded-lg shadow-md hover:scale-[1.01] transition duration-200 cursor-pointer bg-blue-605 h-10"
          >
            {editingEntry ? 'Update Fleet Record' : 'Publish Fleet Record'}
          </button>
        </div>

      </div>
    </div>
  );
}
