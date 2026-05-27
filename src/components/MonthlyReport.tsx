import React, { useState } from 'react';
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
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

interface MonthlyReportProps {
  trips: TripEntry[];
  trucks: Truck[];
  expenses: ExpenseEntry[];
}

export default function MonthlyReport({ trips, trucks, expenses }: MonthlyReportProps) {
  // Query Filter state
  const [selectedMonth, setSelectedMonth] = useState('05'); // Default: May
  const [selectedYear, setSelectedYear] = useState('2026');   // Default: 2026
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState('');

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

  const years = ['2025', '2026', '2027', '2028', '2029', '2030'];

  const targetMonthStr = `${selectedYear}-${selectedMonth}`;

  // Filter raw collections to selected month
  const targetTrips = trips.filter(
    t => t.startDate && t.startDate.startsWith(targetMonthStr)
  );

  const targetExpenses = expenses.filter(
    e => e.date && e.date.startsWith(targetMonthStr) && e.status !== 'Declined'
  );

  // Group and compute metrics grouped by Truck
  const filteredTrucks = selectedTruck 
    ? trucks.filter(t => t.truckNo === selectedTruck)
    : trucks;

  const rawReportData = filteredTrucks.map(truck => {
    const truckTrips = targetTrips.filter(t => t.truckNo === truck.truckNo);
    const truckGeneralExpenses = targetExpenses.filter(e => e.truckNo === truck.truckNo);

    let totalIncome = 0;
    let totalTripExpense = 0;
    const tripsCount = truckTrips.length;

    truckTrips.forEach(t => {
      const metrics = getTripMetrics(t);
      totalIncome += metrics.income;
      totalTripExpense += metrics.totalExpense;
    });

    const totalGeneralExpense = truckGeneralExpenses.reduce(
      (sum, e) => sum + (Number(e.amount) || 0), 
      0
    );

    const totalExpense = totalTripExpense + totalGeneralExpense;
    const netProfit = totalIncome - totalExpense;
    const marginPct = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

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
      netProfit,
      marginPct
    };
  });

  // Filter based on user configuration
  const reportData = showActiveOnly 
    ? rawReportData.filter(d => d.tripsCount > 0 || d.totalGeneralExpense > 0)
    : rawReportData;

  // Monthly aggregated totals
  const overallIncome = reportData.reduce((sum, d) => sum + d.totalIncome, 0);
  const overallExpenses = reportData.reduce((sum, d) => sum + d.totalExpense, 0);
  const overallNetProfit = overallIncome - overallExpenses;
  const overallMargin = overallIncome > 0 ? (overallNetProfit / overallIncome) * 100 : 0;
  const totalTripsRecorded = reportData.reduce((sum, d) => sum + d.tripsCount, 0);

  // Find top performing vehicle of the month
  const topTruck = reportData.length > 0 
    ? [...reportData].sort((a, b) => b.netProfit - a.netProfit)[0]
    : null;

  // Chart structured formatting
  const chartData = reportData.map(d => ({
    name: d.truckNo,
    Income: d.totalIncome,
    Expenses: d.totalExpense,
    'Net Profit': d.netProfit
  }));

  // Recharts Modern Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-800 text-white p-3.5 rounded-xl shadow-2xl font-sans text-xs">
          <p className="font-extrabold text-amber-400 mb-2 font-mono tracking-wide">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex justify-between items-center gap-6">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }}></span>
                  {entry.name}:
                </span>
                <span className="font-mono font-bold text-slate-100">₹{entry.value.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // CSV Exporter Action
  const handleExportCSV = () => {
    const headers = ['Vehicle No', 'Make', 'Model', 'Trips Ran', 'Billed Income (INR)', 'Trip Expenses (INR)', 'General Vouchers (INR)', 'Total Combined Expenses (INR)', 'Net Profit (INR)', 'Profit Margin (%)'];
    const rows = reportData.map(d => [
      d.truckNo,
      d.make,
      d.model,
      d.tripsCount,
      d.totalIncome,
      d.totalTripExpense,
      d.totalGeneralExpense,
      d.totalExpense,
      d.netProfit,
      d.marginPct.toFixed(1)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FleetReport_${selectedYear}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger browser print layout
  const handlePrint = () => {
    window.print();
  };

  const selectedMonthObj = months.find(m => m.value === selectedMonth);

  return (
    <div id="monthly-report-tab" className="space-y-6 animate-fade-in printing:p-0 printing:bg-white printing:text-black">
      
      {/* FILTER CONTROL BAR & TOOLBAR ACTIONS */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between no-print">
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* Calendar Selectors */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-3">
            <Calendar className="w-4 h-4 text-slate-450" />
            <select
              id="report-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-0 text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer pr-4"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              id="report-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent border-0 text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer pl-2 border-l border-slate-200"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Truck Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-3">
            <TruckIcon className="w-4 h-4 text-slate-450" />
            <select
              id="report-truck-select"
              value={selectedTruck}
              onChange={(e) => setSelectedTruck(e.target.value)}
              className="bg-transparent border-0 text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer pr-4"
            >
              <option value="">&mdash; All Trucks &mdash;</option>
              {trucks.map(t => (
                <option key={t.id} value={t.truckNo}>{t.truckNo}</option>
              ))}
            </select>
          </div>

          {/* Active vehicle filter removed by user request */}
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            id="btn-print-report"
            onClick={handlePrint}
            title="Print Monthly Ledger Audit Sheet"
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 text-xs flex items-center gap-1.5 font-bold shadow-2xs cursor-pointer active:scale-95 duration-100"
          >
            <Printer className="w-3.5 h-3.5 text-slate-450" />
            <span>Print Report</span>
          </button>

          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            title="Download CSV Worksheet (.csv)"
            className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg border border-slate-800 text-xs flex items-center gap-1.5 font-bold shadow-2xs cursor-pointer active:scale-95 duration-100"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* HEADER SECTION IN PRINT FORMAT */}
      <div className="hidden printing:block border-b border-slate-350 pb-4 mb-6">
        <h2 className="text-2xl font-black text-slate-900 font-mono tracking-tight uppercase">FleetTrack Pro - Monthly Audit Document</h2>
        <p className="text-xs text-slate-500 mt-1 uppercase font-mono font-bold">
          Accounting Period: {selectedMonthObj?.label} {selectedYear} | Generated on {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* FINANCIAL OVERVIEW GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* MONTHLY REVENUE */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition hover:shadow-md duration-150">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Monthly Total Costing</span>
            <span className="text-xl md:text-2xl font-extrabold text-slate-900 font-sans tracking-tight block">₹{overallIncome.toLocaleString('en-IN')}</span>
            <p className="text-[10px] text-slate-450 mt-1 flex items-center gap-1">
              <span className="font-bold text-blue-600">{totalTripsRecorded}</span> active trip legs registered
            </p>
          </div>
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-blue-605">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* COMBINED EXPENSES */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition hover:shadow-md duration-150">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-405 font-extrabold uppercase tracking-wider block">Gross Month Expenditure</span>
            <span className="text-xl md:text-2xl font-extrabold text-rose-600 font-sans tracking-tight block">₹{overallExpenses.toLocaleString('en-IN')}</span>
            <p className="text-[10px] text-slate-450 mt-1">
              ₹{targetExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-IN')} separate from general vouchers
            </p>
          </div>
          <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100 text-rose-500">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* NET MONTH ADJUSTED MARGIN */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition hover:shadow-md duration-150">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-405 font-extrabold uppercase tracking-wider block">Net Period Yield</span>
            <span className={`text-xl md:text-2xl font-extrabold font-sans tracking-tight block ${overallNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-605'}`}>
              ₹{overallNetProfit.toLocaleString('en-IN')}
            </span>
            <p className="text-[10px] text-slate-450 mt-1">
              Operational Surplus margin: <strong className={overallMargin >= 0 ? 'text-emerald-605 font-bold' : 'text-rose-600 font-bold'}>{overallMargin.toFixed(1)}%</strong>
            </p>
          </div>
          <div className={`p-3 rounded-xl border ${overallNetProfit >= 0 ? 'bg-emerald-50/60 border-emerald-100 text-emerald-600' : 'bg-rose-50/60 border-rose-100 text-rose-500'}`}>
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* DRIVING WINNER FLEET */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition hover:shadow-md duration-150">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Highest Yielding Vehicle</span>
            <span className="text-sm font-extrabold text-slate-800 font-mono tracking-wider block uppercase truncate max-w-[170px]">
              {topTruck && topTruck.netProfit > 0 ? topTruck.truckNo : 'Not computed'}
            </span>
            <p className="text-[10px] text-slate-450 mt-1">
              {topTruck && topTruck.netProfit > 0 ? (
                <>Cleared net profit of <strong className="font-bold text-emerald-605">₹{topTruck.netProfit.toLocaleString('en-IN')}</strong></>
              ) : (
                'No surplus calculated.'
              )}
            </p>
          </div>
          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-indigo-600">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {reportData.length === 0 ? (
        /* SILENT EMPTY STATE BANNER */
        <div id="no-reports-banner" className="bg-slate-100 border border-slate-200 p-12 py-16 rounded-xl flex flex-col items-center text-center justify-center gap-3">
          <AlertCircle className="w-12 h-12 text-slate-400" />
          <h3 className="font-extrabold text-slate-700 text-sm uppercase tracking-wide">No Entries and Transactions in {selectedMonthObj?.label} {selectedYear}</h3>
          <p className="text-xs text-slate-450 max-w-sm leading-relaxed">
            There were no trip starts or general expense vouchers logged inside this selected calendar timeline. Select a different month to examine analytics.
          </p>
        </div>
      ) : (
        <>
          {/* HIGHLY INTERACTIVE BAR CHART MODULE */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4 no-print">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Income, Expenses & Net Profit comparison</h3>
              <p className="text-xs text-slate-450 leading-relaxed font-semibold">
                Side-by-side transaction ratios comparing combined revenue flows and outgoings grouped per truck.
              </p>
            </div>
            
            <div className="w-full h-80 min-h-[300px] pt-4 font-sans select-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#475569" 
                    fontSize={11} 
                    fontWeight={600}
                    tickLine={false} 
                    axisLine={false}
                    className="font-mono tracking-wider"
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `₹${(val / 1000).toLocaleString()}k`}
                    className="font-medium"
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}
                  />
                  <Bar dataKey="Income" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Net Profit" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DETAILED LEDGER GRID REPORT */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-6 pb-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Financial summary by active vehicles</h3>
                <p className="text-xs text-slate-450 font-semibold font-sans">Individual balance sheets for each fleet asset recorded.</p>
              </div>
              <span className="text-[10px] text-slate-450 font-extrabold uppercase font-mono bg-slate-50 border border-slate-150 px-2.5 py-1 rounded-md shadow-3xs">
                {reportData.length} active units
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 py-3.5 border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-sans">
                    <th className="px-6 py-4">Vehicle Details</th>
                    <th className="px-4 py-4 text-center">Trips Ran</th>
                    <th className="px-4 py-4 text-right">Income (A)</th>
                    <th className="px-4 py-4 text-right">Trip-Expenses (B)</th>
                    <th className="px-4 py-4 text-right">Ledger-Expenses (C)</th>
                    <th className="px-4 py-4 text-right">Total Outgoings (B+C)</th>
                    <th className="px-4 py-4 text-right">Net Profit</th>
                    <th className="px-6 py-4 text-center">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-xs">
                  {reportData.map((d) => (
                    <tr key={d.id} id={`report-row-${d.id}`} className="hover:bg-slate-5/50 transition">
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-extrabold text-slate-850 tracking-wider text-sm flex items-center gap-1">
                            <TruckIcon className="w-3.5 h-3.5 text-blue-500 rounded bg-slate-100 p-0.5 shrink-0" />
                            {d.truckNo}
                          </span>
                          <span className="text-[10px] text-slate-450 uppercase font-semibold">
                            {d.make} {d.model} &bull; {d.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-mono font-extrabold text-slate-700">
                        {d.tripsCount}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-extrabold text-slate-850">
                        ₹{d.totalIncome.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-slate-550">
                        ₹{d.totalTripExpense.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-slate-550">
                        ₹{d.totalGeneralExpense.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-extrabold text-rose-500">
                        ₹{d.totalExpense.toLocaleString()}
                      </td>
                      <td className={`px-4 py-4 text-right font-mono font-extrabold ${d.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        ₹{d.netProfit.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
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
                  <tr className="bg-slate-50/50 font-black text-slate-900 border-t-2 border-slate-200">
                    <td className="px-6 py-4 font-bold text-slate-900 text-sm">TOTAL COMBINED PERIOD GAUGE</td>
                    <td className="px-4 py-4 text-center font-mono font-black">{totalTripsRecorded}</td>
                    <td className="px-4 py-4 text-right font-mono font-black border-slate-200 text-blue-600">₹{overallIncome.toLocaleString()}</td>
                    <td className="px-4 py-4 text-right font-mono text-slate-600 font-bold">₹{reportData.reduce((s,x)=> s + x.totalTripExpense, 0).toLocaleString()}</td>
                    <td className="px-4 py-4 text-right font-mono text-slate-600 font-bold">₹{reportData.reduce((s,x)=> s + x.totalGeneralExpense, 0).toLocaleString()}</td>
                    <td className="px-4 py-4 text-right font-mono font-black text-rose-600">₹{overallExpenses.toLocaleString()}</td>
                    <td className={`px-4 py-4 text-right font-mono font-black ${overallNetProfit >= 0 ? 'text-emerald-605 text-emerald-600' : 'text-rose-605'}`}>₹{overallNetProfit.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-xl text-[11px] font-black border uppercase shadow-3xs ${
                        overallMargin >= 0 ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-rose-600 text-white border-rose-500'
                      }`}>
                        {overallMargin.toFixed(1)}% Margin
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* DETAILED TRANSACTION TRACE AUDITS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
            
            {/* TRIP TRANSACTIONS LIST */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Trip records this month</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mb-4">
                  Log of journeys initialized within {selectedMonthObj?.label} {selectedYear}.
                </p>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {targetTrips.length === 0 ? (
                    <p className="text-center py-10 text-xs italic text-slate-400">No active trips started this month.</p>
                  ) : (
                    targetTrips.map((t) => {
                      const m = getTripMetrics(t);
                      return (
                        <div key={t.id} className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-xs flex justify-between items-center hover:bg-slate-100 transition">
                          <div className="space-y-0.5">
                            <p className="font-mono font-extrabold text-slate-800 tracking-wide">{t.tripNo}</p>
                            <p className="text-[10px] text-slate-450 uppercase font-bold flex items-center gap-1 font-mono">
                              {t.truckNo} &bull; {t.driverName}
                            </p>
                          </div>
                          
                          <div className="text-right font-mono">
                            <span className="font-extrabold text-slate-850 block">₹{m.income.toLocaleString()}</span>
                            <span className="text-[10px] text-rose-500 font-bold block">Exp: ₹{m.totalExpense.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-105 flex justify-between text-[11px] font-bold text-slate-500 font-sans">
                <span>Trip volume logged:</span>
                <span className="font-mono font-black text-slate-800">{targetTrips.length} entries</span>
              </div>
            </div>

            {/* GENERAL EXTRA EXPENDITURE VOUCHERS LIST */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">General extra expense vouchers</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mb-4">
                  Standalone operating & fleet maintenance bills registered.
                </p>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {targetExpenses.length === 0 ? (
                    <p className="text-center py-10 text-xs italic text-slate-400">No standalone vouchers filed this month.</p>
                  ) : (
                    targetExpenses.map((exp) => (
                      <div key={exp.id} className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-xs flex justify-between items-center hover:bg-slate-100 transition">
                        <div className="space-y-0.5">
                          <p className="font-extrabold text-slate-800 tracking-wide truncate max-w-[160px]">{exp.expenseType} &bull; {exp.shopName}</p>
                          <p className="text-[10px] text-slate-450 uppercase font-bold font-mono">
                            {exp.truckNo} &bull; {exp.date}
                          </p>
                        </div>
                        
                        <div className="text-right font-mono">
                          <span className="font-extrabold text-rose-600 block">₹{exp.amount.toLocaleString()}</span>
                          <span className="text-[9px] font-black uppercase text-slate-400 bg-white border px-1.5 py-0.5 rounded shadow-3xs">{exp.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-105 flex justify-between text-[11px] font-bold text-slate-500 font-sans">
                <span>Vouchers count:</span>
                <span className="font-mono font-black text-slate-800">{targetExpenses.length} files</span>
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
