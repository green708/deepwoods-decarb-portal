# Decarb Platform — AI Agent Context

Multi-tenant GHG Accounting & Decarbonization Planning portal.
Managed by Deepwoods Green. Built on PHP 8 + MySQL + React 19 + TanStack Start.

## The core concept: Clients and Entities

The platform is multi-tenant. Each **client** is an organisation using the platform.
Each client has one or more **entities** (legal entities within the organisation).

Entity data comes from the database, not from static files:
```
useClientContext() → ctx.entities[]
  - .code         (e.g. "FP", "FOS", "FL") — unique per client
  - .name         (full legal name)
  - .short        (display name)
  - .is_consolidated (boolean — the roll-up entity)
```

For consolidated entity checks: `ctx.entities.find(e => e.is_consolidated)?.code`  
Never hardcode entity codes like `=== "FL"`.

## Auth roles

| Role | Access |
|---|---|
| `sustainability_team` | Full portal |
| `client_uploader` | Data submission only |
| `client_leadership` | Read-only |
| `deepwoods_admin` | All clients, admin |
| `deepwoods_coordinator` | All clients |

## Data layer

All data comes from the API (React Query hooks in `src/lib/api.ts`).
There are no client-specific static data files.

## Stack

- Frontend: TanStack Start / React 19 / TanStack Router / shadcn / Recharts
- Backend: PHP 8 REST API under `backend/api/`
- Database: MySQL 8 — 31 tables, schema in `database/schema_combined.sql`
- Automation: Google Apps Script (`automation/Code.gs`) — Day 0–8 reporting cycle
- Hosting: Hostinger shared hosting (PHP/Apache, no persistent Node process)

## Build & deploy

```bash
npm run build:fresh   # → dist-static/
# Upload dist-static/ to public_html/
# Upload ghg-proxy.php separately to public_html/
```

## No hardcoding

Never add to the codebase:
- Client names, facility names, entity codes as string literals
- Featherlite-specific references (FP, FOS, FL, Rajanakunte, Hejjala, etc.)
- Customer emails
- Apps Script URLs (use VITE_GHG_WEBAPP_URL env var)
- GHG client IDs like `FL-FOS-GHG-FY26`
