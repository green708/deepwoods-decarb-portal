# UI Skeleton & Data Slots
**How the portal renders for any client without code changes**

---

## The Three-Layer Model

Every pixel on every page comes from exactly one of three places:

| Layer | Color | What it is | When it's loaded |
|---|---|---|---|
| **Context slot** | Amber | Driven by `ClientContext` — entities, years, currency, page list, scope 3 boundary | Once at login, cached for the session |
| **API slot** | Blue | Driven by the page's own data fetch — actual emission numbers, chart values, table rows | On every page load / entity / year change |
| **Static chrome** | Grey | Layout structure, icons, section headings, UI controls | Built into the component, never changes |

A component that only has static chrome works for every client already. The work is converting context slots and API slots from hardcoded values to dynamic reads.

---

## The App Shell (runs once, wraps every page)

```
┌─────────────────────────────────────────────────────────────┐
│  TOP BAR                                                    │
│  [logo — CTX]  [entity tabs — CTX]            [year — CTX] │
├──────────┬──────────────────────────────────────────────────┤
│ SIDEBAR  │  PAGE CONTENT                                    │
│          │                                                  │
│ [nav     │  ← rendered by each page route                  │
│  items   │    using API slots                               │
│  — CTX]  │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

### What the app shell reads from `ClientContext`

| Shell region | Currently hardcoded | Reads from context instead |
|---|---|---|
| Logo / wordmark | Featherlite SVG asset | `context.client.logo_url` |
| Primary colour | `#1E6F5C` in CSS | `context.client.primary_color` → CSS variable |
| Client name (header, page title) | "Featherlite" | `context.client.name` |
| Sidebar nav items | All 20 pages always visible | `context.enabled_pages` — only listed pages appear |
| Entity selector tabs | `["FL","FP","FOS"]` hardcoded | `context.entities` — renders whatever is there |
| Consolidated entity tab style | Tab labelled "FL" gets special styling | `entity.consolidated === true` → special style |
| Year picker dropdown | `YEARS = ["FY21"…"FY26"]` hardcoded | `context.reporting_years` |
| Currency symbol (₹ everywhere) | Hardcoded ₹ | `context.currency` → a formatter util |

None of this changes the JSX structure of the shell. It's all a data source swap.

---

## The Three Reusable Components That Drive Everything

These three components appear on almost every page. Making them generic fixes 80% of the hardcoding automatically.

### 1. `<EntitySelector />` — currently on all data pages

**Today:** renders three fixed tabs: FL, FP, FOS.

**After:** receives `entities` from context, renders however many tabs exist. The one with `consolidated: true` gets the roll-up tab style automatically.

```tsx
// Before
const tabs = ["FL", "FP", "FOS"];

// After
const { entities } = useClientContext();
// entities = [{ code, name, short, consolidated }, ...]
// renders tabs from that array
// entity with consolidated=true gets the grouped/bold style
```

For a single-entity client (one company, no subsidiaries), `entities` has two entries: the entity itself and its consolidated mirror — the consolidated tab just shows the same data. The component handles this already by design — no special-casing needed.

### 2. `<YearSeries />` (charts and X-axes) — used by Trends, Inventory, Progress

**Today:** X-axis always renders FY21 through FY26.

**After:** receives `years` from context. A client with only 2 years of data gets a 2-bar chart. A client reporting quarterly gets quarter labels. The chart doesn't care.

```tsx
// Before
const YEARS = ["FY21","FY22","FY23","FY24","FY25","FY26"];

// After
const { reportingYears } = useClientContext();
// pass reportingYears as the x-axis
```

### 3. `<Scope3CategoryList />` — used by Hotspots, Overview, Inventory, Scope3 page

**Today:** always renders all 15 categories; "Not Relevant" status is hardcoded per entity.

**After:** reads `s3_boundary` and `s3_not_relevant` from context.

