import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { authFetch } from "@/lib/auth";
import {
  EmptyHint, ErrorNote, INPUT, Pager, SECONDARY_BTN, PRIMARY_BTN, Section, Spinner, useClientEntityList, type ClientTabProps,
} from "@/components/admin/ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntitySelect, LabeledControl } from "@/components/admin/DataTab.shared";

interface GapAsset {
  asset_id: string;
  name: string;
  scope: string;
  sub_type: string;
  entity: string;
  facility: string;
  months: Record<string, boolean>;
  filled: number;
  total: number;
  pct: number;
}

interface GapsResponse {
  months: string[];
  assets: GapAsset[];
  summary: { total_points: number; filled: number; gaps: number; pct: number };
  fy: string;
}

const SCOPES = ["Scope 1", "Scope 2", "Scope 3"] as const;
const SCOPE_TONE: Record<string, string> = {
  "Scope 1": "bg-[#E6F4EF] text-[#1E6F5C]",
  "Scope 2": "bg-sky-50 text-sky-700",
  "Scope 3": "bg-violet-50 text-violet-700",
};
const PAGE_SIZE = 25;

function pctTone(p: number) {
  return p === 100 ? "text-[#1E6F5C]" : p >= 50 ? "text-amber-700" : "text-red-700";
}

