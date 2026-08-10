# Project Structure

Every folder in the platform — why it exists, what belongs there, what should never go there.

**Working directory:** `C:\Users\likhi\Downloads\FL\platform\`

---

## Root Level

```
platform/
├── CLAUDE.md                    ← AI coding rules (read before writing any code)
├── CLAUDE_ONBOARDING.md         ← First document every Claude reads
├── ONBOARDING.md                ← Team onboarding (human-focused)
├── README.md                    ← Project overview
├── package.json                 ← Frontend dependencies and scripts
├── vite.config.ts               ← Vite build configuration
├── tsconfig.json                ← TypeScript configuration (strict mode)
├── tailwind.config.ts           ← Tailwind CSS v4 configuration
├── app.config.ts                ← TanStack Start application configuration
├── .env.local                   ← Local environment variables (NOT committed)
├── ghg-proxy.php                ← CORS proxy (deployed separately to public_html/)
```

**What goes at root:** Only configuration files and entry-point documents. Not source code, not scripts, not data.

**What does NOT go at root:** Application code, documentation (goes in `docs/`), scripts (go in `scripts/`), assets (go in `public/`).

---

## `src/` — Frontend Source Code

The React 19 SPA. Every file here compiles into `dist-static/`.

### `src/routes/` — Page Components

All 26 application routes. TanStack Router uses file-based routing from this directory.

| File pattern | Purpose |
|---|---|
| `__root.tsx` | Root layout, providers |
| `index.tsx` | Login page (`/`) |
| `forgot-password.tsx` | Forgot password (`/forgot-password`) |
| `reset-password.tsx` | Reset password (`/reset-password`) |
| `onboard.tsx` | New client onboarding wizard (`/onboard`) |
| `_app.tsx` | Authenticated layout wrapper — wraps all `_app.*` routes |
| `_app.[name].tsx` | Authenticated page routes (26 total) |

**What goes here:** One file per route. Route files contain page-level components and their immediate child components. They consume hooks from `src/lib/api.ts` — they do not contain raw fetch calls.

**What does NOT go here:** Shared components (go in `src/components/`), utilities (go in `src/lib/`), types (go in `src/data/`).

### `src/components/` — Shared Components

Reusable UI components used across multiple routes.

| File | Purpose |
|---|---|
| `portal.tsx` | Core layout: `PageHeader`, `PageBody`, `StatCard`, `Section` |
| `DeecarbAI.tsx` | AI chat widget (uses `backend/api/ai.php`) |
| `decarb/shared.tsx` | `ScenarioProvider`, `useDecarbActions()` — decarb planning state |
| `ui/` | shadcn/ui generated components — do not edit manually |

**What goes here:** Components used by 2+ routes. No page-specific components.

### `src/lib/` — Utilities and Hooks

| File | Purpose |
|---|---|
| `auth.ts` | `authFetch()`, `loginDemo()`, `logout()`, role utilities |
| `api.ts` | **ALL React Query hooks** — the data layer |
| `client-context.tsx` | `ClientContextProvider`, `useClientContext()` |
| `entity.tsx` | `EntityProvider`, `FiscalYearProvider`, entity/year switchers |
| `ghg-config.ts` | Apps Script integration, `GHG_WEBAPP_URL`, live mode flag |

**What goes here:** Business logic, API communication, shared React contexts. Not UI components.

### `src/data/` — Platform Constants and Types

| File | Purpose |
|---|---|
| `master.ts` | Platform-wide constants, TypeScript interfaces, CLUSTERS taxonomy |
| `datasets.ts` | Generic dataset registry (dataset IDs, names, tags) |

**What goes here:** Constants and types that are platform-wide (not client-specific). No client data, no hardcoded client values.

### `src/server.ts` — Server Entry Point

TanStack Start server entry. Do not modify unless instructed — framework-managed.

---

## `backend/` — PHP REST API

### `backend/api/` — REST Endpoints

Every file here is a REST endpoint. Pattern: `dolphin_require_auth()` → logic → `dolphin_send_json()`.

| File/Folder | Purpose |
|---|---|
| `db.php` | Database connection, auth, helpers — included by every endpoint |
| `context.php` | Returns full `ClientContext` to the frontend on login |
| `ai.php` | Groq API proxy (server-side, keys never sent to browser) |
| `submit.php` | Data submission with Google Drive file upload |
| `submissions.php` | Submission history queries |
| `audit-log.php` | Audit log queries |
| `metrics.php` | Computed metrics GET/POST |
| `users.php` | User management (create, list) |
| `forgot-password.php` | Password reset email trigger |
| `send-notification.php` | Notification digest email sender |
| `Smtp.php` | SMTP mailer class |
| `GoogleDrive.php` | Google Drive API client |
| `review.php` | Submission review (approve/reject) |
| `decarb/` | Decarbonization endpoints (actions, assets) |
| `credits/` | Renewable credits endpoints (I-REC, grid MWh) |
| `ghg/` | GHG inventory data endpoints |

**What goes here:** REST API endpoints only. One resource per file. Each file handles GET/POST/PATCH as needed with method checks at the top.

**What does NOT go here:** Business logic shared across endpoints (put in `db.php` helpers), configuration (put in environment variables), static assets.

### `backend/api/db.php` — The Foundation

Every PHP endpoint includes this file. Contains:
- `dolphin_db()` — returns PDO connection
- `dolphin_require_auth()` — validates bearer token, returns `[client_id, role, entity_scope, ...]`
- `dolphin_send_json($data, $status)` — sends JSON response and exits
- `dolphin_config()` — returns platform configuration
- `dolphin_json_body()` — parses JSON request body

---

## `database/` — Schema and Migrations

| File/Folder | Purpose |
|---|---|
| `schema_combined.sql` | **Authoritative schema** — 31 tables, single source of truth |
| `migrations/` | Sequential migration scripts — run in order |
| `seed/` | Seed data for demo and initial setup |

**What goes here:** SQL schema files and migration scripts only.

**Naming convention for migrations:** `NNN_description.sql` where NNN is a zero-padded sequence number (e.g., `001_migrate_legacy_roles.sql`, `002_client_config_comms_keys.sql`).

**Critical rule:** Always write a migration script before changing `schema_combined.sql`. Run the migration on prod first, then update schema_combined.sql to match.

---

## `docs/` — All Project Documentation

```
docs/
├── IMPLEMENTATION_BACKLOG.md    ← 6-Epic implementation plan (read before coding)
├── IMPLEMENTATION_BACKLOG.html  ← Interactive HTML version of the backlog
├── SESSION_HANDOFF.md           ← Current state and next steps (update each session)
├── PROJECT_CHARTER.md           ← Vision, mission, principles
├── PROJECT_CONTEXT.md           ← Full project state and history
├── TEAM_GUIDELINES.md           ← Coding and review guidelines
├── DECISION_LOG.md              ← Architecture and product decisions
├── PROJECT_STRUCTURE.md         ← This file
├── DOCUMENT_INDEX.md            ← Master index of all documents
├── PROJECT_MEMORY.md            ← AI-specific context
├── ARCHITECTURE.md              ← Technical architecture deep-dive
├── DATABASE_SCHEMA.md           ← All 31 tables documented
├── API_MAP.md                   ← All REST endpoints
├── BUSINESS_RULES.md            ← GHG calculation rules
├── COMPONENT_MAP.md             ← Frontend component reference
├── CUSTOMER_CONFIGURATION.md    ← How to onboard a new client
├── CHANGELOG.md                 ← History of changes (newest first)
├── TODO.md                      ← Remaining work items
├── DEPLOYMENT_GUIDE.md          ← Deployment instructions
├── AUTOMATIONS.md               ← Google Apps Script automation docs
├── DATA_MODEL.md                ← Data models and flows
├── MULTI_TENANT_READINESS.md    ← Multi-tenant analysis
├── PROJECT_HEALTH_REPORT.md     ← Health scores and roadmap
├── ADRs/                        ← Architecture Decision Records
│   ├── ADR-001-multi-client-platform.md
│   ├── ADR-002-php-backend-deployment.md
│   └── ADR-003-static-spa-deployment.md
├── market-research/             ← Competitive market analysis (7 documents)
│   ├── MARKET_RESEARCH.md
│   ├── COMPETITOR_PROFILES.md
│   ├── INDUSTRY_BEST_PRACTICES.md
│   ├── INDUSTRY_COMMON_MISTAKES.md
│   ├── MARKET_GAPS.md
│   ├── EMERGING_TRENDS.md
│   └── DESIGN_PATTERNS.md       ← Includes "what would we build differently" vision
└── reference/                   ← Reference PDFs and Excel files
    └── Sustainability_Reporting_Platform_Feasibility_v2.pdf
