import { createSignal, onMount, createEffect, createMemo } from 'solid-js';

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

export default function TripList({
  trips,
  trucks,
  offices,
  accounts,
  onEditEntry,
  onDeleteEntry,
  confirmAction,
  canViewTrips = true,
  canEditTrips = true,
  canDeleteTrips = true,
  organizationId,
  onSaveTrips,
  auditLogs = [],
  currentUserRights,
  orgProfile
}: TripListProps) {
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
    if (online) return [];

    const filtered = trips.filter(trip => {
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

  // Update displayed trips when filter/sort results change
  createEffect(() => {
    const sorted = filteredAndSortedTrips();
    setTotalCount(sorted.length);
    setCurrentPage(1);
    const startIdx = 0;
    setDisplayedTrips(sorted.slice(startIdx, startIdx + pageSize()));
  });

  // Online Appwrite logic
  createEffect(() => {
    if (online) {
      const fetchServerTrips = async () => {
        setLoading(true);
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const orgId = organizationId || localStorage.getItem('ttt_organization_id') || 'org_default';

          let serverSortField = 'filterStartDate';
          if (['tripNo', 'truckNo', 'filterStartDate', 'status'].includes(sortField())) {
            serverSortField = sortField();
          }

          const res = await appwrite.queryTrips(
            databaseId,
            orgId,
            {
              search: search() || undefined,
              truckNo: selectedTruck() || undefined,
              status: selectedStatuses().length > 0 ? selectedStatuses() : undefined,
              startDate: filterStartDate() || undefined,
              endDate: filterEndDate() || undefined
            },
            currentPage(),
            pageSize(),
            serverSortField,
            sortDirection()
          );

          const mapped = (res.documents || []).map(doc => ({
            ...doc,
            id: doc.id || doc.$id
          }));
          const validTrips = mapped
            .filter(t => t.tripNo && t.tripNo.trim() !== '')
            .filter(t => {
              const isDeleted = !!t.deletedAt || t.status === 'Deleted';
              if (isDeleted) {
                return selectedStatuses().includes('Deleted');
              }
              if (selectedStatuses().length === 0) return true;
              const normalizedStatus = (t.status === 'Paid' || t.status === 'Pald') ? 'Settled' : t.status;
              return selectedStatuses().includes(normalizedStatus);
            });
          setDisplayedTrips(validTrips);
          setTotalCount(validTrips.length);
        } catch (err) {
          console.error("Failed to query trips from Appwrite:", err);
        } finally {
          setLoading(false);
        }
      };

      const delayDebounce = setTimeout(() => {
        fetchServerTrips();
      }, 300);

      return () => clearTimeout(delayDebounce);
    }
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
  const totals = (online ? displayedTrips() : trips.filter(trip => {
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
    const localFiltered = trips.filter(trip => {
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
    const fuelCard = orgProfile?.fuelCards?.find(fc => fc.id === id);
    if (fuelCard) return `${fuelCard.cardName} (Fuel Card)`;
    return accounts.find(a => a.id === id)?.accountName || id || 'Unmapped';
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

  const getStatusBadge = (status: TripStatus) => {
    switch (status) {
      case 'Pending':
        return <span class="px-2.5 py-1 text-xs font-semibold rounded-full border border-slate-200 bg-slate-50 text-slate-600">Pending</span>;
      case 'In Progress':
        return <span class="px-2.5 py-1 text-xs font-semibold rounded-full border border-amber-200 bg-amber-50 text-amber-700">In Progress</span>;
      case 'Completed':
        return <span class="px-2.5 py-1 text-xs font-semibold rounded-full border border-blue-200 bg-blue-50 text-blue-700">Completed</span>;
      case 'Settled':
        return <span class="px-2.5 py-1 text-xs font-semibold rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">Settled</span>;
      case 'Deleted':
        return <span class="px-2.5 py-1 text-xs font-semibold rounded-full border border-rose-200 bg-rose-50 text-rose-700">Deleted</span>;
      default:
        return null;
    }
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
              <span>Active Transport Journals</span>
              {loading() && <span class="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>}
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">Fleet performance auditing. Select custom master records to inspect sub-trip segments & expenditures.</p>
          </div>

          <button
            id="export-csv-btn"
            disabled={totalCount() === 0}
            onClick={handleExportCSV}
            class="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-905 disabled:opacity-45 disabled:hover:bg-transparent font-bold px-4 py-2.5 rounded-lg border border-slate-200 transition text-xs shadow-2xs cursor-pointer text-slate-905"
          >
            <FileSpreadsheet class="w-3.5 h-3.5 text-slate-500" /> Export Cumulative CSV (23 Columns)
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
              {trucks.map(t => (
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
                {renderSortableHeader('Trip ID (Group Code)', 'tripNo', 'px-6 py-4 pl-6 text-left')}
                {renderSortableHeader('Truck & Driver', 'truckNo', 'px-4 py-4 text-left')}
                {renderSortableHeader('Trip duration dates', 'filterStartDate', 'px-4 py-4 text-center')}
                {renderSortableHeader('Income Generated', 'income', 'px-4 py-4 text-right')}
                {renderSortableHeader('Operational Costs', 'totalExpense', 'px-4 py-4 text-right')}
                {renderSortableHeader('Net Profit Margin', 'profit', 'px-4 py-4 text-right')}
                {renderSortableHeader('Total Outstanding', 'outstandingBalance', 'px-4 py-4 text-right text-amber-700 bg-amber-50/15 font-extrabold')}
                {renderSortableHeader('Status', 'status', 'px-4 py-4 text-center')}
                <th class="px-6 py-4 text-right pr-6">Actions</th>
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
                              const html = generateTripPDF(trip, accounts, orgProfile);
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
                                  generateDriverReportPDF(trip, accounts, orgProfile);
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
                          {getStatusBadge(trip.status)}
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
                              disabled={!canEditTrips || trip.status === 'Deleted'}
                              onClick={() => onEditEntry(trip)}
                              class="p-1 px-2.5 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center h-8"
                            >
                              <Edit2 class="w-3.5 h-3.5" />
                            </button>
                            {/* DELETE ENTRY */}
                            <button
                              title="Wipe Cargo Entry record"
                              disabled={!canDeleteTrips || trip.status === 'Deleted'}
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
                          const html = generateTripPDF(trip, accounts, orgProfile);
                          setPreviewHtml(html);
                          setPreviewTitle(`Trip Report - ${trip.tripNo}`);
                        }}
                        class="text-[10px] text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1 mt-0.5 font-semibold cursor-pointer"
                        title="Download Trip Report"
                      >
                        <Download class="w-3.5 h-3.5" /> Download Report
                      </button>
                    </div>
                    {getStatusBadge(trip.status)}
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
                            const html = generateDriverReportPDF(trip, accounts, orgProfile);
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
                      disabled={!canEditTrips || trip.status === 'Deleted'}
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
                      disabled={!canDeleteTrips || trip.status === 'Deleted'}
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

      {/* SINGLE MASTER TRIP COMPLETE 23-COLUMNS PRINT AUDIT TAB MODAL */}
      {viewingEntry() && (() => {
        const m = getTripMetrics(viewingEntry());
        const startingKM = Number(viewingEntry().startingKM) || 0;
        const endingKM = Number(viewingEntry().endingKM) || 0;
        const category4CategoryAdvances = (Array.isArray(viewingEntry().advances) ? viewingEntry().advances : []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
        const category3DriverAdvancePayments = (Array.isArray(viewingEntry().payments) ? viewingEntry().payments : [])
          .filter(p => p.receivedBy === 'paid_to_driver_advance')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const totalIssuedToDriver = category4CategoryAdvances + category3DriverAdvancePayments;

        return (
          <div
            id="inspector-overlay"
            onClick={() => setViewingEntry(null)}
            class="fixed inset-0 bg-slate-950/65 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <div
              id="inspector-card"
              onClick={(e) => e.stopPropagation()}
              class="relative bg-white border border-slate-200 rounded-xl w-full max-w-4xl shadow-xl overflow-hidden animate-scale-up"
            >
              <div class="hidden md:block">
              {/* Close Button top-right absolute */}
              <button
                onClick={() => setViewingEntry(null)}
                class="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer z-10"
                title="Close"
              >
                <X class="w-4 h-4" />
              </button>

              <div class="px-6 py-4.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div class="pr-8 sm:pr-0">
                  <span class="text-[10px] text-blue-600 uppercase tracking-wider font-extrabold block">Ultimate Fleet-Book Document Ledger</span>
                  <h3 class="text-lg font-bold text-slate-900 font-mono tracking-wide">{viewingEntry().tripNo} &bull; {viewingEntry().truckNo}</h3>
                </div>
                <div class="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                  <button
                    onClick={() => {
                      const html = generateTripPDF(viewingEntry(), accounts, orgProfile);
                      setPreviewHtml(html);
                      setPreviewTitle(`Trip Report - ${viewingEntry().tripNo}`);
                    }}
                    class="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs rounded-lg transition cursor-pointer w-full sm:w-auto text-center"
                  >
                    <Printer class="w-3.5 h-3.5" /> Print PDF
                  </button>
                  <button
                    onClick={() => {
                      const html = generateDriverReportPDF(viewingEntry(), accounts, orgProfile);
                      setPreviewHtml(html);
                      setPreviewTitle(`Driver Settlement - ${viewingEntry().tripNo}`);
                    }}
                    class="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-lg transition cursor-pointer w-full sm:w-auto text-center"
                  >
                    <FileText class="w-3.5 h-3.5" /> Driver Report PDF
                  </button>
                  {canEditTrips && viewingEntry().status !== 'Deleted' && (
                    <button
                      onClick={() => {
                        onEditEntry(viewingEntry());
                        setViewingEntry(null);
                      }}
                      class="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs rounded-lg transition cursor-pointer w-full sm:w-auto text-center"
                    >
                      <Edit2 class="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  {canDeleteTrips && viewingEntry().status !== 'Deleted' && (
                    <button
                      onClick={() => {
                        const msg = `Caution! Deleting Master Trip ${viewingEntry().tripNo} will permanently delete all ${viewingEntry().subTrips?.length || 0} sub-trip segments and advanced payments receipt sheets. Continue?`;
                        if (confirmAction) {
                          confirmAction(msg, () => {
                            onDeleteEntry(viewingEntry().id);
                            setViewingEntry(null);
                          }, "Delete Master Trip Journey");
                        } else if (confirm(msg)) {
                          onDeleteEntry(viewingEntry().id);
                          setViewingEntry(null);
                        }
                      }}
                      class="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-705 font-extrabold text-xs rounded-lg transition cursor-pointer w-full sm:w-auto text-center"
                    >
                      <Trash2 class="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              </div>

              <div class="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* primary bento grid details */}
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  <div class="bg-slate-50/50 p-3 rounded-lg border border-slate-200">
                    <span class="text-[9px] text-slate-500 uppercase block font-bold leading-tight">Driver Person</span>
                    <span class="text-xs font-semibold text-slate-900 block mt-1">{viewingEntry().driverName || 'No Driver'}</span>
                  </div>
                  <div class="bg-slate-50/50 p-3 rounded-lg border border-slate-200">
                    <span class="text-[9px] text-slate-500 uppercase block font-bold leading-tight">Segment Dates</span>
                    <span class="text-xs font-semibold text-slate-800 font-mono block mt-1 truncate">{viewingEntry().startDate} to {viewingEntry().endDate}</span>
                  </div>
                  <div class="bg-slate-50/50 p-3 rounded-lg border border-slate-200">
                    <span class="text-[9px] text-slate-500 uppercase block font-bold leading-tight">Master odometer</span>
                    <span class="text-xs font-semibold text-slate-800 font-mono block mt-1">{viewingEntry().startingKM || 0} KM - {viewingEntry().endingKM || 0} KM</span>
                  </div>
                  <div class="bg-slate-50/50 p-3 rounded-lg border border-slate-200">
                    <span class="text-[9px] text-slate-500 uppercase block font-bold leading-tight">Distance Logged</span>
                    <span class="text-xs font-extrabold text-blue-650 font-mono block mt-1 text-blue-600">{m.totalKM} KM Range</span>
                  </div>
                  <div class="bg-slate-50/50 p-3 rounded-lg border border-slate-200">
                    <span class="text-[9px] text-slate-500 uppercase block font-bold leading-tight">Fuel Mileage</span>
                    <span class="text-xs font-extrabold text-amber-700 font-mono block mt-1">{m.fuelLiters > 0 ? `${m.millage.toFixed(2)} KM/L` : '0.00 KM/L'}</span>
                  </div>
                </div>

                {/* 24 flat parameters audit section */}
                <div class="border border-slate-200 rounded-xl overflow-hidden shadow-3xs bg-white">
                  <div class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold uppercase text-[10px] tracking-widest text-slate-655 flex justify-between">
                    <span>Flat Consolidated Specifications (24 Columns Schema)</span>
                    <span class="font-mono text-blue-600 text-xs font-extrabold">{viewingEntry().tripNo}</span>
                  </div>

                  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 divide-y divide-slate-100 p-4 font-mono text-[11px] gap-y-3">
                    <div class="pt-2">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">1. Truck No</span>
                      <span class="font-bold text-slate-800">{viewingEntry().truckNo}</span>
                    </div>
                    <div>
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">2. Trip No</span>
                      <span class="font-bold text-slate-800">{viewingEntry().tripNo}</span>
                    </div>
                    <div>
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">3. Trip Start</span>
                      <span class="text-slate-700">{viewingEntry().startDate || 'N/A'}</span>
                    </div>
                    <div>
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">4. Trip End</span>
                      <span class="text-slate-700">{viewingEntry().endDate || 'N/A'}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">5. Driver Name</span>
                      <span class="font-sans text-slate-800 font-semibold">{viewingEntry().driverName || 'N/A'}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">6. income (₹)</span>
                      <span class="font-extrabold text-slate-850 text-emerald-800">₹{m.income.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">7. Loading EXP</span>
                      <span class="text-slate-700">₹{m.loadingExpense.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">8. Unload EXP</span>
                      <span class="text-slate-700">₹{m.unloadingExpense.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">9. RTO EXP</span>
                      <span class="text-slate-700">₹{m.rtoExpense.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">10. Diesel EXP</span>
                      <span class="font-black text-rose-650 text-red-600">₹{m.dieselExpense.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">11. Add Blue</span>
                      <span class="text-slate-700">₹{m.addBlueExpense.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">12. Fastag EXP</span>
                      <span class="text-slate-700">₹{m.fastagExpense.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">13. Driver Wages</span>
                      <span class="text-slate-700">₹{m.driverWages.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">14. Other EXP</span>
                      <span class="text-slate-700">₹{m.otherExpense.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">15. Fuel Liters</span>
                      <span class="text-slate-700 font-extrabold">{m.fuelLiters} Liters</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">16. Starting KM</span>
                      <span class="text-slate-700">{viewingEntry().startingKM || 0} KM</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">17. Ending KM</span>
                      <span class="text-slate-700">{viewingEntry().endingKM || 0} KM</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">18. Total Range</span>
                      <span class="text-blue-600 font-bold">{m.totalKM} KM</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">19. Fuel Mileage</span>
                      <span class="font-extrabold text-amber-700 bg-amber-50 px-1 rounded">{m.fuelLiters > 0 ? `${m.millage.toFixed(2)} KM/L` : '0.00 KM/L'}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">20. Cost Per KM</span>
                      <span class="text-slate-800 font-bold">₹{m.perKM.toFixed(2)} / KM</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">21. Profit Per KM</span>
                      <span class={`font-bold ${m.profit >= 0 ? 'text-emerald-805 text-emerald-800' : 'text-red-700'}`}>₹{m.profitPerKM.toFixed(2)} / KM</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">22. Days Duration</span>
                      <span class="text-slate-800 font-bold">{m.noOfDays} Days</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">23. Total Outflow</span>
                      <span class="font-bold text-red-600">₹{m.totalExpense.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">24. Profit Yield</span>
                      <span class={`font-black tracking-tight text-xs ${m.profit >= 0 ? 'text-emerald-750 text-emerald-800' : 'text-red-700'}`}>₹{m.profit.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">Debit Status</span>
                      <span class="font-sans font-extrabold">{viewingEntry().status}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">Brokerage (Org)</span>
                      <span class="text-slate-700">₹{m.brokerageExpense.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">Crossing (Org)</span>
                      <span class="text-slate-700">₹{m.crossingExpense.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">Rental Deductions</span>
                      <span class="text-red-705 font-bold text-red-600">₹{m.totalOrgRentalDeductions.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">Driver Recovery</span>
                      <span class="text-amber-805 font-bold text-amber-800">₹{m.driverRecovery.toLocaleString()}</span>
                    </div>
                    <div class="pt-2.5">
                      <span class="text-slate-450 block font-sans text-[10px] uppercase font-bold">Driver Balance</span>
                      {(() => {
                        const balance = m.driverBalance;
                        if (balance < 0) {
                          return (
                            <span class="text-amber-800 font-extrabold">
                              Recover: ₹{Math.abs(balance).toLocaleString('en-IN')}
                            </span>
                          );
                        } else if (balance > 0) {
                          return (
                            <span class="text-emerald-800 font-extrabold">
                              Pay: ₹{balance.toLocaleString('en-IN')}
                            </span>
                          );
                        }
                        return <span class="text-slate-500 font-bold">₹0</span>;
                      })()}
                    </div>
                  </div>

                  {/* Carry Forward / Settle Option Banner */}
                  {m.driverBalance !== 0 && onSaveTrips && (() => {
                    const isDeficit = m.driverBalance < 0;
                    const balanceAmt = Math.abs(m.driverBalance);
                    const activeMode = selectedFwdMode();

                    const eligibleFwdTrips = trips.filter(
                      t => t.id !== viewingEntry().id &&
                        t.status !== 'Settled'
                    ).sort((a, b) => {
                      const aSame = a.driverName?.toLowerCase().trim() === viewingEntry().driverName?.toLowerCase().trim();
                      const bSame = b.driverName?.toLowerCase().trim() === viewingEntry().driverName?.toLowerCase().trim();
                      if (aSame && !bSame) return -1;
                      if (!aSame && bSame) return 1;
                      return a.tripNo.localeCompare(b.tripNo);
                    });

                    const hasSameDriverActiveTrip = eligibleFwdTrips.some(
                      t => t.driverName?.toLowerCase().trim() === viewingEntry().driverName?.toLowerCase().trim()
                    );

                    return (
                      <div class="bg-amber-50/50 border-t border-slate-200/85 p-4 flex flex-col gap-3.5 text-xs font-sans">
                        {/* Tab Headers for Deficit/Surplus Mode */}
                        <div class="flex border-b border-amber-200/40 pb-2 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedFwdMode('trip')}
                            class={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${activeMode === 'trip'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'text-slate-500 hover:text-slate-800'
                              }`}
                          >
                            Move to Another Trip
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedFwdMode('account')}
                            class={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer ${activeMode === 'account'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'text-slate-500 hover:text-slate-800'
                              }`}
                          >
                            Settle with Company Account
                          </button>
                        </div>

                        {activeMode === 'trip' && (() => {
                          if (eligibleFwdTrips.length === 0) {
                            return (
                              <div class="text-slate-600">
                                <span class="text-amber-800 font-extrabold uppercase text-[9px] tracking-wider block">
                                  {isDeficit ? 'Carry Forward Driver Deficit' : 'Carry Forward Driver Surplus'}
                                </span>
                                <span class="block mt-0.5">
                                  No other active/in-progress trips are currently registered in FleetTrack Pro. Create another active trip first to carry forward this {isDeficit ? 'deficit' : 'surplus'}.
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div class="space-y-3">
                              {/* Same Driver Warning */}
                              {!hasSameDriverActiveTrip && (
                                <div class="bg-amber-100/70 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-lg font-medium flex items-start gap-2">
                                  <AlertCircle class="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                  <span>⚠️ There is no active trip under the same driver name ({viewingEntry().driverName || 'N/A'}). Create an active trip for this driver to move funds.</span>
                                </div>
                              )}

                              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div class="flex flex-col gap-0.5">
                                  <span class="text-amber-855 text-amber-800 font-extrabold uppercase text-[9px] tracking-wider block">
                                    {isDeficit ? 'Carry Forward Driver Deficit' : 'Carry Forward Driver Surplus'}
                                  </span>
                                  <span class="text-slate-600 font-sans block mt-0.5">
                                    Move this {isDeficit ? 'negative' : 'positive'} balance of <strong class="text-slate-800 font-mono">₹{balanceAmt.toLocaleString('en-IN')}</strong> to another active trip.
                                  </span>
                                </div>
                                <div class="flex flex-col sm:flex-row sm:items-end w-full sm:w-auto gap-3 shrink-0">
                                  <div class="flex flex-col gap-0.5 w-full sm:w-auto">
                                    <span class="text-[8px] text-slate-400 font-bold uppercase">Tx Date</span>
                                    <input
                                      type="date"
                                      value={selectedFwdDate()}
                                      onChange={(e) => setSelectedFwdDate(e.target.value)}
                                      class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-blue-500 font-sans font-medium w-28 w-full sm:w-28"
                                    />
                                  </div>
                                  <div class="flex flex-col gap-0.5 w-full sm:w-auto">
                                    <span class="text-[8px] text-slate-400 font-bold uppercase">Target Trip</span>
                                    <select
                                      value={selectedFwdTripId()}
                                      onChange={(e) => setSelectedFwdTripId(e.target.value)}
                                      class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-blue-500 font-sans font-medium w-full sm:w-auto"
                                    >
                                      <option value="">-- Select Next Trip --</option>
                                      {eligibleFwdTrips.map(t => {
                                        const isSameDrv = t.driverName?.toLowerCase().trim() === viewingEntry().driverName?.toLowerCase().trim();
                                        return (
                                          <option  value={t.id}>
                                            {t.tripNo} - {t.driverName || 'No Driver'} ({t.truckNo}){isSameDrv ? ' (Same Driver)' : ''}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (!selectedFwdTripId()) {
                                        alert("Please select a target trip first.");
                                        return;
                                      }
                                      const destTrip = trips.find(t => t.id === selectedFwdTripId());
                                      if (!destTrip) return;

                                      const confirmMsg = isDeficit
                                        ? `Are you sure you want to carry forward the driver deficit of ₹${balanceAmt.toLocaleString('en-IN')} from ${viewingEntry().tripNo} to ${destTrip.tripNo}?\n\nThis will offset the negative balance on ${viewingEntry().tripNo} and add it as a new advance on ${destTrip.tripNo}.`
                                        : `Are you sure you want to carry forward the driver surplus of ₹${balanceAmt.toLocaleString('en-IN')} from ${viewingEntry().tripNo} to ${destTrip.tripNo}?\n\nThis will offset the positive balance on ${viewingEntry().tripNo} and transfer it as a credit/negative advance on ${destTrip.tripNo}.`;

                                      const performFwd = () => {
                                        const fwdAdvanceSource: TripAdvance = {
                                          id: 'fwd_out_' + Date.now(),
                                          amount: isDeficit ? -balanceAmt : balanceAmt,
                                          date: selectedFwdDate() || new Date().toISOString().substring(0, 10),
                                          fromAccountId: 'Direct Driver',
                                          notes: isDeficit
                                            ? `Negative balance carried forward to ${destTrip.tripNo}`
                                            : `Excess amount/surplus carried forward to ${destTrip.tripNo}`,
                                          receivedByDriverDirectly: true
                                        };

                                        const fwdAdvanceDest: TripAdvance = {
                                          id: 'fwd_in_' + Date.now(),
                                          amount: isDeficit ? balanceAmt : -balanceAmt,
                                          date: selectedFwdDate() || new Date().toISOString().substring(0, 10),
                                          fromAccountId: 'Direct Driver',
                                          notes: isDeficit
                                            ? `Negative balance carried forward from ${viewingEntry().tripNo}`
                                            : `Excess amount/surplus carried forward from ${viewingEntry().tripNo}`,
                                          receivedByDriverDirectly: true
                                        };

                                        const updatedSource = {
                                          ...viewingEntry(),
                                          advances: [...(viewingEntry().advances || []), fwdAdvanceSource],
                                          syncState: 'pending' as const,
                                          updatedAt: new Date().toISOString()
                                        };

                                        const updatedDest = {
                                          ...destTrip,
                                          advances: [...(destTrip.advances || []), fwdAdvanceDest],
                                          syncState: 'pending' as const,
                                          updatedAt: new Date().toISOString()
                                        };

                                        const updatedTrips = trips.map(t => {
                                          if (t.id === updatedSource.id) return updatedSource;
                                          if (t.id === updatedDest.id) return updatedDest;
                                          return t;
                                        });

                                        onSaveTrips(updatedTrips);
                                        setViewingEntry(updatedSource);
                                        setSelectedFwdTripId('');
                                        alert(`Successfully carried forward ₹${balanceAmt.toLocaleString('en-IN')} to ${destTrip.tripNo}.`);
                                      };

                                      if (confirmAction) {
                                        confirmAction(confirmMsg, performFwd, "Carry Forward Balance");
                                      } else if (confirm(confirmMsg)) {
                                        performFwd();
                                      }
                                    }}
                                    class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-xs shrink-0 cursor-pointer font-sans w-full sm:w-auto"
                                  >
                                    Move Funds
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {activeMode === 'account' && (() => {
                          const activeAccounts = accounts.filter(a => a.status === 'Active');
                          const targetAccount = accounts.find(a => a.id === selectedFwdAccountId());
                          const accountName = targetAccount ? targetAccount.accountName : selectedFwdAccountId();

                          const confirmMsg = isDeficit
                            ? `Are you sure you want to move the driver deficit of ₹${balanceAmt.toLocaleString('en-IN')} from ${viewingEntry().tripNo} to company account "${accountName}"?\n\nThis will record a negative advance on this trip to zero out the driver's balance.`
                            : `Are you sure you want to pay the driver surplus of ₹${balanceAmt.toLocaleString('en-IN')} from company account "${accountName}" for ${viewingEntry().tripNo}?\n\nThis will record a positive advance on this trip to zero out the driver's balance.`;

                          const performAccountSettle = () => {
                            const settleAdvance: TripAdvance = {
                              id: 'fwd_settle_' + Date.now(),
                              amount: isDeficit ? -balanceAmt : balanceAmt,
                              date: selectedFwdDate() || new Date().toISOString().substring(0, 10),
                              fromAccountId: selectedFwdAccountId(),
                              notes: isDeficit
                                ? `Negative balance moved/returned to company account: ${accountName}`
                                : `Positive balance paid to driver from company account: ${accountName}`,
                              receivedByDriverDirectly: false
                            };

                            const updatedSource = {
                              ...viewingEntry(),
                              advances: [...(viewingEntry().advances || []), settleAdvance]
                            };

                            const updatedTrips = trips.map(t => {
                              if (t.id === updatedSource.id) return updatedSource;
                              return t;
                            });

                            onSaveTrips(updatedTrips);
                            setViewingEntry(updatedSource);
                            setSelectedFwdAccountId('');
                            alert(isDeficit
                              ? `Successfully settled ₹${balanceAmt.toLocaleString('en-IN')} deficit to account: ${accountName}.`
                              : `Successfully paid ₹${balanceAmt.toLocaleString('en-IN')} surplus from account: ${accountName}.`
                            );
                          };

                          return (
                            <div class="space-y-3">
                              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div class="flex flex-col gap-0.5">
                                  <span class={`${isDeficit ? 'text-amber-800' : 'text-emerald-805 text-emerald-800'} font-extrabold uppercase text-[9px] tracking-wider block`}>
                                    {isDeficit ? 'Settle Deficit to Company Account' : 'Pay Driver Surplus from Company Account'}
                                  </span>
                                  <span class="text-slate-600 font-sans block mt-0.5">
                                    {isDeficit ? (
                                      <span>
                                        Receive driver returned funds of <strong class="text-slate-800 font-mono">₹{balanceAmt.toLocaleString('en-IN')}</strong> into a company account.
                                      </span>
                                    ) : (
                                      <span>
                                        Pay driver out-of-pocket surplus of <strong class="text-slate-800 font-mono">₹{balanceAmt.toLocaleString('en-IN')}</strong> from a company account.
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div class="flex flex-col sm:flex-row sm:items-end w-full sm:w-auto gap-3 shrink-0">
                                  <div class="flex flex-col gap-0.5 w-full sm:w-auto">
                                    <span class="text-[8px] text-slate-400 font-bold uppercase">Tx Date</span>
                                    <input
                                      type="date"
                                      value={selectedFwdDate()}
                                      onChange={(e) => setSelectedFwdDate(e.target.value)}
                                      class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-blue-500 font-sans font-medium w-28 w-full sm:w-28"
                                    />
                                  </div>
                                  <div class="flex flex-col gap-0.5 w-full sm:w-auto">
                                    <span class="text-[8px] text-slate-400 font-bold uppercase">Company Account</span>
                                    <select
                                      value={selectedFwdAccountId()}
                                      onChange={(e) => setSelectedFwdAccountId(e.target.value)}
                                      class="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none focus:border-blue-500 font-sans font-medium w-full sm:w-auto"
                                    >
                                      <option value="">-- Select Company Account --</option>
                                      <option value="Cash">Cash</option>
                                      {activeAccounts.map(a => (
                                        <option  value={a.id}>
                                          {a.accountName} ({a.type})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (!selectedFwdAccountId()) {
                                        alert("Please select a target company account first.");
                                        return;
                                      }
                                      if (confirmAction) {
                                        confirmAction(confirmMsg, performAccountSettle, isDeficit ? "Settle Deficit" : "Pay Driver");
                                      } else if (confirm(confirmMsg)) {
                                        performAccountSettle();
                                      }
                                    }}
                                    class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-xs shrink-0 cursor-pointer font-sans w-full sm:w-auto"
                                  >
                                    Move Funds
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>

                {/* sub trip details segments table inside the modal */}
                <div>
                  <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 pl-1 font-sans">
                    Detailed Segments & Loader Outlaws ({viewingEntry().subTrips?.length || 0} cargo loads)
                  </h4>
                  <div class="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                    {(!viewingEntry().subTrips || viewingEntry().subTrips.length === 0) ? (
                      <p class="p-4 text-center text-slate-400 italic">No sub-trip segments logged.</p>
                    ) : (
                      [...viewingEntry().subTrips].sort((a, b) => (a.loadingDate || '').localeCompare(b.loadingDate || '')).map((s, idx) => {
                        const expenses = (s.cargoExpenses && s.cargoExpenses.length > 0)
                          ? s.cargoExpenses
                          : importLegacyCargoExpenses(s);

                        const segmentDeductions = expenses
                          .filter(exp => exp.deductedFrom === 'OrgRental')
                          .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

                        const segmentOfficeBears = expenses
                          .filter(exp => exp.bears === 'Office')
                          .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

                        const segmentPayments = (viewingEntry().payments || [])
                          .filter(p => p.subTripId === s.id)
                          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

                        const segmentReceivable = s.income - segmentDeductions + segmentOfficeBears - segmentPayments;

                        return (
                          <div  class="p-4 hover:bg-slate-50/50 transition">
                            <div class="flex justify-between items-center bg-slate-50/70 p-2 rounded-lg border border-slate-150 mb-3">
                              <span class="text-slate-800 font-mono font-bold font-sans">Segment #{idx + 1} &bull; {s.routeFrom} &rarr; {s.routeTo}</span>
                              <span class="font-sans font-bold text-slate-500 text-[10px] bg-slate-205 py-0.5 px-2 rounded-md bg-slate-200 uppercase leading-none">Office: {s.officeName}</span>
                            </div>

                            {(s.material || s.noOfTons !== undefined || s.ratePerTon !== undefined || segmentReceivable > 0) && (
                              <div class="bg-blue-50/40 border border-blue-100 rounded-lg p-2.5 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-sans text-slate-700">
                                {s.material && (
                                  <div>
                                    <span class="text-slate-400 block uppercase text-[8px] font-bold">Material</span>
                                    <strong class="text-slate-800">{s.material}</strong>
                                  </div>
                                )}
                                {s.noOfTons !== undefined && s.noOfTons > 0 && (
                                  <div>
                                    <span class="text-slate-400 block uppercase text-[8px] font-bold">Weight (Tons)</span>
                                    <strong class="text-slate-800 font-mono">{s.noOfTons} MT</strong>
                                  </div>
                                )}
                                {s.ratePerTon !== undefined && s.ratePerTon > 0 && (
                                  <div>
                                    <span class="text-slate-400 block uppercase text-[8px] font-bold">Rate / Ton</span>
                                    <strong class="text-slate-800 font-mono">₹{s.ratePerTon.toLocaleString()}</strong>
                                  </div>
                                )}
                                {segmentReceivable > 0 && (
                                  <div class="ml-auto text-right">
                                    <span class="text-amber-600 block uppercase text-[8px] font-bold">Outstanding</span>
                                    <strong class="text-amber-700 font-mono">₹{segmentReceivable.toLocaleString()}</strong>
                                  </div>
                                )}
                              </div>
                            )}

                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-1 text-[11px] font-sans">
                              <div class="p-1 px-2 border-l-2 border-emerald-500">
                                <span class="text-slate-450 block font-sans text-[9px] uppercase">Income (₹)</span>
                                <span class="font-mono font-bold text-emerald-800">₹{s.income.toLocaleString()}</span>
                              </div>
                              <div class={`p-1 px-2 border-l-2 ${segmentReceivable > 0 ? 'border-blue-500' :
                                  segmentReceivable === 0 ? 'border-slate-300' :
                                    'border-amber-500'
                                }`}>
                                <span class="text-slate-450 block font-sans text-[9px] uppercase">Receivable (₹)</span>
                                <span class={`font-mono font-bold ${segmentReceivable > 0 ? 'text-blue-800' :
                                    segmentReceivable === 0 ? 'text-slate-500' :
                                      'text-amber-805 text-amber-800'
                                  }`}>
                                  ₹{segmentReceivable.toLocaleString()}
                                </span>
                              </div>
                              <div class="p-1 px-2 border-l-2 border-red-500">
                                <span class="text-slate-450 block font-sans text-[9px] uppercase">Diesel Cost / Liters</span>
                                <span class="font-mono font-bold text-slate-800">₹{(s.dieselAmount || 0).toLocaleString()} <span class="text-[10px] font-normal text-slate-450">({s.dieselLiters} L @ ₹{s.dieselRate})</span></span>
                              </div>
                              <div class="p-1 px-2 border-l-2 border-slate-400">
                                <span class="text-slate-450 block font-sans text-[9px] uppercase">Wages + Other</span>
                                <span class="font-mono font-bold text-slate-800">Wages: ₹{(s.driverWages || 0).toLocaleString()} | Other: ₹{(s.otherExpense || 0).toLocaleString()}</span>
                              </div>
                            </div>

                            {/* Segment Charges Settlement Info */}
                            <div class="mt-3.5 pt-3.5 border-t border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px]">
                              {s.cargoExpenses && s.cargoExpenses.length > 0 ? (
                                s.cargoExpenses.map((exp) => (
                                  <div  class="p-1.5 px-2 bg-slate-50 border border-slate-200 rounded">
                                    <span class="text-slate-500 block font-bold uppercase text-[8px]">{exp.expenseType} Expense</span>
                                    <strong class="text-slate-855 block">₹{exp.amount.toLocaleString()}</strong>
                                    <span class="text-[9px] text-slate-400 block mt-0.5 font-semibold">
                                      {exp.paidByDriver ? 'Driver Paid' : exp.deductedFrom === 'OrgPaid' ? 'Org Paid (Direct)' : 'Office Deduct'}
                                    </span>
                                    <span class={`text-[9px] font-semibold block mt-0.5 font-mono ${exp.bears === 'Org' ? 'text-blue-650' :
                                        exp.bears === 'Driver' ? 'text-amber-600' :
                                          'text-purple-600'
                                      }`}>
                                      {exp.bears === 'Org' ? 'Fully Org' : exp.bears === 'Driver' ? 'Fully Driver' : 'Fully Office'}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <>
                                  {s.loadingExpense !== undefined && s.loadingExpense > 0 && (() => {
                                    const df = s.loadingDeductedFrom || 'DriverDirect';
                                    const isSplit = s.loadingBearsOrg !== undefined || s.loadingBearsDriver !== undefined;
                                    const bearsOrg = s.loadingBearsOrg !== undefined ? s.loadingBearsOrg : (s.loadingBears === 'Org' ? s.loadingExpense : 0);
                                    const bearsDriver = s.loadingBearsDriver !== undefined ? s.loadingBearsDriver : (s.loadingBears === 'Driver' ? s.loadingExpense : 0);
                                    return (
                                      <div class="p-1.5 px-2 bg-slate-50 border border-slate-200 rounded">
                                        <span class="text-slate-500 block font-bold uppercase text-[8px]">Loading Expense</span>
                                        <strong class="text-slate-855 block">₹{s.loadingExpense.toLocaleString()}</strong>
                                        <span class="text-[9px] text-slate-400 block mt-0.5 font-semibold">
                                          {df === 'OrgRental' ? 'Office Deduct' : 'Driver Paid'}
                                        </span>
                                        <span class="text-[9px] font-semibold text-blue-650 block mt-0.5 font-mono">
                                          {isSplit ? `Org: ₹${bearsOrg.toLocaleString()} | Drv: ₹${bearsDriver.toLocaleString()}` : (s.loadingBears === 'Driver' ? 'Fully Driver' : 'Fully Org')}
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  {s.unloadingExpense !== undefined && s.unloadingExpense > 0 && (() => {
                                    const df = s.unloadingDeductedFrom || 'DriverDirect';
                                    const isSplit = s.unloadingBearsOrg !== undefined || s.unloadingBearsDriver !== undefined;
                                    const bearsOrg = s.unloadingBearsOrg !== undefined ? s.unloadingBearsOrg : (s.unloadingBears === 'Org' ? s.unloadingExpense : 0);
                                    const bearsDriver = s.unloadingBearsDriver !== undefined ? s.unloadingBearsDriver : (s.unloadingBears === 'Driver' ? s.unloadingExpense : 0);
                                    return (
                                      <div class="p-1.5 px-2 bg-slate-50 border border-slate-200 rounded">
                                        <span class="text-slate-500 block font-bold uppercase text-[8px]">Unloading Expense</span>
                                        <strong class="text-slate-855 block">₹{s.unloadingExpense.toLocaleString()}</strong>
                                        <span class="text-[9px] text-slate-400 block mt-0.5 font-semibold">
                                          {df === 'OrgRental' ? 'Office Deduct' : 'Driver Paid'}
                                        </span>
                                        <span class="text-[9px] font-semibold text-blue-650 block mt-0.5 font-mono">
                                          {isSplit ? `Org: ₹${bearsOrg.toLocaleString()} | Drv: ₹${bearsDriver.toLocaleString()}` : (s.unloadingBears === 'Driver' ? 'Fully Driver' : 'Fully Org')}
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  {s.brokerageExpense !== undefined && s.brokerageExpense > 0 && (() => {
                                    const df = s.brokerageDeductedFrom || 'DriverDirect';
                                    const isSplit = s.brokerageBearsOrg !== undefined || s.brokerageBearsDriver !== undefined;
                                    const bearsOrg = s.brokerageBearsOrg !== undefined ? s.brokerageBearsOrg : (s.brokerageBears === 'Org' ? s.brokerageExpense : 0);
                                    const bearsDriver = s.brokerageBearsDriver !== undefined ? s.brokerageBearsDriver : (s.brokerageBears === 'Driver' ? s.brokerageExpense : 0);
                                    return (
                                      <div class="p-1.5 px-2 bg-slate-50 border border-slate-200 rounded">
                                        <span class="text-slate-500 block font-bold uppercase text-[8px]">Brokerage Expense</span>
                                        <strong class="text-slate-855 block">₹{s.brokerageExpense.toLocaleString()}</strong>
                                        <span class="text-[9px] text-slate-400 block mt-0.5 font-semibold">
                                          {df === 'OrgRental' ? 'Office Deduct' : 'Driver Paid'}
                                        </span>
                                        <span class="text-[9px] font-semibold text-blue-650 block mt-0.5 font-mono">
                                          {isSplit ? `Org: ₹${bearsOrg.toLocaleString()} | Drv: ₹${bearsDriver.toLocaleString()}` : (s.brokerageBears === 'Org' ? 'Fully Org' : 'Fully Driver')}
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  {s.crossingExpense !== undefined && s.crossingExpense > 0 && (() => {
                                    const df = s.crossingDeductedFrom || 'DriverDirect';
                                    const isSplit = s.crossingBearsOrg !== undefined || s.crossingBearsDriver !== undefined;
                                    const bearsOrg = s.crossingBearsOrg !== undefined ? s.crossingBearsOrg : (s.crossingBears === 'Org' ? s.crossingExpense : 0);
                                    const bearsDriver = s.crossingBearsDriver !== undefined ? s.crossingBearsDriver : (s.crossingBears === 'Driver' ? s.crossingExpense : 0);
                                    return (
                                      <div class="p-1.5 px-2 bg-slate-50 border border-slate-200 rounded">
                                        <span class="text-slate-500 block font-bold uppercase text-[8px]">Crossing Expense</span>
                                        <strong class="text-slate-855 block">₹{s.crossingExpense.toLocaleString()}</strong>
                                        <span class="text-[9px] text-slate-400 block mt-0.5 font-semibold">
                                          {df === 'OrgRental' ? 'Office Deduct' : 'Driver Paid'}
                                        </span>
                                        <span class="text-[9px] font-semibold text-blue-650 block mt-0.5 font-mono">
                                          {isSplit ? `Org: ₹${bearsOrg.toLocaleString()} | Drv: ₹${bearsDriver.toLocaleString()}` : (s.crossingBears === 'Driver' ? 'Fully Driver' : 'Fully Org')}
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  {s.rmcExpense !== undefined && s.rmcExpense > 0 && (() => {
                                    const df = s.rmcDeductedFrom || 'DriverDirect';
                                    const isSplit = s.rmcBearsOrg !== undefined || s.rmcBearsDriver !== undefined;
                                    const bearsOrg = s.rmcBearsOrg !== undefined ? s.rmcBearsOrg : (s.rmcBears === 'Org' ? s.rmcExpense : 0);
                                    const bearsDriver = s.rmcBearsDriver !== undefined ? s.rmcBearsDriver : (s.rmcBears === 'Driver' ? s.rmcExpense : 0);
                                    return (
                                      <div class="p-1.5 px-2 bg-slate-50 border border-slate-200 rounded">
                                        <span class="text-slate-500 block font-bold uppercase text-[8px]">RMC Expense</span>
                                        <strong class="text-slate-855 block">₹{s.rmcExpense.toLocaleString()}</strong>
                                        <span class="text-[9px] text-slate-400 block mt-0.5 font-semibold">
                                          {df === 'OrgRental' ? 'Office Deduct' : 'Driver Paid'}
                                        </span>
                                        <span class="text-[9px] font-semibold text-blue-650 block mt-0.5 font-mono">
                                          {isSplit ? `Org: ₹${bearsOrg.toLocaleString()} | Drv: ₹${bearsDriver.toLocaleString()}` : (s.rmcBears === 'Driver' ? 'Fully Driver' : 'Fully Org')}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </>
                              )}

                              {/* Segment POD Details */}
                              {s.pod && (
                                <div class="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-sans text-slate-700">
                                  <div class="flex items-center gap-1">
                                    <span class="text-slate-450 uppercase text-[8px] font-bold block">POD Status</span>
                                    <span class={`px-2 py-0.5 rounded text-[10px] font-bold ${s.pod.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                        s.pod.status === 'Delayed' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                          'bg-blue-50 text-blue-700 border border-blue-200'
                                      }`}
                                      title={`Delivery Date: ${s.pod.date || 'N/A'}`}
                                    >
                                      {s.pod.status || 'Pending'}
                                    </span>
                                  </div>
                                  <div>
                                    <span class="text-slate-450 block uppercase text-[8px] font-bold">Courier</span>
                                    <strong class="text-slate-800">{s.pod.courierName}</strong>
                                  </div>
                                  <div>
                                    <span class="text-slate-450 block uppercase text-[8px] font-bold">Ref No / Tracking ID</span>
                                    <strong class="text-slate-800 font-mono">{s.pod.refNo}</strong>
                                  </div>
                                  {s.pod.date && (
                                    <div>
                                      <span class="text-slate-450 block uppercase text-[8px] font-bold">POD Date</span>
                                      <strong class="text-slate-800 font-mono">{s.pod.date}</strong>
                                    </div>
                                  )}
                                  {s.pod.attachmentId && (
                                    <div class="ml-auto flex gap-2">
                                      <a
                                        href={appwrite.getFileView(s.pod.attachmentId)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="text-blue-600 hover:text-blue-800 font-bold hover:underline"
                                      >
                                        View POD File
                                      </a>
                                      <a
                                        href={appwrite.getFileDownload(s.pod.attachmentId)}
                                        class="text-slate-600 hover:text-slate-800 font-bold hover:underline"
                                      >
                                        Download
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }))
                    }
                  </div>
                </div>

                {/* payments logs within modal audit sheet */}
                <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div class="bg-slate-50 px-4 py-2 border-b border-slate-200">
                    <span class="text-[10px] text-blue-650 uppercase tracking-wider font-extrabold">Advances & Outstanding collection log</span>
                  </div>
                  <div class="divide-y divide-slate-150">
                    {(!viewingEntry().payments || viewingEntry().payments.length === 0) ? (
                      <div class="p-4 text-center text-xs text-slate-400 italic">No payments or receipts registered. Balance is 100% collectable.</div>
                    ) : (
                      [...viewingEntry().payments].sort((a, b) => a.date.localeCompare(b.date)).map((p, pidx) => (
                        <div  class="p-3 text-xs flex justify-between items-center items-center hover:bg-slate-50/50">
                          <div>
                            <span class="font-bold text-slate-700">Receipt Line #{pidx + 1}</span>
                            {p.notes && <p class="text-[10px] text-slate-400 mt-0.5 italic">{p.notes}</p>}
                          </div>
                          <div class="flex items-center gap-6 font-mono font-bold">
                            <span class="text-slate-900 border border-slate-150 rounded px-2 bg-slate-50 py-0.5">₹{p.amount.toLocaleString()}</span>
                            <span class="text-blue-650 font-bold font-sans text-[11px]">{getAccountName(p.receivedBy)}</span>
                            <span class="text-slate-450 text-[10px] font-normal font-mono">{p.date}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* remarks */}
                {viewingEntry().notes && (
                  <div class="bg-amber-50/75 border border-amber-100 rounded-xl p-4 text-xs text-slate-600">
                    <span class="text-[10px] font-bold text-amber-800 uppercase tracking-widest block mb-1">Remarks / Audit warnings</span>
                    <p class="leading-relaxed">{viewingEntry().notes}</p>
                  </div>
                )}

                {/* Audit Trail Log View (Only for Admins) */}
                {currentUserRights?.isAdmin && (
                  <div class="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
                    <div class="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                      <span class="text-[10px] text-blue-655 uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                        <History class="w-3.5 h-3.5" />
                        Trip Audit Trail Logs
                      </span>
                      <span class="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 font-mono font-extrabold px-2 py-0.5 rounded">
                        Admin Access Only
                      </span>
                    </div>
                    <div class="p-4 space-y-4 max-h-72 overflow-y-auto">
                      {(() => {
                        const tripLogs = (auditLogs || [])
                          .filter(log => log.category === 'Trip' && log.reference === viewingEntry().tripNo)
                          .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

                        if (tripLogs.length === 0) {
                          return (
                            <div class="text-center py-6 text-slate-450 italic text-xs">
                              No audit trail logs recorded for this trip.
                            </div>
                          );
                        }

                        const getActionBadgeLocal = (action: string) => {
                          switch (action) {
                            case 'Created':
                              return <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">Created</span>;
                            case 'Edited':
                              return <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">Edited</span>;
                            case 'Deleted':
                              return <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">Deleted</span>;
                            default:
                              return <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-150 text-slate-650 border border-slate-200">{action}</span>;
                          }
                        };

                        return (
                          <div class="relative border-l border-slate-200 pl-4 ml-2 space-y-4 py-1 text-left">
                            {tripLogs.map((log, idx) => (
                              <div  class="relative">
                                {/* Timeline Dot */}
                                <span class="absolute -left-[21px] top-1 flex items-center justify-center w-3 h-3 rounded-full bg-slate-100 border border-slate-350">
                                  <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                </span>
                                <div class="space-y-1 text-xs">
                                  <div class="flex justify-between items-center gap-2">
                                    <div class="flex items-center gap-2">
                                      {getActionBadgeLocal(log.action)}
                                      <span class="font-semibold text-slate-700">{log.user}</span>
                                    </div>
                                    <span class="text-[10px] text-slate-405 font-mono">{log.timestamp}</span>
                                  </div>
                                  <div class="bg-slate-50 border border-slate-150/70 p-2.5 rounded-lg text-slate-600 leading-normal">
                                    {log.details && (log.details.includes('➔') || log.details.includes('|')) ? (
                                      <div class="flex flex-col gap-1.5">
                                        {log.details.split(' | ').map((change, cidx) => {
                                          const arrowIdx = change.indexOf('➔');
                                          if (arrowIdx !== -1) {
                                            const colonIdx = change.indexOf(':');
                                            if (colonIdx !== -1 && colonIdx < arrowIdx) {
                                              const field = change.substring(0, colonIdx);
                                              const values = change.substring(colonIdx + 1).trim();
                                              const valuesSplit = values.split('➔');
                                              const oldVal = valuesSplit[0]?.trim().replace(/^"|"$/g, '') || '';
                                              const newVal = valuesSplit[1]?.trim().replace(/^"|"$/g, '') || '';
                                              return (
                                                <div  class="flex flex-wrap items-center gap-1.5 text-[11px] leading-none">
                                                  <span class="font-bold text-slate-650 bg-slate-200/60 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">{field}</span>
                                                  <span class="text-slate-400 line-through truncate max-w-[100px] inline-block font-mono bg-slate-100 px-1 rounded text-[10px]" title={oldVal}>{oldVal}</span>
                                                  <span class="text-slate-400 font-bold">&rarr;</span>
                                                  <span class="text-blue-750 font-black truncate max-w-[130px] inline-block font-mono bg-blue-50 px-1 rounded text-[10px]" title={newVal}>{newVal}</span>
                                                </div>
                                              );
                                            }
                                          }
                                          return <div  class="text-slate-650 text-[11px] leading-tight font-medium">&bull; {change}</div>;
                                        })}
                                      </div>
                                    ) : (
                                      <span>{log.details}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 text-right">
                <button
                  id="inspector-close-bottom"
                  onClick={() => setViewingEntry(null)}
                  class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition shadow-2xs cursor-pointer h-10"
                >
                  Finished Review
                </button>
              </div>
            </div>

            {/* MOBILE VIEW */}
            <div class="flex md:hidden flex-col max-h-[90vh] overflow-hidden bg-slate-50 text-slate-800">
                {/* Mobile Sticky Header */}
                <div class="p-4 bg-white border-b border-slate-200/85 sticky top-0 z-20 flex flex-col gap-2 shrink-0">
                  <div class="flex justify-between items-center pr-8">
                    <div>
                      <span class="text-[10px] text-blue-600 font-extrabold uppercase tracking-wide">Trip Details</span>
                      <h4 class="font-mono font-black text-slate-900 text-sm mt-0.5">{viewingEntry().tripNo}</h4>
                    </div>
                    {getStatusBadge(viewingEntry().status)}
                  </div>
                  
                  {/* Vehicle & Driver Details HUD */}
                  <div class="flex items-center gap-2 text-xs bg-slate-50 border border-slate-150 rounded-lg p-2 mt-1">
                    <div class="flex items-center gap-1 font-mono font-bold text-slate-900 shrink-0">
                      <span class="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                      {viewingEntry().truckNo}
                    </div>
                    <span class="text-slate-350">|</span>
                    <div class="flex items-center gap-1 text-slate-600 truncate">
                      <User class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span class="truncate font-semibold">{viewingEntry().driverName || 'No Driver'}</span>
                    </div>
                  </div>

                  {/* Tab Selector */}
                  <div class="flex border-b border-slate-200/50 mt-1.5 gap-2 text-xs font-semibold overflow-x-auto scrollbar-none py-1">
                    {(currentUserRights?.isAdmin ? (['loads', 'profit', 'driver', 'actions', 'audit'] as const) : (['loads', 'profit', 'driver', 'actions'] as const)).map((tab) => {
                      const isActive = activeTab() === tab;
                      const label = {
                        loads: 'Journey & Loads',
                        profit: 'Profit & Costs',
                        driver: 'Driver Ledger',
                        actions: 'More Actions',
                        audit: 'Audit Trail'
                      }[tab];
                      return (
                        <button
                          
                          onClick={() => setActiveTab(tab)}
                          class={`pb-2 px-1 font-bold whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                            isActive 
                              ? 'border-blue-600 text-blue-600 font-extrabold' 
                              : 'border-transparent text-slate-500 hover:text-slate-750'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab Scrollable Body */}
                <div class="flex-1 overflow-y-auto p-4 space-y-4 max-h-[60vh]">
                  {/* LOADS TAB */}
                  {activeTab() === 'loads' && (
                    <div class="space-y-4 animate-fade-in">
                      {/* Vertical timeline of subtrips */}
                      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-3xs space-y-4 relative overflow-hidden">
                        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                        <h5 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">Route Segments ({viewingEntry().subTrips?.length || 0})</h5>
                        
                        {(!viewingEntry().subTrips || viewingEntry().subTrips.length === 0) ? (
                          <p class="text-xs text-slate-450 italic py-4 text-center">No route segments registered.</p>
                        ) : (
                          <div class="relative border-l border-slate-200 pl-4 ml-2 space-y-6 py-2">
                            {viewingEntry().subTrips.map((s, idx) => (
                              <div  class="relative">
                                {/* Bullet indicator */}
                                <span class="absolute -left-[21px] top-1 flex items-center justify-center w-3 h-3 rounded-full bg-blue-100 border border-blue-500">
                                  <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                </span>
                                
                                <div class="space-y-1">
                                  <div class="flex justify-between items-start">
                                    <strong class="text-xs text-slate-900 block font-sans">
                                      {s.routeFrom || 'Origin'} &rarr; {s.routeTo || 'Destination'}
                                    </strong>
                                    <span class="font-mono text-xs font-bold text-slate-800">
                                      ₹{(s.income || 0).toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                  
                                  <p class="text-[10px] text-slate-500 flex items-center gap-2">
                                    <span>Date: {dateFormatted(s.loadingDate)}</span>
                                    <span>•</span>
                                    <span>Odo: {s.startingKM} - {s.endingKM} KM ({(s.endingKM - s.startingKM) || 0} KM)</span>
                                  </p>
                                  <p class="text-[10px] text-slate-600 font-semibold mt-0.5">
                                    Broker: <span class="text-slate-800">{s.officeName || 'General'}</span>
                                  </p>

                                  {/* Cargo Expenses for this sub-trip */}
                                  {s.cargoExpenses && s.cargoExpenses.length > 0 && (
                                    <div class="flex flex-wrap gap-1 mt-1.5">
                                      {s.cargoExpenses.map((ce) => (
                                        <span  class="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-semibold border border-slate-200">
                                          {ce.expenseType}: ₹{ce.amount} ({ce.bears === 'Org' ? 'Org' : 'Drv'})
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Mileage & Odometer Dashboard */}
                      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-3xs space-y-3">
                        <h5 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Odometer & Fuel Dashboard</h5>
                        <div class="grid grid-cols-2 gap-3 text-xs">
                          <div class="bg-slate-55 p-2.5 rounded-xl border border-slate-150">
                            <span class="text-[9px] text-slate-450 uppercase font-bold">Odometer Range</span>
                            <strong class="block text-slate-850 font-mono text-sm mt-1">{startingKM} &rarr; {endingKM}</strong>
                            <span class="text-[10px] text-blue-600 font-bold block mt-0.5">{m.totalKM} KM Logged</span>
                          </div>
                          <div class="bg-slate-55 p-2.5 rounded-xl border border-slate-150">
                            <span class="text-[9px] text-slate-455 uppercase font-bold">Fuel Efficiency</span>
                            <strong class="block text-slate-850 font-mono text-sm mt-1">{m.fuelLiters > 0 ? `${m.millage.toFixed(2)} KM/L` : '0.00 KM/L'}</strong>
                            <span class="text-[10px] text-amber-700 font-bold block mt-0.5">{m.fuelLiters} L / ₹{m.dieselExpense.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PROFIT TAB */}
                  {activeTab() === 'profit' && (
                    <div class="space-y-4 animate-fade-in">
                      {/* Profit summary card */}
                      <div class={`rounded-2xl border p-4.5 shadow-3xs relative overflow-hidden ${
                        m.profit >= 0 
                          ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20 text-emerald-955' 
                          : 'bg-gradient-to-br from-rose-500/10 to-red-500/5 border-rose-500/20 text-rose-955'
                      }`}>
                        <div class="flex justify-between items-center">
                          <div>
                            <span class="text-[9px] font-bold uppercase tracking-wider block opacity-75">Net Profit Margin</span>
                            <strong class="text-xl font-black font-mono block mt-1">₹{m.profit.toLocaleString('en-IN')}</strong>
                          </div>
                          <div class={`px-2.5 py-1 rounded-full text-xs font-black border ${
                            m.profit >= 0 ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-rose-100 border-rose-300 text-rose-800'
                          }`}>
                            {m.income > 0 ? Math.round((m.profit / m.income) * 100) : 0}% Margin
                          </div>
                        </div>
                        
                        {/* Split Bar */}
                        <div class="mt-4 space-y-1">
                          <div class="flex justify-between text-[10px] font-bold opacity-80">
                            <span>Income: ₹{m.income.toLocaleString()}</span>
                            <span>Expenses: ₹{m.totalExpense.toLocaleString()}</span>
                          </div>
                          <div class="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden flex">
                            <div class="bg-emerald-500 h-full" style={{ width: `${m.income > 0 ? Math.max(10, Math.min(90, (m.income - m.totalExpense) / m.income * 100)) : 50}%` }}></div>
                            <div class="bg-rose-500 h-full flex-1"></div>
                          </div>
                        </div>
                      </div>

                      {/* Detailed expense group lists */}
                      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-3xs divide-y divide-slate-100">
                        <div class="p-3.5 bg-slate-50/50 font-bold uppercase text-[9px] tracking-wider text-slate-500">Expenses Consolidated</div>
                        
                        {/* Diesel */}
                        {m.dieselExpense > 0 && (
                          <div class="p-3 text-xs flex justify-between items-center">
                            <span class="font-semibold text-slate-705 flex items-center gap-1.5">
                              <Fuel class="w-3.5 h-3.5 text-rose-500" /> Diesel / Fuel Expense
                            </span>
                            <strong class="font-mono text-rose-600">₹{m.dieselExpense.toLocaleString('en-IN')}</strong>
                          </div>
                        )}
                        {/* Driver Wages */}
                        {m.driverWages > 0 && (
                          <div class="p-3 text-xs flex justify-between items-center">
                            <span class="font-semibold text-slate-705 flex items-center gap-1.5">
                              <User class="w-3.5 h-3.5 text-blue-500" /> Driver Wages
                            </span>
                            <strong class="font-mono text-slate-800">₹{m.driverWages.toLocaleString('en-IN')}</strong>
                          </div>
                        )}
                        {/* Loading / Unloading */}
                        {(m.loadingExpense > 0 || m.unloadingExpense > 0) && (
                          <div class="p-3 text-xs flex justify-between items-center">
                            <span class="font-semibold text-slate-705 flex items-center gap-1.5">
                              <TrendingUp class="w-3.5 h-3.5 text-emerald-500" /> Cargo Loading & Unloading
                            </span>
                            <strong class="font-mono text-slate-800">₹{(m.loadingExpense + m.unloadingExpense).toLocaleString('en-IN')}</strong>
                          </div>
                        )}
                        {/* RTO / Tolls */}
                        {(m.rtoExpense > 0 || m.fastagExpense > 0) && (
                          <div class="p-3 text-xs flex justify-between items-center">
                            <span class="font-semibold text-slate-750 flex items-center gap-1.5">
                              <AlertCircle class="w-3.5 h-3.5 text-amber-500" /> RTO & Fastag Compliance
                            </span>
                            <strong class="font-mono text-slate-800">₹{(m.rtoExpense + m.fastagExpense).toLocaleString('en-IN')}</strong>
                          </div>
                        )}
                        {/* Miscellaneous */}
                        {m.otherExpense > 0 && (
                          <div class="p-3 text-xs flex justify-between items-center">
                            <span class="font-semibold text-slate-755 flex items-center gap-1.5">
                              <Settings class="w-3.5 h-3.5 text-slate-500" /> Other/Misc Expenses
                            </span>
                            <strong class="font-mono text-slate-800">₹{m.otherExpense.toLocaleString('en-IN')}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* DRIVER TAB */}
                  {activeTab() === 'driver' && (
                    <div class="space-y-4 animate-fade-in">
                      {/* Driver Status Card */}
                      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs flex flex-col gap-3">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold shrink-0">
                            {viewingEntry().driverName ? viewingEntry().driverName.charAt(0).toUpperCase() : 'D'}
                          </div>
                          <div>
                            <strong class="text-sm text-slate-900 block font-sans">{viewingEntry().driverName || 'No Assigned Driver'}</strong>
                            <span class="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Driver Balance
                            </span>
                          </div>
                        </div>

                        {/* Balance display */}
                        <div class={`p-3 rounded-xl border flex justify-between items-center mt-1 ${
                          m.driverBalance < 0 
                            ? 'bg-amber-50 border-amber-200 text-amber-900' 
                            : m.driverBalance > 0 
                              ? 'bg-emerald-50 border-emerald-250 text-emerald-900' 
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}>
                          <span class="text-[10px] font-bold uppercase tracking-wider">
                            {m.driverBalance < 0 ? 'Recover from Driver' : m.driverBalance > 0 ? 'Pay Driver' : 'Balance Settled'}
                          </span>
                          <strong class="font-mono text-base font-black">
                            ₹{Math.abs(m.driverBalance).toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>

                      {/* Ledger logs */}
                      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-3xs space-y-3">
                        <h5 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Driver Ledger Logs</h5>
                        <div class="space-y-2 text-xs">
                          {/* Driver Wages */}
                          {m.driverWages > 0 && (
                            <div class="flex justify-between items-center py-2 border-b border-slate-100">
                              <span>Driver Wages Earned</span>
                              <span class="text-emerald-700 font-bold font-mono">+₹{m.driverWages.toLocaleString()}</span>
                            </div>
                          )}
                          {/* Driver spend / reimbursement */}
                          {m.driverPaidDirect > 0 && (
                            <div class="flex justify-between items-center py-2 border-b border-slate-100">
                              <span>Direct Expenses Paid by Driver</span>
                              <span class="text-emerald-700 font-bold font-mono">+₹{m.driverPaidDirect.toLocaleString()}</span>
                            </div>
                          )}
                          {/* Advances */}
                          {totalIssuedToDriver > 0 && (
                            <div class="flex justify-between items-center py-2 border-b border-slate-100">
                              <span>Advances Received</span>
                              <span class="text-rose-600 font-bold font-mono">-₹{totalIssuedToDriver.toLocaleString()}</span>
                            </div>
                          )}
                          {/* Recoveries */}
                          {m.driverRecovery > 0 && (
                            <div class="flex justify-between items-center py-2 border-b border-slate-100">
                              <span>Direct Recoveries</span>
                              <span class="text-rose-600 font-bold font-mono">-₹{m.driverRecovery.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ACTIONS TAB */}
                  {activeTab() === 'actions' && (
                    <div class="space-y-4 animate-fade-in">
                      {/* Quick sharing / printing list */}
                      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-3">
                        <h5 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Reports & Documents</h5>
                        <div class="grid grid-cols-2 gap-2 text-xs">
                          <button
                            onClick={() => {
                              const html = generateTripPDF(viewingEntry(), accounts, orgProfile);
                              setPreviewHtml(html);
                              setPreviewTitle(`Trip Report - ${viewingEntry().tripNo}`);
                            }}
                            class="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-100/60 transition gap-1.5 cursor-pointer font-semibold text-slate-700 font-sans"
                          >
                            <Printer class="w-5 h-5 text-emerald-600 animate-none shrink-0" />
                            <span>Print Trip PDF</span>
                          </button>
                          <button
                            onClick={() => {
                              const html = generateDriverReportPDF(viewingEntry(), accounts, orgProfile);
                              setPreviewHtml(html);
                              setPreviewTitle(`Driver Settlement - ${viewingEntry().tripNo}`);
                            }}
                            class="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-100/60 transition gap-1.5 cursor-pointer font-semibold text-slate-700 font-sans"
                          >
                            <FileText class="w-5 h-5 text-indigo-600 animate-none shrink-0" />
                            <span>Driver Report PDF</span>
                          </button>
                        </div>
                      </div>

                      {/* Modify Record controls */}
                      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-3">
                        <h5 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">Administration Options</h5>
                        <div class="space-y-2">
                          {canEditTrips && viewingEntry().status !== 'Deleted' && (
                            <button
                              onClick={() => {
                                onEditEntry(viewingEntry());
                                setViewingEntry(null);
                              }}
                              class="w-full py-2.5 border border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                            >
                              <Edit2 class="w-3.5 h-3.5" /> Modify Journey Records
                            </button>
                          )}
                          {canDeleteTrips && viewingEntry().status !== 'Deleted' && (
                            <button
                              onClick={() => {
                                const msg = `Caution! Deleting Master Trip ${viewingEntry().tripNo} will permanently delete all sub-trip segments and payments. Continue?`;
                                if (confirmAction) {
                                  confirmAction(msg, () => {
                                    onDeleteEntry(viewingEntry().id);
                                    setViewingEntry(null);
                                  }, "Delete Master Trip Journey");
                                } else if (confirm(msg)) {
                                  onDeleteEntry(viewingEntry().id);
                                  setViewingEntry(null);
                                }
                              }}
                              class="w-full py-2.5 border border-rose-200 rounded-xl bg-rose-50 hover:bg-rose-105 text-rose-755 font-bold transition flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                            >
                              <Trash2 class="w-3.5 h-3.5" /> Wipe Trip Database Object
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab() === 'audit' && currentUserRights?.isAdmin && (
                    <div class="space-y-4 animate-fade-in">
                      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-3xs space-y-4 relative overflow-hidden">
                        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                        <h5 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">Trip Audit History ({
                          (auditLogs || []).filter(log => log.category === 'Trip' && log.reference === viewingEntry().tripNo).length
                        })</h5>
                        
                        {(() => {
                          const tripLogs = (auditLogs || [])
                            .filter(log => log.category === 'Trip' && log.reference === viewingEntry().tripNo)
                            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

                          if (tripLogs.length === 0) {
                            return (
                              <div class="text-center py-6 text-slate-405 italic text-xs">
                                No audit trail logs recorded for this trip.
                              </div>
                            );
                          }

                          const getActionBadgeLocal = (action: string) => {
                            switch (action) {
                              case 'Created':
                                return <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">Created</span>;
                              case 'Edited':
                                return <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">Edited</span>;
                              case 'Deleted':
                                return <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">Deleted</span>;
                              default:
                                return <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-150 text-slate-655 border border-slate-200">{action}</span>;
                            }
                          };

                          return (
                            <div class="relative border-l border-slate-200 pl-4 ml-2 space-y-4 py-1 text-left">
                              {tripLogs.map((log, idx) => (
                                <div  class="relative">
                                  {/* Timeline Dot */}
                                  <span class="absolute -left-[21px] top-1 flex items-center justify-center w-3 h-3 rounded-full bg-slate-100 border border-slate-350">
                                    <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                  </span>
                                  <div class="space-y-1 text-xs">
                                    <div class="flex justify-between items-center gap-2">
                                      <div class="flex items-center gap-2 flex-wrap">
                                        {getActionBadgeLocal(log.action)}
                                        <span class="font-semibold text-slate-700 truncate max-w-[120px]">{log.user}</span>
                                      </div>
                                      <span class="text-[10px] text-slate-400 font-mono shrink-0">{log.timestamp}</span>
                                    </div>
                                    <div class="bg-slate-50 border border-slate-150/70 p-2 rounded-lg text-slate-600 leading-normal">
                                      {log.details && (log.details.includes('➔') || log.details.includes('|')) ? (
                                        <div class="flex flex-col gap-1.5">
                                          {log.details.split(' | ').map((change, cidx) => {
                                            const arrowIdx = change.indexOf('➔');
                                            if (arrowIdx !== -1) {
                                              const colonIdx = change.indexOf(':');
                                              if (colonIdx !== -1 && colonIdx < arrowIdx) {
                                                const field = change.substring(0, colonIdx);
                                                const values = change.substring(colonIdx + 1).trim();
                                                const valuesSplit = values.split('➔');
                                                const oldVal = valuesSplit[0]?.trim().replace(/^"|"$/g, '') || '';
                                                const newVal = valuesSplit[1]?.trim().replace(/^"|"$/g, '') || '';
                                                return (
                                                  <div  class="flex flex-wrap items-center gap-1.5 text-[10px] leading-none">
                                                    <span class="font-bold text-slate-655 bg-slate-200/60 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider">{field}</span>
                                                    <span class="text-slate-400 line-through truncate max-w-[70px] inline-block font-mono bg-slate-100 px-1 rounded text-[9px]" title={oldVal}>{oldVal}</span>
                                                    <span class="text-slate-400 font-bold">&rarr;</span>
                                                    <span class="text-blue-755 font-black truncate max-w-[90px] inline-block font-mono bg-blue-50 px-1 rounded text-[9px]" title={newVal}>{newVal}</span>
                                                  </div>
                                                );
                                              }
                                            }
                                            return <div  class="text-slate-655 text-[10px] leading-tight font-medium">&bull; {change}</div>;
                                          })}
                                        </div>
                                      ) : (
                                        <span class="text-[10px]">{log.details}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile Modal Footer */}
                <div class="p-4 bg-white border-t border-slate-200/80 flex justify-end gap-2 sticky bottom-0 shrink-0">
                  <button
                    onClick={() => setViewingEntry(null)}
                    class="w-full py-2.5 bg-blue-600 hover:bg-blue-750 text-white rounded-xl text-xs font-bold transition cursor-pointer text-center"
                  >
                    Done Reviewing
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      <ReportPreviewModal
        isOpen={!!previewHtml()}
        onClose={() => setPreviewHtml(null)}
        htmlContent={previewHtml() || ''}
        title={previewTitle()}
      />
    </div>
  );
}
