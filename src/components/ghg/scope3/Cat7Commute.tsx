import { useMemo, useState } from "react";
import { Copy, QrCode, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FACILITIES } from "@/lib/ghg/registry";
import { useGhgStore } from "@/lib/ghg/store";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#1E6F5C", "#3B82F6", "#D97706", "#DC2626", "#6366F1", "#0EA5E9", "#84CC16", "#F59E0B"];

export function Cat7Commute() {
  const { state } = useGhgStore();
  const [facilityId, setFacilityId] = useState("HJ");
  const [extrapolate, setExtrapolate] = useState(false);

  const responses = state.commuteResponses.filter((r) => r.facilityId === facilityId);
  const facility = FACILITIES.find((f) => f.id === facilityId);
  const totalHeadcount = 120; // demo

  const modeSplit = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of responses) m[r.mode] = (m[r.mode] ?? 0) + 1;
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [responses]);

  const responseRate = responses.length / totalHeadcount;
  const canCalculate = responseRate >= 0.30;

  const surveyUrl = typeof window !== "undefined"
    ? `${window.location.origin}/survey/commute/${facilityId}`
    : `/survey/commute/${facilityId}`;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-neutral-soft px-2 py-0.5 font-mono text-xs">Cat 7</span>
        <h4 className="text-base font-semibold text-navy">Employee Commuting</h4>
        <Badge variant="outline" className="text-[10px]">Survey</Badge>
        <Badge variant="outline" className="ml-auto gap-1"><Users className="h-3 w-3" /> {responses.length} of {totalHeadcount} responded ({Math.round(responseRate * 100)}%)</Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Employee commuting uses a survey — no client file upload. Launch a per-facility survey, share the public link, and calculate emissions once the response rate reaches 30%.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={facilityId} onValueChange={setFacilityId}>
          <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FACILITIES.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5">
          <Send className="h-3.5 w-3.5" /> Launch Commute Survey — {facility?.name}
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(surveyUrl)} className="gap-1.5">
          <Copy className="h-3.5 w-3.5" /> Copy link
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5">
          <QrCode className="h-3.5 w-3.5" /> QR code
        </Button>
      </div>
      <div className="mt-2 truncate rounded-md bg-neutral-soft px-2 py-1 font-mono text-[11px] text-muted-foreground">{surveyUrl}</div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-neutral-soft/40 p-3">
          <div className="mb-2 text-xs font-semibold text-navy">Response Progress</div>
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-neutral-soft">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, responseRate * 100)}%` }} />
          </div>
          <div className="text-[11px] text-muted-foreground">Minimum 30% response rate required to calculate emissions.</div>
          <label className="mt-3 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={extrapolate} onChange={(e) => setExtrapolate(e.target.checked)} />
            Extrapolate to full headcount ({totalHeadcount})
          </label>
          <Button size="sm" disabled={!canCalculate} className="mt-3 w-full gap-1.5">
            Calculate Cat 7 emissions
          </Button>
        </div>
        <div className="rounded-lg border bg-neutral-soft/40 p-3">
          <div className="mb-2 text-xs font-semibold text-navy">Commute Mode Split</div>
          {modeSplit.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">No responses yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={modeSplit} dataKey="value" nameKey="name" outerRadius={70} label={{ fontSize: 10 }}>
                  {modeSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
