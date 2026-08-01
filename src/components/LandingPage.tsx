import { createSignal } from 'solid-js';

import { useNavigate } from '@solidjs/router';
import logo from '../logo.png';
import CountryCodePhoneInput from './CountryCodePhoneInput';
import {
  Shield,
  MapPin,
  Phone,
  Mail,
  Navigation,
  Clock,
  BarChart3,
  Coins,
  Truck,
  MessageSquare,
  ArrowRight,
  Menu,
  X,
  Users,
  CheckCircle,
  Activity,
  Cpu,
  Database,
  FileSpreadsheet,
  Zap,
  Lock,
  RefreshCw,
  FileText
} from 'lucide-solid';

interface LandingPageProps {
  onEnterConsole: () => void;
  onRaisePublicTicket?: (
    name: string,
    email: string,
    phone: string,
    category: 'Technical' | 'Billing' | 'General',
    message: string
  ) => Promise<void>;
}

export default function LandingPage({ onEnterConsole, onRaisePublicTicket }: LandingPageProps) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = createSignal<'HOME' | 'PROFILE' | 'ABOUT' | 'CONTACT'>('HOME');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = createSignal(false);
  const [contactForm, setContactForm] = createSignal({ name: '', email: '', phone: '', issueCategory: 'General' as 'General' | 'Technical' | 'Billing', message: '' });
  const [isSubmitted, setIsSubmitted] = createSignal(false);

  const handleContactSubmit = async (e: Event) => {
    e.preventDefault();
    if (!contactForm().name || !contactForm().email || !contactForm().phone || !contactForm().message) return;
    try {
      if (onRaisePublicTicket) {
        await onRaisePublicTicket(
          contactForm().name,
          contactForm().email,
          contactForm().phone,
          contactForm().issueCategory,
          contactForm().message
        );
      }
      setIsSubmitted(true);
      setTimeout(() => {
        setContactForm({ name: '', email: '', phone: '', issueCategory: 'General', message: '' });
        setIsSubmitted(false);
      }, 4000);
    } catch (err) {
      alert("Failed to send message: " + (err as any).message);
    }
  };

  const navItems = [
    { id: 'HOME', label: 'Home' },
    { id: 'PROFILE', label: 'Company Profile' },
    { id: 'ABOUT', label: 'About Us' },
    { id: 'CONTACT', label: 'Contact Us' }
  ];

  return (
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans select-none overflow-x-hidden selection:bg-blue-600/10">

      {/* TOP ANNOUNCEMENT BANNER */}
      <div class="bg-slate-900 dark:bg-slate-950 text-slate-300 text-xs md:text-sm font-medium py-1.5 px-4 text-center border-b border-slate-800 tracking-wide select-none">
        This Site in Beta test mode - the database maybe deleted once site on live
      </div>

      {/* HEADER */}
      <header class="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div class="flex items-center">
            <img src={logo} alt="LorryGuru Logo" class="h-32 w-auto object-contain shrink-0" />
          </div>

          {/* Desktop Navigation */}
          <nav class="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                
                onClick={() => setActiveSection(item.id as any)}
                class={`text-sm font-semibold transition-colors cursor-pointer ${activeSection() === item.id
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div class="hidden md:flex items-center gap-4">
            <button
              onClick={onEnterConsole}
              class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md shadow-blue-600/15 hover:shadow-blue-600/25 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Access Console</span>
              <ArrowRight class="w-4 h-4" />
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen())}
            class="md:hidden p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
          >
            {isMobileMenuOpen() ? <X class="w-6 h-6" /> : <Menu class="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen() && (
        <div class="md:hidden fixed inset-0 z-40 bg-white dark:bg-slate-900 pt-16 flex flex-col p-6 animate-fade-in border-b border-slate-200 dark:border-slate-800">
          <div class="flex flex-col gap-4 mt-6">
            {navItems.map((item) => (
              <button
                
                onClick={() => {
                  setActiveSection(item.id as any);
                  setIsMobileMenuOpen(false);
                }}
                class={`text-lg font-bold text-left py-2 border-b border-slate-100 dark:border-slate-850 ${activeSection() === item.id
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-550 dark:text-slate-400'
                  }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onEnterConsole();
              }}
              class="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-center flex items-center justify-center gap-2 shadow-lg"
            >
              <span>Access Console</span>
              <ArrowRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* SECTION: HOME */}
        {activeSection() === 'HOME' && (
          <div class="space-y-16 animate-fade-in">
            {/* Hero Grid */}
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div class="lg:col-span-7 space-y-6 text-left">
                <span class="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20 tracking-wider uppercase">
                  Logistics Management Hub
                </span>
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  Drive Your Business <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-300">Forward</span>
                </h1>
                <p class="text-base text-slate-550 dark:text-slate-400 leading-relaxed max-w-xl">
                  LorryGuru provides transport operators with real-time trip booking ledgers, instant profitability tracking, multi-axle tyre lifespan management, and secure role-based access.
                </p>
                <div class="flex flex-wrap gap-4 pt-2">
                  <button
                    onClick={onEnterConsole}
                    class="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-bold shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>Launch App Console</span>
                    <ArrowRight class="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setActiveSection('PROFILE')}
                    class="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-base font-bold transition-all border border-slate-200 dark:border-slate-800 cursor-pointer"
                  >
                    Explore Profile
                  </button>
                </div>
              </div>

              {/* Graphic Preview Pane */}
              <div class="lg:col-span-5 relative">
                <div class="absolute inset-0 bg-blue-500/10 rounded-3xl blur-3xl pointer-events-none"></div>
                <div class="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-left">
                  <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-3">
                    <span class="font-bold text-xs uppercase tracking-wider text-slate-400">Live Active Monitor</span>
                    <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  </div>

                  {/* Stats card mock */}
                  <div class="grid grid-cols-2 gap-4">
                    <div class="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <Truck class="w-5 h-5 text-blue-500 mb-2" />
                      <span class="text-[10px] text-slate-500 block">Fleet Active</span>
                      <span class="text-xl font-bold text-slate-900 dark:text-white">98.4%</span>
                    </div>
                    <div class="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <Clock class="w-5 h-5 text-indigo-500 mb-2" />
                      <span class="text-[10px] text-slate-500 block">On-Time segment</span>
                      <span class="text-xl font-bold text-slate-900 dark:text-white">99.1%</span>
                    </div>
                  </div>

                  {/* Route track mock */}
                  <div class="p-4 bg-slate-50/60 dark:bg-slate-950/40 rounded-2xl border border-slate-100/60 dark:border-slate-850/50 space-y-3">
                    <div class="flex justify-between items-center text-[10px]">
                      <span class="font-bold text-slate-400">Segment Route #092</span>
                      <span class="text-blue-500 font-bold">In-Transit</span>
                    </div>
                    <div class="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative">
                      <div class="h-full bg-blue-600 rounded-full w-2/3 animate-pulse"></div>
                    </div>
                    <div class="flex justify-between items-center text-xs font-semibold">
                      <span>Chennai Hub</span>
                      <span>Mumbai Branch</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Features Row */}
            <div class="space-y-4 pt-10">
              <div class="text-left space-y-1">
                <span class="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-500/20 uppercase tracking-widest">
                  Platform Architecture
                </span>
                <h2 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Enterprise Logistics Capabilities</h2>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-left space-y-3 shadow-xs hover:border-blue-500/30 transition-all">
                  <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Navigation class="w-5 h-5" />
                  </div>
                  <h3 class="font-bold text-sm text-slate-900 dark:text-white">Active Dispatch & SubTrip Logs</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Record segment cargo details, truck loadings, driver metrics, cargo expense bearings (Org/Office/Driver), and route branch configurations.
                  </p>
                </div>

                <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-left space-y-3 shadow-xs hover:border-indigo-500/30 transition-all">
                  <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Zap class="w-5 h-5" />
                  </div>
                  <h3 class="font-bold text-sm text-slate-900 dark:text-white">TanStack Query Caching</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Sub-millisecond query caching, background revalidation, optimistic mutation state management, and zero-latency UI updates.
                  </p>
                </div>

                <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-left space-y-3 shadow-xs hover:border-emerald-500/30 transition-all">
                  <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Coins class="w-5 h-5" />
                  </div>
                  <h3 class="font-bold text-sm text-slate-900 dark:text-white">Driver Settlement Ledger</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Automated driver hand-cash advances, trip-level expense credits, fuel reimbursements, and instant net balance reconciliation statement sheets.
                  </p>
                </div>

                <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-left space-y-3 shadow-xs hover:border-purple-500/30 transition-all">
                  <div class="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Truck class="w-5 h-5" />
                  </div>
                  <h3 class="font-bold text-sm text-slate-900 dark:text-white">Multi-Axle Tyres Master</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Position-based wheel mounting, dismounting history, manufacturer tread depth ODO wear indicators, and scrap/sale accounting.
                  </p>
                </div>

                <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-left space-y-3 shadow-xs hover:border-amber-500/30 transition-all">
                  <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Lock class="w-5 h-5" />
                  </div>
                  <h3 class="font-bold text-sm text-slate-900 dark:text-white">WhatsApp & Double 2FA Security</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    WhatsApp OTP delivery gateway, TOTP two-factor wizard locks, encrypted session key memory, and role-based access permissions.
                  </p>
                </div>

                <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-left space-y-3 shadow-xs hover:border-cyan-500/30 transition-all">
                  <div class="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <Cpu class="w-5 h-5" />
                  </div>
                  <h3 class="font-bold text-sm text-slate-900 dark:text-white">Background Job Queue & CDN Media</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Asynchronous worker task queue for PDF report generation, bulk CSV parsing, WebP media compression, and CDN preview acceleration.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION: COMPANY PROFILE */}
        {activeSection() === 'PROFILE' && (
          <div class="space-y-12 animate-fade-in text-left">
            <div class="text-center space-y-3 max-w-xl mx-auto mb-10">
              <span class="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20 uppercase tracking-wider">
                Capabilities
              </span>
              <h2 class="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Company Profile</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                LorryGuru is a state-of-the-art SaaS logistics infrastructure designed to empower regional transport corporations with automated operations management.
              </p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 items-stretch">
              <div class="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-6">
                <h3 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 class="w-5 h-5 text-blue-500" />
                  Our Core Platform Services
                </h3>
                <ul class="space-y-4 text-xs text-slate-655 dark:text-slate-400 leading-relaxed">
                  <li class="flex items-start gap-3">
                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                    <span><strong>Multi-Axle Tyres Ledger</strong>: Maintain a precise ledger of wheel positions, manufacturer logs, and ODO wear indicators to avoid sudden roadside failures.</span>
                  </li>
                  <li class="flex items-start gap-3">
                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                    <span><strong>Branch Accounting</strong>: Balance trip freight values against local expenditures and branch advances instantly without manual reconciliation.</span>
                  </li>
                  <li class="flex items-start gap-3">
                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                    <span><strong>Audit Logging</strong>: Track system write actions, authorization permissions, and database operations transparently.</span>
                  </li>
                </ul>
              </div>

              <div class="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col justify-between">
                <div>
                  <h3 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                    <Users class="w-5 h-5 text-blue-500" />
                    LorryGuru in Metrics
                  </h3>
                  <div class="grid grid-cols-2 gap-6">
                    <div>
                      <span class="text-2xl font-black text-blue-600 dark:text-blue-400">1.2M+</span>
                      <span class="text-[10px] text-slate-500 block mt-1 font-semibold uppercase">Trips Audited</span>
                    </div>
                    <div>
                      <span class="text-2xl font-black text-blue-600 dark:text-blue-400">500+</span>
                      <span class="text-[10px] text-slate-500 block mt-1 font-semibold uppercase">Transport Hubs</span>
                    </div>
                    <div>
                      <span class="text-2xl font-black text-blue-600 dark:text-blue-400">50K+</span>
                      <span class="text-[10px] text-slate-500 block mt-1 font-semibold uppercase">Registered Trucks</span>
                    </div>
                    <div>
                      <span class="text-2xl font-black text-blue-600 dark:text-blue-400">99.9%</span>
                      <span class="text-[10px] text-slate-500 block mt-1 font-semibold uppercase">Server Uptime</span>
                    </div>
                  </div>
                </div>
                <div class="pt-6 border-t border-slate-100 dark:border-slate-850 mt-6">
                  <p class="text-[10px] text-slate-550 dark:text-slate-400 italic">
                    "Transitioning our branch ledgers from handwritten registers to LorryGuru has reduced dispatch verification timelines by over 80%."
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION: ABOUT US */}
        {activeSection() === 'ABOUT' && (
          <div class="space-y-12 animate-fade-in text-left">
            <div class="text-center space-y-3 max-w-xl mx-auto mb-10">
              <span class="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20 uppercase tracking-wider">
                Our Mission
              </span>
              <h2 class="text-3xl font-black tracking-tight text-slate-900 dark:text-white">About Us</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Founded with a vision to digitize the logistics backbone of India, LorryGuru simplifies complex fleet management variables into single-pane operational interfaces.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <span class="text-xs font-extrabold text-blue-650 dark:text-blue-400 uppercase tracking-widest font-mono">01. Reliability</span>
                <h4 class="font-bold text-sm text-slate-900 dark:text-white">Built for the Field</h4>
                <p class="text-xs text-slate-550 dark:text-slate-400 leading-relaxed">
                  Our platform works seamlessly on low-bandwidth connections and integrates local client cache backups. You never lose your transaction journals.
                </p>
              </div>

              <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <span class="text-xs font-extrabold text-blue-655 dark:text-blue-400 uppercase tracking-widest font-mono">02. Accessibility</span>
                <h4 class="font-bold text-sm text-slate-900 dark:text-white">Intuitive Design</h4>
                <p class="text-xs text-slate-550 dark:text-slate-400 leading-relaxed">
                  We incorporate built-in multilingual Voice Assistants so that branch operators can dictate trip bookings and expense logs hands-free in regional languages.
                </p>
              </div>

              <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <span class="text-xs font-extrabold text-blue-650 dark:text-blue-400 uppercase tracking-widest font-mono">03. Security</span>
                <h4 class="font-bold text-sm text-slate-900 dark:text-white">Secured Infrastructure</h4>
                <p class="text-xs text-slate-550 dark:text-slate-400 leading-relaxed">
                  Restricted domain routing via Cloudflare proxy hides your servers from targeted external DDoS attacks, and robust multi-factor locks keep client databases safe.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SECTION: CONTACT US */}
        {activeSection() === 'CONTACT' && (
          <div class="space-y-12 animate-fade-in text-left">
            <div class="text-center space-y-3 max-w-xl mx-auto mb-10">
              <span class="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20 uppercase tracking-wider">
                Support
              </span>
              <h2 class="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Contact Us</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Have questions about onboarding your fleet or setting up custom branch permissions? Our support team is available 24/7.
              </p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
              {/* Form Card */}
              <div class="lg:col-span-7 p-6 md:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">
                <form onSubmit={handleContactSubmit} class="space-y-4">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1.5">
                      <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Your Name</label>
                      <input
                        type="text"
                        value={contactForm().name}
                        onChange={(e) => setContactForm({ ...contactForm(), name: e.target.value })}
                        required
                        placeholder="John Doe"
                        class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-600"
                      />
                    </div>
                    <div class="space-y-1.5">
                      <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Email Address</label>
                      <input
                        type="email"
                        value={contactForm().email}
                        onChange={(e) => setContactForm({ ...contactForm(), email: e.target.value })}
                        required
                        placeholder="john@company.com"
                        class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1.5">
                      <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Mobile Number (with Country Code)</label>
                      <CountryCodePhoneInput
                        value={contactForm().phone}
                        onChange={(phone) => setContactForm({ ...contactForm(), phone })}
                        required
                        placeholder="Enter mobile number"
                      />
                    </div>
                    <div class="space-y-1.5">
                      <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Issue Category</label>
                      <select
                        value={contactForm().issueCategory}
                        onChange={(e) => setContactForm({ ...contactForm(), issueCategory: e.target.value as any })}
                        class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition-all text-slate-800 dark:text-slate-200"
                      >
                        <option value="General">General Support</option>
                        <option value="Technical">Technical Issue</option>
                        <option value="Billing">Billing & Invoices</option>
                      </select>
                    </div>
                  </div>

                  <div class="space-y-1.5">
                    <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Message Description</label>
                    <textarea
                      value={contactForm().message}
                      onChange={(e) => setContactForm({ ...contactForm(), message: e.target.value })}
                      required
                      rows={5}
                      placeholder="How can we help your operations?"
                      class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-655"
                    />
                  </div>

                  {isSubmitted() && (
                    <div class="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-start gap-2 text-emerald-400 text-xs leading-normal font-semibold">
                      <CheckCircle class="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Thank you! Your message has been sent successfully. We will get back to you shortly.</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/10 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare class="w-4 h-4" />
                    <span>Send Message</span>
                  </button>
                </form>
              </div>

              {/* Details Card */}
              <div class="lg:col-span-5 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col justify-between space-y-6">
                <div class="space-y-6">
                  <h3 class="text-xl font-bold text-slate-900 dark:text-white">Get in Touch</h3>
                  <div class="space-y-4">
                    <div class="flex items-start gap-3 text-xs leading-normal">
                      <MapPin class="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <span>
                        <strong>Lorry Guru Technologies</strong><br />
                        5/6 Kodakarankady, Avarangampalayam,<br />
                        Sankari, Salem - 637301, Tamil Nadu, India.
                      </span>
                    </div>
                    <div class="flex items-center gap-3 text-xs">
                      <Phone class="w-4 h-4 text-blue-500 shrink-0" />
                      <span>+91 44 2235 9000</span>
                    </div>
                    <div class="flex items-center gap-3 text-xs">
                      <Mail class="w-4 h-4 text-blue-500 shrink-0" />
                      <span>support@lorryguru.in</span>
                    </div>
                  </div>
                </div>
                <div class="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    <strong>Integrations Alert:</strong> To connect your branch gateway to SMS and WhatsApp alerts, please ensure your server config credentials match the options in the console.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-8 text-center text-xs text-slate-400 dark:text-slate-500 transition-colors mt-auto">
        <div class="max-w-7xl mx-auto px-4 space-y-3">
          <p>© {new Date().getFullYear()} LorryGuru (lorryguru.in). All rights reserved.</p>
          <div class="flex justify-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
            <button onClick={() => navigate('/terms')} class="hover:underline cursor-pointer">Terms & Conditions</button>
            <span>•</span>
            <button onClick={() => navigate('/privacy')} class="hover:underline cursor-pointer">Privacy Policy</button>
            <span>•</span>
            <button onClick={() => navigate('/refunds')} class="hover:underline cursor-pointer">Refund & Cancellation Policy</button>
          </div>
          <p class="text-[10px] text-slate-500 mt-1">
            Powered by React, TailwindCSS, and secure self-hosted Appwrite on AWS.
          </p>
        </div>
      </footer>

    </div>
  );
}
