import { useState } from "react";
import { Bell, ChevronRight, Plus, ArrowLeft, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SCHEMAS, SCHEMA_ORDER } from "@/lib/ghg/scope3Schemas";
import { useGhgStore } from "@/lib/ghg/store";
import { useFiscalYear, useEntity } from "@/lib/entity";
import { useClientContext } from "@/lib/client-context";
import { CategoryCard } from "./scope3/CategoryCard";
import { ThreadPanel } from "@/components/threads/ThreadPanel";

// ── Stream classification (Upstream / Downstream) ────────────────────────────
const STREAM: Record<string, "up" | "down"> = {
  c1: "up",   c2: "up",   c3: "up",  c4: "up",  c5: "up",  c6: "up",  c7: "up",  c8: "up",
  c9: "down", c10: "down", c11: "down", c12: "down", c13: "down", c14: "down", c15: "down",
};

type FilterType = "all" | "up" | "down";
type CatStatus = "done" | "inprog" | "idle";

// ── Status helper ─────────────────────────────────────────────────────────────
function useCatStatus(id: string): CatStatus {
  const { getS3Data } = useGhgStore();
  const d = getS3Data(id);
  if (d.submitted) return "done";
  if (d.rows.length > 0 || d.files.length > 0) return "inprog";
  return "idle";
}

// ── Individual grid card ──────────────────────────────────────────────────────
function CategoryGridCard({
  id,
  onClick,
}: {
  id: string;
  onClick: () => void;
}) {
  const schema = SCHEMAS[id];
  const { getS3Data } = useGhgStore();
  const data = getS3Data(id);
  const status: CatStatus = data.submitted ? "done" : data.rows.length > 0 || data.files.length > 0 ? "inprog" : "idle";

  const methodId = data.method ?? schema?.recommended ?? schema?.methods[0]?.id;
  const currentMethod = schema?.methods.find((m) => m.id === methodId) ?? schema?.methods[0];
  const methodLabel = schema?.noTemplate
    ? "Auto-calculated from Scope 1 & 2"
    : currentMethod?.plainLabel ?? currentMethod?.label ?? "—";

  if (!schema) return null;

  const borderColor =
    status === "done" ? "border-l-primary" :
    status === "inprog" ? "border-l-amber-warn" :
    "border-l-border";

  const dotColor =
    status === "done" ? "bg-primary" :
    status === "inprog" ? "bg-amber-warn" :
    "bg-muted-foreground/30";

  const progressWidth =
    status === "done" ? "w-full" :
    status === "inprog" ? "w-[55%]" :
    "w-0";

  const progressColor =
    status === "done" ? "bg-primary" :
    status === "inprog" ? "bg-amber-warn" :
    "";

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={status === "done" ? { borderColor: "#A8D9C6", background: "#E6F3EE" } : undefined}
      className={cn(
        "relative overflow-hidden rounded-xl border-l-[3px] bg-card border border-border shadow-sm cursor-pointer",
        "transition-all hover:shadow-md hover:-translate-y-0.5 flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-primary",
        status === "inprog" && "border-amber-warn/40",
        borderColor,
      )}
    >
      {/* Body */}
      <div className="px-4 pt-4 pb-3 flex-1 flex flex-col gap-0">
        {/* Code + dot row */}
        <div className="flex items-start justify-between mb-2">
          <span className={cn(
            "font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border",
            status === "done"
              ? "bg-primary/10 border-primary/25 text-primary"
              : "bg-muted border-border text-muted-foreground",
          )}>
            {schema.code}
          </span>
          <div className={cn("w-2 h-2 rounded-full mt-1 flex-shrink-0", dotColor)} />
        </div>

        {/* Name */}
        <h4
          className={cn("text-[13px] font-bold leading-snug mb-1.5", status !== "done" && "text-navy")}
          style={status === "done" ? { color: "#155447" } : undefined}
        >
          {schema.name}
        </h4>

        {/* Method label */}
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-3">
          <span className="w-1 h-1 rounded-full bg-muted-foreground/35 flex-shrink-0 inline-block" />
          {methodLabel}
        </p>

        {/* Progress bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden mt-auto">
          <div className={cn("h-full rounded-full transition-all", progressColor, progressWidth)} />
        </div>
      </div>

      {/* Footer */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2.5 border-t",
        status === "done" ? "border-primary/15" : "border-border",
      )}>
        <span className={cn(
          "text-[10px] font-extrabold tracking-wide px-2 py-0.5 rounded",
          status === "done" ? "bg-primary text-white" :
          status === "inprog" ? "bg-amber-warn text-white" :
          "bg-muted text-muted-foreground border border-border",
        )}>
          {status === "done" ? "Submitted" : status === "inprog" ? "In Progress" : "Not Started"}
        </span>
        <span className="text-[11px] font-semibold text-primary flex items-center gap-0.5">
          Open <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────
