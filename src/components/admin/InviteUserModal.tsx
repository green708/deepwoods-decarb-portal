import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, INPUT, PRIMARY_BTN, SECONDARY_BTN } from "@/components/admin/ui";

export type ClientRole = "sustainability_team" | "client_uploader" | "client_leadership";

export const ROLE_LABEL: Record<ClientRole, string> = {
  sustainability_team: "ESG Manager (full access)",
  client_uploader: "Data contributor",
  client_leadership: "Viewer (read-only)",
};

export const ROLE_HINT: Record<ClientRole, string> = {
  sustainability_team: "Full portal access: submit data, manage setup, view all results.",
  client_uploader: "Can submit and edit data only.",
  client_leadership: "Can view dashboards and reports, cannot change anything.",
};

export const ROLE_OPTIONS = (Object.keys(ROLE_LABEL) as ClientRole[]).map((value) => ({ value, label: ROLE_LABEL[value] }));

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  };
  return (
    <button type="button" onClick={copy} className={SECONDARY_BTN + " !px-3 !py-1.5 !text-xs"} aria-label={label}>
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export interface CredentialsInfo {
  title: string;
  description?: string;
  email: string;
  tempPassword: string | null;
  emailSent: boolean | null;
  emailNote?: string | null;
}

export function CredentialsDialog({ info, onClose, children }: { info: CredentialsInfo; onClose: () => void; children?: ReactNode }) {
  const emailState =
    info.emailSent === true
      ? { cls: "border-[#C5E4D0] bg-[#F0FAF5] text-[#1E6F5C]", text: "A welcome email with these credentials was sent." }
      : info.emailSent === false
        ? { cls: "border-amber-200 bg-amber-50 text-amber-800", text: "No email was sent. Share these credentials with the user yourself." }
        : null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-base text-[var(--navy)]">{info.title}</DialogTitle>
          {info.description && <DialogDescription>{info.description}</DialogDescription>}
        </DialogHeader>
        {emailState && <div className={`rounded-lg border px-3 py-2 text-xs ${emailState.cls}`}>{emailState.text}{info.emailNote ? ` ${info.emailNote}` : ""}</div>}
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold text-[var(--navy)]">Login email</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-50 px-3 py-2 text-sm text-[var(--navy)]">{info.email}</code>
              <CopyButton value={info.email} label="Copy email" />
            </div>
          </div>
          {info.tempPassword ? (
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--navy)]">Temporary password</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm font-semibold text-[var(--navy)]">{info.tempPassword}</code>
                <CopyButton value={info.tempPassword} label="Copy temporary password" />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">Shown once. The user must change it at first sign in. Close this window only after you have saved it.</p>
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted-foreground">No temporary password was generated because the account already existed.</p>
          )}
        </div>
        {children}
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={PRIMARY_BTN}>Done</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteUserModal({ clientId, clientName, onClose }: { clientId: number; clientName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ClientRole>("sustainability_team");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<CredentialsInfo | null>(null);

  const emailInvalid = touched && !EMAIL_RE.test(email.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!EMAIL_RE.test(email.trim())) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch("invite-user.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          email: email.trim(),
          role,
          ...(name.trim() ? { display_name: name.trim() } : {}),
        }),
      });
      qc.invalidateQueries({ queryKey: ["admin-client-users", clientId] });
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
      setResult({
        title: "User invited",
        description: `${res.email} can now sign in to ${clientName}.`,
        email: res.email,
        tempPassword: res.temp_password ?? null,
        emailSent: !!res.email_sent,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) return <CredentialsDialog info={result} onClose={onClose} />;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-[var(--navy)]">Invite user</DialogTitle>
          <DialogDescription>Create a login for {clientName}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email address" error={emailInvalid ? "Enter a valid email address" : undefined}>
            <input type="email" className={INPUT} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} placeholder="name@company.com" autoComplete="off" autoFocus />
          </Field>
          <Field label="Name (optional)" hint="Shown in the portal greeting.">
            <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Asha Rao" autoComplete="off" />
          </Field>
          <Field label="Role" hint={ROLE_HINT[role]}>
            <select className={INPUT} value={role} onChange={(e) => setRole(e.target.value as ClientRole)}>
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">A temporary password is generated and shown on the next screen. The user must change it at first sign in.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={SECONDARY_BTN} disabled={submitting}>Cancel</button>
            <button type="submit" className={PRIMARY_BTN} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Send invite
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
