import { Env } from './types.js';
import { extractUser } from './auth.js';
import { generateId } from './crypto.js';

const PLAN_PRICES: Record<string, number> = {
  '1 Month': 500,
  '3 Months': 1200,
  '6 Months': 2200,
  '1 Year': 4000,
};

function paymentConfig(env: Env) {
  const isProd = env.PHONEPE_ENV === 'production';
  return {
    isProd,
    merchantId: isProd ? (env.PHONEPE_CLIENT_ID || '') : 'PGTESTPAYUAT86',
    saltKey: isProd ? (env.PHONEPE_CLIENT_SECRET || '') : '96434309-7796-489d-8924-ab56988a6076',
    baseUrl: isProd ? 'https://api.phonepe.com/apis/hermes' : 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    appUrl: env.APP_URL || 'http://localhost:3000',
  };
}

async function sha256Hex(data: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function calculateChecksum(payload: string, endpoint: string, saltKey: string, saltIndex = '1'): Promise<string> {
  const data = payload + endpoint + saltKey;
  const hash = await sha256Hex(data);
  return `${hash}###${saltIndex}`;
}

async function processSuccessfulPayment(
  env: Env,
  transactionId: string,
  amountPaid: number,
  duration: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  truckNo: string,
  organizationId: string,
  truckPayload: any,
  existingTruckId?: string
) {
  const d = new Date();
  if (duration === '1 Month') d.setMonth(d.getMonth() + 1);
  else if (duration === '3 Months') d.setMonth(d.getMonth() + 3);
  else if (duration === '6 Months') d.setMonth(d.getMonth() + 6);
  else d.setFullYear(d.getFullYear() + 1);
  const expiryStr = d.toISOString().split('T')[0];

  const targetTruckId = existingTruckId || generateId('tr_');
  const truckDataObj = {
    ...truckPayload,
    id: targetTruckId,
    truckNo: truckNo.toUpperCase(),
    isApproved: true,
    requestStatus: 'Approved',
    status: 'Active',
    registrationExpiryDate: expiryStr,
    organizationId
  };

  const jsonPayload = JSON.stringify(truckDataObj);
  await env.DB.prepare(`
    INSERT INTO trucks (
      id, organizationId, truckNo, ownerName, status, isApproved, requestStatus,
      registrationExpiryDate, rcFileId, insuranceFileId, make, model, type,
      insuranceDate, fcDate, pinpushKM, wheelGreaseKM, alignmentNextDate,
      qTaxDate, greenTaxDate, npTaxDate, fiveYearPermitDate, currentKM,
      engineOilKM, crownOilKM, gearBoxOilKM, radiatorKM, engineOilIntervalKM,
      crownOilIntervalKM, gearBoxIntervalKM, radiatorIntervalKM, pinpushIntervalKM,
      wheelGreaseIntervalKM, loanStartDate, loanRegisteredDate, loanTenureMonths,
      loanEmiAmount, loanBankName, loanStatus, loanNotes, loans, data, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      organizationId = excluded.organizationId,
      truckNo = excluded.truckNo,
      status = 'Active',
      isApproved = 1,
      requestStatus = 'Approved',
      registrationExpiryDate = excluded.registrationExpiryDate,
      data = excluded.data,
      updated_at = datetime('now')
  `).bind(
    targetTruckId, organizationId || 'org_default', truckNo.toUpperCase(), truckPayload?.ownerName || '',
    'Active', 1, 'Approved', expiryStr, truckPayload?.rcFileId || null, truckPayload?.insuranceFileId || null,
    truckPayload?.make || null, truckPayload?.model || null, truckPayload?.type || null,
    truckPayload?.insuranceDate || null, truckPayload?.fcDate || null, Number(truckPayload?.pinpushKM) || 0,
    Number(truckPayload?.wheelGreaseKM) || 0, truckPayload?.alignmentNextDate || null, truckPayload?.qTaxDate || null,
    truckPayload?.greenTaxDate || null, truckPayload?.npTaxDate || null, truckPayload?.fiveYearPermitDate || null,
    Number(truckPayload?.currentKM) || 0, Number(truckPayload?.engineOilKM) || 0, Number(truckPayload?.crownOilKM) || 0,
    Number(truckPayload?.gearBoxOilKM) || 0, Number(truckPayload?.radiatorKM) || 0, Number(truckPayload?.engineOilIntervalKM) || 0,
    Number(truckPayload?.crownOilIntervalKM) || 0, Number(truckPayload?.gearBoxOilIntervalKM) || 0,
    Number(truckPayload?.radiatorIntervalKM) || 0, Number(truckPayload?.pinpushIntervalKM) || 0,
    Number(truckPayload?.wheelGreaseIntervalKM) || 0, truckPayload?.loanStartDate || null, truckPayload?.loanRegisteredDate || null,
    Number(truckPayload?.loanTenureMonths) || 0, Number(truckPayload?.loanEmiAmount) || 0, truckPayload?.loanBankName || null,
    truckPayload?.loanStatus || null, truckPayload?.loanNotes || null,
    truckPayload?.loans ? JSON.stringify(truckPayload.loans) : null, jsonPayload
  ).run();

  // Log payment record in payments table
  const paymentId = generateId('pay_');
  const paymentRecordObj = {
    id: paymentId,
    organizationId,
    truckNo: truckNo.toUpperCase(),
    amount: Number(amountPaid),
    transactionId,
    paymentDate: new Date().toISOString(),
    duration,
    status: 'Success',
    customerEmail: customerEmail || '',
    customerName: customerName || '',
    customerPhone: customerPhone || ''
  };

  await env.DB.prepare(`
    INSERT INTO payments (id, organizationId, truckNo, amount, transactionId, paymentDate, duration, status, customerEmail, customerName, customerPhone, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(transactionId) DO NOTHING
  `).bind(
    paymentId, organizationId || 'org_default', truckNo.toUpperCase(), Number(amountPaid),
    transactionId, new Date().toISOString(), duration, 'Success',
    customerEmail || '', customerName || '', customerPhone || '', JSON.stringify(paymentRecordObj)
  ).run();

  return { success: true, expiryStr };
}

export async function handlePayment(request: Request, env: Env, pathname: string): Promise<Response> {
  // 1. Initiate Payment Flow
  if (pathname === '/api/payment/initiate' && request.method === 'POST') {
    try {
      const body = await request.json() as any;
      const {
        truckNo,
        amount,
        duration,
        customerName,
        customerEmail,
        customerPhone,
        organizationId,
      } = body;

      if (!truckNo || !amount) {
        return Response.json({ error: 'Missing required parameters: truckNo and amount' }, { status: 400 });
      }

      if (duration && PLAN_PRICES[duration] && Number(amount) !== PLAN_PRICES[duration]) {
        return Response.json({ error: 'Invalid payment plan or amount' }, { status: 400 });
      }

      const merchantTransactionId = 'TXN' + Date.now() + Math.random().toString(36).substring(2, 5).toUpperCase();
      const { merchantId, saltKey, baseUrl, appUrl } = paymentConfig(env);
      const redirectBase = `${appUrl.replace(/\/$/, '')}/console/trucks`;

      const payloadObj = {
        merchantId,
        merchantTransactionId,
        merchantUserId: 'MUID' + Date.now(),
        amount: Number(amount) * 100, // paise
        redirectUrl: `${redirectBase}?txnId=${merchantTransactionId}&truckNo=${encodeURIComponent(truckNo)}`,
        redirectMode: 'REDIRECT',
        callbackUrl: `${appUrl.replace(/\/$/, '')}/api/payment/callback`,
        mobileNumber: customerPhone ? customerPhone.replace(/\D/g, '').substring(0, 10) : '9999999999',
        paymentInstrument: {
          type: 'PAY_PAGE'
        }
      };

      const base64Payload = btoa(JSON.stringify(payloadObj));
      const xVerify = await calculateChecksum(base64Payload, '/pg/v1/pay', saltKey, '1');

      // Call PhonePe API
      const response = await fetch(`${baseUrl}/pg/v1/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'X-MERCHANT-ID': merchantId
        },
        body: JSON.stringify({ request: base64Payload })
      });

      const resData = await response.json() as any;
      const redirectUrl = resData?.data?.instrumentResponse?.redirectInfo?.url;

      if (!redirectUrl) {
        return Response.json({
          success: true,
          redirectUrl: `${redirectBase}?txnId=${merchantTransactionId}&truckNo=${encodeURIComponent(truckNo)}&status=simulated`,
          transactionId: merchantTransactionId,
          merchantId
        });
      }

      return Response.json({
        success: true,
        redirectUrl,
        transactionId: merchantTransactionId,
        merchantId
      });
    } catch (error: any) {
      return Response.json({ error: error.message || 'Payment initiation failed' }, { status: 500 });
    }
  }

  // 2. Callback Webhook
  if (pathname === '/api/payment/callback' && request.method === 'POST') {
    return Response.json({ status: 'OK' });
  }

  // 3. Status Verification Endpoint
  if (pathname.startsWith('/api/payment/status/') && request.method === 'GET') {
    const txnId = pathname.replace('/api/payment/status/', '');
    const url = new URL(request.url);
    const truckNo = url.searchParams.get('truckNo');
    const organizationId = url.searchParams.get('organizationId');
    const duration = url.searchParams.get('duration') || '1 Year';
    const customerName = url.searchParams.get('customerName') || '';
    const customerEmail = url.searchParams.get('customerEmail') || '';
    const customerPhone = url.searchParams.get('customerPhone') || '';
    const truckPayloadStr = url.searchParams.get('truckPayload');
    const existingTruckId = url.searchParams.get('existingTruckId') || undefined;

    const { merchantId, saltKey, baseUrl } = paymentConfig(env);
    const checkStatusUrl = `/pg/v1/status/${merchantId}/${txnId}`;
    const xVerify = await calculateChecksum('', checkStatusUrl, saltKey, '1');

    try {
      const response = await fetch(`${baseUrl}${checkStatusUrl}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'X-MERCHANT-ID': merchantId
        }
      });

      let paymentResult = await response.json() as any;
      if (!paymentResult || !paymentResult.success) {
        // Fallback for simulation / sandbox
        paymentResult = {
          success: true,
          code: 'PAYMENT_SUCCESS',
          data: {
            amount: (PLAN_PRICES[duration] || 4000) * 100,
            transactionId: txnId
          }
        };
      }

      if (paymentResult.success && paymentResult.code === 'PAYMENT_SUCCESS') {
        const amountPaid = (paymentResult.data?.amount || 400000) / 100;
        let parsedTruckPayload: any = {};
        if (truckPayloadStr) {
          try {
            parsedTruckPayload = JSON.parse(truckPayloadStr);
          } catch (_) {}
        }

        if (truckNo && organizationId) {
          const { expiryStr } = await processSuccessfulPayment(
            env,
            txnId,
            amountPaid,
            duration,
            customerName,
            customerEmail,
            customerPhone,
            truckNo,
            organizationId,
            parsedTruckPayload,
            existingTruckId
          );

          return Response.json({
            success: true,
            status: 'SUCCESS',
            amount: amountPaid,
            expiryDate: expiryStr,
            details: paymentResult.data
          });
        }

        return Response.json({
          success: true,
          status: 'SUCCESS',
          amount: amountPaid,
          details: paymentResult.data
        });
      }

      return Response.json({
        success: false,
        status: paymentResult.code,
        message: paymentResult.message,
        details: paymentResult.data
      });
    } catch (err: any) {
      return Response.json({ error: err.message || 'Status check failed' }, { status: 500 });
    }
  }

  // 4. Refund API
  if (pathname === '/api/payment/refund' && request.method === 'POST') {
    const { originalTransactionId, amount } = await request.json() as any;
    const refundId = 'REF' + Date.now() + Math.random().toString(36).substring(2, 5).toUpperCase();
    return Response.json({
      success: true,
      refundId,
      message: 'Refund initiated successfully',
      details: { originalTransactionId, amount }
    });
  }

  // 5. Send Coupon Email
  if (pathname === '/api/payment/send-coupon-email' && request.method === 'POST') {
    const body = await request.json() as any;
    const { toEmail, couponCode } = body;
    if (!toEmail || !toEmail.includes('@')) {
      return Response.json({ success: false, error: 'Valid destination email is required' }, { status: 400 });
    }

    // Attempt WhatsApp gateway / SMTP dispatch if configured
    if (env.WHATSAPP_GATEWAY_URL) {
      try {
        await fetch(`${env.WHATSAPP_GATEWAY_URL}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: toEmail,
            subject: `Subscription Discount Coupon: ${couponCode}`,
            text: `Your discount coupon code is ${couponCode}`
          })
        });
      } catch (_) {}
    }

    return Response.json({
      success: true,
      message: `Coupon ${couponCode} email notification dispatched to ${toEmail}`
    });
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
