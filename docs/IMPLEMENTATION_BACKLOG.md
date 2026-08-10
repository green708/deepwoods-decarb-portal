# Implementation Backlog — Multi-Client Platform

**Goal:** Once all Epics are complete, the platform can onboard any new client without code changes.

**Status:** Sprint 1 (Security) complete. Sprints 2–4 map to Epics 1–6 below.

---

## Dependency Order

```
EPIC-1 (Auth & Role Foundation)
  └─► EPIC-2 (Client Provisioning)
        └─► EPIC-3 (White-Label Communications)
              └─► EPIC-5 (Per-Client Config & Analytics)
                    └─► EPIC-6 (Product Bug Fixes)
  └─► EPIC-4 (Consolidated Entity Logic) ──────► EPIC-5
```

---

## Summary

| Epic | Title | Effort | Blockers |
|------|-------|--------|----------|
| 1 | Auth & Role Foundation | 1 day | C-1, A-3 |
| 2 | Client Provisioning | 5 days | A-1, A-2 |
| 3 | White-Label Communications | 2 days | B-1, B-2, B-3 |
| 4 | Consolidated Entity Logic | 0.5 day | C-2 |
| 5 | Per-Client Config & Analytics | 3 days | B-4, E-1, E-2 |
| 6 | Product Bug Fixes | 2 days | D-1, F-1, F-2, F-3 |
| **Total** | | **~13–14 days** | **15 blockers** |

---

## EPIC-1 — Auth & Role Foundation

**Blockers:** C-1 (CT-1 legacy DB roles), A-3 (users.php wrong validRoles)

**Business objective:** No authenticated user is silently logged out. New users can be created via the API with the correct platform roles.

**Technical objective:** Remove `featherlite_team`, `featherlite_leadership`, `automation_demo` from the `users.role` ENUM. Migrate existing users to generic roles. Fix `users.php` `$validRoles`.

**Dependencies:** None — root dependency for all other Epics.

**Estimated effort:** 1 day

### Definition of Done
- `role` ENUM contains exactly: `sustainability_team`, `client_uploader`, `client_leadership`, `deepwoods_admin`, `deepwoods_coordinator`
- All existing users have valid generic roles (migration run before ALTER)
- `users.php POST` accepts exactly those five roles and rejects all others with 400
- A new user with any valid role can log in without silent logout

### Files Affected
- `database/schema_combined.sql` — ALTER TABLE definition
- `database/migrations/001_migrate_legacy_roles.sql` — NEW migration script
- `backend/api/users.php` — update `$validRoles`; add `client_id` to INSERT

### Database Changes
```sql
-- Run BEFORE the ALTER:
UPDATE users SET role = 'sustainability_team' WHERE role IN ('featherlite_team', 'automation_demo');
UPDATE users SET role = 'client_leadership'   WHERE role = 'featherlite_leadership';

-- Then alter the ENUM:
ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'sustainability_team', 'client_uploader', 'client_leadership',
    'deepwoods_admin', 'deepwoods_coordinator'
  ) NOT NULL DEFAULT 'sustainability_team';
```

### API Changes
- `users.php` — `$validRoles` updated to 5 platform roles
- `users.php POST` — add `client_id` to INSERT; validate `client_id` exists in `clients` table

### UI Changes
None. Role guards in `_app.tsx` resolve correctly once the ENUM is fixed.

### Testing Checklist
- [ ] Existing Featherlite users with legacy roles can log in after migration
- [ ] `POST /api/users.php` with `role=featherlite_team` → 400
- [ ] `POST /api/users.php` with `role=sustainability_team` + valid `client_id` → 201
- [ ] New `sustainability_team` user logs in without silent logout
- [ ] New `client_uploader` user logs in without silent logout
- [ ] `ROLE_META` in `_app.tsx` resolves correctly for all five roles

---

## EPIC-2 — Client Provisioning

**Blockers:** A-1 (onboarding wizard zero API), A-2 (admin console zero API)

**Business objective:** Deepwoods staff can onboard a new client end-to-end through the portal — company details, entities, fiscal year configuration, first user — without any direct database or server access.

