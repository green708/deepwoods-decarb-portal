import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Building2, Flame, Car, Wind, Zap, Sun, Globe, Package,
  Truck, Users, ShoppingCart, Recycle, Utensils, Briefcase,
  Check, Leaf, Loader2, Plus, Trash2, AlertCircle, X,
  ChevronRight, ChevronLeft, FileUp,
} from "lucide-react";
import { getToken, authFetch } from "@/lib/auth";

export const Route = createFileRoute("/setup")({ component: Setup });

// ── Constants ─────────────────────────────────────────────────────────────────

const FY_YEARS = ["FY21", "FY22", "FY23", "FY24", "FY25", "FY26"];

const CONSOLIDATION_OPTIONS = [
  {
    value: "Operational Control",
    label: "Operational Control",
    description: "Include facilities where your organisation has full authority over daily operations.",
    example: "Most common for Indian companies. If you make the day-to-day decisions, include it.",
  },
  {
    value: "Financial Control",
    label: "Financial Control",
    description: "Include facilities where your organisation directs the financial and operating policies.",
    example: "Common when you fully consolidate subsidiaries in your financial statements.",
  },
  {
    value: "Equity Share",
    label: "Equity Share",
    description: "Account for emissions proportional to your equity stake in the operation.",
    example: "Used for joint ventures where you have partial ownership.",
  },
];

const S1_SOURCES = [
  {
    key: "s1Stationary" as const,
    icon: Flame,
    label: "Stationary Combustion",
    description: "Fuel burned in boilers, generators, furnaces, or other fixed equipment.",
    examples: "Diesel gensets, gas boilers, coal furnaces, biomass burners",
  },
  {
    key: "s1Mobile" as const,
    icon: Car,
    label: "Mobile Combustion",
    description: "Fuel burned in company-owned or leased vehicles.",
    examples: "Fleet cars, delivery trucks, forklifts, construction equipment",
  },
  {
    key: "s1Fugitive" as const,
    icon: Wind,
    label: "Fugitive Emissions",
    description: "Unintentional releases from refrigerants, fire suppression, or industrial processes.",
    examples: "Air conditioning units, refrigeration systems, fire extinguishers",
  },
];

const S2_SOURCES = [
  {
    key: "s2Grid" as const,
    icon: Zap,
    label: "Grid Electricity",
    description: "Electricity purchased from the national or regional utility grid.",
    examples: "BESCOM, TSNPDCL, MSEDCL — any utility electricity bill",
  },
  {
    key: "s2Renewable" as const,
    icon: Sun,
    label: "Renewable Energy",
    description: "Electricity from on-site renewables or purchased via a PPA / I-REC arrangement.",
    examples: "Rooftop solar, wind turbines, PPAs, I-RECs",
  },
];

const S3_CATEGORIES = [
  { no: 1,  label: "Purchased Goods & Services",  icon: ShoppingCart },
  { no: 2,  label: "Capital Goods",               icon: Briefcase    },
  { no: 3,  label: "Fuel & Energy Activities",    icon: Zap          },
  { no: 4,  label: "Upstream Transportation",     icon: Truck        },
  { no: 5,  label: "Waste Generated",             icon: Recycle      },
  { no: 6,  label: "Business Travel",             icon: Globe        },
  { no: 7,  label: "Employee Commuting",          icon: Users        },
  { no: 9,  label: "Downstream Transportation",   icon: Truck        },
  { no: 11, label: "Use of Sold Products",        icon: Package      },
  { no: 12, label: "End-of-Life Treatment",       icon: Recycle      },
  { no: 13, label: "Downstream Leased Assets",    icon: Building2    },
  { no: 14, label: "Franchises",                  icon: Utensils     },
  { no: 15, label: "Investments",                 icon: Briefcase    },
];

