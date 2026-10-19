import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Info, Save, Send } from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FACILITIES, FISCAL_YEAR_LABEL } from "@/lib/ghg/registry";
import { completionColor, GhgStoreProvider, useGhgStore } from "@/lib/ghg/store";
import { ProgressRing } from "@/components/ghg/ProgressRing";
import { FacilityStrip } from "@/components/ghg/FacilityStrip";
import { EquipmentMonthlyGrid } from "@/components/ghg/EquipmentMonthlyGrid";
import { Scope3Cards } from "@/components/ghg/Scope3Cards";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Data Submission · Featherlite GHG FY26" },
      { name: "description", content: "Enter monthly Scope 1, 2 and 3 GHG data per facility and equipment for FY26 (Apr 2025 – Mar 2026)." },
      { property: "og:title", content: "Data Submission · Featherlite GHG FY26" },
      { property: "og:description", content: "Client-facing monthly GHG data collection form for Featherlite Office Systems." },
    ],
  }),
  component: () => <GhgStoreProvider><SubmitPage /></GhgStoreProvider>,
});

function SubmitPage() {
  const {
    overallProgress, facilityProgress, filledSlots, totalSlotsCount, state, submitAll, unsubmit,
  } = useGhgStore();
  const [activeFacilities, setActiveFacilities] = useState<string[]>(["HJ"]);
  const [scope3Open, setScope3Open] = useState<string[]>([]);

  const canSubmit = overallProgress >= 0.5;
  const complete = overallProgress >= 0.9999;
  const empty = overallProgress === 0;
  const submitted = !!state.submission;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky sub-header */}
      <div className="sticky top-[52px] z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-navy">Featherlite Office Systems</h1>
            <p className="text-xs text-muted-foreground">{FISCAL_YEAR_LABEL}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ProgressRing value={overallProgress} size={52} />
            <Button variant="outline" size="sm" className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save draft
            </Button>
            <Button
              size="sm" disabled={!canSubmit || submitted}
              onClick={submitAll}
              className={cn(
                "gap-1.5 transition",
                canSubmit && !complete && !submitted && "bg-amber-warn text-white hover:bg-amber-warn/90",
                complete && !submitted && "bg-ghg-green text-ghg-green-foreground hover:bg-ghg-green/90",
                submitted && "bg-ghg-green text-ghg-green-foreground",
              )}
            >
              <Send className="h-3.5 w-3.5" />
              {submitted ? "Submitted ✓" : complete ? "Submit for Review" : canSubmit ? "Submit with gaps" : "Complete ≥ 50% to submit"}
            </Button>
            {submitted && (
              <Button size="sm" variant="ghost" onClick={unsubmit} className="text-xs text-muted-foreground">Unlock (demo)</Button>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-[1440px] px-4 pb-3">
          <FacilityStrip
            activeId={activeFacilities[0]}
            onSelect={(id) => setActiveFacilities([id])}
          />
        </div>
      </div>

      <main className="mx-auto max-w-[1440px] space-y-4 px-4 py-6">
        {submitted && (
          <div className="flex items-start gap-3 rounded-lg border border-ghg-green/40 bg-ghg-green-soft p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-ghg-green" />
            <div>
              <p className="font-semibold text-navy">
                ✓ Submitted on {new Date(state.submission!.submittedAt).toLocaleDateString("en-IN")} at {new Date(state.submission!.submittedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} — your data is under consultant review.
              </p>
              <p className="mt-1 text-muted-foreground">
                Data is locked. To correct a value, click "Request edit" on the relevant card or cell.
              </p>
            </div>
          </div>
        )}
        {empty && !submitted && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-ghg-green-soft p-4 text-sm">
            <Info className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="font-semibold text-navy">Welcome to your FY26 GHG collection.</p>
              <p className="mt-1 text-muted-foreground">
                Your consultant has pre-loaded the facility and equipment list. Fill in month by month — you don't need to
                complete everything at once. Everything auto-saves locally. Use "Seed demo" in the header to preview a partially-filled workspace.
              </p>
            </div>
          </div>
        )}

        {canSubmit && !complete && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-warn/40 bg-amber-soft/50 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-warn" />
            <div>
              <p className="font-semibold text-navy">Good progress — {Math.round(overallProgress * 100)}% complete.</p>
              <p className="mt-1 text-muted-foreground">
                You can submit with gaps, or finish the remaining months. Missing data will be flagged in the admin tracker.
              </p>
            </div>
          </div>
        )}

        {complete && (
          <div className="flex items-start gap-3 rounded-lg border border-ghg-green/40 bg-ghg-green-soft p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-ghg-green" />
            <div>
              <p className="font-semibold text-navy">All data captured for FY26. Ready to submit.</p>
              <p className="mt-1 text-muted-foreground">
                Your consultant will receive the full submission and run the emissions calculations.
              </p>
            </div>
          </div>
        )}

        <Accordion
          type="multiple"
          value={activeFacilities}
          onValueChange={setActiveFacilities}
          className="space-y-3"
        >
          {FACILITIES.map((f) => {
            const pct = facilityProgress(f.id);
            const color = completionColor(pct);
            return (
              <AccordionItem key={f.id} value={f.id} className="rounded-lg border bg-card shadow-sm">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex w-full items-center gap-3 pr-2">
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md text-xs font-mono font-semibold",
                      color === "green" ? "bg-ghg-green text-ghg-green-foreground"
                        : color === "amber" ? "bg-amber-warn text-white"
                        : color === "red" ? "bg-critical text-white"
                        : "bg-neutral-soft text-muted-foreground",
                    )}>{f.id}</div>
                    <div className="text-left">
                      <div className="text-base font-semibold text-navy">{f.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {f.type} · {f.utility} · {f.equipment.length} equipment sources
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px]">{f.status}</Badge>
                      <span className="text-sm font-semibold tabular-nums text-navy">{Math.round(pct * 100)}%</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="border-t bg-neutral-soft/30 px-4 py-4">
                  <div className="space-y-5">
                    {f.equipment.map((e) => (
                      <section key={e.id} className="rounded-lg border bg-card p-4 shadow-sm">
                        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-navy">{e.name}</h3>
                              <span className="rounded-md bg-neutral-soft px-2 py-0.5 font-mono text-[11px]">{e.id}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  e.scope === "S1" ? "border-primary text-primary" : "border-amber-warn text-amber-warn",
                                )}
                              >{e.category}</Badge>
                              {e.mode === "annual" && (
                                <Badge className="bg-muted text-muted-foreground text-[10px]">Annual entry</Badge>
                              )}
                            </div>
                            {e.helper && <p className="mt-1 text-xs text-muted-foreground">{e.helper}</p>}
                          </div>
                        </header>
                        <EquipmentMonthlyGrid equipment={e} />
                      </section>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Scope 3 */}
        <Accordion type="multiple" value={scope3Open} onValueChange={setScope3Open}>
          <AccordionItem value="s3" className="rounded-lg border bg-card shadow-sm">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex w-full items-center gap-3 pr-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-navy text-xs font-semibold text-navy-foreground">S3</div>
                <div className="text-left">
                  <div className="text-base font-semibold text-navy">Scope 3 — Value Chain Categories</div>
                  <div className="text-[11px] text-muted-foreground">
                    8 relevant categories (of 15 GHG Protocol). Upload one dataset per applicable category.
                  </div>
                </div>
                <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition group-data-[state=open]:rotate-180" />
              </div>
            </AccordionTrigger>
            <AccordionContent className="border-t bg-neutral-soft/30 px-4 py-4">
              <Scope3Cards />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </main>

      {/* Bottom sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 text-xs">
          <span className="tabular-nums text-muted-foreground">
            {filledSlots.toLocaleString()} of {totalSlotsCount.toLocaleString()} fields complete
          </span>
          <div className="mx-3 h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-soft">
            <div
              className={cn(
                "h-full transition-all",
                complete ? "bg-ghg-green" : canSubmit ? "bg-amber-warn" : overallProgress > 0 ? "bg-critical" : "bg-muted-foreground/40",
              )}
              style={{ width: `${Math.max(2, overallProgress * 100)}%` }}
            />
          </div>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}
