import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageBody, PageHeader, LockedState } from "@/components/portal";
import { getRole, ROLE_META, authFetch } from "@/lib/auth";
import { CheckCircle2, XCircle, RefreshCw, ListChecks, ScrollText, Users, Lock, Unlock, ChevronDown, ChevronRight, Building2, Clock, FileCheck, AlertCircle, Loader2, Search, Zap, Plus, X, Workflow, UserPlus, FileText } from "lucide-react";
import { toast } from "sonner";
import { useActivationClients, useUpdateClientInvoice, useClients, type ApiClient, type ActivationClient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_app/admin")({ component: Admin });

// ── Types ────────────────────────────────────────────────────────────────────

type ClientStatus = "Onboarding" | "Boundary Set" | "Data Collection" | "Review" | "Report Ready" | "Complete";
type Cat3Relevance = "relevant" | "not_relevant" | "unsure" | null;

type Client = {
  id: string;
  company: string;
  entity: string;
  industry: string;
  country: string;
  onboardedDate: string;
  fy: string;
  contactName: string;
  contactEmail: string;
  status: ClientStatus;
  dataProgress: number; // 0–100
  facilitiesCount: number;
  scope3Screened: boolean;
  reportUrl?: string;
  notes?: string;
};

type RelevanceRow = { catNo: number; catName: string; relevance: Cat3Relevance; };

// ── Map API client record → local engagement row ─────────────────────────────

function apiClientToEngagement(
  c: ApiClient,
  statusOverrides: Record<string, ClientStatus>,
  screened: Set<string>,
): Client {
  const id = String(c.id);
  const base: ClientStatus = !c.is_active
    ? "Onboarding"
    : c.setup_complete !== "true"
    ? "Onboarding"
    : "Boundary Set";
  const status: ClientStatus = statusOverrides[id] ?? base;
  return {
    id,
    company: c.name,
    entity: c.slug.replace(/-/g, "").toUpperCase().slice(0, 3),
    industry: c.industry ?? "—",
    country: "—",
    onboardedDate: c.activated_at?.slice(0, 10) ?? c.created_at.slice(0, 10),
    fy: "FY26",
    contactName: "—",
    contactEmail: "—",
    status,
    dataProgress:
      status === "Complete" || status === "Report Ready" ? 100
      : status === "Review" ? 90
      : status === "Data Collection" ? 50
      : c.setup_complete === "true" ? 10
      : 0,
    facilitiesCount: c.entity_count || 1,
    scope3Screened: screened.has(id),
  };
}

const SCOPE3_CATEGORIES = [
  {no:1,name:"Purchased Goods & Services"},
  {no:2,name:"Capital Goods"},
  {no:3,name:"Fuel & Energy-Related Activities"},
  {no:4,name:"Upstream Transportation & Distribution"},
  {no:5,name:"Waste Generated in Operations"},
  {no:6,name:"Business Travel"},
  {no:7,name:"Employee Commuting"},
  {no:8,name:"Upstream Leased Assets"},
  {no:9,name:"Downstream Transportation & Distribution"},
  {no:10,name:"Processing of Sold Products"},
  {no:11,name:"Use of Sold Products"},
  {no:12,name:"End-of-Life Treatment of Sold Products"},
  {no:13,name:"Downstream Leased Assets"},
  {no:14,name:"Franchises"},
  {no:15,name:"Investments"},
];

// Screening data is maintained in local session state (Deepwoods coordination tool)
// Keys are string(client.id); values are 15-element Cat3Relevance arrays.

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ClientStatus,{label:string;color:string;bg:string;icon:React.ReactNode}> = {
  "Onboarding":     {label:"Onboarding",    color:"#6B7280",bg:"#F3F4F6",    icon:<Clock className="w-3 h-3"/>},
  "Boundary Set":   {label:"Boundary Set",  color:"#1D4ED8",bg:"#DBEAFE",    icon:<Building2 className="w-3 h-3"/>},
  "Data Collection":{label:"Data Collection",color:"#D97706",bg:"#FEF3C7",   icon:<Loader2 className="w-3 h-3"/>},
  "Review":         {label:"Under Review",  color:"#7C3AED",bg:"#EDE9FE",    icon:<ListChecks className="w-3 h-3"/>},
  "Report Ready":   {label:"Report Ready",  color:"#065F46",bg:"#D1FAE5",    icon:<FileCheck className="w-3 h-3"/>},
  "Complete":       {label:"Complete",      color:"#1E6F5C",bg:"#E6F4EF",    icon:<CheckCircle2 className="w-3 h-3"/>},
};

function StatusPill({status}:{status:ClientStatus}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{color:cfg.color,background:cfg.bg}}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ── Create Client modal ───────────────────────────────────────────────────────

function CreateClientModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ name: "", slug: "", currency: "INR", reporting_period: "FY" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (form.name) {
      const auto = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      setForm(f => ({ ...f, slug: auto }));
    }
  }, [form.name]);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.slug) return;
    setSubmitting(true);
    setError(null);
    try {
      await authFetch("clients.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug,
          currency: form.currency,
          reporting_period: form.reporting_period,
        }),
      });
      toast.success(`${form.name} created — pending activation`);
      onCreated();
      onClose();
      setForm({ name: "", slug: "", currency: "INR", reporting_period: "FY" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create client");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--navy)]">New client</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--navy-2)]">Company name</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Acme Products Pvt. Ltd."
            className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C] focus:ring-2 focus:ring-[#1E6F5C]/15"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--navy-2)]">Portal slug</label>
          <input
            value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
            placeholder="acme-products"
            className="w-full rounded-lg border border-[var(--border)] bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C] focus:bg-white focus:ring-2 focus:ring-[#1E6F5C]/15"
          />
          <p className="mt-1 text-[11px] text-slate-400">Auto-generated from name. Must be unique across all clients.</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--navy-2)]">Currency</label>
            <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C]">
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--navy-2)]">Fiscal year</label>
            <select value={form.reporting_period} onChange={e => setForm(f => ({ ...f, reporting_period: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C]">
              <option value="FY">FY (Apr–Mar)</option>
              <option value="CY">CY (Jan–Dec)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Client is created in <strong>Pending Activation</strong> state. Activate from the "Client Activation" tab after confirming payment externally.
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--navy)] hover:bg-slate-50">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.name.trim() || !form.slug || submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#1E6F5C] py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:brightness-110">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create client
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invite User modal ─────────────────────────────────────────────────────────

function InviteUserModal({ clientId, clientName, open, onClose }: {
  clientId: number;
  clientName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ email: "", role: "sustainability_team" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!form.email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch("invite-user.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          email: form.email.trim(),
          role: form.role,
        }),
      });
      let msg = `Invited ${res.email} — temp password: ${res.temp_password}. Ask them to change it on first login.`;
      if (res.email_sent) msg += " · Welcome email sent.";
      toast.success(msg, { duration: 10000 });
      onClose();
      setForm({ email: "", role: "sustainability_team" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to invite user");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--navy)]">Invite user</h2>
            <p className="mt-0.5 text-xs text-slate-400">{clientName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--navy-2)]">Email address</label>
          <input
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="client@example.com"
            type="email"
            className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C] focus:ring-2 focus:ring-[#1E6F5C]/15"
          />
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--navy-2)]">Role</label>
          <select
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C]"
          >
            <option value="sustainability_team">Sustainability Team (Full access)</option>
            <option value="client_uploader">Data Uploader (Submission only)</option>
            <option value="client_leadership">Leadership (Read-only)</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          A temporary password will be generated. The user must change it on first login. Copy and share the credentials securely after submission.
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--navy)] hover:bg-slate-50">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.email.trim() || submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#1E6F5C] py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:brightness-110">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Send invite
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invoice modal ─────────────────────────────────────────────────────────────

