import React, { useState } from 'react';
import { UserPermission } from '../types';
import { Plus, Trash2, Shield, User, Mail, CheckCircle, XCircle, ChevronDown, ChevronUp, ShieldCheck, Check, RefreshCw, Cloud } from 'lucide-react';

interface TeamMember {
  $id: string;
  userId: string;
  userEmail: string;
  userName: string;
  roles: string[];
  confirm: boolean; // true = accepted, false = pending email confirmation
  invited: string;
}

interface UserAccessControlProps {
  permissions: UserPermission[];
  currentUserEmail?: string;
  onAddPermission: (permission: Omit<UserPermission, 'id'>) => void;
  onUpdatePermission: (permission: UserPermission) => void;
  onDeletePermission: (id: string) => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
  showNotification: (msg: string) => void;
  currentUserOrgId?: string;
  /** Live Appwrite team membership list — fetched when admin opens USERS tab */
  teamMembers?: TeamMember[];
  /** True while fetching team memberships from Appwrite */
  loadingTeamMembers?: boolean;
  canAddBackend?: boolean;
  canEditBackend?: boolean;
  canDeleteBackend?: boolean;
}

export default function UserAccessControl({
  permissions,
  currentUserEmail = '',
  onAddPermission,
  onUpdatePermission,
  onDeletePermission,
  confirmAction,
  showNotification,
  currentUserOrgId = 'org_default',
  teamMembers = [],
  loadingTeamMembers = false,
  canAddBackend = false,
  canEditBackend = false,
  canDeleteBackend = false
}: UserAccessControlProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Admin' | 'Custom'>('Custom');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  
  const isBackendOrg = currentUserOrgId === 'org_backend';
  const currentUserPerm = permissions.find(p => p.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim());
  const currentUserRole = currentUserPerm?.role || 'Custom';

  // Custom permissions state for creation form
  const [rights, setRights] = useState({
    canViewTrips: false, canEditTrips: false, canDeleteTrips: false,
    canViewTyres: false, canEditTyres: false, canDeleteTyres: false,
    canViewTrucks: false, canEditTrucks: false, canDeleteTrucks: false,
    canViewDrivers: false, canEditDrivers: false, canDeleteDrivers: false,
    canViewOffices: false, canEditOffices: false, canDeleteOffices: false,
    canViewAccounts: false, canEditAccounts: false, canDeleteAccounts: false,
    canViewExpenses: false, canEditExpenses: false, canDeleteExpenses: false,
    canViewBackend: false, canAddBackend: false, canEditBackend: false, canDeleteBackend: false, canApproveBackend: false,
    canViewTruckRequests: false, canDeleteTruckRequests: false, canViewBackendTeam: false, canDeleteBackendTeam: false,
    canViewDatabaseConsole: false, canEditDatabaseConsole: false, canDeleteDatabaseConsole: false
  });

  const toggleFormRight = (key: keyof typeof rights) => {
    setRights(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const resetForm = () => {
    setEmail('');
    setName('');
    setRole('Custom');
    setRights({
      canViewTrips: false, canEditTrips: false, canDeleteTrips: false,
      canViewTyres: false, canEditTyres: false, canDeleteTyres: false,
      canViewTrucks: false, canEditTrucks: false, canDeleteTrucks: false,
      canViewDrivers: false, canEditDrivers: false, canDeleteDrivers: false,
      canViewOffices: false, canEditOffices: false, canDeleteOffices: false,
      canViewAccounts: false, canEditAccounts: false, canDeleteAccounts: false,
      canViewExpenses: false, canEditExpenses: false, canDeleteExpenses: false,
      canViewBackend: false, canAddBackend: false, canEditBackend: false, canDeleteBackend: false, canApproveBackend: false,
      canViewTruckRequests: false, canDeleteTruckRequests: false, canViewBackendTeam: false, canDeleteBackendTeam: false,
      canViewDatabaseConsole: false, canEditDatabaseConsole: false, canDeleteDatabaseConsole: false
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;

    // Check duplicate email
    if (permissions.some(p => p.email.toLowerCase().trim() === email.toLowerCase().trim())) {
      alert("A user with this email address already exists in the access control registry.");
      return;
    }

    onAddPermission({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role,
      organizationId: currentUserOrgId,
      isApproved: true, // Manual additions by admin are auto-approved
      ...rights
    });

    resetForm();
    setShowAddForm(false);
  };

  const handleRoleChange = (selectedRole: 'Admin' | 'Custom') => {
    setRole(selectedRole);
    if (selectedRole === 'Admin') {
      setRights({
        canViewTrips: !isBackendOrg, canEditTrips: !isBackendOrg, canDeleteTrips: !isBackendOrg,
        canViewTyres: !isBackendOrg, canEditTyres: !isBackendOrg, canDeleteTyres: !isBackendOrg,
        canViewTrucks: !isBackendOrg, canEditTrucks: !isBackendOrg, canDeleteTrucks: !isBackendOrg,
        canViewDrivers: !isBackendOrg, canEditDrivers: !isBackendOrg, canDeleteDrivers: !isBackendOrg,
        canViewOffices: !isBackendOrg, canEditOffices: !isBackendOrg, canDeleteOffices: !isBackendOrg,
        canViewAccounts: !isBackendOrg, canEditAccounts: !isBackendOrg, canDeleteAccounts: !isBackendOrg,
        canViewExpenses: !isBackendOrg, canEditExpenses: !isBackendOrg, canDeleteExpenses: !isBackendOrg,
        canViewBackend: isBackendOrg, canAddBackend: isBackendOrg, canEditBackend: isBackendOrg, canDeleteBackend: isBackendOrg, canApproveBackend: isBackendOrg,
        canViewTruckRequests: isBackendOrg, canDeleteTruckRequests: isBackendOrg, canViewBackendTeam: isBackendOrg, canDeleteBackendTeam: isBackendOrg,
        canViewDatabaseConsole: isBackendOrg, canEditDatabaseConsole: isBackendOrg, canDeleteDatabaseConsole: isBackendOrg
      });
    } else {
      setRights({
        canViewTrips: false, canEditTrips: false, canDeleteTrips: false,
        canViewTyres: false, canEditTyres: false, canDeleteTyres: false,
        canViewTrucks: false, canEditTrucks: false, canDeleteTrucks: false,
        canViewDrivers: false, canEditDrivers: false, canDeleteDrivers: false,
        canViewOffices: false, canEditOffices: false, canDeleteOffices: false,
        canViewAccounts: false, canEditAccounts: false, canDeleteAccounts: false,
        canViewExpenses: false, canEditExpenses: false, canDeleteExpenses: false,
        canViewBackend: false, canAddBackend: false, canEditBackend: false, canDeleteBackend: false, canApproveBackend: false,
        canViewTruckRequests: false, canDeleteTruckRequests: false, canViewBackendTeam: false, canDeleteBackendTeam: false,
        canViewDatabaseConsole: false, canEditDatabaseConsole: false, canDeleteDatabaseConsole: false
      });
    }
  };

  const toggleUserRight = (userPerm: UserPermission, rightKey: keyof Omit<UserPermission, 'id' | 'email' | 'name' | 'role' | 'organizationId' | 'isApproved'>) => {
    if (isBackendOrg && !canEditBackend) {
      showNotification("You do not have permission to edit backend team privileges.");
      return;
    }
    if (userPerm.role === 'Admin') {
      showNotification("Cannot modify individual rights on an Admin account. Downgrade to Custom role first.");
      return;
    }

    const updated = {
      ...userPerm,
      [rightKey]: !userPerm[rightKey]
    };
    onUpdatePermission(updated);
    showNotification(`Updated permissions for ${userPerm.name}.`);
  };

  const changeUserRole = (userPerm: UserPermission, newRole: 'Admin' | 'Custom') => {
    if (userPerm.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim()) {
      alert("Safety Lock: You cannot change your own role and revoke your Admin permissions.");
      return;
    }
    if (isBackendOrg && !canEditBackend) {
      showNotification("You do not have permission to modify backend team roles.");
      return;
    }

    const updated: UserPermission = {
      ...userPerm,
      role: newRole,
      ...(newRole === 'Admin' ? {
        canViewTrips: !isBackendOrg, canEditTrips: !isBackendOrg, canDeleteTrips: !isBackendOrg,
        canViewTyres: !isBackendOrg, canEditTyres: !isBackendOrg, canDeleteTyres: !isBackendOrg,
        canViewTrucks: !isBackendOrg, canEditTrucks: !isBackendOrg, canDeleteTrucks: !isBackendOrg,
        canViewDrivers: !isBackendOrg, canEditDrivers: !isBackendOrg, canDeleteDrivers: !isBackendOrg,
        canViewOffices: !isBackendOrg, canEditOffices: !isBackendOrg, canDeleteOffices: !isBackendOrg,
        canViewAccounts: !isBackendOrg, canEditAccounts: !isBackendOrg, canDeleteAccounts: !isBackendOrg,
        canViewExpenses: !isBackendOrg, canEditExpenses: !isBackendOrg, canDeleteExpenses: !isBackendOrg,
        canViewBackend: isBackendOrg, canAddBackend: isBackendOrg, canEditBackend: isBackendOrg, canDeleteBackend: isBackendOrg, canApproveBackend: isBackendOrg,
        canViewTruckRequests: isBackendOrg, canDeleteTruckRequests: isBackendOrg, canViewBackendTeam: isBackendOrg, canDeleteBackendTeam: isBackendOrg,
        canViewDatabaseConsole: isBackendOrg, canEditDatabaseConsole: isBackendOrg, canDeleteDatabaseConsole: isBackendOrg
      } : {})
    };

    onUpdatePermission(updated);
    showNotification(`Updated role for ${userPerm.name} to ${newRole}.`);
  };

  const approveUser = (userPerm: UserPermission) => {
    // IMPORTANT: Explicitly set ALL permission fields to prevent undefined values.
    // The 'undefined !== false' bug in getCurrentUserRights could otherwise silently
    // grant a newly-approved backend user access to sensitive features like the Database Console.
    const updated: UserPermission = {
      ...userPerm,
      isApproved: true,
      // Standard module access: backend users get none; regular org users get view-only on trips
      canViewTrips: !isBackendOrg, canEditTrips: false, canDeleteTrips: false,
      canViewTyres: false, canEditTyres: false, canDeleteTyres: false,
      canViewTrucks: false, canEditTrucks: false, canDeleteTrucks: false,
      canViewDrivers: false, canEditDrivers: false, canDeleteDrivers: false,
      canViewOffices: false, canEditOffices: false, canDeleteOffices: false,
      canViewAccounts: false, canEditAccounts: false, canDeleteAccounts: false,
      canViewExpenses: false, canEditExpenses: false, canDeleteExpenses: false,
      // Backend-specific rights: all start at false — admin must grant each explicitly
      canViewBackend: isBackendOrg ? false : false,
      canAddBackend: false, canEditBackend: false, canDeleteBackend: false, canApproveBackend: false,
      canViewTruckRequests: false, canDeleteTruckRequests: false,
      canViewBackendTeam: false, canDeleteBackendTeam: false,
      canViewDatabaseConsole: false, canEditDatabaseConsole: false, canDeleteDatabaseConsole: false
    };
    onUpdatePermission(updated);
    showNotification(`Approved ${userPerm.name}. Please grant specific permissions as needed.`);
  };

  /** Find this user's live Appwrite membership record (by email match) */
  const getAppwriteMembership = (email: string): TeamMember | undefined => {
    return teamMembers.find(m => m.userEmail?.toLowerCase() === email.toLowerCase());
  };

  return (
    <div id="user-access-panel" className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs animate-fade-in text-slate-850">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            User Access Control (RBAC)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage user access, grant role privileges, approve pending registrants, and toggle view/edit/delete modules.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Appwrite Teams sync indicator */}
          {teamMembers.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
              <Cloud className="w-3 h-3" />
              {teamMembers.length} in Appwrite Team
            </span>
          )}
          {loadingTeamMembers && (
            <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">
              <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
            </span>
          )}
          <button
            id="btn-add-permission"
            onClick={() => {
              if (isBackendOrg && !canAddBackend) {
                showNotification("You do not have permission to add backend team members.");
                return;
              }
              resetForm();
              setShowAddForm(!showAddForm);
            }}
            disabled={isBackendOrg && !canAddBackend}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-150 shadow-sm text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showAddForm ? 'Close Panel' : (
              <>
                <Plus className="w-3.5 h-3.5" /> Add User Access
              </>
            )}
          </button>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 md:p-5 bg-slate-50 rounded-lg border border-slate-200 animate-fade-in space-y-4">
          <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Authorize New User Account
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 text-slate-850 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="w-3.5 h-3.5" />
                </span>
                <input
                  type="email"
                  placeholder="e.g. john@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">System Role</label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as 'Admin' | 'Custom')}
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
              >
                <option value="Custom">Custom Permissions Set</option>
                <option value="Admin">Administrator (All Permissions)</option>
              </select>
            </div>
          </div>

          {role === 'Custom' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Define Specific module View, Edit, and Delete Rights</span>
              <div className="grid grid-cols-4 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 p-2.5 rounded-t-lg border-b border-slate-200">
                <div>Module / Feature</div>
                <div className="text-center">View (Read)</div>
                <div className="text-center">Create/Edit (Write)</div>
                <div className="text-center">Delete (Remove)</div>
              </div>
              <div className="divide-y divide-slate-100">
                {(!isBackendOrg ? [
                  { label: 'Trip Management', view: 'canViewTrips', edit: 'canEditTrips', del: 'canDeleteTrips' },
                  { label: 'Tyre Inventory', view: 'canViewTyres', edit: 'canEditTyres', del: 'canDeleteTyres' },
                  { label: 'Truck Registry', view: 'canViewTrucks', edit: 'canEditTrucks', del: 'canDeleteTrucks' },
                  { label: 'Driver Database', view: 'canViewDrivers', edit: 'canEditDrivers', del: 'canDeleteDrivers' },
                  { label: 'Offices Directory', view: 'canViewOffices', edit: 'canEditOffices', del: 'canDeleteOffices' },
                  { label: 'Ledger Accounts', view: 'canViewAccounts', edit: 'canEditAccounts', del: 'canDeleteAccounts' },
                  { label: 'Expense Vouchers', view: 'canViewExpenses', edit: 'canEditExpenses', del: 'canDeleteExpenses' }
                ] : [
                  { label: 'Customer Organization Profiles', view: 'canViewBackend', edit: 'canEditBackend', del: 'canDeleteBackend' },
                  { label: 'Truck Activation Requests', view: 'canViewTruckRequests', edit: 'canApproveBackend', del: 'canDeleteTruckRequests' },
                  { label: 'Backend Team Access Control', view: 'canViewBackendTeam', edit: 'canAddBackend', del: 'canDeleteBackendTeam' },
                  { label: 'Database Console / Raw Editor', view: 'canViewDatabaseConsole', edit: 'canEditDatabaseConsole', del: 'canDeleteDatabaseConsole' }
                ]).map(mod => (
                  <div key={mod.label} className="grid grid-cols-4 gap-2 py-2 items-center text-xs">
                    <span className="font-semibold text-slate-700">{mod.label}</span>
                    <div className="text-center">
                      <input
                        type="checkbox"
                        checked={!!(rights as any)[mod.view]}
                        onChange={() => toggleFormRight(mod.view as any)}
                        disabled={isBackendOrg && !canAddBackend}
                        className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                      />
                    </div>
                    <div className="text-center">
                      <input
                        type="checkbox"
                        checked={!!(rights as any)[mod.edit]}
                        onChange={() => toggleFormRight(mod.edit as any)}
                        disabled={isBackendOrg && !canAddBackend}
                        className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                      />
                    </div>
                    <div className="text-center">
                      <input
                        type="checkbox"
                        checked={!!(rights as any)[mod.del]}
                        onChange={() => toggleFormRight(mod.del as any)}
                        disabled={isBackendOrg && !canAddBackend}
                        className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(false);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isBackendOrg && !canAddBackend}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Grant Access
            </button>
          </div>
        </form>
      )}

      {/* Access Registry table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-sm text-slate-700 whitespace-nowrap">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 font-bold tracking-wider">
            <tr>
              <th className="px-4 py-3.5 pl-6">Authorized User</th>
              <th className="px-4 py-3.5 text-center">Status</th>
              <th className="px-4 py-3.5">System Role</th>
              <th className="px-4 py-3.5 text-center">Permissions Summary</th>
              <th className="px-4 py-3.5 text-right pr-6">Revoke Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {permissions.map((p) => {
              const isCurrentUser = p.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim();
              
              return (
                <React.Fragment key={p.id}>
                  <tr className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3.5 pl-6 font-bold text-slate-800 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold font-sans border border-slate-200 shadow-2xs">
                        {p.name ? p.name.substring(0,2).toUpperCase() : 'US'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{p.name}</span>
                          {isCurrentUser && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">You</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{p.email}</span>
                      </div>
                    </td>
                    
                  {/* Approval Status + Live Appwrite Membership Status */}
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      {/* Local approval status */}
                      {p.isApproved ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Approved
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
                            Pending
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (isBackendOrg && !canEditBackend) {
                                showNotification("You do not have permission to approve team members.");
                                return;
                              }
                              approveUser(p);
                            }}
                            disabled={isBackendOrg && !canEditBackend}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 rounded text-[10px] font-bold cursor-pointer transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Check className="w-3 h-3 text-white" /> Approve
                          </button>
                        </div>
                      )}

                      {/* Live Appwrite Teams sync status */}
                      {(() => {
                        const membership = getAppwriteMembership(p.email);
                        if (teamMembers.length === 0) return null; // Not loaded yet
                        if (!membership) {
                          return (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                              <XCircle className="w-2.5 h-2.5" /> Not in Appwrite Team
                            </span>
                          );
                        }
                        if (membership.confirm) {
                          return (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                              <CheckCircle className="w-2.5 h-2.5" /> Appwrite ✓
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-orange-50 text-orange-600 border border-orange-200">
                            <RefreshCw className="w-2.5 h-2.5" /> Invite Pending
                          </span>
                        );
                      })()}
                    </div>
                  </td>

                    <td className="px-4 py-3.5 text-slate-650 font-semibold">
                      <select
                        value={p.role}
                        onChange={(e) => changeUserRole(p, e.target.value as any)}
                        disabled={
                          isCurrentUser || 
                          !p.isApproved || 
                          (isBackendOrg && !canEditBackend) ||
                          (currentUserRole === 'Custom' && (p.role === 'Admin' || p.role === 'SuperAdmin'))
                        }
                        className="bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer disabled:opacity-50"
                      >
                        {p.role === 'SuperAdmin' && <option value="SuperAdmin">Super Admin</option>}
                        <option value="Admin">Administrator</option>
                        <option value="Custom">Custom Rights</option>
                      </select>
                    </td>

                    {/* Expandable permissions config triggers */}
                    <td className="px-4 py-3.5 text-center">
                      {(p.role === 'Admin' || p.role === 'SuperAdmin') ? (
                        <span className="text-[11px] text-slate-500 font-semibold font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Full Admin Access
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!p.isApproved) {
                              showNotification("Approve user registration access first.");
                              return;
                            }
                            setExpandedUserId(expandedUserId === p.id ? null : p.id);
                          }}
                          disabled={!p.isApproved}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer transition disabled:opacity-50`}
                        >
                          Configure Modules
                          {expandedUserId === p.id ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                      )}
                    </td>

                    {/* Delete / Revoke option */}
                    <td className="px-4 py-3.5 text-right pr-6">
                      <button
                        onClick={() => {
                          if (isCurrentUser) {
                            alert("Safety Lock: You cannot delete your own user profile while logged in.");
                            return;
                          }
                          if (currentUserRole === 'Custom' && (p.role === 'Admin' || p.role === 'SuperAdmin')) {
                            alert("Security Restriction: You do not have permission to delete/revoke Administrator or Super Admin accounts.");
                            return;
                          }
                          if (isBackendOrg && !canDeleteBackend) {
                            showNotification("You do not have permission to revoke backend team access.");
                            return;
                          }
                          const msg = `Revoke access and delete permissions record for ${p.name} (${p.email})?`;
                          if (confirmAction) {
                            confirmAction(msg, () => onDeletePermission(p.id), "Revoke User Access");
                          } else if (confirm(msg)) {
                            onDeletePermission(p.id);
                          }
                        }}
                        disabled={
                          isCurrentUser || 
                          (isBackendOrg && !canDeleteBackend) ||
                          (currentUserRole === 'Custom' && (p.role === 'Admin' || p.role === 'SuperAdmin'))
                        }
                        className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-650 hover:text-rose-700 rounded border border-rose-100 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Revoke User Access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Nested Grid of 21 check flags */}
                  {expandedUserId === p.id && p.role === 'Custom' && p.isApproved && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={5} className="p-4 pl-8 pr-8">
                        <div className="max-w-2xl bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-fade-in space-y-3 text-left">
                          <h4 className="text-xs font-black text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-blue-600" />
                            Fine-grained permissions configuration for {p.name}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Set distinct view, create/edit, and deletion capabilities for each database register module.
                          </p>
                          <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
                            <div className="grid grid-cols-4 gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 p-2.5 pl-4 border-b border-slate-250/70">
                              <div>Database Register Module</div>
                              <div className="text-center">View (Read)</div>
                              <div className="text-center">Write/Edit (Create)</div>
                              <div className="text-center">Delete (Remove)</div>
                            </div>
                            <div className="divide-y divide-slate-100 bg-white font-semibold text-slate-700 pl-4 pr-2">
                              {(!isBackendOrg ? [
                                { label: 'Trip Management', view: 'canViewTrips', edit: 'canEditTrips', del: 'canDeleteTrips' },
                                { label: 'Tyre Inventory', view: 'canViewTyres', edit: 'canEditTyres', del: 'canDeleteTyres' },
                                { label: 'Truck Registry', view: 'canViewTrucks', edit: 'canEditTrucks', del: 'canDeleteTrucks' },
                                { label: 'Driver Database', view: 'canViewDrivers', edit: 'canEditDrivers', del: 'canDeleteDrivers' },
                                { label: 'Offices Directory', view: 'canViewOffices', edit: 'canEditOffices', del: 'canDeleteOffices' },
                                { label: 'Ledger Accounts', view: 'canViewAccounts', edit: 'canEditAccounts', del: 'canDeleteAccounts' },
                                { label: 'Expense Vouchers', view: 'canViewExpenses', edit: 'canEditExpenses', del: 'canDeleteExpenses' }
                              ] : [
                                { label: 'Customer Organization Profiles', view: 'canViewBackend', edit: 'canEditBackend', del: 'canDeleteBackend' },
                                { label: 'Truck Activation Requests', view: 'canViewTruckRequests', edit: 'canApproveBackend', del: 'canDeleteTruckRequests' },
                                { label: 'Backend Team Access Control', view: 'canViewBackendTeam', edit: 'canAddBackend', del: 'canDeleteBackendTeam' },
                                { label: 'Database Console / Raw Editor', view: 'canViewDatabaseConsole', edit: 'canEditDatabaseConsole', del: 'canDeleteDatabaseConsole' }
                              ]).map(mod => (
                                <div key={mod.label} className="grid grid-cols-4 gap-2 py-2.5 items-center text-xs">
                                  <span className="font-bold text-slate-800">{mod.label}</span>
                                  <div className="text-center">
                                    <input
                                      type="checkbox"
                                      checked={!!(p as any)[mod.view]}
                                      onChange={() => toggleUserRight(p, mod.view as any)}
                                      disabled={isBackendOrg && !canEditBackend}
                                      className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                  <div className="text-center">
                                    <input
                                      type="checkbox"
                                      checked={!!(p as any)[mod.edit]}
                                      onChange={() => toggleUserRight(p, mod.edit as any)}
                                      disabled={isBackendOrg && !canEditBackend}
                                      className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                  <div className="text-center">
                                    <input
                                      type="checkbox"
                                      checked={!!(p as any)[mod.del]}
                                      onChange={() => toggleUserRight(p, mod.del as any)}
                                      disabled={isBackendOrg && !canEditBackend}
                                      className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => setExpandedUserId(null)}
                              className="px-3 py-1 bg-slate-900 text-white font-bold text-[10px] rounded-lg hover:bg-slate-850 cursor-pointer shadow-3xs transition"
                            >
                              Close Permissions Config
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
