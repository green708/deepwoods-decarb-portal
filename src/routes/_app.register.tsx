import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { changePassword } from "@/lib/auth";
import {
  ArrowRight, Building2, Plus, RefreshCw, LogOut,
  Search, ChevronDown, ChevronUp, Lock,
  SlidersHorizontal,
  MapPin, Users, Calendar, Clock, User,
} from "lucide-react";
import { useClientContext, type ClientEntity } from "@/lib/client-context";
import { logout as doLogout } from "@/lib/auth";

export const Route = createFileRoute("/_app/register")({ component: RegisterEntityPage });

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
const EMERALD    = "#15803D";
const EMERALD_BG = "#DCFCE7";
const GHOST_BG   = "#F1F5F9";
const GHOST_TEXT = "#64748B";
const ACCENT     = "#C55B46";   // salmon-red — matches reference active/due colour
const ACCENT_BG  = "#FFF4F2";

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

type OrgStatus = "accepted" | "in-review" | "setup-pending";

// ── Sidebar (standalone register layout) ──────────────────────────────────────
function Sidebar({ clientName, paymentUnlocked, onUserProfile }: { clientName: string; paymentUnlocked: boolean; onUserProfile: () => void }) {
  const dotActive  = { width: 7, height: 7, borderRadius: "50%", background: ACCENT, flexShrink: 0 } as const;
  const dotLocked  = { width: 7, height: 7, borderRadius: "50%", border: `1.5px solid #CBD5E1`, flexShrink: 0 } as const;
  const dotGhost   = { width: 7, height: 7, borderRadius: "50%", border: `1.5px solid #CBD5E1`, flexShrink: 0 } as const;
  const navItem    = { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const } as const;

  return (
    <aside style={{
      width: 220, flexShrink: 0, background: WHITE,
      borderRight: `1px solid ${BORDER}`,
      display: "flex", flexDirection: "column", minHeight: "100vh",
      fontFamily: "'Inter',system-ui,sans-serif",
    }}>
      <div style={{ padding: "22px 20px 18px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: MOSS, textTransform: "uppercase" as const }}>
            DEEPWOODS
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: INK, letterSpacing: "-0.03em" }}>GREEN</div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "10px 8px" }}>
        {/* Overview — unlocked after payment, locked before */}
        {paymentUnlocked ? (
          <a href="/overview" style={{ ...navItem, color: GHOST_TEXT, textDecoration: "none", display: "flex" }}>
            <div style={dotGhost} />
            Overview
          </a>
        ) : (
          <div style={{ ...navItem, color: GHOST_TEXT, cursor: "not-allowed" }}>
            <div style={dotLocked} />
            Overview
            <Lock style={{ width: 10, height: 10, marginLeft: "auto", color: "#CBD5E1" }} />
          </div>
        )}

        {/* Register — active */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 12px 9px 9px", marginTop: 2, borderRadius: 8,
          background: ACCENT_BG, borderLeft: `3px solid ${ACCENT}`,
          color: INK, fontSize: 13, fontWeight: 700,
        }}>
          <div style={dotActive} />
          Register
        </div>
      </nav>

      <div style={{ padding: "8px 8px 16px", borderTop: `1px solid ${BORDER}` }}>
        {clientName && (
          <div style={{ ...navItem, color: GHOST_TEXT, cursor: "default", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            <div style={dotGhost} />
            {clientName}
          </div>
        )}
        <button type="button" onClick={onUserProfile} style={{ ...navItem, color: GHOST_TEXT }}>
          <div style={dotGhost} />
          User profile
        </button>
        <button
          type="button"
          onClick={async () => { await doLogout(); window.location.href = "/"; }}
          style={{ ...navItem, color: GHOST_TEXT }}>
          <div style={dotGhost} />
          Logout
        </button>
      </div>
    </aside>
  );
}

// ── Detail row (with icon) ─────────────────────────────────────────────────────
function DetailRow({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Icon style={{ width: 13, height: 13, color: SLATE, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: SLATE }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, color: INK, fontWeight: 500, textAlign: "right" as const }}>{value}</span>
    </div>
  );
}

