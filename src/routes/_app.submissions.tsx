import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageBody, PageHeader, Card, LockedState } from "@/components/portal";
import { useClientContext, useDataEntryEntities } from "@/lib/client-context";
import { useDatasets } from "@/lib/api";
import { getRole, ROLE_META, authFetch } from "@/lib/auth";
import { useEntity } from "@/lib/entity";
import { addSubmission, loadSubmissions, type Submission, type SubmissionVersion, type DataEntryEntity } from "@/lib/submissionsStore";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download, FileCheck2, Clock, CheckCircle2, XCircle,
  ChevronRight, ChevronLeft, FileSpreadsheet, Flame, Zap, Globe, Loader2,
  ClipboardList, Building2, BarChart3, AlertTriangle,
} from "lucide-react";
import { GHG_LIVE, ghgPost } from "@/lib/ghg-config";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/submissions")({ component: Submissions });

/* ── Types ──────────────────────────────────────────────────────────────────── */
type ScopeId = "scope1" | "scope2" | "scope3" | "inventory";
type ScopeCategory = { id: string; label: string; hint: string; accept: string };
type ScopeDef = {
  id: ScopeId; label: string; sub: string; icon: React.ReactNode;
  accentVar: string; template: string; templateHint: string;
  verificationDocs: ScopeCategory[];
};

/* ── Scope definitions ──────────────────────────────────────────────────────── */
const SCOPES: ScopeDef[] = [
  {
    id: "scope1", label: "Scope 1", sub: "Direct emissions — stationary combustion, mobile sources, fugitive",
    icon: <Flame className="h-5 w-5" />, accentVar: "var(--alert)",
    template: "GHG_Scope1_Template.xlsx",
    templateHint: "One workbook per entity: stationary combustion (backup generators, industrial ovens/kilns, LPG/natural gas), mobile combustion (vehicles, forklifts), fugitive (CO2 cylinders & fire extinguishers).",
    verificationDocs: [
      { id: "s1-fuel-inv",  label: "Fuel purchase invoices",       hint: "Diesel/LPG/natural gas supplier invoices covering the full reporting period.",          accept: ".pdf,.xlsx" },
      { id: "s1-equip",     label: "Equipment service records",    hint: "Generator/equipment maintenance & calibration logs confirming operational status.",      accept: ".pdf" },
    ],
  },
  {
    id: "scope2", label: "Scope 2", sub: "Purchased electricity — grid, solar, wind PPA & I-RECs",
    icon: <Zap className="h-5 w-5" />, accentVar: "var(--warning)",
    template: "GHG_Scope2_Template.xlsx",
    templateHint: "One workbook per entity: grid consumption per facility, on-site solar generation, and wind PPA & I-REC instruments where applicable.",
    verificationDocs: [
      { id: "s2-bills",     label: "Electricity bills",             hint: "Monthly bills for all in-boundary connections — per facility.",                         accept: ".pdf,.xlsx" },
      { id: "s2-solar-log", label: "Solar generation logs",         hint: "Inverter/meter logs for on-site solar PV systems.",                                  accept: ".pdf,.xlsx,.csv" },
      { id: "s2-irec",      label: "Wind PPA / I-REC certificates", hint: "Certificate doc: issuer, certificate ID, MWh quantity, vintage year.",                  accept: ".pdf,.xlsx" },
    ],
  },
  {
    id: "scope3", label: "Scope 3", sub: "Value chain — up to 10 calculated categories",
    icon: <Globe className="h-5 w-5" />, accentVar: "var(--navy-2)",
    template: "GHG_Scope3_Template.xlsx",
    templateHint: "Multi-sheet workbook — one tab per category: Cat 1, 2, 3, 4, 5, 6, 7, 9, 11, 12. Relevant categories vary by entity.",
    verificationDocs: [
      { id: "s3-invoices",  label: "Purchase register / supplier invoices", hint: "Procurement extract for Cat 1 & fixed-asset additions for Cat 2.",             accept: ".pdf,.xlsx,.csv" },
      { id: "s3-freight",   label: "Freight / delivery records",            hint: "Monthly delivery data, freight invoices: origin, destination, mode, weight.",   accept: ".pdf,.xlsx,.csv" },
      { id: "s3-travel",    label: "Travel & commute records",              hint: "HR commute survey results; business travel expense reports or tickets.",         accept: ".pdf,.xlsx" },
    ],
  },
];

