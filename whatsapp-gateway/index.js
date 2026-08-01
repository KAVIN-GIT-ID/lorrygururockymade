import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';
import nodemailer from 'nodemailer';

dotenv.config();

const smtpHost = process.env.SMTP_HOST || process.env._APP_SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || process.env._APP_SMTP_PORT || '465');
const smtpUser = process.env.SMTP_USER || process.env._APP_SMTP_USERNAME;
const smtpPass = process.env.SMTP_PASS || process.env._APP_SMTP_PASSWORD;
const alertEmailRecipient = 'prasath.sakthi@gmail.com';

let lastAlertSentTimes = {
  disconnect: 0,
  connect: 0,
  general: 0
};
const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

async function sendEmailAlert(subject, text, alertType = 'general') {
  const now = Date.now();
  const lastSent = lastAlertSentTimes[alertType] || 0;
  if (now - lastSent < ALERT_COOLDOWN_MS) {
    console.log(`[Alerts] Alert rate limit active for '${alertType}'. Skipping email dispatch.`);
    return;
  }
  
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('[Alerts] SMTP environment variables are not configured. Skipping email dispatch.');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    await transporter.sendMail({
      from: `"WhatsApp Gateway Alert" <${smtpUser}>`,
      to: alertEmailRecipient,
      subject,
      text
    });

    lastAlertSentTimes[alertType] = now;
    console.log(`[Alerts] Alert email sent successfully to ${alertEmailRecipient} (type: ${alertType})`);
  } catch (err) {
    console.error('[Alerts] Failed to send alert email:', err);
  }
}


const app = express();
app.use(express.json());

// Enable CORS for remote cross-origin requests (e.g. from local development server)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const PORT = process.env.PORT || 8000;
const API_KEY = process.env.GATEWAY_API_KEY || 'your-super-secure-shared-key';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;

let sock = null;

async function connectToWhatsApp() {
  const authFolder = 'auth_info_baileys';
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  let version = [2, 3000, 1015901307]; // High version fallback to prevent 405
  try {
    const { version: latestVersion, isLatest } = await fetchLatestBaileysVersion();
    version = latestVersion;
    console.log(`[WhatsApp] Loaded dynamic client version: ${version.join('.')}, isLatest: ${isLatest}`);
  } catch (err) {
    console.warn(`[WhatsApp] Failed to fetch latest web version, using fallback: ${version.join('.')}`);
  }

  sock = makeWASocket.default({
    auth: state,
    version,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    keepAliveIntervalMs: 30000, // Keep-alive socket ping frame every 30 seconds
    defaultQueryTimeoutMs: 60000, // Extend query timeout to 60 seconds to avoid timed-out booms
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP DEVICE LINKING ---');
      qrcode.generate(qr, { small: true });
      console.log('------------------------------------------------------\n');
    }

    if (connection === 'close') {
      const error = lastDisconnect?.error;
      const statusCode = error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const shouldReconnect = !isLoggedOut;

      console.error(`WhatsApp connection closed. Status Code: ${statusCode || 'unknown'}. Error:`, error);

      // Trigger email alert
      const errorMessage = error ? (error.message || JSON.stringify(error)) : 'Unknown socket closure';
      await sendEmailAlert(
        `🚨 ALERT: WhatsApp OTP Gateway Disconnected`,
        `The headless WhatsApp OTP gateway connection has closed.\n\nDetails:\n- Status Code: ${statusCode || 'unknown'}\n- Error: ${errorMessage}\n- Logout: ${isLoggedOut}\n- Will Reconnect: ${shouldReconnect}\n\nTimestamp: ${new Date().toString()}`,
        'disconnect'
      );

      if (isLoggedOut) {
        console.log('Session has been logged out or revoked. Deleting credentials folder and restarting for fresh pairing...');
        try {
          fs.rmSync(authFolder, { recursive: true, force: true });
        } catch (rmErr) {
          console.warn('Failed to clear auth folder:', rmErr);
        }
        setTimeout(connectToWhatsApp, 2000);
      } else if (shouldReconnect) {
        console.log('Reconnecting in 5 seconds...');
        setTimeout(connectToWhatsApp, 5000);
      }
    } else if (connection === 'open') {
      console.log('======================================================');
      console.log('✅ Success: Headless WhatsApp connection active!');
      console.log('======================================================');

      await sendEmailAlert(
        `✅ NOTICE: WhatsApp OTP Gateway Connected`,
        `The headless WhatsApp OTP gateway connection is now active and operational.\n\nDetails:\n- Status: Active / Connected\n- Timestamp: ${new Date().toString()}`,
        'connect'
      );

      // Send self-notification message to WhatsApp device when connected
      try {
        const userJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
        if (userJid) {
          sock.sendMessage(userJid, {
            text: `*WhatsApp Gateway Status*\n\n✅ Gateway successfully connected and active at ${new Date().toLocaleTimeString()}!`
          }).catch(err => console.warn('[WhatsApp Notification] Self-message warning:', err.message || err));
        }
      } catch (selfMsgErr) {}
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

app.post('/send-otp', async (req, res) => {
  const { apiKey, phone, code } = req.body;

  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized gateway access.' });
  }

  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and Code parameters are required.' });
  }

  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    const messageContent = req.body.message || `🔑 *FleetTrack Pro OTP Verification Code*\n\nYour security verification code is: *${code}*\n\nPlease enter this on your dashboard to verify your identity. Valid for 10 minutes.`;

    await sock.sendMessage(jid, { text: messageContent });

    console.log(`[GateWay] Successfully sent WhatsApp message to ${phone}`);
    return res.status(200).json({ success: true, message: 'Message sent.' });
  } catch (err) {
    console.error('[Gateway] Delivery failed:', err);
    return res.status(500).json({ error: 'WhatsApp delivery failed.', details: err.message });
  }
});

