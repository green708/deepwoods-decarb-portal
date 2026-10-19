import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { authFetch, changePassword, logout as doLogout, getEmail, getRole } from "@/lib/auth";
import { useClientContext, type ClientEntity } from "@/lib/client-context";
import { useFacilities } from "@/lib/api";
import {
  ArrowRight, Building2, Plus, Trash2, RefreshCw,
  Search, ChevronDown, ChevronUp, Check, Loader2,
  AlertTriangle, MapPin, Users, Calendar, Clock,
  SlidersHorizontal, Info, Lock,
} from "lucide-react";

export const Route = createFileRoute("/_app/register")({ component: RegisterPage });

// ── Types ──────────────────────────────────────────────────────────────────────

type RegisterTab = "summary" | "boundary" | "register";

interface EntityRow {
  id: string;
  name: string;
  ownershipPct: number | "";
  operationalControl: "yes" | "no" | "shared" | "";
  financialControl: "yes" | "no" | "shared" | "";
  country: string;
}

interface JVDetailRow {
  id: string;
  partnerName: string;
  yourStakePct: number | "";
  operatingControl: "you" | "partner" | "shared" | "";
}

interface StructuralChangeRow {
  id: string;
  entityName: string;
  changeType: "acquired" | "divested" | "newly_incorporated" | "closed" | "";
  effectiveDate: string;
}

type ConsolidationApproach = "equity_share" | "financial_control" | "operational_control";

interface BoundaryFormState {
  orgType: "standalone" | "group" | "";
  hasStructuralChange: "yes" | "no" | "";
  structuralChanges: StructuralChangeRow[];
  entityRegister: EntityRow[];
  hasMultiCountryEntities: "yes" | "no" | "";
  hasSharedControlJV: "yes" | "no" | "not_sure" | "";
  jvDetails: JVDetailRow[];
  reportingFrameworks: string[];
  hasPreviouslyReported: "yes" | "no" | "";
  priorConsolidationApproach: ConsolidationApproach | "not_sure" | "";
  financialConsolidationBasis: ConsolidationApproach | "not_sure" | "";
  facilityLevelData: "yes" | "no" | "partial" | "";
  applyMaterialityThreshold: "yes" | "no" | "";
  materialityThresholdPct: number | "";
  boundaryExclusions: string[];
  conflictResolutionChoice: "ghg_recommendation" | "financial_alignment" | "flag_for_review" | "";
  // Base year (GHG Protocol §9)
  baseYear: string;
  baseYearDataSource: string;
  recalculationThresholdPct: number | "";
  // Carbon pricing (CDP C11.2)
  carbonPricingExposure: "yes" | "no" | "under_assessment" | "";
  internalCarbonPriceInr: number | "";
  patObligated: "yes" | "no" | "not_sure" | "";
  // SBTi targets
  sbtiS3TargetPct: number | "";
  sbtiS3BaseYear: string;
  sbtiS3TargetYear: string;
  sbtiValidationStatus: "not_submitted" | "submitted" | "validated" | "";
  // Parent / Ownership Structure
  ownershipType: "ultimate_parent" | "subsidiary" | "";
  parentName: string;
  parentEquityPct: number | "";
  parentReportsConsolidated: "yes" | "no" | "not_sure" | "";
  disclosureType: "standalone" | "feeds_parent" | "both" | "";
}

const EMPTY_FORM: BoundaryFormState = {
  orgType: "",
  hasStructuralChange: "",
  structuralChanges: [],
  entityRegister: [],
  hasMultiCountryEntities: "",
  hasSharedControlJV: "",
  jvDetails: [],
  reportingFrameworks: [],
  hasPreviouslyReported: "",
  priorConsolidationApproach: "",
  financialConsolidationBasis: "",
  facilityLevelData: "",
  applyMaterialityThreshold: "",
  materialityThresholdPct: "",
  boundaryExclusions: [],
  conflictResolutionChoice: "",
  baseYear: "",
  baseYearDataSource: "",
  recalculationThresholdPct: "",
  carbonPricingExposure: "",
  internalCarbonPriceInr: "",
  patObligated: "",
  sbtiS3TargetPct: "",
  sbtiS3BaseYear: "",
  sbtiS3TargetYear: "",
  sbtiValidationStatus: "",
  ownershipType: "",
  parentName: "",
  parentEquityPct: "",
  parentReportsConsolidated: "",
  disclosureType: "",
};

// ── Design tokens ──────────────────────────────────────────────────────────────

const INK        = "#111827";
const MOSS       = "#1E6F5C";
const FOREST     = "#1E4D2B";
const SLATE      = "#5A6872";
const BORDER     = "#E2E8E4";
const CANVAS     = "#F8FAF9";
const WHITE      = "#FFFFFF";
const AMBER      = "#92400E";
const AMBER_BG   = "#FEF3C7";
const AMBER_BORD = "#FDE68A";
const EMERALD    = "#15803D";
const EMERALD_BG = "#DCFCE7";
const GHOST      = "#64748B";
const GHOST_BG   = "#F1F5F9";

// ── Helpers ────────────────────────────────────────────────────────────────────

let _seq = 0;
const genId = () => `r${Date.now()}_${++_seq}`;

const APPROACH_LABEL: Record<ConsolidationApproach | "mixed" | "not_sure", string> = {
  operational_control: "Operational Control",
  financial_control:   "Financial Control",
  equity_share:        "Equity Share",
  mixed:               "Mixed (review needed)",
  not_sure:            "Not sure",
};

function deriveRecommendedApproach(
  rows: EntityRow[]
): ConsolidationApproach | "mixed" | null {
  if (rows.length === 0) return null;
  const allOp  = rows.every(r => r.operationalControl === "yes");
  if (allOp) return "operational_control";
  const allFin = rows.every(r => r.financialControl === "yes");
  if (allFin) return "financial_control";
  return "mixed";
}

function fmtDate(val: string | null | undefined) {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function RadioRow({
  value, selected, label, subtext, onChange,
}: {
  value: string; selected: boolean; label: string; subtext?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      onClick={() => onChange(value)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "14px 16px", borderRadius: 10, cursor: "pointer",
        border: `1px solid ${selected ? MOSS : BORDER}`,
        background: selected ? "#F0FDF8" : WHITE,
        marginBottom: 8, transition: "all 0.12s ease",
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1,
        border: `2px solid ${selected ? MOSS : "#CBD5E1"}`,
        background: selected ? MOSS : WHITE,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: WHITE }} />}
      </div>
      <div>
        <div style={{ fontSize: 14, color: INK, fontWeight: selected ? 600 : 400 }}>{label}</div>
        {subtext && <div style={{ fontSize: 12, color: SLATE, marginTop: 3, lineHeight: 1.5 }}>{subtext}</div>}
      </div>
    </div>
  );
}

function Chip({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
        border: `1.5px solid ${selected ? FOREST : BORDER}`,
        background: selected ? FOREST : WHITE,
        color: selected ? WHITE : SLATE,
        fontWeight: selected ? 600 : 400,
        fontFamily: "inherit",
        transition: "all 0.12s ease",
      }}
    >
      {selected && <Check style={{ width: 11, height: 11, marginRight: 5, display: "inline", verticalAlign: "middle" }} />}
      {label}
    </button>
  );
}

function SectionCard({
  title, subtext, children,
}: { title: string; subtext?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14,
      padding: "22px 24px", marginBottom: 16,
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginBottom: subtext ? 4 : 14 }}>
        {title}
      </div>
      {subtext && (
        <div style={{ fontSize: 13, color: SLATE, marginBottom: 14, lineHeight: 1.5 }}>{subtext}</div>
      )}
      {children}
    </div>
  );
}

function QuestionLabel({
  text, required, subtext,
}: { text: string; required?: boolean; subtext?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>
        {text}{required && <span style={{ color: "#EF4444", marginLeft: 3 }}>•</span>}
      </div>
      {subtext && <div style={{ fontSize: 12, color: SLATE, marginTop: 3, lineHeight: 1.5 }}>{subtext}</div>}
    </div>
  );
}

