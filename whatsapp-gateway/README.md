# Self-Hosted Baileys WhatsApp OTP Gateway Setup

This microservice enables **100% free and unlimited WhatsApp OTP delivery** from a spare WhatsApp number for your self-hosted Appwrite setup.

## 1. Quick Server Deployment (Docker Compose)

Copy the `/whatsapp-gateway` folder onto your server where Appwrite is running.

Open your server's Appwrite `docker-compose.yml` file and add the `whatsapp-gateway` service to the `services:` section:

```yaml
services:
  # ... existing appwrite services ...

  whatsapp-gateway:
    image: node:20-alpine
    container_name: whatsapp-gateway
    working_dir: /app
    volumes:
      - ./whatsapp-gateway:/app
    ports:
      - "8000:8000"
    command: sh -c "apk add --no-cache git && npm install && npm start"
    restart: unless-stopped
    environment:
      - PORT=8000
      - GATEWAY_API_KEY= # Change to your chosen secure key
      - _APP_SMTP_HOST=${_APP_SMTP_HOST}
      - _APP_SMTP_PORT=${_APP_SMTP_PORT}
      - _APP_SMTP_USERNAME=${_APP_SMTP_USERNAME}
      - _APP_SMTP_PASSWORD=${_APP_SMTP_PASSWORD}
      - APPWRITE_ENDPOINT=https://api.lorryguru.in/v1
      - APPWRITE_PROJECT_ID=6a1c5f2700246e86a727
      - APPWRITE_API_KEY=standard_...

```

Run compose to start the new service:
```bash
docker compose up -d whatsapp-gateway
```

## 2. Linking Your WhatsApp Number

To authenticate the gateway with your WhatsApp device, view the container logs once it is running to scan the QR code:

```bash
docker compose logs -f whatsapp-gateway
```

1. Open **WhatsApp** on your spare phone/device.
2. Tap **Settings** (or three dots) ➔ **Linked Devices** ➔ **Link a Device**.
3. Point your camera at the QR code printed in your server terminal.
4. Once scanned, the connection will activate and will remain persistently authenticated across container restarts!

---

## 3. How to Connect in Your React App

In your frontend application, trigger OTP dispatches by hitting this secure endpoint on your server:

```javascript
const sendWhatsAppOTP = async (phoneNumber, verificationCode) => {
  try {
    const response = await fetch('http://<YOUR_SERVER_IP>:8000/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: 'your-super-secure-shared-key', // Matches GATEWAY_API_KEY
        phone: phoneNumber,
        code: verificationCode
      }),
    });
    
    const result = await response.json();
    return result.success;
  } catch (err) {
    console.error('Failed to dispatch WhatsApp OTP:', err);
    return false;
  }
};
```

---

## 4. Session Maintenance & Troubleshooting (Cache Cleanup on Linux)

To ensure the WhatsApp socket session stays alive for months:
1. **Disable Battery Optimization**: Exclude WhatsApp from background restrictions/optimizations on the hosting mobile phone.
2. **Device Activity**: The phone must connect to the internet at least once every 14 days to keep linked sessions active.

### How to Stop & Clear Connection Cache (Revoked/401 Unauthorized Session)

If the Baileys session is terminated by WhatsApp and needs to be re-paired, follow these steps to stop, purge the cache, and re-link:

#### Method A: If Running via Docker / Compose
1. Stop and remove the container:
   ```bash
   docker stop whatsapp-gateway
   docker rm whatsapp-gateway
   ```
2. Delete the old credential cache folder:
   ```bash
   rm -rf auth_info_baileys
   ```
3. Re-run or rebuild the container:
   ```bash
   docker run -d --name whatsapp-gateway --network host -v $(pwd)/auth_info_baileys:/app/auth_info_baileys whatsapp-gateway
   # Or using docker compose:
   docker compose up -d --build whatsapp-gateway
   ```
4. Scan the fresh QR code generated in the logs:
   ```bash
   docker logs -f whatsapp-gateway
   ```

#### Method B: If Running via PM2
1. Stop the process:
   ```bash
   pm2 stop whatsapp-gateway
   ```
2. Clear the credentials cache folder:
   ```bash
   rm -rf auth_info_baileys
   ```
3. Restart and view the logs to link:
   ```bash
   pm2 restart whatsapp-gateway --attach
   ```

#### Method C: If Running Directly via Node
1. Stop the node process running on port 8000:
   ```bash
   kill -9 $(lsof -t -i:8000)
   ```
2. Clear the credential cache:
   ```bash
   rm -rf auth_info_baileys
   ```
3. Restart:
   ```bash
   npm start
   ```
