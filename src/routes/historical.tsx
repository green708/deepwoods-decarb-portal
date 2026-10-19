import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  HISTORICAL, PARTIAL_YEAR, YEARS, type YearKey,
  scopeTotalsByYear, REVENUE_CR, HEADCOUNT, PRODUCTION_T, FLOOR_AREA_M2,
} from "@/lib/ghg/historicalData";
import { downloadAOAsXLSX } from "@/lib/ghg/xlsxHelpers";

export const Route = createFileRoute("/historical")({
  head: () => ({
    meta: [
      { title: "Historical Trends · Featherlite GHG" },
      { name: "description", content: "Year-on-year emissions trends for Featherlite Office Systems FY22–FY26 across Scope 1, 2, and 3." },
      { property: "og:title", content: "Historical Trends · Featherlite GHG" },
      { property: "og:description", content: "Multi-year Scope 1/2/3 emissions trends with intensity metrics." },
    ],
  }),
  component: HistoricalPage,
});

type Intensity = "revenue" | "employee" | "product" | "area";

function HistoricalPage() {
  const [selected, setSelected] = useState<YearKey[]>([...YEARS]);
  const [intensity, setIntensity] = useState<Intensity>("revenue");

  const stackedData = useMemo(() => selected.map((y) => {
    const t = scopeTotalsByYear(y);
    return { year: y, S1: t.s1, "S2 LB": t.s2lb, S3: t.s3 ?? 0, partial: y === PARTIAL_YEAR };
  }), [selected]);

  const lineData = stackedData;

  const kpis = useMemo(() => {
    const sorted = selected.slice().sort();
    const first = sorted[0], last = sorted[sorted.length - 1];
    if (!first || !last) return null;
    const f = scopeTotalsByYear(first), l = scopeTotalsByYear(last);
    const prev = sorted[sorted.length - 2];
    const change = prev ? (l.totalLB - scopeTotalsByYear(prev).totalLB) / scopeTotalsByYear(prev).totalLB : 0;
    const baseline = scopeTotalsByYear("FY22").totalLB;
    const absReduction = baseline - l.totalLB;
    const denom = { revenue: REVENUE_CR, employee: HEADCOUNT, product: PRODUCTION_T, area: FLOOR_AREA_M2 }[intensity][last];
    const unit = { revenue: "tCO₂e / ₹Cr", employee: "tCO₂e / employee", product: "tCO₂e / tonne", area: "tCO₂e / m²" }[intensity];
    return { change, absReduction, intensityValue: l.totalLB / denom, intensityUnit: unit, latest: last };
  }, [selected, intensity]);

  const waterfallYear: YearKey = selected.includes("FY25") ? "FY25" : (selected[0] ?? "FY25");
  const waterfall = useMemo(() => {
    const t = scopeTotalsByYear(waterfallYear);
    return [
      { name: "Location-Based", value: t.s2lb, fill: "#3B82F6" },
      { name: "Solar avoided", value: -Math.round(t.s2lb * 0.42), fill: "#1E6F5C" },
      { name: "Wind / PPA avoided", value: -Math.round(t.s2lb * 0.58 - t.s2mb), fill: "#16A34A" },
      { name: "Market-Based", value: t.s2mb, fill: "#1B2A4A" },
    ];
  }, [waterfallYear]);

  const toggleYear = (y: YearKey) => setSelected((p) => p.includes(y) ? p.filter((x) => x !== y) : [...p, y].sort());

  const exportXLSX = () => {
    const header = ["Category", ...selected];
    const rows = [
      header,
      ...HISTORICAL.map((r) => [r.label, ...selected.map((y) => r.values[y] ?? "Pending")]),
    ];
    downloadAOAsXLSX("Featherlite_GHG_Historical.xlsx", [{ name: "Historical", rows: rows as (string | number)[][] }]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1440px] space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">Historical Trends</h1>
            <p className="text-xs text-muted-foreground">FY22–FY26 · Scope 1, 2 (LB & MB), and Scope 3 emissions</p>
          </div>
          <Button size="sm" onClick={exportXLSX} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Download Excel
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
          <span className="text-xs font-medium text-muted-foreground">Years:</span>
          {YEARS.map((y) => (
            <button key={y} onClick={() => toggleYear(y)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                selected.includes(y) ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent",
              )}>
              {selected.includes(y) && "✓ "}{y}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Intensity:</span>
            <Select value={intensity} onValueChange={(v) => setIntensity(v as Intensity)}>
              <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">per ₹Cr revenue</SelectItem>
                <SelectItem value="employee">per employee</SelectItem>
                <SelectItem value="product">per tonne product</SelectItem>
                <SelectItem value="area">per m²</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {kpis && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <KPI label={`vs previous year (S1+S2+S3, ${kpis.latest})`}
              value={`${kpis.change >= 0 ? "+" : ""}${(kpis.change * 100).toFixed(1)}%`}
              positive={kpis.change < 0}
              icon={kpis.change < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />} />
            <KPI label="Absolute reduction since FY22"
              value={`${kpis.absReduction.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e`}
              positive={kpis.absReduction > 0} />
            <KPI label={`Intensity — ${kpis.intensityUnit}`}
              value={kpis.intensityValue.toFixed(2)} />
          </div>
        )}

        <ChartCard title="Emissions by Scope (stacked, tCO₂e)">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={stackedData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="S1" stackId="a" fill="#1B2A4A" />
              <Bar dataKey="S2 LB" stackId="a" fill="#3B82F6" />
              <Bar dataKey="S3" stackId="a" fill="#1E6F5C">
                {stackedData.map((d, i) => (
                  <Cell key={i} strokeDasharray={d.partial ? "4 3" : undefined} strokeWidth={d.partial ? 2 : 0} stroke={d.partial ? "#D97706" : undefined} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[11px] text-muted-foreground">Dashed borders indicate partial-year (in progress) data.</p>
        </ChartCard>

        <ChartCard title="Trajectory by Scope">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="S1" stroke="#1B2A4A" strokeWidth={2} />
              <Line type="monotone" dataKey="S2 LB" stroke="#3B82F6" strokeWidth={2} />
              <Line type="monotone" dataKey="S3" stroke="#1E6F5C" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Scope 2 Waterfall — ${waterfallYear} (Location-Based → Market-Based)`}>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={waterfall}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value">
                {waterfall.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="overflow-auto rounded-lg border bg-card">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-navy text-navy-foreground">
                <th className="px-3 py-2 text-left text-xs">Scope / Category</th>
                {selected.map((y) => <th key={y} className="px-3 py-2 text-right text-xs">{y}</th>)}
              </tr>
            </thead>
            <tbody>
              {HISTORICAL.map((r) => (
                <tr key={r.key} className="border-b last:border-b-0">
                  <td className="px-3 py-1.5 text-xs">{r.label}</td>
                  {selected.map((y) => (
                    <td key={y} className="px-3 py-1.5 text-right text-xs tabular-nums">
                      {r.values[y] == null ? <Badge variant="outline" className="text-[9px]">Pending</Badge>
                        : r.values[y]!.toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, positive, icon }: { label: string; value: string; positive?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 flex items-center gap-2 text-2xl font-bold tabular-nums",
        positive === true ? "text-ghg-green" : positive === false ? "text-critical" : "text-navy")}>
        {icon}{value}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold text-navy">{title}</h3>
      {children}
    </div>
  );
}
