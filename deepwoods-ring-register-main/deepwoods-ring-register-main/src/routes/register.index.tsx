import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortal } from "@/lib/portal-store";
import { TopLevelShell } from "@/components/portal/shell";
import { MicroLabel, RingNumber, StampBadge } from "@/components/portal/primitives";
import {
  Building2,
  Calendar,
  ChevronDown,
  Clock,
  MapPin,
  Search,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/register/")({
  head: () => ({
    meta: [
      { title: "Register — Deepwoods GHG Portal" },
      {
        name: "description",
        content: "Every entity in your group, logged and dated, with status and billing at a glance.",
      },
      { property: "og:title", content: "Register — Deepwoods GHG Portal" },
      {
        property: "og:description",
        content: "Browse and manage the legal entities registered with Deepwoods Green.",
      },
    ],
  }),
  component: RegisterPage,
});

const PER_PAGE = 5;

function RegisterPage() {
  const { accounts, approveLatest } = usePortal();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => accounts.filter((a) => a.companyName.toLowerCase().includes(query.toLowerCase())),
    [accounts, query],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const accepted = accounts.filter((a) => a.status === "accepted").length;
  const pending = accounts.filter((a) => a.status === "pending").length;

  return (
    <TopLevelShell active="register">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[32px] leading-tight font-bold text-ink">Register</h1>
          <p className="mt-1 text-sm text-slate">Every entity in your group, logged and dated.</p>
          <p className="mt-2 text-sm text-ink">
            <span className="num">{accounts.length}</span>{" "}
            {accounts.length === 1 ? "entity" : "entities"} · <span className="num">{accepted}</span>{" "}
            accepted · <span className="num">{pending}</span> pending
          </p>
        </div>
        <Link
          to="/register/new"
          className="cursor-pointer rounded-[6px] bg-canopy px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          + Register entity
        </Link>
      </div>

      <div className="mt-7 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by company name"
            className="w-full rounded-md border border-border bg-white py-2.5 pr-3 pl-9 text-sm outline-none focus:border-coral"
          />
        </div>
        <button
          type="button"
          onClick={() => toast("Filter and sort options aren't part of this build yet.")}
          className="cursor-pointer rounded-md border border-border bg-white p-2.5 text-slate hover:text-ink"
          aria-label="Filter and sort"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-[10px] border border-border bg-white">
        {rows.length === 0 && (
          <p className="p-8 text-sm text-slate">
            {query ? "Nothing on record for that search." : "No accounts logged yet."}
          </p>
        )}
        {rows.map((a, i) => {
          const num = String((page - 1) * PER_PAGE + i + 1).padStart(3, "0");
          const isOpen = open === a.id;
          const enabled = a.status === "accepted";
          const dueInvoice = a.invoices.find((inv) => inv.status === "due");
          return (
            <div key={a.id} className="border-b border-dashed border-border last:border-b-0">
              <div
                onClick={() => setOpen(isOpen ? null : a.id)}
                className="flex cursor-pointer items-center gap-4 px-5 py-4 hover:bg-paper/60"
              >
                <RingNumber n={num} className="h-9 w-9 text-[10px]" />
                <div className="flex-1">
                  <div className="text-[15px] font-bold text-ink">{a.companyName}</div>
                  <div className="mt-1.5">
                    <StampBadge status={a.status} />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!enabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (enabled) navigate({ to: "/account/$id", params: { id: a.id } });
                  }}
                  className={cn(
                    "text-sm font-medium",
                    enabled
                      ? "cursor-pointer text-coral hover:underline"
                      : "cursor-not-allowed text-slate/50",
                  )}
                >
                  Open →
                </button>
                <ChevronDown
                  className={cn("h-4 w-4 text-slate transition-transform", isOpen && "rotate-180")}
                />
              </div>

              {isOpen && (
                <div className="border-t border-border bg-paper px-5 py-6">
                  <div className="grid gap-8 md:grid-cols-2">
                    <div>
                      <MicroLabel>About this entity</MicroLabel>
                      <dl className="mt-3 space-y-2.5 text-sm">
                        <Row icon={<Building2 />} label="Organization type" value={a.orgType} />
                        <Row
                          icon={<MapPin />}
                          label="Facility count"
                          value={<span className="num">{a.facilities.length}</span>}
                        />
                        <Row
                          icon={<Users />}
                          label="Team members"
                          value={<span className="num">{a.team.length}</span>}
                        />
                      </dl>
                    </div>
                    <div>
                      <MicroLabel>Activity</MicroLabel>
                      <dl className="mt-3 space-y-2.5 text-sm">
                        <Row icon={<Calendar />} label="Creation date" value={a.createdDate} />
                        <Row icon={<Clock />} label="Last edit date" value={a.lastEditDate} />
                        <Row icon={<UserRound />} label="Updated by" value={a.updatedBy} />
                      </dl>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[10px] border border-border bg-white p-4">
                    <MicroLabel>Plan &amp; billing</MicroLabel>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <span className="text-sm font-bold text-ink">{a.plan}</span>
                      <StampBadge status={dueInvoice ? "due" : "paid"} />
                      <button
                        type="button"
                        onClick={() =>
                          navigate({
                            to: "/account/$id/profile",
                            params: { id: a.id },
                            search: { tab: "billing" },
                          })
                        }
                        className="ml-auto cursor-pointer text-sm font-medium text-coral hover:underline"
                      >
                        View invoices →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between text-sm">
        <span className="text-slate">
          Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          <PagerBtn disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </PagerBtn>
          <PagerBtn disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </PagerBtn>
        </div>
      </div>

      {pending > 0 && (
        <button
          type="button"
          onClick={() => {
            approveLatest();
            toast("Demo: latest pending entity marked Accepted.");
          }}
          className="fixed right-6 bottom-20 z-50 cursor-pointer rounded-[6px] border border-coral bg-white px-3 py-2 text-xs font-medium text-coral"
        >
          Demo: approve pending entity
        </button>
      )}
    </TopLevelShell>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      <dt className="text-slate">{label}</dt>
      <dd className="ml-auto text-right text-ink">{value}</dd>
    </div>
  );
}

function PagerBtn({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-[6px] border px-3 py-1.5 text-sm",
        disabled
          ? "cursor-not-allowed border-border text-slate/50"
          : "cursor-pointer border-coral text-coral hover:bg-coral-tint",
      )}
    >
      {children}
    </button>
  );
}
