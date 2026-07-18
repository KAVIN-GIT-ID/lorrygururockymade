import { createSignal, onMount, onCleanup } from 'solid-js';

export function useNavigationState() {
  const [isMobile, setIsMobile] = createSignal(typeof window !== 'undefined' && window.innerWidth < 768);
  const [mobileTab, setMobileTab] = createSignal<'HOME' | 'TRIPS' | 'REGISTRY' | 'ACCOUNT'>('HOME');
  const [registrySubTab, setRegistrySubTab] = createSignal<string>('TRUCKS');
  const [fabOpened, setFabOpened] = createSignal(false);
  const [autoOpenFormTab, setAutoOpenFormTab] = createSignal<string | null>(null);

  const triggerOpenAddForm = (tabId: string) => {
    setRegistrySubTab(tabId);
    setAutoOpenFormTab(tabId);
    setFabOpened(false);

    setTimeout(() => {
      let btnId = '';
      let formQuery = '';
      if (tabId === 'TRUCKS') {
        btnId = 'btn-add-truck';
        formQuery = '#truck-form';
      } else if (tabId === 'DRIVERS') {
        btnId = 'btn-add-driver';
        formQuery = '#driver-form';
      } else if (tabId === 'EXPENSES') {
        btnId = 'btn-toggle-expense-form';
        formQuery = '#expense-registration-form';
      } else if (tabId === 'TYRES') {
        btnId = 'btn-add-tyre';
        formQuery = '#tyre-form';
      } else if (tabId === 'OFFICES') {
        btnId = 'btn-add-office';
        formQuery = '#office-form';
      } else if (tabId === 'ACCOUNTS') {
        btnId = 'btn-add-account';
        formQuery = '#account-form';
      }

      if (btnId) {
        const formExists = formQuery ? !!document.querySelector(formQuery) : false;
        if (!formExists) {
          const btn = document.getElementById(btnId);
          btn?.click();
        }
      }
    }, 200);
  };

  onMount(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    onCleanup(() => window.removeEventListener('resize', handleResize));
  });

  return {
    isMobile,
    setIsMobile,
    mobileTab,
    setMobileTab,
    registrySubTab,
    setRegistrySubTab,
    fabOpened,
    setFabOpened,
    autoOpenFormTab,
    setAutoOpenFormTab,
    triggerOpenAddForm
  };
}
