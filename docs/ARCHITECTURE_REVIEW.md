# Architecture Review

Code quality findings, technical debt, and architectural issues identified during the Phase 7 review.

**Review date:** 2026-08-06  
**Scope:** Full codebase — `src/`, `backend/`, `scripts/`

---

## Summary

| Category | Count | Severity |
|---|---|---|
| Hardcoded customer logic | 8 | High |
| Large components | 5 | Medium |
| Duplicate logic | 4 | Medium |
| Potential bugs | 3 | High |
| Security issues | 2 | High |
| Scalability issues | 3 | Medium |
| Technical debt | 9 | Low–Medium |

---

## High Severity

### ARC-H1: Groq API Keys in Client-Side Code
**File:** `src/components/DeecarbAI.tsx`  
**Issue:** 5 Groq API keys are hardcoded directly in a React component that ships to the browser. Any user can inspect the page source and extract all 5 keys.  
**Risk:** API key theft, rate limit exhaustion, billing fraud.  
**Fix:** Move Groq calls to a server-side proxy endpoint (`backend/api/ai-chat.php`). Keys go in `config.php`.

### ARC-H2: Featherlite-Specific Roles in DB ENUM
**File:** `backend/schema_combined.sql` line 103–108  
**Issue:** The `users.role` ENUM hardcodes `featherlite_team`, `featherlite_leadership`, and `automation_demo`. ENUM types in MySQL cannot be changed without a full table ALTER — meaning these legacy values will persist in production and create confusion.  
**Risk:** Adding a new role or removing a legacy one requires a full DB migration; `automation_demo` reveals internal testing infrastructure to all DB readers.  
**Fix:** Convert `role` from ENUM to `VARCHAR(50)` with a separate `roles` config table for valid values.

### ARC-H3: Pre-existing Runtime Errors in `_app.trends.tsx`
**File:** `src/routes/_app.trends.tsx` lines 37, 44  
**Issue:** `YEARS` and `INV` are referenced but not imported or defined. The page will crash on load for any user.  
**Fix:** Import `YEARS` from `useClientContext()` and `INV` from `useInventory()` hook.

### ARC-H4: No Input Validation on PHP Endpoints
**File:** `backend/api/*.php`  
**Issue:** Most PHP endpoints do minimal input validation. For example, `submit.php` accepts any `entity` value without verifying it belongs to the authenticated user's client. An authenticated user could submit data for another client's entity by passing a different `entity` value.  
**Risk:** Data injection across client boundaries.  
**Fix:** Every endpoint that accepts `entity` or any client-scoped parameter must validate it against the user's `client_id` in the DB before processing.

---

## Medium Severity

### ARC-M1: Large Route Files (God Components)
Several route files exceed 40 KB and contain complex logic that should be extracted into separate components:

| File | Size | Main Issue |
|---|---|---|
| `_app.submissions.tsx` | 49 KB | FileUpload, SubmissionTable, DatasetCard all inline |
| `onboard.tsx` | 61 KB | 7-step wizard with all steps inline |
| `_app.action-plan.tsx` | 42 KB | ScenarioPanel, LeverSlider, AbatementChart inline |
| `_app.dashboard.tsx` | 44 KB | S2WaterfallChart, S2SankeyChart, FuelPieChart inline |
| `_app.green-finance.tsx` | 39 KB | CarbonPriceCard, PnLChart, CBAMTable inline |

**Risk:** Difficult to test, reuse, or maintain. Changes risk regressions.  
**Fix:** Extract inline components to `src/components/features/<feature>/`.

### ARC-M2: Static Data Files Still Used by Live Pages
**Files:** `src/data/featherlite.ts`, `src/data/decarb-data.ts`  
**Issue:** Multiple pages still import from static data files instead of using API hooks. This creates a two-source-of-truth problem and prevents the pages from working for clients other than Featherlite.  
**Pages affected:** See `docs/TODO.md` CT-2.  
**Fix:** Wire all pages to API hooks; retire static data files.

### ARC-M3: `ghg-api.php` — Legacy Monolith Not Removed
**File:** `backend/api/ghg-api.php` (13 KB)  
**Issue:** This is the original monolithic GHG API from the Featherlite-GHG era. The split endpoints (`backend/api/ghg/`) were created as its replacement, but `ghg-api.php` still exists and may still be called by some pages.  
**Fix:** Audit all API calls in the frontend to confirm no page calls `ghg-api.php`. Archive it once confirmed.

### ARC-M4: Entity Context Leakage in SQL
**File:** `backend/api/ghg/inventory.php` (and similar)  
**Issue:** The `entity` parameter is passed directly to SQL queries. For consolidated entities (e.g. "FL"), the query may need to JOIN or UNION across child entities — but the current endpoints may not handle this correctly for all clients.  
**Risk:** Consolidated views return wrong data for clients with different consolidation structures.  
**Fix:** `context.php` should communicate `consolidates` to the backend; the ghg endpoints should aggregate child entity data when the requested entity `is_consolidated=true`.

### ARC-M5: Hardcoded `featherlite` Slug in `submissionsStore.ts`
**File:** `src/lib/submissionsStore.ts`  
**Issue:** The slug `featherlite` is hardcoded when building the API URL for submissions.  
**Fix:** Read `client.slug` from `useClientContext()` and pass it to the submission store.

### ARC-M6: No Error Boundaries on Individual Pages
**File:** `src/routes/__root.tsx`  
**Issue:** There's a root-level error boundary but no per-page boundaries. A crash in one page (e.g. the trends page crash) could potentially affect the whole app depending on routing.  
**Fix:** Wrap each `_app.*.tsx` route in a local `<ErrorBoundary>` with a "page failed to load" fallback.