**Technical objective:** Build `backend/api/clients.php` CRUD endpoint. Wire `onboard.tsx` final step to POST. Connect admin console's four tabs to live API data. Remove all `fl_`-prefixed localStorage keys.

**Dependencies:** EPIC-1 (valid roles required to create users correctly)

**Estimated effort:** 5 days

### Definition of Done
- Completing the onboarding wizard creates rows in `clients`, `client_entities`, `client_config` atomically
- Admin console client list reads from the database — `DUMMY_CLIENTS` removed
- Admin console can create a user for any client with any valid role
- Admin submissions queue and audit log tab show real, client-scoped data
- No `fl_clients` or `fl_onboard_draft` keys written to localStorage

### Files Affected
- `backend/api/clients.php` — NEW: CRUD for clients
- `src/routes/onboard.tsx` — wire all 7 steps; replace localStorage with session state
- `src/routes/_app.admin.tsx` — connect all 4 tabs to real API data; remove DUMMY_CLIENTS
- `backend/api/users.php` — GET filtered by admin scope; POST extended (from Epic 1)
- `src/lib/api.ts` — add `useClients()` hook

### Database Changes
None — `clients`, `client_entities`, `client_config` tables already exist. This Epic populates them via the API.

### API Changes (new endpoint: `clients.php`)
- `GET /api/clients.php` — list all clients (deepwoods_admin only)
- `POST /api/clients.php` — create client + entities + default config rows atomically
- `PATCH /api/clients.php?id=` — update client name or config values
- `GET /api/clients.php?id=` — get single client detail
- Duplicate slug → 409 with descriptive error

### UI Changes
- `onboard.tsx` — remove all `localStorage` state persistence; buffer in React state only; final step calls `POST /api/clients.php`; `MONTHS_SHORT` derived from the selected fiscal year start, not hardcoded; `fl_onboard_draft` key removed
- `_app.admin.tsx` — Clients tab: `useClients()` instead of `DUMMY_CLIENTS`; Users tab: `useUsers()` hook; Submissions tab: `useSubmissions({ clientId })`; Audit tab: `useAuditLog({ clientId })`; wire "Create User", "Activate", "Deactivate" buttons to API

### Testing Checklist
- [ ] Completing onboarding wizard creates client row in DB
- [ ] Completing onboarding wizard creates entity rows for each entity entered
- [ ] Completing onboarding wizard creates default `client_config` rows
- [ ] Admin console client list shows real clients from DB
- [ ] Admin console shows Client B alongside Client A after onboarding
- [ ] Admin can create a user for Client B with role `sustainability_team`
- [ ] Admin submissions queue filters to selected client
- [ ] Admin audit log filters to selected client
- [ ] Duplicate slug rejected with 409
- [ ] No `fl_clients` or `fl_onboard_draft` in localStorage after any flow

---

## EPIC-3 — White-Label Communications

**Blockers:** B-1 (forgot-password "Featherlite GHG Portal"), B-2 (Smtp.php hardcoded fromName), B-3 (send-notification hardcoded URL + static content)

**Business objective:** Every automated email — password resets, notification digests, status updates — is branded to the correct client. No email to Client B mentions Featherlite's name or links to Featherlite's portal URL.

**Technical objective:** Remove all "Featherlite GHG Portal" string literals from the PHP mail layer. Replace with dynamic lookups: sender name from `client_config.portal_name`, portal URL from `client_config.portal_url`, notification content from the `priority_items` table.

**Dependencies:** EPIC-2 (clients must exist in DB with `portal_name` and `portal_url` config rows)

**Estimated effort:** 2 days

### Definition of Done
- Password reset email subject and body use the client's `portal_name` from `client_config`
- `Smtp.php` `$fromName` is a parameter, not a hardcoded constant
- Notification digest links to the client's `portal_url` from `client_config`
- Notification content pulled from `priority_items` table — static `$ACTION_ITEMS` / `$UPDATE_ITEMS` arrays removed
- `grep "Featherlite" backend/api/forgot-password.php backend/api/Smtp.php backend/api/send-notification.php` returns zero matches

