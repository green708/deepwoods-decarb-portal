# Changelog

Key milestones and changes. Newest first.

---

## 2026-08-09 — Aug 14 Alpha: Multi-Tenant Hardcoding Sweep + Request Access + Invite + Invoice

### Priority 1: Multi-tenant generalization — remaining hardcoding

**`src/routes/_app.green-finance.tsx`** (IMPLEMENTED — requires live testing)
- All 8 occurrences of hardcoded FY years (`["FY22","FY23","FY24","FY25"]`) replaced with dynamic `reporting_years` from `useClientContext()`
- `buildSlices(invData, intensityData, years)` — `years` parameter replaces literal array
- `StatementTable` now takes `fys`, `baseYear`, `baseYearS3` props; colSpan is dynamic
- `base_year` → reads from `ctx.config.base_year_s12` (fallback `reporting_years[0]`)
- `base_year_s3` → reads from `ctx.config.base_year_s3` (fallback `"FY24"`)
- SBTi target reads from `ctx.config.sbti_target_s12` (fallback `42%`)
- Footer label uses `${baseYear}` / `${baseYearS3}` instead of hardcoded FY years

**`src/routes/_app.reporting.tsx`** (IMPLEMENTED — requires live testing)
- Static `CYCLES` array (Featherlite entities) replaced with `buildCycles()` from real `ctx.entities`
- Consultant email reads from `ctx.config.consultant_email` (fallback placeholder)
- Contact email reads from `ctx.config.contact_email` (fallback placeholder)
- `fy` from `useFiscalYear()` drives all cycle/log generation
- `buildLog()` takes `consultantEmail` as 3rd parameter (no hardcoded email)
- All `likhith@deepwoodsgreen.com` occurrences removed; all `[GHG FY2026]` → `[GHG ${cycle.fy}]`
- PageHeader description: `"FY2026 GHG data collection..."` → `\`${fy} GHG data collection...\``
- Consolidated summary `FY2026 ·` → `{fy} ·`

### Priority 6: Request Access flow (IMPLEMENTED — requires live testing)

**`database/migrations/003_add_client_requests.sql`** — NEW
- `client_requests` table: id, name, company, email, phone, employees, message, status ENUM, timestamps

**`backend/api/request-access.php`** — NEW (public, no auth)
- POST: validates name/company/email; inserts into `client_requests`; emails Deepwoods + requester via Smtp.php
- Duplicate email handled silently (returns 200); SMTP failure non-fatal

**`src/routes/request-access.tsx`** — NEW (public route at `/request-access`)
- Two-panel layout: branding left + form right
- Fields: name, company, email (required); phone, company size, message (optional)
- Success: green confirmation card; Error: inline red banner

### Priority 7: Client invitation (IMPLEMENTED — requires live testing)

**`backend/api/invite-user.php`** — NEW (deepwoods_admin / deepwoods_coordinator only)
- POST: validates client_id, email, role; generates 16-char hex temp password
- Inserts user with `must_change_password = 1`; sends welcome email via Smtp.php
- Returns `{ ok, email, temp_password, email_sent }`

**`src/routes/_app.admin.tsx`** — UPDATED
- `InviteUserModal`: email + role dropdown; spinner; 10-sec toast with temp password
- "Invite user" button added to both pending and active client rows

### Priority 8: Invoice / payment tracking (IMPLEMENTED — requires live testing)

**`database/migrations/004_add_invoice_fields.sql`** — NEW
- `ALTER TABLE clients ADD COLUMN invoice_ref`, `payment_status ENUM('pending','paid','waived')`, `payment_date DATE`, `payment_notes TEXT`

**`database/schema_combined.sql`** — UPDATED
- Invoice columns added to canonical `clients` table definition

**`backend/api/activate-client.php`** — UPDATED (PATCH added)
- GET: now returns `invoice_ref`, `payment_status`, `payment_date`, `payment_notes`
- PATCH `{ client_id, invoice_ref?, payment_status?, payment_date?, payment_notes? }` → updates invoice fields with validation

**`src/lib/api.ts`** — UPDATED
- `ActivationClient` interface extended with 4 invoice fields
- `useUpdateClientInvoice()` mutation hook added (calls PATCH, invalidates `activation-clients`)
- `useMutation` + `useQueryClient` imports added

**`src/routes/_app.admin.tsx`** — UPDATED (invoice UI)
- `InvoiceModal` component: fields for invoice_ref, payment_status select, payment_date, payment_notes
- `invoiceTarget` state in `ActivationTab`
- Payment status pill on pending rows (amber = pending, green = paid, blue = waived)
- "Invoice" button on every client row (pending + active)
- `FileText` icon added to lucide imports; `ActivationClient` type imported from api.ts

