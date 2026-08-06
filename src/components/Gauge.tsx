export type GaugeStatus = "good" | "warn" | "bad";

// Universal red/amber/green regardless of this app's warm maroon accent —
// on an ops dashboard, status color needs to read instantly and
// consistently, which matters more here than matching the brand palette.
const STATUS_COLORS: Record<GaugeStatus, string> = {
  good: "#16a34a",
  warn: "#d97706",
  bad: "#dc2626",
};

export function GaugeRing({
  percent,
  status,
  size = 88,
  strokeWidth = 8,
}: {
  percent: number;
  status: GaugeStatus;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-black/[0.06] dark:stroke-white/[0.1]"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={STATUS_COLORS[status]}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GaugeCard({
  label,
  value,
  percent,
  status,
  sublabel,
}: {
  label: string;
  value: string;
  percent: number;
  status: GaugeStatus;
  sublabel?: string;
}) {
  return (
    <div className="surface-card flex flex-col items-center gap-3 py-6 text-center">
      <div className="relative flex items-center justify-center">
        <GaugeRing percent={percent} status={status} />
        <span className="absolute font-display text-lg leading-none">{value}</span>
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {sublabel && <p className="text-xs text-muted">{sublabel}</p>}
      </div>
    </div>
  );
}

export function StackedBar({
  segments,
}: {
  segments: { label: string; bytes: number; colorClass: string }[];
}) {
  const total = segments.reduce((sum, s) => sum + s.bytes, 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1]">
        {segments.map((s) => (
          <div
            key={s.label}
            className={s.colorClass}
            style={{ width: total > 0 ? `${(s.bytes / total) * 100}%` : "0%" }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.colorClass}`} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
