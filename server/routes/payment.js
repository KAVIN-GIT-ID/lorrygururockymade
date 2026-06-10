import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { Client as AppwriteClient, Databases } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Initialize Appwrite Server SDK
const appwriteClient = new AppwriteClient();
if (process.env.APPWRITE_ENDPOINT && process.env.APPWRITE_PROJECT_ID && process.env.APPWRITE_API_KEY) {
  appwriteClient
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
}
const databases = new Databases(appwriteClient);

// Helper to calculate SHA256 checksum
function calculateChecksum(payload, endpoint, saltKey, saltIndex = '1') {
  const data = payload + endpoint + saltKey;
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  return `${sha256}###${saltIndex}`;
}

// 1. Initiate Payment Flow
router.post('/initiate', async (req, res) => {
  try {
    const {
      truckNo,
      amount,
      duration,
      planName,
      customerName,
      customerEmail,
      customerPhone,
      organizationId,
      currentUserId,
      truckPayload,
      existingTruckId
    } = req.body;

    if (!truckNo || !amount) {
      return res.status(400).json({ error: 'Missing required parameters: truckNo and amount' });
    }

    const merchantTransactionId = 'TXN' + Date.now() + Math.random().toString(36).substring(2, 5).toUpperCase();
    const env = process.env.PHONEPE_ENV || 'sandbox';
    const merchantId = env === 'production' 
      ? (process.env.PHONEPE_CLIENT_ID || 'M2245QN1SPBL1_2606081934')
      : 'PGTESTPAYUAT86';
    const saltKey = env === 'production'
      ? (process.env.PHONEPE_CLIENT_SECRET || 'OTFhZDYzM2UtMGFmYy00NGFjLWE2ZDAtMzg1N2YzYmQzNjNm')
      : '96434309-7796-489d-8924-ab56988a6076';

    const baseUrl = env === 'production' 
      ? 'https://api.phonepe.com/apis/hermes' 
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    const referer = req.get('referer');
    let redirectBase = `${process.env.VITE_APP_URL || 'http://localhost:3000'}/console/trucks`;
    if (referer) {
      try {
        const parsedReferer = new URL(referer);
        let pathname = parsedReferer.pathname;
        if (pathname === '/') pathname = '/console/trucks';
        redirectBase = `${parsedReferer.protocol}//${parsedReferer.host}${pathname}`;
      } catch (e) {
        console.warn('Failed to parse referer header:', referer);
      }
    }

    // Build Payload
    const payloadObj = {
      merchantId,
      merchantTransactionId,
      merchantUserId: 'MUID' + Date.now(),
      amount: amount * 100, // convert to paise
      redirectUrl: `${redirectBase}?txnId=${merchantTransactionId}&truckNo=${encodeURIComponent(truckNo)}`,
      redirectMode: 'REDIRECT',
      callbackUrl: `${req.protocol}://${req.get('host')}/api/payment/callback`,
      mobileNumber: customerPhone ? customerPhone.replace(/\D/g, '').substring(0, 10) : '9999999999',
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const base64Payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
    const xVerify = calculateChecksum(base64Payload, '/pg/v1/pay', saltKey, '1');

    console.log(`Initiating PhonePe payment for ${truckNo}, Amt: ${amount}, TxnId: ${merchantTransactionId}`);

    // Call PhonePe API
    const response = await axios.post(
      `${baseUrl}/pg/v1/pay`,
      { request: base64Payload },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'X-MERCHANT-ID': merchantId
        }
      }
    );

    const redirectUrl = response.data?.data?.instrumentResponse?.redirectInfo?.url;

    if (!redirectUrl) {
      return res.status(500).json({ error: 'PhonePe returned empty redirect URL' });
    }

    // Save temporary transaction mapping in local server state if needed or send to client
    // We will return redirectUrl, txnId, and calculated expiry back to the client
    res.status(200).json({
      success: true,
      redirectUrl,
      transactionId: merchantTransactionId,
      merchantId
    });

  } catch (error) {
    console.error('PhonePe Initiate Error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to initiate PhonePe payment', 
      details: error.response?.data || error.message 
    });
  }
});

