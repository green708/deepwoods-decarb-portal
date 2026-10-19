import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, HardDriveUpload, KeyRound, Link2, Link2Off, Loader2, Pencil, Save, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth";
import { useAdminClientSettings, useAdminClientUserAction, useAdminClientUsers, useAdminPortfolio, type AdminClientUser } from "@/lib/api-admin";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  DANGER_BTN, EmptyHint, ErrorNote, Field, INPUT, PaymentPill, Pill, PRIMARY_BTN, SECONDARY_BTN, Section, Spinner,
  fmtDate, timeAgo, useClientEntityList, type ClientTabProps,
} from "@/components/admin/ui";
import { CredentialsDialog, InviteUserModal, ROLE_HINT, ROLE_LABEL, ROLE_OPTIONS, type ClientRole, type CredentialsInfo } from "@/components/admin/InviteUserModal";
import { InvoiceModal, useClientPayment } from "@/components/admin/InvoiceModal";

const TH = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap";
const TD = "px-3 py-2.5 align-middle text-sm text-[var(--navy)]";
const ORG_TYPES = ["Private Limited", "Public Limited", "LLP", "Partnership", "Sole Proprietorship", "Trust / NGO", "Government Body", "Other"];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

interface AdminEntity {
  id: number;
  client_id: number;
  client_name: string;
  client_slug: string;
  code: string;
  entity_name: string;
  short_name: string;
  is_consolidated: boolean;
  legal_address: string | null;
  org_type: string;
  code_duplicate: boolean;
}

function plainRoles(msg: string): string {
  return msg.replace(/sustainability_team|client_uploader|client_leadership/g, (m) => ROLE_LABEL[m as ClientRole]);
}

type FieldsErr = Error & { fields?: Record<string, string> };

function updateClientUser(body: { client_id: number; user_id: number; display_name: string | null; role: ClientRole; entity_scope: string | null }) {
  return authFetch("admin/client-users.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, action: "update" }),
  });
}

function ConfirmDialog({ title, description, confirmLabel, danger, busy, error, onConfirm, onClose }: {
  title: string; description: ReactNode; confirmLabel: string; danger?: boolean; busy: boolean; error?: string | null; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-[var(--navy)]">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY_BTN} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={danger ? DANGER_BTN : PRIMARY_BTN} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-0.5 text-[11px] font-semibold text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-[var(--navy)]">{children}</dd>
    </div>
  );
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";
}

// ── Account ───────────────────────────────────────────────────────────────────

