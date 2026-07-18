import { createSignal, createEffect } from 'solid-js';

import { AlertCircle, WifiOff } from 'lucide-solid';

interface ConnectionStatusBlockerProps {
  reason?: 'offline' | 'realtime_lost';
}

export default function ConnectionStatusBlocker({ reason = 'offline' }: ConnectionStatusBlockerProps) {
  return (
    <div 
      class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none pointer-events-auto"
      style={{ cursor: 'not-allowed' }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-8 shadow-2xl animate-fade-in text-center space-y-6">
        <div class="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
          <WifiOff class="w-8 h-8 animate-pulse" />
        </div>
        
        <div class="space-y-2">
          <h3 class="text-xl font-bold text-white tracking-tight">Database Connection Interrupted</h3>
          <p class="text-slate-400 text-xs leading-relaxed font-medium">
            {reason === 'offline' 
              ? 'Your internet connection was lost. We have paused application access to prevent unsaved changes or data corruption.'
              : 'The real-time database synchronizer lost connection. Re-establishing secure handshake safely...'}
          </p>
        </div>

        <div class="flex items-center justify-center gap-3 py-3 px-4 bg-slate-950/40 rounded-xl border border-slate-800/60">
          <div class="w-4.5 h-4.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
          <span class="text-xs font-semibold text-emerald-400">Reconnecting to cloud master...</span>
        </div>
        
        <div class="text-[10px] text-slate-500 font-medium leading-normal">
          Writes are paused. Once internet connection returns, your workspace will instantly unlock automatically.
        </div>
      </div>
    </div>
  );
}
