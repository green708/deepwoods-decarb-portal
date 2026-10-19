import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ACTION_STATUSES, useAdminActions, useDeleteAdminAction, type AdminAction, type AdminActionInput, type ActionStatus,
} from "@/lib/api-admin";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DANGER_BTN, EmptyHint, ErrorNote, Field, INPUT, PRIMARY_BTN, Pill, SECONDARY_BTN, Section, Spinner, fmtDate, useClientEntityList,
  type ClientTabProps,
} from "@/components/admin/ui";
import { FieldsError, sendJson } from "@/components/admin/f4-api";
import { ConfirmDialog } from "@/components/admin/f4-confirm";

type Priority = "High" | "Medium" | "Low";
const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

const STATUS_TONE: Record<ActionStatus, "slate" | "blue" | "amber" | "green" | "red"> = {
  Idea: "slate", Planned: "blue", Committed: "blue", "In Progress": "amber", Completed: "green", Delayed: "red", Cancelled: "slate",
};
const PRIORITY_TONE: Record<Priority, "red" | "amber" | "slate"> = { High: "red", Medium: "amber", Low: "slate" };

const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: 2 }));

interface FormState {
  title: string; entity: string; lever: string; status: ActionStatus; priority: Priority; owner: string; timeline: string;
  start_date: string; end_date: string; abatement_t: string; actual_abatement_t: string; cost: string; description: string;
}

const EMPTY: FormState = {
  title: "", entity: "All", lever: "", status: "Planned", priority: "Medium", owner: "", timeline: "",
  start_date: "", end_date: "", abatement_t: "", actual_abatement_t: "", cost: "", description: "",
};

function toForm(a: AdminAction): FormState {
  return {
    title: a.title, entity: a.entity, lever: a.lever ?? "", status: a.status, priority: a.priority, owner: a.owner ?? "",
    timeline: a.timeline ?? "", start_date: a.start_date ?? "", end_date: a.end_date ?? "",
    abatement_t: a.abatement_t == null ? "" : String(a.abatement_t),
    actual_abatement_t: a.actual_abatement_t == null ? "" : String(a.actual_abatement_t),
    cost: a.cost == null ? "" : String(a.cost), description: a.description ?? "",
  };
}

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.title.trim()) e.title = "Give the action a title";
  else if (f.title.trim().length > 500) e.title = "Too long (max 500 characters)";
  if (!f.entity) e.entity = "Choose an entity or All";
  (["abatement_t", "actual_abatement_t", "cost"] as const).forEach((k) => {
    const v = f[k].trim();
    if (v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0)) e[k] = "Enter a number, zero or more";
  });
  if (f.start_date && f.end_date && f.end_date < f.start_date) e.end_date = "End date must be on or after the start date";
  return e;
}

function useSaveAction(clientId: number) {
  const qc = useQueryClient();
  return useMutation<AdminAction, FieldsError, AdminActionInput>({
    mutationFn: (body) => sendJson<AdminAction>("admin/actions.php", "POST", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-actions", clientId] });
      qc.invalidateQueries({ queryKey: ["decarb-actions"] });
      qc.invalidateQueries({ queryKey: ["admin-activity"] });
    },
  });
}

