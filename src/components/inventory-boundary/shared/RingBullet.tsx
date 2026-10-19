import React from 'react';

interface RingBulletProps {
  active?: boolean;
  size?: number;
  className?: string;
}

export const RingBullet: React.FC<RingBulletProps> = ({
  active = false,
  size = 8,
  className = '',
}) => {
  return (
    <span
      className={`inline-block rounded-full transition-all duration-200 ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: active ? 'var(--coral)' : 'transparent',
        border: active ? '2px solid var(--coral)' : '1.5px solid var(--slate)',
        flexShrink: 0,
      }}
    />
  );
};
