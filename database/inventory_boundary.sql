-- ─────────────────────────────────────────────────────────────────────────────
-- Inventory Boundary tables
-- Run this in phpMyAdmin after schema_combined.sql
-- Safe to re-run (IF NOT EXISTS / ON DUPLICATE KEY guards).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Scope 1 assets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_scope1_assets (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  client_id                INT NOT NULL,
  client_ref               VARCHAR(64) NOT NULL,        -- frontend-generated id
  fiscal_year              VARCHAR(10) NOT NULL,
  subcategory              ENUM('stationary','mobile','fugitive') NOT NULL,
  name                     VARCHAR(255) NOT NULL,
  facility_id              VARCHAR(64) NOT NULL,         -- entity code or custom ref
  status                   ENUM('active','monitor','flagForReplacement','efficient') NOT NULL DEFAULT 'active',
  -- stationary + mobile
  fuel_type                VARCHAR(100),
  is_biogenic              TINYINT(1) DEFAULT 0,
  -- stationary only
  equipment_type           VARCHAR(100),
  nameplate_capacity_value DECIMAL(12,2),
  nameplate_capacity_unit  ENUM('kVA','kW','MW','MMBtu/hr'),
  commissioning_date       DATE,
  -- mobile only
  vehicle_type             VARCHAR(100),
  vehicle_count            INT,
  ownership                ENUM('owned','longTermLease','shortTermLease'),
  -- fugitive only
  refrigerant_or_gas       VARCHAR(100),
  refrigerant_charge_kg    DECIMAL(10,3),
  annual_leakage_pct       DECIMAL(5,2),
  installation_date        DATE,
  created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_s1_ref (client_id, client_ref),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Scope 2 sources ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_scope2_sources (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  client_id            INT NOT NULL,
  client_ref           VARCHAR(64) NOT NULL,
  fiscal_year          VARCHAR(10) NOT NULL,
  category             ENUM('electricity','steam','heating','cooling') NOT NULL,
  name                 VARCHAR(255) NOT NULL,
  facility_id          VARCHAR(64) NOT NULL,
  status               ENUM('active','monitor','flagForReplacement','efficient') NOT NULL DEFAULT 'active',
  supplier             VARCHAR(255),
  -- electricity
  grid_connection_type ENUM('HT','LT','EHT','captive'),
  grid_region          VARCHAR(100),
  consumer_number      VARCHAR(100),
  renewable_procurement JSON,                            -- full RenewableProcurement object
  -- steam / heating / cooling
  contract_type        VARCHAR(100),
  source_description   TEXT,
  is_low_carbon        TINYINT(1) DEFAULT 0,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_s2_ref (client_id, client_ref),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Operational control (one row per client) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_op_control (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NOT NULL UNIQUE,
  kyoto      JSON NOT NULL,   -- { co2, ch4, n2o, hfcs, pfcs, sf6, nf3 }
  scope3     JSON NOT NULL,   -- array of Scope3CategoryItem
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;
