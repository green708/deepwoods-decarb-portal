# Architecture

## Overview

The Decarb portal is a **full-stack web application** deployed on Hostinger shared hosting. It consists of a React SPA frontend built with TanStack Start, served as a static file bundle, with a PHP/MySQL backend API co-located in the same deployment.

```
Browser
  └── Static SPA (React / TanStack Start)
        └── AJAX → backend/api/*.php (PHP 8 / Apache)
                    └── MySQL 8 (Hostinger DB: u833634340_decarb)
```

## Deployment Architecture

```
Hostinger public_html/
├── index.html              ← React app shell (SSR-generated once at build)
├── assets/                 ← JS/CSS bundles (hashed filenames)
├── .htaccess               ← Apache SPA fallback (all routes → index.html)
├── ghg-proxy.php           ← CORS proxy for Google Apps Script
└── backend/
    ├── api/                ← PHP API endpoints
    └── config.php          ← DB + OAuth + SMTP credentials (gitignored)
```

**Build command:**
```bash
npm run build:fresh
# Outputs to dist-static/ — upload entire dist-static/ to public_html/
```

The `build-static.mjs` script:
1. Runs the Nitro SSR server locally
2. Fetches `/` to capture the pre-rendered HTML shell
3. Copies Vite-built assets
4. Writes `.htaccess` for SPA routing
5. Bundles `backend/` PHP files into the output

## Frontend Architecture

### Framework: TanStack Start

TanStack Start provides:
- **File-based routing** via `src/routes/` — each `.tsx` file is a route
- **SSR** (Server-Side Rendering) at build time for the initial HTML shell
- **React Query** integration for server state management

### Route Structure

```
src/routes/
├── __root.tsx          ← Root layout (QueryClient, fonts, error boundaries)
├── index.tsx           ← Login page (/)
├── forgot-password.tsx ← (/forgot-password)
├── reset-password.tsx  ← (/reset-password?token=)
├── onboard.tsx         ← (/onboard) — new client wizard
└── _app.tsx            ← Authenticated layout (sidebar shell)
    ├── _app.workstreams.tsx
    ├── _app.overview.tsx
    ├── _app.dashboard.tsx
    ├── _app.inventory.tsx
    ├── _app.interactive-inventory.tsx
    ├── _app.hotspots.tsx
    ├── _app.action-plan.tsx
    ├── _app.progress.tsx
    ├── _app.peer.tsx
    ├── _app.green-finance.tsx
    ├── _app.credits.tsx
    ├── _app.reports.tsx
    ├── _app.reporting.tsx
    ├── _app.submissions.tsx
    ├── _app.vault.tsx
    ├── _app.methodology.tsx
    ├── _app.priority-actions.tsx
    ├── _app.notifications.tsx
    ├── _app.admin.tsx
    ├── _app.trends.tsx
    ├── _app.decarbonisation.tsx ← redirect to /hotspots
    └── _app.strategy.tsx        ← redirect to /action-plan
```

### Context Providers (in `_app.tsx`)

```
_app.tsx
├── ClientContextProvider  ← Fetches client/entity config from API once on login
├── EntityProvider         ← Global entity switcher (FP / FOS / FL) — localStorage
└── FiscalYearProvider     ← Global FY switcher (FY22–FY26) — localStorage
```

### Data Flow

```
Login
  └── POST /backend/api/login.php → session token stored in localStorage
        └── GET /backend/api/context.php → ClientContext (entities, years, config)
              ├── Stored in sessionStorage
              └── Available via useClientContext() hook
                    └── Individual pages call specific hooks:
                          useInventory() → GET /backend/api/ghg/inventory.php
                          useS1Breakdown() → GET /backend/api/ghg/s1.php
                          useDecarbAssets() → GET /backend/api/decarb/assets.php
                          etc.
```

### Key Source Files

| File | Role |
|---|---|
| `src/lib/auth.ts` | Login/logout/roles, demo mode, `authFetch()` wrapper |
| `src/lib/api.ts` | All React Query hooks (useInventory, useS1Breakdown, etc.) |
| `src/lib/client-context.tsx` | Multi-client context provider, `useClientContext()` |
| `src/lib/entity.tsx` | Entity + FY global state, `EntitySwitcher`, `FiscalYearSwitcher` |
| `src/lib/ghg-config.ts` | Apps Script integration config, `ghgPost()`, `ghgGet()` |
| `src/lib/submissionsStore.ts` | Submission API client (typed) |
| `src/components/portal.tsx` | Page layout primitives (`PageHeader`, `StatCard`, etc.) |
| `src/components/DeecarbAI.tsx` | Floating AI chat widget (Groq API) |

## Backend Architecture

### PHP REST API

The backend is a simple PHP REST API with no framework. All endpoints:
- Include `db.php` for the DB connection singleton and auth helpers
- Respond with JSON
- Use `Authorization: Bearer <token>` for authentication
- Allow CORS from any origin (production: same domain anyway)

