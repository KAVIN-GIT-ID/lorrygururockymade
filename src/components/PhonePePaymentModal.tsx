import React, { useState, useEffect } from 'react';
import { X, CreditCard, Shield, Smartphone, Landmark, CheckCircle, ArrowRight, Loader2, Sparkles, Building2, User, Mail, Phone, ArrowLeft } from 'lucide-react';

interface PhonePePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  truckNo: string;
  defaultCustomerName?: string;
  defaultCustomerEmail?: string;
  defaultCustomerPhone?: string;
  initialTxnId?: string;
  organizationId?: string;
  onSuccess: (paymentDetails: {
    transactionId: string;
    amount: number;
    duration: string;
    planName: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    paymentDate: string;
    status: string;
    paymentMethod?: 'upi' | 'card' | 'netbanking';
  }) => void;
}

const RENEWAL_PLANS = [
  { id: '1_month', name: '1 Month Starter', duration: '1 Month', price: 500, label: '₹500 / Month' },
  { id: '3_months', name: '3 Months Professional', duration: '3 Months', price: 1200, label: '₹1,200 (₹400/mo)' },
  { id: '6_months', name: '6 Months Saver', duration: '6 Months', price: 2200, label: '₹2,200 (₹366/mo)' },
  { id: '1_year', name: '1 Year Premium', duration: '1 Year', price: 4000, label: '₹4,000 (₹333/mo)', popular: true },
];

