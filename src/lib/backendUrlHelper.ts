/**
 * Helper utility to determine active backend API URL:
 * 1. If running locally (DEV mode) and local node server is running, use relative path '' (Vite proxy / localhost:5000)
 * 2. If local server is stopped or unavailable, fallback to cloud Oracle server: https://dev-api.lorryguru.in
 */
export async function getActiveBackendUrl(): Promise<string> {
  const isLocalHost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === 'local.lorryguru.in' || window.location.hostname === '127.0.0.1');

  if (isLocalHost) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600);
      // Ping local node server port directly to avoid Vite proxy ECONNREFUSED logs
      const res = await fetch('http://127.0.0.1:5000/health', { method: 'GET', signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);
      if (res && res.ok) {
        return ''; // Local Node server is alive and responding!
      }
    } catch (_) {
      // Local server down or un-reachable
    }
  }

  return import.meta.env.VITE_BACKEND_URL || 'https://dev-api.lorryguru.in';
}
