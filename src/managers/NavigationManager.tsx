import { onMount, createContext, useContext, createSignal, Accessor, Setter } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useNavigationState } from '../hooks/useNavigationState';

interface NavigationContextType {
  activeTab: () => 'DASHBOARD' | 'TRIPS' | 'TRUCKS' | 'OFFICES' | 'ACCOUNTS' | 'DRIVERS' | 'EXPENSES' | 'REPORTS' | 'AUDIT' | 'TYRES' | 'USERS' | 'BACKEND' | 'BILLING';
  setActiveTab: (tab: 'DASHBOARD' | 'TRIPS' | 'TRUCKS' | 'OFFICES' | 'ACCOUNTS' | 'DRIVERS' | 'EXPENSES' | 'REPORTS' | 'AUDIT' | 'TYRES' | 'USERS' | 'BACKEND' | 'BILLING') => void;
  isMobileMenuOpen: () => boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  selectTab: (tab: 'DASHBOARD' | 'TRIPS' | 'TRUCKS' | 'OFFICES' | 'ACCOUNTS' | 'DRIVERS' | 'EXPENSES' | 'REPORTS' | 'AUDIT' | 'TYRES' | 'USERS' | 'BACKEND' | 'BILLING') => void;
  activeMonth: () => string;
  setActiveMonth: (month: string) => void;
  activeYear: () => string;
  setActiveYear: (year: string) => void;
  isMobile: () => boolean;
  setIsMobile: Setter<boolean>;
  mobileTab: () => 'HOME' | 'TRIPS' | 'REGISTRY' | 'ACCOUNT';
  setMobileTab: Setter<'HOME' | 'TRIPS' | 'REGISTRY' | 'ACCOUNT'>;
  registrySubTab: () => string;
  setRegistrySubTab: Setter<string>;
  fabOpened: () => boolean;
  setFabOpened: Setter<boolean>;
  autoOpenFormTab: () => string | null;
  setAutoOpenFormTab: Setter<string | null>;
  triggerOpenAddForm: (tabId: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationManager(props: { children: any }) {
  onMount(() => {
    console.log("NavigationManager mounted");
  });
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<'DASHBOARD' | 'TRIPS' | 'TRUCKS' | 'OFFICES' | 'ACCOUNTS' | 'DRIVERS' | 'EXPENSES' | 'REPORTS' | 'AUDIT' | 'TYRES' | 'USERS' | 'BACKEND' | 'BILLING'>('DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = createSignal(false);
  const [activeMonth, setActiveMonth] = createSignal(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [activeYear, setActiveYear] = createSignal(String(new Date().getFullYear()));

  const navState = useNavigationState();

  const selectTab = (tab: 'DASHBOARD' | 'TRIPS' | 'TRUCKS' | 'OFFICES' | 'ACCOUNTS' | 'DRIVERS' | 'EXPENSES' | 'REPORTS' | 'AUDIT' | 'TYRES' | 'USERS' | 'BACKEND' | 'BILLING') => {
    setActiveTab(tab);
    navigate(`/console/${tab.toLowerCase()}`);
    setIsMobileMenuOpen(false);
  };

  const value: NavigationContextType = {
    activeTab,
    setActiveTab,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    selectTab,
    activeMonth,
    setActiveMonth,
    activeYear,
    setActiveYear,
    isMobile: navState.isMobile,
    setIsMobile: navState.setIsMobile,
    mobileTab: navState.mobileTab,
    setMobileTab: navState.setMobileTab,
    registrySubTab: navState.registrySubTab,
    setRegistrySubTab: navState.setRegistrySubTab,
    fabOpened: navState.fabOpened,
    setFabOpened: navState.setFabOpened,
    autoOpenFormTab: navState.autoOpenFormTab,
    setAutoOpenFormTab: navState.setAutoOpenFormTab,
    triggerOpenAddForm: navState.triggerOpenAddForm
  };

  return (
    <NavigationContext.Provider value={value}>
      {props.children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationManager');
  }
  return context;
}