TypeScript: 0 errors (build verified — `npm run build:fresh` passed cleanly).

---

## 2026-08-09 — UI/UX Design Audit Pass (P0 + P1 improvements)

Design goal: PREMIUM, COHESIVE, INTENTIONAL, MODERN, MSME-FRIENDLY, PROFESSIONAL, DEMO-READY.
Constraint: API contracts, DB structure, authentication, tenant architecture, and business logic unchanged.

### P0 — Critical visual/UX fixes

**`src/styles.css`**
- `--background` lightened: `#E5E5E5` → `#F3F4F6` (removes the dingy washed-out look)
- Added `--nav-active-bg: color-mix(in oklab, var(--primary) 10%, white)` — multi-tenant nav active tint driven by `--primary` (per-client color), replacing the hardcoded `#FF2800` Featherlite red

**`src/routes/_app.tsx`** — nav + shell
- Sidebar: `bg-[var(--background)]` → `bg-white` (white sidebar / gray page / white cards = proper 3-level hierarchy)
- Main content area: `bg-[#F2F2F2]` → `bg-background` (uses CSS token, theme-aware)
- NavLink active state: hardcoded `#FF2800` → `text-[var(--primary)]` + `backgroundColor: "var(--nav-active-bg)"` (fully multi-tenant)
- NavLink indicator bar, icon: `text-[#FF2800]` → `text-[var(--primary)]`
- GroupNav active text/icon: same hardcoded red → `text-[var(--primary)]`
- Sidebar label: `text-sm font-bold` in client primary color → `text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground` label "Sustainability Portal" (neutral, premium)
- EntityBar labels: `text-[9px] tracking-[0.12em]` → `text-[10px] tracking-[0.10em]` (slightly larger for readability)
- Loading state: bare spinner → branded card with icon container and "Loading your workspace…" message
- Error state: raw red text → proper error card with human-readable message and "Refresh page" button

**`src/routes/onboard.tsx`** — onboarding tour
- ROLES array: string emoji (👑📊📝👁️) → Lucide icon components (ShieldCheck, BarChart2, ClipboardList, Eye) with styled icon containers, per-role `iconBg` / `iconColor`

### P1 — Consistency improvements

**`src/components/portal.tsx`** — shared UI primitives
- `LockedState`: added optional `cta?: ReactNode` prop; refined to `max-w-sm rounded-xl border` (was `rounded-2xl border-2 border-dashed`)
- Added `EmptyState` component: icon container + title + description + cta slot; uses `border-dashed` consistently with `LockedState`

### Bug fix (TypeScript)

**`src/routes/_app.reporting.tsx`**
- `buildCycles` function signature: removed unused `short_name` field from entity parameter type (was `ClientEntity.short`, not `short_name`); fixes TypeScript type mismatch

**`src/routeTree.gen.ts`** (auto-regenerated by Vite)
- `/request-access` route now registered in `FileRoutesByPath` after `npm run build:fresh`

**Build:** `npm run build:fresh` → 2527 modules, 0 errors.

**Audit document:** `docs/UI_UX_DESIGN_AUDIT.html` — 74/100 overall score, 14 sections, 23 issues tracked.

---

## 2026-08-08 — Priority 3–6: GHG Automation Bootstrap + Multi-Tenant Bug Fixes

### New files
- **`backend/api/ghg/setup-client.php`** — POST endpoint (deepwoods_admin only). For each non-consolidated entity of a given client_id, computes the GHG Client ID (`{SLUG_UPPER}-{ENTITY_CODE}-GHG-{FY}`), reads `entity_scope_json` from `client_config`, maps S3 categories from integer array to `cat{N}` keys, and calls the Apps Script `setupNewClient` action via curl. If `ghg_webapp_url` is empty in config.php, returns `status: "skipped"` and does NOT set `ghg_setup_done`. On full success, writes `ghg_setup_done=true` to `client_config`.
- **`automation/Code.gs` — `_handleSetupNewClient` function** — Generic Apps Script bootstrap: (1) appends row to Master_Index if client not already present; (2) generates template GHG_Datapoints rows from `scopeConfig` flags (S1: stationary/mobile/fugitive; S2: grid/renewable; S3: from `s3_categories` integer array). Both operations are idempotent — skip if rows already exist. Wired into `doPost` switch on `case "setupNewClient"`.
- **`docs/PORTAL_USER_FLOW_STATUS.html`** — Standalone visual implementation status document (12 sections): status dashboard, new-client validation report, complete user flow (Deepwoods + Client), all 26 portal pages, sidebar navigation by role, client journey step-by-step, inventory boundary data flow, data architecture table, multi-tenant status, manual payment/activation flow, Aug 7–14 build plan status, QA checklist, file index.

