import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getToken, authFetch, getRole, DEEPWOODS_ROLES } from "@/lib/auth";
import {
  Leaf, BarChart2, Target, FileText, TrendingDown, ClipboardList,
  ShieldCheck, ChevronRight, ChevronLeft, Users, Eye,
} from "lucide-react";

export const Route = createFileRoute("/onboard")({ component: Onboard });

// ── Constants ─────────────────────────────────────────────────────────────────

const PORTAL_MODULES = [
  { icon: BarChart2,     label: "Carbon Dashboard",   desc: "See your emissions at a glance" },
  { icon: ClipboardList, label: "Data Submission",    desc: "Submit activity data by facility" },
  { icon: Target,        label: "Decarbonisation",    desc: "Track your reduction action plan" },
  { icon: FileText,      label: "Compliance Reports", desc: "GHG inventory and disclosures" },
  { icon: TrendingDown,  label: "Peer Benchmarking",  desc: "Compare with your industry" },
  { icon: ShieldCheck,   label: "Green Finance",      desc: "Carbon cost and renewable tracking" },
];

const CYCLE_STEPS = [
  { label: "Boundary Setup",    desc: "Define entities and emission sources" },
  { label: "Data Collection",   desc: "Submit activity data each month" },
  { label: "Processing",        desc: "Deepwoods calculates your GHG inventory" },
  { label: "Dashboards",        desc: "Review your carbon footprint and trends" },
  { label: "Compliance",        desc: "Generate reports for disclosure" },
  { label: "FY Close & Repeat", desc: "Lock the year — a new cycle begins" },
];

const ROLES = [
  {
    icon: ShieldCheck,
    name: "Admin",
    iconBg: "#E6F4EF",
    iconColor: "#1E4D2B",
    bg: "border-[#1E4D2B]/30 bg-[#F0FAF5]",
    color: "#1E4D2B",
    perms: ["Full portal access", "Data submission & dashboards", "Manage team and disclosures"],
  },
  {
    icon: ClipboardList,
    name: "Data Contributor",
    iconBg: "#DBEAFE",
    iconColor: "#1D4ED8",
    bg: "border-[#3B82F6]/30 bg-[#EFF6FF]",
    color: "#3B82F6",
    perms: ["Upload activity data", "Browse document vault", "Facility scope only"],
  },
  {
    icon: Eye,
    name: "Viewer",
    iconBg: "#F3F4F6",
    iconColor: "#6B7280",
    bg: "border-slate-200 bg-slate-50",
    color: "#6B7280",
    perms: ["Read-only dashboards and KPIs", "View reports", "No data entry"],
  },
];

// ── Slide content ─────────────────────────────────────────────────────────────

function Slide1({ clientName }: { clientName: string }) {
  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F4EF]">
          <Leaf className="h-5 w-5 text-[#1E6F5C]" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--navy-2)]">1 of 3</div>
          <h2 className="text-xl font-bold text-[var(--navy)]">
            {clientName ? `Welcome, ${clientName}` : "Welcome to your Decarbonisation Portal"}
          </h2>
        </div>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-[var(--navy-2)]">
        Your Deepwoods consultant has set up this workspace for your sustainability journey.
        Here's a quick look at everything available to you.
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {PORTAL_MODULES.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="rounded-xl border border-[var(--border)] bg-slate-50/60 p-3.5">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#E6F4EF]">
              <Icon className="h-4 w-4 text-[#1E6F5C]" />
            </div>
            <p className="text-xs font-bold text-[var(--navy)]">{label}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--navy-2)]">{desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-[#F0FAF5] px-4 py-3">
        <p className="text-xs text-[#1E6F5C]">
          <span className="font-semibold">New to GHG accounting?</span> Every section has plain-language
          explanations — no jargon required. Your consultant is always a message away.
        </p>
      </div>
    </div>
  );
}