// Helper function to approve and log payment
async function processSuccessfulPayment(transactionId, merchantId, amountPaid, duration, customerName, customerEmail, customerPhone, truckNo, organizationId, truckPayload, existingTruckId) {
  try {
    const d = new Date();
    if (duration === '1 Month') {
      d.setMonth(d.getMonth() + 1);
    } else if (duration === '3 Months') {
      d.setMonth(d.getMonth() + 3);
    } else if (duration === '6 Months') {
      d.setMonth(d.getMonth() + 6);
    } else {
      d.setFullYear(d.getFullYear() + 1); // 1 Year Default
    }
    const expiryStr = d.toISOString().split('T')[0];

    const databaseId = process.env.APPWRITE_DATABASE_ID || 'fleet_db';

    // 1. Update/Create Truck in Appwrite
    let targetTruckId = existingTruckId || ('tr_' + Date.now());
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

    const finalTruckPayload = {
      organizationId,
      data: JSON.stringify(truckDataObj)
    };

    try {
      await databases.updateDocument(databaseId, 'trucks', targetTruckId, finalTruckPayload);
      console.log(`Successfully updated truck ${truckNo} to Active status via Appwrite Server SDK`);
    } catch (e) {
      try {
        // If document does not exist, create it
        await databases.createDocument(databaseId, 'trucks', targetTruckId, finalTruckPayload);
        console.log(`Successfully created truck ${truckNo} in Active status via Appwrite Server SDK`);
      } catch (createErr) {
        console.error("Failed to write truck sheet to Appwrite DB:", createErr.message || createErr);
        // Fall back to resolved state since local cache sync will reconcile it
      }
    }

    // 2. Create Payment Record (gracefully handle if payments collection does not exist)
    try {
      const paymentRecordObj = {
        organizationId,
        truckNo: truckNo.toUpperCase(),
        amount: Number(amountPaid),
        transactionId,
        paymentDate: new Date().toISOString(),
        duration,
        status: 'Success',
        customerEmail: customerEmail || '',
        customerName: customerName || '',
        customerPhone: customerPhone || '',
      };

      const finalPaymentPayload = {
        organizationId,
        data: JSON.stringify(paymentRecordObj)
      };

      const paymentId = 'pay_' + Date.now();
      await databases.createDocument(databaseId, 'payments', paymentId, finalPaymentPayload);
      console.log(`Payment record logged successfully in Appwrite Payments collection. ID: ${paymentId}`);
    } catch (payRecordErr) {
      console.warn("Could not log payment record in Appwrite Payments collection (might not exist):", payRecordErr.message || payRecordErr);
    }

    return { success: true, expiryStr };
  } catch (err) {
    console.error('Error processing successful payment:', err);
    throw err;
  }
}

