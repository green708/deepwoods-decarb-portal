import React from 'react';
import { useInventory } from '@/context/InventoryContext';
import type { FiscalYear } from '@/lib/inventory-types';
import { ArrowRight } from 'lucide-react';

interface YearTilesProps {
  onSelectYear: (year: FiscalYear) => void;
}

export const YearTiles: React.FC<YearTilesProps> = ({ onSelectYear }) => {
  const { scope1Assets, scope2Sources } = useInventory();

  const years: FiscalYear[] = Array.from(
    new Set([
      ...scope1Assets.map((a) => a.fiscalYear),
      ...scope2Sources.map((s) => s.fiscalYear),
    ])
  ).sort((a, b) => b.localeCompare(a)) as FiscalYear[];

  const getStats = (year: FiscalYear) => {
    const s1 = scope1Assets.filter((a) => a.fiscalYear === year);
    const s2 = scope2Sources.filter((s) => s.fiscalYear === year);

    const s1Facs = new Set(s1.map((a) => a.facilityId));
    const s2Facs = new Set(s2.map((s) => s.facilityId));
    const allFacs = new Set([...s1Facs, ...s2Facs]);

    return {
      s1Count: s1.length,
      s2Count: s2.length,
      facCount: allFacs.size,
    };
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '32px',
      }}
    >
      {years.map((year, index) => {
        const stats = getStats(year);
        const isMostRecent = index === 0;

        return (
          <div
            key={year}
            onClick={() => onSelectYear(year)}
            className="card"
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '210px',
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                {year}
              </span>

              {isMostRecent && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--meadow)',
                    backgroundColor: 'var(--mint-tint)',
                    border: '1px solid var(--mint)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    letterSpacing: '0.04em',
                  }}
                >
                  MOST RECENT
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '12px 0' }}>
              <div style={{ fontSize: '13px', color: 'var(--slate)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Scope 1 assets:</span>
                <strong style={{ color: 'var(--ink)' }}>{stats.s1Count}</strong>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--slate)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Scope 2 sources:</span>
                <strong style={{ color: 'var(--ink)' }}>{stats.s2Count}</strong>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--slate)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Facilities covered:</span>
                <strong style={{ color: 'var(--ink)' }}>{stats.facCount}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--coral)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Open snapshot <ArrowRight size={14} />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
