# Multi-Client Architecture
**GHG Portal — making the portal client-agnostic without a rebuild**

---

## The Problem

The portal works perfectly for Featherlite today but has three kinds of hardcoding that prevent it from serving any other client without code changes:

| Layer | What's hardcoded | Why it's a problem |
|---|---|---|
| **Database** | `ENUM('FP','FOS')` and `ENUM('FP','FOS','FL')` in `submissions` and `computed_metrics`; `ENUM('featherlite_team','featherlite_leadership',…)` in `users` | A new client with different entity codes (e.g. `HQ`, `Plant1`, `Plant2`) cannot be added without altering the table schema |
| **Data files** | All constants in `master.ts` are Featherlite-specific (inventory numbers, facilities, entities, targets) | Different clients have different emissions, different facilities, different targets |
| **Frontend** | Entity lists, entity names, scope 3 boundaries, base years are read from the TS constants — not from the DB | The portal renders Featherlite-specific labels and structures regardless of which client is logged in |

The SQL migration plan (Phase 1–5) solves the data layer. This document solves the structural layer — how the portal knows *who it is serving* at runtime and adapts accordingly.

---

## The Core Idea: Client Context

Every time a user logs in, the portal makes one call — `GET /api/client/context` — that returns everything needed to configure itself for that client: who the entities are, what the reporting years are, which pages are active, which scope 3 categories are in scope, currency, country.

Every page and component uses this context instead of hardcoded constants. The data APIs (`/api/ghg/inventory`, `/api/decarb/actions`, etc.) are already scoped by `client_id` from the session — they don't need to change at all.

```
User logs in  →  session stores client_id + role
                       │
                       ▼
              GET /api/client/context
              returns: entities, facilities, years,
                       enabled pages, s3 boundary, config
                       │
                       ▼
              Portal renders based on that context
              Each page fetches its own data
              (already scoped to client_id)
```

For Featherlite today, this context returns FP / FOS / FL, FY21–FY26, INR, India, all pages enabled. For a new client tomorrow, it returns whatever was set up at onboarding — zero code changes.

---

## What Changes (Minimal)

### 1. Database — 4 additions, 2 column type changes

#### A. New table: `client_entities`
Defines the entities for each client — replaces hardcoded `ENUM('FP','FOS','FL')`.

```sql
CREATE TABLE IF NOT EXISTS client_entities (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  client_id       INT NOT NULL,
  code            VARCHAR(20) NOT NULL,   -- 'FP', 'FOS', 'FL', 'HQ', 'Plant1', etc.
  name            VARCHAR(255) NOT NULL,  -- full legal name
  short_name      VARCHAR(100),
  blurb           TEXT,
  is_consolidated TINYINT(1) DEFAULT 0,  -- 1 = computed roll-up (like FL = FP + FOS)
  consolidates    JSON,                  -- ["FP","FOS"] — which entities roll into this one
  sort_order      SMALLINT DEFAULT 0,
  UNIQUE KEY      uniq_entity (client_id, code),
  FOREIGN KEY     (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

-- Featherlite seed (run once):
INSERT INTO client_entities (client_id, code, name, short_name, is_consolidated, consolidates, sort_order)
VALUES
  (1, 'FP',  'Featherlite Products Pvt. Ltd.',      'Featherlite Products', 0, NULL,           1),
  (1, 'FOS', 'Featherlite Office Systems Pvt. Ltd.','Featherlite Office Systems', 0, NULL,      2),
  (1, 'FL',  'Featherlite (Consolidated)',           'Featherlite',          1, '["FP","FOS"]', 3);
```

#### B. New table: `client_config`
Stores per-client configuration: reporting years, base years, currency, country, enabled pages, scope 3 boundary, targets, org info.

```sql
CREATE TABLE IF NOT EXISTS client_config (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  client_id   INT NOT NULL,
  config_key  VARCHAR(100) NOT NULL,
  config_val  TEXT NOT NULL,   -- JSON string
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY  uniq_cfg (client_id, config_key),
  FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;
```

Keys stored here for Featherlite (and any future client):

