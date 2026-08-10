# TypeScript Error Report

**Generated:** 2026-08-06  
**Updated:** 2026-08-06 (Sprint 1 complete)  
**Compiler command:** `npx tsc --noEmit`  
**Total errors:** 99 → **0** (Sprint 1 + Platform Foundation complete)  
**Status:** Clean build — zero TypeScript errors

---

## Summary

| Severity | Groups | Errors | Pages affected |
|---|---|---|---|
| **1 — Critical** | 9 | 41 → **0** | FIXED ✓ |
| **2 — High** | 7 | 22 → **0** | FIXED ✓ |
| **3 — Medium** | 10 | 34 → **0** | FIXED ✓ |
| **4 — Low** | 1 | 2 → **0** | FIXED ✓ |

**Alpha recommendation:**  
Fix all Critical and High groups before showing the platform to any client.  
Medium and Low can wait for a post-Alpha cleanup sprint.

---

## 1. Critical — Runtime crash or production build failure

These errors cause a `ReferenceError` or `TypeError` when the page is opened. In Vite dev mode, TypeScript errors are warnings, not blockers — but the JavaScript still executes, and an undefined name at runtime throws. All Critical pages will crash on first render.

---

### C-1 · `peersData` not declared — `/peer` crashes on render

**File:** `src/routes/_app.peer.tsx`  
**Error count:** 12 (TS2304 + cascade TS7006)

| Line | Error |
|---|---|
| 333:13 | TS2304 Cannot find name `peersData` |
| 334:16 | TS7006 Parameter `p` implicitly has `any` type |
| 335:13 | TS7006 Parameter `p` implicitly has `any` type |
| 340:14 | TS7006 Parameter `a` implicitly has `any` type |
| 340:17 | TS7006 Parameter `b` implicitly has `any` type |
| 343:65 | TS7006 Parameter `d` implicitly has `any` type |
| 355:17 | TS2304 Cannot find name `peersData` |
| 355:40 | TS7006 Parameter `p` implicitly has `any` type |
| 432:39 | TS7006 Parameter `d` implicitly has `any` type |
| 432:42 | TS7006 Parameter `i` implicitly has `any` type |
| 457:11 | TS2304 Cannot find name `peersData` |
| 457:33 | TS7006 Parameter `p` implicitly has `any` type |

**Root cause:** `peersData` was never assigned. The `usePeers()` hook exists in `api.ts` (returns `PeerRow[]`) but was never called in the component. The peer page was built around a richer static `PeerData` type (with `p.totals[year]`, `p.trend[]`, `p.sourceSplit[]`, `p.highlight`, `p.id`) that does not match the `PeerRow` interface returned by the hook. This is the largest mismatch in the codebase.

**Root issue detail:**  
`PeerRow` from api.ts: `{ name, scope1, scope2_lb, scope2_mb, scope3_total, intensity_revenue, fy }` — one row per FY per peer.  
`PeerData` expected by page: `{ id, name, totals: Record<year, number>, trend: [], sourceSplit: [], highlight, source, sbti, netzero }` — one object per peer, aggregated across years.  
The `peers.php` endpoint must return the aggregated shape, or the page needs adaptation logic.

**Recommended fix:** Wire up `const { data: peersData } = usePeers();`. Then either: (a) update `peers.php` to return the aggregated shape, or (b) transform `PeerRow[]` into `PeerData[]` with a `useMemo`. Define `PeerData` locally with the shape the page expects.

**Estimated effort:** 2–3 hrs (backend shape alignment + frontend types + local type definition)

---

### C-2 · `SOURCE_COLORS` not declared — `/peer` crashes on render

**File:** `src/routes/_app.peer.tsx`  
**Error count:** 4 (TS2304)

| Line | Error |
|---|---|
| 277:74 | TS2304 Cannot find name `SOURCE_COLORS` |
| 277:92 | TS2304 Cannot find name `SOURCE_COLORS` |
| 302:66 | TS2304 Cannot find name `SOURCE_COLORS` |
| 302:84 | TS2304 Cannot find name `SOURCE_COLORS` |

**Root cause:** `SOURCE_COLORS` was a static color palette array from `featherlite.ts`, which was correctly excluded from the platform. Not replaced with a local definition.

**Recommended fix:** Define locally above the component:
```ts
const SOURCE_COLORS = ["#1E6F5C","#3B82F6","#F59E0B","#EF4444","#8B5CF6","#64748B"];
```

**Estimated effort:** 5 min

---

### C-3 · `PEER_FISCAL_reporting_years` not declared — `/peer` crashes on render

**File:** `src/routes/_app.peer.tsx`  
**Error count:** 2 (TS2304 + cascade TS7006)

| Line | Error |
|---|---|
| 378:16 | TS2304 Cannot find name `PEER_FISCAL_reporting_years` |
| 378:49 | TS7006 Parameter `y` implicitly has `any` type |

