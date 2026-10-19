import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { InboxThread } from "@/lib/api-admin";
import { Pill, SECONDARY_BTN, timeAgo } from "@/components/admin/ui";
import { ThreadPanel } from "@/components/threads/ThreadPanel";
import { useRefreshInboxOnThreadChange } from "@/components/admin/f4-api";

export function sourceLabel(type: string, id: string): string {
  return type === "scope3" ? `Scope 3 ${id.toUpperCase()}` : `Scope 1 & 2 ${id}`;
}

/** Wraps ThreadPanel and expands it on mount so staff land directly on the conversation. */
export function OpenThreadPanel({ sourceType, sourceId, fy, clientId }: { sourceType: "scope12" | "scope3"; sourceId: string; fy: string; clientId: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  useRefreshInboxOnThreadChange();
  useEffect(() => {
    if (opened.current) return;
    const btn = ref.current?.querySelector<HTMLButtonElement>("button");
    if (btn) { opened.current = true; btn.click(); }
  }, []);
  return (
    <div ref={ref}>
      <ThreadPanel sourceType={sourceType} sourceId={sourceId} fy={fy} clientId={clientId} />
    </div>
  );
}

export function ThreadRows({
  threads, showClient, onOpenClient,
}: {
  threads: InboxThread[];
  showClient?: boolean;
  onOpenClient?: (clientId: number) => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-card">
      {threads.map((t) => {
        const open = openId === t.thread_id;
        const waiting = t.last_from_role === "client";
        const stale = waiting && t.age_days > 3;
        return (
          <li key={t.thread_id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : t.thread_id)}
              aria-expanded={open}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E6F5C]"
            >
              <ChevronRight className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {showClient && <span className="text-sm font-semibold text-[var(--navy)]">{t.client_name}</span>}
                  <span className={showClient ? "text-xs text-muted-foreground" : "text-sm font-semibold text-[var(--navy)]"}>{sourceLabel(t.source_type, t.source_id)}</span>
                  <span className="text-xs text-muted-foreground">{t.fy}</span>
                  {waiting ? <Pill tone={stale ? "red" : "amber"}>Reply needed</Pill> : <Pill tone="slate">Awaiting client</Pill>}
                </div>
                <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">
                  <span className="font-medium text-[var(--navy)]">{t.last_author}: </span>{t.preview}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs">
                <p className={stale ? "font-semibold text-red-700" : "text-muted-foreground"}>{ageText(t)}</p>
                <p className="text-muted-foreground">{t.message_count} message{t.message_count === 1 ? "" : "s"}</p>
              </div>
            </button>
            {open && (
              <div className="border-t border-[var(--border)] bg-[#F8FAF9] px-4 pb-4 pt-1">
                {showClient && onOpenClient && (
                  <div className="flex justify-end pt-2">
                    <button type="button" className={SECONDARY_BTN + " !py-1.5"} onClick={() => onOpenClient(t.client_id)}>Open client</button>
                  </div>
                )}
                <OpenThreadPanel sourceType={t.source_type} sourceId={t.source_id} fy={t.fy} clientId={t.client_id} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ageText(t: InboxThread): string {
  if (t.age_days >= 1) return `${t.age_days}d ago`;
  return timeAgo(t.waiting_since);
}
