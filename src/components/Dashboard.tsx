import React from 'react';
import { TripEntry, Truck, Office, Account, getTripMetrics, UserRights } from '../types';
import { Landmark, TrendingUp, AlertCircle, ShieldAlert, BadgeCent, CheckCircle2, Navigation, DollarSign } from 'lucide-react';
import { getOutstandingAge, formatToDisplayDate } from '../lib/dateUtils';

interface DashboardProps {
  trips: TripEntry[];
  trucks: Truck[];
  offices: Office[];
  accounts: Account[];
  currentUserRights?: UserRights;
}

export default function Dashboard({ 
  trips, 
  trucks, 
  offices, 
  accounts, 
  currentUserRights
}: DashboardProps) {
  // Tooltip interactive state
  const [hoveredTruck, setHoveredTruck] = React.useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = React.useState({ x: 0, y: 0 });

  const {
    isAdmin = true,
    canViewTrips = true,
    canViewExpenses = true,
  } = currentUserRights || {};

  // Pre-calculate metrics for all master trips
  const metricsList = trips.map(t => getTripMetrics(t));

  const totalRental = metricsList.reduce((sum, m) => sum + m.income, 0);
  const totalExpenses = metricsList.reduce((sum, m) => sum + m.totalExpense, 0);
  const totalAdvances = metricsList.reduce((sum, m) => sum + m.paymentsReceived, 0);
  const totalOutstanding = metricsList.reduce((sum, m) => sum + m.outstandingBalance, 0);
  const totalProfit = metricsList.reduce((sum, m) => sum + m.profit, 0);
  const totalDiesel = metricsList.reduce((sum, m) => sum + m.dieselExpense, 0);

  // Status counts
  const pendingCount = trips.filter(t => t.status === 'Pending').length;
  const inProgressCount = trips.filter(t => t.status === 'In Progress').length;
  const completedCount = trips.filter(t => t.status === 'Completed').length;
  const paidCount = trips.filter(t => t.status === 'Paid').length;



  // Filter trips with outstanding older than 10 days
  const overdueTrips = trips.filter(t => {
    const m = getTripMetrics(t);
    if (m.outstandingBalance <= 0) return false;
    const age = getOutstandingAge(t.endDate || t.startDate);
    return age > 10;
  });

  const overdueCount = overdueTrips.length;

  // Let's obtain the Account Name mapping for easy readability
  const getAccountName = (id: string) => {
    if (id === 'paid_to_driver_advance') return 'Paid to Driver Advance';
    return accounts.find(a => a.id === id)?.accountName || id || 'N/A';
  };

  // Group accounts receiving funds and sum up their collections
  const accountFundsMap: { [key: string]: number } = {};
  trips.forEach(t => {
    (t.payments || []).forEach(p => {
      if (p.amount > 0 && p.receivedBy) {
        accountFundsMap[p.receivedBy] = (accountFundsMap[p.receivedBy] || 0) + Number(p.amount);
      }
    });
  });

  const fundsByAccount = Object.entries(accountFundsMap).map(([id, amount]) => ({
    accountName: getAccountName(id),
    amount
  })).sort((a, b) => b.amount - a.amount);

  // Group outstanding balance by Truck for risk mitigation
  const truckOutstandingMap: { [key: string]: number } = {};
  trips.forEach(t => {
    const m = getTripMetrics(t);
    const balAttr = m.outstandingBalance;
    if (balAttr > 0) {
      truckOutstandingMap[t.truckNo] = (truckOutstandingMap[t.truckNo] || 0) + balAttr;
    }
  });

  const topOutstandingTrucks = Object.entries(truckOutstandingMap).map(([truckNo, amount]) => ({
    truckNo,
    amount
  })).sort((a, b) => b.amount - a.amount);

  // Detailed hover information per truck
  const getTruckHoverDetails = (tNo: string) => {
    const truckTrips = trips.filter(t => t.truckNo === tNo);
    let totalIncome = 0;
    let totalPaid = 0;
    const officesUsed = new Set<string>();
    const detailsList: { office: string; income: number; advance: number; balance: number; date: string }[] = [];

    truckTrips.forEach(t => {
      const m = getTripMetrics(t);
      if (m.outstandingBalance > 0) {
        // Find segment info
        (t.subTrips || []).forEach(st => {
          if (st.officeName) officesUsed.add(st.officeName);
          
          // Calculate segment-specific payments if possible (subTripId matches)
          const segPayments = (t.payments || []).filter(p => p.subTripId === st.id).reduce((sum, p) => sum + p.amount, 0);
          const segBalance = st.income - segPayments;

          detailsList.push({
            office: st.officeName || 'Indirect/General',
            income: st.income,
            advance: segPayments,
            balance: segBalance,
            date: st.loadingDate || t.startDate || '—'
          });
        });

        // Let's also look at general payments block (unassigned payments)
        const unassignedPayments = (t.payments || []).filter(p => !p.subTripId).reduce((sum, p) => sum + p.amount, 0);
        if (unassignedPayments > 0 && detailsList.length > 0) {
          const share = Math.round(unassignedPayments / detailsList.length);
          detailsList.forEach(item => {
            item.advance += share;
            item.balance = Math.max(0, item.income - item.advance);
          });
        }

        totalIncome += m.income;
        totalPaid += m.paymentsReceived;
      }
    });

    const officeList = Array.from(officesUsed).join(', ') || 'N/A';
    const totalBalance = Math.max(0, totalIncome - totalPaid);

    return {
      officeList,
      totalIncome,
      totalPaid,
      totalBalance,
      detailsList
    };
  };

  // Calculations for beautiful visual progress rings
  const recoveryRate = totalRental > 0 
    ? Math.round((totalAdvances / totalRental) * 100) 
    : 100;

  const validRecoveryRate = isNaN(recoveryRate) ? 0 : Math.min(100, Math.max(0, recoveryRate));

  return (
    <div id="dashboard-tab" className="space-y-6 animate-fade-in">
      
      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* CONTRACT RENTAL */}
        {canViewTrips && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md duration-200">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider font-sans">Total Billed Income</span>
              <span className="text-xl md:text-2xl font-extrabold text-slate-900 font-sans tracking-tight leading-none">₹{totalRental.toLocaleString('en-IN')}</span>
              <p className="text-[10px] text-slate-400 mt-1">From {trips.length} registered trips</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-blue-600 shadow-3xs">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* OUTSTANDING BALANCES */}
        {canViewTrips && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md duration-200 relative overflow-hidden">
            {overdueCount > 0 && (
              <div className="absolute top-0 right-0">
                <span className="bg-red-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider animate-pulse inline-block">
                  Aged Debt Alert
                </span>
              </div>
            )}
            <div className="space-y-1 flex-1">
              <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider font-sans">Total Outstanding</span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`text-xl md:text-2xl font-extrabold font-sans tracking-tight leading-none ${totalOutstanding > 0 ? 'text-red-705 text-red-600 font-bold' : 'text-emerald-600'}`}>
                  ₹{totalOutstanding.toLocaleString('en-IN')}
                </span>
                {overdueCount > 0 && (
                  <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-100 animate-pulse">
                    {overdueCount} Overdue
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Collectable from broker sheets</p>
            </div>
            <div className={`p-3 rounded-lg border shadow-3xs shrink-0 ${totalOutstanding > 0 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* OPERATIONAL EXPENSES */}
        {canViewExpenses && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md duration-200">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider font-sans">Operational Expenses</span>
              <span className="text-xl md:text-2xl font-extrabold text-slate-905 font-sans tracking-tight leading-none text-red-600">₹{totalExpenses.toLocaleString('en-IN')}</span>
              <p className="text-[10px] text-slate-405 mt-1">₹{totalDiesel.toLocaleString('en-IN')} spent on Diesel</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-amber-600 shadow-3xs">
              <BadgeCent className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* RECOV REALIZED PROFIT */}
        {isAdmin && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md duration-200">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider font-sans">Net Adjusted Profit</span>
              <span className={`text-xl md:text-2xl font-extrabold font-sans tracking-tight leading-none ${totalProfit >= 0 ? 'text-emerald-700' : 'text-red-705 text-red-600 font-bold'}`}>
                ₹{totalProfit.toLocaleString('en-IN')}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">Margin: {totalRental > 0 ? Math.round((totalProfit / totalRental) * 100) : 0}% of Income</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-600 shadow-3xs">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      {/* MID SECTION CHARTS AND MASTER INSIGHTS */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
          
          {/* COLLECTION RATIO PIE GRAPH */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1 font-sans">Receipts & Profit Margin</h3>
              <p className="text-xs text-slate-500 font-sans font-normal">Visual mapping of overall contract capital transition clearing.</p>
            </div>

            <div className="my-6 flex items-center justify-center relative">
              <svg viewBox="0 0 100 100" className="w-36 h-36 transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="10" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  fill="transparent" 
                  stroke="#10b981" 
                  strokeWidth="10" 
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - validRecoveryRate / 100)}`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-900 font-sans tracking-tight">{validRecoveryRate}%</span>
                <span className="text-[9px] text-slate-400 uppercase font-bold">Incomings Received</span>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-slate-100 pt-4 font-sans">
              <div className="flex justify-between text-slate-600 font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>Customer Payments Received</span>
                <span className="font-mono text-slate-900 font-bold">₹{totalAdvances.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>Collectable Outstandings</span>
                <span className="font-mono text-slate-900 font-bold">₹{totalOutstanding.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>Expenses Billed</span>
                <span className="font-mono text-slate-900 font-bold">₹{totalExpenses.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* LEDGER ACCOUNTS COLLECTION SPLIT */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1 font-sans">Receipts by Accounts</h3>
              <p className="text-xs text-slate-500 font-sans font-normal font-sans">Total advances & settlements received into operational accounts.</p>
            </div>

            <div className="my-4 divide-y divide-slate-100 overflow-y-auto max-h-[180px] pr-1 flex-1">
              {fundsByAccount.length === 0 ? (
                <p className="text-center py-12 text-xs text-slate-400 italic font-sans font-sans font-normal">No customer receipts logged yet.</p>
              ) : (
                fundsByAccount.map(({ accountName, amount }) => {
                  const pct = totalAdvances > 0 ? Math.round((amount / totalAdvances) * 100) : 0;
                  return (
                    <div key={accountName} className="py-2.5 flex items-center justify-between gap-4 font-sans">
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[150px]">{accountName}</span>
                      <div className="flex-1 max-w-[80px]">
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, pct)}%` }}></div>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-900 text-right">₹{amount.toLocaleString('en-IN')}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2 mt-4 shadow-3xs font-sans">
              <Landmark className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span>Map accounts to payments / advances received.</span>
            </div>
          </div>

          {/* TOP OUTSTANDING LIABILITIES BY TRUCK */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1 font-sans">Outstanding by Truck</h3>
              <p className="text-xs text-slate-500 font-sans">Active pending outstandings grouped per truck datasheet reference.</p>
            </div>

            <div className="my-4 divide-y divide-slate-100 overflow-y-auto max-h-[180px] pr-1 flex-1">
              {topOutstandingTrucks.length === 0 ? (
                <p className="text-center py-12 text-xs text-emerald-600 italic font-medium font-sans">Excellent! All truck balances are fully settled.</p>
              ) : (
                topOutstandingTrucks.map(({ truckNo, amount }) => (
                  <div 
                    key={truckNo} 
                    className="py-2.5 flex items-center justify-between gap-4 font-sans hover:bg-slate-50 px-2 rounded-lg transition duration-150 cursor-pointer"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const showOnRight = rect.left < 340;
                      setHoveredTruck(truckNo);
                      setHoverPosition({
                        x: showOnRight ? rect.right + 12 : rect.left - 332,
                        y: rect.top + window.scrollY - 30
                      });
                    }}
                    onMouseLeave={() => setHoveredTruck(null)}
                  >
                    <span className="text-xs font-bold text-slate-705 uppercase font-mono tracking-wider flex items-center gap-1.5">
                      <Navigation className="w-3 h-3 text-slate-400 rotate-45" />
                      {truckNo}
                    </span>
                    <span className="text-xs font-mono font-bold text-red-650 bg-red-50 border border-red-100 px-2 py-0.5 rounded shadow-3xs text-red-600">
                      ₹{amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2 mt-4 shadow-3xs font-sans">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span>Provides direct oversight over customer-side defaults.</span>
            </div>
          </div>

        </div>
      )}

      {/* PIE CHART STATS & AGED RECEIVABLES COLLECTION TRACKER */}
      {canViewTrips && (
        <>
          {/* PIE CHART STATS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-2xs font-sans">
              <span className="text-[10px] text-slate-400 uppercase font-bold font-sans">Pending Advances</span>
              <p className="text-lg font-bold text-slate-800 mt-1 font-mono">{pendingCount}</p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-2xs font-sans">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Active Transitions</span>
              <p className="text-lg font-bold text-amber-600 mt-1 font-mono">{inProgressCount}</p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-2xs font-sans">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Delivered Goods</span>
              <p className="text-lg font-bold text-blue-600 mt-1 font-mono">{completedCount}</p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-2xs font-sans">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Settled Trips</span>
              <p className="text-lg font-bold text-emerald-600 mt-1 font-mono">{paidCount}</p>
            </div>
          </div>

          {/* AGED RECEIVABLES COLLECTION TRACKER PANEL */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2.5 bg-rose-50 text-rose-700 border border-rose-100 rounded font-extrabold text-[10px] uppercase tracking-wider animate-pulse flex items-center gap-1 shrink-0">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Collection Risk
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-sans">
                    Aged Outstanding Receivables ({'>'} 10 Days) Tracker
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Active transport journal auditor flagging trips where outstanding brokerage balances exceed 10 days to maximize collection rates.
                </p>
              </div>

            </div>

            {overdueCount === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl p-8 py-10 text-center bg-slate-50/50">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Perfect Collection Health</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Excellent! No completed transport segments have outstanding balances exceeding 10 days.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full text-left text-xs whitespace-nowrap divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="p-3 pl-4">Trip No / Details</th>
                      <th className="p-3">Truck & Driver</th>
                      <th className="p-3 text-center">Completed Date</th>
                      <th className="p-3 text-center">Unpaid Age</th>
                      <th className="p-3 text-right">Trip Rent</th>
                      <th className="p-3 text-right">Advances Handled</th>
                      <th className="p-3 text-right">Aged Outstanding</th>
                      <th className="p-3 text-center">Alert Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {overdueTrips.map(trip => {
                      const m = getTripMetrics(trip);
                      const age = getOutstandingAge(trip.endDate || trip.startDate);
                      const completionDate = trip.endDate || trip.startDate || 'N/A';
                      
                      return (
                        <tr key={trip.id} className="hover:bg-slate-50/40 transition">
                          <td className="p-3 pl-4">
                            <span className="font-mono font-bold text-slate-900 block">{trip.tripNo}</span>
                            <span className="text-[10px] text-slate-405 font-medium block truncate max-w-[200px]">{trip.notes || 'Aged customer-side default'}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-mono font-bold text-slate-800 block text-[11px]">{trip.truckNo}</span>
                            <span className="text-[10px] text-slate-500 font-normal block">{trip.driverName}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-mono">{formatToDisplayDate(completionDate)}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-block bg-red-50 border border-red-100 text-red-700 font-bold px-2 py-0.5 rounded shadow-3xs font-mono text-[10px] animate-pulse">
                              {age} Days Overdue
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-800">
                            ₹{m.income.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600">
                            ₹{m.paymentsReceived.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-mono text-red-650 bg-red-50/35 text-sm font-bold">
                            ₹{m.outstandingBalance.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-600 shrink-0 shadow-xs animate-ping" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {hoveredTruck && (() => {
        const det = getTruckHoverDetails(hoveredTruck);
        return (
          <div 
            className="fixed z-50 w-80 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-4 font-sans text-xs pointer-events-none transition-all duration-150 animate-fade-in"
            style={{ 
              left: `${hoverPosition.x}px`, 
              top: `${hoverPosition.y}px`,
              boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)'
            }}
          >
            <div className="border-b border-slate-705 pb-1.5 mb-2 flex justify-between items-center">
              <span className="font-extrabold text-[12px] text-amber-400 tracking-wider font-mono">{hoveredTruck}</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase">Balance Drilldown</span>
            </div>

            <div className="space-y-1.5 font-sans mb-3 text-slate-300">
              <p>
                <strong className="text-slate-400 uppercase text-[8px] block tracking-wide">Loading Office(s):</strong>
                <span className="font-semibold text-white text-[11px] leading-tight block">{det.officeList || 'Indirect/General'}</span>
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                  <span className="text-slate-400 block font-bold text-[8px] uppercase">Billed Income</span>
                  <span className="font-mono font-bold text-emerald-400">₹{det.totalIncome.toLocaleString()}</span>
                </div>
                <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                  <span className="text-slate-400 block font-bold text-[8px] uppercase">Advance Information</span>
                  <span className="font-mono font-bold text-indigo-400">₹{det.totalPaid.toLocaleString()}</span>
                </div>
              </div>
              <div className="bg-rose-950/40 border border-rose-900/40 p-1.5 rounded mt-1.5 flex justify-between items-center">
                <span className="text-rose-300 font-bold text-[8px] uppercase">Net Outstanding</span>
                <span className="font-mono font-bold text-rose-400 text-xs">₹{det.totalBalance.toLocaleString()}</span>
              </div>
            </div>

            {det.detailsList.length > 0 && (
              <div className="border-t border-slate-800 pt-2">
                <span className="text-slate-400 font-extrabold text-[8px] uppercase tracking-wider block mb-1">Segment Ledger Logs</span>
                <div className="space-y-1 max-h-[120px] overflow-y-auto pr-0.5">
                  {det.detailsList.map((seg, sIdx) => (
                    <div key={sIdx} className="bg-slate-800/50 rounded p-1.5 border border-slate-800 flex flex-col gap-0.5 text-[9px]">
                      <div className="flex justify-between font-bold text-slate-350">
                        <span className="truncate text-white font-semibold">{seg.office}</span>
                        <span className="font-mono text-slate-405 text-[8px]">{seg.date}</span>
                      </div>
                      <div className="flex justify-between font-mono text-[8px] text-slate-400 pt-0.5">
                        <span>Inc: ₹{seg.income}</span>
                        <span>Adv: ₹{seg.advance}</span>
                        <span className="text-rose-400 font-bold">Bal: ₹{seg.balance}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}
