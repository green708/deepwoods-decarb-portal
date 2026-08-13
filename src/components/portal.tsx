import type { ReactNode } from "react";
import { Lock, type LucideIcon } from "lucide-react";

export function PageHeader({ eyebrow, title, description, right }: { eyebrow?: string; title: string; description?: string; right?: ReactNode }) {
  return (
    <div className="px-6 pt-5 pb-0 md:px-8">
      <div className="rounded-xl border border-[var(--border)] bg-card px-7 py-6 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_20px_rgba(15,23,42,0.07)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {eyebrow && (
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EF] px-2.5 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1E6F5C]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#1E6F5C]">{eyebrow}</span>
                </span>
              </div>
            )}
            <h1 className="text-[26px] font-semibold leading-[34px] tracking-[-0.02em] text-[var(--navy)]">{title}</h1>
            {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground leading-relaxed">{description}</p>}
          </div>
          {right && <div className="flex items-start">{right}</div>}
        </div>
      </div>
    </div>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="px-6 py-8 md:px-8">{children}</div>;
}

export function Section({ title, subtitle, children, right }: { title: string; subtitle?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <span className="inline-block h-5 w-1 rounded-full bg-[#1E6F5C]" />
            <h2 className="text-[22px] font-semibold leading-[30px] tracking-[-0.01em] text-[var(--navy)]">{title}</h2>
          </div>
          {subtitle && <p className="ml-3.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border bg-card p-5 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_14px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-[0_2px_6px_rgba(15,23,42,0.1),0_8px_24px_rgba(15,23,42,0.06)] ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, unit, delta, tone = "default" }: { label: string; value: string; unit?: string; delta?: { pct: number; direction: "up" | "down"; good?: boolean }; tone?: "default" | "green" | "navy" | "success" | "warning" | "alert" }) {
  const tones: Record<string, string> = {
    default: "bg-card",
    green:   "bg-[#E6F4EF] border-[#1E6F5C]/30",
    navy:    "bg-[var(--navy)] text-white",
    success: "bg-[#E6F4EF] border-[#16A34A]/30",
    warning: "bg-[#FEF3C7] border-[#D97706]/30",
    alert:   "bg-[#FEE2E2] border-[#D90429]/30",
  };
  const isNavy = tone === "navy";
  const isGreen = tone === "green";
  const deltaColor = delta ? (delta.good ? "text-[#16A34A]" : "text-[#D90429]") : "";
  return (
    <div className={`rounded-xl border p-5 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_14px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-[0_2px_6px_rgba(15,23,42,0.1),0_8px_24px_rgba(15,23,42,0.06)] ${tones[tone]}`}>
      <div className={`text-xs font-medium uppercase tracking-wider ${isNavy ? "text-[#94A3B8]" : isGreen ? "text-[#1E6F5C]" : "text-muted-foreground"}`}>{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className={`num text-3xl font-bold tabular-nums ${isNavy ? "text-white" : isGreen ? "text-[#1E6F5C]" : "text-[var(--navy)]"}`}>{value}</div>
        {unit && <div className={`text-sm ${isNavy ? "text-[#94A3B8]" : "text-muted-foreground"}`}>{unit}</div>}
      </div>
      {delta && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-semibold ${deltaColor}`}>
          <span>{delta.direction === "up" ? "▲" : "▼"} {Math.abs(delta.pct).toFixed(1)}%</span>
          <span className="font-normal text-muted-foreground">vs prior yr</span>
        </div>
      )}
    </div>
  );
}

export function LockedState({ title, message, cta }: { title: string; message: string; cta?: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-[#D1D5DB] bg-card p-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3F4F6]">
        <Lock className="h-5 w-5 text-[var(--navy-2)]" />
      </div>
      <h3 className="text-[16px] font-semibold leading-[24px] text-[var(--navy)]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  cta?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-card px-6 py-12 text-center">
      {Icon && (
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3F4F6]">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-semibold text-[var(--navy)]">{title}</p>
      {description && <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>}
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}

export function fmt(n: number | null, dp = 3): string {
  if (n === null || n === undefined) return "N/A";
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
export function fmtInt(n: number): string { return n.toLocaleString(); }
