import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AccountShell } from "@/components/portal/shell";
import { MicroLabel, StampBadge } from "@/components/portal/primitives";
import { CompanyDetailsForm, FacilitiesForm, TeamForm } from "@/components/portal/forms";
import { usePortal, type CompanyDetails, type Facility, type TeamMember } from "@/lib/portal-store";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tab: z.enum(["details", "facilities", "team", "billing"]).catch("details"),
});

export const Route = createFileRoute("/account/$id/profile")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Company profile — Deepwoods GHG Portal" },
      {
        name: "description",
        content:
          "Edit this entity's company details, facilities, team access and billing on the Deepwoods GHG Portal.",
      },
      { property: "og:title", content: "Company profile — Deepwoods GHG Portal" },
      {
        property: "og:description",
        content: "Manage registration data, team roles and invoices for this entity.",
      },
    ],
  }),
  component: Profile,
});

const TABS = [
  { key: "details", label: "Company Details" },
  { key: "facilities", label: "Facilities" },
  { key: "team", label: "Manage Team" },
  { key: "billing", label: "Billing" },
] as const;

function Profile() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { getAccount, updateAccount, payInvoice } = usePortal();
  const account = getAccount(id);

  const [details, setDetails] = useState<CompanyDetails | null>(account?.companyDetails ?? null);
  const [facilities, setFacilities] = useState<Facility[]>(account?.facilities ?? []);
  const [count, setCount] = useState(Math.max(0, (account?.facilities.length ?? 1) - 1));
  const [team, setTeam] = useState<TeamMember[]>(account?.team ?? []);

  if (!account || !details) {
    return <div className="p-10 text-sm text-slate">Nothing on record for that entity.</div>;
  }

  return (
    <AccountShell accountId={account.id} companyName={account.companyName} active="profile">
      <h1 className="text-[32px] leading-tight font-bold text-ink">Company profile</h1>
      <p className="mt-1 text-sm text-slate">
        The single place to correct anything logged for this entity.
      </p>

      <div className="mt-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigate({ to: ".", search: { tab: t.key }, params: { id } })}
            className={cn(
              "-mb-px cursor-pointer border-b-2 px-4 py-2.5 text-sm font-medium",
              tab === t.key
                ? "border-coral text-coral"
                : "border-transparent text-slate hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-[10px] border border-border bg-white p-8">
        {tab === "details" && (
          <>
            <CompanyDetailsForm
              value={details}
              onChange={(patch) => setDetails({ ...details, ...patch })}
            />
            <SaveBar
              onSave={() => {
                updateAccount(id, {
                  companyDetails: details,
                  orgType: details.orgType,
                  industry: details.industry,
                  companyName: details.legalName || account.companyName,
                });
                toast("Company details saved.");
              }}
            />
          </>
        )}

        {tab === "facilities" && (
          <>
            <FacilitiesForm
              facilities={facilities}
              additionalCount={count}
              onFacilities={setFacilities}
              onCount={setCount}
              onEditAddress={() => navigate({ to: ".", search: { tab: "details" }, params: { id } })}
            />
            <SaveBar
              onSave={() => {
                updateAccount(id, { facilities });
                toast("Facilities saved.");
              }}
            />
          </>
        )}

        {tab === "team" && (
          <>
            <TeamForm team={team} onChange={setTeam} />
            <SaveBar
              onSave={() => {
                updateAccount(id, { team });
                toast("Team saved.");
              }}
            />
          </>
        )}

        {tab === "billing" && (
          <div className="space-y-8">
            <div className="rounded-[10px] border border-border bg-paper p-6">
              <MicroLabel>Current plan</MicroLabel>
              <h2 className="mt-1 text-lg font-bold text-ink">{account.plan}</h2>
              {account.invoices.map((inv) =>
                inv.status === "due" ? (
                  <div key={inv.id} className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-ink">Active period {inv.period}</span>
                    <StampBadge status="due" />
                    <button
                      type="button"
                      onClick={() => {
                        payInvoice(id, inv.id);
                        toast(`${inv.period} marked paid.`);
                      }}
                      className="cursor-pointer rounded-[6px] bg-canopy px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      Pay for {inv.period} →
                    </button>
                  </div>
                ) : null,
              )}
              {!account.invoices.some((i) => i.status === "due") && (
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm text-ink">All periods settled</span>
                  <StampBadge status="paid" />
                </div>
              )}
              <p className="mt-4 text-xs text-slate">
                Pricing is confirmed manually — nothing is charged automatically.
              </p>
            </div>

            <div>
              <MicroLabel>Invoice history</MicroLabel>
              <div className="mt-3">
                <div className="grid grid-cols-6 gap-4 border-b border-dashed border-border pb-2 text-[11px] font-medium tracking-[0.05em] text-slate uppercase">
                  <span>Invoice No.</span>
                  <span>Period</span>
                  <span>Amount</span>
                  <span>Status</span>
                  <span>Date paid</span>
                  <span />
                </div>
                {[...account.invoices].reverse().map((inv) => (
                  <div
                    key={inv.id}
                    className="grid grid-cols-6 items-center gap-4 border-b border-dashed border-border py-3 text-sm"
                  >
                    <span className="text-ink">{inv.id}</span>
                    <span className="text-ink">{inv.period}</span>
                    <span className="num">{inv.amount}</span>
                    <StampBadge status={inv.status} className="justify-self-start" />
                    <span className="text-ink">{inv.datePaid ?? "—"}</span>
                    <button
                      type="button"
                      onClick={() => toast("Invoice downloads aren't part of this build yet")}
                      className="cursor-pointer justify-self-end text-sm font-medium text-coral hover:underline"
                    >
                      Download →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AccountShell>
  );
}

function SaveBar({ onSave }: { onSave: () => void }) {
  return (
    <div className="mt-8 border-t border-border pt-5">
      <button
        type="button"
        onClick={onSave}
        className="cursor-pointer rounded-[6px] bg-canopy px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        Save changes
      </button>
    </div>
  );
}
