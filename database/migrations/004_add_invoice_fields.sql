-- Migration 004: Add invoice / payment tracking fields to clients table
-- These fields support Deepwoods' manual invoice-and-verify workflow.
-- No payment gateway is involved — all fields are updated manually by Deepwoods admin.

ALTER TABLE clients
  ADD COLUMN invoice_ref     VARCHAR(100) DEFAULT NULL   COMMENT 'Invoice reference or number issued by Deepwoods',
  ADD COLUMN payment_status  ENUM('pending','paid','waived') NOT NULL DEFAULT 'pending' COMMENT 'Manual payment state',
  ADD COLUMN payment_date    DATE         DEFAULT NULL   COMMENT 'Date payment was received or waived',
  ADD COLUMN payment_notes   TEXT         DEFAULT NULL   COMMENT 'Free-text notes (bank ref, waiver reason, etc.)';
