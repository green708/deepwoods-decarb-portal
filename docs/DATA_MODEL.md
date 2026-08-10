# Data Model

How data flows through the system and how the key domain objects are structured.

---

## Domain Objects

### ClientContext
The master context object loaded at login and cached in `sessionStorage`. Available via `useClientContext()`. See `src/lib/client-context.tsx` for the authoritative TypeScript types.

```typescript
interface ClientContext {
  client: {
    id: number;
    name: string;
    slug: string;
    logo_url: string;
    primary_color: string;
    currency: string;              // "INR" | "USD"
    reporting_period: 'FY' | 'CY'; // FY = Apr–Mar, CY = Jan–Dec
  };
  entities: Array<{
    code: string;                  // e.g. "FP", "FOS", "FL"
    name: string;
    short: string;                 // mapped from DB column short_name by context.php
    is_consolidated: boolean;      // true = roll-up entity
    consolidates: string[] | null; // ["FP","FOS"] for consolidated, null otherwise
    sort_order: number;
  }>;
  reporting_years: string[];       // e.g. ["FY22", "FY23", "FY24", "FY25", "FY26"]
                                   // derived from ghg_inventory rows; falls back to client_config
  enabled_pages: string[];         // route names visible in sidebar nav
  s3_boundary: string[];           // categories in scope for this client
  s3_not_relevant: Record<string, string[]>; // per-entity excluded categories
  targets: {
    base_year_s12: string;         // "FY22"
    base_year_s3: string;          // "FY24"
    netzero_year: number;          // 2040
    sbti_target_s12: number;       // reduction % (e.g. 42)
    sbti_target_year: number;      // 2030
  };
  config: Record<string, unknown>; // catch-all for all client_config rows
}
```

**Note:** `context.php` maps DB column `short_name → short` in the API response. Use `entity.short` in TypeScript; `short_name` is the DB column name only.

### GHG Inventory
Core emissions data. The API returns **all years at once** — a single call fetches the entire FY series for an entity. See `src/lib/api.ts` for the authoritative TypeScript interfaces.

```typescript
// From useInventory(entity)  ← no year param
interface InventoryResponse {
  entity: string;
  rows: InventoryRow[];
}

interface InventoryRow {
  metric_key: string;         // "Scope 1", "Scope 2 LB", "Cat 1", "Grand Total LB", etc.
  series: Record<string, number | null>; // { "FY22": 120.5, "FY23": 135.2, ... }
}
```

Standard metric keys:
```
Scope 1
Scope 2 LB
Scope 2 MB
Cat 1  … Cat 15
Scope 3 Total
Grand Total LB
Grand Total MB
```

**Helper utilities in `src/lib/api.ts`:**
- `getMetric(data, key)` — extracts a single metric's FYSeries from an InventoryResponse
- `getVal(data, key, fy)` — extracts a single value for a specific FY

### DecarbAsset
Equipment in the asset register, returned by `useDecarbAssets()`.

```typescript
// From useDecarbAssets(entity?)  ← entity is optional; returns all entities if omitted
interface DecarbAsset {
  id: string;          // e.g. "S1-STAT-01"
  name: string;
  entity: string;
  facility: string;
  fuel: string;        // "Diesel", "LPG", "Grid electricity"
  scope: string;
  sub_type: string;    // "Stationary", "Mobile", "Fugitive", "Electricity", "Renewables"
  status: string;      // "Active", "Retired"
  health: string;      // "Efficient", "Monitor", "Action Required"
  unit: string;
  series: Record<string, number | null>; // { "FY22": 45.6, "FY23": 51.2, ... }
}
```

### Submission
A data submission record.

```typescript
interface Submission {
  id: number;
  client_id: number;
  entity: string;
  version: 'V1' | 'V2' | 'V3';
  dataset_id: string;
  dataset_name: string;
  tag: string;
  year: string;
  unit: string;
  notes: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  submitted_by: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  files: SubmissionFile[];
}

interface SubmissionFile {
  id: number;
  original_name: string;
  drive_file_id: string;
  drive_file_link: string;
  kind: 'data' | 'document';
  uploaded_at: string;
}
```

