import { Env, ExecutionContext } from './types.js';
import { handleAuth } from './auth.js';
import { handleDatabase } from './database.js';
import { handleStorage } from './storage.js';
import { handlePayment } from './payment.js';
import { encryptPayload, decryptPayload } from './crypto.js';

function setCorsHeaders(response: Response, origin: string | null): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', origin || '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Payload-Encrypted');
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
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Payload-Encrypted',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const isEncryptedClient = request.headers.get('X-Payload-Encrypted') === 'true';
    let processedRequest = request;

    // Decrypt request payload if incoming body contains _enc
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const cloned = request.clone();
        const text = await cloned.text();
        if (text && text.includes('_enc')) {
          const json = JSON.parse(text);
          if (json && json._enc) {
            const decryptedBody = await decryptPayload(json._enc);
            if (decryptedBody !== null) {
              const headers = new Headers(request.headers);
              headers.set('Content-Type', 'application/json');
              processedRequest = new Request(request.url, {
                method: request.method,
                headers,
                body: JSON.stringify(decryptedBody),
              });
            }
          }
        }
      } catch (_) {}
    }

    const url = new URL(processedRequest.url);
    const pathname = url.pathname;

    try {
      let response: Response;

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
        response = await handleAuth(processedRequest, env, pathname);
      }
      // 2. Database & Sync routes
      else if (pathname.startsWith('/api/database/')) {
        response = await handleDatabase(processedRequest, env, pathname);
      }
      // 3. Storage routes
      else if (pathname.startsWith('/api/storage/')) {
        response = await handleStorage(processedRequest, env, pathname);
      }
      // 4. Payment routes
      else if (pathname.startsWith('/api/payment/')) {
        response = await handlePayment(processedRequest, env, pathname);
      }
      // 5. Unhandled /api/ route
      else if (pathname.startsWith('/api/')) {
        response = Response.json({ error: `API route ${pathname} not found` }, { status: 404 });
      } else {
        return new Response('Not Found', { status: 404 });
      }

      // If client requested payload encryption, encrypt JSON response body
      if (isEncryptedClient && response.headers.get('content-type')?.includes('application/json')) {
        try {
          const respJson = await response.json();
          const encryptedStr = await encryptPayload(respJson);
          response = Response.json({ _enc: encryptedStr }, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        } catch (_) {}
      }

      return setCorsHeaders(response, origin);
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
