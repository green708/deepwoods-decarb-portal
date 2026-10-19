import { useMemo, useState } from "react";
import { Paperclip, StickyNote, X, FileText } from "lucide-react";
import { MONTHS, type Equipment } from "@/lib/ghg/registry";
import { useGhgStore, type CellEntry, type UploadedFile } from "@/lib/ghg/store";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  equipment: Equipment;
  readOnly?: boolean;
}

function normalizeToArray(e: Equipment, v: CellEntry["value"] | undefined): (number | null)[] {
  if (v === undefined || v === null) return e.subFields.map(() => null);
  if (Array.isArray(v)) return e.subFields.map((_, i) => v[i] ?? null);
  return [v, ...e.subFields.slice(1).map(() => null)];
}

function isBalanced(v: (number | null)[]): boolean {
  const [gen, self, exp] = v;
  if (gen == null || self == null || exp == null) return true;
  if (gen === 0) return self === 0 && exp === 0;
  return Math.abs((self + exp) - gen) / gen <= 0.05;
}

export function EquipmentMonthlyGrid({ equipment, readOnly }: Props) {
  const { getCell, setCell, clearCell, state, setEquipmentNote, equipmentProgress } = useGhgStore();
  const pct = equipmentProgress(equipment.id);
  const note = state.notesByEquipment[equipment.id] ?? "";
  const [savedFlash, setSavedFlash] = useState<string>("");

  const uploadedMonths = useMemo(() => {
    if (equipment.mode === "annual") {
      const c = getCell(equipment.id, "annual");
      return { filled: c?.files?.length ? 1 : 0, total: 1 };
    }
    let filled = 0;
    for (const m of MONTHS) {
      const c = getCell(equipment.id, m.key);
      if (c?.files?.length) filled += 1;
    }
    return { filled, total: MONTHS.length };
  }, [state.cells, equipment, getCell]);

  const handleValueChange = (monthKey: string, subIdx: number, raw: string) => {
    if (readOnly) return;
    const parsed = raw.trim() === "" ? null : Number(raw);
    if (parsed !== null && Number.isNaN(parsed)) return;
    const existing = getCell(equipment.id, monthKey);
    if (equipment.subFields.length > 1) {
      const arr = normalizeToArray(equipment, existing?.value);
      arr[subIdx] = parsed;
      const allNull = arr.every((v) => v === null);
      if (allNull && !existing?.files?.length && !existing?.note) {
        clearCell(equipment.id, monthKey);
      } else {
        setCell(equipment.id, monthKey, { value: arr });
      }
    } else {
      if (parsed === null && !existing?.files?.length && !existing?.note) {
        clearCell(equipment.id, monthKey);
      } else {
        setCell(equipment.id, monthKey, { value: parsed });
      }
    }
    setSavedFlash(monthKey);
    setTimeout(() => setSavedFlash(""), 600);
  };

  const handleFileAdd = (monthKey: string, files: FileList | null) => {
    if (!files || readOnly) return;
    const existing = getCell(equipment.id, monthKey);
    const list: UploadedFile[] = [
      ...(existing?.files ?? []),
      ...Array.from(files).map((f) => ({ name: f.name, size: f.size })),
    ];
    setCell(equipment.id, monthKey, {
      value: existing?.value ?? (equipment.subFields.length > 1
        ? equipment.subFields.map(() => null)
        : null),
      files: list,
    });
  };

  const handleFileRemove = (monthKey: string, idx: number) => {
    const existing = getCell(equipment.id, monthKey);
    if (!existing?.files) return;
    const files = existing.files.filter((_, i) => i !== idx);
    setCell(equipment.id, monthKey, { ...existing, files });
  };

  if (equipment.mode === "annual") {
    const c = getCell(equipment.id, "annual");
    const val = typeof c?.value === "number" ? c.value : "";
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Annual total {equipment.fuel} ({equipment.unit})
            </label>
            <Input
              type="number"
              inputMode="decimal"
              value={val}
              placeholder="—"
              disabled={readOnly}
              onChange={(e) => handleValueChange("annual", 0, e.target.value)}
              className="max-w-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
              <Paperclip className="h-4 w-4" />
              <span>Upload inspection report</span>
              <input
                type="file" multiple hidden
                disabled={readOnly}
                onChange={(e) => handleFileAdd("annual", e.target.files)}
              />
            </label>
          </div>
        </div>
        {c?.files?.length ? (
          <ul className="mt-3 space-y-1 text-xs">
            {c.files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md border bg-neutral-soft px-2 py-1">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                {!readOnly && (
                  <button
                    onClick={() => handleFileRemove("annual", i)}
                    className="text-muted-foreground hover:text-critical"
                  ><X className="h-3.5 w-3.5" /></button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {equipment.helper ?? "Enter the total refilled during the annual inspection."}
        </p>
      </div>
    );
  }

  const multi = equipment.subFields.length > 1;

  return (
    <div className="space-y-3">
      {/* Desktop grid */}
      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-neutral-soft">
              <th className="sticky left-0 z-10 min-w-[140px] bg-neutral-soft px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Field
              </th>
              {MONTHS.map((m) => (
                <th
                  key={m.key}
                  className="min-w-[92px] px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                >{m.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equipment.subFields.map((sub, subIdx) => (
              <tr key={sub} className={subIdx > 0 ? "border-t" : undefined}>
                <td className="sticky left-0 z-10 bg-card px-3 py-1.5 text-xs font-medium">
                  {sub} <span className="text-muted-foreground">({equipment.unit})</span>
                </td>
                {MONTHS.map((m) => {
                  const c = getCell(equipment.id, m.key);
                  const arr = normalizeToArray(equipment, c?.value);
                  const v = arr[subIdx];
                  const hasFile = !!c?.files?.length;
                  const filled = v !== null && v !== undefined;
                  const balanced = equipment.isSolar ? isBalanced(arr) : true;
                  return (
                    <td key={m.key} className="p-1 align-top">
                      <div className={cn(
                        "group relative rounded-md p-0.5 transition",
                        filled ? "ghg-cell-filled" : "ghg-cell-empty",
                        !balanced && "ring-1 ring-critical",
                        savedFlash === m.key && "ring-1 ring-ghg-green",
                      )}>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={v ?? ""}
                          placeholder="—"
                          disabled={readOnly}
                          onChange={(e) => handleValueChange(m.key, subIdx, e.target.value)}
                          className="w-full bg-transparent px-1.5 py-1 text-right text-sm tabular-nums outline-none placeholder:text-muted-foreground/60"
                        />
                        {subIdx === 0 && (
                          <div className="flex items-center justify-between px-1 pb-0.5">
                            <label className={cn(
                              "cursor-pointer text-muted-foreground/60 opacity-0 transition group-hover:opacity-100",
                              hasFile && "text-primary opacity-100",
                            )}>
                              <Paperclip className="h-3 w-3" />
                              <input
                                type="file" multiple hidden
                                disabled={readOnly}
                                onChange={(e) => handleFileAdd(m.key, e.target.files)}
                              />
                            </label>
                            {hasFile && (
                              <span className="text-[9px] font-medium text-primary tabular-nums">
                                {c!.files!.length}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {multi && (
              <tr className="border-t bg-neutral-soft/60">
                <td className="sticky left-0 z-10 bg-neutral-soft/60 px-3 py-1.5 text-xs font-semibold text-navy">
                  Total ({equipment.unit})
                </td>
                {MONTHS.map((m) => {
                  const c = getCell(equipment.id, m.key);
                  const arr = normalizeToArray(equipment, c?.value);
                  const total = arr.reduce<number | null>((acc, v) => (v == null ? acc : (acc ?? 0) + v), null);
                  return (
                    <td key={m.key} className="px-2 py-1 text-right text-xs font-semibold tabular-nums text-navy">
                      {total == null ? "—" : total.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile stack */}
      <div className="space-y-2 md:hidden">
        {MONTHS.map((m) => {
          const c = getCell(equipment.id, m.key);
          const arr = normalizeToArray(equipment, c?.value);
          const filled = arr.some((v) => v !== null);
          const balanced = equipment.isSolar ? isBalanced(arr) : true;
          return (
            <div key={m.key} className={cn(
              "rounded-lg border p-2",
              filled ? "bg-card" : "bg-neutral-soft",
              !balanced && "border-critical",
            )}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">{m.short}</span>
                <label className="cursor-pointer text-muted-foreground">
                  <Paperclip className="h-3.5 w-3.5" />
                  <input
                    type="file" multiple hidden
                    disabled={readOnly}
                    onChange={(e) => handleFileAdd(m.key, e.target.files)}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {equipment.subFields.map((sub, subIdx) => (
                  <div key={sub} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-xs text-muted-foreground">{sub}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={arr[subIdx] ?? ""}
                      placeholder="—"
                      disabled={readOnly}
                      onChange={(e) => handleValueChange(m.key, subIdx, e.target.value)}
                      className="flex-1 rounded-md border bg-card px-2 py-1 text-right text-sm tabular-nums outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Card footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>Source documents: {uploadedMonths.filled} / {uploadedMonths.total} months uploaded</span>
          {equipment.isSolar && (
            <span className="text-muted-foreground">Rule: Generated = Self-consumed + Exported (±5%)</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                <StickyNote className="h-3.5 w-3.5" />
                Notes {note && <span className="text-primary">•</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <label className="mb-1 block text-xs font-medium">Notes for this equipment</label>
              <Textarea
                rows={4}
                placeholder="e.g. Vehicle fleet disposed Oct-25, no consumption after that month"
                value={note}
                onChange={(e) => setEquipmentNote(equipment.id, e.target.value)}
              />
            </PopoverContent>
          </Popover>
          <span className="tabular-nums">{Math.round(pct * 100)}% complete</span>
        </div>
      </div>
    </div>
  );
}
