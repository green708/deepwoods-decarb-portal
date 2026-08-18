import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Loader2, Check, X, ImageUp } from "lucide-react";
import { API_BASE } from "@/lib/auth";

export const Route = createFileRoute("/request-access")({ component: RequestAccessPage });

/* ── Design tokens ──────────────────────────────────────────────────────────── */
const MOSS   = "#1E6F5C";
const FOREST = "#1E4D2B";
const INK    = "#111827";
const SLATE  = "#5A6872";
const MUTED  = "#94A3B8";
const BORDER = "#E2E8E4";
const BG     = "#EEF3F0";
const WHITE  = "#FFFFFF";
const MINTBG = "#ECF7F3";
const CORAL  = "#DC2626";

const INDUSTRIES = [
  "Manufacturing", "Textiles & Apparel", "Chemicals", "Food & Beverage",
  "IT / Technology", "Financial Services", "Real Estate & Construction",
  "Logistics & Transportation", "Furniture Manufacturing", "Other",
];
const ORG_TYPES = [
  "Private Limited", "Public Limited", "LLP", "Partnership",
  "Sole Proprietorship", "Trust / NGO", "Government Body", "Other",
];
const SERVICES = [
  "Scope 1 & Scope 2",
  "Scope 1 & 2 with Assurance",
  "SBTi Target Setting",
  "Scope 1, 2 & 3",
  "Scope 1, 2 & 3 with Assurance",
  "Other — Specify",
];

/* ── Component ──────────────────────────────────────────────────────────────── */

