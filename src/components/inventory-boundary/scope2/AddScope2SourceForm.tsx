import React, { useState } from 'react';
import { X, Upload, Check } from 'lucide-react';
import type {
  Scope2Source,
  Scope2Category,
  Status,
  ProcurementInstrument,
  RESourceType,
  RELocation,
  REConnectionType,
  REOwnership,
  REMetering,
  ProcurementRoute,
  AgreementType,
  FiscalYear,
} from '@/lib/inventory-types';
import { useInventory } from '@/context/InventoryContext';
import { useClientContext } from '@/lib/client-context';
import { generateAllYears } from '@/lib/entity';

// Country → State → utility/DISCOM lookup, so "Utility / Supplier" is a guided
// cascade instead of free text (which is how facility names ended up
// misspelled/inconsistent across imports before). A state/country with no
// specific mapping falls back to "Other", which reveals a free-text field.
// India state names keep the "(State)" suffix to match gridRegion values already
// saved in production (e.g. FP/FOS's "Karnataka (State)") — new countries don't
// have that legacy format to match, so they're plain names.
const COUNTRY_STATES: Record<string, string[]> = {
  'India': ['Karnataka (State)', 'Tamil Nadu (State)', 'Maharashtra (State)', 'Gujarat (State)', 'Telangana (State)', 'Andhra Pradesh (State)'],
  'United States': ['New Jersey', 'Maryland', 'Pennsylvania', 'California', 'Texas', 'New York'],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
};
const OTHER_COUNTRY = 'Other';

const STATE_UTILITIES: Record<string, string[]> = {
  // India — state DISCOMs
  'Karnataka (State)': ['BESCOM', 'HESCOM', 'MESCOM', 'CESC (Chamundeshwari)', 'GESCOM'],
  'Tamil Nadu (State)': ['TANGEDCO'],
  'Maharashtra (State)': ['MSEDCL', 'Tata Power', 'Adani Electricity', 'BEST'],
  'Gujarat (State)': ['UGVCL', 'PGVCL', 'DGVCL', 'MGVCL', 'Torrent Power'],
  'Telangana (State)': ['TSSPDCL', 'TSNPDCL'],
  'Andhra Pradesh (State)': ['APSPDCL', 'APEPDCL', 'APCPDCL'],
  // United States — major utilities by state
  'New Jersey': ['PSE&G', 'JCP&L (FirstEnergy)', 'Atlantic City Electric'],
  'Maryland': ['BGE (Exelon)', 'Pepco', 'Delmarva Power'],
  'Pennsylvania': ['PECO (Exelon)', 'PPL Electric', 'Duquesne Light', 'Met-Ed (FirstEnergy)'],
  'California': ['PG&E', 'Southern California Edison', 'SDG&E'],
  'Texas': ['Oncor', 'CenterPoint Energy', 'AEP Texas'],
  'New York': ['Con Edison', 'National Grid', 'NYSEG'],
  // United Kingdom — national retail suppliers (region isn't exclusive like India's DISCOMs)
  'England': ['British Gas', 'EDF Energy', 'E.ON Next', 'Octopus Energy', 'Scottish Power', 'SSE', 'Ovo Energy'],
  'Scotland': ['British Gas', 'EDF Energy', 'E.ON Next', 'Octopus Energy', 'Scottish Power', 'SSE', 'Ovo Energy'],
  'Wales': ['British Gas', 'EDF Energy', 'E.ON Next', 'Octopus Energy', 'Scottish Power', 'SSE', 'Ovo Energy'],
  'Northern Ireland': ['Power NI', 'SSE Airtricity', 'Budget Energy'],
};
const OTHER_UTILITY = 'Other';

// Reverse-lookup so editing an existing source can preselect its country/state
// from a previously-saved gridRegion value (stored as just the state name).
const STATE_TO_COUNTRY: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_STATES).flatMap(([country, states]) => states.map(s => [s, country]))
);

interface AddScope2SourceFormProps {
  category: Scope2Category;
  initialSource?: Scope2Source | null;
  onClose: () => void;
}

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600 };
const reqStyle: React.CSSProperties = { color: 'var(--coral)' };
const optStyle: React.CSSProperties = { color: 'var(--slate)', fontWeight: 400, fontSize: 12 };
const hintStyle: React.CSSProperties = { fontSize: 11, color: 'var(--slate)', marginTop: 3 };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 };

