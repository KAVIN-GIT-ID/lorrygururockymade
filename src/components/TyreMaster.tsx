import { createSignal, createEffect, mergeProps } from 'solid-js';
import { useTripsContext } from '../context/TripContext';
import { useTrucksContext } from '../context/TruckContext';
import { useDriversContext } from '../context/DriverContext';
import { useExpensesContext } from '../context/ExpenseContext';
import { useOfficesContext } from '../context/OfficeContext';
import { useAccountsContext } from '../context/AccountContext';
import { useTyresContext } from '../context/TyreContext';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';

import { Tyre, Truck, TyreMovementLog, TyreStatus, Account, OrganizationProfile } from '../types';
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
  Tag, X, MoreVertical,
  Edit2
} from 'lucide-solid';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

interface TyreMasterProps {
  showNotification?: (msg: string) => void;
  logAction?: (action: string, details?: any) => void;
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
  autoOpenAdd?: boolean;
  onAutoOpenCleared?: () => void;
  orgProfile?: OrganizationProfile;
  onSaveExpenses?: (newExpenses: any[]) => void;
}

export default function TyreMaster(rawProps: TyreMasterProps) {
  const tyreCtx = useTyresContext();
  const trucksCtx = useTrucksContext();
  const driversCtx = useDriversContext();
  const permissionCtx = usePermissions();
  const expenseCtx = useExpensesContext();

  const props = mergeProps(rawProps, {
    get tyres() { return tyreCtx.orgTyres(); },
    get expenses() { return expenseCtx.orgExpenses(); },
    get trucks() { return trucksCtx.orgTrucks(); },
    get drivers() { return driversCtx.orgDrivers(); },
    onSaveExpenses: expenseCtx.saveExpenses,
    onAddTyre: tyreCtx.addTyre,
    onUpdateTyre: tyreCtx.updateTyre,
    onDeleteTyre: tyreCtx.deleteTyre,
    showNotification: rawProps.showNotification,
    logAction: rawProps.logAction,
    confirmAction: rawProps.confirmAction,
    orgProfile: rawProps.orgProfile,
    autoOpenAdd: rawProps.autoOpenAdd,
    onAutoOpenCleared: rawProps.onAutoOpenCleared,
    get accounts() { return rawProps.accounts || []; },
    
    get canViewTyres() { return permissionCtx.currentUserRights().canViewTyres; },
    get canEditTyres() { return permissionCtx.currentUserRights().canEditTyres; },
    get canDeleteTyres() { return permissionCtx.currentUserRights().canDeleteTyres; },
    get organizationId() { return permissionCtx.currentUserOrgId(); }
  });
  const {
    tyres,
    expenses,
    onSaveExpenses,
    showNotification,
    logAction,
    onAddTyre,
    onUpdateTyre,
    onDeleteTyre,
    confirmAction,
    canViewTyres,
    canEditTyres,
    canDeleteTyres,
    trucks,
    drivers,
    orgProfile,
    organizationId,
    autoOpenAdd,
    onAutoOpenCleared,
    accounts
  } = props;


  const [showAddForm, setShowAddForm] = createSignal(false);
  const [activeSpeedDialId, setActiveSpeedDialId] = createSignal<string | null>(null);

  createEffect(() => {
    if (autoOpenAdd) {
      resetAddForm();
      setShowAddForm(true);
      if (onAutoOpenCleared) {
        onAutoOpenCleared();
      }
    }
  });

  const [tyreNo, setTyreNo] = createSignal('');
  const [manufacturer, setManufacturer] = createSignal('');
  const [size, setSize] = createSignal('10.00R20');
  const [purchaseDate, setPurchaseDate] = createSignal('2026-05-23');
  const [purchaseAmount, setPurchaseAmount] = createSignal('');
  const [editingTyreId, setEditingTyreId] = createSignal<string | null>(null);

  // Auto expense ledger states
  const [associatedTruckNo, setAssociatedTruckNo] = createSignal('');
  const [paymentMode, setPaymentMode] = createSignal('');
  const [createExpense, setCreateExpense] = createSignal(true);
  const [mountDirectly, setMountDirectly] = createSignal(false);
  const [initialOdoKM, setInitialOdoKM] = createSignal('');
  const [truckSearchQuery, setTruckSearchQuery] = createSignal('');
  const [isTruckDropdownOpen, setIsTruckDropdownOpen] = createSignal(false);

  // Status Filter
  const [statusFilter, setStatusFilter] = createSignal<string>('');
  const [searchQuery, setSearchQuery] = createSignal('');

  // Action states
  const [mountingTyreId, setMountingTyreId] = createSignal<string | null>(null);
  const [selectedTruckId, setSelectedTruckId] = createSignal('');
  const [mountingKM, setMountingKM] = createSignal('');
  const [mountingDate, setMountingDate] = createSignal('2026-05-23');
  const [mountTruckSearchQuery, setMountTruckSearchQuery] = createSignal('');
  const [isMountTruckDropdownOpen, setIsMountTruckDropdownOpen] = createSignal(false);

  const [removingTyreId, setRemovingTyreId] = createSignal<string | null>(null);
  const [removalKM, setRemovalKM] = createSignal('');
  const [removalDate, setRemovalDate] = createSignal('2026-05-23');
  const [removalRemarks, setRemovalRemarks] = createSignal('Routine Rotation');

  const [sellingTyreId, setSellingTyreId] = createSignal<string | null>(null);
  const [saleAmount, setSaleAmount] = createSignal('');
  const [saleDate, setSaleDate] = createSignal('2026-05-23');

  const [scrappingTyreId, setScrappingTyreId] = createSignal<string | null>(null);
  const [scrapDate, setScrapDate] = createSignal('2026-05-23');

  const [viewHistoryTyreId, setViewHistoryTyreId] = createSignal<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(12);
  const [displayedTyres, setDisplayedTyres] = createSignal<Tyre[]>([]);
  const [totalCount, setTotalCount] = createSignal(0);
  const [loading, setLoading] = createSignal(false);

  const online = isAppwriteConfigured();

  // Reset page to 1 when filters change
  createEffect(() => {
    setCurrentPage(1);
  });

  // Offline / local logic fallback
  createEffect(() => {
    if (!online) {
      const filtered = tyres.filter(tyre => {
        const matchesStatus = statusFilter() ? tyre.status === statusFilter() : true;
        const matchesSearch = searchQuery() 
          ? tyre.tyreNo.toLowerCase().includes(searchQuery().toLowerCase()) || 
            tyre.manufacturer.toLowerCase().includes(searchQuery().toLowerCase()) ||
            (tyre.currentTruckNo && tyre.currentTruckNo.toLowerCase().includes(searchQuery().toLowerCase()))
          : true;
        return matchesStatus && matchesSearch;
      });

      setTotalCount(filtered.length);
      const startIdx = (currentPage() - 1) * pageSize();
      setDisplayedTyres(filtered.slice(startIdx, startIdx + pageSize()));
    }
  });

  // Online Appwrite logic
  createEffect(() => {
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
              search: searchQuery() || undefined,
              status: statusFilter() || undefined
            },
            currentPage(),
            pageSize()
          );

          const mapped = (res.documents || []).map(doc => appwrite.reconstructRecord(doc));
          
          // Get locally filtered tyres
          const localFiltered = tyres.filter(tyre => {
            const matchesStatus = statusFilter() ? tyre.status === statusFilter() : true;
            const matchesSearch = searchQuery() 
              ? tyre.tyreNo.toLowerCase().includes(searchQuery().toLowerCase()) || 
                tyre.manufacturer.toLowerCase().includes(searchQuery().toLowerCase()) ||
                (tyre.currentTruckNo && tyre.currentTruckNo.toLowerCase().includes(searchQuery().toLowerCase()))
              : true;
            return matchesStatus && matchesSearch;
          });

          if (mapped.length === 0 && localFiltered.length > 0) {
            setDisplayedTyres(localFiltered.slice((currentPage() - 1) * pageSize(), (currentPage() - 1) * pageSize() + pageSize()));
            setTotalCount(localFiltered.length);
          } else {
            // Find local tyres not yet present in the server response
            const missingLocal = localFiltered.filter(lt => !mapped.some(mt => mt.id === lt.id || mt.tyreNo === lt.tyreNo));
            if (missingLocal.length > 0) {
              const combined = [...mapped, ...missingLocal];
              setDisplayedTyres(combined.slice(0, pageSize()));
              setTotalCount((res.total || 0) + missingLocal.length);
            } else {
              setDisplayedTyres(mapped);
              setTotalCount(res.total || 0);
            }
          }
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
  });

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
    setEditingTyreId(null);
  };

  const handleCreateTyre = (e: Event) => {
    e.preventDefault();
    if (!tyreNo().trim() || !manufacturer()) return;

    if (editingTyreId()) {
      const orig = tyres.find(t => t.id === editingTyreId());
      if (orig) {
        onUpdateTyre({
          ...orig,
          tyreNo: tyreNo().trim().toUpperCase(),
          manufacturer: manufacturer(),
          size: size(),
          purchaseDate: purchaseDate() || undefined,
          purchaseAmount: purchaseAmount() ? Number(purchaseAmount()) : undefined
        });
      }
      resetAddForm();
      setShowAddForm(false);
      return;
    }

    const todayStr = new Date().toISOString().substring(0, 10);
    const selectedTruck = trucks.find(t => t.truckNo === associatedTruckNo());
    if (selectedTruck) {
      const isExpired = selectedTruck.registrationExpiryDate ? selectedTruck.registrationExpiryDate < todayStr : false;
      const isAdminDisabled = selectedTruck.status === 'Admin Disabled';
      const isNotApproved = selectedTruck.isApproved === false || selectedTruck.requestStatus === 'Rejected';
      if (isExpired || isAdminDisabled || isNotApproved) {
        let reason = "expired";
        if (isAdminDisabled) reason = "admin disabled";
        else if (isNotApproved) reason = "not approved";
        alert(`Cannot register tyre: Selected truck ${associatedTruckNo()} is ${reason}.`);
        return;
      }
    }

    const isMounted = mountDirectly() && associatedTruckNo();

    onAddTyre(
      {
        tyreNo: tyreNo().trim().toUpperCase(),
        manufacturer: manufacturer(),
        size: size(),
        status: isMounted ? 'Active' : 'Available',
        currentTruckNo: isMounted ? associatedTruckNo() : undefined,
        installationDate: isMounted ? purchaseDate() : undefined,
        installationKM: isMounted ? (initialOdoKM() ? Number(initialOdoKM()) : undefined) : undefined,
        purchaseDate: purchaseDate() || undefined,
        purchaseAmount: purchaseAmount() ? Number(purchaseAmount()) : undefined
      },
      {
        createExpense: createExpense() && !!purchaseAmount(),
        truckNo: associatedTruckNo() || 'YARD / WH',
        paymentMode: paymentMode() || 'Cash'
      }
    );

    resetAddForm();
    setShowAddForm(false);
  };

  const startEdit = (tyre: Tyre) => {
    setEditingTyreId(tyre.id);
    setTyreNo(tyre.tyreNo);
    setManufacturer(tyre.manufacturer);
    setSize(tyre.size || '10.00R20');
    setPurchaseDate(tyre.purchaseDate || '2026-05-23');
    setPurchaseAmount(tyre.purchaseAmount ? tyre.purchaseAmount.toString() : '');
    setShowAddForm(true);
  };

  const startMounting = (tyre: Tyre) => {
    setMountingTyreId(tyre.id);
    setSelectedTruckId('');
    setMountingKM('');
    setMountingDate('2026-05-23');
  };

  const handleMountSubmit = (e: Event) => {
    e.preventDefault();
    const tyre = tyres.find(t => t.id === mountingTyreId());
    if (!tyre || !selectedTruckId() || !mountingKM()) return;

    const truck = trucks.find(tr => tr.id === selectedTruckId());
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

    const parsedKM = Number(mountingKM());
    const newLog: TyreMovementLog = {
      id: 'mvt_' + Date.now(),
      action: 'Installed',
      truckNo: truck.truckNo,
      date: mountingDate(),
      odometerKM: parsedKM,
      remarks: `Mounted on Vehicle ${truck.truckNo} at odometer ${parsedKM} KM`
    };

    const updatedTyre: Tyre = {
      ...tyre,
      status: 'Active',
      currentTruckNo: truck.truckNo,
      installationDate: mountingDate(),
      installationKM: parsedKM,
      movementHistory: [newLog, ...(tyre.movementHistory || [])]
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

  const handleRemovalSubmit = (e: Event) => {
    e.preventDefault();
    const tyre = tyres.find(t => t.id === removingTyreId());
    if (!tyre || !removalKM()) return;

    const parsedRemovalKM = Number(removalKM());
    const installKM = tyre.installationKM || 0;
    const runMileage = Math.max(0, parsedRemovalKM - installKM);

    const newLog: TyreMovementLog = {
      id: 'mvt_' + Date.now(),
      action: 'Removed',
      truckNo: tyre.currentTruckNo,
      date: removalDate(),
      odometerKM: parsedRemovalKM,
      remarks: `${removalRemarks()} (Displacement run mileage: ${runMileage} KM)`
    };

    const updatedTyre: Tyre = {
      ...tyre,
      status: 'Available',
      currentTruckNo: undefined,
      installationDate: undefined,
      installationKM: undefined,
      accumulatedKM: (tyre.accumulatedKM || 0) + runMileage,
      movementHistory: [newLog, ...(tyre.movementHistory || [])]
    };

    onUpdateTyre(updatedTyre);
    setRemovingTyreId(null);
  };

  const startSelling = (tyre: Tyre) => {
    setSellingTyreId(tyre.id);
    setSaleAmount('');
    setSaleDate('2026-05-23');
  };

  const handleSellSubmit = (e: Event) => {
    e.preventDefault();
    const tyre = tyres.find(t => t.id === sellingTyreId());
    if (!tyre || !saleAmount()) return;

    const newLog: TyreMovementLog = {
      id: 'mvt_' + Date.now(),
      action: 'Sold',
      date: saleDate(),
      remarks: `Sold for ₹${Number(saleAmount()).toLocaleString()}`
    };

    const updatedTyre: Tyre = {
      ...tyre,
      status: 'Sold',
  saleDate: saleDate(),
      saleAmount: Number(saleAmount()),
      movementHistory: [newLog, ...(tyre.movementHistory || [])]
    };

    onUpdateTyre(updatedTyre);
    setSellingTyreId(null);
  };

  const startScrapping = (tyre: Tyre) => {
    setScrappingTyreId(tyre.id);
    setScrapDate('2026-05-23');
  };

  const handleScrapSubmit = (e: Event) => {
    e.preventDefault();
    const tyre = tyres.find(t => t.id === scrappingTyreId());
    if (!tyre) return;

    const newLog: TyreMovementLog = {
      id: 'mvt_' + Date.now(),
      action: 'Scrapped',
      date: scrapDate(),
      remarks: 'Decommissioned / Recycled due to heavy wear & bald treads'
    };

    const updatedTyre: Tyre = {
      ...tyre,
      status: 'Scrapped',
      movementHistory: [newLog, ...(tyre.movementHistory || [])]
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
    const matchesStatus = statusFilter() ? tyre.status === statusFilter() : true;
    const matchesSearch = searchQuery() 
      ? tyre.tyreNo.toLowerCase().includes(searchQuery().toLowerCase()) || 
        tyre.manufacturer.toLowerCase().includes(searchQuery().toLowerCase()) ||
        (tyre.currentTruckNo && tyre.currentTruckNo.toLowerCase().includes(searchQuery().toLowerCase()))
      : true;
    return matchesStatus && matchesSearch;
  });

  return (
    <div id="tyre-tracker-panel" class="space-y-6">
      
      {/* Search and Action Bar */}
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-3xs">
        <div class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="relative">
            <input
              type="text"
              placeholder="Search Serial No / Manufacturer / Truck..."
              value={searchQuery()}
              onChange={(e) => setSearchQuery(e.target.value)}
              class="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg pl-3 pr-2 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
          <div>
            <select
              aria-label="Status Filter"
              value={statusFilter()}
              onChange={(e) => setStatusFilter(e.target.value)}
              class="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">-- All Statuses --</option>
              <option value="Available">Available (In Yard Warehouse)</option>
              <option value="Active">Active (Mounted on Truck)</option>
              <option value="Sold">Sold (Disposed Account)</option>
              <option value="Scrapped">Scrapped (Bald Tires Recycle)</option>
            </select>
          </div>
          <div class="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>Filtered: <b>{totalCount()} Tyres</b></span>
            {loading() && <span class="inline-block w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin ml-1.5 align-middle"></span>}
          </div>
        </div>

        {canEditTyres && (
          <button
            id="btn-add-tyre"
            onClick={() => {
              resetAddForm();
              setShowAddForm(!showAddForm());
            }}
            class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-150 shadow-sm text-xs cursor-pointer self-start md:self-auto"
          >
            {showAddForm() ? 'Close panel' : (
              <>
                <Plus class="w-3.5 h-3.5" /> Register New Tyre
              </>
            )}
          </button>
        )}
      </div>

      {showAddForm() && (
        <div class="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 backdrop-blur-xs p-4 overflow-y-auto py-8 animate-fade-in" id="tyre-form-backdrop">
          <form id="tyre-form" onSubmit={handleCreateTyre} class="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto text-left my-auto">
            <div class="flex justify-between items-center border-b border-slate-200 dark:border-slate-850 pb-3">
              <div class="flex items-center gap-2">
                <Compass class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 class="text-sm font-bold text-slate-805 dark:text-white tracking-wide">
                  {editingTyreId() ? 'Edit Purchase Specification' : 'Register New Purchase Specification'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  resetAddForm();
                  setShowAddForm(false);
                }}
                class="p-1.5 hover:bg-slate-105 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 rounded-xl transition cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label for="tyreNo" class="block text-[10px] font-bold text-slate-655 uppercase mb-1">Tyre Serial No <span class="text-red-500">*</span></label>
                <input
                  id="tyreNo"
                  type="text"
                  required
                  placeholder="e.g. MRF-102948"
                  value={tyreNo()}
                  onChange={(e) => setTyreNo(e.target.value)}
                  class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono font-bold"
                />
              </div>
              <div>
                <label for="manufacturer" class="block text-[10px] font-bold text-slate-655 uppercase mb-1">Manufacturer <span class="text-red-500">*</span></label>
                <select
                  id="manufacturer"
                  required
                  value={manufacturer()}
                  onChange={(e) => setManufacturer(e.target.value)}
                  class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
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
                <label for="tyreSize" class="block text-[10px] font-bold text-slate-655 uppercase mb-1">Tyre Size Dimension</label>
                <input
                  id="tyreSize"
                  type="text"
                  placeholder="e.g. 10.00R20, 295/85R22.5"
                  value={size()}
                  onChange={(e) => setSize(e.target.value)}
                  class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label for="purchaseDate" class="block text-[10px] font-bold text-slate-655 uppercase mb-1">Purchase Date</label>
                <input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate()}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none "
                />
              </div>
              <div>
                <label for="purchaseAmount" class="block text-[10px] font-bold text-slate-655 uppercase mb-1">Purchase Amount (₹)</label>
                <input
                  id="purchaseAmount"
                  type="number"
                  placeholder="e.g. 24000"
                  value={purchaseAmount()}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-805 dark:text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono font-bold"
                />
              </div>
            </div>

            {/* Supplementary integration section for Auto Ledger */}
            {!editingTyreId() && (
              <div class="bg-blue-50/50 border border-blue-100 rounded-lg p-3.5 space-y-3.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <Tag class="w-3.5 h-3.5 text-blue-600" />
                  <h4 class="text-xs font-bold text-slate-750">Financial Ledger & Vehicle Allocation</h4>
                </div>
                <p class="text-[10px] text-slate-500 italic">Automatically posts transaction vouchers to your ledger</p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="relative">
                <label class="block text-[10px] font-bold text-slate-655 uppercase mb-1">Allocate Expense to</label>
                <button
                  type="button"
                  onClick={() => setIsTruckDropdownOpen(!isTruckDropdownOpen())}
                  class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2.5 py-1.5 text-xs text-left focus:outline-none focus:border-blue-500 flex justify-between items-center cursor-pointer font-semibold"
                >
                  <span>{associatedTruckNo() ? `Vehicle: ${associatedTruckNo()}` : 'YARD / STOCK (General Warehouse)'}</span>
                  <span class="text-slate-400">▼</span>
                </button>
                {isTruckDropdownOpen() && (
                  <div class="absolute z-20 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 space-y-2">
                    <input
                      type="text"
                      placeholder="Type to search truck..."
                      value={truckSearchQuery()}
                      onChange={(e) => setTruckSearchQuery(e.target.value)}
                      class="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-805 dark:text-white rounded-md px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                      autofocus
                    />
                    <div class="max-h-48 overflow-y-auto divide-y divide-slate-105 dark:divide-slate-750">
                      <button
                        type="button"
                        onClick={() => {
                          setAssociatedTruckNo('');
                          setMountDirectly(false);
                          setIsTruckDropdownOpen(false);
                          setTruckSearchQuery('');
                        }}
                        class="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold block cursor-pointer"
                      >
                        YARD / STOCK (General Warehouse)
                      </button>
                      {trucks
                        .filter(tk => tk.truckNo.toLowerCase().includes(truckSearchQuery().toLowerCase()))
                        .map(tk => {
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
                            <button
                              
                              type="button"
                              disabled={isBlocked}
                              onClick={() => {
                                setAssociatedTruckNo(tk.truckNo);
                                setIsTruckDropdownOpen(false);
                                setTruckSearchQuery('');
                              }}
                              class={`w-full text-left px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 block font-mono cursor-pointer ${
                                isBlocked ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300 font-bold'
                              }`}
                            >
                              Vehicle: {tk.truckNo}{labelSuffix}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

                <div>
                  <label for="paymentMode" class="block text-[10px] font-bold text-slate-655 uppercase mb-1">Paid From Ledger Account</label>
                  <select
                    id="paymentMode"
                    value={paymentMode()}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Cash Account</option>
                    {accounts.map(ac => (
                      <option  value={ac.accountName}>{ac.accountName} ({ac.type})</option>
                    ))}
                  </select>
                </div>

                <div class="flex flex-col justify-center">
                  <label for="createExpense" class="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      id="createExpense"
                      type="checkbox"
                      checked={createExpense()}
                      onChange={(e) => setCreateExpense(e.target.checked)}
                      disabled={!purchaseAmount()}
                      class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <div class="text-xs font-semibold text-slate-700">
                      Post to Expense Ledger
                      {!purchaseAmount() && <span class="block text-[10px] font-normal text-slate-400 font-mono"> (Enter purchase price first)</span>}
                    </div>
                  </label>
                </div>

                {associatedTruckNo() && (
                  <div class="flex flex-col justify-center border-l sm:border-l-0 lg:border-l border-slate-200 pl-0 lg:pl-4">
                    <label for="mountDirectly" class="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        id="mountDirectly"
                        type="checkbox"
                        checked={mountDirectly()}
                        onChange={(e) => setMountDirectly(e.target.checked)}
                        class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <div class="text-xs font-semibold text-slate-700">
                        Mount immediately on {associatedTruckNo()}
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {mountDirectly() && associatedTruckNo() && (
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 animate-fade-in">
                  <div>
                    <label for="initialOdoKM" class="block text-[10px] font-bold text-slate-655 uppercase mb-1">
                      Installation Odometer Reading (KM) <span class="text-red-500">*</span>
                    </label>
                    <input
                      id="initialOdoKM"
                      type="number"
                      required={mountDirectly()}
                      placeholder={`Current Vehicle KM: ${trucks.find(t => t.truckNo === associatedTruckNo())?.currentKM || 0}`}
                      value={initialOdoKM()}
                      onChange={(e) => setInitialOdoKM(e.target.value)}
                      class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div class="flex items-end pl-1 pb-1">
                    <p class="text-[11px] text-slate-500">
                      The tyre status will auto-transition to <b class="text-emerald-600 font-bold">Active</b> and a mounting log at {initialOdoKM() || '0'} KM will be written in movement history.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

            <div class="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 pt-4 col-span-full">
              <button
                type="button"
                onClick={resetAddForm}
                class="px-4 py-1.5 bg-slate-200 hover:bg-slate-250 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Reset
              </button>
              <button
                type="submit"
                class="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {editingTyreId() ? 'Save Changes' : 'Add Tyre record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid display list */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayedTyres().length === 0 ? (
          <div class="col-span-full bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 italic">
            No tyres mapped with current filter. Please select "All Statuses" or register a new Tyre purchase.
          </div>
        ) : (
          displayedTyres().map(tyre => {
            const activeRunKM = calculateActiveKM(tyre);
            const overallKM = (tyre.accumulatedKM || 0) + activeRunKM;
            const relatedTruck = trucks.find(tk => tk.truckNo === tyre.currentTruckNo);

            return (
              <div  class="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs flex flex-col justify-between hover:border-blue-300 transition-colors relative overflow-hidden group">
                
                {/* Decorative border bar based on status */}
                <div class={`absolute top-0 left-0 right-0 h-1 ${
                  tyre.status === 'Active' ? 'bg-emerald-500' :
                  tyre.status === 'Available' ? 'bg-blue-500' :
                  tyre.status === 'Sold' ? 'bg-amber-500' :
                  'bg-rose-500'
                }`} />

                {/* Card Top Information */}
                <div class="space-y-3">
                  <div class="flex justify-between items-start pr-8">
                    <div>
                      <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{tyre.manufacturer}</span>
                      <h4 class="text-sm font-extrabold text-slate-850 font-mono tracking-wider flex items-center gap-1.5 mt-0.5">
                        <Tag class="w-3.5 h-3.5 text-slate-400" />
                        {tyre.tyreNo}
                      </h4>
                    </div>

                    <div class="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span class={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                        tyre.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        tyre.status === 'Available' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        tyre.status === 'Sold' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {tyre.status}
                      </span>
                    </div>
                  </div>

                  {/* Operational Location Badge */}
                  <div class="bg-slate-50/80 p-2.5 rounded-lg border border-slate-150 text-xs">
                    {tyre.status === 'Active' && tyre.currentTruckNo ? (
                      <div class="space-y-1">
                        <div class="flex justify-between">
                          <span class="text-slate-500 font-semibold flex items-center gap-1">
                            <TruckIcon class="w-3.5 h-3.5 text-emerald-600" /> Mounted vehicle:
                          </span>
                          <span class="font-mono font-bold text-slate-900 text-xs uppercase underline">
                            {tyre.currentTruckNo}
                          </span>
                        </div>
                        <div class="grid grid-cols-2 text-[10px] text-slate-450 pt-1 border-t border-slate-100">
                          <div>Mount ODO: <b class="text-slate-600 font-mono">{tyre.installationKM?.toLocaleString()} KM</b></div>
                          <div class="text-right">Current: <b class="text-slate-600 font-mono">{relatedTruck?.currentKM?.toLocaleString()} KM</b></div>
                        </div>
                      </div>
                    ) : tyre.status === 'Available' ? (
                      <div class="flex justify-between items-center text-blue-800">
                        <span class="font-semibold flex items-center gap-1">
                          <Layers class="w-3.5 h-3.5 text-blue-600 animate-pulse" /> Asset Location:
                        </span>
                        <span>Yard Warehouse Stock</span>
                      </div>
                    ) : tyre.status === 'Sold' ? (
                      <div>
                        <div class="flex justify-between text-amber-700">
                          <span>Sold parameters:</span>
                          <b class="font-mono">₹{tyre.saleAmount?.toLocaleString()}</b>
                        </div>
                        {tyre.saleDate && <div class="text-[10px] text-slate-450 text-right mt-0.5">Date: {tyre.saleDate}</div>}
                      </div>
                    ) : (
                      <div class="text-rose-700 font-semibold">
                        Scrapped due to bald treads / End of service life.
                      </div>
                    )}
                  </div>

                  {/* Odo mileage tracking bar */}
                  <div class="space-y-1 pt-1">
                    <div class="flex justify-between text-[11px] font-bold">
                      <span class="text-slate-500">Accycled Lifespan Milestones:</span>
                      <span class="font-mono text-slate-850 text-xs font-black">{overallKM.toLocaleString()} KM</span>
                    </div>

                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        class={`h-full transition-all duration-500 ${
                          overallKM > 75000 ? 'bg-rose-500' :
                          overallKM > 50000 ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, (overallKM / 100000) * 100)}%` }}
                      />
                    </div>

                    <div class="flex justify-between text-[9px] text-slate-450 font-mono pt-0.5">
                      <span>0 KM</span>
                      {tyre.status === 'Active' && activeRunKM > 0 && (
                        <span>Current Run: {activeRunKM.toLocaleString()} KM</span>
                      )}
                      <span>Life cap 100K KM</span>
                    </div>
                  </div>

                  {/* Attributes detail grid */}
                  <div class="grid grid-cols-2 gap-2 text-[10px] bg-slate-50/30 p-2 rounded-lg text-slate-500">
                    <div>Size: <b class="text-slate-700 font-mono">{tyre.size || '10.00R20'}</b></div>
                    <div>Purchase Date: <b class="text-slate-705 font-mono">{tyre.purchaseDate || '—'}</b></div>
                    <div class="col-span-2 border-t border-slate-100 pt-1 mt-1">
                      Purchase Cost: <b class="text-slate-700 font-mono">{tyre.purchaseAmount ? `₹${tyre.purchaseAmount.toLocaleString()}` : '—'}</b>
                    </div>
                  </div>

                </div>

                {/* Cards Bottom Actions */}
                <div class="pt-4 border-t border-slate-100 mt-4 hidden md:flex justify-between items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setViewHistoryTyreId(tyre.id)}
                    class="text-[10px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition"
                    title="View movement ledger"
                  >
                    <History class="w-3.5 h-3.5" />
                    <span>Logs ({(tyre.movementHistory || []).length})</span>
                  </button>

                  <div class="flex items-center gap-1">
                    {canEditTyres && (
                      <button
                        onClick={() => startEdit(tyre)}
                        class="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px] font-bold cursor-pointer transition"
                      >
                        Edit
                      </button>
                    )}
                    {canEditTyres && tyre.status === 'Available' && (
                      <>
                        <button
                          onClick={() => startMounting(tyre)}
                          class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded text-[10px] font-bold cursor-pointer transition"
                        >
                          Mount
                        </button>
                        <button
                          onClick={() => startSelling(tyre)}
                          class="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded text-[10px] font-bold cursor-pointer transition"
                        >
                          Sell tyre
                        </button>
                        <button
                          onClick={() => startScrapping(tyre)}
                          class="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded text-[10px] font-bold cursor-pointer transition"
                        >
                          Scrap
                        </button>
                      </>
                    )}

                    {canEditTyres && tyre.status === 'Active' && (
                      <button
                        onClick={() => startRemoving(tyre)}
                        class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded text-[10px] font-bold cursor-pointer transition uppercase tracking-wider"
                      >
                        Dismount
                      </button>
                    )}

                    {/* Delete option only if available & no extensive movement logs for clean protection */}
                    {canDeleteTyres && tyre.status === 'Available' && (tyre.movementHistory || []).length <= 1 && (
                      <button
                        onClick={() => {
                          const msg = `Are you sure you want to delete Tyre record ${tyre.tyreNo}?`;
                          if (confirmAction) {
                            confirmAction(msg, () => onDeleteTyre(tyre.id), "Delete Tyre Ledger Record");
                          } else if (confirm(msg)) {
                            onDeleteTyre(tyre.id);
                          }
                        }}
                        class="p-1 text-slate-355 text-slate-350 hover:text-red-500 rounded transition cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Micro-FAB Speed Dial */}
                <div class="md:hidden absolute top-3 right-3 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <div class={`flex items-center gap-1.5 bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-full p-1 pl-2.5 pr-1.5 shadow-md transition-all duration-300 ease-out origin-right transform whitespace-nowrap ${
                    activeSpeedDialId() === tyre.id 
                      ? 'opacity-100 scale-100 translate-x-0 pointer-events-auto' 
                      : 'opacity-0 scale-90 translate-x-2 pointer-events-none'
                  }`}>
                    <button
                      type="button"
                      onClick={() => {
                        setViewHistoryTyreId(tyre.id);
                        setActiveSpeedDialId(null);
                      }}
                      class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
                      title={`Logs (${(tyre.movementHistory || []).length})`}
                    >
                      <History class="w-3.5 h-3.5" />
                    </button>

                    {canEditTyres && (
                      <button
                        type="button"
                        onClick={() => {
                          startEdit(tyre);
                          setActiveSpeedDialId(null);
                        }}
                        class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-350 hover:bg-slate-50 transition cursor-pointer"
                        title="Edit Spec"
                      >
                        <Edit2 class="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canEditTyres && tyre.status === 'Available' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            startMounting(tyre);
                            setActiveSpeedDialId(null);
                          }}
                          class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-emerald-600 hover:bg-slate-50 transition cursor-pointer"
                          title="Mount"
                        >
                          <TruckIcon class="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            startSelling(tyre);
                            setActiveSpeedDialId(null);
                          }}
                          class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-amber-600 hover:bg-slate-50 transition cursor-pointer"
                          title="Sell tyre"
                        >
                          <DollarSign class="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            startScrapping(tyre);
                            setActiveSpeedDialId(null);
                          }}
                          class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-rose-600 hover:bg-slate-50 transition cursor-pointer"
                          title="Scrap"
                        >
                          <Wrench class="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {canEditTyres && tyre.status === 'Active' && (
                      <button
                        type="button"
                        onClick={() => {
                          startRemoving(tyre);
                          setActiveSpeedDialId(null);
                        }}
                        class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 hover:bg-slate-50 transition cursor-pointer"
                        title="Dismount"
                      >
                        <Layers class="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canDeleteTyres && tyre.status === 'Available' && (tyre.movementHistory || []).length <= 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const msg = `Are you sure you want to delete Tyre record ${tyre.tyreNo}?`;
                          if (confirmAction) {
                            confirmAction(msg, () => onDeleteTyre(tyre.id), "Delete Tyre Ledger Record");
                          } else if (confirm(msg)) {
                            onDeleteTyre(tyre.id);
                          }
                          setActiveSpeedDialId(null);
                        }}
                        class="w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-955/20 border border-rose-150 dark:border-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-455 hover:bg-rose-100/30 transition cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSpeedDialId(activeSpeedDialId() === tyre.id ? null : tyre.id)}
                    class="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95 cursor-pointer hover:bg-slate-850 dark:hover:bg-slate-200"
                  >
                    {activeSpeedDialId() === tyre.id ? (
                      <X class="w-4 h-4 transition-transform duration-300 rotate-90" />
                    ) : (
                      <Settings class="w-4 h-4 transition-transform duration-300" />
                    )}
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* PAGINATION FOOTER */}
      <div class="bg-white border border-slate-200 rounded-xl p-4 mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs no-print">
        <div class="text-slate-500 font-medium">
          Showing <strong class="text-slate-800">{totalCount() > 0 ? (currentPage() - 1) * pageSize() + 1 : 0}</strong> to{" "}
          <strong class="text-slate-800">{Math.min(currentPage() * pageSize(), totalCount())}</strong> of{" "}
          <strong class="text-slate-800">{totalCount()}</strong> entries
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500">Page size:</span>
            <select
              value={pageSize()}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              class="bg-slate-50 border border-slate-200 rounded p-1 text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              {[12, 24, 48, 96].map(sz => (
                <option value={sz}>{sz}</option>
              ))}
            </select>
          </div>
          <div class="flex gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage() === 1 || loading()}
              class="p-1 px-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold rounded border border-slate-200 disabled:cursor-not-allowed select-none cursor-pointer transition"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount() / pageSize()), prev + 1))}
              disabled={currentPage() >= Math.ceil(totalCount() / pageSize()) || loading()}
              class="p-1 px-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold rounded border border-slate-200 disabled:cursor-not-allowed select-none cursor-pointer transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ACTION 1: MOUNT (INSTALL) DIALOG MODLET */}
      {mountingTyreId() && (() => {
        const tyre = tyres.find(t => t.id === mountingTyreId());
        if (!tyre) return null;

        return (
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div class="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div class="flex justify-between items-center">
                <h3 class="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                  <TruckIcon class="w-4 h-4 text-emerald-600 animate-bounce" /> Mount Tyre on Active Truck
                </h3>
                <button onClick={() => setMountingTyreId(null)} class="text-slate-400 text-lg hover:text-slate-600">&times;</button>
              </div>
              
              <form onSubmit={handleMountSubmit} class="space-y-3.5 text-xs">
                <div>
                  <span class="text-slate-400">Target Serial:</span>
                  <span class="font-mono font-bold text-slate-850 block mt-0.5">{tyre.tyreNo} ({tyre.manufacturer})</span>
                </div>

                <div class="relative">
                  <label class="block text-[10px] uppercase font-bold text-slate-550 mb-1">Select Active Truck <span class="text-red-500">*</span></label>
                  <button
                    type="button"
                    onClick={() => setIsMountTruckDropdownOpen(!isMountTruckDropdownOpen())}
                    class="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white text-slate-800 text-left font-bold flex justify-between items-center cursor-pointer text-xs"
                  >
                    <span>
                      {selectedTruckId() 
                        ? trucks.find(t => t.id === selectedTruckId())?.truckNo || '-- Choose Truck --'
                        : '-- Choose Truck --'}
                    </span>
                    <span class="text-slate-400">▼</span>
                  </button>
                  {isMountTruckDropdownOpen() && (
                    <div class="absolute z-20 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 space-y-2">
                      <input
                        type="text"
                        placeholder="Type to search truck..."
                        value={mountTruckSearchQuery()}
                        onChange={(e) => setMountTruckSearchQuery(e.target.value)}
                        class="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-805 dark:text-white rounded-md px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                        autofocus
                      />
                      <div class="max-h-48 overflow-y-auto divide-y divide-slate-105 dark:divide-slate-750">
                        {trucks
                          .filter(tk => tk.truckNo.toLowerCase().includes(mountTruckSearchQuery().toLowerCase()))
                          .map(t => {
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
                              <button
                                
                                type="button"
                                disabled={isBlocked}
                                onClick={() => {
                                  setSelectedTruckId(t.id);
                                  setIsMountTruckDropdownOpen(false);
                                  setMountTruckSearchQuery('');
                                  if (t.currentKM) {
                                    setMountingKM(t.currentKM.toString());
                                  } else {
                                    setMountingKM('');
                                  }
                                }}
                                class={`w-full text-left px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 block font-mono cursor-pointer ${
                                  isBlocked ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed font-medium' : 'text-slate-700 dark:text-slate-300 font-extrabold'
                                }`}
                              >
                                {t.truckNo} ({t.ownerName || 'Self'}){labelSuffix}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label for="mountingDate" class="block text-[10px] uppercase font-bold text-slate-550 mb-1">Mounting Date <span class="text-red-500">*</span></label>
                  <input
                    id="mountingDate"
                    type="date"
                    required
                    value={mountingDate()}
                    onChange={(e) => setMountingDate(e.target.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label for="mountingKM" class="block text-[10px] uppercase font-bold text-slate-550 mb-1">Truck Odometer KM <span class="text-red-500">*</span></label>
                  <input
                    id="mountingKM"
                    type="number"
                    required
                    placeholder="e.g. 102540"
                    value={mountingKM()}
                    onChange={(e) => setMountingKM(e.target.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white font-mono font-bold"
                  />
                  <p class="text-[10px] text-slate-400 mt-0.5">Please specify precise ODO read to ensure true wear parameters.</p>
                </div>

                <div class="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMountingTyreId(null)}
                    class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold"
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
      {removingTyreId() && (() => {
        const tyre = tyres.find(t => t.id === removingTyreId());
        if (!tyre) return null;

        const estRun = Number(removalKM()) - (tyre.installationKM || 0);

        return (
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div class="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div class="flex justify-between items-center">
                <h3 class="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                  <Wrench class="w-4 h-4 text-blue-600" /> Dismount from {tyre.currentTruckNo}
                </h3>
                <button onClick={() => setRemovingTyreId(null)} class="text-slate-400 text-lg hover:text-slate-600">&times;</button>
              </div>

              <form onSubmit={handleRemovalSubmit} class="space-y-3.5 text-xs">
                <div>
                  <span class="text-slate-400 gap-1 flex items-center">Displaced ODO track:</span>
                  <div class="bg-slate-50 p-2 border border-slate-150 rounded mt-1">
                    <div>Mounted on: <b class="text-slate-700 font-mono text-xs">{tyre.currentTruckNo}</b></div>
                    <div>Installation Odometer Read: <b class="text-slate-700 font-mono">{tyre.installationKM?.toLocaleString()} KM</b></div>
                  </div>
                </div>

                <div>
                  <label for="removalDate" class="block text-[10px] uppercase font-bold text-slate-550 mb-1">Dismount Date <span class="text-red-500">*</span></label>
                  <input
                    id="removalDate"
                    type="date"
                    required
                    value={removalDate()}
                    onChange={(e) => setRemovalDate(e.target.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label for="removalKM" class="block text-[10px] uppercase font-bold text-slate-550 mb-1">Removal Odometer KM <span class="text-red-500">*</span></label>
                  <input
                    id="removalKM"
                    type="number"
                    required
                    value={removalKM()}
                    onChange={(e) => setRemovalKM(e.target.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white font-mono font-bold"
                  />
                  {estRun > 0 ? (
                    <p class="text-[11px] text-emerald-600 font-semibold mt-1">
                      Calculated run displacement: <b>+{estRun.toLocaleString()} KM</b> will be added to tyre total lifespan.
                    </p>
                  ) : estRun === 0 ? (
                    <p class="text-[10px] text-slate-400 mt-1">Odometer unchanged. Total accumulated displacement is unchanged.</p>
                  ) : (
                    <p class="text-[10px] text-red-500 font-semibold mt-1">Warning: removal odometer is lower than installation odometer.</p>
                  )}
                </div>

                <div>
                  <label for="removalRemarks" class="block text-[10px] uppercase font-bold text-slate-550 mb-1">Removal Reason / Note</label>
                  <input
                    id="removalRemarks"
                    type="text"
                    value={removalRemarks()}
                    onChange={(e) => setRemovalRemarks(e.target.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white"
                  />
                </div>

                <div class="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRemovingTyreId(null)}
                    class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
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
      {sellingTyreId() && (() => {
        const tyre = tyres.find(t => t.id === sellingTyreId());
        if (!tyre) return null;

        return (
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div class="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div class="flex justify-between items-center">
                <h3 class="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                  <DollarSign class="w-4 h-4 text-amber-600 animate-pulse" /> Sale Accounting parameters
                </h3>
                <button onClick={() => setSellingTyreId(null)} class="text-slate-400 text-lg hover:text-slate-600">&times;</button>
              </div>

              <form onSubmit={handleSellSubmit} class="space-y-3.5 text-xs">
                <div>
                  <span class="text-slate-400">Merchant Tyre Serial:</span>
                  <span class="font-mono font-bold text-slate-800 block mt-0.5">{tyre.tyreNo} ({tyre.manufacturer})</span>
                </div>

                <div>
                  <label for="saleDate" class="block text-[10px] uppercase font-bold text-slate-550 mb-1">Sale Date <span class="text-red-500">*</span></label>
                  <input
                    id="saleDate"
                    type="date"
                    required
                    value={saleDate()}
                    onChange={(e) => setSaleDate(e.target.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label for="saleAmount" class="block text-[10px] uppercase font-bold text-slate-550 mb-1">Sale Invoice Amount (₹) <span class="text-red-500">*</span></label>
                  <input
                    id="saleAmount"
                    type="number"
                    required
                    placeholder="e.g. 12000"
                    value={saleAmount()}
                    onChange={(e) => setSaleAmount(e.target.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white font-mono font-bold"
                  />
                </div>

                <div class="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSellingTyreId(null)}
                    class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold"
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
      {scrappingTyreId() && (() => {
        const tyre = tyres.find(t => t.id === scrappingTyreId());
        if (!tyre) return null;

        return (
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div class="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div class="flex justify-between items-center">
                <h3 class="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1 text-rose-600">
                  <XCircle class="w-4 h-4" /> Decommission & Recycle Tyre
                </h3>
                <button onClick={() => setScrappingTyreId(null)} class="text-slate-400 text-lg hover:text-slate-600">&times;</button>
              </div>

              <form onSubmit={handleScrapSubmit} class="space-y-3.5 text-xs">
                <p class="text-[11px] text-slate-450 italic bg-rose-50 border border-rose-100 p-2 rounded text-rose-800">
                  You are decommissioning tyre <b>{tyre.tyreNo}</b>. This will permanently lock its status to Scrapped/Recycled. No further vehicle mount operation is permitted.
                </p>

                <div>
                  <label for="scrapDate" class="block text-[10px] uppercase font-bold text-slate-550 mb-1">Scrapping Date <span class="text-red-500">*</span></label>
                  <input
                    id="scrapDate"
                    type="date"
                    required
                    value={scrapDate()}
                    onChange={(e) => setScrapDate(e.target.value)}
                    class="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:bg-white"
                  />
                </div>

                <div class="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setScrappingTyreId(null)}
                    class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold"
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
      {viewHistoryTyreId() && (() => {
        const tyre = tyres.find(t => t.id === viewHistoryTyreId());
        if (!tyre) return null;

        return (
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
            <div class="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 space-y-4 shadow-2xl">
              <div class="flex justify-between items-center border-b border-slate-150 pb-2.5">
                <div>
                  <span class="text-[9px] text-slate-400 uppercase font-bold tracking-widest block">{tyre.manufacturer} ODO Ledger</span>
                  <h3 class="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase flex items-center gap-1">
                    <History class="w-4 h-4 text-blue-600" /> movement trail: {tyre.tyreNo}
                  </h3>
                </div>
                <button onClick={() => setViewHistoryTyreId(null)} class="text-slate-400 text-lg hover:text-slate-600">&times;</button>
              </div>

              <div class="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {(!tyre.movementHistory || tyre.movementHistory.length === 0) ? (
                  <p class="text-center text-xs text-slate-400 py-6 italic">No movements recorded. Newly purchased item.</p>
                ) : (
                  <div class="relative border-l-2 border-slate-150 pl-4 ml-2.5 space-y-4 text-xs">
                    {(tyre.movementHistory || []).map((log, idx) => (
                      <div  class="relative">
                        
                        {/* Circle bullet identifier */}
                        <span class={`absolute -left-[24.5px] top-1 h-3.5 w-3.5 rounded-full border-2 bg-white flex items-center justify-center ${
                          log.action === 'Installed' ? 'border-emerald-500' :
                          log.action === 'Removed' ? 'border-blue-500' :
                          log.action === 'Sold' ? 'border-amber-500' :
                          'border-rose-500'
                        }`}>
                          <span class={`h-1.5 w-1.5 rounded-full ${
                            log.action === 'Installed' ? 'bg-emerald-500' :
                            log.action === 'Removed' ? 'bg-blue-500' :
                            log.action === 'Sold' ? 'bg-amber-500' :
                            'bg-rose-500'
                          }`} />
                        </span>

                        <div>
                          <div class="flex justify-between items-center">
                            <span class="font-extrabold text-slate-800 tracking-tight">{log.action}</span>
                            <span class="text-[10px] font-mono text-slate-400">{log.date}</span>
                          </div>
                          <p class="text-[11px] text-slate-600 mt-1 font-semibold leading-relaxed">
                            {log.remarks}
                          </p>
                          {log.odometerKM !== undefined && (
                            <span class="inline-block mt-0.5 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-mono text-slate-600">
                              Vehicle ODO: {log.odometerKM.toLocaleString()} KM
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div class="pt-3 border-t border-slate-150 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <span>Odometer wear life: <b>{(tyre.accumulatedKM || 0).toLocaleString()} KM</b></span>
                <button
                  onClick={() => setViewHistoryTyreId(null)}
                  class="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-bold font-sans cursor-pointer"
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
