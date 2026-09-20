import { HistoryDashboard } from "@/components/history/HistoryDashboard";
import { QuickStartBar } from "@/components/history/QuickStartBar";

export default function HistoryPage() {
  return (
    <main className="px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Google SERP audits, content gaps, and outreach leads — for free.
          </p>
        </div>

        <div className="mb-8">
          <QuickStartBar />
        </div>

        <HistoryDashboard />
      </div>
    </main>
  );
}
