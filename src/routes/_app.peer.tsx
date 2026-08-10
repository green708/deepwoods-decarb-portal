import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  PieChart,
  Pie,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { CheckCircle2, Clock, XCircle, TrendingDown, FileCheck, X, BookOpen } from "lucide-react";
import {
  PageHeader,
  Card,
  CardHeader,
  HowToRead,
  fmt,
} from "@/components/decarb/shared";
import { useClientContext } from "@/lib/client-context";
import { usePeers, useInventory, useIntensity, getVal } from "@/lib/api";
import { useEntity, useFiscalYear } from "@/lib/entity";

/* ── Peer types ──────────────────────────────────────────────────────────── */
type PeerTrend = { year: string; scope12: number; vsBaselinePct: string };
type PeerTargets = { netZeroYear: number|null; sbti: "validated"|"committed"|"no"; sbtiLabel: string; nearTerm: string; scope3Target: string; baseYear: string; valueChainCommitment: string };
type PeerScope3 = { baseline: number|null; baselineYear: string; latest: number|null; latestYear: string; changePct: number|null; note: string };
type PeerNeutrality = { scope1: number|null; scope2MB: number|null; scope2LB: number|null; scope1Offset: string; intensityLabel: string; intensityValue: number|null };
type PeerEnergy = { totalGJ: number|null; intensityValue: number|null; intensityLabel: string };
type PeerData = {
  id: string; name: string; initials: string; highlight: string; source: string;
  totals: Record<string, number|undefined>;
  trend: PeerTrend[];
  targets: PeerTargets; neutrality: PeerNeutrality; energy: PeerEnergy; scope3: PeerScope3;
  sourceSplit: Array<{name: string; value: number}>;
  frameworks: Array<{label: string; value: string}>;
  renewableElectricityPct: number; reductionToDatePct: number|null; reductionNote: string;
};

const SOURCE_COLORS = ["#1E6F5C","#3B82F6","#F59E0B","#EF4444","#8B5CF6","#64748B"];
const PEER_FISCAL_YEARS = ["2024", "2023", "2022"] as const;
type PeerFY = typeof PEER_FISCAL_YEARS[number];

export const Route = createFileRoute("/_app/peer")({
  component: PeerStudyPage,
});

/* ── NDF Badge ─────────────────────────────────────────────────────────────── */

function NdfBadge() {
  return (
    <span className="inline-block rounded bg-[#EEF2F7] px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
      NDF
    </span>
  );
}

/* ── SbtiBadge ───────────────────────────────────────────────────────────── */

function SbtiBadge({ v }: { v: "validated" | "committed" | "no" }) {
  const map = {
    validated: { bg: "var(--success-bg)", fg: "var(--success)", icon: CheckCircle2, label: "Validated" },
    committed: { bg: "var(--warning-bg)", fg: "var(--warning)", icon: Clock, label: "Committed" },
    no: { bg: "#EEF2F7", fg: "#64748B", icon: XCircle, label: "Not committed" },
  }[v];
  const Icon = map.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-[2px] text-[11px] font-semibold"
      style={{ backgroundColor: map.bg, color: map.fg }}
    >
      <Icon className="h-3.5 w-3.5" /> {map.label}
    </span>
  );
}

/* ── KV ──────────────────────────────────────────────────────────────────── */

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--ink-muted)]">{label}</div>
      <div className="mt-0.5 text-sm text-[color:var(--ink)]">{children}</div>
    </div>
  );
}

/* ── PeerDetail slide-in ─────────────────────────────────────────────────── */

