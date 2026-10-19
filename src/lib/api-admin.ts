// api-admin.ts
// ─────────────────────────────────────────────────────────────────────────────
// React Query hooks for the Deepwoods admin panel and the client Home summary.
// Contract: backend/api/admin/*.php, home-summary.php, cycle-submit.php.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth";

function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== "") p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : "";
}

const post = (path: string, body: unknown, method: "POST" | "DELETE" = "POST") =>
  authFetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// ── Shared vocab ──────────────────────────────────────────────────────────────

export const ACTION_STATUSES = ["Idea", "Planned", "Committed", "In Progress", "Completed", "Delayed", "Cancelled"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export type CalcState = "draft" | "calculated" | "verified" | "locked";
export type CycleState = "open" | "submitted" | "locked";

// ── Portfolio ─────────────────────────────────────────────────────────────────

export type PortfolioFlag = "overdue" | "to_verify" | "open_query" | "no_users" | "unpaid" | "inactive" | "no_data";

export interface AdminPortfolioClient {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  is_active: boolean;
  payment_status: "pending" | "paid" | "waived";
  reporting_period: "FY" | "CY";
  plan: string | null;
  account_owner: string | null;
  entity_count: number;
  user_count: number;
  last_login: string | null;
  fy: string;
  sources_total: number;
  sources_with_data: number;
  cycle: {
    status: CycleState | "none";
    data_due_date: string | null;
    report_due_date: string | null;
    overdue: boolean;
    submitted_entities: number;
    entities: number;
  };
  calc: { status: CalcState | "none"; to_verify: number };
  open_queries: number;
  flags: PortfolioFlag[];
}

export interface AttentionItem {
  type: "new_request" | "awaiting_payment" | "overdue_cycle" | "open_query" | "to_verify" | "no_users" | "submitted";
  severity: "high" | "medium" | "low";
  client_id: number | null;
  client_name: string | null;
  label: string;
  link: string | null;
  ref_id: number | null;
}

export interface AdminPortfolioResponse {
  summary: {
    clients: number; active: number; awaiting_payment: number; pending_activation: number;
    new_requests: number; open_queries: number; overdue_cycles: number; to_verify: number;
  };
  attention: AttentionItem[];
  total: number;
  page: number;
  per_page: number;
  clients: AdminPortfolioClient[];
}

export interface PortfolioParams {
  q?: string;
  status?: "all" | "active" | "pending_activation" | "awaiting_payment" | "attention";
  owner?: string;
  sort?: "name" | "attention" | "due" | "owner";
  page?: number;
  per_page?: number;
}

export function useAdminPortfolio(params: PortfolioParams) {
  return useQuery<AdminPortfolioResponse>({
    queryKey: ["admin-portfolio", params],
    queryFn: () => authFetch(`admin/portfolio.php${qs({ ...params })}`),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

// ── Client settings (targets, net zero, consultant) ───────────────────────────

export interface AdminClientSettings {
  client: {
    id: number; name: string; slug: string; is_active: boolean;
    payment_status: "pending" | "paid" | "waived"; reporting_period: "FY" | "CY";
    account_owner: string | null; logo_url: string | null; primary_color: string | null;
  };
  settings: Record<string, string | null>;
  defaults: Record<string, string>;
  fy: string;
}

export function useAdminClientSettings(clientId: number | null) {
  return useQuery<AdminClientSettings>({
    queryKey: ["admin-client-settings", clientId],
    queryFn: () => authFetch(`admin/client-settings.php${qs({ client_id: clientId })}`),
    enabled: clientId != null,
    staleTime: 15 * 1000,
  });
}

export function useSaveAdminClientSettings() {
  const qc = useQueryClient();
  return useMutation<AdminClientSettings, Error, { client_id: number; settings: Record<string, string | null>; account_owner?: string | null }>({
    mutationFn: (body) => post("admin/client-settings.php", body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-client-settings", v.client_id] });
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
    },
  });
}

// ── Calculation status ────────────────────────────────────────────────────────

export interface CalcStatusRow {
  entity: string;
  entity_name: string;
  status: CalcState;
  calculated_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  ef_version: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string | null;
  has_data: boolean;
}

export function useAdminCalcStatus(clientId: number | null, fy?: string) {
  return useQuery<{ fy: string; entities: CalcStatusRow[] }>({
    queryKey: ["admin-calc-status", clientId, fy ?? ""],
    queryFn: () => authFetch(`admin/calc-status.php${qs({ client_id: clientId, fy })}`),
    enabled: clientId != null,
    staleTime: 15 * 1000,
  });
}

export function useSetAdminCalcStatus() {
  const qc = useQueryClient();
  return useMutation<CalcStatusRow, Error, { client_id: number; entity: string; fiscal_year: string; status: CalcState; ef_version?: string | null; notes?: string | null }>({
    mutationFn: (body) => post("admin/calc-status.php", body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-calc-status", v.client_id] });
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
    },
  });
}

// ── Reporting cycles ──────────────────────────────────────────────────────────

export interface CycleRow {
  entity: string;
  entity_name: string;
  status: CycleState;
  data_due_date: string | null;
  report_due_date: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  notes: string | null;
}

export function useAdminCycles(clientId: number | null, fy?: string) {
  return useQuery<{ fy: string; entities: CycleRow[] }>({
    queryKey: ["admin-cycles", clientId, fy ?? ""],
    queryFn: () => authFetch(`admin/cycles.php${qs({ client_id: clientId, fy })}`),
    enabled: clientId != null,
    staleTime: 15 * 1000,
  });
}

export function useSaveAdminCycle() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, {
    client_id: number; fiscal_year: string; entity: string;
    data_due_date?: string | null; report_due_date?: string | null; status?: CycleState; notes?: string | null;
  }>({
    mutationFn: (body) => post("admin/cycles.php", body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-cycles", v.client_id] });
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
    },
  });
}

// ── Actions (decarbonisation plan) ────────────────────────────────────────────

export interface AdminAction {
  id: number;
  entity: string;
  title: string;
  description: string | null;
  facilities: string[];
  lever: string | null;
  status: ActionStatus;
  priority: "High" | "Medium" | "Low";
  abatement_t: number | null;
  actual_abatement_t: number | null;
  timeline: string | null;
  owner: string | null;
  start_date: string | null;
  end_date: string | null;
  cost: number | null;
  updated_at: string | null;
}

export type AdminActionInput = Partial<Omit<AdminAction, "updated_at">> & { client_id: number; entity: string; title: string; status: ActionStatus; priority: "High" | "Medium" | "Low" };

export function useAdminActions(clientId: number | null) {
  return useQuery<{ actions: AdminAction[]; statuses: string[] }>({
    queryKey: ["admin-actions", clientId],
    queryFn: () => authFetch(`admin/actions.php${qs({ client_id: clientId })}`),
    enabled: clientId != null,
    staleTime: 15 * 1000,
  });
}

export function useSaveAdminAction() {
  const qc = useQueryClient();
  return useMutation<AdminAction, Error, AdminActionInput>({
    mutationFn: (body) => post("admin/actions.php", body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-actions", v.client_id] });
      qc.invalidateQueries({ queryKey: ["decarb-actions"] });
    },
  });
}

export function useDeleteAdminAction() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { client_id: number; id: number }>({
    mutationFn: ({ client_id, id }) => authFetch(`admin/actions.php${qs({ client_id, id })}`, { method: "DELETE" }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-actions", v.client_id] });
      qc.invalidateQueries({ queryKey: ["decarb-actions"] });
    },
  });
}

// ── Client users ──────────────────────────────────────────────────────────────

export interface AdminClientUser {
  id: number;
  email: string;
  display_name: string | null;
  role: "sustainability_team" | "client_uploader" | "client_leadership";
  entity_scope: string | null;
  must_change_password: boolean;
  last_login: string | null;
  created_at: string;
}

export function useAdminClientUsers(clientId: number | null) {
  return useQuery<{ users: AdminClientUser[] }>({
    queryKey: ["admin-client-users", clientId],
    queryFn: () => authFetch(`admin/client-users.php${qs({ client_id: clientId })}`),
    enabled: clientId != null,
    staleTime: 15 * 1000,
  });
}

export function useAdminClientUserAction() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean; temp_password?: string }, Error, {
    client_id: number; action: "update" | "reset_password" | "remove"; user_id: number;
    display_name?: string | null; role?: AdminClientUser["role"]; entity_scope?: string | null;
  }>({
    mutationFn: (body) => post("admin/client-users.php", body),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-client-users", v.client_id] });
      qc.invalidateQueries({ queryKey: ["admin-portfolio"] });
    },
  });
}

