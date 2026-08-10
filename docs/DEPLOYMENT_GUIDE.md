# GHG Automation — Deployment Guide

This guide connects all the pieces so the full Day 0–8 automated cycle runs live.
Complete steps **in order** — each step depends on the one before it.

---

## Step 1 — Create the Apps Script project

1. Go to [script.google.com](https://script.google.com) → **New project**
2. Rename it: `Featherlite GHG Reporting Platform`
3. Delete the default `myFunction()` code
4. Open `Code.gs` from `FL/Featherlite-GHG/reporting-platform/` on your computer
5. Paste the **entire contents** of `Code.gs` into the editor
6. Click **Save** (Ctrl+S)

---

## Step 2 — Bootstrap the Google Sheet

This creates the master spreadsheet with all tabs, headers, and FOS + FP test data in one click.

1. In the Apps Script editor, select function **`bootstrapPlatform`** from the dropdown
2. Click **Run**
3. Approve the permissions prompt (Gmail, Sheets, Drive access)
4. Open the **Execution log** — you'll see:
   ```
   ✅ Created sheet: https://docs.google.com/spreadsheets/d/...
   Sheet ID: 1AbCdEf...
   ```
5. **Copy the Sheet ID** — you'll need it in Step 6

The sheet created will have tabs: `Master_Index`, `GHG_Datapoints`, `GRI_Datapoints`, `Config`, `Notifications`, `Data_Submissions`.

---

## Step 3 — Set up Google Drive folders

1. In Google Drive, create a root folder called `Featherlite GHG Reports`
2. Copy its folder ID from the URL:
   `https://drive.google.com/drive/folders/`**`1XyZ...`**
3. In the Apps Script editor, open the `Config` tab in your Sheet (or edit `Code.gs` directly):
   - Find the line: `DRIVE_ROOT_FOLDER_ID: "<<PASTE_DRIVE_ROOT_FOLDER_ID>>"`
   - Replace with your actual folder ID
4. Run function **`createClientFolders`** from the Apps Script editor
5. Check the log — it will create:
   ```
   Featherlite GHG Reports/
     FL-FOS-GHG-FY26/
       Data_Submissions/
       Reports/
       Approved/
     FL-FP-GHG-FY26/
       Data_Submissions/
       Reports/
       Approved/
   ```
6. The folder IDs are automatically written into `Master_Index` column K

---

## Step 4 — Create the Approval Google Form

1. Go to [forms.google.com](https://forms.google.com) → **Blank form**
2. Title: `Featherlite GHG Report Approval`
3. Add these fields **exactly** (field names must match):

   | Field name | Type |
   |---|---|
   | `Client ID` | Short answer |
   | `Decision` | Dropdown → options: `Approve`, `Rework` |
   | `Report Draft` | Paragraph |
   | `Rework Comments` | Paragraph |

4. Click **Send** → copy the form URL
5. From the URL extract the form ID:
   `https://docs.google.com/forms/d/`**`1AbCdEf.../`**`edit`
6. In `Code.gs`, update:
   ```javascript
   APPROVAL_FORM_ID: "<<PASTE_APPROVAL_FORM_ID>>",
   ```
   Replace with your Form ID
7. Save `Code.gs` in the Apps Script editor
8. Run function **`setupApprovalFormTrigger`** — this wires the form submit event to `onApprovalFormSubmit()`

---

## Step 5 — Deploy the Apps Script as a web app

This is the URL that the portal and `generate_ghg_report.js` call.

1. In the Apps Script editor: **Deploy → New deployment**
2. Click the gear icon → **Web app**
3. Settings:
   - Description: `Featherlite GHG Platform v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** → copy the `/exec` URL (looks like `https://script.google.com/macros/s/AKfy.../exec`)

> **Every time you edit `Code.gs` you must create a new deployment** (or use "Manage deployments → Edit" to update the existing one). The URL stays the same if you update an existing deployment.

---

## Step 6 — Wire up the Node.js script

Open `FL/Featherlite-GHG/reporting-platform/generate_ghg_report.js` and replace:

```javascript
const WEB_APP_URL = process.env.GHG_WEBAPP_URL || "<<PASTE_WEB_APP_URL_HERE>>";
```

With your actual URL, **or** just set an environment variable so the code doesn't need to change:

```bash
# In your terminal, before running the script:
export GHG_WEBAPP_URL="https://script.google.com/macros/s/AKfy.../exec"

# Or pass it inline each time:
GHG_WEBAPP_URL="https://..." node generate_ghg_report.js --client FL-FOS-GHG-FY26
```

---

## Step 7 — Wire up the portal (live notifications)

In `FL/Featherlite-GHG/`, create or edit `.env.local`:

```
VITE_GHG_WEBAPP_URL=https://script.google.com/macros/s/AKfy.../exec
```

Then rebuild and redeploy the portal:

```bash
cd FL/Featherlite-GHG
npm run build
# Deploy the dist/ folder to Hostinger
```

After this, the Notifications page will fetch live events from Apps Script instead of mock data.

---

## Step 8 — Install the daily trigger

Run function **`setupTriggers`** in the Apps Script editor.

This installs a daily 9 am cron that runs `dailyCycleCheck()` — the main automation loop that:
- Sends Day 1 / 3 / 5 reminders to clients
- Escalates internally on Day 3 if >40% data is missing
- Notifies you on Day 7 to open Claude and run the report

You only need to run `setupTriggers()` once. To confirm it's installed:
Apps Script → **Triggers** (clock icon in the left sidebar) → you should see `dailyCycleCheck` listed as a time-driven trigger.

---

## Step 9 — Test the full cycle

Run each day's simulation from the Apps Script editor:

```
runDay0()   → Opens the cycle, sends welcome email to client
runDay1()   → Sends first reminder with missing data points listed
runDay3()   → Second reminder + escalation email if >40% missing
runDay5()   → Final reminder
runDay7()   → Sends you the "Run Claude" email with the Approve/Rework buttons
```

After Day 7, open Claude in Cowork, say `generate GHG report`, and run the Node script with the uploaded XLSX. The report publishes to Drive, emails go out, and the portal notification appears.

---

## Step 10 — Open the first real cycle

When ready to run for a real client:

1. Open the Master Google Sheet
2. Find the client row in `Master_Index`
3. Set **Cycle Start Date** (column E) to today's date
4. Set **Status** (column H) to `Collecting`
5. The daily trigger will pick it up from tomorrow morning

---

## Quick reference — what each placeholder needs

| Placeholder | Where | What to paste |
|---|---|---|
| `<<PASTE_GOOGLE_SHEET_ID>>` | `Code.gs` CONFIG | Auto-filled by `bootstrapPlatform()` |
| `<<PASTE_DRIVE_ROOT_FOLDER_ID>>` | `Code.gs` CONFIG | Drive folder ID from Step 3 |
| `<<PASTE_APPROVAL_FORM_ID>>` | `Code.gs` CONFIG | Google Form ID from Step 4 |
| `<<PASTE_WEB_APP_URL_HERE>>` | `generate_ghg_report.js` | Apps Script `/exec` URL from Step 5 |
| `VITE_GHG_WEBAPP_URL` | Portal `.env.local` | Same `/exec` URL from Step 5 |
| `<<DRIVE_FOLDER_ID_FOS>>` | Master_Index sheet | Auto-filled by `createClientFolders()` |
| `<<DRIVE_FOLDER_ID_FP>>` | Master_Index sheet | Auto-filled by `createClientFolders()` |

---

## Generating a GHG report (Day 7 workflow)

```bash
cd FL/Featherlite-GHG/reporting-platform

# FOS (default):
node generate_ghg_report.js --file FOS_GHG_Data_FY26.xlsx

# FP:
node generate_ghg_report.js --file FP_GHG_Data_FY26.xlsx --client FL-FP-GHG-FY26

# Auto-approve without prompt:
node generate_ghg_report.js --file FOS_GHG_Data_FY26.xlsx --approve
```

The script:
1. Parses the XLSX → computes tCO₂e for all data points
2. Generates a DOCX (INTERIM if any missing, FINAL if all present)
3. Saves locally + publishes to Drive
4. Emails consultant + client (interim: flags gaps; final: delivers report)
5. If FINAL: prompts for approval → copies to `Approved/`, emails client, marks cycle Complete
