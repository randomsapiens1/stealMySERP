import Link from "next/link";
import { SiteHistoryView } from "@/components/history/SiteHistoryView";

export default async function SiteHistoryPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const decodedSite = decodeURIComponent(site);

  return (
    <main className="px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/history"
          className="inline-block mb-6 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ← Back to monitored websites
        </Link>
        <SiteHistoryView site={decodedSite} />
      </div>
    </main>
  );
}