// ── Cross-client query inbox + activity ───────────────────────────────────────

export interface InboxThread {
  thread_id: number;
  client_id: number;
  client_name: string;
  source_type: "scope12" | "scope3";
  source_id: string;
  fy: string;
  last_from_role: "client" | "deepwoods";
  waiting_since: string;
  age_days: number;
  preview: string;
  last_author: string;
  message_count: number;
}

export interface InboxParams { status?: "open" | "all"; client_id?: number; page?: number; per_page?: number }

export function useAdminInbox(params: InboxParams) {
  return useQuery<{ total: number; page: number; per_page: number; threads: InboxThread[] }>({
    queryKey: ["admin-inbox", params],
    queryFn: () => authFetch(`admin/inbox.php${qs({ ...params })}`),
    staleTime: 20 * 1000,
    placeholderData: keepPreviousData,
  });
}

export interface ActivityRow {
  id: number;
  client_id: number | null;
  client_name: string | null;
  actor: string;
  action: string;
  detail: string | null;
  created_at: string;
}

export function useAdminActivity(clientId?: number | null, limit = 50) {
  return useQuery<{ activity: ActivityRow[] }>({
    queryKey: ["admin-activity", clientId ?? "all", limit],
    queryFn: () => authFetch(`admin/activity.php${qs({ client_id: clientId, limit })}`),
    staleTime: 20 * 1000,
  });
}

