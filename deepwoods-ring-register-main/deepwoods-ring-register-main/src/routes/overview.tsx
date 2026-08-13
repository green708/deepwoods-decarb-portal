import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TopLevelShell } from "@/components/portal/shell";
import { MicroLabel, RingNumber } from "@/components/portal/primitives";
import { usePortal } from "@/lib/portal-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Overview — Deepwoods GHG Portal" },
      {
        name: "description",
        content:
          "Group-level greenhouse gas performance aggregated across every registered entity: Scope 1, 2 and 3, intensity and reduction pace.",
      },
      { property: "og:title", content: "Overview — Deepwoods GHG Portal" },
      {
        property: "og:description",
        content: "Combined GHG dashboard across all entities in your group.",
      },
    ],
  }),
  component: Overview,
});

const CANOPY = "#1F4B3B";
const MEADOW = "#1E9E5A";
const CORAL = "#E4572E";
const AMBER = "#C97A2E";

function Overview() {
  const { accounts, fiscalYear, setFiscalYear } = usePortal();

  const totals = useMemo(() => {
    const s1 = accounts.reduce((n, a) => n + a.emissions.scope1, 0);
    const s2 = accounts.reduce((n, a) => n + a.emissions.scope2, 0);
    const s3 = accounts.reduce((n, a) => n + a.emissions.scope3, 0);
    return { s1, s2, s3, total: s1 + s2 + s3 };
  }, [accounts]);

  const fmt = (n: number) => n.toLocaleString("en-IN");

  const pace = [
    { year: "FY22", actual: 5900, pathway: 5900 },
    { year: "FY23", actual: 5610, pathway: 5660 },
    { year: "FY24", actual: 5320, pathway: 5420 },
    { year: "FY25", actual: totals.s1 + totals.s2, pathway: 5180 },
    { year: "FY26", actual: null, pathway: 4940 },
  ];

  const waterfall = [
    { name: "Location-based", value: 5610 },
    { name: "Instruments applied", value: -1650 },
    { name: "Net market-based", value: 3960 },
  ];

  const composition = [
    { name: "Scope 1", value: totals.s1, fill: CANOPY },
    { name: "Scope 2", value: totals.s2, fill: MEADOW },
    { name: "Scope 3", value: totals.s3, fill: AMBER },
  ];

  const scope3 = [
    { name: "Purchased goods", value: 4820 },
    { name: "Upstream transport", value: 1980 },
    { name: "Business travel", value: 1140 },
    { name: "Employee commuting", value: 780 },
    { name: "Waste", value: 460 },
    { name: "Capital goods", value: 280 },
  ];

  const lbmb = [
    { name: "Scope 2", location: totals.s2, market: Math.round(totals.s2 * 0.62) },
    { name: "Total", location: totals.total, market: Math.round(totals.total * 0.88) },
  ];

  const intensityNominal = [
    { year: "FY22", location: 21.4, market: 19.8 },
    { year: "FY23", location: 20.1, market: 18.2 },
    { year: "FY24", location: 18.6, market: 16.4 },
    { year: "FY25", location: 17.2, market: 14.9 },
  ];
  const intensityReal = intensityNominal.map((d) => ({
    year: d.year,
    location: +(d.location * 1.08).toFixed(1),
    market: +(d.market * 1.08).toFixed(1),
  }));

  return (
    <TopLevelShell active="overview">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-xs font-medium text-canopy">
          ◆ {fiscalYear}
        </span>
        <select
          value={fiscalYear}
          onChange={(e) => setFiscalYear(e.target.value)}
          className="cursor-pointer rounded-md border border-border bg-white px-2 py-1 text-xs text-ink outline-none focus:border-coral"
        >
          {["FY23", "FY24", "FY25", "FY26"].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>

      <h1 className="mt-4 text-[32px] leading-tight font-bold text-ink">Overview</h1>
      <p className="mt-1 max-w-4xl text-sm text-slate">
        GHG Protocol + ISO 14064-1, operational control. Scope 1 &amp; 2 base year FY22 · Scope 3
        base year FY26. Use the fiscal year selector above to change the reporting period.
      </p>

      <div className="mt-7 grid gap-4 lg:grid-cols-5">
        <Kpi
          headline
          label={`Total footprint ${fiscalYear}`}
          value={fmt(totals.total)}
          delta={-4.2}
          caption="Aggregated across all entities in your group."
        />
        <Kpi label="Scope 1" value={fmt(totals.s1)} delta={-2.1} caption="Direct combustion and fleet." />
        <Kpi label="Scope 2" value={fmt(totals.s2)} delta={-6.4} caption="Purchased electricity, market-based." />
        <Kpi label="Scope 3" value={fmt(totals.s3)} delta={3.8} caption="Value chain, FY26 base year." />
        <Kpi label="YoY on fixed base year" value="-11.4%" delta={-11.4} caption="Against FY22 Scope 1 & 2 base." unit="" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ChartCard
          n={1}
          title="Scope 1+2 (Market-Based) vs Reduction Pace"
          caption="Actual market-based emissions against the reference reduction pathway. The group is tracking just below pathway this year, driven by renewable procurement."
        >
          <LineChart data={pace}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7E3" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6B7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line isAnimationActive={false} dataKey="actual" name="Actual" stroke={CANOPY} strokeWidth={2.5} />
            <Line isAnimationActive={false} dataKey="pathway" name="Reference pathway" stroke={CORAL} strokeDasharray="5 4" strokeWidth={2} />
          </LineChart>
        </ChartCard>

        <ChartCard
          n={2}
          title="Gross-to-Net Waterfall"
          caption="Location-based footprint, then the effect of market instruments applied, leaving the net market-based position."
        >
          <BarChart data={waterfall}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7E3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
            <Tooltip />
            <Bar isAnimationActive={false} dataKey="value" radius={[3, 3, 0, 0]}>
              {waterfall.map((d) => (
                <Cell key={d.name} fill={d.value < 0 ? MEADOW : CANOPY} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <ChartCard n={3} title="Scope Composition" caption="Share of the group footprint by scope. Scope 3 dominates, as expected for a manufacturing group.">
          <PieChart>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Pie isAnimationActive={false} cx="50%" cy="45%" data={composition} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} />
          </PieChart>
        </ChartCard>

        <ChartCard n={4} title="Scope 3 Category Contribution" caption="Scope 3 categories sorted largest first. Purchased goods and services is the primary lever.">
          <BarChart data={scope3} layout="vertical" margin={{ left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7E3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#6B7280" }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: "#6B7280" }} />
            <Tooltip />
            <Bar isAnimationActive={false} dataKey="value" fill={CANOPY} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard n={5} title="Location-Based vs Market-Based Footprint" caption="The gap between the two reflects contracted renewable supply across the group's sites.">
          <BarChart data={lbmb}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7E3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar isAnimationActive={false} dataKey="location" name="Location-based" fill={AMBER} radius={[3, 3, 0, 0]} />
            <Bar isAnimationActive={false} dataKey="market" name="Market-based" fill={MEADOW} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard n={6} title="Emission Intensity — Nominal" caption="tCO2e per ₹ crore of revenue at nominal values, aggregated across all entities in your group.">
          <LineChart data={intensityNominal}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7E3" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6B7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line isAnimationActive={false} dataKey="location" name="Location-based" stroke={CANOPY} strokeWidth={2.5} />
            <Line isAnimationActive={false} dataKey="market" name="Market-based" stroke={MEADOW} strokeWidth={2.5} />
          </LineChart>
        </ChartCard>

        <ChartCard n={7} title="Emission Intensity — Inflation-Adjusted" caption="The same intensity restated in constant currency, so revenue growth from pricing doesn't flatter the trend.">
          <LineChart data={intensityReal}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7E3" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6B7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line isAnimationActive={false} dataKey="location" name="Location-based" stroke={CANOPY} strokeWidth={2.5} />
            <Line isAnimationActive={false} dataKey="market" name="Market-based" stroke={MEADOW} strokeWidth={2.5} />
          </LineChart>
        </ChartCard>
      </div>
    </TopLevelShell>
  );
}

function Kpi({
  label,
  value,
  delta,
  caption,
  headline,
  unit = " tCO2e",
}: {
  label: string;
  value: string;
  delta: number;
  caption: string;
  headline?: boolean;
  unit?: string;
}) {
  const favorable = delta <= 0;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[10px] border border-border bg-white p-5",
        headline && "pl-6",
      )}
    >
      {headline && <span className="absolute top-0 bottom-0 left-0 w-[4px] bg-coral" />}
      <MicroLabel>{label}</MicroLabel>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="num text-2xl">{value}</span>
        <span className="text-xs text-slate">{unit}</span>
      </div>
      <div
        className={cn("mt-1 text-xs font-semibold", favorable ? "text-meadow" : "text-coral")}
      >
        {favorable ? "▼" : "▲"} {Math.abs(delta)}%
      </div>
      <p className="mt-2 text-xs text-slate">{caption}</p>
    </div>
  );
}

function ChartCard({
  n,
  title,
  caption,
  children,
}: {
  n: number;
  title: string;
  caption: string;
  children: React.ReactElement;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-white p-5">
      <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
      <div className="mt-4 h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex gap-3 border-t border-dashed border-border pt-3">
        <RingNumber n={n} />
        <div>
          <MicroLabel>How to read it</MicroLabel>
          <p className="mt-1 text-xs text-slate">{caption}</p>
        </div>
      </div>
    </div>
  );
}