```

**What goes here:** All documentation. No source code, no test data, no large binary files.

**What does NOT go here:** Application code, environment files, build outputs.

---

## `automation/` — Google Apps Script and Report Generator

| File | Purpose |
|---|---|
| `Code.gs` | Daily GHG automation cycle (Day 0–8); deployed to Google Apps Script |
| `generate_ghg_report.js` | Node.js GHG inventory report generator; run locally by consultant |
| `package.json` | Node.js dependencies for the report generator |

**What goes here:** Automation scripts that run outside the main application (Google Apps Script, standalone Node.js tools).

**What does NOT go here:** Application backend code (goes in `backend/`), build scripts (go in `scripts/`).

---

## `public/` — Static Assets

Static files served directly by Vite.

| Path | Purpose |
|---|---|
| `public/deepwoods-logo.png` | Platform logo |
| `public/favicon.ico` | Browser tab icon |
| `public/templates/` | Excel templates for client data collection |
| `public/vault-docs/` | Pre-loaded vault documents (Featherlite GHG reports) |

**What goes here:** Images, fonts, downloadable files that are referenced by URL in the application.

**What does NOT go here:** Processed assets (they go through Vite), source code, environment files.

---

## `scripts/` — Build and Deployment Scripts

| File | Purpose |
|---|---|
| `build-static.mjs` | Builds Hostinger-deployable `dist-static/` bundle |
| `sync-master-sheet.py` | Syncs GHG master sheet from `data-sources/` |

**What goes here:** Build, deployment, and data processing scripts.

---

## `data-sources/` — Raw Data Files

| File | Purpose |
|---|---|
| `GHG_Master_Sheet_Featherlite.xlsx` | Source GHG data for Featherlite |

**What goes here:** Raw source data files used by automation scripts. Not application data.

---

## `_archive/` — Superseded Files

Old prompts, superseded docs, Lovable-era files. Do not reference in application code.

**Never add new files here** — if something is obsolete, delete it. This folder exists only for historical reference of files from before the current architecture.

---

## `dist-static/` — Build Output

Generated by `npm run build:fresh`. Upload contents (not the folder itself) to Hostinger `public_html/`.

**Never commit this folder** — it's in `.gitignore`.

---

## `.claude/` — AI Assistant Configuration

Claude Code project settings. Contains hooks configuration and memory files.

**Do not manually edit** unless configuring Claude Code behavior.
