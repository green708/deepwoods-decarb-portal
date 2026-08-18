import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
import {
  authFetch, getEmail, getMustChangePassword, getRole, getToken,
  logout as doLogout, changePassword, DEEPWOODS_ROLES, ROLE_META, type Role,
} from "@/lib/auth";
import {
  Home, FolderLock, Upload, ShieldCheck, BookOpen, LogOut, Menu, X,
  KeyRound, Loader2, Bell, LayoutDashboard, BarChart2, Leaf,
  ChevronDown, ChevronRight, PieChart, Target, Zap, FileText, TrendingDown,
  Landmark, ClipboardList, Bot, Users, Clock, Building2, CreditCard, Check,
  Search, RefreshCw, Lock,
} from "lucide-react";
import {
  ClientContextProvider, useClientContextSafe, useClientContext, type ClientContext,
} from "@/lib/client-context";
import { EntityProvider, EntitySwitcher, FiscalYearProvider, FiscalYearSwitcher, useEntity } from "@/lib/entity";
import { DeecarbAI } from "@/components/DeecarbAI";
import { toast } from "sonner";

export const Route = createFileRoute("/_app")({ component: AppRoot });

// ── NavigateTo — triggers a client-side navigation inside the gate ────────────
function NavigateTo({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => { navigate({ to }); }, []);
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-white">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6F4EF]">
        <Loader2 className="h-7 w-7 animate-spin text-[#1E6F5C]" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Loading your workspace…</p>
    </div>
  );
}

// ── PendingActivation — shown to client users whose account isn't yet active ──

