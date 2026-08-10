/**
 * Deepwoods GHG Reporting Platform — Google Apps Script
 * ─────────────────────────────────────────────────────────
 * Paste this entire file into:
 *   script.google.com → New Project → replace Code.gs
 *
 * Then:
 *   1. Edit the CONFIG block below (or update the Config sheet and set
 *      LOAD_CONFIG_FROM_SHEET = true).
 *   2. Run setupTriggers() ONCE to install the daily cron.
 *   3. Run testSendReminder() to confirm Gmail works.
 *
 * Workflow:
 *   Daily 9 am → dailyCycleCheck()
 *     → Day 1 / 3 / 5 : sendReminder()
 *     → Day 3 (>40% missing) : escalateToConsultant()
 *     → Day 7 : notifyConsultantToRunClaude()
 *   Consultant runs Claude in Cowork / Claude.ai → pastes draft into
 *   handleApprovalRequest() or submits via the linked Google Form.
 *   On Approve → saveToDrive() + emailClient() + updatePortalStatus()
 *   On Rework  → notifyConsultantRework()
 *
 * Dependencies: none (pure Apps Script, no external libraries)
 */

// ══════════════════════════════════════════════════════════════════════════════
// CONFIG — edit these or load from Config sheet
// ══════════════════════════════════════════════════════════════════════════════
const LOAD_CONFIG_FROM_SHEET = false;   // set true to read from Config tab

const CONFIG = {
  MASTER_SHEET_ID:        "<<PASTE_GOOGLE_SHEET_ID>>",
  MASTER_INDEX_TAB:       "Master_Index",
  GHG_DATAPOINTS_TAB:     "GHG_Datapoints",
  GRI_DATAPOINTS_TAB:     "GRI_Datapoints",
  CONFIG_TAB:             "Config",

  CONSULTANT_EMAIL:       "likhith@deepwoodsgreen.com",
  SENDER_NAME:            "Deepwoods Green — Reporting Bot",

  CYCLE_LENGTH_DAYS:      7,
  REMINDER_DAYS:          [1, 3, 5],    // days in cycle to send reminders
  ESCALATION_THRESHOLD:   0.40,         // escalate if missing% > this on Day 3
  MISSING_THRESHOLD_DAY5: 0.20,         // warn if missing% > this on Day 5

  DRIVE_ROOT_FOLDER_ID:   "1Gcx4SaoM02o7HHn3SgZ8-HS8-sfq6tta",
  REPORT_FILENAME_PATTERN: "{CLIENT_ID}_GHG_Report_{ENTITY}_{FY}_{DATE}",

  // Approval Google Form (create one with fields: ClientID, Decision, Comments)
  APPROVAL_FORM_ID:       "<<PASTE_APPROVAL_FORM_ID>>",

  // Generic platform identity — override per client deployment
  CLIENT_NAME:             "<<CLIENT_NAME>>",
  CLIENT_DELIVERY_SUBJECT: "",
};

// ══════════════════════════════════════════════════════════════════════════════
// TEST MODE — day override via ScriptProperties
// ══════════════════════════════════════════════════════════════════════════════
// In the Apps Script IDE, use the Run menu to call these functions directly.
// They store a day override in ScriptProperties so dailyCycleCheck() behaves
// as if it is running on that cycle day — no waiting required.

/** Set the simulated cycle day for ALL clients. Call from Run menu. */
function setTestDay0() { _setDay(0); }
function setTestDay1() { _setDay(1); }
function setTestDay3() { _setDay(3); }
function setTestDay5() { _setDay(5); }
function setTestDay7() { _setDay(7); }

function _setDay(n) {
  PropertiesService.getScriptProperties().setProperty("DAY_OVERRIDE", n.toString());
  Logger.log(`🧪 TEST MODE: cycle day forced to ${n}. Run dailyCycleCheck() to simulate.`);
}

/** Clear the override and return to real date-based calculation. */
function clearTestDay() {
  PropertiesService.getScriptProperties().deleteProperty("DAY_OVERRIDE");
  Logger.log("✅ Day override cleared — back to real date calculation.");
}

/** Read the current override (null if not set). */
function getTestDay() {
  const v = PropertiesService.getScriptProperties().getProperty("DAY_OVERRIDE");
  return v !== null ? parseInt(v) : null;
}

/**
 * One-shot test runner: set day N, run the full cycle check, then report.
 * Example: runTestDay(7) — simulates Day 7 for all clients.
 */
function runTestDay(n) {
  _setDay(n);
  Logger.log(`\n${"═".repeat(60)}\n🧪 SIMULATING DAY ${n}\n${"═".repeat(60)}`);
  dailyCycleCheck();
  clearTestDay();
  Logger.log(`${"═".repeat(60)}\nDone. Check emails + Sheets for results.\n`);
}

// Convenience wrappers callable from the Run menu
function runDay0() { runTestDay(0); }
function runDay1() { runTestDay(1); }
function runDay3() { runTestDay(3); }
function runDay5() { runTestDay(5); }
function runDay7() { runTestDay(7); }

