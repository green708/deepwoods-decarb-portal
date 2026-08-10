# Final Pre-Implementation Inspection
## Decarb Platform — Engineering Audit

**Date:** 2026-08-06  
**Inspector:** Claude (as Chief Software Architect, Enterprise QA Lead, Security Reviewer, Release Readiness Inspector, Platform Reliability Engineer, Multi-Tenant SaaS Auditor)  
**Scope:** Full platform — all 26 route files, 33 backend PHP endpoints, database schema, automation layer, build configuration, and every shared library  
**Mandate:** Independent engineering audit. No fixes performed.

---

## Executive Summary

The Decarb Platform has a well-chosen technical foundation and a clean TypeScript build (0 errors). Sprint 1 resolved all runtime crashes and type errors. However, this inspection found **four critical security vulnerabilities** that would expose client data and API credentials in production, plus **three pages with zero backend integration** that make the platform non-functional for any second client. There are also multiple confirmed runtime bugs in live pages.

The platform is **conditionally operational for the current client** (Featherlite) but **not ready for onboarding a second client**. The Go/No-Go decision is detailed at the end of this document.

---

## Overall Platform Score

| Dimension | Score | Rationale |
|---|---|---|
| Architecture | 80 / 100 | Solid stack; minor structural gaps |
| Code Quality | 72 / 100 | 0 TS errors; two confirmed runtime bugs |
| Multi-Tenant Readiness | 38 / 100 | 4 cross-tenant data exposure endpoints; 3 non-functional pages |
| Security | 28 / 100 | 5 live API keys in browser bundle; 4 endpoint auth failures |
| Performance | 65 / 100 | N+1 query; missing pagination on two high-volume endpoints |
| Database Readiness | 60 / 100 | CT-1 open; Featherlite seed in schema; missing cascade deletes |
| API Readiness | 55 / 100 | GHG reads solid; write/admin paths have critical failures |
| UI Readiness | 48 / 100 | 3 fully-incomplete pages; confirmed bugs in 2 live pages |
| Deployment Readiness | 62 / 100 | HP-1 blocks production; Windows build path bug |

**Weighted Overall Score: 53 / 100**

---

## 1. Architecture

**Stack:**
- Frontend: TanStack Start v1.168.x · React 19 · TanStack Router (file-based) · React Query v5 · shadcn/ui · Tailwind v4 · Recharts
- Backend: PHP 8 · MySQL · Hostinger shared hosting
- Build: Vite 8 · Nitro 3 (node-server preset) · custom `build-static.mjs` shell
- Automation: Google Apps Script · Node.js report generator

**Strengths:**
- The frontend/backend separation is clean. PHP serves pure JSON; React handles all UI.
- `ClientContextProvider` wraps the entire authenticated app shell correctly. `useClientContext()` is consistently available to all child routes.
- `authFetch()` as the single API gateway with token injection is well-designed.
- TanStack Query's stale-while-revalidate caching is appropriate for GHG data (changes infrequently).
- The `getVal(data, metric, fy)` accessor pattern correctly handles the `InventoryResponse` shape and prevents null-indexing crashes.

**Architecture Gaps:**

| ID | Finding | Severity |
|---|---|---|
| ARC-1 | Two parallel auth functions in PHP (`requireAuth()` in auth_middleware.php vs `dolphin_require_auth()` in db.php) return different key names (`user_id` vs `id`) and only one checks `empty(client_id)`. 17 endpoints mix them. | HIGH |
| ARC-2 | `ScenarioProvider` in `shared.tsx` iterates `[] as Action[]` in both `defaultLevers()` and `totals` memo instead of calling `useDecarbActions()`. The lever system is permanently empty — all scenario abatement totals are always 0. | HIGH |
| ARC-3 | `demoFetch` in `auth.ts` covers only 6 of the 17 hooks in `api.ts`. All uncovered hooks return `{ ok: true, demo: true }` — the wrong shape — in demo mode, causing silent render failures. | MEDIUM |
| ARC-4 | `DatasetItem` (api.ts) and `Dataset` (datasets.ts) represent the same domain concept but have incompatible shapes. No conversion layer exists between the DB-driven and local types. | MEDIUM |
| ARC-5 | `IRECRow.status` is typed as `string` in api.ts and as `"Retired" | "Recommended" | "Active"` in master.ts. Same exported name, different definitions. | LOW |
| ARC-6 | `GROQ_MODEL` constant is re-declared locally in DeecarbAI.tsx and also exported from master.ts. Silent divergence point. | LOW |

