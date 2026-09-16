import { Suspense } from "react";
import { AnalyzeClient } from "@/components/AnalyzeClient";

export default function AnalyzePage() {
  return (
    <main className="flex-1 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Suspense fallback={<p className="text-sm text-gray-500">Loading...</p>}>
          <AnalyzeClient />
        </Suspense>
      </div>
    </main>
  );
}
