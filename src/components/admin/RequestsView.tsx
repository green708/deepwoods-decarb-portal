import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, ExternalLink, Loader2, Mail, Plus, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { authFetch, getRole } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CARD, EmptyHint, ErrorNote, Field, INPUT, Pager, Pill, PRIMARY_BTN, SECONDARY_BTN, DANGER_BTN, Spinner, fmtDate, useDebounced } from "@/components/admin/ui";
import { CredentialsDialog, type CredentialsInfo } from "@/components/admin/InviteUserModal";
import { CURRENCIES, slugify } from "@/components/admin/NewClientModal";

type ReqStatus = "new" | "contacted" | "converted" | "rejected";

interface InternalNote { text: string; added_at: string }

interface ClientReq {
  id: number; name: string; company: string; email: string;
  phone: string; designation: string; employees: string; message: string; industry: string;
  is_india: boolean | number; gstin: string; legal_name: string; operating_name: string;
  org_type: string; is_msme: number | boolean | null; legal_address: string; website: string;
  ghg_done_before: boolean | number | null; ghg_requirement: string | null;
  services_needed: string[] | null; services_other: string | null;
  internal_notes: InternalNote[] | null;
  status: ReqStatus; created_at: string; updated_at: string;
}

interface ConvertResult {
  clientId: number;
  slug: string;
  inviteEmail: string;
  tempPassword: string | null;
  emailSent: boolean;
  smtpDiag: string | null;
}

const STATUS_META: Record<ReqStatus, { label: string; tone: "amber" | "blue" | "green" | "slate" }> = {
  new: { label: "New", tone: "amber" },
  contacted: { label: "Contacted", tone: "blue" },
  converted: { label: "Converted", tone: "green" },
  rejected: { label: "Rejected", tone: "slate" },
};

const STATUS_ORDER: ReqStatus[] = ["new", "contacted", "converted", "rejected"];
const PER_PAGE = 20;

const SMTP_DIAG_LABELS: Record<string, string> = {
  smtp_accepted: "The mail server accepted the message for delivery.",
  smtp_connection_failed: "Could not connect to the mail server.",
  smtp_starttls_failed: "Secure connection to the mail server failed.",
  smtp_auth_failed: "Mail server login failed. The app password may be invalid.",
  smtp_recipient_rejected: "The mail server refused the recipient address.",
  smtp_message_rejected: "The mail server rejected the message.",
  smtp_config_missing: "Email is not configured on this server.",
  email_skipped_user_exists: "A user with this email already existed, so no email was attempted.",
  smtp_error: "Unclassified mail error. Check the server log.",
};

const yesNo = (v: unknown): string => (v === null || v === undefined || v === "" ? "—" : v === true || Number(v) === 1 ? "Yes" : "No");

function fmtDateTime(d: string): string {
  const dt = new Date(d.replace(" ", "T"));
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="break-words text-sm text-[var(--navy)]">{children}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#1E6F5C]">
        <span className="inline-block h-3.5 w-0.5 rounded bg-[#1E6F5C]" />{title}
      </h3>
      {children}
    </div>
  );
}

