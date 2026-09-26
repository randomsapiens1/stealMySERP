import type { ReactNode } from "react";

const TINTS = {
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
} as const;

export function DashboardStatCard({
  icon,
  tint = "indigo",
  label,
  value,
  sublabel,
  trend = false,
}: {
  icon: ReactNode;
  tint?: keyof typeof TINTS;
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${TINTS[tint]}`}>{icon}</span>
      </div>
      <span className="text-[11px] font-medium tracking-wide text-gray-400 dark:text-gray-500 uppercase">
        {label}
      </span>
      <div className="text-3xl font-semibold tabular-nums mt-0.5">{value}</div>
      {sublabel && (
        <div
          className={`text-xs mt-1 flex items-center gap-1 ${
            trend ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {trend && <span aria-hidden>↑</span>}
          {sublabel}
        </div>
      )}
    </div>
  );
}