function PendingActivation() {
  const logout = async () => { await doLogout(); window.location.href = "/"; };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#1E4D2B] via-[#145C3D] to-[#1E4D2B] px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-white/10">
          <Clock className="h-8 w-8 text-white/80" />
        </div>
        <h1 className="mb-3 text-2xl font-bold text-white">Pending Activation</h1>
        <p className="mb-2 text-sm leading-relaxed text-white/75">
          Your workspace is being prepared by your Deepwoods consultant.
          You'll receive an email once your account is activated and ready to use.
        </p>
        <p className="mb-8 text-sm text-white/50">
          If you believe this is a mistake, contact your Deepwoods account manager.
        </p>
        <button
          onClick={logout}
          className="flex mx-auto items-center gap-2 rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── PaymentPending — pricing page shown after setup until payment is confirmed ─

function PaymentPending({ ctx }: { ctx: ClientContext }) {
  const FOREST = "#1E4D2B";
  const MOSS   = "#1E6F5C";
  const MINT   = "#3DA882";
  const INK    = "#0D1C12";
  const SLATE  = "#5A6872";
  const MUTED  = "#94A3B8";
  const BORDER = "#E2E8E4";
  const BG     = "#EEF3F0";
  const WHITE  = "#FFFFFF";

  const [requested, setRequested] = useState(
    ctx.config.payment_requested === "true" || ctx.config.payment_requested === true,
  );
  const [sending, setSending] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("professional");
  const logout = async () => { await doLogout(); window.location.href = "/"; };

  const requestInvoice = async () => {
    setSending(true);
    try {
      await authFetch("request-payment.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      setRequested(true);
    } catch { setRequested(true); }
    finally { setSending(false); }
  };

  const plans = [
    {
      key: "starter",
      name: "Starter",
      tagline: "Begin your GHG journey",
      price: "₹75,000",
      period: "/year",
      color: MOSS,
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
      color: FOREST,
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
      color: FOREST,
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
      color: INK,
      popular: false,
      features: [
        "Everything in Professional",
        "Multi-entity & group reporting",
        "Regulatory disclosure (BRSR, CDP, GRI)",
        "Custom emission factor library",
        "API & data export integrations",
        "On-site workshops & training",
        "Named consultant team",
      ],
    },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter',system-ui,sans-serif", color: INK }}>
      <style>{`
        @keyframes pp-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes pp-fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .pp-card{transition:transform 0.18s,box-shadow 0.18s;}
        .pp-card:hover{transform:translateY(-4px);box-shadow:0 16px 48px rgba(30,79,60,0.16),0 4px 12px rgba(0,0,0,0.06)!important;}
      `}</style>

      {/* Accent stripe */}
      <div style={{ height: 4, background: `linear-gradient(90deg,${FOREST} 0%,${MOSS} 50%,${MINT} 100%)` }} />

      {/* Header */}
      <header style={{
        background: WHITE, borderBottom: `1px solid ${BORDER}`,
        padding: "0 40px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <img src="/deepwoods-logo.png" alt="Deepwoods" style={{ height: 34, width: "auto" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={() => window.location.reload()}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px",
              borderRadius: 8, border: `1.5px solid ${BORDER}`, background: WHITE,
              color: SLATE, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
          </button>
          <button type="button" onClick={logout}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px",
              borderRadius: 8, border: `1.5px solid ${BORDER}`, background: WHITE,
              color: SLATE, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <LogOut style={{ width: 12, height: 12 }} /> Sign out
          </button>
        </div>
      </header>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(160deg,${FOREST} 0%,${MOSS} 55%,${MINT} 100%)`,
        padding: "72px 40px 90px", textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        {/* Decorative leaves */}
        <div style={{ position: "absolute", top: 20, left: 60, opacity: 0.08, transform: "rotate(-20deg)" }}>
          <Leaf style={{ width: 120, height: 120, color: WHITE }} />
        </div>
        <div style={{ position: "absolute", bottom: 10, right: 80, opacity: 0.06, transform: "rotate(30deg)" }}>
          <Target style={{ width: 160, height: 160, color: WHITE }} />
        </div>
        <div style={{ position: "absolute", top: 40, right: 30, opacity: 0.05, transform: "rotate(-10deg)" }}>
          <TrendingDown style={{ width: 80, height: 80, color: WHITE }} />
        </div>

        <div style={{ position: "relative", maxWidth: 640, margin: "0 auto", animation: "pp-fade 0.5s ease both" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 16px",
            borderRadius: 20, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
            fontSize: 12, fontWeight: 700, color: WHITE, letterSpacing: "0.08em",
            textTransform: "uppercase", marginBottom: 20,
          }}>
            <Check style={{ width: 13, height: 13 }} />
            Registration received
          </div>
          <h1 style={{ margin: "0 0 16px", fontSize: 42, fontWeight: 900,
            color: WHITE, letterSpacing: "-0.04em", lineHeight: 1.1 }}>
            Choose your<br />
            <span style={{ color: "#A7F3D0" }}>decarbonisation plan</span>
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: "rgba(255,255,255,0.82)", lineHeight: 1.7, maxWidth: 500, marginInline: "auto" }}>
            Your details are with our team. Select the engagement that fits your organisation's
            scope and ambition — we'll reach out to confirm within 2 business days.
          </p>
        </div>
      </div>

      {/* Pricing cards */}
      <div style={{ maxWidth: 1160, margin: "-48px auto 0", padding: "0 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {plans.map(plan => {
            const isSelected = selectedPlan === plan.key;
            const isPopular  = plan.popular;
            return (
              <div key={plan.key}
                className="pp-card"
                onClick={() => setSelectedPlan(plan.key)}
                style={{
                  position: "relative", borderRadius: 20, overflow: "visible",
                  cursor: "pointer",
                  background: isPopular
                    ? `linear-gradient(160deg,${FOREST} 0%,${MOSS} 100%)`
                    : WHITE,
                  border: isSelected
                    ? `2.5px solid ${MINT}`
                    : isPopular ? "2.5px solid transparent" : `1.5px solid ${BORDER}`,
                  boxShadow: isPopular
                    ? "0 12px 40px rgba(30,79,60,0.28),0 4px 12px rgba(0,0,0,0.1)"
                    : "0 2px 12px rgba(30,79,60,0.08)",
                  transform: isPopular ? "translateY(-8px)" : "none",
                  paddingBottom: 24,
                }}>

                {/* Popular badge */}
                {isPopular && (
                  <div style={{
                    position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                    padding: "4px 16px", borderRadius: 20,
                    background: `linear-gradient(90deg,#A7F3D0,${MINT})`,
                    fontSize: 10, fontWeight: 800, color: FOREST, letterSpacing: "0.1em",
                    textTransform: "uppercase", whiteSpace: "nowrap",
                    boxShadow: "0 2px 8px rgba(61,168,130,0.4)",
                  }}>
                    Most Popular
                  </div>
                )}

                {/* Selected check */}
                {isSelected && (
                  <div style={{
                    position: "absolute", top: 14, right: 14,
                    width: 22, height: 22, borderRadius: "50%",
                    background: isPopular ? "rgba(255,255,255,0.9)" : MOSS,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Check style={{ width: 12, height: 12, color: isPopular ? FOREST : WHITE }} />
                  </div>
                )}

                {/* Card body */}
                <div style={{ padding: "28px 24px 20px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
                    textTransform: "uppercase", color: isPopular ? "rgba(255,255,255,0.6)" : MUTED }}>
                    {plan.name}
                  </p>
                  <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 500, lineHeight: 1.4,
                    color: isPopular ? "rgba(255,255,255,0.85)" : SLATE }}>
                    {plan.tagline}
                  </p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 20 }}>
                    <span style={{ fontSize: plan.price === "Custom" ? 28 : 26, fontWeight: 900,
                      color: isPopular ? WHITE : INK, letterSpacing: "-0.03em" }}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span style={{ fontSize: 13, color: isPopular ? "rgba(255,255,255,0.6)" : MUTED, fontWeight: 500 }}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <div style={{ width: "100%", height: 1, background: isPopular ? "rgba(255,255,255,0.15)" : BORDER, marginBottom: 18 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                        <div style={{
                          width: 17, height: 17, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                          background: isPopular ? "rgba(167,243,208,0.25)" : "#ECF7F3",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Check style={{ width: 9, height: 9, color: isPopular ? "#A7F3D0" : MOSS }} />
                        </div>
                        <span style={{ fontSize: 13, lineHeight: 1.4,
                          color: isPopular ? "rgba(255,255,255,0.88)" : SLATE }}>
                          {f}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA section */}
        <div style={{
          marginTop: 40, background: WHITE, border: `1.5px solid ${BORDER}`,
          borderRadius: 20, padding: "32px 40px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
          boxShadow: "0 4px 20px rgba(30,79,60,0.08)",
          flexWrap: "wrap",
        }}>
          <div>
            <p style={{ margin: "0 0 5px", fontSize: 18, fontWeight: 800, color: INK, letterSpacing: "-0.02em" }}>
              Ready to get started?
            </p>
            <p style={{ margin: 0, fontSize: 14, color: SLATE, lineHeight: 1.6 }}>
              You've selected the{" "}
              <strong style={{ color: MOSS }}>
                {plans.find(p => p.key === selectedPlan)?.name ?? "Professional"} plan
              </strong>
              . We'll send you a tailored proposal within 2 business days.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
            {requested ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
                borderRadius: 12, background: "#F0FDF4", border: "1px solid #86EFAC",
                fontSize: 13, color: "#15803D", fontWeight: 600,
              }}>
                <Check style={{ width: 15, height: 15 }} />
                Request sent — we'll be in touch shortly.
              </div>
            ) : (
              <button type="button" onClick={requestInvoice} disabled={sending}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "13px 32px", borderRadius: 12, border: "none",
                  background: `linear-gradient(135deg,${FOREST},${MOSS})`,
                  color: WHITE, fontSize: 14, fontWeight: 700,
                  cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.6 : 1,
                  boxShadow: "0 4px 14px rgba(30,111,92,0.35)",
                  fontFamily: "inherit",
                }}>
                {sending && <Loader2 style={{ width: 15, height: 15, animation: "pp-spin 1s linear infinite" }} />}
                {sending ? "Requesting…" : "Request a proposal →"}
              </button>
            )}
            <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
              No payment required now · We'll confirm scope before invoicing
            </p>
          </div>
        </div>

        {/* Trust bar */}
        <div style={{
          marginTop: 28, display: "flex", justifyContent: "center", flexWrap: "wrap",
          gap: "8px 32px",
        }}>
          {[
            "GHG Protocol aligned",
            "ISO 14064 compatible",
            "SBTi ready",
            "BRSR / CDP support",
            "No lock-in contracts",
          ].map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, color: SLATE, fontWeight: 600 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: MINT }} />
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ForcePasswordChangeScreen — shown when must_change_password=true ─────────
// Renders before ANY portal content. User must complete this before the portal
// loads. No register page, no sidebar, no client data is visible behind it.

