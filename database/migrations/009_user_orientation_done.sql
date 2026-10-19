-- 009_user_orientation_done.sql
-- Track the first-visit orientation tour per user (was browser localStorage only,
-- so it re-appeared on every new browser/device).
ALTER TABLE users ADD COLUMN orientation_done TINYINT(1) NOT NULL DEFAULT 0;
-- Users who have already set their own password have already been through first login.
UPDATE users SET orientation_done = 1 WHERE must_change_password = 0;
