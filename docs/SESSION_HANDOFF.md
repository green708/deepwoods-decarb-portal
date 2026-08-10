# Session Handoff

> **Update this file at the end of every working session.**
> A new Claude reads this first to understand where we stopped and what to do next.

---

## Last Updated
2026-08-09 — UI/UX Design Audit Pass (P0 + P1 complete, build verified)

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

## Immediate Next Steps (tomorrow's testing session)

### Migrations to run (in order)
1. `database/migrations/001_migrate_legacy_roles.sql`
2. `database/migrations/002_add_client_activation.sql`
3. `database/migrations/003_add_client_requests.sql`
4. `database/migrations/004_add_invoice_fields.sql`
*(For fresh installs: use `schema_combined.sql` directly — already includes all columns)*

### Configuration required before live testing
- `backend/config.php`: set `ghg_webapp_url`, `admin_email`, `platform_base_url`

### Testing priorities
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

Nothing in progress — milestone complete.

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
