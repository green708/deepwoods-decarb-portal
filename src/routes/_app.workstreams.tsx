import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageBody, PageHeader, Card } from "@/components/portal";
import { useClientContext } from "@/lib/client-context";
import { useFacilities } from "@/lib/api";
import { useEntity } from "@/lib/entity";
import { ChevronDown, ChevronRight, Building2, MapPin, CalendarRange, Zap, Sun, Settings, ArrowRight, Users, FileUp } from "lucide-react";
import { getRole } from "@/lib/auth";
import { CLUSTERS, type ClusterStatus } from "@/data/master";

export const Route = createFileRoute("/_app/workstreams")({
  validateSearch: (search: Record<string, unknown>): { cluster?: number } => ({
    cluster: search["cluster"] != null ? Number(search["cluster"]) : undefined,
  }),
  component: Workstreams,
});

const DOT: Record<ClusterStatus, string> = {
  active:  "bg-[var(--success)]",
  partial: "bg-[var(--warning)]",
  none:    "bg-slate-300",
};

const RING: Record<ClusterStatus, string> = {
  active:  "ring-2 ring-[var(--success)]/30 border-[var(--success)]/50",
  partial: "ring-2 ring-[var(--warning)]/30 border-[var(--warning)]/50",
  none:    "border-slate-200",
};

const STATUS_BADGE: Record<ClusterStatus, string> = {
  active:  "text-[var(--success)] bg-emerald-50",
  partial: "text-amber-600 bg-amber-50",
  none:    "text-slate-500 bg-slate-100",
};

const STATUS_LABEL: Record<ClusterStatus, string> = {
  active:  "Active",
  partial: "Partial",
  none:    "Available",
};

const TIER_LABELS: Record<string, string> = {
  A: "Assessment",
  B: "Analysis",
  C: "Delivery",
  D: "Strategy",
};

// Facility detail cards

