import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { authFetch } from "@/lib/auth";
import { useDataHealth, type DataHealthCheck } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CARD, EmptyHint, ErrorNote, INPUT, Pager, Pill, SECONDARY_BTN, Section, Spinner, useDebounced } from "@/components/admin/ui";
import { ActivityFeed } from "@/components/admin/f4-activity";

type OpenClient = (clientId: number, tab?: string) => void;

function goToClient(clientId: number, tab: string, onOpenClient?: OpenClient) {
  if (onOpenClient) { onOpenClient(clientId, tab); return; }
  window.history.pushState(null, "", `/admin?client=${clientId}&tab=${tab}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function ClientLink({ clientId, tab, onOpenClient, children }: { clientId: number; tab: string; onOpenClient?: OpenClient; children: ReactNode }) {
  return (
    <a
      href={`/admin?client=${clientId}&tab=${tab}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        goToClient(clientId, tab, onOpenClient);
      }}
      className="text-xs font-semibold text-[#1E6F5C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C]"
    >
      {children}
    </a>
  );
}

// ── Data health ───────────────────────────────────────────────────────────────

const SEVERITY: { key: DataHealthCheck["severity"]; label: string; tone: "red" | "amber" | "blue" }[] = [
  { key: "high", label: "High severity", tone: "red" },
  { key: "medium", label: "Medium severity", tone: "amber" },
  { key: "low", label: "Low severity", tone: "blue" },
];

function HealthRow({ check, onOpenClient }: { check: DataHealthCheck; onOpenClient?: OpenClient }) {
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--navy)]">{check.check}</span>
          <Pill tone="slate">{check.client_name}</Pill>
          {check.count > 0 && <span className="text-xs text-muted-foreground">{check.count} item{check.count === 1 ? "" : "s"}</span>}
        </div>
        <p className="mt-1 break-words text-sm text-muted-foreground">{check.detail}</p>
        {check.fix && <p className="mt-1 break-words text-xs text-muted-foreground"><span className="font-semibold text-[var(--navy)]">Suggested fix: </span>{check.fix}</p>}
      </div>
      <ClientLink clientId={check.client_id} tab="overview" onOpenClient={onOpenClient}>Open client</ClientLink>
    </li>
  );
}

