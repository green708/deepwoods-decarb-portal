import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Leaf, Loader2, Check } from "lucide-react";
import { API_BASE } from "@/lib/auth";

export const Route = createFileRoute("/request-access")({ component: RequestAccessPage });

const INK    = "oklch(0.21 0.03 265)";
const CANOPY = "oklch(0.34 0.06 158)";
const SLATE  = "oklch(0.55 0.02 265)";
const PAPER  = "oklch(0.978 0.003 120)";
const HAIRLINE = "oklch(0.92 0.005 130)";
const CORAL    = "oklch(0.63 0.18 38)";
const CTINT    = "oklch(0.95 0.03 42)";

const INDUSTRIES = [
  "Manufacturing", "Textiles & Apparel", "Chemicals", "Food & Beverage",
  "IT / Technology", "Financial Services", "Real Estate & Construction",
  "Logistics & Transportation", "Furniture Manufacturing", "Other",
];

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: `1px solid ${HAIRLINE}`,
  borderRadius: 8, fontSize: 14, color: INK, background: "white",
  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

function RequestAccessPage() {
  const [form, setForm] = useState({
    company: "", name: "", email: "", phone: "", industry: "",
  });
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const canSubmit =
    form.company.trim() !== "" &&
    form.name.trim() !== "" &&
    form.email.trim() !== "" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

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
          name:    form.name,
          company: form.company,
          email:   form.email,
          phone:   form.phone,
          message: form.industry ? `Industry: ${form.industry}` : "",
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

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'Inter',system-ui,sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, width: "100%", background: "white",
          border: `1px solid ${HAIRLINE}`, borderRadius: 16, padding: "40px 36px",
          textAlign: "center", boxShadow: "0 1px 2px rgba(17,24,39,0.04)" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: CANOPY,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Check style={{ width: 28, height: 28, color: "white" }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: INK, margin: "0 0 8px" }}>
            Request received!
          </h2>
          <p style={{ fontSize: 14, color: SLATE, lineHeight: 1.7, margin: "0 0 24px" }}>
            Thank you, <strong style={{ color: INK }}>{form.name}</strong>.
            Our team will review your request and be in touch within{" "}
            <strong style={{ color: INK }}>2 business days</strong> with your login credentials.
          </p>
          <a href="/" style={{ fontSize: 13, color: CANOPY, fontWeight: 600, textDecoration: "none" }}>
            ← Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'Inter',system-ui,sans-serif", color: INK }}>
      {/* Header */}
      <header style={{ background: "white", borderBottom: `1px solid ${HAIRLINE}`,
        padding: "0 40px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 58 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: CANOPY,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Leaf style={{ width: 15, height: 15, color: "white" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>
            DEEPWOODS <span style={{ color: "oklch(0.62 0.16 152)" }}>GREEN</span>
          </span>
        </div>
        <div style={{ fontSize: 12, color: SLATE }}>
          Already registered?{" "}
          <a href="/" style={{ color: CANOPY, fontWeight: 600, textDecoration: "none" }}>Sign in</a>
        </div>
      </header>

      {/* Body */}
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 24px 80px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          color: SLATE, margin: "0 0 4px" }}>
          New Organisation
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px", color: INK, letterSpacing: "-0.02em" }}>
          Request portal access
        </h1>
        <p style={{ fontSize: 14, color: SLATE, margin: "0 0 32px", lineHeight: 1.6 }}>
          Tell us about your organisation. We'll review your request and send you login credentials within 2 business days.
        </p>

        <form onSubmit={handleSubmit} style={{ background: "white", border: `1px solid ${HAIRLINE}`,
          borderRadius: 12, padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

          <Field label="Company name" required>
            <input style={inp} value={form.company} onChange={e => set("company", e.target.value)}
              placeholder="Acme Private Limited" />
          </Field>

          <Field label="Your full name" required>
            <input style={inp} value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="Jane Smith" />
          </Field>

          <Field label="Work email" required>
            <input style={inp} type="email" value={form.email} onChange={e => set("email", e.target.value)}
              placeholder="jane@company.com" />
          </Field>

          <Field label="Phone number">
            <input style={inp} type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
              placeholder="+91 98765 43210" />
          </Field>

          <Field label="Industry">
            <select style={{ ...inp, appearance: "auto" } as React.CSSProperties}
              value={form.industry} onChange={e => set("industry", e.target.value)}>
              <option value="">Select industry…</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: CTINT,
              border: `1px solid ${CORAL}`, fontSize: 13, color: CORAL }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={!canSubmit || loading} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "11px 28px", borderRadius: 8, border: "none",
            background: canSubmit && !loading ? CANOPY : HAIRLINE,
            color: canSubmit && !loading ? "white" : SLATE,
            fontSize: 14, fontWeight: 600, cursor: canSubmit && !loading ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}>
            {loading && <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />}
            {loading ? "Submitting…" : "Request access"}
          </button>
        </form>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
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
