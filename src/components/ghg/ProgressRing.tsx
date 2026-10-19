import { completionColor } from "@/lib/ghg/store";

interface Props {
  value: number;              // 0..1
  size?: number;
  strokeWidth?: number;
  label?: string;
  showPercent?: boolean;
}

export function ProgressRing({
  value, size = 56, strokeWidth = 6, label, showPercent = true,
}: Props) {
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped);
  const color = completionColor(clamped);
  const stroke =
    color === "green" ? "var(--color-ghg-green)"
    : color === "amber" ? "var(--color-amber-warn)"
    : color === "red" ? "var(--color-critical)"
    : "var(--color-border)";

  return (
    <div className="inline-flex items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="var(--color-border)" strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={stroke} strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 400ms ease, stroke 400ms ease" }}
        />
        {showPercent && (
          <text
            x="50%" y="50%"
            textAnchor="middle" dominantBaseline="central"
            transform={`rotate(90 ${size / 2} ${size / 2})`}
            className="fill-foreground"
            style={{ fontSize: size * 0.28, fontWeight: 600 }}
          >
            {Math.round(clamped * 100)}%
          </text>
        )}
      </svg>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}
