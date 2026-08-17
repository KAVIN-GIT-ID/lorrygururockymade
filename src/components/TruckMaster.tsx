import { createSignal, createEffect, createMemo, onMount, mergeProps } from 'solid-js';
import { useTripsContext } from '../context/TripContext';
import { useTrucksContext } from '../context/TruckContext';
import { useDriversContext } from '../context/DriverContext';
import { useExpensesContext } from '../context/ExpenseContext';
import { useOfficesContext } from '../context/OfficeContext';
import { useAccountsContext } from '../context/AccountContext';
import { useTyresContext } from '../context/TyreContext';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../context/AuthContext';

import { Truck, TripEntry, ExpenseEntry, getTripMetrics, OrganizationProfile, Account, Driver, ServiceDonePayload, ServiceType, LoanEntry, Coupon } from '../types';
import { Plus, Edit2, Trash2, Shield, CheckCircle, XCircle, Wrench, Calendar, Settings, X, Loader2, ChevronUp, ChevronDown, FileText, Eye, Landmark, Search, MoreVertical } from 'lucide-solid';
import { calculateDaysLeft as calculateDaysLeftUtil, formatToDisplayDate } from '../lib/dateUtils';
import { formatTruckNumber } from '../lib/formatUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import ServiceDoneModal from './ServiceDoneModal';
import PayEmiModal from './PayEmiModal';
import PhonePePaymentModal from './PhonePePaymentModal';

export const getTruckLoans = (truck: Truck): LoanEntry[] => {
  if (truck.loans && truck.loans.length > 0) {
    return truck.loans;
  }
  const list: LoanEntry[] = [];
  if (truck.loanStartDate || truck.loanEmiAmount || truck.loanTenureMonths) {
    list.push({
      id: 'legacy-loan',
      loanType: 'Chassis Loan',
      loanBankName: truck.loanBankName,
      loanStartDate: truck.loanStartDate,
      loanRegisteredDate: truck.loanRegisteredDate,
      loanTenureMonths: truck.loanTenureMonths,
      loanEmiAmount: truck.loanEmiAmount,
      loanStatus: truck.loanStatus || 'Active',
      loanNotes: truck.loanNotes
    });
  }
  return list;
};