// ── Structural Changes ─────────────────────────────────────────────────────────

function StructuralChangesSection({
  rows, onAdd, onUpdate, onRemove,
}: {
  rows: StructuralChangeRow[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof StructuralChangeRow, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const inp = (extraStyle?: React.CSSProperties): React.CSSProperties => ({
    width: "100%", padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 8,
    fontSize: 13, fontFamily: "inherit", color: INK, background: WHITE, outline: "none",
    boxSizing: "border-box", ...extraStyle,
  });

  return (
    <div>
      {rows.map((row, idx) => (
        <div key={row.id} style={{
          display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr auto",
          gap: 8, marginBottom: 8, alignItems: "flex-start",
        }}>
          <input
            placeholder="Entity name"
            value={row.entityName}
            onChange={e => onUpdate(row.id, "entityName", e.target.value)}
            style={inp()}
          />
          <select
            value={row.changeType}
            onChange={e => onUpdate(row.id, "changeType", e.target.value)}
            style={inp({ color: row.changeType ? INK : SLATE })}
          >
            <option value="">Change type</option>
            <option value="acquired">Acquired</option>
            <option value="divested">Divested</option>
            <option value="newly_incorporated">Newly incorporated</option>
            <option value="closed">Closed</option>
          </select>
          <input
            type="date"
            value={row.effectiveDate}
            onChange={e => onUpdate(row.id, "effectiveDate", e.target.value)}
            style={inp()}
          />
          <button
            type="button"
            onClick={() => onRemove(row.id)}
            style={{ padding: "8px", border: `1px solid ${BORDER}`, borderRadius: 8, background: WHITE, cursor: "pointer", color: SLATE, lineHeight: 1 }}
          >
            <Trash2 style={{ width: 14, height: 14 }} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1.5px dashed ${BORDER}`, background: CANVAS, color: SLATE, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
      >
        <Plus style={{ width: 13, height: 13 }} /> Add entry
      </button>
    </div>
  );
}

// ── Entity Register Table ──────────────────────────────────────────────────────

function EntityRegisterTable({
  rows, onAdd, onUpdate, onRemove,
}: {
  rows: EntityRow[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof EntityRow, value: string | number) => void;
  onRemove: (id: string) => void;
}) {
  const ctrlOpts = [
    { label: "Yes", value: "yes" },
    { label: "No",  value: "no" },
    { label: "Shared", value: "shared" },
  ];

  return (
    <div>
      {rows.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: CANVAS }}>
                {["Entity name", "% Ownership", "Operational control", "Financial control", "Country", ""].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: SLATE, borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "8px 10px", minWidth: 160 }}>
                    <input
                      placeholder="Entity name"
                      value={row.name}
                      onChange={e => onUpdate(row.id, "name", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none", color: INK, boxSizing: "border-box" }}
                    />
                  </td>
                  <td style={{ padding: "8px 10px", minWidth: 90 }}>
                    <input
                      type="number"
                      min={0} max={100}
                      placeholder="0–100"
                      value={row.ownershipPct}
                      onChange={e => onUpdate(row.id, "ownershipPct", e.target.value === "" ? "" : parseFloat(e.target.value))}
                      style={{ width: "100%", padding: "6px 8px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none", color: INK, boxSizing: "border-box" }}
                    />
                  </td>
                  <td style={{ padding: "8px 10px", minWidth: 130 }}>
                    <select
                      value={row.operationalControl}
                      onChange={e => onUpdate(row.id, "operationalControl", e.target.value)}
                      style={{ width: "100%", padding: "7px 8px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, fontFamily: "inherit", color: row.operationalControl ? INK : SLATE, background: WHITE, outline: "none" }}
                    >
                      <option value="">—</option>
                      {ctrlOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "8px 10px", minWidth: 130 }}>
                    <select
                      value={row.financialControl}
                      onChange={e => onUpdate(row.id, "financialControl", e.target.value)}
                      style={{ width: "100%", padding: "7px 8px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, fontFamily: "inherit", color: row.financialControl ? INK : SLATE, background: WHITE, outline: "none" }}
                    >
                      <option value="">—</option>
                      {ctrlOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "8px 10px", minWidth: 110 }}>
                    <input
                      placeholder="Country"
                      value={row.country}
                      onChange={e => onUpdate(row.id, "country", e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none", color: INK, boxSizing: "border-box" }}
                    />
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <button
                      type="button"
                      onClick={() => onRemove(row.id)}
                      style={{ padding: 6, border: `1px solid ${BORDER}`, borderRadius: 6, background: WHITE, cursor: "pointer", color: SLATE, lineHeight: 1 }}
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        onClick={onAdd}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1.5px dashed ${BORDER}`, background: CANVAS, color: SLATE, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
      >
        <Plus style={{ width: 13, height: 13 }} /> Add entity
      </button>
      {rows.length === 0 && (
        <p style={{ fontSize: 12, color: SLATE, marginTop: 8 }}>At least one entity is required.</p>
      )}
    </div>
  );
}

// ── JV Details ─────────────────────────────────────────────────────────────────

function JVDetailsSection({
  rows, onAdd, onUpdate, onRemove,
}: {
  rows: JVDetailRow[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof JVDetailRow, value: string | number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 12, padding: "14px 16px", background: CANVAS, borderRadius: 10, border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 10 }}>JV / Joint operation details</div>
      {rows.map(row => (
        <div key={row.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr auto", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Partner name"
            value={row.partnerName}
            onChange={e => onUpdate(row.id, "partnerName", e.target.value)}
            style={{ padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", color: INK }}
          />
          <input
            type="number" min={0} max={100}
            placeholder="Your % stake"
            value={row.yourStakePct}
            onChange={e => onUpdate(row.id, "yourStakePct", e.target.value === "" ? "" : parseFloat(e.target.value))}
            style={{ padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", color: INK }}
          />
          <select
            value={row.operatingControl}
            onChange={e => onUpdate(row.id, "operatingControl", e.target.value)}
            style={{ padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 7, fontSize: 13, fontFamily: "inherit", color: row.operatingControl ? INK : SLATE, background: WHITE, outline: "none" }}
          >
            <option value="">Day-to-day control</option>
            <option value="you">You</option>
            <option value="partner">Partner</option>
            <option value="shared">Genuinely shared</option>
          </select>
          <button
            type="button"
            onClick={() => onRemove(row.id)}
            style={{ padding: 7, border: `1px solid ${BORDER}`, borderRadius: 7, background: WHITE, cursor: "pointer", color: SLATE, lineHeight: 1 }}
          >
            <Trash2 style={{ width: 13, height: 13 }} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7, border: `1.5px dashed ${BORDER}`, background: WHITE, color: SLATE, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
      >
        <Plus style={{ width: 12, height: 12 }} /> Add JV
      </button>
    </div>
  );
}

// ── Reporting Boundary Tab ─────────────────────────────────────────────────────

function ReportingBoundaryTab({
  form, onChange, onSave, saveStatus,
}: {
  form: BoundaryFormState;
  onChange: (patch: Partial<BoundaryFormState>) => void;
  onSave: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
}) {
  const isGroup      = form.orgType === "group";
  const isStandalone = form.orgType === "standalone";

  const frameworks = ["CDP", "BRSR", "GRI", "SBTi", "Investor / ESG due diligence", "Internal only"];
  const exclusions  = [
    "Toll / contract manufacturing",
    "Franchised outlets",
    "Leased-out assets (you're the lessor)",
    "Leased-in assets (you're the lessee)",
    "None of these",
  ];

  const toggleFramework = (f: string) => {
    const cur = form.reportingFrameworks;
    onChange({ reportingFrameworks: cur.includes(f) ? cur.filter(x => x !== f) : [...cur, f] });
  };
  const toggleExclusion = (e: string) => {
    if (e === "None of these") {
      onChange({ boundaryExclusions: form.boundaryExclusions.includes(e) ? [] : ["None of these"] });
      return;
    }
    const cur = form.boundaryExclusions.filter(x => x !== "None of these");
    onChange({ boundaryExclusions: cur.includes(e) ? cur.filter(x => x !== e) : [...cur, e] });
  };

  const addEntity        = () => onChange({ entityRegister: [...form.entityRegister, { id: genId(), name: "", ownershipPct: "", operationalControl: "", financialControl: "", country: "" }] });
  const updateEntity     = (id: string, field: keyof EntityRow, value: string | number) => onChange({ entityRegister: form.entityRegister.map(r => r.id === id ? { ...r, [field]: value } : r) });
  const removeEntity     = (id: string) => onChange({ entityRegister: form.entityRegister.filter(r => r.id !== id) });

  const addStructural    = () => onChange({ structuralChanges: [...form.structuralChanges, { id: genId(), entityName: "", changeType: "", effectiveDate: "" }] });
  const updateStructural = (id: string, field: keyof StructuralChangeRow, value: string) => onChange({ structuralChanges: form.structuralChanges.map(r => r.id === id ? { ...r, [field]: value } : r) });
  const removeStructural = (id: string) => onChange({ structuralChanges: form.structuralChanges.filter(r => r.id !== id) });

  const addJV            = () => onChange({ jvDetails: [...form.jvDetails, { id: genId(), partnerName: "", yourStakePct: "", operatingControl: "" }] });
  const updateJV         = (id: string, field: keyof JVDetailRow, value: string | number) => onChange({ jvDetails: form.jvDetails.map(r => r.id === id ? { ...r, [field]: value } : r) });
  const removeJV         = (id: string) => onChange({ jvDetails: form.jvDetails.filter(r => r.id !== id) });

  // Recommendation logic
  const recommended = isGroup ? deriveRecommendedApproach(form.entityRegister) : null;
  const mixedEntities = isGroup && recommended === "mixed"
    ? form.entityRegister.filter(e => e.operationalControl !== "yes" && e.financialControl !== "yes")
    : [];

  const ghgApproach: ConsolidationApproach | null = recommended === "mixed" ? "equity_share"
    : recommended === null ? null : recommended;
  const finBasis = form.financialConsolidationBasis;
  const hasConflict = ghgApproach && finBasis && finBasis !== "not_sure" && finBasis !== ghgApproach;
  const priorDiffers = form.hasPreviouslyReported === "yes"
    && form.priorConsolidationApproach
    && form.priorConsolidationApproach !== "not_sure"
    && ghgApproach
    && form.priorConsolidationApproach !== ghgApproach;

  return (
    <div>
      {/* Info box */}
      <div style={{ display: "flex", gap: 12, padding: "14px 18px", background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 12, marginBottom: 24 }}>
        <Info style={{ width: 16, height: 16, color: "#0284C7", flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: "#0369A1", lineHeight: 1.6 }}>
          This defines how emissions across your entities get consolidated for GHG reporting, per the GHG Protocol Corporate Standard. Fill this once — it applies to every legal entity you register.
        </div>
      </div>

      {/* Q1: Organisation type */}
      <SectionCard title="What best describes your organisation?" >
        <RadioRow value="standalone" selected={form.orgType === "standalone"} label="Standalone — a single legal entity with no subsidiaries, JVs, or associates" onChange={v => onChange({ orgType: v as any })} />
        <RadioRow value="group"      selected={form.orgType === "group"}      label="Group — a parent with one or more subsidiaries, JVs, associates, or franchises" onChange={v => onChange({ orgType: v as any })} />
      </SectionCard>

      {/* Parent / Ownership Structure */}
      <SectionCard title="Is your organisation owned or controlled by another company?">
        <RadioRow value="ultimate_parent" selected={form.ownershipType === "ultimate_parent"} label="We are the ultimate parent / top of our structure" onChange={v => onChange({ ownershipType: v as any })} />
        <RadioRow value="subsidiary"      selected={form.ownershipType === "subsidiary"}      label="We are a subsidiary of another company, reporting independently" onChange={v => onChange({ ownershipType: v as any })} />
      </SectionCard>

      {form.ownershipType === "subsidiary" && (
        <>
          <SectionCard title="What is the name of your immediate parent / holding company?">
            <input
              type="text"
              value={form.parentName}
              onChange={e => onChange({ parentName: e.target.value })}
              placeholder="e.g. Acme Holdings Ltd"
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </SectionCard>

          <SectionCard title="What % of your entity's equity is held by that parent?">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="number"
                min={0}
                max={100}
                value={form.parentEquityPct}
                onChange={e => onChange({ parentEquityPct: e.target.value === "" ? "" : Number(e.target.value) })}
                placeholder="0–100"
                style={{ width: 120, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              <span style={{ fontSize: 13, color: SLATE }}>%</span>
            </div>
          </SectionCard>

          <SectionCard title="Does your parent (or its ultimate holding company) publicly report consolidated GHG emissions that may already include your entity?">
            <RadioRow value="yes"      selected={form.parentReportsConsolidated === "yes"}      label="Yes" onChange={v => onChange({ parentReportsConsolidated: v as any })} />
            <RadioRow value="no"       selected={form.parentReportsConsolidated === "no"}       label="No" onChange={v => onChange({ parentReportsConsolidated: v as any })} />
            <RadioRow value="not_sure" selected={form.parentReportsConsolidated === "not_sure"} label="Not sure" onChange={v => onChange({ parentReportsConsolidated: v as any })} />
            {form.parentReportsConsolidated === "yes" && form.parentName && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, fontSize: 13, color: "#92400E", lineHeight: 1.6 }}>
                <strong>Note:</strong> To avoid double-counting across the combined group, disclose in your report that your emissions may also appear in <strong>{form.parentName}</strong>'s consolidated inventory.
              </div>
            )}
          </SectionCard>

          <SectionCard title="Is this boundary a stand-alone disclosure, or does it feed into your parent's consolidated report?">
            <RadioRow value="standalone"   selected={form.disclosureType === "standalone"}   label="Stand-alone disclosure only" onChange={v => onChange({ disclosureType: v as any })} />
            <RadioRow value="feeds_parent" selected={form.disclosureType === "feeds_parent"} label="Feeds into parent's consolidated report" onChange={v => onChange({ disclosureType: v as any })} />
            <RadioRow value="both"         selected={form.disclosureType === "both"}         label="Both" onChange={v => onChange({ disclosureType: v as any })} />
          </SectionCard>
        </>
      )}

      {/* Standalone banner */}
      {isStandalone && (
        <div style={{ padding: "16px 20px", background: "#F0FDF8", border: `1px solid ${MOSS}`, borderRadius: 12, marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Check style={{ width: 17, height: 17, color: MOSS, flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: MOSS, marginBottom: 4 }}>Not applicable — reporting boundary is this single entity</div>
            <div style={{ fontSize: 13, color: "#065F46", lineHeight: 1.5 }}>No consolidation approach is required since there are no subsidiaries, JVs, or associates. Complete the questions below for framework reporting purposes.</div>
          </div>
        </div>
      )}

      {/* Group-only: Structural changes */}
      {isGroup && (
        <SectionCard title="Have there been any structural changes among your entities in the current or preceding reporting year?">
          <RadioRow value="no"  selected={form.hasStructuralChange === "no"}  label="No" onChange={v => onChange({ hasStructuralChange: v as any })} />
          <RadioRow value="yes" selected={form.hasStructuralChange === "yes"} label="Yes — acquisitions, divestitures, new incorporations, or closures" onChange={v => onChange({ hasStructuralChange: v as any })} />
          {form.hasStructuralChange === "yes" && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, color: SLATE, marginBottom: 8 }}>List each structural change below.</div>
              <StructuralChangesSection
                rows={form.structuralChanges}
                onAdd={addStructural}
                onUpdate={updateStructural}
                onRemove={removeStructural}
              />
            </div>
          )}
        </SectionCard>
      )}

      {/* Group-only: Entity Register */}
      {isGroup && (
        <SectionCard
          title="Entity Register"
          subtext="List every subsidiary, JV, or associate. We'll use this to determine control on an entity-by-entity basis instead of one blanket answer."
        >
          <EntityRegisterTable
            rows={form.entityRegister}
            onAdd={addEntity}
            onUpdate={updateEntity}
            onRemove={removeEntity}
          />

          {/* Q8: Multi-country flag */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
            <QuestionLabel text="Do any of your entities operate in a different country from your primary reporting country?" />
            <div style={{ display: "flex", gap: 8 }}>
              {["yes", "no"].map(v => (
                <RadioRow key={v} value={v} selected={form.hasMultiCountryEntities === v} label={v === "yes" ? "Yes" : "No"} onChange={val => onChange({ hasMultiCountryEntities: val as any })} />
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Group-only: JV shared control */}
      {isGroup && (
        <SectionCard title="Do you have any joint ventures or joint operations with shared / 50-50 control?">
          <RadioRow value="no"       selected={form.hasSharedControlJV === "no"}       label="No" onChange={v => onChange({ hasSharedControlJV: v as any })} />
          <RadioRow value="yes"      selected={form.hasSharedControlJV === "yes"}      label="Yes" onChange={v => onChange({ hasSharedControlJV: v as any })} />
          <RadioRow value="not_sure" selected={form.hasSharedControlJV === "not_sure"} label="Not sure" onChange={v => onChange({ hasSharedControlJV: v as any })} />
          {form.hasSharedControlJV === "yes" && (
            <JVDetailsSection
              rows={form.jvDetails}
              onAdd={addJV}
              onUpdate={updateJV}
              onRemove={removeJV}
            />
          )}
        </SectionCard>
      )}

      {/* Q: Reporting frameworks */}
      <SectionCard title="Which reporting frameworks or requirements is this for?">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {frameworks.map(f => (
            <Chip key={f} label={f} selected={form.reportingFrameworks.includes(f)} onClick={() => toggleFramework(f)} />
          ))}
        </div>
      </SectionCard>

      {/* Q: Previously reported */}
      <SectionCard title="Have you previously reported emissions under a named consolidation approach?">
        <RadioRow value="no"  selected={form.hasPreviouslyReported === "no"}  label="No" onChange={v => onChange({ hasPreviouslyReported: v as any })} />
        <RadioRow value="yes" selected={form.hasPreviouslyReported === "yes"} label="Yes" onChange={v => onChange({ hasPreviouslyReported: v as any })} />

        {form.hasPreviouslyReported === "yes" && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
            <QuestionLabel text="Which consolidation approach was used in that prior reporting?" />
            <RadioRow value="operational_control" selected={form.priorConsolidationApproach === "operational_control"} label="Operational Control" onChange={v => onChange({ priorConsolidationApproach: v as any })} />
            <RadioRow value="financial_control"   selected={form.priorConsolidationApproach === "financial_control"}   label="Financial Control"   onChange={v => onChange({ priorConsolidationApproach: v as any })} />
            <RadioRow value="equity_share"        selected={form.priorConsolidationApproach === "equity_share"}        label="Equity Share"        onChange={v => onChange({ priorConsolidationApproach: v as any })} />
            <RadioRow value="not_sure"            selected={form.priorConsolidationApproach === "not_sure"}            label="Not sure"            onChange={v => onChange({ priorConsolidationApproach: v as any })} />

            {priorDiffers && (
              <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: AMBER_BG, border: `1px solid ${AMBER_BORD}`, borderRadius: 10, marginTop: 8 }}>
                <AlertTriangle style={{ width: 15, height: 15, color: "#D97706", flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: AMBER, lineHeight: 1.5 }}>
                  <strong>Note:</strong> this differs from your previously reported approach ({APPROACH_LABEL[form.priorConsolidationApproach as ConsolidationApproach]}). Changing consolidation approach may require a base-year boundary recalculation review.
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Q2: Financial consolidation basis */}
      <SectionCard
        title="What consolidation basis do your consolidated financial statements use (if any)?"
        subtext="This lets us check the GHG boundary against your financial reporting boundary — some frameworks (e.g. SBTi) expect them to align."
      >
        <RadioRow value="equity_share"        selected={form.financialConsolidationBasis === "equity_share"}        label="Equity Share"                 onChange={v => onChange({ financialConsolidationBasis: v as any })} />
        <RadioRow value="financial_control"   selected={form.financialConsolidationBasis === "financial_control"}   label="Financial Control"            onChange={v => onChange({ financialConsolidationBasis: v as any })} />
        <RadioRow value="operational_control" selected={form.financialConsolidationBasis === "operational_control"} label="Operational Control"          onChange={v => onChange({ financialConsolidationBasis: v as any })} />
        <RadioRow value="not_sure"            selected={form.financialConsolidationBasis === "not_sure"}            label="Not sure / not applicable"    onChange={v => onChange({ financialConsolidationBasis: v as any })} />
      </SectionCard>

      {/* Q: Facility-level data */}
      <SectionCard title="Can you provide facility-level activity data for data collection?">
        <RadioRow value="yes"     selected={form.facilityLevelData === "yes"}     label="Yes — for all facilities"          onChange={v => onChange({ facilityLevelData: v as any })} />
        <RadioRow value="partial" selected={form.facilityLevelData === "partial"} label="Partially — for some facilities"   onChange={v => onChange({ facilityLevelData: v as any })} />
        <RadioRow value="no"      selected={form.facilityLevelData === "no"}      label="No — group-level data only"        onChange={v => onChange({ facilityLevelData: v as any })} />
      </SectionCard>

      {/* Group-only: Materiality threshold */}
      {isGroup && (
        <SectionCard
          title="Do you want to apply a materiality threshold to exclude immaterial entities from this boundary?"
          subtext="e.g. entities contributing less than a set % of total group revenue or emissions can be excluded from data collection, per GHG Protocol materiality guidance."
        >
          <RadioRow value="no"  selected={form.applyMaterialityThreshold === "no"}  label="No — include all entities" onChange={v => onChange({ applyMaterialityThreshold: v as any })} />
          <RadioRow value="yes" selected={form.applyMaterialityThreshold === "yes"} label="Yes — apply a materiality threshold" onChange={v => onChange({ applyMaterialityThreshold: v as any })} />
          {form.applyMaterialityThreshold === "yes" && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: INK }}>Exclude entities below</span>
              <input
                type="number" min={0} max={100}
                value={form.materialityThresholdPct}
                onChange={e => onChange({ materialityThresholdPct: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                style={{ width: 70, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", color: INK, textAlign: "center" }}
              />
              <span style={{ fontSize: 13, color: INK }}>% of total group revenue or emissions.</span>
            </div>
          )}
        </SectionCard>
      )}

      {/* Base Year & Recalculation Policy — GHG Protocol §9, SBTi requirement */}
      <SectionCard
        title="What is your GHG inventory base year?"
        subtext="The base year is the reference point for measuring emissions changes over time. Required by GHG Protocol, SBTi, and CDP. Use the earliest year for which reliable data exists."
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: INK, fontWeight: 500, minWidth: 80 }}>Base year</span>
          <input
            type="text"
            placeholder="e.g. FY23, 2023"
            value={form.baseYear}
            onChange={e => onChange({ baseYear: e.target.value })}
            style={{ width: 140, padding: "8px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", color: INK }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: INK, fontWeight: 500, minWidth: 80 }}>Data source</span>
          <input
            type="text"
            placeholder="e.g. Audited financial records, utility bills"
            value={form.baseYearDataSource}
            onChange={e => onChange({ baseYearDataSource: e.target.value })}
            style={{ flex: 1, padding: "8px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", color: INK }}
          />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 8 }}>
          Base year recalculation policy
        </div>
        <div style={{ fontSize: 12, color: SLATE, marginBottom: 10, lineHeight: 1.5 }}>
          GHG Protocol requires defining when a structural change is significant enough to require recalculating the base year boundary (e.g. an acquisition contributing more than X% of emissions).
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: INK }}>Recalculate if a change contributes more than</span>
          <input
            type="number" min={1} max={50}
            value={form.recalculationThresholdPct}
            onChange={e => onChange({ recalculationThresholdPct: e.target.value === "" ? "" : parseFloat(e.target.value) })}
            style={{ width: 70, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", color: INK, textAlign: "center" }}
          />
          <span style={{ fontSize: 13, color: INK }}>% of total emissions</span>
        </div>
        <div style={{ marginTop: 10, padding: "8px 12px", background: CANVAS, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: SLATE }}>
          GHG Protocol recommends 5% as a typical significance threshold. SBTi requires recalculation for any acquisition or divestiture that materially changes the baseline.
        </div>
      </SectionCard>

      {/* SBTi Targets — near-term S3 and validation status */}
      {form.reportingFrameworks.includes("SBTi") && (
        <SectionCard
          title="SBTi target details"
          subtext="Science Based Targets initiative requires both a near-term Scope 1+2 target and a separate near-term Scope 3 target covering at least 67% of Scope 3 emissions, plus a long-term net-zero target."
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 10 }}>Near-term Scope 3 reduction target</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: INK }}>Reduce Scope 3 by</span>
            <input
              type="number" min={0} max={100}
              value={form.sbtiS3TargetPct}
              onChange={e => onChange({ sbtiS3TargetPct: e.target.value === "" ? "" : parseFloat(e.target.value) })}
              style={{ width: 70, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", color: INK, textAlign: "center" }}
            />
            <span style={{ fontSize: 13, color: INK }}>% from base year</span>
            <input
              type="text" placeholder="Base year (e.g. FY23)"
              value={form.sbtiS3BaseYear}
              onChange={e => onChange({ sbtiS3BaseYear: e.target.value })}
              style={{ width: 140, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", color: INK }}
            />
            <span style={{ fontSize: 13, color: INK }}>by</span>
            <input
              type="text" placeholder="Target year (e.g. 2030)"
              value={form.sbtiS3TargetYear}
              onChange={e => onChange({ sbtiS3TargetYear: e.target.value })}
              style={{ width: 120, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", color: INK }}
            />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 8 }}>SBTi validation status</div>
          <RadioRow value="not_submitted" selected={form.sbtiValidationStatus === "not_submitted"} label="Not yet submitted to SBTi" onChange={v => onChange({ sbtiValidationStatus: v as any })} />
          <RadioRow value="submitted"     selected={form.sbtiValidationStatus === "submitted"}     label="Submitted — awaiting SBTi validation" onChange={v => onChange({ sbtiValidationStatus: v as any })} />
          <RadioRow value="validated"     selected={form.sbtiValidationStatus === "validated"}     label="SBTi validated" subtext="Targets confirmed by SBTi. This status will appear as a badge on your dashboard." onChange={v => onChange({ sbtiValidationStatus: v as any })} />
        </SectionCard>
      )}

      {/* Carbon Pricing — CDP C11.2, BRSR, India CCTS/PAT */}
      <SectionCard
        title="Is your organisation subject to any carbon pricing regulations or schemes?"
        subtext="Required by CDP C11.2. Relevant for Indian manufacturers subject to CCTS, PAT, or voluntary carbon markets."
      >
        <RadioRow value="no"               selected={form.carbonPricingExposure === "no"}               label="No — not currently subject to any carbon pricing" onChange={v => onChange({ carbonPricingExposure: v as any })} />
        <RadioRow value="under_assessment" selected={form.carbonPricingExposure === "under_assessment"} label="Under assessment — we're checking our obligations" onChange={v => onChange({ carbonPricingExposure: v as any })} />
        <RadioRow value="yes"              selected={form.carbonPricingExposure === "yes"}              label="Yes — we are subject to one or more schemes" onChange={v => onChange({ carbonPricingExposure: v as any })} />

        {form.carbonPricingExposure === "yes" && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 10 }}>Are you a designated consumer under the BEE PAT scheme?</div>
            <RadioRow value="yes"      selected={form.patObligated === "yes"}      label="Yes — we have a PAT cycle obligation" onChange={v => onChange({ patObligated: v as any })} />
            <RadioRow value="no"       selected={form.patObligated === "no"}       label="No" onChange={v => onChange({ patObligated: v as any })} />
            <RadioRow value="not_sure" selected={form.patObligated === "not_sure"} label="Not sure" onChange={v => onChange({ patObligated: v as any })} />

            <div style={{ fontSize: 13, fontWeight: 600, color: INK, margin: "14px 0 8px" }}>Do you use an internal carbon price?</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: INK }}>Internal price:</span>
              <input
                type="number" min={0}
                value={form.internalCarbonPriceInr}
                onChange={e => onChange({ internalCarbonPriceInr: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                style={{ width: 100, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", color: INK }}
              />
              <span style={{ fontSize: 13, color: INK }}>₹ per tCO₂e</span>
              <span style={{ fontSize: 12, color: SLATE }}>(leave blank if not used)</span>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Q9: Boundary exclusions */}
      {isGroup && (
        <SectionCard title="Which of these apply to your operations? Select all that apply.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {exclusions.map(e => (
              <Chip key={e} label={e} selected={form.boundaryExclusions.includes(e)} onClick={() => toggleExclusion(e)} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Q10: Confirmation / Conflict banner */}
      {form.orgType && (
        <div style={{ marginBottom: 24 }}>
          {isStandalone ? (
            <div style={{ padding: "18px 22px", background: "#F0FDF8", border: `1.5px solid ${MOSS}`, borderRadius: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Check style={{ width: 16, height: 16, color: MOSS }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: MOSS }}>Consolidation approach: Not applicable</span>
              </div>
              <div style={{ fontSize: 13, color: "#065F46", lineHeight: 1.5 }}>As a standalone entity, no consolidation is required. Your reporting boundary is this single legal entity.</div>
            </div>
          ) : recommended === null ? (
            <div style={{ padding: "16px 20px", background: CANVAS, border: `1px solid ${BORDER}`, borderRadius: 14, fontSize: 13, color: SLATE }}>
              Complete the entity register above to see your consolidation approach recommendation.
            </div>
          ) : recommended === "mixed" ? (
            <div style={{ padding: "18px 22px", background: AMBER_BG, border: `1.5px solid ${AMBER_BORD}`, borderRadius: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                <AlertTriangle style={{ width: 17, height: 17, color: "#D97706", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: AMBER, marginBottom: 4 }}>Mixed control across entities — review needed</div>
                  <div style={{ fontSize: 13, color: "#78350F", lineHeight: 1.5 }}>
                    Control is mixed across your entities. The GHG Protocol-compliant fallback for mixed-control groups is <strong>Equity Share</strong>. A Deepwoods analyst should confirm entity-by-entity.
                    {mixedEntities.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        Entities with mixed/unclear control: {mixedEntities.map(e => e.name || "(unnamed)").join(", ")}.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : hasConflict ? (
            <div style={{ padding: "18px 22px", background: AMBER_BG, border: `1.5px solid ${AMBER_BORD}`, borderRadius: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 }}>
                <AlertTriangle style={{ width: 17, height: 17, color: "#D97706", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: AMBER, marginBottom: 4 }}>Consolidation approach conflict detected</div>
                  <div style={{ fontSize: 13, color: "#78350F", lineHeight: 1.5 }}>
                    Based on operational control, we'd recommend <strong>{APPROACH_LABEL[recommended]}</strong>. Based on your financial statements, your basis is <strong>{APPROACH_LABEL[finBasis as ConsolidationApproach]}</strong>. These should usually align, especially if you're reporting to SBTi.
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: AMBER, marginBottom: 8 }}>How would you like to proceed?</div>
              <RadioRow value="ghg_recommendation" selected={form.conflictResolutionChoice === "ghg_recommendation"} label={`Use the GHG Protocol recommendation (${APPROACH_LABEL[recommended]})`} onChange={v => onChange({ conflictResolutionChoice: v as any })} />
              <RadioRow value="financial_alignment" selected={form.conflictResolutionChoice === "financial_alignment"} label={`Align to financial statements (${APPROACH_LABEL[finBasis as ConsolidationApproach]})`} onChange={v => onChange({ conflictResolutionChoice: v as any })} />
              <RadioRow value="flag_for_review"     selected={form.conflictResolutionChoice === "flag_for_review"}     label="Flag for a Deepwoods Green analyst to review before finalising" onChange={v => onChange({ conflictResolutionChoice: v as any })} />
              {form.conflictResolutionChoice === "flag_for_review" && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: WHITE, border: `1px solid ${AMBER_BORD}`, borderRadius: 8, fontSize: 13, color: AMBER }}>
                  Pending analyst review — consolidation approach not yet confirmed.
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "18px 22px", background: "#F0FDF8", border: `1.5px solid ${MOSS}`, borderRadius: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Check style={{ width: 16, height: 16, color: MOSS }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: MOSS }}>Recommended consolidation approach: {APPROACH_LABEL[recommended]}</span>
              </div>
              <div style={{ fontSize: 13, color: "#065F46", lineHeight: 1.5 }}>
                Based on the control profile across your entity register. All entities report 100% of emissions under this approach.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
        {saveStatus === "saving" && (
          <span style={{ fontSize: 13, color: SLATE, display: "flex", alignItems: "center", gap: 6 }}>
            <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Saving…
          </span>
        )}
        {saveStatus === "saved" && (
          <span style={{ fontSize: 13, color: MOSS, display: "flex", alignItems: "center", gap: 6 }}>
            <Check style={{ width: 14, height: 14 }} /> Saved
          </span>
        )}
        {saveStatus === "error" && (
          <span style={{ fontSize: 13, color: "#DC2626" }}>Save failed — try again</span>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saveStatus === "saving"}
          style={{
            padding: "10px 24px", borderRadius: 10, border: "none",
            background: `linear-gradient(135deg, ${FOREST}, ${MOSS})`,
            color: WHITE, fontSize: 14, fontWeight: 700,
            cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
            opacity: saveStatus === "saving" ? 0.7 : 1,
            fontFamily: "inherit", boxShadow: "0 3px 10px rgba(30,111,92,0.3)",
          }}
        >
          Save changes
        </button>
      </div>
    </div>
  );
}

// ── Setup Summary Tab ──────────────────────────────────────────────────────────

function SetupSummaryTab({
  form, entityCount, paymentUnlocked, setupComplete, onGoToBoundary, onSubmitSetup, isSubmitting,
}: {
  form: BoundaryFormState;
  entityCount: number;
  paymentUnlocked: boolean;
  setupComplete: boolean;
  onGoToBoundary: () => void;
  onSubmitSetup?: () => Promise<void>;
  isSubmitting?: boolean;
}) {

  const recommended = form.orgType === "group"
    ? deriveRecommendedApproach(form.entityRegister)
    : form.orgType === "standalone" ? "standalone" : null;

  const boundaryConfirmed = form.orgType !== "" && (form.orgType === "standalone" || form.entityRegister.length > 0);

  const steps = [
    {
      label: "Sign up",
      status: "done",
      detail: "Account created",
    },
    {
      label: "Reporting Boundary",
      status: boundaryConfirmed ? "confirmed" : setupComplete ? "pending" : "pending",
      detail: boundaryConfirmed
        ? (recommended === "standalone" ? "Not applicable — standalone entity"
            : recommended ? `${APPROACH_LABEL[recommended]} confirmed`
            : "In progress")
        : "Not yet filled",
    },
    {
      label: "Register your entities",
      status: entityCount > 0 ? "confirmed" : "pending",
      detail: entityCount > 0 ? `${entityCount} ${entityCount === 1 ? "entity" : "entities"} registered` : "No entities yet",
    },
  ];

  const statusBadge = (status: string) => {
    if (status === "done") return { bg: EMERALD_BG, color: EMERALD, border: "#86EFAC", text: "✓ Done" };
    if (status === "confirmed") return { bg: EMERALD_BG, color: EMERALD, border: "#86EFAC", text: "Confirmed" };
    return { bg: GHOST_BG, color: GHOST, border: BORDER, text: "Pending" };
  };

  const ghgApproach = recommended === "standalone" ? "Not applicable"
    : recommended === "mixed" ? "Mixed — review needed"
    : recommended ? APPROACH_LABEL[recommended]
    : "—";

  return (
    <div>
      {/* Setup progress card */}
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>Setup progress</div>
        </div>
        {steps.map((step, idx) => {
          const badge = statusBadge(step.status);
          return (
            <div key={step.label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 22px", borderBottom: idx < steps.length - 1 ? `1px solid ${BORDER}` : undefined,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: INK }}>{step.label}</div>
                <div style={{ fontSize: 12, color: SLATE, marginTop: 2 }}>{step.detail}</div>
              </div>
              <div style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                flexShrink: 0,
              }}>
                {badge.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Group summary card */}
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>Organisation summary</div>
        </div>
        {[
          { label: "Organisation type",             value: form.orgType ? (form.orgType === "standalone" ? "Standalone" : "Group") : "—" },
          { label: "Confirmed consolidation approach", value: ghgApproach },
          { label: "Reporting frameworks",           value: form.reportingFrameworks.length > 0 ? form.reportingFrameworks.join(", ") : "—" },
          { label: "Entities registered",            value: entityCount.toString() },
        ].map(row => (
          <div key={row.label} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 22px", borderBottom: `1px solid ${BORDER}`,
          }}>
            <span style={{ fontSize: 13, color: SLATE }}>{row.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: INK, textAlign: "right", maxWidth: "55%" }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Submit registration CTA */}
      {setupComplete ? (
        <div style={{ padding: "16px 20px", background: EMERALD_BG, border: `1px solid #86EFAC`, borderRadius: 12, display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: EMERALD, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✓</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#065F46", marginBottom: 2 }}>Registration submitted</div>
            <div style={{ fontSize: 13, color: "#047857" }}>Deepwoods will review your setup and unlock the full platform once payment is confirmed.</div>
          </div>
        </div>
      ) : boundaryConfirmed && onSubmitSetup ? (
        <div style={{ padding: "16px 20px", background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 2 }}>Ready to submit your registration?</div>
            <div style={{ fontSize: 13, color: SLATE }}>Deepwoods will review your setup and reach out about next steps.</div>
          </div>
          <button
            type="button"
            onClick={onSubmitSetup}
            disabled={isSubmitting}
            style={{ padding: "10px 20px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${FOREST},${MOSS})`, color: WHITE, fontSize: 13, fontWeight: 700, cursor: isSubmitting ? "default" : "pointer", flexShrink: 0, fontFamily: "inherit", opacity: isSubmitting ? 0.7 : 1 }}
          >
            {isSubmitting ? "Submitting…" : "Submit registration"}
          </button>
        </div>
      ) : null}

      {/* Next step CTA */}
      {!boundaryConfirmed && (
        <div style={{ padding: "16px 20px", background: CANVAS, border: `1px dashed ${BORDER}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 2 }}>Complete your Reporting Boundary</div>
            <div style={{ fontSize: 13, color: SLATE }}>Define your consolidation approach to unlock data collection.</div>
          </div>
          <button
            type="button"
            onClick={onGoToBoundary}
            style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${FOREST},${MOSS})`, color: WHITE, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
          >
            Fill in <ArrowRight style={{ width: 13, height: 13 }} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Entities Tab ───────────────────────────────────────────────────────────────

function OpenButton({ paymentUnlocked, entityCode }: { paymentUnlocked: boolean; entityCode: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); navigate({ to: "/home", search: { entity: entityCode } }); }}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, color: paymentUnlocked ? MOSS : "#C55B46", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
    >
      Open
    </button>
  );
}

type OrgStatus = "accepted" | "in-review" | "setup-pending";

function OrgCard({
  org, status, paymentUnlocked, expanded, onToggle, teamCount, facilityCount, createdAt, lastEditAt,
}: {
  org: ClientEntity; status: OrgStatus; paymentUnlocked: boolean;
  expanded: boolean; onToggle: () => void;
  teamCount: string; facilityCount: string;
  createdAt: string | null | undefined; lastEditAt: string | null | undefined;
}) {
  const badge = {
    "accepted":      { bg: EMERALD_BG, color: EMERALD, dot: EMERALD,   text: "ACCEPTED" },
    "in-review":     { bg: AMBER_BG,   color: AMBER,   dot: "#D97706", text: "IN REVIEW" },
    "setup-pending": { bg: GHOST_BG,   color: GHOST,   dot: "#94A3B8", text: "SETUP PENDING" },
  }[status];

  const avatarText = org.code.length <= 4 ? org.code : org.code.slice(0, 3);

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", background: WHITE, marginBottom: 10, boxShadow: "0 1px 5px rgba(0,0,0,0.05)" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", cursor: "pointer", userSelect: "none" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: FOREST, display: "flex", alignItems: "center", justifyContent: "center", fontSize: avatarText.length > 3 ? 9 : 12, fontWeight: 800, color: WHITE, letterSpacing: "0.03em" }}>
          {avatarText}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{org.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: badge.bg }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.dot, display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, letterSpacing: "0.06em" }}>{badge.text}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: paymentUnlocked ? EMERALD_BG : AMBER_BG, border: `1px solid ${paymentUnlocked ? "#86EFAC" : AMBER_BORD}` }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: paymentUnlocked ? EMERALD : "#D97706", display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: paymentUnlocked ? EMERALD : AMBER, letterSpacing: "0.06em" }}>{paymentUnlocked ? "PAID" : "DUE"}</span>
            </span>
          </div>
        </div>
        <OpenButton paymentUnlocked={paymentUnlocked} entityCode={org.code} />
        <div style={{ color: SLATE, flexShrink: 0 }}>
          {expanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, background: CANVAS }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "18px 22px 16px", gap: 0 }}>
            {[
              { title: "About", items: [
                { icon: Building2, label: "Type",            val: (org as any).org_type || "—" },
                { icon: MapPin,    label: "Facilities",      val: facilityCount === "0" ? "—" : facilityCount },
                { icon: Users,     label: "Team members",    val: teamCount },
              ]},
              { title: "Activity", items: [
                { icon: Calendar, label: "Created",   val: fmtDate(createdAt) },
                { icon: Clock,    label: "Last edit", val: fmtDate(lastEditAt) },
              ]},
            ].map(({ title, items }) => (
              <div key={title} style={{ paddingRight: title === "About" ? 24 : 0, paddingLeft: title === "Activity" ? 24 : 0, borderRight: title === "About" ? `1px solid ${BORDER}` : undefined }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SLATE, marginBottom: 12 }}>{title}</div>
                {items.map(({ icon: Icon, label, val }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon style={{ width: 12, height: 12, color: SLATE }} />
                      <span style={{ fontSize: 13, color: SLATE }}>{label}</span>
                    </div>
                    <span style={{ fontSize: 13, color: INK, fontWeight: 500 }}>{val}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, background: WHITE, padding: "12px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SLATE, marginBottom: 5 }}>Plan &amp; Billing</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>Deepwoods Decarbonisation Portal — Annual Access</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 5, background: paymentUnlocked ? EMERALD_BG : AMBER_BG, border: `1px solid ${paymentUnlocked ? "#86EFAC" : AMBER_BORD}`, fontSize: 10, fontWeight: 700, color: paymentUnlocked ? EMERALD : "#D97706" }}>
                  {paymentUnlocked ? "PAID" : "DUE"}
                </span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: SLATE, textAlign: "right", flexShrink: 0 }}>
              For invoice copies, contact your<br /><strong style={{ color: INK }}>Deepwoods account manager</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function EntitiesTab({
  ctx, paymentUnlocked, setupComplete, onRegisterEntity,
}: {
  ctx: ReturnType<typeof useClientContext>;
  paymentUnlocked: boolean;
  setupComplete: boolean;
  onRegisterEntity: () => void;
}) {
  const allOrgs    = ctx.entities.filter(e => !e.is_consolidated);
  const createdAt  = (ctx.client as any).created_at        as string | null | undefined;
  const lastEditAt = (ctx.config  as any).last_activity_at as string | null | undefined;

  const { data: allFacilities = [] } = useFacilities();
  const facilitiesByEntity: Record<string, number> = {};
  for (const f of allFacilities as Array<{ entity: string }>) {
    facilitiesByEntity[f.entity] = (facilitiesByEntity[f.entity] ?? 0) + 1;
  }
  const orgStatus: OrgStatus = paymentUnlocked ? "accepted" : setupComplete ? "in-review" : "setup-pending";

  const [search, setSearch]     = useState("");
  const [expanded, setExpanded] = useState<string | null>(allOrgs[0]?.code ?? null);

  const filtered = search
    ? allOrgs.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase()))
    : allOrgs;

  return (
    <div>
      {!paymentUnlocked && setupComplete && (
        <div style={{ marginBottom: 18, padding: "14px 18px", borderRadius: 12, background: AMBER_BG, border: `1px solid ${AMBER_BORD}`, display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: AMBER }}>Under review — awaiting payment confirmation</p>
            <p style={{ margin: 0, fontSize: 13, color: "#78350F", lineHeight: 1.5 }}>Your registration has been submitted. Once payment is confirmed you'll get full access to all portal modules.</p>
          </div>
          <button type="button" onClick={() => { try { sessionStorage.removeItem("decarb_client_ctx_v2"); } catch { /* ignore */ } window.location.reload(); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, padding: "7px 12px", borderRadius: 9, border: `1px solid ${AMBER_BORD}`, background: WHITE, color: AMBER, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Register</h2>
          <p style={{ margin: 0, fontSize: 13, color: SLATE }}>
            {allOrgs.length > 0
              ? <><strong>{allOrgs.length}</strong> {allOrgs.length === 1 ? "entity" : "entities"} registered{paymentUnlocked && allOrgs.length > 0 ? <span style={{ color: EMERALD }}> · {allOrgs.length} accepted</span> : ""}</>
              : "No entities registered yet."
            }
          </p>
        </div>
        {allOrgs.length > 0 && (
          <button type="button" onClick={onRegisterEntity} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${FOREST},${MOSS})`, color: WHITE, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 10px rgba(30,111,92,0.28)", fontFamily: "inherit" }}>
            <Plus style={{ width: 14, height: 14 }} /> Register entity
          </button>
        )}
      </div>

      {allOrgs.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, maxWidth: 520 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: SLATE }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or code" style={{ width: "100%", padding: "9px 13px 9px 34px", border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, color: INK, background: WHITE, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>
          <button type="button" aria-label="Filter" style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 12px", borderRadius: 9, border: `1px solid ${BORDER}`, background: WHITE, color: SLATE, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500 }}>
            <SlidersHorizontal style={{ width: 14, height: 14 }} />
            <span>Filter</span>
          </button>
        </div>
      )}

      {filtered.length > 0 ? (
        filtered.map(org => (
          <OrgCard
            key={org.code}
            org={org}
            status={orgStatus}
            paymentUnlocked={paymentUnlocked}
            expanded={expanded === org.code}
            onToggle={() => setExpanded(p => p === org.code ? null : org.code)}
            teamCount={(org.team_count ?? 0).toString()}
            facilityCount={(facilitiesByEntity[org.code] ?? 0).toString()}
            createdAt={createdAt}
            lastEditAt={lastEditAt}
          />
        ))
      ) : (
        <div style={{ background: WHITE, border: `2px dashed ${BORDER}`, borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, margin: "0 auto 14px", background: CANVAS, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 style={{ width: 20, height: 20, color: SLATE }} />
          </div>
          <p style={{ margin: "0 0 5px", fontSize: 15, fontWeight: 700, color: INK }}>No organisation registered yet</p>
          <p style={{ margin: "0 0 22px", fontSize: 13, color: SLATE }}>Complete setup to register your first organisation.</p>
          <button type="button" onClick={onRegisterEntity} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 9, border: "none", background: `linear-gradient(135deg,${FOREST},${MOSS})`, color: WHITE, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(30,111,92,0.32)", fontFamily: "inherit" }}>
            Complete organisation setup <ArrowRight style={{ width: 15, height: 15 }} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── User profile modal ─────────────────────────────────────────────────────────

function UserProfileModal({ onClose }: { onClose: () => void }) {
  const email = getEmail() ?? "—";
  const role  = getRole() ?? "—";
  const [current, setCurrent] = useState("");
  const [next,    setNext]    = useState("");
  const [confirm, setConfirm] = useState("");
  const [err,     setErr]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (next.length < 8) { setErr("New password must be at least 8 characters"); return; }
    if (next !== confirm) { setErr("Passwords don't match"); return; }
    setLoading(true);
    try { await changePassword(current, next); setDone(true); setCurrent(""); setNext(""); setConfirm(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setLoading(false); }
  };

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: SLATE, letterSpacing: "0.08em", display: "block", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: WHITE, borderRadius: 16, width: "100%", maxWidth: 440, padding: "28px 28px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: INK }}>User profile</h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: SLATE, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Account info */}
        <div style={{ background: CANVAS, borderRadius: 10, padding: "14px 16px", marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[{ label: "Email", val: email }, { label: "Role", val: role }].map(f => (
            <div key={f.label}>
              <div style={{ ...fieldLabel, marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: INK, fontWeight: 500, wordBreak: "break-all" }}>{f.val}</div>
            </div>
          ))}
        </div>

        {/* Change password */}
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 14 }}>Change password</div>
          {done ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#F0FDF8", border: `1px solid ${MOSS}`, borderRadius: 10, fontSize: 13, color: MOSS, fontWeight: 600 }}>
              <Check style={{ width: 16, height: 16 }} /> Password updated successfully.
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {err && <div style={{ padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>{err}</div>}
              {[{ label: "Current password", val: current, set: setCurrent }, { label: "New password (min 8 chars)", val: next, set: setNext }, { label: "Confirm new password", val: confirm, set: setConfirm }].map(f => (
                <div key={f.label}>
                  <label style={fieldLabel}>{f.label}</label>
                  <input type="password" style={inp} value={f.val} onChange={e => f.set(e.target.value)} required />
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${BORDER}`, background: WHITE, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button type="submit" disabled={loading} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${FOREST},${MOSS})`, color: WHITE, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Saving…" : "Save password"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function RegisterSidebar({
  activeTab, onTabChange, clientName, paymentUnlocked, onUserProfile,
}: {
  activeTab: RegisterTab;
  onTabChange: (t: RegisterTab) => void;
  clientName: string;
  paymentUnlocked: boolean;
  onUserProfile: () => void;
}) {
  const tabs: { id: RegisterTab; label: string; desc: string }[] = [
    { id: "summary",  label: "Summary",            desc: "Setup & progress overview" },
    { id: "boundary", label: "Reporting Boundary",  desc: "GHG consolidation approach" },
    { id: "register", label: "Register",             desc: "Registered legal entities" },
  ];

  return (
    <aside style={{
      width: 228, flexShrink: 0, background: WHITE, borderRight: `1px solid ${BORDER}`,
      display: "flex", flexDirection: "column", minHeight: "100vh",
      fontFamily: "'Inter',system-ui,sans-serif",
    }}>
      {/* Brand */}
      <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: MOSS, textTransform: "uppercase" }}>DEEPWOODS</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: INK, letterSpacing: "-0.03em" }}>GREEN</div>
        {clientName && <div style={{ fontSize: 11, color: SLATE, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientName}</div>}
      </div>

      {/* Tab nav */}
      <nav style={{ flex: 1, padding: "12px 10px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: SLATE, padding: "4px 10px 10px" }}>Organisation setup</div>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              style={{
                display: "flex", flexDirection: "column", gap: 2, width: "100%", textAlign: "left",
                padding: "10px 12px", borderRadius: 9, marginBottom: 2,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                background: isActive ? "#F0FDF8" : "none",
                borderLeft: isActive ? `3px solid ${MOSS}` : "3px solid transparent",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? MOSS : INK }}>{tab.label}</span>
              <span style={{ fontSize: 12, color: SLATE }}>{tab.desc}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "8px 10px 16px", borderTop: `1px solid ${BORDER}` }}>
        <button type="button" onClick={onUserProfile} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", borderRadius: 8, border: "none", background: "none", color: GHOST, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", border: `1.5px solid #CBD5E1`, flexShrink: 0, display: "inline-block" }} />
          User profile
        </button>
        <button type="button" onClick={async () => { await doLogout(); window.location.href = "/"; }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", borderRadius: 8, border: "none", background: "none", color: GHOST, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", border: `1.5px solid #CBD5E1`, flexShrink: 0, display: "inline-block" }} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function RegisterPage() {
  const navigate        = useNavigate();
  const ctx             = useClientContext();
  const paymentUnlocked = ctx.client.payment_status === "paid" || ctx.client.payment_status === "waived";
  const setupComplete   = ctx.config.setup_complete === true || ctx.config.setup_complete === "true";

  const [activeTab,     setActiveTab]     = useState<RegisterTab>("register");
  const [showUserProfile,  setShowUserProfile]  = useState(false);
  const [form,          setForm]          = useState<BoundaryFormState>(EMPTY_FORM);
  const [saveStatus,    setSaveStatus]    = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  // Load saved reporting boundary from backend on mount
  useEffect(() => {
    authFetch("reporting-boundary.php")
      .then(data => {
        if (data.reporting_boundary && typeof data.reporting_boundary === "object") {
          setForm(prev => ({ ...EMPTY_FORM, ...data.reporting_boundary }));
        }
      })
      .catch(() => {
        // Fallback: try to parse from ctx.config
        const raw = (ctx.config as any).reporting_boundary;
        if (raw) {
          try { setForm(prev => ({ ...EMPTY_FORM, ...JSON.parse(raw) })); } catch { /* ignore */ }
        }
      });
  }, []);

  const onChange = useCallback((patch: Partial<BoundaryFormState>) => {
    setForm(prev => ({ ...prev, ...patch }));
    if (saveStatus === "saved") setSaveStatus("idle");
  }, [saveStatus]);

  const onSave = async () => {
    setSaveStatus("saving");
    try {
      await authFetch("reporting-boundary.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
    }
  };

  const handleSubmitSetup = async () => {
    setIsSubmitting(true);
    try {
      await onSave();
      await authFetch("client-setup.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: ctx.client.name, currency: ctx.client.currency || "INR" }),
      });
      window.location.reload();
    } catch {
      setIsSubmitting(false);
    }
  };

  const entityCount = ctx.entities.filter(e => !e.is_consolidated).length;

  return (
    <>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ minHeight: "100vh", display: "flex", background: CANVAS, fontFamily: "'Inter',system-ui,sans-serif" }}>
        <RegisterSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          clientName={ctx.client.name}
          paymentUnlocked={paymentUnlocked}
          onUserProfile={() => setShowUserProfile(true)}
        />

        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <h1 style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
            Organisation Setup
          </h1>
          {/* Content */}
          <div style={{ flex: 1, padding: "32px 36px 64px", overflowY: "auto" }}>
            {activeTab === "summary" && (
              <SetupSummaryTab
                form={form}
                entityCount={entityCount}
                paymentUnlocked={paymentUnlocked}
                setupComplete={setupComplete}
                onGoToBoundary={() => setActiveTab("boundary")}
                onSubmitSetup={handleSubmitSetup}
                isSubmitting={isSubmitting}
              />
            )}
            {activeTab === "boundary" && (
              <ReportingBoundaryTab
                form={form}
                onChange={onChange}
                onSave={onSave}
                saveStatus={saveStatus}
              />
            )}
            {activeTab === "register" && (
              <EntitiesTab
                ctx={ctx}
                paymentUnlocked={paymentUnlocked}
                setupComplete={setupComplete}
                onRegisterEntity={() => navigate({ to: "/entity-setup" })}
              />
            )}
          </div>
        </main>

        {showUserProfile && <UserProfileModal onClose={() => setShowUserProfile(false)} />}
      </div>
    </>
  );
}
