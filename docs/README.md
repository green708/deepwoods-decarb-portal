# docs/ — Platform Documentation

All technical and operational documentation for the Decarb Platform.

## What belongs here

- Architecture decisions and system design documents
- API and database reference documentation
- Deployment and configuration guides
- Business rules and GHG methodology notes
- ADRs (Architecture Decision Records) under `ADRs/`
- Reference materials under `reference/`

## What does NOT belong here

- Source code — use `src/` or `backend/`
- Client-specific reports or deliverables
- Working drafts or scratch notes (use conversation context)

## Document index

| Document | Purpose |
|---|---|
| `ARCHITECTURE.md` | System architecture, data flow, hosting model |
| `API_MAP.md` | All PHP REST endpoints — URL, method, auth, response |
| `DATABASE_SCHEMA.md` | All 31 tables documented with column details |
| `AUTOMATIONS.md` | Apps Script automation — Day 0–8 cycle, triggers, notifications |
| `DEPLOYMENT_GUIDE.md` | Full deployment guide — frontend, backend, proxy, automation |
| `BUSINESS_RULES.md` | GHG calculation rules, emission factors, boundary definitions |
| `CUSTOMER_CONFIGURATION.md` | How to onboard a new client organisation |
| `MULTI_TENANT_READINESS.md` | Current SaaS readiness scores and gaps |
| `PROJECT_HEALTH_REPORT.md` | Codebase health scores and technical debt roadmap |
| `COMPONENT_MAP.md` | Frontend component reference |
| `DATA_MODEL.md` | Data models and flows |
| `CHANGELOG.md` | Release history |
| `TODO.md` | Outstanding work, known issues, and critical tasks |
| `ADRs/` | Architecture Decision Records |
| `reference/` | Business vision PDF and SQL migration history |

## Conventions

- Documents use Markdown with ATX headings (`#`, `##`)
- Keep documents up to date when architecture or process changes
- Link between documents using relative paths