function SectionDivider({ label, stream }: { label: string; stream: "up" | "down" }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className={cn(
        "text-[10px] font-extrabold tracking-[.07em] uppercase px-2.5 py-1 rounded-full text-white flex-shrink-0",
        stream === "up" ? "bg-[#2C5245]" : "bg-[#7A3B1F]",
      )}>
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3.5 shadow-sm">
      <div className="text-[10px] font-extrabold tracking-[.07em] uppercase text-muted-foreground mb-2">
        {label}
      </div>
      <div className={cn("text-3xl font-bold tabular-nums leading-none", color ?? "text-navy")}>
        {value}
      </div>
    </div>
  );
}

// ── Tracker summary ───────────────────────────────────────────────────────────
function TrackerSummary({
  relevantIds,
  getStatusFor,
  onOpenReminders,
}: {
  relevantIds: string[];
  getStatusFor: (id: string) => CatStatus;
  onOpenReminders: () => void;
}) {
  const upIds = relevantIds.filter((id) => STREAM[id] === "up" || !STREAM[id]);
  const downIds = relevantIds.filter((id) => STREAM[id] === "down");

  const renderRows = (ids: string[], title: string) => (
    <div className="flex-1 min-w-0">
      <div className="px-4 py-2 text-[10px] font-extrabold tracking-[.08em] uppercase text-muted-foreground bg-muted/40 border-b border-border">
        {title}
      </div>
      {ids.map((id) => {
        const schema = SCHEMAS[id];
        if (!schema) return null;
        const st = getStatusFor(id);
        return (
          <div key={id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground flex-shrink-0">
              {schema.code}
            </span>
            <span className="text-[12px] text-navy flex-1 min-w-0 truncate">{schema.name}</span>
            <div className="w-16 flex-shrink-0">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div className={cn(
                  "h-full rounded-full",
                  st === "done" ? "bg-primary w-full" :
                  st === "inprog" ? "bg-amber-warn w-[55%]" : "w-0",
                )} />
              </div>
            </div>
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0",
              st === "done" ? "bg-primary text-white" :
              st === "inprog" ? "bg-amber-warn text-white" :
              "bg-muted text-muted-foreground border border-border",
            )}>
              {st === "done" ? "Done" : st === "inprog" ? "In progress" : "Idle"}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-navy">Submission Tracker</h3>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={onOpenReminders}
        >
          <Bell className="h-3.5 w-3.5" />
          Send gap reminders
        </Button>
      </div>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex divide-x divide-border">
          {upIds.length > 0 && renderRows(upIds, "Upstream")}
          {downIds.length > 0 && renderRows(downIds, "Downstream")}
        </div>
      </div>
    </div>
  );
}

// ── Request Category dialog ───────────────────────────────────────────────────
function RequestCategoryDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl border shadow-lg w-full max-w-md p-6">
        <h3 className="text-base font-bold text-navy mb-1.5">Request a Scope 3 Category</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Not seeing a category that applies to your business? Let your Deepwoods
          consultant know — they&apos;ll review and enable it.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm resize-none h-24 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Which GHG Protocol category applies? Any context about your supply chain or operations?"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="gap-1.5" onClick={onClose}>
            Send request
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Gap Reminders dialog ──────────────────────────────────────────────────────
function GapRemindersDialog({
  open,
  onClose,
  relevantIds,
  getStatusFor,
}: {
  open: boolean;
  onClose: () => void;
  relevantIds: string[];
  getStatusFor: (id: string) => CatStatus;
}) {
  const pending = relevantIds.filter((id) => getStatusFor(id) !== "done");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl border shadow-lg w-full max-w-md p-6">
        <h3 className="text-base font-bold text-navy mb-1.5">Send Data Gap Reminders</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {pending.length > 0
            ? `${pending.length} ${pending.length === 1 ? "category" : "categories"} not yet submitted. The client will receive an email listing these.`
            : "All categories are submitted — no reminders needed."}
        </p>
        {pending.length > 0 && (
          <div className="rounded-lg border bg-muted/30 divide-y divide-border mb-4 max-h-52 overflow-y-auto">
            {pending.map((id) => {
              const schema = SCHEMAS[id];
              if (!schema) return null;
              const st = getStatusFor(id);
              return (
                <div key={id} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                    {schema.code}
                  </span>
                  <span className="flex-1 text-navy text-[12px]">{schema.name}</span>
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded",
                    st === "inprog" ? "bg-amber-warn text-white" : "bg-muted text-muted-foreground border border-border",
                  )}>
                    {st === "inprog" ? "In progress" : "Idle"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          {pending.length > 0 && (
            <Button size="sm" className="gap-1.5" onClick={onClose}>
              <Bell className="h-3.5 w-3.5" /> Send reminders
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function Scope3Cards() {
  const { state, getS3Data } = useGhgStore();
  const { fy } = useFiscalYear();
  const { entity } = useEntity();
  const ctx = useClientContext();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [requestOpen, setRequestOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);

  // Categories marked not-relevant by admin for this entity
  const hiddenCatCodes: string[] = (ctx.s3_not_relevant?.[entity] ?? []);
  const hiddenIds = SCHEMA_ORDER.filter(id => hiddenCatCodes.includes(SCHEMAS[id]?.code ?? ""));
  const relevantIds = SCHEMA_ORDER.filter(id => !hiddenIds.includes(id));

  const getStatusFor = (id: string): CatStatus => {
    const d = getS3Data(id);
    if (d.submitted) return "done";
    if (d.rows.length > 0 || d.files.length > 0) return "inprog";
    return "idle";
  };

  // Stats
  const total = relevantIds.length;
  const done = relevantIds.filter((id) => getStatusFor(id) === "done").length;
  const inprog = relevantIds.filter((id) => getStatusFor(id) === "inprog").length;
  const idle = total - done - inprog;

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selectedId !== null) {
    const schema = SCHEMAS[selectedId];
    return (
      <div>
        <button
          onClick={() => setSelectedId(null)}
          className="mb-6 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px] font-bold text-foreground shadow-sm hover:bg-muted/60 hover:border-primary/30 hover:text-primary transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          All categories
        </button>

        {schema ? (
          <CategoryCard
            schema={schema}
            initialOpen
            extraSlot={<ThreadPanel sourceType="scope3" sourceId={selectedId} fy={fy} />}
          />
        ) : null}
      </div>
    );
  }

  // ── Grid view ────────────────────────────────────────────────────────────────
  const filteredIds = relevantIds.filter((id) =>
    filter === "all" ? true : STREAM[id] === filter,
  );
  const upstreamIds = filteredIds.filter((id) => STREAM[id] === "up" || !STREAM[id]);
  const downstreamIds = filteredIds.filter((id) => STREAM[id] === "down");

  const upCount = relevantIds.filter((id) => STREAM[id] === "up" || !STREAM[id]).length;
  const downCount = relevantIds.filter((id) => STREAM[id] === "down").length;

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[.09em] uppercase text-muted-foreground mb-1">
            Scope 3
          </p>
          <h2 className="text-xl font-bold text-navy tracking-tight">Value Chain Emissions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {total} applicable GHG Protocol {total === 15 ? "" : `of 15 `}categories
            {" "}· {done} submitted · {inprog} in progress
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setRequestOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Request category
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setRemindersOpen(true)}
          >
            <Bell className="h-3.5 w-3.5" />
            Send reminders
          </Button>
        </div>
      </div>

      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total Categories" value={total} />
        <StatTile label="Submitted" value={done} color="text-primary" />
        <StatTile label="In Progress" value={inprog} color="text-amber-warn" />
        <StatTile label="Not Started" value={idle} color="text-muted-foreground" />
      </div>

      {/* ── Filter chips ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { key: "all", label: `All (${total})` },
            { key: "up", label: `Upstream (${upCount})` },
            { key: "down", label: `Downstream (${downCount})` },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
              filter === key
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-card border-border text-muted-foreground hover:text-navy hover:border-primary/20",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Upstream grid ── */}
      {upstreamIds.length > 0 && (
        <div className="space-y-3">
          {filter !== "down" && <SectionDivider label="Upstream" stream="up" />}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upstreamIds.map((id) => (
              <CategoryGridCard key={id} id={id} onClick={() => setSelectedId(id)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Downstream grid ── */}
      {downstreamIds.length > 0 && (
        <div className="space-y-3">
          {filter !== "up" && <SectionDivider label="Downstream" stream="down" />}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {downstreamIds.map((id) => (
              <CategoryGridCard key={id} id={id} onClick={() => setSelectedId(id)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Tracker ── */}
      <TrackerSummary
        relevantIds={relevantIds}
        getStatusFor={getStatusFor}
        onOpenReminders={() => setRemindersOpen(true)}
      />

      {/* ── Hidden / not-applicable categories ── */}
      {hiddenIds.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-3 mb-3">
            <EyeOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-semibold text-muted-foreground">
              {hiddenIds.length} {hiddenIds.length === 1 ? "category" : "categories"} not applicable for this entity
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {hiddenIds.map(id => {
              const schema = SCHEMAS[id];
              if (!schema) return null;
              return (
                <div key={id} className="relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-muted border-border text-muted-foreground">
                      {schema.code}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border uppercase tracking-wide">
                      Not applicable
                    </span>
                  </div>
                  <h4 className="text-[13px] font-semibold text-muted-foreground leading-snug">{schema.name}</h4>
                  <button
                    onClick={() => setRequestOpen(true)}
                    className="mt-auto text-[11px] font-semibold text-primary underline-offset-2 hover:underline text-left"
                  >
                    Request to include →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
      <RequestCategoryDialog open={requestOpen} onClose={() => setRequestOpen(false)} />
      <GapRemindersDialog
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
        relevantIds={relevantIds}
        getStatusFor={getStatusFor}
      />
    </div>
  );
}
