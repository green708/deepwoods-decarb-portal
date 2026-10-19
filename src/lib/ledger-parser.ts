import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LedgerParseResult {
  year: string;
  entity: string;
  ghgInventory: { metric_key: string; metric_value: number }[];
  s1ByFacility: { facility: string; sub_type: string; tco2e: number }[];
  s2ByFacility: { facility: string; tco2e_lb: number; tco2e_mb: number }[];
  s2Breakdown: { grid_kwh: number; re_kwh: number; tco2e_lb: number; tco2e_mb: number };
  scope3Summary: { category: string; tco2e: number }[];
  intensityMetrics: {
    revenue_lakh: number | null;
    production_units: number | null;
    s12_lb: number | null;
    s12_mb: number | null;
    s3_total: number | null;
  } | null;
  trackerAssets: {
    asset_id: string;
    name: string;
    facility: string;
    scope: string;
    sub_type: string;
    unit: string;
    fuel_type?: string;
  }[];
  trackerDrafts: { asset_id: string; period: string; value: number }[];
  // Extended fields for client template format
  decarbActions?: {
    entity: string; facility: string | null; title: string; lever: string;
    status: string; target_year: string | null; abatement_t: number | null;
    capex: number | null; capex_currency: string | null; notes: string | null;
  }[];
  irecRegister?: {
    entity: string; facility: string | null; year: string;
    mwh: number; vintage: string | null; instrument: string | null; status: string;
  }[];
  peerData?: {
    name: string; fy: string;
    scope12: number | null; scope3_total: number | null;
    intensity_revenue: number | null;
  }[];
  warnings: string[];
  facilityCount: number;
  monthlyEntries: number;
  templateFormat?: "client-template" | "facility-sheets";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, string> = {
  january: "JAN", february: "FEB", march: "MAR", april: "APR",
  may: "MAY", june: "JUN", july: "JUL", august: "AUG",
  september: "SEP", october: "OCT", november: "NOV", december: "DEC",
};

// Month index (0-based, JAN=0)
const MONTH_IDX: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function toRows(ws: XLSX.WorkSheet): unknown[][] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: false });
  return (raw as unknown[][]).filter(r => r.some(c => c !== ""));
}

function findCol(headers: unknown[], patterns: RegExp[]): number {
  return headers.findIndex(h => patterns.some(p => p.test(String(h ?? ""))));
}

