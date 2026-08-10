# Database Schema

**Engine:** MySQL 8 / InnoDB  
**Database:** `u833634340_decarb`  
**Authoritative file:** `backend/schema_combined.sql`  
**Safe to re-run:** Yes — uses `IF NOT EXISTS` and `ON DUPLICATE KEY` guards everywhere.

---

## Tables Overview

| # | Table | Purpose |
|---|---|---|
| 1 | `clients` | One row per client organisation |
| 2 | `client_entities` | Reporting entities per client (e.g. FP, FOS, FL) |
| 3 | `client_config` | Key-value configuration per client |
| 4 | `users` | Portal user accounts |
| 5 | `sessions` | Active session tokens |
| 6 | `password_resets` | One-time password reset tokens |
| 7 | `submissions` | Data submission records |
| 8 | `submission_files` | Files attached to submissions |
| 9 | `audit_log` | Submission review history |
| 10 | `computed_metrics` | Legacy computed metrics (backward compat) |
| 11 | `notification_prefs` | Per-user email notification preferences |
| 12 | `notification_log` | Email dispatch history |
| 13 | `ghg_inventory` | Core GHG metrics store |
| 14 | `s1_breakdown` | Scope 1 sub-category breakdown |
| 15 | `s1_by_facility` | Scope 1 breakdown by facility |
| 16 | `s2_breakdown` | Scope 2 kWh and tCO2e (LB + MB) |
| 17 | `s2_by_facility` | Scope 2 breakdown by facility |
| 18 | `ghg_facilities` | Facility registry per client |
| 19 | `intensity_metrics` | Revenue + production intensity per year |
| 20 | `scope3_summary` | Scope 3 tCO2e by category per year |
| 21 | `decarb_actions` | Decarbonisation action items |
| 22 | `decarb_assets` | Equipment/asset register |
| 23 | `s1_equipment` | Scope 1 timeseries per asset |
| 24 | `irec_register` | I-REC certificate register |
| 25 | `grid_mwh_history` | Grid MWh history per entity/year |
| 26 | `vault_documents` | Document vault records |
| 27 | `datasets` | Submission dataset definitions |
| 28 | `priority_items` | Priority actions and updates |
| 29 | `methodology` | Methodology sections |
| 30 | `peers` | Peer organisations for benchmarking |
| 31 | `peer_trends` | Peer GHG trend data |

---

## Table Definitions

### 1. `clients`
One row per client organisation.

| Column | Type | Description |
|---|---|---|
| `id` | INT PK AI | |
| `name` | VARCHAR(255) | Display name (e.g. "Featherlite (FP + FOS)") |
| `slug` | VARCHAR(100) UNIQUE | URL-safe identifier (e.g. `featherlite`) |
| `drive_root_folder_id` | VARCHAR(255) | Google Drive root folder ID |
| `logo_url` | VARCHAR(500) | Logo URL (default: `/deepwoods-logo.png`) |
| `primary_color` | VARCHAR(20) | Brand hex color (default: `#1E6F5C`) |
| `currency` | VARCHAR(10) | Currency code (default: `INR`) |
| `reporting_period` | ENUM('FY','CY') | Fiscal Year or Calendar Year |
| `created_at` | TIMESTAMP | |

### 2. `client_entities`
Reporting entities per client. A consolidated entity `is_consolidated=1` aggregates child entities listed in `consolidates`.

| Column | Type | Description |
|---|---|---|
| `id` | INT PK AI | |
| `client_id` | INT FK → clients | |
| `code` | VARCHAR(20) | Short entity code (e.g. "FP", "FOS", "FL") |
| `name` | VARCHAR(255) | Full legal name |
| `short_name` | VARCHAR(50) | Display name |
| `is_consolidated` | TINYINT(1) | 1 = aggregate/consolidated entity |
| `consolidates` | JSON | Array of child entity codes (e.g. `["FP","FOS"]`) |
| `sort_order` | INT | Display order |

UNIQUE: `(client_id, code)`

### 3. `client_config`
Key-value configuration per client. All config is fetched once at login via `context.php` and cached in `sessionStorage`.

| Column | Type | Description |
|---|---|---|
| `id` | INT PK AI | |
| `client_id` | INT FK → clients | |
| `config_key` | VARCHAR(100) | Configuration key |
| `config_value` | TEXT | Configuration value (JSON or plain string) |

UNIQUE: `(client_id, config_key)`

**Standard config keys:**

| Key | Example Value | Description |
|---|---|---|
| `base_year_s12` | `"FY22"` | Scope 1 & 2 base year |
| `base_year_s3` | `"FY24"` | Scope 3 base year |
| `netzero_year` | `"2040"` | Net-zero target year |
| `sbti_target_s12` | `"42"` | SBTi reduction target % for S1+S2 |
| `sbti_target_year` | `"2030"` | SBTi target year |
| `irec_factor` | `"0.597"` | I-REC cost factor |
| `irec_max_mwh` | `"144"` | Maximum I-REC procurement in MWh |
| `current_year_open` | `"true"` | Whether current FY collection is open |
| `s3_boundary` | `["Cat 1","Cat 2"...]` | JSON array of relevant Scope 3 categories |
| `enabled_pages` | `["workstreams","dashboard"...]` | JSON array of enabled portal pages |

