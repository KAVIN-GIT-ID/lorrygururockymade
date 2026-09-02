import { describe, it, expect, beforeEach } from 'vitest';
import worker from './index.js';
import { Env, D1Database } from './types.js';

// In-memory mock D1 database for integration testing
class MockD1Database implements D1Database {
  private tables: Record<string, any[]> = {
    global_configs: [],
    users: [],
    sessions: [],
    trucks: [],
    drivers: [],
    offices: [],
    accounts: [],
    trips: [],
    sub_trips: [],
    expenses: [],
    tyres: [],
    support_tickets: [],
    audit_logs: [],
    coupons: [],
    payments: [],
    files: [],
  };

  prepare(query: string) {
    const db = this.tables;
    const makeStatement = (boundParams: any[] = []) => {
      const stmt: any = {
        bind(...params: any[]) {
          return makeStatement(params);
        },
        async first<T = unknown>(): Promise<T | null> {
          const lower = query.toLowerCase();
          if (lower.includes('from users where email =')) {
            const email = boundParams[0];
            const match = db.users.find(u => u.email === email);
            return (match as T) || null;
          }
          if (lower.includes('from users where id =')) {
            const id = boundParams[0];
            const email = boundParams[1] || id;
            const match = db.users.find(u => u.id === id || u.email === email);
            return (match as T) || null;
          }
          if (lower.includes('from global_configs where key =')) {
            const key = boundParams[0];
            const match = db.global_configs.find(c => c.key === key);
            return (match as T) || null;
          }
          if (lower.includes('from trucks where id =')) {
            const id = boundParams[0];
            const match = db.trucks.find(t => t.id === id);
            return (match as T) || null;
          }
          if (lower.includes('from trucks where upper(truckno) =')) {
            const truckNo = boundParams[0];
            const match = db.trucks.find(t => (t.truckNo || '').toUpperCase() === (truckNo || '').toUpperCase());
            return (match as T) || null;
          }
          if (lower.includes('from files where id =')) {
            const id = boundParams[0];
            const match = db.files.find(f => f.id === id);
            return (match as T) || null;
          }
          return null;
        },
        async run() {
          const lower = query.toLowerCase();
          if (lower.includes('insert into users')) {
            db.users.push({
              id: boundParams[0],
              email: boundParams[1],
              password_hash: boundParams[2],
              name: boundParams[3],
              phone: boundParams[4],
              organization_id: boundParams[5],
              role: boundParams[6],
              email_verified: 1,
              phone_verified: 0,
            });
          } else if (lower.includes('insert into global_configs')) {
            const existingIdx = db.global_configs.findIndex(c => c.key === boundParams[0]);
            if (existingIdx !== -1) {
              db.global_configs[existingIdx] = { key: boundParams[0], data: boundParams[1] };
            } else {
              db.global_configs.push({ key: boundParams[0], data: boundParams[1] });
            }
          } else if (lower.includes('insert into trucks')) {
            const existingIdx = db.trucks.findIndex(t => t.id === boundParams[0]);
            const item = { id: boundParams[0], organizationId: boundParams[1], truckNo: boundParams[2], ownerName: boundParams[3], status: boundParams[4], isApproved: boundParams[5] };
            if (existingIdx !== -1) db.trucks[existingIdx] = item;
            else db.trucks.push(item);
          } else if (lower.includes('insert into files')) {
            db.files.push({ id: boundParams[0], organizationId: boundParams[1], name: boundParams[2], mimeType: boundParams[3], size: boundParams[4], data: boundParams[5] });
          } else if (lower.includes('delete from global_configs')) {
            db.global_configs = db.global_configs.filter(c => c.key !== boundParams[0]);
          }
          return { success: true };
        },
        async all() {
          const lower = query.toLowerCase();
          for (const table of Object.keys(db)) {
            if (lower.includes(`from ${table}`)) {
              return { results: db[table], success: true };
            }
          }
          return { results: [], success: true };
        }
      };
      return stmt;
    };
    return makeStatement();
  }

  async batch(statements: any[]) {
    return [];
  }

  async exec(query: string) {
    return { success: true };
  }
}

