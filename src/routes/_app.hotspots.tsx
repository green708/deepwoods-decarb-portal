import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  Treemap, AreaChart, Area, CartesianGrid,
} from "recharts";
import {
  Flame, Zap, TrendingUp, TrendingDown, ArrowRight, X, AlertTriangle, Activity,
} from "lucide-react";
import {
  PageHeader, Card, CardHeader, HowToRead, ScopeBadge, DNF, fmt,
} from "@/components/decarb/shared";
import { useClientContext } from "@/lib/client-context";
import {
  useInventory, useS3Summary, useS1ByFacility, useS2ByFacility,
  useFacilities, useDecarbAssets, useIntensity, getVal,
  type S1ByFacilityRow, type S2ByFacilityRow, type DecarbAsset,
} from "@/lib/api";
import { useEntity, useFiscalYear } from "@/lib/entity";

export const Route = createFileRoute("/_app/hotspots")({ component: HotspotPage });

// ── Helpers ───────────────────────────────────────────────────────────────────

const scopeColor = (s: 1 | 2 | 3) =>
  s === 1 ? "var(--scope1)" : s === 2 ? "var(--scope2)" : "var(--scope3)";

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((d, i) => `${(i / (data.length - 1)) * 60},${20 - ((d - min) / range) * 18}`)
    .join(" ");
  const rising = data[data.length - 1] > data[0];
  return (
    <svg width={60} height={20} className="inline-block">
      <polyline fill="none" strokeWidth={1.5}
        stroke={rising ? "var(--critical)" : "var(--success)"} points={pts} />
    </svg>
  );
}

// ── HealthBadge ───────────────────────────────────────────────────────────────

function HealthBadge({ h }: { h: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    efficient: { bg: "var(--success-bg)", fg: "var(--success)" },
    monitor:   { bg: "var(--warning-bg)", fg: "var(--warning)" },
    replace:   { bg: "var(--critical-bg)", fg: "var(--critical)" },
  };
  const s = map[h] ?? map.monitor;
  const label = h === "replace" ? "Replace/Upgrade" : h === "monitor" ? "Monitor" : "Efficient";
  return (
    <span className="rounded px-2 py-[2px] text-[10px] font-semibold uppercase"
      style={{ backgroundColor: s.bg, color: s.fg }}>{label}</span>
  );
}

// ── FacilityCard ──────────────────────────────────────────────────────────────

type FacilitySummary = {
  name: string;
  entity: string;
  s1: number;
  s2: number;
  yoyPct: number | null;
};

