# Customer Configuration

How to onboard a new client organisation onto the Decarb portal.

---

## Overview

Every piece of data in the portal is scoped to a `client_id`. A new client requires:
1. A `clients` row (slug, name, branding)
2. One or more `client_entities` rows (entities and consolidation structure)
3. `client_config` rows (base years, targets, enabled pages, S3 boundary)
4. At least one `users` row (admin user)
5. GHG data loaded into the inventory tables (or via the submission flow)

---

## Step 1: Create Client Record

Insert into the `clients` table:

```sql
INSERT INTO clients (name, slug, drive_root_folder_id, logo_url, primary_color, currency, reporting_period)
VALUES (
  'ACME Corp',        -- Display name
  'acme',             -- URL-safe slug (used for session scoping)
  '',                 -- Google Drive root folder ID (get from Drive)
  '/acme-logo.png',   -- Logo URL (upload to public/ first)
  '#2563EB',          -- Primary brand color (hex)
  'USD',              -- Currency (INR/USD/EUR/GBP)
  'CY'                -- CY = Calendar Year, FY = Fiscal Year
);
```

The `slug` must be unique and URL-safe. It is used to scope session tokens and API responses.

---

## Step 2: Define Entities

Insert into `client_entities`. Typical patterns:

### Pattern A: Single Entity
```sql
-- One company, no sub-entities
INSERT INTO client_entities (client_id, code, name, short_name, is_consolidated, consolidates, sort_order)
VALUES ((SELECT id FROM clients WHERE slug='acme'), 'ACME', 'ACME Corp', 'ACME', 0, NULL, 0);
```

### Pattern B: Two Entities + Consolidated View (Featherlite pattern)
```sql
-- Parent company (consolidated)
INSERT INTO client_entities VALUES (NULL, @cid, 'ACM', 'ACME Group (Consolidated)', 'ACM', 1, '["ACM-A","ACM-B"]', 0);
-- Sub-entity A
INSERT INTO client_entities VALUES (NULL, @cid, 'ACM-A', 'ACME Manufacturing Ltd', 'Mfg', 0, NULL, 1);
-- Sub-entity B
INSERT INTO client_entities VALUES (NULL, @cid, 'ACM-B', 'ACME Services Ltd', 'Svcs', 0, NULL, 2);
```

The `consolidates` field is a JSON array of child entity codes. The `context.php` API computes consolidated views by summing child entities from the DB.

### Pattern C: Organisation → Companies → Facilities (future)
Not yet implemented. Requires a `client_hierarchy` table. See `docs/MULTI_TENANT_READINESS.md`.

---

## Step 3: Configure Client

Insert into `client_config`. All keys are optional — defaults apply where not set.

```sql
SET @cid = (SELECT id FROM clients WHERE slug = 'acme');

-- Required config
INSERT INTO client_config (client_id, config_key, config_value) VALUES
(@cid, 'base_year_s12',    'CY22'),
(@cid, 'base_year_s3',     'CY23'),
(@cid, 'netzero_year',     '2045'),
(@cid, 'sbti_target_s12',  '50'),
(@cid, 'sbti_target_year', '2030'),

-- I-REC config
(@cid, 'irec_factor',   '0.597'),
(@cid, 'irec_max_mwh',  '500'),

-- Data collection window
(@cid, 'current_year_open', 'true'),

-- Scope 3 boundary (relevant categories for this client)
(@cid, 's3_boundary', '["Cat 1","Cat 2","Cat 3","Cat 4","Cat 6","Cat 7"]'),

-- Enabled pages (controls sidebar nav)
(@cid, 'enabled_pages', '["workstreams","overview","dashboard","inventory","hotspots","action-plan","progress","peer","green-finance","credits","reports","submissions","vault","methodology","priority-actions"]');
```

### Enabled Pages Reference

| Page ID | Route | Description |
|---|---|---|
| `workstreams` | `/workstreams` | Home / service cluster view |
| `overview` | `/overview` | KPI overview |
| `dashboard` | `/dashboard` | Scope 1/2/3 dashboard |
| `inventory` | `/inventory` | Asset register |
| `hotspots` | `/hotspots` | Emission hotspot analysis |
| `action-plan` | `/action-plan` | Decarbonisation actions |
| `progress` | `/progress` | Progress tracking |
| `peer` | `/peer` | Peer benchmarking |
| `green-finance` | `/green-finance` | Carbon P&L |
| `credits` | `/credits` | I-RECs and renewables |
| `reports` | `/reports` | Report library |
| `submissions` | `/submissions` | Data submission |
| `vault` | `/vault` | Document vault |
| `methodology` | `/methodology` | GHG methodology |
| `priority-actions` | `/priority-actions` | Priority items |

