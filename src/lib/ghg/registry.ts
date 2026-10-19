// GHG Data Collection — hard-coded master data for FY26 (Apr 2025 – Mar 2026)
// Sourced from Featherlite Equipment_Registry / FY26 DataTracker.

export type Scope = "S1" | "S2";
export type EntryMode = "monthly" | "annual";

export interface Equipment {
  id: string;
  name: string;
  scope: Scope;
  category: string; // e.g. "S1 — Combustion"
  fuel: string;
  unit: string;
  mode: EntryMode;
  /** Number of numeric sub-fields per month (or per annual entry). */
  subFields: string[];
  /** Solar variant needs balance validation: subFields[0] = subFields[1] + subFields[2]. */
  isSolar?: boolean;
  helper?: string;
}

export interface Facility {
  id: string;
  name: string;
  state: string;
  utility: string;
  status: string;
  type: string;
  equipment: Equipment[];
}

export const FISCAL_YEAR = "FY26";
export const FISCAL_YEAR_LABEL = "FY26 (Apr 2025 – Mar 2026)";

export const MONTHS: { key: string; short: string; long: string }[] = [
  { key: "2025-04", short: "Apr-25", long: "April 2025" },
  { key: "2025-05", short: "May-25", long: "May 2025" },
  { key: "2025-06", short: "Jun-25", long: "June 2025" },
  { key: "2025-07", short: "Jul-25", long: "July 2025" },
  { key: "2025-08", short: "Aug-25", long: "August 2025" },
  { key: "2025-09", short: "Sep-25", long: "September 2025" },
  { key: "2025-10", short: "Oct-25", long: "October 2025" },
  { key: "2025-11", short: "Nov-25", long: "November 2025" },
  { key: "2025-12", short: "Dec-25", long: "December 2025" },
  { key: "2026-01", short: "Jan-26", long: "January 2026" },
  { key: "2026-02", short: "Feb-26", long: "February 2026" },
  { key: "2026-03", short: "Mar-26", long: "March 2026" },
];

const monthlySingle = (name: string): string[] => [name];

