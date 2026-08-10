# Project Structure

Complete layout of the Decarb Platform repository.

---

## Top-level layout

```
platform/
│
├── AGENTS.md                 AI agent context (entity model, conventions)
├── CLAUDE.md                 Claude Code workspace context and quick reference
├── CONTRIBUTING.md           Coding standards, branch strategy, PR conventions
├── ONBOARDING.md             New developer guide: understand, build, deploy
├── PROJECT_STRUCTURE.md      This file
├── README.md                 Project overview and entry point
│
├── .env.example              Environment variable template (no secrets)
├── .gitignore                Ignores: node_modules, dist-static/, backend/config.php
├── .prettierrc               Prettier formatting config
├── .prettierignore           Files excluded from formatting
├── components.json           shadcn/ui component config
├── eslint.config.js          ESLint config
├── package.json              npm dependencies and scripts
├── tsconfig.json             TypeScript compiler config
├── vite.config.ts            Vite build config (no Lovable dependency)
│
├── ghg-proxy.php             CORS proxy for Apps Script
│                             Deploy manually to public_html/ — NOT inside dist-static/
│
├── automation/               Google Apps Script + Node.js report generator
│   ├── README.md
│   ├── Code.gs               Apps Script — Day 0–8 reporting cycle
│   ├── generate_ghg_report.js Node.js report generator
│   └── package.json
│
├── backend/                  PHP 8 REST API
│   ├── README.md
│   ├── .htaccess             Apache rewrite rules
│   ├── config.php.example    Config template (copy → config.php, never commit)
│   ├── seed-users.php        One-time user seeder
│   ├── oauth-start.php       Google Drive OAuth
│   ├── oauth-callback.php    Google Drive OAuth callback
│   └── api/
│       ├── db.php            PDO connection
│       ├── auth_middleware.php dolphin_require_auth()
│       ├── login.php         POST /backend/api/login.php
│       ├── logout.php
│       ├── me.php
│       ├── context.php       ClientContext on login
│       ├── change-password.php
│       ├── forgot-password.php
│       ├── reset-password.php
│       ├── submit.php        Data submission
│       ├── submissions.php   Submission list
│       ├── review.php        Submission review (approve/reject)
│       ├── audit-log.php     Submission audit history
│       ├── users.php
│       ├── datasets.php
│       ├── methodology.php
│       ├── metrics.php
│       ├── notification-prefs.php
│       ├── send-notification.php
│       ├── vault.php         Document vault
│       ├── peers.php         Peer benchmarking
│       ├── priority-items.php
│       ├── GoogleDrive.php   Drive file upload class
│       ├── Smtp.php          Email sender
│       ├── ghg/
│       │   ├── inventory.php Scope 1/2/3 totals
│       │   ├── s1.php        Scope 1 source breakdown
│       │   ├── s2.php        Scope 2 source breakdown
│       │   ├── s3.php        Scope 3 category breakdown
│       │   ├── intensity.php Intensity metrics
│       │   └── facilities.php Facility list
│       ├── decarb/
│       │   ├── actions.php   Decarbonization actions
│       │   └── assets.php    Decarbonization assets
│       └── credits/
│           ├── irec.php      I-REC register
│           └── grid-mwh.php  Grid MWh data
│
├── database/                 SQL schemas and migrations
│   ├── README.md
│   ├── schema_combined.sql   Authoritative schema (31 tables, idempotent)
│   └── migrations/           Incremental schema changes
│       └── .gitkeep
│
├── docs/                     All documentation
│   ├── README.md
│   ├── ADRs/                 Architecture Decision Records
│   ├── reference/            Business vision and historical references
│   │   └── Sustainability_Reporting_Platform_Feasibility_v2.pdf
│   ├── ARCHITECTURE.md
│   ├── API_MAP.md
│   ├── AUTOMATIONS.md
│   ├── BUSINESS_RULES.md
│   ├── CHANGELOG.md
│   ├── CLIENT_DATA_REQUIREMENTS.md
│   ├── COMPONENT_MAP.md
│   ├── CUSTOMER_CONFIGURATION.md
│   ├── DATABASE_SCHEMA.md
│   ├── DATA_MODEL.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── MULTI_TENANT_READINESS.md
│   ├── PROJECT_HEALTH_REPORT.md
│   └── TODO.md
│
├── public/                   Static assets (Vite convention — served at /)
│   ├── README.md
│   ├── favicon.ico
│   ├── favicon.png
│   ├── deepwoods-logo.png
│   ├── Deepwoods Leaf Icon.png
│   └── templates/            Generic data submission templates (placeholder)
│       └── .gitkeep
│
├── scripts/                  Build and deployment scripts
│   ├── README.md
│   ├── build-static.mjs      Assemble dist-static/ for Hostinger
│   └── clean.mjs             Remove build artifacts
│
├── src/                      TanStack Start frontend (React 19)
│   ├── README.md
│   ├── styles.css            Global styles + Tailwind entry point
│   ├── router.tsx            TanStack Router setup
│   ├── server.ts             Nitro SSR entry point
│   ├── start.ts              TanStack Start entry point
│   ├── routeTree.gen.ts      Auto-generated route tree (do not edit)
│   ├── components/
│   │   ├── portal.tsx        PageHeader, PageBody, StatCard, Section
│   │   ├── DeecarbAI.tsx     AI chat floating widget
│   │   ├── decarb/
│   │   │   └── shared.tsx    Shared decarbonization components
│   │   └── ui/               shadcn/ui components (46 components)
│   ├── data/
│   │   ├── master.ts         Platform constants, CLUSTERS taxonomy, type interfaces
│   │   └── datasets.ts       Generic dataset registry
│   ├── hooks/
│   │   └── use-mobile.tsx    Mobile breakpoint hook
│   ├── lib/
│   │   ├── api.ts            All React Query hooks — the data layer
│   │   ├── auth.ts           Login, logout, roles, demo mode, authFetch()
│   │   ├── client-context.tsx ClientContextProvider, useClientContext()
│   │   ├── entity.tsx        EntityProvider, FiscalYearProvider, switchers
│   │   ├── error-capture.ts  Error capture utilities
│   │   ├── error-page.ts     Error page helpers
│   │   ├── ghg-config.ts     Apps Script integration (ghgPost, ghgGet)
│   │   ├── submissionsStore.ts Submission API client (ARC-M5: slug needs fix)
│   │   └── utils.ts          cn() utility
│   └── routes/
│       ├── __root.tsx        Root route (HTML shell, auth boundary)
│       ├── _app.tsx          Authenticated layout (sidebar, entity switcher)
│       ├── index.tsx         / (login)
│       ├── forgot-password.tsx
│       ├── reset-password.tsx
│       ├── onboard.tsx       New client onboarding wizard
│       ├── _app.workstreams.tsx   /workstreams (home, service clusters)
│       ├── _app.overview.tsx      /overview
│       ├── _app.dashboard.tsx     /dashboard
│       ├── _app.inventory.tsx     /inventory
│       ├── _app.interactive-inventory.tsx
│       ├── _app.hotspots.tsx      /hotspots
│       ├── _app.action-plan.tsx   /action-plan
│       ├── _app.progress.tsx      /progress
│       ├── _app.peer.tsx          /peer
│       ├── _app.green-finance.tsx /green-finance
│       ├── _app.credits.tsx       /credits
│       ├── _app.reports.tsx       /reports
│       ├── _app.reporting.tsx     /reporting (admin only)
│       ├── _app.submissions.tsx   /submissions
│       ├── _app.vault.tsx         /vault
│       ├── _app.methodology.tsx   /methodology
│       ├── _app.priority-actions.tsx /priority-actions
│       ├── _app.notifications.tsx /notifications
│       ├── _app.admin.tsx         /admin (Deepwoods roles only)
│       └── _app.trends.tsx        /trends (CT-3: known bug)
│
├── tests/                    Test suite (placeholder)
│   ├── README.md
│   └── .gitkeep
│
└── _archive/                 Superseded files for reference
    └── .gitkeep
```

---

## What is NOT in this repository

| Content | Location |
|---|---|
| Featherlite GHG data | MySQL (production) |
| Client reports and documents | Google Drive |
| Apps Script configuration | Google Script Properties |
| Database credentials | `backend/config.php` (server-only, gitignored) |
| Environment secrets | `.env.local` (gitignored) |
| Legacy decarb/ workspace | `C:\Users\likhi\Downloads\FL\decarb\` |
| Read-only reference | `C:\Users\likhi\Downloads\FL\Featherlite-GHG\` |
