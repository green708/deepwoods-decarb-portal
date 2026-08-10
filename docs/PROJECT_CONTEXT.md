# Project Context

> **For a new Claude:** After reading `CLAUDE_ONBOARDING.md`, read this file. It tells you the full story of where this project is, how it got here, and what matters right now.

---

## What This Project Is

The **Decarb Platform** is the digital delivery platform through which Deepwoods Green provides sustainability consulting services to client organizations. It is a multi-tenant web application for GHG accounting, decarbonization planning, and ESG data management.

**Deepwoods is the sole operator.** Client organizations access the platform as part of their consulting engagement with Deepwoods — they do not purchase or self-serve the platform independently. The platform is not operated by any other consulting firm.

It is **not** just a reporting tool. The long-term vision is to be the full delivery infrastructure for Deepwoods' consulting practice — covering data collection, measurement, planning, project management, action tracking, and client collaboration.

---

## Why It Exists

Deepwoods Green is a sustainability consulting firm that was doing all its client work in spreadsheets and custom Excel models. When they onboarded Featherlite (a large Indian manufacturing company), they built a web portal to replace the manual process. That portal became the foundation of this platform.

The platform exists so that Deepwoods can deliver more consulting engagements at higher quality, with less manual work per client. Each new capability should make Deepwoods more effective at helping clients measure, plan, and reduce emissions — not add complexity for its own sake.

---

## Timeline of Major Milestones

| Date | Milestone |
|---|---|
| 2026-05 | Portal v1 built for Featherlite on Lovable.dev (hardcoded, single-tenant) |
| 2026-06-25 | FP GHG Inventory Report FY26 delivered to client |
| 2026-07 | Multi-client architecture designed; DB schema rewritten with client_id on all tables |
| 2026-07 | Added Dolphin Die Cast and Navitas demo seed data |
| 2026-08-06 | Full repository reorganization: `decarb/` → `platform/`, docs/ created |
| 2026-08-06 | Client name removal sprint: all hardcoded Featherlite references removed from routes |
| 2026-08-06 | Platform Stabilization Sprint 1: TypeScript errors 99 → 18 |
| 2026-08-06 | Platform Foundation Complete: TypeScript errors 18 → **0** |
| 2026-08-06 | Final Pre-Implementation Inspection: score 53/100, conditional GO for current client |
| 2026-08-06 | Release Blocker Sprint 1 (Security): HP-1, cross-tenant auth, submit.php hardcoding |
| 2026-08-07 | Final Release Readiness Inspection: NO-GO verdict, 15 confirmed blockers |
| 2026-08-07 | Implementation Backlog: 15 blockers → 6 Epics, ~13–14 days |
| 2026-08-07 | Market Research: 7 documents, 25 competitors profiled |
| 2026-08-07 | Documentation Handoff: this set of documents |

---

## Current Architecture

### System Overview

```
Browser (React 19 SPA)
    ↓ authFetch() with Bearer token
PHP 8 REST API (Hostinger)
    ↓ dolphin_require_auth()
MySQL Database
    ↓ all queries filtered by client_id
31-table multi-tenant schema
```

### Frontend Architecture

- **Framework**: TanStack Start — React 19 SPA compiled to static files
- **Routing**: TanStack Router — file-based, 26 routes in `src/routes/`
- **Data**: TanStack Query v5 — all hooks in `src/lib/api.ts`
- **Auth**: Bearer token in localStorage, `authFetch()` wrapper adds header automatically
- **Client context**: `useClientContext()` returns full client config, entities, reporting years, targets
- **Build output**: `dist-static/` — pure static files, uploaded to Hostinger

### Backend Architecture

- **Language**: PHP 8.x
- **Pattern**: Thin REST endpoints — each file handles one resource
- **Auth**: `dolphin_require_auth()` in `db.php` validates Bearer token, returns user+client context
- **DB access**: PDO + prepared statements throughout — no raw string interpolation
- **Multi-tenancy**: Every query filters by `$authUser['client_id']` from the auth session

### Database Architecture

- **31 tables** in a single schema (not per-client schemas)
- Multi-tenancy via `client_id INT NOT NULL FK → clients(id)` on every data table
- Authoritative schema: `database/schema_combined.sql`
- Key tables: `clients`, `client_entities`, `client_config`, `users`, `submissions`, `ghg_inventory`, `decarb_actions`, `vault_documents`, `priority_items`

### Infrastructure

- **Hosting**: Hostinger shared hosting (PHP 8 + MySQL)
- **Domain**: sustainablyyours.me (Featherlite subdomain: featherlite.sustainablyyours.me)
- **Frontend**: Static files uploaded to `public_html/`
- **Backend**: PHP files in `public_html/backend/api/`
- **CORS proxy**: `ghg-proxy.php` in `public_html/` (for Google Apps Script communication)
- **No CDN**, no Docker, no CI/CD pipeline — manual upload via FTP/Hostinger file manager