export const FACILITIES: Facility[] = [
  {
    id: "HJ",
    name: "Hejjala",
    state: "Karnataka",
    utility: "BESCOM",
    status: "Active",
    type: "Industrial (main factory)",
    equipment: [
      {
        id: "FOS-HJ-DG-001", name: "DG Set (400KVA + 320KVA)",
        scope: "S1", category: "S1 — Combustion", fuel: "High Speed Diesel",
        unit: "L", mode: "monthly", subFields: ["400KVA", "320KVA"],
        helper: "Two generators — enter litres for each per month.",
      },
      { id: "FOS-HJ-VH-001", name: "Company Vehicles (Fleet)",
        scope: "S1", category: "S1 — Combustion", fuel: "High Speed Diesel",
        unit: "L", mode: "monthly", subFields: monthlySingle("Litres"),
        helper: "From fleet fuel log." },
      { id: "FOS-HJ-FK-001", name: "Forklifts (Diesel)",
        scope: "S1", category: "S1 — Combustion", fuel: "High Speed Diesel",
        unit: "L", mode: "monthly", subFields: monthlySingle("Litres"),
        helper: "From forklift log book." },
      { id: "FOS-HJ-FE-001", name: "Fire Extinguisher CO₂",
        scope: "S1", category: "S1 — Fugitive", fuel: "CO₂ gas",
        unit: "kg", mode: "annual", subFields: ["Annual total"],
        helper: "Annual CO₂ refilled during inspection." },
      { id: "FOS-HJ-WD-001", name: "Welding CO₂ Gas Cylinders",
        scope: "S1", category: "S1 — Fugitive", fuel: "CO₂ gas",
        unit: "kg", mode: "monthly", subFields: monthlySingle("kg"),
        helper: "From cylinder purchase records." },
      { id: "FOS-HJ-GR-001", name: "Grid Electricity (BESCOM)",
        scope: "S2", category: "S2 — Location/Market-Based", fuel: "Grid kWh",
        unit: "kWh", mode: "monthly", subFields: monthlySingle("kWh (net import)"),
        helper: "From BESCOM monthly bills." },
      { id: "FOS-HJ-SL-001", name: "Rooftop Solar PV",
        scope: "S2", category: "S2 — RE Info Only", fuel: "Solar PV",
        unit: "kWh", mode: "monthly",
        subFields: ["Generated", "Self-consumed", "Exported"],
        isSolar: true,
        helper: "From inverter meter log or BESCOM net-metering bill." },
      { id: "FOS-HJ-WN-001", name: "Captive Wind (Open Access)",
        scope: "S2", category: "S2 — Market-Based EF=0", fuel: "Wind kWh",
        unit: "kWh", mode: "monthly", subFields: monthlySingle("kWh"),
        helper: "From open access energy statement." },
    ],
  },
  {
    id: "KB", name: "Kumbalagodu", state: "Karnataka", utility: "BESCOM",
    status: "Active", type: "Industrial (powder coating + assembly)",
    equipment: [
      { id: "FOS-KB-DG-001", name: "DG Set", scope: "S1", category: "S1 — Combustion",
        fuel: "High Speed Diesel", unit: "L", mode: "monthly", subFields: monthlySingle("Litres") },
      { id: "FOS-KB-OV-001", name: "PC Oven (Diesel)", scope: "S1", category: "S1 — Combustion",
        fuel: "High Speed Diesel", unit: "L", mode: "monthly", subFields: monthlySingle("Litres"),
        helper: "Process furnace — highest S1 consumer at this site." },
      { id: "FOS-KB-LP-001", name: "PC Oven (LPG)", scope: "S1", category: "S1 — Combustion",
        fuel: "LPG", unit: "kg", mode: "monthly", subFields: monthlySingle("kg"),
        helper: "LPG cylinder purchases for the same oven." },
      { id: "FOS-KB-FE-001", name: "Fire Extinguisher CO₂", scope: "S1", category: "S1 — Fugitive",
        fuel: "CO₂ gas", unit: "kg", mode: "annual", subFields: ["Annual total"] },
      { id: "FOS-KB-GR-001", name: "Grid Electricity (BESCOM)", scope: "S2",
        category: "S2 — Location-Based", fuel: "Grid kWh", unit: "kWh",
        mode: "monthly", subFields: monthlySingle("kWh") },
    ],
  },
  {
    id: "RM", name: "Ramohalli", state: "Karnataka", utility: "BESCOM",
    status: "Active from Dec-24", type: "Industrial (new plant)",
    equipment: [
      { id: "FOS-RM-DG-001", name: "DG Set", scope: "S1", category: "S1 — Combustion",
        fuel: "High Speed Diesel", unit: "L", mode: "monthly", subFields: monthlySingle("Litres") },
      { id: "FOS-RM-FE-001", name: "Fire Extinguisher CO₂", scope: "S1", category: "S1 — Fugitive",
        fuel: "CO₂ gas", unit: "kg", mode: "annual", subFields: ["Annual total"] },
      { id: "FOS-RM-WD-001", name: "Welding CO₂ Gas Cylinders", scope: "S1", category: "S1 — Fugitive",
        fuel: "CO₂ gas", unit: "kg", mode: "monthly", subFields: monthlySingle("kg") },
      { id: "FOS-RM-GR-001", name: "Grid Electricity (BESCOM)", scope: "S2",
        category: "S2 — Location-Based", fuel: "Grid kWh", unit: "kWh",
        mode: "monthly", subFields: monthlySingle("kWh") },
    ],
  },
  {
    id: "VN", name: "Vasanth Nagar", state: "Karnataka", utility: "BESCOM",
    status: "Active", type: "Retail showroom + Corporate office",
    equipment: [
      { id: "FOS-VN-DG-001", name: "DG Set", scope: "S1", category: "S1 — Combustion",
        fuel: "High Speed Diesel", unit: "L", mode: "monthly", subFields: monthlySingle("Litres") },
      { id: "FOS-VN-FE-001", name: "Fire Extinguisher CO₂", scope: "S1", category: "S1 — Fugitive",
        fuel: "CO₂ gas", unit: "kg", mode: "annual", subFields: ["Annual total"] },
      { id: "FOS-VN-GR-001", name: "Grid Electricity (BESCOM)", scope: "S2",
        category: "S2 — Location-Based", fuel: "Grid kWh", unit: "kWh",
        mode: "monthly", subFields: monthlySingle("kWh") },
    ],
  },
  {
    id: "SP", name: "Sriperumbudur", state: "Tamil Nadu", utility: "TNEB",
    status: "Active", type: "Industrial (TN manufacturing plant)",
    equipment: [
      { id: "FOS-SP-DG-001", name: "DG Set (160KVA + 200KVA)", scope: "S1",
        category: "S1 — Combustion", fuel: "High Speed Diesel", unit: "L",
        mode: "monthly", subFields: ["160KVA", "200KVA"] },
      { id: "FOS-SP-FK-001", name: "Forklifts (Diesel)", scope: "S1",
        category: "S1 — Combustion", fuel: "High Speed Diesel", unit: "L",
        mode: "monthly", subFields: monthlySingle("Litres") },
      { id: "FOS-SP-FE-001", name: "Fire Extinguisher CO₂", scope: "S1",
        category: "S1 — Fugitive", fuel: "CO₂ gas", unit: "kg",
        mode: "annual", subFields: ["Annual total"] },
      { id: "FOS-SP-GR-001", name: "Grid Electricity (TNEB)", scope: "S2",
        category: "S2 — Location-Based", fuel: "Grid kWh", unit: "kWh",
        mode: "monthly", subFields: monthlySingle("kWh"),
        helper: "Tamil Nadu — different grid EF from BESCOM." },
      { id: "FOS-SP-SL-001", name: "Rooftop Solar PV", scope: "S2",
        category: "S2 — RE Info Only", fuel: "Solar PV", unit: "kWh",
        mode: "monthly", subFields: ["Generated", "Self-consumed", "Exported"],
        isSolar: true, helper: "Active from Feb-25." },
    ],
  },
];

