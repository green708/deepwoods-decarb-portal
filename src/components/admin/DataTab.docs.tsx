import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { authFetch } from "@/lib/auth";
import {
  DANGER_BTN, EmptyHint, ErrorNote, INPUT, PRIMARY_BTN, SECONDARY_BTN, Section, Spinner, fmtDate, fyOptions, useClientEntityList, type ClientTabProps,
} from "@/components/admin/ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntitySelect, LabeledControl, isHttpUrl } from "@/components/admin/DataTab.shared";

interface VaultDoc {
  id: number;
  entity: string;
  fy: string;
  title: string;
  doc_type: string;
  drive_link: string | null;
  uploaded_at: string;
}

const DOC_TYPES = [
  "GHG Report",
  "I-REC Statement",
  "Verification Report",
  "Audit Report",
  "Methodology Note",
  "Intensity Metrics Report",
  "Scope 3 Assessment",
  "Decarbonisation Action Plan",
  "Board Summary",
  "Other",
] as const;

const jsonHeaders = { "Content-Type": "application/json" };

export function DocsSection({ clientId, clientName, reportingPeriod, fy }: Pick<ClientTabProps, "clientId" | "clientName" | "reportingPeriod" | "fy">) {
  const qc = useQueryClient();
  const { entities } = useClientEntityList(clientId, fy);
  const [entity, setEntity] = useState("");
  const [docFy, setDocFy] = useState(fy);
  useEffect(() => { setDocFy(fy); }, [fy]);
  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<VaultDoc | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  const docs = useQuery<VaultDoc[]>({
    queryKey: ["admin-vault-docs", clientId],
    queryFn: () => authFetch(`vault-admin.php?client_id=${clientId}`),
    staleTime: 30 * 1000,
  });

  const add = useMutation({
    mutationFn: () => authFetch("vault-admin.php", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ client_id: clientId, entity, year: docFy, title: title.trim(), doc_type: docType, drive_link: link.trim() || null }),
    }),
    onSuccess: () => {
      toast.success("Document added to the client vault");
      setTitle(""); setLink(""); setErrors({});
      qc.invalidateQueries({ queryKey: ["admin-vault-docs", clientId] });
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => authFetch("vault-admin.php", { method: "DELETE", headers: jsonHeaders, body: JSON.stringify({ id }) }),
    onSuccess: () => {
      toast.success("Document removed");
      setRemoveOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-vault-docs", clientId] });
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!entity) next.entity = "Choose an entity.";
    if (!title.trim()) next.title = "Enter a title.";
    if (link.trim() && !isHttpUrl(link.trim())) next.link = "Enter a full http(s) link.";
    setErrors(next);
    if (Object.keys(next).length === 0) add.mutate();
  };

  const fyChoices = Array.from(new Set([...fyOptions(reportingPeriod, fy), docFy]));
  const list = docs.data ?? [];

  return (
    <Section title="Documents" description={`Reports and statements shared with ${clientName}. They appear in the client's Vault immediately. Upload the file to Drive first, then paste its share link.`}>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <LabeledControl htmlFor="doc-entity" label="Entity" error={errors.entity}>
          <EntitySelect id="doc-entity" value={entity} onChange={(v) => { setEntity(v); setErrors((p) => ({ ...p, entity: "" })); }} entities={entities} />
        </LabeledControl>
        <LabeledControl htmlFor="doc-fy" label="Fiscal year">
          <select id="doc-fy" className={INPUT} value={docFy} onChange={(e) => setDocFy(e.target.value)}>
            {fyChoices.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </LabeledControl>
        <LabeledControl htmlFor="doc-type" label="Document type">
          <select id="doc-type" className={INPUT} value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </LabeledControl>
        <LabeledControl htmlFor="doc-title" label="Title" error={errors.title}>
          <input id="doc-title" className={INPUT} value={title} maxLength={200} placeholder="e.g. GHG inventory report" onChange={(e) => setTitle(e.target.value)} />
        </LabeledControl>
        <div className="sm:col-span-2">
          <LabeledControl htmlFor="doc-link" label="Drive link (optional)" error={errors.link}>
            <input id="doc-link" className={INPUT} value={link} placeholder="https://drive.google.com/file/d/..." onChange={(e) => setLink(e.target.value)} />
          </LabeledControl>
        </div>
        <div className="sm:col-span-2">
          <button type="button" className={PRIMARY_BTN} onClick={submit} disabled={add.isPending}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add to client vault
          </button>
        </div>
      </div>

      {docs.isLoading ? <Spinner label="Loading documents…" /> : docs.error ? <ErrorNote error={docs.error} /> : list.length === 0 ? (
        <EmptyHint title="No documents yet">Documents you add here are listed for the client under Vault.</EmptyHint>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[#F8FAF9] text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">FY</th>
                <th className="px-3 py-2">Added</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {list.map((d) => (
                <tr key={d.id}>
                  <td className="max-w-[18rem] truncate px-3 py-2 font-semibold text-[var(--navy)]" title={d.title}>{d.title}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{d.doc_type}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{d.entity}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{d.fy}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{fmtDate(d.uploaded_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      {d.drive_link && (
                        <a href={d.drive_link} target="_blank" rel="noopener noreferrer" className={SECONDARY_BTN + " !px-3 !py-1.5"}>
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </a>
                      )}
                      <button type="button" className={DANGER_BTN + " !px-3 !py-1.5"} onClick={() => { setRemoving(d); setRemoveOpen(true); }}>
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={removeOpen} onOpenChange={(o) => { if (!o && !remove.isPending) setRemoveOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove document</DialogTitle>
            <DialogDescription>
              "{removing?.title}" will no longer appear in {clientName}'s Vault. The file in Drive is not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className={SECONDARY_BTN} onClick={() => setRemoveOpen(false)} disabled={remove.isPending}>Cancel</button>
            <button type="button" className={DANGER_BTN} onClick={() => removing && remove.mutate(removing.id)} disabled={remove.isPending}>
              {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Remove
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
