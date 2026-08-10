import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageBody, PageHeader } from "@/components/portal";
import { useClientContext } from "@/lib/client-context";
import { useEntity } from "@/lib/entity";
import { useDecarbAssets } from "@/lib/api";
import type { DecarbAsset } from "@/lib/api";

export const Route = createFileRoute("/_app/interactive-inventory")({ component: InteractiveInventory });

const SCOPE_COLOR: Record<string, string> = {
  "Scope 1": "#1E6F5C",
  "Scope 2": "#3B82F6",
  "Renewable": "#16A34A",
};

/* ── Asset card with expand ─────────────────────────────────────────────────── */
function AssetCard({
  id, title, sub, scope, status, desc, tag,
}: { id: string; title: string; sub: string; scope: string; status?: string; desc?: string; tag?: string }) {
  const [open, setOpen] = useState(false);
  const scopeColor = SCOPE_COLOR[scope] ?? "#6B7280";
  const statusColor = status === "Active" ? "#16A34A" : status === "Standby" ? "#D97706" : "#D90429";

  return (
    <div
      className="rounded-xl border bg-white cursor-pointer transition-all duration-200 hover:shadow-md"
      style={{ borderLeft: `4px solid ${scopeColor}` }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="px-4 py-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: scopeColor }}>{scope}</span>
            {tag && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{tag}</span>}
          </div>
          <div className="font-semibold text-sm text-[#1F2937] truncate">{title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status && (
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: statusColor }} title={status} />
          )}
          <span className="text-xs text-muted-foreground select-none">{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div className="border-t px-4 py-3 bg-slate-50 rounded-b-xl">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Detail</div>
          <p className="text-xs text-[#1F2937] leading-relaxed">{desc ?? "—"}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400">{id}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────────── */
function InteractiveInventory() {
  const { entity } = useEntity();
  const ctx = useClientContext();
  const consolidatedCode = ctx.entities.find(e => e.is_consolidated)?.code;
  const entityShort = (code: string) => ctx.entities.find(e => e.code === code)?.short ?? code;

  const { data: assets = [] } = useDecarbAssets(entity === consolidatedCode ? undefined : entity);

  const [facilityFilter, setFacilityFilter] = useState("All");
  const [activeTab, setActiveTab] = useState<"all" | "s1" | "s2" | "renew">("all");

  const facilities = useMemo(() => {
    const set = new Set(assets.map(a => a.facility).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [assets]);

  const filtered = useMemo(() => {
    if (facilityFilter === "All") return assets;
    return assets.filter(a => a.facility === facilityFilter);
  }, [assets, facilityFilter]);

  const scopeLabel = (a: DecarbAsset): string => {
    if (a.scope === "Scope 2") return "Scope 2";
    if (a.sub_type?.toLowerCase().includes("renewable") || a.sub_type?.toLowerCase().includes("solar") || a.sub_type?.toLowerCase().includes("wind") || a.sub_type?.toLowerCase().includes("irec") || a.sub_type?.toLowerCase().includes("ppa")) return "Renewable";
    return "Scope 1";
  };

  const s1Assets   = filtered.filter(a => a.scope === "Scope 1");
  const s2Assets   = filtered.filter(a => a.scope === "Scope 2");
  const renewAssets = filtered.filter(a => scopeLabel(a) === "Renewable");

  const stationary = s1Assets.filter(a => !a.sub_type?.toLowerCase().includes("mobile") && !a.sub_type?.toLowerCase().includes("fugitive"));
  const mobile     = s1Assets.filter(a => a.sub_type?.toLowerCase().includes("mobile"));
  const fugitive   = s1Assets.filter(a => a.sub_type?.toLowerCase().includes("fugitive"));

  const totalAssets = filtered.length;
  const s1Count     = s1Assets.length;
  const s2Count     = s2Assets.length;
  const renewCount  = renewAssets.length;

  const TABS = [
    { key: "all",   label: "All assets",  count: totalAssets },
    { key: "s1",    label: "Scope 1",     count: s1Count },
    { key: "s2",    label: "Scope 2",     count: s2Count },
    { key: "renew", label: "Renewables",  count: renewCount },
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow={`My Footprint · ${entityShort(entity)}`}
        title="Interactive Inventory"
        description="Explore every emission source behind the numbers — click any asset card to expand detail."
      />
      <PageBody>

        {/* ── KPI strip ── */}
        <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Assets Tracked", value: totalAssets, color: "#1F2937" },
            { label: "Scope 1 Sources",      value: s1Count,     color: "#1E6F5C" },
            { label: "Scope 2 Connections",  value: s2Count,     color: "#3B82F6" },
            { label: "Renewable Instruments",value: renewCount,  color: "#16A34A" },
          ].map(k => (
            <div key={k.label} className="rounded-xl border bg-white p-4" style={{ borderLeft: `4px solid ${k.color}` }}>
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{k.label}</div>
              <div className="mt-1 text-3xl font-bold tabular-nums" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* ── Facility filter pills ── */}
        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Filter by facility</div>
          <div className="flex flex-wrap gap-2">
            {facilities.map(f => (
              <button key={f} onClick={() => setFacilityFilter(f)}
                className="rounded-full px-3 py-1 text-xs font-semibold border transition-all"
                style={{
                  background: facilityFilter === f ? "#1F2937" : "white",
                  color: facilityFilter === f ? "white" : "#1F2937",
                  borderColor: facilityFilter === f ? "#1F2937" : "#D1D5DB",
                }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scope tabs ── */}
        <div className="mb-5 flex gap-1 border-b">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
              className="px-4 py-2 text-sm font-semibold border-b-2 transition-all -mb-px"
              style={{
                borderBottomColor: activeTab === t.key ? "#1E6F5C" : "transparent",
                color: activeTab === t.key ? "#1E6F5C" : "#6B7280",
              }}>
              {t.label}
              <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500">
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Asset cards ── */}
        <div className="space-y-6">

          {(activeTab === "all" || activeTab === "s1") && stationary.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#1E6F5C" }}>
                Scope 1 — Stationary combustion ({stationary.length})
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {stationary.map(a => (
                  <AssetCard key={a.id} id={String(a.id)} scope="Scope 1"
                    title={a.name} sub={`${a.facility} · ${a.fuel ?? "—"}`}
                    status={a.status} tag={a.fuel ?? undefined} desc={a.sub_type} />
                ))}
              </div>
            </div>
          )}

          {(activeTab === "all" || activeTab === "s1") && mobile.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#1E6F5C" }}>
                Scope 1 — Mobile sources ({mobile.length})
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {mobile.map(a => (
                  <AssetCard key={a.id} id={String(a.id)} scope="Scope 1"
                    title={a.name} sub={`${a.facility} · ${a.fuel ?? "—"}`}
                    status={a.status} tag="mobile" desc={a.sub_type} />
                ))}
              </div>
            </div>
          )}

          {(activeTab === "all" || activeTab === "s1") && fugitive.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#1E6F5C" }}>
                Scope 1 — Fugitive sources ({fugitive.length})
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {fugitive.map(a => (
                  <AssetCard key={a.id} id={String(a.id)} scope="Scope 1"
                    title={a.name} sub={`${a.facility} · ${a.fuel ?? "gas"}`}
                    tag="fugitive" desc={a.sub_type} />
                ))}
              </div>
            </div>
          )}

          {(activeTab === "all" || activeTab === "s2") && s2Assets.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#0EA5E9" }}>
                Scope 2 — Electricity connections ({s2Assets.length})
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {s2Assets.map(a => (
                  <AssetCard key={a.id} id={String(a.id)} scope="Scope 2"
                    title={a.facility} sub={`${a.entity} · ${a.unit}`}
                    tag={a.sub_type ?? undefined} desc={a.name} />
                ))}
              </div>
            </div>
          )}

          {(activeTab === "all" || activeTab === "renew") && renewAssets.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#16A34A" }}>
                Renewable instruments ({renewAssets.length})
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {renewAssets.map(a => (
                  <AssetCard key={a.id} id={String(a.id)} scope="Renewable"
                    title={a.name} sub={`${a.facility} · ${a.unit}`}
                    tag="zero MB" desc={a.sub_type} />
                ))}
              </div>
            </div>
          )}

          {totalAssets === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
              No assets match this filter.
            </div>
          )}
        </div>

      </PageBody>
    </>
  );
}
