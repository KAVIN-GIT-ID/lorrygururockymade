import { createContext, useContext, createSignal, createEffect, onCleanup, JSX } from 'solid-js';
import { storageService } from '../services/storageService';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  toastMessage: () => string;
  showNotification: (msg: string) => void;
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
  const [toastMessage, setToastMessage] = createSignal<string | null>(null);
  const [notificationOpen, setNotificationOpen] = createSignal(false);
  const [lastReadNotificationTime, setLastReadNotificationTime] = createSignal(0);
  let notificationRef: HTMLDivElement | undefined;
  let timeoutId: any = null;

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

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
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
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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
    toastMessage: () => toastMessage() || '',
    showNotification,
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
