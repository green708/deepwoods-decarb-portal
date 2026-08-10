# scripts/ — Build & Deployment Scripts

Node.js scripts for building and cleaning the production deployment bundle.

## What belongs here

- `build-static.mjs` — Assembles `dist-static/`, the complete Hostinger deployment
  bundle (SPA shell + assets + PHP backend).
- `clean.mjs` — Removes build artifacts (`dist-static/`, `.output/`, etc.)

## What does NOT belong here

- Client-specific data sync scripts
- One-time migration scripts (put these in `database/migrations/`)
- Deployment automation (this is manual FTP upload for now)

## Usage

```bash
# Full production build (clean → vite build → assemble static bundle)
npm run build:fresh

# Build only (no clean)
npm run build:static

# Clean build artifacts
npm run clean
```

## How build-static.mjs works

1. Verifies the Nitro server entry (`/tmp/ghg-output/server/index.mjs`) exists
2. Starts the Nitro server locally on port 8917
3. Fetches `/` to capture the SSR HTML shell
4. Creates `dist-static/` with: SSR shell, Vite assets, `.htaccess`, `backend/`
5. Kills the local server

The Nitro output directory is configured in `vite.config.ts` and can be
overridden via the `NITRO_OUT` environment variable.

## Deployment note

`dist-static/` is the complete deployment package for Hostinger `public_html/`.
Upload its contents via FTP. Then separately upload `ghg-proxy.php` from the
repository root to `public_html/`. These are two separate files to upload.
