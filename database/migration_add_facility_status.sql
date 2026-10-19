-- Migration: add status column to ghg_facilities
-- Run once on the Hostinger DB. Safe to re-run (IF NOT EXISTS guard via COLUMN_NAME check).

SET @dbname = DATABASE();
SET @tablename = 'ghg_facilities';
SET @columnname = 'status';
SET @preparedStatement = (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) = 0,
    CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT ''active'''),
    'SELECT 1'
  )
);
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
