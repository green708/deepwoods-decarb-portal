import { useCallback, useMemo, useSyncExternalStore } from "react";

export type AdminView = "portfolio" | "requests" | "inbox" | "platform";
export type ClientTab = "overview" | "setup" | "data" | "calc" | "plan" | "queries" | "activity";

export const ADMIN_VIEWS: { key: AdminView; label: string }[] = [
  { key: "portfolio", label: "Portfolio" },
  { key: "requests", label: "Requests" },
  { key: "inbox", label: "Inbox" },
  { key: "platform", label: "Platform" },
];

export const CLIENT_TABS: { key: ClientTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "setup", label: "Setup" },
  { key: "data", label: "Data" },
  { key: "calc", label: "Calculation" },
  { key: "plan", label: "Targets & plan" },
  { key: "queries", label: "Queries" },
  { key: "activity", label: "Activity" },
];

export interface AdminNav {
  view?: AdminView;
  client?: number | null;
  tab?: ClientTab;
  fy?: string | null;
  replace?: boolean;
}

export interface AdminLocation {
  view: AdminView;
  clientId: number | null;
  tab: ClientTab;
  fy: string | null;
  go: (next: AdminNav) => void;
}

const EVENT = "admin-location-change";
const FY_RE = /^[A-Za-z]{2}\d{2,4}$/;

interface Parsed { view: AdminView; clientId: number | null; tab: ClientTab; fy: string | null }

function parse(search: string): Parsed {
  const p = new URLSearchParams(search);
  const v = p.get("view");
  const view = ADMIN_VIEWS.some((x) => x.key === v) ? (v as AdminView) : "portfolio";
  const rawClient = Number(p.get("client"));
  const clientId = Number.isInteger(rawClient) && rawClient > 0 ? rawClient : null;
  const t = p.get("tab");
  const tab = CLIENT_TABS.some((x) => x.key === t) ? (t as ClientTab) : "overview";
  const rawFy = p.get("fy");
  const fy = rawFy && FY_RE.test(rawFy) ? rawFy : null;
  return { view, clientId, tab, fy };
}

function build(s: Parsed): string {
  const p = new URLSearchParams();
  if (s.clientId != null) {
    p.set("client", String(s.clientId));
    p.set("tab", s.tab);
    if (s.fy) p.set("fy", s.fy);
  } else if (s.view !== "portfolio") {
    p.set("view", s.view);
  }
  const out = p.toString();
  return out ? `?${out}` : "";
}

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENT, cb);
  };
}

const getSnapshot = () => window.location.search;
const getServerSnapshot = () => "";

export function useAdminLocation(): AdminLocation {
  const search = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const parsed = useMemo(() => parse(search), [search]);

  const go = useCallback((next: AdminNav) => {
    const cur = parse(window.location.search);
    const view = next.view ?? cur.view;
    const clientId = "client" in next ? (next.client ?? null) : next.view ? null : cur.clientId;
    const clientChanged = clientId !== cur.clientId;
    const target: Parsed = {
      view,
      clientId,
      tab: clientId == null ? "overview" : (next.tab ?? (clientChanged ? "overview" : cur.tab)),
      fy: clientId == null ? null : "fy" in next ? (next.fy ?? null) : clientChanged ? null : cur.fy,
    };
    const search = build(target);
    if (search === window.location.search) return;
    const url = `${window.location.pathname}${search}${window.location.hash}`;
    if (next.replace) window.history.replaceState(window.history.state, "", url);
    else {
      window.history.pushState(window.history.state, "", url);
      if (clientChanged || view !== cur.view) window.scrollTo({ top: 0 });
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { ...parsed, go };
}