type PaymentStatus = "pending" | "paid" | "waived";

function InvoiceModal({ client, open, onClose }: {
  client: ActivationClient | null;
  open: boolean;
  onClose: () => void;
}) {
  const updateInvoice = useUpdateClientInvoice();
  const [form, setForm] = useState<{
    invoice_ref: string;
    payment_status: PaymentStatus;
    payment_date: string;
    payment_notes: string;
  }>({ invoice_ref: "", payment_status: "pending", payment_date: "", payment_notes: "" });

  useEffect(() => {
    if (client) {
      setForm({
        invoice_ref:    client.invoice_ref    ?? "",
        payment_status: client.payment_status ?? "pending",
        payment_date:   client.payment_date   ?? "",
        payment_notes:  client.payment_notes  ?? "",
      });
    }
  }, [client]);

  const handleSave = async () => {
    if (!client) return;
    try {
      await updateInvoice.mutateAsync({
        client_id:      client.id,
        invoice_ref:    form.invoice_ref    || null,
        payment_status: form.payment_status,
        payment_date:   form.payment_date   || null,
        payment_notes:  form.payment_notes  || null,
      });
      toast.success("Invoice details saved");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  if (!open || !client) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--navy)]">Invoice &amp; payment</h2>
            <p className="mt-0.5 text-xs text-slate-400">{client.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--navy-2)]">Invoice reference</label>
          <input
            value={form.invoice_ref}
            onChange={e => setForm(f => ({ ...f, invoice_ref: e.target.value }))}
            placeholder="INV-2026-001"
            className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C] focus:ring-2 focus:ring-[#1E6F5C]/15"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--navy-2)]">Payment status</label>
          <select
            value={form.payment_status}
            onChange={e => setForm(f => ({ ...f, payment_status: e.target.value as PaymentStatus }))}
            className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C]"
          >
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="waived">Waived</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--navy-2)]">Payment date</label>
          <input
            type="date"
            value={form.payment_date}
            onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
            className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C] focus:ring-2 focus:ring-[#1E6F5C]/15"
          />
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--navy-2)]">Notes</label>
          <textarea
            rows={2}
            value={form.payment_notes}
            onChange={e => setForm(f => ({ ...f, payment_notes: e.target.value }))}
            placeholder="Bank ref, waiver reason, etc."
            className="w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C] focus:ring-2 focus:ring-[#1E6F5C]/15 resize-none"
          />
        </div>

        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Payment is handled <strong>externally</strong> by Deepwoods. These fields are for internal record-keeping only.
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--navy)] hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={updateInvoice.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#1E6F5C] py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:brightness-110">
            {updateInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type AdminTab = "activation" | "clients" | "queue" | "screening" | "log";

// ── Activation tab component ──────────────────────────────────────────────────

function ActivationTab() {
  const { data: clients, isLoading, error, refetch } = useActivationClients();
  const qc = useQueryClient();
  const [activating, setActivating] = useState<number | null>(null);
  const [settingUpGhg, setSettingUpGhg] = useState<number | null>(null);
  const [inviteTarget, setInviteTarget] = useState<{ id: number; name: string } | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<ActivationClient | null>(null);

  const setActive = async (clientId: number, active: boolean) => {
    setActivating(clientId);
    try {
      await authFetch("activate-client.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, active }),
      });
      qc.invalidateQueries({ queryKey: ["activation-clients"] });
      toast.success(active ? "Client activated" : "Client deactivated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActivating(null);
    }
  };

  const setupGhg = async (clientId: number, clientName: string) => {
    setSettingUpGhg(clientId);
    try {
      const res = await authFetch("ghg/setup-client.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      qc.invalidateQueries({ queryKey: ["activation-clients"] });
      const skipped = res?.results?.some((r: any) => r.status === "skipped");
      const errored = res?.results?.some((r: any) => r.status === "error");
      if (skipped) {
        toast.success(`${clientName}: GHG rows prepared — Apps Script URL not yet configured`, { duration: 6000 });
      } else if (errored) {
        toast.error(`${clientName}: GHG setup encountered errors — check console`);
      } else {
        toast.success(`${clientName}: GHG automation set up for ${res.fy}`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "GHG setup failed");
    } finally {
      setSettingUpGhg(null);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-7 w-7 animate-spin text-[#1E6F5C]" />
    </div>
  );
  if (error) return (
    <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <AlertCircle className="h-4 w-4 text-red-500" />
      <p className="text-sm text-red-700">Failed to load clients. Check your session.</p>
      <button onClick={() => refetch()} className="text-xs font-medium text-red-600 hover:underline">Retry</button>
    </div>
  );

  const pending = (clients ?? []).filter((c) => !c.is_active);
  const active  = (clients ?? []).filter((c) => c.is_active);

  return (
    <>
      <InviteUserModal
        clientId={inviteTarget?.id ?? 0}
        clientName={inviteTarget?.name ?? ""}
        open={inviteTarget !== null}
        onClose={() => setInviteTarget(null)}
      />
      <InvoiceModal
        client={invoiceTarget}
        open={invoiceTarget !== null}
        onClose={() => setInvoiceTarget(null)}
      />
      <div className="space-y-6 max-w-3xl">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
        <p className="text-xs font-semibold text-amber-800">Manual activation gate</p>
        <p className="mt-0.5 text-xs text-amber-700">
          Clients remain in "Pending Activation" state until a Deepwoods admin activates them here.
          Activation is permanent unless manually reversed. Payment verification happens externally before activation.
        </p>
      </div>

      {/* Pending */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
            Pending Activation ({pending.length})
          </span>
        </div>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
            No clients pending activation
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-xl border border-amber-200 bg-white px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                  {c.slug.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--navy)]">{c.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {c.slug} · {c.user_count} user{c.user_count !== 1 ? "s" : ""} · Created {new Date(c.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  c.payment_status === "paid"   ? "bg-[#E6F4EF] text-[#1E6F5C]" :
                  c.payment_status === "waived" ? "bg-blue-50 text-blue-700" :
                  "bg-amber-100 text-amber-600"
                }`}>
                  {c.payment_status === "paid" ? "Paid" : c.payment_status === "waived" ? "Waived" : "Pending"}
                </span>
                <button
                  onClick={() => setActive(c.id, true)}
                  disabled={activating === c.id}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1E6F5C] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50 hover:brightness-110"
                >
                  {activating === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />}
                  Activate
                </button>
                <button
                  onClick={() => setInvoiceTarget(c)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1E6F5C] hover:text-[#1E6F5C]"
                  title="Invoice &amp; payment"
                >
                  <FileText className="h-3 w-3" />
                  Invoice
                </button>
                <button
                  onClick={() => setInviteTarget({ id: c.id, name: c.name })}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1E6F5C] hover:text-[#1E6F5C]"
                >
                  <UserPlus className="h-3 w-3" />
                  Invite user
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#1E6F5C]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#1E6F5C]">
            Active Clients ({active.length})
          </span>
        </div>
        {active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
            No active clients yet
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[#C5E4D0] bg-white px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6F4EF] text-xs font-bold text-[#1E6F5C]">
                  {c.slug.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--navy)]">{c.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {c.slug} · {c.user_count} user{c.user_count !== 1 ? "s" : ""}
                    {c.activated_at ? ` · Activated ${new Date(c.activated_at).toLocaleDateString("en-IN")}` : ""}
                    {c.setup_complete === "true" ? " · Setup complete" : ""}
                    {c.ghg_setup_done === "true" ? " · GHG ready" : ""}
                  </p>
                </div>
                <span className="rounded-full bg-[#E6F4EF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1E6F5C]">
                  Active
                </span>
                {c.setup_complete === "true" && (
                  <button
                    onClick={() => setupGhg(c.id, c.name)}
                    disabled={settingUpGhg === c.id}
                    title={c.ghg_setup_done === "true" ? "Re-run GHG setup (idempotent)" : "Set up GHG tracking in Google Sheet"}
                    className="flex items-center gap-1.5 rounded-lg border border-[#1E6F5C] px-3 py-1.5 text-xs font-medium text-[#1E6F5C] disabled:opacity-50 hover:bg-[#E6F4EF]"
                  >
                    {settingUpGhg === c.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Workflow className="h-3 w-3" />}
                    {c.ghg_setup_done === "true" ? "GHG ready" : "Setup GHG"}
                  </button>
                )}
                <button
                  onClick={() => setInvoiceTarget(c)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1E6F5C] hover:text-[#1E6F5C]"
                  title="Invoice &amp; payment"
                >
                  <FileText className="h-3 w-3" />
                  Invoice
                </button>
                <button
                  onClick={() => setInviteTarget({ id: c.id, name: c.name })}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#1E6F5C] hover:text-[#1E6F5C]"
                >
                  <UserPlus className="h-3 w-3" />
                  Invite user
                </button>
                <button
                  onClick={() => setActive(c.id, false)}
                  disabled={activating === c.id}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 disabled:opacity-50 hover:border-red-200 hover:text-red-600"
                >
                  {activating === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
                  Deactivate
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
    </>
  );
}

function Admin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [role, setRoleState]         = useState<ReturnType<typeof getRole>>(null);
  const [tab, setTab]                = useState<AdminTab>("activation");
  const [search, setSearch]          = useState("");
  const [selectedClient, setSelectedClient] = useState<string|null>(null);
  const [screening, setScreening]    = useState<Record<string,Cat3Relevance[]>>({});
  const [expandedClient, setExpandedClient] = useState<string|null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ClientStatus>>({});
  const [screenedSet, setScreenedSet] = useState<Set<string>>(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: apiClients = [], refetch: refetchClients } = useClients();

  const clients = useMemo(
    () => apiClients.map(c => apiClientToEngagement(c, statusOverrides, screenedSet)),
    [apiClients, statusOverrides, screenedSet],
  );

  useEffect(()=>{
    const r = getRole();
    if (!r) navigate({ to: "/" });
    setRoleState(r);
  },[navigate]);

  if (!role) return null;
  if (!ROLE_META[role].canAdmin) {
    return (
      <>
        <PageHeader eyebrow="Admin" title="Admin Dashboard"/>
        <PageBody><LockedState title="Admin only" message="This area is restricted to Deepwoods Admin."/></PageBody>
      </>
    );
  }

  const filteredClients = clients.filter(c=>
    c.company.toLowerCase().includes(search.toLowerCase()) ||
    c.entity.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  const screeningClient = clients.find(c=>c.id===selectedClient);
  const clientScreening = selectedClient ? (screening[selectedClient] ?? Array(15).fill(null)) : null;

  const patchRelevance = (catIdx:number, val:Cat3Relevance) => {
    if (!selectedClient) return;
    setScreening(s=>({
      ...s,
      [selectedClient]: (s[selectedClient] ?? Array(15).fill(null)).map((v:Cat3Relevance,i:number)=>i===catIdx?val:v),
    }));
  };

  const markScreeningDone = () => {
    if (!selectedClient) return;
    setScreenedSet(prev => new Set([...prev, selectedClient]));
    toast.success("Relevance screening saved for "+screeningClient?.company);
    setTab("clients");
    setSelectedClient(null);
  };

  const TABS: {id:AdminTab;label:string;icon:React.ReactNode}[] = [
    {id:"activation",label:"Client Activation",  icon:<Zap className="w-4 h-4"/>},
    {id:"clients",   label:"Engagements",         icon:<Users className="w-4 h-4"/>},
    {id:"queue",     label:"Submissions Queue",   icon:<ListChecks className="w-4 h-4"/>},
    {id:"screening", label:"Relevance Screening", icon:<Lock className="w-4 h-4"/>},
    {id:"log",       label:"Audit Log",           icon:<ScrollText className="w-4 h-4"/>},
  ];

  return (
    <>
      <CreateClientModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => { qc.invalidateQueries({ queryKey: ["clients"] }); refetchClients(); }}
      />
      <PageHeader eyebrow="Admin" title="Admin Dashboard"
        description="Manage clients, review submissions, perform relevance screening and track the full GHG workflow."
        right={
          <button onClick={()=>refetchClients()} className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium hover:bg-[#F3F4F6]" style={{borderColor:"var(--border)"}}>
            <RefreshCw className="w-4 h-4"/> Refresh
          </button>
        }
      />

      {/* Summary cards */}
      <div className="px-6 pb-2 pt-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl">
          {[
            {label:"Total clients",   value:clients.length,                                    color:"var(--navy)"},
            {label:"Active engagements", value:clients.filter(c=>!["Complete"].includes(c.status)).length, color:"var(--deepwoods-green)"},
            {label:"Pending screening",  value:clients.filter(c=>!c.scope3Screened).length,    color:"#D97706"},
            {label:"Reports ready",  value:clients.filter(c=>c.status==="Report Ready"||c.status==="Complete").length, color:"#1E6F5C"},
          ].map(s=>(
            <div key={s.label} className="bg-white rounded-xl border px-4 py-3 shadow-sm" style={{borderColor:"var(--border)"}}>
              <p className="text-xs font-medium" style={{color:"var(--navy-2)"}}>{s.label}</p>
              <p className="text-2xl font-bold mt-0.5" style={{color:s.color}}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b px-6" style={{borderColor:"var(--border)"}}>
        <div className="flex gap-1 max-w-4xl">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab===t.id?"border-[#1E6F5C] text-[#1E6F5C]":"border-transparent text-[var(--navy-2)] hover:text-[var(--navy)]"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      <PageBody>
        {/* ── Activation tab ── */}
        {tab==="activation" && <ActivationTab />}

        {/* ── Clients / Engagements tab ── */}
        {tab==="clients" && (
          <div className="space-y-4 max-w-5xl">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:"var(--navy-2)"}}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm" style={{borderColor:"var(--border)"}}/>
              </div>
              <span className="text-xs" style={{color:"var(--navy-2)"}}>{filteredClients.length} client{filteredClients.length!==1?"s":""}</span>
              <button onClick={()=>setCreateModalOpen(true)}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#1E6F5C] px-3.5 py-2 text-xs font-bold text-white hover:brightness-110">
                <Plus className="w-3.5 h-3.5"/> New client
              </button>
            </div>

            <div className="space-y-2">
              {filteredClients.map(c=>(
                <div key={c.id} className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{borderColor:"var(--border)"}}>
                  <div className="px-5 py-4 flex flex-wrap items-center gap-4 cursor-pointer hover:bg-[#FAFAFA] transition-colors"
                    onClick={()=>setExpandedClient(v=>v===c.id?null:c.id)}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{background:"var(--deepwoods-green)"}}>
                      {c.entity.slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{color:"var(--navy)"}}>{c.company}</p>
                      <p className="text-xs truncate" style={{color:"var(--navy-2)"}}>{c.entity} · {c.industry} · {c.country} · {c.fy}</p>
                    </div>
                    <StatusPill status={c.status}/>
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{width:`${c.dataProgress}%`,background:c.dataProgress===100?"#1E6F5C":c.dataProgress>50?"#D97706":"#6B7280"}}/>
                      </div>
                      <span className="text-xs w-8 text-right" style={{color:"var(--navy-2)"}}>{c.dataProgress}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!c.scope3Screened && (
                        <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle className="w-3 h-3"/> Screening needed
                        </span>
                      )}
                      {expandedClient===c.id ? <ChevronDown className="w-4 h-4" style={{color:"var(--navy-2)"}}/> : <ChevronRight className="w-4 h-4" style={{color:"var(--navy-2)"}}/>}
                    </div>
                  </div>

                  {expandedClient===c.id && (
                    <div className="border-t px-5 py-4 bg-[#FAFAFA]" style={{borderColor:"var(--border)"}}>
                      <div className="grid sm:grid-cols-3 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{color:"var(--navy-2)"}}>Contact</p>
                          <p className="font-medium" style={{color:"var(--navy)"}}>{c.contactName}</p>
                          <p style={{color:"var(--navy-2)"}}>{c.contactEmail}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{color:"var(--navy-2)"}}>Engagement</p>
                          <p style={{color:"var(--navy)"}}>Onboarded: <strong>{c.onboardedDate}</strong></p>
                          <p style={{color:"var(--navy)"}}>Facilities: <strong>{c.facilitiesCount}</strong></p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{color:"var(--navy-2)"}}>Notes</p>
                          <p style={{color:"var(--navy)"}}>{c.notes||"—"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={()=>{setSelectedClient(c.id);setTab("screening");}}
                          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${c.scope3Screened?"bg-[#E6F4EF] text-[#1E6F5C]":"bg-amber-50 text-amber-700 border border-amber-200"}`}>
                          {c.scope3Screened?<Unlock className="w-3.5 h-3.5"/>:<Lock className="w-3.5 h-3.5"/>}
                          {c.scope3Screened?"Edit Relevance Screening":"Do Relevance Screening"}
                        </button>
                        <button onClick={()=>setStatusOverrides(prev=>({...prev,[c.id]:"Review"}))}
                          className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold hover:bg-white transition-all" style={{borderColor:"var(--border)",color:"var(--navy)"}}>
                          <ListChecks className="w-3.5 h-3.5"/> Move to Review
                        </button>
                        {c.status==="Review" && (
                          <button onClick={()=>{setStatusOverrides(prev=>({...prev,[c.id]:"Report Ready"}));toast.success("Status updated to Report Ready");}}
                            className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-all hover:brightness-110" style={{background:"var(--deepwoods-green)"}}>
                            <CheckCircle2 className="w-3.5 h-3.5"/> Mark Report Ready
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Submissions queue tab ── */}
        {tab==="queue" && (
          <div className="max-w-5xl space-y-4">
            <p className="text-sm" style={{color:"var(--navy-2)"}}>Submissions awaiting consultant review across all clients.</p>
            {[
              {id:1041,client:"Client A",entity:"MFG",scope:"Scope 1",dataset:"Combustion & Fugitives",date:"2026-07-18",status:"Pending"},
              {id:1039,client:"Client C",entity:"RET",scope:"Scope 2",dataset:"Electricity",date:"2026-07-15",status:"Pending"},
              {id:1037,client:"Client A",entity:"MFG",scope:"Scope 3 · Cat 6",dataset:"Business Travel",date:"2026-07-10",status:"Pending"},
              {id:1035,client:"Client B",entity:"SVC",scope:"Scope 3 · Cat 1",dataset:"Purchased Goods",date:"2026-07-08",status:"Approved"},
              {id:1030,client:"Client E",entity:"TEC",scope:"Scope 1",dataset:"Combustion",date:"2026-06-22",status:"Approved"},
            ].map(s=>(
              <div key={s.id} className="bg-white rounded-xl border px-5 py-4 shadow-sm flex flex-wrap items-center gap-4" style={{borderColor:"var(--border)"}}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{color:"var(--navy)"}}>{s.client} · {s.scope}</p>
                  <p className="text-xs" style={{color:"var(--navy-2)"}}>{s.dataset} · Submitted {s.date}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${s.status==="Approved"?"bg-[#E6F4EF] text-[#1E6F5C]":"bg-amber-50 text-amber-700"}`}>{s.status}</span>
                {s.status==="Pending" && (
                  <div className="flex gap-2">
                    <button onClick={()=>toast.success(`#${s.id} approved`)} className="flex items-center gap-1 rounded-lg bg-[#E6F4EF] px-3 py-1.5 text-xs font-semibold text-[#1E6F5C] hover:bg-[#d0ede4]"><CheckCircle2 className="w-3.5 h-3.5"/> Approve</button>
                    <button onClick={()=>toast.info(`#${s.id} rejected`)} className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"><XCircle className="w-3.5 h-3.5"/> Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Relevance Screening tab ── */}
        {tab==="screening" && (
          <div className="max-w-3xl space-y-5">
            <div>
              <h3 className="font-semibold text-base mb-1" style={{color:"var(--navy)"}}>Scope 3 Relevance Screening</h3>
              <p className="text-sm" style={{color:"var(--navy-2)"}}>
                This is a <strong>consultant-only</strong> task. Mark each category's relevance for the selected client before their data collection form is unlocked.
              </p>
            </div>

            {/* Client selector */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{color:"var(--navy-2)"}}>Select client</label>
              <select value={selectedClient??""} onChange={e=>setSelectedClient(e.target.value||null)}
                className="rounded-lg border px-3.5 py-2.5 text-sm bg-white" style={{borderColor:"var(--border)",color:"var(--navy)",minWidth:300}}>
                <option value="">— Choose a client —</option>
                {clients.map(c=>(
                  <option key={c.id} value={c.id}>{c.company} ({c.entity})</option>
                ))}
              </select>
            </div>

            {selectedClient && clientScreening && (
              <>
                <div className="rounded-xl border bg-amber-50 border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                  <Lock className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                  <span>Only mark a category as <strong>Relevant</strong> if it genuinely applies to {screeningClient?.company}'s value chain. The client will only see and fill data for relevant categories.</span>
                </div>

                <div className="space-y-2">
                  {SCOPE3_CATEGORIES.map((cat,i)=>{
                    const val = clientScreening[i];
                    const locked = cat.no===3;
                    return (
                      <div key={cat.no} className={`bg-white rounded-xl border px-4 py-3.5 shadow-sm ${locked?"opacity-80":""}`} style={{borderColor:"var(--border)"}}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-semibold" style={{color:"var(--navy)"}}>
                              Cat {cat.no} — {cat.name}
                              {locked && <span className="ml-2 text-[11px] font-normal px-2 py-0.5 rounded-full bg-[#E6F4EF] text-[#1E6F5C]">Always relevant</span>}
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            {([["relevant","Relevant","#E6F4EF","#1E6F5C"],["unsure","Not sure","#FEF3C7","#D97706"],["not_relevant","Not relevant","#F3F4F6","#6B7280"]] as const).map(([v,l,bg,col])=>(
                              <button key={v} disabled={locked} onClick={()=>patchRelevance(i,v as Cat3Relevance)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all"
                                style={val===v||locked&&v==="relevant"?{background:bg,color:col,borderColor:col+"/30"}:{borderColor:"var(--border)",color:"var(--navy-2)"}}>
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={markScreeningDone}
                    className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110" style={{background:"var(--deepwoods-green)"}}>
                    <CheckCircle2 className="w-4 h-4"/> Save & mark screening complete
                  </button>
                  <button onClick={()=>{setSelectedClient(null);}} className="rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-[#F3F4F6]" style={{borderColor:"var(--border)",color:"var(--navy)"}}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Audit log tab ── */}
        {tab==="log" && (
          <div className="max-w-4xl space-y-3">
            <p className="text-sm" style={{color:"var(--navy-2)"}}>Immutable log of all consultant and system actions.</p>
            {[
              {ts:"2026-07-25 14:32",actor:"admin@deepwoodsgreen.com",action:"Approved submission #1035 — Client B / Cat 1 Purchased Goods"},
              {ts:"2026-07-24 11:08",actor:"System",action:"Report generated for Client B — INTERIM — 13/14 data points"},
              {ts:"2026-07-22 09:45",actor:"admin@deepwoodsgreen.com",action:"Relevance screening completed for Client A"},
              {ts:"2026-07-20 16:12",actor:"System",action:"Submission received — Client A / Scope 3 Cat 1 (procurement Q1–Q3)"},
              {ts:"2026-07-18 10:00",actor:"admin@deepwoodsgreen.com",action:"Client C onboarded — CLIENT-003 created"},
              {ts:"2026-07-15 15:30",actor:"System",action:"Daily cycle trigger ran — 2 reminder emails sent"},
              {ts:"2026-07-10 08:14",actor:"System",action:"Submission received — Client A / Scope 3 Cat 6 Business Travel data"},
              {ts:"2026-06-22 13:00",actor:"admin@deepwoodsgreen.com",action:"Approved submission #1030 — Client E / Scope 1"},
              {ts:"2026-06-15 10:45",actor:"System",action:"Report generated for Client E — FINAL — approved & sent to client"},
            ].map((e,i)=>(
              <div key={i} className="bg-white rounded-xl border px-4 py-3 shadow-sm flex items-start gap-4" style={{borderColor:"var(--border)"}}>
                <ScrollText className="w-4 h-4 flex-shrink-0 mt-0.5" style={{color:"var(--navy-2)"}}/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{color:"var(--navy)"}}>{e.action}</p>
                  <p className="text-xs mt-0.5" style={{color:"var(--navy-2)"}}>{e.ts} · {e.actor}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