/* ── GHG Annual Report Upload Card ─────────────────────────────────────────── */
function GhgReportUpload({ entity, onDone }: { entity: string; onDone: () => void }) {
  const [step, setStep] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { entities, reporting_years } = useClientContext();
  const dataEntryCode = entities.find(e => !e.is_consolidated)?.code ?? entity;
  const resolvedEntity = entities.find(e => e.is_consolidated)?.code === entity ? dataEntryCode : entity;
  const currentFY = reporting_years[reporting_years.length - 1] ?? "FY26";
  const templateName = `GHG_Data_${currentFY}_Template.xlsx`;

  const upload = async () => {
    if (!file) return;
    setStep("uploading");
    setErrorMsg(null);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      if (GHG_LIVE) {
        await ghgPost({
          action:       "uploadDataFile",
          clientId:     resolvedEntity,
          fileName:     file.name,
          fileBase64:   b64,
          submittedBy:  "portal",
          fiscalYear:   currentFY,
        });
      }
      setStep("done");
      setTimeout(onDone, 2000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Upload failed.");
      setStep("error");
    }
  };

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <div className="font-bold text-lg text-[var(--navy)]">File uploaded</div>
        <p className="max-w-xs text-sm text-muted-foreground">
          {GHG_LIVE
            ? "Your data has been saved to Drive. Deepwoods has been notified to generate the GHG report."
            : "Demo mode — no file was actually uploaded. Configure VITE_GHG_WEBAPP_URL to go live."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!GHG_LIVE && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Demo mode — upload will be simulated. Set <code className="rounded bg-amber-100 px-1 font-mono">VITE_GHG_WEBAPP_URL</code> to go live.</span>
        </div>
      )}

      {/* Step 1: Download */}
      <div className="rounded-xl border-2 border-[#1E6F5C] bg-[#E6F4EF]/40 p-4">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#1E6F5C]">Step 1 — Download template</div>
        <div className="font-semibold text-[var(--navy)]">{templateName}</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Single workbook covering all required GHG data points (Scope 1, 2, 3).
          Fill in the yellow <em>FY2026 Value</em> column and save.
        </p>
        <a
          href={`/templates/${templateName}`}
          download={templateName}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#1E6F5C] px-4 py-1.5 text-sm font-semibold text-[#1E6F5C] hover:bg-[#E6F4EF]"
        >
          <Download className="h-4 w-4" /> Download template
        </a>
      </div>

      {/* Step 2: Upload */}
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Step 2 — Upload completed file</div>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-dashed bg-[var(--muted)] px-5 py-4 hover:bg-[var(--accent)]">
          <div className="flex min-w-0 items-center gap-3 text-muted-foreground">
            <FileSpreadsheet className="h-5 w-5 shrink-0" />
            {file
              ? <span className="truncate font-mono text-sm font-semibold text-[var(--navy)]">{file.name}</span>
              : <span className="text-sm">Select filled template · .xlsx</span>
            }
          </div>
          <span className="shrink-0 rounded-lg bg-[#1E6F5C] px-4 py-1.5 text-sm font-semibold text-white">
            {file ? "Change" : "Browse"}
          </span>
          <input type="file" accept=".xlsx" className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {file && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {file.name} ready — click upload below
          </div>
        )}
      </div>

      {step === "error" && errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {errorMsg}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onDone} className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-semibold">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={upload}
          disabled={!file || step === "uploading"}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {step === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
          {step === "uploading" ? "Uploading…" : "Upload to Drive"}
        </button>
      </div>
    </div>
  );
}

