// client-context.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Loaded ONCE after login via GET /backend/api/context.php.
// Every part of the UI reads from this — entities, years, enabled pages,
// Scope 3 boundary, targets, branding. No hardcoded client data anywhere.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext, useContext, useEffect, useState, useCallback, type ReactNode,
} from "react";
import { authFetch } from "@/lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClientEntity {
  code: string;                  // "FL", "FP", "FOS", "CORP", "DPL" …
  name: string;                  // "Featherlite Products Pvt. Ltd."
  short: string;                 // "FP"
  is_consolidated: boolean;      // true = this is the roll-up / all-entity view
  consolidates: string[] | null; // ["FP","FOS"] for consolidated entity, null otherwise
  sort_order: number;
}

export interface ClientTargets {
  base_year_s12: string;         // "FY22"
  base_year_s3: string;          // "FY24"
  netzero_year: number;          // 2040
  sbti_target_s12: number;       // reduction % from base year
  sbti_target_year: number;      // 2030
}

export interface ClientInfo {
  id: number;
  name: string;                  // "Featherlite" / "Navitas" / "Dolphin"
  slug: string;                  // "featherlite"
  logo_url: string;              // "/logos/featherlite.png"
  primary_color: string;         // "#1E6F5C"
  currency: string;              // "INR" | "USD"
  reporting_period: "FY" | "CY"; // FY = April–March, CY = Jan–Dec
  is_active: boolean;            // false until Deepwoods manually activates the client
}

export interface ClientContext {
  client: ClientInfo;
  entities: ClientEntity[];
  reporting_years: string[];     // ["FY22","FY23","FY24","FY25","FY26"]
  enabled_pages: string[];       // page route names visible in nav
  s3_boundary: string[];         // ["Cat 1","Cat 2","Cat 3","Cat 4","Cat 5","Cat 6"]
  s3_not_relevant: Record<string, string[]>; // { "FP": ["Cat 7"], "FOS": [] }
  targets: ClientTargets;
  config: Record<string, unknown>; // catch-all for client-specific config values
}

// ── Context ───────────────────────────────────────────────────────────────────

type ClientCtxState =
  | { status: "loading" }
  | { status: "ready"; data: ClientContext }
  | { status: "error"; error: string };

const Ctx = createContext<ClientCtxState>({ status: "loading" });

const STORAGE_KEY = "decarb_client_ctx";

// ── Provider ──────────────────────────────────────────────────────────────────

export function ClientContextProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClientCtxState>(() => {
    // Restore from sessionStorage so page refreshes don't flash the loader
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(STORAGE_KEY);
        if (cached) return { status: "ready", data: JSON.parse(cached) };
      } catch { /* ignore */ }
    }
    return { status: "loading" };
  });

  useEffect(() => {
    if (state.status === "ready") return; // already hydrated from cache

    authFetch("context.php")
      .then((data: ClientContext) => {
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
        // Inject primary colour as a CSS variable for instant re-theming
        document.documentElement.style.setProperty("--primary", data.client.primary_color);
        document.documentElement.style.setProperty("--ghg-green", data.client.primary_color);
        setState({ status: "ready", data });
      })
      .catch((err: Error) => {
        setState({ status: "error", error: err.message });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

/** Call this on logout to wipe the cached context */
export function clearClientContext() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the ClientContext. Throws while loading so Suspense / error boundaries work.
 * Inside _app.tsx we gate rendering on status === "ready", so this is always safe.
 */
export function useClientContext(): ClientContext {
  const state = useContext(Ctx);
  if (state.status === "loading") throw new Promise(() => {}); // suspend
  if (state.status === "error") throw new Error(state.status);
  return state.data;
}

/** Non-throwing version — use in places that need to handle loading gracefully */
export function useClientContextSafe(): ClientCtxState {
  return useContext(Ctx);
}

// ── Selectors ─────────────────────────────────────────────────────────────────

/** Entities that receive data submissions (non-consolidated only) */
export function useDataEntryEntities(): ClientEntity[] {
  const ctx = useClientContext();
  return ctx.entities.filter((e) => !e.is_consolidated);
}

/** The consolidated entity (the "all" rollup tab) */
export function useConsolidatedEntity(): ClientEntity | undefined {
  const ctx = useClientContext();
  return ctx.entities.find((e) => e.is_consolidated);
}

/** Years available for analysis (excludes current open year if still in collection) */
export function useAnalysisYears(): string[] {
  const ctx = useClientContext();
  // The last year in reporting_years is the current open year — exclude it
  // by default unless the context explicitly flags it as complete.
  const allYears = ctx.reporting_years;
  const openYearFlag = (ctx.config.current_year_open as boolean | undefined) ?? true;
  return openYearFlag ? allYears.slice(0, -1) : allYears;
}

/** Currency symbol for display (e.g. "₹" for INR, "$" for USD) */
export function useCurrencySymbol(): string {
  const ctx = useClientContext();
  return ctx.client.currency === "INR" ? "₹" : "$";
}

/** Entity color by sort_order position — deterministic palette */
const ENTITY_PALETTE = [
  "#1E6F5C", // position 0 — consolidated / primary (deep green)
  "#3B82F6", // position 1
  "#F59E0B", // position 2
  "#8B5CF6", // position 3
  "#EF4444", // position 4
];

export function entityColor(sortOrder: number): string {
  return ENTITY_PALETTE[sortOrder % ENTITY_PALETTE.length];
}

export function useEntityColor(): (code: string) => string {
  const ctx = useClientContext();
  return useCallback(
    (code: string) => {
      const e = ctx.entities.find((x) => x.code === code);
      return entityColor(e?.sort_order ?? 0);
    },
    [ctx.entities],
  );
}