### Bug fixes
1. **`src/routes/_app.submissions.tsx` (CRITICAL)** — `entity_scope_json` was being `JSON.parse()`d but `context.php` already auto-decodes all JSON config values before returning them; the object was serialised to `"[object Object]"` → parse threw → `entityScopeMap` was always null → scope-based filtering never worked. Fix: check `typeof raw === 'object'` first; only call `JSON.parse` when it's a string.
2. **`backend/api/ghg/setup-client.php` (CRITICAL)** — S3 categories were read from `$sc['s3_boundary']` which does not exist per-entity in `entity_scope_json`. Correct key is `$sc['s3_categories']` (integer array from setup.tsx). Fix: primary lookup `s3_categories`, fallback to global `s3_boundary` string format.
3. **`backend/api/submit.php` (MODERATE)** — `dolphin_require_active_client()` was not called; an inactive client with a valid session could upload data. Fix: gate added immediately after `dolphin_require_auth()`.
4. **`backend/api/decarb/assets.php` (HIGH)** — Entity filter used `$entity !== 'FL'` to bypass the consolidated entity check. Fix: DB lookup for `is_consolidated = 1` entity code for the authenticated client, same pattern as irec.php/grid-mwh.php.
5. **`backend/api/decarb/actions.php` (HIGH)** — Same `!== 'FL'` consolidated bypass. Fix: same DB lookup pattern.

### Other changes
- **`backend/api/activate-client.php`** — `ghg_setup_done` subquery added to the GET response
- **`src/lib/api.ts`** — `ghg_setup_done: string | null` field added to `ActivationClient` interface
- **`src/routes/_app.admin.tsx`** — "Setup GHG" / "GHG ready" button added to Active Clients; `setupGhg()` handler calls `ghg/setup-client.php` and shows contextual toast (skipped / error / success); `settingUpGhg` state + `Workflow` icon imported
- **`backend/config.php`** — Three new keys: `ghg_webapp_url` (empty = disabled), `platform_name`, `platform_base_url`
- **`database/schema_combined.sql`** — `entity` column default changed from `'FL'` to `''`
- **`src/styles.css`** — CSS variables renamed: `--featherlite-red` → `--brand-red`, `--featherlite-dark` → `--brand-light-bg`, `--featherlite-gray` → `--brand-gray`

TypeScript: 0 errors.

### New-client validation (Priority 5) — 12 checkpoints
- Checkpoints 1–5, 7–8, 10–12: **VERIFIED** by code inspection
- Checkpoints 6, 9: **REQUIRE LIVE DEPLOYMENT** (Apps Script URL must be configured)

---

## 2026-08-08 — QA & Hardening Pass

### Bugs fixed

1. **`backend/api/context.php` (CRITICAL)** — Deepwoods staff (`deepwoods_admin`, `deepwoods_coordinator`) have `client_id = null` in the DB. `context.php` was using `requireAuth()` from `auth_middleware.php`, which unconditionally 403s any user without a `client_id`. This made the portal completely inaccessible to Deepwoods staff. Fix: switched to `dolphin_require_auth()` from `db.php` and added a Deepwoods-staff branch that returns a minimal platform context (id=0, `enabled_pages: ['workstreams','admin']`, empty entities/years/config).

2. **`src/lib/auth.ts` (MEDIUM)** — `sustainability_team` role had `canUpload: false` and `canVault: false`. The submissions page gates all uploads behind `canUpload`, so the ESG Manager/Owner (the primary client role) was locked out of the Data Collection page — directly contradicting the approved milestone. The team invite modal also falsely advertised "Edit and submit data for all entities." Fix: `canUpload: true`, `canVault: true` for `sustainability_team`.

3. **`src/routes/onboard.tsx` (MEDIUM)** — `authFetch("context.php").then(async (res) => { if (res.ok) ... res.json() ... })` — same broken pattern fixed earlier in `setup.tsx`. `authFetch` returns parsed JSON, not a Response; `res.ok` was always undefined, so the client name was never loaded from the API. The personalised "Welcome, {ClientName}" greeting was always blank. Fix: `.then((ctx: any) => { setClientName(ctx?.client?.name ?? ""); })`.

4. **`src/routes/_app.team.tsx` (LOW)** — `ctx.config?.self_email` does not exist in `ClientContext`; the `self_email` field is never returned by `context.php`. The "YOU" badge identifying the current user's own row in the team list was never shown. Fix: replaced with `getEmail()` from `auth.ts`.

5. **`backend/api/client-setup.php` (LOW)** — Dead code on lines 91-93 called `execute()` and used its boolean return in a `? 0 : 0` ternary (always resolving to 0 regardless), then lines 95-97 immediately re-computed `$maxOrder` correctly. The dead lines were harmless but confusing. Fix: removed the dead lines.

