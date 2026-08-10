import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
import {
  authFetch, getEmail, getMustChangePassword, getRole, getToken,
  logout as doLogout, changePassword, DEEPWOODS_ROLES, ROLE_META, type Role,
} from "@/lib/auth";
import {
  Home, FolderLock, Upload, ShieldCheck, BookOpen, LogOut, Menu, X,
  KeyRound, Loader2, Bell, LayoutDashboard, BarChart2, Leaf,
  ChevronDown, ChevronRight, PieChart, Target, Zap, FileText, TrendingDown,
  Landmark, ClipboardList, Bot, Users, Clock,
} from "lucide-react";
import {
  ClientContextProvider, useClientContextSafe, useClientContext,
} from "@/lib/client-context";
import { EntityProvider, EntitySwitcher, FiscalYearProvider, FiscalYearSwitcher, useEntity } from "@/lib/entity";
import { DeecarbAI } from "@/components/DeecarbAI";
import { toast } from "sonner";

export const Route = createFileRoute("/_app")({ component: AppRoot });

// ── PendingActivation — shown to client users whose account isn't yet active ──

function PendingActivation() {
  const logout = async () => { await doLogout(); window.location.href = "/"; };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#1E4D2B] via-[#145C3D] to-[#1E4D2B] px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-white/10">
          <Clock className="h-8 w-8 text-white/80" />
        </div>
        <h1 className="mb-3 text-2xl font-bold text-white">Pending Activation</h1>
        <p className="mb-2 text-sm leading-relaxed text-white/75">
          Your workspace is being prepared by your Deepwoods consultant.
          You'll receive an email once your account is activated and ready to use.
        </p>
        <p className="mb-8 text-sm text-white/50">
          If you believe this is a mistake, contact your Deepwoods account manager.
        </p>
        <button
          onClick={logout}
          className="flex mx-auto items-center gap-2 rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── AppRoot — wraps everything in ClientContextProvider ───────────────────────

function AppRoot() {
  const navigate = useNavigate();
  const [role, setRoleState] = useState<Role | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const r = getRole();
    if (!r || !getToken()) { navigate({ to: "/" }); return; }
    authFetch("me.php")
      .then(() => { setRoleState(r); setChecking(false); })
      .catch(() => { toast.error("Session expired — please sign in again."); navigate({ to: "/" }); });
  }, [navigate]);

  if (checking || !role) return null;

  return (
    <ClientContextProvider>
      <ClientContextGate role={role} />
    </ClientContextProvider>
  );
}

// Gate: wait for ClientContext before rendering providers that depend on it
function ClientContextGate({ role }: { role: Role }) {
  const ctxState = useClientContextSafe();
  const navigate = useNavigate();

  // Redirect client users who haven't seen the orientation tour.
  // Skip if not activated — the pending screen handles that state.
  useEffect(() => {
    if (ctxState.status !== "ready") return;
    if (DEEPWOODS_ROLES.includes(role)) return;
    if (!ctxState.data.client.is_active) return;
    if (!localStorage.getItem("decarb_orientation_done")) {
      navigate({ to: "/onboard" });
    }
  }, [ctxState.status, role]);

  if (ctxState.status === "loading") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-white">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6F4EF]">
          <Loader2 className="h-7 w-7 animate-spin text-[#1E6F5C]" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }
  if (ctxState.status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-white px-4">
        <div className="w-full max-w-sm rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
            <span className="text-lg text-red-500">!</span>
          </div>
          <h3 className="mb-1 text-sm font-semibold text-[#1F2937]">Unable to load workspace</h3>
          <p className="text-xs text-red-600">{ctxState.error}</p>
          <p className="mt-2 text-xs text-slate-500">Try refreshing the page. If the problem persists, contact your Deepwoods account manager.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }

  // Activation gate: client-role users whose account hasn't been activated yet
  if (ctxState.status === "ready" && !DEEPWOODS_ROLES.includes(role) && !ctxState.data.client.is_active) {
    return <PendingActivation />;
  }

  return (
    <FiscalYearProvider>
      <EntityProvider>
        <AppLayout role={role} />
      </EntityProvider>
    </FiscalYearProvider>
  );
}

