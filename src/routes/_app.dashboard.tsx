import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageBody, PageHeader, StatCard, Section, Card, fmt } from "@/components/portal";
import { useClientContext } from "@/lib/client-context";
import {
  useInventory, useS1Breakdown, useS2ByFacility, useS1ByFacility,
  useS3Summary, useGridMWh, useIRECRegister, useIntensity, getVal,
  type S1BreakdownRow,
} from "@/lib/api";
import { useEntity, useFiscalYear } from "@/lib/entity";
import {
  PieChart, Pie, Cell, Sector, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, LabelList,
} from "recharts";
import { DNF } from "@/components/decarb/shared";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

/* ── Palette ─────────────────────────────────────────────────────────────── */
const INK = "#1F2937", MID = "#6B7280";
const CYAN = "#0EA5E9", GOLD = "#D97706", EMERALD = "#16A34A", AMBER = "#F59E0B";
const BASE = CYAN, GREEN = EMERALD, RED = "#D90429";
const S1_COLOR = "#1E6F5C", S2_COLOR = "#3B82F6", S3_COLOR = "#64748B";
const OV_TREND_PAL = ["#CBD5E1", "#64748B", "#3B82F6", "#1E6F5C", "#F59E0B"];
const OV_S3_BAR    = ["#1E6F5C","#3B82F6","#64748B","#22C55E","#F59E0B","#0EA5E9","#D97706","#16A34A","#CBD5E1","#6B7280"];
const FUEL_PALETTE = ["#1E6F5C","#3B82F6","#64748B","#22C55E","#F59E0B","#0EA5E9","#D97706"];
const S2_FAC_PALETTE = ["#1E6F5C","#3B82F6","#64748B","#22C55E","#F59E0B","#D97706","#0EA5E9"];
const S3_PALETTE   = ["#1E6F5C","#3B82F6","#64748B","#22C55E","#F59E0B","#0EA5E9","#D97706","#16A34A","#CBD5E1","#6B7280"];

/* ── CEA grid emission factor (kgCO₂/kWh) ─────────────────────────────── */
const CEA_EF = 0.727;

/* ── Formatters ──────────────────────────────────────────────────────────── */
const f2 = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtCons(value: number, unit: string): string {
  if (unit === "L")  return `${(value / 1000).toFixed(2)} kL`;
  if (unit === "kg") return `${(value / 1000).toFixed(3)} t`;
  return `${value.toFixed(2)} ${unit}`;
}
const pct = (cur: number, prev: number) => ((cur - prev) / prev) * 100;

/* ── Donut active shape ──────────────────────────────────────────────────── */
function DonutActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 10}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
        style={{ filter: "drop-shadow(0px 4px 10px rgba(30,64,175,0.35))", cursor: "pointer" }} />
      <text x={cx} y={cy - 14} textAnchor="middle" fill={INK} style={{ fontSize: 12, fontWeight: 700 }}>{payload.name}</text>
      <text x={cx} y={cy + 4}  textAnchor="middle" fill={S1_COLOR} style={{ fontSize: 15, fontWeight: 900 }}>{(percent * 100).toFixed(1)}%</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fill={MID} style={{ fontSize: 10 }}>
        {value.toLocaleString("en-IN", { maximumFractionDigits: 0 })} tCO2e
      </text>
    </g>
  );
}

/* ── Shared sub-components ───────────────────────────────────────────────── */
function ChartBand({ title }: { title: string }) {
  return <div className="rounded-t-xl px-4 py-2.5 text-sm font-semibold" style={{ background: "#F5F5F5", color: INK }}>{title}</div>;
}
function PendingNote({ year }: { year: string }) {
  return (
    <div className="mb-4 rounded-lg border border-dashed bg-[var(--muted)] px-4 py-3 text-sm text-muted-foreground">
      {year} data collection for this entity is still in progress — figures shown as N/A will appear once the inventory is finalised.
    </div>
  );
}

/* ── Scope 3 category short labels ──────────────────────────────────────── */
const S3_CAT_FULL: Record<number, string> = {
  1: "Purchased Goods & Services",     2: "Capital Goods",
  3: "Fuel & Energy-Related",          4: "Upstream Transportation",
  5: "Waste in Operations",            6: "Business Travel",
  7: "Employee Commuting",             9: "Downstream Transportation",
  11: "Use of Sold Products",         12: "End-of-Life Treatment",
};