/* ── Entity picker (required for every submission) ─────────────────────────── */
function EntityPicker({ value, onChange }: { value: DataEntryEntity | null; onChange: (e: DataEntryEntity) => void }) {
  const entities = useDataEntryEntities();
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Which company is this data for?</div>
      <p className="mb-3 text-sm text-muted-foreground">
        Data must be submitted against a specific sub-entity. The consolidated view is calculated automatically.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {entities.map((e) => (
          <button key={e.code} type="button" onClick={() => onChange(e.code)}
            className={`rounded-xl border-2 p-4 text-left transition ${
              value === e.code ? "border-[var(--navy)] bg-[color-mix(in_oklab,var(--navy)_6%,white)]" : "border-[var(--border)] bg-white hover:border-[var(--navy-2)]"
            }`}>
            <div className="flex items-center justify-between">
              <span className="font-bold tabular-nums text-[var(--navy)]">{e.code}</span>
              {value === e.code && <CheckCircle2 className="h-4 w-4 text-[var(--navy)]" />}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{e.name}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{e.short ?? ""}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Shared badges (also used by _app.admin.tsx) ────────────────────────────── */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Pending":            "bg-amber-100 text-amber-800 border-amber-200",
    "Approved":           "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Rejected":           "bg-red-100 text-red-700 border-red-200",
    "Under Review":       "bg-blue-100 text-blue-800 border-blue-200",
    "Revision Requested": "bg-orange-100 text-orange-800 border-orange-200",
    "Resubmitted":        "bg-purple-100 text-purple-800 border-purple-200",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      {status === "Pending"            && <Clock        className="mr-1 h-3 w-3" />}
      {status === "Approved"           && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {status === "Rejected"           && <XCircle      className="mr-1 h-3 w-3" />}
      {status === "Under Review"       && <ClipboardList className="mr-1 h-3 w-3" />}
      {status === "Revision Requested" && <AlertTriangle className="mr-1 h-3 w-3" />}
      {status === "Resubmitted"        && <BarChart3     className="mr-1 h-3 w-3" />}
      {status}
    </span>
  );
}

export function VersionChip({ v }: { v: string }) {
  return (
    <span className="inline-flex items-center rounded border bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
      {v}
    </span>
  );
}

/* ── Inventory update — follow-up question definitions ──────────────────────── */
type FollowUpField = {
  id: string; label: string; required?: boolean;
  type: "text" | "select" | "date";
  options?: string[]; placeholder?: string;
};

// FACILITIES is now derived from ctx.entities inside InventoryUpdateWizard — see facilityOptions below

const CHANGE_TYPE_FOLLOWUPS: Record<string, FollowUpField[]> = {
  "New equipment / asset added": [
    { id: "equip_type",    label: "Equipment type",          type: "select", required: true,
      options: ["Backup generator / DG set", "Vehicle", "Forklift", "Air conditioning / chiller", "Boiler / furnace", "Solar inverter", "Other"] },
    { id: "make_model",    label: "Make / model",            type: "text",   placeholder: "e.g. Kirloskar 125 kVA", required: true },
    { id: "facility",      label: "Facility",                type: "select", options: [] },
    { id: "install_date",  label: "Installation date",       type: "date" },
    { id: "replaces",      label: "Replaces existing unit?", type: "select",
      options: ["Yes — old unit decommissioned", "Yes — old unit still running in parallel", "No — additional capacity"] },
  ],
  "Asset decommissioned or retired": [
    { id: "asset_name",    label: "Asset name / description", type: "text",   placeholder: "e.g. 100 kVA backup generator at Main Facility",  required: true },
    { id: "reason",        label: "Reason",                   type: "select",
      options: ["End of life", "Replaced by newer unit", "Facility closure", "Process change", "Other"] },
    { id: "facility",      label: "Facility",                 type: "select", options: [] },
    { id: "retire_date",   label: "Retirement / effective date", type: "date" },
  ],
  "Facility expansion or new location": [
    { id: "facility_name", label: "Facility name",            type: "text",   placeholder: "e.g. Whitefield Office",              required: true },
    { id: "city_state",    label: "City / state",             type: "text",   placeholder: "e.g. Bengaluru, Karnataka" },
    { id: "facility_type", label: "Facility type",            type: "select",
      options: ["Manufacturing plant", "Office / showroom", "Warehouse / distribution centre", "Other"] },
    { id: "ops_from",      label: "Operational from",         type: "date" },
    { id: "floor_area",    label: "Approx. floor area (sq ft)", type: "text", placeholder: "e.g. 25,000" },
  ],
  "Change in process / fuel type": [
    { id: "prev_fuel",     label: "Previous fuel / energy source", type: "select",
      options: ["Diesel", "LPG", "Natural gas", "Grid electricity", "Biomass", "Other"], required: true },
    { id: "new_fuel",      label: "New fuel / energy source",      type: "select",
      options: ["Diesel", "LPG", "Natural gas", "Grid electricity", "Solar", "Wind", "Electric (grid-charged)", "Other"], required: true },
    { id: "facility",      label: "Facility",                      type: "select", options: [] },
    { id: "effective_date", label: "Effective date",               type: "date" },
  ],
  "Vehicle or forklift fleet update": [
    { id: "vehicle_type",  label: "Vehicle type",         type: "select", required: true,
      options: ["Car / SUV", "Truck / lorry", "Forklift (electric)", "Forklift (diesel)", "Two-wheeler", "Other"] },
    { id: "fuel_type",     label: "Fuel type",            type: "select",
      options: ["Diesel", "Petrol", "CNG", "Electric", "Other"] },
    { id: "make_model",    label: "Make / model",         type: "text",   placeholder: "e.g. Mahindra Scorpio, Kion 3T" },
    { id: "reg_serial",    label: "Registration / serial no.", type: "text", placeholder: "e.g. KA-01-AB-1234" },
    { id: "action",        label: "Action",               type: "select",
      options: ["New addition to fleet", "Replacement — old unit retired", "Disposal only (no replacement)"] },
  ],
  "Refrigerant or AC unit change": [
    { id: "ref_old",       label: "Previous refrigerant",    type: "select",
      options: ["R-22", "R-32", "R-410A", "R-134a", "HFC blend", "Unknown", "N/A — new install"] },
    { id: "ref_new",       label: "New refrigerant",         type: "select",
      options: ["R-22", "R-32", "R-410A", "R-134a", "HFC blend", "Other"] },
    { id: "charge_kg",     label: "Refrigerant charge (kg)", type: "text",   placeholder: "e.g. 4.5" },
    { id: "unit_count",    label: "Number of AC units",      type: "text",   placeholder: "e.g. 3" },
    { id: "facility",      label: "Facility",                type: "select", options: [] },
  ],
  "Other boundary change": [
    { id: "scope_affected", label: "Scope affected",  type: "select",
      options: ["Scope 1 only", "Scope 2 only", "Scope 3 only", "Multiple scopes"] },
    { id: "effective_date", label: "Effective date",  type: "date" },
  ],
};

/* ── Inventory update form ──────────────────────────────────────────────────── */
function InventoryUpdateWizard({ year, defaultEntity, onBack }: { year: string; defaultEntity: DataEntryEntity | null; onBack: () => void }) {
  const { entities } = useClientContext();
  const facilityOptions = entities.filter(e => !e.is_consolidated).map(e => e.name);

  const [step, setStep]           = useState<"entity" | "changes" | "review">(defaultEntity ? "changes" : "entity");
  const [entity, setEntity]       = useState<DataEntryEntity | null>(defaultEntity);
  const [changeType, setChangeType] = useState<string[]>([]);
  const [answers, setAnswers]     = useState<Record<string, Record<string, string>>>({});
  const [notes, setNotes]         = useState("");
  const [file, setFile]           = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const CHANGE_TYPES = Object.keys(CHANGE_TYPE_FOLLOWUPS);

  const toggle = (t: string) =>
    setChangeType(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const setAnswer = (type: string, fieldId: string, val: string) =>
    setAnswers(prev => ({ ...prev, [type]: { ...(prev[type] ?? {}), [fieldId]: val } }));

  const submit = async () => {
    if (!entity) { toast.error("Select an entity first."); return; }
    if (changeType.length === 0) { toast.error("Select at least one change type."); return; }
    setSubmitting(true);
    try {
      await authFetch("submissions.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:         "inventory_update",
          entity,
          year,
          change_types: changeType,
          answers,
          notes,
          submitted_at: new Date().toISOString(),
        }),
      });
      toast.success("Inventory update submitted", { description: "The asset register will be updated within 2 business days." });
      setSubmitted(true);
    } catch {
      toast.error("Submission failed — please try again or contact support.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Success screen ── */
  if (submitted) {
    return (
      <div>
        <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> All options
        </button>
        <Card>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <div className="font-bold text-xl text-[var(--navy)]">Inventory update submitted</div>
            <p className="max-w-sm text-sm text-muted-foreground">
              {entity} emissions source register will be updated within 2 business days.
            </p>
            <button onClick={onBack} className="mt-2 rounded-lg bg-[var(--navy)] px-5 py-2 text-sm font-semibold text-white">Done</button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All options
      </button>

      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--navy)] text-white">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <div className="font-bold text-[var(--navy)]">Inventory Update — {year}</div>
          <div className="text-xs text-muted-foreground">Report boundary changes to the emissions source register</div>
        </div>
      </div>

      {/* Step indicators */}
      <div className="mb-6 flex items-center gap-2 text-xs font-semibold">
        {[
          { key: "entity",  label: "1 · Company" },
          { key: "changes", label: "2 · What changed" },
          { key: "review",  label: "3 · Review & submit" },
        ].map((s, i, arr) => (
          <span key={s.key} className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 ${step === s.key ? "bg-[var(--navy)] text-white" : "bg-[var(--muted)] text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < arr.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </span>
        ))}
      </div>

      {/* ── Step 1: Entity ── */}
      {step === "entity" && (
        <Card>
          <EntityPicker value={entity} onChange={(e) => { setEntity(e); setStep("changes"); }} />
        </Card>
      )}

      {/* ── Step 2: Change types + inline follow-ups ── */}
      {step === "changes" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">What changed?</div>
              <p className="text-sm text-muted-foreground mt-0.5">Select everything that applies — follow-up questions appear for each.</p>
            </div>
            <span className="rounded-full border border-[var(--navy)] px-3 py-0.5 text-xs font-bold text-[var(--navy)]">{entity}</span>
          </div>

          {CHANGE_TYPES.map(t => {
            const selected = changeType.includes(t);
            const fields   = CHANGE_TYPE_FOLLOWUPS[t] ?? [];
            return (
              <div key={t} className={`rounded-xl border-2 transition-all ${selected ? "border-[var(--navy)] bg-[color-mix(in_oklab,var(--navy)_4%,white)]" : "border-[var(--border)] bg-white"}`}>
                {/* Checkbox row */}
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                  <input type="checkbox" checked={selected} onChange={() => toggle(t)}
                    className="h-4 w-4 accent-[var(--navy)] shrink-0" />
                  <span className="text-sm font-semibold text-[var(--navy)]">{t}</span>
                </label>

                {/* Follow-up fields — shown when selected */}
                {selected && fields.length > 0 && (
                  <div className="border-t border-dashed px-4 pb-4 pt-3 grid gap-3 sm:grid-cols-2">
                    {fields.map(f => (
                      <div key={f.id}>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {f.label}{f.required && <span className="ml-1 text-red-400">*</span>}
                        </label>
                        {f.type === "select" ? (
                          <select
                            value={answers[t]?.[f.id] ?? ""}
                            onChange={e => setAnswer(t, f.id, e.target.value)}
                            className="w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]"
                          >
                            <option value="">Select…</option>
                            {(f.id === "facility" ? facilityOptions : (f.options ?? [])).map(o => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={f.type}
                            value={answers[t]?.[f.id] ?? ""}
                            onChange={e => setAnswer(t, f.id, e.target.value)}
                            placeholder={f.placeholder}
                            className="w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep("entity")}
              className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-semibold">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={() => { if (changeType.length === 0) { toast.error("Select at least one change type."); return; } setStep("review"); }}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--navy)] px-5 py-2 text-sm font-semibold text-white"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review + notes + file + submit ── */}
      {step === "review" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Summary of selected types */}
          <Card>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Summary</div>
            <div className="space-y-3">
              {changeType.map(t => (
                <div key={t} className="rounded-lg border bg-[var(--muted)] px-3 py-2.5">
                  <div className="text-sm font-semibold text-[var(--navy)]">{t}</div>
                  {answers[t] && Object.entries(answers[t]).filter(([, v]) => v).map(([k, v]) => {
                    const field = (CHANGE_TYPE_FOLLOWUPS[t] ?? []).find(f => f.id === k);
                    return (
                      <div key={k} className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="font-medium shrink-0">{field?.label ?? k}:</span>
                        <span>{v}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <button onClick={() => setStep("changes")}
              className="mt-4 text-xs font-semibold text-[var(--navy)] hover:underline">
              ← Edit changes
            </button>
          </Card>

          {/* Notes + file + submit */}
          <Card>
            <div className="mb-4">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Additional notes (optional)</div>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any context not captured above — dates, contact person, reason for change…"
                className="w-full rounded-lg border bg-[var(--muted)] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--navy)]"
                rows={4} />
            </div>

            <div className="mb-6">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Supporting document (optional)</div>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-dashed bg-[var(--muted)] px-5 py-4 hover:bg-[var(--accent)]">
                <div className="flex items-center gap-3 min-w-0 text-muted-foreground">
                  <FileSpreadsheet className="h-5 w-5 shrink-0" />
                  {file
                    ? <span className="truncate font-mono text-sm font-semibold text-[var(--navy)]">{file.name}</span>
                    : <span className="text-sm">Purchase order, asset spec, or supporting doc</span>
                  }
                </div>
                <span className="shrink-0 rounded-lg bg-[var(--navy)] px-4 py-1.5 text-sm font-semibold text-white">
                  {file ? "Change" : "Browse"}
                </span>
                <input type="file" accept=".pdf,.xlsx,.docx,.png,.jpg" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep("changes")}
                className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-semibold">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button onClick={submit} disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--navy)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                {submitting ? "Submitting…" : "Submit update"}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
function Submissions() {
  const navigate = useNavigate();
  const { entity: viewEntity } = useEntity();
  const { client, entities, reporting_years, config } = useClientContext();
  const consolidatedCode = entities.find(e => e.is_consolidated)?.code;

  // Filter scope cards to match what the client configured in the Annual Setup wizard
  type ScopeConfig = {
    s1_stationary?: boolean; s1_mobile?: boolean; s1_fugitive?: boolean;
    s2_grid?: boolean; s2_renewable?: boolean; s3_included?: boolean;
  };
  const entityScopeMap = useMemo(() => {
    const raw = config?.entity_scope_json;
    if (!raw) return null;
    // context.php auto-decodes JSON config values, so it arrives as an object, not a string.
    // Support both forms defensively.
    if (typeof raw === 'object') return raw as Record<string, ScopeConfig>;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) as Record<string, ScopeConfig>; } catch { return null; }
    }
    return null;
  }, [config?.entity_scope_json]);

  const visibleScopes = useMemo(() => {
    if (!entityScopeMap) return SCOPES;
    const vals = Object.values(entityScopeMap);
    return SCOPES.filter(s => {
      if (s.id === "scope1") return vals.some(v => v.s1_stationary || v.s1_mobile || v.s1_fugitive);
      if (s.id === "scope2") return vals.some(v => v.s2_grid || v.s2_renewable);
      if (s.id === "scope3") return vals.some(v => v.s3_included);
      return true;
    });
  }, [entityScopeMap]);
  const [role, setRole] = useState<ReturnType<typeof getRole>>(null);
  const [year, setYear] = useState("FY26");
  const [subs, setSubs] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [activeScope, setActiveScope] = useState<ScopeId | "ghg-report" | null>(null);

  // Pre-select entity for new submissions unless on the consolidated view.
  const defaultEntity: DataEntryEntity | null = viewEntity === consolidatedCode ? null : viewEntity as DataEntryEntity;

  useEffect(() => {
    const r = getRole();
    if (!r) navigate({ to: "/" });
    setRole(r);
    loadSubmissions(client.slug)
      .then(setSubs)
      .catch((e) => toast.error("Couldn't load submissions", { description: e.message }))
      .finally(() => setSubsLoading(false));
  }, [navigate, client.slug]);

  const refresh = () => loadSubmissions(client.slug).then(setSubs).catch(() => {});

  if (!role) return null;
  if (!ROLE_META[role].canUpload) {
    return (
      <>
        <PageHeader eyebrow="Data Submission" title="Data Submission" />
        <PageBody><LockedState title="Uploads restricted" message="Data submission is available to authorised sustainability team members." /></PageBody>
      </>
    );
  }

  const scope = visibleScopes.find(s => s.id === activeScope);
  const visibleSubs = viewEntity === consolidatedCode ? subs : subs.filter(s => s.entity === viewEntity);

  if (activeScope === "ghg-report" && ROLE_META[role].canAdmin) {
    return (
      <>
        <PageHeader eyebrow="Upload" title="GHG Annual Report — Data Submission" />
        <PageBody>
          <div className="mx-auto max-w-xl">
            <button onClick={() => setActiveScope(null)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> All options
            </button>
            <Card>
              <GhgReportUpload entity={viewEntity} onDone={() => setActiveScope(null)} />
            </Card>
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Upload" title="Data Submission"
        description="Submit activity data, verification documents, or inventory boundary updates. Every submission is tagged to a sub-entity — the consolidated view is calculated automatically."
        right={
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Year</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="rounded-md border bg-card px-3 py-1.5 text-sm">
              {reporting_years.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
        }
      />
      <PageBody>
        {!activeScope ? (
          <div>
            {/* First-time welcome callout — shown until first submission exists */}
            {!subsLoading && visibleSubs.length === 0 && (
              <div className="mb-6 flex items-start gap-4 rounded-2xl border border-[#1E6F5C]/25 bg-gradient-to-r from-[#E6F4EF] to-[#F0FAF5] p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E6F5C]">
                  <Download className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1E4D2B]">Ready to collect your first year of data</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#1E6F5C]">
                    Download the template for each scope below, fill in your activity data, and upload it here.
                    Deepwoods will process each file and notify you within 2 business days.
                  </p>
                </div>
              </div>
            )}
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">What would you like to submit?</div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {/* GHG Annual Report Card — admin role only */}
              {ROLE_META[role].canAdmin && (
                <button onClick={() => setActiveScope("ghg-report")}
                  className="group col-span-1 sm:col-span-2 lg:col-span-full rounded-xl border-2 border-[#1E6F5C] bg-[#E6F4EF]/30 p-5 text-left transition hover:shadow-md hover:-translate-y-0.5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1E6F5C] text-white">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[var(--navy)]">GHG Annual Report — Data Submission</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Download the FY2026 combined data template (all 19 data points), fill it in, and upload here.
                        Deepwoods will be notified automatically to generate your GHG report.
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[#1E6F5C] opacity-60 transition group-hover:opacity-100" />
                  </div>
                </button>
              )}
              {visibleScopes.map(s => (
                <button key={s.id} onClick={() => setActiveScope(s.id)}
                  className="group rounded-xl border bg-white p-5 text-left transition hover:shadow-md hover:-translate-y-0.5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ background: s.accentVar }}>
                    {s.icon}
                  </div>
                  <div className="font-bold tabular-nums text-[var(--navy)]">{s.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--navy-2)] group-hover:gap-2 transition-all">
                    Begin <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </button>
              ))}
              {/* Inventory Update card */}
              <button onClick={() => setActiveScope("inventory")}
                className="group rounded-xl border bg-white p-5 text-left transition hover:shadow-md hover:-translate-y-0.5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--navy)] text-white">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="font-bold tabular-nums text-[var(--navy)]">Inventory Update</div>
                <div className="mt-1 text-xs text-muted-foreground">Report changes to the entity asset boundary — new equipment, decommissioned assets, facility changes.</div>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--navy-2)] group-hover:gap-2 transition-all">
                  Report change <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </button>
            </div>

            {/* Past submissions — skeleton while loading */}
            {subsLoading && (
              <div className="mt-8">
                <Skeleton className="mb-3 h-3 w-36" />
                <div className="overflow-hidden rounded-xl border">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="m-2 h-10 rounded-lg" />
                  ))}
                </div>
              </div>
            )}
            {!subsLoading && visibleSubs.length > 0 && (
              <div className="mt-8">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Recent submissions{viewEntity !== consolidatedCode ? ` — ${viewEntity}` : ""}
                </div>
                <div className="overflow-hidden rounded-xl border bg-white">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-[var(--muted)]">
                      <tr>
                        {["Scope / Category","Entity","Year","Status","Submitted"].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {visibleSubs.map(s => (
                        <tr key={s.id} className="hover:bg-[var(--muted)]">
                          <td className="px-4 py-2.5 font-medium">{s.datasetName}</td>
                          <td className="px-4 py-2.5"><span className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-[var(--navy)]">{s.entity}</span></td>
                          <td className="px-4 py-2.5 text-muted-foreground">{s.year}</td>
                          <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : activeScope === "inventory" ? (
          <InventoryUpdateWizard year={year} defaultEntity={defaultEntity} onBack={() => setActiveScope(null)} />
        ) : scope ? (
          <ScopeWizard scope={scope} year={year} defaultEntity={defaultEntity} onBack={() => { setActiveScope(null); refresh(); }} onSubmitted={refresh} />
        ) : null}
      </PageBody>
    </>
  );
}

/* ── Step-by-step scope wizard ─────────────────────────────────────────────── */
function ScopeWizard({ scope, year, defaultEntity, onBack, onSubmitted }: {
  scope: ScopeDef; year: string; defaultEntity: DataEntryEntity | null; onBack: () => void; onSubmitted: () => void;
}) {
  // Steps: 0=select entity, 1=download template, 2=upload filled template, 3..N=verification docs, N+1=review
  const verDocs = scope.verificationDocs;
  const totalSteps = 4 + verDocs.length; // entity + download + upload data + ver docs + review
  const { client, entities } = useClientContext();
  const [step, setStep] = useState(0);
  const [entity, setEntity] = useState<DataEntryEntity | null>(defaultEntity);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [verFiles, setVerFiles] = useState<Record<string, File | null>>(
    () => Object.fromEntries(verDocs.map(d => [d.id, null]))
  );
  const [submitting, setSubmitting] = useState(false);

  const isEntity = step === 0;
  const isDownload = step === 1;
  const isDataUpload = step === 2;
  const isReview = step === totalSteps - 1;
  const verIdx = step - 3;
  const verDoc = (!isEntity && !isDownload && !isDataUpload && !isReview) ? verDocs[verIdx] : null;

  const progress = (step / (totalSteps - 1)) * 100;

  const submit = async () => {
    if (!entity) { toast.error("Select an entity before submitting."); return; }
    if (!dataFile) { toast.error("Upload the completed data template before submitting."); return; }
    setSubmitting(true);
    try {
      await addSubmission(client.slug, {
        version: "V2", entity, datasetId: scope.id as string,
        datasetName: scope.label, tag: scope.label, year,
        unit: "All in-boundary facilities",
        dataFile, documents: Object.values(verFiles).filter((f): f is File => !!f), notes: "",
      });
      toast.success(`${scope.label} (${entity}) submitted successfully`, {
        description: "Will be verified within 2 business days.",
      });
      onSubmitted(); onBack();
    } catch (e) {
      toast.error("Submission failed", { description: e instanceof Error ? e.message : String(e) });
      setSubmitting(false);
    }
  };

  const stepLabel = isEntity ? "Select company"
    : isDownload ? "Download template"
    : isDataUpload ? "Upload data template"
    : isReview ? "Review & submit"
    : `Verification: ${verDoc?.label}`;

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All scopes
      </button>

      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ background: scope.accentVar }}>
          {scope.icon}
        </div>
        <div>
          <div className="font-bold tabular-nums text-[var(--navy)]">
            {scope.label}{entity ? <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">{entity}</span> : null}
          </div>
          <div className="text-xs text-muted-foreground">{scope.sub}</div>
        </div>
      </div>

      <Card>
        {/* Progress bar */}
        <div className="mb-5">
          <div className="mb-1 flex justify-between text-xs font-semibold text-muted-foreground">
            <span>Step {step + 1} of {totalSteps}</span>
            <span>{stepLabel}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--muted)]">
            <div className="h-2 rounded-full bg-[var(--navy)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* ── Step 0: Entity ── */}
        {isEntity && (
          <div>
            <EntityPicker value={entity} onChange={(e) => { setEntity(e); setStep(1); }} />
          </div>
        )}

        {/* ── Step 1: Download template ── */}
        {isDownload && (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-[#1E6F5C] bg-[#E6F4EF]/40 p-4">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#1E6F5C]">Download template</div>
              <div className="font-semibold text-[var(--navy)]">{scope.template}</div>
              <p className="mt-1 text-xs text-muted-foreground">{scope.templateHint}</p>
              <a href={`/templates/${scope.template}`} download={scope.template}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#1E6F5C] px-4 py-1.5 text-sm font-semibold text-[#1E6F5C] hover:bg-[#E6F4EF]">
                <Download className="h-4 w-4" /> Download template
              </a>
            </div>
            <p className="text-sm text-muted-foreground">Fill in the yellow <em>FY value</em> column for every data point, then click Next to upload the completed file.</p>
          </div>
        )}

        {/* ── Step 2: Upload data template ── */}
        {isDataUpload && (
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Upload completed template</div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-dashed bg-[var(--muted)] px-5 py-4 hover:bg-[var(--accent)]">
              <div className="flex min-w-0 items-center gap-3 text-muted-foreground">
                <FileSpreadsheet className="h-5 w-5 shrink-0" />
                {dataFile
                  ? <span className="truncate font-mono text-sm font-semibold text-[var(--navy)]">{dataFile.name}</span>
                  : <span className="text-sm">Select filled template · .xlsx</span>}
              </div>
              <span className="shrink-0 rounded-lg bg-[var(--navy)] px-4 py-1.5 text-sm font-semibold text-white">{dataFile ? "Change" : "Browse"}</span>
              <input type="file" accept=".xlsx" className="hidden" onChange={e => setDataFile(e.target.files?.[0] ?? null)} />
            </label>
            {dataFile && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> {dataFile.name} ready
              </div>
            )}
          </div>
        )}

        {/* ── Steps 3..N-1: Verification docs ── */}
        {verDoc && (
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{verDoc.label}</div>
            <p className="mb-3 text-sm text-muted-foreground">{verDoc.hint}</p>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-dashed bg-[var(--muted)] px-5 py-4 hover:bg-[var(--accent)]">
              <div className="flex min-w-0 items-center gap-3 text-muted-foreground">
                <FileSpreadsheet className="h-5 w-5 shrink-0" />
                {verFiles[verDoc.id]
                  ? <span className="truncate font-mono text-sm font-semibold text-[var(--navy)]">{verFiles[verDoc.id]!.name}</span>
                  : <span className="text-sm">Optional — {verDoc.accept}</span>}
              </div>
              <span className="shrink-0 rounded-lg bg-[var(--navy)] px-4 py-1.5 text-sm font-semibold text-white">{verFiles[verDoc.id] ? "Change" : "Browse"}</span>
              <input type="file" accept={verDoc.accept} className="hidden"
                onChange={e => setVerFiles(prev => ({ ...prev, [verDoc.id]: e.target.files?.[0] ?? null }))} />
            </label>
          </div>
        )}

        {/* ── Final step: Review ── */}
        {isReview && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-[var(--muted)] px-4 py-3 text-sm">
              <div className="font-semibold text-[var(--navy)] mb-1">Submission summary</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div><span className="font-medium">Entity:</span> {entity} — {entity ? entities.find(e => e.code === entity)?.name ?? entity : ""}</div>
                <div><span className="font-medium">Scope:</span> {scope.label}</div>
                <div><span className="font-medium">Year:</span> {year}</div>
                <div><span className="font-medium">Data file:</span> {dataFile?.name ?? "—"}</div>
                {Object.entries(verFiles).filter(([, f]) => f).map(([id, f]) => {
                  const doc = scope.verificationDocs.find(d => d.id === id);
                  return <div key={id}><span className="font-medium">{doc?.label}:</span> {f!.name}</div>;
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="mt-6 flex justify-between">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : onBack()}
            className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-semibold">
            <ChevronLeft className="h-4 w-4" /> {step === 0 ? "All scopes" : "Back"}
          </button>
          {isReview ? (
            <button onClick={submit} disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--navy)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
              {submitting ? "Submitting…" : "Submit"}
            </button>
          ) : (
            <button
              onClick={() => {
                if (isEntity && !entity) { toast.error("Select an entity first."); return; }
                if (isDataUpload && !dataFile) { toast.error("Upload the completed template first."); return; }
                setStep(s => s + 1);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--navy)] px-5 py-2 text-sm font-semibold text-white">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
export default Submissions;
