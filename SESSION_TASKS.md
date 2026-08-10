# Sprint 1 Session Tasks — Platform Stabilization

**Goal:** Critical = 0, High = 0, Featherlite hardcoding = 0  
**Date:** 2026-08-06  
**Starting error count:** 99

---

## Group 1 — peer.tsx quick fixes (C-2, C-3, C-4, C-9)
- [x] C-4 — Add `useIntensity` to import
- [x] C-2 — Add `SOURCE_COLORS` constant
- [x] C-3 — Add `PEER_FISCAL_YEARS` + `PeerFY` type
- [x] C-9 — Fix `invData["Scope 1"][fy]` → `getVal(invData, "Scope 1", fy)`

## Group 2 — peer.tsx PeerData + peersData (C-1)
- [x] C-1 — Define `PeerData` type, wire `usePeers()`, add transform memo

## Group 3 — green-finance.tsx (C-5, C-6)
- [x] C-5 — Refactor `buildSlices` to accept params, fix `revenue_lakh`
- [x] C-6 — `YEARS[fyIdx-1]` → `reporting_years[fyIdx-1]`
- [x] Add `type FY = string` to fix local FY references

## Group 4 — priority-actions.tsx (C-7)
- [x] C-7 — Wire `usePriorityItems(entity)` → `priorityData`
- [x] Fix `Entity` type → `string` in `EntityChip`

## Group 5 — submissions.tsx (C-8, H-6, H-7)
- [x] C-8 — Fix `EntityPicker`: use `useDataEntryEntities()`, remove `ENTITY_META`
- [x] H-6 — `role === "automation_demo"` → `ROLE_META[role].canAdmin`
- [x] H-7 — `entityName(entity)` in ScopeWizard → inline entity lookup
- [x] Fix `DatasetId` → `string` cast

## Group 6 — H-1: sub_type → source (3 files)
- [x] `src/components/DeecarbAI.tsx` lines 140-142
- [x] `src/routes/_app.dashboard.tsx` lines 303-307
- [x] `src/routes/_app.action-plan.tsx` line 468

## Group 7 — H-2: S2ByFacilityRow.entity (api.ts)
- [x] Add `entity?: string` to `S2ByFacilityRow` in `src/lib/api.ts`

## Group 8 — H-3: DecarbAction missing fields (decarb/shared.tsx)
- [x] Rewrite `abatementFor` and `costFor` to use `abatement_t`

## Group 9 — H-4: scope number vs string (interactive-inventory.tsx)
- [x] `a.scope === 1/2` → `a.scope === "Scope 1"/"Scope 2"`

## Group 10 — H-5: FacilityRow field names (workstreams.tsx)
- [x] `u.role` → remove
- [x] `u.grid` → `u.grid_utility`
- [x] `u.solar` → `u.re_instrument`

## Group 11 — Featherlite hardcoding (vault.tsx, reports.tsx)
- [x] `vault.tsx` — Replace `RECENT` static array with `useVaultDocuments()`
- [x] `reports.tsx` — Replace `DOCS_BY_YEAR` static with `useVaultDocuments()`

---

## Post-sprint (separate tasks)
- [ ] CT-1 — Migrate legacy DB roles in schema_combined.sql
- [ ] HP-1 — Move Groq API keys server-side
- [ ] `git init && git add -A && git commit`
- [ ] Parameterize automation/Code.gs client IDs
- [ ] Add pagination to submissions.php + audit-log.php
- [ ] Create generic public/templates/ Excel files
