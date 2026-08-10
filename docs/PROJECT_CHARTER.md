# Project Charter — Decarb Platform

*Deepwoods Green | v1.0 | 2026-08-07*

---

## Vision

To become the digital delivery infrastructure through which Deepwoods provides world-class sustainability consulting — the platform that turns Deepwoods' consulting methodology into repeatable, scalable outcomes for every client.

Not a compliance checkbox. Not another dashboard. The tool through which Deepwoods and its clients do real decarbonization work together.

---

## Mission

Enable Deepwoods to deliver rigorous GHG accounting, decarbonization planning, and sustainability consulting at scale — serving any client organization, from a 50-person manufacturing company to a multi-entity enterprise — without sacrificing methodological integrity or scientific credibility.

---

## Product Philosophy

### We are NOT building:
- Another enterprise ERP for large corporations
- A dashboard application that measures without enabling action
- A compliance checkbox platform that helps companies file reports without reducing emissions
- A feature-for-feature replica of Watershed, Persefoni, or IBM Envizi
- A "lite" version of enterprise software stripped of the features MSMEs actually need

### We ARE building:
- A **workflow-first** platform designed around how sustainability work actually happens
- A **Deepwoods-native** delivery system — Deepwoods consultants and coordinators have full portfolio visibility across all client engagements; their experience is a first-class design concern
- A **client-appropriate** platform — genuinely useful to the organizations Deepwoods serves, from a 50-person manufacturer to a multi-entity enterprise, without sacrificing methodological rigor
- An **action-oriented** system — every measurement connects to a decision and every decision connects to a project
- A **trust layer** — methodology transparency, automatic audit trails, explainable numbers

### The Core Insight
Most sustainability software was designed by compliance professionals for compliance teams. It optimizes for filing reports, not for reducing emissions. We optimize for the latter. The report is a byproduct of the work, not the goal.

---

## Long-Term Goals

1. **Operations goal**: A single platform through which Deepwoods can manage 20+ client engagements simultaneously — from data collection through decarbonization project tracking — without any client-specific code or configuration.

2. **Growth goal**: The platform that enables Deepwoods to become the leading sustainability consulting firm for Indian manufacturing organizations, with the capability to expand to new geographies and client types as the practice grows.

3. **Efficiency goal**: A consulting delivery model where the platform enables Deepwoods to serve more clients at higher quality, with measurably less manual effort per engagement — improving both consulting throughput and client outcomes.

4. **Impact goal**: Measurable emissions reductions at client organizations — not just better reports.

---

## Customers and Users

### Deepwoods (Platform Operator)

Deepwoods Green is the sole operator of this platform. Deepwoods' consultants and coordinators use it to manage every active client engagement. The Deepwoods experience — portfolio management, client onboarding, engagement oversight, data review — is a first-class design concern, not an administrative afterthought.

**Deepwoods roles:** `deepwoods_admin` (full access, manages all clients) · `deepwoods_coordinator` (manages engagements, reviews submissions)

### Client Organizations (Deepwoods' Customers)

Organizations that engage Deepwoods for sustainability consulting. They access the platform as part of their consulting engagement — not as independent software purchasers. The platform should feel like a guided sustainability workspace that Deepwoods has configured and is actively supporting for them.

**Client profile:** Manufacturing companies and enterprises with Scope 1/2 focus and growing Scope 3 obligations; 50–5,000 employees; single or multi-entity structures; Indian market primarily, expanding internationally as Deepwoods' practice grows.

**Client roles:** `sustainability_team` (primary client user, full portal) · `client_uploader` (data submission only) · `client_leadership` (read-only, board-level views)

### Geographic Priority

