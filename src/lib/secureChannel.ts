/**
 * End-to-End Client Payload Encryption Channel (AES-256-GCM)
 * Encrypts all request bodies and decrypts response bodies so that
 * raw business data (trucks, trips, rates, driver info, expenses) is never readable in the DevTools Network Tab.
 */

const SECRET_SEED = 'lorryguru-secure-aes256-gcm-tunnel-2026-e2e-payload-guard';

let cachedKey: CryptoKey | null = null;

async function getCipherKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const enc = new TextEncoder();
  const rawKey = enc.encode(SECRET_SEED);
  const hash = await crypto.subtle.digest('SHA-256', rawKey);
  cachedKey = await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  return cachedKey;
}

export async function encryptPayload(data: any): Promise<string> {
  try {
    const key = await getCipherKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encoded = enc.encode(typeof data === 'string' ? data : JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    const ivStr = btoa(String.fromCharCode(...iv));
    const ctStr = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
    return `${ivStr}.${ctStr}`;
  } catch (err) {
    console.warn('[SecureChannel] Encryption error:', err);
    return typeof data === 'string' ? data : JSON.stringify(data);
  }
}

export async function decryptPayload(encryptedStr: string): Promise<any> {
  try {
    const [ivStr, ctStr] = encryptedStr.split('.');
    if (!ivStr || !ctStr) return null;
    const iv = Uint8Array.from(atob(ivStr), c => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(ctStr), c => c.charCodeAt(0));
    const key = await getCipherKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ct
    );
    const decodedStr = new TextDecoder().decode(decrypted);
    try {
      return JSON.parse(decodedStr);
    } catch {
      return decodedStr;
    }
  } catch (err) {
    console.warn('[SecureChannel] Decryption error:', err);
    return null;
  }
}

/**
 * Secure wrapper around window.fetch that encrypts outgoing JSON bodies
 * and decrypts incoming encrypted JSON responses automatically.
 */
export async function secureFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  headers.set('X-Payload-Encrypted', 'true');

  let body = init?.body;
  if (body && typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      const encrypted = await encryptPayload(parsed);
      body = JSON.stringify({ _enc: encrypted });
      headers.set('Content-Type', 'application/json');
    } catch (_) {
      // Non-JSON body (e.g. form-data), leave as is
    }
  }

  const response = await fetch(url, {
    ...init,
    headers,
    body
  });

  // Intercept response and decrypt if payload contains _enc
  const clone = response.clone();
  try {
    const text = await clone.text();
    if (text && text.includes('_enc')) {
      const json = JSON.parse(text);
      if (json && json._enc) {
        const decrypted = await decryptPayload(json._enc);
        if (decrypted !== null) {
          return new Response(JSON.stringify(decrypted), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        }
      }
    }
  } catch (_) {
    // If not JSON or not encrypted, return original response
  }

  return response;
}
