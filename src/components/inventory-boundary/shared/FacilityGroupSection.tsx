import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import type { Facility } from '@/lib/inventory-types';

interface FacilityGroupSectionProps {
  facility: Facility;
  assetCount: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export const FacilityGroupSection: React.FC<FacilityGroupSectionProps> = ({
  facility,
  assetCount,
  defaultExpanded = true,
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);

  if (assetCount === 0) return null;

  return (
    <div
      style={{
        backgroundColor: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        overflow: 'hidden',
        marginBottom: '16px',
      }}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          backgroundColor: 'var(--paper)',
          border: 'none',
          borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background-color 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isExpanded ? (
            <ChevronDown size={18} color="var(--slate)" />
          ) : (
            <ChevronRight size={18} color="var(--slate)" />
          )}
          <Building2 size={16} color="var(--canopy)" />
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>
            {facility.name}
          </span>
          {facility.isHeadOffice && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--canopy)',
                backgroundColor: 'var(--canopy-tint)',
                padding: '2px 6px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              HQ
            </span>
          )}
        </div>

        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--slate)',
            backgroundColor: 'var(--white)',
            border: '1px solid var(--border)',
            padding: '2px 8px',
            borderRadius: '9999px',
          }}
        >
          {assetCount} {assetCount === 1 ? 'asset' : 'assets'}
        </span>
      </button>

      {isExpanded && (
        <div style={{ padding: '8px 12px' }}>{children}</div>
      )}
    </div>
  );
};
