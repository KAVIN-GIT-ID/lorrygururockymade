import { createSignal, createEffect, onCleanup } from 'solid-js';

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
