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
