import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authFetch, getRole, getEmail, changePassword } from "@/lib/auth";
import { clearClientContext } from "@/lib/client-context";
import { useFacilities, useAddFacility, useUpdateFacility, useDeleteFacility } from "@/lib/api";
import { useClientContext, type ClientContext } from "@/lib/client-context";
import { PageHeader, PageBody } from "@/components/portal";
import {
  Building2, Users, CreditCard, List, Check, Loader2, ExternalLink, Pencil, X,
  Plus, Trash2, PauseCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/company-profile")({ component: CompanyProfilePage });

const INDUSTRIES = [
  "Agriculture & Forestry", "Automotive & Mobility", "Chemicals & Materials",
  "Construction & Infrastructure", "Consumer Goods & Retail", "Education",
  "Energy & Utilities", "Financial Services", "Food & Beverage",
  "Healthcare & Pharmaceuticals", "Hospitality & Tourism", "IT / Technology & Software",
  "Logistics & Transportation", "Manufacturing — Discrete", "Manufacturing — Process",
  "Media & Entertainment", "Mining & Metals", "Professional Services",
  "Real Estate", "Telecommunications", "Textiles & Apparel", "Waste & Recycling", "Other",
];

const ORG_TYPES_LEGAL = [
  "Private Limited", "Public Limited", "LLP", "Partnership",
  "Sole Proprietorship", "Trust / NGO", "Government Body", "Other",
];

const CONSOLIDATION_LABELS: Record<string, string> = {
  consolidated:      "Operational Control (consolidated reporting)",
  equity_share:      "Equity Share",
  financial_control: "Financial Control",
  separate:          "Separate entities (no consolidated roll-up)",
};

const TABS = [
  { id: "details",  label: "Details",    icon: Building2 },
  { id: "entities", label: "Facilities", icon: List },
  { id: "team",     label: "Team",       icon: Users },
  { id: "billing",  label: "Billing",    icon: CreditCard },
  { id: "profile",  label: "My Profile", icon: Users },
] as const;

type Tab = (typeof TABS)[number]["id"];

function CompanyProfilePage() {
  const ctx = useClientContext();
  const role = getRole();
  const email = getEmail();
  const primaryContactEmail = ((ctx.config.primary_contact_email as string) || "").toLowerCase();
  const isPrimaryContact = !primaryContactEmail || (email || "").toLowerCase() === primaryContactEmail;
  // Entity admin = a sustainability_team user locked to one entity, not the org-wide contact.
  const isEntityAdmin = role === "sustainability_team" && !!ctx.user?.entity_scope && !isPrimaryContact;
  const visibleTabs = isEntityAdmin ? TABS.filter(t => t.id === "entities" || t.id === "team" || t.id === "profile") : TABS;
  const [activeTab, setActiveTab] = useState<Tab>(isEntityAdmin ? "entities" : "details");

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={ctx.client.name}
        description={isEntityAdmin
          ? "Manage facilities and team members for your entity."
          : "View your account details, entities, team members, and billing status."}
      />
      <PageBody>
        {/* Tab strip */}
        <div className="mb-6 flex gap-1 rounded-xl border border-[var(--border)] bg-card p-1 w-fit shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  active
                    ? "bg-[#1E6F5C] text-white shadow-sm"
                    : "text-muted-foreground hover:bg-[#F3F4F6] hover:text-[var(--navy)]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "details"  && <DetailsTab ctx={ctx} />}
        {activeTab === "entities" && <FacilitiesTab ctx={ctx} />}
        {activeTab === "team"     && <TeamTab role={role} />}
        {activeTab === "billing"  && <BillingTab ctx={ctx} role={role} />}
        {activeTab === "profile"  && <UserProfileTab role={role} />}
      </PageBody>
    </>
  );
}

// ── Details tab ───────────────────────────────────────────────────────────────

const SERVICES_LIST = [
  "Scope 1 & Scope 2",
  "Scope 1 & 2 with Assurance",
  "SBTi Target Setting",
  "Scope 1, 2 & 3",
  "Scope 1, 2 & 3 with Assurance",
  "Other — Specify",
];

