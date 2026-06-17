import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

interface BackendDashboardProps {
  organizationProfiles: OrganizationProfile[];
  userRightsList: UserPermission[];
  trucks: Truck[];
  onUpdateOrgStatus: (orgId: string, status: 'Active' | 'Disabled') => void;
  onUpdateOrgLimit: (orgId: string, limit: number) => void;
  onApproveTruckRequest: (orgId: string, requestId: string, truckNo: string, duration?: '1M' | '3M' | '6M' | '1Y') => void;
  onRejectTruckRequest: (orgId: string, requestId: string, fallbackTruckNo?: string) => void;
  onUpdateTruckDetails: (orgId: string, truck: Truck) => void;
  logAction: (action: 'Created' | 'Edited' | 'Deleted' | 'Cloud' | 'Approved' | 'Rejected', category: string, reference: string, details: string) => void;
  canEditBackend?: boolean;
  canApproveBackend?: boolean;
  canAddBackend?: boolean;
  canDeleteBackend?: boolean;
  canViewBackend?: boolean;
  canViewTruckRequests?: boolean;
  canViewDatabaseConsole?: boolean;
  canEditDatabaseConsole?: boolean;
  canDeleteDatabaseConsole?: boolean;

  // Props for raw JSON console
  drivers: Driver[];
  offices: Office[];
  accounts: Account[];
  trips: TripEntry[];
  expenses: ExpenseEntry[];
  tyres: Tyre[];
  auditLogs: AuditLog[];

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
  supportTickets?: SupportTicket[];
  onSaveSupportTickets?: (tickets: SupportTicket[]) => void;
  currentUser?: any;
  activeTicketId?: string | null;
  onSetActiveTicketId?: (id: string | null) => void;
  payments?: any[];
  onInitiateRefund?: (orgId: string, truckNo: string, paymentRecord: any) => Promise<void>;
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

export default function BackendDashboard({
  organizationProfiles,
  userRightsList,
  trucks,
  onUpdateOrgStatus,
  onUpdateOrgLimit,
  onApproveTruckRequest,
  onRejectTruckRequest,
  onUpdateTruckDetails,
  logAction,
  canEditBackend = true,
  canApproveBackend = true,
  canAddBackend = true,
  canDeleteBackend = true,
  canViewBackend = true,
  canViewTruckRequests = true,
  canViewDatabaseConsole = true,
  canEditDatabaseConsole = true,
  canDeleteDatabaseConsole = true,

  drivers,
  offices,
  accounts,
  trips,
  expenses,
  tyres,
  auditLogs,
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
  supportTickets = [],
  onSaveSupportTickets,
  currentUser,
  activeTicketId,
  onSetActiveTicketId,
  payments = [],
  onInitiateRefund
}: BackendDashboardProps) {
  const myRights = userRightsList.find(u => u.email === currentUser?.email);
  const mySupportRoles = Array.isArray(myRights?.supportRole)
    ? myRights.supportRole
    : (typeof myRights?.supportRole === 'string' && myRights.supportRole !== 'None' && myRights.supportRole !== ''
      ? [myRights.supportRole]
      : []);
  const hasSupportRole = mySupportRoles.length > 0;
  const myCanTransfer = myRights?.canTransferTickets || false;
  const isSuperAdmin = myRights?.role === 'SuperAdmin';

  const [activeSubTab, setActiveSubTab] = useState<'ORGANIZATIONS' | 'REQUESTS' | 'RAW_DATA' | 'TICKETS'>(() => {
    if (canViewBackend !== false) return 'ORGANIZATIONS';
    if (canViewTruckRequests !== false) return 'REQUESTS';
    if (canViewDatabaseConsole !== false) return 'RAW_DATA';
    if (isSuperAdmin || (myRights?.canViewTickets && hasSupportRole)) return 'TICKETS';
    return 'ORGANIZATIONS';
  });

  useEffect(() => {
    const hasAccess = (tab: typeof activeSubTab) => {
      if (tab === 'ORGANIZATIONS') return !!canViewBackend;
      if (tab === 'REQUESTS') return !!canViewTruckRequests;
      if (tab === 'RAW_DATA') return !!canViewDatabaseConsole;
      if (tab === 'TICKETS') return !!(isSuperAdmin || (myRights?.canViewTickets && hasSupportRole));
      return false;
    };

    if (!hasAccess(activeSubTab)) {
      if (canViewBackend) setActiveSubTab('ORGANIZATIONS');
      else if (canViewTruckRequests) setActiveSubTab('REQUESTS');
      else if (canViewDatabaseConsole) setActiveSubTab('RAW_DATA');
      else if (isSuperAdmin || (myRights?.canViewTickets && hasSupportRole)) setActiveSubTab('TICKETS');
    }
  }, [activeSubTab, canViewBackend, canViewTruckRequests, canViewDatabaseConsole, isSuperAdmin, myRights?.canViewTickets, hasSupportRole]);
  const [orgSearch, setOrgSearch] = useState('');
  const [requestSearch, setRequestSearch] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [editingTruckOrgId, setEditingTruckOrgId] = useState<string | null>(null);
  const [renewalDuration, setRenewalDuration] = useState<'1M' | '3M' | '6M' | '1Y'>('1Y');
  const [rowDurations, setRowDurations] = useState<Record<string, '1M' | '3M' | '6M' | '1Y'>>({});

  // States for raw JSON console
  const [selectedCollection, setSelectedCollection] = useState<'trips' | 'trucks' | 'drivers' | 'offices' | 'accounts' | 'expenses' | 'tyres' | 'auditLogs' | 'userRights' | 'organizationProfiles'>('trips');
  const [consoleOrgFilter, setConsoleOrgFilter] = useState<string>('ALL');
  const [consoleSearchQuery, setConsoleSearchQuery] = useState<string>('');
  const [jsonEditorRecord, setJsonEditorRecord] = useState<any | null>(null);
  const [jsonEditorContent, setJsonEditorContent] = useState<string>('');
  const [jsonEditorIsValid, setJsonEditorIsValid] = useState<boolean>(true);
  const [jsonEditorError, setJsonEditorError] = useState<string | null>(null);
  const [isAddingNewRecord, setIsAddingNewRecord] = useState<boolean>(false);

  // Support Tickets States
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTicket = supportTickets.find((t) => t.id === selectedTicketId);

  // Synchronize active ticket ID to parent component for silencing notifications
  useEffect(() => {
    if (onSetActiveTicketId) {
      onSetActiveTicketId(selectedTicketId);
    }
  }, [selectedTicketId, onSetActiveTicketId]);

  // Keep latest refs to prevent stale closure capturing
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const supportTicketsRef = useRef(supportTickets);
  useEffect(() => { supportTicketsRef.current = supportTickets; }, [supportTickets]);

  const onSaveSupportTicketsRef = useRef(onSaveSupportTickets);
  useEffect(() => { onSaveSupportTicketsRef.current = onSaveSupportTickets; }, [onSaveSupportTickets]);

  const lockedTicketIdRef = useRef<string | null>(null);

  // Release lock on unmount or ticket change
  useEffect(() => {
    return () => {
      if (lockedTicketIdRef.current && onSaveSupportTicketsRef.current) {
        const email = currentUserRef.current?.email || 'agent@support.com';
        const tickets = supportTicketsRef.current;
        const ticketId = lockedTicketIdRef.current;
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
          onSaveSupportTicketsRef.current(nextTickets);
        }
        lockedTicketIdRef.current = null;
      }
    };
  }, [selectedTicketId]);

