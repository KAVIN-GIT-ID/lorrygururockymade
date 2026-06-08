import { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    return storageService.get<T>(key, initialValue);
  });

  useEffect(() => {
    storageService.set(key, state);
  }, [key, state]);

  return [state, setState];
}
