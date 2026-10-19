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
  // Legal entity detail — populated from client_entities
  country?: string | null;
  registration_no?: string | null;
  tax_id?: string | null;
  org_type?: string | null;
  legal_address?: string | null;
  // Team members scoped to this entity
  team_count?: number;
}

export interface ReportingEngagement {
  id: number;
  name: string;
  report_type: "consolidated" | "standalone";
  legal_entity_codes: string[] | null;
  reporting_entity_code: string;
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
  payment_status: "pending" | "paid" | "waived"; // set by Deepwoods via activate-client.php
}

export interface GhgFacility {
  id: number;
  entity: string;
  name: string;
  location?: string | null;
  state?: string | null;
  short_name?: string | null;
  status: string;
  is_hq: boolean;
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
  // GHG facilities for this client (from ghg_facilities table)
  facilities?: GhgFacility[];
  // Reporting architecture — optional for backwards compatibility with legacy clients
  reporting_model?: "consolidated" | "separate" | "mixed" | null;
  reporting_engagements?: ReportingEngagement[];
  // The logged-in user, as seen by the backend — entity_scope is set for a user
  // locked to one entity (e.g. an entity admin), null for org-wide access.
  user?: { email: string | null; role: string | null; entity_scope: string | null };
}

// ── Context ───────────────────────────────────────────────────────────────────

type ClientCtxState =
  | { status: "loading" }
  | { status: "ready"; data: ClientContext }
  | { status: "error"; error: string };

const Ctx = createContext<ClientCtxState>({ status: "loading" });

const STORAGE_KEY = "decarb_client_ctx_v2"; // v2: adds per-entity team_count + extra entity fields
const DWA_VIEW_KEY = "decarb_dwa_view";

// ── DWA view-as helpers ───────────────────────────────────────────────────────

/** Returns the slug of the client a DWA user is currently viewing as, or null. */
export function getDwaViewAs(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DWA_VIEW_KEY);
}

/** Switch DWA to view a different client — clears cached context and reloads to home. */
export function switchDwaClient(slug: string) {
  localStorage.setItem(DWA_VIEW_KEY, slug);
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  window.location.href = "/home";
}

/** Return DWA to the client picker — clears view selection and reloads. */
export function clearDwaView() {
  localStorage.removeItem(DWA_VIEW_KEY);
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  window.location.href = "/home";
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ClientContextProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClientCtxState>(() => {
    // Restore from sessionStorage so page refreshes don't flash the loader
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.client && parsed?.config) return { status: "ready", data: parsed };
          sessionStorage.removeItem(STORAGE_KEY); // malformed cache — refetch
        }
      } catch { /* ignore */ }
    }
    return { status: "loading" };
  });

  useEffect(() => {
    // Cached state paints instantly; always revalidate so config changes
    // (payment unlock, setup progress) show up without a re-login.
    const viewAs = getDwaViewAs();
    const url = viewAs
      ? `context.php?view_as=${encodeURIComponent(viewAs)}`
      : "context.php";

    authFetch(url)
      .then((data: ClientContext) => {
        // authFetch turns non-JSON bodies (e.g. PHP warnings) into {} — never cache/render that
        if (!data?.client || !data?.config) {
          throw new Error("Workspace data was invalid. Please refresh; if it persists, contact your Deepwoods account manager.");
        }
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
        // Inject primary colour as a CSS variable for instant re-theming
        document.documentElement.style.setProperty("--primary", data.client.primary_color);
        document.documentElement.style.setProperty("--ghg-green", data.client.primary_color);
        setState({ status: "ready", data });
      })
      .catch((err: Error) => {
        setState((prev) => prev.status === "ready" ? prev : { status: "error", error: err.message });
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
