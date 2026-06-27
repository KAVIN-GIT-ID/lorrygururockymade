import React, { useState, useRef } from 'react';

export interface SwipeableListHook {
  swipedId: string | null;
  setSwipedId: (id: string | null) => void;
  getTouchHandlers: (id: string) => {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  isSwiped: (id: string) => boolean;
  resetSwipe: () => void;
}

/**
 * Reusable hook to track right-to-left and left-to-right swipe actions on lists.
 * @param threshold Swipe pixel displacement threshold to trigger action state (default: 45)
 */
export function useSwipeableList(threshold = 45): SwipeableListHook {
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  const getTouchHandlers = (id: string) => ({
    onTouchStart: (e: React.TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const diff = e.touches[0].clientX - touchStartX.current;
      
      // Swipe left triggers swiped state
      if (diff < -threshold) {
        setSwipedId(id);
      }
      // Swipe right resets swiped state
      if (diff > threshold) {
        if (swipedId === id) {
          setSwipedId(null);
        }
      }
    },
    onTouchEnd: () => {
      touchStartX.current = null;
    }
  });

  const isSwiped = (id: string) => swipedId === id;
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
