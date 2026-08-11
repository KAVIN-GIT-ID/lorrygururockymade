import { createSignal, createEffect, createMemo, onMount, onCleanup, For } from 'solid-js';

import { SupportTicket } from '../types';
import ReportPreviewModal from './ReportPreviewModal';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { MessageSquare, Plus, Paperclip, Send, X, FileText, Download, CheckCircle, Loader2 } from 'lucide-solid';
import { useLanguage } from '../context/LanguageContext';

interface ProfileSupportTicketsProps {
  tickets: SupportTicket[] | (() => SupportTicket[]);
  onCreateTicket: (category: 'Technical' | 'Billing' | 'General', title: string, description: string, attachmentFile?: File) => Promise<void>;
  onSendMessage: (ticketId: string, content: string, attachmentFile?: File) => Promise<void>;
  isBackendTeam?: boolean;
  payments: any[];
  orgName: string;
  gstNo: string;
  panNo: string;
  address: string;
}

export default function ProfileSupportTickets(props: ProfileSupportTicketsProps) {
  const [selectedTicketId, setSelectedTicketId] = createSignal<string | null>(null);
  const [previewHtml, setPreviewHtml] = createSignal<string | null>(null);
  const [previewTitle, setPreviewTitle] = createSignal<string>('');
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'TICKETS' | 'BILLING'>('TICKETS');
  
  // Create Form States
  const [category, setCategory] = createSignal<'Technical' | 'Billing' | 'General'>('General');
  const [title, setTitle] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [createFile, setCreateFile] = createSignal<File | null>(null);
  const [isCreating, setIsCreating] = createSignal(false);

  // Chat States
  const [chatInput, setChatInput] = createSignal('');
  const [chatFile, setChatFile] = createSignal<File | null>(null);
  const [isSending, setIsSending] = createSignal(false);
  const [resolvedUrls, setResolvedUrls] = createSignal<Record<string, string>>({});
  const [typingAgent, setTypingAgent] = createSignal('');

  let chatEndRef: HTMLDivElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;
  let typingTimeout: any = null;

  onMount(() => {
    if (isAppwriteConfigured()) {
      appwrite.registerPushNotificationTarget().catch(() => {});
    }

    const handleCustomWsMessage = (e: any) => {
      const data = e.detail;
      if (!data) return;
      if (data.type === 'ttt:typing_start' && data.ticketId === selectedTicketId()) {
        setTypingAgent(data.senderName || 'Support Agent');
      } else if (data.type === 'ttt:typing_stop' && data.ticketId === selectedTicketId()) {
        setTypingAgent('');
      }
    };
    window.addEventListener('ttt_ws_message', handleCustomWsMessage);
    onCleanup(() => window.removeEventListener('ttt_ws_message', handleCustomWsMessage));
  });

  const emitTyping = (isTyping: boolean) => {
    const t = selectedTicket();
    if (!t) return;
    const ws = (window as any)._ttt_websocket;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: isTyping ? 'ttt:typing_start' : 'ttt:typing_stop',
        ticketId: t.id,
        senderName: 'User',
        isAgent: false,
        organizationId: t.organizationId,
        requesterEmail: t.requesterEmail
      }));
    }
  };

  const handleInputChange = (val: string) => {
    setChatInput(val);
    emitTyping(true);
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      emitTyping(false);
    }, 2500);
  };

  const uniqueTickets = createMemo(() => {
    const seen = new Set<string>();
    const raw = typeof props.tickets === 'function' ? props.tickets() : (props.tickets || []);
    return raw.filter((t) => {
      if (!t || !t.id) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  });

  const selectedTicket = createMemo(() => uniqueTickets().find((t) => t.id === selectedTicketId()));

  // Mark selected ticket as read for the user & persist to DB so mobile/other devices sync
  createEffect(() => {
    const t = selectedTicket();
    if (t) {
      const msgs = t.messages || [];
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      const targetReadId = lastMsg ? lastMsg.id : 'read';

      localStorage.setItem(`ttt_tkt_read_${t.id}`, targetReadId);

      if (t.userLastReadMessageId !== targetReadId) {
        t.userLastReadMessageId = targetReadId;
        const updated = { ...t, userLastReadMessageId: targetReadId };
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        if (isAppwriteConfigured()) {
          appwrite.saveFleetDocument(databaseId, 'support_tickets', t.id, t.organizationId || 'org_default', updated).catch(() => {});
        }
      }
    }
  });

  const getUnreadInfo = (t: SupportTicket) => {
    if (t.status === 'Closed') return { count: 0, hasUnread: false };
    const msgs = t.messages || [];
    if (msgs.length === 0) return { count: 0, hasUnread: false };
    
    const lastReadMsgId = t.userLastReadMessageId || localStorage.getItem(`ttt_tkt_read_${t.id}`);
    if (!lastReadMsgId) {
      const agentMsgs = msgs.filter(m => m.sender === 'Agent');
      return { count: agentMsgs.length, hasUnread: agentMsgs.length > 0 };
    }
    
    const lastReadIndex = msgs.findIndex(m => m.id === lastReadMsgId);
    if (lastReadIndex === -1) {
      const agentMsgs = msgs.filter(m => m.sender === 'Agent');
      return { count: agentMsgs.length, hasUnread: agentMsgs.length > 0 };
    }

    const unreadAgentMsgs = msgs.slice(lastReadIndex + 1).filter(m => m.sender === 'Agent');
    return { count: unreadAgentMsgs.length, hasUnread: unreadAgentMsgs.length > 0 };
  };

  // Scroll to bottom of chat when messages change
  createEffect(() => {
    const ticket = selectedTicket();
    if (ticket) {
      const _len = (ticket.messages || []).length;
      const _id = ticket.id;
      chatEndRef?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Pre-resolve secure file URLs for attachments in the current ticket
  createEffect(() => {
    if (!selectedTicket()) return;
    const newUrls = { ...resolvedUrls() };
    let changed = false;
    const messages = Array.isArray(selectedTicket().messages) ? selectedTicket().messages : [];
    for (const msg of messages) {
      if (msg.attachmentUrl && !newUrls[msg.id]) {
        // Check if attachmentUrl is a file ID (does not start with http)
        const isFileId = !msg.attachmentUrl.startsWith('http');
        if (isFileId && isAppwriteConfigured()) {
          // Use ticket-specific bucket view URL (permanent, not a blob)
          const url = appwrite.getTicketFileView(msg.attachmentUrl);
          if (url) {
            newUrls[msg.id] = url;
            changed = true;
          }
        } else if (msg.attachmentUrl) {
          newUrls[msg.id] = msg.attachmentUrl;
          changed = true;
        }
      }
    }
    if (changed) {
      setResolvedUrls(newUrls);
    }
  });

  const handleCreateSubmit = async (e: Event) => {
    e.preventDefault();
    if (!title().trim() || !description().trim()) return;

    setIsCreating(true);
    try {
      await props.onCreateTicket(category(), title(), description(), createFile() || undefined);
      setTitle('');
      setDescription('');
      setCategory('General');
      setCreateFile(null);
      setShowCreateModal(false);
    } catch (err: any) {
      console.error('Failed to raise ticket:', err);
      alert('Failed to raise ticket. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendChat = async (e: Event) => {
    e.preventDefault();
    if (!selectedTicketId() || (!chatInput().trim() && !chatFile())) return;

    setIsSending(true);
    try {
      await props.onSendMessage(selectedTicketId(), chatInput(), chatFile() || undefined);
      setChatInput('');
      setChatFile(null);
      if (fileInputRef) fileInputRef.value = '';
    } catch (err: any) {
      console.error('Failed to send message:', err);
      alert('Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadInvoice = (payment: any) => {
    const invoiceNo = 'INV-' + payment.transactionId;
    const baseAmount = (payment.amount / 1.18).toFixed(2);
    const gstAmount = (payment.amount - parseFloat(baseAmount)).toFixed(2);
    const cgst = (parseFloat(gstAmount) / 2).toFixed(2);
    const sgst = cgst;

    const htmlContent = `
      <html>
        <head>
          <title>Tax Invoice - ${invoiceNo}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 40px; line-height: 1.5; }
            .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, .05); font-size: 14px; }
            .invoice-header { display: flex; justify-content: space-between; border-bottom: 2px solid #5f259f; padding-bottom: 20px; margin-bottom: 20px; }
            .vendor-details h2 { margin: 0; color: #5f259f; font-size: 24px; font-weight: 800; }
            .vendor-details p { margin: 4px 0; font-size: 12px; color: #666; }
            .invoice-title { text-align: right; }
            .invoice-title h1 { margin: 0; font-size: 22px; color: #333; font-weight: 800; text-transform: uppercase; }
            .invoice-title p { margin: 4px 0; font-size: 12px; color: #666; font-family: monospace; }
            .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 13px; }
            .bill-to h3 { margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #888; letter-spacing: 1px; }
            .bill-to p { margin: 4px 0; font-weight: 600; }
            .bill-to span { display: block; color: #555; margin-top: 2px; }
            .invoice-info p { margin: 4px 0; text-align: right; }
            .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .invoice-table th { background: #5f259f; color: #fff; padding: 10px; font-size: 12px; text-transform: uppercase; font-weight: 700; }
            .invoice-table td { padding: 12px 10px; border-bottom: 1px solid #eee; }
            .invoice-table .text-right { text-align: right; }
            .totals { display: flex; justify-content: flex-end; margin-bottom: 40px; }
            .totals-table { width: 250px; border-collapse: collapse; }
            .totals-table td { padding: 6px 10px; font-size: 13px; }
            .totals-table tr.grand-total td { font-weight: bold; font-size: 16px; border-top: 2px solid #5f259f; border-bottom: 2px solid #5f259f; color: #5f259f; }
            .footer { text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 20px; margin-top: 40px; }
            .paid-badge { display: inline-block; padding: 4px 10px; background: #e6f4ea; color: #137333; border: 1px solid #137333; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 12px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="invoice-header">
              <div class="vendor-details">
                <h2>Lorry Guru Technologies</h2>
                <p>Salem Main Road, Iveli</p>
                <p>Salem, Tamil Nadu, 637501</p>
                <p>GSTIN: 33AAFCL8686P1Z4 | PAN: AAFCL8686P</p>
              </div>
              <div class="invoice-title">
                <h1>Tax Invoice</h1>
                <p>No: ${invoiceNo}</p>
                <div class="paid-badge">Paid</div>
              </div>
            </div>
            
            <div class="invoice-details">
              <div class="bill-to">
                <h3>Billed To</h3>
                <p>${props.orgName || 'Lorry Owner'}</p>
                <span>Address: ${props.address || 'Not Provided'}</span>
                <span>GSTIN: ${props.gstNo || 'Not Provided'}</span>
                <span>PAN: ${props.panNo || 'Not Provided'}</span>
              </div>
              <div class="invoice-info">
                <p><strong>Invoice Date:</strong> ${new Date(payment.paymentDate).toLocaleDateString()}</p>
                <p><strong>Payment Mode:</strong> PhonePe (${payment.paymentMethod || 'UPI'})</p>
                <p><strong>Transaction Ref:</strong> ${payment.transactionId}</p>
              </div>
            </div>
            
            <table width="100%" class="invoice-table">
              <thead>
                <tr>
                  <th align="left">Description</th>
                  <th align="center">Duration</th>
                  <th align="right">Base Price</th>
                  <th align="right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Lorry Guru Fleet Software Subscription</strong><br/>
                    <span style="font-size: 11px; color: #666;">Software access subscription fee for vehicle: ${payment.truckNo}</span>
                  </td>
                  <td align="center">${payment.duration}</td>
                  <td align="right">₹${baseAmount}</td>
                  <td align="right">₹${baseAmount}</td>
                </tr>
              </tbody>
            </table>
            
            <div class="totals">
              <table class="totals-table">
                <tr>
                  <td>Subtotal (Taxable):</td>
                  <td align="right">₹${baseAmount}</td>
                </tr>
                <tr>
                  <td>CGST (9%):</td>
                  <td align="right">₹${cgst}</td>
                </tr>
                <tr>
                  <td>SGST (9%):</td>
                  <td align="right">₹${sgst}</td>
                </tr>
                <tr class="grand-total">
                  <td>Total Paid:</td>
                  <td align="right">₹${payment.amount}</td>
                </tr>
              </table>
            </div>
            
            <div class="footer">
              <p>Thank you for choosing Lorry Guru Technologies!</p>
              <p>This is a computer-generated tax invoice and does not require a physical signature.</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    setPreviewHtml(htmlContent);
    setPreviewTitle(`Tax Invoice - ${invoiceNo}`);
  };

  return (
    <div class="flex h-[550px] bg-slate-50 dark:bg-slate-955 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
      {/* LEFT SIDEBAR: Ticket List */}
      <div class="w-1/3 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
        <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
          <h4 class="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare class="w-4 h-4 text-blue-600" />
            Support Help Desk
          </h4>
          {activeTab() === 'TICKETS' && !props.isBackendTeam && (
            <button
              onClick={() => setShowCreateModal(true)}
              class="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2.5 py-1.5 rounded-lg text-[10px] transition shadow-xs cursor-pointer"
            >
              <Plus class="w-3 h-3" /> New
            </button>
          )}
        </div>

        <div class="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
          {uniqueTickets().length === 0 ? (
            <div class="p-8 text-center text-slate-400 dark:text-slate-550 text-xs italic">
              No tickets raised yet.
            </div>
          ) : (
            <For each={uniqueTickets()}>
              {(t) => {
                const lastMsg = () => t.messages?.[t.messages.length - 1];
                return (
                  <button
                    onClick={() => setSelectedTicketId(t.id)}
                    class={`w-full text-left p-3 rounded-xl transition-all ${
                      selectedTicketId() === t.id
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-l-4 border-blue-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-4 border-transparent'
                    }`}
                  >
                    <div class="flex justify-between items-start mb-1">
                      <span class="font-bold text-[10px] text-slate-400 dark:text-slate-555 font-mono flex items-center gap-1.5">
                        #{t.ticketNo}
                        {getUnreadInfo(t).hasUnread && (
                          <span class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                        )}
                      </span>
                      <span class={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                        t.status === 'Open' ? 'bg-emerald-50 text-emerald-600' :
                        t.status === 'In Progress' ? 'bg-amber-50 text-amber-600 animate-pulse' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <div class="font-bold text-xs text-slate-800 dark:text-slate-200 truncate mb-1">
                      {t.title}
                    </div>
                    <div class="text-[10px] text-slate-400 dark:text-slate-555 truncate">
                      {lastMsg() ? lastMsg()!.content : t.description}
                    </div>
                    <div class="flex justify-between items-center mt-2 text-[9px] text-slate-400 font-medium">
                      <span class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] font-semibold">
                        {t.category}
                      </span>
                      <span>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                  </button>
                );
              }}
            </For>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: Chat Pane */}
      <div class="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/35 overflow-hidden">
        {selectedTicket() ? (
          <>
            {/* Header */}
            <div class="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shadow-3xs">
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="font-bold text-slate-800 dark:text-slate-200 text-xs font-mono">
                    #{selectedTicket().ticketNo}
                  </h4>
                  <span class="text-slate-450 dark:text-slate-555 text-xs">•</span>
                  <span class="font-semibold text-xs text-slate-700 dark:text-slate-350">
                    {selectedTicket().title}
                  </span>
                </div>
                <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Category: <span class="font-bold">{selectedTicket().category}</span> | Raised by {selectedTicket().requesterName}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span
                  class={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedTicket().status === 'Open'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30'
                      : selectedTicket().status === 'In Progress'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                  }`}
                >
                  {selectedTicket().status}
                </span>
              </div>
            </div>

            {/* Chat Messages */}
            <div class="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Requester original issue details */}
              <div class="p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 shadow-3xs text-left animate-fade-in">
                <span class="font-bold text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Issue Details</span>
                <p class="whitespace-pre-line leading-relaxed font-sans">{selectedTicket().description}</p>
              </div>

              <For each={selectedTicket()?.messages || []}>
                {(msg) => {
                  const isSystem = msg.senderName === 'System Notification' || msg.senderEmail === 'system@ttt.com';
                  const isUser = msg.sender === 'User';
                  
                  if (isSystem) {
                    return (
                      <div class="flex justify-center my-2">
                        <div class="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-550/20 rounded-lg px-3 py-1.5 text-[11px] max-w-[85%] text-center font-medium shadow-3xs">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div class={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div
                        class={`max-w-[75%] rounded-2xl p-3 border shadow-3xs text-xs text-left ${
                          isUser
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent rounded-tr-none shadow-md shadow-blue-500/10'
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/60 rounded-tl-none'
                        }`}
                      >
                        <div class="flex justify-between items-center gap-4 mb-1 text-[9px] opacity-75 font-semibold">
                          <span class="flex items-center gap-1">
                            {msg.senderName}
                            {!isUser && (
                              <span class="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold scale-90">
                                Support Team
                              </span>
                            )}
                          </span>
                          <span class="flex items-center gap-1">
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isUser && (
                              <span class="inline-flex items-center ml-0.5 text-[10px]" title={
                                (() => {
                                  const lastReadId = selectedTicket()?.agentLastReadMessageId;
                                  const msgs = selectedTicket()?.messages || [];
                                  const lastReadIndex = msgs.findIndex(m => m.id === lastReadId);
                                  const myIndex = msgs.findIndex(m => m.id === msg.id);
                                  if (lastReadId && lastReadIndex !== -1 && myIndex <= lastReadIndex) return 'Read';
                                  return 'Delivered';
                                })()
                              }>
                                {(() => {
                                  const lastReadId = selectedTicket()?.agentLastReadMessageId;
                                  const msgs = selectedTicket()?.messages || [];
                                  const lastReadIndex = msgs.findIndex(m => m.id === lastReadId);
                                  const myIndex = msgs.findIndex(m => m.id === msg.id);
                                  const isRead = lastReadId && (lastReadId === 'read' || (lastReadIndex !== -1 && myIndex <= lastReadIndex));

                                  if (isRead) {
                                    return <span class="text-cyan-300 font-extrabold flex items-center -space-x-1 ml-0.5"><span>✓</span><span>✓</span></span>;
                                  } else {
                                    return <span class="text-blue-200 opacity-90 flex items-center -space-x-1 ml-0.5"><span>✓</span><span>✓</span></span>;
                                  }
                                })()}
                              </span>
                            )}
                          </span>
                        </div>
                        <p class="whitespace-pre-line leading-relaxed font-sans">{msg.content}</p>

                        {msg.attachmentUrl && (
                          <div class={`mt-2 p-1.5 rounded flex items-center justify-between gap-3 text-[10px] ${
                            isUser ? 'bg-blue-700/60 border border-blue-600/40 text-blue-50' : 'bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-350'
                          }`}>
                            <div class="flex items-center gap-1.5 truncate">
                              <FileText class="w-3.5 h-3.5 shrink-0 opacity-80" />
                              <span class="truncate max-w-[130px] font-mono">{msg.attachmentName || 'Attachment'}</span>
                            </div>
                            {resolvedUrls()[msg.id] ? (
                              <a
                                href={
                                  (() => {
                                    const isFileId = !msg.attachmentUrl.startsWith('http');
                                    if (isFileId && isAppwriteConfigured()) {
                                      return appwrite.getTicketFileDownload(msg.attachmentUrl);
                                    }
                                    return resolvedUrls()[msg.id];
                                  })()
                                }
                                download=""
                                class={`p-1 rounded hover:bg-black/10 transition ${isUser ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`}
                              >
                                <Download class="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <span class="text-[8px] opacity-65">Resolving...</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              </For>

              {/* Typing Indicator Bubble */}
              {typingAgent() && (
                <div class="flex justify-start my-1 animate-fade-in">
                  <div class="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl rounded-tl-none px-3.5 py-2 text-xs flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <span class="font-bold text-[11px] text-purple-600 dark:text-purple-400">{typingAgent()}</span>
                    <span class="text-[10px] text-slate-400 italic">is typing...</span>
                    <span class="flex gap-1 items-center ml-1">
                      <span class="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ "animation-delay": "0ms" }} />
                      <span class="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ "animation-delay": "150ms" }} />
                      <span class="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ "animation-delay": "300ms" }} />
                    </span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Message Input Panel */}
            {selectedTicket().status !== 'Closed' ? (
              <form onSubmit={handleSendChat} class="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2 items-center">
                <div class="relative flex-1">
                  <input
                    type="text"
                    placeholder="Type your reply here..."
                    value={chatInput()}
                    onInput={(e) => handleInputChange(e.currentTarget.value)}
                    onBlur={() => emitTyping(false)}
                    class="w-full h-10 pl-3 pr-24 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-semibold"
                  />
                  
                  <div class="absolute right-2 top-1.5 flex items-center gap-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => setChatFile(e.target.files?.[0] || null)}
                      class="hidden"
                      id="chat-attach-file"
                    />
                    <label
                      for="chat-attach-file"
                      class={`p-1 rounded-lg transition cursor-pointer ${chatFile() ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      title={chatFile() ? `File chosen: ${chatFile().name}` : "Attach file"}
                    >
                      <Paperclip class="w-4 h-4" />
                    </label>
                    {chatFile() && (
                      <button
                        type="button"
                        onClick={() => { setChatFile(null); if (fileInputRef) fileInputRef.value = ''; }}
                        class="p-1 rounded-lg text-rose-500 hover:bg-rose-50"
                      >
                        <X class="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSending() || (!chatInput().trim() && !chatFile())}
                  class="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50"
                >
                  {isSending() ? <Loader2 class="w-4 h-4 animate-spin" /> : <Send class="w-4 h-4" />}
                  <span>Send</span>
                </button>
              </form>
            ) : (
              <div class="p-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 font-bold uppercase tracking-wider">
                This support ticket is closed and resolved.
              </div>
            )}
          </>
        ) : (
          <div class="flex-1 flex flex-col items-center justify-center text-slate-450 dark:text-slate-500 font-medium italic">
            Select a support ticket from the sidebar queue.
          </div>
        )}
      </div>

      {/* CREATE TICKET MODAL */}
      {showCreateModal() && (
        <div class="fixed inset-0 z-150 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
          <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl animate-fade-in text-left">
            <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3.5">
              <h3 class="font-bold text-slate-900 dark:text-slate-100 text-sm">Raise Help Support Ticket</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateFile(null);
                }}
                class="text-slate-400 hover:text-slate-605 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} class="space-y-3.5">
              <div>
                <label class="block text-[10px] font-extrabold text-slate-650 dark:text-slate-450 uppercase tracking-wider mb-1">Issue Category</label>
                <select
                  value={category()}
                  onChange={(e) => setCategory(e.target.value as any)}
                  class="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Technical">Technical Support</option>
                  <option value="Billing">Billing / Accounts Inquiry</option>
                  <option value="General">General Questions</option>
                </select>
              </div>

              <div>
                <label class="block text-[10px] font-extrabold text-slate-650 dark:text-slate-450 uppercase tracking-wider mb-1">Ticket Title</label>
                <input
                  type="text"
                  placeholder="Summarize the issue (e.g. Sync errors on trip mileage)"
                  value={title()}
                  onInput={(e) => setTitle(e.currentTarget.value)}
                  required
                  class="w-full bg-slate-50 dark:bg-slate-950 text-slate-805 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 font-semibold"
                />
              </div>

              <div>
                <label class="block text-[10px] font-extrabold text-slate-650 dark:text-slate-450 uppercase tracking-wider mb-1">Details / Description</label>
                <textarea
                  rows={4}
                  placeholder="Describe the issue in details so we can troubleshoot..."
                  value={description()}
                  onInput={(e) => setDescription(e.currentTarget.value)}
                  required
                  class="w-full bg-slate-50 dark:bg-slate-950 text-slate-805 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 font-medium resize-none"
                />
              </div>

              <div>
                <label class="block text-[10px] font-extrabold text-slate-650 dark:text-slate-450 uppercase tracking-wider mb-1">Upload Document Attachment (Optional)</label>
                <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                  <input
                    type="file"
                    onChange={(e) => setCreateFile(e.target.files?.[0] || null)}
                    class="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  {createFile() && (
                    <button type="button" onClick={() => setCreateFile(null)} class="text-red-500 hover:underline text-[10px] shrink-0 font-bold">
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div class="flex justify-end gap-2.5 pt-3.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isCreating()}
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateFile(null);
                  }}
                  class="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating() || !title().trim() || !description().trim()}
                  class="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCreating() && <Loader2 class="w-3.5 h-3.5 animate-spin" />}
                  {isCreating() ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewHtml() && (
        <ReportPreviewModal
          isOpen={!!previewHtml()}
          onClose={() => setPreviewHtml(null)}
          htmlContent={previewHtml()}
          title={previewTitle()}
        />
      )}
    </div>
  );
}
