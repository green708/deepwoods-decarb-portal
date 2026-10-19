import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorNote, Field, INPUT, PRIMARY_BTN, SECONDARY_BTN } from "@/components/admin/ui";

export type PaymentStatus = "pending" | "paid" | "waived";

export interface ClientPayment {
  id: number;
  invoice_ref: string | null;
  payment_status: PaymentStatus;
  payment_date: string | null;
  payment_notes: string | null;
  is_active: boolean;
  activated_at: string | null;
}

/** Admin only. The endpoint has no client filter yet, so the full list is fetched and cached once. */
export function useClientPayment(clientId: number, enabled = true) {
  return useQuery<ClientPayment | null>({
    queryKey: ["activation-clients", "payment", clientId],
    queryFn: async () => {
      const all: ClientPayment[] = await authFetch("activate-client.php");
      return all.find((c) => c.id === clientId) ?? null;
    },
    enabled,
    staleTime: 15 * 1000,
  });
}

const STATUS_LABEL: Record<PaymentStatus, string> = { pending: "Pending", paid: "Paid", waived: "Waived" };
const today = () => new Date().toISOString().slice(0, 10);

export function InvoiceModal({ clientId, clientName, onClose }: { clientId: number; clientName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useClientPayment(clientId);
  const [ref, setRef] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data && !loaded) {
      setRef(data.invoice_ref ?? "");
      setStatus(data.payment_status ?? "pending");
      setDate(data.payment_date ? data.payment_date.slice(0, 10) : "");
      setNotes(data.payment_notes ?? "");
      setLoaded(true);
    }
  }, [data, loaded]);

  const wasUnlocked = data ? data.payment_status === "paid" || data.payment_status === "waived" : false;
  const unlocking = loaded && !wasUnlocked && status !== "pending";

  const changeStatus = (s: PaymentStatus) => {
    setStatus(s);
    if (s !== "pending" && !date) setDate(today());
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!loaded) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch("activate-client.php", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          invoice_ref: ref.trim() || null,
          payment_status: status,
          payment_date: date || null,
          payment_notes: notes.trim() || null,
        }),
      });
      qc.invalidateQueries({ queryKey: ["activation-clients"] });
      qc.invalidateQueries({ queryKey: ["admin-client-settings", clientId] });
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
      if (res?.was_activation) {
        if (res.email_sent) toast.success("Payment recorded. Access confirmation email sent to the client.");
        else toast.warning("Payment recorded and the workspace is unlocked, but no confirmation email was sent.");
      } else {
        toast.success("Payment details saved");
      }
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-[var(--navy)]">Payment details</DialogTitle>
          <DialogDescription>{clientName}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : error ? (
          <ErrorNote error={error} />
        ) : !data ? (
          <ErrorNote error={new Error("Client not found")} />
        ) : (
          <form onSubmit={save} className="space-y-4">
            <Field label="Invoice reference">
              <input className={INPUT} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. INV-2026-001" maxLength={100} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Payment status">
                <select className={INPUT} value={status} onChange={(e) => changeStatus(e.target.value as PaymentStatus)}>
                  {(Object.keys(STATUS_LABEL) as PaymentStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </Field>
              <Field label="Payment date">
                <input type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
            <Field label="Notes" hint="Bank reference, waiver reason, etc.">
              <textarea className={INPUT + " h-auto py-2"} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <div className={`rounded-lg border px-3 py-2 text-xs ${unlocking ? "border-amber-200 bg-amber-50 text-amber-800" : "border-[#C5E4D0] bg-[#F0FAF5] text-[#1E6F5C]"}`}>
              {unlocking
                ? "Saving as Paid or Waived unlocks the full client workspace for all users and emails the client's primary contact."
                : "Payment is handled outside the portal. Marking it Paid or Waived for the first time unlocks the client workspace."}
            </div>
            {saveError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{saveError}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className={SECONDARY_BTN} disabled={saving}>Cancel</button>
              <button type="submit" className={PRIMARY_BTN} disabled={saving || !loaded}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
