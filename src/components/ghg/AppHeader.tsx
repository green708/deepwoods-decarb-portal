import { Link, useLocation } from "@tanstack/react-router";
import { Building2, ClipboardList, Database, GitCompareArrows, LineChart, Shield } from "lucide-react";
import { useGhgStore } from "@/lib/ghg/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { role, setRole, seedDemo, resetAll, state } = useGhgStore();
  const pendingEdits = state.editRequests.filter((r) => r.status === "pending").length;
  const loc = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b bg-navy text-navy-foreground">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Featherlite · GHG FY26</div>
            <div className="text-[10px] uppercase tracking-widest opacity-70">Deepwoods Green Consulting</div>
          </div>
        </div>

        <nav className="ml-4 flex items-center gap-1 text-xs">
          <Link
            to="/submit"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition",
              loc.pathname.startsWith("/submit") ? "bg-white/10" : "opacity-70 hover:opacity-100",
            )}
          >
            <ClipboardList className="h-3.5 w-3.5" /> Data Submission
          </Link>
          <Link to="/historical" className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition",
            loc.pathname.startsWith("/historical") ? "bg-white/10" : "opacity-70 hover:opacity-100")}>
            <LineChart className="h-3.5 w-3.5" /> Historical Trends
          </Link>
          <Link to="/compare" className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition",
            loc.pathname.startsWith("/compare") ? "bg-white/10" : "opacity-70 hover:opacity-100")}>
            <GitCompareArrows className="h-3.5 w-3.5" /> Compare
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center rounded-md border border-white/15 bg-white/5 p-0.5 text-xs md:flex">
            <button
              onClick={() => setRole("client")}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 transition",
                role === "client" ? "bg-primary text-primary-foreground" : "opacity-70 hover:opacity-100",
              )}
            >
              <Building2 className="h-3 w-3" /> Client
            </button>
            <button
              onClick={() => setRole("admin")}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 transition",
                role === "admin" ? "bg-primary text-primary-foreground" : "opacity-70 hover:opacity-100",
              )}
            >
              <Shield className="h-3 w-3" /> Admin
            </button>
          </div>
          <Button
            size="sm" variant="secondary"
            onClick={seedDemo}
            className="h-7 bg-white/10 text-navy-foreground hover:bg-white/20"
          >Seed demo</Button>
          <Button
            size="sm" variant="ghost"
            onClick={() => { if (confirm("Clear all local data?")) resetAll(); }}
            className="h-7 text-navy-foreground hover:bg-white/10"
          >Reset</Button>
        </div>
      </div>
    </header>
  );
}
