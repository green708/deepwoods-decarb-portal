// NDC/NDS — New Data Collection mock data (no backend required)

export type SourceStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "query_for_you"
  | "accepted";

export type Scope = "Scope 1" | "Scope 2" | "Scope 3";

export type Category =
  | "stationary_combustion"
  | "mobile_combustion"
  | "fugitive"
  | "purchased_electricity"
  | "purchased_heat"
  | "purchased_goods"
  | "business_travel"
  | "employee_commute"
  | "waste"
  | "upstream_transport";

export interface MonthEntry {
  month: string; // "APR-24", etc.
  value: number | null;
  isNil: boolean;
  hasAnomaly: boolean;
}

export interface QueryThread {
  id: string;
  from: string;
  message: string;
  date: string;
  replied: boolean;
  reply?: string;
}

export interface EmissionSource {
  id: string;
  name: string;
  category: Category;
  scope: Scope;
  facilityId: string;
  unit: string;
  emissionFactor: number; // tCO2e per unit
  status: SourceStatus;
  entries: MonthEntry[];
  queries: QueryThread[];
  description: string;
  tip: string;
}

export interface Facility {
  id: string;
  name: string;
  location: string;
  type: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function categoryLabel(cat: Category): string {
  const map: Record<Category, string> = {
    stationary_combustion: "Stationary Combustion",
    mobile_combustion: "Mobile Combustion",
    fugitive: "Fugitive Emissions",
    purchased_electricity: "Purchased Electricity",
    purchased_heat: "Purchased Heat / Steam",
    purchased_goods: "Purchased Goods & Services",
    business_travel: "Business Travel",
    employee_commute: "Employee Commuting",
    waste: "Waste Generated",
    upstream_transport: "Upstream Transportation",
  };
  return map[cat] ?? cat;
}

export function statusLabel(s: SourceStatus): string {
  const map: Record<SourceStatus, string> = {
    not_started: "Not started",
    in_progress: "In progress",
    submitted: "Submitted",
    under_review: "Under review",
    query_for_you: "Query for you",
    accepted: "Accepted",
  };
  return map[s] ?? s;
}

export function statusColors(s: SourceStatus): { bg: string; fg: string; dot: string } {
  switch (s) {
    case "not_started":    return { bg: "#F1F5F9", fg: "#64748B", dot: "#94A3B8" };
    case "in_progress":    return { bg: "#EFF6FF", fg: "#1D4ED8", dot: "#3B82F6" };
    case "submitted":      return { bg: "#F0FDF4", fg: "#166534", dot: "#22C55E" };
    case "under_review":   return { bg: "#FFF7ED", fg: "#92400E", dot: "#F59E0B" };
    case "query_for_you":  return { bg: "#FEF2F2", fg: "#991B1B", dot: "#EF4444" };
    case "accepted":       return { bg: "#ECFDF5", fg: "#065F46", dot: "#10B981" };
  }
}

function makeEntries(fy: string): MonthEntry[] {
  const months = ["APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR"];
  const yy = parseInt(fy.slice(-2));
  return months.map((m, i) => ({
    month: `${m}-${String(i < 9 ? yy - 1 : yy).padStart(2, "0")}`,
    value: null,
    isNil: false,
    hasAnomaly: false,
  }));
}

function filledEntries(values: (number | null)[], fy: string, anomalyIdx?: number[]): MonthEntry[] {
  const base = makeEntries(fy);
  return base.map((e, i) => ({
    ...e,
    value: values[i] ?? null,
    hasAnomaly: anomalyIdx?.includes(i) ?? false,
  }));
}

// ── Static mock data ─────────────────────────────────────────────────────────

export const facilities: Facility[] = [
  { id: "F1", name: "Main Plant", location: "Bengaluru North", type: "Manufacturing" },
  { id: "F2", name: "South Wing", location: "Bengaluru South", type: "Office & Warehouse" },
  { id: "F3", name: "HQ Tower",   location: "Chennai CBD",      type: "Corporate Office" },
];

export const sources: EmissionSource[] = [
  // ── Scope 1 sources ────────────────────────────────────────────────────────
  {
    id: "S1-001",
    name: "DG Set 1500 kVA",
    scope: "Scope 1",
    category: "stationary_combustion",
    facilityId: "F1",
    unit: "Litres of HSD",
    emissionFactor: 0.00268,
    status: "query_for_you",
    description: "Backup diesel generator at Main Plant. Provide monthly HSD consumption in litres.",
    tip: "Check with the facility manager or fuel purchase records for monthly quantities.",
    entries: filledEntries([3200, 2800, 2950, 3100, 2750, 0, 3300, 3150, 2900, null, null, null], "FY25", [1]),
    queries: [
      {
        id: "Q1", from: "Deepwoods Coordinator", date: "2025-01-14",
        message: "The May figure looks unusually low (2800 L vs. ~3100 L avg). Can you confirm this is correct, or was there a partial outage?",
        replied: false,
      },
    ],
  },
  {
    id: "S1-002",
    name: "Boiler — LPG",
    scope: "Scope 1",
    category: "stationary_combustion",
    facilityId: "F1",
    unit: "kg of LPG",
    emissionFactor: 0.00214,
    status: "in_progress",
    description: "Process boiler running on LPG. Submit monthly consumption from the LPG manifold meter.",
    tip: "LPG invoices from the supplier are the best source. Divide cylinder weight by number of refills if metered separately.",
    entries: filledEntries([820, 790, 810, 830, 800, 750, 870, 860, 840, null, null, null], "FY25"),
    queries: [],
  },
  {
    id: "S1-003",
    name: "Company Fleet — Cars (Petrol)",
    scope: "Scope 1",
    category: "mobile_combustion",
    facilityId: "F1",
    unit: "Litres of Petrol",
    emissionFactor: 0.00233,
    status: "not_started",
    description: "Petrol consumption for company-owned vehicles assigned to Main Plant.",
    tip: "Use fuel card statements or fuel log sheets from the fleet manager.",
    entries: makeEntries("FY25"),
    queries: [],
  },
  {
    id: "S1-004",
    name: "HVAC Refrigerant R-410A",
    scope: "Scope 1",
    category: "fugitive",
    facilityId: "F2",
    unit: "kg of R-410A",
    emissionFactor: 2.088,
    status: "accepted",
    description: "Fugitive refrigerant emissions from HVAC units at South Wing. Record annual top-up quantity.",
    tip: "Ask the HVAC maintenance contractor for the annual refrigerant top-up logbook.",
    entries: filledEntries([0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0], "FY25"),
    queries: [],
  },
  // ── Scope 2 sources ────────────────────────────────────────────────────────
  {
    id: "S2-001",
    name: "BESCOM HT Connection",
    scope: "Scope 2",
    category: "purchased_electricity",
    facilityId: "F1",
    unit: "kWh",
    emissionFactor: 0.000708,
    status: "under_review",
    description: "Main grid electricity — HT tariff. Submit monthly units from BESCOM bills.",
    tip: "Download monthly eBills from the BESCOM portal or use the meter reading register.",
    entries: filledEntries([48500, 47200, 49100, 52300, 50800, 45600, 53200, 51900, 49700, null, null, null], "FY25", [3, 6]),
    queries: [
      {
        id: "Q2", from: "Deepwoods Coordinator", date: "2025-01-10",
        message: "Jul and Oct readings appear significantly higher than adjacent months. Kindly verify these figures.",
        replied: true,
        reply: "Jul spike was due to additional cooling load during heat wave. Oct was annual equipment testing.",
      },
    ],
  },
  {
    id: "S2-002",
    name: "BESCOM LT — South Wing",
    scope: "Scope 2",
    category: "purchased_electricity",
    facilityId: "F2",
    unit: "kWh",
    emissionFactor: 0.000708,
    status: "submitted",
    description: "Low-tension grid electricity for South Wing operations.",
    tip: "Use the monthly BESCOM bill PDF — look for 'Units Consumed' on page 1.",
    entries: filledEntries([18200, 17800, 18600, 19400, 18900, 17200, 19800, 19100, 18500, 17900, null, null], "FY25"),
    queries: [],
  },
  {
    id: "S2-003",
    name: "TNEB — HQ Tower",
    scope: "Scope 2",
    category: "purchased_electricity",
    facilityId: "F3",
    unit: "kWh",
    emissionFactor: 0.000863,
    status: "in_progress",
    description: "Grid electricity for HQ Tower (Tamil Nadu grid — higher EF than Karnataka).",
    tip: "HQ admin team holds TNEB bills. Contact facilities@hq to get monthly PDFs.",
    entries: filledEntries([22100, 21500, 22800, 24100, 23400, 20900, 24800, 23700, null, null, null, null], "FY25"),
    queries: [],
  },
  // ── Scope 3 sources ────────────────────────────────────────────────────────
  {
    id: "S3-001",
    name: "Air Travel — Domestic",
    scope: "Scope 3",
    category: "business_travel",
    facilityId: "F3",
    unit: "Passenger-km",
    emissionFactor: 0.000133,
    status: "not_started",
    description: "Domestic business flights taken by employees. Use booking data from travel desk.",
    tip: "Export flight bookings from the travel portal. Convert to passenger-km using route distances.",
    entries: makeEntries("FY25"),
    queries: [],
  },
  {
    id: "S3-002",
    name: "Employee Commute — Own Vehicle",
    scope: "Scope 3",
    category: "employee_commute",
    facilityId: "F1",
    unit: "km per employee per day",
    emissionFactor: 0.000192,
    status: "not_started",
    description: "Estimated emissions from employees commuting in personal petrol/diesel vehicles.",
    tip: "Use the annual commute survey results (HR can share). Multiply avg km by working days and headcount.",
    entries: makeEntries("FY25"),
    queries: [],
  },
  {
    id: "S3-003",
    name: "Waste to Landfill",
    scope: "Scope 3",
    category: "waste",
    facilityId: "F1",
    unit: "kg of mixed waste",
    emissionFactor: 0.000458,
    status: "in_progress",
    description: "Non-recyclable waste sent to landfill from plant operations.",
    tip: "Check waste disposal contractor invoices (usually monthly). Use net weight from weigh-bridge receipts.",
    entries: filledEntries([2400, 2200, 2350, 2500, 2300, 2100, 2600, 2450, 2250, null, null, null], "FY25"),
    queries: [],
  },
  {
    id: "S3-004",
    name: "Upstream Freight — Road",
    scope: "Scope 3",
    category: "upstream_transport",
    facilityId: "F1",
    unit: "tonne-km",
    emissionFactor: 0.000096,
    status: "not_started",
    description: "Road freight for inbound raw materials (Scope 3 Cat 4).",
    tip: "Logistics team has monthly freight invoices. Multiply weight (tonnes) × distance (km) per shipment.",
    entries: makeEntries("FY25"),
    queries: [],
  },
];

// ── Derived helpers ──────────────────────────────────────────────────────────

export function getSourcesByScope(scope: Scope): EmissionSource[] {
  return sources.filter((s) => s.scope === scope);
}

export function getSourcesByFacilityAndScope(facilityId: string, scope: Scope): EmissionSource[] {
  return sources.filter((s) => s.facilityId === facilityId && s.scope === scope);
}

export function getSourceById(id: string): EmissionSource | undefined {
  return sources.find((s) => s.id === id);
}

export function getReadinessStats(scope?: Scope) {
  const pool = scope ? sources.filter((s) => s.scope === scope) : sources;
  const total    = pool.length;
  const accepted = pool.filter((s) => s.status === "accepted").length;
  const submitted = pool.filter((s) => s.status === "submitted" || s.status === "under_review").length;
  const inProg   = pool.filter((s) => s.status === "in_progress").length;
  const queries  = pool.filter((s) => s.status === "query_for_you").length;
  const pct = total === 0 ? 0 : Math.round(((accepted + submitted) / total) * 100);
  return { total, accepted, submitted, inProg, queries, pct };
}

export function getTotalEmissions(scope?: Scope): number {
  const pool = scope ? sources.filter((s) => s.scope === scope) : sources;
  return pool.reduce((sum, src) => {
    const monthlySum = src.entries.reduce((s2, e) => s2 + (e.isNil ? 0 : (e.value ?? 0)), 0);
    return sum + monthlySum * src.emissionFactor;
  }, 0);
}
