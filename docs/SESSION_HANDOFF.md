# Session Handoff

> **Update this file at the end of every working session.**
> A new Claude reads this first to understand where we stopped and what to do next.

---

## Last Updated
2026-10-06 — Home redesign + Admin Console rebuild + live-test fixes (see CHANGELOG 2026-10-06)

### Start here next session
* Local stack for live tests: XAMPP MariaDB `decarb_local`, `php -S localhost:8787` (repo root), `npm run dev` (5173). `backend/config.local.php` blanks SMTP so no real mail is sent.
* Known follow-ups: (1) rotate/move Groq keys out of `backend/api/ai.php`; (2) `activate-client.php` GET and `data-health.php` return every client (fine now, add filters at scale); (3) renaming an entity code in Admin > Setup cascades only to `ghg_facilities`, not to assets/drafts/inventory; (4) hotspot facility and Scope 3 category splits depend on the calculation pipeline populating `s1_by_facility`, `s2_by_facility`, `scope3_summary`; (5) intensity denominators (revenue/output) have no admin entry screen; (6) `payment_complete` config key may be legacy, gating uses `clients.payment_status`.

---

## Previous: 2026-09-09 — Data gap resolution: SQL patch + 7 application bug fixes

---

## Completed This Session (2026-09-09 — Data gap resolution)

Input: Excel tracker "Data gaps and resolution tracker (2).xlsx" (3 sheets, 5–8 Sep reports)
       + SQL dump u833634340_decarb_portal (18).sql (current DB state)

### SQL patch — database/fix_data_gaps_2026-09-09.sql (apply to production)
1. Delete DG-Sourced Electricity entries for NLS & NDS Bengaluru (incorrectly registered)
   — removes from tracker_drafts, decarb_assets, inv_scope2_sources
2. Add NDS Bengaluru BESCOM Grid inv_scope2_sources for CY2021, CY2022, CY2023
   (facility_id=90; was completely missing so MB showed nothing for those years)
3. Add NDS Green Tariff inv_scope2_sources for CY2021, CY2022, CY2023
   + backdate decarb_assets active_from_fy to CY2021 for NDS Green Tariff
4. Pin reporting_years = ["FY21"…"FY25"] in client_config for clients 17 (FP) and 18 (FOS)
   so the FY25 year appears in their dropdown before data rows exist
5. Backdate NLS Green Tariff decarb_assets active_from_fy to CY2021 (was CY2025)
6. NOTE: NCR Gaithersburg CY25 Scope 1 removal requires manual review — see comment in SQL

### Application fixes (all committed to working tree — need build + deploy)
- **inventory-boundary.php**: Critical multi-entity fix — POST DELETE was wiping ALL entities'
  scope1/scope2 for the client; now entity-scoped via new `entity` field in POST body.
  Added `inv_delete_s1()` / `inv_delete_s2()` helpers with facility-to-entity join.
- **InventoryContext.tsx**: Added `entity: entityRef.current` to both POST bodies so the
  backend knows which entity is being saved.
- **_app.data-tracker.tsx**: Unit column now uses `resolveAssetUnit(asset)` instead of
  raw `asset.unit ?? "—"`. Added `resolveAssetUnit` import.
- **_app.data-tracker.tsx**: Scope 3 tab empty state now links to `/submissions` instead
  of `/inventory-boundary`.
- **Scope3Cards.tsx**: Fixed Cat 9 stream — was `"up"` (upstream), now `"down"` (downstream).
- **scope3Schemas.ts**: Cat 6 Business Travel — removed supplier-specific method; changed
  recommended to `"distance"` (Distance-based).
- **scope3-screening.php** (NEW): Backend endpoint for admin relevance screening.
  GET: load existing screening for a client. POST: save screening array (15 elements) →
  writes `s3_boundary` and `s3_screening_raw` to client_config.
- **_app.admin.tsx**: `markScreeningDone` now POSTs to scope3-screening.php before updating
  local state. Added `useEffect` to pre-load saved screening when admin opens a client panel.

### Still open from gap tracker
- Cat 7 (Employee Commuting) "looks survey not template" — the Cat7Commute survey component is
  by design; no change made. Revisit if client expects a CSV-upload template instead.
- NCR Gaithersburg CY25 Scope 1 inventory — see SQL file note, needs consultant sign-off.
- NLS Bengaluru CY25,23,21,22: NDS entry visible in NLS Inventory Boundary READ path —
  GET filter in inventory-boundary.php IS entity-scoped (`?entity=NLS` is sent); if the
  issue persists, check whether `activeEntityCode` in InventoryContext is null on first load
  (inspect `InventoryContext.tsx` useEffect on entity change).

---

## Completed Previous Session (2026-08-26 — FP/FOS Carbon Ledger rebuild)

