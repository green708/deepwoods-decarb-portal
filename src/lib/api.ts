// api.ts
// ─────────────────────────────────────────────────────────────────────────────
// Typed React Query hooks for every backend data endpoint.
//
// Pattern: useXxx(entity, fy) → { data, isLoading, error }
// All hooks return null while loading so pages can show skeletons.
// The entity + fy come from useEntity() / useFiscalYear() in entity.tsx.
//
// API base: /backend/api/  (same PHP backend, new endpoints)
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";

// ── Shared types ──────────────────────────────────────────────────────────────

/** Keyed by FY label e.g. { "FY22": 120.5, "FY23": 135.2, ... } */
export type FYSeries = Record<string, number | null>;

export interface InventoryRow {
  metric_key: string;           // "Scope 1", "Scope 2 LB", "Cat 1", …
  series: FYSeries;             // all years in one row
}

export interface InventoryResponse {
  entity: string;
  rows: InventoryRow[];
}

export interface S1BreakdownRow {
  source: string;               // "Stationary", "Mobile", "Fugitive"
  fuel: string;
  series: FYSeries;
}

export interface S2BreakdownRow {
  type: "location_based" | "market_based" | "grid_kwh" | "re_kwh";
  series: FYSeries;
}

export interface S1ByFacilityRow {
  facility: string;
  sub_type: string;
  series: FYSeries;
}

export interface S2ByFacilityRow {
  facility: string;
  entity?: string;
  series: FYSeries;
}

export interface IntensityRow {
  fy: string;
  revenue_lakh: number | null;
  production_units: number | null;
  s12_lb: number | null;
  s12_mb: number | null;
  s3_total: number | null;
}

export interface FacilityRow {
  id: number;
  name: string;
  entity: string;
  location: string;
  state: string;
  grid_utility: string;
  re_instrument: string;
}

export interface S3SummaryRow {
  entity: string;
  category: string;             // "Cat 1", "Cat 2", …
  series: FYSeries;
}

export interface DecarbAction {
  id: number;
  entity: string;
  title: string;
  description: string;
  facilities: string[];
  lever: string;
  status: string;
  priority: "High" | "Medium" | "Low";
  abatement_t: number | null;
  timeline: string;
}

export interface DecarbAsset {
  id: string;
  name: string;
  entity: string;
  facility: string;
  fuel: string;
  scope: string;
  sub_type: string;
  status: string;
  health: string;
  unit: string;
  series: FYSeries;
}

export interface PriorityItem {
  id: number;
  type: "action" | "update";
  entity: string;
  title: string;
  detail: string;
  priority: "High" | "Medium" | "Low" | null;
  link: string;
  age: string;
  tag: string | null;
}

export interface PeerRow {
  name: string;
  scope1: number | null;
  scope2_lb: number | null;
  scope2_mb: number | null;
  scope3_total: number | null;
  intensity_revenue: number | null;
  fy: string;
}

export interface IRECRow {
  entity: string;
  facility: string;
  mwh: number;
  coverage: string;
  vintage: string;
  instrument: string;
  status: string;
  fy: string;
}

export interface DatasetItem {
  id: string;
  name: string;
  description: string;
  type: string;
  template_url: string | null;
  enabled: boolean;
}

export interface MethodologySection {
  section: string;
  content: string;
  sort_order: number;
}