---

## 2. Code Quality

**TypeScript health:** 0 errors (verified clean build as of 2026-08-06).

**Confirmed Runtime Bugs:**

| ID | File | Description | Impact |
|---|---|---|---|
| BUG-1 | `_app.peer.tsx` | `getLatestTotal` looks up `p.totals[y]` where `y` is `"FY22"` format, but `totals` is keyed by `"2022"` format (calendar year). Key never matches → always returns `null` → all peer cards permanently show NdfBadge with no emissions data. | HIGH |
| BUG-2 | `_app.green-finance.tsx` | `const fy22 = slices.find(s => s.fy === "FY22")!` — non-null assertion on a hardcoded year. If a client's history doesn't include FY22, this is `undefined` and every subsequent property access throws. | HIGH |
| BUG-3 | `_app.hotspots.tsx` | `dynScope3Total` is a module-level mutable variable mutated during render (`dynScope3Total = scope3Total || 1`). Produces stale values under React 18 concurrent rendering and Strict Mode double-invoke. | MEDIUM |
| BUG-4 | `src/lib/client-context.tsx:112` | `throw new Error(state.status)` throws the string `"error"` (the discriminant) instead of `state.error` (the actual message). All diagnostics are lost. | MEDIUM |
| BUG-5 | `_app.action-plan.tsx` | `useDecarbActions` is imported but never called inside the component. No action data is loaded for the Scenario Builder's lever panel. | MEDIUM |

**Code Smell / Quality Issues:**

| ID | File | Description | Severity |
|---|---|---|---|
| QA-1 | `src/styles.css` | CSS variables `--featherlite-red`, `--featherlite-dark`, `--featherlite-gray` violate the no-client-naming rule in CLAUDE.md. | LOW |
| QA-2 | `_app.submissions.tsx:549` | Default fiscal year hardcoded: `useState("FY26")`. Should use `reporting_years[reporting_years.length - 1]`. | LOW |
| QA-3 | `_app.action-plan.tsx` | Scenario naming uses `window.prompt()` — a browser-blocking modal that cannot be styled and fails silently in embedded environments. | LOW |
| QA-4 | `src/lib/entity.tsx` | Empty `defaultEntity` resolves to `""` when no entities are configured. Blank entity strings propagate to every API call, producing ambiguous server responses. | LOW |

---

## 3. Multi-Tenant Readiness

**Status: NOT READY for second client**

Multi-tenancy is correctly implemented at the data layer (all 29 core tables have `client_id` FK) and at the frontend context layer (`ClientContextProvider`, `useClientContext()`). However, there are critical failures at the API write layer and widespread Featherlite-specific content that must be resolved before a second client can be onboarded.

### 3a. Cross-Tenant Data Exposure (Backend — CRITICAL)

Four PHP endpoints accept `client_slug` as a caller-supplied parameter without verifying the authenticated user belongs to that client:

| File | Line | Vector |
|---|---|---|
| `backend/api/submit.php` | 15 | `$clientSlug = $_POST['client_slug'] ?? 'featherlite'` — any authenticated user can submit files into another client's account |
| `backend/api/submissions.php` | 12 | `$clientSlug = $_GET['client_slug'] ?? 'featherlite'` — any authenticated user can read another client's full submission history |
| `backend/api/audit-log.php` | 12 | `$clientSlug = $_GET['client_slug'] ?? 'featherlite'` — any authenticated user can read another client's audit trail; no role check |
| `backend/api/metrics.php` | 17, 36 | `$clientSlug = $_GET['client_slug'] ?? 'featherlite'` — any authenticated user can read or write another client's computed metrics |

