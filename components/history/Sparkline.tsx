// Google-rank trend: lower is better, so the y-axis is inverted — a rising
// line means rank is improving, matching how "up" reads everywhere else.
export function RankSparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <span className="text-xs text-gray-400 dark:text-gray-600">—</span>;
  }

  const width = 72;
  const height = 28;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const improved = values[values.length - 1] < values[0];
  const worsened = values[values.length - 1] > values[0];
  const stroke = improved
    ? "stroke-emerald-500"
    : worsened
      ? "stroke-red-400"
      : "stroke-gray-400 dark:stroke-gray-600";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="overflow-visible">
      <path d={path} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={stroke} />
    </svg>
  );
}
