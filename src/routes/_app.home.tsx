import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, Clock, Lock, Mail, MessageCircle } from "lucide-react";
import { PageBody, PageHeader } from "@/components/portal";
import { useClientContext } from "@/lib/client-context";
import { useEntity, useFiscalYear } from "@/lib/entity";
import { getEmail, getRole } from "@/lib/auth";
import { useDecarbAssets, useInventory } from "@/lib/api";
import { useHomeSummary } from "@/lib/api-admin";
import type { HomeAlert } from "@/lib/api-admin";
import { genMonths, reportingStartMonth, trackerSummary } from "@/lib/tracker-progress";

export const Route = createFileRoute("/_app/home")({ component: HomePage });

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: n < 10 ? 2 : n < 100 ? 1 : 0 });
type Go = (to: string) => void;
type Status = "done" | "current" | "upcoming";
type Tone = "active" | "done" | "muted";

interface Stat { label: string; value: string; hint?: string }
interface Chapter {
  id: string;
  title: string;
  tagline: string;
  to: string;
  cta: string;
  done: boolean;
  stats: Stat[];
}

// ── Page ──────────────────────────────────────────────────────────────────────

const fmtD = (d: string | null | undefined) =>
  d ? new Date(d.length === 10 ? `${d}T00:00:00` : d.replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const CALC_LABEL: Record<string, string> = {
  draft: "In preparation", calculated: "Awaiting verification", verified: "Verified", locked: "Verified & locked",
};
const CYCLE_LABEL: Record<string, string> = { open: "Collecting", submitted: "Submitted", locked: "Locked" };

function HomePage() {
  const ctx = useClientContext();
  const navigate = useNavigate();
  const go: Go = (to) => {
    if (to.startsWith("mailto:")) { window.location.href = to; return; }
    navigate({ to: to as any });
  };

  const setupDone = ctx.config.setup_complete === true || ctx.config.setup_complete === "true";
  const unlocked = ctx.client.payment_status === "paid" || ctx.client.payment_status === "waived";
  const primaryEmail = ((ctx.config.primary_contact_email as string) || "").toLowerCase();
  const isPrimary = !!primaryEmail && primaryEmail === (getEmail() || "").toLowerCase() && getRole() === "sustainability_team";

  const { entity: sel } = useEntity();
  const { fy } = useFiscalYear();
  const entityScope = ctx.user?.entity_scope ?? null;
  const nonConsolidated = ctx.entities.filter((e) => !e.is_consolidated);
  const activeCode = entityScope ?? sel;
  const scopedEntity = nonConsolidated.find((e) => e.code === activeCode) ?? null;
  const displayName = scopedEntity?.name ?? ctx.client.name;
  const entityCount = entityScope ? 1 : nonConsolidated.length;

  const inv = useInventory(unlocked ? activeCode ?? "" : "");
  const assetsQ = useDecarbAssets(unlocked ? activeCode ?? undefined : undefined, fy || undefined);
  const summaryQ = useHomeSummary(activeCode ?? undefined, fy || undefined, unlocked);
  const sm = summaryQ.data;

  const support = sm?.consultant.email ?? (((ctx.config as any).support_email as string | undefined) ?? "support@deepwoodsgreen.com");
  const consultantName = sm?.consultant.name ?? null;

  // Data-collection completeness uses the same logic as the Data Tracker.
  const startMonth = reportingStartMonth(ctx.client.reporting_period, ctx.config as Record<string, unknown>);
  const months = useMemo(() => (fy ? genMonths(fy, startMonth) : []), [fy, startMonth]);
  const progress = useMemo(() => trackerSummary(assetsQ.data ?? [], months), [assetsQ.data, months]);

  const targets = sm?.targets;
  const model = useMemo(() => {
    const rows = inv.data?.rows ?? [];
    const get = (key: string, y: string) => rows.find((r) => r.metric_key === key)?.series[y] ?? null;
    const catRows = rows.filter((r) => /^Cat \d+$/.test(r.metric_key));
    const years = new Set<string>();
    rows.forEach((r) => Object.entries(r.series).forEach(([y, v]) => { if (v != null) years.add(y); }));
    const sorted = [...years].sort();
    const year = sorted.includes(fy) ? fy : sorted[sorted.length - 1] ?? null;
    const at = (y: string) => {
      const s1 = get("Scope 1", y);
      const s2lb = get("Scope 2 LB", y);
      const s2mb = get("Scope 2 MB", y);
      const cats = catRows.map((r) => r.series[y]).filter((v): v is number => v != null);
      const s3 = cats.length > 0 ? cats.reduce((a, b) => a + b, 0) : get("Scope 3", y);
      const basisMarket = targets?.basis === "market";
      const s2 = basisMarket ? (s2mb ?? s2lb) : (s2lb ?? s2mb);
      return { s1, s2, s2mb, s2lb, s3, total: s1 != null && s2 != null ? s1 + s2 + (s3 ?? 0) : null };
    };
    const cur = year ? at(year) : null;
    const hasData = !!cur && cur.total != null;

    let largest: { name: string; pct: number } | null = null;
    if (cur && hasData) {
      const parts = [
        { name: "Scope 1", v: cur.s1 ?? 0 },
        { name: "Scope 2", v: cur.s2 ?? 0 },
        { name: "Scope 3", v: cur.s3 ?? 0 },
      ];
      const sum = parts.reduce((a, p) => a + p.v, 0);
      const top = [...parts].sort((a, b) => b.v - a.v)[0];
      if (sum > 0 && top.v > 0) largest = { name: top.name, pct: Math.round((top.v / sum) * 100) };
    }

    let reduction: number | null = null;
    const baseYear = targets?.base_year ?? null;
    if (year && baseYear && year !== baseYear && years.has(baseYear)) {
      const s12 = (y: string) => { const r = at(y); return (r.s1 ?? 0) + (targets?.basis === "location" ? (r.s2lb ?? r.s2mb ?? 0) : (r.s2mb ?? r.s2lb ?? 0)); };
      const b = s12(baseYear);
      if (b > 0) reduction = ((b - s12(year)) / b) * 100;
    }
    return { year, cur, hasData, largest, reduction };
  }, [inv.data, fy, targets]);

  const cycle = sm?.cycle;
  const calc = sm?.calc;
  const acts = sm?.actions;
  const byStatus = acts?.by_status ?? {};
  const inProgress = (byStatus["In Progress"] ?? 0);
  const completed = (byStatus["Completed"] ?? 0);
  const committed = (byStatus["Committed"] ?? 0);
  const targetSet = !!targets?.set;
  const yearsToNetZero = targets?.netzero_year ? targets.netzero_year - new Date().getFullYear() : null;
  const alerts = sm?.alerts ?? [];
  const asked = `mailto:${support}?subject=${encodeURIComponent(`Target setting — ${displayName}`)}`;

  const dueHint = !cycle?.data_due_date ? "No due date set" : cycle.days_to_due == null ? undefined
    : cycle.days_to_due < 0 ? `${Math.abs(cycle.days_to_due)} days overdue` : cycle.days_to_due === 0 ? "due today" : `${cycle.days_to_due} days left`;

  const chapters: Chapter[] = [
    {
      id: "collect", title: "Collect", tagline: "Gather fuel, power and travel data.",
      to: "/submissions",
      cta: cycle?.status === "submitted" ? "Review your submission" : cycle?.status === "locked" ? "View your data" : progress.started === 0 ? "Start entering data" : "Continue data collection",
      done: cycle?.status === "submitted" || cycle?.status === "locked" || (progress.sources > 0 && progress.pct >= 0.9999),
      stats: [
        { label: "Entries filled", value: progress.sources > 0 ? `${Math.round(progress.pct * 100)}%` : "—", hint: progress.sources > 0 ? `${progress.complete} of ${progress.sources} sources complete` : "No sources registered yet" },
        { label: "Data due", value: fmtD(cycle?.data_due_date), hint: dueHint },
        { label: "Status", value: CYCLE_LABEL[cycle?.status ?? "open"], hint: cycle?.submitted_at ? `submitted ${fmtD(cycle.submitted_at)}` : fy },
      ],
    },
    {
      id: "calculate", title: "Calculate", tagline: "Your data becomes tonnes of CO₂e.",
      to: "/overview", cta: "See your footprint", done: !!calc && calc.status !== "draft",
      stats: [
        { label: "Status", value: CALC_LABEL[calc?.status ?? "draft"], hint: calc?.verified_at ? `verified ${fmtD(calc.verified_at)}` : calc?.calculated_at ? `calculated ${fmtD(calc.calculated_at)}` : undefined },
        { label: "Footprint", value: model.cur?.total != null ? fmt(model.cur.total) : "—", hint: model.cur?.total != null ? `tCO₂e · ${model.year}${calc && calc.status !== "verified" && calc.status !== "locked" ? " · provisional" : ""}` : undefined },
        { label: "Emission factors", value: calc?.ef_version ?? "—" },
      ],
    },
    {
      id: "diagnose", title: "Diagnose", tagline: "Find where the tonnes come from.",
      to: "/hotspots", cta: "Open hotspots", done: model.hasData && (targetSet || (acts?.total ?? 0) > 0),
      stats: [
        { label: "Biggest source", value: model.largest ? model.largest.name : "—", hint: model.largest ? `${model.largest.pct}% of footprint` : undefined },
        { label: "Scopes reported", value: model.cur ? String([model.cur.s1, model.cur.s2, model.cur.s3].filter((v) => v != null).length) : "—", hint: "of 3" },
      ],
    },
    {
      id: "target", title: "Target", tagline: "Commit to a science-based goal.",
      to: targetSet ? "/action-plan" : asked, cta: targetSet ? "Review your target" : "Ask your consultant to set it", done: targetSet,
      stats: [
        { label: "Reduction goal", value: targetSet && targets?.goal_pct != null ? `−${targets.goal_pct}%` : "Not set", hint: targetSet && targets?.goal_year ? `by ${targets.goal_year}` : undefined },
        { label: "Base year", value: targets?.base_year ?? "Not set" },
        { label: "Net-zero year", value: targets?.netzero_year ? String(targets.netzero_year) : "Not set" },
      ],
    },
    {
      id: "plan", title: "Plan", tagline: "Choose the levers that cut the most.",
      to: "/action-plan", cta: (acts?.total ?? 0) > 0 ? "Open your action plan" : "Build your plan", done: (acts?.total ?? 0) > 0,
      stats: [
        { label: "Initiatives", value: String(acts?.total ?? 0) },
        { label: "Planned reduction", value: (acts?.planned_abatement_t ?? 0) > 0 ? fmt(acts!.planned_abatement_t) : "—", hint: (acts?.planned_abatement_t ?? 0) > 0 ? "tCO₂e" : undefined },
      ],
    },
    {
      id: "act", title: "Act", tagline: "Launch initiatives with owners.",
      to: "/progress", cta: "See initiative progress", done: inProgress + completed > 0,
      stats: [
        { label: "In progress", value: String(inProgress) },
        { label: "Committed", value: String(committed) },
        { label: "Completed", value: String(completed) },
      ],
    },
    {
      id: "track", title: "Track", tagline: "Actual versus the pathway.",
      to: "/progress", cta: "Track progress", done: false,
      stats: [
        { label: "Cut so far", value: model.reduction != null ? `${model.reduction.toFixed(1)}%` : "—", hint: model.reduction != null ? `vs ${targets?.base_year}` : "needs a base year with data" },
        { label: "Goal", value: targetSet && targets?.goal_pct != null ? `−${targets.goal_pct}%` : "Not set" },
        { label: "Delivered by initiatives", value: (acts?.actual_abatement_t ?? 0) > 0 ? fmt(acts!.actual_abatement_t) : "—", hint: (acts?.actual_abatement_t ?? 0) > 0 ? "tCO₂e" : undefined },
      ],
    },
    {
      id: "netzero", title: "Net zero", tagline: "Cut hard. Neutralise the rest.",
      to: "/progress", cta: "See the pathway", done: false,
      stats: [
        { label: "Net-zero year", value: targets?.netzero_year ? String(targets.netzero_year) : "Not set" },
        { label: "Years to go", value: yearsToNetZero != null && yearsToNetZero >= 0 ? String(yearsToNetZero) : "—" },
        { label: "Renewables goal", value: targets?.renewable_target_pct != null ? `${targets.renewable_target_pct}%` : "Not set" },
      ],
    },
  ];

  const currentIdx = chapters.findIndex((c) => !c.done);
  const nowIdx = currentIdx === -1 ? chapters.length - 1 : currentIdx;
  const statusOf = (i: number): Status => (i === nowIdx ? "current" : chapters[i].done ? "done" : "upcoming");

  const loading = unlocked && (inv.isLoading || (summaryQ.isLoading && !summaryQ.isError));
  const welcome = sm?.user.display_name ? `Welcome back, ${sm.user.display_name.split(" ")[0]}. ` : "";

  return (
    <div className="pb-12" style={{ fontFamily: "'Manrope',system-ui,sans-serif" }}>
      {loading ? (
        <Skeleton />
      ) : !unlocked ? (
        <PendingView name={displayName} setupDone={setupDone} isPrimary={isPrimary} support={support} entityCount={entityCount} go={go} />
      ) : (
        <Story
          name={displayName}
          fy={fy}
          welcome={welcome}
          chapters={chapters}
          nowIdx={nowIdx}
          statusOf={statusOf}
          allDone={currentIdx === -1}
          alerts={alerts}
          dueChip={cycle?.data_due_date && cycle.status === "open" ? { label: `Data due ${fmtD(cycle.data_due_date)}${dueHint ? ` · ${dueHint}` : ""}`, overdue: !!cycle.overdue } : null}
          contact={{ name: consultantName, email: sm?.consultant.email ?? null, phone: sm?.consultant.phone ?? null, support }}
          go={go}
        />
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const PRIMARY_BTN =
  "inline-flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#185B4C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C] focus-visible:ring-offset-2";
const CARD = "rounded-xl border border-[var(--border)] bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07)]";

// ── The story ─────────────────────────────────────────────────────────────────

function Story({
  name, fy, welcome, chapters, nowIdx, statusOf, allDone, alerts, dueChip, contact, go,
}: {
  name: string; fy: string; welcome: string; chapters: Chapter[]; nowIdx: number; statusOf: (i: number) => Status;
  allDone: boolean; alerts: HomeAlert[]; dueChip: { label: string; overdue: boolean } | null;
  contact: { name: string | null; email: string | null; phone: string | null; support: string }; go: Go;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked ?? nowIdx;
  const now = chapters[nowIdx];
  const shownAlerts = alerts.slice(0, 2);

  return (
    <>
      <PageHeader
        eyebrow={`Home · ${fy}`}
        title={name}
        description={`${welcome}Your road to net zero — where you are today and what to do next.`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            {dueChip && (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${dueChip.overdue ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--border)] bg-white text-muted-foreground"}`}>
                <Clock className="h-3.5 w-3.5" /> {dueChip.label}
              </span>
            )}
            {shownAlerts.map((a) => (
              <Chip key={a.id} tone={a.severity} onClick={() => go(a.link)} title={a.detail} icon={<MessageCircle className="h-3.5 w-3.5" />}>
                {a.title}
              </Chip>
            ))}
            <button type="button" onClick={() => go(now.to)} className={PRIMARY_BTN}>
              {now.cta} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <PageBody>
        <div className="space-y-6">
          <section className={`${CARD} p-5`} aria-label="Your journey, chapter by chapter">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--navy)]">Your journey</h2>
              <p className="text-xs font-medium text-muted-foreground">
                {allDone ? "Every chapter under way" : `Chapter ${nowIdx + 1} of ${chapters.length} · ${now.title}`}
              </p>
            </div>
            <div className="mt-3 flex gap-1" aria-hidden>
              {chapters.map((c, i) => {
                const st = statusOf(i);
                return <span key={c.id} className={`h-1 flex-1 rounded-full ${st === "done" ? "bg-[#1E6F5C]" : st === "current" ? "bg-[#7FB5A5]" : "bg-slate-200"}`} />;
              })}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {chapters.map((c, i) => {
                const st = statusOf(i);
                const isSel = i === selected;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPicked(i)}
                    aria-pressed={isSel}
                    className={`flex flex-col rounded-lg border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C] ${
                      isSel ? "border-[#1E6F5C] bg-[#F0F8F5]" : "border-[var(--border)] bg-white hover:bg-[#F6FAF7]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <StatusBadge status={st} />
                    </div>
                    <div className="my-2 flex h-12 items-center">
                      <Illustration id={c.id} tone={st === "current" ? "active" : st === "done" ? "done" : "muted"} />
                    </div>
                    <span className="text-sm font-semibold text-[var(--navy)]">{c.title}</span>
                    <span className="mt-0.5 hidden text-xs leading-snug text-muted-foreground sm:block">{c.tagline}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <ScenePanel chapter={chapters[selected]} index={selected} status={statusOf(selected)} go={go} />

          <section className="grid gap-3 sm:grid-cols-3">
            <HelpTile icon={<MessageCircle className="h-4 w-4" />} title="Ask the Deepwoods team" sub="Use “Ask a question” under any data source" onClick={() => go("/submissions")} />
            <HelpTile icon={<BookOpen className="h-4 w-4" />} title="How it’s calculated" sub="Methodology and emission factors" onClick={() => go("/methodology")} />
            <HelpTile
              icon={<Mail className="h-4 w-4" />}
              title={contact.email ? (contact.name ?? "Your Deepwoods contact") : "Email support"}
              sub={contact.email ? `${contact.email}${contact.phone ? ` · ${contact.phone}` : ""}` : contact.support}
              onClick={() => go(`mailto:${contact.email ?? contact.support}`)}
            />
          </section>
        </div>
      </PageBody>
    </>
  );
}

function ScenePanel({ chapter, index, status, go }: { chapter: Chapter; index: number; status: Status; go: Go }) {
  return (
    <section key={chapter.id} className={`${CARD} overflow-hidden`} aria-live="polite">
      <div className="grid md:grid-cols-5">
        <div className="flex flex-col justify-between gap-5 border-b border-[var(--border)] bg-[#F0F8F5] p-6 md:col-span-2 md:border-b-0 md:border-r">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EF] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#1E6F5C]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1E6F5C]" /> Chapter {index + 1}
            </span>
            <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-[var(--navy)]">{chapter.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{chapter.tagline}</p>
          </div>
          <div className="flex h-24 items-center">
            <Illustration id={chapter.id} tone="active" />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-6 p-6 md:col-span-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Your data</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {chapter.stats.map((s) => (
                <div key={s.label} className="rounded-lg border border-[var(--border)] bg-[#F8FAF9] p-3.5">
                  <p className="text-[11px] font-medium text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--navy)]">{s.value}</p>
                  {s.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{s.hint}</p>}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            <p className="text-sm font-medium text-[var(--navy)]">
              {status === "done" ? "Done." : status === "current" ? "This is your next step." : "Coming up."}
            </p>
            <button
              type="button"
              onClick={() => go(chapter.to)}
              className={status === "current" ? PRIMARY_BTN : "inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C]"}
            >
              {chapter.cta} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Small pieces ──────────────────────────────────────────────────────────────

const CHIP_TONES = {
  high: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-400",
  medium: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 focus-visible:ring-amber-400",
  low: "border-[var(--border)] bg-white text-muted-foreground hover:bg-slate-50 focus-visible:ring-[#1E6F5C]",
} as const;

function Chip({ children, icon, onClick, tone = "medium", title }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; tone?: keyof typeof CHIP_TONES; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 ${CHIP_TONES[tone]}`}
    >
      {icon} {children}
    </button>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F4EF] px-2 py-0.5 text-[10px] font-bold text-[#1E6F5C]">
        <Check className="h-3 w-3" /> Done
      </span>
    );
  }
  if (status === "current") {
    return <span className="rounded-full bg-[#1E6F5C] px-2 py-0.5 text-[10px] font-bold text-white">You are here</span>;
  }
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Next</span>;
}

function HelpTile({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CARD} flex items-center gap-3 p-4 text-left transition-colors hover:bg-[#F6FAF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C]`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E6F4EF] text-[#1E6F5C]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--navy)]">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}

// ── Illustrations (one per chapter, drawn in SVG) ─────────────────────────────

const TONES: Record<Tone, { main: string; soft: string; fill: string }> = {
  active: { main: "#1E6F5C", soft: "#7FB5A5", fill: "#E6F4EF" },
  done: { main: "#1E6F5C", soft: "#A9CFC4", fill: "none" },
  muted: { main: "#94A3B8", soft: "#CBD5E1", fill: "none" },
};

function Illustration({ id, tone }: { id: string; tone: Tone }) {
  const { main, soft, fill } = TONES[tone];
  const common = { fill: "none", stroke: main, strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let body: React.ReactNode;

  switch (id) {
    case "collect":
      body = (
        <>
          <rect x="18" y="26" width="42" height="36" rx="5" {...common} />
          <rect x="30" y="16" width="42" height="36" rx="5" {...common} stroke={soft} />
          <path d="M38 30h18M38 38h12" {...common} stroke={soft} />
          <path d="M92 62V30M80 42l12-13 12 13" {...common} />
        </>
      );
      break;
    case "calculate":
      body = (
        <>
          <circle cx="60" cy="40" r="26" {...common} />
          <path d="M60 14a26 26 0 0 1 24 16" {...common} stroke={soft} strokeWidth={5} />
          <text x="60" y="46" textAnchor="middle" fontSize="15" fontWeight="800" fill={main} stroke="none">CO₂e</text>
        </>
      );
      break;
    case "diagnose":
      body = (
        <>
          <path d="M18 62V46M32 62V34M46 62V50M60 62V28" {...common} stroke={soft} strokeWidth={6} />
          <circle cx="82" cy="36" r="16" {...common} />
          <path d="M94 48l14 14" {...common} strokeWidth={4} />
        </>
      );
      break;
    case "target":
      body = (
        <>
          <circle cx="56" cy="42" r="26" {...common} stroke={soft} />
          <circle cx="56" cy="42" r="15" {...common} />
          <circle cx="56" cy="42" r="3.5" fill={main} stroke="none" />
          <path d="M56 42l36-30M84 10l10 2 2 10" {...common} />
        </>
      );
      break;
    case "plan":
      body = (
        <>
          <circle cx="22" cy="40" r="8" {...common} />
          <circle cx="92" cy="18" r="8" {...common} />
          <circle cx="92" cy="40" r="8" {...common} stroke={soft} />
          <circle cx="92" cy="62" r="8" {...common} stroke={soft} />
          <path d="M30 40h18c10 0 8-22 22-22h14M48 40h36M48 40c10 0 8 22 22 22h14" {...common} stroke={soft} />
        </>
      );
      break;
    case "act":
      body = (
        <>
          <circle cx="60" cy="40" r="28" {...common} stroke={soft} />
          <path d="M66 14L46 44h14l-6 22 22-32H62z" {...common} fill={fill} />
        </>
      );
      break;
    case "track":
      body = (
        <>
          <path d="M14 66h92M14 66V14" {...common} stroke={soft} strokeWidth={2} />
          <path d="M20 22L100 58" {...common} stroke={soft} strokeDasharray="5 6" strokeWidth={2} />
          <path d="M20 24l20 6 18 12 22 8 18 6" {...common} />
          <circle cx="98" cy="56" r="4.5" fill={main} stroke="none" />
        </>
      );
      break;
    default:
      body = (
        <>
          <circle cx="60" cy="40" r="28" {...common} stroke={soft} />
          <path d="M60 58c-12 0-20-8-20-20 12 0 20 6 20 20zM60 58c0-12 8-20 20-20 0 12-8 20-20 20z" {...common} fill={fill} />
          <path d="M60 58V30" {...common} />
        </>
      );
  }

  return (
    <svg viewBox="0 0 120 80" className="h-full w-auto" role="img" aria-label={`${id} illustration`}>
      {body}
    </svg>
  );
}

// ── Waiting for payment / activation ──────────────────────────────────────────

function PendingView({
  name, setupDone, isPrimary, support, entityCount, go,
}: { name: string; setupDone: boolean; isPrimary: boolean; support: string; entityCount: number; go: Go }) {
  const steps = [
    { label: "Registered", done: setupDone },
    { label: "Deepwoods review", done: false },
    { label: "Payment confirmed", done: false },
    { label: "Workspace unlocked", done: false },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <>
      <PageHeader
        eyebrow={setupDone ? "Under review" : "Setup incomplete"}
        title={name}
        description={setupDone ? "Your journey begins the moment your engagement is confirmed." : "Finish setup so the Deepwoods team can review your registration."}
        right={
          isPrimary ? (
            <button type="button" onClick={() => go("/register")} className={PRIMARY_BTN}>
              {setupDone ? "Review your registration" : "Continue setup"} <ArrowRight className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />
      <PageBody>
        <section className={`${CARD} p-6`}>
          <h2 className="text-sm font-semibold text-[var(--navy)]">Where you are</h2>
          <ol className="mt-5 grid gap-5 sm:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3 sm:flex-col sm:items-start">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.done ? "bg-[#1E6F5C] text-white" : i === current ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300" : "bg-slate-100 text-slate-400"}`}>
                  {s.done ? <Check className="h-4 w-4" /> : i === current ? <Clock className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                </span>
                <span className={`text-sm font-medium ${s.done || i === current ? "text-[var(--navy)]" : "text-slate-400"}`}>{s.label}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 border-t border-[var(--border)] pt-4 text-xs text-muted-foreground">
            {entityCount} {entityCount === 1 ? "entity" : "entities"} registered · Questions? Write to{" "}
            <a href={`mailto:${support}`} className="font-semibold text-[#1E6F5C] hover:underline">{support}</a>
          </p>
        </section>
      </PageBody>
    </>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6 px-6 pt-5 md:px-8" aria-busy="true" aria-label="Loading your workspace">
      <div className="h-28 rounded-xl bg-slate-200" />
      <div className="h-72 rounded-xl bg-slate-200/70" />
      <div className="h-56 rounded-xl bg-slate-200" />
    </div>
  );
}