### Comment/documentation updated
- `auth_middleware.php` — entity_scope comment examples updated from Featherlite-specific codes (FP, FOS) to generic examples.

TypeScript: 0 errors. Production build: ✓

---

## 2026-08-08 — Data Collection Handoff (milestone complete)

### src/routes/setup.tsx — SuccessState CTA wired
- `SuccessState` now receives both `onDashboard` and `onDataCollection` props
- Primary CTA "Start data collection" navigates to `/submissions`
- Secondary CTA "Go to workspace first" navigates to `/workstreams`
- `handleDataCollection = () => navigate({ to: "/submissions" })` wired in `Setup()` component

### src/routes/_app.workstreams.tsx — Data collection nudge
- After setup is complete, owners see a green dismissible banner prompting them to start data collection → `/submissions`
- Dismissed via `decarb_data_collection_dismissed` localStorage key
- Positioned between the Team banner and the Cluster selector

### src/routes/_app.submissions.tsx — First-time welcome callout
- When no submissions exist (`visibleSubs.length === 0`), a green welcome callout appears above the submission type picker
- Explains the download → fill → upload flow
- Disappears automatically once the first submission is present

TypeScript: 0 errors.

---

## 2026-08-08 — Epic 2: Client Provisioning + Bug Fixes

### Bug fixes
- **`src/routes/setup.tsx`**: Fixed critical bug where context pre-population was broken — `authFetch` returns parsed JSON, not a Response object; the dead `res.ok` / `res.json()` pattern was replaced with the correct `.then((ctx: any) => { ... })` form. Existing entities and config values now load correctly into the wizard.
- **`src/routes/setup.tsx`**: Removed dead `if (!res.ok)` block in `handleSubmit` — `authFetch` already throws on non-2xx, so this was redundant.
- **`backend/api/client-setup.php`**: Added `dolphin_require_active_client($user)` guard — inactive clients can no longer POST to setup even if they bypass the UI.

### backend/api/clients.php — NEW (Epic 2: Client Provisioning)
- `GET` → list all clients with engagement metadata (admin + coordinator)
- `POST { name, slug?, currency?, reporting_period?, entities?, config? }` → create client + entities + default config atomically (admin only). New clients default to `is_active = 0`.
- `PATCH { id, ... }` → update client name, logo_url, primary_color, currency, reporting_period (admin only)
- Slug is auto-derived from name if not supplied; validated for uniqueness (409 on duplicate)

### src/lib/api.ts — `ApiClient` + `useClients()`
- `ApiClient` interface matching the `clients.php` GET response
- `useClients()` hook (30s stale time, deepwoods admin/coordinator only)

### src/routes/_app.admin.tsx — Clients tab wired to real DB data
- `DUMMY_CLIENTS` and `loadLsClients()` removed; Engagements tab now fetches from `clients.php`
- `apiClientToEngagement()` maps DB rows to the local engagement display model
- `statusOverrides` (local session state) allows consultants to manually advance status during a session
- `screenedSet` (local session state) tracks which clients have been scope 3 screened in this session
- `patchRelevance` fixed to handle clients with no prior screening data (was crashing on `.map()` of undefined)
- **New "New client" button** on Engagements tab → `CreateClientModal`
- `CreateClientModal`: name, auto-slug, currency, reporting period → `POST /api/clients.php` → query cache invalidated. Shows amber reminder that client starts Pending Activation.
- Refresh button now calls `refetchClients()` instead of no-op

TypeScript: 0 errors.

---

## 2026-08-08 — Activation Gate + Team Setup

### Business model enforcement: Manual activation gate
- New clients default to `is_active = 0`. Deepwoods activates them after payment is verified externally.
- No payment gateway, no Stripe, no Razorpay. Payment is fully external.

### database/migrations/002_add_client_activation.sql — NEW
- `ALTER TABLE clients ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 0`
- `ALTER TABLE clients ADD COLUMN activated_at DATETIME DEFAULT NULL`
- Marks all existing clients as active (backward-compatible)

### database/schema_combined.sql — updated
- Added `is_active` and `activated_at` columns to `clients` CREATE TABLE
- Featherlite seed row starts with `is_active = 1`

### backend/api/db.php — `dolphin_require_active_client()` helper
- Checks `clients.is_active` for client-role users; Deepwoods roles bypass
- Returns HTTP 403 with `{ error: "client_not_activated" }` for inactive clients
- Call at top of any client-facing data endpoint

### backend/api/context.php — `is_active` in response
- `SELECT *` on clients now includes `is_active`; returned as `client.is_active: boolean`

### backend/api/team.php — NEW
- GET: list team members for caller's client (sustainability_team role only)
- POST: invite new member (email + role + optional entity_scope); initial password = email
- DELETE ?id=X: remove team member (cannot self-delete; cross-client forbidden)
- Calls `dolphin_require_active_client()` — server-side enforcement

