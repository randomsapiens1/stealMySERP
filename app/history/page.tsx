import Link from "next/link";
import { HistoryDashboard } from "@/components/history/HistoryDashboard";

export default function HistoryPage() {
  return (
    <main className="flex-1 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">History</h1>
          <Link
            href="/"
            className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            New analysis
          </Link>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Every page you&apos;ve analyzed, saved locally (SQLite, this machine only). Click a
          row to see its full detail.
        </p>
        <HistoryDashboard />
      </div>
    </main>
  );
}
