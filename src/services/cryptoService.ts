// Pure JS synchronous SHA-256 and CTR-mode stream cipher for synchronous localStorage encryption
function sha256(ascii: string | Uint8Array): Uint32Array {
  const words = typeof ascii === 'string' ? new TextEncoder().encode(ascii) : ascii;
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const l = words.length;
  const blocks = new Uint8Array(l + 68 - ((l + 4) % 64));
  blocks.set(words);
  blocks[l] = 128;
  const view = new DataView(blocks.buffer);
  view.setUint32(blocks.length - 4, l * 8);

  const w = new Uint32Array(64);
  for (let i = 0; i < blocks.length; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = (w[j - 15] >>> 7 | w[j - 15] << 25) ^ (w[j - 15] >>> 18 | w[j - 15] << 14) ^ (w[j - 15] >>> 3);
      const s1 = (w[j - 2] >>> 17 | w[j - 2] << 15) ^ (w[j - 2] >>> 19 | w[j - 2] << 13) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let j = 0; j < 64; j++) {
      const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  return hash;
}

// Convert a Uint32Array to Uint8Array
function wordsToBytes(words: Uint32Array): Uint8Array {
  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < words.length; i++) {
    view.setUint32(i * 4, words[i]);
  }
  return bytes;
}

/**
 * Web Crypto requests should normally finish in well under a second.  Some
 * embedded or partially-initialised browser contexts can leave a request
 * pending indefinitely, however.  Never let that permanently disable the PIN
 * form: surface a recoverable error instead.
 */
