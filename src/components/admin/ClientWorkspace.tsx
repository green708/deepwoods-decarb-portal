import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useAdminClientSettings } from "@/lib/api-admin";
import { switchDwaClient } from "@/lib/client-context";
import { CARD, ErrorNote, PaymentPill, Pill, PRIMARY_BTN, SECONDARY_BTN, Spinner, fyOptions, type ClientTabProps } from "./ui";
import { CLIENT_TABS, type AdminNav, type ClientTab } from "./useAdminLocation";
import { OverviewTab } from "./OverviewTab";
import { SetupTab } from "./SetupTab";
import { DataTab } from "./DataTab";
import { CalcTab } from "./CalcTab";
import { TargetsPlanTab } from "./TargetsPlanTab";
import { QueriesTab } from "./QueriesTab";
import { ActivityTab } from "./ActivityTab";

const HEX = /^#[0-9a-fA-F]{6}$/;

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function ClientAvatar({ name, logoUrl, color, size = 36 }: { name: string; logoUrl: string | null; color: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const accent = color && HEX.test(color) ? color : "#1E6F5C";
  const box = { width: size, height: size };
  if (logoUrl && !broken) {
    return (
      <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-white" style={box}>
        <img src={logoUrl} alt="" className="h-full w-full object-contain p-0.5" onError={() => setBroken(true)} loading="lazy" />
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg text-xs font-bold"
      style={{ ...box, backgroundColor: `${accent}1F`, color: accent }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}

interface Props {
  clientId: number;
  tab: ClientTab;
  fy: string | null;
  isAdmin: boolean;
  go: (next: AdminNav) => void;
}

export function ClientWorkspace({ clientId, tab, fy, isAdmin, go }: Props) {
  const q = useAdminClientSettings(clientId);

  if (q.isLoading) return <Spinner label="Loading client..." />;
  if (q.error || !q.data) {
    return (
      <div className="space-y-4">
        <button type="button" className={SECONDARY_BTN} onClick={() => go({ view: "portfolio" })}>
          <ArrowLeft className="h-4 w-4" /> Back to portfolio
        </button>
        <ErrorNote error={q.error ?? new Error("Client not found")} />
        <button type="button" className={SECONDARY_BTN} onClick={() => q.refetch()}>Retry</button>
      </div>
    );
  }

  const { client } = q.data;
  const currentFy = q.data.fy;
  const activeFy = fy ?? currentFy;
  const options = fyOptions(client.reporting_period, currentFy);
  if (!options.includes(activeFy)) options.unshift(activeFy);

  const tabProps: ClientTabProps = {
    clientId,
    clientName: client.name,
    slug: client.slug,
    reportingPeriod: client.reporting_period,
    fy: activeFy,
    isAdmin,
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <button type="button" onClick={() => go({ view: "portfolio" })} className="inline-flex items-center gap-1 rounded font-semibold text-[#1E6F5C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C]">
          <ArrowLeft className="h-3.5 w-3.5" /> Portfolio
        </button>
        <span aria-hidden="true">/</span>
        <span className="truncate font-medium text-[var(--navy)]">{client.name}</span>
      </nav>

      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <ClientAvatar name={client.name} logoUrl={client.logo_url} color={client.primary_color} size={48} />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold leading-tight text-[var(--navy)]">{client.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{client.slug}</span>
                <PaymentPill status={client.payment_status} />
                <Pill tone={client.is_active ? "green" : "slate"}>{client.is_active ? "Active" : "Inactive"}</Pill>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-[var(--navy)]">
                {client.reporting_period === "CY" ? "Calendar year" : "Fiscal year"}
              </span>
              <select
                value={activeFy}
                onChange={(e) => go({ fy: e.target.value === currentFy ? null : e.target.value, replace: true })}
                className="h-9 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-semibold text-[var(--navy)] focus:border-[#1E6F5C] focus:outline-none focus:ring-1 focus:ring-[#1E6F5C]"
              >
                {options.map((o) => <option key={o} value={o}>{o}{o === currentFy ? " (current)" : ""}</option>)}
              </select>
            </label>
            <button type="button" className={PRIMARY_BTN} onClick={() => switchDwaClient(client.slug)}>
              <ExternalLink className="h-4 w-4" /> Open client portal
            </button>
          </div>
        </div>
        <div className="border-t border-[var(--border)] px-2 sm:px-3">
          <div className="flex gap-1 overflow-x-auto overflow-y-hidden" role="tablist" aria-label="Client workspace sections">
            {CLIENT_TABS.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? "page" : undefined}
                  onClick={() => go({ tab: t.key })}
                  className={`shrink-0 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E6F5C] ${
                    active ? "border-[#1E6F5C] text-[#1E6F5C]" : "border-transparent text-muted-foreground hover:text-[var(--navy)]"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div role="tabpanel" key={`${clientId}-${tab}`}>
        {tab === "overview" && <OverviewTab {...tabProps} go={go} />}
        {tab === "setup" && <SetupTab {...tabProps} />}
        {tab === "data" && <DataTab {...tabProps} />}
        {tab === "calc" && <CalcTab {...tabProps} />}
        {tab === "plan" && <TargetsPlanTab {...tabProps} />}
        {tab === "queries" && <QueriesTab {...tabProps} />}
        {tab === "activity" && <ActivityTab {...tabProps} />}
      </div>
    </div>
  );
}
