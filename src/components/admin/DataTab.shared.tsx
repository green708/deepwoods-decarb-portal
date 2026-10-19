import type { ReactNode } from "react";
import { INPUT } from "@/components/admin/ui";

export interface EntityOption { code: string; name: string }

export function EntitySelect({ id, value, onChange, entities, allLabel, placeholder = "Select entity", disabled }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  entities: EntityOption[];
  allLabel?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select id={id} className={INPUT} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {allLabel ? <option value="">{allLabel}</option> : <option value="" disabled>{placeholder}</option>}
      {entities.map((e) => <option key={e.code} value={e.code}>{e.name} ({e.code})</option>)}
    </select>
  );
}

export function LabeledControl({ htmlFor, label, hint, error, children }: { htmlFor: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-[var(--navy)]">{label}</label>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function ConfirmDialogBody({ children }: { children: ReactNode }) {
  return <div className="text-sm text-muted-foreground">{children}</div>;
}

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function describeError(e: unknown, fallback = "Request failed"): string {
  if (!(e instanceof Error)) return fallback;
  const fields = (e as Error & { fields?: Record<string, string> }).fields;
  const detail = fields ? Object.values(fields).filter(Boolean).join(" ") : "";
  return detail && !e.message.includes(detail) ? `${e.message}: ${detail}` : e.message;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
