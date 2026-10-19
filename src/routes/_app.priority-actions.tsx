import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageBody, PageHeader } from "@/components/portal";
import { AlertCircle, RefreshCw, ChevronRight, Mail, Bell, BellOff, Clock, Calendar, Send, CheckCircle2, Loader2 } from "lucide-react";
import { usePriorityItems } from "@/lib/api";
import { useEntity, useFiscalYear } from "@/lib/entity";
import { useHomeSummary } from "@/lib/api-admin";
import { useClientContext } from "@/lib/client-context";
import { getToken, getEmail, isDemo } from "@/lib/auth";

export const Route = createFileRoute("/_app/priority-actions")({ component: PriorityActions });

type TabId = "action-needed" | "updates" | "email-settings";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "action-needed",  label: "Action Needed",  icon: <AlertCircle className="h-4 w-4" /> },
  { id: "updates",        label: "Updates",         icon: <RefreshCw className="h-4 w-4" /> },
  { id: "email-settings", label: "Email Settings",  icon: <Mail className="h-4 w-4" /> },
];

type Frequency = "daily" | "weekly" | "monthly" | "custom";

type NotifPrefs = {
  enabled:         boolean;
  frequency:       Frequency;
  custom_date:     string | null;
  send_time:       string;
  include_actions: boolean;
  include_updates: boolean;
  last_sent_at:    string | null;
};


const P_CHIP: Record<string, string> = {
  High:   "bg-[#FEE2E2] text-[#D90429]",
  Medium: "bg-amber-50 text-amber-600",
  Low:    "bg-muted text-muted-foreground",
};

const TAG_CHIP: Record<string, string> = {
  Milestone: "bg-[#E6F4EF] text-[#1E6F5C]",
  Target:    "bg-purple-50 text-purple-700",
  Report:    "bg-[#EFF6FF] text-[var(--navy)]",
};

const FREQ_OPTIONS: { value: Frequency; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "daily",   label: "Daily",          desc: "Sent every morning at your chosen time",             icon: <Clock className="h-4 w-4" /> },
  { value: "weekly",  label: "Weekly",         desc: "Sent once a week (rolling 7-day cadence)",           icon: <Bell className="h-4 w-4" /> },
  { value: "monthly", label: "Monthly",        desc: "Sent once a month (rolling 30-day cadence)",         icon: <RefreshCw className="h-4 w-4" /> },
  { value: "custom",  label: "Specific date",  desc: "Send on one particular date you pick on a calendar", icon: <Calendar className="h-4 w-4" /> },
];

function EntityChip({ e }: { e: string }) {
  if (e === "All") return null;
  return <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-[var(--navy)]">{e}</span>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`h-6 w-11 rounded-full transition-colors ${checked ? "bg-[#1E6F5C]" : "bg-slate-200"}`} />
        <div className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </div>
      <span className="text-sm font-medium text-[var(--navy)]">{label}</span>
    </label>
  );
}

