# Decarb Platform — Claude Onboarding Guide

**READ THIS BEFORE TOUCHING ANY FILE.**
This is the first document every Claude account assigned to this project must read. It covers everything you need to work effectively without prior conversation history.

---

## What Is This Project?

The **Decarb Platform** is a multi-tenant SaaS GHG Accounting and Decarbonization Planning portal built and operated by **Deepwoods Green**, a sustainability consulting firm based in India. It enables organizations to:

- Collect and manage Scope 1, 2, and 3 GHG emissions data across facilities and entities
- Visualize emissions trends, benchmarks, and year-over-year changes
- Plan, track, and model decarbonization actions and scenarios
- Generate regulatory-ready GHG inventory reports
- Submit data through a structured wizard with Google Drive file storage
- Access AI-powered guidance (via Groq/LLaMA 3.3 70B, server-side proxy)

The platform was originally built specifically for **Featherlite**, an Indian manufacturing company. It is now being productized to serve **multiple clients without any code changes per client**.

---

## Business Context

| Entity | Role |
|---|---|
| **Deepwoods Green** | Sustainability consulting firm; owns and operates the platform |
| **Featherlite** | First client; Indian manufacturing company (Rajanakunte + Hejjala facilities) |
| **Who Deepwoods serves** | Organizations engaged for sustainability consulting — currently Featherlite, expanding to more Deepwoods clients |
| **Immediate goal** | Onboard a second Deepwoods client without code changes |
| **Long-term goal** | Deepwoods' full consulting delivery infrastructure — the platform through which every Deepwoods engagement is managed and delivered |

The platform exists because sustainability consulting work was entirely manual (spreadsheets, PDFs). Deepwoods built this first for Featherlite, then realized it could be the foundation of a product.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | TanStack Start (React 19 SPA) | File-based SSR at build time; entry: `src/server.ts` |
| Router | TanStack Router | 26 route files in `src/routes/` |
| Data fetching | TanStack Query v5 | All hooks in `src/lib/api.ts` |
| UI | shadcn/ui + Tailwind CSS v4 | Custom components in `src/components/` |
| Charts | Recharts | Used across all analytics pages |
| Backend | PHP 8 REST API | All endpoints in `backend/api/` |
| Database | MySQL | 31 tables; authoritative schema: `database/schema_combined.sql` |
| Hosting | Hostinger shared hosting | PHP + MySQL; no Node.js server in production |
| Build | Vite 8 + Nitro | `npm run build:fresh` → `dist-static/` (upload to Hostinger) |
| AI | Groq API (LLaMA 3.3 70B) | Server-side proxy: `backend/api/ai.php` |
| Automation | Google Apps Script | Daily GHG data cycle; entry: `automation/Code.gs` |

---

## The Most Important Rule

> **Never hardcode client-specific values anywhere in the codebase.**

This is a multi-tenant platform. Hardcoding a client name, entity code, or facility name breaks multi-tenancy silently — it works for the current client but produces wrong results for every future client.

### Explicitly Banned

| What | Why banned |
|---|---|
| `"Featherlite"`, `"featherlite"` | Client name — comes from DB |
| `"FL"`, `"FP"`, `"FOS"` | Entity codes — come from `ctx.entities` |
| `=== "FL"` (consolidated check) | Use `ctx.entities.find(e => e.is_consolidated)?.code` |
| `"Rajanakunte"`, `"Hejjala"` | Facility names — come from DB |
| `"FY22"`, `"FY24"` (as literals) | Base years — come from `ctx.targets.s12_base_year` |
| `'featherlite'` default slug | Client slug — comes from `$authUser['client_id']` |
| `1150`, `0.042` (magic numbers) | Emission targets — come from `ctx.targets` |
| Groq API keys in frontend code | Security — use `backend/api/ai.php` proxy |
| `?client_slug=` in any PHP endpoint | Security — use `$authUser['client_id']` from session |

### What to Use Instead

```typescript
// Entity codes
const entities = useClientContext().entities
const consolidated = entities.find(e => e.is_consolidated)?.code

// Base year
const baseYear = ctx.targets.s12_base_year ?? ctx.reporting_years[0]

// Client name
ctx.client.name

// Logo
ctx.client.logo_url  // or CSS var(--primary)
```

