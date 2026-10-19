import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { useAdminCalcStatus, useSetAdminCalcStatus, type CalcState, type CalcStatusRow } from "@/lib/api-admin";
import {
  CalcPill, EmptyHint, ErrorNote, INPUT, Pill, PRIMARY_BTN, SECONDARY_BTN, DANGER_BTN, Section, Spinner, fmtDate, timeAgo, type ClientTabProps,
} from "@/components/admin/ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { describeError } from "@/components/admin/DataTab.shared";
import { AssuranceSection } from "@/components/admin/CalcTab.assurance";
import { HealthSection } from "@/components/admin/CalcTab.health";

interface Edit { ef_version?: string; notes?: string }
interface Pending { row: CalcStatusRow; target: CalcState }

const STATUS_HELP: Record<CalcState, string> = {
  draft: "Results are being prepared. The client does not see verified figures.",
  calculated: "Results are in the portal and waiting for review.",
  verified: "Results reviewed and approved.",
  locked: "Final. No further changes without reopening.",
};

function confirmCopy(target: CalcState, row: CalcStatusRow, fy: string): { title: string; body: string; action: string; danger: boolean } {
  if (target === "verified") return { title: "Verify results", body: `Confirm that ${row.entity_name} results for ${fy} have been reviewed and are correct. Your email is recorded as the verifier.`, action: "Verify", danger: false };
  if (target === "locked") return { title: "Lock results", body: `Locking freezes ${row.entity_name} results for ${fy}. Reopening a locked year requires an administrator.`, action: "Lock", danger: false };
  if (target === "draft") return { title: "Reopen calculation", body: `${row.entity_name} returns to Draft for ${fy}. ${row.status === "verified" || row.status === "locked" ? "Verification details are cleared." : "The calculated timestamp is kept until recalculated."}`, action: "Reopen", danger: true };
  return { title: "Mark as calculated", body: `${row.entity_name} has no inventory data for ${fy} yet. Mark it as calculated anyway?`, action: "Mark calculated", danger: false };
}

