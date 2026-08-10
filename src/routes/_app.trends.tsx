import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Section, Card, fmt } from "@/components/portal";
import { useClientContext } from "@/lib/client-context";
import { useInventory, useIntensity, getVal, getMetric } from "@/lib/api";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";
import { useEntity, useFiscalYear } from "@/lib/entity";

export const Route = createFileRoute("/_app/trends")({ component: Trends });

const CYAN = "#0EA5E9", GOLD = "#D97706", EMERALD = "#16A34A", AMBER = "#F59E0B";
const INK = "#1F2937", MID = "#6B7280", BASE = CYAN, LIGHT = EMERALD;
const S3_PALETTE = ["#1E6F5C","#3B82F6","#64748B","#22C55E","#F59E0B","#0EA5E9","#D97706","#16A34A","#CBD5E1","#6B7280"];

const ROW_ORDER = [
  "Scope 1", "Scope 2 LB", "Scope 2 MB",
  "Cat 1", "Cat 2", "Cat 3", "Cat 4", "Cat 5", "Cat 6", "Cat 7", "Cat 9", "Cat 11", "Cat 12",
  "Scope 3 Total", "Grand Total LB", "Grand Total MB",
];
const HIGHLIGHT = new Set(["Scope 1", "Scope 2 LB", "Scope 2 MB", "Scope 3 Total", "Grand Total LB", "Grand Total MB"]);

