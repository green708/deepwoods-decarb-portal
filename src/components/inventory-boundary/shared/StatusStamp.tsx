import React from 'react';
import type { Status } from '@/lib/inventory-types';

interface StatusStampProps {
  status: Status | string;
  size?: 'sm' | 'md';
}

export const StatusStamp: React.FC<StatusStampProps> = ({
  status,
  size = 'md',
}) => {
  let label = status;
  let bg = 'var(--slate-tint)';
  let color = 'var(--slate)';
  let borderColor = 'var(--slate)';

  switch (status) {
    case 'active':
      label = 'Active';
      bg = 'var(--mint-tint)';
      color = 'var(--meadow)';
      borderColor = 'var(--meadow)';
      break;
    case 'efficient':
      label = 'Efficient';
      bg = 'var(--mint-tint)';
      color = 'var(--meadow)';
      borderColor = 'var(--meadow)';
      break;
    case 'monitor':
      label = 'Monitor';
      bg = '#FFFBEB';
      color = 'var(--amber)';
      borderColor = 'var(--amber)';
      break;
    case 'flagForReplacement':
      label = 'Flag for Replacement';
      bg = 'var(--coral-tint)';
      color = 'var(--coral)';
      borderColor = 'var(--coral)';
      break;
    default:
      label = status;
      bg = 'var(--slate-tint)';
      color = 'var(--slate)';
      borderColor = 'var(--slate)';
      break;
  }

  const isSmall = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? '4px' : '6px',
        padding: isSmall ? '2px 8px' : '4px 10px',
        borderRadius: '9999px',
        fontSize: isSmall ? '11px' : '12px',
        fontWeight: 500,
        backgroundColor: bg,
        color: color,
        border: `1px solid ${borderColor}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: isSmall ? '5px' : '6px',
          height: isSmall ? '5px' : '6px',
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
};