function ForcePasswordChangeScreen({ onDone }: { onDone: () => void }) {
  const [current, setCurrent]   = useState("");
  const [next, setNext]         = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);

  const rules = [
    { ok: next.length >= 8,               label: "At least 8 characters" },
    { ok: /[A-Z]/.test(next),             label: "One uppercase letter" },
    { ok: /[0-9]/.test(next),             label: "One number" },
    { ok: next !== "" && next !== current, label: "Different from your one-time code" },
  ];
  const strong = rules.every(r => r.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong) { setError("Please meet all password requirements."); return; }
    if (next !== confirm) { setError("Passwords do not match."); return; }
    setError(null);
    setSubmitting(true);
    try {
      await changePassword(current, next);
      setDone(true);
      setTimeout(onDone, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed. Check your one-time code and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldCls = "w-full rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/50 focus:bg-white/15 backdrop-blur-sm";

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1E4D2B] via-[#145C3D] to-[#1E4D2B] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
            <Check className="h-7 w-7 text-white" />
          </div>
          <p className="text-base font-semibold text-white">Password set. Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#1E4D2B] via-[#145C3D] to-[#1E4D2B] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <KeyRound className="h-7 w-7 text-white/80" />
          </div>
          <h1 className="text-xl font-bold text-white">Set your password</h1>
          <p className="mt-1.5 text-sm text-white/65">
            For security, set a permanent password before accessing the portal.
            Enter the one-time access code from your invitation email as your current password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">One-time access code</label>
            <input
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              autoComplete="current-password"
              placeholder="From your invitation email"
              className={fieldCls}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">New password</label>
            <input
              type="password"
              value={next}
              onChange={e => setNext(e.target.value)}
              autoComplete="new-password"
              placeholder="Choose a strong password"
              className={fieldCls}
              required
            />
            {next && (
              <ul className="mt-2 space-y-1">
                {rules.map(r => (
                  <li key={r.label} className={`flex items-center gap-1.5 text-[11px] ${r.ok ? "text-[#34D399]" : "text-white/45"}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${r.ok ? "bg-[#34D399]" : "bg-white/30"}`} />
                    {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="Repeat your new password"
              className={fieldCls}
              required
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !current || !next || !confirm}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-[#145C3D] hover:bg-white/90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Updating…" : "Set password & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── AppRoot — wraps everything in ClientContextProvider ───────────────────────

function AppRoot() {
  const navigate = useNavigate();
  const [role, setRoleState] = useState<Role | null>(null);
  const [checking, setChecking] = useState(true);
  const [mustChangePw, setMustChangePw] = useState(false);

  useEffect(() => {
    const r = getRole();
    if (!r || !getToken()) { setChecking(false); navigate({ to: "/" }); return; }
    authFetch("me.php")
      .then(() => { setRoleState(r); setMustChangePw(getMustChangePassword()); })
      .catch(() => { toast.error("Session expired — please sign in again."); navigate({ to: "/" }); })
      .finally(() => setChecking(false));
  }, [navigate]);

  if (checking) return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-white">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6F4EF]">
        <Loader2 className="h-7 w-7 animate-spin text-[#1E6F5C]" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Verifying session…</p>
    </div>
  );
  if (!role) return null;

  // Check must_change_password BEFORE rendering any portal content.
  // Uses state (not inline localStorage read) so clearing the flag causes a
  // proper re-render that removes the gate without a manual page refresh.
  if (mustChangePw) {
    return <ForcePasswordChangeScreen onDone={() => setMustChangePw(false)} />;
  }

  return (
    <ClientContextProvider>
      <ClientContextGate role={role} />
    </ClientContextProvider>
  );
}

// Gate: wait for ClientContext before rendering providers that depend on it
function ClientContextGate({ role }: { role: Role }) {
  const ctxState = useClientContextSafe();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });

  if (ctxState.status === "loading") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-white">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6F4EF]">
          <Loader2 className="h-7 w-7 animate-spin text-[#1E6F5C]" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }
  if (ctxState.status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-white px-4">
        <div className="w-full max-w-sm rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
            <span className="text-lg text-red-500">!</span>
          </div>
          <h3 className="mb-1 text-sm font-semibold text-[#1F2937]">Unable to load workspace</h3>
          <p className="text-xs text-red-600">{ctxState.error}</p>
          <p className="mt-2 text-xs text-slate-500">Try refreshing the page. If the problem persists, contact your Deepwoods account manager.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }

  // Activation gate: client-role users whose account hasn't been activated yet
  if (ctxState.status === "ready" && !DEEPWOODS_ROLES.includes(role) && !ctxState.data.client.is_active) {
    return <PendingActivation />;
  }

  if (ctxState.status === "ready" && !DEEPWOODS_ROLES.includes(role) && ctxState.data.client.is_active) {
    // config values come back as boolean true (PHP json_decode) or string "true" — handle both
    const setupComplete     = ctxState.data.config.setup_complete === true || ctxState.data.config.setup_complete === "true";
    const inventoryComplete = ctxState.data.config.inventory_complete === true || ctxState.data.config.inventory_complete === "true";
    const paymentUnlocked   = (ctxState.data.client.payment_status === "paid" ||
                               ctxState.data.client.payment_status === "waived");

    // Primary contact = the email that submitted the setup wizard.
    // Only they see /register; team members added later go straight to /workstreams.
    // Falls back to true if the flag hasn't been set yet (old accounts).
    const primaryContactEmail = ((ctxState.data.config.primary_contact_email as string) || "").toLowerCase();
    const currentEmail        = (getEmail() || "").toLowerCase();
    const isPrimaryContact    = !primaryContactEmail || currentEmail === primaryContactEmail;

    // Setup paths render fullscreen (no sidebar) while setup is in progress.
    const onSetupPath = (
      pathname.startsWith("/register") ||
      pathname.startsWith("/entity-setup") ||
      pathname.startsWith("/inventory-setup")
    );

    // Phase A gate: primary contact goes to /register to complete setup.
    // Secondary team members skip straight to /workstreams (locked preview).
    if (!setupComplete) {
      if (!onSetupPath) return <NavigateTo to={isPrimaryContact ? "/register" : "/home"} />;
      // On a setup path: primary contact renders fullscreen; others redirect away
      if (!isPrimaryContact) return <NavigateTo to="/home" />;
      return <Outlet />;
    }

    // Payment gate: setup done but payment not yet confirmed.
    // Primary contact can still visit /register to view registration status.
    // Everyone gets /workstreams as the locked home; all other routes redirect there.
    if (setupComplete && !paymentUnlocked) {
      if (isPrimaryContact && (pathname.startsWith("/register") || pathname.startsWith("/entity-setup"))) return <Outlet />;
      if (pathname.startsWith("/home")) { /* fall through to AppLayout */ }
      else return <NavigateTo to="/home" />;
    }

    // Phase B: payment confirmed, inventory not yet complete.
    // No redirect lock — users navigate freely. Home page shows the "Start inventory
    // setup" CTA as the recommended next step. Forced redirects here cause infinite
    // spinner loops because the gate re-fires on every path including /inventory-setup.
  }

  // Register page always renders standalone (has its own 2-tab sidebar) for client users.
  // Never render it inside AppLayout.
  if (!DEEPWOODS_ROLES.includes(role) && pathname.startsWith("/register")) {
    return <Outlet />;
  }

  return (
    <FiscalYearProvider>
      <EntityProvider>
        <AppLayout role={role} />
      </EntityProvider>
    </FiscalYearProvider>
  );
}

// ── ClientLogo — shows logo image or falls back to company-initials badge ─────

function ClientLogo({ src, alt, size }: { src?: string | null; alt: string; size: "sm" | "lg" }) {
  if (src) {
    return <img src={src} alt={alt} className={size === "lg" ? "h-12 w-auto" : "h-7 w-auto"} />;
  }
  const words = alt.trim().split(/\s+/);
  const initials = words.length === 1
    ? words[0].slice(0, 2).toUpperCase()
    : (words[0][0] + words[words.length - 1][0]).toUpperCase();
  const dim = size === "lg" ? { w: 48, h: 48, fs: 18, r: 10 } : { w: 28, h: 28, fs: 11, r: 6 };
  return (
    <div style={{
      width: dim.w, height: dim.h, borderRadius: dim.r,
      background: "var(--primary, #1E6F5C)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: dim.fs, fontWeight: 800, color: "#fff", flexShrink: 0,
      letterSpacing: "-0.02em",
    }}>
      {initials}
    </div>
  );
}

// ── Navigation config — driven by enabled_pages from ClientContext ─────────────

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pageKey: string; // matches enabled_pages values
  badge?: number;
};

type NavGroup = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  paths: string[];
  items: NavItem[];
  pageKey: string;
};

const ALL_TOP_SINGLES: NavItem[] = [
  { to: "/home", label: "Home", icon: Home, pageKey: "home" },
  { to: "/overview",    label: "Overview", icon: PieChart, pageKey: "overview" },
];

const ALL_NAV_GROUPS: NavGroup[] = [
  {
    id: "footprint", label: "Carbon Footprint", icon: Leaf, pageKey: "footprint",
    paths: ["/dashboard", "/inventory", "/inventory-boundary"],
    items: [
      { to: "/dashboard",          label: "Dashboard",          icon: LayoutDashboard, pageKey: "dashboard" },
      { to: "/inventory-boundary", label: "Inventory Boundary", icon: Building2,       pageKey: "inventory" },
    ],
  },
  {
    id: "decarb", label: "Decarbonisation", icon: TrendingDown, pageKey: "decarb",
    paths: ["/hotspots", "/action-plan", "/progress", "/peer"],
    items: [
      { to: "/hotspots",    label: "Hotspot",    icon: BarChart2,   pageKey: "hotspots" },
      { to: "/action-plan", label: "Action Plan", icon: Target,      pageKey: "action-plan" },
      { to: "/progress",    label: "Progress",   icon: TrendingDown, pageKey: "progress" },
      { to: "/peer",        label: "Peer Study",  icon: PieChart,    pageKey: "peer" },
    ],
  },
  {
    id: "green-finance", label: "Green Finance", icon: Landmark, pageKey: "green-finance",
    paths: ["/green-finance"],
    items: [{ to: "/green-finance", label: "Carbon as P&L", icon: Landmark, pageKey: "green-finance" }],
  },
  {
    id: "compliance", label: "Compliance", icon: ShieldCheck, pageKey: "compliance",
    paths: ["/credits", "/reports"],
    items: [
      { to: "/credits", label: "Renewables & I-RECs", icon: Zap,      pageKey: "credits" },
      { to: "/reports", label: "Reports",              icon: FileText, pageKey: "reports" },
    ],
  },
  {
    id: "reporting-cycle", label: "Reporting Cycle", icon: ClipboardList, pageKey: "reporting",
    paths: ["/reporting"],
    items: [{ to: "/reporting", label: "Collection Status", icon: ClipboardList, pageKey: "reporting" }],
  },
];

const ALL_BOTTOM_SINGLES: NavItem[] = [
  { to: "/submissions",      label: "Data Submission",  icon: Upload,     pageKey: "submissions" },
  { to: "/vault",            label: "Document Vault",   icon: FolderLock, pageKey: "vault" },
  { to: "/methodology",      label: "Methodology",      icon: BookOpen,   pageKey: "methodology" },
  { to: "/priority-actions", label: "Priority Actions", icon: Bell,       pageKey: "priority-actions" },
  { to: "/notifications",    label: "Notifications",    icon: Bot,        pageKey: "notifications" },
  { to: "/team",             label: "My Team",          icon: Users,       pageKey: "team" },
  { to: "/admin",            label: "Admin Dashboard",  icon: ShieldCheck, pageKey: "admin" },
  { to: "/register",         label: "Access Requests",  icon: ClipboardList, pageKey: "register" },
];

// ── SetupNextStepBanner — shown on every page except /home ────────────────────

function SetupNextStepBanner() {
  const ctx      = useClientContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });

  const setupComplete     = ctx.config.setup_complete === true || ctx.config.setup_complete === "true";
  const paymentUnlocked   = ctx.client.payment_status === "paid" || ctx.client.payment_status === "waived";
  const inventoryComplete = ctx.config.inventory_complete === true || ctx.config.inventory_complete === "true";
  const primaryEmail      = ((ctx.config.primary_contact_email as string) || "").toLowerCase();
  const currentEmail      = (getEmail() || "").toLowerCase();
  const isPrimary         = !primaryEmail || currentEmail === primaryEmail;

  // Deepwoods staff never see client setup banners
  const role = getRole();
  if (role && DEEPWOODS_ROLES.includes(role as Role)) return null;
  // Home page already shows the full journey tracker
  if (pathname.startsWith("/home")) return null;
  // All setup done — no banner needed
  if (setupComplete && paymentUnlocked && inventoryComplete) return null;

  type BannerCfg = { msg: string; btnLabel?: string; to?: string; accent: "green" | "amber" };

  let cfg: BannerCfg | null = null;

  if (!setupComplete) {
    cfg = isPrimary
      ? { msg: "Complete your organisation setup to get started", btnLabel: "Continue setup", to: "/register", accent: "amber" }
      : { msg: "Waiting for your account manager to complete organisation setup", accent: "amber" };
  } else if (!paymentUnlocked) {
    cfg = { msg: "Registration submitted — awaiting payment confirmation from Deepwoods", accent: "amber" };
  } else if (!inventoryComplete) {
    cfg = { msg: "Next: define your inventory boundary to unlock data collection", btnLabel: "Start setup", to: "/inventory-setup", accent: "green" };
  }

  if (!cfg) return null;

  const isGreen = cfg.accent === "green";
  const MOSS = "#1E6F5C", FOREST = "#1E4D2B";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "9px 24px",
      background: isGreen ? "#F0FDF4" : "#FFFBEB",
      borderBottom: `1px solid ${isGreen ? "#BBF7D0" : "#FDE68A"}`,
      fontFamily: "'Inter',system-ui,sans-serif",
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: isGreen ? MOSS : "#D97706" }} />
      <span style={{ flex: 1, fontSize: 13, color: isGreen ? MOSS : "#92400E", fontWeight: 500 }}>
        {cfg.msg}
      </span>
      {cfg.btnLabel && cfg.to && (
        <button
          type="button"
          onClick={() => navigate({ to: cfg!.to as any })}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
            padding: "5px 14px", borderRadius: 8, border: "none",
            background: isGreen ? `linear-gradient(135deg,${FOREST},${MOSS})` : "#D97706",
            color: "#fff", fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>
          {cfg.btnLabel} <ChevronRight style={{ width: 12, height: 12 }} />
        </button>
      )}
    </div>
  );
}

