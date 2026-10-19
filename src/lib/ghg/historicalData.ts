// Hardcoded FY22–FY26 historical emissions (tCO₂e) for FOS entity.

export const YEARS = ["FY22", "FY23", "FY24", "FY25", "FY26"] as const;
export type YearKey = typeof YEARS[number];
export const PARTIAL_YEAR: YearKey = "FY26";

export interface Row {
  scope: "S1" | "S2" | "S3";
  label: string;
  key: string;
  values: Record<YearKey, number | null>; // null = pending
}

export const HISTORICAL: Row[] = [
  { scope: "S1", label: "Scope 1 — Stationary", key: "s1_stat", values: { FY22: 87.4, FY23: 96.1, FY24: 101.2, FY25: 110.4, FY26: 94.2 } },
  { scope: "S1", label: "Scope 1 — Mobile", key: "s1_mob", values: { FY22: 28.3, FY23: 31.5, FY24: 35.2, FY25: 37.6, FY26: 29.1 } },
  { scope: "S1", label: "Scope 1 — Fugitive", key: "s1_fug", values: { FY22: 61.8, FY23: 68.4, FY24: 72.3, FY25: 73.3, FY26: 68.4 } },
  { scope: "S2", label: "Scope 2 Location-Based", key: "s2_lb", values: { FY22: 890.1, FY23: 981.3, FY24: 1024.6, FY25: 1064.5, FY26: 1012.8 } },
  { scope: "S2", label: "Scope 2 Market-Based", key: "s2_mb", values: { FY22: 890.1, FY23: 412.6, FY24: 0, FY25: 0, FY26: 0 } },
  { scope: "S3", label: "Scope 3 — Cat 1", key: "s3_c1", values: { FY22: 4210, FY23: 4530, FY24: 4880, FY25: 5140, FY26: null } },
  { scope: "S3", label: "Scope 3 — Cat 4", key: "s3_c4", values: { FY22: 312, FY23: 341, FY24: 388, FY25: 420, FY26: null } },
  { scope: "S3", label: "Scope 3 — Cat 6", key: "s3_c6", values: { FY22: 18.4, FY23: 22.1, FY24: 31.6, FY25: 29.8, FY26: null } },
];

export const S1_TOTAL: Record<YearKey, number> = { FY22: 177.5, FY23: 196.0, FY24: 208.7, FY25: 221.3, FY26: 191.7 };
export const S3_TOTAL: Record<YearKey, number | null> = { FY22: 5840, FY23: 6290, FY24: 6780, FY25: 7120, FY26: null };

export const REVENUE_CR: Record<YearKey, number> = { FY22: 420, FY23: 465, FY24: 512, FY25: 578, FY26: 620 };
export const HEADCOUNT: Record<YearKey, number> = { FY22: 890, FY23: 940, FY24: 1010, FY25: 1080, FY26: 1120 };
export const PRODUCTION_T: Record<YearKey, number> = { FY22: 12400, FY23: 13600, FY24: 14800, FY25: 15900, FY26: 16400 };
export const FLOOR_AREA_M2: Record<YearKey, number> = { FY22: 45000, FY23: 45000, FY24: 48000, FY25: 52000, FY26: 52000 };

export function scopeTotalsByYear(y: YearKey) {
  const s1 = S1_TOTAL[y];
  const s2lb = HISTORICAL.find((r) => r.key === "s2_lb")!.values[y] ?? 0;
  const s2mb = HISTORICAL.find((r) => r.key === "s2_mb")!.values[y] ?? 0;
  const s3 = S3_TOTAL[y] ?? 0;
  return { s1, s2lb, s2mb, s3, totalLB: s1 + s2lb + s3, totalMB: s1 + s2mb + s3 };
}

// Facility-level splits (rough shares, FY25 baseline)
export const FACILITY_SHARE: Record<string, number> = {
  HJ: 0.42, KB: 0.28, RM: 0.10, VN: 0.05, SP: 0.15,
};
export const FACILITY_NAMES: Record<string, string> = {
  HJ: "Hejjala", KB: "Kumbalagodu", RM: "Ramohalli", VN: "Vasanth Nagar", SP: "Sriperumbudur",
};
