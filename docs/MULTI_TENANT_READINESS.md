# Multi-Tenant Readiness

Analysis of everything preventing the Decarb portal from becoming a generic SaaS platform, with proposed resolutions.

**Assessment date:** 2026-08-06  
**Target state:** Any sustainability consultancy can onboard any client organisation without code changes.

---

## Readiness Score

| Dimension | Current State | Score |
|---|---|---|
| Data isolation | Good — `client_id` on all tables | 8/10 |
| Auth / session scoping | Good — sessions scoped to `client_id` | 7/10 |
| UI configuration | Good — `enabled_pages` config | 7/10 |
| Branding | Good — CSS variable theming | 8/10 |
| Entity model | Limited — flat structure only | 5/10 |
| Role model | Poor — Featherlite-specific roles in ENUM | 3/10 |
| Hardcoded references | Poor — static data files, hardcoded slugs | 3/10 |
| Automation platform | Poor — Featherlite client IDs hardcoded | 2/10 |
| API keys (client-side) | Critical — Groq keys exposed in browser | 1/10 |

**Overall: 49/100 — Not ready for new clients without code changes**

---

## Issues by Category

### 1. Customer-Specific Names

#### 1a. Static data files with Featherlite entity names
**Files:** `src/data/featherlite.ts`, `src/data/decarb-data.ts`  
**Problem:** Entity names "FP", "FOS", "FL", facility names "Rajanakunte", "Hejjala" etc. are hardcoded in TypeScript files used by live pages.  
**Generic replacement:** These pages should call `useDecarbAssets()`, `useInventory()`, `useFacilities()` etc. which return client-scoped data from the DB.

#### 1b. Featherlite-specific roles in DB
**File:** `backend/schema_combined.sql`  
**Problem:** `featherlite_team`, `featherlite_leadership`, `automation_demo` roles exist only for Featherlite.  
**Generic replacement:** Use only the 5 generic roles: `sustainability_team`, `client_uploader`, `client_leadership`, `deepwoods_admin`, `deepwoods_coordinator`. Drop `automation_demo`.

#### 1c. `featherlite` slug hardcoded in submissionsStore
**File:** `src/lib/submissionsStore.ts`  
**Problem:** API calls are constructed with a hardcoded `featherlite` slug.  
**Generic replacement:** Read from `useClientContext().client.slug`.

#### 1d. Featherlite entity codes in `ghg-config.ts`
**File:** `src/lib/ghg-config.ts`  
**Problem:** `GHG_CLIENT_ID` map hardcodes Featherlite Drive folder mappings:
```typescript
const GHG_CLIENT_ID = { FOS: 'FL-FOS-GHG-FY26', FP: 'FL-FP-GHG-FY26' }
```
**Generic replacement:** Store client IDs per entity in `client_config` table. Fetch via context.

#### 1e. `CLAUDE.md` / `AGENTS.md` — Featherlite-specific content
**Problem:** AI context docs still reference Featherlite data and workflow.  
**Generic replacement:** Update to describe the platform generically; Featherlite-specific notes should be in `docs/reference/Featherlite_Notes.md`.

---

### 2. Hardcoded Hierarchy Assumptions

#### 2a. Flat entity structure only
**Problem:** The DB schema supports `Organisation → Entities` but not deeper hierarchies like `Organisation → Companies → Facilities`.  
**Current `client_entities` model:**
```
client_id: 1 (Featherlite)
  entity: FL (consolidated, consolidates: ["FP","FOS"])
  entity: FP (leaf)
  entity: FOS (leaf)
```
**Future need example:** A client with multiple wholly-owned subsidiaries:
```
Org
  └── Company A
        └── Factory 1
        └── Factory 2
  └── Company B
        └── Office 1
```
**Generic replacement:** Add a `hierarchy_level` and `parent_entity_id` to `client_entities`, or introduce a separate `client_hierarchy` table.

#### 2b. Consolidated entity computed in frontend
**Problem:** The FL (consolidated) entity is often computed in the frontend by summing FP + FOS. This is fragile.  
**Generic replacement:** Consolidated computations should happen in the API layer (`ghg/inventory.php` should auto-aggregate children when `is_consolidated=true`).

---

### 3. Hardcoded Configuration

#### 3a. Carbon price scenarios hardcoded
**File:** `src/data/master.ts`  
**Problem:** `CARBON_PRICES = [500, 1000, 2500, 5000]` (INR/t) — these are India-specific amounts.  
**Generic replacement:** Store in `client_config` as `carbon_price_scenarios` JSON.

