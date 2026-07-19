import { createContext, useContext, createSignal, createEffect, onMount } from 'solid-js';
import { useAuth } from '../context/AuthContext';

interface SettingsContextType {
  theme: () => 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  userVoiceLang: () => string;
  setUserVoiceLang: (lang: string) => void;
  profileVoiceLang: () => string;
  setProfileVoiceLang: (lang: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsManager(props: { children: any }) {
  const { currentUser } = useAuth();
  const [theme, setThemeState] = createSignal<'light' | 'dark'>((localStorage.getItem('ttt_theme') as 'light' | 'dark') || 'light');
  const [userVoiceLang, setUserVoiceLang] = createSignal<string>('en-IN');
  const [profileVoiceLang, setProfileVoiceLang] = createSignal<string>('en-IN');

  const setTheme = (nextTheme: 'light' | 'dark') => {
    setThemeState(nextTheme);
    localStorage.setItem('ttt_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  onMount(() => {
    if (theme() === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  createEffect(() => {
    if (currentUser()) {
      const email = (currentUser().email || '').toLowerCase().trim();
      const storedLang = localStorage.getItem(`ttt_voice_lang_${email}`) || 'en-IN';
      setUserVoiceLang(storedLang);
    } else {
      setUserVoiceLang('en-IN');
    }
  });

  const value: SettingsContextType = {
    theme,
    setTheme,
    userVoiceLang,
    setUserVoiceLang,
    profileVoiceLang,
    setProfileVoiceLang
  };

  return (
    <SettingsContext.Provider value={value}>
      {props.children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsManager');
  }
  return context;
}