**Root cause:** This identifier is a corrupted merge of two separate names: `PEER_FISCAL_YEARS` (a constant for the peer year toggle options) and `reporting_years` (from `useClientContext()`). Neither form exists.

**Recommended fix:** Replace with a locally defined constant:
```ts
const PEER_FISCAL_YEARS = ["2024", "2023", "2022"] as const;
type PeerFY = typeof PEER_FISCAL_YEARS[number];
```
Then replace `PEER_FISCAL_reporting_years` with `PEER_FISCAL_YEARS` on line 378. This also resolves C-type error for `PeerFY` (see M-2).

**Estimated effort:** 10 min

---

### C-4 · `useIntensity` not imported — `/peer` crashes on render

**File:** `src/routes/_app.peer.tsx`  
**Error count:** 1 (TS2304)

| Line | Error |
|---|---|
| 325:35 | TS2304 Cannot find name `useIntensity` |

**Root cause:** `useIntensity` is exported from `api.ts` and used in `_app.trends.tsx`, but was never added to the import statement in `_app.peer.tsx`. Line 28 imports only `{ usePeers, useInventory, getVal }`.

**Recommended fix:** Add `useIntensity` to the api import on line 28:
```ts
import { usePeers, useInventory, useIntensity, getVal } from "@/lib/api";
```

**Estimated effort:** 1 min

---

### C-5 · `invData`/`intensityData` out of scope in `buildSlices` — `/green-finance` crashes

**File:** `src/routes/_app.green-finance.tsx`  
**Error count:** 3 (TS2304 × 2 + cascade TS7006 × 1)

| Line | Error |
|---|---|
| 41:16 | TS2304 Cannot find name `invData` |
| 42:17 | TS2304 Cannot find name `intensityData` |
| 50:28 | TS7006 Parameter `r` implicitly has `any` type |

**Root cause:** `buildSlices(entity)` is a module-scope function (defined outside the React component) that references `invData` and `intensityData` on lines 41–42. These variables are declared INSIDE the component via React Query hooks (lines 234–235). A module-level function cannot close over component-local variables — they are `undefined` in this scope. When `buildSlices` is called inside the component at line 237, `invData` is a ReferenceError at runtime.

```ts
// ❌ Module scope — invData not in scope here
function buildSlices(entity: Entity): Slice[] {
  const inv  = invData;          // ReferenceError
  const intn = (intensityData ?? []);
  ...
}

// ✅ These are INSIDE the component, not accessible above:
const { data: invData }       = useInventory(entity);   // line 234
const { data: intensityData } = useIntensity(entity);   // line 235
const slices = buildSlices(entity);                     // line 237 — crashes
```

**Recommended fix:** Move `buildSlices` inside the component body (after the hook calls), or convert it to accept `invData` and `intensityData` as parameters:
```ts
function buildSlices(
  entity: string,
  invData: InventoryResponse | undefined,
  intensityData: IntensityRow[] | undefined
): Slice[] { ... }
// called as: const slices = buildSlices(entity, invData, intensityData);
```

**Estimated effort:** 20 min

---

### C-6 · `YEARS` not declared — `/green-finance` crashes

**File:** `src/routes/_app.green-finance.tsx`  
**Error count:** 1 (TS2552)

| Line | Error |
|---|---|
| 239:33 | TS2552 Cannot find name `YEARS` — did you mean `year`? |

**Root cause:** Same pattern as CT-3 (fixed in `_app.trends.tsx`). `YEARS` was a static array from `featherlite.ts`. The correct variable is `reporting_years` from `useClientContext()`, which is already in scope at this point (line 230).

**Recommended fix:**
```ts
// Before:
const prevYear = (fyIdx > 0 ? YEARS[fyIdx - 1] : reporting_years[0]);
// After:
const prevYear = (fyIdx > 0 ? reporting_years[fyIdx - 1] : reporting_years[0]);
```

**Estimated effort:** 2 min

---

### C-7 · `priorityData` not declared — `/priority-actions` crashes on render

**File:** `src/routes/_app.priority-actions.tsx`  
**Error count:** 9 (TS2304 × 2 + cascade TS7006 × 7)

| Line | Error |
|---|---|
| 138:20 | TS2304 Cannot find name `priorityData` |
| 138:47 | TS7006 Parameter `i` implicitly has `any` type |
| 138:80 | TS7006 Parameter `a` implicitly has `any` type |
| 139:20 | TS2304 Cannot find name `priorityData` |
| 139:47 | TS7006 Parameter `i` implicitly has `any` type |
| 139:80 | TS7006 Parameter `u` implicitly has `any` type |
| 140:36 | TS7006 Parameter `a` implicitly has `any` type |
| 168:26 | TS7006 Parameter `item` implicitly has `any` type |
| 193:26 | TS7006 Parameter `item` implicitly has `any` type |