describe('Cloudflare Worker Backend Integration Tests', () => {
  let env: Env;
  const mockCtx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  };

  beforeEach(() => {
    env = {
      DB: new MockD1Database(),
      JWT_SECRET: 'test-jwt-secret-key-1234567890',
      APP_URL: 'http://localhost:3000',
    };
  });

  it('should respond to /health endpoint', async () => {
    const req = new Request('http://localhost:3000/health', { method: 'GET' });
    const res = await worker.fetch(req, env, mockCtx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('OK');
    expect(data.service).toContain('Cloudflare Worker');
  });

  it('should handle registration, login, and auth/me cycle', async () => {
    // 1. Register
    const regReq = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testdriver@lorryguru.in',
        password: 'Password@123',
        name: 'Test Driver',
        phone: '+919876543210',
      }),
    });
    const regRes = await worker.fetch(regReq, env, mockCtx);
    expect(regRes.status).toBe(200);
    const regData = await regRes.json();
    expect(regData.success).toBe(true);
    expect(regData.jwt).toBeDefined();

    // 2. Login
    const loginReq = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testdriver@lorryguru.in',
        password: 'Password@123',
      }),
    });
    const loginRes = await worker.fetch(loginReq, env, mockCtx);
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    const token = loginData.jwt;

    // 3. Auth Me
    const meReq = new Request('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const meRes = await worker.fetch(meReq, env, mockCtx);
    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.email).toBe('testdriver@lorryguru.in');
    expect(meData.name).toBe('Test Driver');
  });

  it('should handle database save and pull operations', async () => {
    // Register user first
    const regReq = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@fleet.com',
        password: 'AdminPassword123',
        name: 'Fleet Admin',
        role: 'Admin',
      }),
    });
    const regRes = await worker.fetch(regReq, env, mockCtx);
    const { jwt } = await regRes.json();

    // Save truck document
    const saveReq = new Request('http://localhost:3000/api/database/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        collectionId: 'trucks',
        docId: 'tr_101',
        orgId: 'org_test',
        dataObj: {
          id: 'tr_101',
          truckNo: 'TN-52-AB-1234',
          ownerName: 'Transports Ltd',
          status: 'Active',
          isApproved: true,
        },
      }),
    });
    const saveRes = await worker.fetch(saveReq, env, mockCtx);
    expect(saveRes.status).toBe(200);
    const saveData = await saveRes.json();
    expect(saveData.success).toBe(true);

    // Pull collections
    const pullReq = new Request('http://localhost:3000/api/database/pull', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        orgId: 'org_test',
        targetCollections: ['trucks'],
      }),
    });
    const pullRes = await worker.fetch(pullReq, env, mockCtx);
    expect(pullRes.status).toBe(200);
    const pullData = await pullRes.json();
    expect(pullData.success).toBe(true);
    expect(pullData.loadedState.trucks).toBeDefined();
  });

  it('should handle file upload and retrieval in storage engine', async () => {
    const uploadReq = new Request('http://localhost:3000/api/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: 'fil_test_rc_1',
        name: 'rc_book.pdf',
        mimeType: 'application/pdf',
        data: btoa('PDF_MOCK_CONTENT_BYTES'),
      }),
    });
    const uploadRes = await worker.fetch(uploadReq, env, mockCtx);
    expect(uploadRes.status).toBe(200);
    const uploadData = await uploadRes.json();
    expect(uploadData.id).toBe('fil_test_rc_1');

    // Retrieve file
    const fileReq = new Request('http://localhost:3000/api/storage/file/fil_test_rc_1', {
      method: 'GET',
    });
    const fileRes = await worker.fetch(fileReq, env, mockCtx);
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers.get('Content-Type')).toBe('application/pdf');
    const text = await fileRes.text();
    expect(text).toBe('PDF_MOCK_CONTENT_BYTES');
  });

  it('should track courier deterministically', async () => {
    const req = new Request('http://localhost:3000/api/database/track-courier?courier=Delhivery&refNo=H58820654', {
      method: 'GET',
    });
    const res = await worker.fetch(req, env, mockCtx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe('Delivered');
    expect(data.courier).toBe('Delhivery');
  });

  it('should initiate payment and return redirect URL', async () => {
    const req = new Request('http://localhost:3000/api/payment/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        truckNo: 'TN52-P-5608',
        amount: 4000,
        duration: '1 Year',
        customerName: 'Kadhir',
        customerEmail: 'kadhir@lorryguru.in',
        organizationId: 'org_test',
      }),
    });
    const res = await worker.fetch(req, env, mockCtx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.redirectUrl).toBeDefined();
    expect(data.transactionId).toBeDefined();
  });
});
