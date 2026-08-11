import { createContext, useContext, createSignal, createEffect, onCleanup, JSX, For } from 'solid-js';
import { storageService } from '../services/storageService';
import { useAuth } from './AuthContext';
import { CheckCircle2, Info, AlertTriangle, Bell, X } from 'lucide-solid';

export type ToastType = 'default' | 'success' | 'info' | 'error' | 'warning';
export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center'
  | 'middle-right'
  | 'middle-left'
  | 'middle-center';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  removing?: boolean;
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
  toastPosition: () => ToastPosition;
  setToastPosition: (pos: ToastPosition) => void;
  notificationRef: () => HTMLDivElement | undefined;
  setNotificationRef: (el: HTMLDivElement) => void;
}

const NotificationContext = createContext<NotificationContextType>();

export function NotificationProvider(props: { children: JSX.Element }) {
  const { currentUser } = useAuth();
  const [toasts, setToasts] = createSignal<ToastItem[]>([]);
  const [notificationOpen, setNotificationOpen] = createSignal(false);
  const [lastReadNotificationTime, setLastReadNotificationTime] = createSignal(0);
  const [toastPosition, setToastPositionSignal] = createSignal<ToastPosition>('top-right');
  let notificationRef: HTMLDivElement | undefined;

  createEffect(() => {
    const user = currentUser();
    const email = user ? user.email : '';
    if (email) {
      const key = `ttt_last_read_notifications_${email.toLowerCase().trim()}`;
      setLastReadNotificationTime(Number(storageService.get<string>(key, '0')));

      const posKey = `ttt_toast_position_${email.toLowerCase().trim()}`;
      // Check both raw localStorage and storageService (JSON format) for backwards compatibility
      const rawPos = localStorage.getItem(posKey) || storageService.get<string>(posKey, 'top-right');
      const cleanPos = rawPos.replace(/"/g, '');
      if (['top-right', 'top-left', 'bottom-right', 'bottom-left', 'top-center', 'bottom-center', 'middle-right', 'middle-left', 'middle-center'].includes(cleanPos)) {
        setToastPositionSignal(cleanPos as ToastPosition);
      }
    } else {
      // Check global non-user key fallback
      const globalPos = localStorage.getItem('ttt_toast_position_global') || 'top-right';
      const cleanPos = globalPos.replace(/"/g, '');
      if (['top-right', 'top-left', 'bottom-right', 'bottom-left', 'top-center', 'bottom-center', 'middle-right', 'middle-left', 'middle-center'].includes(cleanPos)) {
        setToastPositionSignal(cleanPos as ToastPosition);
      } else {
        setToastPositionSignal('top-right');
      }
      setLastReadNotificationTime(0);
    }
  });

  const setToastPosition = (pos: ToastPosition) => {
    setToastPositionSignal(pos);
    const user = currentUser();
    const email = user ? user.email : '';
    if (email) {
      const posKey = `ttt_toast_position_${email.toLowerCase().trim()}`;
      localStorage.setItem(posKey, pos);
      storageService.set(posKey, pos);
    }
    localStorage.setItem('ttt_toast_position_global', pos);
  };

  const removeToast = (id: string) => {
    // Set removing flag to trigger smooth slide-out CSS animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 320);
  };

  const showNotification = (
    input: string | { title?: string; message: string; type?: ToastType; duration?: number },
    typeOverride?: ToastType
  ) => {
    console.log("[NotificationProvider] showNotification called with:", input);
    
    let type: ToastType = typeOverride || 'default';
    let title: string | undefined = undefined;
    let message = '';
    let duration = 4000;

    if (typeof input === 'string') {
      message = input;
      const lower = message.toLowerCase();
      if (!typeOverride || typeOverride === 'default') {
        if (lower.includes('failed') || lower.includes('error') || lower.includes('invalid') || lower.includes('cannot') || lower.includes('denied') || lower.includes('offline')) {
          type = 'error';
        } else if (lower.includes('success') || lower.includes('updated') || lower.includes('saved') || lower.includes('added') || lower.includes('created') || lower.includes('dispatched') || lower.includes('done') || lower.includes('approved')) {
          type = 'success';
        } else if (lower.includes('warning') || lower.includes('expire') || lower.includes('caution') || lower.includes('limit') || lower.includes('notice')) {
          type = 'warning';
        } else {
          type = 'info';
        }
      }
    } else if (input && typeof input === 'object') {
      title = input.title;
      message = input.message;
      if (input.type) type = input.type;
      if (input.duration) duration = input.duration;
    }

    if (!title || title === 'Notification' || title === 'Alert Title') {
      switch (type) {
        case 'success': title = 'Success!'; break;
        case 'info': title = 'Help!'; break;
        case 'error': title = 'Error!'; break;
        case 'warning': title = 'Warning!'; break;
        default: title = 'Success!'; break;
      }
    }

    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastItem = { id, type, title, message, duration };

    setToasts(prev => [newToast, ...prev].slice(0, 5));

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
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
    toastPosition: () => toastPosition(),
    setToastPosition,
    notificationRef: () => notificationRef,
    setNotificationRef: (el: HTMLDivElement) => { notificationRef = el; }
  };

  const isBottom = () => toastPosition().startsWith('bottom');

  // Stack placement styles & positioning based on corner/middle/center
  const stackPositionClasses = () => {
    switch (toastPosition()) {
      case 'top-left':
        return 'top-5 left-5 items-start';
      case 'bottom-right':
        return 'bottom-5 right-5 items-end';
      case 'bottom-left':
        return 'bottom-5 left-5 items-start';
      case 'top-center':
        return 'top-5 left-1/2 -translate-x-1/2 items-center';
      case 'bottom-center':
        return 'bottom-5 left-1/2 -translate-x-1/2 items-center';
      case 'middle-right':
        return 'top-1/2 -translate-y-1/2 right-5 items-end';
      case 'middle-left':
        return 'top-1/2 -translate-y-1/2 left-5 items-start';
      case 'middle-center':
        return 'top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 items-center';
      case 'top-right':
      default:
        return 'top-5 right-5 items-end';
    }
  };

  const getToastAnimClass = (toast: ToastItem, idx: number) => {
    const pos = toastPosition();
    if (toast.removing) {
      if (pos === 'top-center') return 'animate-slide-out-top';
      if (pos === 'bottom-center') return 'animate-slide-out-bottom';
      if (pos.endsWith('left')) return 'animate-slide-out-left';
      return 'animate-slide-out-right';
    }
    if (idx === 0) {
      if (pos === 'top-center') return 'animate-slide-in-top';
      if (pos === 'bottom-center') return 'animate-slide-in-bottom';
      if (pos.endsWith('left')) return 'animate-slide-in-left';
      return 'animate-slide-in-right';
    }
    return '';
  };

  const [isHovered, setIsHovered] = createSignal(false);

  return (
    <NotificationContext.Provider value={value}>
      {props.children}

      {/* SONNER-STYLE STACKED TOAST CONTAINER */}
      <div
        id="toast-notify-stack"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        class={`fixed z-[9999] flex flex-col w-auto min-w-[340px] max-w-md pointer-events-none px-4 md:px-0 transition-all duration-300 ${stackPositionClasses()}`}
      >
        <div class="relative w-auto flex flex-col gap-2">
          <For each={toasts()}>
            {(toast, index) => {
              const idx = () => index();
              // Compute stacked scale, offset, and opacity for Sonner depth effect
              const offset = () => (isHovered() ? idx() * 56 : idx() * 10);
              const scale = () => (isHovered() ? 1 : 1 - idx() * 0.04);
              const opacity = () => (toast.removing ? 0 : isHovered() ? 1 : idx() > 2 ? 0 : 1 - idx() * 0.15);
              const zIndex = () => 100 - idx();

              return (
                <div
                  style={{
                    transform: isHovered()
                      ? `translateY(0px)`
                      : isBottom()
                      ? `translateY(-${offset()}px) scale(${scale()})`
                      : `translateY(${offset()}px) scale(${scale()})`,
                    opacity: opacity(),
                    'z-index': zIndex(),
                    'transform-origin': isBottom() ? 'bottom center' : 'top center',
                    transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease'
                  }}
                  class={`pointer-events-auto relative w-full overflow-hidden bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/80 dark:border-slate-800 ${getToastAnimClass(
                    toast,
                    idx()
                  )} flex items-center min-h-[72px] p-4 pr-3.5`}
                >
                  {/* LEFT VERTICAL COLOR ACCENT PILL (32px HEIGHT) */}
                  <div
                    class={`w-1.5 h-8 shrink-0 self-center ml-0.5 rounded-full ${
                      toast.type === 'success'
                        ? 'bg-emerald-500'
                        : toast.type === 'info'
                        ? 'bg-blue-600'
                        : toast.type === 'error'
                        ? 'bg-rose-600'
                        : toast.type === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}
                  />

                  {/* MAIN BODY CONTENT */}
                  <div class="flex-1 px-3.5 flex flex-col justify-center min-w-0">
                    <h4
                      class={`text-sm font-bold leading-snug ${
                        toast.type === 'success'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : toast.type === 'info'
                          ? 'text-blue-600 dark:text-blue-400'
                          : toast.type === 'error'
                          ? 'text-rose-600 dark:text-rose-400'
                          : toast.type === 'warning'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {toast.title === 'Success' ? 'Success!' : toast.title === 'Notice' ? 'Help!' : toast.title === 'Warning' ? 'Warning!' : toast.title === 'Error' ? 'Error!' : toast.title}
                    </h4>
                    <p class="text-xs font-normal leading-normal text-slate-500 dark:text-slate-300 mt-0.5 break-words">
                      {toast.message}
                    </p>
                  </div>

                  {/* CLOSE BUTTON */}
                  <button
                    type="button"
                    onClick={() => removeToast(toast.id)}
                    class="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-white transition p-1 rounded-md cursor-pointer"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>
              );
            }}
          </For>
        </div>
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