/* ── CatKPIStrip ─────────────────────────────────────────────────────────── */
function CatKPIStrip({ catNum, label, color, items }: {
  catNum: number; label: string; color: string;
  items: { label: string; value: string; unit?: string }[];
}) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: color + "22", borderBottom: `2px solid ${color}` }}>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: color }}>Cat {catNum}</span>
        <span className="font-bold text-sm" style={{ color: INK }}>{label}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0">
        {items.map((item, i) => (
          <div key={i} className="px-4 py-3">
            <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: MID }}>{item.label}</div>
            <div className="text-lg font-bold tabular-nums leading-tight" style={{ color: INK }}>{item.value}</div>
            {item.unit && <div className="text-[10px]" style={{ color: MID }}>{item.unit}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ════════════════════════════════════════════════════════════════════════════ */
function OverviewTab({ year }: { year: string }) {
  const { entity } = useEntity();
  const { entities, reporting_years } = useClientContext();
  const consolidatedCode = entities.find(e => e.is_consolidated)?.code;
  const { data: invData }       = useInventory(entity);
  const { data: intensityData } = useIntensity(entity);
  const { data: gridData }      = useGridMWh();
  const { data: irecData }      = useIRECRegister();
  const [activeDonutIdx, setActiveDonutIdx] = useState<number | null>(null);

  const inv = (metric: string, fy: string) => getVal(invData, metric, fy);

  const s1kpi  = inv("Scope 1", year) ?? 0;
  const s2kpi  = inv("Scope 2 LB", year) ?? 0;
  const s3kpi  = inv("Scope 3 Total", year) ?? 0;
  const totKpi = s1kpi + s2kpi + s3kpi;

  const gridMWhForEntity = useMemo(() => {
    if (!gridData) return 0;
    if (entity === consolidatedCode) {
      return Object.values(gridData as Record<string, Record<string, number>>)
        .reduce((s, byYear) => s + (byYear[year] ?? 0), 0);
    }
    return ((gridData as Record<string, Record<string, number>>)[entity]?.[year]) ?? 0;
  }, [gridData, entity, year, consolidatedCode]);

  const irecMWhForYear = useMemo(() =>
    (irecData ?? []).filter(r => r.fy === year && r.status === "Retired")
      .reduce((s, r) => s + r.mwh, 0), [irecData, year]);

  const reMwh      = irecMWhForYear;
  const reSharePct = gridMWhForEntity > 0 ? ((reMwh / gridMWhForEntity) * 100).toFixed(2) : null;

  const incomplete = s1kpi === 0 && s2kpi === 0;

  const trendData = reporting_years
    .map(y => ({ year: y, emissions: inv("Grand Total LB", y) }))
    .filter((r): r is { year: string; emissions: number } => r.emissions !== null);

  const intensityChartData = (intensityData ?? [])
    .filter((r: any) => r.s12LB != null && r.revenueLakh != null)
    .map((r: any) => ({ year: r.fy, intensity: +(r.s12LB / r.revenueLakh).toFixed(6) }));

  const donut = [
    { name: "Scope 1",    value: s1kpi, color: S1_COLOR },
    { name: "Scope 2 LB", value: s2kpi, color: S2_COLOR },
    { name: "Scope 3",    value: s3kpi, color: S3_COLOR },
  ];
  const donutTotal = donut.reduce((a, d) => a + d.value, 0);

  const catIds = [1,2,3,4,5,6,7,9,11,12];
  const catbar = catIds
    .map(id => ({ name: `Cat ${id}`, label: S3_CAT_FULL[id] ?? `Cat ${id}`, val: inv(`Cat ${id}`, year) }))
    .filter((c): c is typeof c & { val: number } => c.val !== null && c.val > 0)
    .sort((a, b) => b.val - a.val);
  const s3Total = inv("Scope 3 Total", year) ?? 1;

  const kpiCards = [
    { label: "Total Emissions",       value: totKpi.toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 }), unit: "tCO2e",   color: RED },
    { label: "Scope 1 Emissions",     value: s1kpi.toLocaleString("en-IN",  { minimumFractionDigits:2, maximumFractionDigits:2 }), unit: "tCO2e",   color: AMBER },
    { label: "Scope 2 LB Emissions",   value: s2kpi.toLocaleString("en-IN",  { minimumFractionDigits:3, maximumFractionDigits:3 }), unit: "tCO2e",   color: CYAN },
    { label: "Renewable Energy",      value: reMwh > 0 ? reMwh.toLocaleString("en-IN") : "—",                                     unit: "MWh",     color: GREEN },
    { label: "Renewable Energy Share",value: reSharePct !== null ? `${reSharePct} %` : "—",                                       unit: "",        color: GREEN },
  ];

  return (
    <>
      {incomplete && <PendingNote year={year} />}

      <Section title={`GHG Overview — ${year}`} subtitle="Scope 1 · Scope 2 location-based · RE from I-RECs and on-site renewables">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpiCards.map((c, i) => (
            <div key={i} className="rounded-xl border bg-white p-4" style={{ borderLeft: `4px solid ${c.color}` }}>
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{c.label}</div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: INK }}>{c.value}</div>
              {c.unit && <div className="text-[10px] text-muted-foreground">{c.unit}</div>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Emissions trend & intensity">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-white overflow-hidden">
            <ChartBand title="Yearly Emissions Trend" />
            <div className="p-4">
              <div className="text-xs text-muted-foreground mb-3">Total footprint (tCO2e) · location-based · all scopes</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trendData} margin={{ top:28, right:16, left:0, bottom:0 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize:10, fill:MID }} height={30} />
                  <YAxis tick={{ fontSize:9, fill:MID }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} width={46} />
                  <Tooltip formatter={(v: number) => [v.toLocaleString("en-IN", { minimumFractionDigits:2 }) + " tCO2e", "Total"]} />
                  <Bar dataKey="emissions" radius={[4,4,0,0]}>
                    {trendData.map((_, i) => <Cell key={i} fill={OV_TREND_PAL[i % OV_TREND_PAL.length]} />)}
                    <LabelList dataKey="emissions" position="top" style={{ fontSize:9, fontWeight:700, fill:INK }}
                      formatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(1)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden">
            <ChartBand title="Yearly Emission Intensity" />
            <div className="p-4">
              <div className="text-xs text-muted-foreground mb-3">Scope 1+2 (location-based) tCO2e per unit of revenue</div>
              {intensityChartData.length === 0 ? (
                <DNF block label="Intensity data will appear once revenue figures are in the database." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={intensityChartData} margin={{ top:12, right:24, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                    <XAxis dataKey="year" tick={{ fontSize:10, fill:MID }} height={30} />
                    <YAxis tick={{ fontSize:9, fill:MID }} tickFormatter={v => v.toFixed(4)} width={56} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(5)}`, "Intensity"]} />
                    <Line dataKey="intensity" stroke={S1_COLOR} strokeWidth={2.5}
                      dot={{ r:5, fill:"white", stroke:S1_COLOR, strokeWidth:2 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Scope composition & value chain">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-white overflow-hidden">
            <ChartBand title={`Scope Composition — ${year}`} />
            <div className="p-4">
              <div className="text-xs text-muted-foreground mb-2">Share of total location-based footprint</div>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={donut} cx="50%" cy="50%" innerRadius={55} outerRadius={82}
                    dataKey="value" paddingAngle={3}
                    activeIndex={activeDonutIdx ?? undefined}
                    activeShape={activeDonutIdx !== null ? DonutActiveShape : undefined}
                    onMouseEnter={(_, idx) => setActiveDonutIdx(idx)}
                    onMouseLeave={() => setActiveDonutIdx(null)}>
                    {donut.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" style={{ cursor:"pointer" }} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                {donut.map(d => (
                  <div key={d.name} className="rounded-lg py-2 px-1" style={{ background: d.color + "22" }}>
                    <div className="font-bold tabular-nums text-base" style={{ color: INK }}>{donutTotal > 0 ? ((d.value / donutTotal) * 100).toFixed(1) : "0"}%</div>
                    <div className="text-[10px] font-semibold" style={{ color: d.color }}>{d.name.replace(" LB","")}</div>
                    <div className="text-[10px]" style={{ color: MID }}>{d.value.toLocaleString("en-IN", { maximumFractionDigits:0 })} tCO2e</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden">
            <ChartBand title="Scope 3 — Category Contribution" />
            <div className="p-4">
              <div className="text-xs text-muted-foreground mb-2">{year} · calculated categories · tCO2e</div>
              {catbar.length === 0
                ? <div className="py-8 text-center text-sm text-muted-foreground">No Scope 3 data for {year}.</div>
                : (
                  <ResponsiveContainer width="100%" height={Math.max(200, catbar.length * 30)}>
                    <BarChart data={catbar} layout="vertical" margin={{ top:4, right:64, left:4, bottom:0 }} barCategoryGap="18%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize:9, fill:MID }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize:10, fill:INK }} width={135} interval={0} />
                      <Tooltip formatter={(v: number) => [`${v.toLocaleString("en-IN", { minimumFractionDigits:2 })} tCO2e · ${((v/s3Total)*100).toFixed(1)}% of S3`, ""]} />
                      <Bar dataKey="val" radius={[0,4,4,0]}>
                        {catbar.map((_, i) => <Cell key={i} fill={OV_S3_BAR[i % OV_S3_BAR.length]} />)}
                        <LabelList dataKey="val" position="right" style={{ fontSize:9, fontWeight:700, fill:INK }}
                          formatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(1)} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SCOPE 1 TAB
   ════════════════════════════════════════════════════════════════════════════ */
function Scope1Tab({ year }: { year: string }) {
  const { entity } = useEntity();
  const { data: invData }    = useInventory(entity);
  const { data: s1BdData }   = useS1Breakdown(entity);
  const { data: s1FacData }  = useS1ByFacility(entity);
  const inv = (metric: string, fy: string) => getVal(invData, metric, fy);

  const stationary = (s1BdData ?? []).filter((r: S1BreakdownRow) => r.source === "Stationary")
    .reduce((s: number, r: S1BreakdownRow) => s + (r.series[year] ?? 0), 0);
  const mobile     = (s1BdData ?? []).filter((r: S1BreakdownRow) => r.source === "Mobile")
    .reduce((s: number, r: S1BreakdownRow) => s + (r.series[year] ?? 0), 0);
  const fugitive   = (s1BdData ?? []).filter((r: S1BreakdownRow) => r.source === "Fugitive")
    .reduce((s: number, r: S1BreakdownRow) => s + (r.series[year] ?? 0), 0);
  const s1Total    = inv("Scope 1", year) ?? (stationary + mobile + fugitive);

  const facilityData = useMemo(() => {
    if (!s1FacData) return [];
    const map = new Map<string, { stationary: number; mobile: number; fugitive: number }>();
    for (const row of s1FacData) {
      const prev = map.get(row.facility) ?? { stationary: 0, mobile: 0, fugitive: 0 };
      const v = row.series[year] ?? 0;
      if (row.sub_type === "Stationary") map.set(row.facility, { ...prev, stationary: prev.stationary + v });
      else if (row.sub_type === "Mobile") map.set(row.facility, { ...prev, mobile: prev.mobile + v });
      else map.set(row.facility, { ...prev, fugitive: prev.fugitive + v });
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, total: v.stationary + v.mobile + v.fugitive }))
      .filter(d => d.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [s1FacData, year]);

  return (
    <>
      <Section title={`Scope 1 — Direct Emissions — ${year}`} subtitle="Stationary combustion · Mobile combustion · Fugitive emissions">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Scope 1 Total"          value={f2(s1Total)}    unit="tCO2e" />
          <StatCard label="Stationary Combustion"  value={f2(stationary)} unit="tCO2e" />
          <StatCard label="Mobile Combustion"      value={f2(mobile)}     unit="tCO2e" />
          <StatCard label="Fugitive Emissions"     value={f2(fugitive)}   unit="tCO2e" />
        </div>
      </Section>

      <Section title="Consumption & monthly trend">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="text-[15px] font-semibold text-[var(--navy)] mb-1">Fuel Consumption by Type</div>
            <div className="text-xs text-muted-foreground mb-3">Raw consumption before GWP conversion</div>
            <DNF block label="Granular fuel consumption detail will be available once the fuel register API is connected." />
          </Card>
          <Card>
            <div className="text-[15px] font-semibold text-[var(--navy)] mb-1">Monthly Scope 1 Distribution</div>
            <div className="text-xs text-muted-foreground mb-3">Monthly breakdown by emission type</div>
            <DNF block label="Monthly data will appear once the monthly reporting API is connected." />
          </Card>
        </div>
      </Section>

      <Section title="Emissions profile">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="text-[15px] font-semibold text-[var(--navy)] mb-1">Emissions by Fuel / Agent Type</div>
            <div className="text-xs text-muted-foreground mb-3">tCO2e by fuel type</div>
            <DNF block label="Fuel-type breakdown will appear once the asset register API is fully connected." />
          </Card>

          <Card>
            <div className="text-[15px] font-semibold text-[var(--navy)] mb-1">Facility-wise Scope 1 Emissions</div>
            <div className="text-xs text-muted-foreground mb-3">{year} — tCO2e</div>
            {facilityData.length === 0
              ? <DNF block label="Facility data will appear once the S1 by-facility API is connected." />
              : (
                <ResponsiveContainer width="100%" height={Math.max(220, facilityData.length * 36)}>
                  <BarChart data={facilityData} layout="vertical" margin={{ top:4, right:60, left:4, bottom:4 }} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize:9, fill:MID }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:INK }} width={120} interval={0} />
                    <Tooltip content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div className="rounded-lg border bg-white p-2.5 text-xs shadow-lg">
                          <div className="mb-1 font-bold" style={{ color: INK }}>{label}</div>
                          <div>Stationary: <b>{d.stationary.toFixed(2)} tCO2e</b></div>
                          <div>Mobile: <b>{d.mobile.toFixed(2)} tCO2e</b></div>
                          <div>Fugitive: <b>{d.fugitive.toFixed(2)} tCO2e</b></div>
                          <div className="mt-1 border-t pt-1 font-semibold">Total: {d.total.toFixed(2)} tCO2e</div>
                        </div>
                      );
                    }} />
                    <Bar dataKey="total" fill={S1_COLOR} radius={[0,4,4,0]}>
                      <LabelList dataKey="total" position="right" style={{ fontSize:9, fill:INK }}
                        formatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(1)} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
          </Card>
        </div>
      </Section>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SCOPE 2 — Waterfall
   ════════════════════════════════════════════════════════════════════════════ */
type S2Bd = { lb: number; mb: number; gridMwh: number; reMwh: number };

function S2WaterfallChart({ entity, bd }: { entity: string; bd: S2Bd }) {
  const totalAvoid = bd.lb - bd.mb;
  type WFStep = { name: string; spacer: number; val: number; fill: string; isReduction: boolean };
  const steps: WFStep[] = [
    { name: "Grid Baseline",  spacer: 0,              val: bd.lb,         fill: "#3B82F6", isReduction: false },
    ...(totalAvoid > 0.001 ? [{ name: "(−) I-RECs",   spacer: bd.mb,      val: totalAvoid, fill: "#D97706", isReduction: true  }] : []),
    { name: "= Market-Based", spacer: 0,              val: bd.mb,         fill: "#16A34A", isReduction: false },
  ];
  const WFLabel = (props: any) => {
    const { x, y, width, index, value } = props;
    const step = steps[index];
    if (!step) return null;
    const label = step.isReduction ? `−${f2(value)}` : (value < 0.001 ? "0" : f2(value));
    return <text x={(x ?? 0) + (width ?? 0) / 2} y={(y ?? 0) - 6} textAnchor="middle" fontSize={10} fill={step.fill} fontWeight={700}>{label}</text>;
  };
  return (
    <Card>
      <div className="text-[15px] font-semibold text-[var(--navy)] mb-1">Emissions Avoided — Waterfall</div>
      <div className="text-xs text-muted-foreground mb-3">Grid baseline → market-based · tCO2e</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={steps.map(s => ({ name: s.name, spacer: s.spacer, value: s.val }))}
          margin={{ top:24, right:8, left:0, bottom:40 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize:9, fill:MID }} angle={-20} textAnchor="end" interval={0} height={52} />
          <YAxis tick={{ fontSize:9, fill:MID }} tickFormatter={v => String(v)} width={52} />
          <Tooltip content={({ active, payload, label }: any) => {
            if (!active || !payload?.length) return null;
            const p = payload.find((x: any) => x.dataKey === "value");
            if (!p) return null;
            return <div className="rounded-lg border bg-white p-2.5 text-xs shadow-lg"><div className="font-bold mb-0.5" style={{ color:INK }}>{label}</div><div>{f2(p.value)} tCO2e</div></div>;
          }} />
          <Bar dataKey="spacer" stackId="a" fill="transparent" stroke="none" isAnimationActive={false} />
          <Bar dataKey="value"  stackId="a" radius={[3,3,0,0]} isAnimationActive={false}>
            {steps.map((d, i) => <Cell key={i} fill={d.fill} />)}
            <LabelList content={WFLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/* ── Scope 2 Energy Intensity ────────────────────────────────────────────── */
function S2EnergyIntensityChart({ entity }: { entity: string }) {
  const { data: intensityData } = useIntensity(entity);
  const { data: gridData }      = useGridMWh();

  const data = useMemo(() => {
    if (!intensityData || !gridData) return [];
    const entityGrid = (gridData as Record<string, Record<string, number>>)[entity] ?? {};
    return (intensityData ?? [])
      .filter((r: any) => r.productionUnits && r.productionUnits > 0)
      .map((r: any) => {
        const gridKwh = (entityGrid[r.fy] ?? 0) * 1000;
        const kwh     = gridKwh > 0 ? gridKwh : ((r.s12LB ?? 0) * 1000) / CEA_EF;
        if (!kwh) return null;
        return { fy: r.fy, intensity: +(kwh / r.productionUnits).toFixed(4), kwh: Math.round(kwh), units: r.productionUnits };
      })
      .filter(Boolean) as { fy: string; intensity: number; kwh: number; units: number }[];
  }, [intensityData, gridData, entity]);

  if (data.length === 0) {
    return (
      <Card>
        <div className="text-[15px] font-semibold text-[var(--navy)] mb-1">Energy Intensity</div>
        <div className="text-xs text-muted-foreground mb-3">Electricity consumed per unit produced</div>
        <DNF block label="Intensity data will appear once production unit data is in the database." />
      </Card>
    );
  }

  const minVal    = Math.min(...data.map(d => d.intensity));
  const improving = data.length >= 2 && data[data.length-1].intensity < data[0].intensity;
  return (
    <Card>
      <div className="text-[15px] font-semibold text-[var(--navy)] mb-1">Energy Intensity</div>
      <div className="text-xs text-muted-foreground mb-1">Electricity per unit produced · kWh / unit</div>
      {improving && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EF] px-3 py-1 text-xs font-semibold text-[#1E6F5C]">
          ↓ Improving — {((1 - data[data.length-1].intensity / data[0].intensity) * 100).toFixed(1)}% reduction {data[0].fy}→{data[data.length-1].fy}
        </div>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top:8, right:16, left:0, bottom:0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" vertical={false} />
          <XAxis dataKey="fy" tick={{ fontSize:10, fill:MID }} />
          <YAxis tick={{ fontSize:9, fill:MID }} tickFormatter={v => v.toFixed(2)} width={44} domain={[0,"auto"]} />
          <Tooltip formatter={(v: number, _n: string, p: any) => [`${v.toFixed(4)} kWh/unit`, `${(p.payload.kwh/1000).toFixed(1)} MWh · ${p.payload.units.toLocaleString("en-IN")} units`]} />
          <Bar dataKey="intensity" radius={[4,4,0,0]}>
            {data.map(entry => <Cell key={entry.fy} fill={entry.intensity === minVal ? "#16A34A" : "#3B82F6"} fillOpacity={entry.intensity === minVal ? 1 : 0.75} />)}
            <LabelList dataKey="intensity" position="top" formatter={(v: number) => v.toFixed(3)} style={{ fontSize:9, fill:MID, fontWeight:600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SCOPE 2 TAB
   ════════════════════════════════════════════════════════════════════════════ */
function Scope2Tab({ year }: { year: string }) {
  const { entity } = useEntity();
  const { entities, reporting_years } = useClientContext();
  const consolidatedCode = entities.find(e => e.is_consolidated)?.code;
  const { data: invData }    = useInventory(entity);
  const { data: s2FacData }  = useS2ByFacility(entity);
  const { data: gridData }   = useGridMWh();
  const { data: irecData }   = useIRECRegister();
  const inv = (metric: string, fy: string) => getVal(invData, metric, fy);

  const s2lb = inv("Scope 2 LB", year) ?? 0;
  const s2mb = inv("Scope 2 MB", year) ?? 0;

  const gridMWhForYear = useMemo(() => {
    if (!gridData) return 0;
    if (entity === consolidatedCode) {
      return Object.values(gridData as Record<string, Record<string, number>>)
        .reduce((s, byYear) => s + (byYear[year] ?? 0), 0);
    }
    return ((gridData as Record<string, Record<string, number>>)[entity]?.[year]) ?? 0;
  }, [gridData, entity, year, consolidatedCode]);

  const irecMwhForYear = useMemo(() =>
    (irecData ?? []).filter(r => r.fy === year && r.status === "Retired")
      .reduce((s, r) => s + r.mwh, 0), [irecData, year]);

  const bd: S2Bd = { lb: s2lb, mb: s2mb, gridMwh: gridMWhForYear, reMwh: irecMwhForYear };

  const facData = useMemo(() => {
    if (!s2FacData) return [];
    return s2FacData
      .map(f => ({ name: f.facility, value: f.series[year] ?? 0, entity: f.entity }))
      .filter(f => f.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [s2FacData, year]);

  const prevY = reporting_years[Math.max(0, reporting_years.indexOf(year) - 1)];
  const s2prev = inv("Scope 2 LB", prevY ?? "");

  return (
    <>
      <Section title={`Scope 2 — Purchased Electricity — ${year}`} subtitle="CEA grid EF · I-RECs applied · on-site renewables">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Scope 2 (Location-Based)" value={f2(s2lb)} unit="tCO2e"
            delta={s2lb > 0 && s2prev ? { pct: pct(s2lb, s2prev), direction: s2lb < s2prev ? "down" : "up", good: s2lb < s2prev } : undefined} />
          <StatCard label="Scope 2 (Market-Based)"  value={f2(s2mb)} unit="tCO2e" tone={s2mb === 0 ? "success" : "default"} />
          <StatCard label="Total Grid Consumption"  value={gridMWhForYear > 0 ? gridMWhForYear.toLocaleString("en-IN", { minimumFractionDigits:2 }) : "—"} unit={gridMWhForYear > 0 ? "MWh" : ""} />
          <StatCard label="Renewable Energy (I-RECs)" value={irecMwhForYear > 0 ? irecMwhForYear.toLocaleString("en-IN") : "—"} unit="MWh" tone="success" />
        </div>
      </Section>

      <Section title="Electricity consumption">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="text-[15px] font-semibold text-[var(--navy)] mb-1">Electricity Consumption by Facility</div>
            <div className="text-xs text-muted-foreground mb-3">{year} — tCO2e (location-based) per site</div>
            {facData.length === 0
              ? <DNF block label="Facility-level consumption will appear once the S2 by-facility API is connected." />
              : (
                <div className="flex gap-4 items-center">
                  <ResponsiveContainer width={180} height={200}>
                    <PieChart>
                      <Pie data={facData} cx="50%" cy="50%" outerRadius={85} dataKey="value" paddingAngle={2}>
                        {facData.map((_, i) => <Cell key={i} fill={S2_FAC_PALETTE[i % S2_FAC_PALETTE.length]} />)}
                      </Pie>
                      <Tooltip content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d  = payload[0].payload;
                        const total = facData.reduce((s, f) => s + f.value, 0);
                        return (
                          <div className="rounded-lg border bg-white p-2.5 text-xs shadow-lg">
                            <div className="mb-1 font-bold" style={{ color:INK }}>{d.name}</div>
                            <div>Emissions: <b>{d.value.toFixed(2)} tCO2e</b></div>
                            <div style={{ color:MID }}>{total > 0 ? ((d.value/total)*100).toFixed(1) : "0"}% of total</div>
                          </div>
                        );
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 text-xs">
                    {facData.map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: S2_FAC_PALETTE[i % S2_FAC_PALETTE.length] }} />
                          <span className="truncate" style={{ color:INK }}>{d.name}</span>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums" style={{ color:MID }}>{d.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </Card>

          <Card>
            <div className="text-[15px] font-semibold text-[var(--navy)] mb-1">RE vs Non-RE Monthly Consumption</div>
            <div className="text-xs text-muted-foreground mb-3">Monthly kWh breakdown</div>
            <DNF block label="Monthly electricity data will appear once the monthly reporting API is connected." />
          </Card>
        </div>
      </Section>

      <Section title="Market-based accounting">
        <div className="grid gap-4 lg:grid-cols-2">
          <S2WaterfallChart entity={entity} bd={bd} />
          <S2EnergyIntensityChart entity={entity} />
        </div>
      </Section>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SCOPE 3 TAB
   ════════════════════════════════════════════════════════════════════════════ */
function Scope3Tab({ year }: { year: string }) {
  const { entity } = useEntity();
  const { reporting_years } = useClientContext();
  const { data: invData } = useInventory(entity);
  const inv = (metric: string, fy: string) => getVal(invData, metric, fy);

  const s3     = inv("Scope 3 Total", year);
  const prevY  = reporting_years[Math.max(0, reporting_years.indexOf(year) - 1)];
  const s3prev = inv("Scope 3 Total", prevY ?? "");

  const catIds = [1,2,3,4,5,6,7,9,11,12];
  const catBar = catIds
    .map(id => ({ name: S3_CAT_FULL[id] ?? `Category ${id}`, value: inv(`Cat ${id}`, year) }))
    .filter((c): c is { name: string; value: number } => c.value !== null && c.value > 0)
    .sort((a, b) => b.value - a.value);

  const total       = s3 ?? catBar.reduce((s, c) => s + c.value, 0);
  const cat1tco2e   = inv("Cat 1", year);
  const cat4tco2e   = inv("Cat 4", year);
  const cat9tco2e   = inv("Cat 9", year);

  return (
    <>
      {s3 === null && <PendingNote year={year} />}

      <Section title={`Scope 3 — Value Chain — ${year}`} subtitle="GHG Protocol — 15-category screen">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Scope 3" value={fmt(total, 2)} unit="tCO2e"
            delta={s3 !== null && s3prev ? { pct: pct(s3, s3prev), direction: s3 < s3prev ? "down" : "up", good: s3 < s3prev } : undefined} />
          <StatCard label="Cat 1 · Purchased Goods"    value={fmt(cat1tco2e, 2)} unit="tCO2e" />
          <StatCard label="Cat 9 · Downstream Freight" value={fmt(cat9tco2e, 2)} unit="tCO2e" />
          <StatCard label="Cat 4 · Upstream Freight"   value={fmt(cat4tco2e, 2)} unit="tCO2e" />
        </div>
      </Section>

      <Section title="Top categories — activity detail" subtitle="Largest Scope 3 contributors with supporting data">
        <div className="space-y-3">
          <CatKPIStrip catNum={1} label="Purchased Goods & Services" color={S1_COLOR} items={[
            { label: "Total Emissions", value: cat1tco2e !== null ? cat1tco2e.toLocaleString("en-IN", { minimumFractionDigits:2 }) : "—", unit: "tCO2e" },
            { label: "Quantity Purchased",  value: "—", unit: "awaiting data" },
            { label: "Amount Spent",        value: "—", unit: "awaiting data" },
            { label: "No. of Suppliers",    value: "—", unit: "awaiting data" },
          ]} />
          <CatKPIStrip catNum={4} label="Upstream Transportation & Distribution" color={S2_COLOR} items={[
            { label: "Total Emissions", value: cat4tco2e !== null ? cat4tco2e.toLocaleString("en-IN", { minimumFractionDigits:2 }) : "—", unit: "tCO2e" },
            { label: "Fuel Consumed",       value: "—", unit: "awaiting data" },
            { label: "Distance Transported",value: "—", unit: "awaiting data" },
            { label: "Mass of Goods",       value: "—", unit: "awaiting data" },
          ]} />
          <CatKPIStrip catNum={9} label="Downstream Transportation & Distribution" color={S3_COLOR} items={[
            { label: "Total Emissions", value: cat9tco2e !== null ? cat9tco2e.toLocaleString("en-IN", { minimumFractionDigits:2 }) : "—", unit: "tCO2e" },
            { label: "Fuel Consumed",   value: "—", unit: "awaiting data" },
            { label: "Distance",        value: "—", unit: "awaiting data" },
            { label: "Deliveries",      value: "—", unit: "awaiting data" },
          ]} />
        </div>
      </Section>

      <Section title="All categories by magnitude" subtitle={`GHG Protocol screen · tCO2e · ${year}`}>
        <Card>
          <div className="text-[15px] font-semibold text-[var(--navy)] mb-1">Scope 3 Category Breakdown</div>
          <div className="text-xs text-muted-foreground mb-3">All calculated categories sorted by emissions · tCO2e</div>
          {catBar.length === 0
            ? <DNF block label="Scope 3 category data will appear once the inventory is loaded for this year." />
            : (
              <ResponsiveContainer width="100%" height={Math.max(180, catBar.length * 32)}>
                <BarChart data={catBar} layout="vertical" margin={{ top:4, right:64, left:90, bottom:4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize:9, fill:MID }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:9, fill:INK }} width={90} />
                  <Tooltip formatter={(v: number) => [`${f2(v)} tCO2e`, "Emissions"]} />
                  <Bar dataKey="value" radius={[0,3,3,0]}>
                    {catBar.map((_, i) => <Cell key={i} fill={S3_PALETTE[i % S3_PALETTE.length]} />)}
                    <LabelList dataKey="value" position="right"
                      formatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : f2(v)}
                      style={{ fontSize:9, fill:INK }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
        </Card>
      </Section>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DASHBOARD (root)
   ════════════════════════════════════════════════════════════════════════════ */
type Tab = "overview" | "scope1" | "scope2" | "scope3";

function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const { fy: year } = useFiscalYear();
  const { entity }   = useEntity();

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "scope1",   label: "Scope 1" },
    { id: "scope2",   label: "Scope 2" },
    { id: "scope3",   label: "Scope 3" },
  ];

  return (
    <>
      <PageHeader eyebrow={`${entity} · ${year}`} title="Dashboard" description="GHG emissions inventory — Scope 1, 2 &amp; 3" />
      <PageBody>
        <div className="flex gap-0 border-b border-[var(--border)] mb-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150 ${
                tab === t.id ? "border-[#3B82F6] text-[#3B82F6]" : "border-transparent text-muted-foreground hover:text-[var(--navy)]"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === "overview" && <OverviewTab year={year} />}
        {tab === "scope1"   && <Scope1Tab   year={year} />}
        {tab === "scope2"   && <Scope2Tab   year={year} />}
        {tab === "scope3"   && <Scope3Tab   year={year} />}
      </PageBody>
    </>
  );
}

export default Dashboard;