const STEP_LABELS = ["Org Boundary", "Inventory Boundary", "Review & Confirm"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface WizardEntity {
  tempId: string;
  code: string;
  name: string;
  shortName: string;
  isConsolidated: boolean;
  isFromDb: boolean;
}

interface EntityScope {
  s1Stationary: boolean;
  s1Mobile: boolean;
  s1Fugitive: boolean;
  s2Grid: boolean;
  s2Renewable: boolean;
  s3Included: boolean;
  s3Categories: number[];
}

const DEFAULT_ENTITY_SCOPE: EntityScope = {
  s1Stationary: false,
  s1Mobile: false,
  s1Fugitive: false,
  s2Grid: true,
  s2Renewable: false,
  s3Included: false,
  s3Categories: [1, 2, 3, 4, 5, 6, 7],
};

interface SetupData {
  consolidationApproach: string;
  baseYear: string;
  entities: WizardEntity[];
  entityScope: Record<string, EntityScope>;
}

type ExistingEntity = { code: string; name: string; short: string; is_consolidated: boolean };

// ── Utilities ─────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

const inputCls = "w-full rounded-lg border border-[var(--border)] bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-[var(--navy)] outline-none transition focus:border-[#1E6F5C] focus:bg-white focus:ring-2 focus:ring-[#1E6F5C]/15 placeholder:text-slate-400";
const selectCls = `${inputCls} cursor-pointer`;

function FieldLabel({ label }: { label: string }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--navy-2)]">
      {label}
    </label>
  );
}

function ConsultantTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex gap-3 rounded-xl border border-[#1E6F5C]/20 bg-[#F0FAF5] px-4 py-3">
      <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-[#1E6F5C]" />
      <p className="text-sm leading-relaxed text-[#1E6F5C]">{children}</p>
    </div>
  );
}

// ── Progress Header ────────────────────────────────────────────────────────────

