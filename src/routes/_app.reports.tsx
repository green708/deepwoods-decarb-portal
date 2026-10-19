import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageBody, PageHeader } from "@/components/portal";
import { FileText, Download, Eye, ChevronDown, ChevronRight, Clock, FileCheck2, BookOpen, ShieldCheck, BookOpenCheck } from "lucide-react";
import { useClientContext } from "@/lib/client-context";
import { useEntity } from "@/lib/entity";
import { useVaultDocuments } from "@/lib/api";

export const Route = createFileRoute("/_app/reports")({ component: Reports });

type Cat = "GHG Report — For Audit" | "Audit Trail" | "Assurance Report" | "GHG Report — To Publish";

type FY = string;
type Doc = { id: string; name: string; entity: string; category: Cat; scope: string; size: string; date: string; file?: string; status?: string };

const CAT_ICON: Record<Cat, React.ReactNode> = {
  "GHG Report — For Audit":  <FileCheck2 className="h-3.5 w-3.5" />,
  "Audit Trail":              <BookOpen className="h-3.5 w-3.5" />,
  "Assurance Report":         <ShieldCheck className="h-3.5 w-3.5" />,
  "GHG Report — To Publish": <BookOpenCheck className="h-3.5 w-3.5" />,
};

const CAT_ORDER: Cat[] = ["GHG Report — For Audit","Audit Trail","Assurance Report","GHG Report — To Publish"];

function countCompleted(docs: Doc[]) { return docs.filter(d => d.file).length; }

function Reports() {
  const { entity } = useEntity();
  const { entities, reporting_years } = useClientContext();
  const consolidatedCode = entities.find(e => e.is_consolidated)?.code;
  const entityShort = (code: string) => entities.find(e => e.code === code)?.short ?? code;
  const [open, setOpen] = useState<Set<FY>>(new Set(reporting_years.slice(0, 2)));
  const toggle = (y: FY) => setOpen(prev => { const s = new Set(prev); s.has(y) ? s.delete(y) : s.add(y); return s; });

  const { data: vaultDocs = [] } = useVaultDocuments();

  const docsByYear = useMemo(() => {
    const byFY: Record<string, Doc[]> = {};
    for (const d of vaultDocs) {
      if (!byFY[d.fy]) byFY[d.fy] = [];
      byFY[d.fy].push({
        id: String(d.id),
        name: d.title,
        entity: d.entity,
        category: "GHG Report — For Audit" as Cat,
        scope: "All Scopes",
        size: "—",
        date: d.uploaded_at ? d.uploaded_at.slice(0, 10) : "—",
        file: d.drive_link || undefined,
      });
    }
    return byFY;
  }, [vaultDocs]);

  const YEARS = reporting_years.length > 0 ? reporting_years : Object.keys(docsByYear).sort().reverse();

  // Consolidated view shows everything; sub-entity views show their own docs + consolidated docs
  const visibleDocs = (docs: Doc[]) =>
    entity === consolidatedCode ? docs : docs.filter(d => d.entity === entity || d.entity === consolidatedCode);

  return (
    <>
      <PageHeader eyebrow={`Compliance · ${entityShort(entity)}`} title="Reports"
        description="GHG inventory reports, single-page disclosures, Scope 3 summaries and I-REC procurement reports — organised by year. Consolidated reports are visible in all entity views." />
      <PageBody>
        <div className="space-y-3">
          {YEARS.map(year => {
            const docs = visibleDocs(docsByYear[year] ?? []);
            const completed = countCompleted(docs);
            const isOpen = open.has(year);
            return (
              <div key={year} className="overflow-hidden rounded-xl border bg-white">
                {/* Year header */}
                <button onClick={() => toggle(year)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-[var(--muted)] transition">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold" style={{ background:"var(--navy)" }}>
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold tabular-nums text-[var(--navy)]">{year}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {docs.length === 0
                      ? <span className="text-xs text-muted-foreground">0 documents</span>
                      : <>
                          <span className="text-xs text-muted-foreground">{completed} of {docs.length} available</span>
                          <span className="rounded-full border border-[var(--navy)] px-2 py-0.5 text-[10px] font-bold text-[var(--navy)]">{docs.length}</span>
                        </>
                    }
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t">
                    {docs.length === 0 ? (
                      <div className="flex flex-col gap-1 px-5 py-5">
                        <p className="text-sm text-muted-foreground">No reports published for {year} yet.</p>
                        <p className="text-xs text-muted-foreground">Reports are added by your Deepwoods consultant at the end of each reporting cycle. Contact <a href="mailto:support@deepwoodsgreen.com" className="underline">support@deepwoodsgreen.com</a> if you expected a report here.</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {CAT_ORDER.map(cat => {
                          const catDocs = docs.filter(d => d.category === cat);
                          if (catDocs.length === 0) return null;
                          return (
                            <div key={cat}>
                              <div className="flex items-center gap-2 px-5 py-2.5 bg-[var(--muted)]">
                                <span className="text-[var(--navy-2)]">{CAT_ICON[cat]}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{cat}</span>
                              </div>
                              {catDocs.map(doc => (
                                <div key={doc.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--muted)] transition">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--navy)_8%,white)]">
                                    <FileText className="h-4 w-4 text-[var(--navy-2)]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-sm text-[var(--navy)] leading-snug">{doc.name}</span>
                                      <span className="rounded-full border px-1.5 py-0.5 text-[9px] font-bold text-[var(--navy)]">{doc.entity}</span>
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      <span>{doc.scope}</span>
                                      {doc.size !== "—" && <><span>·</span><span>{doc.size}</span></>}
                                      {doc.date !== "—" && <><span>·</span><span>{doc.date}</span></>}
                                      {doc.status && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                                          <Clock className="h-2.5 w-2.5" />{doc.status}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 gap-2">
                                    {doc.file ? (
                                      <>
                                        <a href={doc.file} target="_blank" rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold text-[var(--navy)] hover:bg-muted">
                                          <Eye className="h-3 w-3" /> View
                                        </a>
                                        <a href={doc.file} download
                                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90" style={{ background:"var(--navy)" }}>
                                          <Download className="h-3 w-3" /> Download
                                        </a>
                                      </>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" /> Pending
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
