import React, { useState, useEffect } from 'react';
import { Tyre, Truck, TyreMovementLog, TyreStatus, Account } from '../types';
import { 
  CheckCircle, 
  XCircle, 
  Settings, 
  Plus, 
  Wrench, 
  ExternalLink,
  ChevronRight, 
  Calendar, 
  DollarSign, 
  Compass, 
  History, 
  Truck as TruckIcon, 
  Layers, 
  Trash2, 
  TrendingUp, 
  UserCheck, 
  Activity,
  Tag, X 
} from 'lucide-react';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

interface TyreMasterProps {
  tyres: Tyre[];
  trucks: Truck[];
  accounts: Account[];
  onAddTyre: (
    tyre: Omit<Tyre, 'id' | 'movementHistory' | 'accumulatedKM'>,
    expenseDetails?: {
      createExpense: boolean;
      truckNo?: string;
      paymentMode?: string;
    }
  ) => void;
  onUpdateTyre: (tyre: Tyre) => void;
  onDeleteTyre: (id: string) => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
  canViewTyres?: boolean;
  canEditTyres?: boolean;
  canDeleteTyres?: boolean;
  organizationId?: string;
}

export default function TyreMaster({ 
  tyres, 
  trucks, 
  accounts, 
  onAddTyre, 
  onUpdateTyre, 
  onDeleteTyre, 
  confirmAction, 
  canViewTyres = true,
  canEditTyres = true,
  canDeleteTyres = true,
  organizationId
}: TyreMasterProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [tyreNo, setTyreNo] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [size, setSize] = useState('10.00R20');
  const [purchaseDate, setPurchaseDate] = useState('2026-05-23');
  const [purchaseAmount, setPurchaseAmount] = useState('');

  // Auto expense ledger states
  const [associatedTruckNo, setAssociatedTruckNo] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [createExpense, setCreateExpense] = useState(true);
  const [mountDirectly, setMountDirectly] = useState(false);
  const [initialOdoKM, setInitialOdoKM] = useState('');

  // Status Filter
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Action states
  const [mountingTyreId, setMountingTyreId] = useState<string | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [mountingKM, setMountingKM] = useState('');
  const [mountingDate, setMountingDate] = useState('2026-05-23');

  const [removingTyreId, setRemovingTyreId] = useState<string | null>(null);
  const [removalKM, setRemovalKM] = useState('');
  const [removalDate, setRemovalDate] = useState('2026-05-23');
  const [removalRemarks, setRemovalRemarks] = useState('Routine Rotation');

  const [sellingTyreId, setSellingTyreId] = useState<string | null>(null);
  const [saleAmount, setSaleAmount] = useState('');
  const [saleDate, setSaleDate] = useState('2026-05-23');

  const [scrappingTyreId, setScrappingTyreId] = useState<string | null>(null);
  const [scrapDate, setScrapDate] = useState('2026-05-23');

  const [viewHistoryTyreId, setViewHistoryTyreId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [displayedTyres, setDisplayedTyres] = useState<Tyre[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const online = isAppwriteConfigured();

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Offline / local logic fallback
  useEffect(() => {
    if (!online) {
      const filtered = tyres.filter(tyre => {
        const matchesStatus = statusFilter ? tyre.status === statusFilter : true;
        const matchesSearch = searchQuery 
          ? tyre.tyreNo.toLowerCase().includes(searchQuery.toLowerCase()) || 
            tyre.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (tyre.currentTruckNo && tyre.currentTruckNo.toLowerCase().includes(searchQuery.toLowerCase()))
          : true;
        return matchesStatus && matchesSearch;
      });

      setTotalCount(filtered.length);
      const startIdx = (currentPage - 1) * pageSize;
      setDisplayedTyres(filtered.slice(startIdx, startIdx + pageSize));
    }
  }, [tyres, searchQuery, statusFilter, currentPage, pageSize, online]);

  // Online Appwrite logic
  useEffect(() => {
    if (online) {
      const fetchServerTyres = async () => {
        setLoading(true);
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const orgId = organizationId || localStorage.getItem('ttt_organization_id') || 'org_default';

          const res = await appwrite.queryTyres(
            databaseId,
            orgId,
            {
              search: searchQuery || undefined,
              status: statusFilter || undefined
            },
            currentPage,
            pageSize
          );

          const mapped = (res.documents || []).map(doc => {
            try {
              if (doc.data) {
                const parsed = JSON.parse(doc.data);
                return { id: doc.$id, ...parsed };
              }
            } catch (e) {
              console.warn("Failed to parse doc.data for tyre:", doc.$id, e);
            }
            return {
              id: doc.$id,
              tyreNo: doc.tyreNo || '',
              manufacturer: doc.manufacturer || '',
              status: doc.status || 'Available',
              currentTruckNo: doc.currentTruckNo || '',
              purchaseDate: doc.purchaseDate || '',
              movementHistory: []
            };
          });
          setDisplayedTyres(mapped);
          setTotalCount(res.total || 0);
        } catch (err) {
          console.error("Failed to query tyres from Appwrite:", err);
        } finally {
          setLoading(false);
        }
      };

      const delayDebounce = setTimeout(() => {
        fetchServerTyres();
      }, 300);

      return () => clearTimeout(delayDebounce);
    }
  }, [searchQuery, statusFilter, currentPage, pageSize, online, organizationId]);

  const resetAddForm = () => {
    setTyreNo('');
    setManufacturer('');
    setSize('10.00R20');
    setPurchaseDate('2026-05-23');
    setPurchaseAmount('');
    setAssociatedTruckNo('');
    setPaymentMode('');
    setCreateExpense(true);
    setMountDirectly(false);
    setInitialOdoKM('');
  };

  const handleCreateTyre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tyreNo.trim() || !manufacturer) return;

    const todayStr = new Date().toISOString().substring(0, 10);
    const selectedTruck = trucks.find(t => t.truckNo === associatedTruckNo);
    if (selectedTruck) {
      const isExpired = selectedTruck.registrationExpiryDate ? selectedTruck.registrationExpiryDate < todayStr : false;
      const isAdminDisabled = selectedTruck.status === 'Admin Disabled';
      const isNotApproved = selectedTruck.isApproved === false || selectedTruck.requestStatus === 'Rejected';
      if (isExpired || isAdminDisabled || isNotApproved) {
        let reason = "expired";
        if (isAdminDisabled) reason = "admin disabled";
        else if (isNotApproved) reason = "not approved";
        alert(`Cannot register tyre: Selected truck ${associatedTruckNo} is ${reason}.`);
        return;
      }
    }

    const isMounted = mountDirectly && associatedTruckNo;

    onAddTyre(
      {
        tyreNo: tyreNo.trim().toUpperCase(),
        manufacturer,
        size,
        status: isMounted ? 'Active' : 'Available',
        currentTruckNo: isMounted ? associatedTruckNo : undefined,
        installationDate: isMounted ? purchaseDate : undefined,
        installationKM: isMounted ? (initialOdoKM ? Number(initialOdoKM) : undefined) : undefined,
        purchaseDate: purchaseDate || undefined,
        purchaseAmount: purchaseAmount ? Number(purchaseAmount) : undefined
      },
      {
        createExpense: createExpense && !!purchaseAmount,
        truckNo: associatedTruckNo || 'YARD / WH',
        paymentMode: paymentMode || 'Cash'
      }
    );

    resetAddForm();
    setShowAddForm(false);
  };

  const startMounting = (tyre: Tyre) => {
    setMountingTyreId(tyre.id);
    setSelectedTruckId('');
    setMountingKM('');
    setMountingDate('2026-05-23');
  };

  const handleMountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tyre = tyres.find(t => t.id === mountingTyreId);
    if (!tyre || !selectedTruckId || !mountingKM) return;

    const truck = trucks.find(tr => tr.id === selectedTruckId);
    if (!truck) return;

    const todayStr = new Date().toISOString().substring(0, 10);
    const isExpired = truck.registrationExpiryDate ? truck.registrationExpiryDate < todayStr : false;
    const isAdminDisabled = truck.status === 'Admin Disabled';
    const isNotApproved = truck.isApproved === false || truck.requestStatus === 'Rejected';
    if (isExpired || isAdminDisabled || isNotApproved) {
      let reason = "expired";
      if (isAdminDisabled) reason = "admin disabled";
      else if (isNotApproved) reason = "not approved";
      alert(`Cannot mount tyre: Selected truck ${truck.truckNo} is ${reason}.`);
      return;
    }

    const parsedKM = Number(mountingKM);
    const newLog: TyreMovementLog = {
      id: 'mvt_' + Date.now(),
      action: 'Installed',
      truckNo: truck.truckNo,
      date: mountingDate,
      odometerKM: parsedKM,
      remarks: `Mounted on Vehicle ${truck.truckNo} at odometer ${parsedKM} KM`
    };

    const updatedTyre: Tyre = {
      ...tyre,
      status: 'Active',
      currentTruckNo: truck.truckNo,
      installationDate: mountingDate,
      installationKM: parsedKM,
      movementHistory: [newLog, ...tyre.movementHistory]
    };

    onUpdateTyre(updatedTyre);
    setMountingTyreId(null);
  };

  const startRemoving = (tyre: Tyre) => {
    setRemovingTyreId(tyre.id);
    const relatedTruck = trucks.find(tk => tk.truckNo === tyre.currentTruckNo);
    setRemovalKM(relatedTruck?.currentKM ? relatedTruck.currentKM.toString() : (tyre.installationKM || 0).toString());
    setRemovalDate('2026-05-23');
    setRemovalRemarks('Routine Rotation');
  };

  const handleRemovalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tyre = tyres.find(t => t.id === removingTyreId);
    if (!tyre || !removalKM) return;

    const parsedRemovalKM = Number(removalKM);
    const installKM = tyre.installationKM || 0;
    const runMileage = Math.max(0, parsedRemovalKM - installKM);

    const newLog: TyreMovementLog = {
      id: 'mvt_' + Date.now(),
      action: 'Removed',
      truckNo: tyre.currentTruckNo,
      date: removalDate,
      odometerKM: parsedRemovalKM,
      remarks: `${removalRemarks} (Displacement run mileage: ${runMileage} KM)`
    };

    const updatedTyre: Tyre = {
      ...tyre,
      status: 'Available',
      currentTruckNo: undefined,
      installationDate: undefined,
      installationKM: undefined,
      accumulatedKM: tyre.accumulatedKM + runMileage,
      movementHistory: [newLog, ...tyre.movementHistory]
    };

    onUpdateTyre(updatedTyre);
    setRemovingTyreId(null);
  };

  const startSelling = (tyre: Tyre) => {
    setSellingTyreId(tyre.id);
    setSaleAmount('');
    setSaleDate('2026-05-23');
  };

  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tyre = tyres.find(t => t.id === sellingTyreId);
    if (!tyre || !saleAmount) return;

    const newLog: TyreMovementLog = {
      id: 'mvt_' + Date.now(),
      action: 'Sold',
      date: saleDate,
      remarks: `Sold for ₹${Number(saleAmount).toLocaleString()}`
    };

    const updatedTyre: Tyre = {
      ...tyre,
      status: 'Sold',
      saleDate,
      saleAmount: Number(saleAmount),
      movementHistory: [newLog, ...tyre.movementHistory]
    };

    onUpdateTyre(updatedTyre);
    setSellingTyreId(null);
  };

  const startScrapping = (tyre: Tyre) => {
    setScrappingTyreId(tyre.id);
    setScrapDate('2026-05-23');
  };

  const handleScrapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tyre = tyres.find(t => t.id === scrappingTyreId);
    if (!tyre) return;

    const newLog: TyreMovementLog = {
      id: 'mvt_' + Date.now(),
      action: 'Scrapped',
      date: scrapDate,
      remarks: 'Decommissioned / Recycled due to heavy wear & bald treads'
    };

    const updatedTyre: Tyre = {
      ...tyre,
      status: 'Scrapped',
      movementHistory: [newLog, ...tyre.movementHistory]
    };

    onUpdateTyre(updatedTyre);
    setScrappingTyreId(null);
  };

  const findTruckKM = (truckNo?: string): number => {
    if (!truckNo) return 0;
    const t = trucks.find(tk => tk.truckNo === truckNo);
    return t?.currentKM || 0;
  };

  const calculateActiveKM = (tyre: Tyre): number => {
    if (tyre.status !== 'Active' || !tyre.currentTruckNo) return 0;
    const currentOdo = findTruckKM(tyre.currentTruckNo);
    const installOdo = tyre.installationKM || 0;
    return Math.max(0, currentOdo - installOdo);
  };

  const filteredTyres = tyres.filter(tyre => {
    const matchesStatus = statusFilter ? tyre.status === statusFilter : true;
    const matchesSearch = searchQuery 
      ? tyre.tyreNo.toLowerCase().includes(searchQuery.toLowerCase()) || 
        tyre.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tyre.currentTruckNo && tyre.currentTruckNo.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesStatus && matchesSearch;
  });

  return (
    <div id="tyre-tracker-panel" className="space-y-6">
      
      {/* Search and Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-3xs">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search Serial No / Manufacturer / Truck..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg pl-3 pr-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
          <div>
            <select
              aria-label="Status Filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">-- All Statuses --</option>
              <option value="Available">Available (In Yard Warehouse)</option>
              <option value="Active">Active (Mounted on Truck)</option>
              <option value="Sold">Sold (Disposed Account)</option>
              <option value="Scrapped">Scrapped (Bald Tires Recycle)</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>Filtered: <b>{totalCount} Tyres</b></span>
            {loading && <span className="inline-block w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin ml-1.5 align-middle"></span>}
          </div>
        </div>

        {canEditTyres && (
          <button
            id="btn-add-tyre"
            onClick={() => {
              resetAddForm();
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-150 shadow-sm text-xs cursor-pointer self-start md:self-auto"
          >
            {showAddForm ? 'Close panel' : (
              <>
                <Plus className="w-3.5 h-3.5" /> Register New Tyre
              </>
            )}
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 overflow-auto animate-fade-in" id="tyre-form-backdrop">
          <form id="tyre-form" onSubmit={handleCreateTyre} className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto text-left">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-850 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-805 dark:text-white tracking-wide">
                  Register New Purchase Specification
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  resetAddForm();
                  setShowAddForm(false);
                }}
                className="p-1.5 hover:bg-slate-105 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 rounded-xl transition cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label htmlFor="tyreNo" className="block text-[10px] font-bold text-slate-655 uppercase mb-1">Tyre Serial No <span className="text-red-500">*</span></label>
                <input
                  id="tyreNo"
                  type="text"
                  required
                  placeholder="e.g. MRF-102948"
                  value={tyreNo}
                  onChange={(e) => setTyreNo(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono font-bold"
                />
              </div>
              <div>
                <label htmlFor="manufacturer" className="block text-[10px] font-bold text-slate-655 uppercase mb-1">Manufacturer <span className="text-red-500">*</span></label>
                <select
                  id="manufacturer"
                  required
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Manufacturer --</option>
                  <option value="MRF">MRF Ltd</option>
                  <option value="Apollo">Apollo Tyres</option>
                  <option value="JK Tyre">JK Tyre & Industries</option>
                  <option value="CEAT">CEAT Limited</option>
                  <option value="Michelin">Michelin</option>
                  <option value="Bridgestone">Bridgestone</option>
                  <option value="Goodyear">Goodyear India</option>
                  <option value="Yokohama">Yokohama</option>
                </select>
              </div>
              <div>
                <label htmlFor="tyreSize" className="block text-[10px] font-bold text-slate-655 uppercase mb-1">Tyre Size Dimension</label>
                <input
                  id="tyreSize"
                  type="text"
                  placeholder="e.g. 10.00R20, 295/85R22.5"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="purchaseDate" className="block text-[10px] font-bold text-slate-655 uppercase mb-1">Purchase Date</label>
                <input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none "
                />
              </div>
              <div>
                <label htmlFor="purchaseAmount" className="block text-[10px] font-bold text-slate-655 uppercase mb-1">Purchase Amount (₹)</label>
                <input
                  id="purchaseAmount"
                  type="number"
                  placeholder="e.g. 24000"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-805 dark:text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono font-bold"
                />
              </div>
            </div>

            {/* Supplementary integration section for Auto Ledger */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3.5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-750">Financial Ledger & Vehicle Allocation</h4>
                </div>
                <p className="text-[10px] text-slate-500 italic">Automatically posts transaction vouchers to your ledger</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="associatedTruckNo" className="block text-[10px] font-bold text-slate-655 uppercase mb-1">Allocate Expense to</label>
                  <select
                    id="associatedTruckNo"
                    value={associatedTruckNo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAssociatedTruckNo(val);
                      if (!val) {
                        setMountDirectly(false);
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="">YARD / STOCK (General Warehouse)</option>
                    {trucks.map(tk => {
                      const todayStr = new Date().toISOString().substring(0, 10);
                      const isExpired = tk.registrationExpiryDate ? tk.registrationExpiryDate < todayStr : false;
                      const isAdminDisabled = tk.status === 'Admin Disabled';
                      const isNotApproved = tk.isApproved === false || tk.requestStatus === 'Rejected';
                      const isBlocked = isExpired || isAdminDisabled || isNotApproved;

                      let labelSuffix = '';
                      if (isAdminDisabled) labelSuffix = ' (Admin Disabled)';
                      else if (isNotApproved) labelSuffix = ' (Not Approved)';
                      else if (isExpired) labelSuffix = ' (Expired)';

                      return (
                        <option 
                          key={tk.id} 
                          value={tk.truckNo}
                          disabled={isBlocked}
                        >
                          Vehicle: {tk.truckNo}{labelSuffix}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label htmlFor="paymentMode" className="block text-[10px] font-bold text-slate-655 uppercase mb-1">Paid From Ledger Account</label>
                  <select
                    id="paymentMode"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Cash Account</option>
                    {accounts.map(ac => (
                      <option key={ac.id} value={ac.accountName}>{ac.accountName} ({ac.type})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col justify-center">
                  <label htmlFor="createExpense" className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      id="createExpense"
                      type="checkbox"
                      checked={createExpense}
                      onChange={(e) => setCreateExpense(e.target.checked)}
                      disabled={!purchaseAmount}
                      className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <div className="text-xs font-semibold text-slate-700">
                      Post to Expense Ledger
                      {!purchaseAmount && <span className="block text-[10px] font-normal text-slate-400 font-mono"> (Enter purchase price first)</span>}
                    </div>
                  </label>
                </div>

                {associatedTruckNo && (
                  <div className="flex flex-col justify-center border-l sm:border-l-0 lg:border-l border-slate-200 pl-0 lg:pl-4">
                    <label htmlFor="mountDirectly" className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        id="mountDirectly"
                        type="checkbox"
                        checked={mountDirectly}
                        onChange={(e) => setMountDirectly(e.target.checked)}
                        className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <div className="text-xs font-semibold text-slate-700">
                        Mount immediately on {associatedTruckNo}
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {mountDirectly && associatedTruckNo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 animate-fade-in">
                  <div>
                    <label htmlFor="initialOdoKM" className="block text-[10px] font-bold text-slate-655 uppercase mb-1">
                      Installation Odometer Reading (KM) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="initialOdoKM"
                      type="number"
                      required={mountDirectly}
                      placeholder={`Current Vehicle KM: ${trucks.find(t => t.truckNo === associatedTruckNo)?.currentKM || 0}`}
                      value={initialOdoKM}
                      onChange={(e) => setInitialOdoKM(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-end pl-1 pb-1">
                    <p className="text-[11px] text-slate-500">
                      The tyre status will auto-transition to <b className="text-emerald-600 font-bold">Active</b> and a mounting log at {initialOdoKM || '0'} KM will be written in movement history.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 pt-4 col-span-full">
              <button
                type="button"
                onClick={resetAddForm}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-250 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Reset
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Add Tyre record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid display list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayedTyres.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 italic">
            No tyres mapped with current filter. Please select "All Statuses" or register a new Tyre purchase.
          </div>
        ) : (
          displayedTyres.map(tyre => {
            const activeRunKM = calculateActiveKM(tyre);
            const overallKM = tyre.accumulatedKM + activeRunKM;
            const relatedTruck = trucks.find(tk => tk.truckNo === tyre.currentTruckNo);

            return (
              <div key={tyre.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs flex flex-col justify-between hover:border-blue-300 transition-colors relative overflow-hidden group">
                
                {/* Decorative border bar based on status */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  tyre.status === 'Active' ? 'bg-emerald-500' :
                  tyre.status === 'Available' ? 'bg-blue-500' :
                  tyre.status === 'Sold' ? 'bg-amber-500' :
                  'bg-rose-500'
                }`} />

                {/* Card Top Information */}
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{tyre.manufacturer}</span>
                      <h4 className="text-sm font-extrabold text-slate-850 font-mono tracking-wider flex items-center gap-1.5 mt-0.5">
                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                        {tyre.tyreNo}
                      </h4>
                    </div>

                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                      tyre.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      tyre.status === 'Available' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                      tyre.status === 'Sold' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {tyre.status}
                    </span>
                  </div>

                  {/* Operational Location Badge */}
                  <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-150 text-xs">
                    {tyre.status === 'Active' && tyre.currentTruckNo ? (
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-semibold flex items-center gap-1">
                            <TruckIcon className="w-3.5 h-3.5 text-emerald-600" /> Mounted vehicle:
                          </span>
                          <span className="font-mono font-bold text-slate-900 text-xs uppercase underline">
                            {tyre.currentTruckNo}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 text-[10px] text-slate-450 pt-1 border-t border-slate-100">
                          <div>Mount ODO: <b className="text-slate-600 font-mono">{tyre.installationKM?.toLocaleString()} KM</b></div>
                          <div className="text-right">Current: <b className="text-slate-600 font-mono">{relatedTruck?.currentKM?.toLocaleString()} KM</b></div>
                        </div>
                      </div>
                    ) : tyre.status === 'Available' ? (
                      <div className="flex justify-between items-center text-blue-800">
                        <span className="font-semibold flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-blue-600 animate-pulse" /> Asset Location:
                        </span>
                        <span>Yard Warehouse Stock</span>
                      </div>
                    ) : tyre.status === 'Sold' ? (
                      <div>
                        <div className="flex justify-between text-amber-700">
                          <span>Sold parameters:</span>
                          <b className="font-mono">₹{tyre.saleAmount?.toLocaleString()}</b>
                        </div>
                        {tyre.saleDate && <div className="text-[10px] text-slate-450 text-right mt-0.5">Date: {tyre.saleDate}</div>}
                      </div>
                    ) : (
                      <div className="text-rose-700 font-semibold">
                        Scrapped due to bald treads / End of service life.
                      </div>
                    )}
                  </div>

                  {/* Odo mileage tracking bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500">Accycled Lifespan Milestones:</span>
                      <span className="font-mono text-slate-850 text-xs font-black">{overallKM.toLocaleString()} KM</span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          overallKM > 75000 ? 'bg-rose-500' :
                          overallKM > 50000 ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, (overallKM / 100000) * 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[9px] text-slate-450 font-mono pt-0.5">
                      <span>0 KM</span>
                      {tyre.status === 'Active' && activeRunKM > 0 && (
                        <span>Current Run: {activeRunKM.toLocaleString()} KM</span>
                      )}
                      <span>Life cap 100K KM</span>
                    </div>
                  </div>

                  {/* Attributes detail grid */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50/30 p-2 rounded-lg text-slate-500">
                    <div>Size: <b className="text-slate-700 font-mono">{tyre.size || '10.00R20'}</b></div>
                    <div>Purchase Date: <b className="text-slate-705 font-mono">{tyre.purchaseDate || '—'}</b></div>
                    <div className="col-span-2 border-t border-slate-100 pt-1 mt-1">
                      Purchase Cost: <b className="text-slate-700 font-mono">{tyre.purchaseAmount ? `₹${tyre.purchaseAmount.toLocaleString()}` : '—'}</b>
                    </div>
                  </div>

                </div>

                {/* Cards Bottom Actions */}
                <div className="pt-4 border-t border-slate-100 mt-4 flex justify-between items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setViewHistoryTyreId(tyre.id)}
                    className="text-[10px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition"
                    title="View movement ledger"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Logs ({tyre.movementHistory.length})</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {canEditTyres && tyre.status === 'Available' && (
                      <>
                        <button
                          onClick={() => startMounting(tyre)}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded text-[10px] font-bold cursor-pointer transition"
                        >
                          Mount
                        </button>
                        <button
                          onClick={() => startSelling(tyre)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded text-[10px] font-bold cursor-pointer transition"
                        >
                          Sell tyre
                        </button>
                        <button
                          onClick={() => startScrapping(tyre)}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded text-[10px] font-bold cursor-pointer transition"
                        >
                          Scrap
                        </button>
                      </>
                    )}

                    {canEditTyres && tyre.status === 'Active' && (
                      <button
                        onClick={() => startRemoving(tyre)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded text-[10px] font-bold cursor-pointer transition uppercase tracking-wider"
                      >
                        Dismount
                      </button>
                    )}

                    {/* Delete option only if available & no extensive movement logs for clean protection */}
                    {canDeleteTyres && tyre.status === 'Available' && tyre.movementHistory.length <= 1 && (
                      <button
                        onClick={() => {
                          const msg = `Are you sure you want to delete Tyre record ${tyre.tyreNo}?`;
                          if (confirmAction) {
                            confirmAction(msg, () => onDeleteTyre(tyre.id), "Delete Tyre Ledger Record");
                          } else if (confirm(msg)) {
                            onDeleteTyre(tyre.id);
                          }
                        }}
                        className="p-1 text-slate-355 text-slate-350 hover:text-red-500 rounded transition cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* PAGINATION FOOTER */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs no-print">
        <div className="text-slate-500 font-medium">
          Showing <strong className="text-slate-800">{totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{" "}
          <strong className="text-slate-800">{Math.min(currentPage * pageSize, totalCount)}</strong> of{" "}
          <strong className="text-slate-800">{totalCount}</strong> entries
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Page size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded p-1 text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              {[12, 24, 48, 96].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
              className="p-1 px-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold rounded border border-slate-200 disabled:cursor-not-allowed select-none cursor-pointer transition"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
              disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
              className="p-1 px-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold rounded border border-slate-200 disabled:cursor-not-allowed select-none cursor-pointer transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ACTION 1: MOUNT (INSTALL) DIALOG MODLET */}
      {mountingTyreId && (() => {
        const tyre = tyres.find(t => t.id === mountingTyreId);
        if (!tyre) return null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                  <TruckIcon className="w-4 h-4 text-emerald-600 animate-bounce" /> Mount Tyre on Active Truck
                </h3>
                <button onClick={() => setMountingTyreId(null)} className="text-slate-400 text-lg hover:text-slate-600">&times;</button>
              </div>
              
              <form onSubmit={handleMountSubmit} className="space-y-3.5 text-xs">
                <div>
                  <span className="text-slate-400">Target Serial:</span>
                  <span className="font-mono font-bold text-slate-850 block mt-0.5">{tyre.tyreNo} ({tyre.manufacturer})</span>
                </div>

                <div>
                  <label htmlFor="mountSelectedTruckId" className="block text-[10px] uppercase font-bold text-slate-550 mb-1">Select Active Truck <span className="text-red-500">*</span></label>
                  <select
                    id="mountSelectedTruckId"
                    required
                    value={selectedTruckId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setSelectedTruckId(selId);
                      const t = trucks.find(tr => tr.id === selId);
                      if (t && t.currentKM) {
                        setMountingKM(t.currentKM.toString());
                      } else {
                        setMountingKM('');
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white text-slate-800 font-semibold"
                  >
                    <option value="">-- Choose Truck --</option>
                    {trucks.map(t => {
                      const todayStr = new Date().toISOString().substring(0, 10);
                      const isExpired = t.registrationExpiryDate ? t.registrationExpiryDate < todayStr : false;
                      const isAdminDisabled = t.status === 'Admin Disabled' || t.status === 'Inactive';
                      const isNotApproved = t.isApproved === false || t.requestStatus === 'Rejected';
                      const isBlocked = isExpired || isAdminDisabled || isNotApproved;

                      let labelSuffix = '';
                      if (isAdminDisabled) labelSuffix = ' (Disabled/Inactive)';
                      else if (isNotApproved) labelSuffix = ' (Not Approved)';
                      else if (isExpired) labelSuffix = ' (Expired)';

                      return (
                        <option 
                          key={t.id} 
                          value={t.id}
                          disabled={isBlocked}
                        >
                          {t.truckNo} ({t.ownerName || 'Self'}){labelSuffix}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label htmlFor="mountingDate" className="block text-[10px] uppercase font-bold text-slate-550 mb-1">Mounting Date <span className="text-red-500">*</span></label>
                  <input
                    id="mountingDate"
                    type="date"
                    required
                    value={mountingDate}
                    onChange={(e) => setMountingDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="mountingKM" className="block text-[10px] uppercase font-bold text-slate-550 mb-1">Truck Odometer KM <span className="text-red-500">*</span></label>
                  <input
                    id="mountingKM"
                    type="number"
                    required
                    placeholder="e.g. 102540"
                    value={mountingKM}
                    onChange={(e) => setMountingKM(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Please specify precise ODO read to ensure true wear parameters.</p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMountingTyreId(null)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold"
                  >
                    Confirm Mount
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ACTION 2: DISMOUNT (REMOVE) ACTION MODLET */}
      {removingTyreId && (() => {
        const tyre = tyres.find(t => t.id === removingTyreId);
        if (!tyre) return null;

        const estRun = Number(removalKM) - (tyre.installationKM || 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                  <Wrench className="w-4 h-4 text-blue-600" /> Dismount from {tyre.currentTruckNo}
                </h3>
                <button onClick={() => setRemovingTyreId(null)} className="text-slate-400 text-lg hover:text-slate-600">&times;</button>
              </div>

              <form onSubmit={handleRemovalSubmit} className="space-y-3.5 text-xs">
                <div>
                  <span className="text-slate-400 gap-1 flex items-center">Displaced ODO track:</span>
                  <div className="bg-slate-50 p-2 border border-slate-150 rounded mt-1">
                    <div>Mounted on: <b className="text-slate-700 font-mono text-xs">{tyre.currentTruckNo}</b></div>
                    <div>Installation Odometer Read: <b className="text-slate-700 font-mono">{tyre.installationKM?.toLocaleString()} KM</b></div>
                  </div>
                </div>

                <div>
                  <label htmlFor="removalDate" className="block text-[10px] uppercase font-bold text-slate-550 mb-1">Dismount Date <span className="text-red-500">*</span></label>
                  <input
                    id="removalDate"
                    type="date"
                    required
                    value={removalDate}
                    onChange={(e) => setRemovalDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="removalKM" className="block text-[10px] uppercase font-bold text-slate-550 mb-1">Removal Odometer KM <span className="text-red-500">*</span></label>
                  <input
                    id="removalKM"
                    type="number"
                    required
                    value={removalKM}
                    onChange={(e) => setRemovalKM(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white font-mono font-bold"
                  />
                  {estRun > 0 ? (
                    <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                      Calculated run displacement: <b>+{estRun.toLocaleString()} KM</b> will be added to tyre total lifespan.
                    </p>
                  ) : estRun === 0 ? (
                    <p className="text-[10px] text-slate-400 mt-1">Odometer unchanged. Total accumulated displacement is unchanged.</p>
                  ) : (
                    <p className="text-[10px] text-red-500 font-semibold mt-1">Warning: removal odometer is lower than installation odometer.</p>
                  )}
                </div>

                <div>
                  <label htmlFor="removalRemarks" className="block text-[10px] uppercase font-bold text-slate-550 mb-1">Removal Reason / Note</label>
                  <input
                    id="removalRemarks"
                    type="text"
                    value={removalRemarks}
                    onChange={(e) => setRemovalRemarks(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRemovingTyreId(null)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
                  >
                    Confirm Dismount
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ACTION 3: SELL DIALOG MODLET */}
      {sellingTyreId && (() => {
        const tyre = tyres.find(t => t.id === sellingTyreId);
        if (!tyre) return null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-amber-600 animate-pulse" /> Sale Accounting parameters
                </h3>
                <button onClick={() => setSellingTyreId(null)} className="text-slate-400 text-lg hover:text-slate-600">&times;</button>
              </div>

              <form onSubmit={handleSellSubmit} className="space-y-3.5 text-xs">
                <div>
                  <span className="text-slate-400">Merchant Tyre Serial:</span>
                  <span className="font-mono font-bold text-slate-800 block mt-0.5">{tyre.tyreNo} ({tyre.manufacturer})</span>
                </div>

                <div>
                  <label htmlFor="saleDate" className="block text-[10px] uppercase font-bold text-slate-550 mb-1">Sale Date <span className="text-red-500">*</span></label>
                  <input
                    id="saleDate"
                    type="date"
                    required
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="saleAmount" className="block text-[10px] uppercase font-bold text-slate-550 mb-1">Sale Invoice Amount (₹) <span className="text-red-500">*</span></label>
                  <input
                    id="saleAmount"
                    type="number"
                    required
                    placeholder="e.g. 12000"
                    value={saleAmount}
                    onChange={(e) => setSaleAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white font-mono font-bold"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSellingTyreId(null)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold"
                  >
                    Record Sale Voucher
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ACTION 4: SCRAP DIALOG MODLET */}
      {scrappingTyreId && (() => {
        const tyre = tyres.find(t => t.id === scrappingTyreId);
        if (!tyre) return null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1 text-rose-600">
                  <XCircle className="w-4 h-4" /> Decommission & Recycle Tyre
                </h3>
                <button onClick={() => setScrappingTyreId(null)} className="text-slate-400 text-lg hover:text-slate-600">&times;</button>
              </div>

              <form onSubmit={handleScrapSubmit} className="space-y-3.5 text-xs">
                <p className="text-[11px] text-slate-450 italic bg-rose-50 border border-rose-100 p-2 rounded text-rose-800">
                  You are decommissioning tyre <b>{tyre.tyreNo}</b>. This will permanently lock its status to Scrapped/Recycled. No further vehicle mount operation is permitted.
                </p>

                <div>
                  <label htmlFor="scrapDate" className="block text-[10px] uppercase font-bold text-slate-550 mb-1">Scrapping Date <span className="text-red-500">*</span></label>
                  <input
                    id="scrapDate"
                    type="date"
                    required
                    value={scrapDate}
                    onChange={(e) => setScrapDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setScrappingTyreId(null)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold"
                  >
                    Decommission
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL 5: DETAILED HISTORICAL MOVEMENT LOG DRAWER */}
      {viewHistoryTyreId && (() => {
        const tyre = tyres.find(t => t.id === viewHistoryTyreId);
        if (!tyre) return null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-150 pb-2.5">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest block">{tyre.manufacturer} ODO Ledger</span>
                  <h3 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase flex items-center gap-1">
                    <History className="w-4 h-4 text-blue-600" /> movement trail: {tyre.tyreNo}
                  </h3>
                </div>
                <button onClick={() => setViewHistoryTyreId(null)} className="text-slate-400 text-lg hover:text-slate-600">&times;</button>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {tyre.movementHistory.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6 italic">No movements recorded. Newly purchased item.</p>
                ) : (
                  <div className="relative border-l-2 border-slate-150 pl-4 ml-2.5 space-y-4 text-xs">
                    {tyre.movementHistory.map((log, idx) => (
                      <div key={log.id || idx} className="relative">
                        
                        {/* Circle bullet identifier */}
                        <span className={`absolute -left-[24.5px] top-1 h-3.5 w-3.5 rounded-full border-2 bg-white flex items-center justify-center ${
                          log.action === 'Installed' ? 'border-emerald-500' :
                          log.action === 'Removed' ? 'border-blue-500' :
                          log.action === 'Sold' ? 'border-amber-500' :
                          'border-rose-500'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            log.action === 'Installed' ? 'bg-emerald-500' :
                            log.action === 'Removed' ? 'bg-blue-500' :
                            log.action === 'Sold' ? 'bg-amber-500' :
                            'bg-rose-500'
                          }`} />
                        </span>

                        <div>
                          <div className="flex justify-between items-center">
                            <span className="font-extrabold text-slate-800 tracking-tight">{log.action}</span>
                            <span className="text-[10px] font-mono text-slate-400">{log.date}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 font-semibold leading-relaxed">
                            {log.remarks}
                          </p>
                          {log.odometerKM !== undefined && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-mono text-slate-600">
                              Vehicle ODO: {log.odometerKM.toLocaleString()} KM
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-150 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <span>Odometer wear life: <b>{tyre.accumulatedKM.toLocaleString()} KM</b></span>
                <button
                  onClick={() => setViewHistoryTyreId(null)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-bold font-sans cursor-pointer"
                >
                  Close logs
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
