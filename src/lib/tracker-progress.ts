// tracker-progress.ts
// Shared "how complete is this reporting year's data" logic. The Data Tracker and the
// Home page both use it so the percentages always agree.

import type { DecarbAsset } from "@/lib/api";

export interface TrackerMonth { key: string; short: string }

export function genMonths(fy: string, startMonth = 4): { key: string; short: string }[] {
  const yy = parseInt(fy.replace(/[^0-9]/g, ""));
  const endYear = yy < 100 ? 2000 + yy : yy;
  const ALL: [string, string][] = [
    ["JAN","Jan"],["FEB","Feb"],["MAR","Mar"],["APR","Apr"],
    ["MAY","May"],["JUN","Jun"],["JUL","Jul"],["AUG","Aug"],
    ["SEP","Sep"],["OCT","Oct"],["NOV","Nov"],["DEC","Dec"],
  ];
  const startIdx = startMonth - 1;
  const ordered = [...ALL.slice(startIdx), ...ALL.slice(0, startIdx)];
  return ordered.map(([m, label], i) => {
    const monthIdx = (startIdx + i) % 12;
    const calYear = startMonth === 1 ? endYear : (monthIdx < startMonth - 1 ? endYear : endYear - 1);
    const yy2 = String(calYear).slice(-2);
    return { key: `${m}-${yy2}`, short: `${label}-${yy2}` };
  });
}

// Scope 2 electricity assets (all sub_types that represent grid/generated electricity)
// store tracker drafts with a "__lb" (Location Based) period suffix.
// Try __lb first, fall back to plain key for older data imported without suffix.
export function getMonthVal(asset: DecarbAsset, periodKey: string): number | null | undefined {
  const s = asset.series ?? {};
  const st = (asset.sub_type ?? "").toLowerCase();
  if (st.includes("electricity") || st.includes("solar")) {
    const lb = s[periodKey + "__lb"];
    return lb != null ? lb : s[periodKey];
  }
  return s[periodKey];
}

// Fugitive-gas assets (fire extinguishers, refrigerants) are always a single
// annual figure — an occasional recharge/top-up event isn't naturally monthly
// data, so this is unconditional and never spread across months.
export function isAnnual(asset: DecarbAsset): boolean {
  const st = (asset.sub_type ?? "").toLowerCase();
  return st === "fugitive" || st.includes("refrigerant") || st.includes("fire-ext") || st.includes("fire ext");
}

export function hasAnyMonthlyData(asset: DecarbAsset, months: { key: string }[]): boolean {
  return months.some(m => getMonthVal(asset, m.key) != null);
}

// Some clients only ever send one annual total for a source instead of monthly
// bills. Rather than leaving 12 empty cells (or a separate annual-only block),
// spread that total evenly across the period's months so the tracker still
// shows a monthly figure per cell — flagged as derived, not a real reading.
export function getDisplayMonthVal(asset: DecarbAsset, months: { key: string }[], periodKey: string): { value: number | null | undefined; derived: boolean } {
  const real = getMonthVal(asset, periodKey);
  if (real != null) return { value: real, derived: false };
  const annual = asset.series?.["annual"];
  if (annual != null && !isAnnual(asset) && !hasAnyMonthlyData(asset, months) && months.length > 0) {
    return { value: annual / months.length, derived: true };
  }
  return { value: real, derived: false };
}

export function calcProgress(assets: DecarbAsset[], months: { key: string }[]): number {
  let total = 0, filled = 0;
  for (const a of assets) {
    const series = a.series ?? {};
    if (isAnnual(a) && !hasAnyMonthlyData(a, months)) {
      total += 1;
      filled += series["annual"] != null ? 1 : 0;
    } else {
      total += months.length;
      filled += months.filter(m => getDisplayMonthVal(a, months, m.key).value != null).length;
    }
  }
  return total > 0 ? filled / total : 0;
}

/** First month of the reporting year: 1 for calendar-year clients, else the configured FY start (default April). */
export function reportingStartMonth(reportingPeriod: string, config: Record<string, unknown>): number {
  if (reportingPeriod === "CY") return 1;
  return parseInt(String(config.fiscal_year_start_month ?? "4")) || 4;
}

/** Completion summary across a set of assets for one year. */
export function trackerSummary(assets: DecarbAsset[], months: { key: string }[]): { pct: number; sources: number; complete: number; started: number } {
  let complete = 0;
  let started = 0;
  for (const a of assets) {
    const p = calcProgress([a], months);
    if (p >= 0.9999) complete += 1;
    if (p > 0) started += 1;
  }
  return { pct: calcProgress(assets, months), sources: assets.length, complete, started };
}
