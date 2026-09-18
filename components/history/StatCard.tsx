export function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3.5 flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}
