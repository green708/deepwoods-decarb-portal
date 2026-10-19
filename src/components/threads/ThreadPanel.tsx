import { useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getRole } from "@/lib/auth";
import {
  useNdcThreads,
  useNdcCreateThread,
  useNdcReplyThread,
  type NdcThread,
} from "@/lib/api";

interface Props {
  sourceType: "scope12" | "scope3";
  sourceId: string;
  fy: string;
  /** Pass for DW admin views to scope to a specific client */
  clientId?: number;
  /** Seed data when the summary is already fetched to avoid double-fetch */
  summaryCount?: number;
  summaryHasOpen?: boolean;
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ThreadItem({
  thread,
  onReply,
  replying,
}: {
  thread: NdcThread;
  onReply: (threadId: number, msg: string) => void;
  replying: boolean;
}) {
  const [showReply, setShowReply] = useState(false);
  const [text, setText] = useState("");
  const role = getRole() ?? "";
  const isDW = role === "deepwoods_admin" || role === "deepwoods_coordinator";

  const submit = () => {
    if (!text.trim()) return;
    onReply(thread.id, text.trim());
    setText("");
    setShowReply(false);
  };

  return (
    <div className="rounded-md border bg-background p-2.5 space-y-2">
      {thread.messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "rounded px-2.5 py-2 text-xs",
            msg.from_role === "deepwoods"
              ? "bg-primary/8 border border-primary/20 ml-6"
              : "bg-neutral-soft border mr-6",
          )}
        >
          <div className="mb-1 flex items-center gap-2">
            <span
              className={cn(
                "font-semibold text-[11px]",
                msg.from_role === "deepwoods" ? "text-primary" : "text-navy",
              )}
            >
              {msg.from_role === "deepwoods" ? (isDW ? msg.author : "Deepwoods") : isDW ? msg.author : "You"}
            </span>
            <span className="text-[10px] text-muted-foreground">{fmt(msg.created_at)}</span>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
        </div>
      ))}

      {showReply ? (
        <div className="flex gap-2 items-end pt-1">
          <Textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your reply…"
            className="text-xs flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
          />
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={replying || !text.trim()}
              onClick={submit}
            >
              <Send className="h-3.5 w-3.5" /> Send
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setShowReply(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowReply(true)}
          className="text-[11px] font-medium text-primary hover:underline"
        >
          Reply
        </button>
      )}
    </div>
  );
}

export function ThreadPanel({
  sourceType,
  sourceId,
  fy,
  clientId,
  summaryCount,
  summaryHasOpen,
}: Props) {
  const [open, setOpen] = useState(false);
  const [newMsg, setNewMsg] = useState("");

  const {
    data: threads,
    isLoading,
  } = useNdcThreads(sourceType, sourceId, fy, clientId);

  const { mutate: createThread, isPending: creating } = useNdcCreateThread(
    sourceType,
    sourceId,
    fy,
  );
  const { mutate: replyThread, isPending: replying } = useNdcReplyThread(
    sourceType,
    sourceId,
    fy,
  );

  const count = threads?.length ?? summaryCount ?? 0;
  const hasOpen =
    threads != null
      ? threads.some((t) => t.last_from_role === "deepwoods")
      : (summaryHasOpen ?? false);

  const handleCreate = () => {
    if (!newMsg.trim()) return;
    createThread(
      {
        source_type: sourceType,
        source_id: sourceId,
        fy,
        message: newMsg.trim(),
        ...(clientId ? { client_id: clientId } : {}),
      },
      { onSuccess: () => setNewMsg("") },
    );
  };

  const handleReply = (threadId: number, message: string) => {
    replyThread({ thread_id: threadId, message, ...(clientId ? { client_id: clientId } : {}) });
  };

  return (
    <div className="mt-3 rounded-md border border-dashed border-border/60">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-soft/40 rounded-md transition-colors"
      >
        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground">
          {count > 0
            ? `${count} query thread${count !== 1 ? "s" : ""}`
            : "Ask a question"}
        </span>
        {hasOpen && (
          <Badge className="ml-1 bg-amber-warn text-white text-[10px] px-1.5 py-0 h-4">
            Reply needed
          </Badge>
        )}
        {!hasOpen && count > 0 && (
          <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
            {count}
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-dashed border-border/60 px-3 py-3 space-y-3">
          {isLoading && (
            <p className="text-xs text-muted-foreground animate-pulse">Loading threads…</p>
          )}

          {!isLoading && threads?.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No questions yet. Use the form below to ask the Deepwoods team.
            </p>
          )}

          {threads?.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              onReply={handleReply}
              replying={replying}
            />
          ))}

          {/* New thread composer */}
          <div className="space-y-2 pt-1 border-t border-dashed border-border/40">
            <p className="text-[11px] font-medium text-muted-foreground">
              {count > 0 ? "Start a new thread" : "Ask the Deepwoods team"}
            </p>
            <Textarea
              rows={2}
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder="e.g. Which unit should diesel consumption be reported in?"
              className="text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleCreate();
              }}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={!newMsg.trim() || creating}
                onClick={handleCreate}
              >
                <Send className="h-3.5 w-3.5" />
                {count > 0 ? "New thread" : "Ask"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