// ── AppLayout ─────────────────────────────────────────────────────────────────

function AppLayout({ role }: { role: Role }) {
  const navigate = useNavigate();
  const { client, enabled_pages } = useClientContext();
  // Deepwoods staff always have full access — no payment gate applies to them
  const paymentUnlocked = DEEPWOODS_ROLES.includes(role) ||
    client.payment_status === "paid" || client.payment_status === "waived";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Build nav filtered by enabled_pages from ClientContext
  const isEnabled = (pageKey: string) => enabled_pages.includes(pageKey);

  // Home always visible; pre-payment everything else is shown but locked
  const topSingles = ALL_TOP_SINGLES.filter((i) => i.pageKey === "home" || isEnabled(i.pageKey));
  const navGroups = paymentUnlocked
    ? ALL_NAV_GROUPS
        .filter((g) => g.items.some((i) => isEnabled(i.pageKey)))
        .map((g) => ({ ...g, items: g.items.filter((i) => isEnabled(i.pageKey)) }))
    : ALL_NAV_GROUPS;
  const bottomSingles = ALL_BOTTOM_SINGLES.filter((i) => {
    if (i.pageKey === "admin")    return DEEPWOODS_ROLES.includes(role);
    if (i.pageKey === "team")     return role === "sustainability_team";
    if (i.pageKey === "register") return DEEPWOODS_ROLES.includes(role);
    return isEnabled(i.pageKey);
  });

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const s = new Set<string>();
    navGroups.forEach((g) => { if (g.paths.some((p) => pathname === p || pathname.startsWith(p + "/"))) s.add(g.id); });
    return s;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      navGroups.forEach((g) => { if (g.paths.some((p) => pathname === p || pathname.startsWith(p + "/"))) next.add(g.id); });
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Inject client primary colour into CSS on every render (belt & suspenders — 
  // client-context.tsx also does this, but this catches any SSR hydration gaps)
  useEffect(() => {
    document.documentElement.style.setProperty("--primary", client.primary_color);
    document.documentElement.style.setProperty("--ghg-green", client.primary_color);
  }, [client.primary_color]);

  useEffect(() => {
    if (getMustChangePassword()) setShowChangePw(true);
  }, []);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const closeMenu = () => setMobileOpen(false);

  const meta = ROLE_META[role];
  if (!meta) { doLogout().then(() => navigate({ to: "/" })); return null; }

  const email = getEmail();
  const logout = async () => { await doLogout(); navigate({ to: "/" }); };

  // Deepwoods staff see their own logo (reversed/white on dark bg), client users see client logo
  const headerLogo = DEEPWOODS_ROLES.includes(role)
    ? { src: "/DW-reversed.webp", alt: "Deepwoods Green", accent: "var(--deepwoods-green)", logoBg: "oklch(0.22 0.014 240)" }
    : { src: client.logo_url,     alt: client.name,        accent: client.primary_color,    logoBg: "white" };

  const isLocked = (pageKey: string) => !paymentUnlocked && pageKey !== "home";

  const renderNav = () => (
    <nav className="flex-1 overflow-y-auto p-3">
      <div className="space-y-0.5">
        {topSingles.map((item) => (
          <NavLink key={item.to} item={item} pathname={pathname} onClick={closeMenu} locked={isLocked(item.pageKey)} />
        ))}
      </div>
      <div className="mt-3 space-y-0.5">
        {navGroups.map((g) => (
          <GroupNav
            key={g.id} group={g} pathname={pathname}
            open={openGroups.has(g.id) && paymentUnlocked}
            onToggle={() => paymentUnlocked && toggleGroup(g.id)}
            onLinkClick={closeMenu}
            locked={isLocked(g.pageKey)}
          />
        ))}
      </div>
      <div className="mx-3 my-3 border-t border-[var(--border)]" />
      <div className="space-y-0.5">
        {bottomSingles.map((item) => (
          <NavLink key={item.to} item={item} pathname={pathname} onClick={closeMenu} locked={isLocked(item.pageKey)} />
        ))}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-[60] flex items-center justify-between border-b bg-white px-4 py-2.5 md:hidden">
        <ClientLogo src={headerLogo.src} alt={headerLogo.alt} size="sm" />
        <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded p-1 text-[var(--navy)] hover:bg-muted">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[45] bg-black/60 md:hidden" onClick={closeMenu} aria-hidden="true" />
      )}

      <div className="flex">
        <aside className={`fixed inset-y-0 left-0 z-[50] w-64 border-r border-[var(--border)] bg-white text-[var(--navy)] transition-transform duration-300 ease-in-out md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col">
            <div className="px-5 py-5" style={{ background: headerLogo.logoBg }}>
              <ClientLogo src={headerLogo.src} alt={headerLogo.alt} size="lg" />
            </div>
            <div className="h-1" style={{ background: headerLogo.accent }} />
            <div className="border-b border-[var(--border)] px-5 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Decarbonisation Journey
              </div>
            </div>

            {renderNav()}

            <div className="border-t border-[var(--border)] px-3 py-2">
              {email && <div className="mb-1 truncate px-3 py-1 text-[11px] text-muted-foreground">{email}</div>}
              {!DEEPWOODS_ROLES.includes(role) && (
                <Link to="/register" onClick={closeMenu}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${pathname.startsWith("/register") ? "font-semibold text-[var(--primary)]" : "text-[var(--navy)] hover:bg-[#F3F4F6]"}`}>
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full border border-current" />
                  Register
                </Link>
              )}
              {!DEEPWOODS_ROLES.includes(role) && (
                <Link to="/company-profile" onClick={closeMenu}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${pathname.startsWith("/company-profile") ? "font-semibold text-[var(--primary)]" : "text-[var(--navy)] hover:bg-[#F3F4F6]"}`}>
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full border border-current" />
                  Company profile
                </Link>
              )}
              <button onClick={() => setShowUserProfile(true)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--navy)] hover:bg-[#F3F4F6]">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full border border-current" />
                User profile
              </button>
              <button onClick={logout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--navy)] hover:bg-[#F3F4F6]">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full border border-current" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-background">
          <YearBar />
          <SetupNextStepBanner />
          <Outlet />
        </main>
      </div>

      {showUserProfile && <UserProfileModal onClose={() => setShowUserProfile(false)} onChangePw={() => setShowChangePw(true)} />}
      {showChangePw && <ChangePasswordModal forced={getMustChangePassword()} onClose={() => setShowChangePw(false)} />}
      <DeecarbAI />
    </div>
  );
}

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({ item, pathname, onClick, indent = false, locked = false }: {
  item: NavItem; pathname: string; onClick?: () => void; indent?: boolean; locked?: boolean;
}) {
  const Icon = item.icon;
  if (locked) {
    return (
      <div className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-not-allowed opacity-35 ${indent ? "pl-7" : ""} text-[var(--navy)]`}>
        <Icon className="h-4 w-4 shrink-0 text-[var(--navy-2)]" />
        <span className="flex-1">{item.label}</span>
        <Lock className="h-3 w-3 shrink-0" />
      </div>
    );
  }
  const active = pathname === item.to || pathname.startsWith(item.to + "/");
  return (
    <Link to={item.to} onClick={onClick}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${indent ? "pl-7" : ""} ${
        active
          ? "font-semibold text-[var(--primary)]"
          : "text-[var(--navy)] hover:bg-[#F3F4F6]"
      }`}
      style={active ? { backgroundColor: "var(--nav-active-bg)" } : {}}
    >
      {active && !indent && <span className="absolute left-0 inset-y-1 w-0.5 rounded-r-full bg-[var(--primary)]" />}
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--primary)]" : "text-[var(--navy-2)]"}`} />
      <span className="flex-1">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--alert)] px-1.5 text-[10px] font-bold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ── GroupNav ──────────────────────────────────────────────────────────────────

