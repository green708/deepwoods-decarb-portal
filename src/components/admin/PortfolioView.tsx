import { useEffect, useState } from "react";
import { AlertCircle, ChevronRight, Plus, RefreshCw, Search } from "lucide-react";
import { useAdminPortfolio, type AdminPortfolioClient, type AttentionItem, type PortfolioParams } from "@/lib/api-admin";
import { getEmail } from "@/lib/auth";
import {
  CalcPill, CARD, CyclePill, EmptyHint, ErrorNote, FLAG_LABEL, INPUT, Pager, PaymentPill, Pill,
  PRIMARY_BTN, SECONDARY_BTN, Spinner, fmtDate, timeAgo, useDebounced,
} from "./ui";
import { ClientAvatar } from "./ClientWorkspace";
import { NewClientModal } from "./NewClientModal";
import type { AdminNav, ClientTab } from "./useAdminLocation";

export type StatusFilter = NonNullable<PortfolioParams["status"]>;
export type SortKey = NonNullable<PortfolioParams["sort"]>;
export type OwnerFilter = "all" | "me" | "unassigned";

export interface PortfolioFilters {
  q: string;
  status: StatusFilter;
  owner: OwnerFilter;
  sort: SortKey;
  page: number;
}

export const DEFAULT_FILTERS: PortfolioFilters = { q: "", status: "all", owner: "all", sort: "attention", page: 1 };
const PER_PAGE = 25;

export function buildPortfolioParams(f: PortfolioFilters): PortfolioParams {
  const params: PortfolioParams = { page: f.page, per_page: PER_PAGE, sort: f.sort };
  if (f.q.trim()) params.q = f.q.trim();
  if (f.status !== "all") params.status = f.status;
  if (f.owner !== "all") params.owner = f.owner;
  return params;
}

let remembered: PortfolioFilters = DEFAULT_FILTERS;

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All clients",
  active: "Active",
  pending_activation: "Pending activation",
  awaiting_payment: "Awaiting payment",
  attention: "Needs attention",
};

const SORT_LABELS: Record<SortKey, string> = {
  attention: "Most urgent first",
  name: "Name A-Z",
  due: "Data due date",
  owner: "Account owner",
};

const SELECT = `${INPUT} pr-8`;

interface KpiProps {
  label: string;
  value: number | undefined;
  hint: string;
  tone?: "default" | "amber" | "red";
  active?: boolean;
  onClick: () => void;
}

function Kpi({ label, value, hint, tone = "default", active, onClick }: KpiProps) {
  const color = value && value > 0 && tone === "red" ? "text-red-700" : value && value > 0 && tone === "amber" ? "text-amber-700" : "text-[var(--navy)]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={`${CARD} flex flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C] ${active ? "ring-2 ring-[#1E6F5C]" : ""}`}
    >
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className={`text-2xl font-semibold tabular-nums leading-none ${color}`}>{value ?? "-"}</span>
    </button>
  );
}

const ATTENTION_TARGET: Record<AttentionItem["type"], ClientTab | "requests"> = {
  new_request: "requests",
  awaiting_payment: "setup",
  overdue_cycle: "data",
  open_query: "queries",
  to_verify: "calc",
  no_users: "setup",
  submitted: "calc",
};

