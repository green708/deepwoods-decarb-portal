import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DANGER_BTN, PRIMARY_BTN, SECONDARY_BTN } from "@/components/admin/ui";

export function ConfirmDialog({
  open, title, body, confirmLabel, pending, destructive = true, onCancel, onConfirm,
}: {
  open: boolean; title: string; body: string; confirmLabel: string; pending?: boolean; destructive?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !pending) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <button type="button" className={SECONDARY_BTN} onClick={onCancel} disabled={pending}>Cancel</button>
          <button type="button" className={destructive ? DANGER_BTN : PRIMARY_BTN} onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
