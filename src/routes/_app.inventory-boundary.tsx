import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageBody, PageHeader } from "@/components/portal";
import { useDecarbAssets, type DecarbAsset } from "@/lib/api";
import { useEntity } from "@/lib/entity";
import { useFiscalYear } from "@/lib/entity";
import { authFetch } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search, ChevronDown, ChevronRight, Plus, Pencil, Trash2, Loader2,
  Flame, Zap, Leaf, BarChart3, Building2, X, Check,
} from "lucide-react";

export const Route = createFileRoute("/_app/inventory-boundary")({ component: InventoryBoundary });

type BoundaryTab = "register" | "edit" | "history";

// ── Badge helpers ─────────────────────────────────────────────────────────────

function HealthBadge({ h }: { h: string }) {
  const cfg: Record<string, { bg: string; text: string }> = {
    Active:                  { bg: "bg-[#E6F4EF] border-[#A8D5BD] text-[#1E6F5C]", text: "Active" },
    Monitor:                 { bg: "bg-[#FEF3C7] border-[#F59E0B]/30 text-[#D97706]", text: "Monitor" },
    "Flag for Replacement":  { bg: "bg-[#FEE2E2] border-[#F87171]/30 text-[#DC2626]", text: "Flag for Replacement" },
    Efficient:               { bg: "bg-[#E6F4EF] border-[#A8D5BD] text-[#1E6F5C]", text: "Efficient" },
    Standby:                 { bg: "bg-[#F3F4F6] border-slate-200 text-slate-500", text: "Standby" },
    Decommissioned:          { bg: "bg-[#FEE2E2] border-[#F87171]/30 text-[#DC2626]", text: "Decommissioned" },
  };
  const c = cfg[h] ?? cfg.Monitor;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${c.bg}`}>
      {c.text}
    </span>
  );
}

// ── Scope section header ──────────────────────────────────────────────────────

function ScopeSectionHeader({ scope, count }: { scope: string; count: number }) {
  const cfgMap: Record<string, { bg: string; text: string; border: string }> = {
    "Scope 1": { bg: "bg-[#FEF9EF]", text: "text-[#92400E]", border: "border-[#F59E0B]/20" },
    "Scope 2": { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#93C5FD]/30" },
    "Renewables": { bg: "bg-[#F0FDF4]", text: "text-[#166534]", border: "border-[#86EFAC]/30" },
  };
  const cfg = cfgMap[scope] ?? { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
  const label = scope === "Scope 1" ? "SCOPE 1 — DIRECT EMISSIONS"
    : scope === "Scope 2" ? "SCOPE 2 — PURCHASED ELECTRICITY"
    : "RENEWABLES — OFFSETS";
  return (
    <div className={`flex items-center justify-between rounded-t-lg border px-4 py-2.5 ${cfg.bg} ${cfg.border}`}>
      <span className={`text-[11px] font-bold uppercase tracking-wider ${cfg.text}`}>{label}</span>
      <span className={`text-[11px] font-bold ${cfg.text}`}>{count}</span>
    </div>
  );
}

// ── Asset row ─────────────────────────────────────────────────────────────────

function AssetRow({
  asset,
  editable,
  onEdit,
  onDelete,
}: {
  asset: DecarbAsset;
  editable: boolean;
  onEdit?: (a: DecarbAsset) => void;
  onDelete?: (a: DecarbAsset) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-slate-50/60 transition-colors"
      style={{ borderColor: "var(--border)" }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--navy)" }}>{asset.name}</p>
      </div>
      <span className="hidden sm:block text-xs shrink-0" style={{ color: "var(--navy-2)" }}>{asset.fuel}</span>
      <HealthBadge h={asset.health || asset.status} />
      {editable && (
        <div className="flex items-center gap-1 ml-1">
          <button onClick={() => onEdit?.(asset)}
            className="rounded p-1 text-slate-400 hover:text-[#1E6F5C] hover:bg-[#E6F4EF] transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete?.(asset)}
            className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Facility accordion ────────────────────────────────────────────────────────

function FacilityAccordion({
  facility,
  assets,
  defaultOpen,
  editable,
  onEdit,
  onDelete,
}: {
  facility: string;
  assets: DecarbAsset[];
  defaultOpen?: boolean;
  editable: boolean;
  onEdit?: (a: DecarbAsset) => void;
  onDelete?: (a: DecarbAsset) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  const scope1 = assets.filter(a => a.scope === "Scope 1" || a.scope === "scope1");
  const scope2 = assets.filter(a => a.scope === "Scope 2" || a.scope === "scope2");
  const renewables = assets.filter(a =>
    a.scope === "Renewables" || a.sub_type === "Renewables (offsets)" ||
    a.scope?.toLowerCase().includes("renew")
  );

  const s1SubTypes = [...new Set(scope1.map(a => a.sub_type))].filter(Boolean);
  const s2SubTypes = [...new Set(scope2.map(a => a.sub_type))].filter(Boolean);
  const reSubTypes = [...new Set(renewables.map(a => a.sub_type))].filter(Boolean);

  const s1Count = scope1.length;
  const s2Count = scope2.length;
  const reCount = renewables.length;

  const s1Cats = [...new Set(scope1.map(a => a.sub_type).filter(Boolean))].length;

  const subtitle = [
    `${assets.length} asset${assets.length !== 1 ? "s" : ""}`,
    s1Cats ? `${s1Cats} Scope 1 categor${s1Cats !== 1 ? "ies" : "y"}` : null,
    s2Count ? `${s2Count} Scope 2` : null,
    reCount ? `${reCount} renewable` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        {open
          ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: "var(--navy)" }}>{facility}</p>
          <p className="text-xs" style={{ color: "var(--navy-2)" }}>{subtitle}</p>
        </div>
      </button>

      {open && (
        <div className="border-t" style={{ borderColor: "var(--border)" }}>
          {/* Scope 1 */}
          {scope1.length > 0 && (
            <div>
              <ScopeSectionHeader scope="Scope 1" count={s1Count} />
              <div className="bg-white">
                {s1SubTypes.map(sub => {
                  const group = scope1.filter(a => a.sub_type === sub);
                  return (
                    <div key={sub}>
                      <div className="flex items-center gap-1.5 border-b bg-slate-50/50 px-4 py-1.5"
                        style={{ borderColor: "var(--border)" }}>
                        <span className="text-[11px] font-semibold text-slate-500">{sub}</span>
                        <span className="text-[11px] text-slate-400">{group.length}</span>
                      </div>
                      {group.map(a => (
                        <AssetRow key={a.id} asset={a} editable={editable} onEdit={onEdit} onDelete={onDelete} />
                      ))}
                    </div>
                  );
                })}
                {s1SubTypes.length === 0 && scope1.map(a => (
                  <AssetRow key={a.id} asset={a} editable={editable} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </div>
            </div>
          )}

          {/* Scope 2 */}
          {scope2.length > 0 && (
            <div>
              <ScopeSectionHeader scope="Scope 2" count={s2Count} />
              <div className="bg-white">
                {s2SubTypes.map(sub => {
                  const group = scope2.filter(a => a.sub_type === sub);
                  return (
                    <div key={sub}>
                      <div className="flex items-center gap-1.5 border-b bg-slate-50/50 px-4 py-1.5"
                        style={{ borderColor: "var(--border)" }}>
                        <span className="text-[11px] font-semibold text-slate-500">{sub}</span>
                        <span className="text-[11px] text-slate-400">{group.length}</span>
                      </div>
                      {group.map(a => (
                        <AssetRow key={a.id} asset={a} editable={editable} onEdit={onEdit} onDelete={onDelete} />
                      ))}
                    </div>
                  );
                })}
                {s2SubTypes.length === 0 && scope2.map(a => (
                  <AssetRow key={a.id} asset={a} editable={editable} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </div>
            </div>
          )}

          {/* Renewables */}
          {renewables.length > 0 && (
            <div>
              <ScopeSectionHeader scope="Renewables" count={reCount} />
              <div className="bg-white">
                {reSubTypes.map(sub => {
                  const group = renewables.filter(a => a.sub_type === sub);
                  return (
                    <div key={sub}>
                      <div className="flex items-center gap-1.5 border-b bg-slate-50/50 px-4 py-1.5"
                        style={{ borderColor: "var(--border)" }}>
                        <span className="text-[11px] font-semibold text-slate-500">{sub}</span>
                        <span className="text-[11px] text-slate-400">{group.length}</span>
                      </div>
                      {group.map(a => (
                        <AssetRow key={a.id} asset={a} editable={editable} onEdit={onEdit} onDelete={onDelete} />
                      ))}
                    </div>
                  );
                })}
                {reSubTypes.length === 0 && renewables.map(a => (
                  <AssetRow key={a.id} asset={a} editable={editable} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add / Edit asset modal ────────────────────────────────────────────────────

const SUB_TYPES = [
  "Stationary Combustion", "Mobile Sources", "Fugitive Sources",
  "Electricity", "Renewables (offsets)",
];
const SCOPES_OPT = ["Scope 1", "Scope 2", "Renewables"];
const STATUSES = ["Active", "Monitor", "Standby", "Decommissioned"];
const HEALTH_OPT = ["Efficient", "Monitor", "Flag for Replacement"];

function AssetModal({
  open,
  asset,
  facilities,
  onClose,
  onSaved,
}: {
  open: boolean;
  asset: DecarbAsset | null;
  facilities: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: asset?.name ?? "",
    facility: asset?.facility ?? (facilities[0] ?? ""),
    scope: asset?.scope ?? "Scope 1",
    sub_type: asset?.sub_type ?? "Stationary Combustion",
    fuel: asset?.fuel ?? "",
    status: asset?.status ?? "Active",
    health: asset?.health ?? "Efficient",
  });

  if (!open) return null;

  const field = (key: keyof typeof form, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.name.trim()) { toast.error("Asset name is required"); return; }
    setSaving(true);
    try {
      await authFetch("decarb/assets.php", {
        method: asset ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asset ? { id: asset.id, ...form } : form),
      });
      await qc.invalidateQueries({ queryKey: ["decarb-assets"] });
      toast.success(asset ? "Asset updated" : "Asset added");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to save asset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-semibold text-base" style={{ color: "var(--navy)" }}>
            {asset ? "Edit asset" : "Add new asset"}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {[
            { label: "Asset name *", key: "name" as const, type: "text" },
            { label: "Fuel / energy type", key: "fuel" as const, type: "text" },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--navy-2)" }}>{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={e => field(key, e.target.value)}
                className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6F5C]/30"
                style={{ borderColor: "var(--border)", color: "var(--navy)" }}
              />
            </div>
          ))}

          {[
            { label: "Facility", key: "facility" as const, opts: facilities },
            { label: "Scope", key: "scope" as const, opts: SCOPES_OPT },
            { label: "Sub-type / Category", key: "sub_type" as const, opts: SUB_TYPES },
            { label: "Status", key: "status" as const, opts: STATUSES },
            { label: "Health", key: "health" as const, opts: HEALTH_OPT },
          ].map(({ label, key, opts }) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--navy-2)" }}>{label}</label>
              <select
                value={form[key]}
                onChange={e => field(key, e.target.value)}
                className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E6F5C]/30"
                style={{ borderColor: "var(--border)", color: "var(--navy)", background: "white" }}
              >
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--navy)" }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            style={{ background: "var(--deepwoods-green, #1E6F5C)" }}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {asset ? "Save changes" : "Add asset"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({
  asset,
  onClose,
  onDeleted,
}: {
  asset: DecarbAsset;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      await authFetch(`decarb/assets.php?id=${encodeURIComponent(asset.id)}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["decarb-assets"] });
      toast.success("Asset removed");
      onDeleted();
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to delete asset");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-2 font-semibold text-base" style={{ color: "var(--navy)" }}>Remove asset?</h3>
        <p className="mb-6 text-sm" style={{ color: "var(--navy-2)" }}>
          <strong>{asset.name}</strong> will be removed from the boundary. This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--navy)" }}>
            Cancel
          </button>
          <button onClick={confirm} disabled={deleting}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function InventoryBoundary() {
  const { entity } = useEntity();
  const { fy } = useFiscalYear();
  const { data: assets = [], isLoading } = useDecarbAssets(entity);
  const qc = useQueryClient();

  const [tab, setTab] = useState<BoundaryTab>("register");
  const [searchQ, setSearchQ] = useState("");
  const [filterFacility, setFilterFacility] = useState("");
  const [filterScope, setFilterScope] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFuel, setFilterFuel] = useState("");
  const [editAsset, setEditAsset] = useState<DecarbAsset | null | "new">(null);
  const [deleteAsset, setDeleteAsset] = useState<DecarbAsset | null>(null);

  const facilities = useMemo(() => [...new Set(assets.map(a => a.facility).filter(Boolean))].sort(), [assets]);
  const fuels = useMemo(() => [...new Set(assets.map(a => a.fuel).filter(Boolean))].sort(), [assets]);

  const filtered = useMemo(() => {
    let list = assets;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
    }
    if (filterFacility) list = list.filter(a => a.facility === filterFacility);
    if (filterScope) list = list.filter(a => a.scope === filterScope);
    if (filterStatus) list = list.filter(a => a.status === filterStatus || a.health === filterStatus);
    if (filterFuel) list = list.filter(a => a.fuel === filterFuel);
    return list;
  }, [assets, searchQ, filterFacility, filterScope, filterStatus, filterFuel]);

  const facilityGroups = useMemo(() => {
    const map = new Map<string, DecarbAsset[]>();
    for (const a of filtered) {
      const f = a.facility || "Unknown";
      if (!map.has(f)) map.set(f, []);
      map.get(f)!.push(a);
    }
    return map;
  }, [filtered]);

  // KPIs
  const totalAssets = assets.length;
  const scope1Count = assets.filter(a => a.scope === "Scope 1" || a.scope === "scope1").length;
  const scope2Count = assets.filter(a => a.scope === "Scope 2" || a.scope === "scope2").length;
  const facilitiesCount = facilities.length;

  // History log: group by fiscal year presence
  const allYears = useMemo(() => {
    const ys = new Set<string>();
    for (const a of assets) Object.keys(a.series).forEach(y => ys.add(y));
    return [...ys].sort().reverse();
  }, [assets]);

  const historyByYear = useMemo(() => {
    return allYears.map((year, idx) => {
      const yearAssets = assets.filter(a => a.series[year] != null);
      const prevYear = allYears[idx + 1];
      const prevAssets = prevYear ? assets.filter(a => a.series[prevYear] != null) : [];
      const added = prevYear ? yearAssets.filter(a => !prevAssets.find(p => p.id === a.id)) : [];
      const removed = prevYear ? prevAssets.filter(a => !yearAssets.find(c => c.id === a.id)) : [];
      const newFacilities = prevYear
        ? [...new Set(added.map(a => a.facility))].filter(f => !prevAssets.find(a => a.facility === f))
        : [];
      return { year, yearAssets, added, removed, newFacilities, prevYear };
    });
  }, [allYears, assets]);

  const TABS: { id: BoundaryTab; label: string }[] = [
    { id: "register", label: "Register" },
    { id: "edit", label: "Edit Inventory" },
    { id: "history", label: "History Log" },
  ];

  return (
    <>
      {/* Modals */}
      {editAsset !== null && (
        <AssetModal
          open
          asset={editAsset === "new" ? null : editAsset}
          facilities={facilities}
          onClose={() => setEditAsset(null)}
          onSaved={() => setEditAsset(null)}
        />
      )}
      {deleteAsset && (
        <DeleteConfirm
          asset={deleteAsset}
          onClose={() => setDeleteAsset(null)}
          onDeleted={() => setDeleteAsset(null)}
        />
      )}

      <PageHeader
        eyebrow="Carbon Footprint"
        title="Inventory Boundary"
        description="Every Scope 1 and Scope 2 source, grouped by facility. Set this up once a year, and edit it any time your footprint changes."
      />

      {/* Tabs */}
      <div className="border-b px-6" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-[#1E6F5C] text-[#1E6F5C]"
                  : "border-transparent text-[var(--navy-2)] hover:text-[var(--navy)]"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <PageBody>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading inventory…
          </div>
        )}

        {!isLoading && (
          <>
            {/* ── Register tab ── */}
            {tab === "register" && (
              <div className="space-y-5 max-w-4xl">
                {/* KPI tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Assets", value: totalAssets, icon: <BarChart3 className="h-4 w-4" /> },
                    { label: "Scope 1 Sources", value: scope1Count, icon: <Flame className="h-4 w-4 text-[#D97706]" /> },
                    { label: "Scope 2 Sources", value: scope2Count, icon: <Zap className="h-4 w-4 text-[#1D4ED8]" /> },
                    { label: "Facilities Covered", value: facilitiesCount, icon: <Building2 className="h-4 w-4 text-[#6B7280]" /> },
                  ].map(k => (
                    <div key={k.label} className="rounded-xl border bg-white px-4 py-4 shadow-sm" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center gap-2 mb-1" style={{ color: "var(--navy-2)" }}>
                        {k.icon}
                        <span className="text-xs font-medium">{k.label}</span>
                      </div>
                      <p className="text-2xl font-bold" style={{ color: "var(--navy)" }}>{k.value}</p>
                    </div>
                  ))}
                </div>

                {/* Search + filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      value={searchQ}
                      onChange={e => setSearchQ(e.target.value)}
                      placeholder="Search asset ID or name…"
                      className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm"
                      style={{ borderColor: "var(--border)", color: "var(--navy)" }}
                    />
                  </div>
                  {[
                    { label: "Facility", val: filterFacility, set: setFilterFacility, opts: facilities },
                    { label: "Scope", val: filterScope, set: setFilterScope, opts: ["Scope 1", "Scope 2", "Renewables"] },
                    { label: "Status", val: filterStatus, set: setFilterStatus, opts: ["Active", "Monitor", "Standby", "Decommissioned", "Efficient", "Flag for Replacement"] },
                    { label: "Fuel", val: filterFuel, set: setFilterFuel, opts: fuels },
                  ].map(({ label, val, set, opts }) => (
                    <select key={label} value={val} onChange={e => set(e.target.value)}
                      className="rounded-lg border px-3 py-2 text-sm bg-white"
                      style={{ borderColor: "var(--border)", color: "var(--navy)" }}>
                      <option value="">{label}</option>
                      {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ))}
                </div>

                {/* Facility accordions */}
                <div className="space-y-3">
                  {facilityGroups.size === 0 && (
                    <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-slate-400"
                      style={{ borderColor: "var(--border)" }}>
                      No assets match your filters.
                    </div>
                  )}
                  {[...facilityGroups.entries()].map(([fac, fas]) => (
                    <FacilityAccordion
                      key={fac}
                      facility={fac}
                      assets={fas}
                      editable={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Edit Inventory tab ── */}
            {tab === "edit" && (
              <div className="space-y-4 max-w-4xl">
                <div className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: "var(--navy-2)" }}>
                    Editing the <strong style={{ color: "var(--navy)" }}>{fy}</strong> boundary.
                  </p>
                  <button
                    onClick={() => setEditAsset("new")}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
                    style={{ background: "var(--deepwoods-green, #1E6F5C)" }}
                  >
                    <Plus className="h-4 w-4" /> Add asset
                  </button>
                </div>

                <div className="space-y-3">
                  {assets.length === 0 && (
                    <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-slate-400"
                      style={{ borderColor: "var(--border)" }}>
                      No assets yet. Click "+ Add asset" to define your boundary.
                    </div>
                  )}
                  {[...new Map(assets.map(a => [a.facility || "Unknown", a])).entries()].map(([fac]) => (
                    <FacilityAccordion
                      key={fac}
                      facility={fac}
                      assets={assets.filter(a => (a.facility || "Unknown") === fac)}
                      defaultOpen={true}
                      editable={true}
                      onEdit={a => setEditAsset(a)}
                      onDelete={a => setDeleteAsset(a)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── History Log tab ── */}
            {tab === "history" && (
              <div className="max-w-3xl space-y-1">
                {historyByYear.length === 0 && (
                  <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-slate-400"
                    style={{ borderColor: "var(--border)" }}>
                    No historical data available yet.
                  </div>
                )}
                {historyByYear.map(({ year, yearAssets, added, removed, newFacilities, prevYear }, idx) => {
                  const yearFacilities = [...new Set(yearAssets.map(a => a.facility).filter(Boolean))];
                  const delta = added.length - removed.length;
                  const changeParts: string[] = [];
                  if (prevYear) {
                    if (delta > 0) changeParts.push(`+${delta} asset${delta !== 1 ? "s" : ""} since ${prevYear}`);
                    else if (delta < 0) changeParts.push(`${delta} asset${Math.abs(delta) !== 1 ? "s" : ""} since ${prevYear}`);
                    if (newFacilities.length > 0) changeParts.push(`${newFacilities[0]} facility added`);
                    if (added.length > 0 && added[added.length - 1].scope !== "Scope 1") {
                      changeParts.push(`${added[added.length - 1].name} commissioned`);
                    }
                  }

                  return (
                    <HistoryEntry
                      key={year}
                      year={year}
                      assets={yearAssets}
                      facilities={yearFacilities}
                      changeLine={changeParts.join(" · ")}
                      isLatest={idx === 0}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

// ── History entry ─────────────────────────────────────────────────────────────

function HistoryEntry({
  year,
  assets,
  facilities,
  changeLine,
  isLatest,
}: {
  year: string;
  assets: DecarbAsset[];
  facilities: string[];
  changeLine: string;
  isLatest: boolean;
}) {
  const [open, setOpen] = useState(isLatest);

  return (
    <div className="flex gap-4">
      {/* Timeline spine */}
      <div className="flex flex-col items-center">
        <div className={`mt-3 h-3 w-3 rounded-full border-2 shrink-0 ${isLatest ? "border-[#1E6F5C] bg-white" : "border-slate-300 bg-white"}`} />
        <div className="flex-1 w-px bg-slate-200 my-1" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full rounded-xl border bg-white p-4 text-left shadow-sm hover:bg-slate-50 transition-colors"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--navy)" }}>
                {year} — {assets.length} asset{assets.length !== 1 ? "s" : ""} across {facilities.length} facilit{facilities.length !== 1 ? "ies" : "y"}
              </p>
              {changeLine && (
                <p className="mt-0.5 text-xs" style={{ color: "var(--navy-2)" }}>{changeLine}</p>
              )}
            </div>
            {open ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />}
          </div>
        </button>

        {open && (
          <div className="mt-2 space-y-2">
            {facilities.map(fac => {
              const facAssets = assets.filter(a => a.facility === fac);
              return (
                <FacilityAccordion
                  key={fac}
                  facility={fac}
                  assets={facAssets}
                  defaultOpen={false}
                  editable={false}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
