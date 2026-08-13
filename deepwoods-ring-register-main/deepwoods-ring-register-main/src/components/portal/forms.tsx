import {
  Field,
  MicroLabel,
  RingNumber,
  TeamMemberCard,
  YesNo,
  inputCls,
} from "@/components/portal/primitives";
import {
  INDUSTRIES,
  ORG_TYPES,
  type CompanyDetails,
  type Facility,
  type TeamMember,
} from "@/lib/portal-store";
import { X } from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 10);

export function CompanyDetailsForm({
  value,
  onChange,
}: {
  value: CompanyDetails;
  onChange: (patch: Partial<CompanyDetails>) => void;
}) {
  const india = value.registeredInIndia;
  return (
    <div className="grid gap-7 md:grid-cols-2">
      <Field
        label="Is your organisation registered in India?"
        helper="This determines whether we ask for a GSTIN or a general business registration / tax ID."
      >
        <YesNo value={india} onChange={(v) => onChange({ registeredInIndia: v })} />
      </Field>

      <Field
        label={india ? "GSTIN" : "Business Registration Number / Tax ID"}
        required
        helper={
          india
            ? "Your 15-character GST Identification Number, as shown on your GST registration certificate."
            : "The primary business registration or tax ID issued in your country of incorporation."
        }
      >
        <input
          className={inputCls}
          value={value.gstin}
          onChange={(e) => onChange({ gstin: e.target.value })}
        />
      </Field>

      <Field
        label="Legal name of the organisation"
        required
        helper="The exact registered name on your incorporation or registration certificate — this is what will appear on official reports."
      >
        <input
          className={inputCls}
          value={value.legalName}
          onChange={(e) => onChange({ legalName: e.target.value })}
        />
      </Field>

      <Field
        label="Operating name of the organisation (if different)"
        helper="Name as you want it displayed across the portal and any reports, if different from the legal name above."
      >
        <input
          className={inputCls}
          value={value.operatingName}
          onChange={(e) => onChange({ operatingName: e.target.value })}
        />
      </Field>

      <Field
        label="Industry"
        required
        tooltip="Emission factors default from your sector — you can override them later."
        helper="Choose the sector closest to your primary business activity — this affects the default emission factors used in your calculations."
      >
        <select
          className={inputCls}
          value={value.industry}
          onChange={(e) => onChange({ industry: e.target.value })}
        >
          <option value="">Select an industry</option>
          {INDUSTRIES.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </Field>

      <Field
        label="Organisational Type"
        required
        helper="Your legal structure, as stated on your registration documents."
      >
        <select
          className={inputCls}
          value={value.orgType}
          onChange={(e) => onChange({ orgType: e.target.value })}
        >
          <option value="">Select a type</option>
          {ORG_TYPES.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </Field>

      <Field
        label="Is your organisation registered as an MSME?"
        helper="Select Yes if you hold an Udyam (or equivalent) MSME registration."
      >
        <YesNo value={value.msme} onChange={(v) => onChange({ msme: v })} />
      </Field>

      {value.msme && (
        <Field label="Udyam Registration Number" helper="Format: UDYAM-XX-00-0000000.">
          <input
            className={inputCls}
            value={value.udyam}
            onChange={(e) => onChange({ udyam: e.target.value })}
          />
        </Field>
      )}

      <Field
        label="Legal Address"
        required
        className="md:col-span-2"
        helper="Your registered head office address. This will automatically become your first facility in the next step, so double-check it here."
      >
        <textarea
          rows={3}
          className={inputCls}
          value={value.legalAddress}
          onChange={(e) => onChange({ legalAddress: e.target.value })}
        />
      </Field>

      <Field
        label="Organisation Website"
        required
        helper="Include https:// — this is used on client-facing reports."
      >
        <input
          className={inputCls}
          value={value.website}
          onChange={(e) => onChange({ website: e.target.value })}
        />
      </Field>

      <Field
        label="Upload Company Logo"
        helper="PNG or SVG with a transparent background works best. Used on your reports and in the portal header."
      >
        <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-white px-4 py-6 text-sm text-slate hover:border-coral">
          {value.logoName || "Drag and drop, or click to choose a file"}
          <input
            type="file"
            className="hidden"
            onChange={(e) => onChange({ logoName: e.target.files?.[0]?.name ?? "" })}
          />
        </label>
      </Field>
    </div>
  );
}

export function FacilitiesForm({
  facilities,
  additionalCount,
  onFacilities,
  onCount,
  onEditAddress,
}: {
  facilities: Facility[];
  additionalCount: number;
  onFacilities: (f: Facility[]) => void;
  onCount: (n: number) => void;
  onEditAddress?: () => void;
}) {
  const head = facilities[0];
  const rest = facilities.slice(1);

  function setCount(n: number) {
    const count = Math.max(0, isNaN(n) ? 0 : n);
    onCount(count);
    const next = [...rest];
    while (next.length < count) next.push({ id: uid(), name: "", location: "" });
    while (next.length > count) next.pop();
    onFacilities([head as Facility, ...next]);
  }

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-slate">
        Include every physical location where this organisation operates — factories, offices,
        warehouses, retail sites, and so on. Your registered head office is already added below as
        Facility 1, using the address you gave in Company Details.
      </p>

      <div className="rounded-[10px] border border-border bg-white p-5">
        <MicroLabel>Facility 1 · Head Office</MicroLabel>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Field label="Facility name" helper="Editable — how this site is labelled in the portal.">
            <input
              className={inputCls}
              value={head?.name ?? ""}
              onChange={(e) =>
                onFacilities([{ ...(head as Facility), name: e.target.value }, ...rest])
              }
            />
          </Field>
          <Field label="Facility location / address" helper="Taken from your Legal Address.">
            <textarea rows={2} readOnly className={inputCls + " bg-paper"} value={head?.location ?? ""} />
            {onEditAddress && (
              <button
                type="button"
                onClick={onEditAddress}
                className="cursor-pointer text-xs text-coral hover:underline"
              >
                Edit in Company Details →
              </button>
            )}
          </Field>
        </div>
      </div>

      <Field
        label="How many additional facilities do you have?"
        required
        className="max-w-xs"
        helper="Count every site besides your head office — you'll fill in a name and address for each one next."
      >
        <input
          type="number"
          min={0}
          className={inputCls}
          value={additionalCount}
          onChange={(e) => setCount(parseInt(e.target.value, 10))}
        />
      </Field>

      {rest.map((f, i) => (
        <div key={f.id} className="relative rounded-[10px] border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RingNumber n={i + 2} />
              <MicroLabel>Facility {i + 2}</MicroLabel>
            </div>
            <button
              type="button"
              aria-label="Remove facility"
              onClick={() => {
                const next = rest.filter((r) => r.id !== f.id);
                onCount(next.length);
                onFacilities([head as Facility, ...next]);
              }}
              className="cursor-pointer text-slate hover:text-coral"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <Field
              label="Facility name"
              required
              helper="A short, recognisable name for the site, e.g. 'Chennai Plant' or 'Mumbai Warehouse'."
            >
              <input
                className={inputCls}
                value={f.name}
                onChange={(e) =>
                  onFacilities([
                    head as Facility,
                    ...rest.map((r) => (r.id === f.id ? { ...r, name: e.target.value } : r)),
                  ])
                }
              />
            </Field>
            <Field
              label="Facility location / address"
              required
              helper="Full physical address — used to determine the correct regional grid emission factor for this site."
            >
              <textarea
                rows={2}
                className={inputCls}
                value={f.location}
                onChange={(e) =>
                  onFacilities([
                    head as Facility,
                    ...rest.map((r) => (r.id === f.id ? { ...r, location: e.target.value } : r)),
                  ])
                }
              />
            </Field>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setCount(rest.length + 1)}
        className="cursor-pointer text-sm font-medium text-coral hover:underline"
      >
        + Add another facility
      </button>
    </div>
  );
}

export function TeamForm({
  team,
  onChange,
}: {
  team: TeamMember[];
  onChange: (t: TeamMember[]) => void;
}) {
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-slate">
        Add the people who should have access to this entity. Each person's access is scoped to this
        entity only — they won't be able to see or edit any other account in the group.
      </p>

      {team.length === 0 && <p className="text-sm text-slate">No team members on record yet.</p>}

      {team.map((m, i) => (
        <TeamMemberCard
          key={m.id}
          member={m}
          index={i}
          onChange={(patch) => onChange(team.map((t) => (t.id === m.id ? { ...t, ...patch } : t)))}
          onRemove={() => onChange(team.filter((t) => t.id !== m.id))}
        />
      ))}

      <button
        type="button"
        onClick={() =>
          onChange([...team, { id: uid(), fullName: "", email: "", role: "viewer" }])
        }
        className="cursor-pointer rounded-[6px] border border-coral px-4 py-2 text-sm font-medium text-coral hover:bg-coral-tint"
      >
        + Add team member
      </button>
    </div>
  );
}
