import { useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Check, Circle, Loader2, Power, UserPlus } from "lucide-react";
import {
  useAdminCalcStatus, useAdminClientSettings, useAdminClientUsers, useAdminCycles, useAdminInbox,
  useSaveAdminClientSettings, type CalcState, type CycleState,
} from "@/lib/api-admin";
import { authFetch, getEmail } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CalcPill, CARD, CyclePill, DANGER_BTN, ErrorNote, Field, INPUT, PaymentPill, Pill, PRIMARY_BTN,
  SECONDARY_BTN, fmtDate, timeAgo, type ClientTabProps,
} from "./ui";
import { InviteUserModal } from "./InviteUserModal";
import type { AdminNav, ClientTab } from "./useAdminLocation";

interface Props extends ClientTabProps {
  go: (next: AdminNav) => void;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StatusCard({ title, onOpen, openLabel, children }: { title: string; onOpen?: () => void; openLabel?: string; children: ReactNode }) {
  return (
    <section className={`${CARD} flex flex-col`}>
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--navy)]">{title}</h3>
        {onOpen && (
          <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 rounded text-xs font-semibold text-[#1E6F5C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C]">
            {openLabel ?? "Open"} <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-2.5 px-4 py-3 text-sm">{children}</div>
    </section>
  );
}

function CardLoading() {
  return <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...</div>;
}

function CardError({ error }: { error: unknown }) {
  return <ErrorNote error={error} />;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-xs font-medium text-[var(--navy)]">{children}</span>
    </div>
  );
}

interface Step {
  id: string;
  done: boolean;
  tone?: "red" | "amber";
  title: string;
  detail?: string;
  tab?: ClientTab;
  action?: "invite" | "owner";
}

export function OverviewTab({ clientId, clientName, fy, isAdmin, go }: Props) {
  const qc = useQueryClient();
  const settingsQ = useAdminClientSettings(clientId);
  const cyclesQ = useAdminCycles(clientId, fy);
  const calcQ = useAdminCalcStatus(clientId, fy);
  const usersQ = useAdminClientUsers(clientId);
  const inboxQ = useAdminInbox({ client_id: clientId, status: "open", per_page: 5 });
  const saveSettings = useSaveAdminClientSettings();

  const [inviting, setInviting] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const ownerRef = useRef<HTMLInputElement>(null);
  const [ownerInput, setOwnerInput] = useState<string | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  const activation = useMutation<unknown, Error, boolean>({
    mutationFn: (active) =>
      authFetch("activate-client.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, active }),
      }),
    onSuccess: (_d, active) => {
      qc.invalidateQueries({ queryKey: ["admin-client-settings", clientId] });
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
      qc.invalidateQueries({ queryKey: ["admin-activity"] });
      toast.success(active ? `${clientName} activated` : `${clientName} deactivated`);
      setConfirmOff(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const client = settingsQ.data?.client;
  const settings = settingsQ.data?.settings;
  const users = usersQ.data?.users;
  const cycles = cyclesQ.data?.entities;
  const calc = calcQ.data?.entities;
  const openThreads = inboxQ.data;

  const lastLogin = useMemo(() => {
    const times = (users ?? []).map((u) => u.last_login).filter((t): t is string => !!t);
    return times.length ? times.reduce((a, b) => (a > b ? a : b)) : null;
  }, [users]);

  const today = todayIso();

  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [];
    if (client) {
      out.push(client.payment_status === "pending"
        ? { id: "payment", done: false, tone: "amber", title: "Confirm payment", detail: "Payment is pending, so the client workspace is locked.", tab: "setup" }
        : { id: "payment", done: true, title: "Payment confirmed" });
      out.push(client.is_active
        ? { id: "active", done: true, title: "Account is active" }
        : { id: "active", done: false, tone: "amber", title: "Activate the account", detail: "The account is inactive and clients cannot sign in.", tab: "setup" });
    }
    if (users) {
      out.push(users.length === 0
        ? { id: "users", done: false, tone: "red", title: "Invite the first user", detail: "Nobody from the client can sign in yet.", action: "invite" }
        : { id: "users", done: true, title: `${users.length} ${users.length === 1 ? "user" : "users"} on the account` });
    }
    if (client) {
      out.push(client.account_owner
        ? { id: "owner", done: true, title: `Account owner: ${client.account_owner}` }
        : { id: "owner", done: false, title: "Assign an account owner", detail: "Choose which Deepwoods team member looks after this client.", action: "owner" });
    }
    if (settings) {
      out.push(settings.consultant_name && settings.consultant_email
        ? { id: "consultant", done: true, title: "Consultant details added" }
        : { id: "consultant", done: false, title: "Add consultant details", detail: "Shown to the client on their Home page.", tab: "plan" });
      out.push(settings.sbti_target_s12
        ? { id: "targets", done: true, title: "Reduction targets set" }
        : { id: "targets", done: false, title: "Set reduction targets", detail: "Until set, the client sees platform defaults.", tab: "plan" });
    }
    if (cycles && cycles.length > 0) {
      const missing = cycles.filter((c) => c.status === "open" && !c.data_due_date).length;
      out.push(missing === 0
        ? { id: "due", done: true, title: `Due dates set for ${fy}` }
        : { id: "due", done: false, title: `Set data due dates for ${fy}`, detail: `${missing} of ${cycles.length} ${cycles.length === 1 ? "entity has" : "entities have"} no due date.`, tab: "data" });
      const overdue = cycles.filter((c) => c.status === "open" && c.data_due_date && c.data_due_date < today).length;
      if (overdue > 0) out.push({ id: "overdue", done: false, tone: "red", title: `${overdue} ${overdue === 1 ? "entity is" : "entities are"} overdue`, detail: "Data has not been submitted by the due date.", tab: "data" });
    }
    if (calc && cycles) {
      const submitted = new Set(cycles.filter((c) => c.status !== "open").map((c) => c.entity));
      const toRun = calc.filter((r) => r.status === "draft" && submitted.has(r.entity)).length;
      if (toRun > 0) out.push({ id: "run", done: false, title: `Run the calculation for ${toRun} submitted ${toRun === 1 ? "entity" : "entities"}`, tab: "calc" });
      const toVerify = calc.filter((r) => r.status === "calculated").length;
      if (toVerify > 0) out.push({ id: "verify", done: false, tone: "amber", title: `Verify ${fy} results for ${toVerify} ${toVerify === 1 ? "entity" : "entities"}`, detail: "Calculated and waiting for review.", tab: "calc" });
    }
    if (openThreads && openThreads.total > 0) {
      const oldest = openThreads.threads[0]?.age_days ?? 0;
      out.push({ id: "queries", done: false, tone: oldest > 3 ? "red" : "amber", title: `Reply to ${openThreads.total} open ${openThreads.total === 1 ? "query" : "queries"}`, detail: oldest > 0 ? `Oldest has been waiting ${oldest} ${oldest === 1 ? "day" : "days"}.` : undefined, tab: "queries" });
    }
    return [...out.filter((s) => !s.done), ...out.filter((s) => s.done)];
  }, [client, users, settings, cycles, calc, openThreads, fy, today]);

  const todo = steps.filter((s) => !s.done);
  const stepsLoading = settingsQ.isLoading || usersQ.isLoading || cyclesQ.isLoading || calcQ.isLoading || inboxQ.isLoading;

  const submittedCount = (cycles ?? []).filter((c) => c.status !== "open").length;
  const openDue = (cycles ?? []).filter((c) => c.status === "open" && c.data_due_date).map((c) => c.data_due_date as string).sort();
  const anyDue = (cycles ?? []).filter((c) => c.data_due_date).map((c) => c.data_due_date as string).sort();
  const dueDates = openDue.length > 0 ? openDue : anyDue;
  const nextDue = dueDates[0] ?? null;
  const calcCounts = (calc ?? []).reduce<Record<CalcState, number>>((acc, r) => { acc[r.status] += 1; return acc; }, { draft: 0, calculated: 0, verified: 0, locked: 0 });

  const runStep = (s: Step) => {
    if (s.action === "invite") setInviting(true);
    else if (s.action === "owner") ownerRef.current?.focus();
    else if (s.tab) go({ tab: s.tab });
  };

  const ownerValue = ownerInput ?? client?.account_owner ?? "";
  const saveOwner = (value: string) => {
    const email = value.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setOwnerError("Enter a valid email address."); return; }
    setOwnerError(null);
    saveSettings.mutate(
      { client_id: clientId, settings: {}, account_owner: email || null },
      {
        onSuccess: () => { setOwnerInput(null); toast.success(email ? "Account owner updated" : "Account owner cleared"); },
        onError: (e) => setOwnerError(e.message === "Validation failed" ? "That email does not belong to a Deepwoods staff user." : e.message),
      },
    );
  };

  const myEmail = getEmail();

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard title="Account" onOpen={() => go({ tab: "setup" })} openLabel="Setup">
          {settingsQ.isLoading ? <CardLoading /> : settingsQ.error ? <CardError error={settingsQ.error} /> : client && (
            <>
              <div className="flex flex-wrap gap-1.5">
                <PaymentPill status={client.payment_status} />
                <Pill tone={client.is_active ? "green" : "slate"}>{client.is_active ? "Active" : "Inactive"}</Pill>
              </div>
              <Row label="Users">{usersQ.isLoading ? "..." : usersQ.error ? "Unavailable" : users?.length ?? 0}</Row>
              <Row label="Last login">{usersQ.isLoading ? "..." : lastLogin ? timeAgo(lastLogin) : "Never"}</Row>
              <Row label="Account owner">{client.account_owner ?? <span className="text-muted-foreground">Unassigned</span>}</Row>
            </>
          )}
        </StatusCard>

        <StatusCard title={`Reporting cycle - ${fy}`} onOpen={() => go({ tab: "data" })} openLabel="Data">
          {cyclesQ.isLoading ? <CardLoading /> : cyclesQ.error ? <CardError error={cyclesQ.error} /> : cycles && cycles.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reporting entities yet. Add entities in Setup.</p>
          ) : cycles && (
            <>
              <Row label="Submitted">{submittedCount} of {cycles.length} {cycles.length === 1 ? "entity" : "entities"}</Row>
              <Row label="Next data due">{nextDue ? fmtDate(nextDue) : "Not set"}</Row>
              <ul className="space-y-1.5 border-t border-[var(--border)] pt-2.5">
                {cycles.slice(0, 4).map((c) => (
                  <li key={c.entity} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-[var(--navy)]" title={c.entity_name}>{c.entity}</span>
                    <CyclePill status={c.status as CycleState} overdue={c.status === "open" && !!c.data_due_date && c.data_due_date < today} />
                  </li>
                ))}
              </ul>
              {cycles.length > 4 && <p className="text-[11px] text-muted-foreground">+{cycles.length - 4} more in Data</p>}
            </>
          )}
        </StatusCard>

