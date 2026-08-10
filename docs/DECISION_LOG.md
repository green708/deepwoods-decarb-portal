# Decision Log

Every major architectural, product, and engineering decision — with reasoning, alternatives considered, and current status.

---

## ADR-001 — Multi-Tenant via Shared Schema with client_id FK

**Date:** 2026-07
**Status:** Active

**Decision:**
Use a single MySQL schema with `client_id INT NOT NULL FK → clients(id)` on every data table to implement multi-tenancy. Do not use separate schemas per client or separate databases per client.

**Reason:**
- Simpler schema migrations (one ALTER TABLE affects all clients simultaneously)
- No connection pool explosion (one connection pool, not N per client)
- Joins across tables work naturally (no cross-schema joins)
- Sufficient for the current and foreseeable load
- Hostinger shared hosting cannot support multiple schemas or databases efficiently

**Alternatives Considered:**
- Separate schema per client: rejected — migration complexity, no benefit at current scale
- Separate database per client: rejected — cost, connection overhead, Hostinger limits
- Row-level security (PostgreSQL): rejected — database is MySQL on Hostinger

**Implications:**
- Every query that accesses client data MUST filter by `client_id`
- Security is application-layer, not database-layer — every developer must follow the pattern
- See `docs/MULTI_TENANT_READINESS.md` for full analysis

---

## ADR-002 — PHP Backend on Hostinger Shared Hosting

**Date:** 2026-07
**Status:** Active

**Decision:**
Build the backend as PHP 8 REST API deployed to Hostinger shared hosting alongside MySQL. Do not introduce Node.js, Python, or containerization.

**Reason:**
- Client (Deepwoods) already has Hostinger hosting; zero additional infrastructure cost
- PHP 8 fully supports the required API surface area
- Shared hosting is sufficient for current and near-term load (one active client initially)
- Avoids DevOps complexity for a team focused on product development

**Alternatives Considered:**
- Node.js (Express/Hono): rejected — cannot run on Hostinger shared hosting; would require VPS
- Python (FastAPI): rejected — same hosting constraint
- Serverless (Vercel Functions): rejected — would require restructuring deployment model

**Implications:**
- No background jobs (no cron, no queues) — use Google Apps Script for automation
- No WebSockets — no real-time features
- PHP sessions have limitations on shared hosting — bearer token auth used instead
- All PHP endpoints follow: `require db.php` → `dolphin_require_auth()` → logic → `dolphin_send_json()`

---

## ADR-003 — Static SPA Deployment via TanStack Start

**Date:** 2026-08
**Status:** Active

**Decision:**
Build the frontend as a React 19 SPA using TanStack Start, compile to pure static files via `npm run build:fresh` → `dist-static/`, and upload static files to Hostinger `public_html/`.

**Reason:**
- Static files can be hosted anywhere including Hostinger (no Node.js server required)
- TanStack Start provides React 19 + file-based routing + SSR capability at build time
- Faster page loads than a server-rendered approach on shared hosting
- Simplifies deployment: just upload files

**Alternatives Considered:**
- Next.js: rejected — requires Node.js server; also at the time TanStack Start had better React 19 support
- Remix: rejected — server-rendering model requires Node.js
- Vite SPA only: rejected — TanStack Router provides better structure for a 26-route application

**Implications:**
- All API calls are client-side via `authFetch()` — no SSR data fetching in production
- The `ghg-proxy.php` CORS proxy must be deployed separately (NOT inside `dist-static/`)
- Client-side routing requires `public_html/.htaccess` to redirect 404s to `index.html`

---

## Decision — TanStack Query for All Data Fetching

**Date:** 2026-08
**Status:** Active

**Decision:**
All API data fetching uses TanStack Query v5 hooks defined in `src/lib/api.ts`. No ad-hoc `fetch()` calls in route files.

**Reason:**
- Centralized data layer: adding a new hook means editing one file
- Automatic caching, background refresh, loading/error states
- Consistent pattern: every hook follows `useQuery({ queryKey, queryFn })`
- React 19 compatible

**Implications:**
- When adding a new API endpoint, add its hook to `src/lib/api.ts` first
- Do not call `authFetch()` directly from route components except for mutations
- Query keys follow the pattern `[resource, params]`

---

## Decision — Groq/LLaMA for AI Chat (HP-1 Sprint)

**Date:** 2026-08
**Status:** Active

**Decision:**
Use Groq API with LLaMA 3.3 70B Versatile for the DeecarbAI chat widget. Keys are stored server-side in `backend/api/ai.php` with `getenv()` override support.

**Reason:**
- Groq's inference speed is significantly faster than OpenAI for interactive chat
- LLaMA 3.3 70B is open-weight — no data residency concerns for client data
- Cost: significantly cheaper than GPT-4 at similar quality for this use case
- Sprint 1 HP-1: keys MUST be server-side (were previously exposed in browser bundle)

**Alternatives Considered:**
- OpenAI GPT-4: rejected — cost, data residency questions, keys were already Groq
- Anthropic Claude API: noted for future — would require account setup and integration
- Local LLM: rejected — not feasible on Hostinger shared hosting

**Security Note:**
Keys are now server-side in PHP with `getenv()` override. They still exist as hardcoded fallbacks in `ai.php` source code — this is acceptable for current hosting arrangement but should be replaced with environment variables before any open-sourcing or public repository access.

---

## Decision — Bearer Token Auth (Not Session Cookies)