function AccountSection({ clientId, clientName, isAdmin }: Pick<ClientTabProps, "clientId" | "clientName" | "isAdmin">) {
  const qc = useQueryClient();
  const settings = useAdminClientSettings(clientId);
  const payment = useClientPayment(clientId, isAdmin);
  const portfolio = useAdminPortfolio({ q: settings.data?.client.slug, per_page: 5 });
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const setActive = useMutation({
    mutationFn: (active: boolean) =>
      authFetch("activate-client.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, active }) }),
    onSuccess: (_d, active) => {
      toast.success(active ? "Client activated" : "Client deactivated");
      setConfirmDeactivate(false);
      qc.invalidateQueries({ queryKey: ["admin-client-settings", clientId] });
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
      qc.invalidateQueries({ queryKey: ["activation-clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const c = settings.data?.client;
  const plan = portfolio.data?.clients.find((p) => p.id === clientId)?.plan ?? null;
  const pay = payment.data;

  return (
    <Section
      title="Account"
      description="Whether the client can sign in, and whether payment has been recorded."
      right={isAdmin && c ? (
        <button type="button" className={SECONDARY_BTN} onClick={() => setInvoiceOpen(true)}>
          <Pencil className="h-4 w-4" /> Edit payment details
        </button>
      ) : undefined}
    >
      {settings.isLoading ? <Spinner /> : settings.error ? <ErrorNote error={settings.error} /> : c && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[#F8FAF9] px-4 py-3">
            <div className="flex items-center gap-3">
              <Switch
                id={`active-${clientId}`}
                checked={c.is_active}
                disabled={!isAdmin || setActive.isPending}
                aria-label="Client portal access"
                onCheckedChange={(v) => { if (v) setActive.mutate(true); else setConfirmDeactivate(true); }}
              />
              <label htmlFor={`active-${clientId}`} className="text-sm">
                <span className="font-semibold text-[var(--navy)]">{c.is_active ? "Portal access is on" : "Portal access is off"}</span>
                <span className="block text-xs text-muted-foreground">
                  {c.is_active ? "Client users can sign in." : "Client users cannot sign in until the account is activated."}
                </span>
              </label>
            </div>
            {!isAdmin && <span className="text-xs text-muted-foreground">Only an administrator can change this.</span>}
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
            <Fact label="Payment"><PaymentPill status={c.payment_status} /></Fact>
            <Fact label="Account status">{c.is_active ? <Pill tone="green">Active</Pill> : <Pill>Inactive</Pill>}</Fact>
            <Fact label="Plan">{plan ? <span className="capitalize">{plan}</span> : "—"}</Fact>
            <Fact label="Reporting period">{c.reporting_period === "CY" ? "Calendar year (CY)" : "Financial year (FY)"}</Fact>
            <Fact label="Current reporting year">{settings.data?.fy ?? "—"}</Fact>
            <Fact label="Account owner">{c.account_owner ?? "Unassigned"}</Fact>
            {isAdmin && (
              <>
                <Fact label="Invoice reference">{payment.isLoading ? "…" : pay?.invoice_ref || "—"}</Fact>
                <Fact label="Payment date">{payment.isLoading ? "…" : fmtDate(pay?.payment_date)}</Fact>
                {pay?.payment_notes && <div className="col-span-full"><Fact label="Payment notes"><span className="whitespace-pre-wrap">{pay.payment_notes}</span></Fact></div>}
              </>
            )}
          </dl>
          {isAdmin && payment.error && <ErrorNote error={payment.error} />}
        </div>
      )}
      {invoiceOpen && <InvoiceModal clientId={clientId} clientName={clientName} onClose={() => setInvoiceOpen(false)} />}
      {confirmDeactivate && (
        <ConfirmDialog
          title="Deactivate this client?"
          description={`${clientName} users will not be able to sign in until you activate the account again. No data is deleted.`}
          confirmLabel="Deactivate"
          danger
          busy={setActive.isPending}
          onConfirm={() => setActive.mutate(false)}
          onClose={() => setConfirmDeactivate(false)}
        />
      )}
    </Section>
  );
}

// ── Entities ──────────────────────────────────────────────────────────────────

function EntityRow({ ent, all, clientId }: { ent: AdminEntity; all: AdminEntity[]; clientId: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(ent.code);
  const [name, setName] = useState(ent.short_name || ent.entity_name);
  const [orgType, setOrgType] = useState(ent.org_type);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const res = await authFetch("admin-entities.php", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ent.id, code, short_name: name.trim(), org_type: orgType.trim() }) });
      if (!res || res.id == null) throw new Error("(500) no confirmation");
      return res;
    },
    onSuccess: () => {
      toast.success("Entity updated");
      setEditing(false);
      setError(null);
      qc.invalidateQueries({ queryKey: ["admin-entities"] });
      qc.invalidateQueries({ queryKey: ["admin-cycles", clientId] });
      qc.invalidateQueries({ queryKey: ["admin-calc-status", clientId] });
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
    },
    onError: (e: Error) =>
      setError(/\(500\)/.test(e.message) ? "The server could not save this entity. Check that the organisation type is supported by the database." : e.message),
  });

  const start = () => {
    setCode(ent.code);
    setName(ent.short_name || ent.entity_name);
    setOrgType(ent.org_type);
    setError(null);
    setEditing(true);
  };

  const otherClients = useMemo(
    () => (editing && code && code !== ent.code ? all.filter((e) => e.client_id !== ent.client_id && e.code === code) : []),
    [all, code, editing, ent.client_id, ent.code],
  );
  const orgTypeOptions = ORG_TYPES.includes(ent.org_type) || !ent.org_type ? ORG_TYPES : [...ORG_TYPES, ent.org_type];
  const siblingClash = editing && code !== ent.code && all.some((e) => e.client_id === ent.client_id && e.id !== ent.id && e.code === code);

  if (!editing) {
    return (
      <tr className="border-t border-[var(--border)]">
        <td className={TD}>
          <span className="rounded bg-[#EFF6FF] px-2 py-0.5 font-mono text-xs font-bold text-sky-700">{ent.code}</span>
          {ent.code_duplicate && <span className="ml-2 align-middle"><Pill tone="amber">Code also used by another client</Pill></span>}
        </td>
        <td className={TD}>
          {ent.short_name || ent.entity_name}
          {ent.short_name && ent.short_name !== ent.entity_name && <span className="block text-xs text-muted-foreground">{ent.entity_name}</span>}
        </td>
        <td className={TD + " text-muted-foreground"}>{ent.org_type || "—"}</td>
        <td className={TD}>{ent.is_consolidated ? <Pill tone="blue">Consolidated</Pill> : <Pill>Reporting entity</Pill>}</td>
        <td className={TD + " text-right"}>
          <button type="button" className={SECONDARY_BTN + " !px-2.5 !py-1.5"} onClick={start} aria-label={`Edit entity ${ent.code}`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-[var(--border)] bg-[#F8FAF9]">
      <td className={TD} colSpan={5}>
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent) => { e.preventDefault(); if (code && !save.isPending) save.mutate(); }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Entity code" hint="Letters and numbers, up to 10.">
              <input className={INPUT + " font-mono uppercase"} value={code} maxLength={10} autoFocus onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
            </Field>
            <Field label="Short name">
              <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" maxLength={100} />
            </Field>
            <Field label="Organisation type">
              <select className={INPUT} value={orgType} onChange={(e) => setOrgType(e.target.value)}>
                <option value="">Not set</option>
                {orgTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          {code !== ent.code && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Changing a code that already has submitted data can detach existing records from this entity. Facility IDs are updated, other records are not.
            </p>
          )}
          {otherClients.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              The code {code} is also used by {otherClients.map((e) => e.client_name).join(", ")}. Codes should be distinct across clients.
            </p>
          )}
          {siblingClash && <p className="text-xs text-red-600">Another entity of this client already uses {code}.</p>}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
          <div className="flex gap-2">
            <button type="submit" className={PRIMARY_BTN} disabled={!code || siblingClash || save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </button>
            <button type="button" className={SECONDARY_BTN} onClick={() => setEditing(false)} disabled={save.isPending}>Cancel</button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function EntitiesSection({ clientId }: { clientId: number }) {
  const { data, isLoading, error, refetch } = useQuery<AdminEntity[]>({
    queryKey: ["admin-entities", clientId],
    queryFn: async () => {
      const rows: AdminEntity[] = await authFetch(`admin-entities.php?client_id=${clientId}`);
      return rows.map((r) => ({ ...r, id: Number(r.id), client_id: Number(r.client_id), is_consolidated: Boolean(Number(r.is_consolidated)), code_duplicate: Boolean(r.code_duplicate) }));
    },
    staleTime: 60 * 1000,
  });
  const mine = useMemo(() => (data ?? []).filter((e) => e.client_id === clientId), [data, clientId]);
  const dupes = mine.filter((e) => e.code_duplicate).length;

  return (
    <Section title="Entities and codes" description="The code identifies the entity in facility and asset IDs and must stay unique per client.">
      {isLoading ? <Spinner /> : error ? (
        <div className="space-y-2"><ErrorNote error={error} /><button type="button" className={SECONDARY_BTN} onClick={() => refetch()}>Retry</button></div>
      ) : mine.length === 0 ? (
        <EmptyHint title="No entities yet">The client creates its entities in its own setup wizard.</EmptyHint>
      ) : (
        <div className="space-y-3">
          {dupes > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {dupes} code{dupes > 1 ? "s are" : " is"} also used by another client. Edit {dupes > 1 ? "them" : "it"} so each client has distinct codes.
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full min-w-[640px]">
              <thead className="bg-[#F9FAFB]">
                <tr><th className={TH}>Code</th><th className={TH}>Name</th><th className={TH}>Organisation type</th><th className={TH}>Kind</th><th className={TH}><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>{mine.map((ent) => <EntityRow key={ent.id} ent={ent} all={data ?? []} clientId={clientId} />)}</tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}

// ── Branding ──────────────────────────────────────────────────────────────────

function validateLogo(url: string): string | null {
  const v = url.trim();
  if (!v) return null;
  if (v.length > 500) return "Logo URL must be 500 characters or fewer";
  if (v.startsWith("data:")) return "Paste a link to the image, not the image data";
  if (!/^(https?:\/\/\S+|\/\S+)$/i.test(v)) return "Use a full https:// link, or a path starting with /";
  return null;
}

function BrandingForm({ clientId, clientName, logo, color, isAdmin }: { clientId: number; clientName: string; logo: string; color: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [logoUrl, setLogoUrl] = useState(logo);
  const [hex, setHex] = useState(color);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => { setImgFailed(false); }, [logoUrl]);

  const logoError = validateLogo(logoUrl);
  const hexError = HEX_RE.test(hex) ? null : "Use a 6-digit hex colour such as #1E6F5C";
  const dirty = logoUrl.trim() !== logo || hex.toLowerCase() !== color.toLowerCase();
  const previewColor = hexError ? color : hex;

  const save = useMutation({
    mutationFn: () =>
      authFetch("branding.php", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, logo_url: logoUrl.trim() || null, primary_color: hex }) }),
    onSuccess: () => {
      toast.success("Branding updated");
      qc.invalidateQueries({ queryKey: ["admin-client-settings", clientId] });
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form className="grid grid-cols-1 gap-6 lg:grid-cols-2" onSubmit={(e: FormEvent) => { e.preventDefault(); if (!logoError && !hexError && dirty) save.mutate(); }}>
      <div className="space-y-4">
        <Field label="Logo URL" error={logoError ?? undefined} hint="Link to a PNG, SVG or JPG. Shown in the client's sidebar and reports.">
          <input className={INPUT} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" disabled={!isAdmin} inputMode="url" />
        </Field>
        <Field label="Primary colour" error={hexError ?? undefined}>
          <div className="flex items-center gap-3">
            <input type="color" aria-label="Pick primary colour" className="h-9 w-14 cursor-pointer rounded-lg border border-[var(--border)] bg-white p-1 disabled:cursor-not-allowed" value={HEX_RE.test(hex) ? hex : color} onChange={(e) => setHex(e.target.value.toUpperCase())} disabled={!isAdmin} />
            <input className={INPUT + " w-32 font-mono"} value={hex} onChange={(e) => setHex(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)} maxLength={7} placeholder="#1E6F5C" disabled={!isAdmin} />
          </div>
        </Field>
        {isAdmin ? (
          <div className="flex gap-2">
            <button type="submit" className={PRIMARY_BTN} disabled={!dirty || !!logoError || !!hexError || save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save branding
            </button>
            <button type="button" className={SECONDARY_BTN} onClick={() => { setLogoUrl(logo); setHex(color); }} disabled={!dirty || save.isPending}>Reset</button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Only an administrator can change branding.</p>
        )}
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--navy)]">Preview</p>
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[#F9FAFB] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-white">
              {logoUrl.trim() && !logoError && !imgFailed ? (
                <img src={logoUrl.trim()} alt="" className="h-full w-full object-contain" onError={() => setImgFailed(true)} />
              ) : (
                <span className="text-sm font-bold" style={{ color: previewColor }}>{initials(clientName)}</span>
              )}
            </div>
            <span className="text-sm font-semibold text-[var(--navy)]">{clientName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: previewColor }}>Active menu item</span>
            <span className="h-1 w-16 rounded-full" style={{ background: previewColor }} />
          </div>
          {imgFailed && <p className="text-xs text-amber-700">The image could not be loaded from this link. The initials are shown instead.</p>}
          {!logoUrl.trim() && <p className="text-xs text-muted-foreground">No logo set. Initials are shown.</p>}
        </div>
      </div>
    </form>
  );
}

function BrandingSection({ clientId, clientName, isAdmin }: Pick<ClientTabProps, "clientId" | "clientName" | "isAdmin">) {
  const { data, isLoading, error } = useAdminClientSettings(clientId);
  const logo = data?.client.logo_url ?? "";
  const color = data?.client.primary_color && HEX_RE.test(data.client.primary_color) ? data.client.primary_color : "#1E6F5C";
  return (
    <Section title="Branding" description="Logo and accent colour used in the client's portal.">
      {isLoading ? <Spinner /> : error ? <ErrorNote error={error} /> : data && (
        <BrandingForm key={`${logo}|${color}`} clientId={clientId} clientName={clientName} logo={logo} color={color} isAdmin={isAdmin} />
      )}
    </Section>
  );
}

// ── Google Drive ──────────────────────────────────────────────────────────────

interface DriveStatus { connected: boolean; has_folder: boolean; folder_id: string | null }

function DriveSection({ clientId }: { clientId: number }) {
  const { data, isLoading, error, refetch } = useQuery<DriveStatus>({
    queryKey: ["drive-status", clientId],
    queryFn: () => authFetch(`ghg/drive-status.php?client_id=${clientId}`),
    staleTime: 15 * 1000,
  });
  const [connecting, setConnecting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      const res = await authFetch(`ghg/drive-connect.php?client_id=${clientId}`);
      const popup = window.open(res.auth_url, "driveConnect", "width=600,height=700,left=300,top=100");
      if (!popup) {
        toast.error("The sign-in window was blocked. Allow pop-ups for this site and try again.");
        setConnecting(false);
        return;
      }
      timer.current = setInterval(async () => {
        if (!popup.closed) return;
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        const fresh = await refetch();
        setConnecting(false);
        if (fresh.data?.connected) toast.success("Google Drive is connected");
        else toast.warning("The window was closed but Drive is still not connected.");
      }, 800);
    } catch (e) {
      setConnecting(false);
      toast.error(e instanceof Error ? e.message : "Could not start the Google Drive connection");
    }
  };

  return (
    <Section title="Google Drive" description="Evidence uploaded by this client is stored in Drive using the connected Deepwoods Google account.">
      {isLoading ? <Spinner /> : error ? (
        <div className="space-y-2"><ErrorNote error={error} /><button type="button" className={SECONDARY_BTN} onClick={() => refetch()}>Retry</button></div>
      ) : data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {data.connected
                ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EF] px-2.5 py-1 text-[11px] font-semibold text-[#1E6F5C]"><Link2 className="h-3 w-3" /> Connected</span>
                : <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"><Link2Off className="h-3 w-3" /> Not connected</span>}
              <span className="text-xs text-muted-foreground">{data.has_folder ? `Root folder: ${data.folder_id}` : "No root folder configured yet"}</span>
            </div>
            <button type="button" className={PRIMARY_BTN} onClick={connect} disabled={connecting}>
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDriveUpload className="h-4 w-4" />}
              {connecting ? "Waiting for sign-in…" : data.connected ? "Reconnect" : "Connect Google account"}
            </button>
          </div>
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Sign in with the Deepwoods Google account that owns this client's Drive folder. Different clients can use different accounts.
          </p>
        </div>
      )}
    </Section>
  );
}

// ── Users ─────────────────────────────────────────────────────────────────────

function EditUserDialog({ user, clientId, entities, onClose }: {
  user: AdminClientUser; clientId: number; entities: { code: string; name: string }[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(user.display_name ?? "");
  const [role, setRole] = useState<ClientRole>(user.role);
  const [scope, setScope] = useState(user.entity_scope ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const scopeOptions = useMemo(() => {
    const list = [...entities];
    if (user.entity_scope && !list.some((e) => e.code === user.entity_scope)) list.push({ code: user.entity_scope, name: user.entity_scope });
    return list;
  }, [entities, user.entity_scope]);

  const save = useMutation({
    mutationFn: () => updateClientUser({ client_id: clientId, user_id: user.id, display_name: name.trim() || null, role, entity_scope: scope || null }),
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["admin-client-users", clientId] });
      onClose();
    },
    onError: (e: Error) => {
      const f = (e as FieldsErr).fields;
      if (f && Object.keys(f).length) {
        setFields(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, plainRoles(v)])));
        setError(null);
      } else { setFields({}); setError(plainRoles(e.message)); }
    },
  });

  const unchanged = (user.display_name ?? "") === name.trim() && user.role === role && (user.entity_scope ?? "") === scope;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base text-[var(--navy)]">Edit user</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); if (!unchanged) save.mutate(); }}>
          <Field label="Name" error={fields.display_name}>
            <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Not set" />
          </Field>
          <Field label="Role" error={fields.role} hint={ROLE_HINT[role]}>
            <select className={INPUT} value={role} onChange={(e) => setRole(e.target.value as ClientRole)}>
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Entity access" error={fields.entity_scope} hint="Limit this user to one entity, or leave on all entities.">
            <select className={INPUT} value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="">All entities</option>
              {scopeOptions.map((e) => <option key={e.code} value={e.code}>{e.name} ({e.code})</option>)}
            </select>
          </Field>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className={SECONDARY_BTN} onClick={onClose} disabled={save.isPending}>Cancel</button>
            <button type="submit" className={PRIMARY_BTN} disabled={unchanged || save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UsersSection({ clientId, clientName, fy, isAdmin }: Pick<ClientTabProps, "clientId" | "clientName" | "fy" | "isAdmin">) {
  const { data, isLoading, error, refetch } = useAdminClientUsers(clientId);
  const { entities } = useClientEntityList(clientId, fy);
  const userAction = useAdminClientUserAction();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminClientUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminClientUser | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminClientUser | null>(null);
  const [creds, setCreds] = useState<CredentialsInfo | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const entityName = (code: string | null) => {
    if (!code) return "All entities";
    const e = entities.find((x) => x.code === code);
    return e ? `${e.name} (${code})` : code;
  };

  const doReset = () => {
    if (!resetTarget) return;
    setActionError(null);
    userAction.mutate(
      { client_id: clientId, action: "reset_password", user_id: resetTarget.id },
      {
        onSuccess: (res) => {
          setCreds({
            title: "Password reset",
            description: `${resetTarget.email} was signed out everywhere and must choose a new password at next sign in.`,
            email: resetTarget.email,
            tempPassword: res.temp_password ?? null,
            emailSent: null,
          });
          setResetTarget(null);
        },
        onError: (e) => setActionError(plainRoles(e.message)),
      },
    );
  };

  const doRemove = () => {
    if (!removeTarget) return;
    setActionError(null);
    userAction.mutate(
      { client_id: clientId, action: "remove", user_id: removeTarget.id },
      {
        onSuccess: () => { toast.success(`${removeTarget.email} removed`); setRemoveTarget(null); },
        onError: (e) => setActionError(plainRoles(e.message)),
      },
    );
  };

  const users = data?.users ?? [];

  return (
    <Section
      title="Users"
      description="People who can sign in to this client's portal."
      right={<button type="button" className={PRIMARY_BTN} onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Invite user</button>}
    >
      {isLoading ? <Spinner /> : error ? (
        <div className="space-y-2"><ErrorNote error={error} /><button type="button" className={SECONDARY_BTN} onClick={() => refetch()}>Retry</button></div>
      ) : users.length === 0 ? (
        <EmptyHint title="No users yet">Invite the client's first ESG Manager so they can sign in and complete setup.</EmptyHint>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full min-w-[760px]">
            <thead className="bg-[#F9FAFB]">
              <tr><th className={TH}>User</th><th className={TH}>Role</th><th className={TH}>Entity access</th><th className={TH}>Last sign in</th><th className={TH}>Status</th><th className={TH}><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]">
                  <td className={TD}>
                    <span className="block font-semibold">{u.display_name || <span className="font-normal text-muted-foreground">No name</span>}</span>
                    <span className="block break-all text-xs text-muted-foreground">{u.email}</span>
                  </td>
                  <td className={TD}>{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td className={TD + " text-muted-foreground"}>{entityName(u.entity_scope)}</td>
                  <td className={TD + " whitespace-nowrap text-muted-foreground"}>{timeAgo(u.last_login)}</td>
                  <td className={TD}>{u.must_change_password ? <Pill tone="amber">Password not changed</Pill> : <Pill tone="green">Active</Pill>}</td>
                  <td className={TD}>
                    <div className="flex justify-end gap-1.5">
                      <button type="button" className={SECONDARY_BTN + " !px-2.5 !py-1.5"} onClick={() => setEditUser(u)} aria-label={`Edit ${u.email}`} title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" className={SECONDARY_BTN + " !px-2.5 !py-1.5"} onClick={() => { setActionError(null); setResetTarget(u); }} aria-label={`Reset password for ${u.email}`} title="Reset password"><KeyRound className="h-3.5 w-3.5" /></button>
                      {isAdmin && <button type="button" className={DANGER_BTN + " !px-2.5 !py-1.5"} onClick={() => { setActionError(null); setRemoveTarget(u); }} aria-label={`Remove ${u.email}`} title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inviteOpen && <InviteUserModal clientId={clientId} clientName={clientName} onClose={() => setInviteOpen(false)} />}
      {editUser && <EditUserDialog user={editUser} clientId={clientId} entities={entities} onClose={() => setEditUser(null)} />}
      {resetTarget && (
        <ConfirmDialog
          title="Reset password?"
          description={`${resetTarget.email} will be signed out everywhere and given a new temporary password, which you will see once on the next screen.`}
          confirmLabel="Reset password"
          busy={userAction.isPending}
          error={actionError}
          onConfirm={doReset}
          onClose={() => setResetTarget(null)}
        />
      )}
      {removeTarget && (
        <ConfirmDialog
          title="Remove this user?"
          description={`${removeTarget.email} will lose access immediately. The last ESG Manager of a client cannot be removed.`}
          confirmLabel="Remove user"
          danger
          busy={userAction.isPending}
          error={actionError}
          onConfirm={doRemove}
          onClose={() => setRemoveTarget(null)}
        />
      )}
      {creds && <CredentialsDialog info={creds} onClose={() => setCreds(null)} />}
    </Section>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export function SetupTab({ clientId, clientName, fy, isAdmin }: ClientTabProps) {
  return (
    <div className="space-y-5">
      <AccountSection clientId={clientId} clientName={clientName} isAdmin={isAdmin} />
      <EntitiesSection clientId={clientId} />
      <UsersSection clientId={clientId} clientName={clientName} fy={fy} isAdmin={isAdmin} />
      <BrandingSection clientId={clientId} clientName={clientName} isAdmin={isAdmin} />
      <DriveSection clientId={clientId} />
    </div>
  );
}