export function GapsSection({ clientId, clientName, fy }: Pick<ClientTabProps, "clientId" | "clientName" | "fy">) {
  const { entities } = useClientEntityList(clientId, fy);
  const [entity, setEntity] = useState("");
  const [scope, setScope] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [page, setPage] = useState(1);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const gaps = useQuery<GapsResponse>({
    queryKey: ["admin-data-gaps", clientId, fy],
    queryFn: () => authFetch(`data-gaps.php?client_id=${clientId}&fy=${encodeURIComponent(fy)}`),
    staleTime: 30 * 1000,
  });

  useEffect(() => { setPage(1); }, [entity, scope, onlyGaps, clientId, fy]);
  useEffect(() => { setEntity(""); }, [clientId]);

  const assets = useMemo(
    () => (gaps.data?.assets ?? []).filter((a) => (!entity || a.entity === entity) && (!scope || a.scope === scope) && (!onlyGaps || a.pct < 100)),
    [gaps.data, entity, scope, onlyGaps],
  );
  const totals = useMemo(() => {
    const scoped = (gaps.data?.assets ?? []).filter((a) => (!entity || a.entity === entity) && (!scope || a.scope === scope));
    const total = scoped.reduce((s, a) => s + a.total, 0);
    const filled = scoped.reduce((s, a) => s + a.filled, 0);
    return { total, filled, missing: total - filled, pct: total > 0 ? Math.round((filled / total) * 100) : 0, sources: scoped.length };
  }, [gaps.data, entity, scope]);

  const months = gaps.data?.months ?? [];
  const pageRows = assets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sendReminder = async () => {
    setSending(true);
    try {
      const res = await authFetch("tracker-reminder.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, fy, entity: entity || undefined }),
      });
      if (!res.sent && !res.failed) toast.info(res.message ?? "No data contributors to remind for this client.");
      else if (res.failed) toast.error(`Reminder sent to ${res.sent}, failed for ${res.failed}. Check email settings.`);
      else toast.success(`Reminder sent to ${res.sent} data contributor${res.sent === 1 ? "" : "s"}`);
      setReminderOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send reminder");
    } finally {
      setSending(false);
    }
  };

  return (
    <Section
      title="Data completeness"
      description={`Which months have submitted values for each source in ${fy}. Green is filled, red is missing.`}
      right={
        <div className="flex gap-2">
          <button type="button" className={SECONDARY_BTN + " !px-3 !py-1.5"} onClick={() => gaps.refetch()} disabled={gaps.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${gaps.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" className={PRIMARY_BTN + " !px-3 !py-1.5"} onClick={() => setReminderOpen(true)}>
            <Mail className="h-3.5 w-3.5" /> Send reminder
          </button>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <LabeledControl htmlFor="gaps-entity" label="Entity">
          <EntitySelect id="gaps-entity" value={entity} onChange={setEntity} entities={entities} allLabel="All entities" />
        </LabeledControl>
        <LabeledControl htmlFor="gaps-scope" label="Scope">
          <select id="gaps-scope" className={INPUT} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">All scopes</option>
            {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </LabeledControl>
        <div className="flex items-end">
          <label className="flex h-9 items-center gap-2 text-sm text-[var(--navy)]">
            <input type="checkbox" className="h-4 w-4 accent-[#1E6F5C]" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} />
            Show incomplete sources only
          </label>
        </div>
      </div>

      {gaps.isLoading ? <Spinner label="Loading completeness…" /> : gaps.error ? <ErrorNote error={gaps.error} /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--border)] px-4 py-3">
              <div className={`text-2xl font-bold tabular-nums ${pctTone(totals.pct)}`}>{totals.pct}%</div>
              <div className="text-xs text-muted-foreground">complete</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] px-4 py-3">
              <div className="text-2xl font-bold tabular-nums text-[var(--navy)]">{totals.filled}</div>
              <div className="text-xs text-muted-foreground">of {totals.total} data points filled</div>
            </div>
            <div className={`rounded-lg border px-4 py-3 ${totals.missing > 0 ? "border-red-200 bg-red-50" : "border-[var(--border)]"}`}>
              <div className={`text-2xl font-bold tabular-nums ${totals.missing > 0 ? "text-red-700" : "text-[var(--navy)]"}`}>{totals.missing}</div>
              <div className="text-xs text-muted-foreground">missing data points</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] px-4 py-3">
              <div className="text-2xl font-bold tabular-nums text-[var(--navy)]">{totals.sources}</div>
              <div className="text-xs text-muted-foreground">registered sources</div>
            </div>
          </div>

          {assets.length === 0 ? (
            <EmptyHint title={gaps.data?.assets.length ? "No sources match these filters" : "No data sources registered"}>
              {gaps.data?.assets.length ? "Change the entity, scope or incomplete filter." : "This client has no active sources yet. Sources are created from the client's inventory setup."}
            </EmptyHint>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-xs" style={{ minWidth: 880 }}>
                <thead className="bg-[#F8FAF9] text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[200px] bg-[#F8FAF9] px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-left">Scope</th>
                    <th className="px-3 py-2 text-left">Entity</th>
                    {months.map((m) => <th key={m} className="px-1 py-2 text-center" title={m}>{m.slice(0, 3)}</th>)}
                    <th className="px-3 py-2 text-right">Complete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {pageRows.map((a) => {
                    const annual = "Annual" in a.months;
                    return (
                      <tr key={a.asset_id} className="hover:bg-[#F8FAF9]">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2">
                          <div className="max-w-[220px] truncate font-semibold text-[var(--navy)]" title={a.name}>{a.name}</div>
                          {a.facility && <div className="max-w-[220px] truncate text-[11px] text-muted-foreground" title={a.facility}>{a.facility}</div>}
                        </td>
                        <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SCOPE_TONE[a.scope] ?? "bg-slate-100 text-slate-600"}`}>{a.scope}</span></td>
                        <td className="px-3 py-2 text-muted-foreground">{a.entity}</td>
                        {annual ? (
                          <td colSpan={months.length} className="px-2 py-2 text-center">
                            <span className={`rounded px-2 py-1 text-[11px] font-semibold ${a.months.Annual ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                              {a.months.Annual ? "Annual value submitted" : "Annual value missing"}
                            </span>
                          </td>
                        ) : months.map((m) => (
                          <td key={m} className="px-1 py-2 text-center">
                            <span
                              role="img"
                              aria-label={`${m}: ${a.months[m] ? "filled" : "missing"}`}
                              title={`${m}: ${a.months[m] ? "filled" : "missing"}`}
                              className={`mx-auto block h-4 w-4 rounded ${a.months[m] ? "bg-emerald-200" : "bg-red-200"}`}
                            />
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <span className={`font-bold tabular-nums ${pctTone(a.pct)}`}>{a.pct}%</span>
                          <span className="ml-1 text-[10px] text-muted-foreground">({a.filled}/{a.total})</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pager page={page} perPage={PAGE_SIZE} total={assets.length} onPage={setPage} />
            </div>
          )}
        </>
      )}

      <Dialog open={reminderOpen} onOpenChange={(o) => { if (!sending) setReminderOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send data reminder</DialogTitle>
            <DialogDescription>
              Emails every data contributor at {clientName}{entity ? ` with access to ${entity}` : ""} asking them to complete their {fy} submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className={SECONDARY_BTN} onClick={() => setReminderOpen(false)} disabled={sending}>Cancel</button>
            <button type="button" className={PRIMARY_BTN} onClick={sendReminder} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send reminder
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
