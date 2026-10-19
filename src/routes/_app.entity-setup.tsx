import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Check, Loader2, Plus, Trash2,
  Building2, MapPin, Users, CreditCard, ClipboardCheck, X,
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

const INDUSTRIES = [
  "Agriculture & Forestry",
  "Automotive & Mobility",
  "Chemicals & Materials",
  "Construction & Infrastructure",
  "Consumer Goods & Retail",
  "Education",
  "Energy & Utilities",
  "Financial Services",
  "Food & Beverage",
  "Healthcare & Pharmaceuticals",
  "Hospitality & Tourism",
  "IT / Technology & Software",
  "Logistics & Transportation",
  "Manufacturing — Discrete",
  "Manufacturing — Process",
  "Media & Entertainment",
  "Mining & Metals",
  "Professional Services",
  "Real Estate",
  "Telecommunications",
  "Textiles & Apparel",
  "Waste & Recycling",
  "Other",
];

const ORG_TYPES_LEGAL = [
  "Private Limited", "Public Limited", "LLP", "Partnership",
  "Sole Proprietorship", "Trust / NGO", "Government Body", "Other",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Facility { name: string; address: string; }
interface TeamMember { name: string; email: string; role: string; }

interface WizardState {
  // Step 1 — Company Details
  is_india:          boolean;
  gstin:             string;
  legalName:         string;
  operatingName:     string;
  industry:          string;
  org_type:          string;
  reporting_model:   string;
  reporting_period:  string;   // 'FY' | 'CY' | 'custom'
  fy_start_month:    string;   // 1-12, used when reporting_period = 'custom'
  is_msme:           boolean;
  udyam_number:      string;
  legal_address:     string;
  website:           string;
  // Step 4 — Plan
  selected_plan:     string;
  logo_preview:      string | null;
  // Step 2 — Facilities
  facilities:        Facility[];
  // Step 3 — Team
  team:              TeamMember[];
  // Add-entity mode: the person who will manage this entity going forward.
  // Optional — the org admin can leave it blank and assign one later from Team settings.
  entityAdminEmail:  string;
}

const INIT: WizardState = {
  is_india: true, gstin: "",
  legalName: "", operatingName: "", industry: "", org_type: "", reporting_model: "consolidated", reporting_period: "FY", fy_start_month: "4",
  is_msme: false, udyam_number: "",
  legal_address: "", website: "", logo_preview: null,
  facilities: [{ name: "Head Office", address: "" }],
  team: [{ name: "", email: "", role: "viewer" }],
  selected_plan: "professional",
  entityAdminEmail: "",
};

const STEPS = [
  { label: "Company Details", short: "Company",    icon: Building2 },
  { label: "Facilities",      short: "Facilities", icon: MapPin },
  { label: "Manage Team",     short: "Team",       icon: Users },
  { label: "Payment",         short: "Payment",    icon: CreditCard },
  { label: "Submit",          short: "Submit",     icon: ClipboardCheck },
];

// Simplified 3-step flow used when adding a 2nd+ entity to an existing account
const ADD_ENTITY_STEPS = [
  { label: "Entity Details", short: "Entity",     icon: Building2 },
  { label: "Facilities",     short: "Facilities", icon: MapPin },
  { label: "Submit",         short: "Submit",     icon: ClipboardCheck },
];

function makeCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ENTITY";
}

// ── Page ──────────────────────────────────────────────────────────────────────