**In all four cases the fix is identical:** replace `$_GET['client_slug']` with `$authUser['client_id']` (resolved from the session token) and remove the `'featherlite'` default.

### 3b. Hardcoded Entity Logic (Backend — HIGH)

Four endpoints use `$entity !== 'FL'` to decide whether to apply an entity filter. `FL` is Featherlite's consolidated entity code. For any other client, passing their consolidated entity code applies a wrong entity filter and returns empty results.

Files: `backend/api/decarb/actions.php:22`, `decarb/assets.php:22`, `credits/irec.php:22`, `credits/grid-mwh.php:21`

Fix: replace `$entity !== 'FL'` with a query against `client_entities WHERE is_consolidated = 1 AND client_id = $authUser['client_id']`.

### 3c. Hardcoded Featherlite Content in Active PHP Endpoints

| File | What is hardcoded |
|---|---|
| `forgot-password.php:36,50` | Email subject and body contain "Featherlite GHG Portal" |
| `send-notification.php:31` | `$PORTAL_URL = 'https://featherlite.sustainablyyours.me'` |
| `send-notification.php:124–197` | Entire email template including title, header, body text, subject line hardcoded to Featherlite |
| `backend/api/Smtp.php:15` | `$fromName = 'Featherlite GHG Portal'` (default sender name) |
| `backend/api/Smtp.php:26,33` | `EHLO featherliteghgportal.local` — EHLO hostname sent to SMTP server |
| `submit.php:34` | `in_array($entity, ['FP', 'FOS'])` — hardcoded entity code validation; any other client's entities are rejected |
| `users.php:25` | `$validRoles` contains `['dolphin_team', 'dolphin_leadership', ...]` — neither the new platform roles nor the legacy FL roles; no client user can be created through the admin API |

### 3d. Pages Non-Functional for Second Client (Frontend — CRITICAL)

Three pages have zero backend API integration and contain exclusively Featherlite-specific content:

| Page | Root cause | Impact |
|---|---|---|
| `_app.admin.tsx` | Entire page uses hardcoded `DUMMY_CLIENTS`, hardcoded submissions queue, hardcoded audit log. All buttons are `onClick={()=>{}}` no-ops. | Admin console is a prototype — zero real functionality |
| `onboard.tsx` | Seven-step wizard saves only to `localStorage`. No API call for account creation, no submission on "Submit for Review". Months hardcoded to FY2025-26. `FACILITIES` array is empty (TODO comment). | Onboarding is completely non-functional — no client is ever created |
| `_app.methodology.tsx` | Entire page is static text hardcoded to Featherlite: consolidation approach, base years, S3 boundary categories, grid EF, fiscal calendar, SBTi targets, currency symbol. | Every second client sees Featherlite's methodology disclosure |

### 3e. Widespread Base Year Hardcoding (Frontend — HIGH)

The following pages hardcode `"FY22"` as the S1+2 base year and/or `"FY24"` as the S3 base year, ignoring `ctx.targets.s12_base_year` and `ctx.targets.s3_base_year` which are already available in context:

- `_app.overview.tsx` (3 occurrences) · `_app.trends.tsx` (5 occurrences) · `_app.action-plan.tsx` · `_app.green-finance.tsx` · `_app.progress.tsx`

### 3f. Automation Layer (Code.gs + generate_ghg_report.js — HIGH)

The entire automation layer is Featherlite-specific and cannot serve a second client without code changes:

- All email subjects contain `"[Featherlite GHG ...]"` — 10+ occurrences in Code.gs
- Bootstrap seed data hardcodes FL/FP/FOS client IDs, full legal entity names, and real email addresses
- `ENTITY_CONFIG`, `computeTCO2e()`, and `DP_META` in generate_ghg_report.js contain only Featherlite entities and emission factor mappings
- Fiscal year `"FY2026"` hardcoded in 3 places in generate_ghg_report.js

