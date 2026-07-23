import { render } from 'solid-js/web';
import App from './App.tsx';
import { Router, Route } from '@solidjs/router';
import './index.css';
import { cryptoService } from './services/cryptoService';

// Bypassed keys that should not be encrypted
const BYPASS_KEYS = [
  'ttt_migration_v1',
  'ttt_pin_verify',
  'ttt_pin_salt',
  'ttt_use_biometrics',
  'ttt_theme',
  'appwrite_last_sync_time',
  'appwrite_database_id',
  'ttt_login_method',
  'ttt_session_active_key'
];

function shouldEncryptKey(key: string): boolean {
  if (typeof key !== 'string') return false;
  if (!key.startsWith('ttt_') && !key.startsWith('fleet_')) return false;
  return !BYPASS_KEYS.includes(key);
}

// Authentication/session recovery can finish before the user enters their
// offline PIN. Keep those writes in memory until a key is available instead
// of silently losing them while the encrypted store is locked.
const pendingEncryptedWrites = new Map<string, string>();

// 1. One-time startup migration: Obfuscate any legacy plain-text JSON keys
try {
  if (!localStorage.getItem('ttt_migration_v1')) {
    const keysToObfuscate: { key: string; obfuscated: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('ttt_') || key.startsWith('fleet_')) && !BYPASS_KEYS.includes(key)) {
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

// 2. Set up transparent local storage encryption wrapper
(function() {
  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;

  Storage.prototype.setItem = function(key: string, value: string) {
    if (shouldEncryptKey(key)) {
      if (cryptoService.hasKey()) {
        try {
          const encrypted = cryptoService.encryptSync(value);
          originalSetItem.call(this, key, encrypted);
        } catch (e) {
          console.error("Transparent setItem encryption failed:", e);
          originalSetItem.call(this, key, value);
        }
      } else {
        pendingEncryptedWrites.set(key, value);
        console.warn(`Queued sensitive key "${key}" until the database is unlocked`);
      }
    } else {
      originalSetItem.call(this, key, value);
    }
  };

  Storage.prototype.getItem = function(key: string) {
    const val = originalGetItem.call(this, key);
    if (!val) return null;
    if (shouldEncryptKey(key)) {
      if (cryptoService.hasKey()) {
        try {
          return cryptoService.decryptSync(val);
        } catch (e) {
          // Fallback to legacy base64 or raw value for compatibility during migrations
          try {
            return decodeURIComponent(escape(atob(val)));
          } catch (b64Err) {
            return val;
          }
        }
      } else {
        // Return null or placeholder if locked
        return null;
      }
    }
    return val;
  };

  window.addEventListener('ttt:storage-unlocked', () => {
    for (const [key, value] of pendingEncryptedWrites) {
      // The active key is now present, so this uses the encryption branch
      // above rather than writing plain text.
      localStorage.setItem(key, value);
    }
    pendingEncryptedWrites.clear();
  });
})();

render(
  () => (
    <Router>
      <Route path="*" component={App} />
    </Router>
  ),
  document.getElementById('root')!,
);