**Context:** 9 undocumented ad-hoc SQL files sitting in the repo root
(`full_ledger_import.sql`, `carbon_ledger_import.sql`, `inventory_boundary_tracker_FY21_FY24.sql`,
`fos_missing_assets_FY21_FY24.sql`, `fos_missing_assets_FY21_FY26.sql`,
`fix_tracker_assetids_FP.sql`, `fix_fy25_duplicates.sql`, `fix_year_ranges.sql`) turned out
to be from at least 4 separate, uncoordinated past attempts to import the FP/FOS Carbon
Ledger Excel workbooks into `decarb_assets`/`inv_scope1_assets`/`inv_scope2_sources`/
`tracker_drafts` — never reconciled, never written up here. Live production DB (client_id
17=FP, 18=FOS) had real bugs as a result, notably: FOS's "Kumbalagodu" facility was
misspelled "Kumbalgudu" in `ghg_facilities`, causing a past import's facility lookup to
silently fail and leave 5 `inv_scope2_sources` rows with blank `facility_id`/`category`.

**Also discovered and not yet fixed in this session:** `database/tracker_drafts.sql` and
`database/inventory_boundary.sql` define tables (`tracker_drafts`, `inv_scope1_assets`,
`inv_scope2_sources`, `inv_op_control`) that the live app depends on but that are **not**
merged into `database/schema_combined.sql` and not mentioned in `database/README.md`. Worth
folding in or documenting explicitly next time someone touches the DB schema.

**This session:** parsed all 10 ledger workbooks (`FL Carbon Ledgers - Clients/*.xlsx`,
FY21–FY25) directly with a Python/openpyxl script, cross-validating every extracted monthly
value against each sheet's own "Total" row (265/265 matched). Generated
`ledger_rebuild_fp_fos_FY21-25.sql` (repo root, not committed — one-off data migration like
its predecessors) — a single transaction that: renames the two misspelled facilities,
removes ~37 precisely-identified stale/duplicate `decarb_assets` rows, does a clean
DELETE+rebuild of `inv_scope1_assets`/`inv_scope2_sources`/`tracker_drafts` for FY21–FY25
only, and additively carries the asset registry (not values) forward into FY26 via
`INSERT ... WHERE NOT EXISTS` so it never touches what a live user is entering today. Full
rationale and a coverage table are in `ledger_rebuild_fp_fos_REPORT.md` (repo root).

**Not yet done:** the SQL has not been run against production. Next step is for the user to
back up the DB, run it via phpMyAdmin, and then verify `/data-tracker`, `/inventory-boundary`,
and `/submissions` for FP/FOS show the ledger-accurate values. Scope 3 category data (Cat
1–12 tabs, present in the ledgers from FY24 onward) was explicitly out of scope for this pass.

---

## Completed This Session (2026-08-10 — CLIENT SETUP → DATA COLLECTION journey)

Four concrete gaps in the new-client journey fixed. The complete end-to-end flow now works:

**Request Access → Admin converts → Activate → Invite user → First login → Forced password change → Orientation → Workspace Setup → Data Collection**

### Fix A — New clients auto-redirect to /setup after orientation

**Root cause:** After finishing the orientation tour (`/onboard`), `ClientContextGate` only checked for orientation and password change — it never checked whether the workspace setup wizard had been completed.

**Fix:** [`src/routes/_app.tsx`](../src/routes/_app.tsx) — added check in `ClientContextGate.useEffect`:

```typescript
if ((ctxState.data.config as Record<string, unknown>)?.setup_complete === false) {
  navigate({ to: "/setup" });
}
```

- Only fires when `setup_complete` is the boolean `false` (set during client conversion in `client-requests.php`)
- Does NOT fire for existing clients without this config key (they are not redirected)
- After setup completes, `client-setup.php` sets `setup_complete = 'true'`, session cache is cleared, and the gate sees `true` on next render — no loop

### Fix B — InventoryUpdateWizard actually saves data to the DB

**Root cause:** `submit()` in `InventoryUpdateWizard` called `toast.success()` and `setSubmitted(true)` but never called any API. Data was lost on navigation.

**Fix:** [`src/routes/_app.submissions.tsx`](../src/routes/_app.submissions.tsx)

- Added `const { client } = useClientContext();` to the component
- Added `const [submitting, setSubmitting] = useState(false);` for loading state
- `submit()` is now async — calls `addSubmission(client.slug, { datasetId: "inventory-update", ... })` with the change summary in `notes`
- Submit button disabled and shows spinner while submitting
- Error handling via `toast.error`

### Fix C — submit.php no longer requires Google Drive credentials

**Root cause:** `submit.php` always instantiated `new GoogleDrive(...)`, which threw if Drive wasn't configured in `config.php`. This blocked inventory update submissions in environments without Drive.

**Fix:** [`backend/api/submit.php`](../backend/api/submit.php)

- Checks `$config['drive']['oauth_client_id'] ?? ''` before running Drive code
- If Drive is not configured, skips all folder creation and file upload logic
- Returns success with `files: []` — submission row is still created in DB

### Fix D — /setup pre-populates saved entity scope on return

**Root cause:** Returning to `/setup` after completing setup showed entity scope toggles reset to `DEFAULT_ENTITY_SCOPE`. The DB-saved values (`entity_scope_json` in `client_config`) were not loaded back.

