-- ═══════════════════════════════════════════════════════════════════════
-- Decarb Portal — Run once in Hostinger phpMyAdmin
-- Hostinger → Databases → phpMyAdmin → your DB → SQL tab → paste → Go
--
-- SAFE TO RE-RUN:
--   "Duplicate column name" errors = column already exists → OK, ignore
--   "Table already exists" errors  = table already exists  → OK, ignore
-- ═══════════════════════════════════════════════════════════════════════


-- ── SECTION 1: clients table — add missing columns ───────────────────────────
-- These columns were added to the schema but may be missing in the live DB.
-- Ignore any "Duplicate column name" error — it just means the column is there.

ALTER TABLE clients ADD COLUMN logo_url       VARCHAR(500)                            DEFAULT NULL;
ALTER TABLE clients ADD COLUMN is_active      TINYINT(1)                              NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN activated_at   DATETIME                                DEFAULT NULL;
ALTER TABLE clients ADD COLUMN invoice_ref    VARCHAR(100)                            DEFAULT NULL;
ALTER TABLE clients ADD COLUMN payment_status ENUM('pending','paid','waived')         NOT NULL DEFAULT 'pending';
ALTER TABLE clients ADD COLUMN payment_date   DATE                                    DEFAULT NULL;
ALTER TABLE clients ADD COLUMN payment_notes  TEXT                                    DEFAULT NULL;
ALTER TABLE clients ADD COLUMN primary_color  VARCHAR(20)                             DEFAULT '#1E6F5C';
ALTER TABLE clients ADD COLUMN currency       VARCHAR(10)                             DEFAULT 'INR';
ALTER TABLE clients ADD COLUMN reporting_period ENUM('FY','CY')                       DEFAULT 'FY';
ALTER TABLE clients ADD COLUMN parent_client_id INT                                   NULL;
ALTER TABLE clients ADD COLUMN group_role     ENUM('standalone','parent','child')     DEFAULT 'standalone';

-- Mark any existing client as active so they can log in
UPDATE clients SET is_active = 1, activated_at = NOW() WHERE is_active = 0;


-- ── SECTION 2: client_entities table — legal detail columns ─────────────────

ALTER TABLE client_entities ADD COLUMN country         VARCHAR(100) NULL;
ALTER TABLE client_entities ADD COLUMN registration_no VARCHAR(100) NULL;
ALTER TABLE client_entities ADD COLUMN tax_id          VARCHAR(100) NULL;
ALTER TABLE client_entities ADD COLUMN org_type        VARCHAR(100) NULL;
ALTER TABLE client_entities ADD COLUMN legal_address   TEXT         NULL;


-- ── SECTION 3: reporting_engagements table (create if missing) ───────────────

CREATE TABLE IF NOT EXISTS reporting_engagements (
    id                    INT          AUTO_INCREMENT PRIMARY KEY,
    client_id             INT          NOT NULL,
    name                  VARCHAR(255) NOT NULL,
    report_type           ENUM('consolidated','standalone') NOT NULL DEFAULT 'consolidated',
    legal_entity_codes    JSON         NULL,
    reporting_entity_code VARCHAR(20)  NOT NULL,
    sort_order            TINYINT      NOT NULL DEFAULT 0,
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_re_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── SECTION 4: client_requests table ────────────────────────────────────────
-- Create fresh if it doesn't exist (includes all columns).
-- If it already exists, the CREATE is skipped and the ALTER TABLE lines below
-- will add any columns that are missing — ignore "Duplicate column" errors.

CREATE TABLE IF NOT EXISTS client_requests (
    id             INT          AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    company        VARCHAR(255) NOT NULL,
    email          VARCHAR(255) NOT NULL,
    phone          VARCHAR(50)  DEFAULT NULL,
    employees      VARCHAR(50)  DEFAULT NULL,
    message        TEXT         DEFAULT NULL,
    status         ENUM('new','contacted','converted','rejected') NOT NULL DEFAULT 'new',
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Extended intake fields (added after initial launch)
ALTER TABLE client_requests ADD COLUMN industry        VARCHAR(200)  NULL;
ALTER TABLE client_requests ADD COLUMN is_india        TINYINT(1)    NULL;
ALTER TABLE client_requests ADD COLUMN gstin           VARCHAR(20)   NULL;
ALTER TABLE client_requests ADD COLUMN legal_name      VARCHAR(300)  NULL;
ALTER TABLE client_requests ADD COLUMN operating_name  VARCHAR(300)  NULL;
ALTER TABLE client_requests ADD COLUMN org_type        VARCHAR(100)  NULL;
ALTER TABLE client_requests ADD COLUMN is_msme         TINYINT(1)    NULL;
ALTER TABLE client_requests ADD COLUMN udyam_number    VARCHAR(50)   NULL;
ALTER TABLE client_requests ADD COLUMN legal_address   TEXT          NULL;
ALTER TABLE client_requests ADD COLUMN website         VARCHAR(300)  NULL;
ALTER TABLE client_requests ADD COLUMN logo_url        MEDIUMTEXT    NULL;

-- KYC + notes fields (migration 008 — Aug 2026)
ALTER TABLE client_requests ADD COLUMN designation      VARCHAR(200)  NULL;
ALTER TABLE client_requests ADD COLUMN ghg_done_before  TINYINT(1)    NULL;
ALTER TABLE client_requests ADD COLUMN ghg_requirement  TEXT          NULL;
ALTER TABLE client_requests ADD COLUMN services_needed  JSON          NULL;
ALTER TABLE client_requests ADD COLUMN services_other   TEXT          NULL;
ALTER TABLE client_requests ADD COLUMN internal_notes   JSON          NULL;


-- ── SECTION 5: org_entities table (create if missing) ───────────────────────

CREATE TABLE IF NOT EXISTS org_entities (
    id              INT          AUTO_INCREMENT PRIMARY KEY,
    client_id       INT          NOT NULL,
    org_code        VARCHAR(20)  NOT NULL,
    entity_code     VARCHAR(20)  NOT NULL,
    entity_name     VARCHAR(200) NOT NULL,
    entity_type     VARCHAR(50)  DEFAULT 'subsidiary',
    gstin           VARCHAR(20)  NULL,
    country         VARCHAR(100) DEFAULT 'India',
    legal_address   TEXT         NULL,
    billing_scope   ENUM('consolidated','separate') DEFAULT 'consolidated',
    child_client_id INT          NULL,
    is_active       TINYINT(1)   DEFAULT 1,
    sort_order      INT          DEFAULT 1,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_oe_code (client_id, entity_code),
    KEY idx_oe_org  (client_id, org_code),
    KEY idx_oe_cl   (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ── SECTION 6: org_facilities table (create if missing) ─────────────────────

CREATE TABLE IF NOT EXISTS org_facilities (
    id            INT          AUTO_INCREMENT PRIMARY KEY,
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


-- ── Done ─────────────────────────────────────────────────────────────────────
SELECT 'Schema update complete.' AS status;