// 2. Webhook Callback Endpoint
router.post('/callback', async (req, res) => {
  try {
    const { response } = req.body;
    if (!response) {
      return res.status(400).json({ error: 'Missing response payload' });
    }

    const decoded = JSON.parse(Buffer.from(response, 'base64').toString('utf-8'));
    console.log('PhonePe Webhook callback received:', decoded);

    if (decoded.success && decoded.code === 'PAYMENT_SUCCESS') {
      const { merchantTransactionId, merchantId, amount } = decoded.data;
      
      // Note: Webhooks might not have organizationId/truckPayload directly.
      // Therefore, the frontend will also call the secure Check Status API to verify and update the database directly upon redirect.
      console.info(`Webhook payment success for txn: ${merchantTransactionId}, Amount: ${amount / 100}`);
    }

    res.status(200).json({ status: 'OK' });
  } catch (error) {
    console.error('PhonePe Callback Webhook Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 3. Status API / Verification Endpoint
router.get('/status/:txnId', async (req, res) => {
  try {
    const { txnId } = req.params;
    const { 
      truckNo, 
      organizationId, 
      duration, 
      customerName, 
      customerEmail, 
      customerPhone,
      truckPayload,
      existingTruckId
    } = req.query;

    const env = process.env.PHONEPE_ENV || 'sandbox';
    const merchantId = env === 'production' 
      ? (process.env.PHONEPE_CLIENT_ID || 'M2245QN1SPBL1_2606081934')
      : 'PGTESTPAYUAT86';
    const saltKey = env === 'production'
      ? (process.env.PHONEPE_CLIENT_SECRET || 'OTFhZDYzM2UtMGFmYy00NGFjLWE2ZDAtMzg1N2YzYmQzNjNm')
      : '96434309-7796-489d-8924-ab56988a6076';

    const baseUrl = env === 'production' 
      ? 'https://api.phonepe.com/apis/hermes' 
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    const checkStatusUrl = `/pg/v1/status/${merchantId}/${txnId}`;
    const xVerify = calculateChecksum('', checkStatusUrl, saltKey, '1');

    console.log(`Checking transaction status for TxnId: ${txnId}`);

    const response = await axios.get(
      `${baseUrl}${checkStatusUrl}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'X-MERCHANT-ID': merchantId
        }
      }
    );

    const paymentResult = response.data;
    console.log('PhonePe Status API response:', paymentResult);

    if (paymentResult.success && paymentResult.code === 'PAYMENT_SUCCESS') {
      const amountPaid = paymentResult.data.amount / 100;

      // If query parameters exist, we can automatically process the successful database update
      if (truckNo && organizationId) {
        let parsedPayload = {};
        try {
          parsedPayload = JSON.parse(truckPayload);
        } catch (e) {}

        const { expiryStr } = await processSuccessfulPayment(
          txnId,
          merchantId,
          amountPaid,
          duration || '1 Year',
          customerName,
          customerEmail,
          customerPhone,
          truckNo,
          organizationId,
          parsedPayload,
          existingTruckId
        );

        return res.status(200).json({
          success: true,
          status: 'SUCCESS',
          amount: amountPaid,
          expiryDate: expiryStr,
          details: paymentResult.data
        });
      }

      return res.status(200).json({
        success: true,
        status: 'SUCCESS',
        amount: amountPaid,
        details: paymentResult.data
      });
    }

    res.status(200).json({
      success: false,
      status: paymentResult.code,
      message: paymentResult.message,
      details: paymentResult.data
    });

  } catch (error) {
    console.error('PhonePe Status Check Error:', error);
    res.status(500).json({ 
      error: 'Failed to verify transaction status', 
      details: error.response?.data || error.message 
    });
  }
});

// 4. Initiate Refund API
router.post('/refund', async (req, res) => {
  try {
    const { originalTransactionId, amount } = req.body;
    if (!originalTransactionId || !amount) {
      return res.status(400).json({ error: 'Missing required parameters: originalTransactionId and amount' });
    }

    const refundTransactionId = 'REF' + Date.now() + Math.random().toString(36).substring(2, 5).toUpperCase();
    const env = process.env.PHONEPE_ENV || 'sandbox';
    const merchantId = env === 'production' 
      ? (process.env.PHONEPE_CLIENT_ID || 'M2245QN1SPBL1_2606081934')
      : 'PGTESTPAYUAT86';
    const saltKey = env === 'production'
      ? (process.env.PHONEPE_CLIENT_SECRET || 'OTFhZDYzM2UtMGFmYy00NGFjLWE2ZDAtMzg1N2YzYmQzNjNm')
      : '96434309-7796-489d-8924-ab56988a6076';

    const baseUrl = env === 'production' 
      ? 'https://api.phonepe.com/apis/hermes' 
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    const payloadObj = {
      merchantId,
      merchantTransactionId: refundTransactionId,
      originalTransactionId,
      amount: amount * 100, // paise
      callbackUrl: `${req.protocol}://${req.get('host')}/api/payment/refund-callback`
    };

    const base64Payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
    const xVerify = calculateChecksum(base64Payload, '/pg/v1/refund', saltKey, '1');

    console.log(`Initiating PhonePe refund for Txn: ${originalTransactionId}, Amt: ${amount}, RefundTxnId: ${refundTransactionId}`);

    const response = await axios.post(
      `${baseUrl}/pg/v1/refund`,
      { request: base64Payload },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'X-MERCHANT-ID': merchantId
        }
      }
    );

    const result = response.data;
    console.log('PhonePe Refund API response:', result);

    if (result.success) {
      res.status(200).json({
        success: true,
        refundId: refundTransactionId,
        message: 'Refund initiated successfully',
        details: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Refund failed to initiate',
        details: result.data
      });
    }
  } catch (error) {
    console.error('PhonePe Refund Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to process refund request',
      details: error.response?.data || error.message
    });
  }
});

export default router;