export interface Scope3Category {
  id: string;
  code: string;
  name: string;
  dataType: string;
  status: "received" | "pending" | "survey";
}

export const SCOPE3: Scope3Category[] = [
  { id: "c1",  code: "Cat 1",  name: "Purchased Goods & Services",
    dataType: "GRN Register or procurement XLSX (supplier, item, spend INR, qty, unit)",
    status: "received" },
  { id: "c2",  code: "Cat 2",  name: "Capital Goods",
    dataType: "CAPEX register XLSX (asset, vendor, CAPEX INR, date)", status: "received" },
  { id: "c3",  code: "Cat 3",  name: "Fuel- and Energy-Related Activities",
    dataType: "Scope 1 fuel quantities + Scope 2 electricity kWh (same data as S1/S2 inventory)", status: "pending" },
  { id: "c4",  code: "Cat 4",  name: "Upstream Transportation",
    dataType: "Inbound freight log (origin, destination, mode, tonnes, km or INR)", status: "pending" },
  { id: "c5",  code: "Cat 5",  name: "Waste Generated",
    dataType: "Waste disposal records per facility (type, kg, disposal method)", status: "pending" },
  { id: "c6",  code: "Cat 6",  name: "Business Travel",
    dataType: "Travel records (traveller, route, mode, class, distance or spend)", status: "pending" },
  { id: "c7",  code: "Cat 7",  name: "Employee Commuting",
    dataType: "Commute survey — admin initiates. No client upload needed.", status: "survey" },
  { id: "c8",  code: "Cat 8",  name: "Upstream Leased Assets",
    dataType: "Leased asset details: type, floor area, lessor, lease period, energy use if available", status: "pending" },
  { id: "c9",  code: "Cat 9",  name: "Downstream Transportation",
    dataType: "Outbound freight log (same format as Cat 4)", status: "pending" },
  { id: "c10", code: "Cat 10", name: "Processing of Sold Products",
    dataType: "Intermediate product details: processing steps, energy per unit, units sold", status: "pending" },
  { id: "c11", code: "Cat 11", name: "Use of Sold Products",
    dataType: "Product spec: name, avg kWh per use, annual uses, units sold", status: "pending" },
  { id: "c12", code: "Cat 12", name: "End-of-Life Treatment",
    dataType: "Product composition: weight, material split %, disposal routes", status: "pending" },
  { id: "c13", code: "Cat 13", name: "Downstream Leased Assets",
    dataType: "Leased-out asset details: type, floor area, tenant, energy data if available", status: "pending" },
  { id: "c14", code: "Cat 14", name: "Franchises",
    dataType: "Franchisee count and energy data per outlet, or franchisee S1+S2 emissions", status: "pending" },
  { id: "c15", code: "Cat 15", name: "Investments",
    dataType: "Investee names, equity share %, and their Scope 1+2 emissions or investment amounts", status: "pending" },
];

/** Total number of numeric input slots across the whole registry. */
export function totalSlots(): number {
  let n = 0;
  for (const f of FACILITIES) {
    for (const e of f.equipment) {
      n += e.mode === "annual" ? 1 : MONTHS.length * e.subFields.length;
    }
  }
  return n;
}

export function facilitySlots(facilityId: string): number {
  const f = FACILITIES.find((x) => x.id === facilityId);
  if (!f) return 0;
  let n = 0;
  for (const e of f.equipment) {
    n += e.mode === "annual" ? 1 : MONTHS.length * e.subFields.length;
  }
  return n;
}

export function equipmentSlots(e: Equipment): number {
  return e.mode === "annual" ? 1 : MONTHS.length * e.subFields.length;
}