function PriorityActions() {
  const { entity } = useEntity();
  const { entities } = useClientContext();
  const { fy } = useFiscalYear();
  const { data: priorityData } = usePriorityItems(entity);
  const { data: summary } = useHomeSummary(entity, fy);
  const consolidatedCode = entities.find(e => e.is_consolidated)?.code;
  const [tab, setTab] = useState<TabId>("action-needed");

  // Email settings state
  const [prefs, setPrefs]       = useState<NotifPrefs | null>(null);
  const [saving, setSaving]     = useState(false);
  const [sending, setSending]   = useState(false);
  const [saveMsg, setSaveMsg]   = useState<string | null>(null);
  const [sendMsg, setSendMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading]   = useState(false);

  const userEmail = getEmail() ?? "your account";

  const fetchPrefs = useCallback(async () => {
    if (isDemo()) {
      setPrefs({ enabled: true, frequency: "weekly", custom_date: null, send_time: "08:00", include_actions: true, include_updates: true, last_sent_at: null });
      return;
    }
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch("/backend/api/notification-prefs.php", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setPrefs(data.prefs);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (tab === "email-settings") fetchPrefs(); }, [tab, fetchPrefs]);

  async function savePrefs() {
    if (!prefs) return;
    setSaving(true); setSaveMsg(null);
    if (isDemo()) { await new Promise(r => setTimeout(r, 600)); setSaving(false); setSaveMsg("Saved (demo mode)"); return; }
    try {
      const res = await fetch("/backend/api/notification-prefs.php", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const data = await res.json();
      setSaveMsg(data.ok ? "Preferences saved ✓" : data.error ?? "Save failed");
    } catch { setSaveMsg("Network error"); } finally { setSaving(false); }
  }

  async function sendNow() {
    setSending(true); setSendMsg(null);
    if (isDemo()) {
      await new Promise(r => setTimeout(r, 800));
      setSending(false);
      setSendMsg({ ok: true, text: "Email would be sent in production (demo mode)" });
      return;
    }
    try {
      const res = await fetch("/backend/api/send-notification.php", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setSendMsg({ ok: !!data.ok, text: data.ok ? `Email sent to ${userEmail}` : (data.error ?? "Send failed") });
      if (data.ok) { fetchPrefs(); }
    } catch { setSendMsg({ ok: false, text: "Network error" }); } finally { setSending(false); }
  }

  const live = (summary?.alerts ?? []).map((a) => ({
    id: -1 - Math.abs([...a.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)),
    type: a.severity === "low" ? ("update" as const) : ("action" as const),
    entity: entity,
    title: a.title,
    detail: a.detail,
    priority: a.severity === "high" ? ("High" as const) : a.severity === "medium" ? ("Medium" as const) : ("Low" as const),
    link: a.link,
    age: "Right now",
    tag: null as string | null,
  }));
  const allItems = [...live, ...(priorityData ?? [])];
  const actions = allItems.filter(i => i.type === "action").filter(a => entity === consolidatedCode || a.entity === "All" || a.entity === entity);
  const updates = allItems.filter(i => i.type === "update").filter(u => entity === consolidatedCode || u.entity === "All" || u.entity === entity);
  const highCount = actions.filter(a => a.priority === "High").length;

  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Alert Centre"
        description="Current priorities and updates — filtered by the entity you're viewing."
      />
      <PageBody>
        {/* Tabs */}
        <div className="mb-6 flex gap-0 border-b border-slate-200">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.id ? "border-[var(--navy)] text-[var(--navy)]" : "border-transparent text-muted-foreground hover:text-[var(--navy)]"
              }`}>
              {t.icon}{t.label}
              {t.id === "action-needed" && highCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D90429] px-1.5 text-[10px] font-bold text-white">{highCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── ACTION NEEDED ── */}
        {tab === "action-needed" && (
          <div className="space-y-2">
            {actions.length === 0 && (
              <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-[#1E6F5C]" />
                <p className="text-sm font-semibold text-[var(--navy)]">You're all caught up</p>
                <p className="mt-1 text-xs text-muted-foreground">Nothing needs your attention right now. We'll flag overdue data, replies from Deepwoods and reviews here.</p>
              </div>
            )}
            {actions.map(item => (
              <div key={item.id} className="flex items-start gap-4 rounded-xl border bg-card p-4 hover:border-slate-300 transition">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FEE2E2]">
                  <AlertCircle className="h-4 w-4 text-[#D90429]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--navy)]">{item.title}</span>
                    <EntityChip e={item.entity} />
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${P_CHIP[item.priority ?? ""]}`}>{item.priority}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{item.age}</div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <a href={item.link} className="shrink-0 flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:bg-muted">
                  Go to <ChevronRight className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}

        {/* ── UPDATES ── */}
        {tab === "updates" && (
          <div className="space-y-2">
            {updates.length === 0 && (
              <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
                <RefreshCw className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-semibold text-[var(--navy)]">No updates yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Verified results, new reports and changes to your plan will show up here.</p>
              </div>
            )}
            {updates.map(item => (
              <div key={item.id} className="flex items-start gap-4 rounded-xl border bg-card p-4 hover:border-slate-300 transition">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF]">
                  <RefreshCw className="h-4 w-4 text-[var(--navy)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--navy)]">{item.title}</span>
                    <EntityChip e={item.entity} />
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TAG_CHIP[item.tag ?? ""] ?? "bg-muted text-muted-foreground"}`}>{item.tag}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{item.age}</div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <a href={item.link} className="shrink-0 flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:bg-muted">
                  Go to <ChevronRight className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}

        {/* ── EMAIL SETTINGS ── */}
        {tab === "email-settings" && (
          <div className="space-y-6">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
              </div>
            )}

            {prefs && !loading && (
              <>
                {/* Master toggle */}
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${prefs.enabled ? "bg-[#E6F4EF]" : "bg-slate-100"}`}>
                        {prefs.enabled ? <Bell className="h-5 w-5 text-[#1E6F5C]" /> : <BellOff className="h-5 w-5 text-slate-400" />}
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--navy)]">Email notifications</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Sending to <b>{userEmail}</b></div>
                      </div>
                    </div>
                    <Toggle checked={prefs.enabled} onChange={v => setPrefs(p => p ? { ...p, enabled: v } : p)} label="" />
                  </div>

                  {prefs.last_sent_at && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#1E6F5C]" />
                      Last sent: {new Date(prefs.last_sent_at).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Frequency */}
                <div className={`rounded-xl border bg-card p-5 space-y-4 transition-opacity ${!prefs.enabled ? "opacity-40 pointer-events-none" : ""}`}>
                  <div className="font-semibold text-sm text-[var(--navy)] mb-1">Reminder frequency</div>
                  <div className="grid grid-cols-2 gap-2">
                    {FREQ_OPTIONS.map(opt => (
                      <button key={opt.value}
                        onClick={() => setPrefs(p => p ? { ...p, frequency: opt.value } : p)}
                        className={`rounded-lg border p-3 text-left transition-all ${
                          prefs.frequency === opt.value
                            ? "border-[#1E6F5C] bg-[#E6F4EF]"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}>
                        <div className={`flex items-center gap-2 mb-1 ${prefs.frequency === opt.value ? "text-[#1E6F5C]" : "text-[var(--navy)]"}`}>
                          {opt.icon}
                          <span className="text-sm font-semibold">{opt.label}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-tight">{opt.desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* Custom date picker */}
                  {prefs.frequency === "custom" && (
                    <div className="mt-2">
                      <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5">Pick a date</label>
                      <input type="date"
                        value={prefs.custom_date ?? ""}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={e => setPrefs(p => p ? { ...p, custom_date: e.target.value || null } : p)}
                        className="rounded-lg border px-3 py-2 text-sm text-[var(--navy)] focus:outline-none focus:ring-2 focus:ring-[#1E6F5C]"
                      />
                    </div>
                  )}

                  {/* Send time */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--navy)] mb-1.5">
                      Preferred send time <span className="font-normal text-muted-foreground">(IST)</span>
                    </label>
                    <input type="time"
                      value={prefs.send_time?.slice(0, 5) ?? "08:00"}
                      onChange={e => setPrefs(p => p ? { ...p, send_time: e.target.value } : p)}
                      className="rounded-lg border px-3 py-2 text-sm text-[var(--navy)] focus:outline-none focus:ring-2 focus:ring-[#1E6F5C]"
                    />
                  </div>
                </div>

                {/* Content toggles */}
                <div className={`rounded-xl border bg-card p-5 space-y-4 transition-opacity ${!prefs.enabled ? "opacity-40 pointer-events-none" : ""}`}>
                  <div className="font-semibold text-sm text-[var(--navy)] mb-2">What to include</div>
                  <Toggle
                    checked={prefs.include_actions}
                    onChange={v => setPrefs(p => p ? { ...p, include_actions: v } : p)}
                    label="Action Needed items (urgent alerts)"
                  />
                  <Toggle
                    checked={prefs.include_updates}
                    onChange={v => setPrefs(p => p ? { ...p, include_updates: v } : p)}
                    label="Updates (milestones & report deliveries)"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={savePrefs} disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1a3d56] disabled:opacity-60 transition">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {saving ? "Saving…" : "Save preferences"}
                  </button>

                  <button onClick={sendNow} disabled={sending}
                    className="flex items-center gap-2 rounded-lg border border-[#1E6F5C] bg-white px-5 py-2.5 text-sm font-semibold text-[#1E6F5C] hover:bg-[#E6F4EF] disabled:opacity-60 transition">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? "Sending…" : "Send now"}
                  </button>

                  {saveMsg && (
                    <div className="text-sm text-[#1E6F5C] font-medium">{saveMsg}</div>
                  )}
                </div>

                {sendMsg && (
                  <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
                    sendMsg.ok ? "border-[#1E6F5C] bg-[#E6F4EF] text-[#1E6F5C]" : "border-[#D90429] bg-[#FEE2E2] text-[#D90429]"
                  }`}>
                    {sendMsg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {sendMsg.text}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </PageBody>
    </>
  );
}
