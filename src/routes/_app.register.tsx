import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, Globe, MapPin, Loader2, CheckCircle2, FileText } from "lucide-react";
import { useClientContext } from "@/lib/client-context";
import { authFetch } from "@/lib/auth";

export const Route = createFileRoute("/_app/register")({ component: RegisterEntityPage });

const MOSS    = "#1E6F5C";
const FOREST  = "#1E4D2B";
const INK     = "#111827";
const SLATE   = "#5A6872";
const MUTED   = "#94A3B8";
const BORDER  = "#E2E8E4";
const CANVAS  = "#EEF3F0";
const WHITE   = "#FFFFFF";
const MINTBG  = "#ECF7F3";

interface RequestData {
  company:        string | null;
  legal_name:     string | null;
  operating_name: string | null;
  industry:       string | null;
  org_type:       string | null;
  is_india:       number | null;
  gstin:          string | null;
  is_msme:        number | null;
  udyam_number:   string | null;
  legal_address:  string | null;
  website:        string | null;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 16, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ flex: "0 0 180px", fontSize: 12, fontWeight: 600, color: MUTED, lineHeight: 1.5 }}>{label}</span>
      <span style={{ fontSize: 13, color: INK, flex: 1, lineHeight: 1.5, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function RegisterEntityPage() {
  const navigate = useNavigate();
  const ctx      = useClientContext();
  const name     = ctx.client.name ?? "Your Organisation";

  const [data, setData]       = useState<RequestData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("request-access.php")
      .then((d: RequestData | null) => {
        if (d && (d.company || d.legal_name)) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const legalName = data?.legal_name || data?.company || name;

  return (
    <div style={{ minHeight: "100vh", background: CANVAS, fontFamily: "'Inter',system-ui,sans-serif", color: INK }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* Top accent stripe */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${FOREST} 0%, ${MOSS} 60%, #3DA882 100%)` }} />

      {/* Header */}
      <header style={{
        background: WHITE, borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 60,
      }}>
        <img src="/deepwoods-logo.png" alt="Deepwoods Green" style={{ height: 34, width: "auto" }} />
        <span style={{ fontSize: 13, color: SLATE, fontWeight: 500 }}>{name}</span>
      </header>

      {/* Body */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "52px 48px 80px" }}>

        {/* Page heading */}
        <div style={{ marginBottom: 36 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: MOSS }}>
            Welcome
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 10px", color: INK, letterSpacing: "-0.03em" }}>
            {name}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: SLATE, lineHeight: 1.65, maxWidth: 520 }}>
            Your account is active. Complete your entity setup so Deepwoods can begin your GHG inventory.
          </p>
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "28px 0", color: SLATE }}>
            <Loader2 style={{ width: 18, height: 18, color: MOSS, animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13 }}>Loading your submission details…</span>
          </div>
        ) : data ? (
          <>
            {/* Company details review card */}
            <div style={{
              background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16,
              overflow: "hidden", marginBottom: 20,
              boxShadow: "0 2px 12px rgba(30,79,60,0.06), 0 1px 3px rgba(0,0,0,0.04)",
            }}>
              {/* Card header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "18px 28px", borderBottom: `1px solid ${BORDER}`,
                background: MINTBG,
              }}>
                <Building2 style={{ width: 16, height: 16, color: MOSS, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.09em",
                  textTransform: "uppercase", color: MOSS }}>
                  Organisation details — from your access request
                </span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 style={{ width: 14, height: 14, color: MOSS }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: MOSS }}>Received</span>
                </div>
              </div>

              <div style={{ padding: "4px 28px 16px" }}>
                <Row label="Legal name"         value={legalName} />
                {data.operating_name && data.operating_name !== legalName && (
                  <Row label="Operating name"   value={data.operating_name} />
                )}
                <Row label="Industry"           value={data.industry ?? undefined} />
                <Row label="Organisation type"  value={data.org_type ?? undefined} />
                <Row label="Registered in"      value={data.is_india !== 0 ? "India" : "Outside India"} />
                {data.gstin && <Row label="GSTIN" value={data.gstin} />}
                <Row label="MSME registered"    value={
                  data.is_msme === 1 ? "Yes" : data.is_msme === 0 ? "No" : undefined
                } />
                {data.udyam_number && <Row label="Udyam number" value={data.udyam_number} />}
              </div>

              {(data.legal_address || data.website) && (
                <>
                  <div style={{ margin: "0 28px", borderTop: `1px solid ${BORDER}` }} />
                  <div style={{ padding: "4px 28px 16px" }}>
                    {data.legal_address && (
                      <div style={{ display: "flex", gap: 16, padding: "10px 0", borderBottom: data.website ? `1px solid ${BORDER}` : "none" }}>
                        <span style={{ display: "flex", alignItems: "flex-start", gap: 6, flex: "0 0 180px" }}>
                          <MapPin style={{ width: 13, height: 13, color: MUTED, marginTop: 2, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>Registered address</span>
                        </span>
                        <span style={{ fontSize: 13, color: INK, flex: 1, lineHeight: 1.6, whiteSpace: "pre-line" }}>
                          {data.legal_address}
                        </span>
                      </div>
                    )}
                    {data.website && (
                      <div style={{ display: "flex", gap: 16, padding: "10px 0" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 180px" }}>
                          <Globe style={{ width: 13, height: 13, color: MUTED, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>Website</span>
                        </span>
                        <a href={data.website} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 13, color: MOSS, flex: 1, lineHeight: 1.5, fontWeight: 600 }}>
                          {data.website}
                        </a>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Info note */}
            <div style={{
              padding: "14px 20px", borderRadius: 10, marginBottom: 28,
              background: "#FFFBEB", border: "1px solid #FDE68A",
              fontSize: 13, color: "#92400E", lineHeight: 1.6,
            }}>
              <strong>Something incorrect?</strong> You can update any of these details in the next step.
            </div>
          </>
        ) : (
          /* No request-access data found */
          <div style={{
            background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16,
            padding: "40px 32px", marginBottom: 28, textAlign: "center",
            boxShadow: "0 2px 12px rgba(30,79,60,0.06)",
          }}>
            <FileText style={{ width: 32, height: 32, color: MUTED, margin: "0 auto 14px" }} />
            <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: INK }}>
              Ready to set up your entity
            </p>
            <p style={{ margin: 0, fontSize: 13, color: SLATE, lineHeight: 1.65 }}>
              You'll fill in your company details in the next step. It only takes a few minutes.
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={() => navigate({ to: "/entity-setup" })}
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "14px 32px", borderRadius: 12, border: "none",
            background: `linear-gradient(135deg, ${FOREST} 0%, ${MOSS} 100%)`,
            color: WHITE, fontSize: 15, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(30,111,92,0.35)",
            transition: "opacity 0.15s",
          }}
        >
          Complete entity setup
          <ArrowRight style={{ width: 18, height: 18 }} />
        </button>

      </div>
    </div>
  );
}
