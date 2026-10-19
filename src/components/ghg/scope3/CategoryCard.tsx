import { useState, useRef } from "react";
import {
  CheckCircle2, Download, ExternalLink, FileText, Loader2, Lock, Paperclip, X, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGhgStore, type UploadedFile } from "@/lib/ghg/store";
import type { CategorySchema, WizardNode } from "@/lib/ghg/scope3Schemas";
import { useClientContext, type GhgFacility } from "@/lib/client-context";
import { downloadTemplateXLSX } from "@/lib/ghg/xlsxHelpers";
import { buildPeriodOptions } from "@/lib/ghg/periodUtils";
import { EditRequestModal } from "../EditRequestModal";
import { useEntity, useFiscalYear } from "@/lib/entity";
import { authFetch } from "@/lib/auth";

interface Props {
  schema: CategorySchema;
  extraSlot?: React.ReactNode;
  initialOpen?: boolean;
}

// ── Help me choose wizard ─────────────────────────────────────────────────────
function HelpWizard({
  schema,
  onSelect,
  onClose,
}: {
  schema: CategorySchema;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [path, setPath] = useState<WizardNode[]>(() =>
    schema.wizard ? [schema.wizard] : [],
  );

  const current = path[path.length - 1];
  if (!current) return null;

  const stepNum = path.length;
  const goBack = () => setPath((p) => p.slice(0, -1));

  const header = (
    <div className="px-4 py-3 border-b border-primary/20 flex items-center justify-between">
      <span className="text-[10px] font-extrabold uppercase tracking-[.07em] text-primary">
        🤔 Method selection guide · step {stepNum}
      </span>
      <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
    </div>
  );

  // Result node
  if ("result" in current) {
    const method = schema.methods.find((m) => m.id === current.result);
    return (
      <div className="mt-3 rounded-xl border border-primary/25 overflow-hidden" style={{ background: "var(--color-primary, #1E6F5C)08" }}>
        <div className="px-4 py-3 border-b border-primary/20 flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-[.07em] text-primary">
            ✅ Recommended method
          </span>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="p-4">
          {current.note && (
            <p className="text-[12px] text-muted-foreground mb-3 italic">{current.note}</p>
          )}
          {method && (
            <div className="mb-4">
              <div className="text-[14px] font-bold text-foreground">{method.label}</div>
              {method.accuracyLabel && (
                <span className="text-[11px] text-primary font-semibold">{method.accuracyLabel}</span>
              )}
              {method.plainDesc && (
                <p className="text-[12px] text-muted-foreground mt-1">{method.plainDesc}</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { onSelect(current.result); onClose(); }}
              className="rounded-lg border-2 border-primary bg-primary/10 px-4 py-2 text-[13px] font-bold text-primary hover:bg-primary/15 transition-colors"
            >
              Use this method →
            </button>
            {path.length > 1 && (
              <button onClick={goBack} className="text-[12px] text-muted-foreground hover:text-foreground">
                ← Back
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // noTemplate node
  if ("noTemplate" in current) {
    return (
      <div className="mt-3 rounded-xl border border-primary/25 overflow-hidden" style={{ background: "var(--color-primary, #1E6F5C)08" }}>
        <div className="px-4 py-3 border-b border-primary/20 flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-[.07em] text-primary">
            ✅ No template needed
          </span>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="p-4">
          <p className="text-[13px] text-muted-foreground">{current.note}</p>
        </div>
      </div>
    );
  }

  // Question node
  return (
    <div className="mt-3 rounded-xl border border-primary/25 overflow-hidden" style={{ background: "var(--color-primary, #1E6F5C)08" }}>
      {header}
      <div className="p-4">
        <p className="text-[13px] font-semibold text-navy mb-3">{current.q}</p>
        <div className="flex flex-col gap-2">
          {current.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => setPath((p) => [...p, opt.next])}
              className="rounded-lg border-2 border-border px-3 py-2.5 text-[13px] font-semibold text-foreground text-left hover:border-primary/30 hover:bg-muted/30 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
        {path.length > 1 && (
          <button onClick={goBack} className="mt-3 text-[12px] text-muted-foreground hover:text-foreground">
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function SectionCard({
  title,
  titleRight,
  subtitle,
  icon,
  children,
  className,
}: {
  title: string;
  titleRight?: React.ReactNode;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      "bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-4",
      className,
    )}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-bold text-foreground flex items-center gap-1.5">
            {icon && <span>{icon}</span>}
            {title}
          </div>
          {subtitle && (
            <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {titleRight}
      </div>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CategoryCard({ schema, extraSlot, initialOpen = false }: Props) {
  const { getS3Data, setS3Data, addS3Files, submitS3Category, state } = useGhgStore();
  const data = getS3Data(schema.id);
  const { entity } = useEntity();
  const { fy } = useFiscalYear();
  const clientCtx = useClientContext();
  const reportingPeriod = clientCtx.client.reporting_period ?? "FY";
  const periodOpts = buildPeriodOptions(fy, reportingPeriod);

  // Facilities from DB for this client + entity — never from hardcoded registry
  const clientFacilities: GhgFacility[] = (clientCtx.facilities ?? [])
    .filter((f: GhgFacility) => !f.entity || f.entity === entity);
  const facilityOptions = clientFacilities.length > 0
    ? ["All Facilities", ...clientFacilities.map((f: GhgFacility) => f.name)]
    : ["All Facilities"];

  const [open, setOpen] = useState(initialOpen);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPeriod, setUploadPeriod] = useState<string>("");
  const uploadLockRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputAltRef = useRef<HTMLInputElement>(null);

  const methodId = data.method ?? schema.recommended ?? schema.methods[0]?.id;
  const currentMethod = schema.methods.find((m) => m.id === methodId) ?? schema.methods[0];

  const submitted = data.submitted;
  const hasData = data.rows.length > 0 || data.files.length > 0;
  const locked = !!state.submission && submitted;
  const status: "done" | "inprog" | "idle" = submitted ? "done" : hasData ? "inprog" : "idle";
  const setupDone = !!data.facilityScope && !!data.reportingFrequency;
  const uploadPeriodRequired = setupDone && data.reportingFrequency !== "yearly";
  const canUpload = !uploadPeriodRequired || !!uploadPeriod;

  const handleMethodSelect = (id: string) => {
    if (locked) return;
    setS3Data(schema.id, { method: id });
  };

  const onFiles = async (fl: FileList | null) => {
    // Use a ref (not state) as the guard — state reads in closures are stale
    // until the next render, so two rapid onChange fires both see uploading=false.
    if (!fl || locked || uploadLockRef.current) return;
    uploadLockRef.current = true;

    const fileArray = Array.from(fl);
    if (!data.entryMode) setS3Data(schema.id, { entryMode: "upload" });

    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("category_id", schema.id);
      form.append("category_name", schema.name);
      form.append("entity", entity);
      form.append("year", fy);
      form.append("facility_scope", data.facilityScope ?? "All Facilities");
      form.append("reporting_frequency", data.reportingFrequency ?? "yearly");
      if (uploadPeriod) form.append("period", uploadPeriod);
      for (const f of fileArray) form.append("files[]", f);

      const result = await authFetch("ghg/scope3-upload.php", { method: "POST", body: form });

      const driveMap = new Map<string, string>();
      if (result.files) {
        for (const rf of result.files as { name: string; driveLink: string }[]) {
          driveMap.set(rf.name, rf.driveLink);
        }
      }
      const files: UploadedFile[] = fileArray.map((f) => ({
        name: f.name,
        size: f.size,
        ...(driveMap.has(f.name) ? { driveLink: driveMap.get(f.name) } : {}),
      }));
      addS3Files(schema.id, files);
      if (result.drive_warning) setUploadError(result.drive_warning);
    } catch (err: unknown) {
      addS3Files(schema.id, fileArray.map((f) => ({ name: f.name, size: f.size })));
      setUploadError((err as Error).message ?? "Upload to Drive failed. Files saved locally.");
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
      // Reset both inputs so re-selecting the same file triggers onChange again
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (fileInputAltRef.current) fileInputAltRef.current.value = "";
    }
  };

  const removeFile = (idx: number) => {
    setS3Data(schema.id, { files: data.files.filter((_, i) => i !== idx) });
  };

  const downloadTemplate = () => {
    if (!currentMethod) return;
    const hasColumns = currentMethod.columns.length > 0 ||
      (currentMethod.subtables && currentMethod.subtables.length > 0);
    if (!hasColumns) return;
    downloadTemplateXLSX(
      `${schema.code.replace(" ", "")}_${schema.name.replace(/[^a-z0-9]+/gi, "_")}_${currentMethod.id}_template.xlsx`,
      schema,
      currentMethod,
      { entityName: entity, fy, reportingPeriod },
      uploadPeriod || undefined,
    );
  };

  // ── ACCORDION WRAPPER (only when not initialOpen) ──────────────────────────
  const detailContent = (
    <div className={cn(!initialOpen && "px-0")}>

      {/* ── 1. REPORTING SETUP CARD (always first, gates everything below) ── */}
      {!schema.noTemplate && (
        <div className={cn(
          "mb-4 rounded-xl border-2 overflow-hidden shadow-sm",
          setupDone ? "border-primary/30" : "border-primary",
        )}>
          {/* Card header */}
          <div className={cn(
            "px-4 py-3 border-b flex items-center justify-between gap-3",
            setupDone ? "border-primary/20 bg-primary/[0.04]" : "bg-primary text-white border-primary",
          )}>
            <div>
              <div className={cn("text-[13px] font-bold flex items-center gap-2", setupDone ? "text-primary" : "text-white")}>
                {setupDone ? "✅" : "1"} Reporting setup
                {!setupDone && (
                  <span className="text-[11px] font-semibold opacity-90">— complete this first</span>
                )}
              </div>
              {setupDone && (
                <p className="text-[11px] text-primary/70 mt-0.5">
                  {data.facilityScope} · {data.reportingFrequency}
                </p>
              )}
            </div>
            {setupDone && (
              <button
                disabled={locked}
                onClick={() => setS3Data(schema.id, { facilityScope: undefined, reportingFrequency: undefined })}
                className="text-[11px] text-primary/60 hover:text-primary transition-colors"
              >
                Change
              </button>
            )}
          </div>

          <div className="px-4 pt-4 pb-4 space-y-6">
            {/* ── Facility selector ── */}
            <div>
              <div className="text-[13px] font-bold text-foreground mb-1">
                Which facility does this data cover?
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Pick a specific facility if uploading data for one site; pick &ldquo;All Facilities&rdquo; for consolidated data covering all sites.
              </p>
              <div className={cn(
                "grid gap-2",
                facilityOptions.length <= 2 && "grid-cols-2",
                facilityOptions.length === 3 && "grid-cols-3",
                facilityOptions.length >= 4 && "grid-cols-2 sm:grid-cols-3",
              )}>
                {facilityOptions.map((opt) => {
                  const isAll = opt === "All Facilities";
                  const fac = clientFacilities.find((f: GhgFacility) => f.name === opt);
                  const selected = data.facilityScope === opt;
                  return (
                    <button
                      key={opt}
                      disabled={locked}
                      onClick={() => setS3Data(schema.id, { facilityScope: opt })}
                      className={cn(
                        "relative flex flex-col items-start gap-0.5 rounded-xl border-2 px-4 py-3 text-left transition-all",
                        selected
                          ? "border-primary bg-primary/[0.06]"
                          : "border-border bg-card hover:border-primary/40 hover:bg-muted/20",
                        locked && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      <span className="text-[18px] leading-none mb-1">{isAll ? "🏢" : "🏭"}</span>
                      <span className={cn("text-[12px] font-bold leading-snug", selected ? "text-primary" : "text-foreground")}>
                        {opt}
                      </span>
                      {fac?.state && (
                        <span className="text-[10px] text-muted-foreground">{fac.state}</span>
                      )}
                      {isAll && (
                        <span className="text-[10px] text-muted-foreground">Consolidated data</span>
                      )}
                      {selected && (
                        <div className="absolute right-2 top-2 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-[9px] font-extrabold text-white">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Reporting frequency ── */}
            <div>
              <div className="text-[13px] font-bold text-foreground mb-3">How frequently will you provide data?</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { key: "monthly", label: "Monthly", icon: "📅", desc: "12 uploads / year" },
                    { key: "quarterly", label: "Quarterly", icon: "📆", desc: "4 uploads / year" },
                    { key: "half-yearly", label: "Half-yearly", icon: "📋", desc: "2 uploads / year" },
                    { key: "yearly", label: "Yearly", icon: "📊", desc: "1 upload / year" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    disabled={locked}
                    onClick={() => setS3Data(schema.id, { reportingFrequency: opt.key })}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all",
                      data.reportingFrequency === opt.key
                        ? "border-primary bg-primary/[0.06]"
                        : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
                      locked && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    <span className="text-[22px] leading-none">{opt.icon}</span>
                    <span className={cn("text-[12px] font-bold", data.reportingFrequency === opt.key ? "text-primary" : "text-foreground")}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Gate: show a prompt if setup not done (for non-noTemplate categories) ── */}
      {!schema.noTemplate && !setupDone && (
        <div className="mb-4 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-[13px] text-muted-foreground">
          Complete the reporting setup above to access the template and upload section.
        </div>
      )}

      {/* ── Everything below only visible once setup is done ── */}
      {(schema.noTemplate || setupDone) && (
        <>
          {/* ── 2. WHAT & WHY CARD ── */}
          {(schema.whatIs || schema.whatWeNeed || schema.whereToFind || schema.whoHasIt) && (
            <SectionCard title="What & why" icon="💡">
              <div className="divide-y divide-border">
                {[
                  { key: "What this is", val: schema.whatIs },
                  { key: "What we need", val: schema.whatWeNeed },
                  { key: "Where to find it", val: schema.whereToFind },
                  { key: "Who usually has it", val: schema.whoHasIt },
                ].filter((r) => !!r.val).map(({ key, val }) => (
                  <div key={key} className="grid" style={{ gridTemplateColumns: "140px 1fr" }}>
                    <div className="px-4 py-3 text-[12px] font-semibold text-muted-foreground bg-muted/40 flex items-start">
                      {key}
                    </div>
                    <div className="px-4 py-3 text-[13px] text-foreground">{val}</div>
                  </div>
                ))}
              </div>
              {schema.whyMatters && (
                <div className="px-4 py-3 border-t border-border bg-muted/20 text-[12px] text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Why this matters for you</span>
                  {" "}— {schema.whyMatters}
                </div>
              )}
            </SectionCard>
          )}

          {/* ── 3. METHOD CHOOSER CARD ── */}
          {schema.methods.length > 1 && (
            <SectionCard
              title="Which type of data do you have?"
              subtitle="Pick the option that best describes what you can actually find. You can switch later."
            >
              <div className="p-4">
                <div className={cn(
                  "grid gap-3",
                  schema.methods.length === 2 && "grid-cols-2",
                  schema.methods.length === 3 && "grid-cols-3",
                  schema.methods.length >= 4 && "grid-cols-2 sm:grid-cols-4",
                )}>
                  {schema.methods.map((m) => {
                    const selected = methodId === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => handleMethodSelect(m.id)}
                        disabled={locked}
                        className={cn(
                          "relative flex flex-col gap-1 rounded-lg border-2 p-3 text-left transition-all",
                          selected
                            ? "border-primary bg-primary/[0.06]"
                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
                          locked && "opacity-60 cursor-not-allowed",
                        )}
                      >
                        {m.accuracy === "best" && !schema.productTypeSelection && (
                          <span className="mb-1 text-[9px] font-extrabold uppercase tracking-[.06em] text-primary">
                            ⭐ Best accuracy
                          </span>
                        )}
                        {m.emoji && <span className="text-[20px] leading-none mb-1">{m.emoji}</span>}
                        <span className="text-[12px] font-bold text-foreground leading-snug">
                          {m.plainLabel || m.label}
                        </span>
                        {m.plainDesc && (
                          <span className="text-[11px] text-muted-foreground leading-snug">{m.plainDesc}</span>
                        )}
                        {m.accuracyLabel && (
                          <span className={cn(
                            "mt-2 inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border",
                            schema.productTypeSelection
                              ? "bg-muted text-muted-foreground border-border"
                              : m.accuracy === "best"
                              ? "bg-primary/10 text-primary border-primary/25"
                              : m.accuracy === "good"
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                              : "bg-muted text-muted-foreground border-border",
                          )}>
                            {m.accuracyLabel}
                          </span>
                        )}
                        {selected && (
                          <div className="absolute right-2 top-2 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-[9px] font-extrabold text-white">
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Help me choose — now a proper visible button */}
                {!locked && schema.wizard && (
                  <div className="mt-4">
                    <button
                      onClick={() => setHelpOpen((v) => !v)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-[12px] font-bold transition-all",
                        helpOpen
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-primary/40 bg-primary/[0.04] text-primary hover:bg-primary/10 hover:border-primary",
                      )}
                    >
                      🤔 {helpOpen ? "Close guide" : "Help me choose the right method →"}
                    </button>
                    {helpOpen && (
                      <HelpWizard
                        schema={schema}
                        onSelect={(id) => { handleMethodSelect(id); setHelpOpen(false); }}
                        onClose={() => setHelpOpen(false)}
                      />
                    )}
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* ── 4. NO-TEMPLATE NOTICE (Cat 3 and similar auto-calculated categories) ── */}
          {schema.noTemplate ? (
            <SectionCard title="No data collection needed" icon="✅">
              <div className="p-4">
                <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4 text-[13px] text-foreground leading-relaxed">
                  {schema.noTemplate}
                </div>
              </div>
            </SectionCard>
          ) : (
            <>
              {/* ── 5. TEMPLATE CARD ── */}
          <SectionCard
            title="Get the template"
            subtitle={currentMethod ? `${currentMethod.plainLabel || currentMethod.label} · Download the matching template and fill it in` : "Download, fill it in, then upload it back here"}
            titleRight={
              <Button
                size="sm"
                onClick={downloadTemplate}
                className="flex-shrink-0 gap-1.5 h-8 text-[11px] font-bold"
              >
                <Download className="h-3.5 w-3.5" />
                Download Excel template
              </Button>
            }
          >
            <div className="p-4">
              {/* Subtables (e.g. Cat 5 Waste-type-specific: Solid Waste + Wastewater) */}
              {currentMethod?.subtables && currentMethod.subtables.length > 0 ? (
                <div className="space-y-4">
                  {currentMethod.subtables.map((st) => (
                    <div key={st.title}>
                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-[.06em] mb-2">
                        {st.title}
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-[11px]" style={{ minWidth: `${st.columns.length * 130}px` }}>
                          <thead>
                            <tr className="bg-muted/50">
                              {st.columns.map((col) => (
                                <th
                                  key={col.key}
                                  className={cn(
                                    "border-b border-border px-3 py-2 text-left font-bold whitespace-nowrap",
                                    col.required ? "text-primary" : "text-muted-foreground",
                                  )}
                                >
                                  <span className={cn(
                                    "block text-[8px] font-extrabold uppercase tracking-[.04em] mb-0.5",
                                    col.required ? "text-primary" : "text-muted-foreground/50",
                                  )}>
                                    {col.required ? "Required" : "Optional"}
                                  </span>
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="bg-card">
                              {st.columns.map((col) => (
                                <td key={col.key} className="px-3 py-2 text-foreground whitespace-nowrap font-mono text-[11px] border-b border-border last:border-0">
                                  {st.exampleRow?.[col.key] ?? (col.type === "number" ? "0" : "—")}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Single table */
                currentMethod?.columns && currentMethod.columns.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-[11px]" style={{ minWidth: `${currentMethod.columns.length * 130}px` }}>
                      <thead>
                        <tr className="bg-muted/50">
                          {currentMethod.columns.map((col) => (
                            <th
                              key={col.key}
                              className={cn(
                                "border-b border-border px-3 py-2 text-left font-bold whitespace-nowrap",
                                col.required ? "text-primary" : "text-muted-foreground",
                              )}
                            >
                              <span className={cn(
                                "block text-[8px] font-extrabold uppercase tracking-[.04em] mb-0.5",
                                col.required ? "text-primary" : "text-muted-foreground/50",
                              )}>
                                {col.required ? "Required" : "Optional"}
                              </span>
                              {col.label}
                              {col.unit && (
                                <span className="font-normal text-muted-foreground/70"> ({col.unit})</span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-card">
                          {currentMethod.columns.map((col) => (
                            <td key={col.key} className="px-3 py-2 text-foreground whitespace-nowrap font-mono text-[11px] border-b border-border last:border-0">
                              {currentMethod.exampleRow?.[col.key]
                                ?? (col.options ? col.options[0] : col.type === "number" ? "0" : "—")}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Helper links */}
              <div className="mt-3 space-y-1.5">
                <p className="text-[12px] text-muted-foreground">
                  Can&apos;t produce this in our format?{" "}
                  <span className="text-primary font-semibold cursor-pointer hover:underline">
                    Upload whatever you have
                  </span>{" "}
                  and we&apos;ll map it.
                </p>
                <p className="text-[12px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  ○ I can&apos;t get this data for this category
                </p>
              </div>
            </div>
          </SectionCard>

          {/* ── 6. UPLOAD CARD ── */}
          <SectionCard title="Upload your data">
        <div className="p-4">
          {/* Period selector (monthly / quarterly / half-yearly) */}
          {uploadPeriodRequired && (
            <div className="mb-4">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-[.06em] mb-2">
                Which period does this file cover?
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.reportingFrequency === "monthly" && periodOpts.months.map((m) => (
                  <button
                    key={m.key}
                    disabled={locked}
                    onClick={() => setUploadPeriod(m.long)}
                    className={cn(
                      "px-2.5 py-1 rounded border text-[11px] font-semibold transition-all",
                      uploadPeriod === m.long
                        ? "border-primary bg-primary/[0.06] text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {m.short}
                  </button>
                ))}
                {data.reportingFrequency === "quarterly" && periodOpts.quarters.map((q) => (
                  <button
                    key={q.key}
                    disabled={locked}
                    onClick={() => setUploadPeriod(q.label)}
                    className={cn(
                      "px-3 py-1.5 rounded border text-[11px] font-semibold transition-all",
                      uploadPeriod === q.label
                        ? "border-primary bg-primary/[0.06] text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {q.label}
                  </button>
                ))}
                {data.reportingFrequency === "half-yearly" && periodOpts.halfYears.map((h) => (
                  <button
                    key={h.key}
                    disabled={locked}
                    onClick={() => setUploadPeriod(h.label)}
                    className={cn(
                      "px-3 py-1.5 rounded border text-[11px] font-semibold transition-all",
                      uploadPeriod === h.label
                        ? "border-primary bg-primary/[0.06] text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
              {!uploadPeriod && (
                <p className="text-[11px] text-amber-warn mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  Select the period this file covers before uploading.
                </p>
              )}
            </div>
          )}
          {uploadError && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-warn/40 bg-amber-warn/[0.06] px-3 py-2.5 text-[12px] text-amber-warn">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}
          {data.files.length > 0 ? (
            <div className="space-y-2">
              {data.files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                >
                  <FileText className="h-[18px] w-[18px] flex-shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-foreground">{f.name}</div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{(f.size / 1024).toFixed(1)} KB</span>
                      {f.driveLink && f.driveLink !== "#demo" && (
                        <a
                          href={f.driveLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Drive
                        </a>
                      )}
                    </div>
                  </div>
                  {!locked && (
                    <button
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground/50 hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {!locked && (
                <label className={cn("mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-primary hover:underline", (uploading || !canUpload) && "pointer-events-none opacity-50")}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                  {uploading ? "Uploading…" : "Add another file"}
                  <input ref={fileInputAltRef} type="file" multiple hidden disabled={locked || uploading || !canUpload} onChange={(e) => { void onFiles(e.target.files); }} />
                </label>
              )}
            </div>
          ) : (
            <label className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors",
              !locked && !uploading && canUpload && "cursor-pointer hover:border-primary/50 hover:bg-primary/[0.03]",
              (uploading || !canUpload) && "opacity-60",
            )}>
              {uploading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <div className="text-[13px] font-semibold text-foreground">Uploading to Drive…</div>
                </>
              ) : !canUpload ? (
                <>
                  <div className="text-2xl">📅</div>
                  <div className="text-[13px] text-muted-foreground">Select a period above to enable upload</div>
                </>
              ) : (
                <>
                  <div className="text-2xl">📂</div>
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">
                      Drop your filled template here
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      or{" "}
                      <span className="font-semibold text-primary">browse files</span>
                      {" "}— Excel or CSV accepted
                    </div>
                  </div>
                </>
              )}
              <input ref={fileInputRef} type="file" multiple hidden disabled={locked || uploading || !canUpload} onChange={(e) => { void onFiles(e.target.files); }} />
            </label>
          )}
        </div>
      </SectionCard>
            </>
          )}
        </>
      )}

      {/* ── Validation warnings ── */}
      {schema.warnings && schema.warnings.length > 0 && (
        <SectionCard title="Validation results">
          <div className="p-4 space-y-3">
            {schema.warnings.map((w, i) => (
              <div
                key={i}
                className="rounded-lg border border-amber-warn/40 overflow-hidden bg-amber-warn/[0.06]"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-amber-warn/30 text-[12px] font-bold text-amber-warn">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {w}
                </div>
                <div className="px-3 py-2 text-[11px] text-muted-foreground">
                  Edit directly below — changes are saved automatically
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── 6. SUBMIT ROW ── */}
      <div className="flex items-center gap-3 mb-5">
        {!submitted ? (
          <>
            <Button
              size="sm"
              disabled={!hasData || locked}
              onClick={() => submitS3Category(schema.id)}
              className="gap-1.5 px-5 py-2.5 text-[13px] font-bold h-auto"
            >
              <CheckCircle2 className="h-4 w-4" />
              Submit to Deepwoods
            </Button>
            <span className="text-[11px] text-muted-foreground">
              {hasData
                ? "Deepwoods will review within 1–2 business days"
                : "Upload data above to enable submission"}
            </span>
          </>
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            Submitted — under review by Deepwoods
          </div>
        )}
      </div>

      {/* ── 7. Q&A CARD ── */}
      {extraSlot && (
        <SectionCard title="Ask a question about this category">
          <div className="p-4">
            {extraSlot}
          </div>
        </SectionCard>
      )}
    </div>
  );

  // ── DETAIL MODE (from grid navigation, initialOpen=true) ─────────────────
  if (initialOpen) {
    return (
      <div>
        {/* Detail view header */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] font-medium px-2 py-1 rounded border bg-muted border-border text-muted-foreground">
              {schema.code}
            </span>
            {locked && (
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <button
                  onClick={() => setEditOpen(true)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Request edit
                </button>
              </div>
            )}
          </div>
          <h1 className="text-[22px] font-bold text-navy tracking-tight leading-snug mb-2">
            {schema.name}
          </h1>
          {schema.boundary && (
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-2xl">
              {schema.boundary}
            </p>
          )}
        </div>

        {detailContent}

        <EditRequestModal
          open={editOpen}
          onOpenChange={setEditOpen}
          scope="s3"
          categoryId={schema.id}
          categoryName={`${schema.code} — ${schema.name}`}
        />
      </div>
    );
  }

  // ── ACCORDION MODE (default, for backwards compat) ───────────────────────
  return (
    <div className={cn(
      "rounded-xl border bg-card shadow-sm overflow-hidden transition-shadow",
      status === "done" && "border-l-[3px] border-l-primary",
      status === "inprog" && "border-l-[3px] border-l-amber-warn",
      open && "shadow-md",
    )}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted border border-border font-mono text-[10px] px-2 py-0.5 text-muted-foreground">
              {schema.code}
            </span>
            {status === "done" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary text-white">
                Submitted
              </span>
            )}
            {status === "inprog" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-warn text-white">
                In progress
              </span>
            )}
            {status === "idle" && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                Not started
              </span>
            )}
            {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
          <h4 className="text-[15px] font-semibold text-navy leading-snug">{schema.name}</h4>
          {schema.boundary && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2 max-w-2xl">
              {schema.boundary}
            </p>
          )}
        </div>
        <span className="text-muted-foreground mt-1 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-border bg-muted/20 p-4">
          {detailContent}
        </div>
      )}

      <EditRequestModal
        open={editOpen}
        onOpenChange={setEditOpen}
        scope="s3"
        categoryId={schema.id}
        categoryName={`${schema.code} — ${schema.name}`}
      />
    </div>
  );
}