export interface VaultDocument {
  id: number;
  entity: string;
  fy: string;
  title: string;
  type: string;
  drive_link: string;
  uploaded_at: string;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Full GHG inventory for one entity — all metrics, all years */
export function useInventory(entity: string) {
  return useQuery<InventoryResponse>({
    queryKey: ["inventory", entity],
    queryFn: () => authFetch(`ghg/inventory.php${qs({ entity })}`),
    staleTime: 5 * 60 * 1000,
  });
}

/** Scope 1 sub-type breakdown (fuel + source) for one entity */
export function useS1Breakdown(entity: string) {
  return useQuery<S1BreakdownRow[]>({
    queryKey: ["s1-breakdown", entity],
    queryFn: () => authFetch(`ghg/s1.php${qs({ entity, view: "breakdown" })}`),
    staleTime: 5 * 60 * 1000,
  });
}

/** Scope 1 by facility for one entity */
export function useS1ByFacility(entity: string) {
  return useQuery<S1ByFacilityRow[]>({
    queryKey: ["s1-facility", entity],
    queryFn: () => authFetch(`ghg/s1.php${qs({ entity, view: "by_facility" })}`),
    staleTime: 5 * 60 * 1000,
  });
}

/** Scope 2 breakdown (LB / MB / grid kWh / RE kWh) for one entity */
export function useS2Breakdown(entity: string) {
  return useQuery<S2BreakdownRow[]>({
    queryKey: ["s2-breakdown", entity],
    queryFn: () => authFetch(`ghg/s2.php${qs({ entity, view: "breakdown" })}`),
    staleTime: 5 * 60 * 1000,
  });
}

/** Scope 2 by facility */
export function useS2ByFacility(entity: string) {
  return useQuery<S2ByFacilityRow[]>({
    queryKey: ["s2-facility", entity],
    queryFn: () => authFetch(`ghg/s2.php${qs({ entity, view: "by_facility" })}`),
    staleTime: 5 * 60 * 1000,
  });
}

/** Intensity metrics (revenue + production) for one entity — all years */
export function useIntensity(entity: string) {
  return useQuery<IntensityRow[]>({
    queryKey: ["intensity", entity],
    queryFn: () => authFetch(`ghg/intensity.php${qs({ entity })}`),
    staleTime: 5 * 60 * 1000,
  });
}

/** All facilities for this client (optionally filtered by entity) */
export function useFacilities(entity?: string) {
  return useQuery<FacilityRow[]>({
    queryKey: ["facilities", entity ?? "all"],
    queryFn: () => authFetch(`ghg/facilities.php${qs({ entity })}`),
    staleTime: 10 * 60 * 1000,
  });
}

/** Scope 3 summary — all categories for one entity */
export function useS3Summary(entity: string) {
  return useQuery<S3SummaryRow[]>({
    queryKey: ["s3-summary", entity],
    queryFn: () => authFetch(`ghg/s3.php${qs({ entity })}`),
    staleTime: 5 * 60 * 1000,
  });
}

/** Decarbonisation action plan items */
export function useDecarbActions(entity?: string) {
  return useQuery<DecarbAction[]>({
    queryKey: ["decarb-actions", entity ?? "all"],
    queryFn: () => authFetch(`decarb/actions.php${qs({ entity })}`),
    staleTime: 5 * 60 * 1000,
  });
}

/** Equipment / asset register */
export function useDecarbAssets(entity?: string) {
  return useQuery<DecarbAsset[]>({
    queryKey: ["decarb-assets", entity ?? "all"],
    queryFn: () => authFetch(`decarb/assets.php${qs({ entity })}`),
    staleTime: 5 * 60 * 1000,
  });
}

/** Priority action + update items for the notification panel */
export function usePriorityItems(entity?: string) {
  return useQuery<PriorityItem[]>({
    queryKey: ["priority-items", entity ?? "all"],
    queryFn: () => authFetch(`priority-items.php${qs({ entity })}`),
    staleTime: 2 * 60 * 1000,
  });
}

/** Peer benchmarking data */
export function usePeers() {
  return useQuery<PeerRow[]>({
    queryKey: ["peers"],
    queryFn: () => authFetch("peers.php"),
    staleTime: 10 * 60 * 1000,
  });
}

/** I-REC certificate register for one entity */
export function useIRECRegister(entity?: string) {
  return useQuery<IRECRow[]>({
    queryKey: ["irec", entity ?? "all"],
    queryFn: () => authFetch(`credits/irec.php${qs({ entity })}`),
    staleTime: 5 * 60 * 1000,
  });
}

/** Grid MWh history for one entity */
export function useGridMWh(entity?: string) {
  return useQuery<Record<string, Record<string, number>>>({
    queryKey: ["grid-mwh", entity ?? "all"],
    queryFn: () => authFetch(`credits/grid-mwh.php${qs({ entity })}`),
    staleTime: 5 * 60 * 1000,
  });
}

/** Dataset definitions for the submissions page */
export function useDatasets() {
  return useQuery<DatasetItem[]>({
    queryKey: ["datasets"],
    queryFn: () => authFetch("datasets.php"),
    staleTime: 10 * 60 * 1000,
  });
}

/** Methodology sections */
export function useMethodology() {
  return useQuery<MethodologySection[]>({
    queryKey: ["methodology"],
    queryFn: () => authFetch("methodology.php"),
    staleTime: 10 * 60 * 1000,
  });
}

/** Vault / document register */
export function useVaultDocuments(entity?: string, fy?: string) {
  return useQuery<VaultDocument[]>({
    queryKey: ["vault", entity ?? "all", fy ?? "all"],
    queryFn: () => authFetch(`vault.php${qs({ entity, fy })}`),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Admin: client activation ──────────────────────────────────────────────────

export interface ActivationClient {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  activated_at: string | null;
  created_at: string;
  user_count: number;
  setup_complete: string | null;
  ghg_setup_done: string | null;
  invoice_ref: string | null;
  payment_status: "pending" | "paid" | "waived";
  payment_date: string | null;
  payment_notes: string | null;
}

/** Deepwoods-admin only: list all clients with activation status */
export function useActivationClients() {
  return useQuery<ActivationClient[]>({
    queryKey: ["activation-clients"],
    queryFn: () => authFetch("activate-client.php"),
    staleTime: 30 * 1000,
  });
}

/** Deepwoods-admin only: update invoice / payment fields for a client */
export function useUpdateClientInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      client_id: number;
      invoice_ref?: string | null;
      payment_status?: "pending" | "paid" | "waived";
      payment_date?: string | null;
      payment_notes?: string | null;
    }) =>
      authFetch("activate-client.php", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activation-clients"] });
    },
  });
}