**Date:** 2026-07
**Status:** Active

**Decision:**
Authentication uses JWT-style bearer tokens stored in localStorage, sent in the `Authorization: Bearer` header on every API call. PHP sessions are not used for API auth.

**Reason:**
- Hostinger shared hosting has PHP session limitations (session isolation between subdomains is unreliable)
- localStorage bearer tokens work consistently across all hosting configurations
- Stateless auth fits the static SPA + separate PHP API deployment model

**Alternatives Considered:**
- PHP sessions with cookies: rejected — Hostinger cross-subdomain session issues
- HttpOnly cookies with CSRF protection: rejected — complexity for current scale, stateful server requirement

**Security Implications:**
- Tokens are stored in localStorage (XSS risk — acceptable for this threat model given single-origin deployment)
- Tokens must expire; expired tokens return 401 which redirects to login
- `authFetch()` in `src/lib/auth.ts` handles all token attachment

---

## Decision — Sprint 1 Security Priorities (2026-08-06)

**Date:** 2026-08-06
**Status:** Complete

**Decision:**
Sprint 1 (security) addressed three issues before any new feature work:
1. HP-1: Move Groq API keys from browser bundle to server-side PHP proxy
2. Cross-tenant authorization: Fix all 4 endpoints that accepted `client_slug` from caller
3. submit.php hardcoding: Replace `'featherlite'` default and `['FP','FOS']` entity check

**Reason:**
- HP-1: API keys in browser bundle are visible to any user opening DevTools — immediate security risk
- Cross-tenant: Any authenticated user could read any other client's data by passing a different `client_slug` — critical vulnerability before second client onboarding
- submit.php: Hardcoded defaults would silently write Featherlite data for any client

**Files Changed:**
- `backend/api/ai.php` (NEW) — server-side Groq proxy
- `src/components/DeecarbAI.tsx` — removed GROQ_KEYS array
- `backend/api/submissions.php` — auth return captured, `client_id` from session
- `backend/api/audit-log.php` — same pattern
- `backend/api/metrics.php` — same pattern
- `backend/api/submit.php` — client_id from session, entity validation via DB

---

## Decision — 6-Epic Implementation Backlog Ordering

**Date:** 2026-08-07
**Status:** Active (not yet started)

**Decision:**
The 15 confirmed release blockers were organized into 6 Epics with this dependency order:
E1 (Auth) → E2 (Provisioning) → E3 (Communications) → E5 (Config) → E6 (Bugs)
E1 (Auth) → E4 (Entity Logic) → E5 (Config)

**Reason:**
- E1 must come first: without correct role ENUM, user creation fails for any client
- E2 before E3: client must exist in DB before communications can be dynamically branded
- E4 is independent of E2/E3 but feeds E5 (entity logic correct before analytics pages use it)
- E6 last: bug fixes depend on the data layer being correct (E5)

**Details:** See `docs/IMPLEMENTATION_BACKLOG.md` for full Epic specifications.

---

## Decision — TypeScript Strict Mode, 0 Errors Policy

**Date:** 2026-08-06
**Status:** Active

**Decision:**
The codebase maintains strict TypeScript with 0 compile errors at all times. TypeScript errors are treated as blocking — no commit may introduce a new TypeScript error.

**Reason:**
- The codebase went from 99 errors (detected in Platform Stabilization Sprint 1) to 0 after Platform Foundation Complete
- TypeScript errors in this codebase consistently indicated real runtime bugs (undefined references, wrong property names, type mismatches that caused UI crashes)
- Maintaining 0 errors provides a reliable regression baseline

**How to maintain:**
- Run `npx tsc --noEmit` before committing
- Fix TypeScript errors immediately when they appear
- Do not use `// @ts-ignore` without a comment explaining the specific exception

---

## Decision — No Test Suite (Current Constraint)

**Date:** 2026-08-07
**Status:** Acknowledged constraint — address post-Epic-6

**Decision:**
The platform currently has no automated test suite. Quality assurance relies on TypeScript strict mode + manual testing.

**Reason:**
- Sprint velocity was prioritized over test infrastructure
- The codebase was in active architectural transition (single-tenant → multi-tenant) making tests high-maintenance
- PHP backend has no test framework configured

**Plan:**
- After Epic 6 is complete, the platform will be architecturally stable
- At that point, write integration tests for the PHP API endpoints (most critical)
- Add React component tests for the most complex components (ScenarioProvider, submission wizard)
- See `docs/TODO.md` for the testing ticket

---

## Decision — Market Research Before Product Phase 2

**Date:** 2026-08-07
**Status:** Complete

**Decision:**
Before beginning Epic 2 (Client Provisioning) and the broader product roadmap, commission independent market research on the sustainability software landscape.

**Reason:**
- Platform has only one client (Featherlite) as reference
- Risk of building the wrong product for the second client and beyond
- Market has matured significantly since the platform was first built

**Output:** 7 documents in `docs/market-research/`:
- `COMPETITOR_PROFILES.md` — 25 competitors, real user complaints
- `DESIGN_PATTERNS.md` — UX patterns + strategic vision ("what would we build differently")
- `MARKET_GAPS.md` — identified opportunities including MSME cliff, consultant OS gap
- Others — see `docs/DOCUMENT_INDEX.md`

**Key finding:** The "Consultant Operating System" gap and the MSME cliff are the most defensible opportunities. The vision in `DESIGN_PATTERNS.md` should inform all Epic 2+ product decisions.
