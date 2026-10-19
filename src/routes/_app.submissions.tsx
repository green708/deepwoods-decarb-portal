import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Paperclip, StickyNote, Save, Send, Info, CheckCircle2, AlertTriangle, Upload, Download } from "lucide-react";
import * as XLSX from "xlsx";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDecarbAssets, useFacilities, useNdcThreadsSummary, resolveAssetUnit } from "@/lib/api";
import type { DecarbAsset, FacilityRow } from "@/lib/api";
import { useEntity, useFiscalYear } from "@/lib/entity";
import { ThreadPanel } from "@/components/threads/ThreadPanel";
import { ThreadBadge } from "@/components/threads/ThreadBadge";
import { useClientContext } from "@/lib/client-context";
import { authFetch, getRole } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useHomeSummary, useSubmitCycle } from "@/lib/api-admin";
import { trackerSummary } from "@/lib/tracker-progress";
import { toast } from "sonner";
import { GhgStoreProvider } from "@/lib/ghg/store";
import { Scope3Cards } from "@/components/ghg/Scope3Cards";

export const Route = createFileRoute("/_app/submissions")({ component: DataTrackerPage });

// ── Month helpers ─────────────────────────────────────────────────────────────

function genMonths(fy: string, startMonth = 4): { key: string; short: string }[] {
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
    // CY: all months in the same (end) year. FY/custom: months before startMonth wrap to endYear.
    const calYear = startMonth === 1 ? endYear : (monthIdx < startMonth - 1 ? endYear : endYear - 1);
    const yy2 = String(calYear).slice(-2);
    return { key: `${m}-${yy2}`, short: `${label}-${yy2}` };
  });
}

// ── Asset helpers ─────────────────────────────────────────────────────────────

// Fugitive-gas assets (fire extinguishers, refrigerants) are always a single
// annual figure — an occasional recharge/top-up event isn't naturally monthly
// data, so this is unconditional and never spread across months.
function isAnnual(asset: DecarbAsset): boolean {
  const st = (asset.sub_type ?? "").toLowerCase();
  return st === "fugitive" || st.includes("refrigerant") || st.includes("fire ext");
}

// Some years report even fugitive/refrigerant recharges monthly instead of as
// one annual total (e.g. a ledger that switches to monthly reporting for a
// given fiscal year) -- if real monthly data already exists for this asset,
// show the monthly grid instead of forcing annual-only mode and hiding it.
function hasAnyMonthlyData(assetSeries: Record<string, number | null | undefined>, months: { key: string }[]): boolean {
  return months.some(m => assetSeries[m.key] != null || assetSeries[`${m.key}__lb`] != null);
}

// isAnnual(asset) alone is a static sub_type check; this also accounts for an
// asset that actually has real monthly data this year, so progress counts and
// the "Annual entry" badge match what EquipmentGrid actually renders.
function isAnnualNow(asset: DecarbAsset, months: { key: string }[]): boolean {
  return isAnnual(asset) && !hasAnyMonthlyData(asset.series ?? {}, months);
}

function isSolar(asset: DecarbAsset): boolean {
  const n = (asset.name ?? "").toLowerCase();
  const st = (asset.sub_type ?? "").toLowerCase();
  return n.includes("solar") || st.includes("solar");
}

function isS2Electricity(asset: DecarbAsset): boolean {
  return asset.scope === "Scope 2" && !isSolar(asset);
}

function getSubFields(asset: DecarbAsset): string[] {
  if (isSolar(asset)) return ["Generated", "Self-consumed", "Exported"];
  return [resolveAssetUnit(asset)];
}

function getScopeInfo(asset: DecarbAsset): { label: string; isS1: boolean } {
  const st = (asset.sub_type ?? "").toLowerCase();
  const sc = asset.scope ?? "";
  if (sc === "Scope 1") {
    if (st.includes("fugitive") || st.includes("refrigerant") || st.includes("fire ext"))
      return { label: "S1 — Fugitive", isS1: true };
    if (st.includes("process")) return { label: "S1 — Process", isS1: true };
    if (st.includes("mobile")) return { label: "S1 — Mobile Combustion", isS1: true };
    return { label: "S1 — Combustion", isS1: true };
  }
  if (sc === "Scope 2") {
    if (isSolar(asset)) return { label: "S2 — RE Info Only", isS1: false };
    return { label: "S2 — LB + MB", isS1: false };
  }
  return { label: sc, isS1: false };
}

// ── Cell state: assetId → periodKey → value ───────────────────────────────────

type CellMap = Record<string, Record<string, number | null>>;

// ── Per-equipment grid (exact dc EquipmentMonthlyGrid layout) ─────────────────

interface GridProps {
  asset: DecarbAsset;
  months: { key: string; short: string }[];
  cells: CellMap;
  onCellChange: (assetId: string, periodKey: string, value: number | null) => void;
}

