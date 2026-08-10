# TODO

Remaining work items, known issues, and upcoming tasks. Organized by priority.

---

## Critical (blocking production use for new clients)

### CT-1: Remove hardcoded Featherlite roles from DB schema
**File:** `backend/schema_combined.sql` (line ~107), `backend/api/db.php`  
**Issue:** The `users.role` ENUM still includes `featherlite_team`, `featherlite_leadership`, and `automation_demo` as valid values. These are client-specific and should not be in the platform schema.  
**Fix:** Migrate existing users to generic roles (`sustainability_team`, `client_leadership`). Remove Featherlite-specific ENUM values. Remove `automation_demo` role (replace with a config flag).

### CT-2: Complete API wiring for all pages
**Issue:** Several pages still read from `src/data/featherlite.ts` static data instead of the API. These pages must be wired to API hooks before a second client can be added.  
**Pages to wire:**
- `_app.hotspots.tsx` — reads from `featherlite.ts` ASSETS/INVENTORY
- `_app.action-plan.tsx` — reads from `decarb-data.ts` ACTIONS/LEVERS
- `_app.progress.tsx` — reads from `decarb-data.ts` MILESTONES/COMMITTED_VS_ACTUAL
- `_app.peer.tsx` — partially wired, check for static fallbacks
- `_app.green-finance.tsx` — reads CARBON_PRICES/IREC_FACTOR from `master.ts`
- `_app.trends.tsx` — YEARS/INV undefined (pre-existing bug, line 37 and 44)
- `_app.credits.tsx` — check for static fallbacks
- `_app.workstreams.tsx` — CLUSTERS come from `featherlite.ts`
- `_app.methodology.tsx` — METHODOLOGY comes from `featherlite.ts`

### CT-3: Fix pre-existing TypeScript errors
**Files:**
- `_app.trends.tsx` line 37: `YEARS` undefined
- `_app.trends.tsx` line 44: `INV` undefined
- `_app.reporting.tsx`: `Property 'subtitle' does not exist` type error

### CT-4: Retire `src/data/featherlite.ts` as static data source
Once CT-2 is complete, `featherlite.ts` should no longer be imported by any page. At that point it can be moved to `_archive/data/` and the sync script retired.

---

## High Priority

### HP-1: Move DeecarbAI API keys server-side
**File:** `src/components/DeecarbAI.tsx`  
**Issue:** 5 Groq API keys are hardcoded in the client-side component — visible in the browser source.  
**Fix:** Create a server-side proxy endpoint `/backend/api/ai-chat.php` that holds the keys and proxies to Groq.

### HP-2: Add per-client Groq/AI configuration
**Issue:** The AI model and API keys are hardcoded. In a multi-client SaaS, each client may have their own AI API key or the platform should have one shared key server-side.

### HP-3: Admin page — wire to real API
**File:** `src/routes/_app.admin.tsx`  
**Issue:** Admin page uses placeholder/hardcoded data. Needs real API integration with `users.php`, `submissions.php`, `audit-log.php`.

### HP-4: Implement onboarding flow in DB
**File:** `src/routes/onboard.tsx`  
**Issue:** The onboarding wizard collects data but there's no backend endpoint to persist it. Currently stored in localStorage.  
**Fix:** Create `POST /backend/api/onboard.php` that creates `clients`, `client_entities`, `client_config`, and initial `users` rows.

### HP-5: Reporting cycle simulator (`/reporting`) — production behaviour
**File:** `src/routes/_app.reporting.tsx`  
**Issue:** The reporting cycle simulator is only shown to `automation_demo` role. In production, it should be accessible to `deepwoods_admin` for real cycle management.

---

## Medium Priority

### MP-1: Extract large inline components
Large components are defined inline in route files making them hard to test and reuse.

| Route | Inline Component | Extract to |
|---|---|---|
| `_app.dashboard.tsx` | S2WaterfallChart, S2SankeyChart | `src/components/charts/` |
| `_app.inventory.tsx` | AssetDrawer, FacilityCard | `src/components/inventory/` |
| `_app.action-plan.tsx` | LeverCard, ScenarioPanel | `src/components/decarb/` |
| `_app.submissions.tsx` | DatasetCard, FileUploadZone | `src/components/submissions/` |