function Workstreams() {
  const navigate = useNavigate();
  const { entity } = useEntity();
  const { cluster: urlClusterId } = Route.useSearch();
  const ctx = useClientContext();
  const { data: facilitiesData } = useFacilities();
  const entityShort = (code: string) => ctx.entities.find(e => e.code === code)?.short ?? code;
  const entityName  = (code: string) => ctx.entities.find(e => e.code === code)?.name  ?? code;

  const validCluster = CLUSTERS.find((c) => c.n === urlClusterId);
  const initialCluster = validCluster?.n ?? CLUSTERS[0].n;

  const [selectedCluster, setSelectedCluster] = useState(initialCluster);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<Record<string, string>>({});

  useEffect(() => {
    const valid = CLUSTERS.find((c) => c.n === urlClusterId);
    const cid = valid?.n ?? CLUSTERS[0].n;
    if (cid !== selectedCluster) {
      setSelectedCluster(cid);
      setOpenSub(null);
    }
  }, [urlClusterId]);

  const cluster = CLUSTERS.find((c) => c.n === selectedCluster)!;

  const handleClusterSelect = (n: number) => {
    setSelectedCluster(n);
    setOpenSub(null);
    navigate({ to: "/workstreams", search: { cluster: n } });
  };

  const getTier = (subId: string, tiers: object) =>
    activeTier[subId] ?? Object.keys(tiers)[0];

  const setTier = (subId: string, tier: string) =>
    setActiveTier((prev) => ({ ...prev, [subId]: tier }));

  const consolidatedEntity = ctx.entities.find(e => e.is_consolidated)?.code;
  const facilities = (facilitiesData ?? []).filter(f => entity === consolidatedEntity || f.entity === entity);

  const setupComplete = ctx.config?.setup_complete === "true";
  const role = getRole();
  const isOwner = role === "sustainability_team";
  const [teamBannerDismissed, setTeamBannerDismissed] = useState(
    () => localStorage.getItem("decarb_team_banner_dismissed") === "1"
  );
  const dismissTeamBanner = () => {
    localStorage.setItem("decarb_team_banner_dismissed", "1");
    setTeamBannerDismissed(true);
  };
  const [dataCollectionBannerDismissed, setDataCollectionBannerDismissed] = useState(
    () => localStorage.getItem("decarb_data_collection_dismissed") === "1"
  );
  const dismissDataCollectionBanner = () => {
    localStorage.setItem("decarb_data_collection_dismissed", "1");
    setDataCollectionBannerDismissed(true);
  };

  return (
    <>
      <PageHeader
        eyebrow="Active Engagements"
        title="Carbon Clusters"
        description="Your sustainability service clusters — select a cluster to explore its workstreams and delivery tiers."
      />
      <PageBody>

        {/* ── Setup banner — shown until boundary wizard is complete ── */}
        {!setupComplete && (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#1E6F5C]/25 bg-gradient-to-r from-[#E6F4EF] to-[#F0FAF5] p-5 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1E6F5C]">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#1E4D2B]">Configure your GHG workspace</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#1E6F5C]">
                Define your organisation boundary, entities in scope, and emissions sources to activate dashboards and data collection.
              </p>
            </div>
            <button
              onClick={() => navigate({ to: "/setup" })}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-[#1E6F5C] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:brightness-110"
            >
              Start boundary setup
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Team setup prompt — shown after boundary setup, dismissible ─ */}
        {setupComplete && isOwner && !teamBannerDismissed && (
          <div className="mb-4 flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <Users className="h-5 w-5 shrink-0 text-blue-500" />
            <p className="flex-1 text-sm text-blue-700">
              <span className="font-semibold">Invite your team</span> — add ESG managers, data submitters, and viewers.
            </p>
            <button
              onClick={() => navigate({ to: "/team" })}
              className="shrink-0 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Set up team
            </button>
            <button
              onClick={dismissTeamBanner}
              className="shrink-0 text-xs font-medium text-blue-400 hover:text-blue-600"
            >
              Later
            </button>
          </div>
        )}

        {/* ── Data collection nudge — shown after setup complete, dismissible ── */}
        {setupComplete && isOwner && !dataCollectionBannerDismissed && (
          <div className="mb-4 flex items-center gap-4 rounded-xl border border-[#1E6F5C]/30 bg-[#E6F4EF]/60 px-4 py-3">
            <FileUp className="h-5 w-5 shrink-0 text-[#1E6F5C]" />
            <p className="flex-1 text-sm text-[#1E4D2B]">
              <span className="font-semibold">Start collecting data</span> — download templates, fill in your Scope 1, 2 & 3 activity data, and upload.
            </p>
            <button
              onClick={() => navigate({ to: "/submissions" })}
              className="shrink-0 rounded-lg bg-[#1E6F5C] px-3.5 py-1.5 text-xs font-semibold text-white hover:brightness-110"
            >
              Go to data collection
            </button>
            <button
              onClick={dismissDataCollectionBanner}
              className="shrink-0 text-xs font-medium text-[#1E6F5C]/60 hover:text-[#1E6F5C]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Cluster selector tabs ─────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CLUSTERS.map((c) => {
            const active = c.n === selectedCluster;
            return (
              <button
                key={c.n}
                onClick={() => handleClusterSelect(c.n)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                  active
                    ? "border-[var(--navy)] bg-[var(--navy)] text-white shadow-lg"
                    : "border-slate-200 bg-card hover:border-[var(--navy-2)] hover:shadow-sm"
                }`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${active ? "bg-white/70" : DOT[c.status]}`} />
                <span>
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${active ? "text-white/60" : "text-muted-foreground"}`}>
                    Cluster {c.n}
                  </div>
                  <div className={`text-sm font-semibold leading-snug ${active ? "text-white" : "text-[var(--navy)]"}`}>
                    {c.name}
                  </div>
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Cluster header ───────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cluster {cluster.n}</div>
            <div className="font-bold text-xl tabular-nums text-[var(--navy)]">{cluster.name}</div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${STATUS_BADGE[cluster.status]}`}>
            {STATUS_LABEL[cluster.status]}
          </span>
        </div>

        {/* ── Legend ───────────────────────────────────────────────── */}
        <div className="mb-4 flex flex-wrap gap-4 rounded-lg border bg-card px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--success)]" /> Active &amp; Delivering</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--warning)]" /> Partial / In Development</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" /> Available — Not in Scope</span>
        </div>

        {/* ── Sub-cluster list ─────────────────────────────────────── */}
        {cluster.subs.length === 0 ? (
          <Card>
            <div className="py-8 text-center text-sm text-muted-foreground">
              <div className="mb-1 font-bold text-lg tabular-nums text-[var(--navy)]">
                Cluster {cluster.n} — {cluster.name}
              </div>
              Reserved for future scale-up. Not currently populated.
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {cluster.subs.map((sub) => {
              const isOpen = openSub === sub.id;
              const hasTiers = !!sub.tiers && Object.keys(sub.tiers).length > 0;
              const tierKeys = sub.tiers ? Object.keys(sub.tiers) : [];
              const curTier = hasTiers ? getTier(sub.id, sub.tiers!) : null;
              const tierData = curTier && sub.tiers
                ? sub.tiers[curTier as keyof typeof sub.tiers]
                : null;

              return (
                <div
                  key={sub.id}
                  className={`overflow-hidden rounded-xl border bg-card transition-all ${
                    isOpen ? RING[sub.status] : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <button
                    onClick={() => setOpenSub((prev) => (prev === sub.id ? null : sub.id))}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[sub.status]}`} />
                    <span className="flex-1 min-w-0">
                      <span className="text-[11px] font-bold text-muted-foreground">{sub.id}</span>
                      <span className="ml-2 text-sm font-semibold text-[var(--navy)]">{sub.name}</span>
                    </span>
                    <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-flex ${STATUS_BADGE[sub.status]}`}>
                      {STATUS_LABEL[sub.status]}
                    </span>
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    }
                  </button>

                  {isOpen && (
                    <div className="border-t px-4 pb-5 pt-4">
                      {sub.note && (
                        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{sub.note}</p>
                      )}

                      {hasTiers ? (
                        <>
                          <div className="mb-4 flex flex-wrap gap-1.5">
                            {tierKeys.map((k) => (
                              <button
                                key={k}
                                onClick={() => setTier(sub.id, k)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                  curTier === k
                                    ? "bg-[var(--navy)] text-white shadow-sm"
                                    : "border border-slate-200 bg-white text-muted-foreground hover:border-[var(--navy-2)] hover:text-[var(--navy)]"
                                }`}
                              >
                                <span className="mr-1 font-black">{k}</span>
                                {TIER_LABELS[k] ?? k}
                              </button>
                            ))}
                          </div>

                          {tierData && (
                            <div className="rounded-lg border-l-4 border-[var(--navy-2)] bg-[color-mix(in_oklab,var(--navy-2)_5%,white)] px-4 py-3">
                              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--navy-2)]">
                                {tierData.label}
                              </div>
                              <ul className="space-y-1.5">
                                {tierData.items.map((item: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2 text-sm">
                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--navy-2)]" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm italic text-muted-foreground">
                          Not currently part of your active engagement. Contact your Deepwoods account manager to discuss adding this service.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Organisation snapshot ────────────────────────────────── */}
        <div className="mt-8">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Organisation</div>
          <h2 className="mb-4 font-bold text-xl tabular-nums text-[var(--navy)]">Organisation snapshot — {entityShort(entity)}</h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <div className="rounded-xl border bg-white p-5">
              <Building2 className="mb-2 h-5 w-5 text-[var(--navy-2)]" />
              <div className="font-bold tabular-nums text-[var(--navy)]">{entityName(entity)}</div>
              <p className="mt-1 text-sm text-muted-foreground">{ctx.client.name}</p>
            </div>
            <div className="rounded-xl border bg-white p-5">
              <MapPin className="mb-2 h-5 w-5 text-[var(--navy-2)]" />
              <div className="font-bold tabular-nums text-[var(--navy)]">{(facilitiesData ?? []).filter(f => f.entity === entity).length} facilities in boundary</div>
              <p className="mt-1 text-sm text-muted-foreground">{ctx.entities.filter(e => !e.is_consolidated).length} reporting entities</p>
            </div>
            <div className="rounded-xl border bg-white p-5">
              <CalendarRange className="mb-2 h-5 w-5 text-[var(--navy-2)]" />
              <div className="font-bold tabular-nums text-[var(--navy)]">{ctx.reporting_years.length} reporting years</div>
              <p className="mt-1 text-sm text-muted-foreground">{ctx.reporting_years[0]} – {ctx.reporting_years[ctx.reporting_years.length - 1]}</p>
            </div>
          </div>
        </div>

        {/* ── Facility information ──────────────────────────────────── */}
        <div className="mt-6">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Facilities</div>
          <h2 className="mb-4 font-bold text-xl tabular-nums text-[var(--navy)]">Facility details</h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            {facilities.map(u => (
              <div key={u.name} className="rounded-xl border bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-auto min-w-7 items-center justify-center rounded-lg px-1.5 text-xs font-bold text-white" style={{ background:"var(--navy)" }}>
                    {u.entity}
                  </div>
                  <div className="font-bold tabular-nums text-[var(--navy)]">{u.name}</div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <span>Grid: {u.grid_utility}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Sun className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <span>{u.re_instrument}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageBody>
    </>
  );
}