**Fix:** [`src/routes/setup.tsx`](../src/routes/setup.tsx) — two changes:

1. Main `useEffect` now reads `ctx.config.entity_scope_json` and converts snake_case keys to camelCase before setting `data.entityScope`
2. `OrgBoundaryStep.useEffect` now only adds `DEFAULT_ENTITY_SCOPE` for entities NOT already present in `data.entityScope` — previously it always overwrote with defaults

**Build:** `npm run build:fresh` → 0 errors, 0 warnings ✅

---

## Completed This Session (2026-08-10 — New client journey)

### Audit: Full new-client journey mapped

All 14 journey steps inspected. Two gaps found and fixed:

### Fix A — Forced password change fires BEFORE orientation (not after)

**Root cause:** `ChangePasswordModal` lived inside `AppLayout`, which only renders after `ClientContextGate`. `ClientContextGate` redirected new users to `/onboard` first, so they completed orientation without ever seeing the password change prompt.

**Fix:** Added `ForcedPasswordChange` full-page component in [`src/routes/_app.tsx`](../src/routes/_app.tsx).

- New `ForcedPasswordChange` component (full-page, dark-green background — matches `PendingActivation` design language)
- `ClientContextGate` now holds a local `mustChangePw` state, initialized from `getMustChangePassword()`
- The orientation redirect (`navigate({ to: "/onboard" })`) is suppressed while `mustChangePw` is true
- After the user sets their password, `setMustChangePassword(false)` is called, `mustChangePw` state clears, and the useEffect re-fires — the user is then redirected to `/onboard` (first time) or workspace (repeat login)

**New journey order for invited users:**
1. Log in with temp password → navigate to /workstreams
2. `ClientContextGate` detects `must_change_password = true` → shows `ForcedPasswordChange` full-page
3. User sets password → `mustChangePw` state clears → useEffect fires → redirects to `/onboard`
4. User completes orientation → workspace

### Fix B — After "Accept & create client", auto-switch to Client Activation tab

**Root cause:** After converting a request, the admin stayed on "Access Requests" tab with only a toast message.

**Fix:** Added `onConverted` callback prop to `AccessRequestsTab` in [`src/routes/_app.admin.tsx`](../src/routes/_app.admin.tsx).

- `AccessRequestsTab` now accepts `onConverted?: () => void`
- `handleConvert` calls `onConverted?.()` after success
- In `Admin`, the `tab==="requests"` render now passes: `onConverted={() => { qc.invalidateQueries(["activation-clients"]); setTab("activation"); }}`
- Admin is immediately taken to "Client Activation" tab (with fresh data) after conversion

**Build:** `npm run build:fresh` → 0 errors ✅

---

## Completed This Session (2026-08-10 — earlier)

### Fix 1 — Reply-To email header missing

**`backend/api/Smtp.php`** — Added `Reply-To: <{fromEmail}>` header (line 46).  
All portal emails now include `Reply-To: green.featherlite@deepwoodsgreen.com` so email-client "Reply" goes back to the central mailbox.

**`backend/api/request-access.php`** — Updated amber info box in Deepwoods notification email.  
Changed "Reply directly to [prospect email]" to "Prospect contact: [email]. Manage in Admin Dashboard → Access Requests."

**`backend/config.php`** — `admin_email` changed from `krithika@deepwoodsgreen.com` to `green@deepwoodsgreen.com`.

### Fix 2 — 403 Forbidden for deepwoods_admin on GHG endpoints

Root cause: `requireAuth()` in `auth_middleware.php` returns 403 for any user with `client_id = NULL` (Deepwoods staff).

**Fixed in 5 GHG endpoints** — switched from `requireAuth()` → `dolphin_require_auth()` + early return of empty data for null `client_id`:
- `backend/api/ghg/inventory.php` — returns `{"entity":"","rows":[]}`
- `backend/api/ghg/s1.php` — returns `[]`
- `backend/api/ghg/s2.php` — returns `[]`
- `backend/api/ghg/s3.php` — returns `[]`
- `backend/api/ghg/intensity.php` — returns `[]`

### Fix 3 — Client Requests workflow (NEW)

**`backend/api/client-requests.php`** — NEW endpoint  
- `GET` — list all `client_requests` rows ordered by status then date (deepwoods staff)
- `PATCH { id, status }` — update status to `new|contacted|rejected`; blocks changes to `converted` rows
- `POST { action:"convert", id, name, slug, currency, reporting_period }` — atomically: creates `clients` row (is_active=0), creates default `client_entities` row, creates `client_config` (setup_complete=false), marks request as `converted`; idempotent (409 if already converted); deepwoods_admin only

**`src/lib/api.ts`** — 3 new hooks added  
- `ClientRequest` interface
- `useClientRequests()` — GET all requests
- `useUpdateRequestStatus()` — PATCH status
- `useConvertClientRequest()` — POST convert action

