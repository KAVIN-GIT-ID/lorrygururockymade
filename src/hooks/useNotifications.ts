import { useState, useRef, useEffect } from 'react';
import { storageService } from '../services/storageService';

export function useNotifications(currentUserEmail?: string) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [lastReadNotificationTime, setLastReadNotificationTime] = useState(0);
  const notificationRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<any>(null);

  // Read notification time scoped by current user to prevent cross-account read marks
  useEffect(() => {
    if (currentUserEmail) {
      const key = `ttt_last_read_notifications_${currentUserEmail.toLowerCase().trim()}`;
      setLastReadNotificationTime(Number(storageService.get<string>(key, '0')));
    } else {
      setLastReadNotificationTime(0);
    }
  }, [currentUserEmail]);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const updateLastReadNotificationTime = (time: number) => {
    if (currentUserEmail) {
      const key = `ttt_last_read_notifications_${currentUserEmail.toLowerCase().trim()}`;
      storageService.set(key, time.toString());
    }
    setLastReadNotificationTime(time);
  };

  return {
    toastMessage,
    showNotification,
    notificationOpen,
    setNotificationOpen,
    lastReadNotificationTime,
    updateLastReadNotificationTime,
    notificationRef
  };
}