### 3g. Schema (Database — MEDIUM)

- `notification_prefs` and `notification_log` tables have no `client_id` FK — notification data is not isolated by client
- No `ON DELETE CASCADE` from `clients(id)` on 24 data tables — client offboarding requires manual data deletion

---

## 4. Security Review

**Security Score: 28 / 100 — Multiple Critical Failures**

### 4a. HP-1: Groq API Keys Exposed in Client Bundle (CRITICAL — BLOCKER)

**File:** `src/components/DeecarbAI.tsx` lines 10–16

Five live Groq API keys are hardcoded as plaintext JavaScript string literals:

```
const GROQ_KEYS = [
  "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",
  "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",
  "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",
  "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",
  "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",
];
```

These keys ship verbatim in the compiled JavaScript bundle delivered to every authenticated user's browser. They are trivially extractable via DevTools. The 5-key round-robin rotation is consistent with prior rate-limit exhaustion, suggesting these keys have already been abused.

**Required action before any public deployment:** Rotate all 5 keys immediately. Move the Groq API call to `backend/api/ai.php` and never expose any key in a `VITE_`-prefixed env var or in source code.

### 4b. Cross-Tenant Data Exposure (CRITICAL — already covered in §3a)

Four endpoints break multi-tenant isolation. See §3a for details.

### 4c. Demo Mode Role Escalation (HIGH)

**File:** `src/lib/auth.ts`

`loginDemo()` sets `fl_role = "sustainability_team"` in localStorage. `demoFetch` serves `me.php` by reading and reflecting `localStorage.getItem("fl_role")`. Any user in demo mode can open DevTools, set `localStorage.setItem("fl_role", "deepwoods_admin")`, and the app will authenticate and render them as a full Deepwoods admin with all admin navigation and controls visible.

### 4d. GHG Data Sent to Third-Party API (HIGH)

**File:** `src/components/DeecarbAI.tsx` lines 154–185

The system prompt transmitted to Groq on every AI chat message includes: full inventory (all scopes, all fiscal years), S1 source breakdown by fuel type, S2 facility-level data with facility names, entity names, SBTi targets, and the client name. For clients with contractual data-confidentiality requirements, transmitting asset-level emissions data to a third-party API without explicit consent is a compliance risk.

### 4e. Wildcard CORS on All Endpoints (HIGH)

**File:** `backend/api/db.php:88`

`header('Access-Control-Allow-Origin: *')` is emitted by every endpoint automatically on `require 'db.php'`. A production multi-tenant platform serving sensitive financial and GHG data should restrict CORS to the actual production domain.

### 4f. Hardcoded Cron Secret Fallback (HIGH)

**File:** `backend/api/send-notification.php:219`

`$cfg['cron_secret'] ?? 'fl-ghg-cron-2026'` — if `cron_secret` is not set in `client_config`, the notification cron endpoint is protected by a publicly-guessable string. The secret is also passed in the query string, which logs it in Apache access logs.

### 4g. No Rate Limiting on Auth Endpoints (MEDIUM)

`login.php` and `forgot-password.php` have no brute-force protection. Dictionary attacks and email-flood attacks against these endpoints are unrestricted.

### 4h. ghg-proxy.php Has No Authentication (MEDIUM)

`ghg-proxy.php` forwards requests to Google Apps Script with no session check, no API key, and no IP restriction. Any unauthenticated request reaching the proxy URL is forwarded to the live Apps Script deployment.

### 4i. Production Apps Script URL in Source (MEDIUM)

**File:** `automation/generate_ghg_report.js:34`

The live production Apps Script deployment URL is committed to source as a hardcoded fallback. The URL functions as an authentication token — anyone with repository read access can POST `publishReport` or `approveReport` directly.

### 4j. context.php Dumps All Client Config to Browser (MEDIUM)