function ActionDialog({
  clientId, editing, entities, onClose,
}: {
  clientId: number; editing: AdminAction | null; entities: { code: string; name: string }[]; onClose: () => void;
}) {
  const save = useSaveAction(clientId);
  const [f, setF] = useState<FormState>(editing ? toForm(editing) : EMPTY);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);

  const local = validate(f);
  const errors = { ...serverErrors, ...(showErrors ? local : {}) };
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setServerErrors((p) => { if (!p[k]) return p; const n = { ...p }; delete n[k]; return n; });
  };

  const entityOptions = useMemo(() => {
    const opts = [{ code: "All", name: "All entities" }, ...entities];
    if (f.entity && !opts.some((o) => o.code === f.entity)) opts.push({ code: f.entity, name: f.entity });
    return opts;
  }, [entities, f.entity]);

  const submit = () => {
    setShowErrors(true);
    if (Object.keys(local).length) return;
    const n = (v: string) => (v.trim() === "" ? null : Number(v));
    const body: AdminActionInput = {
      client_id: clientId,
      ...(editing ? { id: editing.id, facilities: editing.facilities } : {}),
      entity: f.entity,
      title: f.title.trim(),
      description: f.description.trim() || null,
      lever: f.lever.trim() || null,
      status: f.status,
      priority: f.priority,
      owner: f.owner.trim() || null,
      timeline: f.timeline.trim() || null,
      start_date: f.start_date || null,
      end_date: f.end_date || null,
      abatement_t: n(f.abatement_t),
      actual_abatement_t: n(f.actual_abatement_t),
      cost: n(f.cost),
    };
    save.mutate(body, {
      onSuccess: () => { toast.success(editing ? "Action updated" : "Action added"); onClose(); },
      onError: (e) => {
        if (Object.keys(e.fields).length) setServerErrors(e.fields);
        toast.error(e.message);
      },
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit action" : "Add action"}</DialogTitle>
          <DialogDescription>Actions appear on the client's Home and Action Plan pages.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          <Field label="Title" error={errors.title}>
            <input className={INPUT} value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={500} autoFocus aria-invalid={!!errors.title} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entity" error={errors.entity}>
              <select className={INPUT} value={f.entity} onChange={(e) => set("entity", e.target.value)}>
                {entityOptions.map((o) => <option key={o.code} value={o.code}>{o.code === "All" ? o.name : `${o.name} (${o.code})`}</option>)}
              </select>
            </Field>
            <Field label="Lever" hint="For example Solar PV, Electrification" error={errors.lever}>
              <input className={INPUT} value={f.lever} onChange={(e) => set("lever", e.target.value)} />
            </Field>
            <Field label="Status" error={errors.status}>
              <select className={INPUT} value={f.status} onChange={(e) => set("status", e.target.value as ActionStatus)}>
                {ACTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Priority" error={errors.priority}>
              <select className={INPUT} value={f.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Owner" hint="Person or team at the client" error={errors.owner}>
              <input className={INPUT} value={f.owner} onChange={(e) => set("owner", e.target.value)} />
            </Field>
            <Field label="Timeline note" hint="Free text, for example Q3 FY27" error={errors.timeline}>
              <input className={INPUT} value={f.timeline} onChange={(e) => set("timeline", e.target.value)} />
            </Field>
            <Field label="Start date" error={errors.start_date}>
              <input className={INPUT} type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </Field>
            <Field label="End date" error={errors.end_date}>
              <input className={INPUT} type="date" value={f.end_date} min={f.start_date || undefined} onChange={(e) => set("end_date", e.target.value)} aria-invalid={!!errors.end_date} />
            </Field>
            <Field label="Planned abatement (tCO2e per year)" error={errors.abatement_t}>
              <input className={INPUT} inputMode="decimal" value={f.abatement_t} onChange={(e) => set("abatement_t", e.target.value)} aria-invalid={!!errors.abatement_t} />
            </Field>
            <Field label="Actual abatement (tCO2e per year)" error={errors.actual_abatement_t}>
              <input className={INPUT} inputMode="decimal" value={f.actual_abatement_t} onChange={(e) => set("actual_abatement_t", e.target.value)} aria-invalid={!!errors.actual_abatement_t} />
            </Field>
            <Field label="Estimated cost" hint="In the client's reporting currency" error={errors.cost}>
              <input className={INPUT} inputMode="decimal" value={f.cost} onChange={(e) => set("cost", e.target.value)} aria-invalid={!!errors.cost} />
            </Field>
          </div>
          <Field label="Description" error={errors.description}>
            <textarea className={`${INPUT} !h-auto min-h-[72px] py-2`} rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <DialogFooter className="gap-2">
            <button type="button" className={SECONDARY_BTN} onClick={onClose} disabled={save.isPending}>Cancel</button>
            <button type="submit" className={PRIMARY_BTN} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Save action" : "Add action"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ActionPlanSection({ clientId, fy, isAdmin }: ClientTabProps) {
  const q = useAdminActions(clientId);
  const { entities } = useClientEntityList(clientId, fy);
  const del = useDeleteAdminAction();
  const [filter, setFilter] = useState<"all" | ActionStatus>("all");
  const [dialog, setDialog] = useState<{ editing: AdminAction | null } | null>(null);
  const [toDelete, setToDelete] = useState<AdminAction | null>(null);

  const actions = q.data?.actions ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    actions.forEach((a) => { c[a.status] = (c[a.status] ?? 0) + 1; });
    return c;
  }, [actions]);
  const shown = filter === "all" ? actions : actions.filter((a) => a.status === filter);
  const planned = actions.reduce((s, a) => s + (a.abatement_t ?? 0), 0);
  const actual = actions.reduce((s, a) => s + (a.actual_abatement_t ?? 0), 0);
  const entityName = (code: string) => (code === "All" ? "All entities" : entities.find((e) => e.code === code)?.name ?? code);

  const confirmDelete = () => {
    if (!toDelete) return;
    del.mutate({ client_id: clientId, id: toDelete.id }, {
      onSuccess: () => { toast.success("Action deleted"); setToDelete(null); },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Section
      title="Action plan"
      description="The decarbonisation actions this client sees on its Home and Action Plan pages. Keep status and abatement up to date as work progresses."
      right={<button type="button" className={PRIMARY_BTN} onClick={() => setDialog({ editing: null })}><Plus className="h-4 w-4" /> Add action</button>}
    >
      {q.isLoading ? (
        <Spinner label="Loading actions" />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : actions.length === 0 ? (
        <EmptyHint title="No actions in the plan yet">
          Add the reduction measures agreed with the client. They show up in the client's Action Plan page and in the action summary on Home.
        </EmptyHint>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
            {(["all", ...ACTION_STATUSES] as const).filter((s) => s === "all" || counts[s]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={filter === s}
                onClick={() => setFilter(s)}
                className={`${SECONDARY_BTN} !px-3 !py-1 !text-xs ${filter === s ? "!border-[#1E6F5C] !bg-[#E6F4EF] !text-[#1E6F5C]" : ""}`}
              >
                {s === "all" ? "All" : s} <span className="tabular-nums opacity-70">{s === "all" ? actions.length : counts[s]}</span>
              </button>
            ))}
            <p className="ml-auto text-xs text-muted-foreground">
              Planned {num(planned)} tCO2e, achieved {num(actual)} tCO2e
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-[var(--border)] bg-[#F9FAFB] text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2.5">Action</th>
                  <th scope="col" className="px-3 py-2.5">Entity</th>
                  <th scope="col" className="px-3 py-2.5">Status</th>
                  <th scope="col" className="px-3 py-2.5">Priority</th>
                  <th scope="col" className="px-3 py-2.5">Owner</th>
                  <th scope="col" className="px-3 py-2.5">Timeline</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Planned t</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Actual t</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Cost</th>
                  <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.id} className="border-t border-[var(--border)] align-top">
                    <td className="max-w-[260px] px-3 py-2.5">
                      <p className="font-semibold text-[var(--navy)]">{a.title}</p>
                      {a.lever && <p className="text-xs text-muted-foreground">{a.lever}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--navy)]">{entityName(a.entity)}</td>
                    <td className="px-3 py-2.5"><Pill tone={STATUS_TONE[a.status] ?? "slate"}>{a.status}</Pill></td>
                    <td className="px-3 py-2.5"><Pill tone={PRIORITY_TONE[a.priority] ?? "slate"}>{a.priority}</Pill></td>
                    <td className="px-3 py-2.5 text-[var(--navy)]">{a.owner || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {a.start_date || a.end_date ? `${fmtDate(a.start_date)} to ${fmtDate(a.end_date)}` : a.timeline || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{num(a.abatement_t)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{num(a.actual_abatement_t)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{num(a.cost)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button type="button" className={`${SECONDARY_BTN} !p-1.5`} onClick={() => setDialog({ editing: a })} aria-label={`Edit ${a.title}`}><Pencil className="h-3.5 w-3.5" /></button>
                        {isAdmin && (
                          <button type="button" className={`${DANGER_BTN} !p-1.5`} onClick={() => setToDelete(a)} aria-label={`Delete ${a.title}`}><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dialog && (
        <ActionDialog key={dialog.editing?.id ?? "new"} clientId={clientId} editing={dialog.editing} entities={entities} onClose={() => setDialog(null)} />
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="Delete this action?"
        body={toDelete ? `"${toDelete.title}" will be removed from the plan and from the client's Action Plan page. This cannot be undone.` : ""}
        confirmLabel="Delete action"
        pending={del.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </Section>
  );
}
