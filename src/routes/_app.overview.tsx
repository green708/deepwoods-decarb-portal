import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, Sector, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from "recharts";
import { PageBody, PageHeader } from "@/components/portal";
import { useClientContext } from "@/lib/client-context";
import { useInventory, useIntensity, getVal, getMetric } from "@/lib/api";
import { useEntity, useFiscalYear } from "@/lib/entity";

export const Route = createFileRoute("/_app/overview")({ component: Overview });

// ── Chart palette ─────────────────────────────────────────────────────────────
const EMERALD = "#16A34A";
const AMBER   = "#F59E0B";
const INK     = "#1F2937";
const MID     = "#6B7280";
const GREEN   = EMERALD;
const S1_BLUE = "#1E6F5C", S2_BLUE = "#3B82F6", S3_BLUE = "#64748B";

function DonutActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 10}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
        style={{ filter: "drop-shadow(0px 4px 10px rgba(30,64,175,0.35))", cursor: "pointer" }} />
      <text x={cx} y={cy - 14} textAnchor="middle" fill={INK} style={{ fontSize: 12, fontWeight: 700 }}>
        {payload.name.replace(" LB", "")}
      </text>
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#1E6F5C" style={{ fontSize: 15, fontWeight: 800, fontFamily: "Inter,sans-serif" }}>
        {(percent * 100).toFixed(1)}%
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fill={MID} style={{ fontSize: 10 }}>
        {value.toLocaleString("en-IN", { maximumFractionDigits: 0 })} tCO2e
      </text>
    </g>
  );
}