const SectionHead = ({ color, bg, border, children }: { color: string; bg: string; border: string; children: React.ReactNode }) => (
  <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '6px 6px 0 0', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color }}>
    {children}
  </div>
);

const SectionBody = ({ border, bg, children }: { border: string; bg?: string; children: React.ReactNode }) => (
  <div style={{ border: `1px solid ${border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', background: bg ?? 'var(--white)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
    {children}
  </div>
);

const SubHead = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.4px', paddingBottom: 8, borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
    {children}
  </div>
);

export const AddScope2SourceForm: React.FC<AddScope2SourceFormProps> = ({
  category,
  initialSource,
  onClose,
}) => {
  const { facilities, fiscalYear, scope2Sources, addScope2Source, updateScope2Source } = useInventory();
  const ctx = useClientContext();
  // Independent of any server-side config (works for a brand-new client with no
  // ghg_inventory/reporting_years rows yet) — same generator that already
  // powers the main Fiscal Year switcher: 2015 through present, FY or CY.
  const vintageYearOptions = [...generateAllYears(ctx.client.reporting_period)].reverse();
  const rp = initialSource?.renewableProcurement;

  // ── Section A — LB ───────────────────────────────────────────────────────────
  const [name, setName] = useState(initialSource?.name || '');
  const [facilityId, setFacilityId] = useState(initialSource?.facilityId || (facilities[0]?.id ?? ''));
  const [gridConnectionType, setGridConnectionType] = useState<'HT' | 'LT' | 'EHT' | 'captive'>(initialSource?.gridConnectionType || 'HT');
  // gridRegion holds the selected STATE name (unchanged storage shape — just a
  // string) so nothing downstream that already reads it needs to change.
  const [gridRegion, setGridRegion] = useState(initialSource?.gridRegion || '');
  const [country, setCountry] = useState(
    initialSource?.gridRegion ? (STATE_TO_COUNTRY[initialSource.gridRegion] || OTHER_COUNTRY) : ''
  );
  const [consumerNumber, setConsumerNumber] = useState(initialSource?.consumerNumber || '');

  const stateOptions = COUNTRY_STATES[country] ?? [];

  // Utility / Supplier — a state-driven pick rather than free text, for electricity
  // sources only (steam/heating/cooling suppliers stay free text via supplierOther
  // directly). Falls back to "Other" (+ free text) if the existing value doesn't
  // match a known utility for the selected state, or the state has no mapping.
  const utilityOptions = STATE_UTILITIES[gridRegion] ?? [];
  const initialSupplierKnown = !!initialSource?.supplier && utilityOptions.includes(initialSource.supplier);
  const [supplierChoice, setSupplierChoice] = useState(
    category === 'electricity' && initialSource?.supplier ? (initialSupplierKnown ? initialSource.supplier : OTHER_UTILITY) : ''
  );
  const [supplierOther, setSupplierOther] = useState(
    category !== 'electricity' ? (initialSource?.supplier || '') : (initialSource?.supplier && !initialSupplierKnown ? initialSource.supplier : '')
  );
  const supplier = category === 'electricity'
    ? (supplierChoice === OTHER_UTILITY ? supplierOther.trim() : supplierChoice)
    : supplierOther.trim();

  // ── Section B gate ───────────────────────────────────────────────────────────
  const [hasRE, setHasRE] = useState<boolean>(rp?.hasInstrument ?? false);

  // B1 — Source & location
  const [reSourceType, setRESourceType] = useState<RESourceType>(rp?.reSourceType || 'solar');
  const [reLocation, setRELocation] = useState<RELocation>(rp?.reLocation || 'onsite');
  const [connectionType, setConnectionType] = useState<REConnectionType>(rp?.connectionType || 'throughGrid');
  const [linkedGridConnectionName, setLinkedGridConnectionName] = useState(rp?.linkedGridConnectionName || '');

  // B2 — Ownership & procurement
  const [reOwnership, setREOwnership] = useState<REOwnership>(rp?.reOwnership || 'companyOwned');
  const [metering, setMetering] = useState<REMetering>(rp?.metering || 'net');
  const [procurementRoute, setProcurementRoute] = useState<ProcurementRoute>(rp?.procurementRoute || 'selfGeneration');
  const [agreementType, setAgreementType] = useState<AgreementType>(rp?.agreementType || 'noAgreement');

  // B3 — Instrument
  const [instrumentType, setInstrumentType] = useState<ProcurementInstrument>(rp?.instrumentType || 'none');
  const [coverage, setCoverage] = useState<'full' | 'partial'>(rp?.coverage || 'full');
  const [coveragePercent, setCoveragePercent] = useState(rp?.coveragePercent !== undefined ? String(rp.coveragePercent) : '50');
  const [issuingBody, setIssuingBody] = useState(rp?.issuingBody || '');
  const [vintageYear, setVintageYear] = useState<FiscalYear>(rp?.vintageYear || fiscalYear);
  const [contractReference, setContractReference] = useState(rp?.contractReference || '');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  // ── Non-electricity fields ───────────────────────────────────────────────────
  const [contractType, setContractType] = useState(initialSource?.contractType || '');
  const [isLowCarbon, setIsLowCarbon] = useState<boolean>(initialSource?.isLowCarbon ?? false);
  const [sourceDescription, setSourceDescription] = useState(initialSource?.sourceDescription || '');
  const [status, setStatus] = useState<Status>(initialSource?.status || 'active');

  // Other LB connections from same facility (for linked grid connection dropdown)
  const otherLBConnections = scope2Sources.filter(
    s => s.category === 'electricity' && s.facilityId === facilityId && s.id !== initialSource?.id
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const base = {
      fiscalYear: (initialSource?.fiscalYear || fiscalYear) as FiscalYear,
      scope: 'scope2' as const,
      category,
      name: name.trim(),
      facilityId,
      supplier: supplier.trim(),
      status,
    };

    let extra: Partial<Scope2Source> = {};

    if (category === 'electricity') {
      extra = {
        gridConnectionType,
        gridRegion: gridRegion || undefined,
        consumerNumber: consumerNumber || undefined,
        renewableProcurement: {
          hasInstrument: hasRE,
          ...(hasRE ? {
            reSourceType,
            reLocation,
            connectionType,
            linkedGridConnectionName: connectionType === 'throughGrid' ? (linkedGridConnectionName || undefined) : undefined,
            reOwnership,
            metering,
            procurementRoute,
            agreementType,
            instrumentType: instrumentType !== 'none' ? instrumentType : undefined,
            coverage: instrumentType !== 'none' ? coverage : undefined,
            coveragePercent: instrumentType !== 'none' && coverage === 'partial' ? Number(coveragePercent) : undefined,
            issuingBody: issuingBody || undefined,
            vintageYear: vintageYear || undefined,
            contractReference: contractReference || undefined,
          } : {}),
        },
      };
    } else {
      extra = {
        contractType: contractType || undefined,
        isLowCarbon,
        sourceDescription: isLowCarbon ? sourceDescription || undefined : undefined,
      };
    }

    if (initialSource) {
      updateScope2Source(initialSource.id, { ...base, ...extra });
    } else {
      addScope2Source({ ...base, ...extra });
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              {initialSource ? 'Edit' : 'Add'} Scope 2 Source ·{' '}
              <span style={{ color: 'var(--harbor)', textTransform: 'capitalize' }}>Purchased {category}</span>
            </h2>
            {category === 'electricity' && (
              <p style={{ fontSize: 12, color: 'var(--slate)', margin: '4px 0 0' }}>
                Section A captures every physical meter (location-based). Section B captures renewable procurement claims (market-based) — answer independently.
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: 'calc(90vh - 130px)', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {category === 'electricity' ? (
            <>
              {/* ── SECTION A — LOCATION-BASED ─────────────────────────────── */}
              <div>
                <SectionHead color="#3B6E86" bg="#EEF2F3" border="#C8D9E0">
                  ⚡ Section A — Grid Connection Details (Location-Based)
                </SectionHead>
                <SectionBody border="#C8D9E0">
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--slate)' }}>
                    One entry per electricity bill / meter. Answers "how many bill meters does this facility have?" Always required — this is your location-based baseline.
                  </p>

                  <div style={fieldStyle}>
                    <label style={labelStyle}>Source Name <span style={reqStyle}>*</span></label>
                    <input className="input-field" placeholder="e.g. BESCOM — Main Meter" value={name} onChange={e => setName(e.target.value)} required />
                  </div>

                  <div style={grid2}>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Country <span style={optStyle}>(for utility lookup)</span></label>
                      <select
                        className="input-field" value={country}
                        onChange={e => { setCountry(e.target.value); setGridRegion(''); setSupplierChoice(''); setSupplierOther(''); }}
                      >
                        <option value="">— Select —</option>
                        {Object.keys(COUNTRY_STATES).map(c => <option key={c} value={c}>{c}</option>)}
                        <option value={OTHER_COUNTRY}>Other</option>
                      </select>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>State</label>
                      <select
                        className="input-field" value={gridRegion} disabled={!country || country === OTHER_COUNTRY}
                        onChange={e => { setGridRegion(e.target.value); setSupplierChoice(''); setSupplierOther(''); }}
                      >
                        <option value="">{country && country !== OTHER_COUNTRY ? '— Select —' : 'Select a country first'}</option>
                        {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={grid2}>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Utility / Supplier <span style={reqStyle}>*</span></label>
                      <select
                        className="input-field"
                        value={supplierChoice}
                        onChange={e => { setSupplierChoice(e.target.value); if (e.target.value !== OTHER_UTILITY) setSupplierOther(''); }}
                        required
                      >
                        <option value="" disabled>{gridRegion ? '— Select utility —' : 'Select a country + state first, or choose Other'}</option>
                        {utilityOptions.map(u => <option key={u} value={u}>{u}</option>)}
                        <option value={OTHER_UTILITY}>Other (enter manually)</option>
                      </select>
                      {supplierChoice === OTHER_UTILITY && (
                        <input
                          className="input-field" style={{ marginTop: 6 }}
                          placeholder="Enter utility/supplier name"
                          value={supplierOther} onChange={e => setSupplierOther(e.target.value)} required
                        />
                      )}
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Facility <span style={reqStyle}>*</span></label>
                      <select className="input-field" value={facilityId} onChange={e => setFacilityId(e.target.value)}>
                        {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={grid2}>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Grid Connection Type</label>
                      <select className="input-field" value={gridConnectionType} onChange={e => setGridConnectionType(e.target.value as 'HT' | 'LT' | 'EHT' | 'captive')}>
                        <option value="HT">HT (High Tension)</option>
                        <option value="LT">LT (Low Tension)</option>
                        <option value="EHT">EHT (Extra High Tension)</option>
                        <option value="captive">Captive</option>
                      </select>
                    </div>
                    <div style={fieldStyle}>
                      <label style={labelStyle}>Consumer / Connection Number <span style={optStyle}>(Optional)</span></label>
                      <input className="input-field" placeholder="e.g. BE-12987465" value={consumerNumber} onChange={e => setConsumerNumber(e.target.value)} />
                    </div>
                  </div>
                </SectionBody>
              </div>

              {/* ── SECTION B — MARKET-BASED ────────────────────────────────── */}
              <div>
                <SectionHead color="var(--canopy)" bg="var(--mint)" border="#B8DBC4">
                  ☀ Section B — MB: Renewable Energy Procurement
                </SectionHead>
                <SectionBody border="#B8DBC4" bg="#FAFFFE">
                  {/* Gate question */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <label style={{ fontSize: 14, fontWeight: 500 }}>
                      Does this facility procure or generate any renewable energy? <span style={reqStyle}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {(['Yes', 'No'] as const).map(opt => (
                        <label key={opt} style={{
                          border: `1px solid ${(opt === 'Yes') === hasRE ? 'var(--meadow)' : 'var(--border)'}`,
                          background: (opt === 'Yes') === hasRE ? 'var(--mint)' : 'var(--white)',
                          borderRadius: 20, padding: '6px 18px', fontSize: 13, cursor: 'pointer',
                          display: 'flex', gap: 6, alignItems: 'center',
                          color: (opt === 'Yes') === hasRE ? 'var(--canopy)' : 'var(--ink)',
                          fontWeight: (opt === 'Yes') === hasRE ? 600 : 400,
                        }}>
                          <input type="radio" name="hasRE" checked={(opt === 'Yes') === hasRE} onChange={() => setHasRE(opt === 'Yes')} style={{ display: 'none' }} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: '#F0FAF5', border: '1px solid #B8DBC4', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--canopy)' }}>
                    Answer <strong>No</strong> only if this facility has no self-generation, no PPA/VPPA, no green tariff, and holds no RECs/GOs/I-RECs. We'll still report location-based emissions — you just won't have a market-based claim.
                  </div>

                  {hasRE && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 4 }}>

                      {/* B1 — Source & location */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <SubHead color="var(--harbor)">1 — Source &amp; Location</SubHead>
                        <div style={grid3}>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>RE Source Type <span style={reqStyle}>*</span></label>
                            <select className="input-field" value={reSourceType} onChange={e => setRESourceType(e.target.value as RESourceType)}>
                              <option value="solar">Solar</option>
                              <option value="wind">Wind</option>
                              <option value="hydro">Hydropower</option>
                              <option value="biomass">Biomass</option>
                              <option value="geothermal">Geothermal</option>
                              <option value="other">Other / Not specified</option>
                            </select>
                          </div>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>Location <span style={reqStyle}>*</span></label>
                            <select className="input-field" value={reLocation} onChange={e => setRELocation(e.target.value as RELocation)}>
                              <option value="onsite">Onsite</option>
                              <option value="offsite">Offsite</option>
                            </select>
                          </div>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>Connection Type <span style={reqStyle}>*</span></label>
                            <select className="input-field" value={connectionType} onChange={e => setConnectionType(e.target.value as REConnectionType)}>
                              <option value="throughGrid">Through Grid Connection</option>
                              <option value="direct">Direct (without Grid)</option>
                              <option value="notApplicable">Not Applicable</option>
                            </select>
                          </div>
                        </div>

                        {connectionType === 'throughGrid' && (
                          <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 14 }}>
                            <div style={fieldStyle}>
                              <label style={labelStyle}>Linked grid connection <span style={optStyle}>(if "Through Grid Connection")</span></label>
                              {otherLBConnections.length > 0 ? (
                                <select className="input-field" value={linkedGridConnectionName} onChange={e => setLinkedGridConnectionName(e.target.value)}>
                                  <option value="">Not linked to a specific meter</option>
                                  {otherLBConnections.map(s => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                  ))}
                                </select>
                              ) : (
                                <input className="input-field" placeholder="Enter meter / connection name" value={linkedGridConnectionName} onChange={e => setLinkedGridConnectionName(e.target.value)} />
                              )}
                              <span style={hintStyle}>So generation/export can be netted against the right meter above.</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* B2 — Ownership & procurement route */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <SubHead color="var(--harbor)">2 — Ownership &amp; Procurement Route</SubHead>
                        <div style={grid2}>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>RE Ownership <span style={reqStyle}>*</span></label>
                            <select className="input-field" value={reOwnership} onChange={e => setREOwnership(e.target.value as REOwnership)}>
                              <option value="companyOwned">Company-owned</option>
                              <option value="landlordOwned">Landlord-owned</option>
                            </select>
                            <span style={hintStyle}>If landlord-owned, RECs typically stay with the landlord unless contractually transferred.</span>
                          </div>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>Metering <span style={reqStyle}>*</span></label>
                            <select className="input-field" value={metering} onChange={e => setMetering(e.target.value as REMetering)}>
                              <option value="net">Net metering</option>
                              <option value="gross">Gross metering</option>
                            </select>
                          </div>
                        </div>
                        <div style={grid2}>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>Procurement Type <span style={reqStyle}>*</span></label>
                            <select className="input-field" value={procurementRoute} onChange={e => setProcurementRoute(e.target.value as ProcurementRoute)}>
                              <option value="selfGeneration">Self-generation</option>
                              <option value="physicalPPA">Physical Power Purchase Agreement (PPA)</option>
                              <option value="vppa">Financial / Virtual PPA (VPPA)</option>
                              <option value="projectSpecific">Project-specific supply contract</option>
                              <option value="retailSupply">Retail supply contract</option>
                            </select>
                          </div>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>Agreement Type <span style={optStyle}>(Optional)</span></label>
                            <select className="input-field" value={agreementType} onChange={e => setAgreementType(e.target.value as AgreementType)}>
                              <option value="noAgreement">No Agreement</option>
                              <option value="thirdPartyPPA">PPA — 3rd Party</option>
                              <option value="greenTariff">Green Tariff</option>
                              <option value="supplierPPA">Supplier PPA</option>
                              <option value="intrastateOpenAccess">Intrastate Open Access (Wheeling &amp; Banking)</option>
                              <option value="interstateOpenAccess">Interstate Open Access (GEOA)</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* B3 — Contractual instrument */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <SubHead color="var(--harbor)">3 — Contractual Instrument / Certificate</SubHead>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--slate)' }}>
                          Required to make a market-based claim per Scope 2 Guidance quality criteria — must be specific to the market where consumption occurs and no older than the reporting period + prior 2 years.
                        </p>
                        <div style={grid2}>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>Instrument Type</label>
                            <select className="input-field" value={instrumentType} onChange={e => setInstrumentType(e.target.value as ProcurementInstrument)}>
                              <option value="none">None held</option>
                              <option value="iRec">I-REC (International REC)</option>
                              <option value="indianRec">Indian REC (National)</option>
                              <option value="greenTariff">Green Tariff (from DISCOM)</option>
                              <option value="physicalPPA">PPA-embedded certificate</option>
                              <option value="vppa">Guarantee of Origin (GO)</option>
                              <option value="openAccessSolar">Open Access — Solar</option>
                              <option value="openAccessWind">Open Access — Wind</option>
                              <option value="otherBundled">Other bundled certificate</option>
                            </select>
                          </div>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>Coverage of Connection</label>
                            <select className="input-field" value={coverage} onChange={e => setCoverage(e.target.value as 'full' | 'partial')} disabled={instrumentType === 'none'}>
                              <option value="full">Full (100%)</option>
                              <option value="partial">Partial — specify %</option>
                            </select>
                          </div>
                        </div>

                        {coverage === 'partial' && instrumentType !== 'none' && (
                          <div style={{ ...fieldStyle, maxWidth: 200 }}>
                            <label style={labelStyle}>Coverage %</label>
                            <input type="number" min={1} max={99} className="input-field" value={coveragePercent} onChange={e => setCoveragePercent(e.target.value)} />
                          </div>
                        )}

                        <div style={grid2}>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>Issuing Body / Registry</label>
                            <input className="input-field" placeholder="e.g. I-REC Standard, POSOCO" value={issuingBody} onChange={e => setIssuingBody(e.target.value)} />
                          </div>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>Vintage Year</label>
                            <select className="input-field" value={vintageYear} onChange={e => setVintageYear(e.target.value as FiscalYear)}>
                              {vintageYearOptions.map(y => (
                                <option key={y} value={y}>{y}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div style={grid2}>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>Contract / Instrument Reference <span style={optStyle}>(Optional)</span></label>
                            <input className="input-field" placeholder="e.g. GT-BESCOM-123" value={contractReference} onChange={e => setContractReference(e.target.value)} />
                          </div>
                          <div style={fieldStyle}>
                            <label style={labelStyle}>Attach Evidence <span style={optStyle}>(Optional)</span></label>
                            <label className="btn-ghost" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: 13, width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Upload size={14} /> Choose File
                              <input type="file" accept=".pdf,.png,.jpg" onChange={e => { if (e.target.files?.[0]) setAttachedFileName(e.target.files[0].name); }} style={{ display: 'none' }} />
                            </label>
                            {attachedFileName ? (
                              <span style={{ fontSize: 12, color: 'var(--meadow)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Check size={13} /> {attachedFileName}
                              </span>
                            ) : (
                              <span style={hintStyle}>PPA certificate, DISCOM invoice, or REC redemption proof</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </SectionBody>
              </div>
            </>
          ) : (
            /* Non-electricity sources */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Source Name <span style={reqStyle}>*</span></label>
                <input className="input-field" placeholder={`e.g. District ${category} — Facility Line`} value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div style={grid2}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Facility <span style={reqStyle}>*</span></label>
                  <select className="input-field" value={facilityId} onChange={e => setFacilityId(e.target.value)}>
                    {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Supplier / Provider <span style={reqStyle}>*</span></label>
                  <input className="input-field" placeholder="e.g. District Energy Provider" value={supplierOther} onChange={e => setSupplierOther(e.target.value)} required />
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Contract / Supply Type</label>
                <input className="input-field" placeholder="e.g. Standard supply, Long-term contract, Cogeneration" value={contractType} onChange={e => setContractType(e.target.value)} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Is this a renewable / low-carbon source?</label>
                <div style={{ display: 'flex', gap: 16 }}>
                  {(['Yes', 'No'] as const).map(opt => (
                    <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="radio" checked={(opt === 'Yes') === isLowCarbon} onChange={() => setIsLowCarbon(opt === 'Yes')} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              {isLowCarbon && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Source Description (Low-carbon)</label>
                  <input className="input-field" placeholder="e.g. Biomass cogeneration, Waste heat recovery" value={sourceDescription} onChange={e => setSourceDescription(e.target.value)} />
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Status</label>
            <select className="input-field" value={status} onChange={e => setStatus(e.target.value as Status)}>
              <option value="active">Active</option>
              <option value="monitor">Monitor</option>
              <option value="flagForReplacement">Flag for Replacement</option>
              <option value="efficient">Efficient</option>
            </select>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--harbor)', borderColor: 'var(--harbor)' }}>
              {initialSource ? 'Save Changes' : 'Add Source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