function DetailsTab({ ctx }: { ctx: ClientContext }) {
  const parentEntity = ctx.entities.find(e => !e.is_consolidated);
  const cfg = ctx.config;

  const { data: reqData } = useQuery({
    queryKey: ["request-access-prefill"],
    queryFn: () => authFetch("request-access.php"),
    staleTime: Infinity,
  });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(ctx.client.name);
  const [operatingName, setOperatingName] = useState<string>((cfg.operating_name as string) ?? "");
  const [isIndia, setIsIndia] = useState<boolean>((cfg.country as string) === "India");
  const [gstin, setGstin] = useState<string>(parentEntity?.tax_id ?? "");
  const [industry, setIndustry] = useState<string>((cfg.industry as string) ?? "");
  const [orgType, setOrgType] = useState<string>(parentEntity?.org_type ?? "");
  const [reportingModel, setReportingModel] = useState<string>((cfg.reporting_model as string) ?? "consolidated");
  const [isMsme, setIsMsme] = useState<boolean>((cfg.is_msme as string) === "1");
  const [udyamNumber, setUdyamNumber] = useState<string>((cfg.udyam_number as string) ?? "");
  const [legalAddress, setLegalAddress] = useState<string>(parentEntity?.legal_address ?? "");
  const [website, setWebsite] = useState<string>((cfg.website as string) ?? "");
  const [currency, setCurrency] = useState(ctx.client.currency ?? "INR");
  const [reportingPeriod, setReportingPeriod] = useState<string>(ctx.client.reporting_period ?? "FY");
  const [primaryColor, setPrimaryColor] = useState(ctx.client.primary_color ?? "#1E6F5C");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await authFetch("client-settings.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, operating_name: operatingName,
          is_india: isIndia, gstin,
          industry, org_type: orgType, reporting_model: reportingModel,
          is_msme: isMsme, udyam_number: udyamNumber,
          legal_address: legalAddress, website,
          currency, reporting_period: reportingPeriod, primary_color: primaryColor,
        }),
      });
      toast.success("Company details saved — reloading…");
      clearClientContext();
      window.location.reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(ctx.client.name);
    setOperatingName((cfg.operating_name as string) ?? "");
    setIsIndia((cfg.country as string) === "India");
    setGstin(parentEntity?.tax_id ?? "");
    setIndustry((cfg.industry as string) ?? "");
    setOrgType(parentEntity?.org_type ?? "");
    setReportingModel((cfg.reporting_model as string) ?? "consolidated");
    setIsMsme((cfg.is_msme as string) === "1");
    setUdyamNumber((cfg.udyam_number as string) ?? "");
    setLegalAddress(parentEntity?.legal_address ?? "");
    setWebsite((cfg.website as string) ?? "");
    setCurrency(ctx.client.currency ?? "INR");
    setReportingPeriod(ctx.client.reporting_period ?? "FY");
    setPrimaryColor(ctx.client.primary_color ?? "#1E6F5C");
    setSaveError(null);
    setEditing(false);
  };

  const inputCls = "w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C]";
  const labelCls = "mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground";

  const InfoCard = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="rounded-lg bg-[#F9FAFB] px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm font-medium text-[var(--navy)]">{value || "—"}</div>
    </div>
  );

  const YNToggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[#F3F4F6] p-0.5 gap-0.5">
      {["Yes", "No"].map(opt => {
        const active = opt === "Yes" ? value : !value;
        return (
          <button key={opt} type="button" onClick={() => onChange(opt === "Yes")}
            className={`px-5 py-1.5 text-sm font-medium rounded-md transition-all ${
              active ? "bg-white shadow text-[#1E4D2B] font-bold border-t-2 border-[#1E6F5C]" : "text-muted-foreground"
            }`}>
            {opt}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="rounded-xl border border-[var(--border)] bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
      <div className="px-6 py-5">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={ctx.client.logo_url} alt={ctx.client.name}
              className="h-14 w-auto rounded-lg object-contain"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <div>
              <h2 className="text-xl font-bold text-[var(--navy)]">{ctx.client.name}</h2>
              <code className="text-xs text-muted-foreground">{ctx.client.slug}</code>
            </div>
          </div>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy)] hover:bg-[#F9FAFB]">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-5">
            {saveError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
            )}

            {/* India + GSTIN */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Registered in India?</label>
                <YNToggle value={isIndia} onChange={setIsIndia} />
              </div>
              <div>
                <label className={labelCls}>GSTIN{isIndia ? " *" : ""}</label>
                <input type="text" className={inputCls} value={gstin} disabled={!isIndia}
                  onChange={e => setGstin(e.target.value.toUpperCase())}
                  placeholder={isIndia ? "15-character GST Identification Number" : "Not applicable"}
                  maxLength={15} />
              </div>
            </div>

            {/* Legal + Operating name */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Legal / Organisation name *</label>
                <input type="text" className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Exact registered name" />
              </div>
              <div>
                <label className={labelCls}>Operating name (if different)</label>
                <input type="text" className={inputCls} value={operatingName} onChange={e => setOperatingName(e.target.value)} placeholder="Name as it appears in operations" />
              </div>
            </div>

            {/* Industry + Org type */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Industry *</label>
                <select className={inputCls} value={industry} onChange={e => setIndustry(e.target.value)}>
                  <option value="">Select an industry</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Organisational type *</label>
                <select className={inputCls} value={orgType} onChange={e => setOrgType(e.target.value)}>
                  <option value="">Select a type</option>
                  {ORG_TYPES_LEGAL.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Consolidation approach */}
            <div>
              <label className={labelCls}>Consolidation / reporting approach</label>
              <select className={inputCls} value={reportingModel} onChange={e => setReportingModel(e.target.value)}>
                <option value="consolidated">Operational Control (consolidated reporting)</option>
                <option value="equity_share">Equity Share</option>
                <option value="financial_control">Financial Control</option>
                <option value="separate">Separate entities (no consolidated roll-up)</option>
              </select>
            </div>

            {/* MSME — India only */}
            {isIndia && (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Registered as an MSME?</label>
                  <YNToggle value={isMsme} onChange={v => { setIsMsme(v); if (!v) setUdyamNumber(""); }} />
                </div>
                {isMsme && (
                  <div>
                    <label className={labelCls}>Udyam registration number</label>
                    <input type="text" className={inputCls} value={udyamNumber}
                      onChange={e => setUdyamNumber(e.target.value.toUpperCase())}
                      placeholder="UDYAM-XX-00-0000000" maxLength={25} />
                  </div>
                )}
              </div>
            )}

            {/* Legal address */}
            <div>
              <label className={labelCls}>Legal address</label>
              <textarea rows={3}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C] resize-y"
                value={legalAddress} onChange={e => setLegalAddress(e.target.value)}
                placeholder="Full registered head-office address" />
            </div>

            {/* Website + Currency */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Organisation website</label>
                <input type="url" className={inputCls} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://www.company.com" />
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <select className={inputCls} value={currency} onChange={e => setCurrency(e.target.value)}>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="SGD">SGD</option>
                  <option value="AED">AED</option>
                </select>
              </div>
            </div>

            {/* Reporting period + Primary colour */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Reporting period</label>
                <select className={inputCls} value={reportingPeriod} onChange={e => setReportingPeriod(e.target.value)}>
                  <option value="FY">Fiscal Year (Apr–Mar)</option>
                  <option value="CY">Calendar Year (Jan–Dec)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Primary colour</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-9 w-16 cursor-pointer rounded border border-[var(--border)] p-0.5" />
                  <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-28 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-mono text-[var(--navy)] outline-none focus:border-[#1E6F5C]" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button type="button" onClick={handleCancel}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--navy)] hover:bg-[#F9FAFB]">
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Organisation</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoCard label="Legal / Organisation name" value={ctx.client.name} />
                <InfoCard label="Slug" value={ctx.client.slug} />
                <InfoCard label="Operating name" value={(cfg.operating_name as string) || undefined} />
                <InfoCard label="Industry" value={(cfg.industry as string) || undefined} />
                <InfoCard label="Organisational type" value={parentEntity?.org_type || undefined} />
                <InfoCard label="Consolidation approach" value={CONSOLIDATION_LABELS[(cfg.reporting_model as string)] ?? (cfg.reporting_model as string) ?? undefined} />
              </div>
            </div>
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Registration</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoCard label="Registered in India" value={(cfg.country as string) === "India" ? "Yes" : "No"} />
                {(cfg.country as string) === "India" && <InfoCard label="GSTIN" value={parentEntity?.tax_id || undefined} />}
                <InfoCard label="MSME" value={(cfg.is_msme as string) === "1" ? "Yes" : "No"} />
                {(cfg.is_msme as string) === "1" && <InfoCard label="Udyam number" value={(cfg.udyam_number as string) || undefined} />}
                <InfoCard label="Legal address" value={parentEntity?.legal_address || undefined} />
                <InfoCard label="Website" value={(cfg.website as string) || undefined} />
              </div>
            </div>
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Account settings</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoCard label="Currency" value={ctx.client.currency} />
                <InfoCard label="Reporting period" value={ctx.client.reporting_period === "FY" ? "Fiscal Year (Apr–Mar)" : "Calendar Year (Jan–Dec)"} />
                <InfoCard label="Account status" value={ctx.client.is_active ? "Active" : "Pending activation"} />
                <InfoCard label="Primary colour" value={ctx.client.primary_color} />
              </div>
            </div>

            {reqData && (
              <>
                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">GHG Reporting History</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoCard label="Reported GHG before?" value={reqData.ghg_done_before === null ? undefined : (reqData.ghg_done_before ? "Yes" : "No")} />
                    <InfoCard label="Services needed" value={
                      reqData.services_needed
                        ? (() => {
                            try {
                              const arr: string[] = JSON.parse(reqData.services_needed);
                              return arr.join(", ");
                            } catch { return reqData.services_needed; }
                          })()
                        : undefined
                    } />
                    {reqData.ghg_requirement && <InfoCard label="Notes / requirement" value={reqData.ghg_requirement} />}
                    {reqData.services_other  && <InfoCard label="Other details" value={reqData.services_other} />}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Primary Contact</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {reqData.name        && <InfoCard label="Name"        value={reqData.name} />}
                    {reqData.designation && <InfoCard label="Designation" value={reqData.designation} />}
                    {reqData.phone       && <InfoCard label="Phone"       value={reqData.phone} />}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Facilities tab (ghg_facilities) ──────────────────────────────────────────

// FacilityForm MUST live outside FacilitiesTab — defining a component function
// inside another component causes React to unmount it on every keystroke.

const FAC_INPUT_CLS = "w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C]";
const FAC_LABEL_CLS = "mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground";

interface FacFormValues {
  name: string;
  entity: string;
  location: string;
  is_hq: boolean;
}

interface FacilityFormProps {
  f: FacFormValues;
  onChange: (patch: Partial<FacFormValues>) => void;
  entities?: Array<{ code: string; name: string }>;
}

function FacilityForm({ f, onChange, entities }: FacilityFormProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-3">
      {entities && entities.length > 1 && (
        <div className="sm:col-span-2">
          <label className={FAC_LABEL_CLS}>Entity *</label>
          <select className={FAC_INPUT_CLS} value={f.entity} onChange={e => onChange({ entity: e.target.value })}>
            {entities.map(ent => (
              <option key={ent.code} value={ent.code}>{ent.name} ({ent.code})</option>
            ))}
          </select>
        </div>
      )}
      <div className="sm:col-span-2">
        <label className={FAC_LABEL_CLS}>Facility name *</label>
        <input className={FAC_INPUT_CLS} value={f.name} onChange={e => onChange({ name: e.target.value })} placeholder="e.g. Hejjala Plant" />
      </div>
      <div className="sm:col-span-2">
        <label className={FAC_LABEL_CLS}>Location / address</label>
        <input className={FAC_INPUT_CLS} value={f.location} onChange={e => onChange({ location: e.target.value })} placeholder="Full street address, city, state" />
        <p className="mt-1 text-[11px] text-muted-foreground">
          State and grid utility aren't collected here — they're captured per electricity meter when you add a Scope 2 source for this facility.
        </p>
      </div>
      <div className="sm:col-span-2 flex items-center gap-2 pt-1">
        <input type="checkbox" id="fac-is-hq" checked={!!f.is_hq} onChange={e => onChange({ is_hq: e.target.checked })}
          className="h-4 w-4 rounded border-[var(--border)] accent-[#1E6F5C] cursor-pointer" />
        <label htmlFor="fac-is-hq" className="text-xs font-medium text-[var(--navy)] cursor-pointer select-none">
          This is the HQ / registered office for this entity
        </label>
      </div>
    </div>
  );
}

function FacilitiesTab({ ctx }: { ctx: ClientContext }) {
  const entityScope = (ctx.user as any)?.entity_scope as string | undefined;
  const nonConsolidated = ctx.entities.filter(e => !e.is_consolidated);

  // Entity-scoped users see only their entity; org-level users see all
  const { data: allFacilities = [], isLoading } = useFacilities(entityScope || undefined);
  const addMut    = useAddFacility();
  const updateMut = useUpdateFacility();
  const deleteMut = useDeleteFacility();

  const defaultEntityCode = entityScope || nonConsolidated[0]?.code || '';
  const blankForm: FacFormValues = { name: '', location: '', entity: defaultEntityCode, is_hq: false };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [form,      setForm]      = useState<FacFormValues>(blankForm);
  const [editForm,  setEditForm]  = useState<FacFormValues>(blankForm);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    await addMut.mutateAsync({ ...form, name: form.name.trim() } as any);
    setForm(blankForm); setShowAdd(false);
    toast.success('Facility added');
  };

  const handleUpdate = async (id: number) => {
    await updateMut.mutateAsync({ id, ...editForm } as any);
    setEditingId(null);
    toast.success('Facility updated');
  };

  const handleToggleStatus = async (id: number, current: string) => {
    const next = current === 'active' ? 'inactive' : 'active';
    await updateMut.mutateAsync({ id, status: next });
    toast.success(next === 'inactive' ? 'Marked inactive' : 'Reactivated');
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete facility "${name}"? This cannot be undone.`)) return;
    await deleteMut.mutateAsync(id);
    toast.success('Facility deleted');
  };

  // Build entity groups in the same order as ctx.entities
  const entitiesToShow = entityScope
    ? nonConsolidated.filter(e => e.code === entityScope)
    : nonConsolidated;

  const facilityGroups = entitiesToShow.map(ent => ({
    entity: { code: ent.code, name: ent.name },
    facilities: (allFacilities as any[]).filter(f => f.entity === ent.code),
  }));

  // Entity dropdown for add form (only when org-level user with multiple entities)
  const formEntities = entityScope ? undefined : nonConsolidated.map(e => ({ code: e.code, name: e.name }));

  const totalFacilities = (allFacilities as any[]).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--navy)]">GHG Facilities</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Physical sites used for Scope 1 &amp; 2 data entry</p>
        </div>
        {!showAdd && (
          <button type="button" onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
            <Plus className="h-4 w-4" /> Add facility
          </button>
        )}
      </div>

      {showAdd && (
        <div className="rounded-xl border border-[#C5E4D0] bg-[#F0FAF5] p-4">
          <p className="text-sm font-semibold text-[#1E6F5C] mb-1">New facility</p>
          <FacilityForm f={form} onChange={p => setForm(prev => ({ ...prev, ...p }))} entities={formEntities} />
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={handleAdd} disabled={addMut.isPending || !form.name.trim()}
              className="flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
              {addMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
            <button type="button" onClick={() => { setForm(blankForm); setShowAdd(false); }}
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--navy)] hover:bg-[#F9FAFB]">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : totalFacilities === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <List className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-[var(--navy)]">No facilities yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first site above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {facilityGroups.map(group => (
            <div key={group.entity.code} className="rounded-xl border border-[var(--border)] bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07)] overflow-hidden">
              {/* Entity header */}
              <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[#F9FAFB] px-4 py-3">
                <span className="text-sm font-semibold text-[var(--navy)]">{group.entity.name}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-[#E6F4EF] text-[#1E6F5C]">
                  {group.entity.code}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {group.facilities.length} {group.facilities.length === 1 ? 'site' : 'sites'}
                </span>
              </div>

              {group.facilities.length === 0 ? (
                <div className="px-5 py-4 text-xs text-muted-foreground italic">
                  No facilities added yet for this entity.
                </div>
              ) : (
                group.facilities.map((fac: any, idx: number) => (
                  <div key={fac.id} className={idx > 0 ? 'border-t border-[var(--border)]' : ''}>
                    {editingId === fac.id ? (
                      <div className="px-5 py-4">
                        <FacilityForm f={editForm} onChange={p => setEditForm(prev => ({ ...prev, ...p }))} />
                        <div className="flex gap-3 mt-4">
                          <button type="button" onClick={() => handleUpdate(fac.id)} disabled={updateMut.isPending}
                            className="flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
                            {updateMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
                          </button>
                          <button type="button" onClick={() => setEditingId(null)}
                            className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--navy)] hover:bg-[#F9FAFB]">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-4 px-5 py-4">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${(fac.status ?? 'active') === 'active' ? 'bg-[#E6F4EF]' : 'bg-[#F3F4F6]'}`}>
                          <span className={`text-xs font-bold ${(fac.status ?? 'active') === 'active' ? 'text-[#1E6F5C]' : 'text-[#9CA3AF]'}`}>
                            {fac.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-[var(--navy)]">{fac.name}</span>
                            {!!fac.is_hq && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">HQ</span>
                            )}
                            {(fac.status ?? 'active') === 'inactive' && (
                              <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">Inactive</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {[fac.location, fac.state, fac.grid_utility].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" title="Edit"
                            onClick={() => { setEditingId(fac.id); setEditForm({ name: fac.name, location: fac.location ?? '', entity: fac.entity ?? defaultEntityCode, is_hq: !!fac.is_hq }); }}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-[#F3F4F6] hover:text-[var(--navy)]">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" title={(fac.status ?? 'active') === 'active' ? 'Mark inactive' : 'Reactivate'}
                            onClick={() => handleToggleStatus(fac.id, fac.status ?? 'active')}
                            disabled={updateMut.isPending}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-[#F3F4F6] hover:text-amber-600">
                            <PauseCircle className="h-4 w-4" />
                          </button>
                          <button type="button" title="Delete"
                            onClick={() => handleDelete(fac.id, fac.name)}
                            disabled={deleteMut.isPending}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Entities (Facilities) tab ─────────────────────────────────────────────────

interface FacilityEdit {
  code: string;
  name: string;
  address: string;
  status: "active" | "stopped";
  isNew?: boolean;
}

function EntitiesTab({ ctx }: { ctx: ClientContext }) {
  const nonConsolidated = ctx.entities.filter(e => !e.is_consolidated);

  const [facilities, setFacilities] = useState<FacilityEdit[]>(
    nonConsolidated.map(e => ({
      code:    e.code,
      name:    e.name,
      address: e.legal_address ?? "",
      status:  (e as any).status === "stopped" ? "stopped" : "active",
    }))
  );
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);

  const patchFacility = (idx: number, patch: Partial<FacilityEdit>) =>
    setFacilities(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));

  const addFacility = () =>
    setFacilities(prev => [...prev, { code: `NEW${Date.now()}`, name: "", address: "", status: "active", isNew: true }]);

  const removeFacility = (idx: number) =>
    setFacilities(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      await authFetch("entities.php", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ facilities: facilities.map(f => ({ code: f.isNew ? undefined : f.code, name: f.name.trim(), legal_address: f.address, status: f.status })) }),
      });
      setEditing(false);
      toast.success("Facilities saved");
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--navy)]">Facilities</h3>
          <p className="text-xs text-muted-foreground">{facilities.length} {facilities.length === 1 ? "facility" : "facilities"} registered</p>
        </div>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy)] hover:bg-[#F9FAFB]">
            <Pencil className="h-3.5 w-3.5" /> Edit facilities
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => { setFacilities(nonConsolidated.map(e => ({ code: e.code, name: e.name, address: e.legal_address ?? "", status: "active" as const }))); setEditing(false); setSaveErr(null); }}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy)] hover:bg-[#F9FAFB]">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </button>
          </div>
        )}
      </div>

      {saveErr && (
        <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveErr}</div>
      )}

      <div className="divide-y divide-[var(--border)]">
        {facilities.map((f, idx) => (
          <div key={f.code} className="px-5 py-4">
            {editing ? (
              <div className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Facility name</label>
                    <input type="text" value={f.name} onChange={e => patchFacility(idx, { name: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C]"
                      placeholder="e.g. Head Office" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Address</label>
                    <input type="text" value={f.address} onChange={e => patchFacility(idx, { address: e.target.value })}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C]"
                      placeholder="Full address" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</label>
                    <select value={f.status} onChange={e => patchFacility(idx, { status: e.target.value as "active" | "stopped" })}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C]">
                      <option value="active">Active</option>
                      <option value="stopped">Stopped</option>
                    </select>
                  </div>
                </div>
                {facilities.length > 1 && (
                  <button type="button" onClick={() => removeFacility(idx)}
                    className="mt-6 flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs font-semibold text-red-600 hover:bg-red-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E6F4EF]">
                  <span className="text-xs font-bold text-[#1E6F5C]">{f.code.slice(0, 2)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--navy)]">{f.name}</span>
                    {f.status === "stopped" && (
                      <span className="flex items-center gap-1 rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                        <PauseCircle className="h-3 w-3" /> Stopped
                      </span>
                    )}
                  </div>
                  {f.address && <div className="mt-0.5 text-xs text-muted-foreground">{f.address}</div>}
                  <div className="text-xs text-muted-foreground">{f.code}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="border-t border-[var(--border)] px-5 py-4">
          <button type="button" onClick={addFacility}
            className="flex items-center gap-2 text-sm font-semibold text-[#1E6F5C] hover:underline">
            <Plus className="h-4 w-4" /> Add facility
          </button>
        </div>
      )}
    </div>
  );
}

// ── Team tab ──────────────────────────────────────────────────────────────────

function TeamTab({ role }: { role: string | null }) {
  const canManage = role === "sustainability_team";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-card px-6 py-6 shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--navy)]">Team management</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage
              ? "Add, remove, and manage access roles for your team members."
              : "Contact your Admin to manage team access."}
          </p>
        </div>
        {canManage && (
          <Link
            to="/team"
            className="flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            <Users className="h-4 w-4" />
            Manage team
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Billing tab ───────────────────────────────────────────────────────────────

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: "Pending payment",  color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
  paid:    { label: "Payment confirmed", color: "#065F46", bg: "#F0FAF5", border: "#C5E4D0" },
  waived:  { label: "Waived",           color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
};

function BillingTab({ ctx, role }: { ctx: ClientContext; role: string | null }) {
  const paymentStatus = ctx.client.payment_status ?? "pending";
  const paymentRequested =
    ctx.config.payment_requested === "true" || ctx.config.payment_requested === true;
  const [requested, setRequested] = useState(paymentRequested);

  const requestPayment = useMutation({
    mutationFn: () => authFetch("request-payment.php", { method: "POST" }),
    onSuccess: () => {
      setRequested(true);
      toast.success("Payment request sent to Deepwoods");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMeta = PAYMENT_STATUS_LABELS[paymentStatus] ?? PAYMENT_STATUS_LABELS.pending;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-card px-6 py-6 shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
      <h3 className="mb-4 text-base font-semibold text-[var(--navy)]">Billing & payment</h3>

      {/* Payment status badge */}
      <div
        className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
        style={{ color: statusMeta.color, background: statusMeta.bg, border: `1px solid ${statusMeta.border}` }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: statusMeta.color }}
        />
        {statusMeta.label}
      </div>

      {paymentStatus === "paid" || paymentStatus === "waived" ? (
        <div className="rounded-xl border border-[#C5E4D0] bg-[#F0FAF5] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E6F5C]">
              <Check className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1E6F5C]">
                {paymentStatus === "waived" ? "Access waived by Deepwoods" : "Full portal access enabled"}
              </p>
              <p className="text-xs text-[#2D8C72]">
                Your account has full access to all portal features.
              </p>
            </div>
          </div>
        </div>
      ) : requested ? (
        <div className="rounded-xl border border-[#C5E4D0] bg-[#F0FAF5] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E6F5C]">
              <Check className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1E6F5C]">Invoice requested</p>
              <p className="text-xs text-[#2D8C72]">
                Your Deepwoods consultant has been notified and will send your invoice shortly.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[#F9FAFB] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--navy)]">Ready to proceed?</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Once you've completed your organisational boundary setup, request an invoice.
                Your Deepwoods consultant will follow up with payment details.
              </p>
            </div>
            {role === "sustainability_team" && (
              <button
                type="button"
                onClick={() => requestPayment.mutate()}
                disabled={requestPayment.isPending}
                className="shrink-0 flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {requestPayment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {requestPayment.isPending ? "Sending…" : "Request invoice"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg bg-[#F3F4F6] px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="text-[var(--navy)]">Need help?</strong>{" "}
          Contact your Deepwoods account manager for billing queries or payment arrangements.
        </p>
      </div>
    </div>
  );
}

// ── User profile tab ──────────────────────────────────────────────────────────

function UserProfileTab({ role }: { role: string | null }) {
  const email = getEmail() ?? "—";
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwDone, setPwDone] = useState(false);

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr(null);
    if (next.length < 8) { setPwErr("New password must be at least 8 characters"); return; }
    if (next !== confirm) { setPwErr("Passwords don't match"); return; }
    setPwLoading(true);
    try {
      await changePassword(current, next);
      setPwDone(true);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile info */}
      <div className="rounded-xl border border-[var(--border)] bg-card px-6 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
        <h3 className="mb-4 text-base font-semibold text-[var(--navy)]">Account information</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-[#F9FAFB] px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Email</div>
            <div className="text-sm font-medium text-[var(--navy)]">{email}</div>
          </div>
          <div className="rounded-lg bg-[#F9FAFB] px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Role</div>
            <div className="text-sm font-medium text-[var(--navy)]">{role ?? "—"}</div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-[var(--border)] bg-card px-6 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
        <h3 className="mb-4 text-base font-semibold text-[var(--navy)]">Change password</h3>
        {pwDone ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#C5E4D0] bg-[#F0FAF5] px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E6F5C]">
              <Check className="h-5 w-5 text-white" />
            </div>
            <p className="text-sm font-semibold text-[#1E6F5C]">Password updated successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleChangePw} className="space-y-4 max-w-sm">
            {pwErr && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pwErr}</div>
            )}
            {[
              { label: "Current password", val: current, set: setCurrent },
              { label: "New password (min 8 chars)", val: next, set: setNext },
              { label: "Confirm new password", val: confirm, set: setConfirm },
            ].map(f => (
              <div key={f.label}>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{f.label}</label>
                <input
                  type="password"
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--navy)] outline-none focus:border-[#1E6F5C]"
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={pwLoading}
              className="flex items-center gap-2 rounded-lg bg-[#1E6F5C] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {pwLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {pwLoading ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
