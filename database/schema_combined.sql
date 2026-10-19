-- SUPERSEDED by database/schema_v2.sql (canonical, complete). Kept for history only.
-- ─────────────────────────────────────────────────────────────────────────────
-- Decarb Portal — schema_combined.sql
-- Multi-client GHG portal — SINGLE FILE for fresh database import
--
-- Import this ONE file in phpMyAdmin on a fresh DB.
-- Then run seed_featherlite.php to populate Featherlite data.
--
-- Safe to re-run (IF NOT EXISTS + ON DUPLICATE KEY guards everywhere).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Clients ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  name                 VARCHAR(255) NOT NULL,
  slug                 VARCHAR(100) NOT NULL UNIQUE,
  drive_root_folder_id VARCHAR(255),
  drive_refresh_token  TEXT          DEFAULT NULL,
  logo_url             VARCHAR(500)  DEFAULT '/deepwoods-logo.png',
  primary_color        VARCHAR(20)   DEFAULT '#1E6F5C',
  currency             VARCHAR(10)   DEFAULT 'INR',
  is_active            TINYINT(1)   NOT NULL DEFAULT 0,
  activated_at         DATETIME     DEFAULT NULL,
  reporting_period     ENUM('FY','CY') DEFAULT 'FY',
  invoice_ref          VARCHAR(100) DEFAULT NULL,
  payment_status       ENUM('pending','paid','waived') NOT NULL DEFAULT 'pending',
  payment_date         DATE         DEFAULT NULL,
  payment_notes        TEXT         DEFAULT NULL,
  account_owner        VARCHAR(255) DEFAULT NULL,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Featherlite client row (set drive_root_folder_id via phpMyAdmin or app)
INSERT INTO clients (name, slug, drive_root_folder_id, is_active, activated_at)
VALUES ('Featherlite (FP + FOS)', 'featherlite', '', 1, NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1;

-- ── 2. Client entities ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_entities (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  client_id       INT NOT NULL,
  code            VARCHAR(20)  NOT NULL,
  name            VARCHAR(255) NOT NULL,
  short_name      VARCHAR(50)  NOT NULL,
  is_consolidated TINYINT(1)   NOT NULL DEFAULT 0,
  consolidates    JSON         DEFAULT NULL,
  sort_order      INT          NOT NULL DEFAULT 0,
  -- Legal entity detail (migration_002)
  country         VARCHAR(100) DEFAULT NULL,
  registration_no VARCHAR(100) DEFAULT NULL,
  tax_id          VARCHAR(50)  DEFAULT NULL,
  org_type        VARCHAR(100) DEFAULT NULL,
  legal_address   TEXT         DEFAULT NULL,
  UNIQUE KEY uniq_entity (client_id, code),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

INSERT INTO client_entities (client_id, code, name, short_name, is_consolidated, consolidates, sort_order)
SELECT id, 'FL', 'Featherlite (Consolidated)', 'FL', 1, '["FP","FOS"]', 0
FROM clients WHERE slug = 'featherlite'
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO client_entities (client_id, code, name, short_name, is_consolidated, consolidates, sort_order)
SELECT id, 'FP', 'Featherlite Products Pvt. Ltd.', 'FP', 0, NULL, 1
FROM clients WHERE slug = 'featherlite'
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO client_entities (client_id, code, name, short_name, is_consolidated, consolidates, sort_order)
SELECT id, 'FOS', 'Featherlite Office Systems Pvt. Ltd.', 'FOS', 0, NULL, 2
FROM clients WHERE slug = 'featherlite'
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ── 3. Client config ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_config (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  client_id    INT NOT NULL,
  config_key   VARCHAR(100) NOT NULL,
  config_value TEXT NOT NULL,
  UNIQUE KEY uniq_config (client_id, config_key),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

INSERT INTO client_config (client_id, config_key, config_value)
SELECT id, 'base_year_s12',    'FY22'  FROM clients WHERE slug='featherlite' ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);
INSERT INTO client_config (client_id, config_key, config_value)
SELECT id, 'base_year_s3',     'FY24'  FROM clients WHERE slug='featherlite' ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);
INSERT INTO client_config (client_id, config_key, config_value)
SELECT id, 'netzero_year',     '2040'  FROM clients WHERE slug='featherlite' ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);
INSERT INTO client_config (client_id, config_key, config_value)
SELECT id, 'sbti_target_s12',  '42'    FROM clients WHERE slug='featherlite' ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);
INSERT INTO client_config (client_id, config_key, config_value)
SELECT id, 'sbti_target_year', '2030'  FROM clients WHERE slug='featherlite' ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);
INSERT INTO client_config (client_id, config_key, config_value)
SELECT id, 'irec_factor',      '0.597' FROM clients WHERE slug='featherlite' ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);
INSERT INTO client_config (client_id, config_key, config_value)
SELECT id, 'irec_max_mwh',     '144'   FROM clients WHERE slug='featherlite' ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);
INSERT INTO client_config (client_id, config_key, config_value)
SELECT id, 'current_year_open','true'  FROM clients WHERE slug='featherlite' ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);
INSERT INTO client_config (client_id, config_key, config_value)
SELECT id, 's3_boundary', '["Cat 1","Cat 2","Cat 3","Cat 4","Cat 5","Cat 6","Cat 7","Cat 9","Cat 11","Cat 12"]'
FROM clients WHERE slug='featherlite' ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);
INSERT INTO client_config (client_id, config_key, config_value)
SELECT id, 'enabled_pages', '["workstreams","overview","dashboard","inventory","hotspots","action-plan","progress","peer","green-finance","credits","reports","submissions","vault","methodology","priority-actions"]'
FROM clients WHERE slug='featherlite' ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);

