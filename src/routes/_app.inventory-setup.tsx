import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import {
  Leaf, Loader2, Check, Flame, Zap, Globe, ChevronDown, ChevronRight,
} from "lucide-react";
import { authFetch } from "@/lib/auth";
import { useClientContext, clearClientContext } from "@/lib/client-context";

export const Route = createFileRoute("/_app/inventory-setup")({ component: InventorySetupPage });

const INK      = "oklch(0.21 0.03 265)";
const CANOPY   = "oklch(0.34 0.06 158)";
const MEADOW   = "oklch(0.62 0.16 152)";
const PAPER    = "oklch(0.978 0.003 120)";
const SLATE    = "oklch(0.55 0.02 265)";
const HAIRLINE = "oklch(0.92 0.005 130)";
const MINT     = "oklch(0.94 0.03 155)";

const S3_CATS = [
  { n: 1,  label: "Purchased goods & services" },
  { n: 2,  label: "Capital goods" },
  { n: 3,  label: "Fuel & energy activities" },
  { n: 4,  label: "Upstream transportation & distribution" },
  { n: 5,  label: "Waste in operations" },
  { n: 6,  label: "Business travel" },
  { n: 7,  label: "Employee commuting" },
  { n: 8,  label: "Upstream leased assets" },
  { n: 9,  label: "Downstream transportation & distribution" },
  { n: 10, label: "Processing of sold products" },
  { n: 11, label: "Use of sold products" },
  { n: 12, label: "End-of-life treatment of sold products" },
  { n: 13, label: "Downstream leased assets" },
  { n: 14, label: "Franchises" },
  { n: 15, label: "Investments" },
];

const BASE_YEARS = ["FY22", "FY23", "FY24", "FY25", "FY26"];

interface InvState {
  s1_stationary: boolean;
  s1_mobile:     boolean;
  s1_fugitive:   boolean;
  s2_grid:       boolean;
  s2_renewable:  boolean;
  s3_included:   boolean;
  s3_categories: number[];
  base_year:     string;
}

const INIT: InvState = {
  s1_stationary: true,
  s1_mobile:     false,
  s1_fugitive:   false,
  s2_grid:       true,
  s2_renewable:  false,
  s3_included:   false,
  s3_categories: [],
  base_year:     "FY24",
};

