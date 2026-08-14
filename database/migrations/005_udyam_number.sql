-- Migration 005: Add udyam_number to client_requests
-- Stores the Udyam Registration Number for MSME-registered organisations.
-- Additive only — safe to run on existing data. New column is NULL.

ALTER TABLE client_requests
  ADD COLUMN IF NOT EXISTS udyam_number VARCHAR(50) NULL AFTER is_msme;