### backend/api/activate-client.php — NEW (deepwoods_admin only)
- GET: list all clients with activation status, user count, setup_complete
- POST `{ client_id, active }`: activate or deactivate a client

### src/lib/client-context.tsx — `is_active` field
- Added `is_active: boolean` to `ClientInfo` interface

### src/lib/api.ts — new types + hooks
- `ActivationClient` interface + `useActivationClients()` hook
- `TeamMember` interface + `useTeamMembers()` hook

### src/routes/_app.tsx — Activation gate + Team nav
- `PendingActivation` full-screen component (shown to inactive client users)
- `ClientContextGate` checks `ctx.client.is_active` before orientation redirect
- "My Team" nav item added (visible only to `sustainability_team` role)

### src/routes/_app.team.tsx — NEW Team Management page
- Role selector step → Email/entity step → Success (initial password prompt)
- Grouped member list: ESG Managers, Data Submitters, Viewers
- Inline remove with confirmation; role guide cards at bottom
- "Back to workspace" link; accessible from sidebar

### src/routes/_app.workstreams.tsx — Team setup prompt
- After `setup_complete = "true"`, sustainability_team users see a dismissible "Invite your team" banner
- Dismissed via localStorage `decarb_team_banner_dismissed`

### src/routes/_app.admin.tsx — Activation tab
- New "Client Activation" tab (default tab for deepwoods_admin)
- Lists real DB clients (via `activate-client.php`) with Activate/Deactivate buttons
- Pending clients shown in amber; active clients shown in green

---

## 2026-08-08 — Approved Client Journey Implementation

Aligned all onboarding flows to the approved client journey from `Decarb_Client_Journey.html`.

### src/routes/onboard.tsx — REWRITE (3-screen orientation tour)
- Replaced 6-step data wizard with a 3-slide orientation tour (< 3 min, skippable)
- Slide 1: Portal modules (6 cards), Slide 2: Annual GHG cycle (6 steps), Slide 3: Team roles (4 cards)
- Full-screen green gradient design; auth guard redirects Deepwoods roles to `/workstreams`
- On complete or skip: sets `localStorage.decarb_orientation_done = "1"` → navigates to `/workstreams`

### src/routes/setup.tsx — NEW (Combined Annual Setup Wizard)
- 3-step boundary wizard: Step 1 Org Boundary → Step 2 Inventory Boundary → Step 3 Review & Confirm
- Step 1: Consolidation approach (3 radio cards), base year dropdown, entity list with add/remove. Pre-fills from `context.php`
- Step 2: Per-entity scope tabs (S1/S2/S3) with toggle cards. Non-consolidated entities each get independent config
- Step 3: Summary review with "Edit" links back to each step; "Confirm & Activate" submits
- Payload: `consolidation_approach`, `base_year`, new entities, `entity_scope` JSON, legacy global scope keys
- On success: clears `decarb_client_ctx` sessionStorage → navigates to `/workstreams`

### src/routes/_app.tsx — ClientContextGate redirect updated
- Removed: `setup_complete === "false"` check
- Added: `localStorage.decarb_orientation_done` check — client roles without this flag redirect to `/onboard`

### src/routes/_app.workstreams.tsx — Setup banner added
- If `ctx.config?.setup_complete !== "true"`: shows green banner "Configure your GHG workspace" → `/setup`
- Banner disappears automatically once setup wizard is completed

### backend/api/client-setup.php — New config keys
- Added `base_year` (string, e.g. "FY24") saved to `client_config`
- Added `entity_scope_json` (JSON blob of per-entity scope config) saved to `client_config`

---

## 2026-08-08 — Onboarding Wizard Redesign + UI Quality Pass

### src/routes/onboard.tsx — COMPLETE REWRITE
- 6-step client journey (Welcome → Organization → Reporting → Boundary → Emissions → Review)
- All `fl_` localStorage keys removed
- Hardcoded MONTHS_SHORT removed — FY label is computed from selected start month
- Pre-populates from existing client context (authFetch context.php)
- Saves to backend via POST client-setup.php on completion
- Premium design: consultant tips, visual scope cards, entity hierarchy, smooth progress dots

### backend/api/client-setup.php — NEW
- Saves org profile, reporting config, new entities, scope boundary to DB
- Sets client_config.setup_complete = 'true'

### src/routes/_app.tsx
- ClientContextGate redirects client users to /onboard if setup_complete === "false"

### src/components/portal.tsx
- LockedState: replaced 🔒 emoji with Lucide Lock icon

---

## 2026-08-08 — Epic 1: Auth & Role Foundation