**`src/routes/_app.admin.tsx`** — Admin dashboard updated  
- `AdminTab` type extended: added `"requests"`
- `REQUEST_STATUS_CONFIG` added (new/contacted/converted/rejected badges)
- `AccessRequestsTab` component added: request list, status badges, "Mark contacted" / "Reject" / "Accept & create client" actions, Convert modal with auto-slug, company/contact summary, currency/FY inputs
- "New Requests" KPI card added to summary row (5th card, amber when count > 0)
- "Access Requests" tab added to TABS array (shows live count in label when > 0)
- `deepwoods_coordinator` early return changed: now shows a dedicated "Access Requests" view (full page, no other tabs) instead of LockedState; can Mark contacted and Reject, but not convert
- `deepwoods_admin` sees all 6 tabs including the new "Access Requests" tab

**Build:** `npm run build:fresh` → 0 errors ✅

---

## Completed This Session (2026-08-10 — earlier)

### Documentation — Tester User-Flow Guide

**`docs/TESTER_USER_FLOW.html`** — NEW standalone HTML tester guide (12 sections, ~700 lines)

Covers every user journey, role, and page in the platform.

No application code was changed in that sub-session.

---

## Completed This Session (2026-08-09)

### Priority 1: Multi-tenant hardcoding sweep

**`src/routes/_app.green-finance.tsx`** — IMPLEMENTED (requires live testing)
- All 8 hardcoded FY year arrays replaced with dynamic `reporting_years` from context
- `buildSlices(invData, intensityData, years)` uses `years` parameter; `StatementTable` takes `fys`/`baseYear`/`baseYearS3` props
- `base_year_s12`, `base_year_s3`, `sbti_target_s12` read from `ctx.config` (with fallbacks)

**`src/routes/_app.reporting.tsx`** — IMPLEMENTED (requires live testing)
- Static `CYCLES` array (Featherlite) replaced with `buildCycles()` from real `ctx.entities`
- Consultant email from `ctx.config.consultant_email`; contact email from `ctx.config.contact_email`
- `fy` from `useFiscalYear()` drives all cycle generation and email subjects
- All 3 remaining `FY2026` literals fixed (body text, PageHeader description, consolidated summary)

### Priority 6: Request Access flow — NEW files

- `database/migrations/003_add_client_requests.sql` — `client_requests` table
- `backend/api/request-access.php` — public POST; inserts row; emails Deepwoods + confirmation to requester
- `src/routes/request-access.tsx` — two-panel public form at `/request-access`

### Priority 7: Client invitation — NEW files

- `backend/api/invite-user.php` — POST (deepwoods_admin/coordinator); generates temp password; sends welcome email
- `src/routes/_app.admin.tsx` updated — `InviteUserModal` + "Invite user" button on pending + active rows

### Priority 8: Invoice / payment tracking — NEW files

- `database/migrations/004_add_invoice_fields.sql` — `invoice_ref`, `payment_status`, `payment_date`, `payment_notes` columns added to `clients`
- `database/schema_combined.sql` — canonical schema updated with invoice columns
- `backend/api/activate-client.php` — PATCH endpoint added; GET now returns invoice fields
- `src/lib/api.ts` — `ActivationClient` interface extended; `useUpdateClientInvoice()` mutation hook added
- `src/routes/_app.admin.tsx` — `InvoiceModal` + payment status pill + "Invoice" button on all client rows

---

## Completed This Session (2026-08-09 — UI/UX Design Pass)

Design brief: PREMIUM, COHESIVE, INTENTIONAL, MODERN, MSME-FRIENDLY, PROFESSIONAL, DEMO-READY.
No API, DB, auth, or business logic changes.

### P0 fixes implemented
- **`src/styles.css`**: `--background` lightened to `#F3F4F6`; `--nav-active-bg` CSS variable added (multi-tenant `color-mix` from `--primary`)
- **`src/routes/_app.tsx`**: sidebar → `bg-white`; main → `bg-background`; ALL nav active colors (`#FF2800`) → `text-[var(--primary)]` + `backgroundColor: var(--nav-active-bg)`; sidebar nav label → neutral `text-muted-foreground`; EntityBar label size fixed; loading state → branded card; error state → proper error card with Refresh button
- **`src/routes/onboard.tsx`**: ROLES array emoji → Lucide icon components (ShieldCheck, BarChart2, ClipboardList, Eye) with styled icon containers

### P1 fixes implemented
- **`src/components/portal.tsx`**: `LockedState` improved (`max-w-sm`, dashed border, optional `cta` prop); new `EmptyState` component (icon + title + description + cta slot)
- **`src/routes/_app.reporting.tsx`**: `buildCycles` parameter type: removed unused `short_name` (was causing TypeScript error)

### Documentation
- **`docs/UI_UX_DESIGN_AUDIT.html`** — comprehensive audit document (74/100 score, 14 sections, 23 issues registered)
- **`docs/CHANGELOG.md`** — updated with both Aug 9 sessions

### Build
- `npm run build:fresh` → 2527 modules, 0 errors ✅
- Route tree auto-regenerated: `/request-access` now registered in `FileRoutesByPath`

---

