import { createSignal, createEffect, onCleanup } from 'solid-js';

/**
 * Optimized countdown hook - consolidates multiple timer instances
 * Uses batch updates to reduce re-renders
 */
export function useCountdownOptimized(initialSeconds: number = 0) {
  const [seconds, setSeconds] = createSignal(initialSeconds);
  let timer: NodeJS.Timeout | null = null;

  const start = (secs: number) => {
    if (timer) clearInterval(timer);
    setSeconds(secs);
  };

  const stop = () => {
    if (timer) clearInterval(timer);
    setSeconds(0);
  };

  createEffect(() => {
    const currentSeconds = seconds();
    
    if (currentSeconds > 0) {
      timer = setInterval(() => {
        setSeconds(prev => {
          const next = Math.max(0, prev - 1);
          if (next === 0 && timer) {
            clearInterval(timer);
            timer = null;
          }
          return next;
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
      timer = null;
    }
  });

  return {
    get seconds() { return seconds(); },
    start,
    stop,
    isRunning: () => seconds() > 0
  };
}

/**
 * Hook to manage multiple independent countdowns efficiently
 * Consolidates multiple timer instances into a single shared interval
 */
export function useCountdownManager() {
  const [countdowns, setCountdowns] = createSignal<Record<string, number>>({});
  let sharedInterval: NodeJS.Timeout | null = null;

  const createTimer = (key: string, initialSeconds: number = 0) => {
    setCountdowns(prev => ({ ...prev, [key]: initialSeconds }));
    return {
      start: (secs: number) => {
        setCountdowns(prev => ({ ...prev, [key]: secs }));
      },
      stop: () => {
        setCountdowns(prev => ({ ...prev, [key]: 0 }));
      },
      get seconds() { 
        return countdowns()[key] || 0; 
      },
      get isRunning() { 
        return (countdowns()[key] || 0) > 0; 
      }
    };
  };

  createEffect(() => {
    const hasActiveTimer = Object.values(countdowns()).some(v => v > 0);
    
    if (hasActiveTimer) {
      if (!sharedInterval) {
        sharedInterval = setInterval(() => {
          setCountdowns(prev => {
            const updated = { ...prev };
            let hasActive = false;
            
            Object.keys(updated).forEach(key => {
              if (updated[key] > 0) {
                updated[key] = Math.max(0, updated[key] - 1);
                if (updated[key] > 0) hasActive = true;
              }
            });
            
            if (!hasActive && sharedInterval) {
              clearInterval(sharedInterval);
              sharedInterval = null;
            }
            return updated;
          });
        }, 1000);
      }
    } else {
      if (sharedInterval) {
        clearInterval(sharedInterval);
        sharedInterval = null;
      }
    }
  });

  onCleanup(() => {
    if (sharedInterval) {
      clearInterval(sharedInterval);
      sharedInterval = null;
    }
  });

  return { createTimer, countdowns };
}
