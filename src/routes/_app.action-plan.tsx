import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import {
  Flame, Zap, Package, ChevronDown, ChevronRight,
  AlertTriangle, Plus, Leaf, Save, RotateCcw, Info,
} from "lucide-react";
import {
  PageHeader, Card, CardHeader, HowToRead, ScopeBadge, DNF, fmt,
} from "@/components/decarb/shared";
import { useClientContext } from "@/lib/client-context";
import {
  useDecarbAssets, useInventory, useS1Breakdown,
  useS2ByFacility, useS3Summary, useIRECRegister, useGridMWh, getVal,
} from "@/lib/api";
import { useEntity, useFiscalYear } from "@/lib/entity";
import {
  IREC_FACTOR, IREC_COST_PER_MWH, CARBON_CREDIT_COST_PER_T,
} from "@/data/master";

export const Route = createFileRoute("/_app/action-plan")({ component: ActionPlanPage });

type LeverState = { irecMWh: number; credits: number; };
type Scenario   = { name: string; state: LeverState; };

/* ── Shared sub-components ───────────────────────────────────────────────── */

function ScopeSection({
  scope, icon: Icon, total, color, children,
}: {
  scope: 1 | 2 | 3; icon: any; total: number; color: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-3 flex w-full items-center justify-between rounded-md bg-white px-4 py-3 text-left shadow-sm ring-1 ring-[var(--border)]"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md" style={{ backgroundColor: color + "20", color }}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-semibold text-[color:var(--ink)]">Scope {scope}</div>
            <div className="text-[11px] text-[color:var(--ink-muted)]">Total for period</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div style={{ fontFamily: "var(--font-mono)", color }} className="text-lg font-bold">
            {fmt(total, 2)} <span className="text-xs font-medium text-[color:var(--ink-muted)]">tCO₂e</span>
          </div>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>
      {open && <div className="space-y-4">{children}</div>}
    </section>
  );
}

function LeverCard({
  title, scope, children, onAdd,
}: {
  title: string; scope: 1 | 2 | 3; children: React.ReactNode; onAdd: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <ScopeBadge scope={scope} />
            <span className="rounded-md px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: "var(--success-bg)", color: "var(--success)" }}>
              Actionable Lever
            </span>
          </div>
          <h3 className="text-base font-semibold text-[color:var(--ink)]">{title}</h3>
        </div>
        <button onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-95"
          style={{ backgroundColor: "var(--brand-red)" }}>
          <Plus className="h-3.5 w-3.5" /> Add to Scenario Builder
        </button>
      </div>
      {children}
    </Card>
  );
}

function FlagCard({ title, scope, children }: { title: string; scope: 1 | 2 | 3; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-5" style={{ backgroundColor: "rgba(var(--muted),0.3)" }}>
      <div className="mb-3 flex items-center gap-2">
        <ScopeBadge scope={scope} />
        <span className="rounded-md bg-white px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ink-muted)] ring-1 ring-[var(--border)]">
          Flag — needs evaluation
        </span>
      </div>
      <h3 className="mb-2 text-base font-semibold text-[color:var(--ink)]">{title}</h3>
      {children}
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-muted)]">{label}</div>
      <div className="mt-0.5 text-xs text-[color:var(--ink)]">{children}</div>
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────────── */

function Stat({ label, value, sub, tone = "default" }: {
  label: string; value: string; sub?: string; tone?: "default" | "success" | "warning" | "brand";
}) {
  const color = tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)"
    : tone === "brand" ? "var(--brand-red)" : "var(--ink)";
  return (
    <Card className="p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--ink-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-bold" style={{ fontFamily: "var(--font-mono)", color }}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[color:var(--ink-muted)]">{sub}</div>}
    </Card>
  );
}

const FUEL_COLORS = ["#1E6F5C", "#D97706", "#8B5CF6", "#64748B"];
const CAT_COLORS  = ["#1E6F5C", "#3B82F6", "#64748B", "#8B5CF6", "#D97706"];

const fyToYear = (fy: string) => { const m = fy.match(/\d+/); const n = m ? parseInt(m[0]) : 22; return n < 100 ? 2000 + n : n; };
const yearToFy = (y: number) => `FY${String(y).slice(-2)}`;

/* ══════════════════════════════════════════════════════════════════════════
   SCENARIO BUILDER VIEW
   ══════════════════════════════════════════════════════════════════════ */