### database/migrations/001_migrate_legacy_roles.sql (NEW)
- Migration script: UPDATE legacy roles → generic roles, then ALTER TABLE to drop the legacy ENUM values
- Run this via phpMyAdmin BEFORE deploying the updated backend

### database/schema_combined.sql
- `users.role` ENUM now contains exactly the 5 platform roles; `featherlite_team`, `featherlite_leadership`, `automation_demo` removed

### backend/api/users.php
- `$validRoles` corrected to the 5 platform roles (was `dolphin_team`, `dolphin_leadership` — wrong values)
- `client_id` now included in INSERT; validated against `clients` table
- GET supports optional `?client_id=` filter for admin console use
- Role/client_id mutual validation: client roles require `client_id`; Deepwoods roles must not have one
- `entity_scope` field supported in POST body

### backend/seed-users.php
- Roles updated to `sustainability_team` / `client_leadership` (were `featherlite_team` / `featherlite_leadership`)
- `client_id` now set on INSERT for Featherlite accounts
- Looks up Featherlite client by slug rather than hardcoding an id

### src/routes/_app.submissions.tsx
- Stale `automation_demo` comment removed (line 614)

---

## 2026-08-07 — Documentation Handoff + Market Research

### Documentation handoff (9 new documents)
- `CLAUDE_ONBOARDING.md` (project root) — complete onboarding for new Claude accounts; first document every AI reads
- `docs/PROJECT_CHARTER.md` — vision, mission, principles, things we will never do
- `docs/PROJECT_CONTEXT.md` — full current state: what works, what's broken, architecture, priorities
- `docs/TEAM_GUIDELINES.md` — coding rules, PHP/TypeScript/SQL standards, review checklist, definition of done
- `docs/DECISION_LOG.md` — all major architectural and product decisions with reasoning and alternatives
- `docs/SESSION_HANDOFF.md` — current state, next priority (Epic 1), exact steps, open questions
- `docs/PROJECT_STRUCTURE.md` — every folder explained: purpose, what belongs, what doesn't
- `docs/DOCUMENT_INDEX.md` — master index of all docs grouped by purpose with "when to read" guidance
- `docs/PROJECT_MEMORY.md` — AI-specific context: assumptions, design philosophy, technical philosophy

### Market research (7 documents in docs/market-research/)
- Competitive analysis of 25 sustainability platforms
- Strategic vision: "Consultant OS" and MSME cliff identified as primary opportunities
- Key output: `DESIGN_PATTERNS.md` — "what would we build differently" vision section
- Files moved from temporary study/ location into platform/docs/market-research/

### CLAUDE.md updated
- Added prominent "NEW TO THIS PROJECT?" section linking to CLAUDE_ONBOARDING.md

---

## 2026-08-06 — Release Blocker Sprint 1 (Security)

### HP-1 — Groq API keys moved server-side
- Created `backend/api/ai.php` — authenticated proxy that holds all Groq keys server-side
- `GROQ_KEYS` array removed from `src/components/DeecarbAI.tsx`; component now calls `authFetch("ai.php")` instead of hitting Groq directly
- Keys never appear in the browser bundle; override via `GROQ_API_KEY_1..5` env vars on the server

### Cross-tenant authorization — 4 endpoints fixed
- `backend/api/submissions.php` — captured auth return value; replaced `?client_slug=featherlite` with `$authUser['client_id']` from session; removed hardcoded `['FP','FOS']` entity filter; entity_scope enforced
- `backend/api/audit-log.php` — same pattern; query now scoped to authenticated client_id
- `backend/api/metrics.php` — GET and POST both now use `$authUser['client_id']`; no more caller-supplied slug
- `backend/api/submit.php` — client identity from session; hardcoded `['FP','FOS']` entity guard replaced with `client_entities` DB lookup; consolidated entity check is now generic

### submit.php hardcoding removed
- Entity validation now queries `client_entities WHERE client_id = ? AND code = ?` — works for any client's entity codes
- Drive root folder fetched by `clients WHERE id = ?` (client_id from auth) instead of slug lookup
- Removed all hardcoded `'featherlite'` default slugs and `'FP'`/`'FOS'` entity literals

---

## 2026-08-06 — Platform Foundation Complete

**TypeScript errors: 18 → 0. Zero errors across all 14 files.**

### Medium/Low fixes
- `_app.reporting.tsx` — `stringCycle` (typo/corruption) → `EntityCycle` everywhere; cascading implicit-`any` on `m` and `mp` callback params auto-resolved (M-5 + L-1)
- `_app.priority-actions.tsx` — `item.priority ?? ""` and `item.tag ?? ""` before using as Record key; `PriorityItem.priority` and `.tag` are `string|null` (M-8)
- `_app.inventory.tsx` — `!== undefined` guards replaced with `!= null` throughout `yoyPct()` and the asset table loop, since `FYSeries = Record<string, number|null>`; Sparkline's `values` prop filtered to `number[]` via `.filter((v): v is number => v !== null)` (M-8)
- `decarb/shared.tsx` — annotated two empty array literals `[] as Action[]` to prevent TypeScript inferring them as `never[]` (M-9)

