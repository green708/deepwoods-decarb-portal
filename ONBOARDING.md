# Onboarding Guide

Welcome to the Decarb Platform. This guide walks you through understanding the system,
setting up your development environment, building, deploying, and contributing.

---

## 1. Understand the system (30 minutes)

Read these documents in order:

1. **[README.md](README.md)** — What the platform does and how it's structured
2. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — System architecture, hosting model, data flow
3. **[docs/AUTOMATIONS.md](docs/AUTOMATIONS.md)** — The 7-day reporting automation cycle
4. **[docs/reference/Sustainability_Reporting_Platform_Feasibility_v2.pdf](docs/reference/Sustainability_Reporting_Platform_Feasibility_v2.pdf)** — Business vision and requirements
5. **[CLAUDE.md](CLAUDE.md)** — Conventions and critical no-hardcoding rules

### Mental model

```
CLIENT SUBMITS DATA
  └─ Data submission wizard (/submissions)
  └─ PHP API (backend/api/submit.php)
  └─ Files → Google Drive, records → MySQL

AUTOMATION CYCLE (Day 0–8)
  └─ Apps Script (automation/Code.gs)
  └─ Triggers: open cycle → reminders → compile → Claude draft → deliver

PORTAL VIEWS
  └─ React frontend (src/routes/)
  └─ PHP REST API (backend/api/)
  └─ MySQL database (database/schema_combined.sql)
```

---

## 2. Set up your development environment

### Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | ≥ 20 LTS | Frontend build |
| npm | ≥ 10 | Package management |
| PHP | 8.x | Local API testing (optional) |
| MySQL | 8.x | Local database (optional) |
| Git | any | Version control |

### Clone and install

```bash
git clone <REPOSITORY_URL>
cd platform
npm install
```

### Environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_GHG_WEBAPP_URL=   # Leave empty for demo mode
```

Backend secrets go in `backend/config.php`:
```bash
cp backend/config.php.example backend/config.php
# Edit config.php with real DB credentials, SMTP, Drive OAuth
```

### Database setup (for local API testing)

```bash
mysql -u root -p your_database < database/schema_combined.sql
```

Then edit `backend/config.php` to point to your local MySQL.

---

## 3. Run the development server

```bash
npm run dev
```

The app starts at `http://localhost:8080`. In demo mode (no `.env.local` config needed),
use the demo login on the login page to explore the UI with mock data.

For live data, configure `backend/config.php` pointing to a real MySQL instance.

---

## 4. Understand the codebase

### Frontend (src/)

```
src/routes/          Page components — one file per route
src/components/ui/   shadcn/ui components — don't modify these directly
src/components/      Platform-specific components (portal.tsx, DeecarbAI.tsx)
src/lib/api.ts       ALL React Query data fetching hooks
src/lib/auth.ts      Login, logout, authFetch(), demo mode
src/lib/client-context.tsx  Multi-tenant context provider
src/data/master.ts   Platform constants (IREC_FACTOR, CLUSTERS, type interfaces)
src/data/datasets.ts Generic dataset registry
```

### Backend (backend/api/)

```
auth_middleware.php   dolphin_require_auth() — call at the top of every endpoint
db.php               PDO connection ($pdo)
context.php          Returns ClientContext on login
ghg/                 Scope 1/2/3 endpoints
decarb/              Decarbonization endpoints
credits/             I-REC and grid MWh endpoints
```

### Key patterns

**Fetching data (React):**
```typescript
// Always use hooks from src/lib/api.ts
const { data: inventory } = useInventory();
const { data: facilities } = useFacilities();
```

**Multi-tenant context (React):**
```typescript
const ctx = useClientContext();
// ctx.client, ctx.entities[], ctx.reporting_years[]
const consolidated = ctx.entities.find(e => e.is_consolidated);
```

**Auth in PHP:**
```php
require_once __DIR__ . "/../auth_middleware.php";
$user = dolphin_require_auth(); // 401 if not logged in
// $user->client_id, $user->role
```

---

## 5. Build for production

```bash
npm run build:fresh
```

This runs: clean → vite build → build-static.mjs  
Output: `dist-static/` — ready for Hostinger upload.

**Build requirements:**
- Run from a bash shell (build script uses `/tmp` for Nitro output)
- Or set `NITRO_OUT=/your/path npm run build:fresh` to override

---

## 6. Deploy to Hostinger

1. **Upload `dist-static/`** contents to `public_html/` via FTP
2. **Upload `ghg-proxy.php`** from the repository root to `public_html/` separately
3. **Verify `backend/config.php`** is present on the server (not in `dist-static/`, lives in `public_html/backend/`)

```
public_html/
├── index.html          ← from dist-static/
├── assets/             ← from dist-static/
├── .htaccess           ← from dist-static/
├── ghg-proxy.php       ← uploaded separately from repository root
└── backend/            ← from dist-static/backend/
    ├── config.php      ← you created this from config.php.example
    └── api/
```

### First-time server setup

1. Run `database/schema_combined.sql` in phpMyAdmin
2. Visit `https://yourdomain.com/backend/seed-users.php` once to create the admin user
3. Delete `seed-users.php` from the server immediately after
4. Complete Drive OAuth via `https://yourdomain.com/backend/oauth-start.php`

---

## 7. Set up the automation layer

See **[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)** for the full Apps Script setup.

Quick overview:
1. Open Google Apps Script and create a new project
2. Paste the contents of `automation/Code.gs`
3. Set Script Properties (API key, Drive folder ID, Sheet ID)
4. Deploy as a web app — copy the URL
5. Add the URL to `VITE_GHG_WEBAPP_URL` in `.env.local`
6. Update `ghg-proxy.php` with the same URL

---

## 8. Contribute

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for coding standards, branch strategy, and PR conventions.

### Before your first commit

- Read `CLAUDE.md` — especially the no-hardcoding rules
- Read `docs/TODO.md` — understand open issues before adding more
- Check `docs/ARCHITECTURE.md` — make sure your change fits the architecture

### Key rules

- **Never hardcode client names or entity codes** — always use `useClientContext()`
- **Data comes from the DB** — never add static client data files to `src/data/`
- **All API calls go through `authFetch()`** — it handles auth and demo mode
- **New endpoints go in `backend/api/`** — follow the existing pattern with `dolphin_require_auth()`
