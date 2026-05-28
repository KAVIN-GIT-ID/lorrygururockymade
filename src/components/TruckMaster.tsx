import React, { useState, useRef, useEffect } from 'react';
import { Truck, TripEntry, ExpenseEntry, getTripMetrics, OrganizationProfile, Account, Driver, ServiceDonePayload, ServiceType } from '../types';
import { Plus, Edit2, Trash2, Shield, CheckCircle, XCircle, Wrench, Calendar, Settings, X, Loader2, ChevronUp, ChevronDown, FileText, Eye } from 'lucide-react';
import { calculateDaysLeft as calculateDaysLeftUtil, formatToDisplayDate } from '../lib/dateUtils';
import { formatTruckNumber } from '../lib/formatUtils';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import ServiceDoneModal from './ServiceDoneModal';

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
}: TruckMasterProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingTruckId, setViewingTruckId] = useState<string | null>(null);
  const [expandedTruckId, setExpandedTruckId] = useState<string | null>(null);
  const [serviceDoneTarget, setServiceDoneTarget] = useState<{ truckId: string; truckNo: string; serviceType: ServiceType; currentKM: number; intervalKM: number } | null>(null);
  
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
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Admin Disabled'>('Active');

  // General Specifications
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState('');
  
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
        uploadedRcId = await appwrite.uploadFile(rcFile, customName);
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
        uploadedInsuranceId = await appwrite.uploadFile(insuranceFile, customName);
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
        <form id="truck-form" onSubmit={handleSubmit} className="p-4 md:p-5 bg-slate-50 rounded-xl border border-slate-250 animate-fade-in space-y-4">
          {limitReached && !isEditing && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-800 dark:text-amber-400 text-xs flex gap-2">
              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Truck Registration Limit Reached ({approvedCount} / {maxTrucksAllowed} Free Allowed)</p>
                <p className="mt-0.5 text-[11px]">Saving this truck will submit a pending approval request to the backend team. Once approved, the truck will become active and visible across your management sheets.</p>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-2">
            <Settings className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest">
              {isEditing ? 'Modify Fleet Information' : limitReached ? 'Request Truck Activation' : 'Register Vehicle & Technical Specs'}
            </h3>
          </div>

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

              {/* SECTION 4: Upload Documents */}
              <div className="col-span-full border-t border-slate-200 pt-3">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2.5">4. Compliance Document Uploads (Optional)</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      )}

      {/* HORIZONTAL SCROLLABLE EXCEL-LIKE HIGHDENSITY DATA SHEET */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs hidden md:block">
        <div className="bg-slate-550/5 px-4 py-2 text-slate-500 font-mono text-[10px] flex justify-between items-center border-b border-slate-200">
          <span className="flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5 text-slate-400" />
            Scroll with mouse wheel or drag horizontally &bull; <span className="text-blue-600 font-bold underline">Click Vehicle No to view financials & details</span>
          </span>
          <span className="font-semibold text-slate-605">Base Anchor Date: 2026-05-23 (UTC)</span>
        </div>
        
        <div ref={scrollContainerRef} className="overflow-x-auto max-w-full">
          <table id="trucks-table" className="w-full text-left text-xs text-slate-750 divide-y divide-slate-150 whitespace-nowrap table-fixed">
            <colgroup>
              <col className="w-[140px]" />
              <col className="w-[85px]" />
              <col className="w-[90px]" />
              <col className="w-[110px]" />
              <col className="w-[110px]" />
              <col className="w-[110px]" />
              <col className="w-[95px]" />
              <col className="w-[110px]" />
              <col className="w-[110px]" />
              <col className="w-[110px]" />
              <col className="w-[110px]" />
              <col className="w-[110px]" />
              <col className="w-[110px]" />
              <col className="w-[115px]" />
              <col className="w-[100px]" />
              <col className="w-[100px]" />
              <col className="w-[125px]" />
              <col className="w-[100px]" />
              <col className="w-[125px]" />
              <col className="w-[100px]" />
              <col className="w-[125px]" />
              <col className="w-[100px]" />
              <col className="w-[125px]" />
              <col className="w-[85px]" />
              <col className="w-[100px]" />
            </colgroup>
            <thead className="text-[10px] text-slate-505 uppercase bg-slate-50 font-bold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 pl-4 sticky left-0 bg-slate-50 border-r border-slate-200 z-10 text-slate-800 shadow-sm">Vehicle No</th>
                <th className="px-3 py-2.5">Make</th>
                <th className="px-3 py-2.5">Model</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5 text-center bg-blue-50/20 text-blue-700">Insurance</th>
                <th className="px-3 py-2.5 text-center bg-indigo-50/20 text-indigo-700">FC</th>
                <th className="px-3 py-2.5 text-right text-slate-600">Pinpush KM</th>
                <th className="px-3 py-2.5 text-right text-slate-600">Wheel Greese KM</th>
                <th className="px-3 py-2.5 text-center bg-violet-50/20 text-violet-700">Alignment Date</th>
                <th className="px-3 py-2.5 text-center bg-amber-50/20 text-amber-700">Q Tax</th>
                <th className="px-3 py-2.5 text-center bg-emerald-50/20 text-emerald-700">Green Tax</th>
                <th className="px-3 py-2.5 text-center bg-rose-50/20 text-rose-700">NP Tax</th>
                <th className="px-3 py-2.5 text-center bg-cyan-50/20 text-cyan-700">5Y Permit</th>
                <th className="px-3 py-2.5 text-center bg-purple-50/20 text-purple-700">Reg Expiry</th>
                <th className="px-3 py-2.5 text-right font-bold text-slate-800 bg-slate-100">Current KM</th>
                <th className="px-3 py-2.5 text-right">Engine Oil KM</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-905">Engine Oil KM Left</th>
                <th className="px-3 py-2.5 text-right">Crown Oil KM</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-905">Crown Oil KM Left</th>
                <th className="px-3 py-2.5 text-right">Gear Box Oil KM</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-905">Gear Box KM Left</th>
                <th className="px-3 py-2.5 text-right">Radiator KM</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-905">Radiator KM Left</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-center pr-4 w-16">Options</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium">
              {trucks.length === 0 ? (
                <tr>
                  <td colSpan={25} className="text-center py-12 text-slate-400 font-medium italic">No vehicles registered. Add a fleet specifications record to deploy.</td>
                </tr>
              ) : (
                trucks.map((truck) => {
                  const insDays = calculateDaysLeft(truck.insuranceDate);
                  const fcDays = calculateDaysLeft(truck.fcDate);
                  const aliDays = calculateDaysLeft(truck.alignmentNextDate);
                  const qDays = calculateDaysLeft(truck.qTaxDate);
                  const gDays = calculateDaysLeft(truck.greenTaxDate);
                  const npDays = calculateDaysLeft(truck.npTaxDate);
                  const fvDays = calculateDaysLeft(truck.fiveYearPermitDate);
                  const regDays = calculateDaysLeft(truck.registrationExpiryDate);
 
                  const insProps = getExpiryCellProps(truck.insuranceDate, insDays);
                  const fcProps = getExpiryCellProps(truck.fcDate, fcDays);
                  const aliProps = getExpiryCellProps(truck.alignmentNextDate, aliDays);
                  const qProps = getExpiryCellProps(truck.qTaxDate, qDays);
                  const gProps = getExpiryCellProps(truck.greenTaxDate, gDays);
                  const npProps = getExpiryCellProps(truck.npTaxDate, npDays);
                  const fvProps = getExpiryCellProps(truck.fiveYearPermitDate, fvDays);

                  const getRegExpiryProps = (dateStr: string | undefined, days: number | null) => {
                    if (!dateStr) {
                      return {
                        className: "px-2.5 py-3 text-center font-mono text-slate-350",
                        displayText: "—",
                        title: "No registration expiry recorded."
                      };
                    }
                    if (days === null) {
                      return {
                        className: "px-2.5 py-3 text-center font-mono font-bold text-slate-500",
                        displayText: dateStr,
                        title: "Invalid date format."
                      };
                    }
                    if (days <= 0) {
                      return {
                        className: "px-2.5 py-3 text-center font-mono font-bold bg-rose-50 text-rose-700 border border-rose-100 uppercase",
                        displayText: `${dateStr} (EXPIRED)`,
                        title: `Registration expired on ${dateStr} (${Math.abs(days)} days ago).`
                      };
                    }
                    if (days <= 30) {
                      return {
                        className: "px-2.5 py-3 text-center font-mono font-bold bg-amber-50 text-amber-800 border border-amber-100",
                        displayText: `${dateStr} (${days}d)`,
                        title: `Registration expires soon: ${dateStr} (${days} days left).`
                      };
                    }
                    return {
                      className: "px-2.5 py-3 text-center font-mono font-medium text-slate-705",
                      displayText: dateStr,
                      title: `Registration valid until ${dateStr} (${days} days left).`
                    };
                  };
                  
                  const regProps = getRegExpiryProps(truck.registrationExpiryDate, regDays);

                  return (
                    <tr key={truck.id} id={`row-truck-${truck.id}`} className="hover:bg-slate-50 transition border-b border-slate-100">
                      {/* Sticky Vehicle No */}
                      <td 
                        className="px-3 py-3 pl-4 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-200 z-10 font-mono font-extrabold tracking-wider shadow-xs cursor-pointer select-none group/cell animate-fade-in"
                        onClick={() => truck.isApproved !== false && setViewingTruckId(truck.id)}
                        title={truck.isApproved !== false ? "Click to view detailed financials, lube milestones & compliance logs" : "Pending activation approval by Backend Team."}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 text-xs text-blue-600 group-hover/cell:text-blue-800 transition-colors">
                            <Shield className={`w-3.5 h-3.5 ${truck.isApproved === false ? 'text-amber-500 animate-pulse' : 'text-blue-500'} group-hover/cell:scale-110 transition-transform`} />
                            <span className={truck.isApproved !== false ? "underline decoration-dotted decoration-blue-405 group-hover/cell:decoration-solid" : ""}>{truck.truckNo}</span>
                          </span>
                          {truck.isApproved === false && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider max-w-max ${
                              truck.requestStatus === 'Rejected'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                            }`}>
                              {truck.requestStatus === 'Rejected' ? 'Rejected' : 'Pending Approval'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-650">{truck.make || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 font-mono text-slate-650 text-[11px]">{truck.model || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 text-slate-650 ">{truck.type || <span className="text-slate-300">—</span>}</td>
                      
                      {/* Expiries with Hover tooltip days relative to today */}
                      <td className={insProps.className} title={insProps.title}>{insProps.displayText}</td>
                      <td className={fcProps.className} title={fcProps.title}>{fcProps.displayText}</td>
                      
                      <td className="px-3 py-3 text-right font-mono text-slate-600">{truck.pinpushKM ? truck.pinpushKM.toLocaleString() : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600">{truck.wheelGreaseKM ? truck.wheelGreaseKM.toLocaleString() : <span className="text-slate-300">—</span>}</td>
                      
                      <td className={aliProps.className} title={aliProps.title}>{aliProps.displayText}</td>
                      <td className={qProps.className} title={qProps.title}>{qProps.displayText}</td>
                      <td className={gProps.className} title={gProps.title}>{gProps.displayText}</td>
                      <td className={npProps.className} title={npProps.title}>{npProps.displayText}</td>
                      <td className={fvProps.className} title={fvProps.title}>{fvProps.displayText}</td>
                      <td className={regProps.className} title={regProps.title}>{regProps.displayText}</td>

                      {/* Current Mileage */}
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-900 bg-slate-50">{truck.currentKM ? truck.currentKM.toLocaleString() : '0'}</td>

                      {/* Lubes Milestones readings with dynamic badge comparisons */}
                      <td className="px-3 py-3 text-right font-mono text-slate-600">{truck.engineOilKM ? truck.engineOilKM.toLocaleString() : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 bg-teal-50/5 text-right">{renderKMLeftBadge(truck.engineOilKM, truck.currentKM, truck.engineOilIntervalKM || orgProfile?.engineOilIntervalKM || 15000)}</td>

                      <td className="px-3 py-3 text-right font-mono text-slate-600">{truck.crownOilKM ? truck.crownOilKM.toLocaleString() : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 bg-teal-50/5 text-right">{renderKMLeftBadge(truck.crownOilKM, truck.currentKM, truck.crownOilIntervalKM || orgProfile?.crownOilIntervalKM || 40000)}</td>

                      <td className="px-3 py-3 text-right font-mono text-slate-600">{truck.gearBoxOilKM ? truck.gearBoxOilKM.toLocaleString() : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 bg-teal-50/5 text-right">{renderKMLeftBadge(truck.gearBoxOilKM, truck.currentKM, truck.gearBoxOilIntervalKM || orgProfile?.gearBoxOilIntervalKM || 40000)}</td>

                      <td className="px-3 py-3 text-right font-mono text-slate-600">{truck.radiatorKM ? truck.radiatorKM.toLocaleString() : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 bg-teal-50/5 text-right">{renderKMLeftBadge(truck.radiatorKM, truck.currentKM, truck.radiatorIntervalKM || orgProfile?.radiatorIntervalKM || 20000)}</td>

                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          truck.status === 'Active' 
                            ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200' 
                            : truck.status === 'Admin Disabled'
                              ? 'bg-red-500/10 text-red-700 border border-red-200 font-extrabold animate-pulse'
                              : 'bg-rose-55/10 text-rose-700 border border-rose-200'
                        }`}>
                          {truck.status === 'Active' ? 'Active' : truck.status === 'Admin Disabled' ? 'Admin Disabled' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center pr-4">
                        <div className="flex justify-center items-center gap-1.5 select-none">
                          {truck.requestStatus === 'Rejected' && onAddTruckRequest && (
                            <button
                              title="Reapply for Approval"
                              onClick={() => {
                                if (confirm(`Would you like to reapply for approval for truck ${truck.truckNo}?`)) {
                                  onAddTruckRequest({
                                    truckNo: truck.truckNo,
                                    ownerName: truck.ownerName,
                                    status: 'Inactive',
                                    make: truck.make,
                                    model: truck.model,
                                    type: truck.type,
                                    insuranceDate: truck.insuranceDate,
                                    fcDate: truck.fcDate,
                                    pinpushKM: truck.pinpushKM,
                                    wheelGreaseKM: truck.wheelGreaseKM,
                                    alignmentNextDate: truck.alignmentNextDate,
                                    qTaxDate: truck.qTaxDate,
                                    greenTaxDate: truck.greenTaxDate,
                                    npTaxDate: truck.npTaxDate,
                                    fiveYearPermitDate: truck.fiveYearPermitDate,
                                    currentKM: truck.currentKM,
                                    engineOilKM: truck.engineOilKM,
                                    crownOilKM: truck.crownOilKM,
                                    gearBoxOilKM: truck.gearBoxOilKM,
                                    radiatorKM: truck.radiatorKM
                                  });
                                }
                              }}
                              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-750 text-white rounded text-[10px] font-bold transition cursor-pointer"
                            >
                              Reapply
                            </button>
                          )}
                          <button
                            title={truck.isApproved === false ? "Cannot edit specs for unapproved vehicle" : "Edit Vehicle Specs"}
                            disabled={!canEditTrucks || truck.isApproved === false}
                            onClick={() => startEdit(truck)}
                            className="p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            title="Delete Truck"
                            disabled={!canDeleteTrucks}
                            onClick={() => {
                              const msg = `Are you sure you want to delete Vehicle ${truck.truckNo} and all associated compliance specifications?`;
                              if (confirmAction) {
                                confirmAction(msg, () => onDeleteTruck(truck.id), "Delete Vehicle Database Record");
                              } else if (confirm(msg)) {
                                onDeleteTruck(truck.id);
                              }
                            }}
                            className="p-1 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE LIST CARD VIEW */}
      <div className="block md:hidden space-y-4">
        {trucks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 py-12 text-center text-slate-400 italic">
            No operational vehicles mapped in the system registry.
          </div>
        ) : (
          trucks.map((truck) => {
            const isExpanded = expandedTruckId === truck.id;
            
            const insDays = calculateDaysLeft(truck.insuranceDate);
            const fcDays = calculateDaysLeft(truck.fcDate);
            const npDays = calculateDaysLeft(truck.npTaxDate);

            const insProps = getExpiryCellProps(truck.insuranceDate, insDays);
            const fcProps = getExpiryCellProps(truck.fcDate, fcDays);
            const npProps = getExpiryCellProps(truck.npTaxDate, npDays);

            return (
              <div 
                key={truck.id}
                className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-3xs flex flex-col justify-between hover:border-blue-300 transition"
              >
                <div>
                  {/* Top Row: Vehicle No & Status */}
                  <div className="flex justify-between items-center gap-2 mb-3">
                    <div className="flex flex-col gap-0.5">
                      <span 
                        className="font-mono font-extrabold text-blue-600 text-xs flex items-center gap-1.5 cursor-pointer underline decoration-dotted"
                        onClick={() => truck.isApproved !== false && setViewingTruckId(truck.id)}
                      >
                        <Shield className={`w-3.5 h-3.5 ${truck.isApproved === false ? 'text-amber-500 animate-pulse' : 'text-blue-500'}`} />
                        {truck.truckNo}
                      </span>
                      {truck.isApproved === false && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider max-w-max ${
                          truck.requestStatus === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                        }`}>
                          {truck.requestStatus === 'Rejected' ? 'Rejected' : 'Pending Approval'}
                        </span>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      truck.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      truck.status === 'Inactive' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                      'bg-rose-50 text-rose-705 border border-rose-100'
                    }`}>
                      {truck.status}
                    </span>
                  </div>

                  {/* Make/Model & Specs */}
                  <div className="text-xs mb-3 text-slate-800 flex flex-wrap gap-2.5 items-center">
                    {(truck.make || truck.model) && (
                      <span className="font-bold text-slate-700">
                        {truck.make || ''} {truck.model || ''}
                      </span>
                    )}
                    {truck.type && (
                      <span className="bg-slate-100 text-slate-650 px-1.5 py-0.2 rounded font-semibold text-[9px] uppercase tracking-wider">
                        {truck.type}
                      </span>
                    )}
                  </div>

                  {/* Critical Expiries */}
                  <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-2.5 space-y-1.5 text-xs mb-3.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Insurance</span>
                      <span className={`${insProps.className} font-semibold text-[11px]`}>{insProps.displayText}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">FC Expiry</span>
                      <span className={`${fcProps.className} font-semibold text-[11px]`}>{fcProps.displayText}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">National Permit</span>
                      <span className={`${npProps.className} font-semibold text-[11px]`}>{npProps.displayText}</span>
                    </div>
                  </div>

                  {/* Mileage & Lubes Toggle */}
                  <div className="border border-slate-150 rounded-lg p-2 mb-3.5 bg-white">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-semibold">Current Odometer:</span>
                      <span className="font-mono font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-150">
                        {truck.currentKM ? truck.currentKM.toLocaleString() : '0'} KM
                      </span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setExpandedTruckId(isExpanded ? null : truck.id)}
                      className="w-full text-center text-[10px] font-bold text-blue-600 mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide' : 'Show'} Lubes & Oil Status</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 pt-2 border-t border-dashed border-slate-150 space-y-2 text-[11px]">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Engine Oil Left:</span>
                          <span>{renderKMLeftBadge(truck.engineOilKM, truck.currentKM, truck.engineOilIntervalKM || orgProfile?.engineOilIntervalKM || 15000)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Crown Oil Left:</span>
                          <span>{renderKMLeftBadge(truck.crownOilKM, truck.currentKM, truck.crownOilIntervalKM || orgProfile?.crownOilIntervalKM || 40000)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Gearbox Oil Left:</span>
                          <span>{renderKMLeftBadge(truck.gearBoxOilKM, truck.currentKM, truck.gearBoxOilIntervalKM || orgProfile?.gearBoxOilIntervalKM || 40000)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Radiator Coolant Left:</span>
                          <span>{renderKMLeftBadge(truck.radiatorKM, truck.currentKM, truck.radiatorIntervalKM || orgProfile?.radiatorIntervalKM || 20000)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Documents View links */}
                  {(truck.rcFileId || truck.insuranceFileId) && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {truck.rcFileId && (
                        <a
                          href={appwrite.getFileView(truck.rcFileId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-700 font-semibold text-[10px] rounded hover:bg-blue-100/50 transition cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>RC Doc</span>
                        </a>
                      )}
                      {truck.insuranceFileId && (
                        <a
                          href={appwrite.getFileView(truck.insuranceFileId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold text-[10px] rounded hover:bg-indigo-100/50 transition cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Insurance Doc</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100/60 mt-auto">
                  <button
                    type="button"
                    onClick={() => truck.isApproved !== false && setViewingTruckId(truck.id)}
                    disabled={truck.isApproved === false}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[10px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>View Info</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canEditTrucks}
                    onClick={() => startEdit(truck)}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[10px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Edit</span>
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
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-rose-150 bg-rose-50/20 hover:bg-rose-50/50 text-rose-600 font-semibold text-[10px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

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
                          href={appwrite.getFileView(truck.rcFileId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 font-semibold text-xs hover:bg-blue-100/70 transition cursor-pointer"
                        >
                          <span>RC Document</span>
                          <span className="text-[10px] text-blue-500 font-medium font-sans">View &rarr;</span>
                        </a>
                      )}
                      {truck.insuranceFileId && (
                        <a
                          href={appwrite.getFileView(truck.insuranceFileId)}
                          target="_blank"
                          rel="noopener noreferrer"
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
    </div>
  );
}
