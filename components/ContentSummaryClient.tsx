"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { ProgressStepper, type LogEntry } from "@/components/ProgressStepper";
import { postJson } from "@/lib/orchestrator/postJson";
import type { ContentSummary, PageContent } from "@/lib/shared/types";

function headingIndent(level: number): string {
  return "  ".repeat(Math.max(0, level - 1));
}

export function ContentSummaryClient() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") ?? "";

  const [log, setLog] = useState<LogEntry[]>([]);
  const [page, setPage] = useState<PageContent | null>(null);
  const [summary, setSummary] = useState<ContentSummary | null>(null);
  const [status, setStatus] = useState<"running" | "done" | "fatal">("running");
  const [fatalMessage, setFatalMessage] = useState("");
  const started = useRef(false);

  function addLog(stage: string, message: string, logStatus: LogEntry["status"]) {
    const id = crypto.randomUUID();
    setLog((prev) => [...prev, { id, stage, message, status: logStatus }]);
  }

  useEffect(() => {
    if (started.current || !url) return;
    started.current = true;

    void (async () => {
      try {
        addLog("extract", "Reading the page...", "pending");
        const extractRes = await postJson<{ extracted: PageContent[] }>(
          "/api/analyze/extract",
          { urls: [url] },
        );
        const extractedPage = extractRes.extracted[0];
        if (!extractedPage || extractedPage.error) {
          throw new Error(extractedPage?.error ?? "Could not read this page.");
        }
        setPage(extractedPage);
        addLog("extract", "Page read successfully.", "success");

        addLog("summary", "Summarizing content with the LLM...", "pending");
        const res = await postJson<{ summary: ContentSummary }>(
          "/api/analyze/content-summary",
          { page: extractedPage },
        );
        if (res.summary.error) throw new Error(res.summary.error);
        setSummary(res.summary);
        addLog("summary", "Summary ready.", "success");

        setStatus("done");
      } catch (err) {
        setFatalMessage(err instanceof Error ? err.message : "Content summary failed");
        setStatus("fatal");
      }
    })();
  }, [url]);

  if (!url) {
    return <p className="text-sm text-red-500">No URL provided.</p>;
  }

  return (
    <div>
      <div className="flex justify-center mb-6">
        <Logo className="h-14 w-auto" />
      </div>

      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="text-xl font-semibold">Content summary</h1>
        <Link
          href="/"
          className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          Home
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6 break-all">{url}</p>

      {status === "fatal" && (
        <p className="text-sm text-red-500 mb-6">Stopped: {fatalMessage}</p>
      )}

      <div className="mb-8">
        <ProgressStepper log={log} />
      </div>

      {page && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 mb-6">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Language</dt>
              <dd className="font-medium">{page.lang === "bn" ? "Bangla" : page.lang === "en" ? "English" : "Unknown"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Word count</dt>
              <dd className="font-medium tabular-nums">{page.wordCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Headings</dt>
              <dd className="font-medium tabular-nums">{page.headings.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Title length</dt>
              <dd className="font-medium tabular-nums">{page.title.length} chars</dd>
            </div>
          </dl>
          <div className="text-sm mb-2">
            <span className="text-gray-500 dark:text-gray-400">Title:</span> {page.title || "—"}
          </div>
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">Meta description:</span>{" "}
            {page.metaDescription || "—"}
          </div>
          {page.headings.length > 0 && (
            <details className="mt-3">
              <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer">
                Heading outline
              </summary>
              <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono">
                {page.headings.map((h) => `${headingIndent(h.level)}- ${h.text}`).join("\n")}
              </pre>
            </details>
          )}
        </div>
      )}

      {summary && (
        <div>
          <h2 className="text-lg font-semibold mb-1">{summary.primaryTopic || "Summary"}</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{summary.summary}</p>
          {summary.keyPoints.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
                What this page covers
              </h3>
              <ul className="space-y-1.5 text-sm list-disc list-inside">
                {summary.keyPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
