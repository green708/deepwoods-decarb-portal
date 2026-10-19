import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminClientSettings, type AdminClientSettings } from "@/lib/api-admin";
import {
  DANGER_BTN, ErrorNote, Field, INPUT, PRIMARY_BTN, SECONDARY_BTN, Section, Spinner, fyOptions, type ClientTabProps,
} from "@/components/admin/ui";
import { FieldsError, sendJson } from "@/components/admin/f4-api";
import { SETTING_LABEL } from "@/components/admin/f4-activity";
import { ConfirmDialog } from "@/components/admin/f4-confirm";
import { ActionPlanSection } from "@/components/admin/TargetsPlanTab.actions";
import { ScreeningSection } from "@/components/admin/TargetsPlanTab.screening";

type SettingType = "percent" | "year" | "fy_label" | "basis" | "email" | "short" | "text";

const TYPE_OF: Record<string, SettingType> = {
  base_year_s12: "fy_label", base_year_s3: "fy_label",
  sbti_target_s12: "percent", sbti_target_s3: "percent", renewable_target_pct: "percent",
  sbti_target_year: "year", netzero_year: "year",
  target_basis: "basis", residual_strategy: "text",
  consultant_name: "short", consultant_phone: "short", consultant_email: "email", support_email: "email",
};

const TARGET_KEYS = [
  "base_year_s12", "sbti_target_s12", "sbti_target_year",
  "base_year_s3", "sbti_target_s3",
  "netzero_year", "target_basis", "renewable_target_pct", "residual_strategy",
] as const;
const CONTACT_KEYS = ["consultant_name", "consultant_email", "consultant_phone", "support_email"] as const;

export function validateSetting(type: SettingType, raw: string): string | null {
  const v = raw.trim();
  if (v === "") return null;
  switch (type) {
    case "percent": {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 100 ? null : "Enter a number between 0 and 100";
    }
    case "year":
      return /^\d{4}$/.test(v) && +v >= 2000 && +v <= 2100 ? null : "Enter a year between 2000 and 2100";
    case "fy_label":
      return /^(FY\d{2}|FY\d{4}|CY\d{4})$/.test(v) ? null : "Use a label like FY26 or CY2025";
    case "basis":
      return v === "market" || v === "location" ? null : "Choose market-based or location-based";
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Enter a valid email address";
    case "short":
      return v.length <= 120 ? null : "Too long (max 120 characters)";
    case "text":
      return v.length <= 2000 ? null : "Too long (max 2000 characters)";
  }
}

function useSaveSettings(clientId: number) {
  const qc = useQueryClient();
  return useMutation<AdminClientSettings, FieldsError, { settings: Record<string, string | null>; account_owner?: string | null }>({
    mutationFn: (body) => sendJson<AdminClientSettings>("admin/client-settings.php", "POST", { client_id: clientId, ...body }),
    onSuccess: (data) => {
      qc.setQueryData(["admin-client-settings", clientId], data);
      qc.invalidateQueries({ queryKey: ["admin-client-settings", clientId] });
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
      qc.invalidateQueries({ queryKey: ["admin-activity"] });
    },
  });
}

