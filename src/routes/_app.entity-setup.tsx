import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Check, Loader2, Plus, Trash2,
  Building2, MapPin, Users, CreditCard, ClipboardCheck, Layers, Upload, X,
} from "lucide-react";
import { authFetch } from "@/lib/auth";
import { useClientContext, clearClientContext } from "@/lib/client-context";

export const Route = createFileRoute("/_app/entity-setup")({ component: EntitySetupPage });

// ── Design tokens ─────────────────────────────────────────────────────────────
const INK      = "#111827";
const CANOPY   = "#1E6F5C";
const CORAL    = "#DC2626";
const PAPER    = "#EEF3F0";
const SLATE    = "#5A6872";
const HAIRLINE = "#E2E8E4";
const MINT     = "#ECF7F3";
const CTINT    = "#FEF2F2";
const FOREST   = "#1E4D2B";
const MUTED    = "#94A3B8";

const INDUSTRIES = [
  "Manufacturing", "Textiles & Apparel", "Chemicals", "Food & Beverage",
  "IT / Technology", "Financial Services", "Real Estate & Construction",
  "Logistics & Transportation", "Furniture Manufacturing", "Other",
];

const ORG_TYPES_LEGAL = [
  "Private Limited", "Public Limited", "LLP", "Partnership",
  "Sole Proprietorship", "Trust / NGO", "Government Body", "Other",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Facility { name: string; address: string; }
interface TeamMember { name: string; email: string; role: string; }
interface Subsidiary { name: string; country: string; }

type ReportingModel = "consolidated" | "separate" | "mixed" | null;

interface WizardState {
  // Step 1 — Company Details
  is_india:       boolean;
  gstin:          string;
  legalName:      string;
  operatingName:  string;
  industry:       string;
  org_type:       string;
  is_msme:        boolean;
  udyam_number:   string;
  legal_address:  string;
  website:        string;
  logo_preview:   string | null;
  // Step 2 — Reporting Structure
  has_subsidiaries:  boolean | null;
  reporting_model:   ReportingModel;
  subsidiaries:      Subsidiary[];
  // Step 3 — Facilities
  facilities:     Facility[];
  // Step 4 — Team
  team:           TeamMember[];
}

const INIT: WizardState = {
  is_india: true, gstin: "",
  legalName: "", operatingName: "", industry: "", org_type: "", is_msme: false, udyam_number: "",
  legal_address: "", website: "", logo_preview: null,
  has_subsidiaries: null, reporting_model: null,
  subsidiaries: [{ name: "", country: "India" }],
  facilities: [{ name: "Head Office", address: "" }],
  team: [{ name: "", email: "", role: "viewer" }],
};

const STEPS = [
  { label: "Company Details",      short: "Company",     icon: Building2 },
  { label: "Reporting Structure",  short: "Structure",   icon: Layers },
  { label: "Facilities",           short: "Facilities",  icon: MapPin },
  { label: "Manage Team",          short: "Team",        icon: Users },
  { label: "Payment",              short: "Payment",     icon: CreditCard },
  { label: "Submit",               short: "Submit",      icon: ClipboardCheck },
];

function makeCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ENTITY";
}

// ── Page ──────────────────────────────────────────────────────────────────────

