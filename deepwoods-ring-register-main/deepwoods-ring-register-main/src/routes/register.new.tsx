import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TopLevelShell } from "@/components/portal/shell";
import { MicroLabel, RingStepper, StampBadge } from "@/components/portal/primitives";
import { CompanyDetailsForm, FacilitiesForm, TeamForm } from "@/components/portal/forms";
import {
  ROLE_LABEL,
  emptyCompanyDetails,
  usePortal,
  type CompanyDetails,
  type Facility,
  type TeamMember,
} from "@/lib/portal-store";

export const Route = createFileRoute("/register/new")({
  head: () => ({
    meta: [
      { title: "Register entity — Deepwoods GHG Portal" },
      {
        name: "description",
        content:
          "Five-step registration for a new legal entity: company details, facilities, team access, payment and review.",
      },
      { property: "og:title", content: "Register entity — Deepwoods GHG Portal" },
      {
        property: "og:description",
        content: "Set up a new operating company on the Deepwoods GHG Portal.",
      },
    ],
  }),
  component: Wizard,
});

const STEPS = ["Company Details", "Facilities", "Manage Team", "Payment", "Submit"];

function Wizard() {
  const { addAccount } = usePortal();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<CompanyDetails>(emptyCompanyDetails);
  const [facilities, setFacilities] = useState<Facility[]>([
    { id: "head", name: "Head Office", location: "", locked: true },
  ]);
  const [count, setCount] = useState(0);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [paymentRequested, setPaymentRequested] = useState(false);

  useEffect(() => {
    setFacilities((prev) => [
      { ...(prev[0] as Facility), location: details.legalAddress },
      ...prev.slice(1),
    ]);
  }, [details.legalAddress]);

  function submit() {
    const name = details.legalName || details.operatingName || "Unnamed entity";
    addAccount({
      companyName: name,
      status: "pending",
      orgType: details.orgType || "—",
      industry: details.industry || "—",
      plan: "Deepwoods GHG Portal — Annual Access",
      companyDetails: details,
      facilities,
      team,
      invoices: [
        {
          id: `INV-${name.slice(0, 3).toUpperCase()}-FY27-001`,
          period: "FY27",
          amount: "₹75,000",
          status: "due",
          datePaid: null,
        },
      ],
      emissions: { scope1: 0, scope2: 0, scope3: 0 },
    });
    toast("Registration submitted — status is Pending review.");
    navigate({ to: "/register" });
  }

  return (
    <TopLevelShell active="register">
      <h1 className="text-[32px] leading-tight font-bold text-ink">Register entity</h1>
      <p className="mt-1 text-sm text-slate">
        Set up one operating company end to end. You can revisit any step before submitting.
      </p>

      <div className="mt-8 rounded-[10px] border border-border bg-white px-8 py-6">
        <RingStepper steps={STEPS} current={step} onStep={setStep} />
        <p className="mt-5 text-xs text-slate">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-coral align-middle" />
          Required fields — shown for reference; nothing is enforced in this build.
        </p>
      </div>

      <div className="mt-6 rounded-[10px] border border-border bg-white p-8">
        {step === 0 && (
          <CompanyDetailsForm
            value={details}
            onChange={(patch) => setDetails((d) => ({ ...d, ...patch }))}
          />
        )}

        {step === 1 && (
          <FacilitiesForm
            facilities={facilities}
            additionalCount={count}
            onFacilities={setFacilities}
            onCount={setCount}
            onEditAddress={() => setStep(0)}
          />
        )}

        {step === 2 && <TeamForm team={team} onChange={setTeam} />}

        {step === 3 && (
          <div className="max-w-2xl space-y-5">
            <div className="rounded-[10px] border border-border bg-paper p-6">
              <MicroLabel>Plan</MicroLabel>
              <h2 className="mt-1 text-lg font-bold text-ink">
                Deepwoods GHG Portal — Annual Access
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-ink">
                {[
                  "Full Scope 1, 2 and 3 inventory for this entity",
                  "Facility-level data submission and document vault",
                  "Annual assured report pack aligned to GHG Protocol + ISO 14064-1",
                  "Decarbonisation pathway and peer benchmarking modules",
                ].map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-canopy" />
                    {b}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate">
                Pricing is confirmed manually. Our team will reach out to complete payment — nothing
                is charged automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPaymentRequested(true);
                toast("Payment request logged — the Deepwoods team will be in touch.");
              }}
              className="cursor-pointer rounded-[6px] bg-canopy px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Proceed to Payment
            </button>
            {paymentRequested && <StampBadge status="pending" />}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8">
            <Section title="Company Details">
              <Review label="Registered in India" value={details.registeredInIndia ? "Yes" : "No"} />
              <Review
                label={details.registeredInIndia ? "GSTIN" : "Business Registration / Tax ID"}
                value={details.gstin}
              />
              <Review label="Legal name" value={details.legalName} />
              <Review label="Operating name" value={details.operatingName} />
              <Review label="Industry" value={details.industry} />
              <Review label="Organisational type" value={details.orgType} />
              <Review label="MSME" value={details.msme ? `Yes · ${details.udyam || "—"}` : "No"} />
              <Review label="Legal address" value={details.legalAddress} />
              <Review label="Website" value={details.website} />
            </Section>

            <Section title="Facilities">
              {facilities.map((f, i) => (
                <Review
                  key={f.id}
                  label={`Facility ${i + 1}${i === 0 ? " · Head Office" : ""} — ${f.name || "—"}`}
                  value={f.location}
                />
              ))}
            </Section>

            <Section title="Manage Team">
              {team.length === 0 && <p className="text-sm text-slate">No team members added.</p>}
              {team.map((m) => (
                <Review
                  key={m.id}
                  label={m.fullName || "—"}
                  value={`${m.email || "—"} · ${ROLE_LABEL[m.role]}`}
                />
              ))}
            </Section>

            <Section title="Payment">
              <Review
                label="Deepwoods GHG Portal — Annual Access"
                value={paymentRequested ? "Payment requested — awaiting confirmation" : "Not yet requested"}
              />
            </Section>

            <button
              type="button"
              onClick={submit}
              className="cursor-pointer rounded-[6px] bg-canopy px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Submit registration
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="cursor-pointer rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back
        </button>
        {step < STEPS.length - 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="cursor-pointer rounded-[6px] bg-canopy px-5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Next
          </button>
        )}
      </div>
    </TopLevelShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <MicroLabel>{title}</MicroLabel>
      <div className="mt-3 space-y-2 border-t border-dashed border-border pt-3">{children}</div>
    </div>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-6 text-sm">
      <span className="w-64 shrink-0 text-slate">{label}</span>
      <span className="text-ink">{value || "—"}</span>
    </div>
  );
}
