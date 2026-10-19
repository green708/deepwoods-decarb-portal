import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageBody, PageHeader } from "@/components/portal";
import { useEntity } from "@/lib/entity";
import { ghgGet, GHG_LIVE } from "@/lib/ghg-config";
import { getRole } from "@/lib/auth";
import {
  Bell, RefreshCw, ExternalLink, CheckCircle2, AlertTriangle,
  Info, FileText, Upload, ShieldCheck, Loader2, Clock,
} from "lucide-react";

const isStaff = (): boolean => { const r = getRole(); return r === "deepwoods_admin" || r === "deepwoods_coordinator"; };

export const Route = createFileRoute("/_app/notifications")({ component: NotificationsPage });

// ── Types ─────────────────────────────────────────────────────────────────────
type NotifType = "info" | "warning" | "error" | "success" | "submission" | "report" | "approval";

interface Notification {
  id: string;
  timestamp: string;
  clientId: string;
  entityName: string;
  type: NotifType;
  message: string;
  driveLink?: string;
  read: boolean;
}

// ── Mock data for demo mode ───────────────────────────────────────────────────
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "n-001",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    clientId: "demo-client",
    entityName: "Entity A",
    type: "report",
    message: "GHG Interim Report generated — 68% complete (13/19 data points). 6 Scope 3 data points are missing. Report saved to Drive and emailed to the team.",
    driveLink: "",
    read: false,
  },
  {
    id: "n-002",
    timestamp: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
    clientId: "demo-client",
    entityName: "Entity A",
    type: "submission",
    message: "GHG data template uploaded for the current reporting period. Consultant has been notified to generate the report.",
    driveLink: "",
    read: false,
  },
  {
    id: "n-003",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    clientId: "demo-client",
    entityName: "Entity A",
    type: "warning",
    message: "Scope 3 data is still missing from the last submission. Cat 1, 4, 6, 7, 9, 11 are required for a complete final report.",
    read: true,
  },
  {
    id: "n-004",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    clientId: "demo-client",
    entityName: "Entity B",
    type: "info",
    message: "New reporting cycle opened. Please download the GHG data template from the Data Submission page and submit by Day 7.",
    read: true,
  },
  {
    id: "n-005",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    clientId: "demo-client",
    entityName: "Entity B",
    type: "approval",
    message: "GHG Final Report approved and delivered to client. Archived in Drive under Approved/.",
    driveLink: "",
    read: true,
  },
];

// ── TypeBadge ─────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<NotifType, { icon: React.ComponentType<{className?: string}>; label: string; cls: string }> = {
  info:       { icon: Info,          label: "Info",       cls: "bg-blue-50 text-blue-700 border-blue-200" },
  warning:    { icon: AlertTriangle, label: "Warning",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
  error:      { icon: AlertTriangle, label: "Error",      cls: "bg-red-50 text-red-700 border-red-200" },
  success:    { icon: CheckCircle2,  label: "Done",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  submission: { icon: Upload,        label: "Submission", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  report:     { icon: FileText,      label: "Report",     cls: "bg-purple-50 text-purple-700 border-purple-200" },
  approval:   { icon: ShieldCheck,   label: "Approved",   cls: "bg-green-50 text-green-700 border-green-200" },
};

function TypeBadge({ type }: { type: NotifType }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cfg.cls}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── localStorage read/unread state ────────────────────────────────────────────
const STORAGE_KEY = "ghg_notif_read";
function getReadIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")); }
  catch { return new Set(); }
}
function markRead(ids: string[]) {
  const existing = getReadIds();
  ids.forEach(id => existing.add(id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing]));
}

