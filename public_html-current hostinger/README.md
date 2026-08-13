# public/ — Static Assets

Static files served directly by Vite at the root URL (`/`). Files here are
copied as-is to `dist-static/` during the build — no transformation applied.

## What belongs here

- `favicon.ico`, `favicon.png` — Browser tab icons
- `deepwoods-logo.png`, `Deepwoods Leaf Icon.png` — Platform brand assets
- `templates/` — Generic data submission templates (Excel) for clients to download.
  These must be generic — no client-specific names or pre-filled data.

## What does NOT belong here

- Client-specific reports or documents — these are served from Google Drive
- Large binary files (PDFs, videos) — serve these from cloud storage
- JavaScript or TypeScript source files — these belong in `src/`

## Conventions

- All assets in `public/` are publicly accessible without authentication
- Keep total size under 5 MB — heavy assets go to Drive/S3
- Brand assets (logos, icons) are generic Deepwoods Green platform assets only
- Templates in `public/templates/` must work for any client — no pre-filled names

## templates/ (currently empty)

Generic Scope 1, 2, and 3 data submission templates need to be created here.
See `docs/TODO.md` for this post-migration task.
