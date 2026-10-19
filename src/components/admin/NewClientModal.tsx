import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, INPUT, PRIMARY_BTN, SECONDARY_BTN } from "@/components/admin/ui";
import { CredentialsDialog, ROLE_OPTIONS, type ClientRole, type CredentialsInfo } from "@/components/admin/InviteUserModal";

export const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (clientId: number) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("INR");
  const [period, setPeriod] = useState<"FY" | "CY">("FY");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ClientRole>("sustainability_team");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: number; creds: CredentialsInfo | null } | null>(null);

  const onName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const emailEntered = inviteEmail.trim() !== "";
  const emailInvalid = emailEntered && !EMAIL_RE.test(inviteEmail.trim());
  const canSubmit = name.trim() !== "" && slug !== "" && !emailInvalid && !submitting;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch("clients.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          currency,
          reporting_period: period,
          ...(emailEntered ? { invite_email: inviteEmail.trim().toLowerCase(), invite_role: inviteRole } : {}),
        }),
      });
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
      toast.success(`${name.trim()} created and active`);
      const id = Number(res.client_id);
      if (emailEntered && res.invite_email) {
        setCreated({
          id,
          creds: {
            title: "Client created",
            description: `${name.trim()} is active. Payment is still pending until you record it in the client's Setup tab.`,
            email: res.invite_email,
            tempPassword: res.temp_password ?? null,
            emailSent: !!res.email_sent,
          },
        });
      } else {
        onCreated(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setSubmitting(false);
    }
  };

  if (created?.creds) return <CredentialsDialog info={created.creds} onClose={() => onCreated(created.id)} />;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-[var(--navy)]">New client</DialogTitle>
          <DialogDescription>Create a client workspace manually. It is active as soon as it is created.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Company name">
            <input className={INPUT} value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. ABC Industries Pvt. Ltd." autoFocus />
          </Field>
          <Field label="Portal slug" hint="Lowercase letters, numbers and hyphens. Must be unique across all clients.">
            <input
              className={INPUT + " font-mono"}
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
              placeholder="abc-industries"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency">
              <select className={INPUT} value={currency} onChange={(e) => setCurrency(e.target.value as (typeof CURRENCIES)[number])}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Reporting year">
              <select className={INPUT} value={period} onChange={(e) => setPeriod(e.target.value as "FY" | "CY")}>
                <option value="FY">Financial year (Apr-Mar)</option>
                <option value="CY">Calendar year (Jan-Dec)</option>
              </select>
            </Field>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[#F8FAF9] p-3">
            <p className="mb-2 text-xs font-semibold text-[var(--navy)]">First user (optional)</p>
            <div className="space-y-3">
              <Field label="Email address" error={emailInvalid ? "Enter a valid email address" : undefined}>
                <input type="email" className={INPUT} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@company.com" autoComplete="off" />
              </Field>
              {emailEntered && (
                <Field label="Role">
                  <select className={INPUT} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as ClientRole)}>
                    {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={SECONDARY_BTN} disabled={submitting}>Cancel</button>
            <button type="submit" className={PRIMARY_BTN} disabled={!canSubmit}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create client
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
