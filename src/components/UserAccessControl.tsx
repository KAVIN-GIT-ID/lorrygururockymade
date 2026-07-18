import { createSignal, createEffect } from 'solid-js';

import { UserPermission, OrganizationProfile, UserRights } from '../types';
import { Plus, Trash2, Shield, User, Mail, CheckCircle, XCircle, ChevronDown, ChevronUp, ShieldCheck, Check, RefreshCw, Cloud, CreditCard, Phone } from 'lucide-solid';

interface TeamMember {
  $id: string;
  userId: string;
  userEmail: string;
  userName: string;
  roles: string[];
  confirm: boolean; // true = accepted, false = pending email() confirmation
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
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [email, setEmail] = createSignal('');
  const [name, setName] = createSignal('');
  const [phone, setPhone] = createSignal('');
  const [role, setRole] = createSignal<'Admin' | 'Custom'>('Custom');
  const [expandedUserId, setExpandedUserId] = createSignal<string | null>(null);

  const [engineOilInterval, setEngineOilInterval] = createSignal<number | ''>('');
  const [crownOilInterval, setCrownOilInterval] = createSignal<number | ''>('');
  const [gearBoxOilInterval, setGearBoxOilInterval] = createSignal<number | ''>('');
  const [radiatorInterval, setRadiatorInterval] = createSignal<number | ''>('');
  const [pinpushInterval, setPinpushInterval] = createSignal<number | ''>('');
  const [wheelGreaseInterval, setWheelGreaseInterval] = createSignal<number | ''>('');
  const [brokeragePolicy, setBrokeragePolicy] = createSignal<'OrgBears' | 'DriverBears'>('DriverBears');
  const [insuranceWarningDays, setInsuranceWarningDays] = createSignal<number | ''>('');
  const [fcWarningDays, setFcWarningDays] = createSignal<number | ''>('');
  const [npTaxWarningDays, setNpTaxWarningDays] = createSignal<number | ''>('');
  const [fiveYearPermitWarningDays, setFiveYearPermitWarningDays] = createSignal<number | ''>('');
  const [qTaxWarningDays, setQTaxWarningDays] = createSignal<number | ''>('');
  const [greenTaxWarningDays, setGreenTaxWarningDays] = createSignal<number | ''>('');
  const [subscriptionWarningDays, setSubscriptionWarningDays] = createSignal<number | ''>('');

  const [lastOrgId, setLastOrgId] = createSignal<string | null>(null);

