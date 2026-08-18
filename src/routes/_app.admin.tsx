import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageBody, PageHeader, LockedState } from "@/components/portal";
import { getRole, ROLE_META, authFetch } from "@/lib/auth";
import { CheckCircle2, XCircle, RefreshCw, ListChecks, ScrollText, Users, Lock, Unlock, ChevronDown, ChevronRight, Building2, Clock, FileCheck, AlertCircle, Loader2, Search, Zap, Plus, X, Workflow, UserPlus, FileText, ClipboardList, Copy, Check, Paintbrush, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useActivationClients, useUpdateClientInvoice, useClients, type ApiClient, type ActivationClient } from "@/lib/api";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

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
          Client is created in <strong>Pending</strong> state. Use{" "}
          <strong>Approve Payment &amp; Activate</strong> in the Client Activation tab once payment is confirmed externally.
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
      const result = await updateInvoice.mutateAsync({
        client_id:      client.id,
        invoice_ref:    form.invoice_ref    || null,
        payment_status: form.payment_status,
        payment_date:   form.payment_date   || null,
        payment_notes:  form.payment_notes  || null,
      });
      if (result?.was_activation) {
        if (result.email_sent) {
          toast.success("Payment approved. Access activation email sent.");
        } else {
          toast.warning("Payment approved, but the access activation email could not be delivered.");
        }
      } else {
        toast.success("Invoice details saved");
      }
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

        <div className="mb-4 rounded-xl border border-[#C5E4D0] bg-[#F0FAF5] px-4 py-3 text-xs text-[#2D6A4F]">
          Payment is handled <strong>externally</strong> by Deepwoods. Setting status to <strong>Paid</strong> or{" "}
          <strong>Waived</strong> for the first time unlocks the complete customer workspace and sends the
          client their access confirmation email.
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

// ── Payments tab ─────────────────────────────────────────────────────────────

