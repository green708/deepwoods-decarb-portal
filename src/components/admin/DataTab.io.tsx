import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Download, FileUp, Loader2 } from "lucide-react";
import { API_BASE, authFetch, getToken } from "@/lib/auth";
import { parseLedger, type LedgerParseResult } from "@/lib/ledger-parser";
import {
  INPUT, PRIMARY_BTN, SECONDARY_BTN, Section, fyOptions, useClientEntityList, type ClientTabProps,
} from "@/components/admin/ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntitySelect, LabeledControl } from "@/components/admin/DataTab.shared";

type Props = Pick<ClientTabProps, "clientId" | "clientName" | "reportingPeriod" | "fy">;

function ExportCard({ clientId, reportingPeriod, fy }: Props) {
  const { entities } = useClientEntityList(clientId, fy);
  const [entity, setEntity] = useState("");
  const [exportFy, setExportFy] = useState(fy);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setExportFy(fy); }, [fy]);

  const download = async () => {
    if (!entity) return;
    setBusy(true);
    try {
      const token = getToken();
      const res = await fetch(
        `${API_BASE}/data-tracker/export.php?client_id=${clientId}&entity=${encodeURIComponent(entity)}&fy=${encodeURIComponent(exportFy)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const text = await blob.text();
      const dataRows = text.split(/\r?\n/).filter((l) => l.trim()).length - 1;
      if (dataRows < 1) {
        toast.info(`No tracker data for ${entity} in ${exportFy}. Nothing was downloaded.`);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tracker_${entity}_${exportFy}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${dataRows} tracker row${dataRows === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  };

  const fyChoices = Array.from(new Set([...fyOptions(reportingPeriod, fy), exportFy]));

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-sm font-semibold text-[var(--navy)]">Export tracker data</h3>
      <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Download the monthly values the client has entered, as CSV.</p>
      <div className="space-y-3">
        <LabeledControl htmlFor="export-entity" label="Entity">
          <EntitySelect id="export-entity" value={entity} onChange={setEntity} entities={entities} />
        </LabeledControl>
        <LabeledControl htmlFor="export-fy" label="Fiscal year">
          <select id="export-fy" className={INPUT} value={exportFy} onChange={(e) => setExportFy(e.target.value)}>
            {fyChoices.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </LabeledControl>
        <button type="button" className={PRIMARY_BTN} onClick={download} disabled={!entity || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download CSV
        </button>
      </div>
    </div>
  );
}

function ImportCard({ clientId, clientName, reportingPeriod, fy }: Props) {
  const qc = useQueryClient();
  const { entities } = useClientEntityList(clientId, fy);
  const fileRef = useRef<HTMLInputElement>(null);
  const [entity, setEntity] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<LedgerParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setParseError(null);
    setParsing(true);
    try {
      const parsed = await parseLedger(f, entity, reportingPeriod, clientId);
      if (!parsed.year) { setParseError("Could not detect the fiscal year. Check that this is the calculated-results client template."); return; }
      setFileName(f.name);
      setPreview(parsed);
    } catch (e) {
      setParseError(`Could not read this file: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await authFetch("import/ledger.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_client_id: clientId,
          entity: preview.entity,
          year: preview.year,
          ghg_inventory: preview.ghgInventory,
          s1_by_facility: preview.s1ByFacility,
          s2_by_facility: preview.s2ByFacility,
          s2_breakdown: preview.s2Breakdown,
          scope3_summary: preview.scope3Summary,
          intensity_metrics: preview.intensityMetrics,
          tracker_assets: [],
          tracker_drafts: [],
          irec_register: preview.irecRegister ?? [],
          decarb_actions: preview.decarbActions ?? [],
          peer_data: preview.peerData ?? [],
        }),
      });
      const c = res.counts ?? {};
      toast.success(`Imported ${preview.entity} ${preview.year}: ${c.ghg_inventory ?? 0} inventory rows, ${c.s1_by_facility ?? 0} Scope 1 and ${c.s2_by_facility ?? 0} Scope 2 facility rows`);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["ghg-inventory"] });
      qc.invalidateQueries({ queryKey: ["admin-calc-status", clientId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const rows: [string, number][] = preview ? [
    ["Inventory rows", preview.ghgInventory.length],
    ["Scope 1 facility rows", preview.s1ByFacility.length],
    ["Scope 2 facility rows", preview.s2ByFacility.length],
    ["Scope 3 categories", preview.scope3Summary.length],
    ["I-REC rows", preview.irecRegister?.length ?? 0],
    ["Reduction actions", preview.decarbActions?.length ?? 0],
    ["Peers", preview.peerData?.length ?? 0],
  ] : [];

  const entityName = entities.find((e) => e.code === preview?.entity)?.name ?? preview?.entity;

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-sm font-semibold text-[var(--navy)]">Import calculated results</h3>
      <p className="mt-0.5 mb-4 text-xs text-muted-foreground">
        After calculating offline, upload the completed client template. It fills the client's dashboards, inventory and reports, and does not touch their tracker submissions.
      </p>
      <div className="space-y-3">
        <LabeledControl htmlFor="import-entity" label="Entity">
          <EntitySelect id="import-entity" value={entity} onChange={(v) => { setEntity(v); setParseError(null); }} entities={entities} />
        </LabeledControl>
        <div>
          <input
            ref={fileRef}
            id="import-file"
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            disabled={!entity || parsing}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
          <label
            htmlFor="import-file"
            className={`${SECONDARY_BTN} ${!entity || parsing ? "pointer-events-none opacity-50" : "cursor-pointer"} focus-within:ring-2 focus-within:ring-[#1E6F5C]`}
          >
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {parsing ? "Reading file…" : "Choose template (.xlsx)"}
          </label>
          {!entity && <p className="mt-1 text-[11px] text-muted-foreground">Choose an entity first.</p>}
        </div>
        {parseError && <p className="text-xs text-red-600" role="alert">{parseError}</p>}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o && !importing) setPreview(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm import</DialogTitle>
            <DialogDescription>{clientName} / {entityName} / {preview?.year} / {fileName}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {rows.map(([label, n]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className={`font-bold tabular-nums ${n > 0 ? "text-[#1E6F5C]" : "text-slate-300"}`}>{n}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Importing replaces the calculated results the client currently sees for {entityName} in {preview?.year}.
              {preview && preview.year !== fy && <> The file is for {preview.year}, which is not the year selected above ({fy}).</>}
            </div>
          </div>
          <DialogFooter>
            <button type="button" className={SECONDARY_BTN} onClick={() => setPreview(null)} disabled={importing}>Cancel</button>
            <button type="button" className={PRIMARY_BTN} onClick={doImport} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 animate-spin" />} {importing ? "Importing…" : "Confirm import"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function IoSection(props: Props) {
  return (
    <Section title="Import and export" description="Load calculated results into the client's portal, or export their collected tracker data.">
      <div className="grid gap-4 lg:grid-cols-2">
        <ImportCard {...props} />
        <ExportCard {...props} />
      </div>
    </Section>
  );
}
