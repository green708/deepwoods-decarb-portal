/**
 * ghg-config.ts — GHG Apps Script integration config
 *
 * To activate the live flow:
 *   1. Deploy Code.gs as a web app (Execute as: Me, Anyone can access)
 *   2. Add VITE_GHG_WEBAPP_URL=<your_url> to your .env.local
 *
 * Without the URL the portal runs in demo mode — uploads are simulated,
 * notifications are mocked, and no Drive/email actions fire.
 */

export const GHG_WEBAPP_URL: string =
  (import.meta as any).env?.VITE_GHG_WEBAPP_URL ?? "";

/** True only when a web app URL has been configured */
export const GHG_LIVE = GHG_WEBAPP_URL.length > 0 && !GHG_WEBAPP_URL.includes("<<");

/** POST to the Apps Script web app */
export async function ghgPost(body: object): Promise<any> {
  if (!GHG_LIVE) throw new Error("GHG web app URL not configured (VITE_GHG_WEBAPP_URL).");
  const res = await fetch(GHG_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "follow",
  });
  if (!res.ok) {
    let detail = "";
    try { const j = await res.json(); detail = j.error ?? JSON.stringify(j); } catch { /* ignore */ }
    throw new Error(`Web app returned ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}

/** GET from the Apps Script web app */
export async function ghgGet(params: Record<string, string>): Promise<any> {
  if (!GHG_LIVE) throw new Error("GHG web app URL not configured (VITE_GHG_WEBAPP_URL).");
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GHG_WEBAPP_URL}?${qs}`, { redirect: "follow" });
  if (!res.ok) {
    let detail = "";
    try { const j = await res.json(); detail = j.error ?? JSON.stringify(j); } catch { /* ignore */ }
    throw new Error(`Web app returned ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}
