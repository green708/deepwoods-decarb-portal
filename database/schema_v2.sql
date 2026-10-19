-- ═══════════════════════════════════════════════════════════════════════════
-- Decarb Portal — database schema v2 (canonical)
-- 44 tables. Matches the current backend/api code exactly.
--
-- Use on a NEW, EMPTY database only (plain CREATE TABLE: re-running on a
-- populated database fails loudly instead of silently changing it).
-- Existing data is copied in afterwards with import_old_data.sql — see
-- database/MIGRATION_TO_V2.md. Do not run master_migration.sql on a v2 database.
-- ═══════════════════════════════════════════════════════════════════════════

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE TABLE `admin_activity` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) DEFAULT NULL,
  `actor` varchar(255) NOT NULL,
  `action` varchar(60) NOT NULL,
  `detail` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_act_client` (`client_id`,`created_at`),
  KEY `idx_act_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `audit_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `submission_id` int(11) NOT NULL,
  `action` enum('Approved','Rejected','Reassigned') NOT NULL,
  `actor` varchar(255) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `submission_id` (`submission_id`),
  CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `calc_status` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `fiscal_year` varchar(10) NOT NULL,
  `status` enum('draft','calculated','verified','locked') NOT NULL DEFAULT 'draft',
  `calculated_at` datetime DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `verified_by` varchar(255) DEFAULT NULL,
  `ef_version` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `updated_by` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_calc` (`client_id`,`entity`,`fiscal_year`),
  KEY `idx_calc_client` (`client_id`),
  CONSTRAINT `calc_status_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `client_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `config_key` varchar(100) NOT NULL,
  `config_value` text NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_config` (`client_id`,`config_key`),
  CONSTRAINT `client_config_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `client_entities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `code` varchar(20) NOT NULL,
  `entity_ref` varchar(50) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `country` varchar(100) DEFAULT NULL,
  `registration_no` varchar(100) DEFAULT NULL,
  `tax_id` varchar(100) DEFAULT NULL,
  `org_type` varchar(100) DEFAULT NULL,
  `legal_address` text DEFAULT NULL,
  `short_name` varchar(50) NOT NULL,
  `is_consolidated` tinyint(1) NOT NULL DEFAULT 0,
  `consolidates` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`consolidates`)),
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_entity` (`client_id`,`code`),
  UNIQUE KEY `entity_ref` (`entity_ref`),
  CONSTRAINT `client_entities_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `client_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `company` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `industry` varchar(200) DEFAULT NULL,
  `is_india` tinyint(1) DEFAULT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `legal_name` varchar(300) DEFAULT NULL,
  `operating_name` varchar(300) DEFAULT NULL,
  `org_type` varchar(100) DEFAULT NULL,
  `is_msme` tinyint(1) DEFAULT NULL,
  `udyam_number` varchar(50) DEFAULT NULL,
  `legal_address` text DEFAULT NULL,
  `website` varchar(300) DEFAULT NULL,
  `logo_url` mediumtext DEFAULT NULL,
  `employees` varchar(50) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `status` enum('new','contacted','converted','rejected') NOT NULL DEFAULT 'new',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `designation` varchar(200) DEFAULT NULL,
  `ghg_done_before` tinyint(1) DEFAULT NULL,
  `ghg_requirement` text DEFAULT NULL,
  `services_needed` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`services_needed`)),
  `services_other` text DEFAULT NULL,
  `internal_notes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`internal_notes`)),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `clients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `drive_root_folder_id` varchar(255) DEFAULT NULL,
  `drive_refresh_token` text DEFAULT NULL,
  `logo_url` text DEFAULT NULL,
  `primary_color` varchar(20) DEFAULT '#1E6F5C',
  `currency` varchar(10) DEFAULT 'INR',
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `activated_at` datetime DEFAULT NULL,
  `reporting_period` enum('FY','CY') DEFAULT 'FY',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `invoice_ref` varchar(100) DEFAULT NULL COMMENT 'Invoice reference or number issued by Deepwoods',
  `payment_status` enum('pending','paid','waived') NOT NULL DEFAULT 'pending' COMMENT 'Manual payment state',
  `payment_date` date DEFAULT NULL COMMENT 'Date payment was received or waived',
  `payment_notes` text DEFAULT NULL COMMENT 'Free-text notes (bank ref, waiver reason, etc.)',
  `parent_client_id` int(11) DEFAULT NULL,
  `group_role` enum('standalone','parent','child') DEFAULT 'standalone',
  `account_owner` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `computed_metrics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL DEFAULT 'FL',
  `year` varchar(10) NOT NULL,
  `metric_key` varchar(100) NOT NULL,
  `metric_value` decimal(14,3) NOT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_metric` (`client_id`,`entity`,`year`,`metric_key`),
  CONSTRAINT `computed_metrics_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `datasets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `dataset_id` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `submission_type` varchar(100) DEFAULT NULL,
  `template_url` varchar(500) DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT 1,
  `sort_order` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_ds` (`client_id`,`dataset_id`),
  CONSTRAINT `datasets_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `decarb_actions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `title` varchar(500) NOT NULL,
  `description` text DEFAULT NULL,
  `facilities` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`facilities`)),
  `lever` varchar(100) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Planned',
  `priority` enum('High','Medium','Low') DEFAULT 'Medium',
  `abatement_t` decimal(10,2) DEFAULT NULL,
  `timeline` varchar(100) DEFAULT NULL,
  `owner` varchar(150) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `cost` decimal(14,2) DEFAULT NULL,
  `actual_abatement_t` decimal(14,2) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `decarb_actions_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `decarb_assets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `asset_id` varchar(100) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `name` varchar(500) NOT NULL,
  `facility` varchar(255) DEFAULT NULL,
  `fuel_type` varchar(100) DEFAULT NULL,
  `scope` varchar(20) DEFAULT NULL,
  `sub_type` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Active',
  `health` varchar(50) DEFAULT 'Efficient',
  `unit` varchar(20) DEFAULT 'tCO2e',
  `active_from_fy` varchar(10) DEFAULT NULL,
  `active_through_fy` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_asset` (`client_id`,`asset_id`),
  CONSTRAINT `decarb_assets_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `ghg_facilities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `grid_utility` varchar(100) DEFAULT NULL,
  `re_instrument` varchar(255) DEFAULT NULL,
  `short_name` varchar(40) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'active',
  `is_hq` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `ghg_facilities_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `ghg_inventory` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `year` varchar(10) NOT NULL,
  `metric_key` varchar(100) NOT NULL,
  `metric_value` decimal(14,3) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_inv` (`client_id`,`entity`,`year`,`metric_key`),
  CONSTRAINT `ghg_inventory_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `grid_mwh_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `year` varchar(10) NOT NULL,
  `grid_mwh` decimal(14,3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_grid` (`client_id`,`entity`,`year`),
  CONSTRAINT `grid_mwh_history_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `intensity_metrics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `year` varchar(10) NOT NULL,
  `revenue_lakh` decimal(14,2) DEFAULT NULL,
  `production_units` decimal(14,2) DEFAULT NULL,
  `s12_lb` decimal(14,4) DEFAULT NULL,
  `s12_mb` decimal(14,4) DEFAULT NULL,
  `s3_total` decimal(14,4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_int` (`client_id`,`entity`,`year`),
  CONSTRAINT `intensity_metrics_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `inv_op_control` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `kyoto` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`kyoto`)),
  `scope3` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`scope3`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `client_id` (`client_id`),
  CONSTRAINT `inv_op_control_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `inv_scope1_assets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `client_ref` varchar(64) NOT NULL,
  `fiscal_year` varchar(10) NOT NULL,
  `subcategory` enum('stationary','mobile','fugitive') NOT NULL,
  `name` varchar(255) NOT NULL,
  `facility_id` varchar(64) NOT NULL,
  `status` enum('active','monitor','flagForReplacement','efficient') NOT NULL DEFAULT 'active',
  `fuel_type` varchar(100) DEFAULT NULL,
  `is_biogenic` tinyint(1) DEFAULT 0,
  `equipment_type` varchar(100) DEFAULT NULL,
  `nameplate_capacity_value` decimal(12,2) DEFAULT NULL,
  `nameplate_capacity_unit` enum('kVA','kW','MW','MMBtu/hr') DEFAULT NULL,
  `commissioning_date` date DEFAULT NULL,
  `vehicle_type` varchar(100) DEFAULT NULL,
  `vehicle_count` int(11) DEFAULT NULL,
  `ownership` enum('owned','longTermLease','shortTermLease') DEFAULT NULL,
  `refrigerant_or_gas` varchar(100) DEFAULT NULL,
  `refrigerant_charge_kg` decimal(10,3) DEFAULT NULL,
  `annual_leakage_pct` decimal(5,2) DEFAULT NULL,
  `installation_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_s1_ref` (`client_id`,`client_ref`),
  CONSTRAINT `inv_scope1_assets_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `inv_scope2_sources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `client_ref` varchar(64) NOT NULL,
  `fiscal_year` varchar(10) NOT NULL,
  `category` enum('electricity','steam','heating','cooling','solar-generated','solar-consumed','solar-exported','captive-wind') NOT NULL,
  `name` varchar(255) NOT NULL,
  `facility_id` varchar(64) NOT NULL,
  `status` enum('active','monitor','flagForReplacement','efficient') NOT NULL DEFAULT 'active',
  `supplier` varchar(255) DEFAULT NULL,
  `grid_connection_type` enum('HT','LT','EHT','captive') DEFAULT NULL,
  `grid_region` varchar(100) DEFAULT NULL,
  `consumer_number` varchar(100) DEFAULT NULL,
  `renewable_procurement` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`renewable_procurement`)),
  `contract_type` varchar(100) DEFAULT NULL,
  `source_description` text DEFAULT NULL,
  `is_low_carbon` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_s2_ref` (`client_id`,`client_ref`),
  CONSTRAINT `inv_scope2_sources_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `irec_register` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `year` varchar(10) NOT NULL,
  `facility` varchar(255) DEFAULT NULL,
  `mwh` decimal(14,3) NOT NULL,
  `coverage` varchar(100) DEFAULT NULL,
  `vintage` varchar(50) DEFAULT NULL,
  `instrument` text DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Active',
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `irec_register_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `methodology` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `section` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `methodology_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `ndc_thread_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `thread_id` int(11) NOT NULL,
  `from_role` enum('client','deepwoods') NOT NULL,
  `author` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `thread_id` (`thread_id`),
  CONSTRAINT `ndc_thread_messages_ibfk_1` FOREIGN KEY (`thread_id`) REFERENCES `ndc_threads` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `ndc_threads` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `source_type` enum('scope12','scope3') NOT NULL,
  `source_id` varchar(100) NOT NULL,
  `fy` varchar(10) NOT NULL,
  `last_from_role` enum('client','deepwoods') NOT NULL DEFAULT 'client',
  `created_by` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_src` (`client_id`,`source_type`,`source_id`,`fy`),
  CONSTRAINT `ndc_threads_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `notification_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_email` varchar(255) NOT NULL,
  `frequency` varchar(20) NOT NULL,
  `status` enum('sent','failed') NOT NULL,
  `details` text DEFAULT NULL,
  `sent_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `notification_prefs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_email` varchar(255) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 1,
  `frequency` enum('daily','weekly','monthly','custom') NOT NULL DEFAULT 'weekly',
  `custom_date` date DEFAULT NULL,
  `send_time` time NOT NULL DEFAULT '08:00:00',
  `include_actions` tinyint(1) NOT NULL DEFAULT 1,
  `include_updates` tinyint(1) NOT NULL DEFAULT 1,
  `last_sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_email` (`user_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `org_entities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `org_code` varchar(20) NOT NULL,
  `entity_code` varchar(20) NOT NULL,
  `entity_name` varchar(200) NOT NULL,
  `entity_type` varchar(50) DEFAULT 'subsidiary',
  `gstin` varchar(20) DEFAULT NULL,
  `country` varchar(100) DEFAULT 'India',
  `legal_address` text DEFAULT NULL,
  `billing_scope` enum('consolidated','separate') DEFAULT 'consolidated',
  `child_client_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `sort_order` int(11) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_entity_code` (`client_id`,`entity_code`),
  KEY `idx_org` (`client_id`,`org_code`),
  KEY `idx_billing` (`client_id`,`billing_scope`),
  CONSTRAINT `org_entities_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `org_facilities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `org_code` varchar(20) NOT NULL,
  `entity_code` varchar(20) NOT NULL,
  `facility_name` varchar(200) NOT NULL,
  `facility_type` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT 'India',
  `is_active` tinyint(1) DEFAULT 1,
  `sort_order` int(11) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_entity` (`client_id`,`entity_code`),
  CONSTRAINT `org_facilities_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `password_resets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `token` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `password_resets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `peer_trends` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `peer_id` int(11) NOT NULL,
  `fy` varchar(10) NOT NULL,
  `scope1` decimal(14,4) DEFAULT NULL,
  `scope2_lb` decimal(14,4) DEFAULT NULL,
  `scope2_mb` decimal(14,4) DEFAULT NULL,
  `scope3_total` decimal(14,4) DEFAULT NULL,
  `intensity_revenue` decimal(14,6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_pt` (`peer_id`,`fy`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `peer_trends_ibfk_1` FOREIGN KEY (`peer_id`) REFERENCES `peers` (`id`),
  CONSTRAINT `peer_trends_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `peers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `peers_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `priority_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `item_type` enum('action','update') NOT NULL DEFAULT 'action',
  `entity` varchar(20) NOT NULL DEFAULT 'All',
  `title` varchar(500) NOT NULL,
  `detail` text DEFAULT NULL,
  `priority` enum('High','Medium','Low') DEFAULT NULL,
  `link` varchar(255) DEFAULT NULL,
  `age` varchar(50) DEFAULT NULL,
  `tag` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `priority_items_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `reporting_cycles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `fiscal_year` varchar(10) NOT NULL,
  `data_due_date` date DEFAULT NULL,
  `report_due_date` date DEFAULT NULL,
  `status` enum('open','submitted','locked') NOT NULL DEFAULT 'open',
  `submitted_at` datetime DEFAULT NULL,
  `submitted_by` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `updated_by` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cycle` (`client_id`,`entity`,`fiscal_year`),
  KEY `idx_cycle_client` (`client_id`),
  KEY `idx_cycle_due` (`data_due_date`),
  CONSTRAINT `reporting_cycles_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `reporting_engagements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `report_type` enum('consolidated','standalone') NOT NULL DEFAULT 'consolidated',
  `legal_entity_codes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`legal_entity_codes`)),
  `reporting_entity_code` varchar(20) NOT NULL,
  `sort_order` tinyint(4) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_re_client` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `s1_breakdown` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `year` varchar(10) NOT NULL,
  `source_type` varchar(50) NOT NULL,
  `fuel_type` varchar(100) NOT NULL,
  `tco2e` decimal(14,4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_s1` (`client_id`,`entity`,`year`,`source_type`,`fuel_type`),
  CONSTRAINT `s1_breakdown_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `s1_by_facility` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `year` varchar(10) NOT NULL,
  `facility` varchar(255) NOT NULL,
  `sub_type` varchar(50) NOT NULL,
  `tco2e` decimal(14,4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_s1f` (`client_id`,`entity`,`year`,`facility`,`sub_type`),
  CONSTRAINT `s1_by_facility_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `s1_equipment` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `asset_id` varchar(100) NOT NULL,
  `year` varchar(10) NOT NULL,
  `tco2e` decimal(14,4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_s1eq` (`client_id`,`asset_id`,`year`),
  CONSTRAINT `s1_equipment_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `s2_breakdown` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `year` varchar(10) NOT NULL,
  `breakdown_type` varchar(20) NOT NULL DEFAULT 'standard',
  `grid_kwh` decimal(14,3) DEFAULT NULL,
  `re_kwh` decimal(14,3) DEFAULT NULL,
  `tco2e_lb` decimal(14,4) DEFAULT NULL,
  `tco2e_mb` decimal(14,4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_s2` (`client_id`,`entity`,`year`),
  CONSTRAINT `s2_breakdown_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `s2_by_facility` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `year` varchar(10) NOT NULL,
  `facility` varchar(255) NOT NULL,
  `tco2e_lb` decimal(14,4) DEFAULT NULL,
  `tco2e_mb` decimal(14,4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_s2f` (`client_id`,`entity`,`year`,`facility`),
  CONSTRAINT `s2_by_facility_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `scope3_summary` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `year` varchar(10) NOT NULL,
  `category` varchar(20) NOT NULL,
  `tco2e` decimal(14,4) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_s3` (`client_id`,`entity`,`year`,`category`),
  CONSTRAINT `scope3_summary_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `sessions` (
  `token` varchar(64) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`token`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `submission_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `submission_id` int(11) NOT NULL,
  `original_name` varchar(500) NOT NULL,
  `drive_file_id` varchar(255) NOT NULL,
  `drive_file_link` varchar(1000) NOT NULL,
  `kind` enum('data','document') NOT NULL DEFAULT 'data',
  `uploaded_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `submission_id` (`submission_id`),
  CONSTRAINT `submission_files_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `submissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `version` enum('V1','V2','V3') NOT NULL,
  `dataset_id` varchar(100) NOT NULL,
  `dataset_name` varchar(255) NOT NULL,
  `tag` varchar(100) NOT NULL,
  `year` varchar(10) NOT NULL,
  `unit` varchar(100) DEFAULT 'Organisation-wide',
  `notes` text DEFAULT NULL,
  `status` enum('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  `submitted_by` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `reviewed_by` varchar(255) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `submissions_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `tracker_drafts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `fiscal_year` varchar(10) NOT NULL,
  `asset_id` varchar(100) NOT NULL,
  `period` varchar(20) NOT NULL,
  `value` varchar(100) DEFAULT NULL,
  `edited_by` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_draft_cell` (`client_id`,`entity`,`fiscal_year`,`asset_id`,`period`),
  CONSTRAINT `tracker_drafts_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('sustainability_team','client_uploader','client_leadership','deepwoods_admin','deepwoods_coordinator') NOT NULL DEFAULT 'sustainability_team',
  `client_id` int(11) DEFAULT NULL,
  `entity_scope` varchar(20) DEFAULT NULL,
  `must_change_password` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `facility_scope` varchar(50) DEFAULT NULL COMMENT 'NULL = all facilities, else entity code',
  `orientation_done` tinyint(1) NOT NULL DEFAULT 0,
  `display_name` varchar(120) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `vault_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) NOT NULL,
  `entity` varchar(20) NOT NULL,
  `year` varchar(10) NOT NULL,
  `title` varchar(500) NOT NULL,
  `doc_type` varchar(100) DEFAULT NULL,
  `drive_link` varchar(1000) DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  CONSTRAINT `vault_documents_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Migration history carried over from the previous database.
CREATE TABLE `_migrations` (
  `id` varchar(80) NOT NULL,
  `ran_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Records which schema this database is on.
CREATE TABLE `schema_version` (
  `version`    varchar(20)  NOT NULL,
  `applied_at` timestamp    NULL DEFAULT current_timestamp(),
  `note`       varchar(255) DEFAULT NULL,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO `schema_version` (`version`, `note`) VALUES ('2.0', 'Canonical schema matching backend as of 2026-10');
