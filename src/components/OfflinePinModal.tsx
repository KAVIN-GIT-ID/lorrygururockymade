import { createSignal, createEffect, onMount } from 'solid-js';
import { cryptoService } from '../services/cryptoService';
import { setDbUnlocked } from '../services/cache';
import { ShieldCheck, ShieldAlert, KeyRound, Fingerprint } from 'lucide-solid';

interface OfflinePinModalProps {
  mode: 'setup' | 'unlock';
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function OfflinePinModal(props: OfflinePinModalProps) {
  const [pin, setPin] = createSignal('');
  const [confirmPin, setConfirmPin] = createSignal('');
  const [errorMsg, setErrorMsg] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [useBiometrics, setUseBiometrics] = createSignal(false);
  const [biometricsAvailable, setBiometricsAvailable] = createSignal(false);

  onMount(async () => {
    const isB = await cryptoService.checkBiometricsAvailable();
    setBiometricsAvailable(isB);
    
    // Check if biometric option was previously enabled
    const storedBio = localStorage.getItem('ttt_use_biometrics');
    if (storedBio === 'true') {
      setUseBiometrics(true);
      if (props.mode === 'unlock') {
        // Trigger auto biometric prompt
        handleBiometricUnlock();
      }
    }
  });

  const handleBiometricUnlock = async () => {
    setErrorMsg('');
    const verified = await cryptoService.authenticateBiometric();
    if (verified) {
      setLoading(true);
      // Retrieve the securely stored mobile key
      const key = await cryptoService.getOrGenerateMobileKey();
      if (key) {
        cryptoService.setKey(key);
        setDbUnlocked(true);
        props.onSuccess();
      } else {
        setErrorMsg('Failed to retrieve secure key from device storage.');
      }
      setLoading(false);
    } else {
      setErrorMsg('Biometric authentication failed.');
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setErrorMsg('');

    if (pin().length < 4 || pin().length > 6) {
      setErrorMsg('PIN must be between 4 and 6 digits.');
      return;
    }

    setLoading(true);
    try {
      if (props.mode === 'setup') {
        if (pin() !== confirmPin()) {
          setErrorMsg('PINs do not match.');
          setLoading(false);
          return;
        }

        // Set up PIN and save verifier to localStorage
        const { salt, verifier } = await cryptoService.setupPin(pin());
        localStorage.setItem('ttt_pin_salt', salt);
        localStorage.setItem('ttt_pin_verify', verifier);

        // On mobile, also generate and save key in keystore
        if (cryptoService.isMobile()) {
          const mobileKey = await cryptoService.getOrGenerateMobileKey();
          if (mobileKey) {
            cryptoService.setKey(mobileKey);
          }
          if (useBiometrics()) {
            localStorage.setItem('ttt_use_biometrics', 'true');
          }
        }

        setDbUnlocked(true);
        props.onSuccess();
      } else {
        const salt = localStorage.getItem('ttt_pin_salt');
        const verifier = localStorage.getItem('ttt_pin_verify');

        if (!salt || !verifier) {
          setErrorMsg('No PIN setup found. Please log in online first.');
          setLoading(false);
          return;
        }

        console.log("Submitting PIN in unlock mode. Salt:", salt, "Verifier:", verifier);
        const success = await cryptoService.verifyPinAndLoadKey(pin(), salt, verifier);
        console.log("PIN verification result:", success);
        if (success) {
          console.log("PIN verification successful. Unlocking database...");
          setDbUnlocked(true);
          console.log("Calling props.onSuccess()...");
          props.onSuccess();
        } else {
          setErrorMsg('Incorrect PIN. Please try again.');
        }
      }
    } catch (err: any) {
      console.error("Error during PIN unlock handleSubmit:", err);
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      console.log("Finished handleSubmit, setting loading to false.");
      setLoading(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
      <div class="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col items-center">
        <div class="w-12 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mb-4">
          <KeyRound size={24} class="animate-pulse" />
        </div>

        <h3 class="text-lg font-bold text-center mb-1">
          {props.mode === 'setup' ? 'Set Up Offline PIN' : 'Enter Offline PIN'}
        </h3>
        <p class="text-xs text-slate-400 text-center mb-6 leading-relaxed">
          {props.mode === 'setup'
            ? 'Create a secure PIN to encrypt your offline data and enable secure offline login.'
            : 'Enter your PIN to decrypt your local offline data and unlock access.'}
        </p>

        {errorMsg() && (
          <div class="w-full bg-red-950/30 border border-red-500/30 rounded-xl p-3 flex gap-2 mb-4 items-center">
            <ShieldAlert class="text-red-400 shrink-0" size={16} />
            <span class="text-[11px] text-red-200 font-semibold">{errorMsg()}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} class="w-full space-y-4">
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              {props.mode === 'setup' ? 'Enter PIN (4-6 digits)' : 'Enter PIN'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin()}
              onInput={(e) => setPin(e.currentTarget.value.replace(/\D/g, ''))}
              required
              disabled={loading()}
              placeholder="••••"
              class="w-full text-center tracking-widest text-lg font-bold bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-700"
            />
          </div>

          {props.mode === 'setup' && (
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Confirm PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={confirmPin()}
                onInput={(e) => setConfirmPin(e.currentTarget.value.replace(/\D/g, ''))}
                required
                disabled={loading()}
                placeholder="••••"
                class="w-full text-center tracking-widest text-lg font-bold bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-700"
              />
            </div>
          )}

          {props.mode === 'setup' && biometricsAvailable() && (
            <div class="flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-slate-800/40">
              <div class="flex items-center gap-2">
                <Fingerprint class="text-blue-400" size={16} />
                <span class="text-xs font-semibold">Enable Biometric Unlock</span>
              </div>
              <input
                type="checkbox"
                checked={useBiometrics()}
                onChange={(e) => setUseBiometrics(e.currentTarget.checked)}
                class="rounded border-slate-800 text-blue-600 focus:ring-blue-500 bg-slate-950 cursor-pointer"
              />
            </div>
          )}

          <div class="flex gap-3 pt-2">
            {props.onCancel && (
              <button
                type="button"
                onClick={props.onCancel}
                disabled={loading()}
                class="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading()}
              class="flex-1 py-3 bg-blue-600 hover:bg-blue-755 text-white font-bold text-xs rounded-xl transition shadow-lg cursor-pointer disabled:opacity-50"
            >
              {loading() ? 'Verifying...' : props.mode === 'setup' ? 'Set Up PIN' : 'Unlock Data'}
            </button>
          </div>
        </form>

        {props.mode === 'unlock' && biometricsAvailable() && useBiometrics() && (
          <button
            onClick={handleBiometricUnlock}
            disabled={loading()}
            class="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition cursor-pointer"
          >
            <Fingerprint size={16} />
            Unlock with Biometrics
          </button>
        )}
      </div>
    </div>
  );
}