## Immediate Next Steps — Deploy & test this session's fixes

### Files to upload to Hostinger public_html/ (re-upload after build)

| File | Change |
|---|---|
| `backend/api/Smtp.php` | Reply-To header added |
| `backend/api/request-access.php` | Notification body text updated |
| `backend/api/ghg/inventory.php` | Auth fix: no more 403 for Deepwoods |
| `backend/api/ghg/s1.php` | Auth fix |
| `backend/api/ghg/s2.php` | Auth fix |
| `backend/api/ghg/s3.php` | Auth fix |
| `backend/api/ghg/intensity.php` | Auth fix |
| `backend/api/client-requests.php` | NEW — requests API |
| `backend/config.php` | admin_email updated (NEVER commit this file) |
| All of `dist-static/` | Frontend rebuilt with new admin tab + hooks |

**`backend/config.php` must be uploaded manually** — it is gitignored and not included in `dist-static/`. Update `admin_email` to `green@deepwoodsgreen.com` on the server copy.

### DB changes — none required
Migrations 001–004 were already run. `client_requests` table (migration 003) already exists. No new migration needed for this session's work.

### Testing priorities (in order)
1. **Request Access flow**: Submit `/request-access` form → check `green@deepwoodsgreen.com` inbox — notification should arrive with Reply-To pointing to `green.featherlite@deepwoodsgreen.com`
2. **403 fix**: Log in as `deepwoods_admin` → open DevTools Network → navigate pages — no more 403 on GHG endpoints
3. **Access Requests tab**: Log in as `deepwoods_admin` → `/admin` → "Access Requests" tab → should show all submitted requests with "Mark contacted", "Reject", "Accept & create client" buttons
4. **Convert flow**: Click "Accept & create client" on a request → fill form → submit → new client should appear in "Client Activation" tab as Pending
5. **Coordinator view**: Log in as `deepwoods_coordinator` → `/admin` → should see dedicated "Access Requests" page (not LockedState)
6. **Idempotency**: Try converting the same request twice → second attempt should fail with "already converted" error

---

## Previous Next Steps (from 2026-08-10 morning session)

### Previously outstanding migrations (all should now be in production DB)
1. `database/migrations/001_migrate_legacy_roles.sql` — legacy roles
2. `database/migrations/002_add_client_activation.sql` — activation gate
3. `database/migrations/003_add_client_requests.sql` — client_requests table
4. `database/migrations/004_add_invoice_fields.sql` — invoice tracking

### Previously outstanding testing
1. `/request-access` form → DB row inserted → email notification arrives
2. Admin → "Invite user" → temp password shown → user can log in and change password
3. Admin → "Invoice" → save invoice fields → persist on page reload
4. `/reporting` — entity names + FY = from context (not Featherlite)
5. `/green-finance` — years + base year from client config

### Remaining hardcoding (not blocking Alpha, blocking second client)
- `automation/generate_ghg_report.js` — fully Featherlite-specific; full rewrite needed
- `automation/Code.gs:38` — `CONSULTANT_EMAIL` hardcoded; should read from Config sheet
- `database/schema_combined.sql` — Featherlite seed data embedded; extract to `seed_featherlite.sql`

### Known outstanding bugs
- HP-1: Groq API keys client-side in `DeecarbAI.tsx` (security risk)
- Submissions facility dropdown always empty (`FACILITIES = []` in `_app.submissions.tsx`)
- `_app.methodology.tsx` — static Featherlite content; `useMethodology()` hook exists but page not wired

---

## Completed This Session (previous sub-sessions)

### Priority 3–6: GHG Automation Bootstrap + New-Client Validation (2026-08-08)

#### New files
- `backend/api/ghg/setup-client.php` — Admin endpoint to bootstrap a new client's Google Sheet (reads entity_scope_json, computes GHG Client IDs, calls Apps Script)
- `automation/Code.gs` — Added `_handleSetupNewClient` function (generic, idempotent; writes Master_Index row + GHG_Datapoints template rows from scopeConfig)
- `docs/PORTAL_USER_FLOW_STATUS.html` — Visual status document covering all 12 required sections (26 pages catalogued, multi-tenant audit, QA checklist, file index)

#### 5 bugs fixed
1. **CRITICAL** — `_app.submissions.tsx`: `entity_scope_json` scope filter always null (JSON.parse on already-decoded object). Scope-based card filtering was completely broken. Fixed.
2. **CRITICAL** — `ghg/setup-client.php`: S3 categories read from wrong key (`s3_boundary` vs correct `s3_categories`). All S3 datapoints silently skipped. Fixed.
3. **MODERATE** — `submit.php`: Missing `dolphin_require_active_client()` gate. Fixed.
4. **HIGH** — `decarb/assets.php`: `!== 'FL'` consolidated entity bypass. Fixed.
5. **HIGH** — `decarb/actions.php`: Same `!== 'FL'` bypass. Fixed.

#### New-client validation (12 checkpoints)
Checkpoints 1–5, 7–8, 10–12 verified by code inspection. Checkpoints 6, 9 require live Apps Script deployment.