function ScenarioBuilder({
  state, setState, scenarios, saveScenario, loadScenario, reset,
  S1_BASE, S2LB_BASE, IREC_MAX, SBTI_BASE, SBTI_TARGET, fy,
  glidepathYears, scenarioName, setScenarioName,
}: {
  state: LeverState; setState: (s: LeverState) => void;
  scenarios: Scenario[]; saveScenario: () => void;
  loadScenario: (s: Scenario) => void; reset: () => void;
  S1_BASE: number; S2LB_BASE: number; IREC_MAX: number;
  SBTI_BASE: number; SBTI_TARGET: number; fy: string;
  glidepathYears: string[]; scenarioName: string; setScenarioName: (n: string) => void;
}) {
  const S1_S2_BASE = S1_BASE + S2LB_BASE;
  const irecReduction = state.irecMWh * IREC_FACTOR;
  const afterIrec = S1_S2_BASE - irecReduction;
  const afterCredits = afterIrec - state.credits;
  const pctToTarget = S1_S2_BASE > SBTI_TARGET
    ? Math.min(100, Math.max(0, ((S1_S2_BASE - afterIrec) / (S1_S2_BASE - SBTI_TARGET)) * 100))
    : 0;

  const years = glidepathYears;
  const totalYrs = Math.max(years.length - 1, 1);
  const irecStartIdx = Math.min(3, Math.floor(totalYrs / 2));
  const glidepath = years.map((y, i) => {
    const frac = i / totalYrs;
    const target = Math.round(Math.max(0, SBTI_BASE - frac * (SBTI_BASE - SBTI_TARGET)));
    const projected = Math.round(Math.max(0, target - (i >= irecStartIdx ? irecReduction : 0)));
    const net = Math.round(Math.max(0, projected - (i >= irecStartIdx ? state.credits : 0)));
    return { year: y, target, projected, net };
  });

  const thisYear = [
    { name: `${fy} Gross`, value: S1_S2_BASE, dashed: false },
    { name: "After I-RECs", value: afterIrec, dashed: false },
    { name: "Net after Credits", value: afterCredits, dashed: true },
  ];

  const costData = [
    { name: `I-RECs (~₹${IREC_COST_PER_MWH.low}–${IREC_COST_PER_MWH.high}/MWh)`, value: IREC_COST_PER_MWH.high, tone: "green" },
    { name: `Carbon Credits (~₹${CARBON_CREDIT_COST_PER_T.low.toLocaleString()}–${CARBON_CREDIT_COST_PER_T.high.toLocaleString()}/tCO₂e)`, value: (CARBON_CREDIT_COST_PER_T.low + CARBON_CREDIT_COST_PER_T.high) >> 1, tone: "amber" },
  ];

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`S1+S2 LB Footprint (${fy})`} value={`${fmt(S1_S2_BASE, 0)}`} sub="tCO₂e baseline" />
        <Stat label="I-REC Reduction" value={`−${fmt(irecReduction, 1)}`} sub="tCO₂e · counts toward SBTi" tone="success" />
        <Stat label="Carbon Credits" value={`−${fmt(state.credits, 1)}`} sub="tCO₂e · offset only, not SBTi" tone="warning" />
        <Stat label="% to SBTi FY30 Target" value={`${pctToTarget.toFixed(1)}%`} sub="via real reduction only" tone="brand" />
      </div>

      {scenarios.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[color:var(--ink-muted)]">Saved scenarios:</span>
          {scenarios.map((s) => (
            <button key={s.name} onClick={() => loadScenario(s)}
              className="rounded-full border bg-white px-3 py-1 text-xs font-medium hover:bg-[var(--accent)]">
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScopeBadge scope={2} />
              <span className="rounded px-2 py-[2px] text-[10px] font-semibold uppercase"
                style={{ backgroundColor: "var(--success-bg)", color: "var(--success)" }}>Low cost</span>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={state.irecMWh > 0}
                onChange={(e) => setState({ ...state, irecMWh: e.target.checked ? IREC_MAX : 0 })}
                className="accent-[color:var(--scope1)]" />
              On/Off
            </label>
          </div>
          <h4 className="text-sm font-semibold text-[color:var(--ink)]">I-RECs — close the residual grid gap</h4>
          <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
            Procure I-RECs to cover remaining grid electricity. Slider shows maximum uncovered MWh.
          </p>
          <div className="mt-4">
            <input type="range" min={0} max={IREC_MAX || 200} step={1} value={state.irecMWh}
              onChange={(e) => setState({ ...state, irecMWh: Number(e.target.value) })}
              className="w-full accent-[color:var(--scope1)]" />
            <div className="mt-2 flex justify-between text-[11px] text-[color:var(--ink-muted)]">
              <span>0 MWh</span>
              <span>{IREC_MAX || 200} MWh (100% of gap)</span>
            </div>
            <div className="mt-3 rounded-md px-3 py-2 text-xs font-semibold"
              style={{ fontFamily: "var(--font-mono)", backgroundColor: "var(--success-bg)", color: "var(--success)" }}>
              {state.irecMWh} MWh procured → −{fmt(irecReduction, 1)} tCO₂e (market-based Scope 2)
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScopeBadge scope={1} />
              <span className="rounded px-2 py-[2px] text-[10px] font-semibold uppercase"
                style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning)" }}>Medium cost</span>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={state.credits > 0}
                onChange={(e) => setState({ ...state, credits: e.target.checked ? S1_BASE : 0 })}
                className="accent-[color:var(--warning)]" />
              On/Off
            </label>
          </div>
          <h4 className="text-sm font-semibold text-[color:var(--ink)]">Carbon Credits — neutralize residual Scope 1</h4>
          <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
            Voluntary market credits. Indicative ₹800–2,000 / tCO₂e.
          </p>
          <div className="mt-4">
            <input type="range" min={0} max={Math.ceil(S1_BASE) || 500} step={1} value={state.credits}
              onChange={(e) => setState({ ...state, credits: Number(e.target.value) })}
              className="w-full accent-[color:var(--warning)]" />
            <div className="mt-2 flex justify-between text-[11px] text-[color:var(--ink-muted)]">
              <span>0 tCO₂e</span>
              <span>{fmt(S1_BASE, 1)} tCO₂e (100% of S1)</span>
            </div>
            <div className="mt-3 rounded-md px-3 py-2 text-xs font-semibold"
              style={{ fontFamily: "var(--font-mono)", backgroundColor: "var(--warning-bg)", color: "var(--warning)" }}>
              {fmt(state.credits, 1)} tCO₂e credits → offsets on paper; does not reduce gross Scope 1
            </div>
          </div>
        </Card>
      </div>

      <div className="mb-5 rounded-md p-4 text-xs text-[color:var(--ink)]"
        style={{ borderLeft: "4px solid var(--warning)", backgroundColor: "rgba(254,243,199,0.6)" }}>
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--warning)" }}>
          <AlertTriangle className="h-4 w-4" /> Why these two levers behave differently
        </div>
        <p className="leading-relaxed">
          <b>I-RECs</b> are a real, GHG Protocol-recognized reduction to Scope 2 market-based
          emissions — they count toward the SBTi trajectory below. <b>Carbon credits</b> neutralize
          emissions on paper but don't change your actual Scope 1 footprint, and{" "}
          <b>do not count toward the SBTi FY30 target line</b>. The charts below keep these two
          effects visually separate so this is never ambiguous.
        </p>
      </div>

      <Card className="mb-5">
        <CardHeader title={`${fy} impact — this year`} subtitle="Bar 2 is real reduction; Bar 3 is voluntary offset view" />
        <div className="p-5">
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={thisYear} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                <Tooltip formatter={(v: number) => [`${fmt(v, 1)} tCO₂e`, "S1+S2"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}
                  label={{ position: "top", fontSize: 11, fontFamily: "var(--font-mono)", formatter: (v: number) => fmt(v, 0) }}>
                  {thisYear.map((d, i) => (
                    <Cell key={i} fill={i === 0 ? "#334155" : i === 1 ? "var(--success)" : "var(--warning)"}
                      fillOpacity={d.dashed ? 0.55 : 1} stroke={d.dashed ? "var(--warning)" : undefined}
                      strokeDasharray={d.dashed ? "5 4" : undefined} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <HowToRead>
            Bar 2 reflects your real, reportable Scope 2 reduction from I-RECs. Bar 3 is for
            internal/voluntary reporting only and reflects purchased carbon credits — it is not a
            substitute for actual emissions reduction.
          </HowToRead>
        </div>
      </Card>

      <Card className="mb-5">
        <CardHeader title={`${years[0]}–${years[years.length - 1]} glidepath vs SBTi target`}
          subtitle="Only I-RECs move the projected line; credits show as separate dotted net-position line" />
        <div className="p-5">
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={glidepath} margin={{ top: 10, right: 30, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="target" stroke="var(--scope1)" strokeDasharray="6 3" name={`SBTi −${Math.round((1 - SBTI_TARGET / (SBTI_BASE || 1)) * 100)}% target`} dot={false} />
                <Line type="monotone" dataKey="projected" stroke="var(--warning)" strokeWidth={2.5} name="Projected with I-RECs (real reduction)" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="net" stroke="#64748B" strokeDasharray="2 3" name="Net including carbon credits (voluntary)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <HowToRead>
            The <b style={{ color: "var(--scope1)" }}>green dashed line</b> is your SBTi target,
            the <b style={{ color: "var(--warning)" }}>amber line</b> is your projected real
            trajectory with I-RECs. The <b>grey dotted line</b> shows where you'd land if you
            include carbon credits — useful for voluntary reporting only.
          </HowToRead>
        </div>
      </Card>

      <Card className="mb-5">
        <CardHeader title="Cost comparison — per tCO₂e equivalent" />
        <div className="p-5">
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={costData} layout="vertical" margin={{ left: 40, right: 60 }}>
                <XAxis type="number" tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`₹${fmt(v)}`, "Per tCO₂e"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}
                  label={{ position: "right", fontSize: 11, fontFamily: "var(--font-mono)", formatter: (v: number) => `₹${fmt(v)}` }}>
                  {costData.map((d, i) => (
                    <Cell key={i} fill={d.tone === "green" ? "var(--success)" : "var(--warning)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <HowToRead>
            I-RECs are both cheaper and count toward your real target — they should generally be
            prioritized before carbon credits.
          </HowToRead>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={scenarioName}
          onChange={e => setScenarioName(e.target.value)}
          placeholder="Scenario name (e.g. Conservative)"
          className="rounded-md border px-3 py-2 text-sm text-[color:var(--ink)] outline-none focus:ring-2 focus:ring-[var(--scope1)]"
          style={{ minWidth: 220 }}
        />
        <button onClick={saveScenario} disabled={!scenarioName.trim()}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "var(--brand-red)" }}>
          <Save className="h-4 w-4" /> Save scenario
        </button>
        <button onClick={reset}
          className="inline-flex items-center gap-2 rounded-md border bg-white px-4 py-2 text-sm font-semibold text-[color:var(--ink)] hover:bg-[var(--accent)]">
          <RotateCcw className="h-4 w-4" /> Reset to baseline
        </button>
      </div>

      {scenarios.length >= 2 && (
        <Card className="mt-6">
          <CardHeader title="Scenario comparison" subtitle="Total abatement across saved scenarios" />
          <table className="w-full text-xs">
            <thead style={{ backgroundColor: "var(--muted)" }} className="text-[10px] uppercase text-[color:var(--ink-muted)]">
              <tr>
                <th className="px-4 py-2 text-left">Scenario</th>
                <th className="px-4 py-2 text-right">I-REC reduction (tCO₂e)</th>
                <th className="px-4 py-2 text-right">Credits (tCO₂e)</th>
                <th className="px-4 py-2 text-right">Projected total (tCO₂e)</th>
                <th className="px-4 py-2 text-right">% to target</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => {
                const r = s.state.irecMWh * IREC_FACTOR;
                const S1S2 = S1_BASE + S2LB_BASE;
                const proj = S1S2 - r;
                const pct = S1S2 > SBTI_TARGET
                  ? Math.min(100, Math.max(0, ((S1S2 - proj) / (S1S2 - SBTI_TARGET)) * 100))
                  : 0;
                return (
                  <tr key={s.name} className="border-t">
                    <td className="px-4 py-2 font-semibold">{s.name}</td>
                    <td className="px-4 py-2 text-right" style={{ fontFamily: "var(--font-mono)" }}>{fmt(r, 1)}</td>
                    <td className="px-4 py-2 text-right" style={{ fontFamily: "var(--font-mono)" }}>{fmt(s.state.credits, 1)}</td>
                    <td className="px-4 py-2 text-right" style={{ fontFamily: "var(--font-mono)" }}>{fmt(proj, 0)}</td>
                    <td className="px-4 py-2 text-right font-bold" style={{ fontFamily: "var(--font-mono)", color: "var(--scope1)" }}>
                      {pct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ACTION PLAN VIEW
   ══════════════════════════════════════════════════════════════════════ */

function ActionPlanView({
  entity, fy, consolidatedCode, onAddIrec, onAddCredits,
}: {
  entity: string; fy: string; consolidatedCode: string | undefined;
  onAddIrec: () => void; onAddCredits: () => void;
}) {
  const { data: invData }    = useInventory(entity);
  const { data: s3Data }     = useS3Summary(entity);
  const { data: s2FacData }  = useS2ByFacility(entity);
  const { data: assetsData } = useDecarbAssets(consolidatedCode === entity ? undefined : entity);
  const { data: s1BdData }   = useS1Breakdown(entity);

  const s1 = getVal(invData, "Scope 1", fy) ?? 0;
  const s2 = getVal(invData, "Scope 2 LB", fy) ?? 0;
  const s3 = getVal(invData, "Scope 3 Total", fy) ?? 0;

  // Scope 3 categories from API
  const s3cats = useMemo(() => (s3Data ?? [])
    .filter(r => (r.series[fy] ?? 0) > 0)
    .map(r => ({ name: r.category, fy25: r.series[fy] as number }))
    .sort((a, b) => b.fy25 - a.fy25),
    [s3Data, fy]);

  // Scope 2 by facility from API
  const facs = useMemo(() => (s2FacData ?? [])
    .filter(r => (r.series[fy] ?? 0) > 0)
    .map(r => ({ name: r.facility, entity: r.entity ?? entity, t: Math.round(r.series[fy] ?? 0), high: (r.series[fy] ?? 0) > 200 }))
    .sort((a, b) => b.t - a.t),
    [s2FacData, fy, entity]);

  // Equipment flags from assets (Scope 1 only)
  const equipRows = useMemo(() => {
    const scope1 = (assetsData ?? []).filter(a => a.scope === "Scope 1" && (a.series[fy] ?? 0) > 0);
    const total = scope1.reduce((s, a) => s + (a.series[fy] ?? 0), 0) || 1;
    return scope1
      .map(a => ({ name: a.name, t: a.series[fy] ?? 0, pct: Math.round((a.series[fy] ?? 0) / total * 100), high: (a.series[fy] ?? 0) / total > 0.25 }))
      .sort((a, b) => b.t - a.t);
  }, [assetsData, fy]);

  // Fuel breakdown from S1 breakdown API
  const fuelRows = useMemo(() => {
    const rows = (s1BdData ?? []).filter(r => (r.series[fy] ?? 0) > 0);
    const total = rows.reduce((s, r) => s + (r.series[fy] ?? 0), 0) || 1;
    return rows
      .map(r => ({ name: r.source, t: r.series[fy] ?? 0, pct: Math.round((r.series[fy] ?? 0) / total * 100) }))
      .sort((a, b) => b.t - a.t);
  }, [s1BdData, fy]);

  return (
    <div>
      {/* SCOPE 1 */}
      <ScopeSection scope={1} icon={Flame} total={s1} color="#1E6F5C">
        <LeverCard title="Neutralize residual Scope 1 via Carbon Credits" scope={1} onAdd={onAddCredits}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KV label="What">
              Purchase voluntary carbon credits to offset some or all of your Scope 1 footprint
              that can't be eliminated in the near term.
            </KV>
            <KV label="Where">Company-wide — Scope 1, all facilities.</KV>
            <KV label="Impact">
              {entity} · {fy} Scope 1 total = <span style={{ fontFamily: "var(--font-mono)" }} className="font-semibold">{fmt(s1, 3)} tCO₂e</span>.
              Adjustable — this is a <b>neutralization</b> lever, not a reduction lever.
            </KV>
            <KV label="Cost">Indicative <span style={{ fontFamily: "var(--font-mono)" }}>₹{CARBON_CREDIT_COST_PER_T.low.toLocaleString()}–{CARBON_CREDIT_COST_PER_T.high.toLocaleString()}</span> per tCO₂e.</KV>
            <KV label="Timeline">Can be actioned anytime; typically renewed annually.</KV>
            <KV label="Dependencies">None.</KV>
          </div>
          <div className="mt-4 rounded-md p-3 text-xs" style={{ borderLeft: "4px solid var(--warning)", backgroundColor: "rgba(254,243,199,0.6)" }}>
            <div className="mb-1 flex items-center gap-2 font-semibold" style={{ color: "var(--warning)" }}>
              <AlertTriangle className="h-4 w-4" /> Accounting caveat
            </div>
            Carbon credits offset emissions — they do not reduce your actual Scope 1 footprint or
            count toward the SBTi FY30 target. Use alongside, not instead of, real reduction measures.
          </div>
        </LeverCard>

        <FlagCard title="Equipment emissions flags" scope={1}>
          {equipRows.length === 0 ? (
            <DNF block label={`Asset-level Scope 1 data not available for ${entity} · ${fy}.`} />
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-[color:var(--ink-muted)]">
                    <th className="py-2">Equipment</th>
                    <th className="py-2 text-right">tCO₂e</th>
                    <th className="py-2 text-right">% of Scope 1</th>
                    <th className="py-2 text-right">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {equipRows.map((r) => (
                    <tr key={r.name} className="border-t">
                      <td className="py-2">{r.name}</td>
                      <td className="py-2 text-right" style={{ fontFamily: "var(--font-mono)" }}>{fmt(r.t)}</td>
                      <td className="py-2 text-right" style={{ fontFamily: "var(--font-mono)" }}>{r.pct}%</td>
                      <td className="py-2 text-right">
                        {r.high ? (
                          <span className="rounded px-2 py-[2px] text-[10px] font-semibold uppercase"
                            style={{ backgroundColor: "var(--critical-bg)", color: "var(--critical)" }}>
                            Highest — Monitor Usage
                          </span>
                        ) : (
                          <span className="rounded bg-[var(--muted)] px-2 py-[2px] text-[10px] font-semibold uppercase text-[color:var(--ink-muted)]">
                            Monitor
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] italic text-[color:var(--ink-muted)]">
                The highest-emission equipment items are flagged for monitoring or replacement
                scheduling — review usage patterns before committing to upgrades.
              </p>
            </>
          )}
        </FlagCard>

        <FlagCard title="Fuel-type flag" scope={1}>
          {fuelRows.length === 0 ? (
            <DNF block label={`Fuel-type breakdown not available for ${entity} · ${fy}.`} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={fuelRows} dataKey="t" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
                        {fuelRows.map((_, i) => <Cell key={i} fill={FUEL_COLORS[i % FUEL_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${fmt(v)} tCO₂e`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2 text-xs">
                  {fuelRows.map((r, i) => (
                    <li key={r.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: FUEL_COLORS[i % FUEL_COLORS.length] }} />
                      <span className="flex-1">{r.name}</span>
                      <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{fmt(r.t)}</span>
                      <span className="text-[color:var(--ink-muted)]">({r.pct}%)</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-3 text-[11px] italic text-[color:var(--ink-muted)]">
                The dominant fuel type is the highest-leverage target for electrification or
                fuel-switching initiatives.
              </p>
            </>
          )}
        </FlagCard>
      </ScopeSection>

      {/* SCOPE 2 */}
      <ScopeSection scope={2} icon={Zap} total={s2} color="#3B82F6">
        <LeverCard title="Close the residual grid gap with I-RECs" scope={2} onAdd={onAddIrec}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KV label="What">
              Procure I-RECs to cover remaining grid electricity not yet covered by renewable
              instruments. Check the Credits page for current coverage by entity.
            </KV>
            <KV label="Where">All facilities with uncovered grid consumption.</KV>
            <KV label="Impact">
              {entity} · {fy} Scope 2 LB = <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{fmt(s2, 2)} tCO₂e</span>.
              Full I-REC coverage brings market-based Scope 2 to zero.
            </KV>
            <KV label="Cost">Indicative <span style={{ fontFamily: "var(--font-mono)" }}>₹{IREC_COST_PER_MWH.low}–{IREC_COST_PER_MWH.high}</span> per MWh.</KV>
            <KV label="Timeline">&lt; 3 months from procurement decision.</KV>
            <KV label="Dependencies">None — can be actioned independently.</KV>
          </div>
          <div className="mt-4 rounded-md p-3 text-xs text-[color:var(--ink)]" style={{ backgroundColor: "var(--success-bg)" }}>
            <Leaf className="mr-1 inline h-3.5 w-3.5" style={{ color: "var(--success)" }} />
            Full I-REC coverage gets the portfolio to <b>0 Scope 2 market-based emissions</b> and
            strengthens the renewable-coverage story.
          </div>
        </LeverCard>

        <FlagCard title="Facility consumption flags" scope={2}>
          {facs.length === 0 ? (
            <DNF block label={`Facility-level Scope 2 breakdown not available for ${entity} · ${fy}.`} />
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-[color:var(--ink-muted)]">
                    <th className="py-2">Facility</th>
                    <th className="py-2">Entity</th>
                    <th className="py-2 text-right">Scope 2 LB (tCO₂e)</th>
                    <th className="py-2 text-right">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {facs.map((r) => (
                    <tr key={r.name} className="border-t">
                      <td className="py-2">{r.name}</td>
                      <td className="py-2 text-[color:var(--ink-muted)]">{r.entity}</td>
                      <td className="py-2 text-right" style={{ fontFamily: "var(--font-mono)" }}>{r.t}</td>
                      <td className="py-2 text-right">
                        {r.high ? (
                          <span className="rounded px-2 py-[2px] text-[10px] font-semibold uppercase"
                            style={{ backgroundColor: "var(--critical-bg)", color: "var(--critical)" }}>
                            Highest — Monitor Usage
                          </span>
                        ) : (
                          <span className="rounded bg-[var(--muted)] px-2 py-[2px] text-[10px] font-semibold uppercase text-[color:var(--ink-muted)]">
                            Monitor
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] italic text-[color:var(--ink-muted)]">
                The highest-consumption facility is flagged for monitoring. Investigate whether the
                figure reflects equipment load, operating hours, or facility size before deciding on
                next steps.
              </p>
            </>
          )}
        </FlagCard>
      </ScopeSection>

      {/* SCOPE 3 */}
      <ScopeSection scope={3} icon={Package} total={s3} color="#64748B">
        <FlagCard title="Category concentration flag" scope={3}>
          {s3cats.length === 0 ? (
            <DNF block label={`No calculated Scope 3 categories for ${entity} · ${fy}.`} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={s3cats} dataKey="fy25" nameKey="name" innerRadius={45} outerRadius={90} paddingAngle={2}>
                        {s3cats.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${fmt(v)} tCO₂e`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2 text-xs">
                  {s3cats.map((c, i) => (
                    <li key={c.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                      <span className="flex-1">{c.name}</span>
                      <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{fmt(c.fy25)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 rounded-md p-3 text-xs" style={{ borderLeft: "4px solid var(--critical)", backgroundColor: "rgba(254,226,226,0.5)" }}>
                <b>{s3cats[0].name} makes up {Math.round((s3cats[0].fy25 / (s3 || 1)) * 100)}% of {entity} · {fy} Scope 3.</b> This
                concentration is a flag for deeper supplier engagement, not yet a specific plan.
                Review data quality before committing to targets here.
              </div>
            </>
          )}
        </FlagCard>

        <div className="rounded-xl border border-dashed p-6 text-center text-xs text-[color:var(--ink-muted)]"
          style={{ backgroundColor: "rgba(var(--muted),0.4)" }}>
          <Info className="mx-auto mb-2 h-5 w-5" />
          Scope 3 reduction levers (supplier engagement, logistics optimization, commuting
          programs) require category-level data quality review before they can be sized and added
          here. <b>Flagged for follow-up</b> — no actions or credits are being modeled for Scope 3 yet.
        </div>
      </ScopeSection>

      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_14px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--ink-muted)]">Scope 1 · {entity} {fy}</div>
            <div className="mt-1 font-medium text-[color:var(--ink)]">
              <span className="font-bold" style={{ fontFamily: "var(--font-mono)" }}>{fmt(s1, 2)}</span> tCO₂e — neutralise via carbon credits
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--ink-muted)]">Scope 2 · {entity} {fy}</div>
            <div className="mt-1 font-medium text-[color:var(--ink)]">
              <span className="font-bold" style={{ fontFamily: "var(--font-mono)" }}>{fmt(s2, 2)}</span> tCO₂e — close residual grid with I-RECs
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--ink-muted)]">Ready to model</div>
            <div className="mt-1 font-medium" style={{ color: "var(--brand-red)" }}>
              I-RECs, Carbon Credits — see Scenario Builder
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ACTION PLAN PAGE (top-level)
   ══════════════════════════════════════════════════════════════════════ */

function ActionPlanPage() {
  const { entity } = useEntity();
  const { fy } = useFiscalYear();
  const ctx = useClientContext();
  const consolidatedCode = ctx.entities.find(e => e.is_consolidated)?.code;

  // Scenario Builder base values from API
  const { data: consInvData } = useInventory(consolidatedCode ?? entity);
  const { data: irecData }    = useIRECRegister();
  const { data: gridMWhData } = useGridMWh();

  const S1_BASE   = getVal(consInvData, "Scope 1", fy) ?? 0;
  const S2LB_BASE = getVal(consInvData, "Scope 2 LB", fy) ?? 0;

  const gridMWh = useMemo(() => {
    if (!gridMWhData) return 0;
    const g = gridMWhData as Record<string, Record<string, number>>;
    return Object.values(g).reduce((sum, e) => sum + (e[fy] ?? 0), 0);
  }, [gridMWhData, fy]);

  const irecRetired = useMemo(() =>
    (irecData ?? []).filter(r => r.fy === fy && r.status === "Retired").reduce((s, r) => s + r.mwh, 0),
    [irecData, fy]);

  const IREC_MAX = Math.max(0, Math.round(gridMWh - irecRetired));

  const baseYr = ctx.targets.base_year_s12;
  const SBTI_BASE = (getVal(consInvData, "Scope 1", baseYr) ?? 0) + (getVal(consInvData, "Scope 2 LB", baseYr) ?? 0);
  const SBTI_TARGET = SBTI_BASE > 0
    ? Math.round(SBTI_BASE * (1 - ctx.targets.sbti_target_s12 / 100))
    : 500;

  const baseYrNum    = fyToYear(baseYr);
  const tgtYrNum     = ctx.targets.sbti_target_year ?? 2030;
  const glidepathYears = Array.from(
    { length: Math.max(tgtYrNum - baseYrNum + 1, 9) },
    (_, i) => yearToFy(baseYrNum + i),
  );

  const [view, setView] = useState<"plan" | "sb">("plan");
  const [state, setState] = useState<LeverState>({ irecMWh: 0, credits: 0 });
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [presetPulse, setPresetPulse] = useState(0);
  const [scenarioName, setScenarioName] = useState("");

  const goToSB = () => { setView("sb"); setPresetPulse((n) => n + 1); };
  const onAddIrec    = () => { setState((s) => ({ ...s, irecMWh: IREC_MAX }));  goToSB(); };
  const onAddCredits = () => { setState((s) => ({ ...s, credits:  S1_BASE }));  goToSB(); };
  const saveScenario = () => {
    const name = scenarioName.trim();
    if (!name) return;
    setScenarios((cur) => [...cur.filter((s) => s.name !== name), { name, state: { ...state } }]);
    setScenarioName("");
  };
  const loadScenario = (s: Scenario) => setState({ ...s.state });
  const reset = () => setState({ irecMWh: 0, credits: 0 });

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Action Plan"
        description={`Prioritise the levers that get you to target — and model them. Showing ${entity} · ${fy}.`}
      />

      <div className="mb-6 inline-flex overflow-hidden rounded-md border bg-white shadow-sm">
        {([ ["plan", "Action Plan"], ["sb", "Scenario Builder"] ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)}
            className={"px-4 py-2 text-sm font-semibold transition " +
              (view === k ? "border-b-2 text-[color:var(--scope1)]" : "text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]")}
            style={view === k ? { borderBottomColor: "var(--scope1)" } : undefined}>
            {label}
          </button>
        ))}
      </div>

      <ErrorBoundary label={view === "plan" ? "Action Plan" : "Scenario Builder"}>
        {view === "plan" ? (
          <ActionPlanView
            entity={entity} fy={fy} consolidatedCode={consolidatedCode}
            onAddIrec={onAddIrec} onAddCredits={onAddCredits}
          />
        ) : (
          <ScenarioBuilder key={presetPulse}
            state={state} setState={setState}
            scenarios={scenarios} saveScenario={saveScenario}
            loadScenario={loadScenario} reset={reset}
            S1_BASE={S1_BASE} S2LB_BASE={S2LB_BASE}
            IREC_MAX={IREC_MAX} SBTI_BASE={SBTI_BASE} SBTI_TARGET={SBTI_TARGET}
            fy={fy} glidepathYears={glidepathYears}
            scenarioName={scenarioName} setScenarioName={setScenarioName}
          />
        )}
      </ErrorBoundary>
    </div>
  );
}