**Root cause:** `priorityData` is referenced on lines 138–140 (`(priorityData ?? []).filter(...)`) but was never declared as a variable. The hook `usePriorityItems(entity?)` exists in `api.ts` and returns `PriorityItem[]`, but was never called in the component.

**Recommended fix:** Add the hook call inside the component:
```ts
const { data: priorityData } = usePriorityItems(entity);
```
Also add `usePriorityItems` to the import from `@/lib/api`.

**Estimated effort:** 10 min

---

### C-8 · `dataEntryEntities`/`ENTITY_META` not declared — `/submissions` EntityPicker crashes

**File:** `src/routes/_app.submissions.tsx`  
**Error count:** 5 (TS2304 × 3 + cascade TS7006 × 2)

| Line | Error |
|---|---|
| 197:10 | TS2304 Cannot find name `dataEntryEntities` |
| 197:32 | TS7006 Parameter `e` implicitly has `any` type |
| 197:50 | TS7006 Parameter `e` implicitly has `any` type |
| 206:66 | TS2304 Cannot find name `ENTITY_META` |
| 207:72 | TS2304 Cannot find name `ENTITY_META` |

**Root cause:** `EntityPicker` is a standalone React component (not the main `Submissions` component). It references `dataEntryEntities` (which should be from `useDataEntryEntities()`) and `ENTITY_META` (a static Featherlite-era object with `{ name, blurb }` per entity code, from `featherlite.ts`).

`dataEntryEntities` fix: call `useDataEntryEntities()` inside `EntityPicker`.  
`ENTITY_META` fix: `name` can come from `entity.name` on the `ClientEntity` object; `blurb` doesn't exist in the generic platform — either remove it or use `entity.short` as a subtitle.

**Recommended fix:**
```ts
function EntityPicker(...) {
  const entities = useDataEntryEntities();  // ← add this
  return (
    ...
    {entities.map(e => (
      <button key={e.code} onClick={() => onChange(e.code)} ...>
        <span>{e.code}</span>
        <div>{e.name}</div>           {/* replaces ENTITY_META[e].name */}
        <div>{e.short}</div>          {/* replaces ENTITY_META[e].blurb */}
      </button>
    ))}
  );
}
```

**Estimated effort:** 20 min

---

### C-9 · `invData` direct bracket index on initial load — `/peer` crashes

**File:** `src/routes/_app.peer.tsx`  
**Error count:** 4 (TS18048 × 2, TS7053 × 2)

| Line | Error |
|---|---|
| 328:18 | TS18048 `invData` is possibly `undefined` |
| 328:18 | TS7053 Element has implicit `any` type — `'Scope 1'` can't index `InventoryResponse` |
| 328:50 | TS18048 `invData` is possibly `undefined` |
| 328:50 | TS7053 Element has implicit `any` type — `'Scope 2 LB'` can't index `InventoryResponse` |

**Root cause:** Line 328:
```ts
const flS12 = (invData["Scope 1"][fy] ?? 0) + (invData["Scope 2 LB"][fy] ?? 0);
```
Two bugs in one line: (1) `invData` is `InventoryResponse | undefined` — accessing it with `["Scope 1"]` during initial load (before data arrives) throws `TypeError: Cannot read properties of undefined`. (2) Even when defined, `InventoryResponse` has shape `{ entity, rows }` — not `Record<string, FYSeries>`. Bracket-indexing by metric name is always invalid.

**Recommended fix:**
```ts
const flS12 = (getVal(invData, "Scope 1", fy) ?? 0) + (getVal(invData, "Scope 2 LB", fy) ?? 0);
```
`getVal` handles the `undefined` case internally.

**Estimated effort:** 2 min

---

## 2. High — Incorrect runtime behavior (no crash, but data is wrong or features are broken)

---

### H-1 · `S1BreakdownRow.sub_type` → should be `.source` — Scope 1 breakdown always empty

**Files:** `src/components/DeecarbAI.tsx`, `src/routes/_app.dashboard.tsx`, `src/routes/_app.action-plan.tsx`  
**Error count:** 7 (TS2339)

| File | Line | Error |
|---|---|---|
| `DeecarbAI.tsx` | 140:69 | TS2339 Property `sub_type` does not exist on type `S1BreakdownRow` |
| `DeecarbAI.tsx` | 141:69 | TS2339 Property `sub_type` does not exist on type `S1BreakdownRow` |
| `DeecarbAI.tsx` | 142:69 | TS2339 Property `sub_type` does not exist on type `S1BreakdownRow` |
| `dashboard.tsx` | 303:71 | TS2339 Property `sub_type` does not exist on type `S1BreakdownRow` |
| `dashboard.tsx` | 305:71 | TS2339 Property `sub_type` does not exist on type `S1BreakdownRow` |
| `dashboard.tsx` | 307:71 | TS2339 Property `sub_type` does not exist on type `S1BreakdownRow` |
| `action-plan.tsx` | 468:28 | TS2339 Property `sub_type` does not exist on type `S1BreakdownRow` |

