import { useState } from 'react';
import { MoreHorizontal, Edit2, Trash2, ChevronUp } from 'lucide-react';
import type { Scope2Source } from '@/lib/inventory-types';
import { StatusStamp } from '@/components/inventory-boundary/shared/StatusStamp';
import { FlagChip } from '@/components/inventory-boundary/shared/FlagChip';

interface Scope2SourceRowProps {
  source: Scope2Source;
  onEdit: (source: Scope2Source) => void;
  onDelete: (id: string) => void;
}

const INSTRUMENT_LABELS: Record<string, string> = {
  iRec: 'I-REC (International REC)',
  indianRec: 'Indian REC (National)',
  greenTariff: 'Green Tariff',
  physicalPPA: 'PPA-embedded certificate',
  vppa: 'Guarantee of Origin (GO)',
  openAccessSolar: 'Open Access — Solar',
  openAccessWind: 'Open Access — Wind',
  otherBundled: 'Other bundled certificate',
  none: 'None held',
};

const RE_SOURCE_LABELS: Record<string, string> = {
  solar: 'Solar',
  wind: 'Wind',
  hydro: 'Hydropower',
  biomass: 'Biomass',
  geothermal: 'Geothermal',
  other: 'Other / Not specified',
};

const CONNECTION_LABELS: Record<string, string> = {
  throughGrid: 'Through Grid Connection',
  direct: 'Direct (without Grid)',
  notApplicable: 'Not Applicable',
};

const PROCUREMENT_LABELS: Record<string, string> = {
  selfGeneration: 'Self-generation',
  physicalPPA: 'Physical PPA',
  vppa: 'Virtual PPA (VPPA)',
  projectSpecific: 'Project-specific contract',
  retailSupply: 'Retail supply contract',
};

const AGREEMENT_LABELS: Record<string, string> = {
  noAgreement: 'No Agreement',
  thirdPartyPPA: 'PPA — 3rd Party',
  greenTariff: 'Green Tariff',
  supplierPPA: 'Supplier PPA',
  intrastateOpenAccess: 'Intrastate Open Access',
  interstateOpenAccess: 'Interstate Open Access (GEOA)',
  other: 'Other',
};

const microLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.4px',
  marginBottom: 2,
  color: 'var(--slate)',
};

const DetailGrid = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px 16px', fontSize: 13 }}>
    {children}
  </div>
);

const DetailItem = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <div>
      <span style={microLabel}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  ) : null;

