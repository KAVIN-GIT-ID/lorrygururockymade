import { createSignal, createEffect } from 'solid-js';

import { Home, BookOpen, Layers, User } from 'lucide-solid';

interface MobileBottomTabBarProps {
  activeTab: 'HOME' | 'TRIPS' | 'REGISTRY' | 'ACCOUNT';
  setActiveTab: (tab: 'HOME' | 'TRIPS' | 'REGISTRY' | 'ACCOUNT') => void;
  clientUnreadCount: number;
}

export default function MobileBottomTabBar({
  activeTab,
  setActiveTab,
  clientUnreadCount
}: MobileBottomTabBarProps) {
  return (
    <div class="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe shadow-lg">
      <div class="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        <button
          onClick={() => setActiveTab('HOME')}
          class={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'HOME'
              ? 'text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-slate-400 hover:text-slate-600 dark:text-slate-500'
          }`}
        >
          <Home class="w-5 h-5" />
          <span class="text-[10px] mt-1 font-medium tracking-tight">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('TRIPS')}
          class={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'TRIPS'
              ? 'text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-slate-400 hover:text-slate-600 dark:text-slate-500'
          }`}
        >
          <BookOpen class="w-5 h-5" />
          <span class="text-[10px] mt-1 font-medium tracking-tight">Trips</span>
        </button>

        <button
          onClick={() => setActiveTab('REGISTRY')}
          class={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'REGISTRY'
              ? 'text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-slate-400 hover:text-slate-600 dark:text-slate-500'
          }`}
        >
          <Layers class="w-5 h-5" />
          <span class="text-[10px] mt-1 font-medium tracking-tight">Registry</span>
        </button>

        <button
          onClick={() => setActiveTab('ACCOUNT')}
          class={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            activeTab === 'ACCOUNT'
              ? 'text-blue-600 dark:text-blue-400 font-semibold'
              : 'text-slate-400 hover:text-slate-600 dark:text-slate-500'
          }`}
        >
          <User class="w-5 h-5" />
          <span class="text-[10px] mt-1 font-medium tracking-tight">Account</span>
          {clientUnreadCount > 0 && (
            <span class="absolute top-1.5 right-6 bg-rose-500 text-white rounded-full text-[8px] font-bold h-3.5 w-3.5 flex items-center justify-center animate-pulse">
              {clientUnreadCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
