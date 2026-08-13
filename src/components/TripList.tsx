import { createSignal, onMount, createEffect, createMemo, mergeProps, Show } from 'solid-js';

import { TripEntry, Truck, Office, Account, TripStatus, getTripMetrics, calculateBalance, TripAdvance, OrganizationProfile, importLegacyCargoExpenses, AuditLog, UserRights } from '../types';
import {
  Search, Edit2, Trash2, Calendar, Filter, FileSpreadsheet,
  Eye, ChevronRight, ChevronDown, X, AlertCircle, Fuel,
  Gauge, TrendingUp, DollarSign, User, MapPin, ListCollapse, ArrowRightLeft,
  ArrowUp, ArrowDown, ArrowUpDown, Printer, FileText, Download, Copy, Check,
  MoreVertical, Plus, Settings, History
} from 'lucide-solid';


import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

import { generateTripPDF, generateDriverReportPDF } from '../utils/tripPdfGenerator';
import ReportPreviewModal from './ReportPreviewModal';
import TripSummaryModal from './TripSummaryModal';
import { useLanguage } from '../context/LanguageContext';

interface TripListProps {
  trips: TripEntry[];
  trucks: Truck[];
  offices: Office[];
  accounts: Account[];
  onEditEntry: (entry: TripEntry) => void;
  onDeleteEntry: (id: string) => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
  canViewTrips?: boolean;
  canEditTrips?: boolean;
  canDeleteTrips?: boolean;
  organizationId?: string;
  onSaveTrips?: (newTrips: TripEntry[]) => void;
  auditLogs?: AuditLog[];
  currentUserRights?: UserRights;
  orgProfile?: OrganizationProfile;
}

