import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import {
  Leaf, ChevronLeft, ChevronRight, Check, Loader2, Plus, Trash2,
  Building2, Layers, FileText,
} from "lucide-react";
import { authFetch } from "@/lib/auth";
import { useClientContext, clearClientContext } from "@/lib/client-context";

export const Route = createFileRoute("/_app/entity-setup")({ component: EntitySetupPage });

// ── Lovable design tokens ─────────────────────────────────────────────────────
const INK      = "oklch(0.21 0.03 265)";
const CANOPY   = "oklch(0.34 0.06 158)";
const CORAL    = "oklch(0.63 0.18 38)";
const MEADOW   = "oklch(0.62 0.16 152)";
const CTINT    = "oklch(0.95 0.03 42)";
const PAPER    = "oklch(0.978 0.003 120)";
const SLATE    = "oklch(0.55 0.02 265)";
const HAIRLINE = "oklch(0.92 0.005 130)";
const MINT     = "oklch(0.94 0.03 155)";

const INDUSTRIES = [
  "Manufacturing", "Textiles & Apparel", "Chemicals", "Food & Beverage",
  "IT / Technology", "Financial Services", "Real Estate & Construction",
  "Logistics & Transportation", "Furniture Manufacturing", "Other",
];

const ORG_TYPES: Array<{ value: string; label: string }> = [
  { value: "parent",      label: "Parent / Holding Company" },
  { value: "subsidiary",  label: "Subsidiary" },
  { value: "branch",      label: "Branch" },
  { value: "jv",          label: "Joint Venture" },
  { value: "other",       label: "Other" },
];

const COUNTRIES = [
  "India", "United States", "United Kingdom", "Singapore", "UAE",
  "Australia", "Canada", "Germany", "Netherlands", "Other",
];

// ── Types ────────────────────────────────────────────────────────────────────

interface LegalEntity {
  code: string;
  name: string;
  short_name: string;
  country: string;
  registration_no: string;
  tax_id: string;
  org_type: string;
  legal_address: string;
}

interface ReportingEngagement {
  name: string;
  report_type: "consolidated" | "standalone";
  legal_entity_codes: string[];
  reporting_entity_code: string;
}

interface WizardState {
  // Step 0 — Org details
  legalName: string;
  operatingName: string;
  industry: string;
  country: string;
  registration_no: string;
  tax_id: string;
  org_type: string;
  legal_address: string;
  website: string;
  // Step 1 — Reporting approach
  has_subsidiaries: boolean | null;
  reporting_model: "consolidated" | "separate" | "mixed" | null;
  // Step 2 — Legal entities (subsidiaries)
  subsidiaries: LegalEntity[];
  // Step 3 — Engagement grouping (mixed only)
  engagements: ReportingEngagement[];
}

const INIT: WizardState = {
  legalName: "", operatingName: "", industry: "", country: "India",
  registration_no: "", tax_id: "", org_type: "parent", legal_address: "", website: "",
  has_subsidiaries: null, reporting_model: null,
  subsidiaries: [],
  engagements: [],
};

// Compute the ordered list of steps based on current wizard state
function computeSteps(state: WizardState): string[] {
  const base = ["Organisation Details", "Reporting Approach"];
  if (state.has_subsidiaries) {
    base.push("Legal Entities");
    if (state.reporting_model === "mixed") {
      base.push("Engagement Groups");
    }
  }
  base.push("Review & Confirm");
  return base;
}

// Map a logical step index to the step list
function logicalStep(step: number, steps: string[]): string {
  return steps[step] ?? "";
}

// ── Page ─────────────────────────────────────────────────────────────────────