async function withCryptoTimeout<T>(operation: Promise<T>, operationName: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${operationName} timed out. Please try again.`));
    }, 10_000);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

/**
 * Run PBKDF2 outside the UI thread. On some desktop Chromium builds a Web
 * Crypto PBKDF2 request can block the main thread, which also prevents a UI
 * timeout from firing and leaves the PIN button on "Verifying…" forever.
 */
function derivePinKeyInWorker(pin: string, saltHex: string): Promise<Uint8Array> {
  const workerSource = `
    self.onmessage = async ({ data }) => {
      try {
        const hexToBytes = (hex) => {
          const bytes = new Uint8Array(hex.length / 2);
          for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
          return bytes;
        };
        const baseKey = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(data.pin), 'PBKDF2', false, ['deriveBits']
        );
        const bits = await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: hexToBytes(data.salt), iterations: 100000, hash: 'SHA-256' },
          baseKey,
          256
        );
        self.postMessage({ bits }, [bits]);
      } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : String(error) });
      }
    };
  `;

  const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  const worker = new Worker(workerUrl);

  return new Promise<Uint8Array>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(new Error('PIN verification timed out. Please try again.'));
    }, 10_000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };

    worker.onmessage = (event: MessageEvent<{ bits?: ArrayBuffer; error?: string }>) => {
      cleanup();
      if (event.data.error) {
        reject(new Error(`PIN verification failed: ${event.data.error}`));
        return;
      }
      if (!event.data.bits) {
        reject(new Error('PIN verification failed: no key was returned.'));
        return;
      }
      resolve(new Uint8Array(event.data.bits));
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('PIN verification worker could not start.'));
    };
    worker.postMessage({ pin, salt: saltHex });
  });
}

// Synchronously encrypt/decrypt using a SHA256-CTR mode cipher
export function encryptDecryptSync(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  const block = new Uint8Array(key.length + iv.length + 4);
  block.set(key, 0);
  block.set(iv, key.length);
  const view = new DataView(block.buffer);
  
  let blockIndex = 0;
  let keystream: any = new Uint8Array(0);
  let keystreamOffset = 0;

  for (let i = 0; i < data.length; i++) {
    if (keystreamOffset >= keystream.length) {
      view.setUint32(key.length + iv.length, blockIndex++, false);
      const hashed = sha256(block);
      keystream = wordsToBytes(hashed);
      keystreamOffset = 0;
    }
    out[i] = data[i] ^ keystream[keystreamOffset++];
  }
  return out;
}

// Helper to convert hex to Uint8Array and vice-versa
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

import { createSignal } from 'solid-js';

// Fetch current public IP address with standard Promise.race timeout for maximum compatibility
export async function fetchPublicIP(): Promise<string> {
  try {
    const fetchPromise = fetch('https://api.ipify.org?format=json').then(r => r.json());
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
    const data = await Promise.race([fetchPromise, timeoutPromise]);
    const ip = (data as any).ip || 'offline';
    console.log(`[fetchPublicIP] Successfully fetched IP: ${ip}`);
    return ip;
  } catch (err) {
    console.warn('[fetchPublicIP] Failed to fetch IP, falling back to offline mode:', err);
    return 'offline';
  }
}

// Simple XOR encryption/decryption using hashed IP as key
function cryptWithIP(keyBytes: Uint8Array, ip: string): Uint8Array {
  const ipHashWords = sha256(ip);
  const ipHashBytes = wordsToBytes(ipHashWords);
  const result = new Uint8Array(keyBytes.length);
  for (let i = 0; i < keyBytes.length; i++) {
    result[i] = keyBytes[i] ^ ipHashBytes[i % ipHashBytes.length];
  }
  return result;
}

// Global in-memory active key.
let activeKey: Uint8Array | null = null;
const [hasActiveKey, setHasActiveKey] = createSignal(false);

export const cryptoService = {
  setKey(key: Uint8Array) {
    activeKey = key;
    setHasActiveKey(true);
    console.log('[cryptoService] Key set successfully in memory.');
    // Let the storage wrapper persist any writes that were deferred while the
    // PIN screen was locked. The event contains no key material.
    window.dispatchEvent(new Event('ttt:storage-unlocked'));
  },

  async setKeyWithIPCache(key: Uint8Array) {
    this.setKey(key);
    try {
      const ip = await fetchPublicIP();
      const encryptedBytes = cryptWithIP(key, ip);
      sessionStorage.setItem('ttt_session_active_key', bytesToHex(encryptedBytes));
      console.log(`[cryptoService] Successfully cached key in sessionStorage bound to IP: ${ip}`);
    } catch (e) {
      console.warn('[cryptoService] Failed to cache key in sessionStorage:', e);
    }
  },

  async tryAutoUnlock(): Promise<boolean> {
    try {
      const cached = sessionStorage.getItem('ttt_session_active_key');
      if (!cached) {
        console.log('[cryptoService] No cached key found in sessionStorage.');
        return false;
      }
      console.log('[cryptoService] Found cached key. Fetching current IP...');
      const ip = await fetchPublicIP();
      const encryptedBytes = hexToBytes(cached);
      const decryptedKey = cryptWithIP(encryptedBytes, ip);
      this.setKey(decryptedKey);
      console.log(`[cryptoService] Auto-unlock succeeded with IP: ${ip}`);
      return true;
    } catch (e) {
      console.warn('[cryptoService] Auto-unlock failed:', e);
      return false;
    }
  },

  getKey(): Uint8Array | null {
    return activeKey;
  },

  hasKey(): boolean {
    return hasActiveKey();
  },

  clearKey() {
    activeKey = null;
    setHasActiveKey(false);
    try {
      sessionStorage.removeItem('ttt_session_active_key');
    } catch (e) {}
  },

  // Derive a key from a PIN using standard PBKDF2 (asynchronous, secure)
  async deriveKeyFromPin(pin: string, saltHex: string): Promise<Uint8Array> {
    if (typeof Worker !== 'undefined') {
      return derivePinKeyInWorker(pin, saltHex);
    }

    const encoder = new TextEncoder();
    const pinData = encoder.encode(pin);
    const saltData = hexToBytes(saltHex);

    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      pinData,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Deriving raw bits avoids the additional CryptoKey creation/export step.
    // It produces the same 256-bit key material used by local encryption.
    const derivedBits = await withCryptoTimeout(
      window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltData as any,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      256
      ),
      'PIN verification'
    );
    return new Uint8Array(derivedBits);
  },

  // Synchronous Encrypt helper for storage
  encryptSync(plaintext: string): string {
    if (!activeKey) {
      throw new Error("No active encryption key loaded");
    }
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const dataBytes = new TextEncoder().encode(plaintext);
    const cipherBytes = encryptDecryptSync(dataBytes, activeKey, iv);
    
    // Format: hex(iv) + ":" + hex(ciphertext)
    return bytesToHex(iv) + ":" + bytesToHex(cipherBytes);
  },

  // Synchronous Decrypt helper for storage
  decryptSync(ciphertextWithIv: string): string {
    if (!activeKey) {
      throw new Error("No active encryption key loaded");
    }
    const parts = ciphertextWithIv.split(':');
    if (parts.length !== 2) {
      throw new Error("Invalid cipher format");
    }
    const iv = hexToBytes(parts[0]);
    const ciphertext = hexToBytes(parts[1]);
    const plainBytes = encryptDecryptSync(ciphertext, activeKey, iv);
    return new TextDecoder().decode(plainBytes);
  },

  // Set up PIN verification data
  async setupPin(pin: string): Promise<{ salt: string; verifier: string }> {
    const salt = bytesToHex(window.crypto.getRandomValues(new Uint8Array(16)));
    const key = await this.deriveKeyFromPin(pin, salt);
    
    // Create a verifier string encrypted with the key
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode("VERIFIED_PIN");
    const cipherBytes = encryptDecryptSync(plaintext, key, iv);
    const verifier = bytesToHex(iv) + ":" + bytesToHex(cipherBytes);

    await this.setKeyWithIPCache(key);
    return { salt, verifier };
  },

  // Verify PIN correctness and load key
  async verifyPinAndLoadKey(pin: string, salt: string, verifier: string): Promise<boolean> {
    try {
      const key = await this.deriveKeyFromPin(pin, salt);
      const parts = verifier.split(':');
      if (parts.length !== 2) return false;
      const iv = hexToBytes(parts[0]);
      const ciphertext = hexToBytes(parts[1]);
      const plainBytes = encryptDecryptSync(ciphertext, key, iv);
      const dec = new TextDecoder().decode(plainBytes);
      if (dec === "VERIFIED_PIN") {
        await this.setKeyWithIPCache(key);
        return true;
      }
    } catch (e) {
      console.error("PIN verification error", e);
    }
    return false;
  },

  // Check if secure storage is available (Capacitor)
  isMobile(): boolean {
    const target = (window as any).Capacitor;
    return !!target;
  },

  // Get/Set Mobile encryption key securely
  async getOrGenerateMobileKey(): Promise<Uint8Array | null> {
    if (!this.isMobile()) return null;
    try {
      // We will look for/save a 32-byte key in Capacitor Preferences/Storage
      // Or in Capacitor Secure Storage if installed, otherwise fallback.
      // Let's implement it robustly.
      const Cap = (window as any).Capacitor;
      
      // Let's use Capacitor Preferences/SecureStorage. Since we want standard secure storage:
      let rawKeyHex: string | null = null;
      if (Cap.Plugins.SecureStoragePlugin) {
        try {
          const res = await Cap.Plugins.SecureStoragePlugin.get({ key: 'ttt_database_encryption_key' });
          rawKeyHex = res.value;
        } catch (e) {
          // Key doesn't exist yet
        }
        if (!rawKeyHex) {
          const keyBytes = window.crypto.getRandomValues(new Uint8Array(32));
          rawKeyHex = bytesToHex(keyBytes);
          await Cap.Plugins.SecureStoragePlugin.set({ key: 'ttt_database_encryption_key', value: rawKeyHex });
        }
      } else {
        // Fallback to Capacitor Preferences (standard local storage key-value but on native side)
        // If Preferences/Storage is available
        const storagePlugin = Cap.Plugins.Preferences || Cap.Plugins.Storage;
        if (storagePlugin) {
          const res = await storagePlugin.get({ key: 'ttt_database_encryption_key' });
          rawKeyHex = res.value;
          if (!rawKeyHex) {
            const keyBytes = window.crypto.getRandomValues(new Uint8Array(32));
            rawKeyHex = bytesToHex(keyBytes);
            await storagePlugin.set({ key: 'ttt_database_encryption_key', value: rawKeyHex });
          }
        }
      }
      if (rawKeyHex) {
        return hexToBytes(rawKeyHex);
      }
    } catch (e) {
      console.error("Failed to manage mobile secure key storage:", e);
    }
    return null;
  },

  // Mock / real device biometric unlock support
  async checkBiometricsAvailable(): Promise<boolean> {
    if (this.isMobile()) {
      try {
        const Cap = (window as any).Capacitor;
        // Native Biometric or BiometricAuth
        const plugin = Cap.Plugins.BiometricAuth || Cap.Plugins.FingerprintAIO;
        if (plugin) {
          if (Cap.Plugins.BiometricAuth) {
            const result = await Cap.Plugins.BiometricAuth.isAvailable();
            return result.has;
          } else if (Cap.Plugins.FingerprintAIO) {
            const result = await Cap.Plugins.FingerprintAIO.isAvailable();
            return !!result;
          }
        }
      } catch (e) {
        console.warn("Biometric detection failed", e);
      }
    }
    return false;
  },

  async authenticateBiometric(): Promise<boolean> {
    if (this.isMobile()) {
      try {
        const Cap = (window as any).Capacitor;
        if (Cap.Plugins.BiometricAuth) {
          const result = await Cap.Plugins.BiometricAuth.verify({
            reason: "Unlock your offline database",
            title: "Biometric Unlock"
          });
          return result.verified;
        } else if (Cap.Plugins.FingerprintAIO) {
          try {
            await Cap.Plugins.FingerprintAIO.show({
              clientId: "Truck-Trip-Tracker",
              clientSecret: "secure_client_secret",
              disableBackup: true,
              localizedFallbackTitle: "Use PIN",
              localizedReason: "Unlock your offline database"
            });
            return true;
          } catch (e) {
            return false;
          }
        }
      } catch (e) {
        console.error("Biometric authentication failed", e);
      }
    }
    return false;
  }
};