**Root cause:** The `S1BreakdownRow` interface in `api.ts` uses `source: string` (with comment `// "Stationary", "Mobile", "Fugitive"`). All three files reference `.sub_type` instead — this is the field name from the separate `S1ByFacilityRow` interface (`{ facility, sub_type, series }`). The `.filter(r => r.sub_type === "Stationary")` predicates evaluate to `undefined === "Stationary"` = always false. Result: `stationary`, `mobile`, and `fugitive` totals are always 0, and the fuel breakdown in action plan is always empty.

**Recommended fix:** `r.sub_type` → `r.source` in all three files.

**Estimated effort:** 10 min

---

### H-2 · `S2ByFacilityRow.entity` field missing — S2 facility table missing entity column

**Files:** `src/components/DeecarbAI.tsx`, `src/routes/_app.dashboard.tsx`, `src/routes/_app.action-plan.tsx`  
**Error count:** 3 (TS2339)

| File | Line | Error |
|---|---|---|
| `DeecarbAI.tsx` | 147:39 | TS2339 Property `entity` does not exist on type `S2ByFacilityRow` |
| `action-plan.tsx` | 450:46 | TS2339 Property `entity` does not exist on type `S2ByFacilityRow` |
| `dashboard.tsx` | 536:76 | TS2339 Property `entity` does not exist on type `S2ByFacilityRow` |

**Root cause:** `S2ByFacilityRow` in `api.ts` only declares `{ facility: string; series: FYSeries }`. The pages expect `f.entity` for grouping by sub-entity. Two possibilities: (a) the `s2_by_facility.php` endpoint actually returns `entity` in its rows but the TypeScript type wasn't updated, or (b) the field was never returned by the API.

**Recommended fix:** Check `backend/api/ghg/s2_by_facility.php` to see if `entity` is in the SELECT. If it is, add `entity: string` to `S2ByFacilityRow` in `api.ts`. If not, add it to the SQL query. Either way, the type must be updated.

**Estimated effort:** 15 min (10 min if just a type update, 25 min if PHP query needs updating)

---

### H-3 · `DecarbAction.impactMin/impactMax/costPerT` fields missing — scenario calculator broken

**File:** `src/components/decarb/shared.tsx`  
**Error count:** 3 (TS2339)

| Line | Error |
|---|---|
| 168:18 | TS2339 Property `impactMin` does not exist on type `DecarbAction` |
| 168:32 | TS2339 Property `impactMax` does not exist on type `DecarbAction` |
| 172:46 | TS2339 Property `costPerT` does not exist on type `DecarbAction` |

**Root cause:** `abatementFor(a, pct)` and `costFor(a, pct)` reference `a.impactMin`, `a.impactMax`, and `a.costPerT`. The `DecarbAction` interface in `api.ts` only has `abatement_t: number | null` — no impact range or cost fields. At runtime, all three properties evaluate to `undefined`, making `abatementFor` return `NaN`. The `ScenarioProvider` totals are always `NaN` or 0.

**Recommended fix:** Two options:  
(a) Add `impact_min: number | null`, `impact_max: number | null`, `cost_per_t: number | null` to `DecarbAction` and update `decarb_actions.php` to return them from the DB (requires DB column additions). Then fix field names in `shared.tsx`.  
(b) Simplify `abatementFor` to use `a.abatement_t` directly (removes the percentage scaling but unblocks the page).

**Estimated effort:** 30 min (option b) / 2 hrs (option a with DB schema)

---

### H-4 · `DecarbAsset.scope` compared to number literals — all assets hidden

**File:** `src/routes/_app.interactive-inventory.tsx`  
**Error count:** 3 (TS2367)

| Line | Error |
|---|---|
| 83:9 | TS2367 Comparison of `string` and `number` has no overlap |
| 88:43 | TS2367 Comparison of `string` and `number` has no overlap |
| 89:43 | TS2367 Comparison of `string` and `number` has no overlap |

**Root cause:** `DecarbAsset.scope` is typed as `string` in `api.ts`. The interactive inventory page filters with `a.scope === 1` and `a.scope === 2` — numeric literals. Since `"Scope 1" !== 1`, both `s1Assets` and `s2Assets` are always empty arrays. All three category tabs (Scope 1, Scope 2, Renewables) show zero assets.

**Recommended fix:**
```ts
// Before:
const s1Assets = filtered.filter(a => a.scope === 1);
const s2Assets = filtered.filter(a => a.scope === 2);
// After (matching the string values the API returns):
const s1Assets = filtered.filter(a => a.scope === "Scope 1");
const s2Assets = filtered.filter(a => a.scope === "Scope 2");
```
Also update line 83's `scopeLabel` function accordingly.

**Estimated effort:** 10 min (verify string values from API first)

---