// ── Client Home summary + cycle submit ────────────────────────────────────────

export interface HomeCycle {
  status: CycleState;
  data_due_date: string | null;
  report_due_date: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  days_to_due: number | null;
  overdue: boolean;
}

export interface HomeAlert {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  link: string;
}

export interface HomeSummary {
  fy: string;
  entity: string;
  user: { display_name: string | null };
  cycle: HomeCycle;
  calc: { status: CalcState; calculated_at: string | null; verified_at: string | null; ef_version: string | null };
  consultant: { name: string | null; email: string | null; phone: string | null };
  targets: {
    set: boolean; base_year: string | null; goal_pct: number | null; goal_year: number | null;
    netzero_year: number | null; basis: "market" | "location" | null;
    renewable_target_pct: number | null; residual_strategy: string | null;
  };
  actions: { total: number; by_status: Record<string, number>; planned_abatement_t: number; actual_abatement_t: number };
  alerts: HomeAlert[];
}

export function useHomeSummary(entity: string | undefined, fy: string | undefined, enabled = true) {
  return useQuery<HomeSummary>({
    queryKey: ["home-summary", entity ?? "", fy ?? ""],
    queryFn: () => authFetch(`home-summary.php${qs({ entity, fy })}`),
    enabled: enabled && !!fy,
    staleTime: 30 * 1000,
  });
}

export function useSubmitCycle() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean; cycle: HomeCycle }, Error, { entity: string; fy: string }>({
    mutationFn: (body) => post("cycle-submit.php", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["home-summary"] }); },
  });
}
