# Project Memory

This document captures what a future AI assistant must carry in its mental model to continue this project correctly. It is written for AI continuity — not as engineering documentation.

---

## The One Sentence

This is the multi-tenant GHG accounting and decarbonization planning platform through which Deepwoods Green delivers sustainability consulting services to client organizations. Deepwoods is the sole operator. Client organizations access the platform as part of their engagement with Deepwoods — currently live for Featherlite, being extended to serve any Deepwoods client without code changes.

---

## Important Assumptions

### About the codebase
- TypeScript strict mode is non-negotiable. 0 errors means 0 errors.
- The PHP backend lives on Hostinger shared hosting. This is a constraint, not a mistake. Do not suggest moving to a different hosting provider.
- The only database is MySQL on Hostinger. No Redis, no Postgres, no NoSQL.
- The Google Drive integration (for file uploads) requires the authenticated Google service account stored in the PHP config. This is pre-configured and working.
- TanStack Start outputs to `dist-static/` — this is not a Node.js app in production; it is static files.

### About multi-tenancy
- The `client_id` pattern is the security model. If a query doesn't filter by `client_id`, it's a bug, not a feature.
- Entity codes are NOT standardized across clients. Featherlite uses FP, FOS, FL. Another client will use completely different codes. Never assume the entity code.
- Base years are NOT standardized. Featherlite's base year is FY22. Another client's might be FY19 or FY23.
- "FL" is not a consolidated entity concept — it's Featherlite's specific entity code. The concept of "consolidated entity" is `is_consolidated = 1` in `client_entities`.

### About the current state
- The platform works end-to-end for Featherlite. It does NOT work correctly for any other client without completing Epics 1–6.
- The admin console (`_app.admin.tsx`) renders UI but all data is hardcoded dummy data — no API calls.
- The onboarding wizard (`onboard.tsx`) has a functional 7-step UI but writes zero data to the database.
- Three named bugs exist (peer page blank, ScenarioProvider empty levers, vault upload no-op) that are known and scheduled for Epic 6.

### About Groq API keys
- The Groq keys are currently hardcoded as fallback values in `backend/api/ai.php`. This is intentional for now — they are NOT in the browser bundle (that was the HP-1 security fix). The next step would be moving them to server environment variables before any open-sourcing. This is a post-launch concern.

---

## Design Philosophy

### Sustainability work is a workflow problem, not a data problem
Most platforms think the challenge is "how do we collect and display data?" The real challenge is "how do we make sustainability work happen inside an organization?" The data collection is just one step. The work is: planning, prioritizing, assigning, tracking, reporting, and acting. Our platform should eventually cover all of these.

### Deepwoods' consultants are first-class users
Deepwoods' own consultants and coordinators use this platform to manage their full client portfolio. The Deepwoods-side experience — portfolio visibility, client configuration, engagement oversight — is as important as the client-facing experience. A platform that is painful for Deepwoods to operate is not delivering its primary purpose, regardless of how polished the client views are.

### Client organizations need the right features for their context
The mistake most platforms make: build a generic dashboard and add features by category. The right approach: understand what the organization Deepwoods is serving actually needs for credible GHG accounting, decarbonization planning, and regulatory reporting — and build exactly that. A manufacturing company with Scope 1/2 dominance and BRSR obligations needs different things than a company with a Scope 3-heavy footprint.

### Every measurement should connect to a decision
A dashboard that shows tCO2e by scope is not useful unless it tells the user what to do about it. Decarbonization planning, action tracking, and scenario modeling turn measurement into action. These features are not "advanced" — they're the whole point.

### Trust is the hard problem in carbon accounting
Carbon numbers are estimates with significant uncertainty. Most platforms hide this. Users who don't understand why a number changed (or why it looks different from their expectation) lose trust in the platform entirely. Methodology transparency — showing the calculation, the emission factor source, the data quality — is a competitive advantage, not a complexity burden.

---

## Technical Philosophy

### Boring technology, well executed
The stack (React, PHP, MySQL) is deliberately chosen. It's deployed to shared hosting, not Kubernetes. It compiles to static files. This is not a limitation — it's appropriate for the scale and constraints of the current stage. The business value is in the product, not the infrastructure.

### Context as the contract
The `ClientContext` returned by `context.php` is the single source of truth for "what is this client's configuration?" The frontend `useClientContext()` hook is how everything reads from it. New configuration keys should be added to `client_config` and surfaced through `context.php` — not hardcoded in route files.

