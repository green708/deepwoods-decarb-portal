# ADR-002: PHP Backend on Hostinger Shared Hosting

**Status:** Accepted (with acknowledged limitations)  
**Date:** 2026-05  
**Decision makers:** Deepwoods team

---

## Context

The portal needs a backend API and database. The deployment target is Hostinger shared hosting because the client (Featherlite) is already paying for Hostinger, the consultancy is familiar with it, and cost is a concern for early-stage SaaS.

## Decision

Use PHP 8 with PDO/MySQL on Hostinger shared hosting. No framework — plain PHP files per endpoint. The frontend is a static SPA bundle uploaded to `public_html/`.

## Consequences

**Positive:**
- Zero additional infrastructure cost (uses existing Hostinger plan)
- Simple deployment: FTP/upload `dist-static/` contents
- No persistent process to manage — PHP handles connections per-request
- PHP + MySQL is well-understood and easy to hire for

**Negative:**
- No background jobs or queues — cron must be triggered via HTTP
- Limited concurrent connections on shared hosting
- Cannot run Node.js processes server-side (report generator runs locally)
- No WebSocket support (real-time notifications require polling)
- PHP shared hosting is not easily scalable

## Limitations Acknowledged

The GHG report generator (`generate_ghg_report.js`) cannot run on Hostinger because it requires Node.js. It is run manually by Deepwoods consultants from their local machine.

## Migration Path

When scaling to multiple clients, migrate to:
- Cloudways (managed PHP hosting with better concurrency)
- Railway or Render (Docker-based, supports Node.js + PHP)
- VPS (full control, run both PHP and Node.js)

The PHP codebase will work without modification on any Apache/Nginx + PHP 8 environment.
