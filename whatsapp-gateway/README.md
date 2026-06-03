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