// ── Team management ───────────────────────────────────────────────────────────

export interface TeamMember {
  id: number;
  email: string;
  role: string;
  entity_scope: string | null;
  must_change_password: boolean;
  created_at: string;
}

/** All users on the caller's client (sustainability_team only) */
export function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ["team"],
    queryFn: () => authFetch("team.php"),
    staleTime: 2 * 60 * 1000,
  });
}

// ── Client provisioning (Deepwoods admin/coordinator) ─────────────────────────

export interface ApiClient {
  id: number;
  name: string;
  slug: string;
  logo_url: string;
  primary_color: string;
  currency: string;
  reporting_period: "FY" | "CY";
  is_active: boolean;
  activated_at: string | null;
  created_at: string;
  setup_complete: string | null;
  industry: string | null;
  consolidation_approach: string | null;
  user_count: number;
  entity_count: number;
}

/** All clients — Deepwoods admin/coordinator only */
export function useClients() {
  return useQuery<ApiClient[]>({
    queryKey: ["clients"],
    queryFn: () => authFetch("clients.php"),
    staleTime: 30 * 1000,
  });
}

// ── Helper: extract a single metric series from InventoryResponse ─────────────

export function getMetric(
  data: InventoryResponse | undefined,
  key: string,
): FYSeries {
  return data?.rows.find((r) => r.metric_key === key)?.series ?? {};
}

/** Get the value for a specific metric + year */
export function getVal(
  data: InventoryResponse | undefined,
  key: string,
  fy: string,
): number | null {
  return getMetric(data, key)[fy] ?? null;
}
