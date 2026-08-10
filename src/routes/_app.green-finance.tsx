import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { PageBody, PageHeader } from "@/components/portal";
import { useClientContext } from "@/lib/client-context";
import { useInventory, useIntensity, getVal, getMetric, type InventoryResponse, type IntensityRow } from "@/lib/api";
import { useEntity, useFiscalYear } from "@/lib/entity";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export const Route = createFileRoute("/_app/green-finance")({ component: GreenFinance });

// ── Design tokens ──────────────────────────────────────────────────────────────
const GREEN   = "#1E6F5C";
const BLUE    = "#3B82F6";
const INK     = "#1F2937";
const MID     = "#6B7280";
const EMERALD = "#16A34A";
const ERROR   = "#D90429";
const AMBER   = "#F59E0B";
const LIGHT   = "#E6F4EF";

// ── Formatters ─────────────────────────────────────────────────────────────────
const f2  = (v: number | null, dp = 2) =>
  v == null ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const f0  = (v: number | null) => v == null ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
const cr  = (lakh: number | null) =>
  lakh == null ? "—" : lakh >= 100 ? `₹${(lakh / 100).toFixed(2)} Cr` : `₹${lakh.toFixed(2)} L`;

// ── Per-FY data slice ─────────────────────────────────────────────────────────
type Slice = {
  fy: string; s1: number | null; s2lb: number | null; s2mb: number | null;
  instruments: number | null; s3: number | null;
  gtlb: number | null; gtmb: number | null;
  s12lb: number | null; s12mb: number | null;
  revenueLakh: number | null;
}

type FY = string;

function buildSlices(invData: InventoryResponse | undefined, intensityData: IntensityRow[] | undefined, years: string[]): Slice[] {
  const intn = intensityData ?? [];
  return years.map(fy => {
    const s1   = getVal(invData, "Scope 1", fy);
    const s2lb = getVal(invData, "Scope 2 LB", fy);
    const s2mb = getVal(invData, "Scope 2 MB", fy);
    const s3   = getVal(invData, "Scope 3 Total", fy);
    const gtlb = getVal(invData, "Grand Total LB", fy);
    const gtmb = getVal(invData, "Grand Total MB", fy);
    const row  = intn.find(r => r.fy === fy);
    return {
      fy, s1, s2lb, s2mb,
      instruments: (s2lb != null && s2mb != null) ? s2lb - s2mb : null,
      s3, gtlb, gtmb,
      s12lb: (s1 != null && s2lb != null) ? s1 + s2lb : null,
      s12mb: (s1 != null && s2mb != null) ? s1 + s2mb : null,
      revenueLakh: row?.revenue_lakh ?? null,
    };
  });
}

// ── Carbon Price Scenarios — declared inside GreenFinance() below ─────────────

