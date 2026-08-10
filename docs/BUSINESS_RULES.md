# Business Rules

GHG calculation rules, reporting conventions, and business logic embedded in the portal.

---

## GHG Protocol Standards

- **Standard:** GHG Protocol Corporate Standard + ISO 14064-1:2018
- **Consolidation approach:** Operational control boundary
- **Reporting period:** Fiscal Year (April–March) unless client uses Calendar Year

---

## Emission Factor Sources

| Source Type | Emission Factor | Standard | Notes |
|---|---|---|---|
| Diesel (stationary/mobile) | 2.68 kgCO2e/L | DEFRA 2025 / IPCC AR6 | Used in report generator |
| LPG | 2.983 kgCO2e/kg | DEFRA 2025 / IPCC AR6 | |
| CO2 (fugitive — fire ext., welding) | 1.0 kgCO2e/kg | Pass-through (GWP = 1) | |
| HFC (foam blowing agents) | Pass-through (GWP per species) | IPCC AR5 | Already expressed in tCO2e |
| Karnataka grid electricity | 0.727 kgCO2e/kWh | CEA v20 FY25+ | Previous: 0.703–0.716 (v17–v19) |
| Tamil Nadu grid electricity | 0.75 kgCO2e/kWh | CEA v19 FY23-24 | |
| Freight (road, rail, sea) | Distance-based, mode-specific | DEFRA 2025 | |
| Business travel | Distance/spend-based | DEFRA 2025 / USEEIO v2 | |
| Employee commuting | Mode + distance survey | DEFRA 2025 passenger EFs | |
| Purchased goods & services | Spend-based | USEEIO v2 | |
| Capital goods | Spend-based | USEEIO v2 | |

### GWP Values (IPCC AR5 100-year)
- CH4 = 28
- N2O = 265
- CO2 = 1

---

## Scope Definitions

### Scope 1 — Direct Emissions
Sources controlled or owned by the reporting entity:
- Stationary combustion: DG sets, process equipment (PC oven, LPG)
- Mobile combustion: company vehicles, forklifts
- Fugitive: CO2 fire extinguisher discharges, CO2 welding cylinders, HFC foam blowing agents

### Scope 2 — Indirect Electricity Emissions
Reported under two methods:
- **Location-based (LB):** Grid emission factor × kWh consumed
- **Market-based (MB):** Residual mix EF after accounting for renewable energy instruments (I-RECs, PPAs, solar own-gen)
  - If RE instruments cover 100% of grid consumption → Scope 2 MB = 0

### Scope 3 — Value Chain Emissions
15 categories per the GHG Protocol. Categories assessed per entity:

| Category | Featherlite Relevance |
|---|---|
| Cat 1: Purchased Goods & Services | Relevant — spend-based, USEEIO v2 |
| Cat 2: Capital Goods | Relevant — spend-based, USEEIO v2 |
| Cat 3: Fuel & Energy-Related | Relevant — WTT + T&D losses |
| Cat 4: Upstream Transport | Relevant — distance-based |
| Cat 5: Waste | Relevant — waste type × treatment |
| Cat 6: Business Travel | Relevant — distance/spend |
| Cat 7: Employee Commuting | Relevant — mode survey |
| Cat 8: Upstream Leased Assets | Not Relevant |
| Cat 9: Downstream Transport | Relevant — distance-based |
| Cat 10: Processing of Sold Products | Not Relevant (FP) |
| Cat 11: Use of Sold Products | Relevant (FOS only — electric height-adjustable tables) |
| Cat 12: End-of-Life | Relevant — product sales volume × EoL EF |
| Cat 13: Downstream Leased Assets | Not Relevant |
| Cat 14: Franchises | Not Relevant |
| Cat 15: Investments | Not Relevant |

---

## Base Year Rules

| Scope | Base Year | Restatement Threshold |
|---|---|---|
| Scope 1 & 2 | FY22 | ≥5% change in base-year emissions |
| Scope 3 | FY24 | ≥5% change in base-year emissions |

