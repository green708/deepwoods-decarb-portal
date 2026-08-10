# Decarb Platform — Project Knowledge

**Platform:** Generic multi-tenant GHG Accounting & Decarbonization Planning portal  
**Status:** Production workspace — the primary Claude Code workspace  
**Working directory:** `C:\Users\likhi\Downloads\FL\platform`  
**Full documentation:** `docs/` directory

## NEW TO THIS PROJECT?

**Read `CLAUDE_ONBOARDING.md` first** (in this directory). It is the complete onboarding guide — tech stack, multi-tenant rules, current status, key files, and what to avoid. After that, read `docs/SESSION_HANDOFF.md` to pick up from where the previous session left off.

---

## CRITICAL: No Hardcoding Rule

Never hardcode:
- Client names or slugs ("Featherlite", "featherlite", "FP", "FOS")
- Facility names ("Rajanakunte", "Hejjala", etc.)
- Entity codes as string literals — use `ctx.entities` from `useClientContext()`
- Consolidated entity check: use `ctx.entities.find(e => e.is_consolidated)?.code` — NEVER `=== "FL"`
- Logo or colour values — use `ctx.client.logo_url` and CSS variable `--primary`
- Apps Script URLs — use `VITE_GHG_WEBAPP_URL` env var
- GHG client IDs like `FL-FOS-GHG-FY26` — these come from the DB per client

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start (React 19 + SSR at build time) |
| Routing | TanStack Router — file-based, `src/routes/` |
| Data fetching | TanStack Query (React Query v5) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Charts | Recharts |
| Backend | PHP 8 + MySQL on Hostinger shared hosting |
| Build | Vite 8 + Nitro → `npm run build:fresh` → `dist-static/` |
| Deployment | Upload `dist-static/` + `ghg-proxy.php` to Hostinger `public_html/` |
| Automation | Google Apps Script (`automation/Code.gs`) + Node.js report generator |

---

## Auth Roles

| Role | Access |
|---|---|
| `sustainability_team` | Full portal — primary client role |
| `client_uploader` | Data submission only |
| `client_leadership` | Read-only |
| `deepwoods_admin` | All clients, admin pages |
| `deepwoods_coordinator` | All clients, coordinator |

**Demo mode:** `loginDemo()` sets `fl_demo_mode=1` in localStorage. All API calls are intercepted by `authFetch()` and served from local mocks.

> **Legacy roles still in DB:** `featherlite_team`, `featherlite_leadership`, `automation_demo` — must be migrated to generic roles. See `docs/TODO.md` CT-1.

---

## Key Files Quick Reference

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | Login/logout, roles, demo mode, `authFetch()` |
| `src/lib/api.ts` | All React Query hooks — this is the data layer |
| `src/lib/client-context.tsx` | `ClientContextProvider`, `useClientContext()` |
| `src/lib/entity.tsx` | `EntityProvider`, `FiscalYearProvider`, switchers |
| `src/lib/ghg-config.ts` | Apps Script integration, `ghgPost()`, `ghgGet()` |
| `src/lib/submissionsStore.ts` | Submission API client (ARC-M5: CLIENT_SLUG hardcoded) |
| `src/components/portal.tsx` | `PageHeader`, `PageBody`, `StatCard`, `Section` |
| `src/components/DeecarbAI.tsx` | AI chat (HP-1: Groq keys need server-side migration) |
| `src/data/master.ts` | Platform constants, type interfaces, CLUSTERS taxonomy |
| `src/data/datasets.ts` | Generic dataset registry |
| `database/schema_combined.sql` | Authoritative DB schema — 31 tables |
| `backend/api/context.php` | Returns full ClientContext on login |
| `scripts/build-static.mjs` | Builds Hostinger-deployable `dist-static/` bundle |
| `ghg-proxy.php` | CORS proxy — deployed manually to `public_html/` |

---

## Data Layer

All pages fetch data from the API via hooks in `src/lib/api.ts`. There are no
client-specific static data files in this workspace. The database is the
single source of truth.

