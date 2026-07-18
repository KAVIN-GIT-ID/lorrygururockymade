import { createSignal } from 'solid-js';
import { useCountdown } from './useCountdown';

export function useModalWizardState() {
  const emailTimerHook = useCountdown(0);
  const phoneTimerHook = useCountdown(0);
  const mobileWizardTimerHook = useCountdown(0);

  const emailTimer = emailTimerHook.seconds;
  const setEmailTimer = emailTimerHook.start;
  const phoneTimer = phoneTimerHook.seconds;
  const setPhoneTimer = phoneTimerHook.start;
  const mobileWizardTimer = mobileWizardTimerHook.seconds;
  const setMobileWizardTimer = mobileWizardTimerHook.start;

  // Mobile Change Wizard States
  const [mobileWizardOpen, setMobileWizardOpen] = createSignal(false);
  const [mobileWizardStep, setMobileWizardStep] = createSignal(1);
  const [mobileWizardCode, setMobileWizardCode] = createSignal('');
  const [mobileWizardNewPhone, setMobileWizardNewPhone] = createSignal('');
  const [mobileWizardPassword, setMobileWizardPassword] = createSignal('');
  const [mobileWizardError, setMobileWizardError] = createSignal<string | null>(null);
  const [mobileWizardGeneratedOtp, setMobileWizardGeneratedOtp] = createSignal('');

  // 2FA Setup/Disable States
  const [setup2FAOpen, setSetup2FAOpen] = createSignal(false);
  const [setup2FASecret, setSetup2FASecret] = createSignal('');

  const [disable2FAOpen, setDisable2FAOpen] = createSignal(false);

  const [resetPasswordState, setResetPasswordState] = createSignal<{
    active: boolean;
    userId: string;
    secret: string;
  } | null>(null);

  return {
    emailTimer,
    setEmailTimer,
    phoneTimer,
    setPhoneTimer,
    mobileWizardTimer,
    setMobileWizardTimer,
    mobileWizardOpen,
    setMobileWizardOpen,
    mobileWizardStep,
    setMobileWizardStep,
    mobileWizardCode,
    setMobileWizardCode,
    mobileWizardNewPhone,
    setMobileWizardNewPhone,
    mobileWizardPassword,
    setMobileWizardPassword,
    mobileWizardError,
    setMobileWizardError,
    mobileWizardGeneratedOtp,
    setMobileWizardGeneratedOtp,
    setup2FAOpen,
    setSetup2FAOpen,
    setup2FASecret,
    setSetup2FASecret,
    disable2FAOpen,
    setDisable2FAOpen,
    resetPasswordState,
    setResetPasswordState
  };
}