---

## Completed This Session (previous sub-sessions)

### QA & Hardening Pass — All milestone bugs fixed (2026-08-08)

5 bugs fixed across the implemented milestone. See CHANGELOG.md for details.

Key fixes:
- `context.php`: Deepwoods staff (client_id = null) now receive a platform context instead of 403
- `auth.ts`: sustainability_team now has canUpload: true (ESG Manager can access submissions)
- `onboard.tsx`: authFetch pattern fixed; client name now loads correctly in orientation tour
- `_app.team.tsx`: "YOU" badge now works via getEmail() instead of nonexistent ctx.config.self_email
- `client-setup.php`: dead code removed

### Data Collection Handoff — Client Journey Milestone Complete (2026-08-08)

Full client journey through Data Collection handoff is now implemented end-to-end:

1. **`src/routes/setup.tsx`** — `SuccessState` two-CTA layout wired: "Start data collection" → `/submissions`, "Go to workspace first" → `/workstreams`. `handleDataCollection` handler added in `Setup()` component.
2. **`src/routes/_app.workstreams.tsx`** — Dismissible green "Start collecting data" nudge added after setup is complete (`decarb_data_collection_dismissed` localStorage key). `FileUp` icon added to imports.
3. **`src/routes/_app.submissions.tsx`** — First-time welcome callout shown when `visibleSubs.length === 0`; explains the download → fill → upload workflow.

TypeScript: 0 errors.

### Epic 2: Client Provisioning + Critical Bug Fixes (2026-08-08)

1. **`src/routes/setup.tsx`** — Fixed broken context pre-population (`authFetch` returns parsed data, not a Response; dead `res.ok` / `res.json()` pattern was killing entity/config loading silently)
2. **`backend/api/client-setup.php`** — Added `dolphin_require_active_client($user)` for defense-in-depth
3. **`backend/api/clients.php`** — NEW: GET/POST/PATCH endpoint for client provisioning (admin + coordinator can list; admin can create/update). Creates client + entities + default config atomically; new clients start `is_active = 0`.
4. **`src/lib/api.ts`** — `ApiClient` interface + `useClients()` hook
5. **`src/routes/_app.admin.tsx`** — Engagements tab wired to real DB data (removed DUMMY_CLIENTS + loadLsClients); `apiClientToEngagement()` mapping; "New client" button + `CreateClientModal`; `patchRelevance` crash fix

TypeScript: 0 errors.

---

## Completed This Session (previous sub-session)

### Activation Gate + Team Setup (2026-08-08)

1. **`database/migrations/002_add_client_activation.sql`** — migration for `is_active` + `activated_at` columns. Run before deploying this batch.
2. **`backend/api/db.php`** — `dolphin_require_active_client()` helper for server-side enforcement
3. **`backend/api/context.php`** — `is_active` included in client response
4. **`backend/api/team.php`** — GET/POST/DELETE team management (sustainability_team, scoped to own client)
5. **`backend/api/activate-client.php`** — GET/POST activation management (deepwoods_admin only)
6. **`src/lib/client-context.tsx`** — `is_active: boolean` added to `ClientInfo`
7. **`src/lib/api.ts`** — `ActivationClient` + `useActivationClients()`, `TeamMember` + `useTeamMembers()`
8. **`src/routes/_app.tsx`** — `PendingActivation` screen, activation check in `ClientContextGate`, Team nav item
9. **`src/routes/_app.team.tsx`** — Full team management page with invite modal, grouped list, role guide
10. **`src/routes/_app.workstreams.tsx`** — Dismissible "Invite your team" banner after setup complete
11. **`src/routes/_app.admin.tsx`** — "Client Activation" tab with real DB data and Activate/Deactivate buttons

TypeScript check: 0 errors.

### Approved Client Journey Implementation (2026-08-08)

Complete implementation of the approved client journey through Review & Confirm:

1. **`src/routes/onboard.tsx`** — Rewritten as 3-screen orientation tour (< 3 min, skippable). Was a 6-step data wizard. Sets `localStorage.decarb_orientation_done` on complete.
2. **`src/routes/setup.tsx`** — New Combined Annual Setup Wizard (3 steps: Org Boundary → Inventory Boundary → Review & Confirm). Per-entity scope config, consolidation approach, base year. POSTs to `client-setup.php`.
3. **`src/routes/_app.tsx`** — ClientContextGate: redirect now checks `localStorage.decarb_orientation_done` instead of `setup_complete === "false"`.
4. **`src/routes/_app.workstreams.tsx`** — Setup banner added: shows "Configure your GHG workspace" → `/setup` if `setup_complete !== "true"`.
5. **`backend/api/client-setup.php`** — Added `base_year` and `entity_scope_json` config keys.

TypeScript check: 0 errors.

### Onboarding Wizard Redesign + UI Quality Pass (2026-08-08)

Complete redesign of the client onboarding experience plus targeted UI improvements.

