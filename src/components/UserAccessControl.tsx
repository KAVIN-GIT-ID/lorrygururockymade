import React, { useState, useEffect } from 'react';
import { UserPermission, OrganizationProfile } from '../types';
import { Plus, Trash2, Shield, User, Mail, CheckCircle, XCircle, ChevronDown, ChevronUp, ShieldCheck, Check, RefreshCw, Cloud, CreditCard, Phone } from 'lucide-react';

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
  orgProfile?: OrganizationProfile;
  onUpdateOrgProfile?: (updatedProfile: OrganizationProfile) => void;
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
  canDeleteBackend = false,
  orgProfile,
  onUpdateOrgProfile
}: UserAccessControlProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'Admin' | 'Custom'>('Custom');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const [engineOilInterval, setEngineOilInterval] = useState<number | ''>('');
  const [crownOilInterval, setCrownOilInterval] = useState<number | ''>('');
  const [gearBoxOilInterval, setGearBoxOilInterval] = useState<number | ''>('');
  const [radiatorInterval, setRadiatorInterval] = useState<number | ''>('');
  const [pinpushInterval, setPinpushInterval] = useState<number | ''>('');
  const [wheelGreaseInterval, setWheelGreaseInterval] = useState<number | ''>('');
  const [brokeragePolicy, setBrokeragePolicy] = useState<'OrgBears' | 'DriverBears'>('DriverBears');
  const [insuranceWarningDays, setInsuranceWarningDays] = useState<number | ''>('');
  const [fcWarningDays, setFcWarningDays] = useState<number | ''>('');
  const [npTaxWarningDays, setNpTaxWarningDays] = useState<number | ''>('');
  const [fiveYearPermitWarningDays, setFiveYearPermitWarningDays] = useState<number | ''>('');
  const [qTaxWarningDays, setQTaxWarningDays] = useState<number | ''>('');
  const [greenTaxWarningDays, setGreenTaxWarningDays] = useState<number | ''>('');
  const [subscriptionWarningDays, setSubscriptionWarningDays] = useState<number | ''>('');

  const [lastOrgId, setLastOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (orgProfile && orgProfile.organizationId !== lastOrgId) {
      setEngineOilInterval(orgProfile.engineOilIntervalKM !== undefined && orgProfile.engineOilIntervalKM !== null ? orgProfile.engineOilIntervalKM : '');
      setCrownOilInterval(orgProfile.crownOilIntervalKM !== undefined && orgProfile.crownOilIntervalKM !== null ? orgProfile.crownOilIntervalKM : '');
      setGearBoxOilInterval(orgProfile.gearBoxOilIntervalKM !== undefined && orgProfile.gearBoxOilIntervalKM !== null ? orgProfile.gearBoxOilIntervalKM : '');
      setRadiatorInterval(orgProfile.radiatorIntervalKM !== undefined && orgProfile.radiatorIntervalKM !== null ? orgProfile.radiatorIntervalKM : '');
      setPinpushInterval(orgProfile.pinpushIntervalKM !== undefined && orgProfile.pinpushIntervalKM !== null ? orgProfile.pinpushIntervalKM : '');
      setWheelGreaseInterval(orgProfile.wheelGreaseIntervalKM !== undefined && orgProfile.wheelGreaseIntervalKM !== null ? orgProfile.wheelGreaseIntervalKM : '');
      setBrokeragePolicy(orgProfile.brokeragePolicy || 'DriverBears');
      setInsuranceWarningDays(orgProfile.insuranceWarningDays !== undefined && orgProfile.insuranceWarningDays !== null ? orgProfile.insuranceWarningDays : '');
      setFcWarningDays(orgProfile.fcWarningDays !== undefined && orgProfile.fcWarningDays !== null ? orgProfile.fcWarningDays : '');
      setNpTaxWarningDays(orgProfile.npTaxWarningDays !== undefined && orgProfile.npTaxWarningDays !== null ? orgProfile.npTaxWarningDays : '');
      setFiveYearPermitWarningDays(orgProfile.fiveYearPermitWarningDays !== undefined && orgProfile.fiveYearPermitWarningDays !== null ? orgProfile.fiveYearPermitWarningDays : '');
      setQTaxWarningDays(orgProfile.qTaxWarningDays !== undefined && orgProfile.qTaxWarningDays !== null ? orgProfile.qTaxWarningDays : '');
      setGreenTaxWarningDays(orgProfile.greenTaxWarningDays !== undefined && orgProfile.greenTaxWarningDays !== null ? orgProfile.greenTaxWarningDays : '');
      setSubscriptionWarningDays(orgProfile.subscriptionWarningDays !== undefined && orgProfile.subscriptionWarningDays !== null ? orgProfile.subscriptionWarningDays : '');
      setLastOrgId(orgProfile.organizationId);
    }
  }, [orgProfile, lastOrgId]);

  const handleSaveOrgDefaults = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgProfile || !onUpdateOrgProfile) return;
    onUpdateOrgProfile({
      ...orgProfile,
      engineOilIntervalKM: engineOilInterval !== '' ? Number(engineOilInterval) : undefined,
      crownOilIntervalKM: crownOilInterval !== '' ? Number(crownOilInterval) : undefined,
      gearBoxOilIntervalKM: gearBoxOilInterval !== '' ? Number(gearBoxOilInterval) : undefined,
      radiatorIntervalKM: radiatorInterval !== '' ? Number(radiatorInterval) : undefined,
      pinpushIntervalKM: pinpushInterval !== '' ? Number(pinpushInterval) : undefined,
      wheelGreaseIntervalKM: wheelGreaseInterval !== '' ? Number(wheelGreaseInterval) : undefined,
      brokeragePolicy: brokeragePolicy,
      insuranceWarningDays: insuranceWarningDays !== '' ? Number(insuranceWarningDays) : undefined,
      fcWarningDays: fcWarningDays !== '' ? Number(fcWarningDays) : undefined,
      npTaxWarningDays: npTaxWarningDays !== '' ? Number(npTaxWarningDays) : undefined,
      fiveYearPermitWarningDays: fiveYearPermitWarningDays !== '' ? Number(fiveYearPermitWarningDays) : undefined,
      qTaxWarningDays: qTaxWarningDays !== '' ? Number(qTaxWarningDays) : undefined,
      greenTaxWarningDays: greenTaxWarningDays !== '' ? Number(greenTaxWarningDays) : undefined,
      subscriptionWarningDays: subscriptionWarningDays !== '' ? Number(subscriptionWarningDays) : undefined,
    });
    showNotification("Organization defaults updated successfully!");
  };

  const [fuelCardName, setFuelCardName] = useState('');
  const [fuelCardNo, setFuelCardNo] = useState('');
  const [fuelCardStatus, setFuelCardStatus] = useState<'Active' | 'Inactive'>('Active');
  const [editingFuelCardId, setEditingFuelCardId] = useState<string | null>(null);
  const [showFuelCardForm, setShowFuelCardForm] = useState(false);

  const handleSaveFuelCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgProfile || !onUpdateOrgProfile || !fuelCardName.trim()) return;

    const currentCards = orgProfile.fuelCards || [];
    let updatedCards;

    if (editingFuelCardId) {
      updatedCards = currentCards.map(c =>
        c.id === editingFuelCardId
          ? { ...c, cardName: fuelCardName.trim(), cardNumber: fuelCardNo.trim() || undefined, status: fuelCardStatus }
          : c
      );
    } else {
      const newCard = {
        id: 'fc_' + Date.now(),
        cardName: fuelCardName.trim(),
        cardNumber: fuelCardNo.trim() || undefined,
        status: fuelCardStatus
      };
      updatedCards = [...currentCards, newCard];
    }

    onUpdateOrgProfile({
      ...orgProfile,
      fuelCards: updatedCards
    });

    setFuelCardName('');
    setFuelCardNo('');
    setFuelCardStatus('Active');
    setEditingFuelCardId(null);
    setShowFuelCardForm(false);
    showNotification(editingFuelCardId ? "Fuel card updated successfully!" : "Fuel card added successfully!");
  };

  const handleDeleteFuelCard = (cardId: string) => {
    if (!orgProfile || !onUpdateOrgProfile) return;
    const currentCards = orgProfile.fuelCards || [];
    const updatedCards = currentCards.filter(c => c.id !== cardId);

    onUpdateOrgProfile({
      ...orgProfile,
      fuelCards: updatedCards
    });
    showNotification("Fuel card deleted successfully!");
  };

  const isBackendOrg = currentUserOrgId === 'org_backend';
  const currentUserPerm = permissions.find(p => p.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim());
  const currentUserRole = currentUserPerm?.role || 'Custom';

  // Custom permissions state for creation form
  const [supportRoles, setSupportRoles] = useState<('Technical' | 'Billing' | 'General')[]>([]);

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
    canViewDatabaseConsole: false, canEditDatabaseConsole: false, canDeleteDatabaseConsole: false,
    canEditLoans: false, canDeleteLoans: false,
    canViewTickets: false, canEditTickets: false, canDeleteTickets: false, canTransferTickets: false
  });

  const toggleFormRight = (key: keyof typeof rights) => {
    setRights(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const resetForm = () => {
    setEmail('');
    setName('');
    setPhone('');
    setRole('Custom');
    setSupportRoles([]);
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
      canViewDatabaseConsole: false, canEditDatabaseConsole: false, canDeleteDatabaseConsole: false,
      canEditLoans: false, canDeleteLoans: false,
      canViewTickets: false, canEditTickets: false, canDeleteTickets: false, canTransferTickets: false
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
      phone: phone.trim() || undefined,
      isEmailVerified: false,
      isPhoneVerified: false,
      role,
      organizationId: currentUserOrgId,
      isApproved: true, // Manual additions by admin are auto-approved
      supportRole: isBackendOrg ? supportRoles : [],
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
        canViewDatabaseConsole: isBackendOrg, canEditDatabaseConsole: isBackendOrg, canDeleteDatabaseConsole: isBackendOrg,
        canEditLoans: !isBackendOrg, canDeleteLoans: !isBackendOrg,
        canViewTickets: isBackendOrg, canEditTickets: isBackendOrg, canDeleteTickets: isBackendOrg, canTransferTickets: isBackendOrg
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
        canViewDatabaseConsole: false, canEditDatabaseConsole: false, canDeleteDatabaseConsole: false,
        canEditLoans: false, canDeleteLoans: false,
        canViewTickets: false, canEditTickets: false, canDeleteTickets: false, canTransferTickets: false
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
        canViewDatabaseConsole: isBackendOrg, canEditDatabaseConsole: isBackendOrg, canDeleteDatabaseConsole: isBackendOrg,
        canEditLoans: !isBackendOrg, canDeleteLoans: !isBackendOrg,
        canViewTickets: isBackendOrg, canEditTickets: isBackendOrg, canDeleteTickets: isBackendOrg, canTransferTickets: isBackendOrg
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
      canViewDatabaseConsole: false, canEditDatabaseConsole: false, canDeleteDatabaseConsole: false,
      canEditLoans: false, canDeleteLoans: false,
      canViewTickets: false, canEditTickets: false, canDeleteTickets: false, canTransferTickets: false
    };
    onUpdatePermission(updated);
    showNotification(`Approved ${userPerm.name}. Please grant specific permissions as needed.`);
  };

  /** Find this user's live Appwrite membership record (by email match) */
  const getAppwriteMembership = (email: string): TeamMember | undefined => {
    const cleanEmail = email.trim().toLowerCase();
    const match = teamMembers.find(m => {
      const mEmail = (m.userEmail || (m as any).email || '').trim().toLowerCase();
      return mEmail === cleanEmail;
    });
    console.log(`[getAppwriteMembership] Matching email: "${cleanEmail}" -> found:`, match, "in list:", teamMembers);
    if (teamMembers.length > 0) {
      console.log(`[getAppwriteMembership] Raw memberships list JSON:`, JSON.stringify(teamMembers));
    }
    return match;
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

      {/* ORGANIZATION DEFAULT MAINTENANCE SETTINGS (ORG DEFAULTS) */}
      {orgProfile && !isBackendOrg && (
        <div className="mb-6 p-4 md:p-5 bg-slate-50 rounded-xl border border-slate-200 animate-fade-in space-y-4 text-slate-800">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <Shield className="w-4 h-4 text-blue-600 animate-pulse" />
            <h3 className="text-xs font-bold text-blue-650 uppercase tracking-widest">
              Organization Default Maintenance Settings (Org Defaults)
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Define the organization-wide default service intervals (in kilometers). These thresholds are used across your fleet registry to warn about due maintenance milestones. Individual vehicles can override these defaults in the Truck Registry specs form.
          </p>
          <form onSubmit={handleSaveOrgDefaults} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="input-org-engine-oil-interval" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Engine Oil Change (KM)</label>
                <input
                  id="input-org-engine-oil-interval"
                  type="number"
                  placeholder="e.g. 15000"
                  value={engineOilInterval}
                  onChange={(e) => setEngineOilInterval(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label htmlFor="input-org-crown-oil-interval" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Crown Oil Change (KM)</label>
                <input
                  id="input-org-crown-oil-interval"
                  type="number"
                  placeholder="e.g. 40000"
                  value={crownOilInterval}
                  onChange={(e) => setCrownOilInterval(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label htmlFor="input-org-gearbox-oil-interval" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Gear Box Oil Change (KM)</label>
                <input
                  id="input-org-gearbox-oil-interval"
                  type="number"
                  placeholder="e.g. 40000"
                  value={gearBoxOilInterval}
                  onChange={(e) => setGearBoxOilInterval(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label htmlFor="input-org-radiator-interval" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Radiator Service (KM)</label>
                <input
                  id="input-org-radiator-interval"
                  type="number"
                  placeholder="e.g. 20000"
                  value={radiatorInterval}
                  onChange={(e) => setRadiatorInterval(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label htmlFor="input-org-pinpush-interval" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Pinpush Grease (KM)</label>
                <input
                  id="input-org-pinpush-interval"
                  type="number"
                  placeholder="e.g. 5000"
                  value={pinpushInterval}
                  onChange={(e) => setPinpushInterval(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label htmlFor="input-org-wheel-grease-interval" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Wheel Grease (KM)</label>
                <input
                  id="input-org-wheel-grease-interval"
                  type="number"
                  placeholder="e.g. 5000"
                  value={wheelGreaseInterval}
                  onChange={(e) => setWheelGreaseInterval(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label htmlFor="select-org-brokerage-policy" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Office Brokerage default policy</label>
                <select
                  id="select-org-brokerage-policy"
                  value={brokeragePolicy}
                  onChange={(e) => setBrokeragePolicy(e.target.value as 'OrgBears' | 'DriverBears')}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="DriverBears">Collect/Recover from Driver (Policy 2 - Default)</option>
                  <option value="OrgBears">Bear/Absorb as Org Expense (Policy 1)</option>
                </select>
              </div>
            </div>

            {/* COMPLIANCE ALERT THRESHOLDS */}
            <div className="border-t border-slate-200/60 pt-4 space-y-3">
              <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">
                Compliance Alert Thresholds (Warning Days before Expiry)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="input-org-insurance-warning" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Insurance Alert (Days)</label>
                  <input
                    id="input-org-insurance-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={insuranceWarningDays}
                    onChange={(e) => setInsuranceWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="input-org-fc-warning" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">FC Alert (Days)</label>
                  <input
                    id="input-org-fc-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={fcWarningDays}
                    onChange={(e) => setFcWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="input-org-np-warning" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">National Permit Alert (Days)</label>
                  <input
                    id="input-org-np-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={npTaxWarningDays}
                    onChange={(e) => setNpTaxWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="input-org-5y-warning" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">5Y Permit Alert (Days)</label>
                  <input
                    id="input-org-5y-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={fiveYearPermitWarningDays}
                    onChange={(e) => setFiveYearPermitWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="input-org-qtax-warning" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Q Tax Alert (Days)</label>
                  <input
                    id="input-org-qtax-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={qTaxWarningDays}
                    onChange={(e) => setQTaxWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="input-org-greentax-warning" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Green Tax Alert (Days)</label>
                  <input
                    id="input-org-greentax-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={greenTaxWarningDays}
                    onChange={(e) => setGreenTaxWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="input-org-subscription-warning" className="block text-[10px] font-bold text-slate-650 uppercase mb-1">Subscription Alert (Days)</label>
                  <input
                    id="input-org-subscription-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={subscriptionWarningDays}
                    onChange={(e) => setSubscriptionWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
              >
                Save Org Defaults
              </button>
            </div>
          </form>

          {/* FUEL CARDS SECTION */}
          <div className="border-t border-slate-200 pt-4 mt-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-650" />
                <h3 className="text-xs font-bold text-blue-650 uppercase tracking-widest">
                  Organization Fuel Cards (Accounts)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFuelCardName('');
                  setFuelCardNo('');
                  setFuelCardStatus('Active');
                  setEditingFuelCardId(null);
                  setShowFuelCardForm(!showFuelCardForm);
                }}
                className="bg-white hover:bg-slate-50 border border-slate-350 text-slate-705 font-bold text-[10px] py-1.5 px-2.5 rounded-lg shadow-3xs cursor-pointer inline-flex items-center gap-1"
              >
                {showFuelCardForm ? 'Close Form' : '+ Add Fuel Card'}
              </button>
            </div>

            {showFuelCardForm && (
              <form onSubmit={handleSaveFuelCard} className="bg-white border border-slate-200 p-4 rounded-xl space-y-3 shadow-3xs">
                <h4 className="text-[10px] font-bold text-blue-655 uppercase tracking-wider">
                  {editingFuelCardId ? 'Edit Fuel Card' : 'Add New Fuel Card'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="input-fuel-card-name" className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Card Name / Account</label>
                    <input
                      id="input-fuel-card-name"
                      type="text"
                      required
                      placeholder="e.g. HPCL Card #1"
                      value={fuelCardName}
                      onChange={(e) => setFuelCardName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label htmlFor="input-fuel-card-no" className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Card Number (Optional)</label>
                    <input
                      id="input-fuel-card-no"
                      type="text"
                      placeholder="e.g. 700012345678"
                      value={fuelCardNo}
                      onChange={(e) => setFuelCardNo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Status</label>
                    <select
                      value={fuelCardStatus}
                      onChange={(e) => setFuelCardStatus(e.target.value as 'Active' | 'Inactive')}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowFuelCardForm(false)}
                    className="px-3 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[10px] px-3.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    {editingFuelCardId ? 'Save Changes' : 'Add Card'}
                  </button>
                </div>
              </form>
            )}

            {/* List of Fuel Cards */}
            {(!orgProfile.fuelCards || orgProfile.fuelCards.length === 0) ? (
              <p className="text-[11px] text-slate-400 italic text-center py-2">No fuel cards configured for this organization.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {orgProfile.fuelCards.map((card) => (
                  <div key={card.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-3xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 text-xs">{card.cardName}</span>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${card.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-350'}`}></span>
                      </div>
                      {card.cardNumber && (
                        <code className="text-[10px] text-slate-400 font-mono select-all block">{card.cardNumber}</code>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFuelCardId(card.id);
                          setFuelCardName(card.cardName);
                          setFuelCardNo(card.cardNumber || '');
                          setFuelCardStatus(card.status);
                          setShowFuelCardForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-[10px] font-bold cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove fuel card "${card.cardName}"?`)) {
                            handleDeleteFuelCard(card.id);
                          }
                        }}
                        className="text-rose-600 hover:text-rose-800 text-[10px] font-bold cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 md:p-5 bg-slate-50 rounded-lg border border-slate-200 animate-fade-in space-y-4">
          <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Authorize New User Account
          </h3>
          <div className={`grid grid-cols-1 ${isBackendOrg ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4`}>
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
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mobile Number</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Phone className="w-3.5 h-3.5" />
                </span>
                <input
                  type="tel"
                  placeholder="e.g. +1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-550 font-mono"
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
            {isBackendOrg && (
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Support Category Roles</label>
                <div className="flex flex-wrap gap-4 mt-2">
                  {['Technical', 'Billing', 'General'].map((roleVal) => {
                    const typedRole = roleVal as 'Technical' | 'Billing' | 'General';
                    const isChecked = supportRoles.includes(typedRole);
                    return (
                      <label key={roleVal} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSupportRoles(prev => prev.filter(r => r !== typedRole));
                            } else {
                              setSupportRoles(prev => [...prev, typedRole]);
                            }
                          }}
                          className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        {roleVal}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
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
                  { label: 'Expense Vouchers', view: 'canViewExpenses', edit: 'canEditExpenses', del: 'canDeleteExpenses' },
                  { label: 'Vehicle Loan Details', view: '', edit: 'canEditLoans', del: 'canDeleteLoans' }
                ] : [
                  { label: 'Customer Organization Profiles', view: 'canViewBackend', edit: 'canEditBackend', del: 'canDeleteBackend' },
                  { label: 'Truck Activation Requests', view: 'canViewTruckRequests', edit: 'canApproveBackend', del: 'canDeleteTruckRequests' },
                  { label: 'Backend Team Access Control', view: 'canViewBackendTeam', edit: 'canAddBackend', del: 'canDeleteBackendTeam' },
                  { label: 'Database Console / Raw Editor', view: 'canViewDatabaseConsole', edit: 'canEditDatabaseConsole', del: 'canDeleteDatabaseConsole' },
                  { label: 'Support Tickets Desk', view: 'canViewTickets', edit: 'canEditTickets', del: 'canDeleteTickets' }
                ]).map(mod => (
                  <div key={mod.label} className="grid grid-cols-4 gap-2 py-2 items-center text-xs">
                    <span className="font-semibold text-slate-700">{mod.label}</span>
                    <div className="text-center">
                      {mod.view ? (
                        <input
                          type="checkbox"
                          checked={!!(rights as any)[mod.view]}
                          onChange={() => toggleFormRight(mod.view as any)}
                          disabled={isBackendOrg && !canAddBackend}
                          className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                        />
                      ) : (
                        <span className="text-slate-350 font-sans font-bold">—</span>
                      )}
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
              {isBackendOrg && (
                <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <input
                    type="checkbox"
                    id="checkbox-form-transfer-tickets"
                    checked={rights.canTransferTickets}
                    onChange={() => setRights(prev => ({ ...prev, canTransferTickets: !prev.canTransferTickets }))}
                    className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="checkbox-form-transfer-tickets" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer uppercase tracking-tight">
                    Authorize Ticket Transfer Privileges (Can move tickets between Technical/Billing/General category queues)
                  </label>
                </div>
              )}
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

      {/* ── Mobile card list (< md) ── */}
      <div className="block md:hidden space-y-3">
        {permissions.map((p) => {
          const isCurrentUser = p.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim();
          const membership = getAppwriteMembership(p.email);
          const isExpanded = expandedUserId === p.id;
          const canEdit = !isBackendOrg || canEditBackend;

          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="flex items-start gap-3 p-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 text-sm font-extrabold border border-slate-200 flex-shrink-0">
                  {p.name ? p.name.substring(0, 2).toUpperCase() : 'US'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm truncate">{p.name}</span>
                    {isCurrentUser && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">You</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono block mt-0.5 truncate">{p.email}</span>
                  <span className="text-[11px] text-slate-450 font-mono block mt-0.5 truncate">Phone: {p.phone || 'Not Set'}</span>

                  {/* Verification override panel */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-semibold ${p.isEmailVerified
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                        Email: {p.isEmailVerified ? 'Verified' : 'Unverified'}
                      </span>
                      {canEdit && !p.isEmailVerified && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...p, isEmailVerified: true };
                            onUpdatePermission(updated);
                            showNotification(`Manually verified email for ${p.name}.`);
                          }}
                          className="text-[9px] text-blue-600 hover:text-blue-805 font-bold bg-blue-55 hover:bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5 cursor-pointer transition-all"
                        >
                          Verify
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-semibold ${p.isPhoneVerified
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                        Phone: {p.isPhoneVerified ? 'Verified' : 'Unverified'}
                      </span>
                      {canEdit && !p.isPhoneVerified && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...p, isPhoneVerified: true };
                            onUpdatePermission(updated);
                            showNotification(`Manually verified phone for ${p.name}.`);
                          }}
                          className="text-[9px] text-blue-600 hover:text-blue-805 font-bold bg-blue-55 hover:bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5 cursor-pointer transition-all"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Status badges */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.isApproved ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                        <ShieldCheck className="w-3 h-3" /> Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
                        Pending
                      </span>
                    )}
                    {teamMembers.length > 0 && (
                      membership ? (
                        membership.confirm ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                            <CheckCircle className="w-2.5 h-2.5" /> Appwrite ✓
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-50 text-orange-600 border border-orange-200">
                            <RefreshCw className="w-2.5 h-2.5" /> Invite Pending
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          <XCircle className="w-2.5 h-2.5" /> Not in Appwrite
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Role selector + actions row */}
              <div className="px-4 pb-4 flex flex-wrap items-center gap-2">
                {/* Role select */}
                <select
                  value={p.role}
                  onChange={(e) => changeUserRole(p, e.target.value as any)}
                  disabled={
                    isCurrentUser ||
                    !p.isApproved ||
                    (isBackendOrg && !canEditBackend) ||
                    (currentUserRole === 'Custom' && (p.role === 'Admin' || p.role === 'SuperAdmin'))
                  }
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer disabled:opacity-50 flex-1 min-w-0"
                >
                  {p.role === 'SuperAdmin' && <option value="SuperAdmin">Super Admin</option>}
                  <option value="Admin">Administrator</option>
                  <option value="Custom">Custom Rights</option>
                </select>

                {/* Approve button */}
                {!p.isApproved && (
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
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                )}

                {/* Configure permissions */}
                {p.role === 'Custom' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!p.isApproved) {
                        showNotification("Approve user registration access first.");
                        return;
                      }
                      setExpandedUserId(isExpanded ? null : p.id);
                    }}
                    disabled={!p.isApproved}
                    className="flex items-center gap-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer transition disabled:opacity-50"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {isExpanded ? 'Close' : 'Permissions'}
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-500 font-semibold font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200">
                    Full Admin
                  </span>
                )}

                {/* Delete */}
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
                  className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-100 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Revoke User Access"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Expanded permissions panel */}
              {isExpanded && p.role === 'Custom' && p.isApproved && (
                <div className="border-t border-slate-200 p-4 bg-slate-50 animate-fade-in">
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                    <ShieldCheck className="w-3.5 h-3.5" /> Fine-grained permissions — {p.name}
                  </h4>
                  <div className="space-y-2">
                    {(!isBackendOrg ? [
                      { label: 'Trip Management', view: 'canViewTrips', edit: 'canEditTrips', del: 'canDeleteTrips' },
                      { label: 'Tyre Inventory', view: 'canViewTyres', edit: 'canEditTyres', del: 'canDeleteTyres' },
                      { label: 'Truck Registry', view: 'canViewTrucks', edit: 'canEditTrucks', del: 'canDeleteTrucks' },
                      { label: 'Driver Database', view: 'canViewDrivers', edit: 'canEditDrivers', del: 'canDeleteDrivers' },
                      { label: 'Offices Directory', view: 'canViewOffices', edit: 'canEditOffices', del: 'canDeleteOffices' },
                      { label: 'Ledger Accounts', view: 'canViewAccounts', edit: 'canEditAccounts', del: 'canDeleteAccounts' },
                      { label: 'Expense Vouchers', view: 'canViewExpenses', edit: 'canEditExpenses', del: 'canDeleteExpenses' },
                      { label: 'Vehicle Loan Details', view: '', edit: 'canEditLoans', del: 'canDeleteLoans' }
                    ] : [
                      { label: 'Customer Org Profiles', view: 'canViewBackend', edit: 'canEditBackend', del: 'canDeleteBackend' },
                      { label: 'Truck Activation Requests', view: 'canViewTruckRequests', edit: 'canApproveBackend', del: 'canDeleteTruckRequests' },
                      { label: 'Backend Team Access', view: 'canViewBackendTeam', edit: 'canAddBackend', del: 'canDeleteBackendTeam' },
                      { label: 'Database Console', view: 'canViewDatabaseConsole', edit: 'canEditDatabaseConsole', del: 'canDeleteDatabaseConsole' },
                      { label: 'Support Tickets Desk', view: 'canViewTickets', edit: 'canEditTickets', del: 'canDeleteTickets' }
                    ]).map(mod => (
                      <div key={mod.label} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                        <span className="text-xs font-bold text-slate-700 block mb-2">{mod.label}</span>
                        <div className="flex gap-4">
                          {mod.view ? (
                            <label className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!(p as any)[mod.view]}
                                onChange={() => toggleUserRight(p, mod.view as any)}
                                disabled={isBackendOrg && !canEditBackend}
                                className="rounded-sm border-slate-300 text-blue-600 w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                              />
                              View
                            </label>
                          ) : (
                            <span className="text-slate-350 font-sans font-bold text-[11px]">View: —</span>
                          )}
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!(p as any)[mod.edit]}
                              onChange={() => toggleUserRight(p, mod.edit as any)}
                              disabled={isBackendOrg && !canEditBackend}
                              className="rounded-sm border-slate-300 text-blue-600 w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                            />
                            Edit
                          </label>
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!(p as any)[mod.del]}
                              onChange={() => toggleUserRight(p, mod.del as any)}
                              disabled={isBackendOrg && !canEditBackend}
                              className="rounded-sm border-slate-300 text-blue-600 w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                            />
                            Delete
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  {isBackendOrg && (
                    <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-slate-150">
                      {/* Support Category Selection */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Support Category Roles</label>
                        <div className="flex flex-wrap gap-4 mt-1 bg-white border border-slate-200 rounded-lg p-2.5">
                          {['Technical', 'Billing', 'General'].map((roleVal) => {
                            const typedRole = roleVal as 'Technical' | 'Billing' | 'General';
                            const currentRoles = Array.isArray(p.supportRole)
                              ? p.supportRole
                              : (typeof p.supportRole === 'string' && p.supportRole !== 'None' && p.supportRole !== ''
                                ? [p.supportRole]
                                : []);
                            const isChecked = currentRoles.includes(typedRole);
                            return (
                              <label key={roleVal} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isBackendOrg && !canEditBackend}
                                  onChange={() => {
                                    const newRoles = (isChecked
                                      ? currentRoles.filter(r => r !== typedRole)
                                      : [...currentRoles, typedRole]) as ('Technical' | 'Billing' | 'General')[];
                                    const updated = { ...p, supportRole: newRoles };
                                    onUpdatePermission(updated);
                                  }}
                                  className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                                />
                                {roleVal}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Ticket Transfer Permission */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`checkbox-transfer-tickets-mob-${p.id}`}
                          checked={!!p.canTransferTickets}
                          onChange={() => {
                            const updated = { ...p, canTransferTickets: !p.canTransferTickets };
                            onUpdatePermission(updated);
                          }}
                          disabled={isBackendOrg && !canEditBackend}
                          className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                        />
                        <label htmlFor={`checkbox-transfer-tickets-mob-${p.id}`} className="text-xs font-bold text-slate-700 cursor-pointer uppercase tracking-tight">
                          Authorize Ticket Transfer Privileges
                        </label>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end mt-3">
                    <button
                      type="button"
                      onClick={() => setExpandedUserId(null)}
                      className="px-3 py-1.5 bg-slate-900 text-white font-bold text-[10px] rounded-lg hover:bg-slate-800 cursor-pointer transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Desktop table (≥ md) ── */}
      <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-lg">
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
              const canEdit = !isBackendOrg || canEditBackend;

              return (
                <React.Fragment key={p.id}>
                  <tr className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3.5 pl-6 font-bold text-slate-800 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold font-sans border border-slate-200 shadow-2xs">
                        {p.name ? p.name.substring(0, 2).toUpperCase() : 'US'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{p.name}</span>
                          {isCurrentUser && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">You</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{p.email}</span>
                        <span className="text-[10px] text-slate-450 font-mono block mt-0.5">Phone: {p.phone || 'Not Set'}</span>

                        {/* Verification override panel */}
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          <div className="flex items-center gap-1">
                            <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-semibold ${p.isEmailVerified
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                              Email: {p.isEmailVerified ? 'Verified' : 'Unverified'}
                            </span>
                            {canEdit && !p.isEmailVerified && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = { ...p, isEmailVerified: true };
                                  onUpdatePermission(updated);
                                  showNotification(`Manually verified email for ${p.name}.`);
                                }}
                                className="text-[9px] text-blue-600 hover:text-blue-805 font-bold bg-blue-55 hover:bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5 cursor-pointer transition-all"
                              >
                                Verify
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-semibold ${p.isPhoneVerified
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                              Phone: {p.isPhoneVerified ? 'Verified' : 'Unverified'}
                            </span>
                            {canEdit && !p.isPhoneVerified && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = { ...p, isPhoneVerified: true };
                                  onUpdatePermission(updated);
                                  showNotification(`Manually verified phone for ${p.name}.`);
                                }}
                                className="text-[9px] text-blue-600 hover:text-blue-805 font-bold bg-blue-55 hover:bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5 cursor-pointer transition-all"
                              >
                                Verify
                              </button>
                            )}
                          </div>
                        </div>
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
                                { label: 'Expense Vouchers', view: 'canViewExpenses', edit: 'canEditExpenses', del: 'canDeleteExpenses' },
                                { label: 'Vehicle Loan Details', view: '', edit: 'canEditLoans', del: 'canDeleteLoans' }
                              ] : [
                                { label: 'Customer Organization Profiles', view: 'canViewBackend', edit: 'canEditBackend', del: 'canDeleteBackend' },
                                { label: 'Truck Activation Requests', view: 'canViewTruckRequests', edit: 'canApproveBackend', del: 'canDeleteTruckRequests' },
                                { label: 'Backend Team Access Control', view: 'canViewBackendTeam', edit: 'canAddBackend', del: 'canDeleteBackendTeam' },
                                { label: 'Database Console / Raw Editor', view: 'canViewDatabaseConsole', edit: 'canEditDatabaseConsole', del: 'canDeleteDatabaseConsole' },
                                { label: 'Support Tickets Desk', view: 'canViewTickets', edit: 'canEditTickets', del: 'canDeleteTickets' }
                              ]).map(mod => (
                                <div key={mod.label} className="grid grid-cols-4 gap-2 py-2.5 items-center text-xs">
                                  <span className="font-bold text-slate-800">{mod.label}</span>
                                  <div className="text-center">
                                    {mod.view ? (
                                      <input
                                        type="checkbox"
                                        checked={!!(p as any)[mod.view]}
                                        onChange={() => toggleUserRight(p, mod.view as any)}
                                        disabled={isBackendOrg && !canEditBackend}
                                        className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                      />
                                    ) : (
                                      <span className="text-slate-350 font-sans font-bold">—</span>
                                    )}
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
                          {isBackendOrg && (
                            <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-slate-200">
                              {/* Support Category Selection */}
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Support Category Roles</label>
                                <div className="flex flex-wrap gap-4 mt-1 bg-white border border-slate-200 rounded-lg p-2.5">
                                  {['Technical', 'Billing', 'General'].map((roleVal) => {
                                    const typedRole = roleVal as 'Technical' | 'Billing' | 'General';
                                    const currentRoles = Array.isArray(p.supportRole)
                                      ? p.supportRole
                                      : (typeof p.supportRole === 'string' && p.supportRole !== 'None' && p.supportRole !== ''
                                        ? [p.supportRole]
                                        : []);
                                    const isChecked = currentRoles.includes(typedRole);
                                    return (
                                      <label key={roleVal} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          disabled={isBackendOrg && !canEditBackend}
                                          onChange={() => {
                                            const newRoles = (isChecked
                                              ? currentRoles.filter(r => r !== typedRole)
                                              : [...currentRoles, typedRole]) as ('Technical' | 'Billing' | 'General')[];
                                            const updated = { ...p, supportRole: newRoles };
                                            onUpdatePermission(updated);
                                          }}
                                          className="rounded-sm border-slate-350 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                                        />
                                        {roleVal}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Ticket Transfer Permission */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`checkbox-transfer-tickets-${p.id}`}
                                  checked={!!p.canTransferTickets}
                                  onChange={() => {
                                    const updated = { ...p, canTransferTickets: !p.canTransferTickets };
                                    onUpdatePermission(updated);
                                  }}
                                  disabled={isBackendOrg && !canEditBackend}
                                  className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                                />
                                <label htmlFor={`checkbox-transfer-tickets-${p.id}`} className="text-xs font-bold text-slate-700 cursor-pointer uppercase tracking-tight">
                                  Authorize Ticket Transfer Privileges (Can move tickets between queues)
                                </label>
                              </div>
                            </div>
                          )}
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