function PaymentsTab() {
  const { data: clients = [], isLoading, refetch } = useActivationClients();
  const updateInvoice = useUpdateClientInvoice();
  const [invoiceTarget, setInvoiceTarget] = useState<ActivationClient | null>(null);
  const [search, setSearch] = useState("");

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  const pending = filtered.filter(c => c.payment_status === "pending" || !c.payment_status);
  const completed = filtered.filter(c => c.payment_status === "paid" || c.payment_status === "waived");

  const quickMark = async (c: ActivationClient, status: "paid" | "waived" | "pending") => {
    try {
      const result = await updateInvoice.mutateAsync({ client_id: c.id, payment_status: status });
      if (result?.was_activation) {
        toast.success(status === "paid"
          ? "Payment confirmed — portal unlocked and activation email sent."
          : "Waiver applied — portal unlocked and activation email sent.");
      } else {
        toast.success(`Payment status set to ${status}`);
      }
      refetch();
    } catch (e) {
      toast.error((e as Error).message ?? "Update failed");
    }
  };

  const PAY_CFG: Record<string, { label: string; bg: string; text: string; border: string }> = {
    paid:    { label: "Paid",    bg: "bg-[#E6F4EF]", text: "text-[#1E6F5C]", border: "border-[#A8D5BD]" },
    waived:  { label: "Waived", bg: "bg-[#EFF6FF]",  text: "text-[#1D4ED8]", border: "border-[#93C5FD]" },
    pending: { label: "Pending",bg: "bg-amber-50",    text: "text-amber-700", border: "border-amber-200" },
  };

  function PayStatusPill({ status }: { status: string }) {
    const cfg = PAY_CFG[status] ?? PAY_CFG.pending;
    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
        {cfg.label}
      </span>
    );
  }

  function ClientPayRow({ c }: { c: ActivationClient }) {
    const isPaid = c.payment_status === "paid" || c.payment_status === "waived";
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-5 py-4 shadow-sm"
        style={{ borderColor: "var(--border)" }}>
        {/* Avatar */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
          style={{ background: "var(--deepwoods-green, #1E6F5C)" }}>
          {c.slug.slice(0, 2).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--navy)" }}>{c.name}</p>
          <p className="text-[11px]" style={{ color: "var(--navy-2)" }}>
            {c.slug}
            {c.invoice_ref ? ` · ${c.invoice_ref}` : ""}
            {c.payment_date ? ` · ${new Date(c.payment_date).toLocaleDateString("en-IN")}` : ""}
          </p>
        </div>

        {/* Status pill */}
        <PayStatusPill status={c.payment_status ?? "pending"} />

        {/* Portal access badge */}
        {c.is_active ? (
          <span className="flex items-center gap-1 rounded-full bg-[#E6F4EF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1E6F5C]">
            <Unlock className="h-3 w-3" /> Portal active
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <Lock className="h-3 w-3" /> Locked
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!isPaid && (
            <>
              <button
                onClick={() => quickMark(c, "paid")}
                disabled={updateInvoice.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-[#1E6F5C] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3 w-3" /> Mark Paid
              </button>
              <button
                onClick={() => quickMark(c, "waived")}
                disabled={updateInvoice.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-[#93C5FD] bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] disabled:opacity-50"
              >
                Waive
              </button>
            </>
          )}
          {isPaid && (
            <button
              onClick={() => quickMark(c, "pending")}
              disabled={updateInvoice.isPending}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--navy-2)" }}
            >
              <XCircle className="h-3 w-3" /> Revert to Pending
            </button>
          )}
          <button
            onClick={() => setInvoiceTarget(c)}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--navy)" }}
          >
            <FileText className="h-3 w-3" /> Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <InvoiceModal client={invoiceTarget} open={invoiceTarget !== null} onClose={() => setInvoiceTarget(null)} />

      <div className="max-w-4xl space-y-5">
        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total clients",     value: clients.length,    color: "var(--navy)" },
            { label: "Payment pending",   value: clients.filter(c => !c.payment_status || c.payment_status === "pending").length, color: "#D97706" },
            { label: "Payment complete",  value: clients.filter(c => c.payment_status === "paid" || c.payment_status === "waived").length, color: "#1E6F5C" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border bg-white px-4 py-3 shadow-sm" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-medium" style={{ color: "var(--navy-2)" }}>{s.label}</p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: "var(--border)" }} />
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading clients…
          </div>
        )}

        {/* Pending section */}
        {pending.length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                Payment Pending ({pending.length})
              </span>
            </div>
            <div className="space-y-2">
              {pending.map(c => <ClientPayRow key={c.id} c={c} />)}
            </div>
          </section>
        )}

        {/* Completed section */}
        {completed.length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1E6F5C]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#1E6F5C]">
                Payment Complete ({completed.length})
              </span>
            </div>
            <div className="space-y-2">
              {completed.map(c => <ClientPayRow key={c.id} c={c} />)}
            </div>
          </section>
        )}

        {!isLoading && clients.length === 0 && (
          <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-slate-400"
            style={{ borderColor: "var(--border)" }}>
            No clients found.
          </div>
        )}
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type AdminTab = "activation" | "clients" | "queue" | "screening" | "log" | "requests" | "branding" | "payments";

// ── Access Requests tab ───────────────────────────────────────────────────────

type ReqStatus = "new" | "contacted" | "converted" | "rejected";
interface ClientReq {
  id: number; name: string; company: string; email: string;
  phone: string; employees: string; message: string; industry: string;
  is_india: number; gstin: string; legal_name: string; operating_name: string;
  org_type: string; is_msme: number | null; legal_address: string; website: string;
  status: ReqStatus; created_at: string; updated_at: string;
}
interface ConvResult { slug: string; inviteEmail: string; tempPassword: string | null; emailSent: boolean; smtpDiag: string | null; }

