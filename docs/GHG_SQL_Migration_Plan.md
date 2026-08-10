# GHG Data → SQL Migration Plan
**Featherlite GHG Portal · Hostinger MySQL**

---

## Single Source of Truth

`master.ts` already re-exports everything from `featherlite.ts`, `decarb-data.ts`, and `datasets.ts`, and also holds its own inline constants. It is the one file any page needs to import from.

The migration is therefore simple:

```
master.ts  →  seed script  →  MySQL (Hostinger)  →  PHP API  →  pages fetch per-endpoint
```

After the migration is done, `featherlite.ts`, `decarb-data.ts`, and `datasets.ts` are deleted. `master.ts` is trimmed to types only.

---

## Architecture

```
Browser (React / TanStack Start)
        │
        │  fetch /api/ghg/inventory?entity=FL
        │  fetch /api/decarb/actions
        │  fetch /api/credits/irec  … etc.
        ▼
Hostinger PHP API  (/backend/api/*.php)
        │
        ▼
Hostinger MySQL  (existing DB, same credentials as submissions)
```

The existing `schema.sql` already has `clients`, `submissions`, `submission_files`, `audit_log`, `computed_metrics`, and `users`. All new tables slot into the same database.

---

## Phase 1 — SQL Schema

### Table map (`master.ts` export → SQL table → pages)

| `master.ts` export | SQL table | Pages |
|---|---|---|
| `INVENTORY` | `ghg_inventory` | Dashboard, Overview, Inventory, Trends |
| `FL_TOTALS` | merged into `ghg_inventory` + `config` | Dashboard, Overview |
| `FACILITIES` | `ghg_facilities` | Overview, Workstreams, Trends |
| `S1_BREAKDOWN`, `S1_BY_FACILITY` | `s1_breakdown`, `s1_by_facility` | Inventory, Trends, Action Plan |
| `S2_BREAKDOWN`, `S2_BY_FACILITY` | `s2_breakdown`, `s2_by_facility` | Inventory, Trends, Credits |
| `INTENSITY` | `intensity_metrics` | Trends, Overview |
| `SCOPE3` (decarb scope3 summary) | `scope3_summary` | Hotspots, Overview, Decarbonisation |
| `ACTIONS` | `decarb_actions` | Action Plan, Progress, Decarbonisation |
| `ASSETS` | `decarb_assets` | Decarbonisation |
| `DECARB_MILESTONES` | `decarb_milestones` | Progress, Strategy |
| `LEVERS` | `decarb_levers` | Action Plan, Strategy |
| `PEERS` | `peers` + `peer_trends` | Peer |
| `IREC_BY_YEAR`, `GRID_MWH_HISTORY`, `SOLAR_GENERATION` | `irec_register`, `grid_mwh_history` | Credits |
| `VAULT` | `vault_documents` | Vault, Reports |
| `DATASETS` | `datasets` | Submissions |
| `ACTION_ITEMS`, `UPDATE_ITEMS` | `priority_items` | Priority Actions |
| `SCOPE1_EQUIP`, `SCOPE1_FUEL_BREAKDOWN` | `s1_equipment` | Action Plan |
| `METHODOLOGY` | `methodology` | Methodology |
| `CLUSTERS` | stored as JSON in `config` | Workstreams |
| `FACILITY_DETAILS` | merged into `ghg_facilities` | Workstreams, Credits |
| `TARGETS`, `ORG`, `IREC_FACTOR`, `CARBON_PRICES`, `GROQ_MODEL`, `REPORTING_WORKFLOW`, `SUBMISSIONS_FACILITIES`, `YEARS_S12`, `YEARS_NZ`, `COMMITTED_VS_ACTUAL`, `CUMULATIVE_REDUCTION` | `config` (key-value) | Various |

---

