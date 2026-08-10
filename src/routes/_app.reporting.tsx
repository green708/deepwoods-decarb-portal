/**
 * _app.reporting.tsx — GHG Reporting Cycle Simulator
 *
 * Full interactive test harness for the 7-day reporting pipeline.
 * The sticky Test Controls bar lets you advance the simulated cycle day
 * without waiting — every state transition, email event, and portal
 * status change plays out live in the UI.
 *
 * Day 0  → Collection window opens, welcome email sent
 * Day 1  → Reminder 1 with missing data points listed
 * Day 3  → Reminder 2 + internal escalation if >40% missing
 * Day 5  → Final reminder + consultant warning
 * Day 7  → Collection closes → consultant notified to run Claude  ← MANUAL STEP
 * Day 7+ → Approval / Rework loop → Drive save → Client delivery
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  ClipboardList, CheckCircle2, AlertCircle, Clock, FileText,
  ExternalLink, ChevronRight, CircleDot, SendHorizonal,
  ShieldCheck, FolderOpen, ChevronLeft, RotateCcw,
  Mail, Zap, Play, User, Bot, ThumbsUp, ThumbsDown,
  Info, SkipForward,
} from "lucide-react";
import { PageHeader, PageBody } from "@/components/portal";
import { useEntity, useFiscalYear } from "@/lib/entity";
import { useClientContext } from "@/lib/client-context";
import { REPORTING_WORKFLOW } from "@/data/master";

export const Route = createFileRoute("/_app/reporting")({ component: ReportingStatus });

// ── Types ─────────────────────────────────────────────────────────────────────
type CycleStatus =
  | "Not Started"
  | "Collecting"
  | "In Progress"
  | "Approval Pending"
  | "Awaiting Claude"
  | "Rework"
  | "Complete";

type MissingPoint = {
  id: string; scope: string; subcat: string; name: string; unit: string;
};

type LogEntry = {
  day: number;
  type: "email" | "system" | "manual" | "warning" | "success";
  actor: "system" | "consultant" | "client";
  title: string;
  body: string;
  to?: string;
};

type EntityCycle = {
  entityId: string;
  entityName: string;
  clientId: string;
  fy: string;
  totalPoints: number;
  collectedByDay: Record<number, number>; // day → cumulative collected count
  missingPoints: MissingPoint[];
  clientEmail: string;
};

// ── Simulation helpers ────────────────────────────────────────────────────────

// Generic missing-point templates — realistic for any entity, no client-specific data
const GENERIC_MISSING: MissingPoint[] = [
  { id: "MP-S2-001", scope: "Scope 2", subcat: "Purchased Electricity", name: "Electricity — main facility (grid)", unit: "kWh"       },
  { id: "MP-S3-001", scope: "Scope 3", subcat: "Cat 1 Purchased Goods", name: "Raw materials — primary inputs",     unit: "tonne"     },
  { id: "MP-S3-002", scope: "Scope 3", subcat: "Cat 6 Business Travel", name: "Business travel — air & rail",       unit: "km"        },
  { id: "MP-S3-003", scope: "Scope 3", subcat: "Cat 7 Employee Commute",name: "Employee commute",                   unit: "person-km" },
  { id: "MP-S1-001", scope: "Scope 1", subcat: "Fugitive",              name: "Fugitive — refrigerants / fire suppression", unit: "tCO₂e" },
];

function buildCycles(
  entities: Array<{ code: string; name: string; is_consolidated: boolean }>,
  fy: string,
  clientSlug: string,
  contactEmail: string,
): EntityCycle[] {
  return entities
    .filter(e => !e.is_consolidated)
    .map((e, idx) => {
      const totalPoints = 8 + idx * 3;
      const collected0  = Math.floor(totalPoints * 0.4);
      const collected3  = collected0 + 1;
      const collected5  = collected3 + 1;
      return {
        entityId:   e.code,
        entityName: e.name,
        clientId:   `${clientSlug.toUpperCase().replace(/-/g, '')}-${e.code}-GHG-${fy}`,
        fy:         `FY${fy.replace('FY','')}`  ,
        totalPoints,
        collectedByDay: { 0: collected0, 1: collected0, 2: collected0, 3: collected3, 4: collected3, 5: collected5, 6: collected5, 7: collected5 },
        missingPoints: GENERIC_MISSING.slice(0, totalPoints - collected5),
        clientEmail: contactEmail,
      };
    });
}

// ── Derive state from day ─────────────────────────────────────────────────────
function getStatus(day: number, approved: boolean, rework: boolean): CycleStatus {
  if (approved) return "Complete";
  if (rework)   return "Rework";
  if (day >= 7) return "Awaiting Claude";
  if (day >= 5) return "Approval Pending";  // re-used label pre-Day7 as "Final reminder sent"
  if (day >= 3) return "In Progress";
  if (day >= 1) return "Collecting";
  return "Collecting";
}

function getPct(cycle: EntityCycle, day: number): number {
  const d = Math.min(day, 7);
  const collected = cycle.collectedByDay[d] ?? cycle.collectedByDay[0];
  return collected / cycle.totalPoints;
}

// ── Event log builder ─────────────────────────────────────────────────────────
function buildLog(cycle: EntityCycle, upToDay: number, consultantEmail: string): LogEntry[] {
  const log: LogEntry[] = [];
  const pct0 = getPct(cycle, 0);

  if (upToDay >= 0) {
    log.push({
      day: 0, type: "system", actor: "system",
      title: "Collection window opened",
      body: `Cycle started for ${cycle.entityName}. Welcome email dispatched to ${cycle.clientEmail} with data submission link. Prior-year values pre-filled where available.`,
      to: cycle.clientEmail,
    });
    log.push({
      day: 0, type: "email", actor: "system",
      title: `Welcome email → ${cycle.clientEmail}`,
      body: `Subject: [GHG ${cycle.fy}] Data Collection Open\n\nPlease submit your ${cycle.fy} GHG data via the portal. ${cycle.missingPoints.length} data points required. Deadline: 7 days.`,
      to: cycle.clientEmail,
    });
  }

  if (upToDay >= 1) {
    const missing1 = cycle.missingPoints;
    log.push({
      day: 1, type: "email", actor: "system",
      title: `Day 1 reminder → ${cycle.clientEmail}`,
      body: `Subject: [GHG ${cycle.fy}] Data Reminder — Day 1\n\n${(pct0 * 100).toFixed(0)}% complete. Still outstanding:\n${missing1.map(m => `  • ${m.scope}: ${m.name} (${m.unit})`).join("\n")}`,
      to: cycle.clientEmail,
    });
  }

  if (upToDay >= 3) {
    const pct3 = getPct(cycle, 3);
    const missing3pct = 1 - pct3;
    log.push({
      day: 3, type: "email", actor: "system",
      title: `Day 3 reminder → ${cycle.clientEmail}`,
      body: `Subject: [GHG ${cycle.fy}] Data Reminder — Day 3\n\n${(pct3 * 100).toFixed(0)}% complete. ${cycle.missingPoints.length - 1} data points still outstanding. Detailed list attached.`,
      to: cycle.clientEmail,
    });
    if (missing3pct > 0.40) {
      log.push({
        day: 3, type: "warning", actor: "system",
        title: `⚠️ Internal escalation → ${consultantEmail}`,
        body: `${(missing3pct * 100).toFixed(0)}% of ${cycle.entityName} data still missing on Day 3 (threshold: 40%). Consider calling client contact directly.`,
        to: consultantEmail,
      });
    }
  }

  if (upToDay >= 5) {
    const pct5 = getPct(cycle, 5);
    log.push({
      day: 5, type: "email", actor: "system",
      title: `Day 5 final reminder → ${cycle.clientEmail}`,
      body: `Subject: [GHG ${cycle.fy}] Final Reminder — Day 5\n\nLast chance. Collection closes in 2 days. ${(pct5 * 100).toFixed(0)}% complete.`,
      to: cycle.clientEmail,
    });
    if ((1 - pct5) > 0.20) {
      log.push({
        day: 5, type: "warning", actor: "system",
        title: `🔴 Day 5 warning → ${consultantEmail}`,
        body: `${cycle.entityName}: ${((1-pct5)*100).toFixed(0)}% still missing with 2 days left. Decide: extend window or mark remaining as Estimated.`,
        to: consultantEmail,
      });
    }
  }

  if (upToDay >= 7) {
    log.push({
      day: 7, type: "system", actor: "system",
      title: "Collection window closed",
      body: `Final tally: ${(getPct(cycle, 7) * 100).toFixed(0)}% collected. Remaining missing points will be flagged as Estimated in the report.`,
    });
    log.push({
      day: 7, type: "manual", actor: "consultant",
      title: `⏳ Consultant notified → ${consultantEmail}`,
      body: `Subject: [GHG] Day 7 — Run Claude to Generate Report\n\nData collection closed. Open Claude, load the ${cycle.entityName} GHG Project, copy data from the master sheet, and generate the draft report. Submit via the approval form when ready.`,
      to: consultantEmail,
    });
  }

  return log;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<CycleStatus, { chip: string; dot: string }> = {
  "Not Started":      { chip: "bg-muted text-muted-foreground",       dot: "#94A3B8" },
  "Collecting":       { chip: "bg-blue-50 text-blue-700",             dot: "#3B82F6" },
  "In Progress":      { chip: "bg-amber-50 text-amber-700",           dot: "#D97706" },
  "Approval Pending": { chip: "bg-purple-50 text-purple-700",         dot: "#7C3AED" },
  "Awaiting Claude":  { chip: "bg-[#FFF9C4] text-[#92400E]",         dot: "#D97706" },
  "Rework":           { chip: "bg-orange-50 text-orange-700",         dot: "#EA580C" },
  "Complete":         { chip: "bg-[#E6F4EF] text-[#1E6F5C]",         dot: "#1E6F5C" },
};

const LOG_STYLE: Record<LogEntry["type"], { bg: string; icon: React.ReactNode; border: string }> = {
  email:   { bg: "#EFF6FF", border: "#BFDBFE", icon: <Mail      className="h-3.5 w-3.5 text-[#3B82F6]" /> },
  system:  { bg: "#F0FDF4", border: "#BBF7D0", icon: <Zap       className="h-3.5 w-3.5 text-[#16A34A]" /> },
  manual:  { bg: "#FFF9C4", border: "#FDE68A", icon: <User      className="h-3.5 w-3.5 text-[#92400E]" /> },
  warning: { bg: "#FEF2F2", border: "#FECACA", icon: <AlertCircle className="h-3.5 w-3.5 text-[#D90429]" /> },
  success: { bg: "#E6F4EF", border: "#A7F3D0", icon: <CheckCircle2 className="h-3.5 w-3.5 text-[#1E6F5C]" /> },
};

const ACTOR_LABEL: Record<LogEntry["actor"], string> = {
  system:     "🤖 System",
  consultant: "👤 Consultant",
  client:     "🏢 Client",
};

function pctBar(pct: number, color: string) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct * 100, 100)}%`, background: color }} />
    </div>
  );
}

const SCOPE_DOT: Record<string, string> = {
  "Scope 1": "#1E6F5C",
  "Scope 2": "#3B82F6",
  "Scope 3": "#6366F1",
};

// ── Milestone timeline ────────────────────────────────────────────────────────
const MILESTONES = REPORTING_WORKFLOW;

function Timeline({ day }: { day: number }) {
  return (
    <div className="relative mt-3 flex items-start justify-between pb-6">
      <div className="absolute left-0 top-3 h-0.5 w-full bg-[var(--muted)]" />
      <div className="absolute left-0 top-3 h-0.5 bg-[#1E6F5C] transition-all duration-500"
        style={{ width: `${Math.min((day / 7) * 100, 100)}%` }} />
      {MILESTONES.map((m) => {
        const done    = day > m.d;
        const current = day === m.d;
        return (
          <div key={m.d} className="relative flex flex-col items-center" style={{ width: "20%" }}>
            <div className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all
              ${done    ? "border-[#1E6F5C] bg-[#1E6F5C] text-white"
              : current ? "border-[#1E6F5C] bg-white text-[#1E6F5C] shadow-sm ring-2 ring-[#E6F4EF]"
                        : "border-[var(--border)] bg-white text-muted-foreground"}`}>
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : m.d}
            </div>
            <span className="mt-1.5 text-center text-[9px] leading-tight text-muted-foreground">{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Entity Card ───────────────────────────────────────────────────────────────
function EntityCycleCard({
  cycle, day, approved, rework, expanded, onToggle,
}: {
  cycle: EntityCycle; day: number; approved: boolean; rework: boolean;
  expanded: boolean; onToggle: () => void;
}) {
  const pct    = getPct(cycle, day);
  const status = getStatus(day, approved, rework);
  const s      = STATUS_STYLE[status];
  const barColor = approved ? "#1E6F5C" : pct >= 0.8 ? "#16A34A" : pct >= 0.5 ? "#D97706" : "#D90429";
  const daysLeft = Math.max(0, 7 - day);
  const missingNow = cycle.missingPoints.slice(
    0, Math.max(0, cycle.missingPoints.length - (cycle.collectedByDay[Math.min(day,7)] - cycle.collectedByDay[0]))
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-card shadow-sm transition-all duration-300">
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {cycle.fy} · {cycle.clientId}
            </div>
            <h3 className="mt-0.5 truncate text-sm font-bold text-[var(--navy)]">
              {cycle.entityName}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.chip}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
                {status}
              </span>
              {!approved && day < 7 && (
                <span className="text-xs text-muted-foreground">
                  Day {day} of 7{daysLeft > 0 ? ` · ${daysLeft}d left` : ""}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl font-black" style={{ color: barColor }}>
              {Math.round(pct * 100)}%
            </div>
            <div className="text-[10px] text-muted-foreground">complete</div>
          </div>
        </div>
        <div className="mt-3">{pctBar(pct, barColor)}</div>
        <Timeline day={Math.min(day, 7)} />
      </div>

      {/* Missing data toggle */}
      {!approved && missingNow.length > 0 && (
        <div className="border-t border-[var(--border)]">
          <button
            className="flex w-full items-center justify-between px-5 py-3 text-sm font-semibold text-[var(--navy)] hover:bg-[var(--muted)]"
            onClick={onToggle}
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[#D90429]" />
              {missingNow.length} missing data point{missingNow.length !== 1 ? "s" : ""}
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
          {expanded && (
            <div className="border-t border-[var(--border)] px-5 pb-4 pt-3 space-y-2">
              {missingNow.map((mp) => (
                <div key={mp.id}
                  className="flex items-start gap-3 rounded-lg border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-2.5">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: SCOPE_DOT[mp.scope] ?? "#888" }} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--navy)]">{mp.name}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {mp.scope} · {mp.subcat} · {mp.unit}
                    </div>
                  </div>
                  <span className="ml-auto shrink-0 rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-bold text-[#D90429]">
                    Missing
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Day 7 handoff panel */}
      {day >= 7 && !approved && !rework && (
        <div className="border-t border-[#FDE68A] bg-[#FFFBEB] px-5 py-4">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 h-5 w-5 shrink-0 text-[#92400E]" />
            <div>
              <div className="text-sm font-bold text-[#92400E]">Awaiting consultant Claude session</div>
              <p className="mt-1 text-xs text-[#78350F] leading-relaxed">
                Data collection is closed. The consultant has been notified to open Claude
                (Cowork / Claude.ai), generate the GHG draft report from the master sheet,
                and submit it via the approval form.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <a href="#" className="inline-flex items-center gap-1.5 rounded-md bg-[#92400E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#78350F]">
                  <Bot className="h-3.5 w-3.5" /> Open Claude (Cowork)
                </a>
                <a href="#" className="inline-flex items-center gap-1.5 rounded-md border border-[#FDE68A] bg-white px-3 py-1.5 text-xs text-[#92400E] hover:bg-[#FEF9C3]">
                  <FolderOpen className="h-3.5 w-3.5" /> Open Master Sheet
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete state */}
      {approved && (
        <div className="border-t border-[#A7F3D0] bg-[#E6F4EF] px-5 py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[#1E6F5C]" />
            <div>
              <div className="text-sm font-bold text-[#1E6F5C]">Report delivered</div>
              <p className="text-xs text-[#155E4A]">
                Saved to Google Drive · emailed to {cycle.clientEmail} · portal updated
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Event Log Panel ───────────────────────────────────────────────────────────
function EventLog({ entries, day }: { entries: LogEntry[]; day: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries.length]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3">
        <FileText className="h-4 w-4 text-[#1E6F5C]" />
        <span className="text-sm font-bold text-[var(--navy)]">Pipeline Event Log</span>
        <span className="ml-auto rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] text-muted-foreground">
          {entries.length} event{entries.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div ref={ref} className="max-h-[420px] overflow-y-auto divide-y divide-[var(--border)]">
        {entries.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            Advance to Day 0 to start the simulation
          </div>
        )}
        {entries.map((e, i) => {
          const ls = LOG_STYLE[e.type];
          return (
            <div key={i} className="px-4 py-3" style={{ background: ls.bg, borderLeft: `3px solid ${ls.border}` }}>
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">{ls.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-xs font-bold text-[var(--navy)]">{e.title}</span>
                    <span className="text-[10px] text-muted-foreground">Day {e.day} · {ACTOR_LABEL[e.actor]}</span>
                  </div>
                  {e.to && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">To: {e.to}</div>
                  )}
                  <pre className="mt-1.5 whitespace-pre-wrap rounded bg-white/60 px-2 py-1.5 text-[10px] leading-relaxed text-[var(--navy)]">
                    {e.body}
                  </pre>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Test Controls Bar ─────────────────────────────────────────────────────────
function TestControls({
  day, approved, rework,
  onSetDay, onApprove, onRework, onReset,
}: {
  day: number; approved: boolean; rework: boolean;
  onSetDay: (d: number) => void;
  onApprove: () => void;
  onRework:  () => void;
  onReset:   () => void;
}) {
  const JUMP_DAYS = [0, 1, 3, 5, 7];

  return (
    <div className="border-b border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Label */}
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-[#D97706] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Test Mode
          </span>
          <span className="text-xs font-semibold text-[#92400E]">
            Simulated Day: <strong>{day}</strong> / 7
          </span>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1">
          <button
            disabled={day <= 0 || approved}
            onClick={() => onSetDay(day - 1)}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#FDE68A] bg-white text-[#92400E] hover:bg-[#FEF9C3] disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[28px] text-center text-sm font-black text-[#92400E]">{day}</span>
          <button
            disabled={day >= 7 || approved}
            onClick={() => onSetDay(day + 1)}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#FDE68A] bg-white text-[#92400E] hover:bg-[#FEF9C3] disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Jump buttons */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#92400E] opacity-70">Jump:</span>
          {JUMP_DAYS.map((d) => (
            <button
              key={d}
              disabled={approved}
              onClick={() => onSetDay(d)}
              className={`h-7 rounded px-2.5 text-xs font-semibold transition
                ${day === d
                  ? "bg-[#D97706] text-white"
                  : "border border-[#FDE68A] bg-white text-[#92400E] hover:bg-[#FEF9C3] disabled:opacity-30"
                }`}
            >
              {d === 7 ? "Day 7 ⚡" : `D${d}`}
            </button>
          ))}
        </div>

        {/* Approval buttons — only visible from Day 7 */}
        {day >= 7 && !approved && !rework && (
          <>
            <div className="h-5 w-px bg-[#FDE68A]" />
            <span className="text-[10px] font-semibold text-[#92400E] opacity-80">Simulate:</span>
            <button
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1E6F5C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#155E4A]"
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Approve report
            </button>
            <button
              onClick={onRework}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#FDE68A] bg-white px-3 py-1.5 text-xs font-semibold text-[#D97706] hover:bg-[#FEF9C3]"
            >
              <ThumbsDown className="h-3.5 w-3.5" /> Request rework
            </button>
          </>
        )}
        {rework && (
          <>
            <div className="h-5 w-px bg-[#FDE68A]" />
            <span className="text-xs text-orange-600 font-semibold">Rework requested → consultant re-runs Claude →</span>
            <button
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1E6F5C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#155E4A]"
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Approve revised report
            </button>
          </>
        )}

        {/* Reset */}
        <button
          onClick={onReset}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[#FDE68A] bg-white px-3 py-1.5 text-xs text-[#92400E] hover:bg-[#FEF9C3]"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>

      {/* Progress bar for the cycle */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#FDE68A]">
        <div
          className="h-full rounded-full bg-[#D97706] transition-all duration-500"
          style={{ width: approved ? "100%" : `${Math.min((day / 7) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function ReportingStatus() {
  const { entity } = useEntity();
  const { fy } = useFiscalYear();
  const ctx = useClientContext();
  const consolidatedCode = ctx.entities.find(e => e.is_consolidated)?.code;
  const consultantEmail = (ctx.config?.consultant_email as string | undefined) ?? "[consultant@deepwoodsgreen.com]";
  const contactEmail    = (ctx.config?.contact_email    as string | undefined) ?? "client@example.com";

  const allCycles = buildCycles(ctx.entities, fy, ctx.client.slug, contactEmail);

  const [simDay,    setSimDay]    = useState(-1);  // -1 = not started
  const [approved,  setApproved]  = useState(false);
  const [rework,    setRework]    = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const cycles = entity === consolidatedCode
    ? allCycles
    : allCycles.filter((c) => c.entityId === entity);

  // Build combined event log (across all shown cycles)
  const allEvents = cycles
    .flatMap((c) => simDay >= 0 ? buildLog(c, Math.min(simDay, 7), consultantEmail) : [])
    .sort((a, b) => a.day - b.day);

  // Approval events
  const approvalEvents: LogEntry[] = [];
  if (approved) {
    cycles.forEach((c) => {
      approvalEvents.push({
        day: 7, type: "success", actor: "consultant",
        title: `✅ Report APPROVED — ${c.entityName}`,
        body: `Consultant approved the draft. System actions:\n  1. Report saved to Google Drive (${c.clientId})\n  2. Final email dispatched to ${c.clientEmail} with PDF attached\n  3. Portal status updated → Complete`,
      });
    });
  }
  if (rework) {
    cycles.forEach((c) => {
      approvalEvents.push({
        day: 7, type: "manual", actor: "consultant",
        title: `🔄 Rework requested — ${c.entityName}`,
        body: `Consultant requested changes. Rework comments logged. Consultant will re-run Claude session with revision notes, then re-submit for approval.`,
        to: consultantEmail,
      });
    });
  }

  const displayEvents = [...allEvents, ...approvalEvents];

  const handleReset = () => {
    setSimDay(-1);
    setApproved(false);
    setRework(false);
    setExpandedCards({});
  };

  const handleSetDay = (d: number) => {
    setSimDay(d);
    if (d < 7) { setApproved(false); setRework(false); }
  };

  const handleApprove = () => { setApproved(true); setRework(false); };
  const handleRework  = () => { setRework(true);   setApproved(false); };

  const avgPct = cycles.reduce((s, c) => s + getPct(c, Math.max(0, simDay)), 0) / cycles.length;
  const barColor = approved ? "#1E6F5C" : avgPct >= 0.8 ? "#16A34A" : avgPct >= 0.5 ? "#D97706" : "#D90429";

  return (
    <>
      <PageHeader
        title="Reporting Status"
        description={`${fy} GHG data collection · 7-day automated cycle`}
        right={
          approved
            ? <span className="rounded-full bg-[#E6F4EF] px-3 py-1 text-xs font-semibold text-[#1E6F5C]">✅ Cycle complete</span>
            : simDay >= 7
            ? <span className="rounded-full bg-[#FFF9C4] px-3 py-1 text-xs font-semibold text-[#92400E]">⏳ Awaiting Claude session</span>
            : simDay >= 0
            ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">● Cycle active — Day {simDay} of 7</span>
            : <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">Not started</span>
        }
      />

      <TestControls
        day={Math.max(0, simDay)}
        approved={approved}
        rework={rework}
        onSetDay={handleSetDay}
        onApprove={handleApprove}
        onRework={handleRework}
        onReset={handleReset}
      />

      <PageBody>
        {/* Info / instruction banner */}
        {simDay < 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-4 text-sm">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#3B82F6]" />
            <div className="text-[var(--navy)]">
              <strong>Test mode active.</strong> Use the controls above to advance the simulated cycle day.
              Every email, escalation, and status change plays out in the Event Log below.
              Start at <strong>Day 0</strong> to open the collection window, then step through to
              <strong> Day 7</strong> to trigger the consultant Claude session handoff.
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => handleSetDay(0)}
                  className="inline-flex items-center gap-1.5 rounded bg-[#3B82F6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2563EB]"
                >
                  <Play className="h-3.5 w-3.5" /> Start simulation (Day 0)
                </button>
                <button
                  onClick={() => handleSetDay(7)}
                  className="inline-flex items-center gap-1.5 rounded border border-[#BFDBFE] bg-white px-3 py-1.5 text-xs text-[#1D4ED8] hover:bg-[#EFF6FF]"
                >
                  <SkipForward className="h-3.5 w-3.5" /> Jump to Day 7 (handoff)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Consolidated summary */}
        {simDay >= 0 && entity === consolidatedCode && (
          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[#E6F4EF] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#1E6F5C]">Consolidated — All Entities</div>
                <div className="mt-1 text-sm font-semibold text-[var(--navy)]">
                  {fy} · {approved ? "Cycle complete ✅" : `Day ${simDay} of 7`}
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="text-2xl font-black" style={{ color: barColor }}>
                    {Math.round(avgPct * 100)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">avg. complete</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-[#D90429]">
                    {cycles.reduce((s, c) => s + c.missingPoints.length, 0)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">total missing</div>
                </div>
              </div>
            </div>
            <div className="mt-3">{pctBar(avgPct, barColor)}</div>
          </div>
        )}

        {/* Entity cards */}
        {simDay >= 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {cycles.map((cycle) => (
              <EntityCycleCard
                key={cycle.entityId}
                cycle={cycle}
                day={simDay}
                approved={approved}
                rework={rework}
                expanded={!!expandedCards[cycle.entityId]}
                onToggle={() =>
                  setExpandedCards((p) => ({ ...p, [cycle.entityId]: !p[cycle.entityId] }))
                }
              />
            ))}
          </div>
        )}

        {/* Event log */}
        <div className={simDay >= 0 ? "mt-8" : ""}>
          <EventLog entries={displayEvents} day={simDay} />
        </div>

        {/* Past reports */}
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3">
            <ShieldCheck className="h-4 w-4 text-[#1E6F5C]" />
            <span className="text-sm font-bold text-[var(--navy)]">Past Delivered Reports</span>
          </div>
          {[
            { fy: "FY2025", entity: "All entities — consolidated", delivered: "Oct 2025" },
            { fy: "FY2024", entity: "All entities — consolidated", delivered: "Oct 2024" },
            { fy: "FY2023", entity: "All entities — consolidated", delivered: "Sep 2023" },
          ].map((r) => (
            <div key={r.fy} className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3 last:border-0">
              <div>
                <div className="text-sm font-semibold text-[var(--navy)]">{r.fy} GHG Inventory Report</div>
                <div className="text-xs text-muted-foreground">{r.entity} · Delivered {r.delivered}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#E6F4EF] px-2 py-0.5 text-[11px] font-semibold text-[#1E6F5C]">Complete</span>
                <a href="#" className="inline-flex items-center gap-1 text-xs text-[#1E6F5C] hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Drive
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <a href="#" className="inline-flex items-center gap-1 hover:text-[#1E6F5C] hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Master Spreadsheet
          </a>
          <span>·</span>
          <Link to="/priority-actions" className="inline-flex items-center gap-1 hover:text-[#1E6F5C] hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Priority Actions
          </Link>
          <span>·</span>
          <Link to="/methodology" className="inline-flex items-center gap-1 hover:text-[#1E6F5C] hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Methodology
          </Link>
        </div>
      </PageBody>
    </>
  );}
export default ReportingStatus;
