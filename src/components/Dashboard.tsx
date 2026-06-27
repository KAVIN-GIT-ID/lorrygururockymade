import React from 'react';
import { TripEntry, Truck, Office, Account, getTripMetrics, UserRights, OrganizationProfile, ExpenseEntry, importLegacyCargoExpenses } from '../types';
import { Landmark, TrendingUp, AlertCircle, ShieldAlert, BadgeCent, CheckCircle2, Navigation, DollarSign, Calendar, Wrench, Shield, Building2, X, Share2, Check } from 'lucide-react';
import { getOutstandingAge, formatToDisplayDate, calculateDaysLeft } from '../lib/dateUtils';
import { calculateLoanStats, calculateSingleLoanStats, getTruckLoans } from './TruckMaster';
import PayEmiModal from './PayEmiModal';
import PayTaxModal from './PayTaxModal';

interface DashboardProps {
  trips: TripEntry[];
  allTrips?: TripEntry[];
  trucks: Truck[];
  offices: Office[];
  accounts: Account[];
  currentUserRights?: UserRights;
  activeMonth: string;
  activeYear: string;
  setActiveMonth: (month: string) => void;
  setActiveYear: (year: string) => void;
  orgProfile?: OrganizationProfile;
  expenses?: ExpenseEntry[];
  onAddExpense?: (expense: Omit<ExpenseEntry, 'id'>) => void;
  onUpdateTruck?: (truck: Truck) => Promise<void>;
  onSaveTrips?: (newTrips: TripEntry[]) => void;
}

