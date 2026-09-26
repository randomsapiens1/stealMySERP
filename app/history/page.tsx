import { Greeting } from "@/components/history/Greeting";
import { HistoryDashboard } from "@/components/history/HistoryDashboard";
import { QuickStartBar } from "@/components/history/QuickStartBar";

export default function HistoryPage() {
  return (
    <main className="px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Greeting />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Here&apos;s what&apos;s happening with your websites.
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