### Dataset
Submission dataset definitions. Stored in DB but also mirrored in `src/data/datasets.ts` for the frontend.

```typescript
interface Dataset {
  id: string;                 // "scope1_energy"
  name: string;               // "Scope 1 — Energy & Combustion"
  tag: string;                // "Scope 1"
  description: string;
  requiredDocuments: string[];
  templateFilename: string;   // filename in /public/templates/
}
```

### DecarbAction
A decarbonisation action item.

```typescript
interface DecarbAction {
  id: number;
  entity: string;
  title: string;
  description: string;
  facilities: string[];
  lever: string;
  status: string;    // "Planned", "In Progress", "Completed"
  priority: 'High' | 'Medium' | 'Low';
  abatement_t: number;
  timeline: string;
}
```

### VaultDocument

```typescript
// From useVaultDocuments(entity?, fy?)
interface VaultDocument {
  id: number;
  entity: string;
  fy: string;                // Note: "fy" not "year"
  title: string;
  type: string;              // Note: "type" not "doc_type"
  drive_link: string;
  uploaded_at: string;
}
```

---

## Data Sources

### Primary (Database-driven)
All data accessed via the PHP API (`/backend/api/`) and React Query hooks in `src/lib/api.ts`. This is the production path for all multi-client data.

### Secondary (Static — Featherlite only)
`src/data/featherlite.ts` — auto-generated from `data-sources/GHG_Master_Sheet_Featherlite.xlsx`.

**This file is Featherlite-specific and will be retired** as the Featherlite client's data migrates fully to the database. It is only used in pages that haven't yet been wired to the API hooks.

The file is regenerated by:
```bash
python scripts/sync-master-sheet.py
```

### Demo Mode
When `fl_demo_mode=1` is in localStorage, `authFetch()` intercepts all API calls and returns mock data from hardcoded constants in `src/lib/auth.ts`. Submissions are stored in localStorage instead of the DB.

---

## State Management

| State | Storage | Key | Scope |
|---|---|---|---|
| Session token | `localStorage` | `fl_session_token` | Browser session |
| User role | `localStorage` | `fl_role` | Browser session |
| User email | `localStorage` | `fl_email` | Browser session |
| Must change password | `localStorage` | `fl_must_change_password` | Browser session |
| Demo mode flag | `localStorage` | `fl_demo_mode` | Browser session |
| Submissions (demo) | `localStorage` | `fl_demo_submissions` | Persists |
| Current entity | `localStorage` | `decarb_entity` | Persists across navigation |
| Current FY | `localStorage` | `decarb_fy` | Persists across navigation |
| Client context | `sessionStorage` | `decarb_client_ctx` | Tab session |
| Server data | React Query (in-memory) | — | Component lifetime / stale-while-revalidate |

---

## Data Flows

### Login → Context
```
1. POST /login.php → {token, email, role, client_id, mustChangePassword} → localStorage
2. GET /context.php (Bearer token) → ClientContext → sessionStorage (key: decarb_client_ctx)
3. EntityProvider reads localStorage decarb_entity (or defaults to consolidated entity)
4. FiscalYearProvider reads localStorage decarb_fy (or defaults to last year in reporting_years)
5. Pages read useClientContext() + useEntity() + useFiscalYear()
```

### Data Fetch (authenticated page)
```
1. useInventory(entity) called in component  ← no year param; returns all years at once
2. React Query checks cache key ['inventory', entity]
3. Cache miss → authFetch('ghg/inventory.php?entity=FL')
4. authFetch adds Authorization: Bearer <token> header
5. PHP validates token → queries ghg_inventory WHERE client_id=X AND entity=FL
6. Returns InventoryResponse { entity, rows: [{metric_key, series: {FY22:..., FY25:...}}] }
7. Response cached for 5 min staleTime; page reads specific year from series via getVal()
```

### Submission Upload
```
1. User selects files in /submissions page
2. FormData built with entity, dataset_id, year, files
3. POST /backend/api/submit.php (multipart)
4. PHP authenticates user → uploads files to Google Drive → creates submission + submission_files rows
5. Deepwoods admin reviews at /admin or via email
6. POST /review.php (Approved/Rejected) → audit_log entry
```