function InventorySetupPage() {
  const ctx = useClientContext();
  const [data, setData]     = useState<InvState>(INIT);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(["s1", "s2", "s3", "base"])
  );

  const toggleSection = (id: string) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleS3Cat = (n: number) =>
    setData(prev => ({
      ...prev,
      s3_categories: prev.s3_categories.includes(n)
        ? prev.s3_categories.filter(c => c !== n)
        : [...prev.s3_categories, n].sort((a, b) => a - b),
    }));

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await authFetch("inventory-setup.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s1_stationary: data.s1_stationary,
          s1_mobile:     data.s1_mobile,
          s1_fugitive:   data.s1_fugitive,
          s2_grid:       data.s2_grid,
          s2_renewable:  data.s2_renewable,
          s3_included:   data.s3_included,
          s3_categories: data.s3_included ? data.s3_categories : [],
          base_year:     data.base_year,
        }),
      });
      clearClientContext();
      window.location.href = "/home";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
      setLoading(false);
    }
  };

  const isOpen = (id: string) => openSections.has(id);
  const Chevron = ({ id }: { id: string }) =>
    isOpen(id)
      ? <ChevronDown style={{ width: 16, height: 16, color: SLATE }} />
      : <ChevronRight style={{ width: 16, height: 16, color: SLATE }} />;

  return (
    <div style={{
      minHeight: "100vh", background: PAPER,
      fontFamily: "'Inter',system-ui,sans-serif", color: INK,
      position: "relative", overflow: "hidden",
    }}>
      <style>{CSS}</style>

      {/* Decorative rings */}
      <div style={{ position: "fixed", top: -220, right: -220, width: 700, height: 700,
        border: `1px solid ${HAIRLINE}`, borderRadius: "50%", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", top: -110, right: -110, width: 480, height: 480,
        border: `1px solid ${HAIRLINE}`, borderRadius: "50%", pointerEvents: "none", zIndex: 0 }} />

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
        <span style={{ fontSize: 12, color: SLATE }}>{ctx.client.name}</span>
      </header>

      {/* Body */}
      <div style={{
        position: "relative", zIndex: 1,
        maxWidth: 680, margin: "0 auto", padding: "52px 24px 96px",
      }}>
        {/* Eyebrow */}
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: SLATE, margin: "0 0 4px",
        }}>
          Phase 2 — Post-Payment Setup
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 6px", color: INK, letterSpacing: "-0.02em" }}>
          Define your inventory boundary
        </h1>
        <p style={{ fontSize: 14, color: SLATE, margin: "0 0 36px", lineHeight: 1.65 }}>
          Specify which emission sources your organisation will report under the GHG Protocol.
          This becomes your reporting boundary for all Scope&nbsp;1, 2 and 3 data collection.
        </p>

        {/* Progress trail */}
        <div style={{
          display: "flex", alignItems: "center", gap: 0,
          background: "white", border: `1px solid ${HAIRLINE}`,
          borderRadius: 12, padding: "16px 24px", marginBottom: 28,
          boxShadow: "0 1px 3px rgba(17,24,39,0.05)",
        }}>
          {[
            { label: "Organisation Boundary", done: true },
            { label: "Payment Confirmed",     done: true },
            { label: "Inventory Boundary",    done: false, active: true },
          ].map((step, i, arr) => (
            <Fragment key={step.label}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: i === arr.length - 1 ? "none" : 1 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: step.done ? CANOPY : step.active ? "white" : "white",
                  border: step.done ? "none" : step.active ? `2px solid ${CANOPY}` : `2px solid ${HAIRLINE}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {step.done
                    ? <Check style={{ width: 12, height: 12, color: "white" }} />
                    : <span style={{ fontSize: 10, fontWeight: 700, color: step.active ? CANOPY : SLATE }}>{i + 1}</span>}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: step.active ? 700 : 400,
                  color: step.done ? CANOPY : step.active ? INK : SLATE,
                  whiteSpace: "nowrap",
                }}>
                  {step.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div style={{ flex: 1, height: 1, background: HAIRLINE, margin: "0 12px" }} />
              )}
            </Fragment>
          ))}
        </div>

        {/* ── Scope 1 ─────────────────────────────────────────────────────── */}
        <ScopeCard
          id="s1" open={isOpen("s1")} onToggle={() => toggleSection("s1")}
          icon={<Flame style={{ width: 18, height: 18, color: "oklch(0.63 0.18 38)" }} />}
          title="Scope 1 — Direct Emissions"
          subtitle="Combustion and releases from sources owned or controlled by your organisation"
          badge={[data.s1_stationary, data.s1_mobile, data.s1_fugitive].filter(Boolean).length}
          badgeOf={3}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Toggle
              checked={data.s1_stationary}
              onChange={v => setData(p => ({ ...p, s1_stationary: v }))}
              label="Stationary combustion"
              hint="Boilers, furnaces, generators, process heaters"
            />
            <Toggle
              checked={data.s1_mobile}
              onChange={v => setData(p => ({ ...p, s1_mobile: v }))}
              label="Mobile combustion"
              hint="Company-owned or leased vehicles, forklifts, site equipment"
            />
            <Toggle
              checked={data.s1_fugitive}
              onChange={v => setData(p => ({ ...p, s1_fugitive: v }))}
              label="Fugitive emissions"
              hint="Refrigerants, SF₆, methane leaks from equipment"
            />
          </div>
        </ScopeCard>

        {/* ── Scope 2 ─────────────────────────────────────────────────────── */}
        <ScopeCard
          id="s2" open={isOpen("s2")} onToggle={() => toggleSection("s2")}
          icon={<Zap style={{ width: 18, height: 18, color: "oklch(0.70 0.17 85)" }} />}
          title="Scope 2 — Indirect Energy Emissions"
          subtitle="Emissions from purchased electricity, heat, steam, or cooling"
          badge={[data.s2_grid, data.s2_renewable].filter(Boolean).length}
          badgeOf={2}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Toggle
              checked={data.s2_grid}
              onChange={v => setData(p => ({ ...p, s2_grid: v }))}
              label="Grid electricity"
              hint="Electricity purchased from the utility grid (location-based or market-based)"
            />
            <Toggle
              checked={data.s2_renewable}
              onChange={v => setData(p => ({ ...p, s2_renewable: v }))}
              label="Renewable / captive power"
              hint="On-site solar, wind, or third-party renewable PPAs"
            />
          </div>
        </ScopeCard>

        {/* ── Scope 3 ─────────────────────────────────────────────────────── */}
        <ScopeCard
          id="s3" open={isOpen("s3")} onToggle={() => toggleSection("s3")}
          icon={<Globe style={{ width: 18, height: 18, color: CANOPY }} />}
          title="Scope 3 — Value Chain Emissions"
          subtitle="Indirect emissions in your upstream and downstream value chain"
          badge={data.s3_included ? data.s3_categories.length : 0}
          badgeOf={data.s3_included ? 15 : undefined}
        >
          <Toggle
            checked={data.s3_included}
            onChange={v => setData(p => ({ ...p, s3_included: v, s3_categories: v ? p.s3_categories : [] }))}
            label="Include Scope 3 in this inventory"
            hint="Recommended for comprehensive GHG reporting"
          />
          {data.s3_included && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: SLATE, margin: "0 0 14px" }}>
                Relevant categories
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {S3_CATS.map(cat => {
                  const active = data.s3_categories.includes(cat.n);
                  return (
                    <button key={cat.n} type="button"
                      onClick={() => toggleS3Cat(cat.n)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                        border: active ? `1.5px solid ${CANOPY}` : `1px solid ${HAIRLINE}`,
                        background: active ? MINT : "white",
                        textAlign: "left",
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        border: active ? `none` : `1.5px solid ${HAIRLINE}`,
                        background: active ? CANOPY : "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {active && <Check style={{ width: 10, height: 10, color: "white" }} />}
                      </div>
                      <span style={{ fontSize: 12, lineHeight: 1.4, color: active ? CANOPY : INK }}>
                        <span style={{ fontWeight: 700 }}>Cat {cat.n}</span>
                        {" · "}{cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {data.s3_categories.length === 0 && (
                <p style={{ fontSize: 12, color: "oklch(0.63 0.18 38)", marginTop: 10 }}>
                  Select at least one Scope 3 category, or uncheck "Include Scope 3" above.
                </p>
              )}
            </div>
          )}
        </ScopeCard>

        {/* ── Base year ────────────────────────────────────────────────────── */}
        <ScopeCard
          id="base" open={isOpen("base")} onToggle={() => toggleSection("base")}
          icon={<div style={{ fontSize: 16, lineHeight: 1 }}>📅</div>}
          title="Base Year"
          subtitle="The reference year against which future emissions reductions are measured"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: INK }}>
              Select your GHG inventory base year
            </label>
            <select
              value={data.base_year}
              onChange={e => setData(p => ({ ...p, base_year: e.target.value }))}
              style={{
                maxWidth: 200, padding: "9px 12px",
                border: `1px solid ${HAIRLINE}`, borderRadius: 8,
                fontSize: 14, color: INK, background: "white",
                fontFamily: "inherit", outline: "none",
              }}
            >
              {BASE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <p style={{ fontSize: 12, color: SLATE, margin: 0, lineHeight: 1.55 }}>
              This should be the first year you have reliable activity data. Most organisations
              choose a year 2–4 years prior to their current reporting year.
            </p>
          </div>
        </ScopeCard>

        {/* Error */}
        {error && (
          <div style={{
            padding: "12px 16px", borderRadius: 8, marginBottom: 20,
            background: "oklch(0.97 0.01 30)", border: "1px solid oklch(0.88 0.07 38)",
            fontSize: 13, color: "oklch(0.52 0.18 38)",
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || (data.s3_included && data.s3_categories.length === 0)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "13px 32px", borderRadius: 10, border: "none",
              background: CANOPY, color: "white",
              fontSize: 15, fontWeight: 600,
              cursor: (loading || (data.s3_included && data.s3_categories.length === 0)) ? "not-allowed" : "pointer",
              opacity: (loading || (data.s3_included && data.s3_categories.length === 0)) ? 0.65 : 1,
              boxShadow: "0 2px 8px rgba(30,111,92,0.25)",
              letterSpacing: "-0.01em",
            }}
          >
            {loading && <Loader2 style={{ width: 16, height: 16, animation: "inv-spin 1s linear infinite" }} />}
            {loading ? "Saving…" : "Confirm inventory boundary"}
          </button>
          <p style={{ fontSize: 12, color: SLATE, margin: 0, lineHeight: 1.5, maxWidth: 260 }}>
            You can update these settings later from the Methodology page.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── ScopeCard ─────────────────────────────────────────────────────────────────

function ScopeCard({ id, open, onToggle, icon, title, subtitle, badge, badgeOf, children }: {
  id: string; open: boolean; onToggle: () => void;
  icon: React.ReactNode; title: string; subtitle: string;
  badge?: number; badgeOf?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "white", border: `1px solid ${HAIRLINE}`, borderRadius: 14,
      marginBottom: 16, boxShadow: "0 1px 3px rgba(17,24,39,0.05)",
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 14,
          padding: "18px 24px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: MINT, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>{title}</span>
            {badge !== undefined && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 999,
                background: badge > 0 ? CANOPY : HAIRLINE,
                color: badge > 0 ? "white" : SLATE,
              }}>
                {badge}{badgeOf ? `/${badgeOf}` : ""} selected
              </span>
            )}
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: SLATE, lineHeight: 1.5 }}>{subtitle}</p>
        </div>
        {open
          ? <ChevronDown style={{ width: 18, height: 18, color: SLATE, flexShrink: 0 }} />
          : <ChevronRight style={{ width: 18, height: 18, color: SLATE, flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ padding: "4px 24px 24px", borderTop: `1px solid ${HAIRLINE}` }}>
          <div style={{ paddingTop: 16 }}>{children}</div>
        </div>
      )}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "12px 14px", borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left",
        background: checked ? MINT : "oklch(0.98 0.002 120)",
        border: checked ? `1.5px solid ${CANOPY}` : `1px solid ${HAIRLINE}`,
        transition: "all 0.15s",
      }}
    >
      <div style={{
        marginTop: 1, width: 20, height: 20, borderRadius: 6, flexShrink: 0,
        border: checked ? "none" : `1.5px solid ${HAIRLINE}`,
        background: checked ? CANOPY : "white",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {checked && <Check style={{ width: 11, height: 11, color: "white" }} />}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: checked ? CANOPY : INK }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: SLATE, marginTop: 2, lineHeight: 1.5 }}>{hint}</div>}
      </div>
    </button>
  );
}

const CSS = `
@keyframes inv-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
