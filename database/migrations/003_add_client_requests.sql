-- Migration 003: client_requests table for Request Access flow
CREATE TABLE IF NOT EXISTS client_requests (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  company      VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL,
  phone        VARCHAR(50)  DEFAULT NULL,
  employees    VARCHAR(50)  DEFAULT NULL,  -- "1-50", "51-200", "201-500", "500+"
  message      TEXT         DEFAULT NULL,
  status       ENUM('new','contacted','converted','rejected') NOT NULL DEFAULT 'new',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
