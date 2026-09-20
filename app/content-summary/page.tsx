import { Suspense } from "react";
import { ContentSummaryClient } from "@/components/ContentSummaryClient";

export default function ContentSummaryPage() {
  return (
    <main className="flex-1 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Suspense fallback={<p className="text-sm text-gray-500">Loading...</p>}>
          <ContentSummaryClient />
        </Suspense>
      </div>
    </main>
  );
}
