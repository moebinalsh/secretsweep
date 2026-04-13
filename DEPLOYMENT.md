# SecretSweep — Complete Setup & Deployment Guide

---

## Table of Contents

1. [Local Development Setup](#1-local-development-setup)
2. [Prepare for GitHub](#2-prepare-for-github)
3. [Production Deployment (AWS EC2)](#3-production-deployment-aws-ec2)
4. [Domain & SSL Setup](#4-domain--ssl-setup)
5. [How Invite Links Work](#5-how-invite-links-work)
6. [Maintenance & Updates](#6-maintenance--updates)
7. [Troubleshooting](#7-troubleshooting)
8. [Architecture](#8-architecture)

---

## 1. Local Development Setup

### Prerequisites

- **Node.js 20+** — `node --version`
- **PostgreSQL 16+** — `psql --version`
- **npm** — comes with Node.js

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/secretsweep.git
cd secretsweep
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Start PostgreSQL

**macOS (Homebrew):**
```bash
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo systemctl start postgresql
```

**Verify it's running:**
```bash
pg_isready
# Should output: accepting connections
```

### Step 4: Create Database and User

```bash
# Connect as the default postgres superuser
psql postgres

# Inside psql, run:
CREATE USER secretsweep_app WITH LOGIN PASSWORD 'changeme';
CREATE DATABASE secretsweep OWNER secretsweep_app;
\q
```

### Step 5: Create Environment File

```bash
cp .env.example .env
```

Now edit `.env` and generate secrets:

```bash
# Generate 4 unique secrets (run each line separately, copy each output)
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

Paste each output into your `.env` file. Your `.env` should look like:

```env
DATABASE_URL=postgres://secretsweep_app:changeme@localhost:5432/secretsweep

SESSION_SECRET=a1b2c3d4e5f6...your_64_char_hex_here
JWT_ACCESS_SECRET=f6e5d4c3b2a1...your_64_char_hex_here
JWT_REFRESH_SECRET=1a2b3c4d5e6f...your_64_char_hex_here
ENCRYPTION_KEY=6f5e4d3c2b1a...your_64_char_hex_here

PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
ALLOWED_ORIGINS=http://localhost:5173
```

### Step 6: Run Database Migrations

```bash
node server/db/migrate.js
```

You should see all migrations applied:
```
[run]  001_initial.sql...
[done] 001_initial.sql
...
Applied N migration(s).
```

### Step 7: Create Super Admin Account

```bash
node server/create-admin.js
```

Follow the prompts:
```
  Email: your@email.com
  Name: Your Name
  Password (min 8 chars): ********
  Confirm password: ********

  Super admin created: your@email.com
```

### Step 8: Start the Dev Server

```bash
npm run dev
```

This starts both:
- **Vite dev server** on `http://localhost:5173` (frontend with hot reload)
- **Express API server** on `http://localhost:3000` (backend)

Open `http://localhost:5173` in your browser.

### Step 9: Verify Everything Works

1. Visit `http://localhost:5173` — you should see the landing page
2. Click "Sign In" — login with your super admin credentials
3. You should see the dashboard with the Admin panel link
4. Go to Admin → Create an organization → Use the invite link to test

### Common Local Issues

| Issue | Fix |
|-------|-----|
| `EADDRINUSE: port 3000` | `lsof -ti :3000 \| xargs kill -9` then retry |
| `role "secretsweep_app" does not exist` | Re-run Step 4 (create user) |
| `database "secretsweep" does not exist` | Re-run Step 4 (create database) |
| `ENCRYPTION_KEY` error | Make sure it's exactly 64 hex characters |
| Migrations fail | Check `DATABASE_URL` in `.env` matches your DB credentials |

---

## 2. Prepare for GitHub

### What's Safe to Push

| File/Folder | Push? | Why |
|-------------|-------|-----|
| All `src/` code | YES | Frontend code |
| All `server/` code | YES | Backend code (no secrets in code) |
| `server/create-admin.js` | YES | Safe — passwords entered interactively |
| `server/db/migrations/` | YES | Database schema |
| `src/assets/logo.png` | YES | Your logo |
| `.env.example` | YES | Template without secrets |
| `Dockerfile` | YES | Build configuration |
| `docker-compose.yml` | YES | References env vars only |
| `package.json` | YES | Dependencies |
| `DEPLOYMENT.md` | YES | This guide |
| `.env` | **NO** | Contains secrets — in `.gitignore` |
| `node_modules/` | **NO** | Dependencies — in `.gitignore` |
| `dist/` | **NO** | Build output — in `.gitignore` |

### Clean Up Before First Push

```bash
# 1. Make sure .env is not tracked
git status
# If .env shows as tracked:
git rm --cached .env

# 2. Check git history for accidental .env commits
git log --all --diff-filter=A -- .env
# If it was ever committed, remove from history:
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' --prune-empty -- --all

# 3. Verify .gitignore includes:
cat .gitignore
# Should contain: .env, node_modules/, dist/, *.log, .DS_Store, *.pem, .claude/

# 4. Push
git add -A
git commit -m "Initial commit"
git remote add origin git@github.com:yourusername/secretsweep.git
git push -u origin main
```

---

## 3. Production Deployment (AWS EC2)

### 3.1 Launch EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Settings:
   - **Name:** SecretSweep
   - **AMI:** Ubuntu Server 22.04 LTS (64-bit x86)
   - **Instance type:** t3.small (2 vCPU, 2GB RAM) — minimum recommended
   - **Key pair:** Create or select one (you'll need this to SSH)
   - **Storage:** 20 GB gp3
3. **Security Group** — allow these inbound rules:
   - SSH (port 22) — **your IP only**
   - HTTP (port 80) — 0.0.0.0/0
   - HTTPS (port 443) — 0.0.0.0/0

4. Launch and note the **Public IPv4 address** (e.g., `54.123.45.67`)

### 3.2 Connect to EC2

```bash
# Make your key file private
chmod 400 your-key.pem

# SSH in
ssh -i your-key.pem ubuntu@54.123.45.67
```

### 3.3 Install System Dependencies

Copy and paste this entire block:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v20.x

# Install PostgreSQL 16
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-16
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Install Nginx
sudo apt install -y nginx
sudo systemctl enable nginx

# Install Certbot (for free SSL)
sudo apt install -y certbot python3-certbot-nginx

# Install PM2 (keeps your app running)
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

Verify everything:
```bash
node --version      # v20.x
npm --version       # 10.x
psql --version      # 16.x
nginx -v            # 1.x
pm2 --version       # 5.x
```

### 3.4 Set Up Database

```bash
# Generate a strong database password (copy the output)
openssl rand -base64 24
# Example output: aB3dEf7GhI9jKlMnOpQrStUv

# Create database user and database
sudo -u postgres psql -c "CREATE USER secretsweep_app WITH PASSWORD 'PASTE_YOUR_GENERATED_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE secretsweep OWNER secretsweep_app;"

# Verify connection works
psql -U secretsweep_app -d secretsweep -c "SELECT 1;"
```

### 3.5 Deploy the Application

```bash
# Clone your repo
cd /home/ubuntu
git clone https://github.com/yourusername/secretsweep.git
cd secretsweep

# Install ALL dependencies (need devDeps for building frontend)
npm install

# Build the frontend
npm run build
# This creates the dist/ folder with optimized static files
```

### 3.6 Create Production Environment File

Generate all 4 secrets first:

```bash
echo "=== Copy these into your .env file ==="
echo ""
echo "SESSION_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
echo "JWT_ACCESS_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
echo "JWT_REFRESH_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
echo "ENCRYPTION_KEY=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
```

Now create the `.env` file:

```bash
nano .env
```

Paste this and fill in your values:

```env
# Database (use the password you generated in step 3.4)
DATABASE_URL=postgres://secretsweep_app:YOUR_DB_PASSWORD@localhost:5432/secretsweep

# Auth Secrets (paste the 4 values generated above)
SESSION_SECRET=paste_here
JWT_ACCESS_SECRET=paste_here
JWT_REFRESH_SECRET=paste_here
ENCRYPTION_KEY=paste_here

# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# CORS — your actual domain (change this!)
ALLOWED_ORIGINS=https://app.yourdomain.com
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

### 3.7 Run Migrations and Create Super Admin

```bash
# Apply all database migrations
node server/db/migrate.js

# Create your super admin account
node server/create-admin.js
# Enter: email, name, password (remember these!)
```

### 3.8 Start the Application with PM2

```bash
# Start with 2 worker processes
pm2 start server/index.js --name secretsweep -i 2

# Verify it's running
pm2 status
# Should show: secretsweep | online | 2 instances

# Test it locally
curl http://localhost:3000/health
# Should return: {"status":"ok",...}

# Save PM2 config so it survives reboots
pm2 save

# Enable PM2 to start on boot
pm2 startup
# IMPORTANT: Copy and run the command it prints (starts with sudo)
```

### 3.9 Configure Nginx Reverse Proxy

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/secretsweep
```

Paste this entire config (replace `app.yourdomain.com` with your domain):

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;

    # Redirect HTTP to HTTPS (certbot will add this later)
    # For now, proxy to the app
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Required for SSE (scan live streaming)
        proxy_buffering off;
        proxy_read_timeout 86400;

        # File upload limit (for future use)
        client_max_body_size 10M;
    }
}
```

Save and enable:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/secretsweep /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t
# Should say: syntax is ok / test is successful

# Restart Nginx
sudo systemctl restart nginx

# Test it works (using your EC2 public IP)
curl http://54.123.45.67/health
```

---

## 4. Domain & SSL Setup

### 4.1 Point Your Domain to EC2

In your DNS provider (Cloudflare, Route53, Namecheap, etc.):

1. Create an **A record**:
   - **Name:** `app` (for `app.yourdomain.com`) or `@` (for root domain)
   - **Type:** A
   - **Value:** Your EC2 public IP (e.g., `54.123.45.67`)
   - **TTL:** 300 (or Auto)

2. Wait for DNS propagation (usually 1-5 minutes):
```bash
# Check from your EC2 instance
dig app.yourdomain.com
# Should show your EC2 IP in the ANSWER section
```

**Cloudflare users:** Set the proxy to **DNS only** (gray cloud) initially. You can enable the orange cloud proxy after SSL is set up.

### 4.2 Get Free SSL Certificate

```bash
# Request SSL certificate from Let's Encrypt
sudo certbot --nginx -d app.yourdomain.com

# When prompted:
# - Enter your email
# - Agree to terms (Y)
# - Choose to redirect HTTP to HTTPS (option 2)
```

Certbot automatically:
- Gets the SSL certificate
- Updates your Nginx config to use HTTPS
- Sets up HTTP → HTTPS redirect
- Configures auto-renewal

Verify auto-renewal:
```bash
sudo certbot renew --dry-run
# Should say: Congratulations, all simulated renewals succeeded
```

### 4.3 Update ALLOWED_ORIGINS

```bash
nano /home/ubuntu/secretsweep/.env
# Change ALLOWED_ORIGINS to your actual domain:
# ALLOWED_ORIGINS=https://app.yourdomain.com

# Restart the app
pm2 restart secretsweep
```

### 4.4 Verify Everything

```bash
# Test HTTPS
curl https://app.yourdomain.com/health

# Test in browser
# Open https://app.yourdomain.com
# You should see the landing page with your logo
```

---

## 5. How Invite Links Work

When a super admin creates an org or an org admin invites a user:

1. The server generates a 64-character random token
2. An invitation record is saved in the database (expires in 72 hours)
3. The invite URL is: `https://app.yourdomain.com/invite/TOKEN`

**How it reaches the user:**
- The invite URL is shown in the admin panel — copy and send it manually (email, Slack, etc.)
- When the recipient clicks the link, the React SPA loads
- The frontend reads the token from the URL and shows a "Set your password" form
- On submit, the server verifies the token, creates the user, and logs them in

**No code changes needed** — invite links automatically use whatever domain the app is hosted on. The `ALLOWED_ORIGINS` env var just controls CORS, and the SPA fallback in Express serves the React app for all non-API routes.

---

## 6. Maintenance & Updates

### Deploy Code Updates

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
cd /home/ubuntu/secretsweep

# Pull latest code
git pull origin main

# Install any new dependencies
npm install

# Rebuild frontend
npm run build

# Run any new migrations
node server/db/migrate.js

# Restart the app
pm2 restart secretsweep

# Verify
pm2 status
curl https://app.yourdomain.com/health
```

### View Logs

```bash
pm2 logs secretsweep              # Real-time (Ctrl+C to exit)
pm2 logs secretsweep --lines 200  # Last 200 lines
pm2 logs secretsweep --err        # Errors only
```

### Database Backups

```bash
# Manual backup
pg_dump -U secretsweep_app secretsweep > /home/ubuntu/backups/backup-$(date +%Y%m%d-%H%M).sql

# Create backups directory
mkdir -p /home/ubuntu/backups

# Automated daily backup at 2 AM
crontab -e
# Add this line:
0 2 * * * pg_dump -U secretsweep_app secretsweep > /home/ubuntu/backups/secretsweep-$(date +\%Y\%m\%d).sql 2>&1

# Restore from backup (if needed)
psql -U secretsweep_app secretsweep < /home/ubuntu/backups/backup-20260412.sql
```

### Monitor System

```bash
pm2 monit                          # Live CPU/RAM dashboard
pm2 status                         # Process list
sudo systemctl status nginx        # Nginx status
sudo systemctl status postgresql   # DB status
df -h                              # Disk space
free -m                            # Memory usage
```

### Reset Super Admin Password

```bash
cd /home/ubuntu/secretsweep
node server/create-admin.js
# Enter the same email — it will update the password
```

### Renew SSL Certificate

Certbot auto-renews, but you can force it:
```bash
sudo certbot renew
sudo systemctl restart nginx
```

---

## 7. Troubleshooting

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| **502 Bad Gateway** | App crashed | `pm2 restart secretsweep` then `pm2 logs` |
| **Connection refused** | App not running | `pm2 start server/index.js --name secretsweep` |
| **SSL certificate expired** | Auto-renew failed | `sudo certbot renew && sudo systemctl restart nginx` |
| **Database connection error** | PostgreSQL down | `sudo systemctl start postgresql` |
| **Invite links 404** | Nginx not proxying | Check Nginx config, `sudo nginx -t` |
| **CORS error in browser** | Wrong domain | Update `ALLOWED_ORIGINS` in `.env`, `pm2 restart` |
| **SSE stream disconnects** | Nginx buffering | Add `proxy_buffering off;` to Nginx config |
| **Rate limited (429)** | Too many requests | Wait 15 minutes, or restart: `pm2 restart` |
| **Can't login** | Wrong creds or token expired | Clear cookies, try again. Reset password if needed. |
| **Forgot super admin password** | — | `node server/create-admin.js` with same email |
| **Scans stuck as "running"** | Server restarted during scan | They auto-mark as "failed" on next server start |
| **No space on disk** | Logs or backups | `pm2 flush` to clear logs, remove old backups |

### Quick Health Check Script

Save this as `/home/ubuntu/healthcheck.sh`:

```bash
#!/bin/bash
echo "=== SecretSweep Health Check ==="
echo ""
echo "App status:"
pm2 status secretsweep
echo ""
echo "Health endpoint:"
curl -s http://localhost:3000/health | python3 -m json.tool
echo ""
echo "Nginx:"
sudo systemctl is-active nginx
echo ""
echo "PostgreSQL:"
sudo systemctl is-active postgresql
echo ""
echo "Disk:"
df -h / | tail -1
echo ""
echo "Memory:"
free -m | grep Mem
```

```bash
chmod +x /home/ubuntu/healthcheck.sh
./healthcheck.sh
```

---

## 8. Architecture

```
                    ┌──────────────────────────────────────┐
                    │           Your Domain                 │
                    │      app.yourdomain.com               │
                    └──────────────┬───────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────────────┐
                    │         Nginx (Port 443)              │
                    │    SSL Termination + Reverse Proxy    │
                    └──────────────┬───────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────────────┐
                    │       Express.js (Port 3000)          │
                    │  ┌─────────────┐ ┌─────────────────┐ │
                    │  │ Static Files│ │   API Routes    │ │
                    │  │  (dist/)    │ │  /api/* /auth/* │ │
                    │  └─────────────┘ └────────┬────────┘ │
                    │                           │          │
                    │    PM2 Process Manager     │          │
                    └───────────────────────────┬──────────┘
                                                │
                                                ▼
                    ┌──────────────────────────────────────┐
                    │      PostgreSQL (Port 5432)           │
                    │   Row-Level Security per Tenant       │
                    │   FORCE RLS on all tables             │
                    └──────────────────────────────────────┘
```

### Security Layers

1. **Network:** EC2 Security Group (firewall)
2. **Transport:** HTTPS/TLS via Let's Encrypt
3. **Application:** Helmet security headers, CORS, rate limiting
4. **Authentication:** JWT + httpOnly secure cookies + token rotation
5. **Authorization:** Role-based (super_admin > admin > member)
6. **Data:** PostgreSQL Row-Level Security — FORCE RLS on all tables
7. **Encryption:** AES-256-GCM for stored tokens (GitHub PAT, GitLab PAT, Slack webhooks)
8. **Tenant Isolation:** Database-level — bare queries return 0 rows without context
