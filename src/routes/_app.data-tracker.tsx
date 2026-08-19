import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/portal";
import { useClientContext } from "@/lib/client-context";
import { useDecarbAssets, useFacilities } from "@/lib/api";
import type { DecarbAsset, FacilityRow } from "@/lib/api";
import { useEntity } from "@/lib/entity";
import { useFiscalYear } from "@/lib/entity";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronLeft, ChevronRight, Download, Paperclip, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/data-tracker")({ component: DataTrackerPage });

// ── Helpers ───────────────────────────────────────────────────────────────────

function fyMonths(fy: string, period: "FY" | "CY"): string[] {
  const yy = parseInt(fy.replace(/[^0-9]/g, ""));
  if (period === "CY") {
    const year = yy < 100 ? 2000 + yy : yy;
    return ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]
      .map(m => `${m}-${String(year).slice(-2)}`);
  }
  const endYear = yy < 100 ? 2000 + yy : yy;
  const sy = endYear - 1;
  return ["APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC","JAN","FEB","MAR"]
    .map((m, i) => `${m}-${String(i < 9 ? sy : endYear).slice(-2)}`);
}

type ScopeTag = { label: string; bg: string; fg: string };

function getScopeTag(a: DecarbAsset): ScopeTag {
  const st = (a.sub_type ?? "").toLowerCase();
  const sc = a.scope ?? "";
  if (sc === "Scope 1") {
    if (st === "fugitive" || st.includes("refrigerant") || st.includes("fire ext") || st.includes("welding"))
      return { label: "S1 — Fugitive", bg: "#FEF9C3", fg: "#854D0E" };
    if (st.includes("process") || st.includes("calcination"))
      return { label: "S1 — Process", bg: "#FFE4E6", fg: "#9F1239" };
    return { label: "S1 — Stationary", bg: "#FEF3C7", fg: "#92400E" };
  }
  if (sc === "Scope 2") {
    if (st.includes("solar") || st.includes("rooftop") || st.includes("wind"))
      return { label: "S2 — RE", bg: "#EDE9FE", fg: "#5B21B6" };
    if (st.includes("open access") || st.includes("captive"))
      return { label: "S2 — MB EF=0", bg: "#D1FAE5", fg: "#065F46" };
    return { label: "S2 — LB/MB", bg: "#DBEAFE", fg: "#1E40AF" };
  }
  if (sc === "Scope 3") {
    const cat = a.sub_type ? `S3 — ${a.sub_type}` : "S3";
    return { label: cat, bg: "#F1F5F9", fg: "#334155" };
  }
  return { label: sc || "—", bg: "#F1F5F9", fg: "#334155" };
}

function isAnnualOnly(a: DecarbAsset): boolean {
  const st = (a.sub_type ?? "").toLowerCase();
  const nm = (a.name ?? "").toLowerCase();
  return (
    st === "fugitive" ||
    nm.includes("fire extinguisher") ||
    nm.includes("refrigerant") ||
    nm.includes("welding gas") ||
    nm.includes("dry chemical")
  );
}

type TrackerDraft = Record<string, Record<string, string>>;
type CellFiles = Record<string, Record<string, File[]>>;

// ── MonthCell ─────────────────────────────────────────────────────────────────

interface MonthCellProps {
  value: string;
  onChange: (v: string) => void;
  fileCount: number;
  onFileAdd: (f: File) => void;
  disabled?: boolean;
  annualPlaceholder?: boolean;
}

