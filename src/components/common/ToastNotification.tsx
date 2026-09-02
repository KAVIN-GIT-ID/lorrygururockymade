import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export interface ToastData {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
}

interface ToastNotificationProps {
  toast: ToastData | null;
  onClose: () => void;
  duration?: number;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  toast,
  onClose,
  duration = 4000
}) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onClose, duration]);

  if (!toast) return null;

  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';
  const isInfo = toast.type === 'info';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-in max-w-md ${
        isError
          ? 'bg-slate-900/95 border-rose-500/30 text-rose-200'
          : isWarning
          ? 'bg-slate-900/95 border-amber-500/30 text-amber-200'
          : isInfo
          ? 'bg-slate-900/95 border-sky-500/30 text-sky-200'
          : 'bg-slate-900/95 border-emerald-500/30 text-emerald-200'
      }`}
    >
      {isError ? (
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
      ) : isWarning ? (
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
      ) : isInfo ? (
        <Info className="w-5 h-5 text-sky-400 shrink-0" />
      ) : (
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
      )}
      <span className="text-xs font-semibold leading-snug flex-1">{toast.message}</span>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition cursor-pointer shrink-0"
        aria-label="Dismiss Notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
