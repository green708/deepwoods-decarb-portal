import { useMemo, useState } from "react";
import { FACILITIES, MONTHS, type Equipment } from "@/lib/ghg/registry";
import { useGhgStore, type CellStatus } from "@/lib/ghg/store";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface CellRef { equipment: Equipment; monthKey: string; monthLabel: string }

function cellFillClass(hasValue: boolean, status?: CellStatus, overridden?: boolean) {
  if (status === "na") return "bg-neutral-soft text-muted-foreground";
  if (status === "received" || (hasValue && status !== "missing" && status !== "partial")) return "ghg-cell-received";
  if (status === "partial") return "ghg-cell-partial";
  if (status === "missing") return "ghg-cell-missing";
  return "ghg-cell-empty";
}

function isFilled(v: unknown): boolean {
  if (Array.isArray(v)) return v.some((x) => x !== null && x !== undefined);
  return v !== null && v !== undefined;
}

function displayValue(e: Equipment, v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) {
    const total = v.reduce<number | null>((acc, x) => (x == null ? acc : (acc ?? 0) + (x as number)), null);
    return total == null ? "—" : total.toLocaleString();
  }
  return (v as number).toLocaleString();
}

export function TrackerGrid() {
  const { getCell, setCell, equipmentProgress, state } = useGhgStore();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<CellRef | null>(null);

  const openCell = (equipment: Equipment, monthKey: string, monthLabel: string) => {
    setCurrent({ equipment, monthKey, monthLabel });
    setOpen(true);
  };

  const currentCell = current ? getCell(current.equipment.id, current.monthKey) : undefined;

  const [draftValue, setDraftValue] = useState<string>("");
  const [draftStatus, setDraftStatus] = useState<CellStatus | "">("");
  const [draftNote, setDraftNote] = useState<string>("");

  // Reset draft when cell changes
  useMemo(() => {
    if (!current) return;
    const c = getCell(current.equipment.id, current.monthKey);
    if (Array.isArray(c?.value)) {
      setDraftValue(c!.value.map((v) => v ?? "").join(" / "));
    } else {
      setDraftValue(c?.value == null ? "" : String(c.value));
    }
    setDraftStatus(c?.status ?? "");
    setDraftNote(c?.note ?? "");
  }, [current]);

  const saveDraft = () => {
    if (!current) return;
    const e = current.equipment;
    if (e.subFields.length > 1) {
      const parts = draftValue.split("/").map((s) => s.trim());
      const arr = e.subFields.map((_, i) => {
        const v = parts[i];
        if (v == null || v === "") return null;
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      });
      setCell(e.id, current.monthKey, {
        value: arr,
        status: (draftStatus || undefined) as CellStatus | undefined,
        note: draftNote || undefined,
      });
    } else {
      const parsed = draftValue.trim() === "" ? null : Number(draftValue);
      setCell(e.id, current.monthKey, {
        value: Number.isNaN(parsed as number) ? null : parsed,
        status: (draftStatus || undefined) as CellStatus | undefined,
        note: draftNote || undefined,
      });
    }
    setOpen(false);
  };

  return (
    <>
      <div className="overflow-auto rounded-lg border bg-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-navy text-navy-foreground">
              <th className="sticky left-0 z-20 bg-navy px-3 py-2 text-left text-xs font-semibold">
                Equipment
              </th>
              <th className="px-2 py-2 text-left text-[11px] font-medium uppercase tracking-wide opacity-80">Unit</th>
              {MONTHS.map((m) => (
                <th key={m.key} className="min-w-[76px] px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide opacity-80">
                  {m.short}
                </th>
              ))}
              <th className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide opacity-80">Annual</th>
              <th className="min-w-[110px] px-2 py-2 text-left text-[11px] font-medium uppercase tracking-wide opacity-80">Complete</th>
            </tr>
          </thead>
          <tbody>
            {FACILITIES.map((f) => (
              <>
                <tr key={f.id} className="bg-navy/90 text-navy-foreground">
                  <td colSpan={MONTHS.length + 4} className="sticky left-0 z-10 bg-navy/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide">
                    {f.name}
                    <span className="ml-2 text-[11px] font-normal opacity-70">
                      {f.state} · {f.utility} · {f.equipment.length} sources
                    </span>
                  </td>
                </tr>
                {f.equipment.map((e) => {
                  const pct = equipmentProgress(e.id);
                  let annual = 0;
                  let annualHas = false;
                  if (e.mode === "annual") {
                    const c = getCell(e.id, "annual");
                    annualHas = isFilled(c?.value);
                    if (annualHas) annual = c!.value as number;
                  }
                  const monthlyTotal = MONTHS.reduce((acc, m) => {
                    const c = getCell(e.id, m.key);
                    if (!c || !isFilled(c.value)) return acc;
                    if (Array.isArray(c.value)) {
                      return acc + c.value.reduce<number>((a, v) => a + ((v as number) ?? 0), 0);
                    }
                    return acc + (c.value as number);
                  }, 0);
                  return (
                    <tr key={e.id} className="border-b last:border-b-0 hover:bg-neutral-soft/40">
                      <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                        <div className="text-xs font-semibold text-navy">{e.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{e.id}</div>
                      </td>
                      <td className="px-2 py-1.5 text-[11px] text-muted-foreground">{e.unit}</td>
                      {e.mode === "annual" ? (
                        <>
                          <td colSpan={MONTHS.length} className="px-2 py-1.5 text-center text-[11px] italic text-muted-foreground">
                            annual entry — see Annual column
                          </td>
                          <td className="px-1 py-1">
                            <button
                              onClick={() => openCell(e, "annual", "Annual")}
                              className={cn(
                                "w-full rounded-md px-2 py-1 text-right text-xs tabular-nums transition hover:ring-1 hover:ring-primary",
                                cellFillClass(annualHas, getCell(e.id, "annual")?.status, getCell(e.id, "annual")?.overriddenByAdmin),
                              )}
                            >{annualHas ? annual.toLocaleString() : "—"}</button>
                          </td>
                        </>
                      ) : (
                        <>
                          {MONTHS.map((m) => {
                            const c = getCell(e.id, m.key);
                            const has = isFilled(c?.value);
                            return (
                              <td key={m.key} className="px-1 py-1">
                                <button
                                  onClick={() => openCell(e, m.key, m.short)}
                                  className={cn(
                                    "w-full rounded-md px-1.5 py-1 text-right text-xs tabular-nums transition hover:ring-1 hover:ring-primary",
                                    cellFillClass(has, c?.status, c?.overriddenByAdmin),
                                  )}
                                  title={c?.overriddenByAdmin ? "Edited by admin" : undefined}
                                >
                                  {has ? displayValue(e, c!.value) : "—"}
                                  {c?.overriddenByAdmin && <span className="ml-1 text-[9px] text-amber-warn">✎</span>}
                                </button>
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-right text-xs font-semibold tabular-nums text-navy">
                            {monthlyTotal ? monthlyTotal.toLocaleString() : "—"}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-soft">
                            <div
                              className={cn(
                                "h-full transition-all",
                                pct >= 0.8 ? "bg-ghg-green" : pct >= 0.25 ? "bg-amber-warn" : pct > 0 ? "bg-critical" : "bg-muted-foreground/40",
                              )}
                              style={{ width: `${Math.max(2, pct * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{Math.round(pct * 100)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {current && (
            <>
              <SheetHeader>
                <SheetTitle>{current.equipment.name}</SheetTitle>
                <SheetDescription>
                  <span className="font-mono text-xs">{current.equipment.id}</span> · {current.monthLabel} · {current.equipment.unit}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 p-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Value {current.equipment.subFields.length > 1 && (
                      <span className="italic">(enter as: {current.equipment.subFields.join(" / ")})</span>
                    )}
                  </label>
                  <Input
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    placeholder={current.equipment.subFields.length > 1 ? "e.g. 1200 / 400" : "—"}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                  <ToggleGroup
                    type="single"
                    value={draftStatus}
                    onValueChange={(v) => setDraftStatus((v as CellStatus) ?? "")}
                    className="flex-wrap justify-start"
                  >
                    <ToggleGroupItem value="received">Received</ToggleGroupItem>
                    <ToggleGroupItem value="partial">Partial</ToggleGroupItem>
                    <ToggleGroupItem value="missing">Missing</ToggleGroupItem>
                    <ToggleGroupItem value="na">N/A</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
                  <Textarea value={draftNote} onChange={(e) => setDraftNote(e.target.value)} rows={3} />
                </div>

                {currentCell?.updatedAt && (
                  <div className="rounded-md bg-neutral-soft p-2 text-[11px] text-muted-foreground">
                    Last edited by <span className="font-medium">{currentCell.updatedBy ?? "unknown"}</span>{" "}
                    on {new Date(currentCell.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                    {currentCell.overriddenByAdmin && <Badge className="ml-2 bg-amber-warn text-white">Edited by admin</Badge>}
                  </div>
                )}
              </div>

              <SheetFooter className="p-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={saveDraft}>Save</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
