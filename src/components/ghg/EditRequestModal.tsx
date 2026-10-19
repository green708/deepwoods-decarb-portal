import { useMemo, useState } from "react";
import { CheckCircle2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MONTHS } from "@/lib/ghg/registry";
import { useGhgStore, type UploadedFile } from "@/lib/ghg/store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: "s12" | "s3";
  // s12 fields
  equipmentId?: string;
  equipmentName?: string;
  facility?: string;
  monthKey?: string;   // if defined => cell-level; else row-level (12 months)
  monthLabel?: string;
  currentValue?: string;
  // s3 fields
  categoryId?: string;
  categoryName?: string;
}

export function EditRequestModal(props: Props) {
  const { addEditRequest, getCell } = useGhgStore();
  const { open, onOpenChange, scope, equipmentId, equipmentName, monthKey, monthLabel, categoryId, categoryName } = props;
  const [reason, setReason] = useState("");
  const [corrected, setCorrected] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<string[]>(monthKey ? [monthKey] : []);
  const [done, setDone] = useState(false);

  const isRowLevel = scope === "s12" && !monthKey;

  const currentValue = useMemo(() => {
    if (props.currentValue) return props.currentValue;
    if (equipmentId && monthKey) {
      const c = getCell(equipmentId, monthKey);
      if (!c || c.value == null) return "—";
      return Array.isArray(c.value) ? c.value.map((v) => v ?? "—").join(" / ") : String(c.value);
    }
    return "—";
  }, [equipmentId, monthKey, getCell, props.currentValue]);

  const submit = () => {
    if (!reason.trim()) return;
    if (scope === "s12") {
      addEditRequest({
        scope: "s12",
        equipmentId, equipmentName,
        facility: props.facility,
        months: isRowLevel ? selectedMonths : [monthKey!],
        monthLabel: monthLabel,
        currentValue,
        correctedValue: corrected,
        reason,
        file: file ?? undefined,
      });
    } else {
      addEditRequest({
        scope: "s3",
        categoryId, categoryName,
        reason,
        correctedValue: corrected,
        file: file ?? undefined,
      });
    }
    setDone(true);
    setTimeout(() => {
      setDone(false); setReason(""); setCorrected(""); setFile(null); setSelectedMonths([]);
      onOpenChange(false);
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PencilLine className="h-4 w-4" /> Request a Data Edit</DialogTitle>
          <DialogDescription>
            {scope === "s12" ? (
              <>
                <span className="font-mono text-xs">{equipmentId}</span> · {equipmentName}
                {monthLabel && <> · {monthLabel}</>}
              </>
            ) : categoryName}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-ghg-green" />
            <p className="text-sm font-medium">Edit request submitted.</p>
            <p className="text-xs text-muted-foreground">Your consultant will review and unlock this field if approved.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scope === "s12" && !isRowLevel && (
              <div className="rounded-md bg-neutral-soft p-2 text-xs">
                <div className="text-muted-foreground">Current submitted value</div>
                <div className="font-mono text-sm text-navy">{currentValue}</div>
              </div>
            )}

            {isRowLevel && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Which months need editing?</label>
                <div className="grid grid-cols-4 gap-1">
                  {MONTHS.map((m) => (
                    <label key={m.key} className="flex items-center gap-1 rounded border p-1 text-[11px]">
                      <input type="checkbox" checked={selectedMonths.includes(m.key)}
                        onChange={(e) => setSelectedMonths((prev) => e.target.checked ? [...prev, m.key] : prev.filter((k) => k !== m.key))} />
                      {m.short}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!isRowLevel && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Corrected value</label>
                <Input value={corrected} onChange={(e) => setCorrected(e.target.value)} placeholder="e.g. 1200" />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Reason for edit <span className="text-critical">*</span>
              </label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Incorrect log book reading, actual value taken from invoice." />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Supporting document (optional)</label>
              <input type="file" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile({ name: f.name, size: f.size });
              }} className="text-xs" />
              {file && <div className="mt-1 text-[11px] text-muted-foreground">{file.name} ({(file.size / 1024).toFixed(1)} KB)</div>}
            </div>
          </div>
        )}

        {!done && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!reason.trim() || (isRowLevel && selectedMonths.length === 0)}>
              Submit edit request
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
