import { Env, ExecutionContext } from './types.js';
import { handleAuth } from './auth.js';
import { handleDatabase } from './database.js';
import { handleStorage } from './storage.js';
import { handlePayment } from './payment.js';

function setCorsHeaders(response: Response, origin: string | null): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', origin || '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  newHeaders.set('Access-Control-Allow-Credentials', 'true');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin');

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // Health check endpoint
      if (pathname === '/health' || pathname === '/api/health') {
        return setCorsHeaders(
          Response.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            service: 'Truck Trip Tracker Cloudflare Worker',
            version: '1.0.0'
          }),
          origin
        );
      }

      // 1. Auth routes
      if (pathname.startsWith('/api/auth/') || pathname === '/send-otp' || pathname === '/verify-user-phone') {
        const authRes = await handleAuth(request, env, pathname);
        return setCorsHeaders(authRes, origin);
      }

      // 2. Database & Sync routes
      if (pathname.startsWith('/api/database/')) {
        const dbRes = await handleDatabase(request, env, pathname);
        return setCorsHeaders(dbRes, origin);
      }

      // 3. Storage routes
      if (pathname.startsWith('/api/storage/')) {
        const storageRes = await handleStorage(request, env, pathname);
        return setCorsHeaders(storageRes, origin);
      }

      // 4. Payment routes
      if (pathname.startsWith('/api/payment/')) {
        const payRes = await handlePayment(request, env, pathname);
        return setCorsHeaders(payRes, origin);
      }

      // If it is an unhandled /api/ route, return 404 JSON
      if (pathname.startsWith('/api/')) {
        return setCorsHeaders(
          Response.json({ error: `API route ${pathname} not found` }, { status: 404 }),
          origin
        );
      }

      // Otherwise, return 404 (Cloudflare Pages / Workers static asset fetch handles non-API assets)
      return new Response('Not Found', { status: 404 });
    } catch (err: any) {
      console.error('Unhandled Worker Error:', err);
      return setCorsHeaders(
        Response.json(
          {
            error: err.message || 'Internal server error',
            stack: err.stack,
          },
          { status: 500 }
        ),
        origin
      );
    }
  },
};
