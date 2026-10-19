// Real auth — backed by backend/api/login.php etc. Session token is stored in
// localStorage and sent as `Authorization: Bearer <token>` on every API call.
//
// Multi-client: login response now includes client_id + role.
// ClientContext is cleared on logout so the next login loads fresh context.

import { clearClientContext } from "@/lib/client-context";

export type Role =
  | "sustainability_team"    // client read-only (dashboards)
  | "client_uploader"        // client data-entry
  | "client_leadership"      // client read-only (leadership)
  | "deepwoods_admin"        // Deepwoods full access
  | "deepwoods_coordinator"; // Deepwoods staff, fewer admin write permissions

export const ROLE_META: Record<Role, { label: string; blurb: string; canVault: boolean; canUpload: boolean; canAdmin: boolean }> = {
  sustainability_team: {
    label: "Sustainability Team",
    blurb: "GHG dashboards, data submission, and decarbonisation planning.",
    canVault: true, canUpload: true, canAdmin: false,
  },
  client_uploader: {
    label: "Data Submission Team",
    blurb: "View everything, upload data, browse vault.",
    canVault: true, canUpload: true, canAdmin: false,
  },
  client_leadership: {
    label: "Leadership",
    blurb: "Read-only dashboards and KPIs.",
    canVault: false, canUpload: false, canAdmin: false,
  },
  deepwoods_admin: {
    label: "Deepwoods Admin",
    blurb: "Full access + review queue and audit log.",
    canVault: true, canUpload: false, canAdmin: true,
  },
  deepwoods_coordinator: {
    label: "Deepwoods Coordinator",
    blurb: "Access across all clients and day-to-day admin console work.",
    canVault: false, canUpload: false, canAdmin: true,
  },
};

// Roles that belong to Deepwoods (not a client) — see Deepwoods branding
export const DEEPWOODS_ROLES: Role[] = ["deepwoods_admin", "deepwoods_coordinator"];

export const API_BASE = "/backend/api";

// ── Demo mode ────────────────────────────────────────────────────────────────
// A zero-backend demo session: one click on the login page signs you in as the
// demo sustainability team account. All API calls are served from local mocks
// (submissions persist in localStorage), so the full portal works without MySQL,
// Drive or SMTP being configured.
const DEMO_KEY = "decarb_demo_mode";
const DEMO_SUBS_KEY = "decarb_demo_submissions";

export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEMO_KEY) === "1";
}

export function loginDemo(): void {
  localStorage.setItem(DEMO_KEY, "1");
  setSession("demo-token", "sustainability_team", "demo@featherlite.com", false);
}

function demoSubs(): any[] {
  try { return JSON.parse(localStorage.getItem(DEMO_SUBS_KEY) ?? "[]"); } catch { return []; }
}
function saveDemoSubs(subs: any[]) {
  localStorage.setItem(DEMO_SUBS_KEY, JSON.stringify(subs));
}