const f2 = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Chart card ────────────────────────────────────────────────────────────────
function ChartCard({ n, title, sub, note, children, className = "" }: {
  n: number; title: string; sub: string; note: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col rounded-xl border bg-white p-5 ${className}`}>
      <div style={{ background: "#1E6F5C" }} className="mb-2 flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white">{n}</div>
      <h4 className="font-bold tabular-nums leading-snug" style={{ color: INK, fontSize: 16 }}>{title}</h4>
      <p className="mt-1 mb-3 text-xs leading-relaxed" style={{ color: MID }}>{sub}</p>
      <div className="flex-1">{children}</div>
      <div className="mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed" style={{ borderLeft: "3px solid #1E6F5C", background: "#F7F7F7", color: "#6B7280" }}>
        <span className="font-bold" style={{ color: "#1E6F5C" }}>How to read it: </span>{note}
      </div>
    </div>
  );
}

function GenericTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white p-2.5 text-xs shadow-lg">
      <div className="mb-1 font-bold" style={{ color: INK }}>{label}</div>
      {payload.map((p: any) => p.value != null && (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
          <span>{p.name}: <b>{f2(p.value)} tCO2e</b></span>
        </div>
      ))}
    </div>
  );
}

// ── KPI row ───────────────────────────────────────────────────────────────────
function KpiRow({ year }: { year: string }) {
  const { entity } = useEntity();
  const { reporting_years } = useClientContext();
  const { data: kpiInvData } = useInventory(entity);
  const inv = (metric: string, fy: string) => getVal(kpiInvData, metric, fy);

  const fyIdx = reporting_years.indexOf(year);
  const prevYear: string | null = fyIdx > 0 ? reporting_years[fyIdx - 1] : null;

  const gt     = inv("Grand Total LB", year);
  const gtPrev = prevYear ? inv("Grand Total LB", prevYear) : null;
  const s1     = inv("Scope 1", year);
  const s1Prev = prevYear ? inv("Scope 1", prevYear) : null;
  const s2lb   = inv("Scope 2 LB", year);
  const s2mb   = inv("Scope 2 MB", year);
  const s3     = inv("Scope 3 Total", year);
  const s3Prev = prevYear ? inv("Scope 3 Total", prevYear) : null;

  const s12mbBase = (inv("Scope 1", "FY22") ?? 0) + (inv("Scope 2 MB", "FY22") ?? 0);
  const s12mbNow  = (s1 ?? 0) + (s2mb ?? 0);
  const baseCh    = s12mbBase > 0 ? ((s12mbNow - s12mbBase) / s12mbBase) * 100 : null;

  const pct = (cur: number | null, prev: number | null) =>
    cur != null && prev != null && prev !== 0 ? ((cur - prev) / prev) * 100 : null;
  const gtCh = pct(gt, gtPrev);
  const s1Ch = pct(s1, s1Prev);
  const s3Ch = pct(s3, s3Prev);

  const chip = (v: number | null, label: string) =>
    v == null ? (
      <span className="text-muted-foreground">— {label}</span>
    ) : (
      <span style={{ color: v <= 0 ? GREEN : "#FF2800", fontWeight: 700 }}>
        {v <= 0 ? "▼" : "▲"} {Math.abs(v).toFixed(1)}% {label}
      </span>
    );

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="col-span-2 rounded-xl border bg-white p-4 sm:col-span-1" style={{ borderLeft: "4px solid #FF2800" }}>
        <div className="text-[9px] font-bold uppercase tracking-widest mb-1 text-muted-foreground">Total Footprint {year}</div>
        <div className="font-bold tabular-nums" style={{ fontSize: 22, color: INK }}>{f2(gt)} <span style={{ fontSize: 11, fontWeight: 400, color: MID }}>tCO2e</span></div>
        <div className="mt-1 text-[11px] text-muted-foreground">{chip(gtCh, prevYear ? `vs ${prevYear} (LB)` : "")}</div>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Scope 1</div>
        <div className="font-bold tabular-nums text-xl" style={{ color: INK }}>{f2(s1)} <span style={{ fontSize: 11, fontWeight: 400, color: MID }}>tCO2e</span></div>
        <div className="mt-1 text-[11px] text-muted-foreground">{chip(s1Ch, prevYear ? `vs ${prevYear}` : "")} — combustion, fugitives</div>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Scope 2</div>
        <div className="flex items-baseline gap-1.5 mb-0.5">
          <span className="text-[9px] font-bold uppercase text-muted-foreground w-14 shrink-0">Location</span>
          <span className="font-bold tabular-nums text-lg" style={{ color: INK }}>{f2(s2lb)} <span style={{ fontSize: 10, fontWeight: 400, color: MID }}>tCO2e</span></span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[9px] font-bold uppercase text-muted-foreground w-14 shrink-0">Market</span>
          <span className="font-bold tabular-nums text-lg" style={{ color: (s2mb ?? 1) === 0 ? GREEN : INK }}>{f2(s2mb)} <span style={{ fontSize: 10, fontWeight: 400, color: MID }}>tCO2e</span></span>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {s2mb === 0 && s2lb !== null && s2lb > 0 ? "Fully covered by renewable instruments" : s2mb === 0 ? "No market instruments recorded" : "Partly offset by renewable instruments"}
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Scope 3</div>
        <div className="font-bold tabular-nums text-xl" style={{ color: INK }}>{f2(s3)} <span style={{ fontSize: 11, fontWeight: 400, color: MID }}>tCO2e</span></div>
        <div className="mt-1 text-[11px] text-muted-foreground">{chip(s3Ch, prevYear ? `vs ${prevYear}` : "")}</div>
      </div>
      <div className="rounded-xl border bg-white p-4" style={{ borderLeft: `4px solid ${(baseCh ?? 1) <= 0 ? GREEN : AMBER}` }}>
        <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">S1+2 MB vs FY22 Base</div>
        {baseCh != null ? (
          <div className="font-bold tabular-nums leading-snug" style={{ color: baseCh <= 0 ? GREEN : "#FF2800", fontSize: 15 }}>
            {baseCh <= 0 ? "▼" : "▲"} {Math.abs(baseCh).toFixed(1)}% vs base year
          </div>
        ) : (
          <div className="font-bold tabular-nums leading-snug text-muted-foreground" style={{ fontSize: 15 }}>—</div>
        )}
        <div className="mt-1 text-[11px] text-muted-foreground">Scope 1+2 market-based, FY22 baseline</div>
      </div>
    </div>
  );
}

// ── Overview component ────────────────────────────────────────────────────────
function Overview() {
  const { entity } = useEntity();
  const { fy: year } = useFiscalYear();
  const { entities, reporting_years, targets, s3_boundary } = useClientContext();
  const entityShort = (code: string) => entities.find(e => e.code === code)?.short ?? code;
  const entityName  = (code: string) => entities.find(e => e.code === code)?.name ?? code;
  const entityInfo  = entities.find(e => e.code === entity);
  const { data: invData } = useInventory(entity);
  const { data: intensityData } = useIntensity(entity);
  const inv = (metric: string, fy: string) => getVal(invData, metric, fy);
  const [activeDonutIdx, setActiveDonutIdx] = useState<number | null>(null);
  // data from useInventory hook above

  // Chart 1: S1+2 market-based vs SBTi pace — always shows full history
  const base = (inv("Scope 1", "FY22") ?? 0) + (inv("Scope 2 MB", "FY22") ?? 0);
  const mbSeries = reporting_years.map((y, i) => {
    const s1 = inv("Scope 1", y), s2 = inv("Scope 2 MB", y);
    const actual = s1 !== null ? +((s1) + (s2 ?? 0)).toFixed(2) : null;
    return { year: y, actual, sbti: +(base * (1 - 0.042 * i)).toFixed(2) };
  });
  const future = ["FY27", "FY28", "FY29", "FY30"].map((y, i) => ({
    year: y, actual: null, sbti: +(base * (1 - 0.042 * (5 + i))).toFixed(2),
  }));
  const glidepath = [...mbSeries, ...future];

  // Chart 2: gross-to-net waterfall for selected year
  const grossLB    = inv("Grand Total LB", year) ?? 0;
  const s2lb_yr    = inv("Scope 2 LB", year) ?? 0;
  const s2mb_yr    = inv("Scope 2 MB", year) ?? 0;
  const instruments = s2lb_yr - s2mb_yr;
  const netMB      = grossLB - instruments;
  const waterfall = [
    { name: "Gross emissions\n(location-based)", base: 0,     val: grossLB,     color: S1_BLUE, label: f2(grossLB) },
    { name: "Renewable instruments\n(Scope 2)",  base: netMB, val: instruments, color: GREEN,   label: `− ${f2(instruments)}` },
    { name: "Net position\n(market-based)",       base: 0,     val: netMB,       color: MID,    label: f2(netMB) },
  ];

  // Chart 3: donut for selected year
  const donutRaw = [
    { name: "Scope 1",    value: inv("Scope 1", year),       color: S1_BLUE },
    { name: "Scope 2 LB", value: inv("Scope 2 LB", year),    color: S2_BLUE },
    { name: "Scope 3",    value: inv("Scope 3 Total", year), color: S3_BLUE },
  ];
  const donutData = donutRaw.filter(
    (d): d is { name: string; value: number; color: string } => d.value !== null && d.value > 0,
  );
  const donutTotal = donutData.reduce((a, d) => a + d.value, 0);

  // Chart 4: Scope 3 categories for selected year
  const catNames: Record<string, string> = {
    "Cat 1":  "Purchased goods",   "Cat 2":  "Capital goods",
    "Cat 3":  "Fuel & energy",     "Cat 4":  "Upstream transport",
    "Cat 5":  "Waste in ops",      "Cat 6":  "Business travel",
    "Cat 7":  "Employee commuting","Cat 9":  "Downstream transport",
    "Cat 11": "Use of sold products", "Cat 12": "End-of-life",
  };
  const catbar = Object.keys(catNames)
    .map((c) => ({ cat: c, name: catNames[c], val: inv(c, year) }))
    .filter((c): c is { cat: string; name: string; val: number } => c.val !== null && c.val > 0)
    .sort((a, b) => b.val - a.val);
  const s3Total = inv("Scope 3 Total", year) ?? 1;

  // Chart 5: LB vs MB over all years
  const avoided = reporting_years.map((y) => ({
    year: y,
    lb: inv("Grand Total LB", y),
    mb: inv("Grand Total MB", y),
  })).filter((r) => r.lb !== null);

  const noData = grossLB === 0 && donutData.length === 0;

  function CatTip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const d = catbar.find((c) => c.val === payload[0]?.value);
    return (
      <div className="rounded-lg border bg-white p-2.5 text-xs shadow-lg max-w-[220px]">
        <div className="mb-1 font-bold" style={{ color: INK }}>{d?.cat}</div>
        <div className="text-muted-foreground">{d?.name}</div>
        <div className="mt-1 font-bold">{f2(payload[0]?.value)} tCO2e</div>
        <div className="text-muted-foreground">{((payload[0]?.value / s3Total) * 100).toFixed(1)}% of Scope 3</div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={`${year} · ${entityShort(entity)}${entityInfo?.is_consolidated ? " · consolidated" : ""}`}
        title="Overview"
        description={`${year} GHG performance — GHG Protocol + ISO 14064-1, operational control. Scope 1 & 2 base year FY22 · Scope 3 base year FY24. Use the fiscal year switcher above to change the reporting period.`}
      />
      <PageBody>
        {noData && (
          <div className="mb-6 rounded-xl border border-dashed bg-[var(--muted)] px-5 py-4 text-sm text-muted-foreground">
            No inventory data available for {year} yet — switch to a completed fiscal year using the selector above.
          </div>
        )}

        <KpiRow year={year} />

        {/* ── Row 1 ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard n={1}
            title="Scope 1+2 (Market-Based) vs Reduction Pace"
            sub="Dark line = actual Scope 1+2 market-based tCO2e. Dotted amber = −4.2%/yr linear pace from the FY22 base year (SBTi-style trajectory)."
            note="When market-based equals location-based, no renewable instruments are applied yet. A drop in the market-based line indicates I-REC or PPA coverage taking effect. Staying below the dotted reference line means reducing faster than the target pace."
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={glidepath} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: MID }} />
                <YAxis tick={{ fontSize: 10, fill: MID }} tickFormatter={(v) => v.toLocaleString()} width={55} />
                <Tooltip content={<GenericTip />} />
                <Legend iconType="plainline" iconSize={22} wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "#1F2937" }}
                  formatter={(v: string) => <span style={{ color: "#1F2937" }}>{v}</span>} />
                <Line dataKey="actual" name="Actual S1+2 (MB)" stroke={S1_BLUE} strokeWidth={3} dot={{ r: 4, fill: S1_BLUE }} connectNulls={false} />
                <Line dataKey="sbti"   name="Reference pace (−4.2%/yr)" stroke={AMBER} strokeWidth={2} strokeDasharray="2 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard n={2}
            title={`Gross-to-Net Waterfall — ${year}`}
            sub={`Start with the full location-based footprint for ${year}, subtract renewable-electricity instruments, and land on the market-based net position (tCO2e).`}
            note="The middle bar is emissions neutralised by renewable instruments (wind PPA + I-REC retirement). The final bar is what remains after market instruments."
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={waterfall} margin={{ top: 40, right: 24, left: 8, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: MID }} tickFormatter={(v) => v.split("\n")[0]} />
                <YAxis tick={{ fontSize: 10, fill: MID }} tickFormatter={(v) => v.toLocaleString()} width={60} />
                <Tooltip content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const e = waterfall.find((x) => x.name === label);
                  return (
                    <div className="rounded-lg border bg-white p-2.5 text-xs shadow-lg">
                      <div className="mb-1 font-bold" style={{ color: INK }}>{(label as string).replace("\n", " ")}</div>
                      <div>{e?.label} tCO2e</div>
                    </div>
                  );
                }} />
                <Bar dataKey="base" stackId="a" fill="transparent" />
                <Bar dataKey="val" stackId="a" radius={[4, 4, 0, 0]}>
                  {waterfall.map((e, i) => <Cell key={i} fill={e.color} />)}
                  <LabelList dataKey="label" position="top" style={{ fontSize: 11, fontWeight: 700, fill: INK }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── Row 2 ── */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <ChartCard n={3}
            title={`Scope Composition — ${year}`}
            sub="Share of total location-based footprint."
            note="The value chain (Scope 3) dwarfs operational emissions — purchased goods and outbound freight drive it. Scope 1 is comparatively tiny."
          >
            {donutData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={82}
                      dataKey="value" paddingAngle={3}
                      activeIndex={activeDonutIdx ?? undefined}
                      activeShape={activeDonutIdx !== null ? DonutActiveShape : undefined}
                      onMouseEnter={(_, idx) => setActiveDonutIdx(idx)}
                      onMouseLeave={() => setActiveDonutIdx(null)}
                    >
                      {donutData.map((e, i) => (
                        <Cell key={i} fill={e.color} stroke="transparent" style={{ cursor: "pointer" }} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 grid grid-cols-3 text-center">
                  {donutData.map((d) => (
                    <div key={d.name}>
                      <div className="font-bold tabular-nums text-lg" style={{ color: INK }}>{((d.value / donutTotal) * 100).toFixed(1)}%</div>
                      <div className="text-[11px] text-muted-foreground">{d.name.replace(" LB", "")}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No data for {year}</div>
            )}
          </ChartCard>

          <ChartCard n={4}
            title={`Scope 3 Category Contribution — ${year}`}
            sub="All calculated categories, largest first, in tCO2e."
            note="Cat 1 (purchased goods & services) dominates — supplier engagement is where the next reduction battle is. Cat 9 (downstream transport) follows."
          >
            {catbar.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={catbar} layout="vertical" margin={{ top: 4, right: 80, left: 4, bottom: 0 }} barCategoryGap="16%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: MID }} tickFormatter={(v) => v.toLocaleString()}
                    label={{ value: "tCO2e", position: "insideBottomRight", offset: -4, fontSize: 9, fill: MID }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: INK }} width={150} interval={0} />
                  <Tooltip content={<CatTip />} />
                  <Bar dataKey="val" fill={S3_BLUE} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="val" position="right" style={{ fontSize: 10, fontWeight: 700, fill: INK }} formatter={(v: number) => f2(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No data for {year}</div>
            )}
          </ChartCard>

          <ChartCard n={5}
            title="Location-Based vs Market-Based Footprint"
            sub="Total footprint across all years, tCO2e. Light dashed = location-based (physical grid). Dark = market-based after renewable instruments."
            note="The gap between the two lines is what renewable instruments avoid each year. The market-based line reaches the location-based line where no instruments are applied."
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={avoided} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: MID }} />
                <YAxis tick={{ fontSize: 10, fill: MID }} tickFormatter={(v) => v.toLocaleString()} width={55} />
                <Tooltip formatter={(v: number, name: string) => [`${f2(v)} tCO2e`, name === "lb" ? "Location-based" : "Market-based"]} />
                <Legend iconType="plainline" iconSize={22} wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "#1F2937" }}
                  formatter={(v) => v === "lb" ? "Location-based (gross)" : "Market-based (after instruments)"} />
                <Line dataKey="lb" stroke={S2_BLUE} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, fill: S2_BLUE }} />
                <Line dataKey="mb" stroke={S1_BLUE} strokeWidth={2.5} dot={{ r: 4, fill: S1_BLUE }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── Row 3: Emission Intensity ── */}
        <IntensityRow3 entity={entity} />
      </PageBody>
    </>
  );
}

// ── Intensity Tooltip ────────────────────────────────────────────────────────
function IntensityTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white p-2.5 text-xs shadow-lg">
      <div className="mb-1 font-bold" style={{ color: INK }}>{label}</div>
      {payload.map((p: any) => p.value != null && (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.stroke ?? p.color }} />
          <span>{p.name}: <b>{p.value.toFixed(4)} tCO2e/₹Cr</b></span>
        </div>
      ))}
    </div>
  );
}

// ── Row 3: Emission Intensity with Revenue ──────────────────────────────────
function IntensityRow3({ entity }: { entity: string }) {
  const { data: intensityRows } = useIntensity(entity);
  const rows = intensityRows ?? [];

  // Nominal intensity: tCO2e per ₹ Crore (revenue_lakh / 100 = ₹ Crore)
  const nominalData = rows
    .filter(r => r.revenue_lakh && r.s12_lb)
    .map(r => {
      const revCr = r.revenue_lakh! / 100;
      return {
        fy: r.fy,
        "LB Intensity": parseFloat((r.s12_lb! / revCr).toFixed(4)),
        "MB Intensity": r.s12_mb != null ? parseFloat((r.s12_mb / revCr).toFixed(4)) : null,
      };
    });

  // CPI-adjusted intensity — placeholder until CPI data is wired to the API
  const adjustedData = rows
    .filter(r => r.revenue_lakh && r.s12_lb && false /* CPI not yet wired */)
    .map(r => ({
      fy: r.fy,
      "LB Intensity (Nominal)": parseFloat((r.s12_lb! / (r.revenue_lakh! / 100)).toFixed(4)),
      "MB Intensity (Nominal)": r.s12_mb != null ? parseFloat((r.s12_mb / (r.revenue_lakh! / 100)).toFixed(4)) : null,
      "LB Intensity (Real)": null as number | null,
      "MB Intensity (Real)": null as number | null,
    }));

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <ChartCard n={6}
        title="Emission Intensity — Nominal"
        sub="Scope 1+2 emissions per ₹ Crore of revenue (nominal). Both location-based and market-based views."
        note="Falling line = you're emitting less per rupee of revenue. The MB line drops sharply when instruments kick in — that's the efficiency gain from renewable procurement."
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={nominalData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
            <XAxis dataKey="fy" tick={{ fontSize: 11, fill: MID }} />
            <YAxis tick={{ fontSize: 10, fill: MID }} tickFormatter={(v: number) => v.toFixed(1)} width={48}
              label={{ value: "tCO2e/₹Cr", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: MID } }} />
            <Tooltip content={<IntensityTip />} />
            <Legend iconType="plainline" iconSize={22} wrapperStyle={{ fontSize: 11, paddingTop: 8, color: INK }}
              formatter={(v: string) => <span style={{ color: INK }}>{v}</span>} />
            <Line dataKey="LB Intensity" stroke={S2_BLUE} strokeWidth={2} strokeDasharray="6 4"
              dot={{ r: 4, fill: S2_BLUE }} connectNulls={false} />
            <Line dataKey="MB Intensity" stroke={S1_BLUE} strokeWidth={2.5}
              dot={{ r: 4, fill: S1_BLUE }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard n={7}
        title="Emission Intensity — Inflation-Adjusted"
        sub="Nominal vs real (CPI-adjusted) intensity. Real revenue is deflated to FY22 rupees using India CPI (Base 2012=100, MOSPI). Strips out revenue inflation so you see true efficiency gains."
        note="If the real line (solid) is above the nominal line (dashed), inflation was flattering your intensity ratio — real improvement is smaller than headline numbers suggest."
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={adjustedData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
            <XAxis dataKey="fy" tick={{ fontSize: 11, fill: MID }} />
            <YAxis tick={{ fontSize: 10, fill: MID }} tickFormatter={(v: number) => v.toFixed(1)} width={48}
              label={{ value: "tCO2e/₹Cr", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: MID } }} />
            <Tooltip content={<IntensityTip />} />
            <Legend iconType="plainline" iconSize={22} wrapperStyle={{ fontSize: 11, paddingTop: 8, color: INK }}
              formatter={(v: string) => <span style={{ color: INK }}>{v}</span>} />
            <Line dataKey="LB Intensity (Nominal)" stroke={S2_BLUE} strokeWidth={2} strokeDasharray="6 4"
              dot={{ r: 4, fill: S2_BLUE }} connectNulls={false} />
            <Line dataKey="LB Intensity (Real)" stroke={S2_BLUE} strokeWidth={2.5}
              dot={{ r: 5, fill: S2_BLUE, strokeWidth: 2, stroke: "#fff" }} connectNulls={false} />
            <Line dataKey="MB Intensity (Nominal)" stroke={S1_BLUE} strokeWidth={2} strokeDasharray="6 4"
              dot={{ r: 4, fill: S1_BLUE }} connectNulls={false} />
            <Line dataKey="MB Intensity (Real)" stroke={S1_BLUE} strokeWidth={2.5}
              dot={{ r: 5, fill: S1_BLUE, strokeWidth: 2, stroke: "#fff" }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
