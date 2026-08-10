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

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useClientContext, useAnalysisYears } from "@/lib/client-context";

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
  const analysisYears = useAnalysisYears();
  const defaultFY = analysisYears[analysisYears.length - 1] ?? "";

  const [fy, setFYState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(FY_STORAGE_KEY);
      if (saved && analysisYears.includes(saved)) return saved;
    }
    return defaultFY;
  });

  useEffect(() => {
    if (fy && !analysisYears.includes(fy)) setFYState(defaultFY);
  }, [analysisYears, fy, defaultFY]);

  const setFY = useCallback((y: string) => {
    setFYState(y);
    try { localStorage.setItem(FY_STORAGE_KEY, y); } catch { /* ignore */ }
  }, []);

  return <FYContext.Provider value={{ fy, setFY }}>{children}</FYContext.Provider>;
}

export function useFiscalYear(): FYCtx {
  return useContext(FYContext);
}

// ── Fiscal year switcher UI ──────────────────────────────────────────────────

export function FiscalYearSwitcher() {
  const { fy, setFY } = useFiscalYear();
  const analysisYears = useAnalysisYears();

  return (
    <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
      {analysisYears.map((y) => {
        const active = fy === y;
        return (
          <button
            key={y}
            onClick={() => setFY(y)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-[var(--navy)] text-white shadow-sm"
                : "text-[var(--muted-foreground)] hover:bg-white hover:text-[var(--navy)]"
            }`}
          >
            {y}
          </button>
        );
      })}
    </div>
  );
}
