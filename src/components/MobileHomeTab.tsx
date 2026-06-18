import React from 'react';
import { Truck, BookOpen, AlertCircle, Plus, FileText, Mic, Landmark } from 'lucide-react';
import { TripEntry, Truck as TruckType, Driver } from '../types';

interface MobileHomeTabProps {
  currentUser: any;
  orgTrips: TripEntry[];
  orgTrucks: TruckType[];
  orgDrivers: Driver[];
  setActiveTab: (tab: 'HOME' | 'TRIPS' | 'REGISTRY' | 'ACCOUNT') => void;
  onNavigateToSubTab: (tab: string) => void;
  onQuickAction: (action: 'ADD_TRIP' | 'ADD_EXPENSE' | 'VOICE') => void;
}

export default function MobileHomeTab({
  currentUser,
  orgTrips,
  orgTrucks,
  orgDrivers,
  setActiveTab,
  onNavigateToSubTab,
  onQuickAction
}: MobileHomeTabProps) {
  // Calculations
  const runningTrips = orgTrips.filter(t => t.status !== 'Settled');
  const activeTripsCount = runningTrips.length;
  const totalTrucks = orgTrucks.length;
  
  // Calculate total outstanding loans from drivers
  const totalOutstandingLoans = orgDrivers.reduce((acc, driver) => {
    const loans = Array.isArray((driver as any).loans) ? (driver as any).loans : [];
    const unpaidLoans = loans.filter(l => l.status !== 'Paid');
    const unpaidSum = unpaidLoans.reduce((sum, l) => sum + (Number(l.amount) - Number(l.repaid || 0)), 0);
    return acc + unpaidSum;
  }, 0);

  // Welcome user name
  const userName = currentUser?.name || currentUser?.email?.split('@')[0] || 'User';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 pb-20 select-none">
      {/* Header Panel */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Hi {userName}
          </h1>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
            Welcome to LorryGuru App
          </p>
        </div>
        <div className="flex items-center justify-center w-9 h-9 bg-blue-50 dark:bg-blue-955/20 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-900/30">
          <Truck className="w-5 h-5" />
        </div>
      </div>

      {/* Main Stats Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 dark:from-slate-900/70 dark:to-slate-950/70 text-white rounded-3xl p-5 shadow-xl border border-slate-800 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Active Fleet Performance
            </span>
            <span className="flex items-center gap-1.5 bg-green-500/15 text-green-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-green-500/20">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping"></span>
              Live Synced
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wide">RUNNING TRIPS</p>
              <p className="text-2xl font-black mt-0.5 text-blue-400">{activeTripsCount}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wide">FLEET SIZE</p>
              <p className="text-2xl font-black mt-0.5">{totalTrucks}</p>
            </div>
          </div>

          <div className="border-t border-slate-800/80 my-2"></div>

          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wide">TOTAL OUTSTANDING LOANS</p>
              <p className="text-lg font-black mt-0.5 text-amber-400">₹ {totalOutstandingLoans.toLocaleString('en-IN')}</p>
            </div>
            <button
              onClick={() => setActiveTab('TRIPS')}
              className="bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
            >
              View Journal
            </button>
          </div>
        </div>
      </div>

      {/* Explore Section / Shortcuts */}
      <div className="space-y-3">
        <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
          Quick Actions
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onQuickAction('ADD_TRIP')}
            className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow transition-all group"
          >
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-955/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-900/30 group-hover:scale-105 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 mt-2 text-center leading-tight">
              New Trip
            </span>
          </button>

          <button
            onClick={() => onQuickAction('ADD_EXPENSE')}
            className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow transition-all group"
          >
            <div className="w-10 h-10 bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center border border-rose-100 dark:border-rose-900/30 group-hover:scale-105 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-355 mt-2 text-center leading-tight">
              Add Expense
            </span>
          </button>

          <button
            onClick={() => onQuickAction('VOICE')}
            className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow transition-all group"
          >
            <div className="w-10 h-10 bg-purple-50 dark:bg-purple-955/20 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center border border-purple-100 dark:border-purple-900/30 group-hover:scale-105 transition-transform">
              <Mic className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-356 mt-2 text-center leading-tight">
              Voice Assistant
            </span>
          </button>
        </div>
      </div>

      {/* Registry Navigation Panel */}
      <div className="space-y-3">
        <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
          Registers
        </h2>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden shadow-sm">
          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('TRUCKS');
            }}
            className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-blue-500 bg-blue-50 dark:bg-blue-955/20 p-1.5 rounded-lg">
                <Truck className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Truck Registry</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{totalTrucks} Trucks</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('DRIVERS');
            }}
            className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-emerald-500 bg-emerald-50 dark:bg-emerald-955/20 p-1.5 rounded-lg">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Drivers Database</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{orgDrivers.length} Drivers</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('EXPENSES');
            }}
            className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-rose-500 bg-rose-50 dark:bg-rose-955/20 p-1.5 rounded-lg">
                <Landmark className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Expense Ledger</span>
            </div>
            <span className="text-blue-500 text-[10px] font-bold">Manage</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('REPORTS');
            }}
            className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-purple-500 bg-purple-50 dark:bg-purple-955/20 p-1.5 rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Monthly Reports</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">View PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