- Category is in `s3_boundary` AND has a value in the API response → **Calculated** (blue)
- Category is in `s3_not_relevant[entity]` → **Not Relevant** (grey, no value shown)
- Category is in `s3_boundary` but no value in API response → **Data Pending** (amber)
- Category is not in `s3_boundary` → row is hidden entirely

A client that only reports 5 Scope 3 categories sees 5 rows. A full-scope client sees 15. Same component.

---

## Per-Page Slot Map

Every page follows the same pattern: context slots set the frame, the API slot fills the numbers.

### Overview / Dashboard

| Region | Slot type | Source |
|---|---|---|
| Entity tabs | Context | `context.entities` |
| Year shown | Context | `context.reporting_years` (last year = "current") |
| KPI card labels ("Scope 1", "Scope 2 LB", etc.) | Static | Never changes |
| KPI card values | API | `GET /api/ghg/inventory?entity=FL&fy=latest` |
| "vs baseline" label | Context | `context.s12BaseYear` |
| Scope 3 total | API | `GET /api/ghg/inventory` |
| Intensity value | API | `GET /api/ghg/intensity` |
| Intensity unit denominator | Context | `context.currency` (e.g. ₹ Cr) |
| Priority action cards | API | `GET /api/priority-items` |

### Inventory page

| Region | Slot type | Source |
|---|---|---|
| Entity selector | Context | `context.entities` |
| Year tabs | Context | `context.reportingYears` |
| Scope 1 / Scope 2 / Scope 3 accordion | Static | Always 3 sections |
| Emission values in each row | API | `GET /api/ghg/inventory` |
| S1 sub-types (stationary / mobile / fugitive) | API | `GET /api/ghg/s1` |
| S2 sub-types (LB / MB / grid kWh / RE kWh) | API | `GET /api/ghg/s2` |
| Scope 3 category row list | Context | `context.s3Boundary` |
| "Not Relevant" badge | Context | `context.s3NotRelevant[entity]` |
| Category values | API | `GET /api/ghg/inventory` (Cat N rows) |

### Trends page

| Region | Slot type | Source |
|---|---|---|
| X-axis of all charts | Context | `context.reportingYears` |
| Entity series colours | Context | One colour assigned per entity code |
| Trend values (bar heights, line points) | API | `GET /api/ghg/inventory?fy=all` |
| Base year reference line label | Context | `context.s12BaseYear` |
| Intensity denominators | Context | `context.currency` |
| Intensity values | API | `GET /api/ghg/intensity` |

### Action Plan / Decarbonisation

| Region | Slot type | Source |
|---|---|---|
| Entity filter tabs | Context | `context.entities` |
| Action cards list | API | `GET /api/decarb/actions` |
| Action card: "Facility" labels | API | facility codes in `decarb_actions.facilities` JSON |
| Scenario builder baseline values | API | `GET /api/ghg/inventory` |
| Target line in scenario chart | Context | `context.targets.sbtiTargetS12` |
| Target year label | Context | `context.targets.sbtiTargetYear` |
| Carbon price scenarios | Context | `context.carbon_prices` (from config) |

### Credits page

| Region | Slot type | Source |
|---|---|---|
| Entity tabs (data-entry entities only) | Context | `context.dataEntryEntities` |
| Year tabs | Context | `context.reportingYears` |
| I-REC rows | API | `GET /api/credits/irec` |
| Grid MWh history chart | API | `GET /api/credits/irec` (includes grid_mwh) |
| I-REC factor used | Context | `context.config.irec_factor` |

### Submissions page

| Region | Slot type | Source |
|---|---|---|
| Entity selector (data-entry only) | Context | `context.dataEntryEntities` |
| Dataset cards list | API | `GET /api/datasets` |
| Facility dropdown options | API | `GET /api/ghg/facilities` |
| Year options | Context | `context.reportingYears` |

### Peer Benchmarking

