import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BookOpen, HelpCircle, Library } from "lucide-react";
import { useClientContext } from "@/lib/client-context";
import { getEmail, getRole } from "@/lib/auth";

export const Route = createFileRoute("/_app/home")({ component: HomePage });

const MOSS   = "#1E6F5C";
const FOREST = "#1E4D2B";
const INK    = "#111827";
const SLATE  = "#5A6872";
const BORDER = "#E2E8E4";
const WHITE  = "#FFFFFF";
const CANVAS = "#F8FAF9";
const EMERALD    = "#15803D";
const EMERALD_BG = "#DCFCE7";
const AMBER      = "#92400E";
const AMBER_BG   = "#FEF3C7";

function HomePage() {
  const ctx     = useClientContext();
  const navigate = useNavigate();
  const supportEmail = (ctx.config as any).support_email as string | undefined ?? "support@deepwoodsgreen.com";

  const setupComplete     = ctx.config.setup_complete     === true || ctx.config.setup_complete     === "true";
  const paymentUnlocked   = ctx.client.payment_status === "paid" || ctx.client.payment_status === "waived";
  const inventoryComplete = ctx.config.inventory_complete === true || ctx.config.inventory_complete === "true";
  const primaryEmail      = ((ctx.config.primary_contact_email as string) || "").toLowerCase();
  const currentEmail      = (getEmail() || "").toLowerCase();
  const role              = getRole();
  const isPrimary         = !!primaryEmail && currentEmail === primaryEmail && role === "sustainability_team";

  const nonConsolidated = ctx.entities.filter(e => !e.is_consolidated);
  const orgType         = (nonConsolidated[0] as any)?.org_type ?? null;
  const submittedAt     = (ctx.config as any)?.submitted_at ?? null;
  const facilityCount   = (ctx.config as any)?.facility_count ?? nonConsolidated.length ?? 0;

  const registrationStatus = paymentUnlocked ? "Accepted" : setupComplete ? "In review" : "Pending";
  const registrationColor  = paymentUnlocked ? EMERALD : AMBER;
  const registrationBg     = paymentUnlocked ? EMERALD_BG : AMBER_BG;

  const card: React.CSSProperties = {
    background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 18, fontWeight: 700, color: INK, margin: "0 0 14px", letterSpacing: "-0.02em",
  };

  return (
    <div style={{
      fontFamily: "'Inter',system-ui,sans-serif", color: INK,
      minHeight: "100vh", background: CANVAS,
      padding: "40px 48px 72px", maxWidth: 960, margin: "0 auto",
    }}>

      {/* ── Title ─────────────────────────────────────────────────────────── */}
      <h1 style={{ fontSize: 26, fontWeight: 800, color: INK, margin: "0 0 6px", letterSpacing: "-0.03em" }}>
        Welcome to the {ctx.client.name} Decarbonisation Portal
      </h1>
      <p style={{ fontSize: 14, color: SLATE, margin: "0 0 36px", lineHeight: 1.6 }}>
        Track, calculate, and report your organisation's greenhouse gas emissions with confidence.
      </p>

      {/* ── Setup progress (shown until inventory complete) ────────────────── */}
      {!inventoryComplete && (
        <section style={{ marginBottom: 32 }}>
          <p style={sectionLabel}>Setup progress</p>
          <div style={card}>
            {/* Card header */}
            <div style={{
              padding: "18px 24px", borderBottom: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: INK }}>Registration outcome</p>
                {submittedAt && (
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: SLATE }}>
                    Submitted {new Date(submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
              {isPrimary && !paymentUnlocked && (
                <button
                  type="button"
                  onClick={() => navigate({ to: "/register" as any })}
                  style={{ background: "none", border: "none", fontSize: 13, fontWeight: 600, color: MOSS, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                  Edit registration <ArrowRight style={{ width: 13, height: 13 }} />
                </button>
              )}
            </div>

            {/* Status + description */}
            <div style={{ padding: "18px 24px 16px" }}>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: SLATE, lineHeight: 1.65 }}>
                {paymentUnlocked
                  ? "Your account is fully activated. All portal modules are now unlocked."
                  : "Once our team confirms your payment, your account will be fully activated."}
              </p>

              {/* Three status columns */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, borderTop: `1px solid ${BORDER}`, paddingTop: 18, marginBottom: 18 }}>
                <div style={{ paddingRight: 20 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: SLATE, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
                    Registration status
                  </p>
                  <span style={{
                    display: "inline-block", padding: "4px 12px", borderRadius: 20,
                    background: registrationBg, fontSize: 12, fontWeight: 700, color: registrationColor,
                  }}>
                    {registrationStatus}
                  </span>
                </div>
                <div style={{ paddingRight: 20, borderLeft: `1px solid ${BORDER}`, paddingLeft: 20 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: SLATE, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
                    Organisation type
                  </p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: INK }}>
                    {orgType || "—"}
                  </p>
                </div>
                <div style={{ borderLeft: `1px solid ${BORDER}`, paddingLeft: 20 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: SLATE, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
                    Entities registered
                  </p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: INK }}>
                    {nonConsolidated.length || "—"}
                  </p>
                </div>
              </div>

              {/* Important notice pre-payment */}
              {!paymentUnlocked && (
                <p style={{ margin: 0, fontSize: 13, color: SLATE, lineHeight: 1.65 }}>
                  <strong style={{ color: INK }}>Important:</strong> Full access to Carbon Footprint, Compliance, and other tools will unlock once your account is activated.
                  If you have any questions, our team is one email away —{" "}
                  <a href={`mailto:${supportEmail}`} style={{ color: MOSS, fontWeight: 600 }}>
                    {supportEmail}
                  </a>.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Get started (payment done, inventory not yet complete) ─────────── */}
      {paymentUnlocked && !inventoryComplete && (
        <section style={{ marginBottom: 32 }}>
          <p style={sectionLabel}>Get started</p>
          <div style={card}>
            <div style={{ padding: "24px 28px" }}>
              <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: INK }}>
                Continue to Inventory Boundary Setup
              </p>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: SLATE, lineHeight: 1.65 }}>
                The next step is to define your reporting boundary — the operational scope, base year, and gases you'll be measuring.
                Click below when you're ready to begin.
              </p>
              <button
                type="button"
                onClick={() => navigate({ to: "/inventory-setup" as any })}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "11px 22px", borderRadius: 10, border: "none",
                  background: `linear-gradient(135deg,${FOREST},${MOSS})`,
                  color: WHITE, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 3px 10px rgba(30,111,92,0.3)", fontFamily: "inherit",
                }}>
                Start Inventory Boundary <ArrowRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Resources ─────────────────────────────────────────────────────── */}
      <section>
        <p style={sectionLabel}>Resources</p>
        <div style={{ ...card }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
            {([
              { title: "Library",       desc: "Read our decarbonisation reporting guides, standards references, and FAQs.",           icon: Library,  action: () => navigate({ to: "/reports" as any }) },
              { title: "Methodology",   desc: "Understand the calculation approaches used across each emissions category.",           icon: BookOpen, action: () => navigate({ to: "/methodology" as any }) },
              { title: "Support",       desc: "Get in touch with our team for setup help and questions.",                             icon: HelpCircle, action: () => window.open(`mailto:${supportEmail}`) },
            ] as const).map((r, i) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.title}
                  style={{
                    padding: "22px 24px",
                    borderLeft: i > 0 ? `1px solid ${BORDER}` : "none",
                  }}>
                  <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: INK }}>{r.title}</p>
                  <p style={{ margin: "0 0 16px", fontSize: 13, color: SLATE, lineHeight: 1.6 }}>{r.desc}</p>
                  <button
                    type="button"
                    onClick={r.action}
                    style={{ background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 600, color: MOSS, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                    Open <ArrowRight style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
