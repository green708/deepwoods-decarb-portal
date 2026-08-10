# ADR-003: Static SPA Deployment Strategy

**Status:** Accepted  
**Date:** 2026-05  
**Decision makers:** Deepwoods team

---

## Context

TanStack Start is an SSR framework that typically runs a persistent Node.js server. Hostinger shared hosting does not support persistent Node.js processes. The portal needs to run on Hostinger.

## Decision

Use TanStack Start's SSR capability **only at build time** to generate a single pre-rendered HTML shell. The built output is a standard static SPA (HTML + JS/CSS assets) that can be served by Apache.

The `scripts/build-static.mjs` script:
1. Runs the Nitro server temporarily during the build process
2. Fetches `http://localhost/` to capture the SSR-rendered HTML
3. Packages the HTML + assets + PHP backend into `dist-static/`
4. The `dist-static/` output is uploaded to Hostinger `public_html/`

An Apache `.htaccess` file redirects all non-file requests to `index.html` for client-side routing.

## Consequences

**Positive:**
- Works on any static hosting (Hostinger, Netlify, Vercel, S3 + CloudFront)
- No Node.js required in production
- Fast initial page load (pre-rendered HTML shell)
- Simple deployment (FTP upload)

**Negative:**
- No true SSR — the HTML shell is generic, not per-request personalised
- Cannot use TanStack Start server functions or server-only routes
- Build process is more complex than a pure Vite SPA build
- Deployment requires running the build script locally

## Trade-off

This approach sacrifices true SSR (personalised server-rendered responses) in exchange for deployment simplicity on shared hosting. For a B2B portal where users always log in before seeing data, this is an acceptable trade-off — the personalization happens client-side after login.
