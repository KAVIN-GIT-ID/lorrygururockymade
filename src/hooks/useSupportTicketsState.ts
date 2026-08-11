import { createSignal, Accessor, onMount, onCleanup, createEffect } from 'solid-js';
import { SupportTicket, createRecord, mutateRecord } from '../types';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

export function useSupportTicketsState(
  currentUserOrgId: Accessor<string>,
  currentUser: Accessor<any>,
  currentUserRights: Accessor<any>,
  userRightsList: Accessor<any[]>,
  currentUserId: Accessor<string>,
  showNotification: (msg: string) => void,
  logAction: (action: string, category: string, reference: string, details: string, orgId?: string) => void,
  payments: Accessor<any[]>,
  savePayments: (next: any[]) => void,
  trucks: any[],
  setTrucks: (updater: (prev: any[]) => any[]) => void
) {
  const [supportTickets, setSupportTickets] = createSignal<SupportTicket[]>((() => {
    try {
      const stored = localStorage.getItem('ttt_support_tickets');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const map = new Map<string, SupportTicket>();
          parsed.forEach(t => { if (t && t.id) map.set(t.id, t); });
          return Array.from(map.values());
        }
      }
    } catch (e) {
      console.error('Failed to parse ttt_support_tickets from localStorage:', e);
    }
    return [];
  })());

  const [activeTicketId, setActiveTicketId] = createSignal<string | null>(null);

  createEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ttt_support_tickets' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            const map = new Map<string, SupportTicket>();
            parsed.forEach(t => { if (t && t.id) map.set(t.id, t); });
            const unique = Array.from(map.values());
            console.log('[SupportTicketSync Debug] Storage event received! Updating local tickets signal count:', unique.length);
            setSupportTickets(unique);
          }
        } catch (err) {
          console.error('Failed to parse storage event ttt_support_tickets:', err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    onCleanup(() => window.removeEventListener('storage', handleStorageChange));
  });

  const saveSupportTickets = async (nextTicketsOrFn: SupportTicket[] | ((prev: SupportTicket[]) => SupportTicket[])) => {
    try {
      const rawNextTickets = typeof nextTicketsOrFn === 'function' ? nextTicketsOrFn(supportTickets()) : nextTicketsOrFn;

      const ticketMap = new Map<string, SupportTicket>();
      rawNextTickets.forEach(t => {
        if (t && t.id) ticketMap.set(t.id, t);
      });
      const nextTickets = Array.from(ticketMap.values());

      const changedTickets = nextTickets.filter(t => {
        const existing = supportTickets().find(x => x.id === t.id);
        return !existing || JSON.stringify(existing) !== JSON.stringify(t);
      });

      const deletedTickets = supportTickets().filter(t => !nextTickets.some(x => x.id === t.id));

      setSupportTickets(nextTickets);
      localStorage.setItem('ttt_support_tickets', JSON.stringify(nextTickets));

      if (isAppwriteConfigured()) {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';

        if (changedTickets.length > 0) {
          await Promise.allSettled(changedTickets.map(async (t) => {
            return await appwrite.saveFleetDocument(databaseId, 'support_tickets', t.id, t.organizationId || 'org_default', t);
          }));
        }

        if (deletedTickets.length > 0) {
          await Promise.all(deletedTickets.map(async (t) => {
            try {
              await appwrite.deleteFleetDocument(databaseId, 'support_tickets', t.id);
            } catch (err: any) {
              console.error(`Failed to delete support ticket ${t.id} from Appwrite:`, err);
            }
          }));
        }
      }
    } catch (err: any) {
      console.error(`saveSupportTickets error:`, err);
      throw err;
    }
  };

  const handleInitiateRefund = async (orgId: string, truckNo: string, paymentRecord: any) => {
    try {
      showNotification("Initiating refund via PhonePe gateway...");

      const serverUrl = import.meta.env.VITE_BACKEND_URL || 'https://appwrite.lorryguru.in/truck-backend';
      const jwt = await appwrite.createSessionJwt();
      const response = await fetch(`${serverUrl}/api/payment/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({
          originalTransactionId: paymentRecord.transactionId,
          amount: paymentRecord.amount
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Refund request failed');
      }

      const refundId = data.refundId || ('REF' + Date.now());

      const nextPayments = payments().map(p => {
        if (p.id === paymentRecord.id) {
          return {
            ...p,
            status: 'Refunded',
            refundId,
            refundStatus: 'Initiated',
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      });
      savePayments(nextPayments);

      if (isAppwriteConfigured()) {
        try {
          await appwrite.saveFleetDocument('fleet_db', 'payments', paymentRecord.id, orgId, {
            ...paymentRecord,
            status: 'Refunded',
            refundId,
            refundStatus: 'Initiated',
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("Failed to sync refunded payment to Appwrite:", err);
        }
      }

      const targetTruck = trucks.find(t => t.truckNo.toUpperCase() === truckNo.toUpperCase() && t.organizationId === orgId);
      if (targetTruck) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const updatedTruck = {
          ...targetTruck,
          registrationExpiryDate: yesterdayStr,
          status: 'Inactive' as const,
          requestStatus: 'Rejected' as const,
          isApproved: false,
          updatedAt: new Date().toISOString()
        };

        setTrucks(prev => {
          const next = prev.map(t => t.id === targetTruck.id ? updatedTruck : t);
          localStorage.setItem('ttt_trucks', JSON.stringify(next));
          return next;
        });

        if (isAppwriteConfigured()) {
          try {
            await appwrite.saveFleetDocument('fleet_db', 'trucks', targetTruck.id, orgId, updatedTruck);
          } catch (err) {
            console.error("Failed to sync deactivated truck to Appwrite:", err);
          }
        }
      }

      const ticketId = 'tkt_' + Date.now();
      const ticketNo = 'TKT-' + Math.floor(100000 + Math.random() * 900000);
      const ticketTitle = `Refund Processed for Truck ${truckNo}`;
      const ticketDescription = `A refund of ₹${paymentRecord.amount} has been initiated for the subscription of truck ${truckNo}. Refund Transaction ID: ${refundId}. The truck has been deactivated.`;

      const initialMessage = {
        id: `msg-${Date.now()}`,
        sender: 'Agent' as const,
        senderName: 'Billing Team',
        senderEmail: 'billing@lorryguru.com',
        content: ticketDescription,
        timestamp: new Date().toISOString(),
      };

      const newTicket: SupportTicket = {
        id: ticketId,
        ticketNo,
        organizationId: orgId,
        requesterName: paymentRecord.customerName || 'Organization Owner',
        requesterEmail: paymentRecord.customerEmail || '',
        requesterPhone: paymentRecord.customerPhone || '',
        category: 'Billing',
        title: ticketTitle,
        description: ticketDescription,
        status: 'Open',
        assignedTeam: 'Billing',
        messages: [initialMessage],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nextTickets = [newTicket, ...supportTickets()];
      await saveSupportTickets(nextTickets);

      logAction('Created', 'SupportTicket', newTicket.ticketNo, `Auto-raised refund billing ticket: ${ticketTitle}`, orgId);
      showNotification(`Refund initiated successfully. Refund ID: ${refundId}`);
    } catch (err: any) {
      console.error("Refund processing error:", err);
      alert(`Refund Error: ${err.message}`);
    }
  };

  const handleCreateSupportTicket = async (
    category: 'Technical' | 'Billing' | 'General',
    title: string,
    description: string,
    attachmentFile?: File
  ) => {
    try {
      let attachmentUrl = '';
      let attachmentName = '';
      const ticketId = 'tkt_' + Date.now();

      if (attachmentFile && isAppwriteConfigured()) {
        try {
          const customName = `ticket_attach_${ticketId}_initial`;
          attachmentUrl = await appwrite.uploadTicketFile(attachmentFile, customName);
          attachmentName = attachmentFile.name;
        } catch (err) {
          console.error('Failed to upload initial attachment:', err);
        }
      }

      const initialMessage = attachmentFile ? {
        id: `msg-${Date.now()}`,
        sender: 'User' as const,
        senderName: currentUser()?.name || currentUser()?.email || 'User',
        senderEmail: currentUser()?.email || '',
        content: description,
        timestamp: new Date().toISOString(),
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
      } : null;

      const newTicket = createRecord<SupportTicket>({
        id: ticketId,
        ticketNo: 'TKT-' + Math.floor(100000 + Math.random() * 900000),
        organizationId: currentUserOrgId() || '',
        requesterName: currentUser()?.name || currentUser()?.email || 'Unknown User',
        requesterEmail: currentUser()?.email || '',
        requesterPhone: currentUserRights()?.phone || '',
        category,
        title,
        description,
        status: 'Open',
        assignedTeam: category,
        messages: initialMessage ? [initialMessage] : [],
      }, currentUserId());

      const nextTickets = [newTicket, ...supportTickets()];
      await saveSupportTickets(nextTickets);
      logAction('Created', 'SupportTicket', newTicket.ticketNo, `Raised support ticket: ${title}`);
      showNotification(`Support ticket #${newTicket.ticketNo} raised successfully.`);
    } catch (err: any) {
      console.error(`handleCreateSupportTicket error:`, err);
      throw err;
    }
  };

  const getClientUnreadTicketsCount = () => {
    const isBackend = currentUserOrgId() === 'org_backend' || !!currentUserRights()?.isSuperAdmin;
    const myTickets = supportTickets().filter(st => {
      if (isBackend) return true;
      if (!st.organizationId || st.organizationId === 'org_default') return true;
      return (st.organizationId || '').toLowerCase().trim() === (currentUserOrgId() || 'org_default').toLowerCase().trim();
    });
    let totalUnread = 0;
    myTickets.forEach(t => {
      if (t.status === 'Closed') return;
      const msgs = t.messages || [];
      if (msgs.length === 0) return;
      const lastReadMsgId = t.userLastReadMessageId || localStorage.getItem(`ttt_tkt_read_${t.id}`);
      if (!lastReadMsgId) {
        const agentMsgsCount = msgs.filter(m => m.sender === 'Agent').length;
        if (agentMsgsCount > 0) totalUnread++;
      } else {
        const lastReadIndex = msgs.findIndex(m => m.id === lastReadMsgId);
        if (lastReadIndex === -1) {
          const agentMsgsCount = msgs.filter(m => m.sender === 'Agent').length;
          if (agentMsgsCount > 0) totalUnread++;
        } else {
          const unreadCount = msgs.slice(lastReadIndex + 1).filter(m => m.sender === 'Agent').length;
          if (unreadCount > 0) totalUnread++;
        }
      }
    });
    return totalUnread;
  };

  const getAgentUnreadTicketsCount = () => {
    const myRights = userRightsList().find(u => u.email === currentUser()?.email);
    const mySupportRoles = Array.isArray(myRights?.supportRole)
      ? myRights.supportRole
      : (typeof myRights?.supportRole === 'string' && myRights.supportRole !== 'None' && myRights.supportRole !== ''
        ? [myRights.supportRole]
        : []);
    const isSuperAdmin = myRights?.role === 'SuperAdmin';

    const filtered = supportTickets().filter(t => {
      if (isSuperAdmin) return true;
      return mySupportRoles.includes(t.assignedTeam as any);
    });

    let totalUnread = 0;
    filtered.forEach(t => {
      if (t.status === 'Closed') return;
      const msgs = t.messages || [];
      const lastReadMsgId = t.agentLastReadMessageId || localStorage.getItem(`ttt_tkt_agent_read_${t.id}`);

      if (msgs.length === 0) {
        if (!lastReadMsgId) totalUnread++;
      } else {
        if (!lastReadMsgId) {
          const userMsgsCount = msgs.filter(m => m.sender === 'User').length;
          if (userMsgsCount > 0) totalUnread++;
        } else if (lastReadMsgId === 'read') {
          const userMsgsCount = msgs.filter(m => m.sender === 'User').length;
          if (userMsgsCount > 0) totalUnread++;
        } else {
          const lastReadIndex = msgs.findIndex(m => m.id === lastReadMsgId);
          if (lastReadIndex === -1) {
            const userMsgsCount = msgs.filter(m => m.sender === 'User').length;
            if (userMsgsCount > 0) totalUnread++;
          } else {
            const unreadCount = msgs.slice(lastReadIndex + 1).filter(m => m.sender === 'User').length;
            if (unreadCount > 0) totalUnread++;
          }
        }
      }
    });
    return totalUnread;
  };

  const handleSendSupportTicketMessage = async (
    ticketId: string,
    content: string,
    attachmentFile?: File
  ) => {
    try {
      let attachmentUrl = '';
      let attachmentName = '';

      if (attachmentFile && isAppwriteConfigured()) {
        try {
          const customName = `ticket_attach_${ticketId}_${Date.now()}`;
          attachmentUrl = await appwrite.uploadTicketFile(attachmentFile, customName);
          attachmentName = attachmentFile.name;
        } catch (err) {
          console.error('Failed to upload attachment:', err);
        }
      }

      const myRights = userRightsList().find(u => u.email === currentUser()?.email);
      const isSupportAgent = currentUserOrgId() === 'org_backend' || myRights?.role === 'SuperAdmin';

      const newMessage = {
        id: `msg-${Date.now()}`,
        sender: (isSupportAgent ? 'Agent' : 'User') as 'User' | 'Agent',
        senderName: currentUser()?.name || currentUser()?.email || 'User',
        senderEmail: currentUser()?.email || '',
        content,
        timestamp: new Date().toISOString(),
        attachmentUrl: attachmentUrl || undefined,
        attachmentName: attachmentName || undefined,
      };

      const nextTickets = supportTickets().map(t => {
        if (t.id === ticketId) {
          const updated = mutateRecord<SupportTicket>(t, {
            status: t.status === 'Closed' ? ('Open' as const) : t.status,
            messages: [...(t.messages || []), newMessage],
          }, currentUserId());
          return updated;
        }
        return t;
      });

      await saveSupportTickets(nextTickets);
      
      // Trigger instant sync on all connected clients
      setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any)._triggerSupportTicketSync) {
          (window as any)._triggerSupportTicketSync();
        }
      }, 100);
      
      logAction('Edited', 'SupportTicket', ticketId, `Sent message on support ticket`);
    } catch (err: any) {
      console.error(`handleSendSupportTicketMessage error:`, err);
      throw err;
    }
  };

  return {
    supportTickets,
    setSupportTickets,
    activeTicketId,
    setActiveTicketId,
    saveSupportTickets,
    handleCreateSupportTicket,
    handleSendSupportTicketMessage,
    handleInitiateRefund,
    getClientUnreadTicketsCount,
    getAgentUnreadTicketsCount
  };
}
