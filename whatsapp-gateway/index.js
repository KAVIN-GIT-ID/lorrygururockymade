import express from 'express';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const PORT = process.env.PORT || 8000;
const API_KEY = process.env.GATEWAY_API_KEY || 'your-super-secure-shared-key';

let sock = null;
let currentQR = null;
let qrDataURL = null;
let isConnected = false;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  let version = [2, 3000, 1015901307];
  try {
    const { version: latestVersion } = await fetchLatestBaileysVersion();
    version = latestVersion;
  } catch (_) {}

  const makeWASocketFn = makeWASocket.default || makeWASocket;
  sock = makeWASocketFn({
    auth: state,
    version,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      try {
        qrDataURL = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
      } catch (err) {
        console.error('QR rendering error:', err);
      }
    }

    if (connection === 'close') {
      isConnected = false;
      const error = lastDisconnect?.error;
      const statusCode = error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`WhatsApp closed (${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) setTimeout(connectToWhatsApp, 4000);
    } else if (connection === 'open') {
      isConnected = true;
      currentQR = null;
      qrDataURL = null;
      console.log('✅ WhatsApp Gateway connected successfully!');
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

// Web UI to view crisp QR or request 8-digit Pairing Code
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lorry Guru - WhatsApp Gateway</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
        .card { background: #1e293b; border-radius: 16px; padding: 32px; width: 100%; max-width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; border: 1px solid #334155; }
        h1 { font-size: 20px; margin-bottom: 8px; color: #38bdf8; }
        p { font-size: 14px; color: #94a3b8; line-height: 1.5; }
        .qr-box { background: white; padding: 16px; border-radius: 12px; display: inline-block; margin: 20px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .qr-box img { display: block; width: 280px; height: 280px; }
        .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
        .badge.connected { background: #10b981; color: white; }
        .badge.waiting { background: #f59e0b; color: white; }
        .divider { border-top: 1px solid #334155; margin: 24px 0; position: relative; }
        .divider span { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #1e293b; padding: 0 10px; color: #64748b; font-size: 12px; }
        input { width: 100%; box-sizing: border-box; padding: 12px 16px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: white; font-size: 15px; margin-bottom: 12px; text-align: center; }
        button { width: 100%; padding: 12px; border-radius: 8px; border: none; background: #2563eb; color: white; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        button:hover { background: #1d4ed8; }
        .code-display { font-size: 24px; font-weight: 800; letter-spacing: 4px; color: #38bdf8; background: #0f172a; padding: 14px; border-radius: 8px; border: 1px dashed #38bdf8; margin-top: 14px; display: none; }
      </style>
      <script>
        setInterval(async () => {
          try {
            const res = await fetch('/status');
            const data = await res.json();
            if (data.connected) {
              document.getElementById('status-badge').className = 'badge connected';
              document.getElementById('status-badge').innerText = '✅ Connected to WhatsApp';
              document.getElementById('qr-section').style.display = 'none';
            } else if (data.qrDataURL) {
              document.getElementById('qr-img').src = data.qrDataURL;
            }
          } catch (_) {}
        }, 3000);

        async function requestPairCode() {
          const phone = document.getElementById('phone-input').value.trim();
          if (!phone) return alert('Please enter phone number');
          const btn = document.getElementById('pair-btn');
          btn.innerText = 'Requesting Code...';
          btn.disabled = true;
          try {
            const res = await fetch('/pair-code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (data.code) {
              const display = document.getElementById('pair-code-display');
              display.innerText = data.code;
              display.style.display = 'block';
              btn.innerText = 'Get Another Code';
              btn.disabled = false;
            } else {
              alert(data.error || 'Failed to generate pairing code');
              btn.innerText = 'Request Pairing Code';
              btn.disabled = false;
            }
          } catch (err) {
            alert('Error connecting to gateway: ' + err.message);
            btn.innerText = 'Request Pairing Code';
            btn.disabled = false;
          }
        }
      </script>
    </head>
    <body>
      <div class="card">
        <h1>Lorry Guru WhatsApp Gateway</h1>
        <div id="status-badge" class="badge ${isConnected ? 'connected' : 'waiting'}">
          ${isConnected ? '✅ Connected to WhatsApp' : '⏳ Waiting for Linking'}
        </div>

        <div id="qr-section" style="${isConnected ? 'display:none;' : ''}">
          <p>Scan with WhatsApp ➔ Linked Devices</p>
          <div class="qr-box">
            <img id="qr-img" src="${qrDataURL || ''}" alt="WhatsApp QR Code" />
          </div>

          <div class="divider"><span>OR LINK WITH PHONE NUMBER</span></div>
          <p style="font-size: 13px;">Enter your phone number to get an 8-character code:</p>
          <input id="phone-input" type="tel" placeholder="+919025675495" />
          <button id="pair-btn" onclick="requestPairCode()">Request 8-Digit Pairing Code</button>
          <div id="pair-code-display" class="code-display"></div>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/status', (req, res) => {
  res.json({ connected: isConnected, qrDataURL });
});

app.post('/pair-code', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!sock) return res.status(500).json({ error: 'Socket initializing...' });
    const code = await sock.requestPairingCode(cleanPhone);
    return res.json({ success: true, code });
  } catch (err) {
    console.error('Pairing code error:', err);
    return res.status(500).json({ error: err.message || 'Failed to request code' });
  }
});

app.post('/send-otp', async (req, res) => {
  const { apiKey, phone, code } = req.body;
  if (apiKey !== API_KEY) return res.status(401).json({ error: 'Unauthorized gateway access.' });
  if (!phone || !code) return res.status(400).json({ error: 'Phone and Code parameters are required.' });

  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;
    const messageContent = req.body.message || `🔑 *Lorry Guru OTP Verification Code*\n\nYour security verification code is: *${code}*\n\nPlease enter this on your dashboard to verify your identity. Valid for 10 minutes.`;

    if (!sock || !isConnected) {
      return res.status(503).json({ error: 'WhatsApp is not linked yet. Visit http://localhost:8000 to link device.' });
    }

    await sock.sendMessage(jid, { text: messageContent });
    console.log(`[GateWay] Successfully sent WhatsApp OTP message to ${phone}`);
    return res.status(200).json({ success: true, message: 'Message sent.' });
  } catch (err) {
    console.error('[Gateway] Delivery failed:', err);
    return res.status(500).json({ error: 'WhatsApp delivery failed.', details: err.message });
  }
});

app.post('/verify-user-phone', async (req, res) => {
  return res.json({ success: true, message: 'Phone verified in Gateway' });
});

app.listen(PORT, () => {
  console.log(`WhatsApp OTP Gateway microservice listening on port ${PORT}`);
  connectToWhatsApp();
});

