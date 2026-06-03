import React, { useState, useRef, useEffect } from 'react';
import { Truck, TripEntry, ExpenseEntry, getTripMetrics, OrganizationProfile, Account, Driver, ServiceDonePayload, ServiceType, LoanEntry } from '../types';
import { Plus, Edit2, Trash2, Shield, CheckCircle, XCircle, Wrench, Calendar, Settings, X, Loader2, ChevronUp, ChevronDown, FileText, Eye, Landmark, Search } from 'lucide-react';
import { calculateDaysLeft as calculateDaysLeftUtil, formatToDisplayDate } from '../lib/dateUtils';
import { formatTruckNumber } from '../lib/formatUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import ServiceDoneModal from './ServiceDoneModal';
import PayEmiModal from './PayEmiModal';

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
  truckNo: string,
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
  
  // Parse registered date or default to today's date if not specified
  const registeredDateStr = loan.loanRegisteredDate || new Date().toISOString().split('T')[0];
  const regParts = registeredDateStr.split('-');
  const regY = parseInt(regParts[0], 10);
  const regM = parseInt(regParts[1], 10) - 1;
  const regD = parseInt(regParts[2], 10);
  const regDate = new Date(regY, regM, regD);
  regDate.setHours(0,0,0,0);
  
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
  
  let paidInstallments = 0;
  for (let i = 1; i <= tenure; i++) {
    const dueDateStr = dueDates[i-1];
    
    // Check if paid in expenses
    const isPaidInExpenses = expenses.some(e => 
      e.truckNo === truckNo && 
      (e.expenseType === 'Loan EMI' || e.expenseType === 'EMI Payment') && 
      e.status === 'Paid' && 
      e.notes?.includes(dueDateStr) &&
      (loan.id === 'legacy-loan' || !loan.loanType || e.notes?.includes(loan.loanType))
    );
    
    const parts = dueDateStr.split('-');
    const dueD = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const isPast = dueD < regDate;
    
    if (isPaidInExpenses || isPast || dueDateStr === startDateStr) {
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
    const isPaidInExpenses = expenses.some(e => 
      e.truckNo === truckNo && 
      (e.expenseType === 'Loan EMI' || e.expenseType === 'EMI Payment') && 
      e.status === 'Paid' && 
      e.notes?.includes(dueDateStr) &&
      (loan.id === 'legacy-loan' || !loan.loanType || e.notes?.includes(loan.loanType))
    );
    
    const parts = dueDateStr.split('-');
    const dueD = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const isPast = dueD < regDate;
    const isPaid = isPaidInExpenses || isPast || dueDateStr === startDateStr;
    
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
  const loans = getTruckLoans(truck);
  if (loans.length === 0) return null;
  return calculateSingleLoanStats(loans[0], truck.truckNo, expenses);
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
}

export default function TruckMaster({ 
  trucks, 
  trips = [], 
  expenses = [], 
  onAddTruck, 
  onUpdateTruck, 
  onDeleteTruck, 
  confirmAction, 
  canViewTrucks = true,
  canEditTrucks = true,
  canDeleteTrucks = true,
  maxTrucksAllowed = 2,
  onAddTruckRequest,
  organizationId = '',
  orgProfile,
  onServiceDone,
  accounts = [],
  drivers = [],
  onAddExpense,
  canEditLoans = true,
  canDeleteLoans = true,
  canEditExpenses = true,
}: TruckMasterProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingTruckId, setViewingTruckId] = useState<string | null>(null);
  const [expandedTruckId, setExpandedTruckId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'Admin Disabled' | 'Sold'>('All');
  const [serviceDoneTarget, setServiceDoneTarget] = useState<{ truckId: string; truckNo: string; serviceType: ServiceType; currentKM: number; intervalKM: number } | null>(null);
  const [payEmiTarget, setPayEmiTarget] = useState<{ truckNo: string; emiAmount: number; bankName: string; dueDateStr: string; loanType?: string } | null>(null);
  const [editingLoanTarget, setEditingLoanTarget] = useState<{ truck: Truck; loan: LoanEntry } | null>(null);

  // Multiple loan states for edit/add form
  const [loans, setLoans] = useState<LoanEntry[]>([]);
  const [tempLoanType, setTempLoanType] = useState('Chassis Loan');
  const [tempCustomLoanType, setTempCustomLoanType] = useState('');
  const [tempLoanBank, setTempLoanBank] = useState('');
  const [tempLoanStart, setTempLoanStart] = useState('');
  const [tempLoanTenure, setTempLoanTenure] = useState<number | ''>('');
  const [tempLoanEmi, setTempLoanEmi] = useState<number | ''>('');
  const [tempLoanRegisteredDate, setTempLoanRegisteredDate] = useState('');
  const [tempLoanStatus, setTempLoanStatus] = useState<'Active' | 'Closed'>('Active');
  const [tempLoanNotes, setTempLoanNotes] = useState('');

  const handleAddLoanToForm = () => {
    if (!tempLoanStart || !tempLoanEmi || !tempLoanTenure) {
      alert("Please fill in Loan Start Date, Tenure, and EMI Amount.");
      return;
    }
    const finalType = tempLoanType === 'Other' ? (tempCustomLoanType.trim() || 'Other Loan') : tempLoanType;
    const newLoan: LoanEntry = {
      id: 'loan_' + Date.now(),
      loanType: finalType,
      loanBankName: tempLoanBank.trim() || undefined,
      loanStartDate: tempLoanStart,
      loanRegisteredDate: tempLoanRegisteredDate || new Date().toISOString().split('T')[0],
      loanTenureMonths: Number(tempLoanTenure),
      loanEmiAmount: Number(tempLoanEmi),
      loanStatus: tempLoanStatus,
      loanNotes: tempLoanNotes.trim() || undefined
    };
    setLoans([...loans, newLoan]);

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
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY * 1.5;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);
  
  // Base Information
  const [truckNo, setTruckNo] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Admin Disabled' | 'Sold'>('Active');

  // General Specifications
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState('');

  // Loan Specifications
  const [loanStartDate, setLoanStartDate] = useState('');
  const [loanRegisteredDate, setLoanRegisteredDate] = useState('');
  const [loanTenureMonths, setLoanTenureMonths] = useState<number | ''>('');
  const [loanEmiAmount, setLoanEmiAmount] = useState<number | ''>('');
  const [loanBankName, setLoanBankName] = useState('');
  const [loanStatus, setLoanStatus] = useState<'Active' | 'Closed'>('Active');
  const [loanNotes, setLoanNotes] = useState('');
  
  // Tax & Compliance Dates
  const [insuranceDate, setInsuranceDate] = useState('');
  const [fcDate, setFcDate] = useState('');
  const [qTaxDate, setQTaxDate] = useState('');
  const [greenTaxDate, setGreenTaxDate] = useState('');
  const [npTaxDate, setNpTaxDate] = useState('');
  const [fiveYearPermitDate, setFiveYearPermitDate] = useState('');
  
  // Milestones & Readings
  const [currentKM, setCurrentKM] = useState<number | ''>('');
  const [pinpushKM, setPinpushKM] = useState<number | ''>('');
  const [wheelGreaseKM, setWheelGreaseKM] = useState<number | ''>('');
  const [alignmentNextDate, setAlignmentNextDate] = useState('');
  
  // Oil Mileages
  const [engineOilKM, setEngineOilKM] = useState<number | ''>('');
  const [crownOilKM, setCrownOilKM] = useState<number | ''>('');
  const [gearBoxOilKM, setGearBoxOilKM] = useState<number | ''>('');
  const [radiatorKM, setRadiatorKM] = useState<number | ''>('');

  // Custom Service Intervals (per vehicle)
  const [engineOilIntervalKM, setEngineOilIntervalKM] = useState<number | ''>('');
  const [crownOilIntervalKM, setCrownOilIntervalKM] = useState<number | ''>('');
  const [gearBoxOilIntervalKM, setGearBoxOilIntervalKM] = useState<number | ''>('');
  const [radiatorIntervalKM, setRadiatorIntervalKM] = useState<number | ''>('');
  const [pinpushIntervalKM, setPinpushIntervalKM] = useState<number | ''>('');
  const [wheelGreaseIntervalKM, setWheelGreaseIntervalKM] = useState<number | ''>('');

  const [rcFileId, setRcFileId] = useState('');
  const [insuranceFileId, setInsuranceFileId] = useState('');
  const [rcUploading, setRcUploading] = useState(false);
  const [insuranceUploading, setInsuranceUploading] = useState(false);
  const [rcFile, setRcFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRcFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!truckNo.trim()) {
      alert("Please enter the Vehicle Number first before uploading documents so we can name the file properly.");
      e.target.value = '';
      return;
    }
    setRcFile(file);
  };

  const handleInsuranceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!truckNo.trim()) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckNo.trim()) return;

    setIsSubmitting(true);
    let uploadedRcId = rcFileId;
    let uploadedInsuranceId = insuranceFileId;

    try {
      if (rcFile) {
        setRcUploading(true);
        const sanitizedOrgId = (organizationId || 'default').replace(/[^a-zA-Z0-9-]/g, '_');
        const sanitizedTruckNo = truckNo.trim().replace(/[^a-zA-Z0-9-]/g, '_');
        const customName = `${sanitizedOrgId}_RC_${sanitizedTruckNo}`;
        uploadedRcId = await appwrite.uploadFile(rcFile, customName, organizationId);
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
      if (insuranceFile) {
        setInsuranceUploading(true);
        const sanitizedOrgId = (organizationId || 'default').replace(/[^a-zA-Z0-9-]/g, '_');
        const sanitizedTruckNo = truckNo.trim().replace(/[^a-zA-Z0-9-]/g, '_');
        const customName = `${sanitizedOrgId}_INSURANCE_${sanitizedTruckNo}`;
        uploadedInsuranceId = await appwrite.uploadFile(insuranceFile, customName, organizationId);
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


    const approvedCount = trucks.filter(t => t.isApproved !== false).length;
    const limitReached = approvedCount >= maxTrucksAllowed;

    let finalLoans = [...loans];
    if (tempLoanStart && tempLoanEmi && tempLoanTenure) {
      const finalType = tempLoanType === 'Other' ? (tempCustomLoanType.trim() || 'Other Loan') : tempLoanType;
      finalLoans.push({
        id: 'loan_' + Date.now(),
        loanType: finalType,
        loanBankName: tempLoanBank.trim() || undefined,
        loanStartDate: tempLoanStart,
        loanRegisteredDate: tempLoanRegisteredDate || new Date().toISOString().split('T')[0],
        loanTenureMonths: Number(tempLoanTenure),
        loanEmiAmount: Number(tempLoanEmi),
        loanStatus: tempLoanStatus,
        loanNotes: tempLoanNotes.trim() || undefined
      });
    }

    const primaryLoan = finalLoans[0];
    const legacyLoanFields = primaryLoan ? {
      loanStartDate: primaryLoan.loanStartDate || undefined,
      loanRegisteredDate: primaryLoan.loanRegisteredDate || undefined,
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
      truckNo: formatTruckNumber(truckNo),
      ownerName: ownerName || undefined,
      status: limitReached && !isEditing ? 'Inactive' : status,
      make: make || undefined,
      model: model || undefined,
      type: type || undefined,
      insuranceDate: insuranceDate || undefined,
      fcDate: fcDate || undefined,
      pinpushKM: pinpushKM !== '' ? Number(pinpushKM) : undefined,
      wheelGreaseKM: wheelGreaseKM !== '' ? Number(wheelGreaseKM) : undefined,
      alignmentNextDate: alignmentNextDate || undefined,
      qTaxDate: qTaxDate || undefined,
      greenTaxDate: greenTaxDate || undefined,
      npTaxDate: npTaxDate || undefined,
      fiveYearPermitDate: fiveYearPermitDate || undefined,
      currentKM: currentKM !== '' ? Number(currentKM) : undefined,
      engineOilKM: engineOilKM !== '' ? Number(engineOilKM) : undefined,
      crownOilKM: crownOilKM !== '' ? Number(crownOilKM) : undefined,
      gearBoxOilKM: gearBoxOilKM !== '' ? Number(gearBoxOilKM) : undefined,
      radiatorKM: radiatorKM !== '' ? Number(radiatorKM) : undefined,
      engineOilIntervalKM: engineOilIntervalKM !== '' ? Number(engineOilIntervalKM) : undefined,
      crownOilIntervalKM: crownOilIntervalKM !== '' ? Number(crownOilIntervalKM) : undefined,
      gearBoxOilIntervalKM: gearBoxOilIntervalKM !== '' ? Number(gearBoxOilIntervalKM) : undefined,
      radiatorIntervalKM: radiatorIntervalKM !== '' ? Number(radiatorIntervalKM) : undefined,
      pinpushIntervalKM: pinpushIntervalKM !== '' ? Number(pinpushIntervalKM) : undefined,
      wheelGreaseIntervalKM: wheelGreaseIntervalKM !== '' ? Number(wheelGreaseIntervalKM) : undefined,
      rcFileId: uploadedRcId || undefined,
      insuranceFileId: uploadedInsuranceId || undefined,
      ...legacyLoanFields,
      loans: finalLoans
    };

    if (isEditing) {
      onUpdateTruck({
        id: isEditing,
        ...truckPayload
      });
    } else {
      if (limitReached && onAddTruckRequest) {
        onAddTruckRequest(truckPayload);
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
        loanRegisteredDate: truck.loanRegisteredDate || '',
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
    return calculateDaysLeftUtil(dateStr, new Date('2026-05-23'));
  };

  const getExpiryCellProps = (dateStr: string | undefined, days: number | null) => {
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
    if (days <= 30) {
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

  const renderKMLeftBadge = (targetKM?: number, currentKM?: number, interval?: number) => {
    if (targetKM === undefined || currentKM === undefined) return <span className="text-slate-300 italic font-mono">&mdash;</span>;
    const diff = targetKM - currentKM;
    const activeInterval = interval || 15000;
    const lastChanged = targetKM - activeInterval;
    const travelled = currentKM - lastChanged;
    const titleText = `Target Milestone: ${targetKM.toLocaleString()} KM\nActive Interval: ${activeInterval.toLocaleString()} KM\nLast Service Odo: ${lastChanged.toLocaleString()} KM\nDistance Travelled: ${travelled.toLocaleString()} KM`;

    if (diff <= 0) {
      return (
        <span className="flex flex-col text-right font-mono pr-1 animate-pulse" title={titleText}>
          <span className="font-bold text-red-600 text-[11px]">{targetKM.toLocaleString()}</span>
          <span className="text-[9px] font-extrabold text-red-650 tracking-tight leading-none uppercase text-red-600">Due ({Math.abs(diff).toLocaleString()})</span>
        </span>
      );
    } else {
      const isNearDue = diff <= 1000;
      return (
        <span className="flex flex-col text-right font-mono pr-1" title={titleText}>
          <span className={`font-bold text-[11px] ${isNearDue ? 'text-amber-600' : 'text-slate-800'}`}>{targetKM.toLocaleString()}</span>
          <span className={`text-[9px] font-semibold tracking-tight leading-none uppercase ${isNearDue ? 'text-amber-600 font-bold' : 'text-slate-450'}`}>
            ({diff.toLocaleString()} left)
          </span>
        </span>
      );
    }
  };

  const approvedCount = trucks.filter(t => t.isApproved !== false).length;
  const limitReached = approvedCount >= maxTrucksAllowed;

  const activeEngineOilInterval = Number(engineOilIntervalKM) || orgProfile?.engineOilIntervalKM || 15000;
  const activeCrownOilInterval = Number(crownOilIntervalKM) || orgProfile?.crownOilIntervalKM || 40000;
  const activeGearBoxOilInterval = Number(gearBoxOilIntervalKM) || orgProfile?.gearBoxOilIntervalKM || 40000;
  const activeRadiatorInterval = Number(radiatorIntervalKM) || orgProfile?.radiatorIntervalKM || 20000;
  const activePinpushInterval = Number(pinpushIntervalKM) || orgProfile?.pinpushIntervalKM || 5000;
  const activeWheelGreaseInterval = Number(wheelGreaseIntervalKM) || orgProfile?.wheelGreaseIntervalKM || 5000;

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
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-700">{label}</span>
            <span className="font-mono text-slate-400">Not mapped</span>
          </div>
          <div className="text-[10px] text-slate-400 italic">Odometer milestone is not registered in specifications panel.</div>
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
        <div className="flex justify-between text-xs font-semibold mb-1">
          <span className="text-slate-700 font-sans font-semibold">{label}</span>
          <span className="font-mono text-slate-500">
            {current.toLocaleString()}/{targetKM.toLocaleString()} KM
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 relative overflow-hidden" title={`Last Service: ${lastChanged.toLocaleString()} KM\nInterval: ${interval.toLocaleString()} KM\nTravelled: ${travelled.toLocaleString()} KM\nRemaining: ${remaining.toLocaleString()} KM`}>
          <div 
            className={`h-2 rounded-full ${barColor} transition-all duration-300`} 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-slate-405 mt-1 font-sans">
          <span>Last Service: {lastChanged.toLocaleString()} KM</span>
          {remaining <= 0 ? (
            <span className="text-rose-600 font-bold">Overdue by {Math.abs(remaining).toLocaleString()} KM</span>
          ) : (
            <span className={remaining <= 1000 ? 'text-amber-600 font-bold' : ''}>
              {remaining.toLocaleString()} KM left
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderComplianceRow = (label: string, dateStr: string | undefined, days: number | null, fileId: string | undefined) => {
    if (!dateStr) return (
      <div className="flex justify-between items-center py-1">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
      </div>
    );

    let badgeClass = "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30";
    let displayText = `${dateStr} (${days}d left)`;
    if (days !== null) {
      if (days <= 0) {
        badgeClass = "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 font-bold uppercase animate-pulse";
        displayText = `${dateStr} (EXPIRED)`;
      } else if (days <= 30) {
        badgeClass = "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 font-bold";
        displayText = `${dateStr} (${days}d left)`;
      }
    }

    return (
      <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/30 last:border-0 text-xs">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold font-mono ${badgeClass}`}>{displayText}</span>
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
              className="p-1 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 rounded-lg hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
              title="View secure document attachment"
            >
              <FileText className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderLubeProgress = (targetKM: number | undefined, currentKM: number, intervalKM: number, label: string) => {
    if (!targetKM) return (
      <div className="flex justify-between items-center py-1 text-xs">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
        <span className="text-xs text-slate-300 dark:text-slate-650">—</span>
      </div>
    );

    const remaining = targetKM - currentKM;
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
      <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40 space-y-1.5">
        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          <span>{label}</span>
          <span className={textColor}>{remaining <= 0 ? 'Overdue' : `${remaining.toLocaleString()} KM left`}</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${percentage}%` }}></div>
        </div>
        <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-semibold font-mono">
          <span>{currentKM.toLocaleString()} KM</span>
          <span>{targetKM.toLocaleString()} KM</span>
        </div>
      </div>
    );
  };

  const filteredTrucks = trucks.filter(truck => {
    const matchesSearch = truck.truckNo.toLowerCase().includes(searchQuery.toLowerCase().trim());
    const matchesStatus = statusFilter === 'All' || truck.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const allCount = trucks.length;
  const activeCount = trucks.filter(t => t.status === 'Active').length;
  const inactiveCount = trucks.filter(t => t.status === 'Inactive').length;
  const adminDisabledCount = trucks.filter(t => t.status === 'Admin Disabled').length;
  const soldCount = trucks.filter(t => t.status === 'Sold').length;

  return (
    <div id="truck-master-panel" className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <span>Truck Datasheet & Compliance Ledger</span>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full text-[10px]">
              Registered: {approvedCount} / Limit: {maxTrucksAllowed}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Maintain complete mechanical, oil milestone readings, green taxes, fitness certifications and active compliance logs.</p>
        </div>
        {canEditTrucks && (
          <button
            id="btn-add-truck"
            onClick={() => {
              if (showAddForm) resetForm();
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-150 shadow-sm text-xs cursor-pointer"
          >
            {showAddForm ? 'Close Specification Panel' : (
              <>
                <Plus className="w-3.5 h-3.5" /> {limitReached ? 'Request Truck Activation' : 'Add/Edit Truck Specs'}
              </>
            )}
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 overflow-auto animate-fade-in" id="truck-form-backdrop">
          <form id="truck-form" onSubmit={handleSubmit} className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto text-left">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-850 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide">
                  {isEditing ? 'Modify Fleet Information' : limitReached ? 'Request Truck Activation' : 'Register Vehicle & Technical Specs'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={resetForm}
                className="p-1.5 hover:bg-slate-105 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 rounded-xl transition cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {limitReached && !isEditing && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-800 dark:text-amber-400 text-xs flex gap-2">
                <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Truck Registration Limit Reached ({approvedCount} / {maxTrucksAllowed} Free Allowed)</p>
                  <p className="mt-0.5 text-[11px]">Saving this truck will submit a pending approval request to the backend team. Once approved, the truck will become active and visible across your management sheets.</p>
                </div>
              </div>
            )}

          {/* SECTION 1: Core Mechanics */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">1. Core Vehicle Specs</span>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label htmlFor="input-truck-no" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Vehicle No <span className="text-red-500">*</span></label>
                <input
                  id="input-truck-no"
                  type="text"
                  placeholder="e.g. MH-12-PQ-4532"
                  value={truckNo}
                  onChange={(e) => setTruckNo(formatTruckNumber(e.target.value))}
                  required
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 uppercase font-mono font-bold"
                />
              </div>
              <div>
                <label htmlFor="input-make" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Manufacturer / Make</label>
                <select
                  id="input-make"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">-- Choose Make --</option>
                  <option value="Ashok Leyland">Ashok Leyland</option>
                  <option value="TATA">TATA</option>
                  {make && make !== 'Ashok Leyland' && make !== 'TATA' && (
                    <option value={make}>{make}</option>
                  )}
                </select>
              </div>
              <div>
                <label htmlFor="input-model" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Model / Horsepower</label>
                <input
                  id="input-model"
                  type="text"
                  placeholder="e.g. LPT 3118, 5525"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="input-type" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Trailer Type</label>
                <select
                  id="input-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">-- Choose Type --</option>
                  <option value="12 Wheeler">12 Wheeler</option>
                  <option value="14 Wheeler">14 Wheeler</option>
                  <option value="16 Wheeler">16 Wheeler</option>
                  {type && type !== '12 Wheeler' && type !== '14 Wheeler' && type !== '16 Wheeler' && (
                    <option value={type}>{type}</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: Compliance Certificates Dates */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">2. Taxes & Compliance Validity Dates</span>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Insurance Expiry</label>
                <input
                  type="date"
                  value={insuranceDate}
                  onChange={(e) => setInsuranceDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Fitness Cert (FC)</label>
                <input
                  type="date"
                  value={fcDate}
                  onChange={(e) => setFcDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Quarterly Tax (Q Tax)</label>
                <input
                  type="date"
                  value={qTaxDate}
                  onChange={(e) => setQTaxDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Green Tax Cert</label>
                <input
                  type="date"
                  value={greenTaxDate}
                  onChange={(e) => setGreenTaxDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">National Permit Tax</label>
                <input
                  type="date"
                  value={npTaxDate}
                  onChange={(e) => setNpTaxDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">5 Year Permit Date</label>
                <input
                  type="date"
                  value={fiveYearPermitDate}
                  onChange={(e) => setFiveYearPermitDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Technical Mileage Readings */}
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">3. Odometer Readings & Mechanical Spares Target Limits (KM)</span>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label htmlFor="input-current-km" className="block text-[9px] font-bold text-blue-700 bg-blue-50 px-1 py-0.5 rounded inline-block uppercase mb-1">Current Odo KM <span className="text-red-500">*</span></label>
                <input
                  id="input-current-km"
                  type="number"
                  placeholder="e.g. 154000"
                  value={currentKM}
                  onChange={(e) => setCurrentKM(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  className="w-full bg-white border border-blue-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Pinpush Grease KM</label>
                <input
                  type="number"
                  placeholder="Limit"
                  value={pinpushKM}
                  onChange={(e) => setPinpushKM(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Wheel Grease KM</label>
                <input
                  type="number"
                  placeholder="Limit"
                  value={wheelGreaseKM}
                  onChange={(e) => setWheelGreaseKM(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Alignment Next Date</label>
                <input
                  type="date"
                  value={alignmentNextDate}
                  onChange={(e) => setAlignmentNextDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Owner Name</label>
                <input
                  type="text"
                  placeholder="Owner / Vendor Name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1 text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Oil Mileage Milestones */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Engine Oil Change */}
              <div className="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label htmlFor="input-engine-oil-km" className="block text-[9px] font-extrabold text-slate-550 uppercase mb-1">Engine Oil KM Limit</label>
                  <input
                    id="input-engine-oil-km"
                    type="number"
                    placeholder="Future KM"
                    value={engineOilKM}
                    onChange={(e) => setEngineOilKM(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const odo = currentKM !== '' ? Number(currentKM) : 0;
                      setEngineOilKM(odo + activeEngineOilInterval);
                    }}
                    className="mt-1 text-[9px] text-blue-600 hover:text-blue-800 font-semibold block text-left"
                  >
                    ✨ Set next due (Odo + {activeEngineOilInterval} KM)
                  </button>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Custom Interval (KM)</label>
                  <input
                    type="number"
                    placeholder={`Uses Org Default: ${(orgProfile?.engineOilIntervalKM || 15000).toLocaleString()} KM`}
                    value={engineOilIntervalKM}
                    onChange={(e) => setEngineOilIntervalKM(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Crown Oil */}
              <div className="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label htmlFor="input-crown-oil-km" className="block text-[9px] font-extrabold text-slate-550 uppercase mb-1">Crown Oil KM Limit</label>
                  <input
                    id="input-crown-oil-km"
                    type="number"
                    placeholder="Future KM"
                    value={crownOilKM}
                    onChange={(e) => setCrownOilKM(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const odo = currentKM !== '' ? Number(currentKM) : 0;
                      setCrownOilKM(odo + activeCrownOilInterval);
                    }}
                    className="mt-1 text-[9px] text-blue-600 hover:text-blue-800 font-semibold block text-left"
                  >
                    ✨ Set next due (Odo + {activeCrownOilInterval} KM)
                  </button>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Custom Interval (KM)</label>
                  <input
                    type="number"
                    placeholder={`Uses Org Default: ${(orgProfile?.crownOilIntervalKM || 40000).toLocaleString()} KM`}
                    value={crownOilIntervalKM}
                    onChange={(e) => setCrownOilIntervalKM(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Gear Box Oil */}
              <div className="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label htmlFor="input-gear-box-oil-km" className="block text-[9px] font-extrabold text-slate-555 uppercase mb-1">Gear Box Oil KM Limit</label>
                  <input
                    id="input-gear-box-oil-km"
                    type="number"
                    placeholder="Future KM"
                    value={gearBoxOilKM}
                    onChange={(e) => setGearBoxOilKM(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const odo = currentKM !== '' ? Number(currentKM) : 0;
                      setGearBoxOilKM(odo + activeGearBoxOilInterval);
                    }}
                    className="mt-1 text-[9px] text-blue-600 hover:text-blue-800 font-semibold block text-left"
                  >
                    ✨ Set next due (Odo + {activeGearBoxOilInterval} KM)
                  </button>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Custom Interval (KM)</label>
                  <input
                    type="number"
                    placeholder={`Uses Org Default: ${(orgProfile?.gearBoxOilIntervalKM || 40000).toLocaleString()} KM`}
                    value={gearBoxOilIntervalKM}
                    onChange={(e) => setGearBoxOilIntervalKM(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Radiator Service */}
              <div className="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label htmlFor="input-radiator-km" className="block text-[9px] font-extrabold text-slate-555 uppercase mb-1">Radiator Coolant KM</label>
                  <input
                    id="input-radiator-km"
                    type="number"
                    placeholder="Future KM"
                    value={radiatorKM}
                    onChange={(e) => setRadiatorKM(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const odo = currentKM !== '' ? Number(currentKM) : 0;
                      setRadiatorKM(odo + activeRadiatorInterval);
                    }}
                    className="mt-1 text-[9px] text-blue-600 hover:text-blue-800 font-semibold block text-left"
                  >
                    ✨ Set next due (Odo + {activeRadiatorInterval} KM)
                  </button>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Custom Interval (KM)</label>
                  <input
                    type="number"
                    placeholder={`Uses Org Default: ${(orgProfile?.radiatorIntervalKM || 20000).toLocaleString()} KM`}
                    value={radiatorIntervalKM}
                    onChange={(e) => setRadiatorIntervalKM(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Pinpush Grease */}
              <div className="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label htmlFor="input-pinpush-km" className="block text-[9px] font-extrabold text-slate-555 uppercase mb-1">Pinpush Grease KM Limit</label>
                  <input
                    id="input-pinpush-km"
                    type="number"
                    placeholder="Future KM"
                    value={pinpushKM}
                    onChange={(e) => setPinpushKM(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const odo = currentKM !== '' ? Number(currentKM) : 0;
                      setPinpushKM(odo + activePinpushInterval);
                    }}
                    className="mt-1 text-[9px] text-blue-600 hover:text-blue-800 font-semibold block text-left"
                  >
                    ✨ Set next due (Odo + {activePinpushInterval.toLocaleString()} KM)
                  </button>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Custom Interval (KM)</label>
                  <input
                    type="number"
                    placeholder={`Uses Org Default: ${(orgProfile?.pinpushIntervalKM || 5000).toLocaleString()} KM`}
                    value={pinpushIntervalKM}
                    onChange={(e) => setPinpushIntervalKM(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Wheel Grease */}
              <div className="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label htmlFor="input-wheel-grease-km" className="block text-[9px] font-extrabold text-slate-555 uppercase mb-1">Wheel Grease KM Limit</label>
                  <input
                    id="input-wheel-grease-km"
                    type="number"
                    placeholder="Future KM"
                    value={wheelGreaseKM}
                    onChange={(e) => setWheelGreaseKM(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const odo = currentKM !== '' ? Number(currentKM) : 0;
                      setWheelGreaseKM(odo + activeWheelGreaseInterval);
                    }}
                    className="mt-1 text-[9px] text-blue-600 hover:text-blue-800 font-semibold block text-left"
                  >
                    ✨ Set next due (Odo + {activeWheelGreaseInterval.toLocaleString()} KM)
                  </button>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Custom Interval (KM)</label>
                  <input
                    type="number"
                    placeholder={`Uses Org Default: ${(orgProfile?.wheelGreaseIntervalKM || 5000).toLocaleString()} KM`}
                    value={wheelGreaseIntervalKM}
                    onChange={(e) => setWheelGreaseIntervalKM(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* SECTION 3.5: Loan & EMI Settings */}
              <div className="col-span-full border-t border-slate-200 pt-3">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">3.5 Loan & EMI Settings (Multiple Loans Supported)</span>
                
                {/* List of current loans in form */}
                {loans.length > 0 && (
                  <div className="mb-3 overflow-x-auto border border-slate-200 rounded-lg bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[9px] font-extrabold text-slate-500 uppercase">
                        <tr>
                          <th className="p-2 pl-3">Type</th>
                          <th className="p-2">Bank</th>
                          <th className="p-2">First EMI Paid Date</th>
                          <th className="p-2">Tenure</th>
                          <th className="p-2 font-mono">EMI</th>
                          <th className="p-2">Status</th>
                          <th className="p-2 text-right pr-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {loans.map((l, index) => (
                          <tr key={l.id || index} className="hover:bg-slate-50/50">
                            <td className="p-2 pl-3 text-slate-800 font-bold">{l.loanType || 'General Loan'}</td>
                            <td className="p-2">{l.loanBankName || '—'}</td>
                            <td className="p-2 font-mono">{l.loanStartDate || '—'}</td>
                            <td className="p-2 font-mono">{l.loanTenureMonths ? `${l.loanTenureMonths} Mos` : '—'}</td>
                            <td className="p-2 font-mono text-blue-600">₹{l.loanEmiAmount?.toLocaleString('en-IN') || 0}</td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${l.loanStatus === 'Closed' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'}`}>
                                {l.loanStatus || 'Active'}
                              </span>
                            </td>
                            <td className="p-2 text-right pr-3">
                              {canDeleteLoans && (
                                <button
                                  type="button"
                                  onClick={() => setLoans(loans.filter((_, idx) => idx !== index))}
                                  className="text-rose-600 hover:text-rose-800 text-[10px] font-bold cursor-pointer"
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
                  <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-3 space-y-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Add a Loan Entry</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 mb-1">Loan Type</label>
                        <select
                          value={tempLoanType}
                          onChange={(e) => setTempLoanType(e.target.value)}
                          className="w-full bg-white border border-slate-250 text-slate-850 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                        >
                          <option value="Chassis Loan">Chassis Loan</option>
                          <option value="Body Loan">Body Loan</option>
                          <option value="Other">Other Loan</option>
                        </select>
                      </div>
                      {tempLoanType === 'Other' && (
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 mb-1">Custom Type Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Body Building"
                            value={tempCustomLoanType}
                            onChange={(e) => setTempCustomLoanType(e.target.value)}
                            className="w-full bg-white border border-slate-200 text-slate-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 mb-1">Bank Name</label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC Bank"
                          value={tempLoanBank}
                          onChange={(e) => setTempLoanBank(e.target.value)}
                          className="w-full bg-white border border-slate-200 text-slate-850 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 mb-1">First EMI Paid Date</label>
                        <input
                          type="date"
                          value={tempLoanStart}
                          onChange={(e) => setTempLoanStart(e.target.value)}
                          className="w-full bg-white border border-slate-200 text-slate-850 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 mb-1">Tenure (Months)</label>
                        <input
                          type="number"
                          placeholder="Tenure"
                          value={tempLoanTenure}
                          onChange={(e) => setTempLoanTenure(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 text-slate-850 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 mb-1">Monthly EMI</label>
                        <input
                          type="number"
                          placeholder="EMI Amount"
                          value={tempLoanEmi}
                          onChange={(e) => setTempLoanEmi(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 text-slate-850 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 mb-1">Registered Date</label>
                        <input
                          type="date"
                          value={tempLoanRegisteredDate}
                          onChange={(e) => setTempLoanRegisteredDate(e.target.value)}
                          placeholder="Defaults to Start Date"
                          className="w-full bg-white border border-slate-200 text-slate-850 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1">
                      <div className="flex gap-4">
                        <div>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tempLoanStatus === 'Closed'}
                              onChange={(e) => setTempLoanStatus(e.target.checked ? 'Closed' : 'Active')}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Mark Closed</span>
                          </label>
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Loan Notes / Remarks"
                            value={tempLoanNotes}
                            onChange={(e) => setTempLoanNotes(e.target.value)}
                            className="bg-white border border-slate-205 text-slate-805 rounded px-2 py-1 text-xs w-64 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddLoanToForm}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-3 py-1.5 rounded transition cursor-pointer"
                      >
                        Add Loan
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-[11px] p-2 bg-slate-50 border border-slate-200 rounded-lg">
                    You do not have permissions to modify loan details.
                  </p>
                )}
              </div>

              {/* SECTION 4: Upload Documents */}
              <div className="col-span-full border-t border-slate-200 pt-3">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2.5">4. Compliance Document Uploads (Optional)</span>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">RC Document File</label>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                      <input
                        key={rcFileId ? 'has-file' : 'no-file'}
                        type="file"
                        onChange={handleRcFileChange}
                        disabled={rcUploading || isSubmitting || !isAppwriteConfigured()}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
                      />
                      {rcUploading && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                      {!rcUploading && (rcFile || rcFileId) && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <CheckCircle className="w-4 h-4 text-emerald-600" title={rcFile ? `Queued: ${rcFile.name}` : "Document linked"} />
                          <button
                            type="button"
                            onClick={() => {
                              setRcFile(null);
                              setRcFileId('');
                            }}
                            className="text-[9px] text-red-500 font-bold hover:underline cursor-pointer"
                            title="Remove file document"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                    {!isAppwriteConfigured() && (
                      <span className="text-[9px] text-amber-500 font-semibold block mt-0.5">Appwrite bucket connection required for document uploads.</span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Insurance Certificate File</label>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                      <input
                        key={insuranceFileId ? 'has-file' : 'no-file'}
                        type="file"
                        onChange={handleInsuranceFileChange}
                        disabled={insuranceUploading || isSubmitting || !isAppwriteConfigured()}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
                      />
                      {insuranceUploading && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                      {!insuranceUploading && (insuranceFile || insuranceFileId) && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <CheckCircle className="w-4 h-4 text-emerald-600" title={insuranceFile ? `Queued: ${insuranceFile.name}` : "Document linked"} />
                          <button
                            type="button"
                            onClick={() => {
                              setInsuranceFile(null);
                              setInsuranceFileId('');
                            }}
                            className="text-[9px] text-red-500 font-bold hover:underline cursor-pointer"
                            title="Remove file document"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                    {!isAppwriteConfigured() && (
                      <span className="text-[9px] text-amber-500 font-semibold block mt-0.5">Appwrite bucket connection required for document uploads.</span>
                    )}
                  </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Operational Status</label>
                <select
                  disabled={status === 'Admin Disabled' || (isEditing !== null && trucks.find(t => t.id === isEditing)?.isApproved === false) || (isEditing === null && limitReached) || isSubmitting}
                  value={limitReached && !isEditing ? 'Inactive' : status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none disabled:opacity-50"
                >
                  {status === 'Admin Disabled' && (
                    <option value="Admin Disabled">Admin Disabled (Locked)</option>
                  )}
                  <option value="Active">Operational (Active)</option>
                  <option value="Inactive">Under Maintenance (Inactive)</option>
                  <option value="Sold">Sold</option>
                </select>
                {limitReached && !isEditing && (
                  <span className="text-[9px] text-amber-500 font-semibold block mt-0.5">Pending approval vehicles are inactive by default</span>
                )}
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Registration Expiry (Read-only)</label>
                <input
                  type="text"
                  disabled
                  value={
                    isEditing 
                      ? trucks.find(t => t.id === isEditing)?.registrationExpiryDate || '1 Year Cycle'
                      : 'Auto-set (1 Year)'
                  }
                  className="w-full bg-slate-100 border border-slate-205 text-slate-500 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none font-mono font-semibold"
                />
              </div>
            </div>

          <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={resetForm}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-810 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isSubmitting 
                ? 'Uploading & Saving...' 
                : (isEditing ? 'Save Specification Updates' : limitReached ? 'Submit Activation Request' : 'Add Truck Specs')}
            </button>
          </div>
        </form>
      </div>
      )}
      {/* SEARCH AND FILTER TOOLBAR */}
      <div className="bg-slate-50 dark:bg-slate-900/40 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search Input Box */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search by Vehicle Number (e.g. MH-12)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono tracking-wider animate-fade-in"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Operational Status Filters Tabs */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Filter Status:</span>
          
          {/* ALL Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
              statusFilter === 'All'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
              statusFilter === 'All' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>{allCount}</span>
          </button>

          {/* ACTIVE Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('Active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
              statusFilter === 'Active'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
            <span>Active</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
              statusFilter === 'Active' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>{activeCount}</span>
          </button>

          {/* INACTIVE Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('Inactive')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
              statusFilter === 'Inactive'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-450 shrink-0"></span>
            <span>Under Maintenance</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
              statusFilter === 'Inactive' ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>{inactiveCount}</span>
          </button>

          {/* ADMIN DISABLED Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('Admin Disabled')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
              statusFilter === 'Admin Disabled'
                ? 'bg-red-650 text-white border-red-650 shadow-sm'
                : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse"></span>
            <span>Admin Blocked</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
              statusFilter === 'Admin Disabled' ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>{adminDisabledCount}</span>
          </button>

          {/* SOLD Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('Sold')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 border cursor-pointer ${
              statusFilter === 'Sold'
                ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>
            <span>Sold</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
              statusFilter === 'Sold' ? 'bg-slate-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>{soldCount}</span>
          </button>
        </div>
      </div>

      {/* BEAUTIFUL HIGH-DENSITY GRID OF FLEET COMPLIANCE CARDS */}
      {trucks.length === 0 ? (
        <div className="text-center py-12 text-slate-400 font-medium italic border border-slate-200 rounded-xl bg-slate-50/50">
          No operational vehicles registered in the system database.
        </div>
      ) : filteredTrucks.length === 0 ? (
        <div className="text-center py-12 text-slate-400 font-medium italic border border-slate-200 rounded-xl bg-slate-50/50">
          No vehicles found matching search query "{searchQuery}" or selected status filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrucks.map((truck) => {
            const insDays = calculateDaysLeft(truck.insuranceDate);
            const fcDays = calculateDaysLeft(truck.fcDate);
            const aliDays = calculateDaysLeft(truck.alignmentNextDate);
            const qDays = calculateDaysLeft(truck.qTaxDate);
            const gDays = calculateDaysLeft(truck.greenTaxDate);
            const npDays = calculateDaysLeft(truck.npTaxDate);
            const fvDays = calculateDaysLeft(truck.fiveYearPermitDate);
            const regDays = calculateDaysLeft(truck.registrationExpiryDate);

            const isExpanded = expandedTruckId === truck.id;

            return (
              <div
                key={truck.id}
                id={`card-truck-${truck.id}`}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between group/card relative"
              >
                <div>
                  {/* Top Row: Vehicle No + Status Badges */}
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 text-blue-600 dark:text-blue-400">
                          <Shield className={`w-4 h-4 ${truck.isApproved === false ? 'text-amber-500 animate-pulse' : 'text-blue-500'}`} />
                        </span>
                        <h4
                          onClick={() => truck.isApproved !== false && setViewingTruckId(truck.id)}
                          className={`font-mono font-extrabold text-sm tracking-wider text-slate-900 dark:text-white cursor-pointer select-all select-none hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${truck.isApproved !== false ? "underline decoration-dotted decoration-blue-400" : ""}`}
                          title={truck.isApproved !== false ? "Click to view detailed financials & performance logs" : "Pending approval by Backend Team."}
                        >
                          {truck.truckNo}
                        </h4>
                        {truck.loanStartDate && truck.loanEmiAmount && truck.loanStatus !== 'Closed' && (
                          <Landmark className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-pulse" title={`Active loan with ${truck.loanBankName || 'bank'}`} />
                        )}
                      </div>
                      
                      {truck.isApproved === false && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider max-w-max ${
                          truck.requestStatus === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/30'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/30'
                        }`}>
                          {truck.requestStatus === 'Rejected' ? 'Rejected' : 'Pending Approval'}
                        </span>
                      )}
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                      truck.status === 'Active' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30' 
                        : truck.status === 'Admin Disabled'
                          ? 'bg-red-50 text-red-700 border border-red-200 font-extrabold animate-pulse dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/30'
                          : truck.status === 'Sold'
                            ? 'bg-slate-100 text-slate-700 border border-slate-350 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${truck.status === 'Active' ? 'bg-emerald-500 animate-pulse' : truck.status === 'Sold' ? 'bg-slate-405' : 'bg-rose-500'}`}></span>
                      {truck.status === 'Active' ? 'Active' : truck.status === 'Admin Disabled' ? 'Admin Disabled' : truck.status === 'Sold' ? 'Sold' : 'Inactive'}
                    </span>
                  </div>

                  {/* Core Technical Specifications Banner */}
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1 mb-4 border-b border-slate-100 dark:border-slate-800/30 pb-3">
                    {truck.make && (
                      <span className="flex items-center gap-1">
                        <strong className="text-slate-450 uppercase text-[9px]">Make:</strong>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{truck.make}</span>
                      </span>
                    )}
                    {truck.model && (
                      <span className="flex items-center gap-1">
                        <strong className="text-slate-450 uppercase text-[9px]">Model:</strong>
                        <span className="font-mono text-slate-700 dark:text-slate-300">{truck.model}</span>
                      </span>
                    )}
                    {truck.type && (
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded font-bold text-[8px] uppercase tracking-wider">
                        {truck.type}
                      </span>
                    )}
                    {truck.ownerName && (
                      <span className="flex items-center gap-1 w-full mt-1">
                        <strong className="text-slate-450 uppercase text-[9px]">Owner/Vendor:</strong>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{truck.ownerName}</span>
                      </span>
                    )}
                  </div>

                  {/* Current Odometer Status Badge */}
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850 rounded-xl mb-4 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Current Odometer:</span>
                    <span className="font-mono font-extrabold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
                      {truck.currentKM ? truck.currentKM.toLocaleString() : '0'} KM
                    </span>
                  </div>

                  {/* Taxes & Validity Compliance Logs */}
                  <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-850 rounded-xl p-3.5 space-y-2 mb-4">
                    <h5 className="text-[9px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1 pb-1 border-b border-slate-200/35 dark:border-slate-800/10">Compliance Certifications</h5>
                    {renderComplianceRow('Insurance', truck.insuranceDate, insDays, truck.insuranceFileId)}
                    {renderComplianceRow('Fitness Cert (FC)', truck.fcDate, fcDays, undefined)}
                    {renderComplianceRow('National Permit', truck.npTaxDate, npDays, undefined)}
                    {renderComplianceRow('5Y Permit Date', truck.fiveYearPermitDate, fvDays, undefined)}
                    {renderComplianceRow('Q Tax validity', truck.qTaxDate, qDays, undefined)}
                    {renderComplianceRow('Green Tax Cert', truck.greenTaxDate, gDays, undefined)}
                    {renderComplianceRow('NP Tax Validity', truck.npTaxDate, npDays, undefined)}
                    {renderComplianceRow('Reg Expiry validity', truck.registrationExpiryDate, regDays, undefined)}
                  </div>

                  {/* Active Loan summary banner if present */}
                  {truck.loanStartDate && truck.loanEmiAmount && (
                    <div className="bg-amber-50/30 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-xl p-3.5 mb-4 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px] flex items-center gap-1.5">
                          <Landmark className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>EMI Loan ({truck.loanStatus || 'Active'})</span>
                        </span>
                        <span className="font-extrabold text-[11px] text-slate-900 dark:text-white font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                          ₹{Number(truck.loanEmiAmount).toLocaleString('en-IN')} /mo
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Lubes Spares & Oils progress toggles */}
                  <div className="border border-slate-200/60 dark:border-slate-850 rounded-xl p-3 bg-white dark:bg-slate-900 shadow-sm mb-4">
                    <button
                      type="button"
                      onClick={() => setExpandedTruckId(isExpanded ? null : truck.id)}
                      className="w-full text-center text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1.5 cursor-pointer hover:underline"
                    >
                      <span>{isExpanded ? 'Hide' : 'View'} Mechanical & Oils Milestones</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800 grid grid-cols-1 gap-3 animate-fade-in">
                        {renderLubeProgress(truck.engineOilKM, truck.currentKM || 0, truck.engineOilIntervalKM || orgProfile?.engineOilIntervalKM || 15000, 'Engine Oil Change')}
                        {renderLubeProgress(truck.crownOilKM, truck.currentKM || 0, truck.crownOilIntervalKM || orgProfile?.crownOilIntervalKM || 40000, 'Crown Oil Change')}
                        {renderLubeProgress(truck.gearBoxOilKM, truck.currentKM || 0, truck.gearBoxOilIntervalKM || orgProfile?.gearBoxOilIntervalKM || 40000, 'Gear Box Oil Change')}
                        {renderLubeProgress(truck.radiatorKM, truck.currentKM || 0, truck.radiatorIntervalKM || orgProfile?.radiatorIntervalKM || 20000, 'Radiator Coolant Service')}
                        
                        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/40 text-[10px] text-slate-500 dark:text-slate-400">
                          <div>
                            <span className="block font-bold text-slate-400 uppercase text-[9px] mb-0.5">Pinpush Grease KM</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-350">{truck.pinpushKM ? `${truck.pinpushKM.toLocaleString()} KM` : '—'}</span>
                          </div>
                          <div>
                            <span className="block font-bold text-slate-400 uppercase text-[9px] mb-0.5">Wheel Grease KM</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-350">{truck.wheelGreaseKM ? `${truck.wheelGreaseKM.toLocaleString()} KM` : '—'}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="block font-bold text-slate-400 uppercase text-[9px] mb-0.5">Alignment Next Date</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-350">{truck.alignmentNextDate ? `${truck.alignmentNextDate} (${aliDays !== null ? `${aliDays}d` : ''})` : '—'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Documents View links */}
                  {(truck.rcFileId || truck.insuranceFileId) && (
                    <div className="flex flex-wrap gap-2 mb-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-850 p-2 rounded-xl">
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
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-450 font-semibold text-[10px] rounded-lg hover:bg-blue-100/50 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
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
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-455 font-semibold text-[10px] rounded-lg hover:bg-indigo-100/50 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Insurance Spec</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Actions Row */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 dark:border-slate-800/40 mt-auto">
                  <button
                    type="button"
                    onClick={() => truck.isApproved !== false && setViewingTruckId(truck.id)}
                    disabled={truck.isApproved === false}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 hover:text-slate-900 dark:text-slate-350 dark:hover:text-white transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-[10px] font-bold"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>Financials</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canEditTrucks || truck.isApproved === false}
                    onClick={() => startEdit(truck)}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 hover:text-slate-900 dark:text-slate-350 dark:hover:text-white transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-[10px] font-bold"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edit Specs</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canDeleteTrucks}
                    onClick={() => {
                      const msg = `Caution! Are you sure you want to permanently delete vehicle entry ${truck.truckNo}? This will delete all compliance records.`;
                      if (confirmAction) {
                        confirmAction(msg, () => onDeleteTruck(truck.id), "Delete Vehicle Database Record");
                      } else if (confirm(msg)) {
                        onDeleteTruck(truck.id);
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-rose-150 bg-rose-50/20 hover:bg-rose-50/50 text-rose-600 hover:text-rose-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-[10px] font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VEHICLE METRICS & FINANCIAL PERFORMANCE DRAWER (FLYOUT) */}
      {viewingTruckId && (() => {
        const truck = trucks.find(t => t.id === viewingTruckId);
        if (!truck) return null;

        const truckTrips = trips.filter(t => t.truckNo === truck.truckNo);
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
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fade-in" id="truck-finance-flyout-backdrop">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
              onClick={() => setViewingTruckId(null)}
            />

            {/* Panel */}
            <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200" id="truck-finance-flyout-panel">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-700 shadow-3xs">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 font-mono tracking-wider">{truck.truckNo}</h2>
                    <p className="text-xs text-slate-500 font-medium">
                      {(truck.make || truck.model) ? `${truck.make} ${truck.model}` : 'Specification Audit Leaflet'}{truck.type ? ` • ${truck.type}` : ''}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingTruckId(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-250 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="overflow-y-auto flex-1 p-5 space-y-6">
                
                {/* Section A: Live Financial Ledger Card */}
                <div className="bg-slate-900 text-white rounded-xl p-5 shadow-lg relative overflow-hidden">
                  <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
                    <Shield className="w-40 h-40" />
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">Net Asset Profit/Loss</span>
                      <span className={`text-2xl font-black mt-1 block tracking-tight font-sans ${netEarnings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {netEarnings >= 0 ? '+' : ''}₹{netEarnings.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${netEarnings >= 0 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'}`}>
                      {profitMargin.toFixed(1)}% Margin
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/10 text-center">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold block">Total Revenue</span>
                      <span className="text-xs font-bold mt-1 block text-slate-100 font-mono">₹{totalRevenue.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold block">Total Expenses</span>
                      <span className="text-xs font-bold mt-1 block text-slate-100 font-mono">₹{overallExpenses.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold block text-amber-300">Outstanding</span>
                      <span className="text-xs font-bold mt-1 block text-amber-300 font-mono">₹{outstandingReceivables.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Section B: Income & Expense Statement breakdown */}
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5">Profit & Loss Breakdown</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                    <div className="p-3 flex justify-between items-center text-xs font-medium">
                      <span className="text-slate-500">Total Transport Ventures ({totalTrips} Trips)</span>
                      <span className="font-semibold text-emerald-600 font-mono">+₹{totalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="p-3 flex justify-between items-center text-xs font-medium">
                      <span className="text-slate-500">Trip Specific Running costs</span>
                      <span className="font-semibold text-rose-500 font-mono">-₹{(totalTripExpenses - fuelSpent - wagesPaid).toLocaleString()}</span>
                    </div>
                    <div className="p-3 flex justify-between items-center text-xs font-medium">
                      <span className="text-slate-500">High density Fuel Consumption spends</span>
                      <span className="font-semibold text-rose-500 font-mono">-₹{fuelSpent.toLocaleString()}</span>
                    </div>
                    <div className="p-3 flex justify-between items-center text-xs font-medium">
                      <span className="text-slate-500">Driver Wages & Commissions</span>
                      <span className="font-semibold text-rose-500 font-mono">-₹{wagesPaid.toLocaleString()}</span>
                    </div>
                    <div className="p-3 flex justify-between items-center text-xs font-medium bg-slate-50/50">
                      <span className="text-slate-500">General Ledger Vouchers ({truckExpenses.length} entries)</span>
                      <span className="font-semibold text-rose-500 font-mono">-₹{totalGeneralExpenses.toLocaleString()}</span>
                    </div>
                    <div className="p-3 flex justify-between items-center text-xs font-bold bg-slate-50">
                      <span className="text-slate-800">Net Calculated Return</span>
                      <span className={`font-mono ${netEarnings >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                    <div className="space-y-4">
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                        <Landmark className="w-4 h-4 text-blue-600" />
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
                          <div key={loan.id || idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3 shadow-3xs hover:shadow-2xs transition">
                            <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5 mb-1">
                              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                {loan.loanType || 'General Loan'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${loan.loanStatus === 'Closed' ? 'bg-slate-200 text-slate-600' : 'bg-blue-50 text-blue-700'}`}>
                                  {loan.loanStatus || 'Active'}
                                </span>
                                {canEditLoans && (
                                  <button
                                    type="button"
                                    onClick={handleEditLoan}
                                    className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-slate-100 transition cursor-pointer"
                                    title="Edit Loan"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                )}
                                {canDeleteLoans && (
                                  <button
                                    type="button"
                                    onClick={handleDeleteLoan}
                                    className="text-rose-600 hover:text-rose-805 p-0.5 rounded hover:bg-slate-100 transition cursor-pointer"
                                    title="Delete Loan"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <span className="text-slate-400 font-bold uppercase text-[9px] block">Lending Institution</span>
                                <span className="font-semibold text-slate-800">{loan.loanBankName || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold uppercase text-[9px] block">Total Loan & Interest</span>
                                <span className="font-semibold text-slate-850">
                                  ₹{((loan.loanTenureMonths || 0) * (loan.loanEmiAmount || 0)).toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-bold uppercase text-[9px] block">First EMI Date & Tenure</span>
                                <span className="font-semibold text-slate-800">{loan.loanStartDate} ({loan.loanTenureMonths} Months)</span>
                              </div>
                              {loan.loanRegisteredDate && (
                                <div className="col-span-3 border-t border-slate-200/40 pt-1">
                                  <span className="text-slate-400 font-bold uppercase text-[9px] block">Loan Registered Date</span>
                                  <span className="font-semibold text-slate-800 font-mono text-[11px]">{loan.loanRegisteredDate}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="border-t border-slate-200/60 pt-2.5">
                              <div className="flex justify-between text-xs font-semibold mb-1">
                                <span className="text-slate-700 font-sans font-semibold">Installments Cleared</span>
                                <span className="font-mono text-slate-500">
                                  {stats.paidInstallments} / {loan.loanTenureMonths} Paid ({progressPercent.toFixed(0)}%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                <span>Total Paid: ₹{stats.totalPaid.toLocaleString('en-IN')}</span>
                                <span>Remaining: ₹{stats.totalRemaining.toLocaleString('en-IN')}</span>
                              </div>
                            </div>

                            <div className="border-t border-slate-200/60 pt-2.5 flex justify-between items-center text-xs">
                              <div>
                                <span className="text-slate-400 font-bold uppercase text-[9px] block">Next Due Date</span>
                                <span className={`font-semibold font-mono ${stats.isOverdue ? 'text-rose-600 font-bold animate-pulse' : 'text-slate-800'}`}>
                                  {stats.nextDueDateStr}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {stats.isOverdue && (
                                  <span className="bg-rose-50 text-rose-700 font-bold text-[9px] px-2 py-0.5 rounded border border-rose-200 uppercase tracking-wider animate-pulse">
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
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-3 py-1 rounded shadow-sm hover:shadow-md transition cursor-pointer"
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
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">Engines & Lubricants Lifespan</h3>
                  <p className="text-[10px] text-slate-400 mb-3">Mileage comparisons mapped with current odometer reading: <b className="text-slate-700">{truck.currentKM?.toLocaleString() || '0'} KM</b></p>
                  
                  <div className="space-y-4">
                    {renderMaintenanceProgressBar('Engine Oil Milestone', truck.engineOilKM, truck.currentKM, truck.engineOilIntervalKM || orgProfile?.engineOilIntervalKM, 15000)}
                    {onServiceDone && (
                      <button type="button" onClick={() => openServiceDone(truck, 'Engine Oil', truck.engineOilKM, truck.engineOilIntervalKM || orgProfile?.engineOilIntervalKM || 15000)} className="w-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1.5"><Wrench className="w-3 h-3" /> ✔ Service Done</button>
                    )}
                    {renderMaintenanceProgressBar('Crown Differential Oil', truck.crownOilKM, truck.currentKM, truck.crownOilIntervalKM || orgProfile?.crownOilIntervalKM, 40000)}
                    {onServiceDone && (
                      <button type="button" onClick={() => openServiceDone(truck, 'Crown Oil', truck.crownOilKM, truck.crownOilIntervalKM || orgProfile?.crownOilIntervalKM || 40000)} className="w-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1.5"><Wrench className="w-3 h-3" /> ✔ Service Done</button>
                    )}
                    {renderMaintenanceProgressBar('Main Gearbox Oil', truck.gearBoxOilKM, truck.currentKM, truck.gearBoxOilIntervalKM || orgProfile?.gearBoxOilIntervalKM, 40000)}
                    {onServiceDone && (
                      <button type="button" onClick={() => openServiceDone(truck, 'Gear Box Oil', truck.gearBoxOilKM, truck.gearBoxOilIntervalKM || orgProfile?.gearBoxOilIntervalKM || 40000)} className="w-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1.5"><Wrench className="w-3 h-3" /> ✔ Service Done</button>
                    )}
                    {renderMaintenanceProgressBar('Radiator Service', truck.radiatorKM, truck.currentKM, truck.radiatorIntervalKM || orgProfile?.radiatorIntervalKM, 20000)}
                    {onServiceDone && (
                      <button type="button" onClick={() => openServiceDone(truck, 'Radiator', truck.radiatorKM, truck.radiatorIntervalKM || orgProfile?.radiatorIntervalKM || 20000)} className="w-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1.5"><Wrench className="w-3 h-3" /> ✔ Service Done</button>
                    )}
                    {renderMaintenanceProgressBar('Pinpush Grease', truck.pinpushKM, truck.currentKM, truck.pinpushIntervalKM || orgProfile?.pinpushIntervalKM, 5000)}
                    {onServiceDone && (
                      <button type="button" onClick={() => openServiceDone(truck, 'Pinpush Grease', truck.pinpushKM, truck.pinpushIntervalKM || orgProfile?.pinpushIntervalKM || 5000)} className="w-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1.5"><Wrench className="w-3 h-3" /> ✔ Service Done</button>
                    )}
                    {renderMaintenanceProgressBar('Wheel Grease', truck.wheelGreaseKM, truck.currentKM, truck.wheelGreaseIntervalKM || orgProfile?.wheelGreaseIntervalKM, 5000)}
                    {onServiceDone && (
                      <button type="button" onClick={() => openServiceDone(truck, 'Wheel Grease', truck.wheelGreaseKM, truck.wheelGreaseIntervalKM || orgProfile?.wheelGreaseIntervalKM || 5000)} className="w-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-100 transition cursor-pointer flex items-center justify-center gap-1.5"><Wrench className="w-3 h-3" /> ✔ Service Done</button>
                    )}
                  </div>
                </div>

                {/* Section D: Uploaded Compliance Documents */}
                {(truck.rcFileId || truck.insuranceFileId) && (
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5 font-sans">Uploaded Compliance Documents</h3>
                    <div className="grid grid-cols-2 gap-3">
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
                          className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 font-semibold text-xs hover:bg-blue-100/70 transition cursor-pointer"
                        >
                          <span>RC Document</span>
                          <span className="text-[10px] text-blue-500 font-medium font-sans">View &rarr;</span>
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
                          className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 font-semibold text-xs hover:bg-indigo-100/70 transition cursor-pointer"
                        >
                          <span>Insurance Certificate</span>
                          <span className="text-[10px] text-indigo-500 font-medium font-sans">View &rarr;</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Section D: Active Vouchers Logs */}
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">Asset History Ledger Records</h3>
                  <div className="max-h-[160px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                    {truckExpenses.length === 0 ? (
                      <p className="text-center py-6 text-slate-400 font-medium italic">No standalone ledger vouchers processed for {truck.truckNo}.</p>
                    ) : (
                      truckExpenses.map(e => (
                        <div key={e.id} className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                          <div>
                            <span className="font-bold text-slate-800 tracking-tight block">{e.expenseType}</span>
                            <span className="text-[9px] text-slate-400 font-mono block mt-0.5">{e.date} &bull; {e.status}</span>
                          </div>
                          <span className="font-mono font-extrabold text-rose-600">-₹{e.amount.toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Status footer summary */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-[10px] text-slate-500">
                <span>Total associated runs: <b className="text-slate-805">{totalTrips} Trips</b></span>
                <span>Active Compliance Status: <b className={`${truck.status === 'Active' ? 'text-emerald-600' : 'text-rose-600'}`}>{truck.status}</b></span>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Service Done Modal */}
      {serviceDoneTarget && (
        <ServiceDoneModal
          isOpen={true}
          truckNo={serviceDoneTarget.truckNo}
          truckId={serviceDoneTarget.truckId}
          serviceType={serviceDoneTarget.serviceType}
          currentKM={serviceDoneTarget.currentKM}
          intervalKM={serviceDoneTarget.intervalKM}
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
      {payEmiTarget && (
        <PayEmiModal
          isOpen={true}
          onClose={() => setPayEmiTarget(null)}
          truckNo={payEmiTarget.truckNo}
          emiAmount={payEmiTarget.emiAmount}
          bankName={payEmiTarget.bankName}
          dueDateStr={payEmiTarget.dueDateStr}
          accounts={accounts}
          loanType={payEmiTarget.loanType}
          onConfirm={async (paymentDate, accountId) => {
            if (onAddExpense) {
              await onAddExpense({
                truckNo: payEmiTarget.truckNo,
                expenseType: 'Loan EMI',
                shopName: payEmiTarget.bankName,
                amount: payEmiTarget.emiAmount,
                paymentMode: accountId,
                date: paymentDate,
                status: 'Paid',
                notes: `EMI payment due date: ${payEmiTarget.dueDateStr}${payEmiTarget.loanType ? ` (${payEmiTarget.loanType})` : ''}`,
              });
              alert(`EMI Payment of ₹${payEmiTarget.emiAmount.toLocaleString('en-IN')} for ${payEmiTarget.truckNo} recorded successfully.`);
            }
            setPayEmiTarget(null);
          }}
        />
      )}
      {/* Edit Loan Modal */}
      {editingLoanTarget && (
        <EditLoanModal
          isOpen={true}
          loan={editingLoanTarget.loan}
          onCancel={() => setEditingLoanTarget(null)}
          onConfirm={(updatedLoan) => {
            const currentLoans = getTruckLoans(editingLoanTarget.truck);
            const nextLoans = currentLoans.map(l => l.id === updatedLoan.id ? updatedLoan : l);
            const primaryLoan = nextLoans[0];
            onUpdateTruck({
              ...editingLoanTarget.truck,
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
  const [loanType, setLoanType] = useState(
    ['Chassis Loan', 'Body Loan'].includes(loan.loanType || '') ? (loan.loanType || 'Chassis Loan') : 'Other'
  );
  const [customLoanType, setCustomLoanType] = useState(
    ['Chassis Loan', 'Body Loan'].includes(loan.loanType || '') ? '' : (loan.loanType || '')
  );
  const [loanBankName, setLoanBankName] = useState(loan.loanBankName || '');
  const [loanStartDate, setLoanStartDate] = useState(loan.loanStartDate || '');
  const [loanRegisteredDate, setLoanRegisteredDate] = useState(loan.loanRegisteredDate || '');
  const [loanTenureMonths, setLoanTenureMonths] = useState<number | ''>(loan.loanTenureMonths || '');
  const [loanEmiAmount, setLoanEmiAmount] = useState<number | ''>(loan.loanEmiAmount || '');
  const [loanStatus, setLoanStatus] = useState<'Active' | 'Closed'>(loan.loanStatus || 'Active');
  const [loanNotes, setLoanNotes] = useState(loan.loanNotes || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanStartDate || !loanEmiAmount || !loanTenureMonths) {
      alert("Please fill in Loan Start Date, Tenure, and EMI Amount.");
      return;
    }
    const finalType = loanType === 'Other' ? (customLoanType.trim() || 'Other Loan') : loanType;
    onConfirm({
      ...loan,
      loanType: finalType,
      loanBankName: loanBankName.trim() || undefined,
      loanStartDate,
      loanRegisteredDate: loanRegisteredDate || loanStartDate,
      loanTenureMonths: Number(loanTenureMonths),
      loanEmiAmount: Number(loanEmiAmount),
      loanStatus,
      loanNotes: loanNotes.trim() || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-800">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900 font-sans uppercase tracking-wider">Edit Loan Details</h3>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Loan Type</label>
              <select
                value={loanType}
                onChange={(e) => {
                  const val = e.target.value;
                  setLoanType(val);
                  if (val !== 'Other') setCustomLoanType('');
                }}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
              >
                <option value="Chassis Loan">Chassis Loan</option>
                <option value="Body Loan">Body Loan</option>
                <option value="Other">Other Loan</option>
              </select>
            </div>
            {loanType === 'Other' ? (
              <div>
                <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Custom Loan Type</label>
                <input
                  type="text"
                  placeholder="e.g. Trailer Loan"
                  value={customLoanType}
                  onChange={(e) => setCustomLoanType(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>
            ) : <div />}
            <div>
              <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Lending Institution</label>
              <input
                type="text"
                placeholder="e.g. HDFC Bank"
                value={loanBankName}
                onChange={(e) => setLoanBankName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">First EMI Paid Date</label>
              <input
                type="date"
                value={loanStartDate}
                onChange={(e) => setLoanStartDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Tenure (Months)</label>
              <input
                type="number"
                placeholder="Tenure"
                value={loanTenureMonths}
                onChange={(e) => setLoanTenureMonths(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Monthly EMI</label>
              <input
                type="number"
                placeholder="EMI Amount"
                value={loanEmiAmount}
                onChange={(e) => setLoanEmiAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Registered Date</label>
              <input
                type="date"
                value={loanRegisteredDate}
                onChange={(e) => setLoanRegisteredDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Status</label>
              <select
                value={loanStatus}
                onChange={(e) => setLoanStatus(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-semibold"
              >
                <option value="Active">Active Loan</option>
                <option value="Closed">Closed / Settled</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[9px] font-bold text-slate-555 uppercase mb-1">Notes / Remarks</label>
              <input
                type="text"
                placeholder="Notes"
                value={loanNotes}
                onChange={(e) => setLoanNotes(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 font-sans">
            <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition cursor-pointer">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