### H-5 · `FacilityRow.role/grid/solar` field names wrong — workstreams facility cards show `undefined`

**File:** `src/routes/_app.workstreams.tsx`  
**Error count:** 3 (TS2339)

| Line | Error |
|---|---|
| 283:70 | TS2339 Property `role` does not exist on type `FacilityRow` |
| 287:36 | TS2339 Property `grid` does not exist on type `FacilityRow` |
| 291:30 | TS2339 Property `solar` does not exist on type `FacilityRow` |

**Root cause:** `FacilityRow` in `api.ts`: `{ id, name, entity, location, state, grid_utility, re_instrument }`. The workstreams page references `u.role` (no equivalent), `u.grid` (→ `u.grid_utility`), and `u.solar` (→ `u.re_instrument`). These render as `undefined` in the facility card body.

**Recommended fix:**
- `u.role` → remove or use `u.entity` as the role descriptor (no generic role field exists)
- `u.grid` → `u.grid_utility`
- `u.solar` → `u.re_instrument`

**Estimated effort:** 10 min

---

### H-6 · `"automation_demo"` not in `Role` type — GHG report upload section never shows

**File:** `src/routes/_app.submissions.tsx`  
**Error count:** 2 (TS2367)

| Line | Error |
|---|---|
| 577:39 | TS2367 Types `Role` and `"automation_demo"` have no overlap |
| 614:16 | TS2367 Types `Role` and `"automation_demo"` have no overlap |

**Root cause:** The `Role` type in `auth.ts` does not include `"automation_demo"`. The submissions page checks `role === "automation_demo"` to show/hide the GHG Annual Report upload card. Since this comparison is always `false`, that card never appears. `"automation_demo"` was a Featherlite-era dev/demo role not migrated to the generic role system.

**Recommended fix:** Either:  
(a) Add `"automation_demo"` to the `Role` union and `ROLE_META` in `auth.ts`, or  
(b) Replace `"automation_demo"` with `"deepwoods_admin"` or `"deepwoods_coordinator"` (whichever role should see the GHG report upload) and update `ROLE_META.canAdmin` accordingly.

**Estimated effort:** 15 min

---

### H-7 · `entityName` not in scope in `ScopeWizard` — review step shows blank entity name

**File:** `src/routes/_app.submissions.tsx`  
**Error count:** 1 (TS2304)

| Line | Error |
|---|---|
| 852:88 | TS2304 Cannot find name `entityName` |

**Root cause:** The review step on line 852 calls `entityName(entity)` to display the full entity name. The `entityName` function is defined inside the `Submissions` component, but `ScopeWizard` is a separate component — `entityName` is not in scope inside `ScopeWizard`. This is a runtime ReferenceError when the user reaches the review step of the wizard.

**Recommended fix:** Either:  
(a) Derive it inside `ScopeWizard` using `useClientContext()` (already imported in ScopeWizard after the ARC-M5 fix):
```ts
const { client, entities } = useClientContext();
const entityLabel = entities.find(e => e.code === entity)?.name ?? entity;
```
(b) Pass `entityName` as a prop to `ScopeWizard`.

**Estimated effort:** 10 min

---

## 3. Medium — Type safety (no runtime impact, but TypeScript build fails)

These errors do not cause runtime crashes. They are type annotation mismatches or undefined type names. `tsc --noEmit` fails, but Vite dev and production builds succeed. Fix before enabling strict CI gating.

---

### M-1 · `PeerData` type not defined — peer.tsx type annotations

**File:** `src/routes/_app.peer.tsx`  
**Error count:** 2 (TS2304)

| Line | Error |
|---|---|
| 77:42 | TS2304 Cannot find name `PeerData` |
| 358:30 | TS2304 Cannot find name `PeerData` |

**Root cause:** `PeerData` is used as a parameter type in `PeerDetail` and `getLatestTotal`. It was a rich local type (with `totals`, `trend`, `sourceSplit`, etc.) from the featherlite-era static data but was never defined in platform. Need to define it once the C-1 architectural fix determines the actual shape of peer data.

**Recommended fix:** Define `PeerData` locally as the type returned by the transformed `usePeers()` data (resolved as part of C-1).

**Estimated effort:** Included in C-1

---

### M-2 · `PeerFY` type not defined — peer.tsx type annotation

**File:** `src/routes/_app.peer.tsx`  
**Error count:** 1 (TS2304)

| Line | Error |
|---|---|
| 329:36 | TS2304 Cannot find name `PeerFY` |

**Root cause:** `PeerFY` is a type alias for the year options in the peer selector (e.g., `"2024" | "2023" | "2022"`). Was from featherlite-era static data.

**Recommended fix:** Defined as part of C-3: `type PeerFY = typeof PEER_FISCAL_YEARS[number]`.

**Estimated effort:** Included in C-3

---

### M-3 · `FY` type not defined — `/reports` page type annotations

