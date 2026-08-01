import { createContext, useContext, createSignal, createEffect, onCleanup, JSX, For } from 'solid-js';
import { storageService } from '../services/storageService';
import { useAuth } from './AuthContext';
import { CheckCircle2, Info, AlertTriangle, Bell, X } from 'lucide-solid';

export type ToastType = 'default' | 'success' | 'info' | 'error' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  toastMessage: () => string;
  toasts: () => ToastItem[];
  showNotification: (msg: string | { title?: string; message: string; type?: ToastType; duration?: number }, type?: ToastType) => void;
  removeToast: (id: string) => void;
  notificationOpen: () => boolean;
  setNotificationOpen: (open: boolean) => void;
  lastReadNotificationTime: () => number;
  updateLastReadNotificationTime: (time: number) => void;
  notificationRef: () => HTMLDivElement | undefined;
  setNotificationRef: (el: HTMLDivElement) => void;
}

const NotificationContext = createContext<NotificationContextType>();

export function NotificationProvider(props: { children: JSX.Element }) {
  const { currentUser } = useAuth();
  const [toasts, setToasts] = createSignal<ToastItem[]>([]);
  const [notificationOpen, setNotificationOpen] = createSignal(false);
  const [lastReadNotificationTime, setLastReadNotificationTime] = createSignal(0);
  let notificationRef: HTMLDivElement | undefined;

  createEffect(() => {
    const user = currentUser();
    const email = user ? user.email : '';
    if (email) {
      const key = `ttt_last_read_notifications_${email.toLowerCase().trim()}`;
      setLastReadNotificationTime(Number(storageService.get<string>(key, '0')));
    } else {
      setLastReadNotificationTime(0);
    }
  });

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const showNotification = (
    input: string | { title?: string; message: string; type?: ToastType; duration?: number },
    typeOverride?: ToastType
  ) => {
    console.log("[NotificationProvider] showNotification called with:", input);
    
    let type: ToastType = typeOverride || 'default';
    let title: string | undefined = undefined;
    let message = '';
    let duration = 4500;

    if (typeof input === 'string') {
      message = input;
      // Smart infer type from text
      const lower = message.toLowerCase();
      if (!typeOverride) {
        if (lower.includes('failed') || lower.includes('error') || lower.includes('invalid') || lower.includes('cannot') || lower.includes('forbidden')) {
          type = 'error';
        } else if (lower.includes('success') || lower.includes('activated') || lower.includes('saved') || lower.includes('updated') || lower.includes('added') || lower.includes('approved')) {
          type = 'success';
        } else if (lower.includes('warning') || lower.includes('sure') || lower.includes('caution') || lower.includes('expir')) {
          type = 'warning';
        } else if (lower.includes('notice') || lower.includes('connecting') || lower.includes('info') || lower.includes('verifying')) {
          type = 'info';
        }
      }
    } else {
      title = input.title;
      message = input.message;
      type = input.type || typeOverride || 'default';
      duration = input.duration || 4500;
    }

    // Default title fallback based on type if omitted
    if (!title) {
      if (type === 'success') title = 'Success';
      else if (type === 'info') title = 'Info';
      else if (type === 'error') title = 'Error';
      else if (type === 'warning') title = 'Are you sure?';
      else title = 'Alert Title';
    }

    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newToast: ToastItem = { id, type, title, message, duration };

    setToasts(prev => [newToast, ...prev.slice(0, 4)]); // Keep max 5 visible

    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  createEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef && !notificationRef.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    onCleanup(() => {
      document.removeEventListener('mousedown', handleClickOutside);
    });
  });

  const updateLastReadNotificationTime = (time: number) => {
    const user = currentUser();
    const email = user ? user.email : '';
    if (email) {
      const key = `ttt_last_read_notifications_${email.toLowerCase().trim()}`;
      storageService.set(key, time.toString());
    }
    setLastReadNotificationTime(time);
  };

  const value: NotificationContextType = {
    toastMessage: () => toasts()[0]?.message || '',
    toasts,
    showNotification,
    removeToast,
    notificationOpen,
    setNotificationOpen,
    lastReadNotificationTime,
    updateLastReadNotificationTime,
    notificationRef: () => notificationRef,
    setNotificationRef: (el: HTMLDivElement) => { notificationRef = el; }
  };

  return (
    <NotificationContext.Provider value={value}>
      {props.children}

      {/* GLOBAL TOAST STACK CONTAINER */}
      <div id="toast-notify-stack" class="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 md:px-0">
        <For each={toasts()}>
          {(toast) => (
            <div
              class={`pointer-events-auto relative w-full p-4 rounded-2xl shadow-xl backdrop-blur-md border transition-all duration-300 transform translate-y-0 animate-fade-in flex items-start gap-3.5 ${
                toast.type === 'success'
                  ? 'bg-emerald-100/90 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                  : toast.type === 'info'
                  ? 'bg-sky-100/90 dark:bg-sky-950/80 border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-100'
                  : toast.type === 'error'
                  ? 'bg-rose-100/90 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                  : toast.type === 'warning'
                  ? 'bg-amber-100/90 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
                  : 'bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-slate-900/10'
              }`}
            >
              {/* ICON RENDERING */}
              <div class="shrink-0 mt-0.5">
                {toast.type === 'success' && <CheckCircle2 class="w-6 h-6 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />}
                {toast.type === 'info' && <Info class="w-6 h-6 text-sky-500 dark:text-sky-400 stroke-[2.5]" />}
                {toast.type === 'error' && <AlertTriangle class="w-6 h-6 text-rose-500 dark:text-rose-400 stroke-[2.5]" />}
                {toast.type === 'warning' && <Bell class="w-6 h-6 text-amber-600 dark:text-amber-400 stroke-[2.5]" />}
              </div>

              {/* TEXT CONTENT */}
              <div class="flex-1 min-w-0 pr-2">
                <h4
                  class={`text-sm font-bold leading-tight ${
                    toast.type === 'success'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : toast.type === 'info'
                      ? 'text-sky-600 dark:text-sky-300'
                      : toast.type === 'error'
                      ? 'text-rose-600 dark:text-rose-300'
                      : toast.type === 'warning'
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {toast.title}
                </h4>
                <p class="text-xs mt-1 font-medium leading-snug opacity-90 break-words">
                  {toast.message}
                </p>
              </div>

              {/* CLOSE BUTTON */}
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                class="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-white transition p-0.5 rounded-lg cursor-pointer"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          )}
        </For>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
