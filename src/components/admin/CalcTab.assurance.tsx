import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { authFetch } from "@/lib/auth";
import {
  DANGER_BTN, EmptyHint, ErrorNote, INPUT, Pill, PRIMARY_BTN, SECONDARY_BTN, Section, Spinner, fyOptions, type ClientTabProps,
} from "@/components/admin/ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LabeledControl } from "@/components/admin/DataTab.shared";

type AssuranceLevel = "limited" | "reasonable" | "none";
type AssuranceStandard = "ISAE3410" | "ISO14064-3" | "AA1000AS" | "other";

interface VerificationRecord {
  reportingYear: string;
  assuranceLevel: AssuranceLevel;
  standard: AssuranceStandard;
  provider: string;
  scopeCovered: string;
  savedAt?: string;
}

const LEVEL_LABEL: Record<AssuranceLevel, string> = {
  limited: "Limited assurance",
  reasonable: "Reasonable assurance",
  none: "No assurance (self-declaration)",
};
const STANDARD_LABEL: Record<AssuranceStandard, string> = {
  ISAE3410: "ISAE 3410",
  "ISO14064-3": "ISO 14064-3",
  AA1000AS: "AA1000AS",
  other: "Other",
};

function emptyForm(year: string): VerificationRecord {
  return { reportingYear: year, assuranceLevel: "limited", standard: "ISAE3410", provider: "", scopeCovered: "" };
}

