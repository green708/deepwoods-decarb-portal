import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  count: number;
  hasOpen: boolean;
  className?: string;
}

/** Small pill badge shown on asset/category headers. Orange = DW replied (client should respond). */
export function ThreadBadge({ count, hasOpen, className }: Props) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        hasOpen ? "bg-amber-warn text-white" : "bg-neutral-soft text-muted-foreground border",
        className,
      )}
    >
      <MessageCircle className="h-2.5 w-2.5" />
      {count}
    </span>
  );
}
