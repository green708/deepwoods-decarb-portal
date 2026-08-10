import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageBody, PageHeader } from "@/components/portal";
import { Download, Eye, Search, Upload, Folder, X, CheckCircle2 } from "lucide-react";
import { useClientContext } from "@/lib/client-context";
import { useEntity } from "@/lib/entity";
import { useVaultDocuments } from "@/lib/api";

export const Route = createFileRoute("/_app/vault")({ component: Vault });

type FolderId = "raw" | "evidence" | "reports" | "certs";

type FolderDef = { id: FolderId; name: string; updated: string };
const FOLDERS: FolderDef[] = [
  { id: "raw",      name: "Raw Activity Data",          updated: "Jun 2026" },
  { id: "evidence", name: "Evidence",                   updated: "Jun 2026" },
  { id: "reports",  name: "Reports",                    updated: "Jun 2026" },
  { id: "certs",    name: "Certificates & Instruments", updated: "Jun 2026" },
];

const SUB_CLUSTERS: Record<FolderId, string[]> = {
  raw:      ["Scope 1 — Combustion", "Scope 1 — Fugitive", "Scope 2 — Electricity Bills", "Scope 2 — Solar Generation", "Scope 3 — Procurement", "Scope 3 — Freight / Deliveries", "Scope 3 — Commuting", "Other"],
  evidence: ["DEFRA Emission Factors", "Methodology", "Calculation Audit Trails", "Boundary Documentation", "Other"],
  reports:  ["FY26", "FY25", "FY24", "FY23", "FY22"],
  certs:    ["Wind PPA / I-RECs", "Other"],
};

const YEARS_OPT = ["FY26", "FY25", "FY24", "FY23", "FY22", "N/A"];

type RecentFile = {
  name: string; folder: FolderId; entity: string; year: string; size: string; uploaded: string;
  type: "pdf"|"xlsx"|"docx"|"html"|"zip"|"jpg"; file?: string;
};

const TYPE_BADGE: Record<string, React.ReactNode> = {
  pdf:  <span className="rounded px-1 py-0.5 text-[10px] font-bold bg-[#FEE2E2] text-[#D90429]">PDF</span>,
  xlsx: <span className="rounded px-1 py-0.5 text-[10px] font-bold bg-[#E6F4EF] text-[#16A34A]">XLS</span>,
  docx: <span className="rounded px-1 py-0.5 text-[10px] font-bold bg-[#F0F2F5] text-[var(--navy-2)]">DOC</span>,
  html: <span className="rounded px-1 py-0.5 text-[10px] font-bold bg-[#EDE9FE] text-[#7C3AED]">HTML</span>,
  zip:  <span className="rounded px-1 py-0.5 text-[10px] font-bold bg-[#F0F2F5] text-[var(--navy-2)]">ZIP</span>,
  jpg:  <span className="rounded px-1 py-0.5 text-[10px] font-bold bg-[#FEF3C7] text-[#D97706]">IMG</span>,
};

// ── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({ onClose }: { onClose: () => void }) {
  const { entities } = useClientContext();
  const consolidatedEntity = entities.find(e => e.is_consolidated);
  const [entity, setEntity] = useState<string>("");
  const [cluster, setCluster] = useState<FolderId | "">("");
  const [subCluster, setSubCluster] = useState("");
  const [year, setYear] = useState("FY26");
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState(false);

  const subs = cluster ? SUB_CLUSTERS[cluster] : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entity || !cluster || !subCluster || !file) return;
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-[var(--navy)]">Upload document</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Select which company and where this file belongs before uploading</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-[var(--muted)] transition">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-[var(--success)]" />
            <div className="font-semibold text-[var(--navy)]">{file?.name} queued for upload ({entity})</div>
            <p className="text-sm text-muted-foreground">Deepwoods will process and confirm within 24 hours.</p>
            <button onClick={onClose}
              className="mt-2 rounded-lg px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--navy)" }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Entity */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Company</label>
              <select required value={entity} onChange={e => setEntity(e.target.value as any)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium cursor-pointer"
                style={{ color: entity ? "var(--navy)" : "#9E9E9E" }}>
                <option value="">Select company…</option>
                {entities.filter(e => !e.is_consolidated).map(e => (
                  <option key={e.code} value={e.code}>{e.code} — {e.name}</option>
                ))}
                {consolidatedEntity && (
                  <option value={consolidatedEntity.code}>{consolidatedEntity.short} — Consolidated (reports only)</option>
                )}
              </select>
            </div>

            {/* Cluster */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Category</label>
              <select required value={cluster} onChange={e => { setCluster(e.target.value as FolderId | ""); setSubCluster(""); }}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium cursor-pointer"
                style={{ color: cluster ? "var(--navy)" : "#9E9E9E" }}>
                <option value="">Select category…</option>
                {FOLDERS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            {/* Sub-cluster */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Sub-category</label>
              <select required value={subCluster} onChange={e => setSubCluster(e.target.value)}
                disabled={!cluster}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium cursor-pointer disabled:opacity-40"
                style={{ color: subCluster ? "var(--navy)" : "#9E9E9E" }}>
                <option value="">Select sub-category…</option>
                {subs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Reporting year</label>
              <select value={year} onChange={e => setYear(e.target.value)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium cursor-pointer" style={{ color: "var(--navy)" }}>
                {YEARS_OPT.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* File */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">File</label>
              <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition ${file ? "border-[var(--navy)] bg-[var(--muted)]" : "border-slate-200 hover:border-[var(--navy)]"}`}>
                <Upload className={`h-6 w-6 ${file ? "text-[var(--navy)]" : "text-muted-foreground"}`} />
                {file ? (
                  <span className="text-sm font-semibold text-[var(--navy)]">{file.name}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Click to browse or drag & drop</span>
                )}
                <span className="text-[10px] text-muted-foreground">PDF, XLSX, DOCX, HTML, ZIP — max 50 MB</span>
                <input type="file" className="hidden" required
                  accept=".pdf,.xlsx,.xls,.docx,.doc,.html,.zip,.jpg,.jpeg,.png"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-[var(--muted)]">
                Cancel
              </button>
              <button type="submit"
                disabled={!entity || !cluster || !subCluster || !file}
                className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "var(--navy)" }}>
                Upload
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Vault() {
  const { entity } = useEntity();
  const { entities } = useClientContext();
  const consolidatedCode = entities.find(e => e.is_consolidated)?.code;
  const entityShort = (code: string) => entities.find(e => e.code === code)?.short ?? code;
  const entityName = (code: string) => entities.find(e => e.code === code)?.name ?? code;
  const [query, setQuery]           = useState("");
  const [active, setActive]         = useState<FolderId | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const { data: vaultDocs = [] } = useVaultDocuments();
  const RECENT: RecentFile[] = vaultDocs.map(d => {
    const typeStr = d.type?.toLowerCase() ?? "";
    const folder: FolderId =
      typeStr.includes("report") ? "reports" :
      typeStr.includes("cert") || typeStr.includes("irec") || typeStr.includes("ppa") ? "certs" :
      typeStr.includes("evidence") || typeStr.includes("audit") || typeStr.includes("methodology") ? "evidence" :
      "raw";
    const ext = (d.drive_link ?? "").split(".").pop()?.toLowerCase() ?? "pdf";
    const fileType = (["pdf","xlsx","docx","html","zip","jpg"] as const).includes(ext as "pdf") ? ext as RecentFile["type"] : "pdf";
    return {
      name: d.title,
      folder,
      entity: d.entity,
      year: d.fy,
      size: "—",
      uploaded: d.uploaded_at,
      type: fileType,
      file: d.drive_link || undefined,
    };
  });

  const handleFolder = (id: FolderId) => setActive(prev => prev === id ? null : id);

  const entityFiles = RECENT.filter(f => entity === consolidatedCode || f.entity === entity || f.entity === consolidatedCode);

  const filtered = entityFiles.filter(f => {
    const matchFolder = !active || f.folder === active;
    const matchQuery  = !query   || f.name.toLowerCase().includes(query.toLowerCase());
    return matchFolder && matchQuery;
  });

  const countFor = (id: FolderId) => entityFiles.filter(f => f.folder === id).length;

  return (
    <>
      <PageHeader eyebrow={`Document Vault · ${entityShort(entity)}`} title="Everything shared with Deepwoods"
        description="Search across raw data, evidence, reports, and certificates — per entity. Consolidated reports are visible in every entity view."
        right={
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background:"var(--navy)" }}>
            <Upload className="h-4 w-4" /> Upload document
          </button>
        }
      />
      <PageBody>
        {/* Search */}
        <div className="mb-7 flex items-center gap-3 rounded-xl border bg-white px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search files, folders, years…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          {(query || active) && (
            <button onClick={() => { setQuery(""); setActive(null); }}
              className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          )}
        </div>

        {/* Folder cards */}
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Browse by category</div>
        <div className="mb-8 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {FOLDERS.map(f => {
            const isActive = active === f.id;
            return (
              <button key={f.id} onClick={() => handleFolder(f.id)}
                className={`flex items-start gap-4 rounded-xl border p-5 text-left transition ${
                  isActive
                    ? "border-[var(--navy)] bg-[var(--navy)] text-white shadow-md"
                    : "bg-white hover:border-[var(--navy)] hover:shadow-sm"
                }`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-white/20" : "bg-[var(--muted)]"}`}>
                  <Folder className={`h-5 w-5 ${isActive ? "text-white" : "text-[var(--navy)]"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm leading-snug ${isActive ? "text-white" : "text-[var(--navy)]"}`}>{f.name}</div>
                  <div className={`mt-2 flex items-center justify-between text-xs ${isActive ? "text-white/70" : "text-muted-foreground"}`}>
                    <span>{countFor(f.id)} files</span>
                    <span>{f.updated}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Files table */}
        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {active ? `${FOLDERS.find(f => f.id === active)?.name}` : "Latest files"}
          <span className="ml-2 font-normal normal-case">({filtered.length} {filtered.length === 1 ? "file" : "files"})</span>
        </div>
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[var(--muted)]">
                  {["File","Entity","Folder","Year","Size","Uploaded",""].map((h,i) => (
                    <th key={i} className={`px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${h === "" ? "text-right" : ""} ${h === "Uploaded" ? "hidden sm:table-cell" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((f, i) => (
                  <tr key={i} className="hover:bg-[var(--muted)] transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        {TYPE_BADGE[f.type]}
                        <span className="truncate text-sm font-medium text-[var(--navy)]" style={{ maxWidth:240 }}>{f.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-[var(--navy)]">{f.entity}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {FOLDERS.find(x => x.id === f.folder)?.name}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold border-[var(--navy)] text-[var(--navy)]">{f.year}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-muted-foreground whitespace-nowrap">{f.size}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground whitespace-nowrap hidden sm:table-cell">{f.uploaded}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {f.file ? (
                          <>
                            <a href={f.file} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold text-[var(--navy)] hover:bg-[var(--muted)]">
                              <Eye className="h-3 w-3" /> View
                            </a>
                            <a href={f.file} download
                              className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90" style={{ background:"var(--navy)" }}>
                              <Download className="h-3 w-3" /> Download
                            </a>
                          </>
                        ) : (
                          <span className="rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground">On Drive</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-sm text-muted-foreground italic">No files match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageBody>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </>
  );
}