function FacilityCard({ f, onOpen }: { f: FacilitySummary; onOpen: () => void }) {
  const total = f.s1 + f.s2;
  const s1Pct = total > 0 ? (f.s1 / total) * 100 : 50;
  const heat = Math.min(1, total / 500);
  const bg = `linear-gradient(135deg, #fff 0%, rgba(254,226,226,${heat * 0.6}) 100%)`;

  return (
    <button onClick={onOpen}
      className="group flex flex-col rounded-xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: bg }}>
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-[color:var(--ink)]">{f.name}</div>
          <div className="text-[11px] text-[color:var(--ink-muted)]">{f.entity}</div>
        </div>
        <span className="rounded-md px-2 py-[2px] text-[10px] font-bold uppercase"
          style={{ backgroundColor: "var(--muted)", color: "var(--navy)" }}>
          {f.entity}
        </span>
      </div>
      <div className="mt-2 text-3xl font-bold text-[color:var(--ink)]" style={{ fontFamily: "var(--font-mono)" }}>
        {fmt(total)} <span className="text-xs font-medium text-[color:var(--ink-muted)]">tCO₂e</span>
      </div>
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
        <div style={{ width: `${s1Pct}%`, backgroundColor: "var(--scope1)" }} />
        <div style={{ width: `${100 - s1Pct}%`, backgroundColor: "var(--scope2)" }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[color:var(--ink-muted)]">
        <span><Flame className="inline h-3 w-3" /> S1 <span style={{ fontFamily: "var(--font-mono)" }}>{f.s1}</span></span>
        <span><Zap className="inline h-3 w-3" /> S2 <span style={{ fontFamily: "var(--font-mono)" }}>{f.s2}</span></span>
      </div>
      {f.yoyPct !== null && (
        <div className="mt-2 flex items-center gap-1 text-xs font-semibold"
          style={{ color: f.yoyPct > 0 ? "var(--critical)" : "var(--success)", fontFamily: "var(--font-mono)" }}>
          {f.yoyPct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(f.yoyPct)}% YoY
        </div>
      )}
      <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[color:var(--brand-red)] opacity-0 transition group-hover:opacity-100">
        Drill down <ArrowRight className="h-3 w-3" />
      </div>
    </button>
  );
}

// ── Drilldown panel ───────────────────────────────────────────────────────────

function Drilldown({ f, fy, assets, onClose }: {
  f: FacilitySummary; fy: string; assets: DecarbAsset[]; onClose: () => void;
}) {
  const total = f.s1 + f.s2;
  const s1Pct = total > 0 ? (f.s1 / total) * 100 : 50;
  const s2Share = total > 0 ? (f.s2 / total) * 100 : 0;
  const facilityAssets = assets.filter(a => a.facility === f.name);

  const facilityTrend = useMemo(() => {
    if (facilityAssets.length === 0) return [];
    const years = Object.keys(facilityAssets[0]?.series ?? {}).sort();
    return years.map(yr => ({
      year: yr,
      total: facilityAssets.reduce((sum, a) => sum + (a.series[yr] ?? 0), 0),
    }));
  }, [facilityAssets]);

  const recommendations = useMemo(() => {
    const recs: string[] = [];
    const replaceAssets = facilityAssets.filter(a => a.health === "replace");
    replaceAssets.forEach(a => {
      recs.push(`Priority: Replace/upgrade ${a.name} — rising trend suggests end-of-life.`);
    });
    if (s2Share > 70) {
      recs.push(`High grid dependency (${s2Share.toFixed(0)}% of emissions from electricity) — see Action Plan → Scope 2 for renewable coverage.`);
    }
    recs.push("See Action Plan for full lever analysis.");
    return recs;
  }, [facilityAssets, s2Share]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[color:var(--ink-muted)]">Facility drill-down</div>
            <h2 className="text-2xl font-bold text-[color:var(--ink)]">{f.name}</h2>
            <p className="text-xs text-[color:var(--ink-muted)]">Entity: {f.entity}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--accent)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="text-[10px] uppercase text-[color:var(--ink-muted)]">Total tCO₂e</div>
            <div className="text-2xl font-bold text-[color:var(--ink)]" style={{ fontFamily: "var(--font-mono)" }}>{fmt(total)}</div>
            <div className="mt-1 flex gap-1"><ScopeBadge scope={1} /><ScopeBadge scope={2} /></div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase text-[color:var(--ink-muted)]">Scope 1</div>
            <div className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)", color: "var(--scope1)" }}>{fmt(f.s1)}</div>
            <div className="text-[10px] text-[color:var(--ink-muted)]">Direct emissions</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase text-[color:var(--ink-muted)]">Scope 2 LB</div>
            <div className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)", color: "var(--scope2)" }}>{fmt(f.s2)}</div>
            <div className="text-[10px] text-[color:var(--ink-muted)]">Grid electricity</div>
          </Card>
        </div>

        <Card className="mt-4 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase text-[color:var(--ink-muted)]">Scope composition</div>
          <div className="flex h-5 w-full overflow-hidden rounded-full">
            <div style={{ width: `${s1Pct}%`, backgroundColor: "var(--scope1)" }}
              className="flex items-center justify-center text-[10px] font-semibold text-white">
              {s1Pct >= 8 && `S1 ${s1Pct.toFixed(0)}%`}
            </div>
            <div style={{ width: `${100 - s1Pct}%`, backgroundColor: "var(--scope2)" }}
              className="flex items-center justify-center text-[10px] font-semibold text-white">
              {100 - s1Pct >= 8 && `S2 ${(100 - s1Pct).toFixed(0)}%`}
            </div>
          </div>
        </Card>

        {facilityTrend.length > 0 && (
          <Card className="mt-4">
            <CardHeader title="Facility emissions trend" subtitle="Historical S1+S2 by fiscal year" />
            <div className="p-4">
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <AreaChart data={facilityTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                    <Tooltip formatter={(v: number) => [`${fmt(v)} tCO₂e`, "S1 + S2"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="total" stroke="var(--scope1)" fill="var(--scope1)" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        )}

        {facilityAssets.length > 0 && (
          <Card className="mt-4">
            <CardHeader title="Assets ranked by tCO₂e" subtitle="Asset-level detail" />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead style={{ backgroundColor: "var(--muted)" }} className="text-[10px] uppercase text-[color:var(--ink-muted)]">
                  <tr>
                    <th className="px-3 py-2 text-left">Asset</th>
                    <th className="px-3 py-2 text-left">Fuel</th>
                    <th className="px-3 py-2 text-right">tCO₂e ({fy})</th>
                    <th className="px-3 py-2 text-center">Trend</th>
                    <th className="px-3 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {facilityAssets
                    .slice().sort((a, b) => (b.series[fy] ?? 0) - (a.series[fy] ?? 0))
                    .map(a => {
                      const vals = Object.keys(a.series).sort().map(k => a.series[k] ?? 0);
                      return (
                        <tr key={a.id} className="border-t">
                          <td className="px-3 py-2 font-medium">{a.name}</td>
                          <td className="px-3 py-2 text-[color:var(--ink-muted)]">{a.fuel}</td>
                          <td className="px-3 py-2 text-right font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                            {fmt(a.series[fy] ?? 0)}
                          </td>
                          <td className="px-3 py-2 text-center"><Sparkline data={vals} /></td>
                          <td className="px-3 py-2 text-right"><HealthBadge h={a.health} /></td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card className="mt-4 p-4" style={{ borderColor: "rgba(30,111,92,0.3)", backgroundColor: "rgba(230,244,239,0.5)" }}>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-[color:var(--scope1)]">
            <Activity className="h-3.5 w-3.5" /> Facility-specific recommendations
          </div>
          <ul className="space-y-2 pl-1 text-xs text-[color:var(--ink)]">
            {recommendations.map((rec, i) => {
              const isPriority = rec.startsWith("Priority:");
              return (
                <li key={i} className="flex items-start gap-2">
                  {isPriority
                    ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--critical)" }} />
                    : <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--brand-red)" }} />}
                  <span>{rec}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}

// ── Custom treemap cell ───────────────────────────────────────────────────────

let dynScope3Total = 1;

function TreemapCell(props: any) {
  const { x, y, width, height, name, value } = props;
  const shades = ["#334155", "#475569", "#64748B", "#94A3B8", "#CBD5E1"];
  const fill = shades[(props.index ?? 0) % shades.length];
  const scope3Total = dynScope3Total || 1;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" />
      {width > 90 && height > 40 && (
        <>
          <text x={x + 10} y={y + 22} fill="#fff" fontSize={12} fontWeight={600}>{name}</text>
          <text x={x + 10} y={y + 40} fill="#fff" fontSize={13} fontFamily="var(--font-mono)">{fmt(value)} tCO₂e</text>
          {width > 140 && height > 60 && (
            <text x={x + 10} y={y + 56} fill="#fff" opacity={0.75} fontSize={10}>
              {Math.round((value / scope3Total) * 100)}% of Scope 3
            </text>
          )}
        </>
      )}
    </g>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function HotspotPage() {
  const { entity } = useEntity();
  const { fy } = useFiscalYear();
  const { entities, reporting_years } = useClientContext();
  const consolidatedCode = entities.find(e => e.is_consolidated)?.code;
  const isConsolidated = entity === consolidatedCode;

  const { data: invData }     = useInventory(entity);
  const { data: s3Data }      = useS3Summary(entity);
  const { data: s1FacData }   = useS1ByFacility(entity);
  const { data: s2FacData }   = useS2ByFacility(entity);
  const { data: facilitiesData } = useFacilities(isConsolidated ? undefined : entity);
  const { data: assetsData }  = useDecarbAssets(isConsolidated ? undefined : entity);
  const { data: intensityData } = useIntensity(consolidatedCode ?? entity);
  const { data: consInvData } = useInventory(consolidatedCode ?? entity);

  const [openFacility, setOpenFacility] = useState<string | null>(null);
  const [emitterView, setEmitterView] = useState<"source" | "category">("category");

  const s1v = getVal(invData, "Scope 1", fy) ?? 0;
  const s2v = getVal(invData, "Scope 2 LB", fy) ?? 0;

  // Facility summaries — derived from S1/S2 by facility API data
  const facilitySummaries: FacilitySummary[] = useMemo(() => {
    if (!s1FacData?.length || !s2FacData?.length) return [];
    const prevFy = reporting_years[reporting_years.indexOf(fy) - 1];
    const facilityNames = [...new Set([
      ...s1FacData.map(r => r.facility),
      ...s2FacData.map(r => r.facility),
    ])];
    return facilityNames.map(name => {
      const s1Rows = s1FacData.filter(r => r.facility === name);
      const s2Row  = s2FacData.find(r => r.facility === name);
      const s1 = Math.round(s1Rows.reduce((sum, r) => sum + (r.series[fy] ?? 0), 0));
      const s2 = Math.round(s2Row?.series[fy] ?? 0);
      const entity_ = facilitiesData?.find(f => f.name === name)?.entity ?? entity;
      let yoyPct: number | null = null;
      if (prevFy) {
        const s1Prev = s1Rows.reduce((sum, r) => sum + (r.series[prevFy] ?? 0), 0);
        const s2Prev = s2Row?.series[prevFy] ?? 0;
        const prev = s1Prev + s2Prev;
        const curr = s1 + s2;
        if (prev > 0) yoyPct = Math.round(((curr - prev) / prev) * 1000) / 10;
      }
      return { name, entity: entity_, s1, s2, yoyPct } as FacilitySummary;
    }).filter(f => f.s1 + f.s2 > 0).sort((a, b) => b.s1 + b.s2 - a.s1 - a.s2);
  }, [s1FacData, s2FacData, facilitiesData, fy, reporting_years, entity]);

  // Scope 3 data from API
  const scope3ChartData = useMemo(() => {
    if (!s3Data?.length) return [];
    return s3Data
      .filter(r => (r.series[fy] ?? 0) > 0)
      .map(r => ({ name: r.category, value: r.series[fy] as number }))
      .sort((a, b) => b.value - a.value);
  }, [s3Data, fy]);
  const scope3Total = scope3ChartData.reduce((s, c) => s + c.value, 0);
  dynScope3Total = scope3Total || 1;

  // Category emitters leaderboard
  const categoryEmitters = [
    { name: "Scope 1 · Direct combustion & fugitive", value: s1v, scope: 1 as const },
    { name: "Scope 2 · Grid electricity (LB)",         value: s2v, scope: 2 as const },
    ...scope3ChartData.map(c => ({ name: c.name, value: c.value, scope: 3 as const })),
  ].filter(e => e.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);

  // Source emitters from assets (scoped to selected entity+fy)
  const assetEmitters = useMemo(() => {
    if (!assetsData?.length) return [];
    return assetsData
      .filter(a => (a.series[fy] ?? 0) > 0)
      .map(a => ({
        name: `${a.name} · ${a.facility}`,
        value: a.series[fy] as number,
        scope: (a.scope.includes("1") ? 1 : a.scope.includes("2") ? 2 : 3) as 1 | 2 | 3,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [assetsData, fy]);

  const emitterData = emitterView === "source" ? assetEmitters : categoryEmitters;
  const openFacilitySummary = facilitySummaries.find(f => f.name === openFacility);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader title="Hotspots" description="Diagnose where your emissions are concentrated and why." />

      {/* Facility grid */}
      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Facility heatmap</h2>
            <p className="text-xs text-[color:var(--ink-muted)]">
              Facilities ranked by {fy} total emissions. Click a card to drill down.
            </p>
          </div>
          <div className="text-[11px] text-[color:var(--ink-muted)]">{facilitySummaries.length} facilities</div>
        </div>
        {facilitySummaries.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {facilitySummaries.map(f => (
              <FacilityCard key={f.name} f={f} onOpen={() => setOpenFacility(f.name)} />
            ))}
          </div>
        ) : (
          <DNF block label={`Facility-level breakdown not yet available for ${entity} · ${fy}.`} />
        )}
      </section>

      {/* Top emitters */}
      <Card className="mb-8">
        <CardHeader
          title="Top 10 emitters — leaderboard"
          subtitle="Ranked across the whole company, color-coded by scope"
          right={
            <div className="flex overflow-hidden rounded-md border text-xs">
              {(["source", "category"] as const).map(v => (
                <button key={v} onClick={() => setEmitterView(v)}
                  className={"px-3 py-1 font-medium capitalize transition " +
                    (emitterView === v ? "bg-[color:var(--ink)] text-white" : "bg-white text-[color:var(--ink)] hover:bg-[var(--accent)]")}>
                  By {v}
                </button>
              ))}
            </div>
          }
        />
        <div className="p-5">
          {emitterData.length === 0 ? (
            <DNF block label={emitterView === "source"
              ? `No asset-level data available for ${entity} · ${fy}.`
              : `No emission data available for ${entity} · ${fy}.`} />
          ) : (
            <>
              <div style={{ width: "100%", height: 380 }}>
                <ResponsiveContainer>
                  <BarChart data={emitterData} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                    <YAxis type="category" dataKey="name" width={260} tick={{ fontSize: 11 }} interval={0} />
                    <Tooltip formatter={(v: number) => [`${fmt(v)} tCO₂e`, "Emissions"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}
                      label={{ position: "right", fontSize: 11, fontFamily: "var(--font-mono)", formatter: (v: number) => fmt(v) }}>
                      {emitterData.map((d, i) => <Cell key={i} fill={scopeColor(d.scope)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex gap-3 text-[11px]">
                {([1, 2, 3] as const).map(s => (
                  <span key={s} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: scopeColor(s) }} /> Scope {s}
                  </span>
                ))}
              </div>
              <HowToRead>
                Longer bars indicate higher emissions. <b>By source</b> shows individual assets so you can target a single piece of equipment.
                <b> By category</b> shows how each Scope 3 category compares to on-site Scope 1 &amp; 2.
              </HowToRead>
            </>
          )}
        </div>
      </Card>

      {/* Scope 3 concentration */}
      <Card>
        <CardHeader
          title="Scope 3 concentration risk"
          subtitle="Each block sized by tCO₂e"
          right={<ScopeBadge scope={3} />}
        />
        <div className="p-5">
          {scope3ChartData.length === 0 ? (
            <DNF block label={`No calculated Scope 3 categories for ${entity} · ${fy}.`} />
          ) : (
            <>
              <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer>
                  <Treemap data={scope3ChartData} dataKey="value" aspectRatio={4 / 3} stroke="#fff"
                    fill="var(--scope3)" content={<TreemapCell />} />
                </ResponsiveContainer>
              </div>
              <HowToRead>
                The largest block is your Scope 3 concentration risk. Values shown for {entity} · {fy}.
              </HowToRead>
            </>
          )}
        </div>
      </Card>

      {openFacilitySummary && (
        <Drilldown
          f={openFacilitySummary}
          fy={fy}
          assets={assetsData ?? []}
          onClose={() => setOpenFacility(null)}
        />
      )}
    </div>
  );
}