// ── Org card ──────────────────────────────────────────────────────────────────
function OrgCard({
  org, status, paymentUnlocked, expanded, onToggle, teamCount, facilityCount, createdAt, activatedAt,
}: {
  org: ClientEntity;
  status: OrgStatus;
  paymentUnlocked: boolean;
  expanded: boolean;
  onToggle: () => void;
  teamCount: string;
  facilityCount: string;
  createdAt: string | null | undefined;
  activatedAt: string | null | undefined;  // last_activity_at from config
}) {
  const badge = {
    "accepted":      { bg: EMERALD_BG, color: EMERALD,    dot: EMERALD,    text: "ACCEPTED"      },
    "in-review":     { bg: AMBER_BG,   color: AMBER,      dot: "#D97706",  text: "IN REVIEW"     },
    "setup-pending": { bg: GHOST_BG,   color: GHOST_TEXT, dot: "#94A3B8",  text: "SETUP PENDING" },
  }[status];

  // Avatar text: show entity code (max 4 chars), fallback to initials
  const avatarText = org.code.length <= 4 ? org.code : org.code.slice(0, 3);
  const avatarFontSize = avatarText.length > 3 ? 9 : 12;

  // "Open →" colour: green when unlocked, accent when locked
  const openColor = paymentUnlocked ? MOSS : ACCENT;

  return (
    <div style={{
      border: `1px solid ${BORDER}`, borderRadius: 14,
      overflow: "hidden", background: WHITE, marginBottom: 12,
      boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
    }}>
      {/* ── Card header ── */}
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", cursor: "pointer", userSelect: "none" as const }}
      >
        {/* Circular avatar with code */}
        <div style={{
          width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
          background: FOREST,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: avatarFontSize, fontWeight: 800, color: WHITE, letterSpacing: "0.03em",
        }}>
          {avatarText}
        </div>

        {/* Name + status badge + payment badge */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {org.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: badge.bg }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: badge.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, letterSpacing: "0.07em" }}>{badge.text}</span>
            </div>
            {paymentUnlocked ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: EMERALD_BG, border: `1px solid #86EFAC` }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: EMERALD, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: EMERALD, letterSpacing: "0.07em" }}>PAID</span>
              </div>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: AMBER_BG, border: `1px solid #FDE68A` }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#D97706", flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: "0.07em" }}>DUE</span>
              </div>
            )}
          </div>
        </div>

        {/* Open → (text link, no box) */}
        <a
          href="/home"
          onClick={e => e.stopPropagation()}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, color: openColor, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          Open <ArrowRight style={{ width: 13, height: 13 }} />
        </a>

        {/* Expand/collapse chevron */}
        <div style={{ color: SLATE, flexShrink: 0 }}>
          {expanded
            ? <ChevronUp   style={{ width: 16, height: 16 }} />
            : <ChevronDown style={{ width: 16, height: 16 }} />}
        </div>
      </div>

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, background: CANVAS }}>
          {/* Two-column: About + Activity */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "20px 24px 18px", gap: 0 }}>
            <div style={{ paddingRight: 28, borderRight: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: SLATE, marginBottom: 14 }}>
                About This Entity
              </div>
              <DetailRow icon={Building2} label="Organization type" value={(org as any).org_type || "—"} />
              <DetailRow icon={MapPin}    label="Facility count"    value={facilityCount === "0" ? "—" : facilityCount} />
              <DetailRow icon={Users}     label="Team members"      value={teamCount} />
            </div>

            <div style={{ paddingLeft: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: SLATE, marginBottom: 14 }}>
                Activity
              </div>
              <DetailRow icon={Calendar} label="Created on"    value={fmtDate(createdAt)} />
              <DetailRow icon={Clock}    label="Last edit"      value={fmtDate(activatedAt)} />
              <DetailRow icon={User}     label="Updated by"     value={org.name} />
            </div>
          </div>

          {/* Plan & Billing */}
          <div style={{
            borderTop: `1px solid ${BORDER}`, background: WHITE,
            padding: "14px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: SLATE, marginBottom: 7 }}>
                Plan &amp; Billing
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>
                  Deepwoods Decarbonisation Portal — Annual Access
                </span>
                {paymentUnlocked ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: EMERALD_BG, border: `1px solid #86EFAC`, fontSize: 11, fontWeight: 700, color: EMERALD }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: EMERALD }} />
                    PAID
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: AMBER_BG, border: `1px solid #FDE68A`, fontSize: 11, fontWeight: 700, color: "#D97706" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#D97706" }} />
                    DUE
                  </span>
                )}
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: SLATE, flexShrink: 0, textAlign: "right" as const }}>
              For invoice copies, contact your<br />
              <strong style={{ color: INK }}>Deepwoods account manager</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ onSetup }: { onSetup: () => void }) {
  return (
    <div style={{ background: WHITE, border: `2px dashed ${BORDER}`, borderRadius: 14, padding: "52px 24px", textAlign: "center" as const }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, margin: "0 auto 16px", background: CANVAS, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Building2 style={{ width: 20, height: 20, color: SLATE }} />
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: INK }}>No organisation registered yet</p>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: SLATE, lineHeight: 1.65 }}>
        Complete the setup to register your first organisation.
      </p>
      <button
        type="button"
        onClick={onSetup}
        style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "13px 28px", borderRadius: 11, border: "none", background: `linear-gradient(135deg, ${FOREST} 0%, ${MOSS} 100%)`, color: WHITE, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(30,111,92,0.35)", fontFamily: "inherit" }}>
        Complete organisation setup <ArrowRight style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
}