| Region | Slot type | Source |
|---|---|---|
| "Your company" row label | Context | `context.client.name` |
| "Your company" values | API | `GET /api/ghg/inventory` |
| Peer rows | API | `GET /api/peers` |
| Comparison year | Context | `context.reportingYears` (latest) |

### Methodology page

| Region | Slot type | Source |
|---|---|---|
| All text sections | API | `GET /api/methodology` |
| Entity names in text | Context | `context.entities` |
| Base year references | Context | `context.s12BaseYear`, `context.s3BaseYear` |

### Vault / Reports

| Region | Slot type | Source |
|---|---|---|
| Document rows | API | `GET /api/vault/documents` |
| Entity filter tabs | Context | `context.entities` (including FL) |
| Year filter options | Context | `context.reportingYears` |

---

## The "Empty State" Skeleton

When a brand new client is onboarded and has no data yet, every page should degrade gracefully — no crashed charts, no broken tables. Each slot just shows an empty/zero state.

| Situation | What the UI shows |
|---|---|
| No inventory data for a year | Chart bar = 0 / greyed out |
| Scope 3 category not yet calculated | "Data pending" badge, no value |
| No actions added yet | Empty state card: "No actions defined yet" |
| No vault documents | Empty state: "No documents uploaded" |
| No I-REC records | Empty credits page with upload prompt |

These empty states already exist in the current portal for individual missing data points. No new logic is needed — the slots simply receive an empty array from the API and render accordingly.

---

## The Entity Colour Problem

Right now entity colours are hardcoded (e.g. FP = teal, FOS = blue, FL = dark). For a new client, the portal needs to assign colours automatically.

Simple solution: assign colours from a fixed palette based on entity position in the array.

```ts
const ENTITY_PALETTE = [
  "#1E6F5C",  // position 0 — primary entity
  "#3B82F6",  // position 1
  "#F59E0B",  // position 2
  "#8B5CF6",  // position 3
  "#EF4444",  // position 4
];

function entityColor(index: number): string {
  return ENTITY_PALETTE[index % ENTITY_PALETTE.length];
}
```

The consolidated entity always gets the darkest/most prominent colour (position 0 if it's listed first, otherwise last). This is set by `sort_order` in `client_entities`.

---

## What This Looks Like for a New Client

Client: Dolphin Products Ltd. — one entity (DPL), 3 years of data, 6 Scope 3 categories.

- Entity selector shows: `DPL` and `CORP (consolidated)` — 2 tabs instead of 3
- Year picker shows: FY24, FY25, FY26 — 3 options instead of 6
- Scope 3 table shows 6 rows (the ones in `s3_boundary`) — not 15
- Sidebar shows only the pages in `enabled_pages` — e.g. Overview, Inventory, Trends, Submissions, Vault
- All numbers are Dolphin's numbers from the DB
- Primary colour uses Dolphin's brand colour
- Logo shows Dolphin's logo

The JSX of every single component is identical to Featherlite's. Only the data is different.

---

## Summary: What actually changes in the component code

| Component | Change needed |
|---|---|
| `AppShell` / `__root.tsx` | Fetch `ClientContext` on load; inject CSS variable for `primary_color`; drive sidebar from `enabled_pages` |
| `EntitySelector` | Replace hardcoded `["FL","FP","FOS"]` with `context.entities` |
| `YearPicker` | Replace hardcoded `YEARS` with `context.reportingYears` |
| `Scope3CategoryList` | Replace hardcoded 15-row render + hardcoded `NOT_RELEVANT` with context boundary |
| Currency formatter util | Replace hardcoded `₹` with `context.currency` |
| Any component that references `S12_BASE_YEAR` | Replace with `context.s12BaseYear` |
| Any component that references `TARGETS` | Replace with `context.targets` |
| Any component that references `ENTITY_META[e].name` | Replace with `context.entities.find(e => e.code)?.name` |

Everything else — page layouts, chart types, table structures, form logic, auth, file uploads — stays exactly as is.
