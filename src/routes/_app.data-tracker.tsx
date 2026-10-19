import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AlertTriangle, Download, FileBarChart2, Mail, CheckCircle2, Upload } from "lucide-react";
import XLSXStyle from "xlsx-js-style";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDecarbAssets, useFacilities, resolveAssetUnit } from "@/lib/api";
import type { DecarbAsset } from "@/lib/api";
import { useEntity, useFiscalYear } from "@/lib/entity";
import { useClientContext } from "@/lib/client-context";
import { ProgressRing } from "@/components/ghg/ProgressRing";
import { authFetch } from "@/lib/auth";
import { toast } from "sonner";
import { parseLedger } from "@/lib/ledger-parser";
import type { LedgerParseResult } from "@/lib/ledger-parser";
import { useQueryClient } from "@tanstack/react-query";
import { calcProgress, genMonths, getDisplayMonthVal, getMonthVal, hasAnyMonthlyData, isAnnual } from "@/lib/tracker-progress";

export const Route = createFileRoute("/_app/data-tracker")({ component: DataTrackerPage });

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Scope tracker grid — asset card layout ────────────────────────────────────

const CHIP_FILLED   = { bg: "#c6efce", text: "#375623" } as const;
const CHIP_EMPTY    = { bg: "#ffc7ce", text: "#9c0006" } as const;
const CHIP_DERIVED  = { bg: "#ffeb9c", text: "#9c6500" } as const;

function fmtVal(v: number): string {
  if (v >= 1_000_000) return `${Math.round(v / 1000).toLocaleString()}k`;
  if (v >= 100_000)   return `${Math.round(v / 1000).toLocaleString()}k`;
  if (v >= 10_000)    return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return String(Math.round(v * 100) / 100);
}