1. **`src/routes/onboard.tsx`** — Complete rewrite (~570 lines):
   - Correct 6-step client journey: Welcome → Organization → Reporting → Boundary → Emissions → Review
   - All fl_ localStorage keys removed — state is pure React (no localStorage)
   - Dynamic FY period label computed from selected start month (no hardcoded dates)
   - Pre-populates from `authFetch("context.php")` (existing entities, config)
   - Premium MSME-friendly UX: consultant tips, visual scope cards, radio choices with explanations
   - Auth guard: redirects to `/` if no session token
   - Saves via `POST /api/client-setup.php` on completion; clears sessionStorage context cache
   - All shadcn/ui + Tailwind — no injected CSS

2. **`backend/api/client-setup.php`** — NEW endpoint:
   - Accepts wizard payload: org profile, reporting config, entities, scope boundary
   - Atomic transaction: updates `clients`, upserts `client_config` keys, inserts new `client_entities`
   - Sets `setup_complete = 'true'` in client_config on success

3. **`src/routes/_app.tsx`** — Setup redirect:
   - `ClientContextGate` now redirects client-role users to `/onboard` if `config.setup_complete === "false"`
   - Existing clients (no setup_complete key) are not affected

4. **`src/components/portal.tsx`** — LockedState fix:
   - Replaced 🔒 emoji with `<Lock />` Lucide icon

### Epic 1: Auth & Role Foundation (2026-08-08)

All four implementation steps complete:

1. **`database/migrations/001_migrate_legacy_roles.sql`** — migration script created; removes `featherlite_team`, `featherlite_leadership`, `automation_demo` from the `users.role` ENUM after migrating existing users
2. **`database/schema_combined.sql`** — `users.role` ENUM updated to the 5 platform roles only
3. **`backend/api/users.php`** — `$validRoles` fixed (was `dolphin_team`, `dolphin_leadership`); `client_id` added to INSERT with validation; GET supports `?client_id=` filter; role↔client_id mutual exclusion enforced
4. **`backend/seed-users.php`** — roles updated to generic equivalents; `client_id` set correctly for Featherlite accounts

**Deployment action required by user:** Run `database/migrations/001_migrate_legacy_roles.sql` via phpMyAdmin before uploading the updated PHP files.

### Documentation Handoff (2026-08-07)
All project knowledge has been captured in structured documentation so any future Claude account can continue without conversation history.

New documents created:
- `CLAUDE_ONBOARDING.md` — first document every Claude reads (project root)
- `docs/PROJECT_CHARTER.md` — vision, mission, principles, things we'll never do
- `docs/PROJECT_CONTEXT.md` — full current state, architecture, what works, what doesn't
- `docs/TEAM_GUIDELINES.md` — coding rules, review process, definition of done
- `docs/DECISION_LOG.md` — all major architectural and product decisions with reasoning
- `docs/SESSION_HANDOFF.md` — this file
- `docs/PROJECT_STRUCTURE.md` — every folder explained
- `docs/DOCUMENT_INDEX.md` — master index of all docs
- `docs/PROJECT_MEMORY.md` — AI-specific context and philosophy

Market research files moved:
- `study/` → `platform/docs/market-research/` (7 files)
- `IMPLEMENTATION_BACKLOG.html` → `platform/docs/`

### Previously Completed (before this session)

**Platform Foundation (2026-08-06)**
- TypeScript errors: 99 → 0 across all 26 routes and components
- Featherlite hardcoding removed from route files (now use `useClientContext()`)

**Sprint 1 Security (2026-08-06)**
- HP-1: Groq API keys moved from browser bundle to `backend/api/ai.php` (server-side proxy)
- Cross-tenant auth: 4 endpoints fixed (`submissions.php`, `audit-log.php`, `metrics.php`, `submit.php`)
- `submit.php` entity validation now uses DB lookup instead of hardcoded `['FP','FOS']`

**Market Research (2026-08-07)**
- 7 documents, 25 competitors, $2B+ market analyzed
- Strategic vision documented in `docs/market-research/DESIGN_PATTERNS.md`

---

## Currently Working On

Nothing in progress — documentation session complete.

---

## Next Priority

**QA and deployment** — the complete client journey is implemented. Migrations and PHP files must be uploaded before testing end-to-end:

**Deploy and test** — migrations and PHP files must be uploaded:
1. Run `database/migrations/001_migrate_legacy_roles.sql` via phpMyAdmin (Epic 1 — legacy roles)
2. Run `database/migrations/002_add_client_activation.sql` via phpMyAdmin (activation gate)
3. Upload all updated PHP files to Hostinger `backend/api/`
4. Run `npm run build:fresh` → upload `dist-static/` to `public_html/`

**After deployment, verify:**
- Admin "Client Activation" tab loads real clients from DB
- Admin "Engagements" tab loads real clients, "New client" modal works
- New client starts Pending, can be activated from Activation tab
- Activated client sees Orientation on first login, then Workspace
- Setup wizard pre-populates existing entities from context
- Setup wizard POST saves config to DB (setup_complete = true)
- Team management page visible only to sustainability_team

