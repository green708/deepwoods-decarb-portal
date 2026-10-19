import { useMemo } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useDataHealth, type DataHealthCheck } from "@/lib/api";
import { EmptyHint, ErrorNote, Pill, SECONDARY_BTN, Section, Spinner, timeAgo, type ClientTabProps } from "@/components/admin/ui";

const SEVERITY_ORDER: DataHealthCheck["severity"][] = ["high", "medium", "low"];
const SEVERITY_LABEL: Record<DataHealthCheck["severity"], string> = { high: "High severity", medium: "Medium severity", low: "Low severity" };
const SEVERITY_TONE = { high: "red", medium: "amber", low: "blue" } as const;

export function HealthSection({ clientId, clientName }: Pick<ClientTabProps, "clientId" | "clientName">) {
  const health = useDataHealth();

  const mine = useMemo(() => (health.data?.checks ?? []).filter((c) => c.client_id === clientId), [health.data, clientId]);
  const open = mine.filter((c) => c.status === "open");
  const passing = mine.filter((c) => c.status === "ok");

  return (
    <Section
      title="Data health"
      description={`Automatic data-quality checks for ${clientName}. Fix open issues before verifying results.`}
      right={
        <button type="button" className={SECONDARY_BTN + " !px-3 !py-1.5"} onClick={() => health.refetch()} disabled={health.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${health.isFetching ? "animate-spin" : ""}`} /> Re-run checks
        </button>
      }
    >
      {health.isLoading ? <Spinner label="Running checks…" /> : health.error ? <ErrorNote error={health.error} /> : open.length === 0 ? (
        <div className="space-y-3">
          <EmptyHint title="No issues found">All data-quality checks pass for this client{health.data?.as_of ? ` (checked ${timeAgo(health.data.as_of)})` : ""}.</EmptyHint>
          {passing.length > 0 && <PassingList checks={passing} />}
        </div>
      ) : (
        <div className="space-y-5">
          {SEVERITY_ORDER.map((sev) => {
            const group = open.filter((c) => c.severity === sev);
            if (group.length === 0) return null;
            return (
              <div key={sev}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{SEVERITY_LABEL[sev]} ({group.length})</p>
                <ul className="space-y-2">
                  {group.map((c) => (
                    <li key={c.id} className="rounded-lg border border-[var(--border)] px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--navy)]">{c.check}</span>
                        <Pill tone={SEVERITY_TONE[c.severity]}>{c.count} issue{c.count === 1 ? "" : "s"}</Pill>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
                      <p className="mt-1 text-xs text-[var(--navy)]"><span className="font-semibold">Suggested fix:</span> {c.fix}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {passing.length > 0 && <PassingList checks={passing} />}
        </div>
      )}
    </Section>
  );
}

function PassingList({ checks }: { checks: DataHealthCheck[] }) {
  return (
    <details className="rounded-lg border border-[var(--border)] px-4 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Passing checks ({checks.length})</summary>
      <ul className="mt-2 space-y-1.5">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1E6F5C]" />
            <span><span className="font-semibold text-[var(--navy)]">{c.check}</span> <span className="text-muted-foreground">{c.detail}</span></span>
          </li>
        ))}
      </ul>
    </details>
  );
}
