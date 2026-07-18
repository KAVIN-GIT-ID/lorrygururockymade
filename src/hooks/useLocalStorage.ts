import { createSignal, createEffect, Accessor, Setter } from 'solid-js';
import { storageService } from '../services/storageService';

export function useLocalStorage<T>(key: string, initialValue: T): [Accessor<T>, Setter<T>] {
  const [state, setState] = createSignal<T>(storageService.get<T>(key, initialValue));

  createEffect(() => {
    storageService.set(key, state());
  });

  return [state, setState];
}
