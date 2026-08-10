# Migration Report

**Date:** 2026-08-06  
**From:** `C:\Users\likhi\Downloads\FL\decarb\`  
**To:** `C:\Users\likhi\Downloads\FL\platform\`  
**Migration Plan:** `MIGRATION_PLAN.md` (approved 2026-08-06)

---

## Summary

| Metric | Value |
|---|---|
| Total files in platform/ | 195 |
| PHP endpoint files | 39 |
| TSX route/component files | 79 |
| TypeScript lib/data files | 13 |
| TypeScript errors at migration | 115 |
| TypeScript errors after ARC-M5 + CT-3 | 99 |
| Net-new TypeScript errors introduced | 0 |
| Dangerous files excluded | 5 |
| New documentation files created | 14 |

---

## Pre-migration fixes applied (in `decarb/`)

### R-4: Archived `backend/api/schema.sql`
- **Action:** Moved `backend/api/schema.sql` → `decarb/_archive/backend/api-schema-featherlite-era.sql`
- **Reason:** Incompatible schema with production DB table names (`entities` vs `client_entities`, `scope1_breakdown` vs `s1_breakdown`). Running this against production would corrupt the database.

### R-7: Fixed `_app.workstreams.tsx` CLUSTERS import
- **Action:** Removed `import { CLUSTERS as ALL_CLUSTERS } from "@/data/featherlite"` — the last remaining `featherlite.ts` import in the entire frontend
- **Action:** Added `ClusterStatus`, `Tier`, `SubClusterDef`, `ClusterDef` types and generic `CLUSTERS` constant to `src/data/master.ts`
- **Clusters defined:** Cluster 1 (GHG Reporting), Cluster 2 (Decarbonization), Cluster 3 (Sustainability Communication), Cluster 12 (Carbon Strategy)
- **Result:** `featherlite.ts` has zero imports across the entire frontend

---

## Files copied

### From `decarb/` to `platform/`

**Root configuration**
- `.prettierrc`, `.prettierignore`, `components.json`, `eslint.config.js`, `tsconfig.json`
- All 7 root config files preserved

**Frontend (`src/`)**
- All route files (`src/routes/*.tsx`) — 21 active routes
- All components (`src/components/`) — 46 shadcn/ui components + platform components
- All lib files (`src/lib/*.ts`) — API hooks, auth, context providers
- `src/data/master.ts`, `src/data/datasets.ts`
- `src/hooks/`, entry points (`router.tsx`, `server.ts`, `start.ts`, `styles.css`)
- `src/routeTree.gen.ts` — will regenerate on first build

**Backend (`backend/api/`)**
- All active PHP endpoints including `ghg/`, `decarb/`, `credits/` split endpoints
- `GoogleDrive.php`, `Smtp.php`, `auth_middleware.php`, `db.php`
- `backend/config.php.example` (updated)
- `backend/.htaccess`, `backend/seed-users.php`, `backend/oauth-start.php`, `backend/oauth-callback.php`

**Automation**
- `automation/Code.gs` (from `reporting-platform/`) — Day 0–8 automation backbone
- `automation/generate_ghg_report.js`
- `automation/package.json`

**Documentation**
- All `docs/*.md` files
- All `docs/ADRs/` files
- `docs/reference/Sustainability_Reporting_Platform_Feasibility_v2.pdf` (business vision)
- `docs/reference/GHG_SQL_Migration_Plan.md`

**Scripts**
- `scripts/build-static.mjs`
- `scripts/clean.mjs`

**Assets**
- All brand assets from `public/` (logos, favicons)
- Generic `.gitkeep` placeholders for `public/templates/`

### From `FL/` root (outside `decarb/`)
- `ghg-proxy.php` → `platform/ghg-proxy.php` (CORS proxy — critical for Apps Script)
- `GHG_Automation_Deployment_Guide.md` → `platform/docs/DEPLOYMENT_GUIDE.md` (automation setup guide)
- `Sustainability_Reporting_Platform_Feasibility_v2.pdf` → `platform/docs/reference/` (also from decarb/docs/reference/)

---

## Files skipped (excluded)

### Security risks
| File | Reason |
|---|---|
| `backend/api/debug_login.php` | Exposes all user emails, user count, password hash generation with no auth |

### Legacy / superseded
| File | Reason |
|---|---|
| `backend/api/ghg-api.php` | Legacy monolith superseded by split endpoints in `backend/api/ghg/` |
| `backend/schema.sql` | Early 5-table schema; superseded by `schema_combined.sql` |
| `backend/schema_v2.sql` | Intermediate schema; superseded |
| `backend/api/schema.sql` | Already archived in decarb/ (R-4) before migration |
| `src/lib/lovable-error-reporting.ts` | Dead code — reports to `window.__lovableEvents` (Lovable-platform hook) which never exists outside the sandbox |

### Client-specific data
| File | Reason |
|---|---|
| `src/data/featherlite.ts` (42 KB) | All Featherlite GHG data — belongs in MySQL, not the platform codebase |
| `src/data/decarb-data.ts` (34 KB) | Featherlite decarbonization data — same reason |
| `backend/seed_featherlite.sql` | Featherlite client seed data |
| `backend/api/seed_featherlite.php` | Featherlite PHP seeder |
| `backend/seed_dolphin_navitas.sql` | Test client seed data |
| `backend/patch_dolphin_navitas_config.sql` | Test client config patch |
| `backend/fix_password_hashes.sql` | One-time migration, already run |
| `scripts/sync-master-sheet.py` | Generates `featherlite.ts` from Featherlite master sheet |
| `public/vault-docs/` (22 MB) | Featherlite client reports — serve from Google Drive |
| `public/templates/Featherlite_Scope*.xlsx` | Featherlite-branded templates |
| `data-sources/GHG_Master_Sheet_Featherlite.xlsx` | Featherlite master data file |
| `reporting-platform/FOS_GHG_Test_*.xlsx` | Featherlite test data |
| `reporting-platform/Featherlite_Reporting_Master_Schema.xlsx` | Featherlite reporting schema |

### Route stubs (not migrated)
| File | Reason |
|---|---|
| `_app.decarbonisation.tsx` | 182-byte redirect stub — `/decarbonisation` → `/hotspots` |
| `_app.strategy.tsx` | 178-byte redirect stub — `/strategy` → `/action-plan` |

### Experimental prototypes (at FL root — not touched)
`carbon-compass-main/`, `green-strategist-main/`, `lovable-project-9413a35b/`, `peer-insights-hub-main/`, `pixel-perfect-render-032-main/`

---

## Fixes applied during migration

### vite.config.ts — REWRITTEN (R-1)
**Before:** Single import from `@lovable.dev/vite-tanstack-config`  
**After:** Direct use of `@tanstack/react-start/plugin/vite`, `@tailwindcss/vite`, `vite-tsconfig-paths`, `nitro/vite`  
**Impact:** Removes the Lovable platform dependency entirely. The Nitro output path now reads from `NITRO_OUT` env var (fallback: `/tmp/ghg-output`).

### `src/lib/ghg-config.ts` — Entity codes removed (R-2)
**Removed:** `GHG_CLIENT_ID`, `GHG_FY`, `clientIdForEntity()` — these were Featherlite-specific entity/FY mappings  
**Kept:** `GHG_WEBAPP_URL`, `GHG_LIVE`, `ghgPost()`, `ghgGet()`  
**Impact:** Two files that used removed exports needed fixes (see below).

### `src/routes/__root.tsx` — Lovable error reporter removed
**Removed:** `import { reportLovableError } from "../lib/lovable-error-reporting"`  
**Replaced:** `reportLovableError(error, ...)` → `console.error("Root error boundary:", error)`

### `src/routes/_app.notifications.tsx` — clientIdForEntity removed
**Replaced:** `clientIdForEntity(entity)` → `entity` (passes entity code directly to Apps Script)

### `src/routes/_app.submissions.tsx` — GHG_FY and clientIdForEntity removed
**Replaced:** `GHG_FY` → `currentFY` (derived from `ctx.reporting_years[last]`)  
**Replaced:** `clientIdForEntity(resolvedEntity)` → `resolvedEntity`

### `backend/config.php.example` — Generic name (R-5)
`'from_name' => 'Featherlite GHG Portal'` → `'from_name' => 'YOUR_PLATFORM_NAME GHG Portal'`

### `ghg-proxy.php` — Made configurable (R-8)
Added a configuration block at the top that reads `ghg_webapp_url` from `backend/config.php` if present, falling back to a `REPLACE_WITH_APPS_SCRIPT_URL` placeholder. The hardcoded Featherlite Apps Script URL is no longer in the file.

### `src/lib/submissionsStore.ts` — Client slug flagged (ARC-M5)
Added TODO comment to `CLIENT_SLUG = "featherlite"` — this must be replaced with `useClientContext().client.slug` before a second client is onboarded.

### `package.json` — Renamed and cleaned (R-1)
`"name": "tanstack_start_ts"` → `"name": "decarb-platform"`  
`@lovable.dev/vite-tanstack-config` removed from devDependencies

### `database/schema_combined.sql` — Moved to dedicated folder
Schema moved from `backend/schema_combined.sql` to `database/schema_combined.sql`.  
The schema file is no longer deployed to `public_html/backend/` via the build script.

### New enterprise folder structure
- `automation/` — renamed from `reporting-platform/` (clearer purpose)
- `database/` — new folder for SQL schema files
- `tests/` — placeholder for future test suite
- `_archive/` — placeholder for superseded files

---

## New files created

| File | Purpose |
|---|---|
| `CLAUDE.md` | Updated workspace context for Claude Code |
| `AGENTS.md` | Updated AI agent context (removed Featherlite entity table) |
| `README.md` | Project overview and entry point |
| `ONBOARDING.md` | New developer guide (understand, build, deploy, contribute) |
| `CONTRIBUTING.md` | Coding standards, branch strategy, PR conventions |
| `PROJECT_STRUCTURE.md` | Complete repository layout with file-level details |
| `.env.example` | Environment variable template with inline docs |
| `vite.config.ts` | Rewritten Vite config (no Lovable dependency) |
| `package.json` | Updated with clean name and removed Lovable dep |
| `.gitignore` | Updated and cleaned (removed Wrangler/Bun/Lovable artifacts) |
| `ghg-proxy.php` | CORS proxy (copied from FL root, made configurable) |
| `src/README.md` | Frontend folder purpose and conventions |
| `backend/README.md` | PHP API folder purpose and conventions |
| `database/README.md` | SQL schema folder purpose and conventions |
| `docs/README.md` | Documentation folder index |
| `automation/README.md` | Apps Script folder purpose and conventions |
| `scripts/README.md` | Build scripts folder purpose and conventions |
| `public/README.md` | Static assets folder purpose and conventions |
| `tests/README.md` | Test suite placeholder and recommendations |
| `docs/DEPLOYMENT_GUIDE.md` | Full automation deployment guide (from FL root) |
| `database/migrations/.gitkeep` | Placeholder for incremental migrations |
| `public/templates/.gitkeep` | Placeholder for generic submission templates |
| `_archive/.gitkeep` | Placeholder for superseded files |
| `tests/.gitkeep` | Placeholder for test suite |
| `MIGRATION_REPORT.md` | This file |

---

## Verification results

| Check | Result |
|---|---|
| `featherlite.ts` imports in `src/` | PASS — zero imports |
| `debug_login.php` absent from `platform/` | PASS |
| `ghg-api.php` absent from `platform/` | PASS |
| `schema_combined.sql` in `database/` | PASS |
| `schema_combined.sql` absent from `backend/` | PASS |
| TypeScript errors: `lovable-error-reporting` | PASS — resolved |
| TypeScript errors: `clientIdForEntity` | PASS — resolved |
| TypeScript errors: `GHG_FY` | PASS — resolved |
| TypeScript error count vs `decarb/` | PASS — 115 in both (no regressions) |
| AGENTS.md Featherlite entity table removed | PASS |
| `ghg-proxy.php` configurable URL | PASS |
| `.env.example` created | PASS |
| `ONBOARDING.md` created | PASS |

---

## Remaining technical debt

### Critical (block second client onboarding)

| ID | File | Issue | Status |
|---|---|---|---|
| ARC-M5 | `src/lib/submissionsStore.ts` | `CLIENT_SLUG = "featherlite"` hardcoded | **FIXED 2026-08-06** |
| CT-3 | `src/routes/_app.trends.tsx` | `YEARS`/`INV` undefined — page crashed on load | **FIXED 2026-08-06** |
| CT-1 | `database/schema_combined.sql` | Legacy DB roles (`featherlite_team` etc.) not generic | Open — 1 hr |
| HP-1 | `src/components/DeecarbAI.tsx` | Groq API keys exposed client-side | Open — 3 hrs |

### Medium (should fix before second client)

| ID | File | Issue | Effort |
|---|---|---|---|
| MP-4 | `src/components/decarb/shared.tsx` | `abatementFor`/`costFor` undefined field refs | 1 hr |
| ARC-M3 | `backend/api/ghg-api.php` | Legacy monolith still in `decarb/` | 30 min |

### Post-migration tasks

| Task | Effort |
|---|---|
| Create generic `public/templates/` Excel files | 2 hrs |
| Parameterize `automation/Code.gs` client IDs | 3 hrs |
| Add pagination to `submissions.php` and `audit-log.php` | 2 hrs |
| `git init && git commit -m "Initial commit: platform workspace"` | 10 min |

---

## Recommendations

1. **Immediate (first session in platform/):**
   Fix `ARC-M5` (submissionsStore.ts slug) and `CT-3` (trends crash) before showing the platform to any client.

2. **Before second client onboarding:**
   Fix `CT-1` (DB roles) and parameterize `automation/Code.gs` client IDs. These two items block supporting more than one client.

3. **Infrastructure:**
   Run `git init` in `platform/` now to start tracking history from the clean state. Do not push to any remote until AGENTS.md and CLAUDE.md are reviewed for any stale references.

4. **Claude Project:**
   Attach `C:\Users\likhi\Downloads\FL\platform\` as the sole folder in the Claude Project. The `docs/reference/Sustainability_Reporting_Platform_Feasibility_v2.pdf` is now in `platform/` and provides the business context Claude needs.

5. **Feasibility document:**
   The PDF `docs/reference/Sustainability_Reporting_Platform_Feasibility_v2.pdf` should be added to the Claude Project's document context so Claude understands the 12 workflow requirements and 3-phase build plan.
