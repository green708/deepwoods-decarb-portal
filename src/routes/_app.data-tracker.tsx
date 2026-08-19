import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/portal";
import { useClientContext } from "@/lib/client-context";
import { useDecarbAssets, useFacilities } from "@/lib/api";
import type { DecarbAsset, FacilityRow } from "@/lib/api";
import { useEntity } from "@/lib/entity";
import { useFiscalYear } from "@/lib/entity";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, Info, Paperclip, Save } from "lucide-react";
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

function fyLabel(fy: string, period: "FY" | "CY"): string {
  const yy = parseInt(fy.replace(/[^0-9]/g, ""));
  if (period === "CY") { const y = yy < 100 ? 2000 + yy : yy; return `${fy} (Jan ${y} – Dec ${y})`; }
  const e = yy < 100 ? 2000 + yy : yy;
  return `${fy} (Apr ${e - 1} – Mar ${e})`;
}

type ScopeTag = { label: string; bg: string; fg: string };
function getScopeTag(a: DecarbAsset): ScopeTag {
  const st = (a.sub_type ?? "").toLowerCase();
  const sc = a.scope ?? "";
  if (sc === "Scope 1") {
    if (st === "fugitive" || st.includes("refrigerant") || st.includes("fire ext") || st.includes("welding"))
      return { label: "S1 — Fugitive", bg: "#FEF9C3", fg: "#854D0E" };
    if (st.includes("process")) return { label: "S1 — Process", bg: "#FFE4E6", fg: "#9F1239" };
    return { label: "S1 — Combustion", bg: "#FEF3C7", fg: "#92400E" };
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

const AVATAR_PALETTE = [
  "#1E3A5F","#5B21B6","#065F46","#92400E","#1E40AF","#831843","#374151","#0E7490",
];
function facilityColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function facilityInitials(name: string): string {
  return name.split(/[\s\-_]+/).map(w => w[0] ?? "").filter(Boolean).join("").slice(0, 2).toUpperCase();
}

type TrackerDraft = Record<string, Record<string, string>>;
type CellFiles  = Record<string, Record<string, File[]>>;

// ── MonthCell ─────────────────────────────────────────────────────────────────

interface MonthCellProps {
  value: string;
  onChange: (v: string) => void;
  fileCount: number;
  onFileAdd: (f: File) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

function MonthCell({ value, onChange, fileCount, onFileAdd, disabled, readOnly }: MonthCellProps) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) setTimeout(() => inputRef.current?.select(), 0); }, [editing]);

  if (disabled) return (
    <div className="flex h-9 w-full items-center justify-center">
      <span className="text-[11px] text-gray-300">—</span>
    </div>
  );

  if (readOnly) return (
    <div className="flex h-9 w-full items-center justify-center">
      <span className={`font-mono text-xs tabular-nums ${value ? "font-bold text-[#1A3547]" : "text-gray-300"}`}>
        {value || "—"}
      </span>
    </div>
  );

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
          onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); setEditing(false); } }}
          className="absolute inset-0 w-full border-2 border-[var(--primary)] bg-white px-2 text-center font-mono text-sm focus:outline-none"
          style={{ zIndex: 20 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`absolute inset-0 flex w-full items-center justify-center font-mono text-xs tabular-nums transition-colors ${
            value ? "bg-emerald-50 font-semibold text-emerald-900 hover:bg-emerald-100" : "text-gray-300 hover:bg-gray-50"
          }`}
        >
          {value || "—"}
        </button>
      )}

      {hovered && !editing && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
          className="absolute bottom-0.5 right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded bg-[#1A3547] text-white opacity-70 hover:opacity-100 transition-opacity"
          style={{ zIndex: 25 }}
          title="Attach document"
        >
          <Paperclip className="h-2.5 w-2.5" />
        </button>
      )}

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

// ── EquipmentSection ───────────────────────────────────────────────────────────

interface EquipmentSectionProps {
  asset: DecarbAsset;
  months: string[];
  draftRow: Record<string, string>;
  onCellChange: (month: string, value: string) => void;
  rowFiles: Record<string, File[]>;
  onFileAdd: (month: string, file: File) => void;
}