function ScopeTrackerGrid({ assets, months }: {
  assets: DecarbAsset[];
  months: { key: string; short: string }[];
}) {
  if (!assets.length) return (
    <div className="rounded-lg border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground mb-3">No equipment sources in this scope.</p>
      <a
        href="/inventory-boundary"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Set up Inventory Boundary →
      </a>
    </div>
  );

  // Case-insensitive dedup: keep first-seen casing, match on lowercase
  const facilityNames = (() => {
    const seen = new Map<string, string>();
    for (const a of assets) {
      if (a.facility) {
        const k = a.facility.trim().toLowerCase();
        if (!seen.has(k)) seen.set(k, a.facility.trim());
      }
    }
    return [...seen.values()];
  })();

  return (
    <div className="space-y-5">
      {facilityNames.map(facilityName => {
        const fAssets = assets.filter(a => a.facility?.trim().toLowerCase() === facilityName.trim().toLowerCase());
        const fPct = Math.round(calcProgress(fAssets, months) * 100);
        const pctColor = fPct >= 100 ? "#375623" : fPct >= 50 ? "#92400e" : "#9c0006";
        const pctBg    = fPct >= 100 ? "#c6efce" : fPct >= 50 ? "#fef3c7" : "#ffc7ce";

        return (
          <div key={facilityName}>
            {/* Facility header strip */}
            <div className="mb-3 flex items-center gap-3 rounded-md border bg-neutral-soft px-4 py-2.5">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{facilityName}</span>
              <div className="ml-auto flex items-center gap-2.5">
                <div className="h-1.5 w-24 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${fPct}%`, background: pctColor }}
                  />
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                  style={{ background: pctBg, color: pctColor }}
                >
                  {fPct}%
                </span>
              </div>
            </div>

            {/* Asset cards */}
            <div className="space-y-3">
              {fAssets.map(asset => {
                const annual = isAnnual(asset) && !hasAnyMonthlyData(asset, months);
                const series = asset.series ?? {};
                const monthsFilled = annual ? 0 : months.filter(m => getDisplayMonthVal(asset, months, m.key).value != null).length;
                const total  = annual ? 1 : months.length;
                const filled = annual ? (series["annual"] != null ? 1 : 0) : monthsFilled;
                const pct    = total > 0 ? Math.round((filled / total) * 100) : 0;
                const monthSum = monthsFilled > 0
                  ? months.reduce((s, m) => s + (Number(getDisplayMonthVal(asset, months, m.key).value) || 0), 0)
                  : null;
                const annualDisplay = monthSum != null ? monthSum : series["annual"] ?? null;
                const chipPctColor = pct >= 100 ? "#375623" : pct >= 50 ? "#92400e" : "#9c0006";
                const chipPctBg    = pct >= 100 ? "#c6efce" : pct >= 50 ? "#fef3c7" : "#ffc7ce";

                return (
                  <div key={asset.id} className="rounded-lg border bg-card px-4 py-3">
                    {/* Card header */}
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-navy leading-snug">{asset.name}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {asset.id} · {resolveAssetUnit(asset)} · {asset.scope}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        {annualDisplay != null && (
                          <div className="text-right">
                            <div className="text-[10px] text-muted-foreground leading-none mb-0.5">Annual total</div>
                            <div className="text-base font-bold leading-none" style={{ color: "#375623" }}>
                              {annualDisplay.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              <span className="ml-1 text-[11px] font-normal text-muted-foreground">{resolveAssetUnit(asset)}</span>
                            </div>
                          </div>
                        )}
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                          style={{ background: chipPctBg, color: chipPctColor }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Month chips */}
                    {annual ? (
                      <div className="flex items-center gap-3">
                        <span className="text-xs italic text-muted-foreground">Annual entry</span>
                        {series["annual"] != null ? (
                          <span
                            className="rounded px-2.5 py-1 text-xs font-semibold tabular-nums"
                            style={{ background: CHIP_FILLED.bg, color: CHIP_FILLED.text }}
                          >
                            {fmtVal(Number(series["annual"]))} {resolveAssetUnit(asset)}
                          </span>
                        ) : (
                          <span
                            className="rounded px-2.5 py-1 text-xs font-semibold"
                            style={{ background: CHIP_EMPTY.bg, color: CHIP_EMPTY.text }}
                          >
                            Not entered
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {months.map(m => {
                          const { value: v, derived } = getDisplayMonthVal(asset, months, m.key);
                          const has = v != null;
                          const chip = !has ? CHIP_EMPTY : derived ? CHIP_DERIVED : CHIP_FILLED;
                          return (
                            <div key={m.key} className="flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
                                {m.short.split("-")[0]}
                              </span>
                              <div
                                title={derived ? "Estimated — annual total ÷ months" : has ? String(v) : "Missing"}
                                className="flex h-8 w-11 items-center justify-center rounded text-[10.5px] font-semibold tabular-nums"
                                style={{ background: chip.bg, color: chip.text }}
                              >
                                {has ? fmtVal(Number(v)) : "✗"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function DataTrackerPage() {
  const { entity } = useEntity();
  const { fy } = useFiscalYear();
  const ctx = useClientContext();
  const qc = useQueryClient();
  const { data: assets = [] } = useDecarbAssets(entity, fy);
  const { data: facilities = [] } = useFacilities(entity);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sendingReminder, setSendingReminder] = useState(false);

  // ── Ledger import state ──────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<LedgerParseResult | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  async function handleFileChosen(file: File) {
    if (!entity) { toast.error("Select an entity first"); return; }
    const reportingPeriod = ctx.client.reporting_period === "CY" ? "CY" : "FY";
    const clientId = ctx.client.id as number;
    setImporting(true);
    try {
      const parsed = await parseLedger(file, entity, reportingPeriod, clientId);
      if (!parsed.year) {
        toast.error("Could not detect fiscal year from the file. Is this a carbon ledger?");
        return;
      }
      setPendingFile(file);
      setImportPreview(parsed);
      setImportDialogOpen(true);
    } catch (err) {
      toast.error(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!importPreview || !pendingFile) return;
    setImporting(true);
    try {
      const { year, entity: ent, ghgInventory, s1ByFacility, s2ByFacility,
              s2Breakdown, scope3Summary, intensityMetrics, trackerAssets, trackerDrafts,
              decarbActions, irecRegister, peerData } = importPreview;
      const body = {
        entity: ent, year,
        ghg_inventory: ghgInventory,
        s1_by_facility: s1ByFacility,
        s2_by_facility: s2ByFacility,
        s2_breakdown: s2Breakdown,
        scope3_summary: scope3Summary,
        intensity_metrics: intensityMetrics,
        tracker_assets: trackerAssets,
        tracker_drafts: trackerDrafts,
        irec_register: irecRegister ?? [],
        decarb_actions: decarbActions ?? [],
        peer_data: peerData ?? [],
      };
      const res = await authFetch("import/ledger.php", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      const c = json.counts ?? {};
      const extra = [
        c.irec_register   ? `${c.irec_register} I-RECs`   : null,
        c.decarb_actions  ? `${c.decarb_actions} actions`  : null,
        c.peers           ? `${c.peers} peers`              : null,
      ].filter(Boolean).join(", ");
      toast.success(`Imported ${ent} ${year}: ${c.ghg_inventory ?? 0} GHG rows, ${c.tracker_assets ?? 0} assets${extra ? `, ${extra}` : ""}`);
      setImportDialogOpen(false);
      setImportPreview(null);
      setPendingFile(null);
      qc.invalidateQueries({ queryKey: ["decarb-assets"] });
      qc.invalidateQueries({ queryKey: ["ghg-inventory"] });
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  const startMonth = ctx.client.reporting_period === "CY"
    ? 1
    : (parseInt((ctx.config as any).fiscal_year_start_month || "4") || 4);
  const months = genMonths(fy, startMonth);

  const s1Assets = assets.filter(a => a.scope === "Scope 1");
  const s2Assets = assets.filter(a => a.scope === "Scope 2");
  const s3Assets = assets.filter(a => a.scope === "Scope 3");

  function isSolarAsset(asset: DecarbAsset) {
    const n = (asset.name ?? "").toLowerCase();
    const st = (asset.sub_type ?? "").toLowerCase();
    return n.includes("solar") || st.includes("solar");
  }
  function isS2Elec(asset: DecarbAsset) {
    return asset.scope === "Scope 2" && !isSolarAsset(asset);
  }

  function downloadClientTemplate() {
    const XS = XLSXStyle as any;
    const wb = XS.utils.book_new();
    const clientName = (ctx.client as any)?.name ?? "Client";

    function makeWS(headers: string[], exampleRows: (string | number)[][], note: string): any {
      const ws: any = {};
      const noteS = { font: { name: "Trebuchet MS", sz: 11, italic: true, color: { rgb: "27AE60" } }, fill: { patternType: "solid", fgColor: { rgb: "F0FFF4" } }, alignment: { horizontal: "left", wrapText: true } };
      const hdrS  = { font: { name: "Trebuchet MS", sz: 11, bold: true }, fill: { patternType: "solid", fgColor: { rgb: "F2F2F2" } }, alignment: { horizontal: "center", wrapText: true }, border: { bottom: { style: "thin", color: { rgb: "BFBFBF" } } } };
      const reqS  = { font: { name: "Trebuchet MS", sz: 11 }, fill: { patternType: "solid", fgColor: { rgb: "FFFDE7" } }, alignment: { horizontal: "left" } };
      const exS   = { font: { name: "Trebuchet MS", sz: 11, color: { rgb: "AAAAAA" } }, fill: { patternType: "solid", fgColor: { rgb: "F9F9F9" } }, alignment: { horizontal: "left" } };
      const CL = (i: number) => { let l = "", n = i; while (n >= 0) { l = String.fromCharCode((n % 26) + 65) + l; n = Math.floor(n / 26) - 1; } return l; };

      ws[`A1`] = { v: note, t: "s", s: noteS };
      (ws["!merges"] = ws["!merges"] || []).push({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } });

      for (let ci = 0; ci < headers.length; ci++) ws[`${CL(ci)}2`] = { v: headers[ci], t: "s", s: hdrS };
      for (let ri = 0; ri < exampleRows.length; ri++) {
        const row = exampleRows[ri];
        for (let ci = 0; ci < row.length; ci++) {
          const v = row[ci]; const addr = `${CL(ci)}${ri + 3}`;
          ws[addr] = { v: typeof v === "number" ? v : String(v), t: typeof v === "number" ? "n" : "s", s: ri === 0 ? exS : reqS };
        }
      }
      ws["!cols"] = headers.map(() => ({ wch: 22 }));
      ws["!ref"] = `A1:${CL(headers.length - 1)}${2 + exampleRows.length}`;
      ws["!rows"] = [{ hpx: 36 }, { hpx: 32 }];
      return ws;
    }

    // Instructions
    const wsInstr: any = {};
    const instrS = { font: { name: "Trebuchet MS", sz: 12 }, alignment: { horizontal: "left", wrapText: true } };
    const titleS = { font: { name: "Trebuchet MS", sz: 15, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "27AE60" } }, alignment: { horizontal: "left" } };
    wsInstr[`A1`] = { v: "Decarb Portal — Client Data Template", t: "s", s: titleS };
    wsInstr["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    const instrRows: [string, string][] = [
      ["HOW TO USE", ""],
      ["1. Fill all YELLOW cells. Yellow = required data.", ""],
      ["2. Leave cells BLANK (not zero) if data is unknown.", ""],
      ["3. Do NOT rename any sheet tab or column header.", ""],
      ["4. Year = Fiscal Year END year. FY2024 (Apr 2023–Mar 2024) → enter 2024.", ""],
      ["5. All emissions in tCO2e. Electricity always in kWh.", ""],
      ["6. Replace the grey example rows — they show expected format only.", ""],
      ["7. Upload this file via Admin Panel → Data Tracker → Import Ledger.", ""],
      ["", ""],
      ["SHEETS IN THIS FILE", ""],
      ["GHG_Inventory", "Scope 1, 2, 3 totals per entity / facility / year"],
      ["S1_Breakdown",  "Scope 1 by fuel type per facility"],
      ["S2_Breakdown",  "Scope 2 per facility: kWh, grid EF, LB/MB, renewables"],
      ["Scope3_Categories", "Scope 3 split across Cat 1–15 per entity and year"],
      ["Intensity_Metrics", "Revenue, headcount, floor space, production volume"],
      ["I-RECs",        "Renewable energy certificates / market instruments"],
      ["Actions",       "Decarbonization initiatives, status, and targets"],
      ["Peers",         "Peer benchmarks from sustainability reports / CDP"],
    ];
    for (let i = 0; i < instrRows.length; i++) {
      wsInstr[`A${i + 2}`] = { v: instrRows[i][0], t: "s", s: instrS };
      wsInstr[`B${i + 2}`] = { v: instrRows[i][1], t: "s", s: instrS };
    }
    wsInstr["!cols"] = [{ wch: 36 }, { wch: 60 }];
    wsInstr["!ref"] = `A1:B${1 + instrRows.length}`;

    const exEnt = "GT";
    const exYr = 2025;

    const wsGhg = makeWS(
      ["Entity Code", "Facility\n(blank = entity total)", "Year", "Scope 1\n(tCO2e)", "S2 Location-Based\n(tCO2e)", "S2 Market-Based\n(tCO2e)", "S3 Total\n(tCO2e)", "S3 Assessed\n(yes/partial/no)"],
      [[exEnt, "Singapore HQ", exYr, 22.37, 245.1, 245.1, "", "no"], [exEnt, "London Office", exYr, 0, 103.2, 103.2, "", "no"], [exEnt, "", exYr, 22.37, 348.3, 348.3, 5200, "partial"]],
      "Summary totals only. Leave Facility blank for entity-level totals. S2 LB = S2 MB if no certificates held."
    );
    const wsS1 = makeWS(
      ["Entity Code", "Facility", "Year", "Category\n(stationary/mobile/fugitive/process)", "Fuel or Refrigerant", "Quantity", "Unit", "Emission Factor\n(kgCO2e per unit)", "tCO2e"],
      [[exEnt, "Singapore HQ", exYr, "stationary", "Natural Gas / PNG", 11000, "unit (m³)", 2.031, 22.34]],
      "One row per fuel type per facility per year. Category: stationary = boilers/gensets; mobile = fleet; fugitive = refrigerants."
    );
    const wsS2 = makeWS(
      ["Entity Code", "Facility", "Year", "Electricity\nConsumed (kWh)", "Grid / State\n(e.g. Singapore SP Group)", "Grid Emission Factor\n(kgCO2e per kWh)", "S2 Location-Based\n(tCO2e)", "Market Instrument\n(I-REC/PPA/None)", "Instrument MWh\nCovered", "S2 Market-Based\n(tCO2e)", "On-site Renewable\nGen (kWh)"],
      [[exEnt, "Singapore HQ", exYr, 600000, "SP Group (Singapore)", 0.4085, 245.1, "None", "", 245.1, ""], [exEnt, "London Office", exYr, 479000, "National Grid (UK)", 0.2156, 103.3, "None", "", 103.3, ""]],
      "One row per facility per year. Do NOT subtract on-site renewable from Electricity Consumed — put it in the last column."
    );
    const wsS3 = makeWS(
      ["Entity Code", "Year", "Category Number\n(1–15 or 0=total)", "Category Name", "Method", "tCO2e", "Assessed (Y/N)"],
      [[exEnt, exYr, 1, "Purchased Goods & Services", "spend-based", 3200, "Y"], [exEnt, exYr, 6, "Business Travel", "distance-based", 88, "Y"]],
      "One row per category per entity per year. Use Cat 0 'Unallocated Total' if only a grand S3 total is available."
    );
    const wsIM = makeWS(
      ["Entity Code", "Year", "Revenue", "Revenue Currency", "Employees (FTEs)", "Floor Space (m2)", "Production Qty", "Production Unit\n(e.g. units, chairs)", "Other Metric Name", "Other Metric Value"],
      [[exEnt, exYr, 12500000, "USD", 320, 4800, "", "", "", ""]],
      "Revenue in client's primary currency. Leave production blank for service entities."
    );
    const wsIrec = makeWS(
      ["Entity Code", "Facility\n(blank = entity-wide)", "Vintage Year", "Certificate Type", "MWh", "Registry ID / Certificate #", "Status\n(retired/held)"],
      [[exEnt, "", exYr, "I-REC (Type 1)", 500, "IREC-SG-2025-00001", "retired"]],
      "Leave this sheet empty if no renewable energy certificates are held."
    );
    const wsAct = makeWS(
      ["Entity Code", "Facility\n(blank = all)", "Action Name", "Category", "Status", "Target Year", "Est. tCO2e Reduction", "Capex", "Capex Currency", "Notes"],
      [[exEnt, "Singapore HQ", "Rooftop Solar 150 kWp", "renewable", "in-progress", 2026, 36, 850000, "USD", "Q2 FY26"], [exEnt, "", "LED Retrofit All Sites", "energy_efficiency", "planned", 2025, 12, 120000, "USD", ""]],
      "List every decarbonization initiative — planned, in-progress, or completed."
    );
    const wsPeers = makeWS(
      ["Company Name", "Year", "Scope 1+2\n(tCO2e)", "Scope 3\n(tCO2e)", "Total Emissions\nS1+S2+S3 (tCO2e)", "Revenue", "Revenue\nCurrency", "SBTi Target\nReduction %", "SBTi\nTarget Year", "Net Zero\nYear", "Emission Reduction\nvs Base Year %", "Intensity\n(tCO2e / Revenue unit)"],
      [["Competitor A", exYr, 5200, 2100, 7300, 18000000, "USD", 42, 2030, 2050, 14, ""]],
      "Optional. Fill from peer sustainability reports, CDP disclosures, or industry benchmarks."
    );

    XS.utils.book_append_sheet(wb, wsInstr, "Instructions");
    XS.utils.book_append_sheet(wb, wsGhg,   "GHG_Inventory");
    XS.utils.book_append_sheet(wb, wsS1,    "S1_Breakdown");
    XS.utils.book_append_sheet(wb, wsS2,    "S2_Breakdown");
    XS.utils.book_append_sheet(wb, wsS3,    "Scope3_Categories");
    XS.utils.book_append_sheet(wb, wsIM,    "Intensity_Metrics");
    XS.utils.book_append_sheet(wb, wsIrec,  "I-RECs");
    XS.utils.book_append_sheet(wb, wsAct,   "Actions");
    XS.utils.book_append_sheet(wb, wsPeers, "Peers");

    XS.writeFile(wb, `Decarb_Client_Template_${clientName.replace(/\s+/g, "_")}.xlsx`);
  }

  function exportTrackerXLSX() {
    // ── Helpers ───────────────────────────────────────────────────────────────
    const clientName = (ctx.client as any)?.name ?? "Client";
    const exportDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    function CL(idx: number): string {
      let l = "", n = idx;
      while (n >= 0) { l = String.fromCharCode((n % 26) + 65) + l; n = Math.floor(n / 26) - 1; }
      return l;
    }

    function WC(ws: any, addr: string, v: any, s: any, f?: string, z?: string) {
      const c: any = { s };
      if (f) { c.f = f; c.t = "n"; }
      else if (v === "" || v == null) { c.v = ""; c.t = "s"; }
      else if (typeof v === "number") { c.v = v; c.t = "n"; }
      else { c.v = String(v); c.t = "s"; }
      if (z) c.z = z;
      ws[addr] = c;
    }

    function MG(ws: any, r1: number, c1: number, r2: number, c2: number) {
      (ws["!merges"] = ws["!merges"] || []).push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
    }

    // ── Color palette ──────────────────────────────────────────────────────────
    const GRN = "27AE60", WHT = "FFFFFF", SBL = "A8B8CA", LGR = "F2F2F2",
          MGR = "BFBFBF", LGN = "C6EFCE", DGN = "A9D08E", TBG = "EEF9F0",
          EFY = "FFFDE7", EFB = "FAB019", DNV = "2C3E50", INF = "F8F9FA",
          SGR = "D9D9D9", BDR = "D0D0D0", ALT = "F0FFF4";

    const fnt = (sz: number, bold?: boolean, col?: string) => ({
      name: "Trebuchet MS", sz, bold: !!bold, ...(col ? { color: { rgb: col } } : {})
    });
    const fl  = (rgb: string) => ({ patternType: "solid" as const, fgColor: { rgb } });
    const tn  = (rgb: string) => ({ style: "thin" as const, color: { rgb } });
    const aln = (h: string, v = "center", wrap = false) => ({ horizontal: h, vertical: v, wrapText: wrap });

    const ST = {
      title:    (sz = 14) => ({ font: fnt(sz, true, WHT), fill: fl(GRN), alignment: aln("left", "center") }),
      sHdr:     (sz = 12) => ({ font: fnt(sz, true, WHT), fill: fl(GRN), alignment: aln("left", "center") }),
      yrBan:    ()        => ({ font: fnt(12, true),       fill: fl(SBL), alignment: aln("left", "center") }),
      colHdr:   ()        => ({ font: fnt(11, true),       fill: fl(LGR), alignment: aln("center", "center", true), border: { bottom: tn(BDR) } }),
      conHdr:   ()        => ({ font: fnt(11, true),       fill: fl(MGR), alignment: aln("center", "center", true) }),
      tcoHdr:   ()        => ({ font: fnt(11, true),       fill: fl(LGN), alignment: aln("center", "center", true) }),
      efIn:     ()        => ({ font: fnt(11),             fill: fl(EFY), alignment: aln("center"), border: { top: tn(EFB), bottom: tn(EFB), left: tn(EFB), right: tn(EFB) } }),
      monLbl:   ()        => ({ font: fnt(11),             fill: fl(INF), alignment: aln("center") }),
      dR:       ()        => ({ font: fnt(11),                            alignment: aln("right") }),
      dL:       ()        => ({ font: fnt(11),                            alignment: aln("left") }),
      dC:       ()        => ({ font: fnt(11),                            alignment: aln("center") }),
      dRA:      ()        => ({ font: fnt(11),             fill: fl(ALT), alignment: aln("right") }),
      tcoD:     ()        => ({ font: fnt(11),             fill: fl(TBG), alignment: aln("right") }),
      totLbl:   ()        => ({ font: fnt(12, true),       fill: fl(LGR), alignment: aln("left"),  border: { top: tn(BDR) } }),
      totVal:   ()        => ({ font: fnt(12, true),       fill: fl(LGR), alignment: aln("right"), border: { top: tn(BDR) } }),
      totTco:   ()        => ({ font: fnt(12, true),       fill: fl(DGN), alignment: aln("right"), border: { top: tn(BDR) } }),
      gtLbl:    ()        => ({ font: fnt(13, true, WHT),  fill: fl(DNV), alignment: aln("left") }),
      gtVal:    ()        => ({ font: fnt(13, true, WHT),  fill: fl(DNV), alignment: aln("right") }),
      inLbl:    ()        => ({ font: fnt(11),             fill: fl(INF), alignment: aln("left") }),
      inVal:    ()        => ({ font: fnt(11, true),       fill: fl(INF), alignment: aln("left") }),
      subH:     ()        => ({ font: fnt(12, true),       fill: fl(SBL), alignment: aln("left", "center") }),
      efRH:     ()        => ({ font: fnt(11, true),       fill: fl(SGR), alignment: aln("center", "center", true) }),
      note:     ()        => ({ font: { name: "Trebuchet MS", sz: 11, italic: true, color: { rgb: "666666" } }, alignment: aln("left") }),
      blank:    ()        => ({ font: fnt(11) }),
    };

    function getGEF(asset: DecarbAsset): { ef: number; src: string; utility: string; country: string } {
      const n = (asset.name ?? "").toLowerCase();
      if (n.includes("sp group") || n.includes("singapore"))
        return { ef: 0.4085, src: "EMA Singapore GEF 2023",         utility: "SP Group",        country: "Singapore" };
      if (n.includes("national grid") || n.includes("london") || n.includes("uk"))
        return { ef: 0.2156, src: "UK DEFRA 2024",                  utility: "National Grid",   country: "United Kingdom" };
      if (n.includes("con edison") || n.includes("new york"))
        return { ef: 0.2859, src: "EPA eGRID 2022 (NYUP)",          utility: "Con Edison",      country: "United States" };
      return   { ef: 0.4333, src: "IEA Emissions Factors 2022",     utility: "Grid",            country: "Global" };
    }

    const elecAssets = s2Assets.filter(a => !isSolarAsset(a));

    // ── Build Scope 1 sheet ───────────────────────────────────────────────────
    function buildS1(): [any, string] {
      const ws: any = {};
      let r = 0;

      WC(ws, `A1`, `${clientName}  |  Scope 1 Direct Emissions  |  ${fy}`, ST.title(14));
      MG(ws, r, 0, r, 5); r++;

      for (const [l, v] of [["Client:", clientName], ["Entity:", entity], ["Period:", fy], ["Exported:", exportDate]] as [string,string][]) {
        WC(ws, `A${r+1}`, l, ST.inLbl()); WC(ws, `B${r+1}`, v, ST.inVal()); MG(ws, r, 1, r, 3); r++;
      }
      r++;

      WC(ws, `A${r+1}`, "EMISSION FACTOR REFERENCE  (yellow = consultant-editable input)", ST.sHdr(12));
      MG(ws, r, 0, r, 5); r++;

      for (const [ci, h] of (["Emission Source", "Fuel Type", "Unit", "Emission Factor", "EF Unit", "Reference"] as string[]).entries())
        WC(ws, `${CL(ci)}${r+1}`, h, ST.efRH());
      r++;

      const EF_ROW = r + 1;
      const EF_CELL = `D${EF_ROW}`;
      WC(ws, `A${EF_ROW}`, "Stationary Combustion",          ST.dL());
      WC(ws, `B${EF_ROW}`, "Natural Gas / PNG",              ST.dL());
      WC(ws, `C${EF_ROW}`, "unit (m³/L)",              ST.dC());
      WC(ws, `D${EF_ROW}`, 0.002031,                         ST.efIn(), undefined, "0.000000");
      WC(ws, `E${EF_ROW}`, "tCO₂e/unit",               ST.dC());
      WC(ws, `F${EF_ROW}`, "IPCC 2006 / NEA Singapore 2023", ST.dL());
      r++;

      WC(ws, `A${r+1}`, "⚠  Verify unit matches data collection (m³ or litre).", ST.note());
      MG(ws, r, 0, r, 5); r++;
      r++;

      const tco2Parts: string[] = [];

      for (const asset of s1Assets) {
        const s = asset.series ?? {};
        const unit = resolveAssetUnit(asset);

        WC(ws, `A${r+1}`, `▸  ${asset.name ?? "Asset"}  —  ${asset.facility ?? ""}`, ST.sHdr(12));
        MG(ws, r, 0, r, 5); r++;

        const hdrs = ["Month", `Consumption\n(${unit})`, `EF Ref\n(tCO₂e/unit)`, `Scope 1 Emissions\n(tCO₂e)`, "", ""];
        for (let ci = 0; ci < 6; ci++) {
          const st = ci === 1 ? ST.conHdr() : ci === 3 ? ST.tcoHdr() : ST.colHdr();
          WC(ws, `${CL(ci)}${r+1}`, hdrs[ci], st);
        }
        r++;

        const dStart = r + 1;
        for (let mi = 0; mi < months.length; mi++) {
          const m = months[mi];
          const v = s[m.key] != null ? Number(s[m.key]) : 0;
          const tint = mi % 2 === 1;
          WC(ws, `A${r+1}`, m.short, ST.monLbl());
          WC(ws, `B${r+1}`, v || "", v ? (tint ? ST.dRA() : ST.dR()) : ST.blank(), undefined, v ? "#,##0" : undefined);
          WC(ws, `C${r+1}`, undefined, ST.dC(), `$${EF_CELL}`, "0.000000");
          WC(ws, `D${r+1}`, undefined, ST.tcoD(), `IF(B${r+1}=0,0,B${r+1}*$${EF_CELL})`, "0.000");
          r++;
        }
        const dEnd = r;

        WC(ws, `A${r+1}`, "Total", ST.totLbl()); MG(ws, r, 0, r, 1);
        WC(ws, `B${r+1}`, undefined, ST.totVal(), `SUM(B${dStart}:B${dEnd})`, "#,##0");
        WC(ws, `C${r+1}`, "", ST.totVal());
        WC(ws, `D${r+1}`, undefined, ST.totTco(), `SUM(D${dStart}:D${dEnd})`, "0.000");
        tco2Parts.push(`SUM(D${dStart}:D${dEnd})`);
        r++;
        r++;
      }

      const gtRow = r + 1;
      WC(ws, `A${gtRow}`, "GRAND TOTAL  —  Scope 1 Direct Emissions", ST.gtLbl()); MG(ws, r, 0, r, 2);
      WC(ws, `D${gtRow}`, undefined, ST.gtVal(), tco2Parts.join("+") || "0", "0.000");
      r++;

      ws["!cols"] = [{ wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 36 }];
      ws["!rows"] = [{ hpx: 26 }];
      ws["!ref"] = `A1:F${r}`;
      return [ws, `'Scope 1'!D${gtRow}`];
    }

    // ── Build Scope 2 sheet ───────────────────────────────────────────────────
    function buildS2(): [any, string, string] {
      const ws: any = {};
      let r = 0;

      WC(ws, `A1`, `${clientName}  |  Scope 2 Purchased Energy  |  ${fy}`, ST.title(14));
      MG(ws, r, 0, r, 7); r++;

      for (const [l, v] of [["Client:", clientName], ["Entity:", entity], ["Period:", fy], ["Exported:", exportDate]] as [string,string][]) {
        WC(ws, `A${r+1}`, l, ST.inLbl()); WC(ws, `B${r+1}`, v, ST.inVal()); MG(ws, r, 1, r, 5); r++;
      }
      r++;

      WC(ws, `A${r+1}`, "GRID EMISSION FACTOR REFERENCE  (yellow = consultant-editable input)", ST.sHdr(12));
      MG(ws, r, 0, r, 7); r++;

      const ef2Hdrs = ["Electricity Source", "Utility", "Country", "Grid EF (kgCO₂e/kWh)", "EF Unit", "Reference", "Year", ""];
      for (let ci = 0; ci < 8; ci++) WC(ws, `${CL(ci)}${r+1}`, ef2Hdrs[ci] ?? "", ST.efRH());
      r++;

      const efCells = new Map<string, string>();
      for (const asset of elecAssets) {
        const gef = getGEF(asset);
        const efRow = r + 1;
        WC(ws, `A${efRow}`, asset.name ?? "",       ST.dL());
        WC(ws, `B${efRow}`, gef.utility,            ST.dL());
        WC(ws, `C${efRow}`, gef.country,            ST.dC());
        WC(ws, `D${efRow}`, gef.ef,                 ST.efIn(), undefined, "0.0000");
        WC(ws, `E${efRow}`, "kgCO₂e/kWh",      ST.dC());
        WC(ws, `F${efRow}`, gef.src,                ST.dL());
        WC(ws, `G${efRow}`, "2023/2024",             ST.dC());
        efCells.set(asset.id, `D${efRow}`);
        r++;
      }

      WC(ws, `A${r+1}`, "⚠  LB = Location-Based (grid EF applied).  MB = Market-Based (residual mix; EAC/PPA instruments credited).", ST.note());
      MG(ws, r, 0, r, 7); r++;
      r++;

      // ── Section A: Location-Based ──────────────────────────────────────────
      WC(ws, `A${r+1}`, "▸  SECTION A — LOCATION-BASED (LB) METHOD", ST.sHdr(12));
      MG(ws, r, 0, r, 7); r++;

      const lbFirst: number[] = [], lbLast: number[] = [];

      for (const asset of elecAssets) {
        const s = asset.series ?? {};
        const efC = efCells.get(asset.id) ?? "D10";
        const unit = resolveAssetUnit(asset);

        WC(ws, `A${r+1}`, `${asset.name ?? "Source"}  —  ${asset.facility ?? ""}`, ST.subH());
        MG(ws, r, 0, r, 7); r++;

        const hdrs = ["Month", `Consumed LB\n(${unit})`, `Grid EF\n(kgCO₂e/kWh)`, `LB Emissions\n(tCO₂e)`, "", "", "", ""];
        for (let ci = 0; ci < 8; ci++) {
          const st = ci === 1 ? ST.conHdr() : ci === 3 ? ST.tcoHdr() : ST.colHdr();
          WC(ws, `${CL(ci)}${r+1}`, hdrs[ci], st);
        }
        r++;

        const dStart = r + 1;
        lbFirst.push(dStart);
        for (let mi = 0; mi < months.length; mi++) {
          const m = months[mi];
          const lbV = s[`${m.key}__lb`] != null ? Number(s[`${m.key}__lb`]) : (s[m.key] != null ? Number(s[m.key]) : 0);
          const tint = mi % 2 === 1;
          WC(ws, `A${r+1}`, m.short, ST.monLbl());
          WC(ws, `B${r+1}`, lbV || "", lbV ? (tint ? ST.dRA() : ST.dR()) : ST.blank(), undefined, lbV ? "#,##0" : undefined);
          WC(ws, `C${r+1}`, undefined, ST.dC(), `$${efC}`, "0.0000");
          WC(ws, `D${r+1}`, undefined, ST.tcoD(), `IF(B${r+1}=0,0,B${r+1}*$${efC}/1000)`, "0.000");
          r++;
        }
        const dEnd = r;
        lbLast.push(dEnd);

        WC(ws, `A${r+1}`, `Total — ${asset.name ?? ""}`, ST.totLbl()); MG(ws, r, 0, r, 1);
        WC(ws, `B${r+1}`, undefined, ST.totVal(),  `SUM(B${dStart}:B${dEnd})`, "#,##0");
        WC(ws, `C${r+1}`, "",        ST.totVal());
        WC(ws, `D${r+1}`, undefined, ST.totTco(), `SUM(D${dStart}:D${dEnd})`, "0.000");
        r++;
        r++;
      }

      const lbGtRow = r + 1;
      WC(ws, `A${lbGtRow}`, "TOTAL  —  Scope 2 Location-Based Emissions", ST.gtLbl()); MG(ws, r, 0, r, 2);
      WC(ws, `D${lbGtRow}`, undefined, ST.gtVal(), lbFirst.map((f, i) => `SUM(D${f}:D${lbLast[i]})`).join("+") || "0", "0.000");
      const s2LbCell = `'Scope 2'!D${lbGtRow}`;
      r++;
      r++;

      // ── Section B: Market-Based ────────────────────────────────────────────
      WC(ws, `A${r+1}`, "▸  SECTION B — MARKET-BASED (MB) METHOD", ST.sHdr(12));
      MG(ws, r, 0, r, 7); r++;

      const mbFirst: number[] = [], mbLast: number[] = [];

      for (const asset of elecAssets) {
        const s = asset.series ?? {};
        const efC = efCells.get(asset.id) ?? "D10";

        WC(ws, `A${r+1}`, `${asset.name ?? "Source"}  —  ${asset.facility ?? ""}`, ST.subH());
        MG(ws, r, 0, r, 7); r++;

        const hdrs = ["Month", "Total kWh", "Renewable kWh\n(EAC/PPA)", `MB Emissions\n(tCO₂e)`, "", "", "", ""];
        for (let ci = 0; ci < 8; ci++) {
          const st = ci === 1 || ci === 2 ? ST.conHdr() : ci === 3 ? ST.tcoHdr() : ST.colHdr();
          WC(ws, `${CL(ci)}${r+1}`, hdrs[ci], st);
        }
        r++;

        const mStart = r + 1;
        mbFirst.push(mStart);
        for (let mi = 0; mi < months.length; mi++) {
          const m = months[mi];
          const lb = s[`${m.key}__lb`] != null ? Number(s[`${m.key}__lb`]) : 0;
          const mb = s[`${m.key}__mb`] != null ? Number(s[`${m.key}__mb`]) : 0;
          const tint = mi % 2 === 1;
          WC(ws, `A${r+1}`, m.short, ST.monLbl());
          WC(ws, `B${r+1}`, lb || "", lb ? (tint ? ST.dRA() : ST.dR()) : ST.blank(), undefined, lb ? "#,##0" : undefined);
          WC(ws, `C${r+1}`, mb || "", mb ? (tint ? ST.dRA() : ST.dR()) : ST.blank(), undefined, mb ? "#,##0" : undefined);
          WC(ws, `D${r+1}`, undefined, ST.tcoD(), `IF(B${r+1}=0,0,MAX(0,(B${r+1}-C${r+1})*$${efC}/1000))`, "0.000");
          r++;
        }
        const mEnd = r;
        mbLast.push(mEnd);

        WC(ws, `A${r+1}`, `Total — ${asset.name ?? ""}`, ST.totLbl()); MG(ws, r, 0, r, 1);
        WC(ws, `B${r+1}`, undefined, ST.totVal(),  `SUM(B${mStart}:B${mEnd})`, "#,##0");
        WC(ws, `C${r+1}`, undefined, ST.totVal(),  `SUM(C${mStart}:C${mEnd})`, "#,##0");
        WC(ws, `D${r+1}`, undefined, ST.totTco(), `SUM(D${mStart}:D${mEnd})`, "0.000");
        r++;
        r++;
      }

      const mbGtRow = r + 1;
      WC(ws, `A${mbGtRow}`, "TOTAL  —  Scope 2 Market-Based Emissions", ST.gtLbl()); MG(ws, r, 0, r, 2);
      WC(ws, `D${mbGtRow}`, undefined, ST.gtVal(), mbFirst.map((f, i) => `SUM(D${f}:D${mbLast[i]})`).join("+") || "0", "0.000");
      const s2MbCell = `'Scope 2'!D${mbGtRow}`;
      r++;

      ws["!cols"] = [{ wch: 13 }, { wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      ws["!rows"] = [{ hpx: 26 }];
      ws["!ref"] = `A1:H${r}`;
      return [ws, s2LbCell, s2MbCell];
    }

    // ── Build Cover sheet ─────────────────────────────────────────────────────
    function buildCover(s1Cell: string, s2LbCell: string, s2MbCell: string): any {
      const ws: any = {};
      let r = 0;

      WC(ws, `A1`, `${clientName}  —  GHG Emissions Inventory Report`, ST.title(15));
      MG(ws, r, 0, r, 5); r++;

      WC(ws, `A${r+1}`, `Reporting Period: ${fy}  |  Entity: ${entity}  |  Generated: ${exportDate}`, ST.yrBan());
      MG(ws, r, 0, r, 5); r++;
      r++;

      const metaRows: [string, string][] = [
        ["Client Name", clientName], ["Reporting Entity", entity],
        ["Fiscal Year", fy],         ["Standard", "GHG Protocol Corporate Standard"],
        ["Boundary", "Operational Control"], ["Base Year", fy],
      ];
      for (let i = 0; i < metaRows.length; i += 2) {
        WC(ws, `A${r+1}`, metaRows[i][0],   ST.inLbl()); WC(ws, `B${r+1}`, metaRows[i][1],   ST.inVal()); MG(ws, r, 1, r, 2);
        WC(ws, `D${r+1}`, metaRows[i+1][0], ST.inLbl()); WC(ws, `E${r+1}`, metaRows[i+1][1], ST.inVal()); MG(ws, r, 4, r, 5);
        r++;
      }
      r++;

      WC(ws, `A${r+1}`, `▸  GHG EMISSIONS SUMMARY  —  ${fy}`, ST.sHdr(13));
      MG(ws, r, 0, r, 5); r++;

      const sumHdrs = ["Scope", "Method", "Emission Source", "tCO₂e Total", "Notes", ""];
      for (let ci = 0; ci < 6; ci++) {
        WC(ws, `${CL(ci)}${r+1}`, sumHdrs[ci], ci === 3 ? ST.tcoHdr() : ST.colHdr());
      }
      r++;

      const summData: [string, string, string, string, string][] = [
        ["Scope 1", "Direct",         "Stationary Combustion (Natural Gas)",    `=${s1Cell}`,    ""],
        ["Scope 2", "Location-Based", "Purchased Electricity (3 facilities)",   `=${s2LbCell}`,  "SP Group (SG), National Grid (UK), Con Edison (US)"],
        ["Scope 2", "Market-Based",   "Purchased Electricity (3 facilities)",   `=${s2MbCell}`,  "No renewable instruments claimed"],
      ];
      for (const [sc, meth, src, formula, note] of summData) {
        WC(ws, `A${r+1}`, sc,   ST.dL());
        WC(ws, `B${r+1}`, meth, ST.dC());
        WC(ws, `C${r+1}`, src,  ST.dL());
        WC(ws, `D${r+1}`, undefined, ST.tcoD(), formula, "0.000");
        WC(ws, `E${r+1}`, note, ST.dL());
        r++;
      }

      WC(ws, `A${r+1}`, "Scope 1 + 2",   ST.totLbl()); MG(ws, r, 0, r, 1);
      WC(ws, `B${r+1}`, "",              ST.totVal());
      WC(ws, `C${r+1}`, "LB Combined",   ST.totVal());
      WC(ws, `D${r+1}`, undefined, ST.totTco(), `=${s1Cell}+${s2LbCell}`, "0.000");
      WC(ws, `E${r+1}`, "Location-Based Method total", ST.totVal()); r++;

      WC(ws, `A${r+1}`, "Scope 1 + 2",   ST.totLbl()); MG(ws, r, 0, r, 1);
      WC(ws, `B${r+1}`, "",              ST.totVal());
      WC(ws, `C${r+1}`, "MB Combined",   ST.totVal());
      WC(ws, `D${r+1}`, undefined, ST.totTco(), `=${s1Cell}+${s2MbCell}`, "0.000");
      WC(ws, `E${r+1}`, "Market-Based Method total", ST.totVal()); r++;
      r++;

      for (const txt of [
        "ⓘ  Emission factors are editable — update yellow cells on the Scope 1 and Scope 2 sheets to recalculate all tCO₂e figures automatically.",
        "   Raw monthly activity data submitted by client through the Deepwoods Green GHG data portal.",
        `   Deepwoods Green Consulting  ·  GHG Protocol Corporate Standard  ·  Prepared ${exportDate}`,
      ]) { WC(ws, `A${r+1}`, txt, ST.note()); MG(ws, r, 0, r, 5); r++; }

      ws["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 34 }, { wch: 18 }, { wch: 44 }, { wch: 10 }];
      ws["!rows"] = [{ hpx: 28 }, { hpx: 20 }];
      ws["!ref"] = `A1:F${r}`;
      return ws;
    }

    // ── Build Emission Factors reference sheet ─────────────────────────────────
    function buildEFSheet(): any {
      const ws: any = {};
      let r = 0;

      WC(ws, `A1`, "Emission Factor Reference  —  GHG Protocol / IPCC AR6 / National Inventories", ST.title(13));
      MG(ws, r, 0, r, 6); r++;
      r++;

      WC(ws, `A${r+1}`, "SCOPE 1  —  STATIONARY COMBUSTION", ST.sHdr(12));
      MG(ws, r, 0, r, 6); r++;
      for (const [ci, h] of (["#", "Fuel Type", "Unit", "Emission Factor", "EF Unit", "Source / Reference", "Year"] as string[]).entries())
        WC(ws, `${CL(ci)}${r+1}`, h, ST.efRH());
      r++;
      for (const row of [
        [1, "Natural Gas (PNG)", "unit (m³)", 0.002031, "tCO₂e/m³", "IPCC 2006 / NEA Singapore GHG Inventory", "2023"],
        [2, "Diesel",            "litre",          0.002654, "tCO₂e/L",        "UK DEFRA 2024 / IPCC 2006",               "2024"],
        [3, "Petrol (Gasoline)", "litre",          0.002312, "tCO₂e/L",        "UK DEFRA 2024",                           "2024"],
        [4, "LPG",               "kg",             0.001557, "tCO₂e/kg",       "IPCC 2006, AR5 GWPs",                     "2022"],
      ] as const) {
        for (let ci = 0; ci < row.length; ci++)
          WC(ws, `${CL(ci)}${r+1}`, row[ci], ci === 3 ? ST.efIn() : ST.dC(), undefined, ci === 3 ? "0.000000" : undefined);
        r++;
      }
      r++;

      WC(ws, `A${r+1}`, "SCOPE 2  —  GRID ELECTRICITY EMISSION FACTORS", ST.sHdr(12));
      MG(ws, r, 0, r, 6); r++;
      for (const [ci, h] of (["#", "Country / Grid", "Utility", "Emission Factor", "EF Unit", "Source / Reference", "Year"] as string[]).entries())
        WC(ws, `${CL(ci)}${r+1}`, h, ST.efRH());
      r++;
      for (const row of [
        [1, "Singapore",                    "SP Group",         0.4085, "kgCO₂e/kWh", "EMA Singapore GEF 2023",             "2023"],
        [2, "United Kingdom",               "National Grid",    0.2156, "kgCO₂e/kWh", "UK DEFRA Conversion Factors 2024",   "2024"],
        [3, "United States — New York", "Con Edison NYUP", 0.2859, "kgCO₂e/kWh", "EPA eGRID 2022, NYUP region",        "2022"],
        [4, "World Average",                "—",            0.4333, "kgCO₂e/kWh", "IEA Emissions Factors 2022",         "2022"],
      ] as const) {
        for (let ci = 0; ci < row.length; ci++)
          WC(ws, `${CL(ci)}${r+1}`, row[ci], ci === 3 ? ST.efIn() : ST.dC(), undefined, ci === 3 ? "0.0000" : undefined);
        r++;
      }
      r++;

      WC(ws, `A${r+1}`, "⚠ Yellow cells are the EF inputs used in Scope 1 and Scope 2 calculations. Update them on those sheets to recalculate all tCO₂e.", ST.note());
      MG(ws, r, 0, r, 6); r++;

      ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 38 }, { wch: 8 }];
      ws["!ref"] = `A1:G${r}`;
      return ws;
    }

    // ── Assemble and write ────────────────────────────────────────────────────
    const [ws1, s1Cell]             = buildS1();
    const [ws2, s2LbCell, s2MbCell] = buildS2();
    const wsCover                   = buildCover(s1Cell, s2LbCell, s2MbCell);
    const wsEF                      = buildEFSheet();
    const wb                        = (XLSXStyle as any).utils.book_new();

    (XLSXStyle as any).utils.book_append_sheet(wb, wsCover, "Cover");
    (XLSXStyle as any).utils.book_append_sheet(wb, ws1,     "Scope 1");
    (XLSXStyle as any).utils.book_append_sheet(wb, ws2,     "Scope 2");
    (XLSXStyle as any).utils.book_append_sheet(wb, wsEF,    "Emission Factors");
    (XLSXStyle as any).writeFile(wb, `${clientName}_${entity}_${fy}_GHG_S1S2.xlsx`);
  }

  const overallPct = calcProgress(assets, months);

  const facilityNames = (() => {
    const seen = new Map<string, string>();
    for (const a of assets) {
      if (a.facility) {
        const k = a.facility.trim().toLowerCase();
        if (!seen.has(k)) seen.set(k, a.facility.trim());
      }
    }
    return [...seen.values()];
  })();

  // Gaps only count genuinely missing data — a derived (annual÷months) fill
  // is not a gap, it just means no independent monthly reading exists yet.
  const gaps = assets.flatMap(a => {
    const series = a.series ?? {};
    if (isAnnual(a) && !hasAnyMonthlyData(a, months)) {
      return series["annual"] == null
        ? [{ id: a.id, name: a.name, facility: a.facility, month: "Annual" }]
        : [];
    }
    return months
      .filter(m => getDisplayMonthVal(a, months, m.key).value == null)
      .map(m => ({ id: a.id, name: a.name, facility: a.facility, month: m.short }));
  });

  async function sendReminder() {
    setSendingReminder(true);
    try {
      await authFetch("tracker-reminder.php", {
        method: "POST",
        body: JSON.stringify({ entity, fy, client_id: ctx?.client?.id }),
      });
      toast.success("Reminder sent to data submitters");
    } catch {
      toast.error("Failed to send reminder");
    } finally {
      setSendingReminder(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-[52px] z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3">
          <div>
            <h1 className="text-xl font-bold text-navy">Data Collection Tracker</h1>
            <p className="text-xs text-muted-foreground">
              Consultant view · {assets.length} equipment sources · {fy}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <ProgressRing value={overallPct} size={52} />
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileBarChart2 className="h-3.5 w-3.5" /> Generate Interim Report
            </Button>
            <Button size="sm" className="gap-1.5" onClick={exportTrackerXLSX} disabled={!assets.length}>
              <Download className="h-3.5 w-3.5" /> Export S1 &amp; S2 (XLSX)
            </Button>
            {/* Hidden file input for ledger upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChosen(f); }}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={downloadClientTemplate}
              title="Download blank client data template (.xlsx)"
            >
              <Download className="h-3.5 w-3.5" />
              Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-dashed"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {importing ? "Parsing…" : "Import Ledger"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px] gap-4 px-4 py-4">
        {/* Sidebar */}
        <aside className={cn("shrink-0 space-y-2 transition-all", sidebarOpen ? "w-[220px]" : "w-12")}>
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Facilities</span>
            )}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="rounded-md border border-input px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent"
            >{sidebarOpen ? "«" : "»"}</button>
          </div>

          {sidebarOpen && facilityNames.map(name => {
            const fAssets = assets.filter(a => a.facility?.trim().toLowerCase() === name.trim().toLowerCase());
            const pct = Math.round(calcProgress(fAssets, months) * 100);
            const fRow = facilities.find(f => f.name === name);
            return (
              <div key={name} className="flex items-center justify-between rounded-md border bg-card px-2.5 py-2 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-navy truncate">{name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {fRow?.grid_utility ?? `${fAssets.length} sources`}
                  </div>
                </div>
                <Badge variant="outline" className="ml-2 shrink-0 tabular-nums">{pct}%</Badge>
              </div>
            );
          })}

          {sidebarOpen && gaps.length > 0 && (
            <div className="mt-4 space-y-2 rounded-md border bg-critical-soft/60 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-critical">
                <AlertTriangle className="h-3.5 w-3.5" />
                Data Gaps ({gaps.length})
              </div>
              <ul className="max-h-48 space-y-1 overflow-auto text-[11px] text-muted-foreground">
                {gaps.slice(0, 30).map((g, i) => (
                  <li key={i} className="truncate">
                    <span className="font-mono text-[10px]">{g.id}</span> · {g.month}
                  </li>
                ))}
                {gaps.length > 30 && <li className="italic">+ {gaps.length - 30} more…</li>}
              </ul>
              <Button
                size="sm"
                variant="outline"
                disabled={sendingReminder}
                onClick={sendReminder}
                className="mt-2 w-full gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                {sendingReminder ? "Sending…" : "Send reminder"}
              </Button>
            </div>
          )}

          {sidebarOpen && gaps.length === 0 && assets.length > 0 && (
            <div className="mt-4 flex items-center gap-2 rounded-md border bg-ghg-green-soft p-3 text-xs font-semibold text-ghg-green">
              <CheckCircle2 className="h-3.5 w-3.5" /> All data complete
            </div>
          )}
        </aside>

        {/* Main content — 3 tabs */}
        <div className="min-w-0 flex-1">
          <Tabs defaultValue="s1">
            <TabsList>
              <TabsTrigger value="s1" className="gap-1.5">
                Scope 1
                <Badge variant="secondary" className="text-[10px]">{s1Assets.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="s2" className="gap-1.5">
                Scope 2
                <Badge variant="secondary" className="text-[10px]">{s2Assets.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="s3" className="gap-1.5">
                Scope 3
                <Badge variant="secondary" className="text-[10px]">{s3Assets.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="s1" className="mt-3">
              <ScopeTrackerGrid assets={s1Assets} months={months} />
            </TabsContent>
            <TabsContent value="s2" className="mt-3">
              <ScopeTrackerGrid assets={s2Assets} months={months} />
            </TabsContent>
            <TabsContent value="s3" className="mt-3">
              {s3Assets.length > 0 ? (
                <ScopeTrackerGrid assets={s3Assets} months={months} />
              ) : (
                <div className="rounded-lg border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    Scope 3 data is collected through the submission wizard.
                  </p>
                  <a
                    href="/submissions"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    Go to Scope 3 Submission →
                  </a>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <p className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-flex h-5 w-7 items-center justify-center rounded text-[9px] font-bold" style={{ background: "#c6efce", color: "#375623" }}>✓</span>
              received
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-flex h-5 w-7 items-center justify-center rounded text-[9px] font-bold" style={{ background: "#ffc7ce", color: "#9c0006" }}>✗</span>
              missing
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-flex h-5 w-7 items-center justify-center rounded border border-dashed border-amber-warn/60 text-[9px] font-bold" style={{ background: "#ffeb9c", color: "#9c6500" }}>~</span>
              estimated
            </span>
          </p>
        </div>
      </div>

      {/* ── Ledger import preview dialog ─────────────────────────────────────── */}
      <Dialog open={importDialogOpen} onOpenChange={open => { if (!importing) { setImportDialogOpen(open); if (!open) { setImportPreview(null); setPendingFile(null); } } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Ledger Import</DialogTitle>
            <DialogDescription>
              Review the data that will be written to the database before confirming.
            </DialogDescription>
          </DialogHeader>

          {importPreview && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border bg-neutral-soft p-3">
                <span className="text-muted-foreground">Entity</span>
                <span className="font-semibold">{importPreview.entity}</span>
                <span className="text-muted-foreground">Year</span>
                <span className="font-semibold">{importPreview.year}</span>
                <span className="text-muted-foreground">Facilities found</span>
                <span className="font-semibold">{importPreview.facilityCount}</span>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Records to write</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border bg-card p-3 text-xs">
                {importPreview.templateFormat === "client-template" && (
                  <><span className="col-span-2 mb-0.5 font-semibold text-ghg-green text-[11px]">Client Template Format Detected</span></>
                )}
                <span className="text-muted-foreground">GHG inventory rows</span>
                <span className="tabular-nums">{importPreview.ghgInventory.length}</span>
                <span className="text-muted-foreground">S1 by facility</span>
                <span className="tabular-nums">{importPreview.s1ByFacility.length}</span>
                <span className="text-muted-foreground">S2 by facility</span>
                <span className="tabular-nums">{importPreview.s2ByFacility.length}</span>
                <span className="text-muted-foreground">Scope 3 categories</span>
                <span className="tabular-nums">{importPreview.scope3Summary.length}</span>
                <span className="text-muted-foreground">Assets created</span>
                <span className="tabular-nums">{importPreview.trackerAssets.length}</span>
                <span className="text-muted-foreground">Annual data entries</span>
                <span className="tabular-nums font-semibold">{importPreview.monthlyEntries}</span>
                {(importPreview.decarbActions?.length ?? 0) > 0 && <>
                  <span className="text-muted-foreground">Actions</span>
                  <span className="tabular-nums">{importPreview.decarbActions!.length}</span>
                </>}
                {(importPreview.irecRegister?.length ?? 0) > 0 && <>
                  <span className="text-muted-foreground">I-RECs / certificates</span>
                  <span className="tabular-nums">{importPreview.irecRegister!.length}</span>
                </>}
                {(importPreview.peerData?.length ?? 0) > 0 && <>
                  <span className="text-muted-foreground">Peer benchmarks</span>
                  <span className="tabular-nums">{importPreview.peerData!.length}</span>
                </>}
              </div>

              {importPreview.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-warn/40 bg-amber-soft/30 p-3">
                  <p className="mb-1 text-xs font-semibold text-amber-warn">Warnings ({importPreview.warnings.length})</p>
                  <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                    {importPreview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={confirmImport} disabled={importing}>
              {importing ? "Importing…" : "Confirm Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
