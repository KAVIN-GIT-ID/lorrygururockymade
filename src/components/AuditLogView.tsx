import { createSignal, createEffect, onMount, onCleanup, Component } from 'solid-js';

import { AuditLog, OrganizationProfile } from '../types';
import { 
  History, 
  Search, 
  Filter, 
  Trash2, 
  Download, 
  Users, 
  CheckCircle, 
  Edit, 
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-solid';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

interface AuditLogViewProps {
  logs: AuditLog[];
  onClearLogs: () => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
  organizationProfiles?: OrganizationProfile[];
  currentUserOrgId?: string;
  organizationId?: string;
}

export default function AuditLogView({ logs, onClearLogs, confirmAction, organizationProfiles, currentUserOrgId, organizationId }: AuditLogViewProps) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal<string>('ALL');
  const [selectedAction, setSelectedAction] = createSignal<string>('ALL');
  const [selectedOrgId, setSelectedOrgId] = createSignal<string>('ALL');
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = createSignal(false);
  const [orgSearchQuery, setOrgSearchQuery] = createSignal('');
  let orgDropdownRef: HTMLDivElement | undefined;
  const [sortField, setSortField] = createSignal<keyof AuditLog>('timestamp');
  const [sortDirection, setSortDirection] = createSignal<'asc' | 'desc'>('desc');

  // Date range filter states
  const [startDateFilter, setStartDateFilter] = createSignal('');
  const [endDateFilter, setEndDateFilter] = createSignal('');

  // Pagination / display states
  const [currentPage, setCurrentPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(15);
  const [displayedLogs, setDisplayedLogs] = createSignal<AuditLog[]>([]);
  const [totalCount, setTotalCount] = createSignal(0);
  const [loading, setLoading] = createSignal(false);

  const online = isAppwriteConfigured();

  onMount(() => {
    setCurrentPage(1);
  });

  createEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (orgDropdownRef && !orgDropdownRef.contains(event.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  });

  const handleSort = (field: keyof AuditLog) => {
    if (sortField() === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Offline / local logic fallback
  createEffect(() => {
    if (!online) {
      const filtered = logs.filter(log => {
        const matchesSearch = 
          log.reference.toLowerCase().includes(searchQuery().toLowerCase()) || 
          log.details.toLowerCase().includes(searchQuery().toLowerCase()) ||
          log.user.toLowerCase().includes(searchQuery().toLowerCase());
        
        const matchesCategory = selectedCategory() === 'ALL' || log.category === selectedCategory();
        const matchesAction = selectedAction() === 'ALL' || log.action === selectedAction();
        const matchesOrg = selectedOrgId() === 'ALL' || log.organizationId === selectedOrgId();

        const matchesStartDate = startDateFilter() ? log.timestamp >= startDateFilter() : true;
        const matchesEndDate = endDateFilter() ? log.timestamp <= (endDateFilter() + ' 23:59:59') : true;

        return matchesSearch && matchesCategory && matchesAction && matchesOrg && matchesStartDate && matchesEndDate;
      });

      const sorted = [...filtered].sort((a, b) => {
        const aVal = String(a[sortField()] || '').toLowerCase();
        const bVal = String(b[sortField()] || '').toLowerCase();
        if (aVal < bVal) return sortDirection() === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection() === 'asc' ? 1 : -1;
        return 0;
      });

      setTotalCount(sorted.length);
      const startIdx = (currentPage() - 1) * pageSize();
      setDisplayedLogs(sorted.slice(startIdx, startIdx + pageSize()));
    }
  });

  // Online Appwrite logic
  createEffect(() => {
    if (online) {
      const fetchServerLogs = async () => {
        setLoading(true);
        try {
          const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
          
          let orgIdParam = organizationId || currentUserOrgId || localStorage.getItem('ttt_organization_id') || 'org_default';
          if (currentUserOrgId === 'org_backend') {
            orgIdParam = selectedOrgId();
          }

          const res = await appwrite.queryAuditLogs(
            databaseId,
            orgIdParam,
            {
              category: selectedCategory() === 'ALL' ? undefined : selectedCategory(),
              action: selectedAction() === 'ALL' ? undefined : selectedAction(),
              search: searchQuery() || undefined,
              startDate: startDateFilter() || undefined,
              endDate: endDateFilter() || undefined
            },
            currentPage(),
            pageSize()
          );

          const mapped = (res.documents || []).map(doc => {
            try {
              if (doc.data) {
                const parsed = JSON.parse(doc.data);
                return {
                  id: doc.$id,
                  organizationId: doc.organizationId,
                  timestamp: doc.timestamp || '',
                  user: doc.user || '',
                  action: doc.action || 'Cloud',
                  category: doc.category || '',
                  reference: doc.reference || '',
                  details: doc.details || '',
                  ...parsed
                };
              }
            } catch (e) {
              console.warn("Failed to parse doc.data for document:", doc.$id, e);
            }
            return {
              id: doc.$id,
              organizationId: doc.organizationId,
              timestamp: doc.timestamp || '',
              user: doc.user || '',
              action: doc.action || 'Cloud',
              category: doc.category || '',
              reference: doc.reference || '',
              details: doc.details || ''
            };
          });
          
          let finalLogs = mapped;
          if (res.fallback) {
            finalLogs = mapped.filter(log => {
              const matchesSearch = 
                log.reference.toLowerCase().includes(searchQuery().toLowerCase()) || 
                log.details.toLowerCase().includes(searchQuery().toLowerCase()) ||
                log.user.toLowerCase().includes(searchQuery().toLowerCase());
              
              const matchesCategory = selectedCategory() === 'ALL' || log.category === selectedCategory();
              const matchesAction = selectedAction() === 'ALL' || log.action === selectedAction();
              const matchesOrg = selectedOrgId() === 'ALL' || log.organizationId === selectedOrgId();

              const matchesStartDate = startDateFilter() ? log.timestamp >= startDateFilter() : true;
              const matchesEndDate = endDateFilter() ? log.timestamp <= (endDateFilter() + ' 23:59:59') : true;

              return matchesSearch && matchesCategory && matchesAction && matchesOrg && matchesStartDate && matchesEndDate;
            });
          }

          // Sort the loaded logs client-side (always performed to support client-side ordering and database query sorting fallback).
          const sorted = [...finalLogs].sort((a, b) => {
            const aVal = String(a[sortField()] || '').toLowerCase();
            const bVal = String(b[sortField()] || '').toLowerCase();
            if (aVal < bVal) return sortDirection() === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection() === 'asc' ? 1 : -1;
            return 0;
          });

          if (res.fallback) {
            setTotalCount(sorted.length);
            const startIdx = (currentPage() - 1) * pageSize();
            setDisplayedLogs(sorted.slice(startIdx, startIdx + pageSize()));
          } else {
            setDisplayedLogs(sorted);
            setTotalCount(res.total || 0);
          }
        } catch (err) {
          console.error("Failed to query audit logs from Appwrite:", err);
        } finally {
          setLoading(false);
        }
      };

      const delayDebounce = setTimeout(() => {
        fetchServerLogs();
      }, 300);

      return () => clearTimeout(delayDebounce);
    }
  });

  const totalItems = totalCount();
  const totalPages = Math.ceil(totalItems / pageSize()) || 1;
  const paginatedLogs = () => displayedLogs();

  const categories = ['ALL', 'Trip', 'Truck', 'Driver', 'Office', 'Account', 'Expense'];
  const actions = ['ALL', 'Created', 'Edited', 'Deleted', 'Approved', 'Rejected', 'Cloud'];

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'Created':
        return (
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle class="w-2.5 h-2.5" />
            Created
          </span>
        );
      case 'Edited':
        return (
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            <Edit class="w-2.5 h-2.5" />
            Edited
          </span>
        );
      case 'Deleted':
        return (
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle class="w-2.5 h-2.5" />
            Deleted
          </span>
        );
      case 'Approved':
        return (
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle class="w-2.5 h-2.5" />
            Approved
          </span>
        );
      case 'Rejected':
        return (
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle class="w-2.5 h-2.5" />
            Rejected
          </span>
        );
      default:
        return (
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            <History class="w-2.5 h-2.5" />
            {action}
          </span>
        );
    }
  };

  const handleDownloadLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `fleet_audit_report_${new Date().toISOString().substring(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const renderSortableHeader = (label: string, field: keyof AuditLog, customClass = "py-4 px-4") => {
    const isCurrent = sortField() === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        class={`${customClass} cursor-pointer hover:bg-slate-100 select-none transition group`}
      >
        <div class="flex items-center gap-1.5">
          <span>{label}</span>
          {isCurrent ? (
            sortDirection() === 'asc' ? (
              <ArrowUp class="w-3.5 h-3.5 text-blue-600 shrink-0" />
            ) : (
              <ArrowDown class="w-3.5 h-3.5 text-blue-600 shrink-0" />
            )
          ) : (
            <ArrowUpDown class="w-3.5 h-3.5 text-slate-350 opacity-40 group-hover:opacity-100 transition" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div id="audit-log-workspace" class="space-y-6 w-full overflow-x-hidden">
      <div class="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md border border-slate-700 w-full">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2.5">
            <div class="p-2 bg-blue-500/20 rounded-xl text-blue-400">
              <History class="w-5 h-5" />
            </div>
            <h2 class="text-lg font-extrabold tracking-tight flex items-center gap-2">
              <span>System Audit & Compliance Logs</span>
              {loading() && <span class="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>}
            </h2>
          </div>
          <p class="text-xs text-slate-350 max-w-xl">
            Real-time tracking of operational activities. Records user actions, model alterations, and deletion events for accounting accountability.
          </p>
        </div>
        
        <div class="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
          <button
            onClick={handleDownloadLogs}
            class="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
          >
            <Download class="w-3.5 h-3.5" /> Export Logs
          </button>
          
          <button
            onClick={() => {
              const msg = "Are you sure you want to permanently clear all audit history? This action is irreversible.";
              if (confirmAction) {
                confirmAction(msg, () => onClearLogs(), "Clear Audit Trail");
              } else if (confirm(msg)) {
                onClearLogs();
              }
            }}
            disabled={logs.length === 0}
            class="flex items-center gap-2 bg-rose-600/10 hover:bg-rose-600 border border-rose-600/20 text-rose-400 font-bold text-xs px-4 py-2 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Trash2 class="w-3.5 h-3.5" /> Clear All Logs
          </button>
        </div>
      </div>

      {/* FILTER CONTROL BAR */}
      <div class="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div class="flex flex-wrap items-center gap-3.5 w-full lg:w-auto">
          {/* Category selection */}
          <div class="space-y-1">
            <span class="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Entity Category</span>
            <div class="flex flex-wrap gap-1">
              {categories.map(cat => (
                <button
                  
                  onClick={() => setSelectedCategory(cat)}
                  class={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory() === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-650'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div class="h-6 w-px bg-slate-200 hidden md:block"></div>

          {/* Action selection */}
          <div class="space-y-1">
            <span class="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Operation Action</span>
            <div class="flex flex-wrap gap-1">
              {actions.map(act => (
                <button
                  
                  onClick={() => setSelectedAction(act)}
                  class={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedAction() === act
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-650'
                  }`}
                >
                  {act}
                </button>
              ))}
            </div>
          </div>

          {currentUserOrgId === 'org_backend' && organizationProfiles && (() => {
            const getOrgDisplayName = (orgId: string) => {
              if (orgId === 'ALL') return 'All Organizations';
              if (orgId === 'org_backend') return 'Backend System';
              return organizationProfiles.find(p => p.organizationId === orgId)?.organizationName || orgId;
            };
            const selectedOrgName = getOrgDisplayName(selectedOrgId());
            
            const allOrgsOptions = [
              { organizationId: 'org_backend', organizationName: 'Backend System' },
              ...(organizationProfiles || [])
            ];
            
            const filteredOrgs = allOrgsOptions.filter(org =>
              org.organizationName.toLowerCase().includes(orgSearchQuery().toLowerCase()) ||
              org.organizationId.toLowerCase().includes(orgSearchQuery().toLowerCase())
            );

            return (
              <>
                <div class="h-6 w-px bg-slate-200 hidden md:block"></div>
                <div class="space-y-1 relative" ref={orgDropdownRef}>
                  <span class="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Client Organization</span>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setIsOrgDropdownOpen(!isOrgDropdownOpen());
                      setOrgSearchQuery('');
                    }}
                    class="flex items-center justify-between bg-slate-50 border border-slate-200 hover:bg-slate-100/60 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer w-48 text-left"
                  >
                    <span class="truncate">{selectedOrgName}</span>
                    <Filter class="w-3 h-3 text-slate-400 ml-1.5 shrink-0" />
                  </button>

                  {isOrgDropdownOpen() && (
                    <div class="absolute left-0 mt-1 w-64 bg-white border border-slate-250 rounded-xl shadow-xl z-50 p-2 space-y-2 animate-fade-in max-w-[90vw]">
                      <div class="relative">
                        <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search organization..."
                          value={orgSearchQuery()}
                          onChange={(e) => setOrgSearchQuery(e.target.value)}
                          class="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-lg pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-semibold"
                          onClick={(e) => e.stopPropagation()} // Prevent closing dropdown on input click
                        />
                      </div>

                      <div class="max-h-48 overflow-y-auto divide-y divide-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrgId('ALL');
                            setIsOrgDropdownOpen(false);
                          }}
                          class={`w-full text-left px-3 py-2 text-xs rounded-lg transition-all cursor-pointer ${
                            selectedOrgId() === 'ALL'
                              ? 'bg-blue-55/15 bg-blue-50 text-blue-700 font-bold'
                              : 'hover:bg-slate-50 text-slate-700 font-medium'
                          }`}
                        >
                          All Organizations
                        </button>

                        {filteredOrgs.length > 0 ? (
                          filteredOrgs.map(org => (
                            <button
                              
                              type="button"
                              onClick={() => {
                                setSelectedOrgId(org.organizationId);
                                setIsOrgDropdownOpen(false);
                              }}
                              class={`w-full text-left px-3 py-2 text-xs rounded-lg transition-all cursor-pointer flex flex-col ${
                                selectedOrgId() === org.organizationId
                                  ? 'bg-blue-55/15 bg-blue-50 text-blue-700 font-bold'
                                  : 'hover:bg-slate-50 text-slate-750'
                              }`}
                            >
                              <span class="font-bold truncate w-full">{org.organizationName}</span>
                              <span class="text-[9px] text-slate-400 font-mono truncate w-full mt-0.5">{org.organizationId}</span>
                            </button>
                          ))
                        ) : (
                          <div class="text-center py-4 text-xs text-slate-400 italic">
                            No matching organizations
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* Date range selection */}
          <div class="h-6 w-px bg-slate-200 hidden md:block"></div>
          <div class="space-y-1">
            <span class="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Date Period</span>
            <div class="flex items-center gap-2">
              <input
                type="date"
                title="Start Date"
                value={startDateFilter()}
                onChange={(e) => setStartDateFilter(e.target.value)}
                class="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
              />
              <span class="text-slate-400 text-xs">to</span>
              <input
                type="date"
                title="End Date"
                value={endDateFilter()}
                onChange={(e) => setEndDateFilter(e.target.value)}
                class="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 focus:bg-white"
              />
              {(startDateFilter() || endDateFilter()) && (
                <button
                  onClick={() => {
                    setStartDateFilter('');
                    setEndDateFilter('');
                  }}
                  class="text-rose-600 hover:text-rose-700 text-xs font-bold px-1 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div class="relative w-full lg:w-72">
          <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ref, user, or details..."
            value={searchQuery()}
            onChange={(e) => setSearchQuery(e.target.value)}
            class="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-250 text-slate-800 placeholder-slate-400 rounded-xl pl-9.5 pr-4 py-2.5 text-xs font-medium focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* LOG DATA TABLE */}
      {totalCount() > 0 ? (
        <div class="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">

          {/* ── Mobile cards (< md) ── */}
          <div class="block md:hidden divide-y divide-slate-100">
            {paginatedLogs().map((log) => (
              <div  class="p-4 space-y-2">
                {/* Header row: action badge + timestamp */}
                <div class="flex items-center justify-between">
                  {getActionBadge(log.action)}
                  <span class="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                </div>
                {/* Category + reference */}
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] uppercase font-extrabold">
                    {log.category}
                  </span>
                  {log.reference && (
                    <span class="text-[11px] font-mono text-slate-600 font-semibold">
                      {log.reference}
                    </span>
                  )}
                  {currentUserOrgId === 'org_backend' && log.organizationId && (() => {
                    const orgName = organizationProfiles?.find(p => p.organizationId === log.organizationId)?.organizationName || log.organizationId;
                    return (
                      <span class="px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-blue-700 text-[9px] font-black uppercase">
                        {orgName}
                      </span>
                    );
                  })()}
                </div>
                {/* User */}
                <div class="flex items-center gap-1 text-[11px] text-slate-500">
                  <Users class="w-3 h-3 text-slate-400" />
                  <span>{log.user}</span>
                </div>
                {/* Details */}
                <div class="text-[11px] text-slate-600 leading-relaxed">
                  {log.details && (log.details.includes('➔') || log.details.includes('|')) ? (
                    <div class="flex flex-col gap-1.5 mt-1">
                      {log.details.split(' | ').map((change, index) => {
                        const arrowIdx = change.indexOf('➔');
                        if (arrowIdx !== -1) {
                          const colonIdx = change.indexOf(':');
                          if (colonIdx !== -1 && colonIdx < arrowIdx) {
                            const field = change.substring(0, colonIdx);
                            const values = change.substring(colonIdx + 1).trim();
                            const valuesSplit = values.split('➔');
                            const oldVal = valuesSplit[0]?.trim().replace(/^"|"$/g, '') || '';
                            const newVal = valuesSplit[1]?.trim().replace(/^"|"$/g, '') || '';
                            return (
                              <div  class="flex flex-wrap items-center gap-1.5 text-[11px] leading-none">
                                <span class="font-bold text-slate-600 bg-slate-100/80 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">{field}</span>
                                <span class="text-slate-400 line-through truncate max-w-[90px] inline-block font-mono bg-slate-50 px-1 rounded text-[10px]" title={oldVal}>{oldVal}</span>
                                <span class="text-slate-400 font-bold">&rarr;</span>
                                <span class="text-blue-700 font-extrabold truncate max-w-[110px] inline-block font-mono bg-blue-50/50 px-1 rounded text-[10px]" title={newVal}>{newVal}</span>
                              </div>
                            );
                          }
                        }
                        return <div  class="text-slate-600 text-[11px] leading-tight font-medium">&bull; {change}</div>;
                      })}
                    </div>
                  ) : (
                    <span>{log.details}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop table (≥ md) ── */}
          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-150 text-[10px] text-slate-450 uppercase font-extrabold tracking-wider">
                  {renderSortableHeader('Timestamp', 'timestamp', 'py-4 px-6 pl-8')}
                  {renderSortableHeader('Operator Email', 'user', 'py-4 px-4')}
                  {renderSortableHeader('Action', 'action', 'py-4 px-4')}
                  {renderSortableHeader('Category', 'category', 'py-4 px-4')}
                  {renderSortableHeader('Reference Key', 'reference', 'py-4 px-4')}
                  {renderSortableHeader('Descriptive Activity Details', 'details', 'py-4 px-6 pr-8 w-2/5')}
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {paginatedLogs().map((log) => (
                  <tr  class="hover:bg-slate-50/50 transition">
                    <td class="py-3.5 px-6 pl-8 font-mono text-slate-450 text-[11px]">
                      {log.timestamp}
                    </td>
                    <td class="py-3.5 px-4 font-semibold text-slate-800">
                      <span class="inline-flex items-center gap-1">
                        <Users class="w-3 h-3 text-slate-400" />
                        {log.user}
                      </span>
                      {currentUserOrgId === 'org_backend' && log.organizationId && (() => {
                        const orgName = organizationProfiles?.find(p => p.organizationId === log.organizationId)?.organizationName || log.organizationId;
                        return (
                          <span class="block text-[10px] text-blue-600 font-bold mt-0.5" title={log.organizationId}>
                            {orgName}
                          </span>
                        );
                      })()}
                    </td>
                    <td class="py-3.5 px-4">{getActionBadge(log.action)}</td>
                    <td class="py-3.5 px-4">
                      <span class="px-2.5 py-1 rounded bg-slate-100 text-slate-600 text-[10px] uppercase font-extrabold">
                        {log.category}
                      </span>
                    </td>
                    <td class="py-3.5 px-4 font-semibold text-slate-800 font-mono text-[11px]">
                      {log.reference || <span class="text-slate-300">&mdash;</span>}
                    </td>
                    <td class="py-3.5 px-6 pr-8 text-slate-500 font-normal leading-relaxed">
                      {log.details && (log.details.includes('➔') || log.details.includes('|')) ? (
                        <div class="flex flex-col gap-1.5 my-1">
                          {log.details.split(' | ').map((change, index) => {
                            const arrowIdx = change.indexOf('➔');
                            if (arrowIdx !== -1) {
                              const colonIdx = change.indexOf(':');
                              if (colonIdx !== -1 && colonIdx < arrowIdx) {
                                const field = change.substring(0, colonIdx);
                                const values = change.substring(colonIdx + 1).trim();
                                const valuesSplit = values.split('➔');
                                const oldVal = valuesSplit[0]?.trim().replace(/^"|"$/g, '') || '';
                                const newVal = valuesSplit[1]?.trim().replace(/^"|"$/g, '') || '';
                                return (
                                  <div  class="flex flex-wrap items-center gap-1.5 text-[11px] leading-none">
                                    <span class="font-bold text-slate-600 bg-slate-100/80 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">{field}</span>
                                    <span class="text-slate-400 line-through truncate max-w-[120px] inline-block font-mono bg-slate-50 px-1 rounded text-[10px]" title={oldVal}>{oldVal}</span>
                                    <span class="text-slate-400 font-bold">&rarr;</span>
                                    <span class="text-blue-700 font-extrabold truncate max-w-[150px] inline-block font-mono bg-blue-50/50 px-1 rounded text-[10px]" title={newVal}>{newVal}</span>
                                  </div>
                                );
                              }
                            }
                            return <div  class="text-slate-600 text-[11px] leading-tight font-medium">&bull; {change}</div>;
                          })}
                        </div>
                      ) : (
                        log.details
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div class="bg-slate-50 px-6 py-4 border-t border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium font-sans">
            <div class="flex flex-wrap items-center gap-4">
              <span>
                Showing <strong>{totalItems === 0 ? 0 : (currentPage() - 1) * pageSize() + 1}</strong> to{' '}
                <strong>{Math.min(totalItems, currentPage() * pageSize())}</strong> of{' '}
                <strong>{totalItems}</strong> entries
              </span>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Per Page</span>
                <select
                  value={pageSize()}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  class="bg-white border border-slate-200 text-slate-700 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div class="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage() === 1}
                class="px-2.5 py-1.5 rounded-lg border border-slate-250 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white font-bold transition cursor-pointer select-none"
              >
                &laquo; First
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage() === 1}
                class="px-3 py-1.5 rounded-lg border border-slate-250 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white font-bold transition cursor-pointer select-none"
              >
                Prev
              </button>

              {/* Page Numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage();
                if (currentPage() <= 3) {
                  pageNum = i + 1;
                } else if (currentPage() >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage() - 2 + i;
                }
                
                if (pageNum < 1 || pageNum > totalPages) return null;

                return (
                  <button
                    
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    class={`px-3 py-1.5 rounded-lg border text-xs transition cursor-pointer select-none font-bold ${
                      currentPage() === pageNum
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/10'
                        : 'border-slate-250 bg-white hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage() === totalPages}
                class="px-3 py-1.5 rounded-lg border border-slate-250 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white font-bold transition cursor-pointer select-none"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage() === totalPages}
                class="px-2.5 py-1.5 rounded-lg border border-slate-250 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white font-bold transition cursor-pointer select-none"
              >
                Last &raquo;
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div class="bg-slate-50 border border-dashed border-slate-350 rounded-3xl py-16 text-center space-y-2 p-4">
          <History class="w-8 h-8 text-slate-300 mx-auto" strokeWidth={1.5} />
          <h3 class="text-sm font-bold text-slate-800">No matching activities</h3>
          <p class="text-xs text-slate-450 max-w-sm mx-auto leading-relaxed">
            There are no logs matching your currently active search parameters or filters. Try choosing a different entity category or clearing search query.
          </p>
        </div>
      )}
    </div>
  );
}