// Serves the known API endpoints locally while in demo mode.
async function demoFetch(path: string, options: RequestInit): Promise<any> {
  const endpoint = path.split("?")[0];
  console.log(`[demoFetch] endpoint=${endpoint}`);
  switch (endpoint) {
    case "me.php": {
      const storedRole = localStorage.getItem("fl_role") ?? "sustainability_team";
      const storedEmail = localStorage.getItem("fl_email") ?? "demo@featherlite.com";
      return { email: storedEmail, role: storedRole };
    }
    case "logout.php":
      localStorage.removeItem(DEMO_KEY);
      return { ok: true };
    case "submissions.php": {
      const qs = new URLSearchParams(path.split("?")[1] ?? "");
      let subs = demoSubs();
      const status = qs.get("status"), entity = qs.get("entity");
      if (status) subs = subs.filter((s: any) => s.status === status);
      if (entity) subs = subs.filter((s: any) => s.entity === entity);
      return subs;
    }
    case "audit-log.php":
      return [];
    case "submit.php": {
      const form = options.body as FormData;
      const files: any[] = [];
      const dataFile = form.get("dataFile") as File | null;
      if (dataFile && dataFile.name) files.push({ original_name: dataFile.name, drive_file_link: "#demo", kind: "data" });
      for (const doc of form.getAll("documents[]")) {
        const f = doc as File;
        if (f && f.name) files.push({ original_name: f.name, drive_file_link: "#demo", kind: "document" });
      }
      const sub = {
        id: Date.now(),
        entity: form.get("entity"),
        version: form.get("version"),
        datasetId: form.get("dataset_id"),
        datasetName: form.get("dataset_name"),
        tag: form.get("tag"),
        year: form.get("year"),
        unit: form.get("unit"),
        notes: form.get("notes"),
        status: "Pending",
        submittedBy: "demo@featherlite.com",
        date: new Date().toISOString().slice(0, 10),
        files,
      };
      saveDemoSubs([sub, ...demoSubs()]);
      return sub;
    }
    case "context.php":
      return {
        client: {
          id: 1,
          name: "Featherlite (FP + FOS)",
          slug: "featherlite",
          logo_url: "/featherlite-logo.png",
          primary_color: "#E63329",
          currency: "INR",
          reporting_period: "FY",
          is_active: true,
          payment_status: "paid",
        },
        entities: [
          { code: "FL",  name: "Featherlite (Consolidated)",           short: "FL",  is_consolidated: true,  consolidates: ["FP", "FOS"], sort_order: 0 },
          { code: "FP",  name: "Featherlite Products Pvt. Ltd.",        short: "FP",  is_consolidated: false, consolidates: null, sort_order: 1, org_type: "manufacturing_plant", legal_address: "Survey No. 54/1, Rajanakunte, Yelahanka Hobli, Bengaluru 560064" },
          { code: "FOS", name: "Featherlite Office Systems Pvt. Ltd.",  short: "FOS", is_consolidated: false, consolidates: null, sort_order: 2, org_type: "corporate_office",    legal_address: "Survey No. 12, Hejjala Village, Kanakapura Road, Bengaluru 560082" },
        ],
        reporting_years: ["FY21", "FY22", "FY23", "FY24", "FY25", "FY26"],
        enabled_pages: [
          "home", "overview", "dashboard", "inventory", "footprint",
          "decarb", "hotspots", "action-plan", "progress", "peer",
          "green-finance", "compliance", "credits", "reports",
          "reporting", "submissions", "data-tracker", "vault",
          "methodology", "priority-actions", "notifications",
        ],
        s3_boundary: ["Cat 1","Cat 2","Cat 3","Cat 4","Cat 5","Cat 6","Cat 7","Cat 8","Cat 9","Cat 10","Cat 11","Cat 12","Cat 13","Cat 14","Cat 15"],
        s3_not_relevant: { "Cat 5": true, "Cat 7": true, "Cat 9": true, "Cat 10": true, "Cat 12": true },
        targets: { base_year_s12: "FY22", base_year_s3: "FY24", netzero_year: 2040, sbti_target_s12: 42, sbti_target_year: 2030 },
        config: { setup_complete: true, inventory_complete: true, payment_requested: false },
      };
    case "review.php":
    case "change-password.php":
    case "forgot-password.php":
    case "reset-password.php":
      return { ok: true, demo: true };
    // ── Data collection endpoints ─────────────────────────────────────────────
    case "decarb/assets.php":
      return [];
    case "data-tracker/draft.php": {
      if ((options.method ?? "GET").toUpperCase() === "POST") return { ok: true };
      return { draft: {} };
    }
    case "ndc-threads.php": {
      if ((options.method ?? "GET").toUpperCase() === "POST") return { ok: true };
      // Detail request (with source_type) → array; summary request → object
      const ndcQs = new URLSearchParams(path.split("?")[1] ?? "");
      return ndcQs.has("source_type") ? [] : {};
    }
    case "ghg/facilities.php":
      return [
        { id:  1, name: "Rajanakunte",               entity: "FP",  location: "Rajanakunte, Bengaluru",              status: "active" },
        { id: 15, name: "Doddballapura",              entity: "FP",  location: "Doddballapura, Karnataka",            status: "active" },
        { id:  2, name: "Hejjala",                   entity: "FOS", location: "Hejjala, Bengaluru",                  status: "active" },
        { id:  3, name: "Kumbalagodu",               entity: "FOS", location: "Kumbalagodu, Bengaluru",              status: "active" },
        { id:  4, name: "Deepanjalinagar/Ramohalli", entity: "FOS", location: "Deepanjalinagar, Bengaluru",          status: "active" },
        { id:  5, name: "Vasanth Nagar",             entity: "FOS", location: "Vasanth Nagar, Bengaluru",            status: "active" },
        { id:  6, name: "Sriperumbudur",             entity: "FOS", location: "Sriperumbudur, Tamil Nadu",           status: "active" },
        { id:  7, name: "Maharashtra Wind Site",     entity: "FOS", location: "Dhule, Maharashtra",                  status: "active" },
      ];
    case "inventory-boundary.php":
      return {
        scope1: [
          {
            id: "s1-fp-01", fiscalYear: "FY26", scope: "scope1", subcategory: "stationary",
            name: "Diesel Generator — Rajanakunte Plant", facilityId: "1",
            fuelType: "Diesel", equipmentType: "Diesel Generator",
            nameplateCapacity: { value: 750, unit: "kVA" },
            commissioningDate: "2018-06-01", efDataset: "MoEFCC 2024", status: "active",
          },
          {
            id: "s1-fp-02", fiscalYear: "FY26", scope: "scope1", subcategory: "mobile",
            name: "Company Fleet — FP Delivery Vehicles", facilityId: "1",
            fuelType: "Diesel", vehicleType: "Light Commercial Vehicle",
            vehicleCount: 8, ownership: "owned", efDataset: "DEFRA 2024", status: "active",
          },
          {
            id: "s1-fos-01", fiscalYear: "FY26", scope: "scope1", subcategory: "stationary",
            name: "Diesel Generator — Hejjala Plant", facilityId: "2",
            fuelType: "Diesel", equipmentType: "Diesel Generator",
            nameplateCapacity: { value: 500, unit: "kVA" },
            commissioningDate: "2019-03-01", efDataset: "MoEFCC 2024", status: "active",
          },
          {
            id: "s1-fos-02", fiscalYear: "FY26", scope: "scope1", subcategory: "fugitive",
            name: "HVAC Refrigerant — Hejjala Production Hall", facilityId: "2",
            refrigerantOrGas: "R-410A", refrigerantChargeKg: 140,
            annualLeakagePct: 3.5, installationDate: "2020-08-10", status: "monitor",
          },
          {
            id: "s1-fos-03", fiscalYear: "FY26", scope: "scope1", subcategory: "mobile",
            name: "LPG Forklifts — Kumbalagodu Plant", facilityId: "3",
            fuelType: "LPG", vehicleType: "Forklift",
            vehicleCount: 4, ownership: "owned", efDataset: "MoEFCC 2024", status: "active",
          },
        ],
        scope2: [
          {
            id: "s2-fp-01", fiscalYear: "FY26", scope: "scope2", category: "electricity",
            name: "BESCOM HT — Rajanakunte Main Feeder", facilityId: "1",
            supplier: "BESCOM", gridConnectionType: "HT",
            gridRegion: "Karnataka (State)", consumerNumber: "BE-1120043", status: "active",
            renewableProcurement: {
              hasInstrument: true, reSourceType: "wind", reLocation: "offsite",
              connectionType: "throughGrid", reOwnership: "companyOwned", metering: "net",
              procurementRoute: "retailSupply", agreementType: "greenTariff",
              instrumentType: "greenTariff", coverage: "partial", coveragePercent: 40,
              issuingBody: "BESCOM Green Tariff Scheme", vintageYear: "FY26",
              contractReference: "BESCOM-GT-FP-FY26",
            },
          },
          {
            id: "s2-fos-01", fiscalYear: "FY26", scope: "scope2", category: "electricity",
            name: "BESCOM HT — Hejjala Main Feeder", facilityId: "2",
            supplier: "BESCOM", gridConnectionType: "HT",
            gridRegion: "Karnataka (State)", consumerNumber: "BE-4421987", status: "active",
            renewableProcurement: {
              hasInstrument: true, reSourceType: "solar", reLocation: "onsite",
              connectionType: "throughGrid", reOwnership: "companyOwned", metering: "net",
              procurementRoute: "selfGeneration", agreementType: "noAgreement",
              instrumentType: "iRec", coverage: "partial", coveragePercent: 55,
              issuingBody: "I-REC Standard", vintageYear: "FY26",
              contractReference: "IREC-FOS-HJ-2026",
            },
          },
          {
            id: "s2-fos-02", fiscalYear: "FY26", scope: "scope2", category: "electricity",
            name: "BESCOM LT — Kumbalagodu Plant", facilityId: "3",
            supplier: "BESCOM", gridConnectionType: "LT",
            gridRegion: "Karnataka (State)", consumerNumber: "BE-3310056", status: "active",
            renewableProcurement: { hasInstrument: false },
          },
          {
            id: "s2-fos-03", fiscalYear: "FY26", scope: "scope2", category: "electricity",
            name: "TANGEDCO HT — Sriperumbudur Plant", facilityId: "4",
            supplier: "TANGEDCO", gridConnectionType: "HT",
            gridRegion: "Tamil Nadu (State)", consumerNumber: "TN-8870023", status: "active",
            renewableProcurement: { hasInstrument: false },
          },
        ],
        opControl: null,
      };
    case "reporting-boundary.php":
      return { reporting_boundary: null };
    case "environmental-data.php":
      return { water: null, waste: null, denominators: null };
    case "verification-status.php":
      return { records: [] };
    case "client-setup.php":
      return { ok: true, setup_complete: true };
    // ── GHG calculation endpoints ─────────────────────────────────────────────
    case "ghg/inventory.php": {
      const invQs = new URLSearchParams(path.split("?")[1] ?? "");
      const ent = invQs.get("entity") ?? "FL";
      // FY26 values are the real ones from the Featherlite FY26 trackers / DB.
      // FY21–FY25 use plausible trend data for the demo narrative.
      const invRows: Record<string, any[]> = {
        FP: [
          { metric_key: "Scope 1",        series: { FY21: 38.2,   FY22: 40.5,   FY23: 39.8,   FY24: 39.1,   FY25: 40.3,   FY26: 41.824   } },
          { metric_key: "Scope 2 LB",     series: { FY21: 72.1,   FY22: 78.4,   FY23: 80.2,   FY24: 82.6,   FY25: 85.1,   FY26: 84.313   } },
          { metric_key: "Scope 2 MB",     series: { FY21: 72.1,   FY22: 78.4,   FY23: 80.2,   FY24: 82.6,   FY25: 85.1,   FY26: 84.313   } },
          { metric_key: "Scope 3 Total",  series: { FY23: 440.2,  FY24: 455.8,  FY25: 468.4,  FY26: 476.361 } },
          { metric_key: "Grand Total LB", series: { FY23: 560.2,  FY24: 577.5,  FY25: 593.8,  FY26: 602.497 } },
          { metric_key: "Grand Total MB", series: { FY23: 560.2,  FY24: 577.5,  FY25: 593.8,  FY26: 602.497 } },
          { metric_key: "Cat 1",  series: {                                                     FY26: 4.751   } },
          { metric_key: "Cat 2",  series: { FY23: 340.5, FY24: 355.2, FY25: 368.1, FY26: 379.050 } },
          { metric_key: "Cat 3",  series: { FY23: 22.4,  FY24: 24.1,  FY25: 25.6,  FY26: 26.909  } },
          { metric_key: "Cat 5",  series: { FY23: 0.3,   FY24: 0.4,   FY25: 0.45,  FY26: 0.480   } },
          { metric_key: "Cat 6",  series: { FY23: 4.1,   FY24: 4.4,   FY25: 4.6,   FY26: 4.802   } },
          { metric_key: "Cat 7",  series: { FY23: 72.9,  FY24: 71.7,  FY25: 69.7,  FY26: 60.368  } },
        ],
        FOS: [
          { metric_key: "Scope 1",        series: { FY21: 128.4,  FY22: 135.6,  FY23: 140.2,  FY24: 145.8,  FY25: 150.3,  FY26: 154.122  } },
          { metric_key: "Scope 2 LB",     series: { FY21: 1980.5, FY22: 2050.3, FY23: 2110.8, FY24: 2165.4, FY25: 2210.6, FY26: 2235.669 } },
          // FOS market-based falls to 0 in FY26 via wind PPA + I-RECs
          { metric_key: "Scope 2 MB",     series: { FY21: 1980.5, FY22: 1850.2, FY23: 1420.6, FY24: 860.3,  FY25: 320.1,  FY26: 0        } },
          { metric_key: "Scope 3 Total",  series: { FY23: 17250.4, FY24: 17680.2, FY25: 18120.5, FY26: 18658.712 } },
          { metric_key: "Grand Total LB", series: { FY23: 19501.0, FY24: 19991.4, FY25: 20481.4, FY26: 21048.503 } },
          { metric_key: "Grand Total MB", series: { FY23: 17519.0, FY24: 17826.3, FY25: 18271.0, FY26: 18812.834 } },
          { metric_key: "Cat 1",  series: { FY23: 15200.5, FY24: 15450.2, FY25: 14980.6, FY26: 14920.938 } },
          { metric_key: "Cat 2",  series: { FY23: 62.1,    FY24: 68.4,    FY25: 71.2,    FY26: 74.436   } },
          { metric_key: "Cat 3",  series: { FY23: 480.2,   FY24: 498.6,   FY25: 515.4,   FY26: 531.082  } },
          { metric_key: "Cat 4",  series: { FY23: 88.5,    FY24: 92.3,    FY25: 95.8,    FY26: 98.218   } },
          { metric_key: "Cat 5",  series: { FY23: 1.6,     FY24: 1.7,     FY25: 1.9,     FY26: 1.961    } },
          { metric_key: "Cat 6",  series: { FY23: 82.4,    FY24: 88.6,    FY25: 92.1,    FY26: 96.203   } },
          { metric_key: "Cat 7",  series: { FY23: 870.5,   FY24: 890.2,   FY25: 910.4,   FY26: 928.651  } },
          { metric_key: "Cat 9",  series: { FY23: 1810.6,  FY24: 1875.2,  FY25: 1920.5,  FY26: 1958.643 } },
          { metric_key: "Cat 11", series: { FY23: 42.5,    FY24: 43.8,    FY25: 44.2,    FY26: 44.786   } },
          { metric_key: "Cat 12", series: { FY23: 3.5,     FY24: 3.6,     FY25: 3.7,     FY26: 3.794    } },
        ],
        FL: [
          { metric_key: "Scope 1",        series: { FY21: 166.6,  FY22: 176.1,  FY23: 180.0,  FY24: 184.9,  FY25: 190.6,  FY26: 195.946  } },
          { metric_key: "Scope 2 LB",     series: { FY21: 2052.6, FY22: 2128.7, FY23: 2191.0, FY24: 2248.0, FY25: 2295.7, FY26: 2319.982 } },
          { metric_key: "Scope 2 MB",     series: { FY21: 2052.6, FY22: 1928.6, FY23: 1500.8, FY24: 942.9,  FY25: 405.2,  FY26: 84.313   } },
          { metric_key: "Scope 3 Total",  series: { FY23: 17690.6, FY24: 18136.0, FY25: 18588.9, FY26: 19135.073 } },
          { metric_key: "Grand Total LB", series: { FY23: 20061.2, FY24: 20568.9, FY25: 21075.2, FY26: 21651.001 } },
          { metric_key: "Grand Total MB", series: { FY23: 18079.2, FY24: 18403.8, FY25: 18864.8, FY26: 19415.332 } },
          { metric_key: "Cat 1",  series: { FY23: 15200.5, FY24: 15450.2, FY25: 14980.6, FY26: 14925.689 } },
          { metric_key: "Cat 2",  series: { FY23: 402.6,   FY24: 423.6,   FY25: 439.3,   FY26: 453.486  } },
          { metric_key: "Cat 3",  series: { FY23: 502.6,   FY24: 522.7,   FY25: 541.0,   FY26: 557.991  } },
          { metric_key: "Cat 4",  series: { FY23: 88.5,    FY24: 92.3,    FY25: 95.8,    FY26: 98.218   } },
          { metric_key: "Cat 5",  series: { FY23: 1.9,     FY24: 2.1,     FY25: 2.35,    FY26: 2.441    } },
          { metric_key: "Cat 6",  series: { FY23: 86.5,    FY24: 93.0,    FY25: 96.7,    FY26: 101.005  } },
          { metric_key: "Cat 7",  series: { FY23: 943.4,   FY24: 961.9,   FY25: 980.1,   FY26: 989.019  } },
          { metric_key: "Cat 9",  series: { FY23: 1810.6,  FY24: 1875.2,  FY25: 1920.5,  FY26: 1958.643 } },
          { metric_key: "Cat 11", series: { FY23: 42.5,    FY24: 43.8,    FY25: 44.2,    FY26: 44.786   } },
          { metric_key: "Cat 12", series: { FY23: 3.5,     FY24: 3.6,     FY25: 3.7,     FY26: 3.794    } },
        ],
      };
      const invResult = { entity: ent, rows: invRows[ent] ?? invRows["FL"] };
      const s1Row = invResult.rows.find((r: any) => r.metric_key === "Scope 1");
      console.log(`[demoFetch] inventory entity=${ent} | Scope1 FY26=${s1Row?.series?.FY26 ?? "MISSING"} | totalRows=${invResult.rows.length}`);
      return invResult;
    }
    case "ghg/s1.php": {
      const s1Qs = new URLSearchParams(path.split("?")[1] ?? "");
      const s1Ent = s1Qs.get("entity") ?? "FL";
      const s1View = s1Qs.get("view") ?? "breakdown";
      if (s1View === "by_facility") {
        const byFac: Record<string, any[]> = {
          FP: [
            { facility: "Rajanakunte",   sub_type: "Stationary", series: { FY21: 9.8,  FY22: 10.4, FY23: 10.1, FY24: 9.9,  FY25: 10.3, FY26: 12.199 } },
            { facility: "Rajanakunte",   sub_type: "Mobile",     series: { FY21: 24.8, FY22: 26.3, FY23: 25.9, FY24: 25.4, FY25: 26.2, FY26: 29.602 } },
            { facility: "Rajanakunte",   sub_type: "Fugitive",   series: { FY21: 1.8,  FY22: 1.9,  FY23: 1.9,  FY24: 1.9,  FY25: 2.0,  FY26: 0.023  } },
            { facility: "Doddballapura", sub_type: "Stationary", series: { FY26: 0 } },
            { facility: "Doddballapura", sub_type: "Mobile",     series: { FY26: 0 } },
            { facility: "Doddballapura", sub_type: "Fugitive",   series: { FY26: 0 } },
          ],
          FOS: [
            { facility: "Hejjala",                   sub_type: "Stationary", series: { FY21: 44.2, FY22: 46.1, FY23: 48.3, FY24: 50.5, FY25: 52.8, FY26: 45.210 } },
            { facility: "Hejjala",                   sub_type: "Mobile",     series: { FY21: 26.5, FY22: 27.4, FY23: 28.1, FY24: 28.9, FY25: 24.1, FY26: 30.065 } },
            { facility: "Hejjala",                   sub_type: "Fugitive",   series: { FY21: 0.05, FY22: 0.05, FY23: 0.05, FY24: 0.06, FY25: 0.07, FY26: 0.167  } },
            { facility: "Kumbalagodu",               sub_type: "Stationary", series: { FY21: 19.8, FY22: 20.5, FY23: 21.4, FY24: 22.1, FY25: 23.4, FY26: 20.136 } },
            { facility: "Kumbalagodu",               sub_type: "Mobile",     series: { FY21: 11.2, FY22: 11.8, FY23: 12.2, FY24: 12.5, FY25: 11.0, FY26: 13.770 } },
            { facility: "Kumbalagodu",               sub_type: "Fugitive",   series: { FY21: 0,    FY22: 0,    FY23: 0,    FY24: 0,    FY25: 0,    FY26: 0       } },
            { facility: "Deepanjalinagar/Ramohalli", sub_type: "Stationary", series: { FY21: 7.2,  FY22: 7.6,  FY23: 7.9,  FY24: 8.2,  FY25: 8.5,  FY26: 3.566  } },
            { facility: "Deepanjalinagar/Ramohalli", sub_type: "Mobile",     series: { FY21: 3.8,  FY22: 4.0,  FY23: 4.2,  FY24: 4.3,  FY25: 3.8,  FY26: 2.387  } },
            { facility: "Deepanjalinagar/Ramohalli", sub_type: "Fugitive",   series: { FY21: 0,    FY22: 0,    FY23: 0,    FY24: 0,    FY25: 0,    FY26: 0       } },
            { facility: "Vasanth Nagar",             sub_type: "Stationary", series: { FY21: 4.8,  FY22: 5.0,  FY23: 5.2,  FY24: 5.4,  FY25: 5.6,  FY26: 2.973  } },
            { facility: "Vasanth Nagar",             sub_type: "Mobile",     series: { FY21: 2.6,  FY22: 2.7,  FY23: 2.8,  FY24: 2.9,  FY25: 2.5,  FY26: 1.991  } },
            { facility: "Vasanth Nagar",             sub_type: "Fugitive",   series: { FY21: 0,    FY22: 0,    FY23: 0,    FY24: 0,    FY25: 0,    FY26: 0       } },
            { facility: "Sriperumbudur",             sub_type: "Stationary", series: { FY21: 16.2, FY22: 17.0, FY23: 17.8, FY24: 18.3, FY25: 19.6, FY26: 20.515 } },
            { facility: "Sriperumbudur",             sub_type: "Mobile",     series: { FY21: 9.5,  FY22: 10.0, FY23: 10.4, FY24: 10.7, FY25: 9.4,  FY26: 13.300 } },
            { facility: "Sriperumbudur",             sub_type: "Fugitive",   series: { FY21: 0,    FY22: 0,    FY23: 0,    FY24: 0,    FY25: 0,    FY26: 0.002   } },
          ],
          FL: [
            { facility: "Rajanakunte",               sub_type: "Stationary", series: { FY26: 12.199 } },
            { facility: "Rajanakunte",               sub_type: "Mobile",     series: { FY26: 29.602 } },
            { facility: "Rajanakunte",               sub_type: "Fugitive",   series: { FY26: 0.023  } },
            { facility: "Hejjala",                   sub_type: "Stationary", series: { FY26: 45.210 } },
            { facility: "Hejjala",                   sub_type: "Mobile",     series: { FY26: 30.065 } },
            { facility: "Hejjala",                   sub_type: "Fugitive",   series: { FY26: 0.167  } },
            { facility: "Kumbalagodu",               sub_type: "Stationary", series: { FY26: 20.136 } },
            { facility: "Kumbalagodu",               sub_type: "Mobile",     series: { FY26: 13.770 } },
            { facility: "Deepanjalinagar/Ramohalli", sub_type: "Stationary", series: { FY26: 3.566  } },
            { facility: "Deepanjalinagar/Ramohalli", sub_type: "Mobile",     series: { FY26: 2.387  } },
            { facility: "Vasanth Nagar",             sub_type: "Stationary", series: { FY26: 2.973  } },
            { facility: "Vasanth Nagar",             sub_type: "Mobile",     series: { FY26: 1.991  } },
            { facility: "Sriperumbudur",             sub_type: "Stationary", series: { FY26: 20.515 } },
            { facility: "Sriperumbudur",             sub_type: "Mobile",     series: { FY26: 13.300 } },
            { facility: "Sriperumbudur",             sub_type: "Fugitive",   series: { FY26: 0.002  } },
          ],
        };
        return byFac[s1Ent] ?? byFac["FL"];
      }
      // breakdown view
      const s1Bd: Record<string, any[]> = {
        FP: [
          { source: "Stationary", fuel: "Diesel", series: { FY21: 9.8,  FY22: 10.4, FY23: 10.1, FY24: 9.9,  FY25: 10.3, FY26: 12.199 } },
          { source: "Mobile",     fuel: "Diesel", series: { FY21: 24.8, FY22: 26.3, FY23: 25.9, FY24: 25.4, FY25: 26.2, FY26: 29.602 } },
          { source: "Fugitive",   fuel: "CO2",    series: { FY21: 3.6,  FY22: 3.8,  FY23: 3.8,  FY24: 3.8,  FY25: 3.8,  FY26: 0.023  } },
        ],
        FOS: [
          { source: "Stationary", fuel: "Diesel", series: { FY21: 90.2,  FY22: 95.0,  FY23: 98.6,  FY24: 102.5, FY25: 107.3, FY26: 92.440 } },
          { source: "Stationary", fuel: "LPG",    series: { FY21: 0,     FY22: 0,     FY23: 0,     FY24: 0,     FY25: 0,     FY26: 0      } },
          { source: "Mobile",     fuel: "Diesel", series: { FY21: 37.2,  FY22: 39.4,  FY23: 40.4,  FY24: 42.1,  FY25: 41.8,  FY26: 61.513 } },
          { source: "Fugitive",   fuel: "CO2",    series: { FY21: 1.0,   FY22: 1.2,   FY23: 1.2,   FY24: 1.2,   FY25: 1.2,   FY26: 0.169  } },
        ],
        FL: [
          { source: "Stationary", fuel: "Diesel", series: { FY21: 100.0, FY22: 105.4, FY23: 108.7, FY24: 112.4, FY25: 117.6, FY26: 104.639 } },
          { source: "Mobile",     fuel: "Diesel", series: { FY21: 62.0,  FY22: 65.7,  FY23: 66.3,  FY24: 67.5,  FY25: 68.0,  FY26: 91.115  } },
          { source: "Fugitive",   fuel: "CO2",    series: { FY21: 4.6,   FY22: 5.0,   FY23: 5.0,   FY24: 5.0,   FY25: 5.0,   FY26: 0.192   } },
        ],
      };
      return s1Bd[s1Ent] ?? s1Bd["FL"];
    }
    case "ghg/s2.php": {
      const s2Qs = new URLSearchParams(path.split("?")[1] ?? "");
      const s2Ent = s2Qs.get("entity") ?? "FL";
      if (s2Qs.get("view") === "by_facility") {
        const s2ByFac: Record<string, any[]> = {
          FP: [
            { facility: "Rajanakunte", sub_type: "Grid Electricity", series: { FY21: 72.1, FY22: 78.4, FY23: 80.2, FY24: 82.6, FY25: 85.1, FY26: 84.313 } },
          ],
          FOS: [
            { facility: "Hejjala",                   sub_type: "Grid Electricity", series: { FY21: 980.2,  FY22: 1010.5, FY23: 1045.3, FY24: 1078.2, FY25: 1098.6, FY26: 1118.3  } },
            { facility: "Kumbalagodu",               sub_type: "Grid Electricity", series: { FY21: 440.5,  FY22: 458.2,  FY23: 472.6,  FY24: 486.3,  FY25: 496.8,  FY26: 505.2   } },
            { facility: "Deepanjalinagar/Ramohalli", sub_type: "Grid Electricity", series: { FY21: 186.4,  FY22: 194.5,  FY23: 200.8,  FY24: 206.5,  FY25: 210.8,  FY26: 188.7   } },
            { facility: "Vasanth Nagar",             sub_type: "Grid Electricity", series: { FY21: 124.8,  FY22: 128.6,  FY23: 132.4,  FY24: 136.1,  FY25: 138.9,  FY26: 141.2   } },
            { facility: "Sriperumbudur",             sub_type: "Grid Electricity", series: { FY21: 248.6,  FY22: 258.5,  FY23: 259.7,  FY24: 258.3,  FY25: 265.5,  FY26: 282.269 } },
          ],
          FL: [
            { facility: "Rajanakunte",               sub_type: "Grid Electricity", series: { FY26: 84.313  } },
            { facility: "Hejjala",                   sub_type: "Grid Electricity", series: { FY26: 1118.3  } },
            { facility: "Kumbalagodu",               sub_type: "Grid Electricity", series: { FY26: 505.2   } },
            { facility: "Deepanjalinagar/Ramohalli", sub_type: "Grid Electricity", series: { FY26: 188.7   } },
            { facility: "Vasanth Nagar",             sub_type: "Grid Electricity", series: { FY26: 141.2   } },
            { facility: "Sriperumbudur",             sub_type: "Grid Electricity", series: { FY26: 282.269 } },
          ],
        };
        return s2ByFac[s2Ent] ?? s2ByFac["FL"];
      }
      // standard breakdown
      const s2Std: Record<string, any[]> = {
        FP: [
          { type: "location_based", series: { FY21: 72.1,   FY22: 78.4,   FY23: 80.2,   FY24: 82.6,   FY25: 85.1,   FY26: 84.313   } },
          { type: "market_based",   series: { FY21: 72.1,   FY22: 78.4,   FY23: 80.2,   FY24: 82.6,   FY25: 85.1,   FY26: 84.313   } },
          { type: "grid_kwh",       series: { FY21: 101550, FY22: 110380, FY23: 112940, FY24: 116280, FY25: 119840, FY26: 118750   } },
          { type: "re_kwh",         series: { FY21: 0,      FY22: 0,      FY23: 18000,  FY24: 42000,  FY25: 62000,  FY26: 75123    } },
        ],
        FOS: [
          { type: "location_based", series: { FY21: 1980.5, FY22: 2050.3, FY23: 2110.8, FY24: 2165.4, FY25: 2210.6, FY26: 2235.669 } },
          // MB → 0 in FY26 via Wind PPA + I-RECs
          { type: "market_based",   series: { FY21: 1980.5, FY22: 1850.2, FY23: 1420.6, FY24: 860.3,  FY25: 320.1,  FY26: 0        } },
          { type: "grid_kwh",       series: { FY21: 2788000, FY22: 2887000, FY23: 2971000, FY24: 3047000, FY25: 3111000, FY26: 3147000 } },
          { type: "re_kwh",         series: { FY21: 0,       FY22: 0,       FY23: 580000,  FY24: 1950000, FY25: 3480000, FY26: 4610000 } },
        ],
        FL: [
          { type: "location_based", series: { FY21: 2052.6, FY22: 2128.7, FY23: 2191.0, FY24: 2248.0, FY25: 2295.7, FY26: 2319.982 } },
          { type: "market_based",   series: { FY21: 2052.6, FY22: 1928.6, FY23: 1500.8, FY24: 942.9,  FY25: 405.2,  FY26: 84.313   } },
          { type: "grid_kwh",       series: { FY21: 2889550, FY22: 2997380, FY23: 3083940, FY24: 3163280, FY25: 3230840, FY26: 3265750 } },
          { type: "re_kwh",         series: { FY21: 0,       FY22: 0,       FY23: 598000,  FY24: 1992000, FY25: 3542000, FY26: 4685123 } },
        ],
      };
      return s2Std[s2Ent] ?? s2Std["FL"];
    }
    case "ghg/s3.php": {
      const s3Qs  = new URLSearchParams(path.split("?")[1] ?? "");
      const s3Ent = s3Qs.get("entity") ?? "FL";
      const s3Data: Record<string, any[]> = {
        FP: [
          { entity: "FP", category: "Cat 1",  series: {                FY26: 4.751   } },
          { entity: "FP", category: "Cat 2",  series: { FY23: 340.5, FY24: 355.2, FY25: 368.1, FY26: 379.050 } },
          { entity: "FP", category: "Cat 3",  series: { FY23: 22.4,  FY24: 24.1,  FY25: 25.6,  FY26: 26.909  } },
          { entity: "FP", category: "Cat 5",  series: { FY23: 0.3,   FY24: 0.4,   FY25: 0.45,  FY26: 0.480   } },
          { entity: "FP", category: "Cat 6",  series: { FY23: 4.1,   FY24: 4.4,   FY25: 4.6,   FY26: 4.802   } },
          { entity: "FP", category: "Cat 7",  series: { FY23: 72.9,  FY24: 71.7,  FY25: 69.7,  FY26: 60.368  } },
        ],
        FOS: [
          { entity: "FOS", category: "Cat 1",  series: { FY23: 15200.5, FY24: 15450.2, FY25: 14980.6, FY26: 14920.938 } },
          { entity: "FOS", category: "Cat 2",  series: { FY23: 62.1,    FY24: 68.4,    FY25: 71.2,    FY26: 74.436   } },
          { entity: "FOS", category: "Cat 3",  series: { FY23: 480.2,   FY24: 498.6,   FY25: 515.4,   FY26: 531.082  } },
          { entity: "FOS", category: "Cat 4",  series: { FY23: 88.5,    FY24: 92.3,    FY25: 95.8,    FY26: 98.218   } },
          { entity: "FOS", category: "Cat 5",  series: { FY23: 1.6,     FY24: 1.7,     FY25: 1.9,     FY26: 1.961    } },
          { entity: "FOS", category: "Cat 6",  series: { FY23: 82.4,    FY24: 88.6,    FY25: 92.1,    FY26: 96.203   } },
          { entity: "FOS", category: "Cat 7",  series: { FY23: 870.5,   FY24: 890.2,   FY25: 910.4,   FY26: 928.651  } },
          { entity: "FOS", category: "Cat 9",  series: { FY23: 1810.6,  FY24: 1875.2,  FY25: 1920.5,  FY26: 1958.643 } },
          { entity: "FOS", category: "Cat 11", series: { FY23: 42.5,    FY24: 43.8,    FY25: 44.2,    FY26: 44.786   } },
          { entity: "FOS", category: "Cat 12", series: { FY23: 3.5,     FY24: 3.6,     FY25: 3.7,     FY26: 3.794    } },
        ],
        FL: [
          { entity: "FL", category: "Cat 1",  series: { FY23: 15200.5, FY24: 15450.2, FY25: 14980.6, FY26: 14925.689 } },
          { entity: "FL", category: "Cat 2",  series: { FY23: 402.6,   FY24: 423.6,   FY25: 439.3,   FY26: 453.486  } },
          { entity: "FL", category: "Cat 3",  series: { FY23: 502.6,   FY24: 522.7,   FY25: 541.0,   FY26: 557.991  } },
          { entity: "FL", category: "Cat 4",  series: { FY23: 88.5,    FY24: 92.3,    FY25: 95.8,    FY26: 98.218   } },
          { entity: "FL", category: "Cat 5",  series: { FY23: 2.0,     FY24: 2.1,     FY25: 2.35,    FY26: 2.441    } },
          { entity: "FL", category: "Cat 6",  series: { FY23: 86.5,    FY24: 93.0,    FY25: 96.7,    FY26: 101.005  } },
          { entity: "FL", category: "Cat 7",  series: { FY23: 943.4,   FY24: 961.9,   FY25: 980.1,   FY26: 989.019  } },
          { entity: "FL", category: "Cat 9",  series: { FY23: 1810.6,  FY24: 1875.2,  FY25: 1920.5,  FY26: 1958.643 } },
          { entity: "FL", category: "Cat 11", series: { FY23: 42.5,    FY24: 43.8,    FY25: 44.2,    FY26: 44.786   } },
          { entity: "FL", category: "Cat 12", series: { FY23: 3.5,     FY24: 3.6,     FY25: 3.7,     FY26: 3.794    } },
        ],
      };
      return s3Data[s3Ent] ?? s3Data["FL"];
    }
    case "ghg/intensity.php": {
      const intQs  = new URLSearchParams(path.split("?")[1] ?? "");
      const intEnt = intQs.get("entity") ?? "FL";
      const intData: Record<string, any[]> = {
        FP: [
          { fy: "FY21", revenue_lakh: 28500, production_units: 82000,  s12_lb: 110.3,  s12_mb: 110.3,  s3_total: null    },
          { fy: "FY22", revenue_lakh: 31200, production_units: 88000,  s12_lb: 118.9,  s12_mb: 118.9,  s3_total: null    },
          { fy: "FY23", revenue_lakh: 34800, production_units: 94000,  s12_lb: 120.0,  s12_mb: 120.0,  s3_total: 440.2   },
          { fy: "FY24", revenue_lakh: 37200, production_units: 99000,  s12_lb: 121.7,  s12_mb: 121.7,  s3_total: 455.8   },
          { fy: "FY25", revenue_lakh: 38500, production_units: 102000, s12_lb: 125.4,  s12_mb: 125.4,  s3_total: 468.4   },
          { fy: "FY26", revenue_lakh: 40000, production_units: 105000, s12_lb: 126.137,s12_mb: 126.137,s3_total: 476.361 },
        ],
        FOS: [
          { fy: "FY21", revenue_lakh: null,  production_units: null, s12_lb: 2108.9,  s12_mb: 2108.9,  s3_total: null      },
          { fy: "FY22", revenue_lakh: null,  production_units: null, s12_lb: 2185.9,  s12_mb: 2055.8,  s3_total: null      },
          { fy: "FY23", revenue_lakh: null,  production_units: null, s12_lb: 2251.0,  s12_mb: 1821.5,  s3_total: 17250.4   },
          { fy: "FY24", revenue_lakh: null,  production_units: null, s12_lb: 2311.2,  s12_mb: 1155.8,  s3_total: 17680.2   },
          { fy: "FY25", revenue_lakh: null,  production_units: null, s12_lb: 2360.9,  s12_mb: 620.1,   s3_total: 18120.5   },
          { fy: "FY26", revenue_lakh: null,  production_units: null, s12_lb: 2389.791,s12_mb: 154.122, s3_total: 18658.712 },
        ],
        FL: [
          { fy: "FY21", revenue_lakh: 58500,  production_units: null, s12_lb: 2219.2,  s12_mb: 2219.2,  s3_total: null      },
          { fy: "FY22", revenue_lakh: 63200,  production_units: null, s12_lb: 2304.8,  s12_mb: 2174.7,  s3_total: null      },
          { fy: "FY23", revenue_lakh: 71800,  production_units: null, s12_lb: 2371.0,  s12_mb: 1941.5,  s3_total: 17690.6   },
          { fy: "FY24", revenue_lakh: 78200,  production_units: null, s12_lb: 2432.9,  s12_mb: 1277.5,  s3_total: 18136.0   },
          { fy: "FY25", revenue_lakh: 85500,  production_units: null, s12_lb: 2486.3,  s12_mb: 745.3,   s3_total: 18588.9   },
          { fy: "FY26", revenue_lakh: 100000, production_units: null, s12_lb: 2515.928,s12_mb: 280.259, s3_total: 19135.073 },
        ],
      };
      return intData[intEnt] ?? intData["FL"];
    }
    // ── Decarbonisation planning endpoints ────────────────────────────────────
    case "decarb/actions.php":
      return [
        { id: 1, title: "Captive Wind Energy — Rajanakunte Plant (500 kWp)",        status: "Completed",   timeline: "FY24", abatement_t: 195, entity: "FP",  cost_lakh: 420, co2_intensity: null },
        { id: 2, title: "Rooftop Solar Phase I — Hejjala Plant (250 kWp)",          status: "Completed",   timeline: "FY24", abatement_t: 110, entity: "FOS", cost_lakh: 185, co2_intensity: null },
        { id: 3, title: "LED Retrofit — All Manufacturing Plants",                   status: "Completed",   timeline: "FY23", abatement_t: 45,  entity: "FL",  cost_lakh: 28,  co2_intensity: null },
        { id: 4, title: "Rooftop Solar Phase II — Hejjala Plant (400 kWp)",         status: "In Progress", timeline: "FY26", abatement_t: 175, entity: "FOS", cost_lakh: 310, co2_intensity: null },
        { id: 5, title: "Fleet Electrification — Replace 5 Diesel LCVs with EVs",  status: "In Progress", timeline: "FY27", abatement_t: 65,  entity: "FL",  cost_lakh: 95,  co2_intensity: null },
        { id: 6, title: "Refrigerant Transition R-410A → R-32 (All Plants)",        status: "Planned",     timeline: "FY27", abatement_t: 50,  entity: "FL",  cost_lakh: 35,  co2_intensity: null },
        { id: 7, title: "Supplier Engagement Programme — Cat 1 Tier-1 Suppliers",   status: "Planned",     timeline: "FY27", abatement_t: 120, entity: "FL",  cost_lakh: 15,  co2_intensity: null },
        { id: 8, title: "Green Building Certification (LEED Gold) — Sriperumbudur", status: "Planned",     timeline: "FY28", abatement_t: 40,  entity: "FOS", cost_lakh: 50,  co2_intensity: null },
      ];
    // ── Credits / I-REC endpoints ─────────────────────────────────────────────
    case "credits/irec.php":
      return [
        { id: 1, fy: "FY26", entity: "FOS", facility: "Hejjala Plant — Rooftop Solar Phase I",    status: "Retired",  mwh: 585,  coverage: 55, vintage: "FY26", instrument: "I-REC Standard — IREC-FOS-HJ-2026"  },
        { id: 2, fy: "FY26", entity: "FP",  facility: "Rajanakunte Plant — Captive Wind",          status: "Retired",  mwh: 1240, coverage: 40, vintage: "FY26", instrument: "BESCOM Green Tariff — BESCOM-GT-FP-FY26" },
        { id: 3, fy: "FY25", entity: "FOS", facility: "Hejjala Plant — Rooftop Solar Phase I",    status: "Retired",  mwh: 480,  coverage: 50, vintage: "FY25", instrument: "I-REC Standard — IREC-FOS-HJ-2025"  },
        { id: 4, fy: "FY25", entity: "FP",  facility: "Rajanakunte Plant — Captive Wind",          status: "Retired",  mwh: 1050, coverage: 38, vintage: "FY25", instrument: "BESCOM Green Tariff — BESCOM-GT-FP-FY25" },
        { id: 5, fy: "FY24", entity: "FOS", facility: "Hejjala Plant — Rooftop Solar Phase I",    status: "Retired",  mwh: 320,  coverage: 30, vintage: "FY24", instrument: "I-REC Standard — IREC-FOS-HJ-2024"  },
      ];
    case "credits/grid-mwh.php":
      return {
        "FP":  { FY21: 950,  FY22: 1005, FY23: 1040, FY24: 995,  FY25: 930,  FY26: 860  },
        "FOS": { FY21: 730,  FY22: 775,  FY23: 800,  FY24: 760,  FY25: 710,  FY26: 660  },
        "FL":  { FY21: 1680, FY22: 1780, FY23: 1840, FY24: 1755, FY25: 1640, FY26: 1520 },
      };
    // ── Document vault ────────────────────────────────────────────────────────
    case "vault.php":
      return [
        { id: 1, entity: "FL",  fy: "FY25", title: "GHG Inventory Report FY25 — Featherlite (FP + FOS)", type: "ghg_report",      drive_link: "#demo", uploaded_at: "2026-05-20" },
        { id: 2, entity: "FL",  fy: "FY24", title: "GHG Inventory Report FY24 — Featherlite (FP + FOS)", type: "ghg_report",      drive_link: "#demo", uploaded_at: "2025-06-18" },
        { id: 3, entity: "FL",  fy: "FY23", title: "GHG Inventory Report FY23 — Featherlite (FP + FOS)", type: "ghg_report",      drive_link: "#demo", uploaded_at: "2024-07-02" },
        { id: 4, entity: "FP",  fy: "FY25", title: "Energy Audit Report FY25 — Rajanakunte Plant",        type: "energy_audit",    drive_link: "#demo", uploaded_at: "2026-03-15" },
        { id: 5, entity: "FOS", fy: "FY25", title: "Energy Audit Report FY25 — Hejjala Plant",            type: "energy_audit",    drive_link: "#demo", uploaded_at: "2026-04-10" },
        { id: 6, entity: "FL",  fy: "FY25", title: "SBTi Commitment Letter — Featherlite",                type: "commitment",      drive_link: "#demo", uploaded_at: "2025-09-01" },
        { id: 7, entity: "FL",  fy: "FY24", title: "CDP Climate Questionnaire FY24",                       type: "external_report", drive_link: "#demo", uploaded_at: "2025-08-30" },
        { id: 8, entity: "FL",  fy: "FY25", title: "BRSR Sustainability Disclosures FY25",                 type: "external_report", drive_link: "#demo", uploaded_at: "2026-07-05" },
      ];
    // ── Team management ───────────────────────────────────────────────────────
    case "team.php": {
      const teamMethod = (options.method ?? "GET").toUpperCase();
      if (teamMethod === "POST") return { temp_password: "Demo@2026", email_sent: false };
      if (teamMethod === "DELETE") return { ok: true };
      return [
        { id: 1, email: "green@deepwoodsgreen.com",           role: "sustainability_team", entity_scope: null,  must_change_password: false, created_at: "2025-04-01" },
        { id: 2, email: "sustainability@featherlite.com",      role: "sustainability_team", entity_scope: null,  must_change_password: false, created_at: "2025-04-01" },
        { id: 3, email: "leadership@featherlite.com",          role: "client_leadership",   entity_scope: null,  must_change_password: false, created_at: "2025-06-15" },
        { id: 4, email: "data.fp@featherlite.com",             role: "client_uploader",     entity_scope: "FP",  must_change_password: false, created_at: "2025-07-01" },
        { id: 5, email: "data.fos@featherlite.com",            role: "client_uploader",     entity_scope: "FOS", must_change_password: false, created_at: "2025-07-01" },
      ];
    }
    // ── Priority actions & notifications ──────────────────────────────────────
    case "priority-items.php":
      return [
        { id: 1, type: "action", entity: "FOS", title: "Submit Q2 FY26 electricity readings — Hejjala",   priority: "high",   age: 14, detail: "BESCOM HT meter reading overdue by 14 days",              link: "/submissions", tag: "Data Collection" },
        { id: 2, type: "update", entity: "FL",  title: "SBTi commitment acknowledgement received",         priority: "info",   age: 2,  detail: "Featherlite's net-zero 2040 target acknowledged by SBTi", link: "/reports",     tag: "Targets" },
        { id: 3, type: "action", entity: "FP",  title: "Upload FY25 energy audit — Rajanakunte Plant",     priority: "medium", age: 38, detail: "Mandatory for BRSR disclosure. Upload to vault.",         link: "/vault",       tag: "Reporting" },
        { id: 4, type: "action", entity: "FOS", title: "Review Scope 3 Cat 1 supplier data — FY26",        priority: "medium", age: 5,  detail: "3 key suppliers yet to submit FY26 emissions data",       link: "/data-tracker",tag: "Data Quality" },
        { id: 5, type: "update", entity: "FL",  title: "Rooftop Solar Phase II commissioning on track",     priority: "info",   age: 7,  detail: "400 kWp Hejjala Phase II expected to commission Oct 26",  link: "/action-plan", tag: "Decarbonisation" },
      ];
    case "notification-prefs.php": {
      if ((options.method ?? "GET").toUpperCase() === "POST") return { ok: true };
      return { prefs: { enabled: true, frequency: "weekly", custom_date: null, send_time: "09:00", include_actions: true, include_updates: true, last_sent_at: null } };
    }
    case "send-notification.php":
      return { ok: true };
    case "ghg/scope3-upload.php": {
      const form = options.body as FormData;
      const files: { name: string; driveLink: string }[] = [];
      for (const f of form.getAll("files[]")) {
        if (f instanceof File && f.name) files.push({ name: f.name, driveLink: "#demo" });
      }
      return { files };
    }
    default:
      return { ok: true, demo: true };
  }
}

