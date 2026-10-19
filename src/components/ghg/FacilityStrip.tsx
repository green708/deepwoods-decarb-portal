import { FACILITIES } from "@/lib/ghg/registry";
import { completionColor, useGhgStore } from "@/lib/ghg/store";
import { cn } from "@/lib/utils";

interface Props {
  onSelect?: (facilityId: string) => void;
  activeId?: string;
}

export function FacilityStrip({ onSelect, activeId }: Props) {
  const { facilityProgress } = useGhgStore();
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      {FACILITIES.map((f) => {
        const pct = facilityProgress(f.id);
        const color = completionColor(pct);
        const bg =
          color === "green" ? "bg-ghg-green-soft border-ghg-green"
          : color === "amber" ? "bg-amber-soft border-amber-warn"
          : color === "red" ? "bg-critical-soft border-critical"
          : "bg-neutral-soft border-border";
        const dot =
          color === "green" ? "bg-ghg-green"
          : color === "amber" ? "bg-amber-warn"
          : color === "red" ? "bg-critical"
          : "bg-muted-foreground/40";
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect?.(f.id)}
            className={cn(
              "group relative rounded-lg border p-3 text-left transition hover:shadow-sm",
              bg,
              activeId === f.id && "ring-2 ring-primary/40",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-navy">{f.name}</div>
                <div className="text-[11px] text-muted-foreground">{f.state} · {f.utility}</div>
              </div>
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", dot)} />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tabular-nums text-navy">
                {Math.round(pct * 100)}%
              </span>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {f.equipment.length} sources
              </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/70">
              <div
                className={cn("h-full transition-all", dot)}
                style={{ width: `${Math.max(2, pct * 100)}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