function DataHealthPanel({ onOpenClient }: { onOpenClient?: OpenClient }) {
  const q = useDataHealth();
  const [text, setText] = useState("");
  const [showOk, setShowOk] = useState(false);
  const filter = useDebounced(text, 200).trim().toLowerCase();

  const checks = useMemo(() => {
    const all = q.data?.checks ?? [];
    return filter ? all.filter((c) => `${c.client_name} ${c.check} ${c.detail}`.toLowerCase().includes(filter)) : all;
  }, [q.data, filter]);
  const open = checks.filter((c) => c.status === "open");
  const ok = checks.filter((c) => c.status === "ok");

  return (
    <Section
      title="Data health"
      description="Automatic data-quality checks across every active client."
      right={
        <button type="button" className={SECONDARY_BTN} onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Re-run checks
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] max-w-sm flex-1">
            <label htmlFor="health-filter" className="mb-1 block text-xs font-semibold text-[var(--navy)]">Filter by client or check</label>
            <input id="health-filter" className={INPUT} value={text} onChange={(e) => setText(e.target.value)} placeholder="Search" />
          </div>
          {q.data && (
            <p className="pb-2 text-xs text-muted-foreground">
              {open.length} open, {ok.length} passing{q.data.as_of ? ` (checked ${new Date(q.data.as_of.replace(" ", "T")).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})` : ""}
            </p>
          )}
        </div>

        {q.isLoading ? (
          <Spinner label="Running checks" />
        ) : q.error ? (
          <ErrorNote error={q.error} />
        ) : checks.length === 0 ? (
          <EmptyHint title={filter ? "No checks match this filter" : "No checks returned"}>
            {filter ? "Try a different client name." : "The data health service returned no checks."}
          </EmptyHint>
        ) : (
          <>
            {open.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[#E6F4EF] px-4 py-3 text-sm text-[#1E6F5C]">
                <CheckCircle2 className="h-4 w-4" /> No open issues{filter ? " for this filter" : ""}.
              </div>
            )}
            {SEVERITY.map(({ key, label, tone }) => {
              const rows = open.filter((c) => c.severity === key);
              if (rows.length === 0) return null;
              return (
                <div key={key}>
                  <div className="mb-2 flex items-center gap-2">
                    <Pill tone={tone}>{label}</Pill>
                    <span className="text-xs text-muted-foreground">{rows.length} open</span>
                  </div>
                  <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                    {rows.map((c) => <HealthRow key={c.id} check={c} onOpenClient={onOpenClient} />)}
                  </ul>
                </div>
              );
            })}
            {ok.length > 0 && (
              <div>
                <button type="button" className={SECONDARY_BTN + " !py-1.5"} aria-expanded={showOk} onClick={() => setShowOk((v) => !v)}>
                  {showOk ? "Hide" : "Show"} {ok.length} passing check{ok.length === 1 ? "" : "s"}
                </button>
                {showOk && (
                  <ul className="mt-2 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                    {ok.map((c) => (
                      <li key={c.id} className="flex items-start gap-2 px-4 py-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1E6F5C]" />
                        <div className="min-w-0 text-sm">
                          <span className="font-semibold text-[var(--navy)]">{c.check}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{c.client_name}</span>
                          <p className="text-xs text-muted-foreground">{c.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  );
}

// ── Entity codes ──────────────────────────────────────────────────────────────

interface AdminEntityRow {
  id: number;
  client_id: number;
  client_name: string;
  client_slug: string;
  code: string;
  entity_name: string;
  short_name: string;
  org_type: string;
  is_consolidated: boolean;
  code_duplicate: boolean;
}

const ENTITY_PER_PAGE = 25;

function EntityCodesPanel({ onOpenClient }: { onOpenClient?: OpenClient }) {
  const q = useQuery<AdminEntityRow[]>({
    queryKey: ["admin-entities"],
    queryFn: () => authFetch("admin-entities.php"),
    staleTime: 60 * 1000,
  });
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const filter = useDebounced(text, 200).trim().toLowerCase();

  const rows = q.data ?? [];
  const duplicates = useMemo(() => {
    const groups = new Map<string, AdminEntityRow[]>();
    rows.filter((r) => r.code_duplicate).forEach((r) => { groups.set(r.code, [...(groups.get(r.code) ?? []), r]); });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);
  const filtered = useMemo(
    () => (filter ? rows.filter((r) => `${r.client_name} ${r.client_slug} ${r.code} ${r.entity_name} ${r.short_name}`.toLowerCase().includes(filter)) : rows),
    [rows, filter],
  );
  const pageRows = filtered.slice((page - 1) * ENTITY_PER_PAGE, page * ENTITY_PER_PAGE);

  return (
    <div className="space-y-5">
      <Section
        title="Duplicate entity codes"
        description="Entity codes are used in facility and asset identifiers. A code shared by more than one client can cause mix-ups, so each should be unique. Fix a code in that client's Setup tab."
      >
        {q.isLoading ? (
          <Spinner label="Checking entity codes" />
        ) : q.error ? (
          <ErrorNote error={q.error} />
        ) : duplicates.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[#E6F4EF] px-4 py-3 text-sm text-[#1E6F5C]">
            <CheckCircle2 className="h-4 w-4" /> Every entity code is unique across clients.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{duplicates.length} code{duplicates.length === 1 ? " is" : "s are"} used by more than one client.</span>
            </div>
            <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {duplicates.map(([code, list]) => (
                <li key={code} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-800">{code}</span>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1">
                    {list.map((r) => (
                      <span key={r.id} className="inline-flex items-center gap-2 text-sm text-[var(--navy)]">
                        {r.client_name}
                        <ClientLink clientId={r.client_id} tab="setup" onOpenClient={onOpenClient}>Edit in Setup</ClientLink>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="All entities" description="Read-only list of every client entity. Editing happens in each client's Setup tab.">
        <div className="space-y-3">
          <div className="max-w-sm">
            <label htmlFor="entity-filter" className="mb-1 block text-xs font-semibold text-[var(--navy)]">Search clients, codes or names</label>
            <input id="entity-filter" className={INPUT} value={text} onChange={(e) => { setText(e.target.value); setPage(1); }} placeholder="Search" />
          </div>
          {q.isLoading ? (
            <Spinner label="Loading entities" />
          ) : q.error ? null : filtered.length === 0 ? (
            <EmptyHint title="No entities found" />
          ) : (
            <div className={`${CARD} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b border-[var(--border)] bg-[#F9FAFB] text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-2.5">Client</th>
                      <th scope="col" className="px-4 py-2.5">Code</th>
                      <th scope="col" className="px-4 py-2.5">Entity</th>
                      <th scope="col" className="px-4 py-2.5">Type</th>
                      <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r.id} className={`border-t border-[var(--border)] ${r.code_duplicate ? "bg-amber-50/60" : ""}`}>
                        <td className="px-4 py-2.5 text-[var(--navy)]">{r.client_name}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs font-bold text-[var(--navy)]">{r.code}</span>
                          {r.code_duplicate && <span className="ml-2"><Pill tone="amber">Duplicate</Pill></span>}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--navy)]">{r.short_name || r.entity_name}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.org_type || (r.is_consolidated ? "Consolidated" : "—")}</td>
                        <td className="px-4 py-2.5 text-right"><ClientLink clientId={r.client_id} tab="setup" onOpenClient={onOpenClient}>Open client</ClientLink></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} perPage={ENTITY_PER_PAGE} total={filtered.length} onPage={setPage} />
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ── View ──────────────────────────────────────────────────────────────────────

export function PlatformView({ onOpenClient }: { onOpenClient?: OpenClient } = {}) {
  const [section, setSection] = useState("health");
  return (
    <Tabs value={section} onValueChange={setSection} className="space-y-4">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="health">Data health</TabsTrigger>
        <TabsTrigger value="entities">Entity codes</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="health"><DataHealthPanel onOpenClient={onOpenClient} /></TabsContent>
      <TabsContent value="entities"><EntityCodesPanel onOpenClient={onOpenClient} /></TabsContent>
      <TabsContent value="activity">
        <Section title="Activity across all clients" description="Recent changes made by Deepwoods staff, newest first.">
          <ActivityFeed showClient />
        </Section>
      </TabsContent>
    </Tabs>
  );
}