function yoy(cur: number | null, prev: number | null) {
  if (cur === null || prev === null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function Trends() {
  const { entity } = useEntity();
  const { fy: year } = useFiscalYear();
  const { entities, reporting_years, targets, s3_boundary } = useClientContext();
  const entityShort = (code: string) => entities.find(e => e.code === code)?.short ?? code;
  const entityName  = (code: string) => entities.find(e => e.code === code)?.name ?? code;
  const { data: invData } = useInventory(entity);
  const { data: intensityData } = useIntensity(entity);
  const inv = (metric: string, fy: string) => getVal(invData, metric, fy);
  // data from useInventory hook above
  const fyIdx = reporting_years.indexOf(year);
  const prevYear = (fyIdx > 0 ? reporting_years[fyIdx - 1] : reporting_years[0]);

  const s1Trend = reporting_years.map((y) => ({ year: y, value: inv("Scope 1", y) }));
  const s2Trend = reporting_years.map((y) => ({ year: y, LB: inv("Scope 2 LB", y), MB: inv("Scope 2 MB", y) }));
  const s3Cats = ["Cat 1", "Cat 2", "Cat 3", "Cat 4", "Cat 5", "Cat 6", "Cat 7", "Cat 9", "Cat 11", "Cat 12"] ;
  const s3StackYears = reporting_years.filter(y => y >= "FY24");
  const s3Stack = s3StackYears.map((y) => {
    const row: Record<string, string | number | null> = { year: y };
    s3Cats.forEach((c) => (row[c] = inv(c, y)));
    return row;
  });

  const intensity = (intensityData ?? []).filter(r => r.s12_lb !== null).map(r => ({
    fy: r.fy,
    production: r.production_units,
    revenue: r.revenue_lakh,
    lb: r.revenue_lakh && r.s12_lb ? +(r.s12_lb / r.revenue_lakh).toFixed(4) : null,
    mb: r.revenue_lakh && r.s12_mb ? +(r.s12_mb / r.revenue_lakh).toFixed(4) : null,
  }));

  // Base-year comparisons
  const s12Base = (inv("Scope 1", "FY22") ?? 0) + (inv("Scope 2 LB", "FY22") ?? 0);
  const s12Cur  = (inv("Scope 1", year) ?? 0) + (inv("Scope 2 LB", year) ?? 0);
  const s12Change = ((s12Cur - s12Base) / s12Base) * 100;
  const s3Base = inv("Scope 3 Total", "FY24");
  const s3Cur  = inv("Scope 3 Total", year);
  const s3Change = s3Base && s3Cur ? ((s3Cur - s3Base) / s3Base) * 100 : null;

  return (
    <>
      <PageHeader eyebrow={`Trends · ${entityShort(entity)}`} title="Year-on-Year Trends"
        description="Full 5-year inventory. Scope 1 & 2 compared against the FY22 base year; Scope 3 against the FY24 base year. Real engagement data — audit-ready, formatted to 3 decimals." />
      <PageBody>

        {/* Base-year KPI strip */}
        <div className="mb-8 grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div className="rounded-xl border bg-white p-4">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Scope 1+2 (LB) vs FY22 base year</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${s12Change <= 0 ? "text-[var(--success)]" : "text-[var(--alert)]"}`}>
              {s12Change <= 0 ? "▼" : "▲"} {Math.abs(s12Change).toFixed(1)}%
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{fmt(s12Base, 2)} → {fmt(s12Cur, 2)} tCO2e (FY22 → {year}). Growth-driven — see intensity below.</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Scope 3 vs FY24 base year</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${s3Change !== null && s3Change <= 0 ? "text-[var(--success)]" : "text-[var(--alert)]"}`}>
              {s3Change === null ? "—" : `${s3Change <= 0 ? "▼" : "▲"} ${Math.abs(s3Change).toFixed(1)}%`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{fmt(s3Base, 2)} → {fmt(s3Cur, 2)} tCO2e (FY24 → {year}). FY25 added Cats 4 & 12 to the boundary.</p>
          </div>
        </div>

        <Section title="Inventory table — descending years (tCO2e)">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Line item</th>
                    {[...reporting_years].reverse().map((y) => <th key={y} className="num">{y}</th>)}
                    <th className="num">YoY ({year} vs {prevYear})</th>
                  </tr>
                </thead>
                <tbody>
                  {ROW_ORDER.map((row) => {
                    const cur = inv(row, year);
                    const prev = inv(row, prevYear);
                    const change = yoy(cur, prev);
                    const good = change !== null && change < 0;
                    return (
                      <tr key={row} className={HIGHLIGHT.has(row) ? "bg-[color-mix(in_oklab,var(--navy)_5%,transparent)]" : ""}>
                        <td className={HIGHLIGHT.has(row) ? "font-semibold text-[var(--navy)]" : ""}>{row}</td>
                        {[...reporting_years].reverse().map((y) => <td key={y} className="num">{fmt(inv(row, y))}</td>)}
                        <td className="num">
                          {change === null ? <span className="text-muted-foreground">—</span> : (
                            <span className={`font-semibold ${good ? "text-[var(--success)]" : "text-[var(--alert)]"}`}>{good ? "▼" : "▲"} {Math.abs(change).toFixed(1)}%</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="mt-2 text-xs text-muted-foreground">
            Scope 3 first reported in FY24 (base year). Cats 4 & 12 first reported FY25.
            {" FY26 Scope 3 figures appear once data collection is finalised."}
          </div>
        </Section>

        <Section title="Scope 1 trend" subtitle="tCO2e — vs FY22 base year. Growth in diesel/forklift activity tracks production expansion.">
          <Card>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s1Trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="year" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip formatter={(v: number) => `${(v ?? 0).toFixed(3)} tCO2e`} />
                  <Bar dataKey="value" name="Scope 1" fill={INK} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Section>

        <Section title="Scope 2 — LB vs MB overlay" subtitle={
          (inv("Scope 2 MB", year) ?? 0) === 0
            ? "No market instruments recorded — MB equals LB. Renewable procurement recommended."
            : "Renewable instruments applied — market-based Scope 2 reduced below location-based."
        }>
          <Card>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={s2Trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="year" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip formatter={(v: number) => `${(v ?? 0).toFixed(3)} tCO2e`} />
                  <Legend />
                  <Line type="monotone" dataKey="LB" name="Location-Based" stroke={INK} strokeWidth={3} />
                  <Line type="monotone" dataKey="MB" name="Market-Based" stroke={AMBER} strokeWidth={3} strokeDasharray="6 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Section>

        <Section title="Scope 3 composition — FY24 to FY26" subtitle="Cat 1 (purchased goods) consistently largest; Cat 9 (outbound freight) second. FY24 is the Scope 3 base year.">
          <Card>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s3Stack}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="year" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip formatter={(v: number) => `${(v ?? 0).toFixed(2)}`} />
                  <Legend />
                  {s3Cats.map((c, i) => (
                    <Bar key={c} dataKey={c} stackId="s3" fill={S3_PALETTE[i % S3_PALETTE.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Section>

        <Section title="Revenue vs Scope 1+2 intensity" subtitle="Emissions intensity (tCO2e per ₹ lakh revenue) has fallen consistently against the FY22 base year even as absolute emissions grew with production.">
          <Card>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={intensity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="fy" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis yAxisId="left" stroke="var(--muted-foreground)" fontSize={12} label={{ value: "₹ lakh", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--muted-foreground)" fontSize={12} label={{ value: "tCO2e/lakh", angle: 90, position: "insideRight", style: { fontSize: 11 } }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="revenue" name="Revenue (₹ lakh)" fill={BASE} radius={[6, 6, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="lb" name="LB intensity" stroke={INK} strokeWidth={3} />
                  <Line yAxisId="right" type="monotone" dataKey="mb" name="MB intensity" stroke={AMBER} strokeWidth={3} strokeDasharray="6 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Section>

      </PageBody>
    </>
  );
}
