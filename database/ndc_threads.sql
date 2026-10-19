-- NDC Q&A threads for the Data Collection workflow.
-- Multiple threads can exist per source (one per conversation/question).
-- Run in phpMyAdmin after schema_combined.sql and inventory_boundary.sql.

CREATE TABLE IF NOT EXISTS ndc_threads (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  client_id       INT NOT NULL,
  source_type     ENUM('scope12','scope3') NOT NULL,
  source_id       VARCHAR(100) NOT NULL,   -- decarb_assets.asset_id or 'cat{N}'
  fy              VARCHAR(10)  NOT NULL,
  last_from_role  ENUM('client','deepwoods') NOT NULL DEFAULT 'client',
  created_by      VARCHAR(255),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_src (client_id, source_type, source_id, fy),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ndc_thread_messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  thread_id  INT NOT NULL,
  from_role  ENUM('client','deepwoods') NOT NULL,
  author     VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES ndc_threads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
