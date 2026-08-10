// ─────────────────────────────────────────────────────────────────────────────
// master.ts — Generic GHG platform constants
//
// All client-specific data (inventory, facilities, targets, IRECs, assets)
// must come from the database via the React Query hooks in src/lib/api.ts.
//
// Only platform-wide constants that are independent of any specific client
// belong here.
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. datasets.ts — re-exported in full ──────────────────────────────────────
export * from "@/data/datasets";

// ─────────────────────────────────────────────────────────────────────────────
// 2. Generic platform constants
// ─────────────────────────────────────────────────────────────────────────────

// ── I-REC & Renewable energy ──────────────────────────────────────────────────

/** tCO2e abated per MWh of I-REC procured (CEA grid EF × GWP).
 *  Update annually when CEA publishes new grid emission factors. */
export const IREC_FACTOR = 0.597;

/** Indicative I-REC procurement cost range (INR/MWh). */
export const IREC_COST_PER_MWH = { low: 15, high: 25 } as const;

/** Indicative voluntary carbon credit cost range (INR/tCO2e). */
export const CARBON_CREDIT_COST_PER_T = { low: 800, high: 2000 } as const;

// ── Carbon pricing scenarios (green-finance page) ─────────────────────────────
/** Four carbon price scenarios used in the Green Finance income-statement model. */
export const CARBON_PRICES = [
  { label: "₹500/t",   price: 500,  note: "Current India voluntary market" },
  { label: "₹1,000/t", price: 1000, note: "Near-term compliance scenario" },
  { label: "₹2,500/t", price: 2500, note: "CBAM-equivalent exposure" },
  { label: "₹5,000/t", price: 5000, note: "Net-zero alignment price" },
] as const;

// ── Reporting workflow milestones (data submission cycle) ─────────────────────
export const REPORTING_WORKFLOW = [
  { d: 0, label: "Open"   },
  { d: 1, label: "Day 1"  },
  { d: 3, label: "Day 3"  },
  { d: 5, label: "Day 5"  },
  { d: 7, label: "Report" },
] as const;

// ── DeeCarb AI — Groq configuration ──────────────────────────────────────────
export const GROQ_MODEL = "llama-3.3-70b-versatile";

// ── Type stubs — shapes for data fetched from the API ─────────────────────────

export interface IRECRow {
  entity: string;
  facility: string;
  mwh: number;
  coverage: string;
  vintage: string;
  instrument: string;
  status: "Retired" | "Recommended" | "Active";
}

export interface GenRow {
  entity: string;
  facility: string;
  type: string;
  detail: string;
}

export interface FacilityDetail {
  name:   string;
  entity: string;
  grid:   string;
  solar:  string;
  role:   string;
}

export interface ActionItem {
  id:       number;
  entity:   string;
  title:    string;
  age:      string;
  link:     string;
  priority: "High" | "Medium" | "Low";
  detail:   string;
}

export interface UpdateItem {
  id:     number;
  entity: string;
  title:  string;
  age:    string;
  link:   string;
  tag:    string;
  detail: string;
}

export interface S1EquipRow { name: string; t: number; pct: number; high: boolean; }
export interface S1FuelRow  { name: string; t: number; pct: number; }

// ── Workstreams / Service Catalogue ───────────────────────────────────────────
// Platform taxonomy for service clusters and workstreams.
// Status and client-specific delivery notes are managed in the database.
// This constant defines the fixed service framework available on the platform.

export type ClusterStatus = "active" | "partial" | "none";
export type Tier = { label: string; items: string[] };
export type SubClusterDef = {
  id: string;
  name: string;
  status: ClusterStatus;
  note?: string;
  tiers?: { A?: Tier; B?: Tier; C?: Tier; D?: Tier };
};
export type ClusterDef = { n: number; name: string; status: ClusterStatus; subs: SubClusterDef[] };

const T = (label: string, items: string[]): Tier => ({ label, items });

export const CLUSTERS: ClusterDef[] = [
  {
    n: 1, name: "GHG Reporting", status: "none",
    subs: [
      { id: "1.1", name: "Scope 1 & 2 GHG Inventory — Accounting & Reporting", status: "none",
        tiers: {
          A: T("Assessment & Scoping", ["Organisational & operational boundary definition", "Emission source identification", "Base year selection", "Inventory readiness assessment"]),
          B: T("Data Collection & Analysis", ["Facility-wise activity data collection", "Emission factor selection (DEFRA, CEA)", "Scope 1 calculations", "Scope 2 calculations (location-based & market-based)", "Intensity metrics"]),
          C: T("Production & Delivery", ["Annual GHG Inventory Reports", "Consolidated entity summaries", "YoY trend analysis"]),
          D: T("Strategy & Improvement", ["Emission reduction opportunity identification", "Data quality improvement roadmap"]),
        } },
      { id: "1.2", name: "Scope 3 Value Chain Emissions — Accounting & Reporting", status: "none",
        tiers: {
          A: T("Assessment & Scoping", ["Category screening across all 15 GHG Protocol categories", "Materiality assessment", "Boundary & exclusion justification"]),
          B: T("Data Collection & Analysis", ["Category-wise data collection & calculation", "EF hierarchy selection", "Multi-entity consolidation"]),
          C: T("Production & Delivery", ["Scope 3 GHG Emissions Summary Report", "Category-level inventory"]),
          D: T("Strategy & Improvement", ["Hotspot identification", "Category data-coverage expansion"]),
        } },
      { id: "1.3", name: "Verification & Assurance", status: "none" },
      { id: "1.4", name: "GHG Reporting & Public Disclosure", status: "none",
        tiers: { C: T("Production & Delivery", ["Annual GHG disclosure reports", "Single-page summary formats", "Regulatory submission support"]) } },
    ],
  },
  {
    n: 2, name: "Decarbonization", status: "none",
    subs: [
      { id: "2.1", name: "Net Zero Target Setting", status: "none" },
      { id: "2.2", name: "Decarbonization Roadmap", status: "none" },
      { id: "2.3", name: "Action Plan Development", status: "none" },
      { id: "2.4", name: "Progress Tracking & Reporting", status: "none" },
    ],
  },
  {
    n: 3, name: "Sustainability Communication", status: "none",
    subs: [
      { id: "3.1", name: "Sustainability Report", status: "none" },
      { id: "3.2", name: "Stakeholder Communication", status: "none" },
      { id: "3.3", name: "ESG Disclosure Support", status: "none" },
    ],
  },
  {
    n: 12, name: "Carbon Strategy", status: "none",
    subs: [
      { id: "12.1", name: "Carbon Offset Strategy", status: "none" },
      { id: "12.2", name: "I-REC & Renewable Procurement", status: "none" },
      { id: "12.3", name: "Carbon Pricing & Finance", status: "none" },
    ],
  },
];
