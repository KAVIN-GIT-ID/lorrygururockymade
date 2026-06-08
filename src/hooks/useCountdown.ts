import { useState, useEffect, useRef } from 'react';

export function useCountdown(initialSeconds: number = 0) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const timerRef = useRef<any>(null);

  const start = (secs: number) => {
    setSeconds(secs);
  };

  const stop = () => {
    setSeconds(0);
  };

  useEffect(() => {
    if (seconds > 0) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [seconds]);

  return { seconds, start, stop };
}