function ProgressHeader({ step }: { step: number }) {
  const pct = Math.round((step / (STEP_LABELS.length - 1)) * 100);
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white shadow-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
        <img src="/deepwoods-logo.png" alt="Deepwoods Green" className="h-7 w-auto" />
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={label} className="flex items-center gap-1.5">
                {i > 0 && (
                  <div className={`h-px w-5 transition-colors duration-300 ${done ? "bg-[#1E6F5C]" : "bg-slate-200"}`} />
                )}
                <div className="flex items-center gap-1">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${
                    done ? "bg-[#1E6F5C] text-white"
                    : active ? "scale-110 bg-[#1E6F5C] text-white shadow-md shadow-[#1E6F5C]/30"
                    : "bg-slate-100 text-slate-400"
                  }`}>
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className={`hidden text-[11px] font-medium sm:block ${active ? "text-[#1E6F5C]" : "text-slate-400"}`}>
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="w-20" />
      </div>
      <div className="h-0.5 w-full bg-slate-100">
        <div className="h-0.5 bg-[#1E6F5C] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </header>
  );
}

// ── Nav Buttons ────────────────────────────────────────────────────────────────

function NavButtons({ step, onBack, onNext, nextLabel, disabled, submitting }: {
  step: number; onBack: () => void; onNext: () => void;
  nextLabel?: string; disabled?: boolean; submitting?: boolean;
}) {
  return (
    <div className="mx-auto mt-8 flex max-w-xl items-center justify-between px-4 pb-12">
      {step > 0 ? (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--navy)] transition-colors hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      ) : <div />}
      <button
        onClick={onNext}
        disabled={disabled || submitting}
        className="flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-40"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {nextLabel ?? "Continue"}
        {!submitting && <ChevronRight className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ── Step 1: Organization Boundary ─────────────────────────────────────────────

function OrgBoundaryStep({ data, onChange, existingEntities }: {
  data: SetupData;
  onChange: (d: Partial<SetupData>) => void;
  existingEntities: ExistingEntity[];
}) {
  const [form, setForm] = useState({ name: "", code: "", shortName: "", isConsolidated: false });

  useEffect(() => {
    if (existingEntities.length > 0 && data.entities.length === 0) {
      const mapped: WizardEntity[] = existingEntities.map((e) => ({
        tempId: uid(),
        code: e.code,
        name: e.name,
        shortName: e.short,
        isConsolidated: e.is_consolidated,
        isFromDb: true,
      }));
      // Initialise scope for each non-consolidated entity
      const initScope: Record<string, EntityScope> = {};
      existingEntities.forEach((e) => {
        if (!e.is_consolidated) initScope[e.code] = { ...DEFAULT_ENTITY_SCOPE };
      });
      onChange({ entities: mapped, entityScope: { ...data.entityScope, ...initScope } });
    }
  }, [existingEntities]);

  const addEntity = () => {
    if (!form.name.trim() || !form.code.trim()) return;
    const code = form.code.trim().toUpperCase();
    const next: WizardEntity = {
      tempId: uid(),
      code,
      name: form.name.trim(),
      shortName: form.shortName.trim() || code,
      isConsolidated: form.isConsolidated,
      isFromDb: false,
    };
    const newScope = form.isConsolidated
      ? data.entityScope
      : { ...data.entityScope, [code]: { ...DEFAULT_ENTITY_SCOPE } };
    onChange({ entities: [...data.entities, next], entityScope: newScope });
    setForm({ name: "", code: "", shortName: "", isConsolidated: false });
  };

  const removeEntity = (tempId: string, code: string) => {
    const newScope = { ...data.entityScope };
    delete newScope[code];
    onChange({ entities: data.entities.filter((e) => e.tempId !== tempId), entityScope: newScope });
  };

  return (
    <div>
      <div className="mb-6">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--navy-2)]">Step 1 of 3</p>
        <h2 className="text-2xl font-bold text-[var(--navy)]">Organization boundary</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--navy-2)]">
          Define which legal entities and business units are included in your GHG inventory,
          and the rule that determines your organisational boundary.
        </p>
      </div>

      {/* Consolidation approach */}
      <div className="mb-5 rounded-2xl border bg-white p-6 shadow-sm">
        <FieldLabel label="Consolidation approach" />
        <p className="mb-3 text-xs text-[var(--navy-2)]">
          Which rule determines which facilities are in scope for your inventory?
        </p>
        <div className="space-y-3">
          {CONSOLIDATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ consolidationApproach: opt.value })}
              className={`w-full rounded-xl border p-4 text-left transition-all ${
                data.consolidationApproach === opt.value
                  ? "border-[#1E6F5C] bg-[#E6F4EF]/40 shadow-sm"
                  : "border-[var(--border)] bg-white hover:border-[#1E6F5C]/30 hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  data.consolidationApproach === opt.value
                    ? "border-[#1E6F5C] bg-[#1E6F5C]"
                    : "border-slate-300"
                }`}>
                  {data.consolidationApproach === opt.value && (
                    <Check className="h-2.5 w-2.5 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--navy)]">{opt.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--navy-2)]">{opt.description}</p>
                  <p className="mt-0.5 text-[11px] italic text-slate-400">{opt.example}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Base year */}
      <div className="mb-5 rounded-2xl border bg-white p-6 shadow-sm">
        <FieldLabel label="GHG base year" />
        <p className="mb-2 text-xs text-[var(--navy-2)]">
          The earliest year you'll track emissions against — used as the reference for reductions.
        </p>
        <select
          className={selectCls}
          value={data.baseYear}
          onChange={(e) => onChange({ baseYear: e.target.value })}
        >
          <option value="">Select base year</option>
          {FY_YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <p className="mt-1.5 text-[11px] text-slate-400">
          If you're unsure, your Deepwoods consultant will advise. You can update this later.
        </p>
      </div>

      {/* Entity list */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <FieldLabel label="Entities in scope" />
        <p className="mb-3 text-xs text-[var(--navy-2)]">
          Which legal entities or business units are included in this GHG inventory?
        </p>

        {data.entities.length > 0 ? (
          <div className="mb-5 space-y-2">
            {data.entities.map((entity) => (
              <div key={entity.tempId} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-slate-50 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1E6F5C] text-xs font-bold text-white">
                  {entity.code.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--navy)]">{entity.name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">{entity.code}</span>
                    {entity.isConsolidated && (
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[#E6F4EF] text-[#1E6F5C]">Consolidated</span>
                    )}
                    {entity.isFromDb && (
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600">Pre-configured</span>
                    )}
                  </div>
                </div>
                {!entity.isFromDb && (
                  <button
                    onClick={() => removeEntity(entity.tempId, entity.code)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-5 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-center">
            <Building2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-400">No entities added yet</p>
            <p className="mt-0.5 text-xs text-slate-300">Add at least one entity below</p>
          </div>
        )}

        {/* Add entity form */}
        <div className="rounded-xl border border-dashed border-[#1E6F5C]/30 bg-[#F0FAF5]/50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#1E6F5C]">Add entity</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <FieldLabel label="Entity name" />
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Acme Products Pvt. Ltd."
              />
            </div>
            <div>
              <FieldLabel label="Short code" />
              <input
                className={inputCls}
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase().slice(0, 6) }))}
                placeholder="AP"
              />
            </div>
            <div>
              <FieldLabel label="Short name" />
              <input
                className={inputCls}
                value={form.shortName}
                onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
                placeholder="Acme Products"
              />
            </div>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={form.isConsolidated}
              onChange={(e) => setForm((f) => ({ ...f, isConsolidated: e.target.checked }))}
              className="h-4 w-4 rounded accent-[#1E6F5C]"
            />
            <span className="text-sm text-[var(--navy)]">This is the consolidated / parent entity</span>
          </label>
          <button
            onClick={addEntity}
            disabled={!form.name.trim() || !form.code.trim()}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#1E6F5C] px-4 py-2 text-xs font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add entity
          </button>
        </div>
      </div>

      <ConsultantTip>
        If your Deepwoods consultant already configured your entities, they appear as "Pre-configured."
        You can add additional entities (subsidiaries, divisions) if needed.
      </ConsultantTip>
    </div>
  );
}

// ── Step 2: Inventory Boundary (per entity) ───────────────────────────────────

type ScopeTab = "s1" | "s2" | "s3";

function InventoryBoundaryStep({ data, onChange }: {
  data: SetupData;
  onChange: (d: Partial<SetupData>) => void;
}) {
  const nonConsolidated = data.entities.filter((e) => !e.isConsolidated);
  const [activeCode, setActiveCode] = useState(nonConsolidated[0]?.code ?? "");
  const [scopeTab, setScopeTab] = useState<ScopeTab>("s1");

  useEffect(() => {
    if (!activeCode && nonConsolidated.length > 0) {
      setActiveCode(nonConsolidated[0].code);
    }
  }, [nonConsolidated.length]);

  // Ensure every non-consolidated entity has a scope entry
  useEffect(() => {
    const missing = nonConsolidated.filter((e) => !data.entityScope[e.code]);
    if (missing.length > 0) {
      const patch: Record<string, EntityScope> = {};
      missing.forEach((e) => { patch[e.code] = { ...DEFAULT_ENTITY_SCOPE }; });
      onChange({ entityScope: { ...data.entityScope, ...patch } });
    }
  }, [data.entities]);

  const scope = data.entityScope[activeCode] ?? DEFAULT_ENTITY_SCOPE;

  const updateScope = (patch: Partial<EntityScope>) => {
    onChange({
      entityScope: {
        ...data.entityScope,
        [activeCode]: { ...(data.entityScope[activeCode] ?? DEFAULT_ENTITY_SCOPE), ...patch },
      },
    });
  };

  const toggleS3Cat = (no: number) => {
    const cats = scope.s3Categories.includes(no)
      ? scope.s3Categories.filter((c) => c !== no)
      : [...scope.s3Categories, no];
    updateScope({ s3Categories: cats });
  };

  if (nonConsolidated.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-white px-8 py-12 text-center shadow-sm">
        <Building2 className="mb-3 h-10 w-10 text-slate-300" />
        <p className="font-semibold text-[var(--navy)]">No entities to configure</p>
        <p className="mt-1 text-sm text-slate-400">Go back and add at least one non-consolidated entity.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--navy-2)]">Step 2 of 3</p>
        <h2 className="text-2xl font-bold text-[var(--navy)]">Inventory boundary</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--navy-2)]">
          For each entity, select which emission sources are tracked in your GHG inventory.
        </p>
      </div>

      {/* Entity tabs */}
      {nonConsolidated.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {nonConsolidated.map((e) => (
            <button
              key={e.code}
              onClick={() => setActiveCode(e.code)}
              className={`shrink-0 flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeCode === e.code
                  ? "bg-[#1E6F5C] text-white shadow-sm"
                  : "border border-slate-200 bg-white text-[var(--navy-2)] hover:border-[#1E6F5C]/30"
              }`}
            >
              <span className={`inline-flex h-5 w-auto min-w-5 items-center justify-center rounded px-1 text-[10px] font-bold ${
                activeCode === e.code ? "bg-white/20 text-white" : "bg-slate-100 text-[var(--navy)]"
              }`}>{e.code}</span>
              {e.shortName || e.name}
            </button>
          ))}
        </div>
      )}

      {/* Scope panel for active entity */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E6F5C] text-xs font-bold text-white">
            {activeCode.slice(0, 2)}
          </div>
          <p className="text-sm font-bold text-[var(--navy)]">
            {data.entities.find((e) => e.code === activeCode)?.name ?? activeCode}
          </p>
        </div>

        {/* Scope selector tabs */}
        <div className="mb-4 flex gap-1 rounded-xl border bg-slate-50 p-1">
          {([
            { id: "s1", label: "Scope 1", sub: "Direct" },
            { id: "s2", label: "Scope 2", sub: "Purchased energy" },
            { id: "s3", label: "Scope 3", sub: "Value chain" },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setScopeTab(t.id)}
              className={`flex-1 rounded-lg px-3 py-2.5 text-center transition-all ${
                scopeTab === t.id ? "bg-white shadow-sm" : "hover:bg-white/50"
              }`}
            >
              <p className={`text-xs font-bold ${scopeTab === t.id ? "text-[var(--navy)]" : "text-slate-400"}`}>{t.label}</p>
              <p className="text-[10px] text-slate-400">{t.sub}</p>
            </button>
          ))}
        </div>

        {/* ── Scope 1 ── */}
        {scopeTab === "s1" && (
          <div className="space-y-3">
            <div className="rounded-xl border-l-4 border-[#1E6F5C] bg-[#E6F4EF]/40 px-4 py-2.5">
              <p className="text-xs font-semibold text-[#1E6F5C]">Scope 1 — Direct Emissions</p>
              <p className="mt-0.5 text-[11px] text-[#1E6F5C]/80">Emissions from sources owned or controlled by this entity.</p>
            </div>
            {S1_SOURCES.map(({ key, icon: Icon, label, description, examples }) => {
              const active = scope[key];
              return (
                <div
                  key={key}
                  onClick={() => updateScope({ [key]: !active })}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    active
                      ? "border-[#1E6F5C] bg-[#E6F4EF]/30 shadow-sm"
                      : "border-[var(--border)] bg-white hover:border-[#1E6F5C]/30 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      active ? "bg-[#1E6F5C] text-white" : "bg-slate-100 text-slate-400"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[var(--navy)]">{label}</p>
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                          active ? "border-[#1E6F5C] bg-[#1E6F5C]" : "border-slate-300"
                        }`}>
                          {active && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--navy-2)]">{description}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">e.g. {examples}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Scope 2 ── */}
        {scopeTab === "s2" && (
          <div className="space-y-3">
            <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50/60 px-4 py-2.5">
              <p className="text-xs font-semibold text-blue-700">Scope 2 — Purchased Energy</p>
              <p className="mt-0.5 text-[11px] text-blue-600/80">Indirect emissions from energy purchased from external suppliers.</p>
            </div>
            {S2_SOURCES.map(({ key, icon: Icon, label, description, examples }) => {
              const active = scope[key];
              return (
                <div
                  key={key}
                  onClick={() => updateScope({ [key]: !active })}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    active
                      ? "border-blue-500 bg-blue-50/30 shadow-sm"
                      : "border-[var(--border)] bg-white hover:border-blue-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      active ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-400"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[var(--navy)]">{label}</p>
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                          active ? "border-blue-500 bg-blue-500" : "border-slate-300"
                        }`}>
                          {active && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--navy-2)]">{description}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">e.g. {examples}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Scope 3 ── */}
        {scopeTab === "s3" && (
          <div>
            <div className="mb-4 rounded-xl border-l-4 border-slate-400 bg-slate-50 px-4 py-2.5">
              <p className="text-xs font-semibold text-slate-600">Scope 3 — Value Chain Emissions</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Indirect emissions from your supply chain and downstream activities. Optional for first inventories.
              </p>
            </div>
            <div className="mb-3">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={scope.s3Included}
                  onChange={(e) => updateScope({ s3Included: e.target.checked })}
                  className="h-4 w-4 rounded accent-[#1E6F5C]"
                />
                <span className="text-sm font-medium text-[var(--navy)]">
                  Include Scope 3 for {data.entities.find((e) => e.code === activeCode)?.shortName ?? activeCode}
                </span>
              </label>
            </div>
            {scope.s3Included ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {S3_CATEGORIES.map(({ no, label, icon: Icon }) => {
                  const selected = scope.s3Categories.includes(no);
                  return (
                    <button
                      key={no}
                      onClick={() => toggleS3Cat(no)}
                      className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                        selected
                          ? "border-slate-500 bg-slate-100/60 shadow-sm"
                          : "border-[var(--border)] bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        selected ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-400"
                      }`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cat {no}</p>
                        <p className="truncate text-xs font-medium text-[var(--navy)]">{label}</p>
                      </div>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
                <p className="text-sm text-slate-400">Enable the checkbox above to select Scope 3 categories.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {nonConsolidated.length > 1 && (
        <ConsultantTip>
          Configure the inventory boundary for each entity using the tabs above. Each entity can have its own selection.
        </ConsultantTip>
      )}
      {nonConsolidated.length === 1 && (
        <ConsultantTip>
          Scope 3 is optional for your first inventory. Your Deepwoods consultant will help identify which categories are most relevant for your business.
        </ConsultantTip>
      )}
    </div>
  );
}

// ── Step 3: Review & Confirm ──────────────────────────────────────────────────

function ReviewStep({ data, onEdit }: {
  data: SetupData;
  onEdit: (step: number) => void;
}) {
  const nonConsolidated = data.entities.filter((e) => !e.isConsolidated);

  const Section = ({ title, step, children }: { title: string; step: number; children: React.ReactNode }) => (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--navy-2)]">{title}</p>
        <button onClick={() => onEdit(step)} className="text-xs font-medium text-[#1E6F5C] hover:underline">Edit</button>
      </div>
      {children}
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--navy-2)]">Step 3 of 3</p>
        <h2 className="text-2xl font-bold text-[var(--navy)]">Review & confirm</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--navy-2)]">
          Check your configuration before activating. You can go back and edit any section.
        </p>
      </div>

      <div className="space-y-4">
        <Section title="Organization Boundary" step={0}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Consolidation approach</span>
              <span className="font-medium text-[var(--navy)]">{data.consolidationApproach}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Base year</span>
              <span className="font-medium text-[var(--navy)]">{data.baseYear || "—"}</span>
            </div>
          </div>
          {data.entities.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Entities in scope</p>
              <div className="space-y-1">
                {data.entities.map((e) => (
                  <div key={e.code} className="flex items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-[#1E6F5C] text-white">{e.code}</span>
                    <span className="text-xs text-[var(--navy)]">{e.name}</span>
                    {e.isConsolidated && <span className="text-[10px] text-[#1E6F5C]">· Consolidated</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Inventory Boundary" step={1}>
          {nonConsolidated.length === 0 ? (
            <p className="text-sm text-slate-400">No entities configured</p>
          ) : (
            <div className="space-y-3">
              {nonConsolidated.map((entity) => {
                const s = data.entityScope[entity.code] ?? DEFAULT_ENTITY_SCOPE;
                const s1 = [s.s1Stationary && "Stationary", s.s1Mobile && "Mobile", s.s1Fugitive && "Fugitive"].filter(Boolean);
                const s2 = [s.s2Grid && "Grid", s.s2Renewable && "Renewable"].filter(Boolean);
                return (
                  <div key={entity.code} className="rounded-xl bg-slate-50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-[#1E6F5C] text-white">{entity.code}</span>
                      <span className="text-xs font-semibold text-[var(--navy)]">{entity.shortName || entity.code}</span>
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex gap-2">
                        <span className="w-14 shrink-0 font-semibold text-[#1E6F5C]">Scope 1</span>
                        <span className="text-[var(--navy-2)]">{s1.length ? s1.join(", ") : "None selected"}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="w-14 shrink-0 font-semibold text-blue-600">Scope 2</span>
                        <span className="text-[var(--navy-2)]">{s2.length ? s2.join(", ") : "None selected"}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="w-14 shrink-0 font-semibold text-slate-500">Scope 3</span>
                        <span className="text-[var(--navy-2)]">
                          {s.s3Included ? `${s.s3Categories.length} categories included` : "Not included"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      <div className="mt-5 rounded-xl border border-[#C5E4D0] bg-[#F0FAF5] px-5 py-4">
        <p className="text-sm font-semibold text-[#1E4D2B]">Ready to activate your workspace</p>
        <p className="mt-1 text-xs leading-relaxed text-[#1E6F5C]">
          Confirming will configure your Decarbonisation Portal based on these settings. Your dashboards and
          data submission forms will be ready immediately after activation.
        </p>
      </div>
    </div>
  );
}

// ── Success state ─────────────────────────────────────────────────────────────

function SuccessState({ onDashboard, onDataCollection }: {
  onDashboard: () => void;
  onDataCollection: () => void;
}) {
  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="rounded-2xl border bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#E6F4EF]">
            <Check className="h-8 w-8 text-[#1E6F5C]" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-[var(--navy)]">Workspace activated</h1>
          <p className="mb-8 text-sm leading-relaxed text-[var(--navy-2)]">
            Your GHG boundary is configured. Start collecting activity data now, or explore your workspace first.
          </p>
          <div className="space-y-3">
            <button
              onClick={onDataCollection}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E6F5C] px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-[#1E6F5C]/20 transition-all hover:brightness-110"
            >
              <FileUp className="h-4 w-4" />
              Start data collection
            </button>
            <button
              onClick={onDashboard}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--navy)] transition-all hover:bg-slate-50"
            >
              Go to workspace first
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#1E6F5C]/15 bg-[#F0FAF5] px-4 py-3.5">
          <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-[#1E6F5C]" />
          <p className="text-xs leading-relaxed text-[#1E6F5C]">
            <span className="font-semibold">What's next:</span> Download the data templates, fill in your activity data for the reporting period, and upload them here.
            Your Deepwoods consultant will review and generate your GHG inventory report.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Loading ───────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
      <Loader2 className="h-8 w-8 animate-spin text-[#1E6F5C]" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function Setup() {
  const navigate = useNavigate();
  const token = getToken();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingEntities, setExistingEntities] = useState<ExistingEntity[]>([]);
  const [data, setData] = useState<SetupData>({
    consolidationApproach: "Operational Control",
    baseYear: "",
    entities: [],
    entityScope: {},
  });

  useEffect(() => {
    if (!token) { navigate({ to: "/" }); return; }
    authFetch("context.php")
      .then((ctx: any) => {
        setExistingEntities(ctx.entities ?? []);
        setData((prev) => ({
          ...prev,
          consolidationApproach: ctx.config?.consolidation_approach ?? prev.consolidationApproach,
          baseYear: ctx.config?.base_year ?? prev.baseYear,
        }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (patch: Partial<SetupData>) => setData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const nonConsolidated = data.entities.filter((e) => !e.isConsolidated);

      // Build per-entity scope payload
      const entityScopePayload: Record<string, object> = {};
      nonConsolidated.forEach((e) => {
        const s = data.entityScope[e.code] ?? DEFAULT_ENTITY_SCOPE;
        entityScopePayload[e.code] = {
          s1_stationary: s.s1Stationary,
          s1_mobile: s.s1Mobile,
          s1_fugitive: s.s1Fugitive,
          s2_grid: s.s2Grid,
          s2_renewable: s.s2Renewable,
          s3_included: s.s3Included,
          s3_categories: s.s3Included ? s.s3Categories : [],
        };
      });

      // Use primary entity scope for legacy global keys
      const primaryCode = nonConsolidated[0]?.code;
      const primaryScope = primaryCode ? (data.entityScope[primaryCode] ?? DEFAULT_ENTITY_SCOPE) : DEFAULT_ENTITY_SCOPE;

      const payload = {
        consolidation_approach: data.consolidationApproach,
        base_year: data.baseYear,
        entities: data.entities.filter((e) => !e.isFromDb).map((e) => ({
          code: e.code,
          name: e.name,
          short_name: e.shortName,
          is_consolidated: e.isConsolidated,
        })),
        entity_scope: entityScopePayload,
        // Legacy global scope keys (derived from primary entity for backward compatibility)
        s1_stationary: primaryScope.s1Stationary,
        s1_mobile: primaryScope.s1Mobile,
        s1_fugitive: primaryScope.s1Fugitive,
        s2_grid: primaryScope.s2Grid,
        s2_renewable: primaryScope.s2Renewable,
        s3_included: primaryScope.s3Included,
        s3_categories: primaryScope.s3Included ? primaryScope.s3Categories : [],
      };

      await authFetch("client-setup.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      sessionStorage.removeItem("decarb_client_ctx");
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Setup could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDashboard = () => navigate({ to: "/home" });
  const handleDataCollection = () => navigate({ to: "/submissions" });

  if (!token) return null;
  if (loading) return <LoadingScreen />;
  if (done) return (
    <>
      <ProgressHeader step={STEP_LABELS.length} />
      <SuccessState onDashboard={handleDashboard} onDataCollection={handleDataCollection} />
    </>
  );

  const canProceed: Record<number, boolean> = {
    0: data.entities.length > 0 || existingEntities.length > 0,
    1: true,
    2: true,
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <ProgressHeader step={step} />

      {error && (
        <div className="mx-auto mt-4 max-w-xl px-4">
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <p className="flex-1 text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-xl px-4 py-8 md:py-12">
        {step === 0 && <OrgBoundaryStep data={data} onChange={update} existingEntities={existingEntities} />}
        {step === 1 && <InventoryBoundaryStep data={data} onChange={update} />}
        {step === 2 && <ReviewStep data={data} onEdit={setStep} />}
      </main>

      <NavButtons
        step={step}
        onBack={() => setStep((s) => Math.max(s - 1, 0))}
        onNext={step === 2 ? handleSubmit : () => setStep((s) => s + 1)}
        nextLabel={step === 2 ? "Confirm & Activate" : "Continue"}
        disabled={!canProceed[step]}
        submitting={submitting}
      />
    </div>
  );
}