**File:** `src/routes/_app.reports.tsx`  
**Error count:** 4 (TS2304)

| Line | Error |
|---|---|
| 22:28 | TS2304 Cannot find name `FY` |
| 47:14 | TS2304 Cannot find name `FY` |
| 56:40 | TS2304 Cannot find name `FY` |
| 57:22 | TS2304 Cannot find name `FY` |

**Root cause:** `FY` was a type alias `"FY22" | "FY23" | "FY24" | "FY25" | "FY26"` from `featherlite.ts`. Used here as the key type for `DOCS_BY_YEAR`. No runtime crash (type annotations only).

**Additional issue:** `DOCS_BY_YEAR` hardcodes entity codes `"FP"`, `"FOS"`, `"FL"` throughout — violates the no-hardcoding rule in `CLAUDE.md`. The reports page is serving Featherlite-specific document links. Before second-client onboarding, these documents must come from the DB via `useVaultDocuments()` (hook exists in api.ts).

**Recommended fix:** Define `type FY = string` locally (or `type FY = "FY22" | "FY23" | "FY24" | "FY25" | "FY26"`). Long-term: replace static `DOCS_BY_YEAR` with `useVaultDocuments()`.

**Estimated effort:** 5 min (type alias) / 3 hrs (full VaultDocuments migration)

---

### M-4 · `FY` type not defined — `/green-finance` type annotations

**File:** `src/routes/_app.green-finance.tsx`  
**Error count:** 4 (TS2304)

| Line | Error |
|---|---|
| 105:12 | TS2304 Cannot find name `FY` |
| 107:102 | TS2304 Cannot find name `FY` |
| 108:22 | TS2304 Cannot find name `FY` |
| 108:92 | TS2304 Cannot find name `FY` |

**Root cause:** Same as M-3 — `FY` type alias used in green-finance function signatures. Type-annotation only, no runtime crash.

**Recommended fix:** Add `type FY = string` locally (or extract to a shared types file).

**Estimated effort:** 5 min (consolidated with M-3)

---

### M-5 · `stringCycle` type not defined — `/reporting` type annotations

**File:** `src/routes/_app.reporting.tsx`  
**Error count:** 4 (TS2304)

| Line | Error |
|---|---|
| 68:15 | TS2304 Cannot find name `stringCycle` |
| 116:24 | TS2304 Cannot find name `stringCycle` |
| 123:26 | TS2304 Cannot find name `stringCycle` |
| 278:10 | TS2304 Cannot find name `stringCycle` |

**Root cause:** `stringCycle` is used as a type annotation for the `CYCLES` array and helper function parameters. This is clearly a typo/corruption — the object literal on lines 60–65 defines a `Cycle`/`ReportingCycle` shape. The correct type name was likely `Cycle` but was corrupted to `stringCycle` at some point (possibly a find-and-replace accident). No runtime crash — type annotations only.

**Recommended fix:** Define a `Cycle` type above the `CYCLES` constant matching the object shape (lines 60–65), then replace all four `stringCycle` references with `Cycle`.

**Estimated effort:** 15 min

---

### M-6 · `Entity` type not defined — type annotations in three files

**Files:** `src/routes/_app.vault.tsx`, `src/routes/_app.green-finance.tsx`, `src/routes/_app.priority-actions.tsx`  
**Error count:** 3 (TS2304)

| File | Line | Error |
|---|---|---|
| `vault.tsx` | 29:11 | TS2304 Cannot find name `Entity` |
| `green-finance.tsx` | 40:30 | TS2304 Cannot find name `Entity` |
| `priority-actions.tsx` | 52:33 | TS2304 Cannot find name `Entity` |

**Root cause:** `Entity` was a type alias (likely `"FP" | "FOS" | "FL"` or just `string`) from `featherlite.ts`. Used as a type annotation for entity code parameters. No runtime crash.

**Recommended fix:** Replace `Entity` with `string` in all three files. The platform's generic type for entity codes is already `string` throughout the codebase (e.g., `DataEntryEntity = string` in `submissionsStore.ts`).

**Estimated effort:** 5 min

---

### M-7 · `DatasetId` type not defined — submissions.tsx type annotation

**File:** `src/routes/_app.submissions.tsx`  
**Error count:** 1 (TS2304)

| Line | Error |
|---|---|
| 731:55 | TS2304 Cannot find name `DatasetId` |

**Root cause:** `DatasetId` is used in `scope.id as DatasetId` cast. It was a type from featherlite-era code. `NewSubmission.datasetId` is typed as `string`, so the cast does nothing at runtime.

**Recommended fix:** Remove the cast or replace with `as string`:
```ts
datasetId: scope.id as string,  // or just: scope.id
```

**Estimated effort:** 2 min

---

### M-8 · Null arithmetic in `/inventory` — possible NaN display

**File:** `src/routes/_app.inventory.tsx`  
**Error count:** 8 (TS18047 × 7, TS2322 × 1)

