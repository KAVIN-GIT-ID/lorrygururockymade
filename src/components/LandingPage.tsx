import React, { useState } from 'react';
import {
  ArrowRight,
  Truck,
  Clock,
  Send,
  Receipt,
  ShieldCheck,
  Briefcase,
  TrendingUp,
  X,
  Menu,
  FileText,
  Mail,
  Phone,
  User,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface LandingPageProps {
  onEnterConsole: () => void;
  onRaisePublicTicket?: (
    name: string,
    email: string,
    phone: string,
    issueCategory: string,
    message: string
  ) => Promise<void>;
  onOpenPolicy?: (type: 'terms' | 'privacy' | 'refunds') => void;
}

export default function LandingPage({
  onEnterConsole,
  onRaisePublicTicket,
  onOpenPolicy
}: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<'HOME' | 'PROFILE' | 'ABOUT' | 'CONTACT'>('HOME');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    issueCategory: 'General',
    message: ''
  });
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [activePolicyModal, setActivePolicyModal] = useState<'terms' | 'privacy' | 'refunds' | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.phone || !contactForm.message) {
      return;
    }

    setSubmittingTicket(true);
    try {
      if (onRaisePublicTicket) {
        await onRaisePublicTicket(
          contactForm.name,
          contactForm.email,
          contactForm.phone,
          contactForm.issueCategory,
          contactForm.message
        );
      }
      setTicketSubmitted(true);
      setTimeout(() => {
        setContactForm({
          name: '',
          email: '',
          phone: '',
          issueCategory: 'General',
          message: ''
        });
        setTicketSubmitted(false);
      }, 4000);
    } catch (err: any) {
      alert('Failed to send message: ' + (err.message || err));
    } finally {
      setSubmittingTicket(false);
    }
  };

  const navItems: { id: 'HOME' | 'PROFILE' | 'ABOUT' | 'CONTACT'; label: string }[] = [
    { id: 'HOME', label: 'Home' },
    { id: 'PROFILE', label: 'Company Profile' },
    { id: 'ABOUT', label: 'About Us' },
    { id: 'CONTACT', label: 'Contact Us' }
  ];

  const handlePolicyClick = (type: 'terms' | 'privacy' | 'refunds') => {
    if (onOpenPolicy) {
      onOpenPolicy(type);
    } else {
      setActivePolicyModal(type);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans select-none overflow-x-hidden selection:bg-blue-600/10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center cursor-pointer" onClick={() => setActiveTab('HOME')}>
            <img
              src="/assets/logo-CkJqcrTB.png"
              alt="LorryGuru Logo"
              className="h-12 w-auto object-contain shrink-0"
              onError={(e) => {
                // Fallback text if image cannot be loaded
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white ml-2">
              Lorry<span className="text-blue-600">Guru</span><span className="text-amber-500">.in</span>
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`text-sm font-semibold transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={onEnterConsole}
              id="btn-access-console"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-600/15 hover:shadow-blue-600/25 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Access Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white dark:bg-slate-900 pt-20 flex flex-col p-6 animate-fade-in border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col gap-4 mt-4">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`text-lg font-bold text-left py-2 border-b border-slate-100 dark:border-slate-850 ${
                  activeTab === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onEnterConsole();
              }}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-center flex items-center justify-center gap-2 shadow-lg"
            >
              <span>Access Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* HOME TAB */}
        {activeTab === 'HOME' && (
          <div className="space-y-16 animate-fade-in">
            {/* Hero Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6 text-left">
                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20 tracking-wider uppercase inline-block">
                  Logistics Management Hub
                </span>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  Drive Your Business{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-300">
                    Forward
                  </span>
                </h1>
                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                  LorryGuru provides transport operators with real-time trip booking ledgers, instant profitability
                  tracking, multi-axle tyre lifespan management, and secure role-based access.
                </p>
                <div className="flex flex-wrap gap-4 pt-2">
                  <button
                    onClick={onEnterConsole}
                    className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-bold shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>Launch App Console</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setActiveTab('PROFILE')}
                    className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-base font-bold transition-all border border-slate-200 dark:border-slate-800 cursor-pointer"
                  >
                    Explore Profile
                  </button>
                </div>
              </div>

              {/* Live Active Monitor Card */}
              <div className="lg:col-span-5 relative">
                <div className="absolute inset-0 bg-blue-500/10 rounded-3xl blur-3xl pointer-events-none"></div>
                <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-left">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-400">
                      Live Active Monitor
                    </span>
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <Truck className="w-5 h-5 text-blue-500 mb-2" />
                      <span className="text-[10px] text-slate-500 block font-medium">Fleet Active</span>
                      <span className="text-xl font-bold text-slate-900 dark:text-white">98.4%</span>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <Clock className="w-5 h-5 text-indigo-500 mb-2" />
                      <span className="text-[10px] text-slate-500 block font-medium">On-Time segment</span>
                      <span className="text-xl font-bold text-slate-900 dark:text-white">99.1%</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50/60 dark:bg-slate-950/40 rounded-2xl border border-slate-100/60 dark:border-slate-850/50 space-y-3">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-slate-400">Segment Route #092</span>
                      <span className="text-blue-500 font-bold">In-Transit</span>
                    </div>
                    <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative">
                      <div className="h-full bg-blue-600 rounded-full w-2/3 animate-pulse"></div>
                    </div>
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span>Chennai Hub</span>
                      <span>Mumbai Branch</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-10">
              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-left space-y-3 shadow-xs hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Active Dispatch Logs</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Record segment cargo details, truck loadings, driver metrics, and route branch configurations.
                </p>
              </div>

              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-left space-y-3 shadow-xs hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Voucher Ledger</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Audit fuel slips, advance driver allocations, and maintenance costs under automated ledgers.
                </p>
              </div>

              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-left space-y-3 shadow-xs hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Enterprise Security</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Secure access controls with Two-Factor Auth (2FA), Cloudflare Edge security, and encrypted D1 database.
                </p>
              </div>

              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-left space-y-3 shadow-xs hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Real-Time Sync</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Synchronize data instantly across all devices. Local backup recovery checks ensure offline reliability.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* COMPANY PROFILE TAB */}
        {activeTab === 'PROFILE' && (
          <div className="space-y-12 animate-fade-in text-left">
            <div className="text-center space-y-3 max-w-xl mx-auto mb-10">
              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20 uppercase tracking-wider">
                Capabilities
              </span>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Company Profile</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                LorryGuru is a state-of-the-art SaaS logistics infrastructure designed to empower regional transport
                corporations with automated operations management.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-stretch">
              <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-500" />
                  Our Core Platform Services
                </h3>
                <ul className="space-y-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                    <span>
                      <strong className="text-slate-900 dark:text-white font-bold">Multi-Axle Tyres Ledger</strong>: Maintain a precise ledger of
                      wheel positions, manufacturer logs, and ODO wear indicators to avoid sudden roadside failures.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                    <span>
                      <strong className="text-slate-900 dark:text-white font-bold">Branch Accounting</strong>: Balance trip freight values against local
                      expenditures and branch advances instantly without manual reconciliation.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                    <span>
                      <strong className="text-slate-900 dark:text-white font-bold">Audit Logging</strong>: Track system write actions, authorization
                      permissions, and database operations transparently.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    LorryGuru in Metrics
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <span className="text-2xl font-black text-blue-600 dark:text-blue-400">1.2M+</span>
                      <span className="text-[10px] text-slate-500 block mt-1 font-semibold uppercase">Trips Audited</span>
                    </div>
                    <div>
                      <span className="text-2xl font-black text-blue-600 dark:text-blue-400">500+</span>
                      <span className="text-[10px] text-slate-500 block mt-1 font-semibold uppercase">Transport Hubs</span>
                    </div>
                    <div>
                      <span className="text-2xl font-black text-blue-600 dark:text-blue-400">50K+</span>
                      <span className="text-[10px] text-slate-500 block mt-1 font-semibold uppercase">Registered Trucks</span>
                    </div>
                    <div>
                      <span className="text-2xl font-black text-blue-600 dark:text-blue-400">99.9%</span>
                      <span className="text-[10px] text-slate-500 block mt-1 font-semibold uppercase">Server Uptime</span>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 dark:border-slate-850 mt-6">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed">
                    "Transitioning our branch ledgers from handwritten registers to LorryGuru has reduced dispatch
                    verification timelines by over 80%."
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABOUT US TAB */}
        {activeTab === 'ABOUT' && (
          <div className="space-y-12 animate-fade-in text-left">
            <div className="text-center space-y-3 max-w-xl mx-auto mb-10">
              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20 uppercase tracking-wider">
                Our Mission
              </span>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">About Us</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Founded with a vision to digitize the logistics backbone of India, LorryGuru simplifies complex fleet
                management variables into single-pane operational interfaces.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
                  01. Reliability
                </span>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Built for the Field</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Our platform works seamlessly on low-bandwidth connections and integrates local client cache backups. You never lose your transaction journals.
                </p>
              </div>

              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
                  02. Accessibility
                </span>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Intuitive Design</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  We incorporate built-in multilingual Voice Assistants so that branch operators can dictate trip bookings and expense logs hands-free in regional languages.
                </p>
              </div>

              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
                  03. Security
                </span>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Secured Infrastructure</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Restricted domain routing via Cloudflare proxy hides your servers from targeted external DDoS attacks, and robust multi-factor locks keep client databases safe.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CONTACT US TAB */}
        {activeTab === 'CONTACT' && (
          <div className="space-y-12 animate-fade-in text-left">
            <div className="text-center space-y-3 max-w-xl mx-auto mb-10">
              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20 uppercase tracking-wider">
                Support
              </span>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Contact Us</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Have questions about onboarding your fleet or setting up custom branch permissions? Our support team is available 24/7.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
              <div className="lg:col-span-7 p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        Your Name
                      </label>
                      <input
                        type="text"
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        required
                        placeholder="John Doe"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        required
                        placeholder="john@company.com"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        Mobile Number
                      </label>
                      <input
                        type="tel"
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        required
                        placeholder="+919876543210"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        Issue Category
                      </label>
                      <select
                        value={contactForm.issueCategory}
                        onChange={(e) => setContactForm({ ...contactForm, issueCategory: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition-all text-slate-800 dark:text-slate-200"
                      >
                        <option value="General">General Support</option>
                        <option value="Technical">Technical Issue</option>
                        <option value="Billing">Billing & Invoices</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      Message Description
                    </label>
                    <textarea
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      required
                      rows={5}
                      placeholder="How can we help your operations?"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-400"
                    ></textarea>
                  </div>

                  {ticketSubmitted && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-fade-in">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Thank you! Your ticket has been dispatched to our operations team.</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingTicket}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submittingTicket ? 'Submitting...' : 'Send Message'}
                  </button>
                </form>
              </div>

              {/* Direct Reach Card */}
              <div className="lg:col-span-5 p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Direct Reach</h3>
                  <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Mail className="w-4 h-4" />
                      </div>
                      <span>support@lorryguru.in</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Phone className="w-4 h-4" />
                      </div>
                      <span>+91 94892 23134</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs text-slate-500 leading-relaxed">
                  <strong className="text-slate-800 dark:text-slate-200 block mb-1">Integrations Alert:</strong>
                  To connect your branch gateway to SMS and WhatsApp alerts, please ensure your server config credentials match the options in the console.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-8 text-center text-xs text-slate-400 dark:text-slate-500 transition-colors mt-auto">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <p>© {new Date().getFullYear()} LorryGuru (lorryguru.in). All rights reserved.</p>
          <div className="flex justify-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
            <button
              type="button"
              onClick={() => handlePolicyClick('terms')}
              className="hover:underline cursor-pointer"
            >
              Terms & Conditions
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => handlePolicyClick('privacy')}
              className="hover:underline cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => handlePolicyClick('refunds')}
              className="hover:underline cursor-pointer"
            >
              Refund & Cancellation Policy
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Powered by React, TailwindCSS, and Cloudflare Worker & D1 edge infrastructure.
          </p>
        </div>
      </footer>

      {/* Simple Policy Modal Dialog */}
      {activePolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in text-left">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {activePolicyModal === 'terms' && 'Terms & Conditions'}
                {activePolicyModal === 'privacy' && 'Privacy Policy'}
                {activePolicyModal === 'refunds' && 'Refund & Cancellation Policy'}
              </h3>
              <button
                onClick={() => setActivePolicyModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
              {activePolicyModal === 'terms' && (
                <>
                  <p>Welcome to LorryGuru (lorryguru.in). By accessing our services, you agree to comply with our platform terms.</p>
                  <p>1. <strong>Account Responsibility:</strong> You are responsible for safeguarding your credentials and all activities occurring under your account.</p>
                  <p>2. <strong>Data Accuracy:</strong> Fleet metrics, fuel slips, and trip calculations entered by operators remain the property and responsibility of the registering entity.</p>
                  <p>3. <strong>Service Availability:</strong> We maintain high availability via edge Cloudflare infrastructure with automated data replication.</p>
                </>
              )}

              {activePolicyModal === 'privacy' && (
                <>
                  <p>LorryGuru is committed to safeguarding your transport and fleet operations data.</p>
                  <p>1. <strong>Data Collection:</strong> We collect registration information (name, email, verified mobile number) and operational logs (trips, trucks, expenses) solely for providing platform services.</p>
                  <p>2. <strong>Data Security:</strong> Passwords are cryptographically salted and hashed using PBKDF2. Database records are stored securely in D1 edge storage.</p>
                  <p>3. <strong>No Third-Party Sharing:</strong> We do not sell or monetize your proprietary fleet routes or commercial financial records.</p>
                </>
              )}

              {activePolicyModal === 'refunds' && (
                <>
                  <p>LorryGuru subscription terms and refund rules:</p>
                  <p>1. <strong>Vehicle Licenses:</strong> Subscriptions are billed per vehicle license (e.g., ₹4,000/year). Subscriptions activate automatically upon successful payment verification.</p>
                  <p>2. <strong>Cancellation:</strong> You may cancel vehicle renewals at any time from your Organization Console.</p>
                  <p>3. <strong>Refund Requests:</strong> Eligible refund requests submitted within 7 days of activation will be reviewed and processed to original payment methods within 5–7 business days.</p>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setActivePolicyModal(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