---

## Step 4: Create Users

```sql
-- Sustainability team user (use a real bcrypt hash — never plain text)
INSERT INTO users (email, password_hash, role, client_id, entity_scope, must_change_password)
VALUES (
  'user@acme.com',
  '$2y$10$...',          -- bcrypt hash of temporary password
  'sustainability_team', -- role
  @cid,                  -- client_id
  NULL,                  -- NULL = all entities; 'ACM-A' = restricted to one entity
  1                      -- force password change on first login
);
```

**Generate bcrypt hash:**
```php
echo password_hash('TemporaryPassword123!', PASSWORD_DEFAULT);
```

Or use the `seed-users.php` script (edit and run once):
```bash
php backend/seed-users.php
```

---

## Step 5: Load GHG Data

**Option A: Via the submission flow (recommended for production)**
1. Create the dataset definitions in `datasets` table (or use `GET /datasets.php`)
2. Client uploads XLSX via `/submissions` page
3. Deepwoods reviews and approves
4. Data is imported into `ghg_inventory` and related tables

**Option B: Direct SQL seed (for initial setup / demos)**
See `backend/seed_featherlite.sql` as a reference. Create an equivalent seed file:

```sql
-- Insert inventory rows
INSERT INTO ghg_inventory (client_id, entity, year, metric_key, metric_value) VALUES
(@cid, 'ACME', 'CY22', 'Scope 1',       45.6),
(@cid, 'ACME', 'CY22', 'Scope 2 LB',   104.5),
(@cid, 'ACME', 'CY22', 'Scope 2 MB',     0.0),
-- ... etc.
```

---

## Step 6: Configure Google Drive

1. Create a folder in Google Drive named `<ClientName> GHG Reports`
2. Copy the folder ID from the URL
3. Create sub-folders per entity/FY: `Entity-FY26/Data_Submissions/`, `Entity-FY26/Reports/`, `Entity-FY26/Approved/`
4. Update `clients.drive_root_folder_id` with the root folder ID
5. Add entity folder IDs to `src/lib/ghg-config.ts` `GHG_CLIENT_ID` map

---

## Step 7: Configure Branding

1. Upload client logo to `public/<client-slug>-logo.png`
2. Update `clients.logo_url` to `/client-slug-logo.png`
3. Update `clients.primary_color` to the client's brand hex

The portal applies `--primary` CSS variable at runtime from `client.primary_color`.

---

## Step 8: Enable GHG Automation (optional)

1. Add client to the Google Sheet `Config` tab
2. Add entry to `GHG_CLIENT_ID` map in `src/lib/ghg-config.ts`
3. Create Drive folders for the new client
4. Update `Code.gs` with new client handling
5. Set `current_year_open=true` in `client_config`

---

## Config Reference Card

| Key | Type | Required | Default | Notes |
|---|---|---|---|---|
| `base_year_s12` | String | Yes | — | e.g. `"FY22"` |
| `base_year_s3` | String | Yes | — | e.g. `"FY24"` |
| `netzero_year` | String | No | `"2050"` | Net-zero target year |
| `sbti_target_s12` | String | No | — | SBTi % reduction target |
| `sbti_target_year` | String | No | — | SBTi target year |
| `irec_factor` | String | No | `"0.597"` | Cost factor per MWh |
| `irec_max_mwh` | String | No | — | Max I-REC procurement |
| `current_year_open` | String | No | `"true"` | Collection window status |
| `s3_boundary` | JSON array | Yes | — | Relevant Scope 3 categories |
| `enabled_pages` | JSON array | Yes | — | Portal pages to show |

---

## Verification Checklist

After setup, verify:
- [ ] Login works with test credentials
- [ ] Sidebar shows only enabled pages
- [ ] Entity switcher shows correct entities
- [ ] Fiscal year switcher shows correct years
- [ ] Dashboard loads without errors (check browser console)
- [ ] Demo mode works (if enabled)
- [ ] Submission page shows correct datasets
- [ ] Vault page loads (may be empty initially)