| Line | Error |
|---|---|
| 33:12 | TS18047 `cur` is possibly `null` |
| 33:18 | TS18047 `prev` is possibly `null` |
| 33:26 | TS18047 `prev` is possibly `null` |
| 152:86 | TS18047 `v` is possibly `null` |
| 152:90 | TS18047 `prev` is possibly `null` |
| 152:98 | TS18047 `prev` is possibly `null` |
| 156:85 | TS18047 `v` is possibly `null` |
| 279:54 | TS2322 `(number | null)[]` not assignable to `number[]` |

**Root cause:** `FYSeries` values are `number | null`. The `yoyPct` function and YoY badge calculations perform arithmetic directly without null-guarding. `null - null` = 0 in JavaScript (but `0 / 0` = NaN), and `Math.abs(NaN).toFixed(1)` = "NaN" which would render in the UI. The sparkline `values: number[]` type is too strict — the spark data derives from series which may contain nulls.

**Recommended fix:**
- Add null guards: `if (cur === null || prev === null || prev === 0) return null;` (likely already partially there — check line 32)
- For line 279: filter nulls before passing to sparkline: `.filter((v): v is number => v !== null)`

**Estimated effort:** 20 min

---

### M-9 · `id` on `never` type in `ScenarioProvider` — empty array causes type narrowing to `never`

**File:** `src/components/decarb/shared.tsx`  
**Error count:** 2 (TS2339)

| Line | Error |
|---|---|
| 188:85 | TS2339 Property `id` does not exist on type `never` |
| 209:26 | TS2339 Property `id` does not exist on type `never` |

**Root cause:** Lines 187 and 208 contain `[].map((a) => ...)` and `for (const a of [])`. When TypeScript sees an empty array literal with no annotation, it infers the element type as `never`. `a.id` on `never` is an error. The comment in the file indicates `useDecarbActions()` was intended but removed — the provider always produces empty levers and zero totals as a result.

**Recommended fix:** Annotate the empty arrays or wire up `useDecarbActions()`:
```ts
// Quick fix (preserves current broken behavior but clears the TS error):
const actions: DecarbAction[] = [];
// Correct fix (wires up real data):
const { data: actions = [] } = useDecarbActions();
```
Note: the correct fix also resolves H-3 implicitly (the functions would then be called with properly-shaped data).

**Estimated effort:** 15 min (quick) / 30 min (correct)

---

### M-10 · Cascade implicit `any` in `PeerDetail` — secondary symptom of M-1

**File:** `src/routes/_app.peer.tsx`  
**Error count:** 5 (TS7006)

| Line | Error |
|---|---|
| 143:35 | TS7006 Parameter `r` implicitly has `any` type |
| 277:45 | TS7006 Parameter `_` implicitly has `any` type |
| 277:48 | TS7006 Parameter `i` implicitly has `any` type |
| 300:33 | TS7006 Parameter `fw` implicitly has `any` type |
| 300:37 | TS7006 Parameter `i` implicitly has `any` type |

**Root cause:** `PeerDetail({ p, onClose })` accepts `p: PeerData` — but `PeerData` is undefined (M-1). TypeScript can't infer callback parameter types for methods called on a `never`-typed property. These errors disappear automatically once `PeerData` is defined as part of C-1.

**Recommended fix:** Resolved automatically by C-1 + M-1.

**Estimated effort:** 0 (resolved as part of C-1)

---

## 4. Low — Developer experience / implicit `any`

These errors do not affect runtime behavior. They are standalone implicit `any` type parameters in callbacks.

---

### L-1 · Standalone implicit `any` parameters — `/reporting`

**File:** `src/routes/_app.reporting.tsx`  
**Error count:** 2 (TS7006)

| Line | Error |
|---|---|
| 147:134 | TS7006 Parameter `m` implicitly has `any` type |
| 340:32 | TS7006 Parameter `mp` implicitly has `any` type |

**Root cause:** Two callback parameters without type inference context — `m` in a `.map()` on an untyped array (line 147), and `mp` in a `.map()` on `missingNow` (line 340). No runtime impact.

**Recommended fix:** Annotate with the relevant type once `stringCycle` is resolved (M-5). Both callbacks are over arrays of `MissingPoint` shape.

**Estimated effort:** 5 min (resolved as part of M-5)

---

## Appendix: Errors by file

