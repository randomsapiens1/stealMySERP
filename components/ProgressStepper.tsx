export interface LogEntry {
  id: string;
  stage: string;
  message: string;
  status: "pending" | "success" | "error";
}

const STATUS_STYLES: Record<LogEntry["status"], string> = {
  pending: "bg-gray-300 dark:bg-gray-600",
  success: "bg-green-500",
  error: "bg-red-500",
};

export function ProgressStepper({ log }: { log: LogEntry[] }) {
  if (log.length === 0) return null;

  return (
    <div className="space-y-1.5 text-sm font-mono">
      {log.map((entry) => (
        <div key={entry.id} className="flex items-start gap-2">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_STYLES[entry.status]}`}
          />
          <span className="text-gray-500 dark:text-gray-400 shrink-0">
            [{entry.stage}]
          </span>
          <span>{entry.message}</span>
        </div>
      ))}
    </div>
  );
}