| Key | Value (example) |
|---|---|
| `reporting_years` | `["FY21","FY22","FY23","FY24","FY25","FY26"]` |
| `s12_base_year` | `"FY22"` |
| `s3_base_year` | `"FY24"` |
| `currency` | `"INR"` |
| `country` | `"India"` |
| `sector` | `"Office furniture & workspace solutions"` |
| `enabled_pages` | `["overview","inventory","trends","action-plan","credits","vault","submissions","peer","methodology","hotspots","workstreams","priority-actions","progress","decarbonisation","reporting","green-finance"]` |
| `s3_boundary` | `["cat1","cat2","cat3","cat4","cat5","cat6","cat7","cat9","cat11","cat12"]` |
| `s3_not_relevant` | `{"FP":["cat8","cat10","cat11","cat13","cat14","cat15"],"FOS":["cat8","cat10","cat13","cat14","cat15"]}` |
| `targets` | `{"sbtiBaseYear":"FY22","sbtiBaseS12":868,"sbtiTargetYear":"FY30","sbtiTargetS12":504,"netZeroYear":"FY40"}` |
| `org` | `{"name":"Featherlite","revenueLakhFY25":70970.06,"productionUnitsFY25":788141}` |
| `carbon_prices` | `[{"label":"₹500/t","price":500},...]` |
| `data_entry_entities` | `["FP","FOS"]` — entities that appear in the submissions form |

#### C. New table: `user_clients`
Links users to clients. One user can access multiple clients (e.g. Deepwoods admin).

```sql
CREATE TABLE IF NOT EXISTS user_clients (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  user_id   INT NOT NULL,
  client_id INT NOT NULL,
  UNIQUE KEY uniq_uc (user_id, client_id),
  FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

#### D. New column on `clients`: `logo_url`, `primary_color`
So the portal header/branding adapts per client without code changes.

```sql
ALTER TABLE clients
  ADD COLUMN logo_url      VARCHAR(500) DEFAULT NULL,
  ADD COLUMN primary_color VARCHAR(7)   DEFAULT '#1E6F5C',
  ADD COLUMN org_country   VARCHAR(100) DEFAULT 'India',
  ADD COLUMN org_currency  VARCHAR(10)  DEFAULT 'INR';
```

#### E. Column type changes (the two breaking schema changes)

```sql
-- submissions: entity becomes a free VARCHAR, not Featherlite-specific ENUM
ALTER TABLE submissions
  MODIFY COLUMN entity VARCHAR(20) NOT NULL;

-- computed_metrics: same
ALTER TABLE computed_metrics
  MODIFY COLUMN entity VARCHAR(20) NOT NULL DEFAULT 'consolidated';

-- users: roles become generic
ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'client_viewer',        -- read-only (was featherlite_leadership)
    'client_contributor',   -- data entry (was featherlite_team)
    'client_admin',         -- manage own client users/settings
    'consultant_admin',     -- Deepwoods full admin (was deepwoods_admin)
    'consultant_coordinator'-- Deepwoods coordinator (was deepwoods_coordinator)
  ) NOT NULL;
