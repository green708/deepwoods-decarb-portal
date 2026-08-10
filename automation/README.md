# automation/ — Google Apps Script & Report Generator

The automation layer handles the 7-day data collection and reporting cycle.

## What belongs here

- `Code.gs` — Google Apps Script deployed as a web app. Handles the full Day 0–8
  reporting cycle: opening a cycle, sending reminders, compiling submissions,
  triggering the Claude AI draft, and notifying the team.
- `generate_ghg_report.js` — Node.js report generator run locally by the consultant
  to produce the final GHG inventory report from the compiled data.
- `package.json` — Node.js dependencies for `generate_ghg_report.js`

## What does NOT belong here

- Client-specific test data files (`.xlsx`, `.json`)
- Environment secrets — Apps Script uses its own script properties (see DEPLOYMENT_GUIDE.md)
- The CORS proxy (`ghg-proxy.php`) — it lives at the repository root

## Architecture

```
Day 0   Portal triggers → Apps Script opens cycle, creates Drive folders
Day 1,3,5  Apps Script sends reminder emails
Day 7   Apps Script compiles all submissions, calls Claude API for GHG draft
Day 7–8  Deepwoods reviews draft, approves via portal
Day 8   Apps Script sends final report to client
```

The portal communicates with Apps Script via `ghg-proxy.php` (CORS proxy) →
`VITE_GHG_WEBAPP_URL` (env var) → `src/lib/ghg-config.ts`.

## Configuration

Apps Script stores its configuration in Script Properties (not in this file):
- `ANTHROPIC_API_KEY` — for Claude AI report drafting
- `MASTER_INDEX_SHEET_ID` — the Google Sheet used as the submission master index
- `CLIENT_DRIVE_FOLDER_ID` — root Drive folder for client deliverables

See `docs/DEPLOYMENT_GUIDE.md` for the complete setup walkthrough.

## Important: client-specific content

`Code.gs` currently contains some client-specific content (entity IDs) that
needs to be parameterized before a second client is onboarded. See `docs/TODO.md`.
