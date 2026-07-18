import { onMount } from 'solid-js';

interface CapacitorListenersParams {
  registrySubTab: () => string;
  setRegistrySubTab: (tab: string) => void;
  mobileTab: () => string;
  setMobileTab: (tab: any) => void;
  profileModalOpen: () => boolean;
  setProfileModalOpen: (open: boolean) => void;
  setup2FAOpen: () => boolean;
  setSetup2FAOpen: (open: boolean) => void;
  disable2FAOpen: () => boolean;
  setDisable2FAOpen: (open: boolean) => void;
  confirmModal: () => any;
  setConfirmModal: (val: any) => void;
  showPhoneUpdateModal: () => boolean;
  setShowPhoneUpdateModal: (open: boolean) => void;
}

export function useCapacitorListeners({
  registrySubTab,
  setRegistrySubTab,
  mobileTab,
  setMobileTab,
  profileModalOpen,
  setProfileModalOpen,
  setup2FAOpen,
  setSetup2FAOpen,
  disable2FAOpen,
  setDisable2FAOpen,
  confirmModal,
  setConfirmModal,
  showPhoneUpdateModal,
  setShowPhoneUpdateModal
}: CapacitorListenersParams) {
  let touchStartXRef: number | null = null;
  let touchStartYRef: number | null = null;

  const handleTouchStart = (e: TouchEvent) => {
    touchStartXRef = e.touches[0].clientX;
    touchStartYRef = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartXRef === null || touchStartYRef === null) return;

    if (registrySubTab() === 'REPORTS' || registrySubTab() === 'OUTSTANDING') {
      touchStartXRef = null;
      touchStartYRef = null;
      return;
    }

    const diffX = e.changedTouches[0].clientX - touchStartXRef;
    const diffY = e.changedTouches[0].clientY - touchStartYRef;

    if (Math.abs(diffX) > 60 && Math.abs(diffY) < 40) {
      const tabs = ['TRUCKS', 'DRIVERS', 'EXPENSES', 'OUTSTANDING', 'REPORTS', 'TYRES', 'OFFICES', 'ACCOUNTS', 'AUDIT'];
      const currentIdx = tabs.indexOf(registrySubTab());
      if (diffX < 0) {
        if (currentIdx < tabs.length - 1) {
          setRegistrySubTab(tabs[currentIdx + 1]);
        }
      } else {
        if (currentIdx > 0) {
          setRegistrySubTab(tabs[currentIdx - 1]);
        }
      }
    }
    touchStartXRef = null;
    touchStartYRef = null;
  };

  onMount(() => {
    let backListener: any = null;

    const setupBackButton = async () => {
      try {
        const isCapacitor = typeof window !== 'undefined' && (window.location.protocol === 'capacitor:' || !!(window as any).Capacitor);
        if (!isCapacitor) return;

        const { App: CapApp } = await import('@capacitor/app');

        backListener = await CapApp.addListener('backButton', (data) => {
          const customEvent = new CustomEvent('app-back-press', {
            cancelable: true
          });
          window.dispatchEvent(customEvent);

          if (customEvent.defaultPrevented) return;

          if (mobileTab() !== 'HOME') {
            setMobileTab('HOME');
          } else if (data.canGoBack) {
            window.history.back();
          } else {
            CapApp.exitApp();
          }
        });
      } catch (err) {
        console.warn("Capacitor BackButton listener initialization failed:", err);
      }
    };

    setupBackButton();

    return () => {
      if (backListener && typeof backListener.remove === 'function') {
        backListener.remove();
      }
    };
  });

  onMount(() => {
    const handleBackPress = (e: Event) => {
      let closedSomething = false;
      if (profileModalOpen()) {
        setProfileModalOpen(false);
        closedSomething = true;
      }
      if (setup2FAOpen()) {
        setSetup2FAOpen(false);
        closedSomething = true;
      }
      if (disable2FAOpen()) {
        setDisable2FAOpen(false);
        closedSomething = true;
      }
      if (confirmModal()) {
        setConfirmModal(null);
        closedSomething = true;
      }
      if (showPhoneUpdateModal()) {
        setShowPhoneUpdateModal(false);
        closedSomething = true;
      }

      if (closedSomething) {
        e.preventDefault();
      }
    };
    window.addEventListener('app-back-press', handleBackPress);
    return () => {
      window.removeEventListener('app-back-press', handleBackPress);
    };
  });

  return {
    handleTouchStart,
    handleTouchEnd
  };
}