// ── Navigation config — driven by enabled_pages from ClientContext ─────────────

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pageKey: string; // matches enabled_pages values
  badge?: number;
};

type NavGroup = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  paths: string[];
  items: NavItem[];
  pageKey: string;
};

const ALL_TOP_SINGLES: NavItem[] = [
  { to: "/workstreams", label: "Home",     icon: Home,    pageKey: "workstreams" },
  { to: "/overview",    label: "Overview", icon: PieChart, pageKey: "overview" },
];

const ALL_NAV_GROUPS: NavGroup[] = [
  {
    id: "footprint", label: "Carbon Footprint", icon: Leaf, pageKey: "footprint",
    paths: ["/dashboard", "/inventory"],
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, pageKey: "dashboard" },
      { to: "/inventory",  label: "Inventory",  icon: BarChart2,       pageKey: "inventory" },
    ],
  },
  {
    id: "decarb", label: "Decarbonisation", icon: TrendingDown, pageKey: "decarb",
    paths: ["/hotspots", "/action-plan", "/progress", "/peer"],
    items: [
      { to: "/hotspots",    label: "Hotspot",    icon: BarChart2,   pageKey: "hotspots" },
      { to: "/action-plan", label: "Action Plan", icon: Target,      pageKey: "action-plan" },
      { to: "/progress",    label: "Progress",   icon: TrendingDown, pageKey: "progress" },
      { to: "/peer",        label: "Peer Study",  icon: PieChart,    pageKey: "peer" },
    ],
  },
  {
    id: "green-finance", label: "Green Finance", icon: Landmark, pageKey: "green-finance",
    paths: ["/green-finance"],
    items: [{ to: "/green-finance", label: "Carbon as P&L", icon: Landmark, pageKey: "green-finance" }],
  },
  {
    id: "compliance", label: "Compliance", icon: ShieldCheck, pageKey: "compliance",
    paths: ["/credits", "/reports"],
    items: [
      { to: "/credits", label: "Renewables & I-RECs", icon: Zap,      pageKey: "credits" },
      { to: "/reports", label: "Reports",              icon: FileText, pageKey: "reports" },
    ],
  },
  {
    id: "reporting-cycle", label: "Reporting Cycle", icon: ClipboardList, pageKey: "reporting",
    paths: ["/reporting"],
    items: [{ to: "/reporting", label: "Collection Status", icon: ClipboardList, pageKey: "reporting" }],
  },
];

const ALL_BOTTOM_SINGLES: NavItem[] = [
  { to: "/submissions",      label: "Data Submission",  icon: Upload,     pageKey: "submissions" },
  { to: "/vault",            label: "Document Vault",   icon: FolderLock, pageKey: "vault" },
  { to: "/methodology",      label: "Methodology",      icon: BookOpen,   pageKey: "methodology" },
  { to: "/priority-actions", label: "Priority Actions", icon: Bell,       pageKey: "priority-actions" },
  { to: "/notifications",    label: "Notifications",    icon: Bot,        pageKey: "notifications" },
  { to: "/team",             label: "My Team",          icon: Users,      pageKey: "team" },
  { to: "/admin",            label: "Admin Dashboard",  icon: ShieldCheck, pageKey: "admin" },
];

// ── AppLayout ─────────────────────────────────────────────────────────────────