```

> **Migration note:** The existing Featherlite user rows need a one-time role remap:
> `featherlite_team` → `client_contributor`, `featherlite_leadership` → `client_viewer`,
> `deepwoods_admin` → `consultant_admin`, `deepwoods_coordinator` → `consultant_coordinator`.

---

### 2. PHP API — one new endpoint, minor updates to existing ones

#### New endpoint: `GET /api/client/context`
The single call the frontend makes at app load (after login). Returns everything needed to configure the portal for that session's client.

```json
{
  "client": {
    "id": 1,
    "name": "Featherlite",
    "slug": "featherlite",
    "logo_url": "/logos/featherlite.png",
    "primary_color": "#1E6F5C"
  },
  "entities": [
    { "code": "FP",  "name": "Featherlite Products Pvt. Ltd.", "short": "Featherlite Products",      "consolidated": false, "consolidates": null },
    { "code": "FOS", "name": "Featherlite Office Systems Pvt. Ltd.", "short": "Featherlite Office Systems", "consolidated": false, "consolidates": null },
    { "code": "FL",  "name": "Featherlite (Consolidated)", "short": "Featherlite",                  "consolidated": true,  "consolidates": ["FP","FOS"] }
  ],
  "data_entry_entities": ["FP", "FOS"],
  "reporting_years": ["FY21","FY22","FY23","FY24","FY25","FY26"],
  "s12_base_year": "FY22",
  "s3_base_year": "FY24",
  "currency": "INR",
  "country": "India",
  "enabled_pages": ["overview","inventory","trends","action-plan","credits","vault","submissions","peer","methodology","hotspots","workstreams","priority-actions","progress","decarbonisation","reporting","green-finance"],
  "s3_boundary": ["cat1","cat2","cat3","cat4","cat5","cat6","cat7","cat9","cat11","cat12"],
  "s3_not_relevant": { "FP": ["cat8","cat10","cat11","cat13","cat14","cat15"], "FOS": ["cat8","cat10","cat13","cat14","cat15"] },
  "targets": { "sbtiBaseYear": "FY22", "sbtiBaseS12": 868, "sbtiTargetYear": "FY30", "sbtiTargetS12": 504, "netZeroYear": "FY40" }
}
```

#### Existing endpoints — no structural changes
All existing GHG data endpoints (`/api/ghg/inventory`, `/api/decarb/actions`, etc.) already use `client_id` from the session. They don't need to change. The only thing that changes in them is entity validation — instead of checking against a hardcoded ENUM, they look up valid entity codes from `client_entities`.

#### Session — add `client_id`
When a user logs in, the session record stores their `client_id` (looked up via `user_clients`). If a Deepwoods admin has access to multiple clients, they get a client-switcher UI (see Onboarding section).

---

### 3. Frontend — one new React Context, one small change per component

#### New: `ClientContext`
A React context created at app init (in `__root.tsx`), populated from the `/api/client/context` call.

```ts
// src/lib/client-context.ts
export interface ClientContext {
  client:              { id: number; name: string; slug: string; logoUrl: string; primaryColor: string };
  entities:            { code: string; name: string; short: string; consolidated: boolean; consolidates: string[] | null }[];
  dataEntryEntities:   string[];
  reportingYears:      string[];
  s12BaseYear:         string;
  s3BaseYear:          string;
  currency:            string;
  country:             string;
  enabledPages:        string[];
  s3Boundary:          string[];
  s3NotRelevant:       Record<string, string[]>;
  targets:             Record<string, number | string>;
}
```

In `__root.tsx`, fetch this once after auth and store in context. Every component that currently reads from `master.ts` constants reads from this context instead.

#### Changes per component (small — find-and-replace level)

| Currently reads from `master.ts` | Reads from `ClientContext` instead |
|---|---|
| `ENTITIES` | `context.entities` |
| `DATA_ENTRY_ENTITIES` | `context.dataEntryEntities` |
| `YEARS` | `context.reportingYears` |
| `S12_BASE_YEAR`, `S3_BASE_YEAR` | `context.s12BaseYear`, `context.s3BaseYear` |
| `ENTITY_META[entity].name` | `context.entities.find(e => e.code === entity)?.name` |
| `NOT_RELEVANT[entity]` (s3 scope) | `context.s3NotRelevant[entity]` |
| `TARGETS` | `context.targets` |
| `ORG.name` | `context.client.name` |

This is not a component rewrite — it is a data source swap. The JSX structure, layout, and logic of every page stays exactly the same.

#### Page visibility
The `enabled_pages` array in the context drives the sidebar/nav. Pages not in the list are hidden automatically — no conditional rendering code needed per page.

---

## What Stays Exactly the Same

- All 20 page route files — no structural changes
- All React components — same JSX, same logic
- PHP API file structure — same endpoints, same URL patterns
- Auth / session / password reset system — add `client_id` to session only
- Google Drive integration — `drive_root_folder_id` is already per-client in the `clients` table
- The GHG calculation logic — purely data-driven
- Hostinger hosting setup — nothing changes

---

## Onboarding a New Client

When Deepwoods takes on a new client, the setup is a one-time DB operation. No code deploy, no portal changes.

### Step 1 — Insert the client

```sql
INSERT INTO clients (name, slug, drive_root_folder_id, logo_url, primary_color, org_country, org_currency)
VALUES ('Dolphin Products Ltd.', 'dolphin', 'DRIVE_FOLDER_ID', '/logos/dolphin.png', '#0057A8', 'India', 'INR');
-- note the new client_id (e.g. 2)
```

### Step 2 — Define entities

```sql
INSERT INTO client_entities (client_id, code, name, short_name, is_consolidated, consolidates, sort_order)
VALUES
  (2, 'DPL',  'Dolphin Products Ltd.',        'Dolphin Products', 0, NULL,             1),
  (2, 'CORP', 'Dolphin (Consolidated)',        'Dolphin',          1, '["DPL"]',        2);
```

A single-entity client just has one data entity and one consolidated entity that mirrors it. A 4-entity client lists all 4 plus a consolidated one.

### Step 3 — Set config

```sql
INSERT INTO client_config (client_id, config_key, config_val) VALUES
  (2, 'reporting_years',    '["FY23","FY24","FY25","FY26"]'),
  (2, 's12_base_year',      '"FY23"'),
  (2, 's3_base_year',       '"FY24"'),
  (2, 'currency',           '"INR"'),
  (2, 'country',            '"India"'),
  (2, 'enabled_pages',      '["overview","inventory","trends","submissions","vault","methodology"]'),
  (2, 's3_boundary',        '["cat1","cat2","cat3","cat5","cat6","cat7"]'),
  (2, 's3_not_relevant',    '{"DPL":["cat4","cat8","cat9","cat10","cat11","cat12","cat13","cat14","cat15"]}'),
  (2, 'data_entry_entities','["DPL"]'),
  (2, 'targets',            '{"sbtiBaseYear":"FY23","netZeroYear":"FY45"}'),
  (2, 'org',                '{"name":"Dolphin Products Ltd.","sector":"Manufacturing"}');
