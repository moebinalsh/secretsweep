# SecretSweep

**Enterprise-grade secret scanning for GitHub & GitLab**

SecretSweep continuously scans your repositories for exposed API keys, credentials, tokens, and secrets — helping security teams detect, track, and remediate vulnerabilities before they become breaches.

---

## Features

**Scanning**
- 50+ secret detection patterns (AWS keys, GitHub PATs, Stripe keys, database URIs, JWT secrets, and more)
- Full organization and selective repository scanning
- GitHub and GitLab support (including self-hosted instances)
- Scheduled scans (daily, weekly, monthly)
- Background execution — scans run even when you close the browser

**Security & Isolation**
- Complete multi-tenant isolation with PostgreSQL Row-Level Security (FORCE RLS)
- Three-tier access: Super Admin > Org Admin > Member
- AES-256-GCM encryption for all stored tokens
- JWT authentication with secure httpOnly cookie refresh tokens
- Invite-only registration — no public sign-ups

**Remediation**
- One-click remediation validation against live repository code
- Auto-resolve confirmed fixes, auto-reopen regressions
- Finding status tracking: Open, Acknowledged, Remediated, False Positive
- Deduplication across multiple scans

**Reporting & Alerts**
- Real-time Slack notifications for findings, scan completion, and failures
- Professional PDF reports with branded header, charts, and full findings table
- Styled Excel (.xlsx) exports with severity color-coding and auto-filters
- Interactive dashboard with severity breakdown, status distribution, and trend charts

**Administration**
- Super admin panel for managing customer organizations
- Organization limits (users, repos, scans per month)
- Contact/demo request management with Slack notifications
- Full audit log with human-readable descriptions
- Team management with password resets and activity tracking

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Recharts, Lucide Icons |
| Backend | Node.js, Express.js |
| Database | PostgreSQL 16 with Row-Level Security |
| Auth | JWT + httpOnly cookies + bcrypt |
| Encryption | AES-256-GCM (crypto module) |
| Process | PM2 (production), Concurrently (dev) |
| Proxy | Nginx + Let's Encrypt SSL |

---

## Quick Start (Local Development)

```bash
# Clone
git clone https://github.com/yourusername/secretsweep.git
cd secretsweep

# Install
npm install

# Database
psql postgres -c "CREATE USER secretsweep_app WITH LOGIN PASSWORD 'changeme';"
psql postgres -c "CREATE DATABASE secretsweep OWNER secretsweep_app;"

# Environment
cp .env.example .env
# Edit .env — generate secrets with:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Migrate
node server/db/migrate.js

# Create super admin
node server/create-admin.js

# Run
npm run dev
# Open http://localhost:5173
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for full local setup and production deployment guide.

---

## Production Deployment

Full step-by-step guide for AWS EC2 with custom domain and SSL:

**[DEPLOYMENT.md](DEPLOYMENT.md)**

Covers: EC2 setup, PostgreSQL, Nginx reverse proxy, Let's Encrypt SSL, PM2 process management, database backups, monitoring, and troubleshooting.

---

## Project Structure

```
secretsweep/
├── server/                    # Backend
│   ├── index.js               # Express app entry point
│   ├── scanner.js             # Secret scanning engine
│   ├── github.js              # GitHub API client
│   ├── gitlab.js              # GitLab API client
│   ├── patterns.js            # 50+ secret detection patterns
│   ├── routes/                # API endpoints
│   │   ├── auth.js            # Login, register, invite, refresh
│   │   ├── scans.js           # Scan CRUD + SSE streaming
│   │   ├── findings.js        # Findings, stats, remediation validation
│   │   ├── github.js          # GitHub connection management
│   │   ├── gitlab.js          # GitLab connection management
│   │   ├── integrations.js    # Slack webhook integrations
│   │   ├── schedules.js       # Scheduled scan management
│   │   ├── users.js           # User/profile management
│   │   ├── superAdmin.js      # Super admin org/user management
│   │   ├── auditLogs.js       # Audit log queries + export
│   │   └── contact.js         # Demo request form handler
│   ├── middleware/
│   │   └── auth.js            # JWT extraction, requireAdmin, requireSuperAdmin
│   ├── lib/
│   │   ├── scanManager.js     # Background scan execution engine
│   │   ├── scheduler.js       # Cron-based scan scheduler
│   │   ├── notifications.js   # Slack notification sender
│   │   ├── crypto.js          # AES-256-GCM encrypt/decrypt
│   │   ├── jwt.js             # Token signing/verification
│   │   ├── audit.js           # Audit logging
│   │   ├── limits.js          # Org quota enforcement
│   │   └── mask.js            # Secret masking for display
│   ├── db/
│   │   ├── pool.js            # DB connection pool + tenant context
│   │   ├── migrate.js         # Migration runner
│   │   └── migrations/        # 14 SQL migrations
│   └── create-admin.js        # CLI: create super admin
├── src/                       # Frontend (React)
│   ├── App.jsx                # Routing + theme
│   ├── pages/                 # Page components
│   │   ├── LandingPage.jsx    # Marketing landing page
│   │   ├── LoginPage.jsx      # Authentication
│   │   ├── DashboardPage.jsx  # Main dashboard with charts
│   │   ├── NewScanPage.jsx    # Start scans + schedules
│   │   ├── ScanDetailPage.jsx # Live scan progress + results
│   │   ├── FindingsPage.jsx   # Cross-scan findings browser
│   │   ├── SettingsPage.jsx   # GitHub/GitLab/Slack config
│   │   ├── TeamPage.jsx       # Team management
│   │   ├── SuperAdminPage.jsx # Org management + limits
│   │   └── AuditLogPage.jsx   # Activity log viewer
│   ├── components/            # Reusable UI components
│   ├── lib/                   # Utilities, CSV/Excel/PDF generators
│   └── assets/                # Logo images
├── DEPLOYMENT.md              # Full deployment guide
├── Dockerfile                 # Production Docker build
└── docker-compose.yml         # Docker Compose (DB + app)
```

---

## Security Architecture

```
Request → Nginx (SSL) → Express → PostgreSQL (RLS)
```

- **FORCE Row-Level Security** on all tenant tables — even the table owner can't bypass
- **Three context levels:**
  - `withTenant(orgId)` — scoped to one organization
  - `withSystemContext()` — for auth operations (login, token refresh)
  - `withSuperAdminContext()` — for cross-org admin operations
- **Bare queries return 0 rows** — a code bug that forgets tenant context can't leak data
- All stored secrets (GitHub PAT, GitLab PAT, Slack webhooks) encrypted with AES-256-GCM

---

## License

Proprietary. All rights reserved.
