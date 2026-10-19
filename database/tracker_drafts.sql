-- tracker_drafts: per-cell draft persistence for the Data Collection Tracker
-- Run this after schema_combined.sql in phpMyAdmin.
-- Replaces the previous localStorage-based draft save; each cell is stored as
-- a separate row so a single cell auto-save never risks losing other cells.

CREATE TABLE IF NOT EXISTS tracker_drafts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  client_id   INT NOT NULL,
  entity      VARCHAR(20)  NOT NULL,
  fiscal_year VARCHAR(10)  NOT NULL,
  asset_id    VARCHAR(100) NOT NULL,
  period      VARCHAR(20)  NOT NULL,   -- 'APR-25', 'MAY-25', …, 'ANNUAL'
  value       VARCHAR(100),            -- NULL means the cell was cleared
  edited_by   VARCHAR(255),            -- email of the user who last touched this cell
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_draft_cell (client_id, entity, fiscal_year, asset_id, period),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