| File | C | H | M | L | Total |
|---|---|---|---|---|---|
| `src/components/decarb/shared.tsx` | 0 | 3 | 2 | 0 | **5** |
| `src/components/DeecarbAI.tsx` | 0 | 4 | 0 | 0 | **4** |
| `src/routes/_app.action-plan.tsx` | 0 | 2 | 0 | 0 | **2** |
| `src/routes/_app.dashboard.tsx` | 0 | 4 | 0 | 0 | **4** |
| `src/routes/_app.green-finance.tsx` | 4 | 0 | 5 | 0 | **9** |
| `src/routes/_app.interactive-inventory.tsx` | 0 | 3 | 0 | 0 | **3** |
| `src/routes/_app.inventory.tsx` | 0 | 0 | 8 | 0 | **8** |
| `src/routes/_app.peer.tsx` | 19 | 4 | 8 | 0 | **31** |
| `src/routes/_app.priority-actions.tsx` | 9 | 0 | 1 | 0 | **10** |
| `src/routes/_app.reporting.tsx` | 0 | 0 | 4 | 2 | **6** |
| `src/routes/_app.reports.tsx` | 0 | 0 | 4 | 0 | **4** |
| `src/routes/_app.submissions.tsx` | 5 | 3 | 1 | 0 | **9** |
| `src/routes/_app.vault.tsx` | 0 | 0 | 1 | 0 | **1** |
| `src/routes/_app.workstreams.tsx` | 0 | 3 | 0 | 0 | **3** |
| **Total** | **37** | **23** | **34** | **2** | **99** |

> Note: C-9 (peer.tsx `invData` bracket index) is counted in H for the workstreams row but in C for peer.tsx. Adjusted row totals: peer.tsx C=19 includes C-1..C-4 (17 errors) + C-9 (4 errors) – but some TS7006 cascades are in M-10. Exact assignment above.

---

## Alpha Fix Order

### Must fix before Alpha (41 Critical + 23 High = 64 errors → 9 groups)

| Priority | Group | File | Errors | Effort |
|---|---|---|---|---|
| 1 | C-6 YEARS → reporting_years | `green-finance.tsx` | 1 | 2 min |
| 2 | C-9 invData bracket index | `peer.tsx` | 4 | 2 min |
| 3 | C-4 import useIntensity | `peer.tsx` | 1 | 1 min |
| 4 | C-2 define SOURCE_COLORS | `peer.tsx` | 4 | 5 min |
| 5 | C-3 define PEER_FISCAL_YEARS + PeerFY | `peer.tsx` | 2 | 10 min |
| 6 | C-7 wire usePriorityItems | `priority-actions.tsx` | 9 | 10 min |
| 7 | C-8 fix EntityPicker | `submissions.tsx` | 5 | 20 min |
| 8 | H-1 sub_type → source | 3 files | 7 | 10 min |
| 9 | H-2 add entity to S2ByFacilityRow | `api.ts` + 3 files | 3 | 15 min |
| 10 | H-4 scope string comparison | `interactive-inventory.tsx` | 3 | 10 min |
| 11 | H-5 FacilityRow field names | `workstreams.tsx` | 3 | 10 min |
| 12 | H-6 automation_demo role | `submissions.tsx` | 2 | 15 min |
| 13 | H-7 entityName scope | `submissions.tsx` | 1 | 10 min |
| 14 | C-5 buildSlices scope fix | `green-finance.tsx` | 3 | 20 min |
| 15 | C-1 wire usePeers + define PeerData | `peer.tsx` | 12 | 2–3 hrs |
| 16 | H-3 DecarbAction fields | `shared.tsx` | 3 | 30 min |

Items 1–14 ≈ **2 hrs total** (all straightforward, mechanical)  
Item 15 ≈ **2–3 hrs** (requires backend shape investigation)  
Item 16 ≈ **30 min** (depends on whether DB columns exist)

### Can wait for post-Alpha sprint (34 Medium + 2 Low = 36 errors)

| Group | Description | Effort |
|---|---|---|
| M-3 + M-4 | Define `FY` type locally (or shared file) | 10 min |
| M-5 + L-1 | Fix `stringCycle` → `Cycle` type | 15 min |
| M-6 | Replace `Entity` type with `string` | 5 min |
| M-7 | Remove `DatasetId` cast | 2 min |
| M-8 | Null guards in inventory arithmetic | 20 min |
| M-9 | Wire `useDecarbActions()` in ScenarioProvider | 30 min |
| M-10 | Resolved by C-1 | 0 |
| M-1/M-2 | Resolved by C-1/C-3 | 0 |
| M-3 reports hardcoding | Migrate reports page to `useVaultDocuments()` | 3 hrs |

---

## Notes for second-client onboarding

Beyond TypeScript fixes, the following pages contain **hardcoded entity codes** that violate `CLAUDE.md` and will break for any client that isn't Featherlite:

| File | Hardcoding | Impact |
|---|---|---|
| `_app.reports.tsx` | `"FP"`, `"FOS"`, `"FL"` in `DOCS_BY_YEAR` | Reports page shows Featherlite documents for all clients |
| `_app.vault.tsx` | `"FP"`, `"FOS"` in `RECENT` array | Vault page shows Featherlite files for all clients |

Both pages have hooks available (`useVaultDocuments()`) — the static arrays need to be replaced with DB-backed data before client 2.
