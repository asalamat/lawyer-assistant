// Plain CSS bars — no charting dependency, matching this app's general
// preference for hand-rolled implementations (the icon set, TOTP) over a
// new package when a real need doesn't justify one.

export function VerticalBarChart({
  data,
  formatValue,
}: {
  data: { label: string; value: number }[];
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2" style={{ height: 160 }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-muted">{formatValue ? formatValue(d.value) : d.value}</span>
          <div
            className="w-full rounded-t bg-accent/70"
            style={{ height: `${Math.max(2, (d.value / max) * 120)}px` }}
            title={`${d.label}: ${formatValue ? formatValue(d.value) : d.value}`}
          />
          <span className="text-[10px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HorizontalBarChart({
  data,
  formatValue,
}: {
  data: { label: string; value: number }[];
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-sm">
          <span className="w-32 shrink-0 truncate text-muted">{d.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
            <div className="h-full rounded-full bg-accent/70" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs text-muted">
            {formatValue ? formatValue(d.value) : d.value}
          </span>
        </div>
      ))}
    </div>
  );
}
