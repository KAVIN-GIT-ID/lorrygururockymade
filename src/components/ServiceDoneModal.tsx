import React, { useState, useEffect } from 'react';
import { ServiceType, ServiceDonePayload, Account, Driver } from '../types';
import { X, ShoppingBag, Wrench, CheckCircle } from 'lucide-react';

interface ServiceDoneModalProps {
  isOpen: boolean;
  truckNo: string;
  truckId: string;
  serviceType: ServiceType;
  currentKM: number;
  intervalKM: number;
  accounts: Account[];
  drivers: Driver[];
  onConfirm: (payload: ServiceDonePayload) => void;
  onCancel: () => void;
}

const SERVICE_ICONS: Record<ServiceType, string> = {
  'Engine Oil':    '🛢️',
  'Crown Oil':     '⚙️',
  'Gear Box Oil':  '🔩',
  'Radiator':      '💧',
  'Pinpush Grease':'🔧',
  'Wheel Grease':  '🚗',
};

const SERVICE_COLORS: Record<ServiceType, { bg: string; border: string; badge: string; text: string }> = {
  'Engine Oil':    { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-800 border-blue-200',   text: 'text-blue-700' },
  'Crown Oil':     { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800 border-purple-200', text: 'text-purple-700' },
  'Gear Box Oil':  { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800 border-orange-200', text: 'text-orange-700' },
  'Radiator':      { bg: 'bg-cyan-50',   border: 'border-cyan-200',   badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',   text: 'text-cyan-700' },
  'Pinpush Grease':{ bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-800 border-amber-200',  text: 'text-amber-700' },
  'Wheel Grease':  { bg: 'bg-emerald-50',border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'text-emerald-700' },
};

export default function ServiceDoneModal({
  isOpen,
  truckNo,
  truckId,
  serviceType,
  currentKM,
  intervalKM,
  accounts,
  drivers,
  onConfirm,
  onCancel,
}: ServiceDoneModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const defaultNextKM = currentKM + intervalKM;

  // Common
  const [serviceDate, setServiceDate] = useState(today);
  const [newMilestoneKM, setNewMilestoneKM] = useState<number | ''>(defaultNextKM);
  const [notes, setNotes] = useState('');

  // Parts purchase
  const [partsShopName, setPartsShopName] = useState('');
  const [partsAmount, setPartsAmount] = useState<number | ''>('');
  const [partsAccountType, setPartsAccountType] = useState<'Account' | 'Driver'>('Account');
  const [partsPaymentMode, setPartsPaymentMode] = useState('');
  const [partsDriverName, setPartsDriverName] = useState('');
  const [partsStatus, setPartsStatus] = useState<'Paid' | 'Pending'>('Paid');

  // Labour
  const [labourShopName, setLabourShopName] = useState('');
  const [labourAmount, setLabourAmount] = useState<number | ''>('');
  const [labourAccountType, setLabourAccountType] = useState<'Account' | 'Driver'>('Account');
  const [labourPaymentMode, setLabourPaymentMode] = useState('');
  const [labourDriverName, setLabourDriverName] = useState('');
  const [labourStatus, setLabourStatus] = useState<'Paid' | 'Pending'>('Paid');

  // Reset when modal opens for a different truck/service
  useEffect(() => {
    if (isOpen) {
      setServiceDate(today);
      setNewMilestoneKM(currentKM + intervalKM);
      setNotes('');
      setPartsShopName('');
      setPartsAmount('');
      setPartsAccountType('Account');
      setPartsPaymentMode(accounts[0]?.accountName || '');
      setPartsDriverName('');
      setPartsStatus('Paid');
      setLabourShopName('');
      setLabourAmount('');
      setLabourAccountType('Account');
      setLabourPaymentMode(accounts[0]?.accountName || '');
      setLabourDriverName('');
      setLabourStatus('Paid');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, truckId, serviceType]);

  if (!isOpen) return null;

  const colors = SERVICE_COLORS[serviceType];
  const icon = SERVICE_ICONS[serviceType];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneKM || Number(newMilestoneKM) <= 0) {
      alert('Please enter a valid Next Due KM value.');
      return;
    }

    onConfirm({
      serviceType,
      serviceDate,
      truckId,
      truckNo,
      newMilestoneKM: Number(newMilestoneKM),
      notes: notes.trim() || undefined,
      partsExpense: {
        shopName: partsShopName.trim() || 'General',
        amount: partsAmount === '' ? 0 : Number(partsAmount),
        paymentMode: partsAccountType === 'Driver' ? partsDriverName : (partsPaymentMode || 'Cash/General'),
        accountType: partsAccountType,
        driverName: partsAccountType === 'Driver' ? partsDriverName : undefined,
        status: partsStatus,
      },
      labourExpense: {
        shopName: labourShopName.trim() || 'General Workshop',
        amount: labourAmount === '' ? 0 : Number(labourAmount),
        paymentMode: labourAccountType === 'Driver' ? labourDriverName : (labourPaymentMode || 'Cash/General'),
        accountType: labourAccountType,
        driverName: labourAccountType === 'Driver' ? labourDriverName : undefined,
        status: labourStatus,
      },
    });
  };

  const AccountPaymentField = ({
    id,
    accountType, setAccountType,
    paymentMode, setPaymentMode,
    driverName, setDriverName,
  }: {
    id: string;
    accountType: 'Account' | 'Driver';
    setAccountType: (v: 'Account' | 'Driver') => void;
    paymentMode: string; setPaymentMode: (v: string) => void;
    driverName: string; setDriverName: (v: string) => void;
  }) => (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label htmlFor={`${id}-acct-type`} className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Paid Via</label>
        <select
          id={`${id}-acct-type`}
          value={accountType}
          onChange={e => {
            const v = e.target.value as 'Account' | 'Driver';
            setAccountType(v);
            if (v === 'Account') setDriverName('');
            else setPaymentMode('');
          }}
          className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        >
          <option value="Account">Account</option>
          <option value="Driver">Driver</option>
        </select>
      </div>
      <div>
        {accountType === 'Account' ? (
          <>
            <label htmlFor={`${id}-account`} className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Account</label>
            <select
              id={`${id}-account`}
              value={paymentMode}
              onChange={e => setPaymentMode(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="Cash/General">Cash / General</option>
              {accounts.map(a => (
                <option key={a.id} value={a.accountName}>{a.accountName}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label htmlFor={`${id}-driver`} className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Driver</label>
            <select
              id={`${id}-driver`}
              value={driverName}
              onChange={e => setDriverName(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Select Driver --</option>
              {drivers.map(d => (
                <option key={d.id} value={d.driverName}>{d.driverName}</option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
        {/* Header */}
        <div className={`${colors.bg} ${colors.border} border-b px-6 py-4 flex items-center justify-between rounded-t-2xl`}>
          <div className="flex items-center gap-3">
            <span className={`text-2xl`}>{icon}</span>
            <div>
              <h2 className={`text-sm font-extrabold ${colors.text} tracking-tight`}>
                Service Done — {serviceType}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                <span className="font-mono font-bold text-slate-700">{truckNo}</span>
                {' '}&bull;{' '}Current Odo: <span className="font-mono font-bold">{currentKM.toLocaleString()} KM</span>
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/60 text-slate-400 hover:text-slate-700 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Service meta row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="svc-date" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">Service Date</label>
              <input
                id="svc-date"
                type="date"
                value={serviceDate}
                onChange={e => setServiceDate(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-semibold"
              />
            </div>
            <div>
              <label htmlFor="svc-next-km" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">
                New Next-Due KM
                <span className="ml-1 text-slate-400 normal-case font-normal">(pre-filled: Odo + {intervalKM.toLocaleString()})</span>
              </label>
              <input
                id="svc-next-km"
                type="number"
                min={currentKM}
                value={newMilestoneKM}
                onChange={e => setNewMilestoneKM(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full bg-white border border-blue-200 text-slate-800 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-mono font-bold"
              />
            </div>
          </div>

          {/* Expense Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Parts Purchase Card */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-blue-100 pb-2">
                <ShoppingBag className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-[11px] font-extrabold text-blue-800 uppercase tracking-wider">Parts Purchase</span>
              </div>
              <div>
                <label htmlFor="parts-shop" className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Shop / Supplier Name</label>
                <input
                  id="parts-shop"
                  type="text"
                  placeholder="e.g. TVS Auto Parts"
                  value={partsShopName}
                  onChange={e => setPartsShopName(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-semibold"
                />
              </div>
              <div>
                <label htmlFor="parts-amount" className="block text-[9px] font-bold text-slate-550 uppercase mb-1">
                  Parts Amount ₹ <span className="text-slate-400 normal-case font-normal">(0 = skip)</span>
                </label>
                <input
                  id="parts-amount"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={partsAmount}
                  onChange={e => setPartsAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-mono font-bold text-right"
                />
              </div>
              <AccountPaymentField
                id="parts"
                accountType={partsAccountType} setAccountType={setPartsAccountType}
                paymentMode={partsPaymentMode} setPaymentMode={setPartsPaymentMode}
                driverName={partsDriverName} setDriverName={setPartsDriverName}
              />
              <div>
                <label htmlFor="parts-status" className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Settlement Status</label>
                <select
                  id="parts-status"
                  value={partsStatus}
                  onChange={e => setPartsStatus(e.target.value as 'Paid' | 'Pending')}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-bold"
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>

            {/* Mechanical Labour Card */}
            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-amber-100 pb-2">
                <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider">Mechanical Labour</span>
              </div>
              <div>
                <label htmlFor="labour-shop" className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Workshop Name</label>
                <input
                  id="labour-shop"
                  type="text"
                  placeholder="e.g. Kumar Workshop"
                  value={labourShopName}
                  onChange={e => setLabourShopName(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-semibold"
                />
              </div>
              <div>
                <label htmlFor="labour-amount" className="block text-[9px] font-bold text-slate-550 uppercase mb-1">
                  Labour Charge ₹ <span className="text-slate-400 normal-case font-normal">(0 = skip)</span>
                </label>
                <input
                  id="labour-amount"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={labourAmount}
                  onChange={e => setLabourAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-mono font-bold text-right"
                />
              </div>
              <AccountPaymentField
                id="labour"
                accountType={labourAccountType} setAccountType={setLabourAccountType}
                paymentMode={labourPaymentMode} setPaymentMode={setLabourPaymentMode}
                driverName={labourDriverName} setDriverName={setLabourDriverName}
              />
              <div>
                <label htmlFor="labour-status" className="block text-[9px] font-bold text-slate-550 uppercase mb-1">Settlement Status</label>
                <select
                  id="labour-status"
                  value={labourStatus}
                  onChange={e => setLabourStatus(e.target.value as 'Paid' | 'Pending')}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-bold"
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notes field (always shown, prominently for wheel grease context) */}
          <div>
            <label htmlFor="svc-notes" className="block text-[10px] font-bold text-slate-550 uppercase mb-1">
              Service Notes
              <span className="ml-1 text-slate-400 normal-case font-normal">— reason for early service, issue observed, etc. (visible on service window)</span>
            </label>
            <textarea
              id="svc-notes"
              rows={2}
              placeholder="e.g. Wheel grease done early due to bearing noise. Next due reset accordingly."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-medium resize-none"
            />
          </div>

          {/* Summary hint */}
          {(Number(partsAmount) > 0 || Number(labourAmount) > 0) && (
            <div className={`${colors.bg} ${colors.border} border rounded-lg px-4 py-2.5 flex items-center justify-between`}>
              <span className={`text-[11px] font-bold ${colors.text}`}>Total Service Cost</span>
              <span className={`font-mono font-extrabold text-sm ${colors.text}`}>
                ₹{(Number(partsAmount || 0) + Number(labourAmount || 0)).toLocaleString('en-IN')}
              </span>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer active:scale-95 transition-all`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Mark Service Done &amp; Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
