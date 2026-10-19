import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { Building2, Calendar, Layers, Plus, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, PolarAngleAxis,
  PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  scopeTotalsByYear, YEARS, FACILITY_NAMES, FACILITY_SHARE, type YearKey,
} from "@/lib/ghg/historicalData";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare · Featherlite GHG" },
      { name: "description", content: "Drag facilities, years or scopes into panels to compare emissions side-by-side." },
      { property: "og:title", content: "Compare · Featherlite GHG" },
      { property: "og:description", content: "Interactive comparison of GHG emissions across facilities, years, and scopes." },
    ],
  }),
  component: ComparePage,
});

type CardKind = "facility" | "year" | "scope";
interface CardDef { kind: CardKind; id: string; label: string }

const FACILITY_CARDS: CardDef[] = Object.entries(FACILITY_NAMES).map(([id, label]) => ({ kind: "facility", id, label }));
const YEAR_CARDS: CardDef[] = YEARS.map((y) => ({ kind: "year", id: y, label: y }));
const SCOPE_CARDS: CardDef[] = [
  { kind: "scope", id: "S1", label: "Scope 1" },
  { kind: "scope", id: "S2LB", label: "Scope 2 LB" },
  { kind: "scope", id: "S2MB", label: "Scope 2 MB" },
  { kind: "scope", id: "S3", label: "Scope 3" },
];

interface PanelState { card: CardDef | null; year: YearKey }

function computeMetrics(panel: PanelState) {
  const t = scopeTotalsByYear(panel.year);
  if (!panel.card) return null;
  const c = panel.card;
  if (c.kind === "facility") {
    const share = FACILITY_SHARE[c.id] ?? 0;
    return {
      title: c.label, S1: t.s1 * share, S2LB: t.s2lb * share, S2MB: t.s2mb * share,
      S3: (t.s3 ?? 0) * share, total: t.totalLB * share, pct: share,
    };
  }
  if (c.kind === "year") {
    const tt = scopeTotalsByYear(c.id as YearKey);
    return { title: c.label, S1: tt.s1, S2LB: tt.s2lb, S2MB: tt.s2mb, S3: tt.s3 ?? 0, total: tt.totalLB, pct: 1 };
  }
  const v = c.id === "S1" ? t.s1 : c.id === "S2LB" ? t.s2lb : c.id === "S2MB" ? t.s2mb : (t.s3 ?? 0);
  return { title: `${c.label} · ${panel.year}`, S1: c.id === "S1" ? v : 0, S2LB: c.id === "S2LB" ? v : 0, S2MB: c.id === "S2MB" ? v : 0, S3: c.id === "S3" ? v : 0, total: v, pct: v / t.totalLB };
}