function EntitySetupPage() {
  const ctx = useClientContext();

  // config.setup_complete arrives as boolean true (PHP json_decode) or string "true"
  const isFirstSetup = ctx.config.setup_complete !== true && ctx.config.setup_complete !== "true";
  const activeSteps  = isFirstSetup ? STEPS : ADD_ENTITY_STEPS;

  const [step, setStep]       = useState(0);
  const [data, setData]       = useState<WizardState>({ ...INIT, legalName: isFirstSetup ? (ctx.client.name ?? "") : "" });
  const [loading, setLoading] = useState(false);
  const [prefilling, setPrefilling] = useState(isFirstSetup);
  const [error, setError]     = useState<string | null>(null);
  // Set only when an entity admin was requested AND the invite needs the org admin's
  // attention (email failed to send, or the account couldn't be created) — shown as a
  // confirmation panel with the temp password before leaving the wizard.
  const [inviteResult, setInviteResult] = useState<
    { email: string; created: boolean; email_sent: boolean; temp_password?: string; error?: string } | null
  >(null);

  const update = (patch: Partial<WizardState>) => setData(p => ({ ...p, ...patch }));

  // Prefill from request-access only on first-time setup
  useEffect(() => {
    if (!isFirstSetup) return;
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

  const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  const canNext = (): boolean => {
    if (step === 0) {
      if (!isFirstSetup) {
        // Add-entity mode: only entity name is required; admin email is optional but must be valid if given
        const adminEmail = data.entityAdminEmail.trim();
        if (adminEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) return false;
        return data.legalName.trim() !== "";
      }
      if (!data.legalName.trim() || !data.industry || !data.legal_address.trim() || !data.org_type) return false;
      if (data.is_india && data.gstin.trim() && !GSTIN_RE.test(data.gstin.trim().toUpperCase())) return false;
      return true;
    }
    if (step === 1) {
      return data.facilities.length > 0 && data.facilities.every(f => f.name.trim() !== "");
    }
    return true;
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      // First setup: use admin-set code from DB if available, else generate from name.
      // Adding a 2nd+ entity: always generate a fresh code and auto-increment to avoid collisions.
      const existingNonConsolidated = ctx.entities.filter(e => !e.is_consolidated);
      const isFirstSetup = existingNonConsolidated.length === 0;
      const existingCodes = new Set(ctx.entities.map(e => e.code));

      let parentCode: string;
      if (isFirstSetup) {
        parentCode = ctx.entities.find(e => e.is_consolidated)?.code
                  ?? ctx.entities[0]?.code
                  ?? makeCode(data.legalName);
      } else {
        const base = makeCode(data.legalName);
        parentCode = base;
        let n = 1;
        while (existingCodes.has(parentCode)) { parentCode = base + n++; }
      }
      const reportingModel = data.reporting_model || "consolidated";

      const entities = [
        { code: parentCode, name: data.legalName,
          short_name: data.operatingName || data.legalName.slice(0, 8), is_consolidated: false,
          legal_address: data.legal_address },
      ];

      const legalEntities = [
        { code: parentCode, country: data.is_india ? "India" : "Other",
          registration_no: "", tax_id: data.gstin,
          org_type: data.org_type || "other",
          legal_address: data.legal_address },
      ];

      const reportingEngagements = [
        { name: `${data.legalName} — Consolidated GHG Report`,
          report_type: "consolidated",
          legal_entity_codes: [parentCode],
          reporting_entity_code: parentCode },
      ];

      const teamMembers = data.team
        .filter(m => m.email.trim() !== "")
        .map(m => ({ name: m.name.trim(), email: m.email.trim().toLowerCase(), role: m.role }));

      // Add-entity mode sends only entity-specific data — never touches client-level config
      const payload = isFirstSetup ? {
        company_name:     data.legalName,
        operating_name:   data.operatingName || undefined,
        industry:         data.industry,
        country:          data.is_india ? "India" : "Other",
        is_msme:          data.is_msme,
        udyam_number:     data.udyam_number  || undefined,
        website:          data.website       || undefined,
        reporting_model:  reportingModel,
        reporting_period: data.reporting_period === "custom" ? "FY" : data.reporting_period,
        fy_start_month:   data.reporting_period === "FY" ? 4
                        : data.reporting_period === "CY" ? 1
                        : parseInt(data.fy_start_month, 10) || 4,
        logo_url:         data.logo_preview  || undefined,
        facility_count:   data.facilities.length,
        facilities:       data.facilities.map(f => ({ name: f.name, location: f.address })),
        selected_plan:    data.selected_plan,
        entities,
        legal_entities:        legalEntities,
        reporting_engagements: reportingEngagements,
        team_members:          teamMembers,
      } : {
        // Add-entity: entity + facilities, plus the entity admin invite (optional)
        facility_count: data.facilities.length,
        facilities:     data.facilities.map(f => ({ name: f.name, location: f.address })),
        entities,
        legal_entities: legalEntities,
        entity_admin_email: data.entityAdminEmail.trim() || undefined,
      };

      const result = await authFetch("client-setup.php", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const invite = result?.entity_admin_invite as
        { email: string; created: boolean; email_sent: boolean; temp_password?: string; error?: string } | null | undefined;

      // Only interrupt the redirect if the org admin actually needs to do something —
      // a failed invite with a temp password to share manually, or an outright error.
      if (invite && !invite.email_sent) {
        setInviteResult(invite);
        setLoading(false);
        return;
      }

      clearClientContext();
      window.location.href = "/register";
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

  if (inviteResult) {
    const continueToApp = () => { clearClientContext(); window.location.href = "/register"; };
    return (
      <div style={{ minHeight: "100vh", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 480, background: "white", border: `1px solid ${HAIRLINE}`, borderRadius: 16, padding: "32px 36px", boxShadow: "0 2px 12px rgba(30,79,60,0.06)" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 800, color: INK }}>
            Entity added — but the admin invite needs attention
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: SLATE, lineHeight: 1.6 }}>
            {inviteResult.error
              ? `We couldn't invite ${inviteResult.email}: ${inviteResult.error}. You can assign an entity admin later from Team settings.`
              : `${inviteResult.email} was created, but the invitation email couldn't be sent. Share this temporary password with them directly.`}
          </p>
          {inviteResult.temp_password && (
            <div style={{ padding: "12px 16px", borderRadius: 10, background: "#FEF3C7", border: "1px solid #FDE68A", marginBottom: 16 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#92400E" }}>Temporary password</p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1, color: "#92400E" }}>{inviteResult.temp_password}</p>
            </div>
          )}
          <button type="button" onClick={continueToApp} className="lov-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
            Continue
          </button>
        </div>
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
          {activeSteps.map((s, i) => {
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
                {i < activeSteps.length - 1 && (
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
          Step {step + 1} of {activeSteps.length}
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 28px", color: INK, letterSpacing: "-0.03em" }}>
          {activeSteps[step].label}
        </h1>

        <div style={{
          background: "white", border: `1px solid ${HAIRLINE}`,
          borderRadius: 16, padding: "36px 40px",
          boxShadow: "0 2px 12px rgba(30,79,60,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        }}>
          {step === 0 && (isFirstSetup
            ? <CompanyDetailsStep data={data} update={update} />
            : <EntityDetailsStep  data={data} update={update} />
          )}
          {step === 1 && <FacilitiesStep data={data} update={update} onBackToCompany={() => setStep(0)} />}
          {isFirstSetup && step === 2 && <TeamStep    data={data} update={update} />}
          {isFirstSetup && step === 3 && <PaymentStep selectedPlan={data.selected_plan} onPlanChange={p => update({ selected_plan: p })} />}
          {(isFirstSetup ? step === 4 : step === 2) && <SubmitStep data={data} isAddEntity={!isFirstSetup} />}
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

          {step < activeSteps.length - 1 ? (
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
              {loading ? "Submitting…" : isFirstSetup ? "Submit registration" : "Add entity"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add-entity Step 0: Entity Details ────────────────────────────────────────

function EntityDetailsStep({ data, update }: { data: WizardState; update: (p: Partial<WizardState>) => void }) {
  const [touched, setTouched] = useState({ legalName: false, entityAdminEmail: false });
  const touch = (k: keyof typeof touched) => setTouched(t => ({ ...t, [k]: true }));
  const err = touched.legalName && !data.legalName.trim() ? "Entity name is required" : "";
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const adminEmailErr = touched.entityAdminEmail && data.entityAdminEmail.trim() !== "" && !EMAIL_RE.test(data.entityAdminEmail.trim())
    ? "Enter a valid email address" : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <p style={{ margin: 0, fontSize: 13, color: SLATE, lineHeight: 1.6 }}>
        Enter the details of the legal entity you are adding. Each entity tracks GHG data independently.
      </p>

      <Field label="Legal name of the entity" required error={err}
        hint="The exact registered name of this legal entity (e.g. Navitas Data Sciences Private Limited).">
        <input className={`lov-input${err ? " lov-input-error" : ""}`}
          value={data.legalName}
          onChange={e => update({ legalName: e.target.value })}
          onBlur={() => touch("legalName")}
          placeholder="e.g. Navitas Logistics Private Limited"
          autoFocus />
      </Field>

      <Field label="Registered address"
        hint="Official address of this entity — used for GHG reporting boundary documentation.">
        <textarea className="lov-input" rows={2} value={data.legal_address}
          onChange={e => update({ legal_address: e.target.value })}
          placeholder="e.g. 4th Floor, NSEZ Tower, Noida, UP 201305" />
      </Field>

      <Field label="Organisation type"
        hint="Legal form of this entity.">
        <select className="lov-input" value={data.org_type}
          onChange={e => update({ org_type: e.target.value })}>
          <option value="">Select type…</option>
          {ORG_TYPES_LEGAL.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>

      <Field label="Entity admin's email" error={adminEmailErr}
        hint="Optional. This person gets full access to this entity — its facilities, team and data. Leave blank to assign one later from Team settings.">
        <input className={`lov-input${adminEmailErr ? " lov-input-error" : ""}`}
          type="email"
          value={data.entityAdminEmail}
          onChange={e => update({ entityAdminEmail: e.target.value })}
          onBlur={() => touch("entityAdminEmail")}
          placeholder="e.g. admin@theirentity.com" />
      </Field>
    </div>
  );
}

// ── Step 1: Company Details ───────────────────────────────────────────────────

function CompanyDetailsStep({ data, update }: { data: WizardState; update: (p: Partial<WizardState>) => void }) {
  const logoRef = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState({ legalName: false, industry: false, org_type: false, legal_address: false, gstin: false });
  const touch = (k: keyof typeof touched) => setTouched(t => ({ ...t, [k]: true }));

  const GSTIN_RE_LOCAL = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const errs = {
    legalName:     touched.legalName     && !data.legalName.trim()     ? "Legal name is required" : "",
    industry:      touched.industry      && !data.industry              ? "Please select an industry" : "",
    org_type:      touched.org_type      && !data.org_type              ? "Please select an organisation type" : "",
    legal_address: touched.legal_address && !data.legal_address.trim() ? "Legal address is required" : "",
    gstin: touched.gstin && data.is_india && data.gstin.trim() && !GSTIN_RE_LOCAL.test(data.gstin.trim().toUpperCase())
      ? "Enter a valid 15-character GSTIN (e.g. 27AAPFU0939F1ZV)" : "",
  };

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
          hint="Your 15-character GST Identification Number, as shown on your GST registration certificate."
          error={errs.gstin}>
          <input className={`lov-input${errs.gstin ? " lov-input-error" : ""}`} value={data.gstin}
            onChange={e => update({ gstin: e.target.value.toUpperCase() })}
            onBlur={() => touch("gstin")}
            placeholder={data.is_india ? "15-character GST Identification Number" : "Not applicable"}
            maxLength={15} disabled={!data.is_india} />
        </Field>
      </div>

      {/* Legal name + Operating name */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Field label="Legal name of the organisation" required
          hint="The exact registered name on your incorporation or registration certificate — this is what will appear on official reports."
          error={errs.legalName}>
          <input className={`lov-input${errs.legalName ? " lov-input-error" : ""}`} value={data.legalName}
            onChange={e => update({ legalName: e.target.value })}
            onBlur={() => touch("legalName")}
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
          hint="Choose the sector closest to your primary business activity — this affects the default emission factors used in your calculations."
          error={errs.industry}>
          <select className={`lov-select${errs.industry ? " lov-input-error" : ""}`} value={data.industry}
            onChange={e => update({ industry: e.target.value })}
            onBlur={() => touch("industry")}>
            <option value="">Select an industry</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="Organisational Type" required
          hint="Your legal structure, as stated on your registration documents."
          error={errs.org_type}>
          <select className={`lov-select${errs.org_type ? " lov-input-error" : ""}`} value={data.org_type}
            onChange={e => update({ org_type: e.target.value })}
            onBlur={() => touch("org_type")}>
            <option value="">Select a type</option>
            {ORG_TYPES_LEGAL.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>

      {/* Reporting model */}
      <Field label="Consolidation / Reporting Approach" required
        hint="How your organisation consolidates GHG emissions. Operational control is the most common approach for GHG Protocol compliance.">
        <select className="lov-select" value={data.reporting_model}
          onChange={e => update({ reporting_model: e.target.value })}>
          <option value="consolidated">Operational Control (consolidated reporting)</option>
          <option value="equity_share">Equity Share</option>
          <option value="financial_control">Financial Control</option>
          <option value="separate">Separate entities (no consolidated roll-up)</option>
        </select>
      </Field>

      {/* Reporting period — CY vs FY */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Field label="Reporting Year Type" required
          hint="How does your organisation define its reporting year? Most Indian companies use a Financial Year (Apr–Mar).">
          <select className="lov-select" value={data.reporting_period}
            onChange={e => update({ reporting_period: e.target.value, fy_start_month: e.target.value === "FY" ? "4" : e.target.value === "CY" ? "1" : data.fy_start_month })}>
            <option value="FY">Financial Year (Apr–Mar, Indian standard)</option>
            <option value="CY">Calendar Year (Jan–Dec)</option>
            <option value="custom">Custom fiscal year (specify start month)</option>
          </select>
        </Field>
        {data.reporting_period === "custom" && (
          <Field label="Fiscal Year Start Month" required
            hint="Which month does your fiscal year start? (e.g. 10 for October, giving an Oct–Sep year)">
            <select className="lov-select" value={data.fy_start_month}
              onChange={e => update({ fy_start_month: e.target.value })}>
              {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                <option key={i+1} value={String(i+1)}>{m}</option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {/* MSME — India-specific */}
      {data.is_india && (
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
      )}

      {/* Legal address */}
      <Field label="Legal Address" required
        hint="Your registered head office address. This will automatically become your first facility in the next step, so double-check it here."
        error={errs.legal_address}>
        <textarea className={`lov-textarea${errs.legal_address ? " lov-input-error" : ""}`} rows={3} value={data.legal_address}
          onChange={e => update({
            legal_address: e.target.value,
            facilities: [{ name: "Head Office", address: e.target.value }, ...data.facilities.slice(1)],
          })}
          onBlur={() => touch("legal_address")}
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

// ── Step 2: Facilities ────────────────────────────────────────────────────────

function FacilitiesStep({ data, update, onBackToCompany }: {
  data: WizardState;
  update: (p: Partial<WizardState>) => void;
  onBackToCompany: () => void;
}) {
  const additional = data.facilities.slice(1);
  const [countStr, setCountStr] = useState(String(additional.length));

  const applyCount = (raw: string) => {
    const n = Math.min(10, Math.max(0, parseInt(raw) || 0));
    setCountStr(String(n));
    const curr = data.facilities.slice(1);
    if (n > curr.length) {
      const blanks: Facility[] = Array.from({ length: n - curr.length }, () => ({ name: "", address: "" }));
      update({ facilities: [data.facilities[0], ...curr, ...blanks] });
    } else if (n < curr.length) {
      update({ facilities: [data.facilities[0], ...curr.slice(0, n)] });
    }
  };

  const patchFacility = (i: number, p: Partial<Facility>) =>
    update({ facilities: data.facilities.map((f, j) => j === i ? { ...f, ...p } : f) });

  const addFacility = () => {
    const next = [...data.facilities, { name: "", address: "" }];
    update({ facilities: next });
    setCountStr(String(next.length - 1));
  };

  const removeFacility = (i: number) => {
    const next = data.facilities.filter((_, j) => j !== i);
    update({ facilities: next });
    setCountStr(String(next.length - 1));
  };

  const headOffice = data.facilities[0] ?? { name: "Head Office", address: "" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <p style={{ margin: 0, fontSize: 13, color: SLATE, lineHeight: 1.65 }}>
        Include every physical location where this organisation operates — factories, offices, warehouses, retail sites, and so on.
        Your registered head office is already added below as Facility 1, using the address you gave in Company Details.
      </p>

      {/* ── Head Office (locked address) ── */}
      <div style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{
          padding: "10px 20px", borderBottom: `1px solid ${HAIRLINE}`,
          background: "#FAFCFB",
          fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SLATE,
        }}>
          Facility 1 · Head Office
        </div>
        <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Field label="Facility name">
            <input className="lov-input" value={headOffice.name}
              onChange={e => patchFacility(0, { name: e.target.value })}
              placeholder="Head Office" />
            <p style={{ margin: "6px 0 0", fontSize: 12, color: SLATE, lineHeight: 1.5 }}>
              Editable — how this site is labelled in the portal.
            </p>
          </Field>
          <Field label="Facility location / address">
            <div style={{
              padding: "10px 14px", border: `1.5px solid ${HAIRLINE}`, borderRadius: 9,
              fontSize: 14, color: data.legal_address ? INK : SLATE,
              background: "#F9FAFB", minHeight: 44, lineHeight: 1.55,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {data.legal_address || "No address entered"}
            </div>
            <div style={{ marginTop: 6 }}>
              <button type="button" onClick={onBackToCompany}
                style={{ fontSize: 12, color: CANOPY, background: "none", border: "none",
                  padding: 0, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>
                Edit in Company Details →
              </button>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: SLATE, lineHeight: 1.5 }}>
                Taken from your Legal Address.
              </p>
            </div>
          </Field>
        </div>
      </div>

      {/* ── Additional facility count ── */}
      <Field label="How many additional facilities do you have?" required
        hint="Count every site besides your head office — you'll fill in a name and address for each one next.">
        <input
          className="lov-input"
          type="number"
          min={0}
          max={10}
          value={countStr}
          style={{ maxWidth: 200 }}
          onChange={e => {
            const v = e.target.value;
            const n = parseInt(v) || 0;
            setCountStr(String(Math.min(10, Math.max(0, n))));
          }}
          onBlur={() => applyCount(countStr)}
          onKeyDown={e => { if (e.key === "Enter") applyCount(countStr); }}
        />
      </Field>

      {/* ── Additional facility cards ── */}
      {data.facilities.slice(1).map((f, i) => (
        <div key={i + 1} style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            padding: "10px 20px", borderBottom: `1px solid ${HAIRLINE}`,
            background: "#FAFCFB",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
              textTransform: "uppercase", color: SLATE }}>
              Facility {i + 2}
            </span>
            <button type="button" onClick={() => removeFacility(i + 1)}
              style={{ background: "none", border: "none", color: SLATE, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontFamily: "inherit" }}>
              <Trash2 style={{ width: 13, height: 13 }} /> Remove
            </button>
          </div>
          <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Field label="Facility name" required>
              <input className="lov-input" value={f.name}
                onChange={e => patchFacility(i + 1, { name: e.target.value })}
                placeholder={`Facility ${i + 2} name`} />
            </Field>
            <Field label="Facility location / address">
              <textarea className="lov-textarea" rows={2} value={f.address}
                onChange={e => patchFacility(i + 1, { address: e.target.value })}
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

// ── Step 3: Manage Team ───────────────────────────────────────────────────────

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
        Add team members who need access to the portal. Each person you add here will receive a welcome
        email with their login credentials once your registration is submitted.
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
                <option value="sustainability_team">Admin</option>
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

// ── Step 4: Payment ───────────────────────────────────────────────────────────

function PaymentStep({ selectedPlan, onPlanChange }: { selectedPlan: string; onPlanChange: (p: string) => void }) {
  const MINT3 = "#3DA882";
  const plans = [
    {
      key: "starter",
      name: "Starter",
      tagline: "Begin your GHG journey",
      price: "₹75,000",
      period: "/year",
      popular: false,
      features: [
        "Scope 1 & 2 GHG Inventory",
        "Up to 2 facilities",
        "Annual GHG Report (GHG Protocol)",
        "Carbon footprint dashboard",
        "Data submission portal",
        "Email support",
      ],
    },
    {
      key: "growth",
      name: "Growth",
      tagline: "Deepen your sustainability footprint",
      price: "₹1,75,000",
      period: "/year",
      popular: false,
      features: [
        "Scope 1, 2 & 3 GHG Inventory",
        "Up to 5 facilities",
        "Assurance-ready reporting",
        "Decarbonisation roadmap",
        "Action plan & priority tracker",
        "Hotspot analysis",
        "Dedicated coordinator",
      ],
    },
    {
      key: "professional",
      name: "Professional",
      tagline: "The complete decarbonisation platform",
      price: "₹3,50,000",
      period: "/year",
      popular: true,
      features: [
        "Full Scope 1, 2 & 3 + Assurance",
        "Unlimited facilities & entities",
        "SBTi Target Setting support",
        "Green Finance / Carbon P&L module",
        "Peer benchmarking",
        "I-REC & renewables tracking",
        "Board-ready report library",
        "Priority consultant access",
      ],
    },
    {
      key: "enterprise",
      name: "Enterprise",
      tagline: "Bespoke engagement at scale",
      price: "Custom",
      period: "",
      popular: false,
      features: [
        "Everything in Professional",
        "Multi-entity & group reporting",
        "Regulatory disclosure (BRSR, CDP, GRI)",
        "Custom emission factor library",
        "On-site workshops & training",
        "Named consultant team",
      ],
    },
  ] as const;

  return (
    <div style={{ maxWidth: 900 }}>
      <style>{`
        @keyframes ps-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .ps-card{transition:transform 0.18s,box-shadow 0.18s;cursor:default;}
        .ps-card:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(30,79,60,0.15),0 4px 10px rgba(0,0,0,0.06)!important;}
      `}</style>

      {/* Hero band */}
      <div style={{
        background: `linear-gradient(135deg,${FOREST} 0%,${CANOPY} 60%,${MINT3} 100%)`,
        borderRadius: 14, padding: "28px 32px", marginBottom: 24,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        boxShadow: "0 6px 24px rgba(30,79,60,0.22)",
        animation: "ps-fade 0.4s ease both",
      }}>
        <div>
          <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>
            Select a plan
          </p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
            Choose your decarbonisation engagement
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, maxWidth: 420 }}>
            Nothing is charged now — a Deepwoods consultant will confirm the plan and send an invoice after reviewing your registration.
          </p>
        </div>
        <div style={{
          flexShrink: 0, padding: "8px 18px", borderRadius: 10,
          background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
          fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" as const,
        }}>
          No payment now
        </div>
      </div>

      {/* Plan grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {plans.map(plan => {
          const isSelected = selectedPlan === plan.key;
          return (
          <div key={plan.key}
            className="ps-card"
            onClick={() => onPlanChange(plan.key)}
            style={{
              position: "relative" as const,
              borderRadius: 14,
              background: plan.popular
                ? `linear-gradient(155deg,${FOREST} 0%,${CANOPY} 100%)`
                : "#fff",
              border: isSelected
                ? `2.5px solid #3DA882`
                : plan.popular ? "2px solid transparent" : `1.5px solid ${HAIRLINE}`,
              boxShadow: plan.popular
                ? "0 10px 32px rgba(30,79,60,0.24)"
                : isSelected ? "0 0 0 4px rgba(61,168,130,0.15)" : "0 2px 10px rgba(30,79,60,0.06)",
              transform: plan.popular ? "translateY(-6px)" : "none",
              paddingBottom: 20,
            }}>

            {plan.popular && (
              <div style={{
                position: "absolute" as const, top: -12, left: "50%", transform: "translateX(-50%)",
                padding: "3px 14px", borderRadius: 20,
                background: `linear-gradient(90deg,#A7F3D0,${MINT3})`,
                fontSize: 9, fontWeight: 800, color: FOREST, letterSpacing: "0.1em",
                textTransform: "uppercase" as const, whiteSpace: "nowrap" as const,
                boxShadow: "0 2px 6px rgba(61,168,130,0.4)",
              }}>
                Most Popular
              </div>
            )}

            <div style={{ padding: "22px 18px 16px" }}>
              <p style={{ margin: "0 0 2px", fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                color: plan.popular ? "rgba(255,255,255,0.55)" : SLATE }}>
                {plan.name}
              </p>
              <p style={{ margin: "0 0 10px", fontSize: 11, lineHeight: 1.4,
                color: plan.popular ? "rgba(255,255,255,0.75)" : SLATE }}>
                {plan.tagline}
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 14 }}>
                <span style={{ fontSize: plan.price === "Custom" ? 22 : 20, fontWeight: 900,
                  letterSpacing: "-0.03em",
                  color: plan.popular ? "#fff" : INK }}>
                  {plan.price}
                </span>
                {plan.period && (
                  <span style={{ fontSize: 11, color: plan.popular ? "rgba(255,255,255,0.55)" : SLATE }}>
                    {plan.period}
                  </span>
                )}
              </div>
              <div style={{ height: 1, background: plan.popular ? "rgba(255,255,255,0.15)" : HAIRLINE, marginBottom: 14 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                      background: plan.popular ? "rgba(167,243,208,0.2)" : MINT,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                        <path d="M1 3.5L3 5.5L6 1.5" stroke={plan.popular ? "#A7F3D0" : CANOPY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 11, lineHeight: 1.45,
                      color: plan.popular ? "rgba(255,255,255,0.85)" : SLATE }}>
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected indicator */}
            {isSelected && (
              <div style={{
                position: "absolute" as const, top: 10, right: 10,
                width: 20, height: 20, borderRadius: "50%",
                background: plan.popular ? "rgba(255,255,255,0.9)" : "#3DA882",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4 7L8 3" stroke={plan.popular ? CANOPY : "#fff"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>
        ); })}
      </div>

      {/* Selected plan summary + footer */}
      <div style={{
        padding: "12px 18px", borderRadius: 10, marginBottom: 12,
        background: "#ECF7F3", border: "1px solid #C5E4D0",
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 13, color: CANOPY,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2.5 7L5.5 10L11.5 4" stroke={CANOPY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>
          Selected: <strong>{plans.find(p => p.key === selectedPlan)?.name ?? "Professional"}</strong>
          {" "}— {plans.find(p => p.key === selectedPlan)?.price ?? "₹3,50,000"}
          {plans.find(p => p.key === selectedPlan)?.period ?? "/year"}
        </span>
      </div>

      {/* Footer note */}
      <div style={{
        padding: "14px 18px", borderRadius: 10,
        background: MINT, border: `1px solid #C5E4D0`,
        fontSize: 13, color: CANOPY, lineHeight: 1.65,
      }}>
        <strong>Pricing is confirmed manually.</strong> A Deepwoods consultant will review your registration
        and confirm the engagement terms. Nothing is charged automatically. Once confirmed, the entire
        workspace unlocks for all users on this account.
      </div>
    </div>
  );
}

// ── Step 5: Submit / Review ───────────────────────────────────────────────────

function SubmitStep({ data, isAddEntity }: { data: WizardState; isAddEntity?: boolean }) {
  if (isAddEntity) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <p style={{ margin: 0, fontSize: 13, color: SLATE, lineHeight: 1.6 }}>
          Review the new entity details before adding it to your account.
        </p>

        <ReviewSection title="Entity Details">
          <RR label="Entity name" value={data.legalName || "—"} />
          {data.legal_address && <RR label="Registered address" value={data.legal_address} />}
          {data.org_type && <RR label="Org type" value={data.org_type} />}
        </ReviewSection>

        <ReviewSection title="Facilities">
          {data.facilities.map((f, i) => (
            <RR key={i} label={i === 0 ? "Primary site" : `Facility ${i + 1}`}
              value={[f.name, f.address].filter(Boolean).join(" — ") || "—"} />
          ))}
        </ReviewSection>

        <ReviewSection title="Entity Admin">
          <RR label="Invite" value={data.entityAdminEmail.trim() || "None — assign one later from Team settings"} />
        </ReviewSection>

        <div style={{
          padding: "14px 18px", borderRadius: 10,
          background: "#EEF3F0", border: `1px solid ${HAIRLINE}`,
          fontSize: 13, color: SLATE, lineHeight: 1.6,
        }}>
          <strong style={{ color: INK }}>What happens next:</strong> The new legal entity and its facilities will be
          added to your account immediately.{data.entityAdminEmail.trim()
            ? " An invitation email will be sent to the entity admin right away."
            : " You can then start submitting GHG data for this entity."}
        </div>
      </div>
    );
  }

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

      <ReviewSection title="Selected Plan">
        <RR label="Plan" value={
          data.selected_plan === "starter"      ? "Starter — ₹75,000/year" :
          data.selected_plan === "growth"       ? "Growth — ₹1,75,000/year" :
          data.selected_plan === "professional" ? "Professional — ₹3,50,000/year (Most Popular)" :
          data.selected_plan === "enterprise"   ? "Enterprise — Custom pricing" :
          data.selected_plan
        } />
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
        review. Team members you added will receive an email with their login credentials. Once confirmed and payment
        is processed, the full workspace is unlocked.
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Field({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 7 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: INK }}>{label}</label>
        {required && <span style={{ fontSize: 10, color: CORAL }}>●</span>}
      </div>
      {children}
      {error ? (
        <p style={{ margin: "7px 0 0", fontSize: 12, color: CORAL, lineHeight: 1.6 }}>{error}</p>
      ) : hint ? (
        <p style={{ margin: "7px 0 0", fontSize: 12, color: "#94A3B8", lineHeight: 1.6 }}>{hint}</p>
      ) : null}
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
.lov-input-error{border-color:${CORAL} !important}.lov-input-error:focus{box-shadow:0 0 0 3px rgba(220,38,38,0.12) !important}
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