  createEffect(() => {
    if (orgProfile && orgProfile.organizationId !== lastOrgId()) {
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
  });

  const handleSaveOrgDefaults = (e: Event) => {
    e.preventDefault();
    if (!orgProfile || !onUpdateOrgProfile) return;
    onUpdateOrgProfile({
      ...orgProfile,
      engineOilIntervalKM: engineOilInterval() !== '' ? Number(engineOilInterval()) : undefined,
      crownOilIntervalKM: crownOilInterval() !== '' ? Number(crownOilInterval()) : undefined,
      gearBoxOilIntervalKM: gearBoxOilInterval() !== '' ? Number(gearBoxOilInterval()) : undefined,
      radiatorIntervalKM: radiatorInterval() !== '' ? Number(radiatorInterval()) : undefined,
      pinpushIntervalKM: pinpushInterval() !== '' ? Number(pinpushInterval()) : undefined,
      wheelGreaseIntervalKM: wheelGreaseInterval() !== '' ? Number(wheelGreaseInterval()) : undefined,
      brokeragePolicy: brokeragePolicy(),
      insuranceWarningDays: insuranceWarningDays() !== '' ? Number(insuranceWarningDays()) : undefined,
      fcWarningDays: fcWarningDays() !== '' ? Number(fcWarningDays()) : undefined,
      npTaxWarningDays: npTaxWarningDays() !== '' ? Number(npTaxWarningDays()) : undefined,
      fiveYearPermitWarningDays: fiveYearPermitWarningDays() !== '' ? Number(fiveYearPermitWarningDays()) : undefined,
      qTaxWarningDays: qTaxWarningDays() !== '' ? Number(qTaxWarningDays()) : undefined,
      greenTaxWarningDays: greenTaxWarningDays() !== '' ? Number(greenTaxWarningDays()) : undefined,
      subscriptionWarningDays: subscriptionWarningDays() !== '' ? Number(subscriptionWarningDays()) : undefined,
    });
    showNotification("Organization defaults updated successfully!");
  };

  const [newExpenseType, setNewExpenseType] = createSignal('');
  const [newShopName, setNewShopName] = createSignal('');

  const handleAddExpenseType = (e: Event) => {
    e.preventDefault();
    if (!orgProfile || !onUpdateOrgProfile || !newExpenseType().trim()) return;
    const currentTypes = orgProfile.customExpenseTypes || [];
    const val = newExpenseType().trim();
    if (currentTypes.includes(val)) {
      showNotification("Expense type already exists!");
      return;
    }
    onUpdateOrgProfile({
      ...orgProfile,
      customExpenseTypes: [...currentTypes, val]
    });
    setNewExpenseType('');
    showNotification("Expense type added successfully!");
  };

  const handleDeleteExpenseType = (typeToDelete: string) => {
    if (!orgProfile || !onUpdateOrgProfile) return;
    const currentTypes = orgProfile.customExpenseTypes || [];
    onUpdateOrgProfile({
      ...orgProfile,
      customExpenseTypes: currentTypes.filter(t => t !== typeToDelete)
    });
    showNotification("Expense type deleted successfully!");
  };

  const handleAddShopName = (e: Event) => {
    e.preventDefault();
    if (!orgProfile || !onUpdateOrgProfile || !newShopName().trim()) return;
    const currentShops = orgProfile.shopNames || [];
    const val = newShopName().trim();
    if (currentShops.includes(val)) {
      showNotification("Shop name() already exists!");
      return;
    }
    onUpdateOrgProfile({
      ...orgProfile,
      shopNames: [...currentShops, val]
    });
    setNewShopName('');
    showNotification("Shop name() added successfully!");
  };

  const handleDeleteShopName = (shopToDelete: string) => {
    if (!orgProfile || !onUpdateOrgProfile) return;
    const currentShops = orgProfile.shopNames || [];
    onUpdateOrgProfile({
      ...orgProfile,
      shopNames: currentShops.filter(s => s !== shopToDelete)
    });
    showNotification("Shop name() deleted successfully!");
  };

  const [fuelCardName, setFuelCardName] = createSignal('');
  const [fuelCardNo, setFuelCardNo] = createSignal('');
  const [fuelCardStatus, setFuelCardStatus] = createSignal<'Active' | 'Inactive'>('Active');
  const [editingFuelCardId, setEditingFuelCardId] = createSignal<string | null>(null);
  const [showFuelCardForm, setShowFuelCardForm] = createSignal(false);

  const handleSaveFuelCard = (e: Event) => {
    e.preventDefault();
    if (!orgProfile || !onUpdateOrgProfile || !fuelCardName().trim()) return;

    const currentCards = orgProfile.fuelCards || [];
    let updatedCards;

    if (editingFuelCardId()) {
      updatedCards = currentCards.map(c =>
        c.id === editingFuelCardId()
          ? { ...c, cardName: fuelCardName().trim(), cardNumber: fuelCardNo().trim() || undefined, status: fuelCardStatus() }
          : c
      );
    } else {
      const newCard = {
        id: 'fc_' + Date.now(),
        cardName: fuelCardName().trim(),
        cardNumber: fuelCardNo().trim() || undefined,
        status: fuelCardStatus()
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
    showNotification(editingFuelCardId() ? "Fuel card updated successfully!" : "Fuel card added successfully!");
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
  const [supportRoles, setSupportRoles] = createSignal<('Technical' | 'Billing' | 'General')[]>([]);

  const [rights, setRights] = createSignal({
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

  const toggleFormRight = (key: keyof ReturnType<typeof rights>) => {
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

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!email().trim() || !name().trim()) return;

    // Check duplicate email()
    if (permissions.some(p => p.email.toLowerCase().trim() === email().toLowerCase().trim())) {
      alert("A user with this email() address already exists in the access control registry.");
      return;
    }

    onAddPermission({
      email: email().trim().toLowerCase(),
      name: name().trim(),
      phone: phone().trim() || undefined,
      isEmailVerified: false,
      isPhoneVerified: false,
      role: role(),
      organizationId: currentUserOrgId,
      isApproved: true, // Manual additions by admin are auto-approved
      supportRole: isBackendOrg ? supportRoles() : [],
      ...rights()
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
      showNotification("Cannot modify individual rights() on an Admin account. Downgrade to Custom role() first.");
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
      alert("Safety Lock: You cannot change your own role() and revoke your Admin permissions.");
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
    showNotification(`Updated role() for ${userPerm.name} to ${newRole}.`);
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

  /** Find this user's live Appwrite membership record (by email() match) */
  const getAppwriteMembership = (targetEmail: string): TeamMember | undefined => {
    const cleanEmail = targetEmail.trim().toLowerCase();
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
    <div id="user-access-panel" class="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs animate-fade-in text-slate-850">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 class="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Shield class="w-5 h-5 text-blue-600" />
            User Access Control (RBAC)
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Manage user access, grant role() privileges, approve pending registrants, and toggle view/edit/delete modules.
          </p>
        </div>
        <div class="flex items-center gap-2.5">
          {/* Appwrite Teams sync indicator */}
          {teamMembers.length > 0 && (
            <span class="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
              <Cloud class="w-3 h-3" />
              {teamMembers.length} in Appwrite Team
            </span>
          )}
          {loadingTeamMembers && (
            <span class="inline-flex items-center gap-1 text-[9px] text-slate-400">
              <RefreshCw class="w-3 h-3 animate-spin" /> Syncing...
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
              setShowAddForm(!showAddForm());
            }}
            disabled={isBackendOrg && !canAddBackend}
            class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-150 shadow-sm text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showAddForm() ? 'Close Panel' : (
              <>
                <Plus class="w-3.5 h-3.5" /> Add User Access
              </>
            )}
          </button>
        </div>
      </div>

      {/* ORGANIZATION DEFAULT MAINTENANCE SETTINGS (ORG DEFAULTS) */}
      {orgProfile && !isBackendOrg && (
        <div class="mb-6 p-4 md:p-5 bg-slate-50 rounded-xl border border-slate-200 animate-fade-in space-y-4 text-slate-800">
          <div class="flex items-center gap-2 border-b border-slate-200 pb-2">
            <Shield class="w-4 h-4 text-blue-600 animate-pulse" />
            <h3 class="text-xs font-bold text-blue-650 uppercase tracking-widest">
              Organization Default Maintenance Settings (Org Defaults)
            </h3>
          </div>
          <p class="text-[11px] text-slate-500 leading-relaxed">
            Define the organization-wide default service intervals (in kilometers). These thresholds are used across your fleet registry to warn about due maintenance milestones. Individual vehicles can override these defaults in the Truck Registry specs form.
          </p>
          <form onSubmit={handleSaveOrgDefaults} class="space-y-4">
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label for="input-org-engine-oil-interval" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">Engine Oil Change (KM)</label>
                <input
                  id="input-org-engine-oil-interval"
                  type="number"
                  placeholder="e.g. 15000"
                  value={engineOilInterval()}
                  onChange={(e) => setEngineOilInterval(e.target.value === '' ? '' : Number(e.target.value))}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label for="input-org-crown-oil-interval" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">Crown Oil Change (KM)</label>
                <input
                  id="input-org-crown-oil-interval"
                  type="number"
                  placeholder="e.g. 40000"
                  value={crownOilInterval()}
                  onChange={(e) => setCrownOilInterval(e.target.value === '' ? '' : Number(e.target.value))}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label for="input-org-gearbox-oil-interval" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">Gear Box Oil Change (KM)</label>
                <input
                  id="input-org-gearbox-oil-interval"
                  type="number"
                  placeholder="e.g. 40000"
                  value={gearBoxOilInterval()}
                  onChange={(e) => setGearBoxOilInterval(e.target.value === '' ? '' : Number(e.target.value))}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label for="input-org-radiator-interval" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">Radiator Service (KM)</label>
                <input
                  id="input-org-radiator-interval"
                  type="number"
                  placeholder="e.g. 20000"
                  value={radiatorInterval()}
                  onChange={(e) => setRadiatorInterval(e.target.value === '' ? '' : Number(e.target.value))}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label for="input-org-pinpush-interval" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">Pinpush Grease (KM)</label>
                <input
                  id="input-org-pinpush-interval"
                  type="number"
                  placeholder="e.g. 5000"
                  value={pinpushInterval()}
                  onChange={(e) => setPinpushInterval(e.target.value === '' ? '' : Number(e.target.value))}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label for="input-org-wheel-grease-interval" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">Wheel Grease (KM)</label>
                <input
                  id="input-org-wheel-grease-interval"
                  type="number"
                  placeholder="e.g. 5000"
                  value={wheelGreaseInterval()}
                  onChange={(e) => setWheelGreaseInterval(e.target.value === '' ? '' : Number(e.target.value))}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label for="select-org-brokerage-policy" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">Office Brokerage default policy</label>
                <select
                  id="select-org-brokerage-policy"
                  value={brokeragePolicy()}
                  onChange={(e) => setBrokeragePolicy(e.target.value as 'OrgBears' | 'DriverBears')}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="DriverBears">Collect/Recover from Driver (Policy 2 - Default)</option>
                  <option value="OrgBears">Bear/Absorb as Org Expense (Policy 1)</option>
                </select>
              </div>
            </div>

            {/* COMPLIANCE ALERT THRESHOLDS */}
            <div class="border-t border-slate-200/60 pt-4 space-y-3">
              <h4 class="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">
                Compliance Alert Thresholds (Warning Days before Expiry)
              </h4>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label for="input-org-insurance-warning" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">Insurance Alert (Days)</label>
                  <input
                    id="input-org-insurance-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={insuranceWarningDays()}
                    onChange={(e) => setInsuranceWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label for="input-org-fc-warning" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">FC Alert (Days)</label>
                  <input
                    id="input-org-fc-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={fcWarningDays()}
                    onChange={(e) => setFcWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label for="input-org-np-warning" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">National Permit Alert (Days)</label>
                  <input
                    id="input-org-np-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={npTaxWarningDays()}
                    onChange={(e) => setNpTaxWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label for="input-org-5y-warning" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">5Y Permit Alert (Days)</label>
                  <input
                    id="input-org-5y-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={fiveYearPermitWarningDays()}
                    onChange={(e) => setFiveYearPermitWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label for="input-org-qtax-warning" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">Q Tax Alert (Days)</label>
                  <input
                    id="input-org-qtax-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={qTaxWarningDays()}
                    onChange={(e) => setQTaxWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label for="input-org-greentax-warning" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">Green Tax Alert (Days)</label>
                  <input
                    id="input-org-greentax-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={greenTaxWarningDays()}
                    onChange={(e) => setGreenTaxWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label for="input-org-subscription-warning" class="block text-[10px] font-bold text-slate-650 uppercase mb-1">Subscription Alert (Days)</label>
                  <input
                    id="input-org-subscription-warning"
                    type="number"
                    placeholder="Defaults to 30 days"
                    value={subscriptionWarningDays()}
                    onChange={(e) => setSubscriptionWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div class="flex justify-end">
              <button
                type="submit"
                class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
              >
                Save Org Defaults
              </button>
            </div>
          </form>

          {/* FUEL CARDS SECTION */}
          <div class="border-t border-slate-200 pt-4 mt-6 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-200 pb-2">
              <div class="flex items-center gap-2">
                <CreditCard class="w-4 h-4 text-blue-650" />
                <h3 class="text-xs font-bold text-blue-650 uppercase tracking-widest">
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
                  setShowFuelCardForm(!showFuelCardForm());
                }}
                class="bg-white hover:bg-slate-50 border border-slate-350 text-slate-705 font-bold text-[10px] py-1.5 px-2.5 rounded-lg shadow-3xs cursor-pointer inline-flex items-center gap-1"
              >
                {showFuelCardForm() ? 'Close Form' : '+ Add Fuel Card'}
              </button>
            </div>

            {showFuelCardForm() && (
              <form onSubmit={handleSaveFuelCard} class="bg-white border border-slate-200 p-4 rounded-xl space-y-3 shadow-3xs">
                <h4 class="text-[10px] font-bold text-blue-655 uppercase tracking-wider">
                  {editingFuelCardId() ? 'Edit Fuel Card' : 'Add New Fuel Card'}
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label for="input-fuel-card-name()" class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Card Name / Account</label>
                    <input
                      id="input-fuel-card-name()"
                      type="text"
                      required
                      placeholder="e.g. HPCL Card #1"
                      value={fuelCardName()}
                      onChange={(e) => setFuelCardName(e.target.value)}
                      class="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label for="input-fuel-card-no" class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Card Number (Optional)</label>
                    <input
                      id="input-fuel-card-no"
                      type="text"
                      placeholder="e.g. 700012345678"
                      value={fuelCardNo()}
                      onChange={(e) => setFuelCardNo(e.target.value)}
                      class="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Status</label>
                    <select
                      value={fuelCardStatus()}
                      onChange={(e) => setFuelCardStatus(e.target.value as 'Active' | 'Inactive')}
                      class="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowFuelCardForm(false)}
                    class="px-3 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[10px] px-3.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    {editingFuelCardId() ? 'Save Changes' : 'Add Card'}
                  </button>
                </div>
              </form>
            )}

            {/* List of Fuel Cards */}
            {(!orgProfile.fuelCards || orgProfile.fuelCards.length === 0) ? (
              <p class="text-[11px] text-slate-400 italic text-center py-2">No fuel cards configured for this organization.</p>
            ) : (
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {orgProfile.fuelCards.map((card) => (
                  <div  class="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-3xs">
                    <div class="space-y-0.5">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-slate-800 text-xs">{card.cardName}</span>
                        <span class={`inline-block w-1.5 h-1.5 rounded-full ${card.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-350'}`}></span>
                      </div>
                      {card.cardNumber && (
                        <code class="text-[10px] text-slate-400 font-mono select-all block">{card.cardNumber}</code>
                      )}
                    </div>
                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFuelCardId(card.id);
                          setFuelCardName(card.cardName);
                          setFuelCardNo(card.cardNumber || '');
                          setFuelCardStatus(card.status);
                          setShowFuelCardForm(true);
                        }}
                        class="text-blue-600 hover:text-blue-800 text-[10px] font-bold cursor-pointer"
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
                        class="text-rose-600 hover:text-rose-800 text-[10px] font-bold cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* CUSTOM EXPENSE TYPES & SHOP NAMES SECTION */}
            <div class="border-t border-slate-200 pt-4 mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Dynamic Expense Types */}
              <div class="space-y-4">
                <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div class="flex items-center gap-2">
                    <Shield class="w-4 h-4 text-blue-650 animate-pulse" />
                    <h3 class="text-xs font-bold text-blue-655 uppercase tracking-wider">
                      Custom Expense Types
                    </h3>
                  </div>
                </div>

                <form onSubmit={handleAddExpenseType} class="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Water Wash, RTO Fine"
                    value={newExpenseType()}
                    onChange={(e) => setNewExpenseType(e.target.value)}
                    class="flex-1 bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                  />
                  <button
                    type="submit"
                    class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    Add Type
                  </button>
                </form>

                {(!orgProfile.customExpenseTypes || orgProfile.customExpenseTypes.length === 0) ? (
                  <p class="text-[11px] text-slate-400 italic py-1">No custom expense types configured. Standard defaults will be used.</p>
                ) : (
                  <div class="flex flex-wrap gap-2">
                    {orgProfile.customExpenseTypes.map((type) => (
                      <span
                        
                        class="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-blue-750 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1"
                      >
                        {type}
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete custom expense type "${type}"?`)) {
                              handleDeleteExpenseType(type);
                            }
                          }}
                          class="text-slate-405 hover:text-rose-600 transition"
                        >
                          <Trash2 class="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Shop Names */}
              <div class="space-y-4">
                <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div class="flex items-center gap-2">
                    <ShieldCheck class="w-4 h-4 text-blue-650" />
                    <h3 class="text-xs font-bold text-blue-655 uppercase tracking-wider">
                      Authorized Shop/Supplier Names
                    </h3>
                  </div>
                </div>

                <form onSubmit={handleAddShopName} class="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Royal Auto, Premier Tyres"
                    value={newShopName()}
                    onChange={(e) => setNewShopName(e.target.value)}
                    class="flex-1 bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                  />
                  <button
                    type="submit"
                    class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    Add Shop
                  </button>
                </form>

                {(!orgProfile.shopNames || orgProfile.shopNames.length === 0) ? (
                  <p class="text-[11px] text-slate-400 italic py-1">No custom shop names configured. Users can type any name().</p>
                ) : (
                  <div class="flex flex-wrap gap-2">
                    {orgProfile.shopNames.map((shop) => (
                      <span
                        
                        class="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-250 rounded-lg px-2.5 py-1"
                      >
                        {shop}
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete shop name() "${shop}"?`)) {
                              handleDeleteShopName(shop);
                            }
                          }}
                          class="text-slate-405 hover:text-rose-600 transition"
                        >
                          <Trash2 class="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {showAddForm() && (
        <form onSubmit={handleSubmit} class="mb-6 p-4 md:p-5 bg-slate-50 rounded-lg border border-slate-200 animate-fade-in space-y-4">
          <h3 class="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Authorize New User Account
          </h3>
          <div class={`grid grid-cols-1 ${isBackendOrg ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4`}>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Full Name <span class="text-red-500">*</span></label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User class="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name()}
                  onChange={(e) => setName(e.target.value)}
                  required
                  class="w-full bg-white border border-slate-200 text-slate-850 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Email Address <span class="text-red-500">*</span></label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail class="w-3.5 h-3.5" />
                </span>
                <input
                  type="email"
                  placeholder="e.g. john@company.com"
                  value={email()}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">Mobile Number</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Phone class="w-3.5 h-3.5" />
                </span>
                <input
                  type="tel"
                  placeholder="e.g. +1234567890"
                  value={phone()}
                  onChange={(e) => setPhone(e.target.value)}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-550 font-mono"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1">System Role</label>
              <select
                value={role()}
                onChange={(e) => handleRoleChange(e.target.value as 'Admin' | 'Custom')}
                class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-semibold"
              >
                <option value="Custom">Custom Permissions Set</option>
                <option value="Admin">Administrator (All Permissions)</option>
              </select>
            </div>
            {isBackendOrg && (
              <div class="col-span-1 md:col-span-2">
                <label class="block text-xs font-semibold text-slate-600 mb-1">Support Category Roles</label>
                <div class="flex flex-wrap gap-4 mt-2">
                  {['Technical', 'Billing', 'General'].map((roleVal) => {
                    const typedRole = roleVal as 'Technical' | 'Billing' | 'General';
                    const isChecked = supportRoles().includes(typedRole);
                    return (
                      <label  class="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
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
                          class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        {roleVal}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {role() === 'Custom' && (
            <div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <span class="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Define Specific module View, Edit, and Delete Rights</span>
              <div class="grid grid-cols-4 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 p-2.5 rounded-t-lg border-b border-slate-200">
                <div>Module / Feature</div>
                <div class="text-center">View (Read)</div>
                <div class="text-center">Create/Edit (Write)</div>
                <div class="text-center">Delete (Remove)</div>
              </div>
              <div class="divide-y divide-slate-100">
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
                  <div  class="grid grid-cols-4 gap-2 py-2 items-center text-xs">
                    <span class="font-semibold text-slate-700">{mod.label}</span>
                    <div class="text-center">
                      {mod.view ? (
                        <input
                          type="checkbox"
                          checked={!!(rights() as any)[mod.view]}
                          onChange={() => toggleFormRight(mod.view as any)}
                          disabled={isBackendOrg && !canAddBackend}
                          class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                        />
                      ) : (
                        <span class="text-slate-350 font-sans font-bold">—</span>
                      )}
                    </div>
                    <div class="text-center">
                      <input
                        type="checkbox"
                        checked={!!(rights() as any)[mod.edit]}
                        onChange={() => toggleFormRight(mod.edit as any)}
                        disabled={isBackendOrg && !canAddBackend}
                        class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                      />
                    </div>
                    <div class="text-center">
                      <input
                        type="checkbox"
                        checked={!!(rights() as any)[mod.del]}
                        onChange={() => toggleFormRight(mod.del as any)}
                        disabled={isBackendOrg && !canAddBackend}
                        class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {isBackendOrg && (
                <div class="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <input
                    type="checkbox"
                    id="checkbox-form-transfer-tickets"
                    checked={rights().canTransferTickets}
                    onChange={() => setRights(prev => ({ ...prev, canTransferTickets: !prev.canTransferTickets }))}
                    class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <label for="checkbox-form-transfer-tickets" class="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer uppercase tracking-tight">
                    Authorize Ticket Transfer Privileges (Can move tickets between Technical/Billing/General category queues)
                  </label>
                </div>
              )}
            </div>
          )}

          <div class="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(false);
              }}
              class="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isBackendOrg && !canAddBackend}
              class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Grant Access
            </button>
          </div>
        </form>
      )}

      {/* ── Mobile card list (< md) ── */}
      <div class="block md:hidden space-y-3">
        {permissions.map((p) => {
          const isCurrentUser = p.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim();
          const membership = getAppwriteMembership(p.email);
          const isExpanded = expandedUserId() === p.id;
          const canEdit = !isBackendOrg || canEditBackend;

          return (
            <div  class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {/* Card header */}
              <div class="flex items-start gap-3 p-4">
                <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 text-sm font-extrabold border border-slate-200 flex-shrink-0">
                  {p.name ? p.name.substring(0, 2).toUpperCase() : 'US'}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-slate-800 text-sm truncate">{p.name}</span>
                    {isCurrentUser && (
                      <span class="bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">You</span>
                    )}
                  </div>
                  <span class="text-[11px] text-slate-400 font-mono block mt-0.5 truncate">{p.email}</span>
                  <span class="text-[11px] text-slate-450 font-mono block mt-0.5 truncate">Phone: {p.phone || 'Not Set'}</span>

                  {/* Verification override panel */}
                  <div class="flex flex-wrap gap-2 mt-2">
                    <div class="flex items-center gap-1">
                      <span class={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-semibold ${p.isEmailVerified
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
                            showNotification(`Manually verified email() for ${p.name}.`);
                          }}
                          class="text-[9px] text-blue-600 hover:text-blue-805 font-bold bg-blue-55 hover:bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5 cursor-pointer transition-all"
                        >
                          Verify
                        </button>
                      )}
                    </div>

                    <div class="flex items-center gap-1">
                      <span class={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-semibold ${p.isPhoneVerified
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
                            showNotification(`Manually verified phone() for ${p.name}.`);
                          }}
                          class="text-[9px] text-blue-600 hover:text-blue-805 font-bold bg-blue-55 hover:bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5 cursor-pointer transition-all"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Status badges */}
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    {p.isApproved ? (
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                        <ShieldCheck class="w-3 h-3" /> Approved
                      </span>
                    ) : (
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
                        Pending
                      </span>
                    )}
                    {teamMembers.length > 0 && (
                      membership ? (
                        membership.confirm ? (
                          <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                            <CheckCircle class="w-2.5 h-2.5" /> Appwrite ✓
                          </span>
                        ) : (
                          <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-50 text-orange-600 border border-orange-200">
                            <RefreshCw class="w-2.5 h-2.5" /> Invite Pending
                          </span>
                        )
                      ) : (
                        <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          <XCircle class="w-2.5 h-2.5" /> Not in Appwrite
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Role selector + actions row */}
              <div class="px-4 pb-4 flex flex-wrap items-center gap-2">
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
                  class="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-2 focus:outline-none cursor-pointer disabled:opacity-50 flex-1 min-w-0"
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
                    class="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check class="w-3.5 h-3.5" /> Approve
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
                    class="flex items-center gap-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer transition disabled:opacity-50"
                  >
                    <Shield class="w-3.5 h-3.5" />
                    {isExpanded ? 'Close' : 'Permissions'}
                    {isExpanded ? <ChevronUp class="w-3.5 h-3.5" /> : <ChevronDown class="w-3.5 h-3.5" />}
                  </button>
                ) : (
                  <span class="text-[10px] text-slate-500 font-semibold font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200">
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
                  class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-100 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Revoke User Access"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>

              {/* Expanded permissions panel */}
              {isExpanded && p.role === 'Custom' && p.isApproved && (
                <div class="border-t border-slate-200 p-4 bg-slate-50 animate-fade-in">
                  <h4 class="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                    <ShieldCheck class="w-3.5 h-3.5" /> Fine-grained permissions — {p.name}
                  </h4>
                  <div class="space-y-2">
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
                      <div  class="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                        <span class="text-xs font-bold text-slate-700 block mb-2">{mod.label}</span>
                        <div class="flex gap-4">
                          {mod.view ? (
                            <label class="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!(p as any)[mod.view]}
                                onChange={() => toggleUserRight(p, mod.view as any)}
                                disabled={isBackendOrg && !canEditBackend}
                                class="rounded-sm border-slate-300 text-blue-600 w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                              />
                              View
                            </label>
                          ) : (
                            <span class="text-slate-350 font-sans font-bold text-[11px]">View: —</span>
                          )}
                          <label class="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!(p as any)[mod.edit]}
                              onChange={() => toggleUserRight(p, mod.edit as any)}
                              disabled={isBackendOrg && !canEditBackend}
                              class="rounded-sm border-slate-300 text-blue-600 w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                            />
                            Edit
                          </label>
                          <label class="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!(p as any)[mod.del]}
                              onChange={() => toggleUserRight(p, mod.del as any)}
                              disabled={isBackendOrg && !canEditBackend}
                              class="rounded-sm border-slate-300 text-blue-600 w-3.5 h-3.5 cursor-pointer disabled:opacity-50"
                            />
                            Delete
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  {isBackendOrg && (
                    <div class="flex flex-col gap-3 mt-3 pt-3 border-t border-slate-150">
                      {/* Support Category Selection */}
                      <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Support Category Roles</label>
                        <div class="flex flex-wrap gap-4 mt-1 bg-white border border-slate-200 rounded-lg p-2.5">
                          {['Technical', 'Billing', 'General'].map((roleVal) => {
                            const typedRole = roleVal as 'Technical' | 'Billing' | 'General';
                            const currentRoles = Array.isArray(p.supportRole)
                              ? p.supportRole
                              : (typeof p.supportRole === 'string' && p.supportRole !== 'None' && p.supportRole !== ''
                                ? [p.supportRole]
                                : []);
                            const isChecked = currentRoles.includes(typedRole);
                            return (
                              <label  class="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
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
                                  class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                                />
                                {roleVal}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Ticket Transfer Permission */}
                      <div class="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`checkbox-transfer-tickets-mob-${p.id}`}
                          checked={!!p.canTransferTickets}
                          onChange={() => {
                            const updated = { ...p, canTransferTickets: !p.canTransferTickets };
                            onUpdatePermission(updated);
                          }}
                          disabled={isBackendOrg && !canEditBackend}
                          class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                        />
                        <label for={`checkbox-transfer-tickets-mob-${p.id}`} class="text-xs font-bold text-slate-700 cursor-pointer uppercase tracking-tight">
                          Authorize Ticket Transfer Privileges
                        </label>
                      </div>
                    </div>
                  )}
                  <div class="flex justify-end mt-3">
                    <button
                      type="button"
                      onClick={() => setExpandedUserId(null)}
                      class="px-3 py-1.5 bg-slate-900 text-white font-bold text-[10px] rounded-lg hover:bg-slate-800 cursor-pointer transition"
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
      <div class="hidden md:block overflow-x-auto border border-slate-200 rounded-lg">
        <table class="w-full text-left text-sm text-slate-700 whitespace-nowrap">
          <thead class="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 font-bold tracking-wider">
            <tr>
              <th class="px-4 py-3.5 pl-6">Authorized User</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <th class="px-4 py-3.5">System Role</th>
              <th class="px-4 py-3.5 text-center">Permissions Summary</th>
              <th class="px-4 py-3.5 text-right pr-6">Revoke Access</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-sans">
            {permissions.map((p) => {
              const isCurrentUser = p.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim();
              const canEdit = !isBackendOrg || canEditBackend;

              return (
                <>
                  <tr class="hover:bg-slate-50/50 transition">
                    <td class="px-4 py-3.5 pl-6 font-bold text-slate-800 flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold font-sans border border-slate-200 shadow-2xs">
                        {p.name ? p.name.substring(0, 2).toUpperCase() : 'US'}
                      </div>
                      <div>
                        <div class="flex items-center gap-1.5">
                          <span class="font-bold text-slate-800">{p.name}</span>
                          {isCurrentUser && (
                            <span class="bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">You</span>
                          )}
                        </div>
                        <span class="text-[10px] text-slate-400 font-mono block mt-0.5">{p.email}</span>
                        <span class="text-[10px] text-slate-450 font-mono block mt-0.5">Phone: {p.phone || 'Not Set'}</span>

                        {/* Verification override panel */}
                        <div class="flex gap-2 mt-1.5 flex-wrap">
                          <div class="flex items-center gap-1">
                            <span class={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-semibold ${p.isEmailVerified
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
                                  showNotification(`Manually verified email() for ${p.name}.`);
                                }}
                                class="text-[9px] text-blue-600 hover:text-blue-805 font-bold bg-blue-55 hover:bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5 cursor-pointer transition-all"
                              >
                                Verify
                              </button>
                            )}
                          </div>

                          <div class="flex items-center gap-1">
                            <span class={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-semibold ${p.isPhoneVerified
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
                                  showNotification(`Manually verified phone() for ${p.name}.`);
                                }}
                                class="text-[9px] text-blue-600 hover:text-blue-805 font-bold bg-blue-55 hover:bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5 cursor-pointer transition-all"
                              >
                                Verify
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Approval Status + Live Appwrite Membership Status */}
                    <td class="px-4 py-3.5 text-center">
                      <div class="flex flex-col items-center gap-1.5">
                        {/* Local approval status */}
                        {p.isApproved ? (
                          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                            <ShieldCheck class="w-3.5 h-3.5 text-emerald-600" />
                            Approved
                          </span>
                        ) : (
                          <div class="flex items-center justify-center gap-2">
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
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
                              class="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 rounded text-[10px] font-bold cursor-pointer transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Check class="w-3 h-3 text-white" /> Approve
                            </button>
                          </div>
                        )}

                        {/* Live Appwrite Teams sync status */}
                        {(() => {
                          const membership = getAppwriteMembership(p.email);
                          if (teamMembers.length === 0) return null; // Not loaded yet
                          if (!membership) {
                            return (
                              <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                <XCircle class="w-2.5 h-2.5" /> Not in Appwrite Team
                              </span>
                            );
                          }
                          if (membership.confirm) {
                            return (
                              <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                                <CheckCircle class="w-2.5 h-2.5" /> Appwrite ✓
                              </span>
                            );
                          }
                          return (
                            <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-orange-50 text-orange-600 border border-orange-200">
                              <RefreshCw class="w-2.5 h-2.5" /> Invite Pending
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                    <td class="px-4 py-3.5 text-slate-650 font-semibold">
                      <select
                        value={p.role}
                        onChange={(e) => changeUserRole(p, e.target.value as any)}
                        disabled={
                          isCurrentUser ||
                          !p.isApproved ||
                          (isBackendOrg && !canEditBackend) ||
                          (currentUserRole === 'Custom' && (p.role === 'Admin' || p.role === 'SuperAdmin'))
                        }
                        class="bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer disabled:opacity-50"
                      >
                        {p.role === 'SuperAdmin' && <option value="SuperAdmin">Super Admin</option>}
                        <option value="Admin">Administrator</option>
                        <option value="Custom">Custom Rights</option>
                      </select>
                    </td>

                    {/* Expandable permissions config triggers */}
                    <td class="px-4 py-3.5 text-center">
                      {(p.role === 'Admin' || p.role === 'SuperAdmin') ? (
                        <span class="text-[11px] text-slate-500 font-semibold font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
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
                            setExpandedUserId(expandedUserId() === p.id ? null : p.id);
                          }}
                          disabled={!p.isApproved}
                          class={`inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer transition disabled:opacity-50`}
                        >
                          Configure Modules
                          {expandedUserId() === p.id ? <ChevronUp class="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown class="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                      )}
                    </td>

                    {/* Delete / Revoke option */}
                    <td class="px-4 py-3.5 text-right pr-6">
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
                        class="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-650 hover:text-rose-700 rounded border border-rose-100 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Revoke User Access"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Nested Grid of 21 check flags */}
                  {expandedUserId() === p.id && p.role === 'Custom' && p.isApproved && (
                    <tr class="bg-slate-50/50">
                      <td colSpan={5} class="p-4 pl-8 pr-8">
                        <div class="max-w-2xl bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-fade-in space-y-3 text-left">
                          <h4 class="text-xs font-black text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck class="w-4 h-4 text-blue-600" />
                            Fine-grained permissions configuration for {p.name}
                          </h4>
                          <p class="text-[10px] text-slate-500 font-medium">
                            Set distinct view, create/edit, and deletion capabilities for each database register module.
                          </p>
                          <div class="border border-slate-200 rounded-lg overflow-hidden mt-2">
                            <div class="grid grid-cols-4 gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 p-2.5 pl-4 border-b border-slate-250/70">
                              <div>Database Register Module</div>
                              <div class="text-center">View (Read)</div>
                              <div class="text-center">Write/Edit (Create)</div>
                              <div class="text-center">Delete (Remove)</div>
                            </div>
                            <div class="divide-y divide-slate-100 bg-white font-semibold text-slate-700 pl-4 pr-2">
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
                                <div  class="grid grid-cols-4 gap-2 py-2.5 items-center text-xs">
                                  <span class="font-bold text-slate-800">{mod.label}</span>
                                  <div class="text-center">
                                    {mod.view ? (
                                      <input
                                        type="checkbox"
                                        checked={!!(p as any)[mod.view]}
                                        onChange={() => toggleUserRight(p, mod.view as any)}
                                        disabled={isBackendOrg && !canEditBackend}
                                        class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                      />
                                    ) : (
                                      <span class="text-slate-350 font-sans font-bold">—</span>
                                    )}
                                  </div>
                                  <div class="text-center">
                                    <input
                                      type="checkbox"
                                      checked={!!(p as any)[mod.edit]}
                                      onChange={() => toggleUserRight(p, mod.edit as any)}
                                      disabled={isBackendOrg && !canEditBackend}
                                      class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                  <div class="text-center">
                                    <input
                                      type="checkbox"
                                      checked={!!(p as any)[mod.del]}
                                      onChange={() => toggleUserRight(p, mod.del as any)}
                                      disabled={isBackendOrg && !canEditBackend}
                                      class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          {isBackendOrg && (
                            <div class="flex flex-col gap-3 mt-3 pt-3 border-t border-slate-200">
                              {/* Support Category Selection */}
                              <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1">Support Category Roles</label>
                                <div class="flex flex-wrap gap-4 mt-1 bg-white border border-slate-200 rounded-lg p-2.5">
                                  {['Technical', 'Billing', 'General'].map((roleVal) => {
                                    const typedRole = roleVal as 'Technical' | 'Billing' | 'General';
                                    const currentRoles = Array.isArray(p.supportRole)
                                      ? p.supportRole
                                      : (typeof p.supportRole === 'string' && p.supportRole !== 'None' && p.supportRole !== ''
                                        ? [p.supportRole]
                                        : []);
                                    const isChecked = currentRoles.includes(typedRole);
                                    return (
                                      <label  class="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
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
                                          class="rounded-sm border-slate-350 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                                        />
                                        {roleVal}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Ticket Transfer Permission */}
                              <div class="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`checkbox-transfer-tickets-${p.id}`}
                                  checked={!!p.canTransferTickets}
                                  onChange={() => {
                                    const updated = { ...p, canTransferTickets: !p.canTransferTickets };
                                    onUpdatePermission(updated);
                                  }}
                                  disabled={isBackendOrg && !canEditBackend}
                                  class="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                                />
                                <label for={`checkbox-transfer-tickets-${p.id}`} class="text-xs font-bold text-slate-700 cursor-pointer uppercase tracking-tight">
                                  Authorize Ticket Transfer Privileges (Can move tickets between queues)
                                </label>
                              </div>
                            </div>
                          )}
                          <div class="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => setExpandedUserId(null)}
                              class="px-3 py-1 bg-slate-900 text-white font-bold text-[10px] rounded-lg hover:bg-slate-850 cursor-pointer shadow-3xs transition"
                            >
                              Close Permissions Config
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