function EntitySetupPage() {
  const navigate = useNavigate();
  const ctx = useClientContext();

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardState>({
    ...INIT,
    legalName: ctx.client.name,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<WizardState>) => setData(p => ({ ...p, ...patch }));

  const steps = computeSteps(data);
  const totalSteps = steps.length;
  const currentLabel = logicalStep(step, steps);

  const canNext = (): boolean => {
    if (currentLabel === "Organisation Details") {
      return data.legalName.trim() !== "" && data.industry !== "" && data.legal_address.trim() !== "" && data.country !== "";
    }
    if (currentLabel === "Reporting Approach") {
      return data.has_subsidiaries !== null && (data.has_subsidiaries === false || data.reporting_model !== null);
    }
    if (currentLabel === "Legal Entities") {
      return data.subsidiaries.length > 0 && data.subsidiaries.every(s => s.code.trim() !== "" && s.name.trim() !== "");
    }
    return true;
  };

  const handleNext = () => {
    if (!canNext()) return;
    if (step < totalSteps - 1) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const parentCode = makeCode(data.legalName);

      // Build entities list
      const entities: Array<{
        code: string; name: string; short_name: string; is_consolidated: boolean;
      }> = [
        {
          code: parentCode,
          name: data.legalName,
          short_name: data.operatingName || data.legalName.slice(0, 8),
          is_consolidated: data.subsidiaries.length > 0,
        },
        ...data.subsidiaries.map(s => ({
          code: s.code,
          name: s.name,
          short_name: s.short_name || s.name.slice(0, 8),
          is_consolidated: false,
        })),
      ];

      // Legal entities detail (for new columns)
      const legal_entities = [
        {
          code: parentCode,
          country: data.country,
          registration_no: data.registration_no,
          tax_id: data.tax_id,
          org_type: data.org_type || "parent",
          legal_address: data.legal_address,
        },
        ...data.subsidiaries.map(s => ({
          code: s.code,
          country: s.country,
          registration_no: s.registration_no,
          tax_id: s.tax_id,
          org_type: s.org_type || "subsidiary",
          legal_address: s.legal_address,
        })),
      ];

      // Reporting engagements
      let reporting_engagements: ReportingEngagement[] = [];
      const model = data.has_subsidiaries ? (data.reporting_model ?? "consolidated") : "consolidated";

      if (model === "consolidated" || model === "separate") {
        // Auto-generate one engagement per entity (separate) or one consolidated engagement
        if (model === "consolidated") {
          reporting_engagements = [{
            name: `${data.legalName} — Consolidated GHG Report`,
            report_type: "consolidated",
            legal_entity_codes: entities.map(e => e.code),
            reporting_entity_code: parentCode,
          }];
        } else {
          reporting_engagements = entities
            .filter(e => !e.is_consolidated)
            .map(e => ({
              name: `${e.name} — GHG Report`,
              report_type: "standalone" as const,
              legal_entity_codes: [e.code],
              reporting_entity_code: e.code,
            }));
        }
      } else {
        // Mixed — use the engagements defined in step 3
        reporting_engagements = data.engagements;
      }

      await authFetch("client-setup.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: data.legalName,
          industry: data.industry,
          country: data.country,
          reporting_model: model,
          entities,
          legal_entities,
          reporting_engagements,
        }),
      });

      clearClientContext();
      window.location.href = "/workstreams";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ background: PAPER, fontFamily: "'Manrope','Inter',system-ui,sans-serif", color: INK, minHeight: "100vh" }}>
      <style>{LOV_CSS}</style>

      {/* Decorative rings */}
      <div style={{ position: "fixed", top: -220, right: -220, width: 700, height: 700,
        border: `1px solid ${HAIRLINE}`, borderRadius: "50%", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", top: -110, right: -110, width: 480, height: 480,
        border: `1px solid ${HAIRLINE}`, borderRadius: "50%", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <header style={{ position: "relative", zIndex: 10, background: "white",
        borderBottom: `1px solid ${HAIRLINE}`, padding: "0 40px",
        display: "flex", alignItems: "center", height: 58 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: CANOPY,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Leaf style={{ width: 15, height: 15, color: "white" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>
            DEEPWOODS <span style={{ color: MEADOW }}>GREEN</span>
          </span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: SLATE }}>{ctx.client.name}</div>
      </header>

      {/* Body */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 820, margin: "0 auto", padding: "36px 24px 80px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          color: SLATE, margin: "0 0 4px" }}>
          Organisation Setup
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px", color: INK }}>
          Define your organisation boundary
        </h1>
        <p style={{ fontSize: 14, color: SLATE, margin: "0 0 28px", lineHeight: 1.6 }}>
          We'll ask a few questions to understand your legal structure and reporting needs.
        </p>

        <RingStepper steps={steps} current={step} />

        <div style={{ marginTop: 28, background: "white", border: `1px solid ${HAIRLINE}`,
          borderRadius: 12, padding: "28px 32px", boxShadow: "0 1px 2px rgba(17,24,39,0.04)" }}>

          {currentLabel === "Organisation Details" && (
            <OrgDetailsStep data={data} update={update} />
          )}
          {currentLabel === "Reporting Approach" && (
            <ReportingApproachStep data={data} update={update} />
          )}
          {currentLabel === "Legal Entities" && (
            <LegalEntitiesStep data={data} update={update} />
          )}
          {currentLabel === "Engagement Groups" && (
            <EngagementGroupsStep data={data} update={update} />
          )}
          {currentLabel === "Review & Confirm" && (
            <ReviewStep data={data} steps={steps} />
          )}
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8,
            background: CTINT, border: `1px solid ${CORAL}`, fontSize: 13, color: CORAL }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {step > 0 ? (
            <button type="button" onClick={handleBack} className="lov-btn-back">
              <ChevronLeft style={{ width: 15, height: 15 }} /> Back
            </button>
          ) : <div />}

          {currentLabel !== "Review & Confirm" ? (
            <button type="button" onClick={handleNext} disabled={!canNext()} className="lov-btn-next"
              style={{ background: canNext() ? CANOPY : HAIRLINE, color: canNext() ? "white" : SLATE,
                cursor: canNext() ? "pointer" : "not-allowed" }}>
              Next <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading} className="lov-btn-primary">
              {loading && <Loader2 style={{ width: 15, height: 15, animation: "lov-spin 1s linear infinite" }} />}
              {loading ? "Submitting…" : "Complete setup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 0: Organisation Details ──────────────────────────────────────────────

function OrgDetailsStep({ data, update }: { data: WizardState; update: (p: Partial<WizardState>) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Field label="Legal name of the organisation" required>
          <input className="lov-input" value={data.legalName}
            onChange={e => update({ legalName: e.target.value })} placeholder="Acme Private Limited" />
        </Field>
        <Field label="Operating / trading name (if different)">
          <input className="lov-input" value={data.operatingName}
            onChange={e => update({ operatingName: e.target.value })} placeholder="Acme" />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Field label="Industry" required>
          <select className="lov-select" value={data.industry}
            onChange={e => update({ industry: e.target.value })}>
            <option value="">Select industry…</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="Country of incorporation" required>
          <select className="lov-select" value={data.country}
            onChange={e => update({ country: e.target.value })}>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Field label="Company registration number">
          <input className="lov-input" value={data.registration_no}
            onChange={e => update({ registration_no: e.target.value })} placeholder="U12345MH2010PTC…" />
        </Field>
        <Field label="GSTIN / Tax ID">
          <input className="lov-input" value={data.tax_id}
            onChange={e => update({ tax_id: e.target.value })} placeholder="22AAAAA0000A1Z5" />
        </Field>
      </div>

      <Field label="Registered address" required>
        <textarea className="lov-textarea" rows={3} value={data.legal_address}
          onChange={e => update({ legal_address: e.target.value })}
          placeholder="123 Main Street, City, State, Postal Code" />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Field label="Website">
          <input className="lov-input" value={data.website}
            onChange={e => update({ website: e.target.value })} placeholder="https://www.yourcompany.com" />
        </Field>
      </div>
    </div>
  );
}

// ── Step 1: Reporting Approach ────────────────────────────────────────────────

function ReportingApproachStep({ data, update }: { data: WizardState; update: (p: Partial<WizardState>) => void }) {
  const setHasSubs = (val: boolean) => {
    update({
      has_subsidiaries: val,
      reporting_model: val ? data.reporting_model : "consolidated",
      subsidiaries: val ? data.subsidiaries : [],
      engagements: val ? data.engagements : [],
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: INK }}>
          Does this organisation have subsidiaries or operate through multiple legal entities?
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: SLATE, lineHeight: 1.65 }}>
          This determines how GHG reports are structured and which entities appear in the boundary.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { val: false, label: "No — single legal entity", desc: "One company, one GHG report." },
            { val: true,  label: "Yes — multiple legal entities", desc: "Parent with subsidiaries, branches, or joint ventures." },
          ].map(opt => (
            <ChoiceCard
              key={String(opt.val)}
              selected={data.has_subsidiaries === opt.val}
              label={opt.label}
              desc={opt.desc}
              icon={opt.val ? <Layers style={{ width: 18, height: 18 }} /> : <Building2 style={{ width: 18, height: 18 }} />}
              onClick={() => setHasSubs(opt.val)}
            />
          ))}
        </div>
      </div>

      {data.has_subsidiaries && (
        <div>
          <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: INK }}>
            How will GHG reports be filed?
          </h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: SLATE, lineHeight: 1.65 }}>
            This sets the reporting structure. You can always refine engagement groupings on the next screen.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              {
                val: "consolidated" as const,
                label: "Single consolidated report",
                desc: "All entities rolled up into one GHG report at parent level.",
                icon: <Layers style={{ width: 18, height: 18 }} />,
              },
              {
                val: "separate" as const,
                label: "Separate report per entity",
                desc: "Each legal entity files its own standalone GHG report.",
                icon: <FileText style={{ width: 18, height: 18 }} />,
              },
              {
                val: "mixed" as const,
                label: "Mixed — some entities consolidated, some standalone",
                desc: "You will define custom groupings on the next screen.",
                icon: <Building2 style={{ width: 18, height: 18 }} />,
              },
            ].map(opt => (
              <ChoiceCard
                key={opt.val}
                selected={data.reporting_model === opt.val}
                label={opt.label}
                desc={opt.desc}
                icon={opt.icon}
                onClick={() => update({ reporting_model: opt.val, engagements: opt.val !== "mixed" ? [] : data.engagements })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Legal Entities ────────────────────────────────────────────────────

function LegalEntitiesStep({ data, update }: { data: WizardState; update: (p: Partial<WizardState>) => void }) {
  const add = () => update({
    subsidiaries: [
      ...data.subsidiaries,
      { code: "", name: "", short_name: "", country: "India", registration_no: "", tax_id: "", org_type: "subsidiary", legal_address: "" },
    ],
  });

  const patch = (i: number, p: Partial<typeof data.subsidiaries[0]>) =>
    update({ subsidiaries: data.subsidiaries.map((s, j) => j === i ? { ...s, ...p } : s) });

  const remove = (i: number) =>
    update({ subsidiaries: data.subsidiaries.filter((_, j) => j !== i) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <p style={{ margin: 0, fontSize: 14, color: SLATE, lineHeight: 1.6 }}>
        Add each subsidiary, branch, or joint venture that is part of your GHG reporting boundary.
      </p>

      {data.subsidiaries.map((s, i) => (
        <div key={i} style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: CANOPY, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white" }}>
              {i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: INK }}>
              Entity {i + 1}
            </span>
            <button type="button" onClick={() => remove(i)}
              style={{ marginLeft: "auto", background: "none", border: "none", color: SLATE, cursor: "pointer", padding: "2px 4px" }}>
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Legal entity name" required>
                <input className="lov-input" value={s.name}
                  onChange={e => patch(i, { name: e.target.value, short_name: e.target.value.slice(0, 8) })}
                  placeholder="Acme Manufacturing Pvt Ltd" />
              </Field>
              <Field label="Short code (unique, up to 8 chars)" required>
                <input className="lov-input" value={s.code}
                  onChange={e => patch(i, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) })}
                  placeholder="ACMEMFG" />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Country">
                <select className="lov-select" value={s.country} onChange={e => patch(i, { country: e.target.value })}>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Entity type">
                <select className="lov-select" value={s.org_type} onChange={e => patch(i, { org_type: e.target.value })}>
                  {ORG_TYPES.filter(t => t.value !== "parent").map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Registration number">
                <input className="lov-input" value={s.registration_no}
                  onChange={e => patch(i, { registration_no: e.target.value })} placeholder="U12345…" />
              </Field>
              <Field label="GSTIN / Tax ID">
                <input className="lov-input" value={s.tax_id}
                  onChange={e => patch(i, { tax_id: e.target.value })} placeholder="22AAAAA…" />
              </Field>
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={add} className="lov-add-link">
        <Plus style={{ width: 14, height: 14 }} /> Add another legal entity
      </button>
    </div>
  );
}

// ── Step 3: Engagement Groups (mixed only) ────────────────────────────────────

function EngagementGroupsStep({ data, update }: { data: WizardState; update: (p: Partial<WizardState>) => void }) {
  const parentCode = makeCode(data.legalName);
  const allCodes = [{ code: parentCode, name: data.legalName }, ...data.subsidiaries.map(s => ({ code: s.code, name: s.name }))];

  const addEngagement = () => update({
    engagements: [
      ...data.engagements,
      { name: "", report_type: "consolidated", legal_entity_codes: [], reporting_entity_code: "" },
    ],
  });

  const patchEng = (i: number, p: Partial<ReportingEngagement>) =>
    update({ engagements: data.engagements.map((e, j) => j === i ? { ...e, ...p } : e) });

  const removeEng = (i: number) =>
    update({ engagements: data.engagements.filter((_, j) => j !== i) });

  const toggleCode = (i: number, code: string) => {
    const eng = data.engagements[i];
    const codes = eng.legal_entity_codes.includes(code)
      ? eng.legal_entity_codes.filter(c => c !== code)
      : [...eng.legal_entity_codes, code];
    patchEng(i, { legal_entity_codes: codes });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <p style={{ margin: 0, fontSize: 14, color: SLATE, lineHeight: 1.6 }}>
        Define named GHG reporting engagements. Each engagement groups one or more legal entities
        into a report, keyed to a single reporting entity code.
      </p>

      {data.engagements.map((eng, i) => (
        <div key={i} style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: INK }}>
              Engagement {i + 1}
            </span>
            <button type="button" onClick={() => removeEng(i)}
              style={{ marginLeft: "auto", background: "none", border: "none", color: SLATE, cursor: "pointer" }}>
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Engagement name">
                <input className="lov-input" value={eng.name}
                  onChange={e => patchEng(i, { name: e.target.value })} placeholder="Consolidated GHG Report" />
              </Field>
              <Field label="Report type">
                <select className="lov-select" value={eng.report_type}
                  onChange={e => patchEng(i, { report_type: e.target.value as "consolidated" | "standalone" })}>
                  <option value="consolidated">Consolidated</option>
                  <option value="standalone">Standalone</option>
                </select>
              </Field>
            </div>

            <Field label="Entities in scope">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {allCodes.map(({ code, name }) => {
                  const sel = eng.legal_entity_codes.includes(code);
                  return (
                    <button key={code} type="button"
                      onClick={() => toggleCode(i, code)}
                      style={{
                        padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                        border: `1.5px solid ${sel ? CANOPY : HAIRLINE}`,
                        background: sel ? "oklch(0.96 0.03 155)" : "white",
                        color: sel ? CANOPY : SLATE, cursor: "pointer",
                      }}>
                      {code} — {name}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Reporting entity (the GHG data is filed under this code)">
              <select className="lov-select" value={eng.reporting_entity_code}
                onChange={e => patchEng(i, { reporting_entity_code: e.target.value })}>
                <option value="">Select…</option>
                {eng.legal_entity_codes.map(code => {
                  const n = allCodes.find(a => a.code === code);
                  return <option key={code} value={code}>{code} — {n?.name}</option>;
                })}
              </select>
            </Field>
          </div>
        </div>
      ))}

      <button type="button" onClick={addEngagement} className="lov-add-link">
        <Plus style={{ width: 14, height: 14 }} /> Add reporting engagement
      </button>
    </div>
  );
}

// ── Step 4: Review & Confirm ──────────────────────────────────────────────────

function ReviewStep({ data, steps }: { data: WizardState; steps: string[] }) {
  const model = data.has_subsidiaries ? (data.reporting_model ?? "consolidated") : "consolidated";
  const modelLabel = { consolidated: "Consolidated", separate: "Separate per entity", mixed: "Mixed" }[model];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <p style={{ margin: 0, fontSize: 14, color: SLATE, lineHeight: 1.6 }}>
        Review your organisation boundary. Once submitted, a Deepwoods consultant will confirm your
        engagement and discuss payment before GHG data collection is unlocked.
      </p>

      <Section title="Organisation">
        <RR label="Legal name"        value={data.legalName || "—"} />
        {data.operatingName && <RR label="Operating name" value={data.operatingName} />}
        <RR label="Industry"          value={data.industry || "—"} />
        <RR label="Country"           value={data.country || "—"} />
        {data.registration_no && <RR label="Registration No." value={data.registration_no} />}
        {data.tax_id && <RR label="Tax ID / GSTIN" value={data.tax_id} />}
        <RR label="Registered address" value={data.legal_address || "—"} />
      </Section>

      <Section title="Reporting Structure">
        <RR label="Reporting model" value={modelLabel} />
        <RR label="Total legal entities" value={String(1 + data.subsidiaries.length)} />
        {data.subsidiaries.length > 0 && data.subsidiaries.map((s, i) => (
          <RR key={i} label={`Entity ${i + 2}`} value={`${s.name} (${s.code})`} />
        ))}
      </Section>

      {data.engagements.length > 0 && (
        <Section title="Reporting Engagements">
          {data.engagements.map((e, i) => (
            <RR key={i}
              label={e.name || `Engagement ${i + 1}`}
              value={`${e.report_type === "consolidated" ? "Consolidated" : "Standalone"} · ${e.reporting_entity_code} · ${(e.legal_entity_codes || []).join(", ")}`}
            />
          ))}
        </Section>
      )}

      <div style={{
        padding: "14px 18px", borderRadius: 10,
        background: "oklch(0.97 0.01 250)", border: "1px solid oklch(0.88 0.02 250)",
        fontSize: 13, color: SLATE, lineHeight: 1.6,
      }}>
        <strong style={{ color: INK }}>About payment:</strong> Payment is confirmed at the account level by a
        Deepwoods consultant. Once confirmed, your entire workspace is unlocked — no per-entity fees apply at
        this stage.
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ChoiceCard({ selected, label, desc, icon, onClick }: {
  selected: boolean; label: string; desc: string;
  icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "flex", alignItems: "flex-start", gap: 14, width: "100%", textAlign: "left",
      padding: "16px 20px", borderRadius: 10, border: `2px solid ${selected ? CANOPY : HAIRLINE}`,
      background: selected ? "oklch(0.97 0.02 158)" : "white", cursor: "pointer",
      transition: "border-color 0.15s, background 0.15s",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: selected ? CANOPY : MINT,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        color: selected ? "white" : CANOPY,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: INK }}>{label}</p>
        <p style={{ margin: 0, fontSize: 12, color: SLATE, lineHeight: 1.5 }}>{desc}</p>
      </div>
      {selected && (
        <div style={{ marginLeft: "auto", flexShrink: 0 }}>
          <Check style={{ width: 16, height: 16, color: CANOPY }} />
        </div>
      )}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
        color: CANOPY, margin: "0 0 12px", paddingBottom: 8, borderBottom: `1px solid ${HAIRLINE}` }}>
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function RR({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <span style={{ flex: "0 0 200px", fontSize: 12, fontWeight: 600, color: SLATE, lineHeight: 1.5 }}>{label}</span>
      <span style={{ fontSize: 13, color: INK, flex: 1, lineHeight: 1.5, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: INK }}>{label}</label>
        {required && <span style={{ fontSize: 10, color: CORAL }}>●</span>}
      </div>
      {children}
    </div>
  );
}

// ── RingStepper ───────────────────────────────────────────────────────────────

function RingStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto" }}>
      {steps.map((label, i) => {
        const done = i < current; const active = i === current;
        return (
          <Fragment key={label}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: done ? CANOPY : "transparent",
                border: done ? "none" : active ? `2px solid ${CORAL}` : `2px solid ${HAIRLINE}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: done ? "white" : active ? CORAL : SLATE }}>
                {done ? <Check style={{ width: 13, height: 13 }} /> : i + 1}
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                color: active ? CORAL : done ? CANOPY : SLATE, textAlign: "center", whiteSpace: "nowrap", maxWidth: 90 }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: i < current ? CANOPY : HAIRLINE, margin: "0 6px", marginTop: 15 }} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ENTITY";
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const LOV_CSS = `
.lov-input,.lov-select,.lov-textarea{width:100%;padding:9px 12px;border:1px solid ${HAIRLINE};border-radius:8px;font-size:14px;color:${INK};background:white;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color 0.15s}
.lov-input:focus,.lov-select:focus,.lov-textarea:focus{border-color:${CORAL}}
.lov-textarea{resize:vertical}.lov-select{appearance:auto}
.lov-add-link{display:inline-flex;align-items:center;gap:6px;padding:0;background:none;border:none;color:${CORAL};font-size:13px;font-weight:600;cursor:pointer}
.lov-add-link:hover{text-decoration:underline}
.lov-btn-primary{display:inline-flex;align-items:center;gap:8px;padding:10px 28px;border-radius:8px;background:${CANOPY};border:none;color:white;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.15s}
.lov-btn-primary:hover:not(:disabled){opacity:0.88}.lov-btn-primary:disabled{opacity:0.5;cursor:not-allowed}
.lov-btn-back{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:8px;border:1.5px solid ${CORAL};background:transparent;color:${CORAL};font-size:13px;font-weight:600;cursor:pointer}
.lov-btn-back:hover{background:${CTINT}}
.lov-btn-next{display:inline-flex;align-items:center;gap:6px;padding:10px 24px;border-radius:8px;border:none;font-size:13px;font-weight:600}
@keyframes lov-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
`;