export default function TripList(rawProps: TripListProps) {
  const { t } = useLanguage();
  const props = mergeProps(
    {
      trips: [],
      trucks: [],
      offices: [],
      accounts: [],
      canViewTrips: true,
      canEditTrips: true,
      canDeleteTrips: true,
      auditLogs: []
    },
    rawProps
  );

  const trips = () => props.trips;
  const trucks = () => props.trucks;
  const offices = () => props.offices;
  const accounts = () => props.accounts;
  const onEditEntry = props.onEditEntry;
  const onDeleteEntry = props.onDeleteEntry;
  const confirmAction = props.confirmAction;
  const canViewTrips = () => props.canViewTrips;
  const canEditTrips = () => props.canEditTrips;
  const canDeleteTrips = () => props.canDeleteTrips;
  const organizationId = () => props.organizationId;
  const orgProfile = () => props.orgProfile || null;
  const onSaveTrips = props.onSaveTrips;
  const auditLogs = () => props.auditLogs;
  const currentUserRights = () => props.currentUserRights;
  // Mouse hover scroll redirection for horizontal overflow
  let scrollRef: HTMLDivElement | undefined;
  onMount(() => {
    const el = scrollRef;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        const canScrollLeft = el.scrollLeft > 0;
        const canScrollRight = el.scrollLeft < (el.scrollWidth - el.clientWidth - 1);
        if (el.scrollWidth > el.clientWidth) {
          if ((e.deltaY < 0 && canScrollLeft) || (e.deltaY > 0 && canScrollRight)) {
            e.preventDefault();
            el.scrollLeft += e.deltaY;
          }
        }
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  });
  const [displayedTrips, setDisplayedTrips] = createSignal<TripEntry[]>([]);

  // Filters state
  const [search, setSearch] = createSignal('');
  const [selectedTruck, setSelectedTruck] = createSignal('');
  const [selectedStatuses, setSelectedStatuses] = createSignal<string[]>(['Pending', 'In Progress', 'Completed']);
  const [filterStartDate, setFilterStartDate] = createSignal('');
  const [filterEndDate, setFilterEndDate] = createSignal('');

  const [displayLimit, setDisplayLimit] = createSignal(100);
  const visibleTrips = createMemo(() => displayedTrips().slice(0, displayLimit()));

  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  onMount(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  });

  // Sorting state
  const [sortField, setSortField] = createSignal<'tripNo' | 'truckNo' | 'filterStartDate' | 'income' | 'totalExpense' | 'profit' | 'outstandingBalance' | 'status'>('tripNo');
  const [sortDirection, setSortDirection] = createSignal<'asc' | 'desc'>('desc');

  // Pagination & Display states
  const [currentPage, setCurrentPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(10);
  const [totalCount, setTotalCount] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [activeSpeedDialId, setActiveSpeedDialId] = createSignal<string | null>(null);

  const [copiedId, setCopiedId] = createSignal<string | null>(null);
  const [previewHtml, setPreviewHtml] = createSignal<string | null>(null);
  const [previewTitle, setPreviewTitle] = createSignal<string>('');

  const handleCopy = (e: MouseEvent, id: string, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const online = isAppwriteConfigured();

  // Memoized filter and sort - computed only when dependencies change
  const filteredAndSortedTrips = createMemo(() => {
    const filtered = trips().filter(trip => {
      if (!trip.tripNo || trip.tripNo.trim() === '') return false;
      const matchesSearch = !search() ? true : (
        trip.tripNo.toLowerCase().includes(search().toLowerCase()) ||
        trip.truckNo.toLowerCase().includes(search().toLowerCase()) ||
        trip.driverName.toLowerCase().includes(search().toLowerCase()) ||
        (trip.notes && trip.notes.toLowerCase().includes(search().toLowerCase()))
      );

      const matchesTruck = !selectedTruck() ? true : trip.truckNo === selectedTruck();
      const isDeleted = !!trip.deletedAt || trip.status === 'Deleted';
      const matchesStatus = isDeleted
        ? selectedStatuses().includes('Deleted')
        : (selectedStatuses().length === 0 ? true : selectedStatuses().includes(((trip.status as string) === 'Paid' || (trip.status as string) === 'Pald') ? 'Settled' : trip.status));

      const matchesStartDate = !filterStartDate() ? true : trip.startDate >= filterStartDate();
      const matchesEndDate = !filterEndDate() ? true : trip.endDate <= filterEndDate();

      return matchesSearch && matchesTruck && matchesStatus && matchesStartDate && matchesEndDate;
    });

    // Cache metrics to avoid recalculation during sort
    const metricsCache = new Map<TripEntry, ReturnType<typeof getTripMetrics>>();
    
    return [...filtered].sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';

      if (sortField() === 'tripNo') {
        aVal = a.tripNo;
        bVal = b.tripNo;
      } else if (sortField() === 'truckNo') {
        aVal = a.truckNo;
        bVal = b.truckNo;
      } else if (sortField() === 'filterStartDate') {
        aVal = a.startDate;
        bVal = b.startDate;
      } else if (sortField() === 'status') {
        aVal = a.status;
        bVal = b.status;
      } else {
        const mA = metricsCache.get(a) || getTripMetrics(a);
        const mB = metricsCache.get(b) || getTripMetrics(b);
        metricsCache.set(a, mA);
        metricsCache.set(b, mB);
        
        if (sortField() === 'income') {
          aVal = mA.income;
          bVal = mB.income;
        } else if (sortField() === 'totalExpense') {
          aVal = mA.totalExpense;
          bVal = mB.totalExpense;
        } else if (sortField() === 'profit') {
          aVal = mA.profit;
          bVal = mB.profit;
        } else if (sortField() === 'outstandingBalance') {
          aVal = mA.outstandingBalance;
          bVal = mB.outstandingBalance;
        }
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDirection() === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection() === 'asc' ? 1 : -1;
      return 0;
    });

    return [...filtered].sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';

      if (sortField() === 'tripNo') {
        aVal = a.tripNo;
        bVal = b.tripNo;
      } else if (sortField() === 'truckNo') {
        aVal = a.truckNo;
        bVal = b.truckNo;
      } else if (sortField() === 'filterStartDate') {
        aVal = a.startDate;
        bVal = b.startDate;
      } else if (sortField() === 'status') {
        aVal = a.status;
        bVal = b.status;
      } else {
        const mA = metricsCache.get(a) || getTripMetrics(a);
        const mB = metricsCache.get(b) || getTripMetrics(b);
        metricsCache.set(a, mA);
        metricsCache.set(b, mB);
        
        if (sortField() === 'income') {
          aVal = mA.income;
          bVal = mB.income;
        } else if (sortField() === 'totalExpense') {
          aVal = mA.totalExpense;
          bVal = mB.totalExpense;
        } else if (sortField() === 'profit') {
          aVal = mA.profit;
          bVal = mB.profit;
        } else if (sortField() === 'outstandingBalance') {
          aVal = mA.outstandingBalance;
          bVal = mB.outstandingBalance;
        }
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortDirection() === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection() === 'asc' ? 1 : -1;
      return 0;
    });
  });

  // Displayed trips driven strictly by local reactive store
  createEffect(() => {
    const sorted = filteredAndSortedTrips();
    setTotalCount(sorted.length);
    const startIdx = (currentPage() - 1) * pageSize();
    setDisplayedTrips(sorted.slice(startIdx, startIdx + pageSize()));
  });

  const handleSort = (field: ReturnType<typeof sortField>) => {
    if (sortField() === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Selection/Expansion state
  const [expandedTripId, setExpandedTripId] = createSignal<string | null>(null);

  // Master Details modal state for viewing full list of 21+ columns cleanly
  const [viewingEntry, setViewingEntry] = createSignal<TripEntry | null>(null);
  const [activeTab, setActiveTab] = createSignal<'loads' | 'profit' | 'driver' | 'actions' | 'audit'>('loads');

  // Selected next trip ID for forwarding deficit/surplus
  const [selectedFwdTripId, setSelectedFwdTripId] = createSignal<string>('');
  const [selectedFwdMode, setSelectedFwdMode] = createSignal<'trip' | 'account'>('trip');
  const [selectedFwdAccountId, setSelectedFwdAccountId] = createSignal<string>('');
  const [selectedFwdDate, setSelectedFwdDate] = createSignal<string>(new Date().toISOString().substring(0, 10));

  // Reset forward options when viewingEntry() changes
  createEffect(() => {
    setSelectedFwdTripId('');
    setSelectedFwdAccountId('');
    setSelectedFwdMode('trip');
    setSelectedFwdDate(new Date().toISOString().substring(0, 10));
    setActiveTab('loads');
  });

  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewingEntry()) {
        setViewingEntry(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  createEffect(() => {
    const handleBackPress = (e: Event) => {
      if (viewingEntry()) {
        setViewingEntry(null);
        e.preventDefault();
      }
    };
    window.addEventListener('app-back-press', handleBackPress);
    return () => {
      window.removeEventListener('app-back-press', handleBackPress);
    };
  });


  // Calculate totals of matched items for footer reporting
  const totals = (online ? displayedTrips() : trips().filter(trip => {
    const matchesSearch = !search() ? true : (
      trip.tripNo.toLowerCase().includes(search().toLowerCase()) ||
      trip.truckNo.toLowerCase().includes(search().toLowerCase()) ||
      trip.driverName.toLowerCase().includes(search().toLowerCase()) ||
      (trip.notes && trip.notes.toLowerCase().includes(search().toLowerCase()))
    );
    const matchesTruck = !selectedTruck() ? true : trip.truckNo === selectedTruck();
    const isDeleted = !!trip.deletedAt || trip.status === 'Deleted';
    const matchesStatus = isDeleted
      ? selectedStatuses().includes('Deleted')
      : (selectedStatuses().length === 0 ? true : selectedStatuses().includes(((trip.status as string) === 'Paid' || (trip.status as string) === 'Pald') ? 'Settled' : trip.status));
    const matchesStartDate = !filterStartDate() ? true : trip.startDate >= filterStartDate();
    const matchesEndDate = !filterEndDate() ? true : trip.endDate <= filterEndDate();
    return matchesSearch && matchesTruck && matchesStatus && matchesStartDate && matchesEndDate;
  })).reduce((acc, t) => {
    if (t.status === 'Deleted' || t.deletedAt) {
      return acc;
    }
    const m = getTripMetrics(t);
    return {
      income: acc.income + m.income,
      expense: acc.expense + m.totalExpense,
      profit: acc.profit + m.profit,
      payments: acc.payments + m.paymentsReceived,
      outstanding: acc.outstanding + m.outstandingBalance,
      fuelLiters: acc.fuelLiters + m.fuelLiters,
      km: acc.km + m.totalKM
    };
  }, {
    income: 0,
    expense: 0,
    profit: 0,
    payments: 0,
    outstanding: 0,
    fuelLiters: 0,
    km: 0
  });

  // CSV Exporter reflecting the new flat 23-column schema
  const handleExportCSV = () => {
    const localFiltered = trips().filter(trip => {
      const matchesSearch = !search() ? true : (
        trip.tripNo.toLowerCase().includes(search().toLowerCase()) ||
        trip.truckNo.toLowerCase().includes(search().toLowerCase()) ||
        trip.driverName.toLowerCase().includes(search().toLowerCase()) ||
        (trip.notes && trip.notes.toLowerCase().includes(search().toLowerCase()))
      );
      const matchesTruck = !selectedTruck() ? true : trip.truckNo === selectedTruck();
      const isDeleted = !!trip.deletedAt || trip.status === 'Deleted';
      const matchesStatus = isDeleted
        ? selectedStatuses().includes('Deleted')
        : (selectedStatuses().length === 0 ? true : selectedStatuses().includes(((trip.status as string) === 'Paid' || (trip.status as string) === 'Pald') ? 'Settled' : trip.status));
      const matchesStartDate = !filterStartDate() ? true : trip.startDate >= filterStartDate();
      const matchesEndDate = !filterEndDate() ? true : trip.endDate <= filterEndDate();
      return matchesSearch && matchesTruck && matchesStatus && matchesStartDate && matchesEndDate;
    });

    const exportList = online ? displayedTrips() : localFiltered;
    if (exportList.length === 0) return;
    const headers = [
      "Trip No", "Truck No", "Trip Start Date", "Trip End Date", "Driver Name",
      "Income (₹)", "Loading Expense (₹)", "Unloading Expense (₹)", "RTO Expense (₹)",
      "Diesel Expense (₹)", "Add Blue Expense (₹)", "Fastag Expense (₹)", "Driver Wages (₹)",
      "Other Expense (₹)", "Fuel Liters", "Starting KM", "Ending KM", "Total KM",
      "Mileage (KM/L)", "Per KM Expense (₹)", "No of Days", "Total Expense (₹)", "Profit (₹)",
      "Payments Received (₹)", "Outstanding Balance (₹)", "Status"
    ];

    const rows = exportList.map(t => {
      const m = getTripMetrics(t);

      return [
        t.tripNo,
        t.truckNo,
        t.startDate,
        t.endDate,
        t.driverName,
        m.income,
        m.loadingExpense,
        m.unloadingExpense,
        m.rtoExpense,
        m.dieselExpense,
        m.addBlueExpense,
        m.fastagExpense,
        m.driverWages,
        m.otherExpense,
        m.fuelLiters,
        t.startingKM,
        t.endingKM,
        m.totalKM,
        m.millage.toFixed(2),
        m.perKM.toFixed(2),
        m.noOfDays,
        m.totalExpense,
        m.profit,
        m.paymentsReceived,
        m.outstandingBalance,
        t.status
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(val => {
        const escaped = ('' + val).replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') ? `"${escaped}"` : escaped;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `fleet_trip_reports_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getAccountName = (id: string) => {
    if (id === 'paid_to_driver_advance') return 'Paid to Driver Advance';
    const fuelCard = orgProfile()?.fuelCards?.find(fc => fc.id === id);
    if (fuelCard) return `${fuelCard.cardName} (Fuel Card)`;
    return accounts().find(a => a.id === id)?.accountName || id || 'Unmapped';
  };

  // Date styling helper
  const dateFormatted = (dateStr: string) => {
    if (!dateStr) return <span class="text-slate-400 font-mono">&mdash;</span>;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return <span class="text-slate-400 font-mono">{dateStr}</span>;
      return <span class="font-mono text-xs">{d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>;
    } catch {
      return <span class="text-slate-400 font-mono">{dateStr}</span>;
    }
  };

  const currencyFormatted = (num: number, showSign = true) => {
    const val = Number(num) || 0;
    return <span class="font-mono font-bold text-slate-800">{showSign ? '₹' : ''}{val.toLocaleString('en-IN')}</span>;
  };

  const handleUpdateTripStatus = (trip: TripEntry, newStatus: TripStatus, e?: Event) => {
    if (e) e.stopPropagation();
    if (!props.onSaveTrips || !canEditTrips()) return;
    const updated = props.trips.map(t => t.id === trip.id ? { ...t, status: newStatus } : t);
    props.onSaveTrips(updated);
  };

  const getStatusBadge = (trip: TripEntry) => {
    const status = trip.status || 'Pending';
    const isEditable = canEditTrips() && props.onSaveTrips && status !== 'Deleted';

    const colorClass =
      status === 'Pending' ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' :
      status === 'In Progress' ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100' :
      status === 'Completed' ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100' :
      status === 'Settled' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' :
      'bg-rose-50 text-rose-700 border-rose-200';

    if (!isEditable) {
      return (
        <span class={`px-2.5 py-1 text-xs font-extrabold rounded-full border ${colorClass}`}>
          {status}
        </span>
      );
    }

    return (
      <select
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => handleUpdateTripStatus(trip, e.target.value as TripStatus, e)}
        class={`px-2.5 py-1 text-xs font-extrabold rounded-full border ${colorClass} cursor-pointer focus:outline-none transition shadow-2xs`}
      >
        <option value="Pending">Pending</option>
        <option value="In Progress">In Progress</option>
        <option value="Completed">Completed</option>
        <option value="Settled">Settled</option>
      </select>
    );
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedTruck('');
    setSelectedStatuses(['Pending', 'In Progress', 'Completed']);
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const getStatusDropdownLabel = () => {
    if (selectedStatuses().length === 5) return 'All Statuses';
    if (selectedStatuses().length === 0) return '- Choose Status -';
    return selectedStatuses().join(', ');
  };

  const renderSortableHeader = (label: string, field: ReturnType<typeof sortField>, customClass = "px-4 py-4") => {
    const isCurrent = sortField() === field;
    return (
      <th
        onClick={() => handleSort(field)}
        class={`${customClass} cursor-pointer hover:bg-slate-100 select-none transition group`}
      >
        <div class={`flex items-center gap-1.5 ${customClass.includes('text-right') ? 'justify-end' : customClass.includes('text-center') ? 'justify-center' : 'justify-start'}`}>
          <span>{label}</span>
          {isCurrent ? (
            sortDirection() === 'asc' ? (
              <ArrowUp class="w-3.5 h-3.5 text-blue-600 shrink-0" />
            ) : (
              <ArrowDown class="w-3.5 h-3.5 text-blue-600 shrink-0" />
            )
          ) : (
            <ArrowUpDown class="w-3.5 h-3.5 text-slate-350 opacity-40 group-hover:opacity-100 transition" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div class="space-y-6 animate-fade-in font-sans">

      {/* FILTER CONTROL PANEL */}
      <div id="trip-filter-hud" class="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs space-y-4">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800 leading-tight font-sans flex items-center gap-2">
              <span>{t('trip.list_title', 'Active Transport Journals')}</span>
              {loading() && <span class="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>}
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">{t('trip.list_sub', 'Fleet performance auditing. Select custom master records to inspect sub-trip segments & expenditures.')}</p>
          </div>

          <button
            id="export-csv-btn"
            disabled={totalCount() === 0}
            onClick={handleExportCSV}
            class="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-905 disabled:opacity-45 disabled:hover:bg-transparent font-bold px-4 py-2.5 rounded-lg border border-slate-200 transition text-xs shadow-2xs cursor-pointer text-slate-905"
          >
            <FileSpreadsheet class="w-3.5 h-3.5 text-slate-500" /> {t('btn.export_csv', 'Export Cumulative CSV')}
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-slate-100">
          {/* SEARCH FIELD */}
          <div class="relative">
            <Search class="absolute left-2.5 top-3 w-3.5 h-3.5 text-slate-400" />
            <input
              id="search()-input"
              type="text"
              placeholder="Search Trips, Trucks, Drivers..."
              value={search()}
              onChange={(e) => setSearch(e.target.value)}
              class="w-full bg-slate-50 border border-slate-200 text-slate-850 rounded-lg pl-8 pr-2 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* TRUCK SELECT FILTER */}
          <div>
            <select
              id="filter-truck-select"
              value={selectedTruck()}
              onChange={(e) => setSelectedTruck(e.target.value)}
              class="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
            >
              <option value="">&mdash; Choose Truck &mdash;</option>
              {trucks().map(t => (
                <option  value={t.truckNo}>{t.truckNo}</option>
              ))}
            </select>
          </div>

          {/* STATUS SELECT DROPDOWN */}
          <div class="relative" ref={dropdownRef} id="filter-status-dropdown-container">
            <button
              id="filter-status-dropdown-trigger"
              type="button"
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen())}
              class="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white font-semibold flex justify-between items-center cursor-pointer select-none h-[34px]"
            >
              <span class="truncate pr-2">{getStatusDropdownLabel()}</span>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isStatusDropdownOpen() && (
              <div class="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 animate-fade-in max-h-60 overflow-y-auto">
                <label class="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-705 hover:bg-slate-55 bg-white hover:bg-slate-50 cursor-pointer select-none border-b border-slate-100 mb-1 pb-1.5">
                  <input
                    type="checkbox"
                    checked={selectedStatuses().length === 5}
                    onChange={() => {
                      if (selectedStatuses().length === 5) {
                        setSelectedStatuses([]);
                      } else {
                        setSelectedStatuses(['Pending', 'In Progress', 'Completed', 'Settled', 'Deleted']);
                      }
                    }}
                    class="rounded border-slate-350 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>All Status</span>
                </label>
                {(['Pending', 'In Progress', 'Completed', 'Settled', 'Deleted'] as const).map((status) => {
                  const isChecked = selectedStatuses().includes(status);
                  return (
                    <label
                      
                      class="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedStatuses(prev => prev.filter(s => s !== status));
                          } else {
                            setSelectedStatuses(prev => [...prev, status]);
                          }
                        }}
                        class="rounded border-slate-350 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>{status}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* STARTING DATE */}
          <div>
            <input
              id="filter-start-date"
              type="date"
              title="Trip start date after"
              value={filterStartDate()}
              onChange={(e) => setFilterStartDate(e.target.value)}
              class="w-full bg-slate-50 border border-slate-200 text-slate-650 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
            />
          </div>

          {/* ENDING DATE */}
          <div>
            <input
              id="filter-end-date"
              type="date"
              title="Trip end date before"
              value={filterEndDate()}
              onChange={(e) => setFilterEndDate(e.target.value)}
              class="w-full bg-slate-50 border border-slate-200 text-slate-650 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
            />
          </div>
        </div>

        {/* ACTIVE FILTER DISMISS BLOCKS */}
        {(() => {
          const isDefaultStatuses = selectedStatuses().length === 3 &&
            selectedStatuses().includes('Pending') &&
            selectedStatuses().includes('In Progress') &&
            selectedStatuses().includes('Completed');

          if (selectedTruck() || !isDefaultStatuses || filterStartDate() || filterEndDate() || search()) {
            return (
              <div class="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-lg p-3 px-4 shadow-3xs">
                <span class="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                  <Filter class="w-3.5 h-3.5 text-blue-500" />
                  Matched <strong>{totalCount()}</strong> transport records.
                </span>
                <button
                  id="reset-filters"
                  onClick={handleResetFilters}
                  class="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* CORE MASTER LIST TABLE CONTAINER */}
      <div class="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden hidden md:block">
        <div ref={scrollRef} class="overflow-x-auto">
          <table id="master-trips-table" class="w-full text-left text-sm text-slate-700 whitespace-nowrap min-w-[1000px]">
            <thead class="text-[11px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200 font-bold tracking-wider">
              <tr>
                {renderSortableHeader(t('trip.id_group', 'Trip ID (Group Code)'), 'tripNo', 'px-6 py-4 pl-6 text-left')}
                {renderSortableHeader(t('trip.truck_driver', 'Truck & Driver'), 'truckNo', 'px-4 py-4 text-left')}
                {renderSortableHeader(t('trip.dates', 'Trip duration dates'), 'filterStartDate', 'px-4 py-4 text-center')}
                {renderSortableHeader(t('trip.income', 'Income Generated'), 'income', 'px-4 py-4 text-right')}
                {renderSortableHeader(t('trip.expenses', 'Operational Costs'), 'totalExpense', 'px-4 py-4 text-right')}
                {renderSortableHeader(t('trip.profit', 'Net Profit Margin'), 'profit', 'px-4 py-4 text-right')}
                {renderSortableHeader(t('trip.outstanding', 'Total Outstanding'), 'outstandingBalance', 'px-4 py-4 text-right text-amber-700 bg-amber-50/15 font-extrabold')}
                {renderSortableHeader(t('trip.status', 'Status'), 'status', 'px-4 py-4 text-center')}
                <th class="px-6 py-4 text-right pr-6">{t('trip.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-sans">
              {visibleTrips().length === 0 ? (
                <tr>
                  <td colSpan={9} class="text-center py-16 text-slate-400 font-medium italic">
                    No active transport references matched your operational filters.
                  </td>
                </tr>
              ) : (
                visibleTrips().map((trip) => {
                  const m = getTripMetrics(trip);

                  return (
                    <>
                      {/* MAIN MASTERS ROW */}
                      <tr
                        id={`trip-row-${trip.id}`}
                        class="hover:bg-slate-50/50 transition duration-150 cursor-pointer"
                        onClick={() => setViewingEntry(trip)}
                      >
                        {/* TRIP ID */}
                        <td class="px-6 py-4 pl-6">
                          <div class="flex items-center gap-1.5">
                            <span class="font-mono font-extrabold text-blue-600 text-xs block">{trip.tripNo}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopy(e, trip.id, trip.tripNo)}
                              class="text-slate-400 hover:text-blue-700 transition cursor-pointer p-0.5 rounded-md hover:bg-slate-100 flex items-center justify-center shrink-0"
                              title="Copy Trip ID"
                            >
                              {copiedId() === trip.id ? (
                                <Check class="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy class="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <span class="text-[10px] text-slate-400 italic block mt-0.5">Segs: {trip.subTrips?.length || 0}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const html = generateTripPDF(trip, accounts(), orgProfile());
                              setPreviewHtml(html);
                              setPreviewTitle(`Trip Report - ${trip.tripNo}`);
                            }}
                            class="text-[10px] text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1 mt-1 font-semibold cursor-pointer"
                            title="Download Trip Report"
                          >
                            <Download class="w-3 h-3" /> Download Report
                          </button>
                        </td>

                        {/* TRUCK & OPERATOR */}
                        <td class="px-4 py-4">
                          <span class="font-mono font-bold text-slate-900 tracking-wider text-[13px] block">{trip.truckNo}</span>
                          <span class="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5 font-sans">
                            <User class="w-3 h-3 text-slate-400" />
                            <span>{trip.driverName || 'No Driver'}</span>
                            {trip.driverName && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  generateDriverReportPDF(trip, accounts(), orgProfile());
                                }}
                                class="text-slate-400 hover:text-blue-600 transition ml-1 cursor-pointer flex items-center"
                                title="Download Driver Report"
                              >
                                <Download class="w-3 h-3" />
                              </button>
                            )}
                          </span>
                          {(() => {
                            const balance = m.driverBalance;
                            if (balance < 0) {
                              return (
                                <span class="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold uppercase tracking-tight block w-max select-none">
                                  Recover: ₹{Math.abs(balance).toLocaleString('en-IN')}
                                </span>
                              );
                            } else if (balance > 0) {
                              return (
                                <span class="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9px] font-bold uppercase tracking-tight block w-max select-none">
                                  Pay: ₹{balance.toLocaleString('en-IN')}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </td>

                        {/* TRIP TIMEFRAME */}
                        <td class="px-4 py-4 text-center">
                          <div class="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-150 px-2.5 py-1 rounded text-xs">
                            {dateFormatted(trip.startDate)}
                            <span class="text-slate-350 font-normal select-none">&rarr;</span>
                            {dateFormatted(trip.endDate)}
                          </div>
                          <span class="text-[10px] text-slate-500 block mt-1 font-semibold">{m.noOfDays} transport day{m.noOfDays > 1 ? 's' : ''}</span>
                        </td>

                        {/* INCOMINGS */}
                        <td class="px-4 py-4 text-right">
                          {currencyFormatted(m.income)}
                        </td>

                        {/* COSTING */}
                        <td class="px-4 py-4 text-right font-mono font-bold text-red-600">
                          ₹{m.totalExpense.toLocaleString('en-IN')}
                        </td>

                        {/* PROFITS */}
                        <td class={`px-4 py-4 text-right font-mono font-bold ${m.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          ₹{m.profit.toLocaleString('en-IN')}
                          <span class="text-[9px] text-slate-400 block font-normal font-sans mt-0.5">Margin: {m.income > 0 ? Math.round((m.profit / m.income) * 100) : 0}%</span>
                        </td>

                        {/* TOTAL OUTSTANDING */}
                        <td class="px-4 py-4 text-right">
                          {m.outstandingBalance > 0 ? (
                            <span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-50 border border-red-200 text-red-700 inline-block font-mono">
                              ₹{m.outstandingBalance.toLocaleString('en-IN')} Outstanding
                            </span>
                          ) : m.outstandingBalance === 0 ? (
                            <span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-700 inline-block">
                              Fully Settled
                            </span>
                          ) : (
                            <span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 border border-amber-200 text-amber-800 inline-block font-mono">
                              Return ₹{Math.abs(m.outstandingBalance).toLocaleString('en-IN')}
                            </span>
                          )}
                        </td>

                        {/* GENERAL STATUS */}
                        <td class="px-4 py-4 text-center">
                          {getStatusBadge(trip)}
                        </td>

                        {/* OPTIONS BAR */}
                        <td class="px-6 py-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <div class="flex justify-end gap-1 px-1">
                            {/* INSPECTOR VIEW */}
                            <button
                              title="Full 23-Columns Sheet Inspector"
                              onClick={() => setViewingEntry(trip)}
                              class="p-1 px-2.5 bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded border border-slate-200 transition cursor-pointer flex items-center h-8"
                            >
                              <Eye class="w-3.5 h-3.5" />
                            </button>
                            {/* MODIFY SPEC ROW */}
                            <button
                              title="Modify Cargo Entry specs"
                              disabled={!canEditTrips() || trip.status === 'Deleted'}
                              onClick={() => onEditEntry(trip)}
                              class="p-1 px-2.5 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center h-8"
                            >
                              <Edit2 class="w-3.5 h-3.5" />
                            </button>
                            {/* DELETE ENTRY */}
                            <button
                              title="Wipe Cargo Entry record"
                              disabled={!canDeleteTrips() || trip.status === 'Deleted'}
                              onClick={() => {
                                const msg = `Are you sure you want to permanently delete trip record ${trip.tripNo}? This wipes all linked payments, diesel, and driver expenses.`;
                                if (confirmAction) {
                                  confirmAction(msg, () => onDeleteEntry(trip.id), "Delete Cargo Entry Record");
                                } else if (confirm(msg)) {
                                  onDeleteEntry(trip.id);
                                }
                              }}
                              class="p-1 px-2.5 bg-rose-50/30 text-rose-600 hover:text-rose-700 hover:bg-rose-550/10 rounded border border-rose-150 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center h-8"
                            >
                              <Trash2 class="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </>
                  );
                })
              )}
            </tbody>

            {/* GRAND FILTERED TOTALS ON FOOTER */}
            {displayedTrips().length > 0 && (
              <tfoot class="bg-slate-50 font-mono text-slate-800 text-[11px] font-bold border-t border-slate-200">
                <tr>
                  <td class="px-6 py-4 pl-6" colSpan={3}>
                    Totals ({online ? 'Current Page' : `${totalCount()} logs`})
                  </td>
                  <td class="px-4 py-4 text-right">
                    ₹{totals.income.toLocaleString('en-IN')}
                  </td>
                  <td class="px-4 py-4 text-right text-red-600 font-extrabold">
                    ₹{totals.expense.toLocaleString('en-IN')}
                  </td>
                  <td class={`px-4 py-4 text-right text-[13px] font-black ${totals.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    ₹{totals.profit.toLocaleString('en-IN')}
                  </td>
                  <td class="px-4 py-4 text-right text-amber-700 font-extrabold bg-amber-50/15">
                    ₹{totals.outstanding.toLocaleString('en-IN')}
                  </td>
                  <td class="px-4 py-4 text-center"></td>
                  <td class="px-6 py-4 text-right font-medium font-sans"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* MOBILE LIST CARD VIEW */}
      <div class="block md:hidden space-y-4">
        {visibleTrips().length === 0 ? (
          <div class="bg-white border border-slate-200 rounded-xl p-8 py-12 text-center text-slate-400 italic">
            No active transport references matched your operational filters.
          </div>
        ) : (
          visibleTrips().map((trip) => {
            const m = getTripMetrics(trip);
            return (
              <div
                
                class="bg-white border border-slate-200 rounded-xl p-4.5 shadow-3xs flex flex-col justify-between hover:border-blue-300 transition relative"
                onClick={() => setViewingEntry(trip)}
              >
                <div>
                  {/* Top Row: Trip ID & Status */}
                  <div class="flex justify-between items-center gap-2 mb-3 pr-8">
                    <div class="flex flex-col">
                      <span class="font-mono font-extrabold text-blue-600 text-xs">
                        {trip.tripNo}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const html = generateTripPDF(trip, accounts(), orgProfile());
                          setPreviewHtml(html);
                          setPreviewTitle(`Trip Report - ${trip.tripNo}`);
                        }}
                        class="text-[10px] text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1 mt-0.5 font-semibold cursor-pointer"
                        title="Download Trip Report"
                      >
                        <Download class="w-3.5 h-3.5" /> Download Report
                      </button>
                    </div>
                    {getStatusBadge(trip)}
                  </div>

                  {/* Truck & Driver */}
                  <div class="flex items-center gap-3 text-xs mb-3 text-slate-800">
                    <span class="font-mono font-bold text-slate-900 tracking-wider">
                      {trip.truckNo}
                    </span>
                    <span class="w-px h-3.5 bg-slate-200" />
                    <span class="text-slate-500 font-medium flex items-center gap-1">
                      <User class="w-3.5 h-3.5 text-slate-400 animate-none shrink-0" />
                      <span>{trip.driverName || 'No Driver'}</span>
                      {trip.driverName && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const html = generateDriverReportPDF(trip, accounts(), orgProfile());
                            setPreviewHtml(html);
                            setPreviewTitle(`Driver Settlement - ${trip.tripNo}`);
                          }}
                          class="text-slate-400 hover:text-blue-600 transition ml-1 cursor-pointer flex items-center"
                          title="Download Driver Report"
                        >
                          <Download class="w-3.5 h-3.5" />
                        </button>
                      )}
                    </span>
                  </div>

                  {/* Route & Dates */}
                  <div class="bg-slate-50 border border-slate-200/60 rounded-lg p-2.5 space-y-1.5 text-xs text-slate-650 mb-3.5">
                    <div class="flex justify-between">
                      <span class="text-slate-400 font-bold uppercase text-[9px]">Route</span>
                      <span class="font-semibold text-slate-850 truncate max-w-[200px]" title={trip.subTrips?.[0]?.officeName || 'Broker'}>
                        {trip.subTrips?.[0]?.officeName || 'Broker'} &bull; {trip.subTrips?.[0]?.routeFrom || 'Origin'} &rarr; {trip.subTrips?.[trip.subTrips.length - 1]?.routeTo || 'Destination'}
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-slate-400 font-bold uppercase text-[9px]">Dates</span>
                      <span class="font-medium text-slate-700">
                        {dateFormatted(trip.startDate)} &rarr; {dateFormatted(trip.endDate)}
                      </span>
                    </div>
                    {(() => {
                      const balance = m.driverBalance;
                      if (balance < 0) {
                        return (
                          <div class="flex justify-between pt-1 border-t border-slate-200/40">
                            <span class="text-amber-805 font-bold uppercase text-[9px]">Recover</span>
                            <span class="font-extrabold text-amber-800 font-mono">₹{Math.abs(balance).toLocaleString('en-IN')}</span>
                          </div>
                        );
                      } else if (balance > 0) {
                        return (
                          <div class="flex justify-between pt-1 border-t border-slate-200/40">
                            <span class="text-emerald-800 font-bold uppercase text-[9px]">Pay</span>
                            <span class="font-extrabold text-emerald-800 font-mono">₹{balance.toLocaleString('en-IN')}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Financials Grid */}
                  <div class="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div class="bg-emerald-50/20 border border-emerald-100/40 rounded-lg p-2 flex flex-col justify-between">
                      <span class="text-emerald-700/85 font-bold uppercase text-[9px]">Income</span>
                      <span class="font-extrabold text-emerald-800 mt-1">
                        {currencyFormatted(m.income)}
                      </span>
                    </div>
                    <div class="bg-rose-50/20 border border-rose-100/40 rounded-lg p-2 flex flex-col justify-between">
                      <span class="text-rose-750 font-bold uppercase text-[9px]">Expense</span>
                      <span class="font-extrabold text-rose-800 mt-1">
                        ₹{m.totalExpense.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div class="bg-slate-50 border border-slate-200/45 rounded-lg p-2 flex flex-col justify-between">
                      <span class="text-slate-500 font-bold uppercase text-[9px]">Profit</span>
                      <span class={`font-extrabold mt-1 ${m.profit >= 0 ? 'text-indigo-800' : 'text-rose-800'}`}>
                        ₹{m.profit.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div class={`${m.outstandingBalance > 0
                        ? 'bg-rose-50/20 border border-rose-100/40'
                        : m.outstandingBalance === 0
                          ? 'bg-emerald-50/20 border border-emerald-100/40'
                          : 'bg-amber-50/20 border border-amber-100/40'
                      } rounded-lg p-2 flex flex-col justify-between`}>
                      <span class={`${m.outstandingBalance > 0
                          ? 'text-rose-700'
                          : m.outstandingBalance === 0
                            ? 'text-emerald-700'
                            : 'text-amber-800'
                        } font-bold uppercase text-[9px]`}>
                        {m.outstandingBalance > 0 ? 'Outstanding' : m.outstandingBalance === 0 ? 'Settled' : 'Return Office'}
                      </span>
                      <span class={`font-black mt-1 ${m.outstandingBalance > 0
                          ? 'text-rose-850 text-red-600'
                          : m.outstandingBalance === 0
                            ? 'text-emerald-800'
                            : 'text-amber-805 text-amber-800'
                        }`}>
                        ₹{Math.abs(m.outstandingBalance).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                {/* Micro-FAB Speed Dial */}
                <div class="absolute top-3 right-3 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <div class={`flex items-center gap-1.5 bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-full p-1 pl-2.5 pr-1.5 shadow-md transition-all duration-300 ease-out origin-right transform whitespace-nowrap ${
                    activeSpeedDialId() === trip.id 
                      ? 'opacity-100 scale-100 translate-x-0 pointer-events-auto' 
                      : 'opacity-0 scale-90 translate-x-2 pointer-events-none'
                  }`}>
                    <button
                      type="button"
                      onClick={() => {
                        setViewingEntry(trip);
                        setActiveSpeedDialId(null);
                      }}
                      class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
                      title="View Details"
                    >
                      <Eye class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canEditTrips() || trip.status === 'Deleted'}
                      onClick={() => {
                        onEditEntry(trip);
                        setActiveSpeedDialId(null);
                      }}
                      class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer disabled:opacity-45"
                      title="Edit Record"
                    >
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canDeleteTrips() || trip.status === 'Deleted'}
                      onClick={() => {
                        const msg = `Are you sure you want to permanently delete trip record ${trip.tripNo}? This wipes all linked payments, diesel, and driver expenses.`;
                        const onDeleteAction = () => {
                          onDeleteEntry(trip.id);
                          setActiveSpeedDialId(null);
                        };
                        if (confirmAction) {
                          confirmAction(msg, onDeleteAction, "Delete Cargo Entry Record");
                        } else if (confirm(msg)) {
                          onDeleteAction();
                        }
                      }}
                      class="w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-955/20 border border-rose-150 dark:border-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-455 hover:bg-rose-100/30 transition cursor-pointer disabled:opacity-45"
                      title="Delete Journey"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSpeedDialId(activeSpeedDialId() === trip.id ? null : trip.id)}
                    class="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95 cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-200"
                  >
                    {activeSpeedDialId() === trip.id ? (
                      <X class="w-4 h-4 transition-transform duration-300 rotate-90" />
                    ) : (
                      <Settings class="w-4 h-4 transition-transform duration-300" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        }))}
      </div>

      {/* PAGINATION FOOTER */}
      <div class="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs no-print">
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
              {[10, 25, 50, 100].map(size => (
                <option  value={size}>{size}</option>
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

      {/* MODERN LORRYGURU-STYLE TRIP SUMMARY MODAL */}
      <Show when={viewingEntry()}>
        <TripSummaryModal
          isOpen={!!viewingEntry()}
          onClose={() => setViewingEntry(null)}
          trip={viewingEntry()!}
          accounts={accounts()}
          trips={trips()}
          orgProfile={orgProfile()}
          onEditEntry={onEditEntry}
          onDeleteEntry={onDeleteEntry}
          onSaveTrips={onSaveTrips}
          canEditTrips={canEditTrips()}
          canDeleteTrips={canDeleteTrips()}
          confirmAction={confirmAction}
          setPreviewHtml={setPreviewHtml}
          setPreviewTitle={setPreviewTitle}
        />
      </Show>
      <ReportPreviewModal
        isOpen={!!previewHtml()}
        onClose={() => setPreviewHtml(null)}
        htmlContent={previewHtml() || ''}
        title={previewTitle()}
      />
    </div>
  );
}
