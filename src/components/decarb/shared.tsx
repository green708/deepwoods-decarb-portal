import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useDecarbActions, type DecarbAction } from "@/lib/api";
type Action = DecarbAction;

/* ══════════════════════════════════════════════════════════════════════════════
   UI primitives  (carbon-compass style)
   ══════════════════════════════════════════════════════════════════════════ */

export function HowToRead({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-3 rounded-md px-3 py-2 text-xs leading-relaxed"
      style={{
        borderLeft: "3px solid var(--scope1)",
        backgroundColor: "#F7F7F7",
        color: "var(--ink-muted)",
      }}
    >
      <span className="font-semibold" style={{ color: "var(--scope1)" }}>
        How to read it:{" "}
      </span>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  right,
}: {
  title: string;
  description: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span
            className="inline-block h-3 w-1 rounded-sm"
            style={{ backgroundColor: "var(--scope1)" }}
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
            Decarbonisation
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[color:var(--ink)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ink-muted)]">{description}</p>
      </div>
      {right}
    </div>
  );
}

export function Card({
  children,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={
        "rounded-xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-8px_rgba(15,23,42,0.08)] " +
        className
      }
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
      <div>
        <h3 className="text-base font-semibold text-[color:var(--ink)]">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[color:var(--ink-muted)]">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

export function ScopeBadge({ scope }: { scope: 0 | 1 | 2 | 3 }) {
  if (scope === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        Enabler
      </span>
    );
  }
  const map = {
    1: { bg: "#E7F2EE", fg: "var(--scope1)", label: "Scope 1" },
    2: { bg: "#E6EFFE", fg: "var(--scope2)", label: "Scope 2" },
    3: { bg: "#EEF1F5", fg: "var(--scope3)", label: "Scope 3" },
  }[scope];
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-[2px] text-[11px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: map.bg, color: map.fg }}
    >
      {map.label}
    </span>
  );
}

/** Indian-locale number formatter */
export const fmt = (n: number, d = 0) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });

/** "Data not found" marker — shown wherever a figure has no backing in the verified
 *  source data (master.ts). Use inline for a value, or as a block for a whole chart. */
export function DNF({ block = false, label }: { block?: boolean; label?: string }) {
  if (block) {
    return (
      <div className="grid place-items-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)] px-4 py-10 text-center">
        <div className="text-sm font-semibold text-[color:var(--ink-muted)]">Not available yet</div>
        <div className="mt-1 max-w-sm text-[11px] text-[color:var(--ink-muted)]">{label ?? "This fills in automatically once your data has been calculated."}</div>
      </div>
    );
  }
  return (
    <span
      title={label ?? "Data not found in verified source"}
      className="inline-flex items-center rounded px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ink-muted)]"
      style={{ backgroundColor: "var(--muted)" }}
    >
      DNF
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Scenario context — shared lever state between Action Plan & Scenario Builder
   ══════════════════════════════════════════════════════════════════════════ */

export type LeverState = { on: boolean; pct: number };
export type SavedScenario = {
  id: string;
  name: string;
  levers: Record<string, LeverState>;
  abatement: number;
  cost: number;
  ts: number;
};

export function abatementFor(a: Action, pct: number) {
  return Math.round((a.abatement_t ?? 0) * (pct / 100));
}
export function costFor(_a: Action, _pct: number) {
  return 0;
}

type ScenarioCtxType = {
  levers: Record<string, LeverState>;
  setLever: (id: string, next: Partial<LeverState>) => void;
  enableAndFocus: (id: string) => void;
  focusId: string | null;
  reset: () => void;
  scenarios: SavedScenario[];
  save: (name: string) => void;
  restore: (id: string) => void;
  totals: { abatement: number; cost: number };
};

const defaultLevers = (): Record<string, LeverState> =>
  Object.fromEntries(([] as Action[])  /* useDecarbActions() in parent component */.map((a) => [a.id, { on: false, pct: 60 }]));

export const ScenarioCtx = createContext<ScenarioCtxType | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [levers, setLevers] = useState<Record<string, LeverState>>(defaultLevers);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);

  const setLever = (id: string, next: Partial<LeverState>) =>
    setLevers((s) => ({ ...s, [id]: { ...s[id], ...next } }));

  const enableAndFocus = (id: string) => {
    setLevers((s) => ({ ...s, [id]: { ...s[id], on: true, pct: s[id]?.pct ?? 60 } }));
    setFocusId(id);
  };

  const totals = useMemo(() => {
    let abatement = 0;
    let cost = 0;
    for (const a of [] as Action[]  /* useDecarbActions() in parent component */) {
      const l = levers[a.id];
      if (!l?.on) continue;
      abatement += abatementFor(a, l.pct);
      cost += costFor(a, l.pct);
    }
    return { abatement, cost };
  }, [levers]);

  const value: ScenarioCtxType = {
    levers,
    setLever,
    enableAndFocus,
    focusId,
    reset: () => setLevers(defaultLevers()),
    scenarios,
    save: (name) =>
      setScenarios((s) => [
        ...s,
        {
          id: `sc-${Date.now()}`,
          name,
          levers: JSON.parse(JSON.stringify(levers)),
          abatement: totals.abatement,
          cost: totals.cost,
          ts: Date.now(),
        },
      ]),
    restore: (id) => {
      const s = scenarios.find((x) => x.id === id);
      if (s) setLevers(s.levers);
    },
    totals,
  };
  return <ScenarioCtx.Provider value={value}>{children}</ScenarioCtx.Provider>;
}

export function useScenario() {
  const ctx = useContext(ScenarioCtx);
  if (!ctx) throw new Error("ScenarioProvider missing");
  return ctx;
}