function MonthCell({ value, onChange, fileCount, onFileAdd, disabled, annualPlaceholder }: MonthCellProps) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.select(), 0);
  }, [editing]);

  if (disabled) {
    return (
      <div className="flex h-9 w-full items-center justify-center">
        <span className="text-[11px] text-muted-foreground/50">—</span>
      </div>
    );
  }

  if (annualPlaceholder) {
    const num = parseFloat(value);
    return (
      <div className="flex h-9 w-full items-center justify-center">
        <span className={`font-mono text-xs tabular-nums ${!isNaN(num) && num > 0 ? "font-semibold text-[var(--navy)]" : "text-muted-foreground/60"}`}>
          {!isNaN(num) && num > 0 ? num.toLocaleString() : "—"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="relative h-9 w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          className="absolute inset-0 w-full border-2 border-[var(--primary)] bg-white px-2 text-center font-mono text-sm focus:outline-none"
          style={{ zIndex: 20 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`absolute inset-0 flex w-full items-center justify-center font-mono text-xs tabular-nums transition-colors ${
            value
              ? "bg-emerald-50 font-semibold text-emerald-900 hover:bg-emerald-100"
              : "text-muted-foreground hover:bg-[var(--muted)]"
          }`}
        >
          {value || "—"}
        </button>
      )}

      {/* Hover: paperclip button */}
      {hovered && !editing && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
          className="absolute bottom-0.5 right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded bg-[#1A3547] text-white opacity-80 hover:opacity-100 transition-opacity"
          title="Attach supporting document"
          style={{ zIndex: 25 }}
        >
          <Paperclip className="h-2.5 w-2.5" />
        </button>
      )}

      {/* File badge */}
      {fileCount > 0 && (
        <div
          className="pointer-events-none absolute left-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-bold text-white"
          style={{ zIndex: 15 }}
        >
          {fileCount}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.xlsx,.csv,.jpg,.jpeg,.png"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) { onFileAdd(f); toast.success(`Attached: ${f.name}`); }
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ── EquipmentRow ───────────────────────────────────────────────────────────────

interface EquipmentRowProps {
  asset: DecarbAsset;
  months: string[];
  draftRow: Record<string, string>;
  onCellChange: (month: string, value: string) => void;
  rowFiles: Record<string, File[]>;
  onFileAdd: (month: string, file: File) => void;
}

function EquipmentRow({ asset, months, draftRow, onCellChange, rowFiles, onFileAdd }: EquipmentRowProps) {
  const annual = isAnnualOnly(asset);
  const tag = getScopeTag(asset);

  const filledMonths = annual ? (draftRow["ANNUAL"] ? 1 : 0) : months.filter(m => draftRow[m]).length;
  const totalSlots = annual ? 1 : months.length;
  const pct = totalSlots > 0 ? Math.round((filledMonths / totalSlots) * 100) : 0;

  const autoSum = useMemo(() => {
    if (annual) return null;
    const sum = months.reduce((acc, m) => {
      const v = parseFloat(draftRow[m] ?? "");
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    return sum > 0 ? sum : null;
  }, [annual, months, draftRow]);

  return (
    <tr className="border-b border-[var(--border)] transition-colors hover:bg-slate-50/50">
      {/* Equipment name */}
      <td className="sticky left-0 z-10 min-w-[200px] max-w-[220px] border-r border-[var(--border)] bg-white px-3 py-2 align-middle">
        <div className="truncate text-[13px] font-semibold leading-snug text-[var(--navy)]">{asset.name}</div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{asset.id}</div>
        <span
          className="mt-1 inline-block rounded px-1.5 py-[1px] text-[10px] font-bold"
          style={{ background: tag.bg, color: tag.fg }}
        >
          {tag.label}
        </span>
      </td>
      {/* Unit */}
      <td className="sticky left-[200px] z-10 w-12 border-r border-[var(--border)] bg-white px-1 py-2 text-center align-middle">
        <span className="text-[11px] text-muted-foreground">{asset.unit || "—"}</span>
      </td>
      {/* Monthly cells */}
      {months.map(m => (
        <td key={m} className="w-[68px] border-r border-[var(--border)] p-0 align-middle">
          <MonthCell
            value={draftRow[m] ?? ""}
            onChange={v => onCellChange(m, v)}
            fileCount={rowFiles[m]?.length ?? 0}
            onFileAdd={f => onFileAdd(m, f)}
            disabled={annual}
          />
        </td>
      ))}
      {/* Annual column */}
      <td className="w-[72px] border-r border-[var(--border)] p-0 align-middle">
        {annual ? (
          <MonthCell
            value={draftRow["ANNUAL"] ?? ""}
            onChange={v => onCellChange("ANNUAL", v)}
            fileCount={rowFiles["ANNUAL"]?.length ?? 0}
            onFileAdd={f => onFileAdd("ANNUAL", f)}
          />
        ) : (
          <MonthCell
            value={autoSum !== null ? String(autoSum) : ""}
            onChange={() => {}}
            fileCount={0}
            onFileAdd={() => {}}
            annualPlaceholder
          />
        )}
      </td>
      {/* Complete % */}
      <td className="w-16 px-2 text-center align-middle">
        <span
          className={`text-xs font-bold tabular-nums ${
            pct === 100 ? "text-emerald-600" : pct > 0 ? "text-amber-600" : "text-muted-foreground"
          }`}
        >
          {pct}%
        </span>
      </td>
    </tr>
  );
}

// ── DataTrackerPage ────────────────────────────────────────────────────────────

function DataTrackerPage() {
  const ctx = useClientContext();
  const { entity } = useEntity();
  const { fy } = useFiscalYear();

  const { data: assets = [], isPending: assetsLoading } = useDecarbAssets(entity);
  const { data: facilities = [] } = useFacilities(entity);

  const [scopeTab, setScopeTab] = useState<"s12" | "s3">("s12");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeFacility, setActiveFacility] = useState<string | null>(null);
  const [draft, setDraft] = useState<TrackerDraft>({});
  const [cellFiles, setCellFiles] = useState<CellFiles>({});
  const [saving, setSaving] = useState(false);

  const period = ctx.client.reporting_period ?? "FY";
  const months = useMemo(() => fyMonths(fy, period), [fy, period]);
  const draftKey = `tracker_${ctx.client.slug}_${entity}_${fy}`;

  // Load draft from localStorage on mount / fy change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) setDraft(JSON.parse(saved) as TrackerDraft);
      else setDraft({});
    } catch {
      setDraft({});
    }
  }, [draftKey]);

  const setCellValue = useCallback((assetId: string, month: string, value: string) => {
    setDraft(prev => ({
      ...prev,
      [assetId]: { ...(prev[assetId] ?? {}), [month]: value },
    }));
  }, []);

  const addCellFile = useCallback((assetId: string, month: string, file: File) => {
    setCellFiles(prev => ({
      ...prev,
      [assetId]: {
        ...(prev[assetId] ?? {}),
        [month]: [...(prev[assetId]?.[month] ?? []), file],
      },
    }));
  }, []);

  const saveDraft = useCallback(() => {
    setSaving(true);
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
      toast.success("Draft saved locally");
    } catch {
      toast.error("Could not save draft");
    }
    setTimeout(() => setSaving(false), 500);
  }, [draft, draftKey]);

  // Active (non-decommissioned) assets filtered by scope tab
  const activeAssets = useMemo(
    () => assets.filter(a => a.status !== "Decommissioned"),
    [assets],
  );

  const filteredAssets = useMemo(
    () =>
      scopeTab === "s12"
        ? activeAssets.filter(a => a.scope === "Scope 1" || a.scope === "Scope 2")
        : activeAssets.filter(a => a.scope === "Scope 3"),
    [activeAssets, scopeTab],
  );

  // Group by facility, preserving insertion order
  const byFacility = useMemo(() => {
    const map = new Map<string, DecarbAsset[]>();
    for (const a of filteredAssets) {
      if (!map.has(a.facility)) map.set(a.facility, []);
      map.get(a.facility)!.push(a);
    }
    return map;
  }, [filteredAssets]);

  // Per-facility completion %
  const facilityPct = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [fac, fAssets] of byFacility) {
      let total = 0, filled = 0;
      for (const a of fAssets) {
        const keys = isAnnualOnly(a) ? ["ANNUAL"] : months;
        total += keys.length;
        filled += keys.filter(k => draft[a.id]?.[k]).length;
      }
      out[fac] = total > 0 ? Math.round((filled / total) * 100) : 0;
    }
    return out;
  }, [byFacility, draft, months]);

  // Data gaps list
  const dataGaps = useMemo(() => {
    const gaps: { assetId: string; assetName: string; month: string }[] = [];
    for (const a of filteredAssets) {
      const keys = isAnnualOnly(a) ? ["ANNUAL"] : months;
      for (const k of keys) {
        if (!draft[a.id]?.[k]) gaps.push({ assetId: a.id, assetName: a.name, month: k });
      }
    }
    return gaps;
  }, [filteredAssets, draft, months]);

  // Overall completion
  const { totalFields, filledFields } = useMemo(() => {
    let total = 0, filled = 0;
    for (const a of filteredAssets) {
      const keys = isAnnualOnly(a) ? ["ANNUAL"] : months;
      total += keys.length;
      filled += keys.filter(k => draft[a.id]?.[k]).length;
    }
    return { totalFields: total, filledFields: filled };
  }, [filteredAssets, draft, months]);

  const overallPct = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  // Sidebar facilities
  const sidebarFacs = useMemo(
    () =>
      [...byFacility.keys()].map(name => {
        const f = facilities.find(x => x.name === name);
        return { name, gridUtility: f?.grid_utility ?? "", pct: facilityPct[name] ?? 0 };
      }),
    [byFacility, facilities, facilityPct],
  );

  // Groups to display (filtered when a facility is selected in sidebar)
  const visibleGroups = useMemo(() => {
    if (!activeFacility) return [...byFacility.entries()];
    const fAssets = byFacility.get(activeFacility);
    return fAssets ? ([[activeFacility, fAssets]] as [string, DecarbAsset[]][]) : [];
  }, [byFacility, activeFacility]);

  const descParts = [
    `${fy}`,
    `${[...byFacility.keys()].length} ${[...byFacility.keys()].length === 1 ? "facility" : "facilities"}`,
    `${filteredAssets.length} sources`,
  ];

  return (
    <>
      <PageHeader
        eyebrow="Data Collection"
        title="Monthly Data Tracker"
        description={descParts.join(" · ")}
        right={
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums"
              style={{
                borderColor: overallPct === 100 ? "#059669" : "var(--primary)",
                color: overallPct === 100 ? "#059669" : "var(--primary)",
              }}
            >
              {overallPct}%
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--muted)] transition-colors"
              onClick={() => toast("Interim report generation coming soon")}
            >
              <Download className="h-3.5 w-3.5" />
              Interim Report
            </button>
          </div>
        }
      />

      {/* Body — no PageBody wrapper so the grid can be full-bleed */}
      <div className="px-6 pt-4 pb-8 md:px-8">
        {assetsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--border)] py-16 text-center">
            <p className="text-sm text-muted-foreground">No equipment in the inventory yet.</p>
            <p className="text-xs text-muted-foreground">
              Set up your inventory boundary first, then return here to log monthly data.
            </p>
            <a
              href="/inventory"
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Go to Inventory →
            </a>
          </div>
        ) : (
          <div
            className="flex overflow-hidden rounded-xl border border-[var(--border)]"
            style={{ minHeight: 520 }}
          >
            {/* ── Sidebar ── */}
            {sidebarOpen && (
              <aside className="flex w-48 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--muted)]/30">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Facilities
                  </span>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-[var(--border)] hover:text-foreground transition-colors"
                    title="Collapse sidebar"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* All Facilities option */}
                <button
                  type="button"
                  onClick={() => setActiveFacility(null)}
                  className={`w-full border-b border-[var(--border)] px-3 py-2.5 text-left text-xs font-semibold transition-colors hover:bg-[var(--muted)] ${!activeFacility ? "bg-[var(--navy)]/5 text-[var(--navy)]" : "text-muted-foreground"}`}
                >
                  All Facilities
                </button>

                <div className="flex-1 divide-y divide-[var(--border)] overflow-y-auto">
                  {sidebarFacs.map(f => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => setActiveFacility(prev => (prev === f.name ? null : f.name))}
                      className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-[var(--muted)] ${activeFacility === f.name ? "bg-[var(--navy)]/8" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="truncate text-[12px] font-semibold text-[var(--navy)] leading-snug">
                          {f.name}
                        </span>
                        <span
                          className={`ml-1 shrink-0 text-[11px] font-bold tabular-nums ${
                            f.pct === 100 ? "text-emerald-600" : f.pct > 0 ? "text-amber-600" : "text-muted-foreground"
                          }`}
                        >
                          {f.pct}%
                        </span>
                      </div>
                      {f.gridUtility && (
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {f.gridUtility}
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Data Gaps panel */}
                {dataGaps.length > 0 && (
                  <div className="border-t border-[var(--border)]">
                    <div className="flex items-center gap-1.5 bg-red-50 px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span className="text-[11px] font-bold text-red-700">
                        {dataGaps.length} gap{dataGaps.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="max-h-36 overflow-y-auto px-3 py-2 space-y-0.5">
                      {dataGaps.slice(0, 30).map((g, i) => (
                        <div key={i} className="flex gap-1 text-[11px]">
                          <span className="font-mono text-red-600 truncate flex-1">{g.assetName}</span>
                          <span className="shrink-0 text-muted-foreground">{g.month}</span>
                        </div>
                      ))}
                      {dataGaps.length > 30 && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          +{dataGaps.length - 30} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </aside>
            )}

            {/* ── Main panel ── */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Scope tab bar */}
              <div className="flex items-center border-b border-[var(--border)]">
                {!sidebarOpen && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="border-r border-[var(--border)] px-2.5 py-3 text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground transition-colors"
                    title="Expand sidebar"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {(["s12", "s3"] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setScopeTab(tab); setActiveFacility(null); }}
                    className={`border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
                      scopeTab === tab
                        ? "border-[var(--primary)] text-[var(--primary)]"
                        : "border-transparent text-muted-foreground hover:text-[var(--navy)]"
                    }`}
                  >
                    {tab === "s12" ? "Scope 1 & 2 Tracker" : "Scope 3 Tracker"}
                  </button>
                ))}
                {activeFacility && (
                  <span className="ml-auto mr-3 flex items-center gap-1.5 rounded-full bg-[var(--navy)]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--navy)]">
                    {activeFacility}
                    <button
                      type="button"
                      onClick={() => setActiveFacility(null)}
                      className="text-[var(--navy)]/60 hover:text-[var(--navy)]"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>

              {/* Grid or empty state */}
              {filteredAssets.length === 0 ? (
                <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
                  No {scopeTab === "s12" ? "Scope 1 or Scope 2" : "Scope 3"} sources in the inventory.
                </div>
              ) : (
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                  <table className="min-w-max border-collapse">
                    <thead>
                      <tr>
                        <th
                          className="sticky left-0 z-20 min-w-[200px] max-w-[220px] border-r border-white/20 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-white"
                          style={{ background: "#1A3547" }}
                        >
                          Equipment
                        </th>
                        <th
                          className="sticky left-[200px] z-20 w-12 border-r border-white/20 px-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-white"
                          style={{ background: "#1A3547" }}
                        >
                          Unit
                        </th>
                        {months.map(m => (
                          <th
                            key={m}
                            className="w-[68px] px-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-white"
                            style={{ background: "#1A3547" }}
                          >
                            {m}
                          </th>
                        ))}
                        <th
                          className="w-[72px] px-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: "#1E4A62", color: "#A7C8D8" }}
                        >
                          Annual
                        </th>
                        <th
                          className="w-16 px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-white/80"
                          style={{ background: "#1A3547" }}
                        >
                          Done
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleGroups.map(([fac, fAssets]) => {
                        const facInfo = facilities.find(f => f.name === fac);
                        const facPct = facilityPct[fac] ?? 0;
                        return (
                          <Fragment key={fac}>
                            {/* Facility group header */}
                            <tr>
                              <td
                                colSpan={months.length + 4}
                                className="px-3 py-1.5"
                                style={{ background: "#243D52" }}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-[11px] font-bold uppercase tracking-wide text-white">
                                    {fac}
                                  </span>
                                  {facInfo && (
                                    <span className="text-[11px] text-white/50">
                                      {[facInfo.state, facInfo.grid_utility].filter(Boolean).join(" · ")}
                                    </span>
                                  )}
                                  <span className="ml-auto text-[11px] text-white/50">
                                    {fAssets.length} source{fAssets.length !== 1 ? "s" : ""} ·{" "}
                                    <span
                                      className={`font-bold ${
                                        facPct === 100 ? "text-emerald-400" : facPct > 0 ? "text-amber-400" : "text-white/50"
                                      }`}
                                    >
                                      {facPct}%
                                    </span>
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {fAssets.map(a => (
                              <EquipmentRow
                                key={a.id}
                                asset={a}
                                months={months}
                                draftRow={draft[a.id] ?? {}}
                                onCellChange={(m, v) => setCellValue(a.id, m, v)}
                                rowFiles={cellFiles[a.id] ?? {}}
                                onFileAdd={(m, f) => addCellFile(a.id, m, f)}
                              />
                            ))}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--muted)]/40 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    <span className="font-bold tabular-nums text-[var(--ink)]">{filledFields}</span>
                    {" of "}
                    <span className="font-bold tabular-nums text-[var(--ink)]">{totalFields}</span>
                    {" fields complete"}
                  </span>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                      style={{ width: `${overallPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Legend */}
                  <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" />
                      entered
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--muted)] ring-1 ring-[var(--border)]" />
                      empty
                    </span>
                    <span className="flex items-center gap-1">
                      <Paperclip className="h-2.5 w-2.5 text-[var(--navy)]" />
                      doc attached
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? "Saving…" : "Save Draft"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
