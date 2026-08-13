import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { authFetch, getRole } from "@/lib/auth";
import { useClientContext, type ClientContext } from "@/lib/client-context";
import { PageHeader, PageBody } from "@/components/portal";
import {
  Building2, Users, CreditCard, List, Check, Loader2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/company-profile")({ component: CompanyProfilePage });

const TABS = [
  { id: "details",  label: "Details",  icon: Building2 },
  { id: "entities", label: "Entities", icon: List },
  { id: "team",     label: "Team",     icon: Users },
  { id: "billing",  label: "Billing",  icon: CreditCard },
] as const;

type Tab = (typeof TABS)[number]["id"];

function CompanyProfilePage() {
  const ctx = useClientContext();
  const role = getRole();
  const [activeTab, setActiveTab] = useState<Tab>("details");

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={ctx.client.name}
        description="View your account details, entities, team members, and billing status."
      />
      <PageBody>
        {/* Tab strip */}
        <div className="mb-6 flex gap-1 rounded-xl border border-[var(--border)] bg-card p-1 w-fit shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  active
                    ? "bg-[#1E6F5C] text-white shadow-sm"
                    : "text-muted-foreground hover:bg-[#F3F4F6] hover:text-[var(--navy)]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "details"  && <DetailsTab ctx={ctx} />}
        {activeTab === "entities" && <EntitiesTab ctx={ctx} />}
        {activeTab === "team"     && <TeamTab role={role} />}
        {activeTab === "billing"  && <BillingTab ctx={ctx} role={role} />}
      </PageBody>
    </>
  );
}

// ── Details tab ───────────────────────────────────────────────────────────────

function DetailsTab({ ctx }: { ctx: ClientContext }) {
  const fields = [
    { label: "Organisation name",   value: ctx.client.name },
    { label: "Slug",                value: ctx.client.slug },
    { label: "Currency",            value: ctx.client.currency },
    { label: "Reporting period",    value: ctx.client.reporting_period === "FY" ? "Fiscal Year (Apr–Mar)" : "Calendar Year (Jan–Dec)" },
    { label: "Account status",      value: ctx.client.is_active ? "Active" : "Pending activation" },
    { label: "Primary colour",      value: ctx.client.primary_color },
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
      <div className="px-6 py-5">
        <div className="mb-6 flex items-center gap-4">
          <img
            src={ctx.client.logo_url}
            alt={ctx.client.name}
            className="h-14 w-auto rounded-lg object-contain"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <div>
            <h2 className="text-xl font-bold text-[var(--navy)]">{ctx.client.name}</h2>
            <code className="text-xs text-muted-foreground">{ctx.client.slug}</code>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map(f => (
            <div key={f.label} className="rounded-lg bg-[#F9FAFB] px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                {f.label}
              </div>
              <div className="text-sm font-medium text-[var(--navy)]">{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Entities tab ──────────────────────────────────────────────────────────────

function EntitiesTab({ ctx }: { ctx: ClientContext }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
      {ctx.entities.map((entity, idx) => (
        <div
          key={entity.code}
          className={`flex items-center gap-4 px-5 py-4 ${idx > 0 ? "border-t border-[var(--border)]" : ""}`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E6F4EF]">
            <span className="text-xs font-bold text-[#1E6F5C]">{entity.code.slice(0, 2)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[var(--navy)]">{entity.name}</span>
              {entity.is_consolidated && (
                <span className="rounded-full bg-[#E6F4EF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1E6F5C]">
                  Consolidated
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {entity.code}
              {entity.consolidates && ` · rolls up: ${entity.consolidates.join(", ")}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Team tab ──────────────────────────────────────────────────────────────────

function TeamTab({ role }: { role: string | null }) {
  const canManage = role === "sustainability_team";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-card px-6 py-6 shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--navy)]">Team management</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage
              ? "Add, remove, and manage access roles for your team members."
              : "Contact your Sustainability Team administrator to manage team access."}
          </p>
        </div>
        {canManage && (
          <Link
            to="/team"
            className="flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            <Users className="h-4 w-4" />
            Manage team
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Billing tab ───────────────────────────────────────────────────────────────

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: "Pending payment",  color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
  paid:    { label: "Payment confirmed", color: "#065F46", bg: "#F0FAF5", border: "#C5E4D0" },
  waived:  { label: "Waived",           color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
};

function BillingTab({ ctx, role }: { ctx: ClientContext; role: string | null }) {
  const paymentStatus = ctx.client.payment_status ?? "pending";
  const paymentRequested =
    ctx.config.payment_requested === "true" || ctx.config.payment_requested === true;
  const [requested, setRequested] = useState(paymentRequested);

  const requestPayment = useMutation({
    mutationFn: () => authFetch("request-payment.php", { method: "POST" }),
    onSuccess: () => {
      setRequested(true);
      toast.success("Payment request sent to Deepwoods");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMeta = PAYMENT_STATUS_LABELS[paymentStatus] ?? PAYMENT_STATUS_LABELS.pending;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-card px-6 py-6 shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
      <h3 className="mb-4 text-base font-semibold text-[var(--navy)]">Billing & payment</h3>

      {/* Payment status badge */}
      <div
        className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
        style={{ color: statusMeta.color, background: statusMeta.bg, border: `1px solid ${statusMeta.border}` }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: statusMeta.color }}
        />
        {statusMeta.label}
      </div>

      {paymentStatus === "paid" || paymentStatus === "waived" ? (
        <div className="rounded-xl border border-[#C5E4D0] bg-[#F0FAF5] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E6F5C]">
              <Check className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1E6F5C]">
                {paymentStatus === "waived" ? "Access waived by Deepwoods" : "Full portal access enabled"}
              </p>
              <p className="text-xs text-[#2D8C72]">
                Your account has full access to all portal features.
              </p>
            </div>
          </div>
        </div>
      ) : requested ? (
        <div className="rounded-xl border border-[#C5E4D0] bg-[#F0FAF5] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E6F5C]">
              <Check className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1E6F5C]">Invoice requested</p>
              <p className="text-xs text-[#2D8C72]">
                Your Deepwoods consultant has been notified and will send your invoice shortly.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[#F9FAFB] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--navy)]">Ready to proceed?</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Once you've completed your organisational boundary setup, request an invoice.
                Your Deepwoods consultant will follow up with payment details.
              </p>
            </div>
            {role === "sustainability_team" && (
              <button
                type="button"
                onClick={() => requestPayment.mutate()}
                disabled={requestPayment.isPending}
                className="shrink-0 flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {requestPayment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {requestPayment.isPending ? "Sending…" : "Request invoice"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg bg-[#F3F4F6] px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="text-[var(--navy)]">Need help?</strong>{" "}
          Contact your Deepwoods account manager for billing queries or payment arrangements.
        </p>
      </div>
    </div>
  );
}
