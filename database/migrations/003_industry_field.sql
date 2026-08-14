-- Migration 003: Add industry column to client_requests
-- Additive change — existing rows and message field are untouched.
-- industry stores the applicant's industry as structured data (replaces
-- the "Industry: <value>" string previously concatenated into message).

ALTER TABLE client_requests
  ADD COLUMN IF NOT EXISTS industry VARCHAR(200) NULL AFTER phone;