`backend/api/context.php:82–89` sends all rows from `client_config` to the frontend. If any sensitive operational values are stored there, they are exposed to every authenticated session.

### 4k. Legacy DB Roles Cause Silent Logout (MEDIUM — CT-1)

`_app.tsx:203`: `if (!meta) { doLogout() }`. Any user whose DB role is one of the three legacy values (`featherlite_team`, `featherlite_leadership`, `automation_demo` — CT-1) is silently logged out immediately after authentication. No error message is shown. These users cannot use the portal at all until their role is migrated.

---

## 5. Performance

| ID | Finding | Severity |
|---|---|---|
| PERF-1 | `backend/api/submissions.php`: N+1 query problem — `$filesStmt` executes once per submission inside a loop. For a client with 100 submissions this issues 101 queries per page load. | HIGH |
| PERF-2 | `backend/api/submissions.php` and `audit-log.php`: no pagination. These endpoints return the entire history in one response. At scale this will produce slow loads and possible timeouts. | MEDIUM |
| PERF-3 | `backend/api/context.php`: issues one SQL query per config key via `getConfig()`. Should be replaced with a single `WHERE config_key IN (...)` query. | MEDIUM |
| PERF-4 | `backend/api/users.php` (GET): returns all users across all clients in a single unbounded query with no pagination. | MEDIUM |
| PERF-5 | No loading skeletons on GHG data pages (dashboard, overview, inventory, trends). Data defaults to `0`/`[]` while loading, causing charts to flash zeros before data arrives. | LOW |

---

## 6. Database Readiness

**CT-1 Status (CRITICAL — confirmed):**

The `users` table ENUM contains both old and new roles simultaneously:

```sql
ENUM(
  'sustainability_team', 'client_uploader', 'client_leadership',
  'deepwoods_admin', 'deepwoods_coordinator',
  'featherlite_team', 'featherlite_leadership', 'automation_demo'
) NOT NULL DEFAULT 'sustainability_team'
```

Three legacy roles remain valid values. Any admin UI or direct DB insert can still assign them. The `_app.tsx` shell silently logs out users who hold these legacy roles. This is an active production defect for existing users who have not been migrated.

**Schema Issues:**

| ID | Finding | Severity |
|---|---|---|
| DB-1 | CT-1: legacy roles still in ENUM | CRITICAL |
| DB-2 | Featherlite client row, entity rows (FL/FP/FOS), and 10 config rows are seeded in schema_combined.sql and run on every fresh import. A second client's fresh schema contains Featherlite data. | HIGH |
| DB-3 | `notification_prefs` and `notification_log` tables have no `client_id` column — notification data is not multi-tenant isolated | MEDIUM |
| DB-4 | No `ON DELETE CASCADE` from `clients(id)` on 24 data tables — no automated offboarding path | MEDIUM |
| DB-5 | `computed_metrics.entity DEFAULT 'FL'` — Featherlite's consolidated code is a column-level default | LOW |
| DB-6 | `clients.logo_url DEFAULT '/deepwoods-logo.png'` — Deepwoods branding as the fallback for any new client | LOW |
| DB-7 | `ghg_facilities` and `decarb_actions` lack composite indexes on `(client_id, entity)` — common query pattern not covered | LOW |

---

## 7. API Readiness

**GHG Read Endpoints (§ghg/) — PASS**
All 6 GHG endpoints (`inventory.php`, `s1.php`, `s2.php`, `s3.php`, `intensity.php`, `facilities.php`) are correctly structured: use `requireAuth()`, enforce entity_scope, use prepared statements, return the correct shapes expected by api.ts hooks. Minor issue: default entity `'FL'` in inventory/s1/s2/s3/intensity endpoints means a missing `?entity=` param returns FL-consolidated data, which is wrong for clients with a different consolidated entity code.

**Write / Admin Endpoints — FAIL**

