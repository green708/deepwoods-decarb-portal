-- Moves rows that point at something that no longer exists (for example data left behind by a
-- deleted client) into archive_<table> tables, so that nothing is lost but the live tables are clean
-- and their foreign keys hold. Run once, after the data import, on the v2 database.
-- Tables without such rows get no archive table. Safe to re-run: with no orphans it does nothing.
-- To drop the leftovers for good later:  DROP TABLE archive_<table>;

SET FOREIGN_KEY_CHECKS = 0;

-- submissions
SET @n = (SELECT COUNT(*) FROM `submissions` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_submissions` LIKE `submissions`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_submissions` SELECT * FROM `submissions` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `submissions` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- audit_log
SET @n = (SELECT COUNT(*) FROM `audit_log` WHERE (`submission_id` IS NOT NULL AND `submission_id` NOT IN (SELECT `id` FROM `submissions`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_audit_log` LIKE `audit_log`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_audit_log` SELECT * FROM `audit_log` WHERE (`submission_id` IS NOT NULL AND `submission_id` NOT IN (SELECT `id` FROM `submissions`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `audit_log` WHERE (`submission_id` IS NOT NULL AND `submission_id` NOT IN (SELECT `id` FROM `submissions`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- calc_status
SET @n = (SELECT COUNT(*) FROM `calc_status` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_calc_status` LIKE `calc_status`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_calc_status` SELECT * FROM `calc_status` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `calc_status` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- client_config
SET @n = (SELECT COUNT(*) FROM `client_config` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_client_config` LIKE `client_config`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_client_config` SELECT * FROM `client_config` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `client_config` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- client_entities
SET @n = (SELECT COUNT(*) FROM `client_entities` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_client_entities` LIKE `client_entities`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_client_entities` SELECT * FROM `client_entities` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `client_entities` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- computed_metrics
SET @n = (SELECT COUNT(*) FROM `computed_metrics` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_computed_metrics` LIKE `computed_metrics`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_computed_metrics` SELECT * FROM `computed_metrics` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `computed_metrics` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- datasets
SET @n = (SELECT COUNT(*) FROM `datasets` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_datasets` LIKE `datasets`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_datasets` SELECT * FROM `datasets` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `datasets` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- decarb_actions
SET @n = (SELECT COUNT(*) FROM `decarb_actions` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_decarb_actions` LIKE `decarb_actions`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_decarb_actions` SELECT * FROM `decarb_actions` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `decarb_actions` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- decarb_assets
SET @n = (SELECT COUNT(*) FROM `decarb_assets` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_decarb_assets` LIKE `decarb_assets`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_decarb_assets` SELECT * FROM `decarb_assets` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `decarb_assets` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ghg_facilities
SET @n = (SELECT COUNT(*) FROM `ghg_facilities` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_ghg_facilities` LIKE `ghg_facilities`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_ghg_facilities` SELECT * FROM `ghg_facilities` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `ghg_facilities` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ghg_inventory
SET @n = (SELECT COUNT(*) FROM `ghg_inventory` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_ghg_inventory` LIKE `ghg_inventory`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_ghg_inventory` SELECT * FROM `ghg_inventory` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `ghg_inventory` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- grid_mwh_history
SET @n = (SELECT COUNT(*) FROM `grid_mwh_history` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_grid_mwh_history` LIKE `grid_mwh_history`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_grid_mwh_history` SELECT * FROM `grid_mwh_history` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `grid_mwh_history` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- intensity_metrics
SET @n = (SELECT COUNT(*) FROM `intensity_metrics` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_intensity_metrics` LIKE `intensity_metrics`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_intensity_metrics` SELECT * FROM `intensity_metrics` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `intensity_metrics` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- inv_op_control
SET @n = (SELECT COUNT(*) FROM `inv_op_control` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_inv_op_control` LIKE `inv_op_control`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_inv_op_control` SELECT * FROM `inv_op_control` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `inv_op_control` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- inv_scope1_assets
SET @n = (SELECT COUNT(*) FROM `inv_scope1_assets` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_inv_scope1_assets` LIKE `inv_scope1_assets`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_inv_scope1_assets` SELECT * FROM `inv_scope1_assets` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `inv_scope1_assets` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- inv_scope2_sources
SET @n = (SELECT COUNT(*) FROM `inv_scope2_sources` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_inv_scope2_sources` LIKE `inv_scope2_sources`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_inv_scope2_sources` SELECT * FROM `inv_scope2_sources` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `inv_scope2_sources` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- irec_register
SET @n = (SELECT COUNT(*) FROM `irec_register` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_irec_register` LIKE `irec_register`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_irec_register` SELECT * FROM `irec_register` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `irec_register` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- methodology
SET @n = (SELECT COUNT(*) FROM `methodology` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_methodology` LIKE `methodology`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_methodology` SELECT * FROM `methodology` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `methodology` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ndc_threads
SET @n = (SELECT COUNT(*) FROM `ndc_threads` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_ndc_threads` LIKE `ndc_threads`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_ndc_threads` SELECT * FROM `ndc_threads` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `ndc_threads` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ndc_thread_messages
SET @n = (SELECT COUNT(*) FROM `ndc_thread_messages` WHERE (`thread_id` IS NOT NULL AND `thread_id` NOT IN (SELECT `id` FROM `ndc_threads`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_ndc_thread_messages` LIKE `ndc_thread_messages`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_ndc_thread_messages` SELECT * FROM `ndc_thread_messages` WHERE (`thread_id` IS NOT NULL AND `thread_id` NOT IN (SELECT `id` FROM `ndc_threads`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `ndc_thread_messages` WHERE (`thread_id` IS NOT NULL AND `thread_id` NOT IN (SELECT `id` FROM `ndc_threads`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- org_entities
SET @n = (SELECT COUNT(*) FROM `org_entities` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_org_entities` LIKE `org_entities`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_org_entities` SELECT * FROM `org_entities` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `org_entities` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- org_facilities
SET @n = (SELECT COUNT(*) FROM `org_facilities` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_org_facilities` LIKE `org_facilities`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_org_facilities` SELECT * FROM `org_facilities` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `org_facilities` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- users
SET @n = (SELECT COUNT(*) FROM `users` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_users` LIKE `users`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_users` SELECT * FROM `users` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `users` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- password_resets
SET @n = (SELECT COUNT(*) FROM `password_resets` WHERE (`user_id` IS NOT NULL AND `user_id` NOT IN (SELECT `id` FROM `users`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_password_resets` LIKE `password_resets`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_password_resets` SELECT * FROM `password_resets` WHERE (`user_id` IS NOT NULL AND `user_id` NOT IN (SELECT `id` FROM `users`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `password_resets` WHERE (`user_id` IS NOT NULL AND `user_id` NOT IN (SELECT `id` FROM `users`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- peers
SET @n = (SELECT COUNT(*) FROM `peers` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_peers` LIKE `peers`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_peers` SELECT * FROM `peers` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `peers` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- peer_trends
SET @n = (SELECT COUNT(*) FROM `peer_trends` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)) OR (`peer_id` IS NOT NULL AND `peer_id` NOT IN (SELECT `id` FROM `peers`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_peer_trends` LIKE `peer_trends`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_peer_trends` SELECT * FROM `peer_trends` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)) OR (`peer_id` IS NOT NULL AND `peer_id` NOT IN (SELECT `id` FROM `peers`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `peer_trends` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)) OR (`peer_id` IS NOT NULL AND `peer_id` NOT IN (SELECT `id` FROM `peers`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- priority_items
SET @n = (SELECT COUNT(*) FROM `priority_items` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_priority_items` LIKE `priority_items`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_priority_items` SELECT * FROM `priority_items` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `priority_items` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- reporting_cycles
SET @n = (SELECT COUNT(*) FROM `reporting_cycles` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_reporting_cycles` LIKE `reporting_cycles`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_reporting_cycles` SELECT * FROM `reporting_cycles` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `reporting_cycles` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- s1_breakdown
SET @n = (SELECT COUNT(*) FROM `s1_breakdown` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_s1_breakdown` LIKE `s1_breakdown`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_s1_breakdown` SELECT * FROM `s1_breakdown` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `s1_breakdown` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- s1_by_facility
SET @n = (SELECT COUNT(*) FROM `s1_by_facility` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_s1_by_facility` LIKE `s1_by_facility`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_s1_by_facility` SELECT * FROM `s1_by_facility` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `s1_by_facility` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- s1_equipment
SET @n = (SELECT COUNT(*) FROM `s1_equipment` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_s1_equipment` LIKE `s1_equipment`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_s1_equipment` SELECT * FROM `s1_equipment` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `s1_equipment` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- s2_breakdown
SET @n = (SELECT COUNT(*) FROM `s2_breakdown` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_s2_breakdown` LIKE `s2_breakdown`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_s2_breakdown` SELECT * FROM `s2_breakdown` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `s2_breakdown` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- s2_by_facility
SET @n = (SELECT COUNT(*) FROM `s2_by_facility` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_s2_by_facility` LIKE `s2_by_facility`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_s2_by_facility` SELECT * FROM `s2_by_facility` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `s2_by_facility` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- scope3_summary
SET @n = (SELECT COUNT(*) FROM `scope3_summary` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_scope3_summary` LIKE `scope3_summary`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_scope3_summary` SELECT * FROM `scope3_summary` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `scope3_summary` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- sessions
SET @n = (SELECT COUNT(*) FROM `sessions` WHERE (`user_id` IS NOT NULL AND `user_id` NOT IN (SELECT `id` FROM `users`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_sessions` LIKE `sessions`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_sessions` SELECT * FROM `sessions` WHERE (`user_id` IS NOT NULL AND `user_id` NOT IN (SELECT `id` FROM `users`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `sessions` WHERE (`user_id` IS NOT NULL AND `user_id` NOT IN (SELECT `id` FROM `users`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- submission_files
SET @n = (SELECT COUNT(*) FROM `submission_files` WHERE (`submission_id` IS NOT NULL AND `submission_id` NOT IN (SELECT `id` FROM `submissions`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_submission_files` LIKE `submission_files`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_submission_files` SELECT * FROM `submission_files` WHERE (`submission_id` IS NOT NULL AND `submission_id` NOT IN (SELECT `id` FROM `submissions`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `submission_files` WHERE (`submission_id` IS NOT NULL AND `submission_id` NOT IN (SELECT `id` FROM `submissions`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- tracker_drafts
SET @n = (SELECT COUNT(*) FROM `tracker_drafts` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_tracker_drafts` LIKE `tracker_drafts`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_tracker_drafts` SELECT * FROM `tracker_drafts` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `tracker_drafts` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- vault_documents
SET @n = (SELECT COUNT(*) FROM `vault_documents` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`)));
SET @s = IF(@n > 0, 'CREATE TABLE IF NOT EXISTS `archive_vault_documents` LIKE `vault_documents`', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'INSERT INTO `archive_vault_documents` SELECT * FROM `vault_documents` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF(@n > 0, 'DELETE FROM `vault_documents` WHERE (`client_id` IS NOT NULL AND `client_id` NOT IN (SELECT `id` FROM `clients`))', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET FOREIGN_KEY_CHECKS = 1;

-- Summary of what was archived:
SELECT table_name AS archive_table, table_rows AS approx_rows FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'archive\_%' ORDER BY table_name;