function AppLayout({ role }: { role: Role }) {
  const navigate = useNavigate();
  const { client, enabled_pages } = useClientContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Build nav filtered by enabled_pages from ClientContext
  const isEnabled = (pageKey: string) => enabled_pages.includes(pageKey);

  const topSingles = ALL_TOP_SINGLES.filter((i) => isEnabled(i.pageKey));
  const navGroups = ALL_NAV_GROUPS
    .filter((g) => g.items.some((i) => isEnabled(i.pageKey)))
    .map((g) => ({ ...g, items: g.items.filter((i) => isEnabled(i.pageKey)) }));
  const bottomSingles = ALL_BOTTOM_SINGLES.filter((i) => {
    if (i.pageKey === "admin") return DEEPWOODS_ROLES.includes(role);
    if (i.pageKey === "team")  return role === "sustainability_team";
    return isEnabled(i.pageKey);
  });

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const s = new Set<string>();
    navGroups.forEach((g) => { if (g.paths.some((p) => pathname === p || pathname.startsWith(p + "/"))) s.add(g.id); });
    return s;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      navGroups.forEach((g) => { if (g.paths.some((p) => pathname === p || pathname.startsWith(p + "/"))) next.add(g.id); });
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Inject client primary colour into CSS on every render (belt & suspenders — 
  // client-context.tsx also does this, but this catches any SSR hydration gaps)
  useEffect(() => {
    document.documentElement.style.setProperty("--primary", client.primary_color);
    document.documentElement.style.setProperty("--ghg-green", client.primary_color);
  }, [client.primary_color]);

  useEffect(() => {
    if (getMustChangePassword()) setShowChangePw(true);
  }, []);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const closeMenu = () => setMobileOpen(false);

  const meta = ROLE_META[role];
  if (!meta) { doLogout().then(() => navigate({ to: "/" })); return null; }

  const email = getEmail();
  const logout = async () => { await doLogout(); navigate({ to: "/" }); };

  // Deepwoods staff see their own logo, client users see client logo
  const headerLogo = DEEPWOODS_ROLES.includes(role)
    ? { src: "/deepwoods-logo.png", alt: "Deepwoods Green", accent: "var(--deepwoods-green)" }
    : { src: client.logo_url,       alt: client.name,       accent: client.primary_color };

  const renderNav = () => (
    <nav className="flex-1 overflow-y-auto p-3">
      <div className="space-y-0.5">
        {topSingles.map((item) => <NavLink key={item.to} item={item} pathname={pathname} onClick={closeMenu} />)}
      </div>
      <div className="mt-3 space-y-0.5">
        {navGroups.map((g) => (
          <GroupNav
            key={g.id} group={g} pathname={pathname}
            open={openGroups.has(g.id)} onToggle={() => toggleGroup(g.id)} onLinkClick={closeMenu}
          />
        ))}
      </div>
      <div className="mx-3 my-3 border-t border-[var(--border)]" />
      <div className="space-y-0.5">
        {bottomSingles.map((item) => <NavLink key={item.to} item={item} pathname={pathname} onClick={closeMenu} />)}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-[60] flex items-center justify-between border-b bg-white px-4 py-2.5 md:hidden">
        <img src={headerLogo.src} alt={headerLogo.alt} className="h-7 w-auto" />
        <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded p-1 text-[var(--navy)] hover:bg-muted">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[45] bg-black/60 md:hidden" onClick={closeMenu} aria-hidden="true" />
      )}

      <div className="flex">
        <aside className={`fixed inset-y-0 left-0 z-[50] w-64 border-r border-[var(--border)] bg-white text-[var(--navy)] transition-transform duration-300 ease-in-out md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-full flex-col">
            <div className="bg-white px-5 py-5">
              <img src={headerLogo.src} alt={headerLogo.alt} className="h-10 w-auto" />
            </div>
            <div className="h-1" style={{ background: headerLogo.accent }} />
            <div className="border-b border-[var(--border)] px-5 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Sustainability Portal
              </div>
            </div>

            {renderNav()}

            <div className="border-t border-[var(--border)] p-4">
              <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Signed in as</div>
              <div className="text-sm font-semibold text-[var(--navy)]">{meta.label}</div>
              {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
              <div className="mt-3 flex gap-2">
                <button onClick={() => setShowChangePw(true)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--navy)] hover:bg-[#F3F4F6]">
                  <KeyRound className="h-3.5 w-3.5" /> Password
                </button>
                <button onClick={logout}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--navy)] hover:bg-[#F3F4F6]">
                  <LogOut className="h-3.5 w-3.5" /> Log out
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-background">
          <EntityBar />
          <Outlet />
        </main>
      </div>

      {showChangePw && <ChangePasswordModal forced={getMustChangePassword()} onClose={() => setShowChangePw(false)} />}
      <DeecarbAI />
    </div>
  );
}

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({ item, pathname, onClick, indent = false }: {
  item: NavItem; pathname: string; onClick?: () => void; indent?: boolean;
}) {
  const active = pathname === item.to || pathname.startsWith(item.to + "/");
  const Icon = item.icon;
  return (
    <Link to={item.to} onClick={onClick}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${indent ? "pl-7" : ""} ${
        active
          ? "font-semibold text-[var(--primary)]"
          : "text-[var(--navy)] hover:bg-[#F3F4F6]"
      }`}
      style={active ? { backgroundColor: "var(--nav-active-bg)" } : {}}
    >
      {active && !indent && <span className="absolute left-0 inset-y-1 w-0.5 rounded-r-full bg-[var(--primary)]" />}
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--primary)]" : "text-[var(--navy-2)]"}`} />
      <span className="flex-1">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--alert)] px-1.5 text-[10px] font-bold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ── GroupNav ──────────────────────────────────────────────────────────────────

