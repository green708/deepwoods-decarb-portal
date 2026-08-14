-- Migration 004: Extend client_requests with full intake fields
-- Additive only — safe to run on existing data. All new columns are NULL.

ALTER TABLE client_requests
  ADD COLUMN IF NOT EXISTS is_india        TINYINT(1)   NULL AFTER industry,
  ADD COLUMN IF NOT EXISTS gstin           VARCHAR(20)  NULL AFTER is_india,
  ADD COLUMN IF NOT EXISTS legal_name      VARCHAR(300) NULL AFTER gstin,
  ADD COLUMN IF NOT EXISTS operating_name VARCHAR(300) NULL AFTER legal_name,
  ADD COLUMN IF NOT EXISTS org_type        VARCHAR(100) NULL AFTER operating_name,
  ADD COLUMN IF NOT EXISTS is_msme         TINYINT(1)   NULL AFTER org_type,
  ADD COLUMN IF NOT EXISTS legal_address   TEXT         NULL AFTER is_msme,
  ADD COLUMN IF NOT EXISTS website         VARCHAR(300) NULL AFTER legal_address;