// ── Inline password-change modal (for standalone register page) ─────────────────
function ChangePwModal({ onClose }: { onClose: () => void }) {
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
    try { await changePassword(current, next); setDone(true); setTimeout(onClose, 1200); }
    catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setLoading(false); }
  };

  const inp = { width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  return (
    <div style={{ position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: WHITE, borderRadius: 16, width: "100%", maxWidth: 400, padding: "28px 28px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: INK }}>Change password</h3>
        {done ? (
          <p style={{ fontSize: 14, color: MOSS, fontWeight: 600 }}>Password updated successfully.</p>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {err && <div style={{ padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#DC2626" }}>{err}</div>}
            <div><label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: SLATE, letterSpacing: "0.08em" }}>Current password</label><input type="password" style={inp} value={current} onChange={e => setCurrent(e.target.value)} required /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: SLATE, letterSpacing: "0.08em" }}>New password (min 8 chars)</label><input type="password" style={inp} value={next} onChange={e => setNext(e.target.value)} required /></div>
            <div><label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: SLATE, letterSpacing: "0.08em" }}>Confirm new password</label><input type="password" style={inp} value={confirm} onChange={e => setConfirm(e.target.value)} required /></div>
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
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
function RegisterEntityPage() {
  const navigate        = useNavigate();
  const ctx             = useClientContext();
  const paymentUnlocked = ctx.client.payment_status === "paid" || ctx.client.payment_status === "waived";
  const setupComplete   = ctx.config.setup_complete === true || ctx.config.setup_complete === "true";
  const isFullscreen    = true; // always render standalone with own sidebar
  const [showChangePw, setShowChangePw] = useState(false);

  const allOrgs     = ctx.entities.filter(e => !e.is_consolidated);
  const teamCount   = (ctx.config as any).team_count?.toString() || "—";
  const facilityCount = (ctx.config as any).facility_count?.toString() || "0";
  const createdAt    = (ctx.client as any).created_at         as string | null | undefined;
  const lastEditAt   = (ctx.config  as any).last_activity_at  as string | null | undefined;

  const [search,       setSearch]       = useState("");
  // Auto-expand the first card so details are visible immediately
  const [expandedCode, setExpandedCode] = useState<string | null>(allOrgs[0]?.code ?? null);

  const orgs = search
    ? allOrgs.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.code.toLowerCase().includes(search.toLowerCase()))
    : allOrgs;

  const orgStatus: OrgStatus = paymentUnlocked
    ? "accepted"
    : setupComplete ? "in-review" : "setup-pending";

  const acceptedCount = paymentUnlocked ? allOrgs.length : 0;

  // ── Main content ──────────────────────────────────────────────────────────
  const mainContent = (
    <main style={{
      flex: 1, minWidth: 0,
      padding: isFullscreen ? "36px 44px 64px" : "28px 32px 56px",
      overflowY: "auto" as const,
      fontFamily: "'Inter',system-ui,sans-serif", color: INK,
      position: "relative" as const,
    }}>

      {/* Decorative background circles (top-right) */}
      {isFullscreen && (
        <div style={{ position: "absolute" as const, top: -60, right: -60, width: 360, height: 360, opacity: 0.045, pointerEvents: "none" as const, zIndex: 0 }}>
          <svg viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">
            {[165, 130, 95, 60, 25].map(r => (
              <circle key={r} cx="180" cy="180" r={r} stroke={MOSS} strokeWidth="1.5" />
            ))}
          </svg>
        </div>
      )}

      <div style={{ maxWidth: 860, margin: "0 auto", position: "relative" as const, zIndex: 1 }}>

        {/* ── Payment-pending notice ── */}
        {!paymentUnlocked && setupComplete && (
          <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 12, background: AMBER_BG, border: `1px solid #FDE68A`, display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" as const }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: AMBER }}>
                Under review — awaiting payment confirmation
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#78350F", lineHeight: 1.6 }}>
                Your registration has been submitted. A Deepwoods consultant will review and confirm your subscription.
                Once payment is confirmed you'll get full access to all portal modules.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "8px 14px", borderRadius: 8, border: `1px solid #FDE68A`, background: WHITE, color: AMBER, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <RefreshCw style={{ width: 13, height: 13 }} /> Refresh status
            </button>
          </div>
        )}


        {/* ── Page header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" as const }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: INK, margin: "0 0 4px", letterSpacing: "-0.03em" }}>
              Register
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: SLATE }}>
              Every entity in your group, logged and dated.
            </p>
            {allOrgs.length > 0 && (
              <p style={{ margin: "6px 0 0", fontSize: 13, color: INK }}>
                <strong>{allOrgs.length}</strong> {allOrgs.length === 1 ? "entity" : "entities"}
                {acceptedCount > 0 && (
                  <> · <strong style={{ color: EMERALD }}>{acceptedCount} accepted</strong></>
                )}
                {" · "}
                <strong style={{ color: GHOST_TEXT }}>
                  {!paymentUnlocked && setupComplete ? allOrgs.length : 0} pending
                </strong>
              </p>
            )}
          </div>

          {allOrgs.length > 0 && (
            <button
              type="button"
              onClick={() => navigate({ to: "/entity-setup" })}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0, padding: "10px 18px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${FOREST} 0%, ${MOSS} 100%)`, color: WHITE, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 3px 10px rgba(30,111,92,0.3)", fontFamily: "inherit" }}>
              Register entity
            </button>
          )}
        </div>

        {/* ── Search + filter ── */}
        {allOrgs.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <div style={{ flex: 1, position: "relative" as const }}>
              <Search style={{ position: "absolute" as const, left: 12, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: SLATE }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by company name"
                style={{ width: "100%", padding: "10px 14px 10px 36px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, color: INK, background: WHITE, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" }}
              />
            </div>
            <button
              type="button"
              style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "10px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: WHITE, color: SLATE, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              <SlidersHorizontal style={{ width: 14, height: 14 }} />
            </button>
          </div>
        )}

        {/* ── Cards or empty state ── */}
        {orgs.length > 0 ? (
          <>
            {orgs.map(o => (
              <OrgCard
                key={o.code}
                org={o}
                status={orgStatus}
                paymentUnlocked={paymentUnlocked}
                expanded={expandedCode === o.code}
                onToggle={() => setExpandedCode(p => p === o.code ? null : o.code)}
                teamCount={teamCount}
                facilityCount={facilityCount}
                createdAt={createdAt}
                activatedAt={lastEditAt}
              />
            ))}
            <div style={{ marginTop: 12, fontSize: 12, color: SLATE, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Page 1 of 1</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button disabled style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: WHITE, fontSize: 12, color: GHOST_TEXT, cursor: "not-allowed", fontFamily: "inherit" }}>Previous</button>
                <button disabled style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${BORDER}`, background: WHITE, fontSize: 12, color: GHOST_TEXT, cursor: "not-allowed", fontFamily: "inherit" }}>Next</button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState onSetup={() => navigate({ to: "/entity-setup" })} />
        )}
      </div>
    </main>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: CANVAS, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <Sidebar clientName={ctx.client.name} paymentUnlocked={paymentUnlocked} onUserProfile={() => setShowChangePw(true)} />
      {mainContent}
      {showChangePw && <ChangePwModal onClose={() => setShowChangePw(false)} />}
    </div>
  );
}
