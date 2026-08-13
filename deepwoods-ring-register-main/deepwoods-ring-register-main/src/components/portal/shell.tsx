import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { usePortal } from "@/lib/portal-store";
import { HelpButton, RingWatermark, Wordmark } from "./primitives";

function RingBullet({ active, locked }: { active?: boolean | undefined; locked?: boolean }) {
  return (
    <span
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-full border",
        active ? "border-coral bg-coral" : locked ? "border-border" : "border-slate",
      )}
    />
  );
}

export function NavItem({
  label,
  to,
  params,
  active,
  locked,
}: {
  label: string;
  to?: string;
  params?: Record<string, string>;
  active?: boolean;
  locked?: boolean;
}) {
  const base =
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors relative";

  if (locked) {
    return (
      <button
        type="button"
        onClick={() => toast("This section isn't part of this build yet")}
        className={cn(base, "cursor-pointer text-slate/70 hover:bg-paper")}
      >
        <RingBullet locked />
        {label}
      </button>
    );
  }

  return (
    <Link
      to={to as string}
      params={params as never}
      className={cn(
        base,
        active ? "bg-coral-tint text-coral" : "text-ink hover:bg-paper",
        "cursor-pointer",
      )}
    >
      {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded bg-coral" />}
      <RingBullet active={active} />
      {label}
    </Link>
  );
}

export function AppShell({
  nav,
  footerExtra,
  children,
  watermark = true,
}: {
  nav: ReactNode;
  footerExtra?: ReactNode;
  children: ReactNode;
  watermark?: boolean;
}) {
  const { logout } = usePortal();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-white">
        <div className="border-b border-border px-5 py-5">
          <Wordmark />
        </div>
        <nav className="flex-1 space-y-1 p-3">{nav}</nav>
        <div className="space-y-1 border-t border-border p-3">
          {footerExtra}
          <NavItem label="User profile" to="/user-profile" />
          <button
            type="button"
            onClick={() => {
              logout();
              navigate({ to: "/" });
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper"
          >
            <span className="h-2.5 w-2.5 rounded-full border border-slate" />
            Logout
          </button>
        </div>
      </aside>

      <main className="relative flex-1 overflow-hidden">
        {watermark && <RingWatermark />}
        <div className="relative z-10 px-10 py-9">{children}</div>
        <HelpButton />
      </main>
    </div>
  );
}

export function TopLevelShell({
  active,
  children,
}: {
  active: "overview" | "register";
  children: ReactNode;
}) {
  return (
    <AppShell
      nav={
        <>
          <NavItem label="Overview" to="/overview" active={active === "overview"} />
          <NavItem label="Register" to="/register" active={active === "register"} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}

const LOCKED = [
  "Carbon Footprint",
  "Decarbonisation",
  "Peer Study",
  "Green Finance",
  "Compliance",
  "Data Submission",
  "Document Vault",
  "Methodology",
  "Priority Actions",
];

export function AccountShell({
  accountId,
  companyName,
  active,
  children,
}: {
  accountId: string;
  companyName: string;
  active: "home" | "profile";
  children: ReactNode;
}) {
  return (
    <AppShell
      nav={
        <>
          <NavItem
            label="Home"
            to="/account/$id"
            params={{ id: accountId }}
            active={active === "home"}
          />
          {LOCKED.map((l) => (
            <NavItem key={l} label={l} locked />
          ))}
        </>
      }
      footerExtra={
        <NavItem
          label="Company profile"
          to="/account/$id/profile"
          params={{ id: accountId }}
          active={active === "profile"}
        />
      }
    >
      <div className="mb-6 text-sm text-slate">
        <Link to="/register" className="cursor-pointer text-coral hover:underline">
          Register
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-ink">{companyName}</span>
      </div>
      {children}
    </AppShell>
  );
}