Restatement is required for:
- Structural changes (acquisitions, disposals, mergers)
- Changes in calculation methodology
- Discovery of significant data errors

---

## Consolidation Rules

A **consolidated entity** (e.g. `FL`) is a reporting-only view that sums child entities.

```typescript
// FL = FP + FOS for all metrics
FL_INVENTORY[metric][year] = FP[metric][year] + FOS[metric][year]
// null handling: null + number = number; null + null = null
```

The `consolidates` JSON field in `client_entities` defines which child entities are summed.

---

## Intensity Metrics

| Intensity | Formula | Unit |
|---|---|---|
| Revenue intensity (LB) | (Scope 1 + Scope 2 LB) / Revenue | tCO2e / ₹ lakh |
| Revenue intensity (MB) | (Scope 1 + Scope 2 MB) / Revenue | tCO2e / ₹ lakh |
| Production intensity (LB) | (Scope 1 + Scope 2 LB) / Production Units | tCO2e / unit |
| Production intensity (MB) | (Scope 1 + Scope 2 MB) / Production Units | tCO2e / unit |

---

## Market-Based Scope 2 Rules

1. Procure I-RECs or PPA → volume matched to grid kWh purchased
2. If RE instruments ≥ grid kWh → Scope 2 MB = 0
3. If partial coverage → MB = (grid kWh − RE kWh) × CEA grid EF
4. On-site solar own-gen counts as 100% renewable, reduces net grid purchase

---

## Data Quality Flags

Source data may have three quality states:
- **Verified** — confirmed against source workbooks
- **Estimated** — calculated from partial data
- **Missing** — data not yet collected; report is INTERIM

---

## Reporting Cycle Logic

### INTERIM vs. FINAL Report
- **INTERIM:** Any data point is null/missing → report has red "NOT FOR PUBLIC" banner and missing data table
- **FINAL:** All mandatory data points populated → clean report suitable for client delivery

### Submission Versioning
Submissions follow V1 → V2 → V3 versioning within a fiscal year. A new submission for the same `(entity, dataset_id, year)` creates a new version. The latest approved version is authoritative.

### Review States
```
Pending → Approved (data accepted, moves to inventory)
Pending → Rejected → resubmit as new version
Pending → Reassigned (moved to another reviewer)
```

---

## Fiscal Year Convention

FY = April–March Indian fiscal year.

| FY Label | Period |
|---|---|
| FY22 | April 2021 – March 2022 |
| FY23 | April 2022 – March 2023 |
| FY24 | April 2023 – March 2024 |
| FY25 | April 2024 – March 2025 |
| FY26 | April 2025 – March 2026 |

Array index convention in `featherlite.ts`:
- `fy[0]` = FY22, `fy[1]` = FY23, ..., `fy[4]` = FY26

---

## Carbon Pricing Scenarios (Green Finance page)

| Scenario | Carbon Price |
|---|---|
| Low | ₹500/tCO2e |
| Medium | ₹1,500/tCO2e |
| High | ₹3,000/tCO2e |
| Premium | ₹5,000/tCO2e |

Applied to Grand Total LB emissions for P&L impact modelling.

---

## I-REC Procurement

- 1 I-REC = 1 MWh of renewable electricity
- I-RECs must match the vintage year of the grid consumption they offset
- I-REC cost factor (configurable via `client_config.irec_factor`): default 0.597
- Maximum FP procurement: 144 MWh/year (configurable via `client_config.irec_max_mwh`)

---

## Navigation / Page Access Rules

Pages are gated via two mechanisms:

1. **`enabled_pages` config key** — per-client list of enabled page IDs. Pages not in the list are hidden from the sidebar.
2. **`LockedState` component** — displays "Access restricted" for role-based gating within a page.

Admin pages (`/admin`, `/reporting`) require `deepwoods_admin` or `deepwoods_coordinator` role.