export default function Dashboard({ 
  trips: rawTrips, 
  allTrips: rawAllTrips = rawTrips,
  trucks, 
  offices, 
  accounts, 
  currentUserRights,
  activeMonth,
  activeYear,
  setActiveMonth,
  setActiveYear,
  orgProfile,
  expenses = [],
  onAddExpense,
  onUpdateTruck,
  onSaveTrips
}: DashboardProps) {
  const trips = rawTrips.filter(t => t.status !== 'Deleted' && !t.deletedAt);
  const allTrips = rawAllTrips.filter(t => t.status !== 'Deleted' && !t.deletedAt);
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const years = ['2025', '2026', '2027', '2028', '2029', '2030', 'All Time'];

  // Tooltip interactive state
  const [hoveredTruck, setHoveredTruck] = React.useState<string | null>(null);
  const [hoveredOffice, setHoveredOffice] = React.useState<string | null>(null);
  const [outstandingTab, setOutstandingTab] = React.useState<'office' | 'truck'>('office');
  const [hoverPosition, setHoverPosition] = React.useState({ x: 0, y: 0 });
  const closeTimeoutRef = React.useRef<any>(null);

  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

  // Pay EMI state
  const [payEmiTarget, setPayEmiTarget] = React.useState<{
    truckNo: string;
    emiAmount: number;
    bankName: string;
    dueDateStr: string;
    loanType?: string;
  } | null>(null);

  // Pay Tax state
  const [payTaxTarget, setPayTaxTarget] = React.useState<{
    truckId: string;
    truckNo: string;
    taxType: 'Insurance' | 'Quarterly Tax' | 'National Permit Tax' | '5 Year Permit';
    currentExpiryDate: string;
  } | null>(null);

  // Quick Pay Modal State
  const [quickPayTarget, setQuickPayTarget] = React.useState<{
    tripId: string;
    subTripId: string;
    officeName: string;
    route: string;
    balance: number;
    truckNo?: string;
  } | null>(null);
  const [payDate, setPayDate] = React.useState(new Date().toISOString().substring(0, 10));
  const [payAccount, setPayAccount] = React.useState('');
  const [payAmount, setPayAmount] = React.useState<number | ''>('');
  const [payNotes, setPayNotes] = React.useState('');

  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnterRow = (truckNo: string, e: React.MouseEvent) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const showOnRight = rect.left < 340;
    setHoveredTruck(truckNo);
    setHoverPosition({
      x: showOnRight ? rect.right + 12 : rect.left - 332,
      y: rect.top + window.scrollY - 30
    });
  };

  const handleMouseEnterOfficeRow = (officeName: string, e: React.MouseEvent) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const showOnRight = rect.left < 340;
    setHoveredOffice(officeName);
    setHoverPosition({
      x: showOnRight ? rect.right + 12 : rect.left - 332,
      y: rect.top + window.scrollY - 30
    });
  };

  const handleMouseLeaveRowOrTooltip = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredTruck(null);
      setHoveredOffice(null);
    }, 150);
  };

  const handleMouseEnterTooltip = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const {
    isAdmin = true,
    canViewTrips = true,
    canViewExpenses = true,
  } = currentUserRights || {};

  // Pre-calculate metrics for all master trips
  const metricsList = trips.map(t => getTripMetrics(t));
  const allMetricsList = allTrips.map(t => getTripMetrics(t));

  const totalRental = metricsList.reduce((sum, m) => sum + m.income, 0);
  const totalExpenses = metricsList.reduce((sum, m) => sum + m.totalExpense, 0);
  const totalAdvances = metricsList.reduce((sum, m) => sum + m.paymentsReceived, 0);
  const totalOutstanding = allMetricsList.reduce((sum, m) => sum + m.outstandingBalance, 0);
  const totalProfit = metricsList.reduce((sum, m) => sum + m.profit, 0);
  const totalDiesel = metricsList.reduce((sum, m) => sum + m.dieselExpense, 0);

  // Status counts
  const pendingCount = trips.filter(t => t.status === 'Pending').length;
  const inProgressCount = trips.filter(t => t.status === 'In Progress').length;
  const completedCount = trips.filter(t => t.status === 'Completed').length;
  const paidCount = trips.filter(t => t.status === 'Settled').length;



  // Filter trips with outstanding older than 10 days
  const overdueTrips = allTrips.filter(t => {
    const m = getTripMetrics(t);
    if (m.outstandingBalance <= 0) return false;
    const age = getOutstandingAge(t.endDate || t.startDate);
    return age > 10;
  });

  const overdueCount = overdueTrips.length;

  // Let's obtain the Account Name mapping for easy readability
  const getAccountName = (id: string) => {
    if (id === 'paid_to_driver_advance') return 'Paid to Driver Advance';
    return accounts.find(a => a.id === id)?.accountName || id || 'N/A';
  };

  // Group accounts receiving funds and sum up their collections
  const accountFundsMap: { [key: string]: number } = {};
  trips.forEach(t => {
    (t.payments || []).forEach(p => {
      if (p.amount > 0 && p.receivedBy) {
        accountFundsMap[p.receivedBy] = (accountFundsMap[p.receivedBy] || 0) + Number(p.amount);
      }
    });
  });

  const fundsByAccount = Object.entries(accountFundsMap).map(([id, amount]) => ({
    accountName: getAccountName(id),
    amount
  })).sort((a, b) => b.amount - a.amount);

  // Group outstanding balance by Truck for risk mitigation
  const truckOutstandingMap: { [key: string]: number } = {};
  allTrips.forEach(t => {
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
  allTrips.forEach(t => {
    const m = getTripMetrics(t);
    if (m.outstandingBalance > 0) {
      const segDetails: { office: string; balance: number }[] = [];
      const subTrips = t.subTrips || [];
      subTrips.forEach(st => {
        let segDeductions = 0;
        let segOfficeBears = 0;

        let expenses = st.cargoExpenses;
        if (typeof expenses === 'string') {
          try {
            expenses = JSON.parse(expenses);
          } catch {
            expenses = [];
          }
        }
        if (!expenses || expenses.length === 0) {
          expenses = importLegacyCargoExpenses(st, orgProfile);
        }

        expenses.forEach(exp => {
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

  // Detailed hover information per truck
  const getTruckHoverDetails = (tNo: string) => {
    const truckTrips = allTrips.filter(t => t.truckNo === tNo);
    let totalIncome = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    const officesUsed = new Set<string>();
    const detailsList: any[] = [];

    truckTrips.forEach(t => {
      const m = getTripMetrics(t);
      if (m.outstandingBalance > 0) {
        // Find segment info
        (t.subTrips || []).forEach(st => {
          if (st.officeName) officesUsed.add(st.officeName);
          
          // Calculate segment-specific OrgRental deductions & Office Bears
          let segDeductions = 0;
          let segOfficeBears = 0;

          let expenses = st.cargoExpenses;
          if (typeof expenses === 'string') {
            try {
              expenses = JSON.parse(expenses);
            } catch {
              expenses = [];
            }
          }
          if (!expenses || expenses.length === 0) {
            expenses = importLegacyCargoExpenses(st, orgProfile);
          }

          expenses.forEach(exp => {
            const amt = Number(exp.amount) || 0;
            if (exp.deductedFrom === 'OrgRental') {
              segDeductions += amt;
            }
            if (exp.bears === 'Office') {
              segOfficeBears += amt;
            }
          });

          // Calculate segment-specific payments if possible (subTripId matches)
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

        // Let's also look at general payments block (unassigned payments)
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
      detailsList
    };
  };

  // Detailed hover information per office
  const getOfficeHoverDetails = (oName: string) => {
    let totalIncome = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    const trucksUsed = new Set<string>();
    const detailsList: any[] = [];

    allTrips.forEach(t => {
      const m = getTripMetrics(t);
      if (m.outstandingBalance > 0) {
        const matchingSegs: { st: any; segDeductions: number; segOfficeBears: number; segPayments: number; segBalance: number }[] = [];
        
        (t.subTrips || []).forEach(st => {
          const stOffice = st.officeName || 'Indirect/General';
          if (stOffice === oName) {
            trucksUsed.add(t.truckNo);
            
            let segDeductions = 0;
            let segOfficeBears = 0;

            let expenses = st.cargoExpenses;
            if (typeof expenses === 'string') {
              try {
                expenses = JSON.parse(expenses);
              } catch {
                expenses = [];
              }
            }
            if (!expenses || expenses.length === 0) {
              expenses = importLegacyCargoExpenses(st, orgProfile);
            }

            expenses.forEach(exp => {
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

        // We also need to calculate proportional share of unassigned payments if this trip has any matching segments
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
      detailsList
    };
  };

  // Calculations for beautiful visual progress rings
  const recoveryRate = totalRental > 0 
    ? Math.round((totalAdvances / totalRental) * 100) 
    : 100;

  const validRecoveryRate = isNaN(recoveryRate) ? 0 : Math.min(100, Math.max(0, recoveryRate));

  const combinedAlerts = React.useMemo(() => {
    const alerts: any[] = [];
    const anchor = new Date();

    trucks.forEach(truck => {
      if (truck.status !== 'Active') return;
      const currentKM = truck.currentKM || 0;

      // 1. Loan alerts
      const activeLoans = getTruckLoans(truck).filter(l => l.loanStatus !== 'Closed');
      activeLoans.forEach(loan => {
        const stats = calculateSingleLoanStats(loan, truck.truckNo, expenses);
        if (stats && stats.nextDueDateStr !== 'Fully Settled') {
          const daysLeft = calculateDaysLeft(stats.nextDueDateStr, anchor);
          if (daysLeft !== null) {
            const isOverdue = stats.isOverdue || daysLeft <= 0;
            if (isOverdue || daysLeft <= 15) {
              alerts.push({
                id: `loan-${truck.id}-${loan.id}-${stats.nextDueDateStr}`,
                type: 'loan',
                truckNo: truck.truckNo,
                title: `${truck.truckNo}: ${loan.loanType || 'Loan'} EMI`,
                urgency: isOverdue ? 'Overdue' : 'Near Due',
                daysLeft,
                description: `₹${Number(loan.loanEmiAmount).toLocaleString('en-IN')} due on ${formatToDisplayDate(stats.nextDueDateStr)} (${loan.loanBankName || 'Bank'})`,
                dueDate: stats.nextDueDateStr,
                metadata: {
                  emiAmount: loan.loanEmiAmount,
                  bankName: loan.loanBankName || 'Bank',
                  dueDateStr: stats.nextDueDateStr,
                  truckNo: truck.truckNo,
                  loanType: loan.loanType,
                }
              });
            }
          }
        }
      });

      // 2. Service alerts
      const services = [
        { name: 'Engine Oil Change', targetKM: truck.engineOilKM, interval: truck.engineOilIntervalKM || orgProfile?.engineOilIntervalKM || 15000 },
        { name: 'Crown Oil', targetKM: truck.crownOilKM, interval: truck.crownOilIntervalKM || orgProfile?.crownOilIntervalKM || 40000 },
        { name: 'Gear Box Oil', targetKM: truck.gearBoxOilKM, interval: truck.gearBoxOilIntervalKM || orgProfile?.gearBoxOilIntervalKM || 40000 },
        { name: 'Radiator Service', targetKM: truck.radiatorKM, interval: truck.radiatorIntervalKM || orgProfile?.radiatorIntervalKM || 20000 },
        { name: 'Pinpush Grease', targetKM: truck.pinpushKM, interval: truck.pinpushIntervalKM || orgProfile?.pinpushIntervalKM || 5000 },
        { name: 'Wheel Grease', targetKM: truck.wheelGreaseKM, interval: truck.wheelGreaseIntervalKM || orgProfile?.wheelGreaseIntervalKM || 5000 }
      ];

      services.forEach(service => {
        if (typeof service.targetKM === 'number' && service.targetKM > 0) {
          const remainingKM = service.targetKM - currentKM;
          if (remainingKM <= 1000) {
            alerts.push({
              id: `service-${truck.id}-${service.name}`,
              type: 'service',
              truckNo: truck.truckNo,
              title: `${truck.truckNo}: ${service.name}`,
              urgency: remainingKM <= 0 ? 'Overdue' : 'Near Due',
              remainingKM,
              description: remainingKM <= 0 
                ? `Overdue by ${Math.abs(remainingKM).toLocaleString()} KM (Current: ${currentKM.toLocaleString()} KM / Milestone: ${service.targetKM.toLocaleString()} KM)`
                : `Due in ${remainingKM.toLocaleString()} KM (Current: ${currentKM.toLocaleString()} KM / Milestone: ${service.targetKM.toLocaleString()} KM)`,
            });
          }
        }
      });

      // 3. Document Expiry alerts
      const docs = [
        { label: 'Insurance Expiry', date: truck.insuranceDate, warningDays: orgProfile?.insuranceWarningDays ?? 30 },
        { label: 'Fitness Cert (FC)', date: truck.fcDate, warningDays: orgProfile?.fcWarningDays ?? 30 },
        { label: 'Quarterly Tax (Q Tax)', date: truck.qTaxDate, warningDays: orgProfile?.qTaxWarningDays ?? 30 },
        { label: 'Green Tax Cert', date: truck.greenTaxDate, warningDays: orgProfile?.greenTaxWarningDays ?? 30 },
        { label: 'National Permit Tax', date: truck.npTaxDate, warningDays: orgProfile?.npTaxWarningDays ?? 30 },
        { label: '5 Year Permit Date', date: truck.fiveYearPermitDate, warningDays: orgProfile?.fiveYearPermitWarningDays ?? 30 },
        { label: 'Subscription Expiry', date: truck.registrationExpiryDate, warningDays: orgProfile?.subscriptionWarningDays ?? 30 }
      ];

      docs.forEach(doc => {
        if (doc.date) {
          const daysLeft = calculateDaysLeft(doc.date, anchor);
          if (daysLeft !== null && daysLeft <= doc.warningDays) {
            let metadata: any = undefined;
            if (['Insurance Expiry', 'Quarterly Tax (Q Tax)', 'National Permit Tax', '5 Year Permit Date'].includes(doc.label)) {
              const taxType = doc.label === 'Insurance Expiry' ? 'Insurance'
                            : doc.label === 'Quarterly Tax (Q Tax)' ? 'Quarterly Tax'
                            : doc.label === 'National Permit Tax' ? 'National Permit Tax'
                            : '5 Year Permit';
              metadata = {
                truckId: truck.id,
                truckNo: truck.truckNo,
                taxType,
                currentExpiryDate: doc.date
              };
            }

            alerts.push({
              id: `doc-${truck.id}-${doc.label}`,
              type: 'document',
              truckNo: truck.truckNo,
              title: `${truck.truckNo}: ${doc.label}`,
              urgency: daysLeft <= 0 ? 'Overdue' : 'Near Due',
              daysLeft,
              description: daysLeft <= 0
                ? `Expired ${Math.abs(daysLeft)} days ago (on ${formatToDisplayDate(doc.date)})`
                 : `Expires in ${daysLeft} days (on ${formatToDisplayDate(doc.date)})`,
              dueDate: doc.date,
              metadata
            });
          }
        }
      });
    });

    // Sort combined alerts
    return alerts.sort((a, b) => {
      // 1. Overdue first
      if (a.urgency === 'Overdue' && b.urgency !== 'Overdue') return -1;
      if (a.urgency !== 'Overdue' && b.urgency === 'Overdue') return 1;

      // 2. If both overdue or both near due
      const getUrgencyValue = (item: any) => {
        if (item.type === 'service') {
          return item.remainingKM / 30;
        } else {
          return item.daysLeft !== null ? item.daysLeft : 999;
        }
      };

      return getUrgencyValue(a) - getUrgencyValue(b);
    });
  }, [trucks, expenses, orgProfile]);

  return (
    <div id="dashboard-tab" className="space-y-6 animate-fade-in font-sans">
      
      {/* FILTER CONTROL BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row gap-4 items-center justify-between no-print">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-sans">Time Period</h3>
          <p className="text-xs text-slate-500 font-sans font-normal">Select the month and year to view metrics and aggregates.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-3">
          <Calendar className="w-4 h-4 text-slate-450" />
          <select
            id="dashboard-month-select"
            value={activeMonth}
            disabled={activeYear === 'All Time'}
            onChange={(e) => setActiveMonth(e.target.value)}
            className="bg-transparent border-0 text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer pr-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            id="dashboard-year-select"
            value={activeYear}
            onChange={(e) => setActiveYear(e.target.value)}
            className="bg-transparent border-0 text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer pl-2 border-l border-slate-200"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LATEST UPDATES & FLEET ALERTS */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-sans">
              Latest Updates & Fleet Alerts
            </h3>
          </div>
          <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full text-[10px]">
            {combinedAlerts.length} Active Alerts
          </span>
        </div>

        {combinedAlerts.length === 0 ? (
          <div className="border border-dashed border-slate-150 rounded-xl p-8 py-10 text-center bg-slate-50/50 flex flex-col items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">All Systems Nominal</h4>
            <p className="text-xs text-slate-405 mt-1 max-w-sm">
              All compliance documents, technical lubricants, and active loans are up to date.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[360px] overflow-y-auto pr-1 modern-scrollbar animate-in fade-in duration-300">
            {combinedAlerts.map((alert) => {
              const isOverdue = alert.urgency === 'Overdue';
              return (
                <div
                  key={alert.id}
                  className={`flex items-start justify-between p-4 rounded-xl border transition duration-150 ${
                    isOverdue 
                      ? 'bg-rose-50/40 border-rose-100 hover:border-rose-200 border-l-4 border-l-rose-500 shadow-3xs' 
                      : 'bg-amber-50/30 border-amber-100 hover:border-amber-200 border-l-4 border-l-amber-500 shadow-3xs'
                  }`}
                >
                  <div className="flex gap-3 items-start flex-1 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      alert.type === 'loan' ? 'bg-blue-50 text-blue-600' :
                      alert.type === 'service' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-indigo-50 text-indigo-600'
                    }`}>
                      {alert.type === 'loan' && <Landmark className="w-4 h-4" />}
                      {alert.type === 'service' && <Wrench className="w-4 h-4" />}
                      {alert.type === 'document' && <Calendar className="w-4 h-4" />}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-slate-900 text-xs truncate">{alert.title}</span>
                        <span className={`inline-block text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          isOverdue 
                            ? 'bg-rose-100 text-rose-700 animate-pulse' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {alert.urgency}
                        </span>
                      </div>
                      <p className="text-xs text-slate-650 leading-normal font-sans">{alert.description}</p>
                    </div>
                  </div>

                  {alert.type === 'loan' && currentUserRights?.canEditExpenses && (
                    <button
                      type="button"
                      onClick={() => setPayEmiTarget(alert.metadata)}
                      className="ml-3 shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg transition shadow-3xs cursor-pointer uppercase tracking-wider"
                    >
                      Pay EMI
                    </button>
                  )}

                  {alert.type === 'document' && alert.metadata && currentUserRights?.canEditExpenses && (
                    <button
                      type="button"
                      onClick={() => setPayTaxTarget(alert.metadata)}
                      className="ml-3 shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg transition shadow-3xs cursor-pointer uppercase tracking-wider"
                    >
                      {alert.metadata.taxType === 'Insurance' ? 'Pay Insurance' : 'Pay Tax'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* CONTRACT RENTAL */}
        {canViewTrips && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md duration-200">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider font-sans">Total Billed Income</span>
              <span className="text-xl md:text-2xl font-extrabold text-slate-900 font-sans tracking-tight leading-none">₹{totalRental.toLocaleString('en-IN')}</span>
              <p className="text-[10px] text-slate-400 mt-1">From {trips.length} registered trips</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-blue-600 shadow-3xs">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* OUTSTANDING BALANCES */}
        {canViewTrips && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md duration-200 relative overflow-hidden">
            {overdueCount > 0 && (
              <div className="absolute top-0 right-0">
                <span className="bg-red-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider animate-pulse inline-block">
                  Aged Debt Alert
                </span>
              </div>
            )}
            <div className="space-y-1 flex-1">
              <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider font-sans">Total Outstanding</span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`text-xl md:text-2xl font-extrabold font-sans tracking-tight leading-none ${totalOutstanding > 0 ? 'text-red-705 text-red-600 font-bold' : 'text-emerald-600'}`}>
                  ₹{totalOutstanding.toLocaleString('en-IN')}
                </span>
                {overdueCount > 0 && (
                  <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-100 animate-pulse">
                    {overdueCount} Overdue
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Collectable from broker sheets</p>
            </div>
            <div className={`p-3 rounded-lg border shadow-3xs shrink-0 ${totalOutstanding > 0 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* OPERATIONAL EXPENSES */}
        {canViewExpenses && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md duration-200">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider font-sans">Operational Expenses</span>
              <span className="text-xl md:text-2xl font-extrabold text-slate-905 font-sans tracking-tight leading-none text-red-600">₹{totalExpenses.toLocaleString('en-IN')}</span>
              <p className="text-[10px] text-slate-405 mt-1">₹{totalDiesel.toLocaleString('en-IN')} spent on Diesel</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-amber-600 shadow-3xs">
              <BadgeCent className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* RECOV REALIZED PROFIT */}
        {isAdmin && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md duration-200">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider font-sans">Net Adjusted Profit</span>
              <span className={`text-xl md:text-2xl font-extrabold font-sans tracking-tight leading-none ${totalProfit >= 0 ? 'text-emerald-700' : 'text-red-705 text-red-600 font-bold'}`}>
                ₹{totalProfit.toLocaleString('en-IN')}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">Margin: {totalRental > 0 ? Math.round((totalProfit / totalRental) * 100) : 0}% of Income</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-600 shadow-3xs">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>

      {/* MID SECTION CHARTS AND MASTER INSIGHTS */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
          
          {/* COLLECTION RATIO PIE GRAPH */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1 font-sans">Receipts & Profit Margin</h3>
              <p className="text-xs text-slate-500 font-sans font-normal">Visual mapping of overall contract capital transition clearing.</p>
            </div>

            <div className="my-6 flex items-center justify-center relative">
              <svg viewBox="0 0 100 100" className="w-36 h-36 transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="10" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  fill="transparent" 
                  stroke="#10b981" 
                  strokeWidth="10" 
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - validRecoveryRate / 100)}`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-900 font-sans tracking-tight">{validRecoveryRate}%</span>
                <span className="text-[9px] text-slate-400 uppercase font-bold">Incomings Received</span>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-slate-100 pt-4 font-sans">
              <div className="flex justify-between text-slate-600 font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>Customer Payments Received</span>
                <span className="font-mono text-slate-900 font-bold">₹{totalAdvances.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>Collectable Outstandings</span>
                <span className="font-mono text-slate-900 font-bold">₹{totalOutstanding.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>Expenses Billed</span>
                <span className="font-mono text-slate-900 font-bold">₹{totalExpenses.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* LEDGER ACCOUNTS COLLECTION SPLIT */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1 font-sans">Receipts by Accounts</h3>
              <p className="text-xs text-slate-500 font-sans font-normal font-sans">Total advances & settlements received into operational accounts.</p>
            </div>

            <div className="my-4 divide-y divide-slate-100 overflow-y-auto max-h-[180px] pr-1 flex-1">
              {fundsByAccount.length === 0 ? (
                <p className="text-center py-12 text-xs text-slate-400 italic font-sans font-sans font-normal">No customer receipts logged yet.</p>
              ) : (
                fundsByAccount.map(({ accountName, amount }) => {
                  const pct = totalAdvances > 0 ? Math.round((amount / totalAdvances) * 100) : 0;
                  return (
                    <div key={accountName} className="py-2.5 flex items-center justify-between gap-4 font-sans">
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[150px]">{accountName}</span>
                      <div className="flex-1 max-w-[80px]">
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, pct)}%` }}></div>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-900 text-right">₹{amount.toLocaleString('en-IN')}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2 mt-4 shadow-3xs font-sans">
              <Landmark className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span>Map accounts to payments / advances received.</span>
            </div>
          </div>

          {/* COMBINED OUTSTANDING LIABILITIES CARD */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-105 pb-3 mb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-sans">Outstanding</h3>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 no-print">
                  <button
                    type="button"
                    onClick={() => setOutstandingTab('office')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition duration-150 cursor-pointer ${
                      outstandingTab === 'office'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    By Office
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutstandingTab('truck')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition duration-150 cursor-pointer ${
                      outstandingTab === 'truck'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    By Truck
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 font-sans">
                {outstandingTab === 'office'
                  ? 'Active pending outstandings grouped per loading office branch.'
                  : 'Active pending outstandings grouped per truck datasheet reference.'}
              </p>
            </div>

            <div className="my-4 divide-y divide-slate-100 overflow-y-auto max-h-[180px] pr-1 flex-1">
              {outstandingTab === 'office' ? (
                topOutstandingOffices.length === 0 ? (
                  <p className="text-center py-12 text-xs text-emerald-600 italic font-medium font-sans">Excellent! All office balances are fully settled.</p>
                ) : (
                  topOutstandingOffices.map(({ officeName, amount }) => (
                    <div 
                      key={officeName} 
                      className="py-2.5 flex items-center justify-between gap-4 font-sans hover:bg-slate-50 px-2 rounded-lg transition duration-150 cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnterOfficeRow(officeName, e)}
                      onMouseLeave={handleMouseLeaveRowOrTooltip}
                    >
                      <span className="text-xs font-bold text-slate-705 uppercase font-mono tracking-wider flex items-center gap-1.5 truncate max-w-[160px]">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {officeName}
                      </span>
                      <span className="text-xs font-mono font-bold text-red-650 bg-red-50 border border-red-100 px-2 py-0.5 rounded shadow-3xs text-red-600 shrink-0">
                        ₹{amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))
                )
              ) : (
                topOutstandingTrucks.length === 0 ? (
                  <p className="text-center py-12 text-xs text-emerald-600 italic font-medium font-sans">Excellent! All truck balances are fully settled.</p>
                ) : (
                  topOutstandingTrucks.map(({ truckNo, amount }) => (
                    <div 
                      key={truckNo} 
                      className="py-2.5 flex items-center justify-between gap-4 font-sans hover:bg-slate-50 px-2 rounded-lg transition duration-150 cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnterRow(truckNo, e)}
                      onMouseLeave={handleMouseLeaveRowOrTooltip}
                    >
                      <span className="text-xs font-bold text-slate-705 uppercase font-mono tracking-wider flex items-center gap-1.5">
                        <Navigation className="w-3 h-3 text-slate-400 rotate-45" />
                        {truckNo}
                      </span>
                      <span className="text-xs font-mono font-bold text-red-650 bg-red-50 border border-red-100 px-2 py-0.5 rounded shadow-3xs text-red-600">
                        ₹{amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))
                )
              )}
            </div>

            <div className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-2 mt-4 shadow-3xs font-sans">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span>
                {outstandingTab === 'office'
                  ? 'Track aged collections and limits per booking branch.'
                  : 'Provides direct oversight over customer-side defaults.'}
              </span>
            </div>
          </div>

        </div>
      )}

      {/* PIE CHART STATS & AGED RECEIVABLES COLLECTION TRACKER */}
      {canViewTrips && (
        <>
          {/* PIE CHART STATS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-2xs font-sans">
              <span className="text-[10px] text-slate-400 uppercase font-bold font-sans">Pending Advances</span>
              <p className="text-lg font-bold text-slate-800 mt-1 font-mono">{pendingCount}</p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-2xs font-sans">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Active Transitions</span>
              <p className="text-lg font-bold text-amber-600 mt-1 font-mono">{inProgressCount}</p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-2xs font-sans">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Delivered Goods</span>
              <p className="text-lg font-bold text-blue-600 mt-1 font-mono">{completedCount}</p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-2xs font-sans">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Settled Trips</span>
              <p className="text-lg font-bold text-emerald-600 mt-1 font-mono">{paidCount}</p>
            </div>
          </div>

          {/* AGED RECEIVABLES COLLECTION TRACKER PANEL */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2.5 bg-rose-50 text-rose-700 border border-rose-100 rounded font-extrabold text-[10px] uppercase tracking-wider animate-pulse flex items-center gap-1 shrink-0">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Collection Risk
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-sans">
                    Aged Outstanding Receivables ({'>'} 10 Days) Tracker
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Active transport journal auditor flagging trips where outstanding brokerage balances exceed 10 days to maximize collection rates.
                </p>
              </div>

            </div>

            {overdueCount === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl p-8 py-10 text-center bg-slate-50/50">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Perfect Collection Health</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Excellent! No completed transport segments have outstanding balances exceeding 10 days.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full text-left text-xs whitespace-nowrap divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="p-3 pl-4">Trip No / Details</th>
                      <th className="p-3">Truck & Driver</th>
                      <th className="p-3 text-center">Completed Date</th>
                      <th className="p-3 text-center">Unpaid Age</th>
                      <th className="p-3 text-right">Trip Rent</th>
                      <th className="p-3 text-right">Advances Handled</th>
                      <th className="p-3 text-right">Aged Outstanding</th>
                      <th className="p-3 text-center">Alert Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {overdueTrips.map(trip => {
                      const m = getTripMetrics(trip);
                      const age = getOutstandingAge(trip.endDate || trip.startDate);
                      const completionDate = trip.endDate || trip.startDate || 'N/A';
                      
                      return (
                        <tr key={trip.id} className="hover:bg-slate-50/40 transition">
                          <td className="p-3 pl-4">
                            <span className="font-mono font-bold text-slate-900 block">{trip.tripNo}</span>
                            <span className="text-[10px] text-slate-405 font-medium block truncate max-w-[200px]">{trip.notes || 'Aged customer-side default'}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-mono font-bold text-slate-800 block text-[11px]">{trip.truckNo}</span>
                            <span className="text-[10px] text-slate-500 font-normal block">{trip.driverName}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-mono">{formatToDisplayDate(completionDate)}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-block bg-red-50 border border-red-100 text-red-700 font-bold px-2 py-0.5 rounded shadow-3xs font-mono text-[10px] animate-pulse">
                              {age} Days Overdue
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-800">
                            ₹{m.income.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600">
                            ₹{m.paymentsReceived.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-mono text-red-650 bg-red-50/35 text-sm font-bold">
                            ₹{m.outstandingBalance.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-600 shrink-0 shadow-xs animate-ping" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
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
          onConfirm={(paymentDate, accountId) => {
            if (onAddExpense) {
              onAddExpense({
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

      {/* Pay Tax Modal */}
      {payTaxTarget && (
        <PayTaxModal
          isOpen={true}
          onClose={() => setPayTaxTarget(null)}
          truckNo={payTaxTarget.truckNo}
          taxType={payTaxTarget.taxType}
          currentExpiryDate={payTaxTarget.currentExpiryDate}
          accounts={accounts}
          onConfirm={(paymentDate, amount, nextExpiryDate, accountId) => {
            if (onAddExpense) {
              onAddExpense({
                truckNo: payTaxTarget.truckNo,
                expenseType: 'Scheduled',
                shopName: 'RTO / Government Department',
                amount: amount,
                paymentMode: accountId,
                date: paymentDate,
                status: 'Paid',
                notes: `${payTaxTarget.taxType} renewal payment. Next Expiry: ${nextExpiryDate}`,
              });
            }
            if (onUpdateTruck) {
              const truckToUpdate = trucks.find(t => t.id === payTaxTarget.truckId);
              if (truckToUpdate) {
                const updatedTruck = { ...truckToUpdate };
                if (payTaxTarget.taxType === 'Insurance') {
                  updatedTruck.insuranceDate = nextExpiryDate;
                } else if (payTaxTarget.taxType === 'Quarterly Tax') {
                  updatedTruck.qTaxDate = nextExpiryDate;
                } else if (payTaxTarget.taxType === 'National Permit Tax') {
                  updatedTruck.npTaxDate = nextExpiryDate;
                } else if (payTaxTarget.taxType === '5 Year Permit') {
                  updatedTruck.fiveYearPermitDate = nextExpiryDate;
                }
                onUpdateTruck(updatedTruck);
              }
            }
            alert(`${payTaxTarget.taxType} payment of ₹${amount.toLocaleString('en-IN')} for ${payTaxTarget.truckNo} recorded and expiry date updated successfully.`);
            setPayTaxTarget(null);
          }}
        />
      )}

      {hoveredTruck && (() => {
        const det = getTruckHoverDetails(hoveredTruck);
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div 
                className="w-full max-w-xs bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-4 font-sans text-xs relative animate-fade-in"
                box-shadow="0 10px 25px -5px rgb(0 0 0 / 0.3)"
              >
                <button
                  type="button"
                  onClick={() => setHoveredTruck(null)}
                  className="absolute top-2 right-2 text-slate-400 hover:text-white p-1 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="border-b border-slate-705 pb-1.5 mb-2 flex justify-between items-center pr-6">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-[12px] text-amber-400 tracking-wider font-mono">{hoveredTruck}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(getTruckShareText(hoveredTruck!, det), `truck-mob-${hoveredTruck}`)}
                      title="Copy Outstanding Details"
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      {copiedId === `truck-mob-${hoveredTruck}` ? <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> : <Share2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Balance Drilldown</span>
                </div>

                <div className="space-y-1.5 font-sans mb-3 text-slate-300">
                  <p>
                    <strong className="text-slate-400 uppercase text-[8px] block tracking-wide">Loading Office(s):</strong>
                    <span className="font-semibold text-white text-[11px] leading-tight block">{det.officeList || 'Indirect/General'}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                    <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                      <span className="text-slate-400 block font-bold text-[8px] uppercase">Billed Income</span>
                      <span className="font-mono font-bold text-emerald-400">₹{det.totalIncome.toLocaleString()}</span>
                    </div>
                    <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                      <span className="text-slate-400 block font-bold text-[8px] uppercase">Advance Info</span>
                      <span className="font-mono font-bold text-indigo-400">₹{det.totalPaid.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="bg-rose-950/40 border border-rose-900/40 p-1.5 rounded mt-1.5 flex justify-between items-center">
                    <span className="text-rose-300 font-bold text-[8px] uppercase">Net Outstanding</span>
                    <span className="font-mono font-bold text-rose-400 text-xs">₹{det.totalBalance.toLocaleString()}</span>
                  </div>
                </div>

                {det.detailsList.filter(seg => seg.balance > 0).length > 0 && (
                  <div className="border-t border-slate-800 pt-2">
                    <span className="text-slate-400 font-extrabold text-[8px] uppercase tracking-wider block mb-1">Segment Ledger Logs</span>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto pr-0.5 modern-scrollbar">
                      {det.detailsList.filter(seg => seg.balance > 0).map((seg, sIdx) => (
                        <div key={sIdx} className="bg-slate-800/50 rounded p-1.5 border border-slate-800 flex flex-col gap-0.5 text-[9px]">
                          <div className="flex justify-between font-bold text-slate-350">
                            <span className="truncate text-white font-semibold">{seg.office}</span>
                            <span className="font-mono text-slate-405 text-[8px]">{seg.date}</span>
                          </div>
                          <div className="flex justify-between font-mono text-[8px] text-slate-400 pt-0.5">
                            <span>Inc: ₹{seg.income}</span>
                            <span>Adv: ₹{seg.advance}</span>
                            <span className="text-rose-400 font-bold">Bal: ₹{seg.balance}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }
        return (
          <div 
            className="fixed z-50 w-80 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-4 font-sans text-xs pointer-events-auto transition-all duration-150 animate-fade-in"
            style={{ 
              left: `${hoverPosition.x}px`, 
              top: `${hoverPosition.y}px`,
              boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)'
            }}
            onMouseEnter={handleMouseEnterTooltip}
            onMouseLeave={handleMouseLeaveRowOrTooltip}
          >
            <div className="border-b border-slate-705 pb-1.5 mb-2 flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-[12px] text-amber-400 tracking-wider font-mono">{hoveredTruck}</span>
                <button
                  type="button"
                  onClick={() => handleCopyText(getTruckShareText(hoveredTruck!, det), `truck-desk-${hoveredTruck}`)}
                  title="Copy Outstanding Details"
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {copiedId === `truck-desk-${hoveredTruck}` ? <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> : <Share2 className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[9px] text-slate-400 font-bold uppercase">Balance Drilldown</span>
            </div>

            <div className="space-y-1.5 font-sans mb-3 text-slate-300">
              <p>
                <strong className="text-slate-400 uppercase text-[8px] block tracking-wide">Loading Office(s):</strong>
                <span className="font-semibold text-white text-[11px] leading-tight block">{det.officeList || 'Indirect/General'}</span>
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                  <span className="text-slate-400 block font-bold text-[8px] uppercase">Billed Income</span>
                  <span className="font-mono font-bold text-emerald-400">₹{det.totalIncome.toLocaleString()}</span>
                </div>
                <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                  <span className="text-slate-400 block font-bold text-[8px] uppercase">Advance Information</span>
                  <span className="font-mono font-bold text-indigo-400">₹{det.totalPaid.toLocaleString()}</span>
                </div>
              </div>
              <div className="bg-rose-950/40 border border-rose-900/40 p-1.5 rounded mt-1.5 flex justify-between items-center">
                <span className="text-rose-300 font-bold text-[8px] uppercase">Net Outstanding</span>
                <span className="font-mono font-bold text-rose-400 text-xs">₹{det.totalBalance.toLocaleString()}</span>
              </div>
            </div>

            {det.detailsList.filter((seg: any) => seg.balance > 0).length > 0 && (
              <div className="border-t border-slate-800 pt-2">
                <span className="text-slate-400 font-extrabold text-[8px] uppercase tracking-wider block mb-1">Segment Ledger Logs</span>
                <div className="space-y-1 max-h-[120px] overflow-y-auto pr-0.5 modern-scrollbar">
                  {det.detailsList.filter((seg: any) => seg.balance > 0).map((seg: any, sIdx: number) => (
                    <div key={sIdx} className="bg-slate-800/50 rounded p-1.5 border border-slate-800 flex flex-col gap-0.5 text-[9px]">
                      <div className="flex justify-between font-bold text-slate-350 items-center">
                        <span className="truncate text-white font-semibold">{seg.office}</span>
                        <span className="font-mono text-slate-405 text-[8px]">{seg.date}</span>
                      </div>
                      <div className="flex justify-between font-mono text-[8px] text-slate-400 pt-0.5 items-center">
                        <div>
                          <span>Inc: ₹{seg.income.toLocaleString()}</span>
                          <span className="mx-1">|</span>
                          <span>Adv: ₹{seg.advance.toLocaleString()}</span>
                          <span className="mx-1">|</span>
                          <span className="text-rose-400 font-bold">Bal: ₹{seg.balance.toLocaleString()}</span>
                        </div>
                        {seg.balance > 0 && onSaveTrips && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayDate(new Date().toISOString().substring(0, 10));
                              setPayAccount(accounts[0]?.id || '');
                              setPayAmount(seg.balance);
                              setPayNotes(`Quick Pay: ${seg.office}`);
                              setQuickPayTarget({
                                tripId: seg.tripId,
                                subTripId: seg.subTripId,
                                officeName: seg.office,
                                route: `${seg.routeFrom || 'Origin'} ➔ ${seg.routeTo || 'Destination'}`,
                                balance: seg.balance,
                                truckNo: hoveredTruck || undefined
                              });
                              setHoveredTruck(null);
                              setHoveredOffice(null);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-0.5 rounded cursor-pointer transition text-[8px] shrink-0"
                          >
                            Pay
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {hoveredOffice && (() => {
        const det = getOfficeHoverDetails(hoveredOffice);
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div 
                className="w-full max-w-xs bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-4 font-sans text-xs relative animate-fade-in"
                box-shadow="0 10px 25px -5px rgb(0 0 0 / 0.3)"
              >
                <button
                  type="button"
                  onClick={() => setHoveredOffice(null)}
                  className="absolute top-2 right-2 text-slate-400 hover:text-white p-1 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="border-b border-slate-705 pb-1.5 mb-2 flex justify-between items-center pr-6">
                  <div className="flex items-center gap-1.5 max-w-[200px]">
                    <span className="font-extrabold text-[12px] text-amber-400 tracking-wider font-mono truncate">{hoveredOffice}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(getOfficeShareText(hoveredOffice!, det), `office-mob-${hoveredOffice}`)}
                      title="Copy Outstanding Details"
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                    >
                      {copiedId === `office-mob-${hoveredOffice}` ? <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> : <Share2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Office Drilldown</span>
                </div>

                <div className="space-y-1.5 font-sans mb-3 text-slate-300">
                  <p>
                    <strong className="text-slate-400 uppercase text-[8px] block tracking-wide">Active Truck(s):</strong>
                    <span className="font-semibold text-white text-[11px] leading-tight block truncate">{det.truckList || 'N/A'}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                    <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                      <span className="text-slate-400 block font-bold text-[8px] uppercase">Billed Income</span>
                      <span className="font-mono font-bold text-emerald-400">₹{det.totalIncome.toLocaleString()}</span>
                    </div>
                    <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                      <span className="text-slate-400 block font-bold text-[8px] uppercase">Advance Info</span>
                      <span className="font-mono font-bold text-indigo-400">₹{det.totalPaid.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="bg-rose-950/40 border border-rose-900/40 p-1.5 rounded mt-1.5 flex justify-between items-center">
                    <span className="text-rose-300 font-bold text-[8px] uppercase">Net Outstanding</span>
                    <span className="font-mono font-bold text-rose-400 text-xs">₹{det.totalBalance.toLocaleString()}</span>
                  </div>
                </div>

                {det.detailsList.filter(seg => seg.balance > 0).length > 0 && (
                  <div className="border-t border-slate-800 pt-2">
                    <span className="text-slate-400 font-extrabold text-[8px] uppercase tracking-wider block mb-1">Truck Segment Logs</span>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto pr-0.5 modern-scrollbar">
                      {det.detailsList.filter(seg => seg.balance > 0).map((seg, sIdx) => (
                        <div key={sIdx} className="bg-slate-800/50 rounded p-1.5 border border-slate-800 flex flex-col gap-0.5 text-[9px]">
                          <div className="flex justify-between font-bold text-slate-350">
                            <span className="truncate text-white font-semibold">{seg.truckNo}</span>
                            <span className="font-mono text-slate-405 text-[8px]">{seg.date}</span>
                          </div>
                          <div className="flex justify-between font-mono text-[8px] text-slate-400 pt-0.5">
                            <span>Inc: ₹{seg.income}</span>
                            <span>Adv: ₹{seg.advance}</span>
                            <span className="text-rose-400 font-bold">Bal: ₹{seg.balance}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }
        return (
          <div 
            className="fixed z-50 w-80 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-4 font-sans text-xs pointer-events-auto transition-all duration-150 animate-fade-in"
            style={{ 
              left: `${hoverPosition.x}px`, 
              top: `${hoverPosition.y}px`,
              boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)'
            }}
            onMouseEnter={handleMouseEnterTooltip}
            onMouseLeave={handleMouseLeaveRowOrTooltip}
          >
            <div className="border-b border-slate-705 pb-1.5 mb-2 flex justify-between items-center">
              <div className="flex items-center gap-1.5 max-w-[200px]">
                <span className="font-extrabold text-[12px] text-amber-400 tracking-wider font-mono truncate">{hoveredOffice}</span>
                <button
                  type="button"
                  onClick={() => handleCopyText(getOfficeShareText(hoveredOffice!, det), `office-desk-${hoveredOffice}`)}
                  title="Copy Outstanding Details"
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                >
                  {copiedId === `office-desk-${hoveredOffice}` ? <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> : <Share2 className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[9px] text-slate-400 font-bold uppercase">Office Drilldown</span>
            </div>

            <div className="space-y-1.5 font-sans mb-3 text-slate-300">
              <p>
                <strong className="text-slate-400 uppercase text-[8px] block tracking-wide">Active Truck(s):</strong>
                <span className="font-semibold text-white text-[11px] leading-tight block truncate">{det.truckList || 'N/A'}</span>
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                  <span className="text-slate-400 block font-bold text-[8px] uppercase">Billed Income</span>
                  <span className="font-mono font-bold text-emerald-400">₹{det.totalIncome.toLocaleString()}</span>
                </div>
                <div className="bg-slate-800 p-1.5 rounded border border-slate-700">
                  <span className="text-slate-400 block font-bold text-[8px] uppercase">Advance Information</span>
                  <span className="font-mono font-bold text-indigo-400">₹{det.totalPaid.toLocaleString()}</span>
                </div>
              </div>
              <div className="bg-rose-950/40 border border-rose-900/40 p-1.5 rounded mt-1.5 flex justify-between items-center">
                <span className="text-rose-300 font-bold text-[8px] uppercase">Net Outstanding</span>
                <span className="font-mono font-bold text-rose-400 text-xs">₹{det.totalBalance.toLocaleString()}</span>
              </div>
            </div>

            {det.detailsList.filter((seg: any) => seg.balance > 0).length > 0 && (
              <div className="border-t border-slate-800 pt-2">
                <span className="text-slate-400 font-extrabold text-[8px] uppercase tracking-wider block mb-1">Truck Segment Logs</span>
                <div className="space-y-1 max-h-[120px] overflow-y-auto pr-0.5 modern-scrollbar">
                  {det.detailsList.filter((seg: any) => seg.balance > 0).map((seg: any, sIdx: number) => (
                    <div key={sIdx} className="bg-slate-800/50 rounded p-1.5 border border-slate-800 flex flex-col gap-0.5 text-[9px]">
                      <div className="flex justify-between font-bold text-slate-350 items-center">
                        <span className="truncate text-white font-semibold">{seg.truckNo}</span>
                        <span className="font-mono text-slate-405 text-[8px]">{seg.date}</span>
                      </div>
                      <div className="flex justify-between font-mono text-[8px] text-slate-400 pt-0.5 items-center">
                        <div>
                          <span>Inc: ₹{seg.income.toLocaleString()}</span>
                          <span className="mx-1">|</span>
                          <span>Adv: ₹{seg.advance.toLocaleString()}</span>
                          <span className="mx-1">|</span>
                          <span className="text-rose-400 font-bold">Bal: ₹{seg.balance.toLocaleString()}</span>
                        </div>
                        {seg.balance > 0 && onSaveTrips && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayDate(new Date().toISOString().substring(0, 10));
                              setPayAccount(accounts[0]?.id || '');
                              setPayAmount(seg.balance);
                              setPayNotes(`Quick Pay: ${hoveredOffice}`);
                              setQuickPayTarget({
                                tripId: seg.tripId,
                                subTripId: seg.subTripId,
                                officeName: hoveredOffice || 'Office',
                                route: `${seg.routeFrom || 'Origin'} ➔ ${seg.routeTo || 'Destination'}`,
                                balance: seg.balance,
                                truckNo: seg.truckNo
                              });
                              setHoveredTruck(null);
                              setHoveredOffice(null);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-0.5 rounded cursor-pointer transition text-[8px] shrink-0"
                          >
                            Pay
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* QUICK ADD PAYMENT RECEIPT MODAL */}
      {quickPayTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 no-print animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-2xl max-w-md w-full animate-scale-up font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-sans flex items-center gap-1.5">
                  Register Payment Receipt
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                  Quick recording for segment: <strong className="text-blue-600">{quickPayTarget.route}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickPayTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-650 bg-slate-50 p-3 rounded-xl border border-slate-150">
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Office Branch</span>
                <span className="text-slate-850 font-bold truncate block">{quickPayTarget.officeName}</span>
              </div>
              {quickPayTarget.truckNo && (
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Truck No</span>
                  <span className="text-slate-850 font-mono font-bold tracking-wider block">{quickPayTarget.truckNo}</span>
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
                  className="w-full bg-slate-50 border border-slate-250 text-slate-850 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Ledger Account</label>
                <select
                  value={payAccount}
                  onChange={(e) => setPayAccount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 text-slate-850 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:bg-white font-bold"
                >
                  <option value="">-- Choose Account --</option>
                  <option value="paid_to_driver_advance">Paid to Driver Advance</option>
                  <option value="Cash">Cash</option>
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
                  className="w-full bg-slate-50 border border-slate-250 text-slate-850 rounded-lg px-3 py-2 font-mono font-bold text-right focus:outline-none focus:border-blue-500 focus:bg-white text-base text-emerald-700"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Notes / Cargo Ref</label>
                <input
                  type="text"
                  placeholder="e.g. Bank online transfer"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 text-slate-805 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickPayTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!onSaveTrips || !allTrips) return;
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

                  const updatedTrips = allTrips.map(t => {
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
    </div>
  );
}
