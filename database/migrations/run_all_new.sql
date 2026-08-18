-- run_all_new.sql
-- Safe to run at any time. Every statement uses IF NOT EXISTS / MODIFY so
-- already-applied changes are silently skipped.
-- Covers migrations 003 → 007.

-- ── client_requests: industry (003) ──────────────────────────────────────────
ALTER TABLE client_requests
  ADD COLUMN IF NOT EXISTS industry       VARCHAR(200) NULL AFTER phone;

-- ── client_requests: full intake fields (004) ────────────────────────────────
ALTER TABLE client_requests
  ADD COLUMN IF NOT EXISTS is_india       TINYINT(1)   NULL AFTER industry,
  ADD COLUMN IF NOT EXISTS gstin          VARCHAR(20)  NULL AFTER is_india,
  ADD COLUMN IF NOT EXISTS legal_name     VARCHAR(300) NULL AFTER gstin,
  ADD COLUMN IF NOT EXISTS operating_name VARCHAR(300) NULL AFTER legal_name,
  ADD COLUMN IF NOT EXISTS org_type       VARCHAR(100) NULL AFTER operating_name,
  ADD COLUMN IF NOT EXISTS is_msme        TINYINT(1)   NULL AFTER org_type,
  ADD COLUMN IF NOT EXISTS legal_address  TEXT         NULL AFTER is_msme,
  ADD COLUMN IF NOT EXISTS website        VARCHAR(300) NULL AFTER legal_address;

-- ── client_requests: udyam_number (005) ──────────────────────────────────────
ALTER TABLE client_requests
  ADD COLUMN IF NOT EXISTS udyam_number   VARCHAR(50)  NULL AFTER is_msme;

-- ── client_requests: logo_url (007) ──────────────────────────────────────────
ALTER TABLE client_requests
  ADD COLUMN IF NOT EXISTS logo_url       MEDIUMTEXT   NULL AFTER website;

-- ── clients: widen logo_url to TEXT (006) ────────────────────────────────────
ALTER TABLE clients MODIFY logo_url TEXT NULL;
