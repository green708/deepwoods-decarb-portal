# database/ — SQL Schemas and Migrations

Authoritative SQL schema for the Decarb Platform MySQL database.

## What belongs here

- `schema_combined.sql` — The complete, authoritative database schema (31 tables).
  This is the only schema file for production. It uses `IF NOT EXISTS` and
  `ON DUPLICATE KEY` guards so it is safe to re-run against an existing database.
- `migrations/` — Incremental migration scripts for schema changes. Named with a
  sequence prefix: `001_add_notification_prefs.sql`, `002_client_config.sql`, etc.

## What does NOT belong here

- Application logic (PHP belongs in `backend/`)
- Client seed data (use `backend/seed-users.php` and the admin UI)
- Experimental or legacy schemas — use `_archive/`

## Authoritative schema: schema_combined.sql

Key tables:
| Table | Purpose |
|---|---|
| `clients` | One row per client organisation |
| `client_entities` | Legal entities within a client |
| `client_config` | Feature flags and settings per client |
| `users` | Platform users |
| `sessions` | Auth sessions (7-day expiry) |
| `submissions` | Data submission records |
| `ghg_inventory` | GHG emissions by scope/category/year/entity |
| `s1_breakdown` | Scope 1 source-level data |
| `s2_breakdown` | Scope 2 source-level data |
| `s3_breakdown` | Scope 3 category-level data |
| `decarb_actions` | Decarbonization action items |
| `decarb_assets` | Assets in decarbonization scope |

## Conventions

- All data tables include `client_id INT NOT NULL` to enforce tenant isolation
- Timestamps are `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- Soft deletes use `is_active` or `status` columns — do not hard-delete records
- New columns: add an `ALTER TABLE` migration in `migrations/`, then update `schema_combined.sql`

## Running the schema

Run `schema_combined.sql` once per new environment in phpMyAdmin or via CLI:
```bash
mysql -u USER -p DATABASE_NAME < database/schema_combined.sql
```
