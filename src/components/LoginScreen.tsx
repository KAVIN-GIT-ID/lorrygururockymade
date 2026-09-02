import React, { useState, useEffect, useRef } from 'react';
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
  Phone,
  ArrowLeft,
  X,
  FileText,
  Shield,
  RefreshCw
} from 'lucide-react';

import { verifyTOTP } from '../utils/totp';
import CountryPhoneInput from './CountryPhoneInput';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
  checkUserApproval: (email: string) => { approved: boolean; orgId: string; registered: boolean };
  onRegisterUserPermissions: (name: string, email: string, phone: string, orgId: string, orgName?: string, dryRun?: boolean) => Promise<{ approved: boolean; orgId: string; error?: string }>;
  onBackToHome?: () => void;
}

export default function LoginScreen({ onLoginSuccess, checkUserApproval, onRegisterUserPermissions, onBackToHome }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [regPath, setRegPath] = useState<'JOIN' | 'CREATE'>('CREATE');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [policyModal, setPolicyModal] = useState<'terms' | 'privacy' | 'refund' | null>(null);

  // 2FA state variables
  const [is2FAInterception, setIs2FAInterception] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [pendingTwoFactorSecret, setPendingTwoFactorSecret] = useState('');

  // Google Identity Services (Frontend GIS)
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const GOOGLE_CLIENT_ID = '1081442493959-0dj6evko43gkvmdntjt1bmf2vihb0jd1.apps.googleusercontent.com';

  const handleGoogleCredential = async (response: any) => {
    if (!response?.credential) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/google-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: response.credential,
          orgName: orgName || undefined
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Google login failed');
      }

      setSuccessMsg(`Welcome, ${data.user.name || data.user.email}!`);
      localStorage.setItem('ttt_cf_jwt', data.jwt);
      localStorage.setItem('ttt_cf_user', JSON.stringify(data.user));
      localStorage.setItem('ttt_login_method', 'appwrite');

      onLoginSuccess(data.user);
    } catch (err: any) {
      console.error('[Google GIS Error]:', err);
      setErrorMsg(err.message || 'Failed to authenticate with Google');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initGIS = () => {
      const g = (window as any).google;
      if (!g?.accounts?.id) return;

      try {
        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = '';
          g.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            shape: 'rectangular',
            text: isLogin ? 'signin_with' : 'signup_with',
            logo_alignment: 'left',
            width: 360
          });
        }
      } catch (e) {
        console.warn('GIS init skipped:', e);
      }
    };

    if ((window as any).google?.accounts?.id) {
      initGIS();
    } else {
      const t = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          initGIS();
          clearInterval(t);
        }
      }, 300);
      return () => clearInterval(t);
    }
  }, [isLogin, orgName]);

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!totpCode.trim() || totpCode.trim().length !== 6) {
      setErrorMsg('Please enter a valid 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const verified = await verifyTOTP(pendingTwoFactorSecret, totpCode);
      if (verified) {
        setSuccessMsg('2FA verified successfully! Loading dashboard...');
        setTimeout(() => {
          onLoginSuccess(pendingUser);
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

    let normalizedPhone = phone.trim();
    if (!isLogin) {
      if (!normalizedPhone || normalizedPhone === '+91') {
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
      if (!e164Regex.test(normalizedPhone)) {
        setErrorMsg('Mobile number must be in E.164 format (e.g. +919876543210, starts with + and country code).');
        return;
      }
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (!isLogin && !agreedToTerms) {
      setErrorMsg('You must agree to the Terms & Conditions and Privacy Policy to register.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        let user: any = null;
        if (configured) {
          user = await appwrite.login(email, password);
        } else {
          user = {
            $id: 'mock_user_' + Date.now(),
            name: email.split('@')[0],
            email: email.trim()
          };
        }

        // Check if 2FA is enabled for this user
        let is2FAEnabled = false;
        let twoFactorSecret = '';
        if (configured) {
          try {
            const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
            const docId = appwrite.getEmailDocId(email);
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
          const match = rightsList.find((ur: any) => ur.email.toLowerCase().trim() === email.toLowerCase().trim());
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

        // Dry-run validate the organization name, existence, and email uniqueness
        const dryRunResult = await onRegisterUserPermissions(
          name.trim(),
          email.trim(),
          normalizedPhone,
          regPath === 'JOIN' ? 'JOIN_REQUEST' : '',
          orgName.trim(),
          true
        );

        if (dryRunResult.error) {
          setErrorMsg(dryRunResult.error);
          setLoading(false);
          return;
        }

        // Step 1: Create the user account
        if (configured) {
          await appwrite.register(email, password, name);
        }

        let user: any = null;
        if (configured) {
          user = await appwrite.login(email, password);
          if (normalizedPhone) {
            try {
              await appwrite.updatePhone(normalizedPhone, password);
            } catch (phoneErr: any) {
              console.error('updatePhone failed:', phoneErr);
              throw new Error(`Failed to associate phone number: ${phoneErr.message || phoneErr}`);
            }
          }
        } else {
          user = {
            $id: 'mock_user_' + Date.now(),
            name: name.trim(),
            email: email.trim(),
            phone: normalizedPhone,
            emailVerification: false,
            phoneVerification: false
          };
        }

        // Step 3: Register organization permissions
        const regResult = await onRegisterUserPermissions(
          name.trim(),
          email.trim(),
          normalizedPhone,
          regPath === 'JOIN' ? 'JOIN_REQUEST' : '',
          orgName.trim(),
          false
        );

        if (regResult.error) {
          if (configured) await appwrite.logout();
          setErrorMsg(regResult.error);
          setLoading(false);
          return;
        }

        if (regResult.approved) {
          setSuccessMsg(`Organization "${orgName.trim() || regResult.orgId}" created! Logging you in as Admin...`);
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!forgotEmail.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}?mode=recovery`;
      const res = await appwrite.createRecovery(forgotEmail.trim(), redirectUrl);
      setSuccessMsg(res?.message || 'Recovery link sent! Please check your email inbox and WhatsApp.');
    } catch (err: any) {
      console.error('ForgotPassword Error:', err);
      setErrorMsg(err.message || 'Failed to send recovery email. Please check that the email is correct.');
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
        {/* Back to Home Navigation */}
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            className="absolute top-4 left-4 text-slate-400 hover:text-white flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
        )}

        {/* Brand header */}
        <div className="text-center space-y-2 pt-2">
          <img
            src="/assets/logo-CkJqcrTB.png"
            alt="LorryGuru Logo"
            className="h-12 mx-auto shrink-0 mb-2 object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <h2 className="text-2xl font-bold tracking-tight text-white">LorryGuru</h2>
          <p className="text-xs text-slate-400">Enterprise Transport & Logistics Fleet Manager</p>
        </div>

        {/* Tab Selection */}
        {!is2FAInterception && (
          <div className="flex bg-slate-950/60 p-1.5 rounded-xl border border-slate-850">
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                isLogin ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10' : 'text-slate-400 hover:text-slate-200'
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
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                !isLogin ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Form panel */}
        {is2FAInterception ? (
          <form onSubmit={handle2FAVerify} className="space-y-4">
            <div className="space-y-2 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-500/10 rounded-xl mb-1">
                <Lock className="w-5 h-5 text-blue-500 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-white">2FA Verification</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Enter the 6-digit verification code from Google Authenticator / Microsoft Authenticator app.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Verification Code</label>
              <input
                type="text"
                placeholder="000 000"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-center text-lg font-mono tracking-[0.4em] text-slate-200 focus:outline-none placeholder:text-slate-750"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/20 border border-red-500/25 rounded-lg flex items-start gap-2 text-[11px] text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/25 rounded-lg flex items-start gap-2 text-[11px] text-emerald-400 font-bold">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Log In'}
            </button>

            <button
              type="button"
              onClick={async () => {
                if (configured) {
                  try {
                    await appwrite.logout();
                  } catch (e) {}
                }
                setIs2FAInterception(false);
                setPendingUser(null);
                setPendingTwoFactorSecret('');
                setTotpCode('');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>
          </form>
        ) : isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2 text-center">
              <h3 className="text-sm font-bold text-white">Reset Your Password</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Enter your registered email address and we'll send you a password recovery link.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  placeholder="admin@fleettrack.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={loading}
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

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

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/25 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Send Reset Link</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-slate-400 hover:text-slate-250 text-xs font-bold transition-all focus:outline-none"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Log In</span>
            </button>
          </form>
        ) : (
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

                <div className="space-y-1.5">
                  <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Mobile Number</label>
                  <CountryPhoneInput
                    value={phone}
                    onChange={(val) => setPhone(val)}
                    placeholder="Enter mobile number"
                    disabled={loading}
                    className="w-full bg-slate-950/80 border-slate-800"
                  />
                </div>

                {/* REGISTRATION PATH SELECTION */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Registration Mode</label>
                  <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setRegPath('CREATE');
                        setErrorMsg(null);
                      }}
                      className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all ${
                        regPath === 'CREATE' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
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
                      className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg transition-all ${
                        regPath === 'JOIN' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Join Existing Organization
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider">Organization Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4 text-slate-500" />
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
                </div>
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
                {isLogin && <span className="text-[10px] text-slate-500">Min 8 chars</span>}
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
              {isLogin && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[10px] text-blue-500 hover:text-blue-400 font-bold transition-all focus:outline-none cursor-pointer"
                  >
                    Forgot Password?
                  </button>
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
        <div className="border-t border-slate-800 pt-4 flex flex-col items-center gap-3">
          <div className="flex items-center justify-between w-full text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5" />
              Appwrite Integration:
            </span>
            <span className={`font-bold ${configured ? 'text-emerald-400' : 'text-amber-500'}`}>
              {configured ? 'Configured' : 'Missing Env Vars'}
            </span>
          </div>

          <div className="border-t border-slate-800/60 w-full pt-3 flex items-center justify-center gap-3 text-[10px] text-slate-500 font-semibold">
            <button type="button" onClick={() => setPolicyModal('terms')} className="hover:text-slate-300 transition cursor-pointer">
              Terms & Conditions
            </button>
            <span>•</span>
            <button type="button" onClick={() => setPolicyModal('privacy')} className="hover:text-slate-300 transition cursor-pointer">
              Privacy Policy
            </button>
            <span>•</span>
            <button type="button" onClick={() => setPolicyModal('refund')} className="hover:text-slate-300 transition cursor-pointer">
              Refund Policy
            </button>
          </div>
        </div>
      </div>

      {/* POLICY MODALS */}
      {policyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in text-left">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                {policyModal === 'terms' && <FileText className="w-5 h-5 text-blue-500" />}
                {policyModal === 'privacy' && <Shield className="w-5 h-5 text-emerald-500" />}
                {policyModal === 'refund' && <RefreshCw className="w-5 h-5 text-amber-500" />}
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {policyModal === 'terms' && 'Terms & Conditions'}
                  {policyModal === 'privacy' && 'Privacy Policy'}
                  {policyModal === 'refund' && 'Refund & Cancellation Policy'}
                </h3>
              </div>
              <button
                onClick={() => setPolicyModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              {policyModal === 'terms' && (
                <>
                  <p>Welcome to LorryGuru (lorryguru.in). By accessing our services, you agree to comply with our platform terms.</p>
                  <p><b>1. Account Responsibilities:</b> Users must provide authentic credentials and keep 2FA configurations secure.</p>
                  <p><b>2. Operational Accuracy:</b> All trip vouchers, fuel entries, and axle logs uploaded represent verified commercial freight records.</p>
                  <p><b>3. Service Uptime:</b> We maintain high availability across edge nodes but schedule occasional maintenance windows.</p>
                </>
              )}
              {policyModal === 'privacy' && (
                <>
                  <p>Your privacy and freight data security are our top priorities at LorryGuru.</p>
                  <p><b>1. Data Ownership:</b> All fleet manifests, driver details, and financial logs remain solely the property of your organization.</p>
                  <p><b>2. Encryption:</b> All data in transit and at rest is secured via TLS 1.3 and edge encrypted databases.</p>
                  <p><b>3. Zero Data Sharing:</b> We never sell or share commercial dispatch records with third parties.</p>
                </>
              )}
              {policyModal === 'refund' && (
                <>
                  <p>We strive for complete satisfaction with our logistics platform services.</p>
                  <p><b>1. Subscriptions:</b> Platform access subscriptions can be cancelled at any time from your organization settings.</p>
                  <p><b>2. Refunds:</b> Unused subscription balances within 7 days of billing cycle renewal are eligible for prorated refunds.</p>
                </>
              )}
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