### Files Affected
- `backend/api/forgot-password.php`
- `backend/api/Smtp.php`
- `backend/api/send-notification.php`
- `database/migrations/002_client_config_comms_keys.sql` — NEW: seed `portal_name`, `portal_url` for existing clients

### Database Changes
New `client_config` keys (seeded for Featherlite by migration; required fields in Epic 2 onboarding):
- `portal_name` — e.g. `"Featherlite GHG Portal"`
- `portal_url` — e.g. `"https://featherlite.sustainablyyours.me"`

### API Changes
- `forgot-password.php` — JOIN `users → clients`; use `clients.name` (or `client_config.portal_name`) in subject/body
- `Smtp.php` — accept `$fromName` as constructor argument; remove hardcoded default; update EHLO to use a config-sourced hostname
- `send-notification.php` — replace `$PORTAL_URL` with `getConfig($pdo, $clientId, 'portal_url')`; replace `$ACTION_ITEMS` / `$UPDATE_ITEMS` with `SELECT * FROM priority_items WHERE client_id = ? ORDER BY priority DESC LIMIT 5`

### UI Changes
None.

### Testing Checklist
- [ ] Password reset email for Client B references Client B's `portal_name`, not "Featherlite GHG Portal"
- [ ] Password reset email for Client A (Featherlite) still shows "Featherlite GHG Portal" (from DB)
- [ ] Notification digest for Client B links to Client B's `portal_url`
- [ ] Notification content reflects Client B's actual `priority_items` rows
- [ ] Email sender "from" name does not contain "Featherlite" for Client B
- [ ] EHLO hostname does not contain "featherlite"
- [ ] grep for "Featherlite" in the three PHP files returns zero matches

---

## EPIC-4 — Consolidated Entity Logic

**Blockers:** C-2 (`decarb/actions.php` + 3 siblings: `$entity !== 'FL'` check)

**Business objective:** All decarbonisation and credits endpoints return correct results for any client, regardless of what their consolidated entity is named.

**Technical objective:** Replace the hardcoded `$entity !== 'FL'` check in four PHP endpoints with a DB-driven consolidated entity lookup per client.

**Dependencies:** EPIC-1 (`$authUser['client_id']` must be reliable — it is after Epic 1)

**Estimated effort:** 0.5 day

### Definition of Done
- `decarb/actions.php`, `decarb/assets.php`, `credits/irec.php`, `credits/grid-mwh.php` determine consolidated status by querying `client_entities WHERE client_id = ? AND is_consolidated = 1`
- Passing a consolidated entity code for ANY client returns all-entity data (no filter applied)
- Passing a non-consolidated entity code returns only that entity's data
- Featherlite behaviour unchanged (FL still returns all-entity data)
- The string literal `'FL'` does not appear in any of the four files

### Files Affected
- `backend/api/decarb/actions.php`
- `backend/api/decarb/assets.php`
- `backend/api/credits/irec.php`
- `backend/api/credits/grid-mwh.php`

### Database Changes
None — uses existing `client_entities.is_consolidated` column.

### API Changes
Same request/response shape. Internal SQL filter logic changes from:
```php
if ($entity && $entity !== 'FL') { /* apply entity filter */ }
```
to:
```php
$stmt = $pdo->prepare('SELECT code FROM client_entities WHERE client_id = ? AND is_consolidated = 1');
$stmt->execute([$clientId]);
$consolidatedCode = $stmt->fetchColumn();
if ($entity && $entity !== $consolidatedCode) { /* apply entity filter */ }
```

### UI Changes
None.

### Testing Checklist
- [ ] Featherlite: `GET decarb/actions.php?entity=FL` returns all actions (FL is consolidated)
- [ ] Featherlite: `GET decarb/actions.php?entity=FP` returns FP-only actions
- [ ] Client B: `GET decarb/actions.php?entity=<consolidated code>` returns all actions
- [ ] Client B: `GET decarb/actions.php?entity=<leaf code>` returns filtered actions
- [ ] `grep -r "!== 'FL'" backend/api/decarb/ backend/api/credits/` → zero matches
- [ ] Same four tests pass for `assets.php`, `credits/irec.php`, `credits/grid-mwh.php`