function CalcStatusSection({ clientId, fy, isAdmin }: Pick<ClientTabProps, "clientId" | "fy" | "isAdmin">) {
  const calc = useAdminCalcStatus(clientId, fy);
  const setStatus = useSetAdminCalcStatus();
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const rows = calc.data?.entities ?? [];

  const val = (r: CalcStatusRow) => ({
    ef: edits[r.entity]?.ef_version ?? r.ef_version ?? "",
    notes: edits[r.entity]?.notes ?? r.notes ?? "",
  });
  const dirty = (r: CalcStatusRow) => {
    const v = val(r);
    return v.ef !== (r.ef_version ?? "") || v.notes !== (r.notes ?? "");
  };
  const patch = (entity: string, p: Edit) => {
    setEdits((prev) => ({ ...prev, [entity]: { ...prev[entity], ...p } }));
    setErrors((prev) => { const n = { ...prev }; delete n[entity]; return n; });
  };

  const apply = async (row: CalcStatusRow, target: CalcState, okMsg: string) => {
    const v = val(row);
    setBusy(`${row.entity}:${target}`);
    try {
      await setStatus.mutateAsync({
        client_id: clientId, entity: row.entity, fiscal_year: fy, status: target,
        ef_version: v.ef.trim() || null, notes: v.notes.trim() || null,
      });
      setEdits((prev) => { const n = { ...prev }; delete n[row.entity]; return n; });
      toast.success(okMsg);
      return true;
    } catch (e) {
      const msg = describeError(e, "Update failed");
      setErrors((prev) => ({ ...prev, [row.entity]: msg }));
      toast.error(msg);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const request = (row: CalcStatusRow, target: CalcState) => {
    if (target === "calculated" && row.has_data) apply(row, target, `${row.entity_name} marked as calculated`);
    else setPending({ row, target });
  };

  const confirm = async () => {
    if (!pending) return;
    const { row, target } = pending;
    const msg = target === "verified" ? "verified" : target === "locked" ? "locked" : target === "draft" ? "reopened" : "marked as calculated";
    const ok = await apply(row, target, `${row.entity_name} ${msg}`);
    if (ok) setPending(null);
  };

  const verifiedCount = rows.filter((r) => r.status === "verified" || r.status === "locked").length;

  return (
    <Section
      title="Calculation status"
      description={`Review state of the calculated results for ${fy}. Clients see results as final once an entity is verified.`}
      right={rows.length > 0 ? <Pill tone={verifiedCount === rows.length ? "green" : "slate"}>{verifiedCount} of {rows.length} verified</Pill> : undefined}
    >
      {calc.isLoading ? <Spinner label="Loading calculation status…" /> : calc.error ? <ErrorNote error={calc.error} /> : rows.length === 0 ? (
        <EmptyHint title="No reporting entities">Add at least one entity for this client in Setup first.</EmptyHint>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[#F8FAF9] text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Inventory data</th>
                <th className="px-3 py-2">EF version</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Timeline</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => {
                const v = val(r);
                const locked = r.status === "locked";
                const err = errors[r.entity];
                const isBusy = busy?.startsWith(`${r.entity}:`) ?? false;
                const spin = (t: CalcState) => busy === `${r.entity}:${t}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />;
                const canReopen = r.status === "draft" ? false : (r.status === "calculated" || isAdmin);
                return (
                  <tr key={r.entity} className="align-top">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-[var(--navy)]">{r.entity_name}</div>
                      <div className="text-xs text-muted-foreground">{r.entity}</div>
                    </td>
                    <td className="px-3 py-3">
                      <CalcPill status={r.status} />
                      <div className="mt-1 max-w-[11rem] text-[11px] text-muted-foreground">{STATUS_HELP[r.status]}</div>
                    </td>
                    <td className="px-3 py-3">
                      {r.has_data ? <Pill tone="green">Has data</Pill> : <Pill tone="amber">No data</Pill>}
                    </td>
                    <td className="px-3 py-3">
                      <input aria-label={`Emission factor version for ${r.entity_name}`} className={`${INPUT} w-36`} value={v.ef} maxLength={60} placeholder="e.g. DEFRA 2025" disabled={locked} onChange={(e) => patch(r.entity, { ef_version: e.target.value })} />
                    </td>
                    <td className="px-3 py-3">
                      <input aria-label={`Notes for ${r.entity_name}`} className={`${INPUT} min-w-[12rem]`} value={v.notes} maxLength={500} placeholder="Optional note" disabled={locked} onChange={(e) => patch(r.entity, { notes: e.target.value })} />
                      {err && <p className="mt-1 max-w-[16rem] text-xs text-red-600" role="alert">{err}</p>}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      <div>Calculated: {r.calculated_at ? `${fmtDate(r.calculated_at)} (${timeAgo(r.calculated_at)})` : "—"}</div>
                      <div>Verified: {r.verified_at ? `${fmtDate(r.verified_at)}${r.verified_by ? ` by ${r.verified_by}` : ""}` : "—"}</div>
                      {r.updated_by && <div>Updated by {r.updated_by}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {r.status !== "locked" && dirty(r) && (
                          <button type="button" className={SECONDARY_BTN + " !px-3 !py-1.5"} disabled={isBusy} onClick={() => apply(r, r.status, "Details saved")}>
                            {spin(r.status)} Save details
                          </button>
                        )}
                        {r.status === "draft" && (
                          <button type="button" className={PRIMARY_BTN + " !px-3 !py-1.5"} disabled={isBusy} onClick={() => request(r, "calculated")}>
                            {spin("calculated")} <Check className="h-3.5 w-3.5" /> Mark calculated
                          </button>
                        )}
                        {r.status === "calculated" && (
                          <button type="button" className={PRIMARY_BTN + " !px-3 !py-1.5"} disabled={isBusy || !isAdmin} title={isAdmin ? undefined : "Only an administrator can verify results"} onClick={() => request(r, "verified")}>
                            {spin("verified")} Verify
                          </button>
                        )}
                        {r.status === "verified" && (
                          <button type="button" className={PRIMARY_BTN + " !px-3 !py-1.5"} disabled={isBusy || !isAdmin} title={isAdmin ? undefined : "Only an administrator can lock results"} onClick={() => request(r, "locked")}>
                            {spin("locked")} Lock
                          </button>
                        )}
                        {r.status !== "draft" && (
                          <button type="button" className={DANGER_BTN + " !px-3 !py-1.5"} disabled={isBusy || !canReopen} title={canReopen ? undefined : "Only an administrator can reopen verified or locked results"} onClick={() => request(r, "draft")}>
                            {spin("draft")} Reopen
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
      )}

      <Dialog open={!!pending} onOpenChange={(o) => { if (!o && !busy) setPending(null); }}>
        <DialogContent className="max-w-md">
          {pending && (() => {
            const c = confirmCopy(pending.target, pending.row, fy);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{c.title}</DialogTitle>
                  <DialogDescription>{c.body}</DialogDescription>
                </DialogHeader>
                {errors[pending.row.entity] && <p className="text-xs text-red-600" role="alert">{errors[pending.row.entity]}</p>}
                <DialogFooter>
                  <button type="button" className={SECONDARY_BTN} onClick={() => setPending(null)} disabled={!!busy}>Cancel</button>
                  <button type="button" className={c.danger ? DANGER_BTN : PRIMARY_BTN} onClick={confirm} disabled={!!busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} {c.action}
                  </button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Section>
  );
}

export function CalcTab({ clientId, clientName, reportingPeriod, fy, isAdmin }: ClientTabProps) {
  return (
    <div className="space-y-6">
      <CalcStatusSection clientId={clientId} fy={fy} isAdmin={isAdmin} />
      <AssuranceSection clientId={clientId} clientName={clientName} reportingPeriod={reportingPeriod} fy={fy} />
      <HealthSection clientId={clientId} clientName={clientName} />
    </div>
  );
}
