type Props = { compact?: boolean };

const STAGES = ["Emissions", "Measure", "Understand", "Reduce", "Transition", "Decarbonise"];

export function DecarbonisationVisual({ compact = false }: Props) {
  return (
    <svg
      viewBox="0 0 720 900"
      preserveAspectRatio={compact ? "xMidYMid slice" : "xMidYMax slice"}
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Illustration of a transition from industrial emissions, through measurement and reduction, to clean renewable energy."
    >
      <defs>
        <linearGradient id="dw-sky" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.15 0.012 250)" />
          <stop offset="45%" stopColor="oklch(0.18 0.016 220)" />
          <stop offset="80%" stopColor="oklch(0.24 0.04 170)" />
          <stop offset="100%" stopColor="oklch(0.36 0.075 150)" />
        </linearGradient>
        <linearGradient id="dw-ground" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.16 0.012 240)" />
          <stop offset="100%" stopColor="oklch(0.26 0.05 152)" />
        </linearGradient>
        <linearGradient id="dw-flow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.55 0.02 240 / 0.15)" />
          <stop offset="55%" stopColor="oklch(0.86 0.16 105 / 0.55)" />
          <stop offset="100%" stopColor="oklch(0.68 0.15 138 / 0.85)" />
        </linearGradient>
        <linearGradient id="dw-plume" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.75 0.02 240 / 0.5)" />
          <stop offset="100%" stopColor="oklch(0.75 0.02 240 / 0)" />
        </linearGradient>
        <radialGradient id="dw-glow" cx="0.82" cy="0.28" r="0.55">
          <stop offset="0%" stopColor="oklch(0.68 0.15 138 / 0.35)" />
          <stop offset="100%" stopColor="oklch(0.68 0.15 138 / 0)" />
        </radialGradient>
      </defs>

      <rect width="720" height="900" fill="url(#dw-sky)" />
      <rect width="720" height="900" fill="url(#dw-glow)" />

      <g stroke="oklch(1 0 0 / 0.05)" strokeWidth="1">
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`v${i}`} x1={i * 72} y1="0" x2={i * 72} y2="900" />
        ))}
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 72} x2="720" y2={i * 72} />
        ))}
      </g>

      <g>
        {[
          { x: 96, y: 640, s: 1, d: 0 },
          { x: 132, y: 600, s: 0.8, d: 3.5 },
          { x: 168, y: 660, s: 0.65, d: 7 },
          { x: 236, y: 620, s: 0.5, d: 5 },
          { x: 300, y: 640, s: 0.34, d: 9 },
          { x: 372, y: 650, s: 0.2, d: 12 },
        ].map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={26 * p.s + 10}
            fill="url(#dw-plume)"
            style={{
              animation: `plume-drift ${26 + i * 3}s linear ${p.d}s infinite`,
              opacity: 0,
            }}
          />
        ))}
      </g>

      <g fill="none" stroke="url(#dw-flow)" strokeLinecap="round">
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M -20 ${430 + i * 46} C 190 ${370 + i * 40}, 420 ${470 + i * 34}, 740 ${300 + i * 30}`}
            strokeWidth={i === 1 ? 2 : 1.2}
            strokeDasharray="6 14"
            style={{ animation: `flow-dash ${18 + i * 6}s linear infinite` }}
          />
        ))}
      </g>

      <g fill="oklch(0.13 0.012 245)" stroke="oklch(0.6 0.02 210 / 0.28)" strokeWidth="1">
        <rect x="40" y="648" width="46" height="182" />
        <rect x="86" y="690" width="26" height="140" />
        <rect x="122" y="608" width="34" height="222" rx="2" />
        <rect x="160" y="700" width="58" height="130" />
        <rect x="222" y="664" width="20" height="166" />
        <rect x="248" y="726" width="72" height="104" />
      </g>
      <g fill="oklch(0.86 0.16 105 / 0.35)">
        {[[52,700],[64,730],[96,742],[176,748],[196,772],[262,762]].map(([x,y],i) => (
          <rect key={i} x={x} y={y} width="7" height="9" />
        ))}
      </g>

      <g stroke="oklch(0.72 0.02 200 / 0.45)" strokeWidth="2" fill="none">
        <path d="M400 830 L414 700 L428 830 M404 792 h20 M407 758 h14" />
        <path d="M386 712 h56 M392 736 h44" />
        <path d="M300 726 C 350 742, 380 712, 414 712 C 452 712, 486 690, 540 676" strokeWidth="1.2" />
      </g>

      <g>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${478 + i * 74} ${792 - i * 10})`}>
            <path d="M0 0 L62 -16 L62 6 L0 24 Z" fill="oklch(0.34 0.05 200)" />
            <path d="M0 0 L62 -16 L62 6 L0 24 Z" fill="none" stroke="oklch(0.68 0.15 138 / 0.5)" strokeWidth="1" />
            <line x1="14" y1="18" x2="14" y2="42" stroke="oklch(0.3 0.02 200)" strokeWidth="3" />
          </g>
        ))}
      </g>

      {[{ x: 560, y: 470, s: 1, dur: 14 }, { x: 656, y: 520, s: 0.72, dur: 18 }].map((t, i) => (
        <g key={i} transform={`translate(${t.x} ${t.y}) scale(${t.s})`}>
          <rect x="-3" y="0" width="6" height="230" fill="oklch(0.8 0.01 150 / 0.5)" />
          <g style={{ animation: `turbine-spin ${t.dur}s linear infinite`, transformOrigin: "0px 0px" }}>
            {[0, 120, 240].map((a) => (
              <path key={a} d="M0 0 L7 -8 L2 -86 L-2 -86 Z" fill="oklch(0.92 0.01 150 / 0.65)" transform={`rotate(${a})`} />
            ))}
          </g>
          <circle r="5" fill="oklch(0.95 0.01 150 / 0.8)" />
        </g>
      ))}

      <rect y="830" width="720" height="70" fill="url(#dw-ground)" />

      <g fontFamily="system-ui, sans-serif" fontSize="11" letterSpacing="1.6" fill="oklch(0.95 0.01 120 / 0.55)">
        <g style={{ animation: "soft-pulse 9s ease-in-out infinite" }}>
          <circle cx="474" cy="236" r="2.5" fill="oklch(0.86 0.16 105)" />
          <text x="486" y="240">SCOPE 1</text>
        </g>
        <g style={{ animation: "soft-pulse 9s ease-in-out 3s infinite" }}>
          <circle cx="556" cy="300" r="2.5" fill="oklch(0.86 0.16 105)" />
          <text x="568" y="304">SCOPE 2</text>
        </g>
        <g style={{ animation: "soft-pulse 9s ease-in-out 6s infinite" }}>
          <circle cx="500" cy="366" r="2.5" fill="oklch(0.68 0.15 138)" />
          <text x="512" y="370">SCOPE 3</text>
        </g>
        <text x="520" y="196" fontSize="10" fill="oklch(0.95 0.01 120 / 0.4)">tCO₂e −38%</text>
        <text x="60" y="176" fontSize="10" fill="oklch(0.95 0.01 120 / 0.32)">BASELINE</text>
      </g>

      {!compact && (
        <g fontFamily="system-ui, sans-serif" fontSize="9" letterSpacing="0.6">
          <line x1="110" y1="882" x2="610" y2="882" stroke="oklch(1 0 0 / 0.16)" strokeWidth="1" />
          {STAGES.map((s, i) => {
            const x = 110 + (500 / (STAGES.length - 1)) * i;
            const on = i / (STAGES.length - 1);
            return (
              <g key={s}>
                <circle cx={x} cy={882} r={i === STAGES.length - 1 ? 4 : 2.5}
                  fill={`oklch(${0.6 + on * 0.15} ${0.02 + on * 0.13} ${240 - on * 100})`} />
                <text x={x} y={866}
                  textAnchor={i === 0 ? "start" : i === STAGES.length - 1 ? "end" : "middle"}
                  fill={`oklch(0.97 0.01 120 / ${0.72 + on * 0.28})`}>
                  {s.toUpperCase()}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