---

## Scalability Issues

### ARC-S1: No Pagination on List Endpoints
**Files:** `backend/api/submissions.php`, `backend/api/audit-log.php`, `backend/api/ghg_inventory` queries  
**Issue:** Endpoints return all records without pagination. For clients with years of history, these queries will slow down.  
**Fix:** Add `?limit=50&offset=0` pagination params to list endpoints.

### ARC-S2: `sessionStorage` ClientContext Never Refreshed
**File:** `src/lib/client-context.tsx`  
**Issue:** The client context is fetched once at login and cached in `sessionStorage`. If a Deepwoods admin changes the client config (enables a new page, updates the S3 boundary), users won't see the change until they log out.  
**Fix:** Add a cache TTL of ~5 minutes. Invalidate on explicit admin actions.

### ARC-S3: Google Drive as File Storage
**Issue:** All submission files are stored in Google Drive, which requires OAuth credentials per deployment and has API rate limits. For a multi-client platform with many simultaneous uploads, this will become a bottleneck.  
**Fix (long-term):** Consider S3-compatible object storage (Cloudflare R2, AWS S3, Backblaze B2).

---

## Technical Debt

### ARC-TD1: `src/data/master.ts` Re-export Pattern
**Issue:** `master.ts` re-exports from `featherlite.ts` and `decarb-data.ts` while adding inline constants. This creates confusion about where constants live.  
**Fix:** Once static data files are retired, `master.ts` should only export platform-level constants (`CARBON_PRICES`, `GROQ_MODEL`, etc.).

### ARC-TD2: `AGENTS.md` Content Partially Outdated
**File:** `AGENTS.md`  
**Issue:** Contains Featherlite-specific entity table (FP/FOS/FL) that should be dynamically driven. This file is read by AI agents (like Claude Code) and should describe the generic platform, not client-specific data.

### ARC-TD3: `reporting-platform/` Has No README
**Fix:** The Node.js report generator needs a `README.md` documenting setup (`npm install`), required env vars, and how to add a new client.

### ARC-TD4: Duplicate Schema Files ✅ Fixed
**Files:** `backend/schema.sql`, `backend/schema_v2.sql`, `backend/schema_combined.sql`  
**Status:** Resolved 2026-08-06 — `schema.sql` and `schema_v2.sql` copied to `_archive/backend/` with notes. `schema_combined.sql` is clearly the authoritative source.

### ARC-TD5: `dist-static_old/` and `.output_old/` in Repo
**Issue:** Two old build output directories are committed to the repo (or at least present on disk). They should be gitignored or deleted.  
**Fix:** Verify `.gitignore` covers `dist-static_old/` and `.output_old/`. Delete local copies if not needed.

### ARC-TD6: LibreOffice Lock File ✅ Fixed
**File:** `.~lock.GHG_Master_Sheet_Featherlite.xlsx#`  
**Status:** Resolved 2026-08-06 — stale lock file deleted.

### ARC-TD7: `abatementFor`/`costFor` Use Fields Not Present in `DecarbAction`
**File:** `src/components/decarb/shared.tsx`  
**Issue:** `abatementFor(a, pct)` and `costFor(a, pct)` reference `a.impactMin`, `a.impactMax`, and `a.costPerT` — but the `DecarbAction` TypeScript interface in `src/lib/api.ts` does not declare these fields. The code will fail silently at runtime (returns `NaN`) unless the API actually returns these fields.  
**Risk:** Scenario panel calculations will be wrong or crash for any client whose `decarb_actions` rows don't include these extra columns.  
**Fix:** Either add `impactMin`, `impactMax`, `costPerT` to the `DecarbAction` interface and ensure the API returns them, or compute abatement from the single `abatement_t` field already in the interface.

### ARC-TD8: `lovable-error-reporting.ts` — Dead Lovable-Platform Code
**File:** `src/lib/lovable-error-reporting.ts`  
**Issue:** This file reports errors to `window.__lovableEvents` — a hook specific to the Lovable.dev AI platform that is no longer used for development. The function is referenced from error boundaries but the `window.__lovableEvents` handler is never registered, so it silently no-ops. It's pure dead code.  
**Risk:** Low. Just misleads new developers into thinking there's error tracking infrastructure.  
**Fix:** Delete the file and remove any imports of `reportLovableError`.

### ARC-TD9: `debug_login.php` — Undocumented Debug Endpoint
**File:** `backend/api/debug_login.php`  
**Issue:** An undocumented PHP file exists in the live API directory. Debug endpoints often bypass auth, return sensitive information, or provide elevated access.  
**Risk:** Unknown until reviewed — could be a security risk if deployed to production.  
**Fix:** Review the file. If it bypasses auth or exposes user data, delete it. If it's safe but still needed locally, move it to `_archive/` or add to `.gitignore`.

---

## Positive Patterns (Keep)

- **Multi-client DB design** — `client_id` on every data table is correct and will scale well
- **React Query hooks** — All API calls in `src/lib/api.ts` with typed interfaces is clean
- **`ClientContextProvider`** — Single fetch at login with sessionStorage caching is efficient
- **Demo mode interceptor** — Comprehensive demo mode in `authFetch()` enables zero-backend testing
- **`schema_combined.sql` idempotency** — `IF NOT EXISTS` + `ON DUPLICATE KEY` guards mean the schema is safe to re-import
- **Barrel-export data files** — `master.ts` as an aggregator is a sensible pattern
- **CSS variable theming** — Per-client branding via `--primary` CSS variable is the right approach
