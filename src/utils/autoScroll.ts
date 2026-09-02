// Global mouse wheel scroll redirection for horizontal overflow tables/containers

export function setupAutoScrollOnHover() {
  function findScrollContainer(target: EventTarget | null): HTMLElement | null {
    let el = target as HTMLElement | null;
    while (el && el !== document.body) {
      const computed = window.getComputedStyle(el);
      const isOverflowX =
        el.classList.contains('overflow-x-auto') ||
        computed.overflowX === 'auto' ||
        computed.overflowX === 'scroll';

      if (isOverflowX && el.scrollWidth > el.clientWidth + 5) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  document.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      // Only intercept vertical mouse wheel scrolling (deltaY)
      if (e.deltaY === 0) return;

      const container = findScrollContainer(e.target);
      if (!container) return;

      const canScrollLeft = container.scrollLeft > 0;
      const canScrollRight =
        container.scrollLeft < container.scrollWidth - container.clientWidth - 1;

      // If scrolling down and can scroll right, OR scrolling up and can scroll left
      if ((e.deltaY > 0 && canScrollRight) || (e.deltaY < 0 && canScrollLeft)) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    },
    { passive: false }
  );
}
