import { createSignal, createEffect } from 'solid-js';
import { X, CreditCard, Shield, Smartphone, Landmark, CheckCircle, ArrowRight, Loader2, Sparkles, Building2, User, Mail, Phone, ArrowLeft, Tag, Check } from 'lucide-solid';
import { appwrite } from '../lib/appwrite';
import { getActiveBackendUrl } from '../lib/backendUrlHelper';
import { Coupon } from '../types';
import { useNotifications } from '../context/NotificationContext';

interface PhonePePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  truckNo: string;
  defaultCustomerName?: string;
  defaultCustomerEmail?: string;
  defaultCustomerPhone?: string;
  initialTxnId?: string;
  organizationId?: string;
  coupons?: Coupon[] | (() => Coupon[]);
  onSaveCoupons?: (coupons: Coupon[], cpnToSave?: Coupon, cpnIdToDelete?: string) => void;
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
    paymentMethod?: 'upi' | 'card' | 'netbanking' | 'coupon';
    couponCode?: string;
  }) => void;
}

const RENEWAL_PLANS = [
  { id: '1_month', name: '1 Month Starter', duration: '1 Month', price: 500, label: '₹500 / Month' },
  { id: '3_months', name: '3 Months Professional', duration: '3 Months', price: 1200, label: '₹1,200 (₹400/mo)' },
  { id: '6_months', name: '6 Months Saver', duration: '6 Months', price: 2200, label: '₹2,200 (₹366/mo)' },
  { id: '1_year', name: '1 Year Premium', duration: '1 Year', price: 4000, label: '₹4,000 (₹333/mo)', popular: true },
];

