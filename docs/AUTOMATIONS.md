# Automations

All automated processes in the Decarb portal ecosystem.

---

## 1. GHG Reporting Cycle (Day 0–8)

**Location:** `reporting-platform/Code.gs` (Google Apps Script)
**Trigger:** Daily 9 AM (installed as a time-based Apps Script trigger)
**Purpose:** Manages the 8-day GHG data collection and report delivery cycle for each client entity.

### Day-by-Day Cycle

| Day | Action | Actor |
|---|---|---|
| 0 | Collection window opens; FY notification to Deepwoods and client | Automated |
| 1 | Reminder email if no submission received | Automated |
| 3 | Second reminder | Automated |
| 5 | Escalation email (urgency) | Automated |
| 7 | `generate_ghg_report.js` notified — DOCX report generated and uploaded to Drive | Automated |
| 7 | Client and consultant receive INTERIM or FINAL report email | Automated |
| 8 | Approval window: Deepwoods approves final report via Google Form | Manual |
| Post-8 | Approved report filed to `Approved/` folder; delivery email to client | Automated |

### Google Sheet (Master Index)

Sheet ID: `1Nsh8H7on70rJeIr8JDzoX6gYKR7oHUbiaIC5y_5MnlY`

Tabs:
- `Master_Index` — one row per client entity per FY with status, cycle day, Drive links
- `GHG_Datapoints` — 33 data points (19 FOS + 14 FP) with collection status
- `GRI_Datapoints` — GRI questionnaire data collection tracking
- `Config` — client IDs, Drive folder IDs, web app URL
- `Notifications` — notification event log
- `Data_Submissions` — submission records

### Drive Folder Structure

```
Featherlite GHG Reports (root: 1Gcx4SaoM02o7HHn3SgZ8-HS8-sfq6tta)
├── FL-FOS-GHG-FY26 (1dELrmCYMfLU7sV9oX8d8x6pVvw7l6kl1)
│   ├── Data_Submissions/
│   ├── Reports/
│   └── Approved/
└── FL-FP-GHG-FY26 (19h8CWGRTQ8i32eWi1ffFn3SPjEKvdKsb)
    ├── Data_Submissions/
    ├── Reports/
    └── Approved/
```

### Web App Endpoint

URL: `https://script.google.com/macros/s/AKfycbxIFTYIh42tk6DwSfwXSBpJVWW21MDWbOYbaOYQUFdMwuIDJlPElCYX9CoZZ0Qqkief/exec`

Actions:
- `POST action=publishReport` — DOCX (base64) → Drive + email + Master_Index update
- `POST action=approveReport` — Copies to Approved/, sends delivery email
- `GET action=getNotifications` — Returns notification feed for the portal

---

## 2. GHG Report Generator

**Location:** `reporting-platform/generate_ghg_report.js`
**Runtime:** Node.js (requires `npm install` inside `reporting-platform/`)
**Trigger:** Manual (run by Deepwoods consultant) or called by Day 7 logic

### Usage

```bash
cd reporting-platform

# FOS (default):
node generate_ghg_report.js --file FOS_GHG_Data_FY26.xlsx

# FP:
node generate_ghg_report.js --file FP_GHG_Data_FY26.xlsx --client FL-FP-GHG-FY26

# Auto-approve (for scripted final runs):
node generate_ghg_report.js --file FOS_GHG_Data_FY26.xlsx --approve
```

### What It Does

1. Reads data XLSX (uploaded by client via the portal submissions page)
2. Computes tCO2e using IPCC emission factors
3. Determines INTERIM (missing data) or FINAL (all data present) report type
4. Generates DOCX using the `docx` Node.js package
5. Base64-encodes DOCX and POSTs to the Apps Script web app
6. Apps Script saves to Drive, updates Master_Index, sends emails

### Client IDs

| Entity | ClientID |
|---|---|
| FOS | `FL-FOS-GHG-FY26` |
| FP  | `FL-FP-GHG-FY26` |

### Data Points

- **FOS:** 19 data points (9 S1 + 4 S2 + 6 S3)
- **FP:** 14 data points (3 S1 + 2 S2 + 9 S3)

### Emission Factors Used

| Source | Factor | Standard |
|---|---|---|
| Diesel | 2.68 kgCO2e/L | IPCC AR6 |
| LPG | 2.983 kgCO2e/kg | IPCC AR6 |
| CO2 (fugitive) | 1.0 kgCO2e/kg | Pass-through |
| HFC | Pass-through | Already tCO2e |
| Karnataka grid | 0.82 kgCO2e/kWh | CEA v19 FY23-24 |
| Tamil Nadu grid | 0.75 kgCO2e/kWh | CEA v19 FY23-24 |

