import React, { useState, useEffect, useRef } from 'react';
import { SupportTicket, TicketMessage } from '../types';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { MessageSquare, Plus, Paperclip, Send, X, FileText, Download, CheckCircle, Loader2 } from 'lucide-react';

interface ProfileSupportTicketsProps {
  tickets: SupportTicket[];
  currentUser: any;
  onCreateTicket: (category: 'Technical' | 'Billing' | 'General', title: string, description: string, attachmentFile?: File) => Promise<void>;
  onSendMessage: (ticketId: string, content: string, attachmentFile?: File) => Promise<void>;
  isBackendTeam?: boolean;
}

export default function ProfileSupportTickets({
  tickets,
  currentUser,
  onCreateTicket,
  onSendMessage,
  isBackendTeam = false
}: ProfileSupportTicketsProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create Form States
  const [category, setCategory] = useState<'Technical' | 'Billing' | 'General'>('General');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Chat States
  const [chatInput, setChatInput] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  // Mark selected ticket as read for the user
  useEffect(() => {
    if (selectedTicket) {
      const msgs = selectedTicket.messages || [];
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        localStorage.setItem(`ttt_tkt_read_${selectedTicket.id}`, lastMsg.id);
      } else {
        localStorage.setItem(`ttt_tkt_read_${selectedTicket.id}`, 'read');
      }
    }
  }, [selectedTicket, selectedTicket?.messages]);

  const getUnreadInfo = (t: SupportTicket) => {
    if (t.status === 'Closed') return { count: 0, hasUnread: false };
    const msgs = t.messages || [];
    if (msgs.length === 0) return { count: 0, hasUnread: false };
    
    const lastReadMsgId = localStorage.getItem(`ttt_tkt_read_${t.id}`);
    if (!lastReadMsgId) {
      const agentMsgs = msgs.filter(m => m.sender === 'Agent');
      return { count: agentMsgs.length, hasUnread: agentMsgs.length > 0 };
    }
    
    const lastReadIndex = msgs.findIndex(m => m.id === lastReadMsgId);
    const unreadAgentMsgs = msgs.slice(lastReadIndex + 1).filter(m => m.sender === 'Agent');
    return { count: unreadAgentMsgs.length, hasUnread: unreadAgentMsgs.length > 0 };
  };

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.messages]);

  // Pre-resolve secure file URLs for attachments in the current ticket
  useEffect(() => {
    if (!selectedTicket) return;
    const newUrls = { ...resolvedUrls };
    let changed = false;
    for (const msg of selectedTicket.messages) {
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
  }, [selectedTicket]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsCreating(true);
    try {
      await onCreateTicket(category, title, description, createFile || undefined);
      setTitle('');
      setDescription('');
      setCategory('General');
      setCreateFile(null);
      setShowCreateModal(false);
    } catch (err) {
      alert('Failed to raise ticket. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || (!chatInput.trim() && !chatFile)) return;

    setIsSending(true);
    try {
      await onSendMessage(selectedTicketId, chatInput, chatFile || undefined);
      setChatInput('');
      setChatFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      alert('Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-[550px] bg-slate-50 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
      {/* LEFT SIDEBAR: Ticket List */}
      <div className="w-1/3 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
          <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            Support Tickets
          </h4>
          {!isBackendTeam && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2.5 py-1.5 rounded-lg text-[10px] transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3 h-3" /> New Ticket
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2 space-y-1">
          {tickets.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs italic">
              No tickets raised yet.
            </div>
          ) : (
            tickets.map((t) => {
              const lastMsg = t.messages?.[t.messages.length - 1];
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    selectedTicketId === t.id
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-l-4 border-blue-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-[10px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1.5">
                      #{t.ticketNo}
                      {getUnreadInfo(t).hasUnread && (
                        <span className="flex items-center justify-center bg-rose-500 text-white rounded-full text-[9px] px-1 min-w-[14px] h-[14px] font-sans font-bold leading-none animate-pulse">
                          {getUnreadInfo(t).count}
                        </span>
                      )}
                    </span>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        t.status === 'Open'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/40'
                          : t.status === 'In Progress'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-450 border border-amber-100 dark:border-amber-900/40'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="font-bold text-xs text-slate-805 dark:text-slate-200 truncate mb-1">
                    {t.title}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {lastMsg ? lastMsg.content : t.description}
                  </div>
                  <div className="flex justify-between items-center mt-2 text-[9px] text-slate-400 font-medium">
                    <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] font-semibold">
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

      {/* RIGHT SIDEBAR: Chat Pane */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/35">
        {selectedTicket ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shadow-3xs">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs font-mono">
                    #{selectedTicket.ticketNo}
                  </h4>
                  <span className="text-slate-450 dark:text-slate-550 text-xs">•</span>
                  <span className="font-semibold text-xs text-slate-700 dark:text-slate-350">
                    {selectedTicket.title}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Category: <span className="font-bold">{selectedTicket.category}</span> | Raised by {selectedTicket.requesterName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedTicket.status === 'Open'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30'
                      : selectedTicket.status === 'In Progress'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                  }`}
                >
                  {selectedTicket.status}
                </span>
              </div>
            </div>

            {/* Description card */}
            <div className="p-3 mx-4 mt-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-650 dark:text-slate-350 shadow-3xs">
              <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Issue Details</span>
              <p className="whitespace-pre-line leading-relaxed">{selectedTicket.description}</p>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedTicket.messages?.map((msg) => {
                const isUser = msg.sender === 'User';
                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl p-3 border shadow-3xs text-xs ${
                        isUser
                          ? 'bg-blue-600 text-white border-blue-500 rounded-tr-none'
                          : 'bg-purple-50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-300 border-purple-100 dark:border-purple-900/30 rounded-tl-none'
                      }`}
                    >
                      <div className="flex justify-between items-center gap-4 mb-1 text-[9px] opacity-75 font-semibold">
                        <span className="flex items-center gap-1">
                          {msg.senderName}
                          {!isUser && (
                            <span className="bg-purple-200 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold scale-90">
                              Support Team
                            </span>
                          )}
                        </span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="whitespace-pre-line leading-relaxed font-sans">{msg.content}</p>

                      {msg.attachmentUrl && (
                        <div className={`mt-2 p-1.5 rounded flex items-center justify-between gap-3 text-[10px] ${
                          isUser ? 'bg-blue-700/60 border border-blue-600/40 text-blue-50' : 'bg-purple-100/40 dark:bg-purple-950/60 border border-purple-200/30 dark:border-purple-900/30 text-purple-800 dark:text-purple-350'
                        }`}>
                          <div className="flex items-center gap-1.5 truncate">
                            <FileText className="w-3.5 h-3.5 shrink-0 opacity-80" />
                            <span className="truncate max-w-[130px] font-mono">{msg.attachmentName || 'Attachment'}</span>
                          </div>
                          {resolvedUrls[msg.id] ? (
                            <a
                              href={
                                // Resolve the proper download URL from the ticket bucket
                                (() => {
                                  const isFileId = !msg.attachmentUrl!.startsWith('http');
                                  if (isFileId && isAppwriteConfigured()) {
                                    return appwrite.getTicketFileDownload(msg.attachmentUrl!);
                                  }
                                  return resolvedUrls[msg.id];
                                })()
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              download={msg.attachmentName || true}
                              className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0 ${isUser ? 'text-white' : 'text-purple-600'}`}
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

            {/* Chat Input Footer */}
            <form onSubmit={handleSendChat} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              {chatFile && (
                <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 rounded-lg px-2.5 py-1 text-[10px] text-blue-700 dark:text-blue-400 font-medium">
                  <div className="flex items-center gap-1.5 truncate">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate max-w-[200px] font-mono">{chatFile.name}</span>
                  </div>
                  <button type="button" onClick={() => setChatFile(null)} className="text-slate-400 hover:text-slate-650 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => setChatFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending}
                  className="p-2 text-slate-450 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition shrink-0 cursor-pointer disabled:opacity-50"
                  title="Attach file document"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isSending}
                  placeholder={selectedTicket.status === 'Closed' ? 'This ticket is closed. Reopen to reply.' : 'Type message here...'}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 disabled:opacity-60"
                  readOnly={selectedTicket.status === 'Closed'}
                />
                <button
                  type="submit"
                  disabled={isSending || (selectedTicket.status === 'Closed') || (!chatInput.trim() && !chatFile)}
                  className="p-2 bg-blue-600 hover:bg-blue-750 text-white rounded-lg transition shrink-0 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageSquare className="w-12 h-12 text-slate-350 dark:text-slate-700 mb-2.5 animate-bounce-slow" />
            <p className="font-bold text-slate-700 dark:text-slate-400 text-xs">Select a Support Ticket</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-550 mt-1 max-w-[240px]">
              Raise a support ticket to chat with technical, billing or general help desk agents.
            </p>
          </div>
        )}
      </div>

      {/* CREATE TICKET MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-150 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl animate-fade-in text-left">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-3.5">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Raise Help Support Ticket</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateFile(null);
                }}
                className="text-slate-400 hover:text-slate-605 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-650 dark:text-slate-450 uppercase tracking-wider mb-1">Issue Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Technical">Technical Support</option>
                  <option value="Billing">Billing / Accounts Inquiry</option>
                  <option value="General">General Questions</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-650 dark:text-slate-450 uppercase tracking-wider mb-1">Ticket Title</label>
                <input
                  type="text"
                  placeholder="Summarize the issue (e.g. Sync errors on trip mileage)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-805 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-650 dark:text-slate-450 uppercase tracking-wider mb-1">Details / Description</label>
                <textarea
                  rows={4}
                  placeholder="Describe the issue in details so we can troubleshoot..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-805 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 font-medium resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-650 dark:text-slate-450 uppercase tracking-wider mb-1">Upload Document Attachment (Optional)</label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                  <input
                    type="file"
                    onChange={(e) => setCreateFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  {createFile && (
                    <button type="button" onClick={() => setCreateFile(null)} className="text-red-500 hover:underline text-[10px] shrink-0 font-bold">
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateFile(null);
                  }}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !title.trim() || !description.trim()}
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-xs shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isCreating ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
