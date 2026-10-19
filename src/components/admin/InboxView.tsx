import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAdminInbox } from "@/lib/api-admin";
import { CARD, EmptyHint, ErrorNote, INPUT, Pager, SECONDARY_BTN, Spinner, useDebounced } from "@/components/admin/ui";
import { ThreadRows } from "@/components/admin/f4-thread";

const PER_PAGE = 25;

export function InboxView({ onOpenClient }: { onOpenClient: (clientId: number) => void }) {
  const [status, setStatus] = useState<"open" | "all">("open");
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const filter = useDebounced(text, 200).trim().toLowerCase();
  const q = useAdminInbox({ status, page, per_page: PER_PAGE });

  const all = q.data?.threads ?? [];
  const threads = filter
    ? all.filter((t) => `${t.client_name} ${t.source_id} ${t.fy} ${t.preview}`.toLowerCase().includes(filter))
    : all;
  const total = q.data?.total ?? 0;

  const choose = (s: "open" | "all") => { setStatus(s); setPage(1); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] max-w-sm flex-1">
          <label htmlFor="inbox-filter" className="mb-1 block text-xs font-semibold text-[var(--navy)]">Filter this page</label>
          <input id="inbox-filter" className={INPUT} value={text} onChange={(e) => setText(e.target.value)} placeholder="Client, source or message text" />
        </div>
        <div className="flex gap-1" role="group" aria-label="Filter threads">
          {(["open", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => choose(s)}
              className={`${SECONDARY_BTN} !px-3 ${status === s ? "!border-[#1E6F5C] !bg-[#E6F4EF] !text-[#1E6F5C]" : ""}`}
            >
              {s === "open" ? "Needs reply" : "All threads"}
            </button>
          ))}
        </div>
        <button type="button" className={`${SECONDARY_BTN} ml-auto`} onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {q.isLoading ? (
        <div className={`${CARD} px-5`}><Spinner label="Loading inbox" /></div>
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : all.length === 0 ? (
        <EmptyHint title={status === "open" ? "Inbox is clear" : "No query threads yet"}>
          {status === "open"
            ? "No client is waiting for a Deepwoods reply."
            : "No client has asked a question yet."}
        </EmptyHint>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {status === "open" ? `${total} thread${total === 1 ? "" : "s"} waiting for a reply, oldest first.` : `${total} thread${total === 1 ? "" : "s"}, oldest waiting first.`}
            {filter && ` Showing ${threads.length} matching on this page.`}
          </p>
          {threads.length === 0 ? (
            <EmptyHint title="No matches on this page">The filter only searches the threads loaded on this page. Clear it or change page.</EmptyHint>
          ) : (
            <ThreadRows threads={threads} showClient onOpenClient={onOpenClient} />
          )}
          {total > (q.data?.per_page ?? PER_PAGE) && (
            <div className={`${CARD} overflow-hidden`}>
              <Pager page={q.data?.page ?? page} perPage={q.data?.per_page ?? PER_PAGE} total={total} onPage={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
