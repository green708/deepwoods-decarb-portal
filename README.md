# Decarb Platform

Multi-tenant GHG Accounting & Decarbonization Planning portal.  
Built and operated by [Deepwoods Green](https://deepwoodsgreen.com).

---

## Quick Start

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build (Hostinger deployment)
npm run build:fresh
```

See [ONBOARDING.md](ONBOARDING.md) for the complete developer setup guide.

---

## What this platform does

The Decarb Platform helps organisations measure, report, and reduce their greenhouse gas emissions:

- **GHG Accounting** — Scope 1, 2, and 3 inventory management per GHG Protocol
- **Decarbonization Planning** — Action plans, progress tracking, scenario modelling
- **Reporting Automation** — 7-day data collection cycle via Google Apps Script
- **Multi-client** — One deployment serves multiple client organisations

---

## Repository Structure

```
platform/
├── src/          TanStack Start frontend (React 19)
├── backend/      PHP 8 REST API
├── database/     SQL schema and migrations
├── automation/   Google Apps Script + report generator
├── docs/         All documentation
├── public/       Static assets
├── scripts/      Build & deployment scripts
└── tests/        Test suite
```

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for a full layout with file-level details.

---

## Documentation

| Document | Purpose |
|---|---|
| [ONBOARDING.md](ONBOARDING.md) | New developer setup — understand, build, deploy, contribute |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Coding standards, PR conventions, branch strategy |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | Full folder and file layout |
| [CLAUDE.md](CLAUDE.md) | AI assistant context — conventions and quick references |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture and data flow |
| [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | Full deployment setup including automation |
| [docs/TODO.md](docs/TODO.md) | Outstanding work and known issues |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start, React 19, TanStack Router, Tailwind CSS v4, shadcn/ui |
| Backend | PHP 8, MySQL 8 (Hostinger shared hosting) |
| Build | Vite 8, Nitro |
| Automation | Google Apps Script, Node.js |