---

## 3. Email Notification Digest

**Location:** `backend/api/send-notification.php`
**Trigger:** Hostinger cron or manual POST with `?cron_secret=<secret>`
**Purpose:** Sends daily/weekly email digests to users based on their notification preferences

### Notification Types

- Submission received
- Submission approved / rejected
- Report generated
- Priority action added
- Update item added

### User Preferences

Configured per user in the `notification_prefs` table:
- `frequency`: daily / weekly / monthly / custom
- `custom_date`: specific date for monthly custom trigger
- `send_time`: preferred delivery time (default 08:00)
- `include_actions`: include action-needed items
- `include_updates`: include update items

### Cron Setup

Add to Hostinger cron panel:
```
0 8 * * * curl https://your-domain.com/backend/api/send-notification.php?cron_secret=<secret>
```

---

## 4. Master Sheet Sync

**Location:** `scripts/sync-master-sheet.py`
**Runtime:** Python 3 with `openpyxl`
**Trigger:** Manual (run by developer when GHG data is updated)
**Purpose:** Reads the GHG Master Sheet XLSX and regenerates `src/data/featherlite.ts`

### Usage

```bash
python scripts/sync-master-sheet.py

# Custom xlsx path:
python scripts/sync-master-sheet.py --xlsx /path/to/custom.xlsx

# Preview without writing:
python scripts/sync-master-sheet.py --dry-run
```

### Source File

`data-sources/GHG_Master_Sheet_Featherlite.xlsx`

Sheets read:
- `DATA` — GHG inventory rows (Entity, FY, Scope, Category, Value)
- `Facilities` — Facility-level FY25 actuals
- `FP_FY26_Monthly` — FP monthly actuals for FY26

### Output

`src/data/featherlite.ts` — auto-generated TypeScript file containing all GHG constants.
**Never edit `featherlite.ts` by hand.** Changes are overwritten on the next sync.

---

## 5. Static Build

**Location:** `scripts/build-static.mjs`
**Trigger:** Manual (`npm run build:fresh`)
**Purpose:** Assembles the Hostinger-deployable bundle

### Process

1. Runs `scripts/clean.mjs` to remove stale artifacts
2. Runs `vite build` to compile the React app via Nitro
3. Starts the Nitro server locally on a temporary port
4. Fetches `http://localhost:<port>/` to capture the pre-rendered HTML shell
5. Copies `/assets/` from Nitro output
6. Copies `backend/` PHP files
7. Writes `dist-static/.htaccess` with SPA routing fallback
8. Writes `dist-static/index.html` (the captured HTML shell)

### Output

`dist-static/` — upload the entire contents to Hostinger `public_html/`.

Also upload `ghg-proxy.php` directly to `public_html/` (not inside `dist-static/`).

---

## 6. Google Drive OAuth

**Location:** `backend/oauth-start.php`, `backend/oauth-callback.php`
**Trigger:** Manual (one-time setup per deployment)
**Purpose:** Authorises the PHP backend to upload files to Google Drive

### Setup Flow

1. Visit `https://your-domain.com/backend/oauth-start.php`
2. Google OAuth consent screen appears
3. After approval, redirected to `oauth-callback.php`
4. Token stored in `backend/drive_token.json` (gitignored)

The token is used by `GoogleDrive.php` whenever a file submission is processed.

---

## 7. GHG Automation Portal Integration

**Location:** `src/lib/ghg-config.ts` + `src/routes/_app.notifications.tsx`
**Purpose:** Real-time notification feed from the Apps Script automation

### Config

```typescript
// .env.local
VITE_GHG_WEBAPP_URL=https://your-domain.com/ghg-proxy.php

// src/lib/ghg-config.ts
GHG_LIVE = !!import.meta.env.VITE_GHG_WEBAPP_URL
```

When `GHG_LIVE = true`:
- `/notifications` page fetches real events from the Apps Script web app via the CORS proxy
- Submission page shows real submission history

When `GHG_LIVE = false` (demo mode):
- Mock notifications are shown
- Submissions are stored in localStorage

---

## Summary

| Automation | Trigger | Frequency | Owner |
|---|---|---|---|
| Day 0–8 cycle | Apps Script daily trigger | Daily check, 8-day cycle | Google Apps Script |
| Report generator | Manual / Day 7 | Per reporting cycle | Node.js (local) |
| Email digest | Hostinger cron | Daily at 08:00 | PHP |
| Master sheet sync | Manual (developer) | When data changes | Python |
| Static build | Manual (developer) | Per deployment | Node.js |
| Drive OAuth | Manual (one-time) | One-time setup | PHP |