Static data files that do NOT exist in this workspace:
- `src/data/featherlite.ts` — retired; all Featherlite data is in MySQL
- `src/data/decarb-data.ts` — retired; all decarbonization data is in MySQL

---

## Folder Map

```
platform/
├── src/          TanStack Start frontend (React 19)
├── backend/      PHP 8 REST API
├── database/     SQL schema files
├── automation/   Google Apps Script + report generator
├── docs/         All documentation
├── public/       Static assets (Vite convention)
├── scripts/      Build & deployment scripts
├── tests/        Test suite (placeholder — see TODO.md)
└── _archive/     Superseded files for reference
```

---

## GHG Automation

Full docs: `docs/AUTOMATIONS.md` and `docs/DEPLOYMENT_GUIDE.md`

Quick reference:
- **Apps Script:** `automation/Code.gs` — daily 9am trigger, Day 0–8 cycle
- **Report generator:** `automation/generate_ghg_report.js` — run locally by consultant
- **CORS proxy:** `ghg-proxy.php` must be in Hostinger `public_html/` (NOT in `dist-static/`)
- **Config:** `.env.local` → `VITE_GHG_WEBAPP_URL` → `src/lib/ghg-config.ts` → `GHG_LIVE` flag

---

## Build & Deploy

```bash
# Dev
npm install
npm run dev

# Deploy to Hostinger
npm run build:fresh         # → dist-static/
# 1. Upload dist-static/ contents to public_html/
# 2. Upload ghg-proxy.php to public_html/ (separate — not in dist-static/)
```

See `ONBOARDING.md` for full setup and `docs/DEPLOYMENT_GUIDE.md` for automation setup.

---

## Route Map

```
/                         Login
/forgot-password          Forgot password
/reset-password?token=    Reset password
/onboard                  New client onboarding wizard

/workstreams              Home — service cluster view
/overview                 KPI overview (Scope 1/2/3)
/dashboard                Carbon footprint dashboard
/inventory                Asset register
/interactive-inventory    Asset card view
/hotspots                 Emission hotspot analysis
/action-plan              Decarbonisation action plan
/progress                 Decarbonisation progress tracking
/peer                     Peer benchmarking
/green-finance            Carbon as P&L
/credits                  Renewables & I-RECs
/reports                  Report library
/reporting                Reporting cycle simulator (admin only)
/submissions              Data submission wizard
/vault                    Document vault
/methodology              GHG methodology reference
/priority-actions         Priority actions + email settings
/notifications            Automation notification feed
/admin                    Admin dashboard (Deepwoods roles only)
/trends                   Historical trends table
```

---

## Known Issues (prioritized)

1. **CT-1** — Legacy DB roles (`featherlite_team` etc.) not yet migrated to generic roles
2. **HP-1** — Groq API keys are client-side in `DeecarbAI.tsx` (security risk)
3. ~~**ARC-M5**~~ — Fixed 2026-08-06: `submissionsStore.ts` now accepts `clientSlug` parameter
4. ~~**CT-3**~~ — Fixed 2026-08-06: `_app.trends.tsx` crash resolved (YEARS/INV → `reporting_years`/`inv()`)

See `docs/TODO.md` for the complete list.

---

## Documentation

All project docs are in `docs/`:
- `docs/ARCHITECTURE.md` — system architecture and data flow
- `docs/DATABASE_SCHEMA.md` — all 31 tables
- `docs/API_MAP.md` — all REST endpoints
- `docs/AUTOMATIONS.md` — automation workflows
- `docs/BUSINESS_RULES.md` — GHG calculation rules
- `docs/DEPLOYMENT_GUIDE.md` — full deployment setup guide
- `docs/CUSTOMER_CONFIGURATION.md` — how to onboard a new client
- `docs/TODO.md` — remaining work
- `docs/CHANGELOG.md` — history
- `docs/reference/Sustainability_Reporting_Platform_Feasibility_v2.pdf` — business vision