---

## EPIC-5 — Per-Client Configuration & Analytics

**Blockers:** B-4 (methodology page static), E-1 (base years hardcoded FY22/FY24 in 5 pages), E-2 (progress milestones hardcoded)

**Business objective:** Every analytics page displays baselines, reduction targets, and milestones specific to each client's own configuration — not Featherlite's FY22 base year, 42% SBTi target, and specific SBTi timeline.

**Technical objective:** Replace all hardcoded `"FY22"` / `"FY24"` / `1150` / `0.042` literals in five pages with values from `ctx.targets` and `ctx.config`. Rewrite `_app.methodology.tsx` to be fully data-driven. Ensure `context.php` returns all required config keys.

**Dependencies:** EPIC-2 (Client B must be provisioned with config rows) + EPIC-4 (entity access correct)

**Estimated effort:** 3 days

### Definition of Done
- All five pages read base years from `ctx.targets.s12_base_year` / `ctx.targets.s3_base_year`
- Methodology page renders the correct consolidation approach, base years, S3 boundary, and grid EF for the authenticated client — no static Featherlite content remains
- Progress milestones are generated from `ctx.targets` fields — `DECARB_MILESTONES` static array removed
- A client with `s12_base_year = 'FY23'` sees FY23 as their baseline on all five pages without any code change
- TypeScript: 0 errors after all changes

### Files Affected
- `src/routes/_app.methodology.tsx` — full rewrite
- `src/routes/_app.overview.tsx`
- `src/routes/_app.trends.tsx`
- `src/routes/_app.action-plan.tsx`
- `src/routes/_app.green-finance.tsx`
- `src/routes/_app.progress.tsx`
- `backend/api/context.php` — ensure `grid_ef`, `consolidation_approach`, `s3_boundary_json` in response
- `database/migrations/003_client_config_analytics_keys.sql` — NEW: seed analytics config keys for Featherlite

### Database Changes
New default `client_config` keys (seeded for Featherlite by migration; required in Epic 2 onboarding):
- `grid_ef` — grid emission factor (e.g. `"0.727"`)
- `consolidation_approach` — e.g. `"Operational Control"`
- `s3_boundary_json` — JSON array of included Scope 3 categories
- `fiscal_year_start_month` — integer 1–12
- `sbti_target_year` — year of SBTi commitment (or null if uncommitted)
- `netzero_year` — target net-zero year (or null)

### API Changes
- `context.php` — include `grid_ef`, `consolidation_approach`, `s3_boundary_json`, `fiscal_year_start_month` in the `config` object returned to the frontend

### UI Changes
- `_app.methodology.tsx` — replace every static fact with `ctx.config.*` / `ctx.targets.*`; render a placeholder block if a config key is absent
- `_app.overview.tsx` — `"FY22"` → `ctx.targets.s12_base_year ?? ctx.reporting_years[0]`
- `_app.trends.tsx` — same base year substitution; remove "Cats 4 & 12 first reported FY25" annotation
- `_app.action-plan.tsx` — glidepath terminal target from `ctx.targets.sbti_target_s12`; year axis from `ctx.reporting_years` extended by projected years; remove `1150` magic number
- `_app.green-finance.tsx` — `FYS = ctx.reporting_years`; replace `slices.find(s => s.fy === "FY22")!` with null-safe lookup using `ctx.targets.s12_base_year`
- `_app.progress.tsx` — remove `DECARB_MILESTONES`; generate milestone objects from `ctx.targets` (`base_year_s12`, `sbti_target_year`, `netzero_year`); a client with no SBTi commitment shows no SBTi milestone card