```
backend/
├── api/                      ← PHP API endpoints
│   ├── db.php                ← PDO connection, dolphin_require_auth(), CORS headers
│   ├── auth_middleware.php   ← requireAuth() wrapper
│   ├── login.php / logout.php / me.php
│   ├── change-password.php / forgot-password.php / reset-password.php
│   ├── context.php           ← Returns full ClientContext for the logged-in user
│   ├── submit.php / submissions.php / review.php
│   ├── audit-log.php / users.php
│   ├── notification-prefs.php / send-notification.php
│   ├── datasets.php / methodology.php / vault.php
│   ├── peers.php / priority-items.php
│   ├── metrics.php
│   ├── ghg-api.php           ← Legacy monolithic GHG API (to be archived — see ARC-M3)
│   ├── debug_login.php       ← ⚠ Debug endpoint — review before deploying (see ARC-TD8)
│   ├── seed_featherlite.php  ← One-time Featherlite data seeder (not deployed)
│   ├── GoogleDrive.php       ← Google Drive OAuth2 upload class
│   ├── Smtp.php              ← PHPMailer wrapper
│   ├── ghg/                  ← Split GHG endpoints
│   │   ├── inventory.php     ← Full GHG inventory (all years) by entity
│   │   ├── s1.php            ← Scope 1 breakdown + by-facility
│   │   ├── s2.php            ← Scope 2 breakdown + by-facility
│   │   ├── s3.php            ← Scope 3 category summary
│   │   ├── intensity.php     ← Intensity metrics
│   │   └── facilities.php    ← Facility list
│   ├── decarb/
│   │   ├── actions.php       ← Decarbonisation action items
│   │   └── assets.php        ← Equipment/asset register
│   └── credits/
│       ├── irec.php          ← I-REC certificate register
│       └── grid-mwh.php      ← Grid MWh history
├── config.php                ← DB + OAuth + SMTP credentials (gitignored)
├── config.php.example        ← Config template (committed; no real credentials)
├── oauth-start.php           ← Google OAuth initiation
├── oauth-callback.php        ← Google OAuth callback; writes drive_token.json
├── schema_combined.sql       ← AUTHORITATIVE DB schema (31 tables; safe to re-run)
├── fix_password_hashes.sql   ← One-time migration for password hash format
├── seed-users.php            ← Generic user seeder helper
├── seed_featherlite.sql      ← Featherlite client data (entities, config, GHG data)
├── seed_dolphin_navitas.sql  ← Dolphin Navitas demo/test client data
└── patch_dolphin_navitas_config.sql ← Config patch for Dolphin Navitas client
```

**Note on `seed_dolphin_navitas.sql`:** "Dolphin Navitas" is a second test/demo client used for validating multi-tenant isolation. It is not a production client but exists in the DB for development testing.

### Database

MySQL 8 on Hostinger (`u833634340_decarb`).

**Authoritative schema:** `backend/schema_combined.sql` — 31 tables.

See `docs/DATABASE_SCHEMA.md` for the full schema reference.

**Multi-client design:** Every data table has a `client_id` foreign key. All queries are scoped to `client_id` from the authenticated user's session. No client can see another client's data.

### Authentication Flow

```
POST /login.php
  ← {email, password}
  → {token, role, mustChangePassword}

All subsequent requests:
  → Authorization: Bearer <token>
  ← dolphin_require_auth() validates token in sessions table
  ← Returns {id, email, role, client_id, entity_scope}
```

Session tokens:
- 64-character hex (32 random bytes)
- Stored in `sessions` table with `expires_at`
- Deleted on logout

## GHG Automation Integration

The portal integrates with a Google Apps Script web app for the Day 0–8 reporting cycle automation.

```
Portal → ghg-proxy.php (Hostinger) → Google Apps Script Web App
                                            ↓
                                     Google Drive (reports filing)
                                            ↓
                                     Gmail (client emails)
                                            ↓
                                     Google Sheet (Master_Index)
```

See `docs/AUTOMATIONS.md` for full details.

## CSS Theming

CSS variables defined in `src/styles.css`:
- `--primary` — injected at runtime from `client.primary_color` (DB)
- `--ghg-green` / `--accent` — `#1E6F5C` GHG green
- `--navy` — primary dark text
- `--muted` — light grey backgrounds

Tailwind v4 uses CSS variables throughout. Client branding is applied by updating `--primary` in `<style>` at runtime.

## Scalability Constraints

The current Hostinger shared hosting has limitations:
- No persistent PHP processes (stateless per-request)
- Limited concurrent connections
- Single MySQL instance
- No background job runner (cron via external trigger only)

For multi-tenant scale, migration to a VPS or managed PHP/MySQL hosting (Cloudways, Railway, etc.) is recommended. See `docs/MULTI_TENANT_READINESS.md`.
