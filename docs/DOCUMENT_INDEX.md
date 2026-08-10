# Document Index

Master index of all project documents. Grouped by purpose. Explains when to read each.

---

## Start Here (Every Session)

| Document | Purpose | Read When |
|---|---|---|
| `CLAUDE_ONBOARDING.md` | Complete onboarding for a new Claude | First document in any new Claude account |
| `docs/SESSION_HANDOFF.md` | Current state, next priority, recent changes | Start of every working session |
| `docs/IMPLEMENTATION_BACKLOG.md` | 6-Epic plan with DoD and testing checklists | Before starting any Epic |

---

## Product and Strategy

| Document | Purpose | Read When |
|---|---|---|
| `docs/PROJECT_CHARTER.md` | Vision, mission, principles, things we'll never do | Onboarding; when making product decisions |
| `docs/PROJECT_CONTEXT.md` | Full current state, what works, what doesn't | Onboarding; when confused about current state |
| `docs/DECISION_LOG.md` | All major architectural and product decisions | When wondering why something is built a certain way |
| `docs/market-research/DESIGN_PATTERNS.md` | UX patterns + strategic product vision | When designing new features; product direction |
| `docs/market-research/MARKET_RESEARCH.md` | Market size, segmentation, MSME analysis | Business strategy; pricing decisions |
| `docs/market-research/MARKET_GAPS.md` | Identified opportunities | Product roadmap planning |
| `docs/market-research/EMERGING_TRENDS.md` | What's coming in sustainability software | Long-term roadmap; feature prioritization |
| `docs/PROJECT_HEALTH_REPORT.md` | Scores and health assessment | Sprint retrospectives; stakeholder updates |

---

## Architecture and Engineering

| Document | Purpose | Read When |
|---|---|---|
| `docs/ARCHITECTURE.md` | Full technical architecture and data flow | Deep technical questions; onboarding |
| `docs/DATABASE_SCHEMA.md` | All 31 tables with column descriptions | Adding new DB tables; writing queries |
| `docs/API_MAP.md` | All REST endpoints with request/response shapes | Adding new endpoints; frontend integration |
| `docs/DATA_MODEL.md` | Data models, flows, relationships | Understanding how data moves through the system |
| `docs/MULTI_TENANT_READINESS.md` | Multi-tenant analysis and current state | Security review; onboarding second client |
| `docs/ADRs/ADR-001-multi-client-platform.md` | Why we use shared schema | Multi-tenant architecture questions |
| `docs/ADRs/ADR-002-php-backend-deployment.md` | Why PHP on Hostinger | Backend architecture questions |
| `docs/ADRs/ADR-003-static-spa-deployment.md` | Why static SPA | Frontend architecture questions |
| `docs/BUSINESS_RULES.md` | GHG calculation rules and methodology | Any calculation-related changes |
| `docs/COMPONENT_MAP.md` | Frontend component reference | Adding new UI components; understanding existing ones |

---

## Development

| Document | Purpose | Read When |
|---|---|---|
| `CLAUDE.md` | AI coding rules — mandatory | Before writing any code |
| `CLAUDE_ONBOARDING.md` | Full Claude onboarding | Start of any new Claude session |
| `docs/TEAM_GUIDELINES.md` | Coding rules, review process, DoD | Before contributing; review checklist |
| `docs/PROJECT_STRUCTURE.md` | Every folder explained | When adding files; understanding the codebase layout |
| `docs/DEPLOYMENT_GUIDE.md` | How to deploy to Hostinger | Deployment; first-time setup |
| `docs/AUTOMATIONS.md` | Google Apps Script automation docs | GHG automation work; Apps Script changes |
| `docs/CUSTOMER_CONFIGURATION.md` | How to onboard a new client | Epic 2 implementation; onboarding second client |

---

## Operations and History

| Document | Purpose | Read When |
|---|---|---|
| `docs/CHANGELOG.md` | History of all changes (newest first) | Debugging; understanding what changed when |
| `docs/TODO.md` | Remaining work items (not yet in Epics) | Sprint planning; finding known issues |
| `docs/PROJECT_MEMORY.md` | AI-specific context and philosophy | AI assistant continuity |

---

## Research and Competitive Intelligence

| Document | Purpose | Read When |
|---|---|---|
| `docs/market-research/COMPETITOR_PROFILES.md` | 25 competitor profiles with user complaints | Feature decisions; avoiding competitor mistakes |
| `docs/market-research/INDUSTRY_BEST_PRACTICES.md` | What genuinely works in sustainability software | Feature design; UX decisions |
| `docs/market-research/INDUSTRY_COMMON_MISTAKES.md` | What the market keeps getting wrong | Avoiding anti-patterns; design review |
| `docs/market-research/DESIGN_PATTERNS.md` | UX patterns + "what would we build differently" vision | Product direction; new feature design |

---

## Reference Files

| Document | Purpose | Read When |
|---|---|---|
| `docs/IMPLEMENTATION_BACKLOG.html` | Interactive HTML version of the backlog | Sharing with non-technical stakeholders |
| `docs/reference/Sustainability_Reporting_Platform_Feasibility_v2.pdf` | Original business feasibility document | Business context; long-term vision |
| `docs/GHG_SQL_Migration_Plan.md` | Historical SQL migration plan | DB migration reference |
| `docs/Multi_Client_Architecture.md` | Historical multi-client design doc | Architecture history |

---

## Document Freshness Guide

| Document | How Often Updated | Owner |
|---|---|---|
| `SESSION_HANDOFF.md` | Every session | Current Claude / dev |
| `CHANGELOG.md` | Every sprint / significant change | Current Claude / dev |
| `TODO.md` | As issues are discovered / resolved | Current Claude / dev |
| `IMPLEMENTATION_BACKLOG.md` | When Epics are completed or modified | Current Claude / dev |
| `DATABASE_SCHEMA.md` | When DB schema changes | Current Claude / dev |
| `API_MAP.md` | When endpoints are added/changed | Current Claude / dev |
| `PROJECT_HEALTH_REPORT.md` | After major milestones | Current Claude / dev |
| `DECISION_LOG.md` | When major decisions are made | Current Claude / dev |
| All others | When underlying reality changes | As needed |