```

`enabled_pages` controls exactly which sidebar items appear for this client. A client that hasn't done any decarbonisation planning yet won't see `/action-plan` or `/peer` — it's just not in the list.

### Step 4 — Add facilities

```sql
INSERT INTO ghg_facilities (client_id, name, entity, state, grid_utility, active, sort_order)
VALUES
  (2, 'Pune Plant', 'DPL', 'Maharashtra', 'MSEDCL', 1, 1),
  (2, 'Chennai Office', 'DPL', 'Tamil Nadu', 'TNEB', 1, 2);
```

### Step 5 — Create user accounts

```sql
INSERT INTO users (email, password_hash, role, must_change_password)
VALUES ('operations@dolphin.com', '<hash>', 'client_contributor', 1);

INSERT INTO user_clients (user_id, client_id)
VALUES (LAST_INSERT_ID(), 2);
```

### Step 6 — Seed GHG data (or leave empty and collect via portal)

If historical data is available, run the seed script pointed at client_id = 2.
If not, the client starts submitting data via the Submissions page — the portal is already built for that.

### That's it. Portal auto-adapts.

When `operations@dolphin.com` logs in:
- The context call returns Dolphin's entities, years, and enabled pages
- The sidebar shows only the pages in their `enabled_pages` list
- The entity selector shows DPL and CORP — not FP/FOS/FL
- All charts, tables, and numbers are scoped to client_id = 2
- Featherlite's data is never exposed

---

## Multi-Client Admin (Deepwoods)

Deepwoods admins can access multiple clients. After login, they see a client-switcher. Switching client re-calls `/api/client/context` with the new `client_id` — the portal fully reconfigures without a page reload.

```sql
-- Deepwoods admin linked to both clients:
INSERT INTO user_clients (user_id, client_id) VALUES (1, 1), (1, 2);
```

The switcher UI is a small addition to the top nav — a dropdown showing client names. It calls `POST /api/session/switch-client` which updates the `client_id` in the active session and returns the new context.

---

## Summary of All Changes Required

### Database (one-time migration)
1. Add `client_entities` table
2. Add `client_config` table
3. Add `user_clients` table
4. Add 4 columns to `clients` table (`logo_url`, `primary_color`, `org_country`, `org_currency`)
5. `ALTER` `submissions.entity` from ENUM to VARCHAR(20)
6. `ALTER` `computed_metrics.entity` from ENUM to VARCHAR(20)
7. `ALTER` `users.role` ENUM to the 5 generic roles
8. One-time data migration: remap existing Featherlite user roles, seed `client_entities` and `client_config` for Featherlite

### Backend (new file + small edits)
1. New file: `/backend/api/client/context.php`
2. New file: `/backend/api/session/switch-client.php` (Deepwoods multi-client)
3. Edit existing data endpoints: swap hardcoded entity ENUM validation for a `client_entities` lookup

### Frontend (no page rebuilds)
1. New file: `src/lib/client-context.ts` — the context type definition
2. New hook: `src/hooks/useClientContext.ts` — wraps the context
3. Edit `__root.tsx`: fetch `/api/client/context` after auth, store in React context
4. Edit `_app.tsx`: drive sidebar visibility from `enabledPages` in context
5. Edit components that read `ENTITIES`, `YEARS`, `TARGETS`, `ORG` — swap to context reads

The component edits are find-and-replace level changes, not rewrites. The page JSX and layout is unchanged.

---

## Effort Estimate

| Work | Time |
|---|---|
| DB migration (schema changes + Featherlite seed) | 1 day |
| `/api/client/context` PHP endpoint | 0.5 day |
| `ClientContext` + `useClientContext` hook | 0.5 day |
| Wire context into `__root.tsx` + `_app.tsx` | 0.5 day |
| Component edits (swap constants → context) | 2 days |
| Client-switcher for Deepwoods admin | 0.5 day |
| Test with a dummy second client | 1 day |
| **Total** | **~6 days** |

This is fully additive to the SQL migration plan (Phases 1–5). Both can run in parallel — the SQL migration moves data out of TS files, this work makes the portal client-aware. They don't block each other.