export function AssuranceSection({ clientId, clientName, reportingPeriod, fy }: Pick<ClientTabProps, "clientId" | "clientName" | "reportingPeriod" | "fy">) {
  const qc = useQueryClient();
  const [form, setForm] = useState<VerificationRecord>(() => emptyForm(fy));
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (!editing) setForm(emptyForm(fy)); }, [fy, clientId]);
  const [removing, setRemoving] = useState<VerificationRecord | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  const records = useQuery<{ records: VerificationRecord[] }>({
    queryKey: ["admin-verification", clientId],
    queryFn: () => authFetch(`verification-status.php?client_id=${clientId}`),
    staleTime: 30 * 1000,
  });

  const persist = useMutation({
    mutationFn: (next: VerificationRecord[]) => authFetch(`verification-status.php?client_id=${clientId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, records: next }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-verification", clientId] }); },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const list = [...(records.data?.records ?? [])].sort((a, b) => b.reportingYear.localeCompare(a.reportingYear));
  const existing = list.find((r) => r.reportingYear === form.reportingYear);
  const yearChoices = Array.from(new Set([...fyOptions(reportingPeriod, fy), ...list.map((r) => r.reportingYear), form.reportingYear]));

  const set = <K extends keyof VerificationRecord>(k: K, v: VerificationRecord[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((p) => ({ ...p, [k]: "" }));
  };

  const save = async () => {
    const next: Record<string, string> = {};
    if (!form.reportingYear) next.reportingYear = "Choose a reporting year.";
    if (form.assuranceLevel !== "none" && !form.provider.trim()) next.provider = "Enter the assurance provider.";
    if (!form.scopeCovered.trim()) next.scopeCovered = "Describe the scope covered.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const record: VerificationRecord = { ...form, provider: form.provider.trim(), scopeCovered: form.scopeCovered.trim(), savedAt: new Date().toISOString().slice(0, 10) };
    const merged = [...list.filter((r) => r.reportingYear !== record.reportingYear), record];
    try {
      await persist.mutateAsync(merged);
      toast.success(`Assurance record ${existing ? "updated" : "saved"} for ${record.reportingYear}`);
      setForm(emptyForm(fy));
      setEditing(false);
    } catch { /* surfaced by onError */ }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await persist.mutateAsync(list.filter((r) => r.reportingYear !== removing.reportingYear));
      toast.success(`Removed assurance record for ${removing.reportingYear}`);
      setRemoveOpen(false);
    } catch { /* surfaced by onError */ }
  };

  const startEdit = (r: VerificationRecord) => {
    setForm(r);
    setEditing(true);
    setErrors({});
  };

  return (
    <Section
      title="Assurance and third-party verification"
      description={`Record the assurance provider, level and standard per reporting year. Clients with a record show an Assured badge. Used for CDP C10, ISO 14064-3 and GRI 2-5 disclosures for ${clientName}.`}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <LabeledControl htmlFor="as-year" label="Reporting year" error={errors.reportingYear} hint={existing && !editing ? "A record exists for this year and will be replaced." : undefined}>
          <select id="as-year" className={INPUT} value={form.reportingYear} onChange={(e) => set("reportingYear", e.target.value)}>
            {yearChoices.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </LabeledControl>
        <LabeledControl htmlFor="as-level" label="Assurance level">
          <select id="as-level" className={INPUT} value={form.assuranceLevel} onChange={(e) => set("assuranceLevel", e.target.value as AssuranceLevel)}>
            {(Object.keys(LEVEL_LABEL) as AssuranceLevel[]).map((k) => <option key={k} value={k}>{LEVEL_LABEL[k]}</option>)}
          </select>
        </LabeledControl>
        <LabeledControl htmlFor="as-standard" label="Assurance standard">
          <select id="as-standard" className={INPUT} value={form.standard} onChange={(e) => set("standard", e.target.value as AssuranceStandard)}>
            {(Object.keys(STANDARD_LABEL) as AssuranceStandard[]).map((k) => <option key={k} value={k}>{STANDARD_LABEL[k]}</option>)}
          </select>
        </LabeledControl>
        <LabeledControl htmlFor="as-provider" label={form.assuranceLevel === "none" ? "Provider (optional)" : "Provider"} error={errors.provider}>
          <input id="as-provider" className={INPUT} value={form.provider} maxLength={160} placeholder="e.g. Assurance firm name" onChange={(e) => set("provider", e.target.value)} />
        </LabeledControl>
        <div className="sm:col-span-2">
          <LabeledControl htmlFor="as-scope" label="Scope covered" error={errors.scopeCovered}>
            <input id="as-scope" className={INPUT} value={form.scopeCovered} maxLength={300} placeholder="e.g. Scope 1 and 2 for all entities; Scope 3 categories 1, 3, 6" onChange={(e) => set("scopeCovered", e.target.value)} />
          </LabeledControl>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="button" className={PRIMARY_BTN} onClick={save} disabled={persist.isPending || !!records.error || records.isLoading}>
            {persist.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {existing ? "Update record" : "Save record"}
          </button>
          {editing && <button type="button" className={SECONDARY_BTN} onClick={() => { setForm(emptyForm(fy)); setEditing(false); setErrors({}); }}>Cancel edit</button>}
        </div>
      </div>

      {records.isLoading ? <Spinner label="Loading records…" /> : records.error ? <ErrorNote error={records.error} /> : list.length === 0 ? (
        <EmptyHint title="No assurance records">Add a record above once a third party has reviewed this client's inventory.</EmptyHint>
      ) : (
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.reportingYear} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#1E6F5C]" />
                <span className="text-sm font-semibold text-[var(--navy)]">{r.reportingYear}</span>
              </div>
              <Pill tone={r.assuranceLevel === "none" ? "slate" : "green"}>{LEVEL_LABEL[r.assuranceLevel]}</Pill>
              <span className="text-xs text-muted-foreground">{STANDARD_LABEL[r.standard]}</span>
              <span className="text-sm text-[var(--navy)]">{r.provider || "No provider"}</span>
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">{r.scopeCovered}</span>
              {r.savedAt && <span className="text-xs text-muted-foreground">Saved {r.savedAt}</span>}
              <div className="flex gap-2">
                <button type="button" className={SECONDARY_BTN + " !px-2.5 !py-1.5"} onClick={() => startEdit(r)} aria-label={`Edit record for ${r.reportingYear}`}><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" className={DANGER_BTN + " !px-2.5 !py-1.5"} onClick={() => { setRemoving(r); setRemoveOpen(true); }} aria-label={`Remove record for ${r.reportingYear}`}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={removeOpen} onOpenChange={(o) => { if (!o && !persist.isPending) setRemoveOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove assurance record</DialogTitle>
            <DialogDescription>The {removing?.reportingYear} record for {clientName} is removed and the Assured badge disappears for that year.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className={SECONDARY_BTN} onClick={() => setRemoveOpen(false)} disabled={persist.isPending}>Cancel</button>
            <button type="button" className={DANGER_BTN} onClick={confirmRemove} disabled={persist.isPending}>
              {persist.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Remove
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
