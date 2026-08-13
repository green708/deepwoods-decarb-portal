-- Migration 002: Reporting Engagements architecture
-- Run manually via phpMyAdmin on Hostinger
-- Safe: additive only — no existing data modified

-- 1. Add legal entity detail columns to client_entities (all nullable, existing rows unaffected)
ALTER TABLE client_entities
  ADD COLUMN IF NOT EXISTS country         VARCHAR(100) NULL AFTER name,
  ADD COLUMN IF NOT EXISTS registration_no VARCHAR(100) NULL AFTER country,
  ADD COLUMN IF NOT EXISTS tax_id          VARCHAR(100) NULL AFTER registration_no,
  ADD COLUMN IF NOT EXISTS org_type        ENUM('parent','subsidiary','branch','jv','other') NULL AFTER tax_id,
  ADD COLUMN IF NOT EXISTS legal_address   TEXT NULL AFTER org_type;

-- 2. Create reporting_engagements table
CREATE TABLE IF NOT EXISTS reporting_engagements (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id             INT UNSIGNED NOT NULL,
  name                  VARCHAR(255) NOT NULL,
  report_type           ENUM('consolidated','standalone') NOT NULL DEFAULT 'consolidated',
  legal_entity_codes    JSON        NULL COMMENT 'Array of client_entities.code values in scope',
  reporting_entity_code VARCHAR(20) NOT NULL COMMENT 'Soft FK -> client_entities.code (GHG data key)',
  sort_order            TINYINT     NOT NULL DEFAULT 0,
  created_at            TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_re_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
