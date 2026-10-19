import { useState } from "react";
import { useAdminInbox } from "@/lib/api-admin";
import { EmptyHint, ErrorNote, Pager, SECONDARY_BTN, Section, Spinner, type ClientTabProps } from "@/components/admin/ui";
import { ThreadRows } from "@/components/admin/f4-thread";

const PER_PAGE = 20;

export function QueriesTab({ clientId, clientName }: ClientTabProps) {
  const [status, setStatus] = useState<"open" | "all">("open");
  const [page, setPage] = useState(1);
  const q = useAdminInbox({ client_id: clientId, status, page, per_page: PER_PAGE });
  const threads = q.data?.threads ?? [];

  const choose = (s: "open" | "all") => { setStatus(s); setPage(1); };

  return (
    <Section
      title="Queries"
      description={`Questions ${clientName} has asked about its data. Open a row to read the conversation and reply.`}
      right={
        <div className="flex gap-1" role="group" aria-label="Filter queries">
          {(["open", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => choose(s)}
              className={`${SECONDARY_BTN} !px-3 !py-1.5 ${status === s ? "!border-[#1E6F5C] !bg-[#E6F4EF] !text-[#1E6F5C]" : ""}`}
            >
              {s === "open" ? "Needs reply" : "All queries"}
            </button>
          ))}
        </div>
      }
    >
      {q.isLoading ? (
        <Spinner label="Loading queries" />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : threads.length === 0 ? (
        <EmptyHint title={status === "open" ? "No queries waiting for a reply" : "No queries yet"}>
          {status === "open"
            ? "When this client asks a question from its data or Scope 3 pages, it will appear here."
            : "This client has not asked any questions yet."}
        </EmptyHint>
      ) : (
        <div className="space-y-3">
          <ThreadRows threads={threads} />
          <Pager page={q.data?.page ?? page} perPage={q.data?.per_page ?? PER_PAGE} total={q.data?.total ?? 0} onPage={setPage} />
        </div>
      )}
    </Section>
  );
}