export const Scope2SourceRow: React.FC<Scope2SourceRowProps> = ({
  source,
  onEdit,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const rp = source.renewableProcurement;
  const hasRE = rp?.hasInstrument;
  const needsData = !source.supplier || !source.gridRegion || (hasRE && !rp?.instrumentType);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--white)', marginBottom: 8, overflow: 'hidden' }}>

      {/* ── Row header ─────────────────────────────────────────────────────── */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', userSelect: 'none', gap: 12 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>
            {source.category === 'electricity' ? '⚡' : source.category === 'steam' ? '♨' : '🌡'}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {source.name}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {hasRE && <FlagChip type="marketBased" />}
            {needsData && <FlagChip type="needsData" />}
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--slate)', flexShrink: 0, textAlign: 'right', marginRight: 12 }}>
          {source.category === 'electricity'
            ? <span>{source.supplier} · {source.gridRegion || 'No region'}{source.gridConnectionType ? ` (${source.gridConnectionType})` : ''}</span>
            : <span>{source.supplier} · {source.isLowCarbon ? 'Low-Carbon' : 'Standard'}</span>
          }
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <StatusStamp status={source.status} size="sm" />
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate)', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            {isExpanded ? <ChevronUp size={16} /> : <MoreHorizontal size={18} />}
          </button>
        </div>
      </div>

      {/* ── Expanded body ───────────────────────────────────────────────────── */}
      {isExpanded && (
        <div style={{ backgroundColor: '#F7F8F7', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>

          {source.category === 'electricity' ? (
            <>
              {/* ── SECTION A — LOCATION-BASED ──────────────────────────────── */}
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #C8D9E0' }}>
                {/* Header */}
                <div style={{ background: '#EEF2F3', borderBottom: '1px solid #C8D9E0', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15 }}>⚡</span>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#3B6E86' }}>
                    LOCATION-BASED — Grid Connection
                  </span>
                </div>
                {/* Body */}
                <div style={{ background: 'var(--white)', padding: '12px 14px' }}>
                  <DetailGrid>
                    <DetailItem label="Supplier / Utility" value={source.supplier} />
                    <DetailItem label="Grid Connection Type" value={source.gridConnectionType} />
                    <DetailItem label="Grid Region" value={source.gridRegion} />
                    <DetailItem label="Consumer Number" value={source.consumerNumber} />
                  </DetailGrid>
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--slate)' }}>
                    Scope 2 (LB) emissions calculated using the grid emission factor for <strong>{source.gridRegion || 'this region'}</strong>.
                  </p>
                </div>
              </div>

              {/* ── SECTION B — MARKET-BASED ────────────────────────────────── */}
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #B8DBC4' }}>
                {/* Header */}
                <div style={{ background: 'var(--mint)', borderBottom: '1px solid #B8DBC4', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15 }}>☀</span>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--canopy)' }}>
                    MB — Renewable Procurement (Market-Based)
                  </span>
                </div>
                {/* Body */}
                <div style={{ background: '#FAFFFE', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {hasRE ? (
                    <>
                      {/* B1 */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--harbor)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
                          Source &amp; Location
                        </div>
                        <DetailGrid>
                          <DetailItem label="RE Source" value={rp?.reSourceType ? RE_SOURCE_LABELS[rp.reSourceType] : undefined} />
                          <DetailItem label="Location" value={rp?.reLocation === 'onsite' ? 'Onsite' : rp?.reLocation === 'offsite' ? 'Offsite' : undefined} />
                          <DetailItem label="Connection Type" value={rp?.connectionType ? CONNECTION_LABELS[rp.connectionType] : undefined} />
                          {rp?.connectionType === 'throughGrid' && (
                            <DetailItem label="Linked Meter" value={rp.linkedGridConnectionName || 'Not linked to specific meter'} />
                          )}
                        </DetailGrid>
                      </div>

                      {/* B2 */}
                      <div style={{ borderTop: '1px solid #D4EDD9', paddingTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--harbor)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
                          Ownership &amp; Procurement Route
                        </div>
                        <DetailGrid>
                          <DetailItem label="RE Ownership" value={rp?.reOwnership === 'companyOwned' ? 'Company-owned' : rp?.reOwnership === 'landlordOwned' ? 'Landlord-owned' : undefined} />
                          <DetailItem label="Metering" value={rp?.metering === 'gross' ? 'Gross metering' : rp?.metering === 'net' ? 'Net metering' : undefined} />
                          <DetailItem label="Procurement Type" value={rp?.procurementRoute ? PROCUREMENT_LABELS[rp.procurementRoute] : undefined} />
                          <DetailItem label="Agreement Type" value={rp?.agreementType ? AGREEMENT_LABELS[rp.agreementType] : undefined} />
                        </DetailGrid>
                      </div>

                      {/* B3 */}
                      <div style={{ borderTop: '1px solid #D4EDD9', paddingTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--harbor)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
                          Contractual Instrument
                        </div>
                        {rp?.instrumentType && rp.instrumentType !== 'none' ? (
                          <DetailGrid>
                            <DetailItem label="Instrument Type" value={INSTRUMENT_LABELS[rp.instrumentType] ?? rp.instrumentType} />
                            <DetailItem label="Coverage" value={rp.coverage === 'full' ? '100% (Full)' : rp.coveragePercent ? `Partial — ${rp.coveragePercent}%` : 'Partial'} />
                            <DetailItem label="Issuing Body" value={rp.issuingBody} />
                            <DetailItem label="Vintage Year" value={rp.vintageYear} />
                            <DetailItem label="Contract Reference" value={rp.contractReference} />
                          </DetailGrid>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#FFF7E6', border: '1px solid #F0D9A8', borderRadius: 6, padding: '5px 10px', color: '#8A5A1A' }}>
                            ⚠ No instrument held — market-based Scope 2 will use supplier default or residual mix factor
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--slate)' }}>
                      No renewable energy procurement declared. Scope 2 reported using location-based grid average only.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Non-electricity */
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
              <DetailGrid>
                <DetailItem label="Category" value={`Purchased ${source.category}`} />
                <DetailItem label="Supplier / Provider" value={source.supplier} />
                <DetailItem label="Contract Type" value={source.contractType} />
                <DetailItem label="Source Type" value={source.isLowCarbon ? (source.sourceDescription || 'Low-Carbon / Renewable') : 'Standard (grid average)'} />
              </DetailGrid>
            </div>
          )}

          {/* ── Actions ─────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={e => { e.stopPropagation(); onEdit(source); }}
              style={{ padding: '6px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Edit2 size={14} /> Edit Source
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={e => { e.stopPropagation(); onDelete(source.id); }}
              style={{ padding: '6px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