// ── Mini Arrow ────────────────────────────────────────────────────────────────
function Arrow({ cur, prev, goodDir }: { cur: number | null; prev: number | null; goodDir: "down" | "up" }) {
  if (cur == null || prev == null || prev === 0) return <span className="text-muted-foreground text-[10px]">—</span>;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const isGood = goodDir === "down" ? pct < 0 : pct > 0;
  const color  = isGood ? EMERALD : ERROR;
  const Icon   = pct < 0 ? TrendingDown : pct > 0 ? TrendingUp : Minus;
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold tabular-nums" style={{ color }}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ── Carbon Income Statement Table ─────────────────────────────────────────────
type RowDef = {
  id: string; label: string; note?: string;
  type: "section-header" | "line" | "instrument" | "subtotal" | "total" | "spacer";
  indent?: 1 | 2;
  get: (s: Slice) => number | null;
  paren?: boolean;    // show value as (xxx) if > 0
  goodDir?: "down" | "up";
}

const ROWS: RowDef[] = [
  { id: "sec1",    label: "OPERATIONAL EMISSIONS",                        type: "section-header", get: () => null },
  { id: "s1",      label: "Scope 1 — Direct (combustion + fugitive)",     type: "line",   indent: 1, get: s => s.s1,   goodDir: "down" },
  { id: "s2lb",    label: "Scope 2 — Location-Based (grid electricity)",  type: "line",   indent: 1, get: s => s.s2lb, goodDir: "down" },
  { id: "gross",   label: "Gross Operational (Location-Based)",           type: "subtotal",         get: s => s.s12lb, goodDir: "down" },
  { id: "sec2",    label: "RENEWABLE INSTRUMENTS",                        type: "section-header", get: () => null },
  { id: "inst",    label: "Less: Wind PPA & I-REC Coverage",              type: "instrument", indent: 1, paren: true, get: s => s.instruments, goodDir: "up" },
  { id: "netop",   label: "Net Operational (Market-Based)",               type: "subtotal", get: s => s.s12mb, goodDir: "down" },
  { id: "spacer1", label: "", type: "spacer", get: () => null },
  { id: "sec3",    label: "VALUE CHAIN EMISSIONS",                        type: "section-header", get: () => null },
  { id: "s3",      label: "Scope 3 — Supply chain & use phase",           type: "line", indent: 1, get: s => s.s3, goodDir: "down" },
  { id: "spacer2", label: "", type: "spacer", get: () => null },
  { id: "gtmb",    label: "NET TOTAL FOOTPRINT (Market-Based)",           type: "total", get: s => s.gtmb, goodDir: "down" },
  { id: "gtlb",    label: "Gross Total Footprint (Location-Based)",       type: "line", indent: 1, get: s => s.gtlb, goodDir: "down" },
];

function StatementTable({ slices, curYear, prevYear, fys, baseYear, baseYearS3 }: {
  slices: Slice[]; curYear: string; prevYear: FY; fys: string[]; baseYear: string; baseYearS3: string;
}) {
  const byFY: Record<FY, Slice> = Object.fromEntries(slices.map(s => [s.fy, s])) as Record<FY, Slice>;
  const prevSlice = byFY[prevYear];
  const curSlice  = byFY[curYear];

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: 700 }}>
        <thead>
          <tr style={{ background: GREEN }}>
            <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-widest text-white w-[42%]">Line Item</th>
            {fys.map(fy => (
              <th key={fy} className="py-3 px-3 text-right text-xs font-semibold uppercase tracking-widest text-white">{fy}</th>
            ))}
            <th className="py-3 px-3 text-right text-xs font-semibold uppercase tracking-widest text-white">YoY</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, idx) => {
            if (row.type === "spacer") return <tr key={row.id}><td colSpan={6} className="h-2" /></tr>;

            const isSectionHdr = row.type === "section-header";
            const isTotal      = row.type === "total";
            const isSubtotal   = row.type === "subtotal";
            const isInstrument = row.type === "instrument";

            const rowBg = isSectionHdr
              ? "#F8FAFB"
              : isTotal
              ? LIGHT
              : idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA";

            const textStyle = isSectionHdr
              ? { color: GREEN, fontWeight: 700, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase"  }
              : isTotal
              ? { color: GREEN, fontWeight: 700, fontSize: 13 }
              : isSubtotal
              ? { color: INK, fontWeight: 600, fontSize: 12 }
              : isInstrument
              ? { color: EMERALD, fontWeight: 500 }
              : { color: INK };

            const cur  = row.get(curSlice);
            const prev = row.get(prevSlice);

            return (
              <tr key={row.id} style={{ background: rowBg, borderBottom: "1px solid #F0F0F0" }}>
                <td className="py-2.5 px-4" style={{ paddingLeft: row.indent === 1 ? 28 : row.indent === 2 ? 44 : 16 }}>
                  <span style={textStyle}>{row.label}</span>
                  {row.note && <div className="text-[10px] text-muted-foreground mt-0.5">{row.note}</div>}
                </td>

                {fys.map(fy => {
                  const val = row.get(byFY[fy]);
                  if (isSectionHdr || val == null) {
                    return <td key={fy} className="py-2.5 px-3 text-right text-muted-foreground text-xs">{isSectionHdr ? "" : "—"}</td>;
                  }
                  const display = row.paren ? `(${f2(val)})` : f2(val);
                  return (
                    <td key={fy} className="py-2.5 px-3 text-right tabular-nums" style={textStyle}>
                      {display}
                    </td>
                  );
                })}

                <td className="py-2.5 px-3 text-right">
                  {isSectionHdr ? null : <Arrow cur={cur} prev={prev} goodDir={row.goodDir ?? "down"} />}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: "#F0F7F4", borderTop: `2px solid ${GREEN}` }}>
            <td className="py-2 px-4 text-[10px] font-semibold text-muted-foreground" colSpan={fys.length + 2}>
              tCO2e — GHG Protocol + ISO 14064-1, operational control boundary. Scope 1 & 2 base year {baseYear} · Scope 3 base year {baseYearS3}.
              Instruments = renewable PPAs + I-REC retirements per entity. — = not yet available or not applicable for that year.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Tooltip helpers ────────────────────────────────────────────────────────────
function PriceTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white p-2.5 text-xs shadow-lg">
      <div className="mb-1.5 font-bold" style={{ color: INK }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{cr(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function IntTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white p-2.5 text-xs shadow-lg">
      <div className="mb-1.5 font-bold" style={{ color: INK }}>{label}</div>
      {payload.map((p: any) => p.value != null && (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.stroke }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{p.value.toFixed(3)} tCO2e/₹L</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function GreenFinance() {
  const { entity } = useEntity();
  const { fy: year } = useFiscalYear();
  const ctx = useClientContext();
  const { entities, reporting_years, targets, s3_boundary } = ctx;
  const entityShort = (code: string) => entities.find(e => e.code === code)?.short ?? code;
  const entityName  = (code: string) => entities.find(e => e.code === code)?.name ?? code;
  const PRICES = ((ctx.config.carbon_prices as any[]) ?? []);
  const baseYear   = (ctx.config?.base_year_s12 as string | undefined) ?? reporting_years[0] ?? "FY22";
  const baseYearS3 = (ctx.config?.base_year_s3  as string | undefined) ?? "FY24";
  const fys = reporting_years.length > 0 ? reporting_years : ["FY22","FY23","FY24","FY25"];
  const { data: invData } = useInventory(entity);
  const { data: intensityData } = useIntensity(entity);
  const inv = (metric: string, fy: string) => getVal(invData, metric, fy);
  const slices = buildSlices(invData, intensityData, fys);
  const fyIdx    = reporting_years.indexOf(year);
  const prevYear = (fyIdx > 0 ? reporting_years[fyIdx - 1] : reporting_years[0]);
  const curSlice  = slices.find(s => s.fy === year) ?? slices[slices.length - 1];
  const baseSlice = slices.find(s => s.fy === baseYear) ?? slices[0];

  // ── KPI derivations ───────────────────────────────────────────────────────
  const netMB      = curSlice.gtmb;
  const instruments = curSlice.instruments;
  const coverage    = (curSlice.s2lb && instruments) ? (instruments / curSlice.s2lb * 100) : 0;

  // Intensity: tCO2e per ₹ lakh
  const intMBCur = (curSlice.s12mb && curSlice.revenueLakh) ? curSlice.s12mb / curSlice.revenueLakh : null;
  const intLBCur = (curSlice.s12lb && curSlice.revenueLakh) ? curSlice.s12lb / curSlice.revenueLakh : null;

  const intMBBase = (baseSlice.s12mb && baseSlice.revenueLakh) ? baseSlice.s12mb / baseSlice.revenueLakh : null;

  const intensityImprovement =
    intMBBase && intMBCur
      ? ((intMBCur - intMBBase) / intMBBase) * 100
      : null;

  // S1+2 MB abatement vs base year
  const baselineMB = baseSlice.s12mb;
  const currentMB  = curSlice.s12mb;
  const abatementPct =
    baselineMB && currentMB ? ((currentMB - baselineMB) / baselineMB) * 100 : null;

  // Carbon Value at Risk (₹ lakh) at ₹1,000/t
  const cvarAt1k = netMB ? (netMB * 1000) / 100000 : null;

  // S3 share of total
  const s3Share  = (netMB && curSlice.s3) ? (curSlice.s3 / netMB * 100) : null;

  // ── Price sensitivity data ────────────────────────────────────────────────
  const priceData = PRICES.map(p => ({
    label: p.label,
    note:  p.note,
    "Full Footprint": netMB ? parseFloat(((netMB * p.price) / 100000).toFixed(2)) : 0,
    "Operational Only": curSlice.s12mb ? parseFloat(((curSlice.s12mb * p.price) / 100000).toFixed(2)) : 0,
    "Hedge Value": instruments ? parseFloat(((instruments * p.price) / 100000).toFixed(2)) : 0,
  }));

  // ── Intensity trend ────────────────────────────────────────────────────────
  const intensityTrend = slices
    .filter(s => s.revenueLakh && s.s12lb)
    .map(s => ({
      fy: s.fy,
      "LB Intensity": s.s12lb && s.revenueLakh ? parseFloat((s.s12lb / s.revenueLakh * 100).toFixed(4)) : null,
      "MB Intensity": s.s12mb && s.revenueLakh ? parseFloat((s.s12mb / s.revenueLakh * 100).toFixed(4)) : null,
    }));
  // Note: multiplied by 100 to convert from tCO2e/₹L to tCO2e/₹ crore equivalent (×100 = per crore)

  // ── Scope attribution for FY25 (MB basis) ────────────────────────────────
  const attrData = [
    { name: "Scope 1\n(Direct)", value: curSlice.s12mb && curSlice.s3 ? parseFloat(((curSlice.s12mb / (curSlice.gtmb ?? 1)) * 100).toFixed(1)) : 0, fill: GREEN },
    { name: "Scope 3\n(Value Chain)", value: s3Share ? parseFloat(s3Share.toFixed(1)) : 0, fill: BLUE },
  ];

  return (
    <>
      <PageHeader
        eyebrow={`Green Finance · ${entityShort(entity)}`}
        title="Carbon P&L"
        description="Your emissions footprint read like a financial statement — gross position, instrument coverage, net exposure, and carbon price risk. FY2024-25 actuals."
      />
      <PageBody>

        {/* ── KPI Strip ── */}
        <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            {
              label: "Net Carbon Position",
              value: f0(netMB),
              unit: "tCO2e (MB)",
              sub: `${year} · market-based`,
              accent: GREEN,
              bg: LIGHT,
            },
            {
              label: "Instruments Applied",
              value: f0(instruments),
              unit: "tCO2e avoided",
              sub: `${coverage.toFixed(0)}% of Scope 2 covered`,
              accent: EMERALD,
              bg: "#F0FDF4",
            },
            {
              label: "Carbon Intensity (MB)",
              value: intMBCur ? (intMBCur * 100).toFixed(3) : "—",
              unit: "tCO2e / ₹ Cr",
              sub: intensityImprovement != null ? `${intensityImprovement.toFixed(1)}% vs ${baseYear} base` : "",
              accent: intensityImprovement != null && intensityImprovement < 0 ? EMERALD : AMBER,
              bg: intensityImprovement != null && intensityImprovement < 0 ? "#F0FDF4" : "#FFFBEB",
            },
            {
              label: `S1+2 vs ${baseYear} Baseline`,
              value: abatementPct != null ? `${abatementPct.toFixed(1)}%` : "—",
              unit: "MB change",
              sub: abatementPct != null && abatementPct < 0 ? "Reduced — instruments driving this" : "Tracking above baseline",
              accent: abatementPct != null && abatementPct < 0 ? EMERALD : ERROR,
              bg: abatementPct != null && abatementPct < 0 ? "#F0FDF4" : "#FFF1F2",
            },
            {
              label: "Carbon Value-at-Risk",
              value: cvarAt1k ? cr(cvarAt1k) : "—",
              unit: "at ₹1,000/tCO2e",
              sub: "Full footprint · net MB",
              accent: AMBER,
              bg: "#FFFBEB",
            },
            {
              label: "Scope 3 Concentration",
              value: s3Share ? `${s3Share.toFixed(1)}%` : "—",
              unit: "of net footprint",
              sub: "Value chain dominates",
              accent: BLUE,
              bg: "#EFF6FF",
            },
          ].map(k => (
            <div key={k.label}
              className="rounded-xl border p-4 shadow-[rgba(15,23,42,0.06)_0px_1px_3px]"
              style={{ background: k.bg, borderLeftWidth: 3, borderLeftColor: k.accent }}>
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{k.label}</div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums" style={{ color: k.accent }}>{k.value}</div>
              <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">{k.unit}</div>
              {k.sub && <div className="mt-1 text-[10px] text-muted-foreground leading-tight">{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── Section 1: Carbon Income Statement ── */}
        <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4" style={{ background: "#F8FAFB" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: GREEN }}>
                  Carbon Income Statement
                </div>
                <h3 className="mt-0.5 text-[17px] font-semibold" style={{ color: INK }}>
                  Gross → Instruments → Net Position
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                  Structured like a financial P&amp;L — read top to bottom: gross emissions from operations,
                  deduct renewable instruments, arrive at market-based net. Add the value chain and you have
                  the full carbon cost of the business.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Unit</div>
                <div className="text-sm font-semibold" style={{ color: INK }}>tCO2e</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{baseYear} – {year}</div>
              </div>
            </div>
          </div>
          <StatementTable slices={slices} curYear={year} prevYear={prevYear} fys={fys} baseYear={baseYear} baseYearS3={baseYearS3} />
        </div>

        {/* ── Section 2: Intensity + Price Sensitivity ── */}
        <div className="mb-6 grid gap-4 lg:grid-cols-2">

          {/* Carbon Intensity Trend */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: GREEN }}>Carbon Efficiency</div>
            <h4 className="font-semibold text-[16px] mb-0.5" style={{ color: INK }}>
              Intensity — tCO2e per ₹ Crore Revenue
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              Location-based vs market-based S1+2 per crore of revenue. Instruments collapse the MB line — this is your true carbon efficiency ratio after all sustainability investments.
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={intensityTrend} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                <XAxis dataKey="fy" tick={{ fontSize: 11, fill: MID }} />
                <YAxis tick={{ fontSize: 10, fill: MID }} tickFormatter={(v: number) => v.toFixed(1)} width={48}
                  label={{ value: "tCO2e/₹Cr", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: MID } }} />
                <Tooltip content={<IntTip />} />
                <Legend iconType="plainline" iconSize={22} wrapperStyle={{ fontSize: 11, paddingTop: 8, color: INK }}
                  formatter={(v: string) => <span style={{ color: INK }}>{v}</span>} />
                <Line dataKey="LB Intensity" stroke={BLUE} strokeWidth={2} strokeDasharray="6 4"
                  dot={{ r: 4, fill: BLUE }} connectNulls={false} />
                <Line dataKey="MB Intensity" stroke={GREEN} strokeWidth={2.5}
                  dot={{ r: 4, fill: GREEN }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed"
              style={{ borderLeft: "3px solid #1E6F5C", background: "#F8FAFB", color: MID }}>
              <span className="font-bold" style={{ color: GREEN }}>How to read it: </span>
              The gap between LB (dashed blue) and MB (solid green) is the efficiency gain from renewable instruments. Widening gap = instruments doing more work per rupee of revenue.
            </div>
          </div>

          {/* Carbon Price Sensitivity */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: GREEN }}>Carbon Value-at-Risk</div>
            <h4 className="font-semibold text-[16px] mb-0.5" style={{ color: INK }}>
              Carbon Cost Exposure — {year}
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              What the {year} net footprint would cost at four regulatory carbon price scenarios. Hedge Value = what the instruments already saved at each price. Full footprint includes Scope 3.
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={priceData} margin={{ top: 16, right: 8, left: 4, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: MID }} />
                <YAxis tick={{ fontSize: 10, fill: MID }} tickFormatter={(v: number) => `₹${v}L`} width={56} />
                <Tooltip content={<PriceTip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: INK }}
                  formatter={(v: string) => <span style={{ color: INK }}>{v}</span>} />
                <Bar dataKey="Full Footprint"   fill={BLUE}    radius={[4, 4, 0, 0]} />
                <Bar dataKey="Operational Only" fill={GREEN}   radius={[4, 4, 0, 0]} />
                <Bar dataKey="Hedge Value"      fill={EMERALD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed"
              style={{ borderLeft: "3px solid #1E6F5C", background: "#F8FAFB", color: MID }}>
              <span className="font-bold" style={{ color: GREEN }}>How to read it: </span>
              Blue = full carbon liability. Green = operational liability only (Scope 1+2 MB). Teal = value of avoided emissions from instruments — your carbon hedge growing in value as price rises.
            </div>
          </div>
        </div>

        {/* ── Section 3: Carbon Balance Sheet ── */}
        <div className="mb-6 grid gap-4 lg:grid-cols-3">

          {/* Carbon Assets */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: EMERALD }}>Carbon Assets</div>
            <div className="space-y-3">
              {[
                {
                  label: `Instruments Retired ${year}`,
                  value: f0(instruments) + " tCO2e",
                  note: "Wind PPA + I-RECs in force",
                  color: EMERALD,
                },
                {
                  label: `${prevYear} Instruments (prior year)`,
                  value: f0(slices.find(s => s.fy === prevYear)?.instruments ?? null) + " tCO2e",
                  note: "Prior year comparison",
                  color: EMERALD,
                },
                {
                  label: "Scope 2 MB = Zero",
                  value: instruments === 0 ? "Pending — no instruments recorded" : "Achieved",
                  note: "100% grid electricity covered by instruments",
                  color: instruments === 0 ? AMBER : EMERALD,
                },
                {
                  label: "S1+2 Intensity Improvement",
                  value: intensityImprovement != null ? `${Math.abs(intensityImprovement).toFixed(1)}% better` : "—",
                  note: `MB intensity vs ${baseYear} base year`,
                  color: intensityImprovement != null && intensityImprovement < 0 ? EMERALD : AMBER,
                },
              ].map(a => (
                <div key={a.label} className="flex items-start justify-between gap-2 border-b pb-2.5 last:border-0 last:pb-0">
                  <div>
                    <div className="text-xs font-semibold" style={{ color: INK }}>{a.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{a.note}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs font-bold tabular-nums" style={{ color: a.color }}>{a.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Carbon Liabilities */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: ERROR }}>Carbon Liabilities</div>
            <div className="space-y-3">
              {[
                {
                  label: "Scope 3 Concentration Risk",
                  value: s3Share ? `${s3Share.toFixed(1)}%` : "—",
                  note: "Of net footprint in value chain — Cat 1 dominates",
                  color: s3Share && s3Share > 90 ? ERROR : AMBER,
                },
                {
                  label: "S1+2 SBTi Reduction Gap",
                  value: (() => {
                    const base = baseSlice.s12lb ?? 0;
                    const sbtiPct = (ctx.config?.sbti_target_s12 as number | undefined) ?? 42;
                    const target = base * (1 - sbtiPct / 100);
                    const current = curSlice.s12lb ?? 0;
                    const gap = current - target;
                    return gap > 0 ? `+${f0(gap)} tCO2e` : "On track";
                  })(),
                  note: `LB gap to SBTi reduction target vs ${baseYear} base`,
                  color: (() => {
                    const base = baseSlice.s12lb ?? 0;
                    const sbtiPct = (ctx.config?.sbti_target_s12 as number | undefined) ?? 42;
                    const target = base * (1 - sbtiPct / 100);
                    return (curSlice.s12lb ?? 0) > target ? ERROR : EMERALD;
                  })(),
                },
                {
                  label: "Value-at-Risk @ ₹1,000/t",
                  value: cvarAt1k ? cr(cvarAt1k) : "—",
                  note: "Full footprint carbon cost at near-term compliance price",
                  color: ERROR,
                },
                {
                  label: "Scope 3 Supplier Engagement",
                  value: "Not started",
                  note: "Primary-data EFs from top suppliers — highest abatement lever",
                  color: AMBER,
                },
              ].map(l => (
                <div key={l.label} className="flex items-start justify-between gap-2 border-b pb-2.5 last:border-0 last:pb-0">
                  <div>
                    <div className="text-xs font-semibold" style={{ color: INK }}>{l.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{l.note}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs font-bold tabular-nums" style={{ color: l.color }}>{l.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Net Position Summary */}
          <div className="rounded-xl border p-5 shadow-sm" style={{ background: LIGHT, borderColor: `${GREEN}40` }}>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: GREEN }}>Net Carbon Position — {year}</div>

            <div className="space-y-2 mb-4">
              {[
                { label: "Gross LB footprint",    value: f0(curSlice.gtlb), op: null     },
                { label: "Less: Instruments",      value: instruments ? `(${f0(instruments)})` : "—", op: "minus" },
                { label: "Net MB operational",     value: f0(curSlice.s12mb), op: "line"  },
                { label: "Add: Scope 3",           value: f0(curSlice.s3),   op: "plus"  },
                { label: "NET TOTAL (MB)",         value: f0(netMB),     op: "double" },
              ].map(r => (
                <div key={r.label} className={`flex justify-between items-center ${r.op === "double" ? "border-t-2 pt-2 mt-1" : r.op === "line" ? "border-t pt-2 mt-1" : ""}`}
                  style={ r.op === "double" ? { borderColor: GREEN } : r.op === "line" ? { borderColor: `${GREEN}40` } : {}}>
                  <span className={`text-xs ${r.op === "double" ? "font-bold" : "text-muted-foreground"}`}
                    style={ r.op === "double" ? { color: GREEN } : {}}>
                    {r.label}
                  </span>
                  <span className={`text-sm tabular-nums font-semibold ${r.op === "minus" ? "text-emerald-600" : ""}`}
                    style={{ color: r.op === "double" ? GREEN : r.op === "minus" ? EMERALD : INK }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t pt-3" style={{ borderColor: `${GREEN}40` }}>
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Revenue context</div>
              {curSlice.revenueLakh && netMB ? (
                <div className="text-xs text-muted-foreground">
                  Carbon liability at ₹1,000/t = <span className="font-bold" style={{ color: INK }}>{cr((netMB * 1000) / 100000)}</span>
                  {" "}vs revenue of <span className="font-bold" style={{ color: INK }}>{cr(curSlice.revenueLakh)}</span>
                  {" "}= <span className="font-bold" style={{ color: AMBER }}>{((netMB * 1000 / 100000 / curSlice.revenueLakh) * 100).toFixed(2)}% of top-line</span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Revenue data not available for this entity/year.</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 4: Green Hedge ROI table ── */}
        <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4" style={{ background: "#F8FAFB" }}>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: GREEN }}>Carbon Hedge Valuation</div>
            <h4 className="font-semibold text-[16px]" style={{ color: INK }}>
              Value of Renewable Instruments at Carbon Price Scenarios
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Renewable instruments (wind PPA + I-RECs) act as a hedge against future carbon pricing.
              The table shows what the {f0(instruments)} tCO2e avoided would be worth if a carbon price applies to Scope 2 emissions.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 560 }}>
              <thead>
                <tr style={{ background: "#F8FAFB", borderBottom: "2px solid #E5E7EB" }}>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price Scenario</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Context</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hedge Value (avoided)</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Footprint Cost</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">% of Revenue</th>
                </tr>
              </thead>
              <tbody>
                {PRICES.map((p, i) => {
                  const hedgeVal  = instruments ? (instruments * p.price) / 100000 : null;
                  const totalCost = netMB ? (netMB * p.price) / 100000 : null;
                  const revPct    = (curSlice.revenueLakh && totalCost) ? (totalCost / curSlice.revenueLakh * 100) : null;
                  return (
                    <tr key={p.price} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA", borderBottom: "1px solid #F0F0F0" }}>
                      <td className="py-3 px-4 font-bold tabular-nums" style={{ color: GREEN }}>{p.label}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{p.note}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums" style={{ color: EMERALD }}>{cr(hedgeVal)}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums" style={{ color: INK }}>{cr(totalCost)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-xs font-semibold" style={{ color: revPct && revPct > 3 ? ERROR : revPct && revPct > 1 ? AMBER : MID }}>
                        {revPct ? `${revPct.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Learn more */}
          <details className="mt-4 rounded-lg border bg-muted/40 text-xs">
            <summary className="cursor-pointer px-4 py-2.5 font-semibold" style={{ color: GREEN }}>Learn more</summary>
            <div className="px-4 pb-3 pt-1 leading-relaxed text-muted-foreground">
              The portfolio avoided {f0(instruments)} tCO2e in {year} by purchasing renewable electricity (wind PPA + I-RECs) instead of relying on grid power. That avoided carbon has no direct monetary value today — but it would if India introduces a carbon price or if cross-border carbon adjustment mechanisms apply to your exports.
              The four rows are "what if" scenarios at different price levels. At ₹500 per ton (roughly what voluntary carbon credits cost in India today), those {f0(instruments)} avoided tons save about ₹{instruments ? ((instruments * 500) / 100000).toFixed(2) : "—"} lakh. At ₹5,000 per ton (the price economists say is needed for net-zero alignment), the same avoided tons are worth ₹{instruments ? ((instruments * 5000) / 100000).toFixed(2) : "—"} lakh.
              In short: the higher carbon prices go in the future, the more valuable your existing renewable investments become.
            </div>
          </details>
        </div>

        {/* ── Section 5: Year-over-year Carbon P&L ── */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: GREEN }}>Year-over-Year</div>
          <h4 className="font-semibold text-[16px] mb-1" style={{ color: INK }}>Carbon P&amp;L Evolution — Scope 1+2 (Market-Based)</h4>
          <p className="text-xs text-muted-foreground mb-4">
            Tracks gross S1+2 and net MB position year-on-year. The gap between LB and MB bars represents renewable instrument coverage — I-RECs and wind PPAs that collapse the market-based Scope 2 figure.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={slices.filter(s => s.s12lb).map(s => ({
                fy:    s.fy,
                "Gross S1+2 (LB)": s.s12lb,
                "Net S1+2 (MB)":   s.s12mb,
                "Instruments":     s.instruments && s.instruments > 0 ? s.instruments : 0,
              }))}
              margin={{ top: 16, right: 16, left: 8, bottom: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" vertical={false} />
              <XAxis dataKey="fy" tick={{ fontSize: 11, fill: MID }} />
              <YAxis tick={{ fontSize: 10, fill: MID }} tickFormatter={(v: number) => f0(v)} width={60} />
              <Tooltip
                formatter={(v: number, name: string) => [`${f2(v)} tCO2e`, name]}
                labelStyle={{ color: INK, fontWeight: 700, marginBottom: 4 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: INK }}
                formatter={(v: string) => <span style={{ color: INK }}>{v}</span>} />
              <Bar dataKey="Gross S1+2 (LB)" fill={BLUE}    radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net S1+2 (MB)"   fill={GREEN}   radius={[4, 4, 0, 0]} />
              <Bar dataKey="Instruments"      fill={EMERALD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed"
            style={{ borderLeft: "3px solid #1E6F5C", background: "#F7F7F7", color: MID }}>
            <span className="font-bold" style={{ color: GREEN }}>How to read it: </span>
            Blue = gross location-based Scope 1+2. Green = what remains after market instruments (net MB). Teal = instruments applied. In years without instruments, all three bars align. As instruments are introduced, the green bar falls below the blue bar.
          </div>
        </div>

      </PageBody>
    </>
  );
}