#### 3b. IREC cost factor partially hardcoded
**Files:** `src/data/master.ts`, `src/lib/ghg-config.ts`  
**Problem:** `IREC_FACTOR = 0.597` and `IREC_COST_PER_MWH = { low: 15, high: 25 }` (INR/MWh range) are hardcoded in `master.ts`. The `irec_factor` key is also in `client_config` — there are two sources of truth.  
**Generic replacement:** Frontend should always read from `ctx.config.irec_factor` (from context). Remove hardcoded values from `master.ts`.

#### 3c. GROQ_MODEL hardcoded
**File:** `src/data/master.ts`  
**Problem:** AI model name hardcoded. May need to differ by client tier.  
**Generic replacement:** Move to `client_config` or server-side config.

#### 3d. GHG webapp URL in env + hardcoded fallback
**File:** `src/lib/ghg-config.ts`  
**Problem:** The Apps Script web app URL is in `.env.local` but also hardcoded as a fallback in `generate_ghg_report.js`.  
**Generic replacement:** Remove all hardcoded URLs. URL comes from `client_config` via context.

---

### 4. Hardcoded Reports

#### 4a. `VAULT` array in `featherlite.ts`
**Problem:** Vault document metadata (file names, Drive paths) for Featherlite reports is hardcoded.  
**Generic replacement:** All vault documents come from `vault_documents` DB table via `useVaultDocuments()`.

#### 4b. Report templates are Featherlite-branded
**Files:** `public/templates/Featherlite_Scope*.xlsx`  
**Problem:** Templates have Featherlite company name in headers.  
**Generic replacement:** Per-client templates stored in Drive and served via Drive link from DB.

---

### 5. Hardcoded Branding

#### 5a. Logo paths hardcoded in `__root.tsx`
**Problem:** The `featherlite-logo.png` may be referenced in some places (check FL-GHG pages for carryover).  
**Generic replacement:** Logo URL from `client.logo_url` via context. No hardcoded logo paths.

#### 5b. `deepwoods-logo.png` as default
**Problem:** The default logo is Deepwoods' logo — fine for now, but as more white-label clients onboard this will need to be configurable.

---

### 6. Hardcoded Routes

#### 6a. Nav items with fixed routes
**File:** `src/routes/_app.tsx`  
**Problem:** The sidebar nav is hardcoded with route paths. The `enabled_pages` config hides items, but you cannot add a client-specific custom page without code changes.  
**Generic replacement:** For now, the `enabled_pages` config is sufficient. Long-term, consider a plugin/custom-page system.

---

### 7. Hardcoded APIs

#### 7a. Google Apps Script endpoint in `ghg-config.ts`
**Problem:** The Apps Script URL is per-deployment, but for multi-client each client may have their own Apps Script project.  
**Generic replacement:** Store `apps_script_url` per client in `client_config`.

#### 7b. Google Drive folder structure is Featherlite-specific
**Files:** `backend/GoogleDrive.php`, `backend/api/submit.php`  
**Problem:** Drive folder names and IDs are derived from Featherlite entity codes.  
**Generic replacement:** Store `drive_entity_folder_id` per entity in DB (extend `client_entities` table).

---

## Proposed Remediation Roadmap

### Sprint 1 — Foundation (2-3 days)
1. Convert `users.role` from ENUM to VARCHAR(50)
2. Fix `submissionsStore.ts` slug hardcoding
3. Move Groq keys server-side (security critical)
4. Add `drive_folder_id` column to `client_entities`

### Sprint 2 — Data Layer (3-5 days)
5. Wire all remaining pages to API hooks (retire static data files)
6. Implement consolidated entity aggregation in API layer
7. Move `GHG_CLIENT_ID` map to `client_config`
8. Store `apps_script_url` per client in `client_config`

### Sprint 3 — Configuration (2-3 days)
9. Move `CARBON_PRICES` to `client_config`
10. Move IREC constants to always read from context
11. Create per-client report template system (Drive-based)
12. Generic data collection templates (remove Featherlite branding)

### Sprint 4 — Hierarchy (5-7 days)
13. Design and implement flexible entity hierarchy model
14. Onboarding wizard → backend persistence
15. Admin: onboard new client entirely through UI without SQL

### Sprint 5 — Scale
16. Migrate to VPS/managed hosting
17. Replace Google Drive with S3-compatible storage
18. Add pagination to list endpoints
19. Add per-page error boundaries