| Endpoint | Status | Primary Issue |
|---|---|---|
| submit.php | FAIL | Cross-tenant submission; hardcoded `['FP','FOS']` entity validation |
| submissions.php | FAIL | Cross-tenant read; auth return discarded |
| audit-log.php | FAIL | Cross-tenant read; no role check |
| metrics.php | FAIL | Cross-tenant read/write |
| send-notification.php | FAIL | Entirely hardcoded Featherlite content; cron secret fallback |
| forgot-password.php | FAIL | "Featherlite GHG Portal" in email |
| users.php | FAIL | Wrong `$validRoles`; no `client_id` on INSERT |

**Endpoints Without Frontend Hooks (No TypeScript contract):**
- `backend/api/review.php` — no corresponding hook in api.ts (submission approval is driven directly by submissionsStore.ts)
- `backend/api/change-password.php` — called via `changePassword()` in auth.ts, not through a React Query hook

**Missing Endpoints:**
- No `backend/api/ai.php` — needed for HP-1 fix (Groq proxy)
- No `backend/api/clients.php` — admin page manages clients but fetches from localStorage

**TypeScript Contract Accuracy:**
The api.ts hook types align well with the PHP response structures for the 17 hooks audited. The main mismatch is `IRECRow.status` (string vs literal union — noted in §2 ARC-5).

---

## 8. UI Readiness

**Pages fully operational for current client:**
`/forgot-password`, `/reset-password`, `/workstreams`, `/hotspots`, `/credits`, `/priority-actions`, `/vault`, `/reports`, `/notifications`, `/trends` (with hardcoded base year caveat)

**Pages with confirmed bugs or hardcoding that will break for second client:**

| Route | Issue | Severity |
|---|---|---|
| `/peer` | `getLatestTotal` key format mismatch — all peer cards show blank | HIGH — bug |
| `/action-plan` | `1150` magic number in glidepath; `useDecarbActions` never called | HIGH — bug + hardcoding |
| `/green-finance` | FY22 non-null assertion crash risk; hardcoded 4-year list | HIGH — crash risk |
| `/overview` | `"FY22"` base year; glidepath pace `0.042` hardcoded | MEDIUM |
| `/trends` | `"FY22"`, `"FY24"` base years; "Cats 4 & 12" annotation | MEDIUM |
| `/progress` | `DECARB_MILESTONES` entirely hardcoded; SBTi claims always shown | MEDIUM |
| `/dashboard` | India grid EF `0.727`; 4× DNF placeholders in main tabs | MEDIUM |
| `/submissions` | Empty facilities dropdown (TODO); `FY26` default | MEDIUM |

**Pages non-functional for any client:**

| Route | Issue |
|---|---|
| `/onboard` | Zero API integration — writes only to localStorage |
| `/admin` | Zero API integration — all data hardcoded |
| `/methodology` | Entire content hardcoded to Featherlite |

**Universal UX Gap:** No loading spinners or skeleton states on any GHG data page. All data defaults to `0`/`[]` while loading. Users see zeros briefly before charts render — no clear indication data is loading.

**Universal UX Gap:** The Vault upload modal (`_app.vault.tsx`) shows a success confirmation but makes no API call. Files are never actually uploaded.

---

## 9. Deployment Readiness

| ID | Finding | Severity |
|---|---|---|
| DEP-1 | **HP-1 blocker** — 5 Groq API keys in client bundle. Must be resolved before any public deployment. | CRITICAL |
| DEP-2 | `vite.config.ts` and `build-static.mjs` both default to `/tmp/ghg-output` — fails on Windows unless `NITRO_OUT` is set in environment | HIGH |
| DEP-3 | `ghg-proxy.php` is not included in the `build-static.mjs` output — must be manually uploaded separately; no post-build reminder | MEDIUM |
| DEP-4 | No `typecheck` npm script for CI | LOW |
| DEP-5 | `tailwindcss` and `@tailwindcss/vite` are in `dependencies` (not `devDependencies`) | LOW |
| DEP-6 | `@vitejs/plugin-react` in devDependencies but not used in vite.config.ts | LOW |

