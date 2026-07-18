import { createContext, useContext, createSignal, createEffect, JSX } from 'solid-js';

interface ThemeContextType {
  theme: () => 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>();

export function ThemeProvider(props: { children: JSX.Element }) {
  const [theme, setThemeState] = createSignal<'light' | 'dark'>((() => {
    const saved = localStorage.getItem('ttt_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  })());

  createEffect(() => {
    const current = theme();
    localStorage.setItem('ttt_theme', current);
    if (current === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  const setTheme = (t: 'light' | 'dark') => setThemeState(t);
  const toggleTheme = () => setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
