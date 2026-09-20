"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { ProgressStepper, type LogEntry } from "@/components/ProgressStepper";
import { QuickCheckReport, type QueryWithSerp } from "@/components/QuickCheckReport";
import { fetchSerpViaExtension, pingExtensionBridge } from "@/lib/orchestrator/extensionSerp";
import { postJson } from "@/lib/orchestrator/postJson";
import { cleanAiOverviewText } from "@/lib/shared/aiOverviewText";
import { delay } from "@/lib/shared/chunk";
import type { PageContent, PageQueries, SerpResult } from "@/lib/shared/types";

const SERP_DELAY_MS = 2500;

export function QuickCheckClient() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") ?? "";

  const [status, setStatus] = useState<"running" | "done" | "fatal">("running");
  const [fatalMessage, setFatalMessage] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [page, setPage] = useState<PageContent | null>(null);
  const [pageQueries, setPageQueries] = useState<PageQueries | null>(null);
  const [rows, setRows] = useState<QueryWithSerp[]>([]);
  const started = useRef(false);
  const retryRef = useRef<() => void>(() => {});

  function addLog(stage: string, message: string, logStatus: LogEntry["status"]) {
    const id = crypto.randomUUID();
    setLog((prev) => [...prev, { id, stage, message, status: logStatus }]);
  }

  useEffect(() => {
    if (started.current || !url) return;
    started.current = true;

    async function runCheck() {
      setStatus("running");
      setFatalMessage("");
      setLog([]);
      setPage(null);
      setPageQueries(null);
      setRows([]);

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

        addLog(
          "queries",
          "Inferring up to 10 target queries (English + Bangla if relevant)...",
          "pending",
        );
        const queriesRes = await postJson<{ pageQueries: PageQueries }>(
          "/api/analyze/quick-queries",
          { page: extractedPage },
        );
        const inferred = queriesRes.pageQueries;
        setPageQueries(inferred);

        if (inferred.queries.length === 0) {
          addLog("queries", "No target queries could be inferred for this page.", "error");
          setStatus("done");
          return;
        }
        const bnCount = inferred.queries.filter((q) => q.languageOfQuery === "bn").length;
        const enCount = inferred.queries.length - bnCount;
        addLog(
          "queries",
          `Inferred ${inferred.queries.length} queries (${enCount} English${bnCount > 0 ? `, ${bnCount} Bangla` : ""}).`,
          "success",
        );

        const useExtensionBridge =
          process.env.NEXT_PUBLIC_SERP_SOURCE === "extension" && (await pingExtensionBridge());
        addLog(
          "serp",
          useExtensionBridge
            ? "Fetching Google results and People Also Ask via the browser extension bridge..."
            : "Fetching Google results and People Also Ask for each query...",
          "pending",
        );

        const nextRows: QueryWithSerp[] = [];
        for (const query of inferred.queries) {
          let serp: SerpResult;
          try {
            serp = useExtensionBridge
              ? await fetchSerpViaExtension(query.query, query.languageOfQuery)
              : await postJson<SerpResult>("/api/analyze/serp", {
                  query: query.query,
                  lang: query.languageOfQuery,
                });
          } catch (err) {
            serp = {
              query: query.query,
              hl: query.languageOfQuery === "bn" ? "bn" : "en",
              gl: query.languageOfQuery === "bn" ? "bd" : "us",
              top10: [],
              paa: [],
              relatedSearches: [],
              aiOverview: null,
              error: err instanceof Error ? err.message : "SERP fetch failed",
            };
          }
          if (serp.aiOverview) {
            serp.aiOverview = { ...serp.aiOverview, text: cleanAiOverviewText(serp.aiOverview.text) };
          }
          nextRows.push({ query, serp });
          setRows([...nextRows]);
          addLog(
            "serp",
            serp.error || serp.blocked
              ? `"${query.query}" — ${serp.error ?? "blocked"}`
              : `"${query.query}" — ${serp.top10.length} results, ${serp.paa.length} PAA`,
            serp.error || serp.blocked ? "error" : "success",
          );
          await delay(SERP_DELAY_MS);
        }

        setStatus("done");
      } catch (err) {
        setFatalMessage(err instanceof Error ? err.message : "Quick check failed");
        setStatus("fatal");
      }
    }

    retryRef.current = () => void runCheck();
    void runCheck();
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
        <h1 className="text-xl font-semibold">Quick check</h1>
        <Link
          href="/"
          className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          Home
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6 break-all">{url}</p>

      {status === "fatal" && (
        <div className="mb-6">
          <p className="text-sm text-red-500 mb-3">Stopped: {fatalMessage}</p>
          <button
            type="button"
            onClick={() => retryRef.current()}
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mb-8">
        <ProgressStepper log={log} />
      </div>

      {pageQueries && pageQueries.queries.length > 0 && (
        <QuickCheckReport page={page} pageQueries={pageQueries} rows={rows} status={status} />
      )}
    </div>
  );
}
