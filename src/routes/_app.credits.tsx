import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/portal";
import { Info, FolderLock, Sun } from "lucide-react";
import { useClientContext } from "@/lib/client-context";
import { useIRECRegister, useGridMWh } from "@/lib/api";
import { useEntity, useFiscalYear } from "@/lib/entity";

export const Route = createFileRoute("/_app/credits")({ component: Credits });

const TAG_STYLE: Record<string, string> = {
  FULL:    "bg-emerald-50 text-[var(--success)]",
  PARTIAL: "bg-amber-50 text-amber-600",
  NONE:    "bg-slate-100 text-slate-500",
  PLANNED: "bg-amber-50 text-amber-600",
};

const STATUS_STYLE: Record<string, string> = {
  Retired:     "bg-[color-mix(in_oklab,var(--navy)_12%,white)] text-[var(--navy)]",
  Recommended: "bg-amber-50 text-amber-600",
  Active:      "bg-emerald-50 text-[var(--success)]",
};

function Credits() {
  const { entity } = useEntity();
  const { fy: year } = useFiscalYear();
  const ctx = useClientContext();
  const { data: irecData } = useIRECRegister();
  const { data: gridMWhData } = useGridMWh();
  const entityShort = (code: string) => ctx.entities.find(e => e.code === code)?.short ?? code;
  const consolidatedCode = ctx.entities.find(e => e.is_consolidated)?.code;
  const isConsolidated = entity === consolidatedCode;

  const rows = (irecData ?? []).filter(r => r.fy === year && (isConsolidated || r.entity === entity));

  // Compute total grid MWh for selected entity + year from API data
  const grid = (() => {
    if (!gridMWhData) return 0;
    if (isConsolidated) {
      return Object.values(gridMWhData as Record<string, Record<string, number>>)
        .reduce((sum, entityYears) => sum + (entityYears[year] ?? 0), 0);
    }
    return (gridMWhData as Record<string, Record<string, number>>)[entity]?.[year] ?? 0;
  })();

  const retired = rows.filter(r => r.status === "Retired").reduce((s, r) => s + r.mwh, 0);
  const coveragePct = grid > 0 ? (retired / grid) * 100 : 0;
  const coverageTag = coveragePct >= 99 ? "FULL" : coveragePct > 0 ? "PARTIAL" : rows.length > 0 ? "PLANNED" : "NONE";

  // On-site generation: filter IREC rows with status "Active" (solar/on-site)
  const genRows = rows.filter(r => r.status === "Active");
  const genMWh = genRows.reduce((s, r) => s + r.mwh, 0);

  // Instruments summary
  const instruments = [...new Set(rows.map(r => r.instrument))].filter(Boolean);
  const instrumentLabel = instruments.length > 0 ? instruments.slice(0, 2).join(", ") : "—";

  return (
    <>
      <PageHeader eyebrow={`Compliance · ${entityShort(entity)}`} title="Renewables & I-RECs"
        description="Wind PPA, I-REC certificates and on-site solar — procurement register, retirement records and grid coverage by year and entity." />
      <PageBody>
        {/* KPI tiles */}
        <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-4">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Renewable MWh Retired</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--navy)" }}>{retired > 0 ? retired.toLocaleString() : "—"}</div>
            <div className="text-xs text-muted-foreground">MWh · {year}</div>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Grid Coverage</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--navy)" }}>{grid > 0 ? `${coveragePct.toFixed(0)}%` : "—"}</div>
            <div className="text-xs text-muted-foreground">of {grid > 0 ? grid.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"} MWh grid</div>
            <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${TAG_STYLE[coverageTag]}`}>{coverageTag}</span>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">On-site Solar</div>
            {genMWh > 0 ? (
              <>
                <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--navy)" }}>{(genMWh / 1000).toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">MWh generated · {year}</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold tabular-nums text-muted-foreground">—</div>
                <div className="text-xs text-muted-foreground">No active solar generation · {year}</div>
              </>
            )}
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Instruments</div>
            <div className="text-xl font-bold tabular-nums leading-snug" style={{ color: "var(--navy)" }}>
              {instrumentLabel}
            </div>
          </div>
        </div>

        {/* I-REC register */}
        <div className="mb-6">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--navy-2)" }}>Renewables</div>
            <Link to="/vault" className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-[var(--navy)] transition">
              <FolderLock className="h-3 w-3" /> View I-REC procurement reports in Vault
            </Link>
          </div>
          <h3 className="mb-3 font-serif text-lg font-bold" style={{ color: "var(--navy)" }}>Renewable instrument register — {year}</h3>
          {rows.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-dashed p-5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No renewable instruments in {year} — Scope 2 market-based equals location-based for {entityShort(entity)}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[var(--muted)]">
                    {["Entity", "Facility / Coverage", "MWh", "Coverage %", "Vintage", "Instrument", "Status"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-[var(--muted)] transition">
                      <td className="px-5 py-3"><span className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-[var(--navy)]">{r.entity}</span></td>
                      <td className="px-5 py-3 font-medium" style={{ color: "var(--navy)" }}>{r.facility}</td>
                      <td className="px-5 py-3 font-semibold tabular-nums">{r.mwh.toLocaleString()}</td>
                      <td className="px-5 py-3 font-semibold tabular-nums">{r.coverage}</td>
                      <td className="px-5 py-3">{r.vintage}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.instrument}</td>
                      <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[r.status]}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* On-site generation */}
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--success)" }}>On-site generation</div>
          <h3 className="mb-3 font-serif text-lg font-bold" style={{ color: "var(--navy)" }}>Self-generation register</h3>
          {genRows.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-dashed p-5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No on-site renewable generation records for {entityShort(entity)} in {year}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[var(--muted)]">
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Entity</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Facility</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">MWh</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Instrument</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vintage</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {genRows.map((g, i) => (
                    <tr key={i} className="hover:bg-[var(--muted)] transition">
                      <td className="px-5 py-3"><span className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-[var(--navy)]">{g.entity}</span></td>
                      <td className="px-5 py-3 font-medium" style={{ color: "var(--navy)" }}>{g.facility}</td>
                      <td className="px-5 py-3 font-semibold tabular-nums">{g.mwh.toLocaleString()}</td>
                      <td className="px-5 py-3 text-muted-foreground">{g.instrument}</td>
                      <td className="px-5 py-3">{g.vintage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </PageBody>
    </>
  );
}
