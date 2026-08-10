-- 002_add_client_activation.sql
-- Run ONCE via phpMyAdmin before deploying the activation-gate code.
-- Adds manual activation gate to the clients table.
--
-- ORDER: run this migration BEFORE deploying backend/api changes.
-- Safe to run on a database that already has Featherlite data.

ALTER TABLE clients
  ADD COLUMN is_active    TINYINT(1)  NOT NULL DEFAULT 0   AFTER currency,
  ADD COLUMN activated_at DATETIME    DEFAULT NULL          AFTER is_active;

-- Mark ALL existing clients as active (backward-compatible — existing
-- clients are already live and should not be blocked).
UPDATE clients SET is_active = 1, activated_at = NOW();
