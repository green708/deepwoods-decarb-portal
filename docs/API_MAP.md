# API Map

All REST API endpoints. Base path: `/backend/api/`

All protected endpoints require `Authorization: Bearer <token>` header.
All endpoints return JSON.

---

## Authentication

### `POST /login.php`
Public.

**Request:** `{ email, password }`  
**Response:** `{ token, email, role, client_id, mustChangePassword }`  
**Notes:** Creates a session token valid for **7 days**. No X-Api-Key header required.

### `POST /logout.php`
Protected.

**Response:** `{ success: true }`  
**Notes:** Deletes the session token.

### `GET /me.php`
Protected.

**Response:** `{ email, role }`  
**Notes:** Used to validate session on page load.

### `POST /change-password.php`
Protected.

**Request:** `{ currentPassword, newPassword }`

### `POST /forgot-password.php`
Public.

**Request:** `{ email }`  
**Notes:** Sends password reset email via SMTP.

### `POST /reset-password.php`
Public.

**Request:** `{ token, newPassword }`

---

## Client Context

### `GET /context.php`
Protected.

**Response:**
```json
{
  "client": {
    "id": 1,
    "name": "Example Client Ltd.",
    "slug": "example",
    "logo_url": "/deepwoods-logo.png",
    "primary_color": "#1E6F5C",
    "currency": "INR",
    "reporting_period": "FY"
  },
  "entities": [
    { "code": "CL", "name": "Example Consolidated", "short": "CL", "is_consolidated": true, "consolidates": ["E1","E2"], "sort_order": 0 },
    { "code": "E1", "name": "Entity One Ltd.",       "short": "E1", "is_consolidated": false, "consolidates": null,        "sort_order": 1 },
    { "code": "E2", "name": "Entity Two Ltd.",       "short": "E2", "is_consolidated": false, "consolidates": null,        "sort_order": 2 }
  ],
  "reporting_years": ["FY22", "FY23", "FY24", "FY25", "FY26"],
  "enabled_pages": ["workstreams", "dashboard", "..."],
  "s3_boundary": ["Cat 1", "Cat 2", "..."],
  "s3_not_relevant": { "E1": ["Cat 7"], "E2": [] },
  "targets": {
    "base_year_s12": "FY22",
    "base_year_s3": "FY24",
    "netzero_year": 2040,
    "sbti_target_s12": 42,
    "sbti_target_year": 2030
  },
  "config": { "irec_factor": 0.597, "irec_max_mwh": 144, "current_year_open": true }
}
```

**Notes:** Called once on login, cached in `sessionStorage` under key `decarb_client_ctx`. Forms the `ClientContext` available via `useClientContext()`. DB column `short_name` is aliased to `short` by `context.php`.

---

## GHG Inventory

### `GET /ghg/inventory.php`
Protected. Query: `?entity=FL`

**All years are returned in a single call** — no `year` param needed.

**Response:**
```json
{
  "entity": "FL",
  "rows": [
    { "metric_key": "Scope 1",       "series": { "FY22": 120.5, "FY23": 135.2, "FY25": 267.7 } },
    { "metric_key": "Scope 2 LB",    "series": { "FY22": 980.0, "FY25": 1185.3 } },
    { "metric_key": "Grand Total LB","series": { "FY25": 45449.95 } }
  ]
}
```

Standard metric keys: `Scope 1`, `Scope 2 LB`, `Scope 2 MB`, `Cat 1`–`Cat 15`, `Scope 3 Total`, `Grand Total LB`, `Grand Total MB`

### `GET /ghg/s1.php`
Protected. Query: `?entity=FP&view=breakdown|by_facility`

Note: view value is `by_facility` (with underscore), not `byfacility`.

**breakdown response:** Array of `S1BreakdownRow { source, fuel, series: FYSeries }`  
**by_facility response:** Array of `S1ByFacilityRow { facility, sub_type, series: FYSeries }`

### `GET /ghg/s2.php`
Protected. Query: `?entity=FOS&view=breakdown|by_facility`

**breakdown response:** Array of `S2BreakdownRow { type: "location_based"|"market_based"|"grid_kwh"|"re_kwh", series: FYSeries }`  
**by_facility response:** Array of `S2ByFacilityRow { facility, series: FYSeries }`

### `GET /ghg/s3.php`
Protected. Query: `?entity=FL`

**Response:** Array of `S3SummaryRow { entity, category, series: FYSeries }` (all categories, all years).

### `GET /ghg/intensity.php`
Protected. Query: `?entity=FL`

**Response:** Array of `IntensityRow { fy, revenue_lakh, production_units, s12_lb, s12_mb, s3_total }`.  
Note: field is `fy` not `year`.

### `GET /ghg/facilities.php`
Protected. Query: `?entity=FP` (optional — omit to get all facilities)

**Response:** Array of `FacilityRow { id, name, entity, location, state, grid_utility, re_instrument }`.

---

## Decarbonisation

### `GET /decarb/actions.php`
Protected. Query: `?entity=FL` (entity is optional)

**Response:** Array of `DecarbAction { id, entity, title, description, facilities[], lever, status, priority, abatement_t, timeline }`.

### `GET /decarb/assets.php`
Protected. Query: `?entity=FL` (entity is optional — no year param)

**Response:** Array of `DecarbAsset { id, name, entity, facility, fuel, scope, sub_type, status, health, unit, series: FYSeries }`.

---

## Credits (Renewables & I-RECs)

### `GET /credits/irec.php`
Protected. Query: `?entity=FOS` (entity is optional)

