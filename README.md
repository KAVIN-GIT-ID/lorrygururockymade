<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.
https://ai.studio/apps/b863196c-ac35-4ba3-b062-3a11d3be3262

## Server Access & Quick Reference

### Connect to Oracle Cloud Instance via SSH

### Connect & Manage Server via SSH

```bash
# Connect to Oracle Cloud Server via SSH:
ssh -i "C:\Users\infimove\Downloads\ssh-key-2026-08-11_91.key" ubuntu@152.67.174.91

# Navigate to backend server folder:
cd /home/ubuntu/server

# Run backend deployment script:
chmod +x deploy.sh
./deploy.sh

# PM2 Management Commands:
pm2 status
pm2 logs truck-backend
pm2 restart truck-backend
```

# One-Click Deployment (From local Windows terminal in ./server folder):
# .\deploy-oracle.ps1



> **Note:** Replace `/path/to/your-oracle-key.key` with the local path to your `.key` or `.pem` private SSH key file, and `<YOUR_ORACLE_SERVER_IP>` with your Oracle Cloud instance public IP address.

### Server Services Deployment (WhatsApp Gateway + Truck Backend)

For deploying the **WhatsApp OTP Microservice** (Port 8000) and **Truck Backend Server** (Port 5000) on your new server instance, see [SERVER_DEPLOYMENT_GUIDE.md](file:///c:/Users/infimove/antigravity/Truck-Trip-Tracker/SERVER_DEPLOYMENT_GUIDE.md).

---

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`