        <StatusCard title={`Calculation - ${fy}`} onOpen={() => go({ tab: "calc" })} openLabel="Calculation">
          {calcQ.isLoading ? <CardLoading /> : calcQ.error ? <CardError error={calcQ.error} /> : calc && calc.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reporting entities yet.</p>
          ) : calc && (
            <>
              <Row label="With data">{calc.filter((r) => r.has_data).length} of {calc.length}</Row>
              <Row label="To verify">{calcCounts.calculated}</Row>
              <Row label="Verified or locked">{calcCounts.verified + calcCounts.locked}</Row>
              <ul className="space-y-1.5 border-t border-[var(--border)] pt-2.5">
                {calc.slice(0, 4).map((r) => (
                  <li key={r.entity} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-[var(--navy)]" title={r.entity_name}>{r.entity}</span>
                    <CalcPill status={r.status} />
                  </li>
                ))}
              </ul>
              {calc.length > 4 && <p className="text-[11px] text-muted-foreground">+{calc.length - 4} more in Calculation</p>}
            </>
          )}
        </StatusCard>

        <StatusCard title="Client queries" onOpen={() => go({ tab: "queries" })} openLabel="Queries">
          {inboxQ.isLoading ? <CardLoading /> : inboxQ.error ? <CardError error={inboxQ.error} /> : openThreads && openThreads.total === 0 ? (
            <p className="text-xs text-muted-foreground">No queries are waiting for a reply.</p>
          ) : openThreads && (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-[var(--navy)]">{openThreads.total}</span>
                <span className="text-xs text-muted-foreground">waiting for a reply</span>
              </div>
              <Row label="Oldest waiting">{openThreads.threads[0] ? `${openThreads.threads[0].age_days} ${openThreads.threads[0].age_days === 1 ? "day" : "days"}` : "-"}</Row>
              {openThreads.threads[0] && <p className="line-clamp-2 border-t border-[var(--border)] pt-2.5 text-xs text-muted-foreground">{openThreads.threads[0].preview}</p>}
            </>
          )}
        </StatusCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${CARD} overflow-hidden lg:col-span-2`}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
            <h3 className="text-sm font-semibold text-[var(--navy)]">Next steps for staff</h3>
            {!stepsLoading && <Pill tone={todo.length === 0 ? "green" : "amber"}>{todo.length === 0 ? "All caught up" : `${todo.length} to do`}</Pill>}
          </div>
          {stepsLoading ? (
            <div className="px-5 py-4"><CardLoading /></div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {steps.map((s) => {
                const clickable = !s.done && (s.tab || s.action);
                const inner = (
                  <>
                    {s.done ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1E6F5C]" aria-label="Done" />
                    ) : (
                      <Circle className={`mt-0.5 h-4 w-4 shrink-0 ${s.tone === "red" ? "text-red-500" : s.tone === "amber" ? "text-amber-500" : "text-slate-400"}`} aria-label="To do" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${s.done ? "text-muted-foreground" : "font-semibold text-[var(--navy)]"}`}>{s.title}</span>
                      {s.detail && !s.done && <span className="block text-xs text-muted-foreground">{s.detail}</span>}
                    </span>
                    {clickable && <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  </>
                );
                return (
                  <li key={s.id}>
                    {clickable ? (
                      <button type="button" onClick={() => runStep(s)} className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E6F5C]">
                        {inner}
                      </button>
                    ) : (
                      <div className="flex items-start gap-3 px-5 py-2.5">{inner}</div>
                    )}
                  </li>
                );
              })}
              {steps.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">Nothing to show yet.</li>}
            </ul>
          )}
        </section>

        <section className={`${CARD} overflow-hidden`}>
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h3 className="text-sm font-semibold text-[var(--navy)]">Quick actions</h3>
          </div>
          <div className="space-y-4 p-5">
            <button type="button" className={`${SECONDARY_BTN} w-full`} onClick={() => setInviting(true)}>
              <UserPlus className="h-4 w-4" /> Invite user
            </button>

            {isAdmin && client && (
              client.is_active ? (
                <button type="button" className={`${DANGER_BTN} w-full`} onClick={() => setConfirmOff(true)} disabled={activation.isPending}>
                  <Power className="h-4 w-4" /> Deactivate account
                </button>
              ) : (
                <button type="button" className={`${PRIMARY_BTN} w-full`} onClick={() => activation.mutate(true)} disabled={activation.isPending}>
                  {activation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />} Activate account
                </button>
              )
            )}

            <div className="border-t border-[var(--border)] pt-4">
              {isAdmin ? (
                <form onSubmit={(e) => { e.preventDefault(); saveOwner(ownerValue); }} className="space-y-2" noValidate>
                  <Field label="Account owner" hint="Email of the Deepwoods team member responsible." error={ownerError ?? undefined}>
                    <input
                      ref={ownerRef}
                      type="email"
                      className={INPUT}
                      value={ownerValue}
                      placeholder="name@example.com"
                      onChange={(e) => { setOwnerInput(e.target.value); setOwnerError(null); }}
                      disabled={!client}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className={PRIMARY_BTN} disabled={saveSettings.isPending || ownerInput === null || ownerValue === (client?.account_owner ?? "")}>
                      {saveSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
                    </button>
                    {myEmail && ownerValue.toLowerCase() !== myEmail.toLowerCase() && (
                      <button type="button" className={SECONDARY_BTN} onClick={() => { setOwnerInput(myEmail); setOwnerError(null); }}>Assign to me</button>
                    )}
                  </div>
                </form>
              ) : (
                <Row label="Account owner">{client?.account_owner ?? "Unassigned"}</Row>
              )}
            </div>
          </div>
        </section>
      </div>

      {inviting && <InviteUserModal clientId={clientId} clientName={clientName} onClose={() => { setInviting(false); qc.invalidateQueries({ queryKey: ["admin-client-users", clientId] }); }} />}

      <Dialog open={confirmOff} onOpenChange={(o) => { if (!activation.isPending) setConfirmOff(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {clientName}?</DialogTitle>
            <DialogDescription>
              Users from this client will no longer be able to use the portal until the account is activated again. No data is deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className={SECONDARY_BTN} onClick={() => setConfirmOff(false)} disabled={activation.isPending}>Cancel</button>
            <button type="button" className={DANGER_BTN} onClick={() => activation.mutate(false)} disabled={activation.isPending}>
              {activation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Deactivate
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
