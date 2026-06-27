import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  BookOpen, 
  Plus, 
  FileText, 
  Mic, 
  Landmark, 
  MapPin, 
  Wrench, 
  ShieldCheck, 
  Users, 
  CreditCard, 
  ChevronRight,
  ArrowRight,
  Coins,
  Sparkles,
  Info
} from 'lucide-react';
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

  // Promo Banner State
  const [activeBanner, setActiveBanner] = useState(0);
  const banners = [
    {
      title: "Voice Assistant Active",
      subtitle: "Hands-free operations on Alt+V",
      desc: "Log journeys, expenses, and check logs using smart speech recognition.",
      badge: "Alt + V",
      gradient: "from-violet-600 via-indigo-600 to-blue-600"
    },
    {
      title: "Real-time Synchronization",
      subtitle: "Cloud fleet status online",
      desc: "Instant live backups synced across admin panels and driver registers.",
      badge: "Synced",
      gradient: "from-emerald-600 via-teal-600 to-cyan-600"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBanner(prev => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 pb-24 select-none bg-slate-50 dark:bg-slate-950">
      
      {/* Header Profile Panel */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-650 flex items-center justify-center text-white font-extrabold text-sm shadow-md">
            {userName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1">
              Hi {userName} <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
              LorryGuru Fleet Manager
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center w-8 h-8 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-full shadow-xs border border-slate-200/60 dark:border-slate-800/80">
          <Info className="w-4 h-4" />
        </div>
      </div>

      {/* Swipeable Promo Banner */}
      <div className="relative overflow-hidden rounded-3xl shadow-md cursor-pointer transition active:scale-[0.98]">
        <div className={`p-5 text-white bg-gradient-to-r ${banners[activeBanner].gradient} transition-all duration-700 ease-in-out relative min-h-[120px] flex flex-col justify-between`}>
          {/* Decorative background shapes */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="absolute -bottom-5 -left-5 w-24 h-24 bg-black/10 rounded-full blur-lg pointer-events-none"></div>

          <div className="flex justify-between items-start gap-4">
            <div>
              <span className="bg-white/20 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {banners[activeBanner].badge}
              </span>
              <h3 className="text-base font-black mt-1.5 leading-snug">
                {banners[activeBanner].title}
              </h3>
              <p className="text-[10px] text-white/80 font-semibold">
                {banners[activeBanner].subtitle}
              </p>
            </div>
            <div className="bg-white/10 p-2.5 rounded-2xl border border-white/10 shrink-0">
              <Mic className="w-5 h-5 text-white animate-bounce" />
            </div>
          </div>
          <p className="text-[9px] text-white/70 leading-relaxed mt-3 border-t border-white/10 pt-2 font-medium">
            {banners[activeBanner].desc}
          </p>
        </div>

        {/* Carousel Dots */}
        <div className="absolute bottom-2.5 right-4 flex gap-1">
          {banners.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                activeBanner === idx ? 'w-3 bg-white' : 'w-1 bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Quick Action Operations (circular icons row) */}
      <div className="space-y-3">
        <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Quick Operations
        </h2>
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-5 grid grid-cols-4 gap-2.5 shadow-xs">
          
          <button
            onClick={() => onQuickAction('ADD_TRIP')}
            className="flex flex-col items-center gap-2 group active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 hover:bg-indigo-500/20 transition duration-200">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-extrabold text-slate-700 dark:text-slate-300 text-center leading-tight">
              New Trip
            </span>
          </button>

          <button
            onClick={() => onQuickAction('ADD_EXPENSE')}
            className="flex flex-col items-center gap-2 group active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 hover:bg-emerald-500/20 transition duration-200">
              <Coins className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-extrabold text-slate-700 dark:text-slate-300 text-center leading-tight">
              Add Expense
            </span>
          </button>

          <button
            onClick={() => onQuickAction('VOICE')}
            className="flex flex-col items-center gap-2 group active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-violet-500/10 text-violet-605 dark:text-violet-400 flex items-center justify-center border border-violet-500/20 hover:bg-violet-500/20 transition duration-200">
              <Mic className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-extrabold text-slate-700 dark:text-slate-300 text-center leading-tight">
              Voice Admin
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('DRIVERS');
            }}
            className="flex flex-col items-center gap-2 group active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-650 dark:text-amber-450 flex items-center justify-center border border-amber-500/20 hover:bg-amber-500/20 transition duration-200">
              <Landmark className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-extrabold text-slate-700 dark:text-slate-300 text-center leading-tight">
              Active Loans
            </span>
          </button>

        </div>
      </div>

      {/* Fleet Registers Center (rounded square card grid) */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Fleet Masters
          </h2>
          <button
            onClick={() => setActiveTab('REGISTRY')}
            className="text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 hover:underline"
          >
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          
          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('TRUCKS');
            }}
            className="flex flex-col items-center p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs transition hover:shadow-sm active:scale-95 text-center group"
          >
            <div className="w-9 h-9 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/15 mb-2 group-hover:scale-105 transition-transform">
              <Truck className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-800 dark:text-slate-200 leading-tight">Trucks</span>
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-1">{totalTrucks} Active</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('DRIVERS');
            }}
            className="flex flex-col items-center p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs transition hover:shadow-sm active:scale-95 text-center group"
          >
            <div className="w-9 h-9 bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/15 mb-2 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-800 dark:text-slate-200 leading-tight">Drivers</span>
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-1">{orgDrivers.length} Mapped</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('OFFICES');
            }}
            className="flex flex-col items-center p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs transition hover:shadow-sm active:scale-95 text-center group"
          >
            <div className="w-9 h-9 bg-rose-500/10 text-rose-600 dark:text-rose-455 rounded-xl flex items-center justify-center border border-rose-500/15 mb-2 group-hover:scale-105 transition-transform">
              <MapPin className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-800 dark:text-slate-200 leading-tight">Offices</span>
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-1">Branches</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('TYRES');
            }}
            className="flex flex-col items-center p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs transition hover:shadow-sm active:scale-95 text-center group"
          >
            <div className="w-9 h-9 bg-amber-500/10 text-amber-600 dark:text-amber-450 rounded-xl flex items-center justify-center border border-amber-500/15 mb-2 group-hover:scale-105 transition-transform">
              <Wrench className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-800 dark:text-slate-200 leading-tight">Tyres</span>
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-1">Inventory</span>
          </button>

        </div>
      </div>

      {/* Financials & Ledger Audits (rounded square card grid) */}
      <div className="space-y-3">
        <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Financials & Logs
        </h2>
        <div className="grid grid-cols-4 gap-3">
          
          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('ACCOUNTS');
            }}
            className="flex flex-col items-center p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs transition hover:shadow-sm active:scale-95 text-center group"
          >
            <div className="w-9 h-9 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center border border-purple-500/15 mb-2 group-hover:scale-105 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-800 dark:text-slate-200 leading-tight">Ledgers</span>
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-1">Accounts</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('OUTSTANDING');
            }}
            className="flex flex-col items-center p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs transition hover:shadow-sm active:scale-95 text-center group"
          >
            <div className="w-9 h-9 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-xl flex items-center justify-center border border-cyan-500/15 mb-2 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-800 dark:text-slate-200 leading-tight">Outstanding</span>
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-1">Reporting</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('REPORTS');
            }}
            className="flex flex-col items-center p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs transition hover:shadow-sm active:scale-95 text-center group"
          >
            <div className="w-9 h-9 bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/15 mb-2 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-800 dark:text-slate-200 leading-tight">Monthly</span>
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-1">Reports</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('REGISTRY');
              onNavigateToSubTab('AUDIT');
            }}
            className="flex flex-col items-center p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs transition hover:shadow-sm active:scale-95 text-center group"
          >
            <div className="w-9 h-9 bg-slate-500/10 text-slate-600 dark:text-slate-400 rounded-xl flex items-center justify-center border border-slate-500/15 mb-2 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-800 dark:text-slate-200 leading-tight">Audits</span>
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-1">Security</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('ACCOUNT');
            }}
            className="flex flex-col items-center p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xs transition hover:shadow-sm active:scale-95 text-center group"
          >
            <div className="w-9 h-9 bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded-xl flex items-center justify-center border border-pink-500/15 mb-2 group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-800 dark:text-slate-200 leading-tight">Profile</span>
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-1">Settings</span>
          </button>

        </div>
      </div>

      {/* Outstanding Summary / Balance Banner */}
      <div className="bg-gradient-to-tr from-slate-900 to-indigo-950 dark:from-slate-900/60 dark:to-slate-950/60 text-white p-4 rounded-3xl border border-slate-800 flex justify-between items-center shadow-md">
        <div className="space-y-1">
          <span className="text-[9px] uppercase tracking-widest text-slate-400 font-extrabold">Driver Loans Summary</span>
          <p className="text-sm font-black text-amber-450">₹ {totalOutstandingLoans.toLocaleString('en-IN')}</p>
        </div>
        <button
          onClick={() => setActiveTab('TRIPS')}
          className="bg-white/10 hover:bg-white/15 border border-white/10 text-white text-[9px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 active:scale-95"
        >
          <span>View Journeys</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

    </div>
  );
}
