# Combined Production Services Deployment Guide (WhatsApp Gateway + Node Server)

This guide walks you through deploying both the **WhatsApp OTP Gateway** and the **Truck Backend Server** on your new Oracle Cloud instance.

---

## 1. Quick One-Command Setup with Docker Compose

On your new Oracle server instance, clone/copy the repository or upload the project files, then run:

```bash
# Navigate to project root
cd /home/ubuntu/Truck-Trip-Tracker

# Start both services in detached mode
docker compose up -d --build
```

---

## 2. Combined `docker-compose.yml`

Place this `docker-compose.yml` in your project root or backend folder:

```yaml
version: '3.8'

services:
  # 1. WhatsApp OTP Microservice Gateway
  whatsapp-gateway:
    image: node:20-alpine
    container_name: whatsapp-gateway
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ./whatsapp-gateway:/app
      - /app/node_modules
    ports:
      - "8000:8000"
    command: sh -c "npm install && npm start"
    environment:
      - PORT=8000
      - GATEWAY_API_KEY=standard_lorryguru_otp_key_2026
      - APPWRITE_ENDPOINT=https://appwrite.lorryguru.in/v1
      - APPWRITE_PROJECT_ID=6a7a08cf0037ce918841
      - APPWRITE_API_KEY=standard_f9b0f03eabedc1ad3bbec618b968de8cf4e272bca9355725b2ab14902abd0019bc9bd886d4165c6e5e596ed88659a9bd9e35c516cd327f2283886faa15854e504a8cbf7c9c65a38f5103155ce8f7433591f87f49e2f35cfaa982142eb7b29a2db5c07211ec63620bd25e9cc03b341b58ff40a0899ba70a7f11e4da4e293bffda

  # 2. Main Truck Backend Service (Realtime Sync & Payment Server)
  truck-backend:
    image: node:20-alpine
    container_name: truck-backend
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ./server:/app
      - /app/node_modules
    ports:
      - "5000:5000"
    command: sh -c "npm install && npm run dev"
    environment:
      - PORT=5000
      - APPWRITE_ENDPOINT=https://appwrite.lorryguru.in/v1
      - APPWRITE_PROJECT_ID=6a7a08cf0037ce918841
      - APPWRITE_DATABASE_ID=fleet_db
      - APPWRITE_API_KEY=standard_f9b0f03eabedc1ad3bbec618b968de8cf4e272bca9355725b2ab14902abd0019bc9bd886d4165c6e5e596ed88659a9bd9e35c516cd327f2283886faa15854e504a8cbf7c9c65a38f5103155ce8f7433591f87f49e2f35cfaa982142eb7b29a2db5c07211ec63620bd25e9cc03b341b58ff40a0899ba70a7f11e4da4e293bffda
      - PHONEPE_CLIENT_ID=M2245QN1SPBL1_2606081934
      - PHONEPE_CLIENT_SECRET=OTFhZDYzM2UtMGFmYy00NGFjLWE2ZDAtMzg1N2YzYmQzNjNm
      - PHONEPE_ENV=sandbox
      - VITE_APP_URL=https://lorryguru.in
```

---

## 3. Alternative Systemd / PM2 Deployment (Without Docker)

If running directly on Linux without Docker:

```bash
# 1. Start WhatsApp Gateway (Port 8000)
cd /home/ubuntu/Truck-Trip-Tracker/whatsapp-gateway
npm install
pm2 start index.js --name "whatsapp-gateway"

# 2. Start Backend Server (Port 5000)
cd /home/ubuntu/Truck-Trip-Tracker/server
npm install
pm2 start index.ts --name "truck-backend" --interpreter ./node_modules/.bin/tsx

# Save PM2 process list across reboots
pm2 save
pm2 startup
```

---

## 4. How to Link WhatsApp Number (QR Scan)

Once the `whatsapp-gateway` container/service is running:

```bash
# View terminal logs to see QR Code
docker compose logs -f whatsapp-gateway
# Or if using PM2:
pm2 logs whatsapp-gateway
```

1. Open **WhatsApp** on your spare phone.
2. Go to **Settings** ➔ **Linked Devices** ➔ **Link a Device**.
3. Scan the QR code printed in the server terminal!