---

## 2026-08-06 — Platform Stabilization Sprint 1

**TypeScript errors: 99 → 18 (all remaining are Medium/Low)**

### Critical fixes (0 runtime crashes remain)
- `_app.peer.tsx` — Wired `usePeers()` → `peersData`; defined `PeerData` type with FY transform; added `SOURCE_COLORS`, `PEER_FISCAL_YEARS`, `PeerFY`; fixed `invData["Scope 1"][fy]` → `getVal()` crash; fixed `PEER_FISCAL_reporting_years` typo (C-1 through C-4, C-9)
- `_app.green-finance.tsx` — Refactored `buildSlices` from module-scope (using undefined vars) to a pure function accepting `invData` and `intensityData` as params; fixed `revenueLakh` → `revenue_lakh`; fixed `YEARS[fyIdx-1]` → `reporting_years[fyIdx-1]`; added `type FY = string` (C-5, C-6)
- `_app.priority-actions.tsx` — Wired `usePriorityItems(entity)` → `priorityData` (C-7)
- `_app.submissions.tsx` — Fixed `EntityPicker` to use `useDataEntryEntities()`, removing undefined `dataEntryEntities`/`ENTITY_META` references (C-8)

### High fixes (0 incorrect-behaviour bugs remain)
- `DeecarbAI.tsx`, `_app.dashboard.tsx`, `_app.action-plan.tsx` — `r.sub_type` → `r.source` on `S1BreakdownRow` (H-1)
- `src/lib/api.ts` — Added `entity?: string` to `S2ByFacilityRow` interface (H-2)
- `src/components/decarb/shared.tsx` — Rewrote `abatementFor`/`costFor` to use `a.abatement_t`; removed refs to non-existent `impactMin/impactMax/costPerT` (H-3)
- `_app.interactive-inventory.tsx` — `a.scope === 1/2` → `a.scope === "Scope 1"/"Scope 2"` (H-4)
- `_app.workstreams.tsx` — `u.role` removed; `u.grid` → `u.grid_utility`; `u.solar` → `u.re_instrument` (H-5)
- `_app.submissions.tsx` — `role === "automation_demo"` → `ROLE_META[role].canAdmin`; `entityName()` scoped correctly in `ScopeWizard`; `DatasetId` → `string` (H-6, H-7)

### Featherlite hardcoding removed
- `_app.vault.tsx` — Replaced `RECENT` static array (hardcoded FP/FOS/FL entity codes) with `useVaultDocuments()` hook; removed `type E2 = Entity` (undefined type)
- `_app.reports.tsx` — Replaced `DOCS_BY_YEAR` static record (hardcoded FP/FOS/FL docs) with `useVaultDocuments()` + `useMemo`; years now derived from `ctx.reporting_years`

### Files touched
`src/routes/_app.peer.tsx`, `src/routes/_app.green-finance.tsx`, `src/routes/_app.priority-actions.tsx`, `src/routes/_app.submissions.tsx`, `src/routes/_app.dashboard.tsx`, `src/routes/_app.action-plan.tsx`, `src/routes/_app.interactive-inventory.tsx`, `src/routes/_app.workstreams.tsx`, `src/routes/_app.vault.tsx`, `src/routes/_app.reports.tsx`, `src/components/DeecarbAI.tsx`, `src/components/decarb/shared.tsx`, `src/lib/api.ts`

---

## 2026-08-06 — Migration to platform/ + ARC-M5 + CT-3

- Migrated all source from `decarb/` → `platform/` (195 files)
- Fixed ARC-M5: `submissionsStore.ts` CLIENT_SLUG hardcoding — now accepts `clientSlug` parameter from `useClientContext()`
- Fixed CT-3: `_app.trends.tsx` runtime crash — replaced undefined `YEARS`/`INV` with `reporting_years`/`getVal()`

---

## 2026-08-06 — Repository Reorganization (Phase 1)

### Structure
- Created `docs/` directory; moved all root-level `.md` documentation files there
- Created `data-sources/` directory; moved `GHG_Master_Sheet_Featherlite.xlsx` there
- Created `_archive/` directory; moved superseded Lovable-era prompt files and old docs
- Moved `Deepwoods Leaf Icon.png` to `public/`
- Moved reference materials (xlsx, pdf, docx) to `docs/reference/`

