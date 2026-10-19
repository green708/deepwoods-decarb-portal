-- migration_002_entity_legal_columns.sql
-- Adds legal-entity detail columns to client_entities.
-- Referenced in client-setup.php (section 4) and client-settings.php.
-- Safe to re-run (uses IF NOT EXISTS guards via ALTER IGNORE / column existence check).
-- Run this in phpMyAdmin or via MySQL CLI on the live DB.

ALTER TABLE client_entities
  ADD COLUMN IF NOT EXISTS country         VARCHAR(100)  DEFAULT NULL AFTER sort_order,
  ADD COLUMN IF NOT EXISTS registration_no VARCHAR(100)  DEFAULT NULL AFTER country,
  ADD COLUMN IF NOT EXISTS tax_id          VARCHAR(50)   DEFAULT NULL AFTER registration_no,
  ADD COLUMN IF NOT EXISTS org_type        VARCHAR(100)  DEFAULT NULL AFTER tax_id,
  ADD COLUMN IF NOT EXISTS legal_address   TEXT          DEFAULT NULL AFTER org_type;