const REQ_STATUS: Record<ReqStatus, { label: string; cls: string }> = {
  new:       { label: "New",       cls: "bg-amber-100 text-amber-700 border border-amber-200" },
  contacted: { label: "Contacted", cls: "bg-blue-100 text-blue-700 border border-blue-200" },
  converted: { label: "Converted", cls: "bg-[#E6F4EF] text-[#1E6F5C] border border-[#C5E4D0]" },
  rejected:  { label: "Rejected",  cls: "bg-slate-100 text-slate-500 border border-slate-200" },
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function RequestsTab() {
  const role = getRole();
  const isAdmin = role === "deepwoods_admin";
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [convertTarget, setConvertTarget] = useState<ClientReq | null>(null);
  const [convertResult, setConvertResult] = useState<ConvResult | null>(null);
  const [emailResults, setEmailResults] = useState<Map<number, boolean>>(new Map());

  const { data: requests = [], isLoading, error } = useQuery<ClientReq[]>({
    queryKey: ["client-requests"],
    queryFn: () => authFetch("client-requests.php"),
  });

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "contacted" | "rejected" }) =>
      authFetch("client-requests.php", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-requests"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleExpand = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="max-w-4xl space-y-4">
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {(error as Error).message}
        </div>
      )}
      {!isLoading && !error && requests.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-10 text-center text-sm text-muted-foreground">
          No access requests yet. When companies submit a request via the portal, they appear here.
        </div>
      )}
      {requests.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-card shadow-sm">
          {requests.map((req, idx) => {
            const isOpen = expanded.has(req.id);
            const sc = REQ_STATUS[req.status];
            const canAct = req.status !== "converted" && req.status !== "rejected";
            return (
              <div key={req.id} className={idx > 0 ? "border-t border-[var(--border)]" : ""}>
                <button
                  type="button"
                  onClick={() => toggleExpand(req.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-[#F9FAFB] transition-colors"
                >
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--navy)]">{req.company}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{req.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{req.email}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sc.cls}`}>{sc.label}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground hidden sm:block">
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--border)] bg-[#FAFAFA] px-6 py-5">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 text-sm mb-5">
                      {[
                        ["Company", req.company],
                        ["Legal name", req.legal_name || "—"],
                        ["Operating name", req.operating_name || "—"],
                        ["Contact", req.name],
                        ["Email", req.email],
                        ["Phone", req.phone || "—"],
                        ["Industry", req.industry || "—"],
                        ["Org type", req.org_type || "—"],
                        ["Registered in India", req.is_india ? "Yes" : "No"],
                        ["GSTIN", req.gstin || "—"],
                        ["MSME", req.is_msme === null ? "—" : req.is_msme ? "Yes" : "No"],
                        ["Website", req.website || "—"],
                        ["Submitted", new Date(req.created_at).toLocaleString()],
                      ].map(([label, value]) => (
                          <div key={label}>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</div>
                            <div className="text-sm text-[var(--navy)]">{value}</div>
                          </div>
                        ))}
                      {req.legal_address && (
                        <div className="col-span-full">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Legal Address</div>
                          <p className="text-sm text-[var(--navy)] leading-relaxed whitespace-pre-wrap">{req.legal_address}</p>
                        </div>
                      )}
                      {req.message && (
                        <div className="col-span-full">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Message</div>
                          <p className="text-sm text-[var(--navy)] leading-relaxed whitespace-pre-wrap">{req.message}</p>
                        </div>
                      )}
                    </div>
                    {canAct && (
                      <div className="flex flex-wrap gap-2">
                        {req.status === "new" && (
                          <button
                            type="button"
                            onClick={() => patchStatus.mutate({ id: req.id, status: "contacted" })}
                            disabled={patchStatus.isPending}
                            className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> Mark contacted
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => patchStatus.mutate({ id: req.id, status: "rejected" })}
                          disabled={patchStatus.isPending}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setConvertTarget(req)}
                            className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#1E6F5C] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Approve & Invite
                          </button>
                        )}
                      </div>
                    )}
                    {req.status === "rejected" && (
                      <p className="text-xs text-muted-foreground">Rejection email sent. No account was created.</p>
                    )}
                    {req.status === "converted" && (
                      <p className="text-xs font-medium" style={{
                        color: !emailResults.has(req.id)
                          ? "#6B7280"
                          : emailResults.get(req.id) ? "#1E6F5C" : "#B45309",
                      }}>
                        {!emailResults.has(req.id)
                          ? "Email delivery status unavailable."
                          : emailResults.get(req.id)
                            ? "Invitation email sent successfully."
                            : "Invitation email could not be sent."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {convertTarget && (
        <AcceptModal
          request={convertTarget}
          onClose={() => setConvertTarget(null)}
          onSuccess={(result) => {
            const reqId = convertTarget!.id;
            setConvertTarget(null);
            setConvertResult(result);
            setEmailResults(prev => new Map(prev).set(reqId, result.emailSent));
            qc.invalidateQueries({ queryKey: ["client-requests"] });
          }}
        />
      )}
      {convertResult && (
        <AcceptSuccessModal result={convertResult} onClose={() => setConvertResult(null)} />
      )}
    </div>
  );
}

function AcceptModal({ request, onClose, onSuccess }: {
  request: ClientReq;
  onClose: () => void;
  onSuccess: (r: ConvResult) => void;
}) {
  const [name, setName]   = useState(request.company);
  const [slug, setSlug]   = useState(slugify(request.company));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-update slug when name changes (only while user hasn't manually edited slug)
  const [slugTouched, setSlugTouched] = useState(false);
  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const inp = "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--navy)] focus:border-[#1E6F5C] focus:outline-none";
  const lbl = "mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch("client-requests.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert",
          id: request.id,
          name,
          slug,
          // Primary user auto-created from request contact email, sustainability_team role
          invite_email: request.email,
          invite_role: "sustainability_team",
        }),
      });
      onSuccess({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--navy)]">Approve & Invite</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Creates the account and sends login credentials to <strong>{request.email}</strong> in one step.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* What happens summary */}
        <div className="mb-4 rounded-lg border border-[#C5E4D0] bg-[#F0FAF5] px-3 py-2.5 text-xs text-[#1E6F5C] space-y-1">
          <p className="font-semibold">This will automatically:</p>
          <p>1. Create the client account</p>
          <p>2. Create login for <strong>{request.email}</strong> (Sustainability Team role)</p>
          <p>3. Generate a temporary password and send credentials by email</p>
          <p>4. Mark this request as accepted</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={lbl}>Client name *</label>
            <input value={name} onChange={e => handleNameChange(e.target.value)} required className={inp} />
          </div>
          <div>
            <label className={lbl}>Slug * <span className="normal-case font-normal text-muted-foreground">(URL identifier)</span></label>
            <input
              value={slug}
              onChange={e => { setSlugTouched(true); setSlug(e.target.value); }}
              required pattern="[-a-z0-9]+"
              className={inp}
            />
            <p className="mt-0.5 text-[10px] text-muted-foreground">Lowercase letters, numbers and hyphens only</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading || !name.trim() || !slug}
              className="flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-5 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Approving…" : "Approve & Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const SMTP_DIAG_LABELS: Record<string, string> = {
  smtp_accepted:              "SMTP accepted the message for delivery.",
  smtp_connection_failed:     "SMTP connection failed — server unreachable on port 587.",
  smtp_starttls_failed:       "STARTTLS negotiation failed — TLS upgrade rejected.",
  smtp_auth_failed:           "SMTP authentication failed — App Password may be invalid.",
  smtp_recipient_rejected:    "SMTP recipient rejected — server refused the To address.",
  smtp_message_rejected:      "SMTP message rejected — server refused the message (policy or content).",
  smtp_config_missing:        "SMTP configuration missing — check config.php smtp keys.",
  email_skipped_user_exists:  "User account already existed — email was not attempted.",
  smtp_error:                 "Unclassified SMTP error — check PHP error log for details.",
};