function RequestAccessPage() {
  const [form, setForm] = useState({
    // KYC
    ghg_done_before: false,
    ghg_requirement: "",
    services_other: "",
    // Org
    legal_name: "", operating_name: "", industry: "", org_type: "",
    is_india: true, gstin: "", is_msme: false, udyam_number: "",
    legal_address: "", website: "",
    // Contact
    name: "", designation: "", email: "", phone: "",
    company: "",
  });
  const [servicesNeeded, setServicesNeeded] = useState<string[]>([]);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoName, setLogoName]       = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const toggleService = (s: string) =>
    setServicesNeeded(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );

  const handleLogo = (file: File) => {
    setLogoName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const canSubmit =
    form.legal_name.trim() !== "" &&
    form.name.trim() !== "" &&
    form.designation.trim() !== "" &&
    form.email.trim() !== "" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.phone.trim() !== "" &&
    servicesNeeded.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/request-access.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:             form.name,
          designation:      form.designation || null,
          company:          form.legal_name,
          email:            form.email,
          phone:            form.phone || null,
          industry:         form.industry || null,
          is_india:         form.is_india,
          gstin:            form.gstin   || null,
          legal_name:       form.legal_name || null,
          operating_name:   form.operating_name || null,
          org_type:         form.org_type || null,
          is_msme:          form.is_msme,
          udyam_number:     form.udyam_number || null,
          legal_address:    form.legal_address || null,
          website:          form.website || null,
          logo_url:         logoPreview || null,
          ghg_done_before:  form.ghg_done_before,
          ghg_requirement:  form.ghg_requirement || null,
          services_needed:  servicesNeeded,
          services_other:   form.services_other || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Submission failed (${res.status})`);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Success screen ─────────────────────────────────────────────────────── */
  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter',system-ui,sans-serif",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 460, width: "100%", background: WHITE,
          border: `1px solid ${BORDER}`, borderRadius: 18, padding: "48px 40px",
          textAlign: "center", boxShadow: "0 4px 24px rgba(30,79,60,0.08)" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%",
            background: `linear-gradient(135deg, ${FOREST}, ${MOSS})`,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <Check style={{ width: 28, height: 28, color: WHITE }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
            Request received
          </h2>
          <p style={{ fontSize: 14, color: SLATE, lineHeight: 1.7, margin: "0 0 6px" }}>
            Thank you, <strong style={{ color: INK }}>{form.name}</strong>.
          </p>
          <p style={{ fontSize: 14, color: SLATE, lineHeight: 1.7, margin: "0 0 28px" }}>
            Our team will review your submission and send login credentials to{" "}
            <strong style={{ color: INK }}>{form.email}</strong> within{" "}
            <strong style={{ color: INK }}>2 business days</strong>.
          </p>
          <a href="/" style={{ fontSize: 13, color: MOSS, fontWeight: 600, textDecoration: "none" }}>
            ← Back to sign in
          </a>
        </div>
      </div>
    );
  }

  /* ── Main form ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: BG,
      fontFamily: "'Inter',system-ui,sans-serif", color: INK }}>
      <style>{CSS}</style>

      {/* ── Top accent stripe ── */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${FOREST} 0%, ${MOSS} 60%, #3DA882 100%)` }} />

      {/* ── Header ── */}
      <header style={{ background: WHITE, borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 60 }}>
        <img src="/deepwoods-logo.png" alt="Deepwoods Green" style={{ height: 34, width: "auto" }} />
        <div style={{ fontSize: 13, color: SLATE }}>
          Already registered?{" "}
          <a href="/" style={{ color: MOSS, fontWeight: 700, textDecoration: "none" }}>Sign in</a>
        </div>
      </header>

      {/* ── Page title ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 48px 0" }}>
        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: MOSS }}>
          New Organisation
        </p>
        <h1 style={{ margin: "0 0 10px", fontSize: 30, fontWeight: 800, color: INK, letterSpacing: "-0.03em" }}>
          Request portal access
        </h1>
        <p style={{ margin: "0 0 6px", fontSize: 15, color: SLATE, lineHeight: 1.6, maxWidth: 560 }}>
          Tell us about your organisation and GHG reporting needs.
          We'll be in touch within 2 business days with your login credentials.
        </p>
        {/* Step pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20, marginBottom: 8 }}>
          {["A. KYC – GHG Reporting", "B. Organisation Information", "C. Your Contact Details"].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20,
                background: WHITE, border: `1.5px solid ${BORDER}`, fontSize: 12, fontWeight: 600, color: INK }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: `linear-gradient(135deg,${FOREST},${MOSS})`,
                  color: WHITE, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {i + 1}
                </span>
                {s}
              </div>
              {i < 2 && <div style={{ width: 18, height: 1.5, background: BORDER }} />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 48px 80px",
        display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ══ SECTION A — KYC – GHG Reporting ══ */}
        <div className="ra-card">
          <div className="ra-section-label">A. KYC – GHG Reporting</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

            {/* Q1: GHG done before */}
            <Field label="Have you done your GHG Reporting before?" required>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="ra-toggle">
                  <button type="button" className={`ra-toggle-btn${form.ghg_done_before ? " active" : ""}`}
                    onClick={() => set("ghg_done_before", true)}>Yes</button>
                  <button type="button" className={`ra-toggle-btn${!form.ghg_done_before ? " active" : ""}`}
                    onClick={() => set("ghg_done_before", false)}>No</button>
                </div>
                {form.ghg_done_before && (
                  <Field label="If yes, please specify your requirement"
                    hint="Tell us about your previous reporting standard, base year, and what you'd like to carry forward or improve.">
                    <textarea className="ra-textarea" rows={3}
                      value={form.ghg_requirement}
                      onChange={e => set("ghg_requirement", e.target.value)}
                      placeholder="e.g. We prepared a GHG inventory for FY24 under GHG Protocol. Looking to improve Scope 3 coverage and prepare an assurance-ready report." />
                  </Field>
                )}
              </div>
            </Field>

            {/* Q2: Services needed */}
            <Field label="What are you looking for?" required
              hint="Select all that apply — this helps us tailor the right plan and assign the right consultant.">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginTop: 4 }}>
                {SERVICES.map(s => {
                  const checked = servicesNeeded.includes(s);
                  return (
                    <label key={s} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                      <div
                        onClick={() => toggleService(s)}
                        style={{
                          width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                          border: `2px solid ${checked ? MOSS : BORDER}`,
                          background: checked ? MOSS : WHITE,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", transition: "all 0.15s",
                        }}>
                        {checked && <Check style={{ width: 11, height: 11, color: WHITE }} />}
                      </div>
                      <span
                        onClick={() => toggleService(s)}
                        style={{ fontSize: 14, color: INK, lineHeight: 1.4, userSelect: "none" }}>
                        {s}
                      </span>
                    </label>
                  );
                })}
              </div>
              {servicesNeeded.includes("Other — Specify") && (
                <div style={{ marginTop: 12 }}>
                  <input className="ra-input"
                    value={form.services_other}
                    onChange={e => set("services_other", e.target.value)}
                    placeholder="Please describe what you're looking for…" />
                </div>
              )}
            </Field>

          </div>
        </div>

        {/* ══ SECTION B — Organisation Information ══ */}
        <div className="ra-card">
          <div className="ra-section-label">B. Organisation Information</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

            {/* India + GSTIN */}
            <div className="ra-grid-2">
              <Field label="Is your organisation registered in India?"
                hint="This determines whether we ask for a GSTIN or a general business registration / tax ID.">
                <div className="ra-toggle">
                  <button type="button" className={`ra-toggle-btn${form.is_india ? " active" : ""}`}
                    onClick={() => set("is_india", true)}>Yes</button>
                  <button type="button" className={`ra-toggle-btn${!form.is_india ? " active" : ""}`}
                    onClick={() => set("is_india", false)}>No</button>
                </div>
              </Field>
              <Field label="GSTIN"
                hint="Your 15-character GST Identification Number, as shown on your GST registration certificate.">
                <input className="ra-input" value={form.gstin}
                  onChange={e => set("gstin", e.target.value.toUpperCase())}
                  placeholder={form.is_india ? "15-character GST Identification Number" : "Not applicable"}
                  maxLength={15} disabled={!form.is_india}
                  style={{ opacity: form.is_india ? 1 : 0.45 }} />
              </Field>
            </div>

            {/* Legal name + Operating name */}
            <div className="ra-grid-2">
              <Field label="Legal name of the organisation" required
                hint="The exact registered name on your incorporation or registration certificate — this is what will appear on official reports.">
                <input className="ra-input" value={form.legal_name}
                  onChange={e => set("legal_name", e.target.value)}
                  placeholder="Exact registered name" />
              </Field>
              <Field label="Operating name (if different from legal name)"
                hint="Name as you want it displayed across the portal and any reports.">
                <input className="ra-input" value={form.operating_name}
                  onChange={e => set("operating_name", e.target.value)}
                  placeholder="Name as it appears on the portal and reports" />
              </Field>
            </div>

            {/* Industry + Org type */}
            <div className="ra-grid-2">
              <Field label="Industry" required
                hint="Choose the sector closest to your primary business activity — this affects the default emission factors used in your calculations.">
                <select className="ra-select" value={form.industry}
                  onChange={e => set("industry", e.target.value)}>
                  <option value="">Select an industry</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Organisational Type" required
                hint="Your legal structure, as stated on your registration documents.">
                <select className="ra-select" value={form.org_type}
                  onChange={e => set("org_type", e.target.value)}>
                  <option value="">Select a type</option>
                  {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            {/* MSME */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Is your organisation registered as an MSME?"
                hint="Select Yes if you hold an Udyam (or equivalent) MSME registration.">
                <div className="ra-toggle">
                  <button type="button" className={`ra-toggle-btn${form.is_msme ? " active" : ""}`}
                    onClick={() => set("is_msme", true)}>Yes</button>
                  <button type="button" className={`ra-toggle-btn${!form.is_msme ? " active" : ""}`}
                    onClick={() => { set("is_msme", false); set("udyam_number", ""); }}>No</button>
                </div>
              </Field>
              {form.is_msme && (
                <Field label="Udyam Registration Number"
                  hint="Your 19-character Udyam number (e.g. UDYAM-XX-00-0000000). Found on your Udyam Registration Certificate.">
                  <input className="ra-input" value={form.udyam_number}
                    onChange={e => set("udyam_number", e.target.value.toUpperCase())}
                    placeholder="UDYAM-XX-00-0000000" maxLength={25} />
                </Field>
              )}
            </div>

            {/* Legal address */}
            <Field label="Legal Address" required
              hint="Your registered head office address. This will automatically become your first facility in the next step.">
              <textarea className="ra-textarea" rows={3} value={form.legal_address}
                onChange={e => set("legal_address", e.target.value)}
                placeholder="Full registered head-office address" />
            </Field>

            {/* Website + Logo */}
            <div className="ra-grid-2">
              <Field label="Organisation Website"
                hint="Include https:// — this is used on client-facing reports.">
                <input className="ra-input" type="url" value={form.website}
                  onChange={e => set("website", e.target.value)}
                  placeholder="https://www.company.com" />
              </Field>

              <Field label="Upload Company Logo"
                hint="PNG or SVG with a transparent background works best. Used on your reports and in the portal header.">
                <input ref={logoRef} type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogo(f); }} />
                {!logoPreview ? (
                  <div className="ra-dropzone"
                    onClick={() => logoRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleLogo(f); }}>
                    <ImageUp style={{ width: 22, height: 22, color: MUTED, marginBottom: 8 }} />
                    <span style={{ fontSize: 13, color: SLATE }}>Drag and drop, or <span style={{ color: MOSS, fontWeight: 600 }}>click to choose</span> a file</span>
                  </div>
                ) : (
                  <div className="ra-logo-preview">
                    <img src={logoPreview} alt="Logo"
                      style={{ width: 48, height: 48, objectFit: "contain",
                        borderRadius: 8, border: `1px solid ${BORDER}`, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: INK,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {logoName}
                      </p>
                      <button type="button" onClick={() => logoRef.current?.click()}
                        style={{ fontSize: 12, color: MOSS, background: "none", border: "none",
                          padding: 0, cursor: "pointer", fontWeight: 600 }}>
                        Change file
                      </button>
                    </div>
                    <button type="button"
                      onClick={() => { setLogoPreview(null); setLogoName(null); if (logoRef.current) logoRef.current.value = ""; }}
                      style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", padding: 4, flexShrink: 0 }}>
                      <X style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                )}
              </Field>
            </div>

          </div>
        </div>

        {/* ══ SECTION C — Your Contact Details ══ */}
        <div className="ra-card">
          <div className="ra-section-label">C. Your Contact Details</div>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: SLATE, lineHeight: 1.6 }}>
            Login credentials and status updates will be sent to the email address below.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="ra-grid-2">
              <Field label="Your full name" required>
                <input className="ra-input" value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder="Jane Smith" />
              </Field>
              <Field label="Designation" required
                hint="Your job title or role in the organisation.">
                <input className="ra-input" value={form.designation}
                  onChange={e => set("designation", e.target.value)}
                  placeholder="e.g. Head of Sustainability, CFO, ESG Manager" />
              </Field>
            </div>

            <div className="ra-grid-2">
              <Field label="Work email" required>
                <input className="ra-input" type="email" value={form.email}
                  onChange={e => set("email", e.target.value)}
                  placeholder="jane@company.com" />
              </Field>
              <Field label="Mobile number" required
                hint="We may call to verify your request or clarify details.">
                <input className="ra-input" type="tel" value={form.phone}
                  onChange={e => set("phone", e.target.value)}
                  placeholder="+91 98765 43210" />
              </Field>
            </div>
          </div>
        </div>

        {/* ── Error + Submit ── */}
        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 10,
            background: "#FEF2F2", border: `1px solid #FECACA`,
            fontSize: 13, color: CORAL }}>
            {error}
          </div>
        )}

        {!canSubmit && (servicesNeeded.length === 0) && (form.legal_name || form.name) && (
          <p style={{ fontSize: 12, color: MUTED }}>
            Please select at least one service you're looking for in Section A.
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 4px" }}>
          <p style={{ margin: 0, fontSize: 12, color: MUTED, maxWidth: 440, lineHeight: 1.6 }}>
            By submitting this form you agree to Deepwoods Green processing your organisation's details
            to evaluate your request. Fields marked with <span style={{ color: CORAL }}>●</span> are required.
          </p>
          <button type="submit" disabled={!canSubmit || loading} className="ra-submit">
            {loading && <Loader2 style={{ width: 16, height: 16, animation: "ra-spin 1s linear infinite" }} />}
            {loading ? "Submitting…" : "Request access →"}
          </button>
        </div>

      </form>
    </div>
  );
}