export default function PhonePePaymentModal(props: PhonePePaymentModalProps) {
  const [step, setStep] = createSignal<'plan' | 'billing' | 'gateway' | 'processing' | 'success' | 'verifying' | 'failed'>(
    props.initialTxnId ? 'verifying' : 'plan'
  );
  const [selectedPlan, setSelectedPlan] = createSignal(RENEWAL_PLANS[3]); // Default to 1 Year Premium
  const [customerName, setCustomerName] = createSignal(props.defaultCustomerName || '');
  const [customerEmail, setCustomerEmail] = createSignal(props.defaultCustomerEmail || '');
  const [customerPhone, setCustomerPhone] = createSignal(props.defaultCustomerPhone || '');
  
  // Coupon state signals
  const [couponInput, setCouponInput] = createSignal('');
  const [appliedCoupon, setAppliedCoupon] = createSignal<Coupon | null>(null);
  const [couponError, setCouponError] = createSignal<string | null>(null);
  const [couponSuccessMsg, setCouponSuccessMsg] = createSignal<string | null>(null);

  // Payment option details
  const [paymentMethod, setPaymentMethod] = createSignal<'upi' | 'card' | 'netbanking'>('upi');
  const [upiProvider, setUpiProvider] = createSignal<'phonepe' | 'gpay' | 'paytm' | 'other'>('phonepe');
  const [customUpiId, setCustomUpiId] = createSignal('');
  
  const [cardNumber, setCardNumber] = createSignal('');
  const [cardExpiry, setCardExpiry] = createSignal('');
  const [cardCvv, setCardCvv] = createSignal('');
  const [cardName, setCardName] = createSignal('');
  
  const [selectedBank, setSelectedBank] = createSignal('sbi');
  
  // Simulation states
  const [processingStatus, setProcessingStatus] = createSignal('Connecting to PhonePe secure gateway...');
  const [transactionId, setTransactionId] = createSignal('');
  const [formErrors, setFormErrors] = createSignal<Record<string, string>>({});
  const [verificationError, setVerificationError] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.isOpen) {
      setStep(props.initialTxnId ? 'verifying' : 'plan');
      setTransactionId(props.initialTxnId || ('TXN' + Math.floor(100000000 + Math.random() * 900000000)));
      setCustomerName(props.defaultCustomerName || '');
      setCustomerEmail(props.defaultCustomerEmail || '');
      setCustomerPhone(props.defaultCustomerPhone || '');
    }
  });

  if (!props.isOpen) return null;

  createEffect(() => {
    if (props.isOpen && props.initialTxnId && step() === 'verifying') {
      const verify = async () => {
        try {
          const serverUrl = await getActiveBackendUrl();
          const tempPayloadStr = sessionStorage.getItem('ttt_temp_payment_payload');
          const tempPayloadObj = tempPayloadStr ? JSON.parse(tempPayloadStr) : null;
          const duration = sessionStorage.getItem('ttt_temp_payment_duration') || '1 Year';
          const existingTruckId = sessionStorage.getItem('ttt_temp_payment_truck_id') || '';

          const queryParams = new URLSearchParams({
            truckNo: props.truckNo,
            organizationId: props.organizationId || 'org_default',
            duration,
            customerName: customerName() || props.defaultCustomerName || '',
            customerEmail: customerEmail() || props.defaultCustomerEmail || '',
            customerPhone: customerPhone() || props.defaultCustomerPhone || '',
            existingTruckId,
            truckPayload: JSON.stringify(tempPayloadObj)
          });

          const jwt = await appwrite.createSessionJwt();
          const response = await fetch(`${serverUrl}/api/payment/status/${props.initialTxnId}?${queryParams.toString()}`, {
            headers: { Authorization: `Bearer ${jwt}` }
          });
          const data = await response.json();

          if (response.ok && data.success) {
            const plan = RENEWAL_PLANS.find(p => p.duration === duration) || RENEWAL_PLANS[3];
            setSelectedPlan(plan);
            setTransactionId(props.initialTxnId!);
            playSuccessSound();
            try {
              const notify = useNotifications();
              notify.showNotification(`Payment successful! Vehicle ${props.truckNo} subscription activated.`);
            } catch (e) {}
            setStep('success');
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
  });

  // Calculate pricing & discount values
  const originalPrice = () => selectedPlan().price;

  const discountAmount = () => {
    const cpn = appliedCoupon();
    if (!cpn) return 0;
    const orig = originalPrice();
    if (cpn.discountType === 'PERCENT') {
      const val = Math.round(orig * (cpn.discountValue / 100));
      return cpn.maxDiscountAmount ? Math.min(val, cpn.maxDiscountAmount) : val;
    } else {
      return Math.min(orig, cpn.discountValue);
    }
  };

  const finalPayable = () => Math.max(0, originalPrice() - discountAmount());

  const getCouponsList = (): Coupon[] => {
    let list: Coupon[] = [];
    if (props.coupons) {
      if (typeof props.coupons === 'function') {
        const res = (props.coupons as any)();
        if (Array.isArray(res)) list = res;
      } else if (Array.isArray(props.coupons)) {
        list = props.coupons;
      }
    }

    try {
      const stored = localStorage.getItem('ttt_coupons');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const ids = new Set(list.map(c => c.id));
          for (const item of parsed) {
            if (item && item.id && !ids.has(item.id)) {
              list.push(item);
            }
          }
        }
      }
    } catch (e) {}

    return list;
  };

  const handleApplyCoupon = () => {
    setCouponError(null);
    setCouponSuccessMsg(null);
    const code = couponInput().trim().toUpperCase();
    if (!code) {
      setCouponError("Please enter a coupon code.");
      return;
    }

    const allCoupons = getCouponsList();
    const match = allCoupons.find(c => c && (
      (c.code && c.code.trim().toUpperCase() === code) ||
      (c.id && c.id.trim().toUpperCase() === code)
    ));
    if (!match) {
      setCouponError(`Invalid coupon code "${code}".`);
      return;
    }

    if (match.status !== 'Active') {
      setCouponError(`Coupon code "${code}" is no longer active.`);
      return;
    }

    // Validate Organization binding
    if (match.organizationId && 
        match.organizationId.toLowerCase() !== 'all' && 
        props.organizationId && 
        match.organizationId.toLowerCase() !== props.organizationId.toLowerCase()) {
      setCouponError(`Coupon code "${code}" is reserved for Organization "${match.organizationId}" (Current Org: "${props.organizationId}").`);
      return;
    }

    if (match.usageLimit && match.usageLimit > 0 && match.usedCount >= match.usageLimit) {
      setCouponError(`Coupon code "${code}" has reached its maximum usage limit.`);
      return;
    }

    if (match.expiryDate) {
      const today = new Date().toISOString().split('T')[0];
      if (match.expiryDate < today) {
        setCouponError(`Coupon code "${code}" expired on ${match.expiryDate}.`);
        return;
      }
    }

    setAppliedCoupon(match);
    const text = match.discountType === 'PERCENT' ? `${match.discountValue}% OFF` : `₹${match.discountValue} OFF`;
    setCouponSuccessMsg(`Coupon "${match.code}" applied! (${text})`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
    setCouponSuccessMsg(null);
  };

  // Trigger simulated payment success audio
  const playSuccessSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
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
      console.warn('Audio check could not be played:', e);
    }
  };

  const handleBillingNext = async () => {
    const errors: Record<string, string> = {};
    if (!customerName().trim()) errors.name = 'Customer name is required';
    if (!customerEmail().trim() || !customerEmail().includes('@')) errors.email = 'Valid email is required';
    if (!customerPhone().trim() || customerPhone().trim().length < 10) errors.phone = 'Valid 10-digit mobile phone is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setFormErrors({});

    // Handle 100% Free Activation when finalPayable is 0!
    if (finalPayable() === 0) {
      const cpn = appliedCoupon();
      const txnId = 'CPN' + Date.now();
      setTransactionId(txnId);
      
      try {
        const allCoupons = getCouponsList();
        const updatedCoupons = allCoupons.map(c => {
          if (c.id === cpn?.id) {
            const newCount = (c.usedCount || 0) + 1;
            const isLimitReached = c.usageLimit && c.usageLimit > 0 && newCount >= c.usageLimit;
            return {
              ...c,
              usedCount: newCount,
              status: isLimitReached ? ('Disabled' as const) : c.status
            };
          }
          return c;
        });
        localStorage.setItem('ttt_coupons', JSON.stringify(updatedCoupons));
        
        const updatedCpn = updatedCoupons.find(c => c.id === cpn?.id);
        if (updatedCpn) {
          if (props.onSaveCoupons) {
            props.onSaveCoupons(updatedCoupons, updatedCpn);
          } else {
            const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
            appwrite.saveFleetDocument(databaseId, 'coupons', updatedCpn.id, updatedCpn.organizationId || 'org_backend', updatedCpn).catch(() => {});
          }
        }
      } catch (e) {}

      playSuccessSound();
      try {
        const notify = useNotifications();
        notify.showNotification(`Coupon "${cpn?.code}" applied! Truck ${props.truckNo} successfully activated for 100% free!`);
      } catch (e) {}
      setStep('success');
      return;
    }

    setStep('processing');
    setProcessingStatus('Connecting to PhonePe secure gateway...');
    sessionStorage.setItem('ttt_temp_payment_duration', selectedPlan().duration);

    try {
      const serverUrl = await getActiveBackendUrl();
      const jwt = await appwrite.createSessionJwt();
      const res = await fetch(`${serverUrl}/api/payment/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({
          truckNo: props.truckNo,
          amount: finalPayable(),
          duration: selectedPlan().duration,
          planName: selectedPlan().name,
          customerName: customerName(),
          customerEmail: customerEmail(),
          customerPhone: customerPhone(),
          organizationId: props.organizationId || 'org_default',
          couponCode: appliedCoupon()?.code
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
    const cpn = appliedCoupon();
    if (cpn) {
      try {
        const allCoupons = getCouponsList();
        const updatedCoupons = allCoupons.map(c => {
          if (c.id === cpn.id) {
            const newCount = (c.usedCount || 0) + 1;
            const isLimitReached = c.usageLimit && c.usageLimit > 0 && newCount >= c.usageLimit;
            return {
              ...c,
              usedCount: newCount,
              status: isLimitReached ? ('Disabled' as const) : c.status
            };
          }
          return c;
        });
        localStorage.setItem('ttt_coupons', JSON.stringify(updatedCoupons));

        const updatedCpn = updatedCoupons.find(c => c.id === cpn.id);
        if (updatedCpn) {
          if (props.onSaveCoupons) {
            props.onSaveCoupons(updatedCoupons, updatedCpn);
          } else {
            const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
            appwrite.saveFleetDocument(databaseId, 'coupons', updatedCpn.id, updatedCpn.organizationId || 'org_backend', updatedCpn).catch(() => {});
          }
        }
      } catch (e) {}
    }

    props.onSuccess({
      transactionId: transactionId(),
      amount: finalPayable(),
      duration: selectedPlan().duration,
      planName: selectedPlan().name,
      customerName: customerName(),
      customerEmail: customerEmail(),
      customerPhone: customerPhone(),
      paymentDate: new Date().toISOString(),
      status: 'Success',
      paymentMethod: finalPayable() === 0 ? 'coupon' : paymentMethod(),
      couponCode: appliedCoupon()?.code
    });
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        {step() !== 'success' && (
          <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
            <div class="flex items-center gap-2">
              <div class="bg-[#5f259f] text-white p-1.5 rounded-lg font-black tracking-tighter text-sm flex items-center gap-1 shadow-md shadow-[#5f259f]/20">
                <span class="text-white">PhonePe</span>
              </div>
              <span class="text-xs font-semibold text-slate-400 dark:text-slate-500">| Secure Gateway</span>
            </div>
            {step() !== 'processing' && step() !== 'verifying' && (
              <button 
                onClick={props.onClose} 
                class="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X class="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Content */}
        <div class="flex-1 overflow-y-auto p-6">
          
          {/* STEP 1: PLAN SELECTOR */}
          {step() === 'plan' && (
            <div class="space-y-5">
              <div class="text-center">
                <span class="bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                  Validity Renewal
                </span>
                <h3 class="text-xl font-extrabold text-slate-900 dark:text-white mt-2">
                  Select Subscription Plan
                </h3>
                <p class="text-sm text-slate-500 dark:text-slate-450 mt-1">
                  Choose a subscription plan to extend validity for Truck <span class="font-bold text-slate-700 dark:text-slate-350">{props.truckNo}</span>
                </p>
              </div>

              <div class="grid grid-cols-1 gap-3">
                {RENEWAL_PLANS.map((plan) => {
                  const isSelected = selectedPlan().id === plan.id;
                  return (
                    <button
                      onClick={() => setSelectedPlan(plan)}
                      class={`relative flex items-center justify-between p-4 rounded-xl border transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'border-[#5f259f] bg-purple-50/30 dark:bg-purple-950/10 shadow-lg shadow-purple-500/5'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {plan.popular && (
                        <span class="absolute -top-2 right-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                          <Sparkles class="w-2.5 h-2.5" /> Best Value
                        </span>
                      )}
                      <div>
                        <h4 class="font-bold text-slate-900 dark:text-white">{plan.name}</h4>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Duration: {plan.duration}</p>
                      </div>
                      <div class="text-right">
                        <span class="text-lg font-black text-slate-900 dark:text-white">
                          ₹{plan.price.toLocaleString()}
                        </span>
                        <div class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{plan.label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div class="pt-4">
                <button
                  onClick={() => setStep('billing')}
                  class="w-full h-11 bg-gradient-to-r from-[#5f259f] to-[#7f39d8] hover:from-[#521e8a] hover:to-[#6f2ec2] text-white font-bold rounded-xl shadow-lg shadow-[#5f259f]/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <span>Proceed to Billing Info</span>
                  <ArrowRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: BILLING INFO */}
          {step() === 'billing' && (
            <div class="space-y-5">
              <div class="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setStep('plan')}
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-605 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ArrowLeft class="w-4 h-4" />
                </button>
                <h3 class="text-lg font-bold text-slate-950 dark:text-white">Customer Information</h3>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Customer Name
                  </label>
                  <div class="relative">
                    <User class="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={customerName()}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      class="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#5f259f] focus:ring-1 focus:ring-[#5f259f]"
                    />
                  </div>
                  {formErrors().name && <p class="text-xs text-rose-500 mt-1">{formErrors().name}</p>}
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div class="relative">
                    <Mail class="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={customerEmail()}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="e.g. ramesh@gmail.com"
                      class="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#5f259f] focus:ring-1 focus:ring-[#5f259f]"
                    />
                  </div>
                  {formErrors().email && <p class="text-xs text-rose-500 mt-1">{formErrors().email}</p>}
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <div class="relative">
                    <Phone class="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={customerPhone()}
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
                      class="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-955 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#5f259f] focus:ring-1 focus:ring-[#5f259f]"
                    />
                  </div>
                  {formErrors().phone && <p class="text-xs text-rose-500 mt-1">{formErrors().phone}</p>}
                </div>

                {/* COUPON CODE PROMO WIDGET */}
                <div class="bg-amber-500/5 dark:bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 space-y-2">
                  <label class="block text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag class="w-3.5 h-3.5" /> Have a Coupon Code?
                  </label>
                  {appliedCoupon() ? (
                    <div class="flex items-center justify-between bg-white dark:bg-slate-900 border border-emerald-500/40 p-2.5 rounded-lg text-xs">
                      <div class="flex items-center gap-2">
                        <Check class="w-4 h-4 text-emerald-500" />
                        <div>
                          <span class="font-mono font-black text-emerald-600 dark:text-emerald-400 uppercase">{appliedCoupon()?.code}</span>
                          <span class="text-[10px] text-slate-500 dark:text-slate-400 block">
                            {appliedCoupon()?.discountType === 'PERCENT' ? `${appliedCoupon()?.discountValue}% Discount Applied` : `₹${appliedCoupon()?.discountValue} Discount Applied`}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        class="text-rose-500 hover:text-rose-700 text-[11px] font-bold p-1 rounded transition cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div class="flex gap-2">
                      <input
                        type="text"
                        value={couponInput()}
                        onInput={(e) => setCouponInput(e.currentTarget.value.toUpperCase())}
                        placeholder="Enter Promo / Coupon Code"
                        class="flex-1 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                  {couponError() && <p class="text-xs text-rose-500 font-medium">{couponError()}</p>}
                  {couponSuccessMsg() && <p class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{couponSuccessMsg()}</p>}
                </div>

                <div class="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-1.5">
                  <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-500 dark:text-slate-400">Selected Plan:</span>
                    <span class="font-bold text-slate-800 dark:text-slate-200">{selectedPlan().name} ({selectedPlan().duration})</span>
                  </div>
                  <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-500 dark:text-slate-400">Original Price:</span>
                    <span class="font-semibold text-slate-700 dark:text-slate-300 font-mono">₹{originalPrice().toLocaleString()}</span>
                  </div>
                  {appliedCoupon() && (
                    <div class="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      <span>Discount ({appliedCoupon()?.code}):</span>
                      <span class="font-mono">-₹{discountAmount().toLocaleString()}</span>
                    </div>
                  )}
                  <div class="pt-1 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-sm">
                    <span class="font-bold text-slate-700 dark:text-slate-300">Final Amount Due:</span>
                    <span class="font-black text-[#5f259f] dark:text-purple-400 text-lg font-mono">₹{finalPayable().toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div class="pt-4">
                <button
                  onClick={handleBillingNext}
                  class={`w-full h-11 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    finalPayable() === 0
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-[#5f259f] to-[#7f39d8] hover:from-[#521e8a] hover:to-[#6f2ec2] shadow-[#5f259f]/20'
                  }`}
                >
                  {finalPayable() === 0 ? (
                    <>
                      <Sparkles class="w-4 h-4" />
                      <span>Complete 100% Free Activation (Pay ₹0)</span>
                    </>
                  ) : (
                    <>
                      <span>Proceed to Payment Gateway</span>
                      <ArrowRight class="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS STEP */}
          {step() === 'success' && (
            <div class="text-center py-6 space-y-4 animate-fade-in">
              <div class="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle class="w-10 h-10" />
              </div>
              <div>
                <h3 class="text-xl font-black text-slate-900 dark:text-white">Subscription Activated!</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Validity successfully extended for Truck <span class="font-bold text-slate-700 dark:text-slate-350">{props.truckNo}</span>.
                </p>
              </div>

              <div class="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-left space-y-2 text-xs">
                <div class="flex justify-between">
                  <span class="text-slate-400">Transaction ID:</span>
                  <span class="font-mono font-bold text-slate-700 dark:text-slate-300">{transactionId()}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-400">Amount Paid:</span>
                  <span class="font-bold text-emerald-600 dark:text-emerald-400 font-mono">₹{finalPayable().toLocaleString()}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-400">Plan Duration:</span>
                  <span class="font-bold text-slate-700 dark:text-slate-300">{selectedPlan().duration}</span>
                </div>
              </div>

              <button
                onClick={handleFinalize}
                class="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          )}

          {/* STEP 4: PROCESSING */}
          {step() === 'processing' && (
            <div class="text-center py-12 space-y-4">
              <Loader2 class="w-10 h-10 text-[#5f259f] animate-spin mx-auto" />
              <h3 class="text-base font-bold text-slate-800 dark:text-white">{processingStatus()}</h3>
              <p class="text-xs text-slate-400">Please do not refresh or close this window.</p>
            </div>
          )}

          {/* STEP 5: VERIFYING */}
          {step() === 'verifying' && (
            <div class="text-center py-12 space-y-4">
              <Loader2 class="w-10 h-10 text-[#5f259f] animate-spin mx-auto" />
              <h3 class="text-base font-bold text-slate-800 dark:text-white">Verifying Payment Status...</h3>
              <p class="text-xs text-slate-400">Confirming transaction receipt from gateway server...</p>
            </div>
          )}

          {/* STEP 6: FAILED */}
          {step() === 'failed' && (
            <div class="text-center py-8 space-y-4">
              <div class="w-14 h-14 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
                <X class="w-8 h-8" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-slate-900 dark:text-white">Payment Failed or Cancelled</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{verificationError() || 'Transaction could not be completed.'}</p>
              </div>
              <button
                onClick={() => setStep('plan')}
                class="w-full h-11 bg-[#5f259f] hover:bg-[#521e8a] text-white font-bold rounded-xl shadow-lg transition cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