**.htaccess SPA rules:** Correct. Apache rewrite to `index.html` for all unmatched paths is properly generated by build-static.mjs.

**Build output:** The `build:fresh` flow is architecturally sound. The workaround for Nitro v3's unstable static preset (spin up node-server, fetch `/`, extract HTML shell) is correct.

---

## 10. Remaining Risks Summary

### Critical (block second client onboarding)
1. **HP-1** — 5 Groq API keys in client bundle
2. **Cross-tenant exposure** — 4 PHP endpoints accept caller-supplied `client_slug` with no ownership check
3. **CT-1** — Legacy DB roles cause silent logout for users who have not been migrated
4. **Onboard page** — New client wizard has zero backend integration; no client is ever created in the DB
5. **Admin page** — Admin console has zero backend integration; all data is hardcoded

### High (break correctness for second client)
6. **submit.php entity hardcoding** — `['FP',' FOS']` validation; any other client's entities rejected
7. **Email templates** — "Featherlite GHG Portal" in `forgot-password.php`, `send-notification.php`, `Smtp.php`
8. **`users.php` wrong roles** — `$validRoles` has stale/wrong role names; no `client_id` on new user INSERT
9. **`decarb/actions.php` + 3 siblings** — `$entity !== 'FL'` breaks consolidated entity detection for any other client
10. **BUG-1** — Peer page: all peer cards permanently blank (FY key format mismatch)
11. **BUG-2** — Green Finance: FY22 non-null assertion crash risk
12. **ARC-2** — ScenarioProvider always initializes with empty levers
13. **Methodology page** — Entire content is Featherlite-specific static text
14. **5+ pages hardcode base years** — FY22/FY24 instead of using `ctx.targets`
15. **Automation layer** — Code.gs and generate_ghg_report.js require code changes for each new client

### Medium (degrade experience but don't break)
16. CORS wildcard on all PHP endpoints
17. No rate limiting on login / forgot-password
18. `notify_prefs` / `notification_log` have no `client_id` FK
19. `context.php` dumps all client_config to browser
20. `demoFetch` wrong-shape default for 11 of 17 hooks
21. Demo mode role escalation via localStorage
22. `client-context.tsx` error state throws wrong message
23. No pagination on submissions / audit-log
24. N+1 query in submissions.php

---

## 11. Recommendations

### Before any second client can be onboarded (in priority order)

1. **[HP-1]** Rotate all 5 Groq keys. Implement `backend/api/ai.php` proxy. Remove `GROQ_KEYS` array from DeecarbAI.tsx.

2. **[CT-1]** Migrate legacy DB roles: remove `featherlite_team`, `featherlite_leadership`, `automation_demo` from the `users.enum`; migrate any existing users with legacy roles to generic equivalents before altering the ENUM.

3. **[SECURITY]** Fix the 4 cross-tenant endpoints: replace `$_GET['client_slug']`/`$_POST['client_slug']` with `$authUser['client_id']` (from the session) in `submit.php`, `submissions.php`, `audit-log.php`, `metrics.php`.

4. **[SECURITY]** Fix `submit.php` entity validation: replace the hardcoded `['FP','FOS']` check with a DB lookup of valid entities for the authenticated client. Remove `'featherlite'` from the error message.

5. **[HARDCODING]** Fix the 4 endpoints using `$entity !== 'FL'` for consolidated entity detection (`decarb/actions.php`, `decarb/assets.php`, `credits/irec.php`, `credits/grid-mwh.php`).

6. **[HARDCODING]** Fix email templates in `forgot-password.php`, `send-notification.php`, `Smtp.php` — replace all "Featherlite GHG Portal" strings with dynamic client name from DB.

7. **[ADMIN]** Connect `_app.admin.tsx` to real API endpoints. Replace `DUMMY_CLIENTS`, hardcoded submission queue, hardcoded audit log with actual data from `users.php`, `submissions.php`, and `audit-log.php`.

