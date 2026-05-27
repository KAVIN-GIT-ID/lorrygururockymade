import React, { useState } from 'react';
import { AuditLog } from '../types';
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
} from 'lucide-react';

interface AuditLogViewProps {
  logs: AuditLog[];
  onClearLogs: () => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
}

export default function AuditLogView({ logs, onClearLogs, confirmAction }: AuditLogViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof AuditLog>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: keyof AuditLog) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.reference.toLowerCase().includes(searchQuery.toLowerCase()) || 
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'ALL' || log.category === selectedCategory;
    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;

    return matchesSearch && matchesCategory && matchesAction;
  });

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const aVal = String(a[sortField] || '').toLowerCase();
    const bVal = String(b[sortField] || '').toLowerCase();
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const categories = ['ALL', 'Trip', 'Truck', 'Driver', 'Office', 'Account', 'Expense'];
  const actions = ['ALL', 'Created', 'Edited', 'Deleted', 'Approved', 'Rejected', 'Cloud'];

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'Created':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle className="w-2.5 h-2.5" />
            Created
          </span>
        );
      case 'Edited':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            <Edit className="w-2.5 h-2.5" />
            Edited
          </span>
        );
      case 'Deleted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-2.5 h-2.5" />
            Deleted
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-2.5 h-2.5" />
            Approved
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-2.5 h-2.5" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            <History className="w-2.5 h-2.5" />
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
    const isCurrent = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        className={`${customClass} cursor-pointer hover:bg-slate-100 select-none transition group`}
      >
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          {isCurrent ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-350 opacity-40 group-hover:opacity-100 transition" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div id="audit-log-workspace" className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md border border-slate-700">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
              <History className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold tracking-tight">System Audit & Compliance Logs</h2>
          </div>
          <p className="text-xs text-slate-350 max-w-xl">
            Real-time tracking of operational activities. Records user actions, model alterations, and deletion events for accounting accountability.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
          <button
            onClick={handleDownloadLogs}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Logs
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
            className="flex items-center gap-2 bg-rose-600/10 hover:bg-rose-600 border border-rose-600/20 text-rose-400 font-bold text-xs px-4 py-2 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear All Logs
          </button>
        </div>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3.5 w-full lg:w-auto">
          {/* Category selection */}
          <div className="space-y-1">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Entity Category</span>
            <div className="flex flex-wrap gap-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-650'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

          {/* Action selection */}
          <div className="space-y-1">
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Operation Action</span>
            <div className="flex gap-1">
              {actions.map(act => (
                <button
                  key={act}
                  onClick={() => setSelectedAction(act)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedAction === act
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-650'
                  }`}
                >
                  {act}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ref, user, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-250 text-slate-800 placeholder-slate-400 rounded-xl pl-9.5 pr-4 py-2.5 text-xs font-medium focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* LOG DATA TABLE */}
      {filteredLogs.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] text-slate-450 uppercase font-extrabold tracking-wider">
                  {renderSortableHeader('Timestamp', 'timestamp', 'py-4 px-6 pl-8')}
                  {renderSortableHeader('Operator Email', 'user', 'py-4 px-4')}
                  {renderSortableHeader('Action', 'action', 'py-4 px-4')}
                  {renderSortableHeader('Category', 'category', 'py-4 px-4')}
                  {renderSortableHeader('Reference Key', 'reference', 'py-4 px-4')}
                  {renderSortableHeader('Descriptive Activity Details', 'details', 'py-4 px-6 pr-8 w-2/5')}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {sortedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-6 pl-8 font-mono text-slate-450 text-[11px]">
                      {log.timestamp}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        {log.user}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{getActionBadge(log.action)}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 text-[10px] uppercase font-extrabold">
                        {log.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 font-mono text-[11px]">
                      {log.reference || <span className="text-slate-300">&mdash;</span>}
                    </td>
                    <td className="py-3.5 px-6 pr-8 text-slate-500 font-normal leading-relaxed">
                      {log.details && (log.details.includes('➔') || log.details.includes('|')) ? (
                        <div className="flex flex-col gap-1.5 my-1">
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
                                  <div key={index} className="flex flex-wrap items-center gap-1.5 text-[11px] leading-none">
                                    <span className="font-bold text-slate-600 bg-slate-100/80 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">{field}</span>
                                    <span className="text-slate-400 line-through truncate max-w-[120px] inline-block font-mono bg-slate-50 px-1 rounded text-[10px]" title={oldVal}>{oldVal}</span>
                                    <span className="text-slate-400 font-bold">&rarr;</span>
                                    <span className="text-blue-700 font-extrabold truncate max-w-[150px] inline-block font-mono bg-blue-50/50 px-1 rounded text-[10px]" title={newVal}>{newVal}</span>
                                  </div>
                                );
                              }
                            }
                            return <div key={index} className="text-slate-600 text-[11px] leading-tight font-medium">&bull; {change}</div>;
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
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-350 rounded-3xl py-16 text-center space-y-2 p-4">
          <History className="w-8 h-8 text-slate-300 mx-auto" strokeWidth={1.5} />
          <h3 className="text-sm font-bold text-slate-800">No matching activities</h3>
          <p className="text-xs text-slate-450 max-w-sm mx-auto leading-relaxed">
            There are no logs matching your currently active search parameters or filters. Try choosing a different entity category or clearing search query.
          </p>
        </div>
      )}
    </div>
  );
}
