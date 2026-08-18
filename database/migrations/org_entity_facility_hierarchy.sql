-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Org → Entity → Facility three-level hierarchy
--
-- What was called "entity" in client_entities is now called an "Organisation" (Org).
-- An Org (e.g. "Testing-DWG") can have multiple Entities (subsidiaries/divisions)
-- and each Entity can have multiple Facilities (physical locations).
--
-- Run this in phpMyAdmin → SQL tab (Database: u833634340_decarb_portal)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 0. Group / parent relationship on clients ─────────────────────────────────
--    When an entity from an org wants its OWN separate GHG report, Deepwoods
--    creates a second client account for it. parent_client_id links that child
--    account back to the parent org account so Deepwoods can see the group.
ALTER TABLE clients
  ADD COLUMN parent_client_id INT NULL,
  ADD COLUMN group_role ENUM('standalone','parent','child') DEFAULT 'standalone';

-- ── 1. Entities within each Org ───────────────────────────────────────────────
--    One org can have many entities (subsidiaries, divisions, branches, SPEs …)
--
--    billing_scope:
--      'consolidated' → this entity's emissions roll up into the parent account's
--                        GHG report. No separate account needed.
--      'separate'     → this entity needs its own GHG report and its own portal
--                        account. Deepwoods will create a child client account and
--                        set parent_client_id to link it back here.
CREATE TABLE IF NOT EXISTS org_entities (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  client_id     INT           NOT NULL,
  org_code      VARCHAR(20)   NOT NULL,  -- FK to client_entities.code (the "org")
  entity_code   VARCHAR(20)   NOT NULL,  -- unique within this client
  entity_name   VARCHAR(200)  NOT NULL,
  entity_type   VARCHAR(50)   DEFAULT 'subsidiary',  -- subsidiary | division | branch | spe | trust | other
  gstin         VARCHAR(20)   NULL,
  country       VARCHAR(100)  DEFAULT 'India',
  legal_address TEXT          NULL,
  billing_scope ENUM('consolidated','separate') DEFAULT 'consolidated',
  child_client_id INT         NULL,      -- set by Deepwoods once they create the child account
  is_active     TINYINT(1)   DEFAULT 1,
  sort_order    INT           DEFAULT 1,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_entity_code  (client_id, entity_code),
  KEY        idx_org         (client_id, org_code),
  KEY        idx_billing     (client_id, billing_scope),
  FOREIGN KEY (client_id)   REFERENCES clients(id) ON DELETE CASCADE
);

-- ── 2. Facilities within each Entity ─────────────────────────────────────────
--    Each entity can have many facilities (factories, offices, warehouses …)
CREATE TABLE IF NOT EXISTS org_facilities (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  client_id       INT           NOT NULL,
  org_code        VARCHAR(20)   NOT NULL,
  entity_code     VARCHAR(20)   NOT NULL,  -- FK to org_entities.entity_code
  facility_name   VARCHAR(200)  NOT NULL,
  facility_type   VARCHAR(50)   NULL,      -- manufacturing | office | warehouse | retail | data_centre | other
  address         TEXT          NULL,
  city            VARCHAR(100)  NULL,
  state           VARCHAR(100)  NULL,
  country         VARCHAR(100)  DEFAULT 'India',
  is_active       TINYINT(1)   DEFAULT 1,
  sort_order      INT          DEFAULT 1,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  KEY idx_entity  (client_id, entity_code),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- ── 3. Verify tables created ──────────────────────────────────────────────────
SELECT 'org_entities created' AS status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'org_entities');

SELECT 'org_facilities created' AS status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'org_facilities');
