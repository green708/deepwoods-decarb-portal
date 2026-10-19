import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAdminCycles, useSaveAdminCycle, type CycleRow, type CycleState } from "@/lib/api-admin";
import {
  EmptyHint, ErrorNote, Field, INPUT, Pill, PRIMARY_BTN, SECONDARY_BTN, Section, Spinner, fmtDate, timeAgo, type ClientTabProps,
} from "@/components/admin/ui";
import { describeError, todayIso } from "@/components/admin/DataTab.shared";

interface RowEdit { data_due_date?: string; report_due_date?: string; notes?: string }

function cycleTone(s: CycleState): "slate" | "blue" | "green" {
  return s === "open" ? "slate" : s === "submitted" ? "blue" : "green";
}
const CYCLE_LABEL: Record<CycleState, string> = { open: "Collecting", submitted: "Submitted", locked: "Locked" };

function dateProblem(data: string, report: string): string | null {
  if (data && report && report < data) return "Report due date is before the data due date.";
  return null;
}

export function CycleSection({ clientId, fy }: Pick<ClientTabProps, "clientId" | "fy">) {
  const cycles = useAdminCycles(clientId, fy);
  const save = useSaveAdminCycle();
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkData, setBulkData] = useState("");
  const [bulkReport, setBulkReport] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);

  const rows = cycles.data?.entities ?? [];
  const today = todayIso();

  const eff = (r: CycleRow, e: RowEdit | undefined) => ({
    data: e?.data_due_date ?? r.data_due_date ?? "",
    report: e?.report_due_date ?? r.report_due_date ?? "",
    notes: e?.notes ?? r.notes ?? "",
  });

  const isDirty = (r: CycleRow) => {
    const e = edits[r.entity];
    if (!e) return false;
    const v = eff(r, e);
    return v.data !== (r.data_due_date ?? "") || v.report !== (r.report_due_date ?? "") || v.notes !== (r.notes ?? "");
  };

  const patch = (entity: string, p: RowEdit) => {
    setEdits((prev) => ({ ...prev, [entity]: { ...prev[entity], ...p } }));
    setErrors((prev) => { const n = { ...prev }; delete n[entity]; return n; });
  };

  const clearEdit = (entity: string) => setEdits((prev) => { const n = { ...prev }; delete n[entity]; return n; });

  const run = async (key: string, entity: string, body: { data_due_date?: string | null; report_due_date?: string | null; status?: CycleState; notes?: string | null }, okMsg: string) => {
    setBusyKey(key);
    try {
      await save.mutateAsync({ client_id: clientId, fiscal_year: fy, entity, ...body });
      toast.success(okMsg);
      if (entity !== "*") clearEdit(entity);
      return true;
    } catch (e) {
      const msg = describeError(e, "Save failed");
      if (entity !== "*") setErrors((prev) => ({ ...prev, [entity]: msg }));
      toast.error(msg);
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const saveRow = (r: CycleRow) => {
    const v = eff(r, edits[r.entity]);
    const problem = dateProblem(v.data, v.report);
    if (problem) { setErrors((prev) => ({ ...prev, [r.entity]: problem })); return; }
    run(`row:${r.entity}`, r.entity, {
      data_due_date: v.data || null,
      report_due_date: v.report || null,
      notes: v.notes.trim() || null,
    }, `Saved ${r.entity_name}`);
  };

  const applyBulk = async () => {
    setBulkError(null);
    if (!bulkData && !bulkReport) { setBulkError("Choose at least one date to apply."); return; }
    const problem = dateProblem(bulkData, bulkReport);
    if (problem) { setBulkError(problem); return; }
    const body: { data_due_date?: string; report_due_date?: string } = {};
    if (bulkData) body.data_due_date = bulkData;
    if (bulkReport) body.report_due_date = bulkReport;
    const ok = await run("bulk", "*", body, `Dates applied to all entities for ${fy}`);
    if (ok) { setBulkData(""); setBulkReport(""); setEdits({}); }
  };

  const dirtyCount = useMemo(() => rows.filter(isDirty).length, [rows, edits]);

  return (
    <Section title="Reporting cycle" description={`Data and report due dates for ${fy}. Clients see the data due date on their Home page and submit each entity when its data is complete.`}>
      {cycles.isLoading ? <Spinner label="Loading cycle…" /> : cycles.error ? <ErrorNote error={cycles.error} /> : rows.length === 0 ? (
        <EmptyHint title="No reporting entities">Add at least one entity for this client in Setup before configuring a cycle.</EmptyHint>
      ) : (
        <div className="space-y-5">
          <div className="rounded-lg border border-[var(--border)] bg-[#F8FAF9] p-4">
            <p className="mb-3 text-xs font-semibold text-[var(--navy)]">Set dates for all entities</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Data due date">
                <input type="date" aria-label="Data due date for all entities" className={INPUT} value={bulkData} onChange={(e) => { setBulkData(e.target.value); setBulkError(null); }} />
              </Field>
              <Field label="Report due date">
                <input type="date" aria-label="Report due date for all entities" className={INPUT} value={bulkReport} onChange={(e) => { setBulkReport(e.target.value); setBulkError(null); }} />
              </Field>
              <button type="button" className={PRIMARY_BTN} onClick={applyBulk} disabled={busyKey === "bulk" || (!bulkData && !bulkReport)}>
                {busyKey === "bulk" && <Loader2 className="h-4 w-4 animate-spin" />} Apply to all
              </button>
            </div>
            {bulkError && <p className="mt-2 text-xs text-red-600" role="alert">{bulkError}</p>}
            <p className="mt-2 text-[11px] text-muted-foreground">Only the dates you fill in are changed. Existing notes and status are kept.</p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-[#F8FAF9] text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Data due</th>
                  <th className="px-3 py-2">Report due</th>
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((r) => {
                  const v = eff(r, edits[r.entity]);
                  const overdue = r.status === "open" && !!v.data && v.data < today;
                  const dirty = isDirty(r);
                  const busy = busyKey?.endsWith(`:${r.entity}`) ?? false;
                  const err = errors[r.entity];
                  return (
                    <tr key={r.entity} className="align-top">
                      <td className="min-w-[10rem] px-3 py-3">
                        <div className="font-semibold text-[var(--navy)]">{r.entity_name}</div>
                        <div className="text-xs text-muted-foreground">{r.entity}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Pill tone={cycleTone(r.status)}>{CYCLE_LABEL[r.status]}</Pill>
                          {overdue && <Pill tone="red">Overdue</Pill>}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input type="date" aria-label={`Data due date for ${r.entity_name}`} className={`${INPUT} min-w-[9.5rem]`} value={v.data} onChange={(e) => patch(r.entity, { data_due_date: e.target.value })} />
                      </td>
                      <td className="px-3 py-3">
                        <input type="date" aria-label={`Report due date for ${r.entity_name}`} className={`${INPUT} min-w-[9.5rem]`} value={v.report} onChange={(e) => patch(r.entity, { report_due_date: e.target.value })} />
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {r.submitted_at ? (
                          <>
                            <div className="text-[var(--navy)]">{fmtDate(r.submitted_at)}</div>
                            <div>{timeAgo(r.submitted_at)}{r.submitted_by ? ` · ${r.submitted_by}` : ""}</div>
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <input type="text" aria-label={`Notes for ${r.entity_name}`} className={`${INPUT} min-w-[11rem]`} maxLength={500} placeholder="Optional note" value={v.notes} onChange={(e) => patch(r.entity, { notes: e.target.value })} />
                        {err && <p className="mt-1 text-xs text-red-600" role="alert">{err}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" className={PRIMARY_BTN + " !px-3 !py-1.5"} disabled={!dirty || busy} onClick={() => saveRow(r)}>
                            {busyKey === `row:${r.entity}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
                          </button>
                          {r.status === "open" ? (
                            <button type="button" className={SECONDARY_BTN + " !px-3 !py-1.5"} disabled={busy} onClick={() => run(`lock:${r.entity}`, r.entity, { status: "locked" }, `${r.entity_name} locked`)}>
                              {busyKey === `lock:${r.entity}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Lock
                            </button>
                          ) : (
                            <button type="button" className={SECONDARY_BTN + " !px-3 !py-1.5"} disabled={busy} onClick={() => run(`open:${r.entity}`, r.entity, { status: "open" }, `${r.entity_name} reopened for data entry`)}>
                              {busyKey === `open:${r.entity}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Reopen
                            </button>
                          )}
                          {r.status === "submitted" && (
                            <button type="button" className={SECONDARY_BTN + " !px-3 !py-1.5"} disabled={busy} onClick={() => run(`lock:${r.entity}`, r.entity, { status: "locked" }, `${r.entity_name} locked`)}>
                              Lock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {dirtyCount > 0 && <p className="text-xs text-amber-700">{dirtyCount} row{dirtyCount === 1 ? "" : "s"} with unsaved changes.</p>}
        </div>
      )}
    </Section>
  );
}
