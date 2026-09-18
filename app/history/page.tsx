import Link from "next/link";
import { HistoryDashboard } from "@/components/history/HistoryDashboard";
import { Logo } from "@/components/Logo";

export default function HistoryPage() {
  return (
    <main className="flex-1 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex justify-center mb-6">
          <Logo className="h-14 w-auto" />
        </div>
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-semibold">History</h1>
            <p className="text-sm text-gray-500 mt-1">
              Every page you&apos;ve analyzed, saved to your database. Click a website to see its
              full run history.
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            New analysis
          </Link>
        </div>
        <HistoryDashboard />
      </div>
    </main>
  );
}