function EquipmentSection({ asset, months, draftRow, onCellChange, rowFiles, onFileAdd }: EquipmentSectionProps) {
  const tag     = getScopeTag(asset);
  const annual  = isAnnualOnly(asset);
  const totalSlots  = annual ? 1 : months.length;
  const filledCount = annual ? (draftRow["ANNUAL"] ? 1 : 0) : months.filter(m => draftRow[m]).length;

  const autoSum = useMemo(() => {
    if (annual) return null;
    const s = months.reduce((acc, m) => { const v = parseFloat(draftRow[m] ?? ""); return acc + (isNaN(v) ? 0 : v); }, 0);
    return s > 0 ? s : null;
  }, [annual, months, draftRow]);

  const fieldLabel  = asset.unit ? `${asset.name} (${asset.unit})` : asset.name;
  const description = [asset.fuel && `Fuel: ${asset.fuel}`, !asset.fuel && asset.sub_type].filter(Boolean).join(" · ");

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-[#1A3547]">{asset.name}</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">{asset.id}</span>
            <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ background: tag.bg, color: tag.fg }}>{tag.label}</span>
          </div>
          {description && <div className="mt-1 text-[13px] text-gray-400">{description}</div>}
          {annual && <div className="mt-1 text-[12px] italic text-amber-600">Annual entry — enter total for the year</div>}
        </div>
        <div className="shrink-0 text-right text-sm">
          <span className={`font-bold tabular-nums ${filledCount === totalSlots ? "text-emerald-600" : filledCount > 0 ? "text-amber-600" : "text-gray-300"}`}>
            {filledCount}/{totalSlots}
          </span>
          <span className="ml-1 text-gray-300">filled</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border-t border-gray-100">
        <table className="min-w-max w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="sticky left-0 z-10 w-[180px] bg-gray-50 px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Field
              </th>
              {!annual && months.map(m => (
                <th key={m} className="w-[68px] px-1 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">{m}</th>
              ))}
              <th className="w-[76px] px-1 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {annual ? "Annual" : "Total"}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="sticky left-0 z-10 bg-white px-5 align-middle text-[12px] font-medium text-gray-600">
                {fieldLabel}
              </td>
              {!annual && months.map(m => (
                <td key={m} className="p-0 align-middle">
                  <MonthCell
                    value={draftRow[m] ?? ""}
                    onChange={v => onCellChange(m, v)}
                    fileCount={rowFiles[m]?.length ?? 0}
                    onFileAdd={f => onFileAdd(m, f)}
                  />
                </td>
              ))}
              <td className="p-0 align-middle">
                {annual ? (
                  <MonthCell
                    value={draftRow["ANNUAL"] ?? ""}
                    onChange={v => onCellChange("ANNUAL", v)}
                    fileCount={rowFiles["ANNUAL"]?.length ?? 0}
                    onFileAdd={f => onFileAdd("ANNUAL", f)}
                  />
                ) : (
                  <MonthCell value={autoSum !== null ? String(autoSum) : ""} onChange={() => {}} fileCount={0} onFileAdd={() => {}} readOnly />
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── FacilityAccordion ─────────────────────────────────────────────────────────

interface FacilityAccordionProps {
  name: string;
  assets: DecarbAsset[];
  facilityInfo?: FacilityRow;
  months: string[];
  draft: TrackerDraft;
  cellFiles: CellFiles;
  onCellChange: (assetId: string, month: string, value: string) => void;
  onFileAdd: (assetId: string, month: string, file: File) => void;
  defaultExpanded?: boolean;
  pct: number;
  isCategory?: boolean;
}

function FacilityAccordion({ name, assets, facilityInfo, months, draft, cellFiles, onCellChange, onFileAdd, defaultExpanded, pct, isCategory }: FacilityAccordionProps) {
  const [open, setOpen] = useState(defaultExpanded ?? false);
  const color    = facilityColor(name);
  const initials = facilityInitials(name);

  const subtitle = isCategory
    ? `${assets.length} source${assets.length !== 1 ? "s" : ""} — value chain category`
    : [facilityInfo?.location, facilityInfo?.grid_utility, `${assets.length} equipment source${assets.length !== 1 ? "s" : ""}`].filter(Boolean).join(" · ");

  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: color }}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-[#1A3547]">{name}</div>
          <div className="truncate text-[12px] text-gray-400">{subtitle}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!isCategory && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-500">
              Active
            </span>
          )}
          <span className={`w-10 text-right text-sm font-bold tabular-nums ${pct === 100 ? "text-emerald-600" : pct > 0 ? "text-amber-600" : "text-gray-300"}`}>
            {pct}%
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-300" /> : <ChevronDown className="h-4 w-4 text-gray-300" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          {assets.map(a => (
            <EquipmentSection
              key={a.id}
              asset={a}
              months={months}
              draftRow={draft[a.id] ?? {}}
              onCellChange={(m, v) => onCellChange(a.id, m, v)}
              rowFiles={cellFiles[a.id] ?? {}}
              onFileAdd={(m, f) => onFileAdd(a.id, m, f)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── FacilityCards ─────────────────────────────────────────────────────────────

function FacilityCards({ names, facilities, facilityPct, assetCount, selected, onSelect }: {
  names: string[];
  facilities: FacilityRow[];
  facilityPct: Record<string, number>;
  assetCount: Record<string, number>;
  selected: string | null;
  onSelect: (name: string | null) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {names.map(name => {
        const f   = facilities.find(x => x.name === name);
        const pct = facilityPct[name] ?? 0;
        const cnt = assetCount[name] ?? 0;
        const sel = selected === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onSelect(sel ? null : name)}
            className={`w-52 shrink-0 rounded-xl border-2 p-4 text-left transition-all ${
              sel ? "border-[#1A3547] shadow-md" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="mb-1.5 truncate text-[13px] font-bold text-[#1A3547]">{name}</div>
            {f && <div className="mb-3 truncate text-[11px] text-gray-400">{[f.state, f.grid_utility].filter(Boolean).join(" · ")}</div>}
            <div className="text-[28px] font-bold leading-none tabular-nums text-[#1A3547]">{pct}%</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{cnt} sources</div>
          </button>
        );
      })}
    </div>
  );
}

// ── DataTrackerPage ────────────────────────────────────────────────────────────

function DataTrackerPage() {
  const ctx = useClientContext();
  const { entity }  = useEntity();
  const { fy }      = useFiscalYear();

  const { data: assets = [], isPending: assetsLoading } = useDecarbAssets(entity);
  const { data: facilities = [] } = useFacilities(entity);

  const [scopeTab, setScopeTab]         = useState<"s1" | "s2" | "s3">("s1");
  const [selectedFacility, setFacility] = useState<string | null>(null);
  const [draft, setDraft]               = useState<TrackerDraft>({});
  const [cellFiles, setCellFiles]       = useState<CellFiles>({});
  const [saving, setSaving]             = useState(false);

  const period   = ctx.client.reporting_period ?? "FY";
  const months   = useMemo(() => fyMonths(fy, period), [fy, period]);
  const draftKey = `tracker_${ctx.client.slug}_${entity}_${fy}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      setDraft(saved ? (JSON.parse(saved) as TrackerDraft) : {});
    } catch { setDraft({}); }
  }, [draftKey]);

  const setCellValue = useCallback((assetId: string, month: string, value: string) => {
    setDraft(prev => ({ ...prev, [assetId]: { ...(prev[assetId] ?? {}), [month]: value } }));
  }, []);

  const addCellFile = useCallback((assetId: string, month: string, file: File) => {
    setCellFiles(prev => ({
      ...prev,
      [assetId]: { ...(prev[assetId] ?? {}), [month]: [...(prev[assetId]?.[month] ?? []), file] },
    }));
  }, []);

  const saveDraft = useCallback(() => {
    setSaving(true);
    try { localStorage.setItem(draftKey, JSON.stringify(draft)); toast.success("Draft saved locally"); }
    catch { toast.error("Could not save draft"); }
    setTimeout(() => setSaving(false), 500);
  }, [draft, draftKey]);

  const activeAssets = useMemo(() => assets.filter(a => a.status !== "Decommissioned"), [assets]);

  const filteredAssets = useMemo(() =>
    scopeTab === "s1" ? activeAssets.filter(a => a.scope === "Scope 1")
    : scopeTab === "s2" ? activeAssets.filter(a => a.scope === "Scope 2")
    : activeAssets.filter(a => a.scope === "Scope 3"),
    [activeAssets, scopeTab],
  );

  // For S3: group by sub_type (category); for S1/S2: group by facility
  const byGroup = useMemo(() => {
    const map = new Map<string, DecarbAsset[]>();
    for (const a of filteredAssets) {
      const key = scopeTab === "s3" ? (a.sub_type || "Other") : (a.facility || "Unknown");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [filteredAssets, scopeTab]);

  const groupNames = useMemo(() => [...byGroup.keys()], [byGroup]);

  const groupPct = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [g, ga] of byGroup) {
      let total = 0, filled = 0;
      for (const a of ga) {
        const keys = isAnnualOnly(a) ? ["ANNUAL"] : months;
        total += keys.length;
        filled += keys.filter(k => draft[a.id]?.[k]).length;
      }
      out[g] = total > 0 ? Math.round((filled / total) * 100) : 0;
    }
    return out;
  }, [byGroup, draft, months]);

  const assetCount = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [g, ga] of byGroup) out[g] = ga.length;
    return out;
  }, [byGroup]);

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

  const visibleGroups = useMemo(() => {
    if (!selectedFacility) return [...byGroup.entries()];
    const a = byGroup.get(selectedFacility);
    return a ? [[selectedFacility, a] as [string, DecarbAsset[]]] : [];
  }, [byGroup, selectedFacility]);

  return (
    <>
      <PageHeader
        eyebrow="Data Collection"
        title={ctx.client.name || "Data Tracker"}
        description={fyLabel(fy, period)}
        right={
          <div className="flex items-center gap-2">
            {/* Progress ring */}
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 text-xs font-bold tabular-nums"
              style={{
                borderColor: overallPct === 100 ? "#059669" : overallPct > 0 ? "var(--primary)" : "#E5E7EB",
                color: overallPct > 0 ? (overallPct === 100 ? "#059669" : "var(--primary)") : "#9CA3AF",
              }}
            >
              {overallPct}%
            </div>
            <button
              type="button"
              onClick={saveDraft}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-[#1A3547] transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              disabled={overallPct < 50}
              onClick={() => toast("Submit flow — coming soon")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Complete ≥ 50% to submit
            </button>
          </div>
        }
      />

      <div className="px-6 pt-4 pb-10 md:px-8">
        {assetsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 py-16 text-center">
            <p className="text-sm text-gray-400">No equipment in the inventory yet.</p>
            <a href="/inventory" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90">
              Go to Inventory →
            </a>
          </div>
        ) : (
          <>
            {/* Scope tabs */}
            <div className="mb-5 flex gap-1 border-b border-gray-200">
              {(["s1", "s2", "s3"] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setScopeTab(tab); setFacility(null); }}
                  className={`border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
                    scopeTab === tab
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-gray-400 hover:text-[#1A3547]"
                  }`}
                >
                  {tab === "s1" ? "Scope 1" : tab === "s2" ? "Scope 2" : "Scope 3"}
                </button>
              ))}
            </div>

            {filteredAssets.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
                No {scopeTab === "s1" ? "Scope 1" : scopeTab === "s2" ? "Scope 2" : "Scope 3"} sources in the inventory boundary.
              </div>
            ) : (
              <>
                {/* Facility cards strip — S1 and S2 only */}
                {scopeTab !== "s3" && (
                  <div className="mb-5">
                    <FacilityCards
                      names={groupNames}
                      facilities={facilities}
                      facilityPct={groupPct}
                      assetCount={assetCount}
                      selected={selectedFacility}
                      onSelect={setFacility}
                    />
                  </div>
                )}

                {/* Welcome banner */}
                <div className="mb-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <p className="text-[13px] text-emerald-800">
                    <span className="font-semibold">Welcome to your {fy} GHG data collection.</span>
                    {" "}Your consultant has pre-loaded the facility and equipment list. Fill in month by month — you don't need to complete everything at once. Everything auto-saves locally.
                  </p>
                </div>

                {/* Progress line */}
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-sm text-gray-400">
                    <span className="font-bold tabular-nums text-[#1A3547]">{filledFields}</span>
                    {" of "}
                    <span className="font-bold tabular-nums text-[#1A3547]">{totalFields}</span>
                    {" fields complete"}
                  </span>
                  <div className="h-1.5 w-36 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-[var(--primary)] transition-all duration-300" style={{ width: `${overallPct}%` }} />
                  </div>
                </div>

                {/* Scope 3 section header */}
                {scopeTab === "s3" && (
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A3547] text-sm font-bold text-white">S3</div>
                    <div>
                      <div className="text-[15px] font-bold text-[#1A3547]">Scope 3 — Value Chain Categories</div>
                      <div className="text-[12px] text-gray-400">
                        {groupNames.length} relevant {groupNames.length === 1 ? "category" : "categories"} · Upload one dataset per applicable category
                      </div>
                    </div>
                  </div>
                )}

                {/* Accordion list */}
                {visibleGroups.map(([grp, grpAssets], idx) => (
                  <FacilityAccordion
                    key={grp}
                    name={grp}
                    assets={grpAssets}
                    facilityInfo={facilities.find(f => f.name === grp)}
                    months={months}
                    draft={draft}
                    cellFiles={cellFiles}
                    onCellChange={setCellValue}
                    onFileAdd={addCellFile}
                    defaultExpanded={idx === 0}
                    pct={groupPct[grp] ?? 0}
                    isCategory={scopeTab === "s3"}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
