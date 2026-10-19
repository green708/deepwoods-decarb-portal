import React from 'react';

export const Watermark: React.FC = () => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '380px',
        height: '380px',
        pointerEvents: 'none',
        opacity: 0.05,
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        <circle cx="250" cy="150" r="60" stroke="#111827" strokeWidth="2.5" />
        <circle cx="250" cy="150" r="100" stroke="#111827" strokeWidth="2.5" />
        <circle cx="250" cy="150" r="140" stroke="#111827" strokeWidth="2" />
        <circle cx="250" cy="150" r="180" stroke="#111827" strokeWidth="2" />
        <circle cx="250" cy="150" r="220" stroke="#111827" strokeWidth="1.5" />
        <circle cx="250" cy="150" r="260" stroke="#111827" strokeWidth="1.5" />
        <circle cx="250" cy="150" r="300" stroke="#111827" strokeWidth="1" />
      </svg>
    </div>
  );
};
