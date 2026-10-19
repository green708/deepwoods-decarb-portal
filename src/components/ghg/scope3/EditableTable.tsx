import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ColDef } from "@/lib/ghg/scope3Schemas";
import type { Scope3TableRow } from "@/lib/ghg/store";

interface Props {
  columns: ColDef[];
  rows: Scope3TableRow[];
  onAdd: (row: Scope3TableRow) => void;
  onUpdate: (idx: number, row: Scope3TableRow) => void;
  onRemove: (idx: number) => void;
  readOnly?: boolean;
}

function blankRow(cols: ColDef[]): Scope3TableRow {
  const r: Scope3TableRow = {};
  for (const c of cols) r[c.key] = c.type === "number" ? null : "";
  return r;
}

export function EditableTable({ columns, rows, onAdd, onUpdate, onRemove, readOnly }: Props) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b bg-neutral-soft">
              {columns.map((c) => (
                <th key={c.key} className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                  {c.label}{c.unit && <span className="text-[10px] text-muted-foreground/70"> ({c.unit})</span>}
                </th>
              ))}
              {!readOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted-foreground">
                  No rows yet. {!readOnly && "Click + Add row below to start."}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-b-0">
                {columns.map((c) => (
                  <td key={c.key} className="p-1">
                    {readOnly ? (
                      <span className="px-1 py-0.5 text-xs">{String(r[c.key] ?? "—")}</span>
                    ) : c.type === "select" ? (
                      <Select value={String(r[c.key] ?? "")} onValueChange={(v) => onUpdate(i, { ...r, [c.key]: v })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>{c.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={c.type === "number" ? "number" : "text"}
                        value={r[c.key] == null ? "" : String(r[c.key])}
                        onChange={(e) => {
                          const v = c.type === "number"
                            ? (e.target.value === "" ? null : Number(e.target.value))
                            : e.target.value;
                          onUpdate(i, { ...r, [c.key]: v });
                        }}
                        className="h-7 text-xs"
                      />
                    )}
                  </td>
                ))}
                {!readOnly && (
                  <td className="p-1">
                    <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-critical">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="border-t p-2">
          <Button size="sm" variant="outline" onClick={() => onAdd(blankRow(columns))} className="h-7 gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add row
          </Button>
        </div>
      )}
    </div>
  );
}