```php
// Client ID in PHP — always from auth, never from request
$authUser = dolphin_require_auth();
$clientId = $authUser['client_id'];  // NOT $_GET['client_slug']
```

---

## Current Status (2026-08-07)

### What Is Done

| Phase | Details |
|---|---|
| Platform Foundation | Complete — 0 TypeScript errors across all 26 routes and components |
| Sprint 1 Security | Complete — Groq keys server-side, cross-tenant auth fixed on 4 endpoints, submit.php hardcoding removed |
| Market Research | Complete — 7 documents in `docs/market-research/`, competitive analysis of 25 platforms |
| Documentation Handoff | Complete — all project knowledge captured in `docs/` |

### What Is NOT Done (6 Epics, ~13–14 days)

See `docs/IMPLEMENTATION_BACKLOG.md` for full details on each Epic.

| # | Epic | Effort | Key Blockers |
|---|---|---|---|
| 1 | **Auth & Role Foundation** | 1 day | CT-1 legacy roles + users.php validRoles — **START HERE** |
| 2 | Client Provisioning | 5 days | Onboard wizard zero API, admin console zero API |
| 3 | White-Label Communications | 2 days | "Featherlite GHG Portal" in all emails |
| 4 | Consolidated Entity Logic | 0.5 day | `$entity !== 'FL'` hardcoded in 4 PHP files |
| 5 | Per-Client Config & Analytics | 3 days | FY22/FY24 hardcoded in 5 pages, static methodology page |
| 6 | Product Bug Fixes | 2 days | Peer page blank, ScenarioProvider empty, vault no-op |

**Dependency order:** E1 → E2 → E3 → E5 → E6, and also E1 → E4 → E5.

---

## Multi-Tenant Architecture

Every table that stores client data has `client_id INT NOT NULL FK → clients(id)`.

### Auth Flow

```
Login → auth.php → JWT bearer token stored in localStorage
Every API call → authFetch() adds Bearer header
PHP: dolphin_require_auth() → validates token → returns {client_id, role, entity_scope, ...}
PHP: ALL queries filter by $authUser['client_id'] — never by caller-supplied param
```

### Frontend Context

```typescript
// Available everywhere via useClientContext()
interface ClientContext {
  client: { id, name, slug, logo_url }
  entities: ClientEntity[]          // {code, name, short, is_consolidated, sort_order}
  reporting_years: string[]         // ["FY22", "FY23", "FY24", "FY25", "FY26"]
  targets: { s12_base_year, s3_base_year, sbti_target_s12, ... }
  config: { grid_ef, consolidation_approach, portal_name, portal_url, ... }
}
```

### Entity Scope

Users with `entity_scope` set can only see data for their assigned entity. Users without entity_scope see all entities. The `$authUser['entity_scope']` field is respected in every scoped query.

---

## Auth Roles

| Role | Access |
|---|---|
| `sustainability_team` | Full portal — primary client role |
| `client_uploader` | Data submission only |
| `client_leadership` | Read-only |
| `deepwoods_admin` | All clients, admin pages |
| `deepwoods_coordinator` | All clients, coordinator |
| ~~`featherlite_team`~~ | LEGACY — migrate to `sustainability_team` (Epic 1) |
| ~~`featherlite_leadership`~~ | LEGACY — migrate to `client_leadership` (Epic 1) |
| ~~`automation_demo`~~ | LEGACY — delete or migrate (Epic 1) |

---

## Key Files to Know

| File | Purpose |
|---|---|
| `CLAUDE.md` | AI-specific coding rules — mandatory, read after this file |
| `docs/SESSION_HANDOFF.md` | **Read at start of every session** — current state and next priority |
| `docs/IMPLEMENTATION_BACKLOG.md` | 6-Epic plan with DoD, testing checklists, files affected |
| `src/lib/auth.ts` | `authFetch()`, `loginDemo()`, role utilities |
| `src/lib/api.ts` | Every React Query hook — the entire frontend data layer |
| `src/lib/client-context.tsx` | `ClientContextProvider`, `useClientContext()` |
| `src/lib/entity.tsx` | `EntityProvider`, `FiscalYearProvider`, entity/year switchers |
| `src/data/master.ts` | Platform-wide constants, type interfaces, CLUSTERS taxonomy |
| `backend/api/db.php` | `dolphin_db()`, `dolphin_require_auth()`, `dolphin_send_json()` |
| `backend/api/context.php` | Returns full `ClientContext` to the frontend |
| `database/schema_combined.sql` | Authoritative MySQL schema — 31 tables |
| `docs/ARCHITECTURE.md` | Full system architecture |
| `docs/DATABASE_SCHEMA.md` | All 31 tables documented |
| `docs/API_MAP.md` | All REST endpoints |
| `docs/CHANGELOG.md` | History of changes (newest first) |