// ── Main component ────────────────────────────────────────────────────────────
function NotificationsPage() {
  const { entity } = useEntity();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotifType | "all">("all");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (GHG_LIVE) {
        const data = await ghgGet({ action: "notifications", clientId: entity });
        const readIds = getReadIds();
        const normed: Notification[] = (Array.isArray(data) ? data : data.notifications ?? []).map((n: any, i: number) => ({
          id: n.id ?? String(i),
          timestamp: n.timestamp ?? n.Timestamp ?? new Date().toISOString(),
          clientId: n.clientId ?? n.ClientID ?? "",
          entityName: n.entityName ?? n.Entity ?? "",
          type: (n.type ?? n.Type ?? "info").toLowerCase() as NotifType,
          message: n.message ?? n.Message ?? "",
          driveLink: n.driveLink ?? n["Drive Link"] ?? "",
          read: readIds.has(n.id ?? String(i)),
        }));
        setNotifications(normed);
      } else {
        // Sample notifications are for Deepwoods staff previewing the page; clients never see fake data.
        const readIds = getReadIds();
        setNotifications(isStaff() ? MOCK_NOTIFICATIONS.map(n => ({ ...n, read: readIds.has(n.id) || n.read })) : []);
      }
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => { load(); }, [load]);

  const markAllRead = () => {
    const ids = notifications.map(n => n.id);
    markRead(ids);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markOne = (id: string) => {
    markRead([id]);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const unread = notifications.filter(n => !n.read).length;
  const visible = filter === "all" ? notifications : notifications.filter(n => n.type === filter);

  const filterTypes: Array<NotifType | "all"> = ["all", "submission", "report", "approval", "warning", "info"];

  return (
    <>
      <PageHeader
        eyebrow="Decarbonisation Portal"
        title="Notifications"
        description={
          GHG_LIVE || !isStaff()
            ? "Updates from your reporting cycle — submissions, generated reports, approvals."
            : "Demo mode — configure VITE_GHG_WEBAPP_URL to see live notifications."
        }
        right={
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button onClick={markAllRead}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:bg-[#F3F4F6]">
                Mark all read
              </button>
            )}
            <button onClick={load} disabled={loading}
              className="flex items-center gap-1.5 rounded-md bg-[#1E6F5C] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </button>
          </div>
        }
      />

      <PageBody>
        {/* Status bar */}
        {!GHG_LIVE && isStaff() && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Demo mode</strong> — Showing mock notifications.
              Add <code className="rounded bg-amber-100 px-1 font-mono text-xs">VITE_GHG_WEBAPP_URL=&lt;your_url&gt;</code> to .env.local to go live.
            </span>
          </div>
        )}

        {/* Filter pills */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {filterTypes.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition ${
                filter === t
                  ? "border-[#1E6F5C] bg-[#1E6F5C] text-white"
                  : "border-[var(--border)] bg-white text-[var(--navy)] hover:bg-[#F3F4F6]"
              }`}>
              {t === "all" ? `All (${notifications.length})` : t}
            </button>
          ))}
          {unread > 0 && (
            <button onClick={() => setFilter("all")}
              className="ml-auto flex items-center gap-1 rounded-full border border-[#D90429]/30 bg-[#D90429]/5 px-3 py-1 text-xs font-semibold text-[#D90429]">
              <Bell className="h-3 w-3" />
              {unread} unread
            </button>
          )}
        </div>

        {/* Feed */}
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
            <Bell className="h-10 w-10 opacity-20" />
            <div className="font-semibold">No notifications</div>
            <div className="text-xs">Notifications appear here when reports are generated, submitted, or approved.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(n => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
              const Icon = cfg.icon;
              return (
                <div
                  key={n.id}
                  className={`relative rounded-xl border bg-white p-4 transition ${
                    n.read ? "opacity-75" : "shadow-sm"
                  }`}
                >
                  {/* Unread dot */}
                  {!n.read && (
                    <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-[#D90429]" />
                  )}

                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${cfg.cls}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <TypeBadge type={n.type} />
                        <span className="text-[10px] font-semibold text-muted-foreground">{n.entityName}</span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {relTime(n.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--navy)]">{n.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {n.driveLink && (
                          <a href={n.driveLink} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-semibold text-[#1E6F5C] hover:underline">
                            <ExternalLink className="h-3 w-3" /> View in Drive
                          </a>
                        )}
                        {!n.read && (
                          <button onClick={() => markOne(n.id)}
                            className="text-xs text-muted-foreground hover:text-[var(--navy)] hover:underline">
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {lastFetch && (
          <p className="mt-6 text-center text-[10px] text-muted-foreground">
            Last refreshed {relTime(lastFetch.toISOString())}
          </p>
        )}
      </PageBody>
    </>
  );
}