function parseMonthLabel(label: string, reportingPeriod: "FY" | "CY", fyNum: number): string | null {
  const clean = String(label ?? "").replace(/'/g, "").trim().toLowerCase();
  if (!clean || /^(total|month|sub.?total)$/.test(clean)) return null;

  // "april-24" or "april 24" or "april-2024"
  const m1 = clean.match(/^([a-z]+)[\s-](\d{2,4})$/);
  if (m1) {
    const k = MONTH_NAMES[m1[1]];
    if (k) return `${k}-${m1[2].slice(-2)}`;
  }

  // Bare month name — derive year from fiscal year number
  const monthKey = MONTH_NAMES[clean];
  if (!monthKey) return null;
  const mIdx = MONTH_IDX[monthKey];
  const fyEndYear = fyNum < 100 ? 2000 + fyNum : fyNum;

  if (reportingPeriod === "CY") {
    return `${monthKey}-${String(fyEndYear).slice(-2)}`;
  }
  // FY: months Apr(3)–Dec(11) are in year N-1; Jan(0)–Mar(2) are year N
  const calYear = mIdx >= 3 ? fyEndYear - 1 : fyEndYear;
  return `${monthKey}-${String(calYear).slice(-2)}`;
}

function normalizeMetricKey(label: string): string | null {
  const l = String(label).toLowerCase().trim();
  if (/^scope\s*1/.test(l)) return "Scope 1";
  if (/scope\s*2.*(location|lb)/.test(l)) return "Scope 2 LB";
  if (/scope\s*2.*(market|mb)/.test(l)) return "Scope 2 MB";
  if (/scope\s*3.*(total|sub.?total)/.test(l) || /^scope\s*3$/.test(l)) return "Scope 3 Total";
  if (/grand.*total.*location|total.*s1.*s2.*location/.test(l)) return "Grand Total LB";
  if (/grand.*total.*market|total.*s1.*s2.*market/.test(l)) return "Grand Total MB";
  if (/grand.*total/.test(l)) return "Grand Total LB";
  const catM = l.match(/^cat\s*(\d+)\s*[-–\s]/);
  if (catM) return `Cat ${catM[1]}`;
  return null;
}

interface ColDef {
  name: string;
  scope: "Scope 1" | "Scope 2";
  sub_type: string;
  unit: string;
  fuel_type?: string;
  periodSuffix?: string; // e.g. "__lb" for S2 LB
}

function classifyFuelColumn(header: string): ColDef | null {
  const h = String(header).trim();
  // Skip derived/aggregate columns
  if (/emission|tco2e|total\s*(lb|mb)?|annual|re\s*%|fraction|kgco2/i.test(h)) return null;
  if (/info[\s(]|only/i.test(h) && /solar|wind/i.test(h)) return null; // info-only RE

  const hl = h.toLowerCase();
  // S1 Mobile
  if (/company\s*vehicle|fleet\s*vehicle/i.test(h)) return { name: "Company Vehicles (Fleet)", scope: "Scope 1", sub_type: "Mobile", unit: "L", fuel_type: "HSD Diesel" };
  if (/forklift/i.test(h)) return { name: "Forklifts", scope: "Scope 1", sub_type: "Mobile", unit: "L", fuel_type: "HSD Diesel" };
  // S1 Stationary
  if (/dg\s*set|diesel.*generat|generat.*diesel/i.test(h)) return { name: "DG Set", scope: "Scope 1", sub_type: "Stationary", unit: "L", fuel_type: "HSD Diesel" };
  if (/pc\s*oven.*diesel/i.test(h)) return { name: "PC Oven (Diesel)", scope: "Scope 1", sub_type: "Stationary", unit: "L", fuel_type: "HSD Diesel" };
  if (/pc\s*oven.*lpg/i.test(h)) return { name: "PC Oven (LPG)", scope: "Scope 1", sub_type: "Stationary", unit: "kg", fuel_type: "LPG" };
  if (/\blpg\b.*(?:boiler|heater|furnac)/i.test(h)) return { name: "LPG Boiler", scope: "Scope 1", sub_type: "Stationary", unit: "kg", fuel_type: "LPG" };
  if (/\blpg\b/i.test(h) && !/pc\s*oven/i.test(h)) return { name: "LPG", scope: "Scope 1", sub_type: "Stationary", unit: "kg", fuel_type: "LPG" };
  if (/natural\s*gas/i.test(h)) return { name: "Natural Gas", scope: "Scope 1", sub_type: "Stationary", unit: "m³", fuel_type: "Natural Gas" };
  // S1 Fugitive
  if (/fire\s*ext|co2\s*fire\s*ext|co2.*recharge.*fire|fire.*co2/i.test(h)) return { name: "Fire Extinguisher CO2", scope: "Scope 1", sub_type: "Fugitive", unit: "kg" };
  if (/welding.*co2|co2.*welding/i.test(h)) return { name: "Welding CO2", scope: "Scope 1", sub_type: "Fugitive", unit: "kg" };
  if (/hcfc.*recharge|r-?22.*recharge|recharge.*hcfc|recharge.*r-?22/i.test(h)) return { name: "HCFC Fire Extinguisher", scope: "Scope 1", sub_type: "Fugitive", unit: "kg" };
  if (/r-?410a.*recharge|recharge.*r-?410|hvac.*r-?410/i.test(h)) return { name: "R-410A HVAC", scope: "Scope 1", sub_type: "Fugitive", unit: "kg" };
  if (/hcfc|r-?22/i.test(h)) return { name: "HCFC Refrigerant", scope: "Scope 1", sub_type: "Fugitive", unit: "kg" };
  if (/r-?410a/i.test(h)) return { name: "R-410A HVAC", scope: "Scope 1", sub_type: "Fugitive", unit: "kg" };
  if (/refrigerant/i.test(h)) return { name: "Refrigerant", scope: "Scope 1", sub_type: "Fugitive", unit: "kg" };
  // S2
  if (/electricity.*purchased|purchased.*electricity|grid.*kwh|kwh.*grid|bescom.*grid|tangedco|mescom|pepco|ppl\s*grid|peco/i.test(h) && !/diesel.*generat|dg.*source/i.test(h) && !/onsite|captive|solar(?!\s*consumed|exported)/i.test(h)) {
    return { name: "Grid Electricity", scope: "Scope 2", sub_type: "electricity", unit: "kWh", periodSuffix: "__lb" };
  }
  if (/diesel.*generat.*source|dg.*sourced.*kwh|generat.*kwh/i.test(h)) return { name: "DG Set (kWh)", scope: "Scope 2", sub_type: "electricity", unit: "kWh", periodSuffix: "__lb" };
  if (/onsite\s*solar.*consumed|solar.*consumed/i.test(h)) return { name: "Onsite Solar Consumed", scope: "Scope 2", sub_type: "onsite-solar", unit: "kWh" };
  if (/onsite\s*solar(?!.*wind)/i.test(h) && !/info|only/i.test(h)) return { name: "Onsite Solar", scope: "Scope 2", sub_type: "onsite-solar", unit: "kWh" };
  if (/captive\s*wind/i.test(h) && !/info|only/i.test(h)) return { name: "Captive Wind", scope: "Scope 2", sub_type: "captive-wind", unit: "kWh" };
  // Diesel (generic fallback for S1 stationary)
  if (/diesel.*consumption|diesel.*litre|\blitre.*diesel/i.test(h)) return { name: "Diesel", scope: "Scope 1", sub_type: "Stationary", unit: "L", fuel_type: "HSD Diesel" };

  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function parseLedger(
  file: File,
  entity: string,
  reportingPeriod: "FY" | "CY",
  clientId: number,
): Promise<LedgerParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        resolve(parseWorkbook(wb, entity, reportingPeriod, clientId));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

// ── Workbook dispatcher ───────────────────────────────────────────────────────

function isClientTemplate(wb: XLSX.WorkBook): boolean {
  const names = wb.SheetNames.map(n => n.toLowerCase());
  return names.includes("ghg_inventory") || names.includes("s1_breakdown");
}

function numericYearToFY(year: number | string): string {
  const y = typeof year === "number" ? year : parseInt(String(year), 10);
  if (isNaN(y)) return "";
  return `FY${String(y).slice(-2)}`;
}

function parseWorkbook(
  wb: XLSX.WorkBook,
  entity: string,
  reportingPeriod: "FY" | "CY",
  clientId: number,
): LedgerParseResult {
  const warnings: string[] = [];
  const result: LedgerParseResult = {
    year: "", entity,
    ghgInventory: [], s1ByFacility: [], s2ByFacility: [],
    s2Breakdown: { grid_kwh: 0, re_kwh: 0, tco2e_lb: 0, tco2e_mb: 0 },
    scope3Summary: [], intensityMetrics: null,
    trackerAssets: [], trackerDrafts: [], warnings,
    facilityCount: 0, monthlyEntries: 0,
  };

  if (isClientTemplate(wb)) {
    return parseClientTemplate(wb, entity, reportingPeriod, clientId, warnings);
  }

  const seenFacilities = new Set<string>();

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = toRows(ws);
    if (!rows.length) continue;

    if (/consolidated summary/i.test(name)) {
      parseConsolidatedSummary(rows, result);
    } else if (/dashboard/i.test(name) && !/scope\s*3/i.test(name)) {
      parseDashboard(rows, result);
    } else if (/scope\s*3.*dashboard/i.test(name) || /dashboard.*scope\s*3/i.test(name)) {
      parseScope3Dashboard(rows, result);
    } else if (/emission.*intensity|intensity.*emiss/i.test(name)) {
      parseIntensity(rows, result);
    } else if (
      !/index/i.test(name) &&
      !/emission\s*factor/i.test(name) &&
      !/monthly\s*intensity/i.test(name) &&
      !/^cat\s*\d+/i.test(name)
    ) {
      const fCount = parseFacilitySheet(name, rows, result, entity, reportingPeriod, clientId, warnings);
      if (fCount > 0) seenFacilities.add(name);
    }
  }

  result.facilityCount = seenFacilities.size;
  result.monthlyEntries = result.trackerDrafts.length;

  // Compute Grand Totals if not already present
  const has = (k: string) => result.ghgInventory.some(r => r.metric_key === k);
  if (result.ghgInventory.length && !has("Grand Total LB")) {
    const s1  = result.ghgInventory.find(r => r.metric_key === "Scope 1")?.metric_value ?? 0;
    const s2lb = result.ghgInventory.find(r => r.metric_key === "Scope 2 LB")?.metric_value ?? 0;
    const s3  = result.ghgInventory.find(r => r.metric_key === "Scope 3 Total")?.metric_value ?? 0;
    result.ghgInventory.push({ metric_key: "Grand Total LB", metric_value: s1 + s2lb + s3 });
  }
  if (result.ghgInventory.length && !has("Grand Total MB")) {
    const s1  = result.ghgInventory.find(r => r.metric_key === "Scope 1")?.metric_value ?? 0;
    const s2mb = result.ghgInventory.find(r => r.metric_key === "Scope 2 MB")?.metric_value ?? 0;
    const s3  = result.ghgInventory.find(r => r.metric_key === "Scope 3 Total")?.metric_value ?? 0;
    result.ghgInventory.push({ metric_key: "Grand Total MB", metric_value: s1 + s2mb + s3 });
  }

  return result;
}

// ── Sheet parsers ─────────────────────────────────────────────────────────────

function parseConsolidatedSummary(rows: unknown[][], result: LedgerParseResult) {
  // Year from title row
  const titleText = rows.slice(0, 3).map(r => String(r[0] ?? "") + " " + String(r[1] ?? "")).join(" ");
  const yearM = titleText.match(/\b(FY\d{2,4}|CY\d{4})\b/i);
  if (yearM && !result.year) result.year = yearM[1].toUpperCase();

  // Header row: contains "Scope / Category" or similar
  const hIdx = rows.findIndex(r => r.some(c => /scope.*category|sl\.?\s*no/i.test(String(c))));
  if (hIdx < 0) return;

  const headers = rows[hIdx];
  const catCol = findCol(headers, [/scope.*category|category/i]);
  const valCol = findCol(headers, [/tco2e|t\s*co2/i]);
  if (catCol < 0 || valCol < 0) return;

  for (const row of rows.slice(hIdx + 1)) {
    const label = String(row[catCol] ?? "").trim();
    const v = num(row[valCol]);
    if (!label || v === null || isNaN(v)) continue;
    const key = normalizeMetricKey(label);
    if (key && !result.ghgInventory.find(r => r.metric_key === key)) {
      result.ghgInventory.push({ metric_key: key, metric_value: v });
    }
  }
}

function parseDashboard(rows: unknown[][], result: LedgerParseResult) {
  // Grab year from first 4 rows
  for (const r of rows.slice(0, 4)) {
    const text = r.map(c => String(c)).join(" ");
    const m = text.match(/\b(FY\d{2,4}|CY\d{4})\b/i);
    if (m && !result.year) { result.year = m[1].toUpperCase(); break; }
  }

  // Header row: has a location/facility column AND scope/emission columns
  const hIdx = rows.findIndex(r =>
    r.some(c => /^(location|facility|sl\.?\s*no\.?)$/i.test(String(c).trim())) &&
    r.some(c => /scope|kwh|emission/i.test(String(c)))
  );
  if (hIdx < 0) return;

  const headers = rows[hIdx];
  // Location is usually col 1 (after serial number)
  const slNoCol = findCol(headers, [/^sl\.?\s*no\.?$/i]);
  const locCol  = slNoCol >= 0 ? slNoCol + 1 : findCol(headers, [/^(location|facility)$/i]);
  const s1Col   = findCol(headers, [/scope\s*1\s*emission|scope\s*1\s*\(tco2/i]);
  const kwhCol  = findCol(headers, [/electricity.*purchased|purchased.*electricity|grid.*kwh|\(kwh\)/i, /electricity.*\(kwh\)/i]);
  const s2LbCol = findCol(headers, [/location.?based.*tco2|emission.*location|s2.*lb|lb.*tco2/i]);
  const s2MbCol = findCol(headers, [/market.?based.*tco2|emission.*market|s2.*mb|mb.*tco2/i]);

  let totGridKwh = 0, totS2Lb = 0, totS2Mb = 0;

  for (const row of rows.slice(hIdx + 1)) {
    const loc = String(row[locCol] ?? "").trim();
    if (!loc || /^total$/i.test(loc) || /^\d+$/.test(loc)) continue;

    const s1  = s1Col  >= 0 ? num(row[s1Col])  : null;
    const kwh = kwhCol >= 0 ? num(row[kwhCol]) : null;
    const lb  = s2LbCol >= 0 ? num(row[s2LbCol]) : null;
    const mb  = s2MbCol >= 0 ? num(row[s2MbCol]) : lb;

    if (s1 !== null) result.s1ByFacility.push({ facility: loc, sub_type: "combustion", tco2e: s1 });
    if (lb !== null) result.s2ByFacility.push({ facility: loc, tco2e_lb: lb, tco2e_mb: mb ?? lb });

    totGridKwh += kwh ?? 0;
    totS2Lb    += lb  ?? 0;
    totS2Mb    += mb  ?? lb ?? 0;
  }

  result.s2Breakdown = { grid_kwh: totGridKwh, re_kwh: 0, tco2e_lb: totS2Lb, tco2e_mb: totS2Mb };
}

function parseScope3Dashboard(rows: unknown[][], result: LedgerParseResult) {
  const hIdx = rows.findIndex(r =>
    r.some(c => /^category$/i.test(String(c))) &&
    r.some(c => /emission|tco2/i.test(String(c)))
  );
  if (hIdx < 0) return;

  const headers = rows[hIdx];
  const catCol = findCol(headers, [/^category$/i]);
  const valCol = findCol(headers, [/emission.*tco2|^emissions?$/i, /tco2e/i]);
  if (catCol < 0 || valCol < 0) return;

  for (const row of rows.slice(hIdx + 1)) {
    const cat = String(row[catCol] ?? "").trim();
    if (!cat || /^(upstream|downstream)/i.test(cat)) continue;
    const v = num(row[valCol]);
    if (v === null || isNaN(v)) continue;
    const m = cat.match(/^(\d+)/);
    if (m) {
      const key = `Cat ${m[1]}`;
      if (!result.scope3Summary.find(r => r.category === key)) {
        result.scope3Summary.push({ category: key, tco2e: v });
      }
    }
  }
}

function parseIntensity(rows: unknown[][], result: LedgerParseResult) {
  // Find rows where col[0] is a year label (FY25, CY2025, etc.)
  const yearRows = rows.filter(r => /^(FY|CY)\d{2,4}$/i.test(String(r[0] ?? "").trim()));
  if (!yearRows.length) return;

  // First year row in the Revenue section: col[1]=revenue, col[2]=tCO2e LB
  const revRow = yearRows.find(r => typeof r[1] === "number" || (typeof r[1] === "string" && /^\d/.test(r[1] as string)));
  if (!revRow) return;

  if (!result.year) result.year = String(revRow[0]).trim().toUpperCase();

  const rev   = num(revRow[1]);
  const s12lb = num(revRow[2]);

  // MB row: look for a year row that appears after a "Market" heading
  let s12mb: number | null = s12lb;
  for (let i = 0; i < rows.length; i++) {
    if (/market.?based/i.test(String(rows[i][0] ?? ""))) {
      const nextYear = rows.slice(i + 1, i + 6).find(r => /^(FY|CY)\d{2,4}$/i.test(String(r[0] ?? "").trim()));
      if (nextYear) { s12mb = num(nextYear[2]) ?? s12lb; break; }
    }
  }

  // Production row: second year row with different structure
  const prodRow = yearRows.find(r => r !== revRow && typeof r[1] === "number");
  const prod    = prodRow ? num(prodRow[1]) : null;

  const s3 = result.ghgInventory.find(r => r.metric_key === "Scope 3 Total")?.metric_value ?? null;

  result.intensityMetrics = { revenue_lakh: rev, production_units: prod, s12_lb: s12lb, s12_mb: s12mb, s3_total: s3 };
}

function parseFacilitySheet(
  sheetName: string,
  rows: unknown[][],
  result: LedgerParseResult,
  entity: string,
  reportingPeriod: "FY" | "CY",
  clientId: number,
  warnings: string[],
): number {
  // Derive facility name: strip leading "F0 - ", "F1 - " etc. and trailing location notes
  const facilityName = sheetName
    .replace(/^F\d+[Ff]?\d*\s*[-–]\s*/, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/^\s*F\d+\/F\d+\s*[-–]\s*/i, "")
    .trim();
  const facilitySlug = slugify(facilityName);
  const fyNum = parseInt(result.year.replace(/[^0-9]/g, "")) || 25;

  // Find the main header row: first col is "Month" AND row contains "Emissions"
  let hIdx = rows.findIndex(r =>
    /^month$/i.test(String(r[0] ?? "").trim()) &&
    r.some(c => /emission/i.test(String(c)))
  );
  if (hIdx < 0) {
    // Fallback: row contains "Month" in any col AND "Emissions"
    hIdx = rows.findIndex(r =>
      r.some(c => /^month$/i.test(String(c).trim())) &&
      r.some(c => /emission/i.test(String(c)))
    );
  }
  if (hIdx < 0) { warnings.push(`${sheetName}: no header row found, skipped`); return 0; }

  const headers = rows[hIdx] as unknown[];

  // Find S1/S2 split: second "Month" column
  let s2StartCol = -1;
  let monthCount = 0;
  for (let i = 0; i < headers.length; i++) {
    if (/^month$/i.test(String(headers[i] ?? "").trim())) {
      monthCount++;
      if (monthCount === 2) { s2StartCol = i; break; }
    }
  }

  const s1Headers = s2StartCol > 0 ? headers.slice(0, s2StartCol) : headers;
  const s2Headers = s2StartCol > 0 ? headers.slice(s2StartCol) : [];

  // Build column→asset map for S1
  const s1ColMap: { absCol: number; def: ColDef; assetId: string }[] = [];
  for (let i = 1; i < s1Headers.length; i++) {
    const h = String(s1Headers[i] ?? "").trim();
    if (!h) continue;
    const def = classifyFuelColumn(h);
    if (!def || def.scope !== "Scope 1") continue;
    const assetId = `ldr-s1-c${clientId}-${facilitySlug}-${slugify(def.name)}`;
    if (!result.trackerAssets.find(a => a.asset_id === assetId)) {
      result.trackerAssets.push({ asset_id: assetId, name: def.name, facility: facilityName, scope: "Scope 1", sub_type: def.sub_type, unit: def.unit, fuel_type: def.fuel_type });
    }
    s1ColMap.push({ absCol: i, def, assetId });
  }

  // Build column→asset map for S2
  const s2ColMap: { absCol: number; def: ColDef; assetId: string }[] = [];
  if (s2StartCol > 0) {
    for (let i = 0; i < s2Headers.length; i++) {
      const h = String(s2Headers[i] ?? "").trim();
      if (!h) continue;
      const def = classifyFuelColumn(h);
      if (!def || def.scope !== "Scope 2") continue;
      const assetId = `ldr-s2-c${clientId}-${facilitySlug}-${slugify(def.name)}`;
      if (!result.trackerAssets.find(a => a.asset_id === assetId)) {
        result.trackerAssets.push({ asset_id: assetId, name: def.name, facility: facilityName, scope: "Scope 2", sub_type: def.sub_type, unit: def.unit });
      }
      s2ColMap.push({ absCol: s2StartCol + i, def, assetId });
    }
  }

  if (!s1ColMap.length && !s2ColMap.length) {
    warnings.push(`${sheetName}: no recognisable fuel columns`);
    return 0;
  }

  // Skip potential sub-header row after main header
  let dataStart = hIdx + 1;
  const nextRow = rows[dataStart];
  if (nextRow) {
    const firstCell = String(nextRow[0] ?? "").trim().toLowerCase();
    const isMonthStart = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(firstCell) || /^[a-z]+-\d/.test(firstCell);
    const isEmpty = !firstCell;
    if (!isMonthStart && !isEmpty) {
      // Sub-header row (like "DG Set", "Company Vehicles") — skip it
      dataStart++;
    }
  }

  // Parse data rows
  let drafted = 0;
  for (const row of rows.slice(dataStart)) {
    const monthLabel = String(row[0] ?? "").trim();
    if (!monthLabel || /^(total|sub.?total|note)$/i.test(monthLabel)) continue;

    const period = parseMonthLabel(monthLabel, reportingPeriod, fyNum);
    if (!period) continue;

    for (const { absCol, def, assetId } of s1ColMap) {
      const v = num(row[absCol]);
      if (v !== null) {
        const p = def.periodSuffix ? `${period}${def.periodSuffix}` : period;
        result.trackerDrafts.push({ asset_id: assetId, period: p, value: v });
        drafted++;
      }
    }
    for (const { absCol, def, assetId } of s2ColMap) {
      const v = num(row[absCol]);
      if (v !== null) {
        const p = def.periodSuffix ? `${period}${def.periodSuffix}` : period;
        result.trackerDrafts.push({ asset_id: assetId, period: p, value: v });
        drafted++;
      }
    }
  }

  return drafted;
}

// ── Client template parser (new structured format) ────────────────────────────

function parseClientTemplate(
  wb: XLSX.WorkBook,
  entity: string,
  reportingPeriod: "FY" | "CY",
  clientId: number,
  warnings: string[],
): LedgerParseResult {
  const sheetMap: Record<string, unknown[][]> = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (ws) sheetMap[name.toLowerCase()] = toRows(ws);
  }

  const result: LedgerParseResult = {
    year: "", entity,
    ghgInventory: [], s1ByFacility: [], s2ByFacility: [],
    s2Breakdown: { grid_kwh: 0, re_kwh: 0, tco2e_lb: 0, tco2e_mb: 0 },
    scope3Summary: [], intensityMetrics: null,
    trackerAssets: [], trackerDrafts: [],
    decarbActions: [], irecRegister: [], peerData: [],
    warnings, facilityCount: 0, monthlyEntries: 0,
    templateFormat: "client-template",
  };

  // Helper: find header row (row 2 = index 1 in toRows output, row 1 is description)
  function getDataRows(rows: unknown[][], headerRowIdx = 1): { headers: unknown[]; data: unknown[][] } {
    if (rows.length <= headerRowIdx) return { headers: [], data: [] };
    return { headers: rows[headerRowIdx], data: rows.slice(headerRowIdx + 1) };
  }

  // Helper: pick year to import (most recent year in the sheet, or matching entity FY)
  function pickYear(years: (number | string)[]): string {
    const valid = years.filter(y => y !== "" && y != null && !isNaN(Number(y))).map(Number);
    if (!valid.length) return "";
    const maxY = Math.max(...valid);
    return numericYearToFY(maxY);
  }

  // ── GHG_Inventory sheet ──────────────────────────────────────────────────────
  const ghgRows = sheetMap["ghg_inventory"];
  if (ghgRows) {
    const { headers, data } = getDataRows(ghgRows);
    const iEnt  = findCol(headers, [/entity.*code|^entity$/i]);
    const iFac  = findCol(headers, [/facility/i]);
    const iYr   = findCol(headers, [/^year$/i]);
    const iS1   = findCol(headers, [/scope\s*1/i]);
    const iS2lb = findCol(headers, [/s2.*location|location.*based|s2.*lb|lb/i]);
    const iS2mb = findCol(headers, [/s2.*market|market.*based|s2.*mb|mb/i]);
    const iS3   = findCol(headers, [/s3.*total|scope\s*3/i]);

    const allYears: number[] = [];
    for (const row of data) {
      const yr = num(row[iYr]);
      if (yr) allYears.push(yr);
    }
    if (!result.year) result.year = pickYear(allYears);
    const targetYear = parseInt(result.year.replace(/\D/g, ""), 10) + 2000 - (result.year.startsWith("FY") ? 0 : 0);
    // actual numeric year that maps to this FY string
    // FY25 = numeric 2025; but the template says "FY2024 (Apr 2023-Mar 2024) → enter 2024"
    // so FY24 maps to numeric 2024
    const targetNumericYear = parseInt(result.year.replace(/\D/g, ""), 10) + (result.year.length === 4 ? 2000 : 0);

    let totGridKwh = 0, totS2Lb = 0, totS2Mb = 0, totReKwh = 0;

    for (const row of data) {
      const rowEnt = String(row[iEnt] ?? "").trim().toUpperCase();
      const rowYr  = num(row[iYr]);
      if (!rowEnt || !rowYr) continue;
      // Filter to requested entity, or accept consolidated/all entities if entity is blank
      const entMatch = !entity || rowEnt === entity.toUpperCase() || rowEnt === "";
      const yrMatch  = !result.year || rowYr === targetNumericYear || String(rowYr) === result.year.replace(/\D/g, "");
      if (!entMatch || !yrMatch) continue;

      const fac  = String(row[iFac] ?? "").trim();
      const s1   = num(row[iS1]);
      const s2lb = num(row[iS2lb]);
      const s2mb = num(row[iS2mb]) ?? s2lb;
      const s3   = num(row[iS3]);

      // Entity-level totals (no facility) → ghgInventory
      if (!fac) {
        if (s1   != null) result.ghgInventory.push({ metric_key: "Scope 1",      metric_value: s1 });
        if (s2lb != null) result.ghgInventory.push({ metric_key: "Scope 2 LB",   metric_value: s2lb });
        if (s2mb != null) result.ghgInventory.push({ metric_key: "Scope 2 MB",   metric_value: s2mb });
        if (s3   != null) result.ghgInventory.push({ metric_key: "Scope 3 Total", metric_value: s3 });
      } else {
        // Facility-level → s1_by_facility + s2_by_facility
        if (s1   != null) result.s1ByFacility.push({ facility: fac, sub_type: "combustion", tco2e: s1 });
        if (s2lb != null) result.s2ByFacility.push({ facility: fac, tco2e_lb: s2lb, tco2e_mb: s2mb ?? s2lb });
        totS2Lb += s2lb ?? 0;
        totS2Mb += s2mb ?? 0;
      }
    }

    // If no entity-level row provided, sum facility rows into ghgInventory
    if (!result.ghgInventory.some(r => r.metric_key === "Scope 1") && result.s1ByFacility.length) {
      const tot = result.s1ByFacility.reduce((a, b) => a + b.tco2e, 0);
      result.ghgInventory.push({ metric_key: "Scope 1", metric_value: tot });
    }
    if (!result.ghgInventory.some(r => r.metric_key === "Scope 2 LB") && result.s2ByFacility.length) {
      result.ghgInventory.push({ metric_key: "Scope 2 LB", metric_value: totS2Lb });
      result.ghgInventory.push({ metric_key: "Scope 2 MB", metric_value: totS2Mb });
    }

    result.s2Breakdown = { grid_kwh: totGridKwh, re_kwh: totReKwh, tco2e_lb: totS2Lb, tco2e_mb: totS2Mb };
    result.facilityCount = result.s2ByFacility.length || result.s1ByFacility.length;
  }

  // ── S1_Breakdown sheet ───────────────────────────────────────────────────────
  const s1bRows = sheetMap["s1_breakdown"];
  if (s1bRows) {
    const { headers, data } = getDataRows(s1bRows);
    const iEnt  = findCol(headers, [/entity.*code|^entity$/i]);
    const iFac  = findCol(headers, [/^facility$/i]);
    const iYr   = findCol(headers, [/^year$/i]);
    const iCat  = findCol(headers, [/category/i]);
    const iFuel = findCol(headers, [/fuel|refrigerant/i]);
    const iQty  = findCol(headers, [/quantity/i]);
    const iUnit = findCol(headers, [/^unit$/i]);
    const iEF   = findCol(headers, [/emission.*factor|ef.*\(kg/i]);
    const iTco  = findCol(headers, [/tco2e/i]);

    const targetNumericYear = parseInt(result.year.replace(/\D/g, ""), 10);

    for (const row of data) {
      const rowEnt = String(row[iEnt] ?? "").trim().toUpperCase();
      const rowYr  = num(row[iYr]);
      const fac    = String(row[iFac] ?? "").trim();
      const entMatch = !entity || rowEnt === entity.toUpperCase();
      const yrMatch  = !result.year || rowYr === targetNumericYear;
      if (!entMatch || !yrMatch || !fac) continue;

      const cat  = String(row[iCat]  ?? "").trim();
      const fuel = String(row[iFuel] ?? "").trim();
      const tco2 = num(row[iTco]);
      if (tco2 == null) continue;

      const sub_type = /fugitive/i.test(cat) ? "Fugitive" : /mobile/i.test(cat) ? "Mobile" : "Stationary";
      const existing = result.s1ByFacility.find(r => r.facility === fac && r.sub_type === sub_type);
      if (existing) {
        existing.tco2e += tco2;
      } else {
        result.s1ByFacility.push({ facility: fac, sub_type, tco2e: tco2 });
      }

      // Also create tracker assets for each fuel row
      const assetId = `ldr-s1-c${clientId}-${slugify(fac)}-${slugify(fuel || cat)}`;
      const qty = num(row[iQty]);
      const unit = String(row[iUnit] ?? "").trim() || "units";
      if (!result.trackerAssets.find(a => a.asset_id === assetId)) {
        result.trackerAssets.push({ asset_id: assetId, name: fuel || cat, facility: fac, scope: "Scope 1", sub_type, unit, fuel_type: fuel || undefined });
      }
      if (qty != null) {
        result.trackerDrafts.push({ asset_id: assetId, period: "annual", value: qty });
      }
    }
  }

  // ── S2_Breakdown sheet ───────────────────────────────────────────────────────
  const s2bRows = sheetMap["s2_breakdown"];
  if (s2bRows) {
    const { headers, data } = getDataRows(s2bRows);
    const iEnt  = findCol(headers, [/entity.*code|^entity$/i]);
    const iFac  = findCol(headers, [/^facility$/i]);
    const iYr   = findCol(headers, [/^year$/i]);
    const iKwh  = findCol(headers, [/electricity.*consumed|consumed.*kwh/i]);
    const iGrid = findCol(headers, [/grid.*emission.*factor|emission.*factor|kgco2/i]);
    const iLb   = findCol(headers, [/s2.*location|location.*based/i]);
    const iInst = findCol(headers, [/market.*instrument|instrument/i]);
    const iMwh  = findCol(headers, [/instrument.*mwh|mwh.*covered/i]);
    const iMb   = findCol(headers, [/s2.*market|market.*based/i]);
    const iRe   = findCol(headers, [/on.?site.*renew|self.?gen|solar|re.*gen/i]);

    const targetNumericYear = parseInt(result.year.replace(/\D/g, ""), 10);
    let totGridKwh = 0, totReKwh = 0, totLb = 0, totMb = 0;
    result.s2ByFacility = []; // reset — S2_Breakdown is more detailed, prefer it

    for (const row of data) {
      const rowEnt = String(row[iEnt] ?? "").trim().toUpperCase();
      const rowYr  = num(row[iYr]);
      const fac    = String(row[iFac] ?? "").trim();
      const entMatch = !entity || rowEnt === entity.toUpperCase();
      const yrMatch  = !result.year || rowYr === targetNumericYear;
      if (!entMatch || !yrMatch || !fac) continue;

      const kwh  = num(row[iKwh]);
      const lb   = num(row[iLb]);
      const mb   = num(row[iMb]) ?? lb;
      const re   = num(row[iRe]);

      if (lb != null) result.s2ByFacility.push({ facility: fac, tco2e_lb: lb, tco2e_mb: mb ?? lb });
      totGridKwh += kwh ?? 0;
      totReKwh   += re  ?? 0;
      totLb      += lb  ?? 0;
      totMb      += mb  ?? lb ?? 0;

      // Tracker asset + annual draft
      const assetId = `ldr-s2-c${clientId}-${slugify(fac)}-elec`;
      if (!result.trackerAssets.find(a => a.asset_id === assetId)) {
        result.trackerAssets.push({ asset_id: assetId, name: "Grid Electricity", facility: fac, scope: "Scope 2", sub_type: "electricity", unit: "kWh" });
      }
      if (kwh != null) {
        result.trackerDrafts.push({ asset_id: assetId, period: "annual__lb", value: kwh });
      }
    }

    result.s2Breakdown = { grid_kwh: totGridKwh, re_kwh: totReKwh, tco2e_lb: totLb, tco2e_mb: totMb };
    // Update ghgInventory S2 totals from this more detailed source
    result.ghgInventory = result.ghgInventory.filter(r => !["Scope 2 LB","Scope 2 MB"].includes(r.metric_key));
    if (totLb) result.ghgInventory.push({ metric_key: "Scope 2 LB", metric_value: totLb });
    if (totMb) result.ghgInventory.push({ metric_key: "Scope 2 MB", metric_value: totMb });
  }

  // ── Scope3_Categories sheet ──────────────────────────────────────────────────
  const s3Rows = sheetMap["scope3_categories"];
  if (s3Rows) {
    const { headers, data } = getDataRows(s3Rows);
    const iEnt  = findCol(headers, [/entity.*code|^entity$/i]);
    const iYr   = findCol(headers, [/^year$/i]);
    const iCatN = findCol(headers, [/category.*number|cat.*num|^category.*\(|number/i]);
    const iCatL = findCol(headers, [/category.*name|^name$/i]);
    const iTco  = findCol(headers, [/tco2e/i]);

    const targetNumericYear = parseInt(result.year.replace(/\D/g, ""), 10);
    let s3Total = 0;

    for (const row of data) {
      const rowEnt = String(row[iEnt] ?? "").trim().toUpperCase();
      const rowYr  = num(row[iYr]);
      const entMatch = !entity || rowEnt === entity.toUpperCase();
      const yrMatch  = !result.year || rowYr === targetNumericYear;
      if (!entMatch || !yrMatch) continue;

      const catNum = num(row[iCatN]);
      const tco2   = num(row[iTco]);
      if (tco2 == null) continue;

      const key = catNum != null ? `Cat ${catNum}` : String(row[iCatL] ?? "").trim();
      if (!key) continue;
      if (!result.scope3Summary.find(r => r.category === key)) {
        result.scope3Summary.push({ category: key, tco2e: tco2 });
      }
      s3Total += tco2;
    }

    if (s3Total && !result.ghgInventory.some(r => r.metric_key === "Scope 3 Total")) {
      result.ghgInventory.push({ metric_key: "Scope 3 Total", metric_value: s3Total });
    }
  }

  // ── Intensity_Metrics sheet ──────────────────────────────────────────────────
  const imRows = sheetMap["intensity_metrics"];
  if (imRows) {
    const { headers, data } = getDataRows(imRows);
    const iEnt  = findCol(headers, [/entity.*code|^entity$/i]);
    const iYr   = findCol(headers, [/^year$/i]);
    const iRev  = findCol(headers, [/^revenue$/i]);
    const iEmp  = findCol(headers, [/employee|fte/i]);
    const iFl   = findCol(headers, [/floor.*space|m2/i]);
    const iProd = findCol(headers, [/production.*qty|production$/i]);

    const targetNumericYear = parseInt(result.year.replace(/\D/g, ""), 10);

    for (const row of data) {
      const rowEnt = String(row[iEnt] ?? "").trim().toUpperCase();
      const rowYr  = num(row[iYr]);
      const entMatch = !entity || rowEnt === entity.toUpperCase();
      const yrMatch  = !result.year || rowYr === targetNumericYear;
      if (!entMatch || !yrMatch) continue;

      const rev  = num(row[iRev]);
      const prod = num(row[iProd]);
      const s1   = result.ghgInventory.find(r => r.metric_key === "Scope 1")?.metric_value ?? null;
      const s2lb = result.ghgInventory.find(r => r.metric_key === "Scope 2 LB")?.metric_value ?? null;
      const s3   = result.ghgInventory.find(r => r.metric_key === "Scope 3 Total")?.metric_value ?? null;
      const s12lb = (s1 != null && s2lb != null) ? s1 + s2lb : null;

      result.intensityMetrics = { revenue_lakh: rev, production_units: prod, s12_lb: s12lb, s12_mb: s12lb, s3_total: s3 };
      break; // first matching row is enough
    }
  }

  // ── I-RECs sheet ────────────────────────────────────────────────────────────
  const irecRows = sheetMap["i-recs"];
  if (irecRows) {
    const { headers, data } = getDataRows(irecRows);
    const iEnt  = findCol(headers, [/entity.*code|^entity$/i]);
    const iFac  = findCol(headers, [/^facility/i]);
    const iVint = findCol(headers, [/vintage/i]);
    const iType = findCol(headers, [/certificate.*type|type/i]);
    const iMwh  = findCol(headers, [/^mwh$/i]);
    const iReg  = findCol(headers, [/registry|certificate.*#|cert.*id/i]);
    const iStat = findCol(headers, [/^status$/i]);

    for (const row of data) {
      const rowEnt = String(row[iEnt] ?? "").trim().toUpperCase();
      const entMatch = !entity || rowEnt === entity.toUpperCase();
      if (!entMatch) continue;

      const mwh  = num(row[iMwh]);
      if (mwh == null) continue;

      result.irecRegister!.push({
        entity: rowEnt || entity,
        facility: String(row[iFac] ?? "").trim() || null,
        year: result.year,
        mwh,
        vintage: String(row[iVint] ?? "").trim() || null,
        instrument: String(row[iType] ?? "").trim() || null,
        status: String(row[iStat] ?? "Active").trim() || "Active",
      });
    }
  }

  // ── Actions sheet ────────────────────────────────────────────────────────────
  const actRows = sheetMap["actions"];
  if (actRows) {
    const { headers, data } = getDataRows(actRows);
    const iEnt  = findCol(headers, [/entity.*code|^entity$/i]);
    const iFac  = findCol(headers, [/^facility/i]);
    const iName = findCol(headers, [/action.*name|^name$/i]);
    const iCat  = findCol(headers, [/category/i]);
    const iStat = findCol(headers, [/^status$/i]);
    const iYr   = findCol(headers, [/target.*year/i]);
    const iAb   = findCol(headers, [/tco2e.*reduction|est.*tco2e|abatement/i]);
    const iCap  = findCol(headers, [/capex$/i]);
    const iCur  = findCol(headers, [/capex.*currency|currency/i]);
    const iNote = findCol(headers, [/notes?$/i]);

    for (const row of data) {
      const rowEnt = String(row[iEnt] ?? "").trim().toUpperCase();
      const entMatch = !entity || rowEnt === entity.toUpperCase();
      if (!entMatch) continue;

      const title = String(row[iName] ?? "").trim();
      if (!title) continue;

      result.decarbActions!.push({
        entity: rowEnt || entity,
        facility: String(row[iFac] ?? "").trim() || null,
        title,
        lever: String(row[iCat] ?? "").trim().toLowerCase().replace(/\s+/g, "_") || "other",
        status: String(row[iStat] ?? "Planned").trim(),
        target_year: String(row[iYr] ?? "").trim() || null,
        abatement_t: num(row[iAb]),
        capex: num(row[iCap]),
        capex_currency: String(row[iCur] ?? "").trim() || null,
        notes: String(row[iNote] ?? "").trim() || null,
      });
    }
  }

  // ── Peers sheet ──────────────────────────────────────────────────────────────
  const peerRows = sheetMap["peers"];
  if (peerRows) {
    const { headers, data } = getDataRows(peerRows);
    const iName = findCol(headers, [/company.*name|^name$/i]);
    const iYr   = findCol(headers, [/^year$/i]);
    const iS12  = findCol(headers, [/scope.*1.*2|s1.*s2|s1\+s2/i]);
    const iS3   = findCol(headers, [/scope.*3/i]);
    const iRev  = findCol(headers, [/^revenue$/i]);
    const iCur  = findCol(headers, [/revenue.*currency|currency/i]);
    const iInt  = findCol(headers, [/intensity/i]);

    for (const row of data) {
      const name = String(row[iName] ?? "").trim();
      if (!name) continue;
      const yr   = num(row[iYr]);
      const fy   = yr ? numericYearToFY(yr) : result.year;
      result.peerData!.push({
        name, fy,
        scope12: num(row[iS12]),
        scope3_total: num(row[iS3]),
        intensity_revenue: num(row[iInt]),
      });
    }
  }

  // Grand totals
  const s1  = result.ghgInventory.find(r => r.metric_key === "Scope 1")?.metric_value ?? 0;
  const s2lb = result.ghgInventory.find(r => r.metric_key === "Scope 2 LB")?.metric_value ?? 0;
  const s2mb = result.ghgInventory.find(r => r.metric_key === "Scope 2 MB")?.metric_value ?? 0;
  const s3  = result.ghgInventory.find(r => r.metric_key === "Scope 3 Total")?.metric_value ?? 0;
  if (s1 || s2lb) {
    result.ghgInventory.push({ metric_key: "Grand Total LB", metric_value: s1 + s2lb + s3 });
    result.ghgInventory.push({ metric_key: "Grand Total MB", metric_value: s1 + s2mb + s3 });
  }

  result.monthlyEntries = result.trackerDrafts.length;
  return result;
}
