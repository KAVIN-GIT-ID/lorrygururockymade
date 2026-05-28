import React, { useState } from 'react';
import { TripEntry, Truck, Office, Account, TripStatus, getTripMetrics, calculateBalance } from '../types';
import { 
  Search, Edit2, Trash2, Calendar, Filter, FileSpreadsheet, 
  Eye, ChevronRight, ChevronDown, X, AlertCircle, Fuel, 
  Gauge, TrendingUp, DollarSign, User, MapPin, ListCollapse, ArrowRightLeft,
  ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';

import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { useEffect } from 'react';

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
  organizationId
}: TripListProps) {
  // Mouse hover scroll redirection for horizontal overflow
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedTruck, setSelectedTruck] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Sorting state
  const [sortField, setSortField] = useState<'tripNo' | 'truckNo' | 'startDate' | 'income' | 'totalExpense' | 'profit' | 'outstandingBalance' | 'status'>('startDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination & Display states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [displayedTrips, setDisplayedTrips] = useState<TripEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const online = isAppwriteConfigured();

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedTruck, selectedStatus, startDate, endDate]);

  // Offline / fallback local logic
  useEffect(() => {
    if (!online) {
      const filtered = trips.filter(trip => {
        const matchesSearch = !search ? true : (
          trip.tripNo.toLowerCase().includes(search.toLowerCase()) ||
          trip.truckNo.toLowerCase().includes(search.toLowerCase()) ||
          trip.driverName.toLowerCase().includes(search.toLowerCase()) ||
          (trip.notes && trip.notes.toLowerCase().includes(search.toLowerCase()))
        );

        const matchesTruck = !selectedTruck ? true : trip.truckNo === selectedTruck;
        const matchesStatus = !selectedStatus ? true : trip.status === selectedStatus;

        const matchesStartDate = !startDate ? true : trip.startDate >= startDate;
        const matchesEndDate = !endDate ? true : trip.endDate <= endDate;

        return matchesSearch && matchesTruck && matchesStatus && matchesStartDate && matchesEndDate;
      });

      const sorted = [...filtered].sort((a, b) => {
        let aVal: any = '';
        let bVal: any = '';

        if (sortField === 'tripNo') {
          aVal = a.tripNo;
          bVal = b.tripNo;
        } else if (sortField === 'truckNo') {
          aVal = a.truckNo;
          bVal = b.truckNo;
        } else if (sortField === 'startDate') {
          aVal = a.startDate;
          bVal = b.startDate;
        } else if (sortField === 'status') {
          aVal = a.status;
          bVal = b.status;
        } else {
          const mA = getTripMetrics(a);
          const mB = getTripMetrics(b);
          if (sortField === 'income') {
            aVal = mA.income;
            bVal = mB.income;
          } else if (sortField === 'totalExpense') {
            aVal = mA.totalExpense;
            bVal = mB.totalExpense;
          } else if (sortField === 'profit') {
            aVal = mA.profit;
            bVal = mB.profit;
          } else if (sortField === 'outstandingBalance') {
            aVal = mA.outstandingBalance;
            bVal = mB.outstandingBalance;
          }
        }

        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = (bVal || '').toLowerCase();
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });

      setTotalCount(sorted.length);
      const startIdx = (currentPage - 1) * pageSize;
      setDisplayedTrips(sorted.slice(startIdx, startIdx + pageSize));
    }
  }, [trips, search, selectedTruck, selectedStatus, startDate, endDate, sortField, sortDirection, currentPage, pageSize, online]);

  // Online Appwrite logic
  useEffect(() => {
    if (online) {
      const fetchServerTrips = async () => {
        setLoading(true);
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          const orgId = organizationId || localStorage.getItem('ttt_organization_id') || 'org_default';
          
          let serverSortField = 'startDate';
          if (['tripNo', 'truckNo', 'startDate', 'status'].includes(sortField)) {
            serverSortField = sortField;
          }

          const res = await appwrite.queryTrips(
            databaseId,
            orgId,
            {
              search: search || undefined,
              truckNo: selectedTruck || undefined,
              status: selectedStatus || undefined,
              startDate: startDate || undefined,
              endDate: endDate || undefined
            },
            currentPage,
            pageSize,
            serverSortField,
            sortDirection
          );

          const mapped = (res.documents || []).map(doc => {
            try {
              if (doc.data) {
                const parsed = JSON.parse(doc.data);
                return { id: doc.$id, ...parsed };
              }
            } catch (e) {
              console.warn("Failed to parse doc.data for trip:", doc.$id, e);
            }
            return {
              id: doc.$id,
              organizationId: doc.organizationId,
              tripNo: doc.tripNo || '',
              truckNo: doc.truckNo || '',
              startDate: doc.startDate || '',
              endDate: doc.endDate || '',
              driverName: doc.driverName || '',
              status: doc.status || 'Pending',
              notes: doc.notes || '',
              payments: [],
              subTrips: [],
              fuels: []
            };
          });
          setDisplayedTrips(mapped);
          setTotalCount(res.total || 0);
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
  }, [search, selectedTruck, selectedStatus, startDate, endDate, sortField, sortDirection, currentPage, pageSize, online, organizationId]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Selection/Expansion state
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  
  // Master Details modal state for viewing full list of 21+ columns cleanly
  const [viewingEntry, setViewingEntry] = useState<TripEntry | null>(null);


  // Calculate totals of matched items for footer reporting
  const totals = (online ? displayedTrips : trips.filter(trip => {
    const matchesSearch = !search ? true : (
      trip.tripNo.toLowerCase().includes(search.toLowerCase()) ||
      trip.truckNo.toLowerCase().includes(search.toLowerCase()) ||
      trip.driverName.toLowerCase().includes(search.toLowerCase()) ||
      (trip.notes && trip.notes.toLowerCase().includes(search.toLowerCase()))
    );
    const matchesTruck = !selectedTruck ? true : trip.truckNo === selectedTruck;
    const matchesStatus = !selectedStatus ? true : trip.status === selectedStatus;
    const matchesStartDate = !startDate ? true : trip.startDate >= startDate;
    const matchesEndDate = !endDate ? true : trip.endDate <= endDate;
    return matchesSearch && matchesTruck && matchesStatus && matchesStartDate && matchesEndDate;
  })).reduce((acc, t) => {
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
      const matchesSearch = !search ? true : (
        trip.tripNo.toLowerCase().includes(search.toLowerCase()) ||
        trip.truckNo.toLowerCase().includes(search.toLowerCase()) ||
        trip.driverName.toLowerCase().includes(search.toLowerCase()) ||
        (trip.notes && trip.notes.toLowerCase().includes(search.toLowerCase()))
      );
      const matchesTruck = !selectedTruck ? true : trip.truckNo === selectedTruck;
      const matchesStatus = !selectedStatus ? true : trip.status === selectedStatus;
      const matchesStartDate = !startDate ? true : trip.startDate >= startDate;
      const matchesEndDate = !endDate ? true : trip.endDate <= endDate;
      return matchesSearch && matchesTruck && matchesStatus && matchesStartDate && matchesEndDate;
    });

    const exportList = online ? displayedTrips : localFiltered;
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
    return accounts.find(a => a.id === id)?.accountName || id || 'Unmapped';
  };

  // Date styling helper
  const dateFormatted = (dateStr: string) => {
    if (!dateStr) return <span className="text-slate-400 font-mono">&mdash;</span>;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return <span className="text-slate-400 font-mono">{dateStr}</span>;
      return <span className="font-mono text-xs">{d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>;
    } catch {
      return <span className="text-slate-400 font-mono">{dateStr}</span>;
    }
  };

  const currencyFormatted = (num: number, showSign = true) => {
    const val = Number(num) || 0;
    return <span className="font-mono font-bold text-slate-800">{showSign ? '₹' : ''}{val.toLocaleString('en-IN')}</span>;
  };

  const getStatusBadge = (status: TripStatus) => {
    switch (status) {
      case 'Pending':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full border border-slate-200 bg-slate-50 text-slate-600">Pending</span>;
      case 'In Progress':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full border border-amber-200 bg-amber-50 text-amber-700">In Progress</span>;
      case 'Completed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full border border-blue-200 bg-blue-50 text-blue-700">Completed</span>;
      case 'Paid':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">Settled</span>;
      default:
        return null;
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedTruck('');
    setSelectedStatus('');
    setStartDate('');
    setEndDate('');
  };

  const renderSortableHeader = (label: string, field: typeof sortField, customClass = "px-4 py-4") => {
    const isCurrent = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        className={`${customClass} cursor-pointer hover:bg-slate-100 select-none transition group`}
      >
        <div className={`flex items-center gap-1.5 ${customClass.includes('text-right') ? 'justify-end' : customClass.includes('text-center') ? 'justify-center' : 'justify-start'}`}>
          <span>{label}</span>
          {isCurrent ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-350 opacity-40 group-hover:opacity-100 transition" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* FILTER CONTROL PANEL */}
      <div id="trip-filter-hud" className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 leading-tight font-sans flex items-center gap-2">
              <span>Active Transport Journals</span>
              {loading && <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Fleet performance auditing. Select custom master records to inspect sub-trip segments & expenditures.</p>
          </div>
          
          <button
            id="export-csv-btn"
            disabled={totalCount === 0}
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-905 disabled:opacity-45 disabled:hover:bg-transparent font-bold px-4 py-2.5 rounded-lg border border-slate-200 transition text-xs shadow-2xs cursor-pointer text-slate-905"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" /> Export Cumulative CSV (23 Columns)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-slate-100">
          {/* SEARCH FIELD */}
          <div className="relative">
            <Search className="absolute left-2.5 top-3 w-3.5 h-3.5 text-slate-400" />
            <input
              id="search-input"
              type="text"
              placeholder="Search Trips, Trucks, Drivers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-850 rounded-lg pl-8 pr-2 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* TRUCK SELECT FILTER */}
          <div>
            <select
              id="filter-truck-select"
              value={selectedTruck}
              onChange={(e) => setSelectedTruck(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
            >
              <option value="">&mdash; Choose Truck &mdash;</option>
              {trucks.map(t => (
                <option key={t.id} value={t.truckNo}>{t.truckNo}</option>
              ))}
            </select>
          </div>

          {/* STATUS SELECT FILTER */}
          <div>
            <select
              id="filter-status-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
            >
              <option value="">&mdash; Choose Status &mdash;</option>
              <option value="Pending">Pending (Not Initiated)</option>
              <option value="In Progress">In Progress (Active)</option>
              <option value="Completed">Completed (No Debt)</option>
              <option value="Paid">Settled (Fully Zero Out)</option>
            </select>
          </div>

          {/* STARTING DATE */}
          <div>
            <input
              id="filter-start-date"
              type="date"
              title="Trip start date after"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-650 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
            />
          </div>

          {/* ENDING DATE */}
          <div>
            <input
              id="filter-end-date"
              type="date"
              title="Trip end date before"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-650 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
            />
          </div>
        </div>

        {/* ACTIVE FILTER DISMISS BLOCKS */}
        {(selectedTruck || selectedStatus || startDate || endDate || search) && (
          <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-lg p-3 px-4 shadow-3xs">
            <span className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
              <Filter className="w-3.5 h-3.5 text-blue-500" />
              Matched <strong>{totalCount}</strong> transport records.
            </span>
            <button
              id="reset-filters"
              onClick={handleResetFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* CORE MASTER LIST TABLE CONTAINER */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden hidden md:block">
        <div ref={scrollRef} className="overflow-x-auto">
          <table id="master-trips-table" className="w-full text-left text-sm text-slate-700 whitespace-nowrap min-w-[1000px]">
            <thead className="text-[11px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200 font-bold tracking-wider">
              <tr>
                {renderSortableHeader('Trip ID (Group Code)', 'tripNo', 'px-6 py-4 pl-6 text-left')}
                {renderSortableHeader('Truck & Driver', 'truckNo', 'px-4 py-4 text-left')}
                {renderSortableHeader('Trip duration dates', 'startDate', 'px-4 py-4 text-center')}
                {renderSortableHeader('Income Generated', 'income', 'px-4 py-4 text-right')}
                {renderSortableHeader('Operational Costs', 'totalExpense', 'px-4 py-4 text-right')}
                {renderSortableHeader('Net Profit Margin', 'profit', 'px-4 py-4 text-right')}
                {renderSortableHeader('Total Outstanding', 'outstandingBalance', 'px-4 py-4 text-right text-amber-700 bg-amber-50/15 font-extrabold')}
                {renderSortableHeader('Status', 'status', 'px-4 py-4 text-center')}
                <th className="px-6 py-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {displayedTrips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-400 font-medium italic">
                    No active transport references matched your operational filters.
                  </td>
                </tr>
              ) : (
                displayedTrips.map((trip) => {
                  const m = getTripMetrics(trip);

                  return (
                    <React.Fragment key={trip.id}>
                      {/* MAIN MASTERS ROW */}
                      <tr 
                        id={`trip-row-${trip.id}`} 
                        className="hover:bg-slate-50/50 transition duration-150 cursor-pointer"
                        onClick={() => setViewingEntry(trip)}
                      >
                        {/* TRIP ID */}
                        <td className="px-6 py-4 pl-6">
                          <span className="font-mono font-extrabold text-blue-600 text-xs block">{trip.tripNo}</span>
                          <span className="text-[10px] text-slate-400 italic block mt-0.5">Segs: {trip.subTrips?.length || 0}</span>
                        </td>

                        {/* TRUCK & OPERATOR */}
                        <td className="px-4 py-4">
                          <span className="font-mono font-bold text-slate-900 tracking-wider text-[13px] block">{trip.truckNo}</span>
                          <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5 font-sans">
                            <User className="w-3 h-3 text-slate-400" />
                            {trip.driverName || 'No Driver'}
                          </span>
                        </td>

                        {/* TRIP TIMEFRAME */}
                        <td className="px-4 py-4 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-150 px-2.5 py-1 rounded text-xs">
                            {dateFormatted(trip.startDate)}
                            <span className="text-slate-350 font-normal select-none">&rarr;</span>
                            {dateFormatted(trip.endDate)}
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-1 font-semibold">{m.noOfDays} transport day{m.noOfDays > 1 ? 's' : ''}</span>
                        </td>

                        {/* INCOMINGS */}
                        <td className="px-4 py-4 text-right">
                          {currencyFormatted(m.income)}
                        </td>

                        {/* COSTING */}
                        <td className="px-4 py-4 text-right font-mono font-bold text-red-600">
                          ₹{m.totalExpense.toLocaleString('en-IN')}
                        </td>

                        {/* PROFITS */}
                        <td className={`px-4 py-4 text-right font-mono font-bold ${m.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          ₹{m.profit.toLocaleString('en-IN')}
                          <span className="text-[9px] text-slate-400 block font-normal font-sans mt-0.5">Margin: {m.income > 0 ? Math.round((m.profit/m.income)*100) : 0}%</span>
                        </td>

                        {/* TOTAL OUTSTANDING */}
                        <td className="px-4 py-4 text-right font-mono font-extrabold text-amber-700 bg-amber-50/5">
                          ₹{m.outstandingBalance.toLocaleString('en-IN')}
                        </td>

                        {/* GENERAL STATUS */}
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(trip.status)}
                        </td>

                        {/* OPTIONS BAR */}
                        <td className="px-6 py-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1 px-1">
                            {/* INSPECTOR VIEW */}
                            <button
                              title="Full 23-Columns Sheet Inspector"
                              onClick={() => setViewingEntry(trip)}
                              className="p-1 px-2.5 bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded border border-slate-200 transition cursor-pointer flex items-center h-8"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {/* MODIFY SPEC ROW */}
                            <button
                              title="Modify Cargo Entry specs"
                              disabled={!canEditTrips}
                              onClick={() => onEditEntry(trip)}
                              className="p-1 px-2.5 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center h-8"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {/* DELETE ENTRY */}
                            <button
                              title="Wipe Cargo Entry record"
                              disabled={!canDeleteTrips}
                              onClick={() => {
                                const msg = `Are you sure you want to permanently delete trip record ${trip.tripNo}? This wipes all linked payments, diesel, and driver expenses.`;
                                if (confirmAction) {
                                  confirmAction(msg, () => onDeleteEntry(trip.id), "Delete Cargo Entry Record");
                                } else if (confirm(msg)) {
                                  onDeleteEntry(trip.id);
                                }
                              }}
                              className="p-1 px-2.5 bg-rose-50/30 text-rose-600 hover:text-rose-700 hover:bg-rose-550/10 rounded border border-rose-150 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center h-8"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* GRAND FILTERED TOTALS ON FOOTER */}
            {displayedTrips.length > 0 && (
              <tfoot className="bg-slate-50 font-mono text-slate-800 text-[11px] font-bold border-t border-slate-200">
                <tr>
                  <td className="px-6 py-4 pl-6" colSpan={3}>
                    Totals ({online ? 'Current Page' : `${totalCount} logs`})
                  </td>
                  <td className="px-4 py-4 text-right">
                    ₹{totals.income.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-4 text-right text-red-600 font-extrabold">
                    ₹{totals.expense.toLocaleString('en-IN')}
                  </td>
                  <td className={`px-4 py-4 text-right text-[13px] font-black ${totals.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    ₹{totals.profit.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-4 text-right text-amber-700 font-extrabold bg-amber-50/15">
                    ₹{totals.outstanding.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-4 text-center"></td>
                  <td className="px-6 py-4 text-right font-medium font-sans"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* MOBILE LIST CARD VIEW */}
      <div className="block md:hidden space-y-4">
        {displayedTrips.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 py-12 text-center text-slate-400 italic">
            No active transport references matched your operational filters.
          </div>
        ) : (
          displayedTrips.map((trip) => {
            const m = getTripMetrics(trip);
            return (
              <div
                key={trip.id}
                className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-3xs flex flex-col justify-between hover:border-blue-300 transition"
                onClick={() => setViewingEntry(trip)}
              >
                <div>
                  {/* Top Row: Trip ID & Status */}
                  <div className="flex justify-between items-center gap-2 mb-3">
                    <span className="font-mono font-extrabold text-blue-600 text-xs">
                      {trip.tripNo}
                    </span>
                    {getStatusBadge(trip.status)}
                  </div>

                  {/* Truck & Driver */}
                  <div className="flex items-center gap-3 text-xs mb-3 text-slate-800">
                    <span className="font-mono font-bold text-slate-900 tracking-wider">
                      {trip.truckNo}
                    </span>
                    <span className="w-px h-3.5 bg-slate-200" />
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400 animate-none shrink-0" />
                      {trip.driverName || 'No Driver'}
                    </span>
                  </div>

                  {/* Route & Dates */}
                  <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-2.5 space-y-1.5 text-xs text-slate-650 mb-3.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Route</span>
                      <span className="font-semibold text-slate-850 truncate max-w-[200px]" title={trip.subTrips?.[0]?.officeName || 'Broker'}>
                        {trip.subTrips?.[0]?.officeName || 'Broker'} &bull; {trip.subTrips?.[0]?.routeFrom || 'Origin'} &rarr; {trip.subTrips?.[trip.subTrips.length - 1]?.routeTo || 'Destination'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Dates</span>
                      <span className="font-medium text-slate-700">
                        {dateFormatted(trip.startDate)} &rarr; {dateFormatted(trip.endDate)}
                      </span>
                    </div>
                  </div>

                  {/* Financials Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="bg-emerald-50/20 border border-emerald-100/40 rounded-lg p-2 flex flex-col justify-between">
                      <span className="text-emerald-700/85 font-bold uppercase text-[9px]">Income</span>
                      <span className="font-extrabold text-emerald-800 mt-1">
                        {currencyFormatted(m.income)}
                      </span>
                    </div>
                    <div className="bg-rose-50/20 border border-rose-100/40 rounded-lg p-2 flex flex-col justify-between">
                      <span className="text-rose-750 font-bold uppercase text-[9px]">Expense</span>
                      <span className="font-extrabold text-rose-800 mt-1">
                        ₹{m.totalExpense.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/45 rounded-lg p-2 flex flex-col justify-between">
                      <span className="text-slate-500 font-bold uppercase text-[9px]">Profit</span>
                      <span className={`font-extrabold mt-1 ${m.profit >= 0 ? 'text-indigo-800' : 'text-rose-800'}`}>
                        ₹{m.profit.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="bg-amber-50/25 border border-amber-100/60 rounded-lg p-2 flex flex-col justify-between">
                      <span className="text-amber-700 font-bold uppercase text-[9px]">Outstanding</span>
                      <span className="font-black text-amber-800 mt-1">
                        ₹{m.outstandingBalance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Grid */}
                <div 
                  className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100/60 mt-auto"
                  onClick={(e) => e.stopPropagation()} // Prevent triggering viewport modal
                >
                  <button
                    type="button"
                    onClick={() => setViewingEntry(trip)}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[10px] cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>View</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canEditTrips}
                    onClick={() => onEditEntry(trip)}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[10px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canDeleteTrips}
                    onClick={() => {
                      const msg = `Are you sure you want to permanently delete trip record ${trip.tripNo}? This wipes all linked payments, diesel, and driver expenses.`;
                      if (confirmAction) {
                        confirmAction(msg, () => onDeleteEntry(trip.id), "Delete Cargo Entry Record");
                      } else if (confirm(msg)) {
                        onDeleteEntry(trip.id);
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-rose-150 bg-rose-50/20 hover:bg-rose-50/50 text-rose-600 font-semibold text-[10px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PAGINATION FOOTER */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs no-print">
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
              {[10, 25, 50, 100].map(size => (
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

      {/* SINGLE MASTER TRIP COMPLETE 23-COLUMNS PRINT AUDIT TAB MODAL */}
      {viewingEntry && (() => {
        const m = getTripMetrics(viewingEntry);
        return (
          <div 
            id="inspector-overlay" 
            onClick={() => setViewingEntry(null)}
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <div 
              id="inspector-card" 
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl shadow-xl overflow-hidden animate-scale-up"
            >
              
              <div className="px-6 py-4.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <span className="text-[10px] text-blue-600 uppercase tracking-wider font-extrabold block">Ultimate Fleet-Book Document Ledger</span>
                  <h3 className="text-lg font-bold text-slate-900 font-mono tracking-wide">{viewingEntry.tripNo} &bull; {viewingEntry.truckNo}</h3>
                </div>
                <div className="flex items-center flex-wrap gap-2 shrink-0">
                  {canEditTrips && (
                    <button
                      onClick={() => {
                        onEditEntry(viewingEntry);
                        setViewingEntry(null);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs rounded-lg transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  {canDeleteTrips && (
                    <button
                      onClick={() => {
                        const msg = `Caution! Deleting Master Trip ${viewingEntry.tripNo} will permanently delete all ${viewingEntry.subTrips?.length || 0} sub-trip segments and advanced payments receipt sheets. Continue?`;
                        if (confirmAction) {
                          confirmAction(msg, () => {
                            onDeleteEntry(viewingEntry.id);
                            setViewingEntry(null);
                          }, "Delete Master Trip Journey");
                        } else if (confirm(msg)) {
                          onDeleteEntry(viewingEntry.id);
                          setViewingEntry(null);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                  <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>
                  <button
                    id="btn-close-inspector"
                    onClick={() => setViewingEntry(null)}
                    className="p-1 px-2.5 text-slate-400 hover:text-slate-650 bg-slate-200/50 hover:bg-slate-250 rounded-lg transition shrink-0 cursor-pointer flex items-center justify-center"
                    title="Close Details Overlay"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* primary bento grid details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[9px] text-slate-500 uppercase block font-bold leading-tight">Driver Person</span>
                    <span className="text-xs font-semibold text-slate-900 block mt-1">{viewingEntry.driverName || 'No Driver'}</span>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[9px] text-slate-500 uppercase block font-bold leading-tight">Segment Dates</span>
                    <span className="text-xs font-semibold text-slate-800 font-mono block mt-1 truncate">{viewingEntry.startDate} to {viewingEntry.endDate}</span>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[9px] text-slate-500 uppercase block font-bold leading-tight">Master odometer</span>
                    <span className="text-xs font-semibold text-slate-800 font-mono block mt-1">{viewingEntry.startingKM || 0} KM - {viewingEntry.endingKM || 0} KM</span>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[9px] text-slate-500 uppercase block font-bold leading-tight">Distance Logged</span>
                    <span className="text-xs font-extrabold text-blue-650 font-mono block mt-1 text-blue-600">{m.totalKM} KM Range</span>
                  </div>
                </div>

                {/* 23 flat parameters audit section */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs bg-white">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold uppercase text-[10px] tracking-widest text-slate-655 flex justify-between">
                    <span>Flat Consolidated Specifications (23 Columns Schema)</span>
                    <span className="font-mono text-blue-600 text-xs font-extrabold">{viewingEntry.tripNo}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 divide-y divide-slate-100 p-4 font-mono text-[11px] gap-y-3">
                    <div className="pt-2">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">1. Truck No</span>
                      <span className="font-bold text-slate-800">{viewingEntry.truckNo}</span>
                    </div>
                    <div>
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">2. Trip No</span>
                      <span className="font-bold text-slate-800">{viewingEntry.tripNo}</span>
                    </div>
                    <div>
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">3. Trip Start</span>
                      <span className="text-slate-700">{viewingEntry.startDate || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">4. Trip End</span>
                      <span className="text-slate-700">{viewingEntry.endDate || 'N/A'}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">5. Driver Name</span>
                      <span className="font-sans text-slate-800 font-semibold">{viewingEntry.driverName || 'N/A'}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">6. income (₹)</span>
                      <span className="font-extrabold text-slate-850 text-emerald-800">₹{m.income.toLocaleString()}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">7. Loading EXP</span>
                      <span className="text-slate-700">₹{m.loadingExpense.toLocaleString()}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">8. Unload EXP</span>
                      <span className="text-slate-700">₹{m.unloadingExpense.toLocaleString()}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">9. RTO EXP</span>
                      <span className="text-slate-700">₹{m.rtoExpense.toLocaleString()}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">10. Diesel EXP</span>
                      <span className="font-black text-rose-650 text-red-600">₹{m.dieselExpense.toLocaleString()}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">11. Add Blue</span>
                      <span className="text-slate-700">₹{m.addBlueExpense.toLocaleString()}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">12. Fastag EXP</span>
                      <span className="text-slate-700">₹{m.fastagExpense.toLocaleString()}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">13. Driver Wages</span>
                      <span className="text-slate-700">₹{m.driverWages.toLocaleString()}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">14. Other EXP</span>
                      <span className="text-slate-700">₹{m.otherExpense.toLocaleString()}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">15. Fuel Liters</span>
                      <span className="text-slate-700 font-extrabold">{m.fuelLiters} Liters</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">16. Starting KM</span>
                      <span className="text-slate-700">{viewingEntry.startingKM || 0} KM</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">17. Ending KM</span>
                      <span className="text-slate-700">{viewingEntry.endingKM || 0} KM</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">18. Total Range</span>
                      <span className="text-blue-600 font-bold">{m.totalKM} KM</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">19. Fuel Mileage</span>
                      <span className="font-extrabold text-amber-700 bg-amber-50 px-1 rounded">{m.fuelLiters > 0 ? `${m.millage.toFixed(2)} KM/L` : '0.00 KM/L'}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">20. Cost Per KM</span>
                      <span className="text-slate-800 font-bold">₹{m.perKM.toFixed(2)} / KM</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">21. Days Duration</span>
                      <span className="text-slate-800 font-bold">{m.noOfDays} Days</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">22. Total Outflow</span>
                      <span className="font-bold text-red-600">₹{m.totalExpense.toLocaleString()}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">23. Profit Yield</span>
                      <span className={`font-black tracking-tight text-xs ${m.profit >= 0 ? 'text-emerald-705 text-emerald-800' : 'text-red-700'}`}>₹{m.profit.toLocaleString()}</span>
                    </div>
                    <div className="pt-2.5">
                      <span className="text-slate-450 block font-sans text-[10px] uppercase font-bold">Debit Status</span>
                      <span className="font-sans font-extrabold">{viewingEntry.status}</span>
                    </div>
                  </div>
                </div>

                {/* sub trip details segments table inside the modal */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 pl-1 font-sans">
                    Detailed Segments & Loader Outlaws ({viewingEntry.subTrips?.length || 0} cargo loads)
                  </h4>
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                    {(!viewingEntry.subTrips || viewingEntry.subTrips.length === 0) ? (
                      <p className="p-4 text-center text-slate-400 italic">No sub-trip segments logged.</p>
                    ) : (
                      viewingEntry.subTrips.map((s, idx) => (
                        <div key={s.id} className="p-4 hover:bg-slate-50/50 transition">
                          <div className="flex justify-between items-center bg-slate-50/70 p-2 rounded-lg border border-slate-150 mb-3">
                            <span className="text-slate-800 font-mono font-bold font-sans">Segment #{idx + 1} &bull; {s.routeFrom} &rarr; {s.routeTo}</span>
                            <span className="font-sans font-bold text-slate-500 text-[10px] bg-slate-205 py-0.5 px-2 rounded-md bg-slate-200 uppercase leading-none">Office: {s.officeName}</span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-1 text-[11px] font-sans">
                            <div className="p-1 px-2 border-l-2 border-emerald-500">
                              <span className="text-slate-450 block font-sans text-[9px] uppercase">Income (₹)</span>
                              <span className="font-mono font-bold text-emerald-800">₹{s.income.toLocaleString()}</span>
                            </div>
                            <div className="p-1 px-2 border-l-2 border-red-500">
                              <span className="text-slate-450 block font-sans text-[9px] uppercase">Diesel Cost / Liters</span>
                              <span className="font-mono font-bold text-slate-800">₹{(s.dieselAmount || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-450">({s.dieselLiters} L @ ₹{s.dieselRate})</span></span>
                            </div>
                            <div className="p-1 px-2 border-l-2 border-slate-400">
                              <span className="text-slate-450 block font-sans text-[9px] uppercase">Loading/Unloading</span>
                              <span className="font-mono font-bold text-slate-800">₹{(s.loadingExpense + s.unloadingExpense).toLocaleString()}</span>
                            </div>
                            <div className="p-1 px-2 border-l-2 border-slate-400">
                              <span className="text-slate-450 block font-sans text-[9px] uppercase">Wages + Other</span>
                              <span className="font-mono font-bold text-slate-800">₹{(s.driverWages + s.otherExpense).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* payments logs within modal audit sheet */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                    <span className="text-[10px] text-blue-650 uppercase tracking-wider font-extrabold">Advances & Outstanding collection log</span>
                  </div>
                  <div className="divide-y divide-slate-150">
                    {(!viewingEntry.payments || viewingEntry.payments.length === 0) ? (
                      <div className="p-4 text-center text-xs text-slate-400 italic">No payments or receipts registered. Balance is 100% collectable.</div>
                    ) : (
                      viewingEntry.payments.map((p, pidx) => (
                        <div key={p.id} className="p-3 text-xs flex justify-between items-center items-center hover:bg-slate-50/50">
                          <div>
                            <span className="font-bold text-slate-700">Receipt Line #{pidx + 1}</span>
                            {p.notes && <p className="text-[10px] text-slate-400 mt-0.5 italic">{p.notes}</p>}
                          </div>
                          <div className="flex items-center gap-6 font-mono font-bold">
                            <span className="text-slate-900 border border-slate-150 rounded px-2 bg-slate-50 py-0.5">₹{p.amount.toLocaleString()}</span>
                            <span className="text-blue-650 font-bold font-sans text-[11px]">{getAccountName(p.receivedBy)}</span>
                            <span className="text-slate-450 text-[10px] font-normal font-mono">{p.date}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* remarks */}
                {viewingEntry.notes && (
                  <div className="bg-amber-50/75 border border-amber-100 rounded-xl p-4 text-xs text-slate-600">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block mb-1">Remarks / Audit warnings</span>
                    <p className="leading-relaxed">{viewingEntry.notes}</p>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-right">
                <button
                  id="inspector-close-bottom"
                  onClick={() => setViewingEntry(null)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition shadow-2xs cursor-pointer h-10"
                >
                  Finished Review
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