function GroupNav({ group, pathname, open, onToggle, onLinkClick, locked = false }: {
  group: NavGroup; pathname: string; open: boolean; onToggle: () => void; onLinkClick: () => void; locked?: boolean;
}) {
  const Icon = group.icon;
  if (locked) {
    return (
      <div className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-not-allowed opacity-35 text-[var(--navy)]">
        <Icon className="h-4 w-4 shrink-0 text-[var(--navy-2)]" />
        <span className="flex-1 text-left">{group.label}</span>
        <Lock className="h-3 w-3 shrink-0" />
      </div>
    );
  }
  const isChildActive = group.paths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div>
      <button onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
          isChildActive && !open ? "font-semibold text-[var(--primary)]" : "text-[var(--navy)] hover:bg-[#F3F4F6]"
        }`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${isChildActive && !open ? "text-[var(--primary)]" : "text-[var(--navy-2)]"}`} />
        <span className="flex-1 text-left">{group.label}</span>
        <Chevron className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((item) => (
            <NavLink key={item.to} item={item} pathname={pathname} onClick={onLinkClick} indent />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Year bar — fiscal year switcher only (entity switcher removed) ────────────

function YearBar() {
  return (
    <div className="sticky top-[49px] z-30 flex items-center justify-end gap-2 border-b bg-white/98 px-6 py-2.5 shadow-sm backdrop-blur-sm md:top-0">
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">Fiscal year</span>
        <FiscalYearSwitcher />
      </div>
    </div>
  );
}

// ── Entity bar (sticky, above page content) ──────────────────────────────────

function EntityBar() {
  const { entity } = useEntity();
  const { entities } = useClientContext();
  const meta = entities.find((e) => e.code === entity);

  return (
    <div className="sticky top-[49px] z-30 flex flex-wrap items-center justify-between gap-2 border-b bg-white/98 px-4 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.06),0_2px_8px_rgba(15,23,42,0.05)] backdrop-blur-sm md:top-0 md:px-6">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">Reporting entity</div>
        <div className="truncate text-sm font-semibold text-[var(--navy)]">
          {meta?.name ?? entity}
          {meta?.is_consolidated && meta.consolidates && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              auto-consolidated · {meta.consolidates.join(" + ")}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">Fiscal year</span>
          <FiscalYearSwitcher />
        </div>
        <div className="h-7 w-px bg-[var(--border)]" />
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">Entity</span>
          <EntitySwitcher />
        </div>
      </div>
    </div>
  );
}

// ── UserProfileModal ──────────────────────────────────────────────────────────

function UserProfileModal({ onClose, onChangePw }: { onClose: () => void; onChangePw: () => void }) {
  const email = getEmail();
  const role  = getRole();
  const meta  = role ? ROLE_META[role] : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-2xl">
        <h3 className="mb-5 font-serif text-lg font-bold text-[var(--navy)]">User profile</h3>
        <div className="space-y-4 text-sm">
          {email && (
            <div>
              <div className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</div>
              <div className="font-medium text-[var(--navy)]">{email}</div>
            </div>
          )}
          {meta && (
            <div>
              <div className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</div>
              <div className="font-medium text-[var(--navy)]">{meta.label}</div>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-md border px-4 py-1.5 text-sm text-[var(--navy)] hover:bg-muted">
            Close
          </button>
          <button type="button" onClick={() => { onClose(); onChangePw(); }}
            className="rounded-md bg-[var(--ghg-green)] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">
            Change password
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ChangePasswordModal ───────────────────────────────────────────────────────

function ChangePasswordModal({ forced, onClose }: { forced: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) { setError("New password must be at least 8 characters"); return; }
    if (next !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    try {
      await changePassword(current, next);
      toast.success("Password updated");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-2xl">
        <h3 className="font-serif text-lg font-bold text-[var(--navy)]">
          {forced ? "Set a new password to continue" : "Change password"}
        </h3>
        {forced && (
          <p className="mt-1 text-sm text-muted-foreground">
            Your account still has its initial password — set your own before continuing.
          </p>
        )}
        <form onSubmit={submit} className="mt-4 space-y-3">
          {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Current password</label>
            <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">New password</label>
            <input type="password" required value={next} onChange={(e) => setNext(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2 text-sm" placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Confirm new password</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            {!forced && <button type="button" onClick={onClose} className="rounded-md border px-4 py-1.5 text-sm">Cancel</button>}
            <button type="submit" disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--ghg-green)] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Saving..." : "Save password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AppLayout;