const SEVERITY_DOT: Record<AttentionItem["severity"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

const ATTENTION_SHOWN = 6;

function AttentionPanel({ items, onOpen }: { items: AttentionItem[]; onOpen: (item: AttentionItem) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, ATTENTION_SHOWN);
  return (
    <section className={`${CARD} overflow-hidden`} aria-label="Needs attention">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--navy)]">Needs attention</h2>
          {items.length > 0 && <Pill tone={items.some((i) => i.severity === "high") ? "red" : "amber"}>{items.length}</Pill>}
        </div>
        {items.length > ATTENTION_SHOWN && (
          <button type="button" className="text-xs font-semibold text-[#1E6F5C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C]" onClick={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `Show all ${items.length}`}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-5 text-sm text-muted-foreground">Nothing needs attention right now.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {shown.map((item, i) => (
            <li key={`${item.type}-${item.client_id ?? "x"}-${item.ref_id ?? i}`}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E6F5C]"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[item.severity]}`} aria-label={`${item.severity} priority`} role="img" />
                <span className="min-w-0 flex-1 text-sm text-[var(--navy)]">
                  {item.client_name && <span className="font-semibold">{item.client_name}</span>}
                  {item.client_name && <span className="text-muted-foreground"> - </span>}
                  <span className="text-muted-foreground">{item.label}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DataBar({ withData, total }: { withData: number; total: number }) {
  if (total <= 0) return <span className="text-xs text-muted-foreground">No sources</span>;
  const pct = Math.round((withData / total) * 100);
  return (
    <div className="w-28">
      <div className="mb-1 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{withData} / {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${withData} of ${total} sources have data`}>
        <div className="h-full rounded-full bg-[#1E6F5C]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const TH = "whitespace-nowrap bg-[#F8FAF9] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const TD = "px-4 py-3 align-middle";

function ClientRow({ c, me, onOpen }: { c: AdminPortfolioClient; me: string; onOpen: (c: AdminPortfolioClient) => void }) {
  const ownerIsMe = !!c.account_owner && c.account_owner.toLowerCase() === me;
  return (
    <tr onClick={() => onOpen(c)} className="group cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-slate-50">
      <td className={`${TD} sticky left-0 z-[1] bg-card group-hover:bg-slate-50`}>
        <div className="flex min-w-[220px] items-center gap-3">
          <ClientAvatar name={c.name} logoUrl={c.logo_url} color={c.primary_color} />
          <div className="min-w-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpen(c); }}
              className="block max-w-[240px] truncate rounded text-left text-sm font-semibold text-[var(--navy)] hover:text-[#1E6F5C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C]"
            >
              {c.name}
            </button>
            <span className="block truncate text-[11px] text-muted-foreground">{c.slug}</span>
          </div>
        </div>
      </td>
      <td className={TD}>
        <div className="flex flex-wrap gap-1">
          <PaymentPill status={c.payment_status} />
          {!c.is_active && <Pill tone="slate">Inactive</Pill>}
        </div>
      </td>
      <td className={TD}>
        <div className="flex flex-col items-start gap-1">
          <CyclePill status={c.cycle.status} overdue={c.cycle.overdue} />
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
            {c.cycle.data_due_date ? `Data due ${fmtDate(c.cycle.data_due_date)}` : "No due date"}
          </span>
        </div>
      </td>
      <td className={TD}><DataBar withData={c.sources_with_data} total={c.sources_total} /></td>
      <td className={TD}><CalcPill status={c.calc.status} /></td>
      <td className={`${TD} tabular-nums`}>
        {c.open_queries > 0 ? <Pill tone="amber">{c.open_queries}</Pill> : <span className="text-xs text-muted-foreground">0</span>}
      </td>
      <td className={TD}>
        {c.account_owner ? (
          <span className="block max-w-[170px] truncate text-xs text-[var(--navy)]" title={c.account_owner}>{ownerIsMe ? "You" : c.account_owner}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
      </td>
      <td className={`${TD} whitespace-nowrap text-xs text-muted-foreground`}>{timeAgo(c.last_login)}</td>
      <td className={TD}>
        <div className="flex min-w-[120px] flex-wrap gap-1">
          {c.flags.map((f) => <Pill key={f} tone={FLAG_LABEL[f][0]}>{FLAG_LABEL[f][1]}</Pill>)}
        </div>
      </td>
    </tr>
  );
}

interface Props {
  isAdmin: boolean;
  go: (next: AdminNav) => void;
}

export function PortfolioView({ isAdmin, go }: Props) {
  const [filters, setFilters] = useState<PortfolioFilters>(remembered);
  const [qInput, setQInput] = useState(remembered.q);
  const [creating, setCreating] = useState(false);
  const debouncedQ = useDebounced(qInput, 300);
  const me = (getEmail() ?? "").toLowerCase();

  useEffect(() => {
    setFilters((f) => (f.q === debouncedQ ? f : { ...f, q: debouncedQ, page: 1 }));
  }, [debouncedQ]);

  useEffect(() => { remembered = filters; }, [filters]);

  const q = useAdminPortfolio(buildPortfolioParams(filters));
  const data = q.data;
  const summary = data?.summary;

  const patch = (next: Partial<PortfolioFilters>) => setFilters((f) => ({ ...f, page: 1, ...next }));
  const showAll = () => { setQInput(""); setFilters(DEFAULT_FILTERS); };
  const filtersActive = filters.q !== "" || filters.status !== "all" || filters.owner !== "all";

  const openClient = (c: AdminPortfolioClient) => go({ client: c.id, tab: "overview" });

  const openAttention = (item: AttentionItem) => {
    const target = ATTENTION_TARGET[item.type];
    if (target === "requests" || item.client_id == null) go({ view: "requests" });
    else go({ client: item.client_id, tab: target });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Clients" value={summary?.clients} hint={summary ? `${summary.active} active, ${summary.pending_activation} pending activation. Click to show all.` : "Show all clients"} active={!filtersActive} onClick={showAll} />
        <Kpi label="Awaiting payment" value={summary?.awaiting_payment} hint="Show clients awaiting payment" tone="amber" active={filters.status === "awaiting_payment"} onClick={() => patch({ status: "awaiting_payment" })} />
        <Kpi label="New requests" value={summary?.new_requests} hint="Open the access requests pipeline" tone="amber" onClick={() => go({ view: "requests" })} />
        <Kpi label="Open queries" value={summary?.open_queries} hint="Open the query inbox" tone="amber" onClick={() => go({ view: "inbox" })} />
        <Kpi label="Overdue cycles" value={summary?.overdue_cycles} hint="Show clients needing attention, by due date" tone="red" onClick={() => patch({ status: "attention", sort: "due" })} />
        <Kpi label="To verify" value={summary?.to_verify} hint="Show clients needing attention" tone="amber" onClick={() => patch({ status: "attention", sort: "attention" })} />
      </div>

      {data && <AttentionPanel items={data.attention} onOpen={openAttention} />}

      <section className={`${CARD} overflow-hidden`} aria-label="Clients">
        <div className="flex flex-wrap items-end gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="relative min-w-[180px] max-w-[240px] flex-1">
            <label htmlFor="portfolio-search" className="mb-1 block text-xs font-semibold text-[var(--navy)]">Search</label>
            <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              id="portfolio-search"
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Name or slug"
              className={`${INPUT} pl-9`}
            />
          </div>
          <div>
            <label htmlFor="portfolio-status" className="mb-1 block text-xs font-semibold text-[var(--navy)]">Status</label>
            <select id="portfolio-status" className={SELECT} value={filters.status} onChange={(e) => patch({ status: e.target.value as StatusFilter })}>
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((k) => <option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="portfolio-owner" className="mb-1 block text-xs font-semibold text-[var(--navy)]">Account owner</label>
            <select id="portfolio-owner" className={SELECT} value={filters.owner} onChange={(e) => patch({ owner: e.target.value as OwnerFilter })}>
              <option value="all">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
          <div>
            <label htmlFor="portfolio-sort" className="mb-1 block text-xs font-semibold text-[var(--navy)]">Sort by</label>
            <select id="portfolio-sort" className={SELECT} value={filters.sort} onChange={(e) => patch({ sort: e.target.value as SortKey })}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className={SECONDARY_BTN} onClick={() => q.refetch()} disabled={q.isFetching} aria-label="Refresh portfolio">
              <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
            </button>
            {isAdmin && (
              <button type="button" className={PRIMARY_BTN} onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> New client
              </button>
            )}
          </div>
        </div>

        {q.isLoading ? (
          <div className="px-5"><Spinner label="Loading clients..." /></div>
        ) : q.error && !data ? (
          <div className="space-y-3 p-5">
            <ErrorNote error={q.error} />
            <button type="button" className={SECONDARY_BTN} onClick={() => q.refetch()}>Retry</button>
          </div>
        ) : data && data.clients.length === 0 ? (
          <div className="p-5">
            <EmptyHint title={filtersActive ? "No clients match these filters" : "No clients yet"}>
              {filtersActive ? (
                <button type="button" className="font-semibold text-[#1E6F5C] hover:underline" onClick={showAll}>Clear filters</button>
              ) : (
                <span>Convert an access request or create a client to get started.</span>
              )}
            </EmptyHint>
          </div>
        ) : data ? (
          <>
            {q.error && (
              <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-5 py-2 text-xs text-red-700" role="alert">
                <AlertCircle className="h-4 w-4" /> Could not refresh. Showing the last loaded results.
              </div>
            )}
            <div className={`overflow-x-auto transition-opacity ${q.isFetching && q.isPlaceholderData ? "opacity-60" : ""}`}>
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={`${TH} sticky left-0 z-[1]`}>Client</th>
                    <th scope="col" className={TH}>Status</th>
                    <th scope="col" className={TH}>Reporting cycle</th>
                    <th scope="col" className={TH}>Data</th>
                    <th scope="col" className={TH}>Calculation</th>
                    <th scope="col" className={TH}>Queries</th>
                    <th scope="col" className={TH}>Owner</th>
                    <th scope="col" className={TH}>Last login</th>
                    <th scope="col" className={TH}>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clients.map((c) => <ClientRow key={c.id} c={c} me={me} onOpen={openClient} />)}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} perPage={data.per_page} total={data.total} onPage={(p) => setFilters((f) => ({ ...f, page: p }))} />
            {data.total <= data.per_page && (
              <p className="border-t border-[var(--border)] px-4 py-2.5 text-xs text-muted-foreground">
                {data.total} {data.total === 1 ? "client" : "clients"}
              </p>
            )}
          </>
        ) : null}
      </section>

      {creating && (
        <NewClientModal
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); go({ client: id, tab: "setup" }); }}
        />
      )}
    </div>
  );
}