---

## Current Implementation State

### What Works End-to-End

- Complete Featherlite GHG inventory dashboard (all scopes, all FYs)
- Data submission wizard with Google Drive file upload
- Decarbonization action plan and scenario builder (UI only — ScenarioProvider bug F-2 blocks live data)
- Progress tracking against SBTi targets
- Peer benchmarking page (rendering bug F-1 — all cards blank)
- Green Finance (carbon P&L) page (crash bug D-1 — non-FY22 base year)
- Document vault (upload modal is a no-op — bug F-3)
- Priority actions and email notification settings
- Audit log and submission history
- DeecarbAI chat widget (working — keys now server-side)
- Admin console (rendering — all tabs show hardcoded dummy data, not live API)
- Onboarding wizard (7 steps work in UI — zero backend integration)
- Auth system (login, logout, password reset, demo mode)
- Methodology reference page (static — shows only Featherlite content)

### What Does NOT Work

See `docs/IMPLEMENTATION_BACKLOG.md` for full details. Summary:

| Area | Status |
|---|---|
| Creating a second client | ❌ Admin console and onboard wizard have zero API integration |
| User role management | ❌ `users.php` has wrong `$validRoles`; legacy ENUM values cause silent logout |
| Email branding | ❌ All emails say "Featherlite GHG Portal" regardless of client |
| Methodology page | ❌ Entirely static Featherlite content |
| Analytics base years | ❌ Five pages hardcode FY22/FY24 — Client B with FY23 base gets wrong data |
| Progress milestones | ❌ Featherlite SBTi dates hardcoded |
| Decarb endpoints | ❌ `$entity !== 'FL'` hardcoded in 4 PHP files |
| Peer benchmarking | ❌ All cards blank (FY key format mismatch) |
| Scenario planning | ❌ Levers always empty (ScenarioProvider uses `[] as Action[]`) |
| Vault upload | ❌ Submit button is a no-op (no API call) |
| Green Finance | ❌ Crashes for any client without FY22 data |

---

## Current Limitations

1. **No automated deployment** — builds are manually uploaded to Hostinger
2. **No test suite** — TypeScript check + manual testing only
3. **Hostinger shared hosting constraints** — no background jobs, limited PHP config, no Node.js
4. **No CI/CD** — no automated build, lint, or test on push
5. **Single database** — no staging/production separation
6. **No monitoring** — no error tracking, no performance monitoring
7. **Legacy ENUM values** — `featherlite_team`, `featherlite_leadership`, `automation_demo` still in DB (Epic 1 removes them)
8. **Groq API keys still hardcoded in PHP as fallbacks** — should move to env vars before open-sourcing (post-launch concern)
9. **No mobile optimization** — desktop-only currently

---

## Current Priorities

In order. Do not skip ahead — each Epic unblocks the next.

1. **Epic 1: Auth & Role Foundation** (1 day)
   - Remove legacy roles from `users.role` ENUM
   - Migrate existing users to generic roles
   - Fix `users.php $validRoles`
   - Files: `database/schema_combined.sql`, `database/migrations/001_migrate_legacy_roles.sql`, `backend/api/users.php`

2. **Epic 2: Client Provisioning** (5 days)
   - Create `backend/api/clients.php` CRUD endpoint
   - Wire `src/routes/onboard.tsx` to API
   - Connect `src/routes/_app.admin.tsx` to live data

3. **Epic 3: White-Label Communications** (2 days)
   - `backend/api/forgot-password.php`, `Smtp.php`, `send-notification.php`

4. **Epic 4: Consolidated Entity Logic** (0.5 day)
   - 4 PHP files: `decarb/actions.php`, `decarb/assets.php`, `credits/irec.php`, `credits/grid-mwh.php`

5. **Epic 5: Per-Client Config & Analytics** (3 days)
   - 6 frontend pages + `context.php`

6. **Epic 6: Product Bug Fixes** (2 days)
   - Peer FY keys, ScenarioProvider, vault upload, Green Finance guard

---

## Related Documents

| Document | When to Read |
|---|---|
| `CLAUDE_ONBOARDING.md` | First document every session |
| `docs/IMPLEMENTATION_BACKLOG.md` | Before working on any Epic |
| `docs/SESSION_HANDOFF.md` | At the start of each session |
| `docs/DECISION_LOG.md` | When wondering why something was built a certain way |
| `docs/ARCHITECTURE.md` | Deep technical architecture questions |
| `docs/market-research/DESIGN_PATTERNS.md` | Product vision and long-term direction |