### Files Added
- `README.md` — project overview
- `docs/ARCHITECTURE.md` — full architecture documentation
- `docs/DATABASE_SCHEMA.md` — schema reference for all 31 tables
- `docs/API_MAP.md` — all REST endpoints mapped
- `docs/AUTOMATIONS.md` — all automation workflows documented
- `docs/BUSINESS_RULES.md` — GHG calculation rules and business logic
- `docs/COMPONENT_MAP.md` — frontend component reference
- `docs/CUSTOMER_CONFIGURATION.md` — new client onboarding guide
- `docs/DATA_MODEL.md` — data models and flows
- `docs/CHANGELOG.md` — this file
- `docs/TODO.md` — remaining work
- `docs/ARCHITECTURE_REVIEW.md` — code quality findings
- `docs/MULTI_TENANT_READINESS.md` — SaaS readiness analysis
- `docs/PROJECT_HEALTH_REPORT.md` — health scores and roadmap
- `docs/ADRs/ADR-001-multi-client-platform.md`
- `docs/ADRs/ADR-002-php-backend-deployment.md`
- `docs/ADRs/ADR-003-static-spa-deployment.md`
- `_archive/ARCHIVE_LOG.md` — explains why each archived file was moved
- `CLAUDE.md` — fully rewritten for the Decarb platform (generic, no client names)

### Copied from Featherlite-GHG
- `reporting-platform/generate_ghg_report.js`
- `reporting-platform/Code.gs`
- `reporting-platform/package.json`
- `reporting-platform/Featherlite_Reporting_Master_Schema.xlsx`
- `reporting-platform/FOS_GHG_Test_*.xlsx` (test files)
- `public/templates/Featherlite_Scope*.xlsx` (data collection templates)
- `public/vault-docs/*` (Featherlite GHG reports)
- `public/deepwoods-logo.png`, `favicon.ico`, `favicon.png`

### Scripts Updated
- `scripts/sync-master-sheet.py` — default xlsx path updated to `data-sources/`

---

## 2026-08 — Client Name Removal (Generic Skeleton)

- Removed all hardcoded Featherlite/FP/FOS references from route files
- Routes now use `useClientContext()` and `useDecarbAssets()` for dynamic data
- `src/routes/_app.inventory.tsx` — full rewrite, API-driven
- `src/routes/_app.dashboard.tsx` — full rewrite, API-driven
- `src/components/DeecarbAI.tsx` — dynamic system prompt from DB context
- `src/routes/_app.interactive-inventory.tsx` — full rewrite
- Multiple route files cleaned of hardcoded entity names

---

## 2026-07 — Multi-Client Architecture

- `backend/schema_combined.sql` — authoritative multi-client schema (31 tables)
- `backend/api/context.php` — dynamic client context endpoint
- `src/lib/client-context.tsx` — ClientContextProvider with sessionStorage caching
- `src/lib/api.ts` — React Query hooks for all API endpoints
- `backend/schema_v2.sql` — multi-client schema v2
- Added Dolphin Die Cast and Navitas demo seed data
- `backend/api/ghg/` — split GHG API endpoints
- `backend/api/decarb/` — decarbonisation endpoints
- `backend/api/credits/` — I-REC and grid MWh endpoints
- Auth roles updated: removed Featherlite-specific roles, added generic roles

---

## 2026-07 — GHG Automation (Live)

- `reporting-platform/Code.gs` — Day 0–8 automation cycle (daily trigger installed)
- `reporting-platform/generate_ghg_report.js` — FOS + FP support
- Google Drive folders created for FOS and FP FY26
- Apps Script web app deployed
- `ghg-proxy.php` deployed to Hostinger `public_html/`
- `.env.local` wired to proxy URL
- `src/lib/ghg-config.ts` — `GHG_WEBAPP_URL` + live mode flag

---

## 2026-06-25 — FP GHG Inventory Report FY26

- Generated and delivered `FP_GHG_Inventory_Report_FY26.html`
- Generated and delivered I-REC procurement reports for FP and FOS FY26

---

## 2026-05 — Portal v1 (Featherlite-GHG)

- Initial portal built on Lovable.dev platform
- TanStack Start + React 19 + shadcn/ui foundation
- PHP backend with MySQL on Hostinger
- Auth system (Bearer token + demo mode)
- Core dashboard pages: Overview, Dashboard, Inventory, Action Plan, Progress
- Submission flow with Google Drive upload
- Vault, Methodology, Reports pages
- DeecarbAI chat widget (Groq API)
- Onboarding wizard (7-step)
- Priority Actions with email notification preferences
- FiscalYear switcher across all pages
- Scope 2 Sankey + waterfall charts
- Peer benchmarking page
- Green Finance (carbon P&L) page
- Credits/I-REC register page
- Admin dashboard (Deepwoods roles)
- GHG Reporting Cycle simulator (automation_demo role)
