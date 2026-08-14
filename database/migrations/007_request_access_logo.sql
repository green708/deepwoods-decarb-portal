-- Migration 007: Add logo_url to client_requests so logo is captured at the access-request stage.
-- MEDIUMTEXT handles base64 data URLs (can be several hundred KB).

ALTER TABLE client_requests
  ADD COLUMN IF NOT EXISTS logo_url MEDIUMTEXT NULL AFTER website;
