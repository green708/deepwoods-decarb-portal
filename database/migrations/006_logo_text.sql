-- Migration 006: Widen logo_url to TEXT so base64 data URLs can be stored.
-- Safe on existing data — VARCHAR(500) values are preserved.

ALTER TABLE clients MODIFY logo_url TEXT NULL;
