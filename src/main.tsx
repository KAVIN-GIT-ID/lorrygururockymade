import { render } from 'solid-js/web';
import App from './App.tsx';
import { Router, Route } from '@solidjs/router';
import './index.css';

// 1. One-time startup migration: Obfuscate any legacy plain-text JSON keys
try {
  if (!localStorage.getItem('ttt_migration_v1')) {
    const keysToObfuscate: { key: string; obfuscated: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('ttt_') || key.startsWith('fleet_'))) {
        const value = localStorage.getItem(key);
        if (value) {
          const trimmed = value.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              // It's plain-text JSON. Let's obfuscate it!
              const obfuscated = btoa(unescape(encodeURIComponent(value)));
              keysToObfuscate.push({ key, obfuscated });
            } catch (e) {}
          }
        }
      }
    }
    for (const { key, obfuscated } of keysToObfuscate) {
      localStorage.setItem(key, obfuscated);
    }
    localStorage.setItem('ttt_migration_v1', 'done');
  }
} catch (err) {
  console.warn('Failed to pre-obfuscate localStorage:', err);
}

// 2. Set up transparent local storage obfuscation wrapper
(function() {
  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;

  Storage.prototype.setItem = function(key: string, value: string) {
    if (typeof key === 'string' && (key.startsWith('ttt_') || key.startsWith('fleet_'))) {
      try {
        const obfuscated = btoa(unescape(encodeURIComponent(value)));
        originalSetItem.call(this, key, obfuscated);
      } catch (e) {
        originalSetItem.call(this, key, value);
      }
    } else {
      originalSetItem.call(this, key, value);
    }
  };

  Storage.prototype.getItem = function(key: string) {
    const val = originalGetItem.call(this, key);
    if (!val) return null;
    if (typeof key === 'string' && (key.startsWith('ttt_') || key.startsWith('fleet_'))) {
      try {
        return decodeURIComponent(escape(atob(val)));
      } catch (e) {
        return val; // Fallback to raw value for backward compatibility
      }
    }
    return val;
  };
})();

render(
  () => (
    <Router>
      <Route path="*" component={App} />
    </Router>
  ),
  document.getElementById('root')!,
);
