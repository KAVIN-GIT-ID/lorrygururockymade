import { createSignal, createEffect, onMount, onCleanup, Accessor, createMemo } from 'solid-js';

import {
  OrganizationProfile,
  Truck,
  TruckRequest,
  UserPermission,
  Driver,
  Office,
  Account,
  TripEntry,
  ExpenseEntry,
  Tyre,
  AuditLog,
  SupportTicket,
  TicketMessage,
  mutateRecord
} from '../types';
import { formatDate, parseLocalDate, formatToDisplayDate } from '../lib/dateUtils';
import { appwrite, isAppwriteConfigured, getAppOrigin } from '../lib/appwrite';
import {
  Building2,
  Truck as TruckIcon,
  UserCheck,
  ShieldAlert,
  Check,
  X as CloseIcon,
  Plus,
  Minus,
  MessageSquare,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  History,
  ToggleLeft,
  ToggleRight,
  Edit,
  Save,
  Database,
  Trash2,
  Code,
  AlertCircle,
  Paperclip,
  Send,
  FileText,
  Download,
  CheckCircle,
  Loader2,
  Lock,
  Unlock
} from 'lucide-solid';

const renderChangelog = (notes: string) => {
  if (!notes) return <p class="italic text-slate-400">No details provided.</p>;
  
  const lines = notes
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    return <p class="italic text-slate-400">No details provided.</p>;
  }

  const newItems: string[] = [];
  const changedItems: string[] = [];
  const fixedItems: string[] = [];
  const otherItems: string[] = [];

  lines.forEach(line => {
    let clean = line.replace(/^[\s\-*•+>]+/g, '').trim();
    if (!clean) return;

    const lower = clean.toLowerCase();
    let matched = false;
    
    const newTags = ['[new]', '[added]', '[feature]', 'new:', 'added:', 'feature:'];
    const changedTags = ['[changed]', '[removed]', '[updated]', '[improved]', 'changed:', 'removed:', 'updated:', 'improved:'];
    const fixedTags = ['[fixed]', '[bugfix]', '[fix]', 'fixed:', 'bugfix:', 'fix:'];

    for (const tag of newTags) {
      if (lower.startsWith(tag)) {
        clean = clean.slice(tag.length).trim();
        newItems.push(clean);
        matched = true;
        break;
      }
    }
    if (matched) return;

    for (const tag of changedTags) {
      if (lower.startsWith(tag)) {
        clean = clean.slice(tag.length).trim();
        changedItems.push(clean);
        matched = true;
        break;
      }
    }
    if (matched) return;

    for (const tag of fixedTags) {
      if (lower.startsWith(tag)) {
        clean = clean.slice(tag.length).trim();
        fixedItems.push(clean);
        matched = true;
        break;
      }
    }
    if (matched) return;

    // Fallback classification based on keywords
    if (lower.includes('fix') || lower.includes('bug') || lower.includes('issue') || lower.includes('error') || lower.includes('resolve')) {
      fixedItems.push(clean);
    } else if (lower.includes('change') || lower.includes('remove') || lower.includes('update') || lower.includes('improv') || lower.includes('replace') || lower.includes('delete') || lower.includes('refactor')) {
      changedItems.push(clean);
    } else if (lower.includes('add') || lower.includes('new') || lower.includes('create') || lower.includes('introduc')) {
      newItems.push(clean);
    } else {
      otherItems.push(clean);
    }
  });

  const renderSection = (title: string, items: string[], bulletColorClass: string, textColorClass: string) => {
    if (items.length === 0) return null;
    return (
      <div class="space-y-1 mt-2">
        <span class={`text-[9px] font-black uppercase tracking-widest ${textColorClass} block mb-1`}>{title}</span>
        <ul class="space-y-1.5 pl-0.5">
          {items.map((item, idx) => (
            <li  class="flex items-start gap-2.5">
              <span class={`w-1.5 h-1.5 rounded-full ${bulletColorClass} mt-1.5 shrink-0`} />
              <span class="text-slate-655 dark:text-slate-350 text-xs font-medium leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div class="space-y-3.5 mt-2">
      {renderSection("What's New", newItems, 'bg-emerald-500 dark:bg-emerald-400', 'text-emerald-600 dark:text-emerald-400')}
      {renderSection("Changes & Improvements", changedItems, 'bg-purple-500 dark:bg-purple-400', 'text-purple-650 dark:text-purple-400')}
      {renderSection("Bug Fixes", fixedItems, 'bg-amber-500 dark:bg-amber-400', 'text-amber-600 dark:text-amber-400')}
      {renderSection("Other Details", otherItems, 'bg-slate-500 dark:bg-slate-400', 'text-slate-550 dark:text-slate-455')}
    </div>
  );
};

interface BackendDashboardProps {
  organizationProfiles: Accessor<OrganizationProfile[]>;
  userRightsList: Accessor<UserPermission[]>;
  trucks: Accessor<Truck[]>;
  onUpdateOrgStatus: (orgId: string, status: 'Active' | 'Disabled') => void;
  onUpdateOrgLimit: (orgId: string, limit: number) => void;
  onApproveTruckRequest: (orgId: string, requestId: string, truckNo: string, duration?: '1M' | '3M' | '6M' | '1Y') => void;
  onRejectTruckRequest: (orgId: string, requestId: string, fallbackTruckNo?: string) => void;
  onUpdateTruckDetails: (orgId: string, truck: Truck) => void;
  logAction: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
  canEditBackend?: Accessor<boolean>;
  canApproveBackend?: Accessor<boolean>;
  canAddBackend?: Accessor<boolean>;
  canDeleteBackend?: Accessor<boolean>;
  canViewBackend?: Accessor<boolean>;
  canViewTruckRequests?: Accessor<boolean>;
  canViewDatabaseConsole?: Accessor<boolean>;
  canEditDatabaseConsole?: Accessor<boolean>;
  canDeleteDatabaseConsole?: Accessor<boolean>;

  // Props for raw JSON console
  drivers: Accessor<Driver[]>;
  offices: Accessor<Office[]>;
  accounts: Accessor<Account[]>;
  trips: Accessor<TripEntry[]>;
  expenses: Accessor<ExpenseEntry[]>;
  tyres: Accessor<Tyre[]>;
  auditLogs: Accessor<AuditLog[]>;

  onSaveTrucks: (newTrucks: Truck[]) => void;
  onSaveDrivers: (newDrivers: Driver[]) => void;
  onSaveOffices: (newOffices: Office[]) => void;
  onSaveAccounts: (newAccounts: Account[]) => void;
  onSaveTrips: (newTrips: TripEntry[]) => void;
  onSaveExpenses: (newExpenses: ExpenseEntry[]) => void;
  onSaveTyres: (newTyres: Tyre[]) => void;
  onSaveAuditLogs: (newLogs: AuditLog[]) => void;
  onSaveUserRightsList: (newList: UserPermission[]) => void;
  onSaveOrganizationProfiles: (nextProfiles: OrganizationProfile[]) => Promise<void>;
  supportTickets?: Accessor<SupportTicket[]>;
  onSaveSupportTickets?: (tickets: SupportTicket[]) => void;
  currentUser?: any;
  activeTicketId?: string | null;
  onSetActiveTicketId?: (id: string | null) => void;
  payments?: any[];
  onInitiateRefund?: (orgId: string, truckNo: string, paymentRecord: any) => Promise<void>;
  appUpdateConfig?: { version: string; releaseNotes: string; downloadUrl: string; updatedAt?: string } | null;
  onSaveAppUpdateConfig?: (config: any) => Promise<void>;
}

const SCHEMA_TEMPLATES = {
  trips: {
    tripNo: "TRIP-2026-XXXX",
    truckNo: "TN-XX-XX-XXXX",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
    organizationId: "org_default",
    driverName: "Driver Name",
    startingKM: 10000,
    endingKM: 11200,
    status: "Completed",
    notes: "",
    payments: [
      { id: "pay_1", amount: 5000, date: "2026-05-01", receivedBy: "acc_1", notes: "Booking advance" }
    ],
    subTrips: [
      {
        id: "sub_1",
        loadingDate: "2026-05-01",
        officeName: "Office Branch",
        routeFrom: "Source",
        routeTo: "Destination",
        income: 30000,
        loadingExpense: 500,
        unloadingExpense: 500,
        driverWages: 2500,
        startingKM: 10000,
        endingKM: 11200
      }
    ],
    fuels: []
  },
  trucks: {
    truckNo: "TN-XX-XX-XXXX",
    ownerName: "Owner Name",
    status: "Active",
    organizationId: "org_default",
    isApproved: true,
    make: "TATA",
    model: "2026",
    type: "10-Wheeler",
    registrationExpiryDate: "2027-05-01",
    insuranceDate: "2027-05-01",
    fcDate: "2027-05-01",
    pinpushKM: 10000,
    wheelGreaseKM: 20000,
    alignmentNextDate: "2026-08-01",
    qTaxDate: "2026-08-01",
    greenTaxDate: "2026-08-01",
    npTaxDate: "2026-08-01",
    fiveYearPermitDate: "2031-05-01",
    currentKM: 10000
  },
  drivers: {
    driverName: "Driver Name",
    phone: "9876543210",
    licenseNo: "DL-XXXXXXXXXXX",
    status: "Active",
    organizationId: "org_default"
  },
  offices: {
    officeName: "Office Name",
    city: "City",
    contactPerson: "Contact Person",
    phone: "9876543210",
    status: "Active",
    organizationId: "org_default"
  },
  accounts: {
    accountName: "Account Name",
    type: "Cash",
    holderName: "Holder Name",
    status: "Active",
    organizationId: "org_default"
  },
  expenses: {
    truckNo: "TN-XX-XX-XXXX",
    expenseType: "Maintenance",
    shopName: "TVS Workshop",
    amount: 1500,
    paymentMode: "acc_1",
    date: "2026-05-25",
    status: "Paid",
    accountType: "Account",
    organizationId: "org_default"
  },
  tyres: {
    tyreNo: "TY-XXXXXXX",
    manufacturer: "MRF",
    size: "10.00R20",
    status: "Available",
    organizationId: "org_default",
    accumulatedKM: 0,
    movementHistory: []
  },
  auditLogs: {
    timestamp: "2026-05-25 15:00:00",
    user: "admin@example.com",
    action: "Created",
    category: "Trip",
    reference: "TRIP-2026-XXXX",
    details: "Created record manually",
    organizationId: "org_default"
  },
  userRights: {
    email: "user@example.com",
    name: "User Name",
    role: "Admin",
    organizationId: "org_default",
    isApproved: true,
    canViewTrips: true,
    canEditTrips: true,
    canDeleteTrips: true,
    canViewTyres: true,
    canEditTyres: true,
    canDeleteTyres: true,
    canViewTrucks: true,
    canEditTrucks: true,
    canDeleteTrucks: true,
    canViewDrivers: true,
    canEditDrivers: true,
    canDeleteDrivers: true,
    canViewOffices: true,
    canEditOffices: true,
    canDeleteOffices: true,
    canViewAccounts: true,
    canEditAccounts: true,
    canDeleteAccounts: true,
    canViewExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: true
  },
  organizationProfiles: {
    organizationId: "org_default",
    organizationName: "Organization Name",
    ownerEmail: "owner@example.com",
    status: "Active",
    maxTrucksAllowed: 5,
    truckRequests: []
  }
};

export default function BackendDashboard(props: BackendDashboardProps) {
  const organizationProfiles = () => props.organizationProfiles();
  const userRightsList = () => props.userRightsList();
  const trucks = () => props.trucks();
  const drivers = () => props.drivers();
  const offices = () => props.offices();
  const accounts = () => props.accounts();
  const trips = () => props.trips();
  const expenses = () => props.expenses();
  const tyres = () => props.tyres();
  const auditLogs = () => props.auditLogs();
  const supportTickets = () => props.supportTickets ? props.supportTickets() : [];

  const canEditBackend = () => props.canEditBackend ? props.canEditBackend() : true;
  const canApproveBackend = () => props.canApproveBackend ? props.canApproveBackend() : true;
  const canAddBackend = () => props.canAddBackend ? props.canAddBackend() : true;
  const canDeleteBackend = () => props.canDeleteBackend ? props.canDeleteBackend() : true;
  const canViewBackend = () => props.canViewBackend ? props.canViewBackend() : true;
  const canViewTruckRequests = () => props.canViewTruckRequests ? props.canViewTruckRequests() : true;
  const canViewDatabaseConsole = () => props.canViewDatabaseConsole ? props.canViewDatabaseConsole() : true;
  const canEditDatabaseConsole = () => props.canEditDatabaseConsole ? props.canEditDatabaseConsole() : true;
  const canDeleteDatabaseConsole = () => props.canDeleteDatabaseConsole ? props.canDeleteDatabaseConsole() : true;

  const {
    onUpdateOrgStatus,
    onUpdateOrgLimit,
    onApproveTruckRequest,
    onRejectTruckRequest,
    onUpdateTruckDetails,
    logAction,
    onSaveTrucks,
    onSaveDrivers,
    onSaveOffices,
    onSaveAccounts,
    onSaveTrips,
    onSaveExpenses,
    onSaveTyres,
    onSaveAuditLogs,
    onSaveUserRightsList,
    onSaveOrganizationProfiles,
    onSaveSupportTickets,
    currentUser,
    activeTicketId,
    onSetActiveTicketId,
    payments = [],
    onInitiateRefund,
    appUpdateConfig = null,
    onSaveAppUpdateConfig
  } = props;

  const myRights = createMemo(() => userRightsList().find(u => u.email === currentUser?.email));
  const mySupportRoles = createMemo(() => {
    const rights = myRights();
    return Array.isArray(rights?.supportRole)
      ? rights.supportRole
      : (typeof rights?.supportRole === 'string' && rights.supportRole !== 'None' && rights.supportRole !== ''
        ? [rights.supportRole]
        : []);
  });
  const hasSupportRole = createMemo(() => mySupportRoles().length > 0);
  const myCanTransfer = createMemo(() => myRights()?.canTransferTickets || false);
  const isSuperAdmin = createMemo(() => myRights()?.role === 'SuperAdmin');

  const [activeSubTab, setActiveSubTab] = createSignal<'ORGANIZATIONS' | 'REQUESTS' | 'RAW_DATA' | 'TICKETS' | 'SYSTEM' | 'UPDATES'>((() => {
    if (canViewBackend() !== false) return 'ORGANIZATIONS';
    if (canViewTruckRequests() !== false) return 'REQUESTS';
    if (canViewDatabaseConsole() !== false) return 'RAW_DATA';
    if (isSuperAdmin() || (myRights()?.canViewTickets && hasSupportRole())) return 'TICKETS';
    return 'ORGANIZATIONS';
  })());

  createEffect(() => {
    const hasAccess = (tab: string) => {
      if (tab === 'ORGANIZATIONS') return !!canViewBackend();
      if (tab === 'REQUESTS') return !!canViewTruckRequests();
      if (tab === 'RAW_DATA') return !!canViewDatabaseConsole();
      if (tab === 'TICKETS') return !!(isSuperAdmin() || (myRights()?.canViewTickets && hasSupportRole()));
      if (tab === 'UPDATES') return isSuperAdmin();
      return false;
    };

    if (!hasAccess(activeSubTab())) {
      if (canViewBackend()) setActiveSubTab('ORGANIZATIONS');
      else if (canViewTruckRequests()) setActiveSubTab('REQUESTS');
      else if (canViewDatabaseConsole()) setActiveSubTab('RAW_DATA');
      else if (isSuperAdmin() || (myRights()?.canViewTickets && hasSupportRole())) setActiveSubTab('TICKETS');
    }
  });
  const [orgSearch, setOrgSearch] = createSignal('');
  const [requestSearch, setRequestSearch] = createSignal('');
  const [selectedOrgId, setSelectedOrgId] = createSignal<string | null>(null);
  const [editingTruck, setEditingTruck] = createSignal<Truck | null>(null);
  const [editingTruckOrgId, setEditingTruckOrgId] = createSignal<string | null>(null);
  const [renewalDuration, setRenewalDuration] = createSignal<'1M' | '3M' | '6M' | '1Y'>('1Y');
  const [rowDurations, setRowDurations] = createSignal<Record<string, '1M' | '3M' | '6M' | '1Y'>>({});

  // States for raw JSON console
  const [selectedCollection, setSelectedCollection] = createSignal<'trips' | 'trucks' | 'drivers' | 'offices' | 'accounts' | 'expenses' | 'tyres' | 'auditLogs' | 'userRights' | 'organizationProfiles'>('trips');
  const [consoleOrgFilter, setConsoleOrgFilter] = createSignal<string>('ALL');
  const [consoleSearchQuery, setConsoleSearchQuery] = createSignal<string>('');
  const [jsonEditorRecord, setJsonEditorRecord] = createSignal<any | null>(null);
  const [jsonEditorContent, setJsonEditorContent] = createSignal<string>('');
  const [jsonEditorIsValid, setJsonEditorIsValid] = createSignal<boolean>(true);
  const [jsonEditorError, setJsonEditorError] = createSignal<string | null>(null);
  const [isAddingNewRecord, setIsAddingNewRecord] = createSignal<boolean>(false);
  const [isDeploying, setIsDeploying] = createSignal<boolean>(false);

  // WhatsApp OTP Testing States
  const [testPhone, setTestPhone] = createSignal('');
  const [testOtpStatus, setTestOtpStatus] = createSignal<string | null>(null);
  const [isSendingTestOtp, setIsSendingTestOtp] = createSignal(false);

  const handleSendTestOtp = async () => {
    if (!testPhone()) {
      alert("Please enter a phone number");
      return;
    }
    setIsSendingTestOtp(true);
    setTestOtpStatus("Sending...");
    try {
      const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
      const cleanPhone = testPhone().replace(/[^0-9]/g, '');
      
      let gatewayHost = window.location.hostname;
      let gatewayProtocol = window.location.protocol;
      let useSubpath = false;

      const appwriteEndpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || '';
      if (appwriteEndpoint.includes('//')) {
        gatewayHost = appwriteEndpoint.split('//')[1].split('/')[0].split(':')[0];
        gatewayProtocol = appwriteEndpoint.split('//')[0];
        useSubpath = true;
      }

      const gatewayUrl = useSubpath
        ? `${gatewayProtocol}//${gatewayHost}/whatsapp-gateway/send-otp`
        : `${gatewayProtocol}//${gatewayHost}:8000/send-otp`;

      console.info(`[WhatsAppOTP-Test] Dispatching test code: ${mockCode} to ${cleanPhone} via ${gatewayUrl}`);

      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: 'ft_92hf83hdkw9812hskd',
          phone: cleanPhone,
          code: mockCode
        })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setTestOtpStatus(`Success! Test OTP code ${mockCode} sent successfully.`);
      } else {
        setTestOtpStatus(`Error: ${data.error || 'Failed to dispatch WhatsApp OTP.'}`);
      }
    } catch (err: any) {
      setTestOtpStatus(`Network Error: ${err.message || err}`);
    } finally {
      setIsSendingTestOtp(false);
    }
  };

  // Support Tickets States
  const [selectedTicketId, setSelectedTicketId] = createSignal<string | null>(null);
  const [chatInput, setChatInput] = createSignal('');
  const [chatFile, setChatFile] = createSignal<File | null>(null);
  const [isSending, setIsSending] = createSignal(false);
  const [resolvedUrls, setResolvedUrls] = createSignal<Record<string, string>>({});

  let chatEndRef: HTMLDivElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;

  const selectedTicket = createMemo(() => supportTickets().find((t) => t.id === selectedTicketId()));

  // Synchronize active ticket ID to parent component for silencing notifications
  createEffect(() => {
    if (onSetActiveTicketId) {
      onSetActiveTicketId(selectedTicketId());
    }
  });

  // Keep latest refs to prevent stale closure capturing
  let currentUserRef: any;
  createEffect(() => { currentUserRef = currentUser; });

  let supportTicketsRef: any;
  createEffect(() => { supportTicketsRef = supportTickets; });

  let onSaveSupportTicketsRef: any;
  createEffect(() => { onSaveSupportTicketsRef = onSaveSupportTickets; });

  let lockedTicketIdRef: string | null | undefined;

  // Release lock on unmount or ticket change
  createEffect(() => {
    return () => {
      if (lockedTicketIdRef && onSaveSupportTicketsRef) {
        const email = currentUserRef?.email || 'agent@support.com';
        const tickets = supportTicketsRef;
        const ticketId = lockedTicketIdRef;
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket && ticket.lockedByEmail === email) {
          const nextTickets = tickets.map(t => {
            if (t.id === ticketId) {
              const updated = {
                ...t,
                lockedByName: undefined,
                lockedByEmail: undefined,
                lockedByAt: undefined
              };
              return mutateRecord(t, updated, email);
            }
            return t;
          });
          onSaveSupportTicketsRef(nextTickets);
        }
        lockedTicketIdRef = null;
      }
    };
  });

  const handleFocusInput = () => {
    const email = currentUser?.email || 'agent@support.com';
    const name = currentUser?.name || currentUser?.email || 'Support Agent';
    if (selectedTicketId() && onSaveSupportTickets) {
      const ticket = supportTickets().find(t => t.id === selectedTicketId());
      if (ticket && (!ticket.lockedByEmail || ticket.lockedByEmail === email)) {
        lockedTicketIdRef = selectedTicketId();
        const nextTickets = supportTickets().map(t => {
          if (t.id === selectedTicketId()) {
            const updated = {
              ...t,
              lockedByName: name,
              lockedByEmail: email,
              lockedByAt: new Date().toISOString()
            };
            return mutateRecord(t, updated, email);
          }
          return t;
        });
        onSaveSupportTickets(nextTickets);
      }
    }
  };

  const handleBlurInput = () => {
    const email = currentUser?.email || 'agent@support.com';
    if (selectedTicketId() && onSaveSupportTickets) {
      const ticket = supportTickets().find(t => t.id === selectedTicketId());
      if (ticket && ticket.lockedByEmail === email) {
        lockedTicketIdRef = null;
        const nextTickets = supportTickets().map(t => {
          if (t.id === selectedTicketId()) {
            const updated = {
              ...t,
              lockedByName: undefined,
              lockedByEmail: undefined,
              lockedByAt: undefined
            };
            return mutateRecord(t, updated, email);
          }
          return t;
        });
        onSaveSupportTickets(nextTickets);
      }
    }
  };

  // Release lock on tab/window close
  createEffect(() => {
    const handleBeforeUnload = () => {
      const email = currentUserRef?.email || 'agent@support.com';
      if (selectedTicketId() && onSaveSupportTicketsRef) {
        const tickets = supportTicketsRef;
        const ticket = tickets.find(t => t.id === selectedTicketId());
        if (ticket && ticket.lockedByEmail === email) {
          const nextTickets = tickets.map(t => {
            if (t.id === selectedTicketId()) {
              const updated = {
                ...t,
                lockedByName: undefined,
                lockedByEmail: undefined,
                lockedByAt: undefined
              };
              return mutateRecord(t, updated, email);
            }
            return t;
          });
          onSaveSupportTicketsRef(nextTickets);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  const handleForceUnlock = (ticketId: string) => {
    if (!onSaveSupportTickets) return;
    const email = currentUser?.email || 'agent@support.com';
    const nextTickets = supportTickets().map(t => {
      if (t.id === ticketId) {
        const updated = {
          ...t,
          lockedByName: undefined,
          lockedByEmail: undefined,
          lockedByAt: undefined
        };
        return mutateRecord(t, updated, email);
      }
      return t;
    });
    onSaveSupportTickets(nextTickets);
    logAction('Edited', 'SupportTicket', ticketId, `Force unlocked support ticket`);
  };

  // Mark selected ticket as read for the agent
  createEffect(() => {
    const ticket = selectedTicket();
    if (ticket) {
      const msgs = ticket.messages || [];
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        localStorage.setItem(`ttt_tkt_agent_read_${ticket.id}`, lastMsg.id);
      } else {
        localStorage.setItem(`ttt_tkt_agent_read_${ticket.id}`, 'read');
      }
    }
  });

  const getAgentUnreadInfo = (t: SupportTicket) => {
    if (t.status === 'Closed') return { count: 0, hasUnread: false };
    const msgs = t.messages || [];
    const lastReadMsgId = localStorage.getItem(`ttt_tkt_agent_read_${t.id}`);
    
    if (msgs.length === 0) {
      const hasUnread = !lastReadMsgId;
      return { count: hasUnread ? 1 : 0, hasUnread };
    }
    
    if (!lastReadMsgId) {
      const userMsgs = msgs.filter(m => m.sender === 'User');
      const count = userMsgs.length || 1;
      return { count, hasUnread: true };
    }
    
    if (lastReadMsgId === 'read') {
      const userMsgs = msgs.filter(m => m.sender === 'User');
      return { count: userMsgs.length, hasUnread: userMsgs.length > 0 };
    }
    
    const lastReadIndex = msgs.findIndex(m => m.id === lastReadMsgId);
    const unreadUserMsgs = msgs.slice(lastReadIndex + 1).filter(m => m.sender === 'User');
    return { count: unreadUserMsgs.length, hasUnread: unreadUserMsgs.length > 0 };
  };

  const getAgentUnreadTicketsCount = () => {
    if (!isSuperAdmin() && !myRights()?.canViewTickets) return 0;
    const filtered = supportTickets().filter(t => {
      if (isSuperAdmin()) return true;
      return mySupportRoles().includes(t.assignedTeam as any);
    });
    
    let totalUnread = 0;
    filtered.forEach(t => {
      if (t.status === 'Closed') return;
      const msgs = t.messages || [];
      const lastReadMsgId = localStorage.getItem(`ttt_tkt_agent_read_${t.id}`);
      
      if (msgs.length === 0) {
        if (!lastReadMsgId) totalUnread++;
      } else {
        if (!lastReadMsgId) {
          const userMsgsCount = msgs.filter(m => m.sender === 'User').length;
          if (userMsgsCount > 0 || msgs.length > 0) totalUnread++;
        } else if (lastReadMsgId === 'read') {
          const userMsgsCount = msgs.filter(m => m.sender === 'User').length;
          if (userMsgsCount > 0) totalUnread++;
        } else {
          const lastReadIndex = msgs.findIndex(m => m.id === lastReadMsgId);
          const unreadCount = msgs.slice(lastReadIndex + 1).filter(m => m.sender === 'User').length;
          if (unreadCount > 0) totalUnread++;
        }
      }
    });
    return totalUnread;
  };

  // Scroll to bottom of chat when messages change
  createEffect(() => {
    chatEndRef?.scrollIntoView({ behavior: 'smooth' });
  });

  // Pre-resolve file URLs for attachments in the current ticket
  createEffect(() => {
    if (!selectedTicket()) return;
    const newUrls = { ...resolvedUrls() };
    let changed = false;
    const messages = Array.isArray(selectedTicket()?.messages) ? selectedTicket()!.messages : [];
    for (const msg of messages) {
      if (msg.attachmentUrl && !newUrls[msg.id]) {
        const isFileId = !msg.attachmentUrl.startsWith('http');
        if (isFileId && isAppwriteConfigured()) {
          const url = appwrite.getTicketFileView(msg.attachmentUrl);
          if (url) { newUrls[msg.id] = url; changed = true; }
        } else if (msg.attachmentUrl) {
          newUrls[msg.id] = msg.attachmentUrl;
          changed = true;
        }
      }
    }
    if (changed) setResolvedUrls(newUrls);
  });

  const handleTransferTicket = (ticketId: string, newTeam: 'Technical' | 'Billing' | 'General') => {
    if (!onSaveSupportTickets) return;
    const ticket = supportTickets().find(t => t.id === ticketId);
    if (!ticket) return;

    const oldTeam = ticket.assignedTeam;
    if (oldTeam === newTeam) return;

    const agentName = currentUser?.name || currentUser?.email || 'Support Agent';
    const agentEmail = currentUser?.email || 'agent@support.com';
    const systemMessage: TicketMessage = {
      id: `msg-sys-${Date.now()}`,
      sender: 'Agent',
      senderName: 'System Notification',
      senderEmail: 'system@ttt.com',
      content: `⚠️ Ticket transferred to the ${newTeam} team (previously handled by the ${oldTeam} team) by ${agentName}.`,
      timestamp: new Date().toISOString()
    };

    const nextTickets = supportTickets().map(t => {
      if (t.id === ticketId) {
        const updated = {
          ...t,
          assignedTeam: newTeam,
          messages: [...(t.messages || []), systemMessage]
        };
        return mutateRecord(t, updated, agentEmail);
      }
      return t;
    });
    onSaveSupportTickets(nextTickets);
    logAction('Edited', 'SupportTicket', ticketId, `Transferred ticket to ${newTeam} team`);
  };

  const handleDeleteTicket = (ticketId: string) => {
    if (!onSaveSupportTickets) return;
    if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) return;
    const nextTickets = supportTickets().filter(t => t.id !== ticketId);
    onSaveSupportTickets(nextTickets);
    setSelectedTicketId(null);
    logAction('Deleted', 'SupportTicket', ticketId, `Deleted support ticket`);
  };

  const handleUpdateTicketStatus = (ticketId: string, newStatus: 'Open' | 'In Progress' | 'Closed') => {
    if (!onSaveSupportTickets) return;
    const agentEmail = currentUser?.email || 'agent@support.com';
    const nextTickets = supportTickets().map(t => {
      if (t.id === ticketId) {
        const updated = {
          ...t,
          status: newStatus
        };
        return mutateRecord(t, updated, agentEmail);
      }
      return t;
    });
    onSaveSupportTickets(nextTickets);
    logAction('Edited', 'SupportTicket', ticketId, `Updated status to ${newStatus}`);
  };

  const handleSendChat = async (e: Event) => {
    e.preventDefault();
    if (!selectedTicketId() || (!chatInput().trim() && !chatFile()) || !onSaveSupportTickets) return;

    setIsSending(true);
    try {
      let attachmentUrl = '';
      let attachmentName = '';
      if (chatFile()) {
        if (isAppwriteConfigured()) {
          const customName = `ticket_attach_${selectedTicketId()}_${Date.now()}`;
          attachmentUrl = await appwrite.uploadTicketFile(chatFile(), customName);
          attachmentName = chatFile().name;
        } else {
          attachmentUrl = 'mock-url-configured';
          attachmentName = chatFile().name;
        }
      }

      const newMessage = {
        id: `msg-${Date.now()}`,
        sender: 'Agent' as const,
        senderName: currentUser?.name || currentUser?.email || 'Support Agent',
        senderEmail: currentUser?.email || 'agent@support.com',
        content: chatInput(),
        timestamp: new Date().toISOString(),
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
      };

      const nextTickets = supportTickets().map(t => {
        if (t.id === selectedTicketId()) {
          const updated = {
            ...t,
            status: t.status === 'Open' ? ('In Progress' as const) : t.status,
            messages: [...(t.messages || []), newMessage],
          };
          return mutateRecord(t, updated, currentUser?.email || 'agent');
        }
        return t;
      });

      await onSaveSupportTickets(nextTickets);
      setChatInput('');
      setChatFile(null);
      if (fileInputRef) fileInputRef.value = '';
    } catch (err) {
      alert('Failed to send support reply message.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredTickets = createMemo(() => supportTickets().filter(t => {
    if (isSuperAdmin()) return true;
    if (!myRights()?.canViewTickets) return false;
    return mySupportRoles().includes(t.assignedTeam as any);
  }));

  const handleJsonChange = (val: string) => {
    setJsonEditorContent(val);
    if (!val.trim()) {
      setJsonEditorIsValid(false);
      setJsonEditorError('JSON content cannot be empty.');
      return;
    }
    try {
      JSON.parse(val);
      setJsonEditorIsValid(true);
      setJsonEditorError(null);
    } catch (e: any) {
      setJsonEditorIsValid(false);
      setJsonEditorError(e.message || 'Malformed JSON syntax.');
    }
  };

  const getRecordLabel = (item: any): string => {
    if (selectedCollection() === 'trips') return `${item.tripNo || 'No Trip No'} (${item.truckNo || 'No Truck No'}) - ${item.driverName || 'No Driver'}`;
    if (selectedCollection() === 'trucks') return `${item.truckNo || 'No Truck No'} - ${item.ownerName || 'No Owner'}`;
    if (selectedCollection() === 'drivers') return item.driverName || 'No Name';
    if (selectedCollection() === 'offices') return `${item.officeName || 'No Name'} (${item.city || 'No City'})`;
    if (selectedCollection() === 'accounts') return `${item.accountName || 'No Name'} (${item.type || 'No Type'})`;
    if (selectedCollection() === 'expenses') return `${item.expenseType || 'No Type'} - ₹${item.amount || 0} (${item.truckNo || 'No Truck'})`;
    if (selectedCollection() === 'tyres') return `${item.tyreNo || 'No Serial'} (${item.manufacturer || 'No Manufacturer'}) - ${item.status || 'No Status'}`;
    if (selectedCollection() === 'auditLogs') return `[${item.timestamp || 'No Timestamp'}] ${item.user || 'System'} - ${item.action || 'Action'} ${item.category || ''} (${item.reference || ''})`;
    if (selectedCollection() === 'userRights') return `${item.name || 'No Name'} (${item.email || 'No Email'}) [${item.role || 'No Role'}]`;
    if (selectedCollection() === 'organizationProfiles') return `${item.organizationName || 'No Name'} (${item.ownerEmail || 'No Owner'})`;
    return 'No descriptive label';
  };

  const handleEditConsoleRecord = (record: any) => {
    setIsAddingNewRecord(false);
    setJsonEditorRecord(record);
    const content = JSON.stringify(record, null, 2);
    setJsonEditorContent(content);
    setJsonEditorIsValid(true);
    setJsonEditorError(null);
  };

  const handleAddConsoleRecordClick = () => {
    setIsAddingNewRecord(true);
    const template = { ...SCHEMA_TEMPLATES[selectedCollection()] };
    if (consoleOrgFilter() !== 'ALL' && 'organizationId' in template) {
      (template as any).organizationId = consoleOrgFilter();
    }
    setJsonEditorRecord(template);
    const content = JSON.stringify(template, null, 2);
    setJsonEditorContent(content);
    setJsonEditorIsValid(true);
    setJsonEditorError(null);
  };

  const handleSaveConsoleRecord = async () => {
    if (isAddingNewRecord() && !canEditDatabaseConsole()) {
      alert("Permission Denied: You do not have permissions to add records.");
      return;
    }
    if (!isAddingNewRecord() && !canEditDatabaseConsole()) {
      alert("Permission Denied: You do not have permissions to edit records.");
      return;
    }
    if (!jsonEditorIsValid()) return;
    try {
      const parsedRecord = JSON.parse(jsonEditorContent());

      if (isAddingNewRecord()) {
        if (!parsedRecord.id && selectedCollection() !== 'organizationProfiles') {
          const prefix = {
            trips: 'trip_',
            trucks: 'tr_',
            drivers: 'dr_',
            offices: 'of_',
            accounts: 'acc_',
            expenses: 'exp_',
            tyres: 'ty_',
            auditLogs: 'log_',
            userRights: 'ur_'
          }[selectedCollection()] || 'id_';
          parsedRecord.id = prefix + Date.now();
        }

        if (selectedCollection() === 'trips') onSaveTrips([parsedRecord, ...trips()]);
        else if (selectedCollection() === 'trucks') onSaveTrucks([parsedRecord, ...trucks()]);
        else if (selectedCollection() === 'drivers') onSaveDrivers([parsedRecord, ...drivers()]);
        else if (selectedCollection() === 'offices') onSaveOffices([parsedRecord, ...offices()]);
        else if (selectedCollection() === 'accounts') onSaveAccounts([parsedRecord, ...accounts()]);
        else if (selectedCollection() === 'expenses') onSaveExpenses([parsedRecord, ...expenses()]);
        else if (selectedCollection() === 'tyres') onSaveTyres([parsedRecord, ...tyres()]);
        else if (selectedCollection() === 'auditLogs') onSaveAuditLogs([parsedRecord, ...auditLogs()]);
        else if (selectedCollection() === 'userRights') onSaveUserRightsList([parsedRecord, ...userRightsList()]);
        else if (selectedCollection() === 'organizationProfiles') await onSaveOrganizationProfiles([parsedRecord, ...organizationProfiles()]);

        logAction('Created', selectedCollection(), parsedRecord.id || parsedRecord.organizationId, `Super Admin created raw JSON record`);
      } else {
        const recordId = parsedRecord.id || parsedRecord.organizationId;

        if (selectedCollection() === 'trips') {
          onSaveTrips(trips().map(t => t.id === recordId ? parsedRecord : t));
        } else if (selectedCollection() === 'trucks') {
          onSaveTrucks(trucks().map(t => t.id === recordId ? parsedRecord : t));
        } else if (selectedCollection() === 'drivers') {
          onSaveDrivers(drivers().map(d => d.id === recordId ? parsedRecord : d));
        } else if (selectedCollection() === 'offices') {
          onSaveOffices(offices().map(o => o.id === recordId ? parsedRecord : o));
        } else if (selectedCollection() === 'accounts') {
          onSaveAccounts(accounts().map(a => a.id === recordId ? parsedRecord : a));
        } else if (selectedCollection() === 'expenses') {
          onSaveExpenses(expenses().map(e => e.id === recordId ? parsedRecord : e));
        } else if (selectedCollection() === 'tyres') {
          onSaveTyres(tyres().map(ty => ty.id === recordId ? parsedRecord : ty));
        } else if (selectedCollection() === 'auditLogs') {
          onSaveAuditLogs(auditLogs().map(log => log.id === recordId ? parsedRecord : log));
        } else if (selectedCollection() === 'userRights') {
          onSaveUserRightsList(userRightsList().map(rights => rights.id === recordId ? parsedRecord : rights));
        } else if (selectedCollection() === 'organizationProfiles') {
          await onSaveOrganizationProfiles(organizationProfiles().map(p => p.organizationId === recordId ? parsedRecord : p));
        }

        logAction('Edited', selectedCollection(), recordId, `Super Admin modified raw JSON record`);
      }

      setJsonEditorRecord(null);
    } catch (e: any) {
      alert(`Error saving record: ${e.message}`);
    }
  };

  const handleDeleteConsoleRecord = async (recordToDelete: any) => {
    if (!canDeleteDatabaseConsole()) {
      alert("Permission Denied: You do not have permissions to delete records.");
      return;
    }
    const recordId = recordToDelete.id || recordToDelete.organizationId;
    const label = getRecordLabel(recordToDelete);

    if (!confirm(`Are you absolutely sure you want to delete this record?\n\nCollection: ${selectedCollection()}\nIdentifier: ${label}\n\nWarning: This action cannot be undone.`)) {
      return;
    }

    try {
      if (selectedCollection() === 'trips') {
        onSaveTrips(trips().filter(t => t.id !== recordId));
      } else if (selectedCollection() === 'trucks') {
        onSaveTrucks(trucks().filter(t => t.id !== recordId));
      } else if (selectedCollection() === 'drivers') {
        onSaveDrivers(drivers().filter(d => d.id !== recordId));
      } else if (selectedCollection() === 'offices') {
        onSaveOffices(offices().filter(o => o.id !== recordId));
      } else if (selectedCollection() === 'accounts') {
        onSaveAccounts(accounts().filter(a => a.id !== recordId));
      } else if (selectedCollection() === 'expenses') {
        onSaveExpenses(expenses().filter(e => e.id !== recordId));
      } else if (selectedCollection() === 'tyres') {
        onSaveTyres(tyres().filter(ty => ty.id !== recordId));
      } else if (selectedCollection() === 'auditLogs') {
        onSaveAuditLogs(auditLogs().filter(log => log.id !== recordId));
      } else if (selectedCollection() === 'userRights') {
        onSaveUserRightsList(userRightsList().filter(rights => rights.id !== recordId));
      } else if (selectedCollection() === 'organizationProfiles') {
        await onSaveOrganizationProfiles(organizationProfiles().filter(p => p.organizationId !== recordId));
      }

      logAction('Deleted', selectedCollection(), recordId, `Super Admin deleted raw JSON record`);
    } catch (e: any) {
      alert(`Error deleting record: ${e.message}`);
    }
  };

  // Get active dataset
  let activeDataset: any[] = [];
  if (selectedCollection() === 'trips') activeDataset = trips() || [];
  else if (selectedCollection() === 'trucks') activeDataset = trucks() || [];
  else if (selectedCollection() === 'drivers') activeDataset = drivers() || [];
  else if (selectedCollection() === 'offices') activeDataset = offices() || [];
  else if (selectedCollection() === 'accounts') activeDataset = accounts() || [];
  else if (selectedCollection() === 'expenses') activeDataset = expenses() || [];
  else if (selectedCollection() === 'tyres') activeDataset = tyres() || [];
  else if (selectedCollection() === 'auditLogs') activeDataset = auditLogs() || [];
  else if (selectedCollection() === 'userRights') activeDataset = userRightsList() || [];
  else if (selectedCollection() === 'organizationProfiles') activeDataset = organizationProfiles() || [];

  // Filter by organization if applicable and active
  const filteredByOrg = activeDataset.filter(item => {
    if (consoleOrgFilter() === 'ALL') return true;
    const itemOrgId = item.organizationId || item.orgId;
    if (itemOrgId) {
      return itemOrgId === consoleOrgFilter();
    }
    if (selectedCollection() === 'organizationProfiles') {
      return item.organizationId === consoleOrgFilter();
    }
    return true;
  });

  // Filter by search query
  const filteredConsoleRecords = filteredByOrg.filter(item => {
    if (!consoleSearchQuery()) return true;
    const query = consoleSearchQuery().toLowerCase();
    const idStr = String(item.id || item.organizationId || '').toLowerCase();
    const labelStr = getRecordLabel(item).toLowerCase();
    return idStr.includes(query) || labelStr.includes(query);
  });

  const uniqueOrgIds = Array.from(new Set([
    ...organizationProfiles().map(p => p.organizationId),
    ...trucks().map(t => t.organizationId).filter(Boolean),
    ...trips().map(t => t.organizationId).filter(Boolean)
  ])).filter(id => id !== 'org_backend');



  const getNextExpiryDate = (truck: Truck, duration: '1M' | '3M' | '6M' | '1Y'): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const baseDate = new Date(today);

    let monthsToAdd = 12;
    if (duration === '1M') monthsToAdd = 1;
    else if (duration === '3M') monthsToAdd = 3;
    else if (duration === '6M') monthsToAdd = 6;

    const newDate = new Date(baseDate);
    newDate.setMonth(newDate.getMonth() + monthsToAdd);
    return formatDate(newDate);
  };

  const getProjectedRequestExpiry = (duration: '1M' | '3M' | '6M' | '1Y'): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let monthsToAdd = 12;
    if (duration === '1M') monthsToAdd = 1;
    else if (duration === '3M') monthsToAdd = 3;
    else if (duration === '6M') monthsToAdd = 6;

    const newDate = new Date(today);
    newDate.setMonth(newDate.getMonth() + monthsToAdd);
    return formatDate(newDate);
  };

  const handleRenewClick = (orgId: string, truck: Truck, duration: '1M' | '3M' | '6M' | '1Y') => {
    const nextExpiryStr = getNextExpiryDate(truck, duration);
    const updatedTruck: Truck = {
      ...truck,
      registrationExpiryDate: nextExpiryStr,
      status: 'Active'
    };
    onUpdateTruckDetails(orgId, updatedTruck);
    logAction(
      'Edited',
      'Truck',
      truck.truckNo,
      `Renewed subscription by ${duration} to ${nextExpiryStr} and enabled status for Org ${orgId}`
    );
  };

  const handleRenewInModal = () => {
    if (!editingTruck() || !editingTruckOrgId()) return;
    const nextExpiryStr = getNextExpiryDate(editingTruck(), renewalDuration());
    const updatedTruck: Truck = {
      ...editingTruck(),
      registrationExpiryDate: nextExpiryStr,
      status: 'Active'
    };
    onUpdateTruckDetails(editingTruckOrgId(), updatedTruck);
    logAction(
      'Edited',
      'Truck',
      editingTruck().truckNo,
      `Renewed subscription by ${renewalDuration()} to ${nextExpiryStr} and enabled status for Org ${editingTruckOrgId()}`
    );
    setEditingTruck(updatedTruck);
  };

  // Exclude the backend organization itself from the control list
  const filteredOrgs = createMemo(() => organizationProfiles().filter(p =>
    p.organizationId !== 'org_backend' &&
    ((p.organizationName || '').toLowerCase().includes(orgSearch().toLowerCase()) ||
      (p.organizationId || '').toLowerCase().includes(orgSearch().toLowerCase()) ||
      (p.ownerEmail || '').toLowerCase().includes(orgSearch().toLowerCase()))
  ));

  // Flatten all truck requests across all organizations
  const allRequests = createMemo(() => organizationProfiles().flatMap(profile =>
    (profile.truckRequests || []).map(req => ({
      ...req,
      orgId: profile.organizationId || '',
      orgName: profile.organizationName || ''
    }))
  ).sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime()));

  const filteredRequests = createMemo(() => allRequests().filter(req =>
    (req.truckNo || '').toLowerCase().includes(requestSearch().toLowerCase()) ||
    (req.orgName || '').toLowerCase().includes(requestSearch().toLowerCase()) ||
    (req.status || '').toLowerCase().includes(requestSearch().toLowerCase())
  ));
  
  // Count pending requests
  const pendingRequestsCount = createMemo(() => allRequests().filter(r => r.status === 'Pending').length);

  const handleEditTruckClick = (orgId: string, truck: Truck) => {
    setEditingTruck({ ...truck });
    setEditingTruckOrgId(orgId);
  };

  const handleSaveTruckClick = () => {
    if (editingTruck() && editingTruckOrgId()) {
      onUpdateTruckDetails(editingTruckOrgId(), editingTruck());
      logAction('Edited', 'Truck', editingTruck().truckNo, `Admin modified compliance parameters for Org ${editingTruckOrgId()}`);
      setEditingTruck(null);
      setEditingTruckOrgId(null);
    }
  };

  return (
    <div class="space-y-6">
      {/* Header Info */}
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <ShieldAlert class="w-5 h-5 text-purple-400" />
            <h2 class="text-base font-extrabold text-slate-100 uppercase tracking-wide">Backend Team Control Panel</h2>
          </div>
          <p class="text-xs text-slate-400">Manage all registered organizations, review truck activation requests, adjust licenses, and override compliance datasheets.</p>
        </div>

        {/* Tab Selector buttons */}
        <div class="flex bg-slate-950/60 p-1 rounded-xl border border-slate-850 self-start md:self-center shrink-0 flex-wrap gap-1">
          {canViewBackend() !== false && (
            <button
              onClick={() => setActiveSubTab('ORGANIZATIONS')}
              class={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab() === 'ORGANIZATIONS'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-450 hover:text-slate-205'
                }`}
            >
              <Building2 class="w-4 h-4" />
              <span>Organization Profiles</span>
            </button>
          )}
          {canViewTruckRequests() !== false && (
            <button
              onClick={() => setActiveSubTab('REQUESTS')}
              class={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${activeSubTab() === 'REQUESTS'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-450 hover:text-slate-205'
                }`}
            >
              <TruckIcon class="w-4 h-4" />
              <span>Truck Requests</span>
              {pendingRequestsCount() > 0 && (
                <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white animate-pulse">
                  {pendingRequestsCount()}
                </span>
              )}
            </button>
          )}
          {canViewDatabaseConsole() !== false && (
            <button
              onClick={() => setActiveSubTab('RAW_DATA')}
              class={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab() === 'RAW_DATA'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-450 hover:text-slate-205'
                }`}
            >
              <Database class="w-4 h-4" />
              <span>Database Console</span>
            </button>
          )}
          {(isSuperAdmin() || (myRights()?.canViewTickets && hasSupportRole())) && (
            <button
              onClick={() => setActiveSubTab('TICKETS')}
              class={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${activeSubTab() === 'TICKETS'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-450 hover:text-slate-205'
                }`}
            >
              <MessageSquare class="w-4 h-4" />
              <span>Ticket Manager</span>
              {getAgentUnreadTicketsCount() > 0 && (
                <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white animate-pulse">
                  {getAgentUnreadTicketsCount()}
                </span>
              )}
            </button>
          )}
          {isSuperAdmin() && (
            <button
              onClick={() => setActiveSubTab('UPDATES')}
              class={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${activeSubTab() === 'UPDATES'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-450 hover:text-slate-205'
                }`}
            >
              <Download class="w-4 h-4" />
              <span>App Updates</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB CONTENT: ORGANIZATIONS */}
      {activeSubTab() === 'ORGANIZATIONS' && canViewBackend() !== false && (
        <div class="space-y-4">
          {/* Filters Bar */}
          <div class="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl gap-3">
            <div class="relative w-full sm:w-80">
              <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search org name, ID, or owner email..."
                value={orgSearch()}
                onChange={(e) => setOrgSearch(e.target.value)}
                class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div class="text-xs text-slate-505 dark:text-slate-400 font-medium">
              Showing {filteredOrgs().length} of {organizationProfiles().filter(p => p.organizationId !== 'org_backend').length} Organizations
            </div>
          </div>

          {/* Grid list of Organizations */}
          <div class="grid grid-cols-1 gap-4">
            {filteredOrgs().length === 0 ? (
              <div class="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 italic text-xs">
                No organizations match the search criteria.
              </div>
            ) : (
              filteredOrgs().map(profile => {
                const isSelected = selectedOrgId() === profile.organizationId;
                // Use the trucks state directly as source of truth (cloud snapshot).
                // Do NOT synthesize entries from truckRequests — deleted pending vehicles
                // would otherwise be re-added to the list (matches Truck Requests tab behaviour).
                const orgTrucks = trucks().filter(t => t.organizationId === profile.organizationId);
                const approvedTrucks = orgTrucks.filter(t => t.isApproved !== false);

                return (
                  <div
                    
                    class={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden shadow-2xs transition-all duration-200 ${profile.status === 'Disabled'
                      ? 'border-red-200 dark:border-red-900/40 bg-red-50/5'
                      : isSelected
                        ? 'border-purple-400 ring-1 ring-purple-400'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                  >
                    {/* Organization Main Card Header */}
                    <div class="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div class="space-y-1.5">
                        <div class="flex items-center gap-2.5">
                          <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">{profile.organizationName}</h3>
                          <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${profile.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400'
                            }`}>
                            {profile.status === 'Active' ? 'Active Account' : 'Account Disabled'}
                          </span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <div><b>ID:</b> <code class="bg-slate-100 dark:bg-slate-850 px-1 py-0.5 rounded text-[10px] font-mono select-all text-purple-600 dark:text-purple-400">{profile.organizationId}</code></div>
                          <div><b>Owner/Admin Email:</b> <span class="font-semibold select-all text-slate-700 dark:text-slate-300">{profile.ownerEmail}</span></div>
                        </div>
                      </div>

                      {/* Controls Area */}
                      <div class="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        {/* Status Toggle */}
                        <div class="flex items-center gap-2">
                          <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Status:</span>
                          <button
                            disabled={!canEditBackend()}
                            onClick={() => {
                              if (!canEditBackend()) return;
                              const nextStatus = profile.status === 'Active' ? 'Disabled' : 'Active';
                              onUpdateOrgStatus(profile.organizationId, nextStatus);
                            }}
                            class={`flex items-center gap-1 p-1 rounded transition text-xs font-semibold cursor-pointer ${!canEditBackend() ? 'opacity-50 cursor-not-allowed' : ''
                              } ${profile.status === 'Active'
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-rose-600 hover:bg-rose-50'
                              }`}
                            title={!canEditBackend() ? 'Edit permission required' : profile.status === 'Active' ? 'Click to Disable Organization' : 'Click to Enable Organization'}
                          >
                            {profile.status === 'Active' ? (
                              <ToggleRight class="w-6 h-6 text-emerald-500" />
                            ) : (
                              <ToggleLeft class="w-6 h-6 text-rose-500" />
                            )}
                          </button>
                        </div>

                        <div class="h-5 w-px bg-slate-200 dark:bg-slate-800"></div>

                        {/* Truck Limit Control */}
                        <div class="flex items-center gap-2">
                          <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Truck Limit:</span>
                          <div class="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-0.5">
                            <button
                              disabled={!canEditBackend() || profile.maxTrucksAllowed <= 1}
                              onClick={() => onUpdateOrgLimit(profile.organizationId, profile.maxTrucksAllowed - 1)}
                              class="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Minus class="w-3.5 h-3.5" />
                            </button>
                            <span class="px-2.5 font-bold font-mono text-slate-800 dark:bg-slate-900 rounded-md p-0.5 text-xs">
                              {profile.maxTrucksAllowed}
                            </span>
                            <button
                              disabled={!canEditBackend()}
                              onClick={() => onUpdateOrgLimit(profile.organizationId, profile.maxTrucksAllowed + 1)}
                              class="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Plus class="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div class="h-5 w-px bg-slate-200 dark:bg-slate-800"></div>

                        {/* Registered count indicators */}
                        <div class="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <b>Trucks:</b> {approvedTrucks.length} Active / {orgTrucks.length} Total
                        </div>

                        <button
                          onClick={() => setSelectedOrgId(isSelected ? null : profile.organizationId)}
                          class="px-3 py-1 bg-purple-500/10 hover:bg-purple-500/25 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          {isSelected ? 'Collapse Fleet' : 'Manage Trucks'}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDABLE SECTION: FLEET MANAGEMENT */}
                    {isSelected && (
                      <div class="border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 p-5 space-y-4">
                        <div class="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                          <h4 class="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-widest flex items-center gap-1.5">
                            <TruckIcon class="w-4 h-4 text-purple-500" />
                            Active Fleet & Expiry overrides
                          </h4>
                          <span class="text-[10px] text-slate-500">Double click values or click Edit to override tax & fitness dates</span>
                        </div>

                        {/* Expandable trucks list */}
                        {orgTrucks.length === 0 ? (
                          <p class="text-xs text-slate-400 italic text-center py-4">No trucks registered in this organization.</p>
                        ) : (
                          <div class="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900">
                            <table class="w-full text-left text-xs divide-y divide-slate-150 dark:divide-slate-800 whitespace-nowrap table-fixed">
                              <colgroup><col class="w-[110px]" /><col class="w-[75px]" /><col class="w-[85px]" /><col class="w-[85px]" /><col class="w-[85px]" /><col class="w-[85px]" /><col class="w-[85px]" /><col class="w-[125px]" /><col class="w-[130px]" /><col class="w-[75px]" /><col class="w-[70px]" /><col class="w-[110px]" /></colgroup>
                              <thead class="bg-slate-50 dark:bg-slate-950 font-bold text-[10px] text-slate-505 dark:text-slate-400 uppercase border-b border-slate-150 dark:border-slate-800">
                                <tr>
                                  <th class="px-2 py-2 pl-4">Truck No</th>
                                  <th class="px-2 py-2 text-center">Approved</th>
                                  <th class="px-2 py-2 text-center">Insurance</th>
                                  <th class="px-2 py-2 text-center">FC Date</th>
                                  <th class="px-2 py-2 text-center">Q Tax</th>
                                  <th class="px-2 py-2 text-center">Green Tax</th>
                                  <th class="px-2 py-2 text-center">NP Tax</th>
                                  <th class="px-2 py-2 text-center">Subscription Expiry</th>
                                  <th class="px-2 py-2 text-center">Renew Action</th>
                                  <th class="px-2 py-2 text-right">Odometer</th>
                                  <th class="px-2 py-2 text-center">Status</th>
                                  <th class="px-2 py-2 text-center pr-4">Override</th>
                                </tr>
                              </thead>
                              <tbody class="divide-y divide-slate-100 dark:divide-slate-850 font-medium">
                                {orgTrucks.map(truck => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  const isExpired = truck.registrationExpiryDate ? truck.registrationExpiryDate < todayStr : false;
                                  const duration = rowDurations()[truck.id] || '1Y';

                                  return (
                                    <tr  class="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                                      <td class="px-2 py-2.5 pl-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {truck.truckNo}
                                      </td>
                                      <td class="px-2 py-2.5 text-center">
                                        <span class={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${truck.isApproved !== false
                                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                          : truck.requestStatus === 'Rejected'
                                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                            : 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse'
                                          }`}>
                                          {truck.isApproved !== false
                                            ? 'Approved'
                                            : truck.requestStatus === 'Rejected'
                                              ? 'Rejected'
                                              : 'Pending'}
                                        </span>
                                      </td>
                                      <td class="px-2 py-2.5 text-center font-mono text-[11px] text-slate-500">{formatToDisplayDate(truck.insuranceDate)}</td>
                                      <td class="px-2 py-2.5 text-center font-mono text-[11px] text-slate-500">{formatToDisplayDate(truck.fcDate)}</td>
                                      <td class="px-2 py-2.5 text-center font-mono text-[11px] text-slate-500">{formatToDisplayDate(truck.qTaxDate)}</td>
                                      <td class="px-2 py-2.5 text-center font-mono text-[11px] text-slate-500">{formatToDisplayDate(truck.greenTaxDate)}</td>
                                      <td class="px-2 py-2.5 text-center font-mono text-[11px] text-slate-500">{formatToDisplayDate(truck.npTaxDate)}</td>
                                      <td class={`px-2 py-2.5 text-center font-mono text-[11px] ${isExpired
                                        ? 'text-red-500 font-extrabold dark:text-red-400'
                                        : 'text-slate-500'
                                        }`}>
                                        {formatToDisplayDate(truck.registrationExpiryDate)}
                                        {isExpired && <span class="block text-[8px] text-red-500 font-bold uppercase">Expired</span>}
                                      </td>
                                      <td class="px-2 py-2.5 text-center">
                                        {(() => {
                                          const truckPayments = (payments || []).filter((p: any) =>
                                            p.truckNo.toUpperCase() === truck.truckNo.toUpperCase() &&
                                            p.organizationId === profile.organizationId
                                          );
                                          const activeRefundablePayment = truckPayments.find((p: any) => {
                                            if (p.status !== 'Success' && p.status !== 'Refunded') return false;
                                            const payDate = new Date(p.paymentDate || p.createdAt);
                                            const diffTime = Date.now() - payDate.getTime();
                                            const diffDays = diffTime / (1000 * 60 * 60 * 24);
                                            return diffDays <= 7;
                                          });

                                          if (activeRefundablePayment) {
                                            if (activeRefundablePayment.status === 'Refunded') {
                                              return (
                                                <span class="text-[10px] text-rose-500 font-extrabold uppercase bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                                  Refunded
                                                </span>
                                              );
                                            }
                                            return (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (confirm(`Are you sure you want to initiate a PhonePe refund of ₹${activeRefundablePayment.amount} for truck ${truck.truckNo}? This will rollback approval status.`)) {
                                                    onInitiateRefund?.(profile.organizationId, truck.truckNo, activeRefundablePayment);
                                                  }
                                                }}
                                                class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                                              >
                                                Request Refund
                                              </button>
                                            );
                                          }

                                          return (
                                            <div class="flex flex-col items-center gap-1 justify-center">
                                              <div class="flex items-center gap-1">
                                                <select
                                                  disabled={!canEditBackend()}
                                                  value={duration}
                                                  onChange={(e) => setRowDurations(prev => ({ ...prev, [truck.id]: e.target.value as any }))}
                                                  class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-855 dark:text-slate-200 rounded px-1 py-0.5 text-[10px] focus:outline-none"
                                                >
                                                  <option value="1M">1 Month</option>
                                                  <option value="3M">3 Months</option>
                                                  <option value="6M">6 Months</option>
                                                  <option value="1Y">1 Year</option>
                                                </select>
                                                <button
                                                  disabled={!canEditBackend()}
                                                  onClick={() => handleRenewClick(profile.organizationId, truck, duration)}
                                                  class="px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-[10px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                  Renew
                                                </button>
                                              </div>
                                              <span class="text-[9px] font-mono text-purple-600 dark:text-purple-400">
                                                → {formatToDisplayDate(getNextExpiryDate(truck, duration))}
                                              </span>
                                            </div>
                                          );
                                        })()}
                                      </td>
                                      <td class="px-2 py-2.5 text-right font-mono text-slate-600">{truck.currentKM?.toLocaleString() || '0'}</td>
                                      <td class="px-2 py-2.5 text-center">
                                        <span class={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${truck.status === 'Active'
                                          ? 'bg-green-55/15 text-green-700 dark:bg-green-500/10'
                                          : 'bg-slate-100 text-slate-650 dark:bg-slate-800'
                                          }`}>
                                          {truck.status}
                                        </span>
                                      </td>
                                      <td class="px-2 py-2.5 text-center pr-4">
                                        {truck.isApproved === false ? (
                                          truck.requestStatus === 'Rejected' ? (
                                            <span class="text-[10px] font-bold text-rose-500 uppercase">Rejected</span>
                                          ) : (
                                            <div class="flex flex-col items-center gap-1.5 justify-center py-1">
                                              <div class="flex items-center gap-1">
                                                <select
                                                  disabled={!canApproveBackend()}
                                                  value={duration}
                                                  onChange={(e) => setRowDurations(prev => ({ ...prev, [truck.id]: e.target.value as any }))}
                                                  class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded px-1 py-0.5 text-[10px] focus:outline-none"
                                                >
                                                  <option value="1M">1 Month</option>
                                                  <option value="3M">3 Months</option>
                                                  <option value="6M">6 Months</option>
                                                  <option value="1Y">1 Year</option>
                                                </select>
                                                <span class="text-[9px] font-mono text-purple-600 dark:text-purple-400">
                                                  → {formatToDisplayDate(getNextExpiryDate(truck, duration))}
                                                </span>
                                              </div>
                                              <div class="flex justify-center items-center gap-1.5">
                                                <button
                                                  disabled={!canApproveBackend()}
                                                  onClick={() => {
                                                    const matchingReq = (profile.truckRequests || []).find(
                                                      r => r.truckNo.toUpperCase() === truck.truckNo.toUpperCase() && r.status === 'Pending'
                                                    );
                                                    const reqId = matchingReq ? matchingReq.id : `req_fallback_${truck.id}`;
                                                    if (confirm(`Approve registration of truck ${truck.truckNo} for organization ${profile.organizationName}?`)) {
                                                      onApproveTruckRequest(profile.organizationId, reqId, truck.truckNo, duration);
                                                    }
                                                  }}
                                                  class="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                                  title="Approve Truck (Manual Override)"
                                                >
                                                  Approve
                                                </button>
                                                <button
                                                  disabled={!canApproveBackend()}
                                                  onClick={() => {
                                                    const matchingReq = (profile.truckRequests || []).find(
                                                      r => r.truckNo.toUpperCase() === truck.truckNo.toUpperCase() && r.status === 'Pending'
                                                    );
                                                    const reqId = matchingReq ? matchingReq.id : `req_fallback_${truck.id}`;
                                                    if (confirm(`Decline and reject registration of truck ${truck.truckNo} for organization ${profile.organizationName}?`)) {
                                                      onRejectTruckRequest(profile.organizationId, reqId, truck.truckNo);
                                                    }
                                                  }}
                                                  class="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                                  title="Reject Request (Manual Override)"
                                                >
                                                  Reject
                                                </button>
                                              </div>
                                            </div>
                                          )
                                        ) : (
                                          <button
                                            disabled={!canEditBackend()}
                                            onClick={() => handleEditTruckClick(profile.organizationId, truck)}
                                            class="p-1 text-blue-650 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                            title={canEditBackend() ? "Override Compliance & Expiry Dates" : "Edit permission required"}
                                          >
                                            <Edit class="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Payments & Refunds Ledger */}
                        {(() => {
                          const orgPayments = (payments || []).filter((p: any) => p.organizationId === profile.organizationId);
                          return (
                            <div class="mt-6 border-t border-slate-200 dark:border-slate-850 pt-5 space-y-3">
                              <div class="flex justify-between items-center">
                                <h4 class="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-widest flex items-center gap-1.5">
                                  <History class="w-4 h-4 text-purple-500" />
                                  Payments & Refunds Ledger
                                </h4>
                                <span class="text-[10px] text-slate-500 font-medium">
                                  Showing {orgPayments.length} transactions
                                </span>
                              </div>

                              {orgPayments.length === 0 ? (
                                <p class="text-xs text-slate-400 italic text-center py-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                  No transactions recorded for this organization.
                                </p>
                              ) : (
                                <div class="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900">
                                  <table class="w-full text-left text-xs divide-y divide-slate-150 dark:divide-slate-800 whitespace-nowrap table-fixed">
                                    <colgroup>
                                      <col class="w-[140px]" />
                                      <col class="w-[100px]" />
                                      <col class="w-[80px]" />
                                      <col class="w-[90px]" />
                                      <col class="w-[180px]" />
                                      <col class="w-[90px]" />
                                      <col class="w-[110px]" />
                                    </colgroup>
                                    <thead class="bg-slate-55 dark:bg-slate-950 font-bold text-[10px] text-slate-500 dark:text-slate-400 uppercase border-b border-slate-150 dark:border-slate-800">
                                      <tr>
                                        <th class="px-3 py-2 pl-4">Date</th>
                                        <th class="px-2 py-2">Truck No</th>
                                        <th class="px-2 py-2 text-right">Amount</th>
                                        <th class="px-2 py-2 text-center">Method</th>
                                        <th class="px-2 py-2">Transaction ID / Refund ID</th>
                                        <th class="px-2 py-2 text-center">Status</th>
                                        <th class="px-2 py-2 text-center pr-4">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-100 dark:divide-slate-850 font-medium">
                                      {orgPayments.map((p: any) => {
                                        const payDate = new Date(p.paymentDate || p.createdAt);
                                        const diffTime = Date.now() - payDate.getTime();
                                        const diffDays = diffTime / (1000 * 60 * 60 * 24);
                                        const isRefundable = (p.status === 'Success' || p.status === 'success') && diffDays <= 7;

                                        return (
                                          <tr  class="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                                            <td class="px-3 py-2.5 pl-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                              {formatToDisplayDate(p.paymentDate || p.createdAt.split('T')[0])} {payDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td class="px-2 py-2.5 font-mono font-bold text-slate-700 dark:text-slate-350">
                                              {p.truckNo}
                                            </td>
                                            <td class="px-2 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                              ₹{p.amount?.toLocaleString()}
                                            </td>
                                            <td class="px-2 py-2.5 text-center font-mono text-[10px] text-slate-500 uppercase">
                                              {p.paymentMethod || 'upi'}
                                            </td>
                                            <td class="px-2 py-2.5 font-mono text-[10px] text-slate-500">
                                              <div class="flex flex-col">
                                                <span>Txn: {p.transactionId}</span>
                                                {p.refundId && (
                                                  <span class="text-rose-500 font-semibold text-[9px]">
                                                    Ref: {p.refundId}
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td class="px-2 py-2.5 text-center">
                                              <span class={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                p.status === 'Refunded' || p.status === 'refunded'
                                                  ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20'
                                                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20'
                                              }`}>
                                                {p.status}
                                              </span>
                                            </td>
                                            <td class="px-2 py-2.5 text-center pr-4">
                                              {isRefundable ? (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (confirm(`Are you sure you want to initiate a PhonePe refund of ₹${p.amount} for truck ${p.truckNo}? This will rollback approval status.`)) {
                                                      onInitiateRefund?.(profile.organizationId, p.truckNo, p);
                                                    }
                                                  }}
                                                  class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                                                >
                                                  Request Refund
                                                </button>
                                              ) : p.status === 'Refunded' ? (
                                                <span class="text-[10px] text-rose-500 font-extrabold uppercase bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded border border-rose-200">
                                                  Refunded
                                                </span>
                                              ) : (
                                                <span class="text-[10px] text-slate-400 italic">
                                                  No Action
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: REQUESTS */}
      {activeSubTab() === 'REQUESTS' && canViewTruckRequests() !== false && (
        <div class="space-y-4">
          {/* Pause Notification Banner */}
          <div class="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-amber-800 dark:text-amber-400 text-xs flex gap-3">
            <AlertCircle class="w-5 h-5 flex-shrink-0 text-amber-550 mt-0.5 animate-pulse" />
            <div>
              <p class="font-bold text-sm">Manual Approval System Paused</p>
              <p class="mt-1 leading-relaxed text-slate-600 dark:text-slate-400">
                The manual verification and approval system is currently paused. Vehicle activations and registration renewals are now automated using the PhonePe secure payment gateway. Approved and active subscriptions bypass manual checks.
              </p>
            </div>
          </div>

          {/* Filters Bar */}
          <div class="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl gap-3">
            <div class="relative w-full sm:w-80">
              <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search truck number, organization name..."
                value={requestSearch()}
                onChange={(e) => setRequestSearch(e.target.value)}
                class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div class="text-xs text-slate-505 dark:text-slate-400 font-medium">
              Total {filteredRequests().length} truck activation requests
            </div>
          </div>

          {/* Requests List */}
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs divide-y divide-slate-150 dark:divide-slate-800 whitespace-nowrap table-fixed">
              <colgroup><col class="w-[120px]" /><col class="w-[160px]" /><col class="w-[120px]" /><col class="w-[110px]" /><col class="w-[80px]" /><col class="w-[100px]" /><col class="w-[220px]" /></colgroup>
                <thead class="bg-slate-50 dark:bg-slate-950 font-bold text-[10px] text-slate-505 dark:text-slate-400 uppercase border-b border-slate-150 dark:border-slate-800">
                  <tr>
                    <th class="px-3 py-3 pl-4">Truck Number</th>
                    <th class="px-3 py-3">Organization</th>
                    <th class="px-3 py-3">Technical Specs</th>
                    <th class="px-3 py-3 text-center">Requested At</th>
                    <th class="px-3 py-3 text-center">Status</th>
                    <th class="px-3 py-3 text-center">Action Taken</th>
                    <th class="px-3 py-3 text-center pr-4">Resolve Request</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-850 font-medium">
                  {filteredRequests().length === 0 ? (
                    <tr>
                      <td colSpan={7} class="text-center py-12 text-slate-400 italic">No truck requests found.</td>
                    </tr>
                  ) : (
                    filteredRequests().map(req => (
                      <tr  class="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                        <td class="px-3 py-3.5 pl-4 font-mono font-extrabold tracking-wider text-slate-800 dark:text-slate-100 text-xs">
                          {req.truckNo}
                        </td>
                        <td class="px-3 py-3.5">
                          <div class="font-semibold text-slate-700 dark:text-slate-300">{req.orgName}</div>
                          <div class="text-[10px] text-slate-400 font-mono">{req.orgId}</div>
                        </td>
                        <td class="px-3 py-3.5 text-slate-500 text-[11px]">
                          <div>{req.make || '—'} {req.model || ''}</div>
                          <div class="text-[10px] italic">{req.type || ''}</div>
                        </td>
                        <td class="px-3 py-3.5 text-center font-mono text-[11px] text-slate-500">
                          {req.requestedAt}
                        </td>
                        <td class="px-3 py-3.5 text-center">
                          <span class={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${req.status === 'Pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10'
                            : req.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10'
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10'
                            }`}>
                            {req.status}
                          </span>
                        </td>
                        <td class="px-3 py-3.5 text-center font-mono text-[10px] text-slate-400">
                          {req.status === 'Pending' ? 'Needs Action' : `${req.status} on ${req.requestedAt}`}
                        </td>
                        <td class="px-3 py-3.5 text-center pr-4">
                          {req.status === 'Pending' ? (
                            (() => {
                              const duration = rowDurations()[req.id] || '1Y';
                              return (
                                <div class="flex flex-col items-center gap-1.5 py-1">
                                  <div class="flex items-center gap-1">
                                    <select
                                      disabled={!canApproveBackend()}
                                      value={duration}
                                      onChange={(e) => setRowDurations(prev => ({ ...prev, [req.id]: e.target.value as any }))}
                                      class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-805 dark:text-slate-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-purple-500 font-sans cursor-pointer font-semibold"
                                    >
                                      <option value="1M">1 Month</option>
                                      <option value="3M">3 Months</option>
                                      <option value="6M">6 Months</option>
                                      <option value="1Y">1 Year</option>
                                    </select>
                                    <span class="text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-500/5 px-1 py-0.5 rounded border border-purple-500/10">
                                      → {getProjectedRequestExpiry(duration)}
                                    </span>
                                  </div>
                                  <div class="flex items-center gap-2">
                                    <button
                                      disabled={!canApproveBackend()}
                                      onClick={() => {
                                        if (confirm(`Approve registration of truck ${req.truckNo} for organization ${req.orgName}?`)) {
                                          onApproveTruckRequest(req.orgId, req.id, req.truckNo, duration);
                                        }
                                      }}
                                      class="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Approve (Manual Override)"
                                    >
                                      <Check class="w-3.5 h-3.5" />
                                      Approve
                                    </button>
                                    <button
                                      disabled={!canApproveBackend()}
                                      onClick={() => {
                                        if (confirm(`Decline and reject registration of truck ${req.truckNo} for organization ${req.orgName}?`)) {
                                          onRejectTruckRequest(req.orgId, req.id);
                                        }
                                      }}
                                      class="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Reject (Manual Override)"
                                    >
                                      <CloseIcon class="w-3.5 h-3.5" />
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              );
                            })()
                          ) : req.status === 'Approved' ? (
                            <span class="text-[11px] text-emerald-600 font-bold">Approved</span>
                          ) : (
                            <span class="text-[11px] text-rose-500 font-bold">Rejected</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: RAW DATA CONSOLE */}
      {activeSubTab() === 'RAW_DATA' && canViewDatabaseConsole() !== false && (
        <div class="space-y-4">
          {/* Controls & Filter Bar */}
          <div class="flex flex-col md:flex-row justify-between items-stretch md:items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl gap-4">
            <div class="flex flex-wrap items-center gap-3">
              {/* Collection Dropdown */}
              <div class="flex flex-col">
                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1">Select Collection</label>
                <select
                  value={selectedCollection()}
                  onChange={(e) => {
                    setSelectedCollection(e.target.value as any);
                    setConsoleSearchQuery('');
                  }}
                  class="bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value="trips">Trips ({trips().length})</option>
                  <option value="trucks">Trucks ({trucks().length})</option>
                  <option value="drivers">Drivers ({drivers().length})</option>
                  <option value="offices">Offices ({offices().length})</option>
                  <option value="accounts">Accounts ({accounts().length})</option>
                  <option value="expenses">Expenses ({expenses().length})</option>
                  <option value="tyres">Tyres ({tyres().length})</option>
                  <option value="auditLogs">Audit Logs ({auditLogs().length})</option>
                  <option value="userRights">User Permissions ({userRightsList().length})</option>
                  <option value="organizationProfiles">Organizations ({organizationProfiles().length})</option>
                </select>
              </div>

              {/* Org Filter Dropdown */}
              <div class="flex flex-col">
                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1">Organization Filter</label>
                <select
                  value={consoleOrgFilter()}
                  onChange={(e) => setConsoleOrgFilter(e.target.value)}
                  class="bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value="ALL">All Organizations</option>
                  {uniqueOrgIds.map(orgId => (
                    <option  value={orgId}>{orgId}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search and Add buttons */}
            <div class="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 self-stretch md:self-end">
              <div class="relative flex-1 sm:w-64">
                <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={`Search in ${selectedCollection()}...`}
                  value={consoleSearchQuery()}
                  onChange={(e) => setConsoleSearchQuery(e.target.value)}
                  class="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                disabled={!canEditDatabaseConsole()}
                onClick={handleAddConsoleRecordClick}
                class="flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={!canEditDatabaseConsole() ? "Add permission required" : "Add Record"}
              >
                <Plus class="w-4 h-4" />
                <span>Add Record</span>
              </button>
            </div>
          </div>

          {/* Database Table view */}
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs divide-y divide-slate-150 dark:divide-slate-800 whitespace-nowrap table-fixed">
                <colgroup><col class="w-[180px]" /><col class="w-[100px]" /><col class="w-auto" /><col class="w-[180px]" /></colgroup>
                <thead class="bg-slate-50 dark:bg-slate-950 font-bold text-[10px] text-slate-505 dark:text-slate-400 uppercase border-b border-slate-150 dark:border-slate-800">
                  <tr>
                    <th class="px-4 py-3">ID / Reference</th>
                    <th class="px-4 py-3 text-center">Org ID</th>
                    <th class="px-4 py-3">Details Summary</th>
                    <th class="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-855 font-medium">
                  {filteredConsoleRecords.length === 0 ? (
                    <tr>
                      <td colSpan={4} class="text-center py-12 text-slate-400 italic">No records found.</td>
                    </tr>
                  ) : (
                    filteredConsoleRecords.map((item, idx) => {
                      const idVal = item.id || item.organizationId || `idx_${idx}`;
                      const orgVal = item.organizationId || item.orgId || 'Global';
                      const labelVal = getRecordLabel(item);

                      return (
                        <tr  class="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                          <td class="px-4 py-3 font-mono text-[11px] text-purple-600 dark:text-purple-400 font-bold select-all truncate" title={idVal}>
                            {idVal}
                          </td>
                          <td class="px-4 py-3 text-center">
                            <span class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-750 dark:text-slate-350 font-mono">
                              {orgVal}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-slate-700 dark:text-slate-300 truncate" title={labelVal}>
                            {selectedCollection() === 'userRights' ? (
                              <div class="flex flex-col gap-1">
                                <div class="font-bold text-slate-800 dark:text-slate-205">{item.name || 'No Name'} ({item.email || 'No Email'})</div>
                                <div class="flex items-center gap-1.5 text-[9px] flex-wrap">
                                  <span class="font-semibold text-slate-400">Role: <b class="text-purple-600 dark:text-purple-400">{item.role || 'Custom'}</b></span>
                                  <span class={`px-1 py-0.5 rounded text-[8px] font-bold border ${item.isEmailVerified
                                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                      : 'bg-amber-500/10 text-amber-550 border-amber-500/20'
                                    }`}>
                                    Email: {item.isEmailVerified ? 'Verified' : 'Unverified'}
                                  </span>
                                  <span class={`px-1 py-0.5 rounded text-[8px] font-bold border ${item.isPhoneVerified
                                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                      : 'bg-amber-500/10 text-amber-550 border-amber-500/20'
                                    }`}>
                                    Phone: {item.isPhoneVerified ? 'Verified' : 'Unverified'}
                                  </span>
                                  {item.phone && (
                                    <span class="text-slate-450 font-mono">({item.phone})</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              labelVal
                            )}
                          </td>
                          <td class="px-4 py-2 text-center">
                            <div class="flex justify-center items-center gap-2 flex-wrap">
                              <button
                                disabled={!canEditDatabaseConsole()}
                                onClick={() => handleEditConsoleRecord(item)}
                                class="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={!canEditDatabaseConsole() ? "Edit permission required" : "Edit JSON"}
                              >
                                <Code class="w-3.5 h-3.5" />
                                Edit JSON
                              </button>

                              {selectedCollection() === 'userRights' && (
                                <>
                                  {!item.isEmailVerified && (
                                    <button
                                      disabled={!canApproveBackend()}
                                      onClick={() => {
                                        const updated = { ...item, isEmailVerified: true };
                                        onSaveUserRightsList(userRightsList().map(r => r.id === item.id ? updated : r));
                                        logAction('Edited', 'Permission', item.email, `Backend team manually verified email for ${item.name || item.email}`);
                                        alert(`Manually verified email for ${item.name || item.email}`);
                                      }}
                                      class="flex items-center gap-1 px-2 py-1 bg-emerald-605 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Manually Verify Email"
                                    >
                                      Verify Email
                                    </button>
                                  )}
                                  {!item.isPhoneVerified && (
                                    <button
                                      disabled={!canApproveBackend()}
                                      onClick={() => {
                                        const updated = { ...item, isPhoneVerified: true };
                                        onSaveUserRightsList(userRightsList().map(r => r.id === item.id ? updated : r));
                                        logAction('Edited', 'Permission', item.email, `Backend team manually verified phone for ${item.name || item.email}`);
                                        alert(`Manually verified phone for ${item.name || item.email}`);
                                      }}
                                      class="flex items-center gap-1 px-2 py-1 bg-teal-605 hover:bg-teal-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Manually Verify Phone"
                                    >
                                      Verify Phone
                                    </button>
                                  )}
                                  <button
                                    disabled={!canApproveBackend()}
                                    onClick={async () => {
                                      if (isAppwriteConfigured()) {
                                        if (confirm(`Send password reset/recovery link to ${item.email}?`)) {
                                          try {
                                            const recoveryUrl = `${getAppOrigin()}?mode=recovery`;
                                            await appwrite.createRecovery(item.email.trim(), recoveryUrl);
                                            logAction('Edited', 'Permission', item.email, `Backend team initiated password reset email for ${item.email}`);
                                            alert(`Password recovery link sent successfully to ${item.email}!`);
                                          } catch (err: any) {
                                            alert(`Failed to send recovery: ${err.message || err}`);
                                          }
                                        }
                                      } else {
                                        const newPass = prompt(`[Mock Mode] Enter new password for ${item.email}:`, "newpassword123");
                                        if (newPass) {
                                          if (newPass.length < 8) {
                                            alert("Password must be at least 8 characters.");
                                            return;
                                          }
                                          logAction('Edited', 'Permission', item.email, `Backend team set mock password for ${item.email}`);
                                          alert(`[Mock Mode] Password for ${item.email} successfully updated to: ${newPass}`);
                                        }
                                      }
                                    }}
                                    class="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Reset Password / Send Recovery"
                                  >
                                    Reset PW
                                  </button>
                                </>
                              )}

                              <button
                                disabled={!canDeleteDatabaseConsole()}
                                onClick={() => handleDeleteConsoleRecord(item)}
                                class="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={!canDeleteDatabaseConsole() ? "Delete permission required" : "Delete"}
                              >
                                <Trash2 class="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* JSON EDITOR OVERLAY MODAL */}
      {jsonEditorRecord() && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            {/* Modal Header */}
            <div class="p-5 bg-slate-55 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
              <div class="flex items-center gap-2">
                <Code class="w-5 h-5 text-purple-600" />
                <div>
                  <h3 class="text-sm font-bold text-slate-850 dark:text-slate-100">
                    {isAddingNewRecord() ? `Add New Record to [${selectedCollection()}]` : `Edit Raw JSON Record in [${selectedCollection()}]`}
                  </h3>
                  <p class="text-[11px] text-slate-500 font-mono">
                    ID: {jsonEditorRecord().id || jsonEditorRecord().organizationId || '(Auto-generated on Save)'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setJsonEditorRecord(null)}
                class="text-slate-400 hover:text-slate-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content - JSON Textarea */}
            <div class="p-5 flex-1 overflow-hidden flex flex-col space-y-4">
              <div class="flex-1 min-h-[300px] flex flex-col border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <textarea
                  value={jsonEditorContent()}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  class="w-full flex-1 p-4 bg-slate-950 font-mono text-[11px] leading-relaxed text-emerald-450 focus:outline-none resize-none overflow-y-auto"
                  placeholder="Paste or write valid JSON here..."
                  spellcheck="false"
                />
              </div>

              {/* Status and Error Alert Area */}
              <div class={`p-3 rounded-lg border flex items-start gap-2 text-xs leading-normal ${jsonEditorIsValid()
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-450'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                }`}>
                {jsonEditorIsValid() ? (
                  <>
                    <Check class="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                    <span class="font-bold">Valid JSON payload syntax. Ready to save!</span>
                  </>
                ) : (
                  <>
                    <AlertCircle class="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                    <div>
                      <div class="font-bold">Malformed JSON syntax details:</div>
                      <code class="block mt-1 font-mono text-[10px] break-all">{jsonEditorError()}</code>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div class="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setJsonEditorRecord(null)}
                class="px-4 py-2 border border-slate-200 text-slate-550 rounded text-xs font-bold transition hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!jsonEditorIsValid()}
                onClick={handleSaveConsoleRecord}
                class="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save class="w-4 h-4" />
                <span>Save Database Object</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TICKET MANAGER */}
      {activeSubTab() === 'TICKETS' && (isSuperAdmin() || (myRights()?.canViewTickets && hasSupportRole())) && (
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex h-[550px] text-left">
          {/* Left Panel: Ticket List */}
          <div class="w-1/3 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
            <div class="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <h4 class="font-bold text-slate-850 dark:text-slate-200 text-xs uppercase tracking-wider">
                Support Queue ({filteredTickets().length})
              </h4>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredTickets().length === 0 ? (
                <div class="p-8 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                  No tickets in queue.
                </div>
              ) : (
                filteredTickets().map((t) => {
                  const lastMsg = t.messages?.[t.messages.length - 1];
                  const isSelected = selectedTicketId() === t.id;
                  return (
                    <button
                      
                      onClick={() => {
                        setSelectedTicketId(t.id);
                        setResolvedUrls({});
                      }}
                      class={`w-full text-left p-3 rounded-xl transition-all ${
                        isSelected
                          ? 'bg-purple-50/40 dark:bg-purple-950/30 border-l-4 border-purple-600'
                          : 'hover:bg-slate-55 dark:hover:bg-slate-800/40 border-l-4 border-transparent'
                      }`}
                    >
                      <div class="flex justify-between items-start mb-1">
                        <span class="font-bold text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1.5 animate-none">
                          #{t.ticketNo}
                          {t.lockedByEmail && (
                            <span class="text-amber-550 dark:text-amber-450 shrink-0" title={`Locked by ${t.lockedByName}`}>
                              <Lock class="w-3 h-3 inline-block align-middle" />
                            </span>
                          )}
                          {getAgentUnreadInfo(t).hasUnread && (
                            <span class="flex items-center justify-center bg-rose-500 text-white rounded-full text-[9px] px-1 min-w-[14px] h-[14px] font-sans font-bold leading-none animate-pulse">
                              {getAgentUnreadInfo(t).count}
                            </span>
                          )}
                        </span>
                        <span
                          class={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            t.status === 'Open'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/40'
                              : t.status === 'In Progress'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-450 border border-amber-100 dark:border-amber-900/40'
                              : 'bg-slate-100 text-slate-605 dark:bg-slate-800/70 dark:text-slate-400 border border-slate-202 dark:border-slate-700/60'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div class="font-bold text-xs text-slate-800 dark:text-slate-200 truncate mb-1">
                        {t.title}
                      </div>
                      <div class="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {lastMsg ? lastMsg.content : t.description}
                      </div>
                      <div class="flex justify-between items-center mt-2 text-[9px] text-slate-400 font-medium">
                        <span class="bg-slate-100 dark:bg-slate-850 px-1.5 py-0.5 rounded text-[9px] font-semibold">
                          {t.category}
                        </span>
                        <span>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Chat & Actions */}
          <div class="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/35">
            {selectedTicket() ? (() => {
              const ticket = selectedTicket()!;
              const isLockedByOther = !!(ticket.lockedByEmail && ticket.lockedByEmail !== currentUser?.email);
              return (
                <>
                  {/* Header */}
                  <div class="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-start shadow-3xs gap-3">
                    <div>
                      <div class="flex items-center gap-2">
                        <h4 class="font-bold text-slate-800 dark:text-slate-200 text-xs font-mono">
                          #{ticket.ticketNo}
                        </h4>
                        <span class="text-slate-450 dark:text-slate-550 text-xs">•</span>
                        <span class="font-semibold text-xs text-slate-705 dark:text-slate-350">
                          {ticket.title}
                        </span>
                      </div>
                      <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-1 space-y-0.5">
                        <p>
                          Requester: <span class="font-bold text-slate-700 dark:text-slate-300">{ticket.requesterName}</span> ({ticket.requesterEmail})
                        </p>
                        <p>
                          Phone: <span class="font-mono">{ticket.requesterPhone || '—'}</span> | Org ID: <span class="font-mono">{ticket.organizationId || 'Public'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Actions Area */}
                    <div class="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      {/* Team Transfer dropdown if allowed */}
                      {(isSuperAdmin() || myCanTransfer()) && (
                        <div class="flex items-center gap-1.5">
                          <span class="text-[10px] font-bold text-slate-450 uppercase">Team:</span>
                          <select
                            value={ticket.assignedTeam}
                            onChange={(e) => handleTransferTicket(ticket.id, e.target.value as any)}
                            disabled={isLockedByOther}
                            class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-805 dark:text-slate-200 rounded px-2 py-1 text-[11px] font-bold outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="Technical">Technical</option>
                            <option value="Billing">Billing</option>
                            <option value="General">General</option>
                          </select>
                        </div>
                      )}

                      {/* Close/Reopen ticket button */}
                      {ticket.status !== 'Closed' ? (
                        <button
                          onClick={() => handleUpdateTicketStatus(ticket.id, 'Closed')}
                          disabled={isLockedByOther || (!isSuperAdmin() && !myRights()?.canEditTickets)}
                          class="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold px-2.5 py-1 rounded text-[10px] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Close Ticket
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateTicketStatus(ticket.id, 'In Progress')}
                          disabled={isLockedByOther || (!isSuperAdmin() && !myRights()?.canEditTickets)}
                          class="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold px-2.5 py-1 rounded text-[10px] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reopen Ticket
                        </button>
                      )}

                      {/* Delete ticket button */}
                      {(isSuperAdmin() || myRights()?.canDeleteTickets) && (
                        <button
                          onClick={() => handleDeleteTicket(ticket.id)}
                          disabled={isLockedByOther}
                          class="bg-rose-600 text-white hover:bg-rose-750 font-bold px-2.5 py-1 rounded text-[10px] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div class="p-3 mx-4 mt-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-650 dark:text-slate-350 shadow-3xs">
                    <span class="font-bold text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Description</span>
                    <p class="whitespace-pre-line leading-relaxed">{ticket.description}</p>
                  </div>
                  {/* Chat Messages */}
                  <div class="flex-1 overflow-y-auto p-4 space-y-3">
                    {ticket.messages?.map((msg) => {
                      const isSystem = msg.senderName === 'System Notification' || msg.senderEmail === 'system@ttt.com';
                      const isAgent = msg.sender === 'Agent';

                      if (isSystem) {
                        return (
                          <div  class="flex justify-center my-2">
                            <div class="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-550/20 rounded-lg px-3 py-1.5 text-[11px] max-w-[85%] text-center font-medium shadow-3xs">
                              {msg.content}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div  class={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                          <div
                            class={`max-w-[75%] rounded-2xl p-3 border shadow-3xs text-xs text-left ${
                              isAgent
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent rounded-tr-none shadow-md shadow-purple-500/10'
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/60 rounded-tl-none shadow-xs'
                            }`}
                          >
                            <div class="flex justify-between items-center gap-4 mb-1 text-[9px] opacity-75 font-semibold">
                              <span>{msg.senderName} ({msg.sender === 'Agent' ? 'Agent' : 'User'})</span>
                              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p class="whitespace-pre-line leading-relaxed font-sans">{msg.content}</p>

                            {msg.attachmentUrl && (
                              <div class={`mt-2 p-1.5 rounded flex items-center justify-between gap-3 text-[10px] ${
                                isAgent ? 'bg-purple-705 border border-purple-600/40 text-purple-50' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350'
                              }`}>
                                <div class="flex items-center gap-1.5 truncate">
                                  <FileText class="w-3.5 h-3.5 shrink-0 opacity-80" />
                                  <span class="truncate max-w-[130px] font-mono">{msg.attachmentName || 'Attachment'}</span>
                                </div>
                                {resolvedUrls()[msg.id] ? (
                                  <a
                                    href={(() => {
                                      const isFileId = !msg.attachmentUrl!.startsWith('http');
                                      if (isFileId && isAppwriteConfigured()) {
                                        return appwrite.getTicketFileDownload(msg.attachmentUrl!);
                                      }
                                      return resolvedUrls()[msg.id];
                                    })()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={msg.attachmentName || ''}
                                    class={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0 ${isAgent ? 'text-white' : 'text-blue-600'}`}
                                    title="Download attachment"
                                  >
                                    <Download class="w-3.5 h-3.5" />
                                  </a>
                                ) : (
                                  <Loader2 class="w-3 h-3 animate-spin opacity-60" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Lock Warning Banner */}
                  {isLockedByOther && (
                    <div class="mx-4 mb-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 p-2.5 rounded-lg text-xs flex items-center justify-between gap-3 shadow-3xs">
                      <div class="flex items-center gap-2">
                        <Lock class="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
                        <span>
                          <strong>{ticket.lockedByName}</strong> is currently handling this ticket.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleForceUnlock(ticket.id)}
                        class="bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-800 dark:text-amber-300 font-bold px-2 py-1 rounded text-[10px] transition cursor-pointer"
                      >
                        Force Unlock
                      </button>
                    </div>
                  )}

                  {/* Chat Input Footer */}
                  <form onSubmit={handleSendChat} class="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                    {chatFile() && (
                      <div class="flex items-center justify-between bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/30 rounded-lg px-2.5 py-1 text-[10px] text-purple-700 dark:text-purple-400 font-medium">
                        <div class="flex items-center gap-1.5 truncate">
                          <CheckCircle class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span class="truncate max-w-[200px] font-mono">{chatFile().name}</span>
                        </div>
                        <button type="button" onClick={() => setChatFile(null)} class="text-slate-455 hover:text-slate-700 cursor-pointer" disabled={isLockedByOther}>
                          <CloseIcon class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div class="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => setChatFile(e.target.files?.[0] || null)}
                        class="hidden"
                        disabled={isLockedByOther || (!isSuperAdmin() && !myRights()?.canEditTickets)}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef?.click()}
                        disabled={isSending() || isLockedByOther || (!isSuperAdmin() && !myRights()?.canEditTickets)}
                        class="p-2 text-slate-450 hover:text-slate-705 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition shrink-0 cursor-pointer disabled:opacity-50"
                        title="Attach file document"
                      >
                        <Paperclip class="w-4 h-4" />
                      </button>
                      <input
                        type="text"
                        value={chatInput()}
                        onChange={(e) => setChatInput(e.target.value)}
                        onFocus={handleFocusInput}
                        onBlur={handleBlurInput}
                        disabled={isSending() || isLockedByOther || (!isSuperAdmin() && !myRights()?.canEditTickets)}
                        placeholder={
                          isLockedByOther
                            ? `Locked by ${ticket.lockedByName}...`
                            : (!isSuperAdmin() && !myRights()?.canEditTickets)
                            ? 'No edit permissions for tickets.'
                            : ticket.status === 'Closed'
                            ? 'Ticket is closed. Reopen to reply.'
                            : 'Type support reply...'
                        }
                        class="flex-1 bg-slate-55 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 disabled:opacity-60 font-semibold"
                        readOnly={ticket.status === 'Closed' || isLockedByOther || (!isSuperAdmin() && !myRights()?.canEditTickets)}
                      />
                      <button
                        type="submit"
                        disabled={isSending() || isLockedByOther || (!isSuperAdmin() && !myRights()?.canEditTickets) || (ticket.status === 'Closed') || (!chatInput().trim() && !chatFile())}
                        class="p-2 bg-purple-600 hover:bg-purple-750 text-white rounded-lg transition shrink-0 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isSending() ? <Loader2 class="w-4 h-4 animate-spin" /> : <Send class="w-4 h-4" />}
                      </button>
                    </div>
                  </form>
                </>
              );
            })() : (
              <div class="flex-1 flex flex-col items-center justify-center text-center p-8">
                <MessageSquare class="w-12 h-12 text-slate-350 dark:text-slate-750 mb-2.5" />
                <p class="font-bold text-slate-700 dark:text-slate-400 text-xs">Select a Support Ticket</p>
                <p class="text-[11px] text-slate-400 dark:text-slate-550 mt-1 max-w-[240px]">
                  Choose a ticket from the support queue to communicate with the client.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: APP UPDATES */}
      {activeSubTab() === 'UPDATES' && isSuperAdmin && (
        <div class="space-y-6 max-w-2xl mx-auto">
          {/* Card 1: WhatsApp OTP Tester */}
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-left space-y-4">
            <div>
              <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Test WhatsApp OTP Gateway
              </h3>
              <p class="text-xs text-slate-500 mt-1">
                Verify that headless WhatsApp connection is active and can successfully send verification codes.
              </p>
            </div>
            
            <div class="flex flex-col sm:flex-row gap-3">
              <input
                type="tel"
                placeholder="Phone Number (e.g. +919876543210)"
                value={testPhone()}
                onChange={(e) => setTestPhone(e.target.value)}
                class="flex-1 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 transition-colors font-semibold"
              />
              <button
                type="button"
                onClick={handleSendTestOtp}
                disabled={isSendingTestOtp() || !testPhone()}
                class="px-4 py-2 bg-purple-600 hover:bg-purple-750 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm disabled:cursor-not-allowed"
              >
                {isSendingTestOtp() ? (
                  <Loader2 class="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send class="w-3.5 h-3.5" />
                )}
                Send Test OTP
              </button>
            </div>

            {testOtpStatus() && (
              <div class={`p-3 rounded-lg text-xs font-medium border ${
                testOtpStatus().startsWith('Success')
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 border-emerald-200/30'
                  : testOtpStatus().startsWith('Sending')
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/40'
                  : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-450 border-rose-200/30'
              }`}>
                {testOtpStatus()}
              </div>
            )}
          </div>

          {/* Card 2: App Updates */}
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm text-left space-y-6">
            <div>
              <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Publish Application Update
              </h3>
              <p class="text-xs text-slate-500 mt-1">
                Upload a new APK version() and release notes. Logged-in mobile clients will receive update alerts in real-time.
              </p>
            </div>

            <AppUpdateForm
              appUpdateConfig={appUpdateConfig}
              onSaveAppUpdateConfig={onSaveAppUpdateConfig}
              currentUser={currentUser}
            />
          </div>
        </div>
      )}

      {/* OVERRIDE TRUCK SPECS / EXPIRIES MODAL POPUP */}
      {editingTruck() && editingTruckOrgId() && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div class="p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
              <div class="flex items-center gap-2">
                <TruckIcon class="w-5 h-5 text-purple-600" />
                <div>
                  <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">Override Compliance Parameters</h3>
                  <p class="text-[11px] text-slate-500">Truck: <span class="font-mono font-bold text-purple-600">{editingTruck().truckNo}</span> ({editingTruckOrgId()})</p>
                </div>
              </div>
              <button
                onClick={() => { setEditingTruck(null); setEditingTruckOrgId(null); }}
                class="text-slate-400 hover:text-slate-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div class="p-5 space-y-4 max-h-[400px] overflow-y-auto">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operational Status</label>
                  <select
                    value={editingTruck().status}
                    onChange={(e) => setEditingTruck({ ...editingTruck(), status: e.target.value as any })}
                    class="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="Active">Operational (Active)</option>
                    <option value="Inactive">Under Maintenance (Inactive)</option>
                    <option value="Admin Disabled">Admin Disabled (Locked)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Current Odometer (KM) <span class="text-[9px] font-normal text-slate-400 capitalize">(read-only)</span></label>
                  <input
                    type="number"
                    value={editingTruck().currentKM || ''}
                    disabled
                    class="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2.5 py-1 text-xs font-mono cursor-not-allowed focus:outline-none"
                  />
                </div>
              </div>

              <div class="border-t border-slate-100 dark:border-slate-800 my-2 pt-3">
                <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Compliance Expiry Dates (Read-Only)</span>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Insurance Expiry</label>
                    <input
                      type="date"
                      value={editingTruck().insuranceDate || ''}
                      disabled
                      class="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Fitness Cert (FC)</label>
                    <input
                      type="date"
                      value={editingTruck().fcDate || ''}
                      disabled
                      class="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Quarterly Tax (Q Tax)</label>
                    <input
                      type="date"
                      value={editingTruck().qTaxDate || ''}
                      disabled
                      class="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Green Tax Cert</label>
                    <input
                      type="date"
                      value={editingTruck().greenTaxDate || ''}
                      disabled
                      class="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2.5 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">National Permit Tax</label>
                    <input
                      type="date"
                      value={editingTruck().npTaxDate || ''}
                      disabled
                      class="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2.5 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">5 Year Permit Date</label>
                    <input
                      type="date"
                      value={editingTruck().fiveYearPermitDate || ''}
                      disabled
                      class="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2.5 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Subscription Expiry</label>
                    <input
                      type="date"
                      value={editingTruck().registrationExpiryDate || ''}
                      disabled
                      class="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-855 text-slate-500 dark:text-slate-400 rounded px-2.5 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div class="border-t border-slate-100 dark:border-slate-800 my-2 pt-3">
                <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Subscription Renewal</span>
                <div class="flex items-center gap-3 bg-purple-500/5 border border-purple-500/10 p-3 rounded-lg">
                  <div class="flex-1">
                    <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Select Renewal Duration</label>
                    <select
                      disabled={!canEditBackend()}
                      value={renewalDuration()}
                      onChange={(e) => setRenewalDuration(e.target.value as any)}
                      class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-855 dark:text-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none mb-1"
                    >
                      <option value="1M">1 Month</option>
                      <option value="3M">3 Months</option>
                      <option value="6M">6 Months</option>
                      <option value="1Y">1 Year</option>
                    </select>
                    <span class="text-[10px] font-mono text-purple-600 dark:text-purple-400 block mt-1">
                      Projected Expiry: {formatToDisplayDate(getNextExpiryDate(editingTruck(), renewalDuration()))}
                    </span>
                  </div>
                  <div class="pt-4 shrink-0">
                    <button
                      type="button"
                      disabled={!canEditBackend()}
                      onClick={handleRenewInModal}
                      class="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Renew Subscription
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="p-4 bg-slate-50 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setEditingTruck(null); setEditingTruckOrgId(null); }}
                class="px-4 py-2 border border-slate-200 text-slate-500 rounded text-xs font-bold transition hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AppUpdateFormProps {
  appUpdateConfig: any;
  onSaveAppUpdateConfig?: (config: any) => Promise<void>;
  currentUser?: any;
}

const getNextVersion = (ver?: string) => {
  if (!ver) return '1.0.1';
  const parts = ver.split('.').map(Number);
  if (parts.length >= 3) {
    parts[2] = parts[2] + 1;
    return parts.join('.');
  }
  return ver + '.1';
};

function AppUpdateForm({ appUpdateConfig, onSaveAppUpdateConfig, currentUser }: AppUpdateFormProps) {
  const [version, setVersion] = createSignal(getNextVersion(appUpdateConfig?.version));
  const [releaseNotes, setReleaseNotes] = createSignal(appUpdateConfig?.releaseNotes || '');
  const [downloadUrl, setDownloadUrl] = createSignal('');
  const [apkFile, setApkFile] = createSignal<File | null>(null);
  const [isUploading, setIsUploading] = createSignal(false);

  createEffect(() => {
    if (appUpdateConfig?.version) {
      setVersion(getNextVersion(appUpdateConfig.version));
      setReleaseNotes(appUpdateConfig.releaseNotes || '');
      setDownloadUrl('');
      setApkFile(null);
    }
  });

  const handlePublish = async (e: Event) => {
    e.preventDefault();
    if (!version().trim()) {
      alert("Version is required.");
      return;
    }
    if (!apkFile() && !downloadUrl().trim()) {
      alert("Failed to publish: You must either upload an APK file or configure a Download URL Link.");
      return;
    }

    setIsUploading(true);
    let finalDownloadUrl = downloadUrl();
    let newFileId: string | undefined = undefined;

    try {
      if (apkFile()) {
        if (isAppwriteConfigured()) {
          // Upload APK to Appwrite Storage
          const fileId = await appwrite.uploadFile(apkFile(), `app_update_${version().replace(/\./g, '_')}`);
          newFileId = fileId;
          finalDownloadUrl = appwrite.getFileDownload(fileId);
          setDownloadUrl(finalDownloadUrl);
        } else {
          // Fallback if Appwrite is not configured
          finalDownloadUrl = URL.createObjectURL(apkFile());
          setDownloadUrl(finalDownloadUrl);
        }
      }

      const oldVersion = appUpdateConfig?.version || 'None';
      const notesToPublish = releaseNotes().trim() || 
        "[New] Premium tabbed Trip Details view for mobile screens\n" +
        "[New] Vertical route stepper timeline showing segment info\n" +
        "[New] Visual profit vs expense progress ratio chart indicator\n" +
        "[New] Driver balance ledger cards and settlements panel\n" +
        "[Changed] Replaced the complex desktop-first 23-column layout on mobile\n" +
        "[Changed] Redesigned backend release logs into modern history cards\n" +
        "[Fixed] Restructured update modal activation to prevent overlay issues on desktop";
      
      const historyEntry = {
        version: version().trim(),
        oldVersion: oldVersion,
        downloadUrl: finalDownloadUrl.trim(),
        fileId: newFileId,
        releaseNotes: notesToPublish,
        uploadedBy: currentUser?.email || 'System Admin',
        updatedAt: new Date().toISOString()
      };

      const existingHistory = Array.isArray(appUpdateConfig?.history) ? appUpdateConfig.history : [];
      let updatedHistory = [historyEntry, ...existingHistory];

      // Helper to parse file ID from download URLs if not explicitly stored
      const getFileIdFromUrl = (url: string) => {
        const match = url.match(/\/files\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
      };

      // Clean up older APKs: Keep at most 3 APK files on Appwrite
      if (isAppwriteConfigured()) {
        let apkCount = 0;
        const processedHistory = await Promise.all(
          updatedHistory.map(async (entry: any) => {
            const fileId = entry.fileId || getFileIdFromUrl(entry.downloadUrl);
            if (fileId) {
              apkCount++;
              if (apkCount > 3) {
                // Delete the 4th or older APK file from Appwrite Storage
                console.log(`Deleting old Appwrite APK file: ${fileId} for version() ${entry.version}`);
                await appwrite.deleteFile(fileId);
                return {
                  ...entry,
                  fileId: undefined,
                  downloadUrl: '',
                  releaseNotes: entry.releaseNotes + ' (APK file deleted to free storage size)'
                };
              } else {
                return {
                  ...entry,
                  fileId
                };
              }
            }
            return entry;
          })
        );
        updatedHistory = processedHistory;
      }

      // If the currently active APK was deleted from history (i.e. if active downloadUrl() was reset), update it
      const currentActiveEntry = updatedHistory.find(h => h.version === version().trim());
      const activeDownloadUrl = currentActiveEntry?.downloadUrl || finalDownloadUrl.trim();

      if (onSaveAppUpdateConfig) {
        await onSaveAppUpdateConfig({
          version: version().trim(),
          releaseNotes: notesToPublish,
          downloadUrl: activeDownloadUrl,
          updatedAt: new Date().toISOString(),
          history: updatedHistory
        });
        
        // Auto-clear local changelog file in local dev environment
        try {
          const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === 'local.lorryguru.in'
            ? `${window.location.protocol}//${window.location.hostname}:5000`
            : `${window.location.origin}/api`;
          await fetch(`${backendUrl}/api/dev/clear-changelog`, { method: 'POST' });
        } catch (e) {
          console.warn("Auto-clearing local changelog failed (expected in production):", e);
        }

        alert("App update published successfully!");
        setApkFile(null);
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to publish update: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };
  return (
    <form onSubmit={handlePublish} class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-[10px] font-bold text-slate-505 uppercase mb-1">Latest Version Number</label>
          <input
            type="text"
            placeholder="e.g. 1.0.1"
            value={version()}
            onChange={(e) => setVersion(e.target.value)}
            class="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-purple-500"
            required
          />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-505 uppercase mb-1">Upload New APK File</label>
          <input
            type="file"
            accept=".apk"
            onChange={(e) => setApkFile(e.target.files?.[0] || null)}
            class="w-full text-xs text-slate-655 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
          />
        </div>
      </div>

      <div>
        <label class="block text-[10px] font-bold text-slate-505 uppercase mb-1">Download URL Link (Auto-Generated or Custom)</label>
        <input
          type="url"
          placeholder="Direct URL link to download APK if not uploading file"
          value={downloadUrl()}
          onChange={(e) => setDownloadUrl(e.target.value)}
          class="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-purple-505"
        />
      </div>

      <div>
        <div class="flex justify-between items-center mb-1">
          <label class="block text-[10px] font-bold text-slate-505 uppercase">Release Changelog Notes</label>
          {(window.location.hostname === 'localhost' || window.location.hostname === 'local.lorryguru.in') && (
            <button
              type="button"
              onClick={async () => {
                if (window.confirm("Are you sure you want to clear the local changelog file?")) {
                  try {
                    const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === 'local.lorryguru.in'
                      ? `${window.location.protocol}//${window.location.hostname}:5000`
                      : `${window.location.origin}/api`;
                    const res = await fetch(`${backendUrl}/api/dev/clear-changelog`, { method: 'POST' });
                    if (res.ok) {
                      setReleaseNotes('');
                      alert("Local changelog cleared successfully!");
                    } else {
                      alert("Failed to clear local changelog file.");
                    }
                  } catch (err: any) {
                    alert("Error: " + err.message);
                  }
                }
              }}
              class="text-[9px] font-bold text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-955/20 px-2 py-0.5 rounded transition cursor-pointer"
            >
              Clear Local Changelog File
            </button>
          )}
        </div>
        <textarea
          rows={4}
          placeholder="Describe features, bug fixes, or improvements in this release..."
          value={releaseNotes()}
          onChange={(e) => setReleaseNotes(e.target.value)}
          class="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded px-3 py-2 text-xs focus:outline-none focus:border-purple-505"
        />
      </div>

      <button
        type="submit"
        disabled={isUploading()}
        class="w-full py-2.5 bg-purple-600 hover:bg-purple-750 text-white rounded-lg font-bold text-xs transition shadow-md shadow-purple-500/10 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {isUploading() ? <Loader2 class="w-4 h-4 animate-spin" /> : <Download class="w-4 h-4" />}
        <span>{isUploading() ? "Uploading & Publishing Update..." : "Publish Release Update"}</span>
      </button>

      {appUpdateConfig && (
        <div class="border-t border-slate-150 dark:border-slate-800 pt-4 space-y-4 text-xs">
          <div>
            <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">
              Currently Active Release
            </span>
            <div class="bg-slate-50 dark:bg-slate-955/40 p-4 rounded-xl border border-slate-100 dark:border-slate-850 space-y-2">
              <p><strong>Active Version:</strong> <span class="font-mono text-purple-655 font-bold">v{appUpdateConfig.version}</span></p>
              {appUpdateConfig.updatedAt && (
                <p><strong>Published Date:</strong> {new Date(appUpdateConfig.updatedAt).toLocaleString()}</p>
              )}
              
              <div class="border-t border-slate-100 dark:border-slate-850 pt-2 mt-2">
                <strong class="block mb-1">Download Link:</strong>
                <div class="flex items-center gap-2 justify-between bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-2.5 rounded-lg">
                  <span class="truncate font-mono text-purple-600 dark:text-purple-400 select-all font-semibold">{appUpdateConfig.downloadUrl}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(appUpdateConfig.downloadUrl);
                      alert("Download link copied to clipboard!");
                    }}
                    class="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-400 rounded-md font-bold text-[10px] transition cursor-pointer shrink-0"
                  >
                    Copy Link
                  </button>
                </div>
              </div>

              {appUpdateConfig.releaseNotes && (
                <div class="border-t border-slate-100 dark:border-slate-855 pt-2 mt-2">
                  <strong>Release Notes:</strong>
                  {renderChangelog(appUpdateConfig.releaseNotes)}
                </div>
              )}
            </div>
          </div>

          {Array.isArray(appUpdateConfig.history) && appUpdateConfig.history.length > 0 && (
            <div class="space-y-3.5">
              <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Update & Rollback History Logs
              </span>
              <div class="space-y-3">
                {appUpdateConfig.history.map((h: any, idx: number) => {
                  const isActive = h.version === appUpdateConfig.version;
                  return (
                    <div 
                       
                      class={`p-4 rounded-xl border transition-all ${
                        isActive 
                          ? 'bg-purple-50/20 border-purple-200 dark:bg-purple-955/10 dark:border-purple-900/40 shadow-xs' 
                          : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                      }`}
                    >
                      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs">
                        <div class="flex items-center gap-2">
                          <span class="font-mono text-sm font-black text-purple-600 dark:text-purple-400">
                            v{h.version}
                          </span>
                          {isActive && (
                            <span class="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[9px] rounded-md font-bold uppercase tracking-wider">
                              Active
                            </span>
                          )}
                        </div>
                        <div class="flex items-center gap-1.5 text-slate-400 font-medium">
                          <span>Uploaded by: <strong class="text-slate-650 dark:text-slate-350">{h.uploadedBy || 'Admin'}</strong></span>
                          <span>•</span>
                          <span>{new Date(h.updatedAt).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Notes Section - Full notes layout that lists changes cleanly */}
                      <div class="py-3 text-xs leading-relaxed text-slate-650 dark:text-slate-355">
                        <strong class="block text-[10px] uppercase text-slate-400 font-bold mb-1">Changelog / Release Notes:</strong>
                        {renderChangelog(h.releaseNotes)}
                      </div>

                      {/* Actions */}
                      <div class="flex justify-between items-center pt-2.5 border-t border-slate-100/60 dark:border-slate-800/60 text-xs">
                        <span class="text-[10px] text-slate-400 italic">
                          {h.oldVersion && h.oldVersion !== 'None' ? `Replaces: v${h.oldVersion}` : 'Initial Config'}
                        </span>
                        <div class="flex items-center gap-2">
                          {h.downloadUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(h.downloadUrl);
                                alert("Download link copied to clipboard!");
                              }}
                              class="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Copy Link
                            </button>
                          )}
                          {!isActive && h.downloadUrl && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Are you sure you want to rollback/activate version() v${h.version}? All client apps running other versions will be prompted to update/revert to this version().`)) {
                                  if (onSaveAppUpdateConfig) {
                                    await onSaveAppUpdateConfig({
                                      version: h.version,
                                      releaseNotes: h.releaseNotes,
                                      downloadUrl: h.downloadUrl,
                                      updatedAt: new Date().toISOString(),
                                      history: appUpdateConfig.history
                                    });
                                  }
                                }
                              }}
                              class="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-955/20 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-450 rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Rollback & Activate
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