**Next code work (post-deployment):**
- `dolphin_require_active_client()` should be added to `ghg/inventory.php` and `submissions.php` for defense-in-depth (all client-facing data endpoints)
- Admin Users tab: wire to `useUsers()` hook (create `users.php` GET listing for admin, or add `client_id` filter to existing endpoint)
- Submissions queue tab: wire to real submissions data
- Audit log tab: wire to real audit_log data

- Route: `/team` or modal from `/workstreams`
- Owner can invite: Owner, ESG Manager, Entity Manager, Data Submitter, Viewer, Auditor
- Show role-preview cards (from Decarb_Client_Journey.html Roles & Permissions tab)
- Deferrable: "Set up your team later" link on first prompt; banner only shows if team has 1 member
- Backend: `POST /api/users.php` already exists and accepts role + client_id
- After Team Setup: handoff into existing Data Collection (`/submissions`) is the next client action

**Then: Epic 2: Client Provisioning** — enables onboarding new clients without DB access.

**BLOCKER for the user:** Run `database/migrations/001_migrate_legacy_roles.sql` via phpMyAdmin before testing anything. Epic 1 code changes are deployed but the migration must run against production DB first.

### Epic 2 — Exactly what to do

**BLOCKER for the user:** Run `database/migrations/001_migrate_legacy_roles.sql` via phpMyAdmin before testing anything. Epic 1 code changes are deployed but the migration must run against production DB first.

### Epic 2 — Exactly what to do

See `docs/IMPLEMENTATION_BACKLOG.md` Epic 2 section for full details. Summary:

1. **Create `backend/api/clients.php`** — GET (list all), POST (create client + entities + default config atomically), PATCH (update), GET `?id=` (single)
2. **Wire `src/routes/onboard.tsx`** — replace localStorage state with React state; final step calls `POST /api/clients.php`; remove `fl_onboard_draft` key; derive `MONTHS_SHORT` from selected fiscal year start
3. **Wire `src/routes/_app.admin.tsx`** — Clients tab reads `useClients()` hook (remove `DUMMY_CLIENTS`); Users tab reads `useUsers()` hook; Submissions/Audit tabs filter by selected `client_id`; "Create User", "Activate", "Deactivate" buttons call API
4. **Add hooks to `src/lib/api.ts`** — `useClients()`, `useUsers(clientId?)` 

After Epic 2:
1. Create `backend/api/clients.php` (GET, POST, PATCH)
2. Wire `src/routes/onboard.tsx` final step to POST
3. Connect all 4 tabs in `src/routes/_app.admin.tsx` to live API data
4. Remove all `DUMMY_CLIENTS` static data and `fl_onboard_draft` localStorage references

Full details in `docs/IMPLEMENTATION_BACKLOG.md` Epic 2 section.

---

## Known Risks

| Risk | Severity | Notes |
|---|---|---|
| Legacy role users exist in production DB | High | Must run UPDATE before ALTER TABLE — order is critical |
| Hostinger PHP session limits | Medium | Bearer token auth mitigates this; no change needed |
| Groq API key fallbacks still in PHP source | Low | Acceptable for current hosting; not a security risk for private repo |
| No test suite | Medium | TypeScript check + manual testing is the only safety net |
| Single database for prod | Medium | No staging environment; test migrations carefully before running in prod |
| `DECARB_MILESTONES` hardcoded in progress page | Medium | Blocked on Epic 5; Featherlite dates show for all clients until then |

---

## Open Questions

1. **Second client timing**: When is the second client expected to onboard? This determines urgency of Epic 1–2.
2. **Deployment process**: Is there a staging environment, or does testing happen directly in Hostinger production?
3. **DB migration process**: How are migrations applied to production? FTP upload + run via phpMyAdmin?
4. **Groq API keys**: Should the hardcoded fallback keys in `backend/api/ai.php` be replaced with env vars now, or post-Epic-6?
5. **Mobile**: Is mobile experience in scope for the second client, or post-launch?
6. **BRSR compliance**: Is BRSR reporting output required for the second client, or just GHG Protocol?

---

## Files Recently Changed

| File | Change |
|---|---|
| `database/migrations/001_migrate_legacy_roles.sql` | NEW — Epic 1 migration script |
| `database/schema_combined.sql` | Epic 1 — legacy roles removed from ENUM |
| `backend/api/users.php` | Epic 1 — validRoles fixed; client_id in INSERT; GET filter |
| `backend/seed-users.php` | Epic 1 — roles updated to generic; client_id set |
| `src/routes/_app.submissions.tsx` | Epic 1 — stale automation_demo comment removed |
| `docs/CHANGELOG.md` | Epic 1 entry added |

---

## Recommended First Message for Next Session

> "Continue with Epic 2: Client Provisioning. Start by reading `docs/SESSION_HANDOFF.md` and `docs/IMPLEMENTATION_BACKLOG.md` Epic 2 section. Note: the user must run `database/migrations/001_migrate_legacy_roles.sql` via phpMyAdmin before Epic 2 can be tested end-to-end."
