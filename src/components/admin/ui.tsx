// Shared building blocks for the Deepwoods admin console.
// Look & feel mirrors the rest of the portal: light canvas, white cards, moss-green accents.

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useAdminCycles } from "@/lib/api-admin";
import type { CalcState, CycleState, PortfolioFlag } from "@/lib/api-admin";

export const CARD = "rounded-xl border border-[var(--border)] bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07)]";
export const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E6F5C] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#185B4C] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C] focus-visible:ring-offset-2";
export const SECONDARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--navy)] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C]";
export const DANGER_BTN =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400";
export const INPUT =
  "h-9 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--navy)] placeholder:text-slate-400 focus:border-[#1E6F5C] focus:outline-none focus:ring-1 focus:ring-[#1E6F5C] disabled:bg-slate-50 disabled:text-slate-400";

/** Props every client-scoped admin tab receives. */
export interface ClientTabProps {
  clientId: number;
  clientName: string;
  slug: string;
  reportingPeriod: "FY" | "CY";
  /** Fiscal year selected in the workspace header, e.g. "FY27" or "CY2026". */
  fy: string;
  /** True for deepwoods_admin; coordinators have fewer write permissions. */
  isAdmin: boolean;
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function Section({ title, description, right, children }: { title: string; description?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--navy)]">{title}</h2>
          {description && <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{description}</p>}
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--navy)]">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function EmptyHint({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[#F8FAF9] px-5 py-8 text-center">
      <p className="text-sm font-semibold text-[var(--navy)]">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "Something went wrong";
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{msg}</div>;
}

// ── Pills ─────────────────────────────────────────────────────────────────────

type Tone = "green" | "amber" | "red" | "slate" | "blue";
const TONES: Record<Tone, string> = {
  green: "bg-[#E6F4EF] text-[#1E6F5C]",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-sky-50 text-sky-700",
};

export function Pill({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONES[tone]}`}>{children}</span>;
}

export function PaymentPill({ status }: { status: "pending" | "paid" | "waived" }) {
  return <Pill tone={status === "pending" ? "amber" : "green"}>{status === "pending" ? "Awaiting payment" : status === "paid" ? "Paid" : "Waived"}</Pill>;
}

export function CalcPill({ status }: { status: CalcState | "none" }) {
  if (status === "none") return <Pill>No data</Pill>;
  const map: Record<CalcState, [Tone, string]> = {
    draft: ["slate", "Draft"], calculated: ["amber", "To verify"], verified: ["green", "Verified"], locked: ["blue", "Locked"],
  };
  return <Pill tone={map[status][0]}>{map[status][1]}</Pill>;
}

export function CyclePill({ status, overdue }: { status: CycleState | "none"; overdue?: boolean }) {
  if (overdue) return <Pill tone="red">Overdue</Pill>;
  if (status === "none") return <Pill>No cycle</Pill>;
  const map: Record<CycleState, [Tone, string]> = { open: ["slate", "Collecting"], submitted: ["blue", "Submitted"], locked: ["green", "Locked"] };
  return <Pill tone={map[status][0]}>{map[status][1]}</Pill>;
}

export const FLAG_LABEL: Record<PortfolioFlag, [Tone, string]> = {
  overdue: ["red", "Overdue"],
  to_verify: ["amber", "To verify"],
  open_query: ["amber", "Reply needed"],
  no_users: ["red", "No users"],
  unpaid: ["amber", "Unpaid"],
  inactive: ["slate", "Inactive"],
  no_data: ["slate", "No data yet"],
};

// ── Dates ─────────────────────────────────────────────────────────────────────

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d.length === 10 ? `${d}T00:00:00` : d.replace(" ", "T"));
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(d: string | null | undefined): string {
  if (!d) return "never";
  const dt = new Date(d.replace(" ", "T"));
  if (Number.isNaN(dt.getTime())) return "—";
  const mins = Math.round((Date.now() - dt.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 45) return `${days}d ago`;
  return fmtDate(d);
}

/** Fiscal-year choices around the client's current year, newest first. */
export function fyOptions(reportingPeriod: "FY" | "CY", currentFy: string, back = 5, forward = 1): string[] {
  const digits = parseInt(currentFy.replace(/\D/g, ""), 10);
  if (Number.isNaN(digits)) return [currentFy];
  const full = digits >= 100;
  const out: string[] = [];
  for (let d = digits + forward; d >= digits - back; d--) {
    out.push(reportingPeriod === "CY" ? `CY${full ? d : 2000 + d}` : `FY${full ? d : String(d % 100).padStart(2, "0")}`);
  }
  return out;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export function Pager({ page, perPage, total, onPage }: { page: number; perPage: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (total <= perPage) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 text-xs text-muted-foreground">
      <span>{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <button type="button" className={SECONDARY_BTN + " !px-2 !py-1"} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        <span className="px-2 tabular-nums">Page {page} / {pages}</span>
        <button type="button" className={SECONDARY_BTN + " !px-2 !py-1"} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Debounces a fast-changing value (search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** The client's reporting entities (code + name), for entity pickers. Derived from the cycles endpoint. */
export function useClientEntityList(clientId: number | null, fy?: string) {
  const q = useAdminCycles(clientId, fy);
  return { entities: (q.data?.entities ?? []).map((e) => ({ code: e.entity, name: e.entity_name })), isLoading: q.isLoading, error: q.error };
}
