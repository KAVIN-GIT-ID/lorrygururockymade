const fs = require('fs');
const path = require('path');

const hooksDir = path.join(__dirname, '../src/hooks');

// useCountdown.ts
const countdownPath = path.join(hooksDir, 'useCountdown.ts');
if (fs.existsSync(countdownPath)) {
  fs.writeFileSync(countdownPath, `import { createSignal, createEffect, onCleanup } from 'solid-js';

export function useCountdown(initialSeconds: number = 0) {
  const [seconds, setSeconds] = createSignal(initialSeconds);
  let timer: any = null;

  const start = (secs: number) => {
    setSeconds(secs);
  };

  const stop = () => {
    setSeconds(0);
  };

  createEffect(() => {
    if (seconds() > 0) {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  });

  onCleanup(() => {
    if (timer) {
      clearInterval(timer);
    }
  });

  return {
    get seconds() { return seconds(); },
    start,
    stop
  };
}
`, 'utf8');
  console.log('Migrated useCountdown.ts');
}

// useNotifications.ts
const notificationsPath = path.join(hooksDir, 'useNotifications.ts');
if (fs.existsSync(notificationsPath)) {
  fs.writeFileSync(notificationsPath, `import { createSignal, createEffect, onCleanup } from 'solid-js';
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
      const key = \`ttt_last_read_notifications_\${email.toLowerCase().trim()}\`;
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
      const key = \`ttt_last_read_notifications_\${email.toLowerCase().trim()}\`;
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
`, 'utf8');
  console.log('Migrated useNotifications.ts');
}

// useSwipeableList.ts
const swipeablePath = path.join(hooksDir, 'useSwipeableList.ts');
if (fs.existsSync(swipeablePath)) {
  fs.writeFileSync(swipeablePath, `import { createSignal } from 'solid-js';

export interface SwipeableListHook {
  swipedId: () => string | null;
  setSwipedId: (id: string | null) => void;
  getTouchHandlers: (id: string) => {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: () => void;
  };
  isSwiped: (id: string) => boolean;
  resetSwipe: () => void;
}

export function useSwipeableList(threshold = 45): SwipeableListHook {
  const [swipedId, setSwipedId] = createSignal<string | null>(null);
  let touchStartX: number | null = null;

  const getTouchHandlers = (id: string) => ({
    onTouchStart: (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
    },
    onTouchMove: (e: TouchEvent) => {
      if (touchStartX === null) return;
      const diff = e.touches[0].clientX - touchStartX;
      
      if (diff < -threshold) {
        setSwipedId(id);
      }
      if (diff > threshold) {
        if (swipedId() === id) {
          setSwipedId(null);
        }
      }
    },
    onTouchEnd: () => {
      touchStartX = null;
    }
  });

  const isSwiped = (id: string) => swipedId() === id;
  const resetSwipe = () => setSwipedId(null);

  return {
    swipedId,
    setSwipedId,
    getTouchHandlers,
    isSwiped,
    resetSwipe
  };
}
export default useSwipeableList;
`, 'utf8');
  console.log('Migrated useSwipeableList.ts');
}
