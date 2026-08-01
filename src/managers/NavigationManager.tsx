import { onMount, createContext, useContext, createSignal, createEffect, Accessor, Setter } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { useNavigationState } from '../hooks/useNavigationState';

type TabName = 'DASHBOARD' | 'TRIPS' | 'TRUCKS' | 'OFFICES' | 'ACCOUNTS' | 'DRIVERS' | 'EXPENSES' | 'REPORTS' | 'AUDIT' | 'TYRES' | 'USERS' | 'BACKEND' | 'BILLING';

const VALID_TABS: TabName[] = ['DASHBOARD', 'TRIPS', 'TRUCKS', 'OFFICES', 'ACCOUNTS', 'DRIVERS', 'EXPENSES', 'REPORTS', 'AUDIT', 'TYRES', 'USERS', 'BACKEND', 'BILLING'];

function parseTabFromPath(path: string): TabName | null {
  const cleanPath = (path || '').toLowerCase();
  if (cleanPath.startsWith('/console/')) {
    const seg = cleanPath.replace('/console/', '').split('/')[0].split('?')[0].toUpperCase();
    if (VALID_TABS.includes(seg as TabName)) {
      return seg as TabName;
    }
  }
  return null;
}

interface NavigationContextType {
  activeTab: () => TabName;
  setActiveTab: (tab: TabName) => void;
  isMobileMenuOpen: () => boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  selectTab: (tab: TabName) => void;
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
  const location = useLocation();

  const initialTab = parseTabFromPath(typeof window !== 'undefined' ? window.location.pathname : '') || 'DASHBOARD';
  const [activeTab, setActiveTab] = createSignal<TabName>(initialTab);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = createSignal(false);
  const [activeMonth, setActiveMonth] = createSignal(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [activeYear, setActiveYear] = createSignal(String(new Date().getFullYear()));

  // Keep activeTab in sync with browser location URL & update document head for SEO
  createEffect(() => {
    const tabFromUrl = parseTabFromPath(location.pathname);
    if (tabFromUrl && tabFromUrl !== activeTab()) {
      setActiveTab(tabFromUrl);
    }

    if (typeof document !== 'undefined') {
      const titles: Record<TabName, string> = {
        DASHBOARD: "Executive Fleet Dashboard | Lorry Guru",
        TRUCKS: "Truck Datasheet & Mechanical Ledger | Lorry Guru",
        TRIPS: "Truck Trip Ledger & Profitability Log | Lorry Guru",
        EXPENSES: "Fleet Expenses & Diesel Log | Lorry Guru",
        DRIVERS: "Driver Performance & Settlement Ledger | Lorry Guru",
        ACCOUNTS: "Bank Accounts & Cash Flow Ledger | Lorry Guru",
        OFFICES: "Branch Offices & Network Hubs | Lorry Guru",
        TYRES: "Tyre Inventory & Lifespan Tracker | Lorry Guru",
        REPORTS: "Financial Analytics & Operational Reports | Lorry Guru",
        AUDIT: "System Security & Compliance Audit Log | Lorry Guru",
        USERS: "Team Access & Permissions | Lorry Guru",
        BACKEND: "SuperAdmin Control Console | Lorry Guru",
        BILLING: "Subscription Billing & Licenses | Lorry Guru"
      };

      const currentTab = activeTab();
      if (titles[currentTab]) {
        document.title = titles[currentTab];
      }
    }
  });

  const navState = useNavigationState();

  const selectTab = (tab: TabName) => {
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
