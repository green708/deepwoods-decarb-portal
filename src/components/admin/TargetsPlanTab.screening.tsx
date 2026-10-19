import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth";
import { EmptyHint, ErrorNote, Field, INPUT, PRIMARY_BTN, Pill, SECONDARY_BTN, Section, Spinner, useClientEntityList, type ClientTabProps } from "@/components/admin/ui";
import { sendJson } from "@/components/admin/f4-api";

type Relevance = "relevant" | "unsure" | "not_relevant" | null;

const SCOPE3_CATEGORIES = [
  "Purchased Goods & Services",
  "Capital Goods",
  "Fuel & Energy-Related Activities",
  "Upstream Transportation & Distribution",
  "Waste Generated in Operations",
  "Business Travel",
  "Employee Commuting",
  "Upstream Leased Assets",
  "Downstream Transportation & Distribution",
  "Processing of Sold Products",
  "Use of Sold Products",
  "End-of-Life Treatment of Sold Products",
  "Downstream Leased Assets",
  "Franchises",
  "Investments",
];
const ALWAYS_RELEVANT = 3;

const CHOICES: { value: Exclude<Relevance, null>; label: string }[] = [
  { value: "relevant", label: "Relevant" },
  { value: "unsure", label: "Not sure" },
  { value: "not_relevant", label: "Not relevant" },
];
const CHOICE_ON: Record<string, string> = {
  relevant: "border-[#1E6F5C] bg-[#E6F4EF] text-[#1E6F5C]",
  unsure: "border-amber-400 bg-amber-50 text-amber-800",
  not_relevant: "border-slate-400 bg-slate-100 text-slate-700",
};
const CLIENT_ANSWER: Record<string, { label: string; tone: "green" | "amber" | "slate" }> = {
  yes: { label: "Yes", tone: "green" },
  unsure: { label: "Not sure", tone: "amber" },
  no: { label: "No", tone: "slate" },
};

interface ScreeningData { screening: Relevance[]; notes: (string | null)[] }

function normalise(screening: Relevance[] | null | undefined, notes: (string | null)[] | null | undefined): ScreeningData {
  const s = Array.from({ length: 15 }, (_, i) => (screening?.[i] ?? null) as Relevance);
  s[ALWAYS_RELEVANT - 1] = "relevant";
  const n = Array.from({ length: 15 }, (_, i) => (notes?.[i] ?? null));
  return { screening: s, notes: n };
}