### 4. `users`

| Column | Type | Description |
|---|---|---|
| `id` | INT PK AI | |
| `email` | VARCHAR(255) UNIQUE | Login email |
| `password_hash` | VARCHAR(255) | bcrypt hash |
| `role` | ENUM | See roles below |
| `client_id` | INT FK → clients | NULL = platform-level admin |
| `entity_scope` | VARCHAR(20) | NULL = all entities, "FP"/"FOS" = restricted |
| `must_change_password` | TINYINT(1) | Forces password change on next login |
| `created_at` | TIMESTAMP | |

**Roles ENUM:**
- `sustainability_team` — Primary client role, full portal access
- `client_uploader` — Data submission access
- `client_leadership` — Read-only leadership view
- `deepwoods_admin` — Platform admin, all clients
- `deepwoods_coordinator` — Platform coordinator
- `featherlite_team` — Legacy Featherlite-specific role (TODO: migrate)
- `featherlite_leadership` — Legacy Featherlite-specific role (TODO: migrate)
- `automation_demo` — Demo role for automation walkthrough (TODO: remove)

### 5. `sessions`

| Column | Type | Description |
|---|---|---|
| `token` | VARCHAR(64) PK | 64-char hex (32 random bytes) |
| `user_id` | INT FK → users | |
| `created_at` | TIMESTAMP | |
| `expires_at` | DATETIME | Session expiry |

### 6. `password_resets`

| Column | Type | Description |
|---|---|---|
| `id` | INT PK AI | |
| `user_id` | INT FK → users | |
| `token` | VARCHAR(64) UNIQUE | One-time reset token |
| `expires_at` | DATETIME | Token expiry |
| `used` | TINYINT(1) | 1 = already consumed |
| `created_at` | TIMESTAMP | |

### 7. `submissions`
Data submission records created when a client uploads a dataset.

| Column | Type | Description |
|---|---|---|
| `id` | INT PK AI | |
| `client_id` | INT FK → clients | |
| `entity` | VARCHAR(20) | Entity code (e.g. "FP", "FOS") |
| `version` | ENUM('V1','V2','V3') | Submission version |
| `dataset_id` | VARCHAR(100) | Dataset identifier (e.g. "scope1_energy") |
| `dataset_name` | VARCHAR(255) | Human-readable dataset name |
| `tag` | VARCHAR(100) | Short category tag |
| `year` | VARCHAR(10) | Fiscal/calendar year (e.g. "FY26") |
| `unit` | VARCHAR(100) | Scope of submission (default: "Organisation-wide") |
| `notes` | TEXT | Submitter notes |
| `status` | ENUM('Pending','Approved','Rejected') | Review status |
| `submitted_by` | VARCHAR(255) | Submitter email |
| `created_at` | TIMESTAMP | |
| `reviewed_by` | VARCHAR(255) | Reviewer email |
| `reviewed_at` | TIMESTAMP NULL | |
| `rejection_reason` | TEXT | Reason if rejected |

### 8. `submission_files`

| Column | Type | Description |
|---|---|---|
| `id` | INT PK AI | |
| `submission_id` | INT FK → submissions | |
| `original_name` | VARCHAR(500) | Original filename |
| `drive_file_id` | VARCHAR(255) | Google Drive file ID |
| `drive_file_link` | VARCHAR(1000) | Google Drive share link |
| `kind` | ENUM('data','document') | Data file or supporting document |
| `uploaded_at` | TIMESTAMP | |

### 9. `audit_log`
Immutable review history — one row per review action.

| Column | Type | Description |
|---|---|---|
| `id` | INT PK AI | |
| `submission_id` | INT FK → submissions | |
| `action` | ENUM('Approved','Rejected','Reassigned') | |
| `actor` | VARCHAR(255) | Reviewer email |
| `notes` | TEXT | Reviewer notes |
| `created_at` | TIMESTAMP | |

### 13. `ghg_inventory`
Core GHG metrics store. One row per client/entity/year/metric.

| Column | Type | Description |
|---|---|---|
| `id` | INT PK AI | |
| `client_id` | INT FK → clients | |
| `entity` | VARCHAR(20) | Entity code |
| `year` | VARCHAR(10) | Fiscal year (e.g. "FY25") |
| `metric_key` | VARCHAR(100) | Metric name (e.g. "Scope 1", "Cat 1", "Grand Total LB") |
| `metric_value` | DECIMAL(14,3) | tCO2e value |
| `updated_at` | TIMESTAMP | |