/* ── Field wrapper ─────────────────────────────────────────────────────────── */
function Field({ label, required, hint, children, style }: {
  label: string; required?: boolean; hint?: string;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1 }}>{label}</label>
        {required && <span style={{ fontSize: 10, color: CORAL, lineHeight: 1 }}>●</span>}
      </div>
      {children}
      {hint && (
        <p style={{ margin: "7px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{hint}</p>
      )}
    </div>
  );
}

/* ── Stylesheet ────────────────────────────────────────────────────────────── */
const CSS = `
.ra-card {
  background: ${WHITE};
  border: 1.5px solid ${BORDER};
  border-radius: 16px;
  padding: 36px 40px;
  box-shadow: 0 4px 24px rgba(30,79,60,0.09), 0 1px 4px rgba(0,0,0,0.04);
}
.ra-section-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${MOSS};
  padding-bottom: 18px;
  margin-bottom: 28px;
  border-bottom: 1.5px solid ${BORDER};
}
.ra-section-label::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: linear-gradient(180deg, ${FOREST} 0%, ${MOSS} 100%);
  flex-shrink: 0;
}
.ra-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
@media (max-width: 640px) {
  .ra-grid-2 { grid-template-columns: 1fr; }
}
.ra-input, .ra-select, .ra-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid ${BORDER};
  border-radius: 9px;
  font-size: 14px;
  color: ${INK};
  background: white;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
  appearance: auto;
}
.ra-input:focus, .ra-select:focus, .ra-textarea:focus {
  border-color: ${MOSS};
  box-shadow: 0 0 0 3px rgba(30,111,92,0.12);
}
.ra-input::placeholder, .ra-textarea::placeholder {
  color: #BCC5BF;
}
.ra-textarea {
  resize: vertical;
  min-height: 88px;
  line-height: 1.6;
}
.ra-toggle {
  display: inline-flex;
  background: #EEF3F0;
  border: 1.5px solid ${BORDER};
  border-radius: 9px;
  padding: 3px;
  gap: 3px;
}
.ra-toggle-btn {
  padding: 8px 24px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  font-family: inherit;
  color: #9CA3AF;
  background: transparent;
  transition: all 0.18s;
  line-height: 1;
  letter-spacing: 0.01em;
}
.ra-toggle-btn.active {
  background: ${WHITE};
  color: ${FOREST};
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(30,79,60,0.22), 0 0 0 1.5px rgba(30,79,60,0.28);
  border-top: 2.5px solid ${MOSS};
}
.ra-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 110px;
  border: 2px dashed ${BORDER};
  border-radius: 10px;
  cursor: pointer;
  background: #FAFCFB;
  transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
  padding: 20px 16px;
  text-align: center;
}
.ra-dropzone:hover {
  border-color: ${MOSS};
  background: ${MINTBG};
  box-shadow: 0 0 0 3px rgba(30,111,92,0.08);
}
.ra-logo-preview {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border: 1.5px solid ${BORDER};
  border-radius: 9px;
  background: white;
  min-height: 72px;
}
.ra-submit {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 32px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, ${FOREST} 0%, ${MOSS} 100%);
  color: white;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  box-shadow: 0 3px 10px rgba(30,111,92,0.3);
  white-space: nowrap;
  font-family: inherit;
}
.ra-submit:hover:not(:disabled) { opacity: 0.88; }
.ra-submit:active:not(:disabled) { transform: translateY(1px); }
.ra-submit:disabled { opacity: 0.45; cursor: not-allowed; background: #9CA3AF; box-shadow: none; }
@keyframes ra-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
`;