  const handleFocusInput = () => {
    const email = currentUser?.email || 'agent@support.com';
    const name = currentUser?.name || currentUser?.email || 'Support Agent';
    if (selectedTicketId && onSaveSupportTickets) {
      const ticket = supportTickets.find(t => t.id === selectedTicketId);
      if (ticket && (!ticket.lockedByEmail || ticket.lockedByEmail === email)) {
        lockedTicketIdRef.current = selectedTicketId;
        const nextTickets = supportTickets.map(t => {
          if (t.id === selectedTicketId) {
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
    if (selectedTicketId && onSaveSupportTickets) {
      const ticket = supportTickets.find(t => t.id === selectedTicketId);
      if (ticket && ticket.lockedByEmail === email) {
        lockedTicketIdRef.current = null;
        const nextTickets = supportTickets.map(t => {
          if (t.id === selectedTicketId) {
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
  useEffect(() => {
    const handleBeforeUnload = () => {
      const email = currentUserRef.current?.email || 'agent@support.com';
      if (selectedTicketId && onSaveSupportTicketsRef.current) {
        const tickets = supportTicketsRef.current;
        const ticket = tickets.find(t => t.id === selectedTicketId);
        if (ticket && ticket.lockedByEmail === email) {
          const nextTickets = tickets.map(t => {
            if (t.id === selectedTicketId) {
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
          onSaveSupportTicketsRef.current(nextTickets);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [selectedTicketId]);

  const handleForceUnlock = (ticketId: string) => {
    if (!onSaveSupportTickets) return;
    const email = currentUser?.email || 'agent@support.com';
    const nextTickets = supportTickets.map(t => {
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
  useEffect(() => {
    if (selectedTicket) {
      const msgs = selectedTicket.messages || [];
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        localStorage.setItem(`ttt_tkt_agent_read_${selectedTicket.id}`, lastMsg.id);
      } else {
        localStorage.setItem(`ttt_tkt_agent_read_${selectedTicket.id}`, 'read');
      }
    }
  }, [selectedTicket, selectedTicket?.messages]);

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
    if (!isSuperAdmin && !myRights?.canViewTickets) return 0;
    const filtered = supportTickets.filter(t => {
      if (isSuperAdmin) return true;
      return mySupportRoles.includes(t.assignedTeam as any);
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
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.messages]);

  // Pre-resolve file URLs for attachments in the current ticket
  useEffect(() => {
    if (!selectedTicket) return;
    const newUrls = { ...resolvedUrls };
    let changed = false;
    const messages = Array.isArray(selectedTicket.messages) ? selectedTicket.messages : [];
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
  }, [selectedTicket]);

  const handleTransferTicket = (ticketId: string, newTeam: 'Technical' | 'Billing' | 'General') => {
    if (!onSaveSupportTickets) return;
    const ticket = supportTickets.find(t => t.id === ticketId);
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

    const nextTickets = supportTickets.map(t => {
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
    const nextTickets = supportTickets.filter(t => t.id !== ticketId);
    onSaveSupportTickets(nextTickets);
    setSelectedTicketId(null);
    logAction('Deleted', 'SupportTicket', ticketId, `Deleted support ticket`);
  };

  const handleUpdateTicketStatus = (ticketId: string, newStatus: 'Open' | 'In Progress' | 'Closed') => {
    if (!onSaveSupportTickets) return;
    const agentEmail = currentUser?.email || 'agent@support.com';
    const nextTickets = supportTickets.map(t => {
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

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || (!chatInput.trim() && !chatFile) || !onSaveSupportTickets) return;

    setIsSending(true);
    try {
      let attachmentUrl = '';
      let attachmentName = '';
      if (chatFile) {
        if (isAppwriteConfigured()) {
          const customName = `ticket_attach_${selectedTicketId}_${Date.now()}`;
          attachmentUrl = await appwrite.uploadTicketFile(chatFile, customName);
          attachmentName = chatFile.name;
        } else {
          attachmentUrl = 'mock-url-configured';
          attachmentName = chatFile.name;
        }
      }

      const newMessage = {
        id: `msg-${Date.now()}`,
        sender: 'Agent' as const,
        senderName: currentUser?.name || currentUser?.email || 'Support Agent',
        senderEmail: currentUser?.email || 'agent@support.com',
        content: chatInput,
        timestamp: new Date().toISOString(),
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
      };

      const nextTickets = supportTickets.map(t => {
        if (t.id === selectedTicketId) {
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
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      alert('Failed to send support reply message.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredTickets = supportTickets.filter(t => {
    if (isSuperAdmin) return true;
    if (!myRights?.canViewTickets) return false;
    return mySupportRoles.includes(t.assignedTeam as any);
  });

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
    if (selectedCollection === 'trips') return `${item.tripNo || 'No Trip No'} (${item.truckNo || 'No Truck No'}) - ${item.driverName || 'No Driver'}`;
    if (selectedCollection === 'trucks') return `${item.truckNo || 'No Truck No'} - ${item.ownerName || 'No Owner'}`;
    if (selectedCollection === 'drivers') return item.driverName || 'No Name';
    if (selectedCollection === 'offices') return `${item.officeName || 'No Name'} (${item.city || 'No City'})`;
    if (selectedCollection === 'accounts') return `${item.accountName || 'No Name'} (${item.type || 'No Type'})`;
    if (selectedCollection === 'expenses') return `${item.expenseType || 'No Type'} - ₹${item.amount || 0} (${item.truckNo || 'No Truck'})`;
    if (selectedCollection === 'tyres') return `${item.tyreNo || 'No Serial'} (${item.manufacturer || 'No Manufacturer'}) - ${item.status || 'No Status'}`;
    if (selectedCollection === 'auditLogs') return `[${item.timestamp || 'No Timestamp'}] ${item.user || 'System'} - ${item.action || 'Action'} ${item.category || ''} (${item.reference || ''})`;
    if (selectedCollection === 'userRights') return `${item.name || 'No Name'} (${item.email || 'No Email'}) [${item.role || 'No Role'}]`;
    if (selectedCollection === 'organizationProfiles') return `${item.organizationName || 'No Name'} (${item.ownerEmail || 'No Owner'})`;
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
    const template = { ...SCHEMA_TEMPLATES[selectedCollection] };
    if (consoleOrgFilter !== 'ALL' && 'organizationId' in template) {
      (template as any).organizationId = consoleOrgFilter;
    }
    setJsonEditorRecord(template);
    const content = JSON.stringify(template, null, 2);
    setJsonEditorContent(content);
    setJsonEditorIsValid(true);
    setJsonEditorError(null);
  };

  const handleSaveConsoleRecord = async () => {
    if (isAddingNewRecord && !canEditDatabaseConsole) {
      alert("Permission Denied: You do not have permissions to add records.");
      return;
    }
    if (!isAddingNewRecord && !canEditDatabaseConsole) {
      alert("Permission Denied: You do not have permissions to edit records.");
      return;
    }
    if (!jsonEditorIsValid) return;
    try {
      const parsedRecord = JSON.parse(jsonEditorContent);

      if (isAddingNewRecord) {
        if (!parsedRecord.id && selectedCollection !== 'organizationProfiles') {
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
          }[selectedCollection] || 'id_';
          parsedRecord.id = prefix + Date.now();
        }

        if (selectedCollection === 'trips') onSaveTrips([parsedRecord, ...trips]);
        else if (selectedCollection === 'trucks') onSaveTrucks([parsedRecord, ...trucks]);
        else if (selectedCollection === 'drivers') onSaveDrivers([parsedRecord, ...drivers]);
        else if (selectedCollection === 'offices') onSaveOffices([parsedRecord, ...offices]);
        else if (selectedCollection === 'accounts') onSaveAccounts([parsedRecord, ...accounts]);
        else if (selectedCollection === 'expenses') onSaveExpenses([parsedRecord, ...expenses]);
        else if (selectedCollection === 'tyres') onSaveTyres([parsedRecord, ...tyres]);
        else if (selectedCollection === 'auditLogs') onSaveAuditLogs([parsedRecord, ...auditLogs]);
        else if (selectedCollection === 'userRights') onSaveUserRightsList([parsedRecord, ...userRightsList]);
        else if (selectedCollection === 'organizationProfiles') await onSaveOrganizationProfiles([parsedRecord, ...organizationProfiles]);

        logAction('Created', selectedCollection, parsedRecord.id || parsedRecord.organizationId, `Super Admin created raw JSON record`);
      } else {
        const recordId = parsedRecord.id || parsedRecord.organizationId;

        if (selectedCollection === 'trips') {
          onSaveTrips(trips.map(t => t.id === recordId ? parsedRecord : t));
        } else if (selectedCollection === 'trucks') {
          onSaveTrucks(trucks.map(t => t.id === recordId ? parsedRecord : t));
        } else if (selectedCollection === 'drivers') {
          onSaveDrivers(drivers.map(d => d.id === recordId ? parsedRecord : d));
        } else if (selectedCollection === 'offices') {
          onSaveOffices(offices.map(o => o.id === recordId ? parsedRecord : o));
        } else if (selectedCollection === 'accounts') {
          onSaveAccounts(accounts.map(a => a.id === recordId ? parsedRecord : a));
        } else if (selectedCollection === 'expenses') {
          onSaveExpenses(expenses.map(e => e.id === recordId ? parsedRecord : e));
        } else if (selectedCollection === 'tyres') {
          onSaveTyres(tyres.map(ty => ty.id === recordId ? parsedRecord : ty));
        } else if (selectedCollection === 'auditLogs') {
          onSaveAuditLogs(auditLogs.map(log => log.id === recordId ? parsedRecord : log));
        } else if (selectedCollection === 'userRights') {
          onSaveUserRightsList(userRightsList.map(rights => rights.id === recordId ? parsedRecord : rights));
        } else if (selectedCollection === 'organizationProfiles') {
          await onSaveOrganizationProfiles(organizationProfiles.map(p => p.organizationId === recordId ? parsedRecord : p));
        }

        logAction('Edited', selectedCollection, recordId, `Super Admin modified raw JSON record`);
      }

      setJsonEditorRecord(null);
    } catch (e: any) {
      alert(`Error saving record: ${e.message}`);
    }
  };

  const handleDeleteConsoleRecord = async (recordToDelete: any) => {
    if (!canDeleteDatabaseConsole) {
      alert("Permission Denied: You do not have permissions to delete records.");
      return;
    }
    const recordId = recordToDelete.id || recordToDelete.organizationId;
    const label = getRecordLabel(recordToDelete);

    if (!confirm(`Are you absolutely sure you want to delete this record?\n\nCollection: ${selectedCollection}\nIdentifier: ${label}\n\nWarning: This action cannot be undone.`)) {
      return;
    }

    try {
      if (selectedCollection === 'trips') {
        onSaveTrips(trips.filter(t => t.id !== recordId));
      } else if (selectedCollection === 'trucks') {
        onSaveTrucks(trucks.filter(t => t.id !== recordId));
      } else if (selectedCollection === 'drivers') {
        onSaveDrivers(drivers.filter(d => d.id !== recordId));
      } else if (selectedCollection === 'offices') {
        onSaveOffices(offices.filter(o => o.id !== recordId));
      } else if (selectedCollection === 'accounts') {
        onSaveAccounts(accounts.filter(a => a.id !== recordId));
      } else if (selectedCollection === 'expenses') {
        onSaveExpenses(expenses.filter(e => e.id !== recordId));
      } else if (selectedCollection === 'tyres') {
        onSaveTyres(tyres.filter(ty => ty.id !== recordId));
      } else if (selectedCollection === 'auditLogs') {
        onSaveAuditLogs(auditLogs.filter(log => log.id !== recordId));
      } else if (selectedCollection === 'userRights') {
        onSaveUserRightsList(userRightsList.filter(rights => rights.id !== recordId));
      } else if (selectedCollection === 'organizationProfiles') {
        await onSaveOrganizationProfiles(organizationProfiles.filter(p => p.organizationId !== recordId));
      }

      logAction('Deleted', selectedCollection, recordId, `Super Admin deleted raw JSON record`);
    } catch (e: any) {
      alert(`Error deleting record: ${e.message}`);
    }
  };

  // Get active dataset
  let activeDataset: any[] = [];
  if (selectedCollection === 'trips') activeDataset = trips || [];
  else if (selectedCollection === 'trucks') activeDataset = trucks || [];
  else if (selectedCollection === 'drivers') activeDataset = drivers || [];
  else if (selectedCollection === 'offices') activeDataset = offices || [];
  else if (selectedCollection === 'accounts') activeDataset = accounts || [];
  else if (selectedCollection === 'expenses') activeDataset = expenses || [];
  else if (selectedCollection === 'tyres') activeDataset = tyres || [];
  else if (selectedCollection === 'auditLogs') activeDataset = auditLogs || [];
  else if (selectedCollection === 'userRights') activeDataset = userRightsList || [];
  else if (selectedCollection === 'organizationProfiles') activeDataset = organizationProfiles || [];

  // Filter by organization if applicable and active
  const filteredByOrg = activeDataset.filter(item => {
    if (consoleOrgFilter === 'ALL') return true;
    const itemOrgId = item.organizationId || item.orgId;
    if (itemOrgId) {
      return itemOrgId === consoleOrgFilter;
    }
    if (selectedCollection === 'organizationProfiles') {
      return item.organizationId === consoleOrgFilter;
    }
    return true;
  });

  // Filter by search query
  const filteredConsoleRecords = filteredByOrg.filter(item => {
    if (!consoleSearchQuery) return true;
    const query = consoleSearchQuery.toLowerCase();
    const idStr = String(item.id || item.organizationId || '').toLowerCase();
    const labelStr = getRecordLabel(item).toLowerCase();
    return idStr.includes(query) || labelStr.includes(query);
  });

  const uniqueOrgIds = Array.from(new Set([
    ...organizationProfiles.map(p => p.organizationId),
    ...trucks.map(t => t.organizationId).filter(Boolean),
    ...trips.map(t => t.organizationId).filter(Boolean)
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
    if (!editingTruck || !editingTruckOrgId) return;
    const nextExpiryStr = getNextExpiryDate(editingTruck, renewalDuration);
    const updatedTruck: Truck = {
      ...editingTruck,
      registrationExpiryDate: nextExpiryStr,
      status: 'Active'
    };
    onUpdateTruckDetails(editingTruckOrgId, updatedTruck);
    logAction(
      'Edited',
      'Truck',
      editingTruck.truckNo,
      `Renewed subscription by ${renewalDuration} to ${nextExpiryStr} and enabled status for Org ${editingTruckOrgId}`
    );
    setEditingTruck(updatedTruck);
  };

  // Exclude the backend organization itself from the control list
  const filteredOrgs = organizationProfiles.filter(p =>
    p.organizationId !== 'org_backend' &&
    ((p.organizationName || '').toLowerCase().includes(orgSearch.toLowerCase()) ||
      (p.organizationId || '').toLowerCase().includes(orgSearch.toLowerCase()) ||
      (p.ownerEmail || '').toLowerCase().includes(orgSearch.toLowerCase()))
  );

  // Flatten all truck requests across all organizations
  const allRequests = organizationProfiles.flatMap(profile =>
    (profile.truckRequests || []).map(req => ({
      ...req,
      orgId: profile.organizationId || '',
      orgName: profile.organizationName || ''
    }))
  ).sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());

  const filteredRequests = allRequests.filter(req =>
    (req.truckNo || '').toLowerCase().includes(requestSearch.toLowerCase()) ||
    (req.orgName || '').toLowerCase().includes(requestSearch.toLowerCase()) ||
    (req.orgId || '').toLowerCase().includes(requestSearch.toLowerCase())
  );

  // Count pending requests
  const pendingRequestsCount = allRequests.filter(r => r.status === 'Pending').length;

  const handleEditTruckClick = (orgId: string, truck: Truck) => {
    setEditingTruck({ ...truck });
    setEditingTruckOrgId(orgId);
  };

  const handleSaveTruckClick = () => {
    if (editingTruck && editingTruckOrgId) {
      onUpdateTruckDetails(editingTruckOrgId, editingTruck);
      logAction('Edited', 'Truck', editingTruck.truckNo, `Admin modified compliance parameters for Org ${editingTruckOrgId}`);
      setEditingTruck(null);
      setEditingTruckOrgId(null);
    }
  };

  return (
    <div id="backend-dashboard-panel" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-xl p-6 shadow-md border border-slate-800 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-5 pointer-events-none">
          <Building2 className="w-56 h-56 text-blue-400" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-purple-500/25 border border-purple-500/35 text-purple-300 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
              Super Admin Console
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Backend Team Control Panel</h2>
          <p className="text-xs text-slate-400">Manage all registered organizations, review truck activation requests, adjust licenses, and override compliance datasheets.</p>
        </div>

        {/* Tab Selector buttons */}
        <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-850 self-start md:self-center shrink-0 flex-wrap gap-1">
          {canViewBackend !== false && (
            <button
              onClick={() => setActiveSubTab('ORGANIZATIONS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'ORGANIZATIONS'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-450 hover:text-slate-205'
                }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Organization Profiles</span>
            </button>
          )}
          {canViewTruckRequests !== false && (
            <button
              onClick={() => setActiveSubTab('REQUESTS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${activeSubTab === 'REQUESTS'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-450 hover:text-slate-205'
                }`}
            >
              <TruckIcon className="w-4 h-4" />
              <span>Truck Requests</span>
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          )}
          {canViewDatabaseConsole !== false && (
            <button
              onClick={() => setActiveSubTab('RAW_DATA')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'RAW_DATA'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-450 hover:text-slate-205'
                }`}
            >
              <Database className="w-4 h-4" />
              <span>Database Console</span>
            </button>
          )}
          {(isSuperAdmin || (myRights?.canViewTickets && hasSupportRole)) && (
            <button
              onClick={() => setActiveSubTab('TICKETS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${activeSubTab === 'TICKETS'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-450 hover:text-slate-205'
                }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Ticket Manager</span>
              {getAgentUnreadTicketsCount() > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white animate-pulse">
                  {getAgentUnreadTicketsCount()}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* TAB CONTENT: ORGANIZATIONS */}
      {activeSubTab === 'ORGANIZATIONS' && canViewBackend !== false && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search org name, ID, or owner email..."
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div className="text-xs text-slate-505 dark:text-slate-400 font-medium">
              Showing {filteredOrgs.length} of {organizationProfiles.filter(p => p.organizationId !== 'org_backend').length} Organizations
            </div>
          </div>

          {/* Grid list of Organizations */}
          <div className="grid grid-cols-1 gap-4">
            {filteredOrgs.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 italic text-xs">
                No organizations match the search criteria.
              </div>
            ) : (
              filteredOrgs.map(profile => {
                const isSelected = selectedOrgId === profile.organizationId;
                // Use the trucks state directly as source of truth (cloud snapshot).
                // Do NOT synthesize entries from truckRequests — deleted pending vehicles
                // would otherwise be re-added to the list (matches Truck Requests tab behaviour).
                const orgTrucks = trucks.filter(t => t.organizationId === profile.organizationId);
                const approvedTrucks = orgTrucks.filter(t => t.isApproved !== false);

                return (
                  <div
                    key={profile.organizationId}
                    className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden shadow-2xs transition-all duration-200 ${profile.status === 'Disabled'
                      ? 'border-red-200 dark:border-red-900/40 bg-red-50/5'
                      : isSelected
                        ? 'border-purple-400 ring-1 ring-purple-400'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                  >
                    {/* Organization Main Card Header */}
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{profile.organizationName}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${profile.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400'
                            }`}>
                            {profile.status === 'Active' ? 'Active Account' : 'Account Disabled'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <div><b>ID:</b> <code className="bg-slate-100 dark:bg-slate-850 px-1 py-0.5 rounded text-[10px] font-mono select-all text-purple-600 dark:text-purple-400">{profile.organizationId}</code></div>
                          <div><b>Owner/Admin Email:</b> <span className="font-semibold select-all text-slate-700 dark:text-slate-300">{profile.ownerEmail}</span></div>
                        </div>
                      </div>

                      {/* Controls Area */}
                      <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        {/* Status Toggle */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Status:</span>
                          <button
                            disabled={!canEditBackend}
                            onClick={() => {
                              if (!canEditBackend) return;
                              const nextStatus = profile.status === 'Active' ? 'Disabled' : 'Active';
                              onUpdateOrgStatus(profile.organizationId, nextStatus);
                            }}
                            className={`flex items-center gap-1 p-1 rounded transition text-xs font-semibold cursor-pointer ${!canEditBackend ? 'opacity-50 cursor-not-allowed' : ''
                              } ${profile.status === 'Active'
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-rose-600 hover:bg-rose-50'
                              }`}
                            title={!canEditBackend ? 'Edit permission required' : profile.status === 'Active' ? 'Click to Disable Organization' : 'Click to Enable Organization'}
                          >
                            {profile.status === 'Active' ? (
                              <ToggleRight className="w-6 h-6 text-emerald-500" />
                            ) : (
                              <ToggleLeft className="w-6 h-6 text-rose-500" />
                            )}
                          </button>
                        </div>

                        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800"></div>

                        {/* Truck Limit Control */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Truck Limit:</span>
                          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-0.5">
                            <button
                              disabled={!canEditBackend || profile.maxTrucksAllowed <= 1}
                              onClick={() => onUpdateOrgLimit(profile.organizationId, profile.maxTrucksAllowed - 1)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2.5 font-bold font-mono text-slate-800 dark:text-slate-200 text-xs">
                              {profile.maxTrucksAllowed}
                            </span>
                            <button
                              disabled={!canEditBackend}
                              onClick={() => onUpdateOrgLimit(profile.organizationId, profile.maxTrucksAllowed + 1)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800"></div>

                        {/* Registered count indicators */}
                        <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          <b>Trucks:</b> {approvedTrucks.length} Active / {orgTrucks.length} Total
                        </div>

                        <button
                          onClick={() => setSelectedOrgId(isSelected ? null : profile.organizationId)}
                          className="px-3 py-1 bg-purple-500/10 hover:bg-purple-500/25 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          {isSelected ? 'Collapse Fleet' : 'Manage Trucks'}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDABLE SECTION: FLEET MANAGEMENT */}
                    {isSelected && (
                      <div className="border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 p-5 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-widest flex items-center gap-1.5">
                            <TruckIcon className="w-4 h-4 text-purple-500" />
                            Active Fleet & Expiry overrides
                          </h4>
                          <span className="text-[10px] text-slate-500">Double click values or click Edit to override tax & fitness dates</span>
                        </div>

                        {/* Expandable trucks list */}
                        {orgTrucks.length === 0 ? (
                          <p className="text-xs text-slate-400 italic text-center py-4">No trucks registered in this organization.</p>
                        ) : (
                          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900">
                            <table className="w-full text-left text-xs divide-y divide-slate-150 dark:divide-slate-800 whitespace-nowrap table-fixed">
                              <colgroup><col className="w-[110px]" /><col className="w-[75px]" /><col className="w-[85px]" /><col className="w-[85px]" /><col className="w-[85px]" /><col className="w-[85px]" /><col className="w-[85px]" /><col className="w-[125px]" /><col className="w-[130px]" /><col className="w-[75px]" /><col className="w-[70px]" /><col className="w-[110px]" /></colgroup>
                              <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-[10px] text-slate-505 dark:text-slate-400 uppercase border-b border-slate-150 dark:border-slate-800">
                                <tr>
                                  <th className="px-2 py-2 pl-4">Truck No</th>
                                  <th className="px-2 py-2 text-center">Approved</th>
                                  <th className="px-2 py-2 text-center">Insurance</th>
                                  <th className="px-2 py-2 text-center">FC Date</th>
                                  <th className="px-2 py-2 text-center">Q Tax</th>
                                  <th className="px-2 py-2 text-center">Green Tax</th>
                                  <th className="px-2 py-2 text-center">NP Tax</th>
                                  <th className="px-2 py-2 text-center">Subscription Expiry</th>
                                  <th className="px-2 py-2 text-center">Renew Action</th>
                                  <th className="px-2 py-2 text-right">Odometer</th>
                                  <th className="px-2 py-2 text-center">Status</th>
                                  <th className="px-2 py-2 text-center pr-4">Override</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-medium">
                                {orgTrucks.map(truck => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  const isExpired = truck.registrationExpiryDate ? truck.registrationExpiryDate < todayStr : false;
                                  const duration = rowDurations[truck.id] || '1Y';

                                  return (
                                    <tr key={truck.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                                      <td className="px-2 py-2.5 pl-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {truck.truckNo}
                                      </td>
                                      <td className="px-2 py-2.5 text-center">
                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${truck.isApproved !== false
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
                                      <td className="px-2 py-2.5 text-center font-mono text-[11px] text-slate-500">{formatToDisplayDate(truck.insuranceDate)}</td>
                                      <td className="px-2 py-2.5 text-center font-mono text-[11px] text-slate-500">{formatToDisplayDate(truck.fcDate)}</td>
                                      <td className="px-2 py-2.5 text-center font-mono text-[11px] text-slate-500">{formatToDisplayDate(truck.qTaxDate)}</td>
                                      <td className="px-2 py-2.5 text-center font-mono text-[11px] text-slate-500">{formatToDisplayDate(truck.greenTaxDate)}</td>
                                      <td className="px-2 py-2.5 text-center font-mono text-[11px] text-slate-500">{formatToDisplayDate(truck.npTaxDate)}</td>
                                      <td className={`px-2 py-2.5 text-center font-mono text-[11px] ${isExpired
                                        ? 'text-red-500 font-extrabold dark:text-red-400'
                                        : 'text-slate-500'
                                        }`}>
                                        {formatToDisplayDate(truck.registrationExpiryDate)}
                                        {isExpired && <span className="block text-[8px] text-red-500 font-bold uppercase">Expired</span>}
                                      </td>
                                      <td className="px-2 py-2.5 text-center">
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
                                                <span className="text-[10px] text-rose-500 font-extrabold uppercase bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
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
                                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                                              >
                                                Request Refund
                                              </button>
                                            );
                                          }

                                          return (
                                            <div className="flex flex-col items-center gap-1 justify-center">
                                              <div className="flex items-center gap-1">
                                                <select
                                                  disabled={!canEditBackend}
                                                  value={duration}
                                                  onChange={(e) => setRowDurations(prev => ({ ...prev, [truck.id]: e.target.value as any }))}
                                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-855 dark:text-slate-200 rounded px-1 py-0.5 text-[10px] focus:outline-none"
                                                >
                                                  <option value="1M">1 Month</option>
                                                  <option value="3M">3 Months</option>
                                                  <option value="6M">6 Months</option>
                                                  <option value="1Y">1 Year</option>
                                                </select>
                                                <button
                                                  disabled={!canEditBackend}
                                                  onClick={() => handleRenewClick(profile.organizationId, truck, duration)}
                                                  className="px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-[10px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                  Renew
                                                </button>
                                              </div>
                                              <span className="text-[9px] font-mono text-purple-600 dark:text-purple-400">
                                                → {formatToDisplayDate(getNextExpiryDate(truck, duration))}
                                              </span>
                                            </div>
                                          );
                                        })()}
                                      </td>
                                      <td className="px-2 py-2.5 text-right font-mono text-slate-600">{truck.currentKM?.toLocaleString() || '0'}</td>
                                      <td className="px-2 py-2.5 text-center">
                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${truck.status === 'Active'
                                          ? 'bg-green-55/15 text-green-700 dark:bg-green-500/10'
                                          : 'bg-slate-100 text-slate-650 dark:bg-slate-800'
                                          }`}>
                                          {truck.status}
                                        </span>
                                      </td>
                                      <td className="px-2 py-2.5 text-center pr-4">
                                        {truck.isApproved === false ? (
                                          truck.requestStatus === 'Rejected' ? (
                                            <span className="text-[10px] font-bold text-rose-500 uppercase">Rejected</span>
                                          ) : (
                                            <div className="flex flex-col items-center gap-1.5 justify-center py-1">
                                              <div className="flex items-center gap-1">
                                                <select
                                                  disabled={!canApproveBackend}
                                                  value={duration}
                                                  onChange={(e) => setRowDurations(prev => ({ ...prev, [truck.id]: e.target.value as any }))}
                                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded px-1 py-0.5 text-[10px] focus:outline-none"
                                                >
                                                  <option value="1M">1 Month</option>
                                                  <option value="3M">3 Months</option>
                                                  <option value="6M">6 Months</option>
                                                  <option value="1Y">1 Year</option>
                                                </select>
                                                <span className="text-[9px] font-mono text-purple-600 dark:text-purple-400">
                                                  → {formatToDisplayDate(getNextExpiryDate(truck, duration))}
                                                </span>
                                              </div>
                                              <div className="flex justify-center items-center gap-1.5">
                                                <button
                                                  disabled={!canApproveBackend}
                                                  onClick={() => {
                                                    const matchingReq = (profile.truckRequests || []).find(
                                                      r => r.truckNo.toUpperCase() === truck.truckNo.toUpperCase() && r.status === 'Pending'
                                                    );
                                                    const reqId = matchingReq ? matchingReq.id : `req_fallback_${truck.id}`;
                                                    if (confirm(`Approve registration of truck ${truck.truckNo} for organization ${profile.organizationName}?`)) {
                                                      onApproveTruckRequest(profile.organizationId, reqId, truck.truckNo, duration);
                                                    }
                                                  }}
                                                  className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                                  title="Approve Truck (Manual Override)"
                                                >
                                                  Approve
                                                </button>
                                                <button
                                                  disabled={!canApproveBackend}
                                                  onClick={() => {
                                                    const matchingReq = (profile.truckRequests || []).find(
                                                      r => r.truckNo.toUpperCase() === truck.truckNo.toUpperCase() && r.status === 'Pending'
                                                    );
                                                    const reqId = matchingReq ? matchingReq.id : `req_fallback_${truck.id}`;
                                                    if (confirm(`Decline and reject registration of truck ${truck.truckNo} for organization ${profile.organizationName}?`)) {
                                                      onRejectTruckRequest(profile.organizationId, reqId, truck.truckNo);
                                                    }
                                                  }}
                                                  className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                                  title="Reject Request (Manual Override)"
                                                >
                                                  Reject
                                                </button>
                                              </div>
                                            </div>
                                          )
                                        ) : (
                                          <button
                                            disabled={!canEditBackend}
                                            onClick={() => handleEditTruckClick(profile.organizationId, truck)}
                                            className="p-1 text-blue-650 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                            title={canEditBackend ? "Override Compliance & Expiry Dates" : "Edit permission required"}
                                          >
                                            <Edit className="w-3.5 h-3.5" />
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
                            <div className="mt-6 border-t border-slate-200 dark:border-slate-850 pt-5 space-y-3">
                              <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-widest flex items-center gap-1.5">
                                  <History className="w-4 h-4 text-purple-500" />
                                  Payments & Refunds Ledger
                                </h4>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  Showing {orgPayments.length} transactions
                                </span>
                              </div>

                              {orgPayments.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                  No transactions recorded for this organization.
                                </p>
                              ) : (
                                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900">
                                  <table className="w-full text-left text-xs divide-y divide-slate-150 dark:divide-slate-800 whitespace-nowrap table-fixed">
                                    <colgroup>
                                      <col className="w-[140px]" />
                                      <col className="w-[100px]" />
                                      <col className="w-[80px]" />
                                      <col className="w-[90px]" />
                                      <col className="w-[180px]" />
                                      <col className="w-[90px]" />
                                      <col className="w-[110px]" />
                                    </colgroup>
                                    <thead className="bg-slate-55 dark:bg-slate-950 font-bold text-[10px] text-slate-500 dark:text-slate-400 uppercase border-b border-slate-150 dark:border-slate-800">
                                      <tr>
                                        <th className="px-3 py-2 pl-4">Date</th>
                                        <th className="px-2 py-2">Truck No</th>
                                        <th className="px-2 py-2 text-right">Amount</th>
                                        <th className="px-2 py-2 text-center">Method</th>
                                        <th className="px-2 py-2">Transaction ID / Refund ID</th>
                                        <th className="px-2 py-2 text-center">Status</th>
                                        <th className="px-2 py-2 text-center pr-4">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-medium">
                                      {orgPayments.map((p: any) => {
                                        const payDate = new Date(p.paymentDate || p.createdAt);
                                        const diffTime = Date.now() - payDate.getTime();
                                        const diffDays = diffTime / (1000 * 60 * 60 * 24);
                                        const isRefundable = (p.status === 'Success' || p.status === 'success') && diffDays <= 7;

                                        return (
                                          <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                                            <td className="px-3 py-2.5 pl-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                              {formatToDisplayDate(p.paymentDate || p.createdAt.split('T')[0])} {payDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-2 py-2.5 font-mono font-bold text-slate-700 dark:text-slate-350">
                                              {p.truckNo}
                                            </td>
                                            <td className="px-2 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                              ₹{p.amount?.toLocaleString()}
                                            </td>
                                            <td className="px-2 py-2.5 text-center font-mono text-[10px] text-slate-500 uppercase">
                                              {p.paymentMethod || 'upi'}
                                            </td>
                                            <td className="px-2 py-2.5 font-mono text-[10px] text-slate-500">
                                              <div className="flex flex-col">
                                                <span>Txn: {p.transactionId}</span>
                                                {p.refundId && (
                                                  <span className="text-rose-500 font-semibold text-[9px]">
                                                    Ref: {p.refundId}
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-2 py-2.5 text-center">
                                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                p.status === 'Refunded' || p.status === 'refunded'
                                                  ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20'
                                                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20'
                                              }`}>
                                                {p.status}
                                              </span>
                                            </td>
                                            <td className="px-2 py-2.5 text-center pr-4">
                                              {isRefundable ? (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (confirm(`Are you sure you want to initiate a PhonePe refund of ₹${p.amount} for truck ${p.truckNo}? This will rollback approval status.`)) {
                                                      onInitiateRefund?.(profile.organizationId, p.truckNo, p);
                                                    }
                                                  }}
                                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                                                >
                                                  Request Refund
                                                </button>
                                              ) : p.status === 'Refunded' ? (
                                                <span className="text-[10px] text-rose-500 font-extrabold uppercase bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded border border-rose-200">
                                                  Refunded
                                                </span>
                                              ) : (
                                                <span className="text-[10px] text-slate-400 italic">
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
      {activeSubTab === 'REQUESTS' && canViewTruckRequests !== false && (
        <div className="space-y-4">
          {/* Pause Notification Banner */}
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-amber-800 dark:text-amber-400 text-xs flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-550 mt-0.5 animate-pulse" />
            <div>
              <p className="font-bold text-sm">Manual Approval System Paused</p>
              <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-400">
                The manual verification and approval system is currently paused. Vehicle activations and registration renewals are now automated using the PhonePe secure payment gateway. Approved and active subscriptions bypass manual checks.
              </p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search truck number, organization name..."
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div className="text-xs text-slate-505 dark:text-slate-400 font-medium">
              Total {filteredRequests.length} truck activation requests
            </div>
          </div>

          {/* Requests List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-150 dark:divide-slate-800 whitespace-nowrap table-fixed">
              <colgroup><col className="w-[120px]" /><col className="w-[160px]" /><col className="w-[120px]" /><col className="w-[110px]" /><col className="w-[80px]" /><col className="w-[100px]" /><col className="w-[220px]" /></colgroup>
                <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-[10px] text-slate-505 dark:text-slate-400 uppercase border-b border-slate-150 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-3 pl-4">Truck Number</th>
                    <th className="px-3 py-3">Organization</th>
                    <th className="px-3 py-3">Technical Specs</th>
                    <th className="px-3 py-3 text-center">Requested At</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-center">Action Taken</th>
                    <th className="px-3 py-3 text-center pr-4">Resolve Request</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-medium">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400 italic">No truck requests found.</td>
                    </tr>
                  ) : (
                    filteredRequests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                        <td className="px-3 py-3.5 pl-4 font-mono font-extrabold tracking-wider text-slate-800 dark:text-slate-100 text-xs">
                          {req.truckNo}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="font-semibold text-slate-700 dark:text-slate-300">{req.orgName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{req.orgId}</div>
                        </td>
                        <td className="px-3 py-3.5 text-slate-500 text-[11px]">
                          <div>{req.make || '—'} {req.model || ''}</div>
                          <div className="text-[10px] italic">{req.type || ''}</div>
                        </td>
                        <td className="px-3 py-3.5 text-center font-mono text-[11px] text-slate-500">
                          {req.requestedAt}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${req.status === 'Pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10'
                            : req.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10'
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10'
                            }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center font-mono text-[10px] text-slate-400">
                          {req.status === 'Pending' ? 'Needs Action' : `${req.status} on ${req.requestedAt}`}
                        </td>
                        <td className="px-3 py-3.5 text-center pr-4">
                          {req.status === 'Pending' ? (
                            (() => {
                              const duration = rowDurations[req.id] || '1Y';
                              return (
                                <div className="flex flex-col items-center gap-1.5 py-1">
                                  <div className="flex items-center gap-1">
                                    <select
                                      disabled={!canApproveBackend}
                                      value={duration}
                                      onChange={(e) => setRowDurations(prev => ({ ...prev, [req.id]: e.target.value as any }))}
                                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-805 dark:text-slate-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-purple-500 font-sans cursor-pointer font-semibold"
                                    >
                                      <option value="1M">1 Month</option>
                                      <option value="3M">3 Months</option>
                                      <option value="6M">6 Months</option>
                                      <option value="1Y">1 Year</option>
                                    </select>
                                    <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 bg-purple-500/5 px-1 py-0.5 rounded border border-purple-500/10">
                                      → {getProjectedRequestExpiry(duration)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      disabled={!canApproveBackend}
                                      onClick={() => {
                                        if (confirm(`Approve registration of truck ${req.truckNo} for organization ${req.orgName}?`)) {
                                          onApproveTruckRequest(req.orgId, req.id, req.truckNo, duration);
                                        }
                                      }}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Approve (Manual Override)"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      Approve
                                    </button>
                                    <button
                                      disabled={!canApproveBackend}
                                      onClick={() => {
                                        if (confirm(`Decline and reject registration of truck ${req.truckNo} for organization ${req.orgName}?`)) {
                                          onRejectTruckRequest(req.orgId, req.id);
                                        }
                                      }}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Reject (Manual Override)"
                                    >
                                      <CloseIcon className="w-3.5 h-3.5" />
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              );
                            })()
                          ) : req.status === 'Approved' ? (
                            <span className="text-[11px] text-emerald-600 font-bold">Approved</span>
                          ) : (
                            <span className="text-[11px] text-rose-500 font-bold">Rejected</span>
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
      {activeSubTab === 'RAW_DATA' && canViewDatabaseConsole !== false && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Collection Dropdown */}
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Select Collection</label>
                <select
                  value={selectedCollection}
                  onChange={(e) => {
                    setSelectedCollection(e.target.value as any);
                    setConsoleSearchQuery('');
                  }}
                  className="bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value="trips">Trips ({trips.length})</option>
                  <option value="trucks">Trucks ({trucks.length})</option>
                  <option value="drivers">Drivers ({drivers.length})</option>
                  <option value="offices">Offices ({offices.length})</option>
                  <option value="accounts">Accounts ({accounts.length})</option>
                  <option value="expenses">Expenses ({expenses.length})</option>
                  <option value="tyres">Tyres ({tyres.length})</option>
                  <option value="auditLogs">Audit Logs ({auditLogs.length})</option>
                  <option value="userRights">User Permissions ({userRightsList.length})</option>
                  <option value="organizationProfiles">Organizations ({organizationProfiles.length})</option>
                </select>
              </div>

              {/* Org Filter Dropdown */}
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Organization Filter</label>
                <select
                  value={consoleOrgFilter}
                  onChange={(e) => setConsoleOrgFilter(e.target.value)}
                  className="bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value="ALL">All Organizations</option>
                  {uniqueOrgIds.map(orgId => (
                    <option key={orgId} value={orgId}>{orgId}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search and Add buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 self-stretch md:self-end">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={`Search in ${selectedCollection}...`}
                  value={consoleSearchQuery}
                  onChange={(e) => setConsoleSearchQuery(e.target.value)}
                  className="w-full bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                disabled={!canEditDatabaseConsole}
                onClick={handleAddConsoleRecordClick}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={!canEditDatabaseConsole ? "Add permission required" : "Add Record"}
              >
                <Plus className="w-4 h-4" />
                <span>Add Record</span>
              </button>
            </div>
          </div>

          {/* Database Table view */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-150 dark:divide-slate-800 whitespace-nowrap table-fixed">
                <colgroup><col className="w-[180px]" /><col className="w-[100px]" /><col className="w-auto" /><col className="w-[180px]" /></colgroup>
                <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-[10px] text-slate-505 dark:text-slate-400 uppercase border-b border-slate-150 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">ID / Reference</th>
                    <th className="px-4 py-3 text-center">Org ID</th>
                    <th className="px-4 py-3">Details Summary</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-855 font-medium">
                  {filteredConsoleRecords.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-400 italic">No records found.</td>
                    </tr>
                  ) : (
                    filteredConsoleRecords.map((item, idx) => {
                      const idVal = item.id || item.organizationId || `idx_${idx}`;
                      const orgVal = item.organizationId || item.orgId || 'Global';
                      const labelVal = getRecordLabel(item);

                      return (
                        <tr key={idVal} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition">
                          <td className="px-4 py-3 font-mono text-[11px] text-purple-600 dark:text-purple-400 font-bold select-all truncate" title={idVal}>
                            {idVal}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-750 dark:text-slate-350 font-mono">
                              {orgVal}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 truncate" title={labelVal}>
                            {selectedCollection === 'userRights' ? (
                              <div className="flex flex-col gap-1">
                                <div className="font-bold text-slate-800 dark:text-slate-205">{item.name || 'No Name'} ({item.email || 'No Email'})</div>
                                <div className="flex items-center gap-1.5 text-[9px] flex-wrap">
                                  <span className="font-semibold text-slate-400">Role: <b className="text-purple-600 dark:text-purple-400">{item.role || 'Custom'}</b></span>
                                  <span className={`px-1 py-0.5 rounded text-[8px] font-bold border ${item.isEmailVerified
                                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                      : 'bg-amber-500/10 text-amber-550 border-amber-500/20'
                                    }`}>
                                    Email: {item.isEmailVerified ? 'Verified' : 'Unverified'}
                                  </span>
                                  <span className={`px-1 py-0.5 rounded text-[8px] font-bold border ${item.isPhoneVerified
                                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                      : 'bg-amber-500/10 text-amber-550 border-amber-500/20'
                                    }`}>
                                    Phone: {item.isPhoneVerified ? 'Verified' : 'Unverified'}
                                  </span>
                                  {item.phone && (
                                    <span className="text-slate-450 font-mono">({item.phone})</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              labelVal
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex justify-center items-center gap-2 flex-wrap">
                              <button
                                disabled={!canEditDatabaseConsole}
                                onClick={() => handleEditConsoleRecord(item)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={!canEditDatabaseConsole ? "Edit permission required" : "Edit JSON"}
                              >
                                <Code className="w-3.5 h-3.5" />
                                Edit JSON
                              </button>

                              {selectedCollection === 'userRights' && (
                                <>
                                  {!item.isEmailVerified && (
                                    <button
                                      disabled={!canApproveBackend}
                                      onClick={() => {
                                        const updated = { ...item, isEmailVerified: true };
                                        onSaveUserRightsList(userRightsList.map(r => r.id === item.id ? updated : r));
                                        logAction('Edited', 'Permission', item.email, `Backend team manually verified email for ${item.name || item.email}`);
                                        alert(`Manually verified email for ${item.name || item.email}`);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 bg-emerald-605 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Manually Verify Email"
                                    >
                                      Verify Email
                                    </button>
                                  )}
                                  {!item.isPhoneVerified && (
                                    <button
                                      disabled={!canApproveBackend}
                                      onClick={() => {
                                        const updated = { ...item, isPhoneVerified: true };
                                        onSaveUserRightsList(userRightsList.map(r => r.id === item.id ? updated : r));
                                        logAction('Edited', 'Permission', item.email, `Backend team manually verified phone for ${item.name || item.email}`);
                                        alert(`Manually verified phone for ${item.name || item.email}`);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 bg-teal-605 hover:bg-teal-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Manually Verify Phone"
                                    >
                                      Verify Phone
                                    </button>
                                  )}
                                  <button
                                    disabled={!canApproveBackend}
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
                                    className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Reset Password / Send Recovery"
                                  >
                                    Reset PW
                                  </button>
                                </>
                              )}

                              <button
                                disabled={!canDeleteDatabaseConsole}
                                onClick={() => handleDeleteConsoleRecord(item)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition shadow-3xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={!canDeleteDatabaseConsole ? "Delete permission required" : "Delete"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
      {jsonEditorRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            {/* Modal Header */}
            <div className="p-5 bg-slate-55 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-850 dark:text-slate-100">
                    {isAddingNewRecord ? `Add New Record to [${selectedCollection}]` : `Edit Raw JSON Record in [${selectedCollection}]`}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    ID: {jsonEditorRecord.id || jsonEditorRecord.organizationId || '(Auto-generated on Save)'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setJsonEditorRecord(null)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content - JSON Textarea */}
            <div className="p-5 flex-1 overflow-hidden flex flex-col space-y-4">
              <div className="flex-1 min-h-[300px] flex flex-col border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <textarea
                  value={jsonEditorContent}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="w-full flex-1 p-4 bg-slate-950 font-mono text-[11px] leading-relaxed text-emerald-450 focus:outline-none resize-none overflow-y-auto"
                  placeholder="Paste or write valid JSON here..."
                  spellCheck="false"
                />
              </div>

              {/* Status and Error Alert Area */}
              <div className={`p-3 rounded-lg border flex items-start gap-2 text-xs leading-normal ${jsonEditorIsValid
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-450'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                }`}>
                {jsonEditorIsValid ? (
                  <>
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                    <span className="font-bold">Valid JSON payload syntax. Ready to save!</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                    <div>
                      <div className="font-bold">Malformed JSON syntax details:</div>
                      <code className="block mt-1 font-mono text-[10px] break-all">{jsonEditorError}</code>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setJsonEditorRecord(null)}
                className="px-4 py-2 border border-slate-200 text-slate-550 rounded text-xs font-bold transition hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!jsonEditorIsValid}
                onClick={handleSaveConsoleRecord}
                className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                <span>Save Database Object</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TICKET MANAGER */}
      {activeSubTab === 'TICKETS' && (isSuperAdmin || (myRights?.canViewTickets && hasSupportRole)) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex h-[550px] text-left">
          {/* Left Panel: Ticket List */}
          <div className="w-1/3 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <h4 className="font-bold text-slate-850 dark:text-slate-200 text-xs uppercase tracking-wider">
                Support Queue ({filteredTickets.length})
              </h4>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredTickets.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                  No tickets in queue.
                </div>
              ) : (
                filteredTickets.map((t) => {
                  const lastMsg = t.messages?.[t.messages.length - 1];
                  const isSelected = selectedTicketId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTicketId(t.id);
                        setResolvedUrls({});
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all ${
                        isSelected
                          ? 'bg-purple-50/40 dark:bg-purple-950/30 border-l-4 border-purple-600'
                          : 'hover:bg-slate-55 dark:hover:bg-slate-800/40 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1.5 animate-none">
                          #{t.ticketNo}
                          {t.lockedByEmail && (
                            <span className="text-amber-550 dark:text-amber-450 shrink-0" title={`Locked by ${t.lockedByName}`}>
                              <Lock className="w-3 h-3 inline-block align-middle" />
                            </span>
                          )}
                          {getAgentUnreadInfo(t).hasUnread && (
                            <span className="flex items-center justify-center bg-rose-500 text-white rounded-full text-[9px] px-1 min-w-[14px] h-[14px] font-sans font-bold leading-none animate-pulse">
                              {getAgentUnreadInfo(t).count}
                            </span>
                          )}
                        </span>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
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
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate mb-1">
                        {t.title}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {lastMsg ? lastMsg.content : t.description}
                      </div>
                      <div className="flex justify-between items-center mt-2 text-[9px] text-slate-400 font-medium">
                        <span className="bg-slate-100 dark:bg-slate-850 px-1.5 py-0.5 rounded text-[9px] font-semibold">
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
          <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/35">
            {selectedTicket ? (() => {
              const isLockedByOther = !!(selectedTicket.lockedByEmail && selectedTicket.lockedByEmail !== currentUser?.email);
              return (
                <>
                  {/* Header */}
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-start shadow-3xs gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs font-mono">
                          #{selectedTicket.ticketNo}
                        </h4>
                        <span className="text-slate-450 dark:text-slate-550 text-xs">•</span>
                        <span className="font-semibold text-xs text-slate-705 dark:text-slate-350">
                          {selectedTicket.title}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 space-y-0.5">
                        <p>
                          Requester: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedTicket.requesterName}</span> ({selectedTicket.requesterEmail})
                        </p>
                        <p>
                          Phone: <span className="font-mono">{selectedTicket.requesterPhone || '—'}</span> | Org ID: <span className="font-mono">{selectedTicket.organizationId || 'Public'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Actions Area */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      {/* Team Transfer dropdown if allowed */}
                      {(isSuperAdmin || myCanTransfer) && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-450 uppercase">Team:</span>
                          <select
                            value={selectedTicket.assignedTeam}
                            onChange={(e) => handleTransferTicket(selectedTicket.id, e.target.value as any)}
                            disabled={isLockedByOther}
                            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-805 dark:text-slate-200 rounded px-2 py-1 text-[11px] font-bold outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="Technical">Technical</option>
                            <option value="Billing">Billing</option>
                            <option value="General">General</option>
                          </select>
                        </div>
                      )}

                      {/* Close/Reopen ticket button */}
                      {selectedTicket.status !== 'Closed' ? (
                        <button
                          onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'Closed')}
                          disabled={isLockedByOther || (!isSuperAdmin && !myRights?.canEditTickets)}
                          className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold px-2.5 py-1 rounded text-[10px] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Close Ticket
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'In Progress')}
                          disabled={isLockedByOther || (!isSuperAdmin && !myRights?.canEditTickets)}
                          className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold px-2.5 py-1 rounded text-[10px] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reopen Ticket
                        </button>
                      )}

                      {/* Delete ticket button */}
                      {(isSuperAdmin || myRights?.canDeleteTickets) && (
                        <button
                          onClick={() => handleDeleteTicket(selectedTicket.id)}
                          disabled={isLockedByOther}
                          className="bg-rose-600 text-white hover:bg-rose-750 font-bold px-2.5 py-1 rounded text-[10px] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="p-3 mx-4 mt-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-650 dark:text-slate-350 shadow-3xs">
                    <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Description</span>
                    <p className="whitespace-pre-line leading-relaxed">{selectedTicket.description}</p>
                  </div>
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {selectedTicket.messages?.map((msg) => {
                      const isSystem = msg.senderName === 'System Notification' || msg.senderEmail === 'system@ttt.com';
                      const isAgent = msg.sender === 'Agent';

                      if (isSystem) {
                        return (
                          <div key={msg.id} className="flex justify-center my-2">
                            <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-550/20 rounded-lg px-3 py-1.5 text-[11px] max-w-[85%] text-center font-medium shadow-3xs">
                              {msg.content}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl p-3 border shadow-3xs text-xs text-left ${
                              isAgent
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent rounded-tr-none shadow-md shadow-purple-500/10'
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/60 rounded-tl-none shadow-xs'
                            }`}
                          >
                            <div className="flex justify-between items-center gap-4 mb-1 text-[9px] opacity-75 font-semibold">
                              <span>{msg.senderName} ({msg.sender === 'Agent' ? 'Agent' : 'User'})</span>
                              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="whitespace-pre-line leading-relaxed font-sans">{msg.content}</p>

                            {msg.attachmentUrl && (
                              <div className={`mt-2 p-1.5 rounded flex items-center justify-between gap-3 text-[10px] ${
                                isAgent ? 'bg-purple-705 border border-purple-600/40 text-purple-50' : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350'
                              }`}>
                                <div className="flex items-center gap-1.5 truncate">
                                  <FileText className="w-3.5 h-3.5 shrink-0 opacity-80" />
                                  <span className="truncate max-w-[130px] font-mono">{msg.attachmentName || 'Attachment'}</span>
                                </div>
                                {resolvedUrls[msg.id] ? (
                                  <a
                                    href={(() => {
                                      const isFileId = !msg.attachmentUrl!.startsWith('http');
                                      if (isFileId && isAppwriteConfigured()) {
                                        return appwrite.getTicketFileDownload(msg.attachmentUrl!);
                                      }
                                      return resolvedUrls[msg.id];
                                    })()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={msg.attachmentName || true}
                                    className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0 ${isAgent ? 'text-white' : 'text-blue-600'}`}
                                    title="Download attachment"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                ) : (
                                  <Loader2 className="w-3 h-3 animate-spin opacity-60" />
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
                    <div className="mx-4 mb-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 p-2.5 rounded-lg text-xs flex items-center justify-between gap-3 shadow-3xs">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
                        <span>
                          <strong>{selectedTicket.lockedByName}</strong> is currently handling this ticket.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleForceUnlock(selectedTicket.id)}
                        className="bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-800 dark:text-amber-300 font-bold px-2 py-1 rounded text-[10px] transition cursor-pointer"
                      >
                        Force Unlock
                      </button>
                    </div>
                  )}

                  {/* Chat Input Footer */}
                  <form onSubmit={handleSendChat} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                    {chatFile && (
                      <div className="flex items-center justify-between bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/30 rounded-lg px-2.5 py-1 text-[10px] text-purple-700 dark:text-purple-400 font-medium">
                        <div className="flex items-center gap-1.5 truncate">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[200px] font-mono">{chatFile.name}</span>
                        </div>
                        <button type="button" onClick={() => setChatFile(null)} className="text-slate-455 hover:text-slate-700 cursor-pointer" disabled={isLockedByOther}>
                          <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => setChatFile(e.target.files?.[0] || null)}
                        className="hidden"
                        disabled={isLockedByOther || (!isSuperAdmin && !myRights?.canEditTickets)}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSending || isLockedByOther || (!isSuperAdmin && !myRights?.canEditTickets)}
                        className="p-2 text-slate-450 hover:text-slate-705 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition shrink-0 cursor-pointer disabled:opacity-50"
                        title="Attach file document"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onFocus={handleFocusInput}
                        onBlur={handleBlurInput}
                        disabled={isSending || isLockedByOther || (!isSuperAdmin && !myRights?.canEditTickets)}
                        placeholder={
                          isLockedByOther
                            ? `Locked by ${selectedTicket.lockedByName}...`
                            : (!isSuperAdmin && !myRights?.canEditTickets)
                            ? 'No edit permissions for tickets.'
                            : selectedTicket.status === 'Closed'
                            ? 'Ticket is closed. Reopen to reply.'
                            : 'Type support reply...'
                        }
                        className="flex-1 bg-slate-55 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-slate-900 disabled:opacity-60 font-semibold"
                        readOnly={selectedTicket.status === 'Closed' || isLockedByOther || (!isSuperAdmin && !myRights?.canEditTickets)}
                      />
                      <button
                        type="submit"
                        disabled={isSending || isLockedByOther || (!isSuperAdmin && !myRights?.canEditTickets) || (selectedTicket.status === 'Closed') || (!chatInput.trim() && !chatFile)}
                        className="p-2 bg-purple-600 hover:bg-purple-750 text-white rounded-lg transition shrink-0 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </form>
                </>
              );
            })() : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <MessageSquare className="w-12 h-12 text-slate-350 dark:text-slate-750 mb-2.5" />
                <p className="font-bold text-slate-700 dark:text-slate-400 text-xs">Select a Support Ticket</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-550 mt-1 max-w-[240px]">
                  Choose a ticket from the support queue to communicate with the client.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OVERRIDE TRUCK SPECS / EXPIRIES MODAL POPUP */}
      {editingTruck && editingTruckOrgId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <TruckIcon className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Override Compliance Parameters</h3>
                  <p className="text-[11px] text-slate-500">Truck: <span className="font-mono font-bold text-purple-600">{editingTruck.truckNo}</span> ({editingTruckOrgId})</p>
                </div>
              </div>
              <button
                onClick={() => { setEditingTruck(null); setEditingTruckOrgId(null); }}
                className="text-slate-400 hover:text-slate-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[400px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operational Status</label>
                  <select
                    value={editingTruck.status}
                    onChange={(e) => setEditingTruck({ ...editingTruck, status: e.target.value as any })}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="Active">Operational (Active)</option>
                    <option value="Inactive">Under Maintenance (Inactive)</option>
                    <option value="Admin Disabled">Admin Disabled (Locked)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Current Odometer (KM) <span className="text-[9px] font-normal text-slate-400 capitalize">(read-only)</span></label>
                  <input
                    type="number"
                    value={editingTruck.currentKM || ''}
                    disabled
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2.5 py-1 text-xs font-mono cursor-not-allowed focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 my-2 pt-3">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Compliance Expiry Dates (Read-Only)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Insurance Expiry</label>
                    <input
                      type="date"
                      value={editingTruck.insuranceDate || ''}
                      disabled
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Fitness Cert (FC)</label>
                    <input
                      type="date"
                      value={editingTruck.fcDate || ''}
                      disabled
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Quarterly Tax (Q Tax)</label>
                    <input
                      type="date"
                      value={editingTruck.qTaxDate || ''}
                      disabled
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Green Tax Cert</label>
                    <input
                      type="date"
                      value={editingTruck.greenTaxDate || ''}
                      disabled
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2.5 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">National Permit Tax</label>
                    <input
                      type="date"
                      value={editingTruck.npTaxDate || ''}
                      disabled
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2.5 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">5 Year Permit Date</label>
                    <input
                      type="date"
                      value={editingTruck.fiveYearPermitDate || ''}
                      disabled
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 rounded px-2.5 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Subscription Expiry</label>
                    <input
                      type="date"
                      value={editingTruck.registrationExpiryDate || ''}
                      disabled
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-855 text-slate-500 dark:text-slate-400 rounded px-2.5 py-1 text-xs cursor-not-allowed focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 my-2 pt-3">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">Subscription Renewal</span>
                <div className="flex items-center gap-3 bg-purple-500/5 border border-purple-500/10 p-3 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Select Renewal Duration</label>
                    <select
                      disabled={!canEditBackend}
                      value={renewalDuration}
                      onChange={(e) => setRenewalDuration(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-855 dark:text-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none mb-1"
                    >
                      <option value="1M">1 Month</option>
                      <option value="3M">3 Months</option>
                      <option value="6M">6 Months</option>
                      <option value="1Y">1 Year</option>
                    </select>
                    <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 block mt-1">
                      Projected Expiry: {formatToDisplayDate(getNextExpiryDate(editingTruck, renewalDuration))}
                    </span>
                  </div>
                  <div className="pt-4 shrink-0">
                    <button
                      type="button"
                      disabled={!canEditBackend}
                      onClick={handleRenewInModal}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Renew Subscription
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setEditingTruck(null); setEditingTruckOrgId(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded text-xs font-bold transition hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTruckClick}
                className="flex items-center gap-1 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Override & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