function DraggableCard({ card }: { card: CardDef }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${card.kind}:${card.id}`, data: card });
  const icon = card.kind === "facility" ? <Building2 className="h-3 w-3" /> : card.kind === "year" ? <Calendar className="h-3 w-3" /> : <Layers className="h-3 w-3" />;
  return (
    <button ref={setNodeRef} {...listeners} {...attributes}
      className={cn(
        "flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs shadow-sm transition hover:bg-accent",
        isDragging && "opacity-40",
      )}>
      {icon} {card.label}
    </button>
  );
}

function DropPanel({ id, panel, onClear, onYear, onClick }: {
  id: string; panel: PanelState;
  onClear: () => void; onYear: (y: YearKey) => void; onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const m = computeMetrics(panel);
  return (
    <div ref={setNodeRef} onClick={onClick}
      className={cn(
        "min-h-[220px] rounded-lg border-2 border-dashed p-3 transition",
        isOver ? "border-primary bg-ghg-green-soft" : "border-input bg-card",
        panel.card && "border-solid",
      )}>
      {!panel.card ? (
        <div className="flex h-full min-h-[200px] items-center justify-center text-xs text-muted-foreground">
          Drop a card here (or click a card below)
        </div>
      ) : m && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-navy">{m.title}</div>
            <div className="flex items-center gap-1">
              <Select value={panel.year} onValueChange={(v) => onYear(v as YearKey)}>
                <SelectTrigger className="h-6 w-[70px] text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
              <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="rounded p-1 text-muted-foreground hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Metric label="Total tCO₂e" value={m.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} bold />
            <Metric label="% of company" value={`${(m.pct * 100).toFixed(1)}%`} />
            <Metric label="S1" value={m.S1.toFixed(1)} />
            <Metric label="S2 LB" value={m.S2LB.toFixed(1)} />
            <Metric label="S2 MB" value={m.S2MB.toFixed(1)} />
            <Metric label="S3" value={m.S3.toFixed(0)} />
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="rounded-md bg-neutral-soft/60 px-2 py-1">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("tabular-nums", bold ? "text-sm font-bold text-navy" : "text-xs")}>{value}</div>
    </div>
  );
}

function ComparePage() {
  const [panels, setPanels] = useState<PanelState[]>([
    { card: null, year: "FY25" }, { card: null, year: "FY25" },
  ]);
  const [chartType, setChartType] = useState<"bar" | "line" | "radar">("bar");

  const setPanel = (i: number, next: Partial<PanelState>) =>
    setPanels((p) => p.map((x, idx) => idx === i ? { ...x, ...next } : x));

  const placeCard = (card: CardDef, panelIdx?: number) => {
    setPanels((p) => {
      if (panelIdx != null) return p.map((x, i) => i === panelIdx ? { ...x, card } : x);
      const empty = p.findIndex((x) => !x.card);
      if (empty === -1) return p.map((x, i) => i === 0 ? { ...x, card } : x);
      return p.map((x, i) => i === empty ? { ...x, card } : x);
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const idx = Number(String(e.over.id).replace("panel-", ""));
    placeCard(e.active.data.current as CardDef, idx);
  };

  const chartData = panels.filter((p) => p.card).map((p) => {
    const m = computeMetrics(p)!;
    return { name: m.title, S1: m.S1, "S2 LB": m.S2LB, S3: m.S3 };
  });

  const radarData = ["S1", "S2 LB", "S3"].map((axis) => {
    const row: Record<string, string | number> = { axis };
    panels.forEach((p, i) => {
      const m = computeMetrics(p);
      if (m) row[m.title] = axis === "S1" ? m.S1 : axis === "S2 LB" ? m.S2LB : m.S3;
      else row[`Panel ${i + 1}`] = 0;
    });
    return row;
  });

  const preset = (kind: "facility-vs-facility" | "year-yoy" | "scopes" | "top3") => {
    if (kind === "facility-vs-facility") setPanels([{ card: FACILITY_CARDS[0], year: "FY25" }, { card: FACILITY_CARDS[1], year: "FY25" }]);
    if (kind === "year-yoy") setPanels([{ card: YEAR_CARDS[YEARS.indexOf("FY26")], year: "FY26" }, { card: YEAR_CARDS[YEARS.indexOf("FY25")], year: "FY25" }]);
    if (kind === "scopes") setPanels([{ card: SCOPE_CARDS[0], year: "FY25" }, { card: SCOPE_CARDS[1], year: "FY25" }, { card: SCOPE_CARDS[3], year: "FY25" }]);
    if (kind === "top3") {
      const top = Object.entries(FACILITY_SHARE).sort((a, b) => b[1] - a[1]).slice(0, 3);
      setPanels(top.map(([id]) => ({ card: FACILITY_CARDS.find((c) => c.id === id)!, year: "FY25" })));
    }
  };

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[1440px] space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-navy">Compare</h1>
              <p className="text-xs text-muted-foreground">Drag or click cards to compare facilities, years, and scopes side-by-side.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPanels(panels.map((p) => ({ ...p, card: null })))}>Clear all</Button>
              <Button size="sm" variant="outline" onClick={() => setPanels([...panels, { card: null, year: "FY25" }])} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add panel</Button>
              <Button size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Download PDF</Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => preset("facility-vs-facility")}>Facility vs Facility</Button>
            <Button size="sm" variant="secondary" onClick={() => preset("year-yoy")}>This year vs Last year</Button>
            <Button size="sm" variant="secondary" onClick={() => preset("scopes")}>S1 vs S2 vs S3</Button>
            <Button size="sm" variant="secondary" onClick={() => preset("top3")}>Top 3 emitting facilities</Button>
          </div>

          <div className={cn("grid gap-3", panels.length <= 2 ? "grid-cols-1 md:grid-cols-2" : panels.length === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4")}>
            {panels.map((p, i) => (
              <DropPanel key={i} id={`panel-${i}`} panel={p}
                onClear={() => setPanel(i, { card: null })}
                onYear={(y) => setPanel(i, { year: y })}
                onClick={() => {/* click-to-cycle handled via library */}}
              />
            ))}
          </div>

          {chartData.length >= 2 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-navy">Comparison Chart</h3>
                <Tabs value={chartType} onValueChange={(v) => setChartType(v as "bar" | "line" | "radar")}>
                  <TabsList className="h-7">
                    <TabsTrigger value="bar" className="h-6 text-xs">Bar</TabsTrigger>
                    <TabsTrigger value="line" className="h-6 text-xs">Line</TabsTrigger>
                    <TabsTrigger value="radar" className="h-6 text-xs">Radar</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                {chartType === "bar" ? (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="S1" fill="#1B2A4A" />
                    <Bar dataKey="S2 LB" fill="#3B82F6" />
                    <Bar dataKey="S3" fill="#1E6F5C" />
                  </BarChart>
                ) : chartType === "line" ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="S1" stroke="#1B2A4A" strokeWidth={2} />
                    <Line type="monotone" dataKey="S2 LB" stroke="#3B82F6" strokeWidth={2} />
                    <Line type="monotone" dataKey="S3" stroke="#1E6F5C" strokeWidth={2} />
                  </LineChart>
                ) : (
                  <RadarChart data={radarData}>
                    <PolarGrid /><PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fontSize: 10 }} />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                    {panels.filter((p) => p.card).map((p, i) => {
                      const m = computeMetrics(p)!;
                      const color = ["#1E6F5C", "#3B82F6", "#D97706", "#DC2626"][i % 4];
                      return <Radar key={i} name={m.title} dataKey={m.title} stroke={color} fill={color} fillOpacity={0.3} />;
                    })}
                  </RadarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold text-navy">Source Library</h3>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">Facilities</div>
                <div className="flex flex-wrap gap-2">
                  {FACILITY_CARDS.map((c) => <DraggableCard key={c.id} card={c} />)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">Years</div>
                <div className="flex flex-wrap gap-2">
                  {YEAR_CARDS.map((c) => <DraggableCard key={c.id} card={c} />)}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">Scopes</div>
                <div className="flex flex-wrap gap-2">
                  {SCOPE_CARDS.map((c) => <DraggableCard key={c.id} card={c} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
}
