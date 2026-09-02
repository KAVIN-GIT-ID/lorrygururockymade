import { createSignal } from 'solid-js';

import { useNavigate } from '@solidjs/router';
import { appwrite, isAppwriteConfigured, getAppOrigin } from '../lib/appwrite';
import {
  Lock,
  Mail,
  User,
  AlertCircle,
  CheckCircle,
  Loader2,
  Database,
  ArrowRight,
  Phone,
  ArrowLeft
} from 'lucide-solid';

import { verifyTOTP } from '../utils/totp';
import logo from '../logo.png';
import CountryCodePhoneInput from './CountryCodePhoneInput';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
  checkUserApproval: (email: string) => { approved: boolean; orgId: string; registered: boolean };
  onRegisterUserPermissions: (name: string, email: string, phone: string, orgId: string, orgName?: string, dryRun?: boolean) => Promise<{ approved: boolean; orgId: string; error?: string }>;
  onBackToHome?: () => void;
}

export default function LoginScreen({ onLoginSuccess, checkUserApproval, onRegisterUserPermissions, onBackToHome }: LoginScreenProps) {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = createSignal(true);
  const [agreed, setAgreed] = createSignal(false);
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [name, setName] = createSignal('');
  const [phone, setPhone] = createSignal('');
  const [isForgotPassword, setIsForgotPassword] = createSignal(false);
  const [forgotEmail, setForgotEmail] = createSignal('');
  const [orgId, setOrgId] = createSignal('');
  const [orgName, setOrgName] = createSignal('');
  const [regPath, setRegPath] = createSignal<'JOIN' | 'CREATE'>('CREATE');
  const [loading, setLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
  const [successMsg, setSuccessMsg] = createSignal<string | null>(null);
  const [showConfigDetails, setShowConfigDetails] = createSignal(false);

  // 2FA state variables
  const [is2FAInterception, setIs2FAInterception] = createSignal(false);
  const [totpCode, setTotpCode] = createSignal('');
  const [pendingUser, setPendingUser] = createSignal<any>(null);
  const [pendingTwoFactorSecret, setPendingTwoFactorSecret] = createSignal('');

  const handle2FAVerify = async (e: Event) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!totpCode().trim() || totpCode().trim().length !== 6) {
      setErrorMsg('Please enter a valid 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const verified = await verifyTOTP(pendingTwoFactorSecret(), totpCode());
      if (verified) {
        setSuccessMsg('2FA verified successfully! Loading dashboard...');
        setTimeout(() => {
          onLoginSuccess(pendingUser());
        }, 1000);
      } else {
        setErrorMsg('Invalid 2FA code. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Verification failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const configured = isAppwriteConfigured();

  const handleAuth = async (e: Event) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email().trim() || !password().trim()) {
      setErrorMsg('Please enter all required fields.');
      return;
    }

    if (!isLogin() && !name().trim()) {
      setErrorMsg('Please enter your name().');
      return;
    }

    if (!isLogin()) {
      if (!phone().trim()) {
        setErrorMsg('Please enter your mobile number.');
        return;
      }

      if (!normalizedPhone.startsWith('+')) {
        const clean = normalizedPhone.replace(/[^0-9]/g, '');
        if (clean.length === 10) {
          normalizedPhone = `+91${clean}`;
        } else if (clean.length === 12 && clean.startsWith('91')) {
          normalizedPhone = `+${clean}`;
        } else if (clean.length > 0) {
          normalizedPhone = `+${clean}`;
        }
      }

      const e164Regex = /^\+[1-9]\d{6,14}$/;
      if (!e164Regex.test(phone().trim())) {
        setErrorMsg('Mobile number must be in E.164 format (e.g. +1234567890, starts with + and country code).');
        return;
      }
    }

    if (password().length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (!isLogin() && !agreed()) {
      setErrorMsg('You must agree to the Terms & Conditions and Privacy Policy to register.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin()) {
        let user: any = null;
        if (configured) {
          user = await appwrite.login(email(), password());
        } else {
          user = {
            $id: 'mock_user_' + Date.now(),
            name: email().split('@')[0],
            email: email().trim()
          };
        }

        // Check if 2FA is enabled for this user
        let is2FAEnabled = false;
        let twoFactorSecret = '';
        if (configured) {
          try {
            const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
            const docId = appwrite.getEmailDocId(email());
            const rights = await appwrite.loadGlobalConfig(databaseId, docId);
            if (rights) {
              is2FAEnabled = !!rights.is2FAEnabled;
              twoFactorSecret = rights.twoFactorSecret || '';
            }
          } catch (err) {
            console.warn('Could not check 2FA status from cloud:', err);
          }
        } else {
          const stored = localStorage.getItem('ttt_user_rights');
          const rightsList = stored ? JSON.parse(stored) : [];
          const match = rightsList.find((ur: any) => ur.email.toLowerCase().trim() === email().toLowerCase().trim());
          if (match) {
            is2FAEnabled = !!match.is2FAEnabled;
            twoFactorSecret = match.twoFactorSecret || '';
          }
        }

        if (is2FAEnabled) {
          setPendingUser(user);
          setPendingTwoFactorSecret(twoFactorSecret);
          setIs2FAInterception(true);
          setLoading(false);
          return;
        }

        setSuccessMsg('Successfully authenticated! Loading dashboard...');
        setTimeout(() => {
          onLoginSuccess(user);
        }, 1000);
      } else {
        if (regPath() === 'JOIN' && !orgName().trim()) {
          setErrorMsg('Please enter the Organization Name you wish to join.');
          setLoading(false);
          return;
        }
        if (regPath() === 'CREATE' && !orgName().trim()) {
          setErrorMsg('Please enter an Organization Name to register.');
          setLoading(false);
          return;
        }

        // Dry-run validate the organization name(), existence, and email() uniqueness before making changes in Appwrite
        const dryRunResult = await onRegisterUserPermissions(
          name().trim(),
          email().trim(),
          phone().trim(),
          regPath() === 'JOIN' ? 'JOIN_REQUEST' : '',
          orgName().trim(),
          true
        );

        if (dryRunResult.error) {
          setErrorMsg(dryRunResult.error);
          setLoading(false);
          return;
        }

        // Step 1: Create the user account
        if (configured) {
          await appwrite.register(email(), password(), name());
        }

        let user: any = null;
        if (configured) {
          user = await appwrite.login(email(), password());

          // Step 2b: Update phone() number under user's session
          if (phone().trim()) {
            try {
              await appwrite.updatePhone(phone().trim(), password());
            } catch (phoneErr: any) {
              console.error('Appwrite updatePhone failed:', phoneErr);
              throw new Error(`Failed to associate phone() number: ${phoneErr.message || phoneErr}`);
            }
          }
        } else {
          user = {
            $id: 'mock_user_' + Date.now(),
            name: name().trim(),
            email: email().trim(),
            phone: phone().trim(),
            emailVerification: false,
            phoneVerification: false
          };
        }

        // Step 3: Now register permissions + create/join team (user is now authenticated)
        const permResult = await onRegisterUserPermissions(
          name().trim(),
          email().trim(),
          phone().trim(),
          regPath() === 'JOIN' ? 'JOIN_REQUEST' : '',
          orgName().trim(),
          false
        );

        if (regResult.error) {
          if (configured) await appwrite.logout();
          setErrorMsg(regResult.error);
          setLoading(false);
          return;
        }

        if (permResult.approved) {
          setSuccessMsg(`Organization "${orgName().trim() || permResult.orgId}" created! Logging you in as Admin...`);
          setTimeout(() => {
            onLoginSuccess(user);
          }, 1000);
        } else {
          if (configured) await appwrite.logout();
          setSuccessMsg(`Account registered! Your request has been sent to the Admin of organization ${regResult.orgId}. You'll be able to log in once approved.`);
          setLoading(false);
          setTimeout(() => {
            setIsLogin(true);
            setSuccessMsg(null);
          }, 5000);
        }
      }
    } catch (err: any) {
      console.error('Auth Error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials or configurations.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: Event) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!forgotEmail().trim()) {
      setErrorMsg('Please enter your email() address.');
      return;
    }

    setLoading(true);
    try {
      if (configured) {
        const recoveryUrl = `${getAppOrigin()}?mode=recovery`;
        await appwrite.createRecovery(forgotEmail().trim(), recoveryUrl);
        setSuccessMsg('Recovery link sent! Please check your email() inbox.');
      } else {
        // Mock offline fallback
        setSuccessMsg('Mock Recovery link sent! (In local mode, simulated link would trigger password() reset).');
      }
    } catch (err: any) {
      console.error('ForgotPassword Error:', err);
      setErrorMsg(err.message || 'Failed to send recovery email(). Please check that the email() is correct.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 font-sans select-none overflow-auto p-4">
      {/* Background glowing decorations */}
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 relative">
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            class="absolute top-4 left-4 text-slate-400 hover:text-white flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
        )}

        {/* Brand header */}
        <div class="text-center space-y-2">
          <img src={logo} alt="LorryGuru Logo" width="48" height="48" class="h-12 w-auto mx-auto shrink-0 mb-2" />
          <h2 class="text-2xl font-bold tracking-tight text-white">LorryGuru</h2>
          <p class="text-xs text-slate-400">Enterprise Transport & Logistics Fleet Manager</p>
        </div>

        {/* Tab Selection */}
        {!is2FAInterception() && (
          <div class="flex bg-slate-950/60 p-1.5 rounded-xl border border-slate-850">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              class={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${isLogin()
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
              class={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${!isLogin()
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Form panel */}
        {is2FAInterception() ? (
          <form onSubmit={handle2FAVerify} class="space-y-4">
            <div class="space-y-2 text-center">
              <div class="inline-flex items-center justify-center w-10 h-10 bg-blue-500/10 rounded-xl mb-1">
                <Lock class="w-5 h-5 text-blue-500 animate-pulse" />
              </div>
              <h3 class="text-sm font-bold text-white">2FA Verification</h3>
              <p class="text-[11px] text-slate-400 leading-relaxed">
                Enter the 6-digit verification code from Google Authenticator / Microsoft Authenticator app.
              </p>
            </div>

            <div class="space-y-1.5">
              <label class="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Verification Code</label>
              <input
                type="text"
                placeholder="000 000"
                maxLength={6}
                value={totpCode()}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                required
                class="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-center text-lg font-mono tracking-[0.4em] text-slate-200 focus:outline-none placeholder:text-slate-750"
              />
            </div>

            {errorMsg() && (
              <div class="p-3 bg-red-950/20 border border-red-500/25 rounded-lg flex items-start gap-2 text-[11px] text-red-400">
                <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg()}</span>
              </div>
            )}

            {successMsg() && (
              <div class="p-3 bg-emerald-950/20 border border-emerald-500/25 rounded-lg flex items-start gap-2 text-[11px] text-emerald-400 font-bold">
                <CheckCircle class="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg()}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading()}
              class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {loading() ? <Loader2 class="w-4 h-4 animate-spin" /> : 'Verify & Log In'}
            </button>

            <button
              type="button"
              onClick={async () => {
                if (configured) {
                  try {
                    await appwrite.logout();
                  } catch (e) { }
                }
                setIs2FAInterception(false);
                setPendingUser(null);
                setPendingTwoFactorSecret('');
                setTotpCode('');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              class="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
            >
              <ArrowLeft class="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>
          </form>
        ) : isForgotPassword() ? (
          <form onSubmit={handleForgotPassword} class="space-y-4">
            <div class="space-y-2 text-center">
              <h3 class="text-sm font-bold text-white">Reset Your Password</h3>
              <p class="text-[11px] text-slate-400 leading-relaxed">
                Enter your registered email() address and we'll send you a password() recovery link.
              </p>
            </div>
            <div class="space-y-1.5">
              <label class="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Email Address</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail class="w-4 h-4" />
                </div>
                <input
                  type="email"
                  placeholder="admin@fleettrack.com"
                  value={forgotEmail()}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={loading()}
                  class="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            {errorMsg() && (
              <div class="bg-red-500/10 border border-red-500/25 p-3 rounded-xl flex items-start gap-2.5 text-red-400 text-xs leading-relaxed animate-shake">
                <AlertCircle class="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg()}</span>
              </div>
            )}

            {successMsg() && (
              <div class="bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-xl flex items-start gap-2.5 text-emerald-400 text-xs leading-relaxed">
                <CheckCircle class="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{successMsg()}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading()}
              class="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/25 transition cursor-pointer disabled:opacity-50"
            >
              {loading() ? (
                <Loader2 class="w-4 h-4 animate-spin" />
              ) : (
                <span>Send Reset Link</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              class="w-full flex items-center justify-center gap-1.5 py-2 text-slate-400 hover:text-slate-250 text-xs font-bold transition-all focus:outline-none"
            >
              <ArrowLeft class="w-3.5 h-3.5" />
              <span>Back to Log In</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} class="space-y-4">
            {!isLogin() && (
              <>
                <div class="space-y-1.5">
                  <label class="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Full Name</label>
                  <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User class="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={name()}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loading()}
                      class="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div class="space-y-1.5">
                  <label class="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Mobile Number</label>
                  <CountryCodePhoneInput
                    value={phone()}
                    onChange={(val) => setPhone(val)}
                    disabled={loading()}
                    class="!bg-slate-950/80 !border-slate-800 !text-slate-200"
                  />
                </div>

                {/* REGISTRATION PATH SELECTION */}
                <div class="space-y-1.5">
                  <label class="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Registration Mode</label>
                  <div class="flex bg-slate-950/40 p-1 rounded-lg border border-slate-850">
                    <button
                      type="button"
                      onClick={() => {
                        setRegPath('CREATE');
                        setErrorMsg(null);
                      }}
                      class={`flex-1 py-1 text-center text-[10px] font-bold rounded transition-all ${regPath() === 'CREATE'
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
                      class={`flex-1 py-1 text-center text-[10px] font-bold rounded transition-all ${regPath() === 'JOIN'
                        ? 'bg-slate-850 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-350'
                        }`}
                    >
                      Join Existing Organization
                    </button>
                  </div>
                </div>

                {regPath() === 'CREATE' ? (
                  <div class="space-y-1.5">
                    <label class="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Organization Name</label>
                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <User class="w-4 h-4 text-slate-500" />
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Sakthi Logistics"
                        value={orgName()}
                        onChange={(e) => setOrgName(e.target.value)}
                        disabled={loading()}
                        class="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-650"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder={regPath === 'CREATE' ? 'e.g. Sakthi Logistics' : 'e.g. Sakthi Logistics'}
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      disabled={loading}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-650"
                    />
                  </div>
                ) : (
                  <div class="space-y-1.5">
                    <label class="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Organization Name</label>
                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <User class="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Sakthi Logistics"
                        value={orgName()}
                        onChange={(e) => setOrgName(e.target.value)}
                        disabled={loading()}
                        class="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-650"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div class="space-y-1.5">
              <label class="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Email Address</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail class="w-4 h-4" />
                </div>
                <input
                  type="email"
                  placeholder="admin@fleettrack.com"
                  value={email()}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading()}
                  class="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <div class="flex justify-between items-center">
                <label class="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Password</label>
                {isLogin() && (
                  <span class="text-[10px] text-slate-500">Min 8 chars</span>
                )}
              </div>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock class="w-4 h-4" />
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password()}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading()}
                  class="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-600"
                />
              </div>
              {isLogin() ? (
                <div class="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    class="text-[10px] text-blue-500 hover:text-blue-400 font-bold transition-all focus:outline-none cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              ) : (
                <div class="flex items-start gap-2 pt-2 select-none">
                  <input
                    type="checkbox"
                    id="agree-checkbox"
                    checked={agreed()}
                    onChange={(e) => setAgreed(e.target.checked)}
                    disabled={loading()}
                    class="mt-0.5 w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer border border-slate-700 bg-slate-950"
                  />
                  <label for="agree-checkbox" class="text-[10px] leading-normal text-slate-400 cursor-pointer">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/terms')}
                      class="text-blue-500 hover:underline inline font-bold"
                    >
                      Terms &amp; Conditions
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/privacy')}
                      class="text-blue-500 hover:underline inline font-bold"
                    >
                      Privacy Policy
                    </button>.
                  </label>
                </div>
              )}
            </div>

            {!isLogin && (
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="terms-checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-3.5 h-3.5 mt-0.5 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="terms-checkbox" className="text-[11px] text-slate-400 leading-tight select-none cursor-pointer">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setPolicyModal('terms')}
                    className="text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
                  >
                    Terms & Conditions
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => setPolicyModal('privacy')}
                    className="text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  .
                </label>
              </div>
            )}

            {/* Feedback banners */}
            {errorMsg() && (
              <div class="bg-red-500/10 border border-red-500/25 p-3 rounded-xl flex items-start gap-2.5 text-red-400 text-xs leading-relaxed animate-shake">
                <AlertCircle class="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg()}</span>
              </div>
            )}

            {successMsg() && (
              <div class="bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-xl flex items-start gap-2.5 text-emerald-400 text-xs leading-relaxed">
                <CheckCircle class="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{successMsg()}</span>
              </div>
            )}

            {/* Action button */}
            <button
              type="submit"
              disabled={loading()}
              class="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/25 transition cursor-pointer disabled:opacity-50"
            >
              {loading() ? (
                <Loader2 class="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{isLogin() ? 'Log In to System' : 'Create Admin Account'}</span>
                  <ArrowRight class="w-4 h-4" />
                </>
              )}
            </button>

            {/* ── Google OAuth divider ── */}
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Google Sign In / Sign Up GIS Container */}
            <div className="w-full flex justify-center min-h-[44px]">
              <div ref={googleBtnRef} className="w-full flex justify-center" />
            </div>
          </form>
        )}

        {/* System parameters indicator */}
        <div class="border-t border-slate-800 pt-4 flex flex-col items-center gap-2">
          <div class="flex items-center justify-between w-full text-[10px] text-slate-500">
            <span class="flex items-center gap-1">
              <Database class="w-3.5 h-3.5" />
              Appwrite Integration:
            </span>
            <span class={`font-bold ${configured ? 'text-emerald-400' : 'text-amber-500'}`}>
              {configured ? 'Configured' : 'Missing Env Vars'}
            </span>
          </div>
        </div>

        <div class="flex justify-center gap-3 text-[10px] text-slate-550 font-bold border-t border-slate-850 pt-3">
          <button type="button" onClick={() => navigate('/terms')} class="hover:text-slate-300 transition-colors cursor-pointer">Terms &amp; Conditions</button>
          <span>•</span>
          <button type="button" onClick={() => navigate('/privacy')} class="hover:text-slate-300 transition-colors cursor-pointer">Privacy Policy</button>
          <span>•</span>
          <button type="button" onClick={() => navigate('/refunds')} class="hover:text-slate-300 transition-colors cursor-pointer">Refund Policy</button>
        </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setPolicyModal(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
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
