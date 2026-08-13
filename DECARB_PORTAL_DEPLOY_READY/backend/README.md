# backend/ — PHP 8 REST API

Plain PHP 8 REST API served by Hostinger's Apache. No framework. Every file
under `api/` is an endpoint callable by the frontend via `authFetch()`.

## What belongs here

- `api/` — REST endpoint files (one file per resource or action)
- `api/ghg/` — GHG inventory endpoints (scope 1/2/3, intensity, facilities)
- `api/decarb/` — Decarbonization endpoints (actions, assets)
- `api/credits/` — Renewable credits endpoints (I-REC, grid MWh)
- `config.php.example` — Config template (copy to `config.php` and fill in real values)
- `seed-users.php` — One-time user seeder for a new client
- `oauth-start.php`, `oauth-callback.php` — Google Drive OAuth setup

## What does NOT belong here

- `config.php` — this is in `.gitignore`; never commit it
- SQL schema files — they live in `database/schema_combined.sql`
- Client-specific seed data — use the `clients` table and admin UI
- Debug or diagnostic PHP files — remove after use; never deploy to production
- The `ghg-proxy.php` CORS proxy — it lives at the repository root and is deployed
  directly to `public_html/`, not inside the `backend/` subdirectory

## Auth pattern

Every endpoint calls `dolphin_require_auth()` from `auth_middleware.php` at the top.
Sessions are validated via the `sessions` table (7-day expiry).

```php
require_once __DIR__ . "/../auth_middleware.php";
$user = dolphin_require_auth();  // exits with 401 if not authenticated
```

## Adding a new endpoint

1. Create `api/your-endpoint.php`
2. Call `dolphin_require_auth()` at top
3. Query using `$pdo` from `db.php`
4. Add it to `docs/API_MAP.md`

## Conventions

- DB credentials come from `config.php` only — never hardcode
- Entity/client scope: every query must filter by `client_id` from the session
- Return JSON always: `header("Content-Type: application/json"); echo json_encode(...)`
- Error responses: `http_response_code(4xx); echo json_encode(["error" => "..."])`

## Deployment

The build script (`scripts/build-static.mjs`) copies this entire directory into
`dist-static/backend/`. Upload `dist-static/` to Hostinger `public_html/`.