export default function PhonePePaymentModal({
  isOpen,
  onClose,
  truckNo,
  defaultCustomerName = '',
  defaultCustomerEmail = '',
  defaultCustomerPhone = '',
  initialTxnId,
  organizationId = 'org_default',
  onSuccess
}: PhonePePaymentModalProps) {
  const [step, setStep] = useState<'plan' | 'billing' | 'gateway' | 'processing' | 'success' | 'verifying' | 'failed'>(
    initialTxnId ? 'verifying' : 'plan'
  );
  const [selectedPlan, setSelectedPlan] = useState(RENEWAL_PLANS[3]); // Default to 1 Year Premium
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [customerEmail, setCustomerEmail] = useState(defaultCustomerEmail);
  const [customerPhone, setCustomerPhone] = useState(defaultCustomerPhone);
  
  // Payment option details
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiProvider, setUpiProvider] = useState<'phonepe' | 'gpay' | 'paytm' | 'other'>('phonepe');
  const [customUpiId, setCustomUpiId] = useState('');
  
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  
  const [selectedBank, setSelectedBank] = useState('sbi');
  
  // Simulation states
  const [processingStatus, setProcessingStatus] = useState('Connecting to PhonePe secure gateway...');
  const [transactionId, setTransactionId] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(initialTxnId ? 'verifying' : 'plan');
      setTransactionId(initialTxnId || ('TXN' + Math.floor(100000000 + Math.random() * 900000000)));
      // Prefill fields if props updated
      setCustomerName(defaultCustomerName);
      setCustomerEmail(defaultCustomerEmail);
      setCustomerPhone(defaultCustomerPhone);
    }
  }, [isOpen, defaultCustomerName, defaultCustomerEmail, defaultCustomerPhone, initialTxnId]);

  if (!isOpen) return null;

  useEffect(() => {
    if (isOpen && initialTxnId && step === 'verifying') {
      const verify = async () => {
        try {
          const serverUrl = import.meta.env.DEV ? '' : 'https://api.lorryguru.in/truck-backend';
          const tempPayloadStr = localStorage.getItem('ttt_temp_payment_payload');
          const tempPayloadObj = tempPayloadStr ? JSON.parse(tempPayloadStr) : null;
          const duration = localStorage.getItem('ttt_temp_payment_duration') || '1 Year';
          const existingTruckId = localStorage.getItem('ttt_temp_payment_truck_id') || '';

          const queryParams = new URLSearchParams({
            truckNo,
            organizationId: organizationId || 'org_default',
            duration,
            customerName: customerName || defaultCustomerName || '',
            customerEmail: customerEmail || defaultCustomerEmail || '',
            customerPhone: customerPhone || defaultCustomerPhone || '',
            existingTruckId,
            truckPayload: JSON.stringify(tempPayloadObj)
          });

          const response = await fetch(`${serverUrl}/api/payment/status/${initialTxnId}?${queryParams.toString()}`);
          const data = await response.json();

          if (response.ok && data.success) {
            const plan = RENEWAL_PLANS.find(p => p.duration === duration) || RENEWAL_PLANS[3];
            setSelectedPlan(plan);
            setTransactionId(initialTxnId);
            playSuccessSound();
            setStep('success');
            // Clean URL query parameters
            window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
          } else {
            setVerificationError(data.message || 'Transaction was not successful');
            setStep('failed');
          }
        } catch (err: any) {
          console.error("Verification error:", err);
          setVerificationError(err.message || 'Network error during verification');
          setStep('failed');
        }
      };
      verify();
    }
  }, [isOpen, initialTxnId, step]);

  // Format Card Number (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 16);
    const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
    setCardNumber(formatted);
  };

  // Format Expiry (MM/YY)
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (value.length > 2) {
      value = `${value.substring(0, 2)}/${value.substring(2)}`;
    }
    setCardExpiry(value);
  };

  // Validate Billing Details
  const handleBillingNext = () => {
    const errors: Record<string, string> = {};
    if (!customerName.trim()) errors.name = 'Name is required';
    if (!customerEmail.trim() || !/\S+@\S+\.\S+/.test(customerEmail)) errors.email = 'Valid email is required';

    let cleanedPhone = customerPhone.replace(/\D/g, '');
    if (cleanedPhone.length === 12 && cleanedPhone.startsWith('91')) {
      cleanedPhone = cleanedPhone.slice(2);
    } else if (cleanedPhone.length > 10) {
      cleanedPhone = cleanedPhone.slice(-10);
    }

    if (!cleanedPhone || !/^\d{10}$/.test(cleanedPhone)) {
      errors.phone = 'Valid 10-digit phone is required';
    } else {
      setCustomerPhone(cleanedPhone);
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setStep('gateway');
  };

  // Trigger simulated payment success audio and flow
  const playSuccessSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      // PhonePe style clean double beep
      const now = audioCtx.currentTime;
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain.gain.linearRampToValueAtTime(0, now + 0.15);
      
      osc.frequency.setValueAtTime(880, now + 0.2); // A5
      gain.gain.setValueAtTime(0, now + 0.2);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.25);
      gain.gain.linearRampToValueAtTime(0, now + 0.45);
      
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      // Audio context might be blocked or unsupported
      console.warn('Audio check could not be played:', e);
    }
  };

  const startPaymentSimulation = async () => {
    // Basic verification for gateway inputs
    if (paymentMethod === 'card') {
      const errors: Record<string, string> = {};
      if (cardNumber.replace(/\s/g, '').length !== 16) errors.cardNo = 'Enter valid 16-digit card number';
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) errors.expiry = 'Enter valid expiry (MM/YY)';
      if (cardCvv.length !== 3) errors.cvv = 'Enter valid 3-digit CVV';
      if (!cardName.trim()) errors.cardName = 'Name on Card is required';
      
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
    }
    
    setFormErrors({});
    setStep('processing');
    setProcessingStatus('Connecting to PhonePe secure gateway...');
    localStorage.setItem('ttt_temp_payment_duration', selectedPlan.duration);

    try {
      const serverUrl = import.meta.env.DEV ? '' : 'https://api.lorryguru.in/truck-backend';
      const res = await fetch(`${serverUrl}/api/payment/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          truckNo,
          amount: selectedPlan.price,
          duration: selectedPlan.duration,
          planName: selectedPlan.name,
          customerName,
          customerEmail,
          customerPhone,
          organizationId: organizationId || 'org_default'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initiate payment');
      }

      setProcessingStatus('Redirecting to secure PhonePe checkout...');
      window.location.href = data.redirectUrl;

    } catch (err: any) {
      console.error('Payment Error:', err);
      alert(`Payment Gateway Error: ${err.message}`);
      setStep('gateway');
    }
  };

  const handleFinalize = () => {
    onSuccess({
      transactionId,
      amount: selectedPlan.price,
      duration: selectedPlan.duration,
      planName: selectedPlan.name,
      customerName,
      customerEmail,
      customerPhone,
      paymentDate: new Date().toISOString(),
      status: 'Success',
      paymentMethod
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header (Hidden in Success Step to look like standard PhonePe receipt) */}
        {step !== 'success' && (
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
            <div className="flex items-center gap-2">
              <div className="bg-[#5f259f] text-white p-1.5 rounded-lg font-black tracking-tighter text-sm flex items-center gap-1 shadow-md shadow-[#5f259f]/20">
                <span className="text-white">PhonePe</span>
              </div>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">| Secure Gateway</span>
            </div>
            {step !== 'processing' && step !== 'verifying' && (
              <button 
                onClick={onClose} 
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* STEP 1: PLAN SELECTOR */}
          {step === 'plan' && (
            <div className="space-y-5">
              <div className="text-center">
                <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                  Validity Renewal
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-2">
                  Select Subscription Plan
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-450 mt-1">
                  Choose a subscription plan to extend validity for Truck <span className="font-bold text-slate-700 dark:text-slate-350">{truckNo}</span>
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {RENEWAL_PLANS.map((plan) => {
                  const isSelected = selectedPlan.id === plan.id;
                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`relative flex items-center justify-between p-4 rounded-xl border transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'border-[#5f259f] bg-purple-50/30 dark:bg-purple-950/10 shadow-lg shadow-purple-500/5'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {plan.popular && (
                        <span className="absolute -top-2 right-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-2.5 h-2.5" /> Best Value
                        </span>
                      )}
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">{plan.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Duration: {plan.duration}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-slate-900 dark:text-white">
                          ₹{plan.price.toLocaleString()}
                        </span>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{plan.label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setStep('billing')}
                  className="w-full h-11 bg-gradient-to-r from-[#5f259f] to-[#7f39d8] hover:from-[#521e8a] hover:to-[#6f2ec2] text-white font-bold rounded-xl shadow-lg shadow-[#5f259f]/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <span>Proceed to Billing Info</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: BILLING INFO */}
          {step === 'billing' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setStep('plan')}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-605 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">Customer Information</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Customer Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#5f259f] focus:ring-1 focus:ring-[#5f259f]"
                    />
                  </div>
                  {formErrors.name && <p className="text-xs text-rose-500 mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="e.g. ramesh@gmail.com"
                      className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#5f259f] focus:ring-1 focus:ring-[#5f259f]"
                    />
                  </div>
                  {formErrors.email && <p className="text-xs text-rose-500 mt-1">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        const digits = val.replace(/\D/g, '');
                        if (digits.length === 12 && digits.startsWith('91')) {
                          setCustomerPhone(digits.slice(2));
                        } else if (digits.length === 13 && val.startsWith('+91')) {
                          setCustomerPhone(digits.slice(3));
                        } else if (digits.length > 10) {
                          setCustomerPhone(digits.slice(-10));
                        } else {
                          setCustomerPhone(val);
                        }
                      }}
                      placeholder="e.g. 9876543210"
                      className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-955 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#5f259f] focus:ring-1 focus:ring-[#5f259f]"
                    />
                  </div>
                  {formErrors.phone && <p className="text-xs text-rose-500 mt-1">{formErrors.phone}</p>}
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Selected Plan:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedPlan.name} ({selectedPlan.duration})</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-slate-500 dark:text-slate-400">Amount Due:</span>
                    <span className="font-extrabold text-[#5f259f] dark:text-purple-400 text-lg">₹{selectedPlan.price.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleBillingNext}
                  className="w-full h-11 bg-gradient-to-r from-[#5f259f] to-[#7f39d8] hover:from-[#521e8a] hover:to-[#6f2ec2] text-white font-bold rounded-xl shadow-lg shadow-[#5f259f]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <span>Proceed to Payment Gateway</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT GATEWAY SELECTION */}
          {step === 'gateway' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/40">
                <div>
                  <div className="text-xs text-slate-400 dark:text-slate-505 font-bold uppercase tracking-wider">Merchant</div>
                  <div className="font-extrabold text-slate-850 dark:text-slate-200 text-sm">Lorry Guru Technologies</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Salem, Tamil Nadu</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Amount Due</div>
                  <div className="font-black text-2xl text-[#5f259f] dark:text-purple-400">₹{selectedPlan.price.toLocaleString()}</div>
                </div>
              </div>

              {/* Payment Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setPaymentMethod('upi')}
                  className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                    paymentMethod === 'upi'
                      ? 'border-[#5f259f] text-[#5f259f] dark:text-purple-400'
                      : 'border-transparent text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>UPI Apps</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'border-[#5f259f] text-[#5f259f] dark:text-purple-400'
                      : 'border-transparent text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Card</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('netbanking')}
                  className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                    paymentMethod === 'netbanking'
                      ? 'border-[#5f259f] text-[#5f259f] dark:text-purple-400'
                      : 'border-transparent text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <Landmark className="w-4 h-4" />
                  <span>Net Banking</span>
                </button>
              </div>

              {/* Payment Tab Panels */}
              <div className="py-2 min-h-[200px]">
                {/* UPI Panel */}
                {paymentMethod === 'upi' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => { setUpiProvider('phonepe'); setCustomUpiId(''); }}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                          upiProvider === 'phonepe' && !customUpiId
                            ? 'border-[#5f259f] bg-purple-50/20 dark:bg-purple-950/10'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="bg-[#5f259f] text-white w-7 h-7 rounded-lg font-black text-[10px] flex items-center justify-center mb-1">PP</div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-350">PhonePe</span>
                      </button>

                      <button
                        onClick={() => { setUpiProvider('gpay'); setCustomUpiId(''); }}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                          upiProvider === 'gpay' && !customUpiId
                            ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/10'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="bg-blue-500 text-white w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center mb-1">G</div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-350">Google Pay</span>
                      </button>

                      <button
                        onClick={() => { setUpiProvider('paytm'); setCustomUpiId(''); }}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                          upiProvider === 'paytm' && !customUpiId
                            ? 'border-sky-500 bg-sky-50/20 dark:bg-sky-950/10'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="bg-sky-500 text-white w-7 h-7 rounded-lg font-bold text-[9px] flex items-center justify-center mb-1">Paytm</div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-350">Paytm</span>
                      </button>
                    </div>

                    <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                      <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase">Or Pay via UPI ID</span>
                      <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={customUpiId}
                        onChange={(e) => { setCustomUpiId(e.target.value); setUpiProvider('other'); }}
                        placeholder="e.g. customer@ybl"
                        className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#5f259f]"
                      />
                    </div>
                  </div>
                )}

                {/* Card Panel */}
                {paymentMethod === 'card' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Card Number</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        placeholder="XXXX XXXX XXXX XXXX"
                        className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#5f259f]"
                      />
                      {formErrors.cardNo && <p className="text-xs text-rose-500 mt-1">{formErrors.cardNo}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expiry (MM/YY)</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={handleExpiryChange}
                          placeholder="MM/YY"
                          className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm text-center focus:outline-none focus:border-[#5f259f]"
                        />
                        {formErrors.expiry && <p className="text-xs text-rose-500 mt-1">{formErrors.expiry}</p>}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CVV</label>
                        <input
                          type="password"
                          maxLength={3}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                          placeholder="***"
                          className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm text-center focus:outline-none focus:border-[#5f259f]"
                        />
                        {formErrors.cvv && <p className="text-xs text-rose-500 mt-1">{formErrors.cvv}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name on Card</label>
                      <input
                        type="text"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="NAME ON CARD"
                        className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-955 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#5f259f]"
                      />
                      {formErrors.cardName && <p className="text-xs text-rose-500 mt-1">{formErrors.cardName}</p>}
                    </div>
                  </div>
                )}

                {/* NetBanking Panel */}
                {paymentMethod === 'netbanking' && (
                  <div className="space-y-4">
                    <label className="block text-xs font-bold text-slate-450 mb-1">Select Bank from Popular Banks</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'sbi', name: 'State Bank of India' },
                        { id: 'hdfc', name: 'HDFC Bank' },
                        { id: 'icici', name: 'ICICI Bank' },
                        { id: 'axis', name: 'Axis Bank' }
                      ].map((bank) => (
                        <button
                          key={bank.id}
                          onClick={() => setSelectedBank(bank.id)}
                          className={`p-3 rounded-lg border text-left text-xs font-bold transition-all cursor-pointer ${
                            selectedBank === bank.id
                              ? 'border-[#5f259f] bg-purple-50/15 dark:bg-purple-950/10 text-[#5f259f] dark:text-purple-400'
                              : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {bank.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-150 dark:border-slate-800/80 pt-4 flex gap-3">
                <button
                  onClick={() => setStep('billing')}
                  className="flex-1 h-11 border border-slate-250 dark:border-slate-750 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer transition-all"
                >
                  Back
                </button>
                <button
                  onClick={startPaymentSimulation}
                  className="flex-[2] h-11 bg-gradient-to-r from-[#5f259f] to-[#7f39d8] hover:from-[#521e8a] hover:to-[#6f2ec2] text-white font-bold rounded-xl shadow-lg shadow-[#5f259f]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Shield className="w-4.5 h-4.5" />
                  <span>Pay Securely ₹{selectedPlan.price.toLocaleString()}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: PROCESSING TRANSACTION */}
          {step === 'processing' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6 text-center">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-purple-200 dark:border-purple-950 rounded-full animate-pulse"></div>
                <Loader2 className="w-10 h-10 text-[#5f259f] dark:text-purple-400 animate-spin absolute top-5 left-5" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h4 className="font-extrabold text-slate-900 dark:text-white text-lg">Transaction Processing</h4>
                <p className="text-sm text-slate-400 dark:text-slate-505 animate-pulse">{processingStatus}</p>
              </div>
              <div className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-800">
                Do not refresh the page or click back button.
              </div>
            </div>
          )}

          {/* STEP 5: SUCCESS RECEIPT */}
          {step === 'success' && (
            <div className="py-2 flex flex-col items-center justify-center space-y-5">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/10 scale-100 animate-bounce">
                <CheckCircle className="w-10 h-10" />
              </div>
              
              <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Payment Successful</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Invoice details below have been sent to your email.</p>
              </div>

              {/* Digital Receipt Card */}
              <div className="w-full bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-200/60 dark:border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-650 dark:text-slate-400">Lorry Guru Technologies</span>
                  </div>
                  <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded uppercase">Paid</span>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-505 block mb-0.5">Truck Reg No</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{truckNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-505 block mb-0.5">Transaction ID</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{transactionId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-505 block mb-0.5">Selected Plan</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedPlan.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-505 block mb-0.5">Validity Duration</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-emerald-600 dark:text-emerald-400">{selectedPlan.duration}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-505 block mb-0.5">Customer Name</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{customerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-505 block mb-0.5">Registered Phone</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{customerPhone}</span>
                  </div>
                </div>

                <div className="border-t border-slate-200/50 dark:border-slate-800/60 pt-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-450 dark:text-slate-505">Amount Paid:</span>
                  <span className="text-xl font-black text-slate-900 dark:text-white">₹{selectedPlan.price.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleFinalize}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
              >
                <span>Continue & Activate Truck</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP: VERIFYING */}
          {step === 'verifying' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6 text-center">
              <div className="relative animate-fade-in">
                <div className="w-20 h-20 border-4 border-purple-200 dark:border-purple-955 rounded-full animate-pulse"></div>
                <Loader2 className="w-10 h-10 text-[#5f259f] dark:text-purple-400 animate-spin absolute top-5 left-5" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h4 className="font-extrabold text-slate-900 dark:text-white text-lg">Verifying Payment</h4>
                <p className="text-sm text-slate-405 dark:text-slate-550 animate-pulse">Checking transaction status with PhonePe secure gateway...</p>
              </div>
            </div>
          )}

          {/* STEP: FAILED */}
          {step === 'failed' && (
            <div className="py-2 flex flex-col items-center justify-center space-y-5 animate-fade-in">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/40 rounded-full flex items-center justify-center text-rose-600 dark:text-rose-455 shadow-lg shadow-rose-500/10">
                <X className="w-10 h-10" />
              </div>
              
              <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Payment Failed / Canceled</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-normal mx-auto">
                  {verificationError || 'Transaction was not successful or was canceled by user.'}
                </p>
              </div>

              <div className="w-full pt-4 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 h-11 border border-slate-250 dark:border-slate-750 text-slate-650 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer transition-all active:scale-[0.98] text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setVerificationError(null);
                    setStep('plan');
                    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
                  }}
                  className="flex-[2] h-11 bg-gradient-to-r from-[#5f259f] to-[#7f39d8] hover:from-[#521e8a] hover:to-[#6f2ec2] text-white font-bold rounded-xl shadow-lg shadow-[#5f259f]/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] text-xs uppercase tracking-wider"
                >
                  <span>Retry Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