1. India (BRSR regulatory driver; Deepwoods' home market; large manufacturing base)
2. Southeast Asia (as Deepwoods' practice expands)
3. Other markets as Deepwoods' client base grows

---

## Product Principles

1. **Workflow before features.** Every feature must fit into a real workflow. Ask: what work does this replace? What decision does this enable?

2. **MSMEs are not enterprise-lite.** They need different things, not fewer things. A 100-person company has a single person doing sustainability part-time. Design for that person.

3. **Deepwoods staff are first-class users.** The Deepwoods consultant and coordinator experience — portfolio management, client oversight, engagement tracking — must be designed with the same care as the client-facing experience. A platform that works well for clients but is painful for Deepwoods to operate has failed at its primary purpose.

4. **Measurement is a means to an end.** The goal is reduced emissions, not a complete inventory. Design for action, not just measurement.

5. **Trust is earned, not claimed.** Numbers must be explainable. Methodology must be transparent. Audit trails must be automatic. Every number must have a "why does this look like this?" answer one click away.

6. **Simplicity at the right level.** Don't simplify things that need to be complex (GHG methodology). Simplify the things that make the work hard (data collection, navigation, report generation).

7. **No feature theater.** If a feature doesn't change what a user does, it doesn't belong in the product. Dashboards are not features. Insights are features.

---

## The Six Decision Questions

Every feature, UX decision, and architectural choice should be evaluated against these questions. If a proposed change does not clearly advance at least one of them, it needs stronger justification before proceeding.

1. **Does this help Deepwoods manage more clients?**
2. **Does this improve consulting quality?**
3. **Does this reduce manual work for Deepwoods or for clients?**
4. **Does this improve client collaboration?**
5. **Does this help clients become carbon neutral?**
6. **Can the client understand what to do next without needing to contact Deepwoods?**

---

## Engineering Principles

1. **Multi-tenant by default.** Every query filters by `client_id`. Every API endpoint derives identity from the authenticated session, never from caller-supplied parameters. No exceptions.

2. **Zero TypeScript errors.** The codebase maintains 0 TypeScript errors at all times. TypeScript errors are blockers, not warnings.

3. **No hardcoding.** Client names, entity codes, facility names, base years, and target values are never hardcoded. They come from the database via context.

4. **Security at the boundary.** Validate at system boundaries (user input, external APIs). Trust internal code and framework guarantees. Don't add error handling for scenarios that can't happen.

5. **Minimal surface area.** Don't build what isn't needed now. Don't design for hypothetical future requirements. Three similar lines are better than a premature abstraction.

6. **Reversibility.** Prefer reversible actions. Ask before destructive operations. Investigate before deleting.

---

## UI/UX Principles

1. **Data-dense, not sparse.** Sustainability professionals need to see a lot of data. Don't over-simplify into a consumer-grade experience.

2. **Empty states teach.** The first-time experience must guide the user toward their first meaningful action, not show a blank page.

3. **Role-appropriate views.** A `client_leadership` user (board member) sees a different view than a `sustainability_team` user. Navigation and information density are role-aware.

4. **Mobile is future scope.** Desktop-first now. Plan for mobile data collection later.

5. **Accessibility.** Keyboard navigation, focus states, and screen reader labels are non-negotiable.

6. **Consistent visual language.** All new UI components follow the shadcn/ui + Tailwind CSS v4 system. No one-off designs. No inline styles.

---

## Architecture Principles

1. **Single schema, multiple clients.** Multi-tenancy via `client_id` FK on every data table. Not separate databases per client, not separate schemas.

2. **Auth derives everything.** The PHP auth system (`dolphin_require_auth()`) returns `client_id`, `role`, and `entity_scope`. Every downstream decision is derived from this — nothing is trusted from the caller.

3. **Context as the contract.** The `ClientContext` returned by `context.php` is the canonical source of truth for the frontend. No other API call should duplicate this data.

4. **Static deployment.** The frontend compiles to pure static files. No Node.js server in production. The PHP backend handles all dynamic server-side logic.

5. **PHP backend is intentional.** Hostinger shared hosting is a client-imposed constraint. PHP 8 is fully capable of the API surface area required. Do not attempt to introduce Node.js, Python, or Docker into the backend.

---

## Multi-Tenant Principles

1. Every data table has `client_id INT NOT NULL FK → clients(id)`.
2. `client_id` is ALWAYS derived from `$authUser['client_id']` — never from request parameters.
3. Entity scope (`entity_scope`) restricts data-submitter users to their assigned entity.
4. The `clients` table owns: name, slug, logo_url, drive_root_folder_id.
5. The `client_entities` table defines the entity structure per client — do not assume "FP", "FOS", or "FL" for any client.
6. The `client_config` table holds all per-client configuration key-value pairs.

---

## Security Principles

1. **No secrets in the frontend bundle.** API keys, credentials, and tokens never appear in JavaScript source or in `dist-static/`. Server-side only.

2. **Bearer token authentication.** Tokens are stored in localStorage (acceptable for this hosting context). `authFetch()` adds the header automatically.

3. **Prepared statements only.** No raw SQL string concatenation. All DB queries use PDO prepared statements.

4. **Cross-tenant data isolation.** Every query that touches client data is filtered by `$authUser['client_id']`. The security review in Sprint 1 confirmed this across all endpoints.

5. **No caller-supplied client identity.** `?client_slug=` parameters in API calls are a vulnerability. All client identity derives from the authenticated session.

---

## Coding Standards

See `CLAUDE.md` for the full coding rules applied to this project. Summary:

- TypeScript strict mode; 0 errors at all times
- No `any` types unless unavoidable and documented
- React hooks follow rules-of-hooks strictly
- PHP: `declare(strict_types=1)` in every file
- SQL: PDO prepared statements only
- Comments: only for non-obvious WHY — never for WHAT
- No `console.log` left in committed code
- Commit messages: imperative mood, explain the why

---

## Things We Will Never Do

1. Hardcode a client name, entity code, or facility name in application code
2. Take `client_id` or `client_slug` from caller-supplied request parameters as the source of authorization
3. Store API keys or secrets in the browser JavaScript bundle
4. Build features that display measurements without connecting to decisions or actions
5. Sacrifice methodological accuracy for UX simplicity (the numbers must be right)
6. Build an "enterprise-lite" stripped version for MSMEs — we build the right product for them
7. Treat the Deepwoods-facing experience (admin, portfolio management, engagement oversight) as lower priority than the client-facing experience — both must be excellent
8. Design the product only for the sustainability team when the data lives everywhere else
9. Release to production with known cross-tenant data leakage
10. Force-push to the main branch without explicit human confirmation