function ConfirmRejectDialog({ req, busy, onConfirm, onClose }: { req: ClientReq; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-[var(--navy)]">Reject this request?</DialogTitle>
          <DialogDescription>
            {req.company} will be marked as rejected and a rejection email is sent to {req.email}. No account is created.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY_BTN} onClick={onClose} disabled={busy}>Keep request</button>
          <button type="button" className={DANGER_BTN} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Reject and notify
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AcceptModal({ request, onClose, onSuccess }: { request: ClientReq; onClose: () => void; onSuccess: (r: ConvertResult) => void }) {
  const [name, setName] = useState(request.company);
  const [slug, setSlug] = useState(slugify(request.company));
  const [slugTouched, setSlugTouched] = useState(false);
  const [entityCode, setEntityCode] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("INR");
  const [period, setPeriod] = useState<"FY" | "CY">("FY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("client-requests.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert",
          id: request.id,
          name: name.trim(),
          slug,
          currency,
          reporting_period: period,
          invite_email: request.email,
          invite_role: "sustainability_team",
          ...(entityCode ? { entity_code: entityCode } : {}),
        }),
      });
      onSuccess({
        clientId: Number(res.client_id),
        slug: res.slug,
        inviteEmail: res.invite_email ?? request.email,
        tempPassword: res.temp_password ?? null,
        emailSent: !!res.email_sent,
        smtpDiag: res.smtp_diag ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !loading) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base text-[var(--navy)]">Approve and invite</DialogTitle>
          <DialogDescription>Creates the client workspace and a login for {request.email} in one step.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-1 rounded-lg border border-[#C5E4D0] bg-[#F0FAF5] px-3 py-2.5 text-xs text-[#1E6F5C]">
          <li>1. Create the client account (active immediately)</li>
          <li>2. Create an ESG Manager login for {request.email}</li>
          <li>3. Generate a temporary password and email the credentials</li>
          <li>4. Mark this request as converted</li>
        </ol>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Payment stays pending. Record it in the client's Setup tab to unlock the full workspace.</p>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label="Client name">
            <input className={INPUT} value={name} onChange={(e) => onName(e.target.value)} required autoFocus />
          </Field>
          <Field label="Portal slug" hint="Lowercase letters, numbers and hyphens only.">
            <input className={INPUT + " font-mono"} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }} required />
          </Field>
          <Field label="Entity code (optional)" hint="Short unique code for the parent entity. Derived from the slug if left blank. Editable later in Setup.">
            <input className={INPUT + " font-mono uppercase"} value={entityCode} onChange={(e) => setEntityCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} placeholder="e.g. ABC" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency">
              <select className={INPUT} value={currency} onChange={(e) => setCurrency(e.target.value as (typeof CURRENCIES)[number])}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Reporting year">
              <select className={INPUT} value={period} onChange={(e) => setPeriod(e.target.value as "FY" | "CY")}>
                <option value="FY">Financial year</option>
                <option value="CY">Calendar year</option>
              </select>
            </Field>
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={SECONDARY_BTN} disabled={loading}>Cancel</button>
            <button type="submit" className={PRIMARY_BTN} disabled={loading || !name.trim() || !slug}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {loading ? "Approving…" : "Approve and invite"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConvertSuccess({ result, onClose, onOpenClient }: { result: ConvertResult; onClose: () => void; onOpenClient: (id: number) => void }) {
  const diag = result.smtpDiag ? (SMTP_DIAG_LABELS[result.smtpDiag] ?? result.smtpDiag) : null;
  const info: CredentialsInfo = {
    title: "Client account created",
    description: `Workspace "${result.slug}" is live.`,
    email: result.inviteEmail,
    tempPassword: result.tempPassword,
    emailSent: result.emailSent,
    emailNote: diag && !result.emailSent ? diag : null,
  };
  return (
    <CredentialsDialog info={info} onClose={onClose}>
      {result.clientId > 0 && (
        <button type="button" className={SECONDARY_BTN + " w-full"} onClick={() => { onClose(); onOpenClient(result.clientId); }}>
          <ExternalLink className="h-4 w-4" /> Open client workspace
        </button>
      )}
    </CredentialsDialog>
  );
}

function RequestDetail({ req, isAdmin, onConvert }: { req: ClientReq; isAdmin: boolean; onConvert: (r: ClientReq) => void }) {
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["client-requests"] });

  const patchStatus = useMutation({
    mutationFn: (status: "contacted" | "rejected") =>
      authFetch("client-requests.php", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: req.id, status }) }),
    onSuccess: (_d, status) => {
      toast.success(status === "rejected" ? "Request rejected" : "Marked as contacted");
      setConfirmReject(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: (note: string) =>
      authFetch("client-requests.php", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: req.id, note }) }),
    onSuccess: () => { setNoteText(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendEmail = useMutation({
    mutationFn: (message: string) =>
      authFetch("client-requests.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_email", id: req.id, message }) }),
    onSuccess: () => {
      setEmailSent(true);
      setEmailText("");
      setEmailOpen(false);
      toast.success(`Email sent to ${req.email}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canAct = req.status !== "converted" && req.status !== "rejected";
  const notes = req.internal_notes ?? [];
  const services = req.services_needed ?? [];

  return (
    <div className="space-y-6 border-t border-[var(--border)] bg-[#FAFBFA] px-5 py-5">
      {(services.length > 0 || (req.ghg_done_before !== null && req.ghg_done_before !== undefined)) && (
        <Group title="GHG reporting background">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {req.ghg_done_before !== null && req.ghg_done_before !== undefined && (
              <Detail label="Reported GHG before">
                {yesNo(req.ghg_done_before)}
                {req.ghg_requirement && <p className="mt-1 whitespace-pre-wrap leading-relaxed">{req.ghg_requirement}</p>}
              </Detail>
            )}
            {services.length > 0 && (
              <Detail label="Looking for">
                <div className="flex flex-wrap gap-1.5">
                  {services.map((s) => <Pill key={s} tone="green">{s}</Pill>)}
                  {req.services_other && <span className="self-center text-xs text-muted-foreground">{req.services_other}</span>}
                </div>
              </Detail>
            )}
          </div>
        </Group>
      )}

      <Group title="Organisation">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-3">
          <Detail label="Company">{req.company}</Detail>
          <Detail label="Legal name">{req.legal_name || "—"}</Detail>
          <Detail label="Operating name">{req.operating_name || "—"}</Detail>
          <Detail label="Industry">{req.industry || "—"}</Detail>
          <Detail label="Organisation type">{req.org_type || "—"}</Detail>
          <Detail label="Employees">{req.employees || "—"}</Detail>
          <Detail label="Registered in India">{yesNo(req.is_india)}</Detail>
          <Detail label="GSTIN">{req.gstin || "—"}</Detail>
          <Detail label="MSME">{yesNo(req.is_msme)}</Detail>
          <Detail label="Website">{req.website || "—"}</Detail>
          <Detail label="Submitted">{fmtDateTime(req.created_at)}</Detail>
          {req.legal_address && <div className="col-span-full"><Detail label="Legal address"><span className="whitespace-pre-wrap">{req.legal_address}</span></Detail></div>}
          {req.message && <div className="col-span-full"><Detail label="Message"><span className="whitespace-pre-wrap">{req.message}</span></Detail></div>}
        </div>
      </Group>

      <Group title="Contact">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
          <Detail label="Name">{req.name}</Detail>
          <Detail label="Designation">{req.designation || "—"}</Detail>
          <Detail label="Email"><a className="text-[#1E6F5C] underline-offset-2 hover:underline" href={`mailto:${req.email}`}>{req.email}</a></Detail>
          <Detail label="Phone">{req.phone || "—"}</Detail>
        </div>
      </Group>

      {canAct && (
        <div className="flex flex-wrap items-center gap-2">
          {req.status === "new" && (
            <button type="button" className={SECONDARY_BTN} onClick={() => patchStatus.mutate("contacted")} disabled={patchStatus.isPending}>
              <Check className="h-4 w-4" /> Mark contacted
            </button>
          )}
          {isAdmin && (
            <button type="button" className={SECONDARY_BTN} onClick={() => setEmailOpen((o) => !o)} aria-expanded={emailOpen}>
              <Mail className="h-4 w-4" /> {emailOpen ? "Hide email" : "Send email"}
            </button>
          )}
          <button type="button" className={DANGER_BTN} onClick={() => setConfirmReject(true)} disabled={patchStatus.isPending}>
            <X className="h-4 w-4" /> Reject
          </button>
          {isAdmin ? (
            <button type="button" className={PRIMARY_BTN + " sm:ml-auto"} onClick={() => onConvert(req)}>
              <UserPlus className="h-4 w-4" /> Approve and invite
            </button>
          ) : (
            <span className="text-xs text-muted-foreground sm:ml-auto">Approving and emailing requires an administrator.</span>
          )}
        </div>
      )}

      {emailOpen && (
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-white p-4">
          <Field label={`Email to ${req.name} (${req.email})`} hint="Sent as a branded email from the Deepwoods sender.">
            <textarea className={INPUT + " h-auto py-2"} rows={4} value={emailText} onChange={(e) => setEmailText(e.target.value)} placeholder="Type your message to the contact" />
          </Field>
          <button type="button" className={PRIMARY_BTN} disabled={!emailText.trim() || sendEmail.isPending} onClick={() => sendEmail.mutate(emailText.trim())}>
            {sendEmail.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send email
          </button>
        </div>
      )}
      {emailSent && !emailOpen && <p className="flex items-center gap-1 text-xs font-semibold text-[#1E6F5C]"><Check className="h-3.5 w-3.5" /> Email sent</p>}

      <Group title={`Internal notes${notes.length ? ` (${notes.length})` : ""}`}>
        {notes.length > 0 && (
          <ul className="mb-3 space-y-2">
            {notes.map((n, i) => (
              <li key={i} className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--navy)]">{n.text}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{fmtDateTime(n.added_at)}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="sr-only">Add an internal note</span>
            <textarea className={INPUT + " h-auto py-2"} rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Internal note, visible to Deepwoods staff only" />
          </label>
          <button type="button" className={SECONDARY_BTN} disabled={!noteText.trim() || addNote.isPending} onClick={() => addNote.mutate(noteText.trim())}>
            {addNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add note
          </button>
        </div>
      </Group>

      {req.status === "rejected" && <p className="text-xs text-muted-foreground">This request was rejected and a rejection email was sent. No account was created.</p>}
      {req.status === "converted" && <p className="text-xs font-medium text-[#1E6F5C]">This request was converted to a client account.</p>}

      {confirmReject && <ConfirmRejectDialog req={req} busy={patchStatus.isPending} onConfirm={() => patchStatus.mutate("rejected")} onClose={() => setConfirmReject(false)} />}
    </div>
  );
}

export function RequestsView({ onOpenClient }: { onOpenClient: (clientId: number) => void }) {
  const isAdmin = getRole() === "deepwoods_admin";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ReqStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [convertTarget, setConvertTarget] = useState<ClientReq | null>(null);
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);
  const q = useDebounced(search.trim().toLowerCase(), 250);

  const { data: requests = [], isLoading, error, refetch } = useQuery<ClientReq[]>({
    queryKey: ["client-requests"],
    queryFn: () => authFetch("client-requests.php"),
    staleTime: 20 * 1000,
  });

  const counts = useMemo(() => {
    const c: Record<ReqStatus | "all", number> = { all: requests.length, new: 0, contacted: 0, converted: 0, rejected: 0 };
    requests.forEach((r) => { if (r.status in c) c[r.status] += 1; });
    return c;
  }, [requests]);

  const filtered = useMemo(() => {
    return requests
      .filter((r) => (filter === "all" || r.status === filter))
      .filter((r) => !q || [r.company, r.name, r.email, r.industry, r.designation].some((v) => (v ?? "").toLowerCase().includes(q)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [requests, filter, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const toggle = (id: number) =>
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const chips: Array<[ReqStatus | "all", string]> = [["all", "All"], ...STATUS_ORDER.map((s): [ReqStatus, string] => [s, STATUS_META[s].label])];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {chips.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => { setFilter(key); setPage(1); }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C] ${
                filter === key ? "border-[#1E6F5C] bg-[#1E6F5C] text-white" : "border-[var(--border)] bg-white text-[var(--navy)] hover:bg-slate-50"
              }`}
            >
              {label} <span className={filter === key ? "text-white/80" : "text-muted-foreground"}>{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={INPUT + " pl-9"}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search company, contact or email"
            aria-label="Search requests"
          />
        </div>
      </div>

      {isLoading && <Spinner label="Loading requests…" />}
      {error && (
        <div className="space-y-2">
          <ErrorNote error={error} />
          <button type="button" className={SECONDARY_BTN} onClick={() => refetch()}>Retry</button>
        </div>
      )}
      {!isLoading && !error && requests.length === 0 && (
        <EmptyHint title="No access requests yet">Companies that request access through the portal appear here.</EmptyHint>
      )}
      {!isLoading && !error && requests.length > 0 && filtered.length === 0 && (
        <EmptyHint title="No requests match">Try a different status or search term.</EmptyHint>
      )}

      {visible.length > 0 && (
        <div className={`${CARD} overflow-hidden`}>
          {visible.map((req, idx) => {
            const open = expanded.has(req.id);
            const meta = STATUS_META[req.status] ?? STATUS_META.new;
            const noteCount = (req.internal_notes ?? []).length;
            return (
              <div key={req.id} className={idx > 0 ? "border-t border-[var(--border)]" : ""}>
                <button
                  type="button"
                  onClick={() => toggle(req.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E6F5C] sm:px-5"
                >
                  {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="font-semibold text-[var(--navy)]">{req.company}</span>
                      <span className="text-xs text-muted-foreground">{req.name}{req.designation ? `, ${req.designation}` : ""}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="break-all">{req.email}</span>
                      {noteCount > 0 && <Pill tone="amber">{noteCount} note{noteCount > 1 ? "s" : ""}</Pill>}
                    </div>
                  </div>
                  <Pill tone={meta.tone}>{meta.label}</Pill>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{fmtDate(req.created_at)}</span>
                </button>
                {open && <RequestDetail req={req} isAdmin={isAdmin} onConvert={setConvertTarget} />}
              </div>
            );
          })}
          <Pager page={safePage} perPage={PER_PAGE} total={filtered.length} onPage={setPage} />
        </div>
      )}

      {convertTarget && (
        <AcceptModal
          request={convertTarget}
          onClose={() => setConvertTarget(null)}
          onSuccess={(result) => {
            setConvertTarget(null);
            setConvertResult(result);
            qc.invalidateQueries({ queryKey: ["client-requests"] });
            qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
          }}
        />
      )}
      {convertResult && <ConvertSuccess result={convertResult} onClose={() => setConvertResult(null)} onOpenClient={onOpenClient} />}
    </div>
  );
}
