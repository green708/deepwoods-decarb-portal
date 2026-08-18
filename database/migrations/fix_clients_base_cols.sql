-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: clients base-schema columns
-- Run in phpMyAdmin if admin page shows 500 errors on clients.php
-- Safe to re-run — all statements use IF NOT EXISTS or MODIFY (non-destructive)
-- ═══════════════════════════════════════════════════════════════════════════

-- Add columns that are in schema_combined.sql but were never in master_migration
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS primary_color    VARCHAR(20)            DEFAULT '#1E6F5C' AFTER logo_url,
  ADD COLUMN IF NOT EXISTS currency         VARCHAR(10)            DEFAULT 'INR'     AFTER primary_color,
  ADD COLUMN IF NOT EXISTS reporting_period ENUM('FY','CY')        DEFAULT 'FY'      AFTER currency;

-- Ensure payment columns from master_migration step 4 and 4b are present
-- (re-run safe — IF NOT EXISTS skips existing columns)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_active     TINYINT(1)                      NOT NULL DEFAULT 0         AFTER currency,
  ADD COLUMN IF NOT EXISTS activated_at  DATETIME                         DEFAULT NULL              AFTER is_active,
  ADD COLUMN IF NOT EXISTS invoice_ref   VARCHAR(100)                     DEFAULT NULL              AFTER activated_at,
  ADD COLUMN IF NOT EXISTS payment_status ENUM('pending','paid','waived') NOT NULL DEFAULT 'pending' AFTER invoice_ref,
  ADD COLUMN IF NOT EXISTS payment_date  DATE                             DEFAULT NULL              AFTER payment_status,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT                             DEFAULT NULL              AFTER payment_date;

-- Mark any existing clients as active if not already
UPDATE clients SET is_active = 1, activated_at = NOW() WHERE is_active = 0;

SELECT 'fix_clients_base_cols complete' AS status;
