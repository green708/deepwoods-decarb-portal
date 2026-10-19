import React, { useState } from 'react';

type ChipType = 'biogenic' | 'needsData' | 'marketBased';

interface FlagChipProps {
  type: ChipType;
}

export const FlagChip: React.FC<FlagChipProps> = ({ type }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  let icon = '';
  let label = '';
  let bg = '';
  let color = '';
  let borderColor = '';
  let tooltipText = '';

  if (type === 'biogenic') {
    icon = '🌱';
    label = 'BIOGENIC';
    bg = 'var(--mint-tint)';
    color = 'var(--meadow)';
    borderColor = 'var(--meadow)';
    tooltipText =
      'CO₂ from this source is reported as a memo item outside Scope 1. CH₄ and N₂O remain within Scope 1.';
  } else if (type === 'needsData') {
    icon = '⚠';
    label = 'NEEDS DATA';
    bg = '#FFFBEB';
    color = 'var(--amber)';
    borderColor = 'var(--amber)';
    tooltipText =
      'This source is missing information needed for accurate reporting. Click the row to complete it.';
  } else if (type === 'marketBased') {
    icon = '💧';
    label = 'LB + MB';
    bg = 'var(--harbor-tint)';
    color = 'var(--harbor)';
    borderColor = 'var(--harbor)';
    tooltipText =
      'This connection has renewable procurement on file — Scope 2 is reported under both location-based (LB) and market-based (MB) methods.';
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 7px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          backgroundColor: bg,
          color: color,
          border: `1px solid ${borderColor}`,
          cursor: 'help',
          userSelect: 'none',
        }}
      >
        <span>{icon}</span>
        <span>{label}</span>
      </span>

      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '6px',
            padding: '8px 12px',
            backgroundColor: 'var(--ink)',
            color: 'var(--white)',
            fontSize: '12px',
            lineHeight: '1.4',
            borderRadius: '6px',
            width: 'max-content',
            maxWidth: '260px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 50,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {tooltipText}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              borderWidth: '5px',
              borderStyle: 'solid',
              borderColor: 'var(--ink) transparent transparent transparent',
            }}
          />
        </div>
      )}
    </div>
  );
};