### MP-2: Add TypeScript types directory
**Issue:** Types are scattered across `src/lib/*.ts` and `src/data/*.ts`. A dedicated `src/types/` directory would improve discoverability.

### MP-3: Environment variable documentation
**Issue:** No `.env.example` file at project root. Developers must read `CLAUDE.md` to know what env vars are needed.  
**Fix:** Create `.env.example` with all required variables and documentation.

### MP-4: Fix `abatementFor`/`costFor` undefined field references
**File:** `src/components/decarb/shared.tsx`  
**Issue:** `abatementFor()` and `costFor()` reference `action.impactMin`, `action.impactMax`, `action.costPerT` — fields not declared in the `DecarbAction` TypeScript interface and not returned by the current API. These calculations produce `NaN` silently.  
**Fix:** Either (a) add `impact_min`, `impact_max`, `cost_per_t` columns to `decarb_actions` table and update the interface, or (b) compute from `abatement_t` already in the interface.

### MP-5: Update `AGENTS.md` to remove Featherlite-specific content
**File:** `AGENTS.md`  
**Issue:** Contains Featherlite-specific entity table (FP/FOS/FL) that should describe the generic platform. Read by AI agents and should not reference a specific client.

### MP-6: Remove `.~lock.*` files from gitignore
**Fix:** Add `*.~lock.*` to `.gitignore`. (Lock file itself was deleted 2026-08-06.)

### MP-7: `client_context.tsx` — handle context expiry
**Issue:** `sessionStorage` context is never refreshed within a tab session. If config changes (e.g. pages enabled/disabled), the user won't see it until they log out and in again.

---

## Low Priority / Future

### LP-1: Multi-hierarchy support
**Issue:** The platform assumes a flat entity structure (entities directly under a client). Future clients may need Organisation → Companies → Facilities.  
**See:** `docs/MULTI_TENANT_READINESS.md` for design notes.

### LP-2: TypeScript strict null checks on API responses
**Issue:** API response types in `src/lib/api.ts` are loose. Some hooks use `any`.  
**Fix:** Add proper response interfaces and enable stricter TypeScript for the API layer.

### LP-3: Migrate from Hostinger shared hosting
**Issue:** Shared hosting limits concurrency and prevents background jobs.  
**Target:** Cloudways, Railway, or dedicated VPS.

### LP-4: Add tests
**Issue:** No test suite exists.  
**Start with:** Unit tests for `src/lib/` (auth, client-context, api hooks), then E2E for critical paths (login, submission flow).

### LP-5: Replace `ghg-api.php` with proper split endpoints
**File:** `backend/api/ghg-api.php`  
**Issue:** This is a large monolithic API file from the Featherlite-GHG era. The multi-client split endpoints in `backend/api/ghg/` should fully replace it.

### LP-6: Approval Form for GHG automation
**File:** `reporting-platform/Code.gs` (day 8 logic)  
**Issue:** The Google Form for report approval hasn't been created.  
**Fix:** Create Google Form with 4 fields (Client ID, Decision, Report Draft, Rework Comments), run `setupApprovalFormTrigger()` once.

### LP-7: Data submission templates — rebrand for generic use
**Files:** `public/templates/Featherlite_Scope*.xlsx`  
**Issue:** Templates are branded for Featherlite. Need generic templates for new clients.

### LP-8: Review and remove `debug_login.php`
**File:** `backend/api/debug_login.php`  
**Issue:** Undocumented debug endpoint in the live API directory. Review whether it bypasses auth or exposes sensitive data before deploying. If safe but no longer needed, delete or move to `_archive/`.

### LP-9: Remove `lovable-error-reporting.ts` dead code
**File:** `src/lib/lovable-error-reporting.ts`  
**Issue:** Reports to `window.__lovableEvents` (Lovable.dev platform hook). Dead code since moving to Claude Code. Delete and remove all imports.

---

## Known Bugs

| Bug | File | Notes |
|---|---|---|
| `YEARS` undefined at line 37 | `_app.trends.tsx` | Pre-existing; import not updated after refactor |
| `INV` undefined at line 44 | `_app.trends.tsx` | Same cause |
| `Property 'subtitle' does not exist` | `_app.reporting.tsx` | Pre-existing TypeScript error |
| Null bytes after large file edits | Large `.tsx` files | See CLAUDE.md for fix procedure |
