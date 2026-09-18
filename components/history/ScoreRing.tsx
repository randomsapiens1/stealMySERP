function tierColorClass(value: number): string {
  if (value >= 80) return "text-emerald-500";
  if (value >= 50) return "text-blue-500";
  if (value >= 25) return "text-amber-500";
  return "text-red-500";
}

export function ScoreRing({ value }: { value: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="relative h-10 w-10 shrink-0">
      <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
        <circle cx="20" cy="20" r={radius} strokeWidth="3" className="stroke-gray-200 dark:stroke-gray-800" fill="none" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          strokeWidth="3"
          fill="none"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={tierColorClass(value)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

function barColorClass(value: number): string {
  if (value >= 70) return "bg-emerald-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-red-400";
}

export function MetricBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full ${barColorClass(value)}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-8 text-right">{value}</span>
    </div>
  );
}
