import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Leaf, CheckCircle, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/auth";

export const Route = createFileRoute("/request-access")({ component: RequestAccessPage });

const EMPLOYEE_OPTIONS = ["1-50", "51-200", "201-500", "500+"] as const;

function RequestAccessPage() {
  const [name, setName]           = useState("");
  const [company, setCompany]     = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [employees, setEmployees] = useState("");
  const [message, setMessage]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/request-access.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, email, phone, employees, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter',sans-serif" }}>

      {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "none", flex: "0 0 44%", flexDirection: "column",
          justifyContent: "space-between", background: "#06160E",
          padding: "48px 56px", position: "relative", overflow: "hidden",
        }}
        className="hidden lg:flex lg:flex-col"
      >
        {/* Subtle grid texture */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }} />

        {/* Green glow blob */}
        <div style={{
          position: "absolute", width: 480, height: 480,
          top: -80, right: -120,
          background: "radial-gradient(circle,#1E6F5C 0%,transparent 68%)",
          opacity: 0.25, borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", width: 280, height: 280,
          bottom: 80, left: -60,
          background: "radial-gradient(circle,#2A9D74 0%,transparent 70%)",
          opacity: 0.18, borderRadius: "50%",
        }} />

        {/* Logo */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: "#1E6F5C",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Leaf style={{ width: 20, height: 20, color: "#fff" }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
              Deepwoods Green Advisory
            </span>
          </div>
        </div>

        {/* Hero copy */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(30,111,92,0.25)", border: "1px solid rgba(30,111,92,0.5)",
            borderRadius: 999, padding: "6px 16px", marginBottom: 28,
          }}>
            <Leaf style={{ width: 13, height: 13, color: "#4ade80" }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4ade80" }}>
              GHG Reporting Platform
            </span>
          </div>

          <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15, color: "#ffffff", margin: 0, letterSpacing: "-0.03em" }}>
            Your path to<br />
            <span style={{ color: "#4ade80" }}>net zero</span><br />
            starts here.
          </h1>

          <p style={{ marginTop: 20, fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 380 }}>
            End-to-end GHG inventory, Scope 1–3 accounting, decarbonisation
            planning, and automated reporting — built for serious sustainability teams.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 36 }}>
            {["GHG Protocol aligned inventory", "Scope 1, 2 & all 15 Scope 3 categories", "Decarbonisation roadmap & progress tracking"].map(item => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", background: "rgba(74,222,128,0.15)",
                  border: "1px solid rgba(74,222,128,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
                </div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 2, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
          © 2026 Deepwoods Green Consulting · Data encrypted in transit and at rest
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", background: "#ffffff", padding: "40px 24px",
        overflowY: "auto",
      }}>
        {/* Mobile logo */}
        <div className="lg:hidden" style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 7, background: "#1E6F5C",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Leaf style={{ width: 17, height: 17, color: "#fff" }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0B1F14" }}>Deepwoods Green Advisory</span>
          </div>
        </div>

        <div style={{ width: "100%", maxWidth: 460 }}>

          {success ? (
            /* ── Success state ─────────────────────────────────────────────── */
            <div style={{
              padding: "36px 32px", borderRadius: 16,
              background: "#F0FDF4", border: "1.5px solid #BBF7D0",
              textAlign: "center",
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", background: "#1E6F5C",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                <CheckCircle style={{ width: 28, height: 28, color: "#fff" }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#14532D", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
                Request received!
              </h2>
              <p style={{ fontSize: 14, color: "#166534", lineHeight: 1.7, margin: "0 0 24px" }}>
                We've received your request. Our team will be in touch within{" "}
                <strong>2 business days</strong>.
              </p>
              <a
                href="/"
                style={{
                  display: "inline-block", fontSize: 13, color: "#1E6F5C",
                  fontWeight: 600, textDecoration: "none",
                }}
              >
                ← Back to sign in
              </a>
            </div>
          ) : (
            <>
              {/* ── Heading ─────────────────────────────────────────────────── */}
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0B1F14", margin: 0, letterSpacing: "-0.02em" }}>
                  Request access
                </h2>
                <p style={{ marginTop: 6, fontSize: 14, color: "#6B7280" }}>
                  Tell us about yourself and we'll set you up.
                </p>
              </div>

              {/* ── Error banner ─────────────────────────────────────────────── */}
              {error && (
                <div style={{
                  marginBottom: 20, padding: "12px 16px", borderRadius: 10,
                  background: "#FEF2F2", border: "1px solid #FECACA",
                  color: "#DC2626", fontSize: 13,
                }}>
                  {error}
                </div>
              )}

              {/* ── Form ─────────────────────────────────────────────────────── */}
              <form onSubmit={submit}>

                {/* Row: Name + Company */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <Label>Full name *</Label>
                    <Input
                      type="text" required value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <Label>Company *</Label>
                    <Input
                      type="text" required value={company}
                      onChange={e => setCompany(e.target.value)}
                      placeholder="Acme Corp"
                    />
                  </div>
                </div>

                {/* Email */}
                <div style={{ marginBottom: 14 }}>
                  <Label>Work email *</Label>
                  <Input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="jane@company.com"
                  />
                </div>

                {/* Row: Phone + Company size */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <Label>Phone <Opt /></Label>
                    <Input
                      type="tel" value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <Label>Company size <Opt /></Label>
                    <select
                      value={employees}
                      onChange={e => setEmployees(e.target.value)}
                      style={selectStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = "#1E6F5C")}
                      onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
                    >
                      <option value="">Select…</option>
                      {EMPLOYEE_OPTIONS.map(o => (
                        <option key={o} value={o}>{o} employees</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div style={{ marginBottom: 24 }}>
                  <Label>Message <Opt /></Label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Tell us about your GHG reporting needs…"
                    rows={3}
                    style={{
                      width: "100%", padding: "10px 14px",
                      border: "1.5px solid #E5E7EB", borderRadius: 10,
                      fontSize: 14, color: "#111827", background: "#F9FAFB",
                      outline: "none", boxSizing: "border-box",
                      resize: "vertical", fontFamily: "inherit",
                      transition: "border-color .15s",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#1E6F5C")}
                    onBlur={e => (e.currentTarget.style.borderColor = "#E5E7EB")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 10, border: "none",
                    background: loading ? "#9CA3AF" : "#1E6F5C",
                    color: "#fff", fontSize: 14, fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "background .15s",
                  }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#155E4A"; }}
                  onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#1E6F5C"; }}
                >
                  {loading && <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />}
                  {loading ? "Sending…" : "Submit request"}
                </button>
              </form>

              <p style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>
                Already have access?{" "}
                <a href="/" style={{ color: "#1E6F5C", fontWeight: 600, textDecoration: "none" }}>
                  Sign in
                </a>
              </p>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600,
      color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em",
    }}>
      {children}
    </label>
  );
}

function Opt() {
  return <span style={{ fontWeight: 400, color: "#9CA3AF", textTransform: "none", letterSpacing: 0 }}> (optional)</span>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%", padding: "10px 14px", border: "1.5px solid #E5E7EB",
        borderRadius: 10, fontSize: 14, color: "#111827", background: "#F9FAFB",
        outline: "none", boxSizing: "border-box", transition: "border-color .15s",
        ...(props.style ?? {}),
      }}
      onFocus={e => { e.currentTarget.style.borderColor = "#1E6F5C"; props.onFocus?.(e); }}
      onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; props.onBlur?.(e); }}
    />
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", border: "1.5px solid #E5E7EB",
  borderRadius: 10, fontSize: 14, color: "#111827", background: "#F9FAFB",
  outline: "none", boxSizing: "border-box", transition: "border-color .15s",
  appearance: "auto",
};
