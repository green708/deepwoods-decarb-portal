import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AccountShell } from "@/components/portal/shell";
import { MicroLabel } from "@/components/portal/primitives";
import { usePortal } from "@/lib/portal-store";

export const Route = createFileRoute("/account/$id/")({
  head: () => ({
    meta: [
      { title: "Entity home — Deepwoods GHG Portal" },
      {
        name: "description",
        content:
          "Workspace home for a registered entity: registration outcome, facilities, team and next steps in the GHG inventory.",
      },
      { property: "og:title", content: "Entity home — Deepwoods GHG Portal" },
      {
        property: "og:description",
        content: "Registration outcome and next steps for this entity.",
      },
    ],
  }),
  component: AccountHome,
});

function AccountHome() {
  const { id } = Route.useParams();
  const { getAccount } = usePortal();
  const navigate = useNavigate();
  const account = getAccount(id);

  if (!account) {
    return (
      <div className="p-10 text-sm text-slate">
        Nothing on record for that entity.{" "}
        <button
          type="button"
          className="cursor-pointer text-coral hover:underline"
          onClick={() => navigate({ to: "/register" })}
        >
          Back to Register
        </button>
      </div>
    );
  }

  const dueInvoice = account.invoices.find((i) => i.status === "due");

  return (
    <AccountShell accountId={account.id} companyName={account.companyName} active="home">
      <h1 className="text-[32px] leading-tight font-bold text-ink">
        Welcome to the Deepwoods GHG Portal
      </h1>
      <p className="mt-1 text-sm text-slate">
        Everything logged for {account.companyName} at registration, and where to pick up next.
      </p>

      <div className="mt-7 rounded-[12px] border border-border bg-white p-6">
        <MicroLabel>Registration outcome</MicroLabel>
        <div className="mt-4 grid gap-6 md:grid-cols-4">
          <Kv label="Organization type" value={account.orgType} />
          <Kv label="Facility count" value={String(account.facilities.length)} bold />
          <Kv label="Team members" value={String(account.team.length)} bold />
          <Kv label="Plan / pricing tier" value={account.plan} />
        </div>
        <p className="mt-5 max-w-3xl border-t border-dashed border-border pt-4 text-sm text-slate">
          This entity is registered under operational control, with its own inventory boundary,
          facility list and team access. Billing for the current period is{" "}
          {dueInvoice ? `due for ${dueInvoice.period}` : "settled"}. Any of this can be corrected at
          any time from Company profile in the sidebar footer.
        </p>
      </div>

      <div className="mt-8">
        <MicroLabel>Get started</MicroLabel>
        <button
          type="button"
          onClick={() => toast("Inventory Boundary Setup isn't part of this build yet.")}
          className="mt-3 block w-full max-w-xl cursor-pointer rounded-[12px] border border-border bg-white p-6 text-left transition-colors hover:border-coral"
        >
          <span className="text-[17px] font-semibold text-ink">
            Continue to Inventory Boundary Setup →
          </span>
          <span className="mt-1 block text-sm text-slate">
            Confirm which facilities and activities fall inside this entity's reporting boundary.
          </span>
        </button>
      </div>
    </AccountShell>
  );
}

function Kv({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <MicroLabel>{label}</MicroLabel>
      <div className={bold ? "num mt-1 text-xl" : "mt-1 text-sm font-medium text-ink"}>{value}</div>
    </div>
  );
}
