import type { OperationalControl, Scope3Status } from './inventory-types';

// ── Fuel lookup lists ─────────────────────────────────────────────────────────

export const FOSSIL_FUELS = [
  'HSD Diesel',
  'Petrol / Gasoline',
  'LPG',
  'Natural Gas / PNG',
  'Furnace Oil (HSFO / LSFO)',
  'Coal',
  'Petcoke',
  'Kerosene',
  'Other fossil',
];

export const BIOGENIC_FUELS = [
  'Wood / Woody Biomass',
  'Rice Husk / Agricultural Residue',
  'Biodiesel (B100)',
  'Bioethanol',
  'Biogas / Landfill Gas',
  'Biogenic Municipal Waste',
  'Other biogenic',
];

export const REFRIGERANT_GROUPS = [
  {
    label: 'HFCs (refrigerants)',
    items: [
      'R-410A',
      'R-134a',
      'R-32',
      'R-404A',
      'R-407C',
      'R-125',
      'R-143a',
      'R-152a',
      'Other HFC',
    ],
  },
  {
    label: 'HCFCs (being phased out)',
    items: ['R-22', 'R-123', 'Other HCFC'],
  },
  {
    label: 'PFCs',
    items: ['CF₄', 'C₂F₆', 'C₃F₈', 'Other PFC'],
  },
  {
    label: 'Other regulated gases',
    items: ['SF₆', 'NF₃', 'CO₂ (fire suppression)'],
  },
  {
    label: 'Natural refrigerants',
    items: [
      'R-717 (ammonia)',
      'R-744 (CO₂)',
      'R-290 (propane)',
      'R-600a (isobutane)',
      'Other natural',
    ],
  },
];

// ── Blank operational control defaults ────────────────────────────────────────
// All 15 GHG Protocol Scope 3 categories, unassessed by default.

const SCOPE3_CATEGORIES: Array<{ number: number; name: string }> = [
  { number: 1,  name: 'Purchased Goods & Services' },
  { number: 2,  name: 'Capital Goods' },
  { number: 3,  name: 'Fuel- and Energy-Related Activities' },
  { number: 4,  name: 'Upstream Transportation & Distribution' },
  { number: 5,  name: 'Waste Generated in Operations' },
  { number: 6,  name: 'Business Travel' },
  { number: 7,  name: 'Employee Commuting' },
  { number: 8,  name: 'Upstream Leased Assets' },
  { number: 9,  name: 'Downstream Transportation & Distribution' },
  { number: 10, name: 'Processing of Sold Products' },
  { number: 11, name: 'Use of Sold Products' },
  { number: 12, name: 'End-of-Life Treatment of Sold Products' },
  { number: 13, name: 'Downstream Leased Assets' },
  { number: 14, name: 'Franchises' },
  { number: 15, name: 'Investments' },
];

export const BLANK_OP_CONTROL: OperationalControl = {
  kyoto: {
    co2:  'notPresent',
    ch4:  'notPresent',
    n2o:  'notPresent',
    hfcs: 'notPresent',
    pfcs: 'notPresent',
    sf6:  'notPresent',
    nf3:  'notPresent',
  },
  scope3: SCOPE3_CATEGORIES.map((cat) => ({
    categoryNumber: cat.number,
    categoryName:   cat.name,
    status:         'deferred' as Scope3Status,
    rationale:      '',
    manuallyEdited: false,
  })),
};
