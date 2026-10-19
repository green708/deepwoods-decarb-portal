import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FACILITIES } from "@/lib/ghg/registry";
import { useGhgStore } from "@/lib/ghg/store";

export const Route = createFileRoute("/survey/commute/$facilityId")({
  head: ({ params }) => ({
    meta: [
      { title: "Commute Survey · Featherlite GHG" },
      { name: "description", content: `Quick employee commute survey for facility ${params.facilityId} — takes under 60 seconds.` },
      { property: "og:title", content: "Commute Survey · Featherlite GHG" },
      { property: "og:description", content: "Help us measure Scope 3 Cat 7 emissions. 7 quick questions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SurveyPage,
});

const MODES = ["Private car", "Company bus", "Public bus", "Auto-rickshaw", "Metro/Train", "Bicycle", "Walk", "Two-wheeler", "Other"];

function SurveyPage() {
  const { facilityId } = Route.useParams();
  const { addCommuteResponse } = useGhgStore();
  const facility = FACILITIES.find((f) => f.id === facilityId);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    days: 5, mode: "", distance: 0, fuel: "", carpool: false, carpoolCount: 1, weeks: 48,
  });

  const isCar = form.mode === "Private car";

  const submit = () => {
    if (!form.mode) return;
    addCommuteResponse({
      facilityId, days: form.days, mode: form.mode, distance: form.distance,
      fuel: isCar ? form.fuel : undefined,
      carpool: isCar ? form.carpool : undefined,
      carpoolCount: isCar && form.carpool ? form.carpoolCount : undefined,
      weeks: form.weeks,
    });
    setDone(true);
  };

  if (done) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-ghg-green" />
        <h1 className="text-xl font-bold text-navy">Thank you</h1>
        <p className="text-sm text-muted-foreground">Your response has been recorded for {facility?.name ?? facilityId}. You can close this tab.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Commute Survey</h1>
        <p className="text-sm text-muted-foreground">Facility: <span className="font-semibold">{facility?.name ?? facilityId}</span></p>
        <p className="mt-1 text-xs text-muted-foreground">Under 60 seconds. Anonymous — no login needed.</p>
      </div>

      <Field label="1. Days per week you commute (0–7)">
        <Input type="number" min={0} max={7} value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} />
      </Field>

      <Field label="2. Primary transport mode">
        <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
          <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
          <SelectContent>{MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </Field>

      <Field label="3. One-way commute distance (km)">
        <Input type="number" value={form.distance} onChange={(e) => setForm({ ...form, distance: Number(e.target.value) })} />
      </Field>

      {isCar && (
        <>
          <Field label="4. Fuel type">
            <Select value={form.fuel} onValueChange={(v) => setForm({ ...form, fuel: v })}>
              <SelectTrigger><SelectValue placeholder="Select fuel" /></SelectTrigger>
              <SelectContent>
                {["Petrol", "Diesel", "CNG", "Electric"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="5. Do you carpool?">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.carpool} onChange={(e) => setForm({ ...form, carpool: e.target.checked })} />
              Yes — with how many people?
              {form.carpool && (
                <Input type="number" min={1} className="w-16" value={form.carpoolCount}
                  onChange={(e) => setForm({ ...form, carpoolCount: Number(e.target.value) })} />
              )}
            </label>
          </Field>
        </>
      )}

      <Field label={`${isCar ? "6" : "4"}. Weeks worked per year`}>
        <Input type="number" value={form.weeks} onChange={(e) => setForm({ ...form, weeks: Number(e.target.value) })} />
      </Field>

      <Button className="w-full" onClick={submit} disabled={!form.mode}>Submit response</Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
