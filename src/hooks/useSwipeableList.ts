import { createSignal } from 'solid-js';

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
