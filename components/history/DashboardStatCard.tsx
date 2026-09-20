import type { ReactNode } from "react";

export function DashboardStatCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium tracking-wide text-gray-400 dark:text-gray-500 uppercase">
          {label}
        </span>
        <span className="text-gray-300 dark:text-gray-600">{icon}</span>
      </div>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      {sublabel && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sublabel}</div>
      )}
    </div>
  );
}
