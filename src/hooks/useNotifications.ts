import { createSignal, createEffect, onCleanup } from 'solid-js';
import { storageService } from '../services/storageService';

export function useNotifications(currentUserEmail?: () => string) {
  const [toastMessage, setToastMessage] = createSignal<string | null>(null);
  const [notificationOpen, setNotificationOpen] = createSignal(false);
  const [lastReadNotificationTime, setLastReadNotificationTime] = createSignal(0);
  let notificationRef: HTMLDivElement | undefined;
  let timeoutId: any = null;

  // Read notification time scoped by current user to prevent cross-account read marks
  createEffect(() => {
    const email = currentUserEmail ? currentUserEmail() : '';
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
    const email = currentUserEmail ? currentUserEmail() : '';
    if (email) {
      const key = `ttt_last_read_notifications_${email.toLowerCase().trim()}`;
      storageService.set(key, time.toString());
    }
    setLastReadNotificationTime(time);
  };

  return {
    get toastMessage() { return toastMessage(); },
    showNotification,
    get notificationOpen() { return notificationOpen(); },
    setNotificationOpen,
    get lastReadNotificationTime() { return lastReadNotificationTime(); },
    updateLastReadNotificationTime,
    get notificationRef() { return notificationRef; },
    setNotificationRef(el: HTMLDivElement) { notificationRef = el; }
  };
}