function ScreeningEditor({ clientId, entity, entityLabel }: { clientId: number; entity: string; entityLabel: string }) {
  const qc = useQueryClient();
  const q = useQuery<{ screening: Relevance[] | null; notes: (string | null)[] | null }>({
    queryKey: ["admin-s3-screening", clientId, entity],
    queryFn: () => authFetch(`scope3-screening.php?client_id=${clientId}&entity_code=${encodeURIComponent(entity)}`),
    staleTime: 0,
  });
  const qn = useQuery<{ questionnaire: (string | null)[] | null }>({
    queryKey: ["admin-s3-questionnaire", clientId],
    queryFn: () => authFetch(`scope3-questionnaire.php?client_id=${clientId}`),
    staleTime: 30 * 1000,
  });

  const baseline = useMemo(() => (q.data ? normalise(q.data.screening, q.data.notes) : null), [q.data]);
  const [draft, setDraft] = useState<ScreeningData | null>(null);
  useEffect(() => { setDraft(baseline); }, [baseline]);

  const save = useMutation({
    mutationFn: (d: ScreeningData) =>
      sendJson("scope3-screening.php", "POST", {
        client_id: clientId, entity_code: entity, screening: d.screening,
        notes: d.notes.map((n) => (n && n.trim() ? n.trim() : null)),
      }),
    onSuccess: () => {
      toast.success(`Relevance screening saved for ${entityLabel}`);
      qc.invalidateQueries({ queryKey: ["admin-s3-screening", clientId, entity] });
      qc.invalidateQueries({ queryKey: ["context"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Spinner label="Loading screening" />;
  if (q.error || !baseline || !draft) {
    return (
      <div className="space-y-3">
        <ErrorNote error={q.error ?? new Error("Could not load screening for this entity")} />
        <button type="button" className={SECONDARY_BTN} onClick={() => q.refetch()}>Try again</button>
      </div>
    );
  }

  const dirty = JSON.stringify({ s: draft.screening, n: draft.notes.map((x) => x ?? "") }) !== JSON.stringify({ s: baseline.screening, n: baseline.notes.map((x) => x ?? "") });
  const answered = draft.screening.filter(Boolean).length;
  const answers = qn.data?.questionnaire && qn.data.questionnaire.length >= 15 ? qn.data.questionnaire : null;

  const setRel = (i: number, v: Relevance) => setDraft((d) => d && { ...d, screening: d.screening.map((x, j) => (j === i ? v : x)) });
  const setNote = (i: number, v: string) => setDraft((d) => d && { ...d, notes: d.notes.map((x, j) => (j === i ? v : x)) });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        The client only sees and fills Scope 3 categories marked Relevant for <strong>{entityLabel}</strong>. Add a note to explain a decision; the client can read these notes.
      </div>
      {qn.error && <p className="text-xs text-muted-foreground">The client's own questionnaire answers could not be loaded, so the "Client said" hints are hidden.</p>}
      {!qn.isLoading && !qn.error && !answers && <p className="text-xs text-muted-foreground">This client has not completed the Scope 3 questionnaire yet.</p>}
      <p className="text-xs text-muted-foreground">{answered} of 15 categories decided</p>

      <ul className="space-y-2">
        {SCOPE3_CATEGORIES.map((name, i) => {
          const locked = i + 1 === ALWAYS_RELEVANT;
          const val = draft.screening[i];
          const ans = answers?.[i] ? CLIENT_ANSWER[answers[i] as string] : null;
          return (
            <li key={name} className="rounded-lg border border-[var(--border)] bg-white">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--navy)]">Category {i + 1}: {name}</p>
                    {locked && <Pill tone="green">Always relevant</Pill>}
                    {ans && <Pill tone={ans.tone}>Client said: {ans.label}</Pill>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Relevance of category ${i + 1}`}>
                  {CHOICES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      disabled={locked}
                      aria-pressed={val === c.value}
                      onClick={() => setRel(i, c.value)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E6F5C] disabled:cursor-not-allowed ${
                        val === c.value ? CHOICE_ON[c.value] : "border-[var(--border)] bg-white text-muted-foreground hover:bg-slate-50 disabled:opacity-50"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-4 pb-3">
                <input
                  className={`${INPUT} !h-8 text-xs`}
                  value={draft.notes[i] ?? ""}
                  onChange={(e) => setNote(i, e.target.value)}
                  placeholder="Note shown to the client (optional)"
                  aria-label={`Note for category ${i + 1}`}
                  maxLength={500}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
        <button type="button" className={PRIMARY_BTN} disabled={!dirty || save.isPending} onClick={() => save.mutate(draft)}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save screening
        </button>
        <button type="button" className={SECONDARY_BTN} disabled={!dirty || save.isPending} onClick={() => setDraft(baseline)}>Discard</button>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
      </div>
    </div>
  );
}

export function ScreeningSection({ clientId, fy }: ClientTabProps) {
  const { entities, isLoading, error } = useClientEntityList(clientId, fy);
  const [entity, setEntity] = useState("");

  useEffect(() => {
    if (entities.length && !entities.some((e) => e.code === entity)) setEntity(entities.length === 1 ? entities[0].code : "");
  }, [entities, entity]);

  const current = entities.find((e) => e.code === entity);

  return (
    <Section
      title="Scope 3 relevance screening"
      description="A consultant task. Decide which of the 15 Scope 3 categories apply to each reporting entity; the client's data collection is limited to relevant categories."
    >
      {isLoading ? (
        <Spinner label="Loading entities" />
      ) : error ? (
        <ErrorNote error={error} />
      ) : entities.length === 0 ? (
        <EmptyHint title="No reporting entities yet">Add an entity in the Setup tab before screening Scope 3 categories.</EmptyHint>
      ) : (
        <div className="space-y-4">
          <div className="max-w-xs">
            <Field label="Entity">
              <select className={INPUT} value={entity} onChange={(e) => setEntity(e.target.value)}>
                <option value="">Choose an entity</option>
                {entities.map((e) => <option key={e.code} value={e.code}>{e.name} ({e.code})</option>)}
              </select>
            </Field>
          </div>
          {current ? (
            <ScreeningEditor key={`${clientId}:${current.code}`} clientId={clientId} entity={current.code} entityLabel={`${current.name} (${current.code})`} />
          ) : (
            <p className="text-sm text-muted-foreground">Choose an entity to review or edit its screening.</p>
          )}
        </div>
      )}
    </Section>
  );
}