export const calculateSingleLoanStats = (
  loan: {
    id: string;
    loanStartDate?: string;
    loanEmiAmount?: number;
    loanTenureMonths?: number;
    loanRegisteredDate?: string;
    loanBankName?: string;
    loanStatus?: string;
    loanType?: string;
  },
  targetTruckNo: string,
  expenses: ExpenseEntry[]
) => {
  if (!loan.loanStartDate || !loan.loanEmiAmount || !loan.loanTenureMonths) return null;
  
  const emiAmount = loan.loanEmiAmount;
  const tenure = loan.loanTenureMonths;
  const startDateStr = loan.loanStartDate;
  
  // Parse start date
  const parts = startDateStr.split('-');
  const startY = parseInt(parts[0], 10);
  const startM = parseInt(parts[1], 10) - 1;
  const startD = parseInt(parts[2], 10);
  
  // Parse registered date if explicitly set by user (do not default to today or start date)
  const registeredDateStr = loan.loanRegisteredDate || '';
  let regDate: Date | null = null;
  if (registeredDateStr) {
    const regParts = registeredDateStr.split('-');
    if (regParts.length === 3) {
      const regY = parseInt(regParts[0], 10);
      const regM = parseInt(regParts[1], 10) - 1;
      const regD = parseInt(regParts[2], 10);
      regDate = new Date(regY, regM, regD);
      regDate.setHours(0,0,0,0);
    }
  }
  
  const dueDates: string[] = [];
  const today = new Date();
  today.setHours(0,0,0,0);
  
  for (let i = 1; i <= tenure; i++) {
    // calculate due date (the first installment is paid on the loan start date itself)
    const targetMonth = startM + i - 1;
    const targetYear = startY + Math.floor(targetMonth / 12);
    const targetMonthMod = ((targetMonth % 12) + 12) % 12;
    const maxDays = new Date(targetYear, targetMonthMod + 1, 0).getDate();
    const targetDay = Math.min(startD, maxDays);
    
    const yyyy = targetYear;
    const mm = String(targetMonthMod + 1).padStart(2, '0');
    const dd = String(targetDay).padStart(2, '0');
    const dueDateStr = `${yyyy}-${mm}-${dd}`;
    dueDates.push(dueDateStr);
  }
  
  const cleanTargetTruckNo = (targetTruckNo || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const checkIsPaidInExpenses = (dueDateStr: string) => {
    return expenses.some(e => {
      const eCleanNo = (e.truckNo || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (eCleanNo !== cleanTargetTruckNo) return false;
      const isEmiType = e.expenseType === 'Loan EMI' || e.expenseType === 'EMI Payment' || (e.category && e.category.toLowerCase().includes('emi'));
      if (!isEmiType) return false;
      const isSettled = e.status === 'Paid' || e.status === 'Settled';
      if (!isSettled) return false;

      // 1. Direct due date note match
      if (e.notes && e.notes.includes(dueDateStr)) return true;
      // 2. Structured attribute match
      if ((e as any).emiDueDate === dueDateStr) return true;
      // 3. Fallback: Expense date falls in the same YYYY-MM as the due date
      if (e.date && e.date.substring(0, 7) === dueDateStr.substring(0, 7)) {
        return true;
      }
      return false;
    });
  };

  let paidInstallments = 0;
  for (let i = 1; i <= tenure; i++) {
    const dueDateStr = dueDates[i-1];
    const isPaidInExpenses = checkIsPaidInExpenses(dueDateStr);
    const parts = dueDateStr.split('-');
    const dueD = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const isPast = regDate ? (dueD < regDate) : false;
    
    if (isPaidInExpenses || isPast) {
      paidInstallments++;
    }
  }
  
  const totalPaid = paidInstallments * emiAmount;
  const totalRemaining = (tenure - paidInstallments) * emiAmount;
  
  // Next due date: first unpaid
  let nextDueDateStr = 'Fully Settled';
  let isOverdue = false;
  
  for (let i = 1; i <= tenure; i++) {
    const dueDateStr = dueDates[i-1];
    const isPaidInExpenses = checkIsPaidInExpenses(dueDateStr);
    const parts = dueDateStr.split('-');
    const dueD = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const isPast = regDate ? (dueD < regDate) : false;
    const isPaid = isPaidInExpenses || isPast;
    if (!isPaid) {
      nextDueDateStr = dueDateStr;
      isOverdue = dueD <= today;
      break;
    }
  }
  return {
    paidInstallments,
    totalPaid,
    totalRemaining,
    nextDueDateStr,
    isOverdue
  };
};

export const calculateLoanStats = (truck: Truck, expenses: ExpenseEntry[]) => {
  const truckLoans = getTruckLoans(truck);
  if (truckLoans.length === 0) return null;
  return calculateSingleLoanStats(truckLoans[0], truck.truckNo, expenses);
};

interface TruckMasterProps {
  trucks: Truck[];
  trips: TripEntry[];
  expenses: ExpenseEntry[];
  onAddTruck: (truck: Omit<Truck, 'id'>) => void;
  onUpdateTruck: (truck: Truck) => void;
  onDeleteTruck: (id: string) => void;
  confirmAction?: (message: string, onConfirm: () => void, title?: string) => void;
  canViewTrucks?: boolean;
  canEditTrucks?: boolean;
  canDeleteTrucks?: boolean;
  maxTrucksAllowed?: number;
  onAddTruckRequest?: (truck: Omit<Truck, 'id'>) => void;
  organizationId?: string;
  orgProfile?: OrganizationProfile;
  onServiceDone?: (payload: ServiceDonePayload) => void;
  accounts?: Account[];
  drivers?: Driver[];
  onAddExpense?: (expense: Omit<ExpenseEntry, 'id'>) => Promise<void>;
  canEditLoans?: boolean;
  canDeleteLoans?: boolean;
  canEditExpenses?: boolean;
  currentUserEmail?: string;
  currentUserName?: string;
  currentUserPhone?: string;
  onProcessTruckPayment?: (
    truckPayload: Omit<Truck, 'id'>,
    paymentDetails: {
      transactionId: string;
      amount: number;
      duration: string;
      planName: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      paymentDate: string;
      status: string;
    },
    existingTruckId?: string | null
  ) => Promise<void> | void;
  autoOpenAdd?: boolean;
  onAutoOpenCleared?: () => void;
  coupons?: Coupon[] | (() => Coupon[]);
}
export default function TruckMaster(rawProps: TruckMasterProps) {
  const tripsCtx = useTripsContext();
  const trucksCtx = useTrucksContext();
  const driversCtx = useDriversContext();
  const expenseCtx = useExpensesContext();
  const accountCtx = useAccountsContext();
  const permissionCtx = usePermissions();
  const authCtx = useAuth();

  const props = mergeProps(rawProps, {
    get trucks() { return trucksCtx.orgTrucks(); },
    get trips() { return tripsCtx.orgTrips(); },
    get expenses() { return expenseCtx.orgExpenses(); },
    get accounts() { return accountCtx.orgAccounts(); },
    get drivers() { return driversCtx.orgDrivers(); },
    onAddTruck: trucksCtx.addTruck,
    onUpdateTruck: trucksCtx.updateTruck,
    onDeleteTruck: trucksCtx.deleteTruck,
    onAddTruckRequest: trucksCtx.handleAddTruckRequest,
    onProcessTruckPayment: trucksCtx.handleProcessTruckPayment,
    onAddExpense: expenseCtx.addExpense,
    
    get canViewTrucks() { return permissionCtx.currentUserRights().canViewTrucks; },
    get canEditTrucks() { return permissionCtx.currentUserRights().canEditTrucks; },
    get canDeleteTrucks() { return permissionCtx.currentUserRights().canDeleteTrucks; },
    get canEditLoans() { return permissionCtx.currentUserRights().canEditLoans !== false; },
    get canDeleteLoans() { return permissionCtx.currentUserRights().canDeleteLoans !== false; },
    get canEditExpenses() { return permissionCtx.currentUserRights().canEditExpenses !== false; },
    get organizationId() { return permissionCtx.currentUserOrgId(); },
    get currentUserEmail() { return authCtx.currentUser()?.email || ''; },
    get currentUserName() { return authCtx.currentUser()?.name || ''; },
    get currentUserPhone() { return authCtx.currentUser()?.phone || ''; }
  });
  const {
    trips,
    expenses,
    onAddTruck,
    onUpdateTruck,
    onDeleteTruck,
    confirmAction,
    canViewTrucks,
    canEditTrucks,
    canDeleteTrucks,
    maxTrucksAllowed,
    onAddTruckRequest,
    organizationId,
    orgProfile,
    onServiceDone,
    accounts,
    drivers,
    onAddExpense,
    canEditLoans,
    canDeleteLoans,
    canEditExpenses,
    currentUserEmail,
    currentUserName,
    currentUserPhone,
    onProcessTruckPayment,
    autoOpenAdd,
    onAutoOpenCleared
  } = props;


  const [isEditing, setIsEditing] = createSignal<string | null>(null);
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [activeSpeedDialId, setActiveSpeedDialId] = createSignal<string | null>(null);

  onMount(() => {
    if (autoOpenAdd) {
      if (showAddForm()) resetForm();
      setShowAddForm(true);
      if (onAutoOpenCleared) {
        onAutoOpenCleared();
      }
    }
  });
  const [viewingTruckId, setViewingTruckId] = createSignal<string | null>(null);
  const [expandedTruckId, setExpandedTruckId] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  
  // PhonePe Payment States
  const [showPhonePeModal, setShowPhonePeModal] = createSignal(false);
  const [phonePeTruckNo, setPhonePeTruckNo] = createSignal('');
  const [phonePePayload, setPhonePePayload] = createSignal<Omit<Truck, 'id'> | null>(null);
  const [phonePeEditingId, setPhonePeEditingId] = createSignal<string | null>(null);
  const [initialTxnId, setInitialTxnId] = createSignal<string | undefined>(undefined);

  createEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const txnId = params.get('txnId');
    const queryTruckNo = params.get('truckNo');
    if (txnId && queryTruckNo) {
      const tempPayloadStr = sessionStorage.getItem('ttt_temp_payment_payload');
      const tempPayloadObj = tempPayloadStr ? JSON.parse(tempPayloadStr) : null;
      const existingTruckId = sessionStorage.getItem('ttt_temp_payment_truck_id') || null;

      if (tempPayloadObj) {
        setPhonePePayload(tempPayloadObj);
        setPhonePeTruckNo(queryTruckNo);
        setPhonePeEditingId(existingTruckId);
        setInitialTxnId(txnId);
        setShowPhonePeModal(true);
      }
    }
  });

  const [statusFilter, setStatusFilter] = createSignal<'All' | 'Active' | 'Inactive' | 'Admin Disabled' | 'Sold'>('All');
  const [serviceDoneTarget, setServiceDoneTarget] = createSignal<{ truckId: string; truckNo: string; serviceType: ServiceType; currentKM: number; intervalKM: number } | null>(null);
  const [payEmiTarget, setPayEmiTarget] = createSignal<{ truckNo: string; emiAmount: number; bankName: string; dueDateStr: string; loanType?: string } | null>(null);
  const [editingLoanTarget, setEditingLoanTarget] = createSignal<{ truck: Truck; loan: LoanEntry } | null>(null);

  // Multiple loan states for edit/add form
  const [loans, setLoans] = createSignal<LoanEntry[]>([]);
  const [tempLoanType, setTempLoanType] = createSignal('Chassis Loan');
  const [tempCustomLoanType, setTempCustomLoanType] = createSignal('');
  const [tempLoanBank, setTempLoanBank] = createSignal('');
  const [tempLoanStart, setTempLoanStart] = createSignal('');
  const [tempLoanTenure, setTempLoanTenure] = createSignal<number | ''>('');
  const [tempLoanEmi, setTempLoanEmi] = createSignal<number | ''>('');
  const [tempLoanRegisteredDate, setTempLoanRegisteredDate] = createSignal('');
  const [tempLoanStatus, setTempLoanStatus] = createSignal<'Active' | 'Closed'>('Active');
  const [tempLoanNotes, setTempLoanNotes] = createSignal('');

  const handleAddLoanToForm = () => {
    if (!tempLoanStart() || !tempLoanEmi() || !tempLoanTenure()) {
      alert("Please fill in Loan Start Date, Tenure, and EMI Amount.");
      return;
    }
    const finalType = tempLoanType() === 'Other' ? (tempCustomLoanType().trim() || 'Other Loan') : tempLoanType();
    const newLoan: LoanEntry = {
      id: 'loan_' + Date.now(),
      loanType: finalType,
      loanBankName: tempLoanBank().trim() || undefined,
      loanStartDate: tempLoanStart(),
      loanRegisteredDate: tempLoanRegisteredDate() || tempLoanStart(),
      loanTenureMonths: Number(tempLoanTenure()),
      loanEmiAmount: Number(tempLoanEmi()),
      loanStatus: tempLoanStatus(),
      loanNotes: tempLoanNotes().trim() || undefined
    };
    setLoans([...loans(), newLoan]);

    // Clear builder inputs
    setTempLoanBank('');
    setTempLoanStart('');
    setTempCustomLoanType('');
    setTempLoanTenure('');
    setTempLoanEmi('');
    setTempLoanRegisteredDate('');
    setTempLoanStatus('Active');
    setTempLoanNotes('');
  };

  let scrollContainerRef: HTMLDivElement | undefined;

  onMount(() => {
    const container = scrollContainerRef;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        const canScrollLeft = container.scrollLeft > 0;
        const canScrollRight = container.scrollLeft < (container.scrollWidth - container.clientWidth - 1);
        if (container.scrollWidth > container.clientWidth) {
          if ((e.deltaY < 0 && canScrollLeft) || (e.deltaY > 0 && canScrollRight)) {
            e.preventDefault();
            container.scrollLeft += e.deltaY * 1.5;
          }
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  });
  const [truckNo, setTruckNo] = createSignal('');
  const [ownerName, setOwnerName] = createSignal('');
  const [status, setStatus] = createSignal<'Active' | 'Inactive' | 'Admin Disabled' | 'Sold'>('Active');

  // General Specifications
  const [make, setMake] = createSignal('');
  const [model, setModel] = createSignal('');
  const [type, setType] = createSignal('');

  // Loan Specifications
  const [loanStartDate, setLoanStartDate] = createSignal('');
  const [loanRegisteredDate, setLoanRegisteredDate] = createSignal('');
  const [loanTenureMonths, setLoanTenureMonths] = createSignal<number | ''>('');
  const [loanEmiAmount, setLoanEmiAmount] = createSignal<number | ''>('');
  const [loanBankName, setLoanBankName] = createSignal('');
  const [loanStatus, setLoanStatus] = createSignal<'Active' | 'Closed'>('Active');
  const [loanNotes, setLoanNotes] = createSignal('');
  
  // Tax & Compliance Dates
  const [insuranceDate, setInsuranceDate] = createSignal('');
  const [fcDate, setFcDate] = createSignal('');
  const [qTaxDate, setQTaxDate] = createSignal('');
  const [greenTaxDate, setGreenTaxDate] = createSignal('');
  const [npTaxDate, setNpTaxDate] = createSignal('');
  const [fiveYearPermitDate, setFiveYearPermitDate] = createSignal('');
  
  // Milestones & Readings
  const [currentKM, setCurrentKM] = createSignal<number | ''>('');
  const [pinpushKM, setPinpushKM] = createSignal<number | ''>('');
  const [wheelGreaseKM, setWheelGreaseKM] = createSignal<number | ''>('');
  const [alignmentNextDate, setAlignmentNextDate] = createSignal('');
  
  // Oil Mileages
  const [engineOilKM, setEngineOilKM] = createSignal<number | ''>('');
  const [crownOilKM, setCrownOilKM] = createSignal<number | ''>('');
  const [gearBoxOilKM, setGearBoxOilKM] = createSignal<number | ''>('');
  const [radiatorKM, setRadiatorKM] = createSignal<number | ''>('');

  // Custom Service Intervals (per vehicle)
  const [engineOilIntervalKM, setEngineOilIntervalKM] = createSignal<number | ''>('');
  const [crownOilIntervalKM, setCrownOilIntervalKM] = createSignal<number | ''>('');
  const [gearBoxOilIntervalKM, setGearBoxOilIntervalKM] = createSignal<number | ''>('');
  const [radiatorIntervalKM, setRadiatorIntervalKM] = createSignal<number | ''>('');
  const [pinpushIntervalKM, setPinpushIntervalKM] = createSignal<number | ''>('');
  const [wheelGreaseIntervalKM, setWheelGreaseIntervalKM] = createSignal<number | ''>('');

  const [rcFileId, setRcFileId] = createSignal('');
  const [insuranceFileId, setInsuranceFileId] = createSignal('');
  const [rcUploading, setRcUploading] = createSignal(false);
  const [insuranceUploading, setInsuranceUploading] = createSignal(false);
  const [rcFile, setRcFile] = createSignal<File | null>(null);
  const [insuranceFile, setInsuranceFile] = createSignal<File | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const handleRcFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!truckNo().trim()) {
      alert("Please enter the Vehicle Number first before uploading documents so we can name the file properly.");
      e.target.value = '';
      return;
    }
    setRcFile(file);
  };

  const handleInsuranceFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!truckNo().trim()) {
      alert("Please enter the Vehicle Number first before uploading documents so we can name the file properly.");
      e.target.value = '';
      return;
    }
    setInsuranceFile(file);
  };

  const resetForm = () => {
    setTruckNo('');
    setOwnerName('');
    setStatus('Active');
    setMake('');
    setModel('');
    setType('');
    setInsuranceDate('');
    setFcDate('');
    setPinpushKM('');
    setWheelGreaseKM('');
    setAlignmentNextDate('');
    setQTaxDate('');
    setGreenTaxDate('');
    setNpTaxDate('');
    setFiveYearPermitDate('');
    setCurrentKM('');
    setEngineOilKM('');
    setCrownOilKM('');
    setGearBoxOilKM('');
    setRadiatorKM('');
    setEngineOilIntervalKM('');
    setCrownOilIntervalKM('');
    setGearBoxOilIntervalKM('');
    setRadiatorIntervalKM('');
    setPinpushIntervalKM('');
    setWheelGreaseIntervalKM('');
    setRcFileId('');
    setInsuranceFileId('');
    setRcFile(null);
    setInsuranceFile(null);
    setRcUploading(false);
    setInsuranceUploading(false);
    setIsSubmitting(false);
    setIsEditing(null);
    
    // Clear Loan details
    setLoanStartDate('');
    setLoanRegisteredDate('');
    setLoanTenureMonths('');
    setLoanEmiAmount('');
    setLoanBankName('');
    setLoanStatus('Active');
    setLoanNotes('');
    setLoans([]);
    setTempLoanType('Chassis Loan');
    setTempCustomLoanType('');
    setTempLoanBank('');
    setTempLoanStart('');
    setTempLoanTenure('');
    setTempLoanEmi('');
    setTempLoanRegisteredDate('');
    setTempLoanStatus('Active');
    setTempLoanNotes('');
    setShowAddForm(false);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const formattedInputNo = formatTruckNumber(truckNo()).toUpperCase().trim();
    const isDuplicate = (props.trucks || []).some(t => 
      t.id !== isEditing() && 
      t.truckNo.toUpperCase().trim() === formattedInputNo &&
      t.isApproved !== false
    );
    if (isDuplicate) {
      alert("Truck Number already registered in active datasheets.");
      return;
    }

    setIsSubmitting(true);
    let uploadedRcId = rcFileId();
    let uploadedInsuranceId = insuranceFileId();

    try {
      if (rcFile()) {
        setRcUploading(true);
        const sanitizedOrgId = (organizationId || 'default').replace(/[^a-zA-Z0-9-]/g, '_');
        const sanitizedTruckNo = truckNo().trim().replace(/[^a-zA-Z0-9-]/g, '_');
        const customName = `${sanitizedOrgId}_RC_${sanitizedTruckNo}`;
        uploadedRcId = await appwrite.uploadFile(rcFile(), customName, organizationId);
        setRcFileId(uploadedRcId);
      }
    } catch (err) {
      alert("Failed to upload RC document. Please check your network connection and Appwrite configuration.");
      setIsSubmitting(false);
      setRcUploading(false);
      return;
    } finally {
      setRcUploading(false);
    }

    try {
      if (insuranceFile()) {
        setInsuranceUploading(true);
        const sanitizedOrgId = (organizationId || 'default').replace(/[^a-zA-Z0-9-]/g, '_');
        const sanitizedTruckNo = truckNo().trim().replace(/[^a-zA-Z0-9-]/g, '_');
        const customName = `${sanitizedOrgId}_INSURANCE_${sanitizedTruckNo}`;
        uploadedInsuranceId = await appwrite.uploadFile(insuranceFile(), customName, organizationId);
        setInsuranceFileId(uploadedInsuranceId);
      }
    } catch (err) {
      alert("Failed to upload Insurance document. Please check your network connection and Appwrite configuration.");
      setIsSubmitting(false);
      setInsuranceUploading(false);
      return;
    } finally {
      setInsuranceUploading(false);
    }

    const approvedCountVal = (props.trucks || []).filter(t => t.isApproved !== false).length;
    const limitReachedVal = approvedCountVal >= maxTrucksAllowed;

    let finalLoans = [...loans()];
    if (tempLoanStart() && tempLoanEmi() && tempLoanTenure()) {
      const finalType = tempLoanType() === 'Other' ? (tempCustomLoanType().trim() || 'Other Loan') : tempLoanType();
      finalLoans.push({
        id: 'loan_' + Date.now(),
        loanType: finalType,
        loanBankName: tempLoanBank().trim() || undefined,
        loanStartDate: tempLoanStart(),
        loanRegisteredDate: tempLoanRegisteredDate() || tempLoanStart(),
        loanTenureMonths: Number(tempLoanTenure()),
        loanEmiAmount: Number(tempLoanEmi()),
        loanStatus: tempLoanStatus(),
        loanNotes: tempLoanNotes().trim() || undefined
      });
    }

    const primaryLoan = finalLoans[0];
    const legacyLoanFields = primaryLoan ? {
      loanStartDate: primaryLoan.loanStartDate || undefined,
      loanRegisteredDate: primaryLoan.loanRegisteredDate || primaryLoan.loanStartDate || undefined,
      loanTenureMonths: primaryLoan.loanTenureMonths || undefined,
      loanEmiAmount: primaryLoan.loanEmiAmount || undefined,
      loanBankName: primaryLoan.loanBankName || undefined,
      loanStatus: primaryLoan.loanStatus || undefined,
      loanNotes: primaryLoan.loanNotes || undefined,
    } : {
      loanStartDate: undefined,
      loanRegisteredDate: undefined,
      loanTenureMonths: undefined,
      loanEmiAmount: undefined,
      loanBankName: undefined,
      loanStatus: undefined,
      loanNotes: undefined,
    };

    const truckPayload = {
      truckNo: formatTruckNumber(truckNo()),
      ownerName: ownerName() || undefined,
      status: limitReachedVal && !isEditing() ? 'Inactive' : status(),
      make: make() || undefined,
      model: model() || undefined,
      type: type() || undefined,
      insuranceDate: insuranceDate() || undefined,
      fcDate: fcDate() || undefined,
      pinpushKM: pinpushKM() !== '' ? Number(pinpushKM()) : undefined,
      wheelGreaseKM: wheelGreaseKM() !== '' ? Number(wheelGreaseKM()) : undefined,
      alignmentNextDate: alignmentNextDate() || undefined,
      qTaxDate: qTaxDate() || undefined,
      greenTaxDate: greenTaxDate() || undefined,
      npTaxDate: npTaxDate() || undefined,
      fiveYearPermitDate: fiveYearPermitDate() || undefined,
      currentKM: currentKM() !== '' ? Number(currentKM()) : undefined,
      engineOilKM: engineOilKM() !== '' ? Number(engineOilKM()) : undefined,
      crownOilKM: crownOilKM() !== '' ? Number(crownOilKM()) : undefined,
      gearBoxOilKM: gearBoxOilKM() !== '' ? Number(gearBoxOilKM()) : undefined,
      radiatorKM: radiatorKM() !== '' ? Number(radiatorKM()) : undefined,
      engineOilIntervalKM: engineOilIntervalKM() !== '' ? Number(engineOilIntervalKM()) : undefined,
      crownOilIntervalKM: crownOilIntervalKM() !== '' ? Number(crownOilIntervalKM()) : undefined,
      gearBoxOilIntervalKM: gearBoxOilIntervalKM() !== '' ? Number(gearBoxOilIntervalKM()) : undefined,
      radiatorIntervalKM: radiatorIntervalKM() !== '' ? Number(radiatorIntervalKM()) : undefined,
      pinpushIntervalKM: pinpushIntervalKM() !== '' ? Number(pinpushIntervalKM()) : undefined,
      wheelGreaseIntervalKM: wheelGreaseIntervalKM() !== '' ? Number(wheelGreaseIntervalKM()) : undefined,
      rcFileId: uploadedRcId || undefined,
      insuranceFileId: uploadedInsuranceId || undefined,
      ...legacyLoanFields,
      loans: finalLoans
    };

    if (isEditing()) {
      const editingTruckObj = (props.trucks || []).find(t => t.id === isEditing());
      const todayStr = new Date().toISOString().split('T')[0];
      const isExpired = editingTruckObj && editingTruckObj.registrationExpiryDate && editingTruckObj.registrationExpiryDate < todayStr;
      const isRejected = editingTruckObj && editingTruckObj.requestStatus === 'Rejected';
      const isUnapproved = editingTruckObj && editingTruckObj.isApproved === false;

      if ((isExpired || isRejected || isUnapproved) && onProcessTruckPayment) {
        sessionStorage.setItem('ttt_temp_payment_payload', JSON.stringify(truckPayload));
        sessionStorage.setItem('ttt_temp_payment_truck_id', isEditing() || '');
        setPhonePePayload(truckPayload);
        setPhonePeTruckNo(truckPayload.truckNo);
        setPhonePeEditingId(isEditing());
        setShowPhonePeModal(true);
        setIsSubmitting(false);
        return;
      }

      if (editingTruckObj && editingTruckObj.requestStatus === 'Rejected' && onAddTruckRequest) {
        onAddTruckRequest(truckPayload);
      } else {
        onUpdateTruck({
          id: isEditing(),
          ...truckPayload
        });
      }
    } else {
      const newTruckId = 'tr_' + Date.now();
      
      if (limitReachedVal) {
        // Save temp payment details in localStorage
        sessionStorage.setItem('ttt_temp_payment_payload', JSON.stringify(truckPayload));
        sessionStorage.setItem('ttt_temp_payment_truck_id', newTruckId);

        // Save truck as rejected (unsubscribed/inactive) in list first
        if (onAddTruckRequest) {
          onAddTruckRequest({
            ...truckPayload,
            id: newTruckId,
            requestStatus: 'Rejected' as const
          } as any);
        }

        // Launch PhonePe Checkout Modal
        if (onProcessTruckPayment) {
          setPhonePePayload(truckPayload);
          setPhonePeTruckNo(truckPayload.truckNo);
          setPhonePeEditingId(newTruckId);
          setShowPhonePeModal(true);
          setIsSubmitting(false);
          return;
        }

        if (onAddTruckRequest) {
          onAddTruckRequest(truckPayload);
        }
      } else {
        onAddTruck(truckPayload);
      }
    }
    resetForm();
    setShowAddForm(false);
  };

  const startEdit = (truck: Truck) => {
    setIsEditing(truck.id);
    setTruckNo(formatTruckNumber(truck.truckNo));
    setOwnerName(truck.ownerName || '');
    setStatus(truck.status);
    setMake(truck.make || '');
    setModel(truck.model || '');
    setType(truck.type || '');
    setInsuranceDate(truck.insuranceDate || '');
    setFcDate(truck.fcDate || '');
    setPinpushKM(truck.pinpushKM !== undefined ? truck.pinpushKM : '');
    setWheelGreaseKM(truck.wheelGreaseKM !== undefined ? truck.wheelGreaseKM : '');
    setAlignmentNextDate(truck.alignmentNextDate || '');
    setQTaxDate(truck.qTaxDate || '');
    setGreenTaxDate(truck.greenTaxDate || '');
    setNpTaxDate(truck.npTaxDate || '');
    setFiveYearPermitDate(truck.fiveYearPermitDate || '');
    setCurrentKM(truck.currentKM !== undefined ? truck.currentKM : '');
    setEngineOilKM(truck.engineOilKM !== undefined ? truck.engineOilKM : '');
    setCrownOilKM(truck.crownOilKM !== undefined ? truck.crownOilKM : '');
    setGearBoxOilKM(truck.gearBoxOilKM !== undefined ? truck.gearBoxOilKM : '');
    setRadiatorKM(truck.radiatorKM !== undefined ? truck.radiatorKM : '');
    setEngineOilIntervalKM(truck.engineOilIntervalKM !== undefined && truck.engineOilIntervalKM !== null ? truck.engineOilIntervalKM : '');
    setCrownOilIntervalKM(truck.crownOilIntervalKM !== undefined && truck.crownOilIntervalKM !== null ? truck.crownOilIntervalKM : '');
    setGearBoxOilIntervalKM(truck.gearBoxOilIntervalKM !== undefined && truck.gearBoxOilIntervalKM !== null ? truck.gearBoxOilIntervalKM : '');
    setRadiatorIntervalKM(truck.radiatorIntervalKM !== undefined && truck.radiatorIntervalKM !== null ? truck.radiatorIntervalKM : '');
    setPinpushIntervalKM(truck.pinpushIntervalKM !== undefined && truck.pinpushIntervalKM !== null ? truck.pinpushIntervalKM : '');
    setWheelGreaseIntervalKM(truck.wheelGreaseIntervalKM !== undefined && truck.wheelGreaseIntervalKM !== null ? truck.wheelGreaseIntervalKM : '');
    setRcFileId(truck.rcFileId || '');
    setInsuranceFileId(truck.insuranceFileId || '');
    setRcFile(null);
    setInsuranceFile(null);
    setShowAddForm(true);

    // Set Loan details
    setLoanStartDate(truck.loanStartDate || '');
    setLoanRegisteredDate(truck.loanRegisteredDate || '');
    setLoanTenureMonths(truck.loanTenureMonths !== undefined ? truck.loanTenureMonths : '');
    setLoanEmiAmount(truck.loanEmiAmount !== undefined ? truck.loanEmiAmount : '');
    setLoanBankName(truck.loanBankName || '');
    setLoanStatus(truck.loanStatus || 'Active');
    setLoanNotes(truck.loanNotes || '');

    if (truck.loans && truck.loans.length > 0) {
      setLoans(truck.loans);
    } else if (truck.loanStartDate || truck.loanEmiAmount || truck.loanTenureMonths) {
      setLoans([{
        id: 'legacy-loan',
        loanType: 'Chassis Loan',
        loanBankName: truck.loanBankName || '',
        loanStartDate: truck.loanStartDate || '',
        loanRegisteredDate: truck.loanRegisteredDate || truck.loanStartDate || '',
        loanTenureMonths: truck.loanTenureMonths !== undefined ? truck.loanTenureMonths : 0,
        loanEmiAmount: truck.loanEmiAmount !== undefined ? truck.loanEmiAmount : 0,
        loanStatus: truck.loanStatus || 'Active',
        loanNotes: truck.loanNotes || '',
      }]);
    } else {
      setLoans([]);
    }
  };

  // Days left calculation relative to standard anchor date
  const calculateDaysLeft = (dateStr?: string) => {
    return calculateDaysLeftUtil(dateStr, new Date());
  };

  const getExpiryCellProps = (dateStr: string | undefined, days: number | null, warningThreshold: number = 30) => {
    if (!dateStr) {
      return {
        className: "px-2.5 py-3 text-center font-mono text-slate-300",
        title: "No compliance date recorded.",
        displayText: "—"
      };
    }
    if (days === null) {
      return {
        className: "px-2.5 py-3 text-center font-mono font-bold text-slate-500",
        title: "Invalid custom date format.",
        displayText: dateStr
      };
    }
    const displayVal = formatToDisplayDate(dateStr);
    if (days <= 0) {
      return {
        className: "px-2.5 py-3 text-center font-mono font-bold bg-rose-50 text-rose-700 border border-rose-100 uppercase cursor-help transition hover:bg-rose-100/70",
        title: `CRITICAL EXPIRED: Expiry date was ${displayVal} (${Math.abs(days)} days ago). ACTION REQUIRED.`,
        displayText: displayVal
      };
    }
    if (days <= warningThreshold) {
      return {
        className: "px-2.5 py-3 text-center font-mono font-bold bg-amber-50 text-amber-800 border border-amber-100 cursor-help transition hover:bg-amber-100/75",
        title: `WARNING NEAR EXPIRY: Respective compliance expiry date is ${displayVal} (${days} days left).`,
        displayText: displayVal
      };
    }
    return {
      className: "px-2.5 py-3 text-center font-mono font-medium text-slate-705 cursor-help transition hover:bg-slate-50",
      title: `ACTIVE AND REGISTERED: Compliance date is ${displayVal} (${days} days left).`,
      displayText: displayVal
    };
  };

  const renderKMLeftBadge = (targetKM?: number, currKM?: number, interval?: number) => {
    if (targetKM === undefined || currKM === undefined) return <span class="text-slate-300 italic font-mono">&mdash;</span>;
    const diff = targetKM - currKM;
    const activeInterval = interval || 15000;
    const lastChanged = targetKM - activeInterval;
    const travelled = currKM - lastChanged;
    const titleText = `Target Milestone: ${targetKM.toLocaleString()} KM\nActive Interval: ${activeInterval.toLocaleString()} KM\nLast Service Odo: ${lastChanged.toLocaleString()} KM\nDistance Travelled: ${travelled.toLocaleString()} KM`;

    if (diff <= 0) {
      return (
        <span class="flex flex-col text-right font-mono pr-1 animate-pulse" title={titleText}>
          <span class="font-bold text-red-600 text-[11px]">{targetKM.toLocaleString()}</span>
          <span class="text-[9px] font-extrabold text-red-650 tracking-tight leading-none uppercase text-red-600">Due ({Math.abs(diff).toLocaleString()})</span>
        </span>
      );
    } else {
      const isNearDue = diff <= 1000;
      return (
        <span class="flex flex-col text-right font-mono pr-1" title={titleText}>
          <span class={`font-bold text-[11px] ${isNearDue ? 'text-amber-600' : 'text-slate-800'}`}>{targetKM.toLocaleString()}</span>
          <span class={`text-[9px] font-semibold tracking-tight leading-none uppercase ${isNearDue ? 'text-amber-600 font-bold' : 'text-slate-450'}`}>
            ({diff.toLocaleString()} left)
          </span>
        </span>
      );
    }
  };

  const activeEngineOilInterval = createMemo(() => Number(engineOilIntervalKM()) || orgProfile?.engineOilIntervalKM || 15000);
  const activeCrownOilInterval = createMemo(() => Number(crownOilIntervalKM()) || orgProfile?.crownOilIntervalKM || 40000);
  const activeGearBoxOilInterval = createMemo(() => Number(gearBoxOilIntervalKM()) || orgProfile?.gearBoxOilIntervalKM || 40000);
  const activeRadiatorInterval = createMemo(() => Number(radiatorIntervalKM()) || orgProfile?.radiatorIntervalKM || 20000);
  const activePinpushInterval = createMemo(() => Number(pinpushIntervalKM()) || orgProfile?.pinpushIntervalKM || 5000);
  const activeWheelGreaseInterval = createMemo(() => Number(wheelGreaseIntervalKM()) || orgProfile?.wheelGreaseIntervalKM || 5000);

  // Helper to open the Service Done modal for a given truck and service
  const openServiceDone = (truck: Truck, serviceType: ServiceType, targetKM: number | undefined, intervalKM: number) => {
    if (!onServiceDone) return;
    setServiceDoneTarget({
      truckId: truck.id,
      truckNo: truck.truckNo,
      serviceType,
      currentKM: truck.currentKM || 0,
      intervalKM,
    });
  };

  const renderMaintenanceProgressBar = (
    label: string,
    targetKM?: number,
    currentKM?: number,
    intervalKM?: number,
    defaultInterval: number = 15000
  ) => {
    if (!targetKM) {
      return (
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span class="text-slate-700">{label}</span>
            <span class="font-mono text-slate-400">Not mapped</span>
          </div>
          <div class="text-[10px] text-slate-400 italic">Odometer milestone is not registered in specifications panel.</div>
        </div>
      );
    }

    const current = currentKM || 0;
    const interval = intervalKM || defaultInterval;
    const lastChanged = targetKM - interval;
    const travelled = current - lastChanged;
    const remaining = targetKM - current;
    
    // progress = travelled / interval
    let progressPercent = 0;
    if (interval > 0) {
      progressPercent = Math.max(0, Math.min(100, (travelled / interval) * 100));
    }

    let barColor = 'bg-emerald-500';
    if (remaining <= 0) {
      barColor = 'bg-rose-500';
    } else if (remaining <= 1000) {
      barColor = 'bg-amber-500';
    }

    return (
      <div>
        <div class="flex justify-between text-xs font-semibold mb-1">
          <span class="text-slate-700 font-sans font-semibold">{label}</span>
          <span class="font-mono text-slate-500">
            {current.toLocaleString()}/{targetKM.toLocaleString()} KM
          </span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2 relative overflow-hidden" title={`Last Service: ${lastChanged.toLocaleString()} KM\nInterval: ${interval.toLocaleString()} KM\nTravelled: ${travelled.toLocaleString()} KM\nRemaining: ${remaining.toLocaleString()} KM`}>
          <div 
            class={`h-2 rounded-full ${barColor} transition-all duration-300`} 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div class="flex justify-between text-[9px] text-slate-405 mt-1 font-sans">
          <span>Last Service: {lastChanged.toLocaleString()} KM</span>
          {remaining <= 0 ? (
            <span class="text-rose-600 font-bold">Overdue by {Math.abs(remaining).toLocaleString()} KM</span>
          ) : (
            <span class={remaining <= 1000 ? 'text-amber-600 font-bold' : ''}>
              {remaining.toLocaleString()} KM left
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderComplianceRow = (label: string, dateStr: string | undefined, days: number | null, fileId: string | undefined, warningThreshold: number = 30) => {
    if (!dateStr) return (
      <div class="flex justify-between items-center py-1">
        <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
        <span class="text-xs text-slate-300 dark:text-slate-600">—</span>
      </div>
    );

    const formattedDate = formatToDisplayDate(dateStr);
    let badgeClass = "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30";
    let statusText = days !== null ? `(${days}d left)` : '';
    if (days !== null) {
      if (days <= 0) {
        badgeClass = "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 font-bold uppercase";
        statusText = "(EXPIRED)";
      } else if (days <= warningThreshold) {
        badgeClass = "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 font-bold";
      }
    }

    return (
      <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/30 last:border-0 text-xs">
        <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
        <div class="flex items-center gap-1.5">
          <span class={`text-[10px] px-2 py-0.5 rounded-full font-semibold font-mono ${badgeClass}`}>{formattedDate}</span>
          {statusText && (
            <span class={`text-[9px] font-bold font-mono ${days !== null && days <= 0 ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-slate-400 dark:text-slate-500'}`}>{statusText}</span>
          )}
          {fileId && (
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                try {
                  const url = await appwrite.getSecureFileUrl(fileId);
                  window.open(url, '_blank');
                } catch (err) {
                  alert("Failed to load secure document.");
                }
              }}
              class="p-1 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 rounded-lg hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
              title="View secure document attachment"
            >
              <FileText class="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderLubeProgress = (targetKM: number | undefined, currKM: number, intervalKM: number, label: string) => {
    if (!targetKM) return (
      <div class="flex justify-between items-center py-1 text-xs">
        <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
        <span class="text-xs text-slate-300 dark:text-slate-650">—</span>
      </div>
    );

    const remaining = targetKM - currKM;
    const used = Math.max(0, intervalKM - remaining);
    const percentage = Math.min(100, Math.max(0, (used / intervalKM) * 100));

    let barColor = 'bg-blue-600';
    let textColor = 'text-slate-700 dark:text-slate-300';
    if (remaining <= 0) {
      barColor = 'bg-rose-600 animate-pulse';
      textColor = 'text-rose-600 dark:text-rose-400 font-extrabold';
    } else if (remaining <= 1000) {
      barColor = 'bg-amber-500';
      textColor = 'text-amber-600 dark:text-amber-400 font-bold';
    }

    return (
      <div class="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40 space-y-1.5">
        <div class="flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          <span>{label}</span>
          <span class={textColor}>{remaining <= 0 ? 'Overdue' : `${remaining.toLocaleString()} KM left`}</span>
        </div>
        <div class="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div class={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${percentage}%` }}></div>
        </div>
        <div class="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-semibold font-mono">
          <span>{currentKM().toLocaleString()} KM</span>
          <span>{targetKM.toLocaleString()} KM</span>
        </div>
      </div>
    );
  };

  const approvedCount = createMemo(() => (props.trucks || []).filter(t => t.isApproved !== false).length);
  const limitReached = createMemo(() => approvedCount() >= (props.maxTrucksAllowed || 9999));

  const filteredTrucks = createMemo(() => (props.trucks || []).filter(truck => {
    const matchesSearch = (truck?.truckNo || '').toLowerCase().includes(searchQuery().toLowerCase().trim());
    const matchesStatus = statusFilter() === 'All' || !truck?.status || truck?.status === statusFilter();
    return matchesSearch && matchesStatus;
  }));

  const allCount = createMemo(() => (props.trucks || []).length);
  const activeCount = createMemo(() => (props.trucks || []).filter(t => t.status === 'Active').length);
  const inactiveCount = createMemo(() => (props.trucks || []).filter(t => t.status === 'Inactive').length);
  const adminDisabledCount = createMemo(() => (props.trucks || []).filter(t => t.status === 'Admin Disabled').length);
  const soldCount = createMemo(() => (props.trucks || []).filter(t => t.status === 'Sold').length);

  return (
    <div id="truck-master-panel" class="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs animate-fade-in space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <span>Truck Datasheet & Compliance Ledger</span>
            <span class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full text-[10px]">
              Registered: {approvedCount()} / Limit: {maxTrucksAllowed}
            </span>
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">Maintain complete mechanical, oil milestone readings, green taxes, fitness certifications and active compliance logs.</p>
        </div>
        {canEditTrucks && (
          <button
            id="btn-add-truck"
            onClick={() => {
              if (showAddForm()) resetForm();
              setShowAddForm(!showAddForm());
            }}
            class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-150 shadow-sm text-xs cursor-pointer"
          >
            {showAddForm() ? 'Close Specification Panel' : (
              <>
                <Plus class="w-3.5 h-3.5" /> {limitReached() ? 'Subscribe & Add Truck' : 'Add/Edit Truck Specs'}
              </>
            )}
          </button>
        )}
      </div>

      {showAddForm() && (
        <div class="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 backdrop-blur-xs p-4 overflow-y-auto py-8 animate-fade-in" id="truck-form-backdrop">
          <form id="truck-form" onSubmit={handleSubmit} class="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto text-left my-auto">
            <div class="flex justify-between items-center border-b border-slate-200 dark:border-slate-850 pb-3">
              <div class="flex items-center gap-2">
                <Settings class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 class="text-sm font-bold text-slate-800 dark:text-white tracking-wide">
                  {isEditing() ? 'Modify Fleet Information' : limitReached() ? 'Subscribe & Add Truck' : 'Register Vehicle & Technical Specs'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={resetForm}
                class="p-1.5 hover:bg-slate-105 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 rounded-xl transition cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            {limitReached() && !isEditing() && (
              <div class="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-800 dark:text-amber-400 text-xs flex gap-2">
                <Shield class="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="font-bold">Truck Registration Limit Reached ({approvedCount()} / {maxTrucksAllowed} Free Allowed)</p>
                  <p class="mt-0.5 text-[11px]">Saving this truck will direct you to the PhonePe checkout page to complete the subscription. Once payment is successful, the truck will be automatically approved and activated.</p>
                </div>
              </div>
            )}

            {/* SECTION 1: Core Mechanics */}
            <div>
              <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">1. Core Vehicle Specs</span>
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label for="input-truck-no" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Vehicle No <span class="text-red-500">*</span></label>
                  <input
                    id="input-truck-no"
                    type="text"
                    placeholder="e.g. MH-12-PQ-4532"
                    value={truckNo()}
                    onChange={(e) => setTruckNo(formatTruckNumber(e.target.value))}
                    required
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 uppercase font-mono font-bold"
                  />
                </div>
                <div>
                  <label for="input-make()" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Manufacturer / Make</label>
                  <select
                    id="input-make()"
                    value={make()}
                    onChange={(e) => setMake(e.target.value)}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="">-- Choose Make --</option>
                    <option value="Ashok Leyland">Ashok Leyland</option>
                    <option value="TATA">TATA</option>
                    {make() && make() !== 'Ashok Leyland' && make() !== 'TATA' && (
                      <option value={make()}>{make()}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label for="input-model()" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Model / Horsepower</label>
                  <input
                    id="input-model()"
                    type="text"
                    placeholder="e.g. LPT 3118, 5525"
                    value={model()}
                    onChange={(e) => setModel(e.target.value)}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label for="input-type()" class="block text-[10px] font-bold text-slate-550 uppercase mb-1">Trailer Type</label>
                  <select
                    id="input-type()"
                    value={type()}
                    onChange={(e) => setType(e.target.value)}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="">-- Choose Type --</option>
                    <option value="12 Wheeler">12 Wheeler</option>
                    <option value="14 Wheeler">14 Wheeler</option>
                    <option value="16 Wheeler">16 Wheeler</option>
                    {type() && type() !== '12 Wheeler' && type() !== '14 Wheeler' && type() !== '16 Wheeler' && (
                      <option value={type()}>{type()}</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 2: Compliance Certificates Dates */}
            <div>
              <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">2. Taxes & Compliance Validity Dates</span>
            <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Insurance Expiry</label>
                <input
                  type="date"
                  value={insuranceDate()}
                  onChange={(e) => setInsuranceDate(e.target.value)}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Fitness Cert (FC)</label>
                <input
                  type="date"
                  value={fcDate()}
                  onChange={(e) => setFcDate(e.target.value)}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Quarterly Tax (Q Tax)</label>
                <input
                  type="date"
                  value={qTaxDate()}
                  onChange={(e) => setQTaxDate(e.target.value)}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Green Tax Cert</label>
                <input
                  type="date"
                  value={greenTaxDate()}
                  onChange={(e) => setGreenTaxDate(e.target.value)}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">National Permit Tax</label>
                <input
                  type="date"
                  value={npTaxDate()}
                  onChange={(e) => setNpTaxDate(e.target.value)}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">5 Year Permit Date</label>
                <input
                  type="date"
                  value={fiveYearPermitDate()}
                  onChange={(e) => setFiveYearPermitDate(e.target.value)}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Technical Mileage Readings */}
          <div>
            <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">3. Odometer Readings & Mechanical Spares Target Limits (KM)</span>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label for="input-current-km" class="block text-[9px] font-bold text-blue-700 bg-blue-50 px-1 py-0.5 rounded inline-block uppercase mb-1">Current Odo KM <span class="text-red-500">*</span></label>
                <input
                  id="input-current-km"
                  type="number"
                  placeholder="e.g. 154000"
                  value={currentKM()}
                  onChange={(e) => setCurrentKM(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  class="w-full bg-white border border-blue-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Pinpush Grease KM</label>
                <input
                  type="number"
                  placeholder="Limit"
                  value={pinpushKM() ?? ''}
                  onChange={(e) => setPinpushKM(e.target.value === '' ? '' : Number(e.target.value))}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Wheel Grease KM</label>
                <input
                  type="number"
                  placeholder="Limit"
                  value={wheelGreaseKM() ?? ''}
                  onChange={(e) => setWheelGreaseKM(e.target.value === '' ? '' : Number(e.target.value))}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Alignment Next Date</label>
                <input
                  type="date"
                  value={alignmentNextDate() ?? ''}
                  onChange={(e) => setAlignmentNextDate(e.target.value)}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Owner Name</label>
                <input
                  type="text"
                  placeholder="Owner / Vendor Name"
                  value={ownerName() ?? ''}
                  onChange={(e) => setOwnerName(e.target.value)}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1 text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Oil Mileage Milestones */}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Engine Oil Change */}
              <div class="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label for="input-engine-oil-km" class="block text-[9px] font-extrabold text-slate-550 uppercase mb-1">Engine Oil KM Limit</label>
                  <input
                    id="input-engine-oil-km"
                    type="number"
                    placeholder="Future KM"
                    value={engineOilKM() ?? ''}
                    onChange={(e) => setEngineOilKM(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const odo = currentKM() !== '' ? Number(currentKM()) : 0;
                      setEngineOilKM(odo + activeEngineOilInterval());
                    }}
                    class="mt-1 text-[9px] text-blue-600 hover:text-blue-800 font-semibold block text-left"
                  >
                    ✨ Set next due (Odo + {activeEngineOilInterval()} KM)
                  </button>
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Custom Interval (KM)</label>
                  <input
                    type="number"
                    placeholder={`Uses Org Default: ${(orgProfile?.engineOilIntervalKM || 15000).toLocaleString()} KM`}
                    value={engineOilIntervalKM() ?? ''}
                    onChange={(e) => setEngineOilIntervalKM(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Crown Oil */}
              <div class="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label for="input-crown-oil-km" class="block text-[9px] font-extrabold text-slate-550 uppercase mb-1">Crown Oil KM Limit</label>
                  <input
                    id="input-crown-oil-km"
                    type="number"
                    placeholder="Future KM"
                    value={crownOilKM() ?? ''}
                    onChange={(e) => setCrownOilKM(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const odo = currentKM() !== '' ? Number(currentKM()) : 0;
                      setCrownOilKM(odo + activeCrownOilInterval());
                    }}
                    class="mt-1 text-[9px] text-blue-600 hover:text-blue-800 font-semibold block text-left"
                  >
                    ✨ Set next due (Odo + {activeCrownOilInterval()} KM)
                  </button>
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Custom Interval (KM)</label>
                  <input
                    type="number"
                    placeholder={`Uses Org Default: ${(orgProfile?.crownOilIntervalKM || 40000).toLocaleString()} KM`}
                    value={crownOilIntervalKM() ?? ''}
                    onChange={(e) => setCrownOilIntervalKM(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Gear Box Oil */}
              <div class="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label for="input-gear-box-oil-km" class="block text-[9px] font-extrabold text-slate-555 uppercase mb-1">Gear Box Oil KM Limit</label>
                  <input
                    id="input-gear-box-oil-km"
                    type="number"
                    placeholder="Future KM"
                    value={gearBoxOilKM() ?? ''}
                    onChange={(e) => setGearBoxOilKM(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const odo = currentKM() !== '' ? Number(currentKM()) : 0;
                      setGearBoxOilKM(odo + activeGearBoxOilInterval());
                    }}
                    class="mt-1 text-[9px] text-blue-600 hover:text-blue-800 font-semibold block text-left"
                  >
                    ✨ Set next due (Odo + {activeGearBoxOilInterval()} KM)
                  </button>
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Custom Interval (KM)</label>
                  <input
                    type="number"
                    placeholder={`Uses Org Default: ${(orgProfile?.gearBoxOilIntervalKM || 40000).toLocaleString()} KM`}
                    value={gearBoxOilIntervalKM() ?? ''}
                    onChange={(e) => setGearBoxOilIntervalKM(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Radiator Service */}
              <div class="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label for="input-radiator-km" class="block text-[9px] font-extrabold text-slate-555 uppercase mb-1">Radiator Coolant KM</label>
                  <input
                    id="input-radiator-km"
                    type="number"
                    placeholder="Future KM"
                    value={radiatorKM() ?? ''}
                    onChange={(e) => setRadiatorKM(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const odo = currentKM() !== '' ? Number(currentKM()) : 0;
                      setRadiatorKM(odo + activeRadiatorInterval());
                    }}
                    class="mt-1 text-[9px] text-blue-600 hover:text-blue-800 font-semibold block text-left"
                  >
                    ✨ Set next due (Odo + {activeRadiatorInterval()} KM)
                  </button>
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Custom Interval (KM)</label>
                  <input
                    type="number"
                    placeholder={`Uses Org Default: ${(orgProfile?.radiatorIntervalKM || 20000).toLocaleString()} KM`}
                    value={radiatorIntervalKM() ?? ''}
                    onChange={(e) => setRadiatorIntervalKM(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Pinpush Grease */}
              <div class="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label for="input-pinpush-km" class="block text-[9px] font-extrabold text-slate-555 uppercase mb-1">Pinpush Grease KM Limit</label>
                  <input
                    id="input-pinpush-km"
                    type="number"
                    placeholder="Future KM"
                    value={pinpushKM() ?? ''}
                    onChange={(e) => setPinpushKM(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const odo = currentKM() !== '' ? Number(currentKM()) : 0;
                      setPinpushKM(odo + activePinpushInterval());
                    }}
                    class="mt-1 text-[9px] text-blue-600 hover:text-blue-800 font-semibold block text-left"
                  >
                    ✨ Set next due (Odo + {activePinpushInterval().toLocaleString()} KM)
                  </button>
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Custom Interval (KM)</label>
                  <input
                    type="number"
                    placeholder={`Uses Org Default: ${(orgProfile?.pinpushIntervalKM || 5000).toLocaleString()} KM`}
                    value={pinpushIntervalKM() ?? ''}
                    onChange={(e) => setPinpushIntervalKM(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Wheel Grease */}
              <div class="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label for="input-wheel-grease-km" class="block text-[9px] font-extrabold text-slate-555 uppercase mb-1">Wheel Grease KM Limit</label>
                  <input
                    id="input-wheel-grease-km"
                    type="number"
                    placeholder="Future KM"
                    value={wheelGreaseKM() ?? ''}
                    onChange={(e) => setWheelGreaseKM(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const odo = currentKM() !== '' ? Number(currentKM()) : 0;
                      setWheelGreaseKM(odo + activeWheelGreaseInterval());
                    }}
                    class="mt-1 text-[9px] text-blue-600 hover:text-blue-800 font-semibold block text-left"
                  >
                    ✨ Set next due (Odo + {activeWheelGreaseInterval().toLocaleString()} KM)
                  </button>
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Custom Interval (KM)</label>
                  <input
                    type="number"
                    placeholder={`Uses Org Default: ${(orgProfile?.wheelGreaseIntervalKM || 5000).toLocaleString()} KM`}
                    value={wheelGreaseIntervalKM() ?? ''}
                    onChange={(e) => setWheelGreaseIntervalKM(e.target.value === '' ? '' : Number(e.target.value))}
                    class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* SECTION 3.5: Loan & EMI Settings */}
              <div class="col-span-full border-t border-slate-200 pt-3">
                <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">3.5 Loan & EMI Settings (Multiple Loans Supported)</span>
                
                {/* List of current loans() in form */}
                {loans().length > 0 && (
                  <div class="mb-3 overflow-x-auto border border-slate-200 rounded-lg bg-white">
                    <table class="w-full text-left text-xs">
                      <thead class="bg-slate-50 text-[9px] font-extrabold text-slate-500 uppercase">
                        <tr>
                          <th class="p-2 pl-3">Type</th>
                          <th class="p-2">Bank</th>
                          <th class="p-2">First EMI Paid Date</th>
                          <th class="p-2">Tenure</th>
                          <th class="p-2 font-mono">EMI</th>
                          <th class="p-2">Status</th>
                          <th class="p-2 text-right pr-3">Action</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 font-semibold text-slate-700">
                        {loans().map((l, index) => (
                          <tr  class="hover:bg-slate-50/50">
                            <td class="p-2 pl-3 text-slate-800 font-bold">{l.loanType || 'General Loan'}</td>
                            <td class="p-2">{l.loanBankName || '—'}</td>
                            <td class="p-2 font-mono">{l.loanStartDate || '—'}</td>
                            <td class="p-2 font-mono">{l.loanTenureMonths ? `${l.loanTenureMonths} Mos` : '—'}</td>
                            <td class="p-2 font-mono text-blue-600">₹{l.loanEmiAmount?.toLocaleString('en-IN') || 0}</td>
                            <td class="p-2">
                              <span class={`px-1.5 py-0.5 rounded text-[9px] font-bold ${l.loanStatus === 'Closed' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'}`}>
                                {l.loanStatus || 'Active'}
                              </span>
                            </td>
                            <td class="p-2 text-right pr-3">
                              {canDeleteLoans && (
                                <button
                                  type="button"
                                  onClick={() => setLoans(loans().filter((_, idx) => idx !== index))}
                                  class="text-rose-600 hover:text-rose-800 text-[10px] font-bold cursor-pointer"
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add New Loan Form (Quick Builder) */}
                {canEditLoans ? (
                  <div class="bg-slate-50 border border-slate-200/60 rounded-lg p-3 space-y-3">
                    <div class="text-[10px] font-bold text-slate-500 uppercase">Add a Loan Entry</div>
                    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                      <div>
                        <label class="block text-[9px] font-bold text-slate-500 mb-1">Loan Type</label>
                        <select
                          value={tempLoanType()}
                          onChange={(e) => setTempLoanType(e.target.value)}
                          class="w-full bg-white border border-slate-250 text-slate-850 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                        >
                          <option value="Chassis Loan">Chassis Loan</option>
                          <option value="Body Loan">Body Loan</option>
                          <option value="Other">Other Loan</option>
                        </select>
                      </div>
                      {tempLoanType() === 'Other' && (
                        <div>
                          <label class="block text-[9px] font-bold text-slate-500 mb-1">Custom Type Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Body Building"
                            value={tempCustomLoanType()}
                            onChange={(e) => setTempCustomLoanType(e.target.value)}
                            class="w-full bg-white border border-slate-200 text-slate-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                      <div>
                        <label class="block text-[9px] font-bold text-slate-500 mb-1">Bank Name</label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC Bank"
                          value={tempLoanBank()}
                          onChange={(e) => setTempLoanBank(e.target.value)}
                          class="w-full bg-white border border-slate-200 text-slate-850 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label class="block text-[9px] font-bold text-slate-500 mb-1">First EMI Paid Date</label>
                        <input
                          type="date"
                          value={tempLoanStart()}
                          onChange={(e) => setTempLoanStart(e.target.value)}
                          class="w-full bg-white border border-slate-200 text-slate-850 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label class="block text-[9px] font-bold text-slate-500 mb-1">Tenure (Months)</label>
                        <input
                          type="number"
                          placeholder="Tenure"
                          value={tempLoanTenure()}
                          onChange={(e) => setTempLoanTenure(e.target.value === '' ? '' : Number(e.target.value))}
                          class="w-full bg-white border border-slate-200 text-slate-850 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label class="block text-[9px] font-bold text-slate-500 mb-1">Monthly EMI</label>
                        <input
                          type="number"
                          placeholder="EMI Amount"
                          value={tempLoanEmi()}
                          onChange={(e) => setTempLoanEmi(e.target.value === '' ? '' : Number(e.target.value))}
                          class="w-full bg-white border border-slate-200 text-slate-850 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label class="block text-[9px] font-bold text-slate-500 mb-1">Registered Date</label>
                        <input
                          type="date"
                          value={tempLoanRegisteredDate()}
                          onChange={(e) => setTempLoanRegisteredDate(e.target.value)}
                          placeholder="Defaults to Start Date"
                          class="w-full bg-white border border-slate-200 text-slate-850 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>
                    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-xs pt-1">
                      <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                        <div>
                          <label class="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tempLoanStatus() === 'Closed'}
                              onChange={(e) => setTempLoanStatus(e.target.checked ? 'Closed' : 'Active')}
                              class="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span class="text-[10px] text-slate-500 font-bold uppercase font-semibold">Mark Closed</span>
                          </label>
                        </div>
                        <div class="w-full sm:w-auto">
                          <input
                            type="text"
                            placeholder="Loan Notes / Remarks"
                            value={tempLoanNotes()}
                            onChange={(e) => setTempLoanNotes(e.target.value)}
                            class="bg-white border border-slate-205 text-slate-805 rounded px-2 py-1 text-xs w-full sm:w-64 focus:outline-none focus:border-blue-500 font-semibold"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddLoanToForm}
                        class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-3 py-1.5 rounded transition cursor-pointer w-full sm:w-auto text-center"
                      >
                        Add Loan
                      </button>
                    </div>
                  </div>
                ) : (
                  <p class="text-slate-400 italic text-[11px] p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    You do not have permissions to modify loan details.
                  </p>
                )}
              </div>

              {/* SECTION 4: Upload Documents */}
              <div class="col-span-full border-t border-slate-200 pt-3">
                <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2.5">4. Compliance Document Uploads (Optional)</span>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">RC Document File</label>
                    <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                      <input
                        
                        type="file"
                        onChange={handleRcFileChange}
                        disabled={rcUploading() || isSubmitting() || !isAppwriteConfigured()}
                        class="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
                      />
                      {rcUploading() && <Loader2 class="w-4 h-4 text-blue-600 animate-spin" />}
                      {!rcUploading() && (rcFile() || rcFileId()) && (
                        <div class="flex items-center gap-1.5 shrink-0">
                          <span title={rcFile() ? `Queued: ${rcFile().name}` : "Document linked"}><CheckCircle class="w-4 h-4 text-emerald-600" /></span>
                          <button
                            type="button"
                            onClick={() => {
                              setRcFile(null);
                              setRcFileId('');
                            }}
                            class="text-[9px] text-red-500 font-bold hover:underline cursor-pointer"
                            title="Remove file document"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                    {!isAppwriteConfigured() && (
                      <span class="text-[9px] text-amber-500 font-semibold block mt-0.5">Appwrite bucket connection required for document uploads.</span>
                    )}
                  </div>
                  <div>
                    <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Insurance Certificate File</label>
                    <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                      <input
                        
                        type="file"
                        onChange={handleInsuranceFileChange}
                        disabled={insuranceUploading() || isSubmitting() || !isAppwriteConfigured()}
                        class="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
                      />
                      {insuranceUploading() && <Loader2 class="w-4 h-4 text-blue-600 animate-spin" />}
                      {!insuranceUploading() && (insuranceFile() || insuranceFileId()) && (
                        <div class="flex items-center gap-1.5 shrink-0">
                          <span title={insuranceFile() ? `Queued: ${insuranceFile().name}` : "Document linked"}><CheckCircle class="w-4 h-4 text-emerald-600" /></span>
                          <button
                            type="button"
                            onClick={() => {
                              setInsuranceFile(null);
                              setInsuranceFileId('');
                            }}
                            class="text-[9px] text-red-500 font-bold hover:underline cursor-pointer"
                            title="Remove file document"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                    {!isAppwriteConfigured() && (
                      <span class="text-[9px] text-amber-500 font-semibold block mt-0.5">Appwrite bucket connection required for document uploads.</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Operational Status</label>                <select
                  disabled={status() === 'Admin Disabled' || (isEditing() !== null && (props.trucks || []).find(t => t.id === isEditing())?.isApproved === false) || (isEditing() === null && limitReached()) || isSubmitting()}
                  value={limitReached() && !isEditing() ? 'Inactive' : status()}
                  onChange={(e) => setStatus(e.target.value as any)}
                  class="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none disabled:opacity-50"
                >
                  {status() === 'Admin Disabled' && (
                    <option value="Admin Disabled">Admin Disabled (Locked)</option>
                  )}
                  <option value="Active">Operational / Active</option>
                  <option value="Inactive">Under Maintenance / Inactive</option>
                  <option value="Sold">Sold</option>
                </select>
                {limitReached() && !isEditing() && (
                  <span class="text-[9px] text-amber-600 font-semibold block mt-0.5">Free fleet registration limit reached. Truck will be added as Inactive until subscription payment.</span>
                )}
              </div>
              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Registration Expiry Date</label>
                <input
                  type="text"
                  disabled
                  value={
                    isEditing() 
                      ? (props.trucks || []).find(t => t.id === isEditing())?.registrationExpiryDate || 'Not set' 
                      : 'Auto-set (1 Year)'
                  }
                  class="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-lg px-2.5 py-1 text-xs font-mono"
                />
              </div>
            </div>

          <div class="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={resetForm}
              disabled={isSubmitting()}
              class="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting()}
              class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting() && <Loader2 class="w-3.5 h-3.5 animate-spin" />}
              {isSubmitting() 
                ? 'Uploading & Saving...' 
                : (isEditing() ? ((props.trucks || []).find(t => t.id === isEditing())?.requestStatus === 'Rejected' ? 'Subscribe' : 'Save Specification Updates') : limitReached() ? 'Subscribe' : 'Add Truck Specs')}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* SEARCH AND FILTER TOOLBAR */}
      <div class="bg-slate-50 dark:bg-slate-900/40 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search Input Box */}
        <div class="relative flex-1 max-w-md">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search class="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search by Vehicle Number (e.g. MH-12)..."
            value={searchQuery()}
            onChange={(e) => setSearchQuery(e.target.value)}
            class="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono tracking-wider animate-fade-in"
          />
          {searchQuery() && (
            <button
              onClick={() => setSearchQuery('')}
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Operational Status Filters Tabs */}
        <div class="flex flex-wrap gap-1.5 items-center">
          <span class="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Filter Status:</span>
          
          {/* ALL Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('All')}
            class={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
              statusFilter() === 'All'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <span>All</span>
            <span class={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
              statusFilter() === 'All' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>{allCount()}</span>
          </button>

          {/* ACTIVE Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('Active')}
            class={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
              statusFilter() === 'Active'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
            <span>Active</span>
            <span class={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
              statusFilter() === 'Active' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>{activeCount()}</span>
          </button>

          {/* INACTIVE Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('Inactive')}
            class={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
              statusFilter() === 'Inactive'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <span class="w-1.5 h-1.5 rounded-full bg-rose-450 shrink-0"></span>
            <span>Under Maintenance</span>
            <span class={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
              statusFilter() === 'Inactive' ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>{inactiveCount()}</span>
          </button>

          {/* ADMIN DISABLED Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('Admin Disabled')}
            class={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
              statusFilter() === 'Admin Disabled'
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <span class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse"></span>
            <span>Admin Blocked</span>
            <span class={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
              statusFilter() === 'Admin Disabled' ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>{adminDisabledCount()}</span>
          </button>

          {/* SOLD Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('Sold')}
            class={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
              statusFilter() === 'Sold'
                ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <span class="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
            <span>Sold</span>
            <span class={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
              statusFilter() === 'Sold' ? 'bg-slate-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>{soldCount()}</span>
          </button>
        </div>
      </div>

      {/* BEAUTIFUL HIGH-DENSITY GRID OF FLEET COMPLIANCE CARDS */}
      {(props.trucks || []).length === 0 ? (
        <div class="text-center py-12 text-slate-400 font-medium italic border border-slate-200 rounded-xl bg-slate-50/50">
          No operational vehicles registered in the system database.
        </div>
      ) : filteredTrucks().length === 0 ? (
        <div class="text-center py-12 text-slate-400 font-medium italic border border-slate-200 rounded-xl bg-slate-50/50">
          No vehicles found matching search query "{searchQuery()}" or selected status() filters.
        </div>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrucks().map((truck) => {
            const insDays = calculateDaysLeft(truck.insuranceDate);
            const fcDays = calculateDaysLeft(truck.fcDate);
            const aliDays = calculateDaysLeft(truck.alignmentNextDate);
            const qDays = calculateDaysLeft(truck.qTaxDate);
            const gDays = calculateDaysLeft(truck.greenTaxDate);
            const npDays = calculateDaysLeft(truck.npTaxDate);
            const fvDays = calculateDaysLeft(truck.fiveYearPermitDate);
            const regDays = calculateDaysLeft(truck.registrationExpiryDate);

            const isExpanded = expandedTruckId() === truck.id;

            return (
              <div
                
                id={`card-truck-${truck.id}`}
                class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between group/card relative"
              >
                <div>
                  {/* Top Row: Vehicle No + Status Badges */}
                  <div class="flex justify-between items-start gap-2 mb-4 pr-8">
                    <div class="flex flex-col gap-1 min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="shrink-0 text-blue-600 dark:text-blue-400">
                          <Shield class={`w-4 h-4 ${truck.isApproved === false ? 'text-amber-500 animate-pulse' : 'text-blue-500'}`} />
                        </span>
                        <h4
                          onClick={() => truck.isApproved !== false && setViewingTruckId(truck.id)}
                          class={`font-mono font-extrabold text-sm tracking-wider text-slate-900 dark:text-white cursor-pointer select-all select-none hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${truck.isApproved !== false ? "underline decoration-dotted decoration-blue-400" : ""}`}
                          title={truck.isApproved !== false ? "Click to view detailed financials & performance logs" : "Pending approval by Backend Team."}
                        >
                          {truck.truckNo}
                        </h4>
                        {truck.loanStartDate && truck.loanEmiAmount && truck.loanStatus !== 'Closed' && (
                          <span title={`Active loan with ${truck.loanBankName || 'bank'}`} class="shrink-0"><Landmark class="w-3.5 h-3.5 text-amber-500 animate-pulse" /></span>
                        )}
                      </div>
                      
                      {truck.isApproved === false && (
                        <span class={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider max-w-max ${
                          truck.requestStatus === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/30'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/30'
                        }`}>
                          {truck.requestStatus === 'Rejected' ? 'Subscription Inactive' : 'Pending Approval'}
                        </span>
                      )}
                    </div>

                    <span class={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                        truck.status === 'Active' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30' 
                          : truck.status === 'Admin Disabled'
                            ? 'bg-red-50 text-red-700 border border-red-200 font-extrabold animate-pulse dark:bg-rose-955/20 dark:text-rose-455 dark:border-rose-900/30'
                            : truck.status === 'Sold'
                              ? 'bg-slate-100 text-slate-700 border border-slate-350 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/30'
                      }`}>
                        <span class={`w-1.5 h-1.5 rounded-full ${truck.status === 'Active' ? 'bg-emerald-500 animate-pulse' : truck.status === 'Sold' ? 'bg-slate-405' : 'bg-rose-500'}`}></span>
                        {truck.status === 'Active' ? 'Active' : truck.status === 'Admin Disabled' ? 'Admin Disabled' : truck.status === 'Sold' ? 'Sold' : 'Inactive'}
                      </span>
                  </div>

                  {/* Core Technical Specifications Banner */}
                  <div class="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1 mb-4 border-b border-slate-100 dark:border-slate-800/30 pb-3">
                    {truck.make && (
                      <span class="flex items-center gap-1">
                        <strong class="text-slate-450 uppercase text-[9px]">Make:</strong>
                        <span class="font-semibold text-slate-700 dark:text-slate-300">{truck.make}</span>
                      </span>
                    )}
                    {truck.model && (
                      <span class="flex items-center gap-1">
                        <strong class="text-slate-450 uppercase text-[9px]">Model:</strong>
                        <span class="font-mono text-slate-700 dark:text-slate-300">{truck.model}</span>
                      </span>
                    )}
                    {truck.type && (
                      <span class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded font-bold text-[8px] uppercase tracking-wider">
                        {truck.type}
                      </span>
                    )}
                    {truck.ownerName && (
                      <span class="flex items-center gap-1 w-full mt-1">
                        <strong class="text-slate-450 uppercase text-[9px]">Owner/Vendor:</strong>
                        <span class="font-semibold text-slate-700 dark:text-slate-300 truncate">{truck.ownerName}</span>
                      </span>
                    )}
                  </div>

                  {/* Current Odometer Status Badge */}
                  <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850 rounded-xl mb-4 text-xs">
                    <span class="text-slate-500 dark:text-slate-400 font-semibold">Current Odometer:</span>
                    <span class="font-mono font-extrabold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
                      {truck.currentKM ? truck.currentKM.toLocaleString() : '0'} KM
                    </span>
                  </div>

                  {/* Taxes & Validity Compliance Logs */}
                  <div class="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-850 rounded-xl p-3.5 space-y-2 mb-4">
                    <h5 class="text-[9px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1 pb-1 border-b border-slate-200/35 dark:border-slate-800/10">Compliance Certifications</h5>
                    {renderComplianceRow('Insurance', truck.insuranceDate, insDays, truck.insuranceFileId, orgProfile?.insuranceWarningDays ?? 30)}
                    {renderComplianceRow('Fitness Cert (FC)', truck.fcDate, fcDays, undefined, orgProfile?.fcWarningDays ?? 30)}
                    {renderComplianceRow('National Permit', truck.npTaxDate, npDays, undefined, orgProfile?.npTaxWarningDays ?? 30)}
                    {renderComplianceRow('5Y Permit Date', truck.fiveYearPermitDate, fvDays, undefined, orgProfile?.fiveYearPermitWarningDays ?? 30)}
                    {renderComplianceRow('Q Tax validity', truck.qTaxDate, qDays, undefined, orgProfile?.qTaxWarningDays ?? 30)}
                    {renderComplianceRow('Green Tax Cert', truck.greenTaxDate, gDays, undefined, orgProfile?.greenTaxWarningDays ?? 30)}
                    {renderComplianceRow('NP Tax Validity', truck.npTaxDate, npDays, undefined, orgProfile?.npTaxWarningDays ?? 30)}
                    {renderComplianceRow('Subscription Expiry', truck.registrationExpiryDate, regDays, undefined, orgProfile?.subscriptionWarningDays ?? 30)}
                  </div>

                  {/* Active Loan summary banner if present */}
                  {truck.loanStartDate && truck.loanEmiAmount && (
                    <div class="bg-amber-50/30 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-xl p-3.5 mb-4 text-xs">
                      <div class="flex justify-between items-center">
                        <span class="text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px] flex items-center gap-1.5">
                          <Landmark class="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>EMI Loan ({truck.loanStatus || 'Active'})</span>
                        </span>
                        <span class="font-extrabold text-[11px] text-slate-900 dark:text-white font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                          ₹{Number(truck.loanEmiAmount).toLocaleString('en-IN')} /mo
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Lubes Spares & Oils progress toggles */}
                  <div class="border border-slate-200/60 dark:border-slate-850 rounded-xl p-3 bg-white dark:bg-slate-900 shadow-sm mb-4">
                    <button
                      type="button"
                      onClick={() => setExpandedTruckId(isExpanded ? null : truck.id)}
                      class="w-full text-center text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1.5 cursor-pointer hover:underline"
                    >
                      <span>{isExpanded ? 'Hide' : 'View'} Mechanical & Oils Milestones</span>
                      {isExpanded ? <ChevronUp class="w-3.5 h-3.5" /> : <ChevronDown class="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <div class="mt-4 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800 grid grid-cols-1 gap-3 animate-fade-in">
                        {renderLubeProgress(truck.engineOilKM, truck.currentKM || 0, truck.engineOilIntervalKM || orgProfile?.engineOilIntervalKM || 15000, 'Engine Oil Change')}
                        {renderLubeProgress(truck.crownOilKM, truck.currentKM || 0, truck.crownOilIntervalKM || orgProfile?.crownOilIntervalKM || 40000, 'Crown Oil Change')}
                        {renderLubeProgress(truck.gearBoxOilKM, truck.currentKM || 0, truck.gearBoxOilIntervalKM || orgProfile?.gearBoxOilIntervalKM || 40000, 'Gear Box Oil Change')}
                        {renderLubeProgress(truck.radiatorKM, truck.currentKM || 0, truck.radiatorIntervalKM || orgProfile?.radiatorIntervalKM || 20000, 'Radiator Coolant Service')}
                        
                        <div class="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/40 text-[10px] text-slate-500 dark:text-slate-400">
                          <div>
                            <span class="block font-bold text-slate-400 uppercase text-[9px] mb-0.5">Pinpush Grease KM</span>
                            <span class="font-mono font-bold text-slate-700 dark:text-slate-350">{truck.pinpushKM ? `${truck.pinpushKM.toLocaleString()} KM` : '—'}</span>
                          </div>
                          <div>
                            <span class="block font-bold text-slate-400 uppercase text-[9px] mb-0.5">Wheel Grease KM</span>
                            <span class="font-mono font-bold text-slate-700 dark:text-slate-350">{truck.wheelGreaseKM ? `${truck.wheelGreaseKM.toLocaleString()} KM` : '—'}</span>
                          </div>
                          <div class="col-span-2">
                            <span class="block font-bold text-slate-400 uppercase text-[9px] mb-0.5">Alignment Next Date</span>
                            <span class="font-mono font-bold text-slate-700 dark:text-slate-350">{truck.alignmentNextDate ? `${truck.alignmentNextDate} (${aliDays !== null ? `${aliDays}d` : ''})` : '—'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Documents View links */}
                  {(truck.rcFileId || truck.insuranceFileId) && (
                    <div class="flex flex-wrap gap-2 mb-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-850 p-2 rounded-xl">
                      {truck.rcFileId && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              const url = await appwrite.getSecureFileUrl(truck.rcFileId);
                              window.open(url, '_blank');
                            } catch (err) {
                              alert("Failed to load secure document.");
                            }
                          }}
                          class="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-450 font-semibold text-[10px] rounded-lg hover:bg-blue-100/50 transition cursor-pointer"
                        >
                          <FileText class="w-3.5 h-3.5" />
                          <span>RC Document</span>
                        </button>
                      )}
                      {truck.insuranceFileId && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              const url = await appwrite.getSecureFileUrl(truck.insuranceFileId);
                              window.open(url, '_blank');
                            } catch (err) {
                              alert("Failed to load secure document.");
                            }
                          }}
                          class="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-455 font-semibold text-[10px] rounded-lg hover:bg-indigo-100/50 transition cursor-pointer"
                        >
                          <FileText class="w-3.5 h-3.5" />
                          <span>Insurance Spec</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Micro-FAB Speed Dial */}
                <div class="absolute top-3 right-3 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <div class={`flex items-center gap-1.5 bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-full p-1 pl-2.5 pr-1.5 shadow-md transition-all duration-300 ease-out origin-right transform whitespace-nowrap ${
                    activeSpeedDialId() === truck.id 
                      ? 'opacity-100 scale-100 translate-x-0 pointer-events-auto' 
                      : 'opacity-0 scale-90 translate-x-2 pointer-events-none'
                  }`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (truck.isApproved !== false) {
                          setViewingTruckId(truck.id);
                        }
                        setActiveSpeedDialId(null);
                      }}
                      disabled={truck.isApproved === false}
                      class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer disabled:opacity-45"
                      title="Financials"
                    >
                      <Eye class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canEditTrucks}
                      onClick={() => {
                        startEdit(truck);
                        setActiveSpeedDialId(null);
                      }}
                      class="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer disabled:opacity-45"
                      title={(!truck.isApproved || (truck.registrationExpiryDate && truck.registrationExpiryDate < new Date().toISOString().split('T')[0]) || truck.requestStatus === 'Rejected') ? 'Subscribe' : 'Edit Specs'}
                    >
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canDeleteTrucks}
                      onClick={() => {
                        const msg = `Caution! Are you sure you want to permanently delete vehicle entry ${truck.truckNo}? This will delete all compliance records.`;
                        const onDeleteAction = () => {
                          onDeleteTruck(truck.id);
                          setActiveSpeedDialId(null);
                        };
                        if (confirmAction) {
                          confirmAction(msg, onDeleteAction, "Delete Vehicle Database Record");
                        } else if (confirm(msg)) {
                          onDeleteAction();
                        }
                      }}
                      class="w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-955/20 border border-rose-150 dark:border-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-455 hover:bg-rose-100/30 transition cursor-pointer disabled:opacity-45"
                      title="Delete Truck"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSpeedDialId(activeSpeedDialId() === truck.id ? null : truck.id)}
                    class="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow-lg transition-all duration-300 active:scale-95 cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-200"
                  >
                    {activeSpeedDialId() === truck.id ? (
                      <X class="w-4 h-4 transition-transform duration-300 rotate-90" />
                    ) : (
                      <Settings class="w-4 h-4 transition-transform duration-300" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VEHICLE METRICS & FINANCIAL PERFORMANCE DRAWER (FLYOUT) */}
      {viewingTruckId() && (() => {
        const truck = (props.trucks || []).find(t => t.id === viewingTruckId());
        if (!truck) return null;

        const truckTrips = trips.filter(t => t.truckNo === truck.truckNo && t.status !== 'Deleted' && !t.deletedAt);
        const truckExpenses = expenses.filter(e => e.truckNo === truck.truckNo);
        
        // Sum up trip performance
        let totalTrips = truckTrips.length;
        let totalRevenue = 0;
        let totalTripExpenses = 0;
        let outstandingReceivables = 0;
        let fuelSpent = 0;
        let wagesPaid = 0;

        truckTrips.forEach(t => {
          const m = getTripMetrics(t);
          totalRevenue += m.income;
          totalTripExpenses += m.totalExpense;
          outstandingReceivables += m.outstandingBalance;
          fuelSpent += m.dieselExpense;
          wagesPaid += m.driverWages;
        });

        const totalGeneralExpenses = truckExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const overallExpenses = totalTripExpenses + totalGeneralExpenses;
        const netEarnings = totalRevenue - overallExpenses;
        const profitMargin = totalRevenue > 0 ? (netEarnings / totalRevenue) * 100 : 0;

        return (
          <div class="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fade-in" id="truck-finance-flyout-backdrop">
            {/* Backdrop */}
            <div 
              class="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
              onClick={() => setViewingTruckId(null)}
            />

            {/* Panel */}
            <div class="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200" id="truck-finance-flyout-panel">
              {/* Header */}
              <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-blue-100 rounded-lg text-blue-700 shadow-3xs">
                    <Shield class="w-5 h-5" />
                  </div>
                  <div>
                    <h2 class="text-base font-bold text-slate-800 font-mono tracking-wider">{truck.truckNo}</h2>
                    <p class="text-xs text-slate-500 font-medium">
                      {(truck.make || truck.model) ? `${truck.make} ${truck.model}` : 'Specification Audit Leaflet'}{truck.type ? ` • ${truck.type}` : ''}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingTruckId(null)}
                  class="p-1.5 rounded-lg hover:bg-slate-250 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div class="overflow-y-auto flex-1 p-5 space-y-6">
                
                {/* Section A: Live Financial Ledger Card */}
                <div class="bg-slate-900 text-white rounded-xl p-5 shadow-lg relative overflow-hidden">
                  <div class="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
                    <Shield class="w-40 h-40" />
                  </div>
                  <div class="flex justify-between items-start">
                    <div>
                      <span class="text-[10px] text-slate-400 uppercase font-black tracking-widest block">Net Asset Profit/Loss</span>
                      <span class={`text-2xl font-black mt-1 block tracking-tight font-sans ${netEarnings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {netEarnings >= 0 ? '+' : ''}₹{netEarnings.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <span class={`px-2.5 py-1 text-xs font-bold rounded-lg ${netEarnings >= 0 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'}`}>
                      {profitMargin.toFixed(1)}% Margin
                    </span>
                  </div>

                  <div class="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/10 text-center">
                    <div>
                      <span class="text-[9px] text-slate-400 uppercase font-semibold block">Total Revenue</span>
                      <span class="text-xs font-bold mt-1 block text-slate-100 font-mono">₹{totalRevenue.toLocaleString()}</span>
                    </div>
                    <div>
                      <span class="text-[9px] text-slate-400 uppercase font-semibold block">Total Expenses</span>
                      <span class="text-xs font-bold mt-1 block text-slate-100 font-mono">₹{overallExpenses.toLocaleString()}</span>
                    </div>
                    <div>
                      <span class="text-[9px] text-slate-400 uppercase font-semibold block text-amber-300">Outstanding</span>
                      <span class="text-xs font-bold mt-1 block text-amber-300 font-mono">₹{outstandingReceivables.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Section B: Income & Expense Statement breakdown */}
                <div>
                  <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5">Profit & Loss Breakdown</h3>
                  <div class="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                    <div class="p-3 flex justify-between items-center text-xs font-medium">
                      <span class="text-slate-500">Total Transport Ventures ({totalTrips} Trips)</span>
                      <span class="font-semibold text-emerald-600 font-mono">+₹{totalRevenue.toLocaleString()}</span>
                    </div>
                    <div class="p-3 flex justify-between items-center text-xs font-medium">
                      <span class="text-slate-500">Trip Specific Running costs</span>
                      <span class="font-semibold text-rose-500 font-mono">-₹{(totalTripExpenses - fuelSpent - wagesPaid).toLocaleString()}</span>
                    </div>
                    <div class="p-3 flex justify-between items-center text-xs font-medium">
                      <span class="text-slate-500">High density Fuel Consumption spends</span>
                      <span class="font-semibold text-rose-500 font-mono">-₹{fuelSpent.toLocaleString()}</span>
                    </div>
                    <div class="p-3 flex justify-between items-center text-xs font-medium">
                      <span class="text-slate-500">Driver Wages & Commissions</span>
                      <span class="font-semibold text-rose-500 font-mono">-₹{wagesPaid.toLocaleString()}</span>
                    </div>
                    <div class="p-3 flex justify-between items-center text-xs font-medium bg-slate-50/50">
                      <span class="text-slate-500">General Ledger Vouchers ({truckExpenses.length} entries)</span>
                      <span class="font-semibold text-rose-500 font-mono">-₹{totalGeneralExpenses.toLocaleString()}</span>
                    </div>
                    <div class="p-3 flex justify-between items-center text-xs font-bold bg-slate-50">
                      <span class="text-slate-800">Net Calculated Return</span>
                      <span class={`font-mono ${netEarnings >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ₹{netEarnings.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section B.5: Loan & EMI Progress */}
                {(() => {
                  const activeLoansList = getTruckLoans(truck);
                  if (activeLoansList.length === 0) return null;
                  
                  return (
                    <div class="space-y-4">
                      <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                        <Landmark class="w-4 h-4 text-blue-600" />
                        <span>Loan & EMI Progress</span>
                      </h3>
                      {activeLoansList.map((loan, idx) => {
                        const stats = calculateSingleLoanStats(loan, truck.truckNo, expenses);
                        if (!stats) return null;
                        const progressPercent = Math.min(100, Math.max(0, (stats.paidInstallments / (loan.loanTenureMonths || 1)) * 100));

                        const handleDeleteLoan = () => {
                          if (!confirm(`Are you sure you want to delete the ${loan.loanType || 'Loan'}? This will permanently remove it from the vehicle records.`)) return;
                          const nextLoans = activeLoansList.filter(l => l.id !== loan.id);
                          const primaryLoan = nextLoans[0];
                          onUpdateTruck({
                            ...truck,
                            loans: nextLoans,
                            loanStartDate: primaryLoan?.loanStartDate || '',
                            loanRegisteredDate: primaryLoan?.loanRegisteredDate || '',
                            loanTenureMonths: primaryLoan?.loanTenureMonths !== undefined ? primaryLoan.loanTenureMonths : '',
                            loanEmiAmount: primaryLoan?.loanEmiAmount !== undefined ? primaryLoan.loanEmiAmount : '',
                            loanBankName: primaryLoan?.loanBankName || '',
                            loanStatus: primaryLoan?.loanStatus || 'Active',
                            loanNotes: primaryLoan?.loanNotes || '',
                          } as any);
                          alert("Loan deleted successfully.");
                        };

                        const handleEditLoan = () => {
                          setEditingLoanTarget({ truck, loan });
                        };
                        
                        return (
                          <div  class="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3 shadow-3xs hover:shadow-2xs transition">
                            <div class="flex justify-between items-center border-b border-slate-200/60 pb-1.5 mb-1">
                              <span class="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                {loan.loanType || 'General Loan'}
                              </span>
                              <div class="flex items-center gap-2">
                                <span class={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${loan.loanStatus === 'Closed' ? 'bg-slate-200 text-slate-600' : 'bg-blue-50 text-blue-700'}`}>
                                  {loan.loanStatus || 'Active'}
                                </span>
                                {canEditLoans && (
                                  <button
                                    type="button"
                                    onClick={handleEditLoan}
                                    class="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-slate-100 transition cursor-pointer"
                                    title="Edit Loan"
                                  >
                                    <Edit2 class="w-3 h-3" />
                                  </button>
                                )}
                                {canDeleteLoans && (
                                  <button
                                    type="button"
                                    onClick={handleDeleteLoan}
                                    class="text-rose-600 hover:text-rose-805 p-0.5 rounded hover:bg-slate-100 transition cursor-pointer"
                                    title="Delete Loan"
                                  >
                                    <Trash2 class="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div class="grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <span class="text-slate-400 font-bold uppercase text-[9px] block">Lending Institution</span>
                                <span class="font-semibold text-slate-800">{loan.loanBankName || 'N/A'}</span>
                              </div>
                              <div>
                                <span class="text-slate-400 font-bold uppercase text-[9px] block">Total Loan & Interest</span>
                                <span class="font-semibold text-slate-850">
                                  ₹{((loan.loanTenureMonths || 0) * (loan.loanEmiAmount || 0)).toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div>
                                <span class="text-slate-400 font-bold uppercase text-[9px] block">First EMI Date & Tenure</span>
                                <span class="font-semibold text-slate-800">{loan.loanStartDate} ({loan.loanTenureMonths} Months)</span>
                              </div>
                              {loan.loanRegisteredDate && (
                                <div class="col-span-3 border-t border-slate-200/40 pt-1">
                                  <span class="text-slate-400 font-bold uppercase text-[9px] block">Loan Registered Date</span>
                                  <span class="font-semibold text-slate-800 font-mono text-[11px]">{loan.loanRegisteredDate}</span>
                                </div>
                              )}
                            </div>
                            
                            <div class="border-t border-slate-200/60 pt-2.5">
                              <div class="flex justify-between text-xs font-semibold mb-1">
                                <span class="text-slate-700 font-sans font-semibold">Installments Cleared</span>
                                <span class="font-mono text-slate-500">
                                  {stats.paidInstallments} / {loan.loanTenureMonths} Paid ({progressPercent.toFixed(0)}%)
                                </span>
                              </div>
                              <div class="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden">
                                <div 
                                  class="h-2 rounded-full bg-blue-600 transition-all duration-300"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <div class="flex justify-between text-[10px] text-slate-500 mt-1">
                                <span>Total Paid: ₹{stats.totalPaid.toLocaleString('en-IN')}</span>
                                <span>Remaining: ₹{stats.totalRemaining.toLocaleString('en-IN')}</span>
                              </div>
                            </div>

                            <div class="border-t border-slate-200/60 pt-2.5 flex justify-between items-center text-xs">
                              <div>
                                <span class="text-slate-400 font-bold uppercase text-[9px] block">Next Due Date</span>
                                <span class={`font-semibold font-mono ${stats.isOverdue ? 'text-rose-600 font-bold animate-pulse' : 'text-slate-800'}`}>
                                  {stats.nextDueDateStr}
                                </span>
                              </div>
                              <div class="flex items-center gap-2">
                                {stats.isOverdue && (
                                  <span class="bg-rose-50 text-rose-700 font-bold text-[9px] px-2 py-0.5 rounded border border-rose-200 uppercase tracking-wider animate-pulse">
                                    Overdue
                                  </span>
                                )}
                                {stats.nextDueDateStr !== 'Fully Settled' && canEditExpenses && (
                                  <button
                                    type="button"
                                    onClick={() => setPayEmiTarget({
                                      truckNo: truck.truckNo,
                                      emiAmount: loan.loanEmiAmount || 0,
                                      bankName: loan.loanBankName || '',
                                      dueDateStr: stats.nextDueDateStr,
                                      loanType: loan.loanType,
                                    })}
                                    class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-3 py-1 rounded shadow-sm hover:shadow-md transition cursor-pointer"
                                  >
                                    Pay EMI
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Section C: Technical Lubricants Life expectancy */}
                <div>
                  <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">Engines & Lubricants Lifespan</h3>
                  <p class="text-[10px] text-slate-400 mb-3">Mileage comparisons mapped with current odometer reading: <b class="text-slate-700">{truck.currentKM?.toLocaleString() || '0'} KM</b></p>
                  
                  <div class="space-y-4">
                    {renderMaintenanceProgressBar('Engine Oil Milestone', truck.engineOilKM, truck.currentKM, truck.engineOilIntervalKM || orgProfile?.engineOilIntervalKM, 15000)}
                    {onServiceDone && (
                      <button type="button" onClick={() => openServiceDone(truck, 'Engine Oil', truck.engineOilKM, truck.engineOilIntervalKM || orgProfile?.engineOilIntervalKM || 15000)} class="w-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1.5"><Wrench class="w-3 h-3" /> ✔ Service Done</button>
                    )}
                    {renderMaintenanceProgressBar('Crown Differential Oil', truck.crownOilKM, truck.currentKM, truck.crownOilIntervalKM || orgProfile?.crownOilIntervalKM, 40000)}
                    {onServiceDone && (
                      <button type="button" onClick={() => openServiceDone(truck, 'Crown Oil', truck.crownOilKM, truck.crownOilIntervalKM || orgProfile?.crownOilIntervalKM || 40000)} class="w-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1.5"><Wrench class="w-3 h-3" /> ✔ Service Done</button>
                    )}
                    {renderMaintenanceProgressBar('Main Gearbox Oil', truck.gearBoxOilKM, truck.currentKM, truck.gearBoxOilIntervalKM || orgProfile?.gearBoxOilIntervalKM, 40000)}
                    {onServiceDone && (
                      <button type="button" onClick={() => openServiceDone(truck, 'Gear Box Oil', truck.gearBoxOilKM, truck.gearBoxOilIntervalKM || orgProfile?.gearBoxOilIntervalKM || 40000)} class="w-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1.5"><Wrench class="w-3 h-3" /> ✔ Service Done</button>
                    )}
                    {renderMaintenanceProgressBar('Radiator Service', truck.radiatorKM, truck.currentKM, truck.radiatorIntervalKM || orgProfile?.radiatorIntervalKM, 20000)}
                    {onServiceDone && (
                      <button type="button" onClick={() => openServiceDone(truck, 'Radiator', truck.radiatorKM, truck.radiatorIntervalKM || orgProfile?.radiatorIntervalKM || 20000)} class="w-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1.5"><Wrench class="w-3 h-3" /> ✔ Service Done</button>
                    )}
                    {renderMaintenanceProgressBar('Pinpush Grease', truck.pinpushKM, truck.currentKM, truck.pinpushIntervalKM || orgProfile?.pinpushIntervalKM, 5000)}
                    {onServiceDone && (
                      <button type="button" onClick={() => openServiceDone(truck, 'Pinpush Grease', truck.pinpushKM, truck.pinpushIntervalKM || orgProfile?.pinpushIntervalKM || 5000)} class="w-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1.5"><Wrench class="w-3 h-3" /> ✔ Service Done</button>
                    )}
                    {renderMaintenanceProgressBar('Wheel Grease', truck.wheelGreaseKM, truck.currentKM, truck.wheelGreaseIntervalKM || orgProfile?.wheelGreaseIntervalKM, 5000)}
                    {onServiceDone && (
                      <button type="button" onClick={() => openServiceDone(truck, 'Wheel Grease', truck.wheelGreaseKM, truck.wheelGreaseIntervalKM || orgProfile?.wheelGreaseIntervalKM || 5000)} class="w-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1.5"><Wrench class="w-3 h-3" /> ✔ Service Done</button>
                    )}
                  </div>
                </div>

                {/* Section D: Uploaded Compliance Documents */}
                {(truck.rcFileId || truck.insuranceFileId) && (
                  <div>
                    <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5 font-sans">Uploaded Compliance Documents</h3>
                    <div class="grid grid-cols-2 gap-3">
                      {truck.rcFileId && (
                        <a
                          href="#"
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              const url = await appwrite.getSecureFileUrl(truck.rcFileId);
                              window.open(url, '_blank');
                            } catch (err) {
                              alert("Failed to load secure document.");
                            }
                          }}
                          class="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 font-semibold text-xs hover:bg-blue-100/70 transition cursor-pointer"
                        >
                          <span>RC Document</span>
                          <span class="text-[10px] text-blue-500 font-medium font-sans">View &rarr;</span>
                        </a>
                      )}
                      {truck.insuranceFileId && (
                        <a
                          href="#"
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              const url = await appwrite.getSecureFileUrl(truck.insuranceFileId);
                              window.open(url, '_blank');
                            } catch (err) {
                              alert("Failed to load secure document.");
                            }
                          }}
                          class="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 font-semibold text-xs hover:bg-indigo-100/70 transition cursor-pointer"
                        >
                          <span>Insurance Certificate</span>
                          <span class="text-[10px] text-indigo-500 font-medium font-sans">View &rarr;</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Section D: Active Vouchers Logs */}
                <div>
                  <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">Asset History Ledger Records</h3>
                  <div class="max-h-[160px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                    {truckExpenses.length === 0 ? (
                      <p class="text-center py-6 text-slate-400 font-medium italic">No standalone ledger vouchers processed for {truck.truckNo}.</p>
                    ) : (
                      truckExpenses.map(e => (
                        <div  class="p-2.5 flex justify-between items-center hover:bg-slate-50">
                          <div>
                            <span class="font-bold text-slate-800 tracking-tight block">{e.expenseType}</span>
                            <span class="text-[9px] text-slate-400 font-mono block mt-0.5">{e.date} &bull; {e.status}</span>
                          </div>
                          <span class="font-mono font-extrabold text-rose-600">-₹{e.amount.toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Status footer summary */}
              <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-[10px] text-slate-500">
                <span>Total associated runs: <b class="text-slate-805">{totalTrips} Trips</b></span>
                <span>Active Compliance Status: <b class={`${truck.status === 'Active' ? 'text-emerald-600' : 'text-rose-600'}`}>{truck.status}</b></span>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Service Done Modal */}
      {serviceDoneTarget() && (
        <ServiceDoneModal
          isOpen={true}
          truckNo={serviceDoneTarget().truckNo}
          truckId={serviceDoneTarget().truckId}
          serviceType={serviceDoneTarget().serviceType}
          currentKM={serviceDoneTarget().currentKM}
          intervalKM={serviceDoneTarget().intervalKM}
          accounts={accounts}
          drivers={drivers}
          onConfirm={(payload) => {
            if (onServiceDone) onServiceDone(payload);
            setServiceDoneTarget(null);
          }}
          onCancel={() => setServiceDoneTarget(null)}
        />
      )}
      {/* Pay EMI Modal */}
      {payEmiTarget() && (
        <PayEmiModal
          isOpen={true}
          onClose={() => setPayEmiTarget(null)}
          truckNo={payEmiTarget().truckNo}
          emiAmount={payEmiTarget().emiAmount}
          bankName={payEmiTarget().bankName}
          dueDateStr={payEmiTarget().dueDateStr}
          accounts={accounts}
          loanType={payEmiTarget().loanType}
          onConfirm={async (paymentDate, accountId) => {
            if (onAddExpense) {
              await onAddExpense({
                truckNo: payEmiTarget().truckNo,
                expenseType: 'Loan EMI',
                shopName: payEmiTarget().bankName,
                amount: payEmiTarget().emiAmount,
                paymentMode: accountId,
                date: paymentDate,
                status: 'Paid',
                notes: `EMI payment due date: ${payEmiTarget().dueDateStr}${payEmiTarget().loanType ? ` (${payEmiTarget().loanType})` : ''}`,
              });
              alert(`EMI Payment of ₹${payEmiTarget().emiAmount.toLocaleString('en-IN')} for ${payEmiTarget().truckNo} recorded successfully.`);
            }
            setPayEmiTarget(null);
          }}
        />
      )}
      {/* Edit Loan Modal */}
      {editingLoanTarget() && (
        <EditLoanModal
          isOpen={true}
          loan={editingLoanTarget().loan}
          onCancel={() => setEditingLoanTarget(null)}
          onConfirm={(updatedLoan) => {
            const currentLoans = getTruckLoans(editingLoanTarget().truck);
            const nextLoans = currentLoans.map(l => l.id === updatedLoan.id ? updatedLoan : l);
            const primaryLoan = nextLoans[0];
            onUpdateTruck({
              ...editingLoanTarget().truck,
              loans: nextLoans,
              loanStartDate: primaryLoan?.loanStartDate || '',
              loanRegisteredDate: primaryLoan?.loanRegisteredDate || '',
              loanTenureMonths: primaryLoan?.loanTenureMonths !== undefined ? primaryLoan.loanTenureMonths : '',
              loanEmiAmount: primaryLoan?.loanEmiAmount !== undefined ? primaryLoan.loanEmiAmount : '',
              loanBankName: primaryLoan?.loanBankName || '',
              loanStatus: primaryLoan?.loanStatus || 'Active',
              loanNotes: primaryLoan?.loanNotes || '',
            } as any);
            setEditingLoanTarget(null);
            alert("Loan details updated successfully.");
          }}
        />
      )}
      {/* PhonePe Payment Modal */}
      {showPhonePeModal() && phonePePayload() && (
        <PhonePePaymentModal
          isOpen={true}
          onClose={() => {
            setShowPhonePeModal(false);
            setPhonePePayload(null);
            setPhonePeEditingId(null);
            setInitialTxnId(undefined);
          }}
          truckNo={phonePeTruckNo()}
          defaultCustomerEmail={currentUserEmail}
          defaultCustomerName={currentUserName}
          defaultCustomerPhone={currentUserPhone}
          organizationId={props.organizationId || organizationId}
          coupons={props.coupons}
          onSaveCoupons={(nextCoupons, cpnToSave, cpnIdToDelete) => {
            const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
            if (cpnToSave) {
              appwrite.saveFleetDocument(databaseId, 'coupons', cpnToSave.id, cpnToSave.organizationId || 'org_backend', cpnToSave).catch(() => {});
            }
          }}
          onSuccess={async (paymentDetails) => {
            if (onProcessTruckPayment) {
              await onProcessTruckPayment(phonePePayload(), paymentDetails, phonePeEditingId());
            }
            setShowPhonePeModal(false);
            setPhonePePayload(null);
            setPhonePeEditingId(null);
            setInitialTxnId(undefined);
            resetForm();
            setShowAddForm(false);
          }}
        />
      )}
    </div>
  );
}

interface EditLoanModalProps {
  isOpen: boolean;
  loan: LoanEntry;
  onConfirm: (updatedLoan: LoanEntry) => void;
  onCancel: () => void;
}

function EditLoanModal({ isOpen, loan, onConfirm, onCancel }: EditLoanModalProps) {
  const [loanType, setLoanType] = createSignal(
    ['Chassis Loan', 'Body Loan'].includes(loan.loanType || '') ? (loan.loanType || 'Chassis Loan') : 'Other'
  );
  const [customLoanType, setCustomLoanType] = createSignal(
    ['Chassis Loan', 'Body Loan'].includes(loan.loanType || '') ? '' : (loan.loanType || '')
  );
  const [loanBankName, setLoanBankName] = createSignal(loan.loanBankName || '');
  const [loanStartDate, setLoanStartDate] = createSignal(loan.loanStartDate || '');
  const [loanRegisteredDate, setLoanRegisteredDate] = createSignal(loan.loanRegisteredDate || '');
  const [loanTenureMonths, setLoanTenureMonths] = createSignal<number | ''>(loan.loanTenureMonths || '');
  const [loanEmiAmount, setLoanEmiAmount] = createSignal<number | ''>(loan.loanEmiAmount || '');
  const [loanStatus, setLoanStatus] = createSignal<'Active' | 'Closed'>(loan.loanStatus || 'Active');
  const [loanNotes, setLoanNotes] = createSignal(loan.loanNotes || '');

  if (!isOpen) return null;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!loanStartDate() || !loanEmiAmount() || !loanTenureMonths()) {
      alert("Please fill in Loan Start Date, Tenure, and EMI Amount.");
      return;
    }
    const finalType = loanType() === 'Other' ? (customLoanType().trim() || 'Other Loan') : loanType();
    onConfirm({
      ...loan,
      loanType: finalType,
      loanBankName: loanBankName().trim() || undefined,
      loanStartDate: loanStartDate(),
      loanRegisteredDate: loanRegisteredDate() || loanStartDate(),
      loanTenureMonths: Number(loanTenureMonths()),
      loanEmiAmount: Number(loanEmiAmount()),
      loanStatus: loanStatus(),
      loanNotes: loanNotes().trim() || undefined
    });
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div class="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-800">
        <div class="flex items-center justify-between p-4 border-b border-slate-200">
          <div class="flex items-center gap-2">
            <Landmark class="w-4 h-4 text-blue-600" />
            <h3 class="font-bold text-sm text-slate-900 font-sans uppercase tracking-wider">Edit Loan Details</h3>
          </div>
          <button onClick={onCancel} class="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} class="p-5 space-y-4 text-xs">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Loan Type</label>
              <select
                value={loanType()}
                onChange={(e) => {
                  const val = e.target.value;
                  setLoanType(val);
                  if (val !== 'Other') setCustomLoanType('');
                }}
                class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
              >
                <option value="Chassis Loan">Chassis Loan</option>
                <option value="Body Loan">Body Loan</option>
                <option value="Other">Other Loan</option>
              </select>
            </div>
            {loanType() === 'Other' ? (
              <div>
                <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Custom Loan Type</label>
                <input
                  type="text"
                  placeholder="e.g. Trailer Loan"
                  value={customLoanType()}
                  onChange={(e) => setCustomLoanType(e.target.value)}
                  class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>
            ) : <div />}
            <div>
              <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Lending Institution</label>
              <input
                type="text"
                placeholder="e.g. HDFC Bank"
                value={loanBankName()}
                onChange={(e) => setLoanBankName(e.target.value)}
                class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
              />
            </div>
            <div>
              <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">First EMI Paid Date</label>
              <input
                type="date"
                value={loanStartDate()}
                onChange={(e) => setLoanStartDate(e.target.value)}
                class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Tenure (Months)</label>
              <input
                type="number"
                placeholder="Tenure"
                value={loanTenureMonths()}
                onChange={(e) => setLoanTenureMonths(e.target.value === '' ? '' : Number(e.target.value))}
                class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Monthly EMI</label>
              <input
                type="number"
                placeholder="EMI Amount"
                value={loanEmiAmount()}
                onChange={(e) => setLoanEmiAmount(e.target.value === '' ? '' : Number(e.target.value))}
                class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Registered Date</label>
              <input
                type="date"
                value={loanRegisteredDate()}
                onChange={(e) => setLoanRegisteredDate(e.target.value)}
                class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label class="block text-[9px] font-bold text-slate-550 uppercase mb-1">Status</label>
              <select
                value={loanStatus()}
                onChange={(e) => setLoanStatus(e.target.value as any)}
                class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
              >
                <option value="Active">Active Loan</option>
                <option value="Closed">Closed / Settled</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="block text-[9px] font-bold text-slate-555 uppercase mb-1">Notes / Remarks</label>
              <input
                type="text"
                placeholder="Notes"
                value={loanNotes()}
                onChange={(e) => setLoanNotes(e.target.value)}
                class="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-3 border-t border-slate-100 font-sans">
            <button type="button" onClick={onCancel} class="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">
              Cancel
            </button>
            <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition cursor-pointer">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