function PeerDetail({ p, onClose }: { p: PeerData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-[color:var(--ink-muted)]" />
              <span className="text-[11px] font-semibold text-[color:var(--ink-muted)]">{p.source}</span>
            </div>
            <h2 className="text-2xl font-bold text-[color:var(--ink)]">{p.name}</h2>
            <p className="text-xs text-[color:var(--ink-muted)]">{p.highlight}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--accent)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Targets */}
        <Card className="mb-4">
          <CardHeader title="Targets & Commitments" />
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <KV label="Net-zero target year">
              {p.targets.netZeroYear != null ? (
                <span style={{ fontFamily: "var(--font-mono)" }} className="font-semibold">{p.targets.netZeroYear}</span>
              ) : (
                <NdfBadge />
              )}
            </KV>
            <KV label="SBTi status"><SbtiBadge v={p.targets.sbti} /> <span className="ml-1 text-xs text-[color:var(--ink-muted)]">{p.targets.sbtiLabel}</span></KV>
            <KV label="Near-term target (Scope 1+2)">{p.targets.nearTerm}</KV>
            <KV label="Scope 3 target">{p.targets.scope3Target}</KV>
            <KV label="Base year">{p.targets.baseYear}</KV>
            <KV label="Value-chain commitment">{p.targets.valueChainCommitment}</KV>
          </div>
        </Card>

        {/* Performance trend */}
        <Card className="mb-4">
          <CardHeader title="Performance trend — Scope 1 + MB Scope 2" subtitle="Organisation-wide, tCO₂e" />
          <div className="p-5">
            {p.trend.length > 0 ? (
              <>
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <LineChart data={p.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => `${fmt(v)} tCO₂e`} />
                      <Line type="monotone" dataKey="scope12" stroke="var(--scope1)" strokeWidth={2.5} dot={{ r: 4 }} name="Scope 1 + MB Scope 2" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <table className="mt-4 w-full text-xs">
                  <thead style={{ backgroundColor: "var(--muted)" }} className="text-[10px] uppercase text-[color:var(--ink-muted)]">
                    <tr>
                      <th className="px-3 py-2 text-left">Year</th>
                      <th className="px-3 py-2 text-right">Scope 1+2 (tCO₂e)</th>
                      <th className="px-3 py-2 text-right">vs Baseline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.trend.map((r) => (
                      <tr key={r.year} className="border-t">
                        <td className="px-3 py-2">{r.year}</td>
                        <td className="px-3 py-2 text-right" style={{ fontFamily: "var(--font-mono)" }}>{fmt(r.scope12)}</td>
                        <td className="px-3 py-2 text-right" style={{ fontFamily: "var(--font-mono)" }}>{r.vsBaselinePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <NdfBadge />
            )}
          </div>
        </Card>

        {/* Stats row */}
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--ink-muted)]">
              Reduction to date
            </div>
            {p.reductionToDatePct != null ? (
              <>
                <div className="mt-1 flex items-center gap-1 text-2xl font-bold" style={{ fontFamily: "var(--font-mono)", color: "var(--success)" }}>
                  <TrendingDown className="h-5 w-5" /> −{p.reductionToDatePct}%
                </div>
                <div className="text-[11px] text-[color:var(--ink-muted)]">{p.reductionNote}</div>
              </>
            ) : (
              <div className="mt-2"><NdfBadge /></div>
            )}
          </Card>
          <Card className="p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--ink-muted)]">
              Renewable electricity %
            </div>
            <div className="mt-1 text-2xl font-bold" style={{ fontFamily: "var(--font-mono)", color: "var(--scope1)" }}>{p.renewableElectricityPct}%</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--ink-muted)]">
              Total energy
            </div>
            {p.energy.totalGJ != null ? (
              <>
                <div className="mt-1 text-xl font-bold" style={{ fontFamily: "var(--font-mono)" }}>{fmt(p.energy.totalGJ)} GJ</div>
                <div className="text-[11px] text-[color:var(--ink-muted)]" style={{ fontFamily: "var(--font-mono)" }}>
                  {p.energy.intensityValue != null ? `${p.energy.intensityValue} ${p.energy.intensityLabel}` : <NdfBadge />}
                </div>
              </>
            ) : (
              <div className="mt-2"><NdfBadge /></div>
            )}
          </Card>
        </div>

        {/* Scope 3 */}
        <Card className="mb-4">
          <CardHeader title="Scope 3 GHG emissions" subtitle="Organisation-wide, tCO₂e" />
          <div className="p-5">
            <div className="grid grid-cols-3 items-center gap-4 text-center">
              <div>
                <div className="text-[10px] uppercase text-[color:var(--ink-muted)]">{p.scope3.baselineYear}</div>
                <div className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)" }}>
                  {p.scope3.baseline != null ? fmt(p.scope3.baseline) : <NdfBadge />}
                </div>
              </div>
              <div className="text-2xl text-[color:var(--ink-muted)]">→</div>
              <div>
                <div className="text-[10px] uppercase text-[color:var(--ink-muted)]">{p.scope3.latestYear}</div>
                <div className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)", color: p.scope3.changePct != null && p.scope3.changePct < 0 ? "var(--success)" : undefined }}>
                  {p.scope3.latest != null ? fmt(p.scope3.latest) : <NdfBadge />}
                </div>
                {p.scope3.changePct != null && (
                  <div className="text-[11px] font-semibold" style={{ fontFamily: "var(--font-mono)", color: p.scope3.changePct < 0 ? "var(--success)" : "var(--critical)" }}>
                    {p.scope3.changePct}%
                  </div>
                )}
              </div>
            </div>
            {p.scope3.note && (
              <div className="mt-3 rounded bg-[var(--muted)] px-3 py-2 text-[11px] text-[color:var(--ink-muted)]">
                {p.scope3.note}
              </div>
            )}
          </div>
        </Card>

        {/* Neutrality */}
        <Card className="mb-4">
          <CardHeader title="Neutrality & offsets" />
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <KV label="Scope 1 emissions">
              {p.neutrality.scope1 != null ? (
                <><span style={{ fontFamily: "var(--font-mono)" }} className="font-semibold">{fmt(p.neutrality.scope1)}</span> tCO₂e</>
              ) : (
                <NdfBadge />
              )}
            </KV>
            <KV label="Scope 2 MB emissions">
              {p.neutrality.scope2MB != null ? (
                <><span style={{ fontFamily: "var(--font-mono)" }} className="font-semibold">{fmt(p.neutrality.scope2MB)}</span> tCO₂e</>
              ) : (
                <NdfBadge />
              )}
            </KV>
            <KV label="Scope 2 LB emissions">
              {p.neutrality.scope2LB != null ? (
                <><span style={{ fontFamily: "var(--font-mono)" }} className="font-semibold">{fmt(p.neutrality.scope2LB)}</span> tCO₂e</>
              ) : (
                <NdfBadge />
              )}
            </KV>
            <KV label="Scope 1 offsetting">{p.neutrality.scope1Offset}</KV>
            <KV label={`GHG intensity (${p.neutrality.intensityLabel})`}>
              {p.neutrality.intensityValue != null ? (
                <span style={{ fontFamily: "var(--font-mono)" }} className="font-semibold">{p.neutrality.intensityValue}</span>
              ) : (
                <NdfBadge />
              )}
            </KV>
          </div>
        </Card>

        {/* Source split */}
        <Card className="mb-4">
          <CardHeader title="Emissions source split" subtitle="tCO₂e breakdown" />
          <div className="p-5">
            {p.sourceSplit.length > 0 ? (
              <>
                <div style={{ width: "100%", height: 250 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={p.sourceSplit} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95} paddingAngle={2}>
                        {p.sourceSplit.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${fmt(v)} tCO₂e`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <HowToRead>
                  Compare against peers to see whether their starting point favored purchased
                  electricity (easier to decarbonize via renewables) or process emissions (harder).
                </HowToRead>
              </>
            ) : (
              <NdfBadge />
            )}
          </div>
        </Card>

        {/* Frameworks */}
        <Card>
          <CardHeader title="Frameworks & certifications" />
          <div className="flex flex-wrap gap-3 p-5">
            {p.frameworks.length > 0 ? (
              p.frameworks.map((fw, i) => (
                <div key={i} className="inline-flex items-center gap-2 rounded-full border bg-[var(--muted)]/40 px-3 py-1.5 text-xs">
                  <FileCheck className="h-4 w-4" style={{ color: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                  <span className="font-semibold">{fw.label}</span>
                  <span className="text-[color:var(--ink-muted)]">· {fw.value}</span>
                </div>
              ))
            ) : (
              <NdfBadge />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

function PeerStudyPage() {
  const { entity } = useEntity();
  const { entities, reporting_years, targets, s3_boundary } = useClientContext();
  const entityShort = (code: string) => entities.find(e => e.code === code)?.short ?? code;
  const entityName  = (code: string) => entities.find(e => e.code === code)?.name ?? code;
  const { data: invData } = useInventory(entity);
  const { data: intensityData } = useIntensity(entity);
  const inv = (metric: string, fy: string) => getVal(invData, metric, fy);
  const { fy } = useFiscalYear();
  const flS12 = (getVal(invData, "Scope 1", fy) ?? 0) + (getVal(invData, "Scope 2 LB", fy) ?? 0);
  const [year, setYear] = useState<PeerFY>("2024");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { data: peersRaw = [] } = usePeers();
  const peersData = useMemo<PeerData[]>(() => {
    const grouped: Record<string, PeerData> = {};
    const fyToCalYear = (fyStr: string) => `20${fyStr.slice(2)}`;
    for (const row of peersRaw) {
      const yr = fyToCalYear(row.fy);
      if (!grouped[row.name]) {
        grouped[row.name] = {
          id: row.name.toLowerCase().replace(/\s+/g, "-"),
          name: row.name,
          initials: row.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
          highlight: "",
          source: "",
          totals: {},
          trend: [],
          targets: { netZeroYear: null, sbti: "no", sbtiLabel: "Not committed", nearTerm: "", scope3Target: "", baseYear: "", valueChainCommitment: "" },
          neutrality: { scope1: null, scope2MB: null, scope2LB: null, scope1Offset: "", intensityLabel: "", intensityValue: null },
          energy: { totalGJ: null, intensityValue: null, intensityLabel: "" },
          scope3: { baseline: null, baselineYear: "", latest: null, latestYear: "", changePct: null, note: "" },
          sourceSplit: [],
          frameworks: [],
          renewableElectricityPct: 0,
          reductionToDatePct: null,
          reductionNote: "",
        };
      }
      const s12 = (row.scope1 ?? 0) + (row.scope2_lb ?? 0);
      grouped[row.name].totals[yr] = s12;
      grouped[row.name].trend.push({ year: yr, scope12: s12, vsBaselinePct: "" });
      grouped[row.name].neutrality.scope1 = row.scope1 ?? null;
      grouped[row.name].neutrality.scope2LB = row.scope2_lb ?? null;
      grouped[row.name].neutrality.scope2MB = row.scope2_mb ?? null;
      grouped[row.name].scope3.latest = row.scope3_total ?? null;
    }
    return Object.values(grouped);
  }, [peersRaw]);

  const chartData = useMemo(() => {
    return (peersData ?? [])
      .filter((p) => p.totals[year] != null)
      .map((p) => ({
        name: p.name,
        value: p.totals[year]!,
        id: p.id,
      }))
      .sort((a, b) => a.value - b.value);
  }, [peersData, year]);

  const max = chartData.length > 0 ? Math.max(...chartData.map((d) => d.value)) : 0;
  const barColor = (v: number) => {
    if (max === 0) return "var(--success)";
    const r = v / max;
    if (r < 0.34) return "var(--success)";
    if (r < 0.67) return "var(--warning)";
    return "var(--critical)";
  };

  // Only show reference line if it fits within 1.5x the chart max
  const showRefLine = chartData.length > 0 && flS12 <= max * 1.5;

  const open = (peersData ?? []).find((p) => p.id === openKey) ?? null;

  // Helper: get latest non-null total for a peer
  const getLatestTotal = (p: PeerData): { value: number; year: string } | null => {
    const years = [...reporting_years].reverse();
    for (const y of years) {
      const v = p.totals[y];
      if (v != null) return { value: v, year: y };
    }
    return null;
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Peer Study"
        description="See how industry peers are performing on climate — and where the gaps and opportunities are."
        right={
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--ink-muted)]">
              Fiscal Year
            </div>
            <div className="flex overflow-hidden rounded-md border">
              {PEER_FISCAL_YEARS.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={
                    "px-2.5 py-1 text-xs font-semibold transition " +
                    (year === y ? "bg-[color:var(--ink)] text-white" : "bg-white text-[color:var(--ink)] hover:bg-[var(--accent)]")
                  }
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Comparison chart */}
      <Card className="mb-6">
        <CardHeader
          title={`Peer Scope 1+2 emissions — ${year}`}
          subtitle="Sorted best → worst. Click a peer card below for details."
        />
        <div className="p-5">
          {chartData.length > 0 ? (
            <>
              <div style={{ width: "100%", height: Math.max(200, chartData.length * 80 + 60) }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 60 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} tickFormatter={(v: number) => fmt(v)} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [`${fmt(v)} tCO₂e`, "S1+2"]}
                    />
                    {showRefLine && (
                      <ReferenceLine
                        x={flS12}
                        stroke="var(--brand-red)"
                        strokeDasharray="5 4"
                        label={{ value: `${entity} ${fy} S1+2`, position: "top", fill: "var(--brand-red)", fontSize: 11, fontWeight: 600 }}
                      />
                    )}
                    <Bar
                      dataKey="value"
                      radius={[0, 4, 4, 0]}
                      label={{
                        position: "right",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        formatter: (v: number) => fmt(v),
                      }}
                    >
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={barColor(d.value)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <HowToRead>
                Bars show each peer's Scope 1+2 footprint for the selected year. Only peers
                with data for that year are shown. Shorter and greener is better — but company
                size and revenue affect absolute totals, so also check intensity and
                reduction-trend figures in each peer's detail view below.
              </HowToRead>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <NdfBadge />
              <p className="text-sm text-[color:var(--ink-muted)]">No peers have reported data for {year}.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Peer cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(peersData ?? []).map((p) => {
          const latest = getLatestTotal(p);
          return (
            <button
              key={p.id}
              onClick={() => setOpenKey(p.id)}
              className="group flex flex-col rounded-xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-[var(--muted)] text-sm font-bold text-[color:var(--ink)]">
                  {p.initials}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--ink-muted)]">
                  {latest ? latest.year : ""}
                </span>
              </div>
              <div className="text-base font-semibold text-[color:var(--ink)]">{p.name}</div>
              <div className="text-[11px] text-[color:var(--ink-muted)]">{p.highlight}</div>
              <div className="mt-3 text-2xl font-bold text-[color:var(--ink)]" style={{ fontFamily: "var(--font-mono)" }}>
                {latest ? (
                  <>{fmt(latest.value)} <span className="text-xs font-medium text-[color:var(--ink-muted)]">tCO₂e</span></>
                ) : (
                  <NdfBadge />
                )}
              </div>
              <div className="text-[11px] text-[color:var(--ink-muted)]">
                Scope 1+2 (latest available)
              </div>
              <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold opacity-0 transition group-hover:opacity-100" style={{ color: "var(--brand-red)" }}>
                View full peer study →
              </div>
            </button>
          );
        })}
      </div>

      {open && <PeerDetail p={open} onClose={() => setOpenKey(null)} />}
    </div>
  );
}
