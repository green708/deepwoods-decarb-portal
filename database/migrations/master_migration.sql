-- !!! WARNING — NOT SAFE TO RE-RUN, and not for v2 databases (see ../MIGRATION_TO_V2.md) !!!
--   * Section 4 sets is_active = 1 for EVERY inactive client (undoes deliberate deactivations).
--   * Section 8 hardcodes slug 'featherlite' and clears is_consolidated on every other client's
--     roll-up entity, which breaks clients that have child entities rolling up into a parent.
-- ═══════════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════════
-- MASTER MIGRATION — Decarb Portal
-- Run this single file in phpMyAdmin: SQL tab → paste → Go
-- Database: u833634340_decarb_portal
-- Every statement uses IF NOT EXISTS / MODIFY — safe to re-run at any time.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. client_entities: legal detail columns (migration 002) ─────────────────
--    Needed for org_type to appear in the Register page card.
--    org_type stored as VARCHAR so the wizard values ("Private Limited", "LLP"
--    etc.) are saved exactly as entered — not constrained to an ENUM.
ALTER TABLE client_entities
  ADD COLUMN IF NOT EXISTS country         VARCHAR(100) NULL AFTER name,
  ADD COLUMN IF NOT EXISTS registration_no VARCHAR(100) NULL AFTER country,
  ADD COLUMN IF NOT EXISTS tax_id          VARCHAR(100) NULL AFTER registration_no,
  ADD COLUMN IF NOT EXISTS org_type        VARCHAR(100) NULL AFTER tax_id,
  ADD COLUMN IF NOT EXISTS legal_address   TEXT         NULL AFTER org_type;

-- ── 2. reporting_engagements table (migration 002, FK-safe version) ──────────
--    Original migration used INT UNSIGNED for client_id but clients.id is INT
--    (signed). Recreated here with a plain KEY instead of a FOREIGN KEY.
CREATE TABLE IF NOT EXISTS reporting_engagements (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  client_id             INT          NOT NULL,
  name                  VARCHAR(255) NOT NULL,
  report_type           ENUM('consolidated','standalone') NOT NULL DEFAULT 'consolidated',
  legal_entity_codes    JSON         NULL,
  reporting_entity_code VARCHAR(20)  NOT NULL,
  sort_order            TINYINT      NOT NULL DEFAULT 0,
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_re_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. client_requests: extended intake fields (migrations 003 – 007) ────────
ALTER TABLE client_requests
  ADD COLUMN IF NOT EXISTS industry       VARCHAR(200) NULL AFTER phone,
  ADD COLUMN IF NOT EXISTS is_india       TINYINT(1)   NULL AFTER industry,
  ADD COLUMN IF NOT EXISTS gstin          VARCHAR(20)  NULL AFTER is_india,
  ADD COLUMN IF NOT EXISTS legal_name     VARCHAR(300) NULL AFTER gstin,
  ADD COLUMN IF NOT EXISTS operating_name VARCHAR(300) NULL AFTER legal_name,
  ADD COLUMN IF NOT EXISTS org_type       VARCHAR(100) NULL AFTER operating_name,
  ADD COLUMN IF NOT EXISTS is_msme        TINYINT(1)   NULL AFTER org_type,
  ADD COLUMN IF NOT EXISTS udyam_number   VARCHAR(50)  NULL AFTER is_msme,
  ADD COLUMN IF NOT EXISTS legal_address  TEXT         NULL AFTER udyam_number,
  ADD COLUMN IF NOT EXISTS website        VARCHAR(300) NULL AFTER legal_address,
  ADD COLUMN IF NOT EXISTS logo_url       MEDIUMTEXT   NULL AFTER website;

-- ── 4. clients: activation gate columns (migration 002) ─────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_active    TINYINT(1) NOT NULL DEFAULT 0 AFTER currency,
  ADD COLUMN IF NOT EXISTS activated_at DATETIME   DEFAULT NULL       AFTER is_active;

-- Mark any existing clients as active so they are not accidentally blocked
UPDATE clients SET is_active = 1, activated_at = NOW() WHERE is_active = 0;

-- ── 4b. clients: invoice / payment tracking columns (migration 004) ───────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS invoice_ref    VARCHAR(100) DEFAULT NULL AFTER activated_at,
  ADD COLUMN IF NOT EXISTS payment_status ENUM('pending','paid','waived') NOT NULL DEFAULT 'pending' AFTER invoice_ref,
  ADD COLUMN IF NOT EXISTS payment_date   DATE DEFAULT NULL AFTER payment_status,
  ADD COLUMN IF NOT EXISTS payment_notes  TEXT DEFAULT NULL AFTER payment_date;

-- ── 4c. clients: widen logo_url to TEXT (migration 006) ──────────────────────
ALTER TABLE clients MODIFY logo_url TEXT NULL;

-- ── 5. clients: group / parent-child hierarchy columns ───────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS parent_client_id INT NULL,
  ADD COLUMN IF NOT EXISTS group_role ENUM('standalone','parent','child') DEFAULT 'standalone';

-- ── 6. org_entities — entities (subsidiaries/divisions) within each Org ──────
CREATE TABLE IF NOT EXISTS org_entities (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  client_id       INT           NOT NULL,
  org_code        VARCHAR(20)   NOT NULL,
  entity_code     VARCHAR(20)   NOT NULL,
  entity_name     VARCHAR(200)  NOT NULL,
  entity_type     VARCHAR(50)   DEFAULT 'subsidiary',
  gstin           VARCHAR(20)   NULL,
  country         VARCHAR(100)  DEFAULT 'India',
  legal_address   TEXT          NULL,
  billing_scope   ENUM('consolidated','separate') DEFAULT 'consolidated',
  child_client_id INT           NULL,
  is_active       TINYINT(1)    DEFAULT 1,
  sort_order      INT           DEFAULT 1,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_oe_code (client_id, entity_code),
  KEY idx_oe_org  (client_id, org_code),
  KEY idx_oe_cl   (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 7. org_facilities — physical locations within each Entity ────────────────
CREATE TABLE IF NOT EXISTS org_facilities (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  client_id     INT          NOT NULL,
  org_code      VARCHAR(20)  NOT NULL,
  entity_code   VARCHAR(20)  NOT NULL,
  facility_name VARCHAR(200) NOT NULL,
  facility_type VARCHAR(50)  NULL,
  address       TEXT         NULL,
  city          VARCHAR(100) NULL,
  state         VARCHAR(100) NULL,
  country       VARCHAR(100) DEFAULT 'India',
  is_active     TINYINT(1)   DEFAULT 1,
  sort_order    INT          DEFAULT 1,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  KEY idx_of_entity (client_id, entity_code),
  KEY idx_of_cl     (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 8. Fix is_consolidated flag for non-Featherlite clients ──────────────────
--    Any new test client that went through registration may have had their
--    entity saved as consolidated=1 by mistake. This resets it.
UPDATE client_entities ce
  JOIN clients c ON ce.client_id = c.id
SET ce.is_consolidated = 0
WHERE c.slug <> 'featherlite'
  AND ce.is_consolidated = 1;

-- ── 9. Verify ────────────────────────────────────────────────────────────────
SELECT 'master_migration complete' AS status;
