import { createSignal, createMemo, For, Show } from 'solid-js';

import { TripEntry, Truck, ExpenseEntry, getTripMetrics } from '../types';
import { 
  Calendar, 
  TrendingUp, 
  Coins, 
  DollarSign, 
  FileText, 
  Filter, 
  Printer, 
  Download, 
  Award,
  AlertCircle,
  Truck as TruckIcon
} from 'lucide-solid';


interface MonthlyReportProps {
  trips: TripEntry[];
  trucks: Truck[];
  expenses: ExpenseEntry[];
  selectedMonth: string;
  selectedYear: string;
  setSelectedMonth: (month: string) => void;
  setSelectedYear: (year: string) => void;
}

export default function MonthlyReport(props: MonthlyReportProps) {
  // Query Filter state
  const [showActiveOnly, setShowActiveOnly] = createSignal(false);
  const [selectedTruck, setSelectedTruck] = createSignal('');

  // Lists of months and years
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const years = ['2025', '2026', '2027', '2028', '2029', '2030', 'All Time'];

    const selectedMonthObj = createMemo(() => months.find(m => m.value === props.selectedMonth));

  const isAllTime = createMemo(() => props.selectedYear === 'All Time');

  const targetTrips = createMemo(() => isAllTime()
    ? props.trips
    : props.trips.filter(t => t.startDate && t.startDate.startsWith(`${props.selectedYear}-${props.selectedMonth}`)));

  const targetExpenses = createMemo(() => isAllTime()
    ? props.expenses.filter(e => e.status !== 'Declined')
    : props.expenses.filter(e => e.date && e.date.startsWith(`${props.selectedYear}-${props.selectedMonth}`) && e.status !== 'Declined'));

  const filteredTrucks = createMemo(() => selectedTruck()
    ? props.trucks.filter(t => t.truckNo === selectedTruck())
    : props.trucks);

  const rawReportData = createMemo(() => filteredTrucks().map(truck => {
    const truckTrips = targetTrips().filter(t => t.truckNo === truck.truckNo);
    const truckExpenses = targetExpenses().filter(e => e.truckNo === truck.truckNo);

    const totalDistance = truckTrips.reduce((sum, t) => sum + (getTripMetrics(t).totalKM || 0), 0);
    const tripsCount = truckTrips.length;
    const averageMil = tripsCount > 0 
      ? parseFloat((truckTrips.reduce((sum, t) => sum + (getTripMetrics(t).millage || 0), 0) / tripsCount).toFixed(2))
      : 0;

    const freightRevenue = truckTrips.reduce((sum, t) => sum + (getTripMetrics(t).income || 0), 0);
    const otherRevenue = truckTrips.reduce((sum, t) => {
      const extra = (t.subTrips || []).reduce((s, st) => s + (st.income || 0), 0);
      return sum + extra;
    }, 0);
    const totalIncome = freightRevenue + otherRevenue;

    const driverSalary = truckTrips.reduce((sum, t) => sum + (getTripMetrics(t).driverWages || 0), 0);
    const fuelExpenses = truckExpenses.filter(e => e.expenseType === 'Fuel').reduce((sum, e) => sum + (e.amount || 0), 0);
    const tollExpenses = truckExpenses.filter(e => e.expenseType === 'Toll').reduce((sum, e) => sum + (e.amount || 0), 0);
    const maintenanceExpenses = truckExpenses.filter(e => e.expenseType === 'Maintenance').reduce((sum, e) => sum + (e.amount || 0), 0);
    const adhocExpenses = truckExpenses.filter(e => e.expenseType === 'Adhoc').reduce((sum, e) => sum + (e.amount || 0), 0);
    const otherExpenses = truckExpenses.filter(e => !['Fuel', 'Toll', 'Maintenance', 'Adhoc'].includes(e.expenseType)).reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const totalTripExpense = driverSalary + fuelExpenses + tollExpenses;
    const totalGeneralExpense = maintenanceExpenses + adhocExpenses + otherExpenses;
    const totalExpense = totalTripExpense + totalGeneralExpense;
    const truckNetProfit = totalIncome - totalExpense;
    const marginPct = totalIncome > 0 ? (truckNetProfit / totalIncome) * 100 : 0;

    return {
      id: truck.id,
      truckNo: truck.truckNo,
      make: truck.make || 'Tata',
      model: truck.model || 'Signa',
      type: truck.type || 'Carrier',
      tripsCount,
      totalIncome,
      totalTripExpense,
      totalGeneralExpense,
      totalExpense,
      netProfit: truckNetProfit,
      marginPct
    };
  }));

  const reportData = createMemo(() => showActiveOnly() 
    ? rawReportData().filter(d => d.tripsCount > 0 || d.totalGeneralExpense > 0)
    : rawReportData());

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Vehicle No', 'Make', 'Model', 'Type', 'Trips', 'Total Income', 'Trip Expense', 'General Expense', 'Total Expense', 'Net Profit', 'Margin %'];
    const rows = reportData().map(d => [
      d.truckNo,
      d.make,
      d.model,
      d.type,
      d.tripsCount,
      d.totalIncome,
      d.totalTripExpense,
      d.totalGeneralExpense,
      d.totalExpense,
      d.netProfit,
      d.marginPct.toFixed(2)
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LorryGuru_Monthly_Report_${props.selectedMonth}_${props.selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const overallIncome = createMemo(() => reportData().reduce((sum, d) => sum + d.totalIncome, 0));
  const overallExpenses = createMemo(() => reportData().reduce((sum, d) => sum + d.totalExpense, 0));
  const overallNetProfit = createMemo(() => overallIncome() - overallExpenses());
  const overallMargin = createMemo(() => overallIncome() > 0 ? (overallNetProfit() / overallIncome()) * 100 : 0);
  const totalTripsRecorded = createMemo(() => reportData().reduce((sum, d) => sum + d.tripsCount, 0));

  const topTruck = createMemo(() => reportData().length > 0 
    ? [...reportData()].sort((a, b) => b.netProfit - a.netProfit)[0]
    : null);

  const chartData = createMemo(() => reportData().map(d => ({
    name: d.truckNo,
    Income: d.totalIncome,
    Expenses: d.totalExpense,
    'Net Profit': d.netProfit
  })));


  
  return (
    <div id="monthly-report-tab" class="space-y-6 animate-fade-in printing:p-0 printing:bg-white printing:text-black">
      
      {/* FILTER CONTROL BAR & TOOLBAR ACTIONS */}
      <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between no-print">
        <div class="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Calendar Selectors */}
          <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-3">
            <Calendar class="w-4 h-4 text-slate-450" />
            <select
              id="report-month-select"
              value={props.selectedMonth}
              disabled={isAllTime()}
              onChange={(e) => props.setSelectedMonth(e.target.value)}
              class="bg-transparent border-0 text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer pr-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {months.map(m => (
                <option  value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              id="report-year-select"
              value={props.selectedYear}
              onChange={(e) => props.setSelectedYear(e.target.value)}
              class="bg-transparent border-0 text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer pl-2 border-l border-slate-200"
            >
              {years.map(y => (
                <option  value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Truck Selector */}
          <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-3">
            <TruckIcon class="w-4 h-4 text-slate-450" />
            <select
              id="report-truck-select"
              value={selectedTruck()}
              onChange={(e) => setSelectedTruck(e.target.value)}
              class="bg-transparent border-0 text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer pr-4"
            >
              <option value="">&mdash; All Trucks &mdash;</option>
              {props.trucks.map(t => (
                <option  value={t.truckNo}>{t.truckNo}</option>
              ))}
            </select>
          </div>

          {/* Active vehicle filter removed by user request */}
        </div>

        {/* Toolbar Buttons */}
        <div class="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            id="btn-print-report"
            onClick={handlePrint}
            title="Print Monthly Ledger Audit Sheet"
            class="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 text-xs flex items-center gap-1.5 font-bold shadow-2xs cursor-pointer active:scale-95 duration-100"
          >
            <Printer class="w-3.5 h-3.5 text-slate-450" />
            <span>Print Report</span>
          </button>

          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            title="Download CSV Worksheet (.csv)"
            class="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg border border-slate-800 text-xs flex items-center gap-1.5 font-bold shadow-2xs cursor-pointer active:scale-95 duration-100"
          >
            <Download class="w-3.5 h-3.5 text-slate-300" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* HEADER SECTION IN PRINT FORMAT */}
      <div class="hidden printing:block border-b border-slate-350 pb-4 mb-6">
        <h2 class="text-2xl font-black text-slate-900 font-mono tracking-tight uppercase">FleetTrack Pro - Monthly Audit Document</h2>
        <p class="text-xs text-slate-500 mt-1 uppercase font-mono font-bold">
          Accounting Period: {selectedMonthObj()?.label} {props.selectedYear} | Generated on {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* FINANCIAL OVERVIEW GRID */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* MONTHLY REVENUE */}
        <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition hover:shadow-md duration-150">
          <div class="space-y-1">
            <span class="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Monthly Total Costing</span>
            <span class="text-xl md:text-2xl font-extrabold text-slate-900 font-sans tracking-tight block">₹{overallIncome().toLocaleString('en-IN')}</span>
            <p class="text-[10px] text-slate-450 mt-1 flex items-center gap-1">
              <span class="font-bold text-blue-600">{totalTripsRecorded()}</span> active trip legs registered
            </p>
          </div>
          <div class="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-blue-605">
            <TrendingUp class="w-5 h-5" />
          </div>
        </div>

        {/* COMBINED EXPENSES */}
        <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition hover:shadow-md duration-150">
          <div class="space-y-1">
            <span class="text-[10px] text-slate-405 font-extrabold uppercase tracking-wider block">Gross Month Expenditure</span>
            <span class="text-xl md:text-2xl font-extrabold text-rose-600 font-sans tracking-tight block">₹{overallExpenses().toLocaleString('en-IN')}</span>
            <p class="text-[10px] text-slate-450 mt-1">
              ₹{targetExpenses().reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-IN')} separate from general vouchers
            </p>
          </div>
          <div class="p-3 bg-rose-50/60 rounded-xl border border-rose-100 text-rose-500">
            <Coins class="w-5 h-5" />
          </div>
        </div>

        {/* NET MONTH ADJUSTED MARGIN */}
        <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition hover:shadow-md duration-150">
          <div class="space-y-1">
            <span class="text-[10px] text-slate-405 font-extrabold uppercase tracking-wider block">Net Period Yield</span>
            <span class={`text-xl md:text-2xl font-extrabold font-sans tracking-tight block ${overallNetProfit() >= 0 ? 'text-emerald-600' : 'text-rose-605'}`}>
              ₹{overallNetProfit().toLocaleString('en-IN')}
            </span>
            <p class="text-[10px] text-slate-450 mt-1">
              Operational Surplus margin: <strong class={overallMargin() >= 0 ? 'text-emerald-605 font-bold' : 'text-rose-600 font-bold'}>{overallMargin().toFixed(1)}%</strong>
            </p>
          </div>
          <div class={`p-3 rounded-xl border ${overallNetProfit() >= 0 ? 'bg-emerald-50/60 border-emerald-100 text-emerald-600' : 'bg-rose-50/60 border-rose-100 text-rose-500'}`}>
            <DollarSign class="w-5 h-5" />
          </div>
        </div>

        {/* DRIVING WINNER FLEET */}
        <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition hover:shadow-md duration-150">
          <div class="space-y-1">
            <span class="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Highest Yielding Vehicle</span>
            <span class="text-sm font-extrabold text-slate-800 font-mono tracking-wider block uppercase truncate max-w-[170px]">
              {topTruck() && topTruck().netProfit > 0 ? topTruck().truckNo : 'Not computed'}
            </span>
            <p class="text-[10px] text-slate-450 mt-1">
              {topTruck() && topTruck().netProfit > 0 ? (
                <>Cleared net profit of <strong class="font-bold text-emerald-605">₹{topTruck().netProfit.toLocaleString('en-IN')}</strong></>
              ) : (
                'No surplus calculated.'
              )}
            </p>
          </div>
          <div class="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-indigo-600">
            <Award class="w-5 h-5" />
          </div>
        </div>
      </div>

      {reportData().length === 0 ? (
        /* SILENT EMPTY STATE BANNER */
        <div id="no-reports-banner" class="bg-slate-100 border border-slate-200 p-12 py-16 rounded-xl flex flex-col items-center text-center justify-center gap-3">
          <AlertCircle class="w-12 h-12 text-slate-400" />
          <h3 class="font-extrabold text-slate-700 text-sm uppercase tracking-wide">No Entries and Transactions in {selectedMonthObj()?.label} {props.selectedYear}</h3>
          <p class="text-xs text-slate-450 max-w-sm leading-relaxed">
            There were no trip starts or general expense vouchers logged inside this selected calendar timeline. Select a different month to examine analytics.
          </p>
        </div>
      ) : (
        <>
          {/* HIGHLY INTERACTIVE BAR CHART MODULE */}
          <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4 no-print">
            <div>
              <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Income, Expenses & Net Profit comparison</h3>
              <p class="text-xs text-slate-450 leading-relaxed font-semibold">
                Side-by-side transaction ratios comparing combined revenue flows and outgoings grouped per truck.
              </p>
            </div>
            
                        <div class="w-full overflow-x-auto pt-4">
              <div class="min-w-[600px] flex flex-col space-y-4">
                <div class="flex flex-wrap gap-4 text-[10px] font-bold justify-center pb-2 border-b border-slate-100">
                  <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 bg-blue-500 rounded-xs"></span>Income</div>
                  <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 bg-rose-500 rounded-xs"></span>Expenses</div>
                  <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 bg-emerald-500 rounded-xs"></span>Net Profit</div>
                </div>
                <div class="h-64 flex items-end gap-6 px-4">
                  <For each={chartData()}>
                    {(item) => {
                      const maxVal = Math.max(...chartData().map(d => Math.max(d.Income, d.Expenses, Math.abs(d['Net Profit']))), 1000);
                      const incHeight = (item.Income / maxVal) * 180;
                      const expHeight = (item.Expenses / maxVal) * 180;
                      const netHeight = (Math.max(0, item['Net Profit']) / maxVal) * 180;
                      return (
                        <div class="flex-1 flex flex-col items-center group relative">
                          <div class="w-full flex items-end justify-center gap-1.5 h-48 border-b border-slate-200 pb-1">
                            <div 
                              class="w-3.5 bg-blue-500 rounded-t-xs hover:bg-blue-600 transition-all cursor-pointer relative"
                              style={{ height: `${incHeight}px` }}
                              title={`Income: ₹${item.Income.toLocaleString('en-IN')}`}
                            />
                            <div 
                              class="w-3.5 bg-rose-500 rounded-t-xs hover:bg-rose-600 transition-all cursor-pointer relative"
                              style={{ height: `${expHeight}px` }}
                              title={`Expenses: ₹${item.Expenses.toLocaleString('en-IN')}`}
                            />
                            <div 
                              class="w-3.5 bg-emerald-500 rounded-t-xs hover:bg-emerald-600 transition-all cursor-pointer relative"
                              style={{ height: `${netHeight}px` }}
                              title={`Net Profit: ₹${item['Net Profit'].toLocaleString('en-IN')}`}
                            />
                          </div>
                          <span class="text-[10px] font-mono font-bold text-slate-650 mt-2 truncate max-w-[70px]">
                            {item.name}
                          </span>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
            </div>

          </div>

          {/* DETAILED LEDGER GRID REPORT */}
          <div class="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div class="p-6 pb-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Financial summary by active vehicles</h3>
                <p class="text-xs text-slate-450 font-semibold font-sans">Individual balance sheets for each fleet asset recorded.</p>
              </div>
              <span class="text-[10px] text-slate-450 font-extrabold uppercase font-mono bg-slate-50 border border-slate-150 px-2.5 py-1 rounded-md shadow-3xs">
                {reportData().length} active units
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50 py-3.5 border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                    <th class="px-6 py-4">Vehicle Details</th>
                    <th class="px-4 py-4 text-center">Trips Ran</th>
                    <th class="px-4 py-4 text-right">Income (A)</th>
                    <th class="px-4 py-4 text-right">Trip-Expenses (B)</th>
                    <th class="px-4 py-4 text-right">Ledger-Expenses (C)</th>
                    <th class="px-4 py-4 text-right">Total Outgoings (B+C)</th>
                    <th class="px-4 py-4 text-right">Net Profit</th>
                    <th class="px-6 py-4 text-center">Margin</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 font-medium text-slate-700 text-xs">
                  {reportData().map((d) => (
                    <tr  id={`report-row-${d.id}`} class="hover:bg-slate-5/50 transition">
                      <td class="px-6 py-4">
                        <div class="flex flex-col gap-0.5">
                          <span class="font-mono font-extrabold text-slate-850 tracking-wider text-sm flex items-center gap-1">
                            <TruckIcon class="w-3.5 h-3.5 text-blue-500 rounded bg-slate-100 p-0.5 shrink-0" />
                            {d.truckNo}
                          </span>
                          <span class="text-[10px] text-slate-450 uppercase font-semibold">
                            {d.make} {d.model} &bull; {d.type}
                          </span>
                        </div>
                      </td>
                      <td class="px-4 py-4 text-center font-mono font-extrabold text-slate-700">
                        {d.tripsCount}
                      </td>
                      <td class="px-4 py-4 text-right font-mono font-extrabold text-slate-850">
                        ₹{d.totalIncome.toLocaleString()}
                      </td>
                      <td class="px-4 py-4 text-right font-mono font-bold text-slate-550">
                        ₹{d.totalTripExpense.toLocaleString()}
                      </td>
                      <td class="px-4 py-4 text-right font-mono font-bold text-slate-550">
                        ₹{d.totalGeneralExpense.toLocaleString()}
                      </td>
                      <td class="px-4 py-4 text-right font-mono font-extrabold text-rose-500">
                        ₹{d.totalExpense.toLocaleString()}
                      </td>
                      <td class={`px-4 py-4 text-right font-mono font-extrabold ${d.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        ₹{d.netProfit.toLocaleString()}
                      </td>
                      <td class="px-6 py-4 text-center whitespace-nowrap">
                        <span class={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          d.marginPct > 40
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : d.marginPct > 15
                            ? 'bg-blue-50 text-blue-705 border border-blue-100'
                            : d.marginPct > 0
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-rose-50/70 text-rose-600 border border-rose-100/70'
                        }`}>
                          {d.marginPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  
                  {/* Totals Calculation Line */}
                  <tr class="bg-slate-50/50 font-black text-slate-900 border-t-2 border-slate-200">
                    <td class="px-6 py-4 font-bold text-slate-900 text-sm">TOTAL COMBINED PERIOD GAUGE</td>
                    <td class="px-4 py-4 text-center font-mono font-black">{totalTripsRecorded()}</td>
                    <td class="px-4 py-4 text-right font-mono font-black border-slate-200 text-blue-600">₹{overallIncome().toLocaleString()}</td>
                    <td class="px-4 py-4 text-right font-mono text-slate-600 font-bold">₹{reportData().reduce((s,x)=> s + x.totalTripExpense, 0).toLocaleString()}</td>
                    <td class="px-4 py-4 text-right font-mono text-slate-600 font-bold">₹{reportData().reduce((s,x)=> s + x.totalGeneralExpense, 0).toLocaleString()}</td>
                    <td class="px-4 py-4 text-right font-mono font-black text-rose-600">₹{overallExpenses().toLocaleString()}</td>
                    <td class={`px-4 py-4 text-right font-mono font-black ${overallNetProfit() >= 0 ? 'text-emerald-605 text-emerald-600' : 'text-rose-605'}`}>₹{overallNetProfit().toLocaleString()}</td>
                    <td class="px-6 py-4 text-center">
                      <span class={`inline-block px-3 py-1 rounded-xl text-[11px] font-black border uppercase shadow-3xs ${
                        overallMargin() >= 0 ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-rose-600 text-white border-rose-500'
                      }`}>
                        {overallMargin().toFixed(1)}% Margin
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* DETAILED TRANSACTION TRACE AUDITS SECTION */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
            
            {/* TRIP TRANSACTIONS LIST */}
            <div class="bg-white border border-slate-200 rounded-xl shadow-xs p-6 flex flex-col justify-between">
              <div>
                <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Trip records this month</h3>
                <p class="text-xs text-slate-500 leading-relaxed max-w-sm mb-4">
                  Log of journeys initialized within {selectedMonthObj()?.label} {props.selectedYear}.
                </p>

                <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {targetTrips().length === 0 ? (
                    <p class="text-center py-10 text-xs italic text-slate-400">No active trips started this month.</p>
                  ) : (
                    targetTrips().map((t) => {
                      const m = getTripMetrics(t);
                      return (
                        <div  class="bg-slate-50 p-3 rounded-lg border border-slate-150 text-xs flex justify-between items-center hover:bg-slate-100 transition">
                          <div class="space-y-0.5">
                            <p class="font-mono font-extrabold text-slate-800 tracking-wide">{t.tripNo}</p>
                            <p class="text-[10px] text-slate-450 uppercase font-bold flex items-center gap-1 font-mono">
                              {t.truckNo} &bull; {t.driverName}
                            </p>
                          </div>
                          
                          <div class="text-right font-mono">
                            <span class="font-extrabold text-slate-850 block">₹{m.income.toLocaleString()}</span>
                            <span class="text-[10px] text-rose-500 font-bold block">Exp: ₹{m.totalExpense.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div class="mt-4 pt-3 border-t border-slate-105 flex justify-between text-[11px] font-bold text-slate-500 font-sans">
                <span>Trip volume logged:</span>
                <span class="font-mono font-black text-slate-800">{targetTrips().length} entries</span>
              </div>
            </div>

            {/* GENERAL EXTRA EXPENDITURE VOUCHERS LIST */}
            <div class="bg-white border border-slate-200 rounded-xl shadow-xs p-6 flex flex-col justify-between">
              <div>
                <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">General extra expense vouchers</h3>
                <p class="text-xs text-slate-500 leading-relaxed max-w-sm mb-4">
                  Standalone operating & fleet maintenance bills registered.
                </p>

                <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {targetExpenses().length === 0 ? (
                    <p class="text-center py-10 text-xs italic text-slate-400">No standalone vouchers filed this month.</p>
                  ) : (
                    targetExpenses().map((exp) => (
                      <div  class="bg-slate-50 p-3 rounded-lg border border-slate-150 text-xs flex justify-between items-center hover:bg-slate-100 transition">
                        <div class="space-y-0.5">
                          <p class="font-extrabold text-slate-800 tracking-wide truncate max-w-[160px]">{exp.expenseType} &bull; {exp.shopName}</p>
                          <p class="text-[10px] text-slate-450 uppercase font-bold font-mono">
                            {exp.truckNo} &bull; {exp.date}
                          </p>
                        </div>
                        
                        <div class="text-right font-mono">
                          <span class="font-extrabold text-rose-600 block">₹{exp.amount.toLocaleString()}</span>
                          <span class="text-[9px] font-black uppercase text-slate-400 bg-white border px-1.5 py-0.5 rounded shadow-3xs">{exp.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div class="mt-4 pt-3 border-t border-slate-105 flex justify-between text-[11px] font-bold text-slate-500 font-sans">
                <span>Vouchers count:</span>
                <span class="font-mono font-black text-slate-800">{targetExpenses().length} files</span>
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
