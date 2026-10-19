# Moving to the v2 database (new DB, all data copied)

The old database is **never modified**. You build a new database, copy every row across, check the copy,
then point the backend at the new database. Rolling back = point the backend at the old one again.

The database your backend uses is the one named in `backend/config.php` (currently `u833634340_decarb_portal`).
That is the one to copy. (A different database, `u833634340_decarb`, is an older leftover with other clients and
no payments recorded; do not use it as the source.)

Files, in the order you use them:

| File | What it does |
|---|---|
| `schema_v2.sql` | Creates the new structure (46 tables). Run on a new, empty database only. |
| `../scripts/make-import-from-dump.mjs` | Turns an export of the old database into a data-only import file. |
| `quarantine_orphans.sql` | Moves leftover rows of deleted clients into `archive_*` tables (nothing is deleted). |
| `verify_copy.sql` | Proves old = new, row by row. |

Do **not** run `master_migration.sql` or migrations 001-010 on a v2 database: their changes are already in `schema_v2.sql`.

## Before you start
1. PHP version: checked, the site runs PHP 8.3 (hPanel > Advanced > PHP Configuration). Nothing to do. (The
   "PHP 7.2" printed in phpMyAdmin export headers is phpMyAdmin's own PHP, not the website's.)
2. Nothing else is needed for payments: the copy keeps every client's `payment_status` exactly as it is.

## Cutover
1. **hPanel > Databases:** create a new database + user (e.g. `..._decarb_v2`). Give the user access to **both**
   databases if you want to run the verification query.
2. **Old DB, phpMyAdmin > Export > Custom:** format SQL, tick **Complete inserts**, include data. Save the file.
   Export again at the moment of cutover so the copy contains the latest data.
3. **On your PC:** `node scripts/make-import-from-dump.mjs old-export.sql import_old_data.sql`
   It stops with a message if the export has no column lists.
4. **New DB, phpMyAdmin > Import**, in this order: `database/schema_v2.sql`, then `import_old_data.sql`,
   then `database/quarantine_orphans.sql`. The last one lists the `archive_*` tables it created.
5. **Verify:** open `database/verify_copy.sql`, Find & Replace `__OLD__` and `__NEW__` with the two database
   names, run it. Every row must show `identical = 1`. If any shows 0, stop and do not switch.
6. **Switch:** upload the new `backend/` and `dist-static/`, and change only the `db` block in
   `backend/config.php` to the new database name, user and password.
7. Log in as a Deepwoods admin and as one client user; open Portfolio and a client's Home.

## Rollback
Put the old `db` block back in `backend/config.php`. The old database was never touched. Changes made in the new
database after the switch (new submissions, users) do not exist in the old one.

## What the copy does and does not do
- Keeps every row, id, timestamp and next-id counter (ids of deleted rows are not reused), plus the
  `_migrations` history and every column of the old structure.
- Does not change any client's active or payment status, and does not change any entity's consolidated flag.
- **Orphan rows:** the live export contains rows that belong to clients that no longer exist (about 600 rows:
  old config, inventory, users, sessions). They would make the database impossible to restore from a backup
  (its own foreign keys reject them), so `quarantine_orphans.sql` moves them to `archive_<table>`. Delete an
  archive table whenever you are sure you do not need it: `DROP TABLE archive_users;`.
- Adds the empty tables the current code needs (calculation status, reporting cycles, activity log).
- Column types: `org_type` becomes text (was a fixed list), `asset_id` columns are wider (100).
