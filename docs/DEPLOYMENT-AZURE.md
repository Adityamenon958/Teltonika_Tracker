# Azure Ubuntu VM Deployment

## Overview

Run Teltonika-Tracker with **Node.js + PM2** on an Azure Ubuntu VM.  
Devices connect via **public TCP** to the AVL port. MongoDB Atlas is reached **outbound** from the VM.

## Steps

### 1. Create the VM

- Ubuntu 22.04/24.04 LTS
- Size: start with B2s or similar; scale later
- Lock SSH to your IP in NSG

### 2. Install runtime

```bash
# Node.js 22 LTS (example via NodeSource or nvm)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

sudo npm install -g pm2
```

### 3. Clone and configure

```bash
git clone <YOUR_GITHUB_REPO_URL> Teltonika_Tracker
cd Teltonika_Tracker
cp .env.example .env.production
nano .env.production   # set MONGODB_URI, TCP_PORT, IMEI_AUTH_MODE=strict, LOG_LEVEL=info
npm ci --omit=dev
```

### 4. Network

**Azure NSG inbound**

- Allow TCP `TCP_PORT` (e.g. 5027) from the internet (or known APN ranges if possible)
- Allow SSH from your IP only
- Do **not** open MongoDB ports (Atlas is cloud)

**MongoDB Atlas**

- Network Access → add VM outbound public IP
- Use a DB user with read/write on the shared Dashboard database

### 5. Schemas

Before production traffic:

1. Paste **Device Schema (from Dashboard)** into `src/db/models/Device.js`
2. Paste **AvlRecord Schema (from Dashboard)** into `src/db/models/AvlRecord.js`
3. Align `src/mappers/avlMapper.js`
4. Ensure test device IMEI exists in `Devices`

### 6. Start with PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 status
pm2 logs Teltonika-Tracker
pm2 save
pm2 startup
```

### 7. Point the device

On FMB920 (or via SMS/config tool): set server domain/IP + port to the VM.

### 8. Verify

- `pm2 status` shows online
- Logs show IMEI accept + AVL ACK
- Atlas `AvlRecords` receives inserts
- Dashboard can read the same collections

## Updates

```bash
cd Teltonika_Tracker
git pull
npm ci --omit=dev
pm2 restart Teltonika-Tracker
```

## Notes

- V1 uses PM2 **fork** mode, 1 instance (easier debugging).
- Docker / Kubernetes are future options — see [ROADMAP.md](./ROADMAP.md).
