-- 010_admin_data_model.sql
-- Data the client Home page and the Deepwoods admin panel need to be accurate:
--   * who owns each client account (portfolio filtering at scale)
--   * calculation / verification status per entity + year
--   * reporting cycle (due dates, submitted / locked state) per entity + year
--   * action lifecycle fields
--   * user display name
-- Run once (phpMyAdmin). Safe on an existing database: only adds, never drops.

ALTER TABLE users   ADD COLUMN display_name  VARCHAR(120) NULL;
ALTER TABLE clients ADD COLUMN account_owner VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS calc_status (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  client_id     INT NOT NULL,
  entity        VARCHAR(20) NOT NULL,
  fiscal_year   VARCHAR(10) NOT NULL,
  status        ENUM('draft','calculated','verified','locked') NOT NULL DEFAULT 'draft',
  calculated_at DATETIME NULL,
  verified_at   DATETIME NULL,
  verified_by   VARCHAR(255) NULL,
  ef_version    VARCHAR(100) NULL,
  notes         TEXT NULL,
  updated_by    VARCHAR(255) NULL,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_calc (client_id, entity, fiscal_year),
  KEY idx_calc_client (client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reporting_cycles (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  client_id     INT NOT NULL,
  entity        VARCHAR(20) NOT NULL,
  fiscal_year   VARCHAR(10) NOT NULL,
  data_due_date DATE NULL,
  report_due_date DATE NULL,
  status        ENUM('open','submitted','locked') NOT NULL DEFAULT 'open',
  submitted_at  DATETIME NULL,
  submitted_by  VARCHAR(255) NULL,
  notes         TEXT NULL,
  updated_by    VARCHAR(255) NULL,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cycle (client_id, entity, fiscal_year),
  KEY idx_cycle_client (client_id),
  KEY idx_cycle_due (data_due_date),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE decarb_actions
  ADD COLUMN owner              VARCHAR(150) NULL,
  ADD COLUMN start_date         DATE NULL,
  ADD COLUMN end_date           DATE NULL,
  ADD COLUMN cost               DECIMAL(14,2) NULL,
  ADD COLUMN actual_abatement_t DECIMAL(14,2) NULL,
  ADD COLUMN updated_at         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Canonical lifecycle: Idea, Planned, Committed, In Progress, Completed, Delayed, Cancelled
UPDATE decarb_actions SET status = CASE
  WHEN LOWER(status) REGEXP 'complet|done|achiev'            THEN 'Completed'
  WHEN LOWER(status) REGEXP 'delay|overdue|blocked'          THEN 'Delayed'
  WHEN LOWER(status) REGEXP 'cancel|drop|reject'             THEN 'Cancelled'
  WHEN LOWER(status) REGEXP 'progress|ongoing|active|running|implement' THEN 'In Progress'
  WHEN LOWER(status) REGEXP 'commit|approved'                THEN 'Committed'
  WHEN LOWER(status) REGEXP 'idea|propos|consider|potential' THEN 'Idea'
  ELSE 'Planned' END;

-- General activity trail for Deepwoods staff actions and client milestones
CREATE TABLE IF NOT EXISTS admin_activity (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NULL,
  actor      VARCHAR(255) NOT NULL,
  action     VARCHAR(60)  NOT NULL,
  detail     TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_act_client (client_id, created_at),
  KEY idx_act_created (created_at)
) ENGINE=InnoDB;
