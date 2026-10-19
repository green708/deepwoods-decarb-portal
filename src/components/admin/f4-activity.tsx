import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAdminActivity, type ActivityRow } from "@/lib/api-admin";
import { EmptyHint, ErrorNote, SECONDARY_BTN, Spinner, fmtDate, timeAgo, INPUT } from "@/components/admin/ui";

export const SETTING_LABEL: Record<string, string> = {
  base_year_s12: "Scope 1 & 2 base year",
  base_year_s3: "Scope 3 base year",
  sbti_target_s12: "Scope 1 & 2 reduction target",
  sbti_target_s3: "Scope 3 reduction target",
  sbti_target_year: "Target year",
  netzero_year: "Net-zero year",
  target_basis: "Accounting basis",
  residual_strategy: "Residual emissions strategy",
  renewable_target_pct: "Renewable energy target",
  consultant_name: "Consultant name",
  consultant_email: "Consultant email",
  consultant_phone: "Consultant phone",
  support_email: "Support email",
  current_fy: "Current reporting year",
  account_owner: "Account owner",
};

const ACTION_LABEL: Record<string, string> = {
  settings_updated: "Updated client settings",
  calc_status: "Calculation status changed",
  cycle_updated: "Updated reporting cycle",
  cycle_reopened: "Reopened reporting cycle",
  cycle_locked: "Locked reporting cycle",
  cycle_submitted: "Client submitted data",
  action_created: "Added a decarbonisation action",
  action_updated: "Updated a decarbonisation action",
  action_deleted: "Deleted a decarbonisation action",
  user_updated: "Updated a user",
  user_removed: "Removed a user",
  user_password_reset: "Reset a user password",
  password_reset: "Reset a user password",
  user_invited: "Invited a user",
  client_activated: "Activated the account",
  client_deactivated: "Deactivated the account",
  payment_updated: "Updated payment details",
  branding_updated: "Updated branding",
};

export function actionLabel(action: string): string {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  const s = action.replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Activity";
}

export function describeDetail(row: ActivityRow): string {
  const d = row.detail ?? "";
  if (!d) return "";
  if (row.action === "settings_updated") {
    return d.split(",").map((k) => k.trim()).filter(Boolean).map((k) => SETTING_LABEL[k] ?? k.replace(/_/g, " ")).join(", ");
  }
  return d;
}

export function ActivityFeed({ clientId, showClient }: { clientId?: number | null; showClient?: boolean }) {
  const [limit, setLimit] = useState(50);
  const [filter, setFilter] = useState("");
  const q = useAdminActivity(clientId, limit);
  const rows = q.data?.activity ?? [];
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return rows;
    return rows.filter((r) => `${r.actor} ${actionLabel(r.action)} ${describeDetail(r)} ${r.client_name ?? ""}`.toLowerCase().includes(f));
  }, [rows, filter]);

  if (q.isLoading) return <Spinner label="Loading activity" />;
  if (q.error) return <ErrorNote error={q.error} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <input className={INPUT} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by person, action or detail" aria-label="Filter activity" />
        </div>
        <button type="button" className={`${SECONDARY_BTN} ml-auto !py-1.5`} onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyHint title="No activity recorded yet">
          Changes made by Deepwoods staff, such as settings, calculation status and reporting cycles, appear here.
        </EmptyHint>
      ) : shown.length === 0 ? (
        <EmptyHint title="No matching activity">Try a different filter.</EmptyHint>
      ) : (
        <ol className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {shown.map((r) => {
            const detail = describeDetail(r);
            return (
              <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--navy)]">
                    {actionLabel(r.action)}
                    {showClient && r.client_name && <span className="ml-2 text-xs font-medium text-muted-foreground">{r.client_name}</span>}
                  </p>
                  {detail && <p className="mt-0.5 break-words text-xs text-muted-foreground">{detail}</p>}
                  <p className="mt-0.5 break-all text-[11px] text-muted-foreground">{r.actor}</p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground" dateTime={r.created_at} title={fmtDate(r.created_at)}>
                  {timeAgo(r.created_at)}
                </time>
              </li>
            );
          })}
        </ol>
      )}

      {rows.length >= limit && (
        <div className="flex justify-center">
          <button type="button" className={SECONDARY_BTN} onClick={() => setLimit((l) => l + 50)} disabled={q.isFetching}>Show older activity</button>
        </div>
      )}
    </div>
  );
}
