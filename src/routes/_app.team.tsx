import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageBody, PageHeader } from "@/components/portal";
import { useTeamMembers, type TeamMember } from "@/lib/api";
import { useClientContext } from "@/lib/client-context";
import { authFetch, getRole, getEmail } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Trash2, Shield, Upload, Eye, Building2,
  Check, X, Loader2, AlertCircle, ChevronRight, Copy,
  Info, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/team")({ component: TeamPage });

// ── Role definitions ──────────────────────────────────────────────────────────

type InviteRole = "sustainability_team" | "entity_admin" | "client_uploader_entity" | "client_uploader" | "client_leadership";

interface RoleDef {
  id: InviteRole;
  dbRole: string;
  label: string;
  badge: string;
  badgeCls: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  permissions: string[];
  needsEntity: boolean;
}

const ROLE_DEFS: RoleDef[] = [
  {
    id: "sustainability_team",
    dbRole: "sustainability_team",
    label: "ESG Manager",
    badge: "ESG",
    badgeCls: "bg-[#E6F4EF] text-[#1E6F5C]",
    icon: Shield,
    description: "Can view all dashboards, manage data submissions, and run the annual GHG cycle.",
    permissions: [
      "All dashboards and analytics",
      "Edit and submit data for all entities",
      "Manage annual inventory cycle",
      "View compliance reports",
    ],
    needsEntity: false,
  },
  {
    id: "entity_admin",
    dbRole: "sustainability_team",
    label: "Entity Admin",
    badge: "Entity Admin",
    badgeCls: "bg-indigo-50 text-indigo-700",
    icon: Building2,
    description: "Full admin access scoped to a single entity. Manages that entity's facilities and invites its own team.",
    permissions: [
      "All dashboards and analytics (scoped entity only)",
      "Manage facilities for their entity",
      "Invite and remove team members for their entity",
      "Edit and submit data for their entity",
    ],
    needsEntity: true,
  },
  {
    id: "client_uploader_entity",
    dbRole: "client_uploader",
    label: "Entity Manager",
    badge: "Entity",
    badgeCls: "bg-purple-50 text-purple-700",
    icon: Building2,
    description: "Scoped to a single entity. Submits data and uploads evidence for their facility.",
    permissions: [
      "Submit activity data (scoped entity only)",
      "Upload evidence documents",
      "View their entity's submissions",
    ],
    needsEntity: true,
  },
  {
    id: "client_uploader",
    dbRole: "client_uploader",
    label: "Data Submitter",
    badge: "Uploader",
    badgeCls: "bg-blue-50 text-blue-700",
    icon: Upload,
    description: "Can submit activity data and upload evidence across all entities.",
    permissions: [
      "Submit activity data",
      "Upload evidence documents",
      "View submission status",
    ],
    needsEntity: false,
  },
  {
    id: "client_leadership",
    dbRole: "client_leadership",
    label: "Viewer",
    badge: "Viewer",
    badgeCls: "bg-slate-100 text-slate-600",
    icon: Eye,
    description: "Read-only access to all dashboards and reports. Cannot submit data.",
    permissions: [
      "View all dashboards",
      "View compliance reports",
      "Read-only — no data submission",
    ],
    needsEntity: false,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function roleDef(dbRole: string, entityScope: string | null): RoleDef {
  if (dbRole === "client_uploader" && entityScope) {
    return ROLE_DEFS.find((r) => r.id === "client_uploader_entity")!;
  }
  if (dbRole === "sustainability_team" && entityScope) {
    return ROLE_DEFS.find((r) => r.id === "entity_admin")!;
  }
  return ROLE_DEFS.find((r) => r.dbRole === dbRole && !r.needsEntity) ?? ROLE_DEFS[0];
}

const inputCls = "w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#1E6F5C] focus:bg-white focus:ring-2 focus:ring-[#1E6F5C]/15";

// ── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({ onClose, entities, restrictToEntity }: {
  onClose: () => void;
  entities: { code: string; name: string }[];
  // Set when the inviter is themselves an entity admin — they can only grant
  // access to their own entity, so org-wide roles are hidden from the picker.
  restrictToEntity?: string | null;
}) {
  const selectableRoles = restrictToEntity
    ? ROLE_DEFS.filter((r) => r.needsEntity)
    : ROLE_DEFS;
  const [step, setStep] = useState<"role" | "details">("role");
  const [selectedRole, setSelectedRole] = useState<RoleDef | null>(null);
  const [email, setEmail] = useState("");
  const [entity, setEntity] = useState(restrictToEntity ?? (entities.length === 1 ? entities[0].code : ""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ email: string; tempPassword: string; emailSent: boolean } | null>(null);
  const qc = useQueryClient();

  const submit = async () => {
    if (!selectedRole || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await authFetch("team.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          role: selectedRole.dbRole,
          entity_scope: selectedRole.needsEntity ? entity || null : null,
        }),
      });
      setSuccess({
        email: email.trim(),
        tempPassword: result.temp_password ?? "",
        emailSent: !!result.email_sent,
      });
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to invite member");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-base font-bold text-[var(--navy)]">
            {step === "role" ? "Select a role" : "Invite team member"}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          /* ── Success ── */
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E6F4EF]">
              <Check className="h-6 w-6 text-[#1E6F5C]" />
            </div>
            <p className="mb-1 text-sm font-bold text-[var(--navy)]">Invitation sent successfully</p>
            <p className="mb-4 text-sm text-slate-500">
              <span className="font-mono font-semibold text-[var(--navy)]">{success.email}</span> has been added to your team.
            </p>

            {success.emailSent ? (
              <div className="mx-auto mb-6 max-w-xs rounded-xl border border-[#C5E4D0] bg-[#F0FAF5] px-4 py-3 text-left">
                <p className="text-xs text-[#1E6F5C]">
                  Login credentials have been emailed to <strong>{success.email}</strong>. They'll be prompted to change their password on first login.
                </p>
              </div>
            ) : (
              <div className="mx-auto mb-6 max-w-xs rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
                <p className="mb-2 text-xs font-semibold text-amber-800">Email delivery failed — share credentials manually</p>
                <p className="mb-1 text-[11px] text-amber-700">Temporary password:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-amber-100 px-2 py-1 font-mono text-sm font-semibold text-amber-900 break-all">
                    {success.tempPassword}
                  </code>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(success!.tempPassword); toast.success("Copied to clipboard"); }}
                    className="shrink-0 rounded p-1 text-amber-600 hover:bg-amber-200"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-amber-600">
                  Send this to {success.email}. They'll be prompted to set a new password on first login.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50">
                Done
              </button>
              <button
                onClick={() => { setSuccess(null); setEmail(""); setStep("role"); setSelectedRole(null); }}
                className="flex-1 rounded-lg bg-[#1E6F5C] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                Invite another
              </button>
            </div>
          </div>
        ) : step === "role" ? (
          /* ── Step 1: Role selection ── */
          <div className="p-4">
            <div className="space-y-2">
              {selectableRoles.map((rd) => {
                const Icon = rd.icon;
                return (
                  <button
                    key={rd.id}
                    onClick={() => { setSelectedRole(rd); setStep("details"); }}
                    className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition-all hover:border-[#1E6F5C]/40 hover:bg-[#F0FAF5]/60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <Icon className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[var(--navy)]">{rd.label}</p>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${rd.badgeCls}`}>{rd.badge}</span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{rd.description}</p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── Step 2: Email + entity ── */
          <div className="p-6">
            {/* Role reminder */}
            {selectedRole && (
              <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <span className={`rounded px-2 py-0.5 text-xs font-bold ${selectedRole.badgeCls}`}>{selectedRole.badge}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--navy)]">{selectedRole.label}</p>
                  <ul className="mt-1 space-y-0.5">
                    {selectedRole.permissions.map((p) => (
                      <li key={p} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-[#1E6F5C]" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <button onClick={() => setStep("role")} className="text-xs text-slate-400 hover:text-[#1E6F5C]">
                  Change
                </button>
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Email address
                </label>
                <input
                  type="email"
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="team@company.com"
                  autoFocus
                />
              </div>

              {selectedRole?.needsEntity && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Entity scope
                  </label>
                  <select
                    className={inputCls + " cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"}
                    value={entity}
                    onChange={(e) => setEntity(e.target.value)}
                    disabled={!!restrictToEntity}
                  >
                    <option value="">Select entity</option>
                    {entities.map((e) => (
                      <option key={e.code} value={e.code}>{e.code}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {restrictToEntity
                      ? "Locked to your own entity — you can't grant access beyond it."
                      : "This person will only see data for the selected entity."}
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-xl border border-[#C5E4D0] bg-[#F0FAF5] px-3 py-2.5">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1E6F5C]" />
                <p className="text-[11px] leading-relaxed text-[#1E6F5C]">
                  A secure temporary password will be generated and emailed to them. If email delivery fails, credentials will be shown here for manual sharing.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={() => setStep("role")} className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-slate-50">
                Back
              </button>
              <button
                onClick={submit}
                disabled={!email.trim() || (selectedRole?.needsEntity && !entity) || submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#1E6F5C] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:brightness-110"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Send invitation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────

function MemberRow({ member, onRemove, isSelf }: {
  member: TeamMember; onRemove: (id: number) => void; isSelf: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const rd = roleDef(member.role, member.entity_scope);
  const Icon = rd.icon;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6F4EF]">
        <Icon className="h-4 w-4 text-[#1E6F5C]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-[var(--navy)]">{member.email}</p>
          {isSelf && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">YOU</span>}
          {member.must_change_password && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
              First login pending
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${rd.badgeCls}`}>
            {rd.badge}
          </span>
          {member.entity_scope && (
            <span className="text-[11px] text-slate-400">· {member.entity_scope} only</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="hidden text-[11px] text-slate-400 sm:block">
          Added {new Date(member.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
        {!isSelf && (
          confirming ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onRemove(member.id)}
                className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
              >
                Confirm remove
              </button>
              <button onClick={() => setConfirming(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
              title="Remove member"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function TeamPage() {
  const navigate = useNavigate();
  const role = getRole();
  const ctx = useClientContext();
  const { data: members, isLoading, error, refetch } = useTeamMembers();
  const [showInvite, setShowInvite] = useState(false);
  const qc = useQueryClient();

  // Only sustainability_team may manage the team
  if (role !== "sustainability_team") {
    return (
      <>
        <PageHeader eyebrow="Team" title="My Team" />
        <PageBody>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center">
            <Shield className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-semibold text-slate-600">Access restricted</p>
            <p className="mt-1 text-sm text-slate-400">Only ESG Managers and Owners can manage the team.</p>
          </div>
        </PageBody>
      </>
    );
  }

  const selfEmail = getEmail();
  const nonConsolidatedEntities = ctx.entities.filter((e) => !e.is_consolidated);

  const remove = async (id: number) => {
    try {
      await authFetch(`team.php?id=${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["team"] });
      toast.success("Team member removed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not remove member");
    }
  };

  const grouped = useMemo(() => {
    const list = members ?? [];
    return {
      owners:    list.filter((m) => m.role === "sustainability_team"),
      uploaders: list.filter((m) => m.role === "client_uploader"),
      viewers:   list.filter((m) => m.role === "client_leadership"),
    };
  }, [members]);

  return (
    <>
      <PageHeader
        eyebrow="Team Management"
        title="My Team"
        description="Manage who has access to your Decarbonisation Portal. Team changes take effect immediately."
      />
      <PageBody>
        {/* ── Action bar ─────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users className="h-4 w-4" />
            <span>
              {isLoading ? "Loading…" : `${members?.length ?? 0} team member${(members?.length ?? 0) !== 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/home"
              className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-xs font-medium text-[var(--navy)] hover:bg-slate-50"
            >
              Back to workspace
            </Link>
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#1E6F5C] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-110"
            >
              <Plus className="h-3.5 w-3.5" />
              Invite member
            </button>
          </div>
        </div>

        {/* ── Error / loading ─────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <p className="flex-1 text-sm text-red-700">Failed to load team members.</p>
            <button onClick={() => refetch()} className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800">
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-[#1E6F5C]" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ESG Managers / Owners */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-[#1E6F5C]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E6F5C]">
                  ESG Managers &amp; Owners
                </span>
                <span className="ml-1 text-[11px] text-slate-400">sustainability_team</span>
              </div>
              {grouped.owners.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
                  No ESG managers yet
                </div>
              ) : (
                <div className="space-y-2">
                  {grouped.owners.map((m) => (
                    <MemberRow key={m.id} member={m} onRemove={remove} isSelf={m.email === selfEmail} />
                  ))}
                </div>
              )}
            </section>

            {/* Data Submitters + Entity Managers */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <Upload className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Data Submitters &amp; Entity Managers
                </span>
                <span className="ml-1 text-[11px] text-slate-400">client_uploader</span>
              </div>
              {grouped.uploaders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
                  No data submitters yet — invite one to start collecting data
                </div>
              ) : (
                <div className="space-y-2">
                  {grouped.uploaders.map((m) => (
                    <MemberRow key={m.id} member={m} onRemove={remove} isSelf={m.email === selfEmail} />
                  ))}
                </div>
              )}
            </section>

            {/* Viewers */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Viewers</span>
                <span className="ml-1 text-[11px] text-slate-400">client_leadership</span>
              </div>
              {grouped.viewers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400">
                  No viewers yet
                </div>
              ) : (
                <div className="space-y-2">
                  {grouped.viewers.map((m) => (
                    <MemberRow key={m.id} member={m} onRemove={remove} isSelf={m.email === selfEmail} />
                  ))}
                </div>
              )}
            </section>

            {/* How team access works */}
            <section className="rounded-2xl border bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">How team access works</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {ROLE_DEFS.map((rd) => {
                  const Icon = rd.icon;
                  return (
                    <div key={rd.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                      <div className="mb-1.5 flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-[var(--navy)]">{rd.label}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${rd.badgeCls}`}>{rd.badge}</span>
                      </div>
                      <ul className="space-y-0.5">
                        {rd.permissions.map((p) => (
                          <li key={p} className="flex items-start gap-1.5 text-[11px] text-slate-500">
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-[#1E6F5C]" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        )}
      </PageBody>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          entities={nonConsolidatedEntities.map((e) => ({ code: e.code, name: e.name }))}
          restrictToEntity={ctx.user?.entity_scope ?? null}
        />
      )}
    </>
  );
}