const TOKEN_KEY = "decarb_session_token";
const ROLE_KEY = "decarb_role";
const EMAIL_KEY = "decarb_email";
const MUST_CHANGE_KEY = "decarb_must_change_password";
const ENTITY_SCOPE_KEY = "decarb_entity_scope";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function getRole(): Role | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(ROLE_KEY) as Role) || null;
}
export function getEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EMAIL_KEY);
}
// Set only for a user locked to one entity (e.g. an entity admin) — null for org-wide access.
export function getEntityScope(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ENTITY_SCOPE_KEY) || null;
}
export function getMustChangePassword(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUST_CHANGE_KEY) === "1";
}
export function setMustChangePassword(v: boolean) {
  localStorage.setItem(MUST_CHANGE_KEY, v ? "1" : "0");
}

function setSession(token: string, role: Role, email: string, mustChangePassword: boolean, entityScope: string | null = null) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(EMAIL_KEY, email);
  localStorage.setItem(MUST_CHANGE_KEY, mustChangePassword ? "1" : "0");
  if (entityScope) localStorage.setItem(ENTITY_SCOPE_KEY, entityScope);
  else localStorage.removeItem(ENTITY_SCOPE_KEY);
}

function clearSession() {
  localStorage.removeItem(DEMO_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(ENTITY_SCOPE_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(MUST_CHANGE_KEY);
  clearClientContext(); // wipe cached ClientContext so next login loads fresh
}

// Shared fetch helper — attaches the session token, throws with the
// server's error message on failure.
export async function authFetch(path: string, options: RequestInit = {}): Promise<any> {
  const demoMode = isDemo();
  if (demoMode) return demoFetch(path, options);
  const token = getToken();
  const viewAs = typeof window !== "undefined" ? localStorage.getItem("decarb_dwa_view") : null;
  const res = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(viewAs ? { "X-View-As": viewAs } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & { fields?: Record<string, string>; status?: number };
    err.fields = data.fields;
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function login(email: string, password: string): Promise<void> {
  const data = await authFetch("login.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  setSession(data.token, data.role, data.email, data.mustChangePassword, data.entity_scope ?? null);
}

export async function logout(): Promise<void> {
  try {
    await authFetch("logout.php", { method: "POST" });
  } catch {
    // even if the server call fails, still clear the local session
  }
  clearSession();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await authFetch("change-password.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  setMustChangePassword(false);
}

export async function forgotPassword(email: string): Promise<void> {
  await authFetch("forgot-password.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await authFetch("reset-password.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
}
