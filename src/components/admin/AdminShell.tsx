import { useAdminPortfolio } from "@/lib/api-admin";
import { PageBody, PageHeader } from "@/components/portal";
import { buildPortfolioParams, DEFAULT_FILTERS, PortfolioView } from "./PortfolioView";
import { ClientWorkspace } from "./ClientWorkspace";
import { RequestsView } from "./RequestsView";
import { InboxView } from "./InboxView";
import { PlatformView } from "./PlatformView";
import { ADMIN_VIEWS, useAdminLocation, type AdminView } from "./useAdminLocation";

function Badge({ count }: { count: number | undefined }) {
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold tabular-nums text-amber-800">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AdminShell({ isAdmin }: { isAdmin: boolean }) {
  const { view, clientId, tab, fy, go } = useAdminLocation();
  const portfolio = useAdminPortfolio(buildPortfolioParams(DEFAULT_FILTERS));
  const summary = portfolio.data?.summary;
  const counts: Partial<Record<AdminView, number | undefined>> = { requests: summary?.new_requests, inbox: summary?.open_queries };
  const inWorkspace = clientId != null;

  return (
    <>
      <PageHeader
        eyebrow="Deepwoods"
        title="Admin Console"
        description="Manage every client from one place: onboarding, reporting cycles, calculations, targets and client queries."
      />
      <div className="px-6 pt-4 md:px-8">
        <nav aria-label="Admin console sections" className="flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--border)]">
          {ADMIN_VIEWS.map((v) => {
            const active = !inWorkspace && view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => go({ view: v.key })}
                className={`inline-flex shrink-0 items-center whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E6F5C] ${
                  active ? "border-[#1E6F5C] text-[#1E6F5C]" : "border-transparent text-muted-foreground hover:text-[var(--navy)]"
                }`}
              >
                {v.label}
                <Badge count={counts[v.key]} />
              </button>
            );
          })}
        </nav>
      </div>
      <PageBody>
        {inWorkspace ? (
          <ClientWorkspace key={clientId} clientId={clientId} tab={tab} fy={fy} isAdmin={isAdmin} go={go} />
        ) : view === "requests" ? (
          <RequestsView onOpenClient={(id) => go({ client: id, tab: "overview" })} />
        ) : view === "inbox" ? (
          <InboxView onOpenClient={(id) => go({ client: id, tab: "queries" })} />
        ) : view === "platform" ? (
          <PlatformView />
        ) : (
          <PortfolioView isAdmin={isAdmin} go={go} />
        )}
      </PageBody>
    </>
  );
}