/** Reset a client's cycle start to TODAY so real dates align with Day 0. */
function resetCycleToToday() {
  const clients = getClientRows();
  const sheet   = getTab(getConfig().MASTER_INDEX_TAB);
  const data    = sheet.getDataRange().getValues();
  clients.forEach((row, i) => {
    const clientId = row[IDX.CLIENT_ID - 1];
    if (!clientId) return;
    // Row in sheet = i + 4 (3 header rows + 1-based)
    sheet.getRange(i + 4, IDX.CYCLE_START).setValue(new Date());
    sheet.getRange(i + 4, IDX.STATUS).setValue("Collecting");
    Logger.log(`Reset cycle start to today for ${clientId}`);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// COLUMN INDEX — Master_Index sheet (1-based, matches the XLSX schema)
// ══════════════════════════════════════════════════════════════════════════════
const IDX = {
  CLIENT_ID:         1,
  ENTITY_NAME:       2,
  FRAMEWORK:         3,
  FISCAL_YEAR:       4,
  CYCLE_START:       5,
  CYCLE_DAY:         6,
  COMPLETION_PCT:    7,
  STATUS:            8,
  CONSULTANT_EMAIL:  9,
  CLIENT_EMAIL:      10,
  DRIVE_FOLDER_ID:   11,
  NOTES:             12,
  REPORT_URL:        13,   // Drive link to latest generated report
  REPORT_STATUS:     14,   // "Interim" | "Final" | "Approved"
};

// GHG_Datapoints column index
const GHG = {
  DP_ID:         1,
  ENTITY_ID:     2,
  SCOPE:         3,
  SUBCAT:        4,
  NAME:          5,
  UNIT:          6,
  VALUE:         7,
  STATUS:        8,    // "Collected" | "Missing" | "Estimated"
  SOURCE:        9,
  SUBMITTED_BY:  10,
  SUBMITTED_DATE:11,
  PRIOR_YEAR:    12,
  NOTES:         13,
};


// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Load config from Config sheet if LOAD_CONFIG_FROM_SHEET is true.
 *  Also auto-applies the bootstrapped sheet ID from ScriptProperties. */
function getConfig() {
  // Auto-resolve bootstrapped sheet ID so you don't have to copy-paste it
  const bootId = PropertiesService.getScriptProperties().getProperty("BOOTSTRAPPED_SHEET_ID");
  if (bootId && CONFIG.MASTER_SHEET_ID === "<<PASTE_GOOGLE_SHEET_ID>>") {
    CONFIG.MASTER_SHEET_ID = bootId;
  }
  if (!LOAD_CONFIG_FROM_SHEET) return CONFIG;
  const ss   = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
  const cfg  = ss.getSheetByName(CONFIG.CONFIG_TAB);
  const rows = cfg.getDataRange().getValues();
  const out  = Object.assign({}, CONFIG);
  rows.forEach(([key, val]) => { if (key && key !== "__SECTION__") out[key] = val; });
  return out;
}

/** Returns the client name for email subjects — falls back to "GHG Reporting". */
function getClientName() {
  const name = getConfig().CLIENT_NAME || "";
  return (name && name !== "<<CLIENT_NAME>>") ? name : "GHG Reporting";
}

/** Open the master spreadsheet. */
function getMasterSS() {
  return SpreadsheetApp.openById(getConfig().MASTER_SHEET_ID);
}

/** Return all client rows from Master_Index (skips header rows 1-3). */
function getClientRows() {
  const ss    = getMasterSS();
  const sheet = ss.getSheetByName(getConfig().MASTER_INDEX_TAB);
  const data  = sheet.getDataRange().getValues();
  // Rows 0-2 are title / sub-header / column-headers
  return data.slice(3).filter(r => r[IDX.CLIENT_ID - 1]);
}

/** Return the sheet object for a given tab name. */
function getTab(tabName) {
  return getMasterSS().getSheetByName(tabName);
}

/** Calculate how many days since cycle started.
 *  In test mode (DAY_OVERRIDE set), returns the override value instead. */
function cycleDay(cycleStartDate) {
  const override = getTestDay();
  if (override !== null) return override;   // 🧪 test shortcut
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(cycleStartDate);
  start.setHours(0, 0, 0, 0);
  return Math.floor((today - start) / 86400000);
}

/** Count missing data points for a given EntityID in GHG_Datapoints. */
function getMissingPoints(entityId) {
  const cfg    = getConfig();
  const sheet  = getTab(cfg.GHG_DATAPOINTS_TAB);
  const rows   = sheet.getDataRange().getValues().slice(3); // skip 3 header rows
  return rows.filter(r =>
    r[GHG.ENTITY_ID - 1] === entityId && r[GHG.STATUS - 1] === "Missing"
  );
}

/** Return all data points for an entity, with their status. */
function getAllPoints(entityId) {
  const cfg   = getConfig();
  const sheet = getTab(cfg.GHG_DATAPOINTS_TAB);
  return sheet.getDataRange().getValues().slice(3)
    .filter(r => r[GHG.ENTITY_ID - 1] === entityId);
}

/** Calculate completion % for an entity. */
function completionPct(entityId) {
  const all     = getAllPoints(entityId);
  if (all.length === 0) return 0;
  const collected = all.filter(r => r[GHG.STATUS - 1] === "Collected").length;
  return collected / all.length;
}

/** Format a date as DD-MMM-YYYY. */
function fmtDate(d) {
  return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), "dd-MMM-yyyy");
}

/** Replace tokens in filename pattern. */
function buildFilename(pattern, entity, fy) {
  return pattern
    .replace("{ENTITY}", entity.replace(/\s+/g, "_"))
    .replace("{FY}",     fy)
    .replace("{DATE}",   Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd"));
}

/** Send an email via GmailApp. */
function sendEmail(to, subject, htmlBody, attachments) {
  const cfg = getConfig();
  const opts = {
    name:     cfg.SENDER_NAME,
    htmlBody: htmlBody,
  };
  if (attachments && attachments.length) opts.attachments = attachments;
  GmailApp.sendEmail(to, subject, "", opts);
  Logger.log(`📧 Email sent to ${to} | Subject: ${subject}`);
}

/** Get or create a Drive sub-folder under the root. */
function getClientDriveFolder(clientDriveFolderId) {
  if (clientDriveFolderId && clientDriveFolderId !== "<<DRIVE_FOLDER_ID_FP>>"
      && clientDriveFolderId !== "<<DRIVE_FOLDER_ID_FOS>>") {
    return DriveApp.getFolderById(clientDriveFolderId);
  }
  // Fallback: use root folder
  return DriveApp.getFolderById(getConfig().DRIVE_ROOT_FOLDER_ID);
}

/** Update a column value for a given clientId row in Master_Index. */
function updateIndexCell(clientId, colIndex, value) {
  const sheet = getTab(getConfig().MASTER_INDEX_TAB);
  const data  = sheet.getDataRange().getValues();
  for (let i = 3; i < data.length; i++) {
    if (data[i][IDX.CLIENT_ID - 1] === clientId) {
      sheet.getRange(i + 1, colIndex).setValue(value);
      return;
    }
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// CORE WORKFLOW FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * ENTRY POINT — runs daily at 9 am via time trigger.
 * Checks every client row and dispatches the right action for each cycle day.
 */
function dailyCycleCheck() {
  const cfg     = getConfig();
  const clients = getClientRows();

  clients.forEach(row => {
    const clientId     = row[IDX.CLIENT_ID     - 1];
    const entityName   = row[IDX.ENTITY_NAME   - 1];
    const fy           = row[IDX.FISCAL_YEAR   - 1];
    const cycleStart   = row[IDX.CYCLE_START   - 1];
    const status       = row[IDX.STATUS        - 1];
    const consultEmail = row[IDX.CONSULTANT_EMAIL - 1] || cfg.CONSULTANT_EMAIL;
    const clientEmail  = row[IDX.CLIENT_EMAIL  - 1];
    const driveFolderId= row[IDX.DRIVE_FOLDER_ID - 1];

    if (!cycleStart) return;                       // cycle not started yet
    if (status === "Complete") return;             // already done

    const day = cycleDay(cycleStart);
    const pct = completionPct(clientId);
    const missing = getMissingPoints(clientId);

    Logger.log(`[${clientId}] Day ${day} | ${(pct*100).toFixed(0)}% complete | ${missing.length} missing`);

    // Day 1, 3, 5 — reminder emails
    if (cfg.REMINDER_DAYS.includes(day)) {
      sendReminder(clientId, entityName, fy, clientEmail, missing, day);
    }

    // Day 3 — internal escalation if heavily missing
    if (day === 3 && (1 - pct) > cfg.ESCALATION_THRESHOLD) {
      escalateToConsultant(clientId, entityName, fy, pct, missing, consultEmail);
    }

    // Day 5 — final warning if still critically missing
    if (day === 5 && (1 - pct) > cfg.MISSING_THRESHOLD_DAY5) {
      sendDay5Warning(clientId, entityName, fy, pct, consultEmail);
    }

    // Day 7 — cycle closes, notify consultant to run Claude
    if (day >= cfg.CYCLE_LENGTH_DAYS && status !== "Approval Pending" && status !== "Complete") {
      notifyConsultantToRunClaude(clientId, entityName, fy, pct, missing, consultEmail, driveFolderId);
      updateIndexCell(clientId, IDX.STATUS, "Approval Pending");
    }
  });
}


/**
 * Send a targeted data-collection reminder to the client contact.
 * Lists only the specific missing data points — not a generic nudge.
 */
function sendReminder(clientId, entityName, fy, toEmail, missingPoints, dayNumber) {
  if (!toEmail) { Logger.log(`No client email for ${clientId} — skipping reminder`); return; }

  const missingList = missingPoints.map(r =>
    `<li><strong>${r[GHG.SCOPE - 1]} — ${r[GHG.SUBCAT - 1]}</strong>: ` +
    `${r[GHG.NAME - 1]} (${r[GHG.UNIT - 1]})</li>`
  ).join("");

  const totalPoints = getAllPoints(clientId).length;
  const pct = ((totalPoints - missingPoints.length) / totalPoints * 100).toFixed(0);

  const subject = `[${getClientName()} GHG FY${fy}] Data Collection — Day ${dayNumber} Reminder`;
  const body = `
    <div style="font-family:Arial,sans-serif;color:#1E293B;max-width:600px">
      <div style="background:#1E6F5C;padding:18px 24px;border-radius:6px 6px 0 0">
        <h2 style="color:#fff;margin:0;font-size:16px">${getClientName()} GHG Reporting — FY${fy}</h2>
        <p style="color:#E6F4EF;margin:4px 0 0;font-size:13px">Data Collection — Day ${dayNumber} of 7</p>
      </div>
      <div style="border:1px solid #E2E8F0;border-top:none;padding:24px;border-radius:0 0 6px 6px">
        <p>Hello,</p>
        <p>This is a reminder that we are currently collecting GHG data for <strong>${entityName}</strong>
           for fiscal year <strong>${fy}</strong>.</p>
        <p>Your current submission is <strong>${pct}% complete</strong>. The following
           ${missingPoints.length} data point${missingPoints.length !== 1 ? "s are" : " is"} still outstanding:</p>
        <ul style="background:#FEF2F2;border-left:4px solid #D90429;padding:12px 12px 12px 32px;
                   border-radius:4px;line-height:1.8">
          ${missingList || "<li>No missing points — all collected!</li>"}
        </ul>
        <p>Please submit your data via the portal or reply to this email with the values.</p>
        <p style="color:#6B7280;font-size:12px;margin-top:32px;border-top:1px solid #E2E8F0;padding-top:12px">
          Data collection closes on Day 7. Questions? Reply to this email or contact your
          Deepwoods Green consultant.
        </p>
      </div>
    </div>`;

  sendEmail(toEmail, subject, body);
  Logger.log(`Reminder (Day ${dayNumber}) sent to ${toEmail} for ${clientId}`);
}


/**
 * Internal escalation — sent to consultant when >40% of data is missing on Day 3.
 */
function escalateToConsultant(clientId, entityName, fy, pct, missingPoints, consultEmail) {
  const pctMissing = ((1 - pct) * 100).toFixed(0);
  const subject = `⚠️ [${getClientName()} GHG] Internal Escalation — ${entityName} ${fy} (${pctMissing}% missing)`;
  const missingList = missingPoints.map(r =>
    `<li>${r[GHG.SCOPE - 1]}: ${r[GHG.NAME - 1]}</li>`
  ).join("");

  const body = `
    <div style="font-family:Arial,sans-serif;color:#1E293B;max-width:600px">
      <div style="background:#D97706;padding:18px 24px;border-radius:6px 6px 0 0">
        <h2 style="color:#fff;margin:0;font-size:16px">Internal Escalation — Action May Be Needed</h2>
        <p style="color:#FEF9C3;margin:4px 0 0;font-size:13px">${entityName} · ${fy} · Day 3</p>
      </div>
      <div style="border:1px solid #E2E8F0;border-top:none;padding:24px;border-radius:0 0 6px 6px">
        <p><strong>${pctMissing}%</strong> of data points are still outstanding for
           <strong>${entityName}</strong>. This exceeds the 40% escalation threshold.</p>
        <p>Consider calling the client contact directly. Missing data points:</p>
        <ul>${missingList}</ul>
        <p style="color:#6B7280;font-size:12px">ClientID: ${clientId}</p>
      </div>
    </div>`;

  sendEmail(consultEmail, subject, body);
}


/**
 * Day 5 final warning to consultant — data still critically missing.
 */
function sendDay5Warning(clientId, entityName, fy, pct, consultEmail) {
  const pctMissing = ((1 - pct) * 100).toFixed(0);
  const subject = `🔴 [${getClientName()} GHG] Day 5 Warning — ${entityName} ${fy} — Decide: Extend or Estimate`;
  const body = `
    <div style="font-family:Arial,sans-serif;color:#1E293B;max-width:600px">
      <p>Day 5 check for <strong>${entityName} ${fy}</strong>: <strong>${pctMissing}%</strong>
         of data is still missing.</p>
      <p><strong>Action required:</strong> Please decide whether to:<br>
         (a) Extend the collection window by emailing the client, or<br>
         (b) Proceed with prior-year estimates for the missing points and flag them as "Estimated" in the sheet.</p>
      <p style="color:#6B7280;font-size:12px">ClientID: ${clientId}</p>
    </div>`;
  sendEmail(consultEmail, subject, body);
}


/**
 * Day 7 — notify consultant that data collection is closed.
 * They should now open Claude (Cowork / Claude.ai) and generate the report.
 */
function notifyConsultantToRunClaude(clientId, entityName, fy, pct, missingPoints,
                                      consultEmail, driveFolderId) {
  const pctComplete = (pct * 100).toFixed(0);
  const cfg         = getConfig();
  const sheetUrl    = `https://docs.google.com/spreadsheets/d/${cfg.MASTER_SHEET_ID}`;
  const missingNote = missingPoints.length > 0
    ? `<p>⚠️ ${missingPoints.length} data point(s) marked <strong>Missing</strong> —
       flag as Estimated or leave blank in the report with a disclosure note.</p>`
    : `<p>✅ All data points collected — ready for a clean report.</p>`;

  const subject = `[${getClientName()} GHG] Day 7 — Run Claude to Generate Report — ${entityName} ${fy}`;
  const body = `
    <div style="font-family:Arial,sans-serif;color:#1E293B;max-width:640px">
      <div style="background:#1E6F5C;padding:18px 24px;border-radius:6px 6px 0 0">
        <h2 style="color:#fff;margin:0;font-size:16px">Report Generation — Your Action Required</h2>
        <p style="color:#E6F4EF;margin:4px 0 0;font-size:13px">${entityName} · ${fy} · Day 7</p>
      </div>
      <div style="border:1px solid #E2E8F0;border-top:none;padding:24px;border-radius:0 0 6px 6px">
        <p>Data collection for <strong>${entityName}</strong> has closed.
           <strong>${pctComplete}%</strong> of data points are collected.</p>
        ${missingNote}
        <p><strong>Next steps:</strong></p>
        <ol>
          <li>Open <a href="${sheetUrl}">the master spreadsheet</a> and review the GHG_Datapoints tab.</li>
          <li>Open Claude (Cowork or Claude.ai). Load the client GHG Project.</li>
          <li>Copy the collected data from the sheet and paste into Claude using the
              GHG Report Generation prompt.</li>
          <li>Review the draft. Once satisfied, use the approval link below to submit it.</li>
        </ol>
        <p>
          <a href="https://docs.google.com/forms/d/${cfg.APPROVAL_FORM_ID}/viewform?usp=pp_url&entry.clientId=${clientId}"
             style="background:#1E6F5C;color:#fff;padding:10px 20px;border-radius:4px;
                    text-decoration:none;font-weight:bold;display:inline-block;margin-top:8px">
            ✅ Submit Approved Report
          </a>
          &nbsp;&nbsp;
          <a href="https://docs.google.com/forms/d/${cfg.APPROVAL_FORM_ID}/viewform?usp=pp_url&entry.clientId=${clientId}&entry.decision=rework"
             style="background:#D97706;color:#fff;padding:10px 20px;border-radius:4px;
                    text-decoration:none;font-weight:bold;display:inline-block;margin-top:8px">
            🔄 Request Rework
          </a>
        </p>
        <p style="color:#6B7280;font-size:12px;margin-top:24px">
          ClientID: ${clientId} | Drive Folder: ${driveFolderId}
        </p>
      </div>
    </div>`;

  sendEmail(consultEmail, subject, body);
}


// ══════════════════════════════════════════════════════════════════════════════
// APPROVAL FORM TRIGGER
// Wire this to the Approval Google Form's "On form submit" trigger.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Called when consultant submits the Approval Form.
 * Form fields expected:
 *   - clientId   (text)  — e.g. "FL-FP-GHG-FY26"
 *   - decision   (dropdown) — "Approve" | "Rework"
 *   - reportText (paragraph) — the Claude-generated report draft (plain text)
 *   - comments   (paragraph) — rework comments (if decision = Rework)
 */
function onApprovalFormSubmit(e) {
  const responses = e.namedValues;
  const clientId   = (responses["Client ID"]      || [""])[0].trim();
  const decision   = (responses["Decision"]       || [""])[0].trim();
  const reportText = (responses["Report Draft"]   || [""])[0].trim();
  const comments   = (responses["Rework Comments"]|| [""])[0].trim();

  Logger.log(`Approval form: ${clientId} | ${decision}`);

  if (decision === "Approve") {
    handleApprove(clientId, reportText);
  } else if (decision === "Rework") {
    handleRework(clientId, comments);
  } else {
    Logger.log(`Unknown decision value: "${decision}"`);
  }
}


/**
 * Consultant approved — save to Drive, email client, update status.
 */
function handleApprove(clientId, reportText) {
  const cfg     = getConfig();
  const clients = getClientRows();
  const row     = clients.find(r => r[IDX.CLIENT_ID - 1] === clientId);
  if (!row) { Logger.log(`Client ${clientId} not found`); return; }

  const entityName   = row[IDX.ENTITY_NAME    - 1];
  const fy           = row[IDX.FISCAL_YEAR    - 1];
  const clientEmail  = row[IDX.CLIENT_EMAIL   - 1];
  const driveFolderId= row[IDX.DRIVE_FOLDER_ID - 1];

  // 1. Save report to Google Drive as a Google Doc
  const folder   = getClientDriveFolder(driveFolderId);
  const filename = buildFilename(cfg.REPORT_FILENAME_PATTERN, entityName, fy);
  const blob     = Utilities.newBlob(reportText, "text/plain", filename + ".txt");
  const file     = folder.createFile(blob);
  const fileUrl  = file.getUrl();
  Logger.log(`Report saved to Drive: ${fileUrl}`);

  // 2. Email client with report attached
  const clientSubject = cfg.CLIENT_DELIVERY_SUBJECT ||
    `Your ${getClientName()} GHG Report — ${fy}`;
  const clientBody = `
    <div style="font-family:Arial,sans-serif;color:#1E293B;max-width:600px">
      <div style="background:#1E6F5C;padding:18px 24px;border-radius:6px 6px 0 0">
        <h2 style="color:#fff;margin:0;font-size:16px">Your GHG Report is Ready</h2>
        <p style="color:#E6F4EF;margin:4px 0 0;font-size:13px">${entityName} · ${fy}</p>
      </div>
      <div style="border:1px solid #E2E8F0;border-top:none;padding:24px;border-radius:0 0 6px 6px">
        <p>Dear ${entityName} team,</p>
        <p>Your GHG Emissions Report for <strong>${fy}</strong> has been prepared and approved.
           Please find it attached to this email.</p>
        <p>The report covers Scope 1, Scope 2, and Scope 3 emissions in accordance with the
           GHG Protocol Corporate Accounting and Reporting Standard.</p>
        <p>Please reach out to your Deepwoods Green consultant with any questions.</p>
        <p style="margin-top:32px">Warm regards,<br>
           <strong>Deepwoods Green Consulting</strong></p>
      </div>
    </div>`;

  sendEmail(clientEmail, clientSubject, clientBody, [blob]);

  // 3. Update Master_Index status → Complete
  updateIndexCell(clientId, IDX.STATUS, "Complete");
  Logger.log(`Status updated to Complete for ${clientId}`);
}


/**
 * Consultant requested rework — notify them with comments, ready for another Claude session.
 */
function handleRework(clientId, comments) {
  const cfg      = getConfig();
  const clients  = getClientRows();
  const row      = clients.find(r => r[IDX.CLIENT_ID - 1] === clientId);
  if (!row) return;

  const entityName    = row[IDX.ENTITY_NAME   - 1];
  const fy            = row[IDX.FISCAL_YEAR   - 1];
  const consultEmail  = row[IDX.CONSULTANT_EMAIL - 1] || cfg.CONSULTANT_EMAIL;

  const subject = `[${getClientName()} GHG] Rework Requested — ${entityName} ${fy}`;
  const body = `
    <div style="font-family:Arial,sans-serif;color:#1E293B;max-width:600px">
      <p>The draft for <strong>${entityName} ${fy}</strong> has been sent back for rework.</p>
      <p><strong>Rework comments:</strong></p>
      <blockquote style="border-left:4px solid #D97706;padding:8px 16px;background:#FFF9C4;
                         border-radius:4px;font-style:italic">
        ${comments || "No specific comments provided."}
      </blockquote>
      <p>Please re-run the Claude session with these comments in mind, then re-submit
         via the approval form.</p>
    </div>`;

  sendEmail(consultEmail, subject, body);
  updateIndexCell(clientId, IDX.STATUS, "Rework");
  Logger.log(`Rework notification sent for ${clientId}`);
}


// ══════════════════════════════════════════════════════════════════════════════
// SETUP — run these once manually
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Install the daily time trigger. Run this ONCE after deployment.
 * Deletes any existing triggers with the same function name first.
 */
function setupTriggers() {
  // Remove existing dailyCycleCheck triggers
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "dailyCycleCheck")
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Create new daily trigger at 9 am
  ScriptApp.newTrigger("dailyCycleCheck")
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();

  Logger.log("✅ Daily 9 am trigger installed for dailyCycleCheck()");
}

/**
 * Wire the Approval Form submit trigger. Run ONCE after setting APPROVAL_FORM_ID.
 */
function setupApprovalFormTrigger() {
  const cfg  = getConfig();
  const form = FormApp.openById(cfg.APPROVAL_FORM_ID);
  ScriptApp.newTrigger("onApprovalFormSubmit")
    .forForm(form)
    .onFormSubmit()
    .create();
  Logger.log("✅ Approval form submit trigger installed");
}


// ══════════════════════════════════════════════════════════════════════════════
// TEST HELPERS — run these in the Apps Script IDE to verify setup
// ══════════════════════════════════════════════════════════════════════════════

/** Quick test: print all client rows to the log. */
function testReadClients() {
  const rows = getClientRows();
  rows.forEach(r => Logger.log(JSON.stringify(r)));
}

/** Quick test: send a reminder for the first client in the sheet. */
function testSendReminder() {
  const rows    = getClientRows();
  if (!rows.length) { Logger.log("No client rows found"); return; }
  const row     = rows[0];
  const missing = getMissingPoints(row[IDX.CLIENT_ID - 1]);
  sendReminder(
    row[IDX.CLIENT_ID    - 1],
    row[IDX.ENTITY_NAME  - 1],
    row[IDX.FISCAL_YEAR  - 1],
    row[IDX.CLIENT_EMAIL - 1],
    missing,
    1
  );
}

/** Simulate Day 7 notification for the first client. */
function testDay7Notification() {
  const cfg  = getConfig();
  const rows = getClientRows();
  if (!rows.length) return;
  const row  = rows[0];
  notifyConsultantToRunClaude(
    row[IDX.CLIENT_ID      - 1],
    row[IDX.ENTITY_NAME    - 1],
    row[IDX.FISCAL_YEAR    - 1],
    0.85,
    getMissingPoints(row[IDX.CLIENT_ID - 1]),
    cfg.CONSULTANT_EMAIL,
    row[IDX.DRIVE_FOLDER_ID - 1]
  );
}

/** Simulate an approval for a given clientId — pass a short report text. */
function testApprove() {
  handleApprove("FL-FP-GHG-FY26", "SAMPLE REPORT TEXT\n\nScope 1: 45.2 tCO2e\nScope 2: 12.1 tCO2e");
}


// ══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP — run bootstrapPlatform() ONCE on a fresh script to:
//   1. Create the Google Sheet with all tabs, headers, formatting
//   2. Push FOS test data (collected + missing flags)
//   3. Install the daily trigger + note the Sheet ID
// ══════════════════════════════════════════════════════════════════════════════

/**
 * ONE-SHOT SETUP.  Run this from the Apps Script IDE Run menu.
 * It creates a new Google Sheet, populates all tabs with schema + FOS test data,
 * stores the sheet ID in ScriptProperties (so getConfig() picks it up automatically),
 * and installs the daily 9 am cron.
 *
 * Safe to re-run: it skips sheet creation if the ID is already stored.
 */
function bootstrapPlatform() {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty("BOOTSTRAPPED_SHEET_ID");

  let ss;
  if (sheetId) {
    ss = SpreadsheetApp.openById(sheetId);
    Logger.log(`♻️  Sheet already exists: ${ss.getUrl()}`);
  } else {
    ss = SpreadsheetApp.create(getClientName() + " GHG Reporting Platform — Master Data");
    sheetId = ss.getId();
    props.setProperty("BOOTSTRAPPED_SHEET_ID", sheetId);
    props.setProperty("MASTER_SHEET_ID",        sheetId);
    Logger.log(`✅ Created sheet: ${ss.getUrl()}`);
  }

  _buildMasterIndex(ss);
  _buildGHGDatapoints(ss);
  _buildGRIDatapoints(ss);
  _buildConfig(ss);
  _buildNotifications(ss);
  _buildDataSubmissions(ss);

  // Remove the default "Sheet1" if it still exists
  const sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1) ss.deleteSheet(sheet1);

  // Install daily trigger
  setupTriggers();

  Logger.log("═".repeat(60));
  Logger.log("🎉 Bootstrap complete!");
  Logger.log(`   Sheet URL : ${ss.getUrl()}`);
  Logger.log(`   Sheet ID  : ${sheetId}`);
  Logger.log("   Next: paste the Sheet ID into CONFIG.MASTER_SHEET_ID,");
  Logger.log("         create the Approval Form, then run setupApprovalFormTrigger()");
  Logger.log("═".repeat(60));
}

// ── Internal sheet builders ───────────────────────────────────────────────────

const GRN  = "#1E6F5C";  // header fill
const GRN_L= "#E6F4EF";  // alt row
const WHT  = "#FFFFFF";
const YLW  = "#FFF9C4";  // user input
const RED_L= "#FEE2E2";  // missing
const RED_T= "#D90429";

function _hdr(ss_or_sheet, range, text, bg, fg, bold, fontSize) {
  const r = range.getCell(1, 1);
  r.setValue(text);
  r.setBackground(bg || GRN).setFontColor(fg || WHT)
   .setFontWeight(bold !== false ? "bold" : "normal")
   .setFontSize(fontSize || 10)
   .setFontFamily("Arial")
   .setVerticalAlignment("middle")
   .setWrap(true);
}

function _row(sheet, r, values, bg) {
  values.forEach((v, ci) => {
    const cell = sheet.getRange(r, ci + 1);
    cell.setValue(v === null ? "" : v);
    if (bg) cell.setBackground(bg);
    cell.setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle").setWrap(true);
  });
}

function _colWidths(sheet, widths) {
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

function _freeze(sheet, rows, cols) {
  sheet.setFrozenRows(rows);
  if (cols) sheet.setFrozenColumns(cols);
}

function _buildMasterIndex(ss) {
  let ws = ss.getSheetByName("Master_Index");
  if (!ws) ws = ss.insertSheet("Master_Index");
  ws.clearContents().clearFormats();

  // Title
  ws.getRange("A1:N1").merge().setValue("FEATHERLITE GHG REPORTING PLATFORM — MASTER INDEX")
    .setBackground(GRN).setFontColor(WHT).setFontWeight("bold").setFontSize(12)
    .setFontFamily("Arial").setHorizontalAlignment("center").setVerticalAlignment("middle");
  ws.setRowHeight(1, 30);

  // Sub-header
  ws.getRange("A2:N2").merge()
    .setValue("One row per entity × framework × fiscal year.  Yellow = editable.  GREEN = formula.")
    .setFontFamily("Arial").setFontSize(9).setFontColor("#555555").setFontStyle("italic");

  // Column headers
  const hdrs = ["ClientID","Entity Name","Framework","Fiscal Year","Cycle Start Date",
                 "Cycle Day","Completion %","Status","Consultant Email","Client Email",
                 "Drive Folder ID","Notes","Report URL","Report Status"];
  hdrs.forEach((h, i) => {
    ws.getRange(3, i + 1).setValue(h)
      .setBackground(GRN).setFontColor(WHT).setFontWeight("bold")
      .setFontFamily("Arial").setFontSize(10).setHorizontalAlignment("center").setWrap(true);
  });
  ws.setRowHeight(3, 28);

  // Data rows
  const today = new Date();
  const rows = [
    ["FL-FOS-GHG-FY26","Featherlite Office Systems Pvt. Ltd","GHG","FY2026",
      today, null, null, "Collecting",
      "likhith@deepwoodsgreen.com","test-fos@featherlite.com",
      "<<DRIVE_FOLDER_ID_FOS>>","TEST — FOS pilot cycle"],
    ["FL-FP-GHG-FY26","Featherlite Products Pvt. Ltd","GHG","FY2026",
      today, null, null, "Collecting",
      "likhith@deepwoodsgreen.com","ghg@featherlite.com",
      "<<DRIVE_FOLDER_ID_FP>>","Pilot entity"],
  ];
  rows.forEach((row, ri) => {
    const r = ri + 4;
    row.forEach((v, ci) => {
      const cell = ws.getRange(r, ci + 1);
      cell.setValue(v === null ? "" : v);
      cell.setBackground(ri % 2 === 0 ? WHT : GRN_L)
          .setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");
    });
    // Formulas for Cycle Day and Completion %
    ws.getRange(r, 6).setFormula(`=IF(E${r}="","",TODAY()-E${r})`);
    ws.getRange(r, 7).setFormula(
      `=IFERROR(COUNTIF(GHG_Datapoints!H:H,"Collected")/COUNTA(GHG_Datapoints!B:B)-1,0)`
    ).setNumberFormat("0%");
    // Yellow input cells
    [5, 9, 10, 11].forEach(c => ws.getRange(r, c).setBackground(YLW));
    ws.getRange(r, 5).setNumberFormat("DD-MMM-YYYY");
  });

  _colWidths(ws, [22, 36, 10, 10, 16, 10, 13, 14, 30, 30, 28, 28, 36, 14].map(w => w * 7));
  _freeze(ws, 3);   // rows only — merged title row prevents column freeze
  Logger.log("  ✓ Master_Index built");
}

function _buildGHGDatapoints(ss) {
  let ws = ss.getSheetByName("GHG_Datapoints");
  if (!ws) ws = ss.insertSheet("GHG_Datapoints");
  ws.clearContents().clearFormats();

  ws.getRange("A1:M1").merge()
    .setValue("GHG DATA POINTS — FOS (TEST) — FY2026")
    .setBackground(GRN).setFontColor(WHT).setFontWeight("bold").setFontSize(12)
    .setFontFamily("Arial").setHorizontalAlignment("center").setVerticalAlignment("middle");
  ws.setRowHeight(1, 30);

  ws.getRange("A2:M2").merge()
    .setValue("Status: Collected | Missing | Estimated   |   Yellow cells = data entry   |   Rem: HFC fugitive data only available from FY25 onwards")
    .setFontFamily("Arial").setFontSize(9).setFontColor("#555555").setFontStyle("italic");

  const hdrs = ["DatapointID","EntityID","Scope","Sub-category","Data Point Name",
                 "Unit","Value (FY26)","Status","Source / Reference",
                 "Submitted By","Submitted Date","Prior Year Value (FY25)","Notes"];
  hdrs.forEach((h, i) => {
    ws.getRange(3, i + 1).setValue(h)
      .setBackground(GRN).setFontColor(WHT).setFontWeight("bold")
      .setFontFamily("Arial").setFontSize(10).setHorizontalAlignment("center").setWrap(true);
  });
  ws.setRowHeight(3, 28);

  // FOS GHG data points — verified values from source workbooks (FY25 as prior year)
  // Status: "Collected" if FY26 value is known; "Missing" if still awaiting submission
  const points = [
    // Scope 1 — Stationary Combustion
    ["GHG-S1-FOS-001","FL-FOS-GHG-FY26","Scope 1","Stationary Combustion",
     "Diesel — FOS DG sets (all locations)","L", null,"Missing","","","",29308.00,"FY25: 29,308 L"],
    ["GHG-S1-FOS-002","FL-FOS-GHG-FY26","Scope 1","Stationary Combustion",
     "Diesel — FOS PC oven (Kumbalagodu)","L", null,"Missing","","","",10830.00,"FY25: 10,830 L"],
    ["GHG-S1-FOS-003","FL-FOS-GHG-FY26","Scope 1","Stationary Combustion",
     "LPG — FOS (Kumbalagodu)","kg", null,"Missing","","","",6745.00,"FY25: 6,745 kg"],
    // Scope 1 — Mobile Combustion
    ["GHG-S1-FOS-004","FL-FOS-GHG-FY26","Scope 1","Mobile Combustion",
     "Diesel — FOS vehicles (Hejjala)","L", null,"Missing","","","",22550.00,"FY25: 22,550 L"],
    ["GHG-S1-FOS-005","FL-FOS-GHG-FY26","Scope 1","Mobile Combustion",
     "Diesel — FOS forklifts (Hejjala + Sriperumbudur)","L", null,"Missing","","","",9120.00,"FY25: 9,120 L"],
    // Scope 1 — Fugitive
    ["GHG-S1-FOS-006","FL-FOS-GHG-FY26","Scope 1","Fugitive",
     "CO₂ — FOS welding cylinders (Hejjala + Deepanjali)","kg", null,"Missing","","","",10943.00,"FY25: 10,943 kg"],
    ["GHG-S1-FOS-007","FL-FOS-GHG-FY26","Scope 1","Fugitive",
     "CO₂ — FOS fire extinguishers (all locations)","kg", null,"Missing","","","",148.60,"FY25: 148.60 kg"],
    ["GHG-S1-FOS-008","FL-FOS-GHG-FY26","Scope 1","Fugitive",
     "HFC foam blowing agents — Hejjala (S1-HFC-01)","tCO₂e", null,"Missing","","","",3420.00,"FY25 measured; FY26 TBD"],
    ["GHG-S1-FOS-009","FL-FOS-GHG-FY26","Scope 1","Fugitive",
     "HFC foam blowing agents — Kumbalagodu (S1-HFC-02 to 05)","tCO₂e", null,"Missing","","","",9046.00,"FY25 measured; FY26 TBD"],
    // Scope 2 — Electricity
    ["GHG-S2-FOS-001","FL-FOS-GHG-FY26","Scope 2","Purchased Electricity",
     "Electricity — Hejjala plant (grid)","kWh", null,"Missing","","","",487200.00,"FY25 from BESCOM bill"],
    ["GHG-S2-FOS-002","FL-FOS-GHG-FY26","Scope 2","Purchased Electricity",
     "Electricity — Kumbalagodu plant (grid)","kWh", null,"Missing","","","",312800.00,"FY25 from BESCOM bill"],
    ["GHG-S2-FOS-003","FL-FOS-GHG-FY26","Scope 2","Purchased Electricity",
     "Electricity — Sriperumbudur plant (grid)","kWh", null,"Missing","","","",198400.00,"FY25 from TNEB bill"],
    ["GHG-S2-FOS-004","FL-FOS-GHG-FY26","Scope 2","Renewable Generation",
     "Solar generation — rooftop (if applicable)","kWh", null,"Missing","","","",0,"FY25: no rooftop solar"],
    // Scope 3
    ["GHG-S3-FOS-001","FL-FOS-GHG-FY26","Scope 3","Cat 1 Purchased Goods",
     "Raw materials — steel & hardware procurement","tonne", null,"Missing","","","",4820.00,"FY25 spend-based estimate"],
    ["GHG-S3-FOS-002","FL-FOS-GHG-FY26","Scope 3","Cat 4 Upstream Transport",
     "Freight — inbound raw materials","tonne-km", null,"Missing","","","",3449000.00,"FY25 freight invoice data"],
    ["GHG-S3-FOS-003","FL-FOS-GHG-FY26","Scope 3","Cat 6 Business Travel",
     "Business travel — air & rail (all FOS locations)","km", null,"Missing","","","",48200.00,"FY25 expense claim data"],
    ["GHG-S3-FOS-004","FL-FOS-GHG-FY26","Scope 3","Cat 7 Employee Commute",
     "Employee commute — all FOS locations","person-km", null,"Missing","","","",2140000.00,"FY25 survey estimate"],
    ["GHG-S3-FOS-005","FL-FOS-GHG-FY26","Scope 3","Cat 9 Downstream Transport",
     "Product delivery — outbound logistics","tonne-km", null,"Missing","","","",1870000.00,"FY25 logistics data"],
    ["GHG-S3-FOS-006","FL-FOS-GHG-FY26","Scope 3","Cat 11 Use of Sold Products",
     "End-use emissions — office furniture in use","tCO₂e", null,"Missing","","","",69.00,"FY25 model estimate"],
  ];

  // ── FP data points ────────────────────────────────────────────────────────
  const fpPoints = [
    // Scope 1 — Mobile Combustion
    ["GHG-S1-FP-001","FL-FP-GHG-FY26","Scope 1","Mobile Combustion",
     "Diesel — FP company vehicles (Rajanakunte)","L", null,"Missing","","","",12724.82,"FY25: 12,724.82 L"],
    // Scope 1 — Stationary Combustion
    ["GHG-S1-FP-002","FL-FP-GHG-FY26","Scope 1","Stationary Combustion",
     "Diesel — FP DG set (Rajanakunte)","L", null,"Missing","","","",4410.00,"FY25: 4,410 L"],
    // Scope 1 — Fugitive
    ["GHG-S1-FP-003","FL-FP-GHG-FY26","Scope 1","Fugitive",
     "CO₂ — FP fire extinguishers (Rajanakunte)","kg", null,"Missing","","","",31.50,"FY25: 31.50 kg"],
    // Scope 2 — Electricity
    ["GHG-S2-FP-001","FL-FP-GHG-FY26","Scope 2","Purchased Electricity",
     "Electricity — Rajanakunte (BESCOM Karnataka)","kWh", null,"Missing","","","",143720,"FY25: 143,720 kWh"],
    // Scope 2 — Renewable Generation
    ["GHG-S2-FP-002","FL-FP-GHG-FY26","Scope 2","Renewable Generation",
     "Solar generation — rooftop Rajanakunte","kWh", null,"Missing","","","",78439,"FY25: 78,439 kWh"],
    // Scope 3 — all FP-relevant categories
    ["GHG-S3-FP-001","FL-FP-GHG-FY26","Scope 3","Cat 1 Purchased Goods",
     "Purchased goods & services (spend-based tCO₂e)","tCO₂e", null,"Missing","","","",23843.49,"FY25: 23,843.49 tCO₂e"],
    ["GHG-S3-FP-002","FL-FP-GHG-FY26","Scope 3","Cat 2 Capital Goods",
     "Capital goods additions (spend-based tCO₂e)","tCO₂e", null,"Missing","","","",48.63,"FY25: 48.63 tCO₂e"],
    ["GHG-S3-FP-003","FL-FP-GHG-FY26","Scope 3","Cat 3 Fuel & Energy-Related",
     "WTT & T&D losses (tCO₂e)","tCO₂e", null,"Missing","","","",30.83,"FY25: 30.83 tCO₂e"],
    ["GHG-S3-FP-004","FL-FP-GHG-FY26","Scope 3","Cat 4 Upstream Transport",
     "Inbound freight — distance-based (tonne-km)","tonne-km", null,"Missing","","","",null,"FY25: 2,964.79 tCO₂e (FL consolidated)"],
    ["GHG-S3-FP-005","FL-FP-GHG-FY26","Scope 3","Cat 5 Waste in Operations",
     "Waste generated in operations (tCO₂e)","tCO₂e", null,"Missing","","","",1.60,"FY25: 1.60 tCO₂e"],
    ["GHG-S3-FP-006","FL-FP-GHG-FY26","Scope 3","Cat 6 Business Travel",
     "Business travel — air & rail (km)","km", null,"Missing","","","",null,"FY25: 17.03 tCO₂e"],
    ["GHG-S3-FP-007","FL-FP-GHG-FY26","Scope 3","Cat 7 Employee Commute",
     "Employee commute — Rajanakunte (person-km)","person-km", null,"Missing","","","",null,"FY25: 124.42 tCO₂e"],
    ["GHG-S3-FP-008","FL-FP-GHG-FY26","Scope 3","Cat 9 Downstream Transport",
     "Outbound logistics — distance-based (tonne-km)","tonne-km", null,"Missing","","","",null,"FY25: 1,297.69 tCO₂e"],
    ["GHG-S3-FP-009","FL-FP-GHG-FY26","Scope 3","Cat 12 End-of-Life Products",
     "End-of-life treatment of sold products (tCO₂e)","tCO₂e", null,"Missing","","","",36.22,"FY25: 36.22 tCO₂e"],
  ];
  const allPoints = [...points, ...fpPoints];

  const STATUS_BG = { Collected: "#D1FAE5", Missing: "#FEE2E2", Estimated: "#FEF9C3" };
  allPoints.forEach((row, i) => {
    const r = i + 4;
    row.forEach((v, ci) => {
      const cell = ws.getRange(r, ci + 1);
      cell.setValue(v === null ? "" : v);
      cell.setBackground(i % 2 === 0 ? WHT : GRN_L)
          .setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");
    });
    // Yellow = value, source, submitted by, submitted date
    [7, 9, 10, 11].forEach(c => ws.getRange(r, c).setBackground(YLW));
    // Status colour
    const status = row[7];
    ws.getRange(r, 8).setBackground(STATUS_BG[status] || WHT).setHorizontalAlignment("center");
    ws.getRange(r, 11).setNumberFormat("DD-MMM-YYYY");
  });

  _colWidths(ws, [140,154,70,182,336,49,98,84,224,140,112,126,196]);
  _freeze(ws, 3);
  Logger.log(`  ✓ GHG_Datapoints built (${allPoints.length} data points — 19 FOS + 14 FP, all Missing)`);
}

function _buildGRIDatapoints(ss) {
  let ws = ss.getSheetByName("GRI_Datapoints");
  if (!ws) ws = ss.insertSheet("GRI_Datapoints");
  ws.clearContents().clearFormats();

  ws.getRange("A1:L1").merge()
    .setValue("GRI DISCLOSURE DATA POINTS — FOS — FY2026")
    .setBackground(GRN).setFontColor(WHT).setFontWeight("bold").setFontSize(12)
    .setFontFamily("Arial").setHorizontalAlignment("center").setVerticalAlignment("middle");
  ws.setRowHeight(1, 30);

  const hdrs = ["DatapointID","EntityID","GRI Standard","Disclosure",
                 "Indicator Description","Unit","Value (FY26)","Status",
                 "Source / Reference","Submitted By","Submitted Date","Notes"];
  hdrs.forEach((h, i) => {
    ws.getRange(3, i + 1).setValue(h)
      .setBackground(GRN).setFontColor(WHT).setFontWeight("bold")
      .setFontFamily("Arial").setFontSize(10).setHorizontalAlignment("center").setWrap(true);
  });

  const gri = [
    ["GRI-2-FOS-001","FL-FOS-GHG-FY26","GRI 2","2-7","Employees — total by gender & type","No.",null,"Missing"],
    ["GRI-302-FOS-001","FL-FOS-GHG-FY26","GRI 302","302-1","Total energy consumption within org (FOS)","GJ",null,"Missing"],
    ["GRI-305-FOS-001","FL-FOS-GHG-FY26","GRI 305","305-1","Scope 1 GHG emissions (FOS)","tCO₂e",null,"Missing"],
    ["GRI-305-FOS-002","FL-FOS-GHG-FY26","GRI 305","305-2","Scope 2 GHG emissions — location-based (FOS)","tCO₂e",null,"Missing"],
    ["GRI-305-FOS-003","FL-FOS-GHG-FY26","GRI 305","305-3","Scope 3 GHG emissions — total (FOS)","tCO₂e",null,"Missing"],
    ["GRI-305-FOS-004","FL-FOS-GHG-FY26","GRI 305","305-4","GHG emissions intensity (tCO₂e / revenue ₹Cr)","ratio",null,"Missing"],
    ["GRI-306-FOS-001","FL-FOS-GHG-FY26","GRI 306","306-3","Waste generated — total (FOS manufacturing)","tonne",null,"Missing"],
    ["GRI-401-FOS-001","FL-FOS-GHG-FY26","GRI 401","401-1","New hires & turnover (by gender)","No. / %",null,"Missing"],
    ["GRI-403-FOS-001","FL-FOS-GHG-FY26","GRI 403","403-9","Work-related injuries — fatalities & recordable","No.",null,"Missing"],
  ];
  gri.forEach((row, i) => {
    const r = i + 4;
    row.forEach((v, ci) => {
      ws.getRange(r, ci + 1).setValue(v === null ? "" : v)
        .setBackground(i % 2 === 0 ? WHT : GRN_L)
        .setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");
    });
    [7, 9, 10, 11].forEach(c => ws.getRange(r, c).setBackground(YLW));
    ws.getRange(r, 8).setBackground("#FEE2E2").setHorizontalAlignment("center");
  });
  _freeze(ws, 3);
  Logger.log("  ✓ GRI_Datapoints built");
}

function _buildConfig(ss) {
  let ws = ss.getSheetByName("Config");
  if (!ws) ws = ss.insertSheet("Config");
  ws.clearContents().clearFormats();

  ws.getRange("A1:C1").merge()
    .setValue("PLATFORM CONFIGURATION — Read by Apps Script")
    .setBackground(GRN).setFontColor(WHT).setFontWeight("bold").setFontSize(12)
    .setFontFamily("Arial").setHorizontalAlignment("center");
  ws.setRowHeight(1, 30);

  const sheetId = PropertiesService.getScriptProperties().getProperty("BOOTSTRAPPED_SHEET_ID") || "<<ID>>";
  const cfg = [
    ["__SECTION__","EMAIL SETTINGS",""],
    ["CONSULTANT_EMAIL","likhith@deepwoodsgreen.com","Receives Day-7 notification + approval email"],
    ["SENDER_NAME","Deepwoods Green — Reporting Bot","Display name on outbound emails"],
    ["__SECTION__","CYCLE SETTINGS",""],
    ["CYCLE_LENGTH_DAYS","7","Days from window open to report delivery"],
    ["REMINDER_DAYS","1,3,5","Days on which reminders are sent"],
    ["ESCALATION_THRESHOLD","0.40","Escalate if missing% > this on Day 3"],
    ["__SECTION__","GOOGLE DRIVE",""],
    ["DRIVE_ROOT_FOLDER_ID","1Gcx4SaoM02o7HHn3SgZ8-HS8-sfq6tta","Root Drive folder ID"],
    ["REPORT_FILENAME_PATTERN","{CLIENT_ID}_GHG_Report_{ENTITY}_{FY}_{DATE}","Tokens: {CLIENT_ID} {ENTITY} {FY} {DATE}"],
    ["__SECTION__","SHEET REFERENCES",""],
    ["MASTER_SHEET_ID", sheetId,"Auto-filled by bootstrapPlatform()"],
    ["MASTER_INDEX_TAB","Master_Index","Exact tab name"],
    ["GHG_DATAPOINTS_TAB","GHG_Datapoints","Exact tab name"],
    ["GRI_DATAPOINTS_TAB","GRI_Datapoints","Exact tab name"],
    ["__SECTION__","TEST USER",""],
    ["TEST_CLIENT_ID","FL-FOS-GHG-FY26","ClientID used for test runs"],
    ["TEST_CLIENT_EMAIL","test-fos@featherlite.com","Test FOS user email (see create_test_user.sql)"],
  ];

  let row = 2;
  cfg.forEach(([key, val, note]) => {
    if (key === "__SECTION__") {
      ws.getRange(row, 1, 1, 3).merge().setValue(val)
        .setBackground(GRN).setFontColor(WHT).setFontWeight("bold")
        .setFontFamily("Arial").setFontSize(10);
    } else {
      ws.getRange(row, 1).setValue(key).setFontWeight("bold").setFontFamily("Arial").setFontSize(10);
      ws.getRange(row, 2).setValue(val).setBackground(YLW).setFontFamily("Arial").setFontSize(10);
      ws.getRange(row, 3).setValue(note).setFontColor("#666666").setFontFamily("Arial").setFontSize(9);
    }
    row++;
  });

  ws.setColumnWidth(1, 252).setColumnWidth(2, 364).setColumnWidth(3, 392);
  _freeze(ws, 1, 0);
  Logger.log("  ✓ Config tab built");
}

/**
 * Load the bootstrapped sheet ID from ScriptProperties into CONFIG at runtime.
 * Called automatically by getConfig() if LOAD_CONFIG_FROM_SHEET = false.
 */
function _applyBootstrappedId() {
  const id = PropertiesService.getScriptProperties().getProperty("BOOTSTRAPPED_SHEET_ID");
  if (id && CONFIG.MASTER_SHEET_ID === "<<PASTE_GOOGLE_SHEET_ID>>") {
    CONFIG.MASTER_SHEET_ID = id;
  }
}

// ── Patch getConfig() to auto-resolve the bootstrapped sheet ID ──────────────
// (No change to getConfig() signature — just call _applyBootstrappedId first)
const _origGetConfig = getConfig;  // eslint-disable-line no-unused-vars


// ══════════════════════════════════════════════════════════════════════════════
// DRIVE FOLDER MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Creates the full Drive folder hierarchy for every client in Master_Index.
 * Run ONCE after setting DRIVE_ROOT_FOLDER_ID in CONFIG / Config sheet.
 *
 * Structure created:
 *   <Root>/
 *     <ClientID>/
 *       Data_Submissions/
 *       Reports/
 *       Approved/
 *
 * Updates Master_Index column 11 (DRIVE_FOLDER_ID) with each client folder ID.
 */
function createClientFolders() {
  const cfg = getConfig();
  if (!cfg.DRIVE_ROOT_FOLDER_ID) {
    Logger.log("ERROR: Set DRIVE_ROOT_FOLDER_ID in CONFIG before calling createClientFolders()");
    return;
  }
  const root = DriveApp.getFolderById(cfg.DRIVE_ROOT_FOLDER_ID);
  const clients = getClientRows();
  const sheet = getTab(cfg.MASTER_INDEX_TAB);
  const data  = sheet.getDataRange().getValues();

  clients.forEach((row, i) => {
    const clientId = row[IDX.CLIENT_ID - 1];
    if (!clientId) return;

    // Create or find client folder
    const existing = root.getFoldersByName(clientId);
    const clientFolder = existing.hasNext() ? existing.next() : root.createFolder(clientId);

    // Create sub-folders
    ["Data_Submissions", "Reports", "Approved"].forEach(name => {
      const sub = clientFolder.getFoldersByName(name);
      if (!sub.hasNext()) clientFolder.createFolder(name);
    });

    // Update DRIVE_FOLDER_ID in sheet
    const sheetRow = i + 4;
    sheet.getRange(sheetRow, IDX.DRIVE_FOLDER_ID).setValue(clientFolder.getId());
    Logger.log(`✅ Folders created for ${clientId}: ${clientFolder.getUrl()}`);
  });
  Logger.log("Drive folder setup complete.");
}

/**
 * Get or lazily create the sub-folder (Data_Submissions | Reports | Approved)
 * inside a client's Drive folder.
 */
function getSubFolder(clientFolderId, subName) {
  const parent = DriveApp.getFolderById(clientFolderId);
  const it = parent.getFoldersByName(subName);
  return it.hasNext() ? it.next() : parent.createFolder(subName);
}


// ══════════════════════════════════════════════════════════════════════════════
// WEB APP  —  Deploy as: Execute as ME, Who has access: Anyone
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET handler — used by portal to fetch notifications or template URL.
 * Query params:
 *   action=notifications  &clientId=FL-FOS-GHG-FY26
 *   action=template       &clientId=FL-FOS-GHG-FY26
 *   action=status         &clientId=FL-FOS-GHG-FY26
 */
function doGet(e) {
  const p = e.parameter || {};
  let result;
  try {
    switch (p.action) {
      case "notifications": result = _getNotifications(p.clientId);        break;
      case "status":        result = _getClientStatus(p.clientId);         break;
      case "template":      result = _getTemplateInfo(p.clientId);         break;
      case "datapoints":    result = _getDatapoints(p.clientId, p.fy);     break;
      default:              result = { status: "ok", service: getClientName() + " GHG Reporting Platform v2" };
    }
  } catch(err) {
    result = { error: err.message };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST handler — called by the portal (upload) and by generate_ghg_report.js (report publish).
 * Body JSON:
 *   { action: "uploadDataFile",  clientId, fileName, fileBase64, submittedBy }
 *   { action: "publishReport",   clientId, fileName, fileBase64, isComplete,
 *                                missingItems, reportType, completionPct }
 *   { action: "approveReport",   clientId, reportUrl }
 *   { action: "setupNewClient",  clientId, entityCode, entityName, fy,
 *                                consultEmail, clientEmail, driveFolderId, scopeConfig }
 */
function doPost(e) {
  let result;
  try {
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case "uploadDataFile": result = _handleUploadDataFile(body); break;
      case "publishReport":  result = _handlePublishReport(body);  break;
      case "approveReport":  result = _handleApproveReport(body);  break;
      case "saveDatapoints": result = _handleSaveDatapoints(body); break;
      case "setupNewClient": result = _handleSetupNewClient(body); break;
      default: result = { error: `Unknown action: ${body.action}` };
    }
  } catch(err) {
    result = { error: err.message, stack: err.stack };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}


// ── Web App action handlers ───────────────────────────────────────────────────

/**
 * Called by generate_ghg_report.js after parsing the XLSX.
 * Replaces all existing rows for this clientId with the freshly parsed data,
 * so the sheet always holds the most recent submission.
 *
 * Body: { clientId, fiscalYear, submittedBy, dataPoints: [
 *   { id, scope, subcat, name, unit, value, tco2e, status, priorYear }
 * ]}
 */
function _handleSaveDatapoints(body) {
  const { clientId, fiscalYear, submittedBy, dataPoints } = body;
  if (!clientId || !Array.isArray(dataPoints)) {
    throw new Error("saveDatapoints requires clientId and dataPoints[]");
  }

  const cfg   = getConfig();
  const sheet = getTab(cfg.GHG_DATAPOINTS_TAB);
  const all   = sheet.getDataRange().getValues();

  // Collect 1-based row numbers where ENTITY_ID === clientId (skip 3 header rows)
  const toDelete = [];
  for (let i = 3; i < all.length; i++) {
    if (String(all[i][GHG.ENTITY_ID - 1]) === clientId) toDelete.push(i + 1);
  }
  // Delete from bottom up so row numbers stay valid
  for (let i = toDelete.length - 1; i >= 0; i--) {
    sheet.deleteRow(toDelete[i]);
  }

  // Write fresh rows (13 standard cols + col 14: tco2e + col 15: fiscalYear)
  if (dataPoints.length > 0) {
    const now  = new Date();
    const rows = dataPoints.map(dp => [
      dp.id        || "",           // 1  DP_ID
      clientId,                     // 2  ENTITY_ID
      dp.scope     || "",           // 3  SCOPE
      dp.subcat    || "",           // 4  SUBCAT
      dp.name      || "",           // 5  NAME
      dp.unit      || "",           // 6  UNIT
      dp.value != null ? dp.value : "",  // 7  VALUE (activity data)
      dp.status    || "Collected",  // 8  STATUS
      "XLSX Submission",            // 9  SOURCE
      submittedBy  || "generate_ghg_report.js",  // 10 SUBMITTED_BY
      now,                          // 11 SUBMITTED_DATE
      dp.priorYear != null ? dp.priorYear : "",   // 12 PRIOR_YEAR
      "",                           // 13 NOTES
      dp.tco2e != null ? dp.tco2e : "",           // 14 TCO2E (tCO2e computed)
      fiscalYear   || "",           // 15 FISCAL_YEAR
    ]);
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, 15).setValues(rows);
  }

  // Update Master_Index: completion % + status
  const collected = dataPoints.filter(dp => dp.status === "Collected").length;
  const pct = dataPoints.length > 0 ? Math.round(collected / dataPoints.length * 100) : 0;
  updateIndexCell(clientId, IDX.COMPLETION_PCT, pct / 100);   // store as decimal; sheet formats as %
  if (pct === 100) updateIndexCell(clientId, IDX.STATUS, "Data Complete");

  return { status: "ok", written: dataPoints.length, completionPct: pct };
}

/**
 * Bootstrap a new client's GHG tracking rows.
 * Idempotent — skips Master_Index row if clientId already present; skips
 * GHG_Datapoints rows if any already exist for this clientId.
 *
 * Body: {
 *   clientId:      "ACME-ENG-GHG-FY26"
 *   entityCode:    "ENG"
 *   entityName:    "ACME Engineering Pvt Ltd"
 *   fy:            "FY26"
 *   consultEmail:  "likhith@deepwoodsgreen.com"
 *   clientEmail:   "finance@acme.com"
 *   driveFolderId: "1AbcDef..."
 *   scopeConfig: {
 *     s1_stationary: bool, s1_mobile: bool, s1_fugitive: bool,
 *     s2_grid: bool,       s2_renewable: bool,
 *     s3_included: bool,   s3_categories: string[]   // ["cat1","cat4",...]
 *   }
 * }
 */
function _handleSetupNewClient(body) {
  const { clientId, entityCode, entityName, fy, consultEmail, clientEmail, driveFolderId, scopeConfig } = body;
  if (!clientId || !entityCode || !fy) {
    throw new Error("setupNewClient requires clientId, entityCode, and fy");
  }

  const cfg = getConfig();
  const sc  = scopeConfig || {};

  // ── 1. Master_Index: add row if not already present ───────────────────────
  const indexSheet    = getTab(cfg.MASTER_INDEX_TAB);
  const indexData     = indexSheet.getDataRange().getValues();
  const alreadyIndexed = indexData.slice(3).some(r => String(r[IDX.CLIENT_ID - 1]) === clientId);

  if (!alreadyIndexed) {
    const today  = new Date();
    const newRow = new Array(14).fill("");
    newRow[IDX.CLIENT_ID        - 1] = clientId;
    newRow[IDX.ENTITY_NAME      - 1] = entityName || entityCode;
    newRow[IDX.FRAMEWORK        - 1] = "GHG Protocol";
    newRow[IDX.FISCAL_YEAR      - 1] = fy;
    newRow[IDX.CYCLE_START      - 1] = today;
    newRow[IDX.STATUS           - 1] = "Collecting";
    newRow[IDX.CONSULTANT_EMAIL - 1] = consultEmail || cfg.CONSULTANT_EMAIL;
    newRow[IDX.CLIENT_EMAIL     - 1] = clientEmail  || "";
    newRow[IDX.DRIVE_FOLDER_ID  - 1] = driveFolderId || "";
    const insertRow = indexSheet.getLastRow() + 1;
    indexSheet.getRange(insertRow, 1, 1, 14).setValues([newRow]);
    indexSheet.getRange(insertRow, IDX.CYCLE_DAY)
      .setFormula(`=IF(E${insertRow}="","",TODAY()-E${insertRow})`);
    indexSheet.getRange(insertRow, IDX.COMPLETION_PCT)
      .setFormula(
        `=IFERROR(COUNTIFS(GHG_Datapoints!B:B,A${insertRow},GHG_Datapoints!H:H,"Collected")` +
        `/COUNTIF(GHG_Datapoints!B:B,A${insertRow}),0)`
      ).setNumberFormat("0%");
  }

  // ── 2. GHG_Datapoints: add generic template rows if not already present ───
  const dpSheet          = getTab(cfg.GHG_DATAPOINTS_TAB);
  const dpData           = dpSheet.getDataRange().getValues();
  const alreadyHasPoints = dpData.slice(3).some(r => String(r[GHG.ENTITY_ID - 1]) === clientId);

  if (!alreadyHasPoints) {
    const code   = entityCode.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const STATUS_BG = { Missing: "#FEE2E2" };
    const allRows   = [];
    let s1n = 1, s2n = 1, s3n = 1;

    function mkRow(dpId, scope, subcat, name, unit) {
      return [dpId, clientId, scope, subcat, name, unit, null, "Missing", "", "", "", null, ""];
    }

    // ── Scope 1 ──────────────────────────────────────────────────────────────
    if (sc.s1_stationary) {
      allRows.push(mkRow(`GHG-S1-${code}-${String(s1n++).padStart(3,"0")}`,
        "Scope 1", "Stationary Combustion", "Diesel — DG sets / generators", "L"));
      allRows.push(mkRow(`GHG-S1-${code}-${String(s1n++).padStart(3,"0")}`,
        "Scope 1", "Stationary Combustion", "LPG consumption", "kg"));
      allRows.push(mkRow(`GHG-S1-${code}-${String(s1n++).padStart(3,"0")}`,
        "Scope 1", "Stationary Combustion", "Natural Gas / PNG consumption", "m³"));
    }
    if (sc.s1_mobile) {
      allRows.push(mkRow(`GHG-S1-${code}-${String(s1n++).padStart(3,"0")}`,
        "Scope 1", "Mobile Combustion", "Diesel — company fleet / vehicles", "L"));
      allRows.push(mkRow(`GHG-S1-${code}-${String(s1n++).padStart(3,"0")}`,
        "Scope 1", "Mobile Combustion", "Petrol — company fleet / vehicles", "L"));
    }
    if (sc.s1_fugitive) {
      allRows.push(mkRow(`GHG-S1-${code}-${String(s1n++).padStart(3,"0")}`,
        "Scope 1", "Fugitive", "Refrigerant charge — AC & chillers (per gas type)", "kg"));
      allRows.push(mkRow(`GHG-S1-${code}-${String(s1n++).padStart(3,"0")}`,
        "Scope 1", "Fugitive", "Fire extinguishers — CO₂ / halon (discharge events)", "kg"));
    }

    // ── Scope 2 ──────────────────────────────────────────────────────────────
    if (sc.s2_grid) {
      allRows.push(mkRow(`GHG-S2-${code}-${String(s2n++).padStart(3,"0")}`,
        "Scope 2", "Purchased Electricity", "Grid electricity consumption", "kWh"));
    }
    if (sc.s2_renewable) {
      allRows.push(mkRow(`GHG-S2-${code}-${String(s2n++).padStart(3,"0")}`,
        "Scope 2", "Renewable Generation", "Solar generation — rooftop (self-consumed)", "kWh"));
    }

    // ── Scope 3 ──────────────────────────────────────────────────────────────
    if (sc.s3_included) {
      const cats = Array.isArray(sc.s3_categories) && sc.s3_categories.length > 0
        ? sc.s3_categories
        : ["cat1", "cat4", "cat6", "cat7"];

      const catMap = {
        "cat1":  ["Cat 1 Purchased Goods",       "Purchased goods & services (spend-based tCO₂e)",  "tCO₂e"],
        "cat2":  ["Cat 2 Capital Goods",          "Capital goods additions (spend-based tCO₂e)",     "tCO₂e"],
        "cat3":  ["Cat 3 Fuel & Energy-Related",  "WTT & transmission / distribution losses",        "tCO₂e"],
        "cat4":  ["Cat 4 Upstream Transport",     "Inbound freight — distance-based",                "tonne-km"],
        "cat5":  ["Cat 5 Waste in Operations",    "Waste generated in operations",                   "tCO₂e"],
        "cat6":  ["Cat 6 Business Travel",        "Business travel — air & rail",                    "km"],
        "cat7":  ["Cat 7 Employee Commute",       "Employee commuting",                              "person-km"],
        "cat9":  ["Cat 9 Downstream Transport",   "Outbound logistics — distance-based",             "tonne-km"],
        "cat11": ["Cat 11 Use of Sold Products",  "End-use emissions — sold products in use",        "tCO₂e"],
        "cat12": ["Cat 12 End-of-Life Products",  "End-of-life treatment of sold products",          "tCO₂e"],
      };

      cats.forEach(cat => {
        const meta = catMap[cat];
        if (!meta) return;
        allRows.push(mkRow(`GHG-S3-${code}-${String(s3n++).padStart(3,"0")}`,
          "Scope 3", meta[0], meta[1], meta[2]));
      });
    }

    if (allRows.length > 0) {
      const startRow = dpSheet.getLastRow() + 1;
      allRows.forEach((row, i) => {
        const r = startRow + i;
        row.forEach((v, ci) => {
          dpSheet.getRange(r, ci + 1)
            .setValue(v === null ? "" : v)
            .setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");
        });
        [7, 9, 10, 11].forEach(c => dpSheet.getRange(r, c).setBackground("#FFF9C4"));
        dpSheet.getRange(r, GHG.STATUS)
          .setBackground(STATUS_BG["Missing"]).setHorizontalAlignment("center");
      });
    }
  }

  return {
    status: "ok",
    clientId,
    indexAdded:     !alreadyIndexed,
    datapointsAdded: !alreadyHasPoints,
    message: alreadyIndexed && alreadyHasPoints
      ? `${clientId} already set up — no changes made`
      : `${clientId}: Master_Index ${alreadyIndexed ? "already existed" : "added"}, ` +
        `datapoints ${alreadyHasPoints ? "already existed" : "added"}`,
  };
}

/**
 * Returns all data points for a clientId (optionally filtered by fiscalYear).
 * Portal calls this as: action=datapoints&clientId=FL-FOS-GHG-FY26&fy=FY2026
 * Returns the most recently saved submission (saveDatapoints always replaces old rows).
 */
function _getDatapoints(clientId, fy) {
  if (!clientId) throw new Error("clientId is required");
  const cfg   = getConfig();
  const sheet = getTab(cfg.GHG_DATAPOINTS_TAB);
  const rows  = sheet.getDataRange().getValues().slice(3); // skip 3 header rows

  return rows
    .filter(r => {
      if (String(r[GHG.ENTITY_ID - 1]) !== clientId) return false;
      if (fy && r[14] && String(r[14]) !== fy) return false;  // col 15 = FISCAL_YEAR
      return true;
    })
    .map(r => ({
      id:          r[GHG.DP_ID          - 1],
      scope:       r[GHG.SCOPE          - 1],
      subcat:      r[GHG.SUBCAT         - 1],
      name:        r[GHG.NAME           - 1],
      unit:        r[GHG.UNIT           - 1],
      value:       r[GHG.VALUE          - 1],
      status:      r[GHG.STATUS         - 1],
      tco2e:       r[13],                    // col 14 (0-indexed = 13)
      fiscalYear:  r[14],                    // col 15 (0-indexed = 14)
      submittedBy: r[GHG.SUBMITTED_BY   - 1],
      submittedAt: r[GHG.SUBMITTED_DATE - 1]
                     ? new Date(r[GHG.SUBMITTED_DATE - 1]).toISOString() : null,
    }));
}

/**
 * Portal uploads the filled-in data template.
 * Saves to Drive/<clientId>/Data_Submissions/  → logs submission → emails consultant.
 */
function _handleUploadDataFile(body) {
  const { clientId, fileName, fileBase64, submittedBy } = body;
  const cfg     = getConfig();
  const clients = getClientRows();
  const row     = clients.find(r => r[IDX.CLIENT_ID - 1] === clientId);
  if (!row) throw new Error(`Client not found: ${clientId}`);

  const entityName    = row[IDX.ENTITY_NAME - 1];
  const fy            = row[IDX.FISCAL_YEAR - 1];
  const driveFolderId = row[IDX.DRIVE_FOLDER_ID - 1];
  const consultEmail  = row[IDX.CONSULTANT_EMAIL - 1] || cfg.CONSULTANT_EMAIL;

  // Ensure Drive folder exists
  const subFolder = driveFolderId && driveFolderId !== "<<DRIVE_FOLDER_ID_FOS>>"
    ? getSubFolder(driveFolderId, "Data_Submissions")
    : DriveApp.getRootFolder();  // fallback to root if folder not created yet

  // Save to Drive
  const bytes  = Utilities.base64Decode(fileBase64);
  const blob   = Utilities.newBlob(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
  const file   = subFolder.createFile(blob);
  const fileUrl = file.getUrl();

  // Log submission in Data_Submissions sheet
  _logDataSubmission(clientId, entityName, fy, fileName, fileUrl, submittedBy || "Portal");

  // Notify consultant
  const subject = `[${getClientName()} GHG] Data Submission Received — ${entityName} ${fy}`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#1E293B;max-width:600px">
      <div style="background:#1E6F5C;padding:16px 24px;border-radius:6px 6px 0 0">
        <h2 style="color:#fff;margin:0;font-size:15px">Data Submission Received</h2>
        <p style="color:#E6F4EF;margin:4px 0 0;font-size:12px">${entityName} · ${fy}</p>
      </div>
      <div style="border:1px solid #E2E8F0;border-top:none;padding:20px;border-radius:0 0 6px 6px">
        <p>A data submission file has been received for <strong>${entityName}</strong> (${clientId}).</p>
        <p><strong>File:</strong> ${fileName}<br>
           <strong>Submitted by:</strong> ${submittedBy || "Portal upload"}<br>
           <strong>Drive link:</strong> <a href="${fileUrl}">${fileUrl}</a></p>
        <p><strong>Next steps:</strong></p>
        <ol>
          <li>Download the file from Drive.</li>
          <li>Place it in the Cowork working folder.</li>
          <li>Open Claude and say: <code>generate GHG report</code></li>
        </ol>
      </div>
    </div>`;
  sendEmail(consultEmail, subject, html);

  // Portal notification
  _addNotification(clientId, entityName, "info",
    `Data file "${fileName}" submitted by ${submittedBy || "client"}.  Consultant notified.`,
    fileUrl);

  return { status: "ok", driveUrl: fileUrl, message: "File saved. Consultant notified." };
}


/**
 * Called by generate_ghg_report.js after DOCX is generated locally.
 * Saves DOCX to Drive, emails client + consultant, updates Sheet, adds notification.
 */
function _handlePublishReport(body) {
  const { clientId, fileName, fileBase64, isComplete, missingItems, reportType, completionPct } = body;
  const cfg     = getConfig();
  const clients = getClientRows();
  const row     = clients.find(r => r[IDX.CLIENT_ID - 1] === clientId);
  if (!row) throw new Error(`Client not found: ${clientId}`);

  const entityName    = row[IDX.ENTITY_NAME - 1];
  const fy            = row[IDX.FISCAL_YEAR - 1];
  const clientEmail   = row[IDX.CLIENT_EMAIL - 1];
  const consultEmail  = row[IDX.CONSULTANT_EMAIL - 1] || cfg.CONSULTANT_EMAIL;
  const driveFolderId = row[IDX.DRIVE_FOLDER_ID - 1];

  // Save to Drive/<clientId>/Reports/
  const subFolder = driveFolderId && driveFolderId !== "<<DRIVE_FOLDER_ID_FOS>>"
    ? getSubFolder(driveFolderId, "Reports")
    : DriveApp.getRootFolder();

  const bytes   = Utilities.base64Decode(fileBase64);
  const mimeDocx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const blob    = Utilities.newBlob(bytes, mimeDocx, fileName);
  const file    = subFolder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) { /* domain sharing policy may restrict this — file still saved */ }
  const fileUrl = file.getUrl();

  // Update Master_Index columns 13 + 14
  updateIndexCell(clientId, IDX.REPORT_URL,    fileUrl);
  updateIndexCell(clientId, IDX.REPORT_STATUS, reportType || (isComplete ? "Final" : "Interim"));

  // Build missing-data table HTML for email
  const missingHtml = (missingItems && missingItems.length > 0)
    ? `<p><strong>${missingItems.length} data point(s) were NOT submitted and are flagged in the report:</strong></p>
       <table style="border-collapse:collapse;width:100%;font-size:12px">
         <tr style="background:#1E6F5C;color:#fff">
           <th style="padding:6px 10px;text-align:left">Category</th>
           <th style="padding:6px 10px;text-align:left">Data Point</th>
           <th style="padding:6px 10px;text-align:left">Unit</th>
         </tr>
         ${missingItems.map((m, i) =>
           `<tr style="background:${i%2===0?'#fff':'#FEE2E2'}">
              <td style="padding:6px 10px;border-bottom:1px solid #eee">${m.scope || ""}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #eee">${m.name || m.description || ""}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #eee">${m.unit || ""}</td>
            </tr>`
         ).join("")}
       </table>
       <p style="color:#D90429;font-size:12px;font-weight:bold;margin-top:12px">
         This report is marked INTERIM and is NOT cleared for public disclosure until the above
         data is submitted and the final report is generated.
       </p>`
    : `<p style="color:#1E6F5C;font-weight:bold">All required data was provided.
       This report is complete and ready for review.</p>`;

  const reportLabel = isComplete ? "Final GHG Report" : "Interim GHG Report (Data Incomplete)";
  const pctStr = completionPct != null ? `${Math.round(completionPct)}%` : "—";

  // Email to consultant
  const consultSubject = `[${getClientName()} GHG] ${reportLabel} Generated — ${entityName} ${fy}`;
  const consultHtml = `
    <div style="font-family:Arial,sans-serif;color:#1E293B;max-width:640px">
      <div style="background:${isComplete ? "#1E6F5C" : "#D97706"};padding:16px 24px;border-radius:6px 6px 0 0">
        <h2 style="color:#fff;margin:0;font-size:15px">${reportLabel} — Ready for Review</h2>
        <p style="color:#fff;margin:4px 0 0;font-size:12px;opacity:0.85">${entityName} · ${fy} · ${pctStr} data complete</p>
      </div>
      <div style="border:1px solid #E2E8F0;border-top:none;padding:20px;border-radius:0 0 6px 6px">
        <p>The GHG report for <strong>${entityName}</strong> has been generated by Claude and saved to Drive.</p>
        <p><strong>Drive link:</strong> <a href="${fileUrl}">${fileName}</a></p>
        ${missingHtml}
        ${isComplete
          ? `<p><strong>Action:</strong> Review the report. If correct, open Claude and say:
             <code>approve GHG report for ${clientId}</code> to send it to the client.</p>`
          : `<p><strong>Action:</strong> Share the Drive link above with the client for their review,
             and request the missing data listed above.</p>`}
      </div>
    </div>`;
  sendEmail(consultEmail, consultSubject, consultHtml, [blob]);

  // Email to client (always send — interim with caveat, final as delivery)
  if (clientEmail) {
    const clientSubject = isComplete
      ? `Your ${getClientName()} GHG Report ${fy} — Ready for Review`
      : `[Action Required] ${getClientName()} GHG Report ${fy} — Data Gaps Identified`;
    const clientHtml = `
      <div style="font-family:Arial,sans-serif;color:#1E293B;max-width:600px">
        <div style="background:${isComplete?"#1E6F5C":"#D97706"};padding:16px 24px;border-radius:6px 6px 0 0">
          <h2 style="color:#fff;margin:0;font-size:15px">${isComplete ? "Your GHG Report is Ready" : "GHG Report — Data Gaps Found"}</h2>
          <p style="color:#fff;margin:4px 0 0;font-size:12px;opacity:0.85">${entityName} · ${fy}</p>
        </div>
        <div style="border:1px solid #E2E8F0;border-top:none;padding:20px;border-radius:0 0 6px 6px">
          <p>Dear ${entityName} team,</p>
          ${isComplete
            ? `<p>Your GHG Emissions Report for <strong>${fy}</strong> has been prepared.
               Please review the attached document. Your consultant will confirm final approval.</p>`
            : `<p>We have generated a <strong>partial GHG report</strong> based on the data received so far
               (${pctStr} complete). The report is attached for your reference, but it is
               <strong>not cleared for external use</strong> until the missing data is submitted.</p>`}
          ${missingHtml}
          <p style="margin-top:24px">Regards,<br><strong>Deepwoods Green Consulting</strong></p>
        </div>
      </div>`;
    sendEmail(clientEmail, clientSubject, clientHtml, [blob]);
  }

  // Portal notification
  const notifMsg = isComplete
    ? `Final GHG report generated (${pctStr} complete). Consultant review pending before delivery.`
    : `Interim GHG report generated (${pctStr} complete). ${missingItems ? missingItems.length : "?"} data gap(s) flagged.`;
  _addNotification(clientId, entityName,
    isComplete ? "success" : "warning",
    notifMsg, fileUrl);

  return { status: "ok", driveUrl: fileUrl, isComplete, reportType };
}


/**
 * Consultant has confirmed the final report is correct.
 * Copies report to Approved/ folder, emails final report to client, marks status = Approved.
 */
function _handleApproveReport(body) {
  const { clientId, notes } = body;
  const cfg     = getConfig();
  const clients = getClientRows();
  const row     = clients.find(r => r[IDX.CLIENT_ID - 1] === clientId);
  if (!row) throw new Error(`Client not found: ${clientId}`);

  const entityName    = row[IDX.ENTITY_NAME - 1];
  const fy            = row[IDX.FISCAL_YEAR - 1];
  const clientEmail   = row[IDX.CLIENT_EMAIL - 1];
  const consultEmail  = row[IDX.CONSULTANT_EMAIL - 1] || cfg.CONSULTANT_EMAIL;
  const driveFolderId = row[IDX.DRIVE_FOLDER_ID - 1];
  const reportUrl     = row[IDX.REPORT_URL - 1];

  if (!reportUrl) throw new Error(`No report URL found for ${clientId}. Generate a report first.`);

  // Copy report file to Approved/
  const approvedFolder = driveFolderId && driveFolderId !== "<<DRIVE_FOLDER_ID_FOS>>"
    ? getSubFolder(driveFolderId, "Approved")
    : DriveApp.getRootFolder();

  const reportFile = DriveApp.getFileById(_urlToId(reportUrl));
  const approvedFile = reportFile.makeCopy(
    reportFile.getName().replace("_INTERIM", "_FINAL_APPROVED").replace("_FINAL", "_FINAL_APPROVED"),
    approvedFolder
  );
  try { approvedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) { /* domain sharing policy may restrict this */ }
  const approvedUrl = approvedFile.getUrl();

  // Update Sheet
  updateIndexCell(clientId, IDX.REPORT_URL,    approvedUrl);
  updateIndexCell(clientId, IDX.REPORT_STATUS, "Approved");
  updateIndexCell(clientId, IDX.STATUS,        "Complete");

  // Delivery email to client
  if (clientEmail) {
    const subject = `Your ${getClientName()} GHG Report ${fy} — Final Approved`;
    const html = `
      <div style="font-family:Arial,sans-serif;color:#1E293B;max-width:600px">
        <div style="background:#1E6F5C;padding:16px 24px;border-radius:6px 6px 0 0">
          <h2 style="color:#fff;margin:0;font-size:15px">GHG Report — Final Approved</h2>
          <p style="color:#E6F4EF;margin:4px 0 0;font-size:12px">${entityName} · ${fy}</p>
        </div>
        <div style="border:1px solid #E2E8F0;border-top:none;padding:20px;border-radius:0 0 6px 6px">
          <p>Dear ${entityName} team,</p>
          <p>Your GHG Emissions Report for <strong>${fy}</strong> has been reviewed, approved,
             and finalised by Deepwoods Green Consulting.</p>
          <p><a href="${approvedUrl}" style="background:#1E6F5C;color:#fff;padding:10px 20px;
             border-radius:4px;text-decoration:none;font-weight:bold;display:inline-block">
             Download Final Report
          </a></p>
          ${notes ? `<p><strong>Consultant notes:</strong> ${notes}</p>` : ""}
          <p style="margin-top:24px">Warm regards,<br><strong>Deepwoods Green Consulting</strong></p>
        </div>
      </div>`;
    sendEmail(clientEmail, subject, html);
  }

  // Confirmation to consultant
  sendEmail(consultEmail,
    `[${getClientName()} GHG] Report Approved & Delivered — ${entityName} ${fy}`,
    `<p>The GHG report for <strong>${entityName} ${fy}</strong> has been marked Approved
     and the delivery email sent to the client.<br>
     Approved file: <a href="${approvedUrl}">${approvedUrl}</a></p>`
  );

  // Portal notification
  _addNotification(clientId, entityName, "success",
    `Final GHG report approved and delivered to client. Cycle complete.`, approvedUrl);

  return { status: "ok", approvedUrl, message: "Report approved. Client notified. Cycle complete." };
}


// ── Notification helpers ──────────────────────────────────────────────────────

/** Extracts file ID from a Google Drive URL. */
function _urlToId(url) {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  const m2 = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  throw new Error(`Cannot parse Drive file ID from URL: ${url}`);
}

/** Add a notification row to the Notifications sheet. */
function _addNotification(clientId, entityName, type, message, driveLink) {
  const ws = getMasterSS().getSheetByName("Notifications");
  if (!ws) return;
  ws.appendRow([
    new Date(),
    clientId,
    entityName || "",
    type,        // info | warning | success | error
    message,
    driveLink || "",
    false,       // read = false
  ]);
}

/** Return notification rows as JSON array (newest first, last 50). */
function _getNotifications(clientId) {
  const ws = getMasterSS().getSheetByName("Notifications");
  if (!ws) return { notifications: [] };
  const rows = ws.getDataRange().getValues().slice(1); // skip header
  let filtered = rows.filter(r => !clientId || r[1] === clientId || clientId === "all");
  filtered = filtered.reverse().slice(0, 50);
  return {
    notifications: filtered.map(r => ({
      timestamp:  r[0] ? new Date(r[0]).toISOString() : "",
      clientId:   r[1],
      entity:     r[2],
      type:       r[3],
      message:    r[4],
      driveLink:  r[5],
      read:       r[6],
    })),
  };
}

/** Return client status + latest report info. */
function _getClientStatus(clientId) {
  const clients = getClientRows();
  const row = clients.find(r => r[IDX.CLIENT_ID - 1] === clientId);
  if (!row) return { error: `Client not found: ${clientId}` };
  return {
    clientId,
    entity:       row[IDX.ENTITY_NAME   - 1],
    fy:           row[IDX.FISCAL_YEAR   - 1],
    status:       row[IDX.STATUS        - 1],
    completionPct:row[IDX.COMPLETION_PCT - 1],
    reportUrl:    row[IDX.REPORT_URL    - 1] || null,
    reportStatus: row[IDX.REPORT_STATUS - 1] || null,
  };
}

/** Return the data template info (Drive URL if hosted, or a note). */
function _getTemplateInfo(clientId) {
  // If you host the template XLSX in Drive, put its URL in the Config sheet
  // under key TEMPLATE_URL.  Otherwise the portal serves it statically.
  const cfg = getConfig();
  return {
    templateUrl: cfg.TEMPLATE_URL || null,
    clientId: clientId || null,
    note: "Download the FOS_GHG_Data_Template_FY26.xlsx from the portal /data-submission page.",
  };
}

/** Log a data submission in the Data_Submissions sheet. */
function _logDataSubmission(clientId, entityName, fy, fileName, driveUrl, submittedBy) {
  const ws = getMasterSS().getSheetByName("Data_Submissions");
  if (!ws) return;
  ws.appendRow([new Date(), clientId, entityName, fy, fileName, driveUrl, submittedBy, "Received"]);
}


// ══════════════════════════════════════════════════════════════════════════════
// SHEET BUILDERS — Notifications + Data_Submissions tabs
// ══════════════════════════════════════════════════════════════════════════════

function _buildNotifications(ss) {
  let ws = ss.getSheetByName("Notifications");
  if (!ws) ws = ss.insertSheet("Notifications");
  ws.clearContents().clearFormats();

  ws.getRange("A1:G1").merge()
    .setValue("PORTAL NOTIFICATIONS")
    .setBackground(GRN).setFontColor(WHT).setFontWeight("bold").setFontSize(12)
    .setFontFamily("Arial").setHorizontalAlignment("center").setVerticalAlignment("middle");
  ws.setRowHeight(1, 30);

  const hdrs = ["Timestamp","ClientID","Entity","Type","Message","Drive Link","Read"];
  hdrs.forEach((h, i) => {
    ws.getRange(2, i + 1).setValue(h)
      .setBackground(GRN).setFontColor(WHT).setFontWeight("bold")
      .setFontFamily("Arial").setFontSize(10).setHorizontalAlignment("center");
  });
  ws.setFrozenRows(2);
  _colWidths(ws, [160, 180, 220, 80, 420, 320, 60]);
  Logger.log("  ✓ Notifications tab built");
}

function _buildDataSubmissions(ss) {
  let ws = ss.getSheetByName("Data_Submissions");
  if (!ws) ws = ss.insertSheet("Data_Submissions");
  ws.clearContents().clearFormats();

  ws.getRange("A1:H1").merge()
    .setValue("DATA SUBMISSION LOG")
    .setBackground(GRN).setFontColor(WHT).setFontWeight("bold").setFontSize(12)
    .setFontFamily("Arial").setHorizontalAlignment("center").setVerticalAlignment("middle");
  ws.setRowHeight(1, 30);

  const hdrs = ["Submitted At","ClientID","Entity","Fiscal Year","File Name","Drive URL","Submitted By","Status"];
  hdrs.forEach((h, i) => {
    ws.getRange(2, i + 1).setValue(h)
      .setBackground(GRN).setFontColor(WHT).setFontWeight("bold")
      .setFontFamily("Arial").setFontSize(10).setHorizontalAlignment("center");
  });
  ws.setFrozenRows(2);
  _colWidths(ws, [160, 180, 220, 100, 280, 320, 160, 100]);
  Logger.log("  ✓ Data_Submissions tab built");
}