function GroupNav({ group, pathname, open, onToggle, onLinkClick }: {
  group: NavGroup; pathname: string; open: boolean; onToggle: () => void; onLinkClick: () => void;
}) {
  const Icon = group.icon;
  const isChildActive = group.paths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div>
      <button onClick={onToggle}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
          isChildActive && !open ? "font-semibold text-[var(--primary)]" : "text-[var(--navy)] hover:bg-[#F3F4F6]"
        }`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${isChildActive && !open ? "text-[var(--primary)]" : "text-[var(--navy-2)]"}`} />
        <span className="flex-1 text-left">{group.label}</span>
        <Chevron className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((item) => (
            <NavLink key={item.to} item={item} pathname={pathname} onClick={onLinkClick} indent />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Entity bar (sticky, above page content) ──────────────────────────────────

function EntityBar() {
  const { entity } = useEntity();
  const { entities } = useClientContext();
  const meta = entities.find((e) => e.code === entity);

  return (
    <div className="sticky top-[49px] z-30 flex flex-wrap items-center justify-between gap-2 border-b bg-white/98 px-4 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.06),0_2px_8px_rgba(15,23,42,0.05)] backdrop-blur-sm md:top-0 md:px-6">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">Reporting entity</div>
        <div className="truncate text-sm font-semibold text-[var(--navy)]">
          {meta?.name ?? entity}
          {meta?.is_consolidated && meta.consolidates && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              auto-consolidated · {meta.consolidates.join(" + ")}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">Fiscal year</span>
          <FiscalYearSwitcher />
        </div>
        <div className="h-7 w-px bg-[var(--border)]" />
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">Entity</span>
          <EntitySwitcher />
        </div>
      </div>
    </div>
  );
}

// ── ChangePasswordModal ───────────────────────────────────────────────────────

function ChangePasswordModal({ forced, onClose }: { forced: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) { setError("New password must be at least 8 characters"); return; }
    if (next !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    try {
      await changePassword(current, next);
      toast.success("Password updated");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-2xl">
        <h3 className="font-serif text-lg font-bold text-[var(--navy)]">
          {forced ? "Set a new password to continue" : "Change password"}
        </h3>
        {forced && (
          <p className="mt-1 text-sm text-muted-foreground">
            Your account still has its initial password — set your own before continuing.
          </p>
        )}
        <form onSubmit={submit} className="mt-4 space-y-3">
          {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Current password</label>
            <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">New password</label>
            <input type="password" required value={next} onChange={(e) => setNext(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2 text-sm" placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Confirm new password</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            {!forced && <button type="button" onClick={onClose} className="rounded-md border px-4 py-1.5 text-sm">Cancel</button>}
            <button type="submit" disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--ghg-green)] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Saving..." : "Save password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AppLayout;