---

## Development Workflow

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Start dev server (http://localhost:3000)
npm run dev

# 3. Type check — must be 0 errors before any commit
npx tsc --noEmit

# 4. Production build
npm run build:fresh
# → outputs to dist-static/

# 5. Deploy: upload dist-static/ contents to Hostinger public_html/
#    Also upload ghg-proxy.php separately (NOT in dist-static/)
```

**Demo mode:** `loginDemo()` sets `fl_demo_mode=1` in localStorage. `authFetch()` intercepts calls and returns local mock data. Use this for UI testing without a backend.

---

## Before Starting Each Session

1. Read `docs/SESSION_HANDOFF.md` — confirms what was last worked on and what's next
2. Run `npx tsc --noEmit` — confirm 0 errors (baseline)
3. Check `git status` — understand uncommitted state
4. Read the relevant Epic section in `docs/IMPLEMENTATION_BACKLOG.md`

---

## Things to Absolutely Avoid

1. **Hardcoding any client/facility/entity name** — breaks multi-tenancy, violates CLAUDE.md
2. **Taking `client_id` from request params** — security vulnerability, violates auth model
3. **Adding features beyond the current Epic scope** — stay focused, no scope creep
4. **Amending existing commits** — always create new commits
5. **Skipping `npx tsc --noEmit`** — TypeScript errors are blockers
6. **Adding comments explaining what code does** — only comment non-obvious WHY
7. **Creating documentation files unless asked** — no unsolicited READMEs
8. **Designing for hypothetical requirements** — only build what's in the current Epic
9. **Force-pushing to main/master** — always ask first
10. **Deleting files without confirming** — investigate before destroying

---

## Product Philosophy (Know This Before Designing Anything)

The market research (`docs/market-research/`) identified that most sustainability software fails because it is:
- Dashboard-addicted, not action-oriented
- Designed for compliance, not for climate action
- Enterprise-only pricing that excludes MSMEs
- Module-first (like an ERP) instead of workflow-first
- Consultant-as-afterthought (yet consultants do most of the real work)

**We are building differently:**
- Workflow-first: design around how sustainability work actually happens inside client organizations, and how Deepwoods manages that work
- Deepwoods-native: Deepwoods' consultants and coordinators are first-class users — portfolio management and engagement oversight matter as much as client-facing views
- Client-appropriate: genuinely useful to the organizations Deepwoods serves, without sacrificing methodological rigor
- Action-oriented: every number connects to a decision; every dashboard leads to an action
- Trust layer: methodology is transparent, audit trails are automatic, numbers are always explainable

**The six platform goals — evaluate every feature against these:**
1. Does this help Deepwoods manage more clients?
2. Does this improve consulting quality?
3. Does this reduce manual work for Deepwoods or for clients?
4. Does this improve client collaboration?
5. Does this help clients become carbon neutral?
6. Can the client understand what to do next without needing to contact Deepwoods?

Read `docs/market-research/DESIGN_PATTERNS.md` (the "If we were starting today" section) for additional product vision context.

---

## Recommended Reading Order

1. `CLAUDE.md` — coding rules (this file's shorter sibling)
2. `docs/SESSION_HANDOFF.md` — where we left off
3. `docs/IMPLEMENTATION_BACKLOG.md` — what to build next
4. `docs/PROJECT_CONTEXT.md` — full project state
5. `docs/DECISION_LOG.md` — why things are built the way they are
6. `docs/ARCHITECTURE.md` — deep technical architecture
7. `docs/market-research/DESIGN_PATTERNS.md` — product vision