### The data layer lives in one file
`src/lib/api.ts` contains every React Query hook. This is intentional — it creates a single place where anyone can find all API interactions. Route files import hooks; they don't define them.

### Security is a first-class concern
The Sprint 1 security sprint was not optional polish — it was a blocker before any second client could be onboarded. Cross-tenant data leakage is an existential risk for a SaaS platform. Every new endpoint must be reviewed for: (1) is `client_id` from auth session?, (2) does every query filter by `client_id`?, (3) is entity validation done against the DB not against hardcoded values?

---

## Business Philosophy

### The path to scale
Deepwoods built this for one client. The journey to serving many clients is through productization — removing everything that's Featherlite-specific and replacing it with configuration. The 6 Epics are exactly this path. Once they're complete, onboarding a new Deepwoods client requires zero code changes.

### BRSR is the Indian market unlock
India's BRSR (Business Responsibility and Sustainability Reporting) regulation requires the top 1,000 listed companies to report. Hundreds of thousands more will follow voluntarily or under supply chain pressure. BRSR-specific workflows (the Indian equivalent of CSRD) are a significant product opportunity that the market has largely ignored. This is Deepwoods' home market advantage.

### Deepwoods' operational efficiency is the business case
Every hour saved per client engagement compounds across the portfolio. Design decisions should optimize for Deepwoods' consultants having less manual work — automated data collection, bulk operations, portfolio-level views, and smooth client onboarding. The platform's value is measured in consulting hours saved and client outcomes delivered.

---

## Long-Term Roadmap (Known)

### Phase 1 (current): Second client onboarding
Complete Epics 1–6. No code changes for Client 2.

### Phase 2: Consultant portal
Multi-client management for Deepwoods to manage all their clients in one view.
White-label client portals (client sees their branded version, not the Deepwoods admin view).
Client progress tracking across the portfolio.

### Phase 3: Operational scale
Deepwoods can manage 20+ active client engagements simultaneously through the platform — portfolio dashboard, client health tracking, automated data collection reminders, and engagement milestone management. Onboarding a new client requires zero manual configuration.

### Phase 4: BRSR compliance layer
BRSR report generation built on top of the existing GHG accounting data.
India-specific emission factors and regulatory context.
BRSR-specific data collection workflows.

### Phase 5: Action platform
Decarbonization project management layer (not just planning, but tracking and executing).
Capital allocation support — connecting abatement opportunities to investment decisions.
Integration with green financing and carbon credit markets.

---

## What the Market Research Revealed (Key Points for AI Context)

Read `docs/market-research/DESIGN_PATTERNS.md` for the full vision. Summary for AI context:

1. **Deepwoods' multi-client management is the immediate operational priority.** The Deepwoods admin experience — managing all client engagements in one place — must be a real, working tool, not a mockup. A consultant managing 20+ clients needs portfolio visibility, not a list of client login switches.

2. **The organizations Deepwoods serves are underserved by existing tools.** Enterprise platforms cost £50k+/year and require dedicated sustainability teams to operate. Free tools lack methodological rigor. The manufacturing companies and mid-market enterprises Deepwoods takes on as clients have real GHG accounting needs that no affordable, credible tool was solving before Decarb.

3. **Dashboard addiction is an anti-pattern.** Competitors build better and better dashboards while the action-planning layer remains primitive. Decarbonization is a project management problem, not a data visualization problem.

4. **Scope 3 is universally painful.** Supplier surveys fail. Spend-based proxies produce numbers nobody believes. The platform that makes Scope 3 data collection genuinely less painful will have a meaningful advantage.

5. **AI should earn trust, not claim it.** "AI-powered" is a marketing claim in 90% of sustainability software. AI for anomaly detection ("this number changed 3x year-over-year — confirm?") and guidance ("based on your data, these 3 actions have the highest ROI") is where AI earns genuine trust. AI for report drafting is table stakes but carries hallucination risk for numbers.

---

## Files That Should Never Change Without Careful Review

| File | Why it's sensitive |
|---|---|
| `backend/api/db.php` | Foundation of the entire auth and data model |
| `src/lib/client-context.tsx` | How every route gets client configuration |
| `database/schema_combined.sql` | Authoritative schema — changes require migrations |
| `src/lib/auth.ts` | Authentication — bugs here affect all users |
| `CLAUDE.md` | The coding rules — changes affect all future AI work |
