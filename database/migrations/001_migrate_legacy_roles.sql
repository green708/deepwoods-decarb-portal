-- Epic 1: Auth & Role Foundation
-- Removes legacy client-specific roles from the users ENUM.
--
-- CRITICAL: Run the UPDATE statements BEFORE the ALTER TABLE.
-- If ALTER runs first, MySQL will reject existing rows with legacy role values.
--
-- Apply via phpMyAdmin: paste this entire file and execute.

-- Step 1: Migrate existing users off legacy roles
UPDATE users SET role = 'sustainability_team' WHERE role IN ('featherlite_team', 'automation_demo');
UPDATE users SET role = 'client_leadership'   WHERE role = 'featherlite_leadership';

-- Step 2: Remove legacy role values from the ENUM
ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'sustainability_team',
    'client_uploader',
    'client_leadership',
    'deepwoods_admin',
    'deepwoods_coordinator'
  ) NOT NULL DEFAULT 'sustainability_team';
