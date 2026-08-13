import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { HelpCircle, Info, X } from "lucide-react";
import type { ReactNode } from "react";
import { ROLE_LABEL, type TeamMember, type TeamRole } from "@/lib/portal-store";

/* ---------- wordmark ---------- */
export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("leading-none", className)}>
      <div className="text-[13px] font-semibold tracking-[0.18em] text-canopy uppercase">
        Deepwoods
      </div>
      <div className="mt-1 text-lg font-bold text-ink">GREEN</div>
    </div>
  );
}

/* ---------- ring watermark ---------- */
export function RingWatermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-40 -right-40 z-0 select-none opacity-[0.05]"
    >
      <svg width="620" height="620" viewBox="0 0 620 620" fill="none">
        {[60, 120, 180, 240, 300].map((r) => (
          <circle key={r} cx="310" cy="310" r={r} stroke="currentColor" strokeWidth="10" />
        ))}
      </svg>
    </div>
  );
}

/* ---------- stamp badge ---------- */
const STAMP: Record<string, { label: string; color: string }> = {
  accepted: { label: "Accepted", color: "var(--meadow)" },
  pending: { label: "Pending review", color: "var(--amber)" },
  draft: { label: "Draft", color: "var(--neutralstamp)" },
  paid: { label: "Paid", color: "var(--meadow)" },
  due: { label: "Due", color: "var(--amber)" },
};

export function StampBadge({ status, className }: { status: string; className?: string }) {
  const s = STAMP[status] ?? { label: status, color: "var(--slate)" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-[3px] text-[11px] font-medium tracking-[0.04em] uppercase",
        className,
      )}
      style={{ borderColor: s.color, color: s.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

/* ---------- ring stepper ---------- */
export function RingStepper({
  steps,
  current,
  onStep,
}: {
  steps: string[];
  current: number;
  onStep?: (i: number) => void;
}) {
  return (
    <div className="flex w-full items-start justify-between gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onStep?.(i)}
            className="flex flex-1 cursor-pointer flex-col items-center gap-2 text-center"
          >
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
                done && "bg-canopy text-white",
                active && "border-[3px] border-coral text-coral",
                !done && !active && "border border-border text-slate",
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                active ? "text-coral" : done ? "text-ink" : "text-slate",
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- ring number glyph ---------- */
export function RingNumber({ n, className }: { n: number | string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canopy text-[11px] font-bold text-white",
        className,
      )}
    >
      {n}
    </span>
  );
}

/* ---------- field wrappers ---------- */
export function MicroLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("micro-label", className)}>{children}</div>;
}

export function Field({
  label,
  helper,
  required,
  tooltip,
  children,
  className,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  tooltip?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        {label}
        {required && <span className="h-1.5 w-1.5 rounded-full bg-coral" />}
        {tooltip && (
          <button
            type="button"
            title={tooltip}
            onClick={() => toast(tooltip)}
            className="cursor-pointer text-slate"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
      </label>
      {children}
      {helper && <p className="text-xs text-slate">{helper}</p>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-coral";

export function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "cursor-pointer px-4 py-1.5 text-sm font-medium transition-colors",
            value === v ? "bg-canopy text-white" : "bg-white text-slate hover:bg-paper",
          )}
        >
          {v ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

/* ---------- team member card ---------- */
export function TeamMemberCard({
  member,
  index,
  onChange,
  onRemove,
}: {
  member: TeamMember;
  index: number;
  onChange: (patch: Partial<TeamMember>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative rounded-[10px] border border-border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RingNumber n={index + 1} />
          <MicroLabel>Team member</MicroLabel>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer text-slate hover:text-coral"
          aria-label="Remove team member"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Full name" required helper="The person who'll receive this invite and role.">
          <input
            className={inputCls}
            value={member.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
          />
        </Field>
        <Field
          label="Email"
          required
          helper="They'll get an invite scoped to this entity only — not to the rest of the group."
        >
          <input
            className={inputCls}
            value={member.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </Field>
        <Field
          label="Role"
          required
          helper="Account Admin can manage this entity's team and data. Data Contributor can fill in and edit data. Viewer can see dashboards and reports but can't edit anything."
        >
          <select
            className={inputCls}
            value={member.role}
            onChange={(e) => onChange({ role: e.target.value as TeamRole })}
          >
            {(Object.keys(ROLE_LABEL) as TeamRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

/* ---------- help button ---------- */
export function HelpButton() {
  return (
    <button
      type="button"
      onClick={() => toast("Help isn't wired up in this build — contact your Deepwoods contact.")}
      className="fixed right-6 bottom-6 z-50 flex h-11 w-11 cursor-pointer items-center justify-center rounded-[6px] bg-canopy text-white shadow-sm transition-opacity hover:opacity-90"
      aria-label="Help"
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
}