app.post('/verify-user-phone', async (req, res) => {
  const { apiKey, userId } = req.body;

  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized gateway access.' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const appwriteEndpoint = process.env.APPWRITE_ENDPOINT || 'http://localhost/v1';
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const adminApiKey = process.env.APPWRITE_API_KEY;

    if (!projectId || !adminApiKey) {
      return res.status(500).json({ error: 'Appwrite admin credentials (PROJECT_ID / API_KEY) not configured on gateway.' });
    }

    console.log(`[Gateway] Updating phone verification status for user ${userId} in Appwrite Auth...`);

    const response = await fetch(`${appwriteEndpoint}/users/${userId}/verification/phone`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': adminApiKey,
        ...(process.env.APPWRITE_HOST_HEADER ? { 'Host': process.env.APPWRITE_HOST_HEADER } : {})
      },
      body: JSON.stringify({ phoneVerification: true })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Appwrite Users API returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    console.log(`[GateWay] Successfully set phone verification to true in Appwrite Auth for user ${userId}`);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[Gateway] Failed to update user verification:', err);
    return res.status(500).json({ error: 'Failed to update user verification in Appwrite.', details: err.message });
  }
});

// POST /send-email: Send emails via SMTP
app.post('/send-email', async (req, res) => {
  const { to, subject, text } = req.body;
  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'to, subject, and text parameters are required' });
  }

  if (!smtpHost || !smtpUser || !smtpPass) {
    return res.status(500).json({ error: 'SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not configured on gateway.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    await transporter.sendMail({
      from: `"Truck Trip Tracker" <${smtpUser}>`,
      to,
      subject,
      text
    });

    console.log(`[Email Gateway] Successfully sent email to ${to}`);
    return res.status(200).json({ success: true, message: `Email dispatched to ${to}` });
  } catch (err) {
    console.error('[Email Gateway Error]:', err);
    return res.status(500).json({ error: 'Failed to send email via SMTP', details: err.message });
  }
});

if (SSL_KEY_PATH && SSL_CERT_PATH && fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
  const options = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH)
  };
  https.createServer(options, app).listen(PORT, () => {
    console.log(`WhatsApp OTP Gateway microservice listening on secure port ${PORT} (HTTPS)`);
    connectToWhatsApp();
  });
} else {
  app.listen(PORT, () => {
    console.log(`WhatsApp OTP Gateway microservice listening on port ${PORT} (HTTP)`);
    connectToWhatsApp();
  });
}