**Response:** Array of `IRECRow { entity, facility, mwh, coverage, vintage, instrument, status, fy }`.

### `GET /credits/grid-mwh.php`
Protected. Query: `?entity=FL` (entity is optional)

**Response:** `Record<string, Record<string, number>>` — keyed by entity then FY. E.g. `{ "FP": { "FY22": 1200, "FY25": 980 } }`.

---

## Submissions

### `POST /submit.php`
Protected. `multipart/form-data`.

**Form fields:**
- `entity` — entity code
- `dataset_id` — dataset identifier
- `year` — fiscal year
- `notes` — optional submitter notes
- `file_data[]` — one or more data files
- `file_doc[]` — one or more supporting documents

**Response:** `{ submission_id, drive_links }`  
**Notes:** Files are uploaded to Google Drive. Requires `drive_token.json` to be present.

### `GET /submissions.php`
Protected. Query: `?entity=FP&status=Pending`

**Response:** Array of submission records with embedded `files` array.

### `POST /review.php`
Protected (admin roles only).

**Request:** `{ submission_id, action: "Approved"|"Rejected"|"Reassigned", notes }`

### `GET /audit-log.php`
Protected. Query: `?submission_id=42`

**Response:** Array of audit log entries.

---

## Vault

### `GET /vault.php`
Protected. Query: `?entity=FL&year=FY25`

**Response:** Array of `{ id, title, doc_type, drive_link, uploaded_at }`.

---

## Datasets

### `GET /datasets.php`
Protected.

**Response:** Array of dataset definitions matching `src/data/datasets.ts` structure.

---

## Priority Items

### `GET /priority-items.php`
Protected. Query: `?entity=FL` (entity is optional)

**Response:** Array of `PriorityItem { id, type: "action"|"update", entity, title, detail, priority, link, age, tag }`.

---

## Methodology

### `GET /methodology.php`
Protected.

**Response:** Array of `{ section, content }` methodology entries.

---

## Peers

### `GET /peers.php`
Protected. No query params — returns all peers for the client.

**Response:** Array of `PeerRow { name, scope1, scope2_lb, scope2_mb, scope3_total, intensity_revenue, fy }`.

---

## Notifications

### `GET /notification-prefs.php`
Protected.

**Response:** `{ enabled, frequency, custom_date, send_time, include_actions, include_updates }`.

### `POST /notification-prefs.php`
Protected.

**Request:** Same fields as GET response.

### `POST /send-notification.php`
Protected or cron (via `?cron_secret=<secret>`).

**Notes:** Sends digest emails for all users whose notification schedule is due.

---

## Admin

### `GET /users.php`
Protected (admin roles only).

**Response:** Array of user objects (no passwords).

### `GET /metrics.php`
Protected.

**Response:** Aggregated summary metrics for the admin dashboard.

---

## Google Drive OAuth

### `GET /oauth-start.php`
Public (restricted by IP in production).

**Notes:** Initiates Google OAuth flow. Redirects to Google consent screen.

### `GET /oauth-callback.php`
Public (OAuth callback URI).

**Notes:** Exchanges auth code for token, stores in `backend/drive_token.json`.

---

## React Query Hook Mapping

All hooks live in `src/lib/api.ts`. Most return **all years at once** — there is no `year` parameter on the GHG/inventory hooks.

| Hook | Endpoint | Cache Key | Notes |
|---|---|---|---|
| `useInventory(entity)` | `GET /ghg/inventory.php` | `['inventory', entity]` | Returns `InventoryResponse` with FYSeries |
| `useS1Breakdown(entity)` | `GET /ghg/s1.php?view=breakdown` | `['s1-breakdown', entity]` | |
| `useS1ByFacility(entity)` | `GET /ghg/s1.php?view=by_facility` | `['s1-facility', entity]` | |
| `useS2Breakdown(entity)` | `GET /ghg/s2.php?view=breakdown` | `['s2-breakdown', entity]` | |
| `useS2ByFacility(entity)` | `GET /ghg/s2.php?view=by_facility` | `['s2-facility', entity]` | |
| `useS3Summary(entity)` | `GET /ghg/s3.php` | `['s3-summary', entity]` | |
| `useIntensity(entity)` | `GET /ghg/intensity.php` | `['intensity', entity]` | |
| `useFacilities(entity?)` | `GET /ghg/facilities.php` | `['facilities', entity \| 'all']` | entity optional |
| `useDecarbActions(entity?)` | `GET /decarb/actions.php` | `['decarb-actions', entity \| 'all']` | entity optional |
| `useDecarbAssets(entity?)` | `GET /decarb/assets.php` | `['decarb-assets', entity \| 'all']` | entity optional; no year param |
| `useIRECRegister(entity?)` | `GET /credits/irec.php` | `['irec', entity \| 'all']` | entity optional |
| `useGridMWh(entity?)` | `GET /credits/grid-mwh.php` | `['grid-mwh', entity \| 'all']` | entity optional |
| `useDatasets()` | `GET /datasets.php` | `['datasets']` | |
| `usePriorityItems(entity?)` | `GET /priority-items.php` | `['priority-items', entity \| 'all']` | entity optional |
| `usePeers()` | `GET /peers.php` | `['peers']` | no params |
| `useMethodology()` | `GET /methodology.php` | `['methodology']` | |
| `useVaultDocuments(entity?, fy?)` | `GET /vault.php` | `['vault', entity \| 'all', fy \| 'all']` | both optional |
