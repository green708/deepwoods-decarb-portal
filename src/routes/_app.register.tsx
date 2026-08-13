import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Leaf, Building2, ArrowRight, CheckCircle2, FileText, Layers } from "lucide-react";
import { useClientContext } from "@/lib/client-context";

export const Route = createFileRoute("/_app/register")({ component: RegisterEntityPage });

const INK      = "oklch(0.21 0.03 265)";
const CANOPY   = "oklch(0.34 0.06 158)";
const MEADOW   = "oklch(0.62 0.16 152)";
const PAPER    = "oklch(0.978 0.003 120)";
const SLATE    = "oklch(0.55 0.02 265)";
const HAIRLINE = "oklch(0.92 0.005 130)";
const MINT     = "oklch(0.94 0.03 155)";

const STEPS = [
  { n: 1, label: "Organisation Boundary", done: false },
  { n: 2, label: "Payment Confirmation", done: false },
  { n: 3, label: "Inventory Setup", done: false },
  { n: 4, label: "Full Portal Access", done: false },
];

function RegisterEntityPage() {
  const navigate = useNavigate();
  const ctx = useClientContext();

  const engagements = ctx.reporting_engagements ?? [];
  const consolidated = ctx.entities.find(e => e.is_consolidated);
  const displayName = ctx.client.name;

  return (
    <div style={{
      minHeight: "100vh",
      background: PAPER,
      fontFamily: "'Manrope','Inter',system-ui,sans-serif",
      color: INK,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Decorative rings */}
      <div style={{
        position: "fixed", top: -220, right: -220, width: 700, height: 700,
        border: `1px solid ${HAIRLINE}`, borderRadius: "50%", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", top: -110, right: -110, width: 480, height: 480,
        border: `1px solid ${HAIRLINE}`, borderRadius: "50%", pointerEvents: "none", zIndex: 0,
      }} />

      {/* Header */}
      <header style={{
        position: "relative", zIndex: 10, background: "white",
        borderBottom: `1px solid ${HAIRLINE}`, padding: "0 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between", height: 58,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: CANOPY,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Leaf style={{ width: 15, height: 15, color: "white" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>
            DEEPWOODS <span style={{ color: MEADOW }}>GREEN</span>
          </span>
        </div>
        <span style={{ fontSize: 12, color: SLATE }}>{displayName}</span>
      </header>

      {/* Body */}
      <div style={{
        position: "relative", zIndex: 1,
        maxWidth: 600, margin: "0 auto", padding: "56px 24px 80px",
      }}>
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: SLATE, margin: "0 0 4px",
        }}>
          Getting started
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 6px", color: INK, letterSpacing: "-0.02em" }}>
          Welcome, {displayName}
        </h1>
        <p style={{ fontSize: 14, color: SLATE, margin: "0 0 40px", lineHeight: 1.65 }}>
          Before GHG data collection can begin, your organisation boundary needs to be defined.
          This covers your legal entities, reporting structure, and scope boundary.
        </p>

        {/* Existing engagements (if any — for return visits) */}
        {engagements.length > 0 && (
          <div style={{
            background: "white", border: `1px solid ${HAIRLINE}`, borderRadius: 14,
            padding: "20px 28px", marginBottom: 24,
            boxShadow: "0 1px 3px rgba(17,24,39,0.06)",
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: CANOPY, margin: "0 0 12px" }}>
              Registered reporting engagements
            </p>
            {engagements.map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${HAIRLINE}` }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: MINT, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {e.report_type === "consolidated"
                    ? <Layers style={{ width: 17, height: 17, color: CANOPY }} />
                    : <FileText style={{ width: 17, height: 17, color: CANOPY }} />}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: INK }}>{e.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: SLATE }}>
                    {e.report_type === "consolidated" ? "Consolidated" : "Standalone"} · {e.reporting_entity_code}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Account card */}
        <div style={{
          background: "white", border: `1px solid ${HAIRLINE}`, borderRadius: 14,
          padding: "24px 28px", marginBottom: 24,
          boxShadow: "0 1px 3px rgba(17,24,39,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: MINT,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Building2 style={{ width: 22, height: 22, color: CANOPY }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: SLATE, margin: "0 0 3px" }}>
                Customer Account
              </p>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px", color: INK, lineHeight: 1.3 }}>
                {displayName}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {consolidated && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: SLATE,
                    fontFamily: "monospace", letterSpacing: "0.04em",
                  }}>
                    {consolidated.code}
                  </span>
                )}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 9px", borderRadius: 999,
                  background: "oklch(0.96 0.03 62)", border: "1px solid oklch(0.88 0.07 62)",
                  fontSize: 11, fontWeight: 600, color: "oklch(0.52 0.12 62)",
                }}>
                  <span style={{ fontSize: 8 }}>●</span> Boundary setup required
                </span>
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 16, padding: "11px 14px", borderRadius: 8,
            background: "oklch(0.97 0.005 120)", border: `1px solid ${HAIRLINE}`,
            fontSize: 12, color: SLATE, lineHeight: 1.55,
          }}>
            Payment is account-level — once confirmed by a Deepwoods consultant, the entire workspace
            is unlocked for all users on this account.
          </div>
        </div>

        {/* Journey preview */}
        <div style={{
          background: "white", border: `1px solid ${HAIRLINE}`, borderRadius: 14,
          padding: "20px 28px", marginBottom: 32,
          boxShadow: "0 1px 3px rgba(17,24,39,0.06)",
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: SLATE, margin: "0 0 16px" }}>
            What happens next
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: s.done ? CANOPY : "white",
                  border: `2px solid ${s.done ? CANOPY : HAIRLINE}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  color: s.done ? "white" : SLATE,
                }}>
                  {s.done ? <CheckCircle2 style={{ width: 13, height: 13 }} /> : s.n}
                </div>
                <span style={{
                  fontSize: 13, fontWeight: i === 0 ? 600 : 400,
                  color: i === 0 ? INK : SLATE,
                }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => navigate({ to: "/entity-setup" })}
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "13px 28px", borderRadius: 10, border: "none",
            background: CANOPY, color: "white",
            fontSize: 15, fontWeight: 600, cursor: "pointer",
            boxShadow: "0 2px 8px rgba(30,111,92,0.25)",
            letterSpacing: "-0.01em",
          }}
        >
          {engagements.length > 0 ? "Update Organisation Boundary" : "Define Organisation Boundary"}
          <ArrowRight style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  );
}
