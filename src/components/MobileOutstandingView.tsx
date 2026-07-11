import React, { useState, useRef } from 'react';
import { 
  TripEntry, 
  Truck, 
  Office, 
  Account, 
  getTripMetrics, 
  ExpenseEntry, 
  importLegacyCargoExpenses 
} from '../types';
import { 
  Building2, 
  Navigation, 
  Share2, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  AlertCircle, 
  Calendar,
  FileText,
  X,
  CreditCard
} from 'lucide-react';
import { useSwipeableList } from '../hooks/useSwipeableList';

interface MobileOutstandingViewProps {
  trips: TripEntry[];
  trucks: Truck[];
  offices: Office[];
  accounts: Account[];
  orgProfile?: any;
  expenses?: ExpenseEntry[];
  onSaveTrips?: (newTrips: TripEntry[]) => void;
}

export default function MobileOutstandingView({
  trips: rawTrips,
  trucks,
  offices,
  accounts,
  orgProfile,
  expenses = [],
  onSaveTrips
}: MobileOutstandingViewProps) {
  const trips = rawTrips.filter(t => t.status !== 'Deleted' && !t.deletedAt);
  const [outstandingTab, setOutstandingTab] = useState<'office' | 'truck'>('office');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick Pay Modal State
  const [quickPayTarget, setQuickPayTarget] = useState<{
    tripId: string;
    subTripId: string;
    officeName: string;
    route: string;
    balance: number;
    truckNo?: string;
  } | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().substring(0, 10));
  const [payAccount, setPayAccount] = useState('');
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payNotes, setPayNotes] = useState('');

  // Swipe list state using reusable hook
  const { isSwiped, getTouchHandlers, setSwipedId } = useSwipeableList();

  // Group outstanding balance by Truck
  const truckOutstandingMap: { [key: string]: number } = {};
  trips.forEach(t => {
    const m = getTripMetrics(t);
    const balAttr = m.outstandingBalance;
    if (balAttr > 0) {
      truckOutstandingMap[t.truckNo] = (truckOutstandingMap[t.truckNo] || 0) + balAttr;
    }
  });

  const topOutstandingTrucks = Object.entries(truckOutstandingMap).map(([truckNo, amount]) => ({
    truckNo,
    amount
  })).sort((a, b) => b.amount - a.amount);

  // Group outstanding balance by Office
  const officeOutstandingMap: { [key: string]: number } = {};
  trips.forEach(t => {
    const m = getTripMetrics(t);
    if (m.outstandingBalance > 0) {
      const segDetails: { office: string; balance: number }[] = [];
      const subTrips = t.subTrips || [];
      subTrips.forEach(st => {
        let segDeductions = 0;
        let segOfficeBears = 0;

        let cargoExps = st.cargoExpenses;
        if (typeof cargoExps === 'string') {
          try {
            cargoExps = JSON.parse(cargoExps);
          } catch {
            cargoExps = [];
          }
        }
        if (!cargoExps || cargoExps.length === 0) {
          cargoExps = importLegacyCargoExpenses(st, orgProfile);
        }

        cargoExps.forEach(exp => {
          const amt = Number(exp.amount) || 0;
          if (exp.deductedFrom === 'OrgRental') {
            segDeductions += amt;
          }
          if (exp.bears === 'Office') {
            segOfficeBears += amt;
          }
        });

        const segPayments = (t.payments || []).filter(p => p.subTripId === st.id).reduce((sum, p) => sum + p.amount, 0);
        const segBalance = st.income - segDeductions + segOfficeBears - segPayments;

        segDetails.push({
          office: st.officeName || 'Indirect/General',
          balance: segBalance
        });
      });

      const unassignedPayments = (t.payments || []).filter(p => !p.subTripId).reduce((sum, p) => sum + p.amount, 0);
      if (unassignedPayments > 0 && segDetails.length > 0) {
        const share = Math.round(unassignedPayments / segDetails.length);
        segDetails.forEach(item => {
          item.balance = Math.max(0, item.balance - share);
        });
      }

      segDetails.forEach(item => {
        if (item.balance > 0) {
          officeOutstandingMap[item.office] = (officeOutstandingMap[item.office] || 0) + item.balance;
        }
      });
    }
  });

  const topOutstandingOffices = Object.entries(officeOutstandingMap).map(([officeName, amount]) => ({
    officeName,
    amount
  })).sort((a, b) => b.amount - a.amount);

  // Detailed info per truck
  const getTruckHoverDetails = (tNo: string) => {
    const truckTrips = trips.filter(t => t.truckNo === tNo);
    let totalIncome = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    const officesUsed = new Set<string>();
    const detailsList: any[] = [];

    truckTrips.forEach(t => {
      const m = getTripMetrics(t);
      if (m.outstandingBalance > 0) {
        (t.subTrips || []).forEach(st => {
          if (st.officeName) officesUsed.add(st.officeName);
          
          let segDeductions = 0;
          let segOfficeBears = 0;

          let cargoExps = st.cargoExpenses;
          if (typeof cargoExps === 'string') {
            try {
              cargoExps = JSON.parse(cargoExps);
            } catch {
              cargoExps = [];
            }
          }
          if (!cargoExps || cargoExps.length === 0) {
            cargoExps = importLegacyCargoExpenses(st, orgProfile);
          }

          cargoExps.forEach(exp => {
            const amt = Number(exp.amount) || 0;
            if (exp.deductedFrom === 'OrgRental') {
              segDeductions += amt;
            }
            if (exp.bears === 'Office') {
              segOfficeBears += amt;
            }
          });

          const segPayments = (t.payments || []).filter(p => p.subTripId === st.id).reduce((sum, p) => sum + p.amount, 0);
          const segBalance = st.income - segDeductions + segOfficeBears - segPayments;

          detailsList.push({
            tripId: t.id,
            subTripId: st.id,
            office: st.officeName || 'Indirect/General',
            income: st.income,
            advance: segPayments,
            balance: segBalance,
            date: st.loadingDate || t.startDate || '—',
            routeFrom: st.routeFrom,
            routeTo: st.routeTo
          });
        });

        const unassignedPayments = (t.payments || []).filter(p => !p.subTripId).reduce((sum, p) => sum + p.amount, 0);
        if (unassignedPayments > 0 && detailsList.length > 0) {
          const share = Math.round(unassignedPayments / detailsList.length);
          detailsList.forEach(item => {
            item.advance += share;
            item.balance = Math.max(0, item.balance - share);
          });
        }

        totalIncome += m.income;
        totalPaid += m.paymentsReceived;
        totalBalance += m.outstandingBalance;
      }
    });

    const officeList = Array.from(officesUsed).join(', ') || 'N/A';
    totalBalance = Math.max(0, totalBalance);

    return {
      officeList,
      totalIncome,
      totalPaid,
      totalBalance,
      detailsList: detailsList.filter(d => d.balance > 0)
    };
  };

  // Detailed info per office
  const getOfficeHoverDetails = (oName: string) => {
    let totalIncome = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    const trucksUsed = new Set<string>();
    const detailsList: any[] = [];

    trips.forEach(t => {
      const m = getTripMetrics(t);
      if (m.outstandingBalance > 0) {
        const matchingSegs: { st: any; segDeductions: number; segOfficeBears: number; segPayments: number; segBalance: number }[] = [];
        
        (t.subTrips || []).forEach(st => {
          const stOffice = st.officeName || 'Indirect/General';
          if (stOffice === oName) {
            trucksUsed.add(t.truckNo);
            
            let segDeductions = 0;
            let segOfficeBears = 0;

            let cargoExps = st.cargoExpenses;
            if (typeof cargoExps === 'string') {
              try {
                cargoExps = JSON.parse(cargoExps);
              } catch {
                cargoExps = [];
              }
            }
            if (!cargoExps || cargoExps.length === 0) {
              cargoExps = importLegacyCargoExpenses(st, orgProfile);
            }

            cargoExps.forEach(exp => {
              const amt = Number(exp.amount) || 0;
              if (exp.deductedFrom === 'OrgRental') {
                segDeductions += amt;
              }
              if (exp.bears === 'Office') {
                segOfficeBears += amt;
              }
            });

            const segPayments = (t.payments || []).filter(p => p.subTripId === st.id).reduce((sum, p) => sum + p.amount, 0);
            const segBalance = st.income - segDeductions + segOfficeBears - segPayments;

            matchingSegs.push({
              st,
              segDeductions,
              segOfficeBears,
              segPayments,
              segBalance
            });
          }
        });

        const tripTotalSegs = (t.subTrips || []).length;
        if (matchingSegs.length > 0 && tripTotalSegs > 0) {
          const unassignedPayments = (t.payments || []).filter(p => !p.subTripId).reduce((sum, p) => sum + p.amount, 0);
          const sharePerSeg = Math.round(unassignedPayments / tripTotalSegs);
          
          matchingSegs.forEach(item => {
            const finalAdvance = item.segPayments + sharePerSeg;
            const finalBalance = Math.max(0, item.segBalance - sharePerSeg);
            
            totalIncome += item.st.income;
            totalPaid += finalAdvance;
            totalBalance += finalBalance;

            if (finalBalance > 0) {
              detailsList.push({
                tripId: t.id,
                subTripId: item.st.id,
                truckNo: t.truckNo,
                income: item.st.income,
                advance: finalAdvance,
                balance: finalBalance,
                date: item.st.loadingDate || t.startDate || '—',
                routeFrom: item.st.routeFrom,
                routeTo: item.st.routeTo
              });
            }
          });
        }
      }
    });

    const truckList = Array.from(trucksUsed).join(', ') || 'N/A';
    totalBalance = Math.max(0, totalBalance);

    return {
      truckList,
      totalIncome,
      totalPaid,
      totalBalance,
      detailsList: detailsList.filter(d => d.balance > 0)
    };
  };

  const getTruckShareText = (truckNo: string, det: any) => {
    const activeSegs = det.detailsList.filter((seg: any) => seg.balance > 0);
    let text = `Outstanding Details for Truck: ${truckNo}\n`;
    text += `Loading Office(s): ${det.officeList || 'N/A'}\n`;
    text += `Billed Income: ₹${det.totalIncome.toLocaleString()}\n`;
    text += `Total Paid / Advance: ₹${det.totalPaid.toLocaleString()}\n`;
    text += `Net Outstanding: ₹${det.totalBalance.toLocaleString()}\n\n`;
    
    if (activeSegs.length > 0) {
      text += `Pending Segment Details:\n`;
      activeSegs.forEach((seg: any) => {
        text += `- Office: ${seg.office}\n`;
        text += `  Date: ${seg.date}\n`;
        text += `  Consignment Value: ₹${seg.income.toLocaleString()}\n`;
        text += `  Received: ₹${seg.advance.toLocaleString()}\n`;
        text += `  Outstanding: ₹${seg.balance.toLocaleString()}\n`;
      });
    }
    return text;
  };

  const getOfficeShareText = (officeName: string, det: any) => {
    const activeSegs = det.detailsList.filter((seg: any) => seg.balance > 0);
    let text = `Outstanding Details for Office: ${officeName}\n`;
    text += `Active Truck(s): ${det.truckList || 'N/A'}\n`;
    text += `Billed Income: ₹${det.totalIncome.toLocaleString()}\n`;
    text += `Total Paid / Advance: ₹${det.totalPaid.toLocaleString()}\n`;
    text += `Net Outstanding: ₹${det.totalBalance.toLocaleString()}\n\n`;
    
    if (activeSegs.length > 0) {
      text += `Pending Journeys:\n`;
      activeSegs.forEach((seg: any) => {
        text += `- Truck: ${seg.truckNo}\n`;
        text += `  Date: ${seg.date}\n`;
        text += `  Consignment Value: ₹${seg.income.toLocaleString()}\n`;
        text += `  Received: ₹${seg.advance.toLocaleString()}\n`;
        text += `  Outstanding: ₹${seg.balance.toLocaleString()}\n`;
      });
    }
    return text;
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateAndShareReceipt = async (name: string, isOffice: boolean, totalAmount: number, details: any) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    const rowCount = details.detailsList.length;
    canvas.height = 420 + rowCount * 70;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#1e1b4b'); // indigo-950
    bgGrad.addColorStop(1, '#0f172a'); // slate-900
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative Circle Accent
    ctx.beginPath();
    ctx.arc(600, 0, 200, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, canvas.height, 150, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.06)';
    ctx.fill();

    // Draw Header Logo/Text
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px system-ui, -apple-system, sans-serif';
    ctx.fillText('LorryGuru', 40, 60);

    ctx.fillStyle = '#818cf8';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('FLEET MANAGER STATEMENT', 40, 82);

    // Date of Generation
    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, 560, 60);
    ctx.textAlign = 'left';

    // White Card Background
    ctx.fillStyle = '#ffffff';
    const cardX = 30;
    const cardY = 110;
    const cardW = 540;
    const cardH = canvas.height - 180;
    const radius = 24;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fill();

    // Receipt Label
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(isOffice ? 'OFFICE OUTSTANDING STATEMENT' : 'TRUCK OUTSTANDING STATEMENT', 55, 150);

    // Subject Name (Office Name / Truck No)
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(name, 55, 185);

    // Total Outstanding Badge
    ctx.fillStyle = '#fffbeb'; // amber-50
    ctx.strokeStyle = '#fde68a'; // amber-200
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(55, 205, 490, 80, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#b45309'; // amber-700
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('TOTAL DUE BALANCE', 75, 238);

    ctx.fillStyle = '#b45309';
    ctx.font = '900 32px system-ui, -apple-system, sans-serif';
    ctx.fillText(`₹${totalAmount.toLocaleString('en-IN')}`, 75, 272);

    // List Title
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(isOffice ? 'Pending Transport Consignments' : 'Active Office Ledger Balances', 55, 320);

    // Table Header Line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(55, 335);
    ctx.lineTo(545, 335);
    ctx.stroke();

    // Draw Segments
    let currentY = 365;
    details.detailsList.forEach((seg: any) => {
      // Left: Truck/Office & Date
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(isOffice ? seg.truckNo : seg.office, 55, currentY);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(seg.date, 55, currentY + 18);

      // Middle: Route Info
      ctx.fillStyle = '#475569';
      ctx.font = '500 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${seg.routeFrom || ''} → ${seg.routeTo || ''}`, 200, currentY + 8);

      // Right: Billed & Received summary
      ctx.fillStyle = '#64748b';
      ctx.font = '500 10px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Bill: ₹${seg.income.toLocaleString()}`, 360, currentY);
      ctx.fillText(`Recd: ₹${seg.advance.toLocaleString()}`, 360, currentY + 18);

      // Right: Balance Due
      ctx.fillStyle = '#dc2626'; // red-600
      ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`₹${seg.balance.toLocaleString()}`, 545, currentY + 10);
      ctx.textAlign = 'left';

      // Divider
      ctx.strokeStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(55, currentY + 30);
      ctx.lineTo(545, currentY + 30);
      ctx.stroke();

      currentY += 70;
    });

    // Footer branding on the card
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POWERED BY LORRYGURU.COM FLEET SYSTEMS', 300, canvas.height - 90);
    ctx.textAlign = 'left';

    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        const isCapacitor = typeof window !== 'undefined' && (window.location.protocol === 'capacitor:' || !!(window as any).Capacitor);
        if (isCapacitor) {
          try {
            const { Filesystem, Directory } = await import('@capacitor/filesystem');
            const { Share } = await import('@capacitor/share');

            // Convert blob to base64 for writing to file system
            const reader = new FileReader();
            const base64Data = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => {
                const base64String = reader.result as string;
                // Strip the data URL prefix (e.g. "data:image/png;base64,")
                const base64Raw = base64String.split(',')[1] || base64String;
                resolve(base64Raw);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            const fileName = `outstanding_${name.replace(/\s+/g, '_')}.png`;
            const writeResult = await Filesystem.writeFile({
              path: fileName,
              data: base64Data,
              directory: Directory.Cache
            });

            await Share.share({
              title: `${name} Outstanding`,
              text: `Outstanding statement receipt for ${name} generated via LorryGuru.`,
              url: writeResult.uri
            });
            return;
          } catch (capErr) {
            console.error('Capacitor native sharing failed, falling back:', capErr);
          }
        }

        const file = new File([blob], `outstanding_${name.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${name} Outstanding`,
            text: `Outstanding statement receipt for ${name} generated via LorryGuru.`
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `outstanding_${name.replace(/\s+/g, '_')}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          const textFallback = isOffice ? getOfficeShareText(name, details) : getTruckShareText(name, details);
          navigator.clipboard.writeText(textFallback);
          alert('Receipt image downloaded to device. Statement details copied to clipboard!');
        }
      }
    } catch (err) {
      console.error('Sharing failed:', err);
      const textFallback = isOffice ? getOfficeShareText(name, details) : getTruckShareText(name, details);
      navigator.clipboard.writeText(textFallback);
      alert('Details copied to clipboard!');
    }
  };

  const totalOutstandingSum = trips.reduce((sum, t) => sum + getTripMetrics(t).outstandingBalance, 0);

  const triggerQuickPay = (seg: any, groupName: string) => {
    setPayDate(new Date().toISOString().substring(0, 10));
    setPayAccount(accounts[0]?.id || '');
    setPayAmount(seg.balance);
    setPayNotes(`Payment: ${groupName}`);
    setQuickPayTarget({
      tripId: seg.tripId,
      subTripId: seg.subTripId,
      officeName: groupName,
      route: `${seg.routeFrom || 'Origin'} ➔ ${seg.routeTo || 'Destination'}`,
      balance: seg.balance,
      truckNo: seg.truckNo || groupName
    });
  };

  return (
    <div className="space-y-4 font-sans pb-8">
      {/* Top Banner Overview */}
      <div className="bg-gradient-to-tr from-amber-600 to-orange-700 text-white rounded-3xl p-5 shadow-md flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-widest text-orange-200">Total Outstanding Balance</span>
          <h2 className="text-2xl font-black font-mono">₹{totalOutstandingSum.toLocaleString('en-IN')}</h2>
        </div>
        <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800">
        <button
          onClick={() => {
            setOutstandingTab('office');
            setExpandedItem(null);
            setSwipedId(null);
          }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition duration-150 cursor-pointer text-center ${
            outstandingTab === 'office'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          By Office
        </button>
        <button
          onClick={() => {
            setOutstandingTab('truck');
            setExpandedItem(null);
            setSwipedId(null);
          }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition duration-150 cursor-pointer text-center ${
            outstandingTab === 'truck'
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          By Truck
        </button>
      </div>

      {/* Lists */}
      <div className="space-y-3">
        {outstandingTab === 'office' ? (
          topOutstandingOffices.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-8 text-center">
              <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">All office balances are fully settled.</p>
            </div>
          ) : (
            topOutstandingOffices.map(({ officeName, amount }) => {
              const details = getOfficeHoverDetails(officeName);
              const isExpanded = expandedItem === officeName;
              return (
                <div key={officeName} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-2xs">
                  <div 
                    onClick={() => {
                      setExpandedItem(isExpanded ? null : officeName);
                      setSwipedId(null);
                    }}
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-455 flex items-center justify-center border border-rose-500/15 shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-black text-slate-850 dark:text-slate-200 uppercase truncate font-mono tracking-wider">{officeName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-150 dark:border-red-900/40 px-2 py-0.5 rounded shadow-3xs">
                        ₹{amount.toLocaleString('en-IN')}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/20 p-4 space-y-3 font-sans">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="font-semibold">Trucks Used: {details.truckList}</span>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(getOfficeShareText(officeName, details), officeName + '-text');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[9px] font-bold border border-slate-200 dark:border-slate-700/60 transition cursor-pointer"
                          >
                            {copiedId === officeName + '-text' ? 'Copied!' : 'Copy Text'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generateAndShareReceipt(officeName, true, amount, details);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg text-[9px] font-extrabold transition cursor-pointer border border-blue-100 dark:border-blue-800/85"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Share Receipt</span>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                        <p className="text-[8px] text-slate-400 italic mb-1">Swipe left on any consignment to quickly Register Payment.</p>
                        {details.detailsList.map((seg: any, idx: number) => {
                          const cardId = `off-${officeName}-${seg.subTripId}`;
                          return (
                            <div 
                              key={idx} 
                              className="relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 shadow-3xs"
                              {...getTouchHandlers(cardId)}
                            >
                              {/* Background Pay Slide Action */}
                              <div className="absolute inset-0 flex justify-end bg-blue-650 z-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerQuickPay(seg, officeName);
                                    setSwipedId(null);
                                  }}
                                  className="h-full w-20 bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center cursor-pointer transition active:bg-blue-750"
                                >
                                  Pay
                                </button>
                              </div>

                              {/* Foreground Sliding Card */}
                              <div 
                                style={{ transform: isSwiped(cardId) ? 'translateX(-80px)' : 'translateX(0px)' }}
                                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 p-2.5 text-[10px] space-y-1 font-sans relative z-10 transition-transform duration-200"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{seg.truckNo}</span>
                                  <span className="text-slate-400 font-medium flex items-center gap-1">
                                    <Calendar className="w-2.5 h-2.5" />
                                    {seg.date}
                                  </span>
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 font-semibold truncate">
                                  Route: {seg.routeFrom || '—'} → {seg.routeTo || '—'}
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-50 dark:border-slate-800/40 pt-1.5 mt-1">
                                  <div className="flex gap-3 text-slate-400 font-medium">
                                    <span>Billed: <strong className="text-slate-600 dark:text-slate-300">₹{seg.income.toLocaleString()}</strong></span>
                                    <span>Received: <strong className="text-slate-600 dark:text-slate-300">₹{seg.advance.toLocaleString()}</strong></span>
                                  </div>
                                  <span className="font-bold text-red-600 dark:text-red-400 font-mono">₹{seg.balance.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          topOutstandingTrucks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-8 text-center">
              <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">All truck balances are fully settled.</p>
            </div>
          ) : (
            topOutstandingTrucks.map(({ truckNo, amount }) => {
              const details = getTruckHoverDetails(truckNo);
              const isExpanded = expandedItem === truckNo;
              return (
                <div key={truckNo} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-2xs">
                  <div 
                    onClick={() => {
                      setExpandedItem(isExpanded ? null : truckNo);
                      setSwipedId(null);
                    }}
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/15 shrink-0">
                        <Navigation className="w-4 h-4 rotate-45" />
                      </div>
                      <span className="text-xs font-black text-slate-850 dark:text-slate-200 uppercase truncate font-mono tracking-wider">{truckNo}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-150 dark:border-red-900/40 px-2 py-0.5 rounded shadow-3xs">
                        ₹{amount.toLocaleString('en-IN')}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/20 p-4 space-y-3 font-sans">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="font-semibold">Loading Offices: {details.officeList}</span>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(getTruckShareText(truckNo, details), truckNo + '-text');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[9px] font-bold border border-slate-200 dark:border-slate-700/60 transition cursor-pointer"
                          >
                            {copiedId === truckNo + '-text' ? 'Copied!' : 'Copy Text'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              generateAndShareReceipt(truckNo, false, amount, details);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg text-[9px] font-extrabold transition cursor-pointer border border-blue-100 dark:border-blue-800/85"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Share Receipt</span>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                        <p className="text-[8px] text-slate-400 italic mb-1">Swipe left on any office segment to quickly Register Payment.</p>
                        {details.detailsList.map((seg: any, idx: number) => {
                          const cardId = `trk-${truckNo}-${seg.subTripId}`;
                          return (
                            <div 
                              key={idx} 
                              className="relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 shadow-3xs"
                              {...getTouchHandlers(cardId)}
                            >
                              {/* Background Pay Slide Action */}
                              <div className="absolute inset-0 flex justify-end bg-blue-650 z-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerQuickPay(seg, truckNo);
                                    setSwipedId(null);
                                  }}
                                  className="h-full w-20 bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center cursor-pointer transition active:bg-blue-750"
                                >
                                  Pay
                                </button>
                              </div>

                              {/* Foreground Sliding Card */}
                              <div 
                                style={{ transform: isSwiped(cardId) ? 'translateX(-80px)' : 'translateX(0px)' }}
                                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 p-2.5 text-[10px] space-y-1 font-sans relative z-10 transition-transform duration-200"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{seg.office}</span>
                                  <span className="text-slate-400 font-medium flex items-center gap-1">
                                    <Calendar className="w-2.5 h-2.5" />
                                    {seg.date}
                                  </span>
                                </div>
                                <div className="text-slate-500 dark:text-slate-400 font-semibold truncate">
                                  Route: {seg.routeFrom || '—'} → {seg.routeTo || '—'}
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-50 dark:border-slate-800/40 pt-1.5 mt-1">
                                  <div className="flex gap-3 text-slate-400 font-medium">
                                    <span>Billed: <strong className="text-slate-600 dark:text-slate-300">₹{seg.income.toLocaleString()}</strong></span>
                                    <span>Received: <strong className="text-slate-600 dark:text-slate-300">₹{seg.advance.toLocaleString()}</strong></span>
                                  </div>
                                  <span className="font-bold text-red-600 dark:text-red-400 font-mono">₹{seg.balance.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )
        )}
      </div>

      {/* QUICK ADD PAYMENT RECEIPT MODAL */}
      {quickPayTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 no-print animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xl max-w-sm w-full animate-scale-up font-sans text-left">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider font-sans flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Register Payment
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                  Quick recording: <strong className="text-blue-600">{quickPayTarget.route}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickPayTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800">
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Office Branch</span>
                <span className="text-slate-850 dark:text-white font-bold truncate block">{quickPayTarget.officeName}</span>
              </div>
              {quickPayTarget.truckNo && (
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Truck No</span>
                  <span className="text-slate-850 dark:text-white font-mono font-bold tracking-wider block">{quickPayTarget.truckNo}</span>
                </div>
              )}
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Receipt Date</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 text-slate-850 dark:text-white rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Ledger Account</label>
                <select
                  value={payAccount}
                  onChange={(e) => setPayAccount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 text-slate-850 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 font-bold"
                >
                  <option value="">-- Choose Account --</option>
                  <option value="paid_to_driver_advance">Paid to Driver Advance</option>
                  <option value="Cash">Cash</option>
                  {orgProfile?.fuelCards && orgProfile.fuelCards.filter((c: any) => c.status === 'Active' || c.id === payAccount).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.cardName} (Fuel Card)</option>
                  ))}
                  {accounts.map(ac => (
                    <option key={ac.id} value={ac.id}>{ac.accountName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  placeholder="₹0.00"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 text-slate-850 dark:text-white rounded-lg px-3 py-2 font-mono font-bold text-right focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 text-base text-emerald-700 dark:text-emerald-450"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Notes / Cargo Ref</label>
                <input
                  type="text"
                  placeholder="e.g. Bank online transfer"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 text-slate-805 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setQuickPayTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!onSaveTrips) return;
                  const amt = Number(payAmount) || 0;
                  if (amt <= 0) {
                    alert("Please enter a valid amount greater than 0.");
                    return;
                  }
                  if (!payAccount) {
                    alert("Please choose a valid financial account.");
                    return;
                  }

                  const newPayment = {
                    id: 'stmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
                    amount: amt,
                    date: payDate || new Date().toISOString().substring(0, 10),
                    receivedBy: payAccount,
                    notes: payNotes.trim() || undefined,
                    subTripId: quickPayTarget.subTripId
                  };

                  const updatedTrips = trips.map(t => {
                    if (t.id === quickPayTarget.tripId) {
                      return {
                        ...t,
                        payments: [...(t.payments || []), newPayment]
                      };
                    }
                    return t;
                  });

                  onSaveTrips(updatedTrips);
                  alert(`Payment of ₹${amt.toLocaleString('en-IN')} successfully registered.`);
                  setQuickPayTarget(null);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition shadow-3xs cursor-pointer"
              >
                Register Payment
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800 flex items-start gap-2 shadow-3xs">
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <span>Use the Share option on each office/truck card to quickly copy and send outstanding summaries via WhatsApp, SMS, or Email.</span>
      </div>
    </div>
  );
}
