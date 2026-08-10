import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageBody, PageHeader } from "@/components/portal";
import { useClientContext } from "@/lib/client-context";
import { useEntity, useFiscalYear } from "@/lib/entity";
import { Search, X, MapPin, ChevronDown, Flame, Zap, Building2, Database } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useDecarbAssets, type DecarbAsset } from "@/lib/api";

export const Route = createFileRoute("/_app/inventory")({ component: Inventory });

/* ── Types ──────────────────────────────────────────────────────────────── */
type ScopeLabel = "Scope 1" | "Scope 2" | "Renewables";
type View = "register" | "leaderboard" | "compare";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function seriesKeys(a: DecarbAsset): string[] {
  return Object.keys(a.series).sort();
}
function seriesVal(a: DecarbAsset, fy: string): number | null {
  const v = a.series[fy];
  return v !== undefined ? v : null;
}
function yoyPct(a: DecarbAsset, fy: string, allYears: string[]): number | null {
  const idx = allYears.indexOf(fy);
  if (idx <= 0) return null;
  const cur  = a.series[allYears[idx]];
  const prev = a.series[allYears[idx - 1]];
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

/* ── Sparkline ───────────────────────────────────────────────────────────── */
function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return <span className="text-muted-foreground text-xs">—</span>;
  const min = Math.min(...values); const max = Math.max(...values);
  const range = max - min || 1;
  const W = 56; const H = 20;
  const points = values.map((v, i) =>
    `${(i / (values.length - 1)) * W},${H - 2 - ((v - min) / range) * (H - 4)}`
  ).join(" ");
  const color = up ? "#D97706" : "#1E6F5C";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Badges ──────────────────────────────────────────────────────────────── */
function StatusPill({ s }: { s: string }) {
  const cls: Record<string, string> = {
    Active:         "bg-[#E6F4EF] text-[#16A34A]",
    Standby:        "bg-[#FEF3C7] text-[#D97706]",
    Decommissioned: "bg-[#FEE2E2] text-[#D90429]",
  };
  return <span className={`inline-flex h-5 items-center rounded-full px-2 text-[9px] font-bold uppercase tracking-wider ${cls[s] ?? cls.Standby}`}>{s}</span>;
}
function HealthBadge({ h }: { h: string }) {
  const cls: Record<string, string> = {
    Efficient:              "bg-[#E6F4EF] text-[#16A34A]",
    Monitor:                "bg-[#FEF3C7] text-[#D97706]",
    "Flag for Replacement": "bg-[#FEE2E2] text-[#D90429]",
  };
  const icon: Record<string, string> = { Efficient: "✓", Monitor: "⚠", "Flag for Replacement": "⚑" };
  return (
    <span className={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-[9px] font-bold ${cls[h] ?? cls.Monitor}`}>
      {icon[h] ?? "⚠"} {h}
    </span>
  );
}
function EntityChip({ e }: { e: string }) {
  return <span className="rounded border px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-[var(--navy)]">{e}</span>;
}
function YoYLabel({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct > 0;
  return (
    <span className={`text-[10px] font-semibold ${up ? "text-[#D97706]" : "text-[#16A34A]"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% YoY
    </span>
  );
}

/* ── Scope dot ───────────────────────────────────────────────────────────── */
const SCOPE_DOT: Record<string, string> = {
  "Scope 1":    "bg-[#1E6F5C]",
  "Scope 2":    "bg-[#3B82F6]",
  "Renewables": "bg-[#16A34A]",
};

/* ── Asset drawer ────────────────────────────────────────────────────────── */
function AssetDrawer({ asset, fy, onClose }: { asset: DecarbAsset; fy: string; onClose: () => void }) {
  const fyKeys = seriesKeys(asset);
  const chartData = fyKeys.map(k => ({ fy: k, value: asset.series[k] }));
  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l bg-white shadow-2xl overflow-y-auto">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <div className="font-semibold text-[var(--navy)]">{asset.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{asset.id}</span><span>·</span><span>{asset.scope}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HealthBadge h={asset.health} />
          <button onClick={onClose} className="rounded-full p-1 hover:bg-[var(--muted)]"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 border-b px-5 py-4 text-sm">
        {[
          { label: "Facility",   val: asset.facility },
          { label: "Entity",     val: asset.entity },
          { label: "Fuel / Gas", val: asset.fuel },
          { label: "Unit",       val: asset.unit },
        ].map(r => (
          <div key={r.label}>
            <div className="text-[10px] text-muted-foreground">{r.label}</div>
            <div className="font-semibold text-[var(--navy)]">{r.val}</div>
          </div>
        ))}
      </div>
      <div className="border-b px-5 py-4">
        <div className="mb-2 text-xs font-semibold text-[var(--navy)]">Historical trend</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="fy" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={44} />
            <Tooltip formatter={(v: number) => [v.toFixed(2), asset.unit]} />
            <Line type="monotone" dataKey="value" stroke="#1E6F5C" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="px-5 py-4">
        <div className="mb-2 text-xs font-semibold text-[var(--navy)]">Annual values</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              <th className="pb-2 text-left">FY</th>
              <th className="pb-2 text-right">Value ({asset.unit})</th>
              <th className="pb-2 text-right">YoY</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {fyKeys.map((k, i) => {
              const v    = asset.series[k];
              const prev = i > 0 ? asset.series[fyKeys[i - 1]] : undefined;
              const chg  = (v != null && prev != null && prev !== 0) ? ((v - prev) / prev) * 100 : null;
              return (
                <tr key={k}>
                  <td className="py-1.5 font-semibold text-[var(--navy)]">{k}</td>
                  <td className="py-1.5 text-right tabular-nums">{v != null ? v.toFixed(2) : "—"}</td>
                  <td className="py-1.5 text-right">
                    {chg !== null ? (
                      <span className={`text-xs font-semibold ${chg > 0 ? "text-[#D97706]" : "text-[#16A34A]"}`}>
                        {chg > 0 ? "▲" : "▼"} {Math.abs(chg).toFixed(1)}%
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Facility card (Compare view) ────────────────────────────────────────── */
function FacilityCard({
  facility, entity, total, pct, assets, sparkValues, selected, onClick,
}: {
  facility: string; entity: string; total: number; pct: number; assets: number;
  sparkValues: number[]; selected: boolean; onClick: () => void;
}) {
  const up = sparkValues.length >= 2 && sparkValues[sparkValues.length - 1] > sparkValues[0];
  return (
    <button onClick={onClick}
      className={`flex-shrink-0 w-48 rounded-xl border p-3 text-left transition-all ${
        selected ? "border-[#1E6F5C] bg-[#E6F4EF] shadow-md" : "bg-white hover:shadow-md hover:border-[#1E6F5C]"
      }`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1 text-xs font-semibold text-[var(--navy)] truncate">
          <MapPin className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          <span className="truncate">{facility}</span>
        </div>
        <EntityChip e={entity} />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xl font-bold tabular-nums text-[var(--navy)]">{total.toFixed(0)}</div>
          <div className="text-[9px] text-muted-foreground">tCO2e</div>
          <div className="text-[9px] text-muted-foreground mt-0.5">{assets} assets · {pct.toFixed(1)}%</div>
        </div>
        <Sparkline values={sparkValues} up={up} />
      </div>
      {selected && <div className="mt-1.5 text-[9px] font-bold text-[#1E6F5C]">● Selected — all views filtered</div>}
    </button>
  );
}

/* ── Section header ──────────────────────────────────────────────────────── */
function SectionHeader({ scope, sub, count, unit }: {
  scope: string; sub: string; count: number; unit: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${SCOPE_DOT[scope] ?? "bg-slate-400"}`} />
        <span className="font-semibold text-sm text-[var(--navy)]">{scope} · {sub}</span>
        <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{count}</span>
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground">{unit}</span>
    </div>
  );
}

/* ── Asset table ─────────────────────────────────────────────────────────── */
function AssetTable({ rows, fy, compareMode, compareFy, allYears, onAsset }: {
  rows: DecarbAsset[]; fy: string; compareMode: boolean; compareFy: string;
  allYears: string[]; onAsset: (id: string) => void;
}) {
  if (rows.length === 0) return <div className="px-4 py-4 text-sm text-muted-foreground">No assets match.</div>;
  const headers = compareMode
    ? ["ASSET", "FACILITY", "FUEL/GAS", fy, compareFy, "Δ", "TREND", "STATUS"]
    : ["ASSET", "FACILITY", "FUEL/GAS", "VALUE", "TREND", "STATUS"];
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-t">
        <tr>
          {headers.map(h => (
            <th key={h} className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map(a => {
          const v    = seriesVal(a, fy);
          const vCmp = compareMode ? seriesVal(a, compareFy) : null;
          const delta = (compareMode && v !== null && vCmp !== null && vCmp !== 0)
            ? ((v - vCmp) / vCmp) * 100 : null;
          const yoy = yoyPct(a, fy, allYears);
          const sparkPts = seriesKeys(a).map(k => a.series[k]);
          return (
            <tr key={a.id} onClick={() => onAsset(a.id)}
              className="cursor-pointer hover:bg-[var(--muted)] transition">
              <td className="px-4 py-2.5">
                <div className="font-semibold text-[var(--navy)]">{a.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">{a.id}</span>
                  <EntityChip e={a.entity} />
                </div>
              </td>
              <td className="px-4 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{a.facility}</td>
              <td className="px-4 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{a.fuel}</td>
              {compareMode ? (
                <>
                  <td className="px-4 py-2.5 tabular-nums font-bold text-[var(--navy)]">{v !== null ? v.toFixed(1) : "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{vCmp !== null ? vCmp.toFixed(1) : "—"}</td>
                  <td className="px-4 py-2.5">
                    {delta !== null ? (
                      <span className={`text-xs font-semibold ${delta > 0 ? "text-[#D97706]" : "text-[#16A34A]"}`}>
                        {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
                      </span>
                    ) : "—"}
                  </td>
                </>
              ) : (
                <td className="px-4 py-2.5">
                  <div className="tabular-nums font-bold text-[var(--navy)]">{v !== null ? v.toFixed(1) : "—"}</div>
                  {yoy !== null && <YoYLabel pct={yoy} />}
                </td>
              )}
              <td className="px-4 py-2.5"><Sparkline values={sparkPts.filter((v): v is number => v !== null)} up={(yoy ?? 0) > 0} /></td>
              <td className="px-4 py-2.5">
                <div className="flex flex-col gap-1">
                  <StatusPill s={a.status} />
                  <HealthBadge h={a.health} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────── */
function Inventory() {
  const { entity } = useEntity();
  const { entities, reporting_years } = useClientContext();
  const entityShort = (code: string) => entities.find(e => e.code === code)?.short ?? code;
  const consolidatedCode = entities.find(e => e.is_consolidated)?.code;
  const isConsolidated = entity === consolidatedCode;
  const { fy: year } = useFiscalYear();

  const { data: rawAssets } = useDecarbAssets(isConsolidated ? undefined : entity);

  const allYears = useMemo(() => {
    if (!rawAssets?.length) return reporting_years ?? [];
    const keys = new Set<string>();
    rawAssets.forEach(a => Object.keys(a.series).forEach(k => keys.add(k)));
    return Array.from(keys).sort();
  }, [rawAssets, reporting_years]);

  const allAssets = rawAssets ?? [];

  const [compareMode,     setCompareMode]     = useState(false);
  const [compareFy,       setCompareFy]       = useState<string>("");
  const [view,            setView]            = useState<View>("register");
  const [search,          setSearch]          = useState("");
  const [fScope,          setFScope]          = useState("All");
  const [fStatus,         setFStatus]         = useState("All");
  const [fFuel,           setFuel]            = useState("All");
  const [kpi,             setKpi]             = useState<string | null>(null);
  const [selectedFacility,setSelectedFacility] = useState<string | null>(null);
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [drawer,          setDrawer]          = useState<string | null>(null);
  const [lbMode,          setLbMode]          = useState<"asset" | "facility">("asset");
  const [lbSel,           setLbSel]           = useState<string | null>(null);

  const compareFyFinal = compareFy || allYears.find(y => y !== year) || "";

  const base = useMemo(() => {
    let r = [...allAssets];
    if (selectedFacility) r = r.filter(a => a.facility === selectedFacility);
    if (search) { const q = search.toLowerCase(); r = r.filter(a => a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)); }
    if (fScope  !== "All") r = r.filter(a => a.scope     === fScope);
    if (fStatus !== "All") r = r.filter(a => a.status    === fStatus);
    if (fFuel   !== "All") r = r.filter(a => a.fuel      === fFuel);
    if (kpi === "s1") r = r.filter(a => a.scope === "Scope 1");
    if (kpi === "s2") r = r.filter(a => a.scope === "Scope 2");
    return r;
  }, [allAssets, selectedFacility, search, fScope, fStatus, fFuel, kpi]);

  const kpiTotal = allAssets.length;
  const kpiS1    = allAssets.filter(a => a.scope === "Scope 1").length;
  const kpiS2    = allAssets.filter(a => a.scope === "Scope 2").length;
  const kpiFac   = new Set(allAssets.map(a => a.facility)).size;

  const facilityCards = useMemo(() => {
    const tco2 = allAssets.filter(a => a.unit === "tCO2e");
    const map = new Map<string, { co2: number; entity: string; count: number; trend: number[] }>();
    for (const a of tco2) {
      const prev = map.get(a.facility) ?? { co2: 0, entity: a.entity, count: 0, trend: [] };
      const trendKeys = seriesKeys(a);
      const trend = trendKeys.map(k => (prev.trend[trendKeys.indexOf(k)] ?? 0) + (a.series[k] ?? 0));
      map.set(a.facility, { co2: prev.co2 + (seriesVal(a, year) ?? 0), entity: a.entity, count: prev.count + 1, trend });
    }
    const grand = Array.from(map.values()).reduce((s, v) => s + v.co2, 0);
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, pct: grand > 0 ? (v.co2 / grand) * 100 : 0 }))
      .sort((a, b) => b.co2 - a.co2);
  }, [allAssets, year]);

  const fuelOpts     = useMemo(() => Array.from(new Set(allAssets.map(a => a.fuel))).sort(), [allAssets]);
  const facilityOpts = useMemo(() => Array.from(new Set(allAssets.map(a => a.facility))).sort(), [allAssets]);

  const stationary  = base.filter(a => a.sub_type === "Stationary");
  const mobile      = base.filter(a => a.sub_type === "Mobile");
  const fugitive    = base.filter(a => a.sub_type === "Fugitive");
  const electricity = base.filter(a => a.sub_type === "Electricity");
  const renewable   = base.filter(a => a.sub_type === "Renewable");

  const compareAssets = useMemo(() =>
    (selectedFacilities.length > 0
      ? allAssets.filter(a => selectedFacilities.includes(a.facility))
      : allAssets).filter(a => a.unit === "tCO2e"),
    [allAssets, selectedFacilities]);

  const compareFacilities = useMemo(() =>
    selectedFacilities.length > 0
      ? selectedFacilities
      : Array.from(new Set(allAssets.map(a => a.facility))),
    [allAssets, selectedFacilities]);

  const compareBarData = useMemo(() =>
    allYears.slice(0, 4).map(fy => {
      const row: Record<string, string | number> = { fy };
      for (const fac of compareFacilities) {
        row[fac] = compareAssets.filter(a => a.facility === fac)
          .reduce((s, a) => s + (a.series[fy] ?? 0), 0);
      }
      return row;
    }), [compareAssets, compareFacilities, allYears]);

  const COMPARE_COLORS = ["#1E6F5C", "#3B82F6", "#D97706", "#8B5CF6", "#EC4899", "#6B7280"];

  const topAssets = useMemo(() =>
    (selectedFacility ? allAssets.filter(a => a.facility === selectedFacility) : allAssets)
      .filter(a => a.unit === "tCO2e" && seriesVal(a, year) !== null)
      .sort((a, b) => (seriesVal(b, year) ?? 0) - (seriesVal(a, year) ?? 0)),
    [allAssets, selectedFacility, year]);

  const topFacilities = useMemo(() => {
    const map = new Map<string, { co2: number; entity: string; s1: number; s2: number }>();
    for (const a of (selectedFacility ? allAssets.filter(x => x.facility === selectedFacility) : allAssets).filter(x => x.unit === "tCO2e")) {
      const prev = map.get(a.facility) ?? { co2: 0, entity: a.entity, s1: 0, s2: 0 };
      const v = seriesVal(a, year) ?? 0;
      map.set(a.facility, { co2: prev.co2 + v, entity: a.entity, s1: prev.s1 + (a.scope === "Scope 1" ? v : 0), s2: prev.s2 + (a.scope === "Scope 2" ? v : 0) });
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.co2 - a.co2);
  }, [allAssets, selectedFacility, year]);

  const lbChartData = useMemo(() => {
    if (lbSel) {
      if (lbMode === "asset") {
        const a = topAssets.find(x => x.id === lbSel);
        if (!a) return [];
        return seriesKeys(a).map(k => ({ label: k, value: a.series[k] ?? 0 }));
      } else {
        const fAssets = allAssets.filter(a => a.facility === lbSel && a.unit === "tCO2e");
        return allYears.map(fy => ({ label: fy, value: fAssets.reduce((s, a) => s + (a.series[fy] ?? 0), 0) }));
      }
    }
    if (lbMode === "asset") return topAssets.slice(0, 12).map(a => ({ label: a.name.length > 28 ? a.name.slice(0, 26) + "…" : a.name, value: seriesVal(a, year) ?? 0 }));
    return topFacilities.map(f => ({ label: f.name, value: f.co2 }));
  }, [lbMode, lbSel, topAssets, topFacilities, allAssets, selectedFacility, year, allYears]);

  const drawerAsset = drawer ? allAssets.find(a => a.id === drawer) : null;

  return (
    <>
      <PageHeader
        eyebrow={`Inventory · ${entityShort(entity)}`}
        title="Emissions source register"
        description="Every Scope 1, Scope 2 and renewable asset. Filter by facility, compare years and track health."
        right={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 border-l pl-3">
              <button onClick={() => setCompareMode(m => !m)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${compareMode ? "bg-[#1E6F5C]" : "bg-gray-200"}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${compareMode ? "translate-x-[18px]" : "translate-x-0.5"}`} />
              </button>
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Compare years</span>
            </div>
            {compareMode && (
              <>
                <span className="text-xs font-bold text-muted-foreground">vs</span>
                <div className="relative">
                  <select value={compareFyFinal} onChange={e => setCompareFy(e.target.value)}
                    className="appearance-none rounded-lg border bg-white pl-3 pr-7 py-1.5 text-sm font-bold" style={{ color: "var(--navy)" }}>
                    {allYears.filter(y => y !== year).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </>
            )}
          </div>
        }
      />

      <PageBody>
        <div className="mb-5 grid gap-3 grid-cols-2 sm:grid-cols-4">
          {[
            { id: "all", label: "ASSETS TRACKED",      value: kpiTotal, Icon: Database },
            { id: "s1",  label: "SCOPE 1 SOURCES",     value: kpiS1,    Icon: Flame },
            { id: "s2",  label: "SCOPE 2 CONNECTIONS", value: kpiS2,    Icon: Zap },
            { id: "fac", label: "FACILITIES COVERED",  value: kpiFac,   Icon: Building2 },
          ].map(t => {
            const active = kpi === t.id || (t.id === "all" && !kpi);
            return (
              <button key={t.id} onClick={() => setKpi(kpi === t.id || t.id === "all" ? null : t.id)}
                className={`rounded-xl border p-4 text-left transition-all ${active ? "border-[#1E6F5C] bg-[#E6F4EF]" : "bg-white hover:shadow-sm"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{t.label}</span>
                  <t.Icon className={`h-4 w-4 ${active ? "text-[#1E6F5C]" : "text-muted-foreground"}`} />
                </div>
                <div className="mt-1 text-3xl font-bold tabular-nums" style={{ color: "var(--navy)" }}>{t.value}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {active ? "Filter active — click to clear" : "Click to filter"}
                </div>
              </button>
            );
          })}
        </div>

        {selectedFacility && (
          <div className="mb-4 flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-[#1E6F5C] bg-[#E6F4EF] pl-3 pr-2 py-1 text-xs font-semibold text-[#1E6F5C]">
              <MapPin className="h-3 w-3" />
              <span>Filtered: {selectedFacility}</span>
              <button onClick={() => setSelectedFacility(null)}
                className="ml-1 rounded-full hover:bg-[#1E6F5C] hover:text-white p-0.5 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground">All three views are showing this facility only.</span>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search asset ID or name…"
              className="w-full rounded-lg border bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6F5C]" />
          </div>
          {[
            { label: "Facility", value: selectedFacility ?? "All", set: (v: string) => setSelectedFacility(v === "All" ? null : v), opts: ["All", ...facilityOpts] },
            { label: "Scope",    value: fScope,  set: setFScope,  opts: ["All", "Scope 1", "Scope 2", "Renewables"] },
            { label: "Status",   value: fStatus, set: setFStatus, opts: ["All", "Active", "Standby", "Decommissioned"] },
            { label: "Fuel",     value: fFuel,   set: setFuel,    opts: ["All", ...fuelOpts] },
          ].map(({ label, value, set, opts }) => (
            <div key={label} className="relative">
              <select value={value} onChange={e => set(e.target.value)}
                className={`appearance-none rounded-lg border bg-white pl-2.5 pr-6 py-2 text-sm font-medium transition-colors ${value === "All" ? "text-muted-foreground" : "border-[#1E6F5C] text-[#1E6F5C]"}`}>
                {opts.map(o => <option key={o} value={o}>{label}: {o}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            </div>
          ))}
        </div>

        <div className="mb-5 flex gap-6 border-b">
          {([
            { id: "register",    label: "Register" },
            { id: "leaderboard", label: "Leaderboard" },
            { id: "compare",     label: "Compare facilities" },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => setView(id)}
              className={`pb-2.5 text-sm font-semibold transition-colors ${
                view === id ? "border-b-2 border-[#1E6F5C] text-[#1E6F5C]" : "text-muted-foreground hover:text-[var(--navy)]"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ═══ REGISTER VIEW ═══ */}
        {view === "register" && (
          <div className="rounded-xl border bg-white overflow-hidden">
            {allAssets.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No assets loaded — data will appear once connected to the database.</div>
            ) : [
              { label: "Stationary Combustion", rows: stationary,  scope: "Scope 1",    unit: "tCO2e" },
              { label: "Mobile Sources",         rows: mobile,      scope: "Scope 1",    unit: "tCO2e" },
              { label: "Fugitive Sources",        rows: fugitive,    scope: "Scope 1",    unit: "tCO2e" },
              { label: "Electricity",             rows: electricity, scope: "Scope 2",    unit: "tCO2e" },
              { label: "Renewables (offsets)",    rows: renewable,   scope: "Renewables", unit: "MWh"   },
            ].filter(g => kpi !== "s1" || g.scope === "Scope 1")
             .filter(g => kpi !== "s2" || g.scope === "Scope 2")
             .map((g, idx, arr) => (
              <div key={g.label} className={idx < arr.length - 1 ? "border-b" : ""}>
                <SectionHeader scope={g.scope} sub={g.label} count={g.rows.length} unit={g.unit} />
                <AssetTable rows={g.rows} fy={year} compareMode={compareMode} compareFy={compareFyFinal}
                  allYears={allYears} onAsset={(id) => setDrawer(id)} />
              </div>
            ))}
          </div>
        )}

        {/* ═══ LEADERBOARD VIEW ═══ */}
        {view === "leaderboard" && (
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-[var(--muted)] px-5 py-3">
              <div>
                <div className="font-semibold text-sm text-[var(--navy)]">
                  Top Emitters — {year}{selectedFacility ? ` · ${selectedFacility}` : ""}
                </div>
                {lbSel && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Trend for selected item ·{" "}
                    <button onClick={() => setLbSel(null)} className="text-[#D90429] hover:underline font-semibold">Clear</button>
                  </div>
                )}
              </div>
              <div className="flex gap-1 rounded-lg bg-white border p-0.5">
                {(["asset", "facility"] as const).map(m => (
                  <button key={m} onClick={() => { setLbMode(m); setLbSel(null); }}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${lbMode === m ? "bg-[var(--navy)] text-white" : "text-muted-foreground hover:text-[var(--navy)]"}`}>
                    By {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col md:flex-row">
              <div className="md:w-80 divide-y border-r overflow-y-auto max-h-[520px]">
                {(lbMode === "asset" ? topAssets : topFacilities.map(f => ({
                  id: f.name, name: f.name, entity: f.entity, facility: "",
                  health: "Monitor", unit: "tCO2e", scope: "Scope 1", sub_type: "Stationary",
                  fuel: "", status: "Active", series: { [year]: f.co2 },
                } as DecarbAsset))).map((item, i) => {
                  const key  = lbMode === "asset" ? item.id : item.name;
                  const v    = seriesVal(item, year) ?? 0;
                  const isSel = lbSel === key;
                  return (
                    <button key={key} onClick={() => setLbSel(isSel ? null : key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${isSel ? "bg-[#E6F4EF]" : "hover:bg-[var(--muted)]"}`}>
                      <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                        i === 0 ? "bg-[var(--navy)] text-white" : i < 3 ? "bg-[#E6F4EF] text-[#1E6F5C]" : "bg-[var(--muted)] text-muted-foreground"
                      }`}>{i + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[var(--navy)]">{item.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {lbMode === "asset" && <span className="text-[10px] text-muted-foreground">{item.facility}</span>}
                          <EntityChip e={item.entity} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tabular-nums text-sm font-bold text-[var(--navy)]">{v.toFixed(1)}</div>
                        <div className="text-[9px] text-muted-foreground">tCO2e</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex-1 p-5">
                <div className="mb-2 text-xs font-semibold text-[var(--navy)]">
                  {lbSel ? `${lbSel} — trend (tCO2e)` : `All ${lbMode === "asset" ? "assets" : "facilities"} — ${year} (tCO2e)`}
                </div>
                <ResponsiveContainer width="100%" height={Math.max(lbChartData.length * 36, 200)}>
                  <BarChart layout="vertical" data={lbChartData}
                    margin={{ top: 4, right: 48, bottom: 4, left: lbSel ? 40 : 160 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={lbSel ? 40 : 160} />
                    <Tooltip formatter={(v: number) => [v.toFixed(1), "tCO2e"]} />
                    <Bar dataKey="value" fill="#1E6F5C" radius={[0, 3, 3, 0]}
                      label={{ position: "right", fontSize: 10, formatter: (v: number) => v.toFixed(1) }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ═══ COMPARE FACILITIES VIEW ═══ */}
        {view === "compare" && (
          <div>
            <div className="mb-4 flex flex-wrap gap-2 overflow-x-auto pb-2">
              {facilityCards.map(fc => (
                <FacilityCard key={fc.name} facility={fc.name} entity={fc.entity}
                  total={fc.co2} pct={fc.pct} assets={fc.count} sparkValues={fc.trend}
                  selected={selectedFacilities.includes(fc.name)}
                  onClick={() => setSelectedFacilities(prev =>
                    prev.includes(fc.name) ? prev.filter(x => x !== fc.name) : [...prev, fc.name]
                  )} />
              ))}
              {selectedFacilities.length > 0 && (
                <button onClick={() => setSelectedFacilities([])}
                  className="self-center rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground hover:text-[#D90429]">
                  Clear selection
                </button>
              )}
            </div>

            <div className="rounded-xl border bg-white p-5">
              <div className="mb-3 text-sm font-semibold text-[var(--navy)]">Facility trend — stacked tCO2e by year</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={compareBarData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <XAxis dataKey="fy" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {compareFacilities.map((fac, i) => (
                    <Bar key={fac} dataKey={fac} stackId="a" fill={COMPARE_COLORS[i % COMPARE_COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </PageBody>

      {drawerAsset && <AssetDrawer asset={drawerAsset} fy={year} onClose={() => setDrawer(null)} />}
    </>
  );
}
