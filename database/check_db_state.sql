-- ═══════════════════════════════════════════════════════════════════════
-- Decarb Portal — DB Diagnostic (phpMyAdmin-safe version)
-- Uses SHOW/DESCRIBE — no information_schema needed.
-- Run each block ONE AT A TIME in phpMyAdmin → SQL tab
-- ═══════════════════════════════════════════════════════════════════════

-- STEP 1: Confirm which database you are in
SELECT DATABASE() AS current_database;

-- STEP 2: See all tables
SHOW TABLES;

-- STEP 3: See all columns in clients table
DESCRIBE clients;

-- STEP 4: See all columns in client_entities table
DESCRIBE client_entities;

-- STEP 5: See if client_requests table exists and its columns
DESCRIBE client_requests;

-- STEP 6: See if reporting_engagements table exists
DESCRIBE reporting_engagements;
