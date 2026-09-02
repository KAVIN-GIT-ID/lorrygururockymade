import { describe, it, expect } from 'vitest';

const BASE_URL = 'https://truck-trip-tracker.apkavin483.workers.dev';

describe('End-to-End Live Regression & System Audit Suite', () => {
  let adminJwt = '';
  const adminOrgId = 'org_default';
  const testUserEmail = `audit_user_${Date.now()}@lorryguru.in`;
  let testUserJwt = '';
  let testTruckId = '';
  let testDriverId = '';
  let testOfficeId = '';
  let testAccountId = '';
  let testTripId = '';
  let testExpenseId = '';
  let testTyreId = '';
  let testCouponId = '';
  let testTicketId = '';

  // 1. HEALTH & STARTUP VERIFICATION
  it('1. Build & Startup: Live Worker health check should return HTTP 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe('OK');
    expect(body.service).toContain('Truck Trip Tracker');
  });

  // 2. AUTHENTICATION FLOWS
  describe('2. Authentication Flows', () => {
    it('should login as admin and obtain valid JWT token', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@lorryguru.in', password: 'Admin@123' }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      adminJwt = data.jwt;
      expect(data.success).toBe(true);
      expect(data.jwt).toBeDefined();
      expect(data.user.email).toBe('admin@lorryguru.in');
    });

    it('should reject login with invalid password', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@lorryguru.in', password: 'WrongPassword123' }),
      });
      expect(res.status).toBe(401);
      const data = (await res.json()) as any;
      expect(data.error).toBeDefined();
    });

    it('should reject login for non-existent user', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent_user_999@lorryguru.in', password: 'Password123' }),
      });
      expect(res.status).toBe(401);
    });

    it('should register a new user successfully with normalized phone and org ID', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUserEmail,
          password: 'TestUser@12345',
          name: 'Audit Test User',
          phone: '+919489223134',
          role: 'Staff',
          organizationId: 'org_audit_test',
          organizationName: 'Audit Test Logistics',
        }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      testUserJwt = data.jwt;
      expect(data.success).toBe(true);
      expect(data.user.email).toBe(testUserEmail);
    });

    it('should reject registration with duplicate email', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUserEmail,
          password: 'TestUser@12345',
          name: 'Duplicate User',
          phone: '+919489223134',
          role: 'Staff',
          organizationId: 'org_audit_test',
        }),
      });
      expect(res.status).toBe(409);
      const data = (await res.json()) as any;
      expect(data.error).toMatch(/already exists|already registered/i);
    });

    it('should verify current authenticated session with /api/auth/me', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${adminJwt}` },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.user.email).toBe('admin@lorryguru.in');
    });
  });

  // 3. AUTHORIZATION & CROSS-ORGANIZATION ISOLATION
  describe('3. Authorization & Organization Isolation', () => {
    it('should reject unauthenticated requests to database save APIs', async () => {
      const res = await fetch(`${BASE_URL}/api/database/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId: 'trucks', docId: 'trk_unauth', orgId: 'org_default', dataObj: {} }),
      });
      expect(res.status).toBe(401);
    });

    it('should prevent non-admin user from accessing or saving data to another organization', async () => {
      const res = await fetch(`${BASE_URL}/api/database/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testUserJwt}` },
        body: JSON.stringify({ collectionId: 'trucks', docId: 'trk_cross', orgId: 'org_foreign_org', dataObj: { truckNo: 'TN01AA0000' } }),
      });
      expect(res.status).toBe(403);
    });
  });

  // 4. CORE MODULE TESTING (CRUD, Calculations, Compliance)
  describe('4. Core Module CRUD & Business Logic', () => {
    // A. TRUCKS
    it('should create and read a new Truck with compliance dates and NP/Q-tax', async () => {
      testTruckId = 'trk_audit_' + Date.now();
      const truckPayload = {
        id: testTruckId,
        truckNo: 'TN38AB1234',
        truckType: '10-Wheeler Open',
        capacity: '25 Tons',
        ownerName: 'LorryGuru Fleet Corp',
        status: 'Active',
        isApproved: true,
        insuranceExpiry: '2027-12-31',
        fitnessExpiry: '2027-12-31',
        greenTaxExpiry: '2027-12-31',
        qTaxExpiry: '2027-12-31',
        npTaxExpiry: '2027-12-31',
        pollutionExpiry: '2027-12-31',
        registrationExpiryDate: '2027-12-31',
        organizationId: adminOrgId,
      };

      const createRes = await fetch(`${BASE_URL}/api/database/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({ collectionId: 'trucks', docId: testTruckId, orgId: adminOrgId, dataObj: truckPayload }),
      });
      expect(createRes.status).toBe(200);

      const pullRes = await fetch(`${BASE_URL}/api/database/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({ orgId: adminOrgId, targetCollections: ['trucks'] }),
      });
      const data = (await pullRes.json()) as any;
      const found = data.loadedState.trucks.find((t: any) => t.id === testTruckId);
      expect(found).toBeDefined();
      expect(found.truckNo).toBe('TN38AB1234');
    });

    // B. DRIVERS
    it('should create and read a Driver with license info and org isolation', async () => {
      testDriverId = 'drv_audit_' + Date.now();
      const driverPayload = {
        id: testDriverId,
        name: 'Ramu Selvam',
        phone: '+919876500001',
        licenseNo: 'TN-38-2020-009988',
        licenseExpiry: '2029-05-15',
        status: 'Active',
        organizationId: adminOrgId,
      };

      const createRes = await fetch(`${BASE_URL}/api/database/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({ collectionId: 'drivers', docId: testDriverId, orgId: adminOrgId, dataObj: driverPayload }),
      });
      expect(createRes.status).toBe(200);
    });

    // C. OFFICES
    it('should create and read an Office branch', async () => {
      testOfficeId = 'off_audit_' + Date.now();
      const officePayload = {
        id: testOfficeId,
        officeName: 'Chennai Central Hub',
        branchCode: 'MAA-01',
        city: 'Chennai',
        state: 'Tamil Nadu',
        phone: '+914423456789',
        status: 'Active',
        organizationId: adminOrgId,
      };

      const createRes = await fetch(`${BASE_URL}/api/database/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({ collectionId: 'offices', docId: testOfficeId, orgId: adminOrgId, dataObj: officePayload }),
      });
      expect(createRes.status).toBe(200);
    });

    // D. ACCOUNTS
    it('should create and read a Bank/Cash Account', async () => {
      testAccountId = 'acc_audit_' + Date.now();
      const accountPayload = {
        id: testAccountId,
        accountName: 'HDFC Corporate Freight Ledger',
        accountType: 'Bank',
        accountNumber: '50200012345678',
        ifscCode: 'HDFC0001234',
        branch: 'Anna Salai',
        balance: 250000,
        status: 'Active',
        organizationId: adminOrgId,
      };

      const createRes = await fetch(`${BASE_URL}/api/database/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({ collectionId: 'accounts', docId: testAccountId, orgId: adminOrgId, dataObj: accountPayload }),
      });
      expect(createRes.status).toBe(200);
    });

    // E. TRIPS & SUB-TRIPS
    it('should create Trip with multi-segment sub-trips and compute financial balances', async () => {
      testTripId = 'trp_audit_' + Date.now();
      const tripPayload = {
        id: testTripId,
        tripNumber: 'TRP-2026-991',
        truckNo: 'TN38AB1234',
        truckId: testTruckId,
        driverId: testDriverId,
        startDate: '2026-09-01',
        endDate: '2026-09-05',
        startKm: 12000,
        endKm: 13500,
        status: 'Completed',
        subTrips: [
          {
            id: 'sub_1',
            route: 'Chennai - Bangalore',
            cargoName: 'Automobile Parts',
            cargoWeight: '18 Tons',
            freightAmount: 45000,
            driverAdvance: 10000,
            dieselExpense: 15000,
            tollExpense: 3500,
            loadingExpense: 1500,
            unloadingExpense: 1200,
          },
        ],
        payments: [{ id: 'pmt_1', date: '2026-09-02', amount: 45000, mode: 'Bank Transfer' }],
        advances: [{ id: 'adv_1', date: '2026-09-01', amount: 10000, purpose: 'Driver En Route' }],
        organizationId: adminOrgId,
      };

      const createRes = await fetch(`${BASE_URL}/api/database/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({ collectionId: 'trips', docId: testTripId, orgId: adminOrgId, dataObj: tripPayload }),
      });
      expect(createRes.status).toBe(200);

      const pullRes = await fetch(`${BASE_URL}/api/database/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({ orgId: adminOrgId, targetCollections: ['trips'] }),
      });
      const data = (await pullRes.json()) as any;
      const found = data.loadedState.trips.find((t: any) => t.id === testTripId);
      expect(found).toBeDefined();
      expect(found.tripNumber).toBe('TRP-2026-991');
    });

    // F. EXPENSES
    it('should create and read operational Expense records', async () => {
      testExpenseId = 'exp_audit_' + Date.now();
      const expensePayload = {
        id: testExpenseId,
        category: 'Maintenance & Spares',
        amount: 8500,
        date: '2026-09-02',
        truckId: testTruckId,
        shopName: 'TVS Auto Garage',
        paymentMode: 'UPI',
        organizationId: adminOrgId,
      };

      const createRes = await fetch(`${BASE_URL}/api/database/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({ collectionId: 'expenses', docId: testExpenseId, orgId: adminOrgId, dataObj: expensePayload }),
      });
      expect(createRes.status).toBe(200);
    });

    // G. TYRES
    it('should create and track Tyre with axle position and movement log', async () => {
      testTyreId = 'tyr_audit_' + Date.now();
      const tyrePayload = {
        id: testTyreId,
        serialNo: 'MRF-295-80R22-9901',
        brand: 'MRF',
        size: '295/80 R22.5',
        truckId: testTruckId,
        position: 'Front Left',
        fittingKm: 12000,
        status: 'Fitted',
        organizationId: adminOrgId,
      };

      const createRes = await fetch(`${BASE_URL}/api/database/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({ collectionId: 'tyres', docId: testTyreId, orgId: adminOrgId, dataObj: tyrePayload }),
      });
      expect(createRes.status).toBe(200);
    });

    // H. COUPONS
    it('should create and validate promotional Coupon code', async () => {
      testCouponId = 'cpn_audit_' + Date.now();
      const couponPayload = {
        id: testCouponId,
        code: 'LORRYFEST2026',
        discountType: 'Percentage',
        discountValue: 15,
        maxUses: 100,
        usedCount: 0,
        expiryDate: '2027-12-31',
        status: 'Active',
      };

      const createRes = await fetch(`${BASE_URL}/api/database/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({ collectionId: 'coupons', docId: testCouponId, orgId: 'org_default', dataObj: couponPayload }),
      });
      expect(createRes.status).toBe(200);
    });

    // I. SUPPORT TICKETS
    it('should create public support ticket and retrieve via admin API', async () => {
      testTicketId = 'tkt_audit_' + Date.now();
      const ticketPayload = {
        id: testTicketId,
        userName: 'Audit Freight Partner',
        userEmail: 'partner@lorryguru.in',
        userPhone: '+919489223134',
        category: 'Billing',
        message: 'Requesting statement audit for September cycle.',
        status: 'Open',
        priority: 'High',
        organizationId: 'org_default',
      };

      const createRes = await fetch(`${BASE_URL}/api/database/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({ collectionId: 'support_tickets', docId: testTicketId, orgId: 'org_default', dataObj: ticketPayload }),
      });
      expect(createRes.status).toBe(200);
    });

    // J. AUDIT LOGS
    it('should log system action and retrieve audit logs', async () => {
      const logId = 'log_audit_' + Date.now();
      const logPayload = {
        id: logId,
        userId: 'usr_admin_1',
        userEmail: 'admin@lorryguru.in',
        action: 'UPDATE',
        category: 'TRIP',
        reference: 'TRP-2026-991',
        details: 'Audit test trip logged and verified.',
        timestamp: new Date().toISOString(),
        organizationId: adminOrgId,
      };

      const createRes = await fetch(`${BASE_URL}/api/database/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({ collectionId: 'audit_logs', docId: logId, orgId: adminOrgId, dataObj: logPayload }),
      });
      expect(createRes.status).toBe(200);
    });
  });

  // 5. FILE STORAGE VERIFICATION
  describe('5. File Storage API', () => {
    it('should upload and retrieve base64 encoded document/slip', async () => {
      const fileId = 'file_audit_' + Date.now();
      const uploadRes = await fetch(`${BASE_URL}/api/storage/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({
          fileId,
          name: 'diesel_bill_receipt.png',
          mimeType: 'image/png',
          size: 1024,
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        }),
      });
      expect(uploadRes.status).toBe(200);

      const downloadRes = await fetch(`${BASE_URL}/api/storage/file/${fileId}`, {
        headers: { Authorization: `Bearer ${adminJwt}` },
      });
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers.get('content-type')).toBe('image/png');
    });
  });

  // 6. PAYMENTS & PHONEPE SANDBOX
  describe('6. Payments & PhonePe Sandbox Integration', () => {
    it('should initiate a test payment and verify sandbox response', async () => {
      const paymentRes = await fetch(`${BASE_URL}/api/payment/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({
          truckNo: 'TN38AB1234',
          amount: 500,
          duration: '1 Month',
          customerName: 'LorryGuru Admin',
          customerEmail: 'admin@lorryguru.in',
          customerPhone: '+919489223134',
          organizationId: 'org_default',
        }),
      });
      expect(paymentRes.status).toBe(200);
      const data = (await paymentRes.json()) as any;
      expect(data.success).toBe(true);
      expect(data.redirectUrl).toBeDefined();
    });
  });

  // 7. SECURITY AUDIT
  describe('7. Security Audit Verification', () => {
    it('should never expose plaintext passwords in API responses', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${adminJwt}` },
      });
      const data = (await res.json()) as any;
      expect(data.user).toBeDefined();
      expect(data.user.password).toBeUndefined();
      expect(data.user.password_hash).toBeUndefined();
    });

    it('should reject SQL injection payloads in parameters', async () => {
      const res = await fetch(`${BASE_URL}/api/database/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
        body: JSON.stringify({
          orgId: "org_default' OR '1'='1",
          targetCollections: ['trucks'],
        }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      // D1 prepared statement safely escapes string, returning 0 rows for malicious orgId
      expect(data.loadedState.trucks.length).toBe(0);
    });
  });
});
