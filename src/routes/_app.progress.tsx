import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
  Line,
  ComposedChart,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  PageHeader,
  Card,
  CardHeader,
  DNF,
} from "@/components/decarb/shared";
import { useClientContext } from "@/lib/client-context";
import { useInventory, useIntensity, useDecarbActions, getVal } from "@/lib/api";

/** Generic decarbonisation milestones — dates/targets loaded from context. */
const DECARB_MILESTONES = [
  { id: 1, fy: "FY22", label: "Baseline",        detail: "GHG inventory established",   status: "done" as const },
  { id: 2, fy: "FY24", label: "SBTi Commitment", detail: "Science-based target pledge",  status: "done" as const },
  { id: 3, fy: "FY25", label: "Report",           detail: "Annual GHG report published", status: "done" as const },
  { id: 4, fy: "FY26", label: "Action Plan",      detail: "Decarbonisation roadmap live", status: "progress" as const },
  { id: 5, fy: "FY28", label: "Interim target",   detail: "Interim reduction milestone", status: "upcoming" as const },
  { id: 6, fy: "FY30", label: "SBTi target",      detail: "−42% Scope 1+2 vs baseline", status: "upcoming" as const },
];

export const Route = createFileRoute("/_app/progress")({
  component: ProgressPage,
});

/* ── StatusBadge ─────────────────────────────────────────────────────────── */

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, { bg: string; fg: string; label: string; icon: any }> = {
    done: { bg: "var(--success-bg)", fg: "var(--success)", label: "Completed", icon: CheckCircle2 },
    "In Progress": { bg: "var(--warning-bg)", fg: "var(--warning)", label: "In Progress", icon: Clock },
    progress: { bg: "var(--warning-bg)", fg: "var(--warning)", label: "In Progress", icon: Clock },
    Delayed: { bg: "var(--critical-bg)", fg: "var(--critical)", label: "Delayed", icon: AlertTriangle },
    late: { bg: "var(--critical-bg)", fg: "var(--critical)", label: "Delayed", icon: AlertTriangle },
    upcoming: { bg: "#EEF2F7", fg: "#64748B", label: "Not Started", icon: Circle },
    "Not Started": { bg: "#EEF2F7", fg: "#64748B", label: "Not Started", icon: Circle },
    Completed: { bg: "var(--success-bg)", fg: "var(--success)", label: "Completed", icon: CheckCircle2 },
  };
  const c = map[s] ?? map.upcoming;
  const Icon = c.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-[2px] text-[10px] font-semibold uppercase"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <Icon className="h-3 w-3" /> {c.label}
    </span>
  );
}

/* ── Timeline ────────────────────────────────────────────────────────────── */

function Timeline() {
  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-9 h-0.5" style={{ backgroundColor: "var(--border)" }} />
      <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {DECARB_MILESTONES.map((m) => {
          const color =
            m.status === "done"
              ? "var(--success)"
              : m.status === "progress"
                ? "var(--warning)"
                : "#94A3B8";
          return (
            <div key={m.id} className="flex flex-col items-center text-center">
              <div className="mb-2 text-[11px] font-semibold text-[color:var(--ink-muted)]" style={{ fontFamily: "var(--font-mono)" }}>{m.fy}</div>
              <div
                className={
                  "grid h-8 w-8 place-items-center rounded-full text-white " +
                  (m.status === "progress" ? "animate-pulse" : "")
                }
                style={{
                  backgroundColor: color,
                  ...(m.status === "progress" ? { boxShadow: `0 0 0 6px rgba(217,119,6,0.2)` } : {}),
                }}
              >
                {m.status === "done" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : m.status === "progress" ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              <div className="mt-2 text-xs font-semibold text-[color:var(--ink)]">{m.label}</div>
              <div className="mt-0.5 text-[10px] text-[color:var(--ink-muted)]">{m.detail}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

function ProgressPage() {
  const { data: actionsData } = useDecarbActions();
  const COMMITTED = (actionsData ?? [])
    .filter((a) => a.status === "In Progress" || a.status === "Completed" || a.status === "Delayed")
    .map((a) => ({
      title: a.title,
      target: a.timeline,
      status: a.status,
      plan: a.abatement_t ?? 0,
      actual: 0,
      pct: a.status === "Completed" ? 100 : a.status === "In Progress" ? 50 : 0,
      owner: a.entity,
    }));

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Progress"
        description="Track delivery against what was committed."
      />

      {/* Timeline */}
      <Card className="mb-6">
        <CardHeader title="Milestones timeline" subtitle="FY22 → FY40" />
        <div className="p-6">
          <Timeline />
        </div>
      </Card>

      {/* Committed actions */}
      <Card className="mb-6">
        <CardHeader title="Committed actions tracker" subtitle="What moved from planned to committed" />
        <div className="divide-y">
          {COMMITTED.length === 0 ? (
            <div className="p-6 text-center text-sm text-[color:var(--ink-muted)]">No committed actions in the database yet.</div>
          ) : COMMITTED.map((a) => (
            <div key={a.title} className="grid grid-cols-1 items-center gap-3 p-5 md:grid-cols-6">
              <div className="md:col-span-2">
                <div className="text-sm font-semibold text-[color:var(--ink)]">{a.title}</div>
                <div className="text-[11px] text-[color:var(--ink-muted)]">Target: {a.target} · Owner: {a.owner}</div>
              </div>
              <div><StatusBadge s={a.status} /></div>
              <div className="text-xs">
                <div className="text-[10px] uppercase text-[color:var(--ink-muted)]">Plan → Actual</div>
                <div className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                  <span>{a.plan}</span> →{" "}
                  <span
                    style={{
                      color:
                        a.actual >= a.plan
                          ? "var(--success)"
                          : a.pct < 50
                            ? "var(--critical)"
                            : "var(--warning)",
                    }}
                  >
                    {a.actual}
                  </span>{" "}
                  <span className="text-[color:var(--ink-muted)]">tCO₂e</span>
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 flex justify-between text-[10px] text-[color:var(--ink-muted)]">
                  <span>Progress</span>
                  <span className="font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{a.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${a.pct}%`,
                      backgroundColor:
                        a.status === "Completed"
                          ? "var(--success)"
                          : a.status === "Delayed"
                            ? "var(--critical)"
                            : "var(--warning)",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Commit vs actual */}
        <Card>
          <CardHeader title="Committed vs actual — this year" />
          <div className="p-5">
            <DNF block label="Committed-vs-actual delivery figures are not in the verified source data." />
          </div>
        </Card>

        {/* Reduction to date */}
        <Card>
          <CardHeader title="Reduction achieved to date" subtitle="Cumulative tCO₂e avoided vs SBTi trajectory" />
          <div className="p-5">
            <DNF block label="Cumulative reduction will be computed automatically once historical inventory data is available in the database." />
          </div>
        </Card>
      </div>

      {/* Next quarter */}
      <Card>
        <CardHeader title="Next quarter priorities" subtitle="In-progress and delayed actions, sorted by deadline" />
        <ul className="divide-y">
          {COMMITTED.filter((c) => c.status !== "Completed").map((c) => (
            <li key={c.title} className="flex items-center gap-3 px-5 py-3 text-sm">
              <StatusBadge s={c.status} />
              <span className="flex-1 font-medium text-[color:var(--ink)]">{c.title}</span>
              <span className="text-xs text-[color:var(--ink-muted)]" style={{ fontFamily: "var(--font-mono)" }}>Due {c.target}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
