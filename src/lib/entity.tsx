// entity.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Entity + FiscalYear context — which reporting view is active across the portal.
//
// KEY CHANGE from Featherlite-GHG:
//   Entity list and years now come from ClientContext (loaded on login),
//   NOT from hardcoded arrays in src/data/master.ts.
//
// This means the same component works for any client:
//   Featherlite → ["FL","FP","FOS"], ["FY22".."FY26"]
//   Navitas     → ["CORP","NAVITAS"], ["CY2023","CY2024","CY2025"]
//   Dolphin     → ["CORP","DPL"], ["FY24","FY25","FY26"]
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useClientContext } from "@/lib/client-context";

// ── Generate all fiscal / calendar years from 2015 to present ────────────────

export function generateAllYears(reportingPeriod: string): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  const years: string[] = [];

  if (reportingPeriod === "CY") {
    for (let y = 2015; y <= year; y++) years.push(`CY${y}`);
  } else {
    // FY starts in April. FY26 = Apr 2026 – Mar 2027.
    const currentFYStart = month >= 4 ? year : year - 1;
    for (let y = 2015; y <= currentFYStart; y++) {
      years.push(`FY${String(y).slice(2)}`);
    }
  }

  return years;
}

// ── Entity context ───────────────────────────────────────────────────────────

const ENTITY_STORAGE_KEY = "decarb_entity";

type EntityCtx = { entity: string; setEntity: (e: string) => void };
const Ctx = createContext<EntityCtx>({ entity: "", setEntity: () => {} });

export function EntityProvider({ children }: { children: ReactNode }) {
  const { entities } = useClientContext();
  const defaultEntity = entities.find((e) => e.is_consolidated)?.code ?? entities[0]?.code ?? "";

  const [entity, setEntityState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(ENTITY_STORAGE_KEY);
      if (saved && entities.some((e) => e.code === saved)) return saved;
    }
    return defaultEntity;
  });

  useEffect(() => {
    if (entity && !entities.some((e) => e.code === entity)) {
      setEntityState(defaultEntity);
    }
  }, [entities, entity, defaultEntity]);

  const setEntity = useCallback((e: string) => {
    setEntityState(e);
    try { localStorage.setItem(ENTITY_STORAGE_KEY, e); } catch { /* ignore */ }
  }, []);

  return <Ctx.Provider value={{ entity, setEntity }}>{children}</Ctx.Provider>;
}

export function useEntity(): EntityCtx {
  return useContext(Ctx);
}

// ── Entity switcher UI ───────────────────────────────────────────────────────

export function EntitySwitcher({ compact = false }: { compact?: boolean }) {
  const { entity, setEntity } = useEntity();
  const { entities } = useClientContext();

  return (
    <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
      {entities.map((e) => {
        const active = entity === e.code;
        const label = compact
          ? e.code
          : e.is_consolidated
            ? `${e.code} — Consolidated`
            : e.code;
        return (
          <button
            key={e.code}
            onClick={() => setEntity(e.code)}
            title={e.name}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-[var(--navy)] text-white shadow-sm"
                : "text-[var(--muted-foreground)] hover:bg-white hover:text-[var(--navy)]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function EntityBadge() {
  const { entity } = useEntity();
  const { entities } = useClientContext();
  const meta = entities.find((e) => e.code === entity);
  if (!meta) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        meta.is_consolidated
          ? "border-[var(--navy)]/30 bg-[var(--navy)]/5 text-[var(--navy)]"
          : "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]"
      }`}
    >
      {meta.short}
      {meta.is_consolidated && meta.consolidates && (
        <span className="font-normal opacity-70">
          · {meta.consolidates.join(" + ")}
        </span>
      )}
    </span>
  );
}

// ── Fiscal Year context ──────────────────────────────────────────────────────

const FY_STORAGE_KEY = "decarb_fy";

type FYCtx = { fy: string; setFY: (y: string) => void };
const FYContext = createContext<FYCtx>({ fy: "", setFY: () => {} });

export function FiscalYearProvider({ children }: { children: ReactNode }) {
  const ctx = useClientContext();
  const { client } = ctx;
  // Prefer reporting_years from context (years with actual data) over the full
  // generated range. Fall back to generated range only when reporting_years is empty.
  const allYears = useMemo(() => generateAllYears(client.reporting_period), [client.reporting_period]);
  const availableYears = useMemo(
    () => (ctx.reporting_years?.length > 0 ? ctx.reporting_years : allYears),
    [ctx.reporting_years, allYears],
  );
  const defaultFY = availableYears[availableYears.length - 1] ?? "";

  const [fy, setFYState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(FY_STORAGE_KEY);
      if (saved && availableYears.includes(saved)) return saved;
    }
    return defaultFY;
  });

  useEffect(() => {
    if (fy && !availableYears.includes(fy)) setFYState(defaultFY);
  }, [availableYears, fy, defaultFY]);

  const setFY = useCallback((y: string) => {
    setFYState(y);
    try { localStorage.setItem(FY_STORAGE_KEY, y); } catch { /* ignore */ }
  }, []);

  return <FYContext.Provider value={{ fy, setFY }}>{children}</FYContext.Provider>;
}

export function useFiscalYear(): FYCtx {
  return useContext(FYContext);
}

// ── Fiscal year switcher UI ───────────────────────────────────────────────────

export function FiscalYearSwitcher() {
  const { fy, setFY } = useFiscalYear();
  const ctx = useClientContext();
  const allYears = useMemo(() => generateAllYears(ctx.client.reporting_period), [ctx.client.reporting_period]);
  const availableYears = ctx.reporting_years?.length > 0 ? ctx.reporting_years : allYears;

  const displayYears = [...availableYears].reverse();
  const effectiveFY = fy && displayYears.includes(fy) ? fy : displayYears[0] ?? "";

  return (
    <select
      value={effectiveFY}
      onChange={e => setFY(e.target.value)}
      className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-[var(--primary)] cursor-pointer"
      style={{ color: 'var(--navy, #1E293B)', minWidth: '4rem' }}
    >
      {displayYears.map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}