function EquipmentGrid({ asset, months, cells, onCellChange }: GridProps) {
  const assetCells = cells[asset.id] ?? {};
  const annual = isAnnual(asset) && !hasAnyMonthlyData(assetCells, months);
  const solar = isSolar(asset);
  const subFields = getSubFields(asset);
  const multi = subFields.length > 1;
  const unit = resolveAssetUnit(asset);
  const fuel = asset.fuel ?? "";

  function getSolarVal(periodKey: string, subIdx: number): number | null {
    const raw = assetCells[`${periodKey}__${subIdx}`];
    return raw ?? null;
  }
  function setSolarVal(periodKey: string, subIdx: number, v: number | null) {
    onCellChange(asset.id, `${periodKey}__${subIdx}`, v);
  }

  const filledMonths = annual
    ? (assetCells["annual"] != null ? 1 : 0)
    : months.filter(m => multi
        ? subFields.some((_, si) => getSolarVal(m.key, si) !== null)
        : assetCells[m.key] != null
      ).length;
  const pct = annual
    ? (filledMonths > 0 ? 100 : 0)
    : Math.round((filledMonths / months.length) * 100);

  // Annual entry
  if (annual) {
    const val = assetCells["annual"] ?? null;
    return (
      <div className="space-y-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[220px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Annual total {fuel} ({unit})
              </label>
              <Input
                type="number"
                inputMode="decimal"
                value={val ?? ""}
                placeholder="—"
                onChange={e => {
                  const raw = e.target.value.trim();
                  onCellChange(asset.id, "annual", raw === "" ? null : Number(raw));
                }}
                className="max-w-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                <Paperclip className="h-4 w-4" />
                <span>Upload inspection report</span>
                <input type="file" multiple hidden />
              </label>
            </div>
          </div>
          {asset.fuel && (
            <p className="mt-2 text-xs text-muted-foreground">Annual {fuel} refilled / consumed during the year.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Source documents: 0 / 1 uploaded</span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <StickyNote className="h-3.5 w-3.5" />Notes
            </Button>
            <span className="tabular-nums">{pct}% complete</span>
          </div>
        </div>
      </div>
    );
  }

  // Monthly grid
  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-neutral-soft">
              <th className="sticky left-0 z-10 min-w-[140px] bg-neutral-soft px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Field
              </th>
              {months.map(m => (
                <th key={m.key} className="min-w-[92px] px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {m.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subFields.map((sub, subIdx) => (
              <tr key={sub} className={subIdx > 0 ? "border-t" : undefined}>
                <td className="sticky left-0 z-10 bg-card px-3 py-1.5 text-xs font-medium">
                  {sub} <span className="text-muted-foreground">({unit})</span>
                </td>
                {months.map(m => {
                  const v = multi ? getSolarVal(m.key, subIdx) : (assetCells[m.key] ?? null);
                  const filled = v !== null;
                  return (
                    <td key={m.key} className="p-1 align-top">
                      <div className={cn(
                        "group relative rounded-md p-0.5 transition",
                        filled ? "ghg-cell-filled" : "ghg-cell-empty",
                      )}>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={v ?? ""}
                          placeholder="—"
                          onChange={e => {
                            const raw = e.target.value.trim();
                            const parsed = raw === "" ? null : Number(raw);
                            if (multi) setSolarVal(m.key, subIdx, parsed);
                            else onCellChange(asset.id, m.key, parsed);
                          }}
                          className="w-full bg-transparent px-1.5 py-1 text-right text-sm tabular-nums outline-none placeholder:text-muted-foreground/60"
                        />
                        {subIdx === 0 && (
                          <div className="flex items-center justify-between px-1 pb-0.5">
                            <label className="cursor-pointer text-muted-foreground/60 opacity-0 transition group-hover:opacity-100">
                              <Paperclip className="h-3 w-3" />
                              <input type="file" multiple hidden />
                            </label>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {multi && (
              <tr className="border-t bg-neutral-soft/60">
                <td className="sticky left-0 z-10 bg-neutral-soft/60 px-3 py-1.5 text-xs font-semibold text-navy">
                  Total ({unit})
                </td>
                {months.map(m => {
                  const vals = subFields.map((_, si) => getSolarVal(m.key, si));
                  const total = vals.reduce<number | null>((acc, v) => v == null ? acc : (acc ?? 0) + v, null);
                  return (
                    <td key={m.key} className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-navy">
                      {total == null ? "—" : total.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile stack */}
      <div className="space-y-2 md:hidden">
        {months.map(m => {
          const v = assetCells[m.key] ?? null;
          const filled = v !== null;
          return (
            <div key={m.key} className={cn("rounded-lg border p-2", filled ? "bg-card" : "bg-neutral-soft")}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">{m.short}</span>
                <label className="cursor-pointer text-muted-foreground">
                  <Paperclip className="h-3.5 w-3.5" />
                  <input type="file" multiple hidden />
                </label>
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={v ?? ""}
                placeholder="—"
                onChange={e => {
                  const raw = e.target.value.trim();
                  onCellChange(asset.id, m.key, raw === "" ? null : Number(raw));
                }}
                className="w-full rounded-md border bg-card px-2 py-1 text-right text-sm tabular-nums outline-none"
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>Source documents: 0 / {months.length} months uploaded</span>
          {solar && <span>Rule: Generated = Self-consumed + Exported (±5%)</span>}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <StickyNote className="h-3.5 w-3.5" />Notes
          </Button>
          <span className="tabular-nums">{pct}% complete</span>
        </div>
      </div>
    </div>
  );
}

// ── Scope 2 dual LB/MB grid ───────────────────────────────────────────────────

const S2_ROWS = [
  { suffix: "lb", label: "LB — Total kWh consumed", hint: "Grid consumption (location-based EF applied)" },
  { suffix: "mb", label: "MB — Renewable kWh (EAC/PPA)", hint: "I-REC / PPA / green-tariff units (market-based EF applied)" },
] as const;

function S2DualGrid({ asset, months, cells, onCellChange }: GridProps) {
  const assetCells = cells[asset.id] ?? {};
  const unit = resolveAssetUnit(asset);

  const filledMonths = months.filter(m =>
    S2_ROWS.some(r => assetCells[`${m.key}__${r.suffix}`] != null)
  ).length;
  const pct = Math.round((filledMonths / months.length) * 100);

  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-neutral-soft">
              <th className="sticky left-0 z-10 min-w-[200px] bg-neutral-soft px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Reporting method
              </th>
              {months.map(m => (
                <th key={m.key} className="min-w-[92px] px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {m.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {S2_ROWS.map(({ suffix, label, hint }, rowIdx) => (
              <tr key={suffix} className={rowIdx > 0 ? "border-t" : undefined}>
                <td className="sticky left-0 z-10 bg-card px-3 py-2 min-w-[200px]">
                  <div className="text-xs font-semibold text-navy">{label}</div>
                  <div className="text-[10px] text-muted-foreground">{hint}</div>
                </td>
                {months.map(m => {
                  const cellKey = `${m.key}__${suffix}`;
                  const v = assetCells[cellKey] ?? null;
                  const filled = v !== null;
                  return (
                    <td key={m.key} className="p-1 align-top">
                      <div className={cn(
                        "group relative rounded-md p-0.5 transition",
                        filled ? "ghg-cell-filled" : "ghg-cell-empty",
                      )}>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={v ?? ""}
                          placeholder="—"
                          onChange={e => {
                            const raw = e.target.value.trim();
                            onCellChange(asset.id, cellKey, raw === "" ? null : Number(raw));
                          }}
                          className="w-full bg-transparent px-1.5 py-1 text-right text-sm tabular-nums outline-none placeholder:text-muted-foreground/60"
                        />
                        {rowIdx === 0 && (
                          <div className="flex items-center justify-between px-1 pb-0.5">
                            <label className="cursor-pointer text-muted-foreground/60 opacity-0 transition group-hover:opacity-100">
                              <Paperclip className="h-3 w-3" />
                              <input type="file" multiple hidden />
                            </label>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stack */}
      <div className="space-y-2 md:hidden">
        {months.map(m => (
          <div key={m.key} className="rounded-lg border bg-card p-3 space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">{m.short}</div>
            {S2_ROWS.map(({ suffix, label }) => {
              const cellKey = `${m.key}__${suffix}`;
              const v = assetCells[cellKey] ?? null;
              return (
                <div key={suffix}>
                  <div className="mb-0.5 text-[10px] text-muted-foreground">{label} ({unit})</div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={v ?? ""}
                    placeholder="—"
                    onChange={e => {
                      const raw = e.target.value.trim();
                      onCellChange(asset.id, cellKey, raw === "" ? null : Number(raw));
                    }}
                    className="w-full rounded-md border bg-background px-2 py-1 text-right text-sm tabular-nums outline-none"
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>LB = grid EF × total kWh · MB = instrument EF × renewable kWh + grid EF × remainder</span>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <StickyNote className="h-3.5 w-3.5" />Notes
          </Button>
          <span className="tabular-nums">{pct}% months entered</span>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function DataTrackerPage() {
  const { entity } = useEntity();
  const { fy } = useFiscalYear();
  const ctx = useClientContext();
  const { data: assets = [] } = useDecarbAssets(entity, fy);
  const { data: facilities = [] } = useFacilities(entity);
  const { data: ndcSummary = {} } = useNdcThreadsSummary(fy);

  const startMonth = ctx.client.reporting_period === "CY"
    ? 1
    : (parseInt((ctx.config as any).fiscal_year_start_month || "4") || 4);
  const months = useMemo(() => genMonths(fy, startMonth), [fy, startMonth]);

  const consolidatedCode = ctx.entities.find((e) => e.is_consolidated)?.code;
  const isConsolidatedView = !!consolidatedCode && entity === consolidatedCode;
  const canSubmitRole = getRole() !== "client_leadership";
  const summaryQ = useHomeSummary(entity, fy, !isConsolidatedView);
  const submitCycle = useSubmitCycle();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cycle = summaryQ.data?.cycle;
  const locked = cycle?.status === "locked";
  const submitted = cycle?.status === "submitted";
  const [cells, setCells] = useState<CellMap>({});
  const [activeFacilities, setActiveFacilities] = useState<string[]>([]);
  const [scopeTab, setScopeTab] = useState<"s1" | "s2" | "s3">("s1");
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Initialise cells from asset.series on load. Some clients only ever send one
  // annual total for a source instead of monthly bills — for anything that
  // isn't fugitive (fire extinguishers/refrigerants stay a single annual
  // entry), spread that total evenly across the period's months so every
  // month has a starting figure to review/edit instead of 12 empty cells.
  useEffect(() => {
    if (!assets.length) return;
    const init: CellMap = {};
    for (const a of assets) {
      if (!a.series) continue;
      init[a.id] = {};
      for (const [k, v] of Object.entries(a.series)) {
        if (v !== null && v !== undefined) init[a.id][k] = v;
      }
      const annualVal = a.series["annual"];
      const hasMonthly = months.some(m => a.series![m.key] != null || a.series![`${m.key}__lb`] != null);
      if (annualVal != null && !isAnnual(a) && !hasMonthly && !isSolar(a) && months.length > 0) {
        const perMonth = Number(annualVal) / months.length;
        for (const m of months) {
          if (isS2Electricity(a)) init[a.id][`${m.key}__lb`] = perMonth;
          else init[a.id][m.key] = perMonth;
        }
      }
      // When no renewable-instrument data was ever recorded for a source, MB mirrors
      // LB exactly — matching a ledger's explicit "Market-Based = Location-Based
      // (no qualifying instruments)" note — instead of showing a blank gap.
      if (isS2Electricity(a) && months.length > 0) {
        const hasAnyMb = months.some(m => a.series![`${m.key}__mb`] != null);
        if (!hasAnyMb) {
          for (const m of months) {
            const lbVal = init[a.id][`${m.key}__lb`];
            if (lbVal != null) init[a.id][`${m.key}__mb`] = lbVal;
          }
        }
      }
    }
    setCells(init);
    // open first facility by default
    const firstFacility = assets[0]?.facility;
    if (firstFacility) setActiveFacilities([firstFacility]);
  }, [assets, months]);

  const handleCellChange = useCallback((assetId: string, periodKey: string, value: number | null) => {
    setCells(prev => ({
      ...prev,
      [assetId]: { ...(prev[assetId] ?? {}), [periodKey]: value },
    }));
    const key = `${assetId}__${periodKey}`;
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(() => {
      authFetch("data-tracker/draft.php", {
        method: "POST",
        body: JSON.stringify({ entity, fy, cells: [{ assetId, period: periodKey, value }] }),
      }).catch(() => {});
    }, 800);
  }, [entity, fy]);

  // Save/Submit buttons previously had no handler at all — every keystroke was
  // already auto-saving via handleCellChange's debounce, but clicking Save had
  // no effect and Submit only showed a fake "Submitted for review" toast with
  // no backend call. This flushes every current cell value straight to the DB
  // immediately (no separate review/approval step — the site has none), so
  // the button actually does something and doesn't leave pending debounced
  // writes unsent if the user navigates away right after clicking.
  const [saving, setSaving] = useState(false);
  const saveAll = useCallback(async () => {
    setSaving(true);
    Object.values(debounceRef.current).forEach(clearTimeout);
    debounceRef.current = {};
    const cellsList: { assetId: string; period: string; value: number | null }[] = [];
    for (const [assetId, periods] of Object.entries(cells)) {
      for (const [period, value] of Object.entries(periods)) {
        cellsList.push({ assetId, period, value });
      }
    }
    try {
      await authFetch("data-tracker/draft.php", {
        method: "POST",
        body: JSON.stringify({ entity, fy, cells: cellsList }),
      });
      toast.success("Saved");
      setSaving(false);
      return true;
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Save failed — check connection");
      setSaving(false);
      return false;
    }
  }, [cells, entity, fy]);

  // Group assets by facility name (filter null/empty — can happen if DB facility column is null)
  const facilityNames = [...new Set(assets.map(a => a.facility).filter((f): f is string => !!f))];
  const facilityMap = new Map<string, FacilityRow>(
    facilities.map(f => [f.name, f])
  );

  // Overall progress — S2 electricity counts 2 rows (LB + MB) per month
  function assetRowCount(a: DecarbAsset): number {
    if (isAnnualNow(a, months)) return 0;
    if (isS2Electricity(a)) return S2_ROWS.length;
    return getSubFields(a).length;
  }
  const totalMonthlySlots = assets
    .filter(a => !isAnnualNow(a, months))
    .reduce((sum, a) => sum + months.length * assetRowCount(a), 0);
  const totalAnnualSlots = assets.filter(a => isAnnualNow(a, months)).length;
  const totalSlots = totalMonthlySlots + totalAnnualSlots;
  const filledSlots = assets.reduce((sum, a) => {
    const ac = cells[a.id] ?? {};
    if (isAnnualNow(a, months)) return sum + (ac["annual"] != null ? 1 : 0);
    if (isS2Electricity(a)) {
      return sum + months.reduce((ms, m) =>
        ms + S2_ROWS.filter(r => ac[`${m.key}__${r.suffix}`] != null).length, 0);
    }
    return sum + months.filter(m => ac[m.key] != null).length * getSubFields(a).length;
  }, 0);
  const overallPct = totalSlots > 0 ? filledSlots / totalSlots : 0;
  const canSubmit = assets.length > 0;
  const complete = overallPct >= 0.9999;
  const summary = useMemo(() => trackerSummary(assets, months), [assets, months]);

  const onSubmitClick = async () => {
    const ok = await saveAll();
    if (ok) setConfirmOpen(true);
  };
  const confirmSubmit = () => {
    submitCycle.mutate({ entity, fy }, {
      onSuccess: () => { toast.success("Submitted to Deepwoods"); setConfirmOpen(false); },
      onError: (e) => toast.error(e.message || "Could not submit"),
    });
  };

  // ── XLSX import ref ────────────────────────────────────────────────────────
  const importInputRef = useRef<HTMLInputElement>(null);

  // ── XLSX template download ─────────────────────────────────────────────────
  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const clientName = (ctx.client as any)?.name ?? "Client";
    const headerInfo = [`Client: ${clientName}`, `Entity: ${entity}`, `Fiscal Year: ${fy}`, `Template — fill values and re-import`];
    const colHeader = ["Asset ID", "Asset Name", "Facility", "Scope", "Type", "Unit", ...months.map(m => m.short), "Annual"];
    const rows: unknown[][] = [headerInfo, [], colHeader];
    for (const asset of assets) {
      const isAnn = isAnnualNow(asset, months);
      if (isS2Electricity(asset)) {
        const u = resolveAssetUnit(asset);
        rows.push([asset.id, `${asset.name} — LB`, asset.facility ?? "", asset.scope ?? "", asset.sub_type ?? "", u, ...months.map(() => ""), ""]);
        rows.push([asset.id, `${asset.name} — MB`, asset.facility ?? "", asset.scope ?? "", asset.sub_type ?? "", u, ...months.map(() => ""), ""]);
      } else if (isAnn) {
        rows.push([asset.id, asset.name, asset.facility ?? "", asset.scope ?? "", asset.sub_type ?? "", resolveAssetUnit(asset), ...months.map(() => ""), ""]);
      } else {
        rows.push([asset.id, asset.name, asset.facility ?? "", asset.scope ?? "", asset.sub_type ?? "", resolveAssetUnit(asset), ...months.map(() => ""), ""]);
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 26 }, { wch: 32 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, ...months.map(() => ({ wch: 10 })), { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, "GHG Data");
    XLSX.writeFile(wb, `GHG_Template_${entity}_${fy}.xlsx`);
  }

  // ── XLSX export (current filled data) ─────────────────────────────────────
  function exportFilledXLSX() {
    const wb = XLSX.utils.book_new();
    const clientName = (ctx.client as any)?.name ?? "Client";
    const headerInfo = [`Client: ${clientName}`, `Entity: ${entity}`, `Fiscal Year: ${fy}`, `Exported: ${new Date().toLocaleDateString()}`];
    const colHeader = ["Asset ID", "Asset Name", "Facility", "Scope", "Type", "Unit", ...months.map(m => m.short), "Annual"];
    const rows: unknown[][] = [headerInfo, [], colHeader];
    for (const asset of assets) {
      const ac = cells[asset.id] ?? {};
      const isAnn = isAnnualNow(asset, months);
      if (isS2Electricity(asset)) {
        const u = resolveAssetUnit(asset);
        const lbRow: (string | number)[] = [asset.id, `${asset.name} — LB`, asset.facility ?? "", asset.scope ?? "", asset.sub_type ?? "", u];
        const mbRow: (string | number)[] = [asset.id, `${asset.name} — MB`, asset.facility ?? "", asset.scope ?? "", asset.sub_type ?? "", u];
        for (const m of months) {
          lbRow.push(ac[`${m.key}__lb`] ?? "");
          mbRow.push(ac[`${m.key}__mb`] ?? "");
        }
        lbRow.push(""); mbRow.push("");
        rows.push(lbRow, mbRow);
      } else if (isAnn) {
        const row = [asset.id, asset.name, asset.facility ?? "", asset.scope ?? "", asset.sub_type ?? "", resolveAssetUnit(asset), ...months.map(() => ""), ac["annual"] ?? ""];
        rows.push(row);
      } else {
        const monthVals = months.map(m => ac[m.key] ?? "");
        const annualSum = months.reduce((s, m) => s + (Number(ac[m.key]) || 0), 0);
        rows.push([asset.id, asset.name, asset.facility ?? "", asset.scope ?? "", asset.sub_type ?? "", resolveAssetUnit(asset), ...monthVals, annualSum > 0 ? Math.round(annualSum * 100) / 100 : ""]);
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 26 }, { wch: 32 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 8 }, ...months.map(() => ({ wch: 10 })), { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "GHG Data");
    const clientName2 = (ctx.client as any)?.name ?? "GHG";
    XLSX.writeFile(wb, `${clientName2}_${entity}_${fy}.xlsx`);
  }

  // ── XLSX import handler ────────────────────────────────────────────────────
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

      // Find header row (contains "Asset ID")
      let headerIdx = -1;
      for (let i = 0; i < Math.min(raw.length, 10); i++) {
        const r = raw[i] as unknown[];
        if (r?.some(c => String(c ?? "").toLowerCase().includes("asset id"))) {
          headerIdx = i; break;
        }
      }
      if (headerIdx === -1) { toast.error("Invalid file: cannot find header row"); return; }

      const headers = (raw[headerIdx] as unknown[]).map(c => String(c ?? "").trim());
      // Map month short labels → column index; also find Annual column
      const monthColIdx: Record<string, number> = {};
      for (let c = 0; c < headers.length; c++) {
        const h = headers[c].toUpperCase();
        const m = months.find(mm => mm.short.toUpperCase() === h);
        if (m) monthColIdx[m.key] = c;
        if (h === "ANNUAL") monthColIdx["annual"] = c;
      }

      const newCellsMap: CellMap = {};
      const batchCells: { assetId: string; period: string; value: number | null }[] = [];

      for (let r = headerIdx + 1; r < raw.length; r++) {
        const row = raw[r] as unknown[];
        if (!row?.length) continue;
        const rawId = String(row[0] ?? "").trim();
        if (!rawId) continue;
        const nameCol = String(row[1] ?? "");
        const isMB = nameCol.includes("— MB") || nameCol.endsWith("MB");

        const asset = assets.find(a => a.id === rawId);
        if (!asset) continue;

        if (!newCellsMap[asset.id]) newCellsMap[asset.id] = {};

        for (const [periodKey, colIdx] of Object.entries(monthColIdx)) {
          const raw2 = row[colIdx];
          if (raw2 === null || raw2 === undefined || raw2 === "") continue;
          const val = Number(raw2);
          if (isNaN(val)) continue;

          let storeKey = periodKey;
          if (isS2Electricity(asset) && periodKey !== "annual") {
            storeKey = isMB ? `${periodKey}__mb` : `${periodKey}__lb`;
          }
          newCellsMap[asset.id][storeKey] = val;
          batchCells.push({ assetId: asset.id, period: storeKey, value: val });
        }
      }

      if (!batchCells.length) { toast.error("No matching data found in file"); return; }

      setCells(prev => {
        const next = { ...prev };
        for (const [assetId, periods] of Object.entries(newCellsMap)) {
          next[assetId] = { ...(prev[assetId] ?? {}), ...periods };
        }
        return next;
      });

      await authFetch("data-tracker/draft.php", {
        method: "POST",
        body: JSON.stringify({ entity, fy, cells: batchCells }),
      });
      toast.success(`Imported ${batchCells.length} values from ${file.name}`);
    } catch {
      toast.error("Import failed — check file format");
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky sub-header */}
      <div className="sticky top-[52px] z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-navy">GHG Data Collection</h1>
            <p className="text-xs text-muted-foreground">
              {fy} · {filledSlots} of {totalSlots} fields complete
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full border-2 border-ghg-green flex items-center justify-center text-xs font-bold text-ghg-green tabular-nums">
                {Math.round(overallPct * 100)}%
              </div>
            </div>
            {/* Hidden file input for XLSX import */}
            <input ref={importInputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImportFile} />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
              <Download className="h-3.5 w-3.5" /> Template
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => importInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Import XLSX
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportFilledXLSX}>
              <Download className="h-3.5 w-3.5" /> Export XLSX
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={saving} onClick={saveAll}>
              <Save className="h-3.5 w-3.5" /> Save draft
            </Button>
            <Button
              size="sm"
              disabled={!canSubmit || saving || locked || isConsolidatedView || !canSubmitRole}
              onClick={onSubmitClick}
              title={isConsolidatedView ? "Select a single entity to submit" : locked ? "This period is locked" : undefined}
              className={cn(
                "gap-1.5 transition",
                canSubmit && !complete && "bg-amber-warn text-white hover:bg-amber-warn/90",
                complete && "bg-ghg-green text-ghg-green-foreground hover:bg-ghg-green/90",
              )}
            >
              <Send className="h-3.5 w-3.5" />
              {locked ? "Locked" : submitted ? "Resubmit" : "Submit"}
            </Button>
          </div>
        </div>
        {/* Scope tabs */}
        <div className="mx-auto max-w-[1440px] px-4 pb-2">
          <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
            {(["s1", "s2", "s3"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setScopeTab(tab)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                  scopeTab === tab
                    ? "bg-card text-navy shadow-sm"
                    : "text-muted-foreground hover:text-navy",
                )}
              >
                {tab === "s1" ? "Scope 1 — Direct" : tab === "s2" ? "Scope 2 — Purchased Energy" : "Scope 3 — Value Chain"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit {fy} data to Deepwoods?</DialogTitle>
            <DialogDescription>
              Your consultant is told that this period is ready to review. You can keep editing afterwards, but resubmit so they know.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-2xl font-semibold tabular-nums text-navy">{Math.round(summary.pct * 100)}%</p>
              <p className="text-[11px] text-muted-foreground">entries filled</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-2xl font-semibold tabular-nums text-navy">{summary.complete}/{summary.sources}</p>
              <p className="text-[11px] text-muted-foreground">sources complete</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-2xl font-semibold tabular-nums text-navy">{cycle?.data_due_date ? new Date(cycle.data_due_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</p>
              <p className="text-[11px] text-muted-foreground">data due</p>
            </div>
          </div>
          {summary.pct < 0.9999 && (
            <p className="text-xs text-muted-foreground">
              Some entries are still empty. Gaps will be noted in the consultant's review — submitting incomplete data is fine.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Keep editing</Button>
            <Button onClick={confirmSubmit} disabled={submitCycle.isPending}>
              {submitCycle.isPending ? "Submitting…" : "Submit to Deepwoods"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className={cn(
        "mx-auto max-w-[1440px] space-y-4 px-4 py-6",
        locked && "[&_input[type=number]]:pointer-events-none [&_input[type=number]]:bg-muted [&_input[type=file]]:hidden",
      )}>
        {locked && (
          <div className="flex items-start gap-3 rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm" role="status">
            <Info className="mt-0.5 h-4 w-4 text-slate-600" />
            <div>
              <p className="font-semibold text-navy">This reporting period is locked.</p>
              <p className="mt-1 text-muted-foreground">Deepwoods has locked {fy} for review. Ask your consultant if something needs to change — you can still ask a question under any source.</p>
            </div>
          </div>
        )}
        {submitted && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-ghg-green-soft p-4 text-sm" role="status">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="font-semibold text-navy">Submitted{cycle?.submitted_at ? ` on ${new Date(cycle.submitted_at.replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}.</p>
              <p className="mt-1 text-muted-foreground">If you change anything now, press Resubmit so your consultant knows.</p>
            </div>
          </div>
        )}
        {!submitted && !locked && cycle?.data_due_date && (
          <div className={cn("flex items-center gap-3 rounded-lg border p-3 text-sm", cycle.overdue ? "border-red-200 bg-red-50 text-red-800" : "border-border bg-card text-muted-foreground")} role="status">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              Data due {new Date(cycle.data_due_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              {cycle.days_to_due != null ? (cycle.days_to_due < 0 ? ` — ${Math.abs(cycle.days_to_due)} days overdue` : ` — ${cycle.days_to_due} days left`) : ""}.
            </span>
          </div>
        )}
        {isConsolidatedView && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground" role="status">
            <Info className="h-4 w-4 shrink-0" />
            <span>You are viewing the combined view. Pick a single entity in the switcher above to submit its data.</span>
          </div>
        )}
        {overallPct === 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-ghg-green-soft p-4 text-sm">
            <Info className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="font-semibold text-navy">Welcome to your GHG data collection.</p>
              <p className="mt-1 text-muted-foreground">
                Fill in what you have — you can submit at any time. Use "Import XLSX" to bulk-upload from a spreadsheet. Everything auto-saves.
              </p>
            </div>
          </div>
        )}

        {overallPct > 0 && !complete && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-warn/40 bg-amber-soft/50 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-warn" />
            <div>
              <p className="font-semibold text-navy">{Math.round(overallPct * 100)}% complete — you can submit now or continue filling in.</p>
              <p className="mt-1 text-muted-foreground">Gaps will be noted in the consultant's review. Submit any time.</p>
            </div>
          </div>
        )}

        {complete && (
          <div className="flex items-start gap-3 rounded-lg border border-ghg-green/40 bg-ghg-green-soft p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-ghg-green" />
            <div>
              <p className="font-semibold text-navy">All data captured for {fy}. Ready to submit.</p>
              <p className="mt-1 text-muted-foreground">Your consultant will receive the full submission and run the emissions calculations.</p>
            </div>
          </div>
        )}

        {!facilityNames.length && (
          <div className="rounded-xl border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">No emission sources configured yet.</p>
            <a
              href="/inventory-boundary"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Set up Inventory Boundary →
            </a>
          </div>
        )}

        <div className={scopeTab !== "s3" ? "hidden" : ""}>
          <GhgStoreProvider storageKey={`${ctx.client.slug}-ghg-v3`}>
            <Scope3Cards />
          </GhgStoreProvider>
        </div>

        <Accordion
          type="multiple"
          value={activeFacilities}
          onValueChange={setActiveFacilities}
          className={cn("space-y-3", scopeTab === "s3" ? "hidden" : "")}
        >
          {facilityNames
            .filter(fn => assets.some(a => a.facility === fn && a.scope === (scopeTab === "s1" ? "Scope 1" : "Scope 2")))
            .map(facilityName => {
            const facilityRow = facilityMap.get(facilityName);
            const facilityAssets = assets.filter(a => a.facility === facilityName && a.scope === (scopeTab === "s1" ? "Scope 1" : "Scope 2"));
            const fSlots = facilityAssets.reduce((sum, a) => {
              if (isAnnualNow(a, months)) return sum + 1;
              return sum + months.length * assetRowCount(a);
            }, 0);
            const fFilled = facilityAssets.reduce((sum, a) => {
              const ac = cells[a.id] ?? {};
              if (isAnnualNow(a, months)) return sum + (ac["annual"] != null ? 1 : 0);
              if (isS2Electricity(a)) {
                return sum + months.reduce((ms, m) =>
                  ms + S2_ROWS.filter(r => ac[`${m.key}__${r.suffix}`] != null).length, 0);
              }
              return sum + months.filter(m => ac[m.key] != null).length * getSubFields(a).length;
            }, 0);
            const fPct = fSlots > 0 ? Math.round((fFilled / fSlots) * 100) : 0;

            // Group by scope sub-category
            const s1Assets = facilityAssets.filter(a => a.scope === "Scope 1");
            const s2Assets = facilityAssets.filter(a => a.scope === "Scope 2");

            return (
              <AccordionItem key={facilityName} value={facilityName} className="rounded-lg border bg-card shadow-sm">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex w-full items-center gap-3 pr-2">
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md text-xs font-mono font-semibold shrink-0",
                      fPct >= 100 ? "bg-ghg-green text-ghg-green-foreground"
                        : fPct >= 50 ? "bg-amber-warn text-white"
                        : fPct > 0 ? "bg-critical text-white"
                        : "bg-neutral-soft text-muted-foreground",
                    )}>
                      {facilityName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-base font-semibold text-navy">{facilityName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {facilityRow?.grid_utility ?? ""}{facilityRow?.grid_utility ? " · " : ""}{facilityAssets.length} equipment sources
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-3 shrink-0">
                      <Badge variant="outline" className="text-[10px]">Active</Badge>
                      <span className="text-sm font-semibold tabular-nums text-navy">{fPct}%</span>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="border-t bg-neutral-soft/30 px-4 py-4">
                  <div className="space-y-6">
                    {/* Scope 1 group */}
                    {s1Assets.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 mb-3 rounded-lg bg-rose-50 border border-rose-200 px-4 py-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <span className="font-semibold text-sm text-rose-800">Scope 1 — Direct Emissions</span>
                          <span className="ml-auto text-xs text-rose-600">{s1Assets.length} source{s1Assets.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="space-y-4">
                          {s1Assets.map(asset => {
                            const { label, isS1 } = getScopeInfo(asset);
                            const ndcEntry = ndcSummary[asset.id];
                            return (
                              <section key={asset.id} className="rounded-lg border bg-card p-4 shadow-sm">
                                <header className="mb-3 flex flex-wrap items-start gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold text-navy">{asset.name}</h3>
                                    <span className="rounded-md bg-neutral-soft px-2 py-0.5 font-mono text-[11px]">{asset.id}</span>
                                    <Badge variant="outline" className={cn("text-[10px]", isS1 ? "border-primary text-primary" : "border-amber-warn text-amber-warn")}>
                                      {label}
                                    </Badge>
                                    {isAnnualNow(asset, months) && (
                                      <Badge className="bg-muted text-muted-foreground text-[10px]">Annual entry</Badge>
                                    )}
                                    {ndcEntry && (
                                      <ThreadBadge count={ndcEntry.count} hasOpen={ndcEntry.has_open} />
                                    )}
                                  </div>
                                  {asset.fuel && (
                                    <p className="w-full text-xs text-muted-foreground mt-0.5">Fuel: {asset.fuel}</p>
                                  )}
                                </header>
                                <EquipmentGrid
                                  asset={asset}
                                  months={months}
                                  cells={cells}
                                  onCellChange={handleCellChange}
                                />
                                <ThreadPanel
                                  sourceType="scope12"
                                  sourceId={asset.id}
                                  fy={fy}
                                  summaryCount={ndcEntry?.count}
                                  summaryHasOpen={ndcEntry?.has_open}
                                />
                              </section>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Scope 2 group */}
                    {s2Assets.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 mb-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <span className="font-semibold text-sm text-blue-800">Scope 2 — Purchased Energy</span>
                          <div className="ml-auto flex items-center gap-2">
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">LB</span>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">MB</span>
                            <span className="text-xs text-blue-600">{s2Assets.length} source{s2Assets.length !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {s2Assets.map(asset => {
                            const { label, isS1 } = getScopeInfo(asset);
                            const dual = isS2Electricity(asset);
                            const ndcEntry = ndcSummary[asset.id];
                            return (
                              <section key={asset.id} className="rounded-lg border bg-card p-4 shadow-sm">
                                <header className="mb-3 flex flex-wrap items-start gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold text-navy">{asset.name}</h3>
                                    <span className="rounded-md bg-neutral-soft px-2 py-0.5 font-mono text-[11px]">{asset.id}</span>
                                    {dual ? (
                                      <>
                                        <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-700">LB</Badge>
                                        <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-700">MB</Badge>
                                      </>
                                    ) : (
                                      <Badge variant="outline" className={cn("text-[10px]", isS1 ? "border-primary text-primary" : "border-amber-warn text-amber-warn")}>
                                        {label}
                                      </Badge>
                                    )}
                                    {isAnnualNow(asset, months) && (
                                      <Badge className="bg-muted text-muted-foreground text-[10px]">Annual entry</Badge>
                                    )}
                                    {ndcEntry && (
                                      <ThreadBadge count={ndcEntry.count} hasOpen={ndcEntry.has_open} />
                                    )}
                                  </div>
                                  {asset.fuel && (
                                    <p className="w-full text-xs text-muted-foreground mt-0.5">Fuel: {asset.fuel}</p>
                                  )}
                                </header>
                                {dual ? (
                                  <S2DualGrid
                                    asset={asset}
                                    months={months}
                                    cells={cells}
                                    onCellChange={handleCellChange}
                                  />
                                ) : (
                                  <EquipmentGrid
                                    asset={asset}
                                    months={months}
                                    cells={cells}
                                    onCellChange={handleCellChange}
                                  />
                                )}
                                <ThreadPanel
                                  sourceType="scope12"
                                  sourceId={asset.id}
                                  fy={fy}
                                  summaryCount={ndcEntry?.count}
                                  summaryHasOpen={ndcEntry?.has_open}
                                />
                              </section>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </main>

      {/* Bottom sticky progress bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 text-xs">
          <span className="tabular-nums text-muted-foreground">
            {filledSlots.toLocaleString()} of {totalSlots.toLocaleString()} fields complete
          </span>
          <div className="mx-3 h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-soft">
            <div
              className={cn(
                "h-full transition-all",
                complete ? "bg-ghg-green"
                  : overallPct > 0 ? "bg-amber-warn"
                  : "bg-muted-foreground/40",
              )}
              style={{ width: `${Math.max(2, overallPct * 100)}%` }}
            />
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={saving} onClick={saveAll}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}