UNIQUE: `(client_id, entity, year, metric_key)`

### 14. `s1_breakdown`
Scope 1 sub-category breakdown.

| Column | Type | Description |
|---|---|---|
| `source_type` | VARCHAR(50) | "Stationary", "Mobile", "Fugitive" |
| `fuel_type` | VARCHAR(100) | Fuel name |
| `tco2e` | DECIMAL(14,4) | |

### 16. `s2_breakdown`
Scope 2 electricity data.

| Column | Type | Description |
|---|---|---|
| `grid_kwh` | DECIMAL(14,3) | Total grid electricity purchased |
| `re_kwh` | DECIMAL(14,3) | Renewable energy covered |
| `tco2e_lb` | DECIMAL(14,4) | Location-based tCO2e |
| `tco2e_mb` | DECIMAL(14,4) | Market-based tCO2e |

### 18. `ghg_facilities`
Facility registry.

| Column | Type | Description |
|---|---|---|
| `entity` | VARCHAR(20) | Entity code |
| `name` | VARCHAR(255) | Facility name |
| `location` | VARCHAR(255) | City/area |
| `state` | VARCHAR(100) | State/province |
| `grid_utility` | VARCHAR(100) | Electricity utility name |
| `re_instrument` | VARCHAR(255) | Renewable energy instrument (PPA, I-REC, solar) |

### 19. `intensity_metrics`

| Column | Type | Description |
|---|---|---|
| `revenue_lakh` | DECIMAL(14,2) | Revenue in lakhs (INR) |
| `production_units` | DECIMAL(14,2) | Units produced |
| `s12_lb` | DECIMAL(14,4) | Scope 1+2 location-based tCO2e |
| `s12_mb` | DECIMAL(14,4) | Scope 1+2 market-based tCO2e |
| `s3_total` | DECIMAL(14,4) | Scope 3 total tCO2e |

### 22. `decarb_assets`
Equipment/asset register used by the Inventory page.

| Column | Type | Description |
|---|---|---|
| `asset_id` | VARCHAR(50) | Short code (e.g. "S1-STAT-01") |
| `name` | VARCHAR(500) | Asset description |
| `facility` | VARCHAR(255) | Facility name |
| `fuel_type` | VARCHAR(100) | Fuel or energy type |
| `scope` | VARCHAR(20) | "Scope 1", "Scope 2", etc. |
| `sub_type` | VARCHAR(50) | "Stationary", "Mobile", "Fugitive", "Electricity", "Renewables" |
| `status` | VARCHAR(50) | "Active", "Retired", "Planned" |
| `health` | VARCHAR(50) | "Efficient", "Monitor", "Action Required" |

### 24. `irec_register`
I-REC certificate records.

| Column | Type | Description |
|---|---|---|
| `entity` | VARCHAR(20) | Entity code |
| `year` | VARCHAR(10) | FY |
| `facility` | VARCHAR(255) | Facility name |
| `mwh` | DECIMAL(14,3) | MWh covered |
| `coverage` | VARCHAR(100) | Coverage description |
| `vintage` | VARCHAR(50) | Certificate vintage year |
| `instrument` | TEXT | Instrument details (PPA, I-REC, solar) |
| `status` | VARCHAR(50) | "Active", "Retired", etc. |

---

## Relationships Diagram

```
clients
  ├── client_entities (client_id)
  ├── client_config (client_id)
  ├── users (client_id)
  │     └── sessions (user_id)
  │     └── password_resets (user_id)
  ├── submissions (client_id)
  │     └── submission_files (submission_id)
  │     └── audit_log (submission_id)
  ├── ghg_inventory (client_id)
  ├── s1_breakdown (client_id)
  ├── s1_by_facility (client_id)
  ├── s2_breakdown (client_id)
  ├── s2_by_facility (client_id)
  ├── ghg_facilities (client_id)
  ├── intensity_metrics (client_id)
  ├── scope3_summary (client_id)
  ├── decarb_actions (client_id)
  ├── decarb_assets (client_id)
  │     └── s1_equipment (client_id, asset_id)
  ├── irec_register (client_id)
  ├── grid_mwh_history (client_id)
  ├── vault_documents (client_id)
  ├── datasets (client_id)
  ├── priority_items (client_id)
  ├── methodology (client_id)
  ├── peers (client_id)
  │     └── peer_trends (peer_id, client_id)
  └── computed_metrics (client_id) [legacy]
```

---

## Import Instructions

**Fresh setup:**
```sql
-- In phpMyAdmin: Import backend/schema_combined.sql
-- Then run: php backend/seed_featherlite.php  (for Featherlite demo data)
-- Or run: mysql -u user -p dbname < backend/seed_dolphin_navitas.sql
```

**Backup:**
```bash
mysqldump -u user -p u833634340_decarb > backup_$(date +%Y%m%d).sql
```