8. **[ONBOARDING]** Implement `_app.onboard.tsx` with backend integration: create a `backend/api/clients.php` endpoint and wire the 7-step wizard to it. Remove `fl_` localStorage keys; use generic keys.

9. **[BUGS]** Fix BUG-1 (peer FY key mismatch), BUG-2 (green-finance FY22 assertion), ARC-2 (ScenarioProvider empty levers), BUG-5 (action-plan missing `useDecarbActions` call).

10. **[METHODOLOGY]** Rewrite `_app.methodology.tsx` to source content from `ctx.config` / `ctx.targets`. At minimum: base years, grid EF, S3 category boundary, and fiscal calendar must come from context.

11. **[BASE YEARS]** Replace all hardcoded `"FY22"` and `"FY24"` base year literals in overview, trends, action-plan, green-finance, progress with `ctx.targets.s12_base_year` and `ctx.targets.s3_base_year`.

12. **[DATABASE]** Separate Featherlite seed data from `schema_combined.sql` into `database/seed_featherlite.sql` so a fresh schema import no longer includes one client's data.

13. **[AUTOMATION]** Parameterize Code.gs: extract all "Featherlite GHG" email subject prefixes to a CONFIG key (`PLATFORM_NAME`). Parameterize `generate_ghg_report.js`: remove hardcoded `CLIENT_ID` and `WEB_APP_URL` fallbacks.

### Recommended for next sprint (after second client is live)
- Fix `users.php` `$validRoles` to match actual platform roles
- Add rate limiting to `login.php` and `forgot-password.php`
- Add pagination to `submissions.php` and `audit-log.php`
- Fix N+1 query in `submissions.php`
- Narrow CORS from `*` to production domain
- Add loading skeletons to GHG data pages
- Fix vault upload modal to actually call an upload API
- Add `NITRO_OUT` default or document the Windows requirement clearly in `build-static.mjs`
- Consolidate the two parallel PHP auth functions into one

---

## 12. Go/No-Go Decision

### For the current client (Featherlite) — CONDITIONAL GO

The platform is operationally functional for Featherlite. TypeScript has zero errors. All Critical and High priority type errors were resolved in Sprint 1. The GHG read pathway is correct and working. The platform can continue to be used by Featherlite subject to the following conditions being addressed urgently:

- **HP-1 must be resolved before the portal URL is shared with any new user.** The exposed Groq keys will be rotated or abused as soon as the application is accessible.
- **CT-1 should be resolved before any existing user's role is changed.** The silent-logout behaviour is a live production defect.

### For a second client — NO-GO

The platform is not ready to onboard a second client. The following blockers must be resolved first:

| # | Blocker | Risk if deployed as-is |
|---|---|---|
| 1 | 4 cross-tenant exposure endpoints | Client A can read Client B's submissions and audit trail |
| 2 | `submit.php` hardcoded entity validation | Client B cannot submit any data |
| 3 | Admin page has no backend integration | Cannot manage Client B's users or review their submissions |
| 4 | Onboarding wizard has no backend integration | Client B cannot be created through the UI |
| 5 | CT-1 open | Client B users assigned generic roles silently log out if using legacy roles |
| 6 | Email templates contain "Featherlite GHG Portal" | Client B receives emails branded to a competitor |
| 7 | `send-notification.php` portal URL is featherlite.sustainablyyours.me | Client B's notifications link to the wrong portal |
| 8 | Methodology page is entirely Featherlite content | Client B sees a competitor's GHG methodology disclosure |
| 9 | Peer page has runtime bug | Client B's peer benchmarking shows blank cards for all peers |
| 10 | BUG-2 in Green Finance (FY22 assertion) | Crash risk for any client whose base year is not FY22 |

**Estimated remediation effort before second client is viable:** 13 to 16 focused engineering days covering backend security fixes, the three non-functional pages, the two runtime bugs, email template generalization, and automation parameterization.

---

*This document was generated on 2026-08-06 and reflects the state of the platform as of that date. It should be updated when the blockers above are resolved.*