### SQL DDL (append to `backend/schema.sql`)

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- GHG DATA TABLES — append to existing schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. GHG Inventory — one row per entity / scope-category / FY
--    Covers all INVENTORY rows: 'Scope 1', 'Scope 2 LB', 'Cat 1' … 'Grand Total MB'
CREATE TABLE IF NOT EXISTS ghg_inventory (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  entity     ENUM('FP','FOS','FL') NOT NULL,
  scope_cat  VARCHAR(60)   NOT NULL,
  fy         VARCHAR(10)   NOT NULL,
  value      DECIMAL(14,4),               -- NULL = not yet calculated
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_inv (client_id, entity, scope_cat, fy),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 2. Scope 1 breakdown — stationary / mobile / fugitive per entity / FY
CREATE TABLE IF NOT EXISTS s1_breakdown (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  entity     ENUM('FP','FOS','FL') NOT NULL,
  fy         VARCHAR(10)  NOT NULL,
  stationary DECIMAL(10,4) DEFAULT 0,
  mobile     DECIMAL(10,4) DEFAULT 0,
  fugitive   DECIMAL(10,4) DEFAULT 0,
  total      DECIMAL(10,4) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_s1 (client_id, entity, fy),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 3. Scope 1 by facility / FY
CREATE TABLE IF NOT EXISTS s1_by_facility (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  facility   VARCHAR(100) NOT NULL,
  entity     ENUM('FP','FOS') NOT NULL,
  fy         VARCHAR(10)  NOT NULL,
  stationary DECIMAL(10,4) DEFAULT 0,
  mobile     DECIMAL(10,4) DEFAULT 0,
  fugitive   DECIMAL(10,4) DEFAULT 0,
  total      DECIMAL(10,4) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_s1f (client_id, facility, fy),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 4. Scope 2 breakdown per entity / FY
CREATE TABLE IF NOT EXISTS s2_breakdown (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  entity     ENUM('FP','FOS','FL') NOT NULL,
  fy         VARCHAR(10)  NOT NULL,
  lb         DECIMAL(10,4) DEFAULT 0,
  mb         DECIMAL(10,4) DEFAULT 0,
  grid_kwh   INT DEFAULT 0,
  re_kwh     INT DEFAULT 0,
  solar_kwh  INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_s2 (client_id, entity, fy),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 5. Scope 2 by facility / FY
CREATE TABLE IF NOT EXISTS s2_by_facility (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  facility   VARCHAR(100) NOT NULL,
  entity     ENUM('FP','FOS') NOT NULL,
  fy         VARCHAR(10)  NOT NULL,
  grid_kwh   INT DEFAULT 0,
  re_kwh     INT DEFAULT 0,
  lb         DECIMAL(10,4) DEFAULT 0,
  mb         DECIMAL(10,4) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_s2f (client_id, facility, fy),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 6. Facilities — merges FACILITIES + FACILITY_DETAILS from master.ts
CREATE TABLE IF NOT EXISTS ghg_facilities (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  client_id    INT NOT NULL,
  name         VARCHAR(150) NOT NULL,
  entity       ENUM('FP','FOS') NOT NULL,
  state        VARCHAR(100),
  grid_utility VARCHAR(50),     -- 'BESCOM', 'TNEB'
  solar_note   VARCHAR(500),
  role_note    VARCHAR(500),
  s1_fy25      DECIMAL(10,4) DEFAULT 0,
  s2_fy25      DECIMAL(10,4) DEFAULT 0,
  kwh_fy25     INT DEFAULT 0,
  active       TINYINT(1) DEFAULT 1,
  sort_order   SMALLINT DEFAULT 0,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY   uniq_fac (client_id, name),
  FOREIGN KEY  (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 7. Emission intensity per entity / FY
CREATE TABLE IF NOT EXISTS intensity_metrics (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  client_id        INT NOT NULL,
  entity           ENUM('FP','FOS','FL') NOT NULL,
  fy               VARCHAR(10) NOT NULL,
  revenue_lakh     DECIMAL(12,2),
  production_units INT,
  s12_lb           DECIMAL(10,4),
  s12_mb           DECIMAL(10,4),
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY       uniq_int (client_id, entity, fy),
  FOREIGN KEY      (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 8. Scope 3 category summary — SCOPE3 constant + values from INVENTORY
CREATE TABLE IF NOT EXISTS scope3_summary (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  entity     ENUM('FP','FOS','FL') NOT NULL,
  fy         VARCHAR(10)  NOT NULL,
  cat_id     VARCHAR(10)  NOT NULL,   -- 'cat1' … 'cat15'
  cat_name   VARCHAR(200),
  value      DECIMAL(14,4),
  method     VARCHAR(300),
  note       TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_s3 (client_id, entity, fy, cat_id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 9. Decarbonisation actions — ACTIONS constant
CREATE TABLE IF NOT EXISTS decarb_actions (
  id                  VARCHAR(50) NOT NULL,
  client_id           INT NOT NULL,
  title               VARCHAR(500),
  group_type          ENUM('quick','medium','strategic','culture'),
  scope               TINYINT,           -- 0=enabling, 1, 2, 3
  priority            ENUM('High','Medium','Low'),
  cost                ENUM('Low','Medium','High'),
  timeline            ENUM('Quick Win','Medium','Strategic'),
  facilities          JSON,              -- ["rjk","hej"] or ["*"]
  impact_min          INT DEFAULT 0,
  impact_max          INT DEFAULT 0,
  cost_per_t          INT DEFAULT 0,
  capex_range         VARCHAR(150),
  payback_yrs         DECIMAL(4,1) DEFAULT 0,
  confidence          ENUM('High','Medium','Low'),
  what_text           TEXT,
  where_text          TEXT,
  timeline_note       TEXT,
  dependencies        TEXT,
  co_benefits         TEXT,
  committed_status    ENUM('In Progress','Completed','Delayed','Not Started'),
  committed_target    VARCHAR(100),
  committed_owner     VARCHAR(200),
  committed_progress  TINYINT DEFAULT 0,
  committed_planned_t INT DEFAULT 0,
  committed_actual_t  INT,
  sort_order          SMALLINT DEFAULT 0,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY         (id, client_id),
  FOREIGN KEY         (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 10. Equipment / assets — ASSETS constant
CREATE TABLE IF NOT EXISTS decarb_assets (
  id          VARCHAR(50) NOT NULL,
  client_id   INT NOT NULL,
  facility_id VARCHAR(20),
  name        VARCHAR(300),
  type        VARCHAR(100),
  fuel        VARCHAR(100),
  fy25        DECIMAL(10,2) DEFAULT 0,
  history     JSON,           -- [42, 51, 58, 65]  FY22..FY25
  health      ENUM('efficient','monitor','replace'),
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id, client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 11. Milestones — DECARB_MILESTONES constant
CREATE TABLE IF NOT EXISTS decarb_milestones (
  id         VARCHAR(20) NOT NULL,
  client_id  INT NOT NULL,
  fy         VARCHAR(10),
  label      VARCHAR(300),
  status     ENUM('done','progress','upcoming'),
  detail     TEXT,
  sort_order SMALLINT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id, client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 12. Decarbonisation levers — LEVERS constant
CREATE TABLE IF NOT EXISTS decarb_levers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  title      VARCHAR(500),
  current_t  DECIMAL(12,3) DEFAULT 0,
  impact     VARCHAR(300),
  detail     TEXT,
  priority   ENUM('High','Medium','Low'),
  entity     VARCHAR(10),   -- 'FP', 'FOS', 'Both', 'FL'
  sort_order SMALLINT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 13. Scope 1 equipment breakdown — SCOPE1_EQUIP + SCOPE1_FUEL_BREAKDOWN
CREATE TABLE IF NOT EXISTS s1_equipment (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  row_type   ENUM('equipment','fuel') NOT NULL,
  name       VARCHAR(300),
  t          DECIMAL(10,3) DEFAULT 0,
  pct        TINYINT DEFAULT 0,
  high       TINYINT(1) DEFAULT 0,   -- equipment rows only
  sort_order SMALLINT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 14. I-REC register — IREC_BY_YEAR constant
CREATE TABLE IF NOT EXISTS irec_register (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  entity     ENUM('FP','FOS') NOT NULL,
  fy         VARCHAR(10) NOT NULL,
  facility   VARCHAR(300),
  mwh        INT DEFAULT 0,
  coverage   VARCHAR(100),
  vintage    VARCHAR(50),
  instrument TEXT,
  status     ENUM('Retired','Recommended','Active'),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 15. Grid MWh history — GRID_MWH_HISTORY constant
CREATE TABLE IF NOT EXISTS grid_mwh_history (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  entity     ENUM('FP','FOS') NOT NULL,
  fy         VARCHAR(10) NOT NULL,
  mwh        DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_grid (client_id, entity, fy),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 16. Vault documents — VAULT constant
CREATE TABLE IF NOT EXISTS vault_documents (
  id          VARCHAR(20) NOT NULL,
  client_id   INT NOT NULL,
  name        VARCHAR(500) NOT NULL,
  year        VARCHAR(10),
  entity      ENUM('FP','FOS','FL'),
  category    VARCHAR(100),
  scope       VARCHAR(10),    -- '1', '2', '3', 'All'
  size        VARCHAR(20),
  doc_date    DATE,
  sub_cluster VARCHAR(10),
  file_path   VARCHAR(1000),
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id, client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 17. Datasets catalogue — DATASETS constant
CREATE TABLE IF NOT EXISTS datasets (
  id          VARCHAR(60)  NOT NULL,
  client_id   INT NOT NULL,
  name        VARCHAR(200),
  tag         VARCHAR(100),
  description TEXT,
  documents   JSON,           -- ["Monthly electricity bills", ...]
  template    VARCHAR(300),
  sort_order  SMALLINT DEFAULT 0,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id, client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 18. Priority items — ACTION_ITEMS + UPDATE_ITEMS constants
CREATE TABLE IF NOT EXISTS priority_items (
  id         INT NOT NULL,
  client_id  INT NOT NULL,
  item_type  ENUM('action','update') NOT NULL,
  entity     VARCHAR(10),
  title      VARCHAR(500),
  age        VARCHAR(100),
  link       VARCHAR(200),
  priority   ENUM('High','Medium','Low'),
  tag        VARCHAR(100),   -- update items only
  detail     TEXT,
  sort_order SMALLINT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id, client_id, item_type),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 19. Methodology text — METHODOLOGY constant
CREATE TABLE IF NOT EXISTS methodology (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  title      VARCHAR(300),
  body       TEXT,
  sort_order SMALLINT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- 20. Peers (global, not client-specific) — PEERS constant
CREATE TABLE IF NOT EXISTS peers (
  id                     VARCHAR(50) PRIMARY KEY,
  name                   VARCHAR(200),
  initials               VARCHAR(10),
  highlight              TEXT,
  source                 VARCHAR(300),
  net_zero_year          SMALLINT,
  sbti_status            ENUM('validated','committed','no'),
  sbti_label             VARCHAR(200),
  near_term_target       TEXT,
  scope3_target          TEXT,
  base_year              VARCHAR(10),
  reduction_pct          DECIMAL(5,2),
  reduction_note         TEXT,
  renewable_elec_pct     INT DEFAULT 0,
  energy_total_gj        INT,
  energy_intensity_label VARCHAR(100),
  energy_intensity_val   DECIMAL(10,4),
  scope3_baseline        DECIMAL(14,0),
  scope3_baseline_yr     VARCHAR(10),
  scope3_latest          DECIMAL(14,0),
  scope3_latest_yr       VARCHAR(10),
  scope3_change_pct      DECIMAL(6,2),
  scope3_note            TEXT,
  revenue_musd           DECIMAL(12,2),
  source_split           JSON,   -- [{name, value}, ...]
  frameworks             JSON,   -- [{label, value}, ...]
  totals                 JSON,   -- {"2019": 949, "2022": null, ...}
  updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 21. Peer S1+S2 trend rows
CREATE TABLE IF NOT EXISTS peer_trends (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  peer_id     VARCHAR(50) NOT NULL,
  year        VARCHAR(10) NOT NULL,
  scope12     DECIMAL(12,2),
  vs_baseline DECIMAL(6,2),
  UNIQUE KEY  uniq_pt (peer_id, year),
  FOREIGN KEY (peer_id) REFERENCES peers(id)
) ENGINE=InnoDB;

-- 22. Key-value config — scalars and arrays from master.ts that don't need their own table
--     Keys: TARGETS, ORG, IREC_FACTOR, IREC_COST_PER_MWH, CARBON_CREDIT_COST_PER_T,
--           CARBON_PRICES, GROQ_MODEL, REPORTING_WORKFLOW, SUBMISSIONS_FACILITIES,
--           YEARS_S12, YEARS_NZ, COMMITTED_VS_ACTUAL, CUMULATIVE_REDUCTION,
--           S12_BASE_YEAR, S3_BASE_YEAR, CEA_EF, CLUSTERS (workstreams JSON)
CREATE TABLE IF NOT EXISTS config (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_val TEXT NOT NULL,   -- stored as JSON string
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cfg (client_id, config_key),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;
```

---

## Phase 2 — Seed Script

A single script imports everything from `master.ts` (which already re-exports the full set) and bulk-inserts into MySQL. Safe to re-run — uses `INSERT … ON DUPLICATE KEY UPDATE`.

**File:** `scripts/seed-ghg-data.ts`

```ts
// scripts/seed-ghg-data.ts
import mysql from "mysql2/promise";
import {
  // GHG inventory
  INVENTORY, YEARS,
  // Facilities
  FACILITIES, FACILITY_DETAILS,
  // S1 / S2 breakdowns
  S1_BREAKDOWN, S1_BY_FACILITY, S2_BREAKDOWN, S2_BY_FACILITY,
  // Intensity
  INTENSITY,
  // Scope 3
  SCOPE3,
  // Decarb
  ACTIONS, ASSETS, DECARB_MILESTONES, LEVERS,
  SCOPE1_EQUIP, SCOPE1_FUEL_BREAKDOWN,
  YEARS_S12, YEARS_NZ, COMMITTED_VS_ACTUAL, CUMULATIVE_REDUCTION,
  // Credits
  IREC_BY_YEAR, GRID_MWH_HISTORY, SOLAR_GENERATION,
  // Vault
  VAULT,
  // Datasets
  DATASETS,
  // Priority items
  ACTION_ITEMS, UPDATE_ITEMS,
  // Methodology
  METHODOLOGY,
  // Peers
  PEERS,
  // Config scalars
  TARGETS, ORG, IREC_FACTOR, IREC_COST_PER_MWH, CARBON_CREDIT_COST_PER_T,
  CARBON_PRICES, GROQ_MODEL, REPORTING_WORKFLOW, SUBMISSIONS_FACILITIES,
  S12_BASE_YEAR, S3_BASE_YEAR, CEA_EF,
  // Workstreams
  CLUSTERS,
  // Top emitters
  TOP_EMITTERS, TOP_EMITTERS_EQUIP,
} from "@/data/master";

const CLIENT_ID = 1;

const db = await mysql.createConnection({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// --- helpers ---
async function upsert(table: string, rows: object[]) {
  if (!rows.length) return;
  // build INSERT … ON DUPLICATE KEY UPDATE for all columns
  // …implementation…
}

// --- seed each table ---
// 1. ghg_inventory
const entities = ["FP", "FOS", "FL"] as const;
const invRows = entities.flatMap(entity =>
  Object.entries(INVENTORY[entity]).flatMap(([scopeCat, series]) =>
    YEARS.map(fy => ({
      client_id: CLIENT_ID, entity, scope_cat: scopeCat,
      fy, value: series[fy] ?? null,
    }))
  )
);
await upsert("ghg_inventory", invRows);

// 2–22. All other tables follow the same pattern …

await db.end();
console.log("Seed complete.");
```

Run once (after setting `.env`):
```bash
npx tsx scripts/seed-ghg-data.ts
```

---

## Phase 3 — PHP API Endpoints (page-based)

One PHP file per data domain in `/backend/api/`. All return JSON and use the existing session auth.

### Endpoint map

| Endpoint | Tables | Pages |
|---|---|---|
| `GET /api/ghg/inventory` | `ghg_inventory` | Dashboard, Overview, Inventory, Trends |
| `GET /api/ghg/s1` | `s1_breakdown`, `s1_by_facility` | Inventory, Trends, Action Plan |
| `GET /api/ghg/s2` | `s2_breakdown`, `s2_by_facility` | Inventory, Trends, Credits |
| `GET /api/ghg/facilities` | `ghg_facilities` | Overview, Workstreams |
| `GET /api/ghg/intensity` | `intensity_metrics` | Trends |
| `GET /api/ghg/scope3` | `scope3_summary` | Hotspots, Overview |
| `GET /api/decarb/actions` | `decarb_actions` | Action Plan, Progress |
| `GET /api/decarb/assets` | `decarb_assets` | Decarbonisation |
| `GET /api/decarb/milestones` | `decarb_milestones` | Progress, Strategy |
| `GET /api/decarb/levers` | `decarb_levers` | Action Plan, Strategy |
| `GET /api/credits/irec` | `irec_register`, `grid_mwh_history` | Credits |
| `GET /api/vault/documents` | `vault_documents` | Vault, Reports |
| `GET /api/datasets` | `datasets` | Submissions |
| `GET /api/priority-items` | `priority_items` | Priority Actions |
| `GET /api/peers` | `peers`, `peer_trends` | Peer |
| `GET /api/methodology` | `methodology` | Methodology |
| `GET /api/config` | `config` | Various (scalars + CLUSTERS) |

**Common query params:** `?entity=FL|FP|FOS` · `?fy=FY25|all`

**Example — `/backend/api/ghg/inventory.php`:**
```php
<?php
require_once '../../config.php';
require_once '../../auth.php';
header('Content-Type: application/json');

$entity = $_GET['entity'] ?? 'FL';
$fy     = $_GET['fy']     ?? 'all';
$pdo    = get_pdo();

$sql = $fy === 'all'
  ? "SELECT entity, scope_cat, fy, value FROM ghg_inventory
      WHERE client_id = ? AND entity = ? ORDER BY scope_cat, fy"
  : "SELECT entity, scope_cat, fy, value FROM ghg_inventory
      WHERE client_id = ? AND entity = ? AND fy = ?";

$args = $fy === 'all' ? [CLIENT_ID, $entity] : [CLIENT_ID, $entity, $fy];
$stmt = $pdo->prepare($sql);
$stmt->execute($args);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
```

---

## Phase 4 — Frontend Migration (page by page)

Replace `import { … } from "@/data/master"` with server function calls. Types stay in `master.ts`; only the data constants move.

**Before:**
```ts
import { INVENTORY, S1_BREAKDOWN } from "@/data/master";
```

**After:**
```ts
import { createServerFn } from "@tanstack/start";

const fetchInventoryData = createServerFn().handler(async () => {
  const [inv, s1] = await Promise.all([
    fetch(`${API_BASE}/api/ghg/inventory?entity=FL`).then(r => r.json()),
    fetch(`${API_BASE}/api/ghg/s1?entity=FL`).then(r => r.json()),
  ]);
  return { inventory: inv, s1Breakdown: s1 };
});
```

### Migration order (lowest risk first)

| # | Page | Endpoints needed |
|---|---|---|
| 1 | `/methodology` | `GET /api/methodology` |
| 2 | `/vault` | `GET /api/vault/documents` |
| 3 | `/submissions` | `GET /api/datasets` |
| 4 | `/priority-actions` | `GET /api/priority-items` |
| 5 | `/credits` | `GET /api/credits/irec` |
| 6 | `/peer` | `GET /api/peers` |
| 7 | `/decarbonisation` | `GET /api/decarb/assets`, `GET /api/decarb/actions` |
| 8 | `/action-plan` | `GET /api/decarb/actions`, `GET /api/decarb/levers` |
| 9 | `/progress` | `GET /api/decarb/milestones`, `GET /api/decarb/actions` |
| 10 | `/trends` | `GET /api/ghg/inventory`, `GET /api/ghg/s1`, `GET /api/ghg/s2`, `GET /api/ghg/intensity` |
| 11 | `/inventory` | `GET /api/ghg/inventory`, `GET /api/ghg/s1`, `GET /api/ghg/s2` |
| 12 | `/overview`, `/dashboard` | `GET /api/ghg/inventory`, `GET /api/config` |
| 13 | `/hotspots` | `GET /api/ghg/scope3` |
| 14 | `/workstreams` | `GET /api/ghg/facilities`, `GET /api/config` (for CLUSTERS) |

---

## Phase 5 — Cleanup

Once all pages are migrated:

1. Delete `src/data/featherlite.ts`, `decarb-data.ts`, `datasets.ts`
2. Strip all data constants from `master.ts` — keep only TypeScript types (`FY`, `Entity`, `InventoryRows`, interfaces, etc.)
3. Rename to `master.types.ts` or keep as `master.ts` — either works

---

## Data Update Workflow (post-migration)

**New fiscal year (FY27):**
```sql
INSERT INTO ghg_inventory (client_id, entity, scope_cat, fy, value) VALUES
  (1, 'FP', 'Scope 1', 'FY27', 38.5),
  (1, 'FP', 'Scope 2 LB', 'FY27', 82.1), …;
```
Zero code deploy required.

**Correct a number:**
```sql
UPDATE ghg_inventory SET value = 123.456
 WHERE client_id = 1 AND entity = 'FP' AND scope_cat = 'Scope 1' AND fy = 'FY26';
```

**Add an I-REC:**
```sql
INSERT INTO irec_register (client_id, entity, fy, facility, mwh, status, …)
VALUES (1, 'FP', 'FY27', 'Rajanakunte', 130, 'Recommended', …);
```

---

## Effort Estimate

| Phase | Work | Time |
|---|---|---|
| 1. Schema | Run DDL in phpMyAdmin | 0.5 day |
| 2. Seed script | `seed-ghg-data.ts` importing from `master.ts` | 1 day |
| 3. PHP API | ~12 endpoint files | 2 days |
| 4. Frontend | 14 pages × ~30 min | 3–4 days |
| 5. Cleanup | Delete source files, trim master.ts | 0.5 day |
| **Total** | | **~7–8 days** |

---

## Decisions to Confirm

1. **API auth** — existing PHP session cookie (simplest, same-origin) or Bearer token?
2. **`CLUSTERS` / Workstreams** — store as one JSON blob in `config` rather than fully normalised. Acceptable?
3. **Monthly series** (`S1_MONTHLY_FL`, `S2_MONTHLY_FL`, `FP_FY26_MONTHLY`) — used only in the interactive inventory chart. Defer to a separate `monthly_actuals` table in Phase 4b, or do now?