### Testing Checklist
- [ ] Client A (Featherlite, FY22) — all 5 pages show FY22 as baseline (regression)
- [ ] Client B (FY23) — all 5 pages show FY23 as baseline without code change
- [ ] Methodology page shows Client B's consolidation approach from DB
- [ ] Methodology page shows Client B's S3 boundary from DB
- [ ] Green Finance renders without crash for a client with base year FY23
- [ ] Progress page shows no SBTi milestone for a client with `sbti_target_year = null`
- [ ] Action plan glidepath terminal target reflects Client B's SBTi % target
- [ ] TypeScript: 0 errors after all changes

---

## EPIC-6 — Product Bug Fixes

**Blockers:** D-1 (Green Finance FY22 non-null assertion), F-1 (peer page blank), F-2 (ScenarioProvider empty levers), F-3 (vault upload no-op)

**Business objective:** Peer benchmarking, scenario planning, and the document vault work correctly for all clients. No page crashes at runtime due to unguarded data-shape assumptions.

**Technical objective:** Fix the FY key format mismatch in `_app.peer.tsx`; wire `ScenarioProvider` to `useDecarbActions()`; implement a real vault upload API call; guard Green Finance against a missing base-year entry (overlaps with Epic 5 guard).

**Dependencies:** EPIC-5 (data layer correct before testing feature-level behaviour; Green Finance non-null assertion resolved in Epic 5)

**Estimated effort:** 2 days

### Definition of Done
- Peer benchmarking cards show actual emissions figures for all peers with DB data
- Scenario Builder computes non-zero abatement when at least one lever is enabled
- Vault upload modal calls `POST /api/vault.php` and shows success only after server confirms receipt
- `ScenarioProvider` — the two `[] as Action[]` literals replaced with live `useDecarbActions()` data
- TypeScript: 0 errors

### Files Affected
- `src/routes/_app.peer.tsx`
- `src/components/decarb/shared.tsx`
- `src/routes/_app.vault.tsx`
- `backend/api/vault.php` — extend to handle POST (insert `vault_documents` row)

### Database Changes
None — `vault_documents` table already exists.

### API Changes
- `vault.php POST` — insert a `vault_documents` row; authenticated, scoped to authenticated client; request body: `{ entity, fy, title, type, drive_link }`; returns the new row

### UI Changes
- `_app.peer.tsx` — `getLatestTotal`: iterate `Object.keys(p.totals)` (calendar-year keyed) rather than `reporting_years` (FY-format keyed); or convert `p.totals` keys to FY format at construction so both sides use the same format
- `src/components/decarb/shared.tsx` / `ScenarioProvider`:
  - Add `const { data: actions = [] } = useDecarbActions();` inside the provider
  - Replace both `[] as Action[]` literals with `actions`
  - Add `actions` to the `totals` useMemo dependency array
- `_app.vault.tsx` — wire upload modal submit handler to `authFetch("vault.php", { method: "POST", body: JSON.stringify(metadata) })`; show success only on `res.ok`; show error message on failure

### Testing Checklist
- [ ] Peer card for a peer with DB data shows a non-zero emissions figure
- [ ] Peer comparison chart values and peer card figures are numerically consistent
- [ ] Enabling a lever in Scenario Builder produces non-zero `abatement` and `cost`
- [ ] Saving a scenario persists a non-zero abatement value
- [ ] Vault upload: submitting modal calls `POST /api/vault.php`
- [ ] Vault upload: success message appears only after server returns 200
- [ ] Vault upload: error message shown on 4xx/5xx response
- [ ] Vault document list refreshes after successful upload
- [ ] TypeScript: 0 errors after all changes

---

## Total Effort

| Epic | Effort | Unlocks |
|------|--------|---------|
| 1 — Auth & Role Foundation | 1 day | All other Epics |
| 2 — Client Provisioning | 5 days | Epic 3 (clients must exist before testing comms) |
| 3 — Communications & Branding | 2 days | Epic 5 (portal_name / portal_url config seeded) |
| 4 — Consolidated Entity Logic | 0.5 day | Epic 5 (entity filter correct) |
| 5 — Per-Client Configuration | 3 days | Epic 6 (data layer correct) |
| 6 — Product Bug Fixes | 2 days | Platform complete |
| **Total** | **~13–14 days** | |
