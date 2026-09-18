import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteHistoryView } from "@/components/history/SiteHistoryView";

export default async function SiteHistoryPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const decodedSite = decodeURIComponent(site);

  return (
    <main className="flex-1 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex justify-center mb-6">
          <Logo className="h-14 w-auto" />
        </div>
        <div className="flex items-center justify-between mb-6 gap-4">
          <Link
            href="/history"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ← All websites
          </Link>
          <Link
            href="/"
            className="shrink-0 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            New analysis
          </Link>
        </div>
        <SiteHistoryView site={decodedSite} />
      </div>
    </main>
  );
}
