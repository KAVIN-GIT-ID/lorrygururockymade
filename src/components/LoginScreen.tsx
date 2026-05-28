import React, { useState } from 'react';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import {
  Lock,
  Mail,
  User,
  AlertCircle,
  CheckCircle,
  Loader2,
  Database,
  ArrowRight,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
  checkUserApproval: (email: string) => { approved: boolean; orgId: string; registered: boolean };
  onRegisterUserPermissions: (name: string, email: string, orgId: string, orgName?: string, dryRun?: boolean) => Promise<{ approved: boolean; orgId: string; error?: string }>;
}

export default function LoginScreen({ onLoginSuccess, checkUserApproval, onRegisterUserPermissions }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [regPath, setRegPath] = useState<'JOIN' | 'CREATE'>('CREATE');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showConfigDetails, setShowConfigDetails] = useState(false);

  const configured = isAppwriteConfigured();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter all required fields.');
      return;
    }

    if (!isLogin && !name.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // Appwrite Login
        const user = await appwrite.login(email, password);
        setSuccessMsg('Successfully authenticated! Loading dashboard...');
        setTimeout(() => {
          onLoginSuccess(user);
        }, 1000);
      } else {
        if (regPath === 'JOIN' && !orgName.trim()) {
          setErrorMsg('Please enter the Organization Name you wish to join.');
          setLoading(false);
          return;
        }
        if (regPath === 'CREATE' && !orgName.trim()) {
          setErrorMsg('Please enter an Organization Name to register.');
          setLoading(false);
          return;
        }

        // Dry-run validate the organization name, existence, and email uniqueness before making changes in Appwrite
        const dryRunResult = await onRegisterUserPermissions(
          name,
          email,
          regPath === 'JOIN' ? 'JOIN_REQUEST' : '',
          orgName.trim(),
          true
        );

        if (dryRunResult.error) {
          setErrorMsg(dryRunResult.error);
          setLoading(false);
          return;
        }

        // ── CORRECT REGISTRATION ORDER ──────────────────────────────────────
        // Step 1: Create the Appwrite user account
        await appwrite.register(email, password, name);

        // Step 2: Log them in immediately so subsequent Appwrite API calls
        //         (createTeam, createMembership) run under THIS user's session.
        //         This is critical — createTeam() called while logged in
        //         automatically adds the caller as the team owner (1 member shown).
        const user = await appwrite.login(email, password);

        // Step 3: Now register permissions + create/join team (user is now authenticated)
        const permResult = await onRegisterUserPermissions(
          name,
          email,
          regPath === 'JOIN' ? 'JOIN_REQUEST' : '',
          orgName.trim(),
          false
        );

        if (permResult.error) {
          // Permission/org error — clean up by logging back out
          await appwrite.logout();
          setErrorMsg(permResult.error);
          setLoading(false);
          return;
        }
        // ── END REGISTRATION ORDER ───────────────────────────────────────────

        if (permResult.approved) {
          setSuccessMsg(`Organization "${orgName.trim() || permResult.orgId}" created! Logging you in as Admin...`);
          setTimeout(() => {
            onLoginSuccess(user);
          }, 1000);
        } else {
          // User joined an existing org — must wait for admin approval
          await appwrite.logout();
          setSuccessMsg(`Account registered! Your request has been sent to the Admin of organization ${permResult.orgId}. You'll be able to log in once approved.`);
          setLoading(false);
          setTimeout(() => {
            setIsLogin(true);
            setSuccessMsg(null);
          }, 5000);
        }
      }
    } catch (err: any) {
      console.error('Appwrite Auth Error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials or configurations.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 font-sans select-none overflow-auto p-4">
      {/* Background glowing decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative">

        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/15 mb-2">
            <ShieldCheck className="w-7 h-7 text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">FleetTrack Pro</h2>
          <p className="text-xs text-slate-400">Enterprise Transport & Logistics Fleet Manager</p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-950/60 p-1.5 rounded-xl border border-slate-850">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${isLogin
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${!isLogin
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Create Account
          </button>
        </div>

        {/* Form panel */}
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-1.5">
                <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>
              {/* REGISTRATION PATH SELECTION */}
              <div className="space-y-1.5">
                <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Registration Mode</label>
                <div className="flex bg-slate-950/40 p-1 rounded-lg border border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setRegPath('CREATE');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-1 text-center text-[10px] font-bold rounded transition-all ${regPath === 'CREATE'
                      ? 'bg-slate-850 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-350'
                      }`}
                  >
                    Create New Organization
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRegPath('JOIN');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-1 text-center text-[10px] font-bold rounded transition-all ${regPath === 'JOIN'
                      ? 'bg-slate-850 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-350'
                      }`}
                  >
                    Join Existing Organization
                  </button>
                </div>
              </div>

              {regPath === 'CREATE' ? (
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Organization Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Sakthi Logistics"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      disabled={loading}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-650"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Organization Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Sakthi Logistics"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      disabled={loading}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-650"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                placeholder="admin@fleettrack.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Password</label>
              {isLogin && (
                <span className="text-[10px] text-slate-500">Min 8 chars</span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Feedback banners */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/25 p-3 rounded-xl flex items-start gap-2.5 text-red-400 text-xs leading-relaxed animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-xl flex items-start gap-2.5 text-emerald-400 text-xs leading-relaxed">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/25 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isLogin ? 'Log In to System' : 'Create Admin Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* System parameters indicator */}
        <div className="border-t border-slate-800 pt-4 flex flex-col items-center gap-2">
          <div className="flex items-center justify-between w-full text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5" />
              Appwrite Integration:
            </span>
            <span className={`font-bold ${configured ? 'text-emerald-400' : 'text-amber-500'}`}>
              {configured ? 'Configured' : 'Missing Env Vars'}
            </span>
          </div>

          {/* <button
            type="button"
            onClick={() => setShowConfigDetails(!showConfigDetails)}
            className="text-[9px] text-slate-500 hover:text-slate-350 underline inline-flex items-center gap-1"
          >
            <HelpCircle className="w-3 h-3" />
            {showConfigDetails ? 'Hide backend connection details' : 'Show connection parameters'}
          </button>

          {showConfigDetails && (
            <div className="w-full bg-slate-950/80 p-2.5 rounded-lg border border-slate-850 font-mono text-[9px] text-slate-400 space-y-1 text-left leading-relaxed">
              <div><b>Endpoint:</b> {import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1'}</div>
              <div><b>Project ID:</b> {import.meta.env.VITE_APPWRITE_PROJECT_ID || '(Not Configured)'}</div>
              <div><b>Database:</b> {import.meta.env.VITE_APPWRITE_PROJECT_NAME || 'truck'}</div>
              {!configured && (
                <div className="text-amber-500 border-t border-slate-850 mt-1.5 pt-1.5 leading-relaxed font-sans">
                  <b>Troubleshooting Notice:</b> Create a `.env` file containing these keys inside the project workspace directory to connect your specific backend database.
                </div>
              )}
            </div>
          )} */}
        </div>

      </div>
    </div>
  );
}