-- ── 4. Users ─────────────────────────────────────────────────────────────────
-- entity_scope: NULL = full access (admin / FL consolidated)
--               'FP'  = FP data only
--               'FOS' = FOS data only

CREATE TABLE IF NOT EXISTS users (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  email                VARCHAR(255) NOT NULL UNIQUE,
  password_hash        VARCHAR(255) NOT NULL,
  role                 ENUM(
                         'sustainability_team', 'client_uploader', 'client_leadership',
                         'deepwoods_admin', 'deepwoods_coordinator'
                       ) NOT NULL DEFAULT 'sustainability_team',
  client_id            INT DEFAULT NULL,
  entity_scope         VARCHAR(20) DEFAULT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  orientation_done     TINYINT(1) NOT NULL DEFAULT 0,
  display_name         VARCHAR(120) DEFAULT NULL,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 5. Sessions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  token      VARCHAR(64) PRIMARY KEY,
  user_id    INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 6. Password resets ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_resets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token      VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used       TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 7. Submissions ───────────────────────────────────────────────────────────
-- entity is VARCHAR(20) from the start — not ENUM, supports any client's entities

CREATE TABLE IF NOT EXISTS submissions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  client_id        INT NOT NULL,
  entity           VARCHAR(20) NOT NULL,
  version          ENUM('V1','V2','V3') NOT NULL,
  dataset_id       VARCHAR(100) NOT NULL,
  dataset_name     VARCHAR(255) NOT NULL,
  tag              VARCHAR(100) NOT NULL,
  year             VARCHAR(10) NOT NULL,
  unit             VARCHAR(100) DEFAULT 'Organisation-wide',
  notes            TEXT,
  status           ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  submitted_by     VARCHAR(255) NOT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by      VARCHAR(255) DEFAULT NULL,
  reviewed_at      TIMESTAMP NULL DEFAULT NULL,
  rejection_reason TEXT DEFAULT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 8. Submission files ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS submission_files (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  submission_id   INT NOT NULL,
  original_name   VARCHAR(500) NOT NULL,
  drive_file_id   VARCHAR(255) NOT NULL,
  drive_file_link VARCHAR(1000) NOT NULL,
  kind            ENUM('data','document') NOT NULL DEFAULT 'data',
  uploaded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 9. Audit log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  action        ENUM('Approved','Rejected','Reassigned') NOT NULL,
  actor         VARCHAR(255) NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 10. Computed metrics (legacy write-path, kept for backward compat) ────────

CREATE TABLE IF NOT EXISTS computed_metrics (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  client_id    INT NOT NULL,
  entity       VARCHAR(20) NOT NULL DEFAULT '',
  year         VARCHAR(10) NOT NULL,
  metric_key   VARCHAR(100) NOT NULL,
  metric_value DECIMAL(14,3) NOT NULL,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_metric (client_id, entity, year, metric_key),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 11. Notification preferences ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_prefs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_email      VARCHAR(255) NOT NULL UNIQUE,
  enabled         TINYINT(1)   NOT NULL DEFAULT 1,
  frequency       ENUM('daily','weekly','monthly','custom') NOT NULL DEFAULT 'weekly',
  custom_date     DATE         NULL,
  send_time       TIME         NOT NULL DEFAULT '08:00:00',
  include_actions TINYINT(1)   NOT NULL DEFAULT 1,
  include_updates TINYINT(1)   NOT NULL DEFAULT 1,
  last_sent_at    DATETIME     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── 12. Notification log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  frequency  VARCHAR(20)  NOT NULL,
  status     ENUM('sent','failed') NOT NULL,
  details    TEXT         NULL,
  sent_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── 13. GHG Inventory ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ghg_inventory (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  client_id    INT NOT NULL,
  entity       VARCHAR(20) NOT NULL,
  year         VARCHAR(10) NOT NULL,
  metric_key   VARCHAR(100) NOT NULL,
  metric_value DECIMAL(14,3),
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_inv (client_id, entity, year, metric_key),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 14. Scope 1 breakdown ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS s1_breakdown (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  client_id   INT NOT NULL,
  entity      VARCHAR(20) NOT NULL,
  year        VARCHAR(10) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  fuel_type   VARCHAR(100) NOT NULL,
  tco2e       DECIMAL(14,4),
  UNIQUE KEY uniq_s1 (client_id, entity, year, source_type, fuel_type),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 15. Scope 1 by facility ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS s1_by_facility (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  entity    VARCHAR(20) NOT NULL,
  year      VARCHAR(10) NOT NULL,
  facility  VARCHAR(255) NOT NULL,
  sub_type  VARCHAR(50) NOT NULL,
  tco2e     DECIMAL(14,4),
  UNIQUE KEY uniq_s1f (client_id, entity, year, facility, sub_type),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 16. Scope 2 breakdown ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS s2_breakdown (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  client_id      INT NOT NULL,
  entity         VARCHAR(20) NOT NULL,
  year           VARCHAR(10) NOT NULL,
  breakdown_type VARCHAR(20) NOT NULL DEFAULT 'standard',
  grid_kwh       DECIMAL(14,3),
  re_kwh         DECIMAL(14,3),
  tco2e_lb       DECIMAL(14,4),
  tco2e_mb       DECIMAL(14,4),
  UNIQUE KEY uniq_s2 (client_id, entity, year),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 17. Scope 2 by facility ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS s2_by_facility (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  entity    VARCHAR(20) NOT NULL,
  year      VARCHAR(10) NOT NULL,
  facility  VARCHAR(255) NOT NULL,
  tco2e_lb  DECIMAL(14,4),
  tco2e_mb  DECIMAL(14,4),
  UNIQUE KEY uniq_s2f (client_id, entity, year, facility),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 18. Facilities ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ghg_facilities (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  client_id     INT NOT NULL,
  entity        VARCHAR(20) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  short_name    VARCHAR(40) NULL COMMENT 'Short slug used in asset IDs — must be unique per client',
  location      VARCHAR(255),
  state         VARCHAR(100),
  grid_utility  VARCHAR(100),
  re_instrument VARCHAR(255),
  status        VARCHAR(20) DEFAULT 'active',
  is_hq         TINYINT(1)  NOT NULL DEFAULT 0 COMMENT 'Marks the HQ / registered office facility',
  UNIQUE KEY uniq_fac_short (client_id, short_name),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 19. Intensity metrics ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intensity_metrics (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  client_id        INT NOT NULL,
  entity           VARCHAR(20) NOT NULL,
  year             VARCHAR(10) NOT NULL,
  revenue_lakh     DECIMAL(14,2),
  production_units DECIMAL(14,2),
  s12_lb           DECIMAL(14,4),
  s12_mb           DECIMAL(14,4),
  s3_total         DECIMAL(14,4),
  UNIQUE KEY uniq_int (client_id, entity, year),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 20. Scope 3 summary ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scope3_summary (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  entity    VARCHAR(20) NOT NULL,
  year      VARCHAR(10) NOT NULL,
  category  VARCHAR(20) NOT NULL,
  tco2e     DECIMAL(14,4),
  UNIQUE KEY uniq_s3 (client_id, entity, year, category),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 21. Decarbonisation actions ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decarb_actions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  client_id   INT NOT NULL,
  entity      VARCHAR(20) NOT NULL,
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  facilities  JSON,
  lever       VARCHAR(100),
  status      VARCHAR(50) DEFAULT 'Planned',
  priority    ENUM('High','Medium','Low') DEFAULT 'Medium',
  abatement_t DECIMAL(10,2),
  timeline    VARCHAR(100),
  owner              VARCHAR(150) DEFAULT NULL,
  start_date         DATE DEFAULT NULL,
  end_date           DATE DEFAULT NULL,
  cost               DECIMAL(14,2) DEFAULT NULL,
  actual_abatement_t DECIMAL(14,2) DEFAULT NULL,
  updated_at         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 21b. Calculation / verification status (per entity + year) ───────────────
CREATE TABLE IF NOT EXISTS calc_status (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  client_id     INT NOT NULL,
  entity        VARCHAR(20) NOT NULL,
  fiscal_year   VARCHAR(10) NOT NULL,
  status        ENUM('draft','calculated','verified','locked') NOT NULL DEFAULT 'draft',
  calculated_at DATETIME NULL,
  verified_at   DATETIME NULL,
  verified_by   VARCHAR(255) NULL,
  ef_version    VARCHAR(100) NULL,
  notes         TEXT NULL,
  updated_by    VARCHAR(255) NULL,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_calc (client_id, entity, fiscal_year),
  KEY idx_calc_client (client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 21d. Staff activity trail ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_activity (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NULL,
  actor      VARCHAR(255) NOT NULL,
  action     VARCHAR(60)  NOT NULL,
  detail     TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_act_client (client_id, created_at),
  KEY idx_act_created (created_at)
) ENGINE=InnoDB;

-- ── 21c. Reporting cycle (due dates + submitted / locked state) ──────────────
CREATE TABLE IF NOT EXISTS reporting_cycles (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  client_id     INT NOT NULL,
  entity        VARCHAR(20) NOT NULL,
  fiscal_year   VARCHAR(10) NOT NULL,
  data_due_date DATE NULL,
  report_due_date DATE NULL,
  status        ENUM('open','submitted','locked') NOT NULL DEFAULT 'open',
  submitted_at  DATETIME NULL,
  submitted_by  VARCHAR(255) NULL,
  notes         TEXT NULL,
  updated_by    VARCHAR(255) NULL,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cycle (client_id, entity, fiscal_year),
  KEY idx_cycle_client (client_id),
  KEY idx_cycle_due (data_due_date),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 22. Asset / equipment register ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decarb_assets (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  client_id        INT NOT NULL,
  asset_id         VARCHAR(100) NOT NULL,
  entity           VARCHAR(20) NOT NULL,
  name             VARCHAR(500) NOT NULL,
  facility         VARCHAR(255),
  fuel_type        VARCHAR(100),
  scope            VARCHAR(20),
  sub_type         VARCHAR(50),
  status           VARCHAR(50) DEFAULT 'Active',
  health           VARCHAR(50) DEFAULT 'Efficient',
  unit             VARCHAR(20) DEFAULT 'tCO2e',
  -- Year range: NULL = active for all years; FY string e.g. 'FY26'
  active_from_fy   VARCHAR(10) DEFAULT NULL,
  active_through_fy VARCHAR(10) DEFAULT NULL,
  UNIQUE KEY uniq_asset (client_id, asset_id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 22a. Inventory boundary — Scope 1 assets ────────────────────────────────

CREATE TABLE IF NOT EXISTS inv_scope1_assets (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  client_id                INT NOT NULL,
  client_ref               VARCHAR(100) NOT NULL,    -- stable frontend id (e.g. s1-1234567890)
  fiscal_year              VARCHAR(10) NOT NULL,
  subcategory              VARCHAR(50) NOT NULL,     -- stationary | mobile | fugitive
  name                     VARCHAR(500) NOT NULL,
  facility_id              VARCHAR(100) DEFAULT NULL, -- numeric ghg_facilities.id or entity code
  status                   VARCHAR(50) DEFAULT 'active',
  fuel_type                VARCHAR(100) DEFAULT NULL,
  is_biogenic              TINYINT(1) NOT NULL DEFAULT 0,
  equipment_type           VARCHAR(100) DEFAULT NULL,
  nameplate_capacity_value DECIMAL(14,4) DEFAULT NULL,
  nameplate_capacity_unit  VARCHAR(30) DEFAULT NULL,
  commissioning_date       DATE DEFAULT NULL,
  vehicle_type             VARCHAR(100) DEFAULT NULL,
  vehicle_count            INT DEFAULT NULL,
  ownership                VARCHAR(50) DEFAULT NULL,
  refrigerant_or_gas       VARCHAR(100) DEFAULT NULL,
  refrigerant_charge_kg    DECIMAL(14,4) DEFAULT NULL,
  annual_leakage_pct       DECIMAL(8,4) DEFAULT NULL,
  installation_date        DATE DEFAULT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 22b. Inventory boundary — Scope 2 sources ────────────────────────────────

CREATE TABLE IF NOT EXISTS inv_scope2_sources (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  client_id              INT NOT NULL,
  client_ref             VARCHAR(100) NOT NULL,    -- stable frontend id
  fiscal_year            VARCHAR(10) NOT NULL,
  category               VARCHAR(50) NOT NULL,     -- electricity | steam | heat | cooling
  name                   VARCHAR(500) NOT NULL,
  facility_id            VARCHAR(100) DEFAULT NULL,
  status                 VARCHAR(50) DEFAULT 'active',
  supplier               VARCHAR(255) DEFAULT NULL,
  grid_connection_type   VARCHAR(50) DEFAULT NULL, -- metered | estimated
  grid_region            VARCHAR(100) DEFAULT NULL,
  consumer_number        VARCHAR(100) DEFAULT NULL,
  renewable_procurement  JSON DEFAULT NULL,
  contract_type          VARCHAR(50) DEFAULT NULL,
  source_description     TEXT DEFAULT NULL,
  is_low_carbon          TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 23. Monthly tracker drafts (raw input from client data submissions) ──────

CREATE TABLE IF NOT EXISTS tracker_drafts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  client_id   INT NOT NULL,
  entity      VARCHAR(20) NOT NULL,
  fiscal_year VARCHAR(10) NOT NULL,
  asset_id    VARCHAR(100) NOT NULL,
  period      VARCHAR(20) NOT NULL,   -- e.g. 'APR-25', 'APR-25__lb', 'annual'
  value       DECIMAL(18,4),
  edited_by   VARCHAR(255),
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_draft (client_id, entity, fiscal_year, asset_id, period),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 24. Scope 1 equipment timeseries ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS s1_equipment (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  asset_id  VARCHAR(100) NOT NULL,
  year      VARCHAR(10) NOT NULL,
  tco2e     DECIMAL(14,4),
  UNIQUE KEY uniq_s1eq (client_id, asset_id, year),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 24. I-REC register ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS irec_register (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  entity     VARCHAR(20) NOT NULL,
  year       VARCHAR(10) NOT NULL,
  facility   VARCHAR(255),
  mwh        DECIMAL(14,3) NOT NULL,
  coverage   VARCHAR(100),
  vintage    VARCHAR(50),
  instrument TEXT,
  status     VARCHAR(50) DEFAULT 'Active',
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 25. Grid MWh history ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grid_mwh_history (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  entity    VARCHAR(20) NOT NULL,
  year      VARCHAR(10) NOT NULL,
  grid_mwh  DECIMAL(14,3) NOT NULL,
  UNIQUE KEY uniq_grid (client_id, entity, year),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 26. Vault documents ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vault_documents (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  client_id   INT NOT NULL,
  entity      VARCHAR(20) NOT NULL,
  year        VARCHAR(10) NOT NULL,
  title       VARCHAR(500) NOT NULL,
  doc_type    VARCHAR(100),
  drive_link  VARCHAR(1000),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 27. Datasets ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS datasets (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  client_id       INT NOT NULL,
  dataset_id      VARCHAR(100) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  submission_type VARCHAR(100),
  template_url    VARCHAR(500),
  enabled         TINYINT(1) DEFAULT 1,
  sort_order      INT DEFAULT 0,
  UNIQUE KEY uniq_ds (client_id, dataset_id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 28. Priority items ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS priority_items (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  item_type ENUM('action','update') NOT NULL DEFAULT 'action',
  entity    VARCHAR(20) NOT NULL DEFAULT 'All',
  title     VARCHAR(500) NOT NULL,
  detail    TEXT,
  priority  ENUM('High','Medium','Low') DEFAULT NULL,
  link      VARCHAR(255),
  age       VARCHAR(50),
  tag       VARCHAR(50),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 29. Methodology ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS methodology (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL,
  section    VARCHAR(255) NOT NULL,
  content    TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 30. Peers ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS peers (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  name      VARCHAR(255) NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ── 31. Peer trends ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS peer_trends (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  client_id         INT NOT NULL,
  peer_id           INT NOT NULL,
  fy                VARCHAR(10) NOT NULL,
  scope1            DECIMAL(14,4),
  scope2_lb         DECIMAL(14,4),
  scope2_mb         DECIMAL(14,4),
  scope3_total      DECIMAL(14,4),
  intensity_revenue DECIMAL(14,6),
  UNIQUE KEY uniq_pt (peer_id, fy),
  FOREIGN KEY (peer_id) REFERENCES peers(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. Next step: run seed_featherlite.php to import Featherlite GHG data.
-- ─────────────────────────────────────────────────────────────────────────────
