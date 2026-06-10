import React, { useState, useEffect } from 'react';
import { ArrowLeft, Shield, FileText, RefreshCw, Sun, Moon } from 'lucide-react';
import logo from '../logo.png';

interface LegalPageProps {
  defaultTab?: 'terms' | 'privacy' | 'refunds';
  onBack: () => void;
}

export default function LegalPage({ defaultTab = 'terms', onBack }: LegalPageProps) {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'refunds'>(defaultTab);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ttt_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ttt_theme', theme);
  }, [theme]);

  const tabs = [
    { id: 'terms', label: 'Terms & Conditions', icon: FileText },
    { id: 'privacy', label: 'Privacy Policy', icon: Shield },
    { id: 'refunds', label: 'Refund & Cancellation Policy', icon: RefreshCw }
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 selection:bg-blue-600/10">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors h-20 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
            <img src={logo} alt="LorryGuru Logo" className="h-14 w-auto object-contain" />
          </div>

          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row gap-8 min-h-0">
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </aside>

        {/* CONTENT CONTAINER */}
        <main className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-10 shadow-sm overflow-y-auto max-h-[calc(100vh-12rem)] modern-scrollbar">
          {activeTab === 'terms' && (
            <article className="prose dark:prose-invert max-w-none text-left space-y-6">
              <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">Terms & Conditions</h1>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Last Updated: June 8, 2026</p>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800" />

              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-350">
                Welcome to LorryGuru. These Terms and Conditions (&quot;Terms&quot;) govern your use of the website located at{' '}
                <a href="https://lorryguru.in" className="text-blue-600 dark:text-blue-400 hover:underline">lorryguru.in</a>{' '}
                and the associated SaaS logistics management platform. The platform is operated by <strong>Lorry Guru Technologies</strong>.
              </p>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">1. Acceptance of Terms</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  By registering an account, accessing the console, or using any part of our services, you agree to comply with and be bound by these Terms. If you do not agree to these Terms, you must not use or access the services.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">2. Account Registration and Security</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  To use the Truck-Trip-Tracker console, you must create an account. You agree to provide accurate and complete registration information. You are solely responsible for maintaining the confidentiality of your credentials (including Two-Factor Authentication secrets) and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">3. Usage Permissions and Access Controls</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Our service provides role-based access control (Admin, SuperAdmin, Custom, etc.) allowing organization managers to allocate read, write, and delete permissions to team members. The organization administrator is fully responsible for all permissions configured and actions executed by invitees.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">4. Acceptable Use Policy</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  You agree not to use the service for any illegal purposes or to load malicious data. You must not attempt to reverse engineer, disrupt, or bypass security features (such as Cloudflare proxies or Appwrite backend security policies). Any unauthorized scripting or denial-of-service attempts will lead to immediate account termination.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">5. Service Fees and Payments</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Some components of LorryGuru may be offered on a subscription or flat-fee basis. You agree to pay all applicable fees associated with your plan. All fees are exclusive of applicable taxes unless stated otherwise.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">6. Limitation of Liability</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  To the maximum extent permitted by applicable law, Lorry Guru Technologies shall not be liable for any indirect, incidental, special, exemplary, or consequential damages, including loss of profits, cargo details, or local database backup files arising out of or in connection with the use of the platform.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">7. Governing Law and Jurisdiction</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts located in Salem, Tamil Nadu, India.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">8. Contact Information</h2>
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white">Lorry Guru Technologies</p>
                  <p>Address: 5/6 Kodakarankady, Avarangampalayam, Sankari, Salem - 637301, Tamil Nadu, India.</p>
                  <p>Email: support@lorryguru.in</p>
                </div>
              </section>
            </article>
          )}

          {activeTab === 'privacy' && (
            <article className="prose dark:prose-invert max-w-none text-left space-y-6">
              <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">Privacy Policy</h1>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Last Updated: June 8, 2026</p>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800" />

              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-350">
                At LorryGuru, we prioritize the privacy and security of our clients&#39; logistical data. This Privacy Policy details how <strong>Lorry Guru Technologies</strong> collects, uses, and safeguards information when you interact with our platform.
              </p>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">1. Information We Collect</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  We collect information necessary to deliver and manage your logistics portals:
                </p>
                <ul className="list-disc pl-5 text-xs space-y-2 text-slate-600 dark:text-slate-400">
                  <li><strong>Account Metadata:</strong> Full Name, Email Address, Mobile Number, and password hashes.</li>
                  <li><strong>Fleet Operations Data:</strong> Trip bookings, expense vouchers, fuel receipts, multi-axle tyre details, and truck/driver master records.</li>
                  <li><strong>Technical Logs:</strong> Audit logging history (created/updated/deleted records), device metadata, IP addresses, and session activities.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">2. How We Use Your Information</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  The information we collect is utilized strictly to:
                </p>
                <ul className="list-disc pl-5 text-xs space-y-2 text-slate-600 dark:text-slate-400">
                  <li>Authenticate and authorize session access.</li>
                  <li>Synch trip data journals to our cloud database.</li>
                  <li>Process automated notifications (such as OTP updates via WhatsApp).</li>
                  <li>Maintain transparency using the internal user Audit Log.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">3. Data Sharing and Third Parties</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  We do not sell, rent, or trade your fleet records or personal information to third parties. We share data only with:
                </p>
                <ul className="list-disc pl-5 text-xs space-y-2 text-slate-600 dark:text-slate-400">
                  <li>Authorized sub-users added to your organization portal.</li>
                  <li>Secure backend hosting provider infrastructure (such as AWS and Appwrite).</li>
                  <li>API communication services strictly for verification OTP delivery.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">4. Data Protection and Encryption</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  We implement robust enterprise security strategies:
                </p>
                <ul className="list-disc pl-5 text-xs space-y-2 text-slate-600 dark:text-slate-400">
                  <li>All communications with our server endpoints are encrypted using SSL/TLS protocols.</li>
                  <li>Local backups are obfuscated using base64 encryption prior to storage inside browser sandboxes.</li>
                  <li>Two-Factor Authentication is supported to prevent unauthorized session hijacks.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">5. Cookies and Local Storage</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  We use cookies and browser local storage to persist authentication states, user preferences (such as light/dark mode), and offline fallback data journals. You can disable cookies in your browser settings, but some features of the console may become unavailable.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">6. Contact Information</h2>
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white">Lorry Guru Technologies</p>
                  <p>Address: 5/6 Kodakarankady, Avarangampalayam, Sankari, Salem - 637301, Tamil Nadu, India.</p>
                  <p>Email: support@lorryguru.in</p>
                </div>
              </section>
            </article>
          )}

          {activeTab === 'refunds' && (
            <article className="prose dark:prose-invert max-w-none text-left space-y-6">
              <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">Refund &amp; Cancellation Policy</h1>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Last Updated: June 8, 2026</p>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800" />

              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-350">
                This Refund and Cancellation Policy outlines the rules regarding the cancellation of subscriptions and refund eligibility for services provided by <strong>Lorry Guru Technologies</strong>.
              </p>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">1. Subscription Cancellation</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  You can cancel your LorryGuru subscription at any time. The cancellation will take effect at the end of the current billing cycle. You will retain access to your organization dashboard and reports until your active billing period concludes.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">2. Refund Eligibility</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Due to the digital and custom-configured nature of our B2B SaaS platform:
                </p>
                <ul className="list-disc pl-5 text-xs space-y-2 text-slate-600 dark:text-slate-400">
                  <li><strong>Subscription Renewals:</strong> Payments made for recurring subscriptions (monthly or annual renewals) are non-refundable once processed.</li>
                  <li><strong>Setup Fees:</strong> Any custom setup, integration, or database configuration fees are non-refundable once configuration work has commenced.</li>
                  <li><strong>Trial Period:</strong> We encourage users to verify our operations tracker console during any trial periods prior to subscribing to premium multi-truck allocations.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">3. Exceptional Refund Cases</h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Refunds may be considered under exceptional circumstances, such as duplicate payment billing errors. In such cases, please submit a billing ticket to support within 7 days of the transaction. Approved refunds will be processed within 5 to 7 working days to the original payment source account.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">4. Contact Information</h2>
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white">Lorry Guru Technologies</p>
                  <p>Address: 5/6 Kodakarankady, Avarangampalayam, Sankari, Salem - 637301, Tamil Nadu, India.</p>
                  <p>Email: support@lorryguru.in</p>
                </div>
              </section>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