function EntitySetupPage() {
  const navigate  = useNavigate();
  const ctx       = useClientContext();

  const [step, setStep]       = useState(0);
  const [data, setData]       = useState<WizardState>({ ...INIT, legalName: ctx.client.name ?? "" });
  const [loading, setLoading] = useState(false);
  const [prefilling, setPrefilling] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const update = (patch: Partial<WizardState>) => setData(p => ({ ...p, ...patch }));

  // ── Prefill from request-access submission ─────────────────────────────────
  useEffect(() => {
    authFetch("request-access.php")
      .then((d: Record<string, string | number | null> | null) => {
        if (!d) return;
        update({
          legalName:     (d.legal_name as string)      || (d.company as string) || ctx.client.name || "",
          operatingName: (d.operating_name as string)  || "",
          industry:      (d.industry as string)         || "",
          org_type:      (d.org_type as string)         || "",
          is_india:      d.is_india !== 0,
          gstin:         (d.gstin as string)            || "",
          is_msme:       d.is_msme === 1,
          udyam_number:  (d.udyam_number as string)    || "",
          legal_address: (d.legal_address as string)   || "",
          website:       (d.website as string)          || "",
          logo_preview:  (d.logo_url as string)        || null,
          facilities: [{ name: "Head Office", address: (d.legal_address as string) || "" }],
        });
      })
      .catch(() => {})
      .finally(() => setPrefilling(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canNext = (): boolean => {
    if (step === 0) {
      return data.legalName.trim() !== "" && data.industry !== "" && data.legal_address.trim() !== "";
    }
    if (step === 1) {
      if (data.has_subsidiaries === null) return false;
      if (data.has_subsidiaries && data.reporting_model === null) return false;
      return true;
    }
    if (step === 2) {
      return data.facilities.length > 0 && data.facilities.every(f => f.name.trim() !== "");
    }
    return true;
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const parentCode    = makeCode(data.legalName);
      const reportingModel = data.has_subsidiaries
        ? (data.reporting_model ?? "consolidated")
        : "consolidated";

      const entities = [
        { code: parentCode, name: data.legalName,
          short_name: data.operatingName || data.legalName.slice(0, 8), is_consolidated: false },
      ];

      const legalEntities = [
        { code: parentCode, country: data.is_india ? "India" : "Other",
          registration_no: "", tax_id: data.gstin, org_type: "parent",
          legal_address: data.legal_address },
      ];

      const reportingEngagements = [
        { name: `${data.legalName} — Consolidated GHG Report`,
          report_type: "consolidated",
          legal_entity_codes: [parentCode],
          reporting_entity_code: parentCode },
      ];

      await authFetch("client-setup.php", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: data.legalName,
          industry:     data.industry,
          country:      data.is_india ? "India" : "Other",
          reporting_model: reportingModel,
          logo_url:     data.logo_preview || undefined,
          entities,
          legal_entities: legalEntities,
          reporting_engagements: reportingEngagements,
        }),
      });

      clearClientContext();
      navigate({ to: "/register" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setLoading(false);
    }
  };

  if (prefilling) {
    return (
      <div style={{ minHeight: "100vh", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 24, height: 24, color: CANOPY, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: PAPER, fontFamily: "'Inter',system-ui,sans-serif", color: INK, minHeight: "100vh" }}>
      <style>{LOV_CSS}</style>

      {/* Top accent stripe */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${FOREST} 0%, ${CANOPY} 60%, #3DA882 100%)` }} />

      {/* Header */}
      <header style={{
        background: "white", borderBottom: `1px solid ${HAIRLINE}`,
        padding: "0 48px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 60,
      }}>
        <img src="/deepwoods-logo.png" alt="Deepwoods Green" style={{ height: 34, width: "auto" }} />
        <span style={{ fontSize: 13, color: SLATE }}>{ctx.client.name}</span>
      </header>

      {/* Stepper bar */}
      <div style={{ background: "white", borderBottom: `1px solid ${HAIRLINE}`, padding: "16px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center" }}>
          {STEPS.map((s, i) => {
            const done   = i < step;
            const active = i === step;
            return (
              <Fragment key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: done ? CANOPY : active ? `linear-gradient(135deg, ${FOREST}, ${CANOPY})` : "white",
                    border: `2px solid ${done || active ? CANOPY : HAIRLINE}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700,
                    color: done || active ? "white" : SLATE,
                    boxShadow: active ? "0 0 0 3px oklch(0.34 0.06 158 / 0.15)" : "none",
                  }}>
                    {done ? <Check style={{ width: 10, height: 10 }} /> : i + 1}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: active ? 700 : done ? 500 : 400,
                    color: active ? INK : done ? CANOPY : SLATE,
                    whiteSpace: "nowrap",
                  }}>
                    {s.short}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: i < step ? CANOPY : HAIRLINE, margin: "0 8px" }} />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px 80px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
          color: CANOPY, margin: "0 0 6px" }}>
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 28px", color: INK, letterSpacing: "-0.03em" }}>
          {STEPS[step].label}
        </h1>

        <div style={{
          background: "white", border: `1px solid ${HAIRLINE}`,
          borderRadius: 16, padding: "36px 40px",
          boxShadow: "0 2px 12px rgba(30,79,60,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        }}>
          {step === 0 && <CompanyDetailsStep    data={data} update={update} />}
          {step === 1 && <ReportingStructureStep data={data} update={update} />}
          {step === 2 && <FacilitiesStep        data={data} update={update} />}
          {step === 3 && <TeamStep              data={data} update={update} />}
          {step === 4 && <PaymentStep />}
          {step === 5 && <SubmitStep            data={data} />}
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 10,
            background: CTINT, border: `1px solid #FECACA`, fontSize: 13, color: CORAL }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {step > 0 ? (
            <button type="button" onClick={() => setStep(s => s - 1)} className="lov-btn-back">
              <ChevronLeft style={{ width: 15, height: 15 }} /> Back
            </button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button type="button"
              onClick={() => canNext() && setStep(s => s + 1)}
              disabled={!canNext()}
              className="lov-btn-next"
              style={{
                background: canNext() ? `linear-gradient(135deg, ${FOREST}, ${CANOPY})` : HAIRLINE,
                color: canNext() ? "white" : SLATE,
                cursor: canNext() ? "pointer" : "not-allowed",
              }}>
              Next <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading} className="lov-btn-primary">
              {loading && <Loader2 style={{ width: 15, height: 15, animation: "lov-spin 1s linear infinite" }} />}
              {loading ? "Submitting…" : "Submit registration"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Company Details ───────────────────────────────────────────────────

function CompanyDetailsStep({ data, update }: { data: WizardState; update: (p: Partial<WizardState>) => void }) {
  const logoRef = useRef<HTMLInputElement>(null);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => update({ logo_preview: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* India + GSTIN */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Field label="Is your organisation registered in India?"
          hint="This determines whether we ask for a GSTIN or a general business registration / tax ID.">
          <div className="lov-yn">
            {["Yes", "No"].map(opt => {
              const active = opt === "Yes" ? data.is_india : !data.is_india;
              return (
                <button key={opt} type="button" onClick={() => update({ is_india: opt === "Yes" })}
                  className={active ? "lov-yn-btn active" : "lov-yn-btn"}>
                  {opt}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="GSTIN" required={data.is_india}
          hint="Your 15-character GST Identification Number, as shown on your GST registration certificate.">
          <input className="lov-input" value={data.gstin}
            onChange={e => update({ gstin: e.target.value.toUpperCase() })}
            placeholder={data.is_india ? "15-character GST Identification Number" : "Not applicable"}
            maxLength={15} disabled={!data.is_india} />
        </Field>
      </div>

      {/* Legal name + Operating name */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Field label="Legal name of the organisation" required
          hint="The exact registered name on your incorporation or registration certificate — this is what will appear on official reports.">
          <input className="lov-input" value={data.legalName}
            onChange={e => update({ legalName: e.target.value })}
            placeholder="Exact registered name" />
        </Field>
        <Field label="Operating name of the organisation (if different)"
          hint="Name as you want it displayed across the portal and any reports, if different from the legal name above.">
          <input className="lov-input" value={data.operatingName}
            onChange={e => update({ operatingName: e.target.value })}
            placeholder="Name as it appears in operations" />
        </Field>
      </div>

      {/* Industry + Org type */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Field label="Industry" required
          hint="Choose the sector closest to your primary business activity — this affects the default emission factors used in your calculations.">
          <select className="lov-select" value={data.industry}
            onChange={e => update({ industry: e.target.value })}>
            <option value="">Select an industry</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="Organisational Type" required
          hint="Your legal structure, as stated on your registration documents.">
          <select className="lov-select" value={data.org_type}
            onChange={e => update({ org_type: e.target.value })}>
            <option value="">Select a type</option>
            {ORG_TYPES_LEGAL.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>

      {/* MSME */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Is your organisation registered as an MSME?"
          hint="Select Yes if you hold an Udyam (or equivalent) MSME registration.">
          <div className="lov-yn">
            {["Yes", "No"].map(opt => {
              const active = opt === "Yes" ? data.is_msme : !data.is_msme;
              return (
                <button key={opt} type="button" onClick={() => update({ is_msme: opt === "Yes", udyam_number: opt === "No" ? "" : data.udyam_number })}
                  className={active ? "lov-yn-btn active" : "lov-yn-btn"}>
                  {opt}
                </button>
              );
            })}
          </div>
        </Field>
        {data.is_msme && (
          <Field label="Udyam Registration Number"
            hint="Your 19-character Udyam number (e.g. UDYAM-XX-00-0000000). Found on your Udyam Registration Certificate.">
            <input className="lov-input" value={data.udyam_number}
              onChange={e => update({ udyam_number: e.target.value.toUpperCase() })}
              placeholder="UDYAM-XX-00-0000000" maxLength={25} />
          </Field>
        )}
      </div>

      {/* Legal address */}
      <Field label="Legal Address" required
        hint="Your registered head office address. This will automatically become your first facility in the next step, so double-check it here.">
        <textarea className="lov-textarea" rows={3} value={data.legal_address}
          onChange={e => update({
            legal_address: e.target.value,
            facilities: [{ name: "Head Office", address: e.target.value }, ...data.facilities.slice(1)],
          })}
          placeholder="Full registered head-office address" />
      </Field>

      {/* Website + Logo */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Field label="Organisation Website" required
          hint="Include https:// — this is used on client-facing reports.">
          <input className="lov-input" type="url" value={data.website}
            onChange={e => update({ website: e.target.value })}
            placeholder="https://www.company.com" />
        </Field>

        <Field label="Upload Company Logo"
          hint="PNG or SVG with a transparent background works best. Used on your reports and in the portal header.">
          <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
            style={{ display: "none" }} onChange={handleLogo} />
          {!data.logo_preview ? (
            <div
              onClick={() => logoRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => update({ logo_preview: ev.target?.result as string });
                reader.readAsDataURL(file);
              }}
              style={{
                border: `1.5px dashed ${HAIRLINE}`, borderRadius: 8, padding: "18px 16px",
                textAlign: "center", cursor: "pointer", background: "white",
                color: SLATE, fontSize: 13, lineHeight: 1.5,
                transition: "border-color 0.15s",
              }}
            >
              Drag and drop, or click to choose a file
            </div>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
              border: `1px solid ${HAIRLINE}`, borderRadius: 8, background: "white",
            }}>
              <img src={data.logo_preview} alt="Logo preview"
                style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 6,
                  border: `1px solid ${HAIRLINE}`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <button type="button" onClick={() => logoRef.current?.click()}
                  style={{ fontSize: 12, color: CANOPY, background: "none", border: "none",
                    padding: 0, cursor: "pointer", fontWeight: 600, display: "block" }}>
                  Change logo
                </button>
              </div>
              <button type="button"
                onClick={() => { update({ logo_preview: null }); if (logoRef.current) logoRef.current.value = ""; }}
                style={{ background: "none", border: "none", color: SLATE, cursor: "pointer", padding: 4, flexShrink: 0 }}>
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>
          )}
        </Field>
      </div>

    </div>
  );
}

// ── Step 2: Reporting Structure ───────────────────────────────────────────────

function ReportingStructureStep({ data, update }: { data: WizardState; update: (p: Partial<WizardState>) => void }) {
  const patchSub = (i: number, p: Partial<Subsidiary>) =>
    update({ subsidiaries: data.subsidiaries.map((s, j) => j === i ? { ...s, ...p } : s) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <p style={{ margin: 0, fontSize: 13, color: SLATE, lineHeight: 1.6 }}>
        This determines how GHG emissions are reported across your legal structure. The right approach depends
        on whether you have subsidiaries and how ownership control is exercised.
      </p>

      {/* Q1: Subsidiaries? */}
      <div>
        <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600, color: INK }}>
          Does <strong>{data.legalName || "your organisation"}</strong> have subsidiaries or group companies?
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { key: true,  label: "Yes — we are a holding company or have subsidiaries",
              desc: "You'll set a reporting approach for the group." },
            { key: false, label: "No — standalone entity",
              desc: "A single consolidated report covers the whole organisation." },
          ].map(opt => {
            const active = data.has_subsidiaries === opt.key;
            return (
              <button key={String(opt.key)} type="button"
                onClick={() => update({
                  has_subsidiaries: opt.key,
                  reporting_model: opt.key ? data.reporting_model : "consolidated",
                })}
                style={{
                  flex: 1, textAlign: "left", padding: "18px 20px", borderRadius: 12,
                  border: `${active ? "2.5" : "1.5"}px solid ${active ? CANOPY : HAIRLINE}`,
                  background: active ? MINT : "white",
                  cursor: "pointer", transition: "all 0.2s",
                  boxShadow: active ? "0 4px 16px rgba(30,79,60,0.18)" : "0 1px 3px rgba(0,0,0,0.04)",
                  transform: active ? "translateY(-1px)" : "none",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${active ? CANOPY : HAIRLINE}`,
                    background: active ? CANOPY : "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {active && <Check style={{ width: 10, height: 10, color: "white" }} />}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{opt.label}</span>
                </div>
                <p style={{ margin: 0, paddingLeft: 26, fontSize: 12, color: SLATE, lineHeight: 1.5 }}>{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Q2: Reporting model (only if has subsidiaries) */}
      {data.has_subsidiaries === true && (
        <div style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 24 }}>
          <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600, color: INK }}>
            How will GHG emissions be reported across the group?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { key: "consolidated" as const,
                label: "Consolidated",
                desc: "One combined GHG report for the parent and all subsidiaries together. Scope boundaries are set at the group level." },
              { key: "separate" as const,
                label: "Separate",
                desc: "Each legal entity reports independently. Emissions are not aggregated at the group level." },
              { key: "mixed" as const,
                label: "Mixed",
                desc: "Some subsidiaries are consolidated into the parent report; others report separately. You'll define the scope for each entity." },
            ].map(opt => {
              const active = data.reporting_model === opt.key;
              return (
                <button key={opt.key} type="button"
                  onClick={() => update({ reporting_model: opt.key })}
                  style={{
                    textAlign: "left", padding: "16px 20px", borderRadius: 12,
                    border: `${active ? "2.5" : "1.5"}px solid ${active ? CANOPY : HAIRLINE}`,
                    background: active ? MINT : "white",
                    cursor: "pointer", transition: "all 0.2s",
                    boxShadow: active ? "0 4px 16px rgba(30,79,60,0.18)" : "0 1px 3px rgba(0,0,0,0.04)",
                    transform: active ? "translateY(-1px)" : "none",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${active ? CANOPY : HAIRLINE}`,
                      background: active ? CANOPY : "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {active && <Check style={{ width: 9, height: 9, color: "white" }} />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{opt.label}</span>
                  </div>
                  <p style={{ margin: 0, paddingLeft: 24, fontSize: 12, color: SLATE, lineHeight: 1.5 }}>
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Q3: Subsidiaries list (if has_subsidiaries and model chosen) */}
      {data.has_subsidiaries === true && data.reporting_model !== null && (
        <div style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 24 }}>
          <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: INK }}>
            List your subsidiary companies
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: SLATE, lineHeight: 1.6 }}>
            You can add full details for each entity in subsequent steps. For now, just name each subsidiary.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.subsidiaries.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0, marginTop: 8,
                  background: `linear-gradient(135deg, ${FOREST}, ${CANOPY})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "white",
                }}>
                  {i + 1}
                </div>
                <input className="lov-input" style={{ flex: 1 }}
                  value={s.name}
                  onChange={e => patchSub(i, { name: e.target.value })}
                  placeholder={`Subsidiary ${i + 1} name`} />
                <input className="lov-input" style={{ width: 140 }}
                  value={s.country}
                  onChange={e => patchSub(i, { country: e.target.value })}
                  placeholder="Country" />
                {i > 0 && (
                  <button type="button"
                    onClick={() => update({ subsidiaries: data.subsidiaries.filter((_, j) => j !== i) })}
                    style={{ background: "none", border: "none", color: SLATE, cursor: "pointer", padding: "8px 4px" }}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button"
            onClick={() => update({ subsidiaries: [...data.subsidiaries, { name: "", country: "India" }] })}
            className="lov-add-link" style={{ marginTop: 12 }}>
            <Plus style={{ width: 14, height: 14 }} /> Add subsidiary
          </button>
        </div>
      )}

      {/* Standalone confirmation */}
      {data.has_subsidiaries === false && (
        <div style={{
          padding: "14px 18px", borderRadius: 10,
          background: MINT, border: `1px solid oklch(0.85 0.05 155)`,
          fontSize: 13, color: CANOPY, lineHeight: 1.6,
        }}>
          <strong>Single-entity consolidated report.</strong>{" "}
          Your GHG inventory will cover {data.legalName || "your organisation"} as a single legal and operating entity.
          All facilities added in the next step are included within this scope.
        </div>
      )}
    </div>
  );
}

// ── Step 3: Facilities ────────────────────────────────────────────────────────

function FacilitiesStep({ data, update }: { data: WizardState; update: (p: Partial<WizardState>) => void }) {
  const patchFacility = (i: number, p: Partial<Facility>) =>
    update({ facilities: data.facilities.map((f, j) => j === i ? { ...f, ...p } : f) });

  const addFacility = () =>
    update({ facilities: [...data.facilities, { name: "", address: "" }] });

  const removeFacility = (i: number) =>
    update({ facilities: data.facilities.filter((_, j) => j !== i) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ margin: 0, fontSize: 13, color: SLATE, lineHeight: 1.6 }}>
        Include every physical location where this organisation operates. Facility 1 is auto-filled from your registered address.
      </p>

      {data.facilities.map((f, i) => (
        <div key={i} style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: CANOPY, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "white" }}>
              {i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: INK }}>
              {i === 0 ? "Head Office" : `Facility ${i + 1}`}
            </span>
            {i > 0 && (
              <button type="button" onClick={() => removeFacility(i)}
                style={{ marginLeft: "auto", background: "none", border: "none", color: SLATE, cursor: "pointer" }}>
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Facility name" required>
              <input className="lov-input" value={f.name}
                onChange={e => patchFacility(i, { name: e.target.value })}
                placeholder={i === 0 ? "Head Office" : "Facility name"} />
            </Field>
            <Field label="Facility address">
              <textarea className="lov-textarea" rows={2} value={f.address}
                onChange={e => patchFacility(i, { address: e.target.value })}
                placeholder="Full physical address" />
            </Field>
          </div>
        </div>
      ))}

      <button type="button" onClick={addFacility} className="lov-add-link">
        <Plus style={{ width: 14, height: 14 }} /> Add another facility
      </button>
    </div>
  );
}

// ── Step 4: Manage Team ───────────────────────────────────────────────────────

function TeamStep({ data, update }: { data: WizardState; update: (p: Partial<WizardState>) => void }) {
  const patchMember = (i: number, p: Partial<TeamMember>) =>
    update({ team: data.team.map((m, j) => j === i ? { ...m, ...p } : m) });

  const addMember = () =>
    update({ team: [...data.team, { name: "", email: "", role: "viewer" }] });

  const removeMember = (i: number) =>
    update({ team: data.team.filter((_, j) => j !== i) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ margin: 0, fontSize: 13, color: SLATE, lineHeight: 1.6 }}>
        Add people who should have access to this entity. Access is scoped to this entity only.
      </p>

      {data.team.map((m, i) => (
        <div key={i} style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: INK }}>
              Team member {i + 1}
            </span>
            {i > 0 && (
              <button type="button" onClick={() => removeMember(i)}
                style={{ marginLeft: "auto", background: "none", border: "none", color: SLATE, cursor: "pointer" }}>
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <Field label="Full name">
              <input className="lov-input" value={m.name}
                onChange={e => patchMember(i, { name: e.target.value })}
                placeholder="Jane Smith" />
            </Field>
            <Field label="Email">
              <input className="lov-input" type="email" value={m.email}
                onChange={e => patchMember(i, { email: e.target.value })}
                placeholder="jane@company.com" />
            </Field>
            <Field label="Role">
              <select className="lov-select" value={m.role}
                onChange={e => patchMember(i, { role: e.target.value })}>
                <option value="admin">Account Admin</option>
                <option value="sustainability_team">Sustainability Team</option>
                <option value="client_uploader">Data Contributor</option>
                <option value="client_leadership">Viewer</option>
              </select>
            </Field>
          </div>
        </div>
      ))}

      <button type="button" onClick={addMember} className="lov-add-link">
        <Plus style={{ width: 14, height: 14 }} /> Add team member
      </button>
    </div>
  );
}

// ── Step 5: Payment ───────────────────────────────────────────────────────────

function PaymentStep() {
  return (
    <div style={{ maxWidth: 580 }}>
      <div style={{
        border: `1px solid ${HAIRLINE}`, borderRadius: 10, overflow: "hidden",
        marginBottom: 20,
      }}>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${FOREST}, ${CANOPY})` }} />
        <div style={{ padding: "24px 28px" }}>
          <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.07em", color: SLATE }}>
            Plan
          </p>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: INK }}>
            Deepwoods Decarb Portal — Annual Access
          </h2>
          <ul style={{ margin: "0 0 16px", padding: "0 0 0 18px", fontSize: 13, lineHeight: 1.9, color: SLATE }}>
            <li>Full Scope 1, 2 and 3 GHG inventory for this entity</li>
            <li>Facility-level data submission and document vault</li>
            <li>Annual assured GHG report package</li>
            <li>Decarbonisation pathway and peer benchmarking modules</li>
            <li>Carbon footprint dashboards and intensity metrics</li>
          </ul>
          <div style={{
            padding: "12px 16px", borderRadius: 8,
            background: MINT, border: `1px solid oklch(0.85 0.05 155)`,
            fontSize: 13, color: CANOPY, lineHeight: 1.6,
          }}>
            <strong>Pricing is confirmed manually.</strong> A Deepwoods consultant will review your registration
            and confirm the engagement terms. Nothing is charged automatically.
          </div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: SLATE, lineHeight: 1.65 }}>
        Once your registration is reviewed and payment is confirmed at the account level,
        the entire workspace is unlocked for all users on this account.
      </p>
    </div>
  );
}

// ── Step 6: Submit / Review ───────────────────────────────────────────────────

function SubmitStep({ data }: { data: WizardState }) {
  const modelLabel: Record<string, string> = {
    consolidated: "Consolidated (single report for all entities)",
    separate: "Separate (each entity reports independently)",
    mixed: "Mixed (consolidated + separate, by entity)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <p style={{ margin: 0, fontSize: 13, color: SLATE, lineHeight: 1.6 }}>
        Review your registration details before submitting to Deepwoods for review.
      </p>

      <ReviewSection title="Company Details">
        <RR label="Legal name"    value={data.legalName  || "—"} />
        {data.operatingName && <RR label="Operating name" value={data.operatingName} />}
        <RR label="Industry"      value={data.industry   || "—"} />
        {data.org_type && <RR label="Org type" value={data.org_type} />}
        <RR label="Registered in India" value={data.is_india ? "Yes" : "No"} />
        {data.gstin && <RR label="GSTIN" value={data.gstin} />}
        <RR label="MSME"          value={data.is_msme ? "Yes" : "No"} />
        <RR label="Legal address" value={data.legal_address || "—"} />
        {data.website && <RR label="Website" value={data.website} />}
      </ReviewSection>

      <ReviewSection title="Reporting Structure">
        <RR label="Has subsidiaries"    value={data.has_subsidiaries === null ? "—" : data.has_subsidiaries ? "Yes" : "No"} />
        {data.reporting_model && (
          <RR label="Reporting model" value={modelLabel[data.reporting_model] ?? data.reporting_model} />
        )}
        {data.has_subsidiaries && data.subsidiaries.some(s => s.name) && data.subsidiaries.map((s, i) => (
          <RR key={i} label={`Subsidiary ${i + 1}`} value={[s.name, s.country].filter(Boolean).join(" — ")} />
        ))}
      </ReviewSection>

      <ReviewSection title="Facilities">
        {data.facilities.map((f, i) => (
          <RR key={i} label={i === 0 ? "Head Office" : `Facility ${i + 1}`}
            value={[f.name, f.address].filter(Boolean).join(" — ") || "—"} />
        ))}
      </ReviewSection>

      {data.team.some(m => m.name || m.email) && (
        <ReviewSection title="Team Members">
          {data.team.filter(m => m.name || m.email).map((m, i) => (
            <RR key={i} label={m.role || "Member"} value={[m.name, m.email].filter(Boolean).join(" — ")} />
          ))}
        </ReviewSection>
      )}

      <div style={{
        padding: "14px 18px", borderRadius: 10,
        background: "#EEF3F0", border: `1px solid ${HAIRLINE}`,
        fontSize: 13, color: SLATE, lineHeight: 1.6,
      }}>
        <strong style={{ color: INK }}>What happens next:</strong> Your registration will be submitted to Deepwoods for
        review. Once confirmed and payment is processed at the account level, your full workspace is unlocked.
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 7 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: INK }}>{label}</label>
        {required && <span style={{ fontSize: 10, color: CORAL }}>●</span>}
      </div>
      {children}
      {hint && (
        <p style={{ margin: "7px 0 0", fontSize: 12, color: "#94A3B8", lineHeight: 1.6 }}>{hint}</p>
      )}
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
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
      <span style={{ flex: "0 0 180px", fontSize: 12, fontWeight: 600, color: SLATE, lineHeight: 1.5 }}>{label}</span>
      <span style={{ fontSize: 13, color: INK, flex: 1, lineHeight: 1.5, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const LOV_CSS = `
.lov-input,.lov-select,.lov-textarea{width:100%;padding:10px 14px;border:1.5px solid ${HAIRLINE};border-radius:9px;font-size:14px;color:${INK};background:white;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color 0.15s,box-shadow 0.15s;appearance:auto}
.lov-input:focus,.lov-select:focus,.lov-textarea:focus{border-color:${CANOPY};box-shadow:0 0 0 3px rgba(30,111,92,0.12)}
.lov-input::placeholder,.lov-textarea::placeholder{color:#BCC5BF}
.lov-textarea{resize:vertical;min-height:80px;line-height:1.6}
.lov-add-link{display:inline-flex;align-items:center;gap:6px;padding:0;background:none;border:none;color:${CANOPY};font-size:13px;font-weight:600;cursor:pointer;margin-top:4px}
.lov-add-link:hover{text-decoration:underline}
.lov-btn-primary{display:inline-flex;align-items:center;gap:8px;padding:13px 32px;border-radius:10px;background:linear-gradient(135deg,${FOREST},${CANOPY});border:none;color:white;font-size:14px;font-weight:700;cursor:pointer;transition:opacity 0.15s,transform 0.1s;box-shadow:0 3px 10px rgba(30,111,92,0.3);font-family:inherit}
.lov-btn-primary:hover:not(:disabled){opacity:0.88}.lov-btn-primary:active:not(:disabled){transform:translateY(1px)}.lov-btn-primary:disabled{opacity:0.45;cursor:not-allowed;background:#9CA3AF;box-shadow:none}
.lov-btn-back{display:inline-flex;align-items:center;gap:6px;padding:11px 22px;border-radius:10px;border:1.5px solid ${HAIRLINE};background:white;color:${SLATE};font-size:14px;font-weight:600;cursor:pointer;transition:border-color 0.15s;font-family:inherit}
.lov-btn-back:hover{border-color:${CANOPY};color:${CANOPY}}
.lov-btn-next{display:inline-flex;align-items:center;gap:6px;padding:13px 28px;border-radius:10px;border:none;font-size:14px;font-weight:700;box-shadow:0 3px 10px rgba(30,111,92,0.3);font-family:inherit;transition:opacity 0.15s,transform 0.1s}
.lov-btn-next:active{transform:translateY(1px)}
.lov-yn{display:inline-flex;background:#EEF3F0;border:1.5px solid ${HAIRLINE};border-radius:9px;padding:3px;gap:3px}
.lov-yn-btn{border:0;background:transparent;padding:8px 24px;font-size:13px;font-weight:500;cursor:pointer;color:#9CA3AF;font-family:inherit;border-radius:7px;transition:all 0.18s;line-height:1;letter-spacing:0.01em}
.lov-yn-btn.active{background:white;color:${FOREST};font-weight:700;box-shadow:0 2px 8px rgba(30,79,60,0.22),0 0 0 1.5px rgba(30,79,60,0.28);border-top:2.5px solid ${CANOPY}}
@keyframes lov-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
`;
