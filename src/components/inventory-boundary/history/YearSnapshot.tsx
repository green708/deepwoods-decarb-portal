import React from 'react';
import { ArrowLeft, Building2 } from 'lucide-react';
import { useInventory } from '@/context/InventoryContext';
import { useClientContext } from '@/lib/client-context';
import { generateAllYears } from '@/lib/entity';
import type { FiscalYear, Scope1Asset, Scope2Source } from '@/lib/inventory-types';
import { StatusStamp } from '@/components/inventory-boundary/shared/StatusStamp';
import { FlagChip } from '@/components/inventory-boundary/shared/FlagChip';

interface YearSnapshotProps {
  year: FiscalYear;
  onSelectYear: (year: FiscalYear) => void;
  onBack: () => void;
}

export const YearSnapshot: React.FC<YearSnapshotProps> = ({ year, onSelectYear, onBack }) => {
  const { scope1Assets, scope2Sources, facilities } = useInventory();
  const ctx = useClientContext();

  // Last 3 years, independent of any server-side config (works for a brand-new
  // client with no ghg_inventory rows yet) — same generator as the main
  // Fiscal Year switcher: 2015 through present, FY or CY.
  const years: FiscalYear[] = [...generateAllYears(ctx.client.reporting_period)].reverse().slice(0, 3);

  const currentS1Assets = scope1Assets.filter((a) => a.fiscalYear === year);
  const currentS2Sources = scope2Sources.filter((s) => s.fiscalYear === year);

  const facilitiesForYear = facilities.filter((fac) => {
    const hasS1 = currentS1Assets.some((a) => a.facilityId === fac.id);
    const hasS2 = currentS2Sources.some((s) => s.facilityId === fac.id);
    return hasS1 || hasS2;
  });

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: 'var(--white)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          marginBottom: '24px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate)' }}>
          SNAPSHOT YEAR:
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {years.map((y) => {
            const isActive = y === year;
            return (
              <button
                key={y}
                type="button"
                onClick={() => onSelectYear(y)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: isActive ? '1px solid var(--coral)' : '1px solid var(--border)',
                  backgroundColor: isActive ? 'var(--coral-tint)' : 'var(--paper)',
                  color: isActive ? 'var(--coral)' : 'var(--slate)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: '28px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--coral)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '12px',
            padding: 0,
          }}
        >
          <ArrowLeft size={14} /> Back to all years
        </button>

        <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
          {year} — Inventory Boundary Snapshot
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--slate)' }}>
          Read-only. This is the boundary as it stood at the close of the reporting period.
        </p>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h3
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--canopy)',
            marginBottom: '16px',
            paddingBottom: '8px',
            borderBottom: '2px solid var(--canopy-tint)',
          }}
        >
          Scope 1 · Direct Emission Assets ({currentS1Assets.length})
        </h3>

        {facilitiesForYear.map((fac) => {
          const facAssets = currentS1Assets.filter((a) => a.facilityId === fac.id);
          if (facAssets.length === 0) return null;

          const stationary = facAssets.filter((a) => a.subcategory === 'stationary');
          const mobile = facAssets.filter((a) => a.subcategory === 'mobile');
          const fugitive = facAssets.filter((a) => a.subcategory === 'fugitive');

          return (
            <div
              key={fac.id}
              style={{
                backgroundColor: 'var(--white)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <Building2 size={16} color="var(--canopy)" />
                <span>{fac.name}</span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--slate)',
                    backgroundColor: 'var(--paper)',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    border: '1px solid var(--border)',
                  }}
                >
                  {facAssets.length} assets
                </span>
              </div>

              {stationary.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <span className="micro-label" style={{ display: 'block', marginBottom: '6px' }}>
                    Stationary Combustion
                  </span>
                  {stationary.map((asset) => <ReadOnlyAssetRow key={asset.id} asset={asset} />)}
                </div>
              )}
              {mobile.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <span className="micro-label" style={{ display: 'block', marginBottom: '6px' }}>
                    Mobile Combustion
                  </span>
                  {mobile.map((asset) => <ReadOnlyAssetRow key={asset.id} asset={asset} />)}
                </div>
              )}
              {fugitive.length > 0 && (
                <div>
                  <span className="micro-label" style={{ display: 'block', marginBottom: '6px' }}>
                    Fugitive Sources
                  </span>
                  {fugitive.map((asset) => <ReadOnlyAssetRow key={asset.id} asset={asset} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <h3
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--harbor)',
            marginBottom: '16px',
            paddingBottom: '8px',
            borderBottom: '2px solid var(--harbor-tint)',
          }}
        >
          Scope 2 · Indirect Energy Sources ({currentS2Sources.length})
        </h3>

        {facilitiesForYear.map((fac) => {
          const facSources = currentS2Sources.filter((s) => s.facilityId === fac.id);
          if (facSources.length === 0) return null;

          return (
            <div
              key={fac.id}
              style={{
                backgroundColor: 'var(--white)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <Building2 size={16} color="var(--harbor)" />
                <span>{fac.name}</span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--slate)',
                    backgroundColor: 'var(--paper)',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    border: '1px solid var(--border)',
                  }}
                >
                  {facSources.length} sources
                </span>
              </div>
              {facSources.map((source) => <ReadOnlySourceRow key={source.id} source={source} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ReadOnlyAssetRow: React.FC<{ asset: Scope1Asset }> = ({ asset }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      backgroundColor: 'var(--paper)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      marginBottom: '6px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{asset.name}</span>
      {asset.isBiogenic && <FlagChip type="biogenic" />}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '12px', color: 'var(--slate)' }}>
        {asset.fuelType || asset.refrigerantOrGas || asset.equipmentType || ''}
      </span>
      <StatusStamp status={asset.status} size="sm" />
    </div>
  </div>
);

const ReadOnlySourceRow: React.FC<{ source: Scope2Source }> = ({ source }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      backgroundColor: 'var(--paper)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      marginBottom: '6px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{source.name}</span>
      {source.renewableProcurement?.hasInstrument && <FlagChip type="marketBased" />}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '12px', color: 'var(--slate)' }}>
        {source.supplier} · {source.gridRegion || source.category}
      </span>
      <StatusStamp status={source.status} size="sm" />
    </div>
  </div>
);