function AcceptSuccessModal({ result, onClose }: { result: ConvResult; onClose: () => void }) {
  const diagLabel = result.smtpDiag ? (SMTP_DIAG_LABELS[result.smtpDiag] ?? result.smtpDiag) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-2xl text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E6F4EF]">
          <Check className="h-6 w-6 text-[#1E6F5C]" />
        </div>
        <h3 className="mb-1 text-base font-bold text-[var(--navy)]">Client account created!</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Workspace <code className="font-mono font-semibold">{result.slug}</code> is live.
        </p>

        {result.emailSent ? (
          <div className="rounded-xl border border-[#C5E4D0] bg-[#F0FAF5] px-4 py-3 text-left mb-4 space-y-1">
            <p className="text-xs font-semibold text-[#1E6F5C]">EMAIL SENT</p>
            <p className="text-xs text-[#1E6F5C]">
              Client account created and invitation email accepted by SMTP.
            </p>
            <p className="text-[11px] text-[#1E6F5C]/70">Sent to: <strong>{result.inviteEmail}</strong></p>
            {diagLabel && (
              <p className="text-[11px] text-[#1E6F5C]/60 font-mono">{diagLabel}</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left mb-4 space-y-2">
            <p className="text-xs font-semibold text-amber-800">
              {result.smtpDiag === 'email_skipped_user_exists'
                ? "EMAIL NOT ATTEMPTED"
                : result.smtpDiag
                  ? "EMAIL FAILED"
                  : "EMAIL STATUS UNAVAILABLE"}
            </p>
            <p className="text-xs text-amber-700">
              {result.smtpDiag === 'email_skipped_user_exists'
                ? "Client account created, but the user already existed — invitation email was not sent."
                : result.smtpDiag
                  ? "Client account created, but the invitation email could not be sent."
                  : "Email delivery status unavailable."}
            </p>
            {diagLabel && (
              <p className="text-[11px] font-mono text-amber-600">{diagLabel}</p>
            )}
            {result.tempPassword && (
              <>
                <p className="text-[11px] text-amber-700 pt-1">Share these credentials manually:</p>
                <p className="text-[11px] text-amber-700">Email: <strong>{result.inviteEmail}</strong></p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-amber-100 px-2 py-1 text-sm font-mono font-semibold text-amber-900 break-all">
                    {result.tempPassword}
                  </code>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(result.tempPassword!); toast.success("Copied"); }}
                    className="shrink-0 rounded p-1 text-amber-600 hover:bg-amber-200"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <button type="button" onClick={onClose}
          className="w-full rounded-lg bg-[#1E6F5C] px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
          Done
        </button>
      </div>
    </div>
  );
}

// ── Branding tab component ────────────────────────────────────────────────────

interface BrandingClient { id: number; name: string; logo_url: string | null; primary_color: string; }

function BrandingTab() {
  const qc = useQueryClient();

  const { data: raw = [] } = useQuery<ActivationClient[]>({
    queryKey: ["activation-clients"],
    queryFn: () => authFetch("activate-client.php"),
  });

  const [editing, setEditing] = useState<number | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [color, setColor]   = useState("#1E6F5C");
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  const clients: BrandingClient[] = raw.map(c => ({
    id: c.id, name: c.name,
    logo_url: ((c as unknown) as BrandingClient).logo_url ?? null,
    primary_color: ((c as unknown) as BrandingClient).primary_color ?? "#1E6F5C",
  }));

  const openEdit = (c: BrandingClient) => {
    setEditing(c.id);
    setLogoUrl(c.logo_url ?? "");
    setColor(c.primary_color ?? "#1E6F5C");
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogoUrl(ev.target?.result as string ?? "");
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await authFetch("branding.php", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: editing, logo_url: logoUrl || null, primary_color: color }),
      });
      toast.success("Branding updated");
      qc.invalidateQueries({ queryKey: ["activation-clients"] });
      setEditing(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const initials = (name: string) =>
    name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <div className="max-w-3xl space-y-3">
      <p className="text-sm" style={{ color: "var(--navy-2)" }}>
        Set each client's logo and primary brand colour. These appear in their portal sidebar and reports.
      </p>

      {clients.map(c => (
        <div key={c.id} className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-4">
            {/* Logo preview */}
            <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border flex items-center justify-center bg-[#F9FAFB]"
              style={{ borderColor: "var(--border)" }}>
              {c.logo_url
                ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain" />
                : <span className="text-sm font-bold" style={{ color: c.primary_color }}>{initials(c.name)}</span>
              }
            </div>

            {/* Client name + colour swatch */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--navy)" }}>{c.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-4 h-4 rounded-full border" style={{ background: c.primary_color, borderColor: "var(--border)" }} />
                <span className="text-xs font-mono" style={{ color: "var(--navy-2)" }}>{c.primary_color}</span>
                {!c.logo_url && <span className="text-xs" style={{ color: "var(--navy-2)" }}>· No logo set</span>}
              </div>
            </div>

            <button onClick={() => editing === c.id ? setEditing(null) : openEdit(c)}
              className="flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-[#F3F4F6] transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--navy)" }}>
              {editing === c.id ? "Cancel" : "Customise"}
            </button>
          </div>

          {/* Inline editor */}
          {editing === c.id && (
            <div className="mt-4 pt-4 border-t space-y-4" style={{ borderColor: "var(--border)" }}>
              <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden" onChange={handleLogoFile} />

              {/* Logo */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--navy-2)" }}>
                  Logo
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg border flex items-center justify-center bg-[#F9FAFB] flex-shrink-0"
                    style={{ borderColor: "var(--border)" }}>
                    {logoUrl
                      ? <img src={logoUrl} alt="" className="w-full h-full object-contain rounded-lg" />
                      : <span className="text-sm font-bold" style={{ color: color }}>{initials(c.name)}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                      placeholder="https://company.com/logo.png"
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#1E6F5C]"
                      style={{ borderColor: "var(--border)" }} />
                    <button type="button" onClick={() => logoRef.current?.click()}
                      className="text-xs font-semibold" style={{ color: "#1E6F5C" }}>
                      ↑ Or upload from computer
                    </button>
                  </div>
                  {logoUrl && (
                    <button type="button" onClick={() => setLogoUrl("")}
                      className="flex-shrink-0 rounded-lg border p-1.5 hover:bg-slate-100"
                      style={{ borderColor: "var(--border)", color: "var(--navy-2)" }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Primary colour */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--navy-2)" }}>
                  Primary colour
                </label>
                <div className="flex items-center gap-3">
                  <input type="color" value={color} onChange={e => setColor(e.target.value)}
                    className="h-10 w-16 cursor-pointer rounded-lg border p-1" style={{ borderColor: "var(--border)" }} />
                  <input value={color} onChange={e => setColor(e.target.value)}
                    placeholder="#1E6F5C" maxLength={9}
                    className="w-32 rounded-lg border px-3 py-2 text-sm font-mono outline-none focus:border-[#1E6F5C]"
                    style={{ borderColor: "var(--border)" }} />
                  <span className="text-xs" style={{ color: "var(--navy-2)" }}>Appears in nav sidebar and highlights</span>
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "#F9FAFB" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--navy-2)" }}>Preview</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: color + "22" }}>
                    {logoUrl
                      ? <img src={logoUrl} alt="" className="w-full h-full object-contain" />
                      : <span className="text-xs font-bold" style={{ color }}>{initials(c.name)}</span>
                    }
                  </div>
                  <div className="h-5 rounded-full px-3 flex items-center text-white text-xs font-semibold"
                    style={{ background: color }}>
                    Active nav item
                  </div>
                  <div className="h-1 w-16 rounded-full" style={{ background: color }} />
                </div>
              </div>

              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#1E6F5C" }}>
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? "Saving…" : "Save branding"}
              </button>
            </div>
          )}
        </div>
      ))}

      {clients.length === 0 && (
        <div className="rounded-xl border bg-white py-12 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--navy-2)" }}>No clients found.</p>
        </div>
      )}
    </div>
  );
}

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
      <div className="rounded-xl border border-[#C5E4D0] bg-[#F0FAF5] px-4 py-3.5">
        <p className="text-xs font-semibold text-[#1E6F5C]">Payment is account-level</p>
        <p className="mt-0.5 text-xs text-[#2D6A4F]">
          Once the client has completed organisation setup and you have confirmed payment externally,
          use <strong>Approve Payment &amp; Activate</strong> to: record payment status · stamp activation date ·
          unlock the complete workspace for all users · send the client their access confirmation email.
          One approval unlocks the parent org, all legal entities, all reporting engagements, and the full portal.
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
                  onClick={() => setInvoiceTarget(c)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1E6F5C] px-3.5 py-2 text-xs font-bold text-white hover:brightness-110"
                  title="Record payment and unlock the complete customer workspace"
                >
                  <Unlock className="h-3 w-3" />
                  Approve Payment &amp; Activate
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
                  title="View or update payment record"
                >
                  <FileText className="h-3 w-3" />
                  Payment details
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
    {id:"requests",  label:"Access Requests",     icon:<ClipboardList className="w-4 h-4"/>},
    {id:"payments",  label:"Payment Requests",    icon:<CreditCard className="w-4 h-4"/>},
    {id:"activation",label:"Client Activation",  icon:<Zap className="w-4 h-4"/>},
    {id:"clients",   label:"Engagements",         icon:<Users className="w-4 h-4"/>},
    {id:"queue",     label:"Submissions Queue",   icon:<ListChecks className="w-4 h-4"/>},
    {id:"screening", label:"Relevance Screening", icon:<Lock className="w-4 h-4"/>},
    {id:"log",       label:"Audit Log",           icon:<ScrollText className="w-4 h-4"/>},
    {id:"branding",  label:"Branding",            icon:<Paintbrush className="w-4 h-4"/>},
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
        {/* ── Access Requests tab ── */}
        {tab==="requests" && <RequestsTab />}

        {/* ── Payment Requests tab ── */}
        {tab==="payments" && <PaymentsTab />}

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

        {/* ── Branding tab ── */}
        {tab==="branding" && <BrandingTab />}

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