/** Local edit state for a group of client_config keys, reset whenever the saved values change. */
function useSettingsForm(keys: readonly string[], saved: Record<string, string | null> | undefined) {
  const baseline = useMemo(() => {
    const o: Record<string, string> = {};
    keys.forEach((k) => { o[k] = saved?.[k] ?? ""; });
    return o;
  }, [keys, saved]);
  const baselineKey = JSON.stringify(baseline);
  const [values, setValues] = useState<Record<string, string>>(baseline);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  useEffect(() => { setValues(baseline); setServerErrors({}); }, [baselineKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: string) => {
    setValues((p) => ({ ...p, [k]: v }));
    setServerErrors((p) => { if (!p[k]) return p; const n = { ...p }; delete n[k]; return n; });
  };
  const changed = keys.filter((k) => values[k].trim() !== baseline[k].trim());
  const errors: Record<string, string> = {};
  keys.forEach((k) => {
    const e = serverErrors[k] ?? (TYPE_OF[k] ? validateSetting(TYPE_OF[k], values[k]) : null);
    if (e) errors[k] = e;
  });
  return { values, set, changed, errors, baseline, discard: () => { setValues(baseline); setServerErrors({}); }, setServerErrors };
}

function FieldInput({
  name, label, hint, values, set, errors, disabled, type = "text", placeholder, list, inputMode,
}: {
  name: string; label: string; hint?: string; values: Record<string, string>; set: (k: string, v: string) => void;
  errors: Record<string, string>; disabled?: boolean; type?: string; placeholder?: string; list?: string; inputMode?: "numeric" | "decimal" | "email" | "tel";
}) {
  return (
    <Field label={label} hint={hint} error={errors[name]}>
      <input
        className={`${INPUT} ${errors[name] ? "!border-red-400" : ""}`}
        type={type}
        value={values[name]}
        onChange={(e) => set(name, e.target.value)}
        placeholder={placeholder}
        list={list}
        inputMode={inputMode}
        disabled={disabled}
        aria-invalid={!!errors[name]}
      />
    </Field>
  );
}

function SaveBar({ dirty, invalid, pending, onSave, onDiscard, extra }: {
  dirty: boolean; invalid: boolean; pending: boolean; onSave: () => void; onDiscard: () => void; extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
      <button type="button" className={PRIMARY_BTN} disabled={!dirty || invalid || pending} onClick={onSave}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
      </button>
      <button type="button" className={SECONDARY_BTN} disabled={!dirty || pending} onClick={onDiscard}>Discard</button>
      {dirty && invalid && <span className="text-xs text-red-600">Fix the highlighted fields to save.</span>}
      {dirty && !invalid && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
      <div className="ml-auto">{extra}</div>
    </div>
  );
}

function TargetsSection({ clientId, fy, reportingPeriod, data }: { clientId: number; fy: string; reportingPeriod: "FY" | "CY"; data: AdminClientSettings }) {
  const save = useSaveSettings(clientId);
  const form = useSettingsForm(TARGET_KEYS, data.settings);
  const [confirmClear, setConfirmClear] = useState(false);
  const unset = !data.settings.sbti_target_s12;
  const d = data.defaults;
  const hasAny = TARGET_KEYS.some((k) => !!data.settings[k]);
  const years = useMemo(() => fyOptions(reportingPeriod, data.fy || fy, 10, 0), [reportingPeriod, data.fy, fy]);
  const invalid = Object.keys(form.errors).length > 0;

  const nzBeforeTarget = form.values.netzero_year && form.values.sbti_target_year && +form.values.netzero_year < +form.values.sbti_target_year;

  const doSave = (payload: Record<string, string | null>, done?: () => void) => {
    save.mutate({ settings: payload }, {
      onSuccess: () => { toast.success("Targets saved"); done?.(); },
      onError: (e) => {
        if (Object.keys(e.fields).length) form.setServerErrors(e.fields);
        toast.error(Object.keys(e.fields).length ? "Some targets were rejected. Check the highlighted fields." : e.message);
      },
    });
  };

  const submit = () => {
    const payload: Record<string, string | null> = {};
    form.changed.forEach((k) => { payload[k] = form.values[k].trim() === "" ? null : form.values[k].trim(); });
    doSave(payload);
  };

  const clearAll = () => {
    const payload: Record<string, string | null> = {};
    TARGET_KEYS.forEach((k) => { if (data.settings[k]) payload[k] = null; });
    doSave(payload, () => setConfirmClear(false));
  };

  const defaultsText = [
    d.sbti_target_s12 && `${d.sbti_target_s12}% reduction`,
    d.sbti_target_year && `by ${d.sbti_target_year}`,
    d.base_year_s12 && `from base year ${d.base_year_s12}`,
    d.netzero_year && `net zero ${d.netzero_year}`,
  ].filter(Boolean).join(", ");

  const common = { values: form.values, set: form.set, errors: form.errors };

  return (
    <Section
      title="Targets and net zero"
      description="These values drive the targets this client sees on its Home and Progress pages. Leave a field empty to fall back to the platform default."
    >
      {unset && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          No target configured. This client currently sees platform defaults{defaultsText ? ` (${defaultsText})` : ""}. Set a target below once it is agreed.
        </div>
      )}
      <datalist id={`years-${clientId}`}>{years.map((y) => <option key={y} value={y} />)}</datalist>
      <div className="space-y-5">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Scope 1 and 2</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldInput {...common} name="base_year_s12" label={SETTING_LABEL.base_year_s12} list={`years-${clientId}`} placeholder={d.base_year_s12 ? `Default ${d.base_year_s12}` : "e.g. FY22"} hint="Reporting year emissions are measured against" />
            <FieldInput {...common} name="sbti_target_s12" label="Reduction target (%)" inputMode="decimal" placeholder={d.sbti_target_s12 ? `Default ${d.sbti_target_s12}` : "e.g. 42"} hint="Percent cut from the base year, 0 to 100" />
            <FieldInput {...common} name="sbti_target_year" label={SETTING_LABEL.sbti_target_year} inputMode="numeric" placeholder={d.sbti_target_year ? `Default ${d.sbti_target_year}` : "e.g. 2030"} hint="Year the reduction should be reached" />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Scope 3</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldInput {...common} name="base_year_s3" label={SETTING_LABEL.base_year_s3} list={`years-${clientId}`} placeholder="e.g. FY23" hint="Leave empty to follow the Scope 1 and 2 base year" />
            <FieldInput {...common} name="sbti_target_s3" label="Reduction target (%)" inputMode="decimal" placeholder="e.g. 25" hint="Percent cut from the Scope 3 base year" />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Net zero and energy</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldInput {...common} name="netzero_year" label={SETTING_LABEL.netzero_year} inputMode="numeric" placeholder={d.netzero_year ? `Default ${d.netzero_year}` : "e.g. 2050"} hint={nzBeforeTarget ? "Earlier than the target year. Check this is intended." : "Year the client aims to reach net zero"} />
            <Field label="Accounting basis" hint="Which Scope 2 figure targets are tracked against" error={form.errors.target_basis}>
              <select className={INPUT} value={form.values.target_basis} onChange={(e) => form.set("target_basis", e.target.value)} aria-invalid={!!form.errors.target_basis}>
                <option value="">Platform default</option>
                <option value="market">Market-based</option>
                <option value="location">Location-based</option>
              </select>
            </Field>
            <FieldInput {...common} name="renewable_target_pct" label="Renewable energy target (%)" inputMode="decimal" placeholder="e.g. 60" hint="Share of electricity from renewables" />
          </div>
        </div>
        <Field label={SETTING_LABEL.residual_strategy} hint={`${form.values.residual_strategy.length}/2000. How residual emissions will be handled once reductions are exhausted.`} error={form.errors.residual_strategy}>
          <textarea
            className={`${INPUT} !h-auto min-h-[84px] py-2 ${form.errors.residual_strategy ? "!border-red-400" : ""}`}
            value={form.values.residual_strategy}
            onChange={(e) => form.set("residual_strategy", e.target.value)}
            rows={3}
          />
        </Field>
        <SaveBar
          dirty={form.changed.length > 0}
          invalid={invalid}
          pending={save.isPending}
          onSave={submit}
          onDiscard={form.discard}
          extra={hasAny && (
            <button type="button" className={DANGER_BTN} disabled={save.isPending} onClick={() => setConfirmClear(true)}>Reset to platform defaults</button>
          )}
        />
      </div>
      <ConfirmDialog
        open={confirmClear}
        title="Reset targets to platform defaults?"
        body="All target fields above will be cleared and this client will see the platform defaults again."
        confirmLabel="Reset targets"
        pending={save.isPending}
        onCancel={() => setConfirmClear(false)}
        onConfirm={clearAll}
      />
    </Section>
  );
}

function ContactsSection({ clientId, isAdmin, data }: { clientId: number; isAdmin: boolean; data: AdminClientSettings }) {
  const save = useSaveSettings(clientId);
  const form = useSettingsForm(CONTACT_KEYS, data.settings);
  const savedOwner = data.client.account_owner ?? "";
  const [owner, setOwner] = useState(savedOwner);
  const [ownerError, setOwnerError] = useState("");
  useEffect(() => { setOwner(savedOwner); setOwnerError(""); }, [savedOwner]);

  const ownerChanged = isAdmin && owner.trim().toLowerCase() !== savedOwner.toLowerCase();
  const ownerInvalid = ownerChanged && owner.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.trim());
  const dirty = form.changed.length > 0 || ownerChanged;
  const invalid = Object.keys(form.errors).length > 0 || ownerInvalid || !!ownerError;

  const submit = () => {
    const settings: Record<string, string | null> = {};
    form.changed.forEach((k) => { settings[k] = form.values[k].trim() === "" ? null : form.values[k].trim(); });
    save.mutate(
      { settings, ...(ownerChanged ? { account_owner: owner.trim() === "" ? null : owner.trim().toLowerCase() } : {}) },
      {
        onSuccess: () => toast.success("Contacts saved"),
        onError: (e) => {
          const { account_owner, ...rest } = e.fields;
          if (account_owner) setOwnerError(account_owner);
          if (Object.keys(rest).length) form.setServerErrors(rest);
          if (!Object.keys(e.fields).length) {
            if (ownerChanged && form.changed.length === 0) setOwnerError(e.message);
            toast.error(e.message);
          } else {
            toast.error("Some values were rejected. Check the highlighted fields.");
          }
        },
      },
    );
  };

  const common = { values: form.values, set: form.set, errors: form.errors };

  return (
    <Section title="Consultant and contacts" description="Shown to the client on its Home page so it knows who to contact.">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldInput {...common} name="consultant_name" label={SETTING_LABEL.consultant_name} placeholder="Full name" />
          <FieldInput {...common} name="consultant_email" label={SETTING_LABEL.consultant_email} type="email" inputMode="email" placeholder="name@example.com" />
          <FieldInput {...common} name="consultant_phone" label={SETTING_LABEL.consultant_phone} type="tel" inputMode="tel" placeholder="+91 ..." />
          <FieldInput {...common} name="support_email" label={SETTING_LABEL.support_email} type="email" inputMode="email" placeholder="support@example.com" hint="Used for the Contact support link" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Account owner (Deepwoods staff)"
            hint={isAdmin ? "Email of the Deepwoods team member responsible for this client. Empty means unassigned." : "Only an admin can change the account owner."}
            error={ownerError || (ownerInvalid ? "Enter a valid email address" : undefined)}
          >
            <input
              className={`${INPUT} ${ownerError || ownerInvalid ? "!border-red-400" : ""}`}
              type="email"
              inputMode="email"
              value={owner}
              onChange={(e) => { setOwner(e.target.value); setOwnerError(""); }}
              disabled={!isAdmin}
              placeholder="Unassigned"
            />
          </Field>
        </div>
        <SaveBar dirty={dirty} invalid={invalid} pending={save.isPending} onSave={submit} onDiscard={() => { form.discard(); setOwner(savedOwner); setOwnerError(""); }} />
      </div>
    </Section>
  );
}

export function TargetsPlanTab(props: ClientTabProps) {
  const { clientId, fy, reportingPeriod, isAdmin } = props;
  const q = useAdminClientSettings(clientId);

  return (
    <div className="space-y-6">
      {q.isLoading ? (
        <Section title="Targets and net zero"><Spinner label="Loading settings" /></Section>
      ) : q.error || !q.data ? (
        <Section title="Targets and net zero"><ErrorNote error={q.error ?? new Error("Could not load client settings")} /></Section>
      ) : (
        <>
          <TargetsSection key={`t-${clientId}`} clientId={clientId} fy={fy} reportingPeriod={reportingPeriod} data={q.data} />
          <ContactsSection key={`c-${clientId}`} clientId={clientId} isAdmin={isAdmin} data={q.data} />
        </>
      )}
      <ActionPlanSection {...props} />
      <ScreeningSection {...props} />
    </div>
  );
}