function Slide2() {
  return (
    <div>
      <div className="mb-5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--navy-2)]">2 of 3</div>
        <h2 className="mt-1 text-xl font-bold text-[var(--navy)]">Your annual GHG cycle</h2>
        <p className="mt-1.5 text-sm text-[var(--navy-2)]">
          Every financial year follows this cycle. You'll always know where you are and what to do next.
        </p>
      </div>
      <div className="space-y-2.5">
        {CYCLE_STEPS.map(({ label, desc }, i) => (
          <div key={label} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E6F5C] text-[11px] font-bold text-white">
                {i + 1}
              </div>
              {i < CYCLE_STEPS.length - 1 && (
                <div className="mt-1 h-4 w-0.5 bg-[#C5E4D0]" />
              )}
            </div>
            <div className="pb-1.5">
              <p className="text-sm font-semibold text-[var(--navy)]">{label}</p>
              <p className="text-xs text-[var(--navy-2)]">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
        <p className="text-xs text-[#1D4ED8]">
          <span className="font-semibold">Next after this tour:</span> You'll configure your GHG
          boundary — which entities and emission sources are in scope. Takes about 5–10 minutes.
        </p>
      </div>
    </div>
  );
}

function Slide3() {
  return (
    <div>
      <div className="mb-5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--navy-2)]">3 of 3</div>
        <h2 className="mt-1 text-xl font-bold text-[var(--navy)]">Your team's roles</h2>
        <p className="mt-1.5 text-sm text-[var(--navy-2)]">
          Different people in your organisation see different things. Here's how it works.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROLES.map(({ icon: Icon, name, iconBg, iconColor, bg, color, perms }) => (
          <div key={name} className={`rounded-xl border ${bg} p-4`}>
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: iconBg }}>
                <Icon className="h-4 w-4" style={{ color: iconColor }} />
              </div>
              <p className="text-sm font-bold" style={{ color }}>{name}</p>
            </div>
            <ul className="space-y-1.5">
              {perms.map((p) => (
                <li key={p} className="flex items-start gap-1.5 text-xs text-[var(--navy-2)]">
                  <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[#1E6F5C]" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-amber-200 bg-[#FFFBEB] px-4 py-3">
        <p className="text-xs text-amber-800">
          <span className="font-semibold">Tip:</span> The Admin role can invite and manage
          team members from the workspace at any time — no need to do it right now.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function Onboard() {
  const navigate = useNavigate();
  const token = getToken();
  const role = getRole();
  const [slide, setSlide] = useState(0);
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    if (!token) { navigate({ to: "/" }); return; }
    if (role && DEEPWOODS_ROLES.includes(role)) { navigate({ to: "/home" }); return; }
    authFetch("context.php")
      .then((ctx: any) => {
        setClientName(ctx?.client?.name ?? "");
      })
      .catch(() => {});
  }, []);

  const finish = () => {
    localStorage.setItem("decarb_orientation_done", "1");
    authFetch("mark-orientation.php", { method: "POST" }).catch(() => {});
    navigate({ to: "/home" });
  };

  const TOTAL = 3;
  const isLast = slide === TOTAL - 1;

  if (!token) return null;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#1E4D2B] via-[#145C3D] to-[#1E4D2B]">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <img src="/deepwoods-logo.png" alt="Deepwoods Green" className="h-8 w-auto brightness-0 invert" />
        <button
          onClick={finish}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:text-white/90"
        >
          <Users className="h-3.5 w-3.5" />
          Skip tour
        </button>
      </header>

      {/* ── Slide ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-4 py-6">
        <div className="w-full max-w-2xl">
          <div className="rounded-2xl bg-white/95 p-7 shadow-2xl backdrop-blur md:p-8">
            {slide === 0 && <Slide1 clientName={clientName} />}
            {slide === 1 && <Slide2 />}
            {slide === 2 && <Slide3 />}
          </div>
        </div>
      </div>

      {/* ── Footer nav ───────────────────────────────────────────────── */}
      <footer className="flex items-center justify-between px-6 pb-8 md:px-10">
        {/* Dots */}
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === slide ? "h-2 w-6 bg-white" : "h-2 w-2 bg-white/30"
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {slide > 0 && (
            <button
              onClick={() => setSlide(slide - 1)}
              className="flex items-center gap-1.5 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <button
            onClick={isLast ? finish : () => setSlide(slide + 1)}
            className="flex items-center gap-2 rounded-lg bg-white px-5 py-2 text-sm font-bold text-[#1E4D2B] shadow-lg transition-all hover:shadow-xl"
          >
            {isLast ? "Get started" : "Next"